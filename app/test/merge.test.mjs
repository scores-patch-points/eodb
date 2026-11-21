// Merging accounts through devices: the proof. Two accounts (root keys) each grant their own device a capability;
// their devices write signed entries. A merge is a pair of full cross-grants; the assertions below show that
// (1) both accounts together can merge and the result unifies the two identities, (2) a device holding only one
// account cannot, (3) a device holding neither cannot, (4) a merge can be reversed, and (5) it is idempotent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as core from '../vendor/pharos/core.mjs';
import * as I from '../vendor/pharos/identity-pure.mjs';
import * as A from '../vendor/pharos/access.mjs';
import { merge, mergeGrant, unmerge, merged, mergedRoots, merges } from '../merge.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cells = JSON.parse(fs.readFileSync(path.join(here, '..', 'vendor', 'pharos', 'cells.json'), 'utf8'));
core.configure({ cells });
I.usePure();

// A shared space with two accounts. Each account: a root key, a device key the root grants, and a `write` that appends a signed note.
function setup() {
  const store = core.memoryStore();
  const founder = core.open('eodb', { writer: 'founder', store });
  I.ensureKinds(founder);
  A.ensureKinds(founder);
  core.weave(founder, { cell: 'DEF·Figure', kind: 'kind', addr: 'kind:note', body: { name: 'note', cell: 'INS·Figure' } });
  const bridge = core.open('eodb', { writer: 'bridge', store });
  const account = (name) => {
    const root = I.generateKey();
    const dev = I.generateKey();
    const h = core.open('eodb', { writer: `${name}.t1`, store });
    A.grantCap(h, root, { subject: dev.pub, writer: `${name}.*`, scope: '*', rights: ['read', 'write', 'grant'] });
    let n = 0;
    const write = (text) => {
      const e = core.weave(h, { cell: 'INS·Figure', kind: 'note', addr: `note:${name}:${++n}`, body: { text } });
      I.signIds(h, dev, [e.id]);
      return e;
    };
    return { root, dev, name, h, write };
  };
  const alice = account('alice'), bob = account('bob');
  const counts = (pub, noteId) => A.verifyAccess(founder, { roots: { [pub]: true } }).counted.has(noteId);
  return { founder, bridge, alice, bob, counts };
}

test('1. two accounts merge through a bridge device that holds both keys; afterwards the two identities are one', () => {
  const { founder, bridge, alice, bob, counts } = setup();
  const a = alice.write('alice\'s note'), b = bob.write('bob\'s note');

  // before the merge each account is only its own world
  assert.equal(counts(alice.root.pub, a.id), true, 'alice counts her own note');
  assert.equal(counts(alice.root.pub, b.id), false, 'alice does not yet count bob\'s note');
  assert.equal(counts(bob.root.pub, b.id), true, 'bob counts his own note');
  assert.equal(counts(bob.root.pub, a.id), false, 'bob does not yet count alice\'s note');
  assert.equal(merged(founder, alice.root.pub, bob.root.pub), false);

  merge(bridge, alice.root, bob.root);

  assert.equal(merged(founder, alice.root.pub, bob.root.pub), true);
  assert.equal(counts(alice.root.pub, b.id), true, 'alice now counts bob\'s note');
  assert.equal(counts(bob.root.pub, a.id), true, 'bob now counts alice\'s note');

  // the crux: the set of entries that count is IDENTICAL no matter which account you trust
  const viaA = A.verifyAccess(founder, { roots: { [alice.root.pub]: true } });
  const viaB = A.verifyAccess(founder, { roots: { [bob.root.pub]: true } });
  const viaBoth = A.verifyAccess(founder, { roots: { [alice.root.pub]: true, [bob.root.pub]: true } });
  assert.deepEqual([...viaA.counted].sort(), [...viaB.counted].sort(), 'trusting alice and trusting bob count the same entries');
  assert.deepEqual([...viaA.counted].sort(), [...viaBoth.counted].sort(), 'and the same as trusting both');

  // entries written after the merge count too (the merge is forward-looking, not a snapshot)
  const b2 = bob.write('bob, after the merge');
  assert.equal(counts(alice.root.pub, b2.id), true);

  assert.deepEqual([...mergedRoots(founder, { roots: { [alice.root.pub]: true } })].sort(), [alice.root.pub, bob.root.pub].sort());
  const ms = merges(founder, { roots: { [alice.root.pub]: true } });
  assert.equal(ms.length, 1);
  assert.deepEqual([ms[0].a, ms[0].b].sort(), [alice.root.pub, bob.root.pub].sort());
});

test('2. the merge needs both devices: each account signs its own half; a device holding only one account cannot complete it', () => {
  const { founder, alice, bob, counts } = setup();
  const a = alice.write('alice\'s note'), b = bob.write('bob\'s note');

  // the two-device flow: alice's device publishes its half (a real grant, signed with alice's key)
  mergeGrant(alice.h, alice.root, { subject: bob.root.pub });
  assert.equal(merged(founder, alice.root.pub, bob.root.pub), false, 'one half is not a merge');
  assert.equal(counts(bob.root.pub, a.id), false, 'alice\'s half does not make bob trust alice');

  // an attacker holding only alice's key tries to forge bob's half: grantedBy=bob but signed with alice's private key
  mergeGrant(bob.h, { pub: bob.root.pub, priv: alice.root.priv }, { subject: alice.root.pub });
  assert.equal(merged(founder, alice.root.pub, bob.root.pub), false, 'a forged second half does not complete the merge');
  assert.equal(counts(bob.root.pub, a.id), false, 'and does not make bob trust alice');
  assert.equal(counts(alice.root.pub, b.id), true, 'alice\'s own (real) half still lets alice trust bob');

  // the real second half, signed by bob's key, completes it
  mergeGrant(bob.h, bob.root, { subject: alice.root.pub });
  assert.equal(merged(founder, alice.root.pub, bob.root.pub), true);
  assert.equal(counts(bob.root.pub, a.id), true);
});

test('3. a device holding neither account can merge nothing', () => {
  const { founder, alice, bob, counts } = setup();
  const a = alice.write('alice\'s note'), b = bob.write('bob\'s note');
  const rogue = I.generateKey();   // no root status, no grant from either account

  mergeGrant(founder, rogue, { subject: bob.root.pub });
  mergeGrant(founder, rogue, { subject: alice.root.pub });

  assert.equal(merged(founder, alice.root.pub, bob.root.pub), false);
  assert.equal(counts(alice.root.pub, b.id), false, 'a rogue grant does not admit bob');
  assert.equal(counts(bob.root.pub, a.id), false, 'nor alice');
  assert.deepEqual([...mergedRoots(founder, { roots: { [alice.root.pub]: true } })], [alice.root.pub]);
});

test('4. a merge can be reversed: each account revokes its own half, and the two worlds separate again', () => {
  const { founder, bridge, alice, bob, counts } = setup();
  const a = alice.write('alice\'s note'), b = bob.write('bob\'s note');
  const m = merge(bridge, alice.root, bob.root);
  assert.equal(counts(alice.root.pub, b.id), true);

  unmerge(bridge, alice.root, bob.root, m);

  assert.equal(merged(founder, alice.root.pub, bob.root.pub), false);
  assert.equal(counts(alice.root.pub, b.id), false, 'alice no longer counts bob');
  assert.equal(counts(bob.root.pub, a.id), false, 'bob no longer counts alice');
  assert.equal(counts(alice.root.pub, a.id), true, 'each still counts its own');
  assert.equal(counts(bob.root.pub, b.id), true);
});

test('5. a merge is idempotent and refuses a self-merge', () => {
  const { bridge, alice, bob } = setup();
  assert.throws(() => merge(bridge, alice.root, alice.root), /itself/);
  assert.throws(() => mergeGrant(bridge, alice.root, { subject: alice.root.pub }), /itself/);

  const m1 = merge(bridge, alice.root, bob.root);
  const m2 = merge(bridge, alice.root, bob.root);
  assert.equal(m1.aToB.id, m2.aToB.id, 're-merging weaves the same grant (deterministic signature)');
  assert.equal(m1.bToA.id, m2.bToA.id);
});
