// access: who may do what, where, until when. Capabilities are ordinary entries; a delegation can only NARROW what its grantor holds.
// Portable (core + identity). Builds on identity.mjs (signatures over entry ids); this adds scope, rights, expiry and invite links.
//
//   capability   DEF·Pattern   body { subject, writer, scope:[prefix...], rights:[read|write|grant], from, until, grantedBy, sig }
//                sig = sign(grantedBy, "pharos-cap/1\n<log>\n<subject>\n<writer>\n<scopes>\n<rights>\n<from>\n<until>")
// An entry COUNTS iff a valid signature by key K vouches for it and K is a root, or holds a valid capability that
//   - lets it speak as the entry's writer, - has the write right, - covers the entry's address, - was live at the entry's own time.
// A capability is valid iff its signature is right and its grantor is a root, or holds a valid grant-capability that covers it
// (scope, rights, writer, from and until all within the grantor's). Revoking (retracting) one kills everything delegated from it.
// Time is judged at the ENTRY's `at`, so an expired key does not unwrite what it legitimately wrote. `at` is a device clock: this bounds
// honest mistakes and old keys, not a writer who lies about the time; stronger needs a checkpoint authority.
import * as core from './core.mjs';
import { generateKey, keyFromSeed, signBytes, verifyBytes, covers, signIds } from './identity.mjs';

const enc = (s) => new TextEncoder().encode(s);
// base64url without Buffer, so invite links work in a browser as well as in Node (the format is the same)
const toB64u = (str) => { const bytes = new TextEncoder().encode(str); let bin = ''; for (const b of bytes) bin += String.fromCharCode(b); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const fromB64u = (b64) => { const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4)); return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))); };
const arr = (x) => (Array.isArray(x) ? x : [x]);
const RIGHTS = ['read', 'write', 'grant'];

export function ensureKinds(h) {
  if (!core.entries(h).some((e) => e.kind === 'kind' && e.body && e.body.name === 'capability')) core.weave(h, { cell: 'DEF·Figure', kind: 'kind', addr: 'kind:capability', body: { name: 'capability', cell: 'DEF·Pattern' } });
}
const msg = (log, c) => enc(`pharos-cap/1\n${log}\n${c.subject}\n${c.writer}\n${[...c.scope].sort().join(',')}\n${[...c.rights].sort().join(',')}\n${c.from || ''}\n${c.until || ''}`);

/** weave a capability: `grantor` ({pub, priv}) lets `subject` speak as `writer` (a name or 'prefix.*') on addresses starting with `scope`, with `rights` */
export function grantCap(h, grantor, { subject, writer, scope = '*', rights = ['read', 'write'], from = null, until = null }) {
  ensureKinds(h);
  if (!rights.every((r) => RIGHTS.includes(r))) throw new core.PharosError('BAD_RIGHTS', `rights must be among ${RIGHTS.join(', ')}`);
  const c = { subject, writer, scope: arr(scope), rights: [...rights], from, until, grantedBy: grantor.pub };
  c.sig = signBytes(grantor.priv, msg(h.name, c));
  return core.weave(h, { cell: 'DEF·Pattern', kind: 'capability', addr: `capability:${subject.slice(0, 16)}:${c.sig.slice(0, 12)}`, body: c });
}
/** revoke: retract the capability entry (and so everything delegated from it), signed by `key`, which must be a root, the grantor, or a holder of a covering grant right */
export function revoke(h, key, capEntryId, why = 'revoked') {
  const e = core.weave(h, { cell: 'NUL·Figure', kind: 'retract', addr: `retract:${capEntryId.slice(0, 12)}`, of: [capEntryId], body: { why } });
  signIds(h, key, [e.id]); // sign ONLY the retraction: a revoker must not endorse everyone else's entries
  return e;
}

const scopeCovers = (parent, child) => child.every((s) => parent.some((p) => p === '*' || (s !== '*' && s.startsWith(p))));
const narrows = (d, c) => scopeCovers(d.scope, c.scope) && c.rights.every((r) => d.rights.includes(r)) && covers(d.writer, c.writer)
  && (d.until == null || (c.until != null && c.until <= d.until)) && (d.from == null || (c.from != null && c.from >= d.from));

function validFrom(capEntries, roots) {
  const valid = []; const isRoot = (pub) => !!roots[pub];
  for (let changed = true; changed;) {
    changed = false;
    for (const e of capEntries) {
      if (valid.includes(e)) continue;
      const c = e.body;
      if (isRoot(c.grantedBy) || valid.some((d) => d.body.subject === c.grantedBy && d.body.rights.includes('grant') && narrows(d.body, c))) { valid.push(e); changed = true; }
    }
  }
  return valid;
}

// Everything is computed from ALL entries, never from core.fold: a retraction only takes effect if it is itself authorised.
function analyse(h, roots) {
  const all = core.entries(h);
  const vouched = new Map();
  for (const s of all.filter((e) => e.kind === 'signature' && e.body && Array.isArray(e.body.ids))) {
    const valid = verifyBytes(s.body.key, enc(`pharos-sig/1\n${h.name}\n${[...s.body.ids].sort().join('\n')}`), s.body.sig);
    for (const id of s.body.ids) (vouched.get(id) || vouched.set(id, []).get(id)).push({ key: s.body.key, valid });
  }
  const capEntries = all.filter((e) => e.kind === 'capability' && e.body && typeof e.body.subject === 'string' && Array.isArray(e.body.scope) && Array.isArray(e.body.rights) && verifyBytes(e.body.grantedBy, msg(h.name, e.body), e.body.sig));
  const retracts = all.filter((e) => e.kind === 'retract');
  let revoked = new Set();
  for (let round = 0; round < 8; round++) { // revocations can depend on keys that other revocations remove: iterate to a fixpoint
    const caps = validFrom(capEntries.filter((c) => !revoked.has(c.id)), roots);
    const next = new Set();
    for (const r of retracts) for (const t of r.of) {
      const target = capEntries.find((c) => c.id === t); if (!target) continue;
      const may = (vouched.get(r.id) || []).filter((x) => x.valid).some((x) => roots[x.key] || (x.key === target.body.grantedBy && caps.some((d) => d.body.subject === x.key)) || caps.some((d) => d.body.subject === x.key && d.body.rights.includes('grant') && narrows(d.body, target.body)));
      if (may) next.add(t);
    }
    if (next.size === revoked.size && [...next].every((x) => revoked.has(x))) break;
    revoked = next;
  }
  const caps = validFrom(capEntries.filter((c) => !revoked.has(c.id)), roots).map((e) => ({ id: e.id, ...e.body }));
  return { all, vouched, caps, retracts };
}

/** @param roots { <pub>: true } keys believed from the start (all rights, everywhere). @returns { counted:Set<id>, uncounted:[{id, why}], caps } */
export function verifyAccess(h, { roots = {} } = {}) {
  const { all, vouched, caps, retracts } = analyse(h, roots);
  const counted = new Set(), uncounted = [];
  for (const e of all) {
    if (e.kind === 'signature' || e.kind === 'capability' || e.kind === 'device-key') continue;
    const v = vouched.get(e.id) || [];
    if (!v.length) { uncounted.push({ id: e.id, why: 'unsigned' }); continue; }
    if (!v.some((x) => x.valid)) { uncounted.push({ id: e.id, why: 'bad signature' }); continue; }
    let best = { stage: 0, why: 'signer not authorized' }, ok = false;
    for (const x of v.filter((y) => y.valid)) {
      if (roots[x.key]) { ok = true; break; }
      for (const c of caps.filter((k) => k.subject === x.key)) {
        let st = 1, why = 'key may not speak as this writer';
        if (covers(c.writer, e.by)) { st = 2; why = 'key has no write right';
          if (c.rights.includes('write')) { st = 3; why = 'outside the key\'s scope';
            if (scopeCovers(c.scope, [e.addr])) {
              if (c.from && e.at < c.from) { st = 4; why = 'capability not yet valid'; } else if (c.until && e.at > c.until) { st = 4; why = 'capability expired'; } else { ok = true; break; } } } }
        if (st > best.stage) best = { stage: st, why };
      }
      if (ok) break;
    }
    if (ok) counted.add(e.id); else uncounted.push({ id: e.id, why: best.why });
  }
  // a retraction of data takes effect only if it counted; capability retractions were handled above (and are authorised separately)
  const gone = new Set(); for (const r of retracts) if (counted.has(r.id)) for (const t of r.of) gone.add(t);
  for (const id of gone) counted.delete(id);
  return { counted, uncounted: uncounted.filter((u) => !gone.has(u.id)), caps };
}

/** may `pub` grant exactly this capability right now? (a root can; others only within a valid grant-capability that covers it) */
export function canGrant(h, pub, { writer, scope = '*', rights = ['read', 'write'], from = null, until = null }, { roots = {} } = {}) {
  if (roots[pub]) return true;
  const probe = { writer, scope: arr(scope), rights, from, until };
  return analyse(h, roots).caps.some((d) => d.subject === pub && d.rights.includes('grant') && narrows(d, probe));
}

/** may this key read addresses starting with `addr`? (the question key distribution asks before sealing a scope key to a device) */
export function canRead(h, pub, addr, { roots = {}, at = new Date().toISOString() } = {}) {
  if (roots[pub]) return true;
  return analyse(h, roots).caps.some((c) => c.subject === pub && c.rights.includes('read') && scopeCovers(c.scope, [addr]) && (!c.from || at >= c.from) && (!c.until || at <= c.until));
}

// ---- invite links ----------------------------------------------------------------------------------------------------
// A link carries a fresh key that the issuer has granted (with the right to grant down). Whoever holds the link can add ONE device of their
// own, under a name they pick, with at most what the link allows. Revoke the invite's capability and every device it admitted stops counting.
// A link cannot be limited to a single use by the log alone (that needs agreement); expiry and revocation are the controls.
export function createInvite(h, issuer, { scope, rights = ['read', 'write'], writer, until = null }) {
  if (!writer || !writer.endsWith('*')) throw new core.PharosError('BAD_INVITE', 'writer must be a prefix pattern like "friends.*"');
  const k = generateKey();
  const entry = grantCap(h, issuer, { subject: k.pub, writer, scope, rights: [...new Set([...rights, 'grant'])], until });
  const body = { log: h.name, seed: k.priv.slice(0, 64), pub: k.pub, writer, scope: arr(scope), rights, until };
  return { link: `pharos-invite:1:${toB64u(JSON.stringify(body))}`, pub: k.pub, entryId: entry.id };
}
export function parseInvite(link) {
  const m = /^pharos-invite:1:([A-Za-z0-9_-]+)$/.exec(String(link));
  if (!m) throw new core.PharosError('BAD_INVITE', 'not an invite link');
  const b = JSON.parse(fromB64u(m[1]));
  if (!b.seed || !b.pub || !b.writer) throw new core.PharosError('BAD_INVITE', 'incomplete invite');
  return b;
}
/** the redeemer adds their device under `name` (the invite key signs the grant). Returns the capability entry. */
export function redeem(h, link, { name, device }) {
  const b = parseInvite(link);
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(String(name))) throw new core.PharosError('BAD_NAME', 'name must be 1-32 letters, digits, - or _');
  const k = keyFromSeed(b.seed);
  if (k.pub !== b.pub) throw new core.PharosError('BAD_INVITE', 'invite key does not match');
  return grantCap(h, k, { subject: device, writer: b.writer.slice(0, -1) + name, scope: b.scope, rights: b.rights, until: b.until });
}
