/* 浏览器驱动冒烟：通过 CDP 驱动真实 Chrome 走一遍核心流程
   前置：Chrome 已用 --remote-debugging-port=9222 打开 app.html
   Created by haodongsheng
   用法: node test/browser_play.js */
const PORT = 9222;
const URL = 'file:///Users/haodongsheng/Documents/github/bkmGame/app.html';

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

  await send('Runtime.enable');
  let passed = 0, failed = 0;
  function ok(cond, name) {
    if (cond) { passed++; console.log('  ✓ ' + name); }
    else { failed++; console.error('  ✗ ' + name); }
  }

  for (let i = 0; i < 60; i++) {
    if (await evaljs("typeof STATE !== 'undefined' && typeof resetGame === 'function'")) break;
    await new Promise(function (r) { setTimeout(r, 100); });
  }
  await evaljs('localStorage.clear(); resetGame(); render();');
  ok(await evaljs("document.querySelector('#screen-title').classList.contains('active')"), '标题页激活');
  ok(await evaljs("document.querySelector('#btn-continue').style.display === 'none'"), '无存档时隐藏继续按钮');

  await evaljs('uiStartNew();');
  ok(await evaljs("document.querySelector('#screen-starter').classList.contains('active')"), '选御三家页激活');
  ok(await evaljs("document.querySelectorAll('.starter-card').length === 3"), '三张御三家卡片');
  ok(await evaljs("(function(){var c=document.querySelector('.starter-icon canvas');var d=c.getContext('2d').getImageData(0,0,16,16).data;var s=0;for(var i=3;i<d.length;i+=4)s+=d[i];return s>0;})()"), '像素 icon 已绘制');

  await evaljs('uiPickStarter(4);');
  ok(await evaljs("document.querySelector('#screen-map').classList.contains('active')"), '地图页激活');
  ok(await evaljs("STATE.party[0].name === '小火龙' && STATE.party[0].level === 5"), '开局小火龙 Lv5');
  ok(await evaljs("document.querySelectorAll('#action-panel .btn').length >= 5"), '城镇操作按钮齐全');
  ok(await evaljs("document.querySelector('#loc-label').textContent.indexOf('真新镇') !== -1"), '位置标签渲染');
  ok(await evaljs("document.querySelector('#weather-label').textContent.indexOf('天气') !== -1"), '天气标签渲染');

  await evaljs('doMapAction(\'travel\');');
  ok(await evaljs("document.querySelectorAll('.travel-btn').length === 1"), '移动弹窗列出下个地点');
  await evaljs('doTravel(\'route1\');');
  ok(await evaljs("STATE.nodeId === 'route1'"), '移动到 1 号道路');
  ok(await evaljs("document.querySelectorAll('#action-panel .btn')[0].textContent.indexOf('探索') !== -1"), '野外探索按钮');

  await evaljs('STATE.party = [makeMon(6, 15, { nature: "勤奋" })]; startWildBattle(16, 4); render();');
  ok(await evaljs("document.querySelector('#screen-battle').classList.contains('active')"), '战斗界面激活');
  ok(await evaljs("document.querySelectorAll('#battle-actions .btn').length === STATE.battle.player.mons[0].m.moves.length + 3"), '战斗按钮 = 招式+道具+换人+逃跑');
  ok(await evaljs("document.querySelector('#battle-foe').textContent.indexOf('波波') !== -1"), '敌方卡片渲染');
  await evaljs("(function(){var guard=0;while(STATE.battle && !STATE.battle.over && guard++<60){var a=STATE.battle.player.mons[STATE.battle.player.active];var idx=0;for(var i=0;i<a.m.moves.length;i++){if(MOVES[a.m.moves[i]].power>0){idx=i;break;}}battleMove(idx);}return STATE.lastResult;})()");
  ok(await evaljs("STATE.lastResult === 'win'"), '战斗胜利结算');
  await evaljs('render();');
  ok(await evaljs("document.querySelector('#screen-map').classList.contains('active')"), '战斗后回到地图页');

  await evaljs('doMapAction(\'mart\');');
  ok(await evaljs("document.querySelector('#modal-root .modal') !== null"), '商店弹窗打开');
  ok(await evaljs("document.querySelectorAll('#modal-root .shop-row').length >= 4"), '商店货架渲染');
  await evaljs('closeModal();');

  await evaljs('doMapAction(\'bag\');');
  ok(await evaljs("document.querySelector('#modal-root .modal') !== null"), '背包弹窗打开');
  await evaljs('closeModal();');

  await evaljs('doMapAction(\'wander\');');
  ok(await evaljs("STATE.log.length > 0"), '闲逛事件产生日志');

  console.log('\n异常: ' + exceptions.length + ' 个 / 控制台错误: ' + consoleErrors.length + ' 个');
  exceptions.forEach(function (e) { console.error('  EXC: ' + e); });
  consoleErrors.forEach(function (e) { console.error('  ERR: ' + e); });
  console.log('\n========== 浏览器冒烟结果：' + passed + ' 通过 / ' + failed + ' 失败 ==========');
  process.exit(failed > 0 || exceptions.length > 0 || consoleErrors.length > 0 ? 1 : 0);
}

main().catch(function (e) { console.error(e); process.exit(1); });
