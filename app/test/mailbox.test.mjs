// Sharing over a MAILBOX route: the real mailbox server (app/mailbox/mailbox.mjs) in-process, private reads, a bearer token, fully separate storage per space.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { openSpace, parseJoin } from '../engine.mjs';
import { startRelay } from '../relay.mjs';
import { serve } from '../mailbox/mailbox.mjs';
import { mailboxCarrier, parseMailboxRoute } from '../net.mjs';
import * as B from '../vendor/pharos/browser-store.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cells = JSON.parse(fs.readFileSync(path.join(here, '..', 'vendor', 'pharos', 'cells.json'), 'utf8'));
const TOKEN = 'test-token-' + 'x'.repeat(20);
const mk = () => ({ backend: B.memoryBackend(), blobBackend: B.memoryBackend() });
const opened = [], servers = [], dirs = [];
const open = async (b, extra = {}) => { const sp = await openSpace({ name: 'eodb', ...b, cells, autosync: false, ...extra }); opened.push(sp); return sp; };
const box = async (opts = {}) => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbx-')); dirs.push(dir); const s = await serve({ datadir: dir, token: TOKEN, private: true, cors: true, ...opts }); servers.push(s); return { ...s, url: `http://127.0.0.1:${s.port}`, route: `mailbox:http://127.0.0.1:${s.port}#${TOKEN}`, dir }; };
test.after(async () => { for (const sp of opened) sp.close(); for (const s of servers) await s.close(); for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });
const BASE = [['ws+', { id: 'w1', name: 'Shared work' }], ['tb+', { id: 't1', ws: 'w1', name: 'T' }], ['fld+', { tb: 't1', id: 'f1', n: 'N', t: 'text' }], ['row+', { tb: 't1', id: 'r1', v: { f1: 'start' } }]];
const cell = (sp) => { const e = sp.view().filter((x) => x.op === 'cell=').at(-1); return e && e.body.v; };
async function pair(routes) { const A = await open(mk()); for (const [op, body] of BASE) A.append(op, body); const link = await A.share({ routes }); await A.settle(); const G = await open(mk(), { join: link }); return { A, G, link }; }
const walkFiles = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walkFiles(path.join(d, e.name)) : [path.join(d, e.name)]));

test('1. a route string splits into address and token; no token is fine too', () => {
  assert.deepEqual(parseMailboxRoute('mailbox:https://mail.example.org#abc%2Bdef'), { base: 'https://mail.example.org', token: 'abc+def' });
  assert.deepEqual(parseMailboxRoute('mailbox:http://127.0.0.1:9'), { base: 'http://127.0.0.1:9', token: '' });
});

test('2. a guest joins over a mailbox route and edits flow both ways, through a private server that needs the token for everything', async () => {
  const m = await box(); const { A, G } = await pair([m.route]);
  assert.equal(G.role, 'guest'); assert.deepEqual(G.view().map((e) => e.op), BASE.map((b) => b[0]));
  A.append('cell=', { tb: 't1', rid: 'r1', fid: 'f1', v: 'from founder' }); await A.syncOnce(); await G.syncOnce(); assert.equal(cell(G), 'from founder');
  G.append('cell=', { tb: 't1', rid: 'r1', fid: 'f1', v: 'from guest' }); await G.syncOnce(); await A.syncOnce(); assert.equal(cell(A), 'from guest');
  assert.ok(A.view().every((e) => e.ok) && G.view().every((e) => e.ok));
  assert.equal((await fetch(`${m.url}/v1/list`)).status, 401, 'no token, no listing');
});

test('3. the wrong token cannot join or read: the route is refused and the space is not reachable', async () => {
  const m = await box(); const A = await open(mk()); for (const [op, body] of BASE) A.append(op, body); const link = await A.share({ routes: [m.route] }); await A.settle();
  const j = parseJoin(link); const wrong = `eodb-join:1:${Buffer.from(JSON.stringify({ ...j, routes: [`mailbox:${m.url}#wrong-token`] })).toString('base64url')}`;
  await assert.rejects(open(mk(), { join: wrong }), /cannot reach|not been published/i);
});

test('4. what the server holds is unreadable: sealed by the app, then encrypted again at rest under the server key', async () => {
  const m = await box(); const { A } = await pair([m.route]); A.append('cell=', { tb: 't1', rid: 'r1', fid: 'f1', v: 'TOP-SECRET-VALUE' }); await A.syncOnce();
  const files = walkFiles(path.join(m.dir, 'objects')); assert.ok(files.length >= 1);
  const all = files.map((f) => fs.readFileSync(f)).join('');
  for (const needle of ['TOP-SECRET', 'Shared work', 'cell-set', 'PHR1']) assert.ok(!all.includes(needle), `"${needle}" must not be readable on disk`);
});

test('5. a full mailbox (quota) is reported on that route only: sync carries on through the other route and nothing is lost', async () => {
  const full = await box({ quota: 200 }), relay = await startRelay({ port: 0 }); servers.push({ close: () => relay.close() });
  const { A, G } = await pair([full.route, `relay:${relay.url}`]);
  A.append('cell=', { tb: 't1', rid: 'r1', fid: 'f1', v: 'despite a full route' }); const r = await A.syncOnce(); await G.syncOnce();
  assert.ok(!r.error, 'the sync as a whole succeeded'); assert.equal(cell(G), 'despite a full route');
  const rep = A.report().share; assert.ok(rep.routes >= 2 && rep.routesUp >= 1);
});

test('6. the token can come from the environment instead of the command line', async () => {
  process.env.MAILBOX_TOKEN = 'from-env-token'; let m;
  try { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbx-')); dirs.push(dir); const s = await serve({ datadir: dir, private: true }); servers.push(s); m = s; } finally { delete process.env.MAILBOX_TOKEN; }
  const c = mailboxCarrier(`http://127.0.0.1:${m.port}`, 'from-env-token'); await c.putNew('w/000001-1-aaaaaaaa.seg', new Uint8Array([1, 2, 3]));
  assert.deepEqual(await c.list(), ['w/000001-1-aaaaaaaa.seg']); assert.deepEqual([...await c.get('w/000001-1-aaaaaaaa.seg')], [1, 2, 3]);
  await assert.rejects(mailboxCarrier(`http://127.0.0.1:${m.port}`, 'nope').list(), /token was refused/);
});

test('7. --cors answers the browser\'s preflight and adds the headers; without it, a browser page could not use the server', async () => {
  const on = await box({ cors: true }), off = await box({ cors: false });
  const pre = (m) => fetch(`${m.url}/v1/objects/w/000001-1-aaaaaaaa.seg`, { method: 'OPTIONS', headers: { origin: 'https://app.example', 'access-control-request-method': 'PUT', 'access-control-request-headers': 'authorization' } });
  const a = await pre(on); assert.equal(a.status, 204); assert.equal(a.headers.get('access-control-allow-origin'), '*'); assert.match(a.headers.get('access-control-allow-headers'), /authorization/i); assert.match(a.headers.get('access-control-allow-methods'), /PUT/);
  const b = await pre(off); assert.equal(b.status, 405); assert.equal(b.headers.get('access-control-allow-origin'), null);
  const real = await fetch(`${on.url}/v1/list`, { headers: { authorization: `Bearer ${TOKEN}`, origin: 'https://app.example' } }); assert.equal(real.headers.get('access-control-allow-origin'), '*', 'real responses carry the header too');
});

test('8. an upload over the cap is refused at once with 413, the connection is dropped, and nothing is stored', async () => {
  const m = await box({ maxObject: 1000 });
  const r = await fetch(`${m.url}/v1/objects/w/000001-1-bbbbbbbb.seg`, { method: 'PUT', headers: { authorization: `Bearer ${TOKEN}` }, body: new Uint8Array(50000) });
  assert.equal(r.status, 413); assert.equal((await (await fetch(`${m.url}/v1/list`, { headers: { authorization: `Bearer ${TOKEN}` } })).json()).objects.length, 0);
});

test('9. names with slashes round trip, an existing object is never overwritten (409), and a bad name is refused', async () => {
  const m = await box(); const c = mailboxCarrier(m.url, TOKEN);
  await c.putNew('guest.ab12.cd34/000001-3-deadbeef.seg', new Uint8Array([7])); await c.putNew('blob/' + 'a'.repeat(64), new Uint8Array([8]));
  assert.deepEqual((await c.list()).sort(), ['blob/' + 'a'.repeat(64), 'guest.ab12.cd34/000001-3-deadbeef.seg']);
  await assert.rejects(c.putNew('guest.ab12.cd34/000001-3-deadbeef.seg', new Uint8Array([9])), (e) => e.status === 409);
  assert.equal(await c.get('missing/000001-1-aaaaaaaa.seg'), null);
  await assert.rejects(c.putNew('w/a..b', new Uint8Array([1])), (e) => e.status === 400, 'a name containing .. is refused');
  await assert.rejects(c.putNew('w/a b', new Uint8Array([1])), (e) => e.status === 400, 'so is one with characters outside the allowed set');
});

test('10. /health reports the real object count and quota use', async () => {
  const m = await box(); const c = mailboxCarrier(m.url, TOKEN); await c.putNew('w/000001-1-aaaaaaaa.seg', new Uint8Array(10)); await c.putNew('w/000002-1-bbbbbbbb.seg', new Uint8Array(10));
  const h = await (await fetch(`${m.url}/health`)).json(); assert.equal(h.objects, 2); assert.ok(h.used > 0 && h.free < h.quota);
});

test('11. started through a SYMLINKED path the server still starts and answers (it used to exit silently)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbx-')); dirs.push(dir);
  const link = path.join(dir, 'linked-mailbox.mjs'); fs.symlinkSync(path.join(here, '..', 'mailbox', 'mailbox.mjs'), link);
  const port = 20000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, [link, '--datadir', path.join(dir, 'data'), '--port', String(port)], { env: { ...process.env, MAILBOX_TOKEN: 't' }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    let up = false; for (let i = 0; i < 40 && !up; i++) { await new Promise((r) => setTimeout(r, 100)); try { up = (await fetch(`http://127.0.0.1:${port}/health`)).ok; } catch (e) { /* not yet */ } }
    assert.ok(up, 'the server answered /health');
  } finally { child.kill(); }
});
