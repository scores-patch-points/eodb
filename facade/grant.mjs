// grant.mjs: capabilities — the authorization layer over the log (gifts, leases, groups, field-level disclosure, durations).
// A grant is an ordinary signed entry (kind "grant", cell CON·Figure): it discloses a scope to a subject for a time.
//   subject: a writer, "group:<name>", or "*" (everyone)
//   scope:   { view? | kind? | addr?, fields? }  — a narrowing lattice: whole db > view > kind > addr > fields
//   can:     ["read" | "delegate" | "write" | "admin"]
//   duration: until (ISO) or for ("30m" / "7d" ...)
//   gift vs lease: a lease (default) is retractable; a gift is a copy and cannot be withdrawn
// Delegation (basis) is attenuated: a grant is valid only if it narrows what its basis granted (scope, can, and duration).
// Groups are entries (kind "group", cell DEF·Pattern) with a membership that resolves live, so removing a member ends their access.
import crypto from 'node:crypto';
import { libs, openRead } from './store.mjs';
import { get, forget } from './db.mjs';
import * as SG from './sign.mjs';

let E = null;
async function load() { if (!E) ({ E } = await libs()); }

export const GRANT_CELL = 'CON·Figure';
export const GROUP_CELL = 'DEF·Pattern';
export const CAN = ['read', 'delegate', 'write', 'admin'];

const canon = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x));
const typeOf = (addr) => (addr.includes(':') ? addr.slice(0, addr.indexOf(':')) : 'thing');

// ---- durations ---------------------------------------------------------------------------------------------------------
const UNIT = { s: 1e3, m: 6e4, h: 36e5, d: 864e5, w: 6048e5 };
function resolveUntil(until, dur, now = Date.now()) {
  if (until) return until;
  if (!dur) return null;
  const m = /^(\d+)([smhdw])$/.exec(String(dur));
  if (!m) throw new Error(`duration "${dur}" needs a number and unit (s, m, h, d, w)`);
  return new Date(now + UNIT[m[2]] * Number(m[1])).toISOString();
}
const expired = (g, now = Date.now()) => !!g.until && Date.parse(g.until) < now;

// ---- the scope lattice and attenuation ----------------------------------------------------------------------------------
function scopeWithin(child, parent) {
  if (parent.view && child.view !== parent.view) return false;
  if (parent.kind && child.kind !== parent.kind) return false;
  if (parent.addr && child.addr !== parent.addr) return false;
  if (parent.fields) {
    if (!child.fields) return false;   // child without a field list grants everything: wider
    for (const f of child.fields) if (!parent.fields.includes(f)) return false;
  }
  return true;
}
const canWithin = (child, parent) => child.every((c) => parent.includes(c));
const untilWithin = (child, parent) => !parent.until || (child.until && Date.parse(child.until) <= Date.parse(parent.until));
function scopeCovers(scope, addr) {
  if (scope.addr) return scope.addr === addr;
  if (scope.kind) return typeOf(addr) === scope.kind;
  return true;   // a view or an empty scope is coarse: it covers every address
}

// ---- weave (supersede the prior live entry at the same address; sign if the writer has a key) --------------------------
async function putKind(h, cell, kind, addr, body, of = []) {
  await load();
  let cited = of;
  if (!of.length) {
    const prior = h.liveAt(addr).filter((e) => e.by === h.by && e.kind === kind);
    const same = prior.find((e) => canon(e.body) === canon(body));
    if (same) return same;
    cited = prior.map((e) => e.id);
  }
  const e = h.weave({ cell, kind, addr, body, of: cited });
  if (h._hasKey === undefined) h._hasKey = SG.hasKey(h.dir, h.by);
  if (h._hasKey) SG.signEntry(h.dir, h.by, e.id);
  return e;
}

// ---- reads: live entries of a kind --------------------------------------------------------------------------------------
async function liveKind(dir, kind) {
  await load();
  const h = openRead(dir);
  try {
    const env = E.run(h, `SEG(sources; kinds: [${JSON.stringify(kind)}])`, { params: {} });
    const rows = env.rows.filter((r) => r._retracted === 0).map((r) => ({ id: r._id, by: r._by, addr: r._addr, body: r.body, of: r._of || [], at: r._at, pos: r._pos ?? 0 }));
    const head = new Map();
    for (const r of rows) { const p = head.get(r.addr); if (!p || r.pos > p.pos) head.set(r.addr, r); }   // one live entry per address (the causal head)
    return [...head.values()];
  } finally { E.close(h); }
}

// ---- grant / lend / give / revoke ---------------------------------------------------------------------------------------
const cleanScope = (scope = {}) => Object.fromEntries(Object.entries(scope).filter(([, v]) => v !== undefined && v !== null && (!Array.isArray(v) || v.length)));
const grantAddr = (from, to, scope, can, gift) => `grant:${from}:${to}:${crypto.createHash('sha256').update(canon([scope, can, !!gift])).digest('hex').slice(0, 12)}`;

async function makeGrant(h, { to, scope, can = ['read'], until, for: dur, basis = [], gift }) {
  if (!to) throw new Error('a subject (to) is required: a writer, group:<name>, or *');
  for (const c of can) if (!CAN.includes(c)) throw new Error(`unknown action "${c}"`);
  const body = { from: h.by, to, scope: cleanScope(scope), can, until: resolveUntil(until, dur), gift: !!gift, basis };
  return putKind(h, GRANT_CELL, 'grant', grantAddr(h.by, to, body.scope, can, gift), body, basis);
}
export async function lend(h, o) { return makeGrant(h, { ...o, gift: false }); }
export async function give(h, o) { return makeGrant(h, { ...o, gift: true }); }

export async function revoke(h, addrOrId) {
  await load();
  const target = await findGrant(h.dir, addrOrId);
  if (!target) throw new Error('no such grant');
  if (target.body.gift) throw new Error('a gift is a copy and cannot be revoked');
  return forget(h, target.addr);
}

async function findGrant(dir, addrOrId) {
  const rows = await liveKind(dir, 'grant');
  return rows.find((g) => g.addr === addrOrId || g.id === addrOrId) || null;
}

// ---- groups --------------------------------------------------------------------------------------------------------------
export async function group(h, name, members) {
  if (!name) throw new Error('a group needs a name');
  return putKind(h, GROUP_CELL, 'group', `group:${name}`, { name, members }, []);
}
async function groupRows(dir) {
  const rows = await liveKind(dir, 'group');
  const byName = new Map();
  for (const g of rows) byName.set(g.body.name, g.body.members || []);
  return byName;
}
function membersOf(groups, name, seen = new Set()) {
  if (seen.has(name)) return new Set();
  seen.add(name);
  const out = new Set();
  for (const m of groups.get(name) || []) {
    if (m.startsWith('group:')) for (const x of membersOf(groups, m.slice(6), seen)) out.add(x);
    else out.add(m);
  }
  return out;
}
async function subjectMatches(dir, groups, to, reader) {
  if (to === '*') return true;
  if (to === reader) return true;
  if (to.startsWith('group:')) return membersOf(groups, to.slice(6)).has(reader);
  return false;
}

// ---- the authority chain --------------------------------------------------------------------------------------------------
function chainFor(g, byId) {
  const chain = [g];
  const seen = new Set([g.id]);
  let cur = g;
  while (cur.basis && cur.basis.length) {
    const parent = cur.basis.map((id) => byId.get(id)).find(Boolean);
    if (!parent || seen.has(parent.id)) break;
    chain.unshift(parent);
    seen.add(parent.id);
    cur = parent;
  }
  return chain;
}
function validateChain(chain) {
  for (let i = 1; i < chain.length; i++) {
    const parent = chain[i - 1], child = chain[i];
    if (!scopeWithin(child.scope, parent.scope)) return { ok: false, why: `scope of ${child.to} exceeds the basis granted to ${parent.to}` };
    if (!canWithin(child.can, parent.can)) return { ok: false, why: `actions of ${child.to} exceed the basis granted to ${parent.to}` };
    if (!untilWithin(child, parent)) return { ok: false, why: `duration of ${child.to} exceeds the basis granted to ${parent.to}` };
  }
  return { ok: true };
}
const summarize = (g) => ({ id: g.id, addr: g.addr, from: g.from, to: g.to, scope: g.scope, can: g.can, until: g.until, gift: !!g.gift });

// ---- evaluation -----------------------------------------------------------------------------------------------------------
export async function grantsFor(dir, reader, { now = Date.now() } = {}) {
  await load();
  const rows = await liveKind(dir, 'grant');
  const groups = await groupRows(dir);
  const grants = rows.map((g) => ({
    id: g.id, by: g.by, addr: g.addr,
    from: g.body.from, to: g.body.to,
    scope: cleanScope(g.body.scope || {}),
    can: g.body.can || ['read'],
    until: g.body.until || null,
    gift: !!g.body.gift,
    basis: g.body.basis || [],
  }));
  const byId = new Map(grants.map((g) => [g.id, g]));
  const out = [];
  for (const g of grants) {
    if (!(await subjectMatches(dir, groups, g.to, reader))) continue;
    const chain = chainFor(g, byId);
    const valid = validateChain(chain);
    out.push({ ...summarize(g), chain: chain.map(summarize), valid, expired: expired(g, now), live: !expired(g, now) });
  }
  return out;
}

export async function permissions(dir, reader, { now = Date.now() } = {}) {
  const groups = await groupRows(dir);
  const list = [];
  for (const [name, members] of groups) list.push({ name, members: [...membersOf(groups, name)] });
  return { reader, now: new Date(now).toISOString(), groups: list, grants: await grantsFor(dir, reader, { now }) };
}

// disclose: what fields of a record is `reader` allowed to see, with the authority chains that admit each field.
// A reader always sees their own entries. A covering grant without a field list discloses every field; a grant with fields
// discloses only those. Sealed bodies are whole-body seals, so field disclosure does not reach inside them (a stated boundary).
export async function disclose(dir, reader, addr) {
  await load();
  const rec = await get(dir, addr, { who: reader });
  const mine = rec.history.some((h) => h.by === reader);
  const grants = await grantsFor(dir, reader);
  const covering = grants.filter((g) => g.valid.ok && g.live && scopeCovers(g.scope, addr));
  const fields = new Set();
  let all = mine;
  for (const g of covering) {
    if (!g.scope.fields) { all = true; break; }
    for (const f of g.scope.fields) fields.add(f);
  }
  const isObj = rec.current && typeof rec.current === 'object' && !Array.isArray(rec.current);
  const disclosed = (all || !isObj) ? rec.current : Object.fromEntries(Object.entries(rec.current).filter(([k]) => fields.has(k)));
  const redacted = (all || !isObj) ? [] : Object.keys(rec.current).filter((k) => !fields.has(k));
  return { addr, reader, mine, disclosed, redacted, hidden: rec.hidden, unreadSealed: rec.unreadSealed, chains: covering.map((g) => summarize(g)) };
}

export function renderPermissions(p) {
  const lines = [`Permissions for ${p.reader} (as of ${p.now})`];
  if (p.groups.length) { lines.push(''); lines.push('Groups:'); for (const g of p.groups) lines.push(`  ${g.name}: ${g.members.join(', ') || '(empty)'}`); }
  lines.push(''); lines.push('Grants:');
  if (!p.grants.length) lines.push('  (none)');
  for (const g of p.grants) {
    const scope = g.scope.addr || g.scope.kind ? `${g.scope.kind ? 'kind ' : ''}${g.scope.addr || g.scope.kind || ''}${g.scope.fields ? ' fields [' + g.scope.fields.join(',') + ']' : ''}` : (g.scope.view ? `view ${g.scope.view}` : 'everything');
    const chain = g.chain.map((c) => `${c.from}→${c.to}`).join(' › ') || `${g.from}→${g.to}`;
    lines.push(`  ${chain}  ${scope}  [${g.can.join(',')}]${g.until ? ' until ' + g.until : ''}  ${g.gift ? 'GIFT' : 'lease'}  ${g.valid.ok ? (g.expired ? 'EXPIRED' : 'live') : 'INVALID: ' + g.valid.why}`);
  }
  return lines.join('\n');
}
