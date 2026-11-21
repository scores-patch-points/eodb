// project.mjs: converting the log into any database/file format — and recording the projection as a vfile entry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSpace } from '../engine.mjs';
import { PROJECTORS } from '../project.mjs';
import * as B from '../vendor/pharos/browser-store.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cells = JSON.parse(fs.readFileSync(path.join(here, '..', 'vendor', 'pharos', 'cells.json'), 'utf8'));

async function open() {
  const sp = await openSpace({ name: 'eodb', backend: B.memoryBackend(), blobBackend: B.memoryBackend(), cells, autosync: false });
  sp.landTable({ name: 'Contracts', columns: ['vendor', 'amount'], rows: [{ vendor: 'Acme', amount: 1500 }, { vendor: 'Dell', amount: 86250 }], ws: 'w1' });
  return sp;
}

test('PROJECTORS covers the database family plus flat formats', () => {
  assert.deepEqual(Object.keys(PROJECTORS).sort(), ['csv', 'json', 'jsonl', 'markdown', 'mysql', 'postgres', 'sqlite'].sort());
});

test('convert emits loadable SQL for sqlite, postgres and mysql, with the right types', async () => {
  const sp = await open();
  const s = sp.convert({ format: 'sqlite' });
  assert.match(s.text, /CREATE TABLE "Contracts"/);
  assert.match(s.text, /INSERT INTO "Contracts" \("vendor", "amount"\) VALUES \('Acme', 1500\);/);
  assert.match(s.text, /"amount" REAL/);
  const pg = sp.convert({ format: 'postgres' });
  assert.match(pg.text, /"amount" DOUBLE PRECISION/);
  const my = sp.convert({ format: 'mysql' });
  assert.match(my.text, /"amount" DOUBLE/);
  sp.close();
});

test('convert emits csv, json, jsonl and markdown', async () => {
  const sp = await open();
  const c = sp.convert({ format: 'csv', table: 'Contracts' });
  assert.match(c.text, /^vendor,amount\nAcme,1500\nDell,86250\n$/);
  const j = sp.convert({ format: 'json', table: 'Contracts' });
  const parsed = JSON.parse(j.text);
  assert.equal(parsed.tables.Contracts.rows.length, 2);
  const l = sp.convert({ format: 'jsonl', table: 'Contracts' });
  assert.equal(l.text.trim().split('\n').length, 2);
  const m = sp.convert({ format: 'markdown' });
  assert.match(m.text, /## Contracts/);
  sp.close();
});

test('every conversion is recorded as a vfile entry with a content hash and cited inputs', async () => {
  const sp = await open();
  const r = sp.convert({ format: 'sqlite', table: 'Contracts' });
  assert.equal(r.sha256, sp.sha(r.bytes), 'the recorded hash matches the bytes');
  const vf = sp.view().filter((e) => e.op === 'vfile+');
  assert.equal(vf.length, 1);
  assert.equal(vf[0].body.projector, 'sqlite');
  assert.equal(vf[0].body.size, r.bytes.length);
  assert.ok(vf[0].of.length >= 1, 'the vfile cites the table it was made from');
  // a second conversion is a new entry (sequence increments), never an overwrite
  sp.convert({ format: 'csv', table: 'Contracts' });
  assert.equal(sp.view().filter((e) => e.op === 'vfile+').length, 2);
  sp.close();
});
