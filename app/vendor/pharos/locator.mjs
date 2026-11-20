// locator: where a scope can be reached, as signed-able entries in the log, so the network map replicates like everything else.
// A device that finds ONE route learns all the others. Credentials are never here: they stay in the node.
import * as core from './core.mjs';

function declare(h) {
  if (!core.entries(h).some((e) => e.kind === 'kind' && e.body && e.body.name === 'locator')) core.weave(h, { cell: 'DEF·Figure', kind: 'kind', addr: 'kind:locator', body: { name: 'locator', cell: 'DEF·Pattern' } });
}
/** record that `scope` is reachable at `uri` (scheme:rest, e.g. matrix:!room:host, ap:https://host/actor, nostr:wss://relay, folder:/path) */
export function announce(h, { scope, uri, caps = {} }) {
  declare(h);
  return core.weave(h, { cell: 'DEF·Pattern', kind: 'locator', addr: `locator:${scope}:${uri}`, body: { scope, uri, caps } });
}
/** live locators for a scope: retractions applied, newest announcement per uri */
export function locators(h, scope) {
  const by = new Map();
  for (const e of core.fold(h).entries) if (e.kind === 'locator' && e.body && e.body.scope === scope) { const k = e.body.uri; const had = by.get(k); if (!had || e.at > had.at || (e.at === had.at && e.id > had.id)) by.set(k, e); }
  return [...by.values()].map((e) => ({ ...e.body, id: e.id }));
}
/**
 * Choose among locators given a registry of transport descriptors by scheme and requirements
 * { live, minDurable, forbidExposes }. Never guesses: a locator with an unknown scheme or an exposure you forbade is skipped WITH the reason,
 * and anything the chosen set cannot satisfy is listed in `unmet`.
 */
export function plan(locs, registry, { live = false, minDurable = 0, forbidExposes = [] } = {}) {
  const chosen = [], skipped = [], unmet = [];
  for (const l of locs) {
    const scheme = String(l.uri).split(':')[0]; const d = registry[scheme];
    if (!d) { skipped.push({ uri: l.uri, why: `unknown scheme "${scheme}"` }); continue; }
    const hit = forbidExposes.filter((x) => d.exposes.includes(x));
    if (hit.length) { skipped.push({ uri: l.uri, why: `exposes ${hit.join(', ')} to its operator` }); continue; }
    chosen.push({ ...l, descriptor: d });
  }
  if (live && !chosen.some((c) => c.descriptor.live)) unmet.push('no live transport satisfies the requirements');
  const durable = chosen.filter((c) => c.descriptor.durable).length;
  if (durable < minDurable) unmet.push(`only ${durable} durable transport(s) satisfy the requirements; ${minDurable} needed`);
  return { chosen, skipped, unmet };
}
