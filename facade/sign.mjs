// sign.mjs: device-key signatures over entry ids, kept beside the log (the entries themselves are not changed, so no id changes).
//   <log>.keys/device/<writer>.key    the writer's ed25519 private key (PKCS8 PEM, mode 0600), outside the log and out of backups
//   <log>.sigs/pub/<writer>.pub       the writer's public key, pinned the first time it is seen (a different key later is "key changed")
//   <log>.sigs/<writer>.jsonl         one line per signed entry: { id, pk, sig }, appended when the entry is written
//   <log>.sigs/trusted.json           writers whose signed index snapshots this reader will adopt (an explicit act)
// The rule for the read path: signatures are NOT checked on ordinary reads. They are checked (1) when you ask for an audit (`verifyAll`), and
// (2) when a verified signature lets a reader skip work, namely adopting another writer's published SIG index instead of rebuilding its own.
// (2) is done only if the estimated cost of adopting is clearly below the cost of rebuilding; otherwise the reader rebuilds and verifies nothing.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Sig, position } from './sig.mjs';

const safe = (s) => String(s).replace(/[^A-Za-z0-9._-]/g, '-');
const P = (dir) => ({ keys: path.resolve(dir) + '.keys', sigs: path.resolve(dir) + '.sigs', sig: path.resolve(dir) + '.sig' });
const keyFile = (dir, w) => path.join(P(dir).keys, 'device', safe(w) + '.key');
const pubFile = (dir, w) => path.join(P(dir).sigs, 'pub', safe(w) + '.pub');
const rawPk = (pem) => crypto.createPublicKey(pem).export({ type: 'spki', format: 'der' }).toString('base64');

export const hasKey = (dir, w) => fs.existsSync(keyFile(dir, w));

// makeKey: create the writer's key once (never overwrites) and pin its public half.
export function makeKey(dir, w) {
  if (hasKey(dir, w)) return { created: false, pk: rawPk(fs.readFileSync(pubFile(dir, w), 'utf8')) };
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  fs.mkdirSync(path.dirname(keyFile(dir, w)), { recursive: true, mode: 0o700 }); fs.mkdirSync(path.dirname(pubFile(dir, w)), { recursive: true });
  fs.writeFileSync(keyFile(dir, w), privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  const pub = publicKey.export({ type: 'spki', format: 'pem' });
  fs.writeFileSync(pubFile(dir, w), pub);
  return { created: true, pk: rawPk(pub) };
}

const signed = new Map();   // per-process: sidecar ids already written, so a write does not rescan its sidecar
function sidecarIds(dir, w) {
  const k = `${path.resolve(dir)}|${w}`; if (signed.has(k)) return signed.get(k);
  const s = new Set(); const f = path.join(P(dir).sigs, safe(w) + '.jsonl');
  if (fs.existsSync(f)) for (const l of fs.readFileSync(f, 'utf8').split('\n')) { if (!l) continue; try { s.add(JSON.parse(l).id); } catch { /* torn */ } }
  signed.set(k, s); return s;
}
// signEntry: sign the entry id with the writer's key if it has one. Cheap (one ed25519 signature and one appended line).
export function signEntry(dir, w, id) {
  if (!hasKey(dir, w)) return false;
  const ids = sidecarIds(dir, w); if (ids.has(id)) return true;
  const sk = crypto.createPrivateKey(fs.readFileSync(keyFile(dir, w))), pk = rawPk(fs.readFileSync(pubFile(dir, w), 'utf8'));
  const sig = crypto.sign(null, Buffer.from(id), sk).toString('base64');
  fs.mkdirSync(P(dir).sigs, { recursive: true });
  fs.appendFileSync(path.join(P(dir).sigs, safe(w) + '.jsonl'), JSON.stringify({ id, pk, sig }) + '\n'); ids.add(id); return true;
}

// verifyAll: the audit. Every entry is "valid" (signed by the pinned key of its writer), "invalid" (a signature that does not verify),
// "key-changed" (signed by a key other than the pinned one), or "unsigned". Cost is about one signature check per signed entry.
export function verifyAll(dir, entries) {   // entries: [{ id, by }]
  const out = { valid: 0, invalid: 0, keyChanged: 0, unsigned: 0, problems: [] }; const bySig = new Map();
  for (const w of new Set(entries.map((e) => e.by))) {
    const f = path.join(P(dir).sigs, safe(w) + '.jsonl'); const m = new Map();
    if (fs.existsSync(f)) for (const l of fs.readFileSync(f, 'utf8').split('\n')) { if (!l) continue; try { const r = JSON.parse(l); m.set(r.id, r); } catch { /* torn */ } }
    bySig.set(w, m);
  }
  for (const e of entries) {
    const r = bySig.get(e.by)?.get(e.id);
    if (!r) { out.unsigned++; continue; }
    const pinned = fs.existsSync(pubFile(dir, e.by)) ? rawPk(fs.readFileSync(pubFile(dir, e.by), 'utf8')) : null;
    if (pinned && r.pk !== pinned) { out.keyChanged++; out.problems.push({ id: e.id, by: e.by, why: 'signed by a different key than the pinned one' }); continue; }
    let ok = false; try { ok = crypto.verify(null, Buffer.from(e.id), crypto.createPublicKey({ key: Buffer.from(r.pk, 'base64'), format: 'der', type: 'spki' }), Buffer.from(r.sig, 'base64')); } catch { ok = false; }
    if (ok) out.valid++; else { out.invalid++; out.problems.push({ id: e.id, by: e.by, why: 'signature does not verify' }); }
  }
  return out;
}

// ---- trust and published SIG indexes ----------------------------------------------------------------------------------------
const trustedFile = (dir) => path.join(P(dir).sigs, 'trusted.json');
export const trusted = (dir) => { try { return JSON.parse(fs.readFileSync(trustedFile(dir), 'utf8')); } catch { return []; } };
export function trust(dir, w) { const t = new Set(trusted(dir)); t.add(w); fs.mkdirSync(P(dir).sigs, { recursive: true }); fs.writeFileSync(trustedFile(dir), JSON.stringify([...t])); return [...t]; }

// publish: a writer signs a snapshot of its own SIG index together with the claim "complete to this position".
export function publishIndex(dir, w) {
  if (!hasKey(dir, w)) throw new Error(`${w} has no key; create one first`);
  const s = new Sig(dir, w); s.advance(); s.flush();
  const body = fs.readFileSync(s.file); const pos = position(dir);
  const digest = crypto.createHash('sha256').update(body).update(pos).digest('hex');
  const sig = crypto.sign(null, Buffer.from(digest), crypto.createPrivateKey(fs.readFileSync(keyFile(dir, w)))).toString('base64');
  fs.mkdirSync(P(dir).sig, { recursive: true });
  const out = path.join(P(dir).sig, `published-${safe(w)}.json`);
  fs.writeFileSync(out, JSON.stringify({ writer: w, claim: 'complete to this position', position: pos, digest, sig, pk: rawPk(fs.readFileSync(pubFile(dir, w), 'utf8')), state: body.toString('base64') }));     // the binary index, as text for the envelope
  return { file: out, position: pos, bytes: body.length };
}

// adoptIndex: take another writer's published index as your own, but only if (a) you trust the publisher, (b) the signature verifies under
// their pinned key, (c) the claim's position is exactly the log's position now, and (d) adopting is clearly cheaper than rebuilding.
// Costs are estimates in milliseconds per megabyte (defaults measured on one machine: a cold build about 10.7, reading a saved state about 9);
// override with `cost` to test the decision. Returns { adopted, reason, estimates }.
export function adoptIndex(dir, me, publisher, { cost = {}, margin = 0.7 } = {}) {
  const f = path.join(P(dir).sig, `published-${safe(publisher)}.json`);
  if (!fs.existsSync(f)) return { adopted: false, reason: 'nothing published by that writer' };
  if (!trusted(dir).includes(publisher)) return { adopted: false, reason: `${publisher} is not trusted by this reader (a reader must explicitly trust a publisher)` };
  const pub = JSON.parse(fs.readFileSync(f, 'utf8'));
  const logBytes = (() => { let n = 0; const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.jsonl')) n += fs.statSync(p).size; } }; walk(path.resolve(dir)); return n; })();
  const stateBin = Buffer.from(pub.state, 'base64'), stateBytes = stateBin.length;
  const coldMsPerMB = cost.coldMsPerMB ?? 10.7, adoptMsPerMB = cost.adoptMsPerMB ?? 9;
  const estimates = { rebuildMs: Math.round(logBytes / 1e4 * coldMsPerMB) / 100, adoptMs: Math.round(stateBytes / 1e4 * adoptMsPerMB) / 100 + (cost.fixedMs ?? 0.2) };
  if (!(estimates.adoptMs < estimates.rebuildMs * margin)) return { adopted: false, reason: 'adopting is not clearly cheaper than rebuilding, so nothing was verified and the index is rebuilt locally', estimates };
  const pinned = fs.existsSync(pubFile(dir, publisher)) ? rawPk(fs.readFileSync(pubFile(dir, publisher), 'utf8')) : null;
  if (!pinned || pinned !== pub.pk) return { adopted: false, reason: 'the publisher key is not the pinned key', estimates };
  const digest = crypto.createHash('sha256').update(stateBin).update(pub.position).digest('hex');
  let ok = false; try { ok = digest === pub.digest && crypto.verify(null, Buffer.from(digest), crypto.createPublicKey(fs.readFileSync(pubFile(dir, publisher))), Buffer.from(pub.sig, 'base64')); } catch { ok = false; }
  if (!ok) return { adopted: false, reason: 'the signature or the content does not verify', estimates };
  if (pub.position !== position(dir)) return { adopted: false, reason: 'the log has changed since this index was published, so its completeness claim no longer holds', estimates };
  const mine = new Sig(dir, me); fs.mkdirSync(P(dir).sig, { recursive: true }); fs.writeFileSync(mine.file, stateBin);
  return { adopted: true, reason: 'verified, complete to the current position, and cheaper than rebuilding', estimates };
}
