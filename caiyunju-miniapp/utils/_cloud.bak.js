// utils/cloud.js · v2.1 · 云函数统一封装（L3 环境安全网）
// 核心原则：
//   1. 环境不可用 → 立即 reject，不等待不报红错
//   2. 所有调用有超时保护（默认 3s）
//   3. 失败只 console.info，不阻塞页面渲染

// L3: 云函数部署状态开关（云函数部署后改为 true）
// 这是唯一一个需要随部署状态变更的配置项
var CLOUD_ENABLED = false; // TODO: marketAnalyst 部署后改为 true

/**
 * 调用云函数（带超时保护和环境感知）
 * @param {string} name - 云函数名
 * @param {Object} data - 传参
 * @param {number} [timeout=3000] - 超时毫秒数
 * @returns {Promise<Object>} 云函数返回值
 */
function callFunction(name, data, timeout) {
  var ms = timeout || 3000;

  return new Promise(function(resolve, reject) {
    // L3-1: 全局开关 — 未部署的云函数直接跳过
    if (!CLOUD_ENABLED) {
      console.log('[cloud] CLOUD_DISABLED:', name, '→ 跳过（全局开关关闭）');
      reject(new Error('CLOUD_DISABLED: 云功能未启用 (' + name + ')'));
      return;
    }

    // L3-2: 环境检测 — 非小程序或无云能力
    if (typeof wx === 'undefined') {
      console.log('[cloud] ENV_NO_WX:', name);
      reject(new Error('ENV_NO_WX: 非小程序环境'));
      return;
    }
    if (!wx.cloud || !wx.cloud.callFunction) {
      console.log('[cloud] ENV_NO_CLOUD:', name);
      reject(new Error('ENV_NO_CLOUD: 云能力未初始化'));
      return;
    }

    // L3-3: Promise.race — 正常请求 vs 超时计时器
    var cloudPromise = wx.cloud.callFunction({ name: name, data: data || {} });
    var timeoutPromise = new Promise(function(_, rej) {
      setTimeout(function() {
        rej(new Error('CLOUD_TIMEOUT: "' + name + '" 响应超过 ' + (ms / 1000) + 's'));
      }, ms);
    });

    Promise.race([cloudPromise, timeoutPromise])
      .then(function(res) {
        if (res && res.result) {
          resolve(res.result);
        } else {
          reject(new Error('CLOUD_INVALID_RESPONSE: ' + name + ' 返回数据为空'));
        }
      })
      .catch(function(err) {
        // L3-4: 只记录 info 级别日志，不冒泡到控制台错误
        var msg = err && err.message ? err.message : String(err);
        console.info('[cloud] callFunction("' + name + '") 失败:', msg);
        reject(err);
      });
  });
}

/**
 * 安全地尝试调用云函数（永不 throw）
 * @param {string} name - 云函数名
 * @param {Object} data - 传参
 * @returns {Promise<Object|null>} 成功返回数据，失败返回 null
 */
function safeCall(name, data) {
  return callFunction(name, data).then(function(result) {
    return result;
  }).catch(function(err) {
    // 静默失败，调用方用 null 判断是否需要降级
    return null;
  });
}

/**
 * 检查用户是否已登录（有 openid）
 * @returns {boolean}
 */
function isLoggedIn() {
  try {
    var userInfo = wx.getStorageSync('userInfo');
    return !!(userInfo && userInfo.openid);
  } catch (e) {
    return false;
  }
}

/** 获取当前用户信息（安全版，永远不抛异常） */
function getUserInfo() {
  try {
    return wx.getStorageSync('userInfo') || {};
  } catch (e) {
    return {};
  }
}

module.exports = {
  callFunction: callFunction,
  safeCall: safeCall,
  isLoggedIn: isLoggedIn,
  getUserInfo: getUserInfo,
  // 暴露开关供页面层读取
  _CLOUD_ENABLED: CLOUD_ENABLED,
};
