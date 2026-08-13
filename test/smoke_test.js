/* 逻辑冒烟测试：加载全部源码并在模拟上下文中跑完整流程
   Created by haodongsheng
   用法: node test/smoke_test.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const files = ['js/data/typechart.js', 'js/data/moves.js', 'js/data/moves_gen.js', 'js/data/pokedex.js', 'js/data/pokedex_gen.js', 'js/data/maps.js', 'js/core.js'];
let src = files.map(function (f) {
  return fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
}).join('\n;\n');
src += '\n;\nglobalThis.__T = {\n' +
  '  getState: function(){ return STATE; },\n' +
  '  POKEDEX: POKEDEX, MOVES: MOVES, MAP_NODES: MAP_NODES, ITEMS: ITEMS, WEATHER: WEATHER,\n' +
  '  typeEffectiveness: typeEffectiveness, calcDamage: calcDamage, makeMon: makeMon,\n' +
  '  grantExp: grantExp, tryLearnMove: tryLearnMove, resolvePendingLearn: resolvePendingLearn,\n' +
  '  tryStoneEvolution: tryStoneEvolution, expForLevel: expForLevel,\n' +
  '  newGame: newGame, gotoNode: gotoNode, explore: explore, save: save, load: load, hasSave: hasSave, resetGame: resetGame,\n' +
  '  startWildBattle: startWildBattle, startTrainerBattle: startTrainerBattle, startGymBattle: startGymBattle,\n' +
  '  startRocketBattle: startRocketBattle,\n' +
  '  challengeGym: challengeGym, fish: fish, doTownTrade: doTownTrade,\n' +
  '  startRivalBattle: startRivalBattle, getRivalStarter: getRivalStarter,\n' +
  '  setLeadMon: setLeadMon, boxSwap: boxSwap, startSSAnne: startSSAnne, resolveMagikarpOffer: resolveMagikarpOffer,\n' +
  '  useRepel: useRepel, startMerchantOffer: startMerchantOffer, resolveMerchantOffer: resolveMerchantOffer,\n' +
  '  startBanditEvent: startBanditEvent, resolveBandit: resolveBandit,\n' +
  '  startMedicOffer: startMedicOffer, resolveMedic: resolveMedic,\n' +
  '  useWeatherItem: useWeatherItem,\n' +
  '  rollWeather: rollWeather, refreshWeather: refreshWeather,\n' +
  '  battleMove: battleMove, battleUseItem: battleUseItem, battleSwitch: battleSwitch, battleRun: battleRun,\n' +
  '  resolveRocketSell: resolveRocketSell, visitCenter: visitCenter, getMartStock: getMartStock,\n' +
  '  buyItem: buyItem, sellItem: sellItem, useBagItemOnMon: useBagItemOnMon, startBattle: startBattle, endBattle: endBattle,\n' +
  '  wanderTown: wanderTown\n' +
  '};';

// 可控随机：默认使用种子序列，需要时可切换
let rng;
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let seq = [];
const origRandom = Math.random;
function setRandomSource(fn) { rng = fn; }
Math.random = function () {
  if (seq.length) return seq.shift();
  return rng ? rng() : origRandom();
};

const localStorage = (function () {
  const m = {};
  return {
    getItem: function (k) { return k in m ? m[k] : null; },
    setItem: function (k, v) { m[k] = String(v); },
    removeItem: function (k) { delete m[k]; }
  };
})();

const sandbox = {
  localStorage: localStorage,
  console: console,
  Math: Math,
  JSON: JSON,
  Date: Date,
  globalThis: {}
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: 'bundle.js' });

const T = sandbox.__T;
let passed = 0;
let failed = 0;
function ok(cond, name) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.error('  ✗ ' + name); }
}
function section(name) { console.log('\n[' + name + ']'); }
function damageMoveIdx(mon) {
  for (let i = 0; i < mon.m.moves.length; i++) {
    if (T.MOVES[mon.m.moves[i]].power > 0 && (!mon.m.pp || mon.m.pp[i] > 0)) return i;
  }
  return -1;
}
function strongMoveIdx(b) {
  const a = b.player.mons[b.player.active];
  const foeTypes = b.foe.mons[b.foe.active].m.speciesData.types;
  let best = -1, bp = -1;
  for (let i = 0; i < a.m.moves.length; i++) {
    const mv = T.MOVES[a.m.moves[i]];
    if (mv && mv.power > 0 && (!a.m.pp || a.m.pp[i] > 0) && T.typeEffectiveness(mv.type, foeTypes) > 0 && mv.power > bp) {
      bp = mv.power;
      best = i;
    }
  }
  return best;
}

// 固定随机种子，保证结果稳定
setRandomSource(mulberry32(20260812));

// ---------- 1. 属性克制与伤害公式 ----------
section('属性与伤害');
ok(T.typeEffectiveness('水', ['火']) === 2, '水克制火');
ok(T.typeEffectiveness('电', ['地面']) === 0, '电对地面无效');
ok(T.typeEffectiveness('普通', ['幽灵']) === 0, '普通对幽灵无效');
ok(T.typeEffectiveness('龙', ['龙']) === 2, '龙克制龙');
{
  const atk = T.makeMon(4, 20);   // 小火龙
  const def = T.makeMon(16, 20);  // 波波
  const ember = T.MOVES.ember;
  let min = 99999, max = 0;
  for (let i = 0; i < 300; i++) {
    const r = T.calcDamage({ m: atk, stages: {} }, { m: def, stages: {} }, ember, null);
    if (r.dmg < min) min = r.dmg;
    if (r.dmg > max) max = r.dmg;
  }
  ok(min >= 1, '伤害保底 1（min=' + min + '）');
  ok(min >= 1 && max > min, '随机浮动区间存在（min=' + min + ', max=' + max + '）');
}
{
  const atk = T.makeMon(7, 20);  // 杰尼龟
  const def = T.makeMon(4, 20);  // 小火龙
  const r1 = T.calcDamage({ m: atk, stages: {} }, { m: def, stages: {} }, T.MOVES.water_gun, null);
  const r2 = T.calcDamage({ m: atk, stages: {} }, { m: def, stages: {} }, T.MOVES.water_gun, '雨');
  ok(r2.dmg > r1.dmg, '雨天水系伤害提升');
  const r3 = T.calcDamage({ m: atk, stages: {} }, { m: def, stages: {} }, T.MOVES.water_gun, '晴');
  ok(r3.dmg < r1.dmg, '晴天水系伤害降低');
}

// ---------- 2. 新游戏与成长曲线 ----------
section('新游戏');
T.newGame(4);
ok(T.getState().party.length === 1, '开局队伍 1 只');
ok(T.getState().party[0].name === '小火龙' && T.getState().party[0].level === 5, '御三家 Lv5');
ok(T.getState().money === 3000 && T.getState().bag['精灵球'] === 5, '初始金钱与道具');
ok(T.expForLevel('medium_fast', 100) === 1000000, '标准成长曲线满级经验');
ok(T.expForLevel('slow', 100) > T.expForLevel('fast', 100), '慢速组比快速组难练');

// ---------- 3. 野生战斗与升级 ----------
section('野生战斗');
T.newGame(4);
T.getState().party = [T.makeMon(5, 10, { nature: '勤奋' })]; // 10 级火恐龙，稳定取胜
const expBefore = T.getState().party[0].exp;
T.startWildBattle(16, 4); // 波波 Lv4
ok(T.getState().battle && T.getState().battle.kind === 'wild', '进入野生战斗');
let guard = 0;
while (T.getState().battle && !T.getState().battle.over && guard++ < 80) {
  T.battleMove(damageMoveIdx(T.getState().battle.player.mons[T.getState().battle.player.active]));
}
ok(T.getState().lastResult === 'win', '打赢野生宝可梦（回合数 ' + guard + '）');
ok(T.getState().party[0].exp > expBefore, '获得经验值');

// ---------- 4. 捕获 ----------
section('捕获');
T.newGame(7);
T.startWildBattle(16, 2);
seq = [0]; // 让随机数为 0 → 捕获判定必然成功
T.battleUseItem('精灵球');
ok(T.getState().party.length === 2, '捕获成功入队');
ok(T.getState().caughtDex[16] === true, '图鉴记录捕获');
seq = [];

// ---------- 5. 训练家战斗（不可逃跑）与奖励 ----------
section('训练家战斗');
T.newGame(1);
T.getState().party = [T.makeMon(3, 14, { nature: '勤奋' })];
T.startTrainerBattle(T.MAP_NODES.route1.trainers[0]);
ok(T.getState().battle.canRun === false, '训练家战不可逃跑');
T.battleRun();
ok(T.getState().battle && !T.getState().battle.over, '逃跑被阻止');
guard = 0;
while (T.getState().battle && !T.getState().battle.over && guard++ < 100) {
  const active = T.getState().battle.player.mons[T.getState().battle.player.active];
  T.battleMove(damageMoveIdx(active));
}
ok(T.getState().lastResult === 'win', '打赢训练家');
ok(T.getState().money === 3000 + 120, '获得奖金');
ok(T.getState().trainersDefeated['r1_t1'] === true, '训练家已击败标记');

// ---------- 6. 地图门槛 ----------
section('地图与徽章');
T.gotoNode('route1');
ok(T.getState().nodeId === 'route1', '可以进入 1 号道路');
T.gotoNode('viridian');
T.gotoNode('route2');
T.gotoNode('forest');
T.gotoNode('pewter');
ok(T.getState().nodeId === 'pewter', '到达尼比市');
ok(T.getState().lastTown === 'pewter', '城镇被记录为回城点');
T.gotoNode('route3');
ok(T.getState().nodeId === 'pewter', '无徽章时 3 号道路被拦截');

// ---------- 7. 道馆战与徽章奖励 ----------
section('道馆');
T.getState().party = [T.makeMon(6, 30, { nature: '勤奋' })];
T.startGymBattle(T.MAP_NODES.pewter.gym);
ok(T.getState().battle.kind === 'gym', '道馆战开始');
guard = 0;
while (T.getState().battle && !T.getState().battle.over && guard++ < 120) {
  const active = T.getState().battle.player.mons[T.getState().battle.player.active];
  const idx = active.m.moves.length - 1;
  T.battleMove(damageMoveIdx(active));
}
ok(T.getState().lastResult === 'win', '击败馆主小刚');
ok(T.getState().badges.indexOf('灰色徽章') !== -1, '获得灰色徽章');
ok(T.getState().bag['TM岩石封锁'] === 1, '获得 TM 岩石封锁');
{
  const normal = T.makeMon(95, 14, { nature: '勤奋' });
  const boss = T.makeMon(95, 14, { nature: '勤奋', statMult: 1.15 });
  ok(boss.stats.atk > normal.stats.atk && boss.stats.def > normal.stats.def, '馆主王牌全属性 +15% 生效');
}

// ---------- 8. 进化与学习面 ----------
section('进化与招式');
{
  const mon = T.makeMon(16, 17); // 波波 Lv17
  const log = [];
  T.grantExp(mon, T.expForLevel('medium_fast', 18) - mon.exp + 1, log);
  ok(mon.species === 17, '波波 Lv18 进化为比比鸟');
}
{
  const mon = T.makeMon(25, 20); // 皮卡丘
  T.getState().party = [mon];
  mon.moves = ['thundershock', 'growl', 'quick_attack', 'thunder_wave'];
  const log = [];
  T.tryLearnMove(mon, 'thunderbolt', log, false);
  ok(T.getState().pendingLearn.length === 1, '招式满时进入待学队列');
  const r = T.resolvePendingLearn('thunderbolt', 0);
  ok(r.ok && mon.moves[0] === 'thunderbolt', '替换第一个招式成功');
}
{
  const mon = T.makeMon(133, 30); // 伊布
  const evoLog = T.tryStoneEvolution(mon, '水之石');
  ok(evoLog && mon.species === 134 && mon.name === '水伊布', '水之石进化伊布');
}

// ---------- 8.5 性格 / 天气 / 携带道具（MVP2） ----------
section('性格、天气与携带道具');
{
  const iv = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
  const adamant = T.makeMon(4, 20, { iv: iv, nature: '固执' });
  const timid = T.makeMon(4, 20, { iv: iv, nature: '胆小' });
  ok(adamant.stats.atk > timid.stats.atk, '固执性格攻击更高');
  ok(adamant.stats.spe < timid.stats.spe, '固执性格速度更低');
  ok(adamant.nature === '固执' && timid.nature === '胆小', '性格已生成');
}
{
  const mtn = T.MAP_NODES.mtmoon;
  ok(mtn.weatherWeights['沙暴'] > 0 && mtn.pools['沙暴'], '月见山已配置沙暴区域与沙暴遭遇池');
  const rainPool = T.MAP_NODES.route24.pools['雨'];
  const dratini = rainPool.filter(function (p) { return p.id === 147; })[0];
  ok(dratini && dratini.w === 5, '24号道路雨天 5% 迷你龙');
  const total = rainPool.reduce(function (s, p) { return s + p.w; }, 0);
  ok(dratini && Math.abs(dratini.w / total - 0.05) < 0.001, '迷你龙权重占 5%');
}
{
  // 天气招式：卡咪龟 40 级应已学会祈雨，战斗中改变天气
  T.newGame(7);
  T.getState().party = [T.makeMon(8, 40, { nature: '勤奋' })];
  T.startWildBattle(16, 20);
  const b = T.getState().battle;
  const mon = b.player.mons[0];
  const idx = mon.m.moves.indexOf('rain_dance');
  ok(idx !== -1, '卡咪龟 Lv40 学会祈雨');
  T.battleMove(idx);
  ok(T.getState().battle && T.getState().battle.weather && T.getState().battle.weather.type === '雨', '祈雨改变战斗天气');
}
{
  // 电气球：皮卡丘携带后双攻翻倍
  const mk = function () { return T.makeMon(25, 30, { nature: '勤奋' }); };
  const def = T.makeMon(16, 30, { nature: '勤奋' });
  const withBall = mk(); withBall.held = '电气球';
  const noBall = mk();
  let sumA = 0, sumB = 0;
  for (let i = 0; i < 200; i++) {
    sumA += T.calcDamage({ m: withBall, stages: {} }, { m: def, stages: {} }, T.MOVES.thundershock, null).dmg;
    sumB += T.calcDamage({ m: noBall, stages: {} }, { m: def, stages: {} }, T.MOVES.thundershock, null).dmg;
  }
  ok(sumA > sumB * 1.5, '电气球使攻击翻倍（伤害显著提升）');
}

// ---------- 9. 火箭队事件 ----------
section('火箭队');
T.newGame(4);
T.getState().money = 10000;
T.resolveRocketSell(true);
ok(T.getState().money === 7000, '强买强卖扣款 3000');
ok(T.getState().party.length >= 2, '强买强卖获得宝可梦（鲤鱼王或稀有）');
{
  // 抢劫战败惩罚
  T.newGame(4);
  T.getState().money = 4000;
  T.getState().bag['金珠'] = 1;
  T.startRocketBattle('robbery');
  T.getState().battle.player.mons.forEach(function (bm) { bm.m.hp = 0; });
  T.endBattle('lose');
  ok(T.getState().money === 2000, '战败被抢走一半金钱');
  ok(T.getState().bag['金珠'] === undefined, '非关键道具金珠被没收');
  ok(T.getState().nodeId === 'pallet', '全灭回到最近城镇');
  ok(T.getState().party.every(function (m) { return m.hp === m.stats.hp; }), '宝可梦中心全员恢复');
}

// ---------- 10. 存档读档 ----------
// ---------- 9.5 MVP3：道馆连战 / 交换 / 钓鱼 / 宿敌 / 携带道具 ----------
section('MVP3：道馆踢馆与城镇事件');
{
  T.newGame(4);
  T.getState().nodeId = 'pewter';
  T.getState().party = [T.makeMon(6, 8, { nature: '勤奋' })];
  T.challengeGym();
  ok(!T.getState().battle, '首发等级不足时无法挑战道馆');
  ok(T.getState().log.some(function (l) { return l.indexOf('首发 Lv.10') !== -1; }), '提示等级门槛');
}
{
  T.newGame(4);
  T.getState().nodeId = 'pewter';
  T.getState().party = [T.makeMon(6, 25, { nature: '勤奋' })];
  T.challengeGym();
  ok(T.getState().battle && T.getState().battle.kind === 'gym_apprentice', '进入道馆学徒连战');
  let guard = 0;
  while (T.getState().battle && !T.getState().battle.over && guard++ < 200) {
    const active = T.getState().battle.player.mons[T.getState().battle.player.active];
    T.battleMove(damageMoveIdx(active));
  }
  ok(T.getState().lastResult === 'win', '连战全部获胜');
  ok(T.getState().badges.indexOf('灰色徽章') !== -1, '获得徽章');
  ok(T.getState().gymSession === null, '道馆会话正常结束');
  const gauntletLogs = T.getState().log.filter(function (l) { return l.indexOf('来不及休息') !== -1; }).length;
  ok(gauntletLogs === 2, '连续两场学徒战之间未自动恢复（战间提示 ' + gauntletLogs + ' 次）');
}
{
  // NPC 交换 + 1.5 倍经验
  T.newGame(7);
  T.getState().party.push(T.makeMon(19, 6, { nature: '勤奋' }));
  T.getState().townTrade = { give: 16, want: 19 };
  T.doTownTrade(true);
  const traded = T.getState().party.find(function (m) { return m.species === 16; });
  ok(!!traded && traded.tradeBonus, '交换获得波波并带 1.5 倍经验标记');
  const exp0 = traded.exp;
  T.grantExp(traded, 100, []);
  ok(traded.exp - exp0 === 150, '交换宝可梦经验 1.5 倍生效（+150）');
}
{
  // 钓鱼
  T.newGame(4);
  T.getState().keyItems.push('破旧钓竿');
  T.getState().nodeId = 'route24';
  T.fish();
  ok(T.getState().battle && [129, 120, 147, 130].indexOf(T.getState().battle.foe.mons[0].m.species) !== -1, '钓鱼遇到水边宝可梦');
}
{
  // 宿敌小茂
  T.newGame(4);
  T.getState().badges.push('灰色徽章');
  T.getState().nodeId = 'pewter';
  T.getState().party = [T.makeMon(6, 22, { nature: '勤奋' })];
  T.gotoNode('route3');
  ok(T.getState().battle && T.getState().battle.kind === 'rival', '宿敌小茂在 3 号道路拦截');
  ok(T.getState().battle.canRun === false, '宿敌战不可逃跑');
  let guard = 0;
  while (T.getState().battle && !T.getState().battle.over && guard++ < 100) {
    const active = T.getState().battle.player.mons[T.getState().battle.player.active];
    T.battleMove(damageMoveIdx(active));
  }
  ok(T.getState().rivalWon.indexOf('r3') !== -1, '击败小茂并记录');
}
{
  // 吃剩的东西
  T.newGame(7);
  T.getState().party = [T.makeMon(9, 20, { nature: '勤奋' })];
  T.getState().party[0].held = '吃剩的东西';
  T.getState().party[0].hp = Math.floor(T.getState().party[0].stats.hp * 0.8); // 先扣血，验证回合结束回复
  T.startWildBattle(16, 2);
  T.battleMove(0);
  ok(T.getState().log.some(function (l) { return l.indexOf('吃剩的东西') !== -1; }), '吃剩的东西回合结束回复生效');
}

// ---------- 9.7 MVP4：全图鉴与完整关都 ----------
section('MVP4：全图鉴与完整关都');
{
  const ids = Object.keys(T.POKEDEX).map(Number).filter(function (id) { return id >= 1 && id <= 151; });
  ok(ids.length === 151, '图鉴共 151 只（实际 ' + ids.length + '）');
  const bad = ids.filter(function (id) {
    const d = T.POKEDEX[id];
    return !d.base || !d.types || !d.learnset || !d.catchRate;
  });
  ok(bad.length === 0, '全部条目含种族值/属性/学习面/捕获率');
  ok(!!T.POKEDEX[151], '梦幻也在图鉴里');
}
{
  const gyms = ['pewter', 'cerulean', 'vermilion', 'celadon', 'saffron', 'fuchsia', 'cinnabar', 'viridian'];
  ok(gyms.every(function (id) { return T.MAP_NODES[id] && T.MAP_NODES[id].gym; }), '8 个道馆全部存在');
}
{
  // 地图连通性：从真新镇沿 next 可到达全部节点
  const seen = { pallet: true };
  const q = ['pallet'];
  while (q.length > 0) {
    const id = q.shift();
    (T.MAP_NODES[id].next || []).forEach(function (n) {
      if (!seen[n]) { seen[n] = true; q.push(n); }
    });
  }
  ok(Object.keys(T.MAP_NODES).length === Object.keys(seen).length,
    '全部地图节点连通（' + Object.keys(seen).length + '/' + Object.keys(T.MAP_NODES).length + '）');
}
{
  // 常磐道馆徽章门槛
  T.newGame(4);
  T.getState().nodeId = 'viridian';
  T.getState().badges = ['灰色徽章', '蓝色徽章', '橙色徽章', '彩虹徽章', '金色徽章', '粉红徽章'];
  T.getState().party = [T.makeMon(6, 60, { nature: '勤奋' })];
  T.challengeGym();
  ok(!T.getState().battle, '6 枚徽章时无法挑战常磐道馆');
}
{
  // 全道馆巡回：8 徽章通关
  T.newGame(4);
  T.getState().party = [
    T.makeMon(6, 60, { nature: '勤奋' }),
    T.makeMon(9, 60, { nature: '勤奋' }),
    T.makeMon(3, 60, { nature: '勤奋' }),
    T.makeMon(149, 60, { nature: '勤奋' })
  ];
  const order = ['pewter', 'cerulean', 'vermilion', 'celadon', 'saffron', 'fuchsia', 'cinnabar', 'viridian'];
  let allWin = true;
  for (let i = 0; i < order.length; i++) {
    T.getState().nodeId = order[i];
    T.challengeGym();
    let guard = 0;
    while (T.getState().battle && !T.getState().battle.over && guard++ < 300) {
      const active = T.getState().battle.player.mons[T.getState().battle.player.active];
      T.battleMove(damageMoveIdx(active));
    }
    if (T.getState().lastResult !== 'win') allWin = false;
    T.visitCenter();
  }
  ok(allWin, '8 大道馆全部挑战成功');
  ok(T.getState().badges.length === 8, '集齐 8 枚徽章');
}
{
  // 地图门槛：22号道路需要绿色徽章
  T.newGame(4);
  T.getState().nodeId = 'viridian';
  T.getState().party = [T.makeMon(6, 60, { nature: '勤奋' })];
  T.gotoNode('route22');
  ok(T.getState().nodeId === 'viridian', '无绿色徽章时 22 号道路被拦截');
  T.getState().badges.push('绿色徽章');
  T.gotoNode('route22');
  ok(T.getState().nodeId === 'route22', '持有绿色徽章后可进入 22 号道路');
  T.gotoNode('champion');
  ok(T.getState().nodeId === 'champion', '可进入冠军之路');
}

// ---------- 9.8 问题修复回归（招式数据 / 逃跑 / 闲逛白嫖） ----------
section('问题修复回归');
{
  // 全数据招式 ID 合法性
  const bad = [];
  Object.keys(T.POKEDEX).forEach(function (id) {
    const d = T.POKEDEX[id];
    Object.keys(d.learnset || {}).forEach(function (lv) {
      d.learnset[lv].forEach(function (mid) { if (!T.MOVES[mid]) bad.push(id + '/' + d.name + ' -> ' + mid); });
    });
    if (/宝可梦[0-9]+/.test(d.name || '')) bad.push('占位名 ' + id);
  });
  ok(bad.length === 0, '151 只的招式 ID 全部合法、无占位名');
  ok(T.POKEDEX[16].learnset[1].indexOf('gust') === -1, '波波 1 级不会起风（1号道路新手平衡）');
}
{
  // 生成图鉴的野生怪战斗不再崩溃
  T.newGame(4);
  T.getState().party = [T.makeMon(6, 25, { nature: '勤奋' })];
  T.startWildBattle(65, 20); // 胡地（生成条目）
  let guard = 0;
  while (T.getState().battle && !T.getState().battle.over && guard++ < 60) {
    T.battleMove(damageMoveIdx(T.getState().battle.player.mons[T.getState().battle.player.active]));
  }
  ok(['win', 'run', 'lose'].indexOf(T.getState().lastResult) !== -1, '胡地战斗正常结束（' + T.getState().lastResult + '）');
}
{
  // 铁甲蛹只会变硬，也不能把战斗拖死
  T.newGame(4);
  T.getState().party = [T.makeMon(6, 20, { nature: '勤奋' })];
  T.startWildBattle(11, 15);
  let guard = 0;
  while (T.getState().battle && !T.getState().battle.over && guard++ < 60) {
    T.battleMove(damageMoveIdx(T.getState().battle.player.mons[T.getState().battle.player.active]));
  }
  ok(!T.getState().battle || T.getState().battle.over, '铁甲蛹硬壳战在 ' + guard + ' 回合内结束');
}
{
  // 逃跑后战斗状态清空
  T.newGame(4);
  T.startWildBattle(16, 3);
  T.battleRun();
  ok(T.getState().battle === null && T.getState().lastResult === 'run', '逃跑后战斗状态清空');
}
{
  // 闲逛防白嫖：同一次到访只能触发一次事件
  T.newGame(4);
  T.getState().wanderUsed = true;
  const before = JSON.stringify(T.getState().bag);
  T.wanderTown();
  const after = JSON.stringify(T.getState().bag);
  ok(after === before, '已逛过的镇不会再送道具');
  T.gotoNode('route1');
  T.gotoNode('pallet');
  ok(T.getState().wanderUsed === false, '重新进镇后恢复闲逛次数');
}

// ---------- 9.9 战斗完整性模糊回归（卡死/拖死） ----------
section('战斗完整性模糊回归');
ok(T.POKEDEX[11].learnset[1].indexOf('tackle') !== -1 && T.POKEDEX[14].learnset[1].indexOf('tackle') !== -1, '铁甲蛹/铁壳蛹自带撞击');
{
  // 吸取回复量回归：吸血按"造成伤害"回复，超音蝠无法无限回血拖死战斗
  T.newGame(4);
  T.getState().party = [T.makeMon(123, 21, { nature: '勤奋' })]; // 飞天螳螂
  T.startWildBattle(41, 10); // 超音蝠
  let g = 0;
  while (T.getState().battle && !T.getState().battle.over && g++ < 60) {
    T.battleMove(strongMoveIdx(T.getState().battle));
  }
  ok(['win', 'run', 'lose'].indexOf(T.getState().lastResult) !== -1, '飞天螳螂 vs 超音蝠在 ' + g + ' 回合内结束（' + T.getState().lastResult + '）');
}
{
  const allIds = Object.keys(T.POKEDEX).map(Number).filter(function (id) { return id >= 1 && id <= 151; });
  const trainers = [T.MAP_NODES.route1.trainers[0], T.MAP_NODES.route3.trainers[0], T.MAP_NODES.mtmoon.trainers[0]];
  let bad = 0, crash = 0, timeout = 0;
  for (let r = 0; r < 500; r++) {
    T.newGame(1 + Math.floor(Math.random() * 3));
    const lvl = 5 + Math.floor(Math.random() * 30);
    T.getState().party = [T.makeMon(allIds[Math.floor(Math.random() * allIds.length)], lvl, { nature: '勤奋' })];
    const mode = Math.random();
    if (mode < 0.5) {
      T.startWildBattle(allIds[Math.floor(Math.random() * allIds.length)], Math.max(2, lvl - 2 + Math.floor(Math.random() * 6)));
    } else if (mode < 0.8) {
      T.startTrainerBattle(trainers[Math.floor(Math.random() * trainers.length)]);
    } else {
      T.getState().nodeId = 'pewter';
      T.startGymBattle(T.MAP_NODES.pewter.gym);
    }
    let g = 0;
    while (T.getState().battle && !T.getState().battle.over && g++ < 60) {
      const cur = T.getState().battle;
      const pa = cur.player.mons[cur.player.active];
      const fa = cur.foe.mons[cur.foe.active];
      if (pa.m.hp <= 0 || fa.m.hp <= 0) { bad++; break; }
      try { T.battleMove(strongMoveIdx(cur)); }
      catch (e) { crash++; break; }
    }
    if (g >= 60 && T.getState().battle && !T.getState().battle.over) timeout++;
  }
  ok(bad === 0, '500 场随机战斗无在场怪血量为 0 的卡死');
  ok(crash === 0, '500 场随机战斗无崩溃');
  ok(timeout === 0, '500 场随机战斗无 60 回合拖死');
}

// ---------- 9.9.5 队伍首发设置 ----------
section('队伍首发设置');
{
  T.newGame(4);
  T.getState().party.push(T.makeMon(16, 5, { nature: '勤奋' })); // 波波
  ok(T.getState().party[0].species === 4, '初始首发为小火龙');
  T.setLeadMon(1);
  ok(T.getState().party[0].species === 16, '设置后首发变为波波');
  T.startWildBattle(19, 3);
  ok(T.getState().battle.player.mons[0].m.species === 16, '战斗默认派出首发波波');
}

// ---------- 9.9.6 MVP4：支线（双子岛 / 圣安奴号 / 鲤鱼王大叔）与技能表 ----------
section('MVP4 支线与技能表扩充');
{
  const gyms = ['pewter', 'cerulean', 'vermilion', 'celadon', 'saffron', 'fuchsia', 'cinnabar', 'viridian'];
  const tms = gyms.map(function (id) { return 'TM' + T.MAP_NODES[id].gym.tm; });
  ok(tms.every(function (name) { return T.ITEMS[name] && T.MOVES[T.ITEMS[name].move]; }), '8 枚道馆 TM 道具与招式均完整');
}
{
  ok(!!T.MAP_NODES.seafoam, '双子岛节点存在');
  ok(T.MAP_NODES.seafoam.pools['晴'].some(function (p) { return p.id === 144; }), '双子岛可遭遇急冻鸟');
  ok(T.MAP_NODES.route19.next.indexOf('seafoam') !== -1 && T.MAP_NODES.seafoam.next.indexOf('cinnabar') !== -1, '双子岛连通 19 号水路与红莲岛');
}
{
  T.newGame(4);
  T.getState().party = [T.makeMon(9, 30, { nature: '勤奋' })]; // 水箭龟，稳胜
  T.getState().nodeId = 'vermilion';
  T.wanderTown();
  ok(T.getState().battle && T.getState().battle.kind === 'ssanne', '枯叶市闲逛触发圣安奴号支线');
  let g = 0;
  while (T.getState().battle && !T.getState().battle.over && g++ < 80) {
    T.battleMove(strongMoveIdx(T.getState().battle));
  }
  ok(T.getState().ssAnneDone === true, '圣安奴号支线完成标记');
  ok(T.getState().bag['TM居合斩'] === 1, '获得 TM 居合斩');
}
{
  T.newGame(4);
  T.getState().nodeId = 'cerulean';
  T.getState().money = 5000;
  T.wanderTown();
  ok(T.getState().magikarpOffer === true, '华蓝市触发鲤鱼王大叔支线');
  T.resolveMagikarpOffer(true);
  ok(T.getState().money === 4500, '购买鲤鱼王扣款 500');
  const hasMagikarp = T.getState().party.concat(T.getState().box).some(function (m) { return m.species === 129; });
  ok(hasMagikarp && T.getState().magikarpDone, '获得鲤鱼王并标记支线完成');
}
{
  const moveIds = Object.keys(T.MOVES);
  ok(moveIds.length >= 354, '技能表覆盖 Gen1-3 全部招式（实际 ' + moveIds.length + '）');
  ok(!!T.MOVES.fake_out && !!T.MOVES.psycho_boost && !!T.MOVES.aeroblast, 'Gen1-3 标志性招式已补齐');
  const bad = moveIds.filter(function (id) {
    const mv = T.MOVES[id];
    return !mv || !mv.name || !mv.type || !mv.category || mv.power === undefined || mv.acc === undefined || !mv.pp;
  });
  ok(bad.length === 0, '全部技能字段完整');
  const effKinds = { stat: 1, status: 1, confuse: 1, protect: 1, weather: 1, leech: 1, heal: 1, priority: 1, multi: 1, flinch: 1, recoil: 1, recharge: 1, fixed: 1, fixedLevel: 1, dream: 1, selfConfuse: 1, trap: 1 };
  const badEff = moveIds.filter(function (id) {
    const e = T.MOVES[id].effect;
    return e && !effKinds[e.kind];
  });
  ok(badEff.length === 0, '全部技能效果类型合法');
}

// ---------- 9.9.7 平衡性回归 ----------
section('平衡性回归');
{
  let badPool = 0, badTrainer = 0;
  Object.keys(T.MAP_NODES).forEach(function (id) {
    const n = T.MAP_NODES[id];
    Object.keys(n.pools || {}).forEach(function (w) {
      (n.pools[w] || []).forEach(function (p) { if (!T.POKEDEX[p.id] || !(p.w > 0)) badPool++; });
    });
    (n.trainers || []).forEach(function (t) {
      t.party.forEach(function (p) {
        if (!T.POKEDEX[p.id]) badTrainer++;
        (p.moves || []).forEach(function (m) { if (!T.MOVES[m]) badTrainer++; });
      });
    });
  });
  ok(badPool === 0 && badTrainer === 0, '全部遭遇池/训练家数据合法（含新地图与支线）');
}
{
  const order = ['pewter', 'cerulean', 'vermilion', 'celadon', 'saffron', 'fuchsia', 'cinnabar', 'viridian'];
  let inc = true;
  for (let i = 1; i < order.length; i++) {
    if (T.MAP_NODES[order[i]].gym.minLevel <= T.MAP_NODES[order[i - 1]].gym.minLevel) inc = false;
  }
  ok(inc, '道馆等级门槛逐馆递增');
}
{
  const starters = [1, 4, 7];
  const okStarters = starters.every(function (id) {
    const ls = T.POKEDEX[id].learnset || {};
    return Object.keys(ls).some(function (lv) {
      return +lv <= 15 && ls[lv].some(function (m) { return T.MOVES[m] && T.MOVES[m].power > 0; });
    });
  });
  ok(okStarters, '御三家 15 级前都有可用的伤害招式');
}
{
  let badLevel = 0;
  Object.keys(T.MAP_NODES).forEach(function (id) {
    const n = T.MAP_NODES[id];
    if (n.levels && !(n.levels[0] > 0 && n.levels[1] >= n.levels[0])) badLevel++;
  });
  ok(badLevel === 0, '全部节点遭遇等级区间合法');
}
{
  // 稀有度/捕获率：前期路线宝可梦应当好抓，传说宝可梦极难抓
  ok(T.POKEDEX[16].catchRate > 100 && T.POKEDEX[144].catchRate <= 10, '波波易抓、急冻鸟极难抓（捕获率合理）');
}

// ---------- 10. 存档读档 ----------
section('存档');
T.newGame(4);
T.gotoNode('route1');
T.startWildBattle(19, 3);
T.battleMove(0);
T.save();
ok(T.hasSave(), '存档写入');
const before = JSON.stringify(T.getState().party.map(function (m) {
  return { species: m.species, level: m.level, hp: m.hp, nature: m.nature, held: m.held };
}));
T.getState().party = [];
T.getState().nodeId = 'pallet';
T.getState().screen = 'title';
ok(T.load(), '读档成功');
const after = JSON.stringify(T.getState().party.map(function (m) {
  return { species: m.species, level: m.level, hp: m.hp, nature: m.nature, held: m.held };
}));
ok(before === after, '读档后队伍一致');
ok(T.getState().nodeId === 'route1', '读档后位置一致');
T.resetGame();
ok(!T.getState().battle && T.getState().screen === 'title' && !T.hasSave(), '重置回标题并清除存档');

// ---------- 10.5 MVP7：招式 PP ----------
section('MVP7：招式 PP');
{
  T.newGame(4);
  const mon = T.getState().party[0];
  const maxPp = mon.pp[0];
  ok(mon.pp && mon.pp.length === mon.moves.length, '生成招式时带 PP');
  T.startWildBattle(16, 2);
  T.battleMove(0);
  ok(mon.pp[0] === maxPp - 1, '使用招式后 PP -1');
  mon.pp = mon.moves.map(function () { return 0; });
  const turnBefore = T.getState().battle.turn;
  T.battleMove(0);
  ok(T.getState().battle.turn === turnBefore, 'PP 耗尽时无法出招');
  T.visitCenter();
  ok(mon.pp[0] === maxPp, '宝可梦中心回复 PP');
}
{
  T.newGame(4);
  T.getState().party[0].pp[0] = 3;
  T.save();
  T.getState().party = [];
  T.load();
  ok(T.getState().party[0].pp[0] === 3, '存档读档保留 PP');
}

// ---------- 10.6 MVP8：商店提价与探索金币事件 ----------
section('MVP8：商店提价与探索金币事件');
{
  ok(T.ITEMS['高级球'].price === 4000 && T.ITEMS['大师球'].price === 50000, '后期道具价格已上调');
  ok(T.ITEMS['雷之石'].price === 5000 && T.ITEMS['幸运蛋'].price === 20000, '进化石/持有道具价格上调');
  T.newGame(4);
  ok(T.getMartStock().indexOf('大师球') === -1, '0徽章商店无大师球');
  T.getState().badges = ['灰色徽章', '蓝色徽章', '橙色徽章', '彩虹徽章', '金色徽章', '粉红徽章', '深红徽章', '绿色徽章'];
  ok(T.getMartStock().indexOf('大师球') !== -1 && T.getMartStock().indexOf('幸运蛋') !== -1, '8徽章解锁大师球/幸运蛋');
}
{
  T.newGame(4);
  const mon = T.getState().party[0];
  mon.status = '中毒';
  T.getState().bag['万灵药'] = 1;
  T.useBagItemOnMon('万灵药', 0);
  ok(mon.status === null && T.getState().bag['万灵药'] === undefined, '万灵药治愈任意异常');
}
{
  T.newGame(4);
  const mon = T.getState().party[0];
  mon.pp = mon.moves.map(function () { return 0; });
  T.getState().bag['PP回复药'] = 1;
  T.useBagItemOnMon('PP回复药', 0);
  ok(mon.pp[0] === 10 && T.getState().bag['PP回复药'] === undefined, 'PP回复药回复10点');
}
{
  const mon = T.makeMon(4, 20, { nature: '勤奋' });
  mon.held = '幸运蛋';
  const exp0 = mon.exp;
  T.grantExp(mon, 100, []);
  ok(mon.exp - exp0 === 150, '幸运蛋经验 1.5 倍');
}
{
  T.newGame(7);
  T.startWildBattle(16, 2);
  T.getState().bag['大师球'] = 1;
  T.battleUseItem('大师球');
  ok(T.getState().party.length === 2 && T.getState().caughtDex[16] === true, '大师球必定捕获');
}
{
  T.newGame(4);
  T.getState().bag['喷雾剂'] = 1;
  T.useRepel();
  ok(T.getState().repel === 10 && T.getState().bag['喷雾剂'] === undefined, '使用喷雾剂');
  T.getState().nodeId = 'route1';
  T.explore();
  ok(T.getState().repel === 9 && !T.getState().battle, '喷雾剂生效，不遇野生');
}
{
  T.newGame(4);
  T.getState().money = 10000;
  T.getState().merchantOffer = { kind: 'item', name: '高级球', price: 3000 };
  T.resolveMerchantOffer(true);
  ok(T.getState().money === 7000 && T.getState().bag['高级球'] === 1, '神秘商人购买道具');
}
{
  T.newGame(4);
  T.getState().nodeId = 'route1';
  T.startMerchantOffer();
  ok(!!T.getState().merchantOffer, '探索触发神秘商人');
}
{
  T.newGame(4);
  T.getState().money = 5000;
  T.getState().banditToll = true;
  T.getState().banditPrice = 800;
  T.resolveBandit(true);
  ok(T.getState().money === 4200 && T.getState().banditToll === false, '强盗付费过路');
}
{
  T.newGame(4);
  T.getState().nodeId = 'route1';
  T.getState().banditToll = true;
  T.resolveBandit(false);
  ok(T.getState().battle && T.getState().battle.kind === 'bandit' && !T.getState().battle.canRun, '强盗开战');
}
{
  T.newGame(4);
  const mon = T.getState().party[0];
  mon.hp = 1;
  T.getState().money = 5000;
  T.getState().medicOffer = true;
  T.resolveMedic('heal');
  ok(T.getState().money === 4200 && mon.hp === mon.stats.hp, '旅行补给商回血');
}
{
  T.newGame(4);
  const mon = T.getState().party[0];
  mon.pp = mon.moves.map(function () { return 0; });
  T.getState().money = 5000;
  T.getState().medicOffer = true;
  T.resolveMedic('pp');
  ok(T.getState().money === 3500 && mon.pp[0] > 0, '旅行补给商回PP');
}

// ---------- 10.7 MVP8.1：天气偏向道具 ----------
section('MVP8.1：天气偏向道具');
{
  T.newGame(4);
  T.getState().bag['求雨符'] = 1;
  T.useWeatherItem('求雨符');
  ok(T.getState().weatherBias && T.getState().weatherBias.type === '雨' && T.getState().weatherBias.steps === 10, '求雨符设置天气偏向');
  ok(T.getState().bag['求雨符'] === undefined, '求雨符被消耗');
  for (let i = 0; i < 10; i++) T.refreshWeather(false);
  ok(T.getState().weatherBias === null, '天气偏向 10 次探索后结束');
}
{
  T.newGame(4);
  T.getState().bag['气象罗盘'] = 1;
  T.useWeatherItem('气象罗盘');
  ok(T.getState().weatherBoost === 10 && T.getState().bag['气象罗盘'] === undefined, '气象罗盘设置刷新概率翻倍');
  ok(['晴', '雨', '雷阵雨', '沙暴'].indexOf(T.rollWeather('pallet', '沙暴')) !== -1, '偏向天气 roll 正常');
}

// ---------- 11. 商店 ----------
section('商店');
T.newGame(4);
T.getState().money = 5000;
ok(T.getMartStock().indexOf('精灵球') !== -1 && T.getMartStock().indexOf('好伤药') === -1, '0 徽章货架');
T.getState().badges.push('灰色徽章', '蓝色徽章');
ok(T.getMartStock().indexOf('好伤药') !== -1, '2 徽章解锁好伤药');
T.buyItem('好伤药');
ok(T.getState().bag['好伤药'] === 1 && T.getState().money === 5000 - 700, '购买成功');
T.sellItem('精灵球');
ok(T.getState().money === 5000 - 700 + 100 && T.getState().bag['精灵球'] === 4, '半价出售成功');

// ---------- 12. 2026-08-13 bug 修复回归 ----------
section('bug 修复回归（双灭 / 捕获残留 / 战斗道具 / 电脑箱 / 学招存档）');
{
  // 双灭：最后一只宝可梦与敌方同回合倒下 → 判负并回城恢复，不会留下全灭队伍
  T.newGame(4);
  const s = T.getState();
  s.party = [T.makeMon(4, 30, { nature: '勤奋' })];
  const mon = s.party[0];
  mon.moves = ['double_edge'];
  mon.pp = [15];
  mon.hp = 8; // 压低血量保证反伤致死
  T.startWildBattle(129, 2);
  let g = 0;
  while (s.battle && !s.battle.over && g++ < 30) T.battleMove(0);
  ok(s.lastResult === 'lose', '双灭判定为败北（last=' + s.lastResult + '）');
  ok(s.party.every(function (m) { return m.hp === m.stats.hp; }), '双灭后队伍在宝可梦中心恢复');
  T.startWildBattle(16, 2);
  ok(!!s.battle && !s.battle.over, '双灭后仍可正常探索开战');
  while (s.battle && !s.battle.over && g++ < 30) {
    const active = s.battle.player.mons[s.battle.player.active];
    T.battleMove(damageMoveIdx(active));
  }
}
{
  // 捕获成功后清空战斗状态（大师球 / 普通球）
  T.newGame(4);
  const s = T.getState();
  s.bag['大师球'] = 1;
  T.startWildBattle(16, 2);
  T.battleUseItem('大师球');
  ok(s.battle === null && s.lastResult === 'caught', '大师球捕获后战斗状态清空');
  T.newGame(4);
  const s2 = T.getState();
  T.startWildBattle(16, 2);
  seq = [0]; // 捕获必成功
  T.battleUseItem('精灵球');
  seq = [];
  ok(s2.battle === null && s2.lastResult === 'caught', '精灵球捕获后战斗状态清空');
}
{
  // 战斗内满血/无异常用药不消耗
  T.newGame(4);
  const s = T.getState();
  s.bag['伤药'] = 2;
  s.party[0].hp = s.party[0].stats.hp;
  T.startWildBattle(16, 2);
  T.battleUseItem('伤药');
  ok(s.bag['伤药'] === 2, '战斗内满血使用伤药不消耗');
  while (s.battle && !s.battle.over && s.battle.turn < 30) {
    const active = s.battle.player.mons[s.battle.player.active];
    T.battleMove(damageMoveIdx(active));
  }
  T.newGame(4);
  const s2 = T.getState();
  s2.bag['解毒药'] = 1;
  T.startWildBattle(16, 2);
  T.battleUseItem('解毒药');
  ok(s2.bag['解毒药'] === 1, '战斗内无异常使用解毒药不消耗');
  T.newGame(4);
  const s3 = T.getState();
  s3.bag['万灵药'] = 1;
  T.startWildBattle(16, 2);
  T.battleUseItem('万灵药');
  ok(s3.bag['万灵药'] === 1, '战斗内无异常使用万灵药不消耗');
}
{
  // 电脑箱：队伍满时捕获进箱，可取回交换
  T.newGame(4);
  const s = T.getState();
  for (let i = 0; i < 5; i++) s.party.push(T.makeMon(16 + i, 5));
  s.bag['大师球'] = 1;
  T.startWildBattle(25, 3);
  T.battleUseItem('大师球');
  ok(s.box.length === 1 && s.party.length === 6, '队伍满时捕获进电脑箱');
  T.boxSwap(0, 0);
  ok(s.party[0].species === 25 && s.box[0].species === 4, '电脑箱取回交换成功');
  T.boxSwap(0, 1);
  ok(s.box[0].species === 16 && s.party[1].species === 4, '再次交换回队伍');
}
{
  // 学招待选随存档保存
  T.newGame(4);
  const s = T.getState();
  const mon = s.party[0];
  mon.moves = ['tackle', 'growl', 'tail_whip', 'leer'];
  mon.pp = [35, 40, 30, 30];
  T.grantExp(mon, T.expForLevel(mon.speciesData.growth, 6) - mon.exp + 1, []);
  const learnCount = s.pendingLearn.length;
  ok(learnCount >= 1, '4 招满时升级产生学招待选（' + learnCount + ' 个）');
  T.save();
  s.party = [];
  s.pendingLearn = [];
  ok(T.load(), '读档成功');
  ok(T.getState().pendingLearn.length === learnCount, '学招待选随存档保存并在读档后恢复');
}

console.log('\n========== 结果：' + passed + ' 通过 / ' + failed + ' 失败 ==========');
process.exit(failed > 0 ? 1 : 0);
