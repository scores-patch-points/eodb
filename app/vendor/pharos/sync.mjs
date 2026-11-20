// sync: move entries between two pharos replicas, only as many as are needed. Portable (imports core.mjs only; no Node built-ins).
// No transport lives here: a "remote" is any object with the four methods below (each may return a promise), so the same code runs
// over a WebRTC data channel, a relay, a BroadcastChannel to a leader tab, or two handles in one process (see `serve`).
//
//   remote.ids(q, {before, limit})  -> { ids: [newest first], of: {id: [cited]}, next }   ids of entries matching the relevance filter q
//   remote.get(ids)                 -> entries
//   remote.citing(ids)              -> ids of entries whose of/seen cite any of `ids` (retractions, evaluations, replies)
//   remote.fingerprint(prefix)      -> { n, sum }   over the ids starting with `prefix`   (range reconciliation)
//   remote.idsIn(prefix)            -> ids starting with `prefix`
//
// Two ways to sync, both safe to repeat and to interrupt (entries are content-addressed and grow-only):
//   pull(h, remote, {q, budget})    BACKWARD AND SCOPED: newest first, only what matches q, then what those entries cite (so the fold has its
//                                   causes) and what cites them (so a retraction of something you hold reaches you), stopping at the budget.
//                                   The result says plainly what it did not fetch. A replica made this way is partial, never wrong:
//                                   `gaps(h)` lists the cited ids it does not hold, and a fold over it reports them as dangling.
//   reconcile(h, remote)            FULL: compares fingerprints of id ranges and recurses only into ranges that differ, so the bytes sent
//                                   grow with the DIFFERENCE between the two sets, not with the size of the log.
import * as core from './core.mjs';
import { intake } from './intake.mjs';

const hexPrefixes = '0123456789abcdef';
const size = (x) => JSON.stringify(x).length; // wire cost: the JSON bytes a transport would carry

// ---- relevance --------------------------------------------------------------------------------
/** q: { addr: string|string[] (prefix), kind: string|string[], cell: string|string[], by: string|string[] }; absent field = anything */
export function matches(e, q = {}) {
  const any = (v, x, pre) => v === undefined || [].concat(v).some((p) => (pre ? x.startsWith(p) : x === p));
  return any(q.addr, e.addr, true) && any(q.kind, e.kind) && any(q.cell, e.cell) && any(q.by, e.by);
}

// every entry the replica holds, read straight from its streams (cached and incremental): no causal sort, so it stays cheap
export function heldMap(h) {
  const m = new Map();
  for (const f of h.store.list()) { let c; try { c = core.streamInfo(h, f); } catch (err) { continue; } for (const e of c.ents) if (!m.has(e.id)) m.set(e.id, e); }
  return m;
}
// sorted ids with running sums, so the fingerprint of any id prefix is two binary searches (rebuilt when the set grows)
const INDEX = new WeakMap();
function index(h) {
  const m = heldMap(h); const hit = INDEX.get(h);
  if (hit && hit.n === m.size) return hit;
  const ids = [...m.keys()].sort(); const pre = [0n]; const M = 0xffffffffffffffffn;
  for (const id of ids) pre.push((pre[pre.length - 1] + BigInt('0x' + id.slice(0, 16))) & M);
  const x = { n: m.size, ids, pre, M }; INDEX.set(h, x); return x;
}
const lower = (ids, p) => { let lo = 0, hi = ids.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (ids[mid] < p) lo = mid + 1; else hi = mid; } return lo; };
function fpOf(h, prefix) {
  const { ids, pre, M } = index(h); const lo = lower(ids, prefix), hi = lower(ids, prefix + 'g'); // 'g' sorts after every hex digit
  return { n: hi - lo, sum: ((pre[hi] - pre[lo]) & M).toString(16), lo, hi };
}

/** ids this replica cites but does not hold: the exact edge of a partial replica. `of` is what an entry is ABOUT (a retraction's target, a reply's
 *  parent): needed for the entry to mean anything. `seen` is only what its writer had seen: ordering context, tolerated missing (the fold skips it). */
export function gaps(h, { of = true, seen = false } = {}) {
  const have = heldMap(h), out = new Set();
  for (const e of have.values()) for (const id of [...(of ? e.of : []), ...(seen ? e.seen : [])]) if (!have.has(id)) out.add(id);
  return [...out].sort();
}

// ---- serving a handle as a remote ---------------------------------------------------------------
/** a remote backed by a local handle; every call's request+response size is added to remote.wire */
export function serve(h) {
  const r = { wire: 0 };
  const tap = (req, res) => { r.wire += size(req) + size(res); return res; };
  r.ids = (q, { before, limit = 200 } = {}) => {
    const all = core.entries(h).filter((e) => matches(e, q)).reverse(); // causal order, newest first (the one place a causal sort is worth it)
    let i = 0; if (before) { i = all.findIndex((e) => e.id === before); i = i < 0 ? 0 : i + 1; }
    const page = all.slice(i, i + limit);
    return tap({ q, before, limit }, { ids: page.map((e) => e.id), of: Object.fromEntries(page.filter((e) => e.of.length).map((e) => [e.id, e.of])), next: i + limit < all.length ? page.at(-1).id : null });
  };
  r.get = (ids) => { const m = heldMap(h); return tap(ids, ids.map((id) => m.get(id)).filter(Boolean)); };
  r.citing = (ids) => { const s = new Set(ids); return tap(ids, [...heldMap(h).values()].filter((e) => e.of.some((x) => s.has(x))).map((e) => e.id)); }; // `of` only: what is ABOUT these, not what merely came after them
  r.fingerprint = (prefix) => { const { n, sum } = fpOf(h, prefix); return tap(prefix, { n, sum }); };
  r.idsIn = (prefix) => { const { ids } = index(h); const { lo, hi } = fpOf(h, prefix); return tap(prefix, ids.slice(lo, hi)); };
  return r;
}

// ---- receiving -------------------------------------------------------------------------------------
// Entries arrive from a stranger: each is checked (shape and id = hash of content) before it is kept. Bad ones are counted, never stored.
function accept(h, ents, have, policy, cap) {
  const r = intake(h, ents, { policy, cap });        // the one door: with a policy an entry enters only if it counts, otherwise it waits in quarantine
  for (const e of r.accepted) have.set(e.id, e);
  return { fresh: r.accepted, rejected: r.rejected, waiting: r.quarantined };
}

// ---- backward, scoped pull ------------------------------------------------------------------------------
/**
 * @param q       relevance filter (see `matches`); omit for everything, newest first
 * @param budget  { entries } stop after this many entries are added (default: unlimited)
 * @param required  a relevance filter whose matches are always fetched in full, before and outside the budget
 * @param causes  also fetch what the pulled entries are ABOUT (`of`), transitively (default true; costs budget). `seen` links are not chased:
 *            they would drag in the whole history, and the fold tolerates them missing
 * @param effects also fetch what cites the entries you hold (retractions, evaluations) (default true)
 * @returns { added, rejected, wire?, horizon, more, missing, complete }
 *   horizon: `at` of the oldest matching entry fetched this call. more: matching entries left unfetched. missing: `of`-cited ids still not held.
 *   complete: nothing matching is left and nothing an entry is about is missing.
 */
export async function pull(h, remote, { q = {}, budget = {}, required = null, causes = true, effects = true, effectKinds = ['retract'], page = 20, policy = null, authority = ['signature', 'capability', 'device-key'], quarantineCap } = {}) {
  const have = heldMap(h); const cap = budget.entries ?? Infinity; const asked = new Set();
  let added = 0, rejected = 0, horizon = null, more = false, before, waiting = 0;
  const take = async (ids, free = false) => {
    const want = ids.filter((id) => !have.has(id) && !asked.has(id)).slice(0, free ? ids.length : Math.max(0, cap - added));
    if (!want.length) return [];
    for (const id of want) asked.add(id);
    const r = accept(h, await remote.get(want), have, policy, quarantineCap); if (!free) added += r.fresh.length; rejected += r.rejected; waiting = r.waiting; return r.fresh;
  };
  // 0a. with a policy, the AUTHORITY (signatures, grants, device keys) comes first, outside the budget: nothing else can be judged without it
  if (policy) for (let ab; ;) { const p = await remote.ids({ kind: authority }, { before: ab, limit: page }); await take(p.ids, true); if (!p.next || !p.ids.some((id) => !have.has(id) && !asked.has(id))) break; ab = p.next; }
  // 0. REQUIRED addresses first, in full, outside the budget: the oldest entries of a record (a name, a date) are often the ones that matter
  if (required) for (let rb; ;) { const p = await remote.ids(required, { before: rb, limit: page }); await take(p.ids, true); if (!p.next) break; rb = p.next; }
  // 1. newest first, matching q; a page that is entirely known means everything older was already walked (this replica synced
  //    newest-first before), so stop: that is what makes a repeat pull cost only the new entries.
  for (;;) {
    const p = await remote.ids(q, { before, limit: page });
    const unknown = p.ids.filter((id) => !have.has(id));
    if (!unknown.length) break;
    const got = await take(p.ids);
    if (got.length) horizon = got.at(-1).at;
    if (added >= cap) { more = true; break; }
    if (!p.next) break;
    before = p.next;
  }
  // 2. what the pulled entries cite, back to what we already hold (or the budget)
  if (causes) {
    for (let g = gaps(h); g.length && added < cap; g = gaps(h)) {
      const got = await take(g);
      if (!got.length) break; // the remote does not hold them either
    }
  }
  // 3. what is ABOUT what we hold: retractions (and any other effectKinds), newest first like everything else, taking only those
  //    whose target we hold. Their addresses and cells are outside q by design: a retraction of your data is relevant because of its target.
  if (effects) {
    let b2;
    for (let guard = 0; guard < 1000 && added < cap; guard++) {
      const p = await remote.ids({ kind: effectKinds }, { before: b2, limit: page });
      const hits = p.ids.filter((id) => !have.has(id) && (p.of[id] || []).some((t) => have.has(t)));
      if (hits.length) await take(hits);
      if (!p.ids.some((id) => !have.has(id) && !hits.includes(id)) && p.ids.every((id) => have.has(id) || hits.includes(id)) && !hits.length) { if (p.ids.every((id) => have.has(id))) break; }
      if (!p.next) break;
      b2 = p.next;
    }
  }
  const missing = gaps(h);
  return { added, rejected, horizon, more, missing, complete: !more && !missing.length, quarantined: waiting, wire: remote.wire };
}

// ---- full sync by range reconciliation ----------------------------------------------------------------------

/** make this replica hold everything the remote holds (pull only; run it from both sides to converge) */
export async function reconcile(h, remote, { leaf = 8, policy = null, quarantineCap } = {}) {
  const have = heldMap(h); let added = 0, rejected = 0, ranges = 0, waiting = 0;
  const walk = async (prefix) => {
    ranges++;
    const a = fpOf(h, prefix), b = await remote.fingerprint(prefix);
    if (a.n === b.n && a.sum === b.sum) return;                    // same set in this range: nothing to say
    if (b.n === 0) return;                                          // remote has nothing here
    if (b.n <= leaf || prefix.length >= 64) {                      // small: just compare ids
      const theirs = await remote.idsIn(prefix);
      const want = theirs.filter((id) => !have.has(id));
      if (want.length) { const r = accept(h, await remote.get(want), have, policy, quarantineCap); added += r.fresh.length; rejected += r.rejected; waiting = r.waiting; }
      return;
    }
    for (const c of hexPrefixes) await walk(prefix + c);
  };
  await walk('');
  return { added, rejected, ranges, quarantined: waiting, wire: remote.wire };
}
