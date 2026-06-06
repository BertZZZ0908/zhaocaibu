// pages/library/library.js · v2.2 · 财运簿（L3 全保护）
// 数据来源：纯本地 storage 读取 + 安全默认值兜底

var marketSign = require('../../utils/marketSign');
var payment = require('../../utils/payment');
var storage = require('../../utils/storage');

/** 日期友好格式化：2026.05.31 → "今 日" / "昨 日" / "5/9" */
function formatDateLabel(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '';

  var parts = dateStr.split('.');
  if (parts.length !== 3) return dateStr;

  var y = parseInt(parts[0], 10);
  var m = parseInt(parts[1], 10) - 1;
  var d = parseInt(parts[2], 10);
  var itemDate = new Date(y, m, d);

  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var yesterday = new Date(today.getTime() - 86400000);

  if (itemDate.getTime() === today.getTime()) return '今 日';
  if (itemDate.getTime() === yesterday.getTime()) return '昨 日';

  return (m + 1) + '/' + d;
}

Page({
  data: {
    // 已购状态
    purchased: false,
    sectorUsed: false,
    sectorUsedText: '未使用',
    mastersStatusText: '未开通',
    // 今日签（用于显示）
    todayStick: '',
    todayGrade: '',
    todayGradeCls: '',
    todayAction: '',
    // 历史列表
    historyList: [],
    // 空状态
    isEmpty: false,
  },

  onShow: function() {
    try {
      this._loadData();
    } catch (err) {
      console.error('[library][L3] onShow 异常:', err.message || err);
    }
  },

  _loadData: function() {
    var self = this;

    // L3-1: 所有外部调用都有 fallback
    var purchased, sectorStatus, sign, history;

    try { purchased = payment.hasMastersReport(); } catch (e) { purchased = false; }
    try { sectorStatus = payment.getSectorStatus(); } catch (e) { sectorStatus = { used: false }; }

    try {
      sign = marketSign.getMarketSign();
    } catch (signErr) {
      console.error('[library][L3] getMarketSign 异常:', signErr.message);
      sign = {
        stickNo: '第一签', gradeLabel: '中 吉', gradeCls: 'zhongji', action: '高抛低吸·快进快出',
      };
    }

    try {
      history = storage.getSignHistory(5);
      if (!Array.isArray(history)) history = [];
    } catch (histErr) {
      console.error('[library][L3] getSignHistory 异常:', histErr.message);
      history = [];
    }

    // 如果历史为空，用今日签填充首条
    if (history.length === 0) {
      history.push({
        date: '今 日',
        rawDate: sign.date || '',
        stickNo: sign.stickNo || '第一签',
        gradeLabel: sign.gradeLabel || '中 吉',
        gradeCls: sign.gradeCls || 'zhongji',
        action: sign.action || '',
      });
    } else {
      // 日期友好格式化
      history = history.map(function(item) {
        return Object.assign({}, item, {
          rawDate: item.date,
          date: formatDateLabel(item.date),
        });
      });
    }

    console.log('[library] 数据加载完成', '历史:', history.length + '条', '已购:', purchased);

    // L3-2: setData 保护
    try {
      self.setData({
        purchased: !!purchased,
        sectorUsed: !!(sectorStatus && sectorStatus.used),
        sectorUsedText: (sectorStatus && sectorStatus.used) ? '已使用' : '未使用',
        mastersStatusText: purchased ? '永久' : '未开通',
        todayStick: sign.stickNo || '',
        todayGrade: sign.gradeLabel || '',
        todayGradeCls: sign.gradeCls || '',
        todayAction: sign.action || '',
        historyList: history,
        isEmpty: history.length === 0,
      });
    } catch (setDataErr) {
      console.error('[library][L3] setData 异常:', setDataErr.message);
    }
  },

  /** 点击已购卡片 → 去求签页 */
  onTapReportCard: function() {
    wx.switchTab({ url: '/pages/sign/sign' });
  },

  /** 点击空状态 → 去求签 */
  onTapEmpty: function() {
    wx.switchTab({ url: '/pages/sign/sign' });
  },

  /** 点击历史项 */
  onTapHistoryItem: function(e) {
    wx.switchTab({ url: '/pages/sign/sign' });
  },

  onShareAppMessage: function() {
    return { title: '招财簿 — 记录你的每一次财运', path: '/pages/library/library' };
  },
});
