// Reads an eoql-result/1 JSON document on stdin and prints chosen columns (argv) as lines, plus the gaps and flags.
let s = '';
for await (const c of process.stdin) s += c;
let r;
try { r = JSON.parse(s); } catch { console.log(s.slice(0, 1500)); process.exit(0); }
if (r.error) { console.log(JSON.stringify(r.error).slice(0, 1500)); process.exit(0); }
const cols = process.argv.slice(2);
console.log('columns:', r.columns.map((c) => c.name).join(' '));
for (const row of r.rows) console.log((cols.length ? cols : Object.keys(row)).map((c) => String(row[c] ?? '').slice(0, 14)).join(' | '));
console.log('rows:', r.rows.length, 'gaps:', JSON.stringify(r.gaps || r.warnings || []).slice(0, 300), 'determined:', r.determined);
