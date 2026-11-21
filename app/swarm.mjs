// swarm.mjs — the wheel. The pharos is the EMPTY HUB (holds only entries, no logic); the organs are SPOKES:
//   khora    perceives   material -> ground
//   janus    reasons     ground   -> mark   (the mouth — an askModel you supply)
//   penelope judges      mark     -> voice   (EVA then REC)
// Each spoke folds the log, claims work with an 'act' entry (written atomically with the claim — no await
// between find and weave), does its job, and writes the result back. No orchestrator, no clock, no sequence:
// quiescence is "no input for me AND no in-flight act". The hub is therefore the full audit log — every
// claim and result in causal order with of-links — so a glitch shows up as an anomaly (orphaned act, unvoiced
// mark), never a silent failure.

import { makeMeasuredLoop } from './measured-loop.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));


export const ORGAN_KINDS = [['material', 'INS·Figure'], ['ground', 'INS·Figure'], ['mark', 'INS·Figure'], ['voice', 'INS·Figure'], ['act', 'DEF·Figure']];

export function declareKinds(space) {
  for (const [name, cell] of ORGAN_KINDS)
    if (!space.raw().some((e) => e.kind === 'kind' && e.body && e.body.name === name))
      space.weaveRaw({ cell: 'DEF·Figure', kind: 'kind', addr: `kind:${name}`, body: { name, cell } });
}

/** the raw material the organs perceive — the input the wheel sits on (seeding is not orchestration). */
export function seedMaterial(space, items) {
  for (const it of items) space.weaveRaw({ cell: 'INS·Figure', kind: 'material', addr: it.addr, body: { text: it.text }, of: [] });
}

// penelope's judgment: EVA finds what breaks the voice, REC repairs it.
export function evaRules(t) {
  const v = []; t = String(t || '');
  if (/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}]/u.test(t)) v.push('emoji');
  if (/\*\*|__|`|^#{1,6}\s/m.test(t)) v.push('markdown');
  if (/^[-*+]\s+/m.test(t)) v.push('bullet');
  if (/as an (AI|language model|assistant)/i.test(t)) v.push('framing');
  if (/genuinely|honestly|straightforward/i.test(t)) v.push('banned-word');
  return { ok: v.length === 0, violations: v };
}
export function recRules(t) {
  return String(t || '')
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\*\*|__|`/g, '').replace(/^#{1,6}\s+/gm, '').replace(/^[-*+]\s+/gm, '')
    .replace(/as an (AI|language model|assistant)[^\n]*[.!?]?\s*/gi, '')
    .replace(/genuinely|honestly|straightforward/gi, '')
    .replace(/\n{3,}/g, '\n\n').trim();
}
export const voice = (t) => recRules(t).replace(/^ANSWER:\s*/i, '').trim();

/** one spoke: fold, claim, work, write back — until the hub is quiet. */
export async function spoke(space, { organ, input, output, work, cell = 'INS·Figure', pollMs = 5 }) {
  while (true) {
    const raw = space.raw();
    const consumed = new Set(raw.filter((e) => e.kind === output).map((e) => e.of && e.of[0]));
    const item = raw.find((e) => e.kind === input && !consumed.has(e.id));
    if (item) {
      space.weaveRaw({ cell: 'DEF·Figure', kind: 'act', addr: `act:${organ}:${item.id.slice(0, 8)}`, body: { organ, did: `${input}->${output}`, on: item.id }, of: [item.id] });
      const body = await work(item, raw);
      space.weaveRaw({ cell, kind: output, addr: `${output}:${item.id.slice(0, 8)}`, body, of: [item.id] });
      continue;
    }
    const products = new Set(raw.filter((e) => e.kind !== 'act').flatMap((e) => e.of || []));
    const busy = raw.some((e) => e.kind === 'act' && !products.has(e.body.on));
    if (!busy) return;
    await sleep(pollMs);
  }
}

export function khora(space) { return spoke(space, { organ: 'khora', input: 'material', output: 'ground', work: async (m) => ({ perceived: m.body.text }) }); }

export function janus(space, askModel) {
  return spoke(space, { organ: 'janus', input: 'ground', output: 'mark', work: async (g, raw) => {
    const ctx = raw.filter((e) => e.kind === 'ground' || e.kind === 'mark').map((e) => e.body.perceived || e.body.text).join('\n');
    // the mouth is measured: keep calling while the surprise (penelope's EVA violations) measurably decays, never a hand-set count.
    // each round is audited as an act entry, so the reasoning trail is in the hub. the best RAW mouth wins; penelope is the voice.
    const loop = makeMeasuredLoop({ ceiling: 6 });
    let best = null, lastV = '';
    for (let round = 0; ; round++) {
      const prompt = round === 0
        ? 'Perceived so far:\n' + ctx + '\n\nTake ONE next reasoning step.'
        : 'Perceived so far:\n' + ctx + '\n\nYour previous step was rejected (' + lastV + '). Take ONE corrected step.';
      const mouth = await askModel(prompt, 'You are the reasoner. Be additive.');
      const eva = evaRules(mouth);
      const surprise = eva.violations.length;
      if (!best || surprise < best.surprise) best = { text: mouth, surprise };
      space.weaveRaw({ cell: 'DEF·Figure', kind: 'act', addr: `act:janus:${g.id.slice(0, 8)}:r${round}`, body: { organ: 'janus', did: 'reason->mark', on: g.id, round, surprise, violations: eva.violations }, of: [g.id] });
      loop.push(surprise);
      if (!loop.verdict().continue) break;
      lastV = eva.violations.join(',');
    }
    return { text: best.text };
  } });
}

export function penelope(space) {
  return spoke(space, { organ: 'penelope', input: 'mark', output: 'voice', work: async (m) => {
    const eva = evaRules(m.body.text);
    return { text: eva.ok ? m.body.text : voice(m.body.text), verdict: eva.ok ? 'ok' : 'REC(' + eva.violations.join(',') + ')' };
  } });
}

/** run the three organs concurrently — no orchestrator. Returns after the hub goes quiet. */
export async function swarm(space, { askModel, material = [] } = {}) {
  declareKinds(space);
  if (material.length) seedMaterial(space, material);
  await Promise.all([khora(space), janus(space, askModel), penelope(space)]);
  await space.settle();
}

/** glitches surface as anomalies in the hub. */
export function glitches(space) {
  const raw = space.raw();
  const orphans = raw.filter((e) => e.kind === 'act' && !raw.some((p) => p.kind !== 'act' && (p.of || []).includes(e.body.on)));
  const unvoiced = raw.filter((e) => e.kind === 'mark' && !raw.some((p) => p.kind === 'voice' && (p.of || []).includes(e.id)));
  return { orphans, unvoiced };
}
