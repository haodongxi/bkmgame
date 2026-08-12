/* ============================================================
   宝可梦：关都篇 - UI 渲染层（像素风，无框架）
   Created by haodongsheng
   ============================================================ */

function $id(id) { return document.getElementById(id); }

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

function drawIcon(canvas, speciesId, pixelSize) {
  const S = 16;
  const ctx = canvas.getContext('2d');
  const data = POKEDEX[speciesId];
  if (!data) return;
  const rng = mulberry32((speciesId * 2654435761) >>> 0);
  const primary = data.color;
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
  canvas.style.width = pixelSize + 'px';
  canvas.style.height = pixelSize + 'px';
  canvas.style.imageRendering = 'pixelated';
}

function monIcon(speciesId, px) {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 16;
  drawIcon(c, speciesId, px || 40);
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

function hpBar(mon) {
  const pct = Math.max(0, Math.round(mon.hp / mon.stats.hp * 100));
  const color = pct > 50 ? 'var(--hp)' : (pct > 20 ? 'var(--gold)' : 'var(--red)');
  return '<div class="hpbar"><div class="hpbar-fill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
    '<div class="hp-text">HP ' + Math.max(0, mon.hp) + '/' + mon.stats.hp + '</div>';
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

function renderMap() {
  const node = MAP_NODES[STATE.nodeId];
  $id('loc-label').textContent = '[当前位置：' + node.name + ']';
  $id('weather-label').textContent = '[当前天气：' + WEATHER[STATE.weather].icon + ' ' + WEATHER[STATE.weather].name + ']';
  $id('meta-label').textContent = '💰 ' + STATE.money + '  · 徽章 ' + STATE.badges.length + '/8  · 图鉴 ' + Object.keys(STATE.seenDex).length + '/151';

  const logBox = $id('log-box');
  logBox.innerHTML = STATE.log.map(function (s) { return '<div>' + s + '</div>'; }).join('');
  scrollLogToBottom();

  // 队伍条
  let strip = '';
  if (STATE.party.length === 0) strip = '<div class="party-empty">队伍空空如也……</div>';
  for (let i = 0; i < STATE.party.length; i++) {
    const m = STATE.party[i];
    strip += '<div class="party-card pixel-frame">' +
      '<div class="party-icon" id="party-icon-' + i + '"></div>' +
      '<div class="party-info"><div class="party-name">' + m.name + (m.held ? ' ⚡' : '') + ' ' + statusIcon(m.status) + '</div>' +
      '<div class="party-lv">Lv.' + m.level + '</div>' + hpBar(m) + '</div></div>';
  }
  $id('party-strip').innerHTML = strip;
  for (let i = 0; i < STATE.party.length; i++) {
    $id('party-icon-' + i).appendChild(monIcon(STATE.party[i].species, 36));
  }

  // 操作按钮
  const panel = $id('action-panel');
  let html = '';
  if (node.type === 'town') {
    html += '<button class="btn" onclick="doMapAction(\'center\')">🏥 宝可梦中心(恢复)</button>';
    html += '<button class="btn" onclick="doMapAction(\'mart\')">🏪 友好商店</button>';
    html += '<button class="btn" onclick="doMapAction(\'wander\')">🚶 在镇上逛逛</button>';
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
  } else {
    html += '<button class="btn btn-primary" onclick="doMapAction(\'explore\')">🌿 在草丛探索</button>';
    if (node.water && STATE.keyItems.indexOf('破旧钓竿') !== -1) {
      html += '<button class="btn" onclick="doMapAction(\'fish\')">🎣 钓鱼</button>';
    }
    html += '<button class="btn" onclick="doMapAction(\'bag\')">🎒 打开背包</button>';
    html += '<button class="btn" onclick="doMapAction(\'party\')">🐾 精灵队伍</button>';
    html += '<button class="btn" onclick="doMapAction(\'town\')">🏘️ 返回城镇</button>';
    if (bagCount('穿绳') > 0) html += '<button class="btn" onclick="doMapAction(\'escape\')">🧵 使用穿绳</button>';
  }
  html += '<button class="btn btn-danger" onclick="doMapAction(\'reset\')">🗑️ 重开</button>';
  $id('action-panel').innerHTML = html;
}

function doMapAction(type) {
  closeModal();
  switch (type) {
    case 'center': visitCenter(); break;
    case 'mart': showShopModal(); return;
    case 'wander': wanderTown(); break;
    case 'gym': challengeGym(); break;
    case 'gymlocked': addLog(MAP_NODES[STATE.nodeId].gymLocked); break;
    case 'travel': showTravelModal(); return;
    case 'explore': explore(); break;
    case 'fish': fish(); break;
    case 'bag': showBagModal(false); return;
    case 'party': showPartyModal('view'); return;
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
  const stock = getMartStock();
  let html = '<div class="shop-hint">持有徽章：' + STATE.badges.length + ' 枚，金钱：' + STATE.money + '</div>';
  for (let i = 0; i < stock.length; i++) {
    const item = ITEMS[stock[i]];
    html += '<div class="shop-row"><span>' + item.name + '（' + item.price + '金）</span>' +
      '<button class="btn btn-sm" onclick="doBuy(\'' + item.name + '\')">购买</button></div>';
  }
  html += '<div class="shop-hint">—— 出售 ——</div>';
  const keys = Object.keys(STATE.bag).filter(function (k) { return bagCount(k) > 0; });
  if (keys.length === 0) html += '<div class="shop-hint">没有可出售的道具</div>';
  for (let i = 0; i < keys.length; i++) {
    const item = ITEMS[keys[i]];
    const price = item.sell || Math.floor((item.price || 0) / 2);
    if (price <= 0) continue;
    html += '<div class="shop-row"><span>' + keys[i] + ' ×' + bagCount(keys[i]) + '（卖' + price + '金）</span>' +
      '<button class="btn btn-sm" onclick="doSell(\'' + keys[i] + '\')">卖出</button></div>';
  }
  openModal('友好商店', html);
}

function doBuy(name) {
  buyItem(name);
  save();
  showShopModal();
}

function doSell(name) {
  sellItem(name);
  save();
  showShopModal();
}

// ---------------- 背包 / 队伍 ----------------

function showBagModal(inBattle) {
  const keys = Object.keys(STATE.bag).filter(function (k) { return bagCount(k) > 0; });
  let html = '';
  if (STATE.keyItems.length > 0) {
    html += '<div class="shop-hint">—— 关键道具 ——</div>';
    for (let i = 0; i < STATE.keyItems.length; i++) {
      const item = ITEMS[STATE.keyItems[i]];
      html += '<div class="shop-row"><span>' + STATE.keyItems[i] + '</span></div>' +
        '<div class="shop-desc">' + (item.desc || '') + '</div>';
    }
  }
  if (keys.length > 0) html += '<div class="shop-hint">—— 背包 ——</div>';
  if (keys.length === 0) html += '<div class="shop-hint">背包空空如也</div>';
  for (let i = 0; i < keys.length; i++) {
    const name = keys[i];
    const item = ITEMS[name];
    let usable = false;
    if (inBattle && (item.type === 'ball' || item.type === 'heal' || item.type === 'cure')) usable = true;
    if (!inBattle && (item.type === 'heal' || item.type === 'cure' || item.type === 'stone' || item.type === 'tm')) usable = true;
    html += '<div class="shop-row"><span>' + name + ' ×' + bagCount(name) + '</span>' +
      (usable ? '<button class="btn btn-sm" onclick="doBagUse(\'' + name + '\',' + (inBattle ? 'true' : 'false') + ')">使用</button>' : '') +
      '</div><div class="shop-desc">' + (item.desc || '') + '</div>';
  }
  openModal(inBattle ? '背包（战斗中）' : '背包', html);
}

function doBagUse(name, inBattle) {
  const item = ITEMS[name];
  if (inBattle) {
    battleUseItem(name);
    save();
    closeModal();
    render();
    return;
  }
  if (item.type === 'heal' || item.type === 'cure' || item.type === 'stone' || item.type === 'tm') {
    showPartyModal('item', name);
  }
}

function showPartyModal(mode, itemName) {
  let html = '';
  const isSwitch = mode === 'switch';
  const isItem = mode === 'item';
  for (let i = 0; i < STATE.party.length; i++) {
    const m = STATE.party[i];
    const btn = isSwitch
      ? '<button class="btn btn-sm" onclick="doSwitch(' + i + ')">上场</button>'
      : (isItem ? '<button class="btn btn-sm" onclick="doItemOnMon(\'' + itemName + '\',' + i + ')">使用</button>' : '');
    html += '<div class="party-row pixel-frame">' +
      '<div class="party-icon" id="modal-icon-' + i + '"></div>' +
      '<div class="party-info"><div class="party-name">' + m.name + ' ' + statusIcon(m.status) + '</div>' +
      '<div class="party-lv">Lv.' + m.level + ' · ' + m.speciesData.types.join('/') +
      (m.nature ? ' · 性格' + m.nature : '') + (m.held ? ' · [' + m.held + ']' : '') + '</div>' + hpBar(m) + '</div>' +
      btn + '</div>';
  }
  openModal(isSwitch ? '更换精灵' : (isItem ? '选择宝可梦' : '精灵队伍'), html);
  for (let i = 0; i < STATE.party.length; i++) {
    $id('modal-icon-' + i).appendChild(monIcon(STATE.party[i].species, 36));
  }
}

function doSwitch(idx) {
  battleSwitch(idx);
  save();
  closeModal();
  render();
}

function doItemOnMon(name, idx) {
  useBagItemOnMon(name, idx);
  save();
  closeModal();
  render();
}

// ---------------- 战斗界面 ----------------

function renderBattle() {
  const b = STATE.battle;
  if (!b) { STATE.screen = 'map'; render(); return; }
  const foe = b.foe.mons[b.foe.active];
  const pm = b.player.mons[b.player.active];
  $id('battle-foe').innerHTML = battleCard(foe, 'foe');
  $id('battle-player').innerHTML = battleCard(pm, 'player');
  const bLog = $id('battle-log');
  let start = b.logStart || 0;
  if (start > STATE.log.length) start = Math.max(0, STATE.log.length - 50);
  bLog.innerHTML = STATE.log.slice(start).map(function (s) { return '<div>' + s + '</div>'; }).join('');
  bLog.scrollTop = bLog.scrollHeight;

  let html = '';
  const validMoves = pm.m.moves.filter(function (id) { return MOVES[id]; });
  for (let i = 0; i < validMoves.length; i++) {
    const mv = MOVES[validMoves[i]];
    html += '<button class="btn move-btn" style="--tc:' + typeColor(mv.type) + '" onclick="doBattleMove(' + i + ')">' +
      mv.name + '<span class="move-type">' + mv.type + '</span></button>';
  }
  const foeTypes = foe.m.speciesData.types;
  const hasEffective = validMoves.some(function (id) {
    const mv = MOVES[id];
    return mv.power > 0 && typeEffectiveness(mv.type, foeTypes) > 0;
  });
  if (!hasEffective) {
    html += '<button class="btn move-btn" onclick="doBattleMove(-1)">挣扎<span class="move-type">无</span></button>';
  }
  html += '<button class="btn" onclick="doBattleBag()">🎒 道具</button>';
  html += '<button class="btn" onclick="doBattleParty()">🔄 更换精灵</button>';
  html += '<button class="btn" onclick="doBattleRun()">🏃 ' + (b.canRun ? '逃跑' : '逃跑(不可)') + '</button>';
  $id('battle-actions').innerHTML = html;
}

function battleCard(bm, side) {
  const m = bm.m;
  const icon = document.createElement('div');
  return '<div class="battle-card ' + side + ' pixel-frame">' +
    '<div class="battle-icon" id="battle-icon-' + side + '"></div>' +
    '<div class="battle-info"><div class="battle-name">' + m.name + ' ' + statusIcon(m.status) + '</div>' +
    '<div class="battle-lv">Lv.' + m.level + ' · ' + m.speciesData.types.join('/') + '</div>' + hpBar(m) + '</div></div>';
}

function doBattleMove(i) {
  battleMove(i);
  save();
  render();
}

function doBattleBag() {
  showBagModal(true);
}

function doBattleParty() {
  showPartyModal('switch');
}

function doBattleRun() {
  battleRun();
  save();
  render();
}

// ---------------- 弹窗：学招 / 火箭队 ----------------

function showLearnModal() {
  const p = STATE.pendingLearn[0];
  if (!p) return;
  let html = '<div class="shop-hint">' + p.monName + ' 想学会【' + p.moveName + '】，要遗忘哪个招式？</div>';
  const holder = p.where === 'party' ? STATE.party : STATE.box;
  const mon = holder[p.idx];
  for (let i = 0; i < mon.moves.length; i++) {
    const mv = MOVES[mon.moves[i]];
    html += '<button class="btn btn-sm learn-btn" onclick="doLearn(' + i + ')">遗忘 ' + mv.name + '</button>';
  }
  html += '<button class="btn btn-sm" onclick="doLearn(-1)">不学了</button>';
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
  openModal('火箭队小兵', '<div class="shop-hint">' + ev.text + '</div>' +
    '<div class="modal-btns"><button class="btn btn-primary" onclick="doRocketSell(true)">付 ' + ev.price + ' 金买下</button>' +
    '<button class="btn" onclick="doRocketSell(false)">不理他</button></div>');
}

function doRocketSell(pay) {
  resolveRocketSell(pay);
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
  render();
});
