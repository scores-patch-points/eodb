// Turning files into tables: parse CSV/TSV/JSON, infer field types, and land rows — both the pure parser and the engine call.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, inferType, tableSpec } from '../tabular.mjs';
import { openSpace } from '../engine.mjs';
import * as B from '../vendor/pharos/browser-store.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cells = JSON.parse(fs.readFileSync(path.join(here, '..', 'vendor', 'pharos', 'cells.json'), 'utf8'));
const te = new TextEncoder();

test('1. a CSV parses into columns and rows, quotes and commas included', () => {
  const csv = 'vendor,amt,awarded\nAxon Enterprise Inc,"1,240,000",2026-03-14\nMotorola Solutions,2980500,2026-05-02\n';
  const p = parse(te.encode(csv), 'contracts.csv', 'text/csv');
  assert.deepEqual(p.columns, ['vendor', 'amt', 'awarded']);
  assert.equal(p.rows.length, 2);
  assert.equal(p.rows[0].vendor, 'Axon Enterprise Inc');
  assert.equal(p.rows[0].amt, '1,240,000');   // the quoted comma stayed inside the field
});

test('2. JSON and JSONL parse too', () => {
  const j = parse(te.encode('[{"a":1,"b":"x"},{"a":2,"b":"y"}]'), 'd.json', 'application/json');
  assert.deepEqual(j.columns, ['a', 'b']);
  assert.equal(j.rows[1].b, 'y');
  const l = parse(te.encode('{"a":1}\n{"a":2}\n'), 'd.jsonl');
  assert.equal(l.rows.length, 2);
});

test('3. field types are inferred from the values', () => {
  assert.equal(inferType(['1', '2', '3']), 'number');
  assert.equal(inferType(['$1,240', '$86,250']), 'currency');
  assert.equal(inferType(['12%', '3.5%']), 'percent');
  assert.equal(inferType(['2026-03-14', '2026-05-02']), 'date');
  assert.equal(inferType(['true', 'false']), 'checkbox');
  assert.equal(inferType(['a@x.com', 'b@y.org']), 'email');
  assert.equal(inferType(['https://a', 'http://b']), 'url');
  assert.equal(inferType(['Acme', 'Dell']), 'text');
});

test('4. tableSpec produces fields with types and keeps the rows', () => {
  const p = parse(te.encode('vendor,amt,awarded\nAcme,100,2026-03-14\n'), 'c.csv', 'text/csv');
  const s = tableSpec({ name: 'Contracts', columns: p.columns, rows: p.rows });
  assert.deepEqual(s.fields.map((f) => [f.n, f.t]), [['vendor', 'text'], ['amt', 'number'], ['awarded', 'date']]);
  assert.equal(s.rows.length, 1);
});

test('5. the engine turns file bytes into a real table that folds back', async () => {
  const sp = await openSpace({ name: 'eodb', backend: B.memoryBackend(), blobBackend: B.memoryBackend(), cells, autosync: false });
  const r = sp.importTable({ name: 'Contracts', bytes: te.encode('vendor,amt,awarded\nAcme,1500,2026-03-14\nDell,86250,2026-05-02\n'), type: 'text/csv', ws: 'w1' });
  assert.equal(r.fields, 3);
  assert.equal(r.rows, 2);

  const view = sp.view();
  const tb = view.find((e) => e.op === 'tb+' && e.body.id === r.tableId);
  assert.equal(tb.body.name, 'Contracts');
  const flds = view.filter((e) => e.op === 'fld+' && e.body.tb === r.tableId);
  assert.equal(flds.length, 3);
  assert.deepEqual(flds.map((f) => f.body.t), ['text', 'number', 'date']);
  const rows = view.find((e) => e.op === 'rows+' && e.body.tb === r.tableId);
  assert.equal(rows.body.rows.length, 2);
  // a row's values are keyed by field id and carry the parsed cells
  const firstRow = rows.body.rows[0];
  const amtField = flds.find((f) => f.body.n === 'amt');
  assert.equal(firstRow.v[amtField.body.id], '1500');
  sp.close();
});
