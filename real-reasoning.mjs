// real-reasoning.mjs — a real stigmergic reasoning run through the three organs.
//   khora    perceives  → SEG the saliency region, produce the ground (what the log holds so far)
//   janus    reasons    → the model (the mouth) produces the next reasoning step — the "mark"
//   penelope generates  → voice() cleans the mouth; evaRules judges it; recRules re-grounds on violation; then weave
import fs from 'node:fs';
import path from 'node:path';
import { openSpace } from './app/engine.mjs';
import { fsBackend } from './app/fs-backend.mjs';

const dir = path.resolve('./spaces/reasoning');
const passphrase = process.env.EODB_PASSPHRASE || 'reasoning-space';
const cells = JSON.parse(fs.readFileSync('./app/vendor/pharos/cells.json', 'utf8'));
const names = JSON.parse(fs.readFileSync('./app/vendor/node-names.json', 'utf8'));

const askModel = async (user, system) => {
  const r = await fetch('http://127.0.0.1:11434/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gemma2:2b', stream: false, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], options: { temperature: 0.4 } }) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  return ((j.message && j.message.content) || '').trim();
};

// --- penelope's organs (ported from the app) ---
const evaRules = (t) => { const v = []; t = String(t || ''); if (/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}]/u.test(t)) v.push('emoji'); if (/^[-*]\s/m.test(t)) v.push('bullet'); if (/as an (AI|language model|assistant)/i.test(t)) v.push('framing'); if (/genuinely|honestly|straightforward/i.test(t)) v.push('banned-word'); if (t.length > 600) v.push('too-long'); return { ok: v.length === 0, violations: v }; };
const recRules = (t) => { t = String(t || '').replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}]/gu, '').replace(/^[-*]\s+/gm, '').replace(/as an (AI|language model|assistant)[^\n]*[.!?]?\s*/gi, '').replace(/genuinely|honestly|straightforward/gi, '').replace(/\n{3,}/g, '\n\n'); return t.trim(); };
const voice = (t) => recRules(t).replace(/^ANSWER:\s*/i, '').trim();

const space = await openSpace({ name: 'reasoning', passphrase, backend: fsBackend(path.join(dir, 'store')), blobBackend: fsBackend(path.join(dir, 'blobs')), cells, names });
if (!space.raw().some((e) => e.kind === 'kind' && e.body && e.body.name === 'thought')) space.weaveRaw({ cell: 'DEF·Figure', kind: 'kind', addr: 'kind:thought', body: { name: 'thought', cell: 'INS·Figure' } });

const GOAL = 'How should EODB — a local-first, pharos-backed database with no server — support multi-turn conversation recall across 1,000 messages?';
const K = 16;

const goal = space.weaveRaw({ cell: 'INS·Figure', kind: 'thought', addr: 'thought:goal', body: { n: 0, role: 'goal', text: GOAL }, of: [] });
let prev = goal;
const lines = [];

console.log('GOAL: ' + GOAL + '\n');
for (let n = 1; n <= K; n++) {
  // khora: perceive — SEG the saliency region (the accumulated thoughts), the ground janus will reason over
  const ground = space.raw().filter((e) => e.kind === 'thought').map((e) => e.body.text).join('\n');

  // janus: reason — the mouth produces the next mark
  const mouth = await askModel('Ground so far:\n\n' + ground + '\n\nTake the NEXT single reasoning step toward the goal. One or two sentences. Build on what is there; do not repeat.', 'You are the reasoner. Be precise and additive.');

  // penelope: generate (voice) + judge (eva) + re-ground (rec)
  const eva = evaRules(mouth);
  let text = voice(mouth);
  let verdict = 'ok';
  if (!eva.ok) { text = recRules(mouth); verdict = 'REC (' + eva.violations.join(',') + ')'; }

  prev = space.weaveRaw({ cell: 'INS·Figure', kind: 'thought', addr: `thought:${n}`, body: { n, text, verdict }, of: [prev.id] });
  lines.push(`${n}. [${verdict}] ${text}`);
  console.log(`${n}. [${verdict}] ${text}\n`);
  if (n % 5 === 0) await space.settle();
}
await space.settle();

fs.writeFileSync('reasoning-output.md', '# Accumulated reasoning (khora→janus→penelope)\n\n' + lines.join('\n\n') + '\n');
console.log('wrote reasoning-output.md · ' + space.raw().filter((e) => e.kind === 'thought').length + ' thoughts · encrypted: ' + space.report().encrypted);
space.close();
