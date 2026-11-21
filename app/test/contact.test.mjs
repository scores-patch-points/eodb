// Contact privacy: the identifier and label are local-only and never reach the shared log, so sharing the space leaks nothing.
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
const logBodies = (h) => JSON.stringify(core.entries(h).map((e) => e.body));

test('1. an invite is local-only: nothing about the contact enters the log', async () => {
  const h = setup();
  const store = contact.memoryLocalStore();
  const { token, identifier } = await contact.invite(store, { identifier: 'sam@example.com', label: 'Sam' });
  assert.equal(core.entries(h).filter((e) => e.kind === 'contact').length, 0, 'invite weaves nothing');
  assert.ok(!logBodies(h).includes('sam@example.com'), 'identifier is not in the log');
  assert.ok(!logBodies(h).includes('Sam'), 'label is not in the log');
});

test('2. a bind publishes only { tokenHash, key, route, sig } — no contact info', async () => {
  const h = setup();
  const store = contact.memoryLocalStore();
  const { token } = await contact.invite(store, { identifier: 'sam@example.com', label: 'Sam' });
  const k = I.generateKey();
  await contact.bind(h, k, { token, route: 'relay:https://relay.example' });
  const bind = core.entries(h).find((e) => e.kind === 'contact');
  assert.deepEqual(Object.keys(bind.body).sort(), ['key', 'route', 'sig', 'tokenHash'], 'only these four fields');
  assert.ok(!logBodies(h).includes('sam@example.com'), 'identifier is not in the log');
  assert.ok(!logBodies(h).includes('Sam'), 'label is not in the log');
});

test('3. contacts joins the LOCAL invites with the log binds', async () => {
  const h = setup();
  const store = contact.memoryLocalStore();
  const { token } = await contact.invite(store, { identifier: 'sam@example.com', label: 'Sam' });
  const k = I.generateKey();
  await contact.bind(h, k, { token, route: 'relay:https://relay.example' });
  const found = await contact.contacts(h, store);
  assert.deepEqual(found, [{ identifier: 'sam@example.com', label: 'Sam', key: k.pub, route: 'relay:https://relay.example' }]);
});

test('4. sharing leaks nothing: the whole log a collaborator would sync holds no identifier or label', async () => {
  const h = setup();
  const store = contact.memoryLocalStore();
  const a = await contact.invite(store, { identifier: 'alice@x.com', label: 'Alice' });
  const b = await contact.invite(store, { identifier: 'bob@x.com', label: 'Bob' });
  await contact.bind(h, I.generateKey(), { token: a.token, route: 'relay:https://a.example' });

  for (const needle of ['alice@x.com', 'bob@x.com', 'Alice', 'Bob']) assert.ok(!logBodies(h).includes(needle), `"${needle}" must never be in the shared log`);

  assert.equal((await contact.contacts(h, store)).length, 1, 'only the claimed invite resolves');
  await contact.bind(h, I.generateKey(), { token: b.token, route: 'relay:https://b.example' });
  assert.equal((await contact.contacts(h, store)).length, 2, 'both resolve once both claim');
});

test('5. a holder of the wrong token cannot make a contact resolve', async () => {
  const h = setup();
  const store = contact.memoryLocalStore();
  const { token } = await contact.invite(store, { identifier: 'sam@example.com' });
  await contact.bind(h, I.generateKey(), { token: '00'.repeat(64), route: 'relay:https://evil.example' });
  assert.equal((await contact.contacts(h, store)).length, 0, 'a wrong-token binding is not matched');
});

test('6. a forged signature is refused', async () => {
  const h = setup();
  const store = contact.memoryLocalStore();
  const { token } = await contact.invite(store, { identifier: 'sam@example.com' });
  const k = I.generateKey();
  const e = await contact.bind(h, k, { token, route: 'relay:https://x.example' });
  assert.equal(contact.verifyBind(h, e, token).ok, true);
  assert.equal(contact.verifyBind(h, { body: { ...e.body, sig: '00'.repeat(128) } }, token).ok, false);
  assert.equal(contact.verifyBind(h, e, '11'.repeat(64)).ok, false, 'a different token is refused');
});
