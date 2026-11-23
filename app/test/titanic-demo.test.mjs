// The Titanic demo workspace's data (app/demo/titanic-1912.json, built by tools/build-titanic-demo.mjs from the holodeck sample),
// and the guard that the old example data stays gone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.join(here, '..');
const J = JSON.parse(fs.readFileSync(path.join(app, 'demo', 'titanic-1912.json'), 'utf8'));

test('the demo is the holodeck Titanic sample: seven full-text sources, one table, three recordings, six questions', () => {
  assert.equal(J.id, 'titanic-1912');
  assert.equal(J.readings.length, 7);
  for (const r of J.readings) { assert.ok(r.title && r.type, 'a source has a title and a kind'); assert.ok(r.html.length > 1000, `${r.title}: has its text`); }
  assert.equal(J.media.length, 3);
  assert.equal(J.try.length, 6);
});

test('"Numbers saved" is the British report\'s own table, and its figures agree with themselves', () => {
  const N = J.numbers;
  assert.deepEqual(N.cols, ['section', 'group', 'aboard', 'saved', 'percent_saved']);
  assert.equal(N.rows.length, 24);
  for (const [section, group, aboard, saved, pct] of N.rows) {
    assert.ok(section && group);
    assert.ok(Number.isInteger(aboard) && Number.isInteger(saved) && saved <= aboard, `${section} / ${group}: saved cannot exceed aboard`);
    if (pct !== '') assert.ok(Math.abs((saved / aboard) * 100 - pct) < 0.05, `${section} / ${group}: ${saved}/${aboard} is not ${pct}%`);
  }
});

test('the old example data is gone from the page, the demo and the engine test', () => {
  const word = 'nash' + 'ville';   // spelled in two parts so this file does not trip its own check
  for (const f of [path.join(app, 'index.html'), path.join(app, 'demo', 'titanic-1912.json'), path.join(here, 'engine.test.mjs')])
    assert.ok(!fs.readFileSync(f, 'utf8').toLowerCase().includes(word), `${path.basename(f)} still names the old example`);
});
