// bench-video.mjs: send real H.264 clips through a space over the reticulum: route and, as the control, over direct:tcp (same carrier code, no Reticulum).
// For each clip: founder adds the file and publishes; a joiner syncs until the file is present; we check the bytes hash back, that ffmpeg decodes the
// received copy with no error, and we time it. "Streaming" here is measured, not assumed: eodb moves a file as ONE sealed object, so playback can start
// only after the whole object has arrived. realtime = clip seconds / seconds to arrive (>1 means it arrived faster than it plays).
//   EODB_RNS_PYTHON=<python with rns> node app/reticulum/bench-video.mjs [seconds,kbps ...]
// Needs ffmpeg/ffprobe. One machine, Reticulum over a loopback TCP interface: says nothing about radio.
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSpace } from '../engine.mjs';
import { tcpServer, reticulumAdapter, directAdapter } from '../tcp.mjs';
import { directServer } from '../direct.mjs';
import * as B from '../vendor/pharos/browser-store.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const py = process.env.EODB_RNS_PYTHON || 'python3';
const cells = JSON.parse(fs.readFileSync(path.join(here, '..', 'vendor', 'pharos', 'cells.json'), 'utf8'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eodb-video-'));
const clips = (process.argv.slice(2).length ? process.argv.slice(2) : ['10,800', '30,2000', '60,2000', '120,2000']).map((s) => s.split(',').map(Number));
const procs = [];
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const freePort = () => new Promise((res) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const firstLine = (proc) => new Promise((res, rej) => { let buf = ''; proc.stdout.on('data', (d) => { buf += d; const i = buf.indexOf('\n'); if (i >= 0) res(buf.slice(0, i).trim()); }); proc.on('exit', (c) => rej(new Error('bridge exited ' + c))); });
const rnsConfig = (dir, iface) => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'config'), `[reticulum]\n  enable_transport = False\n  share_instance = No\n[interfaces]\n  [[link]]\n    enabled = yes\n${iface}\n`); return dir; };

function makeClip(secs, kbps) {
  const f = path.join(tmp, `clip-${secs}s-${kbps}k.mp4`);
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `testsrc2=size=640x360:rate=25:duration=${secs}`, '-f', 'lavfi', '-i', `sine=frequency=440:duration=${secs}`,
    '-c:v', 'libx264', '-b:v', `${kbps}k`, '-maxrate', `${kbps}k`, '-bufsize', `${kbps * 2}k`, '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', '-shortest', f]);
  if (r.status !== 0) throw new Error('ffmpeg: ' + r.stderr);
  return f;
}
const decodes = (file) => { const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'null', '-']); return r.status === 0 && String(r.stderr).trim() === ''; };
const duration = (file) => Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).stdout);

async function startReticulum() {
  const wire = await freePort(), store = new Map();
  const target = await tcpServer({ port: 0 }, (ch) => directServer(ch, store));
  const serve = spawn(py, [path.join(here, 'bridge.py'), 'serve', '--rns-config', rnsConfig(path.join(tmp, 'rns-a'), `    type = TCPServerInterface\n    listen_ip = 127.0.0.1\n    listen_port = ${wire}`), '--target', `127.0.0.1:${target.port}`], { stdio: ['ignore', 'pipe', 'ignore'] }); procs.push(serve);
  const dest = await firstLine(serve), bport = await freePort();
  const conn = spawn(py, [path.join(here, 'bridge.py'), 'connect', '--rns-config', rnsConfig(path.join(tmp, 'rns-b'), `    type = TCPClientInterface\n    target_host = 127.0.0.1\n    target_port = ${wire}`), '--listen', `127.0.0.1:${bport}`], { stdio: ['ignore', 'pipe', 'ignore'] }); procs.push(conn);
  await firstLine(conn);
  return { route: `reticulum:${dest}?bridge=127.0.0.1:${bport}`, close: () => target.close() };
}
async function startDirect() { const store = new Map(); const s = await tcpServer({ port: 0 }, (ch) => directServer(ch, store)); return { route: `direct:tcp://127.0.0.1:${s.port}`, close: () => s.close() }; }

async function runOne(kind, file) {
  const bytes = new Uint8Array(fs.readFileSync(file)), h = sha(bytes);
  const net0 = kind === 'reticulum' ? await startReticulum() : await startDirect();
  const adapters = { reticulum: reticulumAdapter, direct: directAdapter };
  const mk = () => ({ backend: B.memoryBackend(), blobBackend: B.memoryBackend() });
  const A = await openSpace({ name: 'eodb', ...mk(), cells, autosync: false, adapters });
  A.append('ws+', { id: 'w1', name: 'video' });
  A.blobs.put(h, bytes, 'video/mp4'); A.append('file+', { ws: 'w1', hash: h, name: path.basename(file), size: bytes.length, type: 'video/mp4', at: 'now' });
  const t0 = performance.now();
  const link = await A.share({ routes: [net0.route] }); await A.settle(); await A.syncOnce();
  const tPub = performance.now();
  const J = await openSpace({ name: 'eodb', ...mk(), cells, autosync: false, join: link, adapters });
  let got = null; const deadline = Date.now() + 300000;
  while (!got && Date.now() < deadline) { await J.syncOnce(); await J.settle(); got = J.blobs.get(h); }
  const tGot = performance.now();
  A.close(); J.close(); await net0.close();
  if (!got) return { kind, error: 'file never arrived' };
  const out = path.join(tmp, `recv-${kind}-${path.basename(file)}`); fs.writeFileSync(out, got.bytes);
  return { kind, sameBytes: sha(got.bytes) === h, decodes: decodes(out), publishS: (tPub - t0) / 1000, arriveS: (tGot - tPub) / 1000 };
}

const rows = [];
try {
  for (const [secs, kbps] of clips) {
    const f = makeClip(secs, kbps), size = fs.statSync(f).size, dur = duration(f);
    for (const kind of ['direct', 'reticulum']) {
      let r; try { r = await runOne(kind, f); } catch (e) { r = { kind, error: String(e.message || e) }; }
      const row = { clip: `${secs}s@${kbps}k`, MB: +(size / 1e6).toFixed(2), playS: +dur.toFixed(1), ...r };
      if (r.arriveS) { row.MBps = +(size / 1e6 / r.arriveS).toFixed(2); row.realtime = +(dur / r.arriveS).toFixed(1); row.publishS = +r.publishS.toFixed(2); row.arriveS = +r.arriveS.toFixed(2); }
      rows.push(row); process.stdout.write(JSON.stringify(row) + '\n');
    }
  }
} finally { for (const p of procs) p.kill(); await new Promise((r) => setTimeout(r, 500)); fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
process.exit(rows.every((r) => r.sameBytes && r.decodes) ? 0 : 1);
