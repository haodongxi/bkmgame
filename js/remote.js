/* ============================================================
   宝可梦：关都篇 - 联机对战客户端（对接 bkmserver）
   Created by haodongsheng
   说明：局域网/本机对战入口。服务端数据与单机版同源（图鉴/招式/克制），
   队伍从当前存档导出上传，战斗事件流通过 HTTP 轮询渲染。
   ============================================================ */

const REMOTE = {
  // 默认连云服务器（HTTPS）；仅本机（127.0.0.1/localhost）单服务联机时自动取页面同源
  server: localStorage.getItem('bkm_remote_server') ||
    ((typeof location !== 'undefined' && (location.hostname === '127.0.0.1' || location.hostname === 'localhost'))
      ? location.origin : 'https://bkmapi.duckdns.org:8787'),
  // 登录态按窗口隔离（sessionStorage）：本机双开两个窗口可以各登各的账号
  token: sessionStorage.getItem('bkm_remote_token') || null,
  name: sessionStorage.getItem('bkm_remote_name') || '',
  guest: sessionStorage.getItem('bkm_remote_guest') === '1',
  roomId: null,
  side: null,
  seen: 0,
  mode: 'room',        // room | queue | handshake
  lastView: null,
  timer: null,
  busy: false,
  battleOpen: false,
  prevScreen: 'title',
  switchPromptKey: '',
  pvpDraft: null,
  pvpDraftConfirmed: false,
  pvpDraftSourceFingerprint: '',
  pvpMoveSlot: 0,
  pendingCloudAction: null,
  handshakeRequestId: '',
  handshakeSentRoomId: '',
  matchingFailures: 0
};

// 对战可用道具（与 bkmserver engine/items.py 对齐）
const REMOTE_BATTLE_ITEMS = ['伤药', '好伤药', '全复药', '万灵药', '解毒药', '解麻药', 'PP回复药', 'PP满回复药'];
const REMOTE_ITEM_NAMES = {
  '伤药': '回复20HP', '好伤药': '回复60HP', '全复药': '完全回复HP与异常',
  '万灵药': '治愈任意异常', '解毒药': '解除中毒', '解麻药': '解除麻痹',
  'PP回复药': '各招式PP+10', 'PP满回复药': 'PP回满'
};

// ---------------- 基础 ----------------

function remoteSaveCfg() {
  localStorage.setItem('bkm_remote_server', REMOTE.server);
  if (REMOTE.token) sessionStorage.setItem('bkm_remote_token', REMOTE.token);
  else sessionStorage.removeItem('bkm_remote_token');
  if (REMOTE.name) sessionStorage.setItem('bkm_remote_name', REMOTE.name);
  else sessionStorage.removeItem('bkm_remote_name');
  if (REMOTE.guest) sessionStorage.setItem('bkm_remote_guest', '1');
  else sessionStorage.removeItem('bkm_remote_guest');
}

async function remoteApi(method, path, body, timeoutMs) {
  const opt = { method: method, headers: { 'Content-Type': 'application/json' } };
  if (REMOTE.token) opt.headers['Authorization'] = 'Bearer ' + REMOTE.token;
  if (body !== undefined) opt.body = JSON.stringify(body);
  let timer = null;
  if (timeoutMs && typeof AbortController !== 'undefined') {
    const controller = new AbortController();
    opt.signal = controller.signal;
    timer = setTimeout(function () { controller.abort(); }, timeoutMs);
  }
  let resp;
  try {
    resp = await fetch(REMOTE.server + path, opt);
  } catch (e) {
    if (e && e.name === 'AbortError') throw new Error('请求超时，请检查网络后重试');
    throw e;
  } finally {
    if (timer) clearTimeout(timer);
  }
  let j = null;
  try { j = await resp.json(); } catch (e) { /* 非 JSON 响应 */ }
  if (!resp.ok) {
    let msg = 'HTTP ' + resp.status;
    if (resp.status === 401) {
      REMOTE.token = null;
      REMOTE.name = '';
      REMOTE.guest = false;
      remoteSaveCfg();
      msg = '登录已过期，请先在联机对战重新登录';
    }
    if (j && resp.status !== 401) {
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
  const el = $id('remote-msg') || $id('rb-msg') || $id('save-cloud-msg');
  if (el) {
    el.textContent = text;
    el.className = 'remote-msg' + (isErr ? ' err' : '');
  }
}

function remoteOpenAuthModal(action) {
  REMOTE.pendingCloudAction = action || null;
  openModal('云存档账号',
    '<div class="shop-hint">登录或注册账号后，云存档会按账号保存。单机存档不会被自动修改。</div>' +
    '<input id="cloud-auth-name" class="save-code" maxlength="12" placeholder="昵称（2-12 字符）" value="' + esc(REMOTE.name || '') + '">' +
    '<input id="cloud-auth-pass" class="save-code" type="password" placeholder="密码（至少 4 位）" style="margin-top:8px">' +
    '<div id="cloud-auth-msg" class="shop-hint"></div>' +
    '<div class="modal-btns"><button class="btn btn-primary" onclick="remoteAuthSubmit(\'login\')">登录并继续</button>' +
    '<button class="btn" onclick="remoteAuthSubmit(\'register\')">注册并继续</button></div>');
}

async function remoteAuthSubmit(mode) {
  const name = ($id('cloud-auth-name') || {}).value || '';
  const password = ($id('cloud-auth-pass') || {}).value || '';
  const msg = $id('cloud-auth-msg');
  if (!name.trim() || !password) { if (msg) msg.textContent = '请填写昵称和密码'; return; }
  try {
    const d = await remoteApi('POST', mode === 'register' ? '/api/register' : '/api/login', { name: name.trim(), password: password });
    REMOTE.token = d.token; REMOTE.name = d.player.name; remoteSaveCfg();
    const action = REMOTE.pendingCloudAction; REMOTE.pendingCloudAction = null;
    closeModal();
    if (action === 'upload') { exportSave(); remoteUploadCloudSave(); }
    else if (action === 'download') { showImportSave(); remoteDownloadCloudSave(); }
  } catch (e) {
    if (msg) msg.textContent = (mode === 'register' ? '注册失败：' : '登录失败：') + e.message;
  }
}

// ---------------- 屏幕切换 ----------------

function remoteOpenLobby() {
  remoteStopPoll();
  REMOTE.prevScreen = (STATE.screen === 'map' || STATE.screen === 'battle') ? STATE.screen : 'title';
  REMOTE.roomId = null;
  REMOTE.mode = 'room';
  REMOTE.handshakeRequestId = '';
  REMOTE.handshakeSentRoomId = '';
  REMOTE.matchingFailures = 0;
  REMOTE.seen = 0;
  REMOTE.lastView = null;
  REMOTE.battleOpen = false;
  STATE.screen = 'remote';
  remoteRestoreDraftLocal();
  render();
  if (REMOTE.token) remoteRecoverMatch();
}

function remoteSourceFingerprint() {
  const party = (STATE.party || []).slice(0, 4).map(function (m) {
    return { uid: m.uid, species: m.species, level: m.level, nature: m.nature, ivs: m.ivs,
      moves: m.moves, held: m.held || null, candyBonus: m.candyBonus || {} };
  });
  return JSON.stringify({ party: party, equippedTitle: STATE.equippedTitle || null });
}

function remoteSaveDraftLocal() {
  if (!REMOTE.pvpDraft) return;
  localStorage.setItem('bkm_pvp_draft_v1', JSON.stringify({
    draft: REMOTE.pvpDraft, confirmed: REMOTE.pvpDraftConfirmed,
    sourceFingerprint: REMOTE.pvpDraftSourceFingerprint || remoteSourceFingerprint()
  }));
}

function remoteRestoreDraftLocal() {
  try {
    const raw = localStorage.getItem('bkm_pvp_draft_v1');
    const saved = raw ? JSON.parse(raw) : null;
    if (!saved || !Array.isArray(saved.draft) || !saved.draft.length) return false;
    if (saved.sourceFingerprint && saved.sourceFingerprint !== remoteSourceFingerprint()) {
      const draft = remoteDraftFromSingle();
      REMOTE.pvpDraft = draft.length ? draft : null;
      REMOTE.pvpDraftConfirmed = false;
      REMOTE.pvpDraftSourceFingerprint = draft.length ? remoteSourceFingerprint() : '';
      remoteSaveDraftLocal();
    } else {
      REMOTE.pvpDraft = saved.draft.slice(0, 4);
      REMOTE.pvpDraftConfirmed = !!saved.confirmed;
      REMOTE.pvpDraftSourceFingerprint = saved.sourceFingerprint || remoteSourceFingerprint();
    }
    return !!REMOTE.pvpDraft;
  } catch (e) {
    console.warn('[remote] 恢复本地 PvP 配置失败', e);
    return false;
  }
}

function remoteEnterRoom(roomId, handshake) {
  REMOTE.roomId = roomId;
  REMOTE.seen = 0;
  REMOTE.side = null;
  REMOTE.battleOpen = false;
  REMOTE.mode = handshake ? 'handshake' : 'room';
  REMOTE.handshakeRequestId = '';
  REMOTE.handshakeSentRoomId = '';
  REMOTE.matchingFailures = 0;
  remoteStartPoll();
}

async function remoteRecoverMatch() {
  try {
    const d = await remoteApi('GET', '/api/queue/status');
    if (d.room_id) {
      remoteEnterRoom(d.room_id, !!d.handshake);
      remoteMsg(d.handshake ? '正在恢复匹配连接……' : '✅ 已恢复进行中的对战');
      return true;
    }
    if (d.queued) {
      REMOTE.mode = 'queue';
      REMOTE.matchingFailures = 0;
      remoteMsg('已恢复匹配队列，等待对手……');
      render();
      remoteStartPoll();
      return true;
    }
  } catch (e) {
    console.warn('[remote] 恢复对战状态失败', e);
  }
  return false;
}

function remoteClose() {
  if (REMOTE.mode === 'queue' || REMOTE.mode === 'handshake') {
    remoteCancelMatching(false).then(function () {
      remoteCloseSwitchPrompt();
      STATE.screen = REMOTE.prevScreen === 'battle' ? 'map' : REMOTE.prevScreen;
      if (STATE.screen === 'map' && STATE.battle) STATE.screen = 'battle';
      render();
    });
    return;
  }
  remoteStopPoll();
  remoteCloseSwitchPrompt();
  REMOTE.roomId = null;
  REMOTE.battleOpen = false;
  STATE.screen = REMOTE.prevScreen === 'battle' ? 'map' : REMOTE.prevScreen;
  if (STATE.screen === 'map' && STATE.battle) STATE.screen = 'battle';
  render();
}

function remoteBackToLobby() {
  remoteStopPoll();
  remoteCloseSwitchPrompt();
  REMOTE.roomId = null;
  REMOTE.seen = 0;
  REMOTE.lastView = null;
  REMOTE.battleOpen = false;
  render();
}

async function remoteCancelMatching(returnToLobby) {
  const mode = REMOTE.mode;
  const roomId = REMOTE.roomId;
  remoteStopPoll();
  try {
    if (mode === 'handshake' && roomId) {
      await remoteApi('POST', '/api/rooms/' + roomId + '/leave', {});
    } else if (mode === 'queue') {
      await remoteApi('POST', '/api/queue/leave', {});
    }
  } catch (e) {
    // 服务器已清理握手房间时，客户端仍应回到可重新匹配状态。
    console.warn('[remote] 取消匹配清理失败', e);
  }
  REMOTE.mode = 'room';
  REMOTE.roomId = null;
  REMOTE.seen = 0;
  REMOTE.handshakeRequestId = '';
  REMOTE.handshakeSentRoomId = '';
  REMOTE.battleOpen = false;
  if (returnToLobby === false) return;
  render();
  remoteMsg('已取消匹配');
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
  const guest = logged && REMOTE.guest;
  const draft = REMOTE.pvpDraft || [];
  const draftHtml = logged ? remoteDraftHtml(draft) : '';
  el.innerHTML =
    '<div class="remote-panel pixel-frame">' +
    '<div class="sec-title">—— 联机对战 · bkmserver ——</div>' +
    '<div class="remote-row"><span class="remote-label">服务器</span>' +
    '<input id="rb-server" type="text" value="' + esc(REMOTE.server) + '" oninput="REMOTE.server=this.value.trim();remoteSaveCfg()">' +
    '<button class="btn btn-sm" onclick="remoteTest()">测试</button></div>' +
    (logged ?
      '<div class="remote-row"><span class="remote-label">玩家</span><span>' + esc(REMOTE.name) + (guest ? '（PvP游客）' : '（已登录）') + '</span>' +
      '<button class="btn btn-sm" onclick="remoteLogout()">退出</button></div>' :
      '<div class="remote-row"><span class="remote-label">昵称</span><input id="rb-name" type="text" maxlength="12" placeholder="2-12 字符" value="' + esc(REMOTE.name || '') + '">' +
      '<button class="btn btn-primary" onclick="remoteGuestEnter()">进入 PvP 广场</button></div>' +
      '<div class="remote-hint">PvP 无需注册和密码，昵称就是你的对战 UID。</div>') +
    (logged ? '<div class="remote-actions"><button class="btn" onclick="remoteLoadDraftFromSingle()">🧳 读取单机队伍</button>' +
    (guest ? '' : '<button class="btn" onclick="remoteUploadCloudSave()">☁️ 上传云存档</button>' +
    '<button class="btn" onclick="remoteDownloadCloudSave()">☁️ 下载云存档</button>') + '</div>' : '') +
    draftHtml +
    '<div class="remote-row" style="margin-top:8px"><span class="remote-label">房间码</span>' +
    '<input id="rb-code" type="text" placeholder="6 位房间码">' +
    '<button class="btn btn-sm" onclick="remoteJoin()">加入</button></div>' +
    '<div class="remote-actions">' +
    ((REMOTE.mode === 'queue' || REMOTE.mode === 'handshake') ?
      '<button class="btn btn-primary" onclick="remoteCancelMatching()">✖ 取消匹配</button>' :
      '<button class="btn btn-primary" onclick="remoteCreate()" ' + (REMOTE.pvpDraftConfirmed ? '' : 'disabled') + '>🏠 创建房间</button>' +
      '<button class="btn" onclick="remoteQuick()" ' + (REMOTE.pvpDraftConfirmed ? '' : 'disabled') + '>⚡ 快速匹配</button>') +
    '</div>' +
    '<div id="remote-msg" class="remote-msg"></div>' +
    '<div class="remote-hint">提示：先培养好单机队伍，再点击“上传当前队伍”。</div>' +
    '<div class="remote-hint">PvP规则：对战时队伍统一为 Lv100，HP×2；单机存档不会被修改。</div>' +
    '<div class="remote-actions"><button class="btn" onclick="remoteClose()">← 返回</button></div>' +
    '</div>';
}

function remoteDraftHtml(draft) {
  if (!draft.length) return '<div class="remote-hint">PvP准备广场：先读取单机队伍，再调整首发、招式和携带物。这里的调整只存在于本次联机准备，不会改动单机存档。</div>';
  let rows = draft.map(function (m, i) {
    const name = POKEDEX[m.species] ? POKEDEX[m.species].name : ('No.' + m.species);
    const moves = (m.moves || []).map(function (id) { return MOVES[id] ? MOVES[id].name : id; }).join('、') || '无';
    return '<div class="remote-draft-row"><span>' + (i === 0 ? '⭐ ' : '') + esc(name) + ' 单机 Lv' + m.level + ' → PvP Lv100' + (i === 0 ? '（首发）' : '') + '</span>' +
      '<small>技能：' + esc(moves) + '　携带：' + esc(m.held || '无') + '</small>' +
      '<span><button class="btn btn-sm" onclick="remoteMoveDraft(' + i + ',-1)">↑</button>' +
      '<button class="btn btn-sm" onclick="remoteMoveDraft(' + i + ',1)">↓</button>' +
      '<button class="btn btn-sm" onclick="remoteShowDraftDetail(' + i + ')">详情</button>' +
      '<button class="btn btn-sm" onclick="remoteEditDraftMoves(' + i + ')">技能</button>' +
      '<button class="btn btn-sm" onclick="remoteEditDraftHeld(' + i + ')">携带物</button></span></div>';
  }).join('');
  return '<div class="remote-prep pixel-frame"><div class="sec-title">—— PvP 准备广场 ——</div>' +
    '<div class="remote-hint">调整完成后确认上传；对战属性按 Lv100 计算，HP×2。对战只使用这份临时队伍，不写入单机存档。</div>' + rows +
    '<div class="remote-actions"><button class="btn btn-primary" onclick="remoteUploadTeam()">' + (REMOTE.pvpDraftConfirmed ? '✅ 已确认上传（可重新上传）' : '📤 确认上传 PvP 队伍') + '</button>' +
    '<button class="btn" onclick="remoteLoadDraftFromSingle()">重新读取单机队伍</button></div></div>';
}

function remoteShowDraftDetail(index) {
  const m = REMOTE.pvpDraft && REMOTE.pvpDraft[index];
  if (!m || !POKEDEX[m.species]) return;
  const d = POKEDEX[m.species];
  const nature = NATURES[m.nature] || NATURES['勤奋'];
  const ivs = m.ivs || {};
  const candy = m.candyBonus || {};
  const titleBonus = typeof equippedTitleBonus === 'function' ? equippedTitleBonus() : {};
  const statNames = { hp: 'HP', atk: '攻击', def: '防御', spa: '特攻', spd: '特防', spe: '速度' };
  const baseStats = {};
  const stats = {};
  baseStats.hp = Math.floor((2 * d.base.hp + (ivs.hp || 0)) * 100 / 100) + 110;
  ['atk', 'def', 'spa', 'spd', 'spe'].forEach(function (k) {
    baseStats[k] = Math.floor((2 * d.base[k] + (ivs[k] || 0) + 5) * nature[k]);
    stats[k] = baseStats[k] + (candy[k] || 0) + (titleBonus[k] || 0);
  });
  stats.hp = (baseStats.hp + (candy.hp || 0)) * 5;
  let statsHtml = '';
  Object.keys(statNames).forEach(function (k) {
    const candyMax = candy[k] >= 15 || (candy.total || 0) >= 50;
    const candyHtml = candy[k] ? ' <span class="candy-bonus">(+' + candy[k] + ')</span>' : '';
    const titleHtml = titleBonus[k] ? ' <small class="move-effect">（称号 +' + titleBonus[k] + '）</small>' : '';
    statsHtml += '<div class="detail-row"><span>' + statNames[k] + '</span><span>' + stats[k] +
      '（个体 ' + (ivs[k] === undefined ? '?' : ivs[k]) + '）' + candyHtml + titleHtml + (candyMax ? ' <span class="candy-max">[MAX]</span>' : '') +
      (k === 'hp' ? ' <small class="move-effect">PvP HP×2</small>' : '') + '</span></div>';
  });
  let movesHtml = '';
  (m.moves || []).forEach(function (id) {
    const mv = MOVES[id]; if (!mv) return;
    movesHtml += '<div class="detail-row"><span class="mv-name" style="color:' + typeColor(mv.type) + '">' + esc(mv.name) + ' · ' + esc(mv.type) + '</span><span>' +
      mv.category + (mv.power > 0 ? ' · 威力 ' + mv.power : '') + ' · ' + (mv.acc === 0 ? '必中' : '命中 ' + mv.acc) + ' · PP ' + mv.pp +
      (moveEffectText(mv) ? '<br><small class="move-effect">' + moveEffectText(mv) + '</small>' : '') + '</span></div>';
  });
  openModal((d.name || '宝可梦') + ' · PvP详情',
    '<div class="detail-lv">单机 Lv.' + m.level + ' → PvP Lv.100 · ' + d.types.join('/') + '</div>' +
    '<div class="shop-hint">性格：' + esc(m.nature || '勤奋') + '　携带：' + esc(m.held || '无') + '</div>' +
    '<div class="shop-hint">称号加成：' + (Object.keys(titleBonus).filter(function (k) { return titleBonus[k] > 0; }).map(function (k) { return (STAT_NAME[k] || k) + '+' + titleBonus[k]; }).join('、') || '无') + '</div>' +
    '<div class="shop-hint">—— PvP能力值 ——</div>' + statsHtml +
    '<div class="shop-hint">—— PvP招式 ——</div>' + (movesHtml || '<div class="shop-hint">暂无招式</div>') +
    '<div class="modal-btns"><button class="btn" onclick="closeModal()">返回准备广场</button></div>');
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
    REMOTE.guest = !!d.player.guest;
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
    REMOTE.guest = !!d.player.guest;
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
  REMOTE.guest = false;
  remoteSaveCfg();
  render();
}

async function remoteGuestEnter() {
  const name = (($id('rb-name') || {}).value || '').trim();
  if (!name) { remoteMsg('请输入昵称', true); return; }
  try {
    const d = await remoteApi('POST', '/api/guest', { name: name });
    REMOTE.token = d.token;
    REMOTE.name = d.player.name;
    REMOTE.guest = true;
    remoteSaveCfg();
    render();
    remoteMsg('✅ 已进入 PvP 广场：' + REMOTE.name);
  } catch (e) {
    remoteMsg('进入 PvP 广场失败：' + e.message, true);
  }
}

// ---------------- 队伍导出 ----------------

function remoteBuildTeam() {
  const party = (STATE.party || []).slice(0, 4);
  if (party.length === 0) return null;
  const team = party.map(function (m) {
    const e = {
      species: m.species,
      level: m.level,
      nature: m.nature,
      ivs: m.ivs || undefined,
      candyBonus: m.candyBonus || undefined,
      moves: (m.moves || []).slice(0, 4)
    };
    if (m.held) e.held = m.held;
    return e;
  });
  const items = {};
  REMOTE_BATTLE_ITEMS.forEach(function (k) {
    if (STATE.bag && STATE.bag[k] > 0) items[k] = Math.min(9, STATE.bag[k]);
  });
  return { team: team, items: items, titleBonus: typeof equippedTitleBonus === 'function' ? equippedTitleBonus() : {} };
}

function remoteDraftFromSingle() {
  return (STATE.party || []).slice(0, 4).map(function (m, i) {
    return { sourceUid: m.uid || null, sourceIndex: i, species: m.species, level: m.level,
      nature: m.nature, ivs: m.ivs || undefined, candyBonus: m.candyBonus || {}, moves: (m.moves || []).slice(0, 4), held: m.held || null };
  });
}

function remoteDraftPayload() {
  const team = (REMOTE.pvpDraft || []).map(function (m) {
    const e = { species: m.species, level: m.level, nature: m.nature, ivs: m.ivs || undefined,
      candyBonus: m.candyBonus || undefined, moves: (m.moves || []).slice(0, 4) };
    if (m.held) e.held = m.held;
    return e;
  });
  const items = {};
  REMOTE_BATTLE_ITEMS.forEach(function (k) { if (STATE.bag && STATE.bag[k] > 0) items[k] = Math.min(9, STATE.bag[k]); });
  return { team: team, items: items, titleBonus: typeof equippedTitleBonus === 'function' ? equippedTitleBonus() : {} };
}

function remoteLoadDraftFromSingle() {
  const draft = remoteDraftFromSingle();
  if (!draft.length) { remoteMsg('当前单机队伍为空，请先培养宝可梦', true); return; }
  const currentFingerprint = remoteSourceFingerprint();
  const savedDraft = REMOTE.pvpDraft;
  const savedFingerprint = REMOTE.pvpDraftSourceFingerprint;
  if (savedDraft && savedDraft.length && savedFingerprint === currentFingerprint) {
    REMOTE.pvpDraft = savedDraft.slice(0, 4);
    REMOTE.pvpDraftSourceFingerprint = currentFingerprint;
  } else {
    REMOTE.pvpDraft = draft;
    REMOTE.pvpDraftConfirmed = false;
    REMOTE.pvpDraftSourceFingerprint = currentFingerprint;
  }
  remoteSaveDraftLocal();
  render(); remoteMsg(savedDraft && savedFingerprint === currentFingerprint ? '单机队伍未变化，已保留 PvP 技能与首发顺序；单机存档未改变' : '单机队伍已变化，已载入当前前四只；单机存档未改变');
}

function remoteMoveDraft(index, direction) {
  const next = index + direction;
  if (!REMOTE.pvpDraft || next < 0 || next >= REMOTE.pvpDraft.length) return;
  const tmp = REMOTE.pvpDraft[index]; REMOTE.pvpDraft[index] = REMOTE.pvpDraft[next]; REMOTE.pvpDraft[next] = tmp;
  REMOTE.pvpDraftConfirmed = false; remoteSaveDraftLocal(); render();
}

function remoteEditDraftMoves(index) {
  const m = REMOTE.pvpDraft && REMOTE.pvpDraft[index]; if (!m) return;
  const source = (STATE.party || []).find(function (x) { return m.sourceUid && x.uid === m.sourceUid; }) || STATE.party[m.sourceIndex];
  const speciesData = POKEDEX[m.species] || (source && source.speciesData);
  const pvpLearnable = speciesData ? Object.keys(speciesData.learnset || {}).reduce(function (all, lv) {
    if (+lv <= 100) all.push.apply(all, speciesData.learnset[lv] || []);
    return all;
  }, []) : [];
  const ids = (m.moves || []).concat(pvpLearnable).filter(function (id, i, a) { return MOVES[id] && a.indexOf(id) === i; });
  // 空栏也必须可以选中，方便 PvP 广场把不足 4 招的队伍补齐。
  if (REMOTE.pvpMoveSlot < 0 || REMOTE.pvpMoveSlot > 3) REMOTE.pvpMoveSlot = 0;
  const slots = [0, 1, 2, 3].map(function (slot) {
    const mv = MOVES[m.moves[slot]];
    return '<button class="btn btn-sm slot-btn' + (REMOTE.pvpMoveSlot === slot ? ' active' : '') + '" onclick="remotePickMoveSlot(' + index + ',' + slot + ')">' +
      '<span class="slot-no">' + (slot + 1) + '. </span><span class="mv-name" style="--mv-tc:' + (mv ? typeColor(mv.type) : 'inherit') + '">' +
      (mv ? esc(mv.name) : '空栏') + '</span></button>';
  }).join('');
  const candidates = ids.map(function (id) {
    const mv = MOVES[id];
    return '<button class="btn btn-sm move-btn" style="--tc:' + typeColor(mv.type) + '" onclick="remoteSetDraftMove(' + index + ',' + REMOTE.pvpMoveSlot + ',\'' + esc(id) + '\')">' +
      '<span class="tag-learn">' + (m.moves.indexOf(id) !== -1 ? '已学会' : '可调整') + '</span>' + esc(mv.name) +
      '<span class="move-type">' + (mv.category === '物理' ? '物攻' : (mv.category === '特殊' ? '特攻' : '变化')) + ' · ' + esc(mv.type) + '</span>' +
      '<span class="move-eff">' + mv.category + (mv.power > 0 ? ' · 威力 ' + mv.power : '') + ' · ' + (mv.acc === 0 ? '必中' : '命中 ' + mv.acc) + ' · PP ' + mv.pp + '</span>' +
      (moveEffectText(mv) ? '<span class="move-effect">' + moveEffectText(mv) + '</span>' : '') + '</button>';
  }).join('');
  openModal('调整招式 · ' + (POKEDEX[m.species] ? POKEDEX[m.species].name : '?'),
    '<div class="remote-hint">选择上方栏位，再点击下方技能。PvP调整免费，只作用于临时队伍。</div>' +
    '<div class="bag-tabs">' + slots + '</div>' +
    '<div class="shop-hint">—— PvP Lv100 可用招式（不受单机当前等级限制） ——</div>' + (candidates || '<div class="shop-hint">没有可用招式</div>'));
}

function remotePickMoveSlot(index, slot) {
  REMOTE.pvpMoveSlot = slot;
  remoteEditDraftMoves(index);
}

function remoteSetDraftMove(index, slot, moveId) {
  const m = REMOTE.pvpDraft[index];
  if (!m || !MOVES[moveId]) return;
  if (m.moves.indexOf(moveId) !== -1 && m.moves[slot] !== moveId) { remoteMsg('同一只宝可梦不能重复携带同一招式', true); return; }
  m.moves[slot] = moveId; REMOTE.pvpDraftConfirmed = false; remoteSaveDraftLocal(); closeModal(); render();
}

function remoteEditDraftHeld(index) {
  const m = REMOTE.pvpDraft[index]; if (!m) return;
  const choices = [''].concat(Object.keys(ITEMS).filter(function (name) { return ITEMS[name].type === 'held' && STATE.bag && STATE.bag[name] > 0; }));
  openModal('调整携带物', choices.map(function (name) { return '<button class="btn" style="width:100%;margin:3px 0" onclick="remoteSetDraftHeld(' + index + ',\'' + esc(name) + '\')">' + esc(name || '不携带') + '</button>'; }).join(''));
}

function remoteSetDraftHeld(index, held) {
  if (REMOTE.pvpDraft[index]) REMOTE.pvpDraft[index].held = held || null;
  REMOTE.pvpDraftConfirmed = false; remoteSaveDraftLocal(); closeModal(); render();
}

async function remoteUploadTeam() {
  if (!REMOTE.token) { remoteMsg('请先登录', true); return; }
  if (!REMOTE.pvpDraft) remoteLoadDraftFromSingle();
  const payload = remoteDraftPayload();
  if (!payload) { remoteMsg('当前队伍为空，请先培养宝可梦', true); return; }
  try {
    const d = await remoteApi('PUT', '/api/me/team', payload);
    REMOTE.pvpDraftConfirmed = true;
    REMOTE.pvpDraftSourceFingerprint = remoteSourceFingerprint();
    remoteSaveDraftLocal();
    render();
    remoteMsg('✅ PvP队伍已确认上传：' + d.mons.map(function (m) { return m.name + ' Lv' + m.level; }).join('、'));
  } catch (e) {
    console.error('[remote] 上传队伍失败', e);
    remoteMsg('队伍上传失败：' + e.message, true);
  }
}

async function remoteUploadCloudSave() {
  if (!REMOTE.token) { remoteOpenAuthModal('upload'); return; }
  const raw = localStorage.getItem('bkm_poke_save_v1');
  if (!raw) { remoteMsg('当前还没有单机存档', true); return; }
  let data; try { data = JSON.parse(raw); } catch (e) { remoteMsg('本机存档损坏，无法上传', true); return; }
  if (!data || data.version !== GAME_VERSION) { remoteMsg('本机存档版本不匹配，请先在游戏内加载存档', true); return; }
  try {
    remoteMsg('☁️ 正在上传云存档，请勿关闭页面（大存档最多等待 120 秒）');
    const meta = await remoteApi('PUT', '/api/me/save', { save: data }, 120000);
    remoteMsg('✅ 云存档上传成功（' + meta.size + ' 字节）');
  }
  catch (e) { remoteMsg('云存档上传失败：' + e.message, true); }
}

async function remoteDownloadCloudSave() {
  if (!REMOTE.token) { remoteOpenAuthModal('download'); return; }
  try {
    remoteMsg('☁️ 正在下载云存档，请勿关闭页面（大存档最多等待 120 秒）');
    const data = await remoteApi('GET', '/api/me/save', undefined, 120000);
    if (!data || !data.save || data.save.version !== GAME_VERSION) throw new Error('云存档版本不匹配');
    if (!confirm('下载云存档会覆盖当前浏览器里的单机存档，确定继续吗？')) return;
    const fromSaveModal = !!$id('save-cloud-msg');
    localStorage.setItem('bkm_poke_save_v1', JSON.stringify(data.save));
    load(); closeModal(); render();
    if (fromSaveModal) alert('✅ 云存档已下载并加载；PvP准备队伍仍保持独立');
    else remoteMsg('✅ 云存档已下载并加载；PvP准备队伍仍保持独立');
  } catch (e) { remoteMsg('云存档下载失败：' + e.message, true); }
}

// ---------------- 房间 / 匹配 ----------------

async function remoteCreate() {
  if (!REMOTE.token) { remoteMsg('请先登录', true); return; }
  try {
    const d = await remoteApi('POST', '/api/rooms', {});
    REMOTE.lastView = d;
    remoteEnterRoom(d.id);
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
    REMOTE.lastView = d;
    remoteEnterRoom(d.id);
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
      REMOTE.matchingFailures = 0;
      remoteMsg('已进入匹配队列（第 ' + d.position + ' 位），等待对手……');
      render();
      remoteStartPoll();
    } else {
      remoteEnterRoom(d.room_id, !!d.handshake);
      remoteMsg(d.handshake ? '已找到对手，正在确认连接……' : '✅ 匹配成功，对战开始！');
      render();
    }
  } catch (e) {
    const m = e.message || '';
    if (m.indexOf('已在匹配队列') !== -1) {
      remoteMsg('同一账号不能和自己匹配：请用另一个账号（新开一个标签页/窗口注册）作为对手', true);
    } else if (m.indexOf('对局进行中') !== -1) {
      if (!(await remoteRecoverMatch())) remoteMsg('检测到已有对局，但暂时无法恢复，请刷新页面后重试', true);
    } else {
      remoteMsg('匹配失败：' + m, true);
    }
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
  if (REMOTE.busy) return;
  // 排队状态下 roomId 为空，需要继续轮询队列状态，不能提前退出
  if (REMOTE.mode !== 'queue' && !REMOTE.roomId) return;
  REMOTE.busy = true;
  try {
    if (REMOTE.mode === 'queue') {
      const d = await remoteApi('GET', '/api/queue/status');
      if (d.room_id) {
        remoteEnterRoom(d.room_id, !!d.handshake);
        remoteMsg(d.handshake ? '已找到对手，正在确认连接……' : '✅ 匹配成功，对战开始！');
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
    if (view.state === 'pending_handshake') {
      await remoteSendHandshake(view);
      if (REMOTE.lastView && REMOTE.lastView.state === 'battle') {
        REMOTE.battleOpen = true;
        render();
      } else if (!REMOTE.battleOpen) {
        REMOTE.battleOpen = true;
        render();
      } else {
        remoteRenderHandshake(view);
      }
      return;
    }
    if (view.state === 'battle') {
      REMOTE.mode = 'room';
      REMOTE.handshakeRequestId = '';
      REMOTE.handshakeSentRoomId = '';
    }
    if (!REMOTE.battleOpen) {
      REMOTE.battleOpen = true;
      render();
    } else {
      remoteRenderView(view);
    }
    if (view.battle && view.battle.over) remoteStopPoll();
  } catch (e) {
    if (REMOTE.mode === 'handshake') {
      REMOTE.matchingFailures++;
      if (REMOTE.matchingFailures >= 3) {
        remoteStopPoll();
        REMOTE.mode = 'room';
        REMOTE.roomId = null;
        render();
        remoteMsg('多次连接对手失败，请检查网络后重试', true);
      } else if (await remoteRecoverMatch()) {
        remoteMsg('对手连接超时，正在重新匹配……');
      } else {
        remoteStopPoll();
        REMOTE.mode = 'room';
        REMOTE.roomId = null;
        render();
        remoteMsg('对手连接超时，请重新点击「快速匹配」', true);
      }
    } else {
      remoteMsg('连接出错：' + e.message, true);
      remoteStopPoll();
    }
  } finally {
    REMOTE.busy = false;
  }
}

async function remoteSendHandshake(view) {
  const handshake = view && view.handshake;
  if (!handshake || !handshake.request_id) return;
  REMOTE.handshakeRequestId = handshake.request_id;
  if (REMOTE.handshakeSentRoomId === view.id) return;
  REMOTE.handshakeSentRoomId = view.id;
  remoteMsg('正在连接对手……');
  try {
    const readyView = await remoteApi('POST', '/api/rooms/' + view.id + '/ready', {
      request_id: handshake.request_id,
      status: 'online'
    });
    if (readyView && readyView.state === 'battle') {
      REMOTE.mode = 'room';
      REMOTE.lastView = readyView;
    }
  } catch (e) {
    REMOTE.handshakeSentRoomId = '';
    throw e;
  }
}

// ---------------- 对战渲染 ----------------

function remoteRenderView(view) {
  if (!view || !view.id) return;
  const battle = $id('remote-battle');
  if (view.state === 'pending_handshake') {
    remoteRenderHandshake(view);
    return;
  }
  if (view.battle) {
    if (!battle.dataset.built) {
      remoteBattleShell();
      battle.dataset.built = '1';
    }
    remoteRenderBattle(view);
  } else {
    remoteCloseSwitchPrompt();
    battle.dataset.built = '';
    remoteRenderWaiting(view);
  }
}

function remoteRenderHandshake(view) {
  const el = $id('remote-battle');
  if (!el) return;
  const expires = view.handshake && view.handshake.expires_at;
  const remain = expires ? Math.max(0, Math.ceil(expires - Date.now() / 1000)) : 15;
  el.innerHTML =
    '<div class="remote-panel pixel-frame">' +
    '<div class="sec-title">—— 正在连接对手 ——</div>' +
    '<div class="remote-msg">已找到对手，正在确认双方在线……</div>' +
    '<div class="remote-hint">握手窗口剩余约 ' + remain + ' 秒；无需手动确认。</div>' +
    '<div class="remote-actions"><button class="btn btn-primary" onclick="remoteCancelMatching()">✖ 取消匹配</button></div>' +
    '</div>';
}

function remoteBattleShell() {
  const el = $id('remote-battle');
  el.innerHTML =
    '<div class="remote-panel pixel-frame" style="width:100%">' +
    '<div class="sec-title" id="rb-title">—— 联机对战 ——</div>' +
    '<div id="rb-status" class="meta-line"></div>' +
    '<div class="rb-arena"><div id="rb-fx-layer" class="rb-fx-layer" aria-hidden="true"></div>' +
    '<div id="rb-foe"></div>' +
    '<div class="vs-divider">▼ 对战 ▼</div>' +
    '<div id="rb-player"></div></div>' +
    '<div id="rb-log" class="log-box small"></div>' +
    '<div id="rb-msg" class="remote-msg"></div>' +
    '<div id="rb-actions"></div>' +
    '<div class="remote-actions" style="margin-top:8px">' +
    '<button class="btn btn-sm" onclick="remoteForfeit()">🏳️ 认输</button>' +
    '<button class="btn btn-sm" onclick="remoteBackToLobby()">← 返回大厅</button>' +
    '</div>' +
    '</div>';
}

// PvP 专用招式反馈；单机战斗的日志播放不调用这里。
function remotePlayMoveFx(line, kind) {
  const match = String(line || '').match(/使用了【([^】]+)】/);
  if (!match) return;
  const ids = Object.keys(MOVES);
  let move = null;
  for (let i = 0; i < ids.length; i++) {
    if (MOVES[ids[i]] && MOVES[ids[i]].name === match[1]) { move = MOVES[ids[i]]; break; }
  }
  const layer = $id('rb-fx-layer');
  if (!move || !layer) return;
  const attacker = kind === 'foe' ? 'foe' : 'player';
  const target = attacker === 'foe' ? 'player' : 'foe';
  const fx = document.createElement('div');
  fx.className = 'rb-fx type-' + move.type + ' target-' + target;
  layer.appendChild(fx);
  const host = $id('rb-' + target);
  const card = host && host.querySelector('.battle-card');
  if (card) {
    card.classList.remove('rb-card-fx-hit');
    void card.offsetWidth;
    card.classList.add('rb-card-fx-hit');
  }
  setTimeout(function () { if (fx.parentNode) fx.parentNode.removeChild(fx); }, 500);
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
  return '<div class="battle-card ' + side + ' pixel-frame" data-battle-uid="' + esc(data.uid || '') + '" data-battle-status="' + esc(data.status || '') + '">' +
    '<div class="battle-icon" id="rb-icon-' + side + '"></div>' +
    '<div class="battle-info"><div class="battle-name">' + rarityTag(fake) + esc(data.name) + ' ' + statusIcon(data.status) + '</div>' +
    '<div class="battle-lv">Lv.' + data.level + ' · ' + (d.types || []).join('/') + (data.held ? ' · &lt;' + esc(data.held) + '&gt;' : '') + '</div>' +
    hpBar(fake) + '</div></div>';
}

// PvP 轮询每 900ms 刷新一次：同一只宝可梦只更新 HP，UID 变化才替换整张卡片。
// 这样伤害/回复走 CSS 缓动，死亡换人时不会把旧血量套到新宝可梦。
function remoteUpdateCard(side, data) {
  const host = $id('rb-' + side);
  if (!host || !data) return;
  const old = host.querySelector('.battle-card');
  const uid = String(data.uid || '');
  if (!old || old.getAttribute('data-battle-uid') !== uid) {
    host.innerHTML = remoteCard(side, data);
    const icon = $id('rb-icon-' + side);
    if (icon) icon.appendChild(monIcon(data.species, 48, false));
    return;
  }
  if (old.getAttribute('data-battle-status') !== String(data.status || '')) {
    const d = POKEDEX[data.species] || {};
    const fake = { hp: data.hp, stats: { hp: data.max }, species: data.species };
    const name = old.querySelector('.battle-name');
    if (name) name.innerHTML = rarityTag(fake) + esc(data.name) + ' ' + statusIcon(data.status);
    old.setAttribute('data-battle-status', data.status || '');
  }
  const fill = host.querySelector('.hpbar-fill');
  const text = host.querySelector('.hp-text');
  const max = Math.max(1, data.max || 1);
  const hp = Math.max(0, data.hp || 0);
  const pct = Math.max(0, Math.round(hp / max * 100));
  if (fill) {
    fill.style.transitionDuration = '700ms';
    fill.style.width = pct + '%';
    fill.style.background = pct > 50 ? 'var(--hp)' : (pct > 20 ? 'var(--gold)' : 'var(--red)');
  }
  if (text) text.textContent = 'HP ' + hp + '/' + max;
}

// PvP 日志专用：把涉及宝可梦的名字标成「玩家(宝可梦)」。单机日志不经过这里。
function remoteFormatEventText(view, event) {
  let text = String(event && event.text || '');
  const b = view && view.battle || {};
  const players = view && view.players || {};
  const labels = {};
  const parties = b.parties || {};

  Object.keys(parties).forEach(function (side) {
    const player = players[side] && players[side].name;
    if (!player) return;
    (parties[side] || []).forEach(function (mon) {
      if (mon && mon.name) labels[mon.name] = player + '(' + mon.name + ')';
    });
  });

  // 服务端的出招日志使用玩家名，结合事件归属补上当前出战宝可梦。
  const actorSide = event && event.kind === 'a' ? 'A' : (event && event.kind === 'b' ? 'B' : '');
  const actor = actorSide && b.actives && b.actives[actorSide];
  const actorPlayer = actorSide && players[actorSide] && players[actorSide].name;
  if (actor && actorPlayer && text.indexOf(actorPlayer) === 0 && text.indexOf('使用了【') !== -1) {
    text = actorPlayer + '(' + actor.name + ')' + text.slice(actorPlayer.length);
  }

  // 先替换宝可梦名，避免把刚生成的「玩家(宝可梦)」再次套一层。
  Object.keys(labels).sort(function (a, b) { return b.length - a.length; }).forEach(function (monName) {
    const label = labels[monName];
    if (text.indexOf(monName) === -1 || text.indexOf(label) !== -1) return;
    text = text.split(monName).join(label);
  });
  return text;
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
  remoteUpdateCard('foe', b.actives[foe]);
  remoteUpdateCard('player', b.actives[my]);

  // 事件日志（增量追加）
  const log = $id('rb-log');
  (view.events || []).forEach(function (e) {
    if (e.seq <= REMOTE.seen) return;
    REMOTE.seen = e.seq;
    const kind = e.kind === 'a' ? (my === 'A' ? 'player' : 'foe') :
      (e.kind === 'b' ? (my === 'B' ? 'player' : 'foe') : e.kind);
    const div = document.createElement('div');
    div.className = 'log-line' + (kind ? ' log-' + kind : '');
    div.textContent = remoteFormatEventText(view, e);
    log.appendChild(div);
    remotePlayMoveFx(e.text, kind);
    log.scrollTop = log.scrollHeight;
  });

  $id('rb-actions').innerHTML = remoteActions(view, my, foe);
  remoteSyncSwitchPrompt(view, my);
  if (b.over) {
    $id('rb-status').textContent = (view.winner ? (names[view.winner] ? names[view.winner].name : view.winner) + ' 获胜' : '平局') + '（' + view.result + '）';
    $id('rb-actions').innerHTML =
      '<div class="turn-hint">对局结束</div>' +
      '<div class="remote-actions" style="grid-column:1/-1"><button class="btn" onclick="remoteBackToLobby()">← 返回大厅</button></div>';
    remoteCloseSwitchPrompt();
  }
}

function remoteActions(view, my, foe) {
  const b = view.battle;
  const myMon = b.actives[my];
  const foeTypes = (POKEDEX[b.actives[foe].species] || {}).types || [];
  let html = '';
  if ((b.pending_switch || []).indexOf(my) !== -1) {
    if (b.actions_submitted[my]) {
      html += '<div class="turn-hint">已提交换人，等待对方……</div>';
    } else {
      html += '<div class="turn-hint">✦ ' + esc(myMon.name) + ' 倒下了，请在弹框中选择下一只出战宝可梦</div>';
    }
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
  REMOTE.switchPromptKey = '';
  remoteSubmit({ type: 'switch', index: idx });
}

function remoteForfeit() {
  openModal('认输', '<div class="shop-hint">确定要认输吗？本局将判对方获胜。</div>' +
    '<div class="modal-btns"><button class="btn btn-primary" onclick="remoteForfeitYes()">认输</button>' +
    '<button class="btn" onclick="closeModal()">再想想</button></div>');
}

function remoteForfeitYes() {
  REMOTE.switchPromptKey = '';
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

function remoteSwitchCandidates(view, side) {
  const b = view && view.battle;
  if (!b || !b.actives || !b.parties) return [];
  const myMon = b.actives[side];
  return (b.parties[side] || []).map(function (m, i) {
    return { index: i, mon: m };
  }).filter(function (entry) {
    return entry.mon.hp > 0 && (!myMon || entry.mon.uid !== myMon.uid);
  });
}

function remoteOpenSwitchPrompt(view, side) {
  const b = view.battle;
  const myMon = b.actives[side];
  const picks = remoteSwitchCandidates(view, side);
  const body = '<div class="shop-hint">✦ ' + esc(myMon.name) + ' 已倒下，请选择下一只出战宝可梦。</div>' +
    picks.map(function (entry) {
      const m = entry.mon;
      return '<button class="btn" onclick="remoteSwitchTo(' + entry.index + ')">' +
        esc(m.name) + ' Lv' + m.level + '（' + m.hp + '/' + m.max + '）</button>';
    }).join('') +
    '<div class="modal-btns"><button class="btn btn-danger" onclick="remoteForfeitYes()">认输</button></div>';
  const root = $id('modal-root');
  root.innerHTML = '<div class="overlay" id="modal-overlay"><div class="modal pixel-frame">' +
    '<div class="modal-header"><span>选择下一只出战宝可梦</span></div>' +
    '<div class="modal-body">' + body + '</div></div></div>';
}

function remoteCloseSwitchPrompt() {
  if (!REMOTE.switchPromptKey) return;
  REMOTE.switchPromptKey = '';
  closeModal();
}

function remoteSyncSwitchPrompt(view, side) {
  const b = view && view.battle;
  if (!b || b.over || (b.pending_switch || []).indexOf(side) === -1 || b.actions_submitted[side]) {
    remoteCloseSwitchPrompt();
    return;
  }
  const picks = remoteSwitchCandidates(view, side);
  if (picks.length === 0) {
    remoteCloseSwitchPrompt();
    return;
  }
  const myMon = b.actives[side];
  const key = [view.id, b.turn, side, myMon ? myMon.uid : 'none', picks.map(function (entry) { return entry.mon.uid; }).join(',')].join(':');
  if (REMOTE.switchPromptKey === key && $id('modal-root').innerHTML) return;
  REMOTE.switchPromptKey = key;
  remoteOpenSwitchPrompt(view, side);
}
