// The watcher: the log decides, the kernel does. It runs an EOQL view that lists owed effects, performs each one natively,
// then appends a receipt entry so the view stops listing it. Running it twice changes nothing the second time.
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const [SRC, DIR, VIEW] = process.argv.slice(2);
const P = await import(pathToFileURL(path.join(SRC, 'lib', 'pharos.mjs')).href);
const cli = path.join(SRC, 'eoql', 'bin', 'eoql.mjs');
const out = execFileSync('node', [cli, 'run', `lib:${path.join(DIR, 'log')}`, '-f', VIEW], { encoding: 'utf8' });
const res = JSON.parse(out);
const kernel = P.open('effects', { dir: path.join(DIR, 'log'), writer: 'kernel' });
let done = 0;
for (const row of res.rows) {
  const file = path.join(DIR, 'bodies', row.bodyc);
  if (fs.existsSync(file)) fs.unlinkSync(file);                       // the effect (native)
  P.weave(kernel, { cell: 'EVA·Figure', kind: 'gone', addr: `gone:${row.bodyc.slice(0, 16)}`, body: { bodyc: row.bodyc, unlinked: true }, of: [row.item] }); // the receipt (log)
  done++;
}
console.log(JSON.stringify({ owed: res.rows.length, performed: done }));
