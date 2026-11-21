// contact.mjs: inviting people from your local contacts, and knowing the moment each one arrives — with the contact
// information NEVER written to the shared log.
//
//   await invite(store, { identifier, label })     -> { token, identifier }   (the token goes in the link; the record is LOCAL)
//   await bind(h, key, { token, route })          -> entry                    (publishes only { tokenHash, key, route, sig })
//   await contacts(h, store)                       -> [{ identifier, label, key, route }]  (local invites × log binds)
//
// Why this never leaks: the identifier and label live ONLY in `store` — the device's encrypted local store (the engine backs
// this with browser-store secrets / fs-backend meta, sealed with the device key; it is never synced). The shared log carries
// only a bind entry whose body is { tokenHash, key, route, sig }: a hash, a public key, a route, and a signature over the raw
// token. Anyone who syncs the space sees "some token was claimed", but cannot learn the phone/email or name — that mapping
// exists solely on the inviter's device, keyed by the token.
import * as core from './vendor/pharos/core.mjs';
import * as I from './vendor/pharos/identity-pure.mjs';

const KIND = 'contact', CELL = 'DEF·Pattern';
const te = new TextEncoder();
const hex = (u) => [...u].map((b) => b.toString(16).padStart(2, '0')).join('');

function ensureKind(h) {
  if (!core.entries(h).some((e) => e.kind === 'kind' && e.body && e.body.name === KIND))
    core.weave(h, { cell: 'DEF·Figure', kind: 'kind', addr: `kind:${KIND}`, body: { name: KIND, cell: CELL } });
}

const tokenHash = (token) => hex(core.sha256(te.encode(`contact/1|${token}`)));
const bindMsg = (log, token, b) => te.encode(`contact-bind/1\n${log}\n${token}\n${b.key}\n${b.tokenHash}\n${b.route || ''}`);

/** a local store backed by a Map (tests, and any device-encrypted backend with the same two calls). */
export function memoryLocalStore() {
  const m = new Map();
  return { async get(k) { return m.get(k); }, async set(k, v) { m.set(k, v); } };
}

const INVITES_KEY = 'contact-invites';
const readInvites = async (store) => (await store.get(INVITES_KEY)) || [];
const writeInvites = async (store, v) => store.set(INVITES_KEY, v);

/** inviter: mint a token for a contact. The record { token, identifier, label } stays in the LOCAL store; nothing is woven. */
export async function invite(store, { identifier, label = '' } = {}) {
  if (!identifier) throw new core.PharosError('BAD_CONTACT', 'invite needs the contact identifier (phone/email)');
  const token = hex(globalThis.crypto.getRandomValues(new Uint8Array(32)));
  await writeInvites(store, [...await readInvites(store), { token, identifier, label }]);
  return { token, identifier };
}

/** invitee: claim the token, publishing this key and first route. The identifier is never sent or stored here. */
export async function bind(h, key, { token, route = '' }) {
  if (!key || !key.priv) throw new core.PharosError('BAD_CONTACT', 'bind needs the invitee\'s key');
  ensureKind(h);
  const body = { tokenHash: tokenHash(token), key: key.pub, route };
  body.sig = I.signBytes(key.priv, bindMsg(h.name, token, body));
  return core.weave(h, { cell: CELL, kind: KIND, addr: `contact:${tokenHash(token)}`, body });
}

/** verify a binding's signature covers the raw token (which only the token's holder has). */
export function verifyBind(h, e, token) {
  const b = e.body;
  if (!b || typeof b.key !== 'string' || typeof b.sig !== 'string' || typeof b.route !== 'string') return { ok: false, why: 'malformed' };
  if (tokenHash(token) !== b.tokenHash) return { ok: false, why: 'token does not match' };
  try { return I.verifyBytes(b.key, bindMsg(h.name, token, b), b.sig) ? { ok: true, key: b.key, route: b.route, tokenHash: b.tokenHash } : { ok: false, why: 'bad signature' }; }
  catch { return { ok: false, why: 'bad signature' }; }
}

/** inviter: which of my invites have arrived? Joins the LOCAL invite records with the bind entries in the log. */
export async function contacts(h, store) {
  const byHash = new Map();
  for (const e of core.fold(h).entries) if (e.kind === KIND && e.body && e.body.tokenHash && e.body.key) byHash.set(e.body.tokenHash, e);
  const out = [];
  for (const inv of await readInvites(store)) {
    const e = byHash.get(tokenHash(inv.token)); if (!e) continue;
    const v = verifyBind(h, e, inv.token); if (!v.ok) continue;
    out.push({ identifier: inv.identifier, label: inv.label || '', key: v.key, route: v.route });
  }
  return out;
}
