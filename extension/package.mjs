// package.mjs — build the downloadable extension package: the extension shell plus the engine it runs on, as one .zip.
// A minimal STORE-method zip writer (no dependencies). The zip is what the web app serves as "/extension.zip".
//   node extension/package.mjs            -> writes extension/dist/eodb-extension.zip
//   import { buildExtension }             -> { file, files }
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..', 'app');

const EXTENSION_FILES = ['manifest.json', 'background.js', 'content.js', 'popup.html', 'sidepanel.html', 'README.md'];
const APP_FILES = ['engine.mjs', 'net.mjs', 'graph.mjs', 'naming.mjs', 'contact.mjs', 'direct.mjs', 'tabular.mjs'];
const VENDOR_DIR = path.join(appRoot, 'vendor', 'pharos');

// ---- a minimal ZIP (STORE, no compression) -------------------------------------------------------------------------
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function zip(entries) {
  const parts = [], central = []; let offset = 0;
  for (const { name, data } of entries) {
    const nb = Buffer.from(name, 'utf8'), crc = crc32(data), sz = data.length;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(0, 8);
    lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0, 12); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(sz, 18); lh.writeUInt32LE(sz, 22);
    lh.writeUInt16LE(nb.length, 26); lh.writeUInt16LE(0, 28);
    parts.push(lh, nb, data);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0, 8); ch.writeUInt16LE(0, 10);
    ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(sz, 20); ch.writeUInt32LE(sz, 24);
    ch.writeUInt16LE(nb.length, 28); ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32); ch.writeUInt16LE(0, 34); ch.writeUInt16LE(0, 36);
    ch.writeUInt32LE(0, 38); ch.writeUInt32LE(offset, 42);
    central.push(ch, nb);
    offset += 30 + nb.length + sz;
  }
  const cdSize = central.reduce((n, b) => n + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10); eocd.writeUInt32LE(cdSize, 12); eocd.writeUInt32LE(offset, 16); eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...parts, ...central, eocd]);
}

export function buildExtension(outDir) {
  const entries = [];
  for (const f of EXTENSION_FILES) entries.push({ name: f, data: fs.readFileSync(path.join(here, f)) });
  for (const f of APP_FILES) entries.push({ name: f, data: fs.readFileSync(path.join(appRoot, f)) });
  for (const f of fs.readdirSync(VENDOR_DIR)) if (/\.(mjs|json)$/.test(f)) entries.push({ name: 'vendor/pharos/' + f, data: fs.readFileSync(path.join(VENDOR_DIR, f)) });
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, 'eodb-extension.zip');
  fs.writeFileSync(out, zip(entries));
  return { file: out, files: entries.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const r = buildExtension(path.join(here, 'dist'));
  console.log(`wrote ${r.file} (${r.files} files)`);
}
