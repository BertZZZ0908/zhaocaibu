#!/usr/bin/env bash
# ============================================================
# 财运局 · 数据后端一键部署脚本
# ============================================================
# 用法：
#   ./deploy.sh                  # 全套部署
#   ./deploy.sh --files-only     # 只同步代码不重启服务
#   ./deploy.sh --no-cron        # 不装 crontab
#   ./deploy.sh --dry-run        # 只打印不执行
#
# 前置：本地能 ssh root@43.138.253.212 免密登录
# ============================================================
set -e

# -------- 配置 --------
REMOTE_USER="${CYJ_USER:-ubuntu}"
REMOTE_HOST="${CYJ_HOST:-43.138.253.212}"
REMOTE_DIR="${CYJ_DIR:-/home/ubuntu/caiyunju}"
SERVICE_NAME="caiyunju-data"
SERVICE_PORT="${CYJ_PORT:-5818}"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"
USE_SUDO="${CYJ_SUDO:-sudo}"   # 非 root 用户需要 sudo 装包/写 systemd

DRY_RUN=0
FILES_ONLY=0
NO_CRON=0

for arg in "$@"; do
  case $arg in
    --dry-run) DRY_RUN=1 ;;
    --files-only) FILES_ONLY=1 ;;
    --no-cron) NO_CRON=1 ;;
    -h|--help)
      head -n 14 "$0" | grep -E "^#" | sed 's/^# \?//'
      exit 0 ;;
  esac
done

# -------- 颜色 --------
G="\033[32m"; Y="\033[33m"; R="\033[31m"; B="\033[36m"; N="\033[0m"

step() { echo -e "${B}▸ $*${N}"; }
ok()   { echo -e "${G}✔ $*${N}"; }
warn() { echo -e "${Y}⚠ $*${N}"; }
die()  { echo -e "${R}✘ $*${N}"; exit 1; }

run_local()  { if [ $DRY_RUN -eq 1 ]; then echo "  [dry] $*"; else eval "$*"; fi }
run_remote() { if [ $DRY_RUN -eq 1 ]; then echo "  [dry-ssh] $*"; else ssh "$REMOTE_USER@$REMOTE_HOST" "$*"; fi }

# -------- 0. 预检 --------
step "0. 预检本地环境与 SSH 连通性"
[ -f "$LOCAL_DIR/generate_daily_sign.py" ] || die "未找到 generate_daily_sign.py，请在 server-marketSign/ 目录运行此脚本"
[ -f "$LOCAL_DIR/serve_flask.py" ] || die "未找到 serve_flask.py（v2.1 安全加固版，需部署此版本）"
if [ $DRY_RUN -eq 0 ]; then
  ssh -o BatchMode=yes -o ConnectTimeout=5 "$REMOTE_USER@$REMOTE_HOST" "echo connected" >/dev/null 2>&1 \
    || die "SSH 连接失败：请先确保 ssh $REMOTE_USER@$REMOTE_HOST 能免密登录"
fi
ok "本地与服务器连通"

# -------- 1. 同步代码 --------
step "1. 同步代码到 $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/server-marketSign/"
run_remote "mkdir -p $REMOTE_DIR/server-marketSign/output"
if [ $DRY_RUN -eq 1 ]; then
  echo "  [dry] rsync -avz --exclude output/ $LOCAL_DIR/ $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/server-marketSign/"
else
  rsync -avz \
    --exclude='output/*.json' \
    --exclude='__pycache__/' \
    --exclude='*.pyc' \
    --exclude='.git/' \
    --exclude='.env' \
    --exclude='*.log' \
    --exclude='logs/' \
    --exclude='*.pem' \
    --exclude='credentials*' \
    --exclude='.DS_Store' \
    "$LOCAL_DIR/" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/server-marketSign/" | tail -8
fi
ok "代码已同步"

if [ $FILES_ONLY -eq 1 ]; then
  step "--files-only 模式，跳过环境与服务配置"
  exit 0
fi

# -------- 2. 装 Python 依赖 --------
step "2. 安装 Python 依赖（akshare + pandas）"
run_remote "$USE_SUDO apt-get update -qq && $USE_SUDO apt-get install -y -qq python3 python3-pip rsync >/dev/null && python3 -m pip install --user --quiet --upgrade pip akshare pandas 2>&1 | tail -3"
ok "依赖安装完成"

# -------- 3. 首次生成 daily-sign.json --------
step "3. 首次抓取真实数据（akshare）"
if [ $DRY_RUN -eq 0 ]; then
  set +e
  result=$(ssh "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_DIR/server-marketSign && python3 generate_daily_sign.py 2>&1 | tail -3")
  set -e
  echo "$result"
  if echo "$result" | grep -q "akshare · 实时"; then
    ok "akshare 实时数据获取成功"
  else
    warn "akshare 未拿到实时数据（可能是网络或假期），已使用 mock 兜底"
  fi
fi

# -------- 4. 安装 gunicorn（生产级 WSGI）--------
step "4. 安装 gunicorn（生产级 WSGI 服务器）"
run_remote "python3 -m pip install --user --quiet gunicorn 2>&1 | tail -2"
ok "gunicorn 安装完成"

# -------- 5. 写 systemd 服务 --------
step "5. 安装 systemd 服务: $SERVICE_NAME"
SYSTEMD_UNIT="/etc/systemd/system/${SERVICE_NAME}.service"
UNIT_CONTENT="[Unit]
Description=Caiyunju Daily Sign JSON Server v2.2 (Flask + Gunicorn + Safety)
After=network.target

[Service]
Type=simple
WorkingDirectory=${REMOTE_DIR}/server-marketSign
ExecStart=/home/${REMOTE_USER}/.local/bin/gunicorn -w 2 -b 127.0.0.1:${SERVICE_PORT} --access-logfile ${REMOTE_DIR}/server-marketSign/logs/gunicorn-access.log --error-logfile ${REMOTE_DIR}/server-marketSign/logs/gunicorn-error.log --timeout 30 serve_flask:app
Restart=always
RestartSec=3
RestartLimitInterval=60s
RestartLimitBurst=3
User=${REMOTE_USER}
MemoryMax=512M
CPUQuota=50%
StandardOutput=append:${REMOTE_DIR}/server-marketSign/serve.log
StandardError=append:${REMOTE_DIR}/server-marketSign/serve.log

[Install]
WantedBy=multi-user.target"

if [ $DRY_RUN -eq 1 ]; then
  echo "  [dry] 写入 $SYSTEMD_UNIT"
else
  echo "$UNIT_CONTENT" | ssh "$REMOTE_USER@$REMOTE_HOST" "$USE_SUDO tee $SYSTEMD_UNIT >/dev/null"
  run_remote "$USE_SUDO systemctl daemon-reload && $USE_SUDO systemctl enable --now $SERVICE_NAME"
fi
ok "systemd 已配置并启动"

# -------- 6. 配置 crontab --------
if [ $NO_CRON -eq 0 ]; then
  step "6. 配置 crontab（每个交易日 15:35 自动更新）"
  CRON_LINE="35 15 * * 1-5 cd ${REMOTE_DIR}/server-marketSign && /usr/bin/python3 generate_daily_sign.py >> ${REMOTE_DIR}/server-marketSign/cron.log 2>&1"
  if [ $DRY_RUN -eq 1 ]; then
    echo "  [dry] 添加 cron 行: $CRON_LINE"
  else
    # 幂等：先去掉已存在的同名 cron，再追加
    ssh "$REMOTE_USER@$REMOTE_HOST" "(crontab -l 2>/dev/null | grep -v 'generate_daily_sign.py' || true; echo '$CRON_LINE') | crontab -"
  fi
  ok "crontab 已配置"
else
  warn "跳过 crontab（--no-cron）"
fi

# -------- 7. 验证 --------
step "7. 健康检查（gunicorn 内网）"
sleep 2
if [ $DRY_RUN -eq 0 ]; then
  set +e
  CURL=$(ssh "$REMOTE_USER@$REMOTE_HOST" "curl -s -m 5 http://127.0.0.1:${SERVICE_PORT}/health")
  set -e
  if echo "$CURL" | grep -q '"status"'; then
    ok "gunicorn 运行正常（内网 127.0.0.1:${SERVICE_PORT}）"
  else
    warn "服务可能未正常启动，检查 systemctl status ${SERVICE_NAME}"
  fi
fi

# -------- 8. 后续提示 --------
step "8. 部署完成，后续操作"
echo ""
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
echo ""
echo -e "🔒 ${R}安全警告：gunicorn 监听 127.0.0.1:${SERVICE_PORT}（仅内网），外网不可直接访问${N}"
echo ""
echo -e "🌐 ${Y}配置 Nginx 反向代理（参考 nginx.conf）${N}:"
echo "  1. sudo cp ~/caiyunju/server-marketSign/nginx.conf /etc/nginx/sites-available/caiyunju"
echo "  2. sed -i 's/caiyunju.example.com/你的域名/g' /etc/nginx/sites-available/caiyunju"
echo "  3. sudo ln -s /etc/nginx/sites-available/caiyunju /etc/nginx/sites-enabled/"
echo "  4. sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo -e "🔐 ${Y}HTTPS 证书${N}:"
echo "  sudo certbot --nginx -d 你的域名"
echo ""
echo -e "🗂️ ${Y}日志轮转（防磁盘撑爆）${N}:"
echo "  sudo cp ~/caiyunju/server-marketSign/logrotate.conf /etc/logrotate.d/caiyunju"
echo ""
echo -e "📋 ${Y}前端切换接口地址${N}（caiyunju-h5/index.html，在 <script src=\"app.js\"> 之前加一行）:"
echo -e "   <script>window.CAIYUNJU_API='https://你的域名/daily-sign.json'</script>"
echo ""
echo -e "\033[31m⚠️  重要：部署后务必配置 Nginx + HTTPS 再对外发布！\033[0m"
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
