// opencode.mjs: the browser driver against a real HTTP+SSE server with Basic auth (a mock standing in for opencode).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { info, createSession, prompt, chat } from '../opencode.mjs';

const USER = 'opencode', PASS = 'pw';
const auth = (req) => req.headers.authorization === 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64');
const sse = (res, obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

function server() {
  let prompted = false;
  const s = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (!auth(req)) { res.writeHead(401); return res.end(JSON.stringify({ _tag: 'UnauthorizedError', message: 'Authentication required' })); }
    if (u.pathname === '/api/info') return res.end(JSON.stringify({ version: '2.0.29' }));
    if (u.pathname === '/api/session' && req.method === 'POST') return res.end(JSON.stringify({ id: 'sess1' }));
    if (u.pathname === '/api/session/sess1/prompt' && req.method === 'POST') { prompted = true; res.end(JSON.stringify({})); return; }
    if (u.pathname === '/api/event') {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      sse(res, { type: 'server.connected', data: {} });
      const iv = setInterval(() => {
        if (!prompted) return;
        clearInterval(iv);
        sse(res, { type: 'session.text.delta', data: { sessionID: 'sess1', assistantMessageID: 'm1', ordinal: 0, delta: 'Hello' } });
        sse(res, { type: 'session.text.delta', data: { sessionID: 'sess1', assistantMessageID: 'm1', ordinal: 1, delta: ' world' } });
        sse(res, { type: 'session.idle', data: { sessionID: 'sess1' } });
        res.end();
      }, 10);
      res.on('close', () => clearInterval(iv));
      return;
    }
    res.writeHead(404); res.end();
  });
  return new Promise((r) => s.listen(0, '127.0.0.1', () => r(s)));
}
const shutdown = (s) => { s.closeAllConnections ? s.closeAllConnections() : null; return new Promise((r) => s.close(r)); };

test('auth, createSession and prompt round-trip', async () => {
  const s = await server();
  const cfg = { url: `http://127.0.0.1:${s.address().port}`, username: USER, password: PASS };
  const i = await info(cfg);
  assert.equal(i.version, '2.0.29');
  const sess = await createSession(cfg, { cwd: '.' });
  assert.equal(sess.id, 'sess1');
  await prompt(cfg, 'sess1', 'hi');
  await shutdown(s);
});

test('chat() streams text deltas for the session and resolves on idle', async () => {
  const s = await server();
  const cfg = { url: `http://127.0.0.1:${s.address().port}`, username: USER, password: PASS };
  const deltas = [];
  const r = await chat(cfg, 'sess1', 'say hi', { onDelta: (d) => deltas.push(d) });
  assert.equal(r.text, 'Hello world');
  assert.equal(r.sessionId, 'sess1');
  assert.deepEqual(deltas, ['Hello', ' world']);
  await shutdown(s);
});

test('wrong password is rejected', async () => {
  const s = await server();
  const cfg = { url: `http://127.0.0.1:${s.address().port}`, username: USER, password: 'nope' };
  await assert.rejects(createSession(cfg, { cwd: '.' }), /Authentication required/);
  await shutdown(s);
});
