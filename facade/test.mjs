// Run: PHAROS_SRC=/path/to/pharos node --test facade/test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { VERBS, openLog, say, forget, ask, get, defineView } from './db.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const TMP = process.env.TEST_TMP || path.join(here, '.test-tmp');
fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true });
let n = 0;
const fresh = () => path.join(TMP, `log${++n}`);
const q = 'SEG(sources; kinds: ["contact"])';

test('the verb table points only at real cells, one per verb', () => {
  const cells = JSON.parse(fs.readFileSync(path.join(process.env.PHAROS_SRC, 'cells.json'), 'utf8')).cells.map((c) => c.id);
  for (const [v, c] of Object.entries(VERBS)) assert.ok(cells.includes(c), `${v} -> ${c} is not a cell`);
  assert.equal(Object.keys(VERBS).length, 8);
  assert.equal(new Set(Object.values(VERBS)).size, 8, 'no two verbs share a cell');
});

test('say writes the table cell, declares the kind, and rejects a bad verb', async () => {
  const dir = fresh(); const h = await openLog({ dir, writer: 'me' });
  const e = await say(h, 'add', 'contact:ana', { name: 'Ana' });
  assert.equal(e.cell, 'INS·Figure'); assert.equal(e.kind, 'contact');
  const s = await say(h, 'set', 'contact:ana', { phone: '1' });
  assert.equal(s.cell, 'DEF·Figure'); assert.equal(s.kind, 'contact.set');
  await assert.rejects(() => say(h, 'frobnicate', 'contact:ana', {}), /unknown verb/);
  await assert.rejects(() => say(h, 'add', '', {}), /address/);
});

test('saying the same thing twice from the same writer gives the same entry', async () => {
  const dir = fresh(); const h = await openLog({ dir, writer: 'me' });
  const a = await say(h, 'add', 'contact:ana', { name: 'Ana' });
  const b = await say(h, 'add', 'contact:ana', { name: 'Ana' });
  assert.equal(a.id, b.id);
});

test('get merges the add body and later sets, and keeps the history', async () => {
  const dir = fresh(); const h = await openLog({ dir, writer: 'me' });
  await say(h, 'add', 'contact:ana', { name: 'Ana', phone: '1' });
  await say(h, 'set', 'contact:ana', { phone: '2' });
  await say(h, 'set', 'contact:ana', { phone: '3' });
  const g = await get(dir, 'contact:ana');
  assert.deepEqual(g.current, { name: 'Ana', phone: '3' });
  assert.equal(g.history.length, 3); assert.equal(g.hidden, false);
});

test('forget hides, and says so; it does not delete', async () => {
  const dir = fresh(); const h = await openLog({ dir, writer: 'me' });
  await say(h, 'add', 'contact:ben', { name: 'Ben' });
  await forget(h, 'contact:ben');
  const g = await get(dir, 'contact:ben');
  assert.equal(g.hidden, true); assert.deepEqual(g.current, {});
  assert.equal(g.history.length, 1, 'the entry is still in the log');
  const { card } = await ask(dir, q);
  assert.equal(card.hiddenByForget, 1);
  await assert.rejects(() => forget(h, 'contact:ben'), /nothing live/);
  const w2 = await openLog({ dir, writer: 'other' }); await say(w2, 'add', 'contact:zed', { name: 'Z' });
  await assert.rejects(() => forget(h, 'contact:zed'), /that you wrote/, 'you cannot hide another writer\'s entry');
});

test('ask passes :now only when the query uses it, and is repeatable for a fixed time', async () => {
  const dir = fresh(); const h = await openLog({ dir, writer: 'me' });
  await say(h, 'add', 'contact:ana', { name: 'Ana' });
  const withNow = 'EVA(SEG(sources; kinds: ["contact"]); where: _at < :now)';
  const a = await ask(dir, withNow, { now: '2999-01-01T00:00:00Z' });
  const b = await ask(dir, withNow, { now: '2999-01-01T00:00:00Z' });
  const early = await ask(dir, withNow, { now: '2000-01-01T00:00:00Z' });
  assert.equal(a.card.rows, 1); assert.equal(early.card.rows, 0);
  assert.equal(a.card.result, b.card.result);
  assert.equal(a.card.asOf, '2999-01-01T00:00:00Z');
  const plain = await ask(dir, q);
  assert.equal(plain.card.asOf, null, 'no time parameter when the query does not use :now');
});

test('two writers disagreeing at one place shows as contested, not as a silent overwrite', async () => {
  const dir = fresh();
  const w1 = await openLog({ dir, writer: 'w1' }); await say(w1, 'add', 'contact:x', { name: 'One' });
  const w2 = await openLog({ dir, writer: 'w2' }); await say(w2, 'add', 'contact:x', { name: 'Two' });
  const { card, envelope } = await ask(dir, q);
  assert.equal(envelope.rows.length >= 1, true);
  assert.equal(card.determined, false, 'a place with competing latest values is not determined');
});

test('a stored view can be defined and then asked by name', async () => {
  const dir = fresh(); const h = await openLog({ dir, writer: 'me' });
  await say(h, 'add', 'contact:ana', { name: 'Ana' });
  await say(h, 'add', 'contact:ben', { name: 'Ben' });
  await defineView(dir, 'me', 'names', 'REC(SEG(sources; kinds: ["contact"]); pick: ["name"])');
  const { envelope } = await ask(dir, 'names');
  assert.deepEqual(envelope.rows.map((r) => r.name).sort(), ['Ana', 'Ben']);
});

test('the command line refuses a body that is not JSON and an unknown command', () => {
  const dir = fresh();
  const bad = spawnSync('node', [path.join(here, 'db.mjs'), 'say', 'add', 'contact:a', '{nope', '--dir', dir, '--writer', 'me'], { encoding: 'utf8', env: process.env });
  assert.equal(bad.status, 1); assert.match(bad.stderr, /valid JSON/);
  const unk = spawnSync('node', [path.join(here, 'db.mjs'), 'wat'], { encoding: 'utf8', env: process.env });
  assert.equal(unk.status, 1); assert.match(unk.stderr, /unknown command/);
  const ok = execFileSync('node', [path.join(here, 'db.mjs'), 'say', 'add', 'contact:a', '{"n":1}', '--dir', dir, '--writer', 'me'], { encoding: 'utf8', env: process.env });
  assert.equal(JSON.parse(ok).cell, 'INS·Figure');
});

import { compare, who } from './db.mjs';

async function twoWriters() {
  const dir = fresh();
  const w1 = await openLog({ dir, writer: 'w1' }); await say(w1, 'add', 'contact:a', { name: 'Alice' }); await say(w1, 'add', 'contact:x', { name: 'X from w1' });
  const w2 = await openLog({ dir, writer: 'w2' }); await say(w2, 'add', 'contact:b', { name: 'Bob' }); await say(w2, 'add', 'contact:x', { name: 'X from w2' });
  return dir;
}

test('standpoint: reading as one writer shows only what they wrote, and the card says so', async () => {
  const dir = await twoWriters();
  const all = await ask(dir, q), w1 = await ask(dir, q, { as: ['w1'] }), w2 = await ask(dir, q, { as: ['w2'] }), both = await ask(dir, q, { as: ['w1', 'w2'] });
  assert.equal(all.card.rows, 4); assert.equal(w1.card.rows, 2); assert.equal(w2.card.rows, 2);
  assert.equal(both.card.rows, 4, 'naming every writer is the same as everyone');
  assert.equal(all.card.standpoint, 'everyone'); assert.match(w1.card.standpoint, /writers w1/);
  assert.deepEqual(w1.envelope.rows.map((r) => r._addr).sort(), ['contact:a', 'contact:x']);
});

test('standpoint: a place that is contested for everyone is determined from one writer', async () => {
  const dir = await twoWriters();
  assert.equal((await ask(dir, q)).card.determined, false);
  assert.equal((await ask(dir, q, { as: ['w1'] })).card.determined, true);
  assert.equal((await ask(dir, q, { as: ['w2'] })).card.determined, true);
});

test('standpoint: compare shows what only one standpoint sees', async () => {
  const dir = await twoWriters();
  const c = await compare(dir, q, { a: { as: ['w1'] }, b: { as: ['w2'] } });
  assert.equal(c.onlyA.length, 2); assert.equal(c.onlyB.length, 2); assert.equal(c.both, 0);
  const same = await compare(dir, q, { a: { as: ['w1'] }, b: {} });
  assert.equal(same.onlyB.length, 2, 'w1 versus everyone: everyone sees w2\'s two entries');
});

test('standpoint: an unknown writer sees nothing, and a standpoint works through a stored view', async () => {
  const dir = await twoWriters();
  assert.equal((await ask(dir, q, { as: ['nobody'] })).card.rows, 0);
  await defineView(dir, 'w1', 'names', 'REC(SEG(sources; kinds: ["contact"]); pick: ["name"])');
  const names = await ask(dir, 'names', { as: ['w2'] });
  assert.deepEqual(names.envelope.rows.map((r) => r.name).sort(), ['Bob', 'X from w2']);
});

test('who lists the writers to choose a standpoint from', async () => {
  const dir = await twoWriters();
  const w = await who(dir);
  assert.deepEqual(w.map((x) => x.writer).sort(), ['w1', 'w2']);
});

test('standpoint horizon: what the writer of an earlier entry could have known excludes later entries', async () => {
  const dir = fresh();
  const w1 = await openLog({ dir, writer: 'w1' }); await say(w1, 'add', 'contact:a', { name: 'Alice' });
  const w2 = await openLog({ dir, writer: 'w2' }); await say(w2, 'add', 'contact:b', { name: 'Bob' });
  const w1b = await openLog({ dir, writer: 'w1' }); await say(w1b, 'add', 'contact:c', { name: 'Cara' });
  const full = await ask(dir, q);
  assert.equal(full.card.rows, 3);
  const asW2 = await ask(dir, q, { horizon: { writer: 'w2' } });
  const seen = asW2.envelope.rows.map((r) => r._addr).sort();
  assert.ok(seen.includes('contact:a') && seen.includes('contact:b'), 'w2 knew about a and its own b');
  assert.ok(!seen.includes('contact:c'), 'w2 could not have known about c, written after');
});

test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));
process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true }));
