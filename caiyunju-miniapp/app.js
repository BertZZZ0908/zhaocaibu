// app.js · 招财簿 v2.1 全局配置
// 设计原则：纯本地数据优先，云端增强非必需

var apiConfig = require('./utils/api-config');

App({
  globalData: {
    // 用户八字数据（input 页面写入）
    userBazi: null,

    // 签文缓存（sign 页面加载时写入）
    currentSign: null,

    // 大师团缓存
    mastersList: [],

    // 系统信息
    systemInfo: null,

    // API 配置引用
    apiConfig: apiConfig,
  },

  onLaunch() {
    // 获取系统信息（用于适配）
    // ★ 使用新 API（base 2.20.1+），替代已弃用的 getSystemInfoSync
    try {
      var winInfo = wx.getWindowInfo ? wx.getWindowInfo() : null;
      var devInfo = wx.getDeviceInfo ? wx.getDeviceInfo() : null;
      this.globalData.systemInfo = Object.assign({}, winInfo || {}, devInfo || {});
    } catch (e) {
      // 低版本基库回退
      this.globalData.systemInfo = wx.getSystemInfoSync();
    }
    console.log('[app] Launch OK', this.globalData.systemInfo.model, this.globalData.systemInfo.SDKVersion || this.globalData.systemInfo.version);

    // 从 storage 恢复用户数据 + API 配置
    this._restoreUserData();
    apiConfig.restoreApiKey();
  },

  /** 从本地存储恢复用户八字 */
  _restoreUserData() {
    try {
      const baziStr = wx.getStorageSync('caiyunju:bazi');
      if (baziStr) {
        this.globalData.userBazi = JSON.parse(baziStr);
        console.log('[app] 用户八字已恢复');
      }
    } catch (e) {
      console.warn('[app] 恢复用户数据失败:', e);
    }
  },

  /** 保存用户八字到全局 + 本地存储 */
  saveUserBazi(baziData) {
    this.globalData.userBazi = baziData;
    try {
      wx.setStorageSync('caiyunju:bazi', JSON.stringify(baziData));
    } catch (e) {
      console.warn('[app] 保存八字失败:', e);
    }
  },

  /** 清除所有用户数据 */
  clearAllData() {
    this.globalData.userBazi = null;
    this.globalData.currentSign = null;
    this.globalData.mastersList = [];
    try {
      wx.clearStorageSync();
    } catch (e) {}
  },
});
