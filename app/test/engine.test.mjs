// The ported engine: the page's database over real pharos entries. The page's own fold() (copied verbatim) is the oracle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSpace, OPS, sha } from '../engine.mjs';
import * as B from '../vendor/pharos/browser-store.mjs';
import * as core from '../vendor/pharos/core.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cells = JSON.parse(fs.readFileSync(path.join(here, '..', 'vendor', 'pharos', 'cells.json'), 'utf8'));
const oracleSrc = fs.readFileSync(path.join(here, 'oracle-fold.js'), 'utf8');
const oracle = (LOG) => new Function('LOG', `${oracleSrc}; return fold;`)(LOG);
const mk = () => ({ backend: B.memoryBackend(), blobBackend: B.memoryBackend() });
const opened = [];
const open = async (b, tab = 't1') => { const sp = await openSpace({ name: 'eodb', ...b, cells, tab }); opened.push(sp); return sp; };
test.after(() => { for (const sp of opened) sp.close(); }); // a failing assertion must not leave a channel open and hang the run
const strip = (S) => JSON.parse(JSON.stringify(S, (k, v) => (k === 'eid' || k === 'ts' ? undefined : v)));

// a representative history through every operation the page uses (written as the page's seed and UI actions do)
const SCRIPT = [
  ['ws+', { id: 'w1', name: 'Demo database' }], ['tb+', { id: 't1', ws: 'w1', name: 'Contracts', std: 'OCDS' }],
  ['fld+', { tb: 't1', id: 'f1', n: 'Supplier name', t: 'text', m: 'ocds:awards.suppliers.name' }], ['fld+', { tb: 't1', id: 'f2', n: 'Award amount', t: 'currency' }],
  ['row+', { tb: 't1', id: 'r1', v: { f1: 'Acme', f2: 100 } }], ['rows+', { tb: 't1', src: { name: 'seed.csv' }, rows: [{ id: 'r2', v: { f1: 'CDW', f2: 86250 } }, { id: 'r3', v: { f1: 'Dell', f2: 5 } }] }],
  ['cell=', { tb: 't1', rid: 'r1', fid: 'f2', v: 250 }], ['cell=', { tb: 't1', rid: 'r1', fid: 'f2', v: 300 }], ['fld=', { tb: 't1', id: 'f1', set: { n: 'Supplier' } }],
  ['file+', { ws: 'w1', hash: 'abc', name: 'contract.pdf', size: 12, type: 'application/pdf', at: 'Today' }], ['read', { hash: 'abc', tier: 'lite', facts: { pages: 2 } }],
  ['map', { src: 'abc', col: 'Supplier', status: 'confirmed', term: 'ocds:awards.suppliers.name', by: 'You' }], ['map', { src: 'abc', col: 'Supplier', status: 'local', term: 'supplier', by: 'You' }],
  ['doc+', { id: 'd1', ws: 'w1', title: 'Notes', kind: 'note' }], ['blk+', { doc: 'd1', id: 'b1', t: 'p', x: 'first' }], ['blk+', { doc: 'd1', id: 'b2', t: 'p', x: 'second', after: 'b1' }],
  ['blk=', { doc: 'd1', id: 'b1', x: 'first, edited' }], ['doc=', { id: 'd1', title: 'Field notes' }], ['cmt+', { doc: 'd1', id: 'c1', x: 'check this' }], ['cmt=', { doc: 'd1', id: 'c1', resolved: true }],
  ['share+', { doc: 'd1', who: 'Sam', role: 'edit' }], ['voice+', { doc: 'd1', hash: 'vv', secs: 3, mime: 'audio/webm' }],
];
function build(space) { const out = []; for (const [op, body] of SCRIPT) out.push(space.append(op, body)); return out; }
// the reference LOG: what the original page's appendQ would have produced for the same operations
function reference() { const log = []; SCRIPT.forEach(([op, body], i) => log.push({ id: `ref${i}`, writer: 'w', seq: i + 1, ts: 0, op, body })); return log; }

test('1. every operation the page uses maps to a declared pharos kind and cell, and each cell is a real cell', () => {
  const ids = new Set(cells.cells.map((c) => c.id));
  for (const [op, [kind, cell]] of Object.entries(OPS)) { assert.ok(kind && ids.has(cell), `${op} -> ${kind} ${cell}`); }
  assert.equal(new Set(Object.values(OPS).map((v) => v[0])).size, Object.keys(OPS).length, 'kinds are unique, so the view can map back');
  const cellOf = (op) => OPS[op][1]; // the meaning of each class of operation
  for (const op of ['ws+', 'tb+', 'fld+', 'row+', 'rows+', 'file+', 'doc+', 'cmt+', 'share+', 'blk+', 'voice+']) assert.equal(cellOf(op), 'INS·Figure', `${op} creates`);
  for (const op of ['cell=', 'fld=', 'doc=', 'blk=', 'cmt=']) assert.equal(cellOf(op), 'DEF·Figure', `${op} sets a value, so concurrent sets are held as conflicts`);
  assert.equal(cellOf('retract'), 'NUL·Figure'); assert.equal(cellOf('read'), 'EVA·Figure'); assert.equal(cellOf('map'), 'CON·Figure');
});

test('2. the ported log folded by the page\'s own fold() equals the original\'s state, at every point in time (time travel)', async () => {
  const space = await open(mk()); build(space);
  // retractions, including of a paragraph (the page keeps those as dead blocks) and of a row
  const view1 = space.view(); const blk = view1.find((e) => e.op === 'blk+' && e.body.id === 'b2'), row = view1.find((e) => e.op === 'row+');
  space.append('retract', { of: blk.id }); space.append('retract', { of: row.id });
  const ported = space.view(), ref = reference();
  ref.push({ id: 'refR1', writer: 'w', seq: ref.length + 1, ts: 0, op: 'retract', body: { of: ref.find((e) => e.op === 'blk+' && e.body.id === 'b2').id } });
  ref.push({ id: 'refR2', writer: 'w', seq: ref.length + 1, ts: 0, op: 'retract', body: { of: ref.find((e) => e.op === 'row+').id } });
  assert.equal(ported.length, ref.length);
  for (let upto = 0; upto <= ref.length; upto++) assert.deepEqual(strip(oracle(ported)(upto)), strip(oracle(ref)(upto)), `state differs at entry ${upto}`);
  space.close();
});

test('3. the view has the shape the page reads: id, writer, seq, ts, op, body; retract keeps body.of; infrastructure entries are hidden', async () => {
  const space = await open(mk()); const [first] = build(space); await space.settle();
  const v = space.view(); assert.equal(v.length, SCRIPT.length);
  assert.deepEqual(Object.keys(v[0]).sort(), ['body', 'id', 'ok', 'op', 'seq', 'sig', 'ts', 'writer']);
  assert.equal(first.op, 'ws+'); assert.equal(v[0].seq, 1); assert.ok(Number.isFinite(v[0].ts));
  assert.ok(v.every((e) => !['frame', 'kind', 'signature', 'capability'].includes(e.op)));
  const r = space.append('retract', { of: v[0].id }); assert.equal(r.body.of, v[0].id);
  space.close();
});

test('4. reload: everything comes back from the encrypted store, the same identity, files included', async () => {
  const b = mk(); let space = await open(b); build(space);
  const bytes = new TextEncoder().encode('hello,world\n1,2'), h = sha(bytes); space.blobs.put(h, bytes, 'text/csv');
  await space.settle(); const before = JSON.stringify(space.view().map((e) => [e.id, e.op, e.body])), pub = space.devicePub, root = space.rootPub; space.close();
  space = await open(b, 't2');
  assert.equal(JSON.stringify(space.view().map((e) => [e.id, e.op, e.body])), before); assert.equal(space.devicePub, pub); assert.equal(space.rootPub, root);
  assert.equal(new TextDecoder().decode(space.blobs.get(h).bytes), 'hello,world\n1,2'); assert.equal(space.blobs.get(h).type, 'text/csv');
  assert.ok(space.view().every((e) => e.ok), 'every entry still verifies after the reload');
  space.close();
});

test('5. signed by a real key: entries are not ok until signed, then every one verifies; the signature covers them', async () => {
  const space = await open(mk()); build(space);
  space._handle && core.weave(space._handle, { cell: 'INS·Figure', kind: 'ws', addr: 'ws:raw', body: { id: 'raw', name: 'raw' } });
  assert.ok(space.view().some((e) => !e.ok), 'just written: not signed yet');
  assert.ok(space.report().unsigned > 0);
  await space.settle(); assert.ok(space.view().every((e) => e.ok)); assert.equal(space.report().unsigned, 0);
  assert.ok(space.view().every((e) => /^[0-9a-f]{128}$/.test(e.sig)), 'a real Ed25519 signature is attached to each');
  space.close();
});

test('6. encrypted at rest: no op name, text, file content, column name or writer id is readable in what is persisted', async () => {
  const b = mk(); const space = await open(b); build(space);
  const secret = new TextEncoder().encode('TOP-SECRET-CONTRACT-TEXT'); space.blobs.put(sha(secret), secret, 'text/plain'); await space.settle();
  const dump = (be) => { const parts = []; for (const s of be.streamsSync()) for (const c of be.chunksSync(s)) parts.push(Buffer.from(c.record.ct)); return Buffer.concat(parts).toString('latin1') + JSON.stringify(be.metaSync(), (k, v) => (v instanceof Uint8Array ? Buffer.from(v).toString('latin1') : v)); };
  const all = dump(b.backend) + dump(b.blobBackend);
  try { for (const needle of ['TOP-SECRET', 'Supplier name', 'Demo', 'check this', 'cell-set', space.writer, 'text/plain', 'PHR1', 'application/pdf']) assert.ok(!all.includes(needle), `"${needle}" must not be readable`); } finally { space.close(); }
});

test('7. two tabs editing the same cell at once: both edits are kept, and the conflict is REPORTED, not silently resolved', async () => {
  const b = mk(); const a = await open(b, 'a'); a.append('ws+', { id: 'w1', name: 'W' }); a.append('tb+', { id: 't1', ws: 'w1', name: 'T' }); a.append('fld+', { tb: 't1', id: 'f1', n: 'N', t: 'text' }); a.append('row+', { tb: 't1', id: 'r1', v: {} });
  await a.settle(); const c = await open(b, 'b'); await c._store.refresh();
  a.append('cell=', { tb: 't1', rid: 'r1', fid: 'f1', v: 'from A' }); c.append('cell=', { tb: 't1', rid: 'r1', fid: 'f1', v: 'from B' });
  await a.settle(); await c.settle(); await a._store.refresh(); await c._store.refresh();
  const conflicts = core.fold(a._handle).conflicts.filter((x) => x.addr === 'cell:t1:r1:f1'); assert.equal(conflicts.length, 1, 'held as a conflict');
  assert.equal(a.view().filter((e) => e.op === 'cell=').length, 2, 'both edits are in the log');
  assert.deepEqual(a.view().map((e) => e.id), c.view().map((e) => e.id), 'and both tabs see the same log in the same order');
  a.close(); c.close();
});

test('8. files: put is content-addressed (a repeat is a no-op), survives reload, and the hash is real SHA-256 (no weak fallback)', async () => {
  const b = mk(); let space = await open(b); const bytes = new Uint8Array([1, 2, 3]), h = sha(bytes);
  assert.equal(sha(new TextEncoder().encode('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(space.blobs.put(h, bytes, 'application/x-test'), true); assert.equal(space.blobs.put(h, bytes, 'application/x-test'), false);
  await space.settle(); space.close(); space = await open(b, 'x'); assert.deepEqual([...space.blobs.get(h).bytes], [1, 2, 3]); assert.equal(space.blobs.all().length, 1); space.close();
});

test('9. an unknown operation is refused, and a failed save is visible (never silent)', async () => {
  const b = mk(); const space = await open(b); assert.throws(() => space.append('nope', {}), /unknown operation/);
  await space.settle(); b.backend.failNextPut(new Error('quota exceeded'), 100); space.append('ws+', { id: 'w9', name: 'x' });
  await assert.rejects(space.settle(), /quota exceeded/); assert.ok(space.report().unpersisted > 0); assert.match(space.report().lastError, /quota exceeded/);
  b.backend.failNextPut(null, 0); await space.settle(); assert.equal(space.report().unpersisted, 0); space.close();
});

test('10. a failure saving FILES is as visible as one saving the log', async () => {
  const b = mk(); const space = await open(b); await space.settle();
  b.blobBackend.failNextPut(new Error('blob store full'), 100); const bytes = new Uint8Array([9, 9, 9]); space.blobs.put(sha(bytes), bytes, 'x/y');
  await assert.rejects(space.settle(), /blob store full/); assert.ok(space.report().unpersisted > 0);
  b.blobBackend.failNextPut(null, 0); await space.settle(); assert.equal(space.report().unpersisted, 0);
});
