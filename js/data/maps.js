/* ============================================================
   关都地图节点 / 天气 / 道具 / 商店 / 训练家 / 道馆 / 火箭队事件
   Created by haodongsheng
   ============================================================ */

const WEATHER = {
  '晴':    { icon: '☀️', name: '晴天' },
  '雨':    { icon: '🌧️', name: '雨天' },
  '雷阵雨': { icon: '⛈️', name: '雷阵雨' },
  '沙暴':  { icon: '🌪️', name: '沙暴' }
};

const ITEMS = {
  '精灵球': { id: 'pokeball', name: '精灵球', type: 'ball', ballMult: 1,    price: 200,  desc: '捕捉野生宝可梦' },
  '超级球': { id: 'greatball', name: '超级球', type: 'ball', ballMult: 1.5,  price: 2000, minBadges: 4, desc: '比精灵球更容易捕捉' },
  '高级球': { id: 'ultraball', name: '高级球', type: 'ball', ballMult: 2,    price: 4000, minBadges: 6, desc: '效果极佳的精灵球' },
  '大师球': { id: 'masterball', name: '大师球', type: 'ball', master: true, price: 50000, minBadges: 8, desc: '必定能捕捉野生宝可梦的最强精灵球' },
  '伤药':   { id: 'potion', name: '伤药', type: 'heal', heal: 20,  price: 300,  desc: '恢复宝可梦20点HP' },
  '好伤药': { id: 'superpotion', name: '好伤药', type: 'heal', heal: 60,  price: 700,  minBadges: 2, desc: '恢复宝可梦60点HP' },
  '全复药': { id: 'fullrestore', name: '全复药', type: 'heal', heal: 'full', price: 6000, minBadges: 8, desc: '完全恢复HP与异常状态' },
  '万灵药': { id: 'fullheal', name: '万灵药', type: 'cure', cure: 'all', price: 1000, minBadges: 2, desc: '治愈宝可梦身上的任意异常状态' },
  'PP回复药': { id: 'ether', name: 'PP回复药', type: 'pp', pp: 10, price: 800, minBadges: 2, desc: '回复一只宝可梦全部招式各 10 点PP' },
  'PP满回复药': { id: 'maxether', name: 'PP满回复药', type: 'pp', pp: 'full', price: 3200, minBadges: 6, desc: '回复一只宝可梦全部招式满PP' },
  '喷雾剂': { id: 'repel', name: '喷雾剂', type: 'repel', price: 800, minBadges: 4, desc: '使用后接下来 10 次探索不会遇到野生宝可梦' },
  '求雨符': { id: 'rain_talisman', name: '求雨符', type: 'weather', weather: '雨', price: 1200, minBadges: 4, desc: '使用后 10 次探索内，雨天出现概率大幅提升' },
  '大晴符': { id: 'sunny_talisman', name: '大晴符', type: 'weather', weather: '晴', price: 800, minBadges: 4, desc: '使用后 10 次探索内，晴天出现概率大幅提升' },
  '雷雨符': { id: 'thunder_talisman', name: '雷雨符', type: 'weather', weather: '雷阵雨', price: 2000, minBadges: 6, desc: '使用后 10 次探索内，雷阵雨出现概率大幅提升' },
  '沙暴符': { id: 'sandstorm_talisman', name: '沙暴符', type: 'weather', weather: '沙暴', price: 1500, minBadges: 6, desc: '使用后 10 次探索内，沙暴出现概率大幅提升' },
  '气象罗盘': { id: 'weather_compass', name: '气象罗盘', type: 'weatherboost', price: 800, minBadges: 4, desc: '使用后接下来 10 次探索天气刷新概率翻倍' },
  '解毒药': { id: 'antidote', name: '解毒药', type: 'cure', cure: '中毒', price: 100,  desc: '解除中毒状态' },
  '解麻药': { id: 'paralyzeheal', name: '解麻药', type: 'cure', cure: '麻痹', price: 200,  desc: '解除麻痹状态' },
  '穿绳':   { id: 'escape_rope', name: '穿绳', type: 'escape', price: 550, minBadges: 2, desc: '瞬间返回最近到过的城镇' },
  '雷之石': { id: 'thunderstone', name: '雷之石', type: 'stone', stone: '雷之石', price: 5000, sell: 2000, desc: '让特定宝可梦进化的石头' },
  '火之石': { id: 'firestone', name: '火之石', type: 'stone', stone: '火之石', price: 5000, sell: 2000, desc: '让特定宝可梦进化的石头' },
  '水之石': { id: 'waterstone', name: '水之石', type: 'stone', stone: '水之石', price: 5000, sell: 2000, desc: '让特定宝可梦进化的石头' },
  '叶之石': { id: 'leafstone', name: '叶之石', type: 'stone', stone: '叶之石', price: 5000, sell: 2000, desc: '让特定宝可梦进化的石头' },
  '月亮石': { id: 'moonstone', name: '月亮石', type: 'stone', stone: '月亮石', price: 5000, sell: 2000, desc: '让特定宝可梦进化的石头' },
  '金珠':   { id: 'nugget', name: '金珠', type: 'loot', sell: 5000, desc: '可以高价卖出的贵重品' },
  'TM岩石封锁': { id: 'tm_rock_tomb', name: 'TM岩石封锁', type: 'tm', move: 'rock_tomb', desc: '让宝可梦习得招式：岩石封锁' },
  'TM泡沫光线': { id: 'tm_bubble_beam', name: 'TM泡沫光线', type: 'tm', move: 'bubble_beam', desc: '让宝可梦习得招式：泡沫光线' },
  'TM十万伏特': { id: 'tm_thunderbolt', name: 'TM十万伏特', type: 'tm', move: 'thunderbolt', desc: '让宝可梦习得招式：十万伏特' },
  'TM日光束': { id: 'tm_solar_beam', name: 'TM日光束', type: 'tm', move: 'solar_beam', desc: '让宝可梦习得招式：日光束' },
  'TM冥想': { id: 'tm_calm_mind', name: 'TM冥想', type: 'tm', move: 'calm_mind', desc: '让宝可梦习得招式：冥想' },
  'TM剧毒': { id: 'tm_toxic', name: 'TM剧毒', type: 'tm', move: 'toxic', desc: '让宝可梦习得招式：剧毒' },
  'TM喷射火焰': { id: 'tm_flamethrower', name: 'TM喷射火焰', type: 'tm', move: 'flamethrower', desc: '让宝可梦习得招式：喷射火焰' },
  'TM挖洞': { id: 'tm_dig', name: 'TM挖洞', type: 'tm', move: 'dig', desc: '让宝可梦习得招式：挖洞' },
  'TM居合斩': { id: 'tm_cut', name: 'TM居合斩', type: 'tm', move: 'cut', desc: '让宝可梦习得招式：居合斩' },
  '电气球':   { id: 'lightball', name: '电气球', type: 'held', held: '电气球', onlySpecies: 25, desc: '只有皮卡丘能携带，携带后攻击与特攻翻倍' },
  '吃剩的东西': { id: 'leftovers', name: '吃剩的东西', type: 'held', held: '吃剩的东西', price: 15000, minBadges: 8, desc: '携带后每回合结束恢复 1/16 最大HP' },
  '幸运蛋':   { id: 'luckyegg', name: '幸运蛋', type: 'held', held: '幸运蛋', price: 20000, minBadges: 8, desc: '携带后获得的经验值变为 1.5 倍' },
  '闪光石':   { id: 'shiny_stone', name: '闪光石', type: 'shiny', desc: '让一只宝可梦变为闪光形态（金色闪耀）' },
  '虹色闪光石': { id: 'rainbow_shiny_stone', name: '虹色闪光石', type: 'shiny', desc: '让一只宝可梦变为闪光形态（虹色闪耀，最稀有）' },
  '称号碎片': { id: 'title_shard', name: '称号碎片', type: 'shard', desc: '分解称号所得，5 个可在称号图鉴兑换任意称号的普通版' },
  'HP糖果':   { id: 'hp_candy', name: 'HP糖果', type: 'candy', stat: 'hp', sell: 500, desc: '喂养后提升 1 点最大HP（单项上限 15），可在商店出售' },
  '攻击糖果': { id: 'atk_candy', name: '攻击糖果', type: 'candy', stat: 'atk', sell: 500, desc: '喂养后提升 1 点攻击（单项上限 15），可在商店出售' },
  '防御糖果': { id: 'def_candy', name: '防御糖果', type: 'candy', stat: 'def', sell: 500, desc: '喂养后提升 1 点防御（单项上限 15），可在商店出售' },
  '特攻糖果': { id: 'spa_candy', name: '特攻糖果', type: 'candy', stat: 'spa', sell: 500, desc: '喂养后提升 1 点特攻（单项上限 15），可在商店出售' },
  '特防糖果': { id: 'spd_candy', name: '特防糖果', type: 'candy', stat: 'spd', sell: 500, desc: '喂养后提升 1 点特防（单项上限 15），可在商店出售' },
  '速度糖果': { id: 'spe_candy', name: '速度糖果', type: 'candy', stat: 'spe', sell: 500, desc: '喂养后提升 1 点速度（单项上限 15），可在商店出售' },
  '破旧钓竿': { id: 'old_rod', name: '破旧钓竿', type: 'key', desc: '可以在水边钓鱼，说不定能钓上好东西' },
  '自行车':   { id: 'bicycle', name: '自行车', type: 'key', desc: '骑行让你探索更高效，有几率连续探索两次' }
};

const MAP_NODES = {
  pallet: {
    id: 'pallet', name: '真新镇', type: 'town', next: ['route1'],
    weatherWeights: { '晴': 90, '雨': 10 },
    desc: '大木博士的研究所就在这里，是你冒险开始的地方。'
  },
  route1: {
    id: 'route1', name: '1号道路', type: 'route', next: ['pallet', 'viridian'],
    levels: [2, 5], weatherWeights: { '晴': 90, '雨': 10 },
    pools: {
      '晴': [ { id: 16, w: 40 }, { id: 19, w: 40 }, { id: 10, w: 10 }, { id: 13, w: 10 } ],
      '雨': [ { id: 16, w: 35 }, { id: 19, w: 30 }, { id: 10, w: 20 }, { id: 13, w: 15 } ]
    },
    trainers: [
      { id: 'r1_t1', title: '短裤小子', name: '阿奇', prize: 120, text: '来和我对战吧！', party: [{ id: 16, level: 4 }] },
      { id: 'r1_t2', title: '短裤小子', name: '小健', prize: 120, text: '我的波波是最强的！', party: [{ id: 19, level: 4 }] }
    ]
  },
  viridian: {
    id: 'viridian', name: '常磐市', type: 'town', next: ['route1', 'route2', 'route21', 'route22'],
    weatherWeights: { '晴': 90, '雨': 10 },
    desc: '关都地区最后的道馆就在这里，馆主是深不可测的坂木。',
    gym: {
      leader: '坂木', title: '馆主', badge: '绿色徽章', tm: '挖洞',
      requireBadges: 7, minLevel: 46,
      text: '哼，居然能走到我面前。让我看看你的本事！',
      winText: '……我输了。这枚绿色徽章，拿去吧。',
      apprentices: [
        { id: 'vir_a1', title: '火箭队精英', name: '马斯科', prize: 1500, text: '坂木大人不容许任何人打扰！', party: [{ id: 111, level: 44, moves: ['rock_throw', 'harden', 'take_down'] }] },
        { id: 'vir_a2', title: '火箭队精英', name: '兰斯', prize: 1600, text: '想见坂木大人，先打败我！', party: [{ id: 51, level: 45, moves: ['dig', 'earthquake', 'fury_swipes'] }] }
      ],
      team: [ { id: 34, level: 46, moves: ['earthquake', 'bite', 'poison_sting', 'take_down'] },
              { id: 112, level: 48, moves: ['earthquake', 'rock_slide', 'take_down', 'harden'] } ],
      aceIndex: 1
    }
  },
  route2: {
    id: 'route2', name: '2号道路', type: 'route', next: ['viridian', 'forest'],
    levels: [3, 6], weatherWeights: { '晴': 90, '雨': 10 },
    pools: {
      '晴': [ { id: 16, w: 35 }, { id: 19, w: 30 }, { id: 21, w: 20 }, { id: 13, w: 15 } ],
      '雨': [ { id: 16, w: 30 }, { id: 19, w: 25 }, { id: 21, w: 25 }, { id: 13, w: 20 } ]
    },
    trainers: [
      { id: 'r2_t1', title: '捕虫少年', name: '泰二', prize: 150, text: '草丛里的虫系宝可梦都归我管！', party: [{ id: 10, level: 5 }, { id: 13, level: 5 }] }
    ]
  },
  forest: {
    id: 'forest', name: '常磐森林', type: 'forest', next: ['route2', 'pewter'],
    levels: [3, 8], weatherWeights: { '晴': 100 },
    pools: {
      '晴': [ { id: 10, w: 40 }, { id: 13, w: 35 }, { id: 25, w: 15 }, { id: 16, w: 10 } ]
    },
    trainers: [
      { id: 'forest_t1', title: '捕虫少年', name: '武田', prize: 180, text: '你也是来抓虫子的吗？', party: [{ id: 13, level: 7 }] },
      { id: 'forest_t2', title: '捕虫少年', name: '智也', prize: 200, text: '我的虫系宝可梦可不好惹！', party: [{ id: 10, level: 6 }, { id: 13, level: 6 }] }
    ]
  },
  pewter: {
    id: 'pewter', name: '尼比市', type: 'town', next: ['forest', 'route3'],
    weatherWeights: { '晴': 90, '雨': 10 },
    desc: '岩石系道馆的所在地，馆主是热爱岩石的小刚。',
    gym: {
      leader: '小刚', title: '馆主', badge: '灰色徽章', tm: '岩石封锁',
      text: '我的宝可梦可是像岩石一样坚不可摧！',
      winText: '你的实力得到了我的认可！这枚灰色徽章是你的了，还有这招岩石封锁！',
      minLevel: 10,
      apprentices: [
        { id: 'pewter_a1', title: '道馆学徒', name: '阿勇', prize: 300, text: '想挑战馆主，先过我这一关！', party: [{ id: 74, level: 9, moves: ['tackle', 'harden', 'rock_throw'] }] },
        { id: 'pewter_a2', title: '道馆学徒', name: '小岩', prize: 350, text: '岩石系的防御可不是开玩笑的！', party: [{ id: 74, level: 10, moves: ['tackle', 'harden', 'rock_throw'] }, { id: 95, level: 9, moves: ['rock_throw', 'harden'] }] }
      ],
      team: [ { id: 74, level: 12, moves: ['tackle', 'harden', 'rock_throw'] },
              { id: 95, level: 14, moves: ['rock_slide', 'rock_tomb', 'tackle', 'harden'] } ],
      aceIndex: 1
    }
  },
  route3: {
    id: 'route3', name: '3号道路', type: 'route', next: ['pewter', 'mtmoon'], requireBadge: '灰色徽章',
    levels: [6, 10], weatherWeights: { '晴': 90, '雨': 10 },
    pools: {
      '晴': [ { id: 21, w: 40 }, { id: 19, w: 30 }, { id: 16, w: 20 }, { id: 50, w: 10 }, { id: 27, w: 10 } ],
      '雨': [ { id: 21, w: 35 }, { id: 19, w: 25 }, { id: 16, w: 25 }, { id: 50, w: 15 } ]
    },
    trainers: [
      { id: 'r3_t1', title: '登山男', name: '岩男', prize: 300, text: '山路可不是那么好走的！', party: [{ id: 74, level: 8 }] },
      { id: 'r3_t2', title: '短裤小子', name: '博文', prize: 280, text: '打赢我才能继续前进！', party: [{ id: 19, level: 9 }] }
    ]
  },
  mtmoon: {
    id: 'mtmoon', name: '月见山', type: 'cave', next: ['route3', 'cerulean'], requireBadge: '灰色徽章',
    levels: [8, 12], weatherWeights: { '晴': 70, '沙暴': 30 },
    pools: {
      '晴': [ { id: 41, w: 45 }, { id: 74, w: 35 }, { id: 35, w: 15 }, { id: 50, w: 5 }, { id: 92, w: 8 }, { id: 138, w: 2 }, { id: 140, w: 2 } ],
      '沙暴': [ { id: 74, w: 40 }, { id: 50, w: 25 }, { id: 95, w: 20 }, { id: 41, w: 15 } ]
    },
    trainers: [
      { id: 'moon_t1', title: '火箭队队员', name: '马欧', prize: 420, text: '既然你诚心诚意地发问了……总之先吃我一招！', party: [{ id: 41, level: 10 }, { id: 74, level: 10 }] },
      { id: 'moon_t2', title: '理科男', name: '大介', prize: 380, text: '月见山的化石研究很忙的！', party: [{ id: 35, level: 11 }] }
    ]
  },
  cerulean: {
    id: 'cerulean', name: '华蓝市', type: 'town', next: ['mtmoon', 'route24', 'route5'],
    weatherWeights: { '晴': 90, '雨': 10 },
    desc: '水属性道馆的所在地，馆主是人鱼公主小霞。',
    gym: {
      leader: '小霞', title: '馆主', badge: '蓝色徽章', tm: '泡沫光线',
      text: '水系的宝可梦，交给我吧！',
      winText: '你赢了……这枚蓝色徽章拿去吧，泡沫光线也教给你！',
      minLevel: 16,
      apprentices: [
        { id: 'cer_a1', title: '道馆学徒', name: '小蓝', prize: 400, text: '水系宝可梦可是很温柔的！', party: [{ id: 120, level: 14, moves: ['water_gun', 'bubble_beam'] }] },
        { id: 'cer_a2', title: '道馆学徒', name: '小铃', prize: 450, text: '别以为赢了就结束了！', party: [{ id: 120, level: 15, moves: ['water_gun', 'bubble_beam'] }, { id: 120, level: 15, moves: ['water_gun', 'bubble_beam'] }] }
      ],
      team: [ { id: 120, level: 16, moves: ['water_gun', 'bubble_beam', 'tackle'] },
              { id: 121, level: 18, moves: ['water_pulse', 'psybeam', 'bubble_beam', 'quick_attack'] } ],
      aceIndex: 1
    }
  },
  route24: {
    id: 'route24', name: '24号道路', type: 'route', next: ['cerulean', 'route25'], requireBadge: '蓝色徽章',
    levels: [12, 16], water: true, weatherWeights: { '晴': 60, '雨': 25, '雷阵雨': 15 },
    pools: {
      '晴':    [ { id: 43, w: 30 }, { id: 48, w: 30 }, { id: 46, w: 20 }, { id: 21, w: 20 }, { id: 60, w: 10 }, { id: 79, w: 8 } ],
      '雨':    [ { id: 43, w: 20 }, { id: 48, w: 25 }, { id: 46, w: 15 }, { id: 21, w: 10 }, { id: 16, w: 15 }, { id: 19, w: 10 }, { id: 147, w: 5 } ],
      '雷阵雨': [ { id: 25, w: 40 }, { id: 43, w: 20 }, { id: 48, w: 20 }, { id: 21, w: 15 }, { id: 147, w: 5 }, { id: 145, w: 2 } ]
    },
    thunderEvent: { chance: 0.15, text: '一道落雷劈了下来！你的首发宝可梦被击中了！' },
    trainers: [
      { id: 'r24_t1', title: '精英训练家', name: '真由', prize: 700, text: '我可不会手下留情！', party: [{ id: 25, level: 14 }] },
      { id: 'r24_t2', title: '短裤小子', name: '阿翔', prize: 650, text: '华蓝市附近可是我的地盘！', party: [{ id: 43, level: 13 }, { id: 48, level: 13 }] }
    ]
  },
  route25: {
    id: 'route25', name: '25号道路', type: 'route', next: ['route24'], requireBadge: '蓝色徽章',
    levels: [13, 17], water: true, weatherWeights: { '晴': 75, '雨': 25 },
    pools: {
      '晴': [ { id: 43, w: 30 }, { id: 48, w: 30 }, { id: 46, w: 20 }, { id: 35, w: 20 }, { id: 60, w: 10 }, { id: 79, w: 8 } ],
      '雨': [ { id: 43, w: 20 }, { id: 48, w: 20 }, { id: 35, w: 15 }, { id: 46, w: 10 }, { id: 21, w: 15 }, { id: 16, w: 12 }, { id: 147, w: 8 } ]
    },
    trainers: [
      { id: 'r25_t1', title: '露营少女', name: '小百合', prize: 720, text: '野营就要带着宝可梦一起！', party: [{ id: 35, level: 14 }, { id: 16, level: 14 }] }
    ]
  },
  route5: {
    id: 'route5', name: '5号道路', type: 'route', next: ['cerulean', 'saffron'], requireBadge: '蓝色徽章',
    levels: [15, 19], weatherWeights: { '晴': 80, '雨': 20 },
    pools: {
      '晴': [ { id: 43, w: 30 }, { id: 48, w: 25 }, { id: 21, w: 20 }, { id: 46, w: 15 }, { id: 25, w: 10 }, { id: 69, w: 10 }, { id: 63, w: 8 }, { id: 96, w: 8 } ],
      '雨': [ { id: 48, w: 25 }, { id: 43, w: 20 }, { id: 46, w: 15 }, { id: 21, w: 15 }, { id: 25, w: 15 }, { id: 16, w: 10 } ]
    },
    trainers: [
      { id: 'r5_t1', title: '短裤小子', name: '大悟', prize: 750, text: '去金黄市要经过这里！', party: [{ id: 21, level: 16 }, { id: 19, level: 16 }] },
      { id: 'r5_t2', title: '露营少女', name: '美绪', prize: 780, text: '这条路上的草可茂盛了！', party: [{ id: 43, level: 17 }, { id: 48, level: 17 }] }
    ]
  },
  saffron: {
    id: 'saffron', name: '金黄市', type: 'town', next: ['route5', 'route6', 'route7'], requireBadge: '蓝色徽章',
    weatherWeights: { '晴': 90, '雨': 10 },
    desc: '超能力系道馆的所在地，馆主是拥有强大超能力的娜姿。',
    gym: {
      leader: '娜姿', title: '馆主', badge: '金色徽章', tm: '冥想',
      minLevel: 32,
      text: '你的想法……我都能看穿。',
      winText: '……不可思议，你居然打败了我。这枚金色徽章属于你了。',
      apprentices: [
        { id: 'saf_a1', title: '超能力者', name: '敬一', prize: 900, text: '我的念力无坚不摧！', party: [{ id: 63, level: 30, moves: ['confusion', 'growl'] }] },
        { id: 'saf_a2', title: '超能力者', name: '凉子', prize: 950, text: '感觉到心灵的波动了吗？', party: [{ id: 64, level: 32, moves: ['confusion', 'psybeam'] }] }
      ],
      team: [ { id: 122, level: 36, moves: ['psychic', 'psybeam', 'confusion', 'protect'] },
              { id: 65, level: 38, moves: ['psychic', 'psybeam', 'hypnosis', 'agility'] } ],
      aceIndex: 1
    }
  },
  route6: {
    id: 'route6', name: '6号道路', type: 'route', next: ['saffron', 'vermilion'], requireBadge: '蓝色徽章',
    levels: [17, 21], weatherWeights: { '晴': 80, '雨': 20 },
    pools: {
      '晴': [ { id: 48, w: 30 }, { id: 43, w: 25 }, { id: 16, w: 20 }, { id: 21, w: 15 }, { id: 25, w: 10 }, { id: 56, w: 10 }, { id: 52, w: 8 }, { id: 66, w: 8 }, { id: 109, w: 8 }, { id: 81, w: 6 }, { id: 100, w: 6 }, { id: 125, w: 3 } ],
      '雨': [ { id: 48, w: 25 }, { id: 43, w: 20 }, { id: 16, w: 20 }, { id: 21, w: 15 }, { id: 25, w: 10 }, { id: 54, w: 10 } ]
    },
    trainers: [
      { id: 'r6_t1', title: '短裤小子', name: '雄介', prize: 820, text: '电系道馆就在前面！', party: [{ id: 25, level: 19 }] },
      { id: 'r6_t2', title: '精英训练家', name: '可奈', prize: 900, text: '你来挑战马志士的吗？', party: [{ id: 48, level: 18 }, { id: 21, level: 18 }] }
    ]
  },
  vermilion: {
    id: 'vermilion', name: '枯叶市', type: 'town', next: ['route6'], requireBadge: '蓝色徽章',
    weatherWeights: { '晴': 90, '雨': 10 },
    desc: '港口城市，电系道馆的馆主是曾经的美军少尉马志士。',
    gym: {
      leader: '马志士', title: '馆主', badge: '橙色徽章', tm: '十万伏特',
      minLevel: 22,
      text: '我的电系宝可梦会让你浑身发抖！',
      winText: '居然敢电我……不，你的实力我认可了！橙色徽章拿去吧！',
      apprentices: [
        { id: 'ver_a1', title: '电系训练家', name: '电次', prize: 550, text: '这里可是马志士大人的地盘！', party: [{ id: 81, level: 20, moves: ['thundershock', 'tackle'] }] },
        { id: 'ver_a2', title: '电系训练家', name: '理沙', prize: 600, text: '皮卡丘，给他们点颜色看看！', party: [{ id: 25, level: 22, moves: ['thundershock', 'quick_attack'] }] }
      ],
      team: [ { id: 81, level: 24, moves: ['thundershock', 'thunderbolt', 'tackle'] },
              { id: 25, level: 24, moves: ['thundershock', 'thunder_wave', 'quick_attack'] },
              { id: 26, level: 26, moves: ['thunderbolt', 'thunder_wave', 'quick_attack', 'agility'] } ],
      aceIndex: 2
    }
  },
  route7: {
    id: 'route7', name: '7号道路', type: 'route', next: ['saffron', 'celadon'], requireBadge: '橙色徽章',
    levels: [20, 24], weatherWeights: { '晴': 80, '雨': 20 },
    pools: {
      '晴': [ { id: 16, w: 25 }, { id: 21, w: 20 }, { id: 43, w: 20 }, { id: 48, w: 15 }, { id: 39, w: 10 }, { id: 25, w: 10 }, { id: 37, w: 8 }, { id: 58, w: 8 }, { id: 122, w: 4 } ],
      '雨': [ { id: 16, w: 20 }, { id: 21, w: 15 }, { id: 43, w: 15 }, { id: 48, w: 15 }, { id: 25, w: 15 }, { id: 54, w: 10 }, { id: 39, w: 10 } ]
    },
    trainers: [
      { id: 'r7_t1', title: '精英训练家', name: '修', prize: 1000, text: '彩虹市就在前面！', party: [{ id: 43, level: 22 }, { id: 16, level: 22 }] }
    ]
  },
  celadon: {
    id: 'celadon', name: '彩虹市', type: 'town', next: ['route7', 'route16'], requireBadge: '橙色徽章',
    weatherWeights: { '晴': 90, '雨': 10 },
    desc: '关都最大的城市，草系道馆的馆主是优雅的莉佳。',
    gym: {
      leader: '莉佳', title: '馆主', badge: '彩虹徽章', tm: '日光束',
      minLevel: 28,
      text: '花与草……是这世界上最温柔也最坚韧的力量。',
      winText: '我输了……这片彩虹徽章，请你收下。',
      apprentices: [
        { id: 'cel_a1', title: '园艺家', name: '政', prize: 800, text: '我的植物可都照顾得很好！', party: [{ id: 43, level: 25, moves: ['absorb', 'razor_leaf'] }] },
        { id: 'cel_a2', title: '园艺家', name: '薰', prize: 850, text: '莉佳小姐不会输的！', party: [{ id: 44, level: 26, moves: ['razor_leaf', 'acid'] }] }
      ],
      team: [ { id: 45, level: 30, moves: ['razor_leaf', 'solar_beam', 'sleep_powder'] },
              { id: 114, level: 30, moves: ['vine_whip', 'mega_drain', 'stun_spore'] },
              { id: 71, level: 32, moves: ['razor_leaf', 'sleep_powder', 'giga_drain'] } ],
      aceIndex: 2
    }
  },
  route16: {
    id: 'route16', name: '16号道路', type: 'route', next: ['celadon', 'fuchsia'], requireBadge: '彩虹徽章',
    levels: [24, 28], weatherWeights: { '晴': 80, '雨': 20 },
    pools: {
      '晴': [ { id: 21, w: 30 }, { id: 16, w: 20 }, { id: 48, w: 15 }, { id: 43, w: 15 }, { id: 54, w: 10 }, { id: 25, w: 10 }, { id: 84, w: 10 }, { id: 83, w: 8 }, { id: 128, w: 8 }, { id: 102, w: 6 }, { id: 88, w: 6 }, { id: 114, w: 6 }, { id: 115, w: 6 }, { id: 123, w: 5 }, { id: 127, w: 5 }, { id: 108, w: 4 }, { id: 132, w: 3 }, { id: 137, w: 3 } ],
      '雨': [ { id: 21, w: 20 }, { id: 16, w: 15 }, { id: 48, w: 15 }, { id: 43, w: 10 }, { id: 54, w: 20 }, { id: 25, w: 10 }, { id: 72, w: 10 } ]
    },
    trainers: [
      { id: 'r16_t1', title: '自行车手', name: '疾风', prize: 1150, text: '骑车的人可不能被追上！', party: [{ id: 21, level: 26 }, { id: 19, level: 26 }] }
    ]
  },
  fuchsia: {
    id: 'fuchsia', name: '浅红市', type: 'town', next: ['route16', 'route19'], requireBadge: '彩虹徽章',
    weatherWeights: { '晴': 90, '雨': 10 },
    desc: '毒系道馆的所在地，馆主是忍者出身的阿桔。',
    gym: {
      leader: '阿桔', title: '馆主', badge: '粉红徽章', tm: '剧毒',
      minLevel: 36,
      text: '忍者之道，在于无声无息地取胜。',
      winText: '忍者的修行……还远远不够。这枚粉红徽章是你的了。',
      apprentices: [
        { id: 'fuc_a1', title: '忍者', name: '影', prize: 1200, text: '你发现不了我的踪迹！', party: [{ id: 23, level: 34, moves: ['bite', 'poison_sting'] }] },
        { id: 'fuc_a2', title: '忍者', name: '疾', prize: 1250, text: '毒，才是最强的武器！', party: [{ id: 109, level: 35, moves: ['sludge_bomb', 'acid'] }] }
      ],
      team: [ { id: 24, level: 38, moves: ['crunch', 'sludge_bomb', 'bite'] },
              { id: 110, level: 38, moves: ['sludge_bomb', 'acid', 'take_down'] },
              { id: 49, level: 40, moves: ['psychic', 'sludge_bomb', 'sleep_powder'] } ],
      aceIndex: 2
    }
  },
  route19: {
    id: 'route19', name: '19号水路', type: 'route', next: ['fuchsia', 'seafoam'], requireBadge: '粉红徽章',
    levels: [28, 32], water: true, weatherWeights: { '晴': 75, '雨': 25 },
    pools: {
      '晴': [ { id: 72, w: 35 }, { id: 129, w: 25 }, { id: 120, w: 20 }, { id: 54, w: 10 }, { id: 147, w: 10 }, { id: 98, w: 8 } ],
      '雨': [ { id: 72, w: 30 }, { id: 129, w: 20 }, { id: 120, w: 25 }, { id: 54, w: 10 }, { id: 147, w: 15 } ]
    },
    trainers: [
      { id: 'r19_t1', title: '垂钓者', name: '海男', prize: 1300, text: '这里的水里全是宝可梦！', party: [{ id: 129, level: 28 }, { id: 120, level: 30 }] }
    ]
  },
  seafoam: {
    id: 'seafoam', name: '双子岛', type: 'cave', next: ['route19', 'cinnabar'], requireBadge: '粉红徽章',
    levels: [34, 40], water: true, weatherWeights: { '晴': 100 },
    desc: '终年积雪的海岛洞窟，据说最深处栖息着传说中的急冻鸟。',
    pools: {
      '晴': [ { id: 86, w: 20 }, { id: 87, w: 15 }, { id: 90, w: 20 }, { id: 91, w: 10 }, { id: 72, w: 10 }, { id: 131, w: 8 }, { id: 121, w: 12 }, { id: 42, w: 3 }, { id: 124, w: 5 }, { id: 144, w: 2 } ]
    },
    trainers: [
      { id: 'seafoam_t1', title: '游泳者', name: '冷泉', prize: 1300, text: '冰水可是很冷的，别冻僵了！', party: [{ id: 87, level: 36, moves: ['water_gun', 'ice_beam', 'aurora_beam'] }] },
      { id: 'seafoam_t2', title: '游泳者', name: '寒子', prize: 1350, text: '听说这里能遇到稀有的宝可梦！', party: [{ id: 91, level: 37, moves: ['ice_beam', 'water_gun'] }, { id: 131, level: 36, moves: ['surf', 'ice_beam'] }] }
    ]
  },
  cinnabar: {
    id: 'cinnabar', name: '红莲岛', type: 'town', next: ['seafoam', 'route21'], requireBadge: '粉红徽章',
    weatherWeights: { '晴': 90, '雨': 10 },
    desc: '火山岛上的火系道馆，馆主是研究宝可梦化石的夏伯。',
    gym: {
      leader: '夏伯', title: '馆主', badge: '深红徽章', tm: '喷射火焰',
      minLevel: 42,
      text: '哎呀，老夫的火系宝可梦可不会手下留情！',
      winText: '后生可畏！这枚深红徽章给你了！',
      apprentices: [
        { id: 'cin_a1', title: '消防员', name: '火村', prize: 1400, text: '小心烫伤！', party: [{ id: 58, level: 40, moves: ['ember', 'bite'] }] },
        { id: 'cin_a2', title: '登山男', name: '岩夫', prize: 1450, text: '火山附近气温可不低！', party: [{ id: 37, level: 41, moves: ['ember', 'confuse_ray'] }] }
      ],
      team: [ { id: 59, level: 43, moves: ['flamethrower', 'bite', 'take_down'] },
              { id: 78, level: 43, moves: ['flamethrower', 'agility', 'take_down'] },
              { id: 38, level: 45, moves: ['flamethrower', 'confuse_ray', 'overheat'] } ],
      aceIndex: 2
    }
  },
  route21: {
    id: 'route21', name: '21号水路', type: 'route', next: ['cinnabar', 'viridian'], requireBadge: '深红徽章',
    levels: [32, 36], water: true, weatherWeights: { '晴': 75, '雨': 25 },
    pools: {
      '晴': [ { id: 72, w: 30 }, { id: 129, w: 25 }, { id: 120, w: 20 }, { id: 147, w: 15 }, { id: 54, w: 10 }, { id: 98, w: 8 }, { id: 116, w: 8 }, { id: 118, w: 8 }, { id: 126, w: 4 }, { id: 146, w: 2 } ],
      '雨': [ { id: 72, w: 25 }, { id: 129, w: 20 }, { id: 120, w: 20 }, { id: 147, w: 20 }, { id: 54, w: 15 }, { id: 151, w: 1 } ]
    },
    trainers: [
      { id: 'r21_t1', title: '垂钓者', name: '老大', prize: 1500, text: '这可是关都最好的钓点！', party: [{ id: 130, level: 34 }] }
    ]
  },
  route22: {
    id: 'route22', name: '22号道路', type: 'route', next: ['viridian', 'champion'], requireBadge: '绿色徽章',
    levels: [36, 40], weatherWeights: { '晴': 80, '雨': 20 },
    pools: {
      '晴': [ { id: 19, w: 20 }, { id: 21, w: 20 }, { id: 32, w: 15 }, { id: 29, w: 15 }, { id: 23, w: 15 }, { id: 16, w: 15 }, { id: 104, w: 8 }, { id: 111, w: 8 }, { id: 77, w: 6 }, { id: 106, w: 5 }, { id: 107, w: 5 }, { id: 113, w: 4 } ],
      '雨': [ { id: 19, w: 15 }, { id: 21, w: 15 }, { id: 32, w: 10 }, { id: 29, w: 10 }, { id: 23, w: 10 }, { id: 16, w: 15 }, { id: 54, w: 15 }, { id: 72, w: 10 } ]
    },
    trainers: [
      { id: 'r22_t1', title: '精英训练家', name: '健一', prize: 1600, text: '冠军之路就在前面！', party: [{ id: 34, level: 38 }, { id: 22, level: 38 }] }
    ]
  },
  champion: {
    id: 'champion', name: '冠军之路', type: 'cave', next: ['route22', 'tower'], requireBadge: '绿色徽章',
    levels: [40, 45], weatherWeights: { '晴': 100 },
    desc: '通往精灵联盟的最终试炼。这里盘踞着关都最强的野生宝可梦。',
    pools: {
      '晴': [ { id: 41, w: 20 }, { id: 42, w: 15 }, { id: 74, w: 15 }, { id: 95, w: 15 }, { id: 51, w: 10 }, { id: 64, w: 10 }, { id: 112, w: 15 }, { id: 142, w: 2 }, { id: 150, w: 1 } ]
    },
    trainers: [
      { id: 'ch_t1', title: '精英训练家', name: '铁也', prize: 2200, text: '这里就是关都的巅峰！', party: [{ id: 65, level: 42 }, { id: 130, level: 42 }] },
      { id: 'ch_t2', title: '冠军之路守卫', name: '罗伊', prize: 2400, text: '打败我，你才有资格迈向联盟！', party: [{ id: 112, level: 43 }, { id: 149, level: 42 }] }
    ]
  },
  tower: {
    id: 'tower', name: '无尽之塔', type: 'tower', next: ['champion'], requireBadge: '绿色徽章',
    desc: '一重高过一重……传说第 100 层藏着最强的挑战。'
  }
};

const ROCKET_EVENTS = {
  robbery: {
    name: '火箭队抢劫', text: '你被火箭队拦住了！「打劫！把身上的钱和道具交出来！」',
    lines: [
      '你被火箭队拦住了！「打劫！把身上的钱和道具交出来！」',
      '「既然你诚心诚意地发问了，我们就大发慈悲地告诉你——交出你的钱！」',
      '「火箭队！为了夺取宝可梦，也为了夺取你的钱包！」'
    ],
    winText: '你打败了火箭队！他们丢下了一枚金珠灰溜溜地跑了。',
    loseText: '火箭队抢走了你的钱，还翻走了你的背包……',
    reward: { item: '金珠' },
    party: [ { id: 41, level: 0 }, { id: 109, level: 0 } ]
  },
  sell: {
    name: '强买强卖', text: '火箭队小兵拦住你：「嘿，小哥，稀有宝可梦要不要？只要3000金！」',
    lines: [
      '火箭队小兵拦住你：「嘿，小哥，稀有宝可梦要不要？只要3000金！」',
      '「走过路过不要错过！超稀有的宝可梦，跳楼价3000金！」',
      '「这位训练家，我看你骨骼惊奇，这只宝可梦和你很有缘啊！」'
    ],
    price: 3000, okText: '付钱买下', noText: '不理他，转身就走',
    rare: [133, 147, 25], junk: 129
  },
  rescue: {
    name: '解救宝可梦', text: '你撞见火箭队正在欺负一只伊布！「想救它？先过我们这关！」',
    lines: [
      '你撞见火箭队正在欺负一只伊布！「想救它？先过我们这关！」',
      '「喂！这只伊布是我们先看上的，识相的话赶紧走开！」',
      '「住手！……哦，来了个多管闲事的训练家。」'
    ],
    winText: '你救下了伊布！它感激地蹭了蹭你，决定加入你的队伍！',
    rewardMon: 133,
    party: [ { id: 42, level: 0 }, { id: 110, level: 0 } ]
  }
};

// 初始道具与金钱
const START_ITEMS = { '精灵球': 5, '伤药': 5, '解毒药': 1 };
const START_MONEY = 3000;

// 钓鱼池（按水域节点区分；未配置的水域回退到经典四件套）
const FISH_POOLS = {
  route24: [ { id: 129, w: 45 }, { id: 120, w: 20 }, { id: 79, w: 10 }, { id: 60, w: 10 }, { id: 118, w: 7 }, { id: 147, w: 5 }, { id: 116, w: 2 }, { id: 130, w: 1 } ],
  route25: [ { id: 129, w: 45 }, { id: 120, w: 20 }, { id: 79, w: 10 }, { id: 60, w: 10 }, { id: 118, w: 7 }, { id: 147, w: 5 }, { id: 116, w: 2 }, { id: 130, w: 1 } ],
  route19: [ { id: 129, w: 35 }, { id: 120, w: 20 }, { id: 98, w: 10 }, { id: 116, w: 10 }, { id: 118, w: 10 }, { id: 147, w: 8 }, { id: 79, w: 4 }, { id: 130, w: 3 } ],
  route21: [ { id: 129, w: 35 }, { id: 120, w: 20 }, { id: 98, w: 10 }, { id: 116, w: 10 }, { id: 118, w: 10 }, { id: 147, w: 8 }, { id: 79, w: 4 }, { id: 130, w: 3 } ],
  seafoam: [ { id: 90, w: 25 }, { id: 120, w: 20 }, { id: 129, w: 20 }, { id: 86, w: 12 }, { id: 121, w: 8 }, { id: 116, w: 8 }, { id: 147, w: 5 }, { id: 130, w: 2 } ]
};
const FISH_POOL_FALLBACK = [ { id: 129, w: 70 }, { id: 120, w: 25 }, { id: 147, w: 4 }, { id: 130, w: 1 } ];

// 商店货架（按徽章数量解锁）
const MART_STOCK = [
  { name: '精灵球', minBadges: 0 },
  { name: '伤药', minBadges: 0 },
  { name: '解毒药', minBadges: 0 },
  { name: '解麻药', minBadges: 0 },
  { name: '好伤药', minBadges: 2 },
  { name: '穿绳', minBadges: 2 },
  { name: '万灵药', minBadges: 2 },
  { name: 'PP回复药', minBadges: 2 },
  { name: '超级球', minBadges: 4 },
  { name: '雷之石', minBadges: 4 },
  { name: '火之石', minBadges: 4 },
  { name: '水之石', minBadges: 4 },
  { name: '叶之石', minBadges: 4 },
  { name: '月亮石', minBadges: 4 },
  { name: '喷雾剂', minBadges: 4 },
  { name: '求雨符', minBadges: 4 },
  { name: '大晴符', minBadges: 4 },
  { name: '气象罗盘', minBadges: 4 },
  { name: '高级球', minBadges: 6 },
  { name: 'PP满回复药', minBadges: 6 },
  { name: '雷雨符', minBadges: 6 },
  { name: '沙暴符', minBadges: 6 },
  { name: '全复药', minBadges: 8 },
  { name: '大师球', minBadges: 8 },
  { name: '吃剩的东西', minBadges: 8 },
  { name: '幸运蛋', minBadges: 8 }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    WEATHER: WEATHER, ITEMS: ITEMS, MAP_NODES: MAP_NODES,
    ROCKET_EVENTS: ROCKET_EVENTS, START_ITEMS: START_ITEMS,
    START_MONEY: START_MONEY, MART_STOCK: MART_STOCK,
    FISH_POOLS: FISH_POOLS, FISH_POOL_FALLBACK: FISH_POOL_FALLBACK
  };
}
