// Leaving Matrix as the store: an eodb room's events imported into a pharos and rebuilt from it.
// The oracle is the repo's own fold.js: the WHOLE folded state (not a hash) must be identical after the round trip.
import { loadShim, makeLog, mkEvent } from './helpers.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

await loadShim();
const { fold, stateHash } = await import('../src/fold.js');
const { setNamespace, getNamespace } = await import('../src/operators.js');
const M = await import('../src/pharosMap.js');
const { Door, DoorError, loadLib } = await import('../tools/pharosDoor.mjs');
const { importRoom, exportRoom } = await import('../tools/pharosImport.mjs');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eodb-pharos-')); process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }));
const lib = await loadLib(); let n = 0;
const door = () => new Door({ dir: path.join(tmp, `room${++n}`), lib });
const plain = (x) => JSON.parse(JSON.stringify(x));
const DEFAULT = 'io.matrix-events';

test('round trip: the folded state of the room and of the pharos are identical, whole state, not a hash', () => {
  const log = makeLog(), d = door(), r = importRoom(d, log, { room: '!room:test' });
  assert.equal(r.events, log.length); assert.equal(r.mapped, log.length); assert.deepEqual(r.skipped, {}); assert.ok(r.woven >= log.length);
  const back = exportRoom(d);
  assert.equal(back.length, log.length);
  assert.deepEqual(plain(fold(back)), plain(fold(log)), 'every entity, partition, connection, frame, schema and violation');
  assert.equal(stateHash(fold(back)), stateHash(fold(log)));
});

test('the mapping covers every stored operator, and the log the repo tests with really exercises all of them', () => {
  const ops = new Set(makeLog().map((e) => M.opOf(e.type, DEFAULT)));
  assert.deepEqual([...ops].sort(), [...M.OPS].sort());
});

test('importing the same events again weaves nothing new, and the room still folds the same', () => {
  const log = makeLog(), d = door(); importRoom(d, log);
  const before = d.count(), again = importRoom(d, log);
  assert.equal(again.woven, 0); assert.equal(d.count(), before);
  assert.deepEqual(plain(fold(exportRoom(d))), plain(fold(log)));
});

test('incremental: importing a prefix and later the whole room gives the same pharos as importing the whole room once', () => {
  const log = makeLog(), once = door(), inc = door(); importRoom(once, log);
  importRoom(inc, log.slice(0, 10)); const r = importRoom(inc, log);
  assert.equal(inc.count(), once.count()); assert.equal(r.woven, log.length - 10);
  assert.deepEqual(plain(fold(exportRoom(inc))), plain(fold(log)));
});

test('each Matrix sender is its own pharos writer, and the sender, event id and timestamp survive', () => {
  const log = [
    mkEvent('io.matrix-events.ins', { anchor: 'task_a', entity_type: 'task', payload: {} }, 100, '@alice:hs.org'),
    mkEvent('io.matrix-events.def', { anchor: 'task_a', path: 'title', value: 'one' }, 200, '@bob:hs.org'),
    mkEvent('io.matrix-events.def', { anchor: 'task_a', path: 'title', value: 'two' }, 300, '@alice:hs.org'),
  ];
  const d = door(), r = importRoom(d, log);
  assert.deepEqual(r.writers, ['alice-hs.org', 'bob-hs.org']);
  const stems = fs.readdirSync(d.dir).map((f) => f.replace(/\.(phr|jsonl)$/, ''));   // the pharos core is binary (.phr) on main, JSONL before: either way, one file per writer
  assert.ok(stems.includes('alice-hs.org') && stems.includes('bob-hs.org'), 'one file per writer');
  const back = exportRoom(d); assert.deepEqual(back.map((e) => e.sender).sort(), ['@alice:hs.org', '@alice:hs.org', '@bob:hs.org']);
  assert.deepEqual(back.map((e) => e.event_id).sort(), log.map((e) => e.event_id).sort());
  assert.equal(fold(back).entities.task_a.title, 'two'); assert.equal(fold(back).entities.task_a._updatedBy, '@alice:hs.org');
  assert.deepEqual(plain(fold(back)), plain(fold(log)));
});

test('what is not data is counted and skipped, never guessed: undecryptable, another namespace, empty content', () => {
  const good = makeLog(), junk = [
    mkEvent('m.room.encrypted', { algorithm: 'm.megolm.v1.aes-sha2', ciphertext: 'x' }, 5),
    mkEvent('com.other.app.ins', { anchor: 'x', entity_type: 'x', payload: {} }, 6),
    mkEvent('io.matrix-events.def', {}, 7),
    mkEvent('m.room.message', { body: 'hello' }, 8),
  ];
  const d = door(), r = importRoom(d, [...good, ...junk]);
  assert.equal(r.mapped, good.length); assert.deepEqual(r.skipped, { undecryptable: 1, 'not-eodb': 2, empty: 1 });
  const back = exportRoom(d); assert.equal(back.length, good.length);
  assert.deepEqual(plain(fold(back)), plain(fold(good)));
  assert.equal(fold([...good, ...junk])._undecryptable, 1, 'the one visible difference: the room counts an undecryptable event, the pharos does not hold it');
});

test('events without an id stay distinct: two identical id-less connections are two wefts, and re-import adds none', () => {
  const mk = () => ({ type: 'io.matrix-events.con', content: { source_anchor: 'a', target_anchor: 'b', relation_type: 'blocks' }, origin_server_ts: 50, sender: '@a:test' });
  const log = [mk(), mk()], d = door(), r = importRoom(d, log);
  assert.equal(r.mapped, 2); const back = exportRoom(d); assert.equal(back.length, 2);
  assert.equal(fold(log).connections.length, 2); assert.equal(fold(back).connections.length, 2);
  assert.equal(importRoom(d, log).woven, 0);
});

test('the mapping table: cell, kind, addr and basis per operator, the schema DEF at DEF·Ground, REC and everything else carry no link to what they answer, and fromWeft is the exact inverse', () => {
  const ns = DEFAULT, ev = (op, content) => mkEvent(`${ns}.${op}`, content, 1000, '@u:hs.org');
  const rows = [
    [ev('ins', { anchor: 'task_1', entity_type: 'task', payload: { t: 1 } }), 'INS·Figure', `${ns}.ins`, 'task_1'],
    [ev('def', { anchor: 'task_1', path: 'title', value: 'x' }), 'DEF·Figure', `${ns}.def`, 'task_1#title'],
    [ev('def', { anchor: null, path: '_schema.tables', value: ['task'] }), 'DEF·Ground', `${ns}.schema`, '_schema#_schema.tables'],
    [ev('seg', { anchor: 'task_1', partition: 'done' }), 'SEG·Figure', `${ns}.seg`, 'task_1'],
    [ev('con', { source_anchor: 'a', target_anchor: 'b', relation_type: 'blocks' }), 'CON·Figure', `${ns}.con`, 'a>blocks>b'],
    [ev('eva', { anchor: 'task_1', criterion: 'c', result: 'ok', note: '' }), 'EVA·Figure', `${ns}.eva`, 'task_1'],
    [ev('rec', { scope: 'project', before_frame: 'a', after_frame: 'b' }), 'REC·Figure', `${ns}.rec`, 'project'],
  ];
  for (const [e, cell, kind, addr] of rows) {
    const w = M.toWeft(e, { ns, room: '!r:hs.org' });
    assert.deepEqual([w.cell, w.kind, w.addr], [cell, kind, addr]);
    assert.deepEqual(w.basis, { matrix_event: e.event_id, origin_ts: 1000, sender: '@u:hs.org', room: '!r:hs.org' }); assert.equal(w.writer, 'u-hs.org');
    assert.deepEqual(w.body, e.content, 'the whole event content, untouched');
    assert.deepEqual(M.fromWeft(w, { ns }), { type: e.type, content: e.content, origin_server_ts: 1000, sender: '@u:hs.org', event_id: e.event_id }, 'the exact inverse');
  }
  const syn = ev('syn', { input_anchors: ['a', 'b'], output: { name: 'm' } }), w = M.toWeft(syn, { ns });
  assert.deepEqual([w.cell, w.kind, w.addr], ['SYN·Figure', `${ns}.syn`, `syn_${syn.event_id}`]);
  assert.ok(fold([syn]).entities[`syn_${syn.event_id}`], 'the addr is exactly the anchor the fold derives');
  const bare = { type: `${ns}.syn`, content: { input_anchors: [], output: {} }, origin_server_ts: 9, sender: '@u:hs.org' };
  assert.equal(M.toWeft(bare, { ns, n: 4 }).addr, 'syn_9_@u:hs.org'); assert.equal(M.toWeft(bare, { ns, n: 4 }).basis.n, 4, 'an id-less event records its position');
});

test('another namespace (an app that called setNamespace) round-trips too', () => {
  const was = getNamespace(); setNamespace('com.acme.tasks');
  try {
    const log = [mkEvent('com.acme.tasks.ins', { anchor: 'task_9', entity_type: 'task', payload: {} }, 10), mkEvent('com.acme.tasks.def', { anchor: 'task_9', path: 'title', value: 'z' }, 20)];
    const d = door(), r = importRoom(d, log, { ns: 'com.acme.tasks' }); assert.equal(r.mapped, 2);
    assert.equal(importRoom(d, makeLog(), { ns: 'com.acme.tasks' }).mapped, 0, 'the default namespace is not this app\'s data');
    const back = exportRoom(d, { ns: 'com.acme.tasks' }); assert.deepEqual(plain(fold(back)), plain(fold(log)));
    assert.equal(fold(back).entities.task_9.title, 'z');
  } finally { setNamespace(was); }
});

test('the pharos holds the room in the fold\'s own order, and the mapping\'s chronological() is the fold\'s: ts, then event id, then input order', () => {
  const log = makeLog(), d = door(); importRoom(d, [...log].reverse());
  const ts = d.entries().filter((e) => e.basis && 'origin_ts' in e.basis).map((e) => e.basis.origin_ts);
  assert.deepEqual(ts, [...ts].sort((a, b) => a - b), 'imported from a reversed list, the pharos still orders the room chronologically');
  const a = mkEvent('io.matrix-events.ins', { anchor: 'x', entity_type: 't', payload: {} }, 5), b = { ...a, event_id: '$a_first' }, c = { ...a, event_id: '$z_last' };
  assert.deepEqual(M.chronological([c, b]).map(M.idOf), ['$a_first', '$z_last'], 'same timestamp: by event id');
});

test('a kind already declared at a different cell is a typed refusal, not an overwrite', () => {
  const d = door(); fs.mkdirSync(d.dir, { recursive: true });
  const h = lib.P.open(d.name, { dir: d.dir, writer: 'someone-else' });
  lib.P.weave(h, { cell: 'DEF·Figure', kind: 'kind', addr: 'kind:io.matrix-events.ins', body: { name: 'io.matrix-events.ins', cell: 'DEF·Figure' }, basis: {} });
  assert.throws(() => importRoom(d, makeLog()), (e) => e instanceof DoorError && e.code === 'kind_conflict');
});

test('the mapping module is pure: it imports nothing', () => {
  const src = fs.readFileSync(new URL('../src/pharosMap.js', import.meta.url), 'utf8');
  assert.equal([...src.matchAll(/^import\s/gm)].length, 0);
});
