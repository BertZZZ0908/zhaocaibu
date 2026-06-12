// utils/api-config.js · 招财簿 · API 配置中心
// 统一管理后端服务器地址和认证信息
//
// 【安全红线】：
//   1. API Key 绝不硬编码在客户端代码中 —— 通过云函数环境变量或服务端签发 Token
//   2. 生产环境必须使用 HTTPS + 域名，不可直连 IP
//   3. 域名必须在微信小程序后台「开发设置 → request 合法域名」中配置
//
// 生产环境部署清单：
//   1. certbot 为 zhaocaibu.cn 申请 HTTPS 证书
//   2. Nginx 反向代理 gunicorn:5818
//   3. 微信后台添加 request 域名: https://zhaocaibu.cn
//   4. 服务端签发 client_token（替代 API Key 直传）

var API_CONFIG = {
  // 服务器地址：生产用 HTTPS 域名；本地开发可临时改为 http://localhost:5818
  baseURL: 'https://zhaocaibu.cn',

  // API Key —— 不在源码中存储！
  // 生产环境：由云函数从环境变量读取，前端通过云函数中转调用
  // Demo 阶段：从 config.local.js 读取（已加入 .gitignore）
  // @deprecated 旧 API Key 已轮换，请勿在客户端代码中硬编码
  apiKey: '',

  // 超时（毫秒）
  timeout: 8000,
};

// Demo 阶段：从本地配置文件读取 API Key（生产用云函数替换）
try {
  var localConfig = require('../../config.local');
  if (localConfig && localConfig.API_KEY) {
    API_CONFIG.apiKey = localConfig.API_KEY;
    console.log('[api-config] API Key 从 config.local.js 加载');
  }
} catch (e) {
  console.log('[api-config] config.local.js 未找到，等待云函数注入');
}

/**
 * 设置 API 客户端 Token（由服务端签发，替代原始 API Key）
 * Token 应有较短有效期（如 24h），过期后需重新登录获取
 */
function setClientToken(token) {
  API_CONFIG.apiKey = token || '';
  try {
    if (token) {
      wx.setStorageSync('caiyunju:client_token', token);
    } else {
      wx.removeStorageSync('caiyunju:client_token');
    }
  } catch (e) {
    console.warn('[api-config] 保存 Token 失败:', e);
  }
}

/**
 * 从本地存储恢复客户端 Token（用于会话保持）
 */
function restoreClientToken() {
  try {
    var token = wx.getStorageSync('caiyunju:client_token');
    if (token) {
      API_CONFIG.apiKey = token;
      console.log('[api-config] 客户端 Token 已恢复');
    }
  } catch (e) {
    // 静默
  }
}

/**
 * @deprecated 使用 setClientToken() 替代
 * API Key 不应在客户端设置，保留此函数仅为向后兼容
 */
function setApiKey(key) {
  console.warn('[api-config] setApiKey 已弃用，请使用 setClientToken');
  setClientToken(key);
}

/**
 * @deprecated 使用 restoreClientToken() 替代
 */
function restoreApiKey() {
  console.warn('[api-config] restoreApiKey 已弃用，请使用 restoreClientToken');
  restoreClientToken();
}

/**
 * 构建请求头（自动附加认证 Token）
 */
function getHeaders() {
  var headers = {
    'Content-Type': 'application/json',
  };
  if (API_CONFIG.apiKey) {
    headers['Authorization'] = 'Bearer ' + API_CONFIG.apiKey;
  }
  return headers;
}

/**
 * 通用 GET 请求（带超时 + 统一错误处理）
 */
function apiGet(path, options) {
  var opts = options || {};
  return new Promise(function(resolve, reject) {
    wx.request({
      url: API_CONFIG.baseURL + path,
      method: 'GET',
      header: getHeaders(),
      timeout: opts.timeout || API_CONFIG.timeout,
      success: function(res) {
        if (res.statusCode === 200) {
          resolve(res.data);
        } else if (res.statusCode === 429) {
          console.warn('[api] 限流: ' + path);
          reject(new Error('RATE_LIMITED'));
        } else if (res.statusCode === 401) {
          console.warn('[api] 鉴权失败: ' + path);
          reject(new Error('UNAUTHORIZED'));
        } else {
          console.warn('[api] ' + path + ' 返回 ' + res.statusCode);
          reject(new Error('HTTP_' + res.statusCode));
        }
      },
      fail: function(err) {
        console.warn('[api] 请求失败: ' + path + ' ' + (err.errMsg || err));
        reject(err);
      }
    });
  });
}

module.exports = {
  API_CONFIG: API_CONFIG,
  setClientToken: setClientToken,
  restoreClientToken: restoreClientToken,
  // 向后兼容的旧接口
  setApiKey: setApiKey,
  restoreApiKey: restoreApiKey,
  getHeaders: getHeaders,
  apiGet: apiGet,
};
