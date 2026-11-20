// sig.mjs: SIG structures that let reads and writes skip folding the whole log. All of them are DERIVED: delete `<log>.sig/` and they are
// rebuilt from the log; nothing here is authoritative, and every use is checked against the real entries.
//
// The kinds follow the three grains of the SIG cells in pharos's cells.json (all Relate, Existence):
//   SIG·Ground  (Void, Tending)   the EXPRESSWAY: a checkpoint over a whole area with an explicit claim, "complete to this position".
//                                 It holds the writer's causal frontier (so a lazy write can supply `seen` without loading the log) and
//                                 memoised answers, valid only at the exact position they were computed at.
//   SIG·Figure  (Entity, Binding) the SYNAPSE: attention bound to particular things: for a kind, the addresses that carry it, so a
//                                 question about that kind reads those addresses' shards and not every shard. A pointer, never an answer.
//   SIG·Pattern (Kind, Tracing)   the WORMHOLE: a route along `of` links. An id-to-location map lets a walk along a chain hop straight to
//                                 each entry with one positioned read, skipping everything in between.
// One tail scanner keeps all three current by reading only the bytes appended since the last scan.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const safe = (s) => String(s).replace(/[^A-Za-z0-9._-]/g, '-');

function listFiles(dir, exts = ['.jsonl']) {
  const out = [];
  const walk = (d, rel) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(path.join(d, e.name), r); else if (exts.some((x) => e.name.endsWith(x))) out.push(r);
    }
  };
  if (fs.existsSync(dir)) walk(dir, '');
  return out.sort();
}
// position covers pharos's binary .phr streams too: it must change whenever the log does, whatever its format. The index itself reads only .jsonl shards.
export const position = (dir) => sha(listFiles(dir, ['.jsonl', '.phr']).map((r) => `${r}:${fs.statSync(path.join(dir, r)).size}`).join('\n'));

export class Sig {
  constructor(dir, who) {
    this.dir = path.resolve(dir); this.who = safe(who || 'reader');
    this.sigDir = this.dir + '.sig'; this.file = path.join(this.sigDir, `${this.who}.bin`);
    this.dirty = false;
    this._load();
    if (!Sig._hooked) { Sig._open = new Set(); process.on('exit', () => { for (const s of Sig._open) s.flush(); }); Sig._hooked = true; }
    Sig._open.add(this);
  }
  _reset() { this.files = []; this.fileIdx = new Map(); this.heads = new Set(); this.refd = new Set(); this.ofref = new Set(); this.hasOf = new Set(); this.all = new Set(); this.byKind = new Map(); this.retracted = new Set(); this.loc = new Map(); this.syn = {}; this.calib = null; this.dirty = true; }
  // The saved state is BINARY (<log>.sig/<who>.bin): ids as raw 32-byte values, offsets and lengths as varints, repeated ids in the sets as an index
  // into the record table. Meaning is the same; only the encoding differs. A state that cannot be read is discarded and rebuilt from the log.
  _load() {
    this._reset();
    if (!fs.existsSync(this.file)) return;
    try {
      const b = fs.readFileSync(this.file); if (b.subarray(0, 4).toString() !== 'SIG2') return;
      let p = 4; const vi = () => { let x = 0, sh = 0, c; do { c = b[p++]; x += (c & 0x7f) * 2 ** sh; sh += 7; } while (c & 0x80); return x; };
      const ml = vi(), meta = JSON.parse(b.subarray(p, p + ml).toString('utf8')); p += ml;
      this.files = meta.files; this.files.forEach((f, i) => this.fileIdx.set(f.rel, i)); this.calib = meta.calib || null; this.syn = meta.syn || {};
      const n = vi(), ids = new Array(n);
      for (let i = 0; i < n; i++) {
        const id = b.subarray(p, p + 32).toString('hex'); p += 32; const f = vi(), off = vi(), len = vi(), k = meta.kinds[vi()];
        ids[i] = id; this.loc.set(id, [f, off, len, k]); this.all.add(id);
        let a = this.byKind.get(k); if (!a) this.byKind.set(k, a = []); a.push(id);
      }
      const set = (into) => { const c = vi(); for (let i = 0; i < c; i++) { const x = vi(); if (x) into.add(ids[x - 1]); else { into.add(b.subarray(p, p + 32).toString('hex')); p += 32; } } };
      set(this.heads); set(this.refd); set(this.ofref); set(this.hasOf); set(this.retracted);
      if (p !== b.length) throw new Error('trailing bytes'); this.dirty = false;
    } catch { this._reset(); }
  }
  flush() {
    if (!this.dirty) return;
    if (!fs.existsSync(this.dir)) return;          // never write an index beside a log that no longer exists
    const hex = /^[0-9a-f]{64}$/;
    const index = new Map(); let i = 0; for (const id of this.loc.keys()) { if (!hex.test(id)) return; index.set(id, ++i); }   // ids that are not sha-256 hex: keep the state in memory only
    for (const st of [this.heads, this.refd, this.ofref, this.hasOf, this.retracted]) for (const id of st) if (!hex.test(id)) return;
    const kinds = [...new Set([...this.loc.values()].map((v) => v[3]))], kindIdx = new Map(kinds.map((k, j) => [k, j]));
    const parts = []; const vi = (x) => { const o = []; while (x >= 0x80) { o.push((x % 128) | 0x80); x = Math.floor(x / 128); } o.push(x); parts.push(Buffer.from(o)); };
    parts.push(Buffer.from('SIG2')); const meta = Buffer.from(JSON.stringify({ files: this.files, kinds, calib: this.calib, syn: this.syn })); vi(meta.length); parts.push(meta);
    vi(this.loc.size);
    for (const [id, v] of this.loc) { parts.push(Buffer.from(id, 'hex')); vi(v[0]); vi(v[1]); vi(v[2]); vi(kindIdx.get(v[3])); }
    const put = (st) => { vi(st.size); for (const id of st) { const x = index.get(id); if (x) vi(x); else { vi(0); parts.push(Buffer.from(id, 'hex')); } } };
    put(this.heads); put(this.refd); put(this.ofref); put(this.hasOf); put(this.retracted);
    fs.mkdirSync(this.sigDir, { recursive: true });
    const tmp = this.file + '.tmp'; fs.writeFileSync(tmp, Buffer.concat(parts)); fs.renameSync(tmp, this.file); this.dirty = false;
    fs.rmSync(path.join(this.sigDir, `${this.who}.json`), { force: true });      // the old JSON state, if any
  }
  rebuild() { const n = (this.rebuilds || 0) + 1; this._reset(); this.rebuilds = n; return this.advance(); }

  // advance: read only the bytes appended since the last scan; rebuild from scratch if any file shrank or its checked bytes changed.
  advance() {
    let scanned = 0, entries = 0;
    for (const rel of listFiles(this.dir)) {
      const abs = path.join(this.dir, rel), size = fs.statSync(abs).size;
      let i = this.fileIdx.get(rel);
      if (i === undefined) { i = this.files.push({ rel, off: 0, tail: '' }) - 1; this.fileIdx.set(rel, i); }
      const f = this.files[i];
      if (size === f.off) continue;
      const fd = fs.openSync(abs, 'r');
      try {
        if (size < f.off) { fs.closeSync(fd); return this.rebuild(); }
        if (f.off > 0) {
          const n = Math.min(32, f.off), chk = Buffer.alloc(n); fs.readSync(fd, chk, 0, n, f.off - n);
          if (sha(chk) !== f.tail) { fs.closeSync(fd); return this.rebuild(); }
        }
        const buf = Buffer.alloc(size - f.off); fs.readSync(fd, buf, 0, buf.length, f.off);
        scanned += buf.length;
        const lastNl = buf.lastIndexOf(10);
        if (lastNl < 0) continue;                                  // only a torn partial line so far
        let start = 0;
        while (start <= lastNl) {
          const nl = buf.indexOf(10, start);
          if (nl > start) { if (this._ingest(buf.subarray(start, nl).toString('utf8'), i, f.off + start, nl - start)) entries++; }
          start = nl + 1;
        }
        const newOff = f.off + lastNl + 1, n = Math.min(32, newOff), chk = Buffer.alloc(n); fs.readSync(fd, chk, 0, n, newOff - n);
        f.off = newOff; f.tail = sha(chk); this.dirty = true;
      } finally { try { fs.closeSync(fd); } catch { /* already closed */ } }
    }
    return { scanned, entries };
  }
  _ingest(line, fileIdx, offset, len) {
    let e; try { e = JSON.parse(line); } catch { return false; }
    if (!e || typeof e.id !== 'string' || this.all.has(e.id)) return false;
    this.all.add(e.id); this.loc.set(e.id, [fileIdx, offset, len, e.kind]);
    if (!this.refd.has(e.id)) this.heads.add(e.id);
    if ((e.of || []).length) { this.hasOf.add(e.id); for (const r of e.of) this.ofref.add(r); }
    for (const r of [...(e.of || []), ...(e.seen || [])]) { this.refd.add(r); this.heads.delete(r); }
    let a = this.byKind.get(e.kind); if (!a) this.byKind.set(e.kind, a = []); a.push(e.id);
    if (e.kind === 'retract') for (const r of e.of || []) this.retracted.add(r);     // a retraction hides what it cites
    this.dirty = true; return true;
  }

  // ---- SIG·Ground: the expressway --------------------------------------------------------------------------------------------
  frontier() { this.advance(); return [...this.heads].sort(); }                      // what a write can cite as `seen`, without loading the log
  memoFile() { return path.join(this.sigDir, `memo-${this.who}.json`); }
  memoGet(key) {
    const pos = position(this.dir);
    try { const m = JSON.parse(fs.readFileSync(this.memoFile(), 'utf8'))[key]; return m && m.pos === pos ? m : null; } catch { return null; }
  }
  memoPut(key, value) {
    fs.mkdirSync(this.sigDir, { recursive: true });
    let all = {}; try { all = JSON.parse(fs.readFileSync(this.memoFile(), 'utf8')); } catch { /* new */ }
    all[key] = { pos: position(this.dir), claim: 'complete to this position', value };
    fs.writeFileSync(this.memoFile(), JSON.stringify(all));
  }

  // ---- SIG·Figure: pointers to particular entries ------------------------------------------------------------------------------
  // The ids of a kind, and a direct read of those entries by positioned reads (no query planning). Rows carry the same fields the query
  // engine's rows carry for these purposes, with _retracted = 1 when a live retraction cites the entry. Double retraction (a retraction
  // of a retraction, which restores the original in pharos) is NOT handled here, so the chooser never sends such a log down this path.
  idsOfKind(kind) { this.advance(); return this.byKind.get(kind) || []; }
  readKindDirect(kind) {
    return this.idsOfKind(kind).map((id) => {
      const e = this.readAt(id);
      return { _id: e.id, _addr: e.addr, _kind: e.kind, _cell: e.cell, _by: e.by, _at: e.at, _of: e.of || [], body: e.body, _retracted: this.retracted.has(id) ? 1 : 0 };
    });
  }
  // entries that cite something by `of` and are cited by nothing by `of`: the tops of `of` chains (unlike heads, `seen` does not count)
  ofHeads() { this.advance(); return [...this.hasOf].filter((id) => !this.ofref.has(id)).sort(); }
  hasDoubleRetraction() { return (this.byKind.get('retract') || []).some((id) => this.retracted.has(id)); }

  // ---- SIG·Pattern: the wormhole -----------------------------------------------------------------------------------------------
  readAt(id) {
    const l = this.loc.get(id); if (!l) return null;
    const abs = path.join(this.dir, this.files[l[0]].rel), fd = fs.openSync(abs, 'r');
    try { const b = Buffer.alloc(l[2]); fs.readSync(fd, b, 0, l[2], l[1]); return JSON.parse(b.toString('utf8')); } finally { fs.closeSync(fd); }
  }
  // ancestors: walk `of` links from an entry, one positioned read per hop. Returns the entries in the order reached, and the hops taken.
  ancestors(id, { max = 100000 } = {}) {
    this.advance();
    const out = [], seen = new Set([id]); const queue = [id]; let hops = 0;
    while (queue.length && out.length < max) {
      const cur = queue.shift(), e = this.readAt(cur); hops++;
      if (!e) continue;
      if (cur !== id) out.push(e);
      for (const r of e.of || []) if (!seen.has(r)) { seen.add(r); queue.push(r); }
    }
    return { ancestors: out, hops };
  }
  status() { this.advance(); return { files: this.files.length, entries: this.all.size, heads: this.heads.size, kinds: this.byKind.size, bytesScanned: this.files.reduce((s, f) => s + f.off, 0), calibrated: !!this.calib }; }
}
