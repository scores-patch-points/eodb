// tcp.mjs: a direct TCP channel for headless (Node) peers. One side listens, the other connects, and directCarrier/directServer
// (app/direct.mjs) run list/get/putNew straight over the socket — no relay, no HTTP. Messages are length-prefixed UTF-8 frames
// (4-byte big-endian length). Node-only: the browser's direct transport is WebRTC (direct.mjs webrtcChannel).
import net from 'node:net';
import { directCarrier } from './direct.mjs';

function channelOverSocket(socket) {
  let buf = Buffer.alloc(0), onMsg = null;
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
