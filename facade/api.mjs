#!/usr/bin/env node
// api.mjs: an HTTP door over a pharos log — the "mini-site DB" surface as a query + write API.
// Reads (EOQL, SQL, compile, catalog, formats, dialects, views, who) are open, standpoint-scoped, and never decrypt sealed bodies.
// Writes (say, forget, view) require challenge-signature authentication against the writer's pinned device key (sign.mjs).
// Binds 127.0.0.1 by default and does NOT terminate TLS: expose it only through a trusted network (Tailscale/WireGuard) or a
// reverse proxy. The door holds no secret itself; it verifies against public keys only.
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { libs, openRead } from './store.mjs';
import { openLog, say, forget, forgetPermanent, ask, who, defineView, VERBS } from './db.mjs';
import { lend, give as giveGrant, revoke, group, permissions, disclose } from './grant.mjs';
import { renderSiteHtml } from './site.mjs';
import * as SG from './sign.mjs';
import * as AK from './apikeys.mjs';

let E = null;
async function load() { if (!E) ({ E } = await libs()); }

const MAX_BODY = 1024 * 1024;
const NONCE_TTL_MS = 60_000;

export async function serve(dir, opts = {}) {
  await load();
  dir = path.resolve(dir);
  const host = opts.host === undefined ? '127.0.0.1' : opts.host;
  const site = !!opts.site;
  const nonces = new Map();   // nonce -> expiry (transient, in memory: not the log, not a database)
  const www = opts.www ? path.resolve(opts.www) : null;
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };
  const serveStatic = (res, url) => {
    if (!www) return false;
    let rel = url === '/' ? '/index.html' : decodeURIComponent(url.split('?')[0]);
    rel = rel.replace(/^\/+/, '');
    const full = path.resolve(www, rel);
    if (full !== path.resolve(www) && !full.startsWith(path.resolve(www) + path.sep)) return false;
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return false;
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream', 'Content-Length': fs.statSync(full).size, 'Cache-Control': 'no-store' });
    res.end(fs.readFileSync(full));
    return true;
  };

  const send = (res, code, obj) => { const b = JSON.stringify(obj); res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b), 'Cache-Control': 'no-store' }); res.end(b); };
  const fail = (res, code, message) => send(res, code, { error: { code, message } });

  const readJson = (req) => new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { reject(new Error('body over 1 MiB')); return; } chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { reject(new Error('body is not JSON')); } });
    req.on('error', reject);
  });

  // two ways to prove who you are: an API key (Authorization: Bearer eok_…, issued by POST /apikeys) or a challenge-signature
  // (GET /challenge, sign the nonce with your pinned device key, send x-writer / x-nonce / x-signature). Both yield a writer
  // and a set of rights; a read-only key may read but not write.
  const authed = (req) => {
    const auth = req.headers['authorization'] || '';
    const bm = /^Bearer\s+(\S+)$/i.exec(auth);
    if (bm) {
      const v = AK.verifyKey(dir, bm[1]);
      if (!v.ok) return { ok: false, code: 401, message: v.reason };
      return { ok: true, writer: v.writer, rights: v.rights, via: 'key' };
    }
    const writer = req.headers['x-writer'], nonce = req.headers['x-nonce'], sig = req.headers['x-signature'];
    if (!writer || !nonce || !sig) return { ok: false, code: 401, message: 'authenticate with an API key (Authorization: Bearer eok_…) or a challenge signature (x-writer, x-nonce, x-signature from /challenge)' };
    const exp = nonces.get(String(nonce));
    if (exp === undefined || Date.now() > exp) return { ok: false, code: 401, message: 'nonce is unknown or expired; get a fresh one from /challenge' };
    nonces.delete(String(nonce));   // one-time use
    if (!SG.verifySignature(dir, String(writer), String(nonce), String(sig))) return { ok: false, code: 403, message: `signature does not verify under the pinned key of writer ${writer}` };
    return { ok: true, writer: String(writer), rights: ['read', 'write'], via: 'signature' };
  };
  const mayWrite = (a) => a.ok && Array.isArray(a.rights) && a.rights.includes('write');

  const server = http.createServer(async (req, res) => {
    try {
      const url = (req.url || '').split('?')[0];
      if (req.method === 'GET') {
        if (site && url === '/') {
          const q = new URL(req.url, 'http://x');
          const html = await renderSiteHtml(dir, { reader: q.searchParams.get('as') || '*' });
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(html), 'Cache-Control': 'no-store' });
          res.end(html);
          return;
        }
        if (serveStatic(res, url)) return;
        if (url === '/health') return send(res, 200, { ok: true });
        if (url === '/') return send(res, 200, { routes: ['GET /health /formats /dialects /views /catalog /who /challenge /permissions /disclose /apikeys', 'POST /query /compile /say /forget /view /share /revoke /group /apikeys /apikeys/revoke'], auth: ['API key: Authorization: Bearer eok_…', 'challenge-signature: x-writer + x-nonce + x-signature'] });
        if (url === '/challenge') { const n = crypto.randomBytes(32).toString('base64url'); nonces.set(n, Date.now() + NONCE_TTL_MS); return send(res, 200, { nonce: n, expiresInMs: NONCE_TTL_MS, sign: `crypto.sign(null, Buffer.from(nonce), devicePrivateKey)` }); }
        if (url === '/formats') return send(res, 200, E.formats());
        if (url === '/dialects') return send(res, 200, E.dialects());
        if (url === '/views') { const h = openRead(dir); try { return send(res, 200, E.views.list(h)); } finally { E.close(h); } }
        if (url === '/catalog') { const h = openRead(dir); try { return send(res, 200, E.sqlCatalog(h)); } finally { E.close(h); } }
        if (url === '/who') return send(res, 200, await who(dir));
        if (url === '/permissions') { const q = new URL(req.url, 'http://x'); const r = q.searchParams.get('reader'); if (!r) return fail(res, 400, '?reader=NAME is required'); return send(res, 200, await permissions(dir, r)); }
        if (url === '/disclose') { const q = new URL(req.url, 'http://x'); const r = q.searchParams.get('reader'), a = q.searchParams.get('addr'); if (!r || !a) return fail(res, 400, '?reader=NAME&addr=ADDR are required'); return send(res, 200, await disclose(dir, r, a)); }
        if (url === '/apikeys') { const a = authed(req); if (!a.ok) return fail(res, a.code, a.message); return send(res, 200, AK.listKeys(dir)); }
        return send(res, 404, { error: { code: 'E_NOT_FOUND', message: `no route GET ${url}` } });
      }
      if (req.method !== 'POST') return send(res, 405, { error: { code: 'E_NOT_FOUND', message: `no route ${req.method} ${url}` } });

      const body = await readJson(req);

      if (url === '/query') {
        const language = body.language === undefined ? 'eoql' : String(body.language);
        if (typeof body.query !== 'string' || !body.query) return fail(res, 400, 'body needs { query: "..." }');
        let text = body.query, params = body.params || {};
        if (language === 'sql') {
          const h = openRead(dir);
          let tr; try { tr = E.parseSql(body.query, { catalog: h }); } finally { E.close(h); }
          if (!tr.ok) return send(res, 422, { ok: false, eoql: tr.eoql, gaps: [...new Set(tr.gaps.map((g) => g.gap))], detail: tr.gaps });
          text = tr.eoql;
          params = Object.fromEntries((tr.params || []).map((k) => [k, params[k] === undefined ? null : params[k]]));
        } else if (language !== 'eoql') return fail(res, 400, `unknown language "${language}" (eoql or sql)`);
        const { envelope, card: c } = await ask(dir, text, { params, now: body.now, as: body.as, horizon: body.horizon, cached: !!body.cached, mark: false });
        return send(res, 200, { card: c, envelope });
      }

      if (url === '/compile') {
        if (typeof body.query !== 'string' || typeof body.to !== 'string') return fail(res, 400, 'body needs { query, to }');
        return send(res, 200, E.compile(body.query, { to: body.to, strict: !!body.strict }));
      }

      // ---- writes: authenticated ----
      const a = authed(req);
      if (!a.ok) return fail(res, a.code, a.message);
      if (!mayWrite(a)) return fail(res, 403, 'this API key is read-only');

      if (url === '/apikeys') {
        const w = body.writer === undefined ? a.writer : body.writer;
        if (w !== a.writer) return fail(res, 403, 'you can only issue API keys for your own writer');
        const r = AK.issueKey(dir, { name: body.name, writer: w, rights: body.rights, expires: body.expires || null });
        return send(res, 201, { raw: r.raw, key: r.key });
      }
      if (url === '/apikeys/revoke') {
        if (typeof body.id !== 'string') return fail(res, 400, 'body needs { id }');
        return send(res, 200, AK.revokeKey(dir, body.id));
      }

      if (url === '/say') {
        if (!VERBS[body.verb]) return fail(res, 400, `unknown verb "${body.verb}"`);
        if (typeof body.addr !== 'string' || !body.addr) return fail(res, 400, 'an address is required');
        const h = await openLog({ dir, writer: a.writer });
        const e = await say(h, body.verb, body.addr, body.body === undefined ? null : body.body, { of: body.of || [], seal: !!body.seal });
        return send(res, 200, { id: e.id, cell: e.cell, kind: e.kind, addr: e.addr, sealed: !!body.seal });
      }
      if (url === '/forget') {
        if (typeof body.addr !== 'string' || !body.addr) return fail(res, 400, 'an address is required');
        const h = await openLog({ dir, writer: a.writer });
        const r = body.permanent ? await forgetPermanent(h, body.addr) : await forget(h, body.addr);
        return send(res, 200, r);
      }
      if (url === '/view') {
        if (typeof body.name !== 'string' || typeof body.expr !== 'string') return fail(res, 400, 'body needs { name, expr }');
        return send(res, 200, await defineView(dir, a.writer, body.name, body.expr, { params: body.params || [] }));
      }
      if (url === '/share') {
        if (!body.to) return fail(res, 400, 'a subject (to) is required: a writer, group:<name>, or *');
        const o = { to: body.to, scope: body.scope, can: body.can, until: body.until, for: body.for, basis: body.basis };
        const h = await openLog({ dir, writer: a.writer });
        const e = body.give ? await giveGrant(h, o) : await lend(h, o);
        return send(res, 200, { id: e.id, addr: e.addr, from: a.writer, to: body.to, gift: !!body.give });
      }
      if (url === '/revoke') {
        if (typeof body.id !== 'string') return fail(res, 400, 'body needs { id } (a grant id or address)');
        const h = await openLog({ dir, writer: a.writer });
        const e = await revoke(h, body.id);
        return send(res, 200, { revoked: body.id, retraction: e.id });
      }
      if (url === '/group') {
        if (typeof body.name !== 'string' || !Array.isArray(body.members)) return fail(res, 400, 'body needs { name, members: [...] }');
        const h = await openLog({ dir, writer: a.writer });
        const e = await group(h, body.name, body.members);
        return send(res, 200, { name: body.name, members: body.members, id: e.id });
      }
      return send(res, 404, { error: { code: 'E_NOT_FOUND', message: `no route POST ${url}` } });
    } catch (e) {
      const msg = String(e && e.message ? e.message : e);
      if (msg === 'body over 1 MiB') return fail(res, 413, msg);
      if (msg === 'body is not JSON') return fail(res, 400, msg);
      return fail(res, 500, msg);
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', (e) => reject(e));
    server.listen(opts.port || 0, host, () => {
      const port = server.address().port;
      resolve({ port, close: () => new Promise((r) => { server.close(() => r()); if (server.closeAllConnections) server.closeAllConnections(); }) });
    });
  });
}

async function main(argv) {
  const flags = {}; const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); const nxt = argv[i + 1]; if (nxt === undefined || nxt.startsWith('--')) flags[k] = true; else { flags[k] = nxt; i++; } continue; }
    pos.push(a);
  }
  if (!flags.dir) { console.error('usage: node api.mjs --dir D [--port N] [--host H] [--www DIR]'); process.exit(2); }
  const s = await serve(flags.dir, { port: flags.port ? Number(flags.port) : 0, host: flags.host, www: flags.www });
  process.stdout.write(JSON.stringify({ listening: `${flags.host || '127.0.0.1'}:${s.port}`, note: 'bind 127.0.0.1 and reach it through a trusted network (Tailscale/WireGuard) or a reverse proxy' }) + '\n');
  const stop = async () => { await s.close(); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  await new Promise(() => {});
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main(process.argv.slice(2)).catch((e) => { console.error(JSON.stringify({ error: String(e.message || e) })); process.exit(1); });
}
