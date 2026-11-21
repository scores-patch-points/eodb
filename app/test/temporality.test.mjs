// Temporality is causal, not a clock: every claim carries the lightcone (seen) of what its device had observed, concurrent
// double-claims surface as a conflict on the shared address, and runs are causally linked to the claim they fulfil.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSpace } from '../engine.mjs';
import { startRelay } from '../relay.mjs';
import { tick, workerPass, dueTriggers, activeClaims } from '../worker.mjs';
import * as B from '../vendor/pharos/browser-store.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cells = JSON.parse(fs.readFileSync(path.join(here, '..', 'vendor', 'pharos', 'cells.json'), 'utf8'));
const mk = () => ({ backend: B.memoryBackend(), blobBackend: B.memoryBackend() });
const opened = [], relays = [];
const open = async (b, extra = {}) => { const sp = await openSpace({ name: 'eodb', ...b, cells, autosync: false, ...extra }); opened.push(sp); return sp; };
const relay = async () => { const r = await startRelay({ port: 0 }); relays.push(r); return r; };
test.after(async () => { for (const sp of opened) sp.close(); for (const r of relays) await r.close(); });

const GRAPH = { name: 't', nodes: [{ id: 'n1', type: 'text', fields: { text: 'hi' } }], edges: [] };

test('a claim records its lightcone; concurrent claims are a reported conflict with a deterministic order', async () => {
  const r = await relay();
  const A = await open(mk());
  A.append('auto+', GRAPH);
  A.registerTrigger({ id: 'tr1', auto: 't', type: 'poll', intervalMs: 60_000 });
  const link = await A.share({ routes: [`relay:${r.url}`] }); await A.settle(); await A.syncOnce();
  const G = await open(mk(), { join: link });

  // both devices act before either has seen the other's claim
  await tick(A, {});
  await tick(G, {});
  await A.syncOnce(); await G.syncOnce(); await A.syncOnce(); await G.syncOnce();

  const claims = A.automationLog().filter((e) => e.op === 'auto-claim+' && e.body.trigger === 'tr1');
  assert.equal(claims.length, 2, 'both devices claimed the same trigger');
  const [c1, c2] = claims;
  assert.ok(!c1.seen.includes(c2.id), 'the first claim did not see the second when it acted');
  assert.ok(!c2.seen.includes(c1.id), 'the second claim did not see the first when it acted');
  assert.ok(c1.seen.length > 0 && c2.seen.length > 0, 'each claim records a non-empty lightcone');
  assert.notDeepEqual(c1.seen, c2.seen, 'their lightcones differ — each believed a different world');

  const runs = A.automationLog().filter((e) => e.op === 'auto-run+' && e.body.triggerId === 'tr1');
  assert.equal(runs.length, 2);
  for (const run of runs) assert.equal(run.of.length, 1, 'each run causally references its claim');
  assert.equal(new Set(runs.map((r) => r.of[0])).size, 2, 'the two runs fulfil the two different claims');

  const conflicts = A.conflicts().filter((c) => c.addr === 'auto-claim:tr1');
  assert.ok(conflicts.length >= 1, 'the concurrent double-claim surfaces as a conflict on the shared address');
  assert.ok(conflicts.every((c) => c.a < c.b), 'the conflict orders its sides deterministically (by id)');

  // no third run: both claims are now satisfied by their runs, and the trigger is not due
  assert.equal(dueTriggers(A, Date.now()).length, 0);
  assert.equal(activeClaims(A).size, 0, 'no unsatisfied claim remains');
  assert.equal((await workerPass(A, {})).poll.length, 0);
});

test('a later claim that saw an earlier one supersedes it — no conflict, one winner', async () => {
  const sp = await open(mk());
  sp.append('auto+', GRAPH);
  sp.registerTrigger({ id: 'tr2', auto: 't', type: 'poll', intervalMs: 60_000 });
  // first device claims and runs
  await tick(sp, {});
  // a second device, having seen the first claim, claims the same trigger (causally later)
  const seen = sp.view().filter((e) => e.op === 'auto-claim+').map((e) => e.id);
  sp.append('auto-claim+', { trigger: 'tr2', worker: 'later.device', at: Date.now() }, seen);
  // the later claim supersedes the earlier (it is in its ancestry), so there is no conflict
  assert.ok(!sp.conflicts().some((c) => c.addr === 'auto-claim:tr2'), 'a causally-later claim is not a conflict');
  sp.close();
});
