// relational.mjs: folding the EOT into tables and querying it like a conventional database.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { materialize, select, query, toSQLite, toJSON } from '../relational.mjs';

// a synthetic log in the engine's view() shape: tables, fields, rows, an edit, and a retraction.
const entries = [
  { id: 'e1', op: 'ws+', body: { id: 'w1', name: 'Contracts' } },
  { id: 'e2', op: 'tb+', body: { id: 't1', ws: 'w1', name: 'Contracts', std: null } },
  { id: 'e3', op: 'fld+', body: { tb: 't1', id: 'f1', n: 'vendor', t: 'text' } },
  { id: 'e4', op: 'fld+', body: { tb: 't1', id: 'f2', n: 'amount', t: 'currency' } },
  { id: 'e5', op: 'fld+', body: { tb: 't1', id: 'f3', n: 'awarded', t: 'date' } },
  { id: 'e6', op: 'rows+', body: { tb: 't1', rows: [
    { id: 'r1', v: { f1: 'Axon', f2: 1240000, f3: '2026-03-14' } },
    { id: 'r2', v: { f1: 'Motorola', f2: 2980500, f3: '2026-05-02' } },
    { id: 'r3', v: { f1: 'Flock', f2: 312400, f3: '2026-01-21' } },
  ] } },
  { id: 'e7', op: 'cell=', body: { tb: 't1', rid: 'r1', fid: 'f2', v: 999999 } },   // an edit (DEF), not a new row
  { id: 'e8', op: 'row+', body: { tb: 't1', id: 'r4', v: { f1: 'Ghost', f2: 1, f3: '2026-06-01' } } },
  { id: 'e9', op: 'retract', body: { of: 'e8' } },                                 // retracted row must not appear
  // a second table for joins
  { id: 'e10', op: 'tb+', body: { id: 't2', ws: 'w1', name: 'Buyers', std: null } },
  { id: 'e11', op: 'fld+', body: { tb: 't2', id: 'g1', n: 'name', t: 'text' } },
  { id: 'e12', op: 'fld+', body: { tb: 't2', id: 'g2', n: 'dept', t: 'text' } },
  { id: 'e13', op: 'rows+', body: { tb: 't2', rows: [
    { id: 'b1', v: { g1: 'Axon', g2: 'Police' } },
    { id: 'b2', v: { g1: 'Motorola', g2: 'Emergency' } },
  ] } },
];

test('materialize folds tables, fields, rows, edits and retractions forward', () => {
  const db = materialize(entries);
  assert.equal(db.tables.length, 2);
  const t = db.tables.find((x) => x.id === 't1');
  assert.deepEqual(t.columns.map((c) => c.name), ['vendor', 'amount', 'awarded']);
  assert.equal(t.rows.length, 3);                    // r1 (edited), r2, r3; r4 retracted
  const r1 = t.rows.find((r) => r.id === 'r1');
  assert.equal(r1.v.f2, 999999);                     // the cell= edit applied in place
});

test('SELECT * returns every column, name-keyed', () => {
  const db = materialize(entries);
  const r = select(db, 'SELECT * FROM Contracts');
  assert.deepEqual(r.columns, ['vendor', 'amount', 'awarded']);
  assert.equal(r.rows.length, 3);
  assert.equal(r.rows[0].vendor, 'Axon');
});

test('WHERE with numeric and string comparisons', () => {
  const db = materialize(entries);
  const r = select(db, 'SELECT vendor FROM Contracts WHERE amount > 500000');   // Axon was edited to 999999, Flock is 312400
  assert.deepEqual(r.rows.map((x) => x.vendor), ['Axon', 'Motorola']);
  const s = select(db, "SELECT vendor FROM Contracts WHERE vendor LIKE 'M%'");
  assert.deepEqual(s.rows.map((x) => x.vendor), ['Motorola']);
});

test('ORDER BY and LIMIT', () => {
  const db = materialize(entries);
  const r = select(db, 'SELECT vendor FROM Contracts ORDER BY amount DESC LIMIT 2');
  assert.deepEqual(r.rows.map((x) => x.vendor), ['Motorola', 'Axon']);
});

test('aggregates and GROUP BY', () => {
  const db = materialize(entries);
  const r = select(db, 'SELECT COUNT(*) AS n, SUM(amount) AS total FROM Contracts');
  assert.equal(r.rows[0].n, 3);
  assert.equal(r.rows[0].total, 999999 + 2980500 + 312400);
});

test('JOIN matches two tables on a column', () => {
  const db = materialize(entries);
  const r = select(db, 'SELECT Contracts.vendor, Buyers.dept FROM Contracts JOIN Buyers ON Contracts.vendor = Buyers.name');
  assert.equal(r.rows.length, 2);
  const axon = r.rows.find((x) => x['Contracts.vendor'] === 'Axon');
  assert.equal(axon['Buyers.dept'], 'Police');
});

test('toSQLite emits DDL and INSERTs; toJSON emits portable tables', () => {
  const db = materialize(entries);
  const sql = toSQLite(db);
  assert.match(sql, /CREATE TABLE "Contracts"/);
  assert.match(sql, /INSERT INTO "Contracts" \("vendor", "amount", "awarded"\) VALUES \('Axon', 999999, '2026-03-14'\);/);
  const j = toJSON(db);
  assert.equal(j.tables.Contracts.rows.length, 3);
  assert.equal(j.tables.Contracts.columns.length, 3);
});

test('structured query() takes the parsed form directly', () => {
  const db = materialize(entries);
  const r = query(db, { select: [{ column: 'vendor' }], from: [{ name: 'Contracts', alias: 'Contracts' }], where: { col: 'amount', op: '<', val: '500000', type: 'number' }, orderBy: [], limit: null, offset: 0 });
  assert.deepEqual(r.rows.map((x) => x.vendor), ['Flock']);
});
