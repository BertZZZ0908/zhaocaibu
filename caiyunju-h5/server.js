/**
 * 财运局 H5 · 本地开发服务器（Node.js 代理）
 *
 * 端口：5817
 * 功能：
 *   1. 托管静态文件（替代 python http.server）
 *   2. 代理腾讯/新浪行情接口 → 返回干净 JSON（解决浏览器 JSONP 不稳定问题）
 *
 * 用法：node server.js
 * 然后访问 http://localhost:5817
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 5817;
const ROOT_DIR = __dirname;

// ============================================================
// MIME 类型
// ============================================================
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff':'font/woff', '.woff2':'font/woff2',
  '.ttf': 'font/ttf',
};

// ============================================================
// 股票数据代理核心
// ============================================================

/**
 * 解析腾讯财经返回的原始字符串
 * 输入: v_sh000001="1~上证指数~000001~现价~昨收~~...~涨跌幅%~..."
 * 输出: { name, code, price, yClose, changeAmount, changePercent, ... }
 */
function parseTencentRaw(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const si = raw.indexOf('"') + 1;
  const ei = raw.lastIndexOf('"');
  if (si < 0 || ei <= si) return null;
  const f = raw.substring(si, ei).split('~');
  if (f.length < 35) return null;

  const chg = parseFloat(f[32]);
  if (isNaN(chg)) return null;

  return {
    code:     f[2] || '',
    name:     f[1] || '',
    price:    parseFloat(f[3]) || 0,
    yClose:   parseFloat(f[4]) || 0,
    open:     parseFloat(f[5]) || 0,
    volume:   f[36] || '',
    amount:   f[37] || '',
    changeAmount: parseFloat(f[31]) || 0,
    changePercent: chg,
    high:     parseFloat(f[33]) || 0,
    low:      parseFloat(f[34]) || 0,
    timestamp:f[30] || '',
    turnover: f[38] || '',
  };
}

/**
 * 解析新浪财经返回的原始字符串
 * 输入: var hq_str_sh600519="贵州茅台,1354.55,1360.30,...";
 * 输出: 同上格式
 */
function parseSinaRaw(raw) {
  if (!raw || typeof raw !== 'string') return null;
  // 新浪返回逗号分隔: 名称,今开,昨收,当前价,最高,最低,...
  const f = raw.split(',');
  if (f.length < 10) return null;
  const price = parseFloat(f[3]);
  const yClose = parseFloat(f[2]);
  if (isNaN(price)) return null;
  return {
    name:   f[0] || '',
    price:  price,
    yClose: yClose,
    open:   parseFloat(f[1]) || 0,
    high:   parseFloat(f[4]) || 0,
    low:    parseFloat(f[5]) || 0,
    volume: f[8] || '',
    amount: f[9] || '',
    changeAmount: +(price - yClose).toFixed(2),
    changePercent: yClose > 0 ? +((price - yClose) / yClose * 100).toFixed(2) : 0,
    buyPrice:  parseFloat(f[6]) || 0,  // 买一
    sellPrice: parseFloat(f[7]) || 0,  // 卖一
    timestamp: new Date().toISOString().replace(/T/, ' ').substring(0, 19),
  };
}

/**
 * 发起 HTTPS GET 请求（用于调腾讯接口）
 */
function httpsGet(u) {
  return new Promise((resolve, reject) => {
    const req = https.get(u, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

/**
 * 发起 HTTP GET 请求（用于调新浪/东财接口）
 * 新浪返回 GBK 编码，需要转换
 */
function httpGet(u, headers) {
  return new Promise((resolve, reject) => {
    const req = http.get(u, { timeout: 5000, headers: headers || {} }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        // 尝试 GBK → UTF-8 解码（新浪接口）
        var body;
        try {
          body = new TextDecoder('gbk').decode(buf);
        } catch(e) {
          body = buf.toString('utf-8'); // fallback
        }
        resolve({ status: res.statusCode, body: body });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

/**
 * 通过代理获取股票实时行情
 * @param {string[]} codes 股票代码数组，如 ['sh000001','sz300308']
 * @param {string} source 数据源: 'tencent'(默认) | 'sina' | 'auto'
 * @returns Promise<Object> { success, source, data:[], fetchedAt }
 */
async function fetchStocks(codes, source) {
  src = source || 'auto';
  const results = [];
  let apiSource = '';
  let rawData = '';

  // ★ 优先腾讯（UTF-8，无编码问题）
  if (src !== 'sina') {
    try {
      const q = codes.join(',');
      const res = await httpsGet('https://qt.gtimg.cn/q=' + q + '&_t=' + Date.now());
      if (res.status === 200 && res.body) {
        apiSource = 'tencent';
        rawData = res.body;
        const parts = res.body.split(';');
        parts.forEach(function(part) {
          const m = part.match(/v_(\w+)="(.*)"/);
          if (m && m[2]) {
            const parsed = parseTencentRaw(m[2]);
            if (parsed) { parsed.code = m[1]; results.push(parsed); }
          }
        });
      }
    } catch(e) { console.warn('[API] 腾讯失败:', e.message); }
  }

  // ★ 腾讯失败时 fallback 新浪（GBK，需解码）
  if (results.length === 0) {
    try {
      const q = codes.join(',');
      const res = await httpGet(
        'http://hq.sinajs.cn/list=' + q,
        { Referer: 'http://finance.sina.com.cn', 'User-Agent': 'Mozilla/5.0 (compatible; CaiYunJu/1.0)' }
      );
      if (res.status === 200 && res.body) {
        apiSource = 'sina';
        rawData = res.body;
        const lines = res.body.trim().split('\n');
        lines.forEach(function(line) {
          if (!line.trim()) return;
          const m = line.match(/var hq_str_(\w+)="(.*)";/);
          if (m && m[2]) {
            const parsed = parseSinaRaw(m[2]);
            if (parsed) { parsed.code = m[1]; results.push(parsed); }
          }
        });
      }
    } catch(e) { console.warn('[API] 新浪失败:', e.message); }
  }

  return {
    success: results.length > 0,
    source: apiSource,
    data: results,
    count: results.length,
    requested: codes.length,
    fetchedAt: new Date().toISOString(),
    _raw: rawData.substring(0, 500),
  };
}

// ============================================================
// API 路由
// ============================================================

/** 市场快照缓存（15秒 TTL） */
var _snapshotCache = null;
var _snapshotCacheTime = 0;

const ROUTES = {
  /**
   * GET /api/stock?codes=sh000001,sz300308&source=tencent|sina|auto
   * 返回股票实时行情 JSON 数组
   */
  '/api/stock': async function(query) {
    const codesStr = query.codes || 'sh000001';
    const codes = codesStr.split(',').map(function(s){return s.trim();}).filter(Boolean);
    if (!codes.length) return jsonErr('缺少 codes 参数');

    const result = await fetchStocks(codes, query.source);
    return jsonResponse(result);
  },

  /**
   * GET /api/index
   * 快捷获取上证指数（首页签文用）
   */
  '/api/index': async function() {
    const result = await fetchStocks(['sh000001'], 'auto');
    if (result.success && result.data.length > 0) {
      const idx = result.data[0];
      return jsonResponse({
        success: true,
        source: result.source,
        index: idx,
        grade: gradeFromChg(idx.changePercent),
        fetchedAt: result.fetchedAt,
      });
    }
    return jsonErr('无法获取指数数据: ' + (result.error || 'unknown'));
  },

  /**
   * GET /api/sector?name=AI算力
   * 获取板块真实数据（查代表股聚合）
   */
  '/api/sector': async function(query) {
    const name = query.name;
    if (!name) return jsonErr('缺少 name 参数');

    // 板块 → 代表股映射（与 marketSign.js SECTOR_REPS 同步）
    const SECTOR_REPS = {
      'AI算力':   ['sz300308','sh603087','sz300502'],
      '半导体':   ['sh688012','sz002371','sh688041'],
      '新能源':   ['sz300750','sh601012','sz300274'],
      '机器人':   ['sz002747','sz300024','sh688277'],
      '医药':     ['sz300760','sh600276','sz300122'],
      '军工':     ['sh600760','sh600893','sz002013'],
      '银行':     ['sh601398','sh601288','sh600036'],
      '消费':     ['sh600519','sz000858','sz000568'],
      '地产':     ['sz000002','sz001979','sh600048'],
      '白酒':     ['sh600519','sz000858','sz000568'],
      '黄金':     ['sh600489','sz002155','sh600547'],
      '电力':     ['sh600900','sh601179','sz000767'],
      '煤炭':     ['sh601168','sh601225','sz000983'],
      '公用事业': ['sh600900','sh601179','sz000767'],
    };

    const reps = SECTOR_REPS[name];
    if (!reps) return jsonErr('未知板块: ' + name);

    const result = await fetchStocks(reps, 'auto');
    if (!result.success || !result.data.length) return jsonErr('板块数据获取失败');

    const valid = result.data.filter(function(s){return s.name;});
    let sumChg = 0;
    valid.forEach(function(s){sumChg += s.changePercent || 0;});
    const avgChg = sumChg / Math.max(valid.length, 1);

    let leader = valid[0], worst = valid[0];
    valid.forEach(function(s){
      if ((s.changePercent||0) > (leader.changePercent||0)) leader = s;
      if ((s.changePercent||0) < (worst.changePercent||0)) worst = s;
    });

    return jsonResponse({
      success: true,
      sectorName: name,
      source: result.source,
      avgChgPct: parseFloat(avgChg.toFixed(2)),
      stockCount: valid.length,
      leader: { name:leader.name, code:leader.code, price:leader.price, chg:leader.changePercent },
      worst:  { name:worst.name, code:worst.code, price:worst.price, chg:worst.changePercent },
      stocks: valid.map(function(s){
        return { name:s.name, code:s.code, price:s.price, chgPct:s.changePercent, chg:(s.changePercent>=0?'+':'')+s.changePercent.toFixed(2)+'%' };
      }),
      upCount: valid.filter(function(s){return (s.changePercent||0)>0}).length,
      downCount: valid.filter(function(s){return (s.changePercent||0)<=0}).length,
      fetchedAt: result.fetchedAt,
    });
  },

  /**
   * GET /api/global
   * 获取全球主要市场行情（盘前速报用）
   * 美股：道琼斯/纳斯达克/标普  港股：恒生指数
   */
  '/api/global': async function() {
    const GLOBAL_CODES = [
      { code: 'usDJI', abbr: '道指' },
      { code: 'usIXIC', abbr: '纳指' },
      { code: 'usINX', abbr: '标普' },
      { code: 'hkHSI', abbr: '恒生' },
    ];
    var q = GLOBAL_CODES.map(function(g){ return g.code; }).join(',');
    var res;

    try {
      res = await httpsGet('https://qt.gtimg.cn/q=' + q + '&_t=' + Date.now());
    } catch(e) {
      console.warn('[API/global] 腾讯失败:', e.message);
      return jsonErr('全球数据获取失败');
    }
    if (res.status !== 200 || !res.body) return jsonErr('全球数据为空');

    // 腾讯返回格式: v_usDJI="200~道琼斯~.DJI~price~yClose~open~...~changePercent~...";
    var lines = res.body.trim().split(';');
    var markets = [];
    GLOBAL_CODES.forEach(function(g) {
      for (var i = 0; i < lines.length; i++) {
        var m = lines[i].match(new RegExp('v_' + g.code + '="(.*)"'));
        if (!m || !m[1]) continue;
        var f = m[1].split('~');
        if (f.length < 33) continue;
        var price = parseFloat(f[3]);
        var chgPct = parseFloat(f[32]);
        if (isNaN(price) || isNaN(chgPct)) continue;
        markets.push({
          code: g.code,
          shortName: g.abbr,
          price: price,
          changePercent: +chgPct.toFixed(2),
        });
        break;
      }
    });

    return jsonResponse({
      success: true,
      source: 'tencent',
      markets: markets,
      count: markets.length,
      fetchedAt: new Date().toISOString(),
    });
  },

  // ============================================================
  // 市场快照（增强数据源 - 替代 MOCK 数据）
  // ============================================================
  '/api/market-snapshot': async function(query) {
    const forceRefresh = query.fresh === '1';
    if (!forceRefresh && _snapshotCache && (Date.now() - _snapshotCacheTime < 15000)) {
      return jsonResponse(_snapshotCache);
    }

    // 成分股池定义
    const POOL = {
      indices: ['sh000001','sz399001','sz399006'],
      sectors: {
        'AI算力':   ['sz300308','sh603087','sz300502','sz002230'],
        '半导体':   ['sh688012','sz002371','sh688041','sz002049','sh688256'],
        '新能源':   ['sz300750','sh601012','sz300274','sz002594'],
        '机器人':   ['sz002747','sz300024','sh688277','sz300124'],
        '医药':     ['sz300760','sh600276','sz300122','sh603259'],
        '军工':     ['sh600760','sh600893','sz002013','sh688512'],
        '银行':     ['sh601398','sh601288','sh600036','sh600016'],
        '消费':     ['sh600519','sz000858','sz000568','sh600887'],
        '白酒':     ['sh600519','sz000858','sz000568','sz002304'],
        '地产':     ['sz000002','sz001979','sh600048','sz001914'],
        '黄金':     ['sh600489','sz002155','sh600547','sz002237'],
        '电力':     ['sh600900','sh601179','sz000767','sh600868'],
        '煤炭':     ['sh601168','sh601225','sz000983','sh601088'],
        '证券':     ['sh601211','sh600030','sz166678','sh601688'],
        '保险':     ['sh601318','sh601601','sh601669'],
        '汽车':     ['sz002594','sh600104','sh601238'],
        '通信':     ['sh600050','sz000063','sh601728'],
      }
    };

    // 收集所有代码
    var allCodes = [].concat(POOL.indices);
    var secKeys = Object.keys(POOL.sectors);
    secKeys.forEach(function(k){ allCodes = allCodes.concat(POOL.sectors[k]); });
    allCodes = [...new Set(allCodes)];

    // 分批拉取（每批 40 个）
    const BATCH = 40;
    var allStocks = [];
    for (var i = 0; i < allCodes.length; i += BATCH) {
      try {
        var res = await fetchStocks(allCodes.slice(i, i+BATCH), 'tencent');
        if (res.success) allStocks = allStocks.concat(res.data);
      } catch(e){ console.warn('[Snap] batch err:', e.message); }
      if (i+BATCH < allCodes.length) await new Promise(function(r){setTimeout(r,200);});
    }

    if (allStocks.length < 10) return jsonErr('数据不足: '+allStocks.length);

    // --- 指数 ---
    var idxMap = {};
    POOL.indices.forEach(function(c){
      var f = allStocks.find(function(s){return s.code===c;});
      if(f) idxMap[c]=f;
    });

    // --- 涨跌统计（排除指数）---
    var nonIdx = allStocks.filter(function(s){return POOL.indices.indexOf(s.code)<0 && s.name;});
    var up=0, down=0, flat=0;
    nonIdx.forEach(function(s){ var c=s.changePercent||0; if(c>0)up++; else if(c<0)down++; else flat++; });
    var total=up+down+flat, upRat=total>0?Math.round(up/total*100):50;

    // --- 板块聚合 ---
    var secStats = [];
    secKeys.forEach(function(sn){
      var scs = POOL.sectors[sn].map(function(c){return allStocks.find(function(s){return s.code===c;});}).filter(Boolean);
      if(!scs.length) return;
      var sumC=0; scs.forEach(function(s){sumC+=s.changePercent||0;});
      var avgC=sumC/scs.length;
      var ld=scs[0], wr=scs[0];
      scs.forEach(function(s){if((s.changePercent||0)>(ld.changePercent||0))ld=s; if((s.changePercent||0)<(wr.changePercent||0))wr=s;});
      secStats.push({name:sn, avgChg:+avgC.toFixed(2), count:scs.length, leader:ld.name, leaderChg:ld.changePercent, worst:wr.name, worstChg:wr.changePercent});
    });
    secStats.sort(function(a,b){return b.avgChg-a.avgChg;});

    // --- 情绪评分 ---
    var shC=(idxMap['sh000001']||{}).changePercent||0;
    var emo =
      upRat*0.35
      + Math.max(0,Math.min(20,shC*10))*0.25
      + (secStats.filter(function(s){return s.avgChg>0;}).length/Math.max(secStats.length,1))*20
      + Math.max(0,(up-down)/Math.max(total,1)*15);
    var emotionScore=Math.max(10,Math.min(95,Math.round(emo)));
    var emotionLabel=emotionScore>=75?'极贪':emotionScore>=60?'偏贪':emotionScore>=45?'中性':emotionScore>=30?'偏恐':'极恐';

    // --- 北向估算 ---
    var northCodes=['sh600519','sz300750','sh601318','sz000858','sh600036'];
    var nStk=northCodes.map(function(c){return allStocks.find(function(s){return s.code===c;});}).filter(Boolean);
    var nSum=0; nStk.forEach(function(s){nSum+=s.changePercent||0;});
    var nEst=nStk.length?+(nSum/nStk.length).toFixed(2):0;

    // --- TOP 榜 ---
    var sorted=nonIdx.slice().sort(function(a,b){return b.changePercent-a.changePercent;});
    var topG=sorted.slice(0,5).map(function(s){return {name:s.name,code:s.code,chg:s.changePercent};});
    var topL=sorted.slice(-5).reverse().map(function(s){return {name:s.name,code:s.code,chg:s.changePercent};});

    var snap={
      success:true, source:'tencent', fetchedAt:new Date().toISOString(),
      indices:{
        sh:idxMap['sh000001']?{name:idxMap['sh000001'].name,price:idxMap['sh000001'].price,chg:idxMap['sh000001'].changePercent}:null,
        sz:idxMap['sz399001']?{name:idxMap['sz399001'].name,price:idxMap['sz399001'].price,chg:idxMap['sz399001'].changePercent}:null,
        cyb:idxMap['sz399006']?{name:idxMap['sz399006'].name,price:idxMap['sz399006'].price,chg:idxMap['sz399006'].changePercent}:null,
      },
      advanceDecline:{up:up, down:down, flat:flat, total:total, upRatio:upRat},
      sectors:secStats.slice(0,10),
      sectorPick:secStats.filter(function(s){return s.avgChg>0;}).slice(0,3).map(function(s){return s.name;}),
      sectorAvoid:secStats.filter(function(s){return s.avgChg<=0;}).slice(-3).map(function(s){return s.name;}),
      emotion:emotionScore,
      emotionLabel:emotionLabel,
      darkHorse:(topG[0]&&topG[0].name)||'-',
      northFlowEstimate:(nEst>=0?'+':'')+nEst+'%',
      topGainers:topG,
      topLosers:topL,
      _stockCount:allStocks.length,
    };
    _snapshotCache=snap;
    _snapshotCacheTime=Date.now();
    return jsonResponse(snap);
  },
};

/** 根据涨跌幅判定等级 */
function gradeFromChg(chg) {
  if (chg >= 1.5) return 'DA_JI';
  if (chg >= 0.5) return 'SHANG_JI';
  if (chg > -0.5) return 'ZHONG_JI';
  if (chg <= -2.0) return 'XIA_XIONG';
  if (chg <= -0.5) return 'XIA_PING';
  return 'ZHONG_PING';
}

function jsonErr(msg) {
  const body = JSON.stringify({ success:false, error:msg, time:new Date().toISOString() });
  return { status: 200, headers: {'Content-Type':'application/json'}, body: body };
}

function jsonResponse(obj) {
  const body = JSON.stringify(obj);
  return { status: 200, headers: {'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*'}, body: body };
}

// ============================================================
// 静态文件服务
// ============================================================

function serveStatic(filePath) {
  const fullPath = path.join(ROOT_DIR, filePath);
  if (!fullPath.startsWith(ROOT_DIR)) return { status:403, body:'Forbidden' };

  try {
    if (!fs.existsSync(fullPath)) return { status:404, body:'Not Found: ' + filePath };
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      // 默认找 index.html
      const indexPath = path.join(fullPath, 'index.html');
      if (fs.existsSync(indexPath)) return serveStatic(filePath + '/index.html');
      return { status:404, body:'No index.html' };
    }
    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';
    const body = fs.readFileSync(fullPath);
    return {
      status: 200,
      headers: { 'Content-Type': contentType, 'Cache-Control': 'no-cache' },
      body: body,
    };
  } catch (e) {
    return { status:500, body:'Server Error: ' + e.message };
  }
}

// ============================================================
// HTTP 服务器主入口
// ============================================================

const server = http.createServer(async function(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  console.log('[REQ]', new Date().toLocaleTimeString(), req.method, pathname);

  // CORS 预检
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,OPTIONS', 'Access-Control-Max-Age': '86400' });
    res.end();
    return;
  }

  // API 路由
  if (ROUTES[pathname] && req.method === 'GET') {
    try {
      const result = await ROUTES[pathname](parsedUrl.query);
      res.writeHead(result.status, result.headers || {});
      res.end(typeof result.body === 'string' ? result.body : JSON.stringify(result.body));
    } catch (e) {
      console.error('[API ERR]', pathname, e.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success:false, error:e.message }));
    }
    return;
  }

  // 静态文件（默认）
  const staticResult = serveStatic(pathname === '/' ? '/index.html' : pathname);
  res.writeHead(staticResult.status, staticResult.headers || {});
  res.end(staticResult.body || '');
});

server.listen(PORT, function() {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║  财运局 H5 · 本地代理服务器           ║');
  console.log('║                                      ║');
  console.log('║  地址: http://localhost:' + PORT + '       ║');
  console.log('║                                      ║');
  console.log('║  API 端点:                            ║');
  console.log('║  GET /api/stock?codes=sh000001,sz300308 ║');
  console.log('║  GET /api/index                       ║');
  console.log('║  GET /api/sector?name=AI算力           ║');
  console.log('║                                      ║');
  console.log('║  数据源: 新浪(主) + 腾讯(备)            ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');
});
