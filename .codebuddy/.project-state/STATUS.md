# STATUS.md — 项目总状态

> 最后更新：2026-06-12

## 当前阶段：安全加固完成，待小程序上传审核

## 三端状态

| 端 | 状态 | 说明 |
|:--|:--|:--|
| **server-marketSign** | 🟢 生产运行 | gunicorn + Nginx + HTTPS，zhaocaibu.cn |
| **caiyunju-miniapp** | 🟡 开发完成 | 8 页骨架就绪，sign 页已接入真实 API，待上传审核 |
| **caiyunju-h5** | 🟡 可用 | 本地 5817 端口，需配置生产域名 API |

## 当前焦点

1. ~~P0/P1 安全修复~~ ✅ 已完成并推送到 GitHub
2. ~~生产服务器部署~~ ✅ 已完成
3. 小程序上传微信审核

## 阻塞项

| 阻塞 | 影响 | 优先级 |
|:--|:--|:--|
| 微信小程序 request 域名白名单未添加 zhaocaibu.cn | 小程序无法调用 API | P0 |
| 小程序未上传代码 | 用户无法使用 | P0 |

## 已完成的里程碑

- [x] 域名购买 + ICP 备案（zhaocaibu.cn）
- [x] 腾讯云服务器部署（43.138.253.212）
- [x] CloudQ 安全评估 + P0/P1 全修
- [x] gunicorn + Nginx + HTTPS 生产部署
- [x] 小程序 API 接入（fetchRemoteSign + api-config）
- [x] GitHub SSH 配置 + 代码推送

## 下一步计划

1. 微信后台添加 request 域名
2. 小程序上传 + 提交审核
3. 冷启动内容准备（小红书 + 公众号）
