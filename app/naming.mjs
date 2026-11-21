// naming.mjs — human-readable node identifiers: `word_HEXCODE` (see node-naming-spec.md).
// A device keeps its UUID (the Ed25519 key) and also gets a name spun up when it is first created (INS). The word is
// picked at random from the vendored lexicon (app/vendor/node-names.json) and the colour is assigned at RANDOM (mode B),
// so the same word appears under many colours — word × 24-bit colour is near-infinite names. The backend is the source
// of truth — it generates, stores and emits the full string; the frontend only renders the word in its colour.
import { sha256 } from './vendor/pharos/core.mjs';

const hex = (u8) => [...new Uint8Array(u8)].map((b) => b.toString(16).padStart(2, '0')).join('');
const enc = (s) => new TextEncoder().encode(s);

export const NAME_RE = /^[a-zA-Z][a-zA-Z0-9]*_[0-9A-F]{6}$/;

/** mode A (optional): a deterministic colour, the first 6 hex digits of sha256(word), uppercased. */
export function colorFor(word) { return hex(sha256(enc(String(word)))).slice(0, 6).toUpperCase(); }

/** split on the LAST underscore (the word never contains one): { word, color: '#HEX' }. */
export function parseName(name) {
  const i = String(name).lastIndexOf('_');
  return { word: name.slice(0, i), color: '#' + name.slice(i + 1) };
}

/** mode B: a fresh random 6-hex colour, not derived from the word. */
const randomColor = (rng) => Math.floor(rng() * 0x1000000).toString(16).padStart(6, '0').toUpperCase();

/** make a unique name: a random word + a random colour, avoiding every name in `existing`. */
const FALLBACK = ['node', 'device', 'peer', 'orb', 'relay', 'spark', 'drift', 'harbor', 'signal', 'beacon'];
export function makeName(words, existing = new Set(), rng = Math.random) {
  const list = (Array.isArray(words) ? words : []).filter((w) => w && /^[a-zA-Z][a-zA-Z0-9]*$/.test(w));
  const pool = list.length ? list : FALLBACK;   // a fetch can fail: fall back, never throw
  for (let i = 0; i < 10000; i++) {
    const full = `${pool[Math.floor(rng() * pool.length)]}_${randomColor(rng)}`;
    if (!existing.has(full)) return full;
  }
  return `${pool[0]}_${randomColor(rng)}`;
}
