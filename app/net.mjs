// net.mjs: how a space reaches other browsers. Two pieces, both small:
//   httpCarrier(url)        list / get / putNew against a blind relay (relay.mjs), the carrier interface the pharos sync code already uses
//   sealedCarrier(c, key)   everything put on the carrier is AES-256-GCM encrypted first, bound to its object name; what comes back is decrypted and
//                           checked. The relay (or whoever runs it) sees object names, sizes and timing, never contents.
// Nothing here names or assumes a particular server: the relay address is data in the share link.
const te = new TextEncoder();
const httpErr = (r, what) => Object.assign(new Error(`relay ${what} failed: ${r.status}`), { status: r.status });
// a route that is down must fail fast, not hang the whole sync: every request aborts after a short wait
const TIMEOUT_MS = 5000;
const fetchT = async (u, opts = {}) => { const c = new AbortController(); const t = setTimeout(() => c.abort(), TIMEOUT_MS); try { return await fetch(u, { ...opts, signal: c.signal }); } finally { clearTimeout(t); } };

export function httpCarrier(base) {
  const url = (p) => base.replace(/\/+$/, '') + p;
  return {
    async list() { const r = await fetchT(url('/o')); if (!r.ok) throw httpErr(r, 'list'); return r.json(); },
    async get(name) { const r = await fetchT(url('/o/' + encodeURIComponent(name))); if (r.status === 404) return null; if (!r.ok) throw httpErr(r, 'get'); return new Uint8Array(await r.arrayBuffer()); },
    async putNew(name, bytes) {
      const r = await fetchT(url('/o/' + encodeURIComponent(name)), { method: 'PUT', body: bytes });
      if (r.status === 409) throw Object.assign(new Error(`${name} exists with different bytes; carriers never overwrite`), { status: 409 });
      if (!r.ok) throw httpErr(r, 'put');
    },
  };
}

// mailboxCarrier(base, token): the same three calls against a mailbox server (app/mailbox/mailbox.mjs): objects at /v1/objects/<name>, a list at /v1/list.
// The token, if any, goes in an Authorization header (never in a URL). A route is written  mailbox:<base url>#<token>  : the part after # is the token.
export function mailboxCarrier(base, token) {
  const root = base.replace(/\/+$/, ''), headers = token ? { authorization: `Bearer ${token}` } : {};
  const path = (name) => name.split('/').map(encodeURIComponent).join('/');      // slashes stay slashes: names are paths
  const bad = (r, what) => Object.assign(new Error(r.status === 401 ? `mailbox ${what}: the token was refused` : r.status === 413 ? `mailbox ${what}: full or too large` : `mailbox ${what} failed: ${r.status}`), { status: r.status });
  return {
    async list() { const r = await fetchT(`${root}/v1/list`, { headers }); if (!r.ok) throw bad(r, 'list'); return (await r.json()).objects.map((o) => o.name); },
    async get(name) { const r = await fetchT(`${root}/v1/objects/${path(name)}`, { headers }); if (r.status === 404) return null; if (!r.ok) throw bad(r, 'get'); return new Uint8Array(await r.arrayBuffer()); },
    async putNew(name, bytes) {
      const r = await fetchT(`${root}/v1/objects/${path(name)}`, { method: 'PUT', headers, body: bytes });
      if (r.status === 409) throw Object.assign(new Error(`${name} exists; carriers never overwrite`), { status: 409 });
      if (!r.ok) throw bad(r, 'put');
    },
  };
}
export const parseMailboxRoute = (uri) => { const body = uri.slice('mailbox:'.length), i = body.lastIndexOf('#'); return i < 0 ? { base: body, token: '' } : { base: body.slice(0, i), token: decodeURIComponent(body.slice(i + 1)) }; };

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

// ---- carrying a pharos over a tiny, shared radio link (LoRa and friends) ----------------------------------------
// A LoRa gateway moves only a few hundred bytes per frame, and the airwaves are shared and regulated: the LoRa
// Alliance's rule is "be a good neighbor". So two pieces, composed:
//
//   politeCarrier(inner, policy)  rate-limits every exchange to a duty cycle (default 1% of wall time on air, the EU
//                                 limit), serialises frames, and retries with exponential backoff + jitter. Retries
//                                 are airtime too, so they are metered the same way. Nothing is sent bursty.
//   chunkedCarrier(inner, {mtu})  splits an object into mtu-sized frames + a manifest and reassembles on read, caching
//                                 parts already fetched so a poll does not re-download the airwaves it already spent.
//
// Composition: sealedCarrier(chunkedCarrier(politeCarrier(httpCarrier(gateway)))). The gateway only ever sees sealed
// frames, each within the MTU and within the duty-cycle budget.

/** a carrier wrapper that spends a shared airtime budget before every call, and backs off politely when one fails.
 *  `now`/`sleep` are injectable so the accounting can be tested without waiting. */
export function politeCarrier(inner, policy = {}) {
  const {
    dutyCycle = 0.01,                       // fraction of wall time allowed on air (EU 1%). 0 disables (fast, for tests on a private link).
    airtime = (bytes) => 40 + bytes * 0.8,  // ms on air for a frame of this many bytes (a conservative LoRa estimate)
    burst = 60,                             // frames of credit that may be spent at once before pacing kicks in
    maxRetries = 4,
    rng = Math.random,
    now = () => Date.now(),
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  } = policy;
  if (dutyCycle <= 0) return inner;         // not a shared radio: no pacing needed
  const creditCap = airtime(0) * burst;
  let credit = 0, last = now();
  const refill = () => { const t = now(); credit = Math.min(credit + Math.max(0, t - last) * dutyCycle, creditCap); last = t; };
  async function spend(bytes) {
    const need = airtime(bytes); refill();
    if (credit < need) { const wait = (need - credit) / dutyCycle; await sleep(wait); credit += wait * dutyCycle; last = now(); }
    credit -= need;
  }
  const backoff = (i) => Math.round(50 * 2 ** i * (0.5 + rng()));
  async function metered(fn, bytes) {
    let err;
    for (let i = 0; i <= maxRetries; i++) {
      try { await spend(bytes); return await fn(); }
      catch (e) { err = e; if (i < maxRetries) await sleep(backoff(i)); }
    }
    throw err;
  }
  return {
    inner,
    list: () => metered(() => inner.list(), 8),
    get: (name) => metered(() => inner.get(name), 8 + name.length),
    putNew: (name, bytes) => metered(() => inner.putNew(name, bytes), bytes.length + name.length),
  };
}

/** split each object into mtu-sized frames + a manifest, reassembling on read. Caches parts it already fetched, so
 *  re-polling a slowly-arriving object does not spend the airwaves again. Store-and-forward: get() returns null until
 *  every frame is present, and the caller retries on its next poll. */
export function chunkedCarrier(inner, { mtu = 200 } = {}) {
  const td = new TextDecoder(), te2 = new TextEncoder();
  const MAN = '/manifest', PART = '/p';
  const cache = new Map();                   // logical name -> { parts: Map<index, bytes> }
  return {
    inner,
    async list() { const all = await inner.list(); return all.filter((n) => n.endsWith(MAN)).map((n) => n.slice(0, -MAN.length)); },
    async get(name) {
      const man = await inner.get(name + MAN); if (!man) return null;
      let meta; try { meta = JSON.parse(td.decode(man)); } catch (e) { return null; }
      const seen = cache.get(name) || cache.set(name, new Map()).get(name);
      const parts = [];
      for (let i = 0; i < meta.parts; i++) {
        let p = seen.get(i);
        if (!p) { p = await inner.get(name + PART + i); if (!p) return null; seen.set(i, p); }
        parts.push(p);
      }
      const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0;
      for (const p of parts) { out.set(p, o); o += p.length; }
      return out.length === meta.total ? out : null;
    },
    async putNew(name, bytes) {
      if (await inner.get(name + MAN)) return;            // content-addressed name: same name means same bytes; send nothing
      const parts = Math.max(1, Math.ceil(bytes.length / mtu));
      for (let i = 0; i < parts; i++) await inner.putNew(name + PART + i, bytes.subarray(i * mtu, (i + 1) * mtu));
      await inner.putNew(name + MAN, te2.encode(JSON.stringify({ parts, total: bytes.length })));
    },
  };
}
