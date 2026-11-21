// Three headless nodes exchanging data: durable filesystem stores (fs-backend), one founder + two joiners, syncing over a relay.
// Proves the data path works with no browser, persists across restart, and that every node sees the others' writes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSpace } from '../engine.mjs';
import { fsBackend } from '../fs-backend.mjs';
import { startRelay } from '../relay.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cells = JSON.parse(fs.readFileSync(path.join(here, '..', 'vendor', 'pharos', 'cells.json'), 'utf8'));

let tmp = null; const relays = [];
test.after(async () => { for (const r of relays) await r.close(); if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); });

test('three headless nodes exchange data over a relay, and it survives a restart', async () => {
  const r = await startRelay({ port: 0 }); relays.push(r);
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eodb-headless-'));
  const node = (id) => ({ backend: fsBackend(path.join(tmp, id, 'store')), blobBackend: fsBackend(path.join(tmp, id, 'blobs')) });
  const pass = 'test-passphrase';
  const opts = (id, extra = {}) => openSpace({ name: 'eodb', ...node(id), cells, passphrase: pass, iterations: 1000, autosync: false, ...extra });

  // founder
  const A = await opts('a');
  A.append('ws+', { id: 'w1', name: 'shared work' });
  const link = await A.share({ routes: [`relay:${r.url}`] }); await A.settle();

  // two joiners
  const B = await opts('b', { join: link });
  const C = await opts('c', { join: link });

  // exchange: B writes, everyone syncs
  B.append('ws+', { id: 'w2', name: 'from B' });
  C.append('ws+', { id: 'w3', name: 'from C' });
  await B.syncOnce(); await C.syncOnce(); await A.syncOnce(); await B.syncOnce(); await C.syncOnce();

  for (const n of [A, B, C]) {
    const names = n.view().filter((e) => e.op === 'ws+').map((e) => e.body.name);
    for (const want of ['shared work', 'from B', 'from C']) assert.ok(names.includes(want), `${want} reached every node`);
    assert.equal(n.peers().length, 3, 'three devices in the space');
  }

  // durability: the founder restarts from the same directory and still holds everything
  A.close();
  const A2 = await opts('a');
  const names = A2.view().filter((e) => e.op === 'ws+').map((e) => e.body.name);
  for (const want of ['shared work', 'from B', 'from C']) assert.ok(names.includes(want), `${want} survives the restart`);
  assert.equal(A2.role, 'founder', 'the restarted node remembers it founded the space');

  for (const n of [A2, B, C]) n.close();
});
