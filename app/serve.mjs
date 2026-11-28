// serve.mjs: the app and its blind relay on ONE origin, so a single HTTPS tunnel (ngrok, tailscale serve, …)
// reaches both. Serves the static page and speaks the same three calls as relay.mjs (list / get / create-only put),
// on the same host:port. The relay stores sealed bytes and never reads them. It ALSO proxies an OpenCode server at
// /oc/* so a phone driving the app reaches opencode through this one origin (server holds the password; no CORS issue).
//
//   node app/serve.mjs [port]          -> http://0.0.0.0:<port>   (page + relay + opencode proxy)
//   EODB_OPENCODE_URL=http://127.0.0.1:4096 EODB_OPENCODE_PASSWORD=pw node app/serve.mjs 8852
//   ngrok http <port>                  -> https://<host>.ngrok.app (all of it, over HTTPS)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildExtension } from '../extension/package.mjs';
import { smtpSend, imapFetch } from './mail.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const MAX = 8 * 1024 * 1024;
const store = new Map();
let extensionZip = null;
const OC_URL = process.env.EODB_OPENCODE_URL || 'http://127.0.0.1:4096';
const OC_USER = process.env.EODB_OPENCODE_USERNAME || 'opencode';
const OC_PASS = process.env.EODB_OPENCODE_PASSWORD || '';
// email: the server holds the app password; the browser only ever names "fetch" or "send".
const MAIL = {
  host: process.env.EODB_MAIL_HOST || 'smtp.gmail.com',
  imapHost: process.env.EODB_MAIL_IMAP_HOST || 'imap.gmail.com',
  user: process.env.EODB_MAIL_USER || '',
  pass: process.env.EODB_MAIL_PASS || '',
  from: process.env.EODB_MAIL_FROM || process.env.EODB_MAIL_USER || '',
};
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, PUT, OPTIONS',
  'access-control-allow-headers': '*',
  'access-control-max-age': '600',
};
const MIME = { '.html': 'text/html; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.map': 'application/json' };
const send = (res, code, body, type = 'text/plain') => { res.writeHead(code, { ...CORS, 'content-type': type }); res.end(body); };

/** proxy /oc/* to the OpenCode server, injecting Basic auth and streaming (SSE) responses through unchanged. */
function proxyOc(req, res, target) {
  const headers = { ...req.headers, host: new URL(OC_URL).host };
  if (OC_PASS) headers.authorization = 'Basic ' + Buffer.from(`${OC_USER}:${OC_PASS}`).toString('base64');
  delete headers['content-length'];
  const preq = http.request(target, { method: req.method, headers }, (pres) => {
    res.writeHead(pres.statusCode || 502, { ...CORS, ...pres.headers, connection: 'close' });
    pres.pipe(res);
  });
  preq.on('error', () => { if (!res.headersSent) send(res, 502, 'opencode unreachable'); });
  req.pipe(preq);
}

/** /mail/send + /mail/fetch: the server's own email bridge (app-password auth lives in env, never in the browser). */
function mail(req, res, u) {
  if (!MAIL.user || !MAIL.pass) return send(res, 503, 'email not configured (set EODB_MAIL_USER / EODB_MAIL_PASS)', 'application/json');
  if (u.pathname === '/mail/fetch' && req.method === 'GET') {
    const folder = (u.searchParams.get('folder') || 'INBOX');
    const limit = Number(u.searchParams.get('limit') || '20');
    return imapFetch({ host: MAIL.imapHost, user: MAIL.user, pass: MAIL.pass, folder, limit })
      .then((messages) => send(res, 200, JSON.stringify({ messages }), 'application/json'))
      .catch((e) => send(res, 502, JSON.stringify({ error: String(e && e.message || e) }), 'application/json'));
  }
  if (u.pathname === '/mail/send' && req.method === 'POST') {
    const chunks = []; req.on('data', (c) => chunks.push(c)); req.on('end', () => {
      let p = {}; try { p = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { /* bad json */ }
      if (!p.to || (!p.subject && !p.body)) return send(res, 400, JSON.stringify({ error: 'need to, subject/body' }), 'application/json');
      smtpSend({ host: MAIL.host, user: MAIL.user, pass: MAIL.pass, from: MAIL.from, to: p.to, subject: p.subject, body: p.body })
        .then((r) => send(res, 200, JSON.stringify({ sent: r.accepted }), 'application/json'))
        .catch((e) => send(res, 502, JSON.stringify({ error: String(e && e.message || e) }), 'application/json'));
    });
    return;
  }
  return send(res, 405, JSON.stringify({ error: 'method' }), 'application/json');
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, '');
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/health') return send(res, 200, 'ok');
  if (u.pathname.startsWith('/oc/')) return proxyOc(req, res, OC_URL.replace(/\/+$/, '') + u.pathname.slice(3) + u.search);
  if (u.pathname === '/mail/send' || u.pathname === '/mail/fetch') return mail(req, res, u);
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

export { server };

if (process.argv[1] && process.argv[1].endsWith('serve.mjs')) {
  const port = Number(process.argv[2] || 8852);
  server.listen(port, '0.0.0.0', () => console.log(`eodb (page + blind relay + opencode proxy) on http://0.0.0.0:${port} — tunnel this one port for HTTPS`));
}
