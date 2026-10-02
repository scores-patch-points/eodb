// Falsification: store mechanics.
//
// Claims under test:
//   1. A room's OPFS file is decrypted AT MOST ONCE per open. Before this
//      change, open() scanned the file (1 decrypt) and then getAll() re-read
//      + re-decrypted the whole file (2nd decrypt) — the dominant cold-start
//      cost for a 1M-event room. This test fails on the old code.
//   2. Checkpoints round-trip: what saveCheckpoint writes, loadCheckpoint
//      returns — including the entitiesByType index (rebuilt if missing).
//   3. The checkpoint interval adapts as the log grows.

import { loadShim, makeLog, makeFakeOPFS, installFakeStorage } from './helpers.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

await loadShim();
const { EventStore } = await import('../src/store.js');
const { vault } = await import('../src/vault.js');
const { fold } = await import('../src/fold.js');

const NS = 'io.matrix-events';

function storeEvents() {
  const ts = 4000;
  return makeLog().map((e, i) => ({
    type: e.type,
    content: e.content,
    origin_server_ts: e.origin_server_ts,
    sender: e.sender,
    event_id: `$room_${i.toString().padStart(4, '0')}`,
  }));
}

async function unlockedStore(dir) {
  await vault.initialize('@u:test', 'correct horse battery staple');
  const store = new EventStore('!room:test', NS);
  await store.open();
  return store;
}

test('store: OPFS file is decrypted at most once per open (no double decrypt)', async () => {
  const { files, dir } = makeFakeOPFS();
  installFakeStorage(dir);
  const events = storeEvents();

  // First session: append + checkpoint.
  {
    const store = await unlockedStore(dir);
    await store.append(events);
    assert.equal(store.getCount(), events.length, 'append count mismatch');
    await store.saveCheckpoint(fold(events));
  }
  const fileName = `room_${fnv1a32('!room:test').toString(16).padStart(8, '0')}.bin`;
  const readsBefore = dir.readCount(fileName);

  // Second session: cold open — scan decrypts once; getAll must serve from
  // the session cache instead of re-reading + re-decrypting the file.
  {
    const store = new EventStore('!room:test', NS);
    await store.open();
    const all = await store.getAll();
    assert.equal(all.length, events.length, 'getAll returned wrong count');
    assert.equal(dir.readCount(fileName), readsBefore + 1,
      'getAll re-read the OPFS file after open (double decrypt)');
    // getEventsSince must also come from the cache, not the file.
    const since = await store.getEventsSince(0);
    assert.ok(since.length > 0, 'getEventsSince returned nothing');
    assert.equal(dir.readCount(fileName), readsBefore + 1,
      'getEventsSince re-read the OPFS file after open (double decrypt)');
    // A second getAll is free.
    await store.getAll();
    assert.equal(dir.readCount(fileName), readsBefore + 1,
      'second getAll re-read the OPFS file');
  }
});

test('store: checkpoint round-trips with a usable state + type index', async () => {
  const { dir } = makeFakeOPFS();
  installFakeStorage(dir);
  const events = storeEvents();
  const state = fold(events);

  {
    const store = await unlockedStore(dir);
    await store.append(events);
    await store.saveCheckpoint(state);
  }
  {
    const store = new EventStore('!room:test', NS);
    await store.open();
    const cp = await store.loadCheckpoint();
    assert.ok(cp, 'loadCheckpoint returned nothing');
    assert.equal(cp.count, events.length, 'checkpoint count mismatch');
    assert.equal(cp.cursor, state.cursor, 'checkpoint cursor mismatch');
    assert.ok(cp.state.entitiesByType, 'checkpoint state lacks entitiesByType');
    assert.deepEqual(cp.state.entitiesByType.task, state.entitiesByType.task, 'index differs');
    // Cached: a second call must return the same object without re-decrypting.
    const cp2 = await store.loadCheckpoint();
    assert.equal(cp2, cp, 'loadCheckpoint did not cache');
  }
});

test('store: legacy checkpoint (no index) has its index rebuilt on load', async () => {
  const { files, dir } = makeFakeOPFS();
  installFakeStorage(dir);
  const events = storeEvents();
  const state = fold(events);
  delete state.entitiesByType; // what a pre-index checkpoint looks like

  {
    const store = await unlockedStore(dir);
    await store.append(events);
    await store.saveCheckpoint(state);
  }
  {
    const store = new EventStore('!room:test', NS);
    await store.open();
    const cp = await store.loadCheckpoint();
    assert.ok(cp.state.entitiesByType, 'entitiesByType not rebuilt on legacy checkpoint');
    const expectedTaskCount = Object.values(state.entities).filter(e => e._type === 'task').length;
    assert.equal(cp.state.entitiesByType.task.length, expectedTaskCount,
      'rebuilt index count mismatch on legacy checkpoint');
  }
});

test('store: checkpoint interval adapts to log size', async () => {
  const { dir } = makeFakeOPFS();
  installFakeStorage(dir);
  const store = await unlockedStore(dir);
  // Small room: the 200-append default.
  store._count = 0;
  store._appendsSinceCheckpoint = 199;
  assert.equal(store.shouldCheckpoint(), false);
  store._appendsSinceCheckpoint = 200;
  assert.equal(store.shouldCheckpoint(), true);
  // 40k-event room: interval must have grown (≤5000), not stayed at 200.
  store._count = 40000;
  store._appendsSinceCheckpoint = 1999;
  assert.equal(store.shouldCheckpoint(), false, 'interval did not grow with count');
  store._appendsSinceCheckpoint = 2000;
  assert.equal(store.shouldCheckpoint(), true);
});

function fnv1a32(str) {
  // Mirrors pack.js — same function store.js uses to name room files.
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}