/* 生成补充图鉴 js/data/pokedex_gen.js
   数据源：PokeAPI 官方 CSV（/tmp/pokeapi/*.csv）
   用法: node test/gen_dex.js
   说明：已精选的手工条目原样保留，缺失的按官方种族值/属性/成长/捕获率生成，
         学习面为按首属性模板自动生成（后续可再按官方逐只校对）
   Created by haodongsheng */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const CSV_DIR = '/tmp/pokeapi';
function readCsv(name) {
  const raw = fs.readFileSync(path.join(CSV_DIR, name + '.csv'), 'utf8').trim().split('\n');
  const header = raw.shift().split(',');
  return raw.map(function (line) {
    const cols = line.split(',');
    const o = {};
    header.forEach(function (h, i) { o[h] = cols[i]; });
    return o;
  });
}

const pokemon = readCsv('pokemon');
const species = readCsv('pokemon_species');
const speciesNames = readCsv('pokemon_species_names');
const stats = readCsv('pokemon_stats');
const pokeTypes = readCsv('pokemon_types');
const types = readCsv('types');

// 中文名（language 12 = zh-Hans；CSV 覆盖不全，用官方中文名表兜底）
const zhNames = {};
speciesNames.forEach(function (r) {
  if (r.local_language_id === '12') zhNames[r.pokemon_species_id] = r.name;
});

const NAME_FALLBACK = {
  1: '妙蛙种子', 2: '妙蛙草', 3: '妙蛙花', 4: '小火龙', 5: '火恐龙', 6: '喷火龙',
  7: '杰尼龟', 8: '卡咪龟', 9: '水箭龟', 10: '绿毛虫', 11: '铁甲蛹', 12: '巴大蝶',
  13: '独角虫', 14: '铁壳蛹', 15: '大针蜂', 16: '波波', 17: '比比鸟', 18: '大比鸟',
  19: '小拉达', 20: '拉达', 21: '烈雀', 22: '大嘴雀', 23: '阿柏蛇', 24: '阿柏怪',
  25: '皮卡丘', 26: '雷丘', 27: '穿山鼠', 28: '穿山王', 29: '尼多兰', 30: '尼多娜',
  31: '尼多后', 32: '尼多朗', 33: '尼多力诺', 34: '尼多王', 35: '皮皮', 36: '皮可西',
  37: '六尾', 38: '九尾', 39: '胖丁', 40: '胖可丁', 41: '超音蝠', 42: '大嘴蝠',
  43: '走路草', 44: '臭臭花', 45: '霸王花', 46: '派拉斯', 47: '派拉斯特', 48: '毛球',
  49: '摩鲁蛾', 50: '地鼠', 51: '三地鼠', 52: '喵喵', 53: '猫老大', 54: '可达鸭',
  55: '哥达鸭', 56: '猴怪', 57: '火暴猴', 58: '卡蒂狗', 59: '风速狗', 60: '蚊香蝌蚪',
  61: '蚊香君', 62: '蚊香泳士', 63: '凯西', 64: '勇基拉', 65: '胡地', 66: '腕力',
  67: '豪力', 68: '怪力', 69: '喇叭芽', 70: '口呆花', 71: '大食花', 72: '玛瑙水母',
  73: '毒刺水母', 74: '小拳石', 75: '隆隆石', 76: '隆隆岩', 77: '小火马', 78: '烈焰马',
  79: '呆呆兽', 80: '呆壳兽', 81: '小磁怪', 82: '三合一磁怪', 83: '大葱鸭', 84: '嘟嘟',
  85: '嘟嘟利', 86: '小海狮', 87: '白海狮', 88: '臭泥', 89: '臭臭泥', 90: '大舌贝',
  91: '刺甲贝', 92: '鬼斯', 93: '鬼斯通', 94: '耿鬼', 95: '大岩蛇', 96: '素利普',
  97: '素利拍', 98: '大钳蟹', 99: '巨钳蟹', 100: '雷电球', 101: '顽皮雷弹', 102: '蛋蛋',
  103: '椰蛋树', 104: '卡拉卡拉', 105: '嘎啦嘎啦', 106: '飞腿郎', 107: '快拳郎', 108: '大舌头',
  109: '瓦斯弹', 110: '双弹瓦斯', 111: '铁甲犀牛', 112: '铁甲暴龙', 113: '吉利蛋', 114: '蔓藤怪',
  115: '袋兽', 116: '墨海马', 117: '海刺龙', 118: '角金鱼', 119: '金鱼王', 120: '海星星',
  121: '宝石海星', 122: '魔墙人偶', 123: '飞天螳螂', 124: '迷唇姐', 125: '电击兽', 126: '鸭嘴火兽',
  127: '凯罗斯', 128: '肯泰罗', 129: '鲤鱼王', 130: '暴鲤龙', 131: '拉普拉斯', 132: '百变怪',
  133: '伊布', 134: '水伊布', 135: '雷伊布', 136: '火伊布', 137: '多边兽', 138: '菊石兽',
  139: '多刺菊石兽', 140: '化石盔', 141: '镰刀盔', 142: '化石翼龙', 143: '卡比兽', 144: '急冻鸟',
  145: '闪电鸟', 146: '火焰鸟', 147: '迷你龙', 148: '哈克龙', 149: '快龙', 150: '超梦', 151: '梦幻'
};

const typeEn2Zh = {
  normal: '普通', fire: '火', water: '水', electric: '电', grass: '草',
  ice: '冰', fighting: '格斗', poison: '毒', ground: '地面', flying: '飞行',
  psychic: '超能力', bug: '虫', rock: '岩石', ghost: '幽灵', dragon: '龙',
  dark: '恶', steel: '钢', fairy: '妖精'
};
const typeId2En = {};
types.forEach(function (r) { typeId2En[r.id] = r.identifier; });

const speciesTypes = {};
pokeTypes.forEach(function (r) {
  if (!speciesTypes[r.pokemon_id]) speciesTypes[r.pokemon_id] = [];
  speciesTypes[r.pokemon_id].push(typeEn2Zh[typeId2En[r.type_id]] || '普通');
});

const speciesStats = {};
stats.forEach(function (r) {
  if (!speciesStats[r.pokemon_id]) speciesStats[r.pokemon_id] = {};
  const key = { 1: 'hp', 2: 'atk', 3: 'def', 4: 'spa', 5: 'spd', 6: 'spe' }[r.stat_id];
  if (key) speciesStats[r.pokemon_id][key] = parseInt(r.base_stat, 10);
});

const speciesInfo = {};
species.forEach(function (r) {
  speciesInfo[r.id] = {
    growth: { 1: 'slow', 2: 'medium_fast', 3: 'fast', 4: 'medium_slow', 5: 'fast', 6: 'medium_slow' }[r.growth_rate_id] || 'medium_fast',
    captureRate: parseInt(r.capture_rate, 10) || 45,
    evolvesFrom: r.evolves_from_species_id ? parseInt(r.evolves_from_species_id, 10) : null,
    color: { 1: '#3b3b3b', 2: '#4a90d0', 3: '#a8783f', 4: '#9b9b9b', 5: '#58c25c', 6: '#f0a0c0', 7: '#a068c8', 8: '#e8484f', 9: '#e8e6d8', 10: '#f8d030' }[r.color_id] || '#9b9b9b'
  };
});

// 经验产出：使用 species 对应默认形态的 base_experience
const expYield = {};
pokemon.forEach(function (r) {
  if (r.is_default === '1' && !expYield[r.species_id]) expYield[r.species_id] = parseInt(r.base_experience, 10) || 60;
});

// 石头进化覆盖
const STONE_EVO = {
  37: [38, '火之石'],   // 六尾 → 九尾
  58: [59, '火之石'],   // 卡蒂狗 → 风速狗
  90: [91, '水之石'],   // 大舌贝 → 刺甲贝
  79: [80, '水之石']    // 呆呆兽 → 呆壳兽
};

// 首属性学习面模板（招式用 ID，简化版，后续按官方校对）
const TEMPLATES = {
  '火': { 1: ['tackle', 'growl'], 10: ['ember'], 20: ['flamethrower'], 30: ['fire_spin'], 40: ['sunny_day'], 50: ['overheat'] },
  '水': { 1: ['tackle', 'tail_whip'], 10: ['water_gun'], 20: ['bubble_beam'], 30: ['surf'], 40: ['rain_dance'], 50: ['hydro_pump'] },
  '草': { 1: ['absorb', 'growl'], 10: ['vine_whip'], 20: ['razor_leaf'], 30: ['sleep_powder'], 40: ['solar_beam'], 50: ['giga_drain'] },
  '电': { 1: ['thundershock', 'growl'], 10: ['quick_attack'], 20: ['thunderbolt'], 30: ['thunder_wave'], 40: ['agility'], 50: ['thunder'] },
  '普通': { 1: ['tackle', 'growl'], 10: ['quick_attack'], 20: ['take_down'], 30: ['swords_dance'], 40: ['double_edge'], 50: ['hyper_beam'] },
  '飞行': { 1: ['peck', 'growl'], 10: ['gust'], 20: ['wing_attack'], 30: ['aerial_ace'], 40: ['agility'], 50: ['hyper_beam'] },
  '虫': { 1: ['poison_sting', 'string_shot'], 10: ['fury_swipes'], 20: ['twineedle'], 30: ['pin_missile'], 40: ['swords_dance'], 50: ['bug_bite'] },
  '毒': { 1: ['poison_sting', 'growl'], 10: ['acid'], 20: ['sludge_bomb'], 30: ['toxic'], 40: ['shadow_ball'], 50: ['hyper_beam'] },
  '地面': { 1: ['scratch', 'growl'], 10: ['dig'], 20: ['rock_slide'], 30: ['earthquake'], 40: ['sandstorm'], 50: ['double_edge'] },
  '岩石': { 1: ['tackle', 'harden'], 10: ['rock_throw'], 20: ['rock_tomb'], 30: ['rock_slide'], 40: ['sandstorm'], 50: ['earthquake'] },
  '格斗': { 1: ['tackle', 'leer'], 10: ['karate_chop'], 20: ['double_kick'], 30: ['brick_break'], 40: ['swords_dance'], 50: ['double_edge'] },
  '超能力': { 1: ['confusion', 'growl'], 10: ['psybeam'], 20: ['psychic'], 30: ['calm_mind'], 40: ['agility'], 50: ['hyper_beam'] },
  '幽灵': { 1: ['lick', 'growl'], 10: ['night_shade'], 20: ['shadow_ball'], 30: ['confuse_ray'], 40: ['dream_eater'], 50: ['hyper_beam'] },
  '冰': { 1: ['tackle', 'growl'], 10: ['ice_beam'], 20: ['blizzard'], 30: ['ice_punch'], 40: ['agility'], 50: ['hyper_beam'] },
  '龙': { 1: ['tackle', 'leer'], 10: ['dragon_breath'], 20: ['dragon_rage'], 30: ['dragon_breath'], 40: ['outrage'], 50: ['hyper_beam'] },
  '恶': { 1: ['bite', 'growl'], 10: ['pursuit'], 20: ['crunch'], 30: ['confuse_ray'], 40: ['swords_dance'], 50: ['hyper_beam'] },
  '钢': { 1: ['metal_claw', 'growl'], 10: ['steel_wing'], 20: ['iron_tail'], 30: ['harden'], 40: ['swords_dance'], 50: ['hyper_beam'] }
};

// 读取已精选的 POKEDEX
const src = fs.readFileSync(path.join(__dirname, '..', 'js/data/pokedex.js'), 'utf8');
const sandbox = { module: { exports: {} }, console: console };
sandbox.exports = sandbox.module.exports;
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const curated = sandbox.module.exports.POKEDEX;

function learnsetFor(types) {
  const tmpl = TEMPLATES[types[0]] || TEMPLATES['普通'];
  const out = {};
  Object.keys(tmpl).forEach(function (lv) { out[lv] = tmpl[lv]; });
  return out;
}

function evoFor(id, info, allIds) {
  if (STONE_EVO[id]) return { into: STONE_EVO[id][0], stone: STONE_EVO[id][1] };
  const children = (childMap[id] || []).filter(function (c) { return c <= 151; });
  if (children.length === 0) return null;
  const level = info.evolvesFrom ? 36 : 20;
  return { into: children[0], level: level };
}

const childMap = {};
species.forEach(function (r) {
  const parent = parseInt(r.evolves_from_species_id, 10);
  const child = parseInt(r.id, 10);
  if (parent && !childMap[parent]) childMap[parent] = [];
  if (parent) childMap[parent].push(child);
});

const generated = {};
for (let id = 1; id <= 151; id++) {
  if (curated[id]) continue;
  const sid = String(id);
  const info = speciesInfo[sid];
  if (!info) continue;
  const base = speciesStats[sid];
  if (!base) continue;
  // 初代关都篇按 Gen3 规则：过滤掉 Gen6 才出现的妖精属性
  let types = (speciesTypes[sid] || ['普通']).filter(function (t) { return t !== '妖精'; });
  if (types.length === 0) types = ['普通'];
  generated[id] = {
    id: id,
    name: zhNames[sid] || NAME_FALLBACK[id] || ('宝可梦' + id),
    types: types,
    base: base,
    growth: info.growth,
    expYield: expYield[sid] || 60,
    catchRate: info.captureRate,
    color: info.color,
    evo: evoFor(id, info),
    learnset: learnsetFor(types)
  };
}

function q(s) { return "'" + s.replace(/'/g, "\\'") + "'"; }
function evoStr(e) {
  if (!e) return 'null';
  if (e.stone) return '{ into: ' + e.into + ', stone: ' + q(e.stone) + ' }';
  return '{ into: ' + e.into + ', level: ' + e.level + ' }';
}
function learnsetStr(ls) {
  const parts = Object.keys(ls).sort(function (a, b) { return a - b; })
    .map(function (lv) { return lv + ': [' + ls[lv].map(q).join(', ') + ']'; });
  return '{ ' + parts.join(', ') + ' }';
}

const lines = [
  '/* ============================================================',
  '   补充图鉴（PokeAPI CSV 自动生成，覆盖 1-151 中未手工精选的条目）',
  '   生成脚本: test/gen_dex.js · Created by haodongsheng',
  '   ============================================================ */',
  '',
  'const POKEDEX_GEN = {'
];
Object.keys(generated).forEach(function (id) {
  const d = generated[id];
  lines.push('  ' + id + ': { id: ' + d.id + ', name: ' + q(d.name) + ', types: [' + d.types.map(q).join(', ') + '], ' +
    'base: { hp: ' + d.base.hp + ', atk: ' + d.base.atk + ', def: ' + d.base.def + ', spa: ' + d.base.spa + ', spd: ' + d.base.spd + ', spe: ' + d.base.spe + ' }, ' +
    'growth: ' + q(d.growth) + ', expYield: ' + d.expYield + ', catchRate: ' + d.catchRate + ', color: ' + q(d.color) + ', evo: ' + evoStr(d.evo) + ', ' +
    'learnset: ' + learnsetStr(d.learnset) + ' },');
});
lines.push('};');
lines.push('');
lines.push('// 合并进主图鉴（保留手工精选条目的优先权）');
lines.push('for (const genId in POKEDEX_GEN) {');
lines.push('  if (!POKEDEX[genId]) POKEDEX[genId] = POKEDEX_GEN[genId];');
lines.push('}');
lines.push('');
lines.push("if (typeof module !== 'undefined' && module.exports) {");
lines.push('  module.exports = { POKEDEX: POKEDEX, POKEDEX_GEN: POKEDEX_GEN };');
lines.push('}');

const out = path.join(__dirname, '..', 'js/data/pokedex_gen.js');
fs.writeFileSync(out, lines.join('\n') + '\n');
console.log('生成 ' + Object.keys(generated).length + ' 只补充图鉴 -> ' + out);
