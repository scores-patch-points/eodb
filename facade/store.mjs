// store.mjs: one small interface over two ways of keeping a pharos on disk.
//   plain: pharos's own writer files, one per writer (every write re-folds the log: simple, slow past a few thousand entries)
//   lazy:  pharos-lazy's placed store, vendored in the pharos repo under eoql/vendor/placed: entries are appended to a shard chosen
//          by address, and a write never loads the log (measured flat at under a millisecond per entry to 100,000 entries)
// Trade-off of lazy: it does not compute `seen` (the writer's causal frontier) on write, so causal order rests on `of` links alone.
// A handle has: dir, writer, by, store, uri (for EOQL), weave(entry), liveAt(addr), all().
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Sig } from './sig.mjs';

let P = null, E = null, PL = null;
export async function libs() {
  if (P) return { P, E, PL };
  const src = process.env.PHAROS_SRC;
  if (!src || !fs.existsSync(path.join(src, 'lib', 'pharos.mjs'))) throw new Error('Set PHAROS_SRC to a clone of the pharos repo (it needs lib/pharos.mjs and eoql/).');
  const imp = (...p) => import(pathToFileURL(path.join(src, ...p)).href);
  [P, E, PL] = await Promise.all([imp('lib', 'pharos.mjs'), imp('eoql', 'src', 'index.mjs'), imp('eoql', 'vendor', 'placed', 'placed.mjs')]);
  return { P, E, PL };
}

export const detect = (dir) => {
  if (fs.existsSync(path.join(dir, 'PLACEMENT.json'))) return 'lazy';
  if (fs.existsSync(dir) && fs.readdirSync(dir).some((f) => f.endsWith('.phr') || f.endsWith('.jsonl') || f.endsWith('.phb'))) return 'plain';   // .phr is pharos's binary core; the others are older formats
  return null;
};
// openRead: an EOQL handle to read a log. A lazy log is read by EOQL itself. A PLAIN (pharos) log is read through pharos's own library
// and handed to EOQL as entries: that works whatever the file format is (the EOQL engine's own `lib:` reader lists only legacy .jsonl files,
// so on pharos's binary core it sees an empty log). Needs libs() to have run.
export function openRead(dir) {
  const d = path.resolve(dir);
  if (detect(d) === 'plain') return E.openEntries(P.entries(P.open('db', { dir: d, writer: 'db-reader', frame: false })));
  return E.open(uriFor(d), { mode: 'read' });
}
export const uriFor = (dir) => `${detect(path.resolve(dir)) === 'lazy' ? 'lazy' : 'lib'}:${path.resolve(dir)}`;

const canon = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x));
const fromRow = (r) => ({ id: r._id, cell: r._cell, kind: r._kind, addr: r._addr, body: r.body, of: r._of || [], by: r._by, at: r._at, retracted: r._retracted === 1 });

export async function openStore({ dir, writer, store }) {
  await libs();
  if (!dir) throw new Error('--dir is required');
  if (!writer) throw new Error('--writer is required for writes');
  dir = path.resolve(dir);
  const kind = store || detect(dir) || process.env.DB_STORE || 'plain';
  if (kind !== 'plain' && kind !== 'lazy') throw new Error(`unknown store "${kind}" (plain or lazy)`);
  if (detect(dir) && detect(dir) !== kind) throw new Error(`${dir} is already a ${detect(dir)} store`);
  return kind === 'lazy' ? lazyStore(dir, writer) : plainStore(dir, writer);
}

function plainStore(dir, writer) {
  const ph = P.open('db', { dir, writer });
  return {
    dir, writer, by: ph.by, store: 'plain', uri: `lib:${dir}`, raw: ph,
    weave(entry) {
      try { return P.weave(ph, entry); }
      catch (e) {
        if (e.code !== 'UNDECLARED_KIND') throw e;
        P.weave(ph, { cell: 'DEF·Figure', kind: 'kind', addr: `kind:${entry.kind}`, body: { name: entry.kind, cell: entry.cell } });
        return P.weave(ph, entry);
      }
    },
    liveAt: (addr) => P.fold(ph, { addr }).entries,
    all: () => P.entries(ph),
  };
}

function lazyStore(dir, writer) {
  const fresh = !fs.existsSync(path.join(dir, 'PLACEMENT.json'));
  const hl = PL.openRoot(dir, { writer });
  const rows = (query) => { const r = E.open(`lazy:${dir}`, { mode: 'read' }); try { return E.run(r, query, { params: {} }).rows; } finally { E.close(r); } };
  const known = new Set();
  const sig = new Sig(dir, writer);   // the expressway: a cached causal frontier, advanced by reading only newly appended bytes
  const self = {
    dir, writer, by: writer, store: 'lazy', uri: `lazy:${dir}`, raw: hl, sig,
    liveAt(addr) { return rows(`SEG(sources; addr: ${JSON.stringify(addr)})`).map(fromRow).filter((e) => !e.retracted && e.kind !== 'retract'); },
    all() { return rows('DEF(SEG(sources); collapse: ["all"])').map(fromRow); },
    ensureKind(kind, cell) {
      if (known.has(kind) || ['frame', 'kind', 'holon', 'retract'].includes(kind)) return;
      if (!self.liveAt(`kind:${kind}`).length) hl.weave({ cell: 'DEF·Figure', kind: 'kind', addr: `kind:${kind}`, body: { name: kind, cell } });
      known.add(kind);
    },
    weave(entry) {
      self.ensureKind(entry.kind, entry.cell);
      const of = entry.of || [];
      // keep pharos's rule that saying the same thing twice is one entry (the placed store would append a duplicate with a new time)
      const same = self.liveAt(entry.addr).find((e) => e.by === writer && e.kind === entry.kind && e.cell === entry.cell && canon(e.body) === canon(entry.body) && canon([...e.of].sort()) === canon([...of].sort()));
      if (same && entry.kind !== 'retract') return same;
      // `seen` is the causal frontier. The placed store does not compute it (it never loads the log); the expressway supplies it.
      return hl.weave({ cell: entry.cell, kind: entry.kind, addr: entry.addr, body: entry.body, of, basis: entry.basis || {}, seen: sig.frontier() });
    },
  };
  if (fresh) hl.weave({ cell: 'NUL·Ground', kind: 'frame', addr: 'frame:db', body: { name: 'db', epoch: new Date().toISOString(), assumed: [] } });
  return self;
}
