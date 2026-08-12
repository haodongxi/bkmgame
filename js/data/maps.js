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
  '超级球': { id: 'greatball', name: '超级球', type: 'ball', ballMult: 1.5,  price: 1200, minBadges: 4, desc: '比精灵球更容易捕捉' },
  '高级球': { id: 'ultraball', name: '高级球', type: 'ball', ballMult: 2,    price: 1800, minBadges: 6, desc: '效果极佳的精灵球' },
  '伤药':   { id: 'potion', name: '伤药', type: 'heal', heal: 20,  price: 300,  desc: '恢复宝可梦20点HP' },
  '好伤药': { id: 'superpotion', name: '好伤药', type: 'heal', heal: 60,  price: 700,  minBadges: 2, desc: '恢复宝可梦60点HP' },
  '全复药': { id: 'fullrestore', name: '全复药', type: 'heal', heal: 'full', price: 3000, minBadges: 8, desc: '完全恢复HP与异常状态' },
  '解毒药': { id: 'antidote', name: '解毒药', type: 'cure', cure: '中毒', price: 100,  desc: '解除中毒状态' },
  '解麻药': { id: 'paralyzeheal', name: '解麻药', type: 'cure', cure: '麻痹', price: 200,  desc: '解除麻痹状态' },
  '穿绳':   { id: 'escape_rope', name: '穿绳', type: 'escape', price: 550, minBadges: 2, desc: '瞬间返回最近到过的城镇' },
  '雷之石': { id: 'thunderstone', name: '雷之石', type: 'stone', stone: '雷之石', price: 2100, sell: 1000, desc: '让特定宝可梦进化的石头' },
  '火之石': { id: 'firestone', name: '火之石', type: 'stone', stone: '火之石', price: 2100, sell: 1000, desc: '让特定宝可梦进化的石头' },
  '水之石': { id: 'waterstone', name: '水之石', type: 'stone', stone: '水之石', price: 2100, sell: 1000, desc: '让特定宝可梦进化的石头' },
  '叶之石': { id: 'leafstone', name: '叶之石', type: 'stone', stone: '叶之石', price: 2100, sell: 1000, desc: '让特定宝可梦进化的石头' },
  '月亮石': { id: 'moonstone', name: '月亮石', type: 'stone', stone: '月亮石', price: 2100, sell: 1000, desc: '让特定宝可梦进化的石头' },
  '金珠':   { id: 'nugget', name: '金珠', type: 'loot', sell: 5000, desc: '可以高价卖出的贵重品' },
  'TM岩石封锁': { id: 'tm_rock_tomb', name: 'TM岩石封锁', type: 'tm', move: 'rock_tomb', desc: '让宝可梦习得招式：岩石封锁' },
  'TM泡沫光线': { id: 'tm_bubble_beam', name: 'TM泡沫光线', type: 'tm', move: 'bubble_beam', desc: '让宝可梦习得招式：泡沫光线' },
  '电气球':   { id: 'lightball', name: '电气球', type: 'held', desc: '只有皮卡丘能携带，携带后攻击与特攻翻倍' },
  '吃剩的东西': { id: 'leftovers', name: '吃剩的东西', type: 'held', desc: '携带后每回合结束恢复 1/16 最大HP' },
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
    id: 'viridian', name: '常磐市', type: 'town', next: ['route1', 'route2'],
    weatherWeights: { '晴': 90, '雨': 10 },
    desc: '常磐道馆大门紧锁，据说需要集齐七枚徽章才能挑战。',
    gymLocked: '常磐道馆大门紧锁，看起来要集齐七枚徽章才能挑战。'
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
      '晴': [ { id: 21, w: 40 }, { id: 19, w: 30 }, { id: 16, w: 20 }, { id: 50, w: 10 } ],
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
      '晴': [ { id: 41, w: 45 }, { id: 74, w: 35 }, { id: 35, w: 15 }, { id: 50, w: 5 } ],
      '沙暴': [ { id: 74, w: 40 }, { id: 50, w: 25 }, { id: 95, w: 20 }, { id: 41, w: 15 } ]
    },
    trainers: [
      { id: 'moon_t1', title: '火箭队队员', name: '马欧', prize: 420, text: '既然你诚心诚意地发问了……总之先吃我一招！', party: [{ id: 41, level: 10 }, { id: 74, level: 10 }] },
      { id: 'moon_t2', title: '理科男', name: '大介', prize: 380, text: '月见山的化石研究很忙的！', party: [{ id: 35, level: 11 }] }
    ]
  },
  cerulean: {
    id: 'cerulean', name: '华蓝市', type: 'town', next: ['mtmoon', 'route24'],
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
      '晴':    [ { id: 43, w: 30 }, { id: 48, w: 30 }, { id: 46, w: 20 }, { id: 21, w: 20 } ],
      '雨':    [ { id: 43, w: 20 }, { id: 48, w: 25 }, { id: 46, w: 15 }, { id: 21, w: 10 }, { id: 16, w: 15 }, { id: 19, w: 10 }, { id: 147, w: 5 } ],
      '雷阵雨': [ { id: 25, w: 40 }, { id: 43, w: 20 }, { id: 48, w: 20 }, { id: 21, w: 15 }, { id: 147, w: 5 } ]
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
      '晴': [ { id: 43, w: 30 }, { id: 48, w: 30 }, { id: 46, w: 20 }, { id: 35, w: 20 } ],
      '雨': [ { id: 43, w: 20 }, { id: 48, w: 20 }, { id: 35, w: 15 }, { id: 46, w: 10 }, { id: 21, w: 15 }, { id: 16, w: 12 }, { id: 147, w: 8 } ]
    },
    trainers: [
      { id: 'r25_t1', title: '露营少女', name: '小百合', prize: 720, text: '野营就要带着宝可梦一起！', party: [{ id: 35, level: 14 }, { id: 16, level: 14 }] }
    ]
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

// 商店货架（按徽章数量解锁）
const MART_STOCK = [
  { name: '精灵球', minBadges: 0 },
  { name: '伤药', minBadges: 0 },
  { name: '解毒药', minBadges: 0 },
  { name: '解麻药', minBadges: 0 },
  { name: '好伤药', minBadges: 2 },
  { name: '穿绳', minBadges: 2 },
  { name: '超级球', minBadges: 4 },
  { name: '高级球', minBadges: 6 },
  { name: '全复药', minBadges: 8 }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    WEATHER: WEATHER, ITEMS: ITEMS, MAP_NODES: MAP_NODES,
    ROCKET_EVENTS: ROCKET_EVENTS, START_ITEMS: START_ITEMS,
    START_MONEY: START_MONEY, MART_STOCK: MART_STOCK
  };
}
