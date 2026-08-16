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
  '  FISH_POOLS: FISH_POOLS, FISH_POOL_FALLBACK: FISH_POOL_FALLBACK,\n' +
  '  typeEffectiveness: typeEffectiveness, calcDamage: calcDamage, makeMon: makeMon, rarityOf: rarityOf, stoneTargets: stoneTargets,\n' +
  '  learnableMoves: learnableMoves, moveReplaceCost: moveReplaceCost, replaceMove: replaceMove, acquisitionPaths: acquisitionPaths,\n' +
  '  grantExp: grantExp, tryLearnMove: tryLearnMove, resolvePendingLearn: resolvePendingLearn,\n' +
  '  tryStoneEvolution: tryStoneEvolution, expForLevel: expForLevel,\n' +
  '  newGame: newGame, gotoNode: gotoNode, explore: explore, save: save, load: load, hasSave: hasSave, resetGame: resetGame,\n' +
  '  startWildBattle: startWildBattle, startTrainerBattle: startTrainerBattle, startGymBattle: startGymBattle,\n' +
  '  startRocketBattle: startRocketBattle,\n' +
  '  startRocketWarehouseBattle: startRocketWarehouseBattle, useEggItem: useEggItem,\n' +
  '  challengeGym: challengeGym, fish: fish, doTownTrade: doTownTrade,\n' +
  '  startTowerFloor: startTowerFloor, startSuperTowerFloor: startSuperTowerFloor, towerFoeTeam: towerFoeTeam, towerThemeFor: towerThemeFor,\n' +
  '  TITLES: TITLES, titleName: titleName, titleLabel: titleLabel, RARITIES: RARITIES, rarityIndex: rarityIndex,\n' +
  '  parseTitleEntry: parseTitleEntry, titleCounts: titleCounts, titleCount: titleCount, addTitle: addTitle,\n' +
  '  randomTitleRarity: randomTitleRarity, rollTitleBox: rollTitleBox, isTitleUnlocked: isTitleUnlocked,\n' +
  '  equipTitle: equipTitle, synthesizeTitle: synthesizeTitle, dismantleTitle: dismantleTitle,\n' +
  '  exchangeTitle: exchangeTitle, equippedTitleBonus: equippedTitleBonus, titleBonusMap: titleBonusMap, effStat: effStat,\n' +
  '  startRivalBattle: startRivalBattle, getRivalStarter: getRivalStarter,\n' +
  '  setLeadMon: setLeadMon, boxSwap: boxSwap, startSSAnne: startSSAnne, resolveMagikarpOffer: resolveMagikarpOffer,\n' +
  '  transferMon: transferMon, boxTransferFee: boxTransferFee, allocateExp: allocateExp, candyForSpecies: candyForSpecies,\n' +
  '  addBond: addBond,\n' +
  '  useRepel: useRepel, useEscapeRope: useEscapeRope, startMerchantOffer: startMerchantOffer, resolveMerchantOffer: resolveMerchantOffer,\n' +
  '  startBanditEvent: startBanditEvent, resolveBandit: resolveBandit,\n' +
  '  startMedicOffer: startMedicOffer, resolveMedic: resolveMedic,\n' +
  '  useWeatherItem: useWeatherItem,\n' +
  '  rollWeather: rollWeather, refreshWeather: refreshWeather,\n' +
  '  battleMove: battleMove, battleUseItem: battleUseItem, battleSwitch: battleSwitch, battleRun: battleRun,\n' +
  '  resolveRocketSell: resolveRocketSell, visitCenter: visitCenter, getMartStock: getMartStock,\n' +
  '  buyItem: buyItem, sellItem: sellItem, useBagItemOnMon: useBagItemOnMon, startBattle: startBattle, endBattle: endBattle,\n' +
  '  wanderTown: wanderTown,\n' +
  '  randomPlayerName: randomPlayerName, renamePlayer: renamePlayer,\n' +
  '  getTeleportCost: getTeleportCost, chargeTeleport: chargeTeleport,\n' +
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
  const tradedMon = T.makeMon(19, 6, { nature: '勤奋' });
  tradedMon.held = '电气球'; // 换走的宝可梦带携带物
  T.getState().party.push(tradedMon);
  T.getState().townTrade = { give: 16, want: 19 };
  T.doTownTrade(true);
  const traded = T.getState().party.find(function (m) { return m.species === 16; });
  ok(!!traded && traded.tradeBonus, '交换获得波波并带 1.5 倍经验标记');
  ok(T.getState().bag['电气球'] === 1, '交换后旧宝可梦携带物退回背包');
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
  ok(T.getState().battle && T.FISH_POOLS.route24.some(function (p) { return p.id === T.getState().battle.foe.mons[0].m.species; }), '钓鱼遇到该水域池中的宝可梦');
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
  T.getState().party[0].stats.spe = 999; // 速度碾压：逃跑必成功
  T.startWildBattle(16, 3);
  T.battleRun();
  ok(T.getState().battle === null && T.getState().lastResult === 'run', '逃跑后战斗状态清空');
}
{
  // 闲逛防白嫖：同一次到访只能触发一次事件
  T.newGame(4);
  const s = T.getState();
  s.wanderUsed = true;
  const before = JSON.stringify(T.getState().bag);
  T.wanderTown();
  const after = JSON.stringify(T.getState().bag);
  ok(after === before, '已逛过的镇不会再送道具');
  ok(T.getState().log.some(function (l) { return l.indexOf('没有什么特别的发现') !== -1; }), '未刷新时输出无收益过渡文本');
  T.gotoNode('route1');
  T.gotoNode('pallet');
  ok(T.getState().wanderUsed === true, '未打够野外遭遇战，重新进镇不重置闲逛');
  for (let i = 0; i < 3; i++) {
    T.startWildBattle(16, 2);
    let g = 0;
    while (T.getState().battle && !T.getState().battle.over && g++ < 30) {
      const active = T.getState().battle.player.mons[T.getState().battle.player.active];
      T.battleMove(damageMoveIdx(active));
    }
  }
  ok(T.getState().wildBattles >= 3, '野外遭遇战计数累计');
  T.gotoNode('route1');
  T.gotoNode('pallet');
  ok(T.getState().wanderUsed === false, '3 场野外遭遇战后重新进镇恢复闲逛');
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
  const effKinds = { stat: 1, status: 1, confuse: 1, protect: 1, weather: 1, leech: 1, heal: 1, rest: 1, priority: 1, multi: 1, flinch: 1, recoil: 1, recharge: 1, fixed: 1, fixedLevel: 1, dream: 1, selfConfuse: 1, trap: 1 };
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
  // 平衡：小火龙线/卡比兽不再过早拿到超模招式
  ok(!T.POKEDEX[4].learnset[34] || T.POKEDEX[4].learnset[34].indexOf('flamethrower') === -1, '小火龙 Lv34 不再学喷射火焰');
  ok(T.POKEDEX[4].learnset[40].indexOf('flamethrower') !== -1, '喷射火焰延后到 Lv40');
  ok(T.POKEDEX[143].learnset[50].indexOf('hyper_beam') === -1 && T.POKEDEX[143].learnset[40].indexOf('double_edge') === -1, '卡比兽不再学破坏光线/舍身冲撞');
  ok(T.POKEDEX[143].learnset[40].indexOf('body_slam') !== -1 && T.POKEDEX[143].learnset[50].indexOf('earthquake') !== -1, '卡比兽改用泰山压顶/地震');
  ok(T.POKEDEX[143].learnset[30].indexOf('swords_dance') === -1, '卡比兽不再有剑舞强化');
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
  T.getState().battle.foe.mons[0].m.stats.hp = 999; // 高血量：PP 测试聚焦扣减逻辑，不受暴击/先手秒杀影响
  T.getState().battle.foe.mons[0].m.hp = 999;
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
{
  // 批量购买/出售
  T.newGame(4);
  const s = T.getState();
  s.money = 5000;
  T.buyItem('精灵球', 3);
  ok(s.bag['精灵球'] === 8 && s.money === 5000 - 600, '批量购买 3 个精灵球扣 600 金');
  T.sellItem('精灵球', 2);
  ok(s.bag['精灵球'] === 6 && s.money === 5000 - 600 + 200, '批量出售 2 个精灵球得 200 金');
  const moneyBefore = s.money;
  T.buyItem('高级球', 10); // 4000*10 远超余额
  ok(s.money === moneyBefore && (s.bag['高级球'] || 0) === 0, '批量购买超出余额时被拦截');
  const cntBefore = s.bag['精灵球'];
  T.sellItem('精灵球', 99);
  ok(s.bag['精灵球'] === cntBefore, '批量出售超出持有数时被拦截');
}

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
  for (let i = 0; i < 3; i++) s.party.push(T.makeMon(16 + i, 5));
  s.bag['大师球'] = 1;
  T.startWildBattle(25, 3);
  T.battleUseItem('大师球');
  ok(s.box.length === 1 && s.party.length === 4, '队伍满（4只）时捕获进电脑箱');
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
{
  // 宝可梦中心按队伍平均等级收费（软性续航成本）
  T.newGame(4);
  const s = T.getState();
  const moneyBefore = s.money;
  s.party[0].hp = 1;
  T.visitCenter();
  ok(s.money === moneyBefore - 50, '宝可梦中心按平均等级收费（Lv5 收 50 金）');
  ok(s.party[0].hp === s.party[0].stats.hp, '宝可梦中心恢复生效');
}
{
  // 满血满 PP 去宝可梦中心不收费
  T.newGame(4);
  const s = T.getState();
  const moneyBefore = s.money;
  const logLen = s.log.length;
  T.visitCenter();
  ok(s.money === moneyBefore, '满血满 PP 去宝可梦中心不收费');
  ok(s.log.slice(logLen).some(function (l) { return l.indexOf('精神满满') !== -1; }), '满血时有对应提示文案');
}
{
  // 仅 PP 未满：仍算需要恢复，正常收费
  T.newGame(4);
  const s = T.getState();
  s.party[0].pp = s.party[0].pp.map(function (p) { return p - 1; });
  const moneyBefore = s.money;
  T.visitCenter();
  ok(s.money === moneyBefore - 50, '仅 PP 未满时正常收费并恢复');
  ok(s.party[0].pp.every(function (p, i) { return p === T.MOVES[s.party[0].moves[i]].pp; }), 'PP 恢复满');
}
{
  // 仅异常状态：仍算需要恢复，正常收费
  T.newGame(4);
  const s = T.getState();
  s.party[0].status = '中毒';
  const moneyBefore = s.money;
  T.visitCenter();
  ok(s.money === moneyBefore - 50, '仅异常状态时正常收费');
  ok(!s.party[0].status, '异常状态被治愈');
}
{
  // 日志着色标记与日志行一一对应
  T.newGame(4);
  const s = T.getState();
  s.party = [T.makeMon(4, 15, { nature: '勤奋' })];
  T.startWildBattle(129, 15);
  let g = 0;
  while (s.battle && !s.battle.over && g++ < 40) {
    const active = s.battle.player.mons[s.battle.player.active];
    T.battleMove(damageMoveIdx(active));
  }
  ok(s.logKinds.length === s.log.length, '日志着色标记与日志行一一对应');
  ok(s.logKinds.some(function (k) { return k === 'player'; }), '日志含玩家侧着色标记');
  ok(s.logKinds.some(function (k) { return k === 'foe'; }), '日志含敌方侧着色标记');
  ok(s.logKinds.some(function (k) { return k === 'good'; }), '日志含正向反馈着色标记');
}
{
  // 回合日志不重复输出（此前 log.forEach 对累积数组重复 flush，每行输出 3 遍）
  T.newGame(4);
  const s = T.getState();
  s.party = [T.makeMon(4, 15, { nature: '勤奋' })];
  s.party[0].moves = ['ember'];
  s.party[0].pp = [25];
  T.startWildBattle(74, 10); // 小拳石抗火，保证双方都会出手
  const start = s.log.length;
  T.battleMove(0);
  const turn = s.log.slice(start);
  const used = turn.filter(function (l) { return l.indexOf('使用了') !== -1; });
  ok(used.length === 2, '单回合双方出招各记录一次（used=' + used.length + '）');
  const seen = {};
  let dup = 0;
  turn.forEach(function (l) { seen[l] = (seen[l] || 0) + 1; });
  for (const k in seen) if (seen[k] > 1) dup++;
  ok(dup === 0, '回合日志无重复行');
}

// ---------- 13. 经典回合制（你一下我一下，速度决定先手） ----------
section('经典回合制');
{
  T.newGame(4);
  const s = T.getState();
  s.party = [T.makeMon(16, 60, { nature: '勤奋' })]; // 波波（快）
  s.party[0].moves = ['gust'];
  s.party[0].pp = [35];
  T.startWildBattle(11, 40); // 铁甲蛹（慢）
  s.battle.foe.mons[0].m.moves = ['tackle'];
  s.battle.foe.mons[0].m.pp = [35];
  ok(s.party[0].stats.spe > s.battle.foe.mons[0].m.stats.spe, '波波速度高于铁甲蛹');
  const start = s.log.length;
  T.battleMove(0);
  const firstMove = s.log.slice(start).filter(function (l) { return l.indexOf('使用了') !== -1; })[0] || '';
  ok(firstMove.indexOf('波波') === 0, '速度快的一方先出手（首条出招为波波）');
  let guard = 0;
  while (s.battle && !s.battle.over && s.battle.turn < 4 && guard++ < 200) {
    const active = s.battle.player.mons[s.battle.player.active];
    T.battleMove(damageMoveIdx(active));
  }
}
{
  T.newGame(4);
  const s = T.getState();
  s.party = [T.makeMon(143, 50, { nature: '勤奋' })]; // 卡比兽（慢）
  T.startWildBattle(16, 50); // 波波（快）
  ok(s.party[0].stats.spe < s.battle.foe.mons[0].m.stats.spe, '卡比兽速度低于波波');
  const start = s.log.length;
  T.battleMove(damageMoveIdx(s.battle.player.mons[0]));
  const firstMove = s.log.slice(start).filter(function (l) { return l.indexOf('使用了') !== -1; })[0] || '';
  ok(firstMove.indexOf('波波') === 0, '速度慢的一方后出手（首条出招为敌方的波波）');
  while (s.battle && !s.battle.over && s.battle.turn < 10) {
    const active = s.battle.player.mons[s.battle.player.active];
    T.battleMove(damageMoveIdx(active));
  }
}
{
  // 道具与攻击互斥（一回合一个指令）：用药 = 本回合行动，随后敌方同回合反击；下一回合才可出招
  T.newGame(4);
  const s = T.getState();
  s.party = [T.makeMon(143, 30, { nature: '勤奋' })]; // 卡比兽（皮糙肉厚）
  s.party[0].hp = 20;
  s.bag['伤药'] = 2;
  T.startWildBattle(16, 8); // 波波（弱）
  const start = s.log.length;
  T.battleUseItem('伤药');
  const itemTurn = s.log.slice(start);
  ok(s.bag['伤药'] === 1, '使用道具消耗 1 个');
  ok(itemTurn.some(function (l) { return l.indexOf('回复了') !== -1; }), '道具生效');
  ok(itemTurn.some(function (l) { return l.indexOf('波波 使用了') !== -1; }), '用药后敌方同回合反击（你一下我一下）');
  const ppBefore = s.battle.player.mons[0].m.pp[0];
  T.battleMove(0);
  ok(s.battle.player.mons[0].m.pp[0] === ppBefore - 1, '下一回合可正常出招');
  while (s.battle && !s.battle.over && s.battle.turn < 10) {
    const active = s.battle.player.mons[s.battle.player.active];
    T.battleMove(damageMoveIdx(active));
  }
}
{
  // 图鉴按种类登记：新捕获提示、重复捕获提示、交换补登记
  T.newGame(4);
  const s = T.getState();
  s.bag['大师球'] = 1;
  T.startWildBattle(16, 3);
  T.battleUseItem('大师球');
  ok(s.caughtDex[16] === true && s.log.some(function (l) { return l.indexOf('图鉴登记了新种类') !== -1; }), '新捕获登记图鉴并提示');
  s.bag['大师球'] = 1;
  T.startWildBattle(16, 3);
  T.battleUseItem('大师球');
  ok(s.log.some(function (l) { return l.indexOf('图鉴已有') !== -1; }), '重复捕获提示已有记录');
  s.party = [T.makeMon(19, 6)];
  s.townTrade = { give: 16, want: 19 };
  T.doTownTrade(true);
  ok(s.caughtDex[16] === true, '交换来的宝可梦登记图鉴');
}
{
  // 图鉴登记全来源审计：御三家/对战敌方/解救奖励/商人购买
  T.newGame(4);
  const s = T.getState();
  ok(s.caughtDex[4] === true && s.seenDex[4] === true, '开局御三家登记已捕获+已见');
  T.startTrainerBattle(T.MAP_NODES.route1.trainers[0]); // 敌方波波
  ok(s.seenDex[16] === true, '对战训练家登记敌方已见');
  while (s.battle && !s.battle.over && s.battle.turn < 10) {
    const a = s.battle.player.mons[s.battle.player.active];
    T.battleMove(damageMoveIdx(a));
  }
  T.newGame(4);
  const s2 = T.getState();
  s2.party = [T.makeMon(6, 30, { nature: '勤奋' })];
  s2.party[0].moves = ['flamethrower'];
  s2.party[0].pp = [15];
  T.startRocketBattle('rescue');
  let g = 0;
  while (s2.battle && !s2.battle.over && g++ < 60) {
    const a = s2.battle.player.mons[s2.battle.player.active];
    T.battleMove(damageMoveIdx(a));
  }
  ok(s2.caughtDex[133] === true && s2.seenDex[133] === true, '火箭队解救奖励登记图鉴');
  T.newGame(4);
  const s3 = T.getState();
  s3.money = 99999;
  s3.merchantOffer = { kind: 'mon', id: 133, price: 8000 };
  T.resolveMerchantOffer(true);
  ok(s3.caughtDex[133] === true && s3.seenDex[133] === true, '神秘商人购买登记图鉴');
}
{
  // 图鉴登记：进化形态点亮（小火龙 → 火恐龙 → 喷火龙，等级进化 + 石头进化）
  T.newGame(4);
  const s = T.getState();
  s.party = [T.makeMon(4, 15, { nature: '勤奋' })]; // 小火龙
  const log = [];
  T.grantExp(s.party[0], 5000, log, []);
  ok(s.party[0].species === 5 && s.caughtDex[5] === true && s.seenDex[5] === true, '进化成火恐龙后图鉴点亮');
  T.grantExp(s.party[0], 60000, log, []);
  ok(s.party[0].species === 6 && s.caughtDex[6] === true && s.seenDex[6] === true, '继续进化成喷火龙后图鉴点亮');
  ok(log.some(function (l) { return l.indexOf('图鉴登记了新种类') !== -1; }), '进化时提示图鉴新种类登记');
  const eevee = T.makeMon(133, 20, { nature: '勤奋' });
  T.tryStoneEvolution(eevee, '雷之石');
  ok(s.caughtDex[135] === true && s.seenDex[135] === true, '石头进化（伊布→雷伊布）图鉴点亮');
  // 旧存档回填：队伍里已有的火恐龙读档后图鉴点亮
  s.party = [T.makeMon(5, 30, { nature: '勤奋' })];
  s.caughtDex = {};
  s.seenDex = {};
  T.save();
  s.party = [];
  T.load();
  ok(T.getState().caughtDex[5] === true && T.getState().seenDex[5] === true, '旧存档读档回填已进化宝可梦图鉴');
}
{
  // 进化链祖先点亮：旧档直接拥有喷火龙 → 小火龙/火恐龙/喷火龙全部点亮；但不点亮未获得的后代
  T.newGame(4);
  const s = T.getState();
  s.party = [T.makeMon(6, 50, { nature: '勤奋' })]; // 直接拥有喷火龙（模拟旧档）
  s.caughtDex = {};
  s.seenDex = {};
  T.save();
  s.party = [];
  T.load();
  const s2 = T.getState();
  ok(s2.caughtDex[4] && s2.caughtDex[5] && s2.caughtDex[6] && s2.seenDex[4] && s2.seenDex[5] && s2.seenDex[6], '拥有喷火龙点亮整条小火龙进化链（4/5/6）');
  // 开局选小火龙：只点亮自己，不剧透火恐龙/喷火龙
  T.newGame(4);
  const s3 = T.getState();
  ok(s3.caughtDex[4] === true && !s3.caughtDex[5] && !s3.caughtDex[6], '开局选小火龙不剧透进化后代');
}
{
  // 石头进化只点亮祖先，不误点亮兄弟分支（伊布→雷伊布 ≠ 水/火伊布）
  T.newGame(4);
  const s = T.getState();
  s.caughtDex = {};
  s.seenDex = {};
  const eevee = T.makeMon(133, 20, { nature: '勤奋' });
  T.tryStoneEvolution(eevee, '雷之石');
  ok(s.caughtDex[135] && s.caughtDex[133], '雷伊布进化点亮祖先伊布');
  ok(!s.caughtDex[134] && !s.caughtDex[136], '不误点亮水伊布/火伊布兄弟分支');
}
{
  // 日志上限不截断战斗内日志（修复战斗日志框清空/播放被跳过）
  T.newGame(4);
  const s = T.getState();
  for (let i = 0; i < 2000; i++) { s.log.push('历史 ' + i); s.logKinds.push(''); }
  s.party = [T.makeMon(16, 40, { nature: '勤奋' })];
  s.party[0].moves = ['gust'];
  s.party[0].pp = [35];
  T.startWildBattle(11, 30);
  s.battle.foe.mons[0].m.moves = ['tackle'];
  s.battle.foe.mons[0].m.pp = [35];
  const logStart = s.battle.logStart;
  const lenBefore = s.log.length;
  T.battleMove(0);
  ok(s.log.length > lenBefore, '战斗内日志不被上限截断');
  ok(!!s.log[logStart], 'logStart 指向的战斗起始行仍存在');
  while (s.battle && !s.battle.over && s.battle.turn < 10) {
    const a = s.battle.player.mons[s.battle.player.active];
    T.battleMove(damageMoveIdx(a));
  }
}
{
  // 已探索节点记录与存档
  T.newGame(4);
  const s = T.getState();
  ok(s.visitedNodes.indexOf('pallet') !== -1, '开局真新镇标记已探索');
  T.gotoNode('route1');
  T.gotoNode('viridian');
  ok(s.visitedNodes.indexOf('route1') !== -1 && s.visitedNodes.indexOf('viridian') !== -1, '移动标记已探索');
  T.save();
  s.visitedNodes = [];
  ok(T.load(), '读档成功');
  ok(T.getState().visitedNodes.indexOf('viridian') !== -1, '已探索节点随存档保存');
}

// ---------- 16. MVP13：无尽之塔 ----------
section('无尽之塔');
{
  ok(!!T.MAP_NODES.tower && T.MAP_NODES.champion.next.indexOf('tower') !== -1, '无尽之塔节点存在且与冠军之路连通');
  ok(T.MAP_NODES.tower.requireBadge === '绿色徽章', '无尽之塔需绿色徽章（8徽章）解锁');
}
{
  const t1 = T.towerFoeTeam(1);
  ok(t1.length === 2 && t1[0].level >= 48, '1 层 2 只且等级 48+');
  ok(T.towerFoeTeam(40).length === 3, '40 层 3 只');
  ok(T.towerFoeTeam(71).length === 5, '71 层 5 只');
  ok(T.towerFoeTeam(100)[0].level === 100, '100 层满级');
  ok(T.towerFoeTeam(1).every(function (m) { return T.POKEDEX[m.id].types.indexOf('普通') !== -1; }), '1-10 层普通系主题');
  ok(T.towerFoeTeam(11).every(function (m) { return T.POKEDEX[m.id].types.some(function (t) { return t === '水' || t === '冰'; }); }), '11-20 层水/冰主题');
}
{
  const t1 = T.towerThemeFor(1);
  ok(t1.types.length === 1 && t1.types[0] === '普通', '1 层主题为普通系');
  ok(t1.counters.indexOf('格斗') !== -1, '普通系克制建议包含格斗');
  const t11 = T.towerThemeFor(11);
  ok(t11.types.join('/') === '水/冰', '11 层主题为水/冰');
  ['电', '草', '格斗', '岩石'].forEach(function (c) {
    ok(t11.counters.indexOf(c) !== -1, '水/冰层克制建议包含 ' + c);
  });
  ok(t11.counters.indexOf('火') === -1 && t11.counters.indexOf('钢') === -1, '水/冰层不推荐火/钢（对水减半，避免误导）');
  ok(T.towerThemeFor(41).counters.indexOf('地面') !== -1, '电系层（41-50）克制建议包含地面');
  ok(T.towerThemeFor(81).types.join('/') === '毒/格斗', '81-90 层主题为毒/格斗');
  const psychic = T.towerThemeFor(72);
  ok(psychic.types.join('/') === '超能力/幽灵/恶' && psychic.counters.indexOf('格斗') === -1 && psychic.counters.length === 0, '超能/幽灵/恶层不推荐格斗（对幽灵无效/对超能力减半），无固定弱点提示');
  const mix = T.towerThemeFor(100);
  ok(mix.types[0] === '混合' && mix.counters.length === 0, '100 层混合传说层无固定克制建议');
}
{
  T.newGame(4);
  const s = T.getState();
  s.badges.push('绿色徽章');
  s.party = [T.makeMon(6, 60, { nature: '勤奋' })];
  s.party[0].moves = ['flamethrower'];
  s.party[0].pp = [15];
  s.tower = { floor: 5, checkpoint: 0, bestFloor: 4, cleared: false };
  T.startTowerFloor();
  ok(s.battle && s.battle.kind === 'tower' && s.battle.canRun === false, '塔内战斗不可逃跑');
  s.bag['精灵球'] = 1;
  T.battleUseItem('精灵球');
  ok(s.bag['精灵球'] === 1, '塔内扔球被拦截不消耗');
  let g = 0;
  while (s.battle && !s.battle.over && g++ < 80) {
    const a = s.battle.player.mons[s.battle.player.active];
    T.battleMove(damageMoveIdx(a));
  }
  ok(s.lastResult === 'win' && s.tower.floor === 6 && s.tower.checkpoint === 5, '打通第 5 层后推进到第 6 层并存档');
  const bagTotal = Object.keys(s.bag).reduce(function (sum, k) { return sum + s.bag[k]; }, 0);
  ok(bagTotal === 8, '每 5 层获得一次道具奖励（7 + 1）');
}
{
  T.newGame(4);
  const s = T.getState();
  s.tower = { floor: 8, checkpoint: 5, bestFloor: 7, cleared: false };
  s.party = [T.makeMon(129, 5, { nature: '勤奋' })];
  s.nodeId = 'tower';
  T.startTowerFloor();
  let g = 0;
  while (s.battle && !s.battle.over && g++ < 40) {
    const a = s.battle.player.mons[s.battle.player.active];
    T.battleMove(damageMoveIdx(a));
  }
  ok(s.lastResult === 'lose' && s.tower.floor === 6, '败北回到存档点+1（第 6 层）');
  ok(s.nodeId === 'tower' && s.party[0].hp < s.party[0].stats.hp, '败北不回城、不免费回血');
}
{
  T.newGame(4);
  const s = T.getState();
  s.party = [T.makeMon(150, 100, { nature: '勤奋' }), T.makeMon(150, 100, { nature: '勤奋' }), T.makeMon(150, 100, { nature: '勤奋' }), T.makeMon(150, 100, { nature: '勤奋' })];
  s.party.forEach(function (m) { m.moves = ['psychic', 'ice_beam', 'thunderbolt', 'flamethrower']; m.pp = [99, 99, 99, 99]; m.stats.hp = 5000; m.hp = 5000; });
  s.tower = { floor: 100, checkpoint: 95, bestFloor: 99, cleared: false };
  const bagBefore = Object.keys(s.bag).reduce(function (sum, k) { return sum + s.bag[k]; }, 0);
  T.startTowerFloor();
  let g = 0;
  while (s.battle && !s.battle.over && g++ < 200) {
    const a = s.battle.player.mons[s.battle.player.active];
    T.battleMove(damageMoveIdx(a));
  }
  ok(s.lastResult === 'win' && s.tower.cleared === true && s.tower.floor === 100, '100 层通关');
  ok(Object.keys(s.bag).reduce(function (sum, k) { return sum + s.bag[k]; }, 0) === bagBefore + 1, '100 层边界同样发放最终道具奖励');
  ok(s.titles.indexOf('tower100@稀有') !== -1, '获得称号（保底稀有）');
  T.save();
  s.titles = [];
  s.tower = null;
  ok(T.load(), '读档成功');
  ok(T.getState().titles.indexOf('tower100@稀有') !== -1, '称号随存档保存');
}
{
  // 边界：1 层新档（无存档点）中途全灭
  T.newGame(4);
  const s = T.getState();
  s.party = [T.makeMon(129, 5, { nature: '勤奋' })]; // 鲤鱼王：弱，必败
  s.tower = { floor: 1, checkpoint: 0, bestFloor: 0, cleared: false };
  s.nodeId = 'tower';
  T.startTowerFloor();
  let g = 0;
  while (s.battle && !s.battle.over && g++ < 40) {
    const a = s.battle.player.mons[s.battle.player.active];
    T.battleMove(damageMoveIdx(a));
  }
  ok(s.lastResult === 'lose' && s.tower.floor === 1 && s.tower.bestFloor === 0, '1 层无存档败北：留在第 1 层、历史最佳不变');
  ok(s.nodeId === 'tower' && s.party[0].hp < s.party[0].stats.hp, '1 层败北不回城、不免费回血');
}
{
  // 边界：塔内手动换人 / 拦截非法换人 / 中途倒下自动换人
  T.newGame(4);
  const s = T.getState();
  s.badges.push('绿色徽章');
  s.party = [T.makeMon(6, 60, { nature: '勤奋' }), T.makeMon(25, 60, { nature: '勤奋' })];
  s.party.forEach(function (m) { m.moves = ['flamethrower', 'thunderbolt']; m.pp = [20, 20]; });
  s.party[1].stats.hp = 9999; // 高血量：换人测试聚焦逻辑本身，不受随机敌方伤害影响
  s.party[1].hp = 9999;
  s.tower = { floor: 1, checkpoint: 0, bestFloor: 0, cleared: false };
  s.nodeId = 'tower';
  T.startTowerFloor();
  const foeName = s.battle.foe.mons[0].m.name;
  const logLen1 = s.log.length;
  T.battleSwitch(1);
  ok(s.battle.player.active === 1, '塔内战斗中可手动换人（第 2 只上场）');
  ok(s.log.slice(logLen1).some(function (l) { return l.indexOf('回来吧') !== -1; }), '换人日志正常');
  ok(s.log.slice(logLen1).some(function (l) { return l.indexOf(foeName) !== -1 && l.indexOf('使用了') !== -1; }), '换人占用本回合：敌方当回合出手');
  T.battleSwitch(1);
  ok(s.battle.player.active === 1, '换当前在场宝可梦被拦截');
  s.battle.player.mons[0].m.hp = 0;
  T.battleSwitch(0);
  ok(s.battle.player.active === 1, '换已倒下宝可梦被拦截');
  // 恢复第一只，再把当前在场打到 1 血、让敌方先手，验证自动换人
  s.battle.player.mons[0].m.hp = s.battle.player.mons[0].m.stats.hp;
  s.battle.player.mons[1].m.hp = 1;
  s.battle.player.mons[1].m.stats.spe = 1;
  s.battle.foe.mons[0].m.stats.spe = 999;
  s.battle.foe.mons[0].m.moves = ['scratch'];
  s.battle.foe.mons[0].m.pp = [35];
  T.battleMove(damageMoveIdx(s.battle.player.mons[1]));
  ok(s.battle.player.mons[1].m.hp <= 0, '当前在场宝可梦被击倒');
  ok(s.battle.player.active === 0 && s.battle.player.mons[0].m.hp > 0, '倒下后自动切换下一只存活宝可梦上场');
}
{
  // 边界：71 层敌方 5 只连战（自动换人 ≥4 次），非 5 倍层不推进存档点、不重复发奖
  T.newGame(4);
  const s = T.getState();
  s.badges.push('绿色徽章');
  s.party = [T.makeMon(150, 95, { nature: '勤奋' }), T.makeMon(150, 95, { nature: '勤奋' }), T.makeMon(150, 95, { nature: '勤奋' }), T.makeMon(150, 95, { nature: '勤奋' })];
  s.party.forEach(function (m) { m.moves = ['psychic', 'ice_beam', 'thunderbolt', 'flamethrower']; m.pp = [99, 99, 99, 99]; m.stats.hp = 5000; m.hp = 5000; });
  s.tower = { floor: 71, checkpoint: 70, bestFloor: 70, cleared: false };
  const bagBefore = Object.keys(s.bag).reduce(function (sum, k) { return sum + s.bag[k]; }, 0);
  T.startTowerFloor();
  let g = 0;
  while (s.battle && !s.battle.over && g++ < 200) {
    const a = s.battle.player.mons[s.battle.player.active];
    T.battleMove(damageMoveIdx(a));
  }
  ok(s.lastResult === 'win' && s.tower.floor === 72 && s.tower.bestFloor === 71, '打通 71 层（5 只）推进到 72 层、历史最佳更新');
  const foeSwitchCount = s.log.filter(function (l) { return l.indexOf('对方派出了') !== -1; }).length;
  ok(foeSwitchCount >= 4, '敌方 5 只全部出场（自动换人 ≥4 次，实际 ' + foeSwitchCount + ' 次）');
  ok(s.tower.checkpoint === 70, '非 5 倍层不推进存档点');
  ok(Object.keys(s.bag).reduce(function (sum, k) { return sum + s.bag[k]; }, 0) === bagBefore, '非 5 倍层不重复发放奖励');
}
{
  // 边界：同归于尽（挣扎反伤）按败北处理，回到存档点+1、不复活
  T.newGame(4);
  const s = T.getState();
  s.badges.push('绿色徽章');
  s.party = [T.makeMon(16, 60, { nature: '勤奋' })]; // 波波：快
  s.party[0].moves = ['tackle']; s.party[0].pp = [35];
  s.party[0].stats.spe = 999;
  s.party[0].hp = 1;
  s.tower = { floor: 6, checkpoint: 5, bestFloor: 5, cleared: false };
  s.nodeId = 'tower';
  T.startTowerFloor();
  const foe = s.battle.foe.mons[0];
  foe.m.stats.spe = 1;
  foe.m.hp = 1;
  foe.m.moves = ['scratch']; foe.m.pp = [35];
  T.battleMove(-1); // 挣扎：反伤 1/4，双方同回合倒下
  ok(s.lastResult === 'lose' && !s.battle, '塔内同归于尽按败北处理');
  ok(s.tower.floor === 6 && s.tower.bestFloor === 5, '同归于尽回到存档点+1、历史最佳不变');
  ok(s.nodeId === 'tower' && s.party[0].hp <= 0, '同归于尽不回城、不免费复活');
}
{
  // 边界：打通第 10 层（5 倍边界）→ 存档点推进 + 发奖；通关后可重刷
  T.newGame(4);
  const s = T.getState();
  s.badges.push('绿色徽章');
  s.party = [T.makeMon(150, 90, { nature: '勤奋' })];
  s.party[0].moves = ['psychic']; s.party[0].pp = [99]; s.party[0].stats.hp = 5000; s.party[0].hp = 5000;
  s.tower = { floor: 10, checkpoint: 5, bestFloor: 9, cleared: false };
  const bagBefore = Object.keys(s.bag).reduce(function (sum, k) { return sum + s.bag[k]; }, 0);
  T.startTowerFloor();
  let g = 0;
  while (s.battle && !s.battle.over && g++ < 80) {
    const a = s.battle.player.mons[s.battle.player.active];
    T.battleMove(damageMoveIdx(a));
  }
  ok(s.lastResult === 'win' && s.tower.floor === 11 && s.tower.checkpoint === 10 && s.tower.bestFloor === 10, '打通第 10 层：存档点与历史最佳同步推进到 10');
  ok(Object.keys(s.bag).reduce(function (sum, k) { return sum + s.bag[k]; }, 0) === bagBefore + 1, '第 10 层边界发放存档奖励（+1）');
}
{
  // 边界：通关后重刷（从第 1 层重新开始，保留称号与历史最佳）
  T.newGame(4);
  const s = T.getState();
  s.badges.push('绿色徽章');
  s.party = [T.makeMon(150, 100, { nature: '勤奋' })];
  s.party[0].moves = ['psychic']; s.party[0].pp = [99]; s.party[0].stats.hp = 5000; s.party[0].hp = 5000;
  s.tower = { floor: 100, checkpoint: 95, bestFloor: 100, cleared: true };
  s.titles = ['无尽之塔征服者'];
  T.startTowerFloor();
  ok(s.battle && s.battle.kind === 'tower', '通关后点击挑战可再次进入塔内战斗（重刷）');
  ok(s.tower.cleared === false && s.tower.floor === 1 && s.tower.checkpoint === 0, '重刷从第 1 层重新开始');
  ok(s.titles.indexOf('无尽之塔征服者') !== -1 && s.tower.bestFloor === 100, '重刷保留称号与历史最佳');
  let g = 0;
  while (s.battle && !s.battle.over && g++ < 80) {
    const a = s.battle.player.mons[s.battle.player.active];
    T.battleMove(damageMoveIdx(a));
  }
  ok(s.lastResult === 'win' && s.tower.floor === 2, '重刷第 1 层胜利后正常推进');
}
{
  // 边界：塔内可用穿绳回城补给，塔内进度保留（从存档点继续）
  T.newGame(4);
  const s = T.getState();
  s.nodeId = 'tower';
  s.lastTown = 'pallet';
  s.tower = { floor: 12, checkpoint: 10, bestFloor: 11, cleared: false };
  s.bag['穿绳'] = 1;
  T.useEscapeRope();
  ok(s.nodeId === 'pallet' && !s.bag['穿绳'], '塔内使用穿绳回城（消耗 1 条）');
  ok(s.tower.floor === 12 && s.tower.checkpoint === 10 && s.tower.bestFloor === 11, '穿绳回城保留塔内进度（从存档点继续）');
}
{
  // HP 快照与日志逐行对齐（播放层血条分步结算，不再一块掉血）
  T.newGame(4);
  const s = T.getState();
  s.party = [T.makeMon(16, 40, { nature: '勤奋' })]; // 波波（快）
  s.party[0].moves = ['gust'];
  s.party[0].pp = [35];
  T.startWildBattle(11, 40); // 铁甲蛹（慢）
  s.battle.foe.mons[0].m.moves = ['tackle'];
  s.battle.foe.mons[0].m.pp = [35];
  const start = s.log.length;
  const foeHpBefore = s.battle.foe.mons[0].m.hp;
  T.battleMove(0);
  const newLines = s.log.length - start;
  ok(s.battle && s.battle.hpSteps.length >= newLines, 'HP 快照覆盖本回合日志（' + (s.battle ? s.battle.hpSteps.length : '-') + ' >= ' + newLines + '）');
  const firstSnapIdx = start - s.battle.logStart;
  ok(s.battle && s.battle.hpSteps[firstSnapIdx].foe < foeHpBefore, '玩家先手时首行快照敌方已掉血（分步结算）');
  while (s.battle && !s.battle.over && s.battle.turn < 10) {
    const active = s.battle.player.mons[s.battle.player.active];
    T.battleMove(damageMoveIdx(active));
  }
}

// ---------- 13.5 稀有度分级（词缀 + 颜色） ----------
section('稀有度分级');
{
  const R = T.rarityOf;
  ok(R(T.POKEDEX[150]).key === 'legendary' && R(T.POKEDEX[150]).label === '传说', '超梦为传说');
  ok(R(T.POKEDEX[144]).key === 'legendary', '急冻鸟为传说');
  ok(R(T.POKEDEX[151]).key === 'legendary', '梦幻为传说');
  ok(R(T.POKEDEX[147]).key === 'rare' && R(T.POKEDEX[147]).label === '稀有', '迷你龙为稀有');
  ok(R(T.POKEDEX[143]).key === 'rare', '卡比兽为稀有');
  ok(R(T.POKEDEX[4]).key === 'rare', '御三家为稀有');
  ok(R(T.POKEDEX[102]).key === 'uncommon' && R(T.POKEDEX[102]).label === '少见', '蛋蛋为少见');
  ok(R(T.POKEDEX[16]).key === 'common' && R(T.POKEDEX[16]).label === '普通', '波波为普通');
  ok(R(T.POKEDEX[129]).key === 'common', '鲤鱼王为普通');
}
{
  T.newGame(4);
  const s = T.getState();
  T.startWildBattle(147, 40); // 迷你龙（稀有）
  ok(s.log.some(function (l) { return l.indexOf('野生的 迷你龙（稀有） 出现了') !== -1; }), '稀有宝可梦开场带稀有词缀');
  T.newGame(4);
  T.startWildBattle(16, 5); // 波波（普通）
  ok(s.log.some(function (l) { return l.indexOf('野生的 波波 出现了') !== -1 && l.indexOf('（普通）') === -1; }), '普通宝可梦开场不带词缀');
}

// ---------- 13.6 道具说明增强（进化石目标） ----------
section('道具说明增强');
{
  const moon = T.stoneTargets('月亮石');
  ok(moon.length === 1 && moon[0].fromId === 35 && moon[0].toId === 36, '月亮石：皮皮 → 皮可西');
  const thunder = T.stoneTargets('雷之石');
  ok(thunder.some(function (t) { return t.fromId === 25 && t.toId === 26; }), '雷之石：皮卡丘 → 雷丘');
  ok(thunder.some(function (t) { return t.fromId === 133 && t.toId === 135; }), '雷之石：伊布 → 雷伊布');
  const fire = T.stoneTargets('火之石');
  ok(fire.some(function (t) { return t.fromId === 133 && t.toId === 136; }), '火之石：伊布 → 火伊布');
  ok(fire.some(function (t) { return t.fromId === 37 && t.toId === 38; }), '火之石：六尾 → 九尾');
  const water = T.stoneTargets('水之石');
  ok(water.some(function (t) { return t.fromId === 120 && t.toId === 121; }), '水之石：海星星 → 宝石海星');
  ok(water.some(function (t) { return t.fromId === 133 && t.toId === 134; }), '水之石：伊布 → 水伊布');
  ok(T.stoneTargets('叶之石').some(function (t) { return t.fromId === 44 && t.toId === 45; }), '叶之石：臭臭花 → 霸王花');
}

// ---------- 13.7 技能效果与学习面平衡 ----------
section('技能效果与学习面');
{
  let agilityLearners = [];
  Object.keys(T.POKEDEX).forEach(function (id) {
    const d = T.POKEDEX[id];
    if (!d.learnset) return;
    Object.keys(d.learnset).forEach(function (lv) {
      if (d.learnset[lv].indexOf('agility') !== -1) agilityLearners.push(id);
    });
  });
  ok(agilityLearners.length === 0, '全图鉴学习面不再有高速移动（0 只）');
  ok(T.POKEDEX[4].learnset[50] === undefined, '小火龙 50 级不再学高速移动');
  ok(T.POKEDEX[25].learnset[33].indexOf('slam') !== -1, '皮卡丘 33 级改为学摔打');
  ok(T.POKEDEX[143].learnset[35].indexOf('amnesia') !== -1, '卡比兽 35 级学瞬间失忆（特防强化）');
  ok(T.POKEDEX[111].learnset[15].indexOf('harden') !== -1, '铁甲犀牛 15 级学变硬（防御强化）');
  ok(T.POKEDEX[65].learnset[40].indexOf('recover') !== -1, '胡地 40 级学自我再生');
  ok(T.POKEDEX[145].learnset[40].indexOf('swift') !== -1, '闪电鸟 40 级学高速星星');
}
{
  // 招式更换：满级也能把旧招（如残留的高速移动）换成可学新招
  T.newGame(4);
  const s = T.getState();
  s.party = [T.makeMon(143, 100, { nature: '勤奋' })]; // 卡比兽满级
  s.party[0].moves = ['tackle', 'growl', 'amnesia', 'agility']; // 模拟旧存档残留
  s.party[0].pp = [35, 40, 20, 30];
  s.money = 10000;
  const learnable = T.learnableMoves(s.party[0]);
  ok(learnable.indexOf('body_slam') !== -1, '满级卡比兽可学泰山压顶');
  ok(learnable.indexOf('amnesia') === -1 && learnable.indexOf('agility') === -1, '可学清单排除已学会招式');
  ok(T.moveReplaceCost(s.party[0]) === 3500, '满级更换费用 3500 金');
  const res = T.replaceMove(0, 3, 'body_slam');
  ok(res.ok && s.party[0].moves[3] === 'body_slam' && s.money === 10000 - 3500, '替换成功并扣费');
  ok(s.party[0].pp[3] === T.MOVES['body_slam'].pp, '新招式 PP 对齐');
  T.save();
  s.party = [];
  ok(T.load() && T.getState().party[0].moves[3] === 'body_slam', '替换后的招式随存档保存');
  const bad = T.replaceMove(0, 0, 'hyper_beam');
  ok(!bad.ok && s.party[0].moves[0] === 'tackle', '当前学不会的招式被拦截');
  s.money = 100;
  const poor = T.replaceMove(0, 0, 'earthquake');
  ok(!poor.ok && s.party[0].moves[0] === 'tackle', '金币不足被拦截');
  const low = T.makeMon(143, 30, { nature: '勤奋' });
  ok(T.learnableMoves(low).indexOf('earthquake') === -1 && T.learnableMoves(low).indexOf('body_slam') === -1, 'Lv30 看不到 40/50 级招式');
  ok(T.learnableMoves(low).indexOf('tackle') !== -1, 'Lv30 卡比兽可补未学的撞击');
  const pk = T.makeMon(25, 30, { nature: '勤奋' });
  ok(T.learnableMoves(pk).indexOf('slam') === -1, 'Lv30 皮卡丘看不到 33 级摔打');
}
{
  // 睡觉：回满 HP + 治愈异常 + 进入睡眠；满血时无效
  T.newGame(4);
  const s = T.getState();
  s.party = [T.makeMon(143, 40, { nature: '勤奋' })]; // 卡比兽 30 级学睡觉
  s.party[0].moves = ['rest', 'body_slam'];
  s.party[0].pp = [5, 15];
  s.party[0].stats.spe = 999;
  T.startWildBattle(16, 40);
  const bm = s.battle.player.mons[0];
  s.battle.foe.mons[0].m.stats.spe = 1;
  s.battle.foe.mons[0].m.moves = ['tackle']; // 去掉先制招，保证玩家先手，测试确定
  s.battle.foe.mons[0].m.pp = [35];
  bm.m.hp = 1;
  bm.m.status = '中毒';
  T.battleMove(0); // 睡觉
  ok(bm.m.hp > 100 && bm.m.hp <= bm.m.stats.hp && bm.m.status === '睡眠' && bm.sleepTurns > 0 && bm.sleepTurns <= 3, '睡觉回满HP（随后被反击扣一点）、治愈中毒并进入睡眠1~3回合');
  const hpAfterRest = bm.m.hp;
  T.battleMove(1);
  ok(bm.m.hp === hpAfterRest || bm.m.status === '睡眠' || !bm.m.status, '睡眠回合正常结算不崩溃');
}
{
  // 满血时使用睡觉无效
  T.newGame(4);
  const s = T.getState();
  s.party = [T.makeMon(143, 40, { nature: '勤奋' })];
  s.party[0].moves = ['rest', 'body_slam'];
  s.party[0].pp = [5, 15];
  s.party[0].stats.spe = 999;
  T.startWildBattle(16, 40);
  s.battle.foe.mons[0].m.stats.spe = 1;
  s.battle.foe.mons[0].m.moves = ['tackle'];
  s.battle.foe.mons[0].m.pp = [35];
  const bm = s.battle.player.mons[0];
  const logLen = s.log.length;
  T.battleMove(0);
  ok(!bm.m.status && bm.m.hp <= bm.m.stats.hp && s.log.slice(logLen).some(function (l) { return l.indexOf('无法使用睡觉') !== -1; }), '满血时睡觉无效（提示无法使用）');
}
{
  // 技能错乱回归：喂经验攒下待学招 → 换首发重排队伍 → 新招仍学到正确的宝可梦身上
  T.newGame(4);
  const s = T.getState();
  s.party = [T.makeMon(25, 20, { nature: '勤奋' }), T.makeMon(143, 34, { nature: '勤奋' })]; // 皮卡丘首发，卡比兽 Lv34
  s.party[0].moves = ['thundershock', 'growl', 'tail_whip', 'quick_attack'];
  s.party[0].pp = [30, 40, 30, 30];
  s.party[1].moves = ['tackle', 'growl', 'quick_attack', 'take_down'];
  s.party[1].pp = [35, 40, 30, 25];
  const log = [];
  T.grantExp(s.party[1], 400000, log, []); // 卡比兽连升多级，攒下待学招
  ok(s.pendingLearn.length >= 1, '喂经验升级攒下待学招式');
  const pendingCount = s.pendingLearn.length;
  const firstMove = s.pendingLearn[0].moveId;
  T.setLeadMon(1); // 卡比兽设为首发，队伍重排
  ok(s.party[0].name === '卡比兽' && s.party[1].name === '皮卡丘', '卡比兽成为首发（重排）');
  const pikaBefore = s.party[1].moves.slice();
  const res = T.resolvePendingLearn(firstMove, 0);
  ok(res.ok && s.party[0].moves.indexOf(firstMove) !== -1, '待学招正确学到卡比兽身上（不再错学到皮卡丘）');
  ok(s.party[1].moves.join(',') === pikaBefore.join(','), '皮卡丘招式未被误改');
  // 存档读档后 uid 关联仍然正确
  T.save();
  s.party = [];
  s.pendingLearn = [];
  ok(T.load(), '读档成功');
  const s2 = T.getState();
  ok(s2.pendingLearn.length === pendingCount - 1, '剩余待学招随存档保存');
  const snorlaxIdx = s2.party.findIndex(function (m) { return m.name === '卡比兽'; });
  const pikaIdx = s2.party.findIndex(function (m) { return m.name === '皮卡丘'; });
  const nextMove = s2.pendingLearn[0].moveId;
  const pikaBefore2 = s2.party[pikaIdx].moves.slice();
  T.resolvePendingLearn(nextMove, 1);
  ok(s2.party[snorlaxIdx].moves.indexOf(nextMove) !== -1, '读档后学招仍正确关联卡比兽');
  ok(s2.party[pikaIdx].moves.join(',') === pikaBefore2.join(','), '读档后皮卡丘仍未被误改');
  // 旧档无 uid 的待学招：读档时按下标补挂 uid
  const legacyUid = s2.party[snorlaxIdx].uid;
  s2.pendingLearn = [{ where: 'party', idx: snorlaxIdx, moveId: 'earthquake', monName: '卡比兽', moveName: '地震' }];
  T.save();
  s2.party = [];
  s2.pendingLearn = [];
  T.load();
  const s3 = T.getState();
  ok(s3.pendingLearn[0] && s3.pendingLearn[0].uid === legacyUid, '旧档待学招读档自动补挂 uid');
}

// ---------- 13.7.1 遗忘技能不再重复提示（升级/替换/更换面板） ----------
section('遗忘技能不再重复提示');
{
  // 场景 1：升级弹窗点“不学了”→ 后续升级不再重复提示该招
  T.newGame(4);
  const s = T.getState();
  s.party = [T.makeMon(143, 29, { nature: '勤奋' })]; // 卡比兽 29 级，4 招已满
  s.party[0].moves = ['tackle', 'growl', 'quick_attack', 'take_down'];
  s.party[0].pp = [35, 40, 30, 25];
  const log = [];
  T.grantExp(s.party[0], T.expForLevel('slow', 30) - s.party[0].exp + 1, log, []);
  ok(s.pendingLearn.length === 1 && s.pendingLearn[0].moveId === 'rest', '30 级睡觉进入待学队列');
  const r = T.resolvePendingLearn('rest', null); // 玩家点“不学了”
  ok(r.ok && (s.party[0].forgottenMoves || []).indexOf('rest') !== -1, '不学了的招式记入遗忘清单');
  s.pendingLearn = [];
  T.grantExp(s.party[0], T.expForLevel('slow', 100) - s.party[0].exp, log, []);
  ok(s.pendingLearn.length >= 1 && s.pendingLearn.every(function (p) { return p.moveId !== 'rest'; }), '后续升级不再重复提示已遗忘的睡觉');
}
{
  // 场景 2：升级学招时替换掉旧招 → 被替换的旧招后续升级不再提示
  T.newGame(4);
  const s = T.getState();
  s.party = [T.makeMon(143, 29, { nature: '勤奋' })];
  s.party[0].moves = ['tackle', 'growl', 'quick_attack', 'take_down'];
  s.party[0].pp = [35, 40, 30, 25];
  const log = [];
  T.grantExp(s.party[0], T.expForLevel('slow', 30) - s.party[0].exp + 1, log, []);
  const r = T.resolvePendingLearn('rest', 0); // 遗忘撞击学睡觉
  ok(r.ok && s.party[0].moves.indexOf('rest') !== -1, '替换学习成功');
  ok((s.party[0].forgottenMoves || []).indexOf('tackle') !== -1, '被替换掉的旧招记入遗忘清单');
  s.pendingLearn = [];
  T.grantExp(s.party[0], T.expForLevel('slow', 100) - s.party[0].exp, log, []);
  ok(s.pendingLearn.every(function (p) { return p.moveId !== 'tackle'; }), '被替换的旧招后续升级不再提示');
}
{
  // 场景 3：招式更换面板付费换掉旧招 → 旧招记入遗忘清单（升级不再提示），但更换面板仍可手动学回
  T.newGame(4);
  const s = T.getState();
  s.party = [T.makeMon(143, 100, { nature: '勤奋' })];
  s.party[0].moves = ['tackle', 'growl', 'amnesia', 'agility']; // 模拟旧档残留
  s.party[0].pp = [35, 40, 20, 30];
  s.money = 10000;
  const res = T.replaceMove(0, 0, 'body_slam'); // 遗忘撞击，学泰山压顶
  ok(res.ok && s.party[0].moves[0] === 'body_slam', '付费替换成功');
  ok((s.party[0].forgottenMoves || []).indexOf('tackle') !== -1, '被换掉的旧招记入遗忘清单');
  ok(T.learnableMoves(s.party[0]).indexOf('tackle') !== -1, '可学清单仍包含已遗忘的旧招（可手动学回）');
  const back = T.replaceMove(0, 0, 'tackle');
  ok(back.ok && s.party[0].moves[0] === 'tackle', '曾遗忘的旧招可通过更换面板学回');
}
{
  // 场景 4：遗忘清单随存档保存，旧档无该字段默认空数组
  T.newGame(4);
  const s = T.getState();
  s.party = [T.makeMon(143, 30, { nature: '勤奋' })];
  s.party[0].forgottenMoves = ['rest', 'amnesia'];
  T.save();
  s.party = [];
  ok(T.load() && T.getState().party[0].forgottenMoves.join(',') === 'rest,amnesia', '遗忘清单随存档保存');
  const legacy = JSON.parse(localStorage.getItem('bkm_poke_save_v1'));
  delete legacy.party[0].forgottenMoves;
  localStorage.setItem('bkm_poke_save_v1', JSON.stringify(legacy));
  s.party = [];
  ok(T.load() && Array.isArray(T.getState().party[0].forgottenMoves) && T.getState().party[0].forgottenMoves.length === 0, '旧档无遗忘清单字段默认空数组');
}

// ---------- 13.8 MVP14：全图鉴投放补全 ----------
section('MVP14：全图鉴投放');
{
  // 全图鉴可获取性：151 只均有至少一条获取路径（野生池/钓鱼/交换/商人/火箭队/御三家/进化闭包）
  const stoneEvo = { '水之石': { 133: 134, 120: 121 }, '雷之石': { 25: 26, 133: 135 }, '火之石': { 133: 136 }, '月亮石': { 35: 36 }, '叶之石': { 44: 45 } };
  const obtainable = {};
  Object.keys(T.MAP_NODES).forEach(function (id) {
    const n = T.MAP_NODES[id];
    Object.keys(n.pools || {}).forEach(function (w) {
      (n.pools[w] || []).forEach(function (p) { obtainable[p.id] = true; });
    });
  });
  Object.keys(T.FISH_POOLS).forEach(function (nid) {
    T.FISH_POOLS[nid].forEach(function (p) { obtainable[p.id] = true; });
  });
  T.FISH_POOL_FALLBACK.forEach(function (p) { obtainable[p.id] = true; });
  [16, 21, 43, 35].forEach(function (id) { obtainable[id] = true; }); // NPC 交换
  [133, 131, 143, 147, 25, 129].forEach(function (id) { obtainable[id] = true; }); // 商人/火箭队
  [1, 4, 7].forEach(function (id) { obtainable[id] = true; }); // 御三家
  let changed = true;
  while (changed) {
    changed = false;
    Object.keys(obtainable).map(Number).forEach(function (id) {
      const d = T.POKEDEX[id];
      if (d && d.evo && d.evo.into && !obtainable[d.evo.into]) { obtainable[d.evo.into] = true; changed = true; }
      Object.keys(stoneEvo).forEach(function (stone) {
        if (stoneEvo[stone][id] && !obtainable[stoneEvo[stone][id]]) { obtainable[stoneEvo[stone][id]] = true; changed = true; }
      });
    });
  }
  const missing = [];
  for (let i = 1; i <= 151; i++) if (!obtainable[i]) missing.push(i);
  ok(missing.length === 0, '全图鉴 151 只均可获取（缺失：' + (missing.length ? missing.join(',') : '无') + '）');
}
{
  // 关键投放点抽查
  const inPool = function (nodeId, weather, id) {
    const pool = T.MAP_NODES[nodeId] && T.MAP_NODES[nodeId].pools && T.MAP_NODES[nodeId].pools[weather];
    return pool ? pool.some(function (p) { return p.id === id; }) : false;
  };
  ok(inPool('route7', '晴', 37), '六尾投放于 7 号道路');
  ok(inPool('route5', '晴', 63) || inPool('route6', '晴', 63), '凯西投放于金黄市周边');
  ok(inPool('route6', '晴', 125), '电击兽投放于枯叶市周边');
  ok(inPool('route24', '晴', 79) && inPool('route25', '晴', 79), '呆呆兽投放于华蓝北水域');
  ok(inPool('route24', '雷阵雨', 145), '闪电鸟投放于 24 号雷阵雨');
  ok(inPool('mtmoon', '晴', 138) && inPool('mtmoon', '晴', 140), '菊石兽/化石盔投放于月见山');
  ok(inPool('champion', '晴', 142) && inPool('champion', '晴', 150), '化石翼龙/超梦投放于冠军之路');
  ok(inPool('route21', '晴', 146) && inPool('route21', '雨', 151), '火焰鸟/梦幻投放于 21 号水域');
  ok(inPool('seafoam', '晴', 124), '迷唇姐投放于双子岛');
  ok(T.FISH_POOLS.route24.some(function (p) { return p.id === 79; }) && T.FISH_POOLS.seafoam.some(function (p) { return p.id === 90; }), '呆呆兽可钓、双子岛冰水域可钓大舌贝');
}
{
  // 钓鱼按水域取池：route24 强制 roll 到呆呆兽区间
  T.newGame(4);
  const s = T.getState();
  s.nodeId = 'route24';
  s.keyItems.push('破旧钓竿');
  seq.push(0.7); // 呆呆兽区间 [0.65, 0.75)
  T.fish();
  ok(s.battle && s.battle.foe.mons[0].m.species === 79, '华蓝北水域钓鱼可出呆呆兽');
}
{
  // 获取途径文本：图鉴详情数据源
  const has = function (id, kw) { return T.acquisitionPaths(id).some(function (p) { return p.indexOf(kw) !== -1; }); };
  ok(has(37, '7号道路'), '六尾途径含 7 号道路');
  ok(has(79, '24号道路') && has(79, '钓鱼'), '呆呆兽途径含华蓝北水域与钓鱼');
  ok(has(150, '冠军之路'), '超梦途径含冠军之路');
  ok(has(133, '神秘商人') && has(133, '火箭队'), '伊布途径含商人与火箭队');
  ok(has(135, '伊布') && has(135, '雷之石'), '雷伊布途径为伊布石头进化');
  ok(has(129, '鲤鱼王大叔') && has(129, '钓鱼'), '鲤鱼王途径含大叔与钓鱼');
  ok(has(1, '初始选择'), '妙蛙种子途径含初始选择');
  ok(has(16, '1号道路') && has(16, 'NPC交换'), '波波途径含野生与交换');
  ok(T.acquisitionPaths(37).length > 0 && T.acquisitionPaths(1).length > 0, '已见宝可梦都有可展示途径');
}

// ---------- 14. MVP11.1：喂养系统 ----------
section('MVP11.1：喂养系统');
{
  T.newGame(4);
  const s = T.getState();
  const mon = T.makeMon(68, 30); // 怪力：物攻最高 → 攻击糖果
  mon.held = '吃剩的东西'; // 传送的宝可梦带携带物
  s.box = [mon];
  s.money = 10000;
  const expBefore = s.expPool;
  T.transferMon(0);
  ok(s.box.length === 0, '传送后宝可梦从电脑箱移除');
  ok(s.expPool === expBefore + Math.max(10, mon.level * 150), '万能经验按等级×150 入池（30级=4500）');
  ok(s.money === 9000, '传送扣 1000 金币（30级=900，保底1000）');
  ok(s.bag['攻击糖果'] === 1, '按最高种族值掉落攻击糖果');
  ok(s.bag['吃剩的东西'] === 1, '传送后携带物退回背包');
}
{
  T.newGame(4);
  const s = T.getState();
  const mon = T.makeMon(16, 2); // 低经验波波：速度最高 → 速度糖果，经验保底
  s.box = [mon];
  s.money = 10000;
  const expBefore = s.expPool;
  T.transferMon(0);
  ok(s.expPool === expBefore + Math.max(10, mon.level * 150), '低经验传送按等级折算（2级=300）');
  ok(s.bag['速度糖果'] === 1, '波波掉落速度糖果');
}
{
  // 传送收费：等级²（最低 1000）→ 钱不够拦截、扣费、经验按等级产出
  T.newGame(4);
  const s = T.getState();
  s.box = [T.makeMon(16, 10, { nature: '勤奋' })];
  ok(T.boxTransferFee(s.box[0]) === 1000, '10级传送费保底 1000');
  const feeEdge = { lv5: T.boxTransferFee(T.makeMon(16, 5)), lv31: T.boxTransferFee(T.makeMon(16, 31)), lv32: T.boxTransferFee(T.makeMon(16, 32)), lv50: T.boxTransferFee(T.makeMon(16, 50)), lv100: T.boxTransferFee(T.makeMon(16, 100)) };
  ok(feeEdge.lv5 === 1000 && feeEdge.lv31 === 1000 && feeEdge.lv32 === 1024 && feeEdge.lv50 === 2500 && feeEdge.lv100 === 10000, '费用曲线：≤31级保底1000，32级1024，50级2500，100级10000');
  s.money = 300;
  T.transferMon(0);
  ok(s.box.length === 1 && s.money === 300, '钱不够时传送被拦截');
  s.money = 10000;
  const expBefore = s.expPool;
  T.transferMon(0);
  ok(s.box.length === 0 && s.money === 9000, '传送扣 1000 金币（10级保底）');
  ok(s.expPool === expBefore + Math.max(10, 10 * 150), '经验按等级×150（10级=1500）');
}
{
  // 糖果可出售（500金）、商店不可购买
  T.newGame(4);
  const s = T.getState();
  s.bag['HP糖果'] = 2;
  const money0 = s.money;
  T.sellItem('HP糖果', 1);
  ok(s.money === money0 + 500 && s.bag['HP糖果'] === 1, '糖果可出售（+500 金）');
  ok(T.getMartStock().indexOf('HP糖果') === -1 && T.getMartStock().indexOf('速度糖果') === -1, '商店货架不含糖果（不可购买）');
  const money1 = s.money;
  T.buyItem('HP糖果', 1);
  ok(s.money === money1 && s.bag['HP糖果'] === 1, '购买糖果被拦截');
  delete s.bag['HP糖果'];
  const money2 = s.money;
  T.sellItem('HP糖果', 1);
  ok(s.money === money2, '无糖果时出售无影响');
}
{
  T.newGame(4);
  const s = T.getState();
  const mon = s.party[0]; // 小火龙 Lv5
  s.expPool = 10000;
  const need = T.expForLevel(mon.speciesData.growth, 6) - mon.exp;
  T.allocateExp(0, 'next');
  ok(mon.level === 6 && s.expPool === 10000 - need, '注入升 1 级所需：升一级并扣对应经验');
  T.allocateExp(0, 'all');
  ok(s.expPool === 0 && mon.level > 6, '全部分配可连升多级且经验池清零');
  s.party[0] = T.makeMon(16, 100);
  s.expPool = 100;
  T.allocateExp(0, 'all');
  ok(s.expPool === 100, '满级时不能分配经验');
}
{
  T.newGame(4);
  const s = T.getState();
  const mon = s.party[0];
  s.bag['攻击糖果'] = 2;
  const atkBefore = mon.stats.atk;
  T.useBagItemOnMon('攻击糖果', 0);
  ok(mon.candyBonus.atk === 1 && mon.stats.atk === atkBefore + 1, '喂糖果：面板 +1');
  ok(s.bag['攻击糖果'] === 1, '糖果消耗 1 颗');
  mon.candyBonus.atk = 15;
  T.useBagItemOnMon('攻击糖果', 0);
  ok(s.bag['攻击糖果'] === 1, '单项达到上限后无法继续喂');
  mon.candyBonus.atk = 0;
  mon.candyBonus.total = 50;
  T.useBagItemOnMon('攻击糖果', 0);
  ok(s.bag['攻击糖果'] === 1, '总和达到上限后无法继续喂');
}
{
  T.newGame(4);
  const s = T.getState();
  s.expPool = 500;
  s.party[0].candyBonus = { hp: 3, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, total: 3 };
  T.save();
  s.expPool = 0;
  s.party = [];
  ok(T.load(), '读档成功');
  ok(T.getState().expPool === 500, '经验池随存档保存');
  ok(T.getState().party[0].candyBonus.hp === 3, '糖果加成随存档保存');
}
{
  // 替换携带道具时，旧道具退回背包（不丢失）
  T.newGame(4);
  const s = T.getState();
  const mon = s.party[0];
  mon.held = '吃剩的东西';
  s.bag['幸运蛋'] = 1;
  T.useBagItemOnMon('幸运蛋', 0);
  ok(mon.held === '幸运蛋' && s.bag['吃剩的东西'] === 1, '替换携带道具后旧道具退回背包');
  const cnt = s.bag['幸运蛋'];
  T.useBagItemOnMon('幸运蛋', 0);
  ok(mon.held === '幸运蛋' && s.bag['幸运蛋'] === cnt, '重复装备同一种不消耗且不重复退回');
}
{
  // 对训练家的宝可梦扔球：吐槽文案 + 醒目 warn 标记
  T.newGame(4);
  const s = T.getState();
  s.party = [T.makeMon(6, 20, { nature: '勤奋' })];
  s.bag['精灵球'] = 1;
  T.startTrainerBattle(T.MAP_NODES.route1.trainers[0]);
  T.battleUseItem('精灵球');
  ok(s.bag['精灵球'] === 1, '对训练家扔球不消耗');
  ok(s.log.some(function (l) { return l.indexOf('愚蠢的人类') !== -1; }), '吐槽文案生效');
  ok(s.logKinds[s.log.length - 1] === 'warn', '吐槽日志带醒目 warn 标记');
}

// ---------- 15. MVP11.2：羁绊系统 ----------
section('MVP11.2：羁绊系统');
{
  T.newGame(4);
  ok(T.getState().party[0].bond === 20, '御三家初始羁绊 20');
  ok(T.makeMon(16, 5).bond === 0, '野生/生成的宝可梦初始羁绊 0');
}
{
  // 每次战斗：首发 +3、队伍其他 +1（打赢野生战）
  T.newGame(4);
  const s = T.getState();
  s.party.push(T.makeMon(16, 5));
  s.party[0].bond = 0;
  s.party[1].bond = 0;
  s.party[0] = T.makeMon(6, 30, { nature: '勤奋' });
  s.party[0].moves = ['flamethrower'];
  s.party[0].pp = [15];
  s.party[0].bond = 0;
  T.startWildBattle(16, 2);
  let g = 0;
  while (s.battle && !s.battle.over && g++ < 30) {
    const active = s.battle.player.mons[s.battle.player.active];
    T.battleMove(damageMoveIdx(active));
  }
  ok(s.lastResult === 'win', '战斗胜利');
  ok(s.party[0].bond === 3 && s.party[1].bond === 1, '首发 +3、队伍其他 +1');
}
{
  // 道馆胜利全队 +5
  T.newGame(4);
  const s = T.getState();
  s.party = [T.makeMon(6, 30, { nature: '勤奋' })];
  s.party[0].moves = ['flamethrower'];
  s.party[0].pp = [15];
  s.party[0].bond = 0;
  T.startGymBattle(T.MAP_NODES.pewter.gym);
  let g = 0;
  while (s.battle && !s.battle.over && g++ < 60) {
    const active = s.battle.player.mons[s.battle.player.active];
    T.battleMove(damageMoveIdx(active));
  }
  ok(s.badges.indexOf('灰色徽章') !== -1, '道馆胜利');
  ok(s.party[0].bond === 8, '馆主战首发：+3（战斗）+5（道馆）');
}
{
  // 探索 10 步 +1
  T.newGame(4);
  const s = T.getState();
  s.party[0].bond = 0;
  s.party[0].exploreSteps = 9;
  s.nodeId = 'route1';
  T.explore();
  ok(s.party[0].bond === 1 && s.party[0].exploreSteps === 0, '探索 10 步触发羁绊 +1');
}
{
  // 低血用高价值道具 +1；满血恶意喂药不加
  T.newGame(4);
  const s = T.getState();
  const mon = s.party[0];
  mon.bond = 0;
  mon.hp = Math.floor(mon.stats.hp / 3);
  s.bag['好伤药'] = 2;
  T.useBagItemOnMon('好伤药', 0);
  ok(mon.bond === 1, '低血用高价值道具羁绊 +1');
  mon.hp = mon.stats.hp;
  T.useBagItemOnMon('好伤药', 0);
  ok(mon.bond === 1 && s.bag['好伤药'] === 1, '满血喂药不涨羁绊且不消耗');
}
{
  // 濒死 -5（战败净变化）
  T.newGame(4);
  const s = T.getState();
  s.party = [T.makeMon(129, 5, { nature: '勤奋' })]; // 鲤鱼王
  s.party[0].bond = 20;
  T.startWildBattle(16, 20); // 高等级波波
  let g = 0;
  while (s.battle && !s.battle.over && g++ < 30) {
    const active = s.battle.player.mons[s.battle.player.active];
    T.battleMove(damageMoveIdx(active));
  }
  ok(s.lastResult === 'lose', '战败');
  ok(s.party[0].bond < 20, '濒死后羁绊下降（战败 +3 后仍低于初始 20）');
}
{
  // 存入电脑 -10
  T.newGame(4);
  const s = T.getState();
  s.party.push(T.makeMon(16, 5));
  s.box = [T.makeMon(19, 5)];
  s.party[0].bond = 50;
  T.boxSwap(0, 0);
  ok(s.party[0].species === 19 && s.box[0].species === 4, '交换成功');
  ok(s.box[0].bond === 40, '存入电脑的宝可梦羁绊 -10');
}
{
  // 阶段二：经验 ×1.1
  T.newGame(4);
  const mon = T.makeMon(16, 100);
  mon.bond = 50;
  const exp0 = mon.exp;
  T.grantExp(mon, 100, []);
  ok(mon.exp - exp0 === 110, '羁绊 30+ 经验 ×1.1');
}
{
  // 阶段三：暴击率提升（统计）
  T.newGame(4);
  const mk = function (bond) {
    const mon = T.makeMon(4, 50, { nature: '勤奋' });
    mon.bond = bond;
    return mon;
  };
  const def = T.makeMon(16, 50, { nature: '勤奋' });
  let critHigh = 0, critLow = 0;
  for (let i = 0; i < 600; i++) {
    if (T.calcDamage({ m: mk(70), stages: {} }, { m: def, stages: {} }, T.MOVES.ember, null).crit) critHigh++;
    if (T.calcDamage({ m: mk(0), stages: {} }, { m: def, stages: {} }, T.MOVES.ember, null).crit) critLow++;
  }
  ok(critHigh > critLow, '羁绊 60+ 暴击次数明显更多（' + critHigh + ' vs ' + critLow + '）');
}
{
  // 速度利用：首回合速度对比提示 + 先发制人（先手伤害 +10%）
  T.newGame(4);
  const s = T.getState();
  s.party = [T.makeMon(25, 30, { nature: '勤奋' })];
  s.party[0].moves = ['thunderbolt']; // 用伤害招验证先发制人
  s.party[0].pp = [15];
  s.party[0].stats.spe = 999;
  T.startWildBattle(16, 10);
  s.battle.foe.mons[0].m.stats.spe = 1;
  s.battle.foe.mons[0].m.moves = ['tackle'];
  s.battle.foe.mons[0].m.pp = [35];
  const logLen = s.log.length;
  T.battleMove(0);
  const newLogs = s.log.slice(logLen);
  ok(newLogs.some(function (l) { return l.indexOf('速度') !== -1 && l.indexOf('先手') !== -1; }), '首回合显示速度对比与先手提示');
  ok(newLogs.some(function (l) { return l.indexOf('先发制人') !== -1; }), '先手方出招有“先发制人”提示');
}
{
  // 先发制人伤害 +10%（统计平均）
  const atk = T.makeMon(4, 50, { nature: '勤奋' });
  const defMon = T.makeMon(16, 50, { nature: '勤奋' });
  const mk = function (fs) { return { m: atk, stages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, firstStrike: fs }; };
  const d = { m: defMon, stages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } };
  let sumA = 0, sumB = 0;
  for (let i = 0; i < 400; i++) {
    sumA += T.calcDamage(mk(true), d, T.MOVES.ember, null).dmg;
    sumB += T.calcDamage(mk(false), d, T.MOVES.ember, null).dmg;
  }
  ok(sumA > sumB * 1.02 && sumA <= sumB * 1.1, '先发制人伤害平均高约 5%（' + (sumA / 400).toFixed(1) + ' vs ' + (sumB / 400).toFixed(1) + '）');
}
{
  // 速度碾压暴击率提升（统计）
  const mk = function (spe) {
    const mon = T.makeMon(4, 50, { nature: '勤奋' });
    mon.stats.spe = spe;
    return { m: mon, stages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } };
  };
  const defMon = T.makeMon(16, 50, { nature: '勤奋' });
  defMon.stats.spe = 100;
  const def = { m: defMon, stages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } };
  let critHigh = 0, critLow = 0;
  for (let i = 0; i < 600; i++) {
    if (T.calcDamage(mk(200), def, T.MOVES.ember, null).crit) critHigh++;
    if (T.calcDamage(mk(100), def, T.MOVES.ember, null).crit) critLow++;
  }
  ok(critHigh > critLow, '速度碾压（200 vs 100）暴击次数更多（' + critHigh + ' vs ' + critLow + '）');
}
{
  // 逃跑成功率与速度挂钩：高速必成、低速可能失败且敌方行动
  T.newGame(4);
  const s = T.getState();
  s.party = [T.makeMon(25, 20, { nature: '勤奋' })];
  s.party[0].stats.spe = 999;
  T.startWildBattle(16, 5);
  s.battle.foe.mons[0].m.stats.spe = 1;
  s.battle.foe.mons[0].m.moves = ['tackle'];
  s.battle.foe.mons[0].m.pp = [35];
  T.battleRun();
  ok(s.battle === null && s.lastResult === 'run', '速度碾压时逃跑必成功');
}
{
  T.newGame(4);
  const s = T.getState();
  s.party = [T.makeMon(25, 20, { nature: '勤奋' })];
  s.party[0].stats.spe = 1;
  T.startWildBattle(16, 20);
  s.battle.foe.mons[0].m.stats.spe = 100;
  s.battle.foe.mons[0].m.moves = ['tackle'];
  s.battle.foe.mons[0].m.pp = [35];
  const hp0 = s.battle.player.mons[0].m.hp;
  const logLen = s.log.length;
  seq.length = 0;
  seq.push(0.9); // 90 ≥ 成功率 50 → 逃跑失败
  T.battleRun();
  ok(s.battle !== null, '低速逃跑失败后战斗继续');
  ok(s.log.slice(logLen).some(function (l) { return l.indexOf('逃跑失败了') !== -1; }), '逃跑失败有提示');
  ok(s.battle.player.mons[0].m.hp < hp0, '逃跑失败后敌方行动造成伤害');
}
{
  // 速度提示不刷屏 + 先发制人只在首回合
  T.newGame(4);
  const s = T.getState();
  s.party = [T.makeMon(25, 30, { nature: '勤奋' })];
  s.party[0].moves = ['thunderbolt'];
  s.party[0].pp = [15];
  s.party[0].stats.spe = 999;
  s.party[0].stats.hp = 99999;
  T.startWildBattle(16, 30);
  s.battle.foe.mons[0].m.stats.spe = 1;
  s.battle.foe.mons[0].m.moves = ['tackle'];
  s.battle.foe.mons[0].m.pp = [35];
  s.battle.foe.mons[0].m.stats.hp = 99999;
  T.battleMove(0);
  const c1 = s.log.filter(function (l) { return l.indexOf('速度') !== -1; }).length;
  const fs1 = s.log.filter(function (l) { return l.indexOf('先发制人') !== -1; }).length;
  T.battleMove(0);
  const c2 = s.log.filter(function (l) { return l.indexOf('速度') !== -1; }).length;
  const fs2 = s.log.filter(function (l) { return l.indexOf('先发制人') !== -1; }).length;
  ok(c1 === 1 && c2 === 1, '先手方不变时速度提示只在首回合出现');
  ok(fs1 === 1 && fs2 === 1, '先发制人只在首回合出现（后续回合无加成）');
}
{
  // 阶段四：20% 毅力锁血（每场一次）
  T.newGame(4);
  const s = T.getState();
  s.party = [T.makeMon(143, 30, { nature: '勤奋' })]; // 卡比兽（慢）
  const mon = s.party[0];
  mon.moves = ['growl'];
  mon.pp = [40];
  mon.hp = 3;
  mon.bond = 95;
  T.startWildBattle(16, 10);
  seq = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // 覆盖命中/效果/暴击/浮动/锁血判定
  T.battleMove(0);
  seq = [];
  ok(s.battle && s.battle.player.mons[0].m.hp === 1 && s.battle.player.mons[0].enduredThisBattle === true, '濒死时毅力锁血到 1 点（本场仅一次）');
  T.battleMove(0); // 第二次命中不再锁血 → 倒下
  ok(s.lastResult === 'lose', '锁血后再次被击倒则正常败北');
}
{
  // 阶段四：10% 回合末自愈异常
  T.newGame(4);
  const s = T.getState();
  s.party = [T.makeMon(143, 30, { nature: '勤奋' })];
  const mon = s.party[0];
  mon.moves = ['growl'];
  mon.pp = [40];
  mon.status = '中毒';
  mon.bond = 95;
  T.startWildBattle(16, 5);
  seq = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // 覆盖命中/效果/伤害/自愈判定
  T.battleMove(0);
  seq = [];
  ok(s.battle && s.battle.player.mons[0].m.status === null, '羁绊 90+ 回合末自愈异常');
  while (s.battle && !s.battle.over && s.battle.turn < 10) {
    const active = s.battle.player.mons[s.battle.player.active];
    T.battleMove(damageMoveIdx(active));
  }
}
{
  // 羁绊随存档保存
  T.newGame(4);
  const s = T.getState();
  s.party[0].bond = 77;
  T.save();
  s.party = [];
  T.load();
  ok(T.getState().party[0].bond === 77, '羁绊随存档保存');
}

// ---------- 全战斗类型回归（速度机制后）：每种战斗完整打到胜利 ----------
section('全战斗类型回归（速度机制后）');
function strongTeam() {
  T.newGame(4);
  const s = T.getState();
  s.party = [T.makeMon(6, 99, { nature: '固执' })];
  s.party[0].stats.spe = 999;
  s.party[0].stats.hp = 9999;
  s.party[0].hp = 9999;
  s.party[0].moves = ['flamethrower', 'dragon_claw', 'earthquake', 'hyper_beam'];
  s.party[0].pp = [15, 15, 10, 5];
  return s;
}
function superTeam() {
  T.newGame(4);
  const s = T.getState();
  s.party = [T.makeMon(6, 100, { nature: '固执' }), T.makeMon(150, 100, { nature: '内敛' }), T.makeMon(143, 100, { nature: '固执' }), T.makeMon(149, 100, { nature: '固执' })];
  s.party.forEach(function (m) {
    m.stats.spe = 999;
    m.stats.hp = 9999;
    m.hp = 9999;
    m.moves = ['flamethrower', 'dragon_claw', 'earthquake', 'hyper_beam'];
    m.pp = [15, 15, 10, 5];
  });
  return s;
}
function fightToEnd() {
  let guard = 0;
  while (T.getState().battle && !T.getState().battle.over && guard++ < 160) {
    T.battleMove(strongMoveIdx(T.getState().battle));
  }
  return T.getState().lastResult;
}
{
  const s = strongTeam();
  T.startWildBattle(16, 20);
  ok(fightToEnd() === 'win', '野生战斗胜利');
}
{
  const s = strongTeam();
  T.startTrainerBattle(T.MAP_NODES.route1.trainers[0]);
  ok(fightToEnd() === 'win' && s.trainersDefeated['r1_t1'] === true, '路人训练家战斗胜利并记录');
}
{
  const s = strongTeam();
  T.startRocketBattle('robbery');
  ok(fightToEnd() === 'win' && s.bag['金珠'] === 1, '火箭队抢劫战胜利并掉落金珠');
}
{
  const s = strongTeam();
  T.startRocketBattle('rescue');
  ok(fightToEnd() === 'win' && (s.party.concat(s.box)).some(function (m) { return m.species === 133; }) && s.caughtDex[133] === true, '火箭队解救战胜利且伊布入队');
}
{
  const s = strongTeam();
  T.startRivalBattle({ step: 'r3', team: [{ id: 7, level: 13 }, { id: 16, level: 13 }] });
  ok(fightToEnd() === 'win' && s.rivalWon.indexOf('r3') !== -1, '宿敌战胜利并记录');
}
{
  const s = strongTeam();
  s.nodeId = 'pewter';
  T.challengeGym();
  ok(s.battle && s.battle.kind === 'gym_apprentice', '道馆连战从学徒开始');
  ok(fightToEnd() === 'win' && s.badges.indexOf('灰色徽章') !== -1 && s.bag['TM岩石封锁'] === 1, '道馆连战（学徒×2+馆主）胜利获徽章与 TM');
}
{
  const s = strongTeam();
  s.nodeId = 'vermilion';
  T.startSSAnne();
  ok(fightToEnd() === 'win' && s.ssAnneDone === true && s.bag['TM居合斩'] === 1, '圣安奴号战胜利获 TM 居合斩');
}
{
  const s = strongTeam();
  s.nodeId = 'route1';
  s.banditToll = true;
  T.resolveBandit(false);
  ok(s.battle && s.battle.kind === 'bandit', '强盗战开战');
  ok(fightToEnd() === 'win' && s.money === 3000 + 1600, '强盗战胜利获 1600 金');
}
{
  const s = strongTeam();
  s.badges.push('绿色徽章');
  s.nodeId = 'tower';
  s.tower = { floor: 1, checkpoint: 0, bestFloor: 0, cleared: false };
  T.startTowerFloor();
  ok(fightToEnd() === 'win' && s.tower.floor === 2 && s.tower.bestFloor === 1, '无尽之塔首层胜利并推进');
}
{
  // 塔内 × 速度机制：逃跑仍不可、首回合速度提示、先发制人仅首回合生效
  const s = strongTeam();
  s.badges.push('绿色徽章');
  s.nodeId = 'tower';
  s.tower = { floor: 1, checkpoint: 0, bestFloor: 0, cleared: false };
  T.startTowerFloor();
  ok(s.battle.canRun === false, '塔内不可逃跑（速度机制不改变）');
  T.battleRun();
  ok(s.battle && !s.battle.over, '塔内逃跑仍被拦截');
  const logLen = s.log.length;
  T.battleMove(strongMoveIdx(s.battle));
  const logs = s.log.slice(logLen);
  ok(logs.some(function (l) { return l.indexOf('速度') !== -1 && l.indexOf('先手') !== -1; }), '塔内首回合显示速度对比');
  ok(logs.some(function (l) { return l.indexOf('先发制人') !== -1; }), '塔内首回合先发制人生效');
  const fs1 = s.log.filter(function (l) { return l.indexOf('先发制人') !== -1; }).length;
  T.battleMove(strongMoveIdx(s.battle));
  const fs2 = s.log.filter(function (l) { return l.indexOf('先发制人') !== -1; }).length;
  ok(fs1 === 1 && fs2 === 1, '塔内先发制人只在首回合（后续回合无加成）');
}
{
  // 电脑箱锁定：上锁后仅不可传送（仍可取回），解锁恢复；默认不上锁；随存档保存
  T.newGame(4);
  const s = T.getState();
  s.box = [T.makeMon(16, 10, { nature: '勤奋' })];
  s.money = 10000;
  ok(s.box[0].locked === false, '新宝可梦默认不上锁');
  s.box[0].locked = true;
  const expBefore = s.expPool;
  T.transferMon(0);
  ok(s.box.length === 1 && s.expPool === expBefore, '上锁宝可梦无法传送');
  T.boxSwap(0, 0);
  ok(s.box[0].species === 4 && s.party[0].species === 16, '上锁宝可梦仍可取回（锁只限制传送）');
  T.boxSwap(0, 0); // 换回来继续验证传送
  s.box[0].locked = false;
  T.transferMon(0);
  ok(s.box.length === 0, '解锁后可正常传送');
  s.box = [T.makeMon(19, 10, { nature: '勤奋' })];
  s.box[0].locked = true;
  T.save();
  s.box = [];
  ok(T.load() && T.getState().box[0].locked === true, '锁定状态随存档保存');
  const legacy = JSON.parse(localStorage.getItem('bkm_poke_save_v1'));
  delete legacy.box[0].locked;
  localStorage.setItem('bkm_poke_save_v1', JSON.stringify(legacy));
  s.box = [];
  ok(T.load() && T.getState().box[0].locked === false, '旧档无锁定字段默认不上锁');
}
{
  // 玩家名：新游戏随机分配、可改名、随存档保存、旧档自动分配
  T.newGame(4);
  const s = T.getState();
  ok(!!s.name && s.name.length >= 2, '新游戏自动分配随机名字');
  ok(T.renamePlayer('星野光太') === true && s.name === '星野光太', '改名成功');
  T.save();
  s.name = '';
  ok(T.load() && T.getState().name === '星野光太', '名字随存档保存');
  ok(T.renamePlayer('') === false && s.name === '星野光太', '空名字被拒绝');
  ok(T.renamePlayer('一二三四五六七八九十一') === false && s.name === '星野光太', '超长名字被拒绝（10 字上限）');
  const legacy = JSON.parse(localStorage.getItem('bkm_poke_save_v1'));
  delete legacy.name;
  localStorage.setItem('bkm_poke_save_v1', JSON.stringify(legacy));
  s.name = '';
  ok(T.load() && !!T.getState().name, '旧档无名字自动分配');
}
{
  // 超越之塔数据：数量每 10 层 +1、显示 Lv101-200、强度 1.1→2.6
  ok(T.towerFoeTeam(1, true).length === 3, '超越之塔 1 层 3 只');
  ok(T.towerFoeTeam(10, true).length === 3, '超越之塔 10 层 3 只');
  ok(T.towerFoeTeam(11, true).length === 4, '超越之塔 11 层 4 只（每 10 层 +1）');
  ok(T.towerFoeTeam(100, true).length === 12, '超越之塔 100 层 12 只');
  const f1 = T.towerFoeTeam(1, true)[0];
  ok(f1.displayLevel === 101 && Math.abs(f1.statMult - 1.1) < 0.001, '1 层显示 Lv101、强度 1.1');
  const f100 = T.towerFoeTeam(100, true)[0];
  ok(f100.displayLevel === 200 && f100.statMult > 2.5 && f100.statMult <= 2.6, '100 层显示 Lv200、强度 2.5+ 且封顶 2.6');
}
{
  // 超越之塔流程：解锁→推进→10 层闪光石奖励与称号→败北回档→100 层通关虹色石
  const s = superTeam();
  s.nodeId = 'tower';
  T.startSuperTowerFloor();
  ok(!s.battle, '未通关无尽之塔不能进入超越之塔');
  s.tower = { floor: 100, checkpoint: 95, bestFloor: 100, cleared: true, superFloor: 9, superCheckpoint: 0, superBest: 8, superCleared: false };
  T.startSuperTowerFloor();
  ok(s.battle && s.battle.kind === 'super_tower' && s.battle.foe.mons[0].m.displayLevel === 109, '解锁后进入超越之塔第 9 层（显示 Lv109）');
  ok(fightToEnd() === 'win', '超越之塔第 9 层胜利');
  ok(s.tower.superFloor === 10 && s.tower.superBest === 9, '胜利推进到第 10 层');
  T.startSuperTowerFloor();
  ok(fightToEnd() === 'win', '超越之塔第 10 层胜利');
  ok(s.tower.superFloor === 11 && s.tower.superCheckpoint === 10, '10 层存档点推进');
  ok(s.bag['闪光石'] === 1, '10 层奖励闪光石');
  ok(T.isTitleUnlocked('super10'), '10 层解锁称号登塔者');
  // 败北回档
  s.tower.superFloor = 12;
  s.tower.superCheckpoint = 10;
  s.party.forEach(function (m) { m.hp = 1; });
  T.startSuperTowerFloor();
  ok(fightToEnd() === 'lose', '超越之塔第 12 层败北');
  ok(s.tower.superFloor === 11, '败北回到存档点+1（第 11 层）');
  // 100 层通关（单只对手，验证奖励分支）
  s.tower.superFloor = 100;
  s.tower.superCheckpoint = 90;
  s.tower.superBest = 99;
  T.startBattle('super_tower', { foe: [{ id: 16, level: 100, statMult: 1, displayLevel: 200 }], canRun: false });
  ok(fightToEnd() === 'win', '超越之塔第 100 层胜利');
  ok(s.tower.superCleared === true && s.tower.superFloor === 100, '100 层通关');
  ok(s.bag['虹色闪光石'] === 1 && s.bag['大师球'] === 3 && s.bag['幸运蛋'] === 1, '通关奖励虹色闪光石/大师球/幸运蛋');
  ok(T.isTitleUnlocked('super100'), '通关解锁称号超越者');
}
{
  // 闪光：闪光石让宝可梦变闪光，重复使用拦截
  const s = superTeam();
  s.bag['闪光石'] = 1;
  ok(s.party[0].shiny === false, '初始非闪光');
  T.useBagItemOnMon('闪光石', 0);
  ok(s.party[0].shiny === true && !s.bag['闪光石'], '闪光石让宝可梦变闪光并消耗');
  s.bag['闪光石'] = 1;
  T.useBagItemOnMon('闪光石', 0);
  ok(s.party[0].shiny === true && s.bag['闪光石'] === 1, '已闪光重复使用被拦截（不消耗）');
}
{
  // 称号：未解锁拒绝、解锁可装备/卸下、随存档保存、旧档塔进度默认超塔字段
  const s = superTeam();
  ok(T.equipTitle('tower100') === false && s.equippedTitle === null, '未解锁称号不能装备');
  s.tower.cleared = true;
  s.titles.push('tower100');
  ok(T.equipTitle('tower100') === true && s.equippedTitle === 'tower100@普通', '装备称号成功（旧格式默认普通）');
  ok(T.equipTitle(null) === true && s.equippedTitle === null, '卸下称号成功');
  T.save();
  s.equippedTitle = null;
  s.titles = [];
  ok(T.load() && T.getState().titles.indexOf('tower100@普通') !== -1, '称号随存档保存');
  const legacy = JSON.parse(localStorage.getItem('bkm_poke_save_v1'));
  delete legacy.tower.superFloor;
  delete legacy.tower.superCleared;
  localStorage.setItem('bkm_poke_save_v1', JSON.stringify(legacy));
  s.tower = null;
  ok(T.load() && T.getState().tower.superFloor === 1 && T.getState().tower.superCleared === false, '旧档塔进度默认补全超越之塔字段');
}
{
  // 称号稀有度：属性加成、3合1合成、分解碎片、兑换、随机箱、旧档兼容
  const s = superTeam();
  s.titles = ['super100@史诗'];
  T.equipTitle('super100', '史诗');
  ok(s.equippedTitle === 'super100@史诗', '装备史诗称号');
  ok(T.titleBonusMap('super100', '史诗').atk === 4 && T.titleBonusMap('super100', '史诗').spe === 4, '超越者史诗五项 +4');
  ok(T.titleBonusMap('super10', '史诗').atk === 3, '登塔者史诗攻击 +3（基础2+稀有度1）');
  ok(T.titleBonusMap('super70', '史诗').atk === 4 && T.titleBonusMap('super70', '史诗').spd === 2, '传说挑战者史诗含特防加成');
  const pm = { m: s.party[0], stages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, side: 'player' };
  const withBonus = T.effStat(pm, 'atk');
  T.equipTitle(null);
  const withoutBonus = T.effStat(pm, 'atk');
  ok(withBonus === withoutBonus + 4, '超越者史诗攻击 +4（玩家侧生效）');
  // 合成：3 普通 → 1 少见
  s.titles = ['tower100@普通', 'tower100@普通', 'tower100@普通'];
  const synth = T.synthesizeTitle('tower100', '普通');
  ok(synth.ok && T.titleCount('tower100', '普通') === 0 && T.titleCount('tower100', '少见') === 1, '3 合 1 合成少见');
  // 分解按档位：少见 → 2 碎片
  const shardsBefore = s.bag['称号碎片'] || 0;
  const dis = T.dismantleTitle('tower100', '少见');
  ok(dis.ok && T.titleCount('tower100', '少见') === 0 && (s.bag['称号碎片'] || 0) === shardsBefore + 2, '分解少见得 2 碎片');
  // 史诗分解 → 5 碎片
  s.titles = ['super10@史诗'];
  const shards2 = s.bag['称号碎片'] || 0;
  T.dismantleTitle('super10', '史诗');
  ok((s.bag['称号碎片'] || 0) === shards2 + 5, '分解史诗得 5 碎片');
  // 兑换堵漏：未获得过不能兑换
  s.titles = [];
  ok(!T.exchangeTitle('super100').ok, '未获得过超越者不能兑换（堵漏）');
  // 获得过（任意档）后可兑换：5 碎片 → 普通版
  s.titles = ['super100@普通'];
  s.bag['称号碎片'] = 5;
  const ex = T.exchangeTitle('super100');
  ok(ex.ok && T.titleCount('super100', '普通') === 2 && (s.bag['称号碎片'] || 0) === 0, '获得过后可兑换普通版');
  // 史诗不可再合成
  s.titles = ['super100@史诗'];
  ok(!T.synthesizeTitle('super100', '史诗').ok, '史诗不可再合成');
  // 随机称号箱
  const beforeN = s.titles.length;
  T.rollTitleBox();
  ok(s.titles.length === beforeN + 1, '随机称号箱获得一个称号');
  // 旧档中文名/id → 普通版
  T.save();
  const legacy = JSON.parse(localStorage.getItem('bkm_poke_save_v1'));
  legacy.titles = ['无尽之塔征服者', 'tower100'];
  localStorage.setItem('bkm_poke_save_v1', JSON.stringify(legacy));
  s.titles = [];
  ok(T.load() && T.getState().titles.filter(function (x) { return x === 'tower100@普通'; }).length === 2, '旧档中文名/id 转普通版');
}
{
  // 地图传送计费：500 起步、每次 +100、封顶 1w、每天重置、存档保存
  T.newGame(4);
  const s = T.getState();
  ok(s.teleportCost === 500 && !!s.teleportDate, '新游戏传送费用 500 且记录日期');
  const m0 = s.money;
  const r1 = T.chargeTeleport();
  ok(r1.ok && r1.cost === 500 && s.money === m0 - 500 && s.teleportCost === 600, '首次传送扣 500、下次 600');
  s.money = 999999;
  for (let i = 0; i < 100; i++) T.chargeTeleport();
  ok(s.teleportCost === 10000, '费用递增封顶 10000');
  s.money = 100;
  const poor = T.chargeTeleport();
  ok(!poor.ok && s.money === 100 && s.teleportCost === 10000, '钱不够时传送被拦截');
  s.money = 99999;
  T.chargeTeleport();
  ok(s.teleportCost === 10000, '封顶后费用保持 10000');
  s.money = 10000;
  const exact = T.chargeTeleport();
  ok(exact.ok && s.money === 0, '钱正好等于费用时扣费成功归零');
  s.teleportDate = '2000-01-01';
  ok(T.getTeleportCost() === 500, '跨天后费用重置为 500');
  s.money = 99999;
  s.teleportCost = 1200;
  T.save();
  s.teleportCost = 0;
  s.teleportDate = '';
  ok(T.load() && T.getState().teleportCost === 1200, '传送费用随存档保存');
  const legacy = JSON.parse(localStorage.getItem('bkm_poke_save_v1'));
  delete legacy.teleportCost;
  delete legacy.teleportDate;
  localStorage.setItem('bkm_poke_save_v1', JSON.stringify(legacy));
  s.teleportCost = 0;
  ok(T.load() && T.getState().teleportCost === 500, '旧档无传送费用字段默认 500');
}
{
  // 火箭队秘密仓库（彩虹市）：10% 触发、打赢得蛋、蛋孵出未选御三家、一次性
  T.newGame(4); // 开局选小火龙
  const s = T.getState();
  s.party = [T.makeMon(6, 50, { nature: '固执' })];
  // 场景加固：避免破坏光线反作用力 + 随机胜负，保证仓库战必赢（测试关注点在于触发/奖励/一次性）
  s.party[0].moves = ['flamethrower', 'dragon_claw', 'earthquake', 'body_slam'];
  s.party[0].pp = [15, 15, 10, 15];
  s.party[0].stats.hp = 9999;
  s.party[0].hp = 9999;
  s.party[0].stats.spe = 300;
  s.nodeId = 'celadon';
  seq.length = 0; seq.push(0.5);
  s.wanderUsed = false;
  T.wanderTown();
  ok(!s.battle, '闲逛未触发仓库（概率外）');
  seq.length = 0; seq.push(0.05);
  s.wanderUsed = false;
  T.wanderTown();
  ok(s.battle && s.battle.kind === 'rocket_warehouse', '彩虹市闲逛触发火箭队秘密仓库');
  ok(fightToEnd() === 'win', '仓库战斗胜利');
  ok(s.bag['走私的精灵蛋'] === 1 && s.rocketWarehouseDone === true, '打赢得走私的精灵蛋并标记');
  seq.length = 0; seq.push(0.01);
  s.wanderUsed = false;
  s.battle = null;
  T.wanderTown();
  ok(!s.battle, '已领取后不再触发仓库');
  T.useEggItem();
  ok(!s.bag['走私的精灵蛋'], '蛋使用后消耗');
  const got = s.party.concat(s.box).filter(function (m) { return m.species === 1 || m.species === 7; });
  ok(got.length === 1 && (s.caughtDex[1] === true || s.caughtDex[7] === true), '蛋孵出未选御三家（妙蛙种子或杰尼龟）');
  T.save();
  s.rocketWarehouseDone = false;
  ok(T.load() && T.getState().rocketWarehouseDone === true, '仓库标记随存档保存');
}
{
  // 多宝可梦连战：敌方换第二只后，新对位首回合重新判定先发制人与速度对比
  const s = strongTeam();
  // 避免自动选招选到破坏光线（反作用力会跳过先发制人日志），换成无反作用的高威力招
  s.party[0].moves = ['flamethrower', 'dragon_claw', 'earthquake', 'body_slam'];
  s.party[0].pp = [15, 15, 10, 15];
  T.startTrainerBattle({ id: 'pair_test', title: '训练家', name: '测试', text: '来战！', party: [{ id: 16, level: 3 }, { id: 19, level: 3 }] });
  T.battleMove(strongMoveIdx(s.battle)); // 第一回合：秒杀第一只（第二只上场）
  const firstCount = s.log.filter(function (l) { return l.indexOf('先发制人') !== -1; }).length;
  ok(firstCount >= 1, '首个对位首回合先发制人生效');
  const lenBefore = s.log.length;
  T.battleMove(strongMoveIdx(s.battle)); // 第二回合：对位敌方第二只
  const secondLogs = s.log.slice(lenBefore);
  const secondCount = s.log.filter(function (l) { return l.indexOf('先发制人') !== -1; }).length;
  ok(secondLogs.some(function (l) { return l.indexOf('速度') !== -1 && l.indexOf('先手') !== -1; }), '敌方换第二只后重新显示速度对比');
  ok(secondCount > firstCount, '敌方第二只上场后的首回合再次先发制人（+5%）');
  ok(fightToEnd() === 'win', '多宝可梦连战正常打完');
}

console.log('\n========== 结果：' + passed + ' 通过 / ' + failed + ' 失败 ==========');
process.exit(failed > 0 ? 1 : 0);
