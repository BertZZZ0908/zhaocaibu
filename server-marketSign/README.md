# 财运局 · 每日财运签 · 后端服务 v2.0

> 用 akshare 抓 A 股行情，生成 `daily-sign.json` 供 H5 / 小程序前端读取。
> v2.0 新增：板块详细资金流 / 大师团动态点评 / 节假日休市态 / 静态 JSON 服务

---

## 📦 文件结构

```
server-marketSign/
├── generate_daily_sign.py   # 数据生成脚本（核心）
├── serve.py                 # 静态 JSON 服务器（5818 端口，带 CORS）
├── output/
│   ├── daily-sign.json      # 最新签数据（前端 fetch 这个）
│   └── sign-YYYYMMDD.json   # 历史归档
└── README.md
```

---

## 🚀 本地开发

### 1. 环境

```bash
python3 -m pip install akshare pandas
```

### 2. 跑一次生成数据

```bash
# 真实数据（需要国内 IP 才能稳定，海外/部分网络会失败自动降级 mock）
python3 generate_daily_sign.py

# 强制 mock（任何环境都可用）
python3 generate_daily_sign.py --mock
```

输出 → `output/daily-sign.json`

### 3. 启动静态 JSON 服务

```bash
python3 serve.py
# [财运局 · 数据服务]
#   接口: http://127.0.0.1:5818/daily-sign.json
#   停止: Ctrl + C
```

### 4. 前端联调

启动前端 H5（在 `caiyunju-h5/` 目录）：
```bash
cd ../caiyunju-h5 && python3 -m http.server 5817
```

打开 http://localhost:5817/#/sign 摇签即可看到真实数据。

---

## ☁️ 部署到腾讯云（生产）

### 1. 上传文件

```bash
scp -r server-marketSign/ root@43.138.253.212:/opt/caiyunju/
```

### 2. 服务器安装环境

```bash
ssh root@43.138.253.212
cd /opt/caiyunju/server-marketSign
python3 -m pip install akshare pandas
```

### 3. 跑一次生成数据（国内 IP，akshare 应当成功）

```bash
python3 generate_daily_sign.py
# 检查输出：dataSource 应该是 "akshare · 实时"
cat output/daily-sign.json | python3 -m json.tool | grep dataSource
```

### 4. 启动 JSON 服务（后台运行）

**方案 A · 直接 nohup**（简单，重启服务器后失效）：
```bash
nohup python3 serve.py --host 0.0.0.0 --port 5818 > serve.log 2>&1 &
```

**方案 B · systemd**（推荐，永久）：

`/etc/systemd/system/caiyunju-data.service`:
```ini
[Unit]
Description=Caiyunju Daily Sign JSON Server
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/caiyunju/server-marketSign
ExecStart=/usr/bin/python3 serve.py --host 0.0.0.0 --port 5818
Restart=always
User=root

[Install]
WantedBy=multi-user.target
```

启用：
```bash
systemctl daemon-reload
systemctl enable caiyunju-data
systemctl start caiyunju-data
systemctl status caiyunju-data
```

### 5. 开放防火墙 5818 端口

```bash
# 腾讯云控制台 → 安全组 → 添加入站规则：TCP 5818 来源 0.0.0.0/0
# 或服务器内：
ufw allow 5818/tcp
```

### 6. 测试

```bash
curl http://43.138.253.212:5818/daily-sign.json
```

### 7. 前端切换接口地址

编辑 `caiyunju-h5/index.html`，在 `<script src="app.js">` 前加：
```html
<script>
  window.CAIYUNJU_API = 'http://43.138.253.212:5818/daily-sign.json';
</script>
```

### 8. 定时任务（每个交易日 15:35 自动更新）

```bash
crontab -e
```

加一行：
```
35 15 * * 1-5 cd /opt/caiyunju/server-marketSign && /usr/bin/python3 generate_daily_sign.py >> /opt/caiyunju/cron.log 2>&1
```

---

## 📋 JSON 输出格式（前端契约）

```json
{
  "date": "2026.05.11",
  "stickNo": "第 一十二 签",
  "grade": "DA_JI",           // DA_JI/SHANG_JI/ZHONG_JI/ZHONG_PING/XIA_PING/XIA_XIONG
  "gradeLabel": "大 吉",
  "gradeCls": "great",
  "gradeColor": "#D4A853",
  "poemAncient": ["乾坤朗朗日月新", "此时不动更待何"],
  "poemModern": ["市场清晰方向明", "上车时机就是现在"],
  "trend": "偏多 · 沪指 +2.15%",
  "mainLine": "AI算力 / 半导体",
  "risk": "过热信号 · 注意尾盘获利盘",
  "action": "持股不动 · 别加杠杆",
  "expand": {
    "sectorPick": ["AI算力", "半导体", "消费电子"],
    "sectorAvoid": ["防御板块", "黄金"],
    "sectorPickDetail": [{ "name": "AI算力", "chg": "+8.85%", "chgRaw": 8.85, "flow": "+35.2亿" }, ...],
    "sectorAvoidDetail": [...],
    "darkHorse": "机器人",
    "northFlow": "+96.0亿",
    "emotion": 82,
    "emotionLabel": "极 贪",
    "upCount": 4280,
    "downCount": 720,
    "shClose": 3320.18,
    "shChgPct": 2.15,
    "hotSectors": [{ "name": "AI算力", "realName": "人工智能", "chg": 8.85 }, ...]
  },
  "masters": {
    "list": [
      { "name": "柏南姨", "title": "宏观鸽派", "stance": "买", "avatar": "柏", "color": "#D4A853",
        "view": "流动性还在 · 北向 +96.0亿 · 不慌" },
      ...
    ],
    "consensus": "多数偏多 · 顺势"
  },
  "isHoliday": false,            // true 时前端展示"今日休市·财神也歇着"
  "holidayReason": "",           // "周六休市 · 财神也歇着" 等
  "dataSource": "akshare · 实时",
  "generatedAt": "2026-05-11 15:35:02"
}
```

---

## 🛡️ 降级策略

| 场景 | 行为 |
|---|---|
| akshare 调用成功 | `dataSource: "akshare · 实时"` |
| akshare 失败 | 自动用 mock，`dataSource: "mock · akshare 失败回退"` |
| 节假日（周末/节日） | 复用上一交易日归档数据，`isHoliday: true`，前端走休市态 |
| 未跑过生成脚本 | 复用 mock 兜底 |
| 前端 fetch 失败/超时 3s | 前端自动用本地 marketSign.js 的 mock，徽章显示"○ 演示数据" |
| 同一天内重复访问 | 前端 sessionStorage 缓存，徽章显示"● 已缓存" |

---

## ⚠️ 合规边界

- ✅ 板块涨跌幅 / 主力资金 / 北向 / 涨跌家数 — 公开行情，可用
- ✅ 大师点评 — 假名 + 文化娱乐定位，无个股推荐
- ❌ 不接券商 API 实盘下单
- ❌ 不提供个股诊断
- ❌ 不爬付费数据源（Wind/iFinD）
