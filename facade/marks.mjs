// marks.mjs: SIG marks. Attention recorded as real entries of the three SIG cells, in their own store (`<log>.marks/`, a lazy pharos), OFF by default.
//   sig.ground  at SIG·Ground   "I read this area completely, as of this position"   (an area-level claim: complete to position P)
//   sig.figure  at SIG·Figure   "this question, from this asker and standpoint, was answered by these entries" (pointers, never answers)
//   sig.pattern at SIG·Pattern  "I read this kind: so many rows, this long, by this path" (a trail by kind; strength decays)
// Marks never change an answer: reads are done first and marks are written after. They live apart from the log so they do not enlarge it, change
// its folds or its position, or travel with it. Only a reader's OWN marks count toward promoting a shortcut (another writer's marks are ignored).
//
// Promotion (the held-out check). Every PROBE_EVERY-th read of a kind, the reader runs BOTH paths, compares their rows, and records both costs in a
// pattern mark (a "probe"). A direct read is promoted for a kind when, on the LATER third of its probes (held out from the earlier two thirds
// that nominated it), it costs under MARGIN of the scan in at least 80 percent of probes and its rows were identical in every probe. It is demoted
// when later probes show it is not cheaper or ever not identical. With too few probes it stays undecided and the estimate decides.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { libs, openStore } from './store.mjs';

export const CELLS = { ground: 'SIG·Ground', figure: 'SIG·Figure', pattern: 'SIG·Pattern' };
export const PROBE_EVERY = 5, MIN_PROBES = 6, MARGIN = 0.7;
// Pheromone, on a clock that no calendar sets. Time passes only when something makes a DIFFERENCE (a measured saving, or a verdict overriding the
// estimator): a mark's age is the number of such events since it was deposited. Its half-life is the median gap, in those events, between one
// difference on a kind and the next difference on the SAME kind (how fast a useful trail is actually come back to). A mark is forgotten once it is
// older than the longest such gap ever seen: nothing has ever returned to a trail that stale. (The difference marks are kept: they ARE the clock.) With fewer than MIN_REUSE observed gaps there is no
// evidence of a rate, so nothing decays. Everything is a function of the marks alone: no clock, no `now`.
export const MIN_REUSE = 5, EVIDENCE_WINDOW = 400;
export const isDifference = (m) => (m.gainMs || 0) > 0 || (m.gainReads || 0) > 0 || m.changed === true;
const safe = (s) => String(s).replace(/[^A-Za-z0-9._-]/g, '-');
export const markDir = (dir) => path.resolve(dir) + '.marks';
export const enabled = (dir) => fs.existsSync(path.join(markDir(dir), 'ENABLED'));
export function setEnabled(dir, on = true) {
  const f = path.join(markDir(dir), 'ENABLED');
  if (on) { fs.mkdirSync(markDir(dir), { recursive: true }); fs.writeFileSync(f, 'marks are recorded while this file exists\n'); } else fs.rmSync(f, { force: true });
  return enabled(dir);
}

const handles = new Map();
async function handle(dir, who) {
  const k = `${path.resolve(dir)}|${who}`;
  // a cached handle is only good while its store still exists on disk (the folder may have been removed or recreated)
  if (handles.has(k) && fs.existsSync(path.join(markDir(dir), 'PLACEMENT.json'))) return handles.get(k);
  handles.delete(k);
  const h = await openStore({ dir: markDir(dir), writer: `m-${safe(who)}`, store: 'lazy' }); handles.set(k, h); return h;
}
// ids kept as raw 32-byte values, base64 in the entry: 43 characters instead of 66
export const packIds = (ids) => Buffer.concat(ids.map((id) => Buffer.from(id, 'hex'))).toString('base64');
export const unpackIds = (b64) => { const b = Buffer.from(b64 || '', 'base64'), out = []; for (let i = 0; i + 32 <= b.length; i += 32) out.push(b.subarray(i, i + 32).toString('hex')); return out; };
let counter = 0n;
export async function mark(dir, who, type, addr, body) {
  if (!enabled(dir) || !CELLS[type]) return null;
  const h = await handle(dir, who);
  // seq orders marks even inside one millisecond: the clock in milliseconds, then a counter
  const seq = String(BigInt(Date.now()) * 1000000n + (counter++ % 1000000n));
  return h.weave({ cell: CELLS[type], kind: `sig.${type}`, addr, body: { ...body, at: new Date().toISOString(), seq }, of: [] });
}

// readMarks: every mark of a type, oldest first by position in the store. Only marks written by `who` unless `all` is set.
export async function readMarks(dir, type, { who, all = false } = {}) {
  if (!fs.existsSync(path.join(markDir(dir), 'PLACEMENT.json'))) return [];
  const { E } = await libs();
  const h = E.open(`lazy:${markDir(dir)}`, { mode: 'read' });
  try {
    const rows = E.run(h, `SEG(sources; kinds: ["sig.${type}"])`, { params: {} }).rows;
    return rows.filter((r) => all || r._by === `m-${safe(who)}`).map((r) => ({ id: r._id, by: r._by, addr: r._addr, cell: r._cell, ...r.body }))
      .sort((a, b) => { const x = BigInt(a.seq || 0), y = BigInt(b.seq || 0); return x < y ? -1 : x > y ? 1 : 0; });
  } finally { E.close(h); }
}

const medianOf = (xs) => { const t = [...xs].sort((x, y) => x - y); return t.length % 2 ? t[(t.length - 1) / 2] : (t[t.length / 2 - 1] + t[t.length / 2]) / 2; };
const bySeq = (a, b) => { const x = BigInt(a.seq || 0), y = BigInt(b.seq || 0); return x < y ? -1 : x > y ? 1 : 0; };
// clock: derive the reader's own pheromone clock from its pattern marks. Returns { ticks, halfLife, maxReuse, reuse, age(m), weight(m), alive(m) }.
export async function clock(dir, who) {
  // One read is one tick, however many marks it deposited: marks sharing an `evt` are one event (a mark with none is its own event).
  const dmd = (await readMarks(dir, 'pattern', { who })).filter(isDifference).sort(bySeq), byEvt = new Map();
  for (const m of dmd) { const k = m.evt || `own:${m.seq}`; const e = byEvt.get(k) || { seq: 0n, kinds: new Set() }; e.seq = BigInt(m.seq || 0) > e.seq ? BigInt(m.seq || 0) : e.seq; e.kinds.add(m.kind); byEvt.set(k, e); }
  const events = [...byEvt.values()].sort((a, b) => (a.seq < b.seq ? -1 : a.seq > b.seq ? 1 : 0));
  const lastIdx = new Map(), gaps = [];
  events.forEach((e, i) => { for (const k of e.kinds) { if (lastIdx.has(k)) gaps.push(i - lastIdx.get(k)); lastIdx.set(k, i); } });
  const seqs = events.map((e) => e.seq), known = gaps.length >= MIN_REUSE;
  const halfLife = known ? medianOf(gaps) : null, maxReuse = known ? Math.max(...gaps) : null;
  const age = (m) => { const s = BigInt(m.seq || 0); let n = 0; for (const q of seqs) if (q > s) n++; return n; };
  const weight = (m) => (halfLife ? Math.pow(2, -age(m) / halfLife) : 1);
  const alive = (m) => (!known || isDifference(m) || age(m) <= maxReuse);   // the differences themselves are the clock and the record of what mattered: they are never dropped, only weighted down
  // The evidence of what was read together (figure marks) is a statistical sample, so it is kept as a sliding window of the last EVIDENCE_WINDOW reads
  // (one tick per read). This is a STATED CONSTANT, not self-emergent: a return-gap horizon was tried and cut the window below what the synapse test
  // needs to see a pair (measured: it finds a pair read every 3rd question at 120 questions and every 6th at 240).
  const figs = (await readMarks(dir, 'figure', { who })).sort(bySeq), rEvt = new Map();
  for (const m of figs) { const k = m.evt || `own:${m.seq}`; const e = rEvt.get(k) || { seq: 0n, addrs: new Set() }; e.seq = BigInt(m.seq || 0) > e.seq ? BigInt(m.seq || 0) : e.seq; for (const a of m.addrs || []) e.addrs.add(a); rEvt.set(k, e); }
  const reads = [...rEvt.values()].sort((a, b) => (a.seq < b.seq ? -1 : a.seq > b.seq ? 1 : 0)), rseqs = reads.map((e) => e.seq);
  const readAge = (m) => { const s = BigInt(m.seq || 0); let n = 0; for (const q of rseqs) if (q > s) n++; return n; };
  return { ticks: events.length, halfLife, maxReuse, reuse: gaps.length, reads: reads.length, readAge, age, weight, alive: (m, type) => (type === 'figure' ? readAge(m) < EVIDENCE_WINDOW : alive(m)) };
}
// live: the marks of one type that have not evaporated, by the clock of the writer that wrote them.
export async function live(dir, type, { who, all = false } = {}) {
  const clocks = new Map(), out = [];
  for (const m of await readMarks(dir, type, { who, all })) {
    const w = all ? String(m.by).replace(/^m-/, '') : who; let c = clocks.get(w); if (!c) clocks.set(w, c = await clock(dir, w));
    if (c.alive(m, type)) out.push(m);
  }
  return out;
}
// trails: pheromone per kind, two numbers. ATTENTION: every read deposits 1, weighted by 2^(-age / half-life). DIFFERENCE: only what a read changed
// (ms saved against the other path as measured on a probe, reads saved, or a verdict overriding the estimate), weighted the same way. A read that
// made no difference adds attention and nothing else, and ranks below what did.
export async function trails(dir, who) {
  const c = await clock(dir, who), t = new Map();
  for (const m of await live(dir, 'pattern', { who })) {
    const w = c.weight(m), x = t.get(m.kind) || { attention: 0, savedMs: 0, savedReads: 0, overrides: 0, reads: 0 };
    x.attention += w; x.savedMs += (m.gainMs || 0) * w; x.savedReads += (m.gainReads || 0) * w; x.overrides += (m.changed ? 1 : 0) * w; x.reads++; t.set(m.kind, x);
  }
  const r3 = (v) => Math.round(v * 1000) / 1000;
  return [...t].map(([kind, x]) => ({ kind, attention: r3(x.attention), savedMs: r3(x.savedMs), savedReads: r3(x.savedReads), overrides: r3(x.overrides), reads: x.reads, madeADifference: x.savedMs > 0 || x.savedReads > 0 || x.overrides > 0 }))
    .sort((a, b) => (b.savedMs + b.savedReads + b.overrides) - (a.savedMs + a.savedReads + a.overrides) || b.attention - a.attention);
}
// evaporate: rebuild the marks store with only live marks (the store is a cache; this is how it stays small).
export async function evaporate(dir) {
  if (!fs.existsSync(path.join(markDir(dir), 'PLACEMENT.json'))) return { kept: 0, dropped: 0 };
  const keep = [], tally = { kept: 0, dropped: 0 }, clocks = new Map();
  for (const type of Object.keys(CELLS)) for (const m of await readMarks(dir, type, { all: true })) {
    const w = String(m.by).replace(/^m-/, ''); let c = clocks.get(w); if (!c) clocks.set(w, c = await clock(dir, w));
    if (c.alive(m, type)) { keep.push({ type, m }); tally.kept++; } else tally.dropped++;
  }
  if (!tally.dropped) return tally;
  const on = enabled(dir);
  for (const k of [...handles.keys()]) if (k.startsWith(path.resolve(dir) + '|')) handles.delete(k);
  fs.rmSync(markDir(dir), { recursive: true, force: true }); if (on) setEnabled(dir, true);
  keep.sort((a, b) => bySeq(a.m, b.m));
  for (const { type, m } of keep) { const { id, by, addr, cell, ...body } = m; await mark(dir, String(by).replace(/^m-/, ''), type, addr, body); }
  return tally;
}
// decide: the held-out check, as a pure function over the probes of one kind (oldest first).
export function decide(probes) {
  if (probes.length < MIN_PROBES) return { state: 'undecided', why: `${probes.length} of ${MIN_PROBES} probes`, probes: probes.length };
  const cut = Math.floor(probes.length * 2 / 3), train = probes.slice(0, cut), test = probes.slice(cut);
  const cheap = (p) => p.directMs < p.scanMs * MARGIN;
  const frac = (xs, f) => xs.filter(f).length / xs.length;
  const identical = probes.every((p) => p.same === true);
  const nominated = frac(train, cheap) >= 0.8 && train.every((p) => p.same === true);
  const testCheap = frac(test, cheap);
  if (!identical) return { state: 'demoted', why: 'a direct read did not reproduce the scan', probes: probes.length, train: train.length, test: test.length };
  if (nominated && testCheap >= 0.8) return { state: 'promoted', why: `cheaper in ${Math.round(testCheap * 100)}% of held-out probes`, probes: probes.length, train: train.length, test: test.length };
  if (testCheap < 0.5) return { state: 'demoted', why: `cheaper in only ${Math.round(testCheap * 100)}% of held-out probes`, probes: probes.length, train: train.length, test: test.length };
  return { state: 'undecided', why: nominated ? 'held-out result is in between' : 'not nominated by the earlier probes', probes: probes.length, train: train.length, test: test.length };
}
export async function promotion(dir, kind, who) {
  const probes = (await live(dir, 'pattern', { who })).filter((m) => m.kind === kind && m.probe).map((m) => m.probe);
  return decide(probes);
}
export async function promotions(dir, who) {
  const kinds = [...new Set((await live(dir, 'pattern', { who })).map((m) => m.kind))];
  const out = {}; for (const k of kinds) out[k] = await promotion(dir, k, who); return out;
}

// noteRead: record one question that touched several things, from any read path (ask, get, trace, brief, a kind read). The figure mark keeps
// the addresses that were touched TOGETHER (this co-presence is the evidence a synapse needs) and pointers to the entries, never the answer.
// Pattern marks record how much of each kind was touched. Written after the answer exists; never changes it. Returns an error string or null.
export async function noteRead(dir, who, { question, standpoint = 'everyone', via, rows, ms = 0, gainReads = 0 }) {
  if (!enabled(dir)) return null;
  const evt = crypto.randomBytes(6).toString('hex');            // every mark this one read deposits shares it, so the read counts as one tick
  try {
    const key = crypto.createHash('sha256').update([who, standpoint, via, question].join('|')).digest('hex').slice(0, 16);
    const addrs = [...new Set(rows.map((r) => r._addr))].slice(0, 60);
    await mark(dir, who, 'figure', `sig:figure:${key}`, { asker: who, standpoint, question: String(question).slice(0, 200), via, count: rows.length, addrs, points: packIds(rows.slice(0, 50).map((r) => r._id).filter((x) => /^[0-9a-f]{64}$/.test(x))) });
    const kinds = new Map(); for (const r of rows) kinds.set(r._kind, (kinds.get(r._kind) || 0) + 1);
    for (const [kind, n] of [...kinds].slice(0, 5)) await mark(dir, who, 'pattern', `sig:pattern:${kind}`, { kind, rows: n, ms, strategy: via, basis: 'read', N: null, probe: null, gainMs: 0, gainReads: kinds.size === 1 ? gainReads : Math.round(gainReads / kinds.size), changed: false, evt });
    const SC = await import('./shortcuts.mjs');                    // lazily: shortcuts imports marks
    await SC.reinforce(dir, who, { addrs: [...new Set(rows.map((r) => r._addr))], question: String(question), evt });
    return null;
  } catch (e) { return String(e.message || e); }
}
