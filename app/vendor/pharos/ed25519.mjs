// ed25519: SHA-512 and Ed25519 (RFC 8032) in plain JavaScript with BigInt. Synchronous and portable (no Node built-ins, no WebCrypto), so a browser
// can sign and verify through the same synchronous provider interface as Node. Checked byte-for-byte against Node's crypto and RFC 8032 vectors.
//
// Not constant-time: BigInt arithmetic leaks timing. Fine for verifying, and for signing on a device nobody else runs code on; where a hostile
// process can time your signing, use the platform's native implementation instead. The hash constants are DERIVED here (cube and square roots
// of the first primes) rather than typed in, so there is no table to mistype; the tests confirm the result against Node.
const M64 = (1n << 64n) - 1n;
const primeNums = []; for (let n = 2; primeNums.length < 80; n++) if (primeNums.every((p) => n % p)) primeNums.push(n);
const primes = primeNums.map(BigInt);
const iroot = (n, k) => { let x = 1n << BigInt(Math.ceil(n.toString(2).length / k) + 1); for (;;) { const y = ((BigInt(k) - 1n) * x + n / x ** (BigInt(k) - 1n)) / BigInt(k); if (y >= x) return x; x = y; } };
const K = primes.map((p) => iroot(p << 192n, 3) & M64);                 // first 64 bits of the fractional part of cbrt(p)
const H0 = primes.slice(0, 8).map((p) => iroot(p << 128n, 2) & M64);    // ... of sqrt(p)
const rotr = (x, n) => ((x >> n) | (x << (64n - n))) & M64;

export function sha512(msg) {
  const len = msg.length, padLen = (len + 17 + 127) & ~127, buf = new Uint8Array(padLen);
  buf.set(msg); buf[len] = 0x80;
  const bits = BigInt(len) * 8n; for (let i = 0; i < 16; i++) buf[padLen - 1 - i] = Number((bits >> BigInt(8 * i)) & 255n);
  const h = H0.slice(), w = new Array(80);
  for (let off = 0; off < padLen; off += 128) {
    for (let i = 0; i < 16; i++) { let v = 0n; for (let j = 0; j < 8; j++) v = (v << 8n) | BigInt(buf[off + i * 8 + j]); w[i] = v; }
    for (let i = 16; i < 80; i++) {
      const s0 = rotr(w[i - 15], 1n) ^ rotr(w[i - 15], 8n) ^ (w[i - 15] >> 7n), s1 = rotr(w[i - 2], 19n) ^ rotr(w[i - 2], 61n) ^ (w[i - 2] >> 6n);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) & M64;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 80; i++) {
      const S1 = rotr(e, 14n) ^ rotr(e, 18n) ^ rotr(e, 41n), ch = (e & f) ^ (~e & M64 & g), t1 = (hh + S1 + ch + K[i] + w[i]) & M64;
      const S0 = rotr(a, 28n) ^ rotr(a, 34n) ^ rotr(a, 39n), maj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + maj) & M64;
      hh = g; g = f; f = e; e = (d + t1) & M64; d = c; c = b; b = a; a = (t1 + t2) & M64;
    }
    [a, b, c, d, e, f, g, hh].forEach((v, i) => { h[i] = (h[i] + v) & M64; });
  }
  const out = new Uint8Array(64); h.forEach((v, i) => { for (let j = 0; j < 8; j++) out[i * 8 + j] = Number((v >> BigInt(56 - 8 * j)) & 255n); });
  return out;
}

// ---- field and curve -----------------------------------------------------------------------------------------------
const P = (1n << 255n) - 19n, L = (1n << 252n) + 27742317777372353535851937790883648493n;
const mod = (a) => { const r = a % P; return r >= 0n ? r : r + P; };
const pow = (b, e, m = P) => { let r = 1n; b %= m; while (e > 0n) { if (e & 1n) r = (r * b) % m; b = (b * b) % m; e >>= 1n; } return r; };
const inv = (a) => pow(mod(a), P - 2n);
const D = mod(-121665n * inv(121666n)), SQRT_M1 = pow(2n, (P - 1n) / 4n);
const toInt = (bytes) => { let v = 0n; for (let i = bytes.length - 1; i >= 0; i--) v = (v << 8n) | BigInt(bytes[i]); return v; };
const toBytes = (v, n) => { const out = new Uint8Array(n); for (let i = 0; i < n; i++) { out[i] = Number(v & 255n); v >>= 8n; } return out; };

function recoverX(y, sign) {
  if (y >= P) return null;
  const y2 = mod(y * y), x2 = mod((y2 - 1n) * inv(D * y2 + 1n));
  let x = pow(x2, (P + 3n) / 8n);
  if (mod(x * x - x2) !== 0n) x = mod(x * SQRT_M1);
  if (mod(x * x - x2) !== 0n) return null;
  if (x === 0n && sign) return null;
  return (Number(x & 1n) !== sign) ? P - x : x;
}
const By = mod(4n * inv(5n)), Bx = recoverX(By, 0);
const BASE = [Bx, By, 1n, mod(Bx * By)];
const ZERO = [0n, 1n, 1n, 0n];
function add(p, q) {
  const [X1, Y1, Z1, T1] = p, [X2, Y2, Z2, T2] = q;
  const A = mod((Y1 - X1) * (Y2 - X2)), B = mod((Y1 + X1) * (Y2 + X2)), C = mod(2n * D * T1 * T2), Dd = mod(2n * Z1 * Z2);
  const E = B - A, F = Dd - C, G = Dd + C, Hh = B + A;
  return [mod(E * F), mod(G * Hh), mod(F * G), mod(E * Hh)];
}
function mul(p, s) { let r = ZERO, q = p; while (s > 0n) { if (s & 1n) r = add(r, q); q = add(q, q); s >>= 1n; } return r; }
function encode(p) { const zi = inv(p[2]), x = mod(p[0] * zi), y = mod(p[1] * zi); const out = toBytes(y, 32); out[31] |= Number(x & 1n) << 7; return out; }
function decode(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length !== 32) return null;
  const sign = bytes[31] >> 7, y = toInt(bytes.map((b, i) => (i === 31 ? b & 127 : b)));
  const x = recoverX(y, sign); return x === null ? null : [x, y, 1n, mod(x * y)];
}
const clamp = (h) => { const a = h.slice(0, 32); a[0] &= 248; a[31] &= 127; a[31] |= 64; return toInt(a); };
const modL = (bytes) => toInt(bytes) % L;

/** internal, exported for tests: decode a 32-byte point (null if not canonical or not on the curve) */
export const _decode = decode;
/** the 32-byte public key for a 32-byte seed */
export function publicKey(seed) { return encode(mul(BASE, clamp(sha512(seed)))); }
/** a 64-byte signature (R || S) of `msg` by the key with this 32-byte seed; deterministic */
export function sign(seed, msg) {
  const h = sha512(seed), a = clamp(h), A = encode(mul(BASE, a));
  const r = modL(sha512(concat([h.slice(32), msg]))), R = encode(mul(BASE, r));
  const k = modL(sha512(concat([R, A, msg]))), S = (r + k * a) % L;
  return concat([R, toBytes(S, 32)]);
}
/** true only for a canonical, valid signature; never throws */
export function verify(pub, msg, sig) {
  try {
    if (!(pub instanceof Uint8Array) || !(sig instanceof Uint8Array) || !(msg instanceof Uint8Array) || pub.length !== 32 || sig.length !== 64) return false;
    const A = decode(pub), R = decode(sig.slice(0, 32)); if (!A || !R) return false;
    const S = toInt(sig.slice(32)); if (S >= L) return false;                       // non-canonical S would make signatures malleable
    const k = modL(sha512(concat([sig.slice(0, 32), pub, msg])));
    const lhs = encode(mul(BASE, S)), rhs = encode(add(R, mul(A, k)));
    return lhs.length === rhs.length && lhs.every((b, i) => b === rhs[i]);
  } catch (e) { return false; }
}
function concat(parts) { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; }
