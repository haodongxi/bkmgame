/* 生成补充技能表 js/data/moves_gen.js
   数据源：PokeAPI 官方 CSV（/tmp/pokeapi/*.csv）
   用法: node test/gen_moves.js
   说明：生成 Gen1-3（move_id 1..354）全部招式；运行时合并时手工精选 moves.js 优先，
         字段为 id/名称/属性/物理特殊/威力/命中/PP；二次效果由手工条目单独维护。
   Created by haodongsheng */
const fs = require('fs');
const path = require('path');

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

const moves = readCsv('moves');
const moveNames = readCsv('move_names');
const types = readCsv('types');

const typeId2En = {};
types.forEach(function (r) { typeId2En[r.id] = r.identifier; });
const typeEn2Zh = {
  normal: '普通', fire: '火', water: '水', electric: '电', grass: '草',
  ice: '冰', fighting: '格斗', poison: '毒', ground: '地面', flying: '飞行',
  psychic: '超能力', bug: '虫', rock: '岩石', ghost: '幽灵', dragon: '龙',
  dark: '恶', steel: '钢', fairy: '妖精'
};
const CATEGORY = { '1': '变化', '2': '物理', '3': '特殊' };

const zhName = {};
moveNames.forEach(function (r) {
  if (r.local_language_id === '12') zhName[r.move_id] = r.name;
});

// Gen6 才引入妖精属性，以下 Gen1-3 招式在关都篇（Gen3）仍按普通系处理
const TYPE_OVERRIDE = {
  charm: '普通',
  moonlight: '普通',
  sweet_kiss: '普通'
};

const entries = [];
moves.forEach(function (r) {
  // Gen1-3 主系列招式 = move_id 1..354；10001+ 为《暗之旋风》影子招式，不在范围
  if (parseInt(r.id, 10) > 354) return;
  const id = (r.identifier || '').replace(/-/g, '_');
  if (!id) return;
  const power = r.power === '' ? 0 : parseInt(r.power, 10);
  const acc = r.accuracy === '' ? 0 : parseInt(r.accuracy, 10);
  const pp = parseInt(r.pp, 10) || 1;
  entries.push({
    id: id,
    name: zhName[r.id] || r.identifier,
    type: TYPE_OVERRIDE[id] || typeEn2Zh[typeId2En[r.type_id]] || '普通',
    category: CATEGORY[r.damage_class_id] || '变化',
    power: power,
    acc: acc,
    pp: pp
  });
});

entries.sort(function (a, b) { return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0); });

let out = '/* ============================================================\n' +
  '   补充技能表（PokeAPI 官方 CSV 自动生成，覆盖 Gen1-3 全部招式；合并时手工条目优先）\n' +
  '   生成脚本: test/gen_moves.js · Created by haodongsheng\n' +
  '   ============================================================ */\n\n' +
  'const MOVES_GEN = {\n';
entries.forEach(function (m) {
  out += '  ' + m.id + ': { id: \'' + m.id + '\', name: \'' + m.name + '\', type: \'' + m.type +
    '\', category: \'' + m.category + '\', power: ' + m.power + ', acc: ' + m.acc + ', pp: ' + m.pp + ' },\n';
});
out += '};\n\n' +
  '// 合并进主技能表（手工精选条目优先，仅补充缺失项）\n' +
  'for (const k in MOVES_GEN) {\n' +
  '  if (!MOVES[k]) MOVES[k] = MOVES_GEN[k];\n' +
  '}\n\n' +
  'if (typeof module !== \'undefined\' && module.exports) {\n' +
  '  module.exports = { MOVES_GEN: MOVES_GEN };\n' +
  '}\n';

fs.writeFileSync(path.join(__dirname, '..', 'js/data/moves_gen.js'), out);
console.log('生成 js/data/moves_gen.js：包含 Gen1-3 全部 ' + entries.length + ' 个招式（合并时手工条目优先）');
