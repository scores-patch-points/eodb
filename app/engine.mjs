// engine.mjs: the page's database as a real pharos. The page used an in-memory array `LOG` of its own entries; this keeps that array's SHAPE as a live
// VIEW over pharos entries, so the page's fold and UI are unchanged, while everything underneath is real: pharos entries (cell, kind, addr, of, seen,
// content-addressed ids), Ed25519 signatures through device-key grants, an encrypted store on OPFS or IndexedDB, and file contents kept encrypted too.
//
//   const space = await openSpace({ name, backend, blobBackend, cells });
//   const e = space.append('cell=', { tb, rid, fid, v });   // sync: woven and appended at once; saving to disk and signing follow within a moment
//   space.view()      -> [{ id, writer, seq, ts, op, body, sig, ok }]   (the page's LOG)
//   await space.settle()  // wait until everything so far is signed and saved
import * as core from './vendor/pharos/core.mjs';
import * as B from './vendor/pharos/browser-store.mjs';
import * as I from './vendor/pharos/identity-pure.mjs';
import * as A from './vendor/pharos/access.mjs';

// the page's operation names  ->  [pharos kind, cell]. Creating things is INS; setting a value on an existing thing is DEF (so two devices setting the
// same cell at once are reported as a held conflict, never silently resolved); a retraction is NUL; reading a file is EVA; linking a column to a
// vocabulary term is CON.
export const OPS = {
  'ws+': ['ws', 'INS·Figure'], 'tb+': ['tb', 'INS·Figure'], 'fld+': ['fld', 'INS·Figure'], 'fld=': ['fld-set', 'DEF·Figure'],
  'row+': ['row', 'INS·Figure'], 'rows+': ['rows', 'INS·Figure'], 'cell=': ['cell-set', 'DEF·Figure'],
  'file+': ['file', 'INS·Figure'], 'doc+': ['doc', 'INS·Figure'], 'doc=': ['doc-set', 'DEF·Figure'],
  'cmt+': ['cmt', 'INS·Figure'], 'cmt=': ['cmt-set', 'DEF·Figure'], 'share+': ['share', 'INS·Figure'],
  'blk+': ['blk', 'INS·Figure'], 'blk=': ['blk-set', 'DEF·Figure'], 'voice+': ['voice', 'INS·Figure'],
  read: ['read', 'EVA·Figure'], map: ['map', 'CON·Figure'], retract: ['retract', 'NUL·Figure'],
};
const KIND_OP = Object.fromEntries(Object.entries(OPS).map(([op, [kind]]) => [kind, op]));
const INFRA = new Set(['frame', 'kind', 'signature', 'capability', 'device-key', 'recovery', 'locator', 'safe-copy', 'ack']);

const hex = (u) => [...u].map((b) => b.toString(16).padStart(2, '0')).join('');
const unhex = (h) => Uint8Array.from(h.match(/../g) || [], (x) => parseInt(x, 16));
export const sha = (bytes) => hex(core.sha256(bytes));

// The page's own hashing silently dropped `undefined` fields; pharos refuses them (an undefined value has no canonical form). Normalise the same way the
// page did: undefined keys disappear, undefined array items and non-finite numbers become null, raw bytes stay bytes.
export function clean(v) {
  if (v === undefined) return undefined;
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v instanceof Uint8Array) return v;
  if (Array.isArray(v)) return v.map((x) => { const c = clean(x); return c === undefined ? null : c; });
  if (typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) { const c = clean(v[k]); if (c !== undefined) o[k] = c; } return o; }
  return null; // functions, symbols
}
let uniq = 0;
function addrOf(op, b) {
  const n = () => `${Date.now().toString(36)}${(++uniq).toString(36)}`;
  switch (op) {
    case 'ws+': return `ws:${b.id}`; case 'tb+': return `tb:${b.id}`;
    case 'fld+': case 'fld=': return `fld:${b.tb}:${b.id}`;
    case 'row+': return `row:${b.tb}:${b.id}`; case 'rows+': return `rows:${b.tb}:${n()}`;
    case 'cell=': return `cell:${b.tb}:${b.rid}:${b.fid}`;
    case 'file+': return `file:${b.hash || b.name}:${n()}`;
    case 'doc+': case 'doc=': return `doc:${b.id}`;
    case 'cmt+': case 'cmt=': return `cmt:${b.doc}:${b.id}`;
    case 'share+': return `share:${b.doc}:${n()}`;
    case 'blk+': case 'blk=': return `blk:${b.doc}:${b.id}`;
    case 'voice+': return `voice:${b.doc}:${n()}`;
    case 'read': return `read:${b.hash}:${n()}`; case 'map': return `map:${b.src}:${b.col}`;
    case 'retract': return `retract:${b.of}`;
    default: throw new core.PharosError('UNKNOWN_OP', `unknown operation "${op}"`);
  }
}

export async function openSpace({ name = 'eodb', backend, blobBackend, cells, tab, passphrase, iterations } = {}) {
  if (!backend || !blobBackend || !cells) throw new Error('openSpace needs backend, blobBackend and cells');
  core.configure({ cells }); I.usePure();
  const store = await B.openBrowserStore({ name, backend, passphrase, iterations });
  const blobStore = await B.openBrowserStore({ name: `${name}-blobs`, backend: blobBackend, passphrase, iterations });

  // identity: an account (root) key and this device's key, kept encrypted beside the data. The root grants the device; the device signs.
  // (The root seed sits next to the device seed for now, so one stolen unlocked profile holds both; recovery and device-only storage are later work.)
  const seedOf = async (label) => { let s = await store.getSecret(label); let key; if (s) key = I.keyFromSeed(hex(s)); else { key = I.generateKey(); await store.putSecret(label, unhex(key.priv.slice(0, 64))); } return key; };
  const root = await seedOf('root-seed'), dev = await seedOf('device-seed');
  const devId = dev.pub.slice(0, 8), tabId = tab || globalThis.crypto.getRandomValues(new Uint8Array(2)).reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');
  const writer = `${devId}.${tabId}`, roots = { [root.pub]: true };

  const h = core.open(name, { writer, store });                    // creates the frame and boot kinds the first time; later opens find them
  const declared = () => new Set(core.entries(h).filter((e) => e.kind === 'kind' && e.body).map((e) => e.body.name));
  const first = !core.entries(h).some((e) => e.kind === 'capability');
  I.ensureKinds(h); A.ensureKinds(h);
  const have = declared();
  for (const [op, [kind, cell]] of Object.entries(OPS)) if (kind !== 'retract' && !have.has(kind)) core.weave(h, { cell: 'DEF·Figure', kind: 'kind', addr: `kind:${kind}`, body: { name: kind, cell } });
  const granted = core.fold(h).entries.some((e) => e.kind === 'capability' && e.body && e.body.subject === dev.pub);
  if (!granted) A.grantCap(h, root, { subject: dev.pub, writer: `${devId}.*`, scope: '*', rights: ['read', 'write', 'grant'] });

  // verification: done in full once at open, then incrementally for what this device signs
  let okSet = new Set(), sigOf = new Map(), signing = null, timer = null, listeners = new Set(), statusListeners = new Set();
  const recompute = () => { const v = A.verifyAccess(h, { roots }); okSet = new Set(v.counted); sigOf = new Map(); for (const e of core.entries(h)) if (e.kind === 'signature' && e.body) for (const id of e.body.ids || []) if (!sigOf.has(id)) sigOf.set(id, e.body.sig); };
  const signNow = () => { const r = I.signNew(h, dev); if (r.signed) { const e = r.entry || core.entries(h).filter((x) => x.kind === 'signature').at(-1); const valid = I.verifyBytes(dev.pub, new TextEncoder().encode(`pharos-sig/1\n${h.name}\n${[...e.body.ids].sort().join('\n')}`), e.body.sig); if (valid) for (const id of e.body.ids) { okSet.add(id); sigOf.set(id, e.body.sig); } } return r.signed; };
  signNow(); recompute();
  const changed = () => { for (const f of listeners) try { f(); } catch (err) { /* a listener must not break the engine */ } };       // the DATA changed (another tab wrote)
  const status = () => { for (const f of statusListeners) try { f(); } catch (err) { /* ditto */ } };                                      // only signing or saving progressed
  const soon = () => { if (timer) return; timer = setTimeout(() => { timer = null; signNow(); status(); }, 120); };
  store.watch(() => { recompute(); changed(); });                  // another tab wrote: re-verify and tell the page
  const stopListen = store.listen();

  // file contents: kept in memory for the page's synchronous reads, and persisted encrypted. A blob is [type length][type][bytes] in its own stream.
  const blobs = new Map();
  for (const f of blobStore.list()) { const b = blobStore.read(f, 0, blobStore.stat(f).size), tl = b[0]; blobs.set(f.slice(2, -4), { type: new TextDecoder().decode(b.subarray(1, 1 + tl)), bytes: b.slice(1 + tl) }); }
  const blobApi = {
    has: (hash) => blobs.has(hash), get: (hash) => blobs.get(hash), all: () => [...blobs.entries()],
    put(hash, bytes, type = '') { if (blobs.has(hash)) return false; const t = new TextEncoder().encode(type); blobs.set(hash, { bytes, type }); const out = new Uint8Array(1 + t.length + bytes.length); out[0] = t.length; out.set(t, 1); out.set(bytes, 1 + t.length); blobStore.append(`b-${hash}.bin`, out); return true; },
  };

  const space = {
    writer, rootPub: root.pub, devicePub: dev.pub, name, blobs: blobApi, sha, first,
    /** weave one page operation; returns it in the page's shape. Sync: the entry exists at once; signing and saving follow. */
    append(op, body) {
      if (!OPS[op]) throw new core.PharosError('UNKNOWN_OP', `unknown operation "${op}"`);
      body = clean(body); const [kind, cell] = OPS[op]; const spec = { cell, kind, addr: addrOf(op, body), body };
      if (op === 'retract') { spec.of = [body.of]; spec.body = { why: body.why || 'retract' }; }
      const e = core.weave(h, spec); soon();
      return shape(e, space.view().length);
    },
    /** the page's LOG: app entries in causal order, in the page's shape */
    view() {
      const out = []; let i = 0;
      for (const e of core.entries(h)) { if (INFRA.has(e.kind) || !KIND_OP[e.kind]) continue; out.push(shape(e, ++i)); }
      return out;
    },
    /** wait until everything so far is signed and saved; rejects with the real error if saving failed */
    async settle() { clearTimeout(timer); timer = null; signNow(); try { await store.flush(); await blobStore.flush(); } finally { status(); } },
    verify() { recompute(); return { counted: okSet.size, uncounted: A.verifyAccess(h, { roots }).uncounted }; },
    report() { const r = store.report(), b = blobStore.report(); const unsigned = core.entries(h).filter((e) => e.by === writer && !INFRA.has(e.kind) && !okSet.has(e.id)).length; return { backend: r.backend, encrypted: r.encrypted, unpersisted: r.unpersisted + b.unpersisted, unsigned, damaged: r.damaged.length + b.damaged.length, gaps: r.gaps.length + b.gaps.length, lastError: r.lastError || b.lastError, entries: core.entries(h).length }; },
    /** another tab changed the data */
    onChange(f) { listeners.add(f); return () => listeners.delete(f); },
    /** signing or saving progressed (flags and counts changed, the data did not) */
    onStatus(f) { statusListeners.add(f); return () => statusListeners.delete(f); },
    close() { clearTimeout(timer); stopListen(); store.close(); blobStore.close(); },
    _handle: h, _store: store,
  };
  function shape(e, seq) {
    const op = KIND_OP[e.kind];
    return { id: e.id, writer: e.by, seq, ts: Date.parse(e.at), op, body: op === 'retract' ? { of: e.of[0], ...e.body } : e.body, sig: sigOf.get(e.id) || '', ok: okSet.has(e.id) };
  }
  return space;
}
