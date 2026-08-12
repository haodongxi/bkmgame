/* ============================================================
   技能表（Gen1-3 精选，字段：id/名称/属性/类别/威力/命中/PP/效果）
   命中 acc 为 0 表示必中；效果 effect 见 core.js 解析
   Created by haodongsheng
   ============================================================ */

const MOVES = {
  // ---------------- 普通 ----------------
  tackle: { id: 'tackle', name: '撞击', type: '普通', category: '物理', power: 40, acc: 100, pp: 35 },
  scratch: { id: 'scratch', name: '抓', type: '普通', category: '物理', power: 40, acc: 100, pp: 35 },
  growl: { id: 'growl', name: '叫声', type: '普通', category: '变化', power: 0, acc: 100, pp: 40, effect: { kind: 'stat', target: 'target', stat: 'atk', stage: -1, chance: 1 } },
  tail_whip: { id: 'tail_whip', name: '摇尾巴', type: '普通', category: '变化', power: 0, acc: 100, pp: 30, effect: { kind: 'stat', target: 'target', stat: 'def', stage: -1, chance: 1 } },
  leer: { id: 'leer', name: '瞪眼', type: '普通', category: '变化', power: 0, acc: 100, pp: 30, effect: { kind: 'stat', target: 'target', stat: 'def', stage: -1, chance: 1 } },
  quick_attack: { id: 'quick_attack', name: '电光一闪', type: '普通', category: '物理', power: 40, acc: 100, pp: 30, effect: { kind: 'priority' } },
  fury_swipes: { id: 'fury_swipes', name: '疯狂乱抓', type: '普通', category: '物理', power: 18, acc: 80, pp: 15, effect: { kind: 'multi', hits: '2-5' } },
  hyper_fang: { id: 'hyper_fang', name: '必杀门牙', type: '普通', category: '物理', power: 80, acc: 90, pp: 15, effect: { kind: 'flinch', chance: 0.1 } },
  body_slam: { id: 'body_slam', name: '泰山压顶', type: '普通', category: '物理', power: 85, acc: 100, pp: 15, effect: { kind: 'status', status: '麻痹', chance: 0.3 } },
  take_down: { id: 'take_down', name: '猛撞', type: '普通', category: '物理', power: 90, acc: 85, pp: 20, effect: { kind: 'recoil', ratio: 0.25 } },
  double_edge: { id: 'double_edge', name: '舍身冲撞', type: '普通', category: '物理', power: 120, acc: 100, pp: 15, effect: { kind: 'recoil', ratio: 0.33 } },
  hyper_beam: { id: 'hyper_beam', name: '破坏光线', type: '普通', category: '特殊', power: 150, acc: 90, pp: 5, effect: { kind: 'recharge' } },
  swords_dance: { id: 'swords_dance', name: '剑舞', type: '普通', category: '变化', power: 0, acc: 0, pp: 20, effect: { kind: 'stat', target: 'self', stat: 'atk', stage: 2, chance: 1 } },
  harden: { id: 'harden', name: '变硬', type: '普通', category: '变化', power: 0, acc: 0, pp: 30, effect: { kind: 'stat', target: 'self', stat: 'def', stage: 1, chance: 1 } },
  protect: { id: 'protect', name: '守住', type: '普通', category: '变化', power: 0, acc: 0, pp: 10, effect: { kind: 'protect' } },
  sing: { id: 'sing', name: '唱歌', type: '普通', category: '变化', power: 0, acc: 55, pp: 15, effect: { kind: 'status', status: '睡眠', chance: 1 } },
  fly: { id: 'fly', name: '飞空', type: '飞行', category: '物理', power: 90, acc: 95, pp: 15 },

  // ---------------- 火 ----------------
  ember: { id: 'ember', name: '火花', type: '火', category: '特殊', power: 40, acc: 100, pp: 25, effect: { kind: 'status', status: '灼伤', chance: 0.1 } },
  flamethrower: { id: 'flamethrower', name: '喷射火焰', type: '火', category: '特殊', power: 95, acc: 100, pp: 15, effect: { kind: 'status', status: '灼伤', chance: 0.1 } },
  fire_spin: { id: 'fire_spin', name: '火焰旋涡', type: '火', category: '特殊', power: 35, acc: 85, pp: 15, effect: { kind: 'trap' } },
  fire_punch: { id: 'fire_punch', name: '火焰拳', type: '火', category: '物理', power: 75, acc: 100, pp: 15, effect: { kind: 'status', status: '灼伤', chance: 0.1 } },
  overheat: { id: 'overheat', name: '过热', type: '火', category: '特殊', power: 140, acc: 90, pp: 5, effect: { kind: 'stat', target: 'self', stat: 'spa', stage: -2, chance: 1 } },
  sunny_day: { id: 'sunny_day', name: '大晴天', type: '火', category: '变化', power: 0, acc: 0, pp: 5, effect: { kind: 'weather', weather: '晴' } },
  sandstorm: { id: 'sandstorm', name: '沙暴', type: '岩石', category: '变化', power: 0, acc: 0, pp: 10, effect: { kind: 'weather', weather: '沙暴' } },

  // ---------------- 水 ----------------
  water_gun: { id: 'water_gun', name: '水枪', type: '水', category: '特殊', power: 40, acc: 100, pp: 25 },
  bubble: { id: 'bubble', name: '泡沫', type: '水', category: '特殊', power: 20, acc: 100, pp: 30, effect: { kind: 'stat', target: 'target', stat: 'spe', stage: -1, chance: 0.1 } },
  bubble_beam: { id: 'bubble_beam', name: '泡沫光线', type: '水', category: '特殊', power: 65, acc: 100, pp: 20, effect: { kind: 'stat', target: 'target', stat: 'spe', stage: -1, chance: 0.1 } },
  water_pulse: { id: 'water_pulse', name: '水之波动', type: '水', category: '特殊', power: 60, acc: 100, pp: 20, effect: { kind: 'confuse', chance: 0.2 } },
  surf: { id: 'surf', name: '冲浪', type: '水', category: '特殊', power: 95, acc: 100, pp: 15 },
  hydro_pump: { id: 'hydro_pump', name: '水炮', type: '水', category: '特殊', power: 120, acc: 80, pp: 5 },
  rain_dance: { id: 'rain_dance', name: '祈雨', type: '水', category: '变化', power: 0, acc: 0, pp: 5, effect: { kind: 'weather', weather: '雨' } },

  // ---------------- 电 ----------------
  thundershock: { id: 'thundershock', name: '电击', type: '电', category: '特殊', power: 40, acc: 100, pp: 30, effect: { kind: 'status', status: '麻痹', chance: 0.1 } },
  thunderbolt: { id: 'thunderbolt', name: '十万伏特', type: '电', category: '特殊', power: 90, acc: 100, pp: 15, effect: { kind: 'status', status: '麻痹', chance: 0.1 } },
  thunder: { id: 'thunder', name: '打雷', type: '电', category: '特殊', power: 110, acc: 70, pp: 10, effect: { kind: 'status', status: '麻痹', chance: 0.3 } },
  thunder_wave: { id: 'thunder_wave', name: '电磁波', type: '电', category: '变化', power: 0, acc: 100, pp: 20, effect: { kind: 'status', status: '麻痹', chance: 1 } },
  thunder_punch: { id: 'thunder_punch', name: '雷电拳', type: '电', category: '物理', power: 75, acc: 100, pp: 15, effect: { kind: 'status', status: '麻痹', chance: 0.1 } },

  // ---------------- 草 ----------------
  vine_whip: { id: 'vine_whip', name: '藤鞭', type: '草', category: '物理', power: 45, acc: 100, pp: 25 },
  razor_leaf: { id: 'razor_leaf', name: '飞叶快刀', type: '草', category: '物理', power: 55, acc: 95, pp: 25 },
  solar_beam: { id: 'solar_beam', name: '日光束', type: '草', category: '特殊', power: 120, acc: 100, pp: 10 },
  absorb: { id: 'absorb', name: '吸取', type: '草', category: '特殊', power: 20, acc: 100, pp: 25, effect: { kind: 'heal', ratio: 0.5 } },
  mega_drain: { id: 'mega_drain', name: '超级吸取', type: '草', category: '特殊', power: 40, acc: 100, pp: 15, effect: { kind: 'heal', ratio: 0.5 } },
  giga_drain: { id: 'giga_drain', name: '百万吸取', type: '草', category: '特殊', power: 60, acc: 100, pp: 10, effect: { kind: 'heal', ratio: 0.5 } },
  leech_seed: { id: 'leech_seed', name: '寄生种子', type: '草', category: '变化', power: 0, acc: 90, pp: 10, effect: { kind: 'leech' } },
  stun_spore: { id: 'stun_spore', name: '麻痹粉', type: '草', category: '变化', power: 0, acc: 75, pp: 30, effect: { kind: 'status', status: '麻痹', chance: 1 } },
  sleep_powder: { id: 'sleep_powder', name: '睡眠粉', type: '草', category: '变化', power: 0, acc: 75, pp: 15, effect: { kind: 'status', status: '睡眠', chance: 1 } },
  poison_powder: { id: 'poison_powder', name: '毒粉', type: '草', category: '变化', power: 0, acc: 75, pp: 35, effect: { kind: 'status', status: '中毒', chance: 1 } },
  synthesis: { id: 'synthesis', name: '光合作用', type: '草', category: '变化', power: 0, acc: 0, pp: 5, effect: { kind: 'heal', ratio: 0.5, self: true } },

  // ---------------- 冰 ----------------
  ice_beam: { id: 'ice_beam', name: '冰冻光束', type: '冰', category: '特殊', power: 95, acc: 100, pp: 10, effect: { kind: 'status', status: '冰冻', chance: 0.1 } },
  blizzard: { id: 'blizzard', name: '暴风雪', type: '冰', category: '特殊', power: 120, acc: 70, pp: 5, effect: { kind: 'status', status: '冰冻', chance: 0.1 } },
  ice_punch: { id: 'ice_punch', name: '冰冻拳', type: '冰', category: '物理', power: 75, acc: 100, pp: 15, effect: { kind: 'status', status: '冰冻', chance: 0.1 } },

  // ---------------- 格斗 ----------------
  karate_chop: { id: 'karate_chop', name: '空手劈', type: '格斗', category: '物理', power: 50, acc: 100, pp: 25 },
  double_kick: { id: 'double_kick', name: '二连踢', type: '格斗', category: '物理', power: 30, acc: 100, pp: 30, effect: { kind: 'multi', hits: 2 } },
  brick_break: { id: 'brick_break', name: '劈瓦', type: '格斗', category: '物理', power: 75, acc: 100, pp: 15 },

  // ---------------- 毒 ----------------
  poison_sting: { id: 'poison_sting', name: '毒针', type: '毒', category: '物理', power: 15, acc: 100, pp: 35, effect: { kind: 'status', status: '中毒', chance: 0.3 } },
  acid: { id: 'acid', name: '溶解液', type: '毒', category: '特殊', power: 40, acc: 100, pp: 30, effect: { kind: 'stat', target: 'target', stat: 'spd', stage: -1, chance: 0.1 } },
  sludge_bomb: { id: 'sludge_bomb', name: '污泥炸弹', type: '毒', category: '特殊', power: 90, acc: 100, pp: 10, effect: { kind: 'status', status: '中毒', chance: 0.3 } },
  toxic: { id: 'toxic', name: '剧毒', type: '毒', category: '变化', power: 0, acc: 90, pp: 10, effect: { kind: 'status', status: '剧毒', chance: 1 } },

  // ---------------- 地面 ----------------
  dig: { id: 'dig', name: '挖洞', type: '地面', category: '物理', power: 80, acc: 100, pp: 10 },
  earthquake: { id: 'earthquake', name: '地震', type: '地面', category: '物理', power: 100, acc: 100, pp: 10 },

  // ---------------- 岩石 ----------------
  rock_throw: { id: 'rock_throw', name: '落石', type: '岩石', category: '物理', power: 50, acc: 90, pp: 15 },
  rock_slide: { id: 'rock_slide', name: '岩崩', type: '岩石', category: '物理', power: 75, acc: 90, pp: 10, effect: { kind: 'flinch', chance: 0.3 } },
  rock_tomb: { id: 'rock_tomb', name: '岩石封锁', type: '岩石', category: '物理', power: 50, acc: 80, pp: 10, effect: { kind: 'stat', target: 'target', stat: 'spe', stage: -1, chance: 1 } },

  // ---------------- 虫 ----------------
  twineedle: { id: 'twineedle', name: '双针', type: '虫', category: '物理', power: 25, acc: 100, pp: 20, effect: { kind: 'multi', hits: 2 } },
  pin_missile: { id: 'pin_missile', name: '飞弹针', type: '虫', category: '物理', power: 14, acc: 85, pp: 20, effect: { kind: 'multi', hits: '2-5' } },
  bug_bite: { id: 'bug_bite', name: '虫咬', type: '虫', category: '物理', power: 60, acc: 100, pp: 20 },
  string_shot: { id: 'string_shot', name: '吐丝', type: '虫', category: '变化', power: 0, acc: 95, pp: 40, effect: { kind: 'stat', target: 'target', stat: 'spe', stage: -1, chance: 1 } },

  // ---------------- 幽灵 ----------------
  lick: { id: 'lick', name: '舌舔', type: '幽灵', category: '物理', power: 20, acc: 100, pp: 30, effect: { kind: 'status', status: '麻痹', chance: 0.3 } },
  shadow_ball: { id: 'shadow_ball', name: '暗影球', type: '幽灵', category: '特殊', power: 80, acc: 100, pp: 15, effect: { kind: 'stat', target: 'target', stat: 'spd', stage: -1, chance: 0.2 } },
  confuse_ray: { id: 'confuse_ray', name: '奇异之光', type: '幽灵', category: '变化', power: 0, acc: 100, pp: 10, effect: { kind: 'confuse', chance: 1 } },
  night_shade: { id: 'night_shade', name: '黑夜魔影', type: '幽灵', category: '特殊', power: 0, acc: 100, pp: 15, effect: { kind: 'fixedLevel' } },

  // ---------------- 超能力 ----------------
  confusion: { id: 'confusion', name: '念力', type: '超能力', category: '特殊', power: 50, acc: 100, pp: 25, effect: { kind: 'confuse', chance: 0.1 } },
  psybeam: { id: 'psybeam', name: '幻象光线', type: '超能力', category: '特殊', power: 65, acc: 100, pp: 20, effect: { kind: 'confuse', chance: 0.1 } },
  psychic: { id: 'psychic', name: '精神强念', type: '超能力', category: '特殊', power: 90, acc: 100, pp: 10, effect: { kind: 'stat', target: 'target', stat: 'spd', stage: -1, chance: 0.1 } },
  hypnosis: { id: 'hypnosis', name: '催眠术', type: '超能力', category: '变化', power: 0, acc: 60, pp: 20, effect: { kind: 'status', status: '睡眠', chance: 1 } },
  dream_eater: { id: 'dream_eater', name: '食梦', type: '超能力', category: '特殊', power: 100, acc: 100, pp: 15, effect: { kind: 'dream' } },
  agility: { id: 'agility', name: '高速移动', type: '超能力', category: '变化', power: 0, acc: 0, pp: 30, effect: { kind: 'stat', target: 'self', stat: 'spe', stage: 2, chance: 1 } },
  amnesia: { id: 'amnesia', name: '瞬间失忆', type: '超能力', category: '变化', power: 0, acc: 0, pp: 20, effect: { kind: 'stat', target: 'self', stat: 'spd', stage: 2, chance: 1 } },
  calm_mind: { id: 'calm_mind', name: '冥想', type: '超能力', category: '变化', power: 0, acc: 0, pp: 20, effect: { kind: 'stat', target: 'self', stat: 'spa', stage: 1, chance: 1, second: { stat: 'spd', stage: 1 } } },

  // ---------------- 飞行 ----------------
  peck: { id: 'peck', name: '啄', type: '飞行', category: '物理', power: 35, acc: 100, pp: 35 },
  wing_attack: { id: 'wing_attack', name: '翅膀攻击', type: '飞行', category: '物理', power: 60, acc: 100, pp: 35 },
  aerial_ace: { id: 'aerial_ace', name: '燕返', type: '飞行', category: '物理', power: 60, acc: 0, pp: 20 },
  gust: { id: 'gust', name: '起风', type: '飞行', category: '特殊', power: 40, acc: 100, pp: 35 },

  // ---------------- 龙 ----------------
  dragon_rage: { id: 'dragon_rage', name: '龙之怒', type: '龙', category: '特殊', power: 0, acc: 100, pp: 10, effect: { kind: 'fixed', dmg: 40 } },
  dragon_breath: { id: 'dragon_breath', name: '龙息', type: '龙', category: '特殊', power: 60, acc: 100, pp: 20, effect: { kind: 'status', status: '麻痹', chance: 0.3 } },
  outrage: { id: 'outrage', name: '逆鳞', type: '龙', category: '物理', power: 120, acc: 100, pp: 15, effect: { kind: 'selfConfuse' } },

  // ---------------- 恶 ----------------
  bite: { id: 'bite', name: '咬住', type: '恶', category: '物理', power: 60, acc: 100, pp: 25, effect: { kind: 'flinch', chance: 0.3 } },
  pursuit: { id: 'pursuit', name: '追击', type: '恶', category: '物理', power: 40, acc: 100, pp: 20 },
  crunch: { id: 'crunch', name: '咬碎', type: '恶', category: '物理', power: 80, acc: 100, pp: 15, effect: { kind: 'stat', target: 'target', stat: 'spd', stage: -1, chance: 0.2 } },

  // ---------------- 钢 ----------------
  metal_claw: { id: 'metal_claw', name: '金属爪', type: '钢', category: '物理', power: 50, acc: 95, pp: 35, effect: { kind: 'stat', target: 'self', stat: 'atk', stage: 1, chance: 0.1 } },
  iron_tail: { id: 'iron_tail', name: '铁尾', type: '钢', category: '物理', power: 100, acc: 75, pp: 15, effect: { kind: 'stat', target: 'target', stat: 'def', stage: -1, chance: 0.1 } },
  steel_wing: { id: 'steel_wing', name: '钢翼', type: '钢', category: '物理', power: 70, acc: 90, pp: 25, effect: { kind: 'stat', target: 'self', stat: 'def', stage: 1, chance: 0.1 } }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MOVES: MOVES };
}
