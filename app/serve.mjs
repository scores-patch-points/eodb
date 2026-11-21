// serve.mjs: the app and its blind relay on ONE origin, so a single HTTPS tunnel (ngrok, tailscale serve, …)
// reaches both. Serves the static page and speaks the same three calls as relay.mjs (list / get / create-only put),
// on the same host:port. The relay stores sealed bytes and never reads them.
//
//   node app/serve.mjs [port]          -> http://0.0.0.0:<port>   (page + relay)
//   ngrok http <port>                  -> https://<host>.ngrok.app (both, over HTTPS)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildExtension } from '../extension/package.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const MAX = 8 * 1024 * 1024;
const store = new Map();
let extensionZip = null;
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, PUT, OPTIONS',
  'access-control-allow-headers': '*',
  'access-control-max-age': '600',
};
const MIME = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.map': 'application/json' };
const send = (res, code, body, type = 'text/plain') => { res.writeHead(code, { ...CORS, 'content-type': type }); res.end(body); };

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, '');
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/health') return send(res, 200, 'ok');
  if (u.pathname === '/extension.zip') {   // build + serve the downloadable extension, once
    if (!extensionZip) { const r = buildExtension(path.join(dir, '..', 'extension', 'dist')); extensionZip = fs.readFileSync(r.file); }
    res.writeHead(200, { ...CORS, 'content-type': 'application/zip', 'content-length': extensionZip.length, 'content-disposition': 'attachment; filename="eodb-extension.zip"' });
    return res.end(extensionZip);
  }
  if (u.pathname === '/o') return req.method === 'GET' ? send(res, 200, JSON.stringify([...store.keys()]), 'application/json') : send(res, 405, '');
  const m = /^\/o\/(.+)$/.exec(u.pathname);
  if (m) {
    const name = decodeURIComponent(m[1]);
    if (req.method === 'GET') { const b = store.get(name); return b ? send(res, 200, b, 'application/octet-stream') : send(res, 404, 'no such object'); }
    if (req.method === 'PUT') {
      const chunks = []; let n = 0, dead = false;
      req.on('data', (c) => { n += c.length; if (n > MAX) { dead = true; send(res, 413, 'too large'); req.destroy(); } else chunks.push(c); });
      req.on('end', () => { if (dead) return; const body = Buffer.concat(chunks), have = store.get(name); if (have) return Buffer.compare(have, body) === 0 ? send(res, 200, 'same') : send(res, 409, 'exists with different bytes'); store.set(name, body); send(res, 201, 'created'); });
      return;
    }
    return send(res, 405, '');
  }
  // static
  const p = u.pathname === '/' ? '/index.html' : u.pathname;
  const f = path.normalize(path.join(dir, decodeURIComponent(p)));
  if (!f.startsWith(dir)) return send(res, 403, 'forbidden');
  fs.readFile(f, (err, data) => { if (err) return send(res, 404, 'not found'); send(res, 200, data, MIME[path.extname(f).toLowerCase()] || 'application/octet-stream'); });
});

const port = Number(process.argv[2] || 8852);
server.listen(port, '0.0.0.0', () => console.log(`eodb (page + blind relay) on http://0.0.0.0:${port} — tunnel this one port for HTTPS`));
