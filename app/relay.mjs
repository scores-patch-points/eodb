// relay.mjs: a blind object store for a space's encrypted segments. It speaks three calls (list, get, create-only put), keeps bytes in memory, and has no idea
// what they are: clients seal everything before it arrives. A demo and test relay: nothing persists, and CORS is open so any page may use it. Any server that
// offers the same three calls can take its place; the share link carries the address, not this code.
//   node app/relay.mjs [port] [host]
import http from 'node:http';

export function startRelay({ port = 0, host = '127.0.0.1', maxBytes = 8 * 1024 * 1024 } = {}) {
  const store = new Map();
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, PUT, OPTIONS', 'access-control-allow-headers': '*', 'access-control-max-age': '600' };
  const server = http.createServer((req, res) => {
    const send = (code, body, type = 'text/plain') => { res.writeHead(code, { ...cors, 'content-type': type }); res.end(body); };
    if (req.method === 'OPTIONS') return send(204, '');
    const u = new URL(req.url, 'http://x');
    if (req.method === 'GET' && u.pathname === '/health') return send(200, 'ok');
    if (req.method === 'GET' && u.pathname === '/o') return send(200, JSON.stringify([...store.keys()]), 'application/json');
    const m = /^\/o\/(.+)$/.exec(u.pathname); if (!m) return send(404, 'not found');
    const name = decodeURIComponent(m[1]);
    if (req.method === 'GET') { const b = store.get(name); return b ? send(200, b, 'application/octet-stream') : send(404, 'no such object'); }
    if (req.method === 'PUT') {
      const chunks = []; let n = 0; let dead = false;
      req.on('data', (c) => { n += c.length; if (n > maxBytes) { dead = true; send(413, 'too large'); req.destroy(); } else chunks.push(c); });
      req.on('end', () => {
        if (dead) return; const body = Buffer.concat(chunks), have = store.get(name);
        if (have) return Buffer.compare(have, body) === 0 ? send(200, 'same') : send(409, 'exists with different bytes');
        store.set(name, body); send(201, 'created');
      });
      return;
    }
    send(405, 'method not allowed');
  });
  return new Promise((resolve) => server.listen(port, host, () => resolve({ server, store, url: `http://${host}:${server.address().port}`, close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }) })));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await startRelay({ port: Number(process.argv[2] || 8853), host: process.argv[3] || '127.0.0.1' });
  console.log(`blind relay listening on ${r.url} (memory only; stores sealed bytes, never reads them)`);
}
