// Run: PHAROS_SRC=/path/to/pharos node --test test-vfiles.mjs
// EODB reading the virtual files that Proteus writes to the pharos. The entries here are woven straight from the contract's shapes: nothing of the writer is imported.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openLog } from './db.mjs';
import { vfiles } from './vfiles.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const TMP = process.env.TEST_TMP || path.join(here, '.test-tmp-vfiles');
fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true });
let n = 0; const fresh = () => path.join(TMP, `log${++n}`);
process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true }));

const R1 = 'a'.repeat(64), R2 = 'b'.repeat(64);
const vfile = (w, recipe, extra = {}, of = [], seq = 'Main') => w.weave({ cell: 'SYN·Pattern', kind: 'vfile', addr: `vfile:p1:${seq}`, of, body: { project: 'p1', sequence: seq, projector: 'vfold@v2', recipe, clips: [{ s: 0, e: 3, in: 0, media: 'ess_a', crop: '' }, { s: 3, e: 6, in: 1, media: 'ess_b', crop: '' }], where: {}, size: null, header_sha256: null, chunks: null, ...extra } });
const built = { size: 2765215, header_sha256: 'c'.repeat(64), chunks: 2 };
const check = (w, vf, recipe, result, extra = {}, seq = 'Main') => w.weave({ cell: 'EVA·Pattern', kind: 'vfile-check', addr: `vfile-check:p1:${seq}:${recipe.slice(0, 16)}`, of: [vf.id], body: { project: 'p1', sequence: seq, recipe, result, expected: {}, ...extra } });
const retract = (w, e) => w.weave({ cell: 'NUL·Figure', kind: 'retract', addr: `retract:${e.id.slice(0, 12)}`, of: [e.id], body: { why: 'recipe changed' } });
const writer = (dir, name = 'proteus') => openLog({ dir, writer: name, store: 'lazy' });

test('an empty pharos has no virtual files', async () => {
  const dir = fresh(); await writer(dir);
  const r = await vfiles(dir); assert.deepEqual(r.files, []); assert.equal(r.tally.files, 0);
});

test('a recipe woven without a build is listed as unbuilt and unchecked, with what it cites and the writer', async () => {
  const dir = fresh(), w = await writer(dir), pl = w.weave({ cell: 'INS·Figure', kind: 'placement', addr: 'clip:p1:c1', body: { project: 'p1', sequence: 'Main' } });
  vfile(w, R1, {}, [pl.id]);
  const r = await vfiles(dir), f = r.files[0];
  assert.equal(f.addr, 'vfile:p1:Main'); assert.equal(f.built, false); assert.equal(f.size, null); assert.equal(f.inputs, 2); assert.deepEqual(f.cites, [pl.id]); assert.equal(f.made_by, 'proteus'); assert.equal(f.projector, 'vfold@v2');
  assert.equal(f.check, null); assert.equal(r.tally.unbuilt, 1); assert.equal(r.tally.unchecked, 1);
});

test('a built, checked file reports its check; a check of an OLDER recipe is stale and says nothing about the current one', async () => {
  const dir = fresh(), w = await writer(dir), v1 = vfile(w, R1, built); check(w, v1, R1, 'identical');
  let r = await vfiles(dir); assert.equal(r.files[0].built, true); assert.equal(r.files[0].check.result, 'identical'); assert.equal(r.tally.identical, 1); assert.equal(r.files[0].stale_check, null);
  retract(w, v1); const v2 = vfile(w, R2, built);                              // the timeline moved: new recipe, old retracted
  r = await vfiles(dir); const f = r.files[0];
  assert.equal(r.files.length, 1, 'one live file at the address'); assert.equal(f.id, v2.id); assert.equal(f.recipe, R2);
  assert.equal(f.check, null, 'no check of the current recipe'); assert.equal(f.stale_check.result, 'identical'); assert.equal(f.stale_check.of_recipe, R1); assert.equal(r.tally.unchecked, 1);
});

test('problems are surfaced, not hidden: differs, unavailable (with the missing content ids), recipe_mismatch', async () => {
  const dir = fresh(), w = await writer(dir);
  const a = vfile(w, R1, built, [], 'A'), b = vfile(w, R1, built, [], 'B'), c = vfile(w, R1, built, [], 'C');
  check(w, a, R1, 'differs', {}, 'A'); check(w, b, R1, 'unavailable', { missing: ['ess_b'] }, 'B'); check(w, c, R1, 'recipe_mismatch', {}, 'C');
  const r = await vfiles(dir), by = Object.fromEntries(r.files.map((f) => [f.sequence, f]));
  assert.equal(by.A.check.result, 'differs'); assert.deepEqual(by.B.check.missing, ['ess_b']); assert.equal(by.C.check.result, 'recipe_mismatch');
  assert.deepEqual([r.tally.differs, r.tally.unavailable, r.tally.recipe_mismatch], [1, 1, 1]);
});

test('two writers with different live recipes at one address are reported as contested, and the newest is shown', async () => {
  const dir = fresh(), w1 = await writer(dir, 'proteus'), w2 = await writer(dir, 'other-holon');
  vfile(w1, R1, built); await new Promise((ok) => setTimeout(ok, 5)); const v2 = vfile(w2, R2, built);
  const r = await vfiles(dir); assert.equal(r.files.length, 1); assert.equal(r.files[0].contested, true); assert.equal(r.files[0].id, v2.id); assert.equal(r.tally.contested, 1);
});

test('this reader imports nothing from any other repo: only the facade and node', () => {
  const src = fs.readFileSync(path.join(here, 'vfiles.mjs'), 'utf8');
  assert.deepEqual([...src.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]), ['./db.mjs']);
  assert.ok(!/slate|ffmpeg|vfold/i.test(src.split('\n').filter((l) => !l.startsWith('//')).join('\n')), 'no code names the writer');
});
