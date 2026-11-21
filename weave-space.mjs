// weave-space.mjs — weave this session's reasoning into a SPACE (its own pharos, its own keys, encrypted separately),
// then SEG the saliency region. Not a net-new plain pharos: a space in the app, encrypted under a passphrase.
import fs from 'node:fs';
import path from 'node:path';
import { openSpace } from './app/engine.mjs';
import { fsBackend } from './app/fs-backend.mjs';

const dir = path.resolve('./spaces/reasoning');
const passphrase = process.env.EODB_PASSPHRASE || 'reasoning-space';

const cells = JSON.parse(fs.readFileSync('./app/vendor/pharos/cells.json', 'utf8'));
const names = JSON.parse(fs.readFileSync('./app/vendor/node-names.json', 'utf8'));

const space = await openSpace({
  name: 'reasoning', passphrase,
  backend: fsBackend(path.join(dir, 'store')),
  blobBackend: fsBackend(path.join(dir, 'blobs')),
  cells, names,
});

// declare the reasoning kinds once, then weave
const K = (name, cell) => { if (!space.raw().some((e) => e.kind === 'kind' && e.body && e.body.name === name)) space.weaveRaw({ cell: 'DEF·Figure', kind: 'kind', addr: `kind:${name}`, body: { name, cell } }); };
for (const [n, c] of [['finding', 'INS·Figure'], ['role', 'INS·Figure'], ['decision', 'INS·Figure'], ['gap', 'INS·Figure']]) K(n, c);

const F = (addr, text, source) => space.weaveRaw({ cell: 'INS·Figure', kind: 'finding', addr, body: { text, source } });
const f1 = F('finding:longform-past', 'past solve: longform = outline-first, section-by-section self-prompting', 'eodb-clone@0920bfc:app/index.html:1024');
const f2 = F('finding:def-eva-rec', 'past solve: DEF/EVA/REC loop — judge (EVA), re-ground (REC), re-judge', 'eodb-clone@13af353:app/index.html:1428');
const f3 = F('finding:holarchy', 'past solve: the holarchy — every unit through the same operators; void-spec → hora → void-satisfaction', 'holodeck:reading/eval/holarchy/PLAN.md');

space.weaveRaw({ cell: 'INS·Figure', kind: 'role', addr: 'role:khora', body: { text: 'perceiver · ground-producer' } });
space.weaveRaw({ cell: 'INS·Figure', kind: 'role', addr: 'role:janus', body: { text: 'logos · reasoner · mark; owns the hyperlexicon' } });
space.weaveRaw({ cell: 'INS·Figure', kind: 'role', addr: 'role:penelope', body: { text: 'keeper · mouth · judgment' } });

space.weaveRaw({ cell: 'INS·Figure', kind: 'decision', addr: 'decision:longform-recursive', body: { text: 'recursive longform = void-spec → hora → void-satisfaction' }, of: [f1.id, f3.id, f2.id] });

space.weaveRaw({ cell: 'INS·Figure', kind: 'gap', addr: 'gap:byte-offset-sources', body: { text: 'sources are content-addresses, not byte offsets; reader spans not wired into retrieve()' } });

await space.settle();

// SEG the saliency region: the reasoning kinds, out of the whole (encrypted) log
console.log('space:', space.deviceName, '· writer', space.writer);
for (const k of ['finding', 'role', 'decision', 'gap']) {
  for (const e of space.raw().filter((x) => x.kind === k)) {
    console.log(`  ${e.addr}`, e.body.source ? `[${e.body.source}]` : '', '|', (e.body.text || '').slice(0, 70), e.of && e.of.length ? `| of:${e.of.length}` : '');
  }
}
console.log('encrypted:', space.report().encrypted, '· backend:', space.report().backend, '· entries:', space.report().entries);
space.close();
