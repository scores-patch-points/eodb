#!/usr/bin/env node
// mailbox.mjs: the dumb-pipe carrier — a mailbox server for sealed pharos segments (SYNC.md §4, SYNC-CLOUD.md).
// Contract: list / get / putNew over immutable named objects. Never overwrite. Hold ciphertext only.
// On top of the client's own sealing, objects are encrypted at rest under a carrier master key, and DELETE "shuffles
// the bits" (overwrites with random, fsync, unlink) before removal. Quota-bounded (default 1 TB).
//
//   PUT    /v1/objects/:name      putNew  (token)   body = the object's bytes (already sealed upstream); 409 if present
//   GET    /v1/objects/:name      get      (open*)  returns the plaintext of the stored object
//   GET    /v1/list?prefix=p      list     (open*)  { objects: [{ name, size }] } under the prefix
//   DELETE /v1/objects/:name      shred    (token)  overwrite-with-random, fsync, unlink
//   GET    /health                status + quota
//   * reads are open by default because the bytes are sealed ciphertext; --private gates GET/list behind the token too
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const MAX_OBJECT = 64 * 1024 * 1024;      // largest single object (hard cap, per request)
const NAME_RE = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/;

function validName(name) {
  if (!name || name.length > 512 || name.startsWith('.') || name.includes('..') || name.includes('//')) return false;
  return NAME_RE.test(name);
}
const constEq = (a, b) => {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  if (x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
};

// ---- encryption at rest ------------------------------------------------------------------------------------------------
function loadKey(opts, datadir) {
  if (opts.keyFile) return Buffer.from(fs.readFileSync(opts.keyFile, 'utf8').trim(), 'hex');
  if (process.env.MAILBOX_KEY) return Buffer.from(process.env.MAILBOX_KEY.trim(), 'hex');
  const f = path.join(datadir, 'master.key');
  if (fs.existsSync(f)) return Buffer.from(fs.readFileSync(f, 'utf8').trim(), 'hex');
  const k = crypto.randomBytes(32);
  fs.mkdirSync(datadir, { recursive: true });
  fs.writeFileSync(f, k.toString('hex'), { mode: 0o600 });
  return k;
}
function seal(key, name, plain) {
  const nonce = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, nonce);
  c.setAAD(Buffer.from(name));                                  // bind ciphertext to its name: it cannot be moved
  const ct = Buffer.concat([c.update(plain), c.final()]);
  return JSON.stringify({ v: 1, nonce: nonce.toString('hex'), ct: ct.toString('hex'), tag: c.getAuthTag().toString('hex') });
}
function open(key, name, blob) {
  const b = JSON.parse(blob);
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(b.nonce, 'hex'));
  d.setAAD(Buffer.from(name));
  d.setAuthTag(Buffer.from(b.tag, 'hex'));
  return Buffer.concat([d.update(Buffer.from(b.ct, 'hex')), d.final()]);
}

// ---- storage walking ---------------------------------------------------------------------------------------------------
function walk(dir, rel = '', out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = rel ? `${rel}/${e.name}` : e.name;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, p, out);
    else out.push({ name: p, size: fs.statSync(full).size, full });
  }
  return out;
}
// shuffle the bits: overwrite the stored ciphertext with random bytes, sync, then remove (best-effort on SSD/COW, see note)
function shred(full) {
  const size = fs.statSync(full).size;
  const fd = fs.openSync(full, 'r+');
  const buf = crypto.randomBytes(1024 * 1024);
  let at = 0;
  while (at < size) { const n = Math.min(buf.length, size - at); fs.writeSync(fd, buf, 0, n, at); at += n; }
  fs.fsyncSync(fd);
  fs.closeSync(fd);
  fs.unlinkSync(full);
}

export function serve(opts = {}) {
  const datadir = path.resolve(opts.datadir || './mailbox');
  const objectsDir = path.join(datadir, 'objects');
  fs.mkdirSync(objectsDir, { recursive: true });
  const key = loadKey(opts, datadir);
  const token = opts.token || null;
  const private_ = !!opts.private;
  const quota = opts.quota || 1_000_000_000_000;                 // 1 TB
  let used = walk(objectsDir).reduce((n, o) => n + o.size, 0);

  const send = (res, code, obj, ct = 'application/json') => { const b = Buffer.isBuffer(obj) ? obj : Buffer.from(JSON.stringify(obj)); res.writeHead(code, { 'Content-Type': ct, 'Content-Length': b.length, 'Cache-Control': 'no-store' }); res.end(b); };
  const fail = (res, code, message) => send(res, code, { error: { code, message } });
  const authed = (req) => !!token && constEq(req.headers.authorization, `Bearer ${token}`);

  const server = http.createServer((req, res) => {
    try {
      const u = (req.url || '').split('?')[0];
      const q = new URL(req.url || '/', 'http://x').searchParams;
      const m = u.match(/^\/v1\/objects\/(.+)$/);
      const name = m ? m[1] : null;

      if (u === '/health') return send(res, 200, { ok: true, quota, used, free: quota - used, objects: 0, keyFile: path.join(datadir, 'master.key') });
      if (u === '/') return send(res, 200, { routes: ['PUT /v1/objects/:name', 'GET /v1/objects/:name', 'GET /v1/list?prefix=', 'DELETE /v1/objects/:name', 'GET /health'] });

      if (u === '/v1/list') {
        if (private_ && !authed(req)) return fail(res, 401, 'token required');
        const prefix = q.get('prefix') || '';
        const objs = walk(objectsDir).filter((o) => o.name.startsWith(prefix)).map((o) => ({ name: o.name, size: o.size }));
        return send(res, 200, { objects: objs });
      }

      if (name !== null) {
        if (!validName(name)) return fail(res, 400, 'bad object name');
        const full = path.join(objectsDir, name);

        if (req.method === 'GET') {
          if (private_ && !authed(req)) return fail(res, 401, 'token required');
          if (!fs.existsSync(full)) return fail(res, 404, 'no such object');
          let plain;
          try { plain = open(key, name, fs.readFileSync(full, 'utf8')); } catch { return fail(res, 500, 'object failed to decrypt (wrong key or tampered)'); }
          return send(res, 200, plain, 'application/octet-stream');
        }

        if (req.method === 'PUT') {
          if (!authed(req)) return fail(res, 401, 'token required');
          if (fs.existsSync(full)) return fail(res, 409, 'object already exists (immutable: never overwrite)');
          const chunks = []; let size = 0, over = false;
          req.on('data', (c) => { size += c.length; if (size > MAX_OBJECT) { over = true; return; } chunks.push(c); });
          req.on('end', () => {
            try {
              if (over) return fail(res, 413, `object over ${MAX_OBJECT} bytes`);
              const plain = Buffer.concat(chunks);
              const blob = seal(key, name, plain);
              if (used + blob.length > quota) return fail(res, 413, 'quota exceeded');
              fs.mkdirSync(path.dirname(full), { recursive: true });
              fs.writeFileSync(full, blob, { flag: 'wx' });
              used += blob.length;
              send(res, 201, { name, size: plain.length, stored: blob.length });
            } catch (e) { fail(res, 500, String(e.message || e)); }
          });
          req.on('error', (e) => fail(res, 500, String(e.message || e)));
          return;
        }

        if (req.method === 'DELETE') {
          if (!authed(req)) return fail(res, 401, 'token required');
          if (!fs.existsSync(full)) return fail(res, 404, 'no such object');
          used -= fs.statSync(full).size;
          shred(full);
          return send(res, 200, { name, shredded: true });
        }
        return fail(res, 405, `no route ${req.method} ${u}`);
      }
      return fail(res, 404, 'no route');
    } catch (e) { fail(res, 500, String(e.message || e)); }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(opts.port || 0, opts.host || '127.0.0.1', () => resolve({ port: server.address().port, close: () => new Promise((r) => { server.close(() => r()); if (server.closeAllConnections) server.closeAllConnections(); }) }));
  });
}

async function main(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); const nxt = argv[i + 1]; if (nxt === undefined || nxt.startsWith('--')) flags[k] = true; else { flags[k] = nxt; i++; } continue; }
  }
  if (flags.help) { console.log('usage: node mailbox.mjs --datadir /mnt/mailbox [--token T] [--quota BYTES] [--key-file F | MAILBOX_KEY=hex] [--port N] [--private]\n  default quota 1 TB; reads are open (sealed ciphertext) unless --private.'); return; }
  const s = await serve({ datadir: flags.datadir, token: flags.token, quota: flags.quota ? Number(flags.quota) : undefined, keyFile: flags['key-file'], private: !!flags.private, port: flags.port ? Number(flags.port) : 0 });
  process.stdout.write(JSON.stringify({ listening: `127.0.0.1:${s.port}`, datadir: flags.datadir || './mailbox', note: 'expose through Cloudflare Tunnel / nginx; this server binds loopback' }) + '\n');
  const stop = async () => { await s.close(); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  await new Promise(() => {});
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main(process.argv.slice(2));
