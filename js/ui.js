/* ============================================================
   宝可梦：关都篇 - UI 渲染层（像素风，无框架）
   Created by haodongsheng
   ============================================================ */

function $id(id) { return document.getElementById(id); }

// HTML 转义：玩家输入的名字可能包含特殊字符，内联渲染前必须转义
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

let _lastBattle = null, _foeHp = null, _playerHp = null, _foeIdx = null, _playerIdx = null;
let _bagTab = 'heal';
let _boxSwapIdx = -1;
let _uiPlaying = false; // 行动播放期间锁定操作（仅禁用按钮，不锁全页、不转圈）

function logLineHtml(text, i) {
  const kind = STATE.logKinds && STATE.logKinds[i];
  return '<div class="log-line' + (kind ? ' log-' + kind : '') + '">' + text + '</div>';
}

// 按 HP 快照更新一侧血条（配合 CSS 过渡产生平滑动画，不做整页重绘）
function applyHpSnapshot(snap) {
  if (!snap) return;
  const setBar = function (el, hp, max) {
    if (!el) return;
    const pct = Math.max(0, Math.round(hp / max * 100));
    const fill = el.querySelector('.hpbar-fill');
    const text = el.querySelector('.hp-text');
    if (fill) {
      fill.style.width = pct + '%';
      fill.style.background = pct > 50 ? 'var(--hp)' : (pct > 20 ? 'var(--gold)' : 'var(--red)');
    }
    if (text) text.textContent = 'HP ' + Math.max(0, hp) + '/' + max;
  };
  setBar($id('battle-foe'), snap.foe, snap.foeMax);
  setBar($id('battle-player'), snap.player, snap.playerMax);
}

// 战斗行动播放：新增日志逐条滚动 + HP/行动条动画，期间仅禁用按钮（快、轻量、不整页重绘）
function playBattleResult(from, battleRef) {
  const total = STATE.log.length;
  if (total <= from) { render(); return; }
  if (_uiPlaying) return;
  // 战斗已结束（切回地图）：先暂留战斗画面播完尾部文本，再切回地图，避免地图日志框出现“没信息”的空窗
  const endedBattle = STATE.screen === 'map' && STATE.battle === null;
  if (endedBattle) STATE.screen = 'battle';
  const hpSteps = battleRef ? battleRef.hpSteps : [];
  const hpOffset = battleRef ? battleRef.logStart : 0;
  _uiPlaying = true;
  const actions = $id('battle-actions');
  if (actions) {
    Array.prototype.forEach.call(actions.querySelectorAll('.btn'), function (b) { b.disabled = true; });
    const hint = actions.querySelector('.turn-hint');
    if (hint) hint.textContent = '……结算中……';
  }
  const n = total - from;
  const interval = n > 12 ? 200 : (n > 6 ? 300 : 380);
  let i = 0;
  (function tick() {
    if (i >= n) {
      _uiPlaying = false;
      if (endedBattle) STATE.screen = 'map';
      render();
      return;
    }
    const line = STATE.log[from + i];
    const kind = STATE.logKinds[from + i];
    const snap = hpSteps[from + i - hpOffset];
    if (snap) applyHpSnapshot(snap);
    const div = document.createElement('div');
    div.className = 'log-line' + (kind ? ' log-' + kind : '');
    div.textContent = line;
    const box = document.querySelector('#screen-battle.active') ? $id('battle-log') : $id('log-box');
    if (box) {
      box.appendChild(div);
      box.scrollTop = box.scrollHeight;
    }
    i++;
    setTimeout(tick, interval);
  })();
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shadeColor(hex, percent) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, Math.floor((n >> 16) + (255 * (n >> 16) / 255) * percent / 100)));
  const g = Math.max(0, Math.min(255, Math.floor(((n >> 8) & 255) + (255 * ((n >> 8) & 255) / 255) * percent / 100)));
  const b = Math.max(0, Math.min(255, Math.floor((n & 255) + (255 * (n & 255) / 255) * percent / 100)));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function drawIcon(canvas, speciesId, pixelSize, shiny) {
  const S = 16;
  const ctx = canvas.getContext('2d');
  const data = POKEDEX[speciesId];
  if (!data) return;
  const rng = mulberry32((speciesId * 2654435761) >>> 0);
  // 闪光形态：金色系配色（超越之塔闪光石解锁）
  const primary = shiny ? '#f8c84f' : data.color;
  const secondary = shadeColor(primary, -30);
  const dark = shadeColor(primary, -55);
  const light = shadeColor(primary, 25);
  ctx.clearRect(0, 0, S, S);
  for (let y = 3; y <= 13; y++) {
    for (let x = 2; x <= 13; x++) {
      const r = rng();
      if (r < 0.62) ctx.fillStyle = primary;
      else if (r < 0.82) ctx.fillStyle = secondary;
      else if (r < 0.9) ctx.fillStyle = light;
      else continue;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // 轮廓
  ctx.fillStyle = dark;
  for (let y = 3; y <= 13; y++) { ctx.fillRect(2, y, 1, 1); ctx.fillRect(13, y, 1, 1); }
  for (let x = 2; x <= 13; x++) { ctx.fillRect(x, 3, 1, 1); ctx.fillRect(x, 13, 1, 1); }
  // 眼睛
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(5, 6, 2, 2); ctx.fillRect(9, 6, 2, 2);
  ctx.fillStyle = '#20242e';
  ctx.fillRect(5, 6, 1, 1); ctx.fillRect(10, 6, 1, 1);
  // 腮红（小点缀）
  ctx.fillStyle = shadeColor(primary, 15);
  ctx.fillRect(4, 10, 2, 1); ctx.fillRect(10, 10, 2, 1);
  // 闪光星星标记（头顶）
  if (shiny) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(7, 1, 2, 2);
    ctx.fillRect(6, 2, 1, 1); ctx.fillRect(9, 2, 1, 1);
  }
  canvas.style.width = pixelSize + 'px';
  canvas.style.height = pixelSize + 'px';
  canvas.style.imageRendering = 'pixelated';
}

function monIcon(speciesId, px, shiny) {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 16;
  drawIcon(c, speciesId, px || 40, shiny);
  return c;
}

function openModal(title, bodyHtml) {
  const root = $id('modal-root');
  root.innerHTML = '<div class="overlay" id="modal-overlay"><div class="modal pixel-frame">' +
    '<div class="modal-header"><span>' + title + '</span><button class="btn btn-sm" onclick="closeModal()">✕</button></div>' +
    '<div class="modal-body">' + bodyHtml + '</div></div></div>';
}

function closeModal() {
  $id('modal-root').innerHTML = '';
}

function typeColor(type) {
  const colors = {
    '普通': '#a8a090', '火': '#f05030', '水': '#3899f8', '电': '#f8d030',
    '草': '#78c850', '冰': '#58c8e0', '格斗': '#c03028', '毒': '#a040a0',
    '地面': '#e0c068', '飞行': '#a890f0', '超能力': '#f85888', '虫': '#a8b820',
    '岩石': '#b8a038', '幽灵': '#705898', '龙': '#7038f8', '恶': '#705848', '钢': '#b8b8d0'
  };
  return colors[type] || '#a8a090';
}

function statusIcon(status) {
  if (!status) return '';
  const map = { '中毒': '☠️', '麻痹': '⚡', '灼伤': '🔥', '睡眠': '💤', '冰冻': '❄️', '剧毒': '☠️' };
  return '<span class="status-badge">' + (map[status] || status) + '</span>';
}

function statusClass(status) {
  const map = {
    '中毒': 'status-poison',
    '剧毒': 'status-badly-poison',
    '灼伤': 'status-burn',
    '麻痹': 'status-paralysis',
    '睡眠': 'status-sleep',
    '冰冻': 'status-freeze'
  };
  return map[status] || '';
}

function battleStatusBadge(status) {
  if (!status) return '';
  return '<span class="battle-status ' + statusClass(status) + '">' + status + '</span>';
}

// 稀有度词缀（普通不显示，传说/稀有/少见显示彩色标签）
function rarityTag(mon) {
  const r = rarityOf(mon);
  if (r.key === 'common') return '';
  const star = r.key === 'legendary' ? '★' : '';
  return '<span class="rarity r-' + r.key + '">' + star + r.label + '</span>';
}

// 图鉴格子专用：词缀单独一行，避免与名字抢横向空间导致裁剪
function dexRarityLine(d) {
  const r = rarityOf(d);
  if (r.key === 'common') return '';
  const star = r.key === 'legendary' ? '★' : '';
  return '<div class="dex-rarity r-' + r.key + '">' + star + r.label + '</div>';
}

// 道具描述增强：进化石动态列出可进化的宝可梦，避免"让特定宝可梦进化"这种模糊文案
function itemDesc(item) {
  if (!item) return '';
  let desc = item.desc || '';
  if (item.type === 'stone') {
    const targets = stoneTargets(item.stone);
    if (targets.length > 0) {
      desc = '让宝可梦进化：' + targets.map(function (t) {
        return (POKEDEX[t.fromId] ? POKEDEX[t.fromId].name : '?') + '→' + (POKEDEX[t.toId] ? POKEDEX[t.toId].name : '?');
      }).join('、');
    }
  }
  return desc;
}

function natureText(nature) {
  const m = NATURES[nature] || NATURES['勤奋'];
  const names = { atk: '攻击', def: '防御', spa: '特攻', spd: '特防', spe: '速度' };
  const boosts = [], drops = [];
  for (const k in names) {
    if (m[k] > 1) boosts.push(names[k]);
    else if (m[k] < 1) drops.push(names[k]);
  }
  if (boosts.length === 0) return nature;
  return nature + '（' + boosts.join('/') + '↑' + (drops.length > 0 ? '，' + drops.join('/') + '↓' : '') + '）';
}

function hpBar(mon) {
  const pct = Math.max(0, Math.round(mon.hp / mon.stats.hp * 100));
  const color = pct > 50 ? 'var(--hp)' : (pct > 20 ? 'var(--gold)' : 'var(--red)');
  return '<div class="hpbar"><div class="hpbar-fill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
    '<div class="hp-text">HP ' + Math.max(0, mon.hp) + '/' + mon.stats.hp + '</div>';
}

function ppSummary(mon) {
  let left = 0, max = 0;
  for (let i = 0; i < mon.moves.length; i++) {
    const mv = MOVES[mon.moves[i]];
    if (!mv) continue;
    max += mv.pp;
    left += (mon.pp && mon.pp[i] !== undefined) ? Math.max(0, mon.pp[i]) : mv.pp;
  }
  return { left: left, max: max };
}

function scrollLogToBottom() {
  const box = $id('log-box');
  if (box) box.scrollTop = box.scrollHeight;
}

function render() {
  const screens = ['title', 'starter', 'map', 'battle'];
  for (let i = 0; i < screens.length; i++) {
    const el = $id('screen-' + screens[i]);
    if (el) el.classList.toggle('active', STATE.screen === screens[i]);
  }
  if (STATE.screen === 'title') {
    $id('btn-continue').style.display = hasSave() ? '' : 'none';
  }
  if (STATE.screen === 'starter') renderStarter();
  if (STATE.screen === 'map') renderMap();
  if (STATE.screen === 'battle') renderBattle();
  if (STATE.screen === 'map' || STATE.screen === 'battle') {
    if (STATE.pendingLearn.length > 0) showLearnModal();
    else if (STATE.rocketSell) showRocketSellModal();
    else if (STATE.magikarpOffer) showMagikarpModal();
    else if (STATE.merchantOffer) showMerchantModal();
    else if (STATE.banditToll) showBanditModal();
    else if (STATE.medicOffer) showMedicModal();
    else if (STATE.townTrade) showTradeModal();
  }
}

// ---------------- 标题 / 选御三家 ----------------

function uiStartNew() {
  STATE.screen = 'starter';
  render();
}

function uiContinue() {
  if (load()) render();
  else alert('没有找到存档！');
}

function uiReset() {
  if (confirm('确定要删除存档，重新开始吗？')) {
    resetGame();
    render();
  }
}

function exportSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) { alert('还没有存档可以导出。'); return; }
    const code = btoa(unescape(encodeURIComponent(raw)));
    openModal('导出存档', '<div class="shop-hint">复制下面的存档码，粘贴到另一台设备即可导入：</div>' +
      '<textarea id="save-code" class="save-code" readonly>' + code + '</textarea>' +
      '<div class="modal-btns"><button class="btn btn-primary" onclick="copySaveCode()">复制存档码</button></div>');
  } catch (e) {
    alert('导出失败：' + e.message);
  }
}

// 玩家改名：点击地图顶栏名字弹出，成功后随存档保存
function showRenameModal() {
  openModal('修改玩家名',
    '<div class="shop-hint">给自己起个响亮的名字（最多 10 个字）：</div>' +
    '<input class="save-code" id="rename-input" maxlength="10" value="' + esc(STATE.name || '') + '">' +
    '<div class="modal-btns">' +
    '<button class="btn btn-primary" onclick="doRename()">确认改名</button>' +
    '<button class="btn" onclick="closeModal()">取消</button></div>');
  const inp = $id('rename-input');
  if (inp) inp.focus();
}

function doRename() {
  const inp = $id('rename-input');
  if (renamePlayer(inp ? inp.value : '')) {
    closeModal();
    render();
  }
}

function copySaveCode() {
  const ta = $id('save-code');
  if (!ta) return;
  ta.select();
  try {
    document.execCommand('copy');
    closeModal();
    alert('存档码已复制！');
  } catch (e) {
    alert('复制失败，请手动全选复制。');
  }
}

function showImportSave() {
  openModal('导入存档', '<div class="shop-hint">粘贴存档码后点击导入（会覆盖当前存档）：</div>' +
    '<textarea id="import-code" class="save-code" placeholder="粘贴存档码..."></textarea>' +
    '<div class="modal-btns"><button class="btn btn-primary" onclick="doImportSave()">导入</button></div>');
}

function doImportSave() {
  const ta = $id('import-code');
  const code = ta ? ta.value.trim() : '';
  if (!code) return;
  try {
    const json = decodeURIComponent(escape(atob(code)));
    const data = JSON.parse(json);
    if (!data || data.version !== GAME_VERSION) {
      alert('存档码无效或版本不匹配。');
      return;
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    closeModal();
    if (!load()) alert('导入失败，请检查存档码。');
    else render();
  } catch (e) {
    alert('导入失败：存档码无效。');
  }
}

function uiPickStarter(id) {
  newGame(id);
  save();
  render();
}

function renderStarter() {
  const ids = [1, 4, 7];
  const names = { 1: '妙蛙种子', 4: '小火龙', 7: '杰尼龟' };
  const types = { 1: '草/毒', 4: '火', 7: '水' };
  let html = '<div class="starter-row">';
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    html += '<div class="starter-card pixel-frame" onclick="uiPickStarter(' + id + ')">' +
      '<div class="starter-icon" id="starter-icon-' + id + '"></div>' +
      '<div class="starter-name">' + names[id] + '</div>' +
      '<div class="starter-type">' + types[id] + '</div></div>';
  }
  html += '</div><div class="starter-hint">大木博士：选一只你喜欢的宝可梦，开始你的关都之旅吧！</div>';
  $id('starter-content').innerHTML = html;
  for (let i = 0; i < ids.length; i++) {
    const box = $id('starter-icon-' + ids[i]);
    box.appendChild(monIcon(ids[i], 64));
  }
}

// ---------------- 地图界面 ----------------

function goalHint() {
  const order = ['pewter', 'cerulean', 'vermilion', 'celadon', 'saffron', 'fuchsia', 'cinnabar', 'viridian'];
  let goal = null;
  for (let i = 0; i < order.length; i++) {
    const node = MAP_NODES[order[i]];
    const g = node.gym;
    if (STATE.badges.indexOf(g.badge) === -1) {
      goal = order[i];
      break;
    }
  }
  if (!goal) {
    if (STATE.badges.length >= 8 && !STATE.tower.cleared) return '当前目标：挑战无尽之塔，征服 100 层！';
    return '当前目标：前往 22 号道路，挺进冠军之路！';
  }
  const g = MAP_NODES[goal].gym;
  const path = pathToGoal();
  const label = path.map(function (id) {
    const n = MAP_NODES[id];
    const locked = n.requireBadge && STATE.badges.indexOf(n.requireBadge) === -1;
    return n.name + (locked ? '（需' + n.requireBadge + '）' : '');
  }).join(' → ');
  return '目标路线：' + label + ' → 挑战 ' + g.leader + '（首发 Lv.' + g.minLevel + '+）';
}

function renderMap() {
  const node = MAP_NODES[STATE.nodeId];
  $id('loc-label').textContent = '[当前位置：' + node.name + ']';
  $id('weather-label').textContent = '[当前天气：' + WEATHER[STATE.weather].icon + ' ' + WEATHER[STATE.weather].name + ']';
  const eqTitle = STATE.equippedTitle ? parseTitleEntry(STATE.equippedTitle) : null;
  $id('meta-label').innerHTML = (eqTitle ? '<span class="' + rarityClass(eqTitle.rarity) + '">[' + esc(titleLabel(eqTitle.id, eqTitle.rarity)) + ']</span> ' : '') +
    '👤 <span class="player-name" title="点击改名" onclick="showRenameModal()">' + esc(STATE.name || '训练家') + '</span> · 💰 ' + STATE.money + '  · 徽章 ' + STATE.badges.length + '/8  · 图鉴 ' + Object.keys(STATE.seenDex).length + '/151' +
    (STATE.titles.length ? ' · 称号：' + STATE.titles.length + ' 个' : '');
  $id('goal-label').textContent = goalHint();

  const logBox = $id('log-box');
  logBox.innerHTML = STATE.log.map(logLineHtml).join('');
  scrollLogToBottom();

  // 队伍条
  let strip = '';
  if (STATE.party.length === 0) strip = '<div class="party-empty">队伍空空如也……</div>';
  for (let i = 0; i < STATE.party.length; i++) {
    const m = STATE.party[i];
    strip += '<div class="party-card pixel-frame" onclick="showMonDetail(' + i + ')">' +
      '<div class="party-icon" id="party-icon-' + i + '"></div>' +
      '<div class="party-info"><div class="party-name">' + (i === 0 ? '⭐ ' : '') + m.name + (m.shiny ? ' ✨' : '') + (m.held ? ' ⚡' : '') + ' ' + statusIcon(m.status) + '</div>' +
      '<div class="party-lv">Lv.' + m.level + '</div>' + hpBar(m) +
      '<div class="party-pp">PP ' + ppSummary(m).left + '/' + ppSummary(m).max + '</div></div></div>';
  }
  $id('party-strip').innerHTML = strip;
  for (let i = 0; i < STATE.party.length; i++) {
    $id('party-icon-' + i).appendChild(monIcon(STATE.party[i].species, 36, STATE.party[i].shiny));
  }

  // 操作按钮
  const panel = $id('action-panel');
  let html = '';
  if (node.type === 'town') {
    html += '<button class="btn" onclick="doMapAction(\'center\')">🏥 宝可梦中心(恢复)</button>';
    html += '<button class="btn" onclick="doMapAction(\'mart\')">🏪 友好商店</button>';
    html += '<button class="btn" onclick="doMapAction(\'wander\')">🚶 在镇上逛逛</button>';
    html += '<button class="btn" onclick="doMapAction(\'box\')">📦 电脑箱（' + STATE.box.length + '只）</button>';
    html += '<button class="btn" onclick="doMapAction(\'dex\')">📚 图鉴合集</button>';
    html += '<button class="btn" onclick="doMapAction(\'map\')">🗺️ 地图</button>';
    if (node.gym && STATE.badges.indexOf(node.gym.badge) === -1) {
      if (node.gym.requireBadges && STATE.badges.length < node.gym.requireBadges) {
        html += '<button class="btn" disabled>🏟️ 常磐道馆（需要 ' + node.gym.requireBadges + ' 枚徽章）</button>';
      } else {
        html += '<button class="btn btn-primary" onclick="doMapAction(\'gym\')">🏟️ 挑战道馆（首发 Lv.' + node.gym.minLevel + '+）</button>';
      }
    } else if (node.gym) {
      html += '<button class="btn" disabled>🏟️ 道馆已挑战</button>';
    }
    html += '<button class="btn" onclick="doMapAction(\'travel\')">🚶 前往下个地点</button>';
  } else if (node.id === 'tower') {
    // 无尽之塔：塔内专用操作（不能回城补给，只能靠背包道具）
    const t = STATE.tower;
    const btnText = (t.replaying || t.floor > 1) ? '挑战第 ' + t.floor + ' 层' : (t.cleared ? '重新挑战（第 1 层）' : '开始挑战（第 1 层）');
    html += '<button class="btn btn-primary" onclick="doMapAction(\'towerFight\')">🗼 ' + btnText + '</button>';
    if (t.cleared) {
      const st = t.superCleared ? '重新挑战（第 1 层）' : (t.superFloor > 1 ? '挑战第 ' + t.superFloor + ' 层' : '开始挑战（第 1 层）');
      html += '<button class="btn btn-primary" onclick="doMapAction(\'superFight\')">⛩️ 超越之塔：' + st + '</button>';
    }
    html += '<button class="btn" onclick="doMapAction(\'bag\')">🎒 背包（塔内补给）</button>';
    html += '<button class="btn" onclick="doMapAction(\'party\')">🐾 精灵队伍</button>';
    html += '<button class="btn" onclick="doMapAction(\'towerInfo\')">ℹ️ 塔内进度</button>';
    html += '<button class="btn" onclick="doMapAction(\'travel\')">🚪 离开无尽之塔</button>';
  } else {
    html += '<button class="btn btn-primary" onclick="doMapAction(\'explore\')">🌿 在草丛探索</button>';
    if (node.water && STATE.keyItems.indexOf('破旧钓竿') !== -1) {
      html += '<button class="btn" onclick="doMapAction(\'fish\')">🎣 钓鱼</button>';
    }
    html += '<button class="btn" onclick="doMapAction(\'bag\')">🎒 打开背包</button>';
    html += '<button class="btn" onclick="doMapAction(\'party\')">🐾 精灵队伍</button>';
    html += '<button class="btn" onclick="doMapAction(\'box\')">📦 电脑箱（' + STATE.box.length + '只）</button>';
    html += '<button class="btn" onclick="doMapAction(\'dex\')">📚 图鉴合集</button>';
    html += '<button class="btn" onclick="doMapAction(\'map\')">🗺️ 地图</button>';
    // 深层区域（洞穴/冠军之路）隐藏“返回城镇”，只能走回或使用穿绳
    if (node.type !== 'cave') html += '<button class="btn" onclick="doMapAction(\'town\')">🏘️ 返回城镇</button>';
    html += '<button class="btn" onclick="doMapAction(\'travel\')">🚶 前往下个地点</button>';
    if (bagCount('穿绳') > 0) html += '<button class="btn" onclick="doMapAction(\'escape\')">🧵 使用穿绳</button>';
  }
  html += '<button class="btn" onclick="exportSave()">📤 导出存档</button>';
  $id('action-panel').innerHTML = html;
}

function doMapAction(type) {
  closeModal();
  switch (type) {
    case 'center': visitCenter(); break;
    case 'mart': showShopModal(); return;
    case 'wander': wanderTown(); break;
    case 'gym': challengeGym(); break;
    case 'gymlocked': addLog(MAP_NODES[STATE.nodeId].gymLocked, 'info'); break;
    case 'travel': showTravelModal(); return;
    case 'explore': explore(); break;
    case 'fish': fish(); break;
    case 'bag': showBagModal(false); return;
    case 'party': showPartyModal('view'); return;
    case 'box': showBoxModal(); return;
    case 'pokedex': showPokedexModal(); return;
    case 'itemdex': showItemDexModal(); return;
    case 'movedex': showMoveDexModal(); return;
    case 'dex': showDexHub(); return;
    case 'map': showMapModal(); return;
    case 'towerFight': startTowerFloor(); save(); render(); break;
    case 'superFight': startSuperTowerFloor(); save(); render(); break;
    case 'towerInfo': showTowerInfo(); return;
    case 'town': {
      const cur = MAP_NODES[STATE.nodeId];
      const towns = cur.next.filter(function (n) { return MAP_NODES[n].type === 'town'; });
      if (towns.length > 0) gotoNode(towns[0]);
      else gotoNode(STATE.lastTown);
      break;
    }
    case 'escape': useEscapeRope(); break;
    case 'reset': uiReset(); return;
  }
  save();
  render();
}

function showTravelModal() {
  const cur = MAP_NODES[STATE.nodeId];
  let html = '';
  for (let i = 0; i < cur.next.length; i++) {
    const n = MAP_NODES[cur.next[i]];
    const locked = n.requireBadge && STATE.badges.indexOf(n.requireBadge) === -1;
    html += '<button class="btn travel-btn" ' + (locked ? 'disabled' : 'onclick="doTravel(\'' + n.id + '\')"') + '>' +
      n.name + (locked ? '（需要 ' + n.requireBadge + '）' : '') + '</button>';
  }
  openModal('前往下个地点', html);
}

function doTravel(nodeId) {
  gotoNode(nodeId);
  save();
  closeModal();
  render();
}

// ---------------- 商店 ----------------

function showShopModal() {
  const buyQty = function (name) {
    const item = ITEMS[name];
    const max = item ? Math.max(0, Math.min(99, Math.floor(STATE.money / item.price))) : 0;
    return { qty: max <= 0 ? 0 : Math.min(_buyQty[name] || 1, max), max: max };
  };
  const sellQty = function (name) {
    const max = bagCount(name);
    return { qty: max <= 0 ? 0 : Math.min(_sellQty[name] || 1, max), max: max };
  };
  let html = '<div class="shop-hint">持有徽章：' + STATE.badges.length + ' 枚，金钱：' + STATE.money + '</div>';
  for (let i = 0; i < MART_STOCK.length; i++) {
    const entry = MART_STOCK[i];
    const item = ITEMS[entry.name];
    if (!item) continue;
    const locked = entry.minBadges > STATE.badges.length;
    const bq = buyQty(item.name);
    html += '<div class="shop-row' + (locked ? ' locked' : '') + '"><span title="' + itemDesc(item) + '">' + item.name + '（' + item.price + '金）' +
      (locked ? ' <span class="shop-lock">需 ' + entry.minBadges + ' 徽章</span>' : '') + '</span>' +
      (locked ? '<button class="btn btn-sm" disabled>未解锁</button>' :
        '<span class="shop-qty">' +
        '<button class="btn btn-sm" onclick="shopStep(\'buy\',\'' + item.name + '\',-1)"' + (bq.qty <= 1 ? ' disabled' : '') + '>−</button>' +
        '<b>' + bq.qty + '</b>' +
        '<button class="btn btn-sm" onclick="shopStep(\'buy\',\'' + item.name + '\',1)"' + (bq.qty >= bq.max ? ' disabled' : '') + '>+</button>' +
        '<button class="btn btn-sm" onclick="doBuy(\'' + item.name + '\',' + bq.qty + ')"' + (bq.max <= 0 ? ' disabled' : '') + '>购买（' + item.price * bq.qty + '金）</button>' +
        '</span>') + '</div>' +
      '<div class="shop-desc">' + itemDesc(item) + '</div>';
  }
  html += '<div class="shop-hint">—— 出售 ——</div>';
  const keys = Object.keys(STATE.bag).filter(function (k) { return bagCount(k) > 0; });
  if (keys.length === 0) html += '<div class="shop-hint">没有可出售的道具</div>';
  for (let i = 0; i < keys.length; i++) {
    const item = ITEMS[keys[i]];
    if (!item) continue;
    const price = item.sell || Math.floor((item.price || 0) / 2);
    if (price <= 0) continue;
    const sq = sellQty(keys[i]);
    html += '<div class="shop-row"><span title="' + itemDesc(item) + '">' + keys[i] + ' ×' + bagCount(keys[i]) + '（卖' + price + '金）</span>' +
      '<span class="shop-qty">' +
      '<button class="btn btn-sm" onclick="shopStep(\'sell\',\'' + keys[i] + '\',-1)"' + (sq.qty <= 1 ? ' disabled' : '') + '>−</button>' +
      '<b>' + sq.qty + '</b>' +
      '<button class="btn btn-sm" onclick="shopStep(\'sell\',\'' + keys[i] + '\',1)"' + (sq.qty >= sq.max ? ' disabled' : '') + '>+</button>' +
      '<button class="btn btn-sm" onclick="doSell(\'' + keys[i] + '\',' + sq.qty + ')"' + (sq.max <= 0 ? ' disabled' : '') + '>卖出（' + price * sq.qty + '金）</button>' +
      '</span></div>' +
      '<div class="shop-desc">' + itemDesc(item) + '</div>';
  }
  openModal('友好商店', html);
}

const _buyQty = {};
const _sellQty = {};
const _bagUseQty = {};

// 商店数量加减：原地更新该行数量与总价，不整表重渲染（避免滚动跳回顶部）
function shopStep(kind, name, delta) {
  const max = kind === 'buy' ? Math.max(0, Math.min(99, Math.floor(STATE.money / (ITEMS[name] ? ITEMS[name].price : 1)))) : bagCount(name);
  const cur = kind === 'buy' ? (_buyQty[name] || 1) : (_sellQty[name] || 1);
  const next = Math.max(1, Math.min(Math.max(1, max), cur + delta));
  if (kind === 'buy') _buyQty[name] = next;
  else _sellQty[name] = next;
  const item = ITEMS[name];
  const price = kind === 'buy' ? item.price : (item.sell || Math.floor((item.price || 0) / 2));
  const rows = document.querySelectorAll('#modal-root .shop-row');
  for (let i = 0; i < rows.length; i++) {
    const span = rows[i].querySelector('span');
    if (!span || span.textContent.indexOf(name) === -1) continue;
    const isSellRow = span.textContent.indexOf('卖') !== -1;
    if ((kind === 'buy') === isSellRow) continue;
    const qtyEl = rows[i].querySelector('.shop-qty b');
    const btns = rows[i].querySelectorAll('.shop-qty button');
    if (qtyEl) qtyEl.textContent = next;
    if (btns.length >= 3) {
      btns[0].disabled = next <= 1;
      btns[1].disabled = next >= max;
      const buyBtn = btns[btns.length - 1];
      buyBtn.textContent = (kind === 'buy' ? '购买（' : '卖出（') + (price * next) + '金）';
      buyBtn.disabled = next <= 0 || max <= 0;
      buyBtn.setAttribute('onclick', (kind === 'buy' ? 'doBuy(\'' : 'doSell(\'') + name + '\',' + next + ')');
    }
    break;
  }
}

// 商店重渲染并保持滚动位置（购买/出售后使用）
function refreshShop() {
  const sc = document.querySelector('#modal-root .modal');
  const top = sc ? sc.scrollTop : 0;
  // 先刷新底层地图（顶栏金钱/背包数量等），避免关闭商店后显示旧值
  renderMap();
  showShopModal();
  const nsc = document.querySelector('#modal-root .modal');
  if (nsc && top > 0) nsc.scrollTop = top;
}

function doBuy(name, qty) {
  buyItem(name, qty || 1);
  save();
  refreshShop();
}

function doSell(name, qty) {
  sellItem(name, qty || 1);
  save();
  refreshShop();
}

// ---------------- 背包 / 队伍 ----------------

const BAG_TABS = [
  { id: 'heal', label: '恢复', match: function (item) { return ['heal', 'cure', 'pp'].indexOf(item.type) !== -1; } },
  { id: 'ball', label: '精灵球', match: function (item) { return item.type === 'ball'; } },
  { id: 'tm', label: '技能机', match: function (item) { return item.type === 'tm'; } },
  { id: 'key', label: '关键物品', match: function (item) { return item.type === 'key'; } },
  { id: 'misc', label: '道具', match: function (item) { return ['stone', 'held', 'repel', 'weather', 'weatherboost', 'escape', 'loot', 'candy', 'shiny', 'shard', 'egg', 'retalent'].indexOf(item.type) !== -1; } },
  { id: 'titles', label: '🏅 称号', match: function () { return false; } }
];

function showBagModal(inBattle, tab) {
  if (!tab) tab = _bagTab;
  if (inBattle && tab !== 'heal' && tab !== 'ball') tab = 'heal';
  _bagTab = tab;
  const keys = Object.keys(STATE.bag).filter(function (k) { return bagCount(k) > 0; });
  const availTabs = BAG_TABS.filter(function (t) { return !inBattle || t.id === 'heal' || t.id === 'ball'; });
  let html = '<div class="bag-tabs">';
  for (let i = 0; i < availTabs.length; i++) {
    const t = availTabs[i];
    html += '<button class="btn btn-sm' + (t.id === tab ? ' active' : '') + '" onclick="showBagModal(' + (inBattle ? 'true' : 'false') + ',\'' + t.id + '\')">' + t.label + '</button>';
  }
  html += '</div>';
  if (tab === 'titles') {
    html += '<div id="bag-titles-body">' + titleDexBodyHtml(false) + '</div>';
  } else if (tab === 'key') {
    if (STATE.keyItems.length === 0) html += '<div class="shop-hint">还没有关键道具</div>';
    for (let i = 0; i < STATE.keyItems.length; i++) {
      const item = ITEMS[STATE.keyItems[i]];
      html += '<div class="shop-row"><span title="' + itemDesc(item) + '">' + STATE.keyItems[i] + '</span></div>' +
        '<div class="shop-desc">' + itemDesc(item) + '</div>';
    }
  } else {
    const tabDef = BAG_TABS.filter(function (t) { return t.id === tab; })[0];
    const items = keys.filter(function (k) {
      const item = ITEMS[k];
      return item && tabDef && tabDef.match(item);
    });
    if (items.length === 0) html += '<div class="shop-hint">这个分类下没有道具</div>';
    for (let i = 0; i < items.length; i++) {
    const name = items[i];
    const item = ITEMS[name];
    if (!item) continue;
    let usable = false;
    if (inBattle && (item.type === 'ball' || item.type === 'heal' || item.type === 'cure')) usable = true;
    if (!inBattle && (item.type === 'heal' || item.type === 'cure' || item.type === 'stone' || item.type === 'tm' || item.type === 'pp' || item.type === 'held' || item.type === 'repel' || item.type === 'weather' || item.type === 'weatherboost' || item.type === 'escape' || item.type === 'candy' || item.type === 'egg' || item.type === 'retalent')) usable = true;
    html += '<div class="shop-row"><span title="' + itemDesc(item) + '">' + name + ' ×' + bagCount(name) + '</span>' +
      (usable ? '<button class="btn btn-sm" onclick="doBagUse(\'' + name + '\',' + (inBattle ? 'true' : 'false') + ')">使用</button>' : '') +
      '</div><div class="shop-desc">' + itemDesc(item) + '</div>';
    }
  }
  openModal(inBattle ? '背包（战斗中）' : '背包', html);
}

function doBagUse(name, inBattle) {
  if (_uiPlaying) return;
  const item = ITEMS[name];
  if (inBattle) {
    const from = STATE.log.length;
    const battleRef = STATE.battle;
    battleUseItem(name);
    save();
    closeModal();
    playBattleResult(from, battleRef);
    return;
  }
  if (item.type === 'repel') {
    useRepel();
    save();
    closeModal();
    render();
    return;
  }
  if (item.type === 'escape') {
    useEscapeRope();
    save();
    closeModal();
    render();
    return;
  }
  if (item.type === 'weather' || item.type === 'weatherboost') {
    useWeatherItem(name);
    save();
    closeModal();
    render();
    return;
  }
  if (item.type === 'egg') {
    useEggItem();
    save();
    closeModal();
    render();
    return;
  }
  if (item.type === 'heal' || item.type === 'cure' || item.type === 'stone' || item.type === 'tm' || item.type === 'pp' || item.type === 'held' || item.type === 'candy' || item.type === 'retalent') {
    showPartyModal('item', name);
  }
}

function bagUseQtyInfo(itemName, monIdx) {
  const item = ITEMS[itemName];
  const mon = STATE.party[monIdx];
  if (!item || !mon) return { qty: 0, max: 0 };
  if (item.type !== 'candy') return { qty: bagCount(itemName) > 0 ? 1 : 0, max: bagCount(itemName) > 0 ? 1 : 0 };
  const cb = mon.candyBonus || { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, total: 0 };
  const max = Math.max(0, Math.min(
    bagCount(itemName),
    15 - (cb[item.stat] || 0),
    50 - (cb.total || 0)
  ));
  const key = itemName + '@' + monIdx;
  return { qty: max <= 0 ? 0 : Math.min(_bagUseQty[key] || 1, max), max: max };
}

function partyItemStep(itemName, monIdx, delta) {
  const info = bagUseQtyInfo(itemName, monIdx);
  if (info.max <= 0) return;
  const key = itemName + '@' + monIdx;
  _bagUseQty[key] = Math.max(1, Math.min(info.max, info.qty + delta));
  showPartyModal('item', itemName);
}

function showPartyModal(mode, itemName) {
  let html = '';
  const isSwitch = mode === 'switch';
  const isItem = mode === 'item';
  const isBoxSwap = mode === 'boxswap';
  const item = isItem ? ITEMS[itemName] : null;
  const activeIdx = (isSwitch && STATE.battle) ? STATE.battle.player.active : -1;
  for (let i = 0; i < STATE.party.length; i++) {
    const m = STATE.party[i];
    let btn = '';
    if (isSwitch) {
      const unusable = m.hp <= 0 || i === activeIdx;
      btn = '<div class="row-btns"><button class="btn btn-sm"' + (unusable ? ' disabled' : '') + ' onclick="doSwitch(' + i + ')">' +
        (m.hp <= 0 ? '已倒下' : (i === activeIdx ? '在场' : '上场')) + '</button></div>';
    }
    else if (isBoxSwap) btn = '<div class="row-btns"><button class="btn btn-sm" onclick="doBoxSwapConfirm(' + i + ')">换入</button></div>';
    else if (isItem) {
      if (item && item.type === 'candy') {
        const q = bagUseQtyInfo(itemName, i);
        const meta = q.max <= 0 ? '该属性或总量已满' : '本次最多可喂 ' + q.max + ' 颗';
        btn = '<div class="row-btns candy-actions">' +
          '<div class="candy-stepper shop-qty">' +
          '<button class="btn btn-sm" onclick="partyItemStep(\'' + itemName + '\',' + i + ',-1)"' + (q.qty <= 1 ? ' disabled' : '') + '>−</button>' +
          '<div class="candy-qty">' + (q.max <= 0 ? 0 : q.qty) + '</div>' +
          '<button class="btn btn-sm" onclick="partyItemStep(\'' + itemName + '\',' + i + ',1)"' + (q.max <= 0 || q.qty >= q.max ? ' disabled' : '') + '>+</button>' +
          '</div>' +
          '<button class="btn btn-sm candy-feed-btn" onclick="doItemOnMon(\'' + itemName + '\',' + i + ',' + q.qty + ')"' + (q.max <= 0 ? ' disabled' : '') + '>' + (q.max <= 0 ? '已达上限' : '喂食 ' + q.qty + ' 颗') + '</button>' +
          '<div class="candy-meta">' + meta + '</div></div>';
      } else {
        btn = '<div class="row-btns"><button class="btn btn-sm" onclick="doItemOnMon(\'' + itemName + '\',' + i + ')">使用</button></div>';
      }
    }
    else {
      btn = '<div class="row-btns">';
      if (i === 0) btn += '<span class="lead-tag">首发</span>';
      else btn += '<button class="btn btn-sm" onclick="doSetLead(' + i + ')">设为首发</button>';
      btn += '<button class="btn btn-sm" onclick="showMonDetail(' + i + ')">详情</button></div>';
    }
    html += '<div class="party-row pixel-frame">' +
      '<div class="party-icon" id="modal-icon-' + i + '"></div>' +
      '<div class="party-info"><div class="party-name">' + rarityTag(m) + m.name + (m.shiny ? ' ✨' : '') + ' ' + statusIcon(m.status) + '</div>' +
      '<div class="party-lv">Lv.' + m.level + ' · ' + m.speciesData.types.join('/') +
      (m.nature ? ' · 性格' + m.nature : '') + (m.held ? ' · [' + m.held + ']' : '') + '</div>' + hpBar(m) +
      '<div class="party-pp">PP ' + ppSummary(m).left + '/' + ppSummary(m).max + '</div></div>' +
      btn + '</div>';
  }
  if (!isSwitch && !isItem && !isBoxSwap) {
    html += '<button class="btn" onclick="showBoxModal()">📦 电脑箱（' + STATE.box.length + '只）</button>';
  }
  if (isItem && item && item.type === 'candy') {
    html = '<div class="shop-hint">糖果支持批量喂食，最多喂到该项 15 点、总和 50 点。</div>' + html;
  }
  openModal(isSwitch ? '更换精灵' : (isItem ? '选择宝可梦' : (isBoxSwap ? '选择要存入箱子的宝可梦' : '精灵队伍')), html);
  for (let i = 0; i < STATE.party.length; i++) {
    $id('modal-icon-' + i).appendChild(monIcon(STATE.party[i].species, 36, STATE.party[i].shiny));
  }
}

let _boxRestoreScroll = null; // 电脑箱列表滚动位置（详情返回时恢复）

function showBoxModal() {
  let html = '<div class="shop-hint">💡 传送费用 = 等级²（最低 1000 金）· 锁定的宝可梦不可传送</div>';
  if (STATE.box.length === 0) {
    html = '<div class="shop-hint">电脑箱空空如也</div>';
  }
  for (let i = 0; i < STATE.box.length; i++) {
    const m = STATE.box[i];
    html += '<div class="party-row pixel-frame">' +
      '<div class="box-icon-wrap"><div class="party-icon" id="box-icon-' + i + '"></div>' +
      '<button class="box-lock-corner' + (m.locked ? ' on' : '') + '" onclick="toggleBoxLock(' + i + ')" title="' + (m.locked ? '解锁' : '上锁') + '">' + (m.locked ? '🔒' : '🔓') + '</button></div>' +
      '<div class="party-info"><div class="party-name">' + rarityTag(m) + m.name + (m.shiny ? ' ✨' : '') + ' ' + statusIcon(m.status) + '</div>' +
      '<div class="party-lv">Lv.' + m.level + ' · ' + m.speciesData.types.join('/') +
      (m.nature ? ' · 性格' + m.nature : '') + (m.held ? ' · [' + m.held + ']' : '') + '</div>' + hpBar(m) +
      '<div class="party-pp">PP ' + ppSummary(m).left + '/' + ppSummary(m).max + '</div></div>' +
      '<div class="box-actions">' +
      '<button class="btn btn-xs" onclick="showBoxMonDetail(' + i + ')">详情</button>' +
      '<button class="btn btn-xs" onclick="doBoxSwap(' + i + ')">取回</button>' +
      '<button class="btn btn-xs btn-danger" onclick="doTransfer(' + i + ')"' + (m.locked ? ' disabled' : '') + '>传送</button></div></div>';
  }
  openModal('电脑箱（' + STATE.box.length + '只）', html);
  for (let i = 0; i < STATE.box.length; i++) {
    $id('box-icon-' + i).appendChild(monIcon(STATE.box[i].species, 36, STATE.box[i].shiny));
  }
  // 从详情返回：恢复列表滚动位置（避免回到最顶部）
  const sc = document.querySelector('#modal-root .modal');
  if (sc && _boxRestoreScroll !== null) {
    if (_boxRestoreScroll > 0) sc.scrollTop = _boxRestoreScroll;
    _boxRestoreScroll = null;
  }
}

// 电脑箱锁定切换：上锁后不可取出/传送（默认不上锁）
function toggleBoxLock(boxIdx) {
  const mon = STATE.box[boxIdx];
  if (!mon) return;
  mon.locked = !mon.locked;
  save();
  showBoxModal();
}

// 传送（删除操作，需确认）：转化为万能经验 + 属性糖果
function doTransfer(idx) {
  const mon = STATE.box[idx];
  if (!mon) return;
  if (confirm('确定要把 ' + mon.name + ' 传送给大木博士吗？\n需花费 ' + boxTransferFee(mon) + ' 金币，传送后它将从电脑箱消失，转化为万能经验与属性糖果。')) {
    transferMon(idx);
    save();
    // 先刷新底层地图（电脑箱数量按钮等），再重开箱子弹窗
    renderMap();
    showBoxModal();
  }
}

function doBoxSwap(idx) {
  _boxSwapIdx = idx;
  showPartyModal('boxswap');
}

function doBoxSwapConfirm(partyIdx) {
  if (_boxSwapIdx < 0) { closeModal(); render(); return; }
  boxSwap(_boxSwapIdx, partyIdx);
  _boxSwapIdx = -1;
  save();
  closeModal();
  render();
}

function doSwitch(idx) {
  if (_uiPlaying) return;
  const from = STATE.log.length;
  const battleRef = STATE.battle;
  battleSwitch(idx);
  save();
  closeModal();
  playBattleResult(from, battleRef);
}

function doSetLead(idx) {
  setLeadMon(idx);
  save();
  closeModal();
  render();
}

function doItemOnMon(name, idx, qty) {
  useBagItemOnMon(name, idx, qty || 1);
  save();
  closeModal();
  render();
}

function showMonDetail(idx) {
  const mon = STATE.party[idx];
  if (!mon) return;
  openMonDetailModal(mon, true);
}

// 电脑箱宝可梦详情（只读：队伍专属的换招/分配经验不显示）
function showBoxMonDetail(boxIdx) {
  const mon = STATE.box[boxIdx];
  if (!mon) return;
  // 记录电脑箱列表滚动位置，返回时恢复（避免回到最顶部）
  const sc = document.querySelector('#modal-root .modal');
  if (sc) _boxRestoreScroll = sc.scrollTop;
  openMonDetailModal(mon, false);
}

function openMonDetailModal(mon, inParty) {
  const d = mon.speciesData;
  const statNames = { hp: 'HP', atk: '攻击', def: '防御', spa: '特攻', spd: '特防', spe: '速度' };
  let statsHtml = '';
  for (const k in statNames) {
    const iv = mon.ivs ? mon.ivs[k] : '?';
    const cb = mon.candyBonus || {};
    const bonus = cb[k] || 0;
    const maxTag = (bonus >= 15 || (cb.total || 0) >= 50) ? ' <span class="candy-max">[MAX]</span>' : '';
    statsHtml += '<div class="detail-row"><span>' + statNames[k] + '</span><span>' + mon.stats[k] +
      '（个体 ' + iv + '）' + (bonus > 0 ? ' <span class="candy-bonus">(+' + bonus + ')</span>' : '') + maxTag + '</span></div>';
  }
  let movesHtml = '';
  for (let i = 0; i < mon.moves.length; i++) {
    const mv = MOVES[mon.moves[i]];
    if (!mv) continue;
    const left = (mon.pp && mon.pp[i] !== undefined) ? mon.pp[i] : mv.pp;
    movesHtml += '<div class="detail-row"><span><span class="tag-known">已学会</span>' +
      '<span class="mv-name" style="color:' + typeColor(mv.type) + '">' + mv.name + '</span> · ' + mv.type + '</span><span>' +
      mv.category + (mv.power > 0 ? ' · 威力 ' + mv.power : '') + ' · ' + (mv.acc === 0 ? '必中' : '命中 ' + mv.acc) + ' · PP ' + left + '/' + mv.pp +
      (moveEffectText(mv) ? '<br><small class="move-effect">' + moveEffectText(mv) + '</small>' : '') + '</span></div>';
  }
  let evoHtml = '不会进化';
  if (d.evo) {
    if (d.evo.level) evoHtml = 'Lv.' + d.evo.level + ' 进化为 ' + POKEDEX[d.evo.into].name;
    else if (d.evo.stone) evoHtml = '使用' + d.evo.stone + '进化为 ' + POKEDEX[d.evo.into].name;
  }
  const expPoolBtn = inParty && STATE.expPool > 0 ?
    '<button class="btn btn-sm" onclick="showAllocateExp(' + STATE.party.indexOf(mon) + ')">📊 分配经验（经验池 ' + STATE.expPool + '）</button>' : '';
  const learnable = inParty ? learnableMoves(mon) : [];
  const moveReplaceBtn = inParty && learnable.length > 0 ?
    '<button class="btn btn-sm" onclick="showMoveReplaceModal(' + STATE.party.indexOf(mon) + ')">🔄 更换招式（' + moveReplaceCost(mon) + '金/次）</button>' : '';
  const backBtn = inParty ? '' :
    '<div class="modal-btns"><button class="btn" onclick="showBoxModal()">← 返回电脑箱</button></div>';
  const html = '<div class="detail-head"><div class="detail-icon" id="detail-icon"></div>' +
    '<div><div class="detail-name">' + rarityTag(mon) + mon.name + (mon.shiny ? ' ✨' : '') + ' <span class="detail-no">No.' + mon.species + '</span></div>' +
    '<div class="detail-lv">Lv.' + mon.level + ' · ' + d.types.join('/') + '</div>' +
    '<div class="detail-lv">性格：' + natureText(mon.nature) + '</div></div></div>' +
    '<div class="shop-hint">羁绊：' + bondTier(mon.bond || 0) + '</div>' +
    '<div class="shop-hint">携带：' + (mon.held || '无') +
      (mon.held && ITEMS[mon.held] && ITEMS[mon.held].onlySpecies ? '（专属）' : '') +
      (mon.tradeBonus ? ' · 交换（1.5倍经验）' : '') + '</div>' +
    '<div class="shop-hint">升级还需 ' + expToNext(mon) + ' 经验 · ' + evoHtml + '</div>' +
    expPoolBtn +
    moveReplaceBtn +
    '<div class="shop-hint">—— 能力值（括号内为个体值） ——</div>' + statsHtml +
    '<div class="shop-hint">—— 招式 ——</div>' + movesHtml + backBtn;
  openModal(mon.name, html);
  const iconBox = $id('detail-icon');
  if (iconBox) iconBox.appendChild(monIcon(mon.species, 48, mon.shiny));
}

// 更换招式弹窗：选栏位 → 从可学清单选新招（满级也能换）
let _moveReplaceSlot = 0;
function showMoveReplaceModal(idx) {
  const mon = STATE.party[idx];
  if (!mon) return;
  const learnable = learnableMoves(mon);
  const cost = moveReplaceCost(mon);
  let slotHtml = '';
  for (let i = 0; i < mon.moves.length; i++) {
    const mv = MOVES[mon.moves[i]];
    slotHtml += '<button class="btn btn-sm slot-btn' + (_moveReplaceSlot === i ? ' active' : '') + '" onclick="pickMoveSlot(' + idx + ',' + i + ')">' +
      '<span class="tag-known">已学会</span><span class="slot-no">' + (i + 1) + '. </span>' +
      '<span class="mv-name" style="--mv-tc:' + (mv ? typeColor(mv.type) : 'inherit') + '">' +
      (mv ? mv.name : '?') + '</span></button>';
  }
  let learnHtml = '';
  for (let i = 0; i < learnable.length; i++) {
    const mv = MOVES[learnable[i]];
    if (!mv) continue;
    const forgotten = (mon.forgottenMoves || []).indexOf(learnable[i]) !== -1;
    learnHtml += '<button class="btn btn-sm move-btn" style="--tc:' + typeColor(mv.type) + '" onclick="doReplaceMove(' + idx + ',' + _moveReplaceSlot + ',\'' + learnable[i] + '\')">' +
      '<span class="tag-learn">要学习</span>' + mv.name + '<span class="move-type">' + (mv.category === '物理' ? '物攻' : (mv.category === '特殊' ? '特攻' : '变化')) + ' · ' + mv.type + '</span>' +
      '<span class="move-eff">' + mv.category + (mv.power > 0 ? ' · 威力 ' + mv.power : '') + '</span>' +
      (forgotten ? '<span class="move-effect">曾不学（升级不再自动提示，可手动学回）</span>' : (moveEffectText(mv) ? '<span class="move-effect">' + moveEffectText(mv) + '</span>' : '')) + '</button>';
  }
  openModal('更换招式 · ' + mon.name,
    '<div class="shop-hint">选择下方「要学习」的技能，将替换第 ' + (_moveReplaceSlot + 1) + ' 招（已学会的 ' +
    (MOVES[mon.moves[_moveReplaceSlot]] ? MOVES[mon.moves[_moveReplaceSlot]].name : '?') + '），花费 ' + cost + ' 金（当前余额 ' + STATE.money + ' 金）</div>' +
    '<div class="bag-tabs">' + slotHtml + '</div>' +
    '<div class="shop-hint">—— 可学招式（要学习，Lv.' + mon.level + ' 及以下，含曾不学的） ——</div>' +
    (learnHtml || '<div class="shop-hint">没有可学习的招式</div>') +
    '<div class="modal-btns"><button class="btn" onclick="closeModal()">取消</button></div>');
}

function pickMoveSlot(idx, slot) {
  _moveReplaceSlot = slot;
  showMoveReplaceModal(idx);
}

function doReplaceMove(idx, slot, moveId) {
  const mon = STATE.party[idx];
  const mv = MOVES[moveId];
  if (!mon || !mv) return;
  if (!confirm('确定要把第 ' + (slot + 1) + ' 招替换成【' + mv.name + '】吗？花费 ' + moveReplaceCost(mon) + ' 金。')) return;
  const res = replaceMove(idx, slot, moveId);
  if (!res.ok) { alert(res.msg); return; }
  save();
  showMonDetail(idx);
}

// 羁绊评级（隐藏数值，只展示阶段）
function bondTier(bond) {
  if (bond >= 90) return '🌟 生死与共的搭档';
  if (bond >= 60) return '💖 亲密的伙伴';
  if (bond >= 30) return '💛 熟悉的伙伴';
  return '🤍 初见';
}

// 万能经验池分配弹窗
function showAllocateExp(idx) {
  const mon = STATE.party[idx];
  if (!mon) return;
  openModal('分配万能经验',
    '<div class="shop-hint">当前经验池：' + STATE.expPool + ' 点</div>' +
    '<div class="shop-hint">' + mon.name + ' 距离下一级还需 ' + expToNext(mon) + ' 经验</div>' +
    '<div class="modal-btns">' +
    '<button class="btn btn-primary" onclick="doAllocateExp(' + idx + ',\'next\')">注入升 1 级所需</button>' +
    '<button class="btn btn-primary" onclick="doAllocateExp(' + idx + ',\'all\')">全部分配</button>' +
    '<button class="btn" onclick="closeModal()">取消</button></div>');
}

function doAllocateExp(idx, mode) {
  allocateExp(idx, mode);
  save();
  showMonDetail(idx);
}

// ---------------- 图鉴合集：宝可梦 / 道具 / 招式 统一入口（Tab 切换） ----------------

let _dexHubTab = 'pokedex';
let _dexPrevTab = 'pokedex';
let _dexScrolls = {};

function showDexHub(tabId) {
  if (tabId) _dexHubTab = tabId;
  const sc = document.querySelector('#modal-root .modal');
  const curTop = sc ? sc.scrollTop : 0;
  // 切换 Tab 前记住旧 Tab 的滚动位置（详情弹窗返回时不覆盖，_dexRestoreScroll 优先）
  if (sc && _dexPrevTab !== _dexHubTab && _dexRestoreScroll === null) {
    _dexScrolls[_dexPrevTab] = curTop;
  }
  const tabs = [
    { id: 'pokedex', label: '📖 宝可梦' },
    { id: 'itemdex', label: '📘 道具' },
    { id: 'movedex', label: '📗 招式' },
    { id: 'titles', label: '🏅 称号' }
  ];
  let html = '<div class="bag-tabs dex-hub-tabs">' + tabs.map(function (t) {
    return '<button class="btn btn-sm' + (_dexHubTab === t.id ? ' active' : '') + '" onclick="showDexHub(\'' + t.id + '\')">' + t.label + '</button>';
  }).join('') + '</div>';
  html += '<div id="dex-hub-body"></div>';
  openModal('图鉴合集', html);
  try {
    renderDexHubBody();
  } catch (e) {
    console.error('图鉴渲染异常', e);
  }
  const nsc = document.querySelector('#modal-root .modal');
  if (nsc) {
    // 详情返回：优先用记录的网格滚动位置；否则用该 Tab 上次记住的位置；都没有则保持当前滚动
    const restore = _dexRestoreScroll !== null ? _dexRestoreScroll : (_dexScrolls[_dexHubTab] !== undefined ? _dexScrolls[_dexHubTab] : curTop);
    if (restore > 0) nsc.scrollTop = restore;
    _dexScrolls[_dexHubTab] = restore;
    _dexRestoreScroll = null;
    _dexPrevTab = _dexHubTab;
  }
}

// 兼容旧入口：doMapAction / 测试仍可单独打开对应页
function showPokedexModal() { showDexHub('pokedex'); }
function showItemDexModal() { showDexHub('itemdex'); }
function showMoveDexModal(cat) { if (cat) _moveDexCat = cat; showDexHub('movedex'); }

function allDexIds() {
  return Object.keys(POKEDEX).map(Number).filter(function (id) { return id >= 1 && id <= 151; }).sort(function (a, b) { return a - b; });
}

function renderDexHubBody() {
  const body = $id('dex-hub-body');
  if (!body) return;
  if (_dexHubTab === 'pokedex') {
    body.innerHTML = pokedexBodyHtml();
    drawDexIcons();
  } else if (_dexHubTab === 'itemdex') {
    body.innerHTML = itemdexBodyHtml();
  } else if (_dexHubTab === 'titles') {
    body.innerHTML = titleDexBodyHtml(true); // 图鉴：纯展示，称号操作在背包
  } else {
    body.innerHTML = movedexBodyHtml();
    $id('move-dex-list').innerHTML = moveDexListHtml();
    const input = $id('move-dex-search');
    if (input) {
      input.addEventListener('compositionend', function () { onMoveDexSearch(this.value); });
    }
  }
}

// 称号图鉴：全部称号 + 解锁条件 + 装备/卸下
let _titleSel = { id: null, rarity: '普通' };
let _titleMsg = '';

function rarityClass(r) { return 'title-r' + Math.max(0, rarityIndex(r)); }

// readOnly = true：图鉴纯展示（无操作）；false：背包管理（选中/装备/合成/分解/兑换）
function titleDexBodyHtml(readOnly) {
  const counts = titleCounts();
  const shards = bagCount('称号碎片');
  const eq = STATE.equippedTitle ? parseTitleEntry(STATE.equippedTitle) : null;
  const eqBonus = eq ? equippedTitleBonus() : {};
  const eqList = ['atk', 'def', 'spa', 'spd', 'spe'].filter(function (k) { return eqBonus[k] > 0; })
    .map(function (k) { return STAT_NAME[k] + '+' + eqBonus[k]; }).join(' ') || '无';
  let html = '<div class="dex-hint">' + (readOnly ? '称号收藏 · ' : '称号管理 · ') + '稀有度决定属性加成（史诗五项全 +1）· 碎片 ' + shards + ' 个</div>';
  if (!readOnly && _titleMsg) html += '<div class="shop-hint title-msg">' + _titleMsg + '</div>';
  if (eq) {
    html += '<div class="shop-hint">已装备：<span class="' + rarityClass(eq.rarity) + '">【' + titleLabel(eq.id, eq.rarity) + '】</span> 加成：' +
      eqList + '</div>';
  }
  for (let i = 0; i < TITLES.length; i++) {
    const t = TITLES[i];
    const c = counts[t.id] || { 普通: 0, 少见: 0, 稀有: 0, 传说: 0, 史诗: 0 };
    html += '<div class="title-dex-name">' + t.name + '<small>' + t.desc + '</small></div><div class="title-dex-rows">';
    for (let r = 0; r < RARITIES.length; r++) {
      const rarity = RARITIES[r];
      const sel = _titleSel.id === t.id && _titleSel.rarity === rarity;
      const n = c[rarity] || 0;
      const canSynth = r < RARITIES.length - 1; // 非史诗可合成
      const ready = canSynth && n >= 3;
      html += '<div class="title-cell' + (sel ? ' sel' : '') + (ready ? ' ready' : '') + '"' + (readOnly ? '' : ' onclick="doTitleSelect(\'' + t.id + '\',\'' + rarity + '\')"') + '>' +
        '<span class="' + rarityClass(rarity) + '">' + rarity + '</span><b>' + (canSynth ? n + '/3' : n) + '</b></div>';
    }
    html += '</div>';
  }
  if (!readOnly && _titleSel.id) {
    const sel = _titleSel;
    const n = titleCount(sel.id, sel.rarity);
    const idx = rarityIndex(sel.rarity);
    const missing = idx < RARITIES.length - 1 ? Math.max(0, 3 - n) : 0;
    const equipped = STATE.equippedTitle === sel.id + '@' + sel.rarity;
    html += '<div class="shop-hint">—— ' + titleLabel(sel.id, sel.rarity) + '（持有 ' + n +
      (idx < RARITIES.length - 1 ? ' · 合成还需 ' + missing + ' 个' : ' · 最高档') + '）——</div>' +
      '<div class="modal-btns title-actions">' +
      (equipped ? '<button class="btn btn-sm" onclick="doTitleEquip(\'\')">卸下称号</button>' :
        '<button class="btn btn-sm btn-primary" onclick="doTitleEquip(\'' + sel.id + '\',\'' + sel.rarity + '\')">装备</button>') +
      (n >= 3 && idx < RARITIES.length - 1 ? '<button class="btn btn-sm" onclick="doTitleSynth()">合成（3合1 → ' + RARITIES[idx + 1] + '）</button>' : '') +
      (n >= 1 && !equipped ? '<button class="btn btn-sm btn-danger" onclick="doTitleDismantle()">分解（+' + (idx + 1) + '碎片）</button>' : '') +
      '</div>';
  }
  if (!readOnly) {
    html += '<div class="shop-hint">—— 碎片兑换（5 碎片 → 任意称号·普通）——</div>' +
      '<div class="bag-tabs">' + TITLES.map(function (t) {
        const owned = (counts[t.id] || {}).普通 > 0 || (counts[t.id] || {}).少见 > 0 || (counts[t.id] || {}).稀有 > 0 || (counts[t.id] || {}).传说 > 0 || (counts[t.id] || {}).史诗 > 0;
        return '<button class="btn btn-sm' + (owned ? '" onclick="doTitleExchange(\'' + t.id + '\')"' : '" disabled') + '>' + t.name + (owned ? '' : '（需先获得）') + '</button>';
      }).join('') + '</div>';
  }
  return html;
}

function doTitleSelect(id, rarity) {
  _titleSel = { id: id, rarity: rarity };
  refreshTitleArea();
}

function doTitleEquip(id, rarity) {
  if (equipTitle(id || null, rarity)) {
    _titleMsg = id ? '✔ 装备了【' + titleLabel(id, rarity) + '】' : '✔ 已卸下称号';
    _titleSel = { id: null, rarity: '普通' };
  }
  refreshTitleArea();
}

function doTitleSynth() {
  const r = synthesizeTitle(_titleSel.id, _titleSel.rarity);
  if (r.ok) _titleMsg = '✔ 合成了【' + titleLabel(_titleSel.id, RARITIES[rarityIndex(_titleSel.rarity) + 1]) + '】';
  else alert(r.msg);
  refreshTitleArea();
}

function doTitleDismantle() {
  const r = dismantleTitle(_titleSel.id, _titleSel.rarity);
  if (r.ok) _titleMsg = '✔ 分解了【' + titleLabel(_titleSel.id, _titleSel.rarity) + '】，+' + (rarityIndex(_titleSel.rarity) + 1) + ' 碎片';
  else alert(r.msg);
  refreshTitleArea();
}

function doTitleExchange(id) {
  const r = exchangeTitle(id);
  if (r.ok) _titleMsg = '✔ 兑换了【' + titleLabel(id, '普通') + '】';
  else alert(r.msg);
  refreshTitleArea();
}

// 刷新当前称号界面（图鉴 Tab 或背包称号 Tab）
function refreshTitleArea() {
  if ($id('dex-hub-body')) renderDexHubBody();
  else if ($id('bag-titles-body')) showBagModal(false, 'titles');
}

// 宝可梦图鉴二级分类：全部 + 17 属性；未解锁只出现在“全部”
let _dexTypeTab = 'all';
let _dexRestoreScroll = null;
let _dexTypeScrolls = {};

function setDexTypeTab(t) {
  const sc = document.querySelector('#modal-root .modal');
  if (sc && _dexTypeTab !== t) _dexTypeScrolls[_dexTypeTab] = sc.scrollTop;
  _dexTypeTab = t;
  renderDexHubBody();
  const nsc = document.querySelector('#modal-root .modal');
  if (nsc) {
    const restore = _dexTypeScrolls[t] !== undefined ? _dexTypeScrolls[t] : (sc ? sc.scrollTop : 0);
    if (restore > 0) nsc.scrollTop = restore;
    _dexTypeScrolls[t] = restore;
    // 与合集 Tab 的滚动记忆保持同步，避免切走再切回宝可梦 Tab 时位置丢失
    _dexScrolls['pokedex'] = restore;
  }
}

function pokedexBodyHtml() {
  const seenCount = Object.keys(STATE.seenDex).length;
  const typeTabs = ['all'].concat(TYPES);
  let html = '<div class="bag-tabs dex-type-tabs">' + typeTabs.map(function (t) {
    if (t === 'all') {
      return '<button class="btn btn-sm' + (_dexTypeTab === 'all' ? ' active' : '') + '" onclick="setDexTypeTab(\'all\')">全部(' + seenCount + ')</button>';
    }
    const seenOfType = allDexIds().filter(function (id) { return STATE.seenDex[id] && POKEDEX[id].types.indexOf(t) !== -1; }).length;
    return '<button class="btn btn-sm' + (_dexTypeTab === t ? ' active' : '') + '" onclick="setDexTypeTab(\'' + t + '\')">' + t + '(' + seenOfType + ')</button>';
  }).join('') + '</div>';
  // 属性分类只显示已解锁；未解锁宝可梦保留在“全部”
  const ids = allDexIds().filter(function (id) {
    if (_dexTypeTab === 'all') return true;
    if (!STATE.seenDex[id]) return false;
    return POKEDEX[id].types.indexOf(_dexTypeTab) !== -1;
  });
  html += '<div class="dex-hint">已见 ' + seenCount + ' · 已捕获 ' + Object.keys(STATE.caughtDex).length + ' / 151' +
    (_dexTypeTab !== 'all' ? ' · ' + _dexTypeTab + '系 ' + ids.length + ' 只' : '') + '</div>' +
    '<div class="dex-grid">';
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const seen = !!STATE.seenDex[id];
    const caught = !!STATE.caughtDex[id];
    const d = POKEDEX[id];
    html += '<div class="dex-cell' + (caught ? ' caught' : (seen ? ' seen' : '')) + '" id="dex-icon-' + id + '" onclick="showDexDetail(' + id + ')">' +
      '<div class="dex-icon">' + (seen ? '' : '?') + '</div>' +
      (seen ? dexRarityLine(d) : '') +
      '<div class="dex-name">' + (seen ? d.name : '???') + '</div>' +
      '<div class="dex-no">No.' + id + '</div></div>';
  }
  return html + '</div>';
}

function drawDexIcons() {
  const ids = allDexIds();
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (STATE.seenDex[id]) {
      const shiny = STATE.party.some(function (m) { return m.species === id && m.shiny; }) ||
                    STATE.box.some(function (m) { return m.species === id && m.shiny; });
      const box = document.querySelector('#dex-icon-' + id + ' .dex-icon');
      if (box) box.appendChild(monIcon(id, 28, shiny));
    }
  }
}

// 图鉴详情：未发现保持神秘；已见/已捕获展示种族值、学习面与获取途径
function showDexDetail(id) {
  const d = POKEDEX[id];
  if (!d) return;
  // 记录图鉴网格滚动位置，返回时恢复
  const dm = document.querySelector('#modal-root .modal');
  if (dm) _dexRestoreScroll = dm.scrollTop;
  if (!STATE.seenDex[id]) {
    openModal('No.' + id,
      '<div class="detail-head"><div class="detail-icon dex-unknown">？</div>' +
      '<div><div class="detail-name">？？？ <span class="detail-no">No.' + id + '</span></div>' +
      '<div class="detail-lv">尚未遇见……继续探索关都吧！</div></div></div>' +
      '<div class="modal-btns"><button class="btn" onclick="showDexHub(\'pokedex\')">← 返回图鉴</button></div>');
    return;
  }
  const b = d.base;
  const caught = !!STATE.caughtDex[id];
  const statNames = { hp: 'HP', atk: '攻击', def: '防御', spa: '特攻', spd: '特防', spe: '速度' };
  let statsHtml = '';
  for (const k in statNames) {
    statsHtml += '<div class="detail-row"><span>' + statNames[k] + '</span><span>' + b[k] + '</span></div>';
  }
  statsHtml += '<div class="detail-row"><span>种族值总和</span><span>' + (b.hp + b.atk + b.def + b.spa + b.spd + b.spe) + '</span></div>';
  let evoHtml = '不会进化';
  if (d.evo) {
    if (d.evo.level) evoHtml = 'Lv.' + d.evo.level + ' 进化为 ' + POKEDEX[d.evo.into].name;
    else if (d.evo.stone) evoHtml = '使用' + d.evo.stone + '进化为 ' + POKEDEX[d.evo.into].name;
  }
  let movesHtml = '';
  const ls = d.learnset || {};
  Object.keys(ls).map(Number).sort(function (a, b) { return a - b; }).forEach(function (lv) {
    (ls[lv] || []).forEach(function (mid) {
      const mv = MOVES[mid];
      if (!mv) return;
      movesHtml += '<div class="detail-row"><span>Lv.' + lv + ' ' + mv.name + ' · ' + mv.type + '</span><span>' +
        (mv.power > 0 ? '威力 ' + mv.power : '变化') + ' · PP ' + mv.pp +
        (moveEffectText(mv) ? '<br><small class="move-effect">' + moveEffectText(mv) + '</small>' : '') + '</span></div>';
    });
  });
  if (!movesHtml) movesHtml = '<div class="shop-hint">暂无学习面数据</div>';
  const paths = acquisitionPaths(id);
  const pathsHtml = '<div class="shop-hint">' +
    (paths.length ? paths.map(function (p) { return '· ' + p; }).join('<br>') : '暂无获取途径（数据缺失）') + '</div>';
  const html = '<div class="detail-head"><div class="detail-icon" id="dex-detail-icon"></div>' +
    '<div><div class="detail-name">' + rarityTag(d) + d.name + (caught ? ' ✓已捕获' : ' ✓已见') + ' <span class="detail-no">No.' + id + '</span></div>' +
    '<div class="detail-lv">' + d.types.join('/') + ' · 捕获率 ' + d.catchRate + ' · ' + rarityOf(d).label + '</div></div></div>' +
    '<div class="shop-hint">—— 种族值 ——</div>' + statsHtml +
    '<div class="shop-hint">进化：' + evoHtml + '</div>' +
    '<div class="shop-hint">—— 可学招式 ——</div>' + movesHtml +
    '<div class="shop-hint">—— 获取途径 ——</div>' + pathsHtml +
    '<div class="modal-btns"><button class="btn" onclick="showDexHub(\'pokedex\')">← 返回图鉴</button></div>';
  openModal(d.name, html);
  const box = $id('dex-detail-icon');
  if (box) box.appendChild(monIcon(id, 48));
}

// 道具图鉴内容：按分类列出全部道具与用途说明（商店/背包/出售列表共用同一套增强描述）
function itemdexBodyHtml() {
  let html = '<div class="dex-hint">全部道具说明 · 共 ' + Object.keys(ITEMS).length + ' 种</div>';
  for (let ti = 0; ti < BAG_TABS.length; ti++) {
    const tab = BAG_TABS[ti];
    const names = Object.keys(ITEMS).filter(function (k) { return tab.match(ITEMS[k]); });
    if (names.length === 0) continue;
    html += '<div class="itemdex-cat">' + tab.label + '</div>';
    for (let i = 0; i < names.length; i++) {
      const item = ITEMS[names[i]];
      const owned = bagCount(names[i]);
      html += '<div class="shop-row"><span>' + names[i] +
        (item.price ? '（' + item.price + '金）' : '') +
        (item.sell ? ' · 可卖' + item.sell + '金' : '') +
        (owned > 0 ? ' · 持有×' + owned : '') + '</span></div>' +
        '<div class="shop-desc">' + itemDesc(item) + '</div>';
    }
  }
  return html;
}

// ---------------- 招式图鉴：全部招式按属性分组，可搜索 / 按类别筛选 ----------------

let _moveDexCat = 'all';
let _moveDexQuery = '';

function movedexBodyHtml() {
  const cats = [
    { id: 'all', label: '全部' },
    { id: '物理', label: '物理' },
    { id: '特殊', label: '特殊' },
    { id: '变化', label: '变化' }
  ];
  let html = '<div class="dex-hint">全部招式 · 共 ' + Object.keys(MOVES).length + ' 种 · 可搜索招名/属性</div>';
  // 搜索框固定不重建，避免输入法（中文拼音）组合过程被打断
  html += '<input class="move-dex-search" id="move-dex-search" placeholder="搜索，如：火 / 喷 / 光…" value="' + _moveDexQuery + '" oninput="onMoveDexSearch(this.value, event)">';
  html += '<div class="bag-tabs">' + cats.map(function (c) {
    return '<button class="btn btn-sm' + (_moveDexCat === c.id ? ' active' : '') + '" onclick="onMoveDexCat(\'' + c.id + '\')">' + c.label + '</button>';
  }).join('') + '</div>';
  html += '<div id="move-dex-list"></div>';
  return html;
}

// 招式图鉴类别 Tab：只重建招式内容区，不重建整个合集弹窗
function onMoveDexCat(cat) {
  _moveDexCat = cat;
  const body = $id('dex-hub-body');
  if (!body) return;
  const sc = document.querySelector('#modal-root .modal');
  const top = sc ? sc.scrollTop : 0;
  body.innerHTML = movedexBodyHtml();
  $id('move-dex-list').innerHTML = moveDexListHtml();
  const input = $id('move-dex-search');
  if (input) input.addEventListener('compositionend', function () { onMoveDexSearch(this.value); });
  const nsc = document.querySelector('#modal-root .modal');
  if (nsc && top > 0) nsc.scrollTop = top;
}

// 搜索输入：只刷新结果列表，输入框保持原样（中文输入法不中断）
function onMoveDexSearch(v, ev) {
  // 输入法组合中（拼音未上屏）不刷新，等 compositionend 后再过滤，避免列表闪烁
  if (ev && ev.isComposing) return;
  _moveDexQuery = v;
  const list = $id('move-dex-list');
  if (!list) return;
  const sc = document.querySelector('#modal-root .modal');
  const top = sc ? sc.scrollTop : 0;
  list.innerHTML = moveDexListHtml();
  const nsc = document.querySelector('#modal-root .modal');
  if (nsc && top > 0) nsc.scrollTop = top;
}

function moveDexListHtml() {
  const q = (_moveDexQuery || '').trim();
  const all = Object.keys(MOVES).map(function (id) { return MOVES[id]; }).filter(function (mv) {
    if (_moveDexCat !== 'all' && mv.category !== _moveDexCat) return false;
    if (q) {
      const hay = mv.name + mv.type + mv.id;
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  });
  let html = '';
  const groups = {};
  all.forEach(function (mv) { (groups[mv.type] = groups[mv.type] || []).push(mv); });
  TYPES.forEach(function (t) {
    const list = groups[t];
    if (!list || list.length === 0) return;
    list.sort(function (a, b) { return (b.power || 0) - (a.power || 0); });
    html += '<div class="itemdex-cat">' + t + ' 系（' + list.length + '）</div>';
    list.forEach(function (mv) {
      html += '<div class="shop-row"><span style="color:' + typeColor(mv.type) + '">' + mv.name + '</span><span>' +
        mv.category + (mv.power > 0 ? ' · 威力 ' + mv.power : '') + ' · ' +
        (mv.acc === 0 ? '必中' : '命中 ' + mv.acc) + ' · PP ' + mv.pp + '</span></div>' +
        '<div class="shop-desc">' + (moveEffectText(mv) || (mv.power > 0 ? '无附加效果' : '变化招式')) + '</div>';
    });
  });
  if (all.length === 0) html += '<div class="shop-hint">没有匹配的招式</div>';
  return html;
}

// ---------------- 关都地图 ----------------

// 像素节点图坐标（百分比，按关都大致地理排布：北在上）
const KANTO_LAYOUT = {
  pallet:    { x: 16, y: 95 },
  route1:    { x: 24, y: 88 },
  viridian:  { x: 34, y: 80 },
  route21:   { x: 14, y: 82 },
  cinnabar:  { x: 5,  y: 97 },
  seafoam:   { x: 26, y: 94 },
  route19:   { x: 36, y: 88 },
  fuchsia:   { x: 44, y: 80 },
  route16:   { x: 52, y: 72 },
  celadon:   { x: 60, y: 64 },
  route7:    { x: 68, y: 56 },
  saffron:   { x: 76, y: 48 },
  route6:    { x: 84, y: 54 },
  vermilion: { x: 92, y: 60 },
  route5:    { x: 66, y: 44 },
  cerulean:  { x: 74, y: 36 },
  route24:   { x: 82, y: 28 },
  route25:   { x: 92, y: 24 },
  mtmoon:    { x: 64, y: 30 },
  route3:    { x: 56, y: 38 },
  pewter:    { x: 48, y: 46 },
  forest:    { x: 40, y: 54 },
  route2:    { x: 32, y: 62 },
  champion:  { x: 14, y: 64 },
  route22:   { x: 24, y: 70 },
  tower:     { x: 96, y: 14 }
};

const TYPE_NAMES = { town: '城镇', route: '道路', forest: '森林', cave: '洞穴', tower: '无尽之塔' };

function nodeUnlocked(id) {
  const n = MAP_NODES[id];
  return !(n && n.requireBadge && STATE.badges.indexOf(n.requireBadge) === -1);
}

function showMapModal() {
  let lines = '';
  const drawn = {};
  Object.keys(MAP_NODES).forEach(function (id) {
    (MAP_NODES[id].next || []).forEach(function (nid) {
      const key = [id, nid].sort().join('-');
      if (drawn[key]) return;
      drawn[key] = true;
      const a = KANTO_LAYOUT[id], b = KANTO_LAYOUT[nid];
      if (!a || !b) return;
      lines += '<line x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '"/>';
    });
  });
  let html = '<div class="map-wrap"><svg class="map-lines" viewBox="0 0 100 100" preserveAspectRatio="none">' + lines + '</svg>';
  Object.keys(KANTO_LAYOUT).forEach(function (id) {
    const n = MAP_NODES[id];
    if (!n) return;
    const p = KANTO_LAYOUT[id];
    const locked = !nodeUnlocked(id);
    const isCur = id === STATE.nodeId;
    const visited = STATE.visitedNodes.indexOf(id) !== -1;
    const isNext = !locked && (MAP_NODES[STATE.nodeId].next || []).indexOf(id) !== -1;
    const cls = 'map-node' + (isCur ? ' current' : (locked ? ' locked' : (visited ? ' visited' : ''))) + (isNext ? ' next' : '');
    const icon = locked ? '🔒' : (n.gym ? '⚔️' : (n.type === 'town' ? '🏘️' : (n.type === 'cave' ? '🕳️' : (n.type === 'forest' ? '🌲' : '🛣️'))));
    html += '<button class="' + cls + '" style="left:' + p.x + '%;top:' + p.y + '%;" onclick="showNodeInfo(\'' + id + '\')" title="' + n.name + (locked ? '（需' + n.requireBadge + '）' : '') + '">' +
      icon + '<span>' + n.name + '</span></button>';
  });
  html += '</div><div class="map-legend">📍当前位置 · ⚔️道馆 · 🔒未解锁 · 已点亮=已探索</div>';
  openModal('🗺️ 关都地图', html);
}

function topEncounters(n) {
  const pool = [];
  Object.keys(n.pools || {}).forEach(function (w) {
    (n.pools[w] || []).forEach(function (p) { pool.push({ w: p.w, id: p.id }); });
  });
  const byId = {};
  pool.forEach(function (p) { byId[p.id] = (byId[p.id] || 0) + p.w; });
  const sorted = Object.keys(byId).sort(function (a, b) { return byId[b] - byId[a]; }).slice(0, 3);
  return sorted.map(function (id) { return POKEDEX[id].name; }).join('、') || '无';
}

// BFS 最短路径（任意两节点，仅用于路线与赶路）
function pathBetween(fromId, toId) {
  if (fromId === toId) return [fromId];
  const prev = {};
  const seen = {};
  seen[fromId] = true;
  const q = [fromId];
  while (q.length) {
    const cur = q.shift();
    if (cur === toId) {
      const path = [];
      let node = toId;
      while (node !== undefined) { path.unshift(node); node = prev[node]; }
      return path;
    }
    (MAP_NODES[cur].next || []).forEach(function (nid) {
      if (!seen[nid]) { seen[nid] = true; prev[nid] = cur; q.push(nid); }
    });
  }
  return [];
}

function showNodeInfo(id) {
  const n = MAP_NODES[id];
  if (!n) return;
  const isCur = id === STATE.nodeId;
  const locked = !nodeUnlocked(id);
  const visited = STATE.visitedNodes.indexOf(id) !== -1;
  const trainers = n.trainers || [];
  const trainersLeft = trainers.filter(function (t) { return !STATE.trainersDefeated[t.id]; }).length;
  const poolSpecies = {};
  Object.keys(n.pools || {}).forEach(function (w) {
    (n.pools[w] || []).forEach(function (p) { poolSpecies[p.id] = true; });
  });
  trainers.forEach(function (t) {
    t.party.forEach(function (p) { poolSpecies[p.id] = true; });
  });
  const seenHere = Object.keys(poolSpecies).filter(function (s) { return STATE.seenDex[s]; }).length;
  const caughtHere = Object.keys(poolSpecies).filter(function (s) { return STATE.caughtDex[s]; }).length;
  const weather = Object.keys(n.weatherWeights || {}).map(function (k) { return k + ' ' + n.weatherWeights[k] + '%'; }).join(' / ') || '—';
  const levels = n.levels ? n.levels[0] + '~' + n.levels[1] : '—';
  let html = '<div class="shop-hint">类型：' + (TYPE_NAMES[n.type] || n.type) +
    (n.gym ? ' · ⚔️ 道馆：' + n.gym.leader + '（徽章：' + n.gym.badge + '，首发 Lv.' + n.gym.minLevel + '）' : '') + '</div>';
  html += '<div class="shop-hint">等级区间：' + levels + (n.water ? ' · 🎣可钓鱼' : '') + '</div>';
  html += '<div class="shop-hint">天气概率：' + weather + '</div>';
  html += '<div class="shop-hint">主要遭遇：' + topEncounters(n) + '</div>';
  html += '<div class="shop-hint">训练家：' + trainersLeft + '/' + trainers.length + ' 人未击败</div>';
  html += '<div class="shop-hint">该地宝可梦图鉴：已见 ' + seenHere + ' · 已捕获 ' + caughtHere + '</div>';
  html += '<div class="shop-hint">探索状态：' + (visited ? '✅ 已探索' : '⬜ 未探索') + (locked ? ' · 🔒 需 ' + n.requireBadge : '') + '</div>';
  const canGo = !locked && !isCur;
  const path = canGo ? pathBetween(STATE.nodeId, id) : [];
  const pathClear = path.length > 0 && path.every(function (p) { return nodeUnlocked(p); });
  const blocked = path.length > 0 && !pathClear;
  let blockedBadge = null;
  if (blocked) {
    for (let i = 1; i < path.length; i++) {
      if (!nodeUnlocked(path[i])) { blockedBadge = MAP_NODES[path[i]].requireBadge; break; }
    }
  }
  const btns = '<div class="modal-btns">' +
    (pathClear ? '<button class="btn btn-primary" onclick="doMapTravel(\'' + id + '\')">前往 ' + n.name + '（' + getTeleportCost() + '金）</button>' :
      (blocked ? '<button class="btn" disabled>前往 ' + n.name + '（需' + (blockedBadge || '徽章') + '）</button>' : '')) +
    '<button class="btn" onclick="showMapModal()">返回地图</button></div>';
  openModal(n.name, html + btns);
}

function doMapTravel(id) {
  const path = pathBetween(STATE.nodeId, id);
  // 边界：已在目标节点不收费；路径被徽章锁定不收费（先验证再扣费）
  if (path.length <= 1) { closeModal(); render(); return; }
  for (let i = 1; i < path.length; i++) {
    if (!nodeUnlocked(path[i])) {
      addLog('前方需要【' + MAP_NODES[path[i]].requireBadge + '】才能通过！', 'warn');
      closeModal();
      render();
      return;
    }
  }
  const fee = chargeTeleport(); // 地图传送收费：500 起步、每次 +100、封顶 1w，每天 0 点重置
  if (!fee.ok) {
    addLog('传送需要 ' + fee.cost + ' 金币，你的钱不够！', 'warn');
    closeModal();
    render();
    return;
  }
  addLog('传送花费了 ' + fee.cost + ' 金币（下次 ' + STATE.teleportCost + ' 金）', 'info');
  for (let i = 1; i < path.length; i++) {
    gotoNode(path[i]);
    if (STATE.battle) break; // 途中宿敌等触发战斗，先停下来应战
  }
  save();
  closeModal();
  render();
}

function showTowerInfo() {
  const t = STATE.tower;
  const cur = t.cleared ? 100 : t.floor;
  const theme = towerThemeFor(cur);
  const themeText = theme.types.length === 1 ? theme.types[0] : theme.types.join('/');
  const counterText = theme.counters.length ? '建议使用 ' + theme.counters.join(' / ') + ' 系招式克制！' : '这一层没有固定弱点，靠综合实力吧！';
  let superHtml = '';
  if (t.cleared) {
    const sc = t.superCleared ? 100 : t.superFloor;
    superHtml = '<div class="shop-hint">—— 超越之塔（通关无尽之塔解锁） ——</div>' +
      '<div class="shop-hint">当前：第 ' + sc + ' 层（显示 Lv' + (100 + sc) + '）' + (t.superCleared ? '（已通关）' : '') + '</div>' +
      '<div class="shop-hint">存档点：第 ' + t.superCheckpoint + ' 层（每 10 层存档）</div>' +
      '<div class="shop-hint">历史最佳：第 ' + t.superBest + ' 层</div>' +
      '<div class="shop-hint">奖励：每 10 层给【闪光石】×1（可让宝可梦变闪光形态）；100 层通关获称号「超越者」+ 虹色闪光石。</div>';
  }
  openModal('无尽之塔 / 超越之塔',
    '<div class="shop-hint">当前层数：第 ' + cur + ' 层' + (t.cleared ? '（已通关）' : '') + '</div>' +
    '<div class="shop-hint">本层主题：' + themeText + '（' + counterText + '）</div>' +
    '<div class="shop-hint">存档点：第 ' + t.checkpoint + ' 层（每 5 层存档）</div>' +
    '<div class="shop-hint">历史最佳：第 ' + t.bestFloor + ' 层</div>' +
    '<div class="shop-hint">规则：塔内不能回城补给、不能捕捉、不能逃跑；只能靠背包道具续航；全灭回到存档点。</div>' +
    '<div class="shop-hint">奖励：每 5 层给道具，100 层通关获得称号。</div>' +
    superHtml +
    '<div class="shop-hint">已获称号：' + (STATE.titles.length ? STATE.titles.length + ' 个（详见图鉴合集·称号）' : '（暂无）') + '</div>' +
    '<div class="modal-btns"><button class="btn" onclick="closeModal()">知道了</button></div>');
}

// BFS 最短路径：当前位置 → 目标道馆（仅用于路线展示，忽略徽章锁但标注）
function pathToGoal() {
  const order = ['pewter', 'cerulean', 'vermilion', 'celadon', 'saffron', 'fuchsia', 'cinnabar', 'viridian'];
  let goal = null;
  for (let i = 0; i < order.length; i++) {
    const g = MAP_NODES[order[i]].gym;
    if (STATE.badges.indexOf(g.badge) === -1) { goal = order[i]; break; }
  }
  if (!goal) return [];
  return pathBetween(STATE.nodeId, goal);
}

// ---------------- 战斗界面 ----------------

function effHint(mv, foeTypes) {
  if (!mv || mv.power <= 0) return '';
  const eff = typeEffectiveness(mv.type, foeTypes);
  if (eff === 0) return '<span class="move-eff no">没有效果</span>';
  if (eff < 1) return '<span class="move-eff weak">效果不佳</span>';
  if (eff > 1) return '<span class="move-eff super">效果拔群</span>';
  return '';
}

// 招式效果描述：让玩家一眼看懂变化类/带效果招式的用途（如 天气→晴、速度↑2、回复1/2HP）
function moveEffectText(mv) {
  if (!mv || !mv.effect) return '';
  const e = mv.effect;
  const chanceTxt = e.chance && e.chance < 1 ? Math.round(e.chance * 100) + '% ' : '';
  const statName = STAT_NAME[e.stat] || e.stat || '';
  const arrow = function (st) { return st > 0 ? '↑' : '↓'; };
  const num = function (st) { return Math.abs(st) > 1 ? String(Math.abs(st)) : ''; };
  switch (e.kind) {
    case 'weather': return '天气→' + (WEATHER[e.weather] ? WEATHER[e.weather].name : e.weather) + '（5回合）';
    case 'stat': {
      const t = e.target === 'self' ? '自身' : '对方';
      let s = chanceTxt + t + statName + arrow(e.stage) + num(e.stage);
      if (e.second) s += '、' + t + (STAT_NAME[e.second.stat] || e.second.stat) + arrow(e.second.stage) + num(e.second.stage);
      return s;
    }
    case 'status': return chanceTxt + '使对方' + (e.status || '');
    case 'confuse': return chanceTxt + '使对方混乱';
    case 'heal': return '回复' + Math.round(e.ratio * 100) + '%最大HP';
    case 'rest': return '回复满HP，随后睡眠';
    case 'leech': return '寄生：每回合吸取对方HP';
    case 'protect': return '本回合免疫攻击';
    case 'recoil': return '反伤' + Math.round(e.ratio * 100) + '%';
    case 'flinch': return chanceTxt + '使对方畏缩';
    case 'trap': return '束缚对方数回合';
    case 'priority': return '先制攻击';
    case 'recharge': return '使用后下回合无法行动';
    case 'dream': return '仅对方睡眠时吸取HP';
    case 'fixed': return '固定造成' + (e.dmg || '?') + '伤害';
    case 'multi': return e.hits === 2 ? '连续攻击2次' : '连续攻击2~5次';
    case 'leaveOneWild': return '对野生宝可梦手下留情，至少保留1HP';
    default: return '';
  }
}

function renderBattle() {
  const b = STATE.battle;
  if (!b) { STATE.screen = 'map'; render(); return; }
  if (_lastBattle !== b) { _lastBattle = b; _foeHp = null; _playerHp = null; _foeIdx = null; _playerIdx = null; }
  const foe = b.foe.mons[b.foe.active];
  const pm = b.player.mons[b.player.active];
  const foeHit = (_foeIdx === b.foe.active) && (_foeHp !== null) && (foe.m.hp < _foeHp);
  const playerHit = (_playerIdx === b.player.active) && (_playerHp !== null) && (pm.m.hp < _playerHp);
  _foeHp = foe.m.hp; _foeIdx = b.foe.active;
  _playerHp = pm.m.hp; _playerIdx = b.player.active;
  $id('battle-foe').innerHTML = battleCard(foe, 'foe', foeHit);
  $id('battle-player').innerHTML = battleCard(pm, 'player', playerHit);
  const foeIcon = $id('battle-icon-foe');
  if (foeIcon) foeIcon.appendChild(monIcon(foe.m.species, 48, foe.m.shiny));
  const playerIcon = $id('battle-icon-player');
  if (playerIcon) playerIcon.appendChild(monIcon(pm.m.species, 48, pm.m.shiny));
  const bLog = $id('battle-log');
  let start = b.logStart || 0;
  if (start >= STATE.log.length) start = Math.max(0, STATE.log.length - 50);
  bLog.innerHTML = STATE.log.slice(start).map(function (s, i) { return logLineHtml(s, start + i); }).join('');
  bLog.scrollTop = bLog.scrollHeight;

  let html = '';
  html += '<div class="turn-hint">' + (b.waitingPlayer ? '✦ 轮到你了！选择指令' : '……对方行动中……') + '</div>';
  const validMoves = pm.m.moves.filter(function (id) { return MOVES[id]; });
  const foeTypes = foe.m.speciesData.types;
  let usableDamaging = false;
  for (let i = 0; i < validMoves.length; i++) {
    const mv = MOVES[validMoves[i]];
    const left = (pm.m.pp && pm.m.pp[i] !== undefined) ? pm.m.pp[i] : mv.pp;
    if (left > 0 && mv.power > 0 && typeEffectiveness(mv.type, foeTypes) > 0) usableDamaging = true;
    html += '<button class="btn move-btn" ' + ((left <= 0 || !b.waitingPlayer) ? 'disabled ' : '') + 'style="--tc:' + typeColor(mv.type) + '" onclick="doBattleMove(' + i + ')">' +
      mv.name + '<span class="move-type">' + (mv.category === '物理' ? '物攻' : (mv.category === '特殊' ? '特攻' : '变化')) + ' · ' + mv.type + '</span>' + effHint(mv, foeTypes) +
      (moveEffectText(mv) ? '<span class="move-effect">' + moveEffectText(mv) + '</span>' : '') +
      '<span class="move-pp">PP ' + left + '/' + mv.pp + '</span></button>';
  }
  if (!usableDamaging) {
    html += '<button class="btn move-btn"' + (!b.waitingPlayer ? ' disabled' : '') + ' onclick="doBattleMove(-1)">挣扎<span class="move-type">无</span></button>';
  }
  html += '<button class="btn"' + (!b.waitingPlayer ? ' disabled' : '') + ' onclick="doBattleBag()">🎒 道具</button>';
  html += '<button class="btn"' + (!b.waitingPlayer ? ' disabled' : '') + ' onclick="doBattleParty()">🔄 更换精灵</button>';
  html += '<button class="btn"' + (!b.waitingPlayer ? ' disabled' : '') + ' onclick="doBattleRun()">🏃 ' + (b.canRun ? '逃跑' : '逃跑(不可)') + '</button>';
  $id('battle-actions').innerHTML = html;
}

function battleCard(bm, side, hit) {
  const m = bm.m;
  return '<div class="battle-card ' + side + (hit ? ' hit' : '') + ' pixel-frame">' +
    '<div class="battle-icon" id="battle-icon-' + side + '"></div>' +
    '<div class="battle-info"><div class="battle-head"><div class="battle-name">' + rarityTag(m) + m.name + (m.shiny ? ' ✨' : '') + '</div>' + battleStatusBadge(m.status) + '</div>' +
    '<div class="battle-lv">Lv.' + (m.displayLevel || m.level) + ' · ' + m.speciesData.types.join('/') + '</div>' + hpBar(m) +
    '</div></div>';
}

function doBattleMove(i) {
  if (_uiPlaying) return;
  const from = STATE.log.length;
  const battleRef = STATE.battle;
  battleMove(i);
  save();
  playBattleResult(from, battleRef);
}

function doBattleBag() {
  if (_uiPlaying) return;
  showBagModal(true);
}

function doBattleParty() {
  if (_uiPlaying) return;
  showPartyModal('switch');
}

function doBattleRun() {
  if (_uiPlaying) return;
  const from = STATE.log.length;
  const battleRef = STATE.battle;
  battleRun();
  save();
  playBattleResult(from, battleRef);
}

// ---------------- 弹窗：学招 / 火箭队 ----------------

function showLearnModal() {
  const p = STATE.pendingLearn[0];
  if (!p) return;
  let mon = null;
  if (p.uid) {
    mon = STATE.party.filter(function (m) { return m.uid === p.uid; })[0] ||
          STATE.box.filter(function (m) { return m.uid === p.uid; })[0] || null;
  }
  if (!mon) {
    const holder = p.where === 'party' ? STATE.party : STATE.box;
    mon = holder[p.idx];
  }
  if (!mon) {
    // 对应宝可梦已不存在（如被传送），跳过这条待学招
    STATE.pendingLearn.shift();
    render();
    return;
  }
  const newMv = MOVES[p.moveId];
  let html = newMv ?
    '<div class="learn-new" style="--tc:' + typeColor(newMv.type) + '">' +
      '<div class="learn-new-tag">✦ 要学习的技能</div>' +
      '<div class="learn-new-name">' + newMv.name + '</div>' +
      '<div class="learn-new-meta">' + newMv.type + ' · ' +
        (newMv.power > 0 ? newMv.category + ' · 威力 ' + newMv.power + ' · ' : '变化类 · ') +
        (newMv.acc === 0 ? '必中' : '命中 ' + newMv.acc) + ' · PP ' + newMv.pp +
        (moveEffectText(newMv) ? '<br>' + moveEffectText(newMv) : '') +
      '</div></div>' :
    '<div class="learn-new"><div class="learn-new-tag">✦ 要学习的技能</div><div class="learn-new-name">' + p.moveName + '</div></div>';
  html += '<div class="shop-hint">' + p.monName + ' 想学会上面的技能，请遗忘一个已学会的招式：</div>';
  for (let i = 0; i < mon.moves.length; i++) {
    const mv = MOVES[mon.moves[i]];
    html += '<button class="btn btn-sm learn-btn" onclick="doLearn(' + i + ')">' +
      '<span class="learn-btn-line"><span class="tag-known">已学会</span>' +
      '<span class="mv-name" style="--mv-tc:' + typeColor(mv.type) + '">' + mv.name + '</span></span>' +
      '<span class="learn-old-meta">' + (mv.power > 0 ? '威力 ' + mv.power + ' · ' : '变化类 · ') +
      (mv.acc === 0 ? '必中' : '命中 ' + mv.acc) + ' · PP ' + (mon.pp && mon.pp[i] !== undefined ? mon.pp[i] : mv.pp) + '/' + mv.pp +
      (moveEffectText(mv) ? '<br>' + moveEffectText(mv) : '') + '</span></button>';
  }
  html += '<button class="btn btn-sm" onclick="doLearn(-1)">不学了（不再提示）</button>';
  openModal('学习新招式', html);
}

function doLearn(replaceIdx) {
  const p = STATE.pendingLearn[0];
  if (p) {
    if (replaceIdx >= 0) resolvePendingLearn(p.moveId, replaceIdx);
    else resolvePendingLearn(p.moveId, null);
  }
  save();
  closeModal();
  render();
}

function showRocketSellModal() {
  const ev = ROCKET_EVENTS.sell;
  const canBuy = STATE.money >= ev.price;
  openModal('火箭队小兵', '<div class="shop-hint">' + ev.text + '（你当前有 ' + STATE.money + ' 金币）</div>' +
    '<div class="modal-btns"><button class="btn btn-primary" ' + (canBuy ? '' : 'disabled ') + 'onclick="doRocketSell(true)">付 ' + ev.price + ' 金买下' + (canBuy ? '' : '（金币不足）') + '</button>' +
    '<button class="btn" onclick="doRocketSell(false)">不理他</button></div>');
}

function doRocketSell(pay) {
  resolveRocketSell(pay);
  save();
  closeModal();
  render();
}

// ---------------- 弹窗：鲤鱼王大叔 ----------------

function showMagikarpModal() {
  const canBuy = STATE.money >= 500;
  openModal('鲤鱼王大叔', '<div class="shop-hint">稀有宝可梦鲤鱼王，只要 500 金！（你当前有 ' + STATE.money + ' 金币）</div>' +
    '<div class="modal-btns"><button class="btn btn-primary" ' + (canBuy ? '' : 'disabled ') + 'onclick="doMagikarpBuy(true)">付 500 金买下' + (canBuy ? '' : '（金币不足）') + '</button>' +
    '<button class="btn" onclick="doMagikarpBuy(false)">不买</button></div>');
}

function doMagikarpBuy(pay) {
  resolveMagikarpOffer(pay);
  save();
  closeModal();
  render();
}

// ---------------- 弹窗：神秘商人 / 强盗 / 旅行补给商 ----------------

function showMerchantModal() {
  const d = STATE.merchantOffer;
  if (!d) return;
  const label = d.kind === 'item' ? '【' + d.name + '】' : POKEDEX[d.id].name;
  const canBuy = STATE.money >= d.price;
  openModal('神秘商人', '<div class="shop-hint">神秘商人拿出一件东西：「只要 ' + d.price + ' 金币，' + label + ' 就是你的了！」（你当前有 ' + STATE.money + ' 金币）</div>' +
    '<div class="modal-btns"><button class="btn btn-primary" ' + (canBuy ? '' : 'disabled ') + 'onclick="doMerchantBuy(true)">付 ' + d.price + ' 金买下' + (canBuy ? '' : '（金币不足）') + '</button>' +
    '<button class="btn" onclick="doMerchantBuy(false)">不买</button></div>');
}

function doMerchantBuy(buy) {
  resolveMerchantOffer(buy);
  save();
  closeModal();
  render();
}

function showBanditModal() {
  const price = STATE.banditPrice || 800;
  const canPay = STATE.money >= price;
  openModal('拦路强盗', '<div class="shop-hint">「此路是我开，想过去先交 ' + price + ' 金币！」（你当前有 ' + STATE.money + ' 金币）</div>' +
    '<div class="modal-btns"><button class="btn btn-primary" ' + (canPay ? '' : 'disabled ') + 'onclick="doBandit(true)">付 ' + price + ' 金过路' + (canPay ? '' : '（金币不足）') + '</button>' +
    '<button class="btn" onclick="doBandit(false)">不给，开战</button></div>');
}

function doBandit(pay) {
  resolveBandit(pay);
  save();
  closeModal();
  render();
}

function showMedicModal() {
  const canHeal = STATE.money >= 800;
  const canPp = STATE.money >= 1500;
  openModal('旅行补给商', '<div class="shop-hint">「需要补给吗？野外价格，童叟无欺！」（你当前有 ' + STATE.money + ' 金币）</div>' +
    '<div class="modal-btns">' +
    '<button class="btn btn-primary" ' + (canHeal ? '' : 'disabled ') + 'onclick="doMedic(\'heal\')">全员回满 HP（800金）' + (canHeal ? '' : '（金币不足）') + '</button>' +
    '<button class="btn btn-primary" ' + (canPp ? '' : 'disabled ') + 'onclick="doMedic(\'pp\')">全员回满 PP（1500金）' + (canPp ? '' : '（金币不足）') + '</button>' +
    '<button class="btn" onclick="doMedic(\'no\')">不需要</button></div>');
}

function doMedic(option) {
  resolveMedic(option);
  save();
  closeModal();
  render();
}

// ---------------- 弹窗：NPC 交换 ----------------

function showTradeModal() {
  const t = STATE.townTrade;
  if (!t) return;
  const give = POKEDEX[t.give];
  const want = POKEDEX[t.want];
  openModal('宝可梦交换',
    '<div class="shop-hint">居民想用 <b>' + give.name + '</b> 换你的 <b>' + want.name + '</b>。' +
    '交换来的宝可梦经验获取 1.5 倍！</div>' +
    '<div class="modal-btns">' +
    '<button class="btn btn-primary" onclick="doTrade(true)">交换</button>' +
    '<button class="btn" onclick="doTrade(false)">婉拒</button></div>');
}

function doTrade(accept) {
  doTownTrade(accept);
  save();
  closeModal();
  render();
}

// 启动
document.addEventListener('DOMContentLoaded', function () {
  if (STATE.screen === 'title' && hasSave()) {
    // 停留在标题页，由玩家决定新开或继续
  }
  // 传送费用每日 0 点自动重置：每分钟检测一次跨天（最长 1 分钟延迟）
  setInterval(function () {
    const before = STATE.teleportCost;
    resetTeleportCostIfNewDay();
    if (STATE.teleportCost !== before) {
      addLog('新的一天！传送费用已重置为 500 金。', 'info');
      save();
      if (STATE.screen === 'map') render();
    }
  }, 60000);
  render();
});
