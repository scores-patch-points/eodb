// tcp.mjs: a direct TCP channel for headless (Node) peers. One side listens, the other connects, and directCarrier/directServer
// (app/direct.mjs) run list/get/putNew straight over the socket — no relay, no HTTP. Messages are length-prefixed UTF-8 frames
// (4-byte big-endian length). Node-only: the browser's direct transport is WebRTC (direct.mjs webrtcChannel).
import net from 'node:net';
import { directCarrier } from './direct.mjs';
import { chunkedCarrier } from './net.mjs';

function channelOverSocket(socket) {
  let buf = Buffer.alloc(0), onMsg = null, onEnd = null, ended = false;
  // a reset or a dead peer must not crash the process (an unhandled 'error' on a socket does): it ends the channel, and the carrier fails its pending calls
  socket.on('error', () => {});
  socket.on('close', () => { ended = true; if (onEnd) onEnd(); });
  socket.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      if (buf.length < 4) break;
      const len = buf.readUInt32BE(0);
      if (buf.length < 4 + len) break;
      const text = buf.toString('utf8', 4, 4 + len);
      buf = buf.subarray(4 + len);
      if (onMsg) onMsg(text);
    }
  });
  return {
    send(text) { const b = Buffer.from(text, 'utf8'); const h = Buffer.alloc(4); h.writeUInt32BE(b.length, 0); socket.write(Buffer.concat([h, b])); },
    onMessage(cb) { onMsg = cb; },
    onClose(cb) { onEnd = cb; if (ended) cb(); },
    close() { socket.destroy(); },
  };
}

/** listen and hand each connection's channel to `onChannel(channel)`. Resolves { port, close }. */
export function tcpServer({ port = 0, host = '127.0.0.1' } = {}, onChannel) {
  return new Promise((resolve, reject) => {
    const sockets = new Set();
    const server = net.createServer((socket) => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); onChannel(channelOverSocket(socket)); });
    server.once('error', reject);
    server.listen(port, host, () => resolve({ port: server.address().port, close: () => new Promise((r) => { for (const s of sockets) s.destroy(); server.close(() => r()); }) }));
  });
}

/** connect to a peer's direct listener and return its channel. */
export function tcpChannel(host, port) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port });
    socket.once('error', reject);
    socket.once('connect', () => resolve(channelOverSocket(socket)));
  });
}

/** a `direct:` route adapter (Node): `direct:tcp://host:port` connects and returns a directCarrier. */
export async function directAdapter(uri) {
  const rest = uri.slice('direct:'.length);
  if (rest.startsWith('tcp://')) {
    const u = new URL(rest);
    return directCarrier(await tcpChannel(u.hostname, Number(u.port || 8854)));
  }
  throw new Error(`unknown direct transport "${rest}" (tcp:// only in Node)`);
}

const rnsLinks = new Map();   // route -> Promise<carrier>: the engine asks for a carrier on every sync pass; a Reticulum Link is costly to set up, so one is kept per route
const RNS_CALL_MS = 120000;  // a call on a slow radio path may take minutes; past this the Link is treated as dead and re-dialed on the next pass

/** a `reticulum:` route adapter (Node): `reticulum:<32 hex destination hash>[?bridge=host:port]`. The address is the hash of a key, not a place:
 *  no IP, no DNS. The adapter speaks only to a LOCAL bridge (app/reticulum/bridge.py connect), which holds the Reticulum side; it sends one
 *  `dial` frame, waits for `up`, and from then on the socket is an ordinary direct channel. Without a bridge it fails with a message that says how to start one. */
export function reticulumAdapter(uri) {
  if (!rnsLinks.has(uri)) {
    const p = dialReticulum(uri);
    rnsLinks.set(uri, p);
    p.catch(() => rnsLinks.delete(uri));
  }
  const inner = rnsLinks.get(uri);
  const call = async (fn) => {
    const c = await inner;
    let t;
    try { return await Promise.race([fn(c), new Promise((_, rej) => { t = setTimeout(() => rej(new Error('reticulum: no answer over the link')), RNS_CALL_MS); })]); }
    catch (e) { if (rnsLinks.get(uri) === inner) rnsLinks.delete(uri); try { c.close(); } catch {} throw e; }
    finally { clearTimeout(t); }
  };
  // Objects cross in parts of at most `mtu` bytes (default 1 MiB): the bridge refuses frames over 16 MiB (a memory guard), and a whole video in one frame
  // would exceed it (measured: a 15.7 MB clip never arrived). Parts are cut from the SEALED object (the engine seals above this), so each part is ciphertext.
  const mtu = Math.max(1024, Number(new URLSearchParams(uri.split('?')[1] || '').get('mtu')) || 1 << 20);
  return inner.then(() => chunkedCarrier({ list: () => call((c) => c.list()), get: (n) => call((c) => c.get(n)), putNew: (n, b) => call((c) => c.putNew(n, b)) }, { mtu }));
}

async function dialReticulum(uri) {
  const [dest, q] = uri.slice('reticulum:'.length).split('?');
  if (!/^[0-9a-f]{32}$/.test(dest)) throw new Error('reticulum route needs a 32-hex destination hash: reticulum:<hash>[?bridge=host:port]');   // regex-ok: a hash, not language
  const bridge = new URLSearchParams(q || '').get('bridge') || process.env.EODB_RNS_BRIDGE || '127.0.0.1:7770';
  const [host, port] = bridge.split(':');
  let ch;
  try { ch = await tcpChannel(host, Number(port)); }
  catch (e) { throw new Error(`reticulum: no bridge at ${bridge}. Start one: python3 app/reticulum/bridge.py connect --listen ${bridge} (pip install rns). ${e.message}`); }
  const reply = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('reticulum: the bridge did not answer the dial')), 45000);
    ch.onMessage((text) => { clearTimeout(t); try { resolve(JSON.parse(text)); } catch (e) { reject(e); } });
    ch.send(JSON.stringify({ t: 'dial', dest }));
  }).catch((e) => { ch.close(); throw e; });
  if (reply.t !== 'up') { ch.close(); throw new Error(`reticulum: ${reply.m || 'dial refused'}`); }
  return directCarrier(ch);
}
