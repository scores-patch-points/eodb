// The direct P2P carrier: two nodes talk list/get/putNew straight over a channel (no relay), and the bytes stay sealed.
// The in-memory channel pair exercises the exact same code path a WebRTC/TCP channel would.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { directCarrier, directServer, memoryChannelPair, webrtcChannel } from '../direct.mjs';
import { sealedCarrier, importKey, newSpaceKey } from '../net.mjs';

test('1. a direct carrier round-trips list/get/putNew over a channel', async () => {
  const [a, b] = memoryChannelPair();
  const store = new Map();
  directServer(b, store);
  const c = directCarrier(a);

  assert.deepEqual(await c.list(), []);
  const bytes = new TextEncoder().encode('hello from peer A');
  await c.putNew('a/000001-1-abcdef12.seg', bytes);
  assert.deepEqual(await c.list(), ['a/000001-1-abcdef12.seg']);
  assert.deepEqual(await c.get('a/000001-1-abcdef12.seg'), bytes);
  assert.equal(await c.get('missing'), null, 'unknown object is null, not an error');
});

test('2. putNew is create-only: same bytes is a no-op, different bytes is refused', async () => {
  const [a, b] = memoryChannelPair();
  directServer(b, new Map());
  const c = directCarrier(a);
  const bytes = new TextEncoder().encode('x');
  await c.putNew('n/1', bytes);
  await c.putNew('n/1', bytes);   // idempotent
  await assert.rejects(c.putNew('n/1', new TextEncoder().encode('y')), /never overwrite/);
});

test('3. the direct link is sealed: the serving side holds only ciphertext', async () => {
  const [a, b] = memoryChannelPair();
  const store = new Map();
  directServer(b, store);
  const key = await importKey(newSpaceKey());
  const c = sealedCarrier(directCarrier(a), key);   // the exact wrapper the engine uses for every transport

  const secret = new TextEncoder().encode('TOP-SECRET-OVER-A-DIRECT-LINK');
  await c.putNew('blob/secret', secret);
  assert.deepEqual(await c.get('blob/secret'), secret, 'decrypts back to the plaintext');
  const stored = Buffer.from(store.get('blob/secret')).toString('latin1');
  assert.ok(!stored.includes('TOP-SECRET'), 'the serving side only ever saw sealed bytes');
});

test('4. the webrtc channel is browser-only and refuses to run in Node', async () => {
  assert.throws(() => webrtcChannel({}), /browser only/);
});
