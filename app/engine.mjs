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
import * as C from './vendor/pharos/carrier.mjs';
import * as T from './vendor/pharos/transport.mjs';
import * as Loc from './vendor/pharos/locator.mjs';
import { gate } from './vendor/pharos/gate.mjs';
import * as N from './net.mjs';

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

const b64u = (str) => { const by = new TextEncoder().encode(str); let bin = ''; for (const x of by) bin += String.fromCharCode(x); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = (t) => new TextDecoder().decode(Uint8Array.from(atob(t.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((t.length + 3) % 4)), (c) => c.charCodeAt(0)));
/** a share link: where the relay is, the key that seals the space's segments, the account key to trust, and a pharos invite for a guest device */
export function parseJoin(link) {
  const m = /^eodb-join:1:([A-Za-z0-9_-]+)$/.exec(String(link).trim()); if (!m) throw new core.PharosError('BAD_JOIN', 'not a share link');
  let b; try { b = JSON.parse(unb64u(m[1])); } catch (e) { throw new core.PharosError('BAD_JOIN', 'not a share link (malformed)'); }
  if (b && typeof b.relay === 'string' && !b.routes) b.routes = [`relay:${b.relay}`];
  if (!b || !Array.isArray(b.routes) || !b.routes.length || !b.routes.every((r) => typeof r === 'string' && /^[a-z]+:/.test(r)) || !/^[0-9a-f]{64}$/.test(b.key || '') || !/^[0-9a-f]{64}$/.test(b.root || '') || typeof b.invite !== 'string') throw new core.PharosError('BAD_JOIN', 'not a share link (incomplete)');
  return b;
}

export async function openSpace({ name = 'eodb', backend, blobBackend, cells, tab, passphrase, iterations, join, autosync = true, syncMs = 2500 } = {}) {
  if (!backend || !blobBackend || !cells) throw new Error('openSpace needs backend, blobBackend and cells');
  core.configure({ cells }); I.usePure();
  const store = await B.openBrowserStore({ name, backend, passphrase, iterations });
  const blobStore = await B.openBrowserStore({ name: `${name}-blobs`, backend: blobBackend, passphrase, iterations });

  // identity: an account (root) key and this device's key, kept encrypted beside the data. The root grants the device; the device signs.
  // (The root seed sits next to the device seed for now, so one stolen unlocked profile holds both; recovery and device-only storage are later work.)
  const seedOf = async (label) => { let s = await store.getSecret(label); let key; if (s) key = I.keyFromSeed(hex(s)); else { key = I.generateKey(); await store.putSecret(label, unhex(key.priv.slice(0, 64))); } return key; };
  const te = new TextEncoder(), td = new TextDecoder();
  let share = null; const savedShare = await store.getSecret('share'); if (savedShare) share = JSON.parse(td.decode(savedShare));
  if (!share && join) { const j = parseJoin(join); share = { role: 'guest', routes: j.routes, key: j.key, root: j.root, invite: j.invite }; await store.putSecret('share', te.encode(JSON.stringify(share))); }
  const guest = !!share && share.role === 'guest';
  const root = guest ? null : await seedOf('root-seed'), dev = await seedOf('device-seed');
  const devId = dev.pub.slice(0, 8), tabId = tab || globalThis.crypto.getRandomValues(new Uint8Array(2)).reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');
  const writer = guest ? `guest.${devId}.${tabId}` : `${devId}.${tabId}`, roots = guest ? { [share.root]: true } : { [root.pub]: true };

  // A guest does not make a frame, schema or account: it receives the founder's (the log is the database), then takes its own grant from the invite key.
  const h = core.open(name, { writer, store, frame: !guest });
  const first = !guest && !core.entries(h).some((e) => e.kind === 'capability');
  if (!guest) {
    I.ensureKinds(h); A.ensureKinds(h);
    const have = new Set(core.entries(h).filter((e) => e.kind === 'kind' && e.body).map((e) => e.body.name));
    for (const [op, [kind, cell]] of Object.entries(OPS)) if (kind !== 'retract' && !have.has(kind)) core.weave(h, { cell: 'DEF·Figure', kind: 'kind', addr: `kind:${kind}`, body: { name: kind, cell } });
    const granted = core.fold(h).entries.some((e) => e.kind === 'capability' && e.body && e.body.subject === dev.pub);
    if (!granted) A.grantCap(h, root, { subject: dev.pub, writer: `${devId}.*`, scope: '*', rights: ['read', 'write', 'grant'] });
  }

  // verification: done in full once at open, then incrementally for what this device signs
  let okSet = new Set(), sigOf = new Map(), signing = null, timer = null, listeners = new Set(), statusListeners = new Set();
  const recompute = () => { const v = A.verifyAccess(h, { roots }); okSet = new Set(v.counted); sigOf = new Map(); for (const e of core.entries(h)) if (e.kind === 'signature' && e.body) for (const id of e.body.ids || []) if (!sigOf.has(id)) sigOf.set(id, e.body.sig); };
  const signNow = () => { if (!core.entries(h).some((e) => e.kind === 'frame')) return 0;   // a guest has no frame until it has received the founder's
    const r = I.signNew(h, dev); if (r.signed) { const e = r.entry || core.entries(h).filter((x) => x.kind === 'signature').at(-1); const valid = I.verifyBytes(dev.pub, new TextEncoder().encode(`pharos-sig/1\n${h.name}\n${[...e.body.ids].sort().join('\n')}`), e.body.sig); if (valid) for (const id of e.body.ids) { okSet.add(id); sigOf.set(id, e.body.sig); } } return r.signed; };
  signNow(); recompute();
  const changed = () => { for (const f of listeners) try { f(); } catch (err) { /* a listener must not break the engine */ } };       // the DATA changed (another tab wrote)
  const status = () => { for (const f of statusListeners) try { f(); } catch (err) { /* ditto */ } };                                      // only signing or saving progressed
  const soon = () => { if (timer) return; timer = setTimeout(() => { timer = null; signNow(); status(); }, 120); };
  store.watch(() => { recompute(); changed(); });                  // another tab wrote: re-verify and tell the page
  const stopListen = store.listen();

  // ---- connection: the user is never asked how. A space has ROUTES (today: blind relays); the share link carries the first ones, the log carries any announced
  // later (locator entries), and this uses all of them at once: it writes to every route, reads from every route, repairs a route that fell behind, and
  // shrugs off one that is down. More kinds of route (direct browser-to-browser, a shared folder, a file passed by hand) plug into `adapters`.
  const routeHealth = new Map(); // uri -> { ok, error, at }
  // The connection type is invisible: a route is just a URI whose scheme names a transport that can store opaque blobs.
  // Every raw transport is sealed above (AES-GCM), so a relay, a generic HTTP store, a WebDAV share, or a tiny-frame
  // LoRa gateway are interchangeable. Add a scheme here and any device can use it by putting that URI in a share link.
  const rawAdapters = {
    relay: (uri) => N.httpCarrier(uri.slice('relay:'.length)),
    http: (uri) => N.httpCarrier(uri.slice('http:'.length)),
    mailbox: (uri) => { const { base, token } = N.parseMailboxRoute(uri); return N.mailboxCarrier(base, token); },   // a mailbox server (app/mailbox/mailbox.mjs); the token rides in the route after #
    lora: (uri) => { const [base, q] = uri.slice('lora:'.length).split('?'); const p = new URLSearchParams(q || ''); const mtu = Number(p.get('mtu')) || 200; const duty = p.has('duty') ? Number(p.get('duty')) : 0.01; return N.chunkedCarrier(N.politeCarrier(N.httpCarrier(base), { dutyCycle: duty }), { mtu }); },
  };
  let spaceKey = null; const getKey = async () => spaceKey || (spaceKey = await N.importKey(share.key));
  const learned = () => { try { return Loc.locators(h, 'space').map((l) => l.uri); } catch (err) { return []; } };
  const track = (uri, c) => { const mark = (ok, err) => routeHealth.set(uri, { ok, error: ok ? null : String(err && err.message || err), at: Date.now() });
    return { list: async () => { try { const r = await c.list(); mark(true); return r; } catch (e) { mark(false, e); throw e; } }, get: async (n) => { try { const r = await c.get(n); mark(true); return r; } catch (e) { mark(false, e); throw e; } }, putNew: async (n, b) => { try { const r = await c.putNew(n, b); mark(true); return r; } catch (e) { mark(false, e); throw e; } } }; };
  let blobApiRef = null;
  const syncState = { timer: null, busy: false, last: null, error: null, quarantined: 0, known: new Set(), policy: null };
  async function routes() {
    const uris = [...new Set([...(share ? share.routes : []), ...learned()])], out = [];
    const key = share ? await getKey() : null;
    for (const uri of uris) { const scheme = uri.split(':')[0]; const make = rawAdapters[scheme]; if (!make) continue; try { const raw = make(uri); out.push({ uri, carrier: track(uri, key ? N.sealedCarrier(raw, key) : raw) }); } catch (e) { routeHealth.set(uri, { ok: false, error: String(e.message || e), at: Date.now() }); } }
    return out;
  }
  // File contents travel as sealed objects. Their NAMES are a keyed hash of the file's hash (blob/<hmac>), per space: two spaces on one server never collide, and the server
  // cannot tell which file an object is or whether two spaces hold the same one. A received object is accepted only if its bytes hash to the file hash we expected.
  let nameKey = null;
  const blobName = async (hash) => {
    if (!nameKey) { const raw = core.sha256(new TextEncoder().encode(`eodb-blob-name/1|${share.key}`)); nameKey = await globalThis.crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); }
    return 'blob/' + hex(new Uint8Array(await globalThis.crypto.subtle.sign('HMAC', nameKey, new TextEncoder().encode(`blob|${hash}`))));
  };
  const referencedHashes = () => { const out = new Set(); const walk = (v) => { if (typeof v === 'string') { if (/^[0-9a-f]{64}$/.test(v)) out.add(v); } else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object' && !(v instanceof Uint8Array)) Object.values(v).forEach(walk); }; for (const e of space.view()) if (e.op === 'file+' || e.op === 'read' || e.op === 'voice+') walk(e.body); return out; };
  async function syncBlobs(c) {
    const b = blobApiRef; if (!b) return 0; let moved = 0; const names = new Set((await c.list()).filter((n) => /^blob\/[0-9a-f]{64}$/.test(n)));
    for (const [hash, v] of b.all()) { const n = await blobName(hash); if (names.has(n)) continue; const t = te.encode(v.type || ''); const out = new Uint8Array(1 + t.length + v.bytes.length); out[0] = t.length; out.set(t, 1); out.set(v.bytes, 1 + t.length); await c.putNew(n, out); moved++; }
    for (const hash of referencedHashes()) { if (b.has(hash)) continue; const n = await blobName(hash); if (!names.has(n)) continue; const raw = await c.get(n); if (!raw) continue; const tl = raw[0], bytes = raw.slice(1 + tl); if (sha(bytes) !== hash) continue; b.put(hash, bytes, td.decode(raw.subarray(1, 1 + tl))); moved++; }
    return moved;
  }
  async function syncOnce() {
    if (!share || syncState.busy) return null; syncState.busy = true;
    try {
      const rs = await routes(); if (!rs.length) throw new Error('no usable route to the other devices');
      const all = T.union(rs.map((r) => r.carrier), { minOk: 1 }); if (!syncState.policy) syncState.policy = gate(h, { roots });
      signNow(); await store.flush();
      const pub = await C.publish(h, all);
      const got = await C.fetch(h, all, { policy: syncState.policy, known: syncState.known });
      for (const r of rs) { try { await T.bridge(all, r.carrier); } catch (e) { /* a route that is down is repaired next time */ } }   // every route ends up holding everything
      let blobsMoved = 0; for (const r of rs) { try { blobsMoved += await syncBlobs(r.carrier); } catch (e) { /* ditto */ } }                     // and so does every file (sealed, named by its hash)
      if (!rs.some((r) => routeHealth.get(r.uri) && routeHealth.get(r.uri).ok)) throw new Error('every route failed');
      syncState.last = Date.now(); syncState.error = null; syncState.quarantined = got.quarantined;
      if (got.entries) { recompute(); changed(); }
      status(); return { published: pub.published, fetched: got.entries, quarantined: got.quarantined, routes: rs.length };
    } catch (e) { syncState.error = String(e && e.message || e); status(); return { error: syncState.error }; } finally { syncState.busy = false; }
  }
  const startSync = (ms) => { if (!share || syncState.timer) return; syncState.timer = setInterval(() => { syncOnce(); }, ms); if (syncState.timer.unref) syncState.timer.unref(); };
  const abandon = () => { clearInterval(syncState.timer); stopListen(); store.close(); blobStore.close(); };   // an open that fails must not leave channels and timers running
  try {
  if (guest) {
    // receive the founder's frame, kinds and grants first; then take this device's own grant from the invite key.
    // Another device may not have published, or the relay may lag a moment, so retry a few times before giving up.
    let frame = false, routeErr = null;
    for (let attempt = 0; attempt < 6 && !frame; attempt++) {
      const r = await syncOnce();
      routeErr = r && r.error ? r.error : null;
      frame = core.entries(h).some((e) => e.kind === 'frame');
      if (!frame && attempt < 5) await new Promise((res) => setTimeout(res, 500));
    }
    if (!frame) {
      if (routeErr) throw new core.PharosError('NO_ROUTE', `cannot reach the shared space: ${routeErr}`);
      throw new core.PharosError('NOT_PUBLISHED', 'the shared space has not been published yet: ask the person who shared it to open it once, then try again');
    }
    if (!core.fold(h).entries.some((e) => e.kind === 'capability' && e.body && e.body.subject === dev.pub)) {
      const inv = A.parseInvite(share.invite), K = I.keyFromSeed(inv.seed);
      A.grantCap(h, K, { subject: dev.pub, writer: `guest.${devId}.*`, scope: inv.scope, rights: inv.rights, until: inv.until });
    }
    signNow(); recompute(); await syncOnce();
  }
  } catch (e) { abandon(); throw e; }

  // file contents: kept in memory for the page's synchronous reads, and persisted encrypted. A blob is [type length][type][bytes] in its own stream.
  const blobs = new Map();
  for (const f of blobStore.list()) { const b = blobStore.read(f, 0, blobStore.stat(f).size), tl = b[0]; blobs.set(f.slice(2, -4), { type: new TextDecoder().decode(b.subarray(1, 1 + tl)), bytes: b.slice(1 + tl) }); }
  const blobApi = {
    has: (hash) => blobs.has(hash), get: (hash) => blobs.get(hash), all: () => [...blobs.entries()],
    put(hash, bytes, type = '') { if (blobs.has(hash)) return false; const t = new TextEncoder().encode(type); blobs.set(hash, { bytes, type }); const out = new Uint8Array(1 + t.length + bytes.length); out[0] = t.length; out.set(t, 1); out.set(bytes, 1 + t.length); blobStore.append(`b-${hash}.bin`, out); return true; },
  };

  blobApiRef = blobApi;
  const space = {
    writer, rootPub: root ? root.pub : share.root, devicePub: dev.pub, name, blobs: blobApi, sha, first,
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
    /** make this space shareable: returns a link that opens it on another device. `routes` are the ways to reach this space (today: relay:<url>). */
    async share({ routes: rs = [] } = {}) {
      if (guest) throw new core.PharosError('NOT_FOUNDER', 'only the device that made the space can create share links');
      if (!share || !share.inviteEntry) {      // first time, or after the old link was revoked: a fresh invite (same space key and routes)
        const inv = A.createInvite(h, root, { scope: '*', rights: ['read', 'write'], writer: 'guest.*' });
        share = { role: 'founder', routes: [...(share ? share.routes : []), ...rs.filter((r) => !share || !share.routes.includes(r))], key: share ? share.key : N.newSpaceKey(), root: root.pub, invite: inv.link, inviteEntry: inv.entryId };
      } else { for (const r of rs) if (!share.routes.includes(r)) share.routes.push(r); }
      for (const r of share.routes) if (!learned().includes(r)) Loc.announce(h, { scope: 'space', uri: r });   // the routes become data in the log: any device that has one learns the rest
      await store.putSecret('share', te.encode(JSON.stringify(share))); signNow(); await syncOnce(); startSync(syncMs);
      return `eodb-join:1:${b64u(JSON.stringify({ v: 1, routes: share.routes, key: share.key, root: share.root, invite: share.invite }))}`;
    },
    /** stop admitting new devices through the link (devices already admitted stay until their grant is revoked) */
    async unshare() { if (!share || guest || !share.inviteEntry) return false; A.revoke(h, root, share.inviteEntry, 'share link revoked'); share.inviteEntry = null; await store.putSecret('share', te.encode(JSON.stringify(share))); signNow(); await syncOnce(); return true; },
    /** the object name a file is stored under on routes (a keyed hash: opaque to the server, unique per space) */
    blobName: (hash) => blobName(hash),
    syncOnce, get role() { return guest ? 'guest' : share ? 'founder' : 'solo'; },   // live: a solo space becomes a founder's the moment it is shared
    /** devices seen in the log (the writer id before the tab part) */
    peers() { const d = new Set(); for (const e of core.entries(h)) if (!INFRA.has(e.kind) && KIND_OP[e.kind]) d.add(e.by.split('.').slice(0, e.by.startsWith('guest.') ? 2 : 1).join('.')); return [...d]; },
    /** wait until everything so far is signed and saved; rejects with the real error if saving failed */
    async settle() { clearTimeout(timer); timer = null; signNow(); try { await store.flush(); await blobStore.flush(); } finally { status(); } },
    verify() { recompute(); return { counted: okSet.size, uncounted: A.verifyAccess(h, { roots }).uncounted }; },
    report() { const r = store.report(), b = blobStore.report(); const rt = [...routeHealth.values()]; const unsigned = core.entries(h).filter((e) => e.by === writer && !INFRA.has(e.kind) && !okSet.has(e.id)).length; return { backend: r.backend, encrypted: r.encrypted, unpersisted: r.unpersisted + b.unpersisted, unsigned, damaged: r.damaged.length + b.damaged.length, gaps: r.gaps.length + b.gaps.length, lastError: r.lastError || b.lastError, entries: core.entries(h).length, share: share ? { role: share.role, routes: rt.length, routesUp: rt.filter((x) => x.ok).length, last: syncState.last, error: syncState.error, quarantined: syncState.quarantined } : null }; },
    /** another tab changed the data */
    onChange(f) { listeners.add(f); return () => listeners.delete(f); },
    /** signing or saving progressed (flags and counts changed, the data did not) */
    onStatus(f) { statusListeners.add(f); return () => statusListeners.delete(f); },
    close() { clearTimeout(timer); clearInterval(syncState.timer); syncState.timer = null; stopListen(); store.close(); blobStore.close(); },
    _handle: h, _store: store,
  };
  function shape(e, seq) {
    const op = KIND_OP[e.kind];
    return { id: e.id, writer: e.by, seq, ts: Date.parse(e.at), op, body: op === 'retract' ? { of: e.of[0], ...e.body } : e.body, sig: sigOf.get(e.id) || '', ok: okSet.has(e.id) };
  }
  if (share && autosync) startSync(syncMs);
  return space;
}
