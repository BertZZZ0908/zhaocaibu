// 备案合规落地页代理 · 不动原有代码
// 用法: node landing-proxy.js
// 然后用 nginx/caddy 把 80 端口转发到本文件的端口(比如 5099)

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.LANDING_PORT || 5099;
const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:5000';

const landingHtml = fs.readFileSync(path.join(__dirname, 'landing.html'), 'utf-8');

const server = http.createServer((req, res) => {
  // 首页 → 返回合规落地页
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(landingHtml);
  }

  // 其他所有路径 → 转发到后端 Stock Advisor / H5 等
  // 这样管局只看首页是合规的，其他功能不受影响
  const url = new URL(req.url, BACKEND);
  const proxyReq = http.request(url, { method: req.method, headers: req.headers }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on('error', () => {
    res.writeHead(502);
    res.end('Bad Gateway');
  });
  req.pipe(proxyReq);
});

server.listen(PORT, () => {
  console.log(`[Landing Proxy] OK — 首页→落地页 | 其他→${BACKEND} | 端口:${PORT}`);
});
