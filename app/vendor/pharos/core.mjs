// pharos core: the one shared log, PORTABLE. No Node built-ins, no Buffer, no process, no os, no fs. See SPEC.md.
// It runs wherever JavaScript runs (Node, a browser tab, a worker). It reaches the outside only through
//   - a STORE (named append-only byte streams; see "storage seam" below), passed to open()
//   - configure({ cells, sha256, bytes }): the cell table (data, from cells.json), an optional faster sha256, an optional bytes type
// Node's entry point is lib/pharos.mjs: it configures this file, supplies the folder store and the install/undo/migrate tools,
// and embeds this file's sha256 so a pinned door still covers all of it. A browser host calls configure({ cells }) itself.

export class PharosError extends Error {
  constructor(code, message, detail) {
    super(message);
    this.name = 'PharosError';
    this.code = code;
    if (detail !== undefined) this.detail = detail;
  }
}

// The protocol's own kinds are always valid, declared or not (so no retraction can strand the protocol).
// open() also writes them as ordinary kind entries, so the log itself declares them.
const BOOT = { frame: 'NUL·Ground', kind: 'DEF·Figure', holon: 'DEF·Pattern', retract: 'NUL·Figure' };
const ALLOWED = new Set(['cell', 'kind', 'addr', 'body', 'of', 'basis']);
const COMPUTED = new Set(['v', 'seen', 'at', 'id', 'by']);
const EXT = '.phr';

// ---- configuration ------------------------------------------------------------
let RANK = null;
let SHA = (u8) => sha256(u8);
let BYTES_OUT = (u8) => new Uint8Array(u8);

export function configure(opts = {}) {
  if (opts.cells) RANK = new Map(opts.cells.cells.map((c) => [c.id, c.rank]));
  if (opts.sha256) SHA = opts.sha256;
  if (opts.bytes) BYTES_OUT = opts.bytes;
}
const rank = () => { if (!RANK) throw new PharosError('NOT_CONFIGURED', 'call configure({ cells }) with the contents of cells.json before using the core'); return RANK; };
const hasCell = (c) => rank().has(c);

// ---- bytes (no Buffer) ------------------------------------------------------------
const UTF8 = new TextEncoder();
const UTF8_DEC = new TextDecoder();
const concat = (parts) => { let n = 0; for (const p of parts) n += p.length; const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
const toHex = (u8) => { let s = ''; for (const b of u8) s += b.toString(16).padStart(2, '0'); return s; };
const toBase64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const bytesEqual = (a, b) => { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
const indexOfBytes = (hay, pat, from) => {
  outer: for (let i = Math.max(0, from); i + pat.length <= hay.length; i++) { for (let j = 0; j < pat.length; j++) if (hay[i + j] !== pat[j]) continue outer; return i; }
  return -1;
};
const view = (u8) => new DataView(u8.buffer, u8.byteOffset, u8.byteLength);

// ---- sha256, pure JavaScript, synchronous ----------------------------------------------
// Used unless the host passes a faster one to configure(). Tested against Node's crypto on many lengths.
const K256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
export function sha256(data) {
  const l = data.length, blocks = (l + 9 + 63) >> 6, buf = new Uint8Array(blocks * 64);
  buf.set(data); buf[l] = 0x80;
  const dv = view(buf); dv.setUint32(buf.length - 8, Math.floor(l / 0x20000000), false); dv.setUint32(buf.length - 4, (l << 3) >>> 0, false);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]), w = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < buf.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), ch = (e & f) ^ (~e & g), t1 = (hh + S1 + ch + K256[i] + w[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), mj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + mj) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }
  const out = new Uint8Array(32), ov = view(out); for (let i = 0; i < 8; i++) ov.setUint32(i * 4, h[i], false);
  return out;
}

// ---- canonical JSON and ids -------------------------------------------------

export function canonical(v) {
  if (v === null) return 'null';
  switch (typeof v) {
    case 'string': return JSON.stringify(v);
    case 'boolean': return v ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(v)) throw new PharosError('BAD_JSON', 'non-finite number in entry');
      return JSON.stringify(v);
    case 'object': {
      if (v instanceof Uint8Array) return '{"$bytes":"' + toBase64(v) + '"}';
      if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i++) if (!(i in v)) throw new PharosError('BAD_JSON', `sparse array hole at ${i}`);
        return '[' + v.map(canonical).join(',') + ']';
      }
      const proto = Object.getPrototypeOf(v);
      if (proto !== Object.prototype && proto !== null) throw new PharosError('BAD_JSON', 'only plain objects are JSON (no Date, Map, Set, class instances)');
      return '{' + Object.keys(v).sort().map((k) => {
        if (v[k] === undefined) throw new PharosError('BAD_JSON', `undefined value at key ${k}`);
        return JSON.stringify(k) + ':' + canonical(v[k]);
      }).join(',') + '}';
    }
    default:
      throw new PharosError('BAD_JSON', `value of type ${typeof v} is not JSON`);
  }
}

export function entryId(entry) {
  const { id, ...rest } = entry; // eslint-disable-line no-unused-vars
  return toHex(SHA(UTF8.encode(canonical(rest))));
}

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x) && !(x instanceof Uint8Array);
const isStrArr = (x) => Array.isArray(x) && x.every((s) => typeof s === 'string');

export function invalidEntry(e) {
  try {
    if (!isObj(e)) return 'not an object';
    if (e.v !== 1) return 'bad version';
    for (const k of ['cell', 'kind', 'addr', 'by', 'at', 'id']) if (typeof e[k] !== 'string') return `bad ${k}`;
    if (!hasCell(e.cell)) return 'unknown cell';
    if (!isStrArr(e.of) || !isStrArr(e.seen)) return 'bad of/seen';
    if (!isObj(e.basis) || !('body' in e)) return 'bad basis/body';
    if (entryId(e) !== e.id) return 'id does not match content';
  } catch (err) {
    return 'bad json value';
  }
  return null;
}

// ---- binary codec -----------------------------------------------------------
// The root of the log is binary. A value is one tag byte plus payload; integers are LEB128 varints,
// maps are written with sorted keys, so the same entry always encodes to the same bytes.
//   0 null  1 false  2 true  3 uint  4 negint (-1-n)  5 float64  6 string  7 bytes  8 array  9 map

const T = { NULL: 0, FALSE: 1, TRUE: 2, UINT: 3, NEG: 4, F64: 5, STR: 6, BYTES: 7, ARR: 8, MAP: 9 };
const MAX_DEPTH = 1000;

function putVar(out, n) {
  while (n >= 128) { out.push((n % 128) | 128); n = Math.floor(n / 128); }
  out.push(n);
}
const u8 = (...bytes) => Uint8Array.from(bytes);

function enc(v, out, depth) {
  if (depth > MAX_DEPTH) throw new PharosError('BAD_JSON', 'value nests too deeply');
  if (v === null) return out.push(u8(T.NULL));
  switch (typeof v) {
    case 'boolean': return out.push(u8(v ? T.TRUE : T.FALSE));
    case 'number': {
      if (!Number.isFinite(v)) throw new PharosError('BAD_JSON', 'non-finite number in entry');
      if (Number.isSafeInteger(v)) {
        const b = []; putVar(b, v < 0 ? -1 - v : v);
        return out.push(u8(v < 0 ? T.NEG : T.UINT, ...b));
      }
      const f = new Uint8Array(9); f[0] = T.F64; view(f).setFloat64(1, v, false);
      return out.push(f);
    }
    case 'string': {
      const s = UTF8.encode(v); const b = []; putVar(b, s.length);
      return out.push(u8(T.STR, ...b), s);
    }
    case 'object': {
      if (v instanceof Uint8Array) {
        const b = []; putVar(b, v.length);
        return out.push(u8(T.BYTES, ...b), new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
      }
      if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i++) if (!(i in v)) throw new PharosError('BAD_JSON', `sparse array hole at ${i}`);
        const b = []; putVar(b, v.length); out.push(u8(T.ARR, ...b));
        for (const x of v) enc(x, out, depth + 1);
        return;
      }
      const proto = Object.getPrototypeOf(v);
      if (proto !== Object.prototype && proto !== null) throw new PharosError('BAD_JSON', 'only plain objects are JSON (no Date, Map, Set, class instances)');
      const keys = Object.keys(v).sort();
      const b = []; putVar(b, keys.length); out.push(u8(T.MAP, ...b));
      for (const k of keys) {
        if (v[k] === undefined) throw new PharosError('BAD_JSON', `undefined value at key ${k}`);
        const kb = UTF8.encode(k); const kl = []; putVar(kl, kb.length);
        out.push(Uint8Array.from(kl), kb);
        enc(v[k], out, depth + 1);
      }
      return;
    }
    default: throw new PharosError('BAD_JSON', `value of type ${typeof v} is not JSON`);
  }
}

export function encode(v) { const out = []; enc(v, out, 0); return concat(out); }

export function decode(buf) {
  let i = 0;
  const fail = (m) => { throw new PharosError('BAD_BINARY', m); };
  const getVar = () => {
    let n = 0, mul = 1;
    for (let k = 0; k < 8; k++) {
      if (i >= buf.length) fail('truncated varint');
      const b = buf[i++];
      n += (b & 127) * mul;
      if (b < 128) { if (!Number.isSafeInteger(n)) fail('varint too large'); return n; }
      mul *= 128;
    }
    return fail('varint too long');
  };
  const take = (n) => { if (i + n > buf.length) fail('truncated value'); const s = buf.subarray(i, i + n); i += n; return s; };
  const str = () => UTF8_DEC.decode(take(getVar()));
  const val = (depth) => {
    if (depth > MAX_DEPTH) fail('value nests too deeply');
    if (i >= buf.length) fail('truncated value');
    switch (buf[i++]) {
      case T.NULL: return null;
      case T.FALSE: return false;
      case T.TRUE: return true;
      case T.UINT: return getVar();
      case T.NEG: return -1 - getVar();
      case T.F64: return view(take(8)).getFloat64(0, false);
      case T.STR: return str();
      case T.BYTES: return BYTES_OUT(take(getVar()));
      case T.ARR: { const n = getVar(), a = []; for (let k = 0; k < n; k++) a.push(val(depth + 1)); return a; }
      case T.MAP: {
        const n = getVar(), o = {};
        for (let k = 0; k < n; k++) { const key = str(); Object.defineProperty(o, key, { value: val(depth + 1), enumerable: true, writable: true, configurable: true }); }
        return o;
      }
      default: return fail('unknown tag');
    }
  };
  const v = val(0);
  if (i !== buf.length) fail('trailing bytes');
  return v;
}

// A JSON-safe copy of a value: bytes become {"$bytes": "<base64>"}. Used by the views (fold output as JSON / JSONL).
export function jsonSafe(v) {
  if (v instanceof Uint8Array) return { $bytes: toBase64(v) };
  if (Array.isArray(v)) return v.map(jsonSafe);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, jsonSafe(x)]));
  return v;
}

// ---- records ----------------------------------------------------------------
// One stream per writer, <writer>.phr, a concatenation of records:
//   'PHR1' | u32be length | payload (the encoded entry) | first 4 bytes of sha256(payload)
// A torn or damaged record is reported and skipped by resyncing on the next 'PHR1'; it never hides later records.

const MAGIC = u8(0x50, 0x48, 0x52, 0x31); // 'PHR1'
const MAX_RECORD = 1 << 28;
const check = (payload) => SHA(payload).subarray(0, 4);

function frameRecord(entry) {
  const payload = encode(entry);
  const head = new Uint8Array(8); head.set(MAGIC); view(head).setUint32(4, payload.length, false);
  return concat([head, payload, check(payload)]);
}
/** the bytes of these entries as records, ready to append to a stream */
export const recordBytes = (ents) => concat(ents.map(frameRecord));

// ---- storage seam -----------------------------------------------------------
// The core never touches the file system: a pharos lives in a STORE, a set of named append-only byte streams
// (one per writer, named <writer>.phr). A store is:
//   id            a string unique to this store, so parsed streams can be cached
//   dir           the folder, for the folder store; null for a store that has none
//   ensure()      make the container exist
//   list()        the stream names, sorted
//   stat(name)    { size, gen, stamp }: gen changes if the stream was replaced, stamp if it changed; throws if it is gone
//   read(name, from, to)   the bytes [from, to)
//   append(name, bytes)    one append; a reader sees whole records or a torn tail it can resync past
//   watch(cb)     optional: call cb when something may have changed; returns a function that stops it
// memoryStore keeps the streams in memory; its onAppend hook lets a host (a browser tab, say) persist new bytes
// however it can, and a store rebuilt from the same bytes folds identically. The folder store is in lib/pharos.mjs.

let MEMORY_STORES = 0;
export function memoryStore(opts = {}) {
  const streams = new Map(); // name -> { buf, size }
  const gone = (name) => Object.assign(new Error(`ENOENT: no stream ${name}`), { code: 'ENOENT' });
  return {
    id: 'memory:' + (++MEMORY_STORES), dir: null,
    ensure() {},
    list() { return [...streams.keys()].filter((n) => n.endsWith(EXT)).sort(); },
    stat(name) { const f = streams.get(name); if (!f) throw gone(name); return { size: f.size, gen: 0, stamp: f.size }; },
    read(name, from, to) { const f = streams.get(name); if (!f) throw gone(name); return new Uint8Array(f.buf.subarray(from, to)); },
    append(name, bytes) {
      let f = streams.get(name);
      if (!f) streams.set(name, f = { buf: new Uint8Array(Math.max(1024, bytes.length)), size: 0 });
      if (f.size + bytes.length > f.buf.length) { const n = new Uint8Array(Math.max(f.buf.length * 2, f.size + bytes.length)); n.set(f.buf.subarray(0, f.size)); f.buf = n; }
      f.buf.set(bytes, f.size); f.size += bytes.length;
      if (opts.onAppend) opts.onAppend(name, new Uint8Array(bytes));
    },
    // Every stream as bytes, to persist or ship; and the inverse, to rebuild a store from them (no hook fires: these bytes are already persisted).
    dump() { return new Map([...streams].map(([n, f]) => [n, new Uint8Array(f.buf.subarray(0, f.size))])); },
    restore(name, bytes) { const hook = opts.onAppend; opts.onAppend = null; try { this.append(name, bytes); } finally { opts.onAppend = hook; } },
  };
}

// ---- handle -----------------------------------------------------------------

export function open(name = 'default', opts = {}) {
  const writer = opts.writer;
  if (typeof writer !== 'string' || !/^[A-Za-z0-9._-]+$/.test(writer)) throw new PharosError('BAD_WRITER', `writer must match [A-Za-z0-9._-]+: ${writer}`);
  const store = opts.store;
  if (!store) throw new PharosError('NO_STORE', 'open needs a store (the Node entry point builds a folder store from dir)');
  store.ensure();
  const h = { name, dir: store.dir ?? null, writer, by: writer, store, file: null };
  if (opts.frame !== false && !load(h).frames) {
    // Another process may create the frame first; that is fine, the frame is then already there.
    try { weave(h, { cell: BOOT.frame, kind: 'frame', addr: `frame:${name}`, body: { name, epoch: new Date().toISOString(), assumed: [] } }); }
    catch (err) { if (!(err instanceof PharosError && err.code === 'FRAME_EXISTS')) throw err; }
    const have = declaredKinds(viewOf(h));
    for (const [k, cell] of Object.entries(BOOT)) {
      if (!have.has(k)) weave(h, { cell: BOOT.kind, kind: 'kind', addr: `kind:${k}`, body: { name: k, cell } });
    }
  }
  return h;
}

// One write for the whole batch, so a reader sees whole records or a torn tail it can resync past.
function append(h, ents) {
  if (!ents.length) return;
  h.store.append(h.writer + EXT, recordBytes(ents));
}
/** append records to a named stream of this pharos's store (the Node tools use it to import legacy files) */
export const appendTo = (h, stream, ents) => { if (ents.length) h.store.append(stream, recordBytes(ents)); };

// Reads records from buf (which starts at stream offset base). Returns how many bytes are final: everything
// up to the first incomplete record at the tail, which stays unconsumed so a later read can finish it.
function scan(buf, base, c, f) {
  let i = 0;
  const dv = view(buf);
  const bad = (reason, len) => { c.corrupt.push({ file: f, offset: base + i, reason }); const j = indexOfBytes(buf, MAGIC, i + (len || 1)); i = j < 0 ? buf.length : j; };
  while (i < buf.length) {
    const rest = buf.length - i;
    if (rest < MAGIC.length && bytesEqual(MAGIC.subarray(0, rest), buf.subarray(i))) break; // a magic still being written
    if (!bytesEqual(buf.subarray(i, i + MAGIC.length), MAGIC)) { bad('no record marker'); continue; }
    const len = rest >= 8 ? dv.getUint32(i + 4, false) : -1;
    if (len < 0 || len > MAX_RECORD || i + 8 + len + 4 > buf.length) {
      if (len > MAX_RECORD) { bad('record length out of range'); continue; }
      const j = indexOfBytes(buf, MAGIC, i + 1);
      if (j < 0) break; // truncated tail with nothing after it: possibly still being written
      bad('truncated record'); continue;
    }
    const payload = buf.subarray(i + 8, i + 8 + len);
    if (!bytesEqual(check(payload), buf.subarray(i + 8 + len, i + 12 + len))) { bad('checksum mismatch'); continue; }
    let e;
    try { e = decode(payload); } catch (err) { bad('undecodable record'); continue; }
    const why = invalidEntry(e);
    if (why) { bad(why, 12 + len); continue; }
    if (e.kind === 'frame') c.frames = true;
    c.ents.push(e);
    i += 12 + len;
  }
  return i;
}

// One parsed stream, cached by store and name. Streams are append-only, so when one grew only the bytes after the
// last complete record are read; otherwise (shrunk, replaced) it is re-parsed from the start.
const CACHE = new Map();
function parseFile(store, f) {
  const key = store.id + '/' + f;
  const st = store.stat(f); // throws if the stream vanished
  let c = CACHE.get(key);
  if (c && c.gen === st.gen && c.size === st.size && c.stamp === st.stamp) return c;
  const tail = c && c.gen === st.gen && st.size > c.size;
  if (!tail) c = { ents: [], corrupt: [], pos: 0, frames: false };
  const from = tail ? c.pos : 0;
  const buf = store.read(f, from, st.size);
  const used = scan(buf, from, c, f);
  c.pos = from + used;
  c.pending = used < buf.length ? { file: f, offset: c.pos, reason: 'truncated tail' } : null;
  Object.assign(c, { gen: st.gen, size: st.size, stamp: st.stamp });
  CACHE.set(key, c);
  return c;
}
/** the parsed state of one stream of this pharos: { ents, corrupt, pending } (throws if the stream is gone) */
export const streamInfo = (h, name) => parseFile(h.store, name);

// Union of every stream in the store, deduped by id. Damaged records are reported, never fatal.
function load(h) {
  const entries = new Map();
  const corrupt = [];
  const writers = [];
  let frames = false;
  const files = h.store.list();
  for (const f of files) {
    let c;
    try { c = parseFile(h.store, f); } catch (err) { continue; } // vanished between listing and reading
    for (const e of c.ents) if (!entries.has(e.id)) entries.set(e.id, e);
    corrupt.push(...c.corrupt.map((x) => ({ ...x })));
    if (c.pending) corrupt.push({ ...c.pending });
    if (c.frames) frames = true;
    writers.push({ writer: f.slice(0, -EXT.length), file: f, entries: c.ents.length });
  }
  return { entries, corrupt, writers, frames };
}

// ---- causal order, retraction, conflicts -----------------------------------

const preds = (e, entries) => [...new Set([...e.seen, ...e.of])].filter((id) => entries.has(id));
const cmp = (a, b) => rank().get(a.cell) - rank().get(b.cell) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function causalOrder(entries) {
  const indeg = new Map();
  const succ = new Map();
  for (const e of entries.values()) {
    const ps = preds(e, entries);
    indeg.set(e.id, ps.length);
    for (const p of ps) (succ.get(p) || succ.set(p, []).get(p)).push(e.id);
  }
  const ready = []; // kept sorted by (cell rank, id)
  const push = (e) => {
    let lo = 0, hi = ready.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cmp(ready[m], e) < 0) lo = m + 1; else hi = m; }
    ready.splice(lo, 0, e);
  };
  for (const e of entries.values()) if (indeg.get(e.id) === 0) push(e);
  const out = [];
  while (ready.length) {
    const e = ready.shift();
    out.push(e);
    for (const s of succ.get(e.id) || []) {
      indeg.set(s, indeg.get(s) - 1);
      if (indeg.get(s) === 0) push(entries.get(s));
    }
  }
  return out;
}

function viewOf(h) {
  const { entries, corrupt, writers } = load(h);
  const order = causalOrder(entries);
  const referenced = new Set();
  let dangling = 0;
  for (const e of entries.values()) for (const id of [...e.seen, ...e.of]) {
    if (entries.has(id)) referenced.add(id); else dangling++;
  }
  const idx = new Map(order.map((e, i) => [e.id, i]));
  const frontier = order.filter((e) => !referenced.has(e.id)).map((e) => e.id).sort();
  // A retract is effective unless a later effective retract retracts it; retractors are causally later.
  const retracted = new Set();
  const retractions = [];
  for (let i = order.length - 1; i >= 0; i--) {
    const e = order[i];
    if (e.kind === 'retract' && !retracted.has(e.id)) {
      retractions.push({ id: e.id, of: e.of, by: e.by });
      for (const t of e.of) retracted.add(t);
    }
  }
  retractions.reverse();
  return { entries, order, idx, frontier, retracted, retractions, corrupt, writers, dangling };
}

// Marks every ancestor of `from` (stopping below topological index `lo`) in `seen`. Iterative: chains are long.
function walkBack(v, from, lo, seen) {
  const st = [from];
  while (st.length) for (const p of preds(v.entries.get(st.pop()), v.entries)) if (!seen.has(p) && v.idx.get(p) >= lo) { seen.add(p); st.push(p); }
}

// Per addr+cell group, only the causally maximal entries can conflict: older ones were updated, not contradicted.
// Multiple frames are not conflicts (frame() reports them as merged).
function findConflicts(v, live) {
  const groups = new Map();
  for (const e of live) {
    if (e.kind === 'frame') continue;
    const k = e.addr + '\u0000' + e.cell;
    (groups.get(k) || groups.set(k, []).get(k)).push(e);
  }
  const conflicts = [];
  for (const g of groups.values()) {
    const body = new Map(g.map((e) => [e.id, canonical(e.body)]));
    if (g.every((e) => body.get(e.id) === body.get(g[0].id))) continue;
    const lo = v.idx.get(g[0].id); // g is in causal order
    const seen = new Set(), heads = [];
    for (let n = g.length - 1; n >= 0; n--) { // latest first: a head's ancestors are marked, so covered entries are skipped
      if (seen.has(g[n].id)) continue;
      heads.push(g[n]);
      walkBack(v, g[n].id, lo, seen);
    }
    for (let i = 0; i < heads.length; i++) for (let j = i + 1; j < heads.length; j++) {
      const [a, b] = heads[i].id < heads[j].id ? [heads[i], heads[j]] : [heads[j], heads[i]];
      if (body.get(a.id) !== body.get(b.id)) conflicts.push({ addr: a.addr, cell: a.cell, a: a.id, b: b.id, by: [a.by, b.by] });
    }
  }
  return conflicts;
}

function declaredKinds(v) {
  const kinds = new Map();
  for (const e of v.order) {
    if (e.kind !== 'kind' || v.retracted.has(e.id) || !isObj(e.body) || typeof e.body.name !== 'string') continue;
    if (!kinds.has(e.body.name)) kinds.set(e.body.name, { name: e.body.name, cell: e.body.cell, schema: e.body.schema, id: e.id });
  }
  return kinds;
}

// ---- API --------------------------------------------------------------------

export function weave(h, input) {
  if (!isObj(input)) throw new PharosError('BAD_ENTRY', 'weave needs an object');
  for (const k of Object.keys(input)) {
    if (COMPUTED.has(k)) throw new PharosError('COMPUTED_FIELD', `${k} is computed by weave and cannot be supplied`);
    if (!ALLOWED.has(k)) throw new PharosError('UNKNOWN_FIELD', `unknown field ${k}`);
  }
  const { cell, kind, addr, body } = input;
  if (!hasCell(cell)) throw new PharosError('UNKNOWN_CELL', `unknown cell ${String(cell)}`);
  if (typeof kind !== 'string' || !kind) throw new PharosError('BAD_ENTRY', 'kind must be a non-empty string');
  if (typeof addr !== 'string' || !addr) throw new PharosError('BAD_ENTRY', 'addr must be a non-empty string');
  if (!('body' in input) || body === undefined) throw new PharosError('BAD_ENTRY', 'body is required (use null for none)');
  const of = input.of === undefined ? [] : input.of;
  const basis = input.basis === undefined ? {} : input.basis;
  if (!isStrArr(of)) throw new PharosError('BAD_ENTRY', 'of must be an array of ids');
  if (!isObj(basis)) throw new PharosError('BAD_ENTRY', 'basis must be an object');
  canonical(body); canonical(basis); // reject non-JSON early

  const v = viewOf(h);
  const kinds = declaredKinds(v);
  const decl = kinds.get(kind) || (BOOT[kind] ? { name: kind, cell: BOOT[kind] } : null);
  if (!decl) throw new PharosError('UNDECLARED_KIND', `kind ${kind} is not declared in this pharos`);
  if (decl.cell !== cell) throw new PharosError('KIND_CELL_MISMATCH', `kind ${kind} is declared at ${decl.cell}, not ${cell}`);
  const hasFrame = [...v.entries.values()].some((e) => e.kind === 'frame');
  if (kind === 'frame' && hasFrame) throw new PharosError('FRAME_EXISTS', 'this pharos already has a frame');
  if (kind !== 'frame' && !hasFrame) throw new PharosError('NO_FRAME', 'the first entry of a pharos is its frame');
  for (const id of of) if (!v.entries.has(id)) throw new PharosError('UNKNOWN_OF', `of references unknown entry ${id}`);
  if (kind === 'retract' && !of.length) throw new PharosError('BAD_ENTRY', 'retract needs of: the ids it retracts');
  if (kind === 'kind') {
    if (!isObj(body) || typeof body.name !== 'string' || !hasCell(body.cell)) throw new PharosError('BAD_KIND', 'kind body needs {name, cell} with a known cell');
    const prior = kinds.get(body.name) || (BOOT[body.name] && { cell: BOOT[body.name] });
    if (prior && prior.cell !== body.cell) throw new PharosError('KIND_REDECLARED', `kind ${body.name} is already declared at ${prior.cell}`);
  }
  if (kind === 'holon') {
    if (!isObj(body) || typeof body.name !== 'string') throw new PharosError('BAD_HOLON', 'holon body needs a name');
    for (const k of ['ground', 'figure', 'pattern', 'out']) if (k in body && !isStrArr(body[k])) throw new PharosError('BAD_HOLON', `holon ${k} must be an array of kind names`);
  }

  const ofSorted = [...new Set(of)].sort();
  // Identical content from the same writer is the same weft: re-weaving is a no-op (unless it was retracted).
  const key = canonical({ cell, kind, addr, body, of: ofSorted, basis, by: h.by });
  // Not a no-op once a later live entry at the same addr+cell has changed the value (x=1, x=2, x=1 is a revert).
  const superseded = (e) => {
    const lo = v.idx.get(e.id), mine = canonical(e.body);
    for (let i = lo + 1; i < v.order.length; i++) {
      const c = v.order[i];
      if (c.addr !== e.addr || c.cell !== e.cell || c.kind === 'retract' || v.retracted.has(c.id) || canonical(c.body) === mine) continue;
      const anc = new Set();
      walkBack(v, c.id, lo, anc);
      if (anc.has(e.id)) return true;
    }
    return false;
  };
  for (const e of v.entries.values()) {
    if (e.addr !== addr || e.cell !== cell || e.kind !== kind || e.by !== h.by || v.retracted.has(e.id)) continue;
    if (canonical({ cell: e.cell, kind: e.kind, addr: e.addr, body: e.body, of: e.of, basis: e.basis, by: e.by }) === key && !superseded(e)) return e;
  }
  const entry = { v: 1, cell, kind, addr, body, of: ofSorted, basis, seen: v.frontier, by: h.by, at: new Date().toISOString() };
  entry.id = entryId(entry);
  append(h, [entry]);
  return entry;
}

export function entries(h) { return viewOf(h).order; }

export function fold(h, filter = {}) {
  const v = viewOf(h);
  const ok = (x) => (!filter.cell || x.cell === filter.cell) && (!filter.kind || x.kind === filter.kind) && (!filter.addr || x.addr === filter.addr);
  const live = v.order.filter((e) => e.kind !== 'retract' && !v.retracted.has(e.id));
  return {
    entries: live.filter(ok),
    retractions: v.retractions,
    conflicts: findConflicts(v, live).filter((c) => (!filter.cell || c.cell === filter.cell) && (!filter.addr || c.addr === filter.addr)),
    corrupt: v.corrupt,
    frontier: v.frontier,
  };
}

// Views: the binary log is the root; JSON and JSONL are folded out of it on demand and never read back.
export function toJSON(h, filter = {}) { return jsonSafe(fold(h, filter)); }
export function toJSONL(h, filter = {}) {
  return fold(h, filter).entries.map((e) => JSON.stringify(jsonSafe(e)) + '\n').join('');
}

// Lossless export: every entry the log holds, retractions and retracted entries included, as canonical JSON
// (one entry per line, ids and of/seen untouched). Unlike toJSONL it does not fold. Raw bytes in a body come out
// as {"$bytes":"<base64>"}; the id is unchanged, the type on re-import is an object. (Writing one file per
// stream to a folder is a Node tool: see exportAll in lib/pharos.mjs.)
export function exportLines(h) { return entries(h).map((e) => canonical(e) + '\n').join(''); }

export function frame(h) {
  const v = viewOf(h);
  const fs_ = v.order.filter((e) => e.kind === 'frame' && !v.retracted.has(e.id));
  if (!fs_.length) return null;
  const [f, ...rest] = fs_;
  const one = (e) => { const b = isObj(e.body) ? e.body : {}; return { id: e.id, name: b.name, writer: e.by, epoch: b.epoch, assumed: b.assumed || [] }; };
  return { ...one(f), merged: rest.map(one) };
}

export function ground(h) {
  const v = viewOf(h);
  const live = v.order.filter((e) => !v.retracted.has(e.id));
  return {
    frame: frame(h),
    kinds: [...declaredKinds(v).values()],
    holons: live.filter((e) => e.kind === 'holon').map((e) => ({ id: e.id, ...e.body })),
    frontier: v.frontier,
  };
}

export function status(h) {
  const v = viewOf(h);
  const live = v.order.filter((e) => e.kind !== 'retract' && !v.retracted.has(e.id));
  return {
    name: h.name, dir: h.dir, entries: v.entries.size, live: live.length, retracted: v.retracted.size,
    writers: v.writers, frontier: v.frontier, conflicts: findConflicts(v, live).length,
    corrupt: v.corrupt.length, dangling: v.dangling,
    frames: v.order.filter((e) => e.kind === 'frame').length,
  };
}

// Calls fn(entry) for entries this watcher has not yet seen. Starts from now unless since is
// 'beginning' (replay all) or an array of ids to treat as already seen. No daemon: the store's watch(cb) if it has
// one (the folder store uses fs.watch), plus poll().
export function watch(h, opts, fn) {
  const { cell, kind, since } = opts || {};
  const seen = new Set(Array.isArray(since) ? since : since === 'beginning' ? [] : load(h).entries.keys());
  const poll = () => {
    let n = 0;
    for (const e of viewOf(h).order) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      if ((cell && e.cell !== cell) || (kind && e.kind !== kind)) continue;
      fn(e); n++;
    }
    return n;
  };
  let timer = null, off = null;
  try { if (h.store.watch) off = h.store.watch(() => { clearTimeout(timer); timer = setTimeout(poll, 25); }); } catch (err) { /* poll() still works */ }
  return { poll, stop() { clearTimeout(timer); if (off) off(); } };
}

// Union of B into A, appended (re-encoded, same content and ids) to A's own writer stream. Grow-only, so idempotent,
// commutative and associative on the set of entries.
export function merge(hA, hB) {
  const a = load(hA).entries;
  const add = [];
  for (const [id, e] of load(hB).entries) if (!a.has(id)) add.push(e);
  append(hA, add);
  return { added: add.length };
}
