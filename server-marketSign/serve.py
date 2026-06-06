"""
财运局 · 静态 JSON 服务器
========================
暴露 output/ 目录到 5818 端口，并加 CORS 头给前端跨域 fetch

Usage:
    python3 serve.py                  # 默认 5818
    python3 serve.py --port 5818      # 指定端口
    python3 serve.py --host 0.0.0.0   # 监听所有地址（部署到腾讯云用）
"""
import argparse
import http.server
import os
import socketserver
from pathlib import Path


class CORSHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        # 短缓存，避免前端拿到过期数据
        self.send_header("Cache-Control", "public, max-age=60")
        super().end_headers()

    def log_message(self, fmt, *args):
        # 简化日志：只记错误
        if not args or "200" in str(args[1] if len(args) > 1 else ""):
            return
        super().log_message(fmt, *args)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=5818)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--dir", default=None, help="静态目录，默认 ./output/")
    args = parser.parse_args()

    static_dir = Path(args.dir) if args.dir else Path(__file__).resolve().parent / "output"
    static_dir.mkdir(parents=True, exist_ok=True)
    os.chdir(static_dir)

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer((args.host, args.port), CORSHandler) as httpd:
        print(f"[财运局 · 数据服务]")
        print(f"  目录: {static_dir}")
        print(f"  地址: http://{args.host}:{args.port}/")
        print(f"  接口: http://{args.host}:{args.port}/daily-sign.json")
        print(f"  停止: Ctrl + C")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[停止]")


if __name__ == "__main__":
    main()
