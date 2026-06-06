#!/usr/bin/env bash
# ============================================================
# 财运局 · 数据服务 v2 升级脚本（Flask 版）
# ============================================================
# 解决 Python http.server 在腾讯云轻量服务器上外部连接空响应问题
# 用法: bash upgrade_flask.sh
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

step "1. 安装 Flask"
python3 -m pip install --user --quiet flask 2>&1 | tail -2 || die "Flask 安装失败"
ok "Flask 安装完成"

step "2. 写入 serve_flask.py"
cat > "$REMOTE_DIR/server-marketSign/serve_flask.py" 'FLASK_EOF'
import argparse
import json
import os
import sys
from pathlib import Path

try:
    from flask import Flask, jsonify, send_from_directory, make_response
except ImportError:
    print("错误：需要安装 Flask")
    print("  pip3 install --user flask")
    sys.exit(1)

app = Flask(__name__)
STATIC_DIR = None

def load_json_file(filename):
    filepath = Path(STATIC_DIR) / filename
    if not filepath.exists():
        return None
    try:
        return json.loads(filepath.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, IOError):
        return None

@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Cache-Control"] = "public, max-age=60"
    return response

@app.route("/health")
def health():
    return jsonify({"status": "ok", "service": "caiyunju-data"})

@app.route("/api/sign")
def api_sign():
    data = load_json_file("daily-sign.json")
    if data is None:
        return jsonify({"error": "data not found"}), 503
    return jsonify(data)

@app.route("/daily-sign.json")
def daily_sign():
    data = load_json_file("daily-sign.json")
    if data is None:
        return jsonify({"error": "data not found"}), 503
    resp = make_response(jsonify(data))
    resp.headers["Content-Type"] = "application/json; charset=utf-8"
    return resp

@app.route("/")
def index():
    files = [f.name for f in Path(STATIC_DIR).glob("*.json") if f.is_file()]
    return jsonify({"service": "caiyunju v2 (Flask)", "files": files})

def main():
    global STATIC_DIR
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=5818)
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--dir", default=None)
    args = parser.parse_args()
    STATIC_DIR = Path(args.dir) if args.dir else Path(__file__).resolve().parent / "output"
    STATIC_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[caiyunju v2 Flask] http://{args.host}:{args.port}/")
    app.run(host=args.host, port=args.port, threaded=True, use_reloader=False)

if __name__ == "__main__":
    main()
FLASK_EOF
ok "serve_flask.py 已写入"

step "3. 更新 systemd 服务（指向 Flask 版）"
SYSTEMD_UNIT="/etc/systemd/system/${SERVICE_NAME}.service"
sudo tee "$SYSTEMD_UNIT" >/dev/null <<EOF
[Unit]
Description=Caiyunju Daily Sign JSON Server v2 (Flask)
After=network.target

[Service]
Type=simple
WorkingDirectory=${REMOTE_DIR}/server-marketSign
ExecStart=/usr/bin/python3 ${REMOTE_DIR}/server-marketSign/serve_flask.py --host 0.0.0.0 --port ${SERVICE_PORT}
Restart=always
RestartSec=3
User=$USER
StandardOutput=append:${REMOTE_DIR}/server-marketSign/serve.log
StandardError=append:${REMOTE_DIR}/server-marketSign/serve.log

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
ok "systemd 服务已更新"

step "4. 重启服务"
sudo systemctl restart "$SERVICE_NAME"
sleep 2
if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
    ok "服务已启动"
else
    warn "服务启动异常，查看日志: journalctl -u $SERVICE_NAME -n 20"
fi

step "5. 验证"
echo -n "  本地测试: "
RESP=$(curl -s -m 5 http://127.0.0.1:${SERVICE_PORT}/health 2>/dev/null)
if echo "$RESP" | grep -q '"ok"'; then
    echo -e "${G}通过${N}"
else
    echo -e "${Y}失败: ${RESP}${N}"
fi

echo ""
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
echo -e "${G}✅ 升级到 Flask v2 完成${N}"
echo -e "  新增接口: /health（健康检查）"
echo -e "  原有接口不变: /daily-sign.json、/api/sign"
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
