// peek.mjs: dev tool — open a space read-only and print its role, peers and workspace names, so you can see what a
// headless node holds without disturbing it.   node app/peek.mjs <dir> <passphrase>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSpace } from './engine.mjs';
import { fsBackend } from './fs-backend.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cells = JSON.parse(fs.readFileSync(path.join(here, 'vendor', 'pharos', 'cells.json'), 'utf8'));
const [dir, pass] = process.argv.slice(2);
if (!dir || !pass) { console.error('usage: node app/peek.mjs <dir> <passphrase>'); process.exit(2); }
const sp = await openSpace({ name: 'eodb', backend: fsBackend(path.join(dir, 'store')), blobBackend: fsBackend(path.join(dir, 'blobs')), cells, passphrase: pass, iterations: 1000, autosync: false });
process.stdout.write(JSON.stringify({ role: sp.role, peers: sp.peers(), workspaces: sp.view().filter((e) => e.op === 'ws+').map((e) => e.body.name) }) + '\n');
sp.close();
