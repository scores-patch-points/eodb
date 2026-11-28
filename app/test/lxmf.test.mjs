// LXMF route: store-and-forward sync between members who need not be online together, through a real LXMF propagation node.
// Four real Reticulum+LXMF processes on one machine: P (a propagation node and transport hub), members A and B, and an outsider O.
// Skips with the typed reason `lxmf-absent` when python `rns`/`lxmf` are not importable (pip install rns lxmf, or set EODB_RNS_PYTHON).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSpace } from '../engine.mjs';
import { lxmfAdapterVia, newLxmfTag, tcpChannel } from '../tcp.mjs';
import { directCarrier } from '../direct.mjs';
import * as B from '../vendor/pharos/browser-store.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const daemonPy = path.join(here, '..', 'reticulum', 'lxmf_bridge.py');
const py = process.env.EODB_RNS_PYTHON || 'python3';
const skip = spawnSync(py, ['-c', 'import RNS, LXMF']).status === 0 ? false : 'lxmf-absent: pip install rns lxmf (or set EODB_RNS_PYTHON)';
const cells = JSON.parse(fs.readFileSync(path.join(here, '..', 'vendor', 'pharos', 'cells.json'), 'utf8'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eodb-lxmf-'));
const procs = new Set(), opened = [];
test.after(() => { for (const s of opened) s.close(); for (const p of procs) p.kill(); fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); });

const freePort = () => new Promise((res) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const mk = () => ({ backend: B.memoryBackend(), blobBackend: B.memoryBackend() });
// joining over LXMF: the joiner's first dial introduces it to the founder's daemon, which then sends everything the space holds. Until that
// arrives, opening says "not published yet", so a joiner retries (that is the nature of store-and-forward, not an error).
const joinWhenArrived = (via) => until('the space to arrive at the joiner', async () => { try { const s = await openSpace({ name: 'eodb', ...mk(), cells, autosync: false, join: link, adapters: { lxmf: lxmfAdapterVia(via) } }); return s; } catch (e) { if (!/not been published/.test(e.message)) throw e; return null; } }, 150000);
const until = async (what, fn, ms = 90000) => { const end = Date.now() + ms; for (;;) { const v = await fn(); if (v) return v; if (Date.now() > end) { for (const [n, d] of [['P', P], ['A', A], ['B', Bn]]) if (d) console.error(`--- ${n} log ---\n` + d.log().split('\n').slice(-25).join('\n')); throw new Error('timed out waiting for ' + what); } await new Promise((r) => setTimeout(r, 1000)); } };

function cfg(name, iface, transport = false) {
  const dir = path.join(tmp, name, 'rns'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'config'), `[reticulum]\n  enable_transport = ${transport ? 'Yes' : 'No'}\n  share_instance = No\n[interfaces]\n  [[link]]\n    enabled = yes\n${iface}\n`);
  return dir;
}
/** start a daemon; resolves { address, port, propagation, proc, log() } once it prints its address. Same name = same storage and identity. */
async function daemon(name, iface, extra = [], transport = false) {
  const proc = spawn(py, [daemonPy, '--rns-config', cfg(name, iface, transport), '--storage', path.join(tmp, name, 'store'), '--listen', `127.0.0.1:${await freePort()}`, '--sync-every', '3', '--verbose', ...extra], { stdio: ['ignore', 'pipe', 'pipe'] });
  procs.add(proc); proc.on('exit', () => procs.delete(proc));
  let err = ''; proc.stderr.on('data', (d) => { err += d; });
  const info = await new Promise((res, rej) => { let buf = ''; proc.stdout.on('data', (d) => { buf += d; const i = buf.indexOf('\n'); if (i >= 0) res(JSON.parse(buf.slice(0, i))); }); proc.on('exit', (c) => rej(new Error(`${name} exited ${c}: ${err}`))); });
  return { ...info, proc, bridge: `127.0.0.1:${info.port}`, log: () => err };
}

let wire, P, A, Bn, tag, link, SA, SB;
const client = (port) => `    type = TCPClientInterface\n    target_host = 127.0.0.1\n    target_port = ${port}`;

test('1. two members sync over LXMF: a joiner reads the founder\'s entry, delivered through the network, not a shared store', { skip, timeout: 180000 }, async () => {
  wire = await freePort();
  P = await daemon('p', `    type = TCPServerInterface\n    listen_ip = 127.0.0.1\n    listen_port = ${wire}`, ['--propagation-node-enable'], true);
  assert.match(P.propagation, /^[0-9a-f]{32}$/);
  A = await daemon('a', client(wire), ['--propagation-node', P.propagation, '--method', 'propagated']);
  Bn = await daemon('b', client(wire), ['--propagation-node', P.propagation, '--method', 'propagated']);
  assert.notEqual(A.address, Bn.address);

  tag = newLxmfTag();
  const route = `lxmf:${A.address}?tag=${tag}`;                   // what goes in the share link: no bridge port, no host
  SA = await openSpace({ name: 'eodb', ...mk(), cells, autosync: false, adapters: { lxmf: lxmfAdapterVia(A.bridge) } }); opened.push(SA);
  SA.append('ws+', { id: 'w1', name: 'LXMF-SECRET-NAME' });
  link = await SA.share({ routes: [route] }); await SA.settle(); await SA.syncOnce();
  SB = await joinWhenArrived(Bn.bridge); opened.push(SB);
  await until('B to read A\'s entry', async () => { await SA.syncOnce(); await SB.syncOnce(); await SB.settle(); return SB.view().some((e) => e.op === 'ws+' && e.body.name === 'LXMF-SECRET-NAME'); });

  // the objects really travelled: B's daemon holds them in its own store, sealed (no plaintext on disk anywhere under B)
  const files = fs.readdirSync(path.join(tmp, 'b', 'store', 'objects', tag));
  assert.ok(files.length > 0, 'B\'s daemon received objects');
  for (const f of files) assert.ok(!fs.readFileSync(path.join(tmp, 'b', 'store', 'objects', tag, f)).toString('latin1').includes('LXMF-SECRET-NAME'), 'only ciphertext at rest');
});

test('2. store-and-forward: a member that is OFFLINE when an entry is written still gets it, from the propagation node, after coming back', { skip: skip || false, timeout: 240000 }, async () => {
  assert.ok(SB, 'needs test 1');
  SB.close(); opened.splice(opened.indexOf(SB), 1);
  Bn.proc.kill(); await new Promise((r) => Bn.proc.once('exit', r));
  SA.append('ws+', { id: 'w2', name: 'written-while-B-was-away' }); await SA.settle(); await SA.syncOnce();
  // give A's daemon time to hand the parts to P (stamps, then a propagation transfer), with B provably not running
  await new Promise((r) => setTimeout(r, 15000));
  assert.ok(Bn.proc.exitCode !== null || Bn.proc.signalCode, 'B was offline the whole time');

  Bn = await daemon('b', client(wire), ['--propagation-node', P.propagation, '--method', 'propagated']);     // same storage + identity: B comes back
  SB = await joinWhenArrived(Bn.bridge); opened.push(SB);
  await until('B to read the entry written while it was offline', async () => { await SB.syncOnce(); await SB.settle(); return SB.view().some((e) => e.op === 'ws+' && e.body.name === 'written-while-B-was-away'); }, 180000);
});

test('3. an outsider without the tag cannot put objects into a member\'s store, and oversized objects are refused', { skip, timeout: 120000 }, async () => {
  assert.ok(A, 'needs test 1');
  const before = fs.readdirSync(path.join(tmp, 'a', 'store', 'objects'));
  const O = await daemon('o', client(wire), ['--propagation-node', P.propagation, '--method', 'propagated']);
  const wrongTag = newLxmfTag();
  const ch = await tcpChannel('127.0.0.1', O.port);
  await new Promise((res) => { ch.onMessage(res); ch.send(JSON.stringify({ t: 'hello', tag: wrongTag, peers: [A.address] })); });
  const oc = directCarrier(ch);
  await oc.putNew('junk/manifest', new TextEncoder().encode('{"parts":1,"total":4}'));
  await oc.putNew('junk/p0', new TextEncoder().encode('junk'));
  await until('A to log the drop', async () => /dropped: object for a space this node does not hold/.test(A.log()), 90000);
  assert.deepEqual(fs.readdirSync(path.join(tmp, 'a', 'store', 'objects')), before, 'no new space directory on A');

  const ach = await tcpChannel('127.0.0.1', A.port);
  await new Promise((res) => { ach.onMessage(res); ach.send(JSON.stringify({ t: 'hello', tag, peers: [] })); });
  await assert.rejects(directCarrier(ach).putNew('big', new Uint8Array(300 * 1024)), /refused: object over/);
  ach.close(); ch.close(); O.proc.kill();
});

test('4. remote control: an allow-listed LXMF client gets answers and can add a note; a stranger gets silence', { skip, timeout: 240000 }, async () => {
  assert.ok(A && SA, 'needs test 1');
  const { startLxmfBot } = await import('../lxmf-bot.mjs');
  const send = path.join(here, '..', 'reticulum', 'lxmf_send.py');
  const addrOf = (who) => spawnSync(py, [send, '--identity', path.join(tmp, who + '.id'), '--print-address'], { encoding: 'utf8' }).stdout.trim();
  const phone = addrOf('phone'), stranger = addrOf('stranger');
  assert.match(phone, /^[0-9a-f]{32}$/);
  await assert.rejects(startLxmfBot(SA, { bridge: A.bridge, allow: [] }), /at least one allowed/);
  const bot = await startLxmfBot(SA, { bridge: A.bridge, allow: [phone] });
  assert.equal(bot.address, A.address);
  const ask = (who, text, wait = 60) => new Promise((res) => {
    const p = spawn(py, [send, '--rns-config', cfg(who, client(wire)), '--identity', path.join(tmp, who + '.id'), '--to', A.address, '--text', text, '--wait', String(wait)], { stdio: ['ignore', 'pipe', 'ignore'] });
    procs.add(p); let out = ''; p.stdout.on('data', (d) => { out += d; }); p.on('exit', () => { procs.delete(p); try { res(JSON.parse(out.trim().split('\n').pop())); } catch { res({ sent: false, raw: out }); } });
  });

  const st = await ask('phone', 'status');
  assert.equal(st.sent, true); assert.match(String(st.reply), /^entries \d+; role founder; routes up/);
  const nt = await ask('phone', 'note hello from the phone');
  assert.match(String(nt.reply), /^noted \(b-/);
  assert.ok(SA.view().some((e) => e.op === 'blk+' && e.body.x === 'hello from the phone' && e.body.from === phone), 'the note is an entry in the space, attributed to the sender');
  const un = await ask('phone', 'rm -rf everything');
  assert.match(String(un.reply), /^unknown command "rm"/);

  const sx = await ask('stranger', 'status', 25);
  assert.equal(sx.sent, true, 'the stranger reached the node');
  assert.equal(sx.reply, null, 'and got no answer');
  assert.ok((bot.refused.get(stranger) || 0) >= 1, 'the bot saw and refused the stranger');
  assert.ok(!bot.handled.some((h) => h.from === stranger));
  bot.close();
});
