#!/usr/bin/env node
/**
 * Production static server for Vite SPA builds (admin / LK).
 * Handles base paths /admin/ and /app/ for nginx reverse proxy.
 *
 * Env:
 *   SPA_ROOT   — path to dist/ (default: apps/<SPA_APP>/dist)
 *   SPA_BASE   — URL prefix, e.g. /admin/ or /app/
 *   PORT       — listen port (5174 admin, 5173 client)
 *   HOST       — bind address (default 0.0.0.0)
 *   INSTALL_DIR — monorepo root
 *   SPA_APP    — web-admin | web-client (used if SPA_ROOT unset)
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const installDir = process.env.INSTALL_DIR || path.resolve(__dirname, '..');
const spaApp = process.env.SPA_APP || 'web-admin';
const basePath = normalizeBase(process.env.SPA_BASE || (spaApp === 'web-admin' ? '/admin' : '/app'));
const port = Number(process.env.PORT || (spaApp === 'web-admin' ? 5174 : 5173));
const host = process.env.HOST || '0.0.0.0';
const root = path.resolve(
  process.env.SPA_ROOT || path.join(installDir, 'apps', spaApp, 'dist'),
);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function normalizeBase(value) {
  let base = value.trim();
  if (!base.startsWith('/')) base = `/${base}`;
  if (!base.endsWith('/')) base = `${base}/`;
  return base;
}

function resolveFile(urlPath) {
  let rel = urlPath;
  if (rel.startsWith(basePath)) {
    rel = rel.slice(basePath.length);
  } else if (rel === basePath.slice(0, -1)) {
    rel = '';
  }
  rel = rel.replace(/^\/+/, '');
  if (!rel || rel.endsWith('/')) {
    rel = 'index.html';
  }
  const filePath = path.normalize(path.join(root, rel));
  if (!filePath.startsWith(root)) return null;
  return filePath;
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      const indexPath = path.join(root, 'index.html');
      if (filePath !== indexPath && fs.existsSync(indexPath)) {
        return sendFile(res, indexPath);
      }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    res.end(data);
  });
}

if (!fs.existsSync(root)) {
  console.error(`ERROR: SPA dist not found: ${root}`);
  console.error('Run: VITE_BASE_PATH=/admin/ npm run build -w @ai-consultant/web-admin');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);

  if (
    pathname === '/health' ||
    pathname === '/health.txt' ||
    pathname === `${basePath.slice(0, -1)}/health.txt` ||
    pathname === `${basePath}health.txt`
  ) {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('ok');
    return;
  }

  const filePath = resolveFile(pathname);
  if (!filePath) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  sendFile(res, filePath);
});

server.listen(port, host, () => {
  console.log(`SPA static server [${spaApp}] base=${basePath} root=${root}`);
  console.log(`Listening on http://${host}:${port}`);
});
