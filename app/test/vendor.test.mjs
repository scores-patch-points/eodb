// the vendored pharos modules are exactly what their pins say
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'vendor');
test('every vendored file matches its sha256 pin, and every vendored file is pinned', () => {
  const pins = fs.readFileSync(path.join(dir, 'VENDOR.sha256'), 'utf8').trim().split('\n').map((l) => l.split(/\s+/));
  assert.ok(pins.length >= 7);
  for (const [hash, name] of pins) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, 'pharos', name))).digest('hex'), hash, `${name} was edited or is out of date`);
  const files = fs.readdirSync(path.join(dir, 'pharos')).sort(); assert.deepEqual(pins.map((p) => p[1]).sort(), files);
});
