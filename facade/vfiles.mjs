// vfiles.mjs: EODB managing the virtual files Proteus makes: today only the reading half (what exists, built or not, checked or not, contested). It reads ONLY pharos entries, by kind, through this facade.
// It imports nothing from any other repo and calls none: the shape of the `vfile` (SYN·Pattern) and `vfile-check` (EVA·Pattern) entries is the contract
// (Proteus, the repo that makes these files, documents the shapes in its docs/VFILE.md; this file needs none of its code).
//
//   vfile        addr vfile:<project>:<sequence>; body { project, sequence, projector, recipe, clips|..., where, size, header_sha256, chunks, file_sha256? }
//                size / header_sha256 / chunks are null when the recipe was woven without a build. `of` cites what it was made from.
//   vfile-check  addr vfile-check:<project>:<sequence>:<recipe prefix>; of = the vfile entry; body { recipe, result, expected, found?, missing?, ms? }
//                result: identical | differs | unavailable | recipe_mismatch | unrecorded
//
// What it answers, with retractions applied: which virtual files are live, whether any is contested (two live recipes at one address, by different writers),
// what each was made from, whether it was ever built, and whether its latest check is OF THE CURRENT RECIPE (a check of an older recipe says nothing about it).
import { readKind } from './db.mjs';

const live = (rows) => rows.filter((r) => !r._retracted);
const key = (r) => r._addr;
const newest = (rs) => rs.slice().sort((a, b) => (a._at < b._at ? -1 : a._at > b._at ? 1 : a._id < b._id ? -1 : 1)).at(-1) || null;

// the live rows of one kind, retractions applied (also used by vfmanage.mjs)
export async function liveRows(dir, kind, { who = 'reader' } = {}) { return live((await readKind(dir, kind, { who })).rows); }

export async function vfiles(dir, { who = 'reader' } = {}) {
  const V = live((await readKind(dir, 'vfile', { who })).rows), C = live((await readKind(dir, 'vfile-check', { who })).rows);
  const byAddr = new Map(); for (const r of V) { const l = byAddr.get(key(r)) || []; l.push(r); byAddr.set(key(r), l); }
  const out = [];
  for (const [addr, es] of byAddr) {
    const e = newest(es), b = e.body || {}, checks = C.filter((c) => c.body && c.body.project === b.project && c.body.sequence === b.sequence);
    const mine = newest(checks.filter((c) => c.body.recipe === b.recipe)), older = newest(checks.filter((c) => c.body.recipe !== b.recipe));
    out.push({
      addr, id: e._id, project: b.project, sequence: b.sequence, projector: b.projector, recipe: b.recipe,
      made_by: e._by, at: e._at, built: b.header_sha256 != null, size: b.size ?? null, inputs: Array.isArray(b.clips) ? b.clips.length : null, cites: e._of || [],
      contested: es.length > 1 && new Set(es.map((x) => x.body && x.body.recipe)).size > 1,
      check: mine ? { id: mine._id, result: mine.body.result, at: mine._at, by: mine._by, missing: mine.body.missing || null } : null,
      stale_check: !mine && older ? { id: older._id, result: older.body.result, of_recipe: older.body.recipe } : null,
    });
  }
  const tally = { files: out.length, unbuilt: 0, unchecked: 0, contested: 0, identical: 0, differs: 0, unavailable: 0, recipe_mismatch: 0, unrecorded: 0 };
  for (const f of out) { if (!f.built) tally.unbuilt++; if (!f.check) tally.unchecked++; else tally[f.check.result] = (tally[f.check.result] || 0) + 1; if (f.contested) tally.contested++; }
  return { files: out.sort((a, b) => (a.addr < b.addr ? -1 : 1)), tally };
}
