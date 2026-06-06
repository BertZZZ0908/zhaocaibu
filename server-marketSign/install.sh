#!/usr/bin/env bash
# ============================================================
# 财运局 · 数据后端 · 服务器本地安装脚本
# ============================================================
# 在服务器上直接跑（ubuntu 用户）
# 已预装代码到 ~/caiyunju/server-marketSign/ 后执行本脚本
# ============================================================
set -e

REMOTE_DIR="$HOME/caiyunju"
SERVICE_NAME="caiyunju-data"
SERVICE_PORT="${CYJ_PORT:-5818}"

G="\033[32m"; Y="\033[33m"; R="\033[31m"; B="\033[36m"; N="\033[0m"
step() { echo -e "${B}▸ $*${N}"; }
ok()   { echo -e "${G}✔ $*${N}"; }
warn() { echo -e "${Y}⚠ $*${N}"; }
die()  { echo -e "${R}✘ $*${N}"; exit 1; }

# -------- 0. 预检 --------
step "0. 预检环境"
[ -d "$REMOTE_DIR/server-marketSign" ] || die "未找到 $REMOTE_DIR/server-marketSign/，请先解压代码"
[ -f "$REMOTE_DIR/server-marketSign/generate_daily_sign.py" ] || die "未找到 generate_daily_sign.py"
cd "$REMOTE_DIR/server-marketSign"
ok "代码目录就绪：$REMOTE_DIR/server-marketSign"

# -------- 1. 装 Python 依赖 --------
step "1. 安装 Python 依赖（akshare + pandas）"
sudo apt-get update -qq
sudo apt-get install -y -qq python3 python3-pip 2>&1 | tail -2
python3 -m pip install --user --quiet --upgrade pip akshare pandas 2>&1 | tail -3
ok "依赖安装完成（pip 装在 ~/.local/）"

# -------- 2. 首次生成数据 --------
step "2. 首次抓取数据（akshare 真实行情）"
set +e
python3 generate_daily_sign.py 2>&1 | tail -4
GRADE=$(python3 -c "import json; d=json.load(open('output/daily-sign.json')); print(d['gradeLabel'], '·', d['dataSource'])" 2>/dev/null)
set -e
if [ -n "$GRADE" ]; then
  ok "数据生成：$GRADE"
else
  warn "生成失败，详见上方日志"
fi

# -------- 3. 写 systemd 服务 --------
step "3. 安装 systemd 服务: $SERVICE_NAME"
SYSTEMD_UNIT="/etc/systemd/system/${SERVICE_NAME}.service"
sudo tee "$SYSTEMD_UNIT" >/dev/null <<EOF
[Unit]
Description=Caiyunju Daily Sign JSON Server
After=network.target

[Service]
Type=simple
WorkingDirectory=${REMOTE_DIR}/server-marketSign
ExecStart=/usr/bin/python3 ${REMOTE_DIR}/server-marketSign/serve.py --host 0.0.0.0 --port ${SERVICE_PORT}
Restart=always
RestartSec=3
User=$USER
StandardOutput=append:${REMOTE_DIR}/server-marketSign/serve.log
StandardError=append:${REMOTE_DIR}/server-marketSign/serve.log

[Install]
WantedBy=multi-user.target
EOF

touch "$REMOTE_DIR/server-marketSign/serve.log"
sudo systemctl daemon-reload
sudo systemctl enable --now "$SERVICE_NAME"
sleep 2
if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
  ok "systemd 服务已启动"
else
  warn "服务未正常启动，看日志：sudo journalctl -u $SERVICE_NAME -n 30"
fi

# -------- 4. 配置 crontab --------
step "4. 配置 crontab（每个交易日 15:35 自动更新）"
CRON_LINE="35 15 * * 1-5 cd ${REMOTE_DIR}/server-marketSign && /usr/bin/python3 generate_daily_sign.py >> ${REMOTE_DIR}/server-marketSign/cron.log 2>&1"
(crontab -l 2>/dev/null | grep -v 'generate_daily_sign.py' || true; echo "$CRON_LINE") | crontab -
ok "crontab 已配置"
crontab -l | grep generate_daily_sign

# -------- 5. 本地自检 --------
step "5. 本地自检（内网）"
set +e
RESP=$(curl -s -m 5 http://127.0.0.1:${SERVICE_PORT}/daily-sign.json)
set -e
if echo "$RESP" | grep -q '"gradeLabel"'; then
  INFO=$(echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['gradeLabel'],'·',d['stickNo'],'·',d['dataSource'])")
  ok "服务正常：$INFO"
else
  warn "内网访问失败"
fi

# -------- 6. 提示 --------
echo ""
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
echo -e "${G}✅ 部署完成${N}"
echo ""
echo -e "${Y}⚠️  下一步：到腾讯云控制台 → 安全组 → 入站规则 → 添加 TCP 5818${N}"
echo "   来源：0.0.0.0/0  协议端口：TCP:${SERVICE_PORT}"
echo ""
echo "常用命令："
echo "  sudo systemctl status ${SERVICE_NAME}"
echo "  sudo systemctl restart ${SERVICE_NAME}"
echo "  tail -f ${REMOTE_DIR}/server-marketSign/serve.log"
echo "  crontab -l"
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
