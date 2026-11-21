// A direct TCP link between two peers: list/get/putNew straight over a socket, no relay, and sealed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tcpServer, tcpChannel, directAdapter } from '../tcp.mjs';
import { directCarrier, directServer } from '../direct.mjs';
import { sealedCarrier, importKey, newSpaceKey } from '../net.mjs';

test('1. a direct TCP link round-trips list/get/putNew', async () => {
  const store = new Map();
  const server = await tcpServer({ port: 0 }, (ch) => directServer(ch, store));
  const c = directCarrier(await tcpChannel('127.0.0.1', server.port));

  assert.deepEqual(await c.list(), []);
  const bytes = new TextEncoder().encode('direct over tcp');
  await c.putNew('a/000001-1-abcdef12.seg', bytes);
  assert.deepEqual(await c.list(), ['a/000001-1-abcdef12.seg']);
  assert.deepEqual(await c.get('a/000001-1-abcdef12.seg'), bytes);
  assert.equal(await c.get('missing'), null);
  await server.close(); c.close();
});

test('2. the direct TCP link is sealed: the serving side holds only ciphertext', async () => {
  const store = new Map();
  const server = await tcpServer({ port: 0 }, (ch) => directServer(ch, store));
  const key = await importKey(newSpaceKey());
  const inner = directCarrier(await tcpChannel('127.0.0.1', server.port));
  const c = sealedCarrier(inner, key);
  const secret = new TextEncoder().encode('SECRET-OVER-TCP');
  await c.putNew('blob/s', secret);
  assert.deepEqual(await c.get('blob/s'), secret, 'decrypts back');
  assert.ok(!Buffer.from(store.get('blob/s')).toString('latin1').includes('SECRET'), 'ciphertext only');
  await server.close(); inner.close();
});

test('3. the direct adapter parses direct:tcp:// and one server serves many peers', async () => {
  const store = new Map();
  const server = await tcpServer({ port: 0 }, (ch) => directServer(ch, store));
  const c1 = await directAdapter(`direct:tcp://127.0.0.1:${server.port}`);
  const c2 = await directAdapter(`direct:tcp://127.0.0.1:${server.port}`);
  await c1.putNew('x/1', new TextEncoder().encode('from c1'));
  assert.deepEqual(await c2.list(), ['x/1']);
  assert.deepEqual(await c2.get('x/1'), new TextEncoder().encode('from c1'));
  await assert.rejects(directAdapter('direct:webrtc:foo'), /unknown direct transport/);
  await server.close(); c1.close(); c2.close();
});
