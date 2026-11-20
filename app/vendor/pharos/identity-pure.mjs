// identity-pure: the signature provider for lib/identity.mjs built on lib/ed25519.mjs. Portable: this is what a browser uses (or any runtime
// without a faster native Ed25519). Same hex formats as identity-node.mjs, so keys and signatures are interchangeable between the two.
import { useCrypto } from './identity.mjs';
import * as ed from './ed25519.mjs';

const hex = (u) => [...u].map((b) => b.toString(16).padStart(2, '0')).join('');
const unhex = (h) => Uint8Array.from(String(h).match(/../g) || [], (x) => parseInt(x, 16));
const keyFrom = (seed) => ({ pub: hex(ed.publicKey(seed)), priv: hex(seed) + hex(ed.publicKey(seed)) });
export const provider = {
  generate() { return keyFrom(globalThis.crypto.getRandomValues(new Uint8Array(32))); },
  fromSeed(seedHex) { return keyFrom(unhex(seedHex)); },
  sign(priv, bytes) { return hex(ed.sign(unhex(priv.slice(0, 64)), bytes)); },
  verify(pub, bytes, sig) { return ed.verify(unhex(pub), bytes, unhex(sig)); },
};
export const usePure = () => useCrypto(provider);
export * from './identity.mjs';
