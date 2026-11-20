// shortcuts.mjs: the three shortcuts, built from the primitives. Each is an ORDINARY ENTRY of a cube cell, DERIVED from SIG marks (or from the
// `of` graph), written to the log by a separate `derive-<who>` writer, carrying its evidence in `basis`, and admitted only by a held-out check.
// When a later check fails, a retraction is written (the entry is hidden, not erased). Nothing here is authoritative: every use can be ignored,
// and a read that does not use a shortcut gives the same answer.
//
//   synapse    INS·Pattern  kind `synapse`    a pair of addresses read together more than independence predicts, in >= 2 rounds, that also
//                                              co-occurs in held-out questions.                       use: related(dir, addr)
//   wormhole   CON·Figure   kind `wormhole`   a name (a word in questions) bound to one referent address, admitted if its share beats a seeded
//                                              random-binding null by z >= sqrt(2 ln H), else a typed gap.   use: resolveName(dir, name)
//   expressway CON·Pattern  kind `expressway` a skip link every D ancestors along a single-parent `of` chain, carrying descriptors of what it
//                                              skips so a trace returns the SAME ancestors. Written only if held-out traces are identical and
//                                              cheaper, lookups included.                              use: traceFast(dir, id)
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { openStore } from './store.mjs';
import { Sig } from './sig.mjs';
import * as MK from './marks.mjs';

// K: how many robust units (median + K x 1.4826 MAD) a pair credit must exceed in a round; chosen by hand on small synthetic rounds, not tuned on held-out data
export const K = 2, D = 32, MIN_Q = 12, MIN_EVENTS = 3, HOP_GAIN = 0.5, MIN_PRECISION = 0.5;
const safe = (s) => String(s).replace(/[^A-Za-z0-9._-]/g, '-');
const CELL = { synapse: 'INS·Pattern', wormhole: 'CON·Figure', expressway: 'CON·Pattern' };

// The derived entries live in `<log>.derived/`, a store of their own beside the log: a CACHE. Delete it and every answer is unchanged; the expressway
// links are rebuilt from the log, synapses and wormholes are relearned from new marks.
export const derivedDir = (dir) => path.resolve(dir) + '.derived';
const derivedSig = (dir) => new Sig(derivedDir(dir), 'reader');

// ---- helpers ------------------------------------------------------------------------------------------------------------------------
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };
const mad = (xs) => { const m = median(xs); return median(xs.map((x) => Math.abs(x - m))); };
function rng(seedStr) { let a = parseInt(crypto.createHash('sha256').update(seedStr).digest('hex').slice(0, 8), 16) >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const live = (sig, kind) => { sig.advance(); return (sig.byKind.get(kind) || []).filter((id) => !sig.retracted.has(id)).map((id) => sig.readAt(id)); };
const questions = async (dir, who) => (await MK.live(dir, 'figure', { who })).filter((f) => f.addrs && f.addrs.length);   // evaporated marks are not evidence
const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((q) => [q, x[q]])) : x));
// A synapse is its pair of groups and a wormhole is its name and referent; their statistics (weight, rounds, held-out counts) drift as evidence slides and are not identity.
const identity = (kind, b) => (kind === 'synapse' ? canon({ a: b.a, b: b.b, ga: b.ga, gb: b.gb }) : kind === 'wormhole' ? canon({ name: b.name, referent: b.referent }) : canon(b));
const r2 = (x) => Math.round(x * 100) / 100;

// ---- synapse ------------------------------------------------------------------------------------------------------------------------
function credits(qs) {
  const N = qs.length, ni = new Map(), nij = new Map();
  for (const q of qs) {
    const a = [...new Set(q)].sort();
    for (const x of a) ni.set(x, (ni.get(x) || 0) + 1);
    for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) { const k = a[i] + '\u0000' + a[j]; nij.set(k, (nij.get(k) || 0) + 1); }
  }
  const out = new Map();
  for (const [k, n] of nij) { const [x, y] = k.split('\u0000'); out.set(k, { n, credit: n - (ni.get(x) * ni.get(y)) / N }); }
  return out;
}
// synapses: a pure function of the address sets of the questions (oldest first). Train on the first two thirds in 4 rounds; hold out the last third.
// Two guards against pairs that carry no information:
//  1. Addresses with IDENTICAL read profiles in the training window (always read together, as the entries of one topic are when a read returns the
//     whole topic) are ONE node. A pair inside a node is adjacency, not a connection, and is never a synapse.
//  2. The threshold is a permutation null, not a spread rule: in each round every node keeps how often it was read but its reads are shuffled across the
//     round's questions (seeded, NULL_DRAWS draws); a pair must beat the NULL_Q quantile of the best chance pair.
export const NULL_DRAWS = 100, NULL_Q = 0.95;
function nodesOf(train) {
  const prof = new Map(); train.forEach((q, i) => { for (const a of new Set(q)) { let l = prof.get(a); if (!l) prof.set(a, l = []); l.push(i); } });
  const groups = new Map(); for (const [a, l] of prof) { const k = l.join(','); let g = groups.get(k); if (!g) groups.set(k, g = []); g.push(a); }
  const of = new Map(), members = new Map();
  for (const g of groups.values()) { g.sort(); for (const a of g) of.set(a, g[0]); members.set(g[0], g); }
  return { of, members };
}
function nullThreshold(sets, seed) {
  const n = sets.length, memb = new Map(); sets.forEach((q, i) => { for (const x of q) { let l = memb.get(x); if (!l) memb.set(x, l = []); l.push(i); } });
  const rand = rng(seed), maxima = [];
  for (let d = 0; d < NULL_DRAWS; d++) {
    const draw = Array.from({ length: n }, () => []);
    for (const [node, l] of memb) { const idx = Array.from({ length: n }, (_, i) => i); for (let j = 0; j < l.length; j++) { const k = j + Math.floor(rand() * (n - j)); [idx[j], idx[k]] = [idx[k], idx[j]]; draw[idx[j]].push(node); } }
    let mx = 0; for (const v of credits(draw).values()) if (v.n >= 2 && v.credit > mx) mx = v.credit; maxima.push(mx);
  }
  maxima.sort((x, y) => x - y); return maxima[Math.ceil(NULL_Q * NULL_DRAWS) - 1];
}
export function synapses(qs) {
  if (qs.length < MIN_Q) return { state: 'undecided', why: `${qs.length} of ${MIN_Q} questions`, pairs: [], captured: 0 };
  const cut = Math.floor(qs.length * 2 / 3), train = qs.slice(0, cut), test = qs.slice(cut), { of, members } = nodesOf(train);
  const asNodes = (q) => [...new Set(q.map((a) => of.get(a) || a))];
  const R = Math.max(2, Math.min(4, Math.floor(train.length / 12))), size = Math.ceil(train.length / R), tagged = new Map();   // rounds of at least ~12 questions, or a chance threshold has no power
  for (let r = 0; r < R; r++) {
    const part = train.slice(r * size, (r + 1) * size).map(asNodes); if (part.length < 6) continue;
    const cr = credits(part), thr = nullThreshold(part, `synapse|${r}|${train.length}`);
    for (const [k, v] of cr) if (v.n >= 2 && v.credit > thr && v.credit > 0) { const t = tagged.get(k) || { rounds: 0, weight: 0 }; t.rounds++; t.weight += v.credit; tagged.set(k, t); }
  }
  const captured = [...tagged].filter(([, t]) => t.rounds >= 2);
  const held = credits(test.map(asNodes)), heldN = (k) => (held.get(k) || { n: 0 }).n;
  const positive = [...credits(train.map(asNodes))].filter(([, v]) => v.credit > 0);
  const persists = captured.filter(([k]) => heldN(k) >= 1);
  const precision = captured.length ? persists.length / captured.length : 0;
  const baseline = positive.length ? positive.filter(([k]) => heldN(k) >= 1).length / positive.length : 0;
  const ok = captured.length > 0 && precision >= MIN_PRECISION;
  const pairs = ok ? persists.map(([k, t]) => { const [a, b] = k.split('\u0000'); return { a, b, ga: members.get(a) || [a], gb: members.get(b) || [b], rounds: t.rounds, weight: r2(t.weight), heldN: heldN(k) }; }) : [];
  // coverage: in held-out questions, the share of other nodes that a touched node's synapses would have named
  const nb = new Map(); for (const p of pairs) { (nb.get(p.a) || nb.set(p.a, new Set()).get(p.a)).add(p.b); (nb.get(p.b) || nb.set(p.b, new Set()).get(p.b)).add(p.a); }
  let hit = 0, tot = 0; for (const q of test.map(asNodes)) for (const a of q) for (const b of q) if (a !== b) { tot++; if (nb.get(a) && nb.get(a).has(b)) hit++; }
  return { state: ok ? 'promoted' : (captured.length ? 'demoted' : 'undecided'), why: `${captured.length} captured, held-out precision ${Math.round(precision * 100)}% (all positive-credit pairs: ${Math.round(baseline * 100)}%)`, precision: r2(precision), baseline: r2(baseline), captured: captured.length, coverage: tot ? r2(hit / tot) : 0, pairs, questions: qs.length, nodes: members.size };
}

// ---- wormhole -----------------------------------------------------------------------------------------------------------------------
const STOP = new Set(['seg', 'def', 'sources', 'kinds', 'addr', 'get', 'trace', 'brief', 'ask', 'collapse', 'all', 'params', 'true', 'false', 'null']);
const tokensOf = (q) => [...new Set((String(q).match(/[A-Za-z][A-Za-z0-9_.-]{2,}/g) || []).map((t) => t.toLowerCase()).filter((t) => !STOP.has(t)))];
const localPart = (a) => String(a).split(':').pop().toLowerCase();
export function wormholes(figs) {
  const ev = new Map();
  for (const f of figs) for (const t of tokensOf(f.question)) { let a = ev.get(t); if (!a) ev.set(t, a = []); a.push(f.addrs); }
  const bound = [], gaps = [];
  for (const [name, events] of ev) {
    if (events.length < MIN_EVENTS) { gaps.push({ name, gap: 'too_few', events: events.length }); continue; }
    const cut = Math.max(1, Math.floor(events.length * 2 / 3)), train = events.slice(0, cut), test = events.slice(cut);
    const cnt = new Map(); for (const e of train) for (const a of new Set(e)) cnt.set(a, (cnt.get(a) || 0) + 1);
    const cands = [...cnt].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1));
    if (localPart(cands[0][0]) === name) { gaps.push({ name, gap: 'literal', events: events.length }); continue; }    // the name only spells its address: it shortens nothing
    const [referent, n] = cands[0], share = n / train.length, H = cnt.size, rand = rng('wormhole|' + name), draws = [];
    // null: each event's address set is replaced by a random set of the same size from the addresses seen in training; the statistic is the same (the best share)
    const pool = [...cnt.keys()];
    for (let d = 0; d < 200; d++) { const c = new Map(); for (const e of train) { const k = new Set(e).size, pick = new Set(); while (pick.size < Math.min(k, pool.length)) pick.add(pool[Math.floor(rand() * pool.length)]); for (const a of pick) c.set(a, (c.get(a) || 0) + 1); } draws.push(Math.max(...c.values()) / train.length); }
    const mean = draws.reduce((s, x) => s + x, 0) / draws.length, sd = Math.sqrt(draws.reduce((s, x) => s + (x - mean) ** 2, 0) / draws.length) || 1e-9;
    const z = (share - mean) / sd, need = Math.sqrt(2 * Math.log(Math.max(H, 2)));
    if (z < need) { gaps.push({ name, gap: 'not_concentrated', events: events.length, share: r2(share), z: Math.round(z * 10) / 10, need: Math.round(need * 10) / 10 }); continue; }
    const agree = test.length ? test.filter((e) => e.includes(referent)).length / test.length : 1;
    if (agree < 0.8) { gaps.push({ name, gap: 'failed_heldout', events: events.length, agree: r2(agree) }); continue; }
    bound.push({ name, referent, share: r2(share), z: Math.round(z * 10) / 10, need: Math.round(need * 10) / 10, events: events.length, heldAgree: r2(agree), H });
  }
  return { bound, gaps };
}

// ---- expressway ---------------------------------------------------------------------------------------------------------------------
// chains: from each head, walk up while a node has exactly one parent. Depth is counted from the terminal node, so a link stays valid as the chain grows.
function buildLinks(sig) {
  const links = new Map(), cache = new Map();
  const ent = (id) => { let e = cache.get(id); if (e === undefined) cache.set(id, e = sig.readAt(id)); return e; };
  for (const head of sig.ofHeads()) {
    const up = [head]; let cur = head;
    for (;;) { const e = ent(cur); const p = e && e.of || []; if (p.length !== 1 || !sig.all.has(p[0])) break; cur = p[0]; up.push(cur); }
    if (up.length <= D) continue;
    const base = up.length - 1;
    for (let i = 0; i + D < up.length; i++) {
      if ((base - i) % D) continue;
      const from = up[i]; if (links.has(from)) continue;
      links.set(from, { from, to: up[i + D], between: up.slice(i + 1, i + D + 1).map((id) => { const e = ent(id); return [id, e.kind, e.addr, e.by]; }) });
    }
  }
  return links;
}
// A link body is mostly binary: the skipped ids as one base64 blob of raw 32-byte values, and a 16-bit table index per kind, address and writer.
const pack = (l) => {
  const tab = { k: [], a: [], b: [] }, ix = (t, v) => { let i = tab[t].indexOf(v); if (i < 0) i = tab[t].push(v) - 1; return i; };
  const meta = Buffer.alloc(l.between.length * 6); l.between.forEach(([, k, a, b], i) => { meta.writeUInt16LE(ix('k', k), i * 6); meta.writeUInt16LE(ix('a', a), i * 6 + 2); meta.writeUInt16LE(ix('b', b), i * 6 + 4); });
  return { from: l.from, to: l.to, D, tab, ids: MK.packIds(l.between.map((x) => x[0])), meta: meta.toString('base64') };
};
const unpack = (b) => { const ids = MK.unpackIds(b.ids), m = Buffer.from(b.meta, 'base64'); return { from: b.from, to: b.to, between: ids.map((id, i) => [id, b.tab.k[m.readUInt16LE(i * 6)], b.tab.a[m.readUInt16LE(i * 6 + 2)], b.tab.b[m.readUInt16LE(i * 6 + 4)]]) }; };
const desc = (e) => ({ id: e.id, kind: e.kind, addr: e.addr, by: e.by });

// traceWith: the ancestors of `id` exactly as sig.ancestors returns them along a single-parent chain, jumping where a link starts at the current
// node. If any node has other than one parent it falls back to the full walk, so the answer never differs. cost = entries read + link lookups.
export function traceWith(sig, id, links) {
  sig.advance();
  const out = []; let cur = id, pushed = true, reads = 0, lookups = 0;
  for (;;) {
    const e = sig.readAt(cur); reads++;
    if (!e) break;
    if (!pushed) out.push(desc(e));
    const p = e.of || [];
    if (p.length === 0) break;
    if (p.length > 1) { const r = sig.ancestors(id); return { ancestors: r.ancestors.map(desc), cost: reads + lookups + r.hops, fellBack: true }; }
    const l = links && links.get(cur);
    if (l) { lookups++; for (const [bid, k, a, b] of l.between) out.push({ id: bid, kind: k, addr: a, by: b }); cur = l.to; pushed = true; }
    else { cur = p[0]; pushed = false; }
  }
  return { ancestors: out, cost: reads + lookups, fellBack: false };
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---- use: the neural rule. A shortcut is potentiated when its prediction comes true and depressed when it does not ---------------------------------
// Every read that touches a live synapse's address checks the other end: touched too is a HIT (the neighbour would otherwise have cost its own
// lookup: one read saved, a difference), touched alone is a MISS (the prediction failed). A name used in a question that also touches its wormhole's
// referent is a hit, one that does not is a miss. Outcomes are pattern marks, so a hit ticks the difference clock and a miss is depression.
// A shortcut is DEPRESSED once it has at least MIN_REUSE outcomes and more weighted misses than hits; it is POTENTIATED if it has a live hit and hits >= misses.
export async function balanceOf(dir, who, prefix) {
  const c = await MK.clock(dir, who), out = new Map();
  for (const m of await MK.live(dir, 'pattern', { who })) {
    if (!m.outcome || !String(m.kind).startsWith(prefix)) continue;
    const x = out.get(m.kind) || { hits: 0, misses: 0, obs: 0 }, w = c.weight(m);
    if (m.outcome === 'hit') x.hits += w; else x.misses += w; x.obs++; out.set(m.kind, x);
  }
  return out;
}
export const verdictOf = (x) => (x && x.obs >= MK.MIN_REUSE && x.misses > x.hits ? 'depressed' : (x && x.hits > 0 && x.hits >= x.misses ? 'potentiated' : 'unknown'));
export async function reinforce(dir, who, { addrs, question = '', evt }) {
  if (!fs.existsSync(derivedDir(dir))) return 0;
  const touched = new Set(addrs), sig = derivedSig(dir); let n = 0;
  const out = (kind, hit) => MK.mark(dir, who, 'pattern', `sig:pattern:${kind}`, { kind, rows: 1, ms: 0, strategy: 'shortcut', basis: 'use', N: null, probe: null, outcome: hit ? 'hit' : 'miss', gainMs: 0, gainReads: hit ? 1 : 0, changed: false, evt });
  for (const e of live(sig, 'synapse')) { const ga = e.body.ga || [e.body.a], gb = e.body.gb || [e.body.b], a = ga.some((x) => touched.has(x)), b = gb.some((x) => touched.has(x)); if (a || b) { await out(`synapse:${e.body.a}~${e.body.b}`, a && b); n++; } }
  const names = new Set(tokensOf(question));
  for (const e of live(sig, 'wormhole')) if (names.has(e.body.name)) { await out(`wormhole:${e.body.name}`, touched.has(e.body.referent)); n++; }
  return n;
}

// ---- promotion: write derived entries only after the held-out check; retract those that no longer pass -----------------------------
async function sync(dir, who, kind, want, basis) {
  if (want === null) return { written: 0, retracted: 0 };         // undecided: change nothing
  const h = await openStore({ dir: derivedDir(dir), writer: `derive-${safe(who)}`, store: 'lazy' }), sig = derivedSig(dir);   // a cache, read by the .jsonl index: always the lazy store
  const have = new Map(); sig.advance();
  for (const id of (sig.byKind.get(kind) || [])) if (!sig.retracted.has(id)) { const e = sig.readAt(id); have.set(e.addr, e); }
  let written = 0, retracted = 0;
  const retract = (addr, e, why) => { h.weave({ cell: 'NUL·Figure', kind: 'retract', addr, body: { why }, of: [e.id], basis }); retracted++; };
  for (const [addr, body] of want) {
    const e = have.get(addr);
    if (e && identity(kind, e.body) === identity(kind, body)) continue;     // the store may reorder keys, so compare with sorted keys; statistics that drift as the window slides do not make a new shortcut
    if (e) { retract(addr, e, `${kind} replaced: the evidence changed`); have.delete(addr); }
    h.weave({ cell: CELL[kind], kind, addr, body, of: [], basis }); written++;
  }
  for (const [addr, e] of have) if (!want.has(addr)) { h.weave({ cell: 'NUL·Figure', kind: 'retract', addr, body: { why: `${kind} no longer passes its held-out check` }, of: [e.id], basis }); retracted++; }
  sig.advance(); return { written, retracted };
}

// applyUse: use overrides evidence. Depressed shortcuts are removed from `want`; existing potentiated ones are kept even if their evidence has gone.
async function applyUse(dir, who, kind, want, prefix) {
  const bal = await balanceOf(dir, who, prefix), keyOf = (addr) => addr;   // a derived entry's address is the kind its use-marks carry
  for (const addr of [...want.keys()]) if (verdictOf(bal.get(keyOf(addr))) === 'depressed') want.delete(addr);
  for (const e of live(derivedSig(dir), kind)) if (!want.has(e.addr) && verdictOf(bal.get(keyOf(e.addr))) === 'potentiated') want.set(e.addr, e.body);
}
export async function promoteSynapses(dir, who = 'reader') {
  const qs = await questions(dir, who), res = synapses(qs.map((q) => q.addrs));
  // what the evidence supports now; anything else is retracted unless use has potentiated it
  const want = new Map(res.pairs.map((p) => [`synapse:${p.a}~${p.b}`, p]));
  await applyUse(dir, who, 'synapse', want, 'synapse:');
  const w = await sync(dir, who, 'synapse', want,
     { instrument: 'shortcuts@1', questions: res.questions ?? qs.length, precision: res.precision ?? 0, baseline: res.baseline ?? 0, coverage: res.coverage ?? 0 });
  return { ...res, ...w };
}
export async function promoteWormholes(dir, who = 'reader') {
  const res = wormholes(await questions(dir, who));
  const want = new Map(res.bound.map((b) => [`wormhole:${b.name}`, b])); await applyUse(dir, who, 'wormhole', want, 'wormhole:');
  const w = await sync(dir, who, 'wormhole', want, { instrument: 'shortcuts@1', null: 'seeded random binding, 200 draws', rule: 'z >= sqrt(2 ln H), >= 3 events, held-out agreement >= 0.8' });
  return { ...res, ...w };
}
// promoteExpressways: build candidate links, test them on held-out traces, write them only if identical and cheaper.
export async function promoteExpressways(dir, who = 'reader') {
  const sig = new Sig(dir, 'reader'); sig.advance();
  const cands = buildLinks(sig);
  if (!cands.size) return { state: 'undecided', why: 'no single-parent chain longer than ' + D, written: 0, retracted: 0 };
  // probes: deep nodes in a fixed order (by id), alternate into train / held-out thirds
  const heads = sig.ofHeads(), probes = [];
  for (const hd of heads) { let cur = hd, i = 0; const chain = [hd]; for (;;) { const e = sig.readAt(cur); const p = e && e.of || []; if (p.length !== 1) break; cur = p[0]; chain.push(cur); } for (let k = 0; k < chain.length; k += Math.max(1, Math.floor(chain.length / 12))) probes.push(chain[k]); }
  const cut = Math.floor(probes.length * 2 / 3), test = probes.slice(cut), train = probes.slice(0, cut);
  const run = (set) => { let plain = 0, fast = 0, ident = true; for (const id of set) { const a = sig.ancestors(id), b = traceWith(sig, id, cands); plain += a.hops; fast += b.cost; if (!same(a.ancestors.map(desc), b.ancestors)) ident = false; } return { plain, fast, ident }; };
  const tr = run(train), te = run(test);
  const gain = (r) => (r.plain ? r.fast / r.plain : 1);
  const ok = tr.ident && te.ident && gain(tr) <= HOP_GAIN && gain(te) <= HOP_GAIN;
  const state = ok ? 'promoted' : (!tr.ident || !te.ident ? 'demoted' : 'undecided');
  const basis = { instrument: 'shortcuts@1', D, trainCost: tr, heldOutCost: te };
  const w = await sync(dir, who, 'expressway', ok ? new Map([...cands].map(([from, l]) => [`expressway:${from.slice(0, 16)}`, pack(l)])) : (state === 'demoted' ? new Map() : null), basis);
  return { state, why: `held-out cost ${te.fast} against ${te.plain} reads (${Math.round(gain(te) * 100)}%), identical: ${te.ident && tr.ident}`, links: cands.size, trainRatio: r2(gain(tr)), heldRatio: r2(gain(te)), ...w };
}
export async function promoteAll(dir, who = 'reader') { return { synapse: await promoteSynapses(dir, who), wormhole: await promoteWormholes(dir, who), expressway: await promoteExpressways(dir, who) }; }

// ---- uses ---------------------------------------------------------------------------------------------------------------------------
export function related(dir, addr) {
  const sig = derivedSig(dir); const out = [];
  for (const b of live(sig, 'synapse')) { const p = b.body, ga = p.ga || [p.a], gb = p.gb || [p.b]; if (ga.includes(addr)) out.push({ addr: p.b, group: gb, weight: p.weight }); else if (gb.includes(addr)) out.push({ addr: p.a, group: ga, weight: p.weight }); }
  return out.sort((x, y) => y.weight - x.weight);
}
export function resolveName(dir, name) {
  const sig = derivedSig(dir); const hit = live(sig, 'wormhole').find((e) => e.addr === `wormhole:${String(name).toLowerCase()}`);
  return hit ? { referent: hit.body.referent, share: hit.body.share, z: hit.body.z } : null;
}
export function expresswayLinks(dir) { const sig = derivedSig(dir); return new Map(live(sig, 'expressway').map((e) => { const l = unpack(e.body); return [l.from, l]; })); }
export function traceFast(dir, id) { const sig = new Sig(dir, 'reader'); return traceWith(sig, id, expresswayLinks(dir)); }
