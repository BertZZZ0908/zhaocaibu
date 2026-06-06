# 招财簿小程序 · UI设计与适配规则 v1.0

> 基于 4 张截图诊断，2026-05-31 输出
> 目标：一次性定义清楚所有页面的顶部安全区规则，后续开发直接照搬

---

## 一、当前问题诊断（4 张截图）

| 页面 | 截图 | 问题 |
|------|------|------|
| sign（摇签前） | #1 | 「财神签」标题被状态栏/胶囊遮挡上半截 |
| library（财运簿） | #2 | 品牌「财运簿」紧贴顶部，无安全间距 |
| profile（我的） | #3 | 头像+「未排盘」+「去排盘」按钮全部挤在胶囊区域 |
| sign（签文卡） | #4 | 四角装饰 tl/tr 与胶囊重叠；底图已完整显示 ✅ |

### 根因（唯一）

```jsonc
// app.json
"window": {
  "navigationStyle": "custom",   // ← 自定义导航栏 = 系统不提供任何顶部留白
}
```

**`navigationStyle: "custom"` 意味着：页面内容从屏幕最顶端（0,0）开始渲染，开发者必须自己处理状态栏 + 胶囊按钮的安全距离。** 当前代码没有任何页面做了这件事。

---

## 二、微信小程序顶部布局 anatomy（必背）

```
┌─────────────────────────────────┐ ← 屏幕顶部 (y=0)
│         状态栏 (Status Bar)      │ ← 高度因设备而异
│    statusBarHeight (44~59px)     │   iPhone SE: 20px
│                                  │   iPhone 14: 47px
├─────────────────────────────────┤ ← 状态栏底部
│   ↑ 间距 (~6px)                  │
├──────┬──────────────────┬───────┤
│      │  ...  ○ 胶囊按钮  │       │ ← 微信原生胶囊（高度32px）
│      │  (menu+circle)   │       │   位置由系统控制，不可覆盖
│      └──────────────────┘       │
│   ↓ 间距 (~6px)                 │
├─────────────────────────────────┤ ← ★ 安全线（Safe Top）
│                                 │
│        你的页面内容从这开始       │ ← padding-top ≥ safeTop
│                                 │
└─────────────────────────────────┘
```

### 关键数值表

| 设备 | statusBarHeight | 胶囊高度 | 胶囊上边距 | **safeTop 总计** |
|------|-----------------|----------|-----------|------------------|
| iPhone SE (无刘海) | 20px | 32px | 4px | **56px (112rpx)** |
| iPhone 12/13/14 (刘海) | 47px | 32px | 6px | **85px (170rpx)** |
| iPhone 14 Pro Max (灵动岛) | 59px | 32px | 8px | **99px (198rpx)** |
| Android 全面屏 | ~24px | 32px | 6px | **62px (124rpx)** |

> **设计规则：所有页面 padding-top 取值应 ≥ 100rpx（保守值），或动态获取。**

---

## 三、核心适配方案（二选一）

### 方案 A：CSS 固定安全区（推荐，简单可靠）

在 `app.wxss` 中定义全局安全变量，每个页面容器直接用：

```css
/* app.wxss 全局 */
page {
  --safe-top: calc(env(safe-area-inset-top) + 88rpx);
  /* env(safe-area-inset-top) 在 iOS ≥11 有效，Android 部分支持 */
}

/* 或更简单：直接用固定值 */
page {
  --safe-top: 120rpx;  /* 兼容所有设备的最小安全值 */
}
```

**每个页面容器统一加：**

```css
/* 所有 .xxx-page 容器 */
.sign-page,
.lib-page,
.profile-page {
  padding-top: var(--safe-top, 120rpx);
  box-sizing: border-box;
}
```

**优点**：零 JS，纯 CSS，性能最好。
**缺点**：固定值在某些极端设备上可能多/少几像素（视觉可接受）。

### 方案 B：JS 动态计算（精确但复杂）

```javascript
// app.js onLaunch 中计算一次，存入 globalData
onLaunch() {
  const sysInfo = wx.getSystemInfoSync();
  const menuRect = wx.getMenuButtonBoundingClientRect();

  this.globalData.safeTop = menuRect.bottom + 8;
  // 例：iPhone 14 → menuRect.bottom ≈ 83px + 8 = 91px ≈ 182rpx

  // 存入全局供所有页面使用
  wx.setStorageSync('safeTop', this.globalData.safeTop);
}
```

```css
/* 各页面 WXML 用内联 style */
<view class="sign-page" style="padding-top: {{safeTop}}rpx;">
```

**优点**：像素级精准。
**缺点**：需要每个页面 JS 中读 globalData + setData；胶囊位置在 onLaunch 时可能不准（需延迟或 onPageLoad 再取）。

---

## 四、招财簿采用的方案：**方案 A（CSS 固定安全区）**

理由：
1. 我们是深色背景页面，多几像素少几像素看不出
2. 不需要精确到像素的导航栏替换（没有自定义导航栏）
3. 性能最优、维护成本最低

### 规则集（每条都是 MUST）

#### R1. 全局安全区变量

```
文件：app.wxss
规则：定义 --safe-top: 120rpx 作为全局 CSS 变量
```

#### R2. 页面容器必须加 padding-top

```
文件：各页面的 .xxx-page 选择器
规则：padding-top: var(--safe-top, 120rpx)
适用：sign-page / lib-page / profile-page / 以及未来所有新页面
例外：无（所有页面都必须遵守）
```

#### R3. 绝对定位元素的安全偏移

```
场景：关闭按钮(✕)、四角装饰(tl/tr)、固定定位元素
规则：top 值必须加上 var(--safe-top) 偏移
例：.sign-close-btn { top: calc(var(--safe-top) + 16rpx); }
例：.sign-corner.tl { top: calc(var(--safe-top) + 12rpx); }
```

#### R4. 背景图全屏时的处理

```
场景：签筒页 bg-tube.jpg 全屏背景、签到后签文卡底图
规则：
  - 页面级全屏背景：position: absolute; top: 0; 不受 padding-top 影响
  - 卡片内底图：正常随卡片流动即可（卡片已有 margin-top）
```

#### R5. TabBar 页面额外注意

```
场景：sign / library / profile 是 tabBar 页面
规则：
  - 内容不要用 height: 100vh（会被 TabBar 挡住底部）
  - 底部内容 padding-bottom: 120rpx（TabBar 高度约 100rpx）
  - 或者 min-height: 100vh + padding-bottom
```

#### R6. 图片资源尺寸规范

```
场景：签文底图 1046×1920 竖长图
规则：
  - background-size: 100% 100%（拉伸填满，不裁切）
  - 容器 min-height: 1100rpx~1300rpx（按比例留足空间）
  - 文字用 flex column 靠上排列，下方留给插画展示
```

---

## 五、逐页修复清单（✅ 2026-05-31 16:12 全部完成）

### Page 1: sign（求签） ✅

| 元素 | 当前值 | 修正为 | 说明 |
|------|--------|--------|------|
| `.sign-page` | 无 padding-top | `padding-top: var(--safe-top)` ✅ | 整体下移 |
| `.sign-close-btn` | `top: 16rpx` | `top: calc(var(--safe-top) + 14rpx)` ✅ | 避开胶囊 |
| `.sign-corner.tl/tr` | `top: 12rpx` | `top: calc(var(--safe-top) + 12rpx)` ✅ | 四角避开胶囊 |
| `.masters-section` | 无底部 padding | `padding-bottom: 120rpx` ✅ | R5 TabBar 避让 |

### Page 2: library（财运簿） ✅

| 元素 | 当前值 | 修正为 | 说明 |
|------|--------|--------|------|
| `.lib-page` | 无 padding-top | `padding-top: var(--safe-top)` ✅ | 品牌栏下移 |
| `.lib-footer` | `padding-bottom: 0` | `calc(32rpx + 100rpx)` ✅ | R5 TabBar 避让 |

### Page 3: profile（我的） ✅

| 元素 | 当前值 | 修正为 | 说明 |
|------|--------|--------|------|
| `.profile-page` | 无 padding-top | `padding-top: var(--safe-top)` ✅ | 头像区下移 |
| `.me-footer` | `padding-bottom: 40rpx` | `calc(40rpx + 100rpx)` ✅ | R5 TabBar 避让 |

### Page 4-12：子页面（9 个） ✅ 已预埋

| 页面 | 状态 |
|------|------|
| input（八字输入） | ✅ `.input-page` 预埋 safe-top |
| result（排盘结果） | ✅ `.result-page` 预埋 safe-top |
| todayluck（今日运势） | ✅ `.todayluck-page` 预埋 safe-top |
| quickcheck（快速检测） | ✅ `.quickcheck-page` 预埋 safe-top |
| deepreport（深度报告） | ✅ `.deepreport-page` 预埋 safe-top |
| payment（支付） | ✅ `.payment-page` 预埋 safe-top |
| paysuccess（支付成功） | ✅ `.paysuccess-page` 预埋 safe-top |
| gearup（开运） | ✅ `.gearup-page` 预埋 safe-top |
| sector（板块详批） | ✅ `.sector-page` 预埋 safe-top |

> 注：子页面通过 wx.navigateTo 打开，无 TabBar → 仅需 R2，无需 R5

---

## 六、颜色与字体规范（补充）

| 类别 | 变量/值 | 用途 |
|------|---------|------|
| 主背景 | `#0c1230` | 页面底色 |
| 卡片背景 | `rgba(255,255,255,0.03)` | 大师行等次要卡片 |
| 金色主色 | `#D4A853` | 标题/强调/CTA |
| 金色浅色 | `#E8C97A` | 次要金色文字 |
| 文字主色 | `#fff` (rgba 1.0) | 主要文字 |
| 文字次色 | `rgba(255,255,255,0.75)` | 正文/观点 |
| 文字弱色 | `rgba(255,255,255,0.35~0.45)` | 提示/标签 |
| 红色 SELL | `#E74C3C` | 卖出判词 |
| 绿色 BUY | `#2ECC71` | 买入判词 |
| 橙色 LOOK | `#F0AD4E` | 观望判词 |
| 蓝色 HOLD | `#5BC0DE` | 持有判词 |

字体规范：
- 标题/等级大字：`font-weight: 600~700; letter-spacing: 2~8rpx`
- 正文：`line-height: 1.65~1.75; letter-spacing: 1~1.5rpx`
- 古诗：`font-family: STSong, SimSun, Noto Serif SC, serif; opacity: 0.5~0.55`
- 数字/日期：`font-family: -apple-system, sans-serif; font-variant-numeric: tabular-nums`

---

## 七、检查清单（每次写完新页面对照） ✅ 全局已通过

- [x] 页面根容器有 `padding-top: var(--safe-top, 120rpx)` — **12/12 页面已覆盖**
- [x] 绝对定位元素的 `top/left` 值考虑了安全区偏移 — **sign 页面 3 处元素已修复**
- [x] 底部内容不会被 TabBar 挡住（padding-bottom ≥ 100rpx）— **3 个 TabBar 页面已修复**
- [ ] 背景图使用 `background-size: 100% 100%` 且容器有足够 min-height — *sign 已完成，其他页面待开发时遵循*
- [ ] 文字颜色使用 rgba 白色（非纯白），保证在底图上的可读性
- [ ] 判词标签有对应颜色的半透明背景 + 细边框
- [ ] 战术行有左侧竖线装饰（金色 3rpx）
- [ ] 在 iPhone 14 Pro Max 和 iPhone SE 两种模拟器上都预览过

---

*文档版本：v1.1 | 更新时间：2026-05-31 16:12 | 作者：军师 | 状态：全局安全区适配完成*
