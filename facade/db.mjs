#!/usr/bin/env node
// db.mjs: a small say/ask facade over pharos (weave) and EOQL (reads). Zero dependencies.
// It needs a clone of the public pharos repo: set PHAROS_SRC=/path/to/pharos.
// What it does: fixed verb-to-cell table, auto-declared kinds, reads with a :now parameter, and an "answer card".
// What it does NOT do: signatures, keys, sealing, permanent deletion, leases, networking. See README.md.
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import * as V from './vault.mjs';
import { openStore, uriFor, libs, openRead, detect } from './store.mjs';
import { Sig, position } from './sig.mjs';
import * as SG from './sign.mjs';
import * as MK from './marks.mjs';
import * as SC from './shortcuts.mjs';
import { vfiles } from './vfiles.mjs';

// Say-verbs and the cell each one writes. This table is the only place a cell is chosen for ordinary use.
export const VERBS = {
  add: 'INS·Figure',     // make something exist
  set: 'DEF·Figure',     // give it a value
  cut: 'SEG·Figure',     // cut it off from something
  link: 'CON·Figure',    // relate two things
  merge: 'SYN·Figure',   // combine things into one
  check: 'EVA·Figure',   // test against a standard
  reread: 'REC·Figure',  // read it under a new meaning
  hold: 'NUL·Figure',    // do nothing on purpose, on the record
};

let P = null, E = null;
async function load() { if (P) return; ({ P, E } = await libs()); }

const typeOf = (addr) => (addr.includes(':') ? addr.slice(0, addr.indexOf(':')) : 'thing');
const kindFor = (verb, addr) => (verb === 'add' ? typeOf(addr) : `${typeOf(addr)}.${verb}`);

// openLog: a handle on a log directory. The store (plain or lazy) is detected from the directory; a new directory uses `store`
// or the DB_STORE environment variable, else plain. See store.mjs for the difference.
export async function openLog({ dir, writer, store }) {
  await load();
  return openStore({ dir, writer, store });
}

// Declares the kind on first use; saying identical content from the same writer returns the same entry.
function put(h, entry) {
  const e = h.weave(entry);
  if (h._hasKey === undefined) h._hasKey = SG.hasKey(h.dir, h.by);          // signing is cheap and automatic once a writer has a key
  if (h._hasKey) SG.signEntry(h.dir, h.by, e.id);
  return e;
}

// say: with { seal: true } the body is encrypted under its own key, kept outside the log; the log holds only { sealed: 2, bodyc }.
export async function say(h, verb, addr, body = null, { of = [], seal = false, keysDir } = {}) {
  await load();
  const cell = VERBS[verb];
  if (!cell) throw new Error(`unknown verb "${verb}". Verbs: ${Object.keys(VERBS).join(', ')}`);
  if (typeof addr !== 'string' || !addr) throw new Error('an address is needed, for example contact:ana');
  const kind = kindFor(verb, addr);
  const stored = seal ? V.seal(h.dir, { cell, kind, addr }, body, { keysDir }) : body;
  // Your later statement of the same kind at the same address supersedes your earlier one (it cites it), so successive sets are ordered by
  // the log, not by clock time. Saying identical content again is a no-op that returns the existing entry.
  let cited = of;
  if (!of.length) {
    const prior = h.liveAt(addr).filter((e) => e.by === h.by && e.kind === kind && e.cell === cell);
    const same = prior.find((e) => JSON.stringify(e.body) === JSON.stringify(stored));
    if (same) return same;
    cited = prior.map((e) => e.id);
  }
  return put(h, { cell, kind, addr, body: stored, of: cited });
}

// forget: HIDES what is live at an address (a retraction). It does not delete anything: nothing is erased, and no key is destroyed.
export async function forget(h, addr) {
  await load();
  // Only your own entries: forgetting is the owner's act, so another writer's entry at the same address is left alone.
  const liveEntries = h.liveAt(addr).filter((e) => e.by === h.by);
  if (!liveEntries.length) throw new Error(`nothing live at ${addr} that you wrote`);
  return put(h, { cell: 'NUL·Figure', kind: 'retract', addr, body: { why: 'hidden by forget' }, of: liveEntries.map((e) => e.id) });
}

const isSealed = (b) => b && typeof b === 'object' && b.sealed === 2 && typeof b.bodyc === 'string';

// forgetPermanent: the owner (the writer who wrote it) permanently deletes SEALED entries at an address. Order: tombstone, destroy the key,
// remove the ciphertext, receipt. Any step may be interrupted; finishDeletes completes whatever is owed. Unsealed entries cannot be
// deleted this way because their content sits inside the log itself.
export async function forgetPermanent(h, addr, { keysDir, stopAfter } = {}) {
  await load();
  const live = h.liveAt(addr);
  if (!live.length) throw new Error(`nothing live at ${addr}`);
  const others = live.filter((e) => e.by !== h.by);
  if (others.length) throw new Error(`only the owner can permanently delete: ${others.length} entry(ies) at ${addr} were written by ${[...new Set(others.map((e) => e.by))].join(', ')}`);
  const open = live.filter((e) => !isSealed(e.body));
  if (open.length) throw new Error(`${open.length} entry(ies) at ${addr} are not sealed; their content is stored in the log, so they can be hidden but not permanently deleted. Say them with --seal.`);
  const t = put(h, { cell: 'NUL·Figure', kind: 'retract', addr, body: { permanent: true }, of: live.map((e) => e.id) });
  if (stopAfter === 'tombstone') return { tombstone: t.id, done: ['tombstone'] };
  for (const e of live) V.destroyKey(h.dir, e.body.bodyc, { keysDir });
  if (stopAfter === 'key') return { tombstone: t.id, done: ['tombstone', 'key'] };
  for (const e of live) V.removeBlob(h.dir, e.body.bodyc);
  if (stopAfter === 'blob') return { tombstone: t.id, done: ['tombstone', 'key', 'blob'] };
  for (const e of live) put(h, { cell: 'EVA·Figure', kind: 'gone', addr: `gone:${e.body.bodyc.slice(0, 16)}`, body: { bodyc: e.body.bodyc, keyDestroyed: true, blobRemoved: true }, of: [e.id] });
  return { tombstone: t.id, done: ['tombstone', 'key', 'blob', 'receipt'] };
}

// finishDeletes: the watcher. Finds permanent tombstones whose steps are not all done and completes them; running it again does nothing.
export async function finishDeletes(h, { keysDir } = {}) {
  await load();
  const all = h.all();
  const receipts = new Set(all.filter((e) => e.kind === 'gone').flatMap((e) => e.of));
  let actions = 0;
  for (const r of all.filter((e) => e.kind === 'retract' && e.body && e.body.permanent && e.by === h.by)) {
    for (const id of r.of) {
      const e = all.find((x) => x.id === id);
      if (!e || !isSealed(e.body)) continue;
      if (V.hasKey(h.dir, e.body.bodyc, { keysDir })) { V.destroyKey(h.dir, e.body.bodyc, { keysDir }); actions++; }
      if (V.hasBlob(h.dir, e.body.bodyc)) { V.removeBlob(h.dir, e.body.bodyc); actions++; }
      if (!receipts.has(id)) { put(h, { cell: 'EVA·Figure', kind: 'gone', addr: `gone:${e.body.bodyc.slice(0, 16)}`, body: { bodyc: e.body.bodyc, keyDestroyed: true, blobRemoved: true }, of: [id] }); actions++; }
    }
  }
  return { actions };
}

// ask: run a read. Returns { envelope, card }. :now is passed unless you give your own.
// Standpoint: `as` is a list of writers whose entries are the only ones visible; `horizon` is {writer: NAME} or an entry id and shows only
// what the writer of that entry could have known. With neither, the standpoint is everyone. The visible sub-log is re-folded by EOQL.
// cached: an expressway (SIG·Ground). The answer is memoised with the claim "complete to this position" and is reused only while the log
// is byte-for-byte the same size in every shard; any write invalidates it. Correct by construction, useful for repeated reads of a quiet log.
export async function ask(dir, query, { params = {}, now, as, horizon, keysDir, cached = false, who = 'reader', mark = true } = {}) {
  await load();
  const p = { now: now || new Date().toISOString().replace(/\.\d+Z$/, 'Z'), ...params };
  const used = /:now\b/.test(query) ? p : { ...params };
  const perceiver = {};
  if (as && as.length) perceiver.writers = as;
  if (horizon) perceiver.horizon = horizon;
  let env = null, cache = 'off', sig = null, key = null;
  if (cached) {
    sig = new Sig(dir, 'reader'); key = crypto.createHash('sha256').update(JSON.stringify([query, used, perceiver])).digest('hex');
    const m = sig.memoGet(key); if (m) { env = m.value; cache = 'hit'; } else cache = 'miss';
  }
  if (!env) {
    const h = openRead(dir);
    try {
      const opts = { params: used };
      if (Object.keys(perceiver).length) opts.frame = { perceiver };
      env = E.run(h, query, opts);
    } finally { E.close(h); }
    if (cached) sig.memoPut(key, env);
  }
  const sealedRows = env.rows.filter((r) => isSealed(r.body));
  const unread = sealedRows.filter((r) => !V.hasKey(dir, r.body.bodyc, { keysDir })).length;
  const c = card(env, query, used, perceiver, { sealed: sealedRows.length, unread }); c.cache = cache;
  if (mark) { const err = await MK.noteRead(dir, who, { question: query, standpoint: c.standpoint, via: 'ask', rows: env.rows }); if (err) c.markError = err; }
  return { envelope: env, card: c };
}

// readKind: read every entry of a kind, by whichever path is cheaper. "scan" asks the query engine (it reads every shard); "direct" reads
// just the entries of that kind by positioned reads using the read-time index. The choice, in order: a PROMOTED or DEMOTED verdict from this
// reader's own marks (the held-out check in marks.mjs), else an estimate from costs measured on this log. The scan is always the fallback, and
// direct is never used when the index cannot reproduce the scan exactly (a retraction of a retraction).
// With marks on, every read is recorded (SIG·Pattern trail, SIG·Figure pointers, SIG·Ground claim), and every PROBE_EVERY-th read of a kind also runs
// the other path and records both costs and whether the rows were identical. Marks are written after the answer is computed and cannot change it.
export async function readKind(dir, kind, { strategy = 'auto', margin = 0.7, who = 'reader', asker, standpoint = 'everyone' } = {}) {
  await load();
  const tLoad = process.hrtime.bigint();
  const sig = new Sig(dir, 'reader'); sig.advance();
  const loadMs = Math.round(Number(process.hrtime.bigint() - tLoad) / 1e4) / 100;
  const N = sig.all.size, k = sig.idsOfKind(kind).length;
  if (!sig.calib && N >= 50) await calibrate(dir, sig);
  const c = sig.calib || { scanUs: 25, readUs: 20 };
  const estimate = { scanMs: Math.round(N * c.scanUs) / 1000, directMs: Math.round((k * c.readUs / 1000 + loadMs) * 1000) / 1000 };
  const noDirect = detect(dir) === 'plain' || sig.hasDoubleRetraction();   // a plain (pharos) log has no .jsonl index to read directly: always scan
  const marking = MK.enabled(dir);
  let chosen = strategy, basis = strategy === 'auto' ? 'estimate' : 'forced';
  if (strategy === 'auto') {
    const verdict = marking ? await MK.promotion(dir, kind, who) : null;
    if (verdict && verdict.state === 'promoted' && !noDirect) { chosen = 'direct'; basis = 'promoted'; }
    else if (verdict && verdict.state === 'demoted') { chosen = 'scan'; basis = 'demoted'; }
    else chosen = !noDirect && estimate.directMs < estimate.scanMs * margin ? 'direct' : 'scan';
  }
  if (chosen === 'direct' && noDirect) chosen = 'scan';
  const runScan = () => { const h = openRead(dir); try { return E.run(h, `SEG(sources; kinds: [${JSON.stringify(kind)}])`, { params: {} }).rows; } finally { E.close(h); } };
  const timeIt = (f) => { const t = process.hrtime.bigint(); const r = f(); return [r, Math.round(Number(process.hrtime.bigint() - t) / 1e4) / 100]; };
  const [rows, ms] = chosen === 'direct' ? timeIt(() => sig.readKindDirect(kind)) : timeIt(runScan);
  const trail = (sig.syn.trail = sig.syn.trail || []); trail.push({ kind, k, N, chosen, estimate, ms }); if (trail.length > 200) trail.shift();
  sig.syn.counts = sig.syn.counts || {}; const nth = (sig.syn.counts[kind] = (sig.syn.counts[kind] || 0) + 1); sig.dirty = true; sig.flush();
  let probe = null, markError = null;
  if (marking) {
    try {
      if (strategy === 'auto' && !noDirect && nth % MK.PROBE_EVERY === 0) {
        const [other, otherMs] = chosen === 'direct' ? timeIt(runScan) : timeIt(() => sig.readKindDirect(kind));
        const key = (rs) => rs.map((r) => `${r._id}:${r._retracted}`).sort().join(',');
        probe = chosen === 'direct' ? { scanMs: otherMs, directMs: Math.round((ms + loadMs) * 100) / 100, same: key(rows) === key(other) } : { scanMs: ms, directMs: Math.round((otherMs + loadMs) * 100) / 100, same: key(rows) === key(other) };
      }
      const A = asker || who;
      // did this read make a difference? Measured ms saved only where a probe ran both paths; an override only where a verdict reversed the estimate
      const estChoice = !noDirect && estimate.directMs < estimate.scanMs * margin ? 'direct' : 'scan';
      const gainMs = probe ? Math.max(0, chosen === 'direct' ? probe.scanMs - probe.directMs : probe.directMs - probe.scanMs) : 0;
      const changed = (basis === 'promoted' || basis === 'demoted') && estChoice !== chosen;
      await MK.mark(dir, who, 'pattern', `sig:pattern:${kind}`, { kind, rows: rows.length, ms, strategy: chosen, basis, N, probe, gainMs: Math.round(gainMs * 100) / 100, gainReads: 0, changed });
      await MK.mark(dir, who, 'figure', `sig:figure:${crypto.createHash('sha256').update([A, standpoint, 'kind', kind].join('|')).digest('hex').slice(0, 16)}`, { asker: A, standpoint, question: `kind ${kind}`, count: rows.length, points: MK.packIds(rows.slice(0, 50).map((r) => r._id)) });
      await MK.mark(dir, who, 'ground', `sig:ground:kind:${kind}`, { area: { kind }, position: position(dir), claim: 'complete to this position' });
    } catch (e) { markError = String(e.message || e); }   // a mark that fails to write never affects the answer, but it is reported
  }
  return { rows, strategy: chosen, basis, estimate, ms, loadMs, entries: N, matched: k, probe, markError };
}

async function calibrate(dir, sig) {
  const h = openRead(dir);
  let t = process.hrtime.bigint(), n = 0;
  try { n = E.run(h, 'SEG(sources)', { params: {} }).rows.length; } finally { E.close(h); }
  const scanUs = Number(process.hrtime.bigint() - t) / 1e3 / Math.max(1, n);
  const ids = [...sig.all]; const sample = Math.min(200, ids.length); t = process.hrtime.bigint();
  for (let i = 0; i < sample; i++) sig.readAt(ids[(i * 7919) % ids.length]);
  const readUs = Number(process.hrtime.bigint() - t) / 1e3 / Math.max(1, sample);
  sig.calib = { scanUs: Math.round(scanUs * 10) / 10, readUs: Math.round(readUs * 10) / 10, entries: sig.all.size }; sig.dirty = true; sig.flush();
}

// review: the held-out check in miniature. For each recorded read, was the estimate's choice right? Compares the recorded time of the path
// chosen with the estimate of the other path. Reports how often the chooser's estimate ordered the two paths correctly.
export function review(dir) {
  const sig = new Sig(dir, 'reader'); const trail = sig.syn.trail || [];
  const rows = trail.map((r) => ({ kind: r.kind, matched: r.k, entries: r.N, chose: r.chosen, ms: r.ms, estimatedOtherMs: r.chosen === 'direct' ? r.estimate.scanMs : r.estimate.directMs }));
  const wrong = rows.filter((r) => r.ms > r.estimatedOtherMs * 1.5);
  return { reads: rows.length, calibration: sig.calib, choseDirect: rows.filter((r) => r.chose === 'direct').length, estimateLooksWrong: wrong.length, wrong };
}

// trace: a wormhole (SIG·Pattern). Walks `of` links from an entry id (or the entries at an address) by positioned reads, one per hop.
// the same walk as Sig.ancestors (breadth first along `of`), over the entries of a plain pharos held in memory
function plainAncestors(dir, id, { max = 100000 } = {}) {
  const all = new Map(P.entries(P.open('db', { dir: path.resolve(dir), writer: 'db-reader', frame: false })).map((e) => [e.id, e]));
  const out = [], seen = new Set([id]), queue = [id]; let hops = 0;
  while (queue.length && out.length < max) {
    const cur = queue.shift(), e = all.get(cur); hops++;
    if (!e) continue;
    if (cur !== id) out.push(e);
    for (const r of e.of || []) if (!seen.has(r)) { seen.add(r); queue.push(r); }
  }
  return { ancestors: out, hops };
}
export async function trace(dir, target, { max, who = 'reader' } = {}) {
  await load();
  const sig = new Sig(dir, 'reader'); sig.advance();
  let ids = [target];
  if (!/^[0-9a-f]{64}$/.test(target)) {
    const h = openRead(dir);
    try { ids = E.run(h, `SEG(sources; addr: ${JSON.stringify(target)})`, { params: {} }).rows.map((r) => r._id); } finally { E.close(h); }
    if (!ids.length) throw new Error(`nothing at ${target}`);
  }
  const out = [];
  for (const id of ids) {
    // live expressway entries (derived skip links) are used when they exist; the answer is identical, only the reads differ
    const links = max === undefined ? SC.expresswayLinks(dir) : new Map();
    const r = links.size ? (() => { const t = SC.traceWith(sig, id, links); return { hops: t.cost, ancestors: t.ancestors }; })() : (() => { const x = detect(dir) === 'plain' ? plainAncestors(dir, id, { max }) : sig.ancestors(id, { max }); return { hops: x.hops, ancestors: x.ancestors.map((e) => ({ id: e.id, kind: e.kind, addr: e.addr, by: e.by })) }; })();
    out.push({ from: id, hops: r.hops, ancestors: r.ancestors });
    const gainReads = links.size > 0 ? Math.max(0, r.ancestors.length + 1 - r.hops) : 0;     // a single-parent walk would have read ancestors + 1 entries
    await MK.noteRead(dir, who, { question: `trace ${id}`, via: 'trace', rows: r.ancestors.map((e) => ({ _id: e.id, _addr: e.addr, _kind: e.kind })), gainReads });
  }
  return out;
}

const visibleKey = (r) => JSON.stringify(Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith('_') || ['_addr', '_kind'].includes(k)).sort()));

// compare: the same question under two standpoints, as the rows only one of them sees.
export async function compare(dir, query, { a, b, params = {}, now } = {}) {
  const A = await ask(dir, query, { params, now, ...a });
  const B = await ask(dir, query, { params, now, ...b });
  const ka = new Map(A.envelope.rows.map((r) => [visibleKey(r), r])), kb = new Map(B.envelope.rows.map((r) => [visibleKey(r), r]));
  return {
    onlyA: [...ka].filter(([k]) => !kb.has(k)).map(([, r]) => r),
    onlyB: [...kb].filter(([k]) => !ka.has(k)).map(([, r]) => r),
    both: [...ka].filter(([k]) => kb.has(k)).length,
    cardA: A.card, cardB: B.card,
  };
}

// who: the writers in a log and how many entries each has: the standpoints you can choose from.
export async function who(dir) {
  await load();
  const h = openRead(dir);
  try { return E.run(h, 'SYN(SEG(sources); by: ["_by"]; agg: {entries: count(*)})', { params: {} }).rows.map((r) => ({ writer: r._by, entries: r.entries })); }
  finally { E.close(h); }
}

// get: the current record at an address (the add body, then each set body in order), plus its history and whether it was hidden.
// Each move is its own entry of its own kind, so a plain read shows them separately; this merges them for a person.
export async function get(dir, addr, { keysDir, who = 'reader' } = {}) {
  await load();
  const h = openRead(dir);
  try {
    const env = E.run(h, `DEF(SEG(sources; addr: ${JSON.stringify(addr)}); collapse: ["all"])`, { params: {} });
    const rows = env.rows.filter((r) => r._kind !== 'retract').sort((a, b) => a._pos - b._pos);
    await MK.noteRead(dir, who, { question: `get ${addr}`, via: 'get', rows });
    const t = typeOf(addr);
    const current = {};
    let unread = 0;
    const history = rows.map((r) => {
      let body = r.body, sealed = null;
      if (isSealed(r.body)) {
        const o = V.open(dir, { cell: r._cell, kind: r._kind, addr: r._addr }, r.body, { keysDir });
        sealed = o.ok ? { readable: true } : { readable: false, reason: o.reason };
        body = o.ok ? o.body : null;
        if (!o.ok) unread++;
      }
      return { kind: r._kind, cell: r._cell, by: r._by, at: r._at, body, sealed, hidden: r._retracted === 1 };
    });
    rows.forEach((r, i) => {
      if (r._retracted === 1 || !(r._kind === t || r._kind === `${t}.set`)) return;
      if (history[i].body && typeof history[i].body === 'object') Object.assign(current, history[i].body);
    });
    const hidden = rows.length > 0 && rows.every((r) => r._retracted === 1);
    const sealedRows = history.filter((x) => x.sealed);
    return { addr, current, hidden, unreadSealed: unread,
      permanentlyDeleted: hidden && sealedRows.length > 0 && sealedRows.every((x) => !x.sealed.readable),
      history };
  } finally { E.close(h); }
}

export async function defineView(dir, writer, name, expr, { params = [] } = {}) {
  await load();
  const h = E.open(uriFor(dir), { mode: 'write', writer });
  try {
    try { return E.views.define(h, name, expr, { params }); }
    catch (e) {
      // A pharos must declare the `view` kind once before it can store a view; EOQL's own hint gives the declaration.
      if (e.code !== 'E_UNDECLARED_KIND') throw e;
      E.run(h, 'WRITE DEF(declare: "view"; like: "holon")', { params: {}, write: true });
      return E.views.define(h, name, expr, { params });
    }
  } finally {
    E.close(h);
    // EOQL's WRITE appends legacy .jsonl lines. On a plain (pharos) log the binary core ignores them, so pharos's own `migrate` moves them in
    // (non-destructive, idempotent). A lazy log needs nothing.
    if (detect(dir) === 'plain') P.migrate(P.open('db', { dir: path.resolve(dir), writer, frame: false }));
  }
}

// The answer card: what a normal database hides.
export function card(env, query, params, perceiver = {}, sealedInfo = { sealed: 0, unread: 0 }) {
  const text = JSON.stringify(env);
  const standpoint = !perceiver.writers && !perceiver.horizon ? 'everyone'
    : [perceiver.writers ? `writers ${perceiver.writers.join(', ')}` : null,
       perceiver.horizon ? `what ${typeof perceiver.horizon === 'string' ? 'entry ' + perceiver.horizon.slice(0, 8) : 'the last entry of ' + perceiver.horizon.writer} could have known` : null].filter(Boolean).join('; ');
  const unseen = env.explain?.frame?.perceiver_info?.unseen_refs;
  const gaps = (env.gaps || []).map((g) => g.code);
  const retracted = env.rows.filter((r) => r._retracted === 1).length;
  return {
    question: query.trim().split('\n')[0].slice(0, 100),
    rows: env.rows.length,
    determined: env.determined !== false,
    heldPlaces: typeof env.held === 'number' ? env.held : undefined,
    hiddenByForget: retracted,
    gaps,
    sealed: sealedInfo.sealed,
    unreadSealed: sealedInfo.unread,
    unread: sealedInfo.sealed === 0 ? 'none of these rows are sealed' : `${sealedInfo.unread} of ${sealedInfo.sealed} sealed rows not read (no key held)`,
    asOf: params.now || null,
    standpoint,
    unseenRefs: typeof unseen === 'number' ? unseen : 0,
    result: crypto.createHash('sha256').update(text).digest('hex').slice(0, 16),
  };
}

export function renderCard(c) {
  const lines = [
    `Question   ${c.question}`,
    `Standpoint ${c.standpoint}`,
    ...(c.cache && c.cache !== 'off' ? [`Cache      ${c.cache === 'hit' ? 'hit: reused, log unchanged since it was computed' : 'miss: computed and stored'}`] : []),
    `As of      ${c.asOf ?? '(no time parameter used)'}`,
    `Rows       ${c.rows}${c.hiddenByForget ? `  (${c.hiddenByForget} hidden by forget but still shown, flagged)` : ''}`,
    `Status     ${c.determined ? 'determined' : 'CONTESTED: some places have competing latest values'}`,
    `Unread     ${c.unread}`,
    `Not visible ${c.unseenRefs} cited entries are outside this standpoint`,
    `Gaps       ${c.gaps.length ? c.gaps.join(', ') : 'none'}`,
    `Result     ${c.result}`,
  ];
  return lines.join('\n');
}

// ---- CLI ----
function parseArgs(argv) {
  const pos = [], flags = {}, params = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-f') { flags.f = argv[++i]; continue; }
    if (a === '--param') { const kv = argv[++i]; const j = kv.indexOf('='); if (j < 1) throw new Error('--param needs name=value'); let v = kv.slice(j + 1); try { v = JSON.parse(v); } catch { /* keep text */ } params[kv.slice(0, j)] = v; continue; }
    if (a.startsWith('--')) { const k = a.slice(2); const nxt = argv[i + 1]; if (nxt === undefined || nxt.startsWith('--')) flags[k] = true; else { flags[k] = nxt; i++; } continue; }
    pos.push(a);
  }
  return { pos, flags, params };
}

async function main(argv) {
  const [cmd, ...rest] = argv;
  const { pos, flags, params } = parseArgs(rest);
  if (!cmd || cmd === 'help' || cmd === '--help') {
    console.log('shared notes for sessions in a project (the stigmergy kit):\n  db init                                   install .pharos/ and a CLAUDE.md block in the current project\n  db brief [--max-chars N]                  what the sessions here know: claims, decisions, fresh and stale notes\n  db note <topic> "<text>" --files a,b --session NAME\n  db claim "<what>" [--ttl MINUTES] --session NAME      db release "<what>" --session NAME\n  db decide <topic> "<text>" --session NAME             db verify <topic> --session NAME\n\ngeneral commands:\n  db say <verb> <addr> [json-body] --dir D --writer W [--of id,id]\n  db ask <query | -f file> --dir D [--now ISO] [--param k=v] [--as w1,w2] [--horizon writer:W|ID] [--card] [--json]\n  db compare <query> --dir D --as w1[,w2] --vs w3|all\n  db who --dir D\n  db site define --dir D --writer W --title T --pages "JSON"   declare a mini-site (pages: [{path,title,view|kind|query}])\n  db site serve --dir D [--port N]               serve the mini-site as HTML (?as=<writer> discloses per reader)\n  db ask ... --cached                       reuse an answer while the log is unchanged (expressway)\n  db kind <kind> --dir D [--strategy auto|direct|scan]   read a kind by whichever path is cheaper (estimated, then recorded)\n  db marks on|off --dir D                    record attention as SIG marks (off by default); db trails, db promote read them\n  db shortcuts [synapse|wormhole|expressway|all] --dir D   derive shortcuts from marks and the of-graph (held-out check; written as entries)\n  db related <addr> --dir D   db resolve <name> --dir D     use the synapses and wormholes\n  db trails --dir D     pheromone per kind: attention and what made a difference, on a clock that ticks only when a difference is made; db evaporate drops marks older than the longest observed return (the marks store is a cache)\n  db vf status|plan|sweep --dir D            manage the virtual files Proteus makes: pin, unpin, evict, withdraw take a recipe; plan keeps the newest N per project (default 3)\n  db vfiles --dir D                           virtual files other repos wrote to the pharos: built or not, checked or not, contested, read by kind only\n  db review --dir D                          were the chooser estimates right about which path is cheaper?\n  db trace <id|addr> --dir D                 walk the of-chain by positioned reads (wormhole)\n  db sig [status|rebuild] --dir D            the derived SIG index (safe to delete)\n  db keys --writer W --dir D                 create a signing key for W (entries W writes afterwards are signed)\n  db verify --dir D                          audit signatures (ordinary reads never check them)\n  db trust <writer> --dir D   db publish --writer W --dir D   db adopt <writer> --writer ME --dir D\n  db get <addr> --dir D [--history]\n  db view <name> <expr | -f file> --dir D --writer W [--params a,b]\n  db forget <addr> --dir D --writer W [--permanent]   (hides; --permanent destroys the key of SEALED entries you own)\n  db finish --dir D --writer W           (completes any interrupted permanent delete)\n  db verbs\n  say with --seal encrypts the body under its own key; --keys DIR chooses the key store (default D.keys)');
    return;
  }
  if (cmd === 'verbs') { for (const [v, c] of Object.entries(VERBS)) console.log(v.padEnd(8), c); return; }
  if (cmd === 'say') {
    const [verb, addr, bodyText] = pos;
    let body = null;
    if (bodyText !== undefined) { try { body = JSON.parse(bodyText); } catch { throw new Error('the body must be valid JSON, for example \'{"name":"Ana"}\''); } }
    const h = await openLog({ dir: flags.dir, writer: flags.writer });
    const e = await say(h, verb, addr, body, { of: flags.of ? String(flags.of).split(',') : [], seal: !!flags.seal, keysDir: flags.keys });
    console.log(JSON.stringify({ id: e.id, cell: e.cell, kind: e.kind, addr: e.addr, sealed: !!flags.seal }));
    return;
  }
  if (cmd === 'forget') {
    const h = await openLog({ dir: flags.dir, writer: flags.writer });
    if (flags.permanent) { console.log(JSON.stringify(await forgetPermanent(h, pos[0], { keysDir: flags.keys }))); return; }
    const e = await forget(h, pos[0]);
    console.log(JSON.stringify({ hidden: pos[0], retraction: e.id, note: 'hidden, not deleted; use --permanent on sealed entries to destroy the key' }));
    return;
  }
  if (cmd === 'finish') {
    const h = await openLog({ dir: flags.dir, writer: flags.writer });
    console.log(JSON.stringify(await finishDeletes(h, { keysDir: flags.keys })));
    return;
  }
  if (cmd === 'ask') {
    const query = flags.f ? fs.readFileSync(flags.f, 'utf8') : pos[0];
    if (!query) throw new Error('a query is needed (inline or -f FILE)');
    const horizon = flags.horizon ? (String(flags.horizon).startsWith('writer:') ? { writer: String(flags.horizon).slice(7) } : String(flags.horizon)) : undefined;
    const { envelope, card: c } = await ask(flags.dir, query, { params, now: flags.now, as: flags.as ? String(flags.as).split(',') : undefined, horizon, cached: !!flags.cached });
    if (flags.json) { console.log(JSON.stringify(envelope)); return; }
    if (flags.card) console.log(renderCard(c) + '\n');
    for (const r of envelope.rows) console.log(JSON.stringify(Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith('_') || ['_addr', '_kind', '_retracted'].includes(k)))));
    return;
  }
  if (cmd === 'sig') {
    await load(); const s = new Sig(flags.dir, 'reader');
    if (pos[0] === 'rebuild') s.rebuild();
    console.log(JSON.stringify(s.status())); return;
  }
  if (cmd === 'kind') { const r = await readKind(flags.dir, pos[0], { strategy: flags.strategy || 'auto' }); console.log(JSON.stringify({ strategy: r.strategy, basis: r.basis, estimate: r.estimate, ms: r.ms, rows: r.rows.length, of: r.entries, ...(r.markError ? { markError: r.markError } : {}) })); for (const x of r.rows) console.log(JSON.stringify({ addr: x._addr, body: x.body })); return; }
  if (cmd === 'marks') { await load(); if (pos[0] === 'on') MK.setEnabled(flags.dir, true); else if (pos[0] === 'off') MK.setEnabled(flags.dir, false); console.log(JSON.stringify({ marks: MK.enabled(flags.dir) ? 'on' : 'off', where: MK.markDir(flags.dir) })); return; }
  if (cmd === 'trails') { await load(); const who = flags.who || 'reader', c = await MK.clock(flags.dir, who); console.log(JSON.stringify({ clock: { differences: c.ticks, halfLife: c.halfLife, forgetAfter: c.maxReuse, observedReuse: c.reuse }, trails: await MK.trails(flags.dir, who) }, null, 2)); return; }
  if (cmd === 'evaporate') { await load(); console.log(JSON.stringify(await MK.evaporate(flags.dir))); return; }
  if (cmd === 'shortcuts') { await load(); const which = pos[0] || 'all', who = flags.who || 'reader'; const f = { synapse: SC.promoteSynapses, wormhole: SC.promoteWormholes, expressway: SC.promoteExpressways }; const out = which === 'all' ? await SC.promoteAll(flags.dir, who) : await f[which](flags.dir, who); console.log(JSON.stringify(out, null, 2)); return; }
  if (cmd === 'related') { await load(); console.log(JSON.stringify(SC.related(flags.dir, pos[0]), null, 2)); return; }
  if (cmd === 'resolve') { await load(); console.log(JSON.stringify(SC.resolveName(flags.dir, pos[0]), null, 2)); return; }
  if (cmd === 'promote') { await load(); console.log(JSON.stringify(await MK.promotions(flags.dir, flags.who || 'reader'), null, 2)); return; }
  if (cmd === 'vf') { await load(); const M = await import('./vfmanage.mjs'), by = flags.by || 'eodb', why = flags.why || '', r = pos[0]; const o = { why, by }; const j = async (x) => console.log(JSON.stringify(await x, null, 2));
    if (r === 'status') return j(M.status(flags.dir)); if (r === 'plan') return j(M.plan(flags.dir, flags['keep-last'] ? { keepLast: +flags['keep-last'] } : {})); if (r === 'sweep') return j(M.sweep(flags.dir, { by, ...(flags['keep-last'] ? { keepLast: +flags['keep-last'] } : {}) }));
    if (r === 'pin') return j(M.pin(flags.dir, pos[1], o)); if (r === 'unpin') return j(M.unpin(flags.dir, pos[1], { by })); if (r === 'evict') return j(M.evict(flags.dir, pos[1], o)); if (r === 'withdraw') return j(M.keepAfterAll(flags.dir, pos[1], { by }));
    console.error('usage: db vf <status|plan|sweep|pin|unpin|evict|withdraw> [recipe] --dir D [--why TEXT] [--keep-last N]'); process.exit(2); }
  if (cmd === 'vfiles') { await load(); console.log(JSON.stringify(await vfiles(flags.dir), null, 2)); return; }
  if (cmd === 'review') { console.log(JSON.stringify(review(flags.dir), null, 2)); return; }
  if (cmd === 'trace') { console.log(JSON.stringify(await trace(flags.dir, pos[0]), null, 2)); return; }
  if (cmd === 'keys') { await load(); console.log(JSON.stringify(SG.makeKey(flags.dir, flags.writer))); return; }
  if (cmd === 'verify') { await load(); const h = E.open(uriFor(flags.dir), { mode: 'read' }); let rows; try { rows = E.run(h, 'DEF(SEG(sources); collapse: ["all"])', { params: {} }).rows; } finally { E.close(h); } const r = SG.verifyAll(flags.dir, rows.map((x) => ({ id: x._id, by: x._by }))); console.log(JSON.stringify({ ...r, problems: r.problems.slice(0, 10) }, null, 2)); return; }
  if (cmd === 'trust') { console.log(JSON.stringify(SG.trust(flags.dir, pos[0]))); return; }
  if (cmd === 'publish') { await load(); console.log(JSON.stringify(SG.publishIndex(flags.dir, flags.writer))); return; }
  if (cmd === 'adopt') { await load(); console.log(JSON.stringify(SG.adoptIndex(flags.dir, flags.writer, pos[0]), null, 2)); return; }
  if (cmd === 'who') { console.log(JSON.stringify(await who(flags.dir))); return; }
  if (cmd === 'compare') {
    const query = flags.f ? fs.readFileSync(flags.f, 'utf8') : pos[0];
    const side = (s) => (!s || s === 'all' ? {} : { as: String(s).split(',') });
    const r = await compare(flags.dir, query, { a: side(flags.as), b: side(flags.vs), params, now: flags.now });
    const show = (rows) => rows.map((x) => visibleKey(x));
    console.log(JSON.stringify({ onlyFirst: show(r.onlyA), onlySecond: show(r.onlyB), inBoth: r.both, firstStatus: r.cardA.determined ? 'determined' : 'contested', secondStatus: r.cardB.determined ? 'determined' : 'contested' }, null, 2));
    return;
  }
  if (cmd === 'get') {
    const g = await get(flags.dir, pos[0], { keysDir: flags.keys });
    console.log(JSON.stringify(flags.history ? g : { addr: g.addr, current: g.current, hidden: g.hidden, unreadSealed: g.unreadSealed, permanentlyDeleted: g.permanentlyDeleted }, null, 2));
    return;
  }
  if (cmd === 'view') {
    const expr = flags.f ? fs.readFileSync(flags.f, 'utf8') : pos[1];
    const r = await defineView(flags.dir, flags.writer, pos[0], expr, { params: flags.params ? String(flags.params).split(',') : [] });
    console.log(JSON.stringify(r));
    return;
  }
  if (cmd === 'site') {
    const sub = pos[0];
    if (sub === 'define') {
      const h = await openLog({ dir: flags.dir, writer: flags.writer });
      const { defineSite } = await import('./site.mjs');
      const pages = flags.pages ? JSON.parse(flags.pages) : [];
      const e = await defineSite(h, { title: flags.title || 'EODB site', pages });
      console.log(JSON.stringify({ addr: e.addr, id: e.id, title: flags.title, pages: pages.length }));
      return;
    }
    if (sub === 'serve') {
      const { serve } = await import('./api.mjs');
      const s = await serve(flags.dir, { site: true, port: flags.port ? Number(flags.port) : 0 });
      process.stdout.write(JSON.stringify({ site: `http://127.0.0.1:${s.port}/`, note: 'append ?as=<writer> to read as a different reader' }) + '\n');
      const stop = async () => { await s.close(); process.exit(0); };
      process.on('SIGINT', stop); process.on('SIGTERM', stop);
      await new Promise(() => {});
      return;
    }
    throw new Error('db site define|serve');
  }
  if (['init', 'brief', 'note', 'claim', 'release', 'decide', 'verify'].includes(cmd)) { await load(); const S = await import('./stig.mjs'); return S.run(cmd, rest); }
  throw new Error(`unknown command "${cmd}". Try: db help`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main(process.argv.slice(2)).catch((e) => { console.error(JSON.stringify({ error: String(e.message || e) })); process.exit(1); });
}
