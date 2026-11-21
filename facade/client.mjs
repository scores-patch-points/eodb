// client.mjs: a tiny HTTP client over the API (facade/api.mjs), shared by the CLI and the MCP server. Two ways to authenticate:
//   - an API key  (Authorization: Bearer eok_…)  — the seamless path for scripts and other tools
//   - a challenge-signature  (--dir --writer)     — signs each nonce with the writer's device key on disk
// Reads are open; writes need one of the two. Everything returns parsed JSON or throws with `.status` and `.body`.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const keyFile = (dir, w) => path.join(path.resolve(dir) + '.keys', 'device', String(w).replace(/[^A-Za-z0-9._-]/g, '-') + '.key');

export function makeClient({ url, key, dir, writer } = {}) {
  const base = String(url || process.env.EO_URL || 'http://127.0.0.1:8853').replace(/\/+$/, '');
  const bearer = key || process.env.EO_KEY || null;

  const authHeaders = async () => {
    if (bearer) return { authorization: `Bearer ${bearer}` };
    if (dir && writer) {
      const f = keyFile(dir, writer);
      if (!fs.existsSync(f)) throw new Error(`no device key for "${writer}" at ${f}; pass --key <eok_…> or create the key first`);
      const ch = await fetch(`${base}/challenge`).then((r) => r.json());
      const sig = crypto.sign(null, Buffer.from(ch.nonce), crypto.createPrivateKey(fs.readFileSync(f, 'utf8'))).toString('base64');
      return { 'x-writer': writer, 'x-nonce': ch.nonce, 'x-signature': sig };
    }
    return {};
  };

  async function req(method, p, body) {
    const opts = { method, headers: { 'content-type': 'application/json', ...(await authHeaders()) } };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(base + p, opts);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(json && json.error ? json.error.message : `${method} ${p} -> HTTP ${res.status}`); e.status = res.status; e.body = json; throw e; }
    return json;
  }

  return {
    base,
    health: () => req('GET', '/health'),
    query: (query, o = {}) => req('POST', '/query', { query, ...o }),
    sql: (query, o = {}) => req('POST', '/query', { language: 'sql', query, ...o }),
    say: (verb, addr, body, o = {}) => req('POST', '/say', { verb, addr, body, ...o }),
    forget: (addr, permanent) => req('POST', '/forget', { addr, permanent }),
    who: () => req('GET', '/who'),
    catalog: () => req('GET', '/catalog'),
    views: () => req('GET', '/views'),
    formats: () => req('GET', '/formats'),
    permissions: (reader) => req('GET', `/permissions?reader=${encodeURIComponent(reader)}`),
    disclose: (reader, addr) => req('GET', `/disclose?reader=${encodeURIComponent(reader)}&addr=${encodeURIComponent(addr)}`),
    share: (o) => req('POST', '/share', o),
    revoke: (id) => req('POST', '/revoke', { id }),
    group: (name, members) => req('POST', '/group', { name, members }),
    apikeys: () => req('GET', '/apikeys'),
    issueKey: (o) => req('POST', '/apikeys', o),
    revokeKey: (id) => req('POST', '/apikeys/revoke', { id }),
  };
}
