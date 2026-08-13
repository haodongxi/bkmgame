/* ============================================================
   宝可梦：关都篇 - 核心游戏逻辑（纯文字像素版）
   Created by haodongsheng
   说明：本文件不含 DOM，可在浏览器与 Node vm 测试中运行。
   ============================================================ */

const SAVE_KEY = 'bkm_poke_save_v1';
const GAME_VERSION = 1;

const STATE = {
  version: GAME_VERSION,
  screen: 'title',            // title | starter | map | battle
  nodeId: 'pallet',
  weather: '晴',
  money: 3000,
  bag: {},
  badges: [],
  party: [],
  box: [],
  log: [],
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
  wanderUsed: false
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

function addLog(text) {
  STATE.log.push(text);
  if (STATE.log.length > 2000) STATE.log.splice(0, STATE.log.length - 2000);
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
    stats: stats
  };
  return mon;
}

function recalcStats(mon) {
  const data = mon.speciesData;
  const ivs = mon.ivs;
  const oldMax = mon.stats.hp;
  const stats = {};
  stats.hp = Math.floor(((2 * data.base.hp + ivs.hp) * mon.level) / 100) + mon.level + 10;
  ['atk', 'def', 'spa', 'spd', 'spe'].forEach(function (k) {
    stats[k] = Math.floor((Math.floor(((2 * data.base[k] + ivs[k]) * mon.level) / 100) + 5) * NATURES[mon.nature || '勤奋'][k]);
  });
  const hpGain = stats.hp - oldMax;
  mon.stats = stats;
  mon.hp = Math.min(stats.hp, mon.hp + Math.max(0, hpGain));
}

// ---------------- 等级 / 学习 / 进化 ----------------

function grantExp(mon, amount, log) {
  let remain = mon.tradeBonus ? Math.floor(amount * 1.5) : amount;
  while (mon.level < 100 && mon.exp + remain >= expForLevel(mon.speciesData.growth, mon.level + 1)) {
    const need = expForLevel(mon.speciesData.growth, mon.level + 1) - mon.exp;
    remain -= need;
    mon.exp = expForLevel(mon.speciesData.growth, mon.level + 1);
    mon.level++;
    recalcStats(mon);
    log.push(mon.name + ' 升到了 Lv.' + mon.level + '！');
    const newMoves = movesAtLevel(mon.speciesData, mon.level);
    for (let i = 0; i < newMoves.length; i++) {
      if (mon.moves.indexOf(newMoves[i]) === -1) tryLearnMove(mon, newMoves[i], log, false);
    }
    checkEvolution(mon, log);
  }
  if (remain > 0) mon.exp += remain;
}

function tryLearnMove(mon, moveId, log, autoReplace) {
  const mv = MOVES[moveId];
  if (mon.moves.indexOf(moveId) !== -1) return;
  if (mon.moves.length < 4) {
    mon.moves.push(moveId);
    log.push(mon.name + ' 学会了新招式【' + mv.name + '】！');
  } else if (autoReplace) {
    const old = mon.moves[0];
    mon.moves[0] = moveId;
    log.push(mon.name + ' 忘记了【' + MOVES[old].name + '】，学会了【' + mv.name + '】！');
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

function checkEvolution(mon, log) {
  let guard = 0;
  while (guard++ < 10) {
    const data = POKEDEX[mon.species];
    if (data.evo && data.evo.level && mon.level >= data.evo.level) {
      evolveTo(mon, data.evo.into, log);
    } else {
      break;
    }
  }
}

function evolveTo(mon, intoId, log) {
  const oldName = mon.name;
  const newData = POKEDEX[intoId];
  const ratio = mon.hp / mon.stats.hp;
  mon.species = intoId;
  mon.speciesData = newData;
  mon.name = newData.name;
  recalcStats(mon);
  mon.hp = Math.max(1, Math.floor(mon.stats.hp * ratio));
  if (log) log.push('哇！' + oldName + ' 进化成了 ' + newData.name + '！');
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

function rollWeather(nodeId) {
  const node = MAP_NODES[nodeId];
  const weights = node.weatherWeights || { '晴': 100 };
  const keys = Object.keys(weights);
  const pool = keys.map(function (k) { return { w: weights[k], weather: k }; });
  return pickWeighted(pool).weather;
}

function refreshWeather(force) {
  if (STATE.battle) return;
  if (force || Math.random() < 0.25) {
    const next = rollWeather(STATE.nodeId);
    if (next !== STATE.weather) {
      STATE.weather = next;
      addLog('天气变成了 ' + WEATHER[next].icon + ' ' + WEATHER[next].name + '！');
    }
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
  if (randInt(1, 16) === 1) { crit = true; mod *= 1.5; }
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

function applyStatus(bm, status, log, moveType) {
  if (bm.m.status) return;
  if (statusMoveImmune(moveType || '变化', status, bm)) return;
  bm.m.status = status;
  bm.m.statusTurns = 0;
  bm.poisonTurns = 0;
  if (status === '睡眠') bm.sleepTurns = randInt(1, 3);
  log.push(bm.m.name + ' 陷入了【' + status + '】状态！');
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
    sleepTurns: 0
  };
}

function firstAlive(partyMons) {
  for (let i = 0; i < partyMons.length; i++) if (partyMons[i].hp > 0) return i;
  return -1;
}

function startBattle(kind, opts) {
  opts = opts || {};
  const playerMons = STATE.party.map(makeBattleMon);
  const playerActive = firstAlive(STATE.party);
  const foeMons = opts.foe.map(function (fd) {
    const statMult = fd.statMult || 1;
    return makeBattleMon(makeMon(fd.id, fd.level, { statMult: statMult, moves: fd.moves }));
  });
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
    weather: null,
    over: false,
    outcome: null,
    turn: 0,
    logStart: STATE.log.length
  };
  STATE.screen = 'battle';
  const pActive = STATE.battle.player.mons[STATE.battle.player.active];
  addLog(opts.opening || ('野生的 ' + foeMons[0].m.name + ' 出现了！'));
  addLog('就决定是你了，' + pActive.m.name + '！');
}

function startWildBattle(speciesId, level) {
  STATE.seenDex[speciesId] = true;
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

function canAct(bm, log) {
  const m = bm.m;
  if (m.hp <= 0) return false;
  if (m.status === '睡眠') {
    bm.sleepTurns--;
    if (bm.sleepTurns <= 0) {
      m.status = null;
      log.push(m.name + ' 醒了过来！');
    } else {
      log.push(m.name + ' 正在呼呼大睡……');
      return false;
    }
  }
  if (m.status === '冰冻') {
    if (Math.random() < 0.2) {
      m.status = null;
      log.push(m.name + ' 解冻了！');
    } else {
      log.push(m.name + ' 被冻住了，无法动弹！');
      return false;
    }
  }
  if (m.status === '麻痹' && Math.random() < 0.25) {
    log.push(m.name + ' 因为麻痹无法行动！');
    return false;
  }
  if (bm.confuseTurns > 0) {
    bm.confuseTurns--;
    if (Math.random() < 0.5) {
      const dmg = Math.max(1, Math.floor(effStat(bm, 'atk') * 40 / Math.max(1, effStat(bm, 'def')) / 5));
      m.hp -= dmg;
      log.push(m.name + ' 混乱了，攻击了自己！受到了 ' + dmg + ' 点伤害！');
      if (m.hp <= 0) log.push(m.name + ' 倒下了！');
      return false;
    }
    log.push(m.name + ' 混乱了，但仍然使出了招式！');
  }
  return true;
}

function useMove(user, target, move, log) {
  const m = user.m;
  const t = target.m;
  if (!canAct(user, log)) return;
  if (user.recharge) {
    user.recharge = false;
    log.push(m.name + ' 因为反作用力无法行动！');
    return;
  }
  // 命中判定
  let hit = true;
  if (move.acc > 0) {
    if (move.id === 'thunder' && getBattleWeather() === '雨') hit = true;
    else if (Math.random() * 100 >= move.acc) hit = false;
  }
  if (!hit) {
    log.push(m.name + ' 使用了【' + move.name + '】，但是没有命中！');
    afterMove(user);
    return;
  }
  log.push(m.name + ' 使用了【' + move.name + '】！');

  if (move.category === '变化') {
    if (move.effect && move.effect.kind === 'protect') {
      user.protect = true;
      log.push(m.name + ' 摆出了守住的架势！');
    } else if (move.effect && move.effect.kind === 'weather') {
      STATE.battle.weather = { type: move.effect.weather, turns: 5 };
      log.push('天气变成了 ' + WEATHER[move.effect.weather].icon + ' ' + WEATHER[move.effect.weather].name + '！');
    } else if (move.effect && move.effect.kind === 'leech') {
      if (t.speciesData.types.indexOf('草') !== -1) {
        log.push('对 ' + t.name + ' 没有效果！');
      } else {
        target.leech = true;
        log.push(t.name + ' 被种下了寄生种子！');
      }
    } else if (move.effect && move.effect.kind === 'heal') {
      const healed = Math.min(m.stats.hp - m.hp, Math.floor(m.stats.hp * move.effect.ratio));
      if (healed > 0) {
        m.hp += healed;
        log.push(m.name + ' 回复了 ' + healed + ' 点HP！');
      } else {
        log.push(m.name + ' 的HP是满的。');
      }
    } else if (move.effect) {
      if (move.effect.kind === 'stat') {
        applyStatEffect(move.effect.target === 'self' ? user : target, move.effect, log);
      } else if (move.effect.kind === 'status') {
        applyStatus(target, move.effect.status, log, move.type);
      } else if (move.effect.kind === 'confuse') {
        if (!target.confuseTurns) {
          target.confuseTurns = randInt(2, 5);
          log.push(target.m.name + ' 混乱了！');
        }
      } else {
        log.push('但是什么都没有发生……');
      }
    } else {
      log.push('但是什么都没有发生……');
    }
    afterMove(user);
    return;
  }

  // 伤害类招式
  if (target.protect) {
    target.protect = false;
    log.push(t.name + ' 用守住挡下了攻击！');
    afterMove(user);
    return;
  }
  if (move.effect && move.effect.kind === 'dream' && t.status !== '睡眠') {
    log.push('但是失败了……');
    afterMove(user);
    return;
  }

  let totalDmg = 0;
  let effMsg = '';
  let critMsg = '';
  let hits = 1;
  if (move.effect && move.effect.kind === 'multi') {
    hits = move.effect.hits === 2 ? 2 : randInt(2, 5);
    log.push('命中 ' + hits + ' 次！');
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
        log.push('对 ' + t.name + ' 没有效果……');
        afterMove(user);
        return;
      }
    }
    if (res.crit) critMsg = ' 会心一击！';
    totalDmg += res.dmg;
    if (res.eff > 1) effMsg = ' 效果拔群！';
    if (res.eff > 0 && res.eff < 1) effMsg = ' 效果不太理想……';
  }
  t.hp -= totalDmg;
  log.push(critMsg + ' 造成了 ' + totalDmg + ' 点伤害！' + effMsg);
  if (t.hp <= 0) {
    t.hp = 0;
    log.push(t.name + ' 倒下了！');
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
      log.push(t.name + ' 畏缩了，无法行动！');
      target.flinch = true;
    }
    if (move.effect.kind === 'confuse' && move.effect.chance && t.hp > 0 && Math.random() < move.effect.chance) {
      if (!target.confuseTurns) {
        target.confuseTurns = randInt(2, 5);
        log.push(t.name + ' 混乱了！');
      }
    }
    if (move.effect.kind === 'recoil') {
      const recoil = Math.max(1, Math.floor(totalDmg * move.effect.ratio));
      m.hp -= recoil;
      log.push(m.name + ' 受到了反作用力 ' + recoil + ' 点伤害！');
      if (m.hp <= 0) { m.hp = 0; log.push(m.name + ' 倒下了！'); }
    }
    if (move.effect.kind === 'heal') {
      const base = move.effect.self ? m.stats.hp : totalDmg;
      const healed = Math.min(m.stats.hp - m.hp, Math.floor(base * move.effect.ratio));
      if (healed > 0) {
        m.hp += healed;
        log.push(m.name + ' 回复了 ' + healed + ' 点HP！');
      }
    }
    if (move.effect.kind === 'trap' && t.hp > 0) {
      target.trapTurns = randInt(2, 5);
      log.push(t.name + ' 被火焰困住了！');
    }
    if (move.effect.kind === 'recharge') {
      user.recharge = true;
    }
    if (move.effect.kind === 'selfConfuse') {
      user.confuseTurns = randInt(2, 5);
      log.push(m.name + ' 因为反作用力混乱了！');
    }
  }
  afterMove(user);
}

function applyStatEffect(passed, effect, log) {
  const apply = function (stat, stage) {
    if (Math.random() >= (effect.chance === undefined ? 1 : effect.chance)) return;
    const cur = passed.stages[stat] || 0;
    if (cur + stage > 6 || cur + stage < -6) return;
    passed.stages[stat] = cur + stage;
    log.push(passed.m.name + ' 的' + STAT_NAME[stat] + (stage > 0 ? '提升了！' : '降低了！'));
  };
  apply(effect.stat, effect.stage);
  if (effect.second) apply(effect.second.stat, effect.second.stage);
}

const STAT_NAME = { atk: '攻击', def: '防御', spa: '特攻', spd: '特防', spe: '速度' };

function afterMove(user) {
  if (user.confuseTurns > 0) user.confuseTurns--;
}

function endOfTurn(log) {
  const b = STATE.battle;
  if (!b) return;
  const weather = b.weather && b.weather.turns > 0 ? b.weather.type : getBattleWeather();
  const sides = [b.player, b.foe];
  for (let s = 0; s < sides.length; s++) {
    const bm = sides[s].mons[sides[s].active];
    if (!bm || bm.m.hp <= 0) continue;
    const m = bm.m;
    if (m.status === '中毒' || m.status === '灼伤') {
      const chip = Math.max(1, Math.floor(m.stats.hp / 8));
      m.hp -= chip;
      log.push(m.name + ' 受到了' + (m.status === '中毒' ? '中毒' : '灼伤') + '伤害 ' + chip + ' 点！');
    }
    if (m.status === '剧毒') {
      bm.poisonTurns++;
      const chip = Math.max(1, Math.floor(m.stats.hp / 16) * bm.poisonTurns);
      m.hp -= chip;
      log.push(m.name + ' 的剧毒发作了，受到了 ' + chip + ' 点伤害！');
    }
    if (weather === '沙暴' && !isSandImmune(m)) {
      const chip = Math.max(1, Math.floor(m.stats.hp / 16));
      m.hp -= chip;
      log.push(m.name + ' 被沙暴刮伤，受到了 ' + chip + ' 点伤害！');
    }
    if (bm.leech) {
      const chip = Math.max(1, Math.floor(m.stats.hp / 8));
      m.hp -= chip;
      log.push(m.name + ' 被寄生种子吸取了 ' + chip + ' 点HP！');
      const healer = sides[1 - s].mons[sides[1 - s].active];
      if (healer && healer.m.hp > 0) {
        healer.m.hp = Math.min(healer.m.stats.hp, healer.m.hp + chip);
      }
    }
    if (bm.trapTurns > 0) {
      bm.trapTurns--;
      const chip = Math.max(1, Math.floor(m.stats.hp / 16));
      m.hp -= chip;
      log.push(m.name + ' 被火焰旋涡困住，受到了 ' + chip + ' 点伤害！');
    }
    if (m.held === '吃剩的东西' && m.hp > 0 && m.hp < m.stats.hp) {
      const heal = Math.max(1, Math.floor(m.stats.hp / 16));
      m.hp = Math.min(m.stats.hp, m.hp + heal);
      log.push(m.name + ' 携带着吃剩的东西，恢复了 ' + heal + ' 点HP！');
    }
    if (m.hp <= 0) {
      m.hp = 0;
      log.push(m.name + ' 倒下了！');
    }
  }
  if (b.weather && b.weather.turns > 0) {
    b.weather.turns--;
    if (b.weather.turns === 0) log.push('天气恢复了正常……');
  }
}

function isSandImmune(mon) {
  const t = mon.speciesData.types;
  return t.indexOf('岩石') !== -1 || t.indexOf('地面') !== -1 || t.indexOf('钢') !== -1;
}

function handleFaints(log) {
  const b = STATE.battle;
  const p = b.player;
  const f = b.foe;
  if (f.mons[f.active].m.hp <= 0) {
    const foeMon = f.mons[f.active].m;
    const pActive = p.mons[p.active].m;
    if (pActive.hp > 0) {
      const gain = Math.floor(foeMon.speciesData.expYield * foeMon.level / 7) * (b.kind === 'wild' ? 1 : 1.5);
      log.push(pActive.name + ' 获得了 ' + gain + ' 点经验值！');
      grantExp(pActive, gain, log);
    }
    if (f.mons.every(function (bm) { return bm.m.hp <= 0; })) {
      endBattle('win');
      return true;
    }
    // 敌方换人
    for (let i = 0; i < f.mons.length; i++) {
      if (f.mons[i].m.hp > 0) {
        f.active = i;
        log.push('对方派出了 ' + f.mons[i].m.name + '！');
        break;
      }
    }
  }
  if (p.mons[p.active].m.hp <= 0) {
    const next = firstAlive(p.mons.map(function (bm) { return bm.m; }));
    if (next === -1) {
      endBattle('lose');
      return true;
    }
    p.active = next;
    log.push('上吧，' + p.mons[next].m.name + '！');
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
  if (!pMove) { addLog(pm.m.name + ' 的招式数据异常，无法使用！'); return; }
  const fMove = pickFoeMove(fm, pm);
  const log = [];
  b.turn++;
  const pPriority = pMove.effect && pMove.effect.kind === 'priority';
  const fPriority = fMove.effect && fMove.effect.kind === 'priority';
  const pFirst = pPriority ? true : (fPriority ? false : speedOf(pm) >= speedOf(fm));
  if (pFirst) {
    useMove(pm, fm, pMove, log);
    if (pm.m.hp > 0 && fm.m.hp > 0 && !b.over) useMove(fm, pm, fMove, log);
  } else {
    useMove(fm, pm, fMove, log);
    if (fm.m.hp > 0 && pm.m.hp > 0 && !b.over) useMove(pm, fm, pMove, log);
  }
  log.forEach(addLog);
  if (!b.over) {
    endOfTurn(log);
    log.forEach(addLog);
    handleFaints(log);
    log.forEach(addLog);
  }
  if (!b.over && b.kind === 'wild' && b.turn >= 35 && Math.random() < 0.2) {
    addLog('野生的 ' + b.foe.mons[b.foe.active].m.name + ' 被你的气势吓到，逃走了！');
    endBattle('run');
  }
}

function battleUseItem(itemName) {
  const b = STATE.battle;
  if (!b || b.over) return;
  const item = ITEMS[itemName];
  if (!item || bagCount(itemName) <= 0) { addLog('没有这个道具……'); return; }
  const p = b.player;
  const f = b.foe;
  const pm = p.mons[p.active];
  const fm = f.mons[f.active];
  if (item.type === 'ball') {
    if (b.kind !== 'wild') { addLog('训练家的宝可梦不能捕捉！'); return; }
    removeItem(itemName, 1);
    addLog('你扔出了【' + itemName + '】！');
    const a = Math.min(255, Math.floor(((3 * fm.m.stats.hp - 2 * fm.m.hp) * fm.m.speciesData.catchRate * item.ballMult) / (3 * fm.m.stats.hp)));
    let statusMult = 1;
    if (fm.m.status === '睡眠' || fm.m.status === '冰冻') statusMult = 2;
    else if (['麻痹', '中毒', '灼伤', '剧毒'].indexOf(fm.m.status) !== -1) statusMult = 1.5;
    const finalA = Math.floor(a * statusMult);
    const chance = finalA >= 255 ? 1 : Math.pow(finalA / 255, 0.75);
    if (Math.random() < chance) {
      addLog('太棒了！' + fm.m.name + ' 被收服了！');
      addToPartyOrBox(fm.m);
      STATE.caughtDex[fm.m.species] = true;
      STATE.battle.over = true;
      STATE.battle.outcome = 'caught';
      STATE.screen = 'map';
      return;
    }
    addLog('哦不！' + fm.m.name + ' 挣脱了精灵球！');
    const fMove = pickFoeMove(fm, pm);
    const log = [];
    if (fm.m.hp > 0 && pm.m.hp > 0) useMove(fm, pm, fMove, log);
    log.forEach(addLog);
    if (!b.over) { endOfTurn(log); log.forEach(addLog); handleFaints(log); log.forEach(addLog); }
    return;
  }
  if (item.type === 'heal' || item.type === 'cure') {
    removeItem(itemName, 1);
    if (item.heal === 'full') {
      pm.m.hp = pm.m.stats.hp;
      pm.m.status = null;
      addLog(pm.m.name + ' 完全恢复了！');
    } else if (item.heal) {
      const healed = Math.min(pm.m.stats.hp - pm.m.hp, item.heal);
      pm.m.hp += healed;
      addLog(pm.m.name + ' 回复了 ' + healed + ' 点HP！');
    } else if (item.cure && pm.m.status === item.cure) {
      pm.m.status = null;
      addLog(pm.m.name + ' 的' + item.cure + '被治好了！');
    } else {
      addLog('但是没有效果……');
    }
    const fMove = pickFoeMove(fm, pm);
    const log = [];
    if (fm.m.hp > 0 && pm.m.hp > 0) useMove(fm, pm, fMove, log);
    log.forEach(addLog);
    if (!b.over) { endOfTurn(log); log.forEach(addLog); handleFaints(log); log.forEach(addLog); }
    return;
  }
  addLog('这个道具不能在这里使用。');
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
  if (pm.trapTurns > 0) { addLog(pm.m.name + ' 被火焰困住，无法替换！'); return; }
  p.active = idx;
  addLog('回来吧！上吧，' + target.m.name + '！');
  const fm = f.mons[f.active];
  const fMove = pickFoeMove(fm, target);
  const log = [];
  if (fm.m.hp > 0 && target.m.hp > 0) useMove(fm, target, fMove, log);
  log.forEach(addLog);
  if (!b.over) { endOfTurn(log); log.forEach(addLog); handleFaints(log); log.forEach(addLog); }
}

function battleRun() {
  const b = STATE.battle;
  if (!b || b.over) return;
  if (!b.canRun) { addLog('不能逃跑！'); return; }
  addLog('你成功逃走了！');
  b.over = true;
  b.outcome = 'run';
  STATE.lastResult = 'run';
  STATE.screen = 'map';
  STATE.battle = null;
}

function endBattle(outcome) {
  const b = STATE.battle;
  if (!b) return;
  b.over = true;
  b.outcome = outcome;
  STATE.lastResult = outcome;
  STATE.screen = 'map';
  if (outcome === 'win') {
    if (b.prize > 0) {
      STATE.money += b.prize;
      addLog('获得了 ' + b.prize + ' 金币！');
    }
    if (b.trainerId) STATE.trainersDefeated[b.trainerId] = true;
    if (b.rewardItem) {
      addItem(b.rewardItem, 1);
      addLog('获得了道具【' + b.rewardItem + '】！');
    }
    if (b.rewardMon) {
      const lv = MAP_NODES[STATE.nodeId].levels ? MAP_NODES[STATE.nodeId].levels[1] : 10;
      const mon = makeMon(b.rewardMon, lv);
      addToPartyOrBox(mon);
      STATE.caughtDex[b.rewardMon] = true;
      addLog(b.rewardMonName || (mon.name + ' 加入了你的队伍！'));
    }
    if (b.badge) {
      if (STATE.badges.indexOf(b.badge) === -1) {
        STATE.badges.push(b.badge);
        addLog('获得了道馆徽章【' + b.badge + '】！');
      }
    }
    if (b.tm) {
      addItem('TM' + b.tm, 1);
      addLog('获得了【TM' + b.tm + '】！');
    }
    if (b.kind === 'rival' && b.rivalStep) {
      STATE.rivalWon.push(b.rivalStep);
      addLog('小茂：哼，这次算你赢了！下次可不会这么简单！');
    }
    const gym = MAP_NODES[STATE.nodeId] && MAP_NODES[STATE.nodeId].gym;
    if (b.kind === 'gym' && gym && gym.winText) addLog(gym.leader + '：' + gym.winText);
  } else if (outcome === 'lose') {
    if (b.kind === 'rocket_robbery') {
      const lost = Math.floor(STATE.money / 2);
      STATE.money -= lost;
      addLog('火箭队抢走了你 ' + lost + ' 金币！');
      const keys = Object.keys(STATE.bag).filter(function (k) {
        return ['精灵球', '伤药', '解毒药', '解麻药', '穿绳'].indexOf(k) === -1;
      });
      if (keys.length > 0) {
        const stolen = keys[randInt(0, keys.length - 1)];
        removeItem(stolen, 1);
        addLog('火箭队还抢走了你的【' + stolen + '】！');
      }
    }
    addLog('眼前一黑……你回到了 ' + MAP_NODES[STATE.lastTown].name + ' 的宝可梦中心。');
    healAll();
    STATE.nodeId = STATE.lastTown;
    STATE.weather = rollWeather(STATE.lastTown);
    STATE.wanderUsed = false;
  }
  if (b.kind === 'gym_apprentice' && STATE.gymSession && outcome === 'win') {
    STATE.gymSession.step++;
    addLog('你击败了道馆学徒！但连战还在继续，宝可梦们来不及休息……');
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
  if (STATE.party.length < 6) STATE.party.push(mon);
  else STATE.box.push(mon);
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
  STATE.weather = rollWeather(nodeId);
  if (node.type === 'town') STATE.lastTown = nodeId;
  if (node.type === 'town') STATE.wanderUsed = false;
  addLog('你来到了 ' + node.name + '。');
  if (node.desc) addLog(node.desc);
  const rival = rivalTriggerFor(nodeId);
  if (rival) startRivalBattle(rival);
}

function exploreOnce() {
  const node = MAP_NODES[STATE.nodeId];
  if (node.type === 'town') {
    addLog('城镇里没有草丛，去野外探索吧！');
    return;
  }
  refreshWeather(false);
  // 雷阵雨落雷事件
  if (STATE.weather === '雷阵雨' && node.thunderEvent && Math.random() < node.thunderEvent.chance) {
    addLog(node.thunderEvent.text);
    const active = STATE.party.find(function (m) { return m.hp > 0; });
    if (active) {
      const dmg = Math.max(1, Math.floor(active.stats.hp * 0.1));
      active.hp -= dmg;
      addLog(active.name + ' 受到了 ' + dmg + ' 点伤害！');
    }
    addItem('雷之石', 1);
    addLog('你捡到了【雷之石】！');
    return;
  }
  const r = randInt(1, 100);
  if (r <= 55) {
    const pool = node.pools[STATE.weather] || node.pools['晴'];
    const pick = pickWeighted(pool);
    const level = randInt(node.levels[0], node.levels[1]);
    addLog('你在草丛中发现了野生的 ' + POKEDEX[pick.id].name + '！');
    startWildBattle(pick.id, level);
    return;
  }
  if (r <= 70) {
    const undefeated = (node.trainers || []).filter(function (t) { return !STATE.trainersDefeated[t.id]; });
    if (undefeated.length === 0) {
      addLog('草丛里安安静静的，没有训练家来挑战。');
      return;
    }
    const trainer = undefeated[randInt(0, undefeated.length - 1)];
    addLog('草丛里突然窜出一个' + trainer.title + '！');
    startTrainerBattle(trainer);
    return;
  }
  if (r <= 73) {
    const gifts = ['伤药', '精灵球', '解毒药', '解麻药'];
    const item = gifts[randInt(0, gifts.length - 1)];
    addItem(item, 1);
    addLog('你捡到了【' + item + '】！');
    return;
  }
  if (r <= 85) {
    addLog('草丛里风平浪静，什么都没有发生……');
    return;
  }
  if (r <= 91) {
    startRocketBattle('robbery');
    return;
  }
  if (r <= 95) {
    const ev = ROCKET_EVENTS.sell;
    if (STATE.money < ev.price) {
      addLog(ev.text + ' 但你的钱不够，小兵骂骂咧咧地走了。');
      return;
    }
    addLog(ev.text);
    addLog('（可以付钱买下，也可以不理他）');
    STATE.rocketSell = true;
    return;
  }
  if (r <= 97) {
    startRocketBattle('rescue');
    return;
  }
  addLog('周围很安静，看来今天运气一般。');
}

function explore() {
  exploreOnce();
  if (!STATE.battle && !STATE.townTrade && !STATE.rocketSell &&
      STATE.keyItems.indexOf('自行车') !== -1 && Math.random() < 0.3) {
    addLog('骑着自行车，你很快来到了另一片草丛！');
    exploreOnce();
  }
}

// ---------- 钓鱼（破旧钓竿） ----------

function fish() {
  const node = MAP_NODES[STATE.nodeId];
  if (!node.water) { addLog('这里没有水域，钓不了鱼。'); return; }
  if (STATE.keyItems.indexOf('破旧钓竿') === -1) { addLog('你没有钓竿……去华蓝市找找看吧。'); return; }
  const r = Math.random();
  let id = 129;
  if (r >= 0.7 && r < 0.95) id = 120;
  else if (r >= 0.95 && r < 0.99) id = 147;
  else if (r >= 0.99) id = 130;
  const level = node.levels[0] + randInt(0, 2);
  addLog('水面泛起了波纹……上钩了！是野生的 ' + POKEDEX[id].name + '！');
  startWildBattle(id, level);
}

function resolveRocketSell(pay) {
  const ev = ROCKET_EVENTS.sell;
  if (pay) {
    if (STATE.money < ev.price) { addLog('钱不够……'); return; }
    STATE.money -= ev.price;
    addLog('你付了 ' + ev.price + ' 金币，接过了一个精灵球。');
    if (Math.random() < 0.5) {
      const monId = ev.rare[randInt(0, ev.rare.length - 1)];
      const lv = MAP_NODES[STATE.nodeId].levels ? MAP_NODES[STATE.nodeId].levels[1] : 10;
      const mon = makeMon(monId, lv);
      addToPartyOrBox(mon);
      STATE.caughtDex[monId] = true;
      addLog('球里装的居然是 ' + mon.name + '！赚翻了！');
    } else {
      const mon = makeMon(ev.junk, 5);
      addToPartyOrBox(mon);
      STATE.caughtDex[ev.junk] = true;
      addLog('球里是一条鲤鱼王……「嘻嘻，谢啦冤大头！」火箭队小兵跑没影了。');
    }
  } else {
    addLog('你转身就走，火箭队小兵在后面喊：「不识货的家伙！」');
  }
  STATE.rocketSell = false;
}

function visitCenter() {
  healAll();
  addLog('宝可梦中心的乔伊小姐把你的宝可梦都恢复了！');
}

function healAll() {
  STATE.party.forEach(function (m) {
    m.hp = m.stats.hp;
    m.status = null;
    m.statusTurns = 0;
  });
}

// 设置队伍首发：把指定宝可梦移到队首，战斗默认先派出
function setLeadMon(idx) {
  if (!STATE.party[idx]) { addLog('这只宝可梦不存在。'); return; }
  const mon = STATE.party[idx];
  STATE.party.splice(idx, 1);
  STATE.party.unshift(mon);
  addLog(mon.name + ' 被设为队伍首发！');
}

function getMartStock() {
  return MART_STOCK.filter(function (s) { return s.minBadges <= STATE.badges.length; }).map(function (s) { return s.name; });
}

function buyItem(name) {
  const item = ITEMS[name];
  if (!item) return;
  const stock = getMartStock();
  if (stock.indexOf(name) === -1) { addLog('商店里没有这个商品。'); return; }
  if (STATE.money < item.price) { addLog('金币不够……'); return; }
  STATE.money -= item.price;
  addItem(name, 1);
  addLog('购买了【' + name + '】，花费 ' + item.price + ' 金币。');
}

function sellItem(name) {
  if (bagCount(name) <= 0) { addLog('没有这个道具。'); return; }
  const item = ITEMS[name];
  const price = item.sell || Math.floor((item.price || 0) / 2);
  if (price <= 0) { addLog('这个道具不能卖。'); return; }
  removeItem(name, 1);
  STATE.money += price;
  addLog('卖掉了【' + name + '】，获得 ' + price + ' 金币。');
}

function wanderTown() {
  if (MAP_NODES[STATE.nodeId].type !== 'town') { addLog('这里不是城镇。'); return; }
  if (STATE.wanderUsed) {
    const r = randInt(1, 100);
    if (r <= 40) addLog('镇上的居民都认识你了，热情地打着招呼。');
    else if (r <= 70) addLog('你悠闲地在镇上逛了一圈，今天没什么特别的事。');
    else addLog('远处传来宝可梦的叫声，镇上依然平静。');
    return;
  }
  STATE.wanderUsed = true;
  // 关键道具：常磐市自行车店
  if (STATE.nodeId === 'viridian' && STATE.keyItems.indexOf('自行车') === -1 && Math.random() < 0.5) {
    STATE.keyItems.push('自行车');
    addLog('常磐市的自行车店老板送你一辆【自行车】！野外探索时骑行更快！');
    return;
  }
  // 关键道具：华蓝市钓鱼大叔
  if (STATE.nodeId === 'cerulean' && STATE.keyItems.indexOf('破旧钓竿') === -1 && Math.random() < 0.4) {
    STATE.keyItems.push('破旧钓竿');
    addLog('华蓝市的钓鱼大叔看你顺眼，送了你一根【破旧钓竿】！去水边试试吧！');
    return;
  }
  // 垃圾桶寻宝：电气球（华蓝市，每档一次）
  if (STATE.nodeId === 'cerulean' && !STATE.heldObtained && Math.random() < 0.25) {
    addItem('电气球', 1);
    STATE.heldObtained = true;
    addLog('你在华蓝市的垃圾桶后面翻出了【电气球】！只有皮卡丘能携带它。');
    return;
  }
  // 垃圾桶寻宝：吃剩的东西（每档一次）
  if (!STATE.trashFound && Math.random() < 0.08) {
    STATE.trashFound = true;
    addItem('吃剩的东西', 1);
    addLog('你在垃圾桶后面翻出了【吃剩的东西】！听说携带它每回合能恢复HP。');
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
    addLog('热心居民送了你一个【' + item + '】！');
  } else if (r <= 50) {
    addLog('你在镇子里闲逛，看到一只野猫在追波波……');
  } else if (r <= 70) {
    addLog('你听到了远处传来的宝可梦叫声，听起来像是一只皮卡丘。');
  } else {
    addLog('镇上很平静，大家都在过着安稳的日子。');
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
    addLog('一位居民想和你交换宝可梦，但你手里没有他想要的 ' + POKEDEX[t.want].name + '。');
    return;
  }
  STATE.townTrade = t;
  addLog('一位居民拦住你：「我用 ' + POKEDEX[t.give].name + ' 换你的 ' + POKEDEX[t.want].name + '，怎么样？」');
}

function doTownTrade(accept) {
  const t = STATE.townTrade;
  if (!t) return;
  STATE.townTrade = null;
  if (!accept) { addLog('你婉拒了这次交换。'); return; }
  const idx = STATE.party.findIndex(function (m) { return m.species === t.want; });
  if (idx === -1) { addLog('你手里没有 ' + POKEDEX[t.want].name + '。'); return; }
  const level = STATE.party[idx].level;
  const mon = makeMon(t.give, level);
  mon.tradeBonus = true;
  STATE.party[idx] = mon;
  addLog('交换成功！' + mon.name + ' 加入了你的队伍（交换来的宝可梦经验获取 1.5 倍）！');
}

function useEscapeRope() {
  if (bagCount('穿绳') <= 0) { addLog('没有穿绳。'); return; }
  removeItem('穿绳', 1);
  STATE.nodeId = STATE.lastTown;
  STATE.weather = rollWeather(STATE.lastTown);
  addLog('你使用穿绳瞬间回到了 ' + MAP_NODES[STATE.lastTown].name + '！');
}

function useBagItemOnMon(itemName, partyIdx) {
  const item = ITEMS[itemName];
  const mon = STATE.party[partyIdx];
  if (!item || !mon) return;
  if (bagCount(itemName) <= 0) { addLog('没有这个道具。'); return; }
  if (item.type === 'heal') {
    removeItem(itemName, 1);
    if (item.heal === 'full') { mon.hp = mon.stats.hp; mon.status = null; addLog(mon.name + ' 完全恢复了！'); }
    else {
      const healed = Math.min(mon.stats.hp - mon.hp, item.heal);
      if (healed <= 0) { addLog(mon.name + ' 的HP是满的！'); addItem(itemName, 1); return; }
      mon.hp += healed;
      addLog(mon.name + ' 回复了 ' + healed + ' 点HP！');
    }
    return;
  }
  if (item.type === 'cure') {
    if (mon.status !== item.cure) { addLog(mon.name + ' 没有' + item.cure + '状态。'); return; }
    removeItem(itemName, 1);
    mon.status = null;
    addLog(mon.name + ' 的' + item.cure + '被治好了！');
    return;
  }
  if (item.type === 'stone') {
    const evoLog = tryStoneEvolution(mon, item.stone);
    if (!evoLog) { addLog(itemName + ' 对 ' + mon.name + ' 没有效果。'); return; }
    removeItem(itemName, 1);
    evoLog.forEach(addLog);
    return;
  }
  if (item.type === 'tm') {
    removeItem(itemName, 1);
    const mv = MOVES[item.move];
    const log = [];
    tryLearnMove(mon, item.move, log, false);
    if (log.length === 0) {
      addLog(mon.name + ' 已经会【' + mv.name + '】了。');
      addItem(itemName, 1);
    } else {
      log.forEach(addLog);
    }
    return;
  }
  if (item.type === 'held') {
    if (mon.species !== 25) { addLog('只有皮卡丘才能携带电气球！'); return; }
    if (mon.held === '电气球') { addLog(mon.name + ' 已经携带着电气球。'); return; }
    removeItem(itemName, 1);
    mon.held = '电气球';
    addLog(mon.name + ' 携带了电气球，攻击与特攻翻倍！');
    return;
  }
  addLog('这个道具不能对宝可梦使用。');
}

// ---------------- 新游戏 / 存档 ----------------

function newGame(starterId) {
  const mon = makeMon(starterId, 5);
  STATE.screen = 'map';
  STATE.nodeId = 'pallet';
  STATE.weather = '晴';
  STATE.money = 3000;
  STATE.bag = {};
  Object.keys(START_ITEMS).forEach(function (k) { STATE.bag[k] = START_ITEMS[k]; });
  STATE.badges = [];
  STATE.party = [mon];
  STATE.box = [];
  STATE.log = [];
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
  STATE.seenDex[starterId] = true;
  addLog('大木博士：好！从今天起你就是宝可梦训练家了！');
  addLog('你带着 ' + mon.name + ' 从真新镇出发了！');
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
      bag: STATE.bag,
      badges: STATE.badges,
      party: STATE.party.map(serializeMon),
      box: STATE.box.map(serializeMon),
      seenDex: STATE.seenDex,
      caughtDex: STATE.caughtDex,
      trainersDefeated: STATE.trainersDefeated,
      lastTown: STATE.lastTown,
      heldObtained: STATE.heldObtained,
      keyItems: STATE.keyItems,
      rivalWon: STATE.rivalWon,
      trashFound: STATE.trashFound
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) { /* 存档失败静默处理 */ }
}

function serializeMon(m) {
  return {
    species: m.species, level: m.level, exp: m.exp, hp: m.hp,
    status: m.status, statusTurns: m.statusTurns, ivs: m.ivs, moves: m.moves,
    nature: m.nature, held: m.held, tradeBonus: !!m.tradeBonus
  };
}

function deserializeMon(d) {
  const mon = makeMon(d.species, d.level, { iv: d.ivs });
  mon.exp = d.exp;
  mon.hp = d.hp;
  mon.status = d.status;
  mon.statusTurns = d.statusTurns || 0;
  mon.moves = (d.moves || []).filter(function (id) { return MOVES[id]; }).slice(0, 4);
  if (mon.moves.length === 0) mon.moves = ['tackle'];
  mon.nature = d.nature || '勤奋';
  mon.held = d.held || null;
  mon.tradeBonus = !!d.tradeBonus;
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
    STATE.bag = data.bag || {};
    STATE.badges = data.badges || [];
    STATE.party = (data.party || []).map(deserializeMon);
    STATE.box = (data.box || []).map(deserializeMon);
    STATE.seenDex = data.seenDex || {};
    STATE.caughtDex = data.caughtDex || {};
    STATE.trainersDefeated = data.trainersDefeated || {};
    STATE.lastTown = data.lastTown || 'pallet';
    STATE.heldObtained = !!data.heldObtained;
    STATE.keyItems = data.keyItems || [];
    STATE.rivalWon = data.rivalWon || [];
    STATE.trashFound = !!data.trashFound;
    STATE.battle = null;
    STATE.pendingLearn = [];
    STATE.log = [];
    STATE.rocketSell = false;
    STATE.gymSession = null;
    STATE.townTrade = null;
    STATE.wanderUsed = false;
    addLog('欢迎回来，' + (data.name || '训练家') + '！存档读取成功。');
    return true;
  } catch (e) {
    return false;
  }
}

function resetGame() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  STATE.battle = null;
  STATE.pendingLearn = [];
  STATE.rocketSell = false;
  STATE.lastResult = null;
  STATE.gymSession = null;
  STATE.townTrade = null;
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
    startRivalBattle: startRivalBattle, getRivalStarter: getRivalStarter,
    setLeadMon: setLeadMon,
    makeMon: makeMon, calcDamage: calcDamage, expToNext: expToNext, healAll: healAll,
    grantExp: grantExp, checkEvolution: checkEvolution, tryLearnMove: tryLearnMove,
    tryStoneEvolution: tryStoneEvolution, startBattle: startBattle, typeEffectiveness: typeEffectiveness,
    expForLevel: expForLevel, getBattleWeather: getBattleWeather, endBattle: endBattle
  };
}
