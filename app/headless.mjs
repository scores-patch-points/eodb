// headless.mjs: run a space as a headless node — no browser, no UI, durable and encrypted at rest (passphrase), syncing over
// HTTPS routes. SSH is only for installing/starting this; the data itself moves over HTTPS (the carriers). A node founds a space
// (or joins one), then keeps syncing until stopped; its share (routes + identity) is persisted, so a restart resumes in place.
//
//   node app/headless.mjs --dir /var/lib/eodb --passphrase "$PW" --routes relay:https://relay.example      # found + share
//   node app/headless.mjs --dir /var/lib/eodb --passphrase "$PW" --join "eodb-join:1:…"                    # join an existing space
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSpace } from './engine.mjs';
import { fsBackend } from './fs-backend.mjs';
import { directAdapter, reticulumAdapter, lxmfAdapterVia } from './tcp.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cells = JSON.parse(fs.readFileSync(path.join(here, 'vendor', 'pharos', 'cells.json'), 'utf8'));
const names = JSON.parse(fs.readFileSync(path.join(here, 'vendor', 'node-names.json'), 'utf8'));

const argv = process.argv.slice(2);
const flags = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) { const k = a.slice(2); const nxt = argv[i + 1]; if (nxt === undefined || nxt.startsWith('--')) flags[k] = true; else { flags[k] = nxt; i++; } continue; }
}

const dir = flags.dir || process.env.EODB_DIR || '.';
const passphrase = flags.passphrase || process.env.EODB_PASSPHRASE;
if (!passphrase) { console.error('headless node needs a passphrase (--passphrase or $EODB_PASSPHRASE)'); process.exit(2); }
const routes = (flags.routes ? String(flags.routes).split(',') : []).map((r) => r.trim()).filter(Boolean);

const space = await openSpace({
  name: flags.name || 'eodb',
  backend: fsBackend(path.join(dir, 'store')),
  blobBackend: fsBackend(path.join(dir, 'blobs')),
  cells, names, passphrase,
  join: flags.join || undefined,
  autosync: true, syncMs: Number(flags.syncMs || 5000),
  // Node-only routes: direct:tcp://host:port, reticulum:<destination hash>, lxmf:<address>?tag=<hex> (through THIS node's own LXMF daemon)
  adapters: { direct: directAdapter, reticulum: reticulumAdapter, lxmf: lxmfAdapterVia(String(flags['lxmf-bridge'] || process.env.EODB_LXMF_BRIDGE || '127.0.0.1:7772')) },
});

if (space.role !== 'guest' && routes.length) {
  const link = await space.share({ routes });
  process.stdout.write(JSON.stringify({ role: space.role, link, routes }) + '\n');
} else {
  process.stdout.write(JSON.stringify({ role: space.role, peers: space.peers() }) + '\n');
}

// optional: write one identifying entry so the exchange is visible (e.g. --note "hello from hyphae-secure")
if (flags.note) { space.append('ws+', { id: `w:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 6)}`, name: String(flags.note) }); await space.settle(); await space.syncOnce(); }

space.onStatus(() => { const s = space.report().share; if (s) process.stdout.write(JSON.stringify({ routes: s.routes, routesUp: s.routesUp, last: s.last, error: s.error, quarantined: s.quarantined }) + '\n'); });

// remote control from Sideband or any LXMF client: --lxmf-bot --bot-allow <lxmf address>[,<address>...]  (silent to everyone not on the list)
if (flags['lxmf-bot']) {
  const { startLxmfBot } = await import('./lxmf-bot.mjs');
  const bot = await startLxmfBot(space, { bridge: String(flags['lxmf-bridge'] || process.env.EODB_LXMF_BRIDGE || '127.0.0.1:7772'), allow: String(flags['bot-allow'] || '').split(',') });
  process.stdout.write(JSON.stringify({ lxmfBot: bot.address }) + '\n');
}

// stigmergic worker: no one schedules anything. On each pass the node syncs with its peers, claims any due poll/schedule
// trigger or unhandled webhook event, runs the automation, and publishes the run (and every node result) back as entries.
// Any number of devices can do this; the claims in the shared log are the coordination.
if (flags.worker) {
  const { workerPass } = await import('./worker.mjs');
  const ms = Number(flags['worker-ms'] || 30_000);
  const pass = async () => {
    try { const r = await workerPass(space, {}); if (r.poll.length || r.events.length || r.errors.length) process.stdout.write(JSON.stringify({ pass: r }) + '\n'); }
    catch (e) { process.stderr.write('worker pass: ' + (e && e.message || e) + '\n'); }
  };
  await pass();
  setInterval(pass, ms);
}

const stop = () => { space.close(); process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
await new Promise(() => {});
