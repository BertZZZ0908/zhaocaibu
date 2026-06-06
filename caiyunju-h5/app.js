// 财运局 H5 · 主脚本（SPA 路由 + 页面渲染）
(() => {
'use strict';

const { paipan, getTodayLuck, getQuickCheck, getDeepReport, getSpeculationFit, getFortuneStick } = window.Bazi;

// ============ 全局状态 ============
const state = {
  userBazi: null,
  orders: {}  // { today: true, quickcheck: true, deepreport: true }
};

// 加载本地缓存
try {
  state.userBazi = JSON.parse(localStorage.getItem('caiyunju:bazi') || 'null');
  state.orders = JSON.parse(localStorage.getItem('caiyunju:orders') || '{}');
} catch (e) {}

// 测试样本
const SAMPLES = {
  A: { year: 1987, month: 6, day: 18, hour: 10, gender: 'M', label: '1987-06-18 10:00 男' },
  B: { year: 1990, month: 11, day: 3, hour: 14, gender: 'M', label: '1990-11-03 14:00 男' },
  C: { year: 1995, month: 3, day: 8, hour: 22, gender: 'F', label: '1995-03-08 22:00 女' },
  D: { year: 1983, month: 9, day: 25, hour: 6,  gender: 'M', label: '1983-09-25 06:00 男' },
};

// ============ 工具 ============
const WX_EN = { '木': 'wood', '火': 'fire', '土': 'earth', '金': 'metal', '水': 'water' };

function saveBazi() {
  if (state.userBazi) localStorage.setItem('caiyunju:bazi', JSON.stringify(state.userBazi));
}
function saveOrders() {
  localStorage.setItem('caiyunju:orders', JSON.stringify(state.orders));
}

function toast(msg, ms = 1800) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), ms);
}

function go(hash) {
  location.hash = hash;
}

function requireBazi(nextHash) {
  if (state.userBazi) return true;
  toast('请先完成免费排盘');
  setTimeout(() => go('#/input?next=' + encodeURIComponent(nextHash || '#/result')), 600);
  return false;
}

function esc(s) {
  if (typeof s !== 'string') return s;
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 获取 URL query
function query(key) {
  const h = location.hash;
  const i = h.indexOf('?');
  if (i < 0) return null;
  const q = new URLSearchParams(h.slice(i + 1));
  return q.get(key);
}

// ============ 页面模板 ============
const Pages = {};

// ========= 首页 = 每日签（用户进来就摇签）=========
// 设计：默认进入 #/index 即渲染 Pages.sign 内容；如需看纯卡片入口版，用 #/signCard
Pages.index = () => Pages.sign();
Pages.index.mount = () => Pages.sign.mount && Pages.sign.mount();

// ========= 纯卡片版首页（保留作为备选入口，可通过 #/signCard 访问）=========
Pages.signCard = () => {
  const sign = window.MarketSign.getMarketSign();
  return `
<div class="dust-bg"></div>
<div class="page-wrap index-wrap-v2">

  <div class="top-brand">
    <div class="compass-mini"><div class="taiji-mini"></div></div>
    <div class="top-brand-text">
      <div class="top-brand-cn">财 运 局</div>
      <div class="top-brand-en">THE WEALTH DECODER</div>
    </div>
  </div>

  <div class="sign-card sign-grade-${sign.gradeCls}" onclick="location.hash='#/sign'">
    <div class="sign-card-corner tl"></div>
    <div class="sign-card-corner tr"></div>
    <div class="sign-card-corner bl"></div>
    <div class="sign-card-corner br"></div>

    <div class="sign-head">
      <span class="sign-stick-no">${sign.stickNo}</span>
      <span class="sign-grade-pill" style="background:${sign.gradeColor}">${sign.gradeLabel}</span>
    </div>
    <div class="sign-date-row">今 日 财 运 签 · ${sign.date}</div>

    <div class="sign-poem">
      <div class="poem-ancient">「${sign.poemAncient[0]}</div>
      <div class="poem-ancient">　${sign.poemAncient[1]}」</div>
      <div class="poem-modern">${sign.poemModern[0]} · ${sign.poemModern[1]}</div>
    </div>

    <div class="sign-divider"><div class="rhombus"></div></div>

    <div class="sign-points">
      <div class="point-row"><span class="point-key">大 势</span><span class="point-val">${sign.trend}</span></div>
      <div class="point-row"><span class="point-key">主 线</span><span class="point-val">${sign.mainLine}</span></div>
      <div class="point-row"><span class="point-key">风 险</span><span class="point-val warn">${sign.risk}</span></div>
    </div>

    <div class="sign-action">
      <span class="action-label">◆ 行 动</span>
      <span class="action-text">${sign.action}</span>
    </div>

    <div class="sign-tap-hint">展 开 完 整 版 · 板 块 / 资 金 / 暗 流  ›</div>
  </div>

  <div class="path-section">
    <div class="path-title">— 想 看 更 深 的？—</div>

    <div class="path-card path-sector" onclick="location.hash='#/sector'">
      <div class="path-icon">☰</div>
      <div class="path-body">
        <div class="path-name">板 块 详 批</div>
        <div class="path-desc">输入板块/个股 · 给一份卦象报告</div>
      </div>
      <div class="path-tag free">FREE</div>
    </div>

    <div class="path-card path-bazi" onclick="App.goBazi()">
      <div class="path-icon">命</div>
      <div class="path-body">
        <div class="path-name">我 的 命 盘</div>
        <div class="path-desc">输入生辰 · 看 60 年财运长线</div>
      </div>
      <div class="path-tag price">¥29.9</div>
    </div>
  </div>

  <div class="footer-brand">
    <div class="seal">财<br>运<br>局</div>
    <div class="footer-text">娱乐参考 · 不构成投资建议</div>
  </div>
</div>
`;
};

// ========= 每日签（首页即此页）=========
Pages.sign = () => {
  const s = window.MarketSign.getMarketSign();
  const masters = window.MarketSign.buildMasters(s);
  return `
<div class="dust-bg"></div>
<div class="page-wrap">

  <!-- 抽签前：财神签视觉首屏 -->
  <div class="fortune-home" id="stageBefore">
    <div class="fortune-sky-lines"></div>
    <div class="fortune-kline kline-left"></div>
    <div class="fortune-kline kline-right"></div>
    <div class="fortune-cloud cloud-a"></div>
    <div class="fortune-cloud cloud-b"></div>

    <div class="fortune-titlebar">
      <div class="fortune-title-wrap">
        <div class="fortune-title-deco left"></div>
        <div class="fortune-title">财神签</div>
        <div class="fortune-title-deco right"></div>
      </div>
      <button class="fortune-menu" id="btnSignMenu" aria-label="更多">☰</button>
      <div class="fortune-subtitle">每 日 一 签 · 财 运 指 引</div>
    </div>

    <div class="fortune-guide-text">诚 心 摇 签 · 财 运 自 有 安 排</div>

    <div class="fortune-tube-wrap">
      <img class="fortune-tube-bg" src="assets/bg-tube.jpg" alt="财神签筒" id="tube">
    </div>

    <div class="shake-copy-card">
      <div>摇 一 摇 手 机</div>
      <div>求 取 今 日 财 运 签</div>
    </div>

    <button class="fortune-shake-btn" id="btnShake"><span class="shake-phone-icon">财运+1</span></button>
  </div>

  <!-- 抽签后 -->
  <div class="stage stage-after" id="stageAfter" style="display:none;">

    <!-- ★ 财神签（设计规范 v2 · 4级签文）★ -->
    <div class="sign-unified sign-${s.gradeCls}" style="--gc:${s.gradeColor};--ga:${s.accentColor};--bgi:url('${s.bgImage}');">
      <!-- 四角装饰 -->
      <div class="sign-u-corner tl"></div><div class="sign-u-corner tr"></div>
      <div class="sign-u-corner bl"></div><div class="sign-u-corner br"></div>
      <!-- 关闭按钮（返回签筒页） -->
      <button class="sign-close-btn" id="btnSignClose" aria-label="返回">✕</button>
      <!-- 顶行：签号 + 日期 -->
      <div class="sign-u-head">
        <span class="sign-u-no">${s.stickNo}</span>
        <span class="sign-u-date">${s.date}</span>
      </div>
      <!-- 等级大字 -->
      <div class="sign-u-grade">
        <span class="sign-u-grade-text">${s.gradeLabel}</span>
      </div>
      <!-- 操作建议条（双色 pill） -->
      <div class="sign-u-action">${s.action}</div>
      <!-- 分隔线 -->
      <div class="sign-u-divider">—</div>
      <!-- 诗句「」+ 解签文字 -->
      <div class="sign-u-poem">
        <div class="poem-ancient">「${s.poemAncient[0]}</div>
        <div class="poem-ancient">　${s.poemAncient[1]}」</div>
        <div class="poem-advice">${s.poemModern[0]}</div>
        <div class="poem-advice">${s.poemModern[1]}</div>
      </div>
      <!-- 市场数据（整合自趋势卡，周末隐藏） -->
      ${!s.isWeekend ? `
      <div class="sign-market-data" id="signMarketData">
        <div class="smd-row">
          <span class="smd-tag">今日</span>
          <span class="smd-val smd-trend-text">${s.trend}</span>
        </div>
        <div class="smd-row smd-row-sub">
          <span class="smd-label">主线</span>
          <span class="smd-val smd-hl-text">${s.mainLine}</span>
        </div>
      </div>` : ''}
      <!-- 底部口号 -->
      <div class="sign-u-footer">
        ${s.poemModern[0]} · ${s.poemModern[1]}
      </div>
      <!-- 交易状态栏（嵌入签卡底部） -->
      <div class="market-status-bar" id="marketStatusBar">
        <span class="ms-dot" id="msDot"></span>
        <span class="ms-label" id="msLabel">加载中...</span>
      </div>
      <!-- 盘前全球行情（动态注入） -->
      <div class="global-markets" id="globalMarkets" style="display:none;"></div>
    </div>

    <!-- ★ 大趋势（内容已整合至签卡内，隐藏空容器）★ -->
    <div class="card section trend-unified" id="trendCard" style="display:none;">
    </div>

    <!-- 板块指引（后续功能，暂时隐藏）
    <div class="card section" style="display:none;">
      <div class="card-title">· 板 块 指 引 ·</div>
      ...（板块详情内容保留代码，待后续开放）
    </div>
    -->

    <!-- ★ 大师团（专业口吻）★ -->
    <div class="card section masters-pro">
      <div class="card-title">· 大 师 团 圆 桌 ·</div>
      <div class="masters-consensus">共识结论 · <span class="gold">${s.action}</span></div>
      ${masters.map((m, i) => `
        <div class="master-pro-row">
          <div class="master-pro-head">
            <span class="master-pro-avatar" style="background:${m.color}">${m.initial}</span>
            <div class="master-pro-meta">
              <div class="master-pro-name">${m.name}</div>
              <div class="master-pro-school">${m.school}</div>
            </div>
            <div class="master-pro-verdict verdict-${m.verdictCls}">${m.verdict}</div>
          </div>
          <div class="master-pro-text">${m.text}</div>
          ${m.tactics ? `<div class="master-pro-tactics">◆ 战术 · ${m.tactics}</div>` : ''}
        </div>
      `).join('')}

      <!-- 大师团汇总报告 · 付费入口 -->
      <div class="masters-report-cta" onclick="App.buyMastersReport()">
        <div class="mrc-badge">PRO</div>
        <div class="mrc-body">
          <div class="mrc-title">解 锁 全 部 大 师 观 点</div>
          <div class="mrc-desc">价值·周期·游资·量化·行为·散户 — 六路高手各给一套买卖逻辑，不和稀泥</div>
        </div>
        <div class="mrc-arrow">›</div>
      </div>
    </div>

    <!-- 底部深入路径（板块详批后续功能，暂时隐藏） -->
    <div class="path-section">
      <div class="path-title">— 想 看 更 深 的？—</div>

      <!-- 板块详批（后续功能，隐藏）
      <div class="path-card path-sector" onclick="location.hash='#/sector'">
        <div class="path-icon">☰</div>
        <div class="path-body">
          <div class="path-name">板 块 详 批</div>
          <div class="path-desc">输入板块/个股 · 给一份卦象报告</div>
        </div>
        <div class="path-arrow">›</div>
      </div>
      -->

      <div class="path-card path-bazi" onclick="App.goBazi()">
        <div class="path-icon">命</div>
        <div class="path-body">
          <div class="path-name">我 的 命 盘</div>
          <div class="path-desc">输入生辰 · 看 60 年财运长线</div>
        </div>
        <div class="path-arrow">›</div>
      </div>
    </div>

    <div class="footer-hint">· 收盘后自动更新 · 娱乐参考 · 不构成投资建议 ·</div>
  </div>

</div>
  `;
};

Pages.sign.mount = () => {
  const btn = document.getElementById('btnShake');
  const tube = document.getElementById('tube');
  const before = document.getElementById('stageBefore');
  const after = document.getElementById('stageAfter');
  if (!btn || !tube) return;
  // 签筒页锁定滚动，签文页恢复滚动
  function lockScroll(locked) {
    const app = document.getElementById('app');
    if (app) app.style.overflowY = locked ? 'hidden' : '';
  }
  lockScroll(true);

  // 关闭按钮：返回签筒页
  const btnClose = document.getElementById('btnSignClose');
  if (btnClose) {
    btnClose.addEventListener('click', () => {
      if (before) before.style.display = '';
      if (after) after.style.display = 'none';
      btn.disabled = false;
      btn.innerHTML = '<span class="shake-phone-icon">财运+1</span>';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      lockScroll(true);
    });
  }

  btn.addEventListener('click', () => {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.textContent = '求 签 中...';

    // 同时启动远程数据加载
    const dataPromise = window.MarketSign.loadMarketSign
      ? window.MarketSign.loadMarketSign()
      : Promise.resolve({ sign: null, source: 'mock' });

    setTimeout(() => {
      before.style.display = 'none';
      after.style.display = 'block';
      lockScroll(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      dataPromise.then(({ sign, source }) => {
        if (!sign) return;
        if (sign.isHoliday) {
          after.innerHTML = renderHolidayStage(sign);
          return;
        }
        patchSignAfter(sign, source);
      }).catch(() => {});
    }, 600);
  });

  // 右上角 ☰ 菜单
  const menuBtn = document.getElementById('btnSignMenu');
  if (menuBtn) {
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const old = document.getElementById('signMenuPop');
      if (old) { old.remove(); return; }
      const pop = document.createElement('div');
      pop.id = 'signMenuPop';
      pop.className = 'sign-menu-pop';
      pop.innerHTML = `
        <div class="smp-item" data-act="reshake"><span class="smp-icon">⟲</span><span class="smp-text">重 摇 一 卦</span></div>
        <div class="smp-item" data-act="library"><span class="smp-icon">☷</span><span class="smp-text">财 运 簿</span></div>
        <div class="smp-item" data-act="me"><span class="smp-icon">☯</span><span class="smp-text">我 的 命 盘</span></div>
        <div class="smp-item" data-act="share"><span class="smp-icon">⤴</span><span class="smp-text">分 享 给 朋 友</span></div>
        <div class="smp-item" data-act="clear"><span class="smp-icon">⌫</span><span class="smp-text">清 除 缓 存</span></div>
      `;
      menuBtn.parentElement.appendChild(pop);
      pop.addEventListener('click', (ev) => {
        const item = ev.target.closest('.smp-item');
        if (!item) return;
        const act = item.dataset.act;
        pop.remove();
        if (act === 'reshake') { location.reload(); }
        else if (act === 'library') { location.hash = '#/library'; }
        else if (act === 'me') { location.hash = '#/me'; }
        else if (act === 'share') {
          const url = location.origin + location.pathname + '#/sign';
          if (navigator.share) {
            navigator.share({ title: '财神签 · 今日财运', text: '我刚抽了一签，来试试你的', url }).catch(()=>{});
          } else if (navigator.clipboard) {
            navigator.clipboard.writeText(url).then(()=> toast('链接已复制，去微信粘贴吧'));
          } else { toast('请手动复制：' + url); }
        }
        else if (act === 'clear') {
          if (confirm('确定清除本地缓存？将丢失生辰与签历史。')) {
            window.App && window.App.clearLocal && window.App.clearLocal();
            location.reload();
          }
        }
      });
      setTimeout(() => {
        document.addEventListener('click', function closer(ev2){
          if (!pop.contains(ev2.target) && ev2.target !== menuBtn) {
            pop.remove();
            document.removeEventListener('click', closer);
          }
        });
      }, 0);
    });
  }
};

// 将远程真实数据"打补丁"到已渲染的 stageAfter
function patchSignAfter(sign, source) {
  const after = document.getElementById('stageAfter');
  if (!after) return;

  // 0. 市场状态栏更新（修复"加载中"永不消失的问题）
  const msDot = after.querySelector('#msDot');
  const msLabel = after.querySelector('#msLabel');
  if (msLabel) {
    var isLive = (source === 'real' || source === 'remote');
    var ri = sign._realIndex;
    if (isLive && ri) {
      var chgPct = ri.changePercent || 0;
      var chgSign = chgPct >= 0 ? '+' : '';
      msLabel.textContent = '实时 · ' + (ri.name||'沪指') + ' ' + chgSign + chgPct.toFixed(2) + '%';
    } else {
      msLabel.textContent = (source === 'cache' ? '已缓存' : source === 'mock' ? '演示模式' : '数据已加载');
    }
  }
  if (msDot) { msDot.className = 'ms-dot ' + (source === 'real' || source === 'remote' ? 'live' : source === 'mock' ? 'mock' : ''); }
  // 更新状态栏文案 + 子行（label / subLabel）
  try {
    var mstatus = window.MarketSign ? window.MarketSign.getMarketStatus() : null;
    if (mstatus) {
      if (msLabel) msLabel.textContent = mstatus.label || '';
    }
  } catch(e) {}

  // 1. 顶部数据源徽章（一次性插入）— 醒目显示真实数据
  if (!document.getElementById('dataSourceBadge')) {
    const badge = document.createElement('div');
    badge.id = 'dataSourceBadge';
    const isLive = (source === 'real' || source === 'remote');
    const ri = sign._realIndex; // 真实指数对象 {name, price, changePercent, timestamp}
    badge.className = 'data-source-badge ' + (isLive ? 'live' : source === 'cache' ? 'cache' : 'mock');

    if (isLive && ri) {
      var chgPct = ri.changePercent || 0;
      var chgSign = chgPct >= 0 ? '+' : '';
      badge.innerHTML =
        '<span class="dsb-dot"></span>' +
        '<span class="dsb-text">● 实时 · ' + (ri.name||'上证') + ' <strong style="color:'+(chgPct>=0?'#E08393':'#6BA88B')+';">' + ri.price + '</strong> <em style="color:'+(chgPct>=0?'#E08393':'#6BA88B')+';">'+chgSign+chgPct.toFixed(2)+'%</em></span>' +
        '<span class="dsb-time">' + (ri.timestamp || '') + '</span>';
    } else {
      const labelMap = { real: '● 实时数据', remote: '● 实时数据', cache: '● 已缓存(旧)', mock: '○ 演示数据' };
      badge.innerHTML = '<span class="dsb-dot"></span><span class="dsb-text">' + (labelMap[source] || '○ 演示数据') + '</span><span class="dsb-time">' + ((sign.dataSource || '').replace('akshare · ', '').replace(' · ', '·')) + '</span>';
    }
    after.appendChild(badge); // 放到页面最底部
  }

  // 2. 等级徽章
  const heroLabel = after.querySelector('.grade-hero-label');
  if (heroLabel) heroLabel.textContent = sign.gradeLabel;
  const heroSub = after.querySelector('.grade-hero-sub');
  if (heroSub) heroSub.textContent = `${sign.stickNo} · ${sign.date}`;
  const heroRibbon = after.querySelector('.grade-hero-ribbon');
  if (heroRibbon) heroRibbon.textContent = sign.action;
  const heroRoot = after.querySelector('.grade-hero');
  if (heroRoot) {
    heroRoot.className = `grade-hero grade-hero-${sign.gradeCls}`;
    heroRoot.style.setProperty('--gc', sign.gradeColor);
  }

  // 2b. 新版签卡（sign-unified）的 action 条 + 等级样式
  const signAction = after.querySelector('.sign-u-action');
  if (signAction) signAction.textContent = sign.action;
  const signUnified = after.querySelector('.sign-unified');
  if (signUnified) {
    signUnified.className = 'sign-unified sign-' + (sign.gradeCls || 'zhongji');
    signUnified.style.setProperty('--gc', sign.gradeColor || '#F39C12');
    signUnified.style.setProperty('--ga', sign.accentColor || '#FFF2CC');
    if (sign.bgImage) signUnified.style.setProperty('--bgi', "url('" + sign.bgImage + "')");
  }
  // 签卡内等级文字
  const gradeText = after.querySelector('.sign-u-grade-text');
  if (gradeText) gradeText.textContent = sign.gradeLabel;

  // 3. 签诗
  const ancients = after.querySelectorAll('.poem-ancient');
  if (ancients[0]) ancients[0].textContent = `「${sign.poemAncient[0]}`;
  if (ancients[1]) ancients[1].textContent = `　${sign.poemAncient[1]}」`;
  const modern = after.querySelector('.poem-modern');
  if (modern) modern.textContent = `${sign.poemModern[0]} · ${sign.poemModern[1]}`;

  // 4. 三要点（旧版 .point-row 布局）
  const points = after.querySelectorAll('.point-row .point-val');
  if (points[0]) points[0].textContent = sign.trend;
  if (points[1]) points[1].textContent = sign.mainLine;
  if (points[2]) points[2].textContent = sign.risk;

  // 4b. 新版 market-summary-block 布局（msb-trend / msb-hl / msb-risk）
  const msbTrend = after.querySelector('.msb-trend');
  if (msbTrend) msbTrend.textContent = sign.trend;
  const msbHl = after.querySelector('.msb-hl');
  if (msbHl) msbHl.textContent = sign.mainLine;
  const msbRisk = after.querySelector('.msb-risk');
  if (msbRisk) msbRisk.textContent = sign.risk;

  // 4c. 签卡内市场数据区（signMarketData）
  const smdTrendText = after.querySelector('.smd-trend-text');
  if (smdTrendText) {
    var ri2 = sign._realIndex;
    var isLive2 = (source === 'real' || source === 'remote');
    if (isLive2 && ri2) {
      var cp2 = ri2.changePercent || 0;
      var cs2 = cp2 >= 0 ? '+' : '';
      // trend(如"偏多") + 指数实时数据
      smdTrendText.textContent = sign.trend + ' · ' + (ri2.name || '沪指') + ' ' + cs2 + cp2.toFixed(2) + '%';
    } else {
      smdTrendText.textContent = sign.trend;
    }
  }
  const smdHlText = after.querySelector('.smd-hl-text');
  if (smdHlText) smdHlText.textContent = sign.mainLine;

  // 5. 板块详批（顺势 / 逆势）
  const ex = sign.expand || {};
  const pickRows = after.querySelectorAll('.sector-detail-row.pick');
  (ex.sectorPickDetail || []).slice(0, pickRows.length).forEach((d, i) => {
    const row = pickRows[i];
    const name = row.querySelector('.sd-name');
    const chg = row.querySelector('.sd-chg');
    const flow = row.querySelector('.sd-flow');
    if (name) name.textContent = d.name;
    if (chg) { chg.textContent = d.chg; chg.className = 'sd-chg ' + ((d.chgRaw || 0) >= 0 ? 'up' : 'down'); }
    if (flow) flow.textContent = '主力 ' + d.flow;
  });
  const avoidRows = after.querySelectorAll('.sector-detail-row.avoid');
  (ex.sectorAvoidDetail || []).slice(0, avoidRows.length).forEach((d, i) => {
    const row = avoidRows[i];
    const name = row.querySelector('.sd-name');
    const chg = row.querySelector('.sd-chg');
    const flow = row.querySelector('.sd-flow');
    if (name) name.textContent = d.name;
    if (chg) { chg.textContent = d.chg; chg.className = 'sd-chg ' + ((d.chgRaw || 0) >= 0 ? 'up' : 'down'); }
    if (flow) flow.textContent = '主力 ' + d.flow;
  });

  // 6. 北向 + 黑马
  const dhText = after.querySelector('.dh-text');
  if (dhText) dhText.innerHTML = `北向 ${ex.northFlow || '—'} · 加仓 <span class="gold">${ex.darkHorse || '—'}</span>`;

  // 7. 情绪条 + 涨跌家数
  const meterFill = after.querySelector('.meter-fill');
  if (meterFill) {
    meterFill.style.width = `${ex.emotion || 50}%`;
    meterFill.style.background = sign.gradeColor;
  }
  const meterNum = after.querySelector('.meter-num');
  if (meterNum) { meterNum.textContent = ex.emotion || 50; meterNum.style.color = sign.gradeColor; }
  const meterLabel = after.querySelector('.meter-label');
  if (meterLabel) meterLabel.textContent = ex.emotionLabel || '中 性';
  const updown = after.querySelector('.meter-stat');
  if (updown) updown.innerHTML = `涨 <span class="up">${ex.upCount || 0}</span> · 跌 <span class="down">${ex.downCount || 0}</span>`;

  // 7b. 情绪描述行（全场多空文字）
  const emoLine = after.querySelector('.trend-emotion-line');
  if (emoLine && ex.upCount && ex.downCount) {
    var totalS = ex.upCount + ex.downCount;
    var diffS = Math.abs(ex.upCount - ex.downCount);
    var emoText = '全场 ' + totalS + ' 只个股互有涨跌，';
    if (diffS <= 200) emoText += '多空势均力敌';
    else if (ex.upCount > ex.downCount) emoText += '多头略占上风';
    else emoText += '空头稍强';
    emoLine.textContent = emoText;
  }

  // 8. 大师团（含已购付费大师）
  const masters = sign.mastersAdapted || (sign.masters && sign.masters.list) || [];
  var allMasters = [...masters];
  // 追加已购买的付费大师
  try {
    var boughtIds = JSON.parse(localStorage.getItem('caiyunju:premiumMasters') || '[]');
    if (boughtIds.length > 0 && window.MarketSign.buildPremiumMasters) {
      var premAll = window.MarketSign.buildPremiumMasters(sign);
      premAll.forEach(function(pm) {
        if (boughtIds.indexOf(pm.id) >= 0) {
          allMasters.push(pm);
        }
      });
    }
  } catch(e) {}

  // ★ 大师团数据行（引导行已移除，所有 .master-pro-row 都是数据行）
  var dataRows = after.querySelectorAll('.master-pro-row');

  // 如果付费大师多，动态追加数据行（插入到共识行前面）
  if (allMasters.length > dataRows.length) {
    var mastersSection = after.querySelector('.masters-pro');
    if (mastersSection) {
      for (var ei = dataRows.length; ei < allMasters.length; ei++) {
        var mTemplate = allMasters[ei] || {};
        var newRow = document.createElement('div');
        newRow.className = 'master-pro-row';
        newRow.innerHTML =
          '<div class="master-pro-head">' +
            '<span class="master-pro-avatar" style="background:' + (mTemplate.color||'#666') + '">' + (mTemplate.initial||'?') + '</span>' +
            '<div class="master-pro-meta">' +
              '<div class="master-pro-name">' + (mTemplate.name||'') + '</div>' +
              '<div class="master-pro-school">' + (mTemplate.school||'') + '</div>' +
            '</div>' +
            '<div class="master-pro-verdict verdict-' + (mTemplate.verdictCls||'hold') + '">' + (mTemplate.verdict||'') + '</div>' +
          '</div>' +
          '<div class="master-pro-text">' + (mTemplate.text||'') + '</div>' +
          (mTemplate.tactics ? '<div class="master-pro-tactics">◆ 战术 · ' + mTemplate.tactics + '</div>' : '');
        var cta = after.querySelector('.masters-report-cta');
        // [优化] 共识结论已移到标题下方，付费大师行追加到列表末尾(CTA之前)
        if (cta) mastersSection.insertBefore(newRow, cta);
        else mastersSection.appendChild(newRow);
      }
      dataRows = after.querySelectorAll('.master-pro-row');
    }
  }

  allMasters.slice(0, dataRows.length).forEach((m, i) => {
    const row = dataRows[i];
    if (!row) return;
    const av = row.querySelector('.master-pro-avatar');
    const nm = row.querySelector('.master-pro-name');
    const sc = row.querySelector('.master-pro-school');
    const vd = row.querySelector('.master-pro-verdict');
    const tx = row.querySelector('.master-pro-text');
    if (av) { av.textContent = m.initial; av.style.background = m.color; }
    if (nm) nm.textContent = m.name;
    if (sc) sc.textContent = m.school;
    if (vd) { vd.textContent = m.verdict; vd.className = 'master-pro-verdict verdict-' + (m.verdictCls || 'hold'); }
    if (tx) tx.textContent = m.text;
  });
  const consensus = after.querySelector('.masters-consensus .gold');
  if (consensus) {
    // 基于所有大师（含付费）重新算共识
    var allVerdicts = allMasters.map(function(m) { return m.verdict; });
    var buyCount = allVerdicts.filter(function(v) { return v==='BUY'; }).length;
    var holdCount = allVerdicts.filter(function(v) { return v==='HOLD'; }).length;
    var sellCount = allVerdicts.filter(function(v) { return v==='SELL'; }).length;
    var finalV = buyCount >= Math.ceil(allMasters.length/2) ? '加仓'
      : sellCount >= Math.ceil(allMasters.length/2) ? '减仓' : '持仓观望';
    consensus.textContent = finalV || (sign.masters && sign.masters.consensus) || sign.action;

    // 更新共识结论标签
    var consensusLabel = after.querySelector('.masters-consensus');
    if (consensusLabel) {
      var totalStr = allMasters.length + '派';
      var voteStr = '';
      if (buyCount) voteStr += buyCount + '多 ';
      if (holdCount) voteStr += holdCount + '中 ';
      if (sellCount) voteStr += sellCount + '空';
      consensusLabel.innerHTML = '共识结论 · <span class="gold">' + finalV
        + '</span> <span style="font-size:10px;opacity:0.4;margin-left:4px;">(' + voteStr.trim() + ')</span>';
    }
  }

  // 9. 首页板块指引 — 异步注入真实涨跌幅
  if (window.MarketSign.fetchAllSectorsReal) {
    var allSectorNames = (ex.sectorPick || []).concat(ex.sectorAvoid || []);
    if (allSectorNames.length > 0) {
      window.MarketSign.fetchAllSectorsReal(allSectorNames).then(function(sectorMap){
        // 更新宜板块 chip
        var pickChips = after.querySelectorAll('.paper-chip.pick');
        pickChips.forEach(function(chip){
          var name = chip.textContent.trim();
          var data = sectorMap[name];
          if (data && data.realData) {
            var chg = data.avgChgPct;
            chip.innerHTML = name + ' <span style="font-size:10px;opacity:0.8;">' + (chg>=0?'+':'') + chg.toFixed(1) + '%</span>';
            chip.style.borderColor = chg >= 0 ? 'rgba(224,131,147,0.5)' : 'rgba(107,168,139,0.5)';
          }
        });
        // 更新忌板块 chip
        var avoidChips = after.querySelectorAll('.paper-chip.avoid');
        avoidChips.forEach(function(chip){
          var name = chip.textContent.trim();
          var data = sectorMap[name];
          if (data && data.realData) {
            var chg = data.avgChgPct;
            chip.innerHTML = name + ' <span style="font-size:10px;opacity:0.8;">' + (chg>=0?'+':'') + chg.toFixed(1) + '%</span>';
            chip.style.borderColor = chg >= 0 ? 'rgba(224,131,147,0.5)' : 'rgba(107,168,139,0.5)';
          }
        });
        console.log('[Sign] 板块真实数据已注入', Object.keys(sectorMap));
      }).catch(function(e){ console.warn('[Sign] 板块数据获取失败:', e.message); });
    }
  }

  // ★ 10. 市场状态初始化（时段感知 + 全球行情 + 自动刷新）★
  initMarketStatus();
}

/**
 * 初始化市场状态栏 + 全球行情 + 自动刷新
 */
function initMarketStatus() {
  var _refreshTimer = null;

  /** 更新状态栏 UI */
  function updateStatusBar() {
    var ms = window.MarketSign && window.MarketSign.getMarketStatus
      ? window.MarketSign.getMarketStatus()
      : { status: 'closed', label: '已收盘', subLabel: '', canRefresh: false, countdownText: '', isTradingDay: false };

    var dot = document.getElementById('msDot');
    var label = document.getElementById('msLabel');
    if (!dot || !label) return;

    // 状态点颜色
    var colorMap = {
      pre_market: '#EF9F27',   // 橙 - 早间
      auction: '#B5D4F4',     // 蓝 - 竞价
      trading: '#6BA88B',     // 绿 - 交易中
      lunch: '#F0997B',       // 橙红 - 午休
      closed: '#888780',      // 灰 - 收盘
      holiday: '#AFA9EC',     // 紫 - 节假日
    };
    dot.style.background = colorMap[ms.status] || '#888780';

    // 标签文字
    label.textContent = ms.label;

    // 早间显示全球行情
    var gm = document.getElementById('globalMarkets');
    if (gm) {
      gm.style.display = (ms.status === 'pre_market') ? '' : 'none';
      if (ms.status === 'pre_market' && gm.children.length === 0) {
        loadGlobalMarkets(gm);
      }
    }

    // 开盘中自动刷新（每5分钟）
    if (_refreshTimer) clearInterval(_refreshTimer);
    if (ms.canRefresh) {
      _refreshTimer = setInterval(function(){ refreshIndexData(); }, 5 * 60 * 1000);
    }

    // 状态点动画（仅交易中闪烁）
    if (ms.status === 'trading') {
      dot.classList.add('pulse');
    } else {
      dot.classList.remove('pulse');
    }
  }

  /** 加载全球行情数据 */
  function loadGlobalMarkets(container) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/global', true);
    xhr.timeout = 8000;
    xhr.onload = function() {
      try {
        var j = JSON.parse(xhr.responseText);
        if (!j.success || !j.markets || j.markets.length === 0) return;
        container.innerHTML = '<div class="gm-title">隔夜行情</div>' +
          j.markets.map(function(m){
            var cls = m.changePercent >= 0 ? 'up' : 'down';
            var sign = m.changePercent >= 0 ? '+' : '';
            return '<div class="gm-row"><span class="gm-name">' + m.shortName + '</span>' +
              '<span class="gm-price">' + m.price.toFixed(0) + '</span>' +
              '<span class="gm-chg ' + cls + '">' + sign + m.changePercent.toFixed(2) + '%</span></div>';
          }).join('');
      } catch(e) {}
    };
    xhr.onerror = xhr.ontimeout = function() {};
    xhr.send();
  }

  /** 静默刷新指数数据（不重新渲染整个页面，只更新数字） */
  function refreshIndexData() {
    var emLine = document.getElementById('emotionLine');
    if (!emLine) return;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/index', true);
    xhr.timeout = 6000;
    xhr.onload = function() {
      try {
        var j = JSON.parse(xhr.responseText);
        if (j.success && j.index) {
          console.log('[AutoRefresh] 指数更新:', j.index.name, j.index.price, '(' + j.index.changePercent + '%)');
        }
      } catch(e) {}
    };
    xhr.send();
  }

  // 首次执行
  updateStatusBar();

  // 每分钟更新一次状态（倒计时变化）
  setInterval(updateStatusBar, 60 * 1000);
}

// 节假日特殊态
function renderHolidayStage(sign) {
  return `
    <div class="holiday-stage">
      <div class="holiday-icon">☯</div>
      <div class="holiday-title">今 日 休 市</div>
      <div class="holiday-sub">财 神 也 歇 着</div>
      <div class="gold-divider"><div class="gold-divider-rhombus"></div></div>
      <div class="holiday-reason">${sign.holidayReason || ''}</div>
      <div class="holiday-card">
        <div class="hc-label">上一交易日 · ${sign.date} · ${sign.gradeLabel}</div>
        <div class="hc-poem">「${sign.poemAncient[0]}　${sign.poemAncient[1]}」</div>
        <div class="hc-row"><span class="hc-k">大 势</span><span class="hc-v">${sign.trend}</span></div>
        <div class="hc-row"><span class="hc-k">主 线</span><span class="hc-v">${sign.mainLine}</span></div>
        <div class="hc-row"><span class="hc-k">风 险</span><span class="hc-v">${sign.risk}</span></div>
      </div>
      <div class="holiday-tip">下 个 交 易 日 收 盘 后 自 动 更 新</div>
    </div>
  `;
}

// ========= 板块详批 =========
Pages.sector = () => {
  const used = parseInt(localStorage.getItem('caiyunju:sectorUsed') || '0', 10);
  const isFree = used === 0;
  return `
<button class="back-btn" onclick="location.hash='#/index'">‹</button>
<div class="dust-bg"></div>
<div class="page-wrap">
  <div class="page-title">板 块 详 批</div>
  <div class="page-sub">输入板块或个股 · 即可起卦</div>
  <div class="gold-divider"><div class="gold-divider-rhombus"></div></div>

  <div class="input-card">
    <div class="hot-label">热 门 板 块</div>
    <div class="hot-chips">
      ${window.MarketSign.HOT_SECTORS.map(s => `<span class="hot-chip" data-name="${s}">${s}</span>`).join('')}
    </div>
    <input class="form-input cast-input" id="sectorInput" placeholder="或输入板块/个股名" />
  </div>

  <button class="btn-cast-hero" id="btnCast">
    <span class="cast-symbol">☰</span>
    <span class="cast-text">起 卦</span>
    <span class="cast-tag-${isFree ? 'free' : 'paid'}">${isFree ? '今 日 首 次 · 免 费' : '本 次 ¥ 1 . 9 9'}</span>
  </button>
  <div class="cast-pricing-hint">${isFree ? '· 首次起卦免费 · 此后 ¥1.99 / 次 或 ¥9.9 / 月不限次 ·' : '· 已用完今日免费额度 · 起卦 ¥1.99 / 次 · 月卡 ¥9.9 ·'}</div>

  <div id="reportArea"></div>
</div>
  `;
};

Pages.sector.mount = () => {
  const input = document.getElementById('sectorInput');
  const area = document.getElementById('reportArea');
  let selected = '';

  // 选中板块（不自动起卦）
  document.querySelectorAll('.hot-chip').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.hot-chip').forEach(x => x.classList.remove('active'));
      el.classList.add('active');
      selected = el.dataset.name;
      input.value = '';
    });
  });

  document.getElementById('btnCast').addEventListener('click', () => {
    const name = (input.value || '').trim() || selected;
    if (!name) { toast('先选个板块或输入名称'); return; }

    const used = parseInt(localStorage.getItem('caiyunju:sectorUsed') || '0', 10);

    if (used === 0) {
      // 首次免费
      localStorage.setItem('caiyunju:sectorUsed', '1');
      const tag = document.querySelector('#btnCast .cast-tag-free');
      if (tag) {
        tag.className = 'cast-tag-paid';
        tag.textContent = '本 次 ¥ 1 . 9 9';
      }
      const hint = document.querySelector('.cast-pricing-hint');
      if (hint) hint.textContent = '· 起卦 ¥1.99 / 次 · 开通月卡 ¥9.9 不限次 ·';
      toast('首次起卦 · 免费送给你', 1500);
      renderReport(name);
    } else {
      // 付费起卦（演示：不做拦截，直接扣 + 出报告）
      toast('本次起卦 ¥1.99（演示） · 生成中...', 1500);
      renderReport(name);
    }
  });

  function renderReport(name) {
    // 先显示 loading
    area.innerHTML = '<div class="card section" style="text-align:center;padding:40px 0;color:rgba(212,168,83,0.6);"><div style="font-size:24px;margin-bottom:12px;">☯</div><div>正在获取「'+name+'」实时行情...</div></div>';

    // 并行：基础卦象数据（即时）+ 真实板块数据（网络请求）
    var r = window.MarketSign.getSectorReport(name);
    var realPromise = window.MarketSign.fetchSectorRealData(name);

    realPromise.then(function(real){
      console.log('[Sector] 真实数据:', real ? real.sectorName+' 涨跌'+real.avgChgPct+'%' : '无（降级mock）');
      renderFullReport(r, real || null, name);
    }).catch(function(err){
      console.warn('[Sector] 真实数据获取失败:', err.message);
      renderFullReport(r, null, name);
    });
  }

  /**
   * 完整渲染报告（支持真实数据注入）
   * @param {Object} r - getSectorReport 基础数据（卦象/评分/mock）
   * @param {Object|null} real - fetchSectorRealData 真实数据（可为null则纯mock）
   * @param {string} name - 板块名
   */
  function renderFullReport(r, real, name) {
    // 用真实数据覆盖 mock 字段
    var hasReal = !!(real && real.realData);
    var avgChg = hasReal ? real.avgChgPct : parseFloat(((Math.random()-0.4)*3).toFixed(2)); // fallback
    // 龙头信息
    var leaderName = hasReal ? real.leader.name : (r.sectorName === 'AI算力' ? '中际旭创' : r.sectorName === '半导体' ? '中芯国际' : '—');
    var leaderChg  = hasReal ? real.leader.chg : (avgChg >= 0 ? '+' : '') + avgChg.toFixed(2) + '%';
    // 支撑阻力位：有真实数据时基于龙头股价估算，否则用 mock
    var basePrice = hasReal ? real.leader.price : 100;
    var support   = hasReal ? Math.round(basePrice * 0.96) : r.support;
    var resistance= hasReal ? Math.round(basePrice * 1.05) : r.resistance;
    var curPrice  = hasReal ? Math.round(basePrice * (1 + avgChg/100)) : Math.round(support + (resistance - support) * 0.45);
    var yCloseVal = hasReal ? Math.round(basePrice) : Math.round(support + (resistance - support) * 0.4);
    // 资金流向
    var fundFlowStr = hasReal ? real.totalFlow : r.fundFlow;
    // 调整趋势分（基于真实涨跌幅微调）
    var trendScore = hasReal ? Math.max(15, Math.min(95, r.trendScore + avgChg * 5)) : r.trendScore;

    area.innerHTML = `
      <div class="gua-card">
        <div class="gua-symbol">${r.guaSymbol}</div>
        <div class="gua-info">
          <div class="gua-name">${r.guaName} · ${r.sectorName}</div>
          <div class="gua-poem">「${r.guaPoem}」</div>
          ${hasReal ? '<div style="font-size:10px;color:#D4A853;margin-top:4px;">✦ 实时数据 · '+(real.timestamp||new Date().toLocaleTimeString('zh-CN'))+'</div>' : ''}
        </div>
      </div>

      <!-- 真实数据卡片（仅在有真实数据时显示） -->
      ${hasReal ? `
      <div class="card section" style="border-color: rgba(212,168,83,0.25);">
        <div class="card-title" style="color:#D4A853;">· 实 时 行 情 · <span style="font-size:11px;opacity:0.7;">${hasReal ? (real.timestamp||'代理实时') : 'mock'}</span></div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;">
          <div>
            <span style="font-size:22px;font-weight:bold;color:${avgChg>=0?'#E08393':'#6BA88B'};">${avgChg>=0?'+':''}${avgChg.toFixed(2)}%</span>
            <span style="font-size:11px;color:rgba(245,241,232,0.5);margin-left:6px;">代表股均值</span>
          </div>
          <div style="text-align:right;font-size:11px;color:rgba(245,241,232,0.6);">
            <div>龙头: <span style="color:${real.leader.changePercent>=0?'#E08393':'#6BA88B'};">${leaderName} ${leaderChg}</span></div>
            <div>代表股 ${real.upCount}涨/${real.downCount}跌</div>
          </div>
        </div>
        ${real.stocks.length > 0 ? `
        <div style="margin-top:8px;border-top:1px solid rgba(212,168,83,0.1);padding-top:8px;">
          <div style="font-size:10px;color:rgba(245,241,232,0.4);margin-bottom:4px;">代表股明细</div>
          ${real.stocks.map(function(s){
            var c = s.changePercent || 0;
            return '<span style="display:inline-block;background:rgba(255,255,255,0.06);border-radius:8px;padding:2px 8px;margin:2px 4px 2px 0;font-size:11px;color:'+(c>=0?'#E08393':'#6BA88B')+';">'+s.name+' '+(c>=0?'+':'')+c.toFixed(2)+'%</span>';
          }).join('')}
        </div>
        ` : ''}
      </div>
      ` : ''}

      <div class="card section">
        <div class="card-title">· 三 言 定 调 ·</div>
        <div class="point-row">
          <span class="point-key">势 能</span>
          <div class="point-val">
            <div class="trend-bar"><div class="trend-fill" style="width:${trendScore}%"></div></div>
            <span class="trend-num">${Math.round(trendScore)} / 100 · ${trendScore>=75?'强':trendScore>=55?'中':trendScore>=35?'弱':'危'}</span>
          </div>
        </div>
        <div class="point-row"><span class="point-key">暗 流</span><span class="point-val">${fundFlowStr}${hasReal?' · 实际':''}</span></div>
      </div>

      ${(() => {
        // 技术指标速读（基于真实涨跌幅微调后的 trendScore 派生）
        const sc = Math.round(trendScore);
        const ma5  = sc >= 60 ? '上 行' : sc >= 40 ? '走 平' : '下 行';
        const ma20 = sc >= 70 ? '多 头 排 列' : sc >= 50 ? '纠 缠' : '空 头 排 列';
        const macd = sc >= 65 ? '金叉 · 0轴上' : sc >= 50 ? '0轴附近' : '死叉 · 0轴下';
        const rsi  = sc >= 70 ? Math.min(80, sc + 5) : Math.max(20, sc - 10);
        const rsiLabel = rsi >= 70 ? '超 买' : rsi <= 30 ? '超 卖' : '中 性';
        const kdj  = sc >= 65 ? 'K>D · 多头' : sc >= 45 ? '中性' : 'K<D · 空头';
        const boll = sc >= 70 ? '上轨附近' : sc >= 50 ? '中轨' : '下轨附近';
        const obv  = avgChg > 0.3 ? '量价齐升 · 资金流入' : avgChg < -0.3 ? '量增价跌 · 派发' : '量价背离';
        return `
      <div class="card section indicators-card">
        <div class="card-title">· 技 术 指 标 速 读 ·${hasReal?'<span style="font-size:10px;opacity:0.5;float:right;">基于实际行情</span>':''}</div>
        <div class="ind-grid">
          <div class="ind-cell">
            <div class="ind-key">MA5</div>
            <div class="ind-val">${ma5}</div>
          </div>
          <div class="ind-cell">
            <div class="ind-key">MA20</div>
            <div class="ind-val">${ma20}</div>
          </div>
          <div class="ind-cell">
            <div class="ind-key">MACD</div>
            <div class="ind-val">${macd}</div>
          </div>
          <div class="ind-cell">
            <div class="ind-key">RSI(14)</div>
            <div class="ind-val">${rsi} · ${rsiLabel}</div>
          </div>
          <div class="ind-cell">
            <div class="ind-key">KDJ</div>
            <div class="ind-val">${kdj}</div>
          </div>
          <div class="ind-cell">
            <div class="ind-key">布林带</div>
            <div class="ind-val">${boll}</div>
          </div>
          <div class="ind-cell ind-wide">
            <div class="ind-key">OBV 能量潮</div>
            <div class="ind-val">${obv}</div>
          </div>
        </div>
      </div>
        `;
      })()}

      ${(() => {
        // 资金动向 — 有真实数据时用真实涨跌修正今日柱
        const seed2 = Array.from(name).reduce(function(a,c){return a+c.charCodeAt(0);},0);
        const days = ['T-4', 'T-3', 'T-2', 'T-1', '今 日'];
        const flowVals = days.map(function(_, i){
          var base = (trendScore - 50) * 0.3;
          var noise = Math.sin((seed2 + i) * 1.7) * 6;
          var val = Math.round(base + noise + (i === 4 ? (trendScore-50)/8 : 0));
          // 今日柱：有真实数据时用真实涨跌幅估算
          if(i === 4 && hasReal){
            val = Math.round(avgChg * real.stocks.length * 2.5);
          }
          return val;
        });
        var maxAbs = Math.max.apply(null, flowVals.map(function(v){return Math.abs(v);}).concat([5]));
        var total = flowVals.reduce(function(a,b){return a+b;},0);
        return `
      <div class="card section flow-card">
        <div class="card-title">· 主 力 资 金 · 五 日 时 序 ·</div>
        <div class="flow-bars">
          ${flowVals.map(function(v, i){
            var h = Math.abs(v) / maxAbs * 70;
            var cls = v >= 0 ? 'up' : 'down';
            return '<div class="flow-bar-col"><div class="flow-bar-area '+cls+'">'+(v>=0 ? '<div class="flow-bar '+cls+'" style="height:'+h+'%; align-self:flex-end;"></div>' : '<div class="flow-bar '+cls+'" style="height:'+h+'%; align-self:flex-start;"></div>')+'</div><div class="flow-bar-val '+cls+'">'+(v>=0?'+':'')+v+'亿</div><div class="flow-bar-day">'+days[i]+'</div></div>';
          }).join('')}
        </div>
        <div class="flow-summary">
          5 日累计 <span class="${total>=0?'up':'down'}">${total>=0?'+':''}${total.toFixed(1)} 亿</span>
          ${hasReal ? '· 今日基于'+real.stocks.length+'只代表股实盘' : ''}
        </div>
      </div>
        `;
      })()}

      <div class="card section card-warn">
        <div class="warn-icon">⚠</div>
        <div class="warn-body">
          <div class="warn-title">${r.riskTitle}</div>
          <div class="warn-text">${r.riskText}</div>
        </div>
      </div>

      <div class="card section masters">
        <div class="card-title">· 大 师 团 共 识 ·</div>
        <div class="master-row"><span class="master-name">趋 势 派</span><span class="master-text">${r.masterTrend}</span></div>
        <div class="master-row"><span class="master-name">资 金 派</span><span class="master-text">${r.masterFund}</span></div>
        <div class="master-row"><span class="master-name">风 控 派</span><span class="master-text">${r.masterRisk}</span></div>
      </div>

      <div class="action-card">
        <span class="action-card-label">◆ 操 盘 建 议</span>
        <span class="action-card-text">${r.action}</span>
      </div>

      <div class="footer-hint">· 卦象基于近期价量与资金面 · 不构成投资建议 ·</div>
    `;
  }
};

// ========= 财运簿（历史签 + 已购报告）=========
Pages.library = () => {
  const purchased = localStorage.getItem('caiyunju:mastersReport') === '1';
  const sectorUsed = parseInt(localStorage.getItem('caiyunju:sectorUsed') || '0', 10);
  const today = window.MarketSign.getMarketSign();

  const fakeHistory = [
    { date: '今 日',  no: today.stickNo,  grade: today.gradeLabel, gradeCls: today.gradeCls, action: today.action },
    { date: '昨 日',  no: '第 廿 二 签',   grade: '中 吉', gradeCls: 'good', action: '低吸高抛 · 控制仓位' },
    { date: '5/9',   no: '第 廿 一 签',   grade: '上 吉', gradeCls: 'great', action: '顺势持股 · 不追高' },
    { date: '5/8',   no: '第 廿 ○ 签',   grade: '下 平', gradeCls: 'bad', action: '降低仓位 · 暂避锋芒' },
    { date: '5/7',   no: '第 十 九 签',   grade: '中 平', gradeCls: 'mid', action: '降低预期 · 少动多看' },
  ];

  return `
<div class="dust-bg"></div>
<div class="page-wrap lib-wrap">

  <div class="lib-top-brand">
    <div class="compass-mini"><div class="taiji-mini"></div></div>
    <div class="top-brand-text">
      <div class="top-brand-cn">财 运 簿</div>
      <div class="top-brand-en">FORTUNE LEDGER</div>
    </div>
  </div>

  <div class="lib-section">
    <div class="lib-h">
      <span class="lib-h-bar"></span>
      <span class="lib-h-name">已购报告</span>
    </div>
    ${purchased ? `
      <div class="lib-card lib-card-paid" onclick="App.buyMastersReport()">
        <div class="lib-paid-tag">PRO</div>
        <div class="lib-paid-body">
          <div class="lib-paid-title">大师团 PRO 观点</div>
          <div class="lib-paid-desc">${today.date} · ${today.stickNo} · 已解锁</div>
        </div>
        <div class="lib-paid-arrow">›</div>
      </div>
    ` : `
      <div class="lib-empty" onclick="location.hash='#/sign'">
        <div class="lib-empty-icon">·</div>
        <div class="lib-empty-text">还未解锁报告 · 点击进入今日签</div>
      </div>
    `}
    <div class="lib-stat-row">
      <div class="lib-stat-cell">
        <div class="lib-stat-num">${sectorUsed > 0 ? '已使用' : '未使用'}</div>
        <div class="lib-stat-key">板块详批 · 今日额度</div>
      </div>
      <div class="lib-stat-cell">
        <div class="lib-stat-num">${purchased ? '永久' : '未开通'}</div>
        <div class="lib-stat-key">大师团报告</div>
      </div>
    </div>
  </div>

  <div class="lib-section">
    <div class="lib-h">
      <span class="lib-h-bar"></span>
      <span class="lib-h-name">历史签</span>
      <span class="lib-h-hint">最近 5 日</span>
    </div>
    ${fakeHistory.map(h => `
      <div class="lib-history-row sign-grade-${h.gradeCls}">
        <div class="lib-h-date">${h.date}</div>
        <div class="lib-h-mid">
          <div class="lib-h-no">${h.no}</div>
          <div class="lib-h-action">${h.action}</div>
        </div>
        <div class="lib-h-grade lib-grade-${h.gradeCls}">${h.grade}</div>
      </div>
    `).join('')}
  </div>

  <div class="footer-hint">· 历史数据保留 30 天 · 娱乐参考 ·</div>
</div>
  `;
};

// ========= 我的 =========
Pages.me = () => {
  const hasBazi = !!state.userBazi;
  const purchased = localStorage.getItem('caiyunju:mastersReport') === '1';
  const r = state.userBazi;

  return `
<div class="dust-bg"></div>
<div class="page-wrap me-wrap">

  <div class="me-header">
    <div class="me-avatar">${hasBazi ? (r.input.gender === 'M' ? '乾' : '坤') : '·'}</div>
    <div class="me-info">
      <div class="me-name">${hasBazi ? `${r.input.gender === 'M' ? '乾造' : '坤造'} · ${r.input.year}` : '未排盘'}</div>
      <div class="me-sub">${hasBazi ? `日主 ${r.dayGan} · ${r.dayWuxing}` : '完成排盘后查看长线财运'}</div>
    </div>
    ${!hasBazi ? `<button class="me-btn-mini" onclick="location.hash='#/input'">去排盘</button>` : ''}
  </div>

  <div class="me-section">
    <div class="lib-h"><span class="lib-h-bar"></span><span class="lib-h-name">命盘服务</span></div>
    <div class="me-row" onclick="App.goBazi()">
      <div class="me-row-icon">命</div>
      <div class="me-row-body">
        <div class="me-row-name">我的命盘</div>
        <div class="me-row-desc">${hasBazi ? '查看命格 · 60 年财运时间轴' : '输入生辰 · 看 60 年财运长线'}</div>
      </div>
      <div class="me-row-arrow">›</div>
    </div>
    ${hasBazi ? `
      <div class="me-row" onclick="location.hash='#/today'">
        <div class="me-row-icon">日</div>
        <div class="me-row-body">
          <div class="me-row-name">今日运势</div>
          <div class="me-row-desc">基于八字 · 今日宜忌</div>
        </div>
        <div class="me-row-arrow">›</div>
      </div>
    ` : ''}
  </div>

  <div class="me-section">
    <div class="lib-h"><span class="lib-h-bar"></span><span class="lib-h-name">订阅与商城</span></div>
    <div class="me-row" onclick="App.buyMastersReport()">
      <div class="me-row-icon gold">PRO</div>
      <div class="me-row-body">
        <div class="me-row-name">大师观点</div>
        <div class="me-row-desc">${purchased ? '已解锁 · 每日更新' : '¥1.99/位 · ¥9.9/月全开'}</div>
      </div>
      <div class="me-row-arrow">›</div>
    </div>
    <div class="me-row" onclick="location.hash='#/gearup'">
      <div class="me-row-icon">物</div>
      <div class="me-row-body">
        <div class="me-row-name">开运商城</div>
        <div class="me-row-desc">命格定制 · 文化藏品</div>
      </div>
      <div class="me-row-arrow">›</div>
    </div>
  </div>

  <div class="me-section">
    <div class="lib-h"><span class="lib-h-bar"></span><span class="lib-h-name">设置</span></div>
    <div class="me-row" onclick="App.clearLocal()">
      <div class="me-row-icon">清</div>
      <div class="me-row-body">
        <div class="me-row-name">清空本地数据</div>
        <div class="me-row-desc">重置八字 / 已购 / 试用记录</div>
      </div>
      <div class="me-row-arrow">›</div>
    </div>
  </div>

  <div class="footer-hint">· v0.2 · 娱乐参考 不构成投资建议 ·</div>
</div>
  `;
};

// ========= 输入页 =========
// ========= 输入页（v2 · 现代滚轮 step）=========
Pages.input = () => {
  const hourList = [
    ['子时', '23:00–00:59'], ['丑时', '01:00–02:59'], ['寅时', '03:00–04:59'],
    ['卯时', '05:00–06:59'], ['辰时', '07:00–08:59'], ['巳时', '09:00–10:59'],
    ['午时', '11:00–12:59'], ['未时', '13:00–14:59'], ['申时', '15:00–16:59'],
    ['酉时', '17:00–18:59'], ['戌时', '19:00–20:59'], ['亥时', '21:00–22:59'],
    ['未知', '以子时计算'],
  ];
  const years = [];
  const thisYear = new Date().getFullYear();
  for (let y = thisYear - 80; y <= thisYear; y++) years.push(y);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  const wheelHtml = (id, list, def) => `
    <div class="wheel" data-wheel="${id}">
      <div class="wheel-mask top"></div>
      <div class="wheel-mask bottom"></div>
      <div class="wheel-list">
        ${list.map((v, i) => `<div class="wheel-item${i === def ? ' active' : ''}" data-val="${typeof v === 'object' ? v[0] : v}" data-idx="${i}">${typeof v === 'object' ? v[0] : v}</div>`).join('')}
      </div>
    </div>
  `;

  return `
<button class="back-btn" onclick="history.back()">‹</button>
<div class="dust-bg"></div>
<div class="page-wrap input-v2-wrap">

  <div class="iv2-progress">
    <div class="iv2-step active"><span>1</span>性别</div>
    <div class="iv2-line"></div>
    <div class="iv2-step active"><span>2</span>生日</div>
    <div class="iv2-line"></div>
    <div class="iv2-step active"><span>3</span>时辰</div>
  </div>

  <div class="iv2-title">输 入 你 的 生 辰</div>
  <div class="iv2-sub">数据仅在本地计算 · 不上传服务器</div>

  <div class="iv2-card">
    <div class="iv2-label">性 别</div>
    <div class="iv2-gender">
      <div class="iv2-gd active" id="genderM" data-g="M">
        <span class="iv2-gd-symbol">☰</span>
        <span class="iv2-gd-name">乾 · 男</span>
      </div>
      <div class="iv2-gd" id="genderF" data-g="F">
        <span class="iv2-gd-symbol">☷</span>
        <span class="iv2-gd-name">坤 · 女</span>
      </div>
    </div>
  </div>

  <div class="iv2-card">
    <div class="iv2-label">出 生 日 期 <span class="iv2-hint">公历</span></div>
    <div class="iv2-wheels">
      ${wheelHtml('year', years, 70)}
      ${wheelHtml('month', months, 0)}
      ${wheelHtml('day', days, 0)}
    </div>
    <div class="iv2-wheel-units">
      <span>年</span><span>月</span><span>日</span>
    </div>
  </div>

  <div class="iv2-card">
    <div class="iv2-label">出 生 时 辰 <span class="iv2-hint">不确定可选"未知"</span></div>
    <div class="iv2-hours">
      ${hourList.map((h, i) => `
        <div class="iv2-hour${i === 5 ? ' active' : ''}" data-hidx="${i}">
          <div class="iv2-hour-name">${h[0]}</div>
          <div class="iv2-hour-time">${h[1]}</div>
        </div>
      `).join('')}
    </div>
  </div>

  <button class="iv2-submit" id="btnSubmit">✦ 开 始 排 盘 ✦</button>

  <div class="iv2-privacy">
    <div class="iv2-pri-h">◇ 隐私承诺</div>
    <div class="iv2-pri-i">所有八字计算均在你浏览器本地完成</div>
    <div class="iv2-pri-i">生辰数据不会上传到任何服务器</div>
  </div>
</div>
  `;
};

Pages.input.mount = () => {
  let gender = 'M';
  let hourIdx = 5;
  let yIdx = 70, mIdx = 0, dIdx = 0;
  const thisYear = new Date().getFullYear();

  // 性别
  document.querySelectorAll('.iv2-gd').forEach(el => {
    el.onclick = () => {
      document.querySelectorAll('.iv2-gd').forEach(x => x.classList.remove('active'));
      el.classList.add('active');
      gender = el.dataset.g;
    };
  });

  // 时辰
  document.querySelectorAll('.iv2-hour').forEach(el => {
    el.onclick = () => {
      document.querySelectorAll('.iv2-hour').forEach(x => x.classList.remove('active'));
      el.classList.add('active');
      hourIdx = parseInt(el.dataset.hidx);
    };
  });

  // 滚轮（点击即选）
  document.querySelectorAll('.wheel').forEach(wheel => {
    const list = wheel.querySelector('.wheel-list');
    const items = wheel.querySelectorAll('.wheel-item');
    const ITEM_H = 36;
    const def = wheel.dataset.wheel === 'year' ? yIdx : 0;
    list.style.transform = `translateY(${-def * ITEM_H}px)`;

    items.forEach((it, i) => {
      it.onclick = () => {
        items.forEach(x => x.classList.remove('active'));
        it.classList.add('active');
        list.style.transform = `translateY(${-i * ITEM_H}px)`;
        const w = wheel.dataset.wheel;
        if (w === 'year') yIdx = i;
        else if (w === 'month') mIdx = i;
        else if (w === 'day') dIdx = i;
      };
    });

    // 滚动支持（touch + wheel）
    let startY = 0, startTrans = 0, dragging = false;
    list.addEventListener('touchstart', (e) => {
      dragging = true;
      startY = e.touches[0].clientY;
      const m = list.style.transform.match(/-?\d+(\.\d+)?/);
      startTrans = m ? parseFloat(m[0]) : 0;
    });
    list.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const dy = e.touches[0].clientY - startY;
      list.style.transform = `translateY(${startTrans + dy}px)`;
    });
    list.addEventListener('touchend', () => {
      dragging = false;
      const m = list.style.transform.match(/-?\d+(\.\d+)?/);
      const cur = m ? parseFloat(m[0]) : 0;
      let idx = Math.round(-cur / ITEM_H);
      idx = Math.max(0, Math.min(items.length - 1, idx));
      list.style.transform = `translateY(${-idx * ITEM_H}px)`;
      items.forEach((x, i) => x.classList.toggle('active', i === idx));
      const w = wheel.dataset.wheel;
      if (w === 'year') yIdx = idx;
      else if (w === 'month') mIdx = idx;
      else if (w === 'day') dIdx = idx;
    });
    wheel.addEventListener('wheel', (e) => {
      e.preventDefault();
      const w = wheel.dataset.wheel;
      let idx = w === 'year' ? yIdx : w === 'month' ? mIdx : dIdx;
      idx += e.deltaY > 0 ? 1 : -1;
      idx = Math.max(0, Math.min(items.length - 1, idx));
      list.style.transform = `translateY(${-idx * ITEM_H}px)`;
      items.forEach((x, i) => x.classList.toggle('active', i === idx));
      if (w === 'year') yIdx = idx;
      else if (w === 'month') mIdx = idx;
      else if (w === 'day') dIdx = idx;
    }, { passive: false });
  });

  document.getElementById('btnSubmit').onclick = () => {
    const y = (thisYear - 80) + yIdx;
    const m = mIdx + 1;
    const d = dIdx + 1;
    const hourMap = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 0];
    const h = hourMap[hourIdx];
    try {
      toast('起盘中...');
      const result = paipan({ year: y, month: m, day: d, hour: h, gender });
      state.userBazi = result;
      saveBazi();
      setTimeout(() => {
        const next = query('next');
        go(next ? decodeURIComponent(next) : '#/result');
      }, 600);
    } catch (e) {
      toast('排盘失败：' + e.message);
    }
  };
};

// ========= L0 免费排盘结果（合并原 quickcheck 免费开放）=========
Pages.result = () => {
  if (!requireBazi('#/result')) return '';
  const r = state.userBazi;
  const q = getQuickCheck(r);
  const sp = getSpeculationFit(r);

  // 投机适配颜色
  const spColor = sp.score >= 75 ? '#D4A853' : sp.score >= 55 ? '#C5B184' : sp.score >= 40 ? '#8A8DA0' : '#B8334A';
  const spIconSvg = sp.score >= 75
    ? `<svg viewBox="0 0 40 40" width="32" height="32"><path fill="${spColor}" d="M20 4l3.5 10h10l-8 6.5 3 10-8.5-6.5-8.5 6.5 3-10-8-6.5h10z"/></svg>`
    : sp.score >= 40
      ? `<svg viewBox="0 0 40 40" width="32" height="32"><circle cx="20" cy="20" r="15" fill="none" stroke="${spColor}" stroke-width="2.2"/><path stroke="${spColor}" stroke-width="2.5" stroke-linecap="round" fill="none" d="M12 20 L18 27 L28 14"/></svg>`
      : `<svg viewBox="0 0 40 40" width="32" height="32"><circle cx="20" cy="20" r="15" fill="none" stroke="${spColor}" stroke-width="2.2"/><path stroke="${spColor}" stroke-width="2.5" stroke-linecap="round" d="M14 14 L26 26 M26 14 L14 26"/></svg>`;

  return `
<button class="back-btn" onclick="location.hash='#/index'">‹</button>
<div class="dust-bg"></div>
<div class="page-wrap">
  <div class="brand-bar">
    <span class="brand-bar-text">FREE · 命 盘</span>
  </div>

  <div class="page-title-mini">${r.input.year}.${String(r.input.month).padStart(2,'0')}.${String(r.input.day).padStart(2,'0')} · ${r.input.gender === 'M' ? '乾' : '坤'}造</div>

  <div class="gold-divider"><div class="gold-divider-rhombus"></div></div>

  <!-- 四柱 -->
  <div class="bazi-board" id="anchorPillars">
    <div class="bazi-pillar">
      <div class="bazi-pillar-label">年</div>
      <div class="bazi-char">${r.bazi.year[0]}</div>
      <div class="bazi-char">${r.bazi.year[1]}</div>
      <div class="bazi-tag">${r.ganShishen.year}</div>
    </div>
    <div class="bazi-pillar">
      <div class="bazi-pillar-label">月</div>
      <div class="bazi-char">${r.bazi.month[0]}</div>
      <div class="bazi-char">${r.bazi.month[1]}</div>
      <div class="bazi-tag">${r.ganShishen.month}</div>
    </div>
    <div class="bazi-pillar highlight">
      <div class="bazi-pillar-label">日</div>
      <div class="bazi-char">${r.bazi.day[0]}</div>
      <div class="bazi-char">${r.bazi.day[1]}</div>
      <div class="bazi-tag">日 主</div>
    </div>
    <div class="bazi-pillar">
      <div class="bazi-pillar-label">时</div>
      <div class="bazi-char">${r.bazi.hour[0]}</div>
      <div class="bazi-char">${r.bazi.hour[1]}</div>
      <div class="bazi-tag">${r.ganShishen.hour}</div>
    </div>
  </div>

  <!-- ★ 投机炒股（固定展开紧凑版）★ -->
  <div class="spec-static" id="anchorSpec" style="--sp-color:${spColor};">
    <div class="spec-top spec-top-slim">
      <span class="spec-grade-pill spec-grade-pill-lg">${sp.level} 级</span>
      <span class="spec-verdict-txt">${sp.verdict}</span>
      <span class="spec-sep">·</span>
      <span class="spec-headline-inline">${sp.headline}</span>
    </div>
    <div class="spec-bullets">
      ${sp.bullets.map(b => `<div class="spec-bullet">◆ ${b}</div>`).join('')}
    </div>
    <div class="spec-sectors">
      <span class="spec-sectors-label">板块</span>
      ${sp.sectors.map(s => `<span class="sector-chip">${s}</span>`).join('')}
    </div>

    <!-- 六级适配梯度（可展开） -->
    <details class="spec-levels">
      <summary class="spec-levels-summary">▸ 六 级 投 机 适 配 梯 度</summary>
      <div class="spec-levels-grid">
        <div class="lv-row ${sp.level === 'S' ? 'current' : ''}"><span class="lv-pill" style="background:#D4A853">S</span><span class="lv-score">85-96</span><span class="lv-name">极适合</span><span class="lv-desc">天生交易者</span></div>
        <div class="lv-row ${sp.level === 'A' ? 'current' : ''}"><span class="lv-pill" style="background:#C89A5B">A</span><span class="lv-score">70-84</span><span class="lv-name">较适合</span><span class="lv-desc">敢赌有边界</span></div>
        <div class="lv-row ${sp.level === 'B' ? 'current' : ''}"><span class="lv-pill" style="background:#8A9A7D">B</span><span class="lv-score">55-69</span><span class="lv-name">中等</span><span class="lv-desc">有机会需择时</span></div>
        <div class="lv-row ${sp.level === 'C' ? 'current' : ''}"><span class="lv-pill" style="background:#8A8DA0">C</span><span class="lv-score">40-54</span><span class="lv-name">慎入</span><span class="lv-desc">被动投资为主</span></div>
        <div class="lv-row ${sp.level === 'D' ? 'current' : ''}"><span class="lv-pill" style="background:#7A5A6B">D</span><span class="lv-score">25-39</span><span class="lv-name">不建议</span><span class="lv-desc">长线定投</span></div>
        <div class="lv-row ${sp.level === 'F' ? 'current' : ''}"><span class="lv-pill" style="background:#B8334A">F</span><span class="lv-score">10-24</span><span class="lv-name">劝退</span><span class="lv-desc">命里破财门</span></div>
      </div>
    </details>
  </div>

  <!-- 命格卡（折叠）-->
  <span class="anchor-mark" id="anchorPattern"></span>
  <div class="fold-card pattern-fold" id="foldPattern">
    <div class="fold-head" onclick="App.toggleFold('foldPattern')">
      <div class="fold-head-mid fold-head-full">
        <div class="fold-head-label">财 富 命 格</div>
        <div class="fold-head-title gold">${q.pattern}</div>
      </div>
      <div class="fold-arrow">▾</div>
    </div>
    <div class="fold-body">
      <div class="pattern-brief">${q.description} · ${q.strategy}</div>
      <div class="advices-block-inline">
        <div class="adv-title">5 条 财 运 建 议</div>
        ${q.advices.map(v => `<div class="advice-item"><div class="advice-text">${v}</div></div>`).join('')}
      </div>
    </div>
  </div>

  <!-- 今日抽签入口 -->
  <span class="anchor-mark" id="anchorStick"></span>
  <div class="stick-entry" onclick="location.hash='#/today'">
    <div class="stick-entry-left">
      <div class="stick-icon-box">
        <div class="stick-icon-tube"></div>
        <div class="stick-icon-stick"></div>
      </div>
    </div>
    <div class="stick-entry-mid">
      <div class="stick-entry-title">今 日 财 运 抽 签</div>
    </div>
    <div class="stick-entry-right">
      <span class="arrow">›</span>
    </div>
  </div>

  <!-- 调整财运煽动卡 -->
  <span class="anchor-mark" id="anchorGear"></span>
  <div class="gearup-cta" onclick="location.hash='#/gearup'">
    <div class="gearup-bg-rune">✦</div>
    <div class="gearup-mid">
      <div class="gearup-kicker">命 有 定 数 · 运 却 可 调</div>
      <div class="gearup-title">是 否 想 调 整 你 的 财 运？</div>
    </div>
    <div class="gearup-arrow">›</div>
  </div>

  <div class="footer-hint">—— 基于《子平真诠》《滴天髓》 · 娱乐参考 ——</div>
</div>
  `;
};

// 命格卡默认折叠，不需要 mount
Pages.result.mount = () => {
  // 锚点导航已移除，此处无需绑定
};

// ========= 调整财运（开运道具 · 新入口）=========
Pages.gearup = () => {
  if (!requireBazi('#/gearup')) return '';
  const r = state.userBazi;
  const sp = getSpeculationFit(r);
  const dayWX = r.dayWuxing;

  // 开运方法库（按五行缺失/命格逻辑）
  const methodMap = {
    '木': { color: '#5DA9A0', dir: '东方', stone: '绿幽灵 · 翡翠 · 东陵石', number: '3、8', daily: '多穿青绿衣物，办公桌向东，养常青植物' },
    '火': { color: '#B8334A', dir: '南方', stone: '红玛瑙 · 石榴石 · 南红', number: '2、7', daily: '多穿红紫衣物，房间向阳，常点烛或香' },
    '土': { color: '#C89A5B', dir: '中/西南', stone: '黄水晶 · 虎眼石 · 黄玉', number: '5、10', daily: '多穿黄褐衣物，家中置陶瓷摆件，接地气' },
    '金': { color: '#D4A853', dir: '西方', stone: '白水晶 · 银饰 · 黑曜石', number: '4、9', daily: '多戴金属饰品，作息规律，办公桌向西' },
    '水': { color: '#4C6B9D', dir: '北方', stone: '黑曜石 · 蓝玉髓 · 青金石', number: '1、6', daily: '多穿蓝黑衣物，办公室放小鱼缸，常近水' },
  };
  const favorWX = { '木': '水', '火': '木', '土': '火', '金': '土', '水': '金' }[dayWX]; // 生我者
  const m = methodMap[favorWX] || methodMap[dayWX];

  // 道具商品（开运藏物）
  const products = [
    {
      id: 'P001',
      tag: '命格定制',
      name: '八字同款·命盘朱砂印章',
      desc: '按你的命盘朱砂手写，随身保运',
      price: 299,
      priceOld: 599,
      badge: '本命定制',
      color: '#B8334A',
      iconSvg: '<svg viewBox="0 0 64 64" width="64" height="64"><rect x="8" y="8" width="48" height="48" rx="4" fill="#B8334A" stroke="#8A1F30" stroke-width="2"/><text x="32" y="40" text-anchor="middle" font-family="STSong,serif" font-size="26" fill="#FCF4E3" font-weight="bold">财</text></svg>',
    },
    {
      id: 'P002',
      tag: `补 ${favorWX} 行`,
      name: `${m.stone.split(' · ')[0]}·开光手串`,
      desc: `针对你命格所缺 ${favorWX} 行·九宫八卦加持`,
      price: 198,
      priceOld: 398,
      badge: '热销',
      color: m.color,
      iconSvg: `<svg viewBox="0 0 64 64" width="64" height="64"><circle cx="32" cy="32" r="22" fill="none" stroke="${m.color}" stroke-width="2" stroke-dasharray="3 2"/><circle cx="32" cy="14" r="5" fill="${m.color}"/><circle cx="50" cy="32" r="5" fill="${m.color}"/><circle cx="32" cy="50" r="5" fill="${m.color}"/><circle cx="14" cy="32" r="5" fill="${m.color}"/><circle cx="44" cy="20" r="4" fill="${m.color}" opacity="0.7"/><circle cx="44" cy="44" r="4" fill="${m.color}" opacity="0.7"/><circle cx="20" cy="44" r="4" fill="${m.color}" opacity="0.7"/><circle cx="20" cy="20" r="4" fill="${m.color}" opacity="0.7"/></svg>`,
    },
    {
      id: 'P003',
      tag: '工位风水',
      name: '招财貔貅·黄铜摆件',
      desc: '头朝门，头不对人，文财神位',
      price: 388,
      priceOld: 688,
      badge: '股民首选',
      color: '#D4A853',
      iconSvg: '<svg viewBox="0 0 64 64" width="64" height="64"><path d="M16 40 Q32 18 48 40 L44 52 Q32 56 20 52 Z" fill="#C89A5B" stroke="#8A6233" stroke-width="1.5"/><circle cx="26" cy="36" r="2" fill="#1A0F05"/><circle cx="38" cy="36" r="2" fill="#1A0F05"/><path d="M24 26 L28 18 M40 26 L36 18" stroke="#8A6233" stroke-width="2" stroke-linecap="round"/></svg>',
    },
    {
      id: 'P004',
      tag: '节气限定',
      name: '立夏·南方火局开运符',
      desc: '节气能量加持·贴手机背/钱包夹',
      price: 99,
      priceOld: 199,
      badge: '限时',
      color: '#B8334A',
      iconSvg: '<svg viewBox="0 0 64 64" width="64" height="64"><rect x="14" y="8" width="36" height="48" rx="2" fill="#F5E6CC" stroke="#B8334A" stroke-width="2"/><path d="M22 18 L42 18 M22 26 L42 26 M22 34 L34 34 M22 42 L38 42" stroke="#B8334A" stroke-width="1.8" stroke-linecap="round" opacity="0.8"/><circle cx="32" cy="52" r="4" fill="#B8334A"/></svg>',
    },
  ];

  const productsHtml = products.map(p => `
    <div class="gear-card" data-color="${p.color}" style="--gc:${p.color};">
      <div class="gear-badge">${p.badge}</div>
      <div class="gear-icon-wrap">${p.iconSvg}</div>
      <div class="gear-tag">${p.tag}</div>
      <div class="gear-name">${p.name}</div>
      <div class="gear-desc">${p.desc}</div>
      <div class="gear-price-row">
        <span class="gear-price-old">¥${p.priceOld}</span>
        <span class="gear-price-new">¥${p.price}</span>
      </div>
      <button class="gear-buy" onclick="App.buyGear('${p.id}', '${p.name}', ${p.price})">请  回  家</button>
    </div>
  `).join('');

  return `
<button class="back-btn" onclick="location.hash='#/result'">‹</button>
<div class="dust-bg"></div>
<div class="page-wrap">
  <div class="brand-bar">
    <span class="brand-bar-text">GEAR UP · 调 整 财 运</span>
  </div>

  <div class="page-title">改 运 之 法</div>
  <div class="page-sub">命由天定 · 运由己调</div>
  <div class="gold-divider"><div class="gold-divider-rhombus"></div></div>

  <!-- 根本诊断 -->
  <div class="gearup-diagnosis" style="--wx:${m.color};">
    <div class="gd-row">
      <span class="gd-label">命格诊断</span>
      <span class="gd-value">${sp.pattern}</span>
    </div>
    <div class="gd-row">
      <span class="gd-label">日主五行</span>
      <span class="gd-value" style="color:${methodMap[dayWX].color}">${dayWX}（阴阳 ${r.dayYinYang}）</span>
    </div>
    <div class="gd-row">
      <span class="gd-label">喜用五行</span>
      <span class="gd-value" style="color:${m.color}">${favorWX}</span>
    </div>
    <div class="gd-row">
      <span class="gd-label">调运方向</span>
      <span class="gd-value">${m.dir}位 · 补 ${favorWX}</span>
    </div>
  </div>

  <!-- 四法改运 -->
  <div class="card-title" style="text-align:center;margin-top:18px;margin-bottom:12px;">· 四 法 调 运 ·</div>
  <div class="method-grid">
    <div class="method-card">
      <div class="method-no">一</div>
      <div class="method-name">穿 着</div>
      <div class="method-desc">多穿 <b style="color:${m.color}">${favorWX}</b> 性色系</div>
    </div>
    <div class="method-card">
      <div class="method-no">二</div>
      <div class="method-name">方 位</div>
      <div class="method-desc">座位朝 <b style="color:${m.color}">${m.dir}</b></div>
    </div>
    <div class="method-card">
      <div class="method-no">三</div>
      <div class="method-name">数 字</div>
      <div class="method-desc">幸运数 <b style="color:${m.color}">${m.number}</b></div>
    </div>
    <div class="method-card">
      <div class="method-no">四</div>
      <div class="method-name">随 身</div>
      <div class="method-desc">带 <b style="color:${m.color}">${m.stone.split(' · ')[0]}</b></div>
    </div>
  </div>

  <div class="daily-tip">
    <div class="daily-tip-icon">☯</div>
    <div class="daily-tip-text">${m.daily}</div>
  </div>

  <!-- 开运藏物 -->
  <div class="gold-divider" style="margin-top:24px;"><div class="gold-divider-rhombus"></div></div>
  <div class="page-title" style="font-size:22px;margin-top:12px;">开 运 藏 物</div>
  <div class="page-sub">按你的命格精选 · 文化藏品 · 仪式加持</div>

  <div class="gear-grid">
    ${productsHtml}
  </div>

  <div class="compliance-block">
    <div class="compliance-title">◇ 合 规 声 明 ◇</div>
    <div class="compliance-text">
      藏品为文化产品 · 非宗教法器 · 不承诺必发必验<br>
      效用基于传统五行文化 · 仪式感加持 · 仅供参考
    </div>
  </div>

  <div class="footer-hint">· 所有商品支持 7 天无理由退换 ·</div>
</div>
  `;
};

// ========= 今日抽签（FREE · 签筒互动）=========
Pages.today = () => {
  if (!requireBazi('#/today')) return '';
  const r = state.userBazi;
  const s = getFortuneStick(r);
  const lvMap = {
    'DA_JI':      { cls: 'great',  label: '大 吉' },
    'SHANG_JI':   { cls: 'great',  label: '上 吉' },
    'ZHONG_JI':   { cls: 'good',   label: '中 吉' },
    'ZHONG_PING': { cls: 'mid',    label: '中 平' },
    'XIA_PING':   { cls: 'bad',    label: '下 平' },
    'XIA_XIONG':  { cls: 'bad',    label: '下 凶' },
  };
  const lv = lvMap[s.grade] || lvMap['ZHONG_PING'];
  const [poemLine1, poemLine2] = s.poem.split('\n');

  return `
<button class="back-btn" onclick="location.hash='#/result'">‹</button>
<div class="dust-bg"></div>
<div class="page-wrap">
  <div class="brand-bar">
    <span class="brand-bar-text">FREE · 今 日 抽 签</span>
  </div>

  <!-- 抽签前 / 抽签后 切换 -->
  <div id="stickStage">
    <!-- 抽签前：签筒 + 摇一摇 -->
    <div id="stickStageBefore" class="stick-stage">
      <div class="stick-today-date">${s.date} · 日柱 <span class="gold">${s.todayGZ}</span></div>
      <div class="gold-divider"><div class="gold-divider-rhombus"></div></div>

      <div class="stick-tube-wrap" id="stickTube">
        <div class="stick-tube">
          <div class="stick-tube-body">
            <div class="stick-tube-seal">签</div>
          </div>
          <div class="stick-tube-lip"></div>
          <div class="stick-bundle">
            <div class="stick-piece s1"></div>
            <div class="stick-piece s2"></div>
            <div class="stick-piece s3"></div>
            <div class="stick-piece s4"></div>
            <div class="stick-piece s5 poke"></div>
          </div>
        </div>
      </div>

      <div class="stick-tip">轻 摇 签 筒 · 诚 心 求 签</div>
      <button class="btn-gold btn-gold-mini" id="btnDrawStick" style="margin: 0 auto;">摇 签</button>
      <div class="stick-foot-hint">每日一签 · 以八字为本 · 免费开放</div>
    </div>

    <!-- 抽签后：签文 -->
    <div id="stickStageAfter" class="stick-stage" style="display:none;">
      <div class="stick-paper">
        <div class="stick-paper-top">
          <div class="stick-no">${s.stickNo}</div>
          <div class="stick-name level-${lv.cls}">${s.stickName}</div>
          <div class="stick-date">${s.date}</div>
        </div>
        <div class="stick-paper-poem">
          <div class="poem-line">${poemLine1 || ''}</div>
          <div class="poem-line">${poemLine2 || ''}</div>
        </div>

        <!-- 签语整合到签诗下方 -->
        <div class="stick-paper-verse">
          <div class="verse-label">签 解</div>
          <div class="verse-text">${s.oneLine}</div>
        </div>

        <!-- 板块推荐嵌入签纸 -->
        <div class="stick-paper-sectors">
          <div class="sector-block-title">◆ 今 日 板 块 指 引</div>
          <div class="sector-block-sub">${s.sectorAdvice}</div>
          <div class="sector-row">
            <span class="sector-row-label pick">宜</span>
            <div class="sector-row-body">
              ${s.sectorPick.map(x => `<span class="paper-chip pick">${x}</span>`).join('')}
            </div>
          </div>
          <div class="sector-row">
            <span class="sector-row-label avoid">忌</span>
            <div class="sector-row-body">
              ${s.sectorAvoid.map(x => `<span class="paper-chip avoid">${x}</span>`).join('')}
            </div>
          </div>
        </div>

        <div class="stick-paper-meta">
          <div class="meta-item"><div class="meta-label">日  柱</div><div class="meta-value gold">${s.todayGZ}</div></div>
          <div class="meta-divider"></div>
          <div class="meta-item"><div class="meta-label">十  神</div><div class="meta-value">${s.todayShishen}</div></div>
          <div class="meta-divider"></div>
          <div class="meta-item"><div class="meta-label">评  分</div><div class="meta-value gold">${s.score}</div></div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">· 今 日 宜 忌 ·</div>
        <div class="yi-ji">
          <div class="yi-block">
            <div class="yi-head">宜</div>
            <div>${s.yiList.map(v => `<div class="yi-item yi">· ${v}</div>`).join('')}</div>
          </div>
          <div class="yi-divider"></div>
          <div class="yi-block">
            <div class="yi-head ji">忌</div>
            <div>${s.jiList.map(v => `<div class="yi-item ji">· ${v}</div>`).join('')}</div>
          </div>
        </div>
      </div>

      ${s.chongFlag ? `
        <div class="card card-warning">
          <div class="warning-icon">⚠</div>
          <div>
            <div class="warning-title">地 支 相 冲</div>
            <div class="warning-desc">今日日支冲你本命日支 · 凡事退半步</div>
          </div>
        </div>
      ` : ''}

      <div class="seal-row">
        <div class="seal">财<br>运<br>局</div>
        <div class="seal-text">
          <div class="line main">◆ 财 运 局 签 筒</div>
          <div class="line">Sig.No ${s.reportNo}</div>
        </div>
      </div>

      <div class="upgrade-block">
        <div class="upgrade-item hot" onclick="App.goPaid('deepreport')">
          <div class="upgrade-tag">深 度</div>
          <div class="upgrade-body">
            <div class="upgrade-name">深度财运报告</div>
            <div class="upgrade-desc">60 年财运时间轴 + 完整命格解析</div>
          </div>
          <div class="upgrade-price"><span class="price-new">¥ 29.9</span></div>
        </div>
      </div>

      <div class="footer-hint">· 每日零点重置 · 以八字为基准 ·</div>
    </div>
  </div>
</div>
  `;
};

Pages.today.mount = () => {
  const btn = document.getElementById('btnDrawStick');
  const tube = document.getElementById('stickTube');
  const before = document.getElementById('stickStageBefore');
  const after = document.getElementById('stickStageAfter');
  if (!btn || !tube) return;

  btn.addEventListener('click', () => {
    tube.classList.add('shaking');
    btn.disabled = true;
    btn.textContent = '摇 签 中...';
    setTimeout(() => {
      tube.classList.remove('shaking');
      tube.classList.add('poking');
    }, 1200);
    setTimeout(() => {
      before.style.display = 'none';
      after.style.display = 'block';
      lockScroll(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 1700);
  });
};

// ========= L2 速查 =========
Pages.quickcheck = () => {
  if (!requireBazi('#/quickcheck')) return '';
  if (!state.orders.quickcheck) { return renderLocked('quickcheck'); }

  const r = state.userBazi;
  const q = getQuickCheck(r);
  const reportNo = 'CYJ-' + (Date.now() % 1000000).toString(36).toUpperCase();

  return `
<button class="back-btn" onclick="location.hash='#/result'">‹</button>
<div class="dust-bg"></div>
<div class="page-wrap">
  <div class="brand-bar">
    <span class="brand-bar-text">L2 · ¥9.9 · 财 格 速 查</span>
  </div>

  <div class="page-title">你 的 财 富 命 格</div>
  <div class="page-sub">12 种财富原型之一 · 基于你的八字判定</div>

  <div class="gold-divider"><div class="gold-divider-rhombus"></div></div>

  <div class="pattern-hero">
    <div class="pattern-name">${q.pattern}</div>
    <div class="pattern-code">${q.patternCode}</div>
    <div class="pattern-gauge">
      <div class="gauge-row">
        <span class="gauge-label">财气指数</span>
        <div class="gauge-track"><div class="gauge-fill" style="width:${q.caiScore}%"></div></div>
        <span class="gauge-value">${q.caiScore}</span>
      </div>
      <div class="gauge-row">
        <span class="gauge-label">日主旺衰</span>
        <span class="gauge-text">${q.dayStrength}</span>
      </div>
    </div>
    <div class="pattern-divider"></div>
    <div class="pattern-desc">${q.description}</div>
  </div>

  <div class="card card-highlight">
    <div class="card-title">· 核 心 策 略 ·</div>
    <div style="color:var(--moon);font-size:13px;line-height:1.85;letter-spacing:1px;text-align:center;padding:4px 6px;">${q.strategy}</div>
  </div>

  <div class="advices-block">
    <div class="advices-title"><span class="advices-title-text">· 5 条 财 运 建 议 ·</span></div>
    ${q.advices.map(v => `<div class="advice-item"><div class="advice-text">${v}</div></div>`).join('')}
  </div>

  <div class="seal-row">
    <div class="seal">财<br>运<br>局</div>
    <div class="seal-text">
      <div class="line main">◆ 财 运 局 命 理 研 究 所</div>
      <div class="line">Report No. ${reportNo}</div>
    </div>
  </div>

  <div class="card card-upsell" onclick="App.goPaid('deepreport')">
    <div class="upsell-tag">想 看 更 完 整 的？</div>
    <div class="upsell-name">深度财运报告</div>
    <div class="upsell-desc">30 页 PDF · 60 年财运时间轴 · 破财点详解 · 贵人月标记</div>
    <div class="upsell-price">¥ 29.9</div>
    <div class="upsell-btn">► 立 即 解 锁</div>
  </div>

  <div class="footer-hint">· 娱乐参考 · 不构成投资建议 ·</div>
</div>
  `;
};

// ========= L3 深度 =========
Pages.deepreport = () => {
  if (!requireBazi('#/deepreport')) return '';
  if (!state.orders.deepreport) { return renderLocked('deepreport'); }

  const r = state.userBazi;
  const report = getDeepReport(r);
  const d = new Date();
  const dateStr = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
  const reportNo = 'CYJ-DEEP-' + Date.now().toString(36).toUpperCase().slice(-8);

  const pillars = [
    { label: '年柱', gan: r.bazi.year[0], zhi: r.bazi.year[1], tag: r.ganShishen.year },
    { label: '月柱', gan: r.bazi.month[0], zhi: r.bazi.month[1], tag: r.ganShishen.month },
    { label: '日柱', gan: r.bazi.day[0], zhi: r.bazi.day[1], tag: '日主' },
    { label: '时柱', gan: r.bazi.hour[0], zhi: r.bazi.hour[1], tag: r.ganShishen.hour },
  ];

  return `
<button class="back-btn" onclick="location.hash='#/result'">‹</button>
<div class="dust-bg"></div>
<div class="page-wrap">
  <div class="brand-bar">
    <span class="brand-bar-text">L3 · ¥29.9 · 深 度 财 运 报 告</span>
  </div>

  <div class="report-cover">
    <div class="report-cover-top">
      <span>CAIYUNJU</span>
      <span>CONFIDENTIAL</span>
    </div>
    <div class="report-title-en">THE WEALTH DECODER</div>
    <div class="report-title-cn">个 人 财 运 深 度 报 告</div>
    <div class="gold-divider"><div class="gold-divider-rhombus"></div></div>
    <div class="report-no">Report · No. ${reportNo}</div>
    <div class="report-date">${dateStr}</div>
    <div class="report-owner">持 有 人 · ${r.input.gender === 'M' ? '乾造' : '坤造'} · ${r.input.year}.${r.input.month}.${r.input.day}</div>
  </div>

  <!-- 目录 -->
  <div class="report-toc">
    <div class="toc-head">
      <span class="toc-line"></span>
      <span class="toc-title">目  录</span>
      <span class="toc-line"></span>
    </div>
    <div class="toc-list">
      <div class="toc-item" data-target="ch1">
        <span class="toc-no">壹</span>
        <span class="toc-name">命 格 综 述</span>
        <span class="toc-dots"></span>
        <span class="toc-page">P.01</span>
      </div>
      <div class="toc-item" data-target="ch2">
        <span class="toc-no">贰</span>
        <span class="toc-name">60 年 财 运 时 间 轴</span>
        <span class="toc-dots"></span>
        <span class="toc-page">P.02</span>
      </div>
      <div class="toc-item" data-target="ch3">
        <span class="toc-no">叁</span>
        <span class="toc-name">破 财 警 示 点</span>
        <span class="toc-dots"></span>
        <span class="toc-page">P.03</span>
      </div>
      <div class="toc-item" data-target="ch4">
        <span class="toc-no">肆</span>
        <span class="toc-name">年 度 贵 人 月</span>
        <span class="toc-dots"></span>
        <span class="toc-page">P.04</span>
      </div>
      <div class="toc-item" data-target="ch5">
        <span class="toc-no">伍</span>
        <span class="toc-name">核 心 行 动 建 议</span>
        <span class="toc-dots"></span>
        <span class="toc-page">P.05</span>
      </div>
    </div>
    <div class="toc-foot">— 共 五 章 · 约 30 页 —</div>
  </div>

  <div class="chapter" id="ch1">
    <div class="chapter-head"><div class="chapter-no">壹</div><div class="chapter-title">命 格 综 述</div></div>
    <div class="bazi-board">
      ${pillars.map((p, i) => `
        <div class="bazi-pillar ${i===2?'highlight':''}">
          <div class="bazi-pillar-label">${p.label}</div>
          <div class="bazi-char">${p.gan}</div>
          <div class="bazi-char">${p.zhi}</div>
          <div class="bazi-tag">${p.tag}</div>
        </div>
      `).join('')}
    </div>
    ${report.longAnalysis.map(p => `
      <div class="para">
        <div class="para-title">${p.title}</div>
        <div class="para-text">${p.text}</div>
      </div>
    `).join('')}
  </div>

  <div class="chapter" id="ch2">
    <div class="chapter-head"><div class="chapter-no">贰</div><div class="chapter-title">60 年 财 运 时 间 轴</div></div>
    <div class="timeline">
      ${report.timeline.map(t => `
        <div class="timeline-item">
          <div class="timeline-age">${t.ageRange}</div>
          <div class="timeline-year">${t.yearRange}</div>
          <div class="timeline-track"><div class="timeline-fill" style="width:${t.score}%"></div></div>
          <div class="timeline-meta">
            <span class="timeline-score">${t.score}</span>
            <span class="timeline-label">${t.label}</span>
          </div>
        </div>
      `).join('')}
    </div>
  </div>

  <div class="chapter" id="ch3">
    <div class="chapter-head"><div class="chapter-no">叁</div><div class="chapter-title">破 财 警 示 点</div></div>
    ${report.breakPoints.map(bp => `
      <div class="breakpoint">
        <div class="bp-icon">⚠</div>
        <div class="bp-body">
          <div class="bp-type">${bp.type}</div>
          <div class="bp-advice">${bp.advice}</div>
        </div>
      </div>
    `).join('')}
  </div>

  <div class="chapter" id="ch4">
    <div class="chapter-head"><div class="chapter-no">肆</div><div class="chapter-title">年 度 贵 人 月</div></div>
    <div class="chapter-hint">以下月份容易遇贵人、出机会、获财运</div>
    <div class="guiren-row">
      ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => `
        <div class="guiren-item ${report.guirenMonth.includes(m) ? 'active' : ''}">
          <div class="guiren-num">${m}</div>
          <div class="guiren-label">月</div>
        </div>
      `).join('')}
    </div>
  </div>

  <div class="chapter" id="ch5">
    <div class="chapter-head"><div class="chapter-no">伍</div><div class="chapter-title">核 心 行 动 建 议</div></div>
    ${report.advices.map(v => `<div class="advice-item"><div class="advice-text">${v}</div></div>`).join('')}
  </div>

  <div class="report-sign">
    <div class="seal">财<br>运<br>局</div>
    <div class="sign-text">
      <div class="sign-head">◇ 财 运 局 命 理 研 究 所 ◇</div>
      <div class="sign-sub">基于《子平真诠》《滴天髓》《穷通宝鉴》三家流派</div>
      <div class="sign-disc">本报告为传统文化娱乐参考</div>
      <div class="sign-disc">不构成任何投资建议</div>
    </div>
  </div>
</div>
  `;
};

Pages.deepreport.mount = () => {
  document.querySelectorAll('.toc-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.target;
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
};

// ========= 支付页 =========
const PRODUCT_MAP = {
  today: {
    name: '今日财运速解', price: '0.99',
    desc: '日干支化解 · 今日宜忌 · 一句点评',
    benefits: [
      '基于你的八字日主 · 每日自动刷新',
      '10 种十神关系 + 地支冲克判定',
      '具体"今日宜"与"今日忌"行动清单',
      '一句话点评 · 可直接截图分享'
    ]
  },
  quickcheck: {
    name: '财格速查', price: '9.9',
    desc: '12 种命格判定 · 5 条建议',
    benefits: [
      '你的财富命格（12 种之一）',
      '财气指数评分 + 日主旺衰',
      '核心财运策略（职业 / 投资 / 人脉）',
      '5 条量身定制的财运建议',
      '支持分享海报（可晒小红书）'
    ]
  },
  deepreport: {
    name: '深度财运报告', price: '29.9',
    desc: '30 页深度报告 · 60 年时间轴',
    benefits: [
      '完整五段式命理综述',
      '60 年财运时间轴（黄金期 / 蛰伏期）',
      '个性化破财警示点',
      '年度贵人月标记',
      '专属报告编号 · 可保存永久查阅',
      '支持一键分享 · PDF 导出（开发中）'
    ]
  }
};

Pages.payment = () => {
  const product = query('product');
  const info = PRODUCT_MAP[product];
  if (!info) return '<div class="page-wrap">产品不存在</div>';

  return `
<button class="back-btn" onclick="history.back()">‹</button>
<div class="dust-bg"></div>
<div class="page-wrap">
  <div class="brand-bar">
    <span class="brand-bar-text">PAYMENT · 确 认 订 单</span>
  </div>

  <div class="page-title">确 认 订 单</div>
  <div class="page-sub">一次解锁 · 终身可查</div>

  <div class="gold-divider"><div class="gold-divider-rhombus"></div></div>

  <div class="order-card">
    <div class="order-seal-wait" id="orderSeal">
      <div class="osw-ring">
        <span class="osw-char osw-c1">待</span>
        <span class="osw-char osw-c2">启</span>
        <span class="osw-char osw-c3">印</span>
        <span class="osw-dot osw-d1"></span>
        <span class="osw-dot osw-d2"></span>
        <span class="osw-dot osw-d3"></span>
        <span class="osw-dot osw-d4"></span>
      </div>
    </div>
    <div class="order-product">
      <div class="order-name">${info.name}</div>
      <div class="order-desc">${info.desc}</div>
    </div>
    <div class="order-price">
      <span class="order-price-symbol">¥</span>
      <span class="order-price-num">${info.price}</span>
    </div>
  </div>

  <div class="trust-row">
    <div class="trust-seal">
      <span class="ts-char">诚</span>
      <span class="ts-char">信</span>
      <span class="ts-char">经</span>
      <span class="ts-char">营</span>
    </div>
    <div class="trust-text">
      <div class="trust-line">财 运 局 命 理 研 究 所 · 监 制</div>
      <div class="trust-sub">已 服 务 12,684 位 命 主</div>
    </div>
  </div>

  <div class="benefits">
    <div class="benefits-title">· 本 次 解 锁 包 含 ·</div>
    ${info.benefits.map(v => `
      <div class="benefit-item">
        <span class="benefit-check">✓</span>
        <span class="benefit-text">${v}</span>
      </div>
    `).join('')}
  </div>

  <div class="compliance">
    <div class="compliance-title">◇ 购 买 前 须 知</div>
    <div class="compliance-item">· 本产品为传统文化娱乐内容</div>
    <div class="compliance-item">· 不构成投资、法律、医疗等专业建议</div>
    <div class="compliance-item">· 虚拟商品一经购买不退不换</div>
    <div class="compliance-item">· 已阅读并同意《用户协议》《隐私政策》</div>
  </div>

  <button class="btn-gold" id="btnPay">◆ 微 信 支 付  ¥${info.price}  ◆</button>
  <div class="pay-test-hint">ⓘ Demo 模式 · 点击按钮模拟支付成功（不会真正扣款）</div>
</div>
  `;
};

Pages.payment.mount = () => {
  const product = query('product');
  document.getElementById('btnPay').onclick = () => {
    const btn = document.getElementById('btnPay');
    const seal = document.getElementById('orderSeal');
    btn.disabled = true;
    btn.textContent = '支付中...';
    if (seal) seal.classList.add('stamping');
    setTimeout(() => {
      state.orders[product] = true;
      saveOrders();
      go('#/pay-success?product=' + product);
    }, 1200);
  };
};

// ========= 支付成功 =========
Pages['pay-success'] = () => {
  const product = query('product');
  const info = PRODUCT_MAP[product];
  if (!info) return '<div class="page-wrap">订单异常</div>';

  const orderNo = 'CYJ-' + Date.now().toString(36).toUpperCase();
  const target = product === 'today' ? '#/today' : product === 'quickcheck' ? '#/quickcheck' : '#/deepreport';

  return `
<div class="dust-bg"></div>
<div class="page-wrap success-wrap">
  <div class="success-icon-wrap">
    <div class="success-circle"><div class="success-check">✓</div></div>
  </div>
  <div class="success-title">支 付 成 功</div>
  <div class="success-sub">感 谢 你 的 信 任</div>

  <div class="gold-divider"><div class="gold-divider-rhombus"></div></div>

  <div class="success-order">
    <div class="row"><span class="label">产品</span><span class="value">${info.name}</span></div>
    <div class="row"><span class="label">金额</span><span class="value gold">¥ ${info.price}</span></div>
    <div class="row"><span class="label">订单号</span><span class="value mono">${orderNo}</span></div>
  </div>

  <div style="display:flex;justify-content:center;margin:16px 0;">
    <div class="seal seal-lg">财<br>运<br>局</div>
  </div>

  <div class="success-actions">
    <button class="btn-gold" onclick="location.hash='${target}'">► 查 看 我 的 报 告</button>
    <button class="btn-outline" onclick="location.hash='#/index'">返 回 首 页</button>
  </div>

  <div style="margin-top:24px;color:var(--moon-dim);font-size:10px;letter-spacing:1px;font-style:italic;opacity:0.7;text-align:center;">
    —— 你的每一份信任，是我们持续做好产品的动力 ——
  </div>
</div>
  `;
};

// ========= 未付费锁屏（复用支付页触发）=========
function renderLocked(product) {
  const info = PRODUCT_MAP[product];
  return `
<button class="back-btn" onclick="location.hash='#/result'">‹</button>
<div class="dust-bg"></div>
<div class="page-wrap" style="padding-top:60px;text-align:center;">
  <div style="font-size:60px;color:var(--gold);margin-bottom:20px;">🔒</div>
  <div class="page-title">该 报 告 尚 未 解 锁</div>
  <div class="page-sub">完成支付后可无限次查看</div>
  <div class="gold-divider"><div class="gold-divider-rhombus"></div></div>
  <div class="order-card" style="text-align:left;">
    <div class="order-product">
      <div class="order-name">${info.name}</div>
      <div class="order-desc">${info.desc}</div>
    </div>
    <div class="order-price">
      <span class="order-price-symbol">¥</span>
      <span class="order-price-num">${info.price}</span>
    </div>
  </div>
  <button class="btn-gold" onclick="location.hash='#/payment?product=${product}'">
    ◆ 立 即 解 锁  ¥${info.price}  ◆
  </button>
</div>
  `;
}

// ============ 路由 ============
function parseRoute() {
  const hash = location.hash || '#/index';
  const path = hash.split('?')[0].replace(/^#\//, '') || 'index';
  return path;
}

function render() {
  const route = parseRoute();
  const fn = Pages[route];
  const app = document.getElementById('app');
  if (!fn) {
    app.innerHTML = `<div class="page-wrap" style="text-align:center;padding-top:100px;">404 · 路径不存在<br><br><button class="btn-outline" onclick="location.hash='#/sign'">返回首页</button></div>`;
  } else {
    const html = fn();
    if (html) {
      app.innerHTML = html;
      if (fn.mount) fn.mount();
    }
  }
  app.scrollTop = 0;
  updateDevStatus();
  updateTabbar();
  // 签筒页锁定滚动，其他页恢复
  const appEl = document.getElementById('app');
  if (appEl) appEl.style.overflowY = (route === 'sign' || route === 'index') ? 'hidden' : '';
}

// 全局 tab 高亮 + 是否显示
function updateTabbar() {
  const route = parseRoute();
  const tabbar = document.getElementById('globalTabbar');
  if (!tabbar) return;

  // 仅在主功能页显示
  const TAB_ROUTES = { sign: 0, index: 0, library: 1, me: 2, sector: -1 };
  const showOn = ['sign', 'index', 'library', 'me'];
  if (showOn.indexOf(route) >= 0) {
    tabbar.classList.add('show');
  } else {
    tabbar.classList.remove('show');
  }

  const active = TAB_ROUTES[route];
  tabbar.querySelectorAll('.g-tab').forEach((el, i) => {
    el.classList.toggle('active', i === active);
  });
}

window.addEventListener('hashchange', render);

// ============ 公共 API ============
window.App = {
  goPaid(product) {
    if (state.orders[product]) {
      go('#/' + product);
    } else {
      if (!requireBazi('#/' + product)) return;
      go('#/payment?product=' + product);
    }
  },
  toggleFold(id) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('open');
  },
  buyGear(id, name, price) {
    toast(`${name} · ¥${price}（演示版 · 待接入支付）`, 2600);
  },
  goBazi() {
    if (state.userBazi) go('#/result');
    else go('#/input');
  },
  clearLocal() {
    if (!confirm) {
      localStorage.clear();
      state.userBazi = null;
      state.orders = {};
      toast('已清空本地数据', 1800);
      setTimeout(() => location.reload(), 800);
      return;
    }
    localStorage.clear();
    state.userBazi = null;
    state.orders = {};
    toast('已清空本地数据 · 即将刷新', 1500);
    setTimeout(() => location.reload(), 1200);
  },
  buyMastersReport() {
    const sign = window.MarketSign.getMarketSign();
    const freeMasters = window.MarketSign.buildMasters(sign);
    var premiumMasters = [];
    try { premiumMasters = window.MarketSign.buildPremiumMasters(sign); } catch(e) {}

    // 读取已购买状态
    function getPurchasedIds() {
      try { return JSON.parse(localStorage.getItem('caiyunju:premiumMasters') || '[]'); } catch(e) { return []; }
    }
    function savePurchased(ids) {
      localStorage.setItem('caiyunju:premiumMasters', JSON.stringify(ids));
    }
    const purchasedIds = getPurchasedIds();
    const isMasterBought = (id) => purchasedIds.indexOf(id) >= 0;

    const existing = document.getElementById('mrcModal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'mrcModal';
    modal.className = 'shop-modal';

    const renderShop = () => {
      const boughtCount = purchasedIds.length;
      const totalMasters = premiumMasters.length;
      const allBought = boughtCount >= totalMasters;

      modal.innerHTML = `
        <div class="shop-mask" id="shopMask"></div>
        <div class="shop-card">
          <!-- 顶栏 -->
          <div class="shop-top">
            <div class="shop-title">大 师 团</div>
            <div class="shop-sub">${boughtCount} / ${premiumMasters.length} 已解锁</div>
            <div class="shop-close" id="shopClose">×</div>
          </div>

          <!-- 付费大师列表（一行一位） -->
          <div class="shop-list">
            ${premiumMasters.map(m => {
              const bought = isMasterBought(m.id);
              return `
              <div class="shop-row ${bought ? 'shop-row-bought' : ''}" data-master-id="${m.id}" data-price="${m.priceSingle}">
                <div class="shop-row-left">
                  <span class="shop-row-avatar" style="background:${bought ? m.color : '#2a2a45'}">${bought ? m.initial : '🔒'}</span>
                  <div class="shop-row-info">
                    <div class="shop-row-name">${m.name}</div>
                    <div class="shop-row-feature">${m.feature}</div>
                  </div>
                </div>
                <div class="shop-row-right">
                  ${bought
                    ? `<span class="shop-row-verdict verdict-${m.verdictCls}">${m.verdict}</span><span class="shop-row-check">✓</span>`
                    : `<button class="shop-buy-btn" data-buy="${m.id}">¥${m.priceSingle}<small>/位</small></button>`
                  }
                </div>
              </div>`;
            }).join('')}
          </div>

          <!-- 底部套餐 -->
          ${!allBought ? `
          <div class="shop-bundle">
            <div class="shop-bundle-left">
              <div class="shop-bundle-title">全 部 解 锁</div>
              <div class="shop-bundle-desc">${premiumMasters.length} 位大师 · 每日自动推送完整观点</div>
            </div>
            <div class="shop-bundle-right">
              <button class="shop-bundle-btn" data-bundle="single">¥${Math.round((premiumMasters.length - boughtCount) * 1.6)}<small>单次</small></button>
              <button class="shop-bundle-btn hot" data-bundle="month">¥29<small>/月</small></button>
            </div>
          </div>` : '<div class="shop-all-done">★ 全部解锁完成 ★</div>'}

          <div class="shop-foot">娱乐参考 · 不构成投资建议 · Demo模式不会真实扣款</div>
        </div>
      `;
    };

    document.body.appendChild(modal);

    // 渲染
    renderShop();

    // 绑定事件
    function bindShopEvents() {
      // 关闭
      document.getElementById('shopMask').onclick = () => modal.remove();
      document.getElementById('shopClose').onclick = () => modal.remove();

      // 单个购买
      modal.querySelectorAll('.shop-buy-btn').forEach(btn => {
        btn.onclick = () => {
          const mid = btn.dataset.buy;
          if (!isMasterBought(mid)) {
            const newIds = purchasedIds.concat([mid]);
            savePurchased(newIds);
            toast(`解锁成功 · ¥${btn.closest('.shop-item').dataset.price}（演示）`, 1800);
            setTimeout(() => { renderShop(); bindShopEvents(); try{patchSignAfter(sign,'paid');}catch(e){} }, 600);
          }
        };
      });

      // 套餐购买
      modal.querySelectorAll('.shop-bundle-btn').forEach(btn => {
        btn.onclick = () => {
          const type = btn.dataset.bundle;
          const allIds = premiumMasters.map(m => m.id).filter(id => !isMasterBought(id));
          savePurchased(purchasedIds.concat(allIds));
          toast(type === 'month' ? '月度订阅成功（演示）· 全部大师已解锁' : '单次解锁成功（演示）· 全部大师已解锁', 2000);
          setTimeout(() => { renderShop(); bindShopEvents(); try{patchSignAfter(sign,'paid');}catch(e){} }, 800);
        };
      });
    }

    bindShopEvents();
  }
};

// ============ 调试工具 ============
function initDevTools() {
  // 路由跳转
  document.querySelectorAll('.dev-btn[data-route]').forEach(btn => {
    btn.onclick = () => go(btn.dataset.route);
  });

  // 样本
  document.querySelectorAll('.dev-btn[data-sample]').forEach(btn => {
    btn.onclick = () => {
      const s = SAMPLES[btn.dataset.sample];
      state.userBazi = paipan(s);
      saveBazi();
      toast(`已加载：${s.label} · ${state.userBazi.bazi.year} ${state.userBazi.bazi.month} ${state.userBazi.bazi.day} ${state.userBazi.bazi.hour}`);
      go('#/result');
    };
  });

  // 切换签等级
  document.querySelectorAll('.dev-btn[data-sign]').forEach(btn => {
    btn.onclick = () => {
      const idx = parseInt(btn.dataset.sign, 10);
      window.MarketSign.setForceIdx(idx);
      toast(`已切换签：idx=${idx}`);
      go('#/index');
    };
  });

  // 订单控制
  document.getElementById('devUnlockAll').onclick = () => {
    state.orders = { today: true, quickcheck: true, deepreport: true };
    saveOrders();
    toast('全部解锁');
    render();
  };
  document.getElementById('devLockAll').onclick = () => {
    state.orders = {};
    saveOrders();
    toast('全部上锁');
    render();
  };
  document.getElementById('devClearAll').onclick = () => {
    localStorage.clear();
    state.userBazi = null;
    state.orders = {};
    toast('已清空所有数据');
    go('#/index');
  };
}

function updateDevStatus() {
  const el = document.getElementById('devStatus');
  if (!el) return;
  const r = state.userBazi;
  const lines = [
    `路由: ${location.hash || '#/index'}`,
    `八字: ${r ? `${r.bazi.year} ${r.bazi.month} ${r.bazi.day} ${r.bazi.hour}` : '— 未排盘'}`,
    `日主: ${r ? `${r.dayGan} (${r.dayWuxing}${r.dayYinYang}) ${r.dayStrength}` : '—'}`,
    `财格: ${r ? r.wealthPattern.pattern : '—'}`,
    `已购: [${Object.keys(state.orders).filter(k => state.orders[k]).join(', ') || '空'}]`
  ];
  el.textContent = lines.join('\n');
}

// 状态栏时间
function updateClock() {
  const t = new Date();
  const el = document.getElementById('statusTime');
  if (el) el.textContent = `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`;
}

// 启动
window.addEventListener('DOMContentLoaded', () => {
  initDevTools();
  initGlobalTabbar();
  updateClock();
  setInterval(updateClock, 30000);
  render();
});

function initGlobalTabbar() {
  const tabbar = document.getElementById('globalTabbar');
  if (!tabbar) return;
  tabbar.addEventListener('click', (e) => {
    const tab = e.target.closest('.g-tab');
    if (!tab) return;
    const route = tab.dataset.route;
    if (route) location.hash = route;
  });
}

})();
