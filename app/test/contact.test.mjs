// Contact invites: mint a token, the invitee binds it to their key, and the inviter sees them arrive. Nothing uploads an address
// book; the token is the capability, and only its holder (who received it over the contact channel) can bind.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as core from '../vendor/pharos/core.mjs';
import * as I from '../vendor/pharos/identity-pure.mjs';
import * as contact from '../contact.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cells = JSON.parse(fs.readFileSync(path.join(here, '..', 'vendor', 'pharos', 'cells.json'), 'utf8'));
core.configure({ cells }); I.usePure();

const setup = () => core.open('eodb', { writer: 'me', store: core.memoryStore() });

test('1. invite -> bind -> the contact shows up with key and route', () => {
  const h = setup();
  const { token, identifier } = contact.invite(h, { identifier: 'sam@example.com', label: 'Sam' });
  const k = I.generateKey();
  contact.bind(h, k, { token, identifier: 'sam@example.com', route: 'relay:https://relay.example' });

  const found = contact.contacts(h, { tokens: [token] });
  assert.equal(found.length, 1);
  assert.equal(found[0].identifier, 'sam@example.com');
  assert.equal(found[0].key, k.pub);
  assert.equal(found[0].route, 'relay:https://relay.example');
});

test('2. the raw token never appears in the log, only its hash', () => {
  const h = setup();
  const { token } = contact.invite(h, { identifier: 'sam@example.com' });
  const all = JSON.stringify(core.entries(h).map((e) => e.body));
  assert.ok(!all.includes(token), 'raw token is not stored');
  assert.match(all, /[0-9a-f]{64}/, 'a hash is stored instead');
});

test('3. someone who does not hold the token cannot make the contact show up', () => {
  const h = setup();
  const { token } = contact.invite(h, { identifier: 'sam@example.com' });
  const attacker = I.generateKey();
  // the attacker guesses a token (they saw the invite entry, which holds only a hash) and binds with the wrong raw token
  contact.bind(h, attacker, { token: '00'.repeat(32), identifier: 'sam@example.com', route: 'relay:https://evil.example' });
  assert.equal(contact.contacts(h, { tokens: [token] }).length, 0, 'a wrong-token binding is not matched');
});

test('4. the binding is self-authenticating: wrong token or a forged signature is refused', () => {
  const h = setup();
  const { token } = contact.invite(h, { identifier: 'sam@example.com' });
  const k = I.generateKey();
  const e = contact.bind(h, k, { token, identifier: 'sam@example.com' });

  assert.equal(contact.verifyBind(h, e, token).ok, true, 'correct token verifies');
  assert.equal(contact.verifyBind(h, e, '11'.repeat(32)).ok, false, 'a different token is refused');
  assert.equal(contact.verifyBind(h, { body: { ...e.body, sig: '00'.repeat(128) } }, token).ok, false, 'a forged signature is refused');
});

test('5. several invites: each shows up only after its own token is claimed', () => {
  const h = setup();
  const a = contact.invite(h, { identifier: 'a@x.com' });
  const b = contact.invite(h, { identifier: 'b@x.com' });
  const ka = I.generateKey(), kb = I.generateKey();
  contact.bind(h, ka, { token: a.token, identifier: 'a@x.com' });
  // b not yet claimed
  const found = contact.contacts(h, { tokens: [a.token, b.token] });
  assert.equal(found.length, 1, 'only the claimed one shows up');
  assert.equal(found[0].identifier, 'a@x.com');
  contact.bind(h, kb, { token: b.token, identifier: 'b@x.com' });
  assert.equal(contact.contacts(h, { tokens: [a.token, b.token] }).length, 2, 'both show up once both claim');
});
