// Coordination across devices that share a pharos: a guest device acts on the founder's trigger, claims coordinate, and both
// logs converge — with no orchestrator, only the shared log.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSpace } from '../engine.mjs';
import { startRelay } from '../relay.mjs';
import { workerPass, dueTriggers, unhandledEvents } from '../worker.mjs';
import * as B from '../vendor/pharos/browser-store.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cells = JSON.parse(fs.readFileSync(path.join(here, '..', 'vendor', 'pharos', 'cells.json'), 'utf8'));
const mk = () => ({ backend: B.memoryBackend(), blobBackend: B.memoryBackend() });
const opened = [], relays = [];
const open = async (b, extra = {}) => { const sp = await openSpace({ name: 'eodb', ...b, cells, autosync: false, ...extra }); opened.push(sp); return sp; };
const relay = async () => { const r = await startRelay({ port: 0 }); relays.push(r); return r; };
test.after(async () => { for (const sp of opened) sp.close(); for (const r of relays) await r.close(); });

const GRAPH = { name: 'ingest-poll', nodes: [
  { id: 't', type: 'text', fields: { text: '[{"vendor":"A"},{"vendor":"B"}]' } },
  { id: 'j', type: 'json', fields: {} },
  { id: 'x', type: 'transform', fields: { op: 'flatten' } },
  { id: 's', type: 'store', fields: { name: 'Poll results', ws: 'w1' } },
], edges: [
  { from: 't', fromPort: 'text', to: 'j', toPort: 'text' },
  { from: 'j', fromPort: 'data', to: 'x', toPort: 'data' },
  { from: 'x', fromPort: 'rows', to: 's', toPort: 'rows' },
] };

test('a guest device runs the founder\'s due trigger and both logs converge, audited', async () => {
  const r = await relay();
  const A = await open(mk());
  A.append('auto+', GRAPH);
  A.registerTrigger({ id: 'tr1', auto: 'ingest-poll', type: 'poll', intervalMs: 60_000 });
  const link = await A.share({ routes: [`relay:${r.url}`] }); await A.settle(); await A.syncOnce();
  const G = await open(mk(), { join: link });

  // the guest (a separate device) acts: it has no scheduler, only the shared log it just synced
  const res = await workerPass(G, {});
  assert.equal(res.poll.length, 1, 'the guest found and ran the founder\'s due trigger');
  assert.equal(res.poll[0].trigger, 'tr1');

  // the founder converges on what the guest did
  await A.syncOnce();
  const run = A.automationLog().find((e) => e.op === 'auto-run+' && e.body.triggerId === 'tr1');
  assert.ok(run, 'the founder sees the guest\'s run');
  assert.ok(A.automationLog().some((e) => e.op === 'auto-claim+' && e.body.worker.startsWith('guest.')), 'the claim names the guest writer');
  assert.ok(A.automationLog().some((e) => e.op === 'auto-node+' && e.body.node === '$done' && e.body.ok), 'node results reached the founder too');
  const rows = A.sql('SELECT vendor FROM "Poll results" ORDER BY vendor');
  assert.deepEqual(rows.rows.map((x) => x.vendor), ['A', 'B'], 'the ingested rows synced back to the founder');

  // neither device runs it a second time: due-ness is derived from the (now shared) run history + live claim
  assert.equal(dueTriggers(A, Date.now()).length, 0);
  assert.equal((await workerPass(A, {})).poll.length, 0);
  assert.equal((await workerPass(G, {})).poll.length, 0);
});

test('a webhook event received by one device is handled once, and the other device sees it as handled', async () => {
  const r = await relay();
  const A = await open(mk());
  A.append('auto+', { name: 'orders-in', nodes: [
    { id: 'w', type: 'webhook', fields: {} },
    { id: 'x', type: 'transform', fields: { op: 'flatten' } },
    { id: 's', type: 'store', fields: { name: 'Orders', ws: 'w1' } },
  ], edges: [
    { from: 'w', fromPort: 'data', to: 'x', toPort: 'data' },
    { from: 'x', fromPort: 'rows', to: 's', toPort: 'rows' },
  ] });
  A.registerTrigger({ id: 'wh1', auto: 'orders-in', type: 'webhook', path: 'orders' });
  const link = await A.share({ routes: [`relay:${r.url}`] }); await A.settle(); await A.syncOnce();
  const G = await open(mk(), { join: link });

  // the event arrives at the GUEST device (e.g. the guest runs the intake server)
  G.append('auto-event+', { path: 'orders', body: { rows: [{ vendor: 'Zed' }] }, headers: {}, ts: Date.now() });
  const res = await workerPass(G, {});
  assert.equal(res.events.length, 1, 'the guest processed the unhandled event');
  assert.equal(res.events[0].trigger, 'wh1');

  await A.syncOnce();
  assert.deepEqual(A.sql('SELECT vendor FROM Orders').rows.map((x) => x.vendor), ['Zed'], 'the founder sees the ingested order');
  assert.equal(unhandledEvents(A).length, 0, 'the event is marked handled on both devices (run references its id)');
  assert.equal((await workerPass(A, {})).events.length, 0, 'no device re-runs the same event');
});
