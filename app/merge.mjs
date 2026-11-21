// merge.mjs: two accounts become one identity, through their devices. Portable (core + access + identity), no new kinds.
//
// An ACCOUNT is a root key (the trust anchor a reader believes from the start); a DEVICE is a key the account granted a capability to.
// Merging accounts A and B is exactly a pair of full cross-grants:
//
//     A → B   grantCap(h, A, { subject: B.pub, writer:'*', scope:'*', rights:[read,write,grant] })   signed by A's private key
//     B → A   grantCap(h, B, { subject: A.pub, writer:'*', scope:'*', rights:[read,write,grant] })   signed by B's private key
//
// Why this is a merge, and why it is secure:
//   - Each half is a capability whose signature is made with the grantor's own key. verifyAccess already drops any capability whose
//     signature does not verify against `grantedBy`, so a forged half simply never takes effect.
//   - A → B lets a reader who trusts A authorise B and everything B grants (transitively); B → A does the same for a reader who trusts B.
//     Together the two directions mean "A's world and B's world are the same world": a reader trusting either root sees, counts, and can
//     verify the exact same entries.
//   - Because BOTH directions are required, one account cannot absorb the other. A device holding only A's key can make A → B but can never
//     make B → A verify (it cannot sign with B's key). A full merge therefore proves control of both accounts: it is the two devices each
//     signing its own half — or one bridge device that holds both root keys.
import * as core from './vendor/pharos/core.mjs';
import * as A from './vendor/pharos/access.mjs';

/** one half of a merge: `grantor` ({pub, priv}) lets `subject` read, write, grant — everywhere, as anyone. Signed by grantor's own key. */
export function mergeGrant(h, grantor, { subject } = {}) {
  if (!grantor || !grantor.priv || !grantor.pub) throw new core.PharosError('BAD_MERGE', 'a merge grant needs the grantor\'s key (pub and priv)');
  if (typeof subject !== 'string' || !subject) throw new core.PharosError('BAD_MERGE', 'a merge grant needs a subject public key');
  if (subject === grantor.pub) throw new core.PharosError('BAD_MERGE', 'an account cannot be merged with itself');
  return A.grantCap(h, grantor, { subject, writer: '*', scope: '*', rights: ['read', 'write', 'grant'] });
}

/** merge two accounts in one step, from a bridge device that holds BOTH root keys. Returns the two capability entries. */
export function merge(h, keyA, keyB) {
  if (!keyA || !keyB) throw new core.PharosError('BAD_MERGE', 'merge needs both accounts\' keys');
  if (keyA.pub === keyB.pub) throw new core.PharosError('BAD_MERGE', 'an account cannot be merged with itself');
  return { aToB: mergeGrant(h, keyA, { subject: keyB.pub }), bToA: mergeGrant(h, keyB, { subject: keyA.pub }) };
}

/** undo a merge: each account revokes the half it granted. Returns the two retraction entries. */
export function unmerge(h, keyA, keyB, merged) {
  if (!merged || !merged.aToB || !merged.bToA) throw new core.PharosError('BAD_MERGE', 'unmerge needs the merge it reverses');
  return { aToB: A.revoke(h, keyA, merged.aToB.id, 'merge reversed'), bToA: A.revoke(h, keyB, merged.bToA.id, 'merge reversed') };
}

const isFull = (c) => !!c && Array.isArray(c.rights) && Array.isArray(c.scope)
  && c.rights.includes('read') && c.rights.includes('write') && c.rights.includes('grant')
  && c.scope.includes('*') && c.writer === '*';

/** a capability entry is a full merge grant (subject becomes a de facto root for whoever trusts the grantor). */
export function isMergeGrant(c) { return isFull(c); }

/** the valid full grants from `from` to `to`, judged under `roots` (verification reuses verifyAccess, so revoked grants are absent). */
function fullGrants(h, { roots }) {
  const { caps } = A.verifyAccess(h, { roots });
  return caps.filter((c) => isFull(c));
}

/** are accounts `a` and `b` mutually merged? true iff BOTH directions verify (each under its own grantor's root). */
export function merged(h, aPub, bPub) {
  const aToB = fullGrants(h, { roots: { [aPub]: true } }).some((c) => c.grantedBy === aPub && c.subject === bPub);
  const bToA = fullGrants(h, { roots: { [bPub]: true } }).some((c) => c.grantedBy === bPub && c.subject === aPub);
  return aToB && bToA;
}

/** the accounts a reader effectively trusts once merges are followed: the closure of `roots` under verified full cross-grants. */
export function mergedRoots(h, { roots = {} } = {}) {
  const caps = fullGrants(h, { roots });
  const mergedSet = new Set(Object.keys(roots));
  for (let changed = true; changed;) {
    changed = false;
    for (const c of caps) if (mergedSet.has(c.grantedBy) && !mergedSet.has(c.subject)) { mergedSet.add(c.subject); changed = true; }
  }
  return mergedSet;
}

/** every verified mutual merge in the log, as [{ a, b }] over the roots the reader trusts. */
export function merges(h, { roots = {} } = {}) {
  const caps = fullGrants(h, { roots });
  const dir = new Set(caps.map((c) => `${c.grantedBy}\u0000${c.subject}`));
  const out = [];
  for (const c of caps) if (dir.has(`${c.subject}\u0000${c.grantedBy}`) && c.grantedBy < c.subject) out.push({ a: c.grantedBy, b: c.subject });
  return out;
}
