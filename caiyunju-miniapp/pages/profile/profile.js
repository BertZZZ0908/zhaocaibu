// pages/profile/profile.js · v2.1 · 我的（L3 全保护）
var app = getApp();
var payment = require('../../utils/payment');

Page({
  data: {
    hasBazi: false,
    bazi: null,
    goBaziText: '去排盘',
    greeting: '',
    avatarChar: '·',
    purchased: false,
  },

  onShow: function() {
    try {
      this._loadData();
    } catch (err) {
      console.error('[profile][L3] onShow 异常:', err.message || err);
    }
  },

  onPullDownRefresh: function() {
    try {
      this._loadData();
    } catch (e) {}
    wx.stopPullDownRefresh();
  },

  _loadData: function() {
    var self = this;

    // L3-1: app.globalData 安全读取
    var bazi = null;
    try {
      bazi = (app && app.globalData && app.globalData.userBazi) || null;
    } catch (gbErr) {
      bazi = null;
    }

    // L3-2: 支付状态安全读取
    var purchased = false;
    try { purchased = payment.hasMastersReport(); } catch (e) {}

    // L3-3: 问候语安全构建
    var greeting = '';
    var genderChar = '·';
    try {
      if (bazi && bazi.input) {
        genderChar = (bazi.input.gender === 'M') ? '乾' : '坤';
        var year = bazi.input.year || '';
        greeting = (bazi.input.gender === 'M' ? '乾造' : '坤造') + ' · ' + year;
      }
    } catch (greetingErr) {
      // 使用默认值
    }

    // L3-4: setData 保护
    try {
      self.setData({
        hasBazi: !!bazi,
        bazi: bazi || null,
        greeting: greeting,
        avatarChar: genderChar,
        goBaziText: bazi ? '查看命盘' : '去排盘',
        purchased: !!purchased,
      });
    } catch (setDataErr) {
      console.error('[profile][L3] setData 异常:', setDataErr.message);
    }
  },

  /** 去排盘（input 页未实现，先弹提示） */
  onGoBazi: function() {
    // P0-3 修复：input 八字输入页未实现，避免跳转空白页
    wx.showModal({
      title: '功能开发中',
      content: '八字排盘功能即将上线，敬请期待 ',
      showCancel: false,
      confirmText: '知道了',
    });
  },

  /** 今日运势 */
  onGoToday: function() {
    try {
      wx.switchTab({ url: '/pages/sign/sign' });
    } catch (e) {}
  },

  /** 大师观点 */
  onBuyMasters: function() {
    try {
      wx.switchTab({ url: '/pages/sign/sign' });
    } catch (e) {}
  },

  /** 开运商城（占位） */
  onGoShop: function() {
    wx.showToast({ title: '即将开放', icon: 'none' });
  },

  /** 清空数据 */
  onClearLocal: function() {
    var self = this;

    // L3-5: clearAllData 可能不存在
    if (typeof app.clearAllData !== 'function') {
      wx.showToast({ title: '清空功能暂不可用', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认清空',
      content: '将清除八字/已购/试用记录，是否继续？',
      confirmColor: '#D4A853',
      success: function(res) {
        if (!res.confirm) return;
        try {
          app.clearAllData();
          wx.showToast({ title: '已清空', icon: 'success' });
          setTimeout(function() {
            try { self._loadData(); } catch (e) {}
          }, 800);
        } catch (clearErr) {
          console.error('[profile][L3] clearAllData 异常:', clearErr.message);
          wx.showToast({ title: '清空失败', icon: 'none' });
        }
      },
    });
  },

  onShareAppMessage: function() {
    return { title: '招财簿 — A 股行情驱动的财运工具', path: '/pages/profile/profile' };
  },
});
