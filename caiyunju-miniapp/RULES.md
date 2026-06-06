# 招财簿小程序 · 微信平台规则清单 (RULES.md)

> **每次写/改代码前必须扫视此文件**。违反任何一条 = 编译报错 or 运行时崩溃。
>
> 最后更新: 2026-05-31 (基于 v2.0 重写中 10 个 Bug 的根因总结)

---

## WXML 规则（模板层）

| # | 规则 | 正确 ✅ | 错误 ❌ | 触发 Bug |
|---|------|---------|---------|----------|
| W1 | **事件绑定必须用静态方法名** | `bindtap="onTapMaster"` | `bindtap="{{expr}}"` / `bindtap="isFree ? fnA : fnB"` | **#004** 动态绑定无效，点击无反应 |
| W2 | **wx:key 必须唯一** | `wx:key="index"` 或 `wx:key="id"` | `wx:key="date"` (同日期重复) | **#010-b** 控制台警告 |
| W3 | **花括号必须配对** | `{{` 和 `}}` 数量相等 | 多/少一个 `{` 或 `}` | 编译错误 |
| W4 | **组件属性值类型正确** | `wx:if="{{condition}}"` | `wx:if="true"` (字符串非布尔) | 条件判断失效 |

## WXSS 规则（样式层）

| # | 规则 | 正确 ✅ | 错误 ❌ | 触发 Bug |
|---|------|---------|---------|----------|
| S1 | **`{` 和 `}` 必须配对** | 每个 `{` 有对应 `}` | 孤立的 `% { ... }` 块 | **#002** 样式解析异常 |
| S2 | **@keyframes 必须完整嵌套** | `@keyframes name { 0%{} 100%{} }` | `% { box-shadow:... }` 孤立存在 | **#002** |
| S3 | **类名在 WXML 中有引用** | `.foo{}` 对应 `class="foo"` | 定义了但从未使用 | 无害但增加包体积 |
| S4 | **不用 `!important` 覆盖小程序内置样式** | 用更具体的选择器 | 强制覆盖可能失效 | 样式不稳定 |

## JavaScript 规则（逻辑层）

| # | 规则 | 正确 ✅ | 错误 ❌ | 触发 Bug |
|---|------|---------|---------|----------|
| J1 | **对象属性名必须是 ASCII 英文** | `mainLine: 'value'` | `main线: 'value'` (中文属性名) | **#008** 读取为 undefined |
| J2 | **函数调用名拼写正确** | `wx.cloud.callFunction()` | `callCloudFunction()` (不存在的API) | **#001** TypeError |
| J3 | **require() 路径指向存在的文件** | `require('./storage')` 文件存在 | 路径错误/文件不存在 | 模块加载失败 |
| J4 | **数据初始化必须有默认值** | `data: { sign: null, loading: true }` | `data: { sign: undefined }` | WXML 渲染 undefined 报错 |
| J5 | **poemAncient/poemModern 永远是 2 元素数组** | `[str1, str2]` | `['', '']` / `undefined` / 非数组 | 签文区域空白 (**#005**) |
| J6 | **对象 key 大小写要匹配查找表** | `meta.cls` (小写) 查 POEMS/TRENDS | `gradeKey` (大写) 查小写 key 表 | **#009** 运行时崩溃 |
| J7 | **setData 只传页面需要的字段** | `{ poemAncient, gradeLabel }` | 传入整个大对象 | 性能浪费+bridge开销 |
| J8 | **onLoad/onShow 中不加 wx.showLoading** | 静默预载，数据到了再渲染 | 进入就弹遮罩"获取中..." | **#003** 用户困惑 |

## 环境/网络规则

| # | 规则 | 正确 ✅ | 错误 ❌ | 触发 Bug |
|---|------|---------|---------|----------|
| E1 | **禁止硬编码 localhost/127.0.0.1** | 环境检测 + 条件跳过 | 直接 `wx.request({url:'http://127.0.0.1:...'})` | **#007** timeout 红错 |
| E2 | **所有外部调用加超时保护** | `Promise.race([req, timeout(3000)])` | 默认 15s/30s 超时，白屏等待 | 体验极差 |
| E3 | **网络失败必须静默降级** | catch → 用本地 MOCK 兜底 | catch → 空操作或 console.warn | 页面空白 |
| E4 | **云函数未部署时不调用** | 特性开关 + 注释说明 | 每次 onLoad 都调未部署的云函数 | **#010-a** timeout 红错 |
| E5 | **addSignHistory 去重** | 同日期不重复添加 | 每次 onLoad 都 push | 历史列表重复 |

## 数据契约规则（L1 防线）

| # | 规则 | 说明 |
|---|------|------|
| D1 | **getMarketSign() 返回 16 个必填字段** | 缺失字段用安全默认值填充 + `console.error` 暴露 |
| D2 | **buildMasters() 返回 N 个大师 × 10 字段** | 每位大师校验 id/name/school/initial/color/verdict/verdictCls/text/tactics/isLocked |
| D3 | **poemAncient/poemModern 必须是 [string, string]** | 长度≠2 时自动替换为默认诗句 |
| D4 | **绝不返回 undefined/null 给视图层** | 所有导出函数出口都有 `_validate*Contract()` 守卫 |

## 流程规则（L4 防线）

| # | 规则 | 说明 |
|---|------|------|
| F1 | **Write 后立即验文件大小 > 0** | 防止 **#006** 文件变 0 字节 |
| F2 | **改完 JS 跑 `node -c`** | 语法检查 |
| F3 | **改完 WXSS 跑括号计数** | `{` 和 `}` 数量相等 |
| F4 | **交付前跑 QC-9 全项质检** | 9 项全部通过才能交付 |
| F5 | **每个 Bug 编号追踪** | #001 ~ #010 连续编号，修复后记录到日志 |

---

## 快速检查清单（Copy-Paste 版）

```
□ WXML: bindtap 是静态方法名？ wx:key 不重复？
□ WXSS: { } 配对？ @keyframes 嵌套正确？
□ JS: 属性名纯ASCII？ 函数名拼对？ require路径有效？
□ 数据: poemAncient/Modern是2元素数组？ key大小写匹配？
□ 环境: 无 localhost? 有超时保护? 云函数已部署?
□ 契约: getMarketSign 16字段? buildMasters 10字段×N位?
□ 流程: node -c 通过? 文件>0字节? QC-9全过?
```

---

## Bug 编号索引

| 编号 | 描述 | 根因类别 | 状态 | 修复日期 |
|------|------|---------|------|---------|
| #001 | callCloudFunction → callFunction | J2 (拼写) | ✅ | 2026-05-31 |
| #002 | WXSS 孤立 CSS块 | S1/S2 (括号) | ✅ | 2026-05-31 |
| #003 | wx.showLoading 遮挡交互 | J8 (UX) | ✅ | 2026-05-31 |
| #004 | bindtap="{{expr}}" 动态绑定 | W1 (WXML) | ✅ | 2026-05-31 |
| #005 | poemAncient/Modern 空/缺失 | J5 (数据) | ✅ | 2026-05-31 |
| #006 | Write 后文件 0 字节 | F1 (流程) | ✅ | 2026-05-31 |
| #007 | wx.request localhost timeout | E1 (环境) | ✅ | 2026-05-31 |
| #008 | main线 中文属性名 | J1 (属性名) | ✅ | 2026-05-31 |
| #009 | getMarketSign() 大小写 key 不匹配 | J6 (key格式) | ✅ | 2026-05-31 |
| #010 | cloud timeout + wx:key重复 | E4+E5/W2 | ✅ | 2026-05-31 |
