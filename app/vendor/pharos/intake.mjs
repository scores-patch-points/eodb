// intake: the one door entries from OUTSIDE come through (a carrier, a peer, a live channel). Portable (core only).
// Without a policy it keeps the old behaviour: valid entries are appended. With a policy (lib/gate.mjs), an entry enters the log only if it COUNTS
// there; until then it waits in a QUARANTINE with the reason, and is re-examined whenever more arrives, so a signature or grant that comes later
// releases it by itself. A replica's own writes never pass through here: you are not quarantined from your own log.
// The quarantine lives in memory and is bounded; a restart loses nothing, because a quarantined entry is still on the carrier or peer it came from
// and is simply received again.
import * as core from './core.mjs';

const Q = new WeakMap();
const held = (h) => { const m = new Set(); for (const f of h.store.list()) { try { for (const e of core.streamInfo(h, f).ents) m.add(e.id); } catch (err) { /* vanished */ } } return m; };

/** entries currently waiting, each { id, addr, kind, by, why } */
export function quarantined(h) { return [...(Q.get(h) || new Map()).values()].map((x) => ({ id: x.e.id, addr: x.e.addr, kind: x.e.kind, by: x.e.by, why: x.why })); }

/** @returns { accepted:[entry], quarantined:number (waiting now), rejected:number (not valid at all) } */
export function intake(h, ents, { policy = null, cap = 5000 } = {}) {
  const have = held(h); const q = Q.get(h) || Q.set(h, new Map()).get(h);
  let rejected = 0; const fresh = [];
  for (const e of ents) {
    if (!e || have.has(e.id) || q.has(e.id)) continue;
    if (core.invalidEntry(e)) { rejected++; continue; }
    if (policy) q.set(e.id, { e, why: 'not examined' }); else { have.add(e.id); fresh.push(e); }
  }
  if (!policy) { core.appendTo(h, h.writer + '.phr', fresh); return { accepted: fresh, quarantined: 0, rejected }; }
  const accepted = [];
  for (let progress = true; progress && q.size;) {
    progress = false;
    const cands = [...q.values()].map((x) => x.e), r = policy.filter(h, cands);
    const ok = cands.filter((e) => r.ok.has(e.id));
    for (const e of cands) if (!r.ok.has(e.id)) q.get(e.id).why = r.why.get(e.id) || 'does not count in this scope';
    if (ok.length) { for (const e of ok) q.delete(e.id); core.appendTo(h, h.writer + '.phr', ok); accepted.push(...ok); progress = true; }
  }
  while (q.size > cap) q.delete(q.keys().next().value); // bounded: the oldest waiting entry is dropped (it is still on its source)
  return { accepted, quarantined: q.size, rejected };
}
