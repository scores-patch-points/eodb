// Run: PHAROS_SRC=/path/to/pharos node --test facade/test-shortcuts.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openLog, say, trace } from './db.mjs';
import * as MK from './marks.mjs';
import { position } from './sig.mjs';
import { Sig } from './sig.mjs';
import * as SC from './shortcuts.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const TMP = process.env.TEST_TMP || path.join(here, '.test-tmp-shortcuts');
fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true });
let n = 0; const fresh = () => path.join(TMP, `log${++n}`);
let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const noise = (k = 2) => Array.from({ length: k }, () => `n:${Math.floor(rnd() * 30)}`);
// A and B are read together a third of the time, and each also alone sometimes, so they are NOT always together (always-together addresses are one node)
const planted = (i) => (i % 3 === 0 ? ['a:A', 'a:B', ...noise(1)] : i % 12 === 1 ? ['a:A', ...noise(2)] : i % 12 === 2 ? ['a:B', ...noise(2)] : noise(3));
const liveRows = (dir, kind) => { const s = new Sig(SC.derivedDir(dir), 'reader'); s.advance(); return (s.byKind.get(kind) || []).filter((id) => !s.retracted.has(id)).map((id) => s.readAt(id)); };
const figure = (dir, question, addrs) => MK.mark(dir, 'reader', 'figure', `sig:figure:${Math.random()}`, { question, addrs, via: 'ask', count: addrs.length, points: [] });

test('synapse: a pair read together above chance, in two rounds, and again in held-out questions, is promoted; random pairs are not', () => {
  const qs = []; for (let i = 0; i < 120; i++) qs.push(planted(i));
  const r = SC.synapses(qs);
  assert.equal(r.state, 'promoted'); assert.ok(r.pairs.some((p) => p.a === 'a:A' && p.b === 'a:B'), JSON.stringify(r.pairs));
  assert.equal(r.pairs.filter((p) => !(p.a.startsWith('a:') && p.b.startsWith('a:'))).length, 0, 'no noise pair is promoted');
  assert.equal(SC.synapses(qs.slice(0, 5)).state, 'undecided', 'too few questions');
});

test('synapse: addresses that are always read together are one node, so adjacency inside a topic is never a synapse', () => {
  const qs = []; for (let i = 0; i < 40; i++) qs.push(i % 2 === 0 ? ['t1:note', 't1:file', 't1:claim', 't1:decision', ...noise(1)] : noise(3));
  const r = SC.synapses(qs); assert.equal(r.pairs.length, 0, JSON.stringify(r.pairs));
});

test('synapse: groups of always-together addresses are connected as groups, and the entry names the members of each side', () => {
  const qs = [];
  for (let i = 0; i < 120; i++) qs.push(i % 3 === 0 ? ['x:1', 'x:2', 'y:1', 'y:2', ...noise(1)] : i % 12 === 1 ? ['x:1', 'x:2', ...noise(2)] : i % 12 === 2 ? ['y:1', 'y:2', ...noise(2)] : noise(3));
  const r = SC.synapses(qs); const p = r.pairs.find((x) => x.a.startsWith('x:') && x.b.startsWith('y:'));
  assert.ok(p, JSON.stringify(r.pairs)); assert.deepEqual(p.ga, ['x:1', 'x:2']); assert.deepEqual(p.gb, ['y:1', 'y:2']);
});

test('synapse: the gate is calibrated against chance: across 30 random datasets with no structure, at most 2 produce any synapse', () => {
  let falsePositive = 0;
  for (let k = 0; k < 30; k++) { seed = 1000 + k * 37; const qs = Array.from({ length: 60 }, () => noise(3)); if (SC.synapses(qs).pairs.length) falsePositive++; }
  assert.ok(falsePositive <= 2, `${falsePositive} of 30 random datasets produced a synapse`);
});

test('synapse: power and false positives are measured, not assumed: planted pair found in at least 18 of 20 runs of 120 questions, and no noise pair is ever promoted', () => {
  let found = 0, noisy = 0;
  for (let k = 0; k < 20; k++) {
    seed = 500 + k * 53; const r = SC.synapses(Array.from({ length: 120 }, (_, i) => planted(i)));
    if (r.pairs.some((p) => p.a === 'a:A' && p.b === 'a:B')) found++; if (r.pairs.some((p) => !(p.a.startsWith('a:') && p.b.startsWith('a:')))) noisy++;
  }
  assert.ok(found >= 18, `found ${found} of 20`); assert.equal(noisy, 0);
});

test('wormhole: a name bound to one referent beats the random-binding null; scattered, rare and literal names become typed gaps', () => {
  const figs = [];
  for (let i = 0; i < 9; i++) figs.push({ question: 'show the girl', addrs: ['cast:anna', ...noise(2)] });
  for (let i = 0; i < 9; i++) figs.push({ question: 'weather report', addrs: noise(3) });
  for (let i = 0; i < 2; i++) figs.push({ question: 'unicorn', addrs: ['cast:zed'] });
  for (let i = 0; i < 6; i++) figs.push({ question: 'anna', addrs: ['cast:anna', ...noise(1)] });
  const { bound, gaps } = SC.wormholes(figs);
  const g = bound.find((b) => b.name === 'girl'); assert.ok(g && g.referent === 'cast:anna' && g.z >= g.need, JSON.stringify(bound));
  const gap = (name) => (gaps.find((x) => x.name === name) || {}).gap;
  assert.equal(gap('weather'), 'not_concentrated'); assert.equal(gap('unicorn'), 'too_few'); assert.equal(gap('anna'), 'literal');
});

test('marks to entries: a promoted synapse and wormhole are ordinary entries at their own cells, by the derive writer, with evidence in basis; a later check retracts the stale one', async () => {
  const dir = fresh(); const w = await openLog({ dir, writer: 'w1', store: 'lazy' }); await say(w, 'add', 'seed:0', { n: 0 });
  MK.setEnabled(dir, true);
  for (let i = 0; i < 120; i++) await figure(dir, i % 3 === 0 ? 'the girl and her ring' : 'misc q' + i, planted(i));
  const r = await SC.promoteAll(dir, 'reader');
  assert.equal(r.synapse.state, 'promoted'); assert.ok(r.synapse.written >= 1);
  const syn = liveRows(dir, 'synapse')[0]; assert.equal(syn.cell, 'INS·Pattern'); assert.equal(syn.by, 'derive-reader'); assert.equal(syn.basis.instrument, 'shortcuts@1'); assert.deepEqual(syn.of, []);
  assert.deepEqual(SC.related(dir, 'a:A').map((x) => x.addr), ['a:B']);
  const wh = liveRows(dir, 'wormhole'); assert.ok(wh.length >= 1); assert.equal(wh[0].cell, 'CON·Figure');
  const girl = SC.resolveName(dir, 'girl'); assert.ok(girl, 'girl resolves'); assert.ok(['a:A', 'a:B'].includes(girl.referent));
  // the evidence moves: two thirds of the later questions bind the name elsewhere, so the old entry is retracted and a new one written
  const old = girl.referent;
  for (let i = 0; i < 200; i++) await figure(dir, 'the girl again', ['a:Z', ...noise(2)]);
  const r2 = await SC.promoteWormholes(dir, 'reader');
  assert.ok(r2.retracted >= 1 && r2.written >= 1, JSON.stringify({ w: r2.written, r: r2.retracted }));
  assert.equal(SC.resolveName(dir, 'girl').referent, 'a:Z'); assert.notEqual(old, 'a:Z');
  assert.equal(liveRows(dir, 'wormhole').filter((x) => x.addr === 'wormhole:girl').length, 1, 'exactly one live binding');
});

const dmd = (dir, kind, i) => MK.mark(dir, 'reader', 'pattern', `sig:pattern:${kind}`, { kind, rows: 1, ms: 1, strategy: 'direct', basis: 'read', N: 1, probe: null, gainMs: 5 + i, gainReads: 0, changed: false });

test('a synapse and a wormhole are forgotten when their evidence evaporates (older than the longest observed return), and the main log is untouched by promotion and forgetting', async () => {
  const dir = fresh(); const w = await openLog({ dir, writer: 'w1', store: 'lazy' }); await say(w, 'add', 'seed:0', { n: 0 });
  MK.setEnabled(dir, true);
  for (let i = 0; i < 120; i++) await MK.mark(dir, 'reader', 'figure', `sig:figure:${i}`, { question: i % 3 === 0 ? 'the girl and her ring' : 'misc q' + i, addrs: planted(i), via: 'ask', count: 3, points: [] });
  const logBefore = position(dir);
  await SC.promoteSynapses(dir, 'reader'); await SC.promoteWormholes(dir, 'reader');
  const live0 = (k) => liveRows(dir, k).length;
  assert.ok(live0('synapse') >= 1 && live0('wormhole') >= 1, 'promoted while there is no evidence of any rate of forgetting');
  assert.equal(position(dir), logBefore, 'derived entries are in the cache, not the log');
  await flood(dir);                                                                       // the window moves on: the original questions are no longer evidence
  const s = await SC.promoteSynapses(dir, 'reader'), wh = await SC.promoteWormholes(dir, 'reader');
  assert.ok(s.retracted >= 1 && wh.retracted >= 1, JSON.stringify({ s: s.retracted, w: wh.retracted }));
  assert.equal(live0('synapse'), 0); assert.equal(live0('wormhole'), 0); assert.deepEqual(SC.related(dir, 'a:A'), []);
  assert.equal(position(dir), logBefore, 'still untouched');
});

test('deleting the derived cache changes no answer: trace is identical without it, and the links rebuild', async () => {
  const dir = fresh(); const ids = await chain(dir, 300); await SC.promoteExpressways(dir, 'reader');
  const withLinks = (await trace(dir, ids[299]))[0];
  fs.rmSync(SC.derivedDir(dir), { recursive: true, force: true }); fs.rmSync(SC.derivedDir(dir) + '.sig', { recursive: true, force: true });
  const without = (await trace(dir, ids[299]))[0];
  assert.deepEqual(without.ancestors, withLinks.ancestors); assert.ok(without.hops > withLinks.hops * 5);
  await SC.promoteExpressways(dir, 'reader'); assert.deepEqual((await trace(dir, ids[299]))[0].hops, withLinks.hops);
});


const rowsAt = (...addrs) => addrs.map((a, i) => ({ _id: 'id' + i, _addr: a, _kind: 'add' }));
async function withSynapse() {
  const dir = fresh(); const w = await openLog({ dir, writer: 'w1', store: 'lazy' }); await say(w, 'add', 'seed:0', { n: 0 });
  MK.setEnabled(dir, true);
  for (let i = 0; i < 120; i++) await MK.mark(dir, 'reader', 'figure', `sig:figure:${i}`, { question: i % 3 === 0 ? 'the girl and her ring' : 'misc q' + i, addrs: planted(i), via: 'ask', count: 3, points: [] });
  await SC.promoteSynapses(dir, 'reader'); await SC.promoteWormholes(dir, 'reader');
  assert.ok(liveRows(dir, 'synapse').some((e) => e.body.a === 'a:A' && e.body.b === 'a:B'), 'setup: the pair is promoted');
  return dir;
}
// flood: enough unrelated reads that everything older has left the evidence window
const flood = async (dir, n = MK.EVIDENCE_WINDOW) => { for (let i = 0; i < n; i++) await MK.noteRead(dir, 'reader', { question: 'noise ' + i, via: 'ask', rows: rowsAt('z:' + (i % 50), 'z:' + ((i * 7 + 3) % 50)) }); };
const use = (dir, question, ...addrs) => MK.noteRead(dir, 'reader', { question, via: 'ask', rows: rowsAt(...addrs) });
const useMarks = async (dir, prefix) => (await MK.readMarks(dir, 'pattern', { who: 'reader' })).filter((m) => m.outcome && m.kind.startsWith(prefix));

test('fire together, wire together: a read touching both ends of a synapse is a hit that saves a read and ticks the difference clock; touching one end is a miss', async () => {
  const dir = await withSynapse(); const k = 'synapse:a:A~a:B';
  await use(dir, 'q1', 'a:A', 'a:B'); await use(dir, 'q2', 'a:A');
  const m = await useMarks(dir, k); assert.deepEqual(m.map((x) => x.outcome), ['hit', 'miss']);
  assert.equal(m[0].gainReads, 1); assert.equal(m[1].gainReads, 0);
  assert.equal((await MK.clock(dir, 'reader')).ticks, 1, 'only the hit made a difference');
});

test('use it or lose it: a synapse that mostly mispredicts is depressed after enough outcomes and retracted, even though the old evidence still supports it', async () => {
  const dir = await withSynapse(); const k = 'synapse:a:A~a:B';
  for (let i = 0; i < MK.MIN_REUSE; i++) await use(dir, 'lone ' + i, 'a:A');
  assert.equal(SC.verdictOf((await SC.balanceOf(dir, 'reader', 'synapse:')).get(k)), 'depressed');
  const r = await SC.promoteSynapses(dir, 'reader'); assert.ok(r.retracted >= 1, JSON.stringify({ w: r.written, r: r.retracted }));
  assert.ok(!liveRows(dir, 'synapse').some((e) => e.addr === k)); assert.deepEqual(SC.related(dir, 'a:A'), []);
  const few = await withSynapse(); await use(few, 'lone', 'a:A'); await SC.promoteSynapses(few, 'reader');
  assert.ok(liveRows(few, 'synapse').some((e) => e.addr === k), 'one miss is not enough evidence to prune');
});

test('a used synapse outlives its evidence: when the questions that created it have evaporated, repeated hits keep it; an unused one would be forgotten', async () => {
  const dir = await withSynapse(); const k = 'synapse:a:A~a:B';
  for (let i = 0; i < 7; i++) await use(dir, 'again ' + i, 'a:A', 'a:B');                 // hits
  await flood(dir, MK.EVIDENCE_WINDOW);
  assert.ok((await MK.live(dir, 'figure', { who: 'reader' })).filter((f) => /girl/.test(f.question)).length === 0, 'the original questions have evaporated');
  await SC.promoteSynapses(dir, 'reader');
  assert.ok(liveRows(dir, 'synapse').some((e) => e.addr === k), 'kept by use');
  assert.deepEqual(SC.related(dir, 'a:A').map((x) => x.addr), ['a:B']);
});

test('a synapse is its pair, not its statistics: re-promoting after the window slides a little writes nothing new for pairs that still hold', async () => {
  const dir = await withSynapse(); const before = liveRows(dir, 'synapse').length;
  for (let i = 0; i < 6; i++) await MK.mark(dir, 'reader', 'figure', `sig:figure:x${i}`, { question: 'more', addrs: planted(i + 1), via: 'ask', count: 3, points: '' });   // the statistics shift
  const r = await SC.promoteSynapses(dir, 'reader'); assert.equal(r.written, 0); assert.equal(r.retracted, 0); assert.equal(liveRows(dir, 'synapse').length, before);
});

test('a name used in a question is a hit when its referent is touched and a miss when it is not; a wormhole that keeps missing is retracted', async () => {
  const dir = await withSynapse(); const ref = SC.resolveName(dir, 'girl'); assert.ok(ref, 'setup: girl resolves');
  await use(dir, 'show the girl', ref.referent); await use(dir, 'show the girl', 'x:other');
  assert.deepEqual((await useMarks(dir, 'wormhole:girl')).map((x) => x.outcome), ['hit', 'miss']);
  for (let i = 0; i < MK.MIN_REUSE; i++) await use(dir, 'the girl ' + i, 'x:other');
  const r = await SC.promoteWormholes(dir, 'reader'); assert.ok(r.retracted >= 1, JSON.stringify({ w: r.written, r: r.retracted }));
  assert.equal(SC.resolveName(dir, 'girl'), null);
});

test('promoting again with the same evidence writes nothing and retracts nothing (no churn)', async () => {
  const dir = fresh(); await chain(dir, 300);
  const first = await SC.promoteExpressways(dir, 'reader'); assert.ok(first.written > 0);
  const again = await SC.promoteExpressways(dir, 'reader'); assert.equal(again.written, 0); assert.equal(again.retracted, 0);
});

async function chain(dir, len, branchAt) {
  const w = await openLog({ dir, writer: 'w1', store: 'lazy' }); let prev = null, side = null; const ids = [];
  for (let i = 0; i < len; i++) {
    let of = prev ? [prev.id] : [];
    if (i === branchAt) { side = await say(w, 'add', 'side:x', { n: -1 }); of = [prev.id, side.id]; }
    prev = await say(w, 'link', `c:${i}`, { i }, { of }); ids.push(prev.id);
  }
  return ids;
}

test('expressway: skip links are written only when held-out traces are identical and cheaper, and traceFast returns exactly the same ancestors', async () => {
  const dir = fresh(); const ids = await chain(dir, 300);
  const r = await SC.promoteExpressways(dir, 'reader');
  assert.equal(r.state, 'promoted', JSON.stringify(r)); assert.ok(r.heldRatio <= SC.HOP_GAIN, 'cost ratio ' + r.heldRatio);
  const live = liveRows(dir, 'expressway'); assert.ok(live.length >= 8); assert.equal(live[0].cell, 'CON·Pattern');
  const sig = new Sig(dir, 'reader');
  for (const id of [ids[299], ids[250], ids[133], ids[40]]) {
    const plain = sig.ancestors(id).ancestors.map((e) => ({ id: e.id, kind: e.kind, addr: e.addr, by: e.by })), fast = SC.traceFast(dir, id);
    assert.deepEqual(fast.ancestors, plain, 'identical ancestors for ' + id.slice(0, 8));
  }
  assert.ok(SC.traceFast(dir, ids[299]).cost < 300 * 0.2, 'about a sixth of the reads');
});

test('expressway: a chain with a second parent is never skipped past wrongly (the answer still matches the full walk), and a short log writes nothing', async () => {
  const dir = fresh(); const ids = await chain(dir, 200, 100);
  await SC.promoteExpressways(dir, 'reader');
  const sig = new Sig(dir, 'reader'); const plain = sig.ancestors(ids[199]).ancestors.map((e) => ({ id: e.id, kind: e.kind, addr: e.addr, by: e.by }));
  assert.deepEqual(SC.traceFast(dir, ids[199]).ancestors, plain);
  const short = fresh(); await chain(short, 20); const r = await SC.promoteExpressways(short, 'reader');
  assert.equal(r.state, 'undecided'); assert.equal(liveRows(short, 'expressway').length, 0);
});

test('db trace uses live expressways when they exist, returns the same ancestors, and reads far less', async () => {
  const dir = fresh(); const ids = await chain(dir, 300);
  const before = (await trace(dir, ids[299]))[0];
  await SC.promoteExpressways(dir, 'reader');
  const after = (await trace(dir, ids[299]))[0];
  assert.deepEqual(after.ancestors, before.ancestors); assert.ok(after.hops < before.hops * 0.2, `${after.hops} against ${before.hops}`);
});

process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true }));
