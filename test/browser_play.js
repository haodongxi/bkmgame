/* 浏览器驱动冒烟：通过 CDP 驱动真实 Chrome 走一遍核心流程
   前置：Chrome 已用 --remote-debugging-port=9222 打开 app.html
   Created by haodongsheng
   用法: node test/browser_play.js */
const PORT = 9222;
const URL = 'file://' + require('path').resolve(__dirname, '..', 'app.html').replace(/\\/g, '/');

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
  await evaljs("window.alert = function(){ return undefined; }; window.confirm = function(){ return true; };");
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
  ok(await evaljs("document.querySelector('#modal-root .party-pp') !== null"), '队伍弹窗显示 PP 状态');
  ok(await evaljs("document.querySelector('#modal-root .lead-tag') !== null"), '首发宝可梦有标记');
  ok(await evaljs("document.querySelector('#modal-root .party-name .rarity.r-rare') !== null"), '队伍弹窗显示稀有度词缀（小火龙=稀有）');
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
  ok(await evaljs("document.querySelector('#modal-root .dex-cell.seen, #modal-root .dex-cell.caught') !== null"), '图鉴宝可梦有已见/已捕获标记');
  ok(await evaljs("document.querySelector('#modal-root .dex-cell.caught') !== null"), '御三家开局已捕获有标记');
  ok(await evaljs("document.querySelector('#modal-root .dex-cell.caught .dex-rarity.r-rare') !== null"), '图鉴格子显示稀有度词缀');
  ok(await evaljs("document.querySelector('#modal-root .dex-hint').textContent.indexOf('已见') !== -1"), '图鉴显示进度');
  // 已见/已捕获：点击格子展示详情（种族值/学习面/获取途径）
  await evaljs("document.querySelector('#modal-root .dex-cell.caught').click()");
  ok(await evaljs("document.querySelector('#modal-root .modal-body').textContent.indexOf('种族值') !== -1"), '图鉴详情显示种族值');
  ok(await evaljs("document.querySelector('#modal-root .modal-body').textContent.indexOf('可学招式') !== -1"), '图鉴详情显示学习面');
  ok(await evaljs("document.querySelector('#modal-root .modal-body').textContent.indexOf('获取途径') !== -1"), '图鉴详情显示获取途径');
  ok(await evaljs("document.querySelector('#modal-root .modal-body').textContent.indexOf('初始选择') !== -1"), '小火龙获取途径含初始选择');
  await evaljs('closeModal();');
  // 未发现：保持神秘，不泄露种族值
  await evaljs('doMapAction(\'pokedex\');');
  await evaljs("document.querySelector('#modal-root .dex-cell:not(.seen):not(.caught)').click()");
  ok(await evaljs("document.querySelector('#modal-root .modal-body').textContent.indexOf('尚未遇见') !== -1"), '未发现宝可梦保持神秘');
  ok(await evaljs("document.querySelector('#modal-root .modal-body').textContent.indexOf('种族值') === -1"), '未发现不泄露种族值');
  await evaljs('closeModal();');
  await evaljs("for (var i = 1; i <= 151; i++) STATE.seenDex[i] = true; showPokedexModal();");
  ok(await evaljs("Array.prototype.every.call(document.querySelectorAll('#modal-root .dex-cell'), function(c){ return c.scrollWidth <= c.clientWidth + 1; })"), '全图鉴 151 格横向无溢出（含稀有度词缀行）');
  ok(await evaljs("document.querySelectorAll('#modal-root .dex-rarity').length > 100"), '绝大多数图鉴格子显示稀有度词缀');
  await evaljs('closeModal();');
  await evaljs('doMapAction(\'itemdex\');');
  ok(await evaljs("document.querySelector('#modal-root .modal-body').textContent.indexOf('月亮石') !== -1"), '道具图鉴列出月亮石');
  ok(await evaljs("document.querySelector('#modal-root .modal-body').textContent.indexOf('皮皮') !== -1 && document.querySelector('#modal-root .modal-body').textContent.indexOf('皮可西') !== -1"), '月亮石说明写明具体进化对象（皮皮→皮可西）');
  await evaljs('closeModal();');
  // 招式图鉴：全量 + 分组 + 搜索 + 类别筛选
  await evaljs('doMapAction(\'movedex\');');
  ok(await evaljs("document.querySelector('#modal-root .modal-body').textContent.indexOf('全部招式') !== -1 && document.querySelector('#modal-root .modal-body').textContent.indexOf(String(Object.keys(MOVES).length)) !== -1"), '招式图鉴列出全部招式数量');
  ok(await evaljs("document.querySelectorAll('#modal-root .itemdex-cat').length >= 10"), '招式按属性分组');
  ok(await evaljs("document.querySelector('#modal-root .modal-body').textContent.indexOf('喷射火焰') !== -1"), '招式图鉴列出喷射火焰（含威力/PP）');
  await evaljs("document.querySelector('#move-dex-search').value = '火'; onMoveDexSearch('火');");
  ok(await evaljs("document.querySelectorAll('#modal-root .shop-row').length > 0 && document.querySelector('#modal-root .modal-body').textContent.indexOf('火') !== -1"), '搜索“火”过滤生效');
  ok(await evaljs("(function(){var el=document.querySelector('#move-dex-search'); el.focus(); el.value='喷射'; onMoveDexSearch('喷射'); return document.querySelector('#move-dex-search') === el;})()"), '搜索输入不重建输入框（中文输入法不断开）');
  ok(await evaljs("document.querySelector('#move-dex-list').textContent.indexOf('喷射火焰') !== -1"), '中文搜索命中喷射火焰');
  await evaljs("document.querySelector('#move-dex-search').value = '大晴天'; onMoveDexSearch('大晴天');");
  ok(await evaljs("document.querySelector('#move-dex-list').textContent.indexOf('大晴天') !== -1"), '完整中文词“大晴天”可搜出');
  ok(await evaljs("(function(){var el=document.querySelector('#move-dex-search'); onMoveDexSearch('zzz'); el.value='大晴天'; onMoveDexSearch('大晴天', {isComposing:true}); var before=document.querySelector('#move-dex-list').textContent.indexOf('大晴天'); el.dispatchEvent(new CompositionEvent('compositionend', {bubbles:true})); return before===-1 && _moveDexQuery==='大晴天' && document.querySelector('#move-dex-list').textContent.indexOf('大晴天')!==-1;})()"), '拼音组合上屏（compositionend）后自动刷新');
  await evaljs('showMoveDexModal(\'变化\');');
  ok(await evaljs("Array.prototype.every.call(document.querySelectorAll('#modal-root .shop-row'), function(r){ return r.textContent.indexOf('变化') !== -1; })"), '变化类筛选生效');
  await evaljs('closeModal();');
  ok(await evaljs("document.querySelectorAll('#action-panel .btn').length >= 5"), '城镇操作按钮齐全');
  ok(await evaljs("document.querySelector('.map-reset-wrap .btn') !== null && document.querySelector('#action-panel').textContent.indexOf('重开') === -1"), '重开按钮已移到右上角，不在操作面板中');
  ok(await evaljs("document.querySelector('#loc-label').textContent.indexOf('真新镇') !== -1"), '位置标签渲染');
  ok(await evaljs("document.querySelector('#weather-label').textContent.indexOf('天气') !== -1"), '天气标签渲染');
  ok(await evaljs("document.querySelector('#goal-label').textContent.indexOf('小刚') !== -1"), '目标提示指向首个道馆');
  await evaljs("document.querySelector('#party-strip .party-card').click()");
  ok(await evaljs("document.querySelector('#modal-root .detail-name') !== null && document.querySelector('#modal-root .modal-body').textContent.indexOf('个体') !== -1"), '点击队伍条宝可梦直接打开详情页');
  await evaljs('closeModal();');

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
  ok(await evaljs("document.querySelector('#battle-actions .move-effect') !== null"), '招式按钮显示效果说明');
  ok(await evaljs("document.querySelector('#battle-actions').textContent.indexOf('对方攻击↓') !== -1"), '叫声效果说明：对方攻击↓');
  ok(await evaljs("document.querySelector('#battle-foe').textContent.indexOf('波波') !== -1"), '敌方卡片渲染');
  ok(await evaljs("document.querySelector('#battle-player .battle-name .rarity.r-rare') !== null"), '我方战斗卡片显示稀有度词缀');
  ok(await evaljs("document.querySelector('#battle-foe .battle-name .rarity') === null"), '普通敌方不显示稀有度词缀');
  ok(await evaljs("effHint({type:'火', power:40}, ['虫']).indexOf('效果拔群') !== -1"), '克制提示：火对虫效果拔群');
  ok(await evaljs("effHint({type:'电', power:40}, ['地面']).indexOf('没有效果') !== -1"), '克制提示：电对地面没有效果');
  await evaljs("(function(){var guard=0;while(STATE.battle && !STATE.battle.over && guard++<60){var a=STATE.battle.player.mons[STATE.battle.player.active];var idx=0;for(var i=0;i<a.m.moves.length;i++){if(MOVES[a.m.moves[i]].power>0){idx=i;break;}}battleMove(idx);}return STATE.lastResult;})()");
  ok(await evaljs("STATE.lastResult === 'win'"), '战斗胜利结算');
  await evaljs('render();');
  ok(await evaljs("document.querySelector('#screen-map').classList.contains('active')"), '战斗后回到地图页');
  ok(await evaljs("getComputedStyle(document.querySelector('#screen-battle')).display === 'none'"), '回到地图后战斗屏隐藏');
  // 强化技效果说明（卡比兽·瞬间失忆）
  await evaljs("STATE.party = [makeMon(143, 40, { nature: '勤奋' })]; STATE.party[0].moves = ['amnesia', 'body_slam']; STATE.party[0].pp = [20, 15]; startWildBattle(16, 40); render();");
  ok(await evaljs("document.querySelector('#battle-actions').textContent.indexOf('特防↑2') !== -1"), '强化技显示效果说明（瞬间失忆 特防↑2）');
  await evaljs("(function(){var guard=0;while(STATE.battle && !STATE.battle.over && guard++<60){var a=STATE.battle.player.mons[STATE.battle.player.active];var idx=0;for(var i=0;i<a.m.moves.length;i++){if(MOVES[a.m.moves[i]].power>0){idx=i;break;}}battleMove(idx);}})()");
  await evaljs('render();');
  // 招式更换：满级卡比兽把残留的高速移动换成泰山压顶
  await evaljs("STATE.party = [makeMon(143, 100, { nature: '勤奋' })]; STATE.party[0].moves = ['tackle', 'growl', 'amnesia', 'agility']; STATE.party[0].pp = [35, 40, 20, 30]; STATE.money = 10000; doMapAction('party');");
  await evaljs("(function(){var b=Array.prototype.slice.call(document.querySelectorAll('#modal-root .party-row .btn')).filter(function(x){return x.textContent.indexOf('详情')!==-1;})[0]; if(b)b.click();})()");
  ok(await evaljs("document.querySelector('#modal-root .modal-body').textContent.indexOf('更换招式') !== -1"), '详情面板显示更换招式入口');
  await evaljs("(function(){var b=Array.prototype.slice.call(document.querySelectorAll('#modal-root .modal-body .btn')).filter(function(x){return x.textContent.indexOf('更换招式')!==-1;})[0]; if(b)b.click();})()");
  ok(await evaljs("document.querySelector('#modal-root .modal-body').textContent.indexOf('可学招式') !== -1"), '更换招式弹窗显示可学清单');
  await evaljs("(function(){var b=Array.prototype.slice.call(document.querySelectorAll('#modal-root .modal-body .btn')).filter(function(x){return x.textContent.indexOf('4. 高速移动')!==-1;})[0]; if(b)b.click();})()");
  await evaljs("(function(){var b=Array.prototype.slice.call(document.querySelectorAll('#modal-root .modal-body .move-btn')).filter(function(x){return x.textContent.indexOf('泰山压顶')!==-1;})[0]; if(b)b.click();})()");
  ok(await evaljs("STATE.party[0].moves[3] === 'body_slam' && STATE.money === 6500"), '替换成功：高速移动换成泰山压顶并扣除 3500 金');

  // 遗忘技能：升级弹窗点“不学了”后不再重复提示
  await evaljs("STATE.party = [makeMon(143, 29, { nature: '勤奋' })]; STATE.party[0].moves = ['tackle','growl','quick_attack','take_down']; STATE.party[0].pp=[35,40,30,25]; STATE.party[0].exp = expForLevel('slow', 29); STATE.pendingLearn=[]; STATE.log=[]; STATE.logKinds=[]; render();");
  await evaljs("grantExp(STATE.party[0], expForLevel('slow', 30)-STATE.party[0].exp+1, [], []); render();");
  ok(await evaljs("STATE.pendingLearn.length === 1 && STATE.pendingLearn[0].moveId === 'rest'"), '升级后睡觉进入待学队列');
  ok(await evaljs("document.querySelector('#modal-root .modal-body').textContent.indexOf('不再提示') !== -1"), '学招弹窗标注“不学了（不再提示）”');
  await evaljs("(function(){var b=Array.prototype.slice.call(document.querySelectorAll('#modal-root .modal-body .btn')).filter(function(x){return x.textContent.indexOf('不学了') !== -1;})[0]; if(b)b.click();})()");
  ok(await evaljs("(STATE.party[0].forgottenMoves||[]).indexOf('rest') !== -1"), '不学了记入遗忘清单');
  await evaljs("grantExp(STATE.party[0], expForLevel('slow', 100)-STATE.party[0].exp, [], []); render();");
  ok(await evaljs("STATE.pendingLearn.every(function(p){ return p.moveId !== 'rest'; })"), '后续升级不再重复提示已遗忘的睡觉');
  await evaljs('STATE.pendingLearn = []; closeModal(); render();');

  await evaljs('doMapAction(\'mart\');');
  ok(await evaljs("document.querySelector('#modal-root .modal') !== null"), '商店弹窗打开');
  ok(await evaljs("document.querySelectorAll('#modal-root .shop-row').length >= 20"), '商店列出全部商品');
  ok(await evaljs("(function(){var r=Array.prototype.slice.call(document.querySelectorAll('#modal-root .shop-row')).filter(function(x){return x.textContent.indexOf('大师球')!==-1;})[0]; return r && r.querySelector('button[disabled]') !== null;})()"), '0徽章时大师球置灰未解锁');
  await evaljs('closeModal();');
  await evaljs("STATE.badges = ['灰色徽章','蓝色徽章','橙色徽章','彩虹徽章','金色徽章','粉红徽章','深红徽章','绿色徽章']; STATE.money = 999999; doMapAction('mart');");
  ok(await evaljs("(function(){var r=Array.prototype.slice.call(document.querySelectorAll('#modal-root .shop-row')).filter(function(x){return x.textContent.indexOf('大师球')!==-1;})[0]; var bs=r?r.querySelectorAll('button'):[]; return Array.prototype.some.call(bs, b => b.textContent.indexOf('购买') !== -1 && !b.disabled);})()"), '8徽章时大师球购买按钮可用');
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
  await evaljs("STATE.money = 100; STATE.merchantOffer = {kind:'item', name:'高级球', price:3000}; render();");
  ok(await evaljs("document.querySelector('#modal-root .modal') !== null && document.querySelector('#modal-root .modal-body').textContent.indexOf('3000') !== -1"), '神秘商人弹窗');
  ok(await evaljs("document.querySelector('#modal-root .modal-btns .btn[disabled]') !== null"), '金币不足时购买按钮禁用');
  await evaljs('closeModal(); STATE.merchantOffer = null;');

  // 存档导出 / 导入
  const beforeLen = await evaljs("STATE.party.length");
  await evaljs('exportSave();');
  ok(await evaljs("document.querySelector('#save-code') !== null && document.querySelector('#save-code').value.length > 0"), '导出存档生成存档码');
  ok(await evaljs("JSON.parse(decodeURIComponent(escape(atob(document.querySelector('#save-code').value)))).version === 1"), '存档码可解码');
  const saveCode = await evaljs("document.querySelector('#save-code').value");
  await evaljs('closeModal(); showImportSave(); document.querySelector(\'#import-code\').value = ' + JSON.stringify(saveCode) + '; doImportSave();');
  ok(await evaljs("STATE.screen === 'map' && STATE.party.length === " + beforeLen), '导入存档成功并恢复进度');

  // 商店买卖后地图金钱同步刷新（回归：关闭商店后顶栏不再显示旧钱）
  await evaljs("STATE.nodeId = 'pallet'; STATE.money = 5000; STATE.bag = {}; STATE.badges = []; render(); doMapAction('mart');");
  await evaljs("(function(){var r=Array.prototype.slice.call(document.querySelectorAll('#modal-root .shop-row')).filter(function(x){return x.textContent.indexOf('伤药') !== -1;})[0]; var b=Array.prototype.slice.call(r.querySelectorAll('button')).filter(function(x){return x.textContent.indexOf('购买') !== -1;})[0]; b.click();})()");
  ok(await evaljs("document.querySelector('#meta-label').textContent.indexOf('4700') !== -1"), '购买后地图顶栏金钱同步为 4700');
  ok(await evaljs("document.querySelector('#modal-root .modal-body').textContent.indexOf('金钱：4700') !== -1"), '购买后商店弹窗金钱同步为 4700');
  await evaljs('closeModal();');
  ok(await evaljs("document.querySelector('#meta-label').textContent.indexOf('4700') !== -1"), '关闭商店后地图顶栏仍显示最新金钱');

  // 电脑箱传送后数量同步刷新（回归：地图按钮与箱子弹窗不再显示旧数量）
  await evaljs("STATE.party = [makeMon(4, 5, { nature: '勤奋' })]; STATE.box = [makeMon(16, 5, { nature: '勤奋' }), makeMon(19, 5, { nature: '勤奋' })]; STATE.box[0].held = '电气球'; render();");
  ok(await evaljs("Array.prototype.some.call(document.querySelectorAll('#action-panel .btn'), function(b){ return b.textContent.indexOf('电脑箱（2只）') !== -1; })"), '地图显示电脑箱 2 只');
  await evaljs('doMapAction(\'box\');');
  ok(await evaljs("document.querySelector('#modal-root .modal-header').textContent.indexOf('电脑箱（2只）') !== -1"), '箱子弹窗显示 2 只');
  await evaljs("document.querySelector('#modal-root .btn-danger').click()");
  ok(await evaljs("STATE.box.length === 1 && STATE.expPool > 0"), '传送后箱子剩 1 只且获得万能经验');
  ok(await evaljs("STATE.bag['电气球'] === 1"), '传送后携带物退回背包');
  ok(await evaljs("Array.prototype.some.call(document.querySelectorAll('#action-panel .btn'), function(b){ return b.textContent.indexOf('电脑箱（1只）') !== -1; })"), '传送后地图按钮同步为 1 只');
  ok(await evaljs("document.querySelector('#modal-root .modal-header').textContent.indexOf('电脑箱（1只）') !== -1"), '传送后箱子弹窗同步为 1 只');
  await evaljs('closeModal();');

  console.log('\n异常: ' + exceptions.length + ' 个 / 控制台错误: ' + consoleErrors.length + ' 个');
  exceptions.forEach(function (e) { console.error('  EXC: ' + e); });
  consoleErrors.forEach(function (e) { console.error('  ERR: ' + e); });
  console.log('\n========== 浏览器冒烟结果：' + passed + ' 通过 / ' + failed + ' 失败 ==========');
  process.exit(failed > 0 || exceptions.length > 0 || consoleErrors.length > 0 ? 1 : 0);
}

main().catch(function (e) { console.error(e); process.exit(1); });
