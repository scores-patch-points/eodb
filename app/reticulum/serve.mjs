// serve.mjs: make this machine reachable over Reticulum as an eodb store (the Reticulum counterpart of relay.mjs).
//   node app/reticulum/serve.mjs [--rns-config DIR] [--identity FILE] [--allow HEX]...
// It starts a create-only store on loopback and the bridge in `serve` mode piping each Link into it, then prints the route to put in a share
// link: reticulum:<destination hash>. The store holds only sealed bytes (as any relay does) and is in memory: a restart empties it.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tcpServer } from '../tcp.mjs';
import { directServer } from '../direct.mjs';

const argv = process.argv.slice(2);
const store = new Map();
const server = await tcpServer({ port: 0 }, (ch) => directServer(ch, store));
const py = process.env.EODB_RNS_PYTHON || 'python3';
const bridge = path.join(path.dirname(fileURLToPath(import.meta.url)), 'bridge.py');
const child = spawn(py, [bridge, 'serve', '--target', `127.0.0.1:${server.port}`, ...argv], { stdio: ['ignore', 'pipe', 'inherit'] });
child.stdout.on('data', (d) => { const h = String(d).trim(); process.stdout.write(JSON.stringify({ route: `reticulum:${h}` }) + '\n'); });
child.on('exit', (code) => { server.close(); process.exit(code ?? 1); });
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => child.kill());
