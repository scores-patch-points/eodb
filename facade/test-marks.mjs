// Run: PHAROS_SRC=/path/to/pharos node --test facade/test-marks.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openLog, say, readKind, ask, get, trace } from './db.mjs';
import * as MK from './marks.mjs';
import { Sig, position } from './sig.mjs';
import { libs } from './store.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const TMP = process.env.TEST_TMP || path.join(here, '.test-tmp-marks');
fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true });
let n = 0; const fresh = () => path.join(TMP, `log${++n}`);
const { E } = await libs();
const marksRows = (dir) => { const h = E.open(`lazy:${MK.markDir(dir)}`, { mode: 'read' }); try { return E.run(h, 'DEF(SEG(sources); collapse: ["all"])', { params: {} }).rows; } finally { E.close(h); } };

async function logWith(counts = { rare: 6, common: 94 }) {
  const dir = fresh(); const w = await openLog({ dir, writer: 'w1', store: 'lazy' }); let i = 0;
  for (const [k, c] of Object.entries(counts)) for (let j = 0; j < c; j++) await say(w, 'add', `${k}:${i++}`, { n: i });
  return dir;
}
const probe = (directMs, scanMs, same = true) => ({ directMs, scanMs, same });
const withProbes = async (dir, kind, ps, who = 'reader') => { for (const p of ps) await MK.mark(dir, who, 'pattern', `sig:pattern:${kind}`, { kind, rows: 1, ms: 1, strategy: 'direct', basis: 'estimate', N: 100, probe: p }); };

test('marks are off by default: reading writes nothing and creates no marks store', async () => {
  const dir = await logWith(); const before = position(dir);
  await readKind(dir, 'rare');
  assert.equal(MK.enabled(dir), false); assert.ok(!fs.existsSync(MK.markDir(dir)), 'no marks folder'); assert.equal(position(dir), before);
});

test('with marks on, a read records one mark of each SIG kind, each at its own SIG cell', async () => {
  const dir = await logWith(); MK.setEnabled(dir, true);
  await readKind(dir, 'rare');
  const rows = marksRows(dir);
  const byKind = (k) => rows.filter((r) => r._kind === k);
  assert.equal(byKind('sig.pattern')[0]._cell, 'SIG·Pattern'); assert.equal(byKind('sig.figure')[0]._cell, 'SIG·Figure'); assert.equal(byKind('sig.ground')[0]._cell, 'SIG·Ground');
  for (const t of ['pattern', 'figure', 'ground']) assert.equal(byKind(`sig.${t}`).length, 1);
  const decl = rows.filter((r) => r._kind === 'kind').map((r) => r.body);
  assert.deepEqual(decl.filter((d) => d.name.startsWith('sig.')).map((d) => `${d.name}@${d.cell}`).sort(), ['sig.figure@SIG·Figure', 'sig.ground@SIG·Ground', 'sig.pattern@SIG·Pattern']);
  const g = byKind('sig.ground')[0].body; assert.equal(g.claim, 'complete to this position'); assert.equal(g.position, position(dir));
  const f = byKind('sig.figure')[0].body; assert.equal(MK.unpackIds(f.points).length, 6); assert.equal(f.count, 6);
});

test('marks never change an answer or the log', async () => {
  const dir = await logWith(); const before = position(dir);
  const off = await readKind(dir, 'rare'); MK.setEnabled(dir, true);
  const on = await readKind(dir, 'rare');
  assert.deepEqual(on.rows.map((r) => r._id).sort(), off.rows.map((r) => r._id).sort());
  assert.equal(position(dir), before, 'the log is byte-for-byte the same size after marked reads');
});

const pat = (dir, kind, extra = {}) => MK.mark(dir, 'reader', 'pattern', `sig:pattern:${kind}`, { kind, rows: 1, ms: 1, strategy: 'scan', basis: 'estimate', N: 1, probe: null, gainMs: 0, gainReads: 0, changed: false, ...extra });
const diff = (dir, kind) => pat(dir, kind, { gainMs: 5 });
// twelve differences alternating A, B: each kind returns every 2 differences, so the clock learns half-life 2 and forgets after 2
const learnRate = async (dir) => { for (let i = 0; i < 12; i++) await diff(dir, i % 2 ? 'B' : 'A'); };

test('the pheromone clock ticks only on differences: with too little evidence of a return rate nothing decays, and reading without effect never ages anything', async () => {
  const dir = await logWith(); MK.setEnabled(dir, true);
  for (let i = 0; i < 40; i++) await pat(dir, 'busy');                                  // forty reads that changed nothing
  await diff(dir, 'A'); await diff(dir, 'B');
  const c = await MK.clock(dir, 'reader'); assert.equal(c.ticks, 2); assert.equal(c.halfLife, null, 'no observed returns, so no rate');
  const t = await MK.trails(dir, 'reader'); assert.equal(t.find((x) => x.kind === 'busy').attention, 40, 'nothing has aged');
});

test('once differences return, half-life is the median gap between differences on a kind, and a mark older than the longest gap is forgotten; the same marks always give the same answer', async () => {
  const dir = await logWith(); MK.setEnabled(dir, true);
  await pat(dir, 'old');                                                                  // deposited before any difference
  await learnRate(dir);
  await pat(dir, 'mid'); await diff(dir, 'A'); await diff(dir, 'B');                       // two differences after 'mid'
  await pat(dir, 'new');
  const c = await MK.clock(dir, 'reader'); assert.equal(c.halfLife, 2); assert.equal(c.maxReuse, 2); assert.ok(c.reuse >= MK.MIN_REUSE);
  const t = await MK.trails(dir, 'reader'), get = (k) => t.find((x) => x.kind === k);
  assert.equal(get('old'), undefined, 'older than the longest observed return: forgotten');
  assert.equal(get('mid').attention, 0.5, 'two differences old = one half-life'); assert.equal(get('new').attention, 1);
  assert.deepEqual(await MK.trails(dir, 'reader'), t);
});

test('one read is one tick of the clock, however many marks it deposits', async () => {
  const dir = await logWith(); MK.setEnabled(dir, true);
  for (const k of ['A', 'B', 'C', 'D']) await pat(dir, k, { gainMs: 5, evt: 'same-read' });          // four difference marks from a single read
  await pat(dir, 'E', { gainMs: 5, evt: 'other-read' });
  assert.equal((await MK.clock(dir, 'reader')).ticks, 2);
});

test('difference that makes a difference: attention is not enough; only measured savings and overrides count toward the difference columns', async () => {
  const dir = await logWith(); MK.setEnabled(dir, true);
  for (let i = 0; i < 5; i++) await pat(dir, 'busy');
  await pat(dir, 'useful', { gainMs: 40, changed: true }); await pat(dir, 'traced', { gainReads: 200 });
  const t = await MK.trails(dir, 'reader'); const get = (k) => t.find((x) => x.kind === k);
  assert.equal(get('busy').attention, 5); assert.equal(get('busy').madeADifference, false);
  assert.equal(get('useful').savedMs, 40); assert.equal(get('useful').overrides, 1); assert.equal(get('traced').savedReads, 200);
  assert.deepEqual(t.slice(0, 2).map((x) => x.kind).sort(), ['traced', 'useful'], 'what made a difference ranks above what was merely read');
});

test('a real kind read records a measured gain only when a probe ran both paths', async () => {
  const dir = await logWith(); MK.setEnabled(dir, true);
  for (let i = 0; i < 5; i++) await readKind(dir, 'rare');
  const ms = await MK.readMarks(dir, 'pattern', { who: 'reader' }).then((r) => r.filter((m) => m.kind === 'rare'));
  assert.equal(ms.filter((m) => m.probe).length, 1); assert.ok(ms.filter((m) => !m.probe).every((m) => m.gainMs === 0), 'unprobed reads claim no gain');
});

test('evaporate rebuilds the marks store with only live marks, in order, and the log does not change; evaporated probes stop counting toward a verdict', async () => {
  const dir = await logWith(); MK.setEnabled(dir, true); const before = position(dir);
  for (const p of Array(9).fill(probe(10, 100))) await pat(dir, 'rare', { probe: p });
  assert.equal((await MK.promotion(dir, 'rare', 'reader')).state, 'promoted');
  await learnRate(dir); await pat(dir, 'fresh');
  assert.equal((await MK.promotion(dir, 'rare', 'reader')).state, 'undecided', 'the probes are now older than any observed return');
  const r = await MK.evaporate(dir); assert.ok(r.dropped >= 9 && r.kept >= 13, JSON.stringify(r));
  const kinds = (await MK.readMarks(dir, 'pattern', { who: 'reader' })).map((m) => m.kind); assert.ok(!kinds.includes('rare')); assert.ok(kinds.includes('fresh'));
  assert.equal(position(dir), before, 'the log is untouched'); assert.ok(MK.enabled(dir), 'marks stay on');
});

test('the held-out check: promoted only when later probes are cheap too, demoted when they are not or a row differs, otherwise undecided', () => {
  const cheap = probe(10, 100), dear = probe(90, 100);
  assert.equal(MK.decide([cheap, cheap, cheap]).state, 'undecided', 'too few probes');
  assert.equal(MK.decide(Array(9).fill(cheap)).state, 'promoted');
  assert.equal(MK.decide([...Array(6).fill(cheap), dear, dear, dear]).state, 'demoted', 'cheap early, not cheap on held-out probes');
  assert.equal(MK.decide([...Array(6).fill(dear), cheap, cheap, cheap]).state, 'undecided', 'the earlier probes did not nominate it');
  assert.equal(MK.decide([...Array(8).fill(cheap), probe(10, 100, false)]).state, 'demoted', 'one non-identical read demotes');
  assert.equal(MK.decide([...Array(6).fill(cheap), cheap, dear, cheap]).state, 'undecided', 'held-out result in between: 2 of 3 cheap is under 80%');
});

test('a promoted verdict makes the chooser take the direct path even when the estimate says scan, and the rows are still right', async () => {
  const dir = await logWith(); MK.setEnabled(dir, true);
  const s = new Sig(dir, 'reader'); s.advance(); s.calib = { scanUs: 1, readUs: 100000, entries: s.all.size }; s.dirty = true; s.flush();   // direct looks hopeless
  assert.equal((await readKind(dir, 'rare')).strategy, 'scan', 'with no verdict the estimate decides');
  await withProbes(dir, 'rare', Array(9).fill(probe(10, 100)));
  const r = await readKind(dir, 'rare');
  assert.equal(r.basis, 'promoted'); assert.equal(r.strategy, 'direct');
  const scan = await readKind(dir, 'rare', { strategy: 'scan' });
  assert.deepEqual(r.rows.map((x) => x._id).sort(), scan.rows.map((x) => x._id).sort());
});

test('a demoted verdict makes the chooser take the scan even when the estimate says direct', async () => {
  const dir = await logWith(); MK.setEnabled(dir, true);
  const s = new Sig(dir, 'reader'); s.advance(); s.calib = { scanUs: 1000, readUs: 1, entries: s.all.size }; s.dirty = true; s.flush();   // direct looks great
  assert.equal((await readKind(dir, 'rare')).strategy, 'direct');
  await withProbes(dir, 'rare', [...Array(6).fill(probe(10, 100)), probe(95, 100), probe(95, 100), probe(95, 100)]);
  const r = await readKind(dir, 'rare'); assert.equal(r.basis, 'demoted'); assert.equal(r.strategy, 'scan');
});

test("only the reader's own marks count: another writer's probes cannot promote anything", async () => {
  const dir = await logWith(); MK.setEnabled(dir, true);
  await withProbes(dir, 'rare', Array(12).fill(probe(1, 1000)), 'attacker');
  assert.equal((await MK.promotion(dir, 'rare', 'reader')).state, 'undecided');
  assert.equal((await MK.promotion(dir, 'rare', 'attacker')).state, 'promoted', 'it counts for the one who wrote it, and nobody else');
});

test('with marks on, every fifth read of a kind runs both paths, compares the rows, and records both costs', async () => {
  const dir = await logWith(); MK.setEnabled(dir, true);
  for (let i = 0; i < 5; i++) await readKind(dir, 'rare');
  const probes = (await MK.readMarks(dir, 'pattern', { who: 'reader' })).filter((m) => m.probe);
  assert.equal(probes.length, 1, 'exactly one probe in five reads');
  assert.equal(probes[0].probe.same, true); assert.ok(probes[0].probe.scanMs > 0 && probes[0].probe.directMs > 0);
});

test('a forced strategy is never probed or overridden by a verdict', async () => {
  const dir = await logWith(); MK.setEnabled(dir, true);
  await withProbes(dir, 'rare', Array(9).fill(probe(10, 100)));
  const r = await readKind(dir, 'rare', { strategy: 'scan' }); assert.equal(r.strategy, 'scan'); assert.equal(r.basis, 'forced');
});

test('a mark that cannot be written is reported, never hidden, and does not change the answer; a removed marks folder is recreated', async () => {
  const dir = await logWith(); MK.setEnabled(dir, true);
  await readKind(dir, 'rare');
  fs.rmSync(MK.markDir(dir), { recursive: true, force: true }); MK.setEnabled(dir, true);            // folder removed behind a cached handle, then re-enabled
  const r = await readKind(dir, 'rare');
  assert.equal(r.markError, null, 'the handle was reopened, so the mark was written');
  assert.equal(marksRows(dir).filter((x) => x._kind === 'sig.pattern').length, 1);
  const bad = await logWith(); MK.setEnabled(bad, true); fs.writeFileSync(path.join(MK.markDir(bad), 'PLACEMENT.json'), '{not json');
  const q = await readKind(bad, 'rare');
  assert.equal(q.rows.length, 6, 'the answer is right even though marking failed'); assert.ok(q.markError, 'and the failure is visible: ' + q.markError);
});


test('reads are transformations too: ask, get and trace each deposit a figure mark of what was touched together, and change no answer', async () => {
  const dir = await logWith({ rare: 4, common: 6 }); const before = position(dir);
  const off = await ask(dir, 'SEG(sources; kinds: ["rare","common"])', { as: undefined });
  MK.setEnabled(dir, true);
  const on = await ask(dir, 'SEG(sources; kinds: ["rare","common"])');
  assert.deepEqual(on.envelope.rows.map((r) => r._id).sort(), off.envelope.rows.map((r) => r._id).sort());
  assert.equal(on.card.markError, undefined);
  const addr = on.envelope.rows[0]._addr; await get(dir, addr);
  const w = await openLog({ dir, writer: 'w1', store: 'lazy' });
  const a = await say(w, 'add', 'chain:a', { n: 1 }); const b = await say(w, 'link', 'chain:b', { n: 2 }, { of: [a.id] });
  const after = position(dir);
  await trace(dir, b.id);
  assert.equal(position(dir), after, 'reading wrote nothing to the log');
  const figs = await MK.readMarks(dir, 'figure', { who: 'reader' });
  assert.deepEqual([...new Set(figs.map((f) => f.via))].sort(), ['ask', 'get', 'trace']);
  assert.equal(figs.find((f) => f.via === 'ask').addrs.length, 10, 'the ask touched ten addresses together');
});

process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true }));
