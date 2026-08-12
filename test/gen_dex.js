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

// 中文名（language 12 = zh-Hans）
const zhNames = {};
speciesNames.forEach(function (r) {
  if (r.local_language_id === '12') zhNames[r.pokemon_species_id] = r.name;
});

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

// 首属性学习面模板（简化，后续按官方校对）
const TEMPLATES = {
  '火': { 1: ['撞击', '叫声'], 10: ['火花'], 20: ['喷射火焰'], 30: ['火焰旋涡'], 40: ['大晴天'], 50: ['过热'] },
  '水': { 1: ['撞击', '摇尾巴'], 10: ['水枪'], 20: ['泡沫光线'], 30: ['冲浪'], 40: ['祈雨'], 50: ['水炮'] },
  '草': { 1: ['吸取', '叫声'], 10: ['藤鞭'], 20: ['飞叶快刀'], 30: ['睡眠粉'], 40: ['日光束'], 50: ['百万吸取'] },
  '电': { 1: ['电击', '叫声'], 10: ['电光一闪'], 20: ['十万伏特'], 30: ['电磁波'], 40: ['高速移动'], 50: ['打雷'] },
  '普通': { 1: ['撞击', '叫声'], 10: ['电光一闪'], 20: ['猛撞'], 30: ['剑舞'], 40: ['舍身冲撞'], 50: ['破坏光线'] },
  '飞行': { 1: ['啄', '叫声'], 10: ['起风'], 20: ['翅膀攻击'], 30: ['燕返'], 40: ['高速移动'], 50: ['破坏光线'] },
  '虫': { 1: ['毒针', '吐丝'], 10: ['疯狂乱抓'], 20: ['双针'], 30: ['飞弹针'], 40: ['剑舞'], 50: ['虫咬'] },
  '毒': { 1: ['毒针', '叫声'], 10: ['溶解液'], 20: ['污泥炸弹'], 30: ['剧毒'], 40: ['暗影球'], 50: ['破坏光线'] },
  '地面': { 1: ['抓', '叫声'], 10: ['挖洞'], 20: ['岩崩'], 30: ['地震'], 40: ['沙暴'], 50: ['舍身冲撞'] },
  '岩石': { 1: ['撞击', '变硬'], 10: ['落石'], 20: ['岩石封锁'], 30: ['岩崩'], 40: ['沙暴'], 50: ['地震'] },
  '格斗': { 1: ['撞击', '瞪眼'], 10: ['空手劈'], 20: ['二连踢'], 30: ['劈瓦'], 40: ['剑舞'], 50: ['舍身冲撞'] },
  '超能力': { 1: ['念力', '叫声'], 10: ['幻象光线'], 20: ['精神强念'], 30: ['冥想'], 40: ['高速移动'], 50: ['破坏光线'] },
  '幽灵': { 1: ['舌舔', '叫声'], 10: ['黑夜魔影'], 20: ['暗影球'], 30: ['奇异之光'], 40: ['食梦'], 50: ['破坏光线'] },
  '冰': { 1: ['撞击', '叫声'], 10: ['冰冻光束'], 20: ['暴风雪'], 30: ['冰冻拳'], 40: ['高速移动'], 50: ['破坏光线'] },
  '龙': { 1: ['撞击', '瞪眼'], 10: ['龙息'], 20: ['龙之怒'], 30: ['龙息'], 40: ['逆鳞'], 50: ['破坏光线'] },
  '恶': { 1: ['咬住', '叫声'], 10: ['追击'], 20: ['咬碎'], 30: ['奇异之光'], 40: ['剑舞'], 50: ['破坏光线'] },
  '钢': { 1: ['金属爪', '叫声'], 10: ['钢翼'], 20: ['铁尾'], 30: ['变硬'], 40: ['剑舞'], 50: ['破坏光线'] }
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
    name: zhNames[sid] || ('宝可梦' + id),
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
