// Falsification: the RUNTIME fold (public/engine.js) — the one the React UI
// actually folds with — must keep the same invariants as src/fold.js after the
// entitiesByType index + checkpoint work. Because engine.js is a hand port, a
// divergence here would make the UI render differently from the canonical fold.

import { evalEngine, makeLog } from './helpers.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ME = evalEngine();

function fingerprint(state) {
  const ent = Object.entries(state.entities)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([a, e]) => [a, JSON.stringify(e)]);
  return JSON.stringify({
    entities: ent,
    partitions: Object.entries(state.partitions).sort(),
    connections: state.connections.map(c => `${c.source}>${c.target}#${c.type}`).sort(),
    frames: state.frames,
    schema: state.schema,
  });
}

test('engine fold: index ≡ scan and membership stable', () => {
  ME.setNamespace('io.matrix-events');
  const events = makeLog();
  const state = events.reduce(ME.dispatch, ME.initial());
  for (const type of ['task', 'note', '_synthesis']) {
    const idx = ME.entitiesOfType(state, type).map(e => e._anchor).sort();
    const scan = Object.values(state.entities).filter(e => e._type === type).map(e => e._anchor).sort();
    assert.deepEqual(idx, scan, `engine index vs scan for "${type}"`);
  }
  const before = ME.entitiesOfType(state, 'task').map(e => e._anchor).sort();
  const noIns = events.filter(e => !e.type.endsWith('.ins') && !e.type.endsWith('.syn'));
  const mutated = noIns.reduce(ME.dispatch, structuredClone(state));
  assert.deepEqual(ME.entitiesOfType(mutated, 'task').map(e => e._anchor).sort(), before);
});

test('engine fold: checkpoint seeding ≡ incremental fold (what app.jsx does)', () => {
  ME.setNamespace('io.matrix-events');
  const events = makeLog();
  // Mirrors foldCommitted: seed from checkpointed state, dispatch the tail.
  const incremental = events.reduce(ME.dispatch, ME.initial());
  for (const k of [2, 7, 13]) {
    const cp = events.slice(0, k).reduce(ME.dispatch, ME.initial());
    const base = structuredClone(cp);
    if (ME.ensureTypeIndex) ME.ensureTypeIndex(base);
    const seeded = events.slice(k).reduce(ME.dispatch, base);
    assert.equal(fingerprint(seeded), fingerprint(incremental), `engine checkpoint at ${k}`);
  }
});

test('engine fold: bulk-import rows are indexed under their entity type', () => {
  ME.setNamespace('io.matrix-events');
  const bulk = {
    type: 'io.matrix-events.ins',
    content: {
      anchor: 'imp_1',
      entity_type: 'row',
      payload: { name: 'x' },
      rows: [
        { _anchor: 'r_1', v: 1 },
        { _anchor: 'r_2', v: 2 },
      ],
    },
    origin_server_ts: 7000,
    sender: '@a:test',
    event_id: '$bulk',
  };
  const state = [bulk].reduce(ME.dispatch, ME.initial());
  assert.deepEqual(
    ME.entitiesOfType(state, 'row').map(e => e._anchor).sort(),
    ['r_1', 'r_2'],
    'bulk rows missing from the type index',
  );
});

test('engine rebuildTypeIndex restores a stripped index', () => {
  ME.setNamespace('io.matrix-events');
  const events = makeLog();
  const state = events.reduce(ME.dispatch, ME.initial());
  const stripped = structuredClone(state);
  delete stripped.entitiesByType;
  ME.ensureTypeIndex(stripped);
  assert.deepEqual(
    ME.entitiesOfType(stripped, 'task').map(e => e._anchor).sort(),
    ME.entitiesOfType(state, 'task').map(e => e._anchor).sort(),
  );
});