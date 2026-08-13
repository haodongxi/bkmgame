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
  ok(await evaljs("Object.keys(POKEDEX).filter(function(k){ return +k <= 151; }).length === 151"), '页面图鉴 151 只');

  await evaljs('uiStartNew();');
  ok(await evaljs("document.querySelector('#screen-starter').classList.contains('active')"), '选御三家页激活');
  ok(await evaljs("document.querySelectorAll('.starter-card').length === 3"), '三张御三家卡片');
  ok(await evaljs("(function(){var c=document.querySelector('.starter-icon canvas');var d=c.getContext('2d').getImageData(0,0,16,16).data;var s=0;for(var i=3;i<d.length;i+=4)s+=d[i];return s>0;})()"), '像素 icon 已绘制');

  await evaljs('uiPickStarter(4);');
  ok(await evaljs("document.querySelector('#screen-map').classList.contains('active')"), '地图页激活');
  ok(await evaljs("STATE.party[0].name === '小火龙' && STATE.party[0].level === 5"), '开局小火龙 Lv5');
  await evaljs('STATE.party.push(makeMon(16, 5, { nature: "勤奋" })); doMapAction(\'party\');');
  ok(await evaljs("document.querySelectorAll('#modal-root .party-row').length === 2"), '队伍弹窗显示两只宝可梦');
  ok(await evaljs("document.querySelector('#modal-root .lead-tag') !== null"), '首发宝可梦有标记');
  await evaljs("document.querySelector('#modal-root .party-row:nth-child(2) .btn').click()");
  ok(await evaljs("STATE.party[0].name === '波波'"), '点击设为首发后队首变为波波');
  await evaljs('doMapAction(\'party\');');
  await evaljs("(function(){var b=Array.prototype.slice.call(document.querySelectorAll('#modal-root .party-row .btn')).filter(function(x){return x.textContent.indexOf('详情')!==-1;})[0]; if(b) b.click();})()");
  ok(await evaljs("document.querySelectorAll('#modal-root .detail-row').length >= 6"), '详情面板显示能力值');
  ok(await evaljs("document.querySelector('#modal-root .detail-name').textContent.indexOf('波波') !== -1"), '详情面板显示宝可梦名');
  ok(await evaljs("document.querySelector('#modal-root .modal-body').textContent.indexOf('个体') !== -1"), '详情面板显示个体值');
  await evaljs('closeModal();');
  await evaljs('doMapAction(\'pokedex\');');
  ok(await evaljs("document.querySelectorAll('#modal-root .dex-cell').length === 151"), '图鉴显示 151 只');
  ok(await evaljs("document.querySelector('#modal-root .dex-cell.seen') !== null"), '图鉴已见宝可梦有标记');
  ok(await evaljs("document.querySelector('#modal-root .dex-hint').textContent.indexOf('已见') !== -1"), '图鉴显示进度');
  await evaljs('closeModal();');
  ok(await evaljs("document.querySelectorAll('#action-panel .btn').length >= 5"), '城镇操作按钮齐全');
  ok(await evaljs("document.querySelector('#loc-label').textContent.indexOf('真新镇') !== -1"), '位置标签渲染');
  ok(await evaljs("document.querySelector('#weather-label').textContent.indexOf('天气') !== -1"), '天气标签渲染');
  ok(await evaljs("document.querySelector('#goal-label').textContent.indexOf('小刚') !== -1"), '目标提示指向首个道馆');

  await evaljs('doMapAction(\'travel\');');
  ok(await evaljs("document.querySelectorAll('.travel-btn').length === 1"), '移动弹窗列出下个地点');
  await evaljs('doTravel(\'route1\');');
  ok(await evaljs("STATE.nodeId === 'route1'"), '移动到 1 号道路');
  ok(await evaljs("document.querySelectorAll('#action-panel .btn')[0].textContent.indexOf('探索') !== -1"), '野外探索按钮');
  await evaljs('doMapAction(\'travel\');');
  ok(await evaljs("document.querySelectorAll('.travel-btn').length >= 1"), '野外节点也有移动弹窗');
  ok(await evaljs("Array.prototype.some.call(document.querySelectorAll('.travel-btn'), function(b){ return b.textContent.indexOf('常磐市') !== -1; })"), '可从 1 号道路前往常磐市');
  await evaljs('doTravel(\'viridian\');');
  ok(await evaljs("STATE.nodeId === 'viridian'"), '成功移动到常磐市');

  await evaljs('STATE.party = [makeMon(6, 15, { nature: "勤奋" })]; startWildBattle(16, 4); render();');
  ok(await evaljs("document.querySelector('#screen-battle').classList.contains('active')"), '战斗界面激活');
  ok(await evaljs("getComputedStyle(document.querySelector('#screen-map')).display === 'none'"), '战斗中地图屏隐藏');
  ok(await evaljs("getComputedStyle(document.querySelector('#screen-battle')).display !== 'none'"), '战斗屏可见');
  ok(await evaljs("document.querySelectorAll('#battle-actions .btn').length === STATE.battle.player.mons[0].m.moves.length + 3"), '战斗按钮 = 招式+道具+换人+逃跑');
  ok(await evaljs("document.querySelector('#battle-actions .move-pp') !== null"), '招式按钮显示 PP');
  ok(await evaljs("document.querySelector('#battle-foe').textContent.indexOf('波波') !== -1"), '敌方卡片渲染');
  ok(await evaljs("effHint({type:'火', power:40}, ['虫']).indexOf('效果拔群') !== -1"), '克制提示：火对虫效果拔群');
  ok(await evaljs("effHint({type:'电', power:40}, ['地面']).indexOf('没有效果') !== -1"), '克制提示：电对地面没有效果');
  await evaljs("(function(){var guard=0;while(STATE.battle && !STATE.battle.over && guard++<60){var a=STATE.battle.player.mons[STATE.battle.player.active];var idx=0;for(var i=0;i<a.m.moves.length;i++){if(MOVES[a.m.moves[i]].power>0){idx=i;break;}}battleMove(idx);}return STATE.lastResult;})()");
  ok(await evaljs("STATE.lastResult === 'win'"), '战斗胜利结算');
  await evaljs('render();');
  ok(await evaljs("document.querySelector('#screen-map').classList.contains('active')"), '战斗后回到地图页');
  ok(await evaljs("getComputedStyle(document.querySelector('#screen-battle')).display === 'none'"), '回到地图后战斗屏隐藏');

  await evaljs('doMapAction(\'mart\');');
  ok(await evaljs("document.querySelector('#modal-root .modal') !== null"), '商店弹窗打开');
  ok(await evaljs("document.querySelectorAll('#modal-root .shop-row').length >= 4"), '商店货架渲染');
  ok(await evaljs("!Array.prototype.some.call(document.querySelectorAll('#modal-root .shop-row'), function(r){ return r.textContent.indexOf('大师球') !== -1; })"), '0徽章商店无大师球');
  await evaljs('closeModal();');
  await evaljs("STATE.badges = ['灰色徽章','蓝色徽章','橙色徽章','彩虹徽章','金色徽章','粉红徽章','深红徽章','绿色徽章']; doMapAction('mart');");
  ok(await evaljs("Array.prototype.some.call(document.querySelectorAll('#modal-root .shop-row'), function(r){ return r.textContent.indexOf('大师球') !== -1; })"), '8徽章商店有大师球');
  ok(await evaljs("Array.prototype.some.call(document.querySelectorAll('#modal-root .shop-row'), function(r){ return r.textContent.indexOf('求雨符') !== -1; })"), '商店有天气符');
  await evaljs('closeModal();');
  await evaljs('STATE.badges = [];');

  await evaljs('doMapAction(\'bag\');');
  ok(await evaljs("document.querySelector('#modal-root .modal') !== null"), '背包弹窗打开');
  await evaljs('closeModal();');

  await evaljs('doMapAction(\'wander\');');
  ok(await evaljs("STATE.log.length > 0"), '闲逛事件产生日志');

  await evaljs('STATE.keyItems.push(\'破旧钓竿\'); STATE.nodeId = \'route24\'; render();');
  ok(await evaljs("Array.prototype.some.call(document.querySelectorAll('#action-panel .btn'), function(b){ return b.textContent.indexOf('钓鱼') !== -1; })"), '水边出现钓鱼按钮');
  await evaljs('STATE.party.push(makeMon(19, 6, { nature: "勤奋" })); STATE.townTrade = { give: 16, want: 19 }; render();');
  ok(await evaljs("document.querySelector('#modal-root .modal') !== null && document.querySelector('#modal-root .modal-body').textContent.indexOf('波波') !== -1"), 'NPC 交换弹窗弹出');
  await evaljs('doTrade(true);');
  ok(await evaljs("STATE.party.some(function(m){ return m.species === 16 && m.tradeBonus; })"), '交换完成且带 1.5 倍经验标记');
  await evaljs('STATE.nodeId = \'pewter\'; render();');
  ok(await evaljs("Array.prototype.some.call(document.querySelectorAll('#action-panel .btn'), function(b){ return b.textContent.indexOf('挑战道馆') !== -1; })"), '道馆按钮带等级门槛提示');

  // 神秘商人弹窗
  await evaljs("STATE.merchantOffer = {kind:'item', name:'高级球', price:3000}; render();");
  ok(await evaljs("document.querySelector('#modal-root .modal') !== null && document.querySelector('#modal-root .modal-body').textContent.indexOf('3000') !== -1"), '神秘商人弹窗');
  await evaljs('closeModal(); STATE.merchantOffer = null;');

  // 存档导出 / 导入
  const beforeLen = await evaljs("STATE.party.length");
  await evaljs('exportSave();');
  ok(await evaljs("document.querySelector('#save-code') !== null && document.querySelector('#save-code').value.length > 0"), '导出存档生成存档码');
  ok(await evaljs("JSON.parse(decodeURIComponent(escape(atob(document.querySelector('#save-code').value)))).version === 1"), '存档码可解码');
  const saveCode = await evaljs("document.querySelector('#save-code').value");
  await evaljs('closeModal(); showImportSave(); document.querySelector(\'#import-code\').value = ' + JSON.stringify(saveCode) + '; doImportSave();');
  ok(await evaljs("STATE.screen === 'map' && STATE.party.length === " + beforeLen), '导入存档成功并恢复进度');

  console.log('\n异常: ' + exceptions.length + ' 个 / 控制台错误: ' + consoleErrors.length + ' 个');
  exceptions.forEach(function (e) { console.error('  EXC: ' + e); });
  consoleErrors.forEach(function (e) { console.error('  ERR: ' + e); });
  console.log('\n========== 浏览器冒烟结果：' + passed + ' 通过 / ' + failed + ' 失败 ==========');
  process.exit(failed > 0 || exceptions.length > 0 || consoleErrors.length > 0 ? 1 : 0);
}

main().catch(function (e) { console.error(e); process.exit(1); });
