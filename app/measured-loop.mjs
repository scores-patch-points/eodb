// measured-loop.mjs — bound a repair loop by whether it is MEASURABLY doing anything, not by a hand-picked repeat count.
// One number per round: how much is still unresolved (for the chat, the falsifier's count of unsupported/contradicted claims).
// For a 1-D state the streaming DMD operator is A = Σ x_{k+1}·x_k / Σ x_k² — the same least-squares operator batch DMD fits —
// and its eigenvalue magnitude is the measured growth of the count round over round:
//   growth < 0   the count is measurably decaying  -> keep going   (surprise is reducing)
//   growth ~ 0   nothing is moving                  -> STOP: converged
//   growth > 0   the count is increasing            -> STOP: diverging   (a repair that makes things worse gets no more budget)
//   count = 0    -> STOP: resolved
//   a state that returns to rounds it just left     -> STOP: cycling     (a 1-D DMD fit reads a limit cycle as decay; found by equality instead)
// A hard ceiling is the declared safety floor (a budget is never implicit), not the operative stop. No threshold is hand-picked:
// STILLNESS_TOLERANCE is the numerical epsilon for "zero up to double-precision noise", never a value chosen to make a case pass.
export const STILLNESS_TOLERANCE = 1e-9;

const cyclePeriod = (rounds) => {
  const n = rounds.length;
  for (let p = 2; 2 * p <= n; p += 1) {
    let same = true;
    for (let i = 0; i < p && same; i += 1) same = rounds[n - 1 - i] === rounds[n - 1 - i - p];
    if (!same) continue;
    const block = rounds.slice(n - p);
    if (block.some((x) => x !== block[0])) return p;
  }
  return 0;
};

export function makeMeasuredLoop({ ceiling } = {}) {
  if (!Number.isFinite(ceiling) || ceiling < 1) throw new TypeError('makeMeasuredLoop: ceiling is the declared safety floor under the measured test — every loop is bounded, never implicitly');
  const rounds = [];
  const push = (issueCount) => {
    if (!Number.isFinite(issueCount) || issueCount < 0) throw new TypeError('makeMeasuredLoop.push: a non-negative count of what remains unresolved');
    rounds.push(issueCount);
  };
  const verdict = () => {
    const n = rounds.length;
    if (n && rounds[n - 1] === 0) return { continue: false, verdict: 'resolved', rounds: n };
    const period = cyclePeriod(rounds);
    if (period) return { continue: false, verdict: 'cycling', rounds: n, period };
    if (n >= ceiling) return { continue: false, verdict: 'ceiling', rounds: n };
    if (n < 2) return { continue: true, verdict: 'insufficient_history', rounds: n };
    let K = 0, P = 0;
    for (let i = 0; i + 1 < n; i += 1) { K += rounds[i + 1] * rounds[i]; P += rounds[i] * rounds[i]; }
    if (P === 0) return { continue: true, verdict: 'insufficient_history', rounds: n, gap: 'degenerate_gram' };
    const mag = Math.abs(K / P);
    const growth = mag > 0 ? Math.log(mag) : -Infinity;
    if (growth > STILLNESS_TOLERANCE) return { continue: false, verdict: 'diverging', rounds: n, growth };
    if (Math.abs(growth) <= STILLNESS_TOLERANCE) return { continue: false, verdict: 'converged', rounds: n, growth };
    return { continue: true, verdict: 'decaying', rounds: n, growth };
  };
  return { push, verdict, get rounds() { return [...rounds]; } };
}
