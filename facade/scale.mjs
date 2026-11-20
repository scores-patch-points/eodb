// Scale probe: how long do say, ask and brief take as a log grows? Usage: PHAROS_SRC=... node scale.mjs <scratch-dir> N [N ...]
// It measures wall-clock time on this machine only. It is a probe, not a benchmark.
import fs from 'node:fs';
import path from 'node:path';
import { openLog, say, ask } from './db.mjs';

const [scratch, ...sizes] = process.argv.slice(2);
if (!scratch || !sizes.length) { console.error('usage: node scale.mjs <scratch-dir> N [N ...]'); process.exit(2); }
const ms = (t) => Math.round(Number(process.hrtime.bigint() - t) / 1e6);
const rows = [];
for (const N of sizes.map(Number)) {
  const dir = path.join(scratch, `scale-${N}`); fs.rmSync(dir, { recursive: true, force: true });
  const h = await openLog({ dir, writer: 'w1' });
  let t = process.hrtime.bigint();
  for (let i = 0; i < N; i++) await say(h, 'add', `item:${i}`, { n: i, label: `item number ${i}`, tag: i % 10 });
  const tWrite = ms(t);
  const bytes = fs.readdirSync(dir).reduce((s, f) => s + fs.statSync(path.join(dir, f)).size, 0);
  const timed = async (q) => { const t0 = process.hrtime.bigint(); const r = await ask(dir, q); return { ms: ms(t0), rows: r.card.rows }; };
  const all = await timed('SEG(sources; kinds: ["item"])');
  const filt = await timed('EVA(SEG(sources; kinds: ["item"]); where: tag = 3)');
  const agg = await timed('SYN(SEG(sources; kinds: ["item"]); by: ["tag"]; agg: {n: count(*)})');
  const one = await timed('SEG(sources; addr: "item:7")');
  rows.push({ N, writeMsTotal: tWrite, writeMsPerEntry: Math.round((tWrite / N) * 100) / 100, logBytes: bytes, readAll: all, readFiltered: filt, readAggregate: agg, readOneAddress: one });
  console.log(JSON.stringify(rows[rows.length - 1]));
  fs.rmSync(dir, { recursive: true, force: true });
}
