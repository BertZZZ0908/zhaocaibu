# DEPLOY.md — 部署状态+环境

> 最后更新：2026-06-12

## 生产环境

| 项目 | 值 |
|:--|:--|
| **服务器** | 腾讯云轻量 43.138.253.212 (2C2G 50G SSD Ubuntu 22.04) |
| **域名** | zhaocaibu.cn（ICP: 粤ICP备2026050689号-2） |
| **HTTPS** | Let's Encrypt，2026-09-04 到期，自动续期 |
| **SSH** | ubuntu@43.138.253.212（密钥认证） |

## 服务架构

```
公网 → Nginx (:80/:443) → gunicorn (:5818 内网) → serve_flask.py
                                ↓
                         /daily-sign.json (Nginx 静态直出)
```

## 运行中的服务

| 服务 | 状态 | 命令 |
|:--|:--|:--|
| caiyunju-data (gunicorn) | 🟢 running | `systemctl status caiyunju-data` |
| Nginx | 🟢 running | `systemctl status nginx` |
| certbot timer | 🟢 active | `systemctl status certbot.timer` |

## 关键文件路径（服务器）

| 文件 | 路径 |
|:--|:--|
| 代码 | `/home/ubuntu/caiyunju/server-marketSign/` |
| 数据 | `/home/ubuntu/caiyunju/server-marketSign/output/daily-sign.json` |
| 日志 | `/home/ubuntu/caiyunju/server-marketSign/logs/` |
| Nginx | `/etc/nginx/sites-enabled/caiyunju` |
| systemd | `/etc/systemd/system/caiyunju-data.service` |
| logrotate | `/etc/logrotate.d/caiyunju` |
| API Key | `/etc/systemd/system/caiyunju-data.service` (Environment) |

## 部署命令

```bash
# 全量部署
cd /Users/zhaoge/Documents/earnmoney/server-marketSign
./deploy.sh

# 仅同步代码
./deploy.sh --files-only

# 同步代码到服务器并重启
rsync -avz --exclude='output/*.json' --exclude='logs/' \
   /Users/zhaoge/Documents/earnmoney/server-marketSign/ \
   ubuntu@43.138.253.212:/home/ubuntu/caiyunju/server-marketSign/ \
   && ssh ubuntu@43.138.253.212 'sudo systemctl restart caiyunju-data'
```

## 验证端点

```bash
# 健康检查
curl https://zhaocaibu.cn/health
# 签文数据
curl https://zhaocaibu.cn/daily-sign.json
# API 鉴权测试
curl -H "X-API-Key: <KEY>" https://zhaocaibu.cn/api/sign
```

## 安全组规则

| 来源 | 端口 | 用途 |
|:--|:--|:--|
| 0.0.0.0/0 | 80 | HTTP |
| 0.0.0.0/0 | 443 | HTTPS |
| 0.0.0.0/0 | 22 | SSH |

> ⚠️ 5818 端口**不应**在安全组中开放（gunicorn 仅监听 127.0.0.1）

## GitHub

| 项目 | 值 |
|:--|:--|
| 仓库 | `git@github.com:BertZZZ0908/zhaocaibu.git` |
| 分支 | main |
| 最新 commit | 700d6b4 |
| 本地路径 | `/Users/zhaoge/Documents/earnmoney/` |
