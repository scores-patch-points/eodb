// apikeys.mjs: API keys for programmatic clients (CLI, MCP, scripts). A key acts AS a writer with read or read+write rights.
// Stored OUTSIDE the log, beside the device keys, and only as a SHA-256 hash: the raw key is returned once at issue and
// never written down. Keys are revoked by deleting the record (grow-only logs do not apply here: this file is a local secret store).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const file = (dir) => path.join(path.resolve(dir) + '.keys', 'apikeys.json');
const now = () => new Date().toISOString();
const sha = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

function load(dir) { try { return JSON.parse(fs.readFileSync(file(dir), 'utf8')); } catch { return []; } }
function save(dir, keys) { fs.mkdirSync(path.dirname(file(dir)), { recursive: true, mode: 0o700 }); fs.writeFileSync(file(dir), JSON.stringify(keys, null, 2), { mode: 0o600 }); }

/** issue a key. `writer` is who the key acts as; `rights` is 'read' or 'read'+'write'; `expires` an ISO date or null. Returns the raw key ONCE. */
export function issueKey(dir, { name = '', writer, rights = ['read', 'write'], expires = null }) {
  if (!writer) throw new Error('an API key needs the writer it acts as');
  const raw = 'eok_' + crypto.randomBytes(32).toString('base64url');
  const key = { id: crypto.randomBytes(6).toString('base64url'), name: String(name), hash: sha(raw), writer, rights: rights.includes('write') ? ['read', 'write'] : ['read'], created: now(), expires: expires || null, lastUsed: null };
  save(dir, [...load(dir), key]);
  return { raw, key };
}

/** list keys without their hashes (the raw key and its hash are never returned after issue). */
export function listKeys(dir) { return load(dir).map(({ hash: _h, ...rest }) => rest); }

export function revokeKey(dir, id) {
  const keys = load(dir); const i = keys.findIndex((k) => k.id === id);
  if (i < 0) throw new Error(`no API key with id ${id}`);
  const [k] = keys.splice(i, 1); save(dir, keys);
  return { id: k.id, name: k.name };
}

/** verify a raw key. Returns { ok, writer, rights, id } or { ok:false, reason }. Rewrites lastUsed at most once a minute. */
export function verifyKey(dir, raw) {
  if (typeof raw !== 'string' || !raw.startsWith('eok_')) return { ok: false, reason: 'not an API key' };
  const h = sha(raw), keys = load(dir), k = keys.find((x) => x.hash === h);
  if (!k) return { ok: false, reason: 'unknown API key' };
  if (k.expires && Date.parse(k.expires) < Date.now()) return { ok: false, reason: 'API key expired' };
  if (!k.lastUsed || Date.now() - Date.parse(k.lastUsed) > 60_000) { k.lastUsed = now(); save(dir, keys); }
  return { ok: true, writer: k.writer, rights: k.rights, id: k.id, name: k.name };
}
