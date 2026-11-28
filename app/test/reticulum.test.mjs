// Reticulum as a route. Two REAL Reticulum instances (python `rns`, no shared instance) joined by a loopback TCP interface, the real bridge on each,
// and eodb's own engine syncing a space across them: the serving side holds only ciphertext, and the address is a destination hash, not an IP.
// Skips with the typed reason `rns-absent` when python `rns` is not importable (pip install rns, or set EODB_RNS_PYTHON).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSpace } from '../engine.mjs';
import { tcpServer, reticulumAdapter } from '../tcp.mjs';
import { directServer } from '../direct.mjs';
import * as B from '../vendor/pharos/browser-store.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const bridge = path.join(here, '..', 'reticulum', 'bridge.py');
const py = process.env.EODB_RNS_PYTHON || 'python3';
const have = spawnSync(py, ['-c', 'import RNS']).status === 0;
const skip = have ? false : 'rns-absent: pip install rns (or set EODB_RNS_PYTHON)';
const cells = JSON.parse(fs.readFileSync(path.join(here, '..', 'vendor', 'pharos', 'cells.json'), 'utf8'));

const freePort = () => new Promise((res) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eodb-rns-'));
const procs = [], opened = [], servers = [];
test.after(async () => { for (const sp of opened) sp.close(); for (const p of procs) p.kill(); for (const s of servers) await s.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

function rnsConfig(dir, iface) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'config'), `[reticulum]\n  enable_transport = False\n  share_instance = No\n  respond_to_probes = No\n[interfaces]\n${iface ? `  [[link]]\n    enabled = yes\n${iface}\n` : ''}`);
  return dir;
}
const firstLine = (proc) => new Promise((res, rej) => {
  let buf = ''; const t = setTimeout(() => rej(new Error('bridge printed nothing: ' + buf)), 20000);
  proc.stdout.on('data', (d) => { buf += d; const i = buf.indexOf('\n'); if (i >= 0) { clearTimeout(t); res(buf.slice(0, i).trim()); } });
  proc.on('exit', (c) => rej(new Error('bridge exited ' + c)));
});

test('1. a space syncs across two Reticulum instances by destination hash, and the far side holds only ciphertext', { skip, timeout: 60000 }, async () => {
  const wire = await freePort();
  const store = new Map();
  const target = await tcpServer({ port: 0 }, (ch) => directServer(ch, store)); servers.push(target);
  const aCfg = rnsConfig(path.join(tmp, 'a'), `    type = TCPServerInterface\n    listen_ip = 127.0.0.1\n    listen_port = ${wire}`);
  const bCfg = rnsConfig(path.join(tmp, 'b'), `    type = TCPClientInterface\n    target_host = 127.0.0.1\n    target_port = ${wire}`);

  const serve = spawn(py, [bridge, 'serve', '--rns-config', aCfg, '--target', `127.0.0.1:${target.port}`], { stdio: ['ignore', 'pipe', 'inherit'] }); procs.push(serve);
  const dest = await firstLine(serve);
  assert.match(dest, /^[0-9a-f]{32}$/, 'the printed address is a 16-byte hash');
  const bport = await freePort();
  const conn = spawn(py, [bridge, 'connect', '--rns-config', bCfg, '--listen', `127.0.0.1:${bport}`], { stdio: ['ignore', 'pipe', 'inherit'] }); procs.push(conn);
  await firstLine(conn);

  const route = `reticulum:${dest}?bridge=127.0.0.1:${bport}`;
  const mk = () => ({ backend: B.memoryBackend(), blobBackend: B.memoryBackend() });
  const A = await openSpace({ name: 'eodb', ...mk(), cells, autosync: false, adapters: { reticulum: reticulumAdapter } }); opened.push(A);
  A.append('ws+', { id: 'w1', name: 'SECRET-WORKSPACE-NAME' });
  const link = await A.share({ routes: [route] }); await A.settle();
  await A.syncOnce();
  assert.ok(store.size > 0, 'the founder put segments across Reticulum');
  assert.ok(![...store.values()].some((b) => Buffer.from(b).toString('latin1').includes('SECRET-WORKSPACE-NAME')), 'ciphertext only at the far end');

  const J = await openSpace({ name: 'eodb', ...mk(), cells, autosync: false, join: link, adapters: { reticulum: reticulumAdapter } }); opened.push(J);
  await J.syncOnce(); await J.settle();
  assert.ok(J.view().some((e) => e.op === 'ws+' && e.body.name === 'SECRET-WORKSPACE-NAME'), 'the joiner read the founder\'s entry over Reticulum');
  assert.equal(J.report().share.routesUp, 1);
});

test('2. a route with no bridge fails with how to start one, not a hang', async () => {
  const p = await freePort();
  await assert.rejects(reticulumAdapter(`reticulum:${'ab'.repeat(16)}?bridge=127.0.0.1:${p}`), /no bridge at .*bridge\.py connect/);
  await assert.rejects(reticulumAdapter('reticulum:nothex'), /32-hex destination hash/);
});

test('3. a destination nobody announced is refused by the bridge with a typed reason', { skip }, async () => {
  const bCfg = rnsConfig(path.join(tmp, 'c'), '');
  const bport = await freePort();
  const conn = spawn(py, [bridge, 'connect', '--rns-config', bCfg, '--listen', `127.0.0.1:${bport}`, '--timeout', '2'], { stdio: ['ignore', 'pipe', 'inherit'] }); procs.push(conn);
  await firstLine(conn);
  await assert.rejects(reticulumAdapter(`reticulum:${'cd'.repeat(16)}?bridge=127.0.0.1:${bport}`), /no path to/);
});
