// browser-store: a pharos STORE (the seam in core.mjs) that persists encrypted, over any backend. Portable: WebCrypto and plain JS only.
// Everything is encrypted at rest by default, with no setup and no plaintext mode (there is no option that turns it off).
//
//   const store = await openBrowserStore({ name, backend, passphrase? });   // backend: idbBackend() in a browser, memoryBackend() in tests
//   const h = pharos.open(name, { writer, store });                         // an ordinary pharos handle
//   await store.flush();    await store.refresh();    store.report();
//
// How it works: the working copy is in memory, so the seam stays synchronous (list/stat/read/append). An append is queued and persisted as one
// encrypted CHUNK (AES-256-GCM, random 96-bit IV, authenticated with the store name, the opaque stream id and the chunk's sequence number, so
// chunks cannot be moved, swapped or replayed). Persisting is asynchronous and never silent: report().unpersisted counts what is not saved yet,
// flush() rejects with the real error, and the data stays in memory for the next flush. Stream names are stored as opaque ids (HMAC), and the real
// name travels inside each encrypted chunk, so writer names are not in the clear either.
//
// Keys: by default a random device key that cannot be exported, kept next to the data (this protects against reading the files or database
// without the page, not against someone using the unlocked profile or a compromised page). With a passphrase, the keys come from PBKDF2 and are
// not stored at all, so the data is unreadable without it. Not hidden: how many chunks there are, their sizes and timing.
// Two tabs: each writes only its own streams (give each tab its own writer id); a chunk is create-only, so two stores writing the SAME stream
// fail loudly instead of overwriting. refresh() reads other stores' chunks; listen() wires it to cross-tab notifications.
import { PharosError } from './core.mjs';

const te = new TextEncoder(), td = new TextDecoder();
const subtle = () => globalThis.crypto.subtle;
const hex = (u8) => [...new Uint8Array(u8)].map((b) => b.toString(16).padStart(2, '0')).join('');
const concat = (parts) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
const fail = (code, msg) => new PharosError(code, msg);

// ---- backends --------------------------------------------------------------------------------------------------
/** in-memory backend with fault injection, for tests. Same async contract as idbBackend. */
export function memoryBackend() {
  const chunks = new Map(), meta = {}; let failPut = null, failLeft = 0;
  const sorted = (s) => [...(chunks.get(s) || new Map()).values()].sort((a, b) => a.seq - b.seq);
  return {
    async streams() { return [...chunks.keys()]; },
    async chunks(stream, fromSeq = 1) { return sorted(stream).filter((c) => c.seq >= fromSeq); },
    kind: 'memory',
    async putChunk(stream, seq, record, { replace = false } = {}) { if (failPut && failLeft-- > 0) throw failPut; const m = chunks.get(stream) || chunks.set(stream, new Map()).get(stream); if (m.has(seq) && !replace) throw fail('EXISTS', `chunk ${seq} of this stream already exists`); m.set(seq, { seq, record }); },
    async getMeta(k) { return meta[k]; },
    async getOrCreateMeta(k, make) { if (!(k in meta)) meta[k] = await make(); return meta[k]; },
    async putMeta(k, v) { meta[k] = v; },
    // test hooks
    streamsSync: () => [...chunks.keys()], chunksSync: sorted, metaSync: () => meta, failNextPut(e, times = 1) { failPut = e; failLeft = times; }, dropChunk(stream, seq) { chunks.get(stream).delete(seq); },
  };
}

/** IndexedDB backend (browser). One database per store name: chunks keyed [stream, seq] (add-only, so a second writer is an error), plus meta. */
export function idbBackend(dbName = 'pharos') {
  const open = () => new Promise((res, rej) => { const r = indexedDB.open(dbName, 1); r.onupgradeneeded = () => { r.result.createObjectStore('chunks', { keyPath: ['stream', 'seq'] }); r.result.createObjectStore('meta'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  let dbp = null; const db = () => (dbp ||= open());
  const tx = async (store, mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(store, mode); let out; Promise.resolve(fn(t.objectStore(store), t)).then((v) => { out = v; }).catch(rej); t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); };
  const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  return {
    async streams() { return tx('chunks', 'readonly', async (s) => { const all = await req(s.getAllKeys()); return [...new Set(all.map((k) => k[0]))]; }); },
    async chunks(stream, fromSeq = 1) { return tx('chunks', 'readonly', async (s) => (await req(s.getAll(IDBKeyRange.bound([stream, fromSeq], [stream, Infinity])))).map((r) => ({ seq: r.seq, record: r.record }))); },
    kind: 'idb',
    async putChunk(stream, seq, record, { replace = false } = {}) { try { await tx('chunks', 'readwrite', (s) => req(replace ? s.put({ stream, seq, record }) : s.add({ stream, seq, record }))); } catch (e) { if (e && e.name === 'ConstraintError') throw fail('EXISTS', `chunk ${seq} of this stream already exists`); throw e; } },
    async getMeta(k) { return tx('meta', 'readonly', (s) => req(s.get(k))); },
    async getOrCreateMeta(k, make) { const made = await make(); return tx('meta', 'readwrite', async (s) => { const have = await req(s.get(k)); if (have !== undefined) return have; await req(s.put(made, k)); return made; }); },
    async putMeta(k, v) { return tx('meta', 'readwrite', (s) => req(s.put(v, k))); },
  };
}


/** true if this device can use the Origin Private File System from the page (a real write is probed: private modes and some browsers refuse) */
export async function opfsAvailable() {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.getDirectory) return false;
    const root = await navigator.storage.getDirectory(); const d = await root.getDirectoryHandle('pharos-probe', { create: true });
    const f = await d.getFileHandle('probe', { create: true }); if (!f.createWritable) return false;
    const w = await f.createWritable(); await w.write(new Uint8Array([1, 2, 3])); await w.close();
    const back = new Uint8Array(await (await f.getFile()).arrayBuffer()); await d.removeEntry('probe');
    return back.length === 3 && back[2] === 3;
  } catch (e) { return false; }
}

/**
 * OPFS backend: each chunk is one file, <store>/<stream id>/<seq>, holding iv + ciphertext. Key material (a non-extractable CryptoKey cannot be
 * written to a file) stays in IndexedDB, in a separate small database. A per-stream Web Lock makes "create only if absent" atomic across tabs.
 * A crash mid-write can leave one torn file: it fails authentication, is reported as damaged, and the store replaces it on the next save.
 */
export function opfsBackend(dbName = 'pharos') {
  const metaDb = idbBackend(`${dbName}-meta`);
  const locked = (key, fn) => (typeof navigator !== 'undefined' && navigator.locks ? navigator.locks.request(`pharos:${dbName}:${key}`, fn) : fn());
  let rootp = null; const root = () => (rootp ||= navigator.storage.getDirectory().then((r) => r.getDirectoryHandle(`pharos-${dbName}`, { create: true })));
  const streamDir = async (stream, create) => (await root()).getDirectoryHandle(stream, { create });
  const readFile = async (h) => { const b = new Uint8Array(await (await h.getFile()).arrayBuffer()); return { iv: b.slice(0, 12), ct: b.slice(12) }; };
  return {
    kind: 'opfs',
    async streams() { const out = []; for await (const [name, h] of (await root()).entries()) if (h.kind === 'directory') out.push(name); return out; },
    async chunks(stream, fromSeq = 1) {
      let dir; try { dir = await streamDir(stream, false); } catch (e) { return []; }
      const out = []; for await (const [name, h] of dir.entries()) { const seq = Number(name); if (h.kind === 'file' && Number.isInteger(seq) && seq >= fromSeq) out.push({ seq, record: await readFile(h) }); }
      return out.sort((a, b) => a.seq - b.seq);
    },
    async putChunk(stream, seq, record, { replace = false } = {}) {
      return locked(stream, async () => {
        const dir = await streamDir(stream, true);
        let exists = true; try { await dir.getFileHandle(String(seq)); } catch (e) { exists = false; }
        if (exists && !replace) throw fail('EXISTS', `chunk ${seq} of this stream already exists`);
        const f = await dir.getFileHandle(String(seq), { create: true }); const w = await f.createWritable();
        await w.write(concat([record.iv, record.ct])); await w.close();
      });
    },
    getMeta: (k) => metaDb.getMeta(k), getOrCreateMeta: (k, make) => metaDb.getOrCreateMeta(k, make), putMeta: (k, v) => metaDb.putMeta(k, v),
  };
}

/** the best backend this device offers: OPFS when it works, otherwise IndexedDB. Returns { backend, kind }. */
export async function autoBackend(dbName = 'pharos') {
  if (await opfsAvailable()) return { backend: opfsBackend(dbName), kind: 'opfs' };
  return { backend: idbBackend(dbName), kind: 'idb' };
}

/** ask the browser not to evict this origin's storage; true if granted (it may prompt, so call it from a user action or at first write) */
export async function requestPersistence() { try { return !!(navigator.storage && navigator.storage.persist && await navigator.storage.persist()); } catch (e) { return false; } }

// ---- keys ------------------------------------------------------------------------------------------------------
const AES = { name: 'AES-GCM', length: 256 };
async function deriveFromPassphrase(passphrase, salt, iterations) {
  const base = await subtle().importKey('raw', te.encode(passphrase), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, 512));
  return { aes: await subtle().importKey('raw', bits.slice(0, 32), AES, false, ['encrypt', 'decrypt']), mac: await subtle().importKey('raw', bits.slice(32), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']) };
}
async function newDeviceKeys() { return { aes: await subtle().generateKey(AES, false, ['encrypt', 'decrypt']), mac: await subtle().generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign']) }; }
const aad = (name, stream, seq) => te.encode(`pharos-store/1|${name}|${stream}|${seq}`);
async function seal(key, name, stream, seq, plain) { const iv = globalThis.crypto.getRandomValues(new Uint8Array(12)); const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: aad(name, stream, seq) }, key, plain)); return { iv, ct }; }
async function unseal(key, name, stream, seq, rec) { return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: rec.iv, additionalData: aad(name, stream, seq) }, key, rec.ct)); }
const streamId = async (mac, name, stream) => hex(new Uint8Array(await subtle().sign('HMAC', mac, te.encode(`pharos-store/1|${name}|${stream}`))).slice(0, 16));

// ---- the store -------------------------------------------------------------------------------------------------
export async function openBrowserStore({ name = 'pharos', backend, passphrase, iterations = 600000, encrypt, unsafePlaintext } = {}) {
  if (encrypt === false || unsafePlaintext) throw fail('NO_PLAINTEXT', 'persisted stores are always encrypted: there is no plaintext mode');
  if (!backend) throw fail('NO_BACKEND', 'openBrowserStore needs a backend (idbBackend() in a browser)');
  const mode = await backend.getMeta('keymode');
  let keys;
  if (mode === undefined) {
    if (passphrase) {
      const salt = globalThis.crypto.getRandomValues(new Uint8Array(16)); keys = await deriveFromPassphrase(passphrase, salt, iterations);
      const check = await seal(keys.aes, name, '_check', 0, te.encode('pharos-ok'));
      await backend.getOrCreateMeta('keymode', async () => 'passphrase'); await backend.getOrCreateMeta('salt', async () => salt); await backend.getOrCreateMeta('iterations', async () => iterations); await backend.getOrCreateMeta('check', async () => check);
    } else { keys = await backend.getOrCreateMeta('devicekeys', newDeviceKeys); await backend.getOrCreateMeta('keymode', async () => 'device'); }
  } else if (mode === 'passphrase') {
    if (!passphrase) throw fail('NEEDS_PASSPHRASE', 'this store needs a passphrase');
    keys = await deriveFromPassphrase(passphrase, await backend.getMeta('salt'), await backend.getMeta('iterations'));
    try { await unseal(keys.aes, name, '_check', 0, await backend.getMeta('check')); } catch (err) { throw fail('WRONG_PASSPHRASE', 'wrong passphrase'); }
  } else { keys = await backend.getMeta('devicekeys'); if (!keys) throw fail('NO_KEY', 'the device key for this store is missing: the data cannot be read'); }

  const streams = new Map();   // stream name -> { bytes: Uint8Array, id, nextSeq, known: Set<seq> , chunks: number }
  const queue = new Map();     // stream name -> [Uint8Array] not yet persisted
  const damaged = [], gaps = []; let lastError = null, flushing = null, scheduled = false; const watchers = new Set();
  const grab = (n) => { let s = streams.get(n); if (!s) streams.set(n, s = { bytes: new Uint8Array(0), id: null, nextSeq: 1, seen: new Set(), stamp: 0 }); return s; };

  async function ingest(streamIdHex, recs) {
    const bySeq = new Map(); let nameOf = null;
    for (const c of recs) {
      try {
        const plain = await unseal(keys.aes, name, streamIdHex, c.seq, c.record);
        const len = (plain[0] << 8) | plain[1]; const nm = td.decode(plain.subarray(2, 2 + len)); nameOf = nm; bySeq.set(c.seq, { nm, bytes: plain.subarray(2 + len) });
      } catch (err) { damaged.push({ stream: streamIdHex, seq: c.seq, why: 'decrypt failed: tampered, moved, or wrong key' }); }
    }
    for (const [seq, { nm, bytes }] of [...bySeq].sort((a, b) => a[0] - b[0])) {
      const s = grab(nm); s.id = streamIdHex; if (s.seen.has(seq)) continue; s.seen.add(seq); s.bytes = concat([s.bytes, bytes]); s.stamp++; s.nextSeq = Math.max(s.nextSeq, seq + 1);
    }
    return nameOf;
  }
  async function load(fromScratch) {
    for (const id of await backend.streams()) {
      const known = [...streams.values()].find((s) => s.id === id); const from = known ? Math.max(...known.seen, 0) + 1 : 1;
      const recs = await backend.chunks(id, from); if (!recs.length) continue;
      await ingest(id, recs);
    }
    // gaps: a missing sequence number is reported (its entries may still exist elsewhere), later chunks are still used
    gaps.length = 0;
    for (const s of streams.values()) { if (!s.id) continue; const top = Math.max(...s.seen, 0); const missing = []; for (let i = 1; i <= top; i++) if (!s.seen.has(i)) missing.push(i); if (missing.length) gaps.push({ stream: s.id, missing }); }
  }
  await load(true);

  async function persist() {
    for (const [nm, parts] of [...queue]) {
      if (!parts.length) continue;
      const taken = parts.length;                                 // snapshot: appends that arrive while this save is in flight stay queued for the next one
      const s = grab(nm); const id = s.id || (s.id = await streamId(keys.mac, name, nm));
      const body = concat(parts.slice(0, taken)); const nb = te.encode(nm); const plain = concat([new Uint8Array([nb.length >> 8, nb.length & 255]), nb, body]);
      const seq = s.nextSeq;                                   // claim the next number; a clash means another store owns this stream
      const rec = await seal(keys.aes, name, id, seq, plain);
      try { await backend.putChunk(id, seq, rec); }            // create-only: throws EXISTS if another writer got there first
      catch (e) {
        if (!e || e.code !== 'EXISTS') throw e;
        const there = (await backend.chunks(id, seq)).find((c) => c.seq === seq);
        let readable = true; try { await unseal(keys.aes, name, id, seq, there.record); } catch (err) { readable = false; }
        if (readable) throw e;                                 // a real chunk by another writer: refuse, never overwrite
        await backend.putChunk(id, seq, rec, { replace: true }); // an unreadable leftover (a torn write): safe to replace
      }
      s.seen.add(seq); s.nextSeq = seq + 1; queue.set(nm, queue.get(nm).slice(taken));
    }
  }
  let retries = 0, retryTimer = null;
  // a background save that fails is retried with backoff (and stays visible in report() until it succeeds): a transient error heals, a persistent one is never silent
  const schedule = () => { if (scheduled) return; scheduled = true; queueMicrotask(() => { scheduled = false; flush().then(() => { retries = 0; }, () => { clearTimeout(retryTimer); retryTimer = setTimeout(schedule, Math.min(30000, 200 * 2 ** retries++)); if (retryTimer.unref) retryTimer.unref(); }); }); };
  function flush() {
    const run = async () => { try { await persist(); lastError = null; } catch (e) { lastError = e; throw (e && e.code === 'EXISTS' ? fail('EXISTS', `another writer already owns this stream (${e.message}); give each tab its own writer id`) : e); } };
    flushing = (flushing || Promise.resolve()).catch(() => {}).then(run).then(() => { if (store._announce) store._announce(); });
    return flushing;
  }

  const store = {
    id: `browser:${name}`, dir: null,
    ensure() {},
    list() { return [...streams.keys()].sort(); },
    stat(n) { const s = streams.get(n); if (!s) throw new Error(`no stream ${n}`); return { size: s.bytes.length, gen: 0, stamp: s.stamp }; },
    read(n, from, to) { return streams.get(n).bytes.slice(from, to); },
    append(n, bytes) { const s = grab(n); s.bytes = concat([s.bytes, bytes]); s.stamp++; (queue.get(n) || queue.set(n, []).get(n)).push(new Uint8Array(bytes)); schedule(); },
    watch(cb) { watchers.add(cb); return () => watchers.delete(cb); },
    flush,
    /** keep a small secret (an account seed, a token) encrypted beside the data, bound to its name; null if absent */
    async putSecret(secretName, bytes) { const rec = await seal(keys.aes, name, `secret:${secretName}`, 0, bytes); await backend.putMeta(`secret:${secretName}`, rec); },
    async getSecret(secretName) { const rec = await backend.getMeta(`secret:${secretName}`); if (rec === undefined) return null; try { return await unseal(keys.aes, name, `secret:${secretName}`, 0, rec); } catch (err) { throw fail('BAD_SECRET', `secret "${secretName}" failed to decrypt: tampered, moved, or wrong key`); } },
    /** stop background retries and cross-tab listening */
    close() { clearTimeout(retryTimer); },
    /** read what other stores have written since (their chunks), into memory */
    async refresh() { const before = [...streams.values()].reduce((n, s) => n + s.bytes.length, 0); await load(false); if ([...streams.values()].reduce((n, s) => n + s.bytes.length, 0) !== before) for (const w of watchers) try { w(); } catch (e) { /* a watcher must not break refresh */ } },
    /** call refresh() whenever another tab announces a write (BroadcastChannel); returns a stop function */
    listen(channelName = `pharos:${name}`) { if (typeof BroadcastChannel === 'undefined') return () => {}; const bc = new BroadcastChannel(channelName); bc.onmessage = () => { store.refresh().catch(() => {}); }; store._announce = () => { try { bc.postMessage(1); } catch (e) { /* closed */ } }; return () => { store._announce = null; bc.close(); }; },
    report() { const pending = [...queue.values()].reduce((n, parts) => n + parts.length, 0); return { encrypted: true, backend: backend.kind || 'custom', keymode: mode || (passphrase ? 'passphrase' : 'device'), streams: streams.size, unpersisted: pending, damaged: damaged.slice(), gaps: gaps.slice(), lastError: lastError && String(lastError.message || lastError) }; },
  };
  return store;
}
