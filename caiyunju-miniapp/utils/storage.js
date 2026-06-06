// utils/storage.js · v2.1 · 本地存储封装（L3 全保护）
// 所有存储 key 集中管理，所有读写都有 try-catch + 默认值
//
// L3 防线原则：
//   1. wx.getStorageSync 可能抛异常（存储空间满/权限问题）
//   2. 返回值永远不可能是 undefined（调用方不需要判空）
//   3. 写入失败静默处理，不影响主流程

var KEYS = {
  // 用户数据
  BAZI: 'caiyunju:bazi',
  USER_INFO: 'caiyunju:userInfo',

  // 签运历史
  SIGN_HISTORY: 'caiyunju:signHistory',

  // 支付/订阅
  MASTERS_REPORT: 'caiyunju:mastersReport',
  SECTOR_USED: 'caiyunju:sectorUsed',
  ORDERS: 'caiyunju:orders',
};

/**
 * 安全读取 storage（带默认值，永不抛异常）
 * @param {string} key - 存储 key
 * @param {*} [defaultValue=null] - key 不存在时的返回值
 * @returns {*} 存储的值或 defaultValue
 */
function get(key, defaultValue) {
  try {
    var val = wx.getStorageSync(key);
    if (val === '' || val === null || val === undefined) {
      return (defaultValue !== undefined) ? defaultValue : null;
    }
    return val;
  } catch (e) {
    console.info('[storage] get("' + key + '") 异常:', e.message || e);
    return (defaultValue !== undefined) ? defaultValue : null;
  }
}

/**
 * 安全写入 storage（失败只记录日志）
 */
function set(key, value) {
  try {
    wx.setStorageSync(key, value);
    return true;
  } catch (e) {
    console.warn('[storage] set("' + key + '") 失败:', e.message || e);
    return false;
  }
}

/** 移除某项 */
function remove(key) {
  try { wx.removeStorageSync(key); } catch (e) {}
}

/**
 * 添加签文到历史记录（最多保留 30 条，同日期去重）
 * @param {Object} signEntry - { date, stickNo, gradeLabel, gradeCls, action }
 */
function addSignHistory(signEntry) {
  // L3-1: 参数校验 — 非对象/空对象直接返回
  if (!signEntry || typeof signEntry !== 'object') {
    console.warn('[storage] addSignHistory 参数无效:', typeof signEntry);
    return;
  }

  try {
    var history = get(KEYS.SIGN_HISTORY, []);
    if (!Array.isArray(history)) history = [];

    var newDate = signEntry.date || '';

    // 去重：同一日期不重复添加（防止热重载导致重复）
    var exists = history.some(function(item) { return item.date === newDate; });
    if (!exists) {
      history.push({
        date: newDate,
        stickNo: signEntry.stickNo || '',
        gradeLabel: signEntry.gradeLabel || '',
        gradeCls: signEntry.gradeCls || '',
        action: signEntry.action || '',
      });
    }

    // 只保留最近 30 条
    if (history.length > 30) history = history.slice(-30);

    set(KEYS.SIGN_HISTORY, history);
  } catch (e) {
    console.error('[storage] addSignHistory 异常:', e.message || e);
  }
}

/**
 * 获取历史签记录（最近 N 条，倒序）
 * @param {number} [limit=5]
 * @returns {Array} 永远返回数组（即使 storage 异常也返回 []）
 */
function getSignHistory(limit) {
  try {
    var history = get(KEYS.SIGN_HISTORY, []);

    // L3-2: 类型守卫 — 如果存入的不是数组则重置
    if (!Array.isArray(history)) {
      console.warn('[storage] SIGN_HISTORY 不是数组，重置为[]');
      history = [];
      set(KEYS.SIGN_HISTORY, history);
    }

    var n = parseInt(limit, 10) || 5;
    return history.slice(-n).reverse();
  } catch (e) {
    console.error('[storage] getSignHistory 异常:', e.message || e);
    return [];
  }
}

/**
 * 清空所有招财簿相关数据
 * @returns {{ cleared: number, failed: number }}
 */
function clearAll() {
  var result = { cleared: 0, failed: 0 };
  var allKeys = [
    KEYS.BAZI, KEYS.USER_INFO, KEYS.SIGN_HISTORY,
    KEYS.MASTERS_REPORT, KEYS.SECTOR_USED, KEYS.ORDERS,
  ];
  allKeys.forEach(function(key) {
    try {
      wx.removeStorageSync(key);
      result.cleared++;
    } catch (e) {
      result.failed++;
    }
  });
  console.log('[storage] clearAll 结果:', result);
  return result;
}

module.exports = {
  KEYS: KEYS,
  get: get,
  set: set,
  remove: remove,
  addSignHistory: addSignHistory,
  getSignHistory: getSignHistory,
  clearAll: clearAll,
};
