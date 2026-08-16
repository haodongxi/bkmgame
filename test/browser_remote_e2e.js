/* 联机对战端到端：浏览器客户端（remote.js）↔ bkmserver 真实对战
   前置：
   1) bkmserver 已启动在 127.0.0.1:8787（python3 main.py）
   2) Chrome 已用 --remote-debugging-port=9222 打开（可复用 browser_play 的环境）
   用法: node test/browser_remote_e2e.js
   Created by haodongsheng
*/
const PORT = 9222;
const BASE = 'http://127.0.0.1:8787';
const URL = 'file://' + require('path').resolve(__dirname, '..', 'app.html').replace(/\\/g, '/');

function serverApi(method, path, body, token) {
  const opt = { method: method, headers: { 'Content-Type': 'application/json' } };
  if (token) opt.headers['Authorization'] = 'Bearer ' + token;
  if (body !== undefined) opt.body = JSON.stringify(body);
  return fetch(BASE + path, opt).then(function (r) {
    return r.json().then(function (j) {
      if (!r.ok) throw new Error(JSON.stringify(j));
      return j.data;
    });
  });
}

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function main() {
  const target = await fetch('http://127.0.0.1:' + PORT + '/json/new?' + encodeURIComponent(URL), { method: 'PUT' }).then(function (r) { return r.json(); });
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(function (res, rej) { ws.onopen = res; ws.onerror = rej; });
  let msgId = 0;
  const pending = {};
  const exceptions = [];
  const consoleErrors = [];
  ws.onmessage = function (ev) {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending[msg.id]) { pending[msg.id](msg); delete pending[msg.id]; }
    else if (msg.method === 'Runtime.exceptionThrown') {
      exceptions.push((msg.params.exceptionDetails && (msg.params.exceptionDetails.text || msg.params.exceptionDetails.exception && msg.params.exceptionDetails.exception.description)) || 'unknown');
    }
    else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      consoleErrors.push(msg.params.args.map(function (a) { return a.value || a.description || ''; }).join(' '));
    }
  };
  function send(method, params) {
    return new Promise(function (res) {
      const id = ++msgId;
      pending[id] = res;
      ws.send(JSON.stringify({ id: id, method: method, params: params || {} }));
    });
  }
  async function evaljs(expression) {
    const r = await send('Runtime.evaluate', { expression: expression, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) {
      throw new Error('执行出错: ' + (r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description || r.result.exceptionDetails.text));
    }
    return r.result ? r.result.result.value : undefined;
  }
  async function waitUntil(expr, timeout) {
    const t0 = Date.now();
    while (Date.now() - t0 < (timeout || 15000)) {
      if (await evaljs(expr)) return true;
      await sleep(300);
    }
    return false;
  }
  await send('Runtime.enable');
  await evaljs("window.alert = function(){ return undefined; }; window.confirm = function(){ return true; };");
  let passed = 0, failed = 0;
  function ok(cond, name) {
    if (cond) { passed++; console.log('  ✓ ' + name); }
    else { failed++; console.error('  ✗ ' + name); }
  }

  for (let i = 0; i < 60; i++) {
    if (await evaljs("typeof remoteOpenLobby === 'function'")) break;
    await sleep(100);
  }
  // 清掉上次运行的登录态，保证大厅显示登录表单
  await evaljs("localStorage.removeItem('bkm_remote_token'); localStorage.removeItem('bkm_remote_name'); REMOTE.token=null; REMOTE.name='';");
  await evaljs("resetGame(); render();");

  const suffix = String(Date.now() % 100000);
  const nameA = 'brA' + suffix;
  const nameB = 'brB' + suffix;

  // 浏览器客户端：设置服务器 → 注册 → 上传队伍 → 建房
  await evaljs("remoteOpenLobby();");
  await evaljs("REMOTE.server='" + BASE + "'; (function(){var el=document.getElementById('rb-server'); if(el) el.value=REMOTE.server;})(); remoteSaveCfg();");
  await evaljs("(function(){document.getElementById('rb-name').value='" + nameA + "'; document.getElementById('rb-pass').value='test1234';})()");
  ok(await evaljs("remoteRegister().then(function(){ return REMOTE.token && REMOTE.name==='" + nameA + "'; })"), '浏览器注册并登录');
  ok(await evaljs("(function(){ var n=(STATE.party||[]).length; remoteMakeTestTeam(); return (STATE.party||[]).length > n; })()"), '一键生成测试队伍');
  ok(await waitUntil("document.getElementById('remote-msg').textContent.indexOf('队伍已上传') !== -1", 10000), '浏览器上传队伍成功');
  await evaljs("remoteCreate();");
  ok(await waitUntil("REMOTE.roomId && REMOTE.lastView && REMOTE.lastView.code", 10000), '浏览器创建房间并拿到房间码');
  const code = await evaljs("REMOTE.lastView.code");

  // 第二个玩家：HTTP 注册、上传队伍、凭码加入
  const tokenB = (await serverApi('POST', '/api/register', { name: nameB, password: 'test1234' })).token;
  await serverApi('PUT', '/api/me/team', {
    team: [{ species: 9, level: 60, nature: '温和', moves: ['surf', 'hydro_pump', 'bite'] }],
    items: { '好伤药': 1 }
  }, tokenB);
  await serverApi('POST', '/api/rooms/join', { code: code }, tokenB);

  // 双方进入对战
  ok(await waitUntil("REMOTE.battleOpen && REMOTE.lastView && REMOTE.lastView.battle && !REMOTE.lastView.battle.over", 12000), '浏览器端对战开始');

  // 浏览器方出招，HTTP 方出招
  ok(await waitUntil("document.querySelector('#rb-actions .move-btn:not([disabled])') !== null", 10000), '出招按钮可用');
  await evaljs("document.querySelector('#rb-actions .move-btn:not([disabled])').click()");
  const roomId = await evaljs("REMOTE.roomId");
  await serverApi('POST', '/api/rooms/' + roomId + '/action', { action: { type: 'move', index: 0 } }, tokenB);
  ok(await waitUntil("document.getElementById('rb-log').textContent.indexOf('使用了') !== -1", 12000), '浏览器日志收到双方出招事件');

  // HTTP 方认输 → 浏览器端显示对局结束
  await serverApi('POST', '/api/rooms/' + roomId + '/forfeit', {}, tokenB);
  ok(await waitUntil("REMOTE.lastView && REMOTE.lastView.battle && REMOTE.lastView.battle.over", 12000), '浏览器端收到对局结束');
  ok(await evaljs("document.getElementById('rb-status').textContent.indexOf('获胜') !== -1"), '浏览器端显示胜负结果');

  console.log('\n异常: ' + exceptions.length + ' 个 / 控制台错误: ' + consoleErrors.length + ' 个');
  exceptions.forEach(function (e) { console.error('  EXC: ' + e); });
  consoleErrors.forEach(function (e) { console.error('  ERR: ' + e); });
  console.log('\n========== 联机端到端结果：' + passed + ' 通过 / ' + failed + ' 失败 ==========');
  process.exit(failed > 0 || exceptions.length > 0 || consoleErrors.length > 0 ? 1 : 0);
}

main().catch(function (e) { console.error(e); process.exit(1); });
