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
  false_swipe: { id: 'false_swipe', name: '点到为止', type: '普通', category: '物理', power: 40, acc: 100, pp: 40, effect: { kind: 'leaveOneWild' } },
  hyper_beam: { id: 'hyper_beam', name: '破坏光线', type: '普通', category: '特殊', power: 150, acc: 90, pp: 5, effect: { kind: 'recharge' } },
  swords_dance: { id: 'swords_dance', name: '剑舞', type: '普通', category: '变化', power: 0, acc: 0, pp: 20, effect: { kind: 'stat', target: 'self', stat: 'atk', stage: 2, chance: 1 } },
  harden: { id: 'harden', name: '变硬', type: '普通', category: '变化', power: 0, acc: 0, pp: 30, effect: { kind: 'stat', target: 'self', stat: 'def', stage: 1, chance: 1 } },
  protect: { id: 'protect', name: '守住', type: '普通', category: '变化', power: 0, acc: 0, pp: 10, effect: { kind: 'protect' } },
  light_screen: { id: 'light_screen', name: '光墙', type: '超能力', category: '变化', power: 0, acc: 0, pp: 30, effect: { kind: 'barrier', barrier: 'special' } },
  reflect: { id: 'reflect', name: '反射壁', type: '超能力', category: '变化', power: 0, acc: 0, pp: 20, effect: { kind: 'barrier', barrier: 'physical' } },
  safeguard: { id: 'safeguard', name: '神秘守护', type: '普通', category: '变化', power: 0, acc: 0, pp: 25, effect: { kind: 'safeguard' } },
  substitute: { id: 'substitute', name: '替身', type: '普通', category: '变化', power: 0, acc: 0, pp: 10, effect: { kind: 'substitute' } },
  yawn: { id: 'yawn', name: '哈欠', type: '普通', category: '变化', power: 0, acc: 0, pp: 10, effect: { kind: 'yawn' } },
  wish: { id: 'wish', name: '祈愿', type: '普通', category: '变化', power: 0, acc: 0, pp: 10, effect: { kind: 'wish' } },
  roar: { id: 'roar', name: '吼叫', type: '普通', category: '变化', power: 0, acc: 0, pp: 20, effect: { kind: 'clearStages' } },
  whirlwind: { id: 'whirlwind', name: '吹飞', type: '普通', category: '变化', power: 0, acc: 0, pp: 20, effect: { kind: 'clearStages' } },
  haze: { id: 'haze', name: '黑雾', type: '冰', category: '变化', power: 0, acc: 0, pp: 30, effect: { kind: 'clearAllStages' } },
  taunt: { id: 'taunt', name: '挑衅', type: '恶', category: '变化', power: 0, acc: 100, pp: 20, effect: { kind: 'taunt' } },
  mean_look: { id: 'mean_look', name: '黑色目光', type: '普通', category: '变化', power: 0, acc: 100, pp: 5, effect: { kind: 'trapSwitch' } },
  perish_song: { id: 'perish_song', name: '灭亡之歌', type: '普通', category: '变化', power: 0, acc: 100, pp: 5, effect: { kind: 'perishSong' } },
  aromatherapy: { id: 'aromatherapy', name: '芳香治疗', type: '草', category: '变化', power: 0, acc: 0, pp: 5, effect: { kind: 'cureParty' } },
  heal_bell: { id: 'heal_bell', name: '治愈铃声', type: '普通', category: '变化', power: 0, acc: 0, pp: 5, effect: { kind: 'cureParty' } },
  spikes: { id: 'spikes', name: '撒菱', type: '地面', category: '变化', power: 0, acc: 0, pp: 20, effect: { kind: 'hazard' } },
  dragon_dance: { id: 'dragon_dance', name: '龙之舞', type: '龙', category: '变化', power: 0, acc: 0, pp: 20, effect: { kind: 'stat', target: 'self', stat: 'atk', stage: 1, second: { stat: 'spe', stage: 1 }, chance: 1 } },
  bulk_up: { id: 'bulk_up', name: '健美', type: '格斗', category: '变化', power: 0, acc: 0, pp: 20, effect: { kind: 'stat', target: 'self', stat: 'atk', stage: 1, second: { stat: 'def', stage: 1 }, chance: 1 } },
  belly_drum: { id: 'belly_drum', name: '腹鼓', type: '普通', category: '变化', power: 0, acc: 0, pp: 10, effect: { kind: 'bellyDrum' } },
  moonlight: { id: 'moonlight', name: '月光', type: '普通', category: '变化', power: 0, acc: 0, pp: 5, effect: { kind: 'heal', ratio: 0.5, self: true } },
  morning_sun: { id: 'morning_sun', name: '晨光', type: '普通', category: '变化', power: 0, acc: 0, pp: 5, effect: { kind: 'heal', ratio: 0.5, self: true } },
  milk_drink: { id: 'milk_drink', name: '喝牛奶', type: '普通', category: '变化', power: 0, acc: 0, pp: 10, effect: { kind: 'heal', ratio: 0.5, self: true } },
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
  steel_wing: { id: 'steel_wing', name: '钢翼', type: '钢', category: '物理', power: 70, acc: 90, pp: 25, effect: { kind: 'stat', target: 'self', stat: 'def', stage: 1, chance: 0.1 } },

  // ---------------- Gen1-3 扩充（常用招式） ----------------
  // 普通
  cut: { id: 'cut', name: '居合斩', type: '普通', category: '物理', power: 50, acc: 95, pp: 30 },
  slash: { id: 'slash', name: '劈开', type: '普通', category: '物理', power: 70, acc: 100, pp: 20 },
  horn_attack: { id: 'horn_attack', name: '角撞', type: '普通', category: '物理', power: 65, acc: 100, pp: 25 },
  stomp: { id: 'stomp', name: '踩踏', type: '普通', category: '物理', power: 65, acc: 100, pp: 20, effect: { kind: 'flinch', chance: 0.3 } },
  headbutt: { id: 'headbutt', name: '头锤', type: '普通', category: '物理', power: 70, acc: 100, pp: 15, effect: { kind: 'flinch', chance: 0.3 } },
  double_slap: { id: 'double_slap', name: '连环巴掌', type: '普通', category: '物理', power: 15, acc: 85, pp: 10, effect: { kind: 'multi', hits: '2-5' } },
  fury_attack: { id: 'fury_attack', name: '乱击', type: '普通', category: '物理', power: 15, acc: 85, pp: 20, effect: { kind: 'multi', hits: '2-5' } },
  mega_punch: { id: 'mega_punch', name: '百万吨拳', type: '普通', category: '物理', power: 80, acc: 85, pp: 20 },
  mega_kick: { id: 'mega_kick', name: '百万吨踢', type: '普通', category: '物理', power: 120, acc: 75, pp: 5 },
  strength: { id: 'strength', name: '怪力', type: '普通', category: '物理', power: 80, acc: 100, pp: 15 },
  thrash: { id: 'thrash', name: '大闹一番', type: '普通', category: '物理', power: 120, acc: 100, pp: 10, effect: { kind: 'selfConfuse' } },
  wrap: { id: 'wrap', name: '紧束', type: '普通', category: '物理', power: 15, acc: 90, pp: 20, effect: { kind: 'trap' } },
  rapid_spin: { id: 'rapid_spin', name: '高速旋转', type: '普通', category: '物理', power: 50, acc: 100, pp: 40 },
  facade: { id: 'facade', name: '硬撑', type: '普通', category: '物理', power: 70, acc: 100, pp: 20 },
  defense_curl: { id: 'defense_curl', name: '缩入壳中', type: '普通', category: '变化', power: 0, acc: 0, pp: 40, effect: { kind: 'stat', target: 'self', stat: 'def', stage: 1, chance: 1 } },
  recover: { id: 'recover', name: '自我再生', type: '普通', category: '变化', power: 0, acc: 0, pp: 10, effect: { kind: 'heal', ratio: 0.5, self: true } },
  rest: { id: 'rest', name: '睡觉', type: '超能力', category: '变化', power: 0, acc: 0, pp: 5, effect: { kind: 'rest' } },
  soft_boiled: { id: 'soft_boiled', name: '生蛋', type: '普通', category: '变化', power: 0, acc: 0, pp: 10, effect: { kind: 'heal', ratio: 0.5, self: true } },
  screech: { id: 'screech', name: '刺耳声', type: '普通', category: '变化', power: 0, acc: 85, pp: 40, effect: { kind: 'stat', target: 'target', stat: 'def', stage: -2, chance: 1 } },
  // 火
  fire_blast: { id: 'fire_blast', name: '大字爆炎', type: '火', category: '特殊', power: 120, acc: 85, pp: 5, effect: { kind: 'status', status: '灼伤', chance: 0.1 } },
  heat_wave: { id: 'heat_wave', name: '热风', type: '火', category: '特殊', power: 95, acc: 90, pp: 10, effect: { kind: 'status', status: '灼伤', chance: 0.1 } },
  will_o_wisp: { id: 'will_o_wisp', name: '鬼火', type: '火', category: '变化', power: 0, acc: 85, pp: 15, effect: { kind: 'status', status: '灼伤', chance: 1 } },
  // 水
  waterfall: { id: 'waterfall', name: '攀瀑', type: '水', category: '物理', power: 80, acc: 100, pp: 15, effect: { kind: 'flinch', chance: 0.2 } },
  crabhammer: { id: 'crabhammer', name: '蟹钳锤', type: '水', category: '物理', power: 100, acc: 90, pp: 10 },
  aqua_tail: { id: 'aqua_tail', name: '水流尾', type: '水', category: '物理', power: 90, acc: 90, pp: 10 },
  whirlpool: { id: 'whirlpool', name: '潮旋', type: '水', category: '特殊', power: 35, acc: 85, pp: 15, effect: { kind: 'trap' } },
  muddy_water: { id: 'muddy_water', name: '浊流', type: '水', category: '特殊', power: 95, acc: 85, pp: 10, effect: { kind: 'stat', target: 'target', stat: 'acc', stage: -1, chance: 1 } },
  // 电
  spark: { id: 'spark', name: '电光', type: '电', category: '物理', power: 65, acc: 100, pp: 20, effect: { kind: 'status', status: '麻痹', chance: 0.3 } },
  zap_cannon: { id: 'zap_cannon', name: '电磁炮', type: '电', category: '特殊', power: 120, acc: 50, pp: 5, effect: { kind: 'status', status: '麻痹', chance: 1 } },
  shock_wave: { id: 'shock_wave', name: '电击波', type: '电', category: '特殊', power: 60, acc: 0, pp: 20 },
  // 草
  petal_dance: { id: 'petal_dance', name: '花瓣舞', type: '草', category: '特殊', power: 120, acc: 100, pp: 10, effect: { kind: 'selfConfuse' } },
  magical_leaf: { id: 'magical_leaf', name: '魔法叶', type: '草', category: '特殊', power: 60, acc: 0, pp: 20 },
  leaf_blade: { id: 'leaf_blade', name: '叶刃', type: '草', category: '物理', power: 90, acc: 100, pp: 15 },
  spore: { id: 'spore', name: '蘑菇孢子', type: '草', category: '变化', power: 0, acc: 100, pp: 15, effect: { kind: 'status', status: '睡眠', chance: 1 } },
  cotton_spore: { id: 'cotton_spore', name: '棉孢子', type: '草', category: '变化', power: 0, acc: 100, pp: 40, effect: { kind: 'stat', target: 'target', stat: 'spe', stage: -2, chance: 1 } },
  // 冰
  powder_snow: { id: 'powder_snow', name: '细雪', type: '冰', category: '特殊', power: 40, acc: 100, pp: 25, effect: { kind: 'status', status: '冰冻', chance: 0.1 } },
  aurora_beam: { id: 'aurora_beam', name: '极光束', type: '冰', category: '特殊', power: 65, acc: 100, pp: 20, effect: { kind: 'stat', target: 'target', stat: 'atk', stage: -1, chance: 0.1 } },
  icicle_spear: { id: 'icicle_spear', name: '冰锥', type: '冰', category: '物理', power: 25, acc: 100, pp: 30, effect: { kind: 'multi', hits: '2-5' } },
  // 格斗
  mach_punch: { id: 'mach_punch', name: '音速拳', type: '格斗', category: '物理', power: 40, acc: 100, pp: 30, effect: { kind: 'priority' } },
  rolling_kick: { id: 'rolling_kick', name: '回旋踢', type: '格斗', category: '物理', power: 60, acc: 85, pp: 15, effect: { kind: 'flinch', chance: 0.3 } },
  jump_kick: { id: 'jump_kick', name: '飞踢', type: '格斗', category: '物理', power: 100, acc: 95, pp: 10 },
  hi_jump_kick: { id: 'hi_jump_kick', name: '飞膝踢', type: '格斗', category: '物理', power: 130, acc: 90, pp: 10 },
  submission: { id: 'submission', name: '地球上投', type: '格斗', category: '物理', power: 80, acc: 80, pp: 25, effect: { kind: 'recoil', ratio: 0.25 } },
  vital_throw: { id: 'vital_throw', name: '借力摔', type: '格斗', category: '物理', power: 70, acc: 0, pp: 10 },
  rock_smash: { id: 'rock_smash', name: '碎岩', type: '格斗', category: '物理', power: 40, acc: 100, pp: 15, effect: { kind: 'stat', target: 'target', stat: 'def', stage: -1, chance: 0.5 } },
  // 毒
  smog: { id: 'smog', name: '烟雾', type: '毒', category: '特殊', power: 20, acc: 70, pp: 20, effect: { kind: 'status', status: '中毒', chance: 0.4 } },
  sludge: { id: 'sludge', name: '污泥', type: '毒', category: '特殊', power: 65, acc: 100, pp: 20, effect: { kind: 'status', status: '中毒', chance: 0.3 } },
  poison_fang: { id: 'poison_fang', name: '剧毒牙', type: '毒', category: '物理', power: 50, acc: 100, pp: 15, effect: { kind: 'status', status: '剧毒', chance: 0.3 } },
  acid_armor: { id: 'acid_armor', name: '溶解', type: '毒', category: '变化', power: 0, acc: 0, pp: 40, effect: { kind: 'stat', target: 'self', stat: 'def', stage: 2, chance: 1 } },
  // 地面
  bone_club: { id: 'bone_club', name: '骨棒', type: '地面', category: '物理', power: 65, acc: 85, pp: 20, effect: { kind: 'flinch', chance: 0.1 } },
  bonemerang: { id: 'bonemerang', name: '骨头回力镖', type: '地面', category: '物理', power: 50, acc: 90, pp: 10, effect: { kind: 'multi', hits: 2 } },
  bone_rush: { id: 'bone_rush', name: '骨头冲锋', type: '地面', category: '物理', power: 25, acc: 90, pp: 10, effect: { kind: 'multi', hits: '2-5' } },
  mud_shot: { id: 'mud_shot', name: '泥巴射击', type: '地面', category: '特殊', power: 55, acc: 95, pp: 15, effect: { kind: 'stat', target: 'target', stat: 'spe', stage: -1, chance: 1 } },
  // 岩石
  rollout: { id: 'rollout', name: '滚动', type: '岩石', category: '物理', power: 30, acc: 90, pp: 20 },
  rock_blast: { id: 'rock_blast', name: '岩石爆击', type: '岩石', category: '物理', power: 25, acc: 90, pp: 10, effect: { kind: 'multi', hits: '2-5' } },
  ancient_power: { id: 'ancient_power', name: '原始之力', type: '岩石', category: '特殊', power: 60, acc: 100, pp: 5, effect: { kind: 'stat', target: 'self', stat: 'spa', stage: 1, chance: 0.1 } },
  // 虫
  leech_life: { id: 'leech_life', name: '吸血', type: '虫', category: '物理', power: 20, acc: 100, pp: 15, effect: { kind: 'heal', ratio: 0.5 } },
  mega_horn: { id: 'mega_horn', name: '超级角击', type: '虫', category: '物理', power: 120, acc: 85, pp: 10 },
  silver_wind: { id: 'silver_wind', name: '银色旋风', type: '虫', category: '特殊', power: 60, acc: 100, pp: 5, effect: { kind: 'stat', target: 'self', stat: 'spa', stage: 1, chance: 0.1 } },
  signal_beam: { id: 'signal_beam', name: '信号光束', type: '虫', category: '特殊', power: 75, acc: 100, pp: 15, effect: { kind: 'confuse', chance: 0.1 } },
  // 幽灵
  shadow_punch: { id: 'shadow_punch', name: '暗影拳', type: '幽灵', category: '物理', power: 60, acc: 0, pp: 20 },
  shadow_sneak: { id: 'shadow_sneak', name: '影袭', type: '幽灵', category: '物理', power: 40, acc: 100, pp: 30, effect: { kind: 'priority' } },
  // 飞行
  drill_peck: { id: 'drill_peck', name: '钻孔啄', type: '飞行', category: '物理', power: 80, acc: 100, pp: 20 },
  air_slash: { id: 'air_slash', name: '空气斩', type: '飞行', category: '特殊', power: 75, acc: 95, pp: 15, effect: { kind: 'flinch', chance: 0.3 } },
  brave_bird: { id: 'brave_bird', name: '勇鸟猛攻', type: '飞行', category: '物理', power: 120, acc: 100, pp: 15, effect: { kind: 'recoil', ratio: 0.33 } },
  // 龙
  dragon_claw: { id: 'dragon_claw', name: '龙爪', type: '龙', category: '物理', power: 80, acc: 100, pp: 15 },
  twister: { id: 'twister', name: '龙卷风', type: '龙', category: '特殊', power: 40, acc: 100, pp: 20, effect: { kind: 'flinch', chance: 0.2 } },
  // 恶
  faint_attack: { id: 'faint_attack', name: '虚晃一招', type: '恶', category: '物理', power: 60, acc: 0, pp: 20 },
  thief: { id: 'thief', name: '小偷', type: '恶', category: '物理', power: 60, acc: 100, pp: 25 },
  knock_off: { id: 'knock_off', name: '拍落', type: '恶', category: '物理', power: 65, acc: 100, pp: 20 },
  snarl: { id: 'snarl', name: '大声咆哮', type: '恶', category: '特殊', power: 55, acc: 95, pp: 15, effect: { kind: 'stat', target: 'target', stat: 'spa', stage: -1, chance: 1 } },
  // 钢
  meteor_mash: { id: 'meteor_mash', name: '彗星拳', type: '钢', category: '物理', power: 100, acc: 85, pp: 10, effect: { kind: 'stat', target: 'self', stat: 'atk', stage: 1, chance: 0.2 } },
  flash_cannon: { id: 'flash_cannon', name: '加农光炮', type: '钢', category: '特殊', power: 80, acc: 100, pp: 10, effect: { kind: 'stat', target: 'target', stat: 'spd', stage: -1, chance: 0.1 } },
  iron_defense: { id: 'iron_defense', name: '铁壁', type: '钢', category: '变化', power: 0, acc: 0, pp: 15, effect: { kind: 'stat', target: 'self', stat: 'def', stage: 2, chance: 1 } }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MOVES: MOVES };
}
