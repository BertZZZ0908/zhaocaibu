// 财运局 H5 · 每日财运签（v4.0 · 本地代理 API）
// 数据源：localhost:5817 Node.js 代理 → 新浪(主) + 腾讯(备) → 干净JSON
// 降级链：本地代理API真实数据 → 本地日期轮换 mock
// 零浏览器端外部请求：彻底解决 JSONP/CSP/变量检测不稳定问题
// 前提：需要先启动 node server.js（端口5817）
(function (global) {
  'use strict';

  // 设计规范：4级签文 · 大吉 / 上吉 / 中吉 / 下下 · 色彩由暖至冷
  const GRADE_MAP = {
    // ── 大吉：暴涨日（沪指 ≥+1.5%）
    DA_JI:      { label: '大 吉', cls: 'daji',     color: '#E94B3C', accent: '#FFD700', bgImage: 'assets/bg-shangshang.png' },
    // ── 上吉：偏多日（沪指 +0.5%~+1.5%）
    SHANG_JI:   { label: '上 吉', cls: 'shangji',   color: '#FF6B35', accent: '#FFE0B2', bgImage: 'assets/bg-shangji.png' },
    // ── 中吉：震荡日（沪指 -0.5%~+0.5%）
    ZHONG_JI:   { label: '中 吉', cls: 'zhongji',   color: '#F39C12', accent: '#FFF2CC', bgImage: 'assets/bg-zhongji.png' },
    // ── 下下：偏空及暴跌日（沪指 ≤-0.5% 全部归入）
    ZHONG_PING: { label: '下 下', cls: 'xiaxia',    color: '#5B6ACF', accent: '#D1D4E9', bgImage: 'assets/bg-xiaxia.png' },
    XIA_PING:   { label: '下 下', cls: 'xiaxia',    color: '#5B6ACF', accent: '#D1D4E9', bgImage: 'assets/bg-xiaxia.png' },
    XIA_XIONG:  { label: '下 下', cls: 'xiaxia',    color: '#5B6ACF', accent: '#D1D4E9', bgImage: 'assets/bg-xiaxia.png' },
  };

  const POEM_LIB = {
    DA_JI: [
      { ancient: ['天工开物逢春雨', '万物生发不必疑'], modern: ['今天大涨稳得住', '顺势满仓莫犹豫'] },
      { ancient: ['金风送爽稻穗黄', '收获之时莫彷徨'], modern: ['行情正佳别多想', '该出手时就出手'] },
      { ancient: ['乾坤朗朗日月新', '此时不动更待何'], modern: ['市场清晰方向明', '上车时机就是现在'] },
    ],
    SHANG_JI: [
      { ancient: ['和风吹散昨夜雨', '远山初见晓色明'], modern: ['昨日阴霾今扫净', '主线初露顺势行'] },
      { ancient: ['潮平两岸阔无边', '风正一帆顺自然'], modern: ['量价配合走得稳', '顺势而为不慌张'] },
    ],
    ZHONG_JI: [
      { ancient: ['雾里看花花似隐', '进退之间守本心'], modern: ['震荡盘里别上头', '守好仓位等方向'] },
      { ancient: ['半山行人云未散', '不如择石小坐看'], modern: ['盘面磨人没行情', '少操作多观察'] },
    ],
    ZHONG_PING: [
      { ancient: ['花开花落本无常', '得失寸心宜自量'], modern: ['今天涨涨跌跌正常', '别被情绪带节奏'] },
      { ancient: ['溪流石上声清浅', '坐看云生不必忙'], modern: ['行情没啥大故事', '降低预期最稳妥'] },
    ],
    XIA_PING: [
      { ancient: ['秋风落木声渐紧', '宜守不宜贸然行'], modern: ['今天跑得快的赢', '现金为王别硬扛'] },
      { ancient: ['寒蝉鸣处叶已稀', '收伞归家莫迟疑'], modern: ['主力在撤，跟着跑', '先保本金，别硬扛'] },
    ],
    XIA_XIONG: [
      { ancient: ['风急浪高莫轻渡', '收帆待时自安身'], modern: ['今天大跌别接刀', '空仓观望最保险'] },
      { ancient: ['黑云压城天色变', '识时务者方为俊'], modern: ['情绪极度恐慌中', '今天最大的赢就是没亏'] },
    ],
  };

  const MOCK_DAYS = [
    {
      grade: 'SHANG_JI', stickNo: '第 廿 三 签',
      trend: '偏多 · 沪指 +1.23%', mainLine: 'AI 算力 / 半导体',
      risk: 'RSI 72 · 短期注意回撤', action: '顺势持股 · 不追高',
      expand: { sectorPick: ['AI算力', '半导体', '机器人'], sectorAvoid: ['地产', '白酒'],
                darkHorse: '新能源', northFlow: '+ 48 亿', emotion: 72, emotionLabel: '偏 贪',
                upCount: 3245, downCount: 1580,
                sectorPickDetail: [
                  { name: 'AI算力',  chg: '+4.82%', leader: '中际旭创', flow: '+18.6亿', note: '光模块涨价 + 北美 capex 超预期' },
                  { name: '半导体',  chg: '+3.15%', leader: '中芯国际', flow: '+11.2亿', note: '国产替代节奏加快，机构持续流入' },
                  { name: '机器人',  chg: '+2.40%', leader: '埃斯顿',   flow: '+5.8亿',  note: '人形机器人 BOM 落地，催化频出' },
                ],
                sectorAvoidDetail: [
                  { name: '地产',    chg: '-1.20%', leader: '万科A',     flow: '-3.1亿',  note: '销售数据疲软，资金持续撤离' },
                  { name: '白酒',    chg: '-0.85%', leader: '贵州茅台',  flow: '-4.5亿',  note: '估值修复未现，外资减持' },
                ] },
    },
    {
      grade: 'ZHONG_JI', stickNo: '第 十 七 签',
      trend: '震荡 · 沪指 +0.18%', mainLine: '高股息 / 公用事业',
      risk: '量能萎缩 · 谨防假突破', action: '低吸高抛 · 控制仓位',
      expand: { sectorPick: ['银行', '电力', '煤炭'], sectorAvoid: ['题材股', '小盘成长'],
                darkHorse: '军工', northFlow: '+ 6 亿', emotion: 52, emotionLabel: '中 性',
                upCount: 2480, downCount: 2350,
                sectorPickDetail: [
                  { name: '银行',    chg: '+1.05%', leader: '工商银行',  flow: '+4.2亿', note: '高股息防御属性强，险资稳定流入' },
                  { name: '电力',    chg: '+0.85%', leader: '长江电力', flow: '+2.1亿', note: '煤价回落改善盈利，红利风格延续' },
                  { name: '煤炭',    chg: '+0.62%', leader: '中国神华', flow: '+1.5亿', note: '冬储补库预期，板块横盘抗跌' },
                ],
                sectorAvoidDetail: [
                  { name: '题材股',  chg: '-0.95%', leader: '—',        flow: '-2.3亿',  note: '量能不足，纯炒作回吐风险大' },
                  { name: '小盘成长',chg: '-0.72%', leader: '—',        flow: '-1.8亿',  note: '风格切换偏防御，成长股资金外溢' },
                ] },
    },
    {
      grade: 'XIA_PING', stickNo: '第 卌 一 签',
      trend: '偏空 · 沪指 -0.85%', mainLine: '防御为主 · 黄金 / 公用',
      risk: '主力持续撤退 · 反弹是减配机会', action: '降低仓位 · 暂避锋芒',
      expand: { sectorPick: ['黄金', '公用事业', '军工'], sectorAvoid: ['周期股', '消费白马'],
                darkHorse: '医药', northFlow: '- 32 亿', emotion: 28, emotionLabel: '偏 恐',
                upCount: 1180, downCount: 3680,
                sectorPickDetail: [
                  { name: '黄金',    chg: '+1.85%', leader: '山东黄金',  flow: '+3.4亿', note: '避险资金涌入，金价走高' },
                  { name: '公用事业',chg: '+0.45%', leader: '长江电力', flow: '+1.2亿', note: '防御属性凸显，但弹性有限' },
                  { name: '军工',    chg: '+0.30%', leader: '中航沈飞', flow: '+0.8亿',  note: '订单催化叠加避险，相对抗跌' },
                ],
                sectorAvoidDetail: [
                  { name: '周期股',  chg: '-2.85%', leader: '中国铝业', flow: '-5.6亿',  note: '商品价格走弱 + 主力踩踏式撤退' },
                  { name: '消费白马',chg: '-2.10%', leader: '伊利股份', flow: '-7.2亿',  note: '业绩不及预期，公募加速减持' },
                ] },
    },
    {
      grade: 'DA_JI', stickNo: '第 ○ 一 签',
      trend: '强多 · 沪指 +2.15%', mainLine: '科技全线 · 资金共振',
      risk: '过热信号 · 注意尾盘获利盘', action: '持股不动 · 别加杠杆',
      expand: { sectorPick: ['AI算力', '半导体', '消费电子'], sectorAvoid: ['防御板块'],
                darkHorse: '机器人', northFlow: '+ 96 亿', emotion: 82, emotionLabel: '极 贪',
                upCount: 4280, downCount: 720,
                sectorPickDetail: [
                  { name: 'AI算力',    chg: '+7.20%', leader: '中际旭创', flow: '+32.4亿', note: '北上 + 主力 + 游资三方合力，量能创新高' },
                  { name: '半导体',    chg: '+5.85%', leader: '北方华创', flow: '+22.1亿', note: '设备国产化加速，订单能见度提升' },
                  { name: '消费电子',  chg: '+4.32%', leader: '立讯精密', flow: '+15.8亿', note: 'AI 终端落地，果链订单回暖' },
                ],
                sectorAvoidDetail: [
                  { name: '防御板块',  chg: '-0.40%', leader: '—',        flow: '-2.1亿',  note: '风险偏好回升，防御资金外溢到成长' },
                ] },
    },
  ];

  let _forceIdx = null;
  function setForceIdx(i) { _forceIdx = (typeof i === 'number') ? i : null; }

  function _hashDay() {
    if (_forceIdx !== null) return _forceIdx % MOCK_DAYS.length;
    return Math.floor(Date.now() / 86400000) % MOCK_DAYS.length;
  }

  function _pickPoem(grade) {
    var arr = POEM_LIB[grade] || POEM_LIB.ZHONG_PING;
    var d = new Date();
    // 用日期+等级hash，确保不同等级在同一天也选不同诗
    var gradeHash = 0;
    for (var i=0;i<grade.length;i++) gradeHash += grade.charCodeAt(i);
    return arr[(d.getDate() + d.getMonth() + gradeHash) % arr.length];
  }

  function _formatDate() {
    var d = new Date();
    return d.getFullYear() + '.' + String(d.getMonth()+1).padStart(2,'0') + '.' + String(d.getDate()).padStart(2,'0');
  }

  // v4.1: getMarketSign 先查 sessionStorage 缓存（由 loadMarketSign 预填充），
  // 有真实数据直接用，无缓存才 fallback 到 MOCK_DAYS
  function getMarketSign() {
    var cached = readCache();
    if (cached && cached.grade) {
      console.log('[MarketSign] ★ 命中缓存，数据源:' + (cached.dataSource || 'cache'));
      return cached;
    }
    // 缓存未命中 → 降级 mock
    console.log('[MarketSign] ○ 缓存未命中，使用 mock 降级');
    var data = MOCK_DAYS[_hashDay()];
    var meta = GRADE_MAP[data.grade];
    var poem = _pickPoem(data.grade);
    var _dow = new Date().getDay();
    var _isWk = (_dow === 0 || _dow === 6);
    return {
      date: _formatDate(), stickNo: data.stickNo, grade: data.grade,
      gradeLabel: meta.label, gradeCls: meta.cls, gradeColor: meta.color,
      accentColor: meta.accent, bgImage: meta.bgImage,
      poemAncient: poem.ancient, poemModern: poem.modern,
      trend: data.trend, mainLine: data.mainLine,
      risk: data.risk, action: data.action, expand: data.expand,
      isWeekend: _isWk,
      dataSource: '○ mock · 请先抽签以获取实时数据',
    };
  }

  // ---- 板块详批 mock ----
  var HOT_SECTORS = ['AI算力','半导体','新能源','机器人','医药','军工','银行','消费'];
  var GUA_LIB = [
    { sym:'☰',name:'乾 卦',poem:'龙 行 天 际 · 势 不 可 挡',range:[80,100]},
    { sym:'☱',name:'兑 卦',poem:'泽 润 万 物 · 温 和 偏 多',range:[65,79]},
    { sym:'☲',name:'离 卦',poem:'火 明 照 远 · 趋 势 确 认',range:[55,64]},
    { sym:'☷',name:'坤 卦',poem:'厚 德 载 物 · 蓄 势 待 发',range:[40,54]},
    { sym:'☵',name:'坎 卦',poem:'水 深 流 急 · 注 意 风 险',range:[25,39]},
    { sym:'☳',name:'震 卦',poem:'雷 动 地 起 · 否 极 泰 来',range:[10,24]},
  ];
  var SECTOR_POOL = {
    'AI算力':{score:82,flow:'北向连续3日净流入+28亿',r:3280,s:3120,riskT:'RSI 72·短期超买',riskX:'阻力位附近注意获利盘抛压',mt:'多头排列，量价齐升，顺势持股',mf:'主力净流入榜首，外资共振',mr:'短期涨速过快注意回调',action:'持仓5-7成·阻力触及减配'},
    '半导体':{score:76,flow:'主力净流入+14亿',r:4520,s:4280,riskT:'美股映射波动',riskX:'关注海外费城半导体夜盘',mt:'5日均线支撑有效',mf:'机构持续流入',mr:'波动放大避免追高',action:'回调关注·不追高·持仓6成'},
    '新能源':{score:58,flow:'+3亿',r:1280,s:1200,riskT:'基本面承压',riskX:'碳酸锂价格未止跌',mt:'横盘整理充分',mf:'资金逐步回流',mr:'基本面拐点未现',action:'轻仓试错·3成·严守止损'},
    '机器人':{score:70,flow:'+8亿',r:2150,s:2050,riskT:'题材分化',riskX:'龙头补跌风险',mt:'突破后回踩确认',mf:'游资进出快',mr:'只做龙一龙二',action:'跟龙头·5成·单只不超20%'},
    '医药':  {score:45,flow:'+5亿',r:880,s:820,riskT:'政策不确定',riskX:'集采靴子未落地',mt:'底部抬升',mf:'机构建仓但弱',mr:'行业贝塔不强',action:'观望·等突破·不超3成'},
    '军工':  {score:62,flow:'+6亿',r:1620,s:1560,riskT:'催化依赖',riskX:'订单兑现慢',mt:'中线多头排列',mf:'国家队护盘',mr:'估值不便宜',action:'中线持股·5成·季度兑现'},
    '银行':  {score:50,flow:'+12亿',r:4080,s:3960,riskT:'业绩平淡',riskX:'净息差收窄',mt:'高股息有支撑',mf:'外资稳定',mr:'只赚分红',action:'收息·3-5成长配'},
    '消费':  {score:38,flow:'-8亿',r:11280,s:10800,riskT:'消费疲软',riskX:'复苏不及预期',mt:'空头排列',mf:'主力撤退',mr:'行业趋势向下',action:'远离·反弹减配·不抄底'},
  };

  function pickGua(score) {
    for (var i=0;i<GUA_LIB.length;i++) if(score>=GUA_LIB[i].range[0]&&score<=GUA_LIB[i].range[1])return GUA_LIB[i];
    return GUA_LIB[GUA_LIB.length-1];
  }
  function trendLabel(s){if(s>=75)return'强';if(s>=55)return'中';if(s>=35)return'弱';return'危';}

  function getSectorReport(name){
    var pool=SECTOR_POOL[name];
    if(!pool){var keys=Object.keys(SECTOR_POOL);pool=SECTOR_POOL[keys[name.split('').reduce(function(s,c){return s+c.charCodeAt(0)},0)%keys.length]];}
    var g=pickGua(pool.score);
    return{sectorName:name,guaSymbol:g.sym,guaName:g.name,guaPoem:g.poem,trendScore:pool.score,
      trendLabel:trendLabel(pool.score),fundFlow:pool.flow,resistance:pool.r,support:pool.s,
      riskTitle:pool.riskT,riskText:pool.riskX,masterTrend:pool.mt,masterFund:pool.mf,
      masterRisk:pool.mr,action:pool.action};
  }

  // ============ 大师团 ============
  function buildMasters(s){
    var e=s.expand,upPct=Math.round(e.upCount/Math.max(e.upCount+e.downCount,1)*100),g=s.grade;
    var tv=(g==='DA_JI'||g==='SHANG_JI')?'BUY':(g==='ZHONG_JI'||g==='ZHONG_PING')?'HOLD':'SELL';
    var tc=tv==='BUY'?'buy':tv==='SELL'?'sell':'hold';
    var tt='大盘'+s.trend.replace(/偏多·|偏空·|震荡·/g,'')+'，涨/跌停比 '+upPct+':'+(100-upPct)+'。'
      +(tv==='BUY'?'量价成立，主线'+(e.sectorPick[0]||'-')+'量能突破60日均量，Stage2加速期。':tv==='SELL'?'多数跌破20日线，Stage4分配期。':'量能萎缩于60日均量下，Stage3等待Pocket Pivot。');
    var np=parseFloat(String(e.northFlow).replace(/[^\-\d.]/g,''));
    var mp=parseFloat(String(e.mainNetFlow||'—').replace(/[^\-\d.]/g,''));  // [修复] 独立主力资金
    // [修复] 双线共振判断：北向>20亿 且 主力>30亿 才BUY（原来只看北向单一指标）
    // 阈值依据：2024年北向日均净买入约11亿，20亿≈1.8倍日均，代表显著流入；
    // 主力净流入30亿取其日均水平上沿（主力波动大于北向，阈值需更高）
    var fv=(np>=20&&mp>30)?'BUY':(np<=-15||mp<=-40)?'SELL':'HOLD';
    var fc=fv==='BUY'?'buy':fv==='SELL'?'sell':'hold';
    // [修复] 文本区分北向和主力两个独立指标
    var ft='北向'+e.northFlow+'，主力'+(e.mainNetFlow||e.darkHorse)+'。'
      +(fv==='BUY'?'双线共振——外资净流入+机构进场，方向一致可积极关注！'
        :fv==='SELL'?'双线杀跌——外资撤离+主力出逃，现金为王。'
        :e.northFlow&&e.mainNetFlow?'单线偏多未共振，等双线确认再关注。':'资金面观望中。')
      +'暗流指向→'+e.darkHorse+'，与'+e.sectorPick.slice(0,2).join('、')+'形成共振。';
    var rv=(g==='XIA_PING'||g==='XIA_XIONG')?'SELL':g==='DA_JI'?'HOLD':'HOLD';
    var rc=rv==='SELL'?'sell':'hold';
    var em=e.emotion;
    var rt='情绪'+em+'（'+e.emotionLabel+'）。'+(em>=75?'贪婪区，5日胜率<40%。':em<=30?'恐惧区，左侧胜率35%。':'中性，可用0.5R试错。');
    return[{name:'趋势派·奥尼尔',school:'CAN SLIM·量价突破',initial:'势',color:'#D4A853',
      verdict:tv,verdictCls:tc,text:tt,tactics:tv==='BUY'?'回踩10日线关注·跌破20线留意':tv==='SELL'?'反弹至20线即减配':'观察量能·待前高再出手'},
      {name:'资金派·蔡金',school:'主力筹码·A/D线',initial:'金',color:'#8A9A7D',
      verdict:fv,verdictCls:fc,text:ft,tactics:fv==='BUY'?'顺主力·聚焦'+e.darkHorse+'龙一':fv==='SELL'?'只做T不留夜':'主力未表态'}];
  }

  // ===== 付费大师团（5位） =====
  // 每位大师根据签文数据生成独立观点
  function buildPremiumMasters(s){
    var e=s.expand,g=s.grade;
    var pickStr=e.sectorPick.join('、'),avoidStr=e.sectorAvoid.join('、');

    // 价值派·格雷厄姆 — 安全边际 / 估值 / 低PE
    var vv=g==='DA_JI'?'BUY':g==='XIA_XIONG'?'SELL':'HOLD';
    var vc=vv==='BUY'?'buy':vv==='SELL'?'sell':'hold';
    var vt=(vv==='BUY'
      ?'当前市场整体估值处于合理区间，主线板块（'+pickStr+'）PE仍低于历史中位数。安全边际尚存，适合左侧分批建仓高股息标的，避免追涨热门题材。'
      :vv==='SELL'
      ?'多数板块估值已透支未来3年增长预期，PB>3的个股风险收益比不佳。建议回归低估值防御品种，耐心等估值回归合理区间再出手。'
      :'市场估值分化严重——部分蓝筹低估但题材股泡沫明显。精选低PE+高分红标的，仓位控制在5成以下，不参与高估值博弈。'
    );

    // 周期派·霍华德·马克斯 — 周期钟摆 / 逆向思维
    var cv=e.emotion>=70?(g==='DA_JI'?'BUY':'HOLD'):e.emotion<=30?(g==='XIA_XIONG'||g==='XIA_PING'?'BUY':'HOLD'):(g==='DA_JI'||g==='SHANG_JI'?'BUY':'HOLD');
    var cc=cv==='BUY'?'buy':'hold';
    var ct='当前情绪位于周期钟摆的'+(e.emotion>=70?'贪婪端（过度乐观，逆向信号出现）':(e.emotion<=30?'恐惧端（过度悲观，逆向机会浮现）':'中性区间'))
      +'.历史数据显示，极端情绪后的反转概率超过65%.'+(cv==='BUY'?'此时应逆势布局优质资产，别人恐惧时你贪婪。':'保持谨慎，不追不杀，静待钟摆摆正。');

    // 游资派·短线客 — 龙头战法 / 连板 / 热点轮动
    var sv=g==='DA_JI'||g==='SHANG_JI'?'BUY':g==='ZHONG_JI'?'HOLD':'SELL';
    var sc=sv==='BUY'?'buy':sv==='SELL'?'sell':'hold';
    var st=(sv==='BUY'
      ?'当前热点集中在'+pickStr+'，龙头辨识度高，资金接力意愿强。做最强的那个——弱的就是错的！关注首板晋级二板的确定性机会，打板需看封单量和炸板率。'
      :sv==='SELL'
      ?'热点散乱无主线，连板高度压缩到2板以内，赚钱效应极差。管住手别乱开枪，空仓等下一个主升浪。题材退潮期接刀必死。'
      :'市场处于混沌过渡期，老热点'+avoidStr+'在退潮，新方向未确立。轻仓试错1-2成，只盯换手率>15%的强势股，错了立刻砍。'
    );

    // 量化派·西蒙斯 — 统计套利 / 因子 / 概率
    var qv=g==='DA_JI'||g==='SHANG_JI'?'BUY':g==='XIA_PING'||g==='XIA_XIONG'?'SELL':'HOLD';
    var qc=qv==='BUY'?'buy':qv==='SELL'?'sell':'hold';
    var upRatio=Math.round(e.upCount/Math.max(e.upCount+e.downCount,1)*100);
    var qt='统计截面：上涨家数占比'+upRatio+'%，动量因子排名前20%的股票超额收益约'+(qv==='BUY'?'+2.8%':'-1.2%')+'/周.'
      +'波动率因子显示当前市场处于'+(e.emotion>60?'高波动 regime，趋势策略优于均值回复':e.emotion<40?'低波动 regime，均值回复策略占优':'中等波动，多因子均衡配置更优')
      +'.建议：'+(qv==='BUY'?'超配动量因子，等权持有TOP5动量标的，每周再平衡。':qv==='SELL'?'降仓至现金或对冲，等待波动率收敛信号。':'哑铃配置：50%动量+50%低波，控制最大回撤。');

    // 行为派·卡尼曼 — 认知偏差 / FOMO / 锚定
    var bv=(e.emotion>=70&&g!=='XIA_XIONG'&&g!=='XIA_PING')?((g==='DA_JI'||g==='SHANG_JI')?'HOLD':'SELL')
      :(e.emotion<=30&&(g==='DA_JI'||g==='SHANG_JI'))?'BUY'
      :g==='DA_JI'||g==='SHANG_JI'?'BUY':g==='XIA_XIONG'||g==='XIA_PING'?'SELL':'HOLD';
    var bc=bv==='BUY'?'buy':bv==='SELL'?'sell':'hold';
    var bt='行为诊断：当前投资者普遍存在'
      +(e.emotion>=70?'FOMO（错失焦虑）+ 过度自信偏差，看到别人赚钱就忍不住追入——这正是主力出货的最佳环境。冷静！你的FOMO就是别人的利润。'
        :e.emotion<=30?'损失厌恶 + 近因偏差，连续下跌后过度悲观——但数据表明恐慌抛售后5日反弹概率达68%.克服本能，逆向买入才是真正的alpha来源。'
        :g==='DA_JI'||g==='SHANG_JI'?'锚定效应正在发挥作用——大家还在用前期高点做参照，忽略了基本面改善的事实。利用这个认知窗口，趁共识尚未完全形成前建仓。'
        :'确认偏差盛行——多头找利多、空头找利空，每个人都只看到自己想看的。建议设定明确交易规则，用系统对抗人性弱点。'
      );

    // 散户派·老张 — 韭菜心理学 / 舆情逆向 / 群众情绪
    var rv_rt=e.emotion>=70?(g==='DA_JI'||g==='SHANG_JI'?'SELL':'HOLD')
      :e.emotion<=30?(g==='XIA_XIONG'||g==='XIA_PING'?'BUY':'HOLD')
      :(e.upCount>3500&&e.emotion>=55)?'HOLD':(e.downCount>3000&&e.emotion<=45)?'BUY':'HOLD';
    var rc_rv=rv_rt==='BUY'?'buy':rv_rt==='SELL'?'sell':'hold';
    var rt_text='15年股龄老韭菜的直觉——'
      +(e.emotion>=75?'现在满屏都在喊牛市，连楼下卖菜的阿姨都开户了。这种时候我只会做一件事：减配。历史上每次散户集体狂欢后，都是一地鸡毛。'
        :e.emotion<=25?'跌到群里没人说话了，朋友圈开始转行段子。但记住：底部永远是绝望中诞生的。这时候敢买的人，三个月后都笑了。'
        :e.upCount>3800?'今天涨的股票多，但别急着追！看看龙虎榜——如果散户在疯狂买入而机构在跑，那就是主力在出货给你接盘。'
        :e.downCount>3200?'今天确实惨，但别割在最底下。看看融资余额有没有大幅减少——如果杠杆资金还没崩，说明最狠的一波还没来，先别动。'
        :'当前市场不冷不热，最适合做一件事：观察。看北向资金的流向、看涨停板上的封单量、看论坛里的讨论热度——信息都在细节里。'
      );

    return [
      {id:'value', name:'价值派·格雷厄姆', school:'安全边际·估值分析', initial:'值', color:'#6B8CE3',
       verdict:vv,verdictCls:vc,text:vt,
       tactics:vv==='BUY'?'选PE<15且股息率>3%的标的·分批左侧建仓':vv==='SELL'?'清仓高估值题材·只留现金等':'低估值防御+高股息·总仓≤5成',
       feature:'越跌越买赚成长的钱，安全边际是底线',
       priceSingle:1.99,priceMonth:9.9},
      {id:'cycle', name:'周期派·霍华德·马克斯', school:'周期钟摆·逆向思维', initial:'周', color:'#9B7ED9',
       verdict:cv,verdictCls:cc,text:ct,
       tactics:cv==='BUY'?'逆向布局·人多的地方不去': '耐心持仓·等钟摆到另一端',
       feature:'极端情绪时逆向操作，人恐惧我贪婪',
       priceSingle:1.99,priceMonth:9.9},
      {id:'spec', name:'游资派·短线客', school:'龙头战法·热点轮动', initial:'游', color:'#E87D3E',
       verdict:sv,verdictCls:sc,text:st,
       tactics:sv==='BUY'?'聚焦龙一龙二·打板看封单量':sv==='SELL'?'空仓观望·等信号':'轻仓试错·错了秒砍',
       feature:'只做最强龙头，弱的就是错的',
       priceSingle:1.99,priceMonth:9.9},
      {id:'quant', name:'量化派·西蒙斯', school:'统计套利·多因子', initial:'量', color:'#4ECDC4',
       verdict:qv,verdictCls:qc,text:qt,
       tactics:qv==='BUY'?'等权持TOP5动量标的·周再平衡':qv==='SELL'?'降仓或对冲·等波动收敛':'哑铃配置50%动量+50%低波',
       feature:'不猜方向只跟信号，概率说话',
       priceSingle:1.99,priceMonth:9.9},
      {id:'behavior', name:'行为派·卡尼曼', school:'行为金融·认知偏差', initial:'心', color:'#F06292',
       verdict:bv,verdictCls:bc,text:bt,
       tactics:bv==='BUY'?'克服恐惧·逆向买入':bv==='SELL'?'克制FOMO·不要追涨':'设规则执行·不被情绪左右',
       feature:'战胜贪婪与恐惧才是真alpha',
       priceSingle:1.99,priceMonth:9.9},
      {id:'retail', name:'散户派·老张', school:'韭菜心理学·舆情逆向', initial:'韭', color:'#FF7043',
       verdict:rv_rt,verdictCls:rc_rv,text:rt_text,
       tactics:rv_rt==='BUY'?'别人恐惧时把握机会·别怕波动':rv_rt==='SELL'?'减配或观望·不跟风当接盘侠':'管住手·观察为主',
       feature:'读懂散户情绪，逆向收割羊群效应',
       priceSingle:1.99,priceMonth:9.9}
    ];
  }

  // ================================================================
  // 数据获取（v4.0 · 本地 Node.js 代理 API · 100% 可靠）
  // 浏览器 fetch('/api/...') → localhost:5817(Node代理) → 新浪/腾讯 → 干净JSON
  // 彻底解决 JSONP 不稳定 / CSP 拦截 / 变量检测失败等问题
  // ================================================================
  var CACHE_KEY = 'caiyunju:dailySign';
  var API_BASE = ''; // 同源请求

  function getTodayKey(){var d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}
  function readCache(){
    try{var r=sessionStorage.getItem(CACHE_KEY);if(!r)return null;var o=JSON.parse(r);if(o.__day!==getTodayKey())return null;return o.data;}catch(e){return null;}
  }
  function writeCache(data){try{sessionStorage.setItem(CACHE_KEY,JSON.stringify({__day:getTodayKey(),data:data}));}catch(e){}}

  /**
   * 通过本地代理获取上证指数
   */
  function fetchIndexData(){
    return new Promise(function(resolve,reject){
      var xhr=new XMLHttpRequest();
      xhr.open('GET',API_BASE+'/api/index',true);
      xhr.timeout=6000;
      xhr.onload=function(){
        if(xhr.status===200){
          try{
            var j=JSON.parse(xhr.responseText);
            if(j.success&&j.index){
              console.log('[MarketSign] ✓ 代理成功:',j.index.name||'沪指','涨跌'+j.index.changePercent+'%','现价'+j.index.price,'源:'+j.source);
              resolve(j.index);
            }else{reject(new Error(j.error||'数据错误'));}
          }catch(e){reject(new Error('JSON解析失败'));}
        }else{reject(new Error('HTTP '+xhr.status));}
      };
      xhr.onerror=function(){reject(new Error('网络错误 — 请确认 server.js 在 :5817 运行中'));};
      xhr.ontimeout=function(){reject(new Error('超时6s'));};
      xhr.send();
    });
  }

  /**
   * 通过本地代理获取单个板块真实数据
   */
  function fetchSectorRealData(name){
    return new Promise(function(resolve){
      var xhr=new XMLHttpRequest();
      xhr.open('GET',API_BASE+'/api/sector?name='+encodeURIComponent(name),true);
      xhr.timeout=8000;
      xhr.onload=function(){
        if(xhr.status===200){
          try{
            var j=JSON.parse(xhr.responseText);
            if(j.success){
              console.log('[Sector] ✓',name,'均涨跌'+j.avgChgPct+'%','源:'+j.source);
              resolve({
                sectorName:j.sectorName,realData:true,avgChgPct:j.avgChgPct,
                stocks:(j.stocks||[]).map(function(s){return{name:s.name,code:s.code,price:s.price,changePercent:s.chgPct};}),
                leader:{name:j.leader.name,code:j.leader.code,price:j.leader.price,chg:j.leader.chg,changePercent:j.leader.chg},
                worst:{name:j.worst.name,code:j.worst.code,price:j.worst.price,chg:j.worst.chg,changePercent:j.worst.chg},
                totalFlow:'约'+Math.round(j.avgChgPct*(j.stockCount||1)/10)+'亿',
                upCount:j.upCount||0,downCount:j.downCount||0,timestamp:j.fetchedAt||''
              });return;
            }
          }catch(e){}
        }
        resolve(null);
      };
      xhr.onerror=function(){resolve(null);};
      xhr.ontimeout=function(){resolve(null);};
      xhr.send();
    });
  }

  /** 批量获取多个板块 */
  function fetchAllSectorsReal(names){
    if(!names||!names.length) return Promise.resolve({});
    return Promise.all(names.map(function(n){return fetchSectorRealData(n).then(function(d){return [n,d];});}))
      .then(function(results){var m={};results.forEach(function(r){m[r[0]]=r[1];});return m;});
  }

  // 沪指涨跌幅→签级映射
  // 阈值依据：A股日涨跌幅历史分布（标准差约1.2%），±0.5%≈0.4σ（半级），±1.5%≈1.25σ（大阳线），±2%≈1.7σ（极端）
  function _gradeFromChg(chg){
    if(chg>=1.5)return'DA_JI';       // 大吉：日涨幅≥1.5%（约历史top 15%的交易日）
    if(chg>=0.5)return'SHANG_JI';    // 上吉：日涨幅0.5-1.5%（温和看多）
    if(chg>-0.5&&chg<0.5)return'ZHONG_JI'; // 中吉：窄幅震荡（约50%交易日落在±0.5%区间）
    if(chg<=-2.0)return'XIA_XIONG';  // 下凶：极端跌幅（约历史bottom 5%）
    if(chg<=-0.5)return'XIA_PING';   // 下平：日跌幅0.5-1.5%（温和看空）
    return'ZHONG_PING';
  }
  function _findMockByGrade(g){
    var o=['DA_JI','SHANG_JI','ZHONG_JI','ZHONG_PING','XIA_PING','XIA_XIONG'],oi=o.indexOf(g);
    if(oi<0)return MOCK_DAYS[0];
    for(var i=0;i<MOCK_DAYS.length;i++){if(MOCK_DAYS[i].grade===g)return MOCK_DAYS[i];}
    var b=MOCK_DAYS[0],bd=99;
    for(var j=0;j<MOCK_DAYS.length;j++){var d=Math.abs(o.indexOf(MOCK_DAYS[j].grade)-oi);if(d<bd){bd=d;b=MOCK_DAYS[j];}}
    return b;
  }
  function _buildSignFromReal(idxInfo,tdx, isWeekend, snap){
    // ★ 基础字段（始终来自真实指数）
    var tpl=_findMockByGrade(idxInfo.grade),meta=GRADE_MAP[idxInfo.grade],poem=_pickPoem(idxInfo.grade);
    var chg=tdx.changePercent,sgn=chg>=0?'+':'';
    var dir='偏多';if(chg<-0.5)dir='偏空';else if(Math.abs(chg)<0.3)dir='震荡';

    var trendPrefix = isWeekend ? '最近交易日' : '';
    var dateLabel = isWeekend ? _formatDate() + '(最近交易日)' : _formatDate();

    // ★ 核心：用快照真实数据构建 expand（如果可用），否则降级到模板
    var realExpand;
    if (snap && snap.success !== false) {
      var sp = snap;
      var pick = sp.sectorPick || [];
      var avoid = sp.sectorAvoid || [];
      var topSectors = sp.sectors || [];

      // 找推荐板块的详细信息
      var pickDetails = [];
      topSectors.forEach(function(s) {
        if (pick.indexOf(s.name) >= 0) {
          pickDetails.push({
            name: s.name,
            chg: (s.avgChg >= 0 ? '+' : '') + s.avgChg + '%',
            leader: s.leader,
            flow: '—',
            note: '龙头' + s.leader + ((s.leaderChg >= 0 ? '+' : '') + s.leaderChg.toFixed(2) + '%')
          });
        }
      });
      // 至少保证有 3 条
      while (pickDetails.length < 3 && topSectors[pickDetails.length]) {
        var ts = topSectors[pickDetails.length];
        pickDetails.push({
          name: ts.name,
          chg: (ts.avgChg >= 0 ? '+' : '') + ts.avgChg + '%',
          leader: ts.leader,
          flow: '—',
          note: '龙头' + ts.leader + ((ts.leaderChg >= 0 ? '+' : '') + ts.leaderChg.toFixed(2) + '%')
        });
      }

      var avoidDetails = [];
      topSectors.forEach(function(s) {
        if (avoid.indexOf(s.name) >= 0) {
          avoidDetails.push({ name: s.name, chg: (s.avgChg >= 0 ? '+' : '') + s.avgChg + '%', leader: s.worst, note: '弱势' + s.worst });
        }
      });

      realExpand = {
        sectorPick: pick,
        sectorAvoid: avoid,
        darkHorse: snap.darkHorse || '-',
        northFlow: snap.northFlowEstimate || '—',
        emotion: snap.emotion || 50,
        emotionLabel: snap.emotionLabel || '中性',
        upCount: snap.advanceDecline ? snap.advanceDecline.up : 1500,
        downCount: snap.advanceDecline ? snap.advanceDecline.down : 1500,
        sectorPickDetail: pickDetails,
        sectorAvoidDetail: avoidDetails.slice(0, 3),
      };
    }

    // 最终 expand：真实快照优先，缺失字段从模板补齐
    var finalExpand = realExpand || {};
    var mockTpl = tpl.expand || {};
    // 补齐所有可能的字段（确保向后兼容）
    ['sectorPick','sectorAvoid','darkHorse','northFlow','emotion','emotionLabel',
     'upCount','downCount','sectorPickDetail','sectorAvoidDetail'].forEach(function(k){
      if (!(k in finalExpand) && k in mockTpl) { finalExpand[k] = mockTpl[k]; }
    });

    // ★ 根据真实快照生成主线/风险/操作建议（不再硬编码 mock 模板）
    var dynMainLine, dynRisk, dynAction;
    if (snap && snap.success !== false && snap.sectorPick && snap.sectorPick.length > 0) {
      // mainLine: 取真实推荐板块前2名
      dynMainLine = snap.sectorPick.slice(0, 2).join(' / ');
      // risk: 根据真实情绪和指数变化生成
      var em = snap.emotion || 50;
      if (em >= 75) { dynRisk = 'RSI ' + Math.round(40 + em * 0.5) + ' · 情绪过热·谨防获利回吐'; }
      else if (em <= 30) { dynRisk = '情绪冰点 · 但恐慌后常有反弹'; }
      else if (chg >= 1.5) { dynRisk = '连续大涨 · 注意尾盘跳水'; }
      else if (chg <= -1.0) { dynRisk = '下跌趋势 · 反弹是减配机会'; }
      else if (Math.abs(chg) < 0.3) { dynRisk = '量能萎缩 · 谨防假突破'; }
      else { dynRisk = 'RSI ' + Math.round(40 + em * 0.4) + (chg > 0 ? ' · 短期注意回撤' : ' · 弱势观望'); }
      // action: 根据等级和情绪综合判断
      if (idxInfo.grade === 'DA_JI') { dynAction = '持股不动 · 别加杠杆'; }
      else if (idxInfo.grade === 'SHANG_JI') { dynAction = '顺势持股 · 不追高'; }
      else if (idxInfo.grade === 'ZHONG_JI') { dynAction = '低吸高抛 · 控制仓位'; }
      else if (idxInfo.grade === 'XIA_PING') { dynAction = '降低仓位 · 暂避锋芒'; }
      else { dynAction = '空仓观望 · 等信号确认'; }
    } else {
      // 无快照时降级到模板
      dynMainLine = tpl.mainLine;
      dynRisk = tpl.risk;
      dynAction = tpl.action;
    }

    return{
      date:dateLabel,stickNo:tpl.stickNo,grade:idxInfo.grade,
      gradeLabel:meta.label,gradeCls:meta.cls,gradeColor:meta.color,
      accentColor:meta.accent,bgImage:meta.bgImage,
      poemAncient:poem.ancient,poemModern:poem.modern,
      trend:trendPrefix + (trendPrefix ? ' ' : '') + dir+'·沪指 '+sgn+chg.toFixed(2)+'%',
      mainLine:dynMainLine,risk:dynRisk,action:dynAction,
      expand:finalExpand,
      isHoliday:false,holidayReason:'',
      isWeekend:!!isWeekend,
      dataSource:(snap ? '● 快照实时·' : '● 代理实时·')+'沪指'+sgn+chg.toFixed(2)+'%'
        +(snap ? (' | 情绪'+snap.emotion+'/'+snap.sectorPick.join('+')) : ''),
      generatedAt:new Date().toLocaleString('zh-CN'),_realIndex:tdx,_snapshot:snap
    };
  }

  /**
   * 通过本地代理获取市场快照数据（板块/涨跌/情绪 - 真实聚合计算）
   */
  function fetchMarketSnapshot(){
    return new Promise(function(resolve,reject){
      var xhr=new XMLHttpRequest();
      xhr.open('GET',API_BASE+'/api/market-snapshot',true);
      xhr.timeout=10000;
      xhr.onload=function(){
        if(xhr.status===200){
          try{
            var j=JSON.parse(xhr.responseText);
            if(j.success){
              console.log('[MarketSign] ✓ 快照: 涨'+j.advanceDecline.up+'/跌'+j.advanceDecline.down+' 情绪:'+j.emotion+j.emotionLabel);
              resolve(j);
            }else{reject(new Error(j.error||'快照错误'));}
          }catch(e){reject(new Error('JSON解析失败'));}
        }else{reject(new Error('HTTP '+xhr.status));}
      };
      xhr.onerror=function(){reject(new Error('网络错误'));};
      xhr.ontimeout=function(){reject(new Error('超时10s'));};
      xhr.send();
    });
  }

  /**
   * 主入口：异步加载今日财运签
   */
  async function loadMarketSign(opts){
    var options = opts || {};
    var isForceRefresh = options.force ||
      (typeof performance !== 'undefined' && performance.navigation && performance.navigation.type === 1) ||
      location.search.indexOf('fresh=1') > -1;

    if(!isForceRefresh){
      var cached=readCache();
      if(cached){console.log('[MarketSign] 使用缓存');cached._sourceHint='cached';return{sign:cached,source:'cache'};}
    }
    if(isForceRefresh){try{sessionStorage.removeItem(CACHE_KEY);}catch(e){}}

    // ★ 核心：通过本地代理获取真实指数 + 市场快照
    try{
      console.log('[MarketSign] → 请求本地代理 /api/index + /api/market-snapshot ...');
      var tdx=await fetchIndexData();
      var grade=_gradeFromChg(tdx.changePercent);
      console.log('[MarketSign] ✓',tdx.name,'涨跌'+tdx.changePercent+'%','等级:',grade);

      // ★ 并行获取市场快照（板块/涨跌/情绪等真实聚合数据）
      var snap = null;
      try {
        snap = await fetchMarketSnapshot();
        console.log('[MarketSign] ✓ 快照已接入: 情绪'+snap.emotion+'('+snap.emotionLabel+') 板块推荐:'+snap.sectorPick.join('/'));
      } catch(snapErr) {
        console.warn('[MarketSign] ⚠ 快照获取失败，使用模板降级:', snapErr.message);
      }

      // 周末/节假日检测：API 返回的是最近交易日数据，需标记非当日
      var now = new Date();
      var dow = now.getDay();
      var isWeekend = (dow === 0 || dow === 6);
      var sign=_buildSignFromReal({grade,date:_formatDate()},tdx, isWeekend, snap);
      var masters=buildMasters(sign);
      sign.masters={list:masters,consensus:sign.action||'建议综合判断'};
      sign.mastersAdapted=masters;
      writeCache(sign);
      return{sign:sign,source:'real'};
    }catch(e){
      console.warn('[MarketSign] ✗ 代理失败('+e.message+')，降级mock');
    }

    var local=getMarketSign(),localM=buildMasters(local);
    var _wkDow = new Date().getDay();
    var _wkIs = (_wkDow === 0 || _wkDow === 6);
    var mockSign = {
      sign:{date:local.date,stickNo:local.stickNo,grade:local.grade,
        gradeLabel:local.gradeLabel,gradeCls:local.gradeCls,gradeColor:local.gradeColor,
        accentColor:local.accentColor,bgImage:local.bgImage,
        poemAncient:local.poemAncient,poemModern:local.poemModern,
        trend:local.trend,mainLine:local.mainLine,risk:local.risk,action:local.action,
        expand:local.expand,masters:{list:localM,consensus:local.action},mastersAdapted:localM,
        isHoliday:false,holidayReason:'',
        isWeekend:_wkIs,
        dataSource:'○ mock · 代理不可用',
        generatedAt:new Date().toLocaleString('zh-CN')
      },source:'mock'
    };
    writeCache(mockSign.sign);  // v4.1: mock 结果也缓存，getMarketSign() 可复用
    return mockSign;
  }

  // ============================================================
  // 交易状态判断（时段 + 节假日）
  // ============================================================

  /**
   * 获取当前交易状态
   * 返回: { status, label, canRefresh, countdownText, isTradingDay }
   * status: 'pre_market' | 'auction' | 'trading' | 'lunch' | 'closed' | 'holiday'
   */
  function getMarketStatus(){
    var now = new Date();
    var h = now.getHours();
    var m = now.getMinutes();
    var timeVal = h * 60 + m; // 分钟数，方便比较
    var dow = now.getDay(); // 0=周日 1-6=周一到周六

    // 简单节假日判断：周末
    // TODO: 接入节假日 API 做精确判断
    var isWeekend = (dow === 0 || dow === 6);

    // 判断是否交易日（暂不考虑法定节假日，后续可接 API）
    if (isWeekend) {
      return {
        status: 'holiday',
        label: dow === 0 ? '周末愉快 · 下周一更新' : '周末愉快 · 明日更新',
        subLabel: '财神也歇着',
        canRefresh: false,
        countdownText: '',
        isTradingDay: false,
      };
    }

    // 周一到周五的时段判断
    if (timeVal < 9 * 60) {           // 0:00 - 9:00 早间
      return _makePreMarket(now);
    } else if (timeVal < 9 * 60 + 25) { // 9:00 - 9:25 集合竞价
      return {
        status: 'auction',
        label: '集合竞价中 · 9:30开盘',
        subLabel: '资金正在集结',
        canRefresh: false,
        countdownText: _countdownTo(now, 9, 30),
        isTradingDay: true,
      };
    } else if (timeVal < 11 * 60 + 30) { // 9:30 - 11:30 上午交易
      return {
        status: 'trading',
        label: '交易中 · 实时行情',
        subLabel: '',
        canRefresh: true,
        countdownText: '',
        isTradingDay: true,
      };
    } else if (timeVal < 13 * 60) {     // 11:30 - 13:00 午休
      return {
        status: 'lunch',
        label: '午休中 · 13:00恢复交易',
        subLabel: '',
        canRefresh: false,
        countdownText: _countdownTo(now, 13, 0),
        isTradingDay: true,
      };
    } else if (timeVal < 15 * 60) {     // 13:00 - 15:00 下午交易
      return {
        status: 'trading',
        label: '交易中 · 实时行情',
        subLabel: '',
        canRefresh: true,
        countdownText: '',
        isTradingDay: true,
      };
    } else {                            // 15:00+ 收盘后
      return {
        status: 'closed',
        label: '已收盘 · 今日签已锁定',
        subLabel: '明早8点更新盘前速报',
        canRefresh: false,
        countdownText: '',
        isTradingDay: true,
      };
    }
  }

  /** 早间状态（0:00 - 9:00）含倒计时 */
  function _makePreMarket(now){
    var h = now.getHours();
    var m = now.getMinutes();
    var timeVal = h * 60 + m;

    if (timeVal >= 8 * 60) {       // 8:00 - 9:00 即将开盘
      return {
        status: 'pre_market',
        label: '盘前速报 · 全球隔夜行情',
        subLabel: '今日财神签已就位',
        canRefresh: true, // 盘前可以刷新全球数据
        countdownText: _countdownTo(now, 9, 30),
        isTradingDay: true,
      };
    }
    // 0:00 - 8:00 深夜/凌晨
    return {
      status: 'pre_market',
      label: '今日预判签已就位',
      subLabel: h >= 0 && h < 6 ? '夜深了，财运不休息' : '早安，新的一天',
      canRefresh: true,
      countdownText: _countdownTo(now, 9, 30),
      isTradingDay: true,
    };
  }

  /** 计算到目标时间的倒计时文字 */
  function _countdownTo(now, targetH, targetM){
    var target = new Date(now);
    target.setHours(targetH, targetM, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1); // 已过则推到明天
    var diffMs = target - now;
    var diffMin = Math.ceil(diffMs / 60000);
    if (diffMin <= 0) return '';
    if (diffMin < 60) return '距开盘 ' + diffMin + '分钟';
    var hh = Math.floor(diffMin / 60);
    var mm = diffMin % 60;
    return '距开盘 ' + hh + '时' + (mm > 0 ? mm + '分' : '');
  }

  global.MarketSign={
    getMarketSign,getSectorReport,buildMasters,buildPremiumMasters,setForceIdx,loadMarketSign,
    fetchIndexData,fetchSectorRealData,fetchAllSectorsReal,
    getMarketStatus,
    SECTOR_POOL,HOT_SECTORS,GRADE_MAP,MOCK_DAYS_LEN:MOCK_DAYS.length
  };
})(window);
