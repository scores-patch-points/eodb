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

const here = path.dirname(fileURLToPath(import.meta.url));
const cells = JSON.parse(fs.readFileSync(path.join(here, 'vendor', 'pharos', 'cells.json'), 'utf8'));

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
  cells, passphrase,
  join: flags.join || undefined,
  autosync: true, syncMs: Number(flags.syncMs || 5000),
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

const stop = () => { space.close(); process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
await new Promise(() => {});
