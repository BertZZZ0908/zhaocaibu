// utils/marketSign.js · v2.2 · 签文数据源（本地 + 远程 API 优先 + 数据契约校验）
// 核心原则：所有字段都有有效默认值，poemAncient/poemModern 永远是 2 元素数组
// L1 防线：关键导出函数带运行时断言，缺失字段用安全默认值兜底 + console.error 暴露
// v2.2: 新增 fetchRemoteSign() — 连服务端 /api/sign 获取真实数据，失败降级本地 Mock

// ============ 远程 API 配置 ============
var API_CONFIG = {
  baseURL: '',  // 自动使用当前请求域名（同源）；开发时可设 'http://localhost:5818'
  timeout: 5000,  // 5 秒超时
};

// ============ L1 数据契约定义 ============
var SIGN_REQUIRED_FIELDS = [
  'date', 'stickNo', 'gradeKey', 'gradeCls', 'gradeLabel', 'gradeColor',
  'accentColor', 'bgImage', 'poemAncient', 'poemModern',
  'trend', 'mainLine', 'risk', 'action', 'isWeekend', 'expand'
];

var MASTER_REQUIRED_FIELDS = [
  'id', 'name', 'school', 'initial', 'color', 'verdict',
  'verdictCls', 'text', 'tactics', 'isLocked'
];

/**
 * L1 契约校验 — 签文对象完整性检查
 * 缺失字段用安全默认值填充，不静默吞掉错误
 * @param {Object} sign - 待校验的签文对象
 * @returns {Object} 校验后的签文对象（保证所有字段存在）
 */
function _validateSignContract(sign) {
  var errors = [];
  SIGN_REQUIRED_FIELDS.forEach(function(f) {
    if (sign[f] === undefined || sign[f] === null) {
      errors.push(f);
      // 安全默认值（按字段类型）
      switch (f) {
        case 'date': sign[f] = _formatDate(); break;
        case 'stickNo': sign[f] = '第一签'; break;
        case 'gradeKey': sign[f] = 'zhongji'; break; // P0-5: 统一小写 cls 形式
        case 'gradeCls': sign[f] = 'zhongji'; break;
        case 'gradeLabel': sign[f] = '中 吉'; break;
        case 'gradeColor': sign[f] = '#8A9A7D'; break;
        case 'accentColor': sign[f] = '#A8B89A'; break;
        case 'bgImage': sign[f] = '/assets/bg-zhongji.jpg'; break;
        case 'poemAncient': sign[f] = ['乾坤正气贯长虹', '财星高照运亨通']; break;
        case 'poemModern': sign[f] = ['顺势而为，乘势而上', '守正出奇，稳中求进']; break;
        case 'trend': sign[f] = '区间震荡'; break;
        case 'mainLine': sign[f] = '存量博弈加剧'; break;
        case 'risk': sign[f] = '中'; break;
        case 'action': sign[f] = '高抛低吸·快进快出'; break;
        case 'isWeekend': sign[f] = false; break;
        case 'expand':
          sign[f] = { sectorPick: [], sectorAvoid: [], darkHorse: '', northFlow: '', mainNetFlow: '' };
          break;
        default: sign[f] = '';
      }
    }
  });

  // poemAncient / poemModern 必须是 2 元素字符串数组
  if (!Array.isArray(sign.poemAncient) || sign.poemAncient.length !== 2) {
    errors.push('poemAncient[非2元素数组]');
    sign.poemAncient = ['乾坤正气贯长虹', '财星高照运亨通'];
  }
  if (!Array.isArray(sign.poemModern) || sign.poemModern.length !== 2) {
    errors.push('poemModern[非2元素数组]');
    sign.poemModern = ['顺势而为，乘势而上', '守正出奇，稳中求进'];
  }

  if (errors.length > 0) {
    console.error('[CONTRACT][ERROR] getMarketSign() 缺失/异常字段:', errors.join(', '), '| 已用默认值兜底');
  }

  return sign;
}

/**
 * L1 契约校验 — 大师列表完整性检查
 * @param {Array} masters - 待校验的大师列表
 * @returns {Array} 校验后的大师列表
 */
function _validateMastersContract(masters) {
  if (!Array.isArray(masters)) {
    console.error('[CONTRACT][ERROR] buildMasters() 返回非数组:', typeof masters);
    return [];
  }

  masters.forEach(function(m, i) {
    var missing = MASTER_REQUIRED_FIELDS.filter(function(f) {
      return m[f] === undefined || m[f] === null;
    });
    if (missing.length > 0) {
      console.error('[CONTRACT][ERROR] buildMasters() 大师[' + i + '](' + (m.name || '?') + ') 缺失:', missing.join(','));
      missing.forEach(function(f) { m[f] = ''; });
    }
  });

  return masters;
}

// ============ 签级配置 ============
const GRADE_MAP = {
  SHANG_SHANG: { cls: 'shangshang', label: '上 上', color: '#D4A853', accent: '#E8C97A', bgImage: '/assets/bg-shangshang.jpg' },
  SHANG_JI:   { cls: 'shangji',   label: '上 吉', color: '#C89A5B', accent: '#D4B07A', bgImage: '/assets/bg-shangji.jpg' },
  ZHONG_JI:   { cls: 'zhongji',   label: '中 吉', color: '#8A9A7D', accent: '#A8B89A', bgImage: '/assets/bg-zhongji.jpg' },
  ZHONG_PING: { cls: 'zhongping', label: '中 平', color: '#8A8DA0', accent: '#A0A3B5', bgImage: '/assets/bg-zhongping.jpg' },
  XIA_XIA:    { cls: 'xiaxia',    label: '下 下', color: '#B8334A', accent: '#d07090', bgImage: '/assets/bg-xiaxia.jpg' },
};

/** 根据 dateStr 或随机选择签等级 */
function _pickGrade(dateStr) {
  // 基于日期的确定性算法（同一天同一签）
  if (dateStr) {
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
      hash = ((hash << 5) - hash + dateStr.charCodeAt(i)) | 0;
    }
    const keys = Object.keys(GRADE_MAP);
    return keys[Math.abs(hash) % keys.length];
  }
  // 无日期时随机
  const keys = Object.keys(GRADE_MAP);
  return keys[Math.floor(Math.random() * keys.length)];
}

/** 格式化今日日期 — 对齐 H5: 2026.05.31 */
function _formatDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

// ============ 签号池 ============
const STICKS = [
  '第一签','第二签','第三签','第四签','第五签',
  '第六签','第七签','第八签','第九签','第十签',
  '第十一签','第十二签','第十三签','第十四签','第十五签',
  '第十六签','第十七签','第十八签','第十九签','第二十签',
  '第廿一签','第廿二签','第廿三签','第廿四签','第廿五签',
  '第廿六签','第廿七签','第廿八签','第廿九签','第三十签',
];

// ============ 诗句库（每级 1 组） ============
const POEMS = {
  shangshang: {
    ancient: ['乾坤正气贯长虹', '财星高照运亨通'],
    modern: ['顺势而为，乘势而上', '守正出奇，稳中求进'],
  },
  shangji: {
    ancient: ['春风得意马蹄疾', '一日看尽长安花'],
    modern: ['把握节奏，步步为营', '戒骄戒躁，行稳致远'],
  },
  zhongji: {
    ancient: ['山重水复疑无路', '柳暗花明又一村'],
    modern: ['耐心等待时机成熟', '不宜冒进，以稳为主'],
  },
  zhongping: {
    ancient: ['风起于青萍之末', '浪成于微澜之间'],
    modern: ['观望为主，少动多看', '控制仓位，降低预期'],
  },
  xiaxia: {
    ancient: ['乱云飞渡仍从容', '无限风光在险峰'],
    modern: ['宜静制动，暂避锋芒', '休养生息，以待天时'],
  },
};

// ============ 趋势文案 ============
const TRENDS = {
  shangshang: { trend: '多头格局确立', mainLine: '科技+消费双轮驱动', action: '积极布局·持股待涨' },
  shangji:   { trend: '偏强震荡', mainLine: '结构性行情延续', action: '逢低吸纳·控制仓位' },
  zhongji:   { trend: '区间震荡', mainLine: '存量博弈加剧', action: '高抛低吸·快进快出' },
  zhongping: { trend: '弱势整理', mainLine: '缺乏明确主线', action: '降低仓位·多看少动' },
  xiaxia:    { trend: '避险情绪升温', mainLine: '资金流出明显', action: '空仓观望·保本为先' },
};

/**
 * 获取今日签文数据（纯本地计算，无网络依赖）
 * @returns {Object} 完整的签文对象，所有字段均有有效值
 */
function getMarketSign() {
  const dateStr = _formatDate();
  const gradeKey = _pickGrade(dateStr);
  const meta = GRADE_MAP[gradeKey];
  // Bug#009 fix: POEMS/TRENDS 用小写 cls 键（如 'shangshang'），不能用 gradeKey（'SHANG_SHANG' 大写格式）
  const lookupKey = meta.cls;
  const poem = POEMS[lookupKey] || POEMS['zhongji'];
  const trend = TRENDS[lookupKey] || TRENDS['zhongji'];

  // 从签号池中确定性选取
  let stickIdx = 0;
  for (let i = 0; i < dateStr.length; i++) {
    stickIdx = (stickIdx * 31 + dateStr.charCodeAt(i)) % STICKS.length;
  }

  // 构建签文对象（先组装，再做契约校验，最后返回）
  // P0-5 修复：gradeKey 统一存小写 cls 形式（shangshang/shangji/zhongji/zhongping/xiaxia），
  // 与 risk/buildMasters 判断保持一致；同时保留 gradeKeyRaw 大写形式供调试
  const sign = {
    // 基本信息
    date: dateStr,
    gradeKey: lookupKey,           // 小写 cls 形式
    gradeKeyRaw: gradeKey,         // 大写下划线形式（GRADE_MAP 的 key）
    gradeCls: meta.cls,
    gradeLabel: meta.label,
    gradeColor: meta.color,
    accentColor: meta.accent,
    bgImage: meta.bgImage,

    // 签号
    stickNo: STICKS[stickIdx],

    // 诗句（永远是非空 2 元素数组）
    poemAncient: [poem.ancient[0], poem.ancient[1]],
    poemModern: [poem.modern[0], poem.modern[1]],

    // 市场趋势
    trend: trend.trend,
    mainLine: trend.mainLine,
    risk: lookupKey === 'xiaxia' ? '高' : lookupKey === 'zhongping' ? '中' : '低', // P0-5: 用小写 lookupKey 统一比对
    action: trend.action,

    // 是否周末
    isWeekend: new Date().getDay() === 0 || new Date().getDay() === 6,

    // 展开详情（占位）
    expand: {
      sectorPick: [],
      sectorAvoid: [],
      darkHorse: '',
      northFlow: '',
      mainNetFlow: '',
    },
  };

  // L1 数据契约校验 — 保证返回对象字段完整
  return _validateSignContract(sign);
}

/**
 * v2.2: 从远程服务器获取真实签文数据
 * 优先调 serve_flask.py /api/sign 接口，解析沪指真实涨跌幅算签级
 * 5s 超时降级到本地 getMarketSign()
 * @returns {Promise<{sign: Object, source: string}>}
 */
function fetchRemoteSign() {
  return new Promise(function(resolve) {
    var url = (API_CONFIG.baseURL || '') + '/api/sign';

    wx.request({
      url: url,
      method: 'GET',
      timeout: API_CONFIG.timeout,
      success: function(res) {
        if (res.statusCode === 200 && res.data && res.data.grade) {
          try {
            var raw = res.data;
            var meta = GRADE_MAP[raw.grade] || GRADE_MAP['ZHONG_JI'];
            var sign = getMarketSign(); // 基础骨架（诗句/签号等）
            
            // 用真实数据覆盖关键字段
            if (raw.trend) sign.trend = raw.trend;
            if (raw.mainLine) sign.mainLine = raw.mainLine;
            if (raw.risk) sign.risk = raw.risk;
            if (raw.action) sign.action = raw.action;
            if (raw.grade) {
              sign.gradeKey = meta.cls;
              sign.gradeKeyRaw = raw.grade;
              sign.gradeCls = meta.cls;
              sign.gradeLabel = meta.label;
              sign.gradeColor = meta.color;
              sign.accentColor = meta.accent;
              sign.bgImage = meta.bgImage;
            }
            if (raw.expand) {
              sign.expand = raw.expand;
            }
            if (raw.dataSource) sign.dataSource = raw.dataSource;
            else sign.dataSource = '● 远程实时 · 服务端';

            console.log('[MarketSign] ✓ 远程数据已接入 签级:' + sign.gradeLabel + ' 趋势:' + (sign.trend || 'N/A'));
            resolve({ sign: _validateSignContract(sign), source: 'remote' });
          } catch(e) {
            console.warn('[MarketSign] 远程数据解析失败:', e.message);
            resolve({ sign: getMarketSign(), source: 'mock' });
          }
        } else {
          console.warn('[MarketSign] 远程 API 返回异常 status=' + res.statusCode);
          resolve({ sign: getMarketSign(), source: 'mock' });
        }
      },
      fail: function(err) {
        console.warn('[MarketSign] ✗ 远程请求失败(' + err.errMsg + ')，降级本地 Mock');
        resolve({ sign: getMarketSign(), source: 'mock' });
      }
    });
  });
}

// ============ 大师团定义 ============
const MASTER_DEFS = [
  { id: 'oneill',     name: '奥尼尔',    school: '趋势派',   initial: '奥', color: '#E74C3C', isFree: true,  verdict: 'HOLD', verdictCls: 'hold' },
  { id: 'caijin',     name: '蔡金',      school: '资金派',   initial: '蔡', color: '#3498DB', isFree: true,  verdict: 'HOLD', verdictCls: 'hold' },
  { id: 'graham',     name: '格雷厄姆',  school: '价值派',   initial: '格', color: '#27AE60', isFree: false, verdict: 'LOOK', verdictCls: 'look', priceSingle: 9.9, priceMonth: 29, feature: '安全边际分析' },
  { id: 'howard',     name: '霍华德',    school: '周期派',   initial: '霍', color: '#F39C12', isFree: false, verdict: 'SELL', verdictCls: 'sell', priceSingle: 9.9, priceMonth: 29, feature: '市场周期定位' },
  { id: 'shorty',     name: '短线客',    school: '游资派',   initial: '短', color: '#E67E22', isFree: false, verdict: 'BUY',  verdictCls: 'buy',  priceSingle: 19.9, priceMonth: 49, feature: '龙头打板战法' },
  { id: 'simons',     name: '西蒙斯',    school: '量化派',   initial: '西', color: '#9B59B6', isFree: false, verdict: 'LOOK', verdictCls: 'look', priceSingle: 19.9, priceMonth: 49, feature: '统计套利模型' },
  { id: 'kahneman',   name: '卡尼曼',    school: '行为派',   initial: '卡', color: '#1ABC9C', isFree: false, verdict: 'HOLD', verdictCls: 'hold', priceSingle: 9.9, priceMonth: 29, feature: '散户心理画像' },
  { id: 'laozhang',   name: '老张',      school: '散户派',   initial: '张', color: '#95A5A6', isFree: false, verdict: 'SELL', verdictCls: 'sell', priceSingle: 9.9, priceMonth: 29, feature: '韭菜自救指南' },
];

/**
 * 构建大师团列表（基于签文数据生成观点）
 * @param {Object} sign - getMarketSign() 返回的签文对象
 * @returns {Array<Object>} 8 位大师数据，每个都包含完整字段
 */
function buildMasters(sign) {
  // L3 安全输入：如果传入的 sign 缺少关键字段，用 getMarketSign() 补全
  var s = sign;
  if (!s || typeof s !== 'object' ||
      !s.trend || !s.mainLine || !s.action || !s.gradeKey) {
    s = getMarketSign();
  }

  const actionMap = {
    '积极布局': { BUY: 2, LOOK: 3, SELL: 1, HOLD: 2 },
    '逢低吸纳': { BUY: 2, LOOK: 4, SELL: 0, HOLD: 2 },
    '高抛低吸': { BUY: 1, LOOK: 2, SELL: 3, HOLD: 2 },
    '降低仓位': { BUY: 0, LOOK: 2, SELL: 3, HOLD: 3 },
    '空仓观望': { BUY: 0, LOOK: 1, SELL: 4, HOLD: 3 },
  };
  // P0-2 修复：TRENDS 的 action 字符串带 '·' 后缀（如 '积极布局·持股待涨'），
  // actionMap 的 key 是 4 字短语前缀，必须用 split('·')[0] 对齐
  const actionKey = (s.action || '').split('·')[0];
  const dist = actionMap[actionKey] || actionMap['降低仓位'];

  // P0-5 修复：8 位大师 verdict 按各自流派理念绑定，不再 Fisher-Yates 随机洗牌
  // 每位大师有独立判断逻辑：趋势派看 sh 涨跌、价值派看估值/分位、资金派看主力净流入...
  // gradeKey 取值：shangshang | shangji | zhongji | zhongping | xiaxia
  const isBull = s.gradeKey === 'shangshang' || s.gradeKey === 'shangji';
  const isBear = s.gradeKey === 'xiaxia';
  const isFlat = s.gradeKey === 'zhongji' || s.gradeKey === 'zhongping';
  // 用日期 + 流派做确定性扰动，避免每次刷新观点都变
  const _seed = (s.date || '').split('-').reduce(function(a,b){ return a + parseInt(b,10); }, 0);
  // 8 位大师按 MASTER_DEFS 顺序的 verdict
  // 顺序：oneill / caijin / graham / howard / shorty / simons / kahneman / laozhang
  const masterVerdicts = [
    // 1. 奥尼尔（趋势派）：CANSLIM 顺势而为，多头看多，空头空仓
    isBull ? 'BUY' : isBear ? 'SELL' : 'LOOK',
    // 2. 蔡金（资金派）：跟主力资金走，强势 BUY，弱势 SELL，震荡看分布
    s.gradeKey === 'shangshang' ? 'BUY' : isBear ? 'SELL' : (_seed % 2 === 0 ? 'LOOK' : 'HOLD'),
    // 3. 格雷厄姆（价值派）：越跌越买（安全边际理念），熊市反而是机会
    isBear ? 'BUY' : isBull ? 'HOLD' : 'LOOK',
    // 4. 霍华德（周期派）：人恐惧我贪婪，与市场情绪反向，极端时逆向操作
    s.gradeKey === 'xiaxia' ? 'BUY' : s.gradeKey === 'shangshang' ? 'SELL' : 'HOLD',
    // 5. 短线客（游资派）：只做最强龙头，多头狂热才出手
    s.gradeKey === 'shangshang' ? 'BUY' : isBull ? 'LOOK' : 'SELL',
    // 6. 西蒙斯（量化派）：不猜方向只跟信号，区间震荡时观望，趋势明确才动
    isFlat ? 'LOOK' : isBull ? 'BUY' : 'SELL',
    // 7. 卡尼曼（行为派）：散户高位贪婪→提示卖出，低位恐惧→提示买入
    s.gradeKey === 'shangshang' ? 'SELL' : isBear ? 'BUY' : 'HOLD',
    // 8. 老张（散户派）：随大流但不极端，趋势好就拿，趋势差就割
    isBull ? 'HOLD' : isBear ? 'SELL' : 'LOOK',
  ];

  // 为每位大师分配独立观点（v2.2: 增加日轮换变体，避免同签级一字不差）
  var _daySeed = new Date().getDate(); // 1-31 天作为轮换种子
  var masterTexts = [
    { text: `${s.trend}，${s.mainLine.split('+')[0]}方向值得关注。`, tactics: _daySeed % 3 === 0 ? '关注成交量变化确认趋势' : (_daySeed % 3 === 1 ? '结合均线排列判断方向' : '观察突破后回踩是否有效') },
    { text: `主力资金${s.gradeKey === 'shangshang' ? '持续流入' : s.gradeKey === 'xiaxia' ? '加速流出' : '震荡分化'}，需密切跟踪北向动态。`, tactics: _daySeed % 2 === 0 ? '跟踪北向资金+融资余额' : '关注大单流向+龙虎榜' },
    { text: `当前估值处于${s.gradeKey === 'shangshang' || s.gradeKey === 'shangji' ? '合理偏低' : '偏高'}区间，建议${s.action.split('·')[0]}。`, tactics: 'PE/PB 分位数对比历史' },
    { text: `从周期角度看，市场处于${s.gradeKey === 'xiaxia' ? '衰退后期' : '复苏阶段'}，${s.isWeekend ? '节后观察开盘方向为宜' : _daySeed % 2 === 0 ? '保持耐心等待信号确认' : '关注信用周期和库存周期拐点'}.`, tactics: '信用周期+库存周期交叉验证' },
    { text: `短线情绪${s.gradeKey === 'shangshang' ? '亢奋' : _daySeed % 2 === 0 ? '低迷' : '偏冷'}，涨停家数${s.gradeKey === 'shangshang' ? '偏多' : '偏少'}，连板高度有限。`, tactics: '关注首板晋级率' },
    { text: `量化因子显示：动量因子${isBull ? '强势' : '弱势'}，波动率因子发出${s.risk === '低' ? '跟进' : '减配'}信号。`, tactics: _daySeed % 3 === 0 ? '多因子风险平配模型' : (_daySeed % 3 === 1 ? '关注波动率回归策略' : '动量反转双因子轮动') },
    { text: `散户情绪指数${s.gradeKey === 'shangshang' ? '贪婪' : s.gradeKey === 'xiaxia' ? '恐惧' : '中性'}，逆向指标提示${s.gradeKey === 'xiaxia' || s.gradeKey === 'zhongping' ? _daySeed % 2 === 0 ? '可能接近底部' : '下行空间或有限' : '追高风险较大'}.`, tactics: '恐慌指数+杠杆资金' },
    { text: `作为一个普通股民，我的建议是：${s.action}。不要频繁操作，${s.isWeekend ? '周末好好研究基本面' : _daySeed % 3 === 0 ? '管住手才是赚钱的开始' : (_daySeed % 3 === 1 ? '少看盘多读书' : '定投比择时更重要')}.`, tactics: '定投指数 > 个股择时' },
  ];

  // P0-5 修复：直接使用 masterVerdicts（按流派绑定），不再 Fisher-Yates 随机
  // 保留 dist 仅用于 buildPremiumMasters 兼容（已弃用但暂不删，后续清理）
  var result = MASTER_DEFS.map(function(def, i) {
    var v = masterVerdicts[i] || 'HOLD';
    var vCls = v.toLowerCase();
    var t = masterTexts[i] || masterTexts[0];
    return {
      ...def,
      verdict: v,
      verdictCls: vCls,
      text: t.text,
      tactics: t.tactics,
      detail: null,
      isLocked: !def.isFree,
    };
  });

  // L1 数据契约校验 — 保证每位大师字段完整
  return _validateMastersContract(result);
}

/**
 * 构建付费大师团列表（用于购买弹窗展示）
 * @param {Object} sign - getMarketSign() 返回的签文对象
 * @returns {Array<Object>} 6 位付费大师数据
 */
function buildPremiumMasters(sign) {
  var s = sign;
  if (!s || typeof s !== 'object' || !s.gradeKey) {
    s = getMarketSign();
  }

  // 6位付费大师定义（对齐 H5 购买弹窗）
  var defs = [
    { id: 'graham',   name: '格雷厄姆',      school: '价值派',   initial: '格', color: '#27AE60', feature: '越跌越买赚成长的钱，安全边际是底线',       priceSingle: 1.99 },
    { id: 'howard',   name: '霍华德·马克斯', school: '周期派',   initial: '霍', color: '#F39C12', feature: '极端情绪时逆向操作，人恐惧我贪婪',         priceSingle: 1.99 },
    { id: 'shorty',   name: '短线客',        school: '游资派',   initial: '短', color: '#E67E22', feature: '只做最强龙头，弱的就是错的',               priceSingle: 1.99 },
    { id: 'simons',   name: '西蒙斯',        school: '量化派',   initial: '西', color: '#9B59B6', feature: '不猜方向只跟信号，概率说话',               priceSingle: 1.99 },
    { id: 'kahneman', name: '卡尼曼',        school: '行为派',   initial: '卡', color: '#1ABC9C', feature: '战胜贪婪与恐惧才是真alpha',                priceSingle: 1.99 },
    { id: 'laozhang', name: '老张',          school: '散户派',   initial: '张', color: '#95A5A6', feature: '读懂散户情绪，逆向收割羊群效应',           priceSingle: 1.99 },
  ];

  // 基于签文等级分配 verdict（与 buildMasters 一致）
  var actionMap = {
    '积极布局': { BUY: 2, LOOK: 3, SELL: 1, HOLD: 2 },
    '逢低吸纳': { BUY: 2, LOOK: 4, SELL: 0, HOLD: 2 },
    '高抛低吸': { BUY: 1, LOOK: 2, SELL: 3, HOLD: 2 },
    '降低仓位': { BUY: 0, LOOK: 2, SELL: 3, HOLD: 3 },
    '空仓观望': { BUY: 0, LOOK: 1, SELL: 4, HOLD: 3 },
  };
  // P0-2 修复：用 split('·')[0] 取前缀对齐
  var pmActionKey = (s.action || '').split('·')[0];
  var dist = actionMap[pmActionKey] || actionMap['降低仓位'];

  // P0-5 修复：6 位付费大师 verdict 也按流派绑定（与 buildMasters 一致）
  // 顺序对齐 MASTER_DEFS 的 [2..7]：graham/howard/shorty/simons/kahneman/laozhang
  var isBull = s.gradeKey === 'shangshang' || s.gradeKey === 'shangji';
  var isBear = s.gradeKey === 'xiaxia';
  var isFlat = s.gradeKey === 'zhongji' || s.gradeKey === 'zhongping';
  var premiumVerdicts = [
    isBear ? 'BUY' : isBull ? 'HOLD' : 'LOOK',                            // graham 价值派：越跌越买
    s.gradeKey === 'xiaxia' ? 'BUY' : s.gradeKey === 'shangshang' ? 'SELL' : 'HOLD', // howard 周期派：极端逆向
    s.gradeKey === 'shangshang' ? 'BUY' : isBull ? 'LOOK' : 'SELL',       // shorty 游资派：只做强龙头
    isFlat ? 'LOOK' : isBull ? 'BUY' : 'SELL',                            // simons 量化派：跟信号
    s.gradeKey === 'shangshang' ? 'SELL' : isBear ? 'BUY' : 'HOLD',       // kahneman 行为派：反人性
    isBull ? 'HOLD' : isBear ? 'SELL' : 'LOOK',                           // laozhang 散户派：随大流
  ];

  return defs.map(function(def, idx) {
    var v = premiumVerdicts[idx] || 'HOLD';
    return Object.assign({}, def, {
      verdict: v,
      verdictCls: v.toLowerCase(),
      isLocked: true,
      isFree: false,
    });
  });
}

/**
 * 获取当前交易时段
 * @returns {string} PRE_MARKET / MORNING_SESSION / AFTERNOON_SESSION / CLOSING / HOLIDAY 等
 */
function getSessionPhase() {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const timeVal = hour * 100 + minute;

  if (day === 0 || day === 6) return 'HOLIDAY';
  if (timeVal < 915) return 'PRE_MARKET';
  if (timeVal < 930) return 'CALL_AUCTION';
  if (timeVal < 1130) return 'MORNING_SESSION';
  if (timeVal < 1300) return 'LUNCH_BREAK';
  if (timeVal < 1500) return 'AFTERNOON_SESSION';
  if (timeVal < 1600) return 'CLOSING';
  return 'AFTER_HOURS';
}

module.exports = {
  getMarketSign,
  fetchRemoteSign,
  buildMasters,
  buildPremiumMasters,
  getSessionPhase,
  GRADE_MAP,
  MASTER_DEFS,
};
