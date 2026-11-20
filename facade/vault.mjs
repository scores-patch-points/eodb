// vault.mjs: sealed bodies, a key store, and key destruction. Node's built-in crypto only (AES-256-GCM, SHA-256).
// Layout next to a log directory D:
//   D.bodies/<bodyc>      the sealed body: nonce, ciphertext, tag (no salt, no plaintext)
//   D.keys/obj/<bodyc>.key  one 32-byte key per sealed object (mode 0600), kept OUTSIDE the log and meant to be left out of backups
// A sealed entry's body in the log is only { sealed: 2, bodyc } where bodyc = sha256(salt || body), the salt being kept inside the
// encrypted part. So the log holds a hiding commitment, never the content, and deleting the key makes the ciphertext unreadable.
// The AEAD binds the entry's cell, kind, address and bodyc as associated data, so a ciphertext cannot be moved to another entry.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const paths = (dir, keysDir) => ({ bodies: path.resolve(dir) + '.bodies', keys: keysDir ? path.resolve(keysDir) : path.resolve(dir) + '.keys' });
const canon = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x));
const aad = (hd, bodyc) => Buffer.from(`${hd.cell}|${hd.kind}|${hd.addr}|${bodyc}`);
const PAD = [256, 1024, 4096, 16384, 65536, 262144, 1048576];   // size classes: ciphertext length reveals only the class

export function seal(dir, header, body, { keysDir } = {}) {
  const p = paths(dir, keysDir);
  fs.mkdirSync(path.join(p.keys, 'obj'), { recursive: true, mode: 0o700 }); fs.mkdirSync(p.bodies, { recursive: true });
  const salt = crypto.randomBytes(16).toString('hex');
  const bodyc = crypto.createHash('sha256').update(salt + canon(body)).digest('hex');
  let plain = JSON.stringify({ salt, body });
  const cls = PAD.find((c) => plain.length + 16 <= c) || plain.length + 16;
  plain = plain + ' '.repeat(cls - plain.length);   // trailing spaces are valid JSON whitespace
  const key = crypto.randomBytes(32), iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv); c.setAAD(aad(header, bodyc));
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  fs.writeFileSync(path.join(p.bodies, bodyc), JSON.stringify({ v: 2, iv: iv.toString('hex'), ct: ct.toString('hex'), tag: c.getAuthTag().toString('hex') }));
  fs.writeFileSync(path.join(p.keys, 'obj', bodyc + '.key'), key, { mode: 0o600 });
  return { sealed: 2, bodyc };
}

// open: returns { ok: true, body } or { ok: false, reason: 'key-missing' | 'body-missing' | 'tampered' }
export function open(dir, header, sealedBody, { keysDir } = {}) {
  const p = paths(dir, keysDir); const bodyc = sealedBody.bodyc;
  const kf = path.join(p.keys, 'obj', bodyc + '.key'), bf = path.join(p.bodies, bodyc);
  if (!fs.existsSync(kf)) return { ok: false, reason: 'key-missing' };
  if (!fs.existsSync(bf)) return { ok: false, reason: 'body-missing' };
  try {
    const b = JSON.parse(fs.readFileSync(bf, 'utf8')), key = fs.readFileSync(kf);
    const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(b.iv, 'hex')); d.setAAD(aad(header, bodyc)); d.setAuthTag(Buffer.from(b.tag, 'hex'));
    const plain = JSON.parse(Buffer.concat([d.update(Buffer.from(b.ct, 'hex')), d.final()]).toString('utf8'));
    const check = crypto.createHash('sha256').update(plain.salt + canon(plain.body)).digest('hex');
    if (check !== bodyc) return { ok: false, reason: 'tampered' };
    return { ok: true, body: plain.body };
  } catch { return { ok: false, reason: 'tampered' }; }
}

// destroyKey: overwrite with zeros, flush, unlink, and confirm. NOTE: on an SSD or a snapshotted volume an overwrite does not
// guarantee the old bytes are gone from the medium; that is why the key must live outside backups and snapshots (see README).
export function destroyKey(dir, bodyc, { keysDir } = {}) {
  const kf = path.join(paths(dir, keysDir).keys, 'obj', bodyc + '.key');
  if (!fs.existsSync(kf)) return false;
  const fd = fs.openSync(kf, 'r+'); fs.writeSync(fd, Buffer.alloc(fs.fstatSync(fd).size)); fs.fsyncSync(fd); fs.closeSync(fd);
  fs.unlinkSync(kf);
  return !fs.existsSync(kf);
}
export function removeBlob(dir, bodyc) {
  const bf = path.join(paths(dir).bodies, bodyc);
  if (!fs.existsSync(bf)) return false;
  fs.unlinkSync(bf); return !fs.existsSync(bf);
}
export const hasKey = (dir, bodyc, o = {}) => fs.existsSync(path.join(paths(dir, o.keysDir).keys, 'obj', bodyc + '.key'));
export const hasBlob = (dir, bodyc) => fs.existsSync(path.join(paths(dir).bodies, bodyc));
