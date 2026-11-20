// identity: who wrote what, provable by anyone holding the log. Portable (core.mjs only); the signature algorithm is injected
// (lib/identity-node.mjs supplies Ed25519 from node:crypto; a browser supplies WebCrypto or a small library with the same three calls).
//
// Nothing about entries changes: an entry's id is still the hash of its content. Authenticity rides in two kinds of ordinary entries.
//
//   device-key   DEF·Pattern   body { writer, pub, grantedBy, sig }       "this public key may speak as <writer>"
//                              sig = sign(grantedBy's key, "pharos-key/1\n<log>\n<writer>\n<pub>")
//                              Self-contained: checked against the granting key, so it needs no signature of its own.
//   signature    EVA·Pattern   body { key, ids:[...], sig }               "this key vouches for these entries"
//                              sig = sign(key, "pharos-sig/1\n<log>\n<sorted ids joined by \n>")  (one signature covers a whole batch)
//
// Trust starts from ROOTS: public keys the reader chooses to believe (the log's founder, an organisation, yourself). A key is
// AUTHORIZED if it is a root, or if an authorized key granted it. An entry COUNTS if some authorized key, granted for the entry's
// writer, vouched for it. Everything else is still held (the log is grow-only) but reported as not counted, with the reason.
// Retracting a device-key entry revokes the key; signatures by a revoked key stop counting (strict: no time cut yet).
import * as core from './core.mjs';

let impl = null;
/** inject { generate() -> {pub, priv} hex, fromSeed(seedHex) -> {pub, priv}, sign(privHex, bytes) -> hex, verify(pubHex, bytes, sigHex) -> bool } */
export function useCrypto(i) { impl = i; }
const need = () => { if (!impl) throw new core.PharosError('NO_CRYPTO', 'no signature provider: import lib/identity-node.mjs (Node) or call useCrypto()'); return impl; };
// does pattern p cover name (or narrower pattern) w? '*' covers all; 'alice.*' covers 'alice.phone' and 'alice.x.*'; a name covers itself
export function covers(p, w) {
  if (p === '*' || p === w) return true;
  if (!p.endsWith('*')) return false;
  return w.startsWith(p.slice(0, -1));
}
const enc = (s) => new TextEncoder().encode(s);

export const generateKey = () => need().generate();
export const keyFromSeed = (seedHex) => need().fromSeed(seedHex);
export const signBytes = (priv, bytes) => need().sign(priv, bytes);
export const verifyBytes = (pub, bytes, sig) => { try { return need().verify(pub, bytes, sig); } catch (err) { return false; } };
const keyMsg = (log, writer, pub) => enc(`pharos-key/1\n${log}\n${writer}\n${pub}`);
const sigMsg = (log, ids) => enc(`pharos-sig/1\n${log}\n${[...ids].sort().join('\n')}`);

/** declare the two kinds this module weaves (idempotent) */
export function ensureKinds(h) { declare(h, 'device-key', 'DEF·Pattern'); declare(h, 'signature', 'EVA·Pattern'); }
function declare(h, kind, cell) {
  const have = core.entries(h).some((e) => e.kind === 'kind' && e.body && e.body.name === kind);
  if (!have) core.weave(h, { cell: 'DEF·Figure', kind: 'kind', addr: `kind:${kind}`, body: { name: kind, cell } });
}

/** weave a grant: `grantor` (a {pub, priv} that is a root or already authorized) lets `pub` speak as `writer` */
export function grant(h, grantor, writer, pub) {
  declare(h, 'device-key', 'DEF·Pattern');
  const sig = need().sign(grantor.priv, keyMsg(h.name, writer, pub));
  return core.weave(h, { cell: 'DEF·Pattern', kind: 'device-key', addr: `device-key:${writer}:${pub.slice(0, 16)}`, body: { writer, pub, grantedBy: grantor.pub, sig } });
}

/** sign exactly these entry ids with `key` (one batch signature entry) */
export function signIds(h, key, ids) {
  declare(h, 'signature', 'EVA·Pattern');
  const todo = [...ids].sort(); if (!todo.length) return { signed: 0 };
  const entry = core.weave(h, { cell: 'EVA·Pattern', kind: 'signature', addr: `signature:${key.pub.slice(0, 16)}:${todo[0].slice(0, 12)}`, body: { key: key.pub, ids: todo, sig: need().sign(key.priv, sigMsg(h.name, todo)) } });
  return { signed: todo.length, entry };
}

/** sign every entry this replica wrote that no signature of this key covers yet; returns { signed } */
export function signNew(h, key, { writer = h.writer } = {}) {
  declare(h, 'signature', 'EVA·Pattern');
  const live = core.entries(h);
  const covered = new Set();
  for (const e of live) if (e.kind === 'signature' && e.body && e.body.key === key.pub) for (const id of e.body.ids || []) covered.add(id);
  const todo = live.filter((e) => e.by === writer && e.kind !== 'signature' && e.kind !== 'device-key' && !covered.has(e.id)).map((e) => e.id);
  if (!todo.length) return { signed: 0 };
  core.weave(h, { cell: 'EVA·Pattern', kind: 'signature', addr: `signature:${key.pub.slice(0, 16)}:${todo[0].slice(0, 12)}`, body: { key: key.pub, ids: todo.sort(), sig: need().sign(key.priv, sigMsg(h.name, todo)) } });
  return { signed: todo.length };
}

/**
 * @param roots  { <pub hex>: <writer pattern> }  keys believed from the start, and who each may speak as: a writer name, a prefix pattern
 *               such as 'alice.*' (one person, many devices, each device its own writer lane), or '*' (a founder: anyone)
 * @returns { counted:Set<id>, uncounted:[{id, why}], keys: Map<pub, Set<pattern>> }
 * A grant can only narrow: a key may grant names its own patterns cover, never more.
 */
export function verifyLog(h, { roots = {} } = {}) {
  const I = need();
  const live = core.fold(h).entries; // retractions applied: a retracted grant is gone
  const keys = new Map(); // pub -> Set(writer) or '*'
  for (const [pub, w] of Object.entries(roots)) keys.set(pub, new Set([w]));
  const mayRoot = (pub, writer) => { const k = keys.get(pub); return !!k && [...k].some((p) => covers(p, writer)); };
  const grants = live.filter((e) => e.kind === 'device-key' && e.body && typeof e.body.pub === 'string');
  // fixpoint over grants: a grant counts once its grantor is authorized for that writer and the signature is right
  for (let changed = true; changed;) {
    changed = false;
    for (const g of grants) {
      const { writer, pub, grantedBy, sig } = g.body;
      if (!mayRoot(grantedBy, writer)) continue;
      let ok = false; try { ok = I.verify(grantedBy, keyMsg(h.name, writer, pub), sig); } catch (err) { ok = false; }
      if (!ok) continue;
      const set = keys.get(pub) || new Set(); if (!set.has(writer)) { set.add(writer); keys.set(pub, set); changed = true; }
    }
  }
  const vouched = new Map(); // id -> [{key, valid}]
  for (const s of live.filter((e) => e.kind === 'signature' && e.body && Array.isArray(e.body.ids))) {
    let valid = false; try { valid = I.verify(s.body.key, sigMsg(h.name, s.body.ids), s.body.sig); } catch (err) { valid = false; }
    for (const id of s.body.ids) (vouched.get(id) || vouched.set(id, []).get(id)).push({ key: s.body.key, valid });
  }
  const counted = new Set(), uncounted = [];
  for (const e of live) {
    if (e.kind === 'signature' || e.kind === 'device-key') continue; // self-authenticating
    const v = vouched.get(e.id) || [];
    if (!v.length) { uncounted.push({ id: e.id, why: 'unsigned' }); continue; }
    const good = v.find((x) => x.valid && mayRoot(x.key, e.by));
    if (good) { counted.add(e.id); continue; }
    uncounted.push({ id: e.id, why: v.some((x) => !x.valid) && !v.some((x) => x.valid) ? 'bad signature' : v.some((x) => x.valid && keys.has(x.key)) ? 'signer may not speak as this writer' : 'signer not authorized' });
  }
  return { counted, uncounted, keys };
}
