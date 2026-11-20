// Effects demo log: three items with detached bodies, one tombstoned (retracted). Bodies are files named by bodyc.
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
const [SRC, OUT] = process.argv.slice(2);
if (!SRC || !OUT || fs.existsSync(OUT)) { console.error('usage: build-effects.mjs <pharos-clone> <new-dir>'); process.exit(2); }
const P = await import(pathToFileURL(path.join(SRC, 'lib', 'pharos.mjs')).href);
const owner = P.open('effects', { dir: path.join(OUT, 'log'), writer: 'owner' });
for (const [name, cell] of [['item', 'INS·Figure'], ['present', 'EVA·Figure'], ['gone', 'EVA·Figure']])
  P.weave(owner, { cell: 'DEF·Figure', kind: 'kind', addr: `kind:${name}`, body: { name, cell } });
fs.mkdirSync(path.join(OUT, 'bodies'));
const items = [];
for (const text of ['alpha', 'beta', 'gamma']) {
  const salt = crypto.randomBytes(16).toString('hex');
  const bodyc = crypto.createHash('sha256').update(salt + text).digest('hex');
  fs.writeFileSync(path.join(OUT, 'bodies', bodyc), JSON.stringify({ salt, text }));
  const it = P.weave(owner, { cell: 'INS·Figure', kind: 'item', addr: `item:${text}`, body: { bodyc } });
  items.push({ text, bodyc, id: it.id });
}
P.weave(owner, { cell: 'NUL·Figure', kind: 'retract', addr: 'item:beta', body: { why: 'deleted by author' }, of: [items[1].id] });
console.log(JSON.stringify({ items: items.map((i) => ({ text: i.text, bodyc: i.bodyc.slice(0, 8) })) }));
