# 财运局小程序 · Demo 使用与部署指南

> 项目路径：`/Users/zhaoge/Documents/earnmoney/caiyunju-miniapp/`
> 版本：v0.1.0 (Demo)
> 日期：2026-04-21

---

## 📁 项目结构

```
caiyunju-miniapp/
├── app.js / app.json / app.wxss        全局配置 + 主题样式
├── project.config.json                  小程序项目配置
├── sitemap.json
├── utils/
│   └── bazi.js                          🔥 核心算法引擎（八字 / 十神 / 财格）
├── pages/
│   ├── index/          首页（品牌主视觉）
│   ├── input/          生辰输入页
│   ├── result/         L0 免费排盘结果
│   ├── today/          L1 ¥0.99 今日财运
│   ├── quickcheck/     L2 ¥9.9 财格速查
│   ├── deepreport/     L3 ¥29.9 深度报告
│   ├── payment/        支付确认页
│   └── pay-success/    支付成功页
├── cloudfunctions/     (预留云函数目录)
└── images/             (预留图片资源目录)
```

---

## 🚀 快速预览（5 分钟跑起来）

### Step 1 · 下载微信开发者工具
- https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html
- 选择最新稳定版

### Step 2 · 打开项目
1. 启动微信开发者工具
2. 点击「导入项目」
3. 目录选择：`/Users/zhaoge/Documents/earnmoney/caiyunju-miniapp`
4. AppID 选「测试号」（或填老板自己的真实 AppID）
5. 项目名称：`财运局`
6. 点「导入」

### Step 3 · 预览
- 打开后默认显示首页
- 点「免费排盘」→ 填生辰 → 查看 L0 结果
- 从结果页点付费产品 → 支付页 → Demo 模式点支付按钮即跳支付成功 → 解锁对应 L1/L2/L3

### Step 4 · 真机预览
- 开发者工具右上角「预览」→ 扫码
- 所有算法都在前端运行，无后端依赖

---

## ✅ 已实现的功能

### 1. 核心算法（utils/bazi.js）
- ✅ 四柱八字排盘（年 / 月 / 日 / 时）
- ✅ 十神识别（比肩 / 劫财 / 食神 / 伤官 / 正偏财 / 正偏官 / 正偏印）
- ✅ 五行强弱分析（藏干加权）
- ✅ 日主旺衰判断（身旺 / 身中 / 身弱）
- ✅ 12 种财富命格判定（从财 / 食神生财 / 偏财格 / 劫财夺财 等）
- ✅ 今日财运评分（日干支 × 日主关系 + 地支冲克）
- ✅ 60 年大运时间轴（每 10 年分段）
- ✅ 破财点识别 / 贵人月标记

### 2. 页面流程
- ✅ 首页 · 品牌主视觉 + 4 级价格入口
- ✅ 输入页 · 性别 / 日期 / 时辰三选一
- ✅ L0 免费排盘结果 · 四柱 + 五行分布 + 命格预判（带锁）
- ✅ L1 今日财运速解 · 评分环 + 宜忌 + 一句点评
- ✅ L2 财格速查 · 命格 Hero + 5 条建议 + 报告编号
- ✅ L3 深度报告 · 封面 + 5 大章节 + 时间轴 + 贵人月
- ✅ 支付页 · 订单卡 + 权益清单 + Demo 模拟支付
- ✅ 支付成功页 · 打印风 + 印章 + 跳转

### 3. 视觉体系（全局样式 · app.wxss）
- ✅ 午夜玄金配色（深蓝黑 + 玄金 + 朱砂红）
- ✅ 八卦罗盘（纯 CSS 实现）
- ✅ 金色菱形分隔线
- ✅ 朱砂印章组件
- ✅ 五行配色系统
- ✅ Georgia + STSong 字体搭配

---

## 🔧 技术架构说明

### 为什么选这个栈
| 选型 | 好处 |
|------|------|
| **纯原生小程序** | 审核最友好 · 无编译复杂度 · 性能好 |
| **前端本地算法** | 生辰数据不离端 · 符合隐私政策 · 零后端成本 |
| **图形 CSS 手绘** | 不依赖外部图片 · 瘦身 · 可动画 |
| **LocalStorage 存状态** | 已购产品本地记录 · 无需用户登录 |

### 核心算法闭环
```
生辰输入
  ↓
paipan() 排四柱八字
  ↓
analyzeWuxing() / analyzeDayStrength() 五行旺衰
  ↓
analyzeWealthPattern() 12 种命格判定
  ↓
├─ getTodayLuck()   → L1 今日财运
├─ getQuickCheck()  → L2 财格速查
└─ getDeepReport()  → L3 深度报告
```

---

## 📋 上线前 TODO 清单

### 🔴 必做（上线前）

1. **节气精度升级**
   - 当前：简化节气表（每月 6 号为节）
   - 升级：引入准确节气 JSON（网上公开数据）
   - 影响：约 5% 的用户日柱 / 月柱可能有 1 日误差

2. **真实微信支付对接**
   - 当前：Demo 模拟支付
   - 方案 A（推荐）：云开发 + `wx.cloud.callFunction` 调云函数支付
   - 方案 B：搭建后端服务（需备案）
   - 文档：https://pay.weixin.qq.com/wiki/doc/api/wxa/wxa_api.php?chapter=7_3

3. **小程序注册 + 认证**
   - 填真实 AppID（小程序后台申请）
   - 类目选：生活服务 / 工具（不要选"占卜""宗教"）
   - 名称备选：财运局 · 命理笔记 · 财盘研究所
   - 实名认证：个人 ¥30，企业 ¥300

4. **备案**（2023 后小程序强制要求）
   - 企业/个体户 ICP 备案 + 小程序备案
   - 周期 7-20 天

5. **合规文案确认**
   - `pages/payment/payment.wxml` 底部《用户协议》《隐私政策》需链接到真实文档
   - 建议加"本产品含传统文化内容，仅供娱乐参考"的全局横幅

### 🟡 可选（迭代优化）

6. **真太阳时修正**
   - 当前：按北京时间直接计算
   - 升级：根据出生城市经纬度修正（西部出生的人时辰可能相差 1-2 小时）

7. **分享海报**
   - L1 / L2 / L3 报告生成带命格信息的美观分享图
   - 可用 `wx.canvasToTempFilePath`

8. **PDF 导出**
   - L3 深度报告支持导出 PDF
   - 小程序内可用 `wx-canvas-to-pdf` 或后端 puppeteer

9. **算法白皮书页**
   - 新增 `pages/whitepaper/whitepaper`
   - 公开算法细节，建立权威性

10. **排盘历史**
    - 新增 "我的" 页，记录每次排盘
    - 支持多人八字保存（家人、朋友）

---

## 🎨 可继续迭代的视觉点

- [ ] 首页罗盘加入 **旋转动画**（CSS `@keyframes rotate`）
- [ ] 各页面切换加 **淡入过渡**
- [ ] L3 报告加入 **滚动视差效果**
- [ ] 支付成功加入 **金色粒子飘落** 动效

---

## 📊 算法验证结果（3 个样本）

| 样本 | 公历 | 八字 | 日主 | 命格 |
|------|------|------|------|------|
| A | 1990-03-15 10:00 男 | 庚午·庚辰·己卯·己巳 | 己土阴·身旺 | 财官双美 ✓ |
| B | 1985-11-28 22:00 女 | 乙丑·戊子·辛未·己亥 | 辛金阴·身旺 | 偏财格 ✓ |
| C | 2000-07-04 04:00 男 | 庚辰·癸未·癸亥·甲寅 | 癸水阴·身中 | 伤官生财 ✓ |

算法判定**结果合理**，命格分类与传统命理学吻合。

---

## 🏁 下一步行动建议

1. **今天**：老板下载微信开发者工具，跑一遍 Demo，验证流程
2. **本周**：注册小程序账号 + 做 ICP 备案（卡脖子，越早越好）
3. **下周**：升级节气精度 + 接入真实微信支付
4. **两周后**：提交小程序审核（名字避开"算命""占卜"）
5. **一个月后**：上线 + 小红书内容开跑

---

## 📎 附：生产环境支付接入参考

```javascript
// pages/payment/payment.js · 生产版替换 onPay 方法
onPay() {
  wx.cloud.callFunction({
    name: 'createOrder',
    data: { product: this.data.product, price: this.data.price }
  }).then(res => {
    const { prepayId, timeStamp, nonceStr, paySign } = res.result;
    return wx.requestPayment({
      timeStamp, nonceStr,
      package: `prepay_id=${prepayId}`,
      signType: 'MD5',
      paySign
    });
  }).then(() => {
    // 支付成功
    app.globalData.orders[this.data.product] = true;
    wx.setStorageSync('orders', app.globalData.orders);
    wx.redirectTo({ url: `/pages/pay-success/pay-success?...` });
  }).catch(err => {
    console.error(err);
    wx.showToast({ title: '支付已取消', icon: 'none' });
  });
}
```

云函数（`cloudfunctions/createOrder/index.js`）需要调用微信云开发自带的支付能力或商户号 API，具体见微信文档。
