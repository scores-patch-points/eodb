// Builds a small test log: a root grant, delegations, an expiry, an escalation, a forged root, a bad signature, two revocations.
// Kernel facts (signature checks) are written as attestation entries by a separate writer, 'kernel'.
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const SRC = process.argv[2];   // path to the pharos clone
const OUT = process.argv[3];   // log directory to create
if (!SRC || !OUT) { console.error('usage: build-log.mjs <pharos-clone> <out-dir>'); process.exit(2); }
if (fs.existsSync(OUT)) { console.error('out dir exists, refusing to reuse it'); process.exit(2); }
const P = await import(pathToFileURL(path.join(SRC, 'lib', 'pharos.mjs')).href);

const owner = P.open('authtest', { dir: OUT, writer: 'owner' });
const kernel = P.open('authtest', { dir: OUT, writer: 'kernel' });

const kinds = [
  ['grant', 'CON·Figure'],   // a link from a key to an area
  ['revoke', 'SEG·Figure'],  // cuts a grant
  ['attest', 'EVA·Figure'],  // a native check recorded as an entry (signature ok or not)
];
for (const [name, cell] of kinds) P.weave(owner, { cell: 'DEF·Figure', kind: 'kind', addr: `kind:${name}`, body: { name, cell } });

const g = {};
const grant = (id, from, to, area, expires, parents) => {
  g[id] = P.weave(owner, { cell: 'CON·Figure', kind: 'grant', addr: `key:${from}`, body: { to, area, mode: 'read', expires, label: id }, of: parents.map((p) => g[p].id) });
  P.weave(kernel, { cell: 'EVA·Figure', kind: 'attest', addr: `attest:${id}`, body: { check: 'sig', ok: id !== 'G8' }, of: [g[id].id] });
};
grant('G1', 'rootA', 'devB', 'docs/', '2026-12-01T00:00:00Z', []);
grant('G2', 'devB', 'devC', 'docs/team/', '2026-11-25T00:00:00Z', ['G1']);
grant('G3', 'devC', 'devD', 'docs/team/a/', '2026-11-18T00:00:00Z', ['G2']);   // expired
grant('G4', 'devC', 'devE', 'docs/team/b/', '2026-11-24T00:00:00Z', ['G2']);
grant('G5', 'devB', 'devF', 'docs/f/', '2026-12-01T00:00:00Z', ['G1']);        // will be revoked
grant('G6', 'devC', 'devK', 'docs/', '2026-12-01T00:00:00Z', ['G2']);          // escalation: wider than its parent
grant('G7', 'mallory', 'eve', 'docs/', '2026-12-01T00:00:00Z', []);            // not from the root
grant('G8', 'devB', 'devG', 'docs/x/', '2026-12-01T00:00:00Z', ['G1']);        // bad signature
grant('G9', 'devB', 'devH', 'docs/h/', '2026-12-01T00:00:00Z', ['G1']);        // will be revoked
grant('G10', 'devH', 'devI', 'docs/h/i/', '2026-12-01T00:00:00Z', ['G9']);     // child of a revoked grant
grant('G11', 'devB', 'devJ', 'docs/j/', '2026-12-01T00:00:00Z', ['G1']);
grant('G12', 'devC', 'devL', 'docs/', '2026-11-24T00:00:00Z', ['G2']);        // escalation only: area wider, expiry within parent
grant('G13', 'devE', 'devN', 'docs/team/b/z/', '2026-11-23T00:00:00Z', ['G1']); // cites the wrong parent (issuer is not G1's grantee)
for (const id of ['G5', 'G9']) {
  const r = P.weave(owner, { cell: 'SEG·Figure', kind: 'revoke', addr: `revoke:${id}`, body: { by: id === 'G5' ? 'devB' : 'rootA' }, of: [g[id].id] });
  P.weave(kernel, { cell: 'EVA·Figure', kind: 'attest', addr: `attest:revoke-${id}`, body: { check: 'sig', ok: true }, of: [r.id] });
}
console.log(JSON.stringify({ built: OUT, grants: Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.id.slice(0, 8)])) }));
