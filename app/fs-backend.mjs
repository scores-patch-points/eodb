// fs-backend.mjs: a durable, Node-only filesystem backend for browser-store's encrypted chunks — the same interface as
// memoryBackend/idbBackend (streams / chunks / putChunk / getMeta / …), so `openSpace({ backend: fsBackend(dir) })` gives a
// headless node whose sealed chunks and secrets persist to disk. Use a passphrase: keys then derive from PBKDF2 and nothing
// sensitive is ever written (the device-key mode would try to persist a non-serialisable CryptoKey, so it is not supported).
import fs from 'node:fs';
import path from 'node:path';

const enc = (v) => JSON.stringify(v, (_k, x) => (x instanceof Uint8Array ? { $b: Buffer.from(x).toString('base64') } : x));
const dec = (s) => JSON.parse(s, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) && typeof x.$b === 'string' ? new Uint8Array(Buffer.from(x.$b, 'base64')) : x));

export function fsBackend(dir) {
  dir = path.resolve(dir);
  const chunksDir = path.join(dir, 'chunks'), metaDir = path.join(dir, 'meta');
  const streamDir = (s) => path.join(chunksDir, String(s));
  const metaFile = (k) => path.join(metaDir, `${String(k)}.json`);
  fs.mkdirSync(chunksDir, { recursive: true }); fs.mkdirSync(metaDir, { recursive: true });
  return {
    kind: 'fs',
    async streams() { try { return fs.readdirSync(chunksDir).filter((d) => fs.statSync(path.join(chunksDir, d)).isDirectory()); } catch { return []; } },
    async chunks(stream, fromSeq = 1) {
      const d = streamDir(stream); if (!fs.existsSync(d)) return [];
      return fs.readdirSync(d).map(Number).filter((n) => Number.isInteger(n) && n >= fromSeq).sort((a, b) => a - b).map((seq) => ({ seq, record: dec(fs.readFileSync(path.join(d, String(seq)), 'utf8')) }));
    },
    async putChunk(stream, seq, record, { replace = false } = {}) {
      const d = streamDir(stream); fs.mkdirSync(d, { recursive: true });
      const f = path.join(d, String(seq));
      if (fs.existsSync(f) && !replace) throw Object.assign(new Error(`chunk ${seq} of ${stream} already exists`), { code: 'EXISTS' });
      fs.writeFileSync(f, enc(record));
    },
    async getMeta(k) { const f = metaFile(k); return fs.existsSync(f) ? dec(fs.readFileSync(f, 'utf8')) : undefined; },
    async getOrCreateMeta(k, make) { const f = metaFile(k); if (fs.existsSync(f)) return dec(fs.readFileSync(f, 'utf8')); const v = await make(); fs.writeFileSync(f, enc(v)); return v; },
    async putMeta(k, v) { fs.writeFileSync(metaFile(k), enc(v)); },
  };
}
