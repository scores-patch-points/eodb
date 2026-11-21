// agents.mjs — the wheel. The pharos is the EMPTY HUB (holds only entries, no logic).
// Spokes: khora perceives, janus reasons, penelope judges. Three independent loops, no orchestrator.
// Every spoke writes its ACTIVITY to the hub too (kind 'act'), so the pharos is the FULL audit log:
// intent, in-flight, and result of every organ — and glitches surface as anomalies in that log.
import fs from 'node:fs';
import path from 'node:path';
import { openSpace } from './app/engine.mjs';
import { fsBackend } from './app/fs-backend.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const POLL_MS = 150;
const dir = path.resolve('./spaces/wheel');
const passphrase = process.env.EODB_PASSPHRASE || 'wheel-space';
const cells = JSON.parse(fs.readFileSync('./app/vendor/pharos/cells.json', 'utf8'));
const names = JSON.parse(fs.readFileSync('./app/vendor/node-names.json', 'utf8'));

const askModel = async (user, system) => {
  const r = await fetch('http://127.0.0.1:11434/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gemma2:2b', stream: false, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], options: { temperature: 0.4 } }) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return ((await r.json()).message?.content || '').trim();
};
// penelope's EVA: catch emoji, markdown bold/italic/code, framing, banned words
const evaRules = (t) => { const v = []; t = String(t || ''); if (/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}]/u.test(t)) v.push('emoji'); if (/\*\*|__|`|^#{1,6}\s/m.test(t)) v.push('markdown'); if (/^[-*+]\s+/m.test(t)) v.push('bullet'); if (/as an (AI|language model|assistant)/i.test(t)) v.push('framing'); if (/genuinely|honestly|straightforward/i.test(t)) v.push('banned-word'); return { ok: v.length === 0, violations: v }; };
const recRules = (t) => String(t || '').replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}]/gu, '').replace(/\*\*|__|`/g, '').replace(/^#{1,6}\s+/gm, '').replace(/^[-*+]\s+/gm, '').replace(/as an (AI|language model|assistant)[^\n]*[.!?]?\s*/gi, '').replace(/genuinely|honestly|straightforward/gi, '').replace(/\n{3,}/g, '\n\n').trim();
const voice = (t) => recRules(t).replace(/^ANSWER:\s*/i, '').trim();

const space = await openSpace({ name: 'wheel', passphrase, backend: fsBackend(path.join(dir, 'store')), blobBackend: fsBackend(path.join(dir, 'blobs')), cells, names });
const K = (name, cell) => { if (!space.raw().some((e) => e.kind === 'kind' && e.body && e.body.name === name)) space.weaveRaw({ cell: 'DEF·Figure', kind: 'kind', addr: `kind:${name}`, body: { name, cell } }); };
for (const [n, c] of [['material', 'INS·Figure'], ['ground', 'INS·Figure'], ['mark', 'INS·Figure'], ['voice', 'INS·Figure'], ['act', 'DEF·Figure']]) K(n, c);

// seed the environment (raw material the organs will perceive)
space.weaveRaw({ cell: 'INS·Figure', kind: 'material', addr: 'material:goal', body: { text: 'Goal: design local-first conversation recall for EODB (a pharos-backed database with no server).' }, of: [] });
space.weaveRaw({ cell: 'INS·Figure', kind: 'material', addr: 'material:fact1', body: { text: 'Fact: the log is append-only; each device holds its own replica and merges by set union.' }, of: [] });
space.weaveRaw({ cell: 'INS·Figure', kind: 'material', addr: 'material:fact2', body: { text: 'Fact: recall must span ~1,000 messages with no central index or server.' }, of: [] });

// one spoke template: poll the hub; on work, log the ACT (audit), do the work, weave the product.
// Quiescence: exit only when there is no input for this organ AND no in-flight act from any organ.
// The act is written atomically with the work-claim (no await between find and weaveRaw), so an
// in-flight act is a reliable "someone is working" signal — no orchestrator, no clock.
async function spoke(organ, inputKind, outputKind, work) {
  while (true) {
    const raw = space.raw();
    const consumed = new Set(raw.filter((e) => e.kind === outputKind).map((e) => e.of[0]));
    const item = raw.find((e) => e.kind === inputKind && !consumed.has(e.id));
    if (item) {
      space.weaveRaw({ cell: 'DEF·Figure', kind: 'act', addr: `act:${organ}:${item.id.slice(0, 8)}`, body: { organ, did: `${inputKind}->${outputKind}`, on: item.id }, of: [item.id] });
      const body = await work(item, raw);
      space.weaveRaw({ cell: 'INS·Figure', kind: outputKind, addr: `${outputKind}:${item.id.slice(0, 8)}`, body, of: [item.id] });
      continue;
    }
    const products = new Set(raw.filter((e) => e.kind !== 'act').flatMap((e) => e.of || []));
    const busy = raw.some((e) => e.kind === 'act' && !products.has(e.body.on));
    if (!busy) return;
    await sleep(POLL_MS);
  }
}

const khora = () => spoke('khora', 'material', 'ground', async (m) => ({ perceived: m.body.text }));
const janus = () => spoke('janus', 'ground', 'mark', async (g, raw) => {
  const ctx = raw.filter((e) => e.kind === 'ground' || e.kind === 'mark').map((e) => e.body.perceived || e.body.text).join('\n');
  const mouth = await askModel('Perceived so far:\n' + ctx + '\n\nTake ONE next reasoning step.', 'You are the reasoner. Be additive.');
  return { text: voice(mouth) };
});
const penelope = () => spoke('penelope', 'mark', 'voice', async (m) => {
  const eva = evaRules(m.body.text);
  return { text: eva.ok ? m.body.text : recRules(m.body.text), verdict: eva.ok ? 'ok' : 'REC(' + eva.violations.join(',') + ')' };
});

// no orchestrator: launch the three spokes and let the hub go quiet on its own
await Promise.all([khora(), janus(), penelope()]);
await space.settle();

// ---- the full audit log is just the hub itself ----
console.log('=== FULL AUDIT LOG (the pharos, in causal order) ===');
for (const e of space.raw().filter((e) => ['material', 'ground', 'mark', 'voice', 'act'].includes(e.kind))) {
  const tag = e.kind === 'voice' ? `voice(${e.body.verdict})` : e.kind === 'act' ? `act:${e.body.organ}:${e.body.did}` : e.kind;
  console.log(`  ${tag.padEnd(28)} ${e.addr} | ${(e.body.text || e.body.perceived || '').slice(0, 58)}`);
}

// ---- glitches surface as anomalies in the log ----
console.log('\n=== GLITCH SCAN ===');
const raw = space.raw();
const orphans = raw.filter((e) => e.kind === 'act' && !raw.some((p) => p.kind !== 'act' && (p.of || []).includes(e.body.on)));
if (orphans.length) { for (const o of orphans) console.log(`  ORPHAN act (organ started, never finished): ${o.addr} (${o.body.organ} ${o.body.did})`); } else console.log('  no orphaned acts');
const unresolved = raw.filter((e) => e.kind === 'mark' && !raw.some((p) => p.kind === 'voice' && (p.of || []).includes(e.id)));
if (unresolved.length) console.log(`  ${unresolved.length} mark(s) with no voice (penelope missed them)`); else console.log('  every mark voiced');
console.log('  encrypted:', space.report().encrypted, '· entries:', space.report().entries);
space.close();
