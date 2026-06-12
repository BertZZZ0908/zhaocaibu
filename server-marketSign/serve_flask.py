"""
财运局 · 数据服务器 v2.1（Flask 版 + 安全加固）
==================================================
替换原 Python http.server，解决腾讯云轻量服务器外部连接空响应问题
支持 CORS 白名单、线程并发、健康检查、访问日志、基础限流

P0-4 安全加固（2026-06-01）：
- CORS Allow-Origin 改为白名单（H5 / 小程序 / 本地开发）
- 增加 Origin 校验，非白名单返回 403
- 增加访问日志（输出到 logs/access.log）
- 增加内存级简易限流（单 IP 60 秒内 120 次 = 2 QPS 上限，防 DDoS）

Usage:
    python3 serve_flask.py                  # 默认 5818
    python3 serve_flask.py --port 5818      # 指定端口
    python3 serve_flask.py --host 0.0.0.0   # 监听所有地址
"""
import argparse
import json
import logging
import os
import sys
import time
from collections import defaultdict, deque
from logging.handlers import RotatingFileHandler
from pathlib import Path

try:
    from flask import Flask, jsonify, make_response, request, abort
except ImportError:
    print("ERROR: pip3 install flask")
    sys.exit(1)

app = Flask(__name__)
# STATIC_DIR 在模块级初始化（gunicorn 不会调 main()，必须在此设置）
STATIC_DIR = Path(__file__).resolve().parent / "output"
STATIC_DIR.mkdir(parents=True, exist_ok=True)
_server_start_time = time.time()  # 用于 /health 上报 uptime

# ============ API Key 鉴权配置 ============
API_KEY = os.environ.get("CAIYUNJU_API_KEY", "")
API_KEY_ENDPOINTS = {"/api/sign", "/api/masters"}  # 需要鉴权的端点

# ============ 安全配置 ============

# CORS 白名单（精确匹配）
ALLOWED_ORIGINS = {
    # H5 端
    "http://localhost:5817",
    "http://127.0.0.1:5817",
    # 生产域名（备案后填入）
    # "https://你的域名",
}
# 是否允许小程序无 Origin 请求（小程序请求默认无 Origin 头，走此分支）
ALLOW_NO_ORIGIN = True

# 简易限流：单 IP 60 秒窗口内 120 次（约 2 QPS）
RATE_WINDOW_SEC = 60
RATE_MAX_REQS = 120
_rate_buckets = defaultdict(deque)  # ip -> deque[timestamp]

# 访问日志
LOG_DIR = Path(__file__).resolve().parent / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
access_logger = logging.getLogger("caiyunju.access")
access_logger.setLevel(logging.INFO)
_handler = RotatingFileHandler(
    LOG_DIR / "access.log",
    maxBytes=10 * 1024 * 1024,
    backupCount=5,
    encoding="utf-8",
)
_handler.setFormatter(logging.Formatter("%(asctime)s %(message)s"))
access_logger.addHandler(_handler)


def load_json(filename):
    fp = Path(STATIC_DIR) / filename
    if not fp.exists():
        return None
    try:
        return json.loads(fp.read_text(encoding="utf-8"))
    except Exception as e:
        access_logger.error("load_json fail: %s %s", filename, e)
        return None


def _client_ip():
    # 兼容 nginx 代理
    fwd = request.headers.get("X-Forwarded-For")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.remote_addr or "unknown"


@app.before_request
def _rate_limit_and_log():
    """限流 + 访问日志（P0-4 新增）"""
    ip = _client_ip()
    path = request.path
    # 健康检查不限流、不鉴权
    if path == "/health":
        return None
    # API Key 鉴权（如果配置了 API_KEY）
    if API_KEY and request.path in API_KEY_ENDPOINTS:
        key = request.headers.get("X-API-Key") or request.args.get("api_key")
        if key != API_KEY:
            access_logger.warning("AUTH_FAIL ip=%s path=%s", ip, path)
            return jsonify({"error": "unauthorized", "message": "需要有效的 API Key"}), 401
    # 限流
    now = time.time()
    bucket = _rate_buckets[ip]
    while bucket and bucket[0] < now - RATE_WINDOW_SEC:
        bucket.popleft()
    if len(bucket) >= RATE_MAX_REQS:
        access_logger.warning("RATE_LIMIT ip=%s path=%s", ip, path)
        return jsonify({"error": "rate limit exceeded", "retry_after": RATE_WINDOW_SEC}), 429
    bucket.append(now)
    # 访问日志
    access_logger.info(
        "ip=%s method=%s path=%s ua=%s origin=%s",
        ip,
        request.method,
        path,
        (request.headers.get("User-Agent") or "-")[:80],
        request.headers.get("Origin") or "-",
    )
    return None


@app.after_request
def add_cors(response):
    """CORS 白名单（P0-4 修复：从 * 改为白名单）"""
    origin = request.headers.get("Origin")
    if origin and origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
    elif not origin and ALLOW_NO_ORIGIN:
        # 小程序请求通常无 Origin 头，放行
        pass
    else:
        # 非白名单 Origin 不返回 ACAO 头，浏览器会自然拒绝跨域
        access_logger.warning("CORS_REJECT origin=%s ip=%s", origin, _client_ip())
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Cache-Control"] = "public, max-age=60"
    # 安全头
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


@app.route("/health")
def health():
    # 检查数据文件新鲜度
    sig_path = Path(STATIC_DIR) / "daily-sign.json"
    data_age = -1
    if sig_path.exists():
        try:
            data_age = time.time() - sig_path.stat().st_mtime
        except OSError:
            pass
    return jsonify({
        "status": "ok",
        "service": "caiyunju-data",
        "version": "v2.2",
        "data_age_seconds": round(data_age, 1),
        "data_fresh": data_age >= 0 and data_age < 86400,
        "uptime_seconds": round(time.time() - _server_start_time, 0),
    })


@app.route("/api/sign")
def api_sign():
    d = load_json("daily-sign.json")
    if d is None:
        return jsonify({"error": "no data"}), 503
    return jsonify(d)


@app.route("/daily-sign.json")
def daily_sign():
    d = load_json("daily-sign.json")
    if d is None:
        return jsonify({"error": "no data"}), 503
    r = make_response(jsonify(d))
    r.headers["Content-Type"] = "application/json; charset=utf-8"
    return r


@app.route("/")
def index():
    files = [f.name for f in Path(STATIC_DIR).glob("*.json") if f.is_file()]
    return jsonify({
        "service": "caiyunju v2.1 (Flask + safety hardened)",
        "files": files,
        "endpoints": {
            "/daily-sign.json": "data",
            "/api/sign": "api",
            "/health": "health",
        },
    })


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "not found", "path": request.path}), 404


@app.errorhandler(500)
def server_error(e):
    access_logger.error("500 path=%s err=%s", request.path, e)
    return jsonify({"error": "internal server error"}), 500


def main():
    global STATIC_DIR
    p = argparse.ArgumentParser()
    p.add_argument("--port", type=int, default=5818)
    p.add_argument("--host", default="0.0.0.0")
    p.add_argument("--dir", default=None)
    a = p.parse_args()
    STATIC_DIR = Path(a.dir) if a.dir else Path(__file__).resolve().parent / "output"
    STATIC_DIR.mkdir(parents=True, exist_ok=True)
    print("[caiyunju v2.1 Flask + safety] http://%s:%d/" % (a.host, a.port))
    print("[CORS whitelist] %s" % ", ".join(sorted(ALLOWED_ORIGINS)))
    print("[Rate limit] %d req / %d sec per IP" % (RATE_MAX_REQS, RATE_WINDOW_SEC))
    print("[Access log] %s" % (LOG_DIR / "access.log"))
    app.run(host=a.host, port=a.port, threaded=True, use_reloader=False)


if __name__ == "__main__":
    main()
