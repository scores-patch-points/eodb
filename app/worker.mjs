// worker.mjs: a peer that reads the log and acts — stigmergy, not orchestration. No one schedules anything; a worker
// folds the pharos, finds triggers that are due and unclaimed, claims them (a claim is itself an entry), runs the graph,
// and writes the results back as entries. Any number of workers can run — on one device or across the devices that share
// the space — and the log's causal structure is the only coordination.
//
//   await workerPass(space, { fetch });    // sync, act on due triggers + unhandled events, sync back — one pass
//   dueTriggers(space, now)                 // poll/schedule triggers this worker would act on
//   unhandledEvents(space)                  // webhook events no device has run yet
//
// TEMPORALITY IS CAUSAL, NOT A CLOCK. Every entry the pharos weaves records `seen` — the frontier of what its writer had
// observed (its lightcone). A claim is coordinated by causality, not a timestamp: a claim is *satisfied* once a run entry
// causally references it (`of`), and *superseded* once a later claim at the same address has it in its ancestry. So we know
// not just WHEN a device wanted to act, but WHAT WORLD it believed it was acting in — and a concurrent double-claim (two
// devices that had not yet seen each other) surfaces as a conflict on the shared address, deterministically ordered by id.

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

/** the causal ancestors of an entry (its `seen` and `of`, transitively) — its past lightcone. */
function ancestorsOf(byId, id) {
  const seen = new Set(), st = [id];
  while (st.length) {
    const cur = byId.get(st.pop()); if (!cur) continue;
    for (const p of [...(cur.of || []), ...(cur.seen || [])]) if (byId.has(p) && !seen.has(p)) { seen.add(p); st.push(p); }
  }
  return seen;
}

/** the causal claim state: which claim addresses are currently held by an unsatisfied, unsuperseded claim. */
export function activeClaims(space) {
  const byId = new Map(view(space).map((e) => [e.id, e]));
  const satisfied = new Set();
  for (const r of entries(space, 'auto-run+')) for (const id of (r.of || [])) satisfied.add(id);
  const byKey = new Map();
  for (const c of entries(space, 'auto-claim+')) {
    const b = c.body || {};
    const key = b.event ? `${b.trigger}\u0000${b.event}` : b.trigger;
    if (!key) continue;
    (byKey.get(key) || byKey.set(key, []).get(key)).push(c);
  }
  const active = new Set();
  for (const [key, list] of byKey) {
    for (const c of list) {
      if (satisfied.has(c.id)) continue;
      const superseded = list.some((o) => o.id !== c.id && ancestorsOf(byId, o.id).has(c.id));
      if (!superseded) { active.add(key); break; }
    }
  }
  return active;
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

/** poll/schedule triggers due now, that no live claim covers. */
export function dueTriggers(space, now = NOW()) {
  const active = activeClaims(space);
  const lastRun = lastRunByTrigger(space);
  const out = [];
  for (const t of entries(space, 'auto-trigger+')) {
    const b = t.body || {};
    if (b.type !== 'poll' && b.type !== 'schedule') continue;
    if (active.has(b.id)) continue;
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

/** webhook events no device has run yet: an event is "handled" once a run entry references its id. */
export function unhandledEvents(space) {
  const handled = new Set();
  for (const r of entries(space, 'auto-run+')) if (r.body && r.body.eventId) handled.add(r.body.eventId);
  return entries(space, 'auto-event+').filter((e) => e.body && !handled.has(e.id));
}

const resolveGraph = (byName, byId, auto) => byName.get(auto) || byId.get(auto);

/** claim each due poll/schedule trigger, run its automation, record. The claim `of`-references the trigger; the run `of`-references the claim. */
export async function tick(space, ctx = {}, { now = NOW() } = {}) {
  const due = dueTriggers(space, now);
  const { byName, byId } = automations(space);
  const ran = [], skipped = [], errors = [];
  for (const t of due) {
    const b = t.body || {};
    const graph = resolveGraph(byName, byId, b.auto);
    if (!graph) { skipped.push({ trigger: b.id, why: `no automation "${b.auto}"` }); continue; }
    const claim = space.append('auto-claim+', { trigger: b.id, worker: space.writer, at: now }, [t.id]);
    try {
      const r = await space.runAutomation({ ...graph, trigger: { type: b.type, cron: b.cron, intervalMs: b.intervalMs, path: b.path } }, { ...ctx, triggerId: b.id, claimId: claim.id });
      ran.push({ trigger: b.id, claim: claim.id, runId: r.runId, ok: r.ok });
    } catch (e) { errors.push({ trigger: b.id, error: String(e && e.message || e) }); }
  }
  return { ran, skipped, errors };
}

/** claim and run each unhandled webhook event that matches a trigger. */
export async function processEvents(space, ctx = {}, { now = NOW() } = {}) {
  const active = activeClaims(space);
  const { byName, byId } = automations(space);
  const triggers = entries(space, 'auto-trigger+');
  const ran = [], skipped = [], errors = [];
  for (const e of unhandledEvents(space)) {
    const b = e.body;
    for (const t of triggers) {
      const tb = t.body || {};
      if (tb.type !== 'webhook' || tb.path !== b.path) continue;
      if (active.has(`${tb.id}\u0000${e.id}`)) continue;
      const graph = resolveGraph(byName, byId, tb.auto);
      if (!graph) { skipped.push({ event: e.id, why: `no automation "${tb.auto}"` }); continue; }
      const claim = space.append('auto-claim+', { trigger: tb.id, event: e.id, worker: space.writer, at: now }, [t.id]);
      try {
        const r = await space.runAutomation({ ...graph, trigger: { type: 'webhook', path: b.path } }, { ...ctx, triggerId: tb.id, eventId: e.id, claimId: claim.id, triggerData: { path: b.path, body: b.body, headers: b.headers } });
        ran.push({ trigger: tb.id, event: e.id, claim: claim.id, runId: r.runId, ok: r.ok });
      } catch (err) { errors.push({ event: e.id, error: String(err && err.message || err) }); }
    }
  }
  return { ran, skipped, errors };
}

/** one coordinated pass: pull peers' entries, act on due triggers + unhandled events, publish results. */
export async function workerPass(space, ctx = {}, opts = {}) {
  if (space.syncOnce) { try { await space.syncOnce(); } catch { /* offline; act on the local log */ } }
  const t = await tick(space, ctx, opts);
  const e = await processEvents(space, ctx, opts);
  if (space.syncOnce) { try { await space.syncOnce(); } catch { /* offline; the next pass publishes */ } }
  return { poll: t.ran, pollSkipped: t.skipped, events: e.ran, eventSkipped: e.skipped, errors: [...t.errors, ...e.errors] };
}
