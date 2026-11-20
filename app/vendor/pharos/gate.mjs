// gate: the admission check for a bridge. A segment may enter a scope only if every entry in it COUNTS there: signed by a key that is a root or
// holds a capability covering the entry's writer, address and time, and not revoked (lib/access.mjs). Without this a bridge is a way to
// inject entries. Portable (core + access + sync).
//
//   const admit = gate(replica, { roots });   await bridge(from, to, { admit });
// `replica` is the bridge node's own handle on the scope (keep it fetched from the destination so the gate sees the grants and
// revocations already there); the gate also remembers what it has admitted. Capability, signature and device-key entries are
// self-authenticating (they only ever grant what a valid chain allows) and pass; every other kind, retractions included, must count.
import * as core from './core.mjs';
import { verifyAccess } from './access.mjs';
import { heldMap } from './sync.mjs';

const META = new Set(['signature', 'capability', 'device-key']);

export function gate(h, { roots = {} } = {}) {
  const known = new Map();
  async function admit(name, ents, accepted = []) {
    const all = new Map(heldMap(h)); for (const e of known.values()) all.set(e.id, e); for (const e of accepted) all.set(e.id, e); for (const e of ents) all.set(e.id, e);
    const tmp = core.open(h.name, { writer: 'gate', store: core.memoryStore(), frame: false });
    core.appendTo(tmp, 'gate.phr', [...all.values()]);
    const r = verifyAccess(tmp, { roots });
    for (const e of ents) {
      if (META.has(e.kind)) continue;
      if (!r.counted.has(e.id)) { const u = r.uncounted.find((x) => x.id === e.id); return { ok: false, why: u ? u.why : 'does not count in this scope' }; }
    }
    for (const e of ents) known.set(e.id, e);
    return { ok: true };
  }
  // entries-level policy for lib/intake.mjs: which candidates count, judged together with everything this replica holds
  admit.filter = (replica, cands) => {
    const all = new Map(heldMap(replica)); for (const e of cands) all.set(e.id, e);
    const tmp = core.open(replica.name, { writer: 'gate', store: core.memoryStore(), frame: false }); core.appendTo(tmp, 'gate.phr', [...all.values()]);
    const r = verifyAccess(tmp, { roots }), ok = new Set(), why = new Map();
    for (const e of cands) { if (META.has(e.kind) || r.counted.has(e.id)) ok.add(e.id); else why.set(e.id, (r.uncounted.find((x) => x.id === e.id) || {}).why || 'does not count in this scope'); }
    return { ok, why };
  };
  return admit;
}
