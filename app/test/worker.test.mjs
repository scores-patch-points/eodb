// worker.mjs: the stigmergic peer — due triggers emerge from the log, claims coordinate, runs are audited.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSpace } from '../engine.mjs';
import * as B from '../vendor/pharos/browser-store.mjs';
import { dueTriggers, tick, cronMatches } from '../worker.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cells = JSON.parse(fs.readFileSync(path.join(here, '..', 'vendor', 'pharos', 'cells.json'), 'utf8'));

const open = () => openSpace({ name: 'eodb', backend: B.memoryBackend(), blobBackend: B.memoryBackend(), cells, autosync: false });

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

test('cronMatches supports *, */n, fixed and ranges', () => {
  assert.equal(cronMatches('*/5 * * * *', new Date('2026-01-01T00:10:00')), true);
  assert.equal(cronMatches('*/5 * * * *', new Date('2026-01-01T00:12:00')), false);
  assert.equal(cronMatches('0 9 * * 1', new Date('2026-01-05T09:00:00')), true);   // a Monday at 09:00
  assert.equal(cronMatches('1-5 * * * *', new Date('2026-01-01T00:03:00')), true);
});

test('tick claims a due poll trigger, runs the automation, and records the full audit', async () => {
  const sp = await open();
  sp.append('auto+', GRAPH);
  sp.registerTrigger({ id: 'tr1', auto: 'ingest-poll', type: 'poll', intervalMs: 60_000 });

  assert.equal(dueTriggers(sp, Date.now()).length, 1);
  const res = await tick(sp, {});
  assert.equal(res.ran.length, 1);
  assert.equal(res.ran[0].trigger, 'tr1');

  const log = sp.automationLog();
  assert.ok(log.some((e) => e.op === 'auto-run+' && e.body.triggerId === 'tr1'));
  assert.ok(log.some((e) => e.op === 'auto-claim+' && e.body.trigger === 'tr1'));
  assert.ok(log.some((e) => e.op === 'auto-node+' && e.body.node === '$done' && e.body.ok === true));
  assert.ok(log.some((e) => e.op === 'auto-node+' && e.body.type === 'store'));

  // the run was recorded, so it is not due again immediately
  assert.equal(dueTriggers(sp, Date.now()).length, 0);
  // ...but it is due again after the interval has passed
  assert.equal(dueTriggers(sp, Date.now() + 60_000).length, 1);

  // the ingested rows are queryable from the same log
  const rows = sp.sql('SELECT vendor FROM "Poll results" ORDER BY vendor');
  assert.deepEqual(rows.rows.map((x) => x.vendor), ['A', 'B']);
  sp.close();
});

test('a schedule trigger without a cron (or a claimed trigger) is not acted on twice', async () => {
  const sp = await open();
  sp.append('auto+', GRAPH);
  sp.registerTrigger({ id: 'tr2', auto: 'ingest-poll', type: 'poll', intervalMs: 60_000 });
  // a live claim blocks it
  sp.append('auto-claim+', { trigger: 'tr2', worker: 'other', at: Date.now(), until: Date.now() + 60_000 });
  assert.equal(dueTriggers(sp, Date.now()).length, 0);
  const res = await tick(sp, {});
  assert.equal(res.ran.length, 0);
  sp.close();
});
