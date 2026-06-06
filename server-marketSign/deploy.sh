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
[ -f "$LOCAL_DIR/serve.py" ] || die "未找到 serve.py"
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
  rsync -avz --exclude='output/*.json' --exclude='__pycache__' --exclude='*.pyc' \
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

# -------- 4. 写 systemd 服务 --------
step "4. 安装 systemd 服务: $SERVICE_NAME"
SYSTEMD_UNIT="/etc/systemd/system/${SERVICE_NAME}.service"
UNIT_CONTENT="[Unit]
Description=Caiyunju Daily Sign JSON Server
After=network.target

[Service]
Type=simple
WorkingDirectory=${REMOTE_DIR}/server-marketSign
ExecStart=/usr/bin/python3 ${REMOTE_DIR}/server-marketSign/serve.py --host 0.0.0.0 --port ${SERVICE_PORT}
Restart=always
RestartSec=3
User=${REMOTE_USER}
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

# -------- 5. 配置 crontab --------
if [ $NO_CRON -eq 0 ]; then
  step "5. 配置 crontab（每个交易日 15:35 自动更新）"
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

# -------- 6. 验证 --------
step "6. 健康检查"
sleep 2
if [ $DRY_RUN -eq 0 ]; then
  set +e
  CURL=$(curl -s -m 5 "http://${REMOTE_HOST}:${SERVICE_PORT}/daily-sign.json")
  set -e
  if echo "$CURL" | grep -q '"gradeLabel"'; then
    GRADE=$(echo "$CURL" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['gradeLabel'], '·', d['dataSource'])" 2>/dev/null)
    ok "服务正常运行：$GRADE"
    echo -e "  ${G}接口地址：${N} http://${REMOTE_HOST}:${SERVICE_PORT}/daily-sign.json"
  else
    warn "公网未能访问 ${REMOTE_HOST}:${SERVICE_PORT}（很可能是腾讯云安全组未放行）"
    echo "  → 服务器内部测试："
    ssh "$REMOTE_USER@$REMOTE_HOST" "curl -s -m 3 http://127.0.0.1:${SERVICE_PORT}/daily-sign.json | head -c 200" || true
    echo ""
  fi
fi

# -------- 7. 后续提示 --------
step "7. 部署完成，后续操作"
echo ""
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
echo ""
echo -e "🌐 ${Y}腾讯云控制台 → 安全组 → 放行 TCP ${SERVICE_PORT}${N}（如果上面健康检查公网失败）"
echo ""
echo -e "📋 ${Y}前端切换接口地址${N}（caiyunju-h5/index.html，在 <script src=\"app.js\"> 之前加一行）:"
echo -e "   <script>window.CAIYUNJU_API='http://${REMOTE_HOST}:${SERVICE_PORT}/daily-sign.json'</script>"
echo ""
echo -e "🔧 ${Y}常用运维命令${N}（在服务器上执行）:"
echo "   systemctl status ${SERVICE_NAME}                 # 看服务状态"
echo "   systemctl restart ${SERVICE_NAME}                # 重启"
echo "   journalctl -u ${SERVICE_NAME} -f                 # 实时日志"
echo "   tail -f ${REMOTE_DIR}/server-marketSign/cron.log # 定时任务日志"
echo "   crontab -l                                       # 看 cron"
echo "   cd ${REMOTE_DIR}/server-marketSign && python3 generate_daily_sign.py --force  # 手动重跑"
echo ""
echo -e "🔄 ${Y}增量更新代码（之后日常用）${N}:"
echo "   ./deploy.sh --files-only"
echo ""
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
