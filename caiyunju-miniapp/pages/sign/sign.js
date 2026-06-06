// pages/sign/sign.js · v2.1 · 求签页核心逻辑（L3 全保护）
// 数据策略：纯本地优先 → 云端后台增强 → 失败不影响展示
// L3 防线：所有关键路径都有 try-catch + 安全默认值

var app = getApp();
var marketSign = require('../../utils/marketSign');
var payment = require('../../utils/payment');
var storage = require('../../utils/storage');

// L3: 页面级安全默认值（任何异常时的兜底数据）
var FALLBACK_SIGN = {
  date: '2026.05.31',
  stickNo: '第一签',
  gradeCls: 'zhongji',
  gradeLabel: '中 吉',
  gradeColor: '#8A9A7D',
  accentColor: '#A8B89A',
  bgImage: '/assets/bg-zhongji.jpg',
  poemAncient: ['乾坤正气贯长虹', '财星高照运亨通'],
  poemModern: ['顺势而为，乘势而上', '守正出奇，稳中求进'],
  trend: '区间震荡',
  mainLine: '存量博弈加剧',
  risk: '中',
  action: '高抛低吸·快进快出',
  isWeekend: false,
  expand: { sectorPick: [], sectorAvoid: [], darkHorse: '', northFlow: '', mainNetFlow: '' },
};

Page({
  data: {
    // 签文
    sign: null,
    // 大师团（8位，过滤后只显示免费大师）
    masters: [],
    // 是否已摇签展示
    revealed: false,
    // 摇签动画中
    shaking: false,
    // 支付状态
    isPaidUser: false,
    // 购买弹窗
    showShopModal: false,
    // 付费大师列表（6位，用于弹窗展示）
    premiumMasters: [],
    // 已解锁计数
    shopBoughtCount: 0,
  },

  onLoad: function() {
    // L3-1: 整个加载过程 try-catch 保护
    try {
      this._loadLocalData();
    } catch (err) {
      console.error('[sign][L3] onLoad 异常:', err.message || err);
      // 用安全默认值渲染，不让页面白屏
      this.setData({
        sign: FALLBACK_SIGN,
        masters: marketSign.buildMasters(FALLBACK_SIGN),
        isPaidUser: false,
      });
    }
  },

  onShow: function() {
    // L3-2: 支付状态同步也加保护
    try {
      this._syncPayment();
    } catch (e) {
      // 静默，支付状态不是关键路径
    }
  },

  /** 加载本地数据（<10ms）— 内部全链路保护 */
  _loadLocalData: function() {
    var self = this;

    // L3-3: getMarketSign 可能抛异常（L1 契约层会拦截，但这里双重保险）
    var sign;
    try {
      sign = marketSign.getMarketSign();
    } catch (signErr) {
      console.error('[sign][L3] getMarketSign 异常，使用默认值:', signErr.message);
      sign = FALLBACK_SIGN;
    }

    // L3-4: buildMasters 保护
    var masters;
    try {
      masters = marketSign.buildMasters(sign);
      if (!Array.isArray(masters) || masters.length === 0) {
        masters = [];
      }
      // ★ 只显示免费大师（对齐 H5：未解锁的大师不显示）★
      masters = masters.filter(function(m) { return m.isFree; });
    } catch (masterErr) {
      console.error('[sign][L3] buildMasters 异常:', masterErr.message);
      masters = [];
    }

    console.log('[sign] 本地数据加载完成', '签号:', sign.stickNo, '等级:', sign.gradeLabel, '大师:', masters.length + '位');

    // L3-5: setData 也可能异常（WXML 模板问题）
    try {
      var isPaid = payment.isProUser();
      var premium = marketSign.buildPremiumMasters(sign);
      // 根据支付状态标记已购买
      if (isPaid) {
        premium = premium.map(function(m) { return Object.assign({}, m, { isBought: true }); });
      }

      self.setData({
        sign: sign,
        masters: masters,
        isPaidUser: isPaid,
        // 加载付费大师列表（用于购买弹窗）
        premiumMasters: premium,
        shopBoughtCount: isPaid ? premium.length : 0,
      });
    } catch (setDataErr) {
      console.error('[sign][L3] setData 异常:', setDataErr.message);
    }

    // 本地数据已完整，暂不调用云端增强（云函数未部署时避免 timeout 红错）
    // this._tryCloudEnhance();  // TODO: 云函数部署后取消注释启用

    // L3-6: 历史记录写入保护
    try {
      storage.addSignHistory({
        date: sign.date,
        stickNo: sign.stickNo,
        gradeLabel: sign.gradeLabel,
        gradeCls: sign.gradeCls,
        action: sign.action,
      });
    } catch (historyErr) {
      // 历史记录写入失败不阻塞主流程
      console.log('[sign] 历史记录写入跳过');
    }
  },

  /** 云端大师增强（已暂停）
   * 触发条件：部署 cloudfunctions/ 到微信云开发环境后，可调用 market-analyst Agent
   * 当前有 fetchRemoteSign() 在 marketSign.js 中替代，优先用该方案 */
  // _tryCloudEnhance: function() {
  //   var self = this;
  //   var cloud = require('../../utils/cloud');
  //   cloud.callFunction('marketAnalyst', { action: 'getMasterOpinions' }, 3000)
  //     .then(function(data) { /* ... */ })
  //     .catch(function(err) { console.log('[sign] 云端增强跳过:', err.message || err); });
  // },

  /** 同步支付状态 */
  _syncPayment: function() {
    try {
      var paid = payment.isProUser();
      if (paid === this.data.isPaidUser) return;

      var updatedMasters = this.data.masters;
      var updatedPremium = this.data.premiumMasters;

      if (paid && updatedMasters.length > 0) {
        updatedMasters = updatedMasters.map(function(m) { return Object.assign({}, m, { isFree: true }); });
      }
      if (paid && updatedPremium.length > 0) {
        updatedPremium = updatedPremium.map(function(m) { return Object.assign({}, m, { isBought: true }); });
      }

      this.setData({
        masters: updatedMasters,
        premiumMasters: updatedPremium,
        isPaidUser: paid,
        shopBoughtCount: paid ? updatedPremium.length : 0,
      });
    } catch (e) {
      // 静默
    }
  },

  /** 摇签动作 */
  onShake: function() {
    if (this.data.shaking) return;
    // L3-7: 移除 !this.data.sign 守卫（#003修复），改为安全检查
    if (!this.data.sign && !FALLBACK_SIGN) return;

    var self = this;

    try {
      // 触发摇签动画
      this.setData({ shaking: true });

      // 动画持续 1.2s 后展示签文
      setTimeout(function() {
        try {
          self.setData({
            revealed: true,
            shaking: false,
          });
          // 震动反馈（也可能失败，如用户禁用振动）
          wx.vibrateShort({ type: 'medium' });
        } catch (timerErr) {
          console.error('[sign][L3] shake timer 异常:', timerErr.message);
        }
      }, 1200);
    } catch (shakeErr) {
      console.error('[sign][L3] onShake 异常:', shakeErr.message);
      this.setData({ shaking: false });
    }
  },

  /** 返回签筒（重新摇签） */
  onReshake: function() {
    this.setData({ revealed: false, shaking: false });
  },

  /** 解锁付费大师 */
  onUnlockMaster: function(e) {
    var idx = e.currentTarget.dataset.idx;
    var master = this.data.masters[idx];
    if (!master) return;
    if (master.isFree) return; // 已解锁的不处理

    // 未解锁的打开购买弹窗
    this.setData({ showShopModal: true });
  },

  /** 打开大师团购买弹窗 */
  onUnlockAllMasters: function() {
    this.setData({ showShopModal: true });
  },

  /** 关闭购买弹窗 */
  onCloseShopModal: function() {
    this.setData({ showShopModal: false });
  },

  /** 弹窗内购买单个大师（支付页待实现，先弹提示） */
  onShopBuyMaster: function(e) {
    var mid = e.currentTarget.dataset.mid;
    console.log('[sign] 购买大师:', mid);
    // P0-3 修复：payment 页未实现，避免跳转到空白页，改为提示
    wx.showModal({
      title: '功能开发中',
      content: '大师团付费功能即将上线，敬请期待 ',
      showCancel: false,
      confirmText: '知道了',
    });
    this.setData({ showShopModal: false });
  },

  /** 弹窗内购买套餐（支付页待实现，先弹提示） */
  onShopBuyBundle: function(e) {
    var type = e.currentTarget.dataset.type;
    console.log('[sign] 购买套餐:', type);
    // P0-3 修复：payment 页未实现，避免跳转到空白页，改为提示
    wx.showModal({
      title: '功能开发中',
      content: '套餐购买功能即将上线，敬请期待 ',
      showCancel: false,
      confirmText: '知道了',
    });
    this.setData({ showShopModal: false });
  },

  /** 分享给好友 */
  onShareAppMessage: function() {
    var s = this.data.sign || FALLBACK_SIGN;
    return {
      title: '财运局 · 今日' + (s.gradeLabel || '') + '「' + (s.stickNo || '') + '」',
      path: '/pages/sign/sign',
      imageUrl: '/assets/bg-tube.jpg',
    };
  },

  /** 分享到朋友圈 */
  onShareTimeline: function() {
    var s = this.data.sign || FALLBACK_SIGN;
    return {
      title: '招财簿 · ' + (s.action || ''),
      query: '',
      imageUrl: '/assets/bg-tube.jpg',
    };
  },
});
