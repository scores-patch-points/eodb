// contact.mjs: inviting people from your local contacts, and knowing the moment each one arrives.
//   invite(h, { identifier, label })           -> { token, identifier }         (the token goes in the link you send)
//   bind(h, key, { token, identifier, route }) -> entry                        (the invitee claims it: identifier -> key -> route)
//   contacts(h, { tokens })                    -> [{ identifier, key, route }] (which of your invites have been claimed)
//
// The token is the capability. It is delivered only to the identifier (over SMS/email — the OS share sheet), so whoever can
// present it controls that identifier. The binding's signature covers the RAW token, so only its holder can bind; the log
// records only a hash, so an observer (or a scraped directory) cannot forge a claim. Nothing ever uploads the address book:
// the inviter checks exactly the tokens they minted.
import * as core from './vendor/pharos/core.mjs';
import * as I from './vendor/pharos/identity-pure.mjs';

const KIND = 'contact', CELL = 'DEF·Pattern';

function ensureKind(h) {
  if (!core.entries(h).some((e) => e.kind === 'kind' && e.body && e.body.name === KIND))
    core.weave(h, { cell: 'DEF·Figure', kind: 'kind', addr: `kind:${KIND}`, body: { name: KIND, cell: CELL } });
}

const hex = (u) => [...u].map((b) => b.toString(16).padStart(2, '0')).join('');
const tokenHash = (token) => hex(core.sha256(new TextEncoder().encode(`contact/1|${token}`)));
const bindMsg = (log, token, b) => new TextEncoder().encode(`contact-bind/1\n${log}\n${token}\n${b.identifier}\n${b.key}\n${b.route || ''}`);

/** inviter: mint a token for a contact. Returns the raw token (for the link); only its hash is recorded in the log. */
export function invite(h, { identifier, label = '' } = {}) {
  if (!identifier) throw new core.PharosError('BAD_CONTACT', 'invite needs the contact identifier (phone/email)');
  ensureKind(h);
  const token = hex(globalThis.crypto.getRandomValues(new Uint8Array(16)));
  core.weave(h, { cell: CELL, kind: KIND, addr: `contact:invite:${tokenHash(token)}`, body: { tokenHash: tokenHash(token), label } });
  return { token, identifier };
}

/** invitee: claim the token, binding this identifier to this key and first route. Signed over the raw token (proof of receipt). */
export function bind(h, key, { token, identifier, route = '' }) {
  if (!key || !key.priv) throw new core.PharosError('BAD_CONTACT', 'bind needs the invitee\'s key');
  ensureKind(h);
  const body = { identifier, key: key.pub, route, tokenHash: tokenHash(token) };
  body.sig = I.signBytes(key.priv, bindMsg(h.name, token, body));
  return core.weave(h, { cell: CELL, kind: KIND, addr: `contact:${tokenHash(token)}`, body });
}

/** verify a binding: signed by its key over the raw token (which only the token's holder has). */
export function verifyBind(h, e, token) {
  const b = e.body;
  if (!b || typeof b.key !== 'string' || typeof b.sig !== 'string' || typeof b.identifier !== 'string') return { ok: false, why: 'malformed' };
  if (tokenHash(token) !== b.tokenHash) return { ok: false, why: 'token does not match' };
  try { return I.verifyBytes(b.key, bindMsg(h.name, token, b), b.sig) ? { ok: true, identifier: b.identifier, key: b.key, route: b.route || '', tokenHash: b.tokenHash } : { ok: false, why: 'bad signature' }; }
  catch { return { ok: false, why: 'bad signature' }; }
}

/** inviter: which of my invites have been claimed? */
export function contacts(h, { tokens = [] } = {}) {
  const byHash = new Map();
  for (const e of core.fold(h).entries) if (e.kind === KIND && e.body && e.body.tokenHash && e.body.key) byHash.set(e.body.tokenHash, e);
  const out = [];
  for (const token of tokens) { const e = byHash.get(tokenHash(token)); if (!e) continue; const r = verifyBind(h, e, token); if (r.ok) out.push(r); }
  return out;
}
