// worker.mjs: a peer that reads the log and acts — stigmergy, not orchestration. No one schedules anything; a worker
// folds the pharos, finds triggers that are due and unclaimed, claims them (a claim is itself an entry), runs the graph,
// and writes the results back as entries. Any number of workers can run; the log's claims are the only coordination.
//
//   const { ran, skipped } = await tick(space, { fetch });   // one pass over due poll/schedule triggers
//   dueTriggers(space, now)                                   // the triggers this worker would act on
//
// A trigger is an immutable entry (kind auto-trigger). Whether it is due is DERIVED from the run history (auto-run entries),
// never stored in the trigger — so due-ness itself emerges from the log and is auditable.

const NOW = () => Date.now();
const view = (space) => space.view();
const entries = (space, op) => view(space).filter((e) => e.op === op);

function fieldMatch(f, v) {
  for (const part of String(f).split(',')) {
    const p = part.trim();
    if (p === '*') return true;
    if (p.startsWith('*/')) { const n = Number(p.slice(2)); if (n && v % n === 0) return true; }
    else if (p.includes('-')) { const [a, b] = p.split('-').map(Number); if (v >= a && v <= b) return true; }
    else if (Number(p) === v) return true;
  }
  return false;
}
export function cronMatches(expr, d) {
  const parts = String(expr).trim().split(/\s+/);
  if (parts.length !== 5) return false;
  return fieldMatch(parts[0], d.getMinutes()) && fieldMatch(parts[1], d.getHours()) && fieldMatch(parts[2], d.getDate()) && fieldMatch(parts[3], d.getMonth() + 1) && fieldMatch(parts[4], d.getDay());
}

/** live claims (until > now), keyed by trigger id. */
function liveClaims(space, now) {
  const live = new Set();
  for (const c of entries(space, 'auto-claim+')) if (c.body && c.body.trigger && (c.body.until || 0) > now) live.add(c.body.trigger);
  return live;
}

/** the last run entry for each trigger id (or automation name), from the run history. */
function lastRunByTrigger(space) {
  const last = new Map();
  for (const r of entries(space, 'auto-run+')) {
    const b = r.body || {};
    const key = b.triggerId || b.auto;
    if (!key) continue;
    const prev = last.get(key);
    if (!prev || (b.ts || 0) >= (prev.ts || 0)) last.set(key, { ts: b.ts || 0, id: r.id });
  }
  return last;
}

/** triggers due now, that no live claim covers. */
export function dueTriggers(space, now = NOW()) {
  const live = liveClaims(space, now);
  const lastRun = lastRunByTrigger(space);
  const out = [];
  for (const t of entries(space, 'auto-trigger+')) {
    const b = t.body || {};
    if (b.type !== 'poll' && b.type !== 'schedule') continue;
    if (live.has(b.id)) continue;
    const last = lastRun.get(b.id) || { ts: 0 };
    let due = false;
    if (b.type === 'poll') due = (b.intervalMs || 0) > 0 && (now - last.ts) >= (b.intervalMs || 0);
    else if (b.type === 'schedule') { const d = new Date(now); due = cronMatches(b.cron, d) && new Date(last.ts).getMinutes() !== d.getMinutes(); }
    if (due) out.push(t);
  }
  return out;
}

/** automation definitions by name (and id). */
export function automations(space) {
  const byName = new Map(), byId = new Map();
  for (const e of entries(space, 'auto+')) {
    const b = e.body || {};
    if (!b.nodes) continue;
    const g = { ...b, eid: e.id };
    if (b.name) byName.set(b.name, g);
    byId.set(e.id, g);
  }
  return { byName, byId };
}

/** one pass: claim each due trigger, run its automation, record. Returns { ran, skipped, errors }. */
export async function tick(space, ctx = {}, { claimMs = 60_000, now = NOW() } = {}) {
  const due = dueTriggers(space, now);
  const { byName, byId } = automations(space);
  const ran = [], skipped = [], errors = [];
  for (const t of due) {
    const b = t.body || {};
    const graph = byName.get(b.auto) || byId.get(b.auto);
    if (!graph) { skipped.push({ trigger: b.id, why: `no automation "${b.auto}"` }); continue; }
    space.append('auto-claim+', { trigger: b.id, worker: space.writer, at: now, until: now + claimMs });
    try {
      const r = await space.runAutomation({ ...graph, trigger: { type: b.type, cron: b.cron, intervalMs: b.intervalMs, path: b.path } }, { ...ctx, triggerId: b.id });
      ran.push({ trigger: b.id, runId: r.runId, ok: r.ok });
    } catch (e) { errors.push({ trigger: b.id, error: String(e && e.message || e) }); }
  }
  return { ran, skipped, errors };
}
