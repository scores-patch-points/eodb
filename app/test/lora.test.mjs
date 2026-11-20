// Connect through a constrained, shared radio link (LoRa-class). Two properties:
//   1. it works: a gateway that only carries ~220-byte frames still syncs a whole space (chunking),
//   2. it is a good neighbor: every exchange is paced to a duty cycle and backed off politely, never bursty.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSpace } from '../engine.mjs';
import { startRelay } from '../relay.mjs';
import { politeCarrier } from '../net.mjs';
import * as B from '../vendor/pharos/browser-store.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cells = JSON.parse(fs.readFileSync(path.join(here, '..', 'vendor', 'pharos', 'cells.json'), 'utf8'));
const mk = () => ({ backend: B.memoryBackend(), blobBackend: B.memoryBackend() });
const opened = [], relays = [];
const open = async (b, extra = {}) => { const sp = await openSpace({ name: 'eodb', ...b, cells, autosync: false, ...extra }); opened.push(sp); return sp; };
test.after(async () => { for (const sp of opened) sp.close(); for (const r of relays) await r.close(); });

const BASE = [
  ['ws+', { id: 'w1', name: 'Field station' }],
  ['tb+', { id: 't1', ws: 'w1', name: 'Readings' }],
  ['fld+', { tb: 't1', id: 'f1', n: 'Temp', t: 'number' }],
  ['row+', { tb: 't1', id: 'r1', v: { f1: 21 } }],
];
const tempOf = (sp) => { const e = sp.view().filter((x) => x.op === 'cell=').at(-1); return e && e.body.v; };

test('1. a space shares and joins across a gateway that only carries ~220-byte frames', async () => {
  // LoRa-class relay: any PUT larger than 220 bytes is refused, so whole segments must be chunked into frames.
  const r = await startRelay({ port: 0, maxBytes: 220 }); relays.push(r);
  const A = await open(mk());
  for (const [op, body] of BASE) A.append(op, body);
  // duty=0: this is a private test link, so pacing is off; the point here is that tiny frames carry the space.
  const link = await A.share({ routes: [`lora:${r.url}?mtu=200&duty=0`] });
  await A.settle();
  const names = [...r.store.keys()];
  assert.ok(names.some((n) => n.endsWith('/manifest')), 'objects arrived as chunk manifests');
  assert.ok(names.every((n) => r.store.get(n).length <= 220), 'every stored frame fits the tiny MTU');

  const G = await open(mk(), { join: link });
  assert.equal(G.role, 'guest');
  assert.deepEqual(G.view().map((e) => e.op), BASE.map((b) => b[0]), 'the guest sees every entry the founder wrote');

  A.append('cell=', { tb: 't1', rid: 'r1', fid: 'f1', v: 23 });
  await A.syncOnce(); await G.syncOnce();
  assert.equal(tempOf(G), 23);
  assert.ok(A.view().every((e) => e.ok) && G.view().every((e) => e.ok), 'everything still verifies');
});

test('2. good neighbor: exchanges are paced to the duty cycle, never sent in a burst', async () => {
  const clock = { t: 0 }, slept = [];
  const now = () => clock.t;
  const sleep = (ms) => { slept.push(ms); clock.t += ms; return Promise.resolve(); };
  const sent = [];
  const inner = { async list() { return []; }, async get() { return null; }, async putNew(n, b) { sent.push({ n, len: b.length, at: clock.t }); } };
  const airtime = (bytes) => 40 + bytes * 0.8;
  const duty = 0.01;
  const pc = politeCarrier(inner, { dutyCycle: duty, airtime, burst: 1, maxRetries: 0, rng: () => 0, now, sleep });

  for (let i = 0; i < 5; i++) await pc.putNew('seg' + i, new Uint8Array(100));   // 120 ms each on air
  const onAir = 5 * airtime(100);
  assert.ok(slept.length > 0, 'it waited between frames');
  assert.ok(onAir <= duty * clock.t + airtime(0) + 1e-6, `airtime ${onAir}ms fits the budget over ${clock.t}ms at ${duty * 100}%`);
  // frames are spread out in time, not stacked at t=0
  for (let i = 1; i < sent.length; i++) assert.ok(sent[i].at - sent[i - 1].at >= airtime(100) / duty - 1, 'a full pacing gap between frames');
});

test('3. politeCarrier is a no-op when the link is not shared (duty 0 stays fast)', () => {
  const inner = { list: () => [], get: () => null, putNew: () => {} };
  assert.equal(politeCarrier(inner, { dutyCycle: 0 }), inner);
});

test('4. an unknown route scheme is ignored; a known one still carries the space (transports are data)', async () => {
  const r = await startRelay({ port: 0, maxBytes: 220 }); relays.push(r);
  const A = await open(mk()); for (const [op, body] of BASE) A.append(op, body);
  const link = await A.share({ routes: [`pigeon:${r.url}`, `lora:${r.url}?mtu=200&duty=0`] });
  await A.settle();
  const G = await open(mk(), { join: link });
  assert.equal(G.role, 'guest');
  assert.equal(G.view().length, BASE.length);
});
