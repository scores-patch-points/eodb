// transport: make any protocol look like a carrier, and join carriers together. Portable (core + carrier). See docs/TRANSPORTS.md.
// A protocol adapter (Matrix, ActivityPub, Nostr, email, a folder, S3 ...) only has to supply list/get/putNew. Everything else here is
// protocol-independent: entries are signed and content-addressed and merging is set union, so no carrier is trusted and a node that
// reaches two of them is a bridge with no translation step.
import { parseName, hash8, segmentEntries } from './carrier.mjs';

/** what a transport can do and what its operator can see; a router chooses on this, so there are no silent defaults */
export function descriptor({ id, live = false, durable = true, maxBlob = Infinity, ordered = false, retention = 'unknown', exposes = [] } = {}) {
  if (typeof id !== 'string' || !id) throw new TypeError('descriptor needs an id');
  if (!(maxBlob > 0)) throw new TypeError('descriptor maxBlob must be positive');
  return { id, live, durable, maxBlob, ordered, retention, exposes: [...exposes] };
}

const PART = /^(.*)\.p(\d{4})-(\d{4})$/;
const pad = (n) => String(n).padStart(4, '0');

/** a carrier whose objects are limited to maxBlob bytes: larger blobs are stored as parts and reassembled; a segment with a missing part is not listed */
export function chunked(inner, { maxBlob }) {
  const parts = async () => { const m = new Map(); for (const name of await inner.list()) { const x = PART.exec(name); if (!x) continue; const g = m.get(x[1]) || m.set(x[1], { n: +x[3], have: new Set() }).get(x[1]); g.have.add(+x[2]); } return m; };
  return {
    inner,
    async list() {
      const out = []; for (const name of await inner.list()) if (!PART.test(name)) out.push(name);
      for (const [name, g] of await parts()) if (g.have.size === g.n) out.push(name);
      return out;
    },
    async incomplete() { const out = []; for (const [name, g] of await parts()) if (g.have.size !== g.n) out.push(name); return out; },
    async get(name) {
      const direct = await inner.get(name); if (direct) return direct;
      const g = (await parts()).get(name); if (!g || g.have.size !== g.n) return null;
      const bufs = []; for (let i = 1; i <= g.n; i++) { const b = await inner.get(`${name}.p${pad(i)}-${pad(g.n)}`); if (!b) return null; bufs.push(b); }
      const out = new Uint8Array(bufs.reduce((a, b) => a + b.length, 0)); let o = 0; for (const b of bufs) { out.set(b, o); o += b.length; }
      return out;
    },
    async putNew(name, bytes) {
      if (bytes.length <= maxBlob) return inner.putNew(name, bytes);
      const n = Math.ceil(bytes.length / maxBlob);
      for (let i = 0; i < n; i++) await inner.putNew(`${name}.p${pad(i + 1)}-${pad(n)}`, bytes.subarray(i * maxBlob, (i + 1) * maxBlob));
    },
  };
}

/**
 * Copy every verified segment `from` has and `to` lacks. Corrupt ones are reported, never propagated; a repeat copies nothing.
 * With `admit` (see lib/gate.mjs) a segment is copied only if every entry in it would count in the destination's scope; the bridge retries
 * until nothing more moves, so signatures that travel in a later segment than their entries still resolve. Segments refused are listed
 * in `rejected` with the reason.
 */
export async function bridge(from, to, { admit } = {}) {
  const have = new Set(await to.list()); let copied = 0; const bad = [], cand = [];
  for (const name of await from.list()) {
    const p = parseName(name); if (!p || have.has(name)) continue;
    let bytes = null; try { bytes = await from.get(name); } catch (err) { bad.push({ name, why: 'not readable' }); continue; }
    if (!bytes) { bad.push({ name, why: 'listed but not readable' }); continue; }
    if (hash8(bytes) !== p.hash8) { bad.push({ name, why: 'bytes do not match the name' }); continue; }
    cand.push({ name, bytes });
  }
  const put = async (c) => { try { await to.putNew(c.name, c.bytes); copied++; return true; } catch (err) { bad.push({ name: c.name, why: `destination refused: ${err && err.message}` }); return false; } };
  if (!admit) { for (const c of cand) await put(c); return { copied, bad, rejected: [] }; }
  const accepted = []; let pending = cand.map((c) => ({ ...c, ents: segmentEntries(c.name, c.bytes).ents, why: 'not examined' }));
  for (let progress = true; progress && pending.length;) {
    progress = false; const still = [];
    for (const c of pending) {
      const r = await admit(c.name, c.ents, accepted);
      if (r.ok) { if (await put(c)) { accepted.push(...c.ents); progress = true; } } else { c.why = r.why; still.push(c); }
    }
    pending = still;
  }
  return { copied, bad, rejected: pending.map((c) => ({ name: c.name, why: c.why })) };
}

const safe = async (f, fallback) => { try { return await f(); } catch (err) { return fallback; } };

/** several carriers as one: list is the union, get takes the first copy that verifies, putNew writes to all and succeeds if at least minOk do */
export function union(carriers, { minOk = 1 } = {}) {
  return {
    carriers,
    async list() { const all = await Promise.all(carriers.map((c) => safe(() => c.list(), []))); return [...new Set(all.flat())]; },
    async get(name) {
      const p = parseName(name);
      for (const c of carriers) { const b = await safe(() => c.get(name), null); if (b && (!p || hash8(b) === p.hash8)) return b; }
      return null;
    },
    async putNew(name, bytes) {
      const res = await Promise.allSettled(carriers.map(async (c) => c.putNew(name, bytes))) // async: an adapter that throws synchronously is still just a refusal;
      const ok = res.filter((r) => r.status === 'fulfilled').length;
      if (ok < minOk) throw Object.assign(new Error(`put failed on too many carriers (${ok} of ${carriers.length} accepted, ${minOk} needed)`), { results: res.map((r) => (r.status === 'rejected' ? String(r.reason && r.reason.message) : 'ok')) });
    },
  };
}
