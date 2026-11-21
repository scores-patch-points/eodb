// server.mjs: the EOT projected over HTTP — tables, SQL, export, and webhook intake that is audited and answered by the log.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSpace } from '../engine.mjs';
import * as B from '../vendor/pharos/browser-store.mjs';
import { createServer } from '../server.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cells = JSON.parse(fs.readFileSync(path.join(here, '..', 'vendor', 'pharos', 'cells.json'), 'utf8'));

const listen = (server) => new Promise((res) => server.listen(0, '127.0.0.1', () => res(server.address().port)));

async function start() {
  const sp = await openSpace({ name: 'eodb', backend: B.memoryBackend(), blobBackend: B.memoryBackend(), cells, autosync: false });
  const server = createServer(sp);
  const port = await listen(server);
  return { sp, server, base: `http://127.0.0.1:${port}` };
}

test('the projection server serves tables, SQL and export from the log', async () => {
  const { sp, server, base } = await start();
  sp.landTable({ name: 'Contracts', columns: ['vendor', 'amount'], rows: [{ vendor: 'Acme', amount: 1500 }, { vendor: 'Dell', amount: 86250 }], ws: 'w1' });

  const tables = await (await fetch(`${base}/api/tables`)).json();
  assert.equal(tables.tables.length, 1);
  assert.equal(tables.tables[0].name, 'Contracts');

  const q = await (await fetch(`${base}/api/query`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sql: 'SELECT vendor FROM Contracts WHERE amount > 5000' }) })).json();
  assert.deepEqual(q.rows.map((x) => x.vendor), ['Dell']);

  const sql = await (await fetch(`${base}/api/export.sql`)).text();
  assert.match(sql, /CREATE TABLE "Contracts"/);

  const j = await (await fetch(`${base}/api/export.json`)).json();
  assert.equal(j.tables.Contracts.rows.length, 2);

  sp.close(); server.close();
});

test('a webhook POST is audited as an event and answered by a matching trigger automation', async () => {
  const { sp, server, base } = await start();
  sp.append('auto+', { name: 'orders-in', nodes: [
    { id: 'w', type: 'webhook', fields: {} },
    { id: 'x', type: 'transform', fields: { op: 'flatten' } },
    { id: 's', type: 'store', fields: { name: 'Orders', ws: 'w1' } },
  ], edges: [
    { from: 'w', fromPort: 'data', to: 'x', toPort: 'data' },
    { from: 'x', fromPort: 'rows', to: 's', toPort: 'rows' },
  ] });
  sp.registerTrigger({ id: 'wh1', auto: 'orders-in', type: 'webhook', path: 'orders' });

  const res = await (await fetch(`${base}/webhook/orders`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rows: [{ vendor: 'Zed' }] }) })).json();
  assert.equal(res.runs.length, 1);
  assert.equal(res.runs[0].ok, true);

  // the event itself is in the log (audited even before any automation ran)
  assert.ok(sp.automationLog().some((e) => e.op === 'auto-event+' && e.body.path === 'orders'));

  const rows = sp.sql('SELECT vendor FROM Orders');
  assert.deepEqual(rows.rows.map((x) => x.vendor), ['Zed']);
  sp.close(); server.close();
});
