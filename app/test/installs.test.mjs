// installs: the catalog of app kinds (app/installs.mjs) is held to the code, so the install instructions cannot quietly rot.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APPS, ROUTES, contract, renderMarkdown } from '../installs.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, '..', '..');
const read = (p) => fs.readFileSync(path.join(repo, p), 'utf8');
// the route schemes a piece of code builds in: the keys of an adapters object literal. A pattern over SOURCE CODE (identifiers before
// `: (uri) =>`), not over language. regex-ok: JavaScript source, not language
const schemesIn = (src, start) => { const body = src.slice(src.indexOf(start)); return [...body.slice(0, body.indexOf('};')).matchAll(/^\s*([a-z]+): \(uri\) =>/gm)].map((m) => m[1]); };

test('1. every file and test an app or route names exists', () => {
  for (const a of APPS) for (const p of [...a.files, ...a.tests]) assert.ok(fs.existsSync(path.join(repo, p)), `${a.id}: ${p} is missing`);
  for (const r of ROUTES) { assert.ok(fs.existsSync(path.join(repo, r.file)), `${r.scheme}: ${r.file}`); if (r.test) assert.ok(fs.existsSync(path.join(repo, r.test)), `${r.scheme}: ${r.test}`); }
});

test('2. every route scheme the engine and the Node apps build in is in the catalog, and the catalog claims none they lack', () => {
  const engine = schemesIn(read('app/engine.mjs'), 'const rawAdapters = {');
  assert.ok(engine.length >= 4, 'found the engine\'s adapters');
  const known = new Set(ROUTES.map((r) => r.scheme));
  for (const s of engine) assert.ok(known.has(s), `engine route ${s} is not in the catalog`);
  const headless = read('app/headless.mjs'), server = read('app/server.mjs');
  const nodeOnly = ['direct', 'reticulum'];
  for (const s of nodeOnly) assert.ok(headless.includes(`${s}: `) && known.has(s), `${s} is a headless route`);
  const byId = Object.fromEntries(APPS.map((a) => [a.id, a]));
  assert.deepEqual(new Set(byId['web-app'].speaks), new Set(engine), 'the browser dials exactly the engine\'s built-in routes');
  assert.deepEqual(new Set(byId['headless-node'].speaks), new Set([...engine, ...nodeOnly]));
  assert.deepEqual(new Set(byId['projection-server'].speaks), new Set(engine.concat(nodeOnly.filter((s) => server.includes(`${s}: `)))));
  for (const a of APPS) for (const s of [...a.speaks, ...a.serves]) assert.ok(known.has(s), `${a.id} names unknown route ${s}`);
  for (const r of ROUTES.filter((x) => x.status === 'gap')) assert.ok(!engine.includes(r.scheme), `${r.scheme} is wired now: update its status`);
});

test('3. the extension is listed as local-only for as long as it opens no shared space', () => {
  const bg = read('extension/background.js'), ext = APPS.find((a) => a.id === 'extension');
  if (/join: undefined/.test(bg) && !/share\(/.test(bg)) assert.deepEqual(ext.speaks, [], 'it dials no route');   // regex-ok: JavaScript source, not language
});

test('4. the contract is read from code, and every place it cites exists', () => {
  const c = contract();
  assert.ok(c.length >= 6);
  for (const x of c) assert.ok(fs.existsSync(path.join(repo, x.where.split(/[ ,]/)[0])), x.where);   // regex-ok: a path list, not language
});

test('5. app/INSTALL.md is the generated catalog (run node app/installs.mjs --write after changing it)', () => {
  assert.equal(read('app/INSTALL.md'), renderMarkdown());
});
