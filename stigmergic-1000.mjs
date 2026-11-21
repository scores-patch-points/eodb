// stigmergic-1000.mjs — 1,000 turns of stigmergic reasoning in a space.
// Each turn: SEG the saliency region (read the fold), weave a byte-addressed observation with an `of`-link to the prior turn.
// Every 100 turns a decision is derived from the block (stigmergy: structure emerges from the accumulation).
import fs from 'node:fs';
import path from 'node:path';
import { openSpace } from './app/engine.mjs';
import { fsBackend } from './app/fs-backend.mjs';

const dir = path.resolve('./spaces/reasoning');
const passphrase = process.env.EODB_PASSPHRASE || 'reasoning-space';
const cells = JSON.parse(fs.readFileSync('./app/vendor/pharos/cells.json', 'utf8'));
const names = JSON.parse(fs.readFileSync('./app/vendor/node-names.json', 'utf8'));

const space = await openSpace({ name: 'reasoning', passphrase, backend: fsBackend(path.join(dir, 'store')), blobBackend: fsBackend(path.join(dir, 'blobs')), cells, names });

const K = (name, cell) => { if (!space.raw().some((e) => e.kind === 'kind' && e.body && e.body.name === name)) space.weaveRaw({ cell: 'DEF·Figure', kind: 'kind', addr: `kind:${name}`, body: { name, cell } }); };
for (const [n, c] of [['turn', 'INS·Figure'], ['decision', 'INS·Figure']]) K(n, c);

const N = 1000;
const t0 = Date.now();
let prev = null;
let count = 0;                     // the saliency region's size, tracked incrementally
for (let n = 1; n <= N; n++) {
  // SEG the saliency region — but read only the fold's count cheaply; do a full SEG every 100 turns to prove the fold, not the counter
  const e = space.weaveRaw({
    cell: 'INS·Figure', kind: 'turn', addr: `turn:${n}`,
    body: { n, observed: count, note: `saliency region held ${count} turn(s) before this one` },
    of: prev ? [prev.id] : [],
  });
  prev = e; count++;

  if (n % 100 === 0) {
    const seg = space.raw().filter((x) => x.kind === 'turn').length;       // the real SEG read
    const ok = seg === count ? '✓ fold==counter' : '✗ DIVERGED';
    space.weaveRaw({ cell: 'INS·Figure', kind: 'decision', addr: `decision:block-${n / 100}`, body: { text: `turns 1..${n}: saliency region holds ${seg} turns; ${ok}` }, of: [prev.id] });
    await space.settle();
    console.log(`turn ${n}/${N} · SEG(${seg}) ${ok} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
}
await space.settle();

// verify the causal chain holds the full 1,000 turns
const turns = space.raw().filter((x) => x.kind === 'turn');
let len = 1, cur = turns[turns.length - 1];
while (cur.of && cur.of.length) { const p = space.raw().find((x) => x.id === cur.of[0]); if (!p) break; len++; cur = p; }

console.log('--- result ---');
console.log('turns:', turns.length, '· of-chain length from the last turn:', len);
console.log('decisions derived:', space.raw().filter((x) => x.kind === 'decision').length);
console.log('encrypted:', space.report().encrypted, '· backend:', space.report().backend, '· entries:', space.report().entries);
console.log('elapsed:', ((Date.now() - t0) / 1000).toFixed(1) + 's');
space.close();
