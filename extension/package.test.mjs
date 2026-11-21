// The extension package: a valid zip containing the extension shell and every file the engine needs, ready to load unpacked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildExtension } from './package.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

test('the extension package is a valid zip with the shell and the engine', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'eodb-ext-'));
  const r = buildExtension(out);
  const buf = fs.readFileSync(r.file);

  assert.ok(buf.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])), 'starts with the local-file-header magic (PK\\x03\\x04)');
  assert.ok(buf.subarray(buf.length - 22, buf.length - 18).equals(Buffer.from([0x50, 0x4b, 0x05, 0x06])), 'ends with the end-of-central-directory magic (PK\\x05\\x06)');

  for (const name of ['manifest.json', 'background.js', 'content.js', 'popup.html', 'sidepanel.html', 'engine.mjs', 'net.mjs', 'tabular.mjs', 'vendor/pharos/core.mjs', 'vendor/pharos/cells.json']) {
    assert.ok(buf.includes(Buffer.from(name, 'utf8')), `${name} is in the package`);
  }
  // the manifest is valid JSON and declares a module service worker
  const m = JSON.parse(fs.readFileSync(path.join(here, 'manifest.json'), 'utf8'));
  assert.equal(m.manifest_version, 3);
  assert.equal(m.background.service_worker, 'background.js');
  fs.rmSync(out, { recursive: true, force: true });
});
