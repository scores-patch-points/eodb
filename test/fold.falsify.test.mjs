// Falsification: the checkpoint mechanism.
//
// The claim under test: "state(t) = fold(events[0..t])" must hold even when
// the prefix is restored from a checkpoint (a pre-folded state) instead of
// being re-folded from scratch. If checkpoint seeding ever diverges from a
// full fold — the same events must produce the same state — these tests fail.
//
// Two invariants, both falsifiable on the pre-change code:
//   1. Chronological cold path: fold(all) ≡ foldFrom(fold(prefix), tail)
//      (this is what a cold open uses when it seeds from a checkpoint).
//   2. Arrival-order live path: the incremental fold from an empty state
//      ≡ the incremental fold from a checkpoint at the same split point.

import { loadShim, makeLog, mkEvent } from './helpers.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

await loadShim();
const { fold, foldFrom, initial, entitiesOfType, rebuildTypeIndex, ensureTypeIndex } =
  await import('../src/fold.js');

function entitySnapshot(state) {
  // Stable fingerprint of the folded state, independent of key order.
  const ent = Object.entries(state.entities)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([anchor, e]) => [anchor, JSON.stringify({ ...e, _eventId: undefined })]);
  const parts = Object.entries(state.partitions).sort(([a], [b]) => (a < b ? -1 : 1));
  const conns = state.connections.map(c => `${c.source}>${c.target}#${c.type}`).sort();
  return JSON.stringify({
    cursor: state.cursor,
    entities: ent,
    partitions: parts,
    connections: conns,
    frames: state.frames,
    schema: state.schema,
  });
}

function assertSameFold(actual, expected, label) {
  assert.equal(entitySnapshot(actual), entitySnapshot(expected), `${label}: state divergence`);
  // The type index must be consistent too — a corrupted index would silently
  // change what table views render.
  const types = new Set([...Object.keys(expected.entitiesByType || {}), '_synthesis', 'task', 'note']);
  for (const type of types) {
    assert.deepEqual(
      entitiesOfType(actual, type).map(e => e._anchor).sort(),
      entitiesOfType(expected, type).map(e => e._anchor).sort(),
      `${label}: entitiesOfType("${type}") divergence`,
    );
  }
}

test('checkpoint fold ≡ full fold (chronological cold path)', () => {
  const events = makeLog();
  const full = fold(events);

  // Take checkpoints at several split points; each must reproduce the full fold.
  for (const k of [1, 3, 6, 12, events.length - 3, events.length]) {
    const cp = fold(events.slice(0, k));              // what a checkpoint stores
    const tail = events.slice(k);
    const seeded = foldFrom(structuredClone(cp), tail); // what cold open does
    assertSameFold(seeded, full, `checkpoint at ${k}/${events.length}`);
  }
});

test('checkpoint fold ≡ incremental fold (arrival-order live path)', () => {
  const events = makeLog();
  // The live path folds committed events in append order without re-sorting
  // against the prefix; a checkpoint must extend identically.
  const incremental = events.reduce((s, e) => foldFrom(s, [e]), initial());
  for (const k of [1, 5, 9, 15]) {
    const cp = events.slice(0, k).reduce((s, e) => foldFrom(s, [e]), initial());
    const seeded = events.slice(k).reduce((s, e) => foldFrom(s, [e]), structuredClone(cp));
    assertSameFold(seeded, incremental, `incremental checkpoint at ${k}`);
  }
});

test('entitiesOfType index ≡ full scan; index stable under non-INS ops', () => {
  const events = makeLog();
  const state = fold(events);
  const types = ['task', 'note', '_synthesis'];
  for (const type of types) {
    const viaIndex = entitiesOfType(state, type).map(e => e._anchor).sort();
    const viaScan = Object.values(state.entities).filter(e => e._type === type).map(e => e._anchor).sort();
    assert.deepEqual(viaIndex, viaScan, `index vs scan for "${type}"`);
  }
  // DEF/SEG/CON/EVA must not change membership or duplicate anchors.
  const before = entitiesOfType(state, 'task').map(e => e._anchor).sort();
  const mutated = events
    .filter(e => e.type !== 'io.matrix-events.ins' && e.type !== 'io.matrix-events.syn')
    .reduce((s, e) => foldFrom(s, [e]), structuredClone(state));
  const after = entitiesOfType(mutated, 'task').map(e => e._anchor).sort();
  assert.deepEqual(after, before, 'index membership changed under non-INS ops');
});

test('rebuildTypeIndex reconstructs a missing index (legacy checkpoint state)', () => {
  const events = makeLog();
  const full = fold(events);
  const legacy = structuredClone(full);
  delete legacy.entitiesByType; // what a pre-index checkpoint looks like

  ensureTypeIndex(legacy);
  assert.ok(legacy.entitiesByType, 'ensureTypeIndex did not restore the index');
  assert.deepEqual(
    entitiesOfType(legacy, 'task').map(e => e._anchor).sort(),
    entitiesOfType(full, 'task').map(e => e._anchor).sort(),
  );
  // The standalone rebuild helper must agree too.
  const rebuilt = rebuildTypeIndex(legacy.entities);
  assert.deepEqual(rebuilt['task'], full.entitiesByType['task']);
});

test('unknown/out-of-order events do not corrupt the index (fold idempotence)', () => {
  const events = makeLog();
  const dup = events.concat(events.slice(0, 2)); // duplicate events replayed
  const state = fold(dup);
  const viaIndex = entitiesOfType(state, 'task').map(e => e._anchor).sort();
  const viaScan = Object.values(state.entities).filter(e => e._type === 'task').map(e => e._anchor).sort();
  assert.deepEqual(viaIndex, viaScan, 'duplicate replay corrupted the index');
  // Replaying the same INS twice must not double-count the anchor.
  const insEv = mkEvent('io.matrix-events.ins', { anchor: 'x_1', entity_type: 'x', payload: {} }, 5000);
  const s = fold([insEv, insEv]);
  assert.equal(entitiesOfType(s, 'x').length, 1, 'duplicate INS double-indexed the anchor');
});