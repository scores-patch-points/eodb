// Run: PHAROS_SRC=/path/to/pharos node --test test-vfmanage.mjs
// EODB managing virtual files that Proteus writes. Proteus's entries are woven here from the contract's shapes; nothing of Proteus is imported.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openLog } from './db.mjs';
import * as M from './vfmanage.mjs';
import { liveRows } from './vfiles.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const TMP = process.env.TEST_TMP || path.join(here, '.test-tmp-vfmanage');
fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true });
let n = 0; const fresh = () => path.join(TMP, `log${++n}`);
process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true }));
const sleep = (ms = 4) => new Promise((ok) => setTimeout(ok, ms));
const R = (i) => String(i).repeat(64).slice(0, 64);

const proteus = (dir) => openLog({ dir, writer: 'proteus', store: 'lazy' });
async function file(w, recipe, seq, project = 'p1') { await sleep(); return w.weave({ cell: 'SYN·Pattern', kind: 'vfile', addr: `vfile:${project}:${seq}`, of: [], body: { project, sequence: seq, projector: 'vfold@v2', recipe, clips: [], where: {}, size: 100, header_sha256: 'c'.repeat(64), chunks: 1 } }); }
const ack = (w, evictId, recipe, result = 'dropped') => w.weave({ cell: 'REC·Figure', kind: 'vfile-evicted', addr: `vfile-evicted:${evictId.slice(0, 16)}`, of: [evictId], body: { recipe, evict: evictId, result, chunks_removed: 2, bytes: 5000, shared_kept: 1 } });

test('pin weaves a DEF·Figure citing the file; status shows it; unpin retracts it; an unknown recipe is an error', async () => {
  const dir = fresh(), w = await proteus(dir), f = await file(w, R(1), 'A');
  const p = await M.pin(dir, R(1), { why: 'client cut' });
  const e = (await liveRows(dir, 'vfile-pin'))[0]; assert.equal(e._cell, 'DEF·Figure'); assert.equal(e._by, 'eodb'); assert.deepEqual(e._of, [f.id]); assert.equal(e.body.why, 'client cut'); assert.equal(p.id, e._id);
  assert.equal((await M.status(dir)).files[0].pinned, true);
  await M.unpin(dir, R(1)); assert.equal((await M.status(dir)).files[0].pinned, false); assert.equal((await liveRows(dir, 'vfile-pin')).length, 0);
  await assert.rejects(M.pin(dir, 'z'.repeat(64)), /no live virtual file/);
});

test('evict weaves a SEG·Figure request; it is refused while pinned; a pending request is not duplicated; once answered it can be asked again', async () => {
  const dir = fresh(), w = await proteus(dir), f = await file(w, R(2), 'A'); await M.pin(dir, R(2));
  assert.deepEqual(await M.evict(dir, R(2)), { refused: 'pinned', recipe: R(2) }); assert.equal((await liveRows(dir, 'vfile-evict')).length, 0, 'a refusal weaves nothing');
  await M.unpin(dir, R(2));
  const r1 = await M.evict(dir, R(2), { why: 'cold' }); const e = (await liveRows(dir, 'vfile-evict'))[0];
  assert.equal(e._cell, 'SEG·Figure'); assert.deepEqual(e._of, [f.id]); assert.equal(e.body.recipe, R(2)); assert.equal(r1.id, e._id);
  assert.equal((await M.evict(dir, R(2))).already, true, 'pending: not asked twice');
  let s = (await M.status(dir)).files[0]; assert.equal(s.evict_requested, true); assert.equal(s.acknowledged, null);
  ack(w, e._id, R(2)); s = (await M.status(dir)).files[0]; assert.equal(s.acknowledged.result, 'dropped'); assert.equal(s.acknowledged.chunks_removed, 2); assert.equal(s.acknowledged.bytes, 5000);
  const r2 = await M.evict(dir, R(2), { why: 'again' }); assert.ok(r2.id && r2.id !== r1.id, 'a new, distinct request after the first was answered');
});

test('a request that was withdrawn is gone from the live requests', async () => {
  const dir = fresh(), w = await proteus(dir); await file(w, R(3), 'A'); await M.evict(dir, R(3));
  await M.keepAfterAll(dir, R(3)); assert.equal((await liveRows(dir, 'vfile-evict')).length, 0); assert.equal((await M.status(dir)).files[0].evict_requested, false);
});

test('plan keeps the newest keepLast files per project, never proposes a pinned or already-requested file, and sweep weaves a request for each candidate once', async () => {
  const dir = fresh(), w = await proteus(dir);
  for (let i = 1; i <= 5; i++) await file(w, R(i), `S${i}`);          // project p1, oldest first: S1 .. S5
  await file(w, R(9), 'T1', 'p2');                                   // another project: its single file is within keepLast
  await M.pin(dir, R(1)); await M.evict(dir, R(2));                  // S1 pinned, S2 already requested
  const p = await M.plan(dir, { keepLast: 2 });
  assert.deepEqual(p.candidates.map((c) => c.recipe), [R(3)], 'S3 is the only old, unpinned, unrequested file; S4 and S5 are recent');
  const reasons = Object.fromEntries(p.kept.map((k) => [k.recipe, k.reason])); assert.equal(reasons[R(1)], 'pinned'); assert.equal(reasons[R(2)], 'already requested'); assert.equal(reasons[R(4)], 'recent'); assert.equal(reasons[R(9)], 'recent');
  const s = await M.sweep(dir, { keepLast: 2 }); assert.equal(s.requested, 1); assert.equal((await M.sweep(dir, { keepLast: 2 })).requested, 0, 'the second sweep finds nothing new');
  assert.equal((await M.status(dir)).tally.evict_requested, 2);
});

test('this module imports only the facade and node: nothing of Proteus', () => {
  const src = fs.readFileSync(path.join(here, 'vfmanage.mjs'), 'utf8');
  assert.deepEqual([...src.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]).sort(), ['./db.mjs', './vfiles.mjs', 'node:crypto']);
});
