// serve.mjs /oc proxy: forwards to the OpenCode server with auth injected, so a phone reaches opencode through the app's one origin.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const USER = 'opencode', PASS = 'pw';
const auth = (req) => req.headers.authorization === 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64');

function mockOpenCode() {
  const s = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/api/session' && req.method === 'POST') {
      if (!auth(req)) { res.writeHead(401); return res.end('{}'); }
      res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ id: 'sess1', viaProxy: true }));
    }
    if (u.pathname === '/api/info') return res.end(JSON.stringify({ version: '2.0.29', authed: auth(req) }));
    res.writeHead(404); res.end();
  });
  return new Promise((r) => s.listen(0, '127.0.0.1', () => r(s)));
}
const listen = (srv) => new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
const shutdown = (s) => { s.closeAllConnections ? s.closeAllConnections() : null; return new Promise((r) => s.close(r)); };

test('the /oc proxy forwards to opencode and injects Basic auth (same-origin, no CORS)', async () => {
  const oc = await mockOpenCode();
  process.env.EODB_OPENCODE_URL = `http://127.0.0.1:${oc.address().port}`;
  process.env.EODB_OPENCODE_PASSWORD = PASS;
  const { server } = await import('../serve.mjs');
  const port = await listen(server);

  const info = await (await fetch(`http://127.0.0.1:${port}/oc/api/info`)).json();
  assert.equal(info.authed, true, 'the proxy injected Basic auth');
  const sess = await (await fetch(`http://127.0.0.1:${port}/oc/api/session`, { method: 'POST' })).json();
  assert.equal(sess.id, 'sess1');
  assert.equal(sess.viaProxy, true);

  await shutdown(server); await shutdown(oc);
  delete process.env.EODB_OPENCODE_URL; delete process.env.EODB_OPENCODE_PASSWORD;
});
