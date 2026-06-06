// utils/payment.js · v2.0 · 支付状态管理（纯本地存储）

var STORAGE_KEYS = {
  MASTERS_REPORT: 'caiyunju:mastersReport',
  SECTOR_USED: 'caiyunju:sectorUsed',
  ORDERS: 'caiyunju:orders',
};

/**
 * 检查是否为 PRO 用户
 * @returns {boolean}
 */
function isProUser() {
  try {
    var orders = JSON.parse(wx.getStorageSync(STORAGE_KEYS.ORDERS) || '{}');
    return orders.mastersReport === true || wx.getStorageSync(STORAGE_KEYS.MASTERS_REPORT) === '1';
  } catch (e) {
    return false;
  }
}

/**
 * 检查是否已购买大师团报告
 */
function hasMastersReport() {
  try {
    return wx.getStorageSync(STORAGE_KEYS.MASTERS_REPORT) === '1';
  } catch (e) { return false; }
}

/**
 * 标记大师团报告已购买
 */
function markMastersReportPurchased() {
  try {
    wx.setStorageSync(STORAGE_KEYS.MASTERS_REPORT, '1');
    var orders = JSON.parse(wx.getStorageSync(STORAGE_KEYS.ORDERS) || '{}');
    orders.mastersReport = true;
    wx.setStorageSync(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
  } catch (e) {}
}

/**
 * 获取板块详批使用状态
 */
function getSectorStatus() {
  try {
    return {
      used: parseInt(wx.getStorageSync(STORAGE_KEYS.SECTOR_USED) || '0', 10) > 0,
      count: parseInt(wx.getStorageSync(STORAGE_KEYS.SECTOR_USED) || '0', 10),
    };
  } catch (e) { return { used: false, count: 0 }; }
}

/** 获取所有订单状态 */
function getAllOrders() {
  try {
    return JSON.parse(wx.getStorageSync(STORAGE_KEYS.ORDERS) || '{}');
  } catch (e) { return {}; }
}

module.exports = {
  isProUser: isProUser,
  hasMastersReport: hasMastersReport,
  markMastersReportPurchased: markMastersReportPurchased,
  getSectorStatus: getSectorStatus,
  getAllOrders: getAllOrders,
  STORAGE_KEYS: STORAGE_KEYS,
};
