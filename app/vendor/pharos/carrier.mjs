// carrier: move a pharos through anything that can store immutable, uniquely named blobs. Portable (core.mjs only).
// A CARRIER is three calls, each sync or async:
//     list()            -> names (any depth; the caller filters)
//     get(name)         -> bytes | null
//     putNew(name, bytes)   create; if the name exists with the same bytes it is a no-op; with different bytes it throws
// That is all a folder inside a cloud drive, a WebDAV share, an S3 bucket or a USB stick can do, and none of them is trusted:
// every segment verifies itself (its name carries a hash of its bytes), every entry in it is checked, nothing is ever overwritten.
//
// Layout:   <writer>/<seq:6>-<count>-<hash8>.seg      one per publish; the bytes are pharos records (the same as a .phr stream)
//   seq     1,2,3 ... per writer, so a missing number is a visible gap
//   count   entries inside, so a writer's cursor (how many it has already published) is the sum over its own segments: no state file
//   hash8   first 4 bytes of sha256(bytes): a half-synced or altered file does not match its own name and is skipped, then retried
import * as core from './core.mjs';
import { intake } from './intake.mjs';

const NAME = /^([A-Za-z0-9._-]+)\/(\d{6})-(\d+)-([0-9a-f]{8})\.seg$/;
const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('');
export const hash8 = (bytes) => hex(core.sha256(bytes)).slice(0, 8);
export const parseName = (name) => { const m = NAME.exec(name); return m ? { writer: m[1], seq: +m[2], count: +m[3], hash8: m[4], name } : null; };
const segName = (writer, seq, count, bytes) => `${writer}/${String(seq).padStart(6, '0')}-${count}-${hash8(bytes)}.seg`;
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/** an in-memory carrier; `files` is a Map name -> bytes (tests read and corrupt it directly) */
export function memoryCarrier(files = new Map()) {
  return {
    files,
    list: () => [...files.keys()],
    get: (n) => (files.has(n) ? files.get(n) : null),
    putNew(n, bytes) { const had = files.get(n); if (had) { if (same(had, bytes)) return; throw new core.PharosError('EXISTS', `${n} exists with different bytes; carriers never overwrite`); } files.set(n, new Uint8Array(bytes)); },
  };
}

// this replica's own entries, once each: its stream can hold the same entry twice (after a restore, or a peer echoing it back)
export const ownEntries = (h) => { const c = core.streamInfo(h, h.writer + '.phr'); const seen = new Set(); return c.ents.filter((e) => e.by === h.writer && !seen.has(e.id) && seen.add(e.id)); };
const lanes = (names) => { const m = new Map(); for (const n of names) { const p = parseName(n); if (!p) continue; (m.get(p.writer) || m.set(p.writer, []).get(p.writer)).push(p); } for (const l of m.values()) l.sort((a, b) => a.seq - b.seq); return m; };

/** write this replica's own new entries as one new segment; returns { published, name } (nothing to publish is not an error) */
export async function publish(h, carrier) {
  let own = []; try { own = ownEntries(h); } catch (err) { /* no stream yet */ }
  const mine = (lanes(await carrier.list()).get(h.writer)) || [];
  const done = mine.reduce((n, s) => n + s.count, 0);
  const fresh = own.slice(done);
  if (!fresh.length) return { published: 0, name: null };
  const bytes = core.recordBytes(fresh);
  const seq = (mine.at(-1)?.seq || 0) + 1;
  const name = segName(h.writer, seq, fresh.length, bytes);
  await carrier.putNew(name, bytes);
  return { published: fresh.length, name };
}

/** the verified entries of one segment's bytes (damaged records are counted, not returned) */
export function segmentEntries(name, bytes) { const c = core.streamInfo({ store: memStore(name, bytes) }, name); return { ents: c.ents, damaged: c.corrupt.length + (c.pending ? 1 : 0) }; }
const memStore = (f, bytes) => ({ id: 'seg:' + f + ':' + hash8(bytes), list: () => [f], stat: () => ({ size: bytes.length, gen: 0, stamp: 0 }), read: (_n, a, b) => bytes.subarray(a, b) });

/**
 * Bring segments from the carrier into this replica. Newest first within each writer, so a budget gets the most recent work.
 * @param writers  only these lanes (default all but this replica's own)
 * @param budget   { segments } stop after taking this many
 * @param known    Set of segment names already merged by an earlier call (optional; skipping them is only an optimisation, entries dedupe by id)
 * @returns { segments, entries, bad:[{name, why}], gaps:[{writer, missing:[seq]}], left }
 */
export async function fetch(h, carrier, { writers, budget = {}, known = new Set(), policy = null, quarantineCap } = {}) {
  const lane = lanes(await carrier.list());
  const have = new Set(); for (const f of h.store.list()) { try { for (const e of core.streamInfo(h, f).ents) have.add(e.id); } catch (err) { /* vanished */ } }
  const todo = [];
  for (const [w, segs] of lane) { if (writers ? !writers.includes(w) : w === h.writer) continue; for (const s of segs.slice().reverse()) if (!known.has(s.name)) todo.push(s); }
  todo.sort((a, b) => b.seq - a.seq);
  const cap = budget.segments ?? Infinity; const bad = []; let segments = 0, entries = 0, left = 0, waiting = 0;
  for (const s of todo) {
    if (segments >= cap) { left++; continue; }
    const bytes = await carrier.get(s.name);
    if (!bytes) { bad.push({ name: s.name, why: 'listed but not readable yet' }); continue; }
    if (hash8(bytes) !== s.hash8) { bad.push({ name: s.name, why: 'bytes do not match the name (partial or altered); will retry' }); continue; }
    const c = core.streamInfo({ store: memStore(s.name, bytes) }, s.name);
    if (c.pending || c.corrupt.length) { bad.push({ name: s.name, why: 'damaged records' }); }
    const valid = []; let forged = 0;
    for (const e of c.ents) { if (core.invalidEntry(e)) { forged++; continue; } valid.push(e); }
    if (forged) bad.push({ name: s.name, why: `${forged} entries failed their own id check` });
    const r = intake(h, valid, { policy, cap: quarantineCap });
    entries += r.accepted.length; segments++; waiting = r.quarantined;
    if (!c.pending && !c.corrupt.length && !forged) known.add(s.name);
  }
  return { segments, entries, bad, gaps: gaps(await carrier.list()), left, quarantined: waiting };
}

/** per writer, the sequence numbers missing between 1 and the highest seen: loss or a file not arrived yet, said out loud */
export function gaps(names) {
  const out = [];
  for (const [writer, segs] of lanes(names)) {
    const have = new Set(segs.map((s) => s.seq)); const missing = [];
    for (let i = 1; i <= segs.at(-1).seq; i++) if (!have.has(i)) missing.push(i);
    if (missing.length) out.push({ writer, missing });
  }
  return out;
}
