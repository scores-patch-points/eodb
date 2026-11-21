import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openLog, say } from './db.mjs';
import { lend, give, revoke, group, disclose, permissions, grantsFor, renderPermissions } from './grant.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const TMP = process.env.TEST_TMP || path.join(here, '.test-tmp-grant');
const dir = path.join(TMP, 'db');

async function setup() {
  fs.rmSync(TMP, { recursive: true, force: true });
  const alice = await openLog({ dir, writer: 'alice', store: 'lazy' });
  await say(alice, 'add', 'contact:ana', { name: 'Ana', phone: '555-0101', email: 'ana@x.io' });
  return alice;
}
const open = (w) => openLog({ dir, writer: w, store: 'lazy' });

test('grant: per-user field-level disclosure (redacts unlisted fields)', async () => {
  const alice = await setup();
  const bob = await open('bob');
  await lend(alice, { to: 'bob', scope: { addr: 'contact:ana', fields: ['name'] } });

  const forBob = await disclose(dir, 'bob', 'contact:ana');
  assert.deepEqual(forBob.disclosed, { name: 'Ana' });
  assert.deepEqual(forBob.redacted.sort(), ['email', 'phone']);

  const forCarol = await disclose(dir, 'carol', 'contact:ana');
  assert.deepEqual(forCarol.disclosed, {});
  assert.deepEqual(forCarol.redacted.sort(), ['email', 'name', 'phone']);

  const forAlice = await disclose(dir, 'alice', 'contact:ana');
  assert.equal(forAlice.mine, true);
  assert.equal(forAlice.redacted.length, 0);
});

test('grant: a group discloses to its members, resolved live', async () => {
  const alice = await setup();
  await group(alice, 'team', ['bob', 'carol']);
  await lend(alice, { to: 'group:team', scope: { kind: 'contact' } });

  assert.deepEqual((await disclose(dir, 'bob', 'contact:ana')).redacted, []);
  assert.deepEqual((await disclose(dir, 'carol', 'contact:ana')).redacted, []);
  assert.ok((await disclose(dir, 'dave', 'contact:ana')).redacted.length > 0, 'dave is not a member');
});

test('grant: a member removed from a group loses access', async () => {
  const alice = await setup();
  await group(alice, 'team', ['bob', 'carol']);
  await lend(alice, { to: 'group:team', scope: { kind: 'contact' } });
  assert.deepEqual((await disclose(dir, 'carol', 'contact:ana')).redacted, []);

  await group(alice, 'team', ['bob']);   // supersedes membership
  assert.ok((await disclose(dir, 'carol', 'contact:ana')).redacted.length > 0);
});

test('grant: share duration (until) gates access', async () => {
  const alice = await setup();
  await lend(alice, { to: 'bob', scope: { addr: 'contact:ana' }, until: '2000-01-01T00:00:00Z' });
  const g = (await grantsFor(dir, 'bob'))[0];
  assert.equal(g.expired, true);
  assert.ok((await disclose(dir, 'bob', 'contact:ana')).redacted.length > 0);

  await lend(alice, { to: 'carol', scope: { addr: 'contact:ana' }, until: '2999-01-01T00:00:00Z' });
  assert.deepEqual((await disclose(dir, 'carol', 'contact:ana')).redacted, []);
});

test('grant: a lease is revoked; a gift is not', async () => {
  const alice = await setup();
  const bob = await open('bob');

  const lease = await lend(alice, { to: 'bob', scope: { addr: 'contact:ana' } });
  assert.deepEqual((await disclose(dir, 'bob', 'contact:ana')).redacted, []);
  await revoke(alice, lease.id);
  assert.ok((await disclose(dir, 'bob', 'contact:ana')).redacted.length > 0, 'revoked lease grants nothing');

  const gift = await give(alice, { to: 'bob', scope: { addr: 'contact:ana' } });
  await assert.rejects(() => revoke(alice, gift.id), /cannot be revoked/);
  assert.deepEqual((await disclose(dir, 'bob', 'contact:ana')).redacted, [], 'a gift survives');
});

test('grant: delegation is attenuated; exceeding the basis is invalid', async () => {
  const alice = await setup();
  const bob = await open('bob');
  const bobGrant = await lend(alice, { to: 'bob', scope: { kind: 'contact', fields: ['name', 'phone'] }, can: ['read', 'delegate'] });

  // a narrowing delegation is valid
  await lend(bob, { to: 'carol', scope: { kind: 'contact', fields: ['phone'] }, can: ['read'], basis: [bobGrant.id] });
  const carol = await disclose(dir, 'carol', 'contact:ana');
  assert.deepEqual(carol.disclosed, { phone: '555-0101' });
  assert.deepEqual(carol.redacted.sort(), ['email', 'name']);

  // a delegation that exceeds the basis (admin not granted) is invalid, not silent
  await lend(bob, { to: 'dave', scope: { kind: 'contact' }, can: ['read', 'admin'], basis: [bobGrant.id] });
  const daveGrant = (await grantsFor(dir, 'dave')).find((g) => g.can.includes('admin'));
  assert.equal(daveGrant.valid.ok, false);
  assert.match(daveGrant.valid.why, /exceeds the basis/);
  assert.ok((await disclose(dir, 'dave', 'contact:ana')).redacted.length > 0);
});

test('grant: permissions is a readable card, and renderPermissions is hyper-clear', async () => {
  const alice = await setup();
  await group(alice, 'team', ['bob']);
  await lend(alice, { to: 'group:team', scope: { kind: 'contact', fields: ['name'] }, can: ['read'] });

  const p = await permissions(dir, 'bob');
  assert.equal(p.groups[0].name, 'team');
  assert.equal(p.grants.length, 1);
  assert.match(p.grants[0].chain.map((c) => c.from).join(''), /alice/);

  const text = renderPermissions(p);
  assert.match(text, /Permissions for bob/);
  assert.match(text, /alice→group:team/);
  assert.match(text, /team: bob/);
  assert.match(text, /fields \[name\]/);
});
