/* ============================================================
   宝可梦：关都篇 - 联机对战客户端（对接 bkmserver）
   Created by haodongsheng
   说明：局域网/本机对战入口。服务端数据与单机版同源（图鉴/招式/克制），
   队伍从当前存档导出上传，战斗事件流通过 HTTP 轮询渲染。
   ============================================================ */

const REMOTE = {
  // 默认取页面同源（单服务联机：页面由 bkmserver --static 托管时自动指向同一端口）
  server: localStorage.getItem('bkm_remote_server') ||
    (typeof location !== 'undefined' && location.protocol.indexOf('http') === 0
      ? location.origin : 'http://127.0.0.1:8787'),
  token: localStorage.getItem('bkm_remote_token') || null,
  name: localStorage.getItem('bkm_remote_name') || '',
  roomId: null,
  side: null,
  seen: 0,
  mode: 'room',        // room | queue
  lastView: null,
  timer: null,
  busy: false,
  battleOpen: false,
  prevScreen: 'title'
};

// 对战可用道具（与 bkmserver engine/items.py 对齐）
const REMOTE_BATTLE_ITEMS = ['伤药', '好伤药', '全复药', '万灵药', '解毒药', '解麻药', 'PP回复药', 'PP满回复药'];
const REMOTE_ITEM_NAMES = {
  '伤药': '回复20HP', '好伤药': '回复60HP', '全复药': '完全回复HP与异常',
  '万灵药': '治愈任意异常', '解毒药': '解除中毒', '解麻药': '解除麻痹',
  'PP回复药': '各招式PP+10', 'PP满回复药': 'PP回满'
};

// 一键测试队伍（Lv50/60，带专属道具；招式均可在对应等级学习）
const REMOTE_TEST_TEAM = [
  { species: 25, level: 50, nature: '胆小', held: '电气球', moves: ['thunderbolt', 'quick_attack', 'thunder_wave', 'slam'] },
  { species: 6, level: 50, nature: '内敛', held: '不灭之种', moves: ['flamethrower', 'dragon_rage', 'wing_attack', 'sunny_day'] },
  { species: 9, level: 60, nature: '温和', held: '涡轮喷口', moves: ['surf', 'hydro_pump', 'rain_dance', 'bite'] },
  { species: 143, level: 60, nature: '固执', held: '剩饭盒', moves: ['body_slam', 'earthquake', 'rest', 'amnesia'] }
];

// ---------------- 基础 ----------------

function remoteSaveCfg() {
  localStorage.setItem('bkm_remote_server', REMOTE.server);
  if (REMOTE.token) localStorage.setItem('bkm_remote_token', REMOTE.token);
  else localStorage.removeItem('bkm_remote_token');
  if (REMOTE.name) localStorage.setItem('bkm_remote_name', REMOTE.name);
  else localStorage.removeItem('bkm_remote_name');
}

async function remoteApi(method, path, body) {
  const opt = { method: method, headers: { 'Content-Type': 'application/json' } };
  if (REMOTE.token) opt.headers['Authorization'] = 'Bearer ' + REMOTE.token;
  if (body !== undefined) opt.body = JSON.stringify(body);
  const resp = await fetch(REMOTE.server + path, opt);
  let j = null;
  try { j = await resp.json(); } catch (e) { /* 非 JSON 响应 */ }
  if (!resp.ok) {
    let msg = 'HTTP ' + resp.status;
    if (j) {
      if (typeof j.error === 'string') msg = j.error;
      else if (j.error && j.error.errors) msg = j.error.errors.join('；');
      else if (j.data && j.data.errors) msg = j.data.errors.join('；');
    }
    console.error('[remote] 请求失败', method, path, j);
    throw new Error(msg);
  }
  return j.data;
}

function remoteMsg(text, isErr) {
  const el = $id('remote-msg') || $id('rb-msg');
  if (el) {
    el.textContent = text;
    el.className = 'remote-msg' + (isErr ? ' err' : '');
  }
}

// ---------------- 屏幕切换 ----------------

function remoteOpenLobby() {
  remoteStopPoll();
  REMOTE.prevScreen = (STATE.screen === 'map' || STATE.screen === 'battle') ? STATE.screen : 'title';
  REMOTE.roomId = null;
  REMOTE.seen = 0;
  REMOTE.lastView = null;
  REMOTE.battleOpen = false;
  STATE.screen = 'remote';
  render();
}

function remoteClose() {
  remoteStopPoll();
  REMOTE.roomId = null;
  REMOTE.battleOpen = false;
  STATE.screen = REMOTE.prevScreen === 'battle' ? 'map' : REMOTE.prevScreen;
  if (STATE.screen === 'map' && STATE.battle) STATE.screen = 'battle';
  render();
}

function remoteBackToLobby() {
  remoteStopPoll();
  REMOTE.roomId = null;
  REMOTE.seen = 0;
  REMOTE.lastView = null;
  REMOTE.battleOpen = false;
  render();
}

function renderRemote() {
  const lobby = $id('remote-lobby');
  const battle = $id('remote-battle');
  if (!lobby || !battle) return;
  if (REMOTE.battleOpen && REMOTE.lastView) {
    lobby.style.display = 'none';
    battle.style.display = 'flex';
    remoteRenderView(REMOTE.lastView);
  } else {
    battle.style.display = 'none';
    lobby.style.display = '';
    remoteRenderLobby();
  }
}

// ---------------- 大厅 ----------------

function remoteRenderLobby() {
  const el = $id('remote-lobby');
  const partyCount = (STATE.party || []).length;
  const logged = !!REMOTE.token;
  const pageOrigin = (typeof location !== 'undefined' && location.protocol.indexOf('http') === 0)
    ? location.origin : REMOTE.server;
  el.innerHTML =
    '<div class="remote-panel pixel-frame">' +
    '<div class="sec-title">—— 联机对战 · bkmserver ——</div>' +
    '<div class="remote-row"><span class="remote-label">服务器</span>' +
    '<input id="rb-server" type="text" value="' + esc(REMOTE.server) + '" oninput="REMOTE.server=this.value.trim();remoteSaveCfg()">' +
    '<button class="btn btn-sm" onclick="remoteTest()">测试</button></div>' +
    (logged ?
      '<div class="remote-row"><span class="remote-label">玩家</span><span>' + esc(REMOTE.name) + '（已登录）</span>' +
      '<button class="btn btn-sm" onclick="remoteLogout()">退出</button></div>' :
      '<div class="remote-row"><span class="remote-label">昵称</span><input id="rb-name" type="text" maxlength="12" placeholder="2-12 字符"></div>' +
      '<div class="remote-row"><span class="remote-label">密码</span><input id="rb-pass" type="password" placeholder="至少 4 位">' +
      '<button class="btn btn-sm" onclick="remoteLogin()">登录</button>' +
      '<button class="btn btn-sm" onclick="remoteRegister()">注册</button></div>') +
    '<div class="remote-actions">' +
    '<button class="btn" onclick="remoteUploadTeam()">📤 上传当前队伍（' + partyCount + ' 只）</button>' +
    '<button class="btn" onclick="remoteMakeTestTeam()">🎁 生成测试队伍</button>' +
    '</div>' +
    '<div class="remote-row" style="margin-top:8px"><span class="remote-label">房间码</span>' +
    '<input id="rb-code" type="text" placeholder="6 位房间码">' +
    '<button class="btn btn-sm" onclick="remoteJoin()">加入</button></div>' +
    '<div class="remote-actions">' +
    '<button class="btn btn-primary" onclick="remoteCreate()">🏠 创建房间</button>' +
    '<button class="btn" onclick="remoteQuick()">⚡ 快速匹配</button>' +
    '</div>' +
    '<div id="remote-msg" class="remote-msg"></div>' +
    '<div class="remote-hint">提示：对战前先上传队伍。单服务联机：服务端用 <b>python3 main.py --host 0.0.0.0 --static &lt;bkmgame目录&gt;</b> 启动，' +
    '当前页面地址：<b>' + esc(pageOrigin) + '/app.html</b>（服务器地址已自动填为页面同源，可手动修改）。' +
    '本机双开测试：第二个窗口请用「无痕模式」，避免两个窗口共用存档/账号。</div>' +
    '<div class="remote-actions"><button class="btn" onclick="remoteClose()">← 返回</button></div>' +
    '</div>';
}

async function remoteTest() {
  try {
    await remoteApi('GET', '/health');
    remoteMsg('✅ 服务器连接正常（' + REMOTE.server + '）');
  } catch (e) {
    remoteMsg('❌ 连接失败：' + e.message, true);
  }
}

function remoteCredentials() {
  const nameEl = $id('rb-name');
  const passEl = $id('rb-pass');
  return {
    name: (nameEl ? nameEl.value.trim() : '') || REMOTE.name,
    password: passEl ? passEl.value : ''
  };
}

async function remoteLogin() {
  const c = remoteCredentials();
  if (!c.name || !c.password) { remoteMsg('请填写昵称和密码', true); return; }
  try {
    const d = await remoteApi('POST', '/api/login', { name: c.name, password: c.password });
    REMOTE.token = d.token;
    REMOTE.name = d.player.name;
    remoteSaveCfg();
    remoteMsg('✅ 登录成功：' + REMOTE.name + '（评分 ' + d.player.rating + '，战绩 ' + d.player.wins + '胜 ' + d.player.losses + '负）');
    render();
  } catch (e) {
    remoteMsg('登录失败：' + e.message, true);
  }
}

async function remoteRegister() {
  const c = remoteCredentials();
  if (!c.name || !c.password) { remoteMsg('请填写昵称和密码', true); return; }
  try {
    const d = await remoteApi('POST', '/api/register', { name: c.name, password: c.password });
    REMOTE.token = d.token;
    REMOTE.name = d.player.name;
    remoteSaveCfg();
    remoteMsg('✅ 注册成功：' + REMOTE.name + '，已自动登录');
    render();
  } catch (e) {
    remoteMsg('注册失败：' + e.message, true);
  }
}

function remoteLogout() {
  REMOTE.token = null;
  REMOTE.name = '';
  remoteSaveCfg();
  render();
}

// ---------------- 队伍导出 ----------------

function remoteBuildTeam() {
  const party = STATE.party || [];
  if (party.length === 0) return null;
  const team = party.map(function (m) {
    const e = {
      species: m.species,
      level: m.level,
      nature: m.nature,
      ivs: m.ivs || undefined,
      moves: (m.moves || []).slice(0, 4)
    };
    if (m.held) e.held = m.held;
    return e;
  });
  const items = {};
  REMOTE_BATTLE_ITEMS.forEach(function (k) {
    if (STATE.bag && STATE.bag[k] > 0) items[k] = Math.min(9, STATE.bag[k]);
  });
  return { team: team, items: items };
}

async function remoteUploadTeam() {
  if (!REMOTE.token) { remoteMsg('请先登录', true); return; }
  const payload = remoteBuildTeam();
  if (!payload) { remoteMsg('当前队伍为空，请先培养宝可梦', true); return; }
  try {
    const d = await remoteApi('PUT', '/api/me/team', payload);
    remoteMsg('✅ 队伍已上传：' + d.mons.map(function (m) { return m.name + ' Lv' + m.level; }).join('、'));
  } catch (e) {
    console.error('[remote] 上传队伍失败', e);
    remoteMsg('队伍上传失败：' + e.message, true);
  }
}

// 没有单机队伍时的快速测试队伍（会写入当前存档，登录后自动上传）
function remoteMakeTestTeam() {
  const party = STATE.party || [];
  const room = Math.max(0, PARTY_LIMIT - party.length);
  if (room === 0) { remoteMsg('队伍已满（' + PARTY_LIMIT + ' 只），可直接上传', true); return; }
  REMOTE_TEST_TEAM.slice(0, room).forEach(function (cfg) {
    const mon = makeMon(cfg.species, cfg.level, { nature: cfg.nature, moves: cfg.moves });
    mon.held = cfg.held;
    STATE.party.push(mon);
  });
  STATE.bag = STATE.bag || {};
  ['伤药', '好伤药', '全复药', '万灵药', 'PP回复药'].forEach(function (k) {
    STATE.bag[k] = (STATE.bag[k] || 0) + (k === '全复药' ? 1 : 3);
  });
  save();
  render();
  remoteMsg('✅ 已生成测试队伍（' + Math.min(room, REMOTE_TEST_TEAM.length) + ' 只），正在上传……');
  if (REMOTE.token) remoteUploadTeam();
}

// ---------------- 房间 / 匹配 ----------------

async function remoteCreate() {
  if (!REMOTE.token) { remoteMsg('请先登录', true); return; }
  try {
    const d = await remoteApi('POST', '/api/rooms', {});
    REMOTE.roomId = d.id;
    REMOTE.seen = 0;
    REMOTE.lastView = d;
    REMOTE.mode = 'room';
    remoteStartPoll();
  } catch (e) {
    remoteMsg('建房失败：' + e.message, true);
  }
}

async function remoteJoin() {
  if (!REMOTE.token) { remoteMsg('请先登录', true); return; }
  const code = $id('rb-code') ? $id('rb-code').value.trim() : '';
  if (!code) { remoteMsg('请输入房间码', true); return; }
  try {
    const d = await remoteApi('POST', '/api/rooms/join', { code: code });
    REMOTE.roomId = d.id;
    REMOTE.seen = 0;
    REMOTE.lastView = d;
    REMOTE.mode = 'room';
    remoteStartPoll();
  } catch (e) {
    remoteMsg('加入失败：' + e.message, true);
  }
}

async function remoteQuick() {
  if (!REMOTE.token) { remoteMsg('请先登录', true); return; }
  try {
    const d = await remoteApi('POST', '/api/queue/join', {});
    if (d.queued) {
      REMOTE.mode = 'queue';
      remoteMsg('已进入匹配队列（第 ' + d.position + ' 位），等待对手……');
      remoteStartPoll();
    } else {
      REMOTE.roomId = d.room_id;
      REMOTE.seen = 0;
      REMOTE.mode = 'room';
      remoteStartPoll();
    }
  } catch (e) {
    remoteMsg('匹配失败：' + e.message, true);
  }
}

function remoteStartPoll() {
  remoteStopPoll();
  REMOTE.timer = setInterval(remoteTick, 900);
  remoteTick();
}

function remoteStopPoll() {
  if (REMOTE.timer) { clearInterval(REMOTE.timer); REMOTE.timer = null; }
}

async function remoteTick() {
  if (REMOTE.busy || !REMOTE.roomId) return;
  REMOTE.busy = true;
  try {
    if (REMOTE.mode === 'queue') {
      const d = await remoteApi('GET', '/api/queue/status');
      if (d.room_id) {
        REMOTE.mode = 'room';
        REMOTE.roomId = d.room_id;
        REMOTE.seen = 0;
        remoteMsg('✅ 匹配成功，对战开始！');
      } else if (d.queued) {
        remoteMsg('匹配中……（队列第 ' + (d.position || '?') + ' 位）');
        return;
      } else {
        // 已掉出队列（如同一账号重复匹配把排队记录顶掉），停止轮询并明确提示
        remoteStopPoll();
        remoteMsg('已掉出匹配队列，请重新点击「快速匹配」', true);
        return;
      }
    }
    const view = await remoteApi('GET', '/api/rooms/' + REMOTE.roomId + '?after=' + REMOTE.seen);
    REMOTE.lastView = view;
    if (!REMOTE.side) REMOTE.side = view.you;
    if (!REMOTE.battleOpen) {
      REMOTE.battleOpen = true;
      render();
    } else {
      remoteRenderView(view);
    }
    if (view.battle && view.battle.over) remoteStopPoll();
  } catch (e) {
    remoteMsg('连接出错：' + e.message, true);
    remoteStopPoll();
  } finally {
    REMOTE.busy = false;
  }
}

// ---------------- 对战渲染 ----------------

function remoteRenderView(view) {
  if (!view || !view.id) return;
  const battle = $id('remote-battle');
  if (view.battle) {
    if (!battle.dataset.built) {
      remoteBattleShell();
      battle.dataset.built = '1';
    }
    remoteRenderBattle(view);
  } else {
    battle.dataset.built = '';
    remoteRenderWaiting(view);
  }
}

function remoteBattleShell() {
  const el = $id('remote-battle');
  el.innerHTML =
    '<div class="remote-panel pixel-frame" style="width:100%">' +
    '<div class="sec-title" id="rb-title">—— 联机对战 ——</div>' +
    '<div id="rb-status" class="meta-line"></div>' +
    '<div id="rb-foe"></div>' +
    '<div class="vs-divider">▼ 对战 ▼</div>' +
    '<div id="rb-player"></div>' +
    '<div id="rb-log" class="log-box small"></div>' +
    '<div id="rb-msg" class="remote-msg"></div>' +
    '<div id="rb-actions"></div>' +
    '<div class="remote-actions" style="margin-top:8px">' +
    '<button class="btn btn-sm" onclick="remoteForfeit()">🏳️ 认输</button>' +
    '<button class="btn btn-sm" onclick="remoteBackToLobby()">← 返回大厅</button>' +
    '</div>' +
    '</div>';
}

function remoteRenderWaiting(view) {
  const el = $id('remote-battle');
  el.innerHTML =
    '<div class="remote-panel pixel-frame">' +
    '<div class="sec-title">—— 房间 ' + esc(view.id) + ' ——</div>' +
    '<div class="remote-msg">' + (view.code ? '房间码：<b>' + esc(view.code) + '</b>（把码发给对手加入）' : '等待对手……') + '</div>' +
    '<div class="remote-hint">对手加入后对战会自动开始。</div>' +
    '<div class="remote-actions"><button class="btn" onclick="remoteBackToLobby()">← 返回大厅</button></div>' +
    '</div>';
}

function remoteCard(side, data) {
  const d = POKEDEX[data.species] || {};
  const fake = { hp: data.hp, stats: { hp: data.max }, species: data.species };
  return '<div class="battle-card ' + side + ' pixel-frame">' +
    '<div class="battle-icon" id="rb-icon-' + side + '"></div>' +
    '<div class="battle-info"><div class="battle-name">' + rarityTag(fake) + esc(data.name) + ' ' + statusIcon(data.status) + '</div>' +
    '<div class="battle-lv">Lv.' + data.level + ' · ' + (d.types || []).join('/') + (data.held ? ' · &lt;' + esc(data.held) + '&gt;' : '') + '</div>' +
    hpBar(fake) + '</div></div>';
}

function remoteRenderBattle(view) {
  const b = view.battle;
  const my = REMOTE.side || view.you;
  const foe = my === 'A' ? 'B' : 'A';
  const names = view.players || {};
  if (!$id('rb-foe')) remoteBattleShell();
  $id('rb-title').textContent = '—— 联机对战 · 第 ' + b.turn + ' 回合 ——';
  const weather = b.weather ? (b.weather.type + '（剩 ' + b.weather.turns + ' 回合）') : '无';
  $id('rb-status').textContent = '天气 ' + weather + ' · ' +
    (names[foe] ? names[foe].name : '对手') + '（' + foe + '） vs ' +
    (names[my] ? names[my].name : '你') + '（' + my + '）';
  $id('rb-foe').innerHTML = remoteCard('foe', b.actives[foe]);
  $id('rb-player').innerHTML = remoteCard('player', b.actives[my]);
  const fi = $id('rb-icon-foe');
  if (fi) fi.appendChild(monIcon(b.actives[foe].species, 48, false));
  const pi = $id('rb-icon-player');
  if (pi) pi.appendChild(monIcon(b.actives[my].species, 48, false));

  // 事件日志（增量追加）
  const log = $id('rb-log');
  (view.events || []).forEach(function (e) {
    if (e.seq <= REMOTE.seen) return;
    REMOTE.seen = e.seq;
    const kind = e.kind === 'a' ? (my === 'A' ? 'player' : 'foe') :
      (e.kind === 'b' ? (my === 'B' ? 'player' : 'foe') : e.kind);
    const div = document.createElement('div');
    div.className = 'log-line' + (kind ? ' log-' + kind : '');
    div.textContent = e.text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  });

  $id('rb-actions').innerHTML = remoteActions(view, my, foe);
  if (b.over) {
    $id('rb-status').textContent = (view.winner ? (names[view.winner] ? names[view.winner].name : view.winner) + ' 获胜' : '平局') + '（' + view.result + '）';
    $id('rb-actions').innerHTML =
      '<div class="turn-hint">对局结束</div>' +
      '<div class="remote-actions" style="grid-column:1/-1"><button class="btn" onclick="remoteBackToLobby()">← 返回大厅</button></div>';
  }
}

function remoteActions(view, my, foe) {
  const b = view.battle;
  const myMon = b.actives[my];
  const foeTypes = (POKEDEX[b.actives[foe].species] || {}).types || [];
  let html = '';
  if ((b.pending_switch || []).indexOf(my) !== -1) {
    html += '<div class="turn-hint">✦ ' + esc(myMon.name) + ' 倒下了，请选择下一只宝可梦</div>';
    (b.parties[my] || []).forEach(function (m, i) {
      if (m.hp <= 0 || m.uid === myMon.uid) return;
      html += '<button class="btn" onclick="remoteSwitchTo(' + i + ')">' + esc(m.name) + ' Lv' + m.level + '（' + m.hp + '/' + m.max + '）</button>';
    });
    html += '<button class="btn" onclick="remoteForfeit()">🏳️ 认输</button>';
    return html;
  }
  const canAct = b.phase === 'action' && !b.actions_submitted[my];
  if (!canAct) {
    html += '<div class="turn-hint">' + (b.actions_submitted[my] ? '已提交指令，等待对方……' : '……对方行动中……') + '</div>';
    return html;
  }
  html += '<div class="turn-hint">✦ 轮到你了！选择指令</div>';
  const allEmpty = (myMon.moves || []).every(function (mv) { return mv.pp <= 0; });
  (myMon.moves || []).forEach(function (mv, i) {
    const data = MOVES[mv.id];
    if (!data) return;
    const left = mv.pp;
    html += '<button class="btn move-btn" ' + (left <= 0 ? 'disabled ' : '') +
      'style="--tc:' + typeColor(data.type) + '" onclick="remoteMove(' + i + ')">' +
      data.name + '<span class="move-type">' + (data.category === '物理' ? '物攻' : (data.category === '特殊' ? '特攻' : '变化')) + ' · ' + data.type + '</span>' +
      effHint(data, foeTypes) +
      (moveEffectText(data) ? '<span class="move-effect">' + moveEffectText(data) + '</span>' : '') +
      '<span class="move-pp">PP ' + left + '/' + data.pp + '</span></button>';
  });
  if (allEmpty) {
    html += '<button class="btn move-btn" onclick="remoteMove(-1)">挣扎<span class="move-type">无</span></button>';
  }
  html += '<button class="btn" onclick="remoteShowItems()">🎒 道具</button>';
  html += '<button class="btn" onclick="remoteShowSwitch()">🔄 更换精灵</button>';
  return html;
}

// ---------------- 指令 ----------------

function remoteMove(i) {
  if (!REMOTE.lastView || !REMOTE.lastView.battle) return;
  if (REMOTE.lastView.battle.actions_submitted[REMOTE.side]) return;
  remoteSubmit({ type: 'move', index: i });
}

function remoteShowItems() {
  const b = REMOTE.lastView.battle;
  const items = (b.items || {})[REMOTE.side] || {};
  const avail = Object.keys(items).filter(function (k) { return items[k] > 0; });
  if (avail.length === 0) { remoteMsg('没有可用道具', true); return; }
  openModal('对战道具', avail.map(function (k) {
    return '<button class="btn btn-sm" onclick="remoteUseItem(\'' + k + '\')">' +
      esc(k) + ' ×' + items[k] +
      '<span class="rb-item-desc">' + (REMOTE_ITEM_NAMES[k] || '') + '</span></button>';
  }).join(''));
}

function remoteUseItem(name) {
  closeModal();
  remoteSubmit({ type: 'item', item: name });
}

function remoteShowSwitch() {
  const b = REMOTE.lastView.battle;
  const myMon = b.actives[REMOTE.side];
  const party = b.parties[REMOTE.side] || [];
  const avail = [];
  party.forEach(function (m, i) {
    if (m.hp > 0 && m.uid !== myMon.uid) avail.push([i, m]);
  });
  if (avail.length === 0) { remoteMsg('没有可替换的宝可梦', true); return; }
  openModal('更换精灵', avail.map(function (p) {
    return '<button class="btn btn-sm" onclick="remoteSwitchTo(' + p[0] + ')">' +
      esc(p[1].name) + ' Lv' + p[1].level + '（' + p[1].hp + '/' + p[1].max + '）</button>';
  }).join(''));
}

function remoteSwitchTo(idx) {
  closeModal();
  remoteSubmit({ type: 'switch', index: idx });
}

function remoteForfeit() {
  openModal('认输', '<div class="shop-hint">确定要认输吗？本局将判对方获胜。</div>' +
    '<div class="modal-btns"><button class="btn btn-primary" onclick="remoteForfeitYes()">认输</button>' +
    '<button class="btn" onclick="closeModal()">再想想</button></div>');
}

function remoteForfeitYes() {
  closeModal();
  remoteSubmit({ type: 'forfeit' });
}

async function remoteSubmit(action) {
  if (!REMOTE.roomId) return;
  try {
    const view = await remoteApi('POST', '/api/rooms/' + REMOTE.roomId + '/action', { action: action });
    REMOTE.lastView = view;
    if (view.you) REMOTE.side = view.you;
    if (view.battle) remoteRenderBattle(view);
  } catch (e) {
    remoteMsg('指令失败：' + e.message, true);
  }
}
