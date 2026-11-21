// direct.mjs: a peer-to-peer carrier — list / get / putNew over a direct, bidirectional channel between two nodes, so they can
// sync without a relay. Portable (no node built-ins). The channel is just { send(text), onMessage(cb), close() }; concrete
// transports provide it: webrtcChannel below (browser), or a TCP/WebSocket socket in a Node host. Sealing is layered on top by
// the caller (sealedCarrier), so a direct link is as secure as any relay link — the bytes are AES-GCM ciphertext either way.
//
//   const c = directCarrier(channel);                       // one side
//   directServer(otherChannel, store);                      // the other side (store = Map of name -> Uint8Array)
//   c.list() / c.get(name) / c.putNew(name, bytes)          // the usual carrier contract, over JSON-RPC messages

const b64e = (u8) => { let s = ''; for (const b of u8) s += String.fromCharCode(b); return btoa(s); };
const b64d = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/** the carrier side: turns a channel into list/get/putNew. */
export function directCarrier(channel) {
  let next = 0; const pending = new Map();
  channel.onMessage((text) => { let m; try { m = JSON.parse(text); } catch { return; } const p = pending.get(m.i); if (p) { pending.delete(m.i); p(m); } });
  const rpc = (req) => new Promise((res, rej) => { const i = ++next; pending.set(i, (m) => m.t === 'err' ? rej(Object.assign(new Error(m.m), { code: m.c })) : res(m)); channel.send(JSON.stringify({ i, ...req })); });
  return {
    channel,
    async list() { const m = await rpc({ t: 'list' }); return m.v; },
    async get(name) { const m = await rpc({ t: 'get', n: name }); return m.t === 'none' ? null : b64d(m.b); },
    async putNew(name, bytes) {
      const m = await rpc({ t: 'put', n: name, b: b64e(bytes) });
      if (m.t === 'exists') throw Object.assign(new Error(`${name} exists; carriers never overwrite`), { code: 'EXISTS' });
      if (m.t !== 'ok') throw new Error(m.m || 'put failed');
    },
    close: () => channel.close(),
  };
}

/** the serving side: answers list/get/putNew from a local Map (create-only put). */
export function directServer(channel, store = new Map()) {
  channel.onMessage((text) => {
    let m; try { m = JSON.parse(text); } catch { return; }
    const reply = (resp) => channel.send(JSON.stringify({ i: m.i, ...resp }));
    if (m.t === 'list') reply({ t: 'names', v: [...store.keys()].sort() });
    else if (m.t === 'get') { const b = store.get(m.n); reply(b === undefined ? { t: 'none' } : { t: 'bytes', b: b64e(b) }); }
    else if (m.t === 'put') {
      const bytes = b64d(m.b), had = store.get(m.n);
      if (had !== undefined) reply(same(had, bytes) ? { t: 'ok' } : { t: 'exists' });
      else { store.set(m.n, bytes); reply({ t: 'ok' }); }
    }
  });
  return { store, close: () => channel.close() };
}

/** two ends of an in-process channel, wired back to back (for tests and single-process use). */
export function memoryChannelPair() {
  let aHandler = null, bHandler = null;
  const a = { send: (m) => bHandler && bHandler(m), onMessage: (cb) => { aHandler = cb; }, close() {} };
  const b = { send: (m) => aHandler && aHandler(m), onMessage: (cb) => { bHandler = cb; }, close() {} };
  return [a, b];
}

// ---- a WebRTC DataChannel, made to look like a channel (browser only; RTCPeerConnection is native there) -----------------
// `signaler` is any two-way JSON pipe to the other peer (a shared WebSocket, a relay endpoint, a Matrix room, or copy-paste):
//   signaler.send(obj) / signaler.onMessage(cb). It carries {offer} | {answer} | {candidate}. One side passes initiator:true.
export function webrtcChannel({ signaler, initiator = true, config = {} }) {
  if (typeof globalThis.RTCPeerConnection !== 'function') throw new Error('webrtc: RTCPeerConnection is not available here (browser only)');
  return new Promise((resolve, reject) => {
    const pc = new RTCPeerConnection(config);
    const timeout = setTimeout(() => reject(new Error('webrtc: negotiation timed out')), 30000);
    let dc = null;
    const finish = () => {
      const ch = {
        send: (t) => dc.send(t),
        onMessage: (cb) => { dc.onmessage = (e) => cb(String(e.data)); },
        close: () => { clearTimeout(timeout); pc.close(); },
      };
      if (dc.readyState === 'open') { clearTimeout(timeout); resolve(ch); } else dc.onopen = () => { clearTimeout(timeout); resolve(ch); };
    };
    pc.onicecandidate = (e) => { if (e.candidate) signaler.send({ candidate: e.candidate }); };
    signaler.onMessage(async (m) => {
      try {
        if (m.offer) { await pc.setRemoteDescription(m.offer); const ans = await pc.createAnswer(); await pc.setLocalDescription(ans); signaler.send({ answer: ans }); }
        else if (m.answer) { await pc.setRemoteDescription(m.answer); }
        else if (m.candidate) { await pc.addIceCandidate(m.candidate); }
      } catch { /* a redundant candidate or a restart is ignored */ }
    });
    pc.ondatachannel = (e) => { dc = e.channel; finish(); };
    if (initiator) { dc = pc.createDataChannel('eodb'); finish(); (async () => { const offer = await pc.createOffer(); await pc.setLocalDescription(offer); signaler.send({ offer }); })(); }
  });
}
