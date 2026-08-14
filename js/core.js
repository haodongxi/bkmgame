/* ============================================================
   宝可梦：关都篇 - 核心游戏逻辑（纯文字像素版）
   Created by haodongsheng
   说明：本文件不含 DOM，可在浏览器与 Node vm 测试中运行。
   ============================================================ */

const SAVE_KEY = 'bkm_poke_save_v1';
const GAME_VERSION = 1;
// 队伍上限：超过该数量捕获/获得的宝可梦进电脑箱
const PARTY_LIMIT = 4;
// 闲逛事件重新激活所需的野外遭遇战次数（离开城镇不再重置，需要打够次数）
const WANDER_REFRESH_BATTLES = 3;

const STATE = {
  version: GAME_VERSION,
  screen: 'title',            // title | starter | map | battle
  nodeId: 'pallet',
  weather: '晴',
  money: 3000,
  expPool: 0,
  bag: {},
  badges: [],
  party: [],
  box: [],
  visitedNodes: [],
  tower: { floor: 1, checkpoint: 0, bestFloor: 0, cleared: false },
  titles: [],
  log: [],
  logKinds: [],
  wildBattles: 0,
  lastBattleView: null,
  battle: null,
  pendingLearn: [],
  seenDex: {},
  caughtDex: {},
  trainersDefeated: {},
  lastTown: 'pallet',
  name: '',
  keyItems: [],
  rivalWon: [],
  gymSession: null,
  townTrade: null,
  trashFound: false,
  wanderUsed: false,
  ssAnneDone: false,
  magikarpDone: false,
  magikarpOffer: false,
  merchantOffer: null,
  banditToll: false,
  banditPrice: 800,
  medicOffer: false,
  repel: 0,
  weatherBias: null,
  weatherBoost: 0
};

// ---------------- 基础工具 ----------------

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function pickWeighted(pool) {
  let total = 0;
  for (let i = 0; i < pool.length; i++) total += pool[i].w;
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= pool[i].w;
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

function addLog(text, kind) {
  STATE.log.push(text);
  STATE.logKinds.push(kind || '');
  // 战斗内每行日志都记录一份当前 HP 快照，供播放层血条分步结算
  if (STATE.battle && STATE.battle.hpSteps) STATE.battle.hpSteps.push(battleHpSnapshot());
  // 日志上限裁剪只在非战斗时进行：战斗中裁剪会让 logStart/播放索引失效，导致战斗日志框清空、播放被跳过
  if (!STATE.battle && STATE.log.length > 5000) {
    STATE.log.splice(0, STATE.log.length - 5000);
    STATE.logKinds.splice(0, STATE.logKinds.length - 5000);
  }
}

function findPartyMonIdx(pred) {
  for (let i = 0; i < STATE.party.length; i++) if (pred(STATE.party[i])) return i;
  return -1;
}

function bagCount(name) { return STATE.bag[name] || 0; }
function addItem(name, n) { STATE.bag[name] = (STATE.bag[name] || 0) + (n || 1); }
function removeItem(name, n) {
  const cnt = bagCount(name);
  if (cnt <= 0) return false;
  STATE.bag[name] = cnt - (n || 1);
  if (STATE.bag[name] <= 0) delete STATE.bag[name];
  return true;
}

// ---------------- 成长曲线（官方公式） ----------------

const GROWTH_FN = {
  fast: function (n) { return Math.floor(Math.pow(n, 3) * 4 / 5); },
  medium_fast: function (n) { return Math.pow(n, 3); },
  medium_slow: function (n) { return Math.floor(1.2 * Math.pow(n, 3) - 15 * n * n + 100 * n - 140); },
  slow: function (n) { return Math.floor(5 * Math.pow(n, 3) / 4); }
};

// 性格（Gen3）：某项 +10%、另一项 -10%，五项中性
const NATURES = {
  '勤奋': { atk: 1, def: 1, spa: 1, spd: 1, spe: 1 },
  '怕寂寞': { atk: 1.1, def: 0.9, spa: 1, spd: 1, spe: 1 },
  '固执': { atk: 1.1, def: 1, spa: 0.9, spd: 1, spe: 1 },
  '顽皮': { atk: 1.1, def: 1, spa: 1, spd: 0.9, spe: 1 },
  '勇敢': { atk: 1.1, def: 1, spa: 1, spd: 1, spe: 0.9 },
  '大胆': { atk: 0.9, def: 1.1, spa: 1, spd: 1, spe: 1 },
  '淘气': { atk: 1, def: 1.1, spa: 0.9, spd: 1, spe: 1 },
  '无虑': { atk: 1, def: 1.1, spa: 1, spd: 0.9, spe: 1 },
  '悠闲': { atk: 1, def: 1.1, spa: 1, spd: 1, spe: 0.9 },
  '胆小': { atk: 0.9, def: 1, spa: 1, spd: 1, spe: 1.1 },
  '急躁': { atk: 1, def: 0.9, spa: 1, spd: 1, spe: 1.1 },
  '爽朗': { atk: 1, def: 1, spa: 0.9, spd: 1, spe: 1.1 },
  '天真': { atk: 1, def: 1, spa: 1, spd: 0.9, spe: 1.1 },
  '内敛': { atk: 0.9, def: 1, spa: 1.1, spd: 1, spe: 1 },
  '慢吞吞': { atk: 1, def: 0.9, spa: 1.1, spd: 1, spe: 1 },
  '冷静': { atk: 1, def: 1, spa: 1.1, spd: 1, spe: 0.9 },
  '马虎': { atk: 1, def: 1, spa: 1.1, spd: 0.9, spe: 1 },
  '温和': { atk: 0.9, def: 1, spa: 1, spd: 1.1, spe: 1 },
  '温顺': { atk: 1, def: 0.9, spa: 1, spd: 1.1, spe: 1 },
  '慎重': { atk: 1, def: 1, spa: 0.9, spd: 1.1, spe: 1 },
  '自大': { atk: 1, def: 1, spa: 1, spd: 1.1, spe: 0.9 },
  '坦率': { atk: 1, def: 1, spa: 1, spd: 1, spe: 1 },
  '害羞': { atk: 1, def: 1, spa: 1, spd: 1, spe: 1 },
  '认真': { atk: 1, def: 1, spa: 1, spd: 1, spe: 1 },
  '浮躁': { atk: 1, def: 1, spa: 1, spd: 1, spe: 1 }
};
const NATURE_KEYS = Object.keys(NATURES);

// 挣扎：所有招式都无效时的兜底（正作机制，无属性、命中必中、反伤 1/4）
const STRUGGLE = {
  id: 'struggle', name: '挣扎', type: '普通', category: '物理',
  power: 50, acc: 0, pp: 1, struggle: true,
  effect: { kind: 'recoil', ratio: 0.25 }
};

function expForLevel(growth, level) {
  if (level <= 1) return 0;
  return GROWTH_FN[growth](level);
}

function expToNext(mon) {
  return expForLevel(mon.speciesData.growth, mon.level + 1) - expForLevel(mon.speciesData.growth, mon.level);
}

// ---------------- 宝可梦生成 ----------------

function movesAtLevel(data, level) {
  const entries = Object.keys(data.learnset || {})
    .map(function (lv) { return { lv: parseInt(lv, 10), moves: data.learnset[lv] }; })
    .filter(function (e) { return e.lv <= level; })
    .sort(function (a, b) { return a.lv - b.lv; });
  const all = [];
  for (let i = 0; i < entries.length; i++) all.push.apply(all, entries[i].moves);
  return all.slice(-4);
}

const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

function makeMon(speciesId, level, opts) {
  opts = opts || {};
  const data = POKEDEX[speciesId];
  const nature = opts.nature || NATURE_KEYS[randInt(0, NATURE_KEYS.length - 1)];
  const ivs = {};
  for (let i = 0; i < STAT_KEYS.length; i++) {
    ivs[STAT_KEYS[i]] = opts.iv ? opts.iv[STAT_KEYS[i]] : randInt(0, 31);
  }
  const statMult = opts.statMult || 1;
  const stats = {};
  stats.hp = Math.floor(((2 * data.base.hp + ivs.hp) * level) / 100) + level + 10;
  ['atk', 'def', 'spa', 'spd', 'spe'].forEach(function (k) {
    stats[k] = Math.floor((Math.floor(((2 * data.base[k] + ivs[k]) * level) / 100) + 5) * NATURES[nature][k]);
  });
  if (statMult !== 1) {
    STAT_KEYS.forEach(function (k) { stats[k] = Math.floor(stats[k] * statMult); });
  }
  const moves = opts.moves || movesAtLevel(data, level);
  const mon = {
    species: speciesId,
    speciesData: data,
    name: data.name,
    level: level,
    exp: expForLevel(data.growth, level),
    hp: stats.hp,
    status: null,
    statusTurns: 0,
    nature: nature,
    held: null,
    ivs: ivs,
    moves: moves.slice(0, 4),
    pp: moves.slice(0, 4).map(function (id) { return MOVES[id] ? MOVES[id].pp : 1; }),
    stats: stats,
    candyBonus: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, total: 0 },
    bond: 0,
    exploreSteps: 0
  };
  return mon;
}

// 羁绊值增减：严格限制在 0~100
function addBond(mon, delta) {
  mon.bond = Math.max(0, Math.min(100, (mon.bond || 0) + delta));
}

function recalcStats(mon) {
  const data = mon.speciesData;
  const ivs = mon.ivs;
  const oldMax = mon.stats.hp;
  const stats = {};
  const candy = mon.candyBonus || { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  stats.hp = Math.floor(((2 * data.base.hp + ivs.hp) * mon.level) / 100) + mon.level + 10 + candy.hp;
  ['atk', 'def', 'spa', 'spd', 'spe'].forEach(function (k) {
    stats[k] = Math.floor((Math.floor(((2 * data.base[k] + ivs[k]) * mon.level) / 100) + 5) * NATURES[mon.nature || '勤奋'][k]) + candy[k];
  });
  const hpGain = stats.hp - oldMax;
  mon.stats = stats;
  mon.hp = Math.min(stats.hp, mon.hp + Math.max(0, hpGain));
}

// ---------------- 等级 / 学习 / 进化 ----------------

function grantExp(mon, amount, log, kinds) {
  let mult = 1;
  if (mon.tradeBonus) mult *= 1.5;
  if (mon.held === '幸运蛋') mult *= 1.5;
  if ((mon.bond || 0) >= 30) mult *= 1.1; // 羁绊阶段二：心意相通经验加成
  let remain = Math.floor(amount * mult);
  const L = function (text) {
    log.push(text);
    if (kinds) kinds.push('good');
  };
  while (mon.level < 100 && mon.exp + remain >= expForLevel(mon.speciesData.growth, mon.level + 1)) {
    const need = expForLevel(mon.speciesData.growth, mon.level + 1) - mon.exp;
    remain -= need;
    mon.exp = expForLevel(mon.speciesData.growth, mon.level + 1);
    mon.level++;
    recalcStats(mon);
    L(mon.name + ' 升到了 Lv.' + mon.level + '！');
    const newMoves = movesAtLevel(mon.speciesData, mon.level);
    for (let i = 0; i < newMoves.length; i++) {
      if (mon.moves.indexOf(newMoves[i]) === -1) tryLearnMove(mon, newMoves[i], log, false, kinds);
    }
    checkEvolution(mon, log, kinds);
  }
  if (remain > 0) mon.exp += remain;
}

function tryLearnMove(mon, moveId, log, autoReplace, kinds) {
  const mv = MOVES[moveId];
  if (mon.moves.indexOf(moveId) !== -1) return;
  if (mon.moves.length < 4) {
    mon.moves.push(moveId);
    if (mon.pp) mon.pp.push(mv.pp);
    log.push(mon.name + ' 学会了新招式【' + mv.name + '】！');
    if (kinds) kinds.push('good');
  } else if (autoReplace) {
    const old = mon.moves[0];
    mon.moves[0] = moveId;
    if (mon.pp) mon.pp[0] = mv.pp;
    log.push(mon.name + ' 忘记了【' + MOVES[old].name + '】，学会了【' + mv.name + '】！');
    if (kinds) kinds.push('good');
  } else {
    const where = STATE.party.indexOf(mon) !== -1 ? 'party' : 'box';
    const idx = (where === 'party' ? STATE.party : STATE.box).indexOf(mon);
    STATE.pendingLearn.push({ where: where, idx: idx, moveId: moveId, monName: mon.name, moveName: mv.name });
    log.push(mon.name + ' 想学会【' + mv.name + '】，但招式已经满了！');
  }
}

function resolvePendingLearn(moveId, replaceIdx) {
  if (STATE.pendingLearn.length === 0) return { ok: false, reason: '没有待学习的招式' };
  const p = STATE.pendingLearn.shift();
  const holder = p.where === 'party' ? STATE.party : STATE.box;
  const mon = holder[p.idx];
  if (!mon) return { ok: false, reason: '宝可梦不存在' };
  if (replaceIdx === null || replaceIdx === undefined) {
    addLog(mon.name + ' 没有学习【' + p.moveName + '】。');
    return { ok: true };
  }
  const old = mon.moves[replaceIdx];
  mon.moves[replaceIdx] = moveId;
  if (mon.pp) mon.pp[replaceIdx] = MOVES[moveId].pp;
  addLog(mon.name + ' 忘记了【' + MOVES[old].name + '】，学会了【' + MOVES[moveId].name + '】！');
  return { ok: true };
}

const STONE_EVOLUTIONS = {
  '水之石': { 133: 134, 120: 121 },
  '雷之石': { 25: 26, 133: 135 },
  '火之石': { 133: 136 },
  '月亮石': { 35: 36 },
  '叶之石': { 44: 45 }
};

// 进化石可作用的宝可梦清单（图鉴 evo.stone + STONE_EVOLUTIONS 合并，去重按编号排序）
function stoneTargets(stoneName) {
  const out = [];
  const seen = {};
  Object.keys(POKEDEX).forEach(function (id) {
    const d = POKEDEX[id];
    if (d.evo && d.evo.stone === stoneName) {
      out.push({ fromId: +id, toId: d.evo.into });
      seen[id] = true;
    }
  });
  const map = STONE_EVOLUTIONS[stoneName];
  if (map) {
    Object.keys(map).forEach(function (id) {
      if (!seen[id]) out.push({ fromId: +id, toId: map[id] });
    });
  }
  return out.sort(function (a, b) { return a.fromId - b.fromId; });
}

// 可学招式清单：该宝可梦当前等级及以下的学习面招式（去重、过滤非法招式、排除已学会）
function learnableMoves(mon) {
  const ls = mon.speciesData && mon.speciesData.learnset;
  if (!ls) return [];
  const all = [];
  const seen = {};
  Object.keys(ls).map(Number).sort(function (a, b) { return a - b; }).forEach(function (lv) {
    if (lv > mon.level) return;
    (ls[lv] || []).forEach(function (id) {
      if (MOVES[id] && !seen[id]) { seen[id] = true; all.push(id); }
    });
  });
  const known = mon.moves || [];
  return all.filter(function (id) { return known.indexOf(id) === -1; });
}

// 招式更换费用：500 + 等级×30（等级越高越贵，保留技能位选择成本）
function moveReplaceCost(mon) {
  return 500 + (mon ? mon.level : 0) * 30;
}

// 更换招式：replaceMove(partyIdx, slotIdx, moveId) → { ok, msg }
function replaceMove(partyIdx, slotIdx, moveId) {
  const mon = STATE.party[partyIdx];
  if (!mon) return { ok: false, msg: '宝可梦不存在。' };
  if (slotIdx < 0 || slotIdx >= mon.moves.length) return { ok: false, msg: '招式栏位无效。' };
  if (!MOVES[moveId]) return { ok: false, msg: '招式不存在。' };
  if (learnableMoves(mon).indexOf(moveId) === -1) return { ok: false, msg: '这只宝可梦当前学不会这个招式。' };
  const cost = moveReplaceCost(mon);
  if (STATE.money < cost) return { ok: false, msg: '金币不足（需要 ' + cost + ' 金）。' };
  const oldId = mon.moves[slotIdx];
  STATE.money -= cost;
  mon.moves[slotIdx] = moveId;
  if (!mon.pp) mon.pp = [];
  mon.pp[slotIdx] = MOVES[moveId].pp;
  addLog(mon.name + ' 把【' + (MOVES[oldId] ? MOVES[oldId].name : '?') + '】替换成了【' + MOVES[moveId].name + '】（花费 ' + cost + ' 金）！', 'good');
  return { ok: true, msg: '' };
}

function checkEvolution(mon, log, kinds) {
  let guard = 0;
  while (guard++ < 10) {
    const data = POKEDEX[mon.species];
    if (data.evo && data.evo.level && mon.level >= data.evo.level) {
      evolveTo(mon, data.evo.into, log, kinds);
    } else {
      break;
    }
  }
}

function evolveTo(mon, intoId, log, kinds) {
  const oldName = mon.name;
  const newData = POKEDEX[intoId];
  const ratio = mon.hp / mon.stats.hp;
  mon.species = intoId;
  mon.speciesData = newData;
  mon.name = newData.name;
  recalcStats(mon);
  mon.hp = Math.max(1, Math.floor(mon.stats.hp * ratio));
  if (log) log.push('哇！' + oldName + ' 进化成了 ' + newData.name + '！');
  if (kinds && log) kinds.push('good');
  // 图鉴登记：进化形态点亮（已见 + 已捕获），等级进化与石头进化共用此入口
  const isNew = !STATE.caughtDex[intoId];
  STATE.seenDex[intoId] = true;
  STATE.caughtDex[intoId] = true;
  if (log && isNew) log.push('图鉴登记了新种类：' + newData.name + '（No.' + intoId + '）！');
  if (kinds && log && isNew) kinds.push('good');
}

function tryStoneEvolution(mon, stoneName) {
  const data = POKEDEX[mon.species];
  const log = [];
  if (data.evo && data.evo.stone === stoneName) {
    evolveTo(mon, data.evo.into, log);
    return log;
  }
  const map = STONE_EVOLUTIONS[stoneName];
  if (map && map[mon.species]) {
    evolveTo(mon, map[mon.species], log);
    return log;
  }
  return null;
}

// ---------------- 状态 / 天气 ----------------

function rollWeather(nodeId, biasType) {
  const node = MAP_NODES[nodeId];
  const weights = node.weatherWeights || { '晴': 100 };
  const keys = Object.keys(weights);
  const pool = keys.map(function (k) { return { w: weights[k], weather: k }; });
  if (biasType) {
    const baseTotal = pool.reduce(function (s, p) { return s + p.w; }, 0);
    let target = null;
    for (let i = 0; i < pool.length; i++) {
      if (pool[i].weather === biasType) { target = pool[i]; break; }
    }
    if (target) target.w = Math.max(target.w, baseTotal * 2);
    else pool.push({ w: baseTotal * 2, weather: biasType });
  }
  return pickWeighted(pool).weather;
}

function refreshWeather(force) {
  if (STATE.battle) return;
  const biasType = STATE.weatherBias ? STATE.weatherBias.type : null;
  if (STATE.weatherBoost > 0) STATE.weatherBoost--;
  const chance = STATE.weatherBoost > 0 ? 0.5 : 0.25;
  if (force || Math.random() < chance) {
    const next = rollWeather(STATE.nodeId, biasType);
    if (next !== STATE.weather) {
      STATE.weather = next;
      addLog('天气变成了 ' + WEATHER[next].icon + ' ' + WEATHER[next].name + '！', 'info');
    }
  }
  if (STATE.weatherBias) {
    STATE.weatherBias.steps--;
    if (STATE.weatherBias.steps <= 0) STATE.weatherBias = null;
  }
}

function getBattleWeather() {
  const b = STATE.battle;
  if (b && b.weather && b.weather.turns > 0) return b.weather.type;
  return null;
}

// ---------------- 属性 / 伤害 ----------------

const STAGE_MULT = {
  '-6': 0.25, '-5': 0.29, '-4': 0.33, '-3': 0.4, '-2': 0.5, '-1': 0.67,
  '0': 1, '1': 1.5, '2': 2, '3': 2.5, '4': 3, '5': 3.5, '6': 4
};

function effStat(bm, key) {
  const stage = bm.stages[key] || 0;
  return Math.floor(bm.m.stats[key] * STAGE_MULT[String(stage)]);
}

function calcDamage(attacker, defender, move, weather) {
  const L = attacker.m.level;
  const P = move.power;
  let A = move.category === '物理' ? effStat(attacker, 'atk') : effStat(attacker, 'spa');
  const D = move.category === '物理' ? effStat(defender, 'def') : effStat(defender, 'spd');
  if (attacker.m.held === '电气球' && attacker.m.species === 25) {
    A *= 2; // 电气球：双攻翻倍
  }
  const base = Math.floor((Math.floor((2 * L / 5 + 2) * P * A / D) / 50)) + 2;
  let mod = 1;
  let eff = 1;
  if (!move.struggle && attacker.m.speciesData.types.indexOf(move.type) !== -1) mod *= 1.5; // STAB
  eff = move.struggle ? 1 : typeEffectiveness(move.type, defender.m.speciesData.types);
  if (eff === 0) return { dmg: 0, eff: 0, crit: false };
  mod *= eff;
  if (weather === '雨') {
    if (move.type === '水') mod *= 1.5;
    if (move.type === '火') mod *= 0.5;
  }
  if (weather === '晴') {
    if (move.type === '火') mod *= 1.5;
    if (move.type === '水') mod *= 0.5;
  }
  if (attacker.m.status === '灼伤' && move.category === '物理') mod *= 0.5;
  let crit = false;
  // 羁绊阶段三：暴击率 1/16 → 1/8
  const critChance = (attacker.m.bond || 0) >= 60 ? 1 / 8 : 1 / 16;
  if (Math.random() < critChance) { crit = true; mod *= 1.5; }
  mod *= 0.85 + Math.random() * 0.15;
  const dmg = Math.max(1, Math.floor(base * mod));
  return { dmg: dmg, eff: eff, crit: crit };
}

function statusMoveImmune(moveType, status, target) {
  if (!status) return false;
  const t = target.m.speciesData.types;
  if (moveType === '电' && status === '麻痹' && (t.indexOf('地面') !== -1 || t.indexOf('电') !== -1)) return true;
  if (moveType === '草' && (status === '麻痹' || status === '睡眠' || status === '中毒') &&
      (t.indexOf('草') !== -1 || t.indexOf('毒') !== -1 || t.indexOf('钢') !== -1)) return true;
  if (moveType === '毒' && status && (t.indexOf('毒') !== -1 || t.indexOf('钢') !== -1)) return true;
  return false;
}

function applyStatus(bm, status, log, moveType, kinds) {
  if (bm.m.status) return;
  if (statusMoveImmune(moveType || '变化', status, bm)) return;
  bm.m.status = status;
  bm.m.statusTurns = 0;
  bm.poisonTurns = 0;
  if (status === '睡眠') bm.sleepTurns = randInt(1, 3);
  log.push(bm.m.name + ' 陷入了【' + status + '】状态！');
  if (kinds) kinds.push(bm.side || '');
}

// ---------------- 战斗 ----------------

function makeBattleMon(mon) {
  return {
    m: mon,
    stages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 },
    protect: false,
    recharge: false,
    confuseTurns: 0,
    trapTurns: 0,
    leech: false,
    poisonTurns: 0,
    sleepTurns: 0,
    enduredThisBattle: false
  };
}

function firstAlive(partyMons) {
  for (let i = 0; i < partyMons.length; i++) if (partyMons[i].hp > 0) return i;
  return -1;
}

// 稀有度分级（纯数据）：传说（急冻鸟/闪电鸟/火焰鸟/超梦/梦幻）> 稀有（捕获率≤45 的特有/珍藏种）
// > 少见（捕获率 46~120）> 普通。图鉴/队伍/电脑箱/战斗卡片/野生开场共用，词缀 + 颜色展示。
function rarityOf(mon) {
  const raw = mon && mon.species !== undefined ? mon.species : (mon && mon.id !== undefined ? mon.id : mon);
  const id = Number(raw);
  if ([144, 145, 146, 150, 151].indexOf(id) !== -1) return { key: 'legendary', label: '传说' };
  const d = POKEDEX[id];
  const cr = d ? d.catchRate : 255;
  if (cr <= 45) return { key: 'rare', label: '稀有' };
  if (cr <= 120) return { key: 'uncommon', label: '少见' };
  return { key: 'common', label: '普通' };
}

function startBattle(kind, opts) {
  opts = opts || {};
  const playerMons = STATE.party.map(makeBattleMon);
  let playerActive = firstAlive(STATE.party);
  if (playerActive === -1) {
    // 兜底：队伍全灭时不允许带着 0 血队伍开战，先恢复（正常情况下不会走到这里）
    healAll();
    playerActive = firstAlive(STATE.party);
  }
  const foeMons = opts.foe.map(function (fd) {
    const statMult = fd.statMult || 1;
    return makeBattleMon(makeMon(fd.id, fd.level, { statMult: statMult, moves: fd.moves }));
  });
  playerMons.forEach(function (bm) { bm.side = 'player'; });
  foeMons.forEach(function (bm) { bm.side = 'foe'; });
  // 对战中见到的敌方宝可梦登记图鉴（已见）
  foeMons.forEach(function (bm) { STATE.seenDex[bm.m.species] = true; });
  STATE.battle = {
    kind: kind,
    title: opts.title || '',
    trainerName: opts.trainerName || '',
    trainerText: opts.trainerText || '',
    canRun: !!opts.canRun,
    prize: opts.prize || 0,
    rewardItem: opts.rewardItem || null,
    rewardMon: opts.rewardMon || null,
    badge: opts.badge || null,
    tm: opts.tm || null,
    rivalStep: opts.rivalStep || null,
    trainerId: opts.trainerId || null,
    player: { active: playerActive, mons: playerMons },
    foe: { active: 0, mons: foeMons },
    waitingPlayer: true,
    hpSteps: [],   // 每行战斗日志对应的 HP 快照（用于播放时血条分步结算）
    weather: null,
    over: false,
    outcome: null,
    turn: 0,
    logStart: STATE.log.length
  };
  STATE.screen = 'battle';
  const pActive = STATE.battle.player.mons[STATE.battle.player.active];
  let opening = opts.opening;
  if (!opening) {
    const r = rarityOf(foeMons[0].m);
    opening = '野生的 ' + foeMons[0].m.name + (r.key === 'common' ? '' : '（' + r.label + '）') + ' 出现了！';
  }
  addLog(opening, 'info');
  addLog('就决定是你了，' + pActive.m.name + '！', 'info');
}

// 当前在场双方 HP 快照（供播放层逐条对齐）
function battleHpSnapshot() {
  const b = STATE.battle;
  if (!b) return null;
  const p = b.player.mons[b.player.active];
  const f = b.foe.mons[b.foe.active];
  return {
    player: p ? p.m.hp : 0, playerMax: p ? p.m.stats.hp : 1,
    foe: f ? f.m.hp : 0, foeMax: f ? f.m.stats.hp : 1
  };
}

function startWildBattle(speciesId, level) {
  STATE.seenDex[speciesId] = true;
  STATE.wildBattles++;
  startBattle('wild', { foe: [{ id: speciesId, level: level }], canRun: true });
}

function startTrainerBattle(trainer, prizeMult) {
  const foe = trainer.party.map(function (p) {
    return { id: p.id, level: p.level, moves: p.moves };
  });
  startBattle('trainer', {
    foe: foe,
    canRun: false,
    prize: Math.floor((trainer.prize || 100) * (prizeMult || 1)),
    trainerId: trainer.id,
    trainerName: trainer.name,
    title: trainer.title,
    trainerText: trainer.text,
    opening: trainer.title + ' ' + trainer.name + ' 向你发起了挑战！'
  });
}

function startRocketBattle(kind) {
  const ev = ROCKET_EVENTS[kind];
  const node = MAP_NODES[STATE.nodeId];
  const top = node.levels ? node.levels[1] : 10;
  const opening = ev.lines && ev.lines.length > 0 ? ev.lines[randInt(0, ev.lines.length - 1)] : ev.text;
  const foe = ev.party.map(function (p, i) {
    return { id: p.id, level: top + 1 + i, moves: p.moves };
  });
  startBattle('rocket_' + kind, {
    foe: foe,
    canRun: false,
    rewardItem: ev.reward ? ev.reward.item : null,
    rewardMon: ev.rewardMon || null,
    trainerName: '火箭队',
    title: kind === 'rescue' ? '火箭队干部' : '火箭队队员',
    trainerText: opening,
    opening: opening
  });
}

// ---------- 宿敌小茂 ----------

function getRivalStarter(playerStarter) {
  const map = { 4: 7, 7: 1, 1: 4 };
  return map[playerStarter] || 4;
}

function rivalTriggerFor(nodeId) {
  if (nodeId === 'route3' && STATE.badges.indexOf('灰色徽章') !== -1 && STATE.rivalWon.indexOf('r3') === -1) {
    return {
      step: 'r3',
      team: [ { id: getRivalStarter(STATE.party[0].species), level: 13 }, { id: 16, level: 13 } ]
    };
  }
  if (nodeId === 'route24' && STATE.badges.indexOf('蓝色徽章') !== -1 && STATE.rivalWon.indexOf('r24') === -1) {
    return {
      step: 'r24',
      team: [ { id: getRivalStarter(STATE.party[0].species), level: 18 }, { id: 17, level: 18 } ]
    };
  }
  return null;
}

function startRivalBattle(trigger) {
  startBattle('rival', {
    foe: trigger.team.map(function (p) { return { id: p.id, level: p.level, moves: p.moves }; }),
    canRun: false,
    prize: trigger.step === 'r3' ? 500 : 900,
    rivalStep: trigger.step,
    trainerName: '小茂',
    title: '宿敌',
    trainerText: '我会用实力证明我比你强！',
    opening: '小茂突然出现：「喂，听说你也出来旅行了？来和我比一场吧！」'
  });
}

function startGymBattle(gym) {
  const foe = gym.team.map(function (p, i) {
    return {
      id: p.id, level: p.level, moves: p.moves,
      statMult: i === gym.aceIndex ? 1.15 : 1
    };
  });
  startBattle('gym', {
    foe: foe,
    canRun: false,
    badge: gym.badge,
    tm: gym.tm,
    trainerName: gym.leader,
    title: gym.title || '馆主',
    trainerText: gym.text,
    opening: gym.leader + '：' + gym.text
  });
}

// ---------- 道馆踢馆（学徒连战 + 馆主） ----------

function challengeGym() {
  const node = MAP_NODES[STATE.nodeId];
  const gym = node.gym;
  if (!gym) { addLog('这里没有道馆。'); return; }
  if (STATE.badges.indexOf(gym.badge) !== -1) { addLog('你已经挑战过这个道馆了。'); return; }
  if (gym.requireBadges && STATE.badges.length < gym.requireBadges) {
    addLog('道馆大门紧锁，需要集齐 ' + gym.requireBadges + ' 枚徽章才能挑战。');
    return;
  }
  const maxLv = STATE.party.reduce(function (m, mon) { return Math.max(m, mon.level); }, 0);
  if (maxLv < gym.minLevel) {
    addLog('道馆学徒拦住你：「馆主只接受首发 Lv.' + gym.minLevel + ' 以上的挑战者！」');
    return;
  }
  STATE.gymSession = {
    gymId: node.id,
    steps: gym.apprentices.concat([{ leader: true }]),
    step: 0
  };
  addLog('你走进了 ' + node.name + ' 道馆！连战开始，途中无法恢复！');
  startGymStep();
}

function startGymStep() {
  const s = STATE.gymSession;
  if (!s) return;
  const gym = MAP_NODES[s.gymId].gym;
  const step = s.steps[s.step];
  if (!step) { STATE.gymSession = null; return; }
  if (step.leader) {
    s.step = s.steps.length;
    startGymBattle(gym);
  } else {
    startBattle('gym_apprentice', {
      foe: step.party.map(function (p) { return { id: p.id, level: p.level, moves: p.moves }; }),
      canRun: false,
      prize: step.prize || 0,
      trainerId: step.id,
      trainerName: step.name,
      title: step.title,
      trainerText: step.text,
      opening: step.title + ' ' + step.name + ' 挡在你面前：「' + step.text + '」'
    });
  }
}

// ---------------- 无尽之塔 ----------------

// 每 10 层一个属性主题（普通/水冰/火/草虫/电/岩地钢/飞龙/超能幽灵恶/毒斗/混合传说）
const TOWER_THEMES = [
  ['普通'],
  ['水', '冰'],
  ['火'],
  ['草', '虫'],
  ['电'],
  ['岩石', '地面', '钢'],
  ['飞行', '龙'],
  ['超能力', '幽灵', '恶'],
  ['毒', '格斗'],
  null // 混合：高种族/传说
];

// 按层生成塔内对手队伍：等级随层数上升，数量逐段增加
function towerFoeTeam(floor) {
  const lv = Math.min(100, Math.floor(48 + floor * 0.52));
  const count = floor <= 10 ? 2 : floor <= 40 ? 3 : floor <= 70 ? 4 : 5;
  const theme = TOWER_THEMES[Math.floor((floor - 1) / 10) % TOWER_THEMES.length];
  const pool = [];
  Object.keys(POKEDEX).forEach(function (id) {
    const n = +id;
    if (n > 151) return;
    const d = POKEDEX[id];
    if (theme === null) {
      const sum = d.base.hp + d.base.atk + d.base.def + d.base.spa + d.base.spd + d.base.spe;
      if (sum >= 500) pool.push(n);
    } else if (d.types.some(function (t) { return theme.indexOf(t) !== -1; })) {
      pool.push(n);
    }
  });
  if (pool.length === 0) pool.push(143);
  const used = {};
  const team = [];
  for (let i = 0; i < count; i++) {
    let id = pool[randInt(0, pool.length - 1)];
    let guard = 0;
    while (used[id] && guard++ < 20) id = pool[randInt(0, pool.length - 1)];
    used[id] = true;
    team.push({ id: id, level: Math.min(100, lv + i) });
  }
  return team;
}

const ALL_TYPES = ['普通', '火', '水', '电', '草', '冰', '格斗', '毒', '地面', '飞行', '超能力', '虫', '岩石', '幽灵', '龙', '恶', '钢'];

// 塔层主题与克制建议：返回 { types, counters }
function towerThemeFor(floor) {
  const theme = TOWER_THEMES[Math.floor((floor - 1) / 10) % TOWER_THEMES.length];
  if (!theme) return { types: ['混合'], counters: [] };
  const counters = ALL_TYPES.filter(function (t) {
    return theme.some(function (dt) { return typeEffectiveness(t, [dt]) > 1; });
  });
  return { types: theme, counters: counters };
}

function startTowerFloor() {
  const t = STATE.tower;
  if (t.cleared) {
    // 通关后重刷：从第 1 层重新开始，保留称号与历史最佳
    t.floor = 1;
    t.checkpoint = 0;
    t.cleared = false;
    addLog('你再次踏入无尽之塔，从第 1 层重新挑战！（称号与历史最佳保留）', 'info');
  }
  const team = towerFoeTeam(t.floor);
  const theme = towerThemeFor(t.floor);
  const hint = theme.counters.length ? '建议使用 ' + theme.counters.join(' / ') + ' 系招式克制！' : '这一层没有固定弱点，靠综合实力吧！';
  startBattle('tower', {
    foe: team,
    canRun: false,
    prize: t.floor * 30,
    trainerName: t.floor === 100 ? '塔主' : '守层者',
    title: '无尽之塔',
    trainerText: '无尽之塔第 ' + t.floor + ' 层！',
    opening: '无尽之塔第 ' + t.floor + ' 层（' + (theme.types.length === 1 ? theme.types[0] : theme.types.join('/')) + ' 主题）！' + hint
  });
}

function pickFoeMove(fm, target) {
  const moves = (fm.m.moves || []).filter(function (id) { return MOVES[id]; });
  const targetTypes = target ? target.m.speciesData.types : [];
  const damaging = moves.filter(function (id) {
    const mv = MOVES[id];
    return mv.power > 0 && typeEffectiveness(mv.type, targetTypes) > 0;
  });
  if (damaging.length === 0) return STRUGGLE;
  return MOVES[damaging[randInt(0, damaging.length - 1)]];
}

function speedOf(bm) {
  let sp = effStat(bm, 'spe');
  if (bm.m.status === '麻痹') sp = Math.floor(sp / 2);
  return sp;
}

function canAct(bm, log, kinds) {
  const m = bm.m;
  const side = bm.side || '';
  if (m.hp <= 0) return false;
  if (m.status === '睡眠') {
    bm.sleepTurns--;
    if (bm.sleepTurns <= 0) {
      m.status = null;
      log.push(m.name + ' 醒了过来！');
      if (kinds) kinds.push(side);
    } else {
      log.push(m.name + ' 正在呼呼大睡……');
      if (kinds) kinds.push(side);
      return false;
    }
  }
  if (m.status === '冰冻') {
    if (Math.random() < 0.2) {
      m.status = null;
      log.push(m.name + ' 解冻了！');
      if (kinds) kinds.push(side);
    } else {
      log.push(m.name + ' 被冻住了，无法动弹！');
      if (kinds) kinds.push(side);
      return false;
    }
  }
  if (m.status === '麻痹' && Math.random() < 0.25) {
    log.push(m.name + ' 因为麻痹无法行动！');
    if (kinds) kinds.push(side);
    return false;
  }
  if (bm.confuseTurns > 0) {
    bm.confuseTurns--;
    if (Math.random() < 0.5) {
      const dmg = Math.max(1, Math.floor(effStat(bm, 'atk') * 40 / Math.max(1, effStat(bm, 'def')) / 5));
      m.hp -= dmg;
      log.push(m.name + ' 混乱了，攻击了自己！受到了 ' + dmg + ' 点伤害！');
      if (kinds) kinds.push(side);
      if (m.hp <= 0) { log.push(m.name + ' 倒下了！'); if (kinds) kinds.push(side); }
      return false;
    }
    log.push(m.name + ' 混乱了，但仍然使出了招式！');
    if (kinds) kinds.push(side);
  }
  return true;
}

function weatherFlavor(move, log) {
  const w = getBattleWeather();
  if (!w) return false;
  if (w === '雨' && move.type === '火') log.push('大雨瓢泼，' + move.name + '的热量被雨水冲淡，显得十分微弱……');
  else if (w === '晴' && move.type === '水') log.push('烈日当空，' + move.name + '激起的水花瞬间蒸发殆尽……');
  else if (w === '雷阵雨' && move.type === '电') log.push('电闪雷鸣，' + move.name + '的光芒照亮了整片战场！');
  else if (w === '沙暴') log.push('沙暴呼啸，飞沙走石让人几乎睁不开眼……');
  else return false;
  return true;
}

function useMove(user, target, move, log, kinds) {
  const m = user.m;
  const t = target.m;
  const side = user.side || '';
  const foeKind = (target.side === 'player') ? 'bad' : 'good';
  const L = function (text, kind) {
    log.push(text);
    if (kinds) kinds.push(kind || '');
  };
  if (!canAct(user, log, kinds)) return;
  if (user.recharge) {
    user.recharge = false;
    L(m.name + ' 因为反作用力无法行动！', side);
    return;
  }
  // 命中判定
  let hit = true;
  if (move.acc > 0) {
    if (move.id === 'thunder' && getBattleWeather() === '雨') hit = true;
    else if (Math.random() * 100 >= move.acc) hit = false;
  }
  if (!hit) {
    L(m.name + ' 使用了【' + move.name + '】，但是没有命中！', side);
    afterMove(user);
    return;
  }
  L(m.name + ' 使用了【' + move.name + '】！', side);

  if (move.category === '变化') {
    if (move.effect && move.effect.kind === 'protect') {
      user.protect = true;
      L(m.name + ' 摆出了守住的架势！', side);
    } else if (move.effect && move.effect.kind === 'weather') {
      STATE.battle.weather = { type: move.effect.weather, turns: 5 };
      L('天气变成了 ' + WEATHER[move.effect.weather].icon + ' ' + WEATHER[move.effect.weather].name + '！', 'info');
    } else if (move.effect && move.effect.kind === 'leech') {
      if (t.speciesData.types.indexOf('草') !== -1) {
        L('对 ' + t.name + ' 没有效果！', 'info');
      } else {
        target.leech = true;
        L(t.name + ' 被种下了寄生种子！', target.side || '');
      }
    } else if (move.effect && move.effect.kind === 'heal') {
      const healed = Math.min(m.stats.hp - m.hp, Math.floor(m.stats.hp * move.effect.ratio));
      if (healed > 0) {
        m.hp += healed;
        L(m.name + ' 回复了 ' + healed + ' 点HP！', 'good');
      } else {
        L(m.name + ' 的HP是满的。', 'info');
      }
    } else if (move.effect && move.effect.kind === 'rest') {
      // 睡觉：HP 完全恢复 + 治愈异常，随后睡眠 1~3 回合（满血时无法使用）
      if (m.hp >= m.stats.hp) {
        L(m.name + ' 的HP是满的，无法使用睡觉！', 'info');
      } else {
        m.hp = m.stats.hp;
        m.status = '睡眠';
        m.statusTurns = 0;
        m.poisonTurns = 0;
        user.sleepTurns = randInt(1, 3);
        L(m.name + ' 美美地睡了一觉，HP完全恢复了！', 'good');
        L(m.name + ' 睡着了……', 'info');
      }
    } else if (move.effect) {
      if (move.effect.kind === 'stat') {
        applyStatEffect(move.effect.target === 'self' ? user : target, move.effect, log, kinds);
      } else if (move.effect.kind === 'status') {
        applyStatus(target, move.effect.status, log, move.type, kinds);
      } else if (move.effect.kind === 'confuse') {
        if (!target.confuseTurns) {
          target.confuseTurns = randInt(2, 5);
          L(target.m.name + ' 混乱了！', target.side || '');
        }
      } else {
        L('但是什么都没有发生……', 'info');
      }
    } else {
      L('但是什么都没有发生……', 'info');
    }
    afterMove(user);
    return;
  }

  // 伤害类招式
  if (weatherFlavor(move, log) && kinds) kinds.push('info');
  if (target.protect) {
    target.protect = false;
    L(t.name + ' 用守住挡下了攻击！', target.side || '');
    afterMove(user);
    return;
  }
  if (move.effect && move.effect.kind === 'dream' && t.status !== '睡眠') {
    L('但是失败了……', 'info');
    afterMove(user);
    return;
  }

  let totalDmg = 0;
  let effMsg = '';
  let critMsg = '';
  let hits = 1;
  let bondCritLogged = false;
  if (move.effect && move.effect.kind === 'multi') {
    hits = move.effect.hits === 2 ? 2 : randInt(2, 5);
    L('命中 ' + hits + ' 次！', side);
  }
  for (let h = 0; h < hits; h++) {
    let res;
    if (move.effect && move.effect.kind === 'fixed') {
      res = { dmg: move.effect.dmg, eff: 1, crit: false };
    } else if (move.effect && move.effect.kind === 'fixedLevel') {
      res = { dmg: m.level, eff: 1, crit: false };
    } else {
      res = calcDamage(user, target, move, getBattleWeather());
      if (res.eff === 0) {
        L('对 ' + t.name + ' 没有效果……', 'info');
        afterMove(user);
        return;
      }
    }
    if (res.crit) critMsg = ' 会心一击！';
    totalDmg += res.dmg;
    if (res.crit && (user.m.bond || 0) >= 60 && !bondCritLogged) {
      bondCritLogged = true;
      L(user.m.name + ' 想要回应你的期待，它的攻击变得更加凌厉了！', 'good');
    }
    if (res.eff > 1) effMsg = ' 效果拔群！';
    if (res.eff > 0 && res.eff < 1) effMsg = ' 效果不太理想……';
  }
  t.hp -= totalDmg;
  L(critMsg + ' 造成了 ' + totalDmg + ' 点伤害！' + effMsg, side);
  // 羁绊阶段四：20% 毅力锁血（每场最多一次）
  if (t.hp <= 0 && target.side === 'player' && (t.bond || 0) >= 90 && !target.enduredThisBattle && Math.random() < 0.2) {
    t.hp = 1;
    target.enduredThisBattle = true;
    L(t.name + ' 即将倒下之际，想起了与你的点点滴滴，靠着毅力强行撑了下来！', 'good');
  }
  if (t.hp <= 0) {
    t.hp = 0;
    L(t.name + ' 倒下了！', foeKind);
  }

  // 二次效果
  if (move.effect) {
    if (move.effect.kind === 'status' && move.effect.chance && t.hp > 0 && Math.random() < move.effect.chance) {
      applyStatus(target, move.effect.status, log, move.type);
    }
    if (move.effect.kind === 'stat' && t.hp > 0) {
      applyStatEffect(move.effect.target === 'self' ? user : target, move.effect, log);
    }
    if (move.effect.kind === 'flinch' && move.effect.chance && t.hp > 0 && Math.random() < move.effect.chance) {
      L(t.name + ' 畏缩了，无法行动！', target.side || '');
      target.flinch = true;
    }
    if (move.effect.kind === 'confuse' && move.effect.chance && t.hp > 0 && Math.random() < move.effect.chance) {
      if (!target.confuseTurns) {
        target.confuseTurns = randInt(2, 5);
        L(t.name + ' 混乱了！', target.side || '');
      }
    }
    if (move.effect.kind === 'recoil') {
      const recoil = Math.max(1, Math.floor(totalDmg * move.effect.ratio));
      m.hp -= recoil;
      L(m.name + ' 受到了反作用力 ' + recoil + ' 点伤害！', side);
      if (m.hp <= 0) { m.hp = 0; L(m.name + ' 倒下了！', side); }
    }
    if (move.effect.kind === 'heal') {
      const base = move.effect.self ? m.stats.hp : totalDmg;
      const healed = Math.min(m.stats.hp - m.hp, Math.floor(base * move.effect.ratio));
      if (healed > 0) {
        m.hp += healed;
        L(m.name + ' 回复了 ' + healed + ' 点HP！', 'good');
      }
    }
    if (move.effect.kind === 'trap' && t.hp > 0) {
      target.trapTurns = randInt(2, 5);
      L(t.name + ' 被' + move.name + '困住了！', target.side || '');
    }
    if (move.effect.kind === 'recharge') {
      user.recharge = true;
    }
    if (move.effect.kind === 'selfConfuse') {
      user.confuseTurns = randInt(2, 5);
      L(m.name + ' 因为反作用力混乱了！', side);
    }
  }
  afterMove(user);
}

function applyStatEffect(passed, effect, log, kinds) {
  const apply = function (stat, stage) {
    if (Math.random() >= (effect.chance === undefined ? 1 : effect.chance)) return;
    const cur = passed.stages[stat] || 0;
    if (cur + stage > 6 || cur + stage < -6) return;
    passed.stages[stat] = cur + stage;
    log.push(passed.m.name + ' 的' + STAT_NAME[stat] + (stage > 0 ? '提升了！' : '降低了！'));
    if (kinds) kinds.push(passed.side || '');
  };
  apply(effect.stat, effect.stage);
  if (effect.second) apply(effect.second.stat, effect.second.stage);
}

const STAT_NAME = { atk: '攻击', def: '防御', spa: '特攻', spd: '特防', spe: '速度', acc: '命中', eva: '回避' };

function afterMove(user) {
  if (user.confuseTurns > 0) user.confuseTurns--;
}

function endOfTurn(log, kinds) {
  const b = STATE.battle;
  if (!b) return;
  const weather = b.weather && b.weather.turns > 0 ? b.weather.type : getBattleWeather();
  const sides = [b.player, b.foe];
  const L = function (text, kind) {
    log.push(text);
    if (kinds) kinds.push(kind || '');
  };
  for (let s = 0; s < sides.length; s++) {
    const bm = sides[s].mons[sides[s].active];
    if (!bm || bm.m.hp <= 0) continue;
    const m = bm.m;
    const sideKind = (bm.side === 'player') ? 'bad' : 'good';
    if (m.status === '中毒' || m.status === '灼伤') {
      const chip = Math.max(1, Math.floor(m.stats.hp / 8));
      m.hp -= chip;
      L(m.name + ' 受到了' + (m.status === '中毒' ? '中毒' : '灼伤') + '伤害 ' + chip + ' 点！', sideKind);
    }
    if (m.status === '剧毒') {
      bm.poisonTurns++;
      const chip = Math.max(1, Math.floor(m.stats.hp / 16) * bm.poisonTurns);
      m.hp -= chip;
      L(m.name + ' 的剧毒发作了，受到了 ' + chip + ' 点伤害！', sideKind);
    }
    if (weather === '沙暴' && !isSandImmune(m)) {
      const chip = Math.max(1, Math.floor(m.stats.hp / 16));
      m.hp -= chip;
      L(m.name + ' 被沙暴刮伤，受到了 ' + chip + ' 点伤害！', sideKind);
    }
    if (bm.leech) {
      const chip = Math.max(1, Math.floor(m.stats.hp / 8));
      m.hp -= chip;
      L(m.name + ' 被寄生种子吸取了 ' + chip + ' 点HP！', sideKind);
      const healer = sides[1 - s].mons[sides[1 - s].active];
      if (healer && healer.m.hp > 0) {
        healer.m.hp = Math.min(healer.m.stats.hp, healer.m.hp + chip);
      }
    }
    if (bm.trapTurns > 0) {
      bm.trapTurns--;
      const chip = Math.max(1, Math.floor(m.stats.hp / 16));
      m.hp -= chip;
      L(m.name + ' 被困住，受到了 ' + chip + ' 点伤害！', sideKind);
    }
    if (m.held === '吃剩的东西' && m.hp > 0 && m.hp < m.stats.hp) {
      const heal = Math.max(1, Math.floor(m.stats.hp / 16));
      m.hp = Math.min(m.stats.hp, m.hp + heal);
      L(m.name + ' 携带着吃剩的东西，恢复了 ' + heal + ' 点HP！', 'good');
    }
    // 羁绊阶段四：10% 概率回合末自愈异常
    if (bm.side === 'player' && (m.bond || 0) >= 90 && m.status && Math.random() < 0.1) {
      m.status = null;
      L(m.name + ' 为了不让你担心，强行抖擞精神，身上的异常状态解除了！', 'good');
    }
    if (m.hp <= 0) {
      m.hp = 0;
      L(m.name + ' 倒下了！', sideKind);
    }
  }
  if (b.weather && b.weather.turns > 0) {
    b.weather.turns--;
    if (b.weather.turns === 0) L('天气恢复了正常……', 'info');
  }
}

function isSandImmune(mon) {
  const t = mon.speciesData.types;
  return t.indexOf('岩石') !== -1 || t.indexOf('地面') !== -1 || t.indexOf('钢') !== -1;
}

// 羁绊：我方宝可梦濒死 -5（仅在首次倒下时）
function onPartyFaint(bm) {
  if (bm && bm.side === 'player' && bm.m.hp <= 0 && STATE.party.indexOf(bm.m) !== -1) {
    addBond(bm.m, -5);
  }
}

function handleFaints(log, kinds) {
  const b = STATE.battle;
  const p = b.player;
  const f = b.foe;
  const L = function (text, kind) {
    log.push(text);
    if (kinds) kinds.push(kind || '');
  };
  if (f.mons[f.active].m.hp <= 0) {
    const foeMon = f.mons[f.active].m;
    const pActive = p.mons[p.active].m;
    if (pActive.hp > 0) {
      const gain = Math.floor(foeMon.speciesData.expYield * foeMon.level / 7) * (b.kind === 'wild' ? 1 : 1.5);
      L(pActive.name + ' 获得了 ' + gain + ' 点经验值！', 'good');
      if ((pActive.bond || 0) >= 30) L(pActive.name + ' 因为与你心意相通，获得了更多经验！', 'good');
      grantExp(pActive, gain, log, kinds);
    }
    if (f.mons.every(function (bm) { return bm.m.hp <= 0; })) {
      // 双灭：最后一只宝可梦与敌方同回合倒下时按败北处理，避免留下全灭队伍
      if (p.mons.every(function (bm) { return bm.m.hp <= 0; })) {
        p.mons.forEach(onPartyFaint);
        endBattle('lose');
        return true;
      }
      endBattle('win');
      return true;
    }
    // 敌方换人
    for (let i = 0; i < f.mons.length; i++) {
      if (f.mons[i].m.hp > 0) {
        f.active = i;
        L('对方派出了 ' + f.mons[i].m.name + '！', 'info');
        break;
      }
    }
  }
  if (p.mons[p.active].m.hp <= 0) {
    onPartyFaint(p.mons[p.active]);
    const next = firstAlive(p.mons.map(function (bm) { return bm.m; }));
    if (next === -1) {
      endBattle('lose');
      return true;
    }
    p.active = next;
    L('上吧，' + p.mons[next].m.name + '！', 'info');
  }
  return false;
}

function battleMove(idx) {
  const b = STATE.battle;
  if (!b || b.over) return;
  const p = b.player;
  const f = b.foe;
  const pm = p.mons[p.active];
  const fm = f.mons[f.active];
  const validMoves = (pm.m.moves || []).filter(function (id) { return MOVES[id]; });
  const pMove = idx === -1 ? STRUGGLE : MOVES[validMoves[idx]];
  if (!pMove) { addLog(pm.m.name + ' 的招式数据异常，无法使用！', 'info'); return; }
  if (idx !== -1) {
    if (!pm.m.pp || pm.m.pp[idx] <= 0) {
      addLog(pm.m.name + ' 的【' + pMove.name + '】PP 已经耗尽！', 'info');
      return;
    }
    pm.m.pp[idx]--;
  }
  const fMove = pickFoeMove(fm, pm);
  const log = [];
  const kinds = [];
  let logPos = 0;
  function flushLog() {
    for (let i = logPos; i < log.length; i++) addLog(log[i], kinds[i]);
    logPos = log.length;
  }
  b.turn++;
  const pPriority = pMove.effect && pMove.effect.kind === 'priority';
  const fPriority = fMove.effect && fMove.effect.kind === 'priority';
  const pFirst = pPriority ? true : (fPriority ? false : speedOf(pm) >= speedOf(fm));
  if (pFirst) {
    useMove(pm, fm, pMove, log, kinds);
    flushLog();
    if (pm.m.hp > 0 && fm.m.hp > 0 && !b.over) {
      useMove(fm, pm, fMove, log, kinds);
      flushLog();
    }
  } else {
    useMove(fm, pm, fMove, log, kinds);
    flushLog();
    if (fm.m.hp > 0 && pm.m.hp > 0 && !b.over) {
      useMove(pm, fm, pMove, log, kinds);
      flushLog();
    }
  }
  if (!b.over) {
    endOfTurn(log, kinds);
    flushLog();
    handleFaints(log, kinds);
    flushLog();
  }
  if (!b.over && b.kind === 'wild' && b.turn >= 35 && Math.random() < 0.2) {
    addLog('野生的 ' + b.foe.mons[b.foe.active].m.name + ' 被你的气势吓到，逃走了！', 'info');
    endBattle('run');
  }
  if (!b.over) b.waitingPlayer = true;
}

function battleUseItem(itemName, opts) {
  const b = STATE.battle;
  if (!b || b.over) return;
  opts = opts || {};
  const item = ITEMS[itemName];
  if (!item || bagCount(itemName) <= 0) { addLog('没有这个道具……', 'info'); return; }
  const p = b.player;
  const f = b.foe;
  const pm = p.mons[p.active];
  const fm = f.mons[f.active];
  if (item.type === 'ball') {
    if (b.kind !== 'wild') { addLog('愚蠢的人类，训练家的宝可梦可不是你能随便抓的！', 'warn'); return; }
    removeItem(itemName, 1);
    if (!opts.skipThrowLog) addLog('你扔出了【' + itemName + '】！', 'info');
    if (item.master) {
      addLog('太棒了！' + fm.m.name + ' 被收服了！', 'good');
      logCatchFeedback(fm.m);
      addToPartyOrBox(fm.m);
      STATE.caughtDex[fm.m.species] = true;
      STATE.battle.over = true;
      STATE.battle.outcome = 'caught';
      STATE.lastResult = 'caught';
      STATE.lastBattleView = { player: p, foe: f, kind: b.kind, logStart: b.logStart };
      STATE.battle = null;
      STATE.screen = 'map';
      return;
    }
    const a = Math.min(255, Math.floor(((3 * fm.m.stats.hp - 2 * fm.m.hp) * fm.m.speciesData.catchRate * item.ballMult) / (3 * fm.m.stats.hp)));
    let statusMult = 1;
    if (fm.m.status === '睡眠' || fm.m.status === '冰冻') statusMult = 2;
    else if (['麻痹', '中毒', '灼伤', '剧毒'].indexOf(fm.m.status) !== -1) statusMult = 1.5;
    const finalA = Math.floor(a * statusMult);
    const chance = finalA >= 255 ? 1 : Math.pow(finalA / 255, 0.75);
    if (Math.random() < chance) {
      addLog('太棒了！' + fm.m.name + ' 被收服了！', 'good');
      logCatchFeedback(fm.m);
      addToPartyOrBox(fm.m);
      STATE.caughtDex[fm.m.species] = true;
      STATE.battle.over = true;
      STATE.battle.outcome = 'caught';
      STATE.lastResult = 'caught';
      STATE.lastBattleView = { player: p, foe: f, kind: b.kind, logStart: b.logStart };
      STATE.battle = null;
      STATE.screen = 'map';
      return;
    }
    addLog('哦不！' + fm.m.name + ' 挣脱了精灵球！', 'bad');
    const fMove = pickFoeMove(fm, pm);
    const log = [];
    const kinds = [];
    let logPos = 0;
    function flushLog() {
      for (let i = logPos; i < log.length; i++) addLog(log[i], kinds[i]);
      logPos = log.length;
    }
    if (fm.m.hp > 0 && pm.m.hp > 0) useMove(fm, pm, fMove, log, kinds);
    flushLog();
    if (!b.over) { endOfTurn(log, kinds); flushLog(); handleFaints(log, kinds); flushLog(); }
    if (!b.over) b.waitingPlayer = true;
    return;
  }
  if (item.type === 'heal' || item.type === 'cure') {
    if (item.heal === 'full') {
      removeItem(itemName, 1);
      pm.m.hp = pm.m.stats.hp;
      pm.m.status = null;
      addLog(pm.m.name + ' 完全恢复了！', 'good');
    } else if (item.heal) {
      const healed = Math.min(pm.m.stats.hp - pm.m.hp, item.heal);
      if (healed <= 0) {
        addLog(pm.m.name + ' 的HP是满的！', 'info');
        return;
      }
      removeItem(itemName, 1);
      pm.m.hp += healed;
      addLog(pm.m.name + ' 回复了 ' + healed + ' 点HP！', 'good');
    } else if (item.cure === 'all') {
      if (!pm.m.status) {
        addLog(pm.m.name + ' 没有异常状态。', 'info');
        return;
      }
      removeItem(itemName, 1);
      pm.m.status = null;
      addLog(pm.m.name + ' 的异常状态被治愈了！', 'good');
    } else if (item.cure && pm.m.status === item.cure) {
      removeItem(itemName, 1);
      pm.m.status = null;
      addLog(pm.m.name + ' 的' + item.cure + '被治好了！', 'good');
    } else {
      addLog(pm.m.name + ' 没有' + item.cure + '状态。', 'info');
      return;
    }
    const fMove = pickFoeMove(fm, pm);
    const log = [];
    const kinds = [];
    let logPos = 0;
    function flushLog() {
      for (let i = logPos; i < log.length; i++) addLog(log[i], kinds[i]);
      logPos = log.length;
    }
    if (fm.m.hp > 0 && pm.m.hp > 0) useMove(fm, pm, fMove, log, kinds);
    flushLog();
    if (!b.over) { endOfTurn(log, kinds); flushLog(); handleFaints(log, kinds); flushLog(); }
    if (!b.over) b.waitingPlayer = true;
    return;
  }
  addLog('这个道具不能在这里使用。', 'info');
}

// 捕获反馈：新种类提示登记，重复种类提示已有记录
function logCatchFeedback(mon) {
  const isNew = !STATE.caughtDex[mon.species];
  STATE.caughtDex[mon.species] = true;
  if (isNew) addLog('图鉴登记了新种类：' + mon.name + '（No.' + mon.species + '）！', 'good');
  else addLog('（图鉴已有 ' + mon.name + ' 的记录）', 'info');
}

function battleSwitch(idx) {
  const b = STATE.battle;
  if (!b || b.over) return;
  const p = b.player;
  const f = b.foe;
  const pm = p.mons[p.active];
  const target = p.mons[idx];
  if (!target || target.m.hp <= 0) { addLog('这只宝可梦已经没有体力了！'); return; }
  if (idx === p.active) { addLog('它已经在场上了！'); return; }
  if (pm.trapTurns > 0) { addLog(pm.m.name + ' 被困住，无法替换！'); return; }
  p.active = idx;
  addLog('回来吧！上吧，' + target.m.name + '！', 'info');
  const fm = f.mons[f.active];
  const fMove = pickFoeMove(fm, target);
  const log = [];
  const kinds = [];
  let logPos = 0;
  function flushLog() {
    for (let i = logPos; i < log.length; i++) addLog(log[i], kinds[i]);
    logPos = log.length;
  }
  if (fm.m.hp > 0 && target.m.hp > 0) useMove(fm, target, fMove, log, kinds);
  flushLog();
  if (!b.over) { endOfTurn(log, kinds); flushLog(); handleFaints(log, kinds); flushLog(); }
  if (!b.over) b.waitingPlayer = true;
}

function battleRun() {
  const b = STATE.battle;
  if (!b || b.over) return;
  if (!b.canRun) { addLog('不能逃跑！'); return; }
  addLog('你成功逃走了！', 'info');
  b.over = true;
  b.outcome = 'run';
  STATE.lastResult = 'run';
  STATE.lastBattleView = { player: b.player, foe: b.foe, kind: b.kind, logStart: b.logStart };
  STATE.screen = 'map';
  STATE.battle = null;
}

function endBattle(outcome) {
  const b = STATE.battle;
  if (!b) return;
  STATE.lastBattleView = { player: b.player, foe: b.foe, kind: b.kind, logStart: b.logStart };
  b.over = true;
  b.outcome = outcome;
  STATE.lastResult = outcome;
  STATE.screen = 'map';
  // 羁绊：每次战斗（胜/负）首发 +3、队伍其他 +1；道馆胜利全队 +5
  if (outcome === 'win' || outcome === 'lose') {
    STATE.party.forEach(function (m, i) { addBond(m, i === 0 ? 3 : 1); });
  }
  if (outcome === 'win' && b.kind === 'gym') {
    STATE.party.forEach(function (m) { addBond(m, 5); });
  }
  if (outcome === 'win') {
    if (b.prize > 0) {
      STATE.money += b.prize;
      addLog('获得了 ' + b.prize + ' 金币！', 'good');
    }
    if (b.trainerId) STATE.trainersDefeated[b.trainerId] = true;
    if (b.rewardItem) {
      addItem(b.rewardItem, 1);
      addLog('获得了道具【' + b.rewardItem + '】！', 'good');
    }
    if (b.rewardMon) {
      const lv = MAP_NODES[STATE.nodeId].levels ? MAP_NODES[STATE.nodeId].levels[1] : 10;
      const mon = makeMon(b.rewardMon, lv);
      addToPartyOrBox(mon);
      STATE.seenDex[b.rewardMon] = true;
      STATE.caughtDex[b.rewardMon] = true;
      addLog(b.rewardMonName || (mon.name + ' 加入了你的队伍！'), 'good');
    }
    if (b.badge) {
      if (STATE.badges.indexOf(b.badge) === -1) {
        STATE.badges.push(b.badge);
        addLog('获得了道馆徽章【' + b.badge + '】！', 'good');
      }
    }
    if (b.tm) {
      addItem('TM' + b.tm, 1);
      addLog('获得了【TM' + b.tm + '】！', 'good');
    }
    if (b.kind === 'rival' && b.rivalStep) {
      STATE.rivalWon.push(b.rivalStep);
      addLog('小茂：哼，这次算你赢了！下次可不会这么简单！', 'info');
    }
    if (b.kind === 'ssanne') {
      STATE.ssAnneDone = true;
      addLog('水手：「不愧是优秀的训练家！这枚 TM 居合斩送给你了！」', 'good');
    }
    const gym = MAP_NODES[STATE.nodeId] && MAP_NODES[STATE.nodeId].gym;
    if (b.kind === 'gym' && gym && gym.winText) addLog(gym.leader + '：' + gym.winText, 'good');
  } else if (outcome === 'lose') {
    if (b.kind === 'tower') {
      // 塔内败北：不回血、不回城，回到最近存档点继续
      STATE.tower.floor = Math.max(1, STATE.tower.checkpoint + 1);
      addLog('无尽之塔挑战失败……回到第 ' + STATE.tower.checkpoint + ' 层存档点。', 'bad');
    } else {
    if (b.kind === 'rocket_robbery') {
      const lost = Math.floor(STATE.money / 2);
      STATE.money -= lost;
      addLog('火箭队抢走了你 ' + lost + ' 金币！', 'bad');
      const keys = Object.keys(STATE.bag).filter(function (k) {
        return ['精灵球', '伤药', '解毒药', '解麻药', '穿绳'].indexOf(k) === -1;
      });
      if (keys.length > 0) {
        const stolen = keys[randInt(0, keys.length - 1)];
        removeItem(stolen, 1);
        addLog('火箭队还抢走了你的【' + stolen + '】！', 'bad');
      }
    }
    if (b.kind === 'bandit') {
      const lost = Math.floor(STATE.money / 2);
      STATE.money -= lost;
      addLog('强盗抢走了你 ' + lost + ' 金币！', 'bad');
    }
    addLog('眼前一黑……你回到了 ' + MAP_NODES[STATE.lastTown].name + ' 的宝可梦中心。', 'bad');
    healAll();
    STATE.nodeId = STATE.lastTown;
    STATE.weather = rollWeather(STATE.lastTown);
    STATE.wanderUsed = false;
    }
  }
  if (b.kind === 'tower' && outcome === 'win') {
    const t = STATE.tower;
    t.floor++;
    if (t.floor - 1 > t.bestFloor) t.bestFloor = t.floor - 1;
    if ((t.floor - 1) % 5 === 0) {
      t.checkpoint = t.floor - 1;
      // 每 5 层一次性道具奖励（层数越高奖励越好）
      const lvl = t.floor - 1;
      const pool = lvl >= 90 ? ['大师球', '全复药', '幸运蛋'] :
        lvl >= 60 ? ['高级球', '全复药', 'PP满回复药', '吃剩的东西'] :
        lvl >= 30 ? ['超级球', '万灵药', 'PP满回复药', '雷之石', '火之石', '水之石', '叶之石', '月亮石'] :
        ['精灵球', '好伤药', '万灵药', 'PP回复药'];
      const item = pool[randInt(0, pool.length - 1)];
      addItem(item, 1);
      addLog('第 ' + lvl + ' 层奖励：【' + item + '】！', 'good');
    }
    if (t.floor > 100) {
      t.cleared = true;
      t.floor = 100;
      if (STATE.titles.indexOf('无尽之塔征服者') === -1) {
        STATE.titles.push('无尽之塔征服者');
        addLog('你征服了无尽之塔！获得称号【无尽之塔征服者】！', 'good');
      }
    }
  }
  if (b.kind === 'gym_apprentice' && STATE.gymSession && outcome === 'win') {
    STATE.gymSession.step++;
    addLog('你击败了道馆学徒！但连战还在继续，宝可梦们来不及休息……', 'info');
    if (STATE.gymSession.step >= STATE.gymSession.steps.length) {
      STATE.gymSession = null;
    } else {
      startGymStep();
    }
    return;
  }
  STATE.gymSession = null;
  STATE.battle = null;
}

function addToPartyOrBox(mon) {
  if (STATE.party.length < PARTY_LIMIT) STATE.party.push(mon);
  else STATE.box.push(mon);
}

// 电脑箱取回：用队伍里的一只宝可梦与箱内宝可梦交换
function boxSwap(boxIdx, partyIdx) {
  const boxMon = STATE.box[boxIdx];
  const partyMon = STATE.party[partyIdx];
  if (!boxMon || !partyMon) { addLog('宝可梦不存在。'); return; }
  STATE.party[partyIdx] = boxMon;
  STATE.box[boxIdx] = partyMon;
  addLog('你把 ' + partyMon.name + ' 存入了电脑箱，取回了 ' + boxMon.name + '！', 'good');
  addBond(partyMon, -10);
  addLog(partyMon.name + ' 看起来有些失落地进入了电脑盒子……', 'info');
}

// 属性糖果掉落：按最高种族值决定，同分按 体力 > 速度 > 物攻 > 特攻 > 物防 > 特防
const CANDY_PRIORITY = [
  { key: 'hp', name: 'HP糖果' },
  { key: 'spe', name: '速度糖果' },
  { key: 'atk', name: '攻击糖果' },
  { key: 'spa', name: '特攻糖果' },
  { key: 'def', name: '防御糖果' },
  { key: 'spd', name: '特防糖果' }
];

function candyForSpecies(speciesId) {
  const d = POKEDEX[speciesId];
  let best = CANDY_PRIORITY[0];
  for (let i = 1; i < CANDY_PRIORITY.length; i++) {
    if (d.base[CANDY_PRIORITY[i].key] > d.base[best.key]) best = CANDY_PRIORITY[i];
  }
  return best.name;
}

// 传送：宝可梦消失 → 万能经验（保底 10）+ 1 颗属性糖果
function transferMon(boxIdx) {
  const mon = STATE.box[boxIdx];
  if (!mon) { addLog('没有这只宝可梦。', 'info'); return; }
  const exp = Math.max(10, Math.floor(mon.exp * 0.3));
  const candy = candyForSpecies(mon.species);
  STATE.expPool += exp;
  addItem(candy, 1);
  STATE.box.splice(boxIdx, 1);
  addLog('你把 ' + mon.name + ' 传送给了大木博士。', 'info');
  addLog('万能经验 +' + exp + '，获得了【' + candy + '】×1！', 'good');
}

// 从万能经验池分配经验给队伍宝可梦：mode = 'next'（升 1 级）/ 'all'（全部分配）
function allocateExp(partyIdx, mode) {
  const mon = STATE.party[partyIdx];
  if (!mon) return;
  if (STATE.expPool <= 0) { addLog('万能经验池是空的。', 'info'); return; }
  if (mon.level >= 100) { addLog(mon.name + ' 已经满级了。', 'info'); return; }
  let amount = mode === 'next' ? expToNext(mon) : STATE.expPool;
  amount = Math.min(amount, STATE.expPool);
  STATE.expPool -= amount;
  const log = [];
  const kinds = [];
  grantExp(mon, amount, log, kinds);
  log.forEach(function (t, i) { addLog(t, kinds[i]); });
  addLog('万能经验池剩余 ' + STATE.expPool + ' 点。', 'info');
}

// ---------------- 探索 / 城镇 ----------------

function gotoNode(nodeId) {
  const node = MAP_NODES[nodeId];
  if (!node) return;
  const cur = MAP_NODES[STATE.nodeId];
  if (cur.next.indexOf(nodeId) === -1) { addLog('还不能直接去那里。'); return; }
  if (node.requireBadge && STATE.badges.indexOf(node.requireBadge) === -1) {
    addLog('需要【' + node.requireBadge + '】才能前往 ' + node.name + '！');
    return;
  }
  STATE.nodeId = nodeId;
  if (STATE.visitedNodes.indexOf(nodeId) === -1) STATE.visitedNodes.push(nodeId);
  STATE.weather = rollWeather(nodeId, STATE.weatherBias ? STATE.weatherBias.type : null);
  if (node.type === 'town') {
    STATE.lastTown = nodeId;
    // 闲逛事件刷新：需要野外遭遇战次数达标后才重新激活（离开城镇不再直接重置）
    if (STATE.wildBattles >= WANDER_REFRESH_BATTLES) {
      STATE.wanderUsed = false;
      STATE.wildBattles = 0;
    }
  }
  addLog('你来到了 ' + node.name + '。', 'info');
  if (node.desc) addLog(node.desc, 'info');
  const rival = rivalTriggerFor(nodeId);
  if (rival) startRivalBattle(rival);
}

function exploreOnce() {
  const node = MAP_NODES[STATE.nodeId];
  if (node.type === 'town') {
    addLog('城镇里没有草丛，去野外探索吧！', 'info');
    return;
  }
  // 羁绊：首发宝可梦每次探索 +1 步，累计 10 步 +1 点羁绊
  const lead = STATE.party[0];
  if (lead) {
    lead.exploreSteps = (lead.exploreSteps || 0) + 1;
    if (lead.exploreSteps >= 10) {
      lead.exploreSteps = 0;
      addBond(lead, 1);
      addLog(lead.name + ' 与你越来越默契了……', 'good');
    }
  }
  refreshWeather(false);
  // 雷阵雨落雷事件
  if (STATE.weather === '雷阵雨' && node.thunderEvent && Math.random() < node.thunderEvent.chance) {
    addLog(node.thunderEvent.text, 'bad');
    const active = STATE.party.find(function (m) { return m.hp > 0; });
    if (active) {
      const dmg = Math.max(1, Math.floor(active.stats.hp * 0.1));
      active.hp -= dmg;
      addLog(active.name + ' 受到了 ' + dmg + ' 点伤害！', 'bad');
    }
    addItem('雷之石', 1);
    addLog('你捡到了【雷之石】！', 'good');
    return;
  }
  if (STATE.repel > 0) {
    STATE.repel--;
    addLog('喷雾剂散发出令野生宝可梦讨厌的气味，你安全地走了一段路。（剩余 ' + STATE.repel + ' 次）', 'info');
    return;
  }
  const r = randInt(1, 100);
  if (r <= 50) {
    const pool = node.pools[STATE.weather] || node.pools['晴'];
    const pick = pickWeighted(pool);
    const level = randInt(node.levels[0], node.levels[1]);
    addLog('你在草丛中发现了野生的 ' + POKEDEX[pick.id].name + '！', 'info');
    startWildBattle(pick.id, level);
    return;
  }
  if (r <= 64) {
    const undefeated = (node.trainers || []).filter(function (t) { return !STATE.trainersDefeated[t.id]; });
    if (undefeated.length === 0) {
      addLog('草丛里安安静静的，没有训练家来挑战。', 'info');
      return;
    }
    const trainer = undefeated[randInt(0, undefeated.length - 1)];
    addLog('草丛里突然窜出一个' + trainer.title + '！', 'info');
    startTrainerBattle(trainer);
    return;
  }
  if (r <= 67) {
    const gifts = ['伤药', '精灵球', '解毒药', '解麻药'];
    const item = gifts[randInt(0, gifts.length - 1)];
    addItem(item, 1);
    addLog('你捡到了【' + item + '】！', 'good');
    return;
  }
  if (r <= 72) {
    startMerchantOffer();
    return;
  }
  if (r <= 77) {
    startBanditEvent();
    return;
  }
  if (r <= 81) {
    startMedicOffer();
    return;
  }
  if (r <= 87) {
    startRocketBattle('robbery');
    return;
  }
  if (r <= 91) {
    const ev = ROCKET_EVENTS.sell;
    if (STATE.money < ev.price) {
      addLog(ev.text + ' 但你的钱不够，小兵骂骂咧咧地走了。', 'info');
      return;
    }
    addLog(ev.text, 'info');
    addLog('（可以付钱买下，也可以不理他）', 'info');
    STATE.rocketSell = true;
    return;
  }
  if (r <= 93) {
    startRocketBattle('rescue');
    return;
  }
  addLog('周围很安静，看来今天运气一般。', 'info');
}

function explore() {
  exploreOnce();
  if (!STATE.battle && !STATE.townTrade && !STATE.rocketSell && !STATE.merchantOffer &&
      !STATE.banditToll && !STATE.medicOffer && !STATE.magikarpOffer &&
      STATE.keyItems.indexOf('自行车') !== -1 && Math.random() < 0.3) {
    addLog('骑着自行车，你很快来到了另一片草丛！', 'info');
    exploreOnce();
  }
}

// ---------- 钓鱼（破旧钓竿） ----------

function fish() {
  const node = MAP_NODES[STATE.nodeId];
  if (!node.water) { addLog('这里没有水域，钓不了鱼。', 'info'); return; }
  if (STATE.keyItems.indexOf('破旧钓竿') === -1) { addLog('你没有钓竿……去华蓝市找找看吧。', 'info'); return; }
  // 按水域节点取钓鱼池（未配置的用经典四件套）
  const pool = FISH_POOLS[STATE.nodeId] || FISH_POOL_FALLBACK;
  const total = pool.reduce(function (s, p) { return s + p.w; }, 0);
  let roll = Math.random() * total;
  let id = pool[pool.length - 1].id;
  for (let i = 0; i < pool.length; i++) {
    roll -= pool[i].w;
    if (roll <= 0) { id = pool[i].id; break; }
  }
  const level = node.levels[0] + randInt(0, 2);
  addLog('水面泛起了波纹……上钩了！是野生的 ' + POKEDEX[id].name + '！', 'info');
  startWildBattle(id, level);
}

function resolveRocketSell(pay) {
  const ev = ROCKET_EVENTS.sell;
  if (pay) {
    if (STATE.money < ev.price) { addLog('钱不够……', 'info'); return; }
    STATE.money -= ev.price;
    addLog('你付了 ' + ev.price + ' 金币，接过了一个精灵球。', 'info');
    if (Math.random() < 0.5) {
      const monId = ev.rare[randInt(0, ev.rare.length - 1)];
      const lv = MAP_NODES[STATE.nodeId].levels ? MAP_NODES[STATE.nodeId].levels[1] : 10;
      const mon = makeMon(monId, lv);
      addToPartyOrBox(mon);
      STATE.seenDex[monId] = true;
      STATE.caughtDex[monId] = true;
      addLog('球里装的居然是 ' + mon.name + '！赚翻了！', 'good');
    } else {
      const mon = makeMon(ev.junk, 5);
      addToPartyOrBox(mon);
      STATE.seenDex[ev.junk] = true;
      STATE.caughtDex[ev.junk] = true;
      addLog('球里是一条鲤鱼王……「嘻嘻，谢啦冤大头！」火箭队小兵跑没影了。', 'info');
    }
  } else {
    addLog('你转身就走，火箭队小兵在后面喊：「不识货的家伙！」', 'info');
  }
  STATE.rocketSell = false;
}

// ---------- 圣安奴号（枯叶市一次性支线） ----------

function startSSAnne() {
  addLog('枯叶市的港口停靠着一艘豪华客轮「圣安奴号」，你登上了甲板。', 'info');
  startBattle('ssanne', {
    foe: [
      { id: 72, level: 24, moves: ['water_gun', 'bubble_beam', 'poison_sting'] },
      { id: 73, level: 25, moves: ['water_pulse', 'acid', 'bubble_beam'] }
    ],
    canRun: false,
    prize: 1000,
    rewardItem: 'TM居合斩',
    trainerName: '水手',
    title: '圣安奴号水手',
    trainerText: '欢迎来到圣安奴号！想下船，先和我对战一场吧！',
    opening: '圣安奴号的水手向你发起挑战！'
  });
}

// ---------- 鲤鱼王大叔（华蓝市一次性支线） ----------

function resolveMagikarpOffer(pay) {
  if (!STATE.magikarpOffer) return;
  STATE.magikarpOffer = false;
  const price = 500;
  if (pay) {
    if (STATE.money < price) {
      addLog('你身上的金币不够 500，鲤鱼王大叔扫兴地走了。', 'info');
      return;
    }
    STATE.money -= price;
    const mon = makeMon(129, 5);
    addToPartyOrBox(mon);
    STATE.seenDex[129] = true;
    STATE.caughtDex[129] = true;
    addLog('你花了 ' + price + ' 金币买下了鲤鱼王！鲤鱼王大叔心满意足地离开了。', 'good');
    STATE.magikarpDone = true;
  } else {
    addLog('你摇摇头走开了，鲤鱼王大叔在后面喊：「不识货啊！」', 'info');
    STATE.magikarpDone = true;
  }
}

// ---------- 探索金币事件（神秘商人 / 强盗 / 旅行补给商） ----------

function useRepel() {
  if (bagCount('喷雾剂') <= 0) { addLog('没有喷雾剂。', 'info'); return; }
  removeItem('喷雾剂', 1);
  STATE.repel = 10;
  addLog('你使用了喷雾剂，接下来 10 次探索不会遇到野生宝可梦！', 'info');
}

function useWeatherItem(itemName) {
  const item = ITEMS[itemName];
  if (!item || bagCount(itemName) <= 0) { addLog('没有这个道具。', 'info'); return; }
  if (item.type === 'weather') {
    removeItem(itemName, 1);
    STATE.weatherBias = { type: item.weather, steps: 10 };
    addLog('你使用了【' + itemName + '】，接下来 10 次探索中 ' + WEATHER[item.weather].name + ' 出现的概率会大幅提升！', 'info');
  } else if (item.type === 'weatherboost') {
    removeItem(itemName, 1);
    STATE.weatherBoost = 10;
    addLog('你使用了【' + itemName + '】，接下来 10 次探索天气刷新的概率翻倍！', 'info');
  } else {
    addLog('这个道具不能这样使用。', 'info');
  }
}

function startMerchantOffer() {
  const itemDeals = [
    { kind: 'item', name: '高级球', price: 3000 },
    { kind: 'item', name: 'PP满回复药', price: 2500 },
    { kind: 'item', name: ['雷之石', '火之石', '水之石', '叶之石', '月亮石'][randInt(0, 4)], price: 3500 },
    { kind: 'item', name: '吃剩的东西', price: 12000 },
    { kind: 'item', name: '幸运蛋', price: 15000 }
  ];
  const monDeals = [
    { kind: 'mon', id: 133, price: 8000 },
    { kind: 'mon', id: 131, price: 12000 },
    { kind: 'mon', id: 143, price: 15000 },
    { kind: 'mon', id: 147, price: 10000 }
  ];
  const all = itemDeals.concat(monDeals);
  STATE.merchantOffer = all[randInt(0, all.length - 1)];
  addLog('神秘商人从草丛里冒了出来：「小伙子，我这里有件好东西，要不要看看？」', 'info');
}

function resolveMerchantOffer(buy) {
  const d = STATE.merchantOffer;
  STATE.merchantOffer = null;
  if (!d) return;
  if (!buy) { addLog('你摇了摇头，神秘商人悻悻地走了。', 'info'); return; }
  if (STATE.money < d.price) { addLog('你钱不够，神秘商人摆摆手走了。', 'info'); return; }
  STATE.money -= d.price;
  if (d.kind === 'item') {
    addItem(d.name, 1);
    addLog('你花 ' + d.price + ' 金币买下了【' + d.name + '】！', 'good');
  } else {
    const node = MAP_NODES[STATE.nodeId];
    const lv = node.levels ? node.levels[1] : 10;
    const mon = makeMon(d.id, lv);
    addToPartyOrBox(mon);
    STATE.seenDex[d.id] = true;
    STATE.caughtDex[d.id] = true;
    addLog('你花 ' + d.price + ' 金币买下了 ' + mon.name + '！', 'good');
  }
}

function startBanditEvent() {
  STATE.banditToll = true;
  STATE.banditPrice = 800;
  addLog('一个凶神恶煞的强盗拦住你：「此路是我开，想过去先交 800 金币！」', 'bad');
}

function resolveBandit(pay) {
  if (!STATE.banditToll) return;
  const price = STATE.banditPrice || 800;
  if (pay && STATE.money >= price) {
    STATE.banditToll = false;
    STATE.money -= price;
    addLog('你交了 ' + price + ' 金币过路费，强盗让开了路。', 'info');
    return;
  }
  STATE.banditToll = false;
  if (pay) addLog('你钱不够，只能应战！', 'bad');
  const node = MAP_NODES[STATE.nodeId];
  const top = node.levels ? node.levels[1] : 10;
  startBattle('bandit', {
    foe: [
      { id: 19, level: Math.max(3, top), moves: ['hyper_fang', 'quick_attack'] },
      { id: 20, level: Math.max(4, top + 1), moves: ['hyper_fang', 'double_edge'] }
    ],
    canRun: false,
    prize: price * 2,
    trainerName: '强盗',
    title: '拦路强盗',
    trainerText: '不给钱？那就尝尝我的厉害！',
    opening: '强盗向你扑了过来！'
  });
}

function startMedicOffer() {
  STATE.medicOffer = true;
  addLog('一位旅行补给商在路边招手：「需要补给吗？野外价格，童叟无欺！」', 'info');
}

function resolveMedic(option) {
  if (!STATE.medicOffer) return;
  STATE.medicOffer = false;
  if (option === 'heal') {
    if (STATE.money < 800) { addLog('钱不够……', 'info'); return; }
    STATE.money -= 800;
    STATE.party.forEach(function (m) { m.hp = m.stats.hp; m.status = null; m.statusTurns = 0; });
    addLog('你花了 800 金币，补给商帮你回复了全员 HP！', 'good');
  } else if (option === 'pp') {
    if (STATE.money < 1500) { addLog('钱不够……', 'info'); return; }
    STATE.money -= 1500;
    STATE.party.forEach(function (m) { m.pp = m.moves.map(function (id) { return MOVES[id] ? MOVES[id].pp : 1; }); });
    addLog('你花了 1500 金币，补给商帮你回复了全员 PP！', 'good');
  } else {
    addLog('你谢绝了补给商。', 'info');
  }
}

function visitCenter() {
  if (!needsCenterHeal()) {
    addLog('乔伊小姐：「你的宝可梦都精神满满，不需要恢复哦！」', 'info');
    return;
  }
  const cost = centerCost();
  if (cost > 0) {
    if (STATE.money >= cost) {
      STATE.money -= cost;
      addLog('乔伊小姐收取了 ' + cost + ' 金币的恢复费用。', 'info');
    } else {
      addLog('乔伊小姐看你囊中羞涩，这次免费帮你恢复了。', 'info');
    }
  }
  healAll();
  addLog('宝可梦中心的乔伊小姐把你的宝可梦都恢复了！', 'good');
}

// 队伍是否真的需要中心恢复（掉血 / 异常 / PP 未满任一即需要）
function needsCenterHeal() {
  return STATE.party.some(function (m) {
    if (m.hp < m.stats.hp || m.status) return true;
    for (let i = 0; i < m.moves.length; i++) {
      const max = MOVES[m.moves[i]] ? MOVES[m.moves[i]].pp : 1;
      if (!m.pp || m.pp[i] === undefined || m.pp[i] < max) return true;
    }
    return false;
  });
}

// 宝可梦中心费用：按队伍平均等级 ×10 收取（等级越高越贵，作为软性续航成本）
function centerCost() {
  if (STATE.party.length === 0) return 0;
  const total = STATE.party.reduce(function (s, m) { return s + m.level; }, 0);
  return Math.floor(total / STATE.party.length * 10);
}

function healAll() {
  STATE.party.forEach(function (m) {
    m.hp = m.stats.hp;
    m.status = null;
    m.statusTurns = 0;
    m.pp = m.moves.map(function (id) { return MOVES[id] ? MOVES[id].pp : 1; });
  });
}

// 设置队伍首发：把指定宝可梦移到队首，战斗默认先派出
function setLeadMon(idx) {
  if (!STATE.party[idx]) { addLog('这只宝可梦不存在。', 'info'); return; }
  const mon = STATE.party[idx];
  STATE.party.splice(idx, 1);
  STATE.party.unshift(mon);
  addLog(mon.name + ' 被设为队伍首发！', 'info');
}

function getMartStock() {
  return MART_STOCK.filter(function (s) { return s.minBadges <= STATE.badges.length; }).map(function (s) { return s.name; });
}

function buyItem(name, qty) {
  qty = qty || 1;
  const item = ITEMS[name];
  if (!item) return;
  const stock = getMartStock();
  if (stock.indexOf(name) === -1) { addLog('商店里没有这个商品。', 'info'); return; }
  const total = item.price * qty;
  if (STATE.money < total) { addLog('金币不够……', 'info'); return; }
  STATE.money -= total;
  addItem(name, qty);
  addLog('购买了【' + name + '】×' + qty + '，花费 ' + total + ' 金币。', 'info');
}

function sellItem(name, qty) {
  qty = qty || 1;
  if (bagCount(name) < qty) { addLog('没有这个道具。', 'info'); return; }
  const item = ITEMS[name];
  const price = item.sell || Math.floor((item.price || 0) / 2);
  if (price <= 0) { addLog('这个道具不能卖。', 'info'); return; }
  removeItem(name, qty);
  STATE.money += price * qty;
  addLog('卖掉了【' + name + '】×' + qty + '，获得 ' + (price * qty) + ' 金币。', 'good');
}

function wanderTown() {
  if (MAP_NODES[STATE.nodeId].type !== 'town') { addLog('这里不是城镇。', 'info'); return; }
  if (STATE.wanderUsed) {
    addLog('你在镇上转了一圈，居民们都在各自忙碌，没有什么特别的发现。', 'info');
    return;
  }
  STATE.wanderUsed = true;
  // 圣安奴号：枯叶市一次性支线（登船对战水手）
  if (STATE.nodeId === 'vermilion' && !STATE.ssAnneDone) {
    startSSAnne();
    return;
  }
  // 鲤鱼王大叔：华蓝市一次性支线（花 500 金买鲤鱼王）
  if (STATE.nodeId === 'cerulean' && !STATE.magikarpDone) {
    STATE.magikarpOffer = true;
    addLog('鲤鱼王大叔凑过来：「小伙子，稀有宝可梦鲤鱼王，只要 500 金，怎么样？」', 'info');
    return;
  }
  // 关键道具：常磐市自行车店
  if (STATE.nodeId === 'viridian' && STATE.keyItems.indexOf('自行车') === -1 && Math.random() < 0.5) {
    STATE.keyItems.push('自行车');
    addLog('常磐市的自行车店老板送你一辆【自行车】！野外探索时骑行更快！', 'good');
    return;
  }
  // 关键道具：华蓝市钓鱼大叔
  if (STATE.nodeId === 'cerulean' && STATE.keyItems.indexOf('破旧钓竿') === -1 && Math.random() < 0.4) {
    STATE.keyItems.push('破旧钓竿');
    addLog('华蓝市的钓鱼大叔看你顺眼，送了你一根【破旧钓竿】！去水边试试吧！', 'good');
    return;
  }
  // 垃圾桶寻宝：电气球（华蓝市，每档一次）
  if (STATE.nodeId === 'cerulean' && !STATE.heldObtained && Math.random() < 0.25) {
    addItem('电气球', 1);
    STATE.heldObtained = true;
    addLog('你在华蓝市的垃圾桶后面翻出了【电气球】！只有皮卡丘能携带它。', 'good');
    return;
  }
  // 垃圾桶寻宝：吃剩的东西（每档一次）
  if (!STATE.trashFound && Math.random() < 0.08) {
    STATE.trashFound = true;
    addItem('吃剩的东西', 1);
    addLog('你在垃圾桶后面翻出了【吃剩的东西】！听说携带它每回合能恢复HP。', 'good');
    return;
  }
  // NPC 交换（30%）
  if (Math.random() < 0.3) {
    startTradeEvent();
    return;
  }
  const r = randInt(1, 100);
  if (r <= 35) {
    const gifts = ['伤药', '精灵球', '解毒药'];
    const item = gifts[randInt(0, gifts.length - 1)];
    addItem(item, 1);
    addLog('热心居民送了你一个【' + item + '】！', 'good');
  } else if (r <= 50) {
    addLog('你在镇子里闲逛，看到一只野猫在追波波……', 'info');
  } else if (r <= 70) {
    addLog('你听到了远处传来的宝可梦叫声，听起来像是一只皮卡丘。', 'info');
  } else {
    addLog('镇上很平静，大家都在过着安稳的日子。', 'info');
  }
}

// ---------- NPC 交换（交换来的宝可梦 1.5 倍经验） ----------

const TRADES = [
  { give: 16, want: 19 }, // 居民想用 波波 换 小拉达
  { give: 21, want: 16 }, // 烈雀 换 波波
  { give: 43, want: 21 }, // 走路草 换 烈雀
  { give: 35, want: 25 }  // 皮皮 换 皮卡丘
];

function startTradeEvent() {
  const t = TRADES[randInt(0, TRADES.length - 1)];
  const has = STATE.party.some(function (m) { return m.species === t.want; });
  if (!has) {
    addLog('一位居民想和你交换宝可梦，但你手里没有他想要的 ' + POKEDEX[t.want].name + '。', 'info');
    return;
  }
  STATE.townTrade = t;
  addLog('一位居民拦住你：「我用 ' + POKEDEX[t.give].name + ' 换你的 ' + POKEDEX[t.want].name + '，怎么样？」', 'info');
}

function doTownTrade(accept) {
  const t = STATE.townTrade;
  if (!t) return;
  STATE.townTrade = null;
  if (!accept) { addLog('你婉拒了这次交换。', 'info'); return; }
  const idx = STATE.party.findIndex(function (m) { return m.species === t.want; });
  if (idx === -1) { addLog('你手里没有 ' + POKEDEX[t.want].name + '。', 'info'); return; }
  const level = STATE.party[idx].level;
  const mon = makeMon(t.give, level);
  mon.tradeBonus = true;
  STATE.party[idx] = mon;
  STATE.seenDex[t.give] = true;
  STATE.caughtDex[t.give] = true;
  addLog('交换成功！' + mon.name + ' 加入了你的队伍（交换来的宝可梦经验获取 1.5 倍）！', 'good');
}

function useEscapeRope() {
  if (bagCount('穿绳') <= 0) { addLog('没有穿绳。', 'info'); return; }
  removeItem('穿绳', 1);
  STATE.nodeId = STATE.lastTown;
  STATE.weather = rollWeather(STATE.lastTown);
  addLog('你使用穿绳瞬间回到了 ' + MAP_NODES[STATE.lastTown].name + '！', 'info');
}

function useBagItemOnMon(itemName, partyIdx) {
  const item = ITEMS[itemName];
  const mon = STATE.party[partyIdx];
  if (!item || !mon) return;
  if (bagCount(itemName) <= 0) { addLog('没有这个道具。', 'info'); return; }
  if (item.type === 'heal') {
    const bondItem = ['好伤药', '全复药', '万灵药'].indexOf(itemName) !== -1 && mon.hp < Math.floor(mon.stats.hp / 2);
    removeItem(itemName, 1);
    if (item.heal === 'full') { mon.hp = mon.stats.hp; mon.status = null; addLog(mon.name + ' 完全恢复了！', 'good'); if (bondItem) addBond(mon, 1); }
    else {
      const healed = Math.min(mon.stats.hp - mon.hp, item.heal);
      if (healed <= 0) { addLog(mon.name + ' 的HP是满的！', 'info'); addItem(itemName, 1); return; }
      mon.hp += healed;
      addLog(mon.name + ' 回复了 ' + healed + ' 点HP！', 'good');
      if (bondItem) addBond(mon, 1);
    }
    return;
  }
  if (item.type === 'cure') {
    const bondCure = itemName === '万灵药' && mon.hp < Math.floor(mon.stats.hp / 2);
    if (item.cure !== 'all' && mon.status !== item.cure) { addLog(mon.name + ' 没有' + item.cure + '状态。', 'info'); return; }
    if (item.cure === 'all' && !mon.status) { addLog(mon.name + ' 没有异常状态。', 'info'); return; }
    removeItem(itemName, 1);
    mon.status = null;
    addLog(item.cure === 'all' ? mon.name + ' 的异常状态被治愈了！' : mon.name + ' 的' + item.cure + '被治好了！', 'good');
    if (bondCure) addBond(mon, 1);
    return;
  }
  if (item.type === 'pp') {
    if (!mon.pp) mon.pp = mon.moves.map(function (id) { return MOVES[id] ? MOVES[id].pp : 1; });
    const allFull = mon.moves.every(function (id, i) { return mon.pp[i] >= (MOVES[id] ? MOVES[id].pp : 1); });
    if (allFull) { addLog(mon.name + ' 的PP已经是满的！', 'info'); return; }
    removeItem(itemName, 1);
    for (let i = 0; i < mon.moves.length; i++) {
      const max = MOVES[mon.moves[i]] ? MOVES[mon.moves[i]].pp : 1;
      mon.pp[i] = item.pp === 'full' ? max : Math.min(max, (mon.pp[i] || 0) + item.pp);
    }
    addLog(mon.name + ' 回复了PP！', 'good');
    return;
  }
  if (item.type === 'stone') {
    const evoLog = tryStoneEvolution(mon, item.stone);
    if (!evoLog) { addLog(itemName + ' 对 ' + mon.name + ' 没有效果。', 'info'); return; }
    removeItem(itemName, 1);
    evoLog.forEach(function (t) { addLog(t, 'good'); });
    return;
  }
  if (item.type === 'tm') {
    removeItem(itemName, 1);
    const mv = MOVES[item.move];
    const log = [];
    tryLearnMove(mon, item.move, log, false);
    if (log.length === 0) {
      addLog(mon.name + ' 已经会【' + mv.name + '】了。', 'info');
      addItem(itemName, 1);
    } else {
      log.forEach(function (t) { addLog(t, 'good'); });
    }
    return;
  }
  if (item.type === 'held') {
    const target = item.held;
    if (!target) { addLog('这个携带道具无法使用。', 'info'); return; }
    if (item.onlySpecies && mon.species !== item.onlySpecies) { addLog('只有' + POKEDEX[item.onlySpecies].name + '才能携带' + target + '！', 'info'); return; }
    if (mon.held === target) { addLog(mon.name + ' 已经携带着' + target + '。', 'info'); return; }
    // 替换旧携带道具时，旧道具退回背包（不丢失）
    if (mon.held) {
      addItem(mon.held, 1);
      addLog('原来携带的【' + mon.held + '】放回了背包。', 'info');
    }
    removeItem(itemName, 1);
    mon.held = target;
    addLog(mon.name + ' 携带了' + target + '！', 'good');
    return;
  }
  if (item.type === 'candy') {
    const stat = item.stat;
    const cb = mon.candyBonus;
    if (cb[stat] >= 15) { addLog(mon.name + ' 的该项属性已达极限！', 'info'); return; }
    if (cb.total >= 50) { addLog(mon.name + ' 已经吃不下任何糖果了！', 'info'); return; }
    removeItem(itemName, 1);
    cb[stat]++;
    cb.total++;
    recalcStats(mon);
    addLog(mon.name + ' 吃下了【' + itemName + '】，' + { hp: 'HP', atk: '攻击', def: '防御', spa: '特攻', spd: '特防', spe: '速度' }[stat] + '提升了！', 'good');
    return;
  }
  addLog('这个道具不能对宝可梦使用。', 'info');
}

// ---------------- 新游戏 / 存档 ----------------

function newGame(starterId) {
  const mon = makeMon(starterId, 5);
  mon.bond = 20; // 御三家初始羁绊
  STATE.screen = 'map';
  STATE.nodeId = 'pallet';
  STATE.weather = '晴';
  STATE.money = 3000;
  STATE.expPool = 0;
  STATE.bag = {};
  Object.keys(START_ITEMS).forEach(function (k) { STATE.bag[k] = START_ITEMS[k]; });
  STATE.badges = [];
  STATE.party = [mon];
  STATE.box = [];
  STATE.visitedNodes = ['pallet'];
  STATE.tower = { floor: 1, checkpoint: 0, bestFloor: 0, cleared: false };
  STATE.titles = [];
  STATE.log = [];
  STATE.logKinds = [];
  STATE.wildBattles = 0;
  STATE.lastBattleView = null;
  STATE.battle = null;
  STATE.pendingLearn = [];
  STATE.seenDex = {};
  STATE.caughtDex = {};
  STATE.trainersDefeated = {};
  STATE.lastTown = 'pallet';
  STATE.heldObtained = false;
  STATE.keyItems = [];
  STATE.rivalWon = [];
  STATE.gymSession = null;
  STATE.townTrade = null;
  STATE.trashFound = false;
  STATE.wanderUsed = false;
  STATE.ssAnneDone = false;
  STATE.magikarpDone = false;
  STATE.magikarpOffer = false;
  STATE.merchantOffer = null;
  STATE.banditToll = false;
  STATE.banditPrice = 800;
  STATE.medicOffer = false;
  STATE.repel = 0;
  STATE.weatherBias = null;
  STATE.weatherBoost = 0;
  STATE.seenDex[starterId] = true;
  STATE.caughtDex[starterId] = true;
  addLog('大木博士：好！从今天起你就是宝可梦训练家了！', 'info');
  addLog('你带着 ' + mon.name + ' 从真新镇出发了！', 'info');
  save();
}

function save() {
  try {
    const data = {
      version: GAME_VERSION,
      screen: STATE.screen === 'battle' ? 'map' : STATE.screen,
      nodeId: STATE.nodeId,
      weather: STATE.weather,
      money: STATE.money,
      expPool: STATE.expPool,
      bag: STATE.bag,
      badges: STATE.badges,
      party: STATE.party.map(serializeMon),
      box: STATE.box.map(serializeMon),
      visitedNodes: STATE.visitedNodes,
      tower: STATE.tower,
      titles: STATE.titles,
      wildBattles: STATE.wildBattles,
      pendingLearn: STATE.pendingLearn.map(function (p) {
        return { where: p.where, idx: p.idx, moveId: p.moveId, monName: p.monName, moveName: p.moveName };
      }),
      seenDex: STATE.seenDex,
      caughtDex: STATE.caughtDex,
      trainersDefeated: STATE.trainersDefeated,
      lastTown: STATE.lastTown,
      heldObtained: STATE.heldObtained,
      keyItems: STATE.keyItems,
      rivalWon: STATE.rivalWon,
      trashFound: STATE.trashFound,
      ssAnneDone: STATE.ssAnneDone,
      magikarpDone: STATE.magikarpDone
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) { /* 存档失败静默处理 */ }
}

function serializeMon(m) {
  return {
    species: m.species, level: m.level, exp: m.exp, hp: m.hp,
    status: m.status, statusTurns: m.statusTurns, ivs: m.ivs, moves: m.moves,
    pp: m.pp, nature: m.nature, held: m.held, tradeBonus: !!m.tradeBonus,
    candyBonus: m.candyBonus, bond: m.bond, exploreSteps: m.exploreSteps || 0
  };
}

function deserializeMon(d) {
  const mon = makeMon(d.species, d.level, { iv: d.ivs });
  mon.candyBonus = Object.assign({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, total: 0 }, d.candyBonus || {});
  recalcStats(mon); // 让糖果加成计入面板
  mon.exp = d.exp;
  mon.hp = d.hp;
  mon.status = d.status;
  mon.statusTurns = d.statusTurns || 0;
  mon.moves = (d.moves || []).filter(function (id) { return MOVES[id]; }).slice(0, 4);
  if (mon.moves.length === 0) mon.moves = ['tackle'];
  const savedPp = (d.pp && d.pp.length === mon.moves.length) ? d.pp : null;
  mon.pp = savedPp ? savedPp.slice(0, 4) : mon.moves.map(function (id) { return MOVES[id] ? MOVES[id].pp : 1; });
  mon.nature = d.nature || '勤奋';
  mon.held = d.held || null;
  mon.tradeBonus = !!d.tradeBonus;
  mon.bond = d.bond === undefined ? 0 : Math.max(0, Math.min(100, d.bond));
  mon.exploreSteps = d.exploreSteps || 0;
  return mon;
}

function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || data.version !== GAME_VERSION) return false;
    STATE.screen = 'map';
    STATE.nodeId = data.nodeId || 'pallet';
    STATE.weather = data.weather || '晴';
    STATE.money = data.money || 0;
    STATE.expPool = data.expPool || 0;
    STATE.bag = data.bag || {};
    STATE.badges = data.badges || [];
    STATE.party = (data.party || []).map(deserializeMon);
    STATE.box = (data.box || []).map(deserializeMon);
    STATE.visitedNodes = data.visitedNodes || [];
    STATE.tower = Object.assign({ floor: 1, checkpoint: 0, bestFloor: 0, cleared: false }, data.tower || {});
    STATE.titles = data.titles || [];
    STATE.pendingLearn = (data.pendingLearn || []).filter(function (p) {
      if (!p || !p.moveId || !MOVES[p.moveId]) return false;
      const holder = p.where === 'party' ? STATE.party : STATE.box;
      return p.idx >= 0 && p.idx < holder.length;
    });
    STATE.seenDex = data.seenDex || {};
    STATE.caughtDex = data.caughtDex || {};
    // 回填：队伍/电脑箱已有的宝可梦（含旧档已进化的）点亮图鉴
    STATE.party.forEach(function (m) { STATE.seenDex[m.species] = true; STATE.caughtDex[m.species] = true; });
    STATE.box.forEach(function (m) { STATE.seenDex[m.species] = true; STATE.caughtDex[m.species] = true; });
    STATE.trainersDefeated = data.trainersDefeated || {};
    STATE.lastTown = data.lastTown || 'pallet';
    STATE.heldObtained = !!data.heldObtained;
    STATE.keyItems = data.keyItems || [];
    STATE.rivalWon = data.rivalWon || [];
    STATE.trashFound = !!data.trashFound;
    STATE.ssAnneDone = !!data.ssAnneDone;
    STATE.magikarpDone = !!data.magikarpDone;
    STATE.wildBattles = data.wildBattles || 0;
    STATE.magikarpOffer = false;
    STATE.merchantOffer = null;
    STATE.banditToll = false;
    STATE.banditPrice = 800;
    STATE.medicOffer = false;
    STATE.repel = 0;
    STATE.weatherBias = null;
    STATE.weatherBoost = 0;
    STATE.battle = null;
    STATE.lastBattleView = null;
    STATE.log = [];
    STATE.logKinds = [];
    STATE.rocketSell = false;
    STATE.gymSession = null;
    STATE.townTrade = null;
    STATE.wanderUsed = false;
    addLog('欢迎回来，' + (data.name || '训练家') + '！存档读取成功。', 'info');
    return true;
  } catch (e) {
    return false;
  }
}

function resetGame() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  STATE.battle = null;
  STATE.lastBattleView = null;
  STATE.pendingLearn = [];
  STATE.logKinds = [];
  STATE.wildBattles = 0;
  STATE.expPool = 0;
  STATE.visitedNodes = [];
  STATE.tower = { floor: 1, checkpoint: 0, bestFloor: 0, cleared: false };
  STATE.titles = [];
  STATE.rocketSell = false;
  STATE.lastResult = null;
  STATE.gymSession = null;
  STATE.townTrade = null;
  STATE.magikarpOffer = false;
  STATE.merchantOffer = null;
  STATE.banditToll = false;
  STATE.medicOffer = false;
  STATE.repel = 0;
  STATE.weatherBias = null;
  STATE.weatherBoost = 0;
  STATE.wanderUsed = false;
  STATE.screen = 'title';
}

// 供 UI 读取的只读快照
function getState() { return STATE; }

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    STATE: STATE, save: save, load: load, hasSave: hasSave, resetGame: resetGame,
    newGame: newGame, gotoNode: gotoNode, explore: explore,
    startWildBattle: startWildBattle, startTrainerBattle: startTrainerBattle,
    startRocketBattle: startRocketBattle, startGymBattle: startGymBattle,
    battleMove: battleMove, battleUseItem: battleUseItem, battleSwitch: battleSwitch, battleRun: battleRun,
    resolveRocketSell: resolveRocketSell, resolvePendingLearn: resolvePendingLearn,
    visitCenter: visitCenter, getMartStock: getMartStock, buyItem: buyItem, sellItem: sellItem,
    wanderTown: wanderTown, useEscapeRope: useEscapeRope, useBagItemOnMon: useBagItemOnMon,
    challengeGym: challengeGym, fish: fish, doTownTrade: doTownTrade,
    startTowerFloor: startTowerFloor, towerFoeTeam: towerFoeTeam, towerThemeFor: towerThemeFor,
    startRivalBattle: startRivalBattle, getRivalStarter: getRivalStarter,
    setLeadMon: setLeadMon,
    boxSwap: boxSwap,
    transferMon: transferMon, allocateExp: allocateExp, candyForSpecies: candyForSpecies,
    addBond: addBond,
    startSSAnne: startSSAnne, resolveMagikarpOffer: resolveMagikarpOffer,
    useRepel: useRepel, startMerchantOffer: startMerchantOffer, resolveMerchantOffer: resolveMerchantOffer,
    startBanditEvent: startBanditEvent, resolveBandit: resolveBandit,
    startMedicOffer: startMedicOffer, resolveMedic: resolveMedic,
    useWeatherItem: useWeatherItem,
    makeMon: makeMon, calcDamage: calcDamage, expToNext: expToNext, healAll: healAll,
    grantExp: grantExp, checkEvolution: checkEvolution, tryLearnMove: tryLearnMove,
    tryStoneEvolution: tryStoneEvolution, startBattle: startBattle, typeEffectiveness: typeEffectiveness,
    rarityOf: rarityOf,
    stoneTargets: stoneTargets,
    learnableMoves: learnableMoves, moveReplaceCost: moveReplaceCost, replaceMove: replaceMove,
    expForLevel: expForLevel, getBattleWeather: getBattleWeather, endBattle: endBattle,
    rollWeather: rollWeather, refreshWeather: refreshWeather
  };
}
