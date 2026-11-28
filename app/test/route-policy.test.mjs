// A locator in the shared log names where every node connects, and any member can write one. These tests hold the line: a guest's announcement is never dialed,
// an internal address from the log is never dialed (even from the owner), and the policy itself says why.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSpace } from '../engine.mjs';
import { startRelay } from '../relay.mjs';
import { vetRoute, internalHost } from '../route-policy.mjs';
import * as B from '../vendor/pharos/browser-store.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cells = JSON.parse(fs.readFileSync(path.join(here, '..', 'vendor', 'pharos', 'cells.json'), 'utf8'));
const opened = [], closers = [];
test.after(async () => { for (const s of opened) s.close(); for (const c of closers) await c(); });
const mk = () => ({ backend: B.memoryBackend(), blobBackend: B.memoryBackend() });

test('1. the policy refuses internal hosts, raw sockets, credentials and bridge overrides from the log, and accepts a public relay', () => {
  for (const h of ['127.0.0.1', 'localhost', '10.1.2.3', '172.16.0.1', '192.168.0.9', '169.254.169.254', '100.64.0.1', '0', '2130706433', '0x7f000001', '::1', 'fd00::1', 'printer', 'db.internal']) assert.ok(internalHost(h), h);
  for (const h of ['relay.example.org', '203.0.113.9', '8.8.8.8']) assert.ok(!internalHost(h), h);
  for (const u of ['direct:tcp://10.0.0.5:22', 'relay:http://169.254.169.254/latest', 'relay:http://127.0.0.1:8853', 'relay:https://user:pw@relay.example.org', 'file:///etc/passwd', 'reticulum:' + 'ab'.repeat(16) + '?bridge=10.0.0.1:7770', 'reticulum:nothex'])
    assert.equal(vetRoute(u, { origin: 'log' }).ok, false, u);
  for (const u of ['relay:https://relay.example.org', 'mailbox:https://mail.example.org#tok', 'reticulum:' + 'ab'.repeat(16)]) assert.equal(vetRoute(u, { origin: 'log' }).ok, true, u);
  assert.equal(vetRoute('relay:http://127.0.0.1:8853', { origin: 'link' }).ok, true, 'the person chose a link route: dialed as given');
  assert.equal(vetRoute('relay:http://127.0.0.1:8853', { origin: 'log', trusted: ['127.0.0.1:8853'] }).ok, true, 'the log may repeat a host the link already named');
});

test('2. a guest-announced route and a log-announced internal route are never dialed', async () => {
  const relay = await startRelay({ port: 0 }); closers.push(() => relay.close());
  let hits = 0; const bait = net.createServer((s) => { hits++; s.destroy(); }); await new Promise((r) => bait.listen(0, '127.0.0.1', r)); closers.push(() => new Promise((r) => bait.close(r)));
  const baitUri = `relay:http://127.0.0.1:${bait.address().port}`;

  const A = await openSpace({ name: 'eodb', ...mk(), cells, autosync: false }); opened.push(A);
  A.append('ws+', { id: 'w1', name: 'x' });
  const link = await A.share({ routes: [`relay:${relay.url}`] }); await A.settle(); await A.syncOnce();
  const G = await openSpace({ name: 'eodb', ...mk(), cells, autosync: false, join: link }); opened.push(G);
  await G.syncOnce(); await G.settle();
  G.announceRoute(baitUri); await G.settle(); await G.syncOnce();
  await A.syncOnce(); await A.syncOnce();
  assert.equal(hits, 0, 'the founder never connected to a guest-announced address');
  assert.match(String((A.network().routes.find((r) => r.uri === baitUri) || {}).error || ''), /refused: announced by a guest/);

  A.announceRoute(baitUri); await A.settle(); await A.syncOnce(); await G.syncOnce(); await G.syncOnce();
  assert.equal(hits, 0, 'not even the owner can make nodes dial an internal address through the log');
  assert.match(String((G.network().routes.find((r) => r.uri === baitUri) || {}).error || ''), /refused: .*(internal address|guest)/);
});
