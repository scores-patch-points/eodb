// net.mjs: how a space reaches other browsers. Two pieces, both small:
//   httpCarrier(url)        list / get / putNew against a blind relay (relay.mjs), the carrier interface the pharos sync code already uses
//   sealedCarrier(c, key)   everything put on the carrier is AES-256-GCM encrypted first, bound to its object name; what comes back is decrypted and
//                           checked. The relay (or whoever runs it) sees object names, sizes and timing, never contents.
// Nothing here names or assumes a particular server: the relay address is data in the share link.
const te = new TextEncoder();
const httpErr = (r, what) => Object.assign(new Error(`relay ${what} failed: ${r.status}`), { status: r.status });

export function httpCarrier(base) {
  const url = (p) => base.replace(/\/+$/, '') + p;
  return {
    async list() { const r = await fetch(url('/o')); if (!r.ok) throw httpErr(r, 'list'); return r.json(); },
    async get(name) { const r = await fetch(url('/o/' + encodeURIComponent(name))); if (r.status === 404) return null; if (!r.ok) throw httpErr(r, 'get'); return new Uint8Array(await r.arrayBuffer()); },
    async putNew(name, bytes) {
      const r = await fetch(url('/o/' + encodeURIComponent(name)), { method: 'PUT', body: bytes });
      if (r.status === 409) throw Object.assign(new Error(`${name} exists with different bytes; carriers never overwrite`), { status: 409 });
      if (!r.ok) throw httpErr(r, 'put');
    },
  };
}

export const importKey = (hex) => globalThis.crypto.subtle.importKey('raw', Uint8Array.from(hex.match(/../g), (x) => parseInt(x, 16)), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
export const newSpaceKey = () => [...globalThis.crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('');

export function sealedCarrier(inner, key) {
  return {
    inner,
    list: () => inner.list(),
    async get(name) {
      const sealed = await inner.get(name); if (!sealed) return null;
      try { return new Uint8Array(await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.slice(0, 12), additionalData: te.encode(`eodb-seg/1|${name}`) }, key, sealed.slice(12))); }
      catch (err) { return null; } // wrong key, tampered, or moved to another name: unreadable, reported by the caller as such
    },
    async putNew(name, bytes) {
      const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
      const ct = new Uint8Array(await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: te.encode(`eodb-seg/1|${name}`) }, key, bytes));
      const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12);
      return inner.putNew(name, out);
    },
  };
}
