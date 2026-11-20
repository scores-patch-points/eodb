// Scale probe for the lazy store and the SIG structures, through the facade's own write path.
// Usage: PHAROS_SRC=... node scale2.mjs <scratch-dir> N     (a probe on one machine, not a benchmark)
import fs from 'node:fs';
import path from 'node:path';
import { openLog, say, ask, readKind, trace } from './db.mjs';
import { Sig } from './sig.mjs';
import { libs, uriFor } from './store.mjs';

const [scratch, nArg] = process.argv.slice(2); const N = Number(nArg);
if (!scratch || !N) { console.error('usage: node scale2.mjs <scratch-dir> N'); process.exit(2); }
const { E } = await libs();
const ms = (t) => Math.round(Number(process.hrtime.bigint() - t) / 1e5) / 10;
const dir = path.join(scratch, `scale2-${N}`); fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(dir + '.sig', { recursive: true, force: true });
const out = { N };

const h = await openLog({ dir, writer: 'w1', store: 'lazy' });
const marks = []; let seg = process.hrtime.bigint(); const step = Math.floor(N / 4);
const t0 = process.hrtime.bigint();
let chainLast = [];
for (let i = 0; i < N; i++) {
  const kind = i % 100 === 0 ? 'rare' : 'common';                       // 1% rare, 99% common
  await say(h, 'add', `${kind}:${i}`, { n: i, label: `item ${i}` });
  if ((i + 1) % step === 0) { marks.push({ upTo: i + 1, msPerWrite: ms(seg) / step * 1 }); seg = process.hrtime.bigint(); }
}
out.writeTotalSec = Math.round(Number(process.hrtime.bigint() - t0) / 1e8) / 10; out.msPerWriteBySlice = marks.map((m) => Math.round(m.msPerWrite * 100) / 100);
let prev = []; let last;
for (let i = 0; i < 1000; i++) { last = await say(h, 'link', `chain:${i}`, { i }, { of: prev }); prev = [last.id]; }
h.sig.flush();
out.shardFiles = fs.readdirSync(path.join(dir, 'w1')).length; out.logMB = Math.round(fs.readdirSync(path.join(dir, 'w1')).reduce((s, f) => s + fs.statSync(path.join(dir, 'w1', f)).size, 0) / 1e4) / 100;
out.sigStateMB = Math.round(fs.statSync(path.join(dir + '.sig', 'w1.json')).size / 1e4) / 100;

const timed = async (f) => { const t = process.hrtime.bigint(); const r = await f(); return { ms: ms(t), r }; };
// expressway: a cold scan of the whole log vs reloading the saved state vs a warm tail scan
fs.rmSync(path.join(dir + '.sig', 'cold.json'), { force: true });
const cold = await timed(async () => new Sig(dir, 'cold').advance()); out.sigColdBuildMs = cold.ms;
new Sig(dir, 'cold').flush();
const warm = await timed(async () => { const s = new Sig(dir, 'w1'); return s.advance(); }); out.sigReloadMs = warm.ms; out.sigReloadScannedBytes = warm.r.scanned;
// reads: the same question three ways
const q = 'SEG(sources; kinds: ["rare"])';
const full = await timed(async () => (await ask(dir, q)).card.rows); out.kindRare_fullScan = { ms: full.ms, rows: full.r };
const viaD = await timed(async () => (await readKind(dir, 'rare', { strategy: 'direct' })).rows.length); out.kindRare_direct = { ms: viaD.ms, rows: viaD.r };
const viaA = await timed(async () => { const r = await readKind(dir, 'rare'); return `${r.strategy}: ${r.rows.length} rows, est direct ${r.estimate.directMs} vs scan ${r.estimate.scanMs}`; }); out.kindRare_auto = { ms: viaA.ms, note: viaA.r };
const qc = 'SEG(sources; kinds: ["common"])';
const fullC = await timed(async () => (await ask(dir, qc)).card.rows); out.kindCommon_fullScan = { ms: fullC.ms, rows: fullC.r };
const dC = await timed(async () => (await readKind(dir, 'common', { strategy: 'direct' })).rows.length); out.kindCommon_direct = { ms: dC.ms, rows: dC.r };
const aC = await timed(async () => { const r = await readKind(dir, 'common'); return `${r.strategy}: ${r.rows.length} rows, est direct ${r.estimate.directMs} vs scan ${r.estimate.scanMs}`; }); out.kindCommon_auto = { ms: aC.ms, note: aC.r };
const c1 = await timed(async () => (await ask(dir, 'SEG(sources)', { cached: true })).card.cache); const c2 = await timed(async () => (await ask(dir, 'SEG(sources)', { cached: true })).card.cache);
out.askAll_cachedMiss = { ms: c1.ms, cache: c1.r }; out.askAll_cachedHit = { ms: c2.ms, cache: c2.r };
// wormhole: 1000-link chain, by positioned reads vs the query engine
const tw = await timed(async () => (await trace(dir, last.id))[0]); out.chain1000_wormhole = { ms: tw.ms, hops: tw.r.hops, ancestors: tw.r.ancestors.length };
const tq = await timed(async () => { const r = E.open(uriFor(dir), { mode: 'read' }); try { return E.run(r, `CON(SEG(sources; ids: [#${last.id.slice(0, 8)}]); follow: "of"; dir: "up"; depth: "*")`, { params: {} }).rows.length; } finally { E.close(r); } });
out.chain1000_queryEngine = { ms: tq.ms, ancestors: tq.r };
console.log(JSON.stringify(out, null, 1));
fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(dir + '.sig', { recursive: true, force: true });
