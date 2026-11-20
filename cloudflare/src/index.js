// The eodb relay as a Cloudflare Worker, backed by D1 (strongly consistent SQLite).
// It speaks the same three calls as the local relay: list / get / create-only put.
// Everything it stores is sealed bytes (AES-GCM) from the client; it never reads them.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '600',
};
const MAX = 5 * 1024 * 1024;

// D1 returns BLOBs as a byte array; normalise to Uint8Array so Response and comparisons get real bytes.
function asU8(v) {
  if (v == null) return null;
  if (v instanceof Uint8Array) return v;
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  if (ArrayBuffer.isView(v)) return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
  if (Array.isArray(v)) return Uint8Array.from(v);
  if (typeof v === 'string') return new TextEncoder().encode(v);
  return new Uint8Array(v);
}
function bytesEqual(a, b) {
  const ua = asU8(a), ub = asU8(b);
  if (ua.byteLength !== ub.byteLength) return false;
  for (let i = 0; i < ua.length; i++) if (ua[i] !== ub[i]) return false;
  return true;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (url.pathname === '/health') return new Response('ok', { headers: CORS });

    if (url.pathname === '/o') {
      if (request.method === 'GET') {
        const { results } = await env.DB.prepare('SELECT name FROM objects ORDER BY name').all();
        return new Response(JSON.stringify(results.map((r) => r.name)), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
      return new Response('method not allowed', { status: 405, headers: CORS });
    }

    const m = /^\/o\/(.+)$/.exec(url.pathname);
    if (m) {
      const name = decodeURIComponent(m[1]);
      if (request.method === 'GET') {
        const row = await env.DB.prepare('SELECT value FROM objects WHERE name = ?').bind(name).first();
        if (!row || row.value == null) return new Response('no such object', { status: 404, headers: CORS });
        return new Response(asU8(row.value), { headers: { ...CORS, 'Content-Type': 'application/octet-stream' } });
      }
      if (request.method === 'PUT') {
        const body = await request.arrayBuffer();
        if (body.byteLength > MAX) return new Response('too large', { status: 413, headers: CORS });
        const row = await env.DB.prepare('SELECT value FROM objects WHERE name = ?').bind(name).first();
        if (row && row.value != null) {
          return bytesEqual(row.value, body)
            ? new Response('same', { status: 200, headers: CORS })
            : new Response('exists with different bytes', { status: 409, headers: CORS });
        }
        await env.DB.prepare('INSERT INTO objects (name, value) VALUES (?, ?)').bind(name, body).run();
        return new Response('created', { status: 201, headers: CORS });
      }
      return new Response('method not allowed', { status: 405, headers: CORS });
    }

    return new Response('not found', { status: 404, headers: CORS });
  },
};
