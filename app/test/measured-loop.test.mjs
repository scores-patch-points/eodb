import test from 'node:test';
import assert from 'node:assert/strict';
import { makeMeasuredLoop } from '../measured-loop.mjs';

const trace = (xs, ceiling = 6) => {
  const loop = makeMeasuredLoop({ ceiling });
  const out = [];
  for (const x of xs) {
    loop.push(x);
    out.push(loop.verdict());
  }
  return out;
};

test('positive control: monotone decay keeps going', () => {
  const t = trace([8, 6, 5, 3, 2]);
  assert.deepEqual(t.map((v) => v.verdict),
    ['insufficient_history', 'decaying', 'decaying', 'decaying', 'decaying']);
  assert.ok(t[2].growth < 0);
});

test('negative control: monotone growth stops as diverging', () => {
  const t = trace([2, 3, 5]);
  assert.equal(t[1].verdict, 'diverging');
  assert.equal(t[2].verdict, 'diverging');
  assert.ok(t[2].growth > 0);
});

test('stillness is converged', () => {
  const t = trace([5, 5, 5]);
  assert.deepEqual(t.map((v) => v.verdict),
    ['insufficient_history', 'converged', 'converged']);
});

test('hitting zero is resolved', () => {
  const t = trace([3, 1, 0]);
  assert.deepEqual(t.map((v) => v.verdict),
    ['insufficient_history', 'decaying', 'resolved']);
});

test('a two-step limit cycle is cycling, not decay', () => {
  const t = trace([4, 2, 4, 2]);
  assert.equal(t[3].verdict, 'cycling');
  assert.equal(t[3].period, 2);
});

test('a three-step limit cycle is cycling', () => {
  const t = trace([1, 2, 3, 1, 2, 3]);
  assert.equal(t[5].verdict, 'cycling');
  assert.equal(t[5].period, 3);
});

test('the ceiling is the declared safety floor, not the operative stop', () => {
  const t = trace([10, 9, 8, 7, 6, 5], 4);
  assert.equal(t[3].verdict, 'ceiling');
});

test('a single round is insufficient history, not a verdict', () => {
  const t = trace([1]);
  assert.deepEqual(t.map((v) => v.verdict), ['insufficient_history']);
});

test('a degenerate all-zero prefix cannot be measured and yields no verdict', () => {
  const loop = makeMeasuredLoop({ ceiling: 6 });
  loop.push(0);
  assert.equal(loop.verdict().verdict, 'resolved');
});
