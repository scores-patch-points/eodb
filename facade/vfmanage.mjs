// vfmanage.mjs: EODB MANAGING the virtual files Proteus makes. EODB decides what to keep and what to drop; it never builds a byte and never calls Proteus.
// It weaves two kinds, and Proteus reads them by kind and honours them (the pharos is the only line between them):
//   vfile-pin    DEF·Figure  addr vfile-pin:<recipe prefix>    body { recipe, why }   "hold this file's cached bytes"            of = the vfile entry
//   vfile-evict  SEG·Figure  addr vfile-evict:<recipe prefix>  body { recipe, why }   "set this file's cached bytes apart (drop them)"   of = the vfile entry
// Proteus answers with `vfile-evicted` (REC·Figure): { recipe, evict, result, chunks_removed, bytes, shared_kept }. Eviction is only a cache drop: the recipe stays in
// the ledger and the bytes rebuild from it. Retracting a pin or an evict request undoes the decision. The unit of management is the RECIPE (a file's identity).
// `plan` is a policy: it keeps the `keepLast` newest recipes per project and proposes to evict the rest unless pinned. keepLast is a STATED constant, not learned.
import crypto from 'node:crypto';
import { openLog, forget } from './db.mjs';
import { vfiles, liveRows } from './vfiles.mjs';

export const KINDS = { 'vfile-pin': 'DEF·Figure', 'vfile-evict': 'SEG·Figure' };
export const KEEP_LAST = 3;
const prefix = (recipe) => String(recipe).slice(0, 16);
const writer = (dir, by) => openLog({ dir, writer: by });

async function find(dir, recipe) {
  const f = (await vfiles(dir)).files.find((x) => x.recipe === recipe || x.recipe.startsWith(recipe));
  if (!f) throw new Error(`no live virtual file with recipe ${recipe}`);
  return f;
}

/** state of management for every live file: pinned, evict requested, and whether Proteus has acknowledged it */
export async function status(dir) {
  const [pins, evicts, acks] = await Promise.all(['vfile-pin', 'vfile-evict', 'vfile-evicted'].map((k) => liveRows(dir, k)));
  const files = (await vfiles(dir)).files.map((f) => {
    const ev = evicts.filter((e) => e.body && e.body.recipe === f.recipe).at(-1), ack = ev && acks.filter((a) => a.body && a.body.evict === ev._id).at(-1);
    return { addr: f.addr, recipe: f.recipe, pinned: pins.some((p) => p.body && p.body.recipe === f.recipe), evict_requested: !!ev, evict_id: ev ? ev._id : null, acknowledged: ack ? { result: ack.body.result, chunks_removed: ack.body.chunks_removed, bytes: ack.body.bytes, shared_kept: ack.body.shared_kept } : null };
  });
  return { files, tally: { files: files.length, pinned: files.filter((f) => f.pinned).length, evict_requested: files.filter((f) => f.evict_requested).length, acknowledged: files.filter((f) => f.acknowledged).length } };
}

export async function pin(dir, recipe, { why = '', by = 'eodb' } = {}) {
  const f = await find(dir, recipe), h = await writer(dir, by);
  return { id: h.weave({ cell: KINDS['vfile-pin'], kind: 'vfile-pin', addr: `vfile-pin:${prefix(f.recipe)}`, body: { recipe: f.recipe, why }, of: [f.id] }).id, recipe: f.recipe };
}
export async function unpin(dir, recipe, { by = 'eodb' } = {}) { const f = await find(dir, recipe), h = await writer(dir, by); await forget(h, `vfile-pin:${prefix(f.recipe)}`); return { recipe: f.recipe, unpinned: true }; }

/** ask for a file's cached bytes to be dropped. Refused while it is pinned (the refusal is the answer; nothing is woven). */
export async function evict(dir, recipe, { why = '', by = 'eodb' } = {}) {
  const f = await find(dir, recipe), st = (await status(dir)).files.find((x) => x.recipe === f.recipe);
  if (st.pinned) return { refused: 'pinned', recipe: f.recipe };
  if (st.evict_requested && !st.acknowledged) return { already: true, recipe: f.recipe, id: st.evict_id };
  const h = await writer(dir, by);
  return { id: h.weave({ cell: KINDS['vfile-evict'], kind: 'vfile-evict', addr: `vfile-evict:${prefix(f.recipe)}`, body: { recipe: f.recipe, why, nonce: crypto.randomBytes(6).toString('hex') }, of: [f.id] }).id, recipe: f.recipe };      // a nonce: saying the identical request twice is ONE entry in the pharos, and a request that was answered (refused) must be askable again
}
/** take an evict request back (the bytes, if already dropped, rebuild from the recipe on next use) */
export async function keepAfterAll(dir, recipe, { by = 'eodb' } = {}) { const f = await find(dir, recipe), h = await writer(dir, by); await forget(h, `vfile-evict:${prefix(f.recipe)}`); return { recipe: f.recipe, request_withdrawn: true }; }

/** the policy: per project, keep the newest `keepLast` recipes; the rest are candidates unless pinned or already requested */
export async function plan(dir, { keepLast = KEEP_LAST } = {}) {
  const st = new Map((await status(dir)).files.map((f) => [f.recipe, f])), files = (await vfiles(dir)).files, byProject = new Map();
  for (const f of files) { const l = byProject.get(f.project) || []; l.push(f); byProject.set(f.project, l); }
  const candidates = [], kept = [];
  for (const [, fs] of byProject) {
    fs.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
    fs.forEach((f, i) => { const s = st.get(f.recipe); if (s.pinned) kept.push({ recipe: f.recipe, reason: 'pinned' }); else if (s.evict_requested) kept.push({ recipe: f.recipe, reason: 'already requested' }); else if (i < keepLast) kept.push({ recipe: f.recipe, reason: 'recent' }); else candidates.push({ recipe: f.recipe, addr: f.addr, at: f.at }); });
  }
  return { keepLast, candidates, kept };
}
/** apply the plan: weave an evict request for each candidate */
export async function sweep(dir, { keepLast = KEEP_LAST, by = 'eodb', why = `beyond the newest ${keepLast} per project` } = {}) {
  const p = await plan(dir, { keepLast }), out = [];
  for (const c of p.candidates) out.push(await evict(dir, c.recipe, { why, by }));
  return { requested: out.filter((x) => x.id).length, refused: out.filter((x) => x.refused).length, plan: p };
}
