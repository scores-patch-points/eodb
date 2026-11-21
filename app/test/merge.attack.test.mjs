// Trying to falsify the merge. Each test is an ATTACK: it must fail, and the assertion pins that the attack did not take effect.
// If any of these start passing, the merge is broken. They exercise the real verifier (access.mjs verifyAccess), not a re-implementation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as core from '../vendor/pharos/core.mjs';
import * as I from '../vendor/pharos/identity-pure.mjs';
import * as A from '../vendor/pharos/access.mjs';
import { merge, mergeGrant, merged, mergedRoots } from '../merge.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cells = JSON.parse(fs.readFileSync(path.join(here, '..', 'vendor', 'pharos', 'cells.json'), 'utf8'));
core.configure({ cells });
I.usePure();

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
    const write = (text) => { const e = core.weave(h, { cell: 'INS·Figure', kind: 'note', addr: `note:${name}:${++n}`, body: { text } }); I.signIds(h, dev, [e.id]); return e; };
    return { root, dev, name, h, write };
  };
  const alice = account('alice'), bob = account('bob');
  const counts = (pub, noteId) => A.verifyAccess(founder, { roots: { [pub]: true } }).counted.has(noteId);
  return { founder, bridge, alice, bob, counts };
}

// inject entries straight into a log, bypassing every write door (an attacker who already has raw write access to the store)
const inject = (h, entries) => core.appendTo(h, 'attack.phr', entries);
// a structurally valid copy of `entry` whose body was changed (id recomputed, signature NOT: it still carries the old sig)
const tamper = (entry, bodyPatch) => {
  const e = { ...entry, body: { ...entry.body, ...bodyPatch } };
  delete e.id;
  e.id = core.entryId(e);
  return e;
};

test('a. an attacker who knows both public keys but holds no private key can merge nothing', () => {
  const { founder, alice, bob, counts } = setup();
  const a = alice.write('alice'), b = bob.write('bob');
  // the attacker forges both halves with random signatures, grantedBy pointing at the real accounts
  const fake = { pub: alice.root.pub, priv: '00'.repeat(64) };   // wrong priv: the "signature" will not verify under alice's pub
  mergeGrant(founder, { pub: alice.root.pub, priv: '11'.repeat(64) }, { subject: bob.root.pub });
  mergeGrant(founder, { pub: bob.root.pub, priv: '22'.repeat(64) }, { subject: alice.root.pub });

  assert.equal(merged(founder, alice.root.pub, bob.root.pub), false);
  assert.equal(counts(alice.root.pub, b.id), false);
  assert.equal(counts(bob.root.pub, a.id), false);
  assert.deepEqual([...mergedRoots(founder, { roots: { [alice.root.pub]: true } })], [alice.root.pub]);
});

test('b. a merge grant does not replay across logs: signed for "eodb", it is dead in another space', () => {
  const { founder, alice, bob } = setup();
  const g = mergeGrant(founder, alice.root, { subject: bob.root.pub });   // valid in this space

  // a second, independent space with the same kinds
  const other = core.memoryStore();
  const oh = core.open('other', { writer: 'founder', store: other });
  I.ensureKinds(oh);
  A.ensureKinds(oh);
  inject(oh, [g]);   // the attacker replays alice's signed grant into another log

  const caps = A.verifyAccess(oh, { roots: { [alice.root.pub]: true } }).caps;
  assert.equal(caps.some((c) => c.grantedBy === alice.root.pub && c.subject === bob.root.pub), false, 'the replay is not accepted: the signature binds the log name');
});

test('c. changing a signed grant\'s target (or scope) does not reuse the signature: the forgery is dropped', () => {
  const { founder, alice, bob } = setup();
  const g = mergeGrant(founder, alice.root, { subject: bob.root.pub });   // alice signed "grant to bob"
  const eve = I.generateKey().pub;

  // attacker keeps alice's signature but points the grant at eve, and narrows the scope: structurally valid, wrong signature
  inject(founder, [tamper(g, { subject: eve })]);
  inject(founder, [tamper(g, { scope: ['note:alice:1'] })]);

  const caps = A.verifyAccess(founder, { roots: { [alice.root.pub]: true } }).caps;
  assert.equal(caps.some((c) => c.grantedBy === alice.root.pub && c.subject === eve), false, 'target substitution rejected');
  assert.equal(caps.some((c) => c.grantedBy === alice.root.pub && c.subject === bob.root.pub && c.scope.includes('*')), true, 'the real grant is untouched');
  assert.equal(caps.some((c) => c.grantedBy === alice.root.pub && c.scope.includes('note:alice:1')), false, 'scope narrowing rejected');
});

test('d. a one-sided grant is not a merge: alice may trust bob, but bob\'s world does not absorb alice without bob\'s consent', () => {
  const { founder, alice, bob, counts } = setup();
  const a = alice.write('alice'), b = bob.write('bob');

  mergeGrant(founder, alice.root, { subject: bob.root.pub });   // alice alone

  assert.equal(merged(founder, alice.root.pub, bob.root.pub), false, 'one half is not a merge');
  assert.equal(counts(alice.root.pub, b.id), true, 'alice chose to trust bob: his entries count for her');
  assert.equal(counts(bob.root.pub, a.id), false, 'but alice did NOT enter bob\'s world: consent is required in both directions');
});

test('e. copying a valid grant to a new address grants nothing new (idempotent duplication, not an escalation)', () => {
  const { founder, alice, bob } = setup();
  const g = mergeGrant(founder, alice.root, { subject: bob.root.pub });
  // the attacker re-publishes alice's grant under a different addr, same body and signature
  const dupe = { ...g, addr: `capability:${bob.root.pub.slice(0, 16)}:deadbeefdeadbeef` };
  delete dupe.id;
  dupe.id = core.entryId(dupe);
  inject(founder, [dupe]);

  const caps = A.verifyAccess(founder, { roots: { [alice.root.pub]: true } }).caps;
  assert.equal(caps.filter((c) => c.grantedBy === alice.root.pub && c.subject === bob.root.pub).length, 2, 'both copies verify, but they grant the same thing');
  assert.equal(merged(founder, alice.root.pub, bob.root.pub), false, 'and a duplicated half is still not a merge');
});

test('f. a perturbed signature is rejected by the verifier (no bit-flip forgery)', () => {
  const { founder, alice, bob } = setup();
  const g = mergeGrant(founder, alice.root, { subject: bob.root.pub });
  const sig = g.body.sig;
  const flipped = sig.slice(0, 127) + (sig[127] === '0' ? '1' : '0');
  inject(founder, [tamper(g, { sig: flipped })]);

  const caps = A.verifyAccess(founder, { roots: { [alice.root.pub]: true } }).caps;
  assert.equal(caps.some((c) => c.grantedBy === alice.root.pub && c.subject === bob.root.pub && c.id === undefined), false);
  assert.equal(caps.filter((c) => c.grantedBy === alice.root.pub && c.subject === bob.root.pub).length, 1, 'only the genuine grant survives');
});

test('g. a revoked grant does not merge, and its revocation survives a re-merge attempt by an attacker re-publishing the old bytes', () => {
  const { founder, bridge, alice, bob, counts } = setup();
  const b = bob.write('bob');
  const m = merge(bridge, alice.root, bob.root);
  assert.equal(counts(alice.root.pub, b.id), true);

  // alice reverses her half; the attacker immediately re-publishes the original grant bytes (the old entry id)
  A.revoke(founder, alice.root, m.aToB.id, 'reversed');
  inject(founder, [m.aToB]);   // the SAME entry id: grow-only, so this changes nothing (it is already held)

  assert.equal(merged(founder, alice.root.pub, bob.root.pub), false, 'the revoked half stays revoked');
  assert.equal(counts(alice.root.pub, b.id), false, 'alice no longer counts bob');
  assert.equal(counts(bob.root.pub, b.id), true, 'bob still counts himself');
});
