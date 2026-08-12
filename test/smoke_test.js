/* 逻辑冒烟测试：加载全部源码并在模拟上下文中跑完整流程
   Created by haodongsheng
   用法: node test/smoke_test.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const files = ['js/data/typechart.js', 'js/data/moves.js', 'js/data/pokedex.js', 'js/data/maps.js', 'js/core.js'];
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
  '  battleMove: battleMove, battleUseItem: battleUseItem, battleSwitch: battleSwitch, battleRun: battleRun,\n' +
  '  resolveRocketSell: resolveRocketSell, visitCenter: visitCenter, getMartStock: getMartStock,\n' +
  '  buyItem: buyItem, sellItem: sellItem, startBattle: startBattle, endBattle: endBattle\n' +
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
    if (T.MOVES[mon.m.moves[i]].power > 0) return i;
  }
  return 0;
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
T.getState().party = [T.makeMon(6, 22, { nature: '勤奋' })];
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

console.log('\n========== 结果：' + passed + ' 通过 / ' + failed + ' 失败 ==========');
process.exit(failed > 0 ? 1 : 0);
