// swarm.mjs: the wheel — three organs (khora/janus/penelope) on the empty hub, no orchestrator, full audit log.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSpace } from '../engine.mjs';
import * as B from '../vendor/pharos/browser-store.mjs';
import { swarm, glitches, evaRules, recRules, declareKinds, seedMaterial, penelope } from '../swarm.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cells = JSON.parse(fs.readFileSync(path.join(here, '..', 'vendor', 'pharos', 'cells.json'), 'utf8'));
const open = () => openSpace({ name: 'eodb', backend: B.memoryBackend(), blobBackend: B.memoryBackend(), cells, autosync: false });

const MAT = [{ addr: 'material:goal', text: 'Goal: recall across 1,000 messages, no server.' }, { addr: 'material:fact', text: 'Fact: the log is append-only.' }];

test('EVA finds what breaks the voice; REC repairs it', () => {
  const t = '**bold** next step 🎉 as an AI assistant, genuinely';
  assert.deepEqual(evaRules(t).violations, ['emoji', 'markdown', 'framing', 'banned-word']);
  assert.equal(evaRules(t).ok, false);
  const r = recRules(t);
  assert.ok(!/\*\*|🎉|AI assistant|genuinely/.test(r), r);
});

test('the wheel turns: material -> ground -> mark -> voice, with no orchestrator', async () => {
  const sp = await open();
  const askModel = async (user) => 'reasoned: **bold** answer to "' + user.slice(0, 20) + '"';
  await swarm(sp, { askModel, material: MAT });

  const raw = sp.raw();
  const kind = (k) => raw.filter((e) => e.kind === k);
  assert.equal(kind('ground').length, 2);
  assert.equal(kind('mark').length, 2);
  assert.equal(kind('voice').length, 2);
  // the audit log is the hub itself: every organ's claim is an act entry
  const act = (o) => kind('act').filter((e) => e.body.organ === o);
  assert.deepEqual([...new Set(kind('act').map((e) => e.body.organ))].sort(), ['janus', 'khora', 'penelope']);
  assert.equal(act('khora').length, 2);
  assert.equal(act('penelope').length, 2);
  // janus's rounds are audited too (claim + per-round)
  assert.ok(act('janus').some((e) => Number.isInteger(e.body.round) && e.body.surprise !== undefined));
  sp.close();
});

test('a glitch in the interweave surfaces as an anomaly, not silence', async () => {
  const sp = await open();
  // janus emits markdown; penelope must judge it (REC) and repair the voice — the audit shows the repair
  const askModel = async () => '**semantic search** is the way';
  await swarm(sp, { askModel, material: MAT });
  const voices = sp.raw().filter((e) => e.kind === 'voice');
  assert.ok(voices.every((v) => v.body.verdict === 'REC(markdown)'));
  assert.ok(voices.every((v) => !/\*\*/.test(v.body.text)));

  const g = glitches(sp);
  assert.equal(g.orphans.length, 0, 'no act without a product');
  assert.equal(g.unvoiced.length, 0, 'every mark is voiced');
  sp.close();
});

test('unconsumed material is left alone: an organ only acts on its own input kind', async () => {
  const sp = await open();
  declareKinds(sp);
  seedMaterial(sp, MAT);
  // run only penelope: there are no marks, so it must produce nothing and leave the hub as-is
  await penelope(sp);
  const raw = sp.raw();
  assert.equal(raw.filter((e) => e.kind === 'voice').length, 0);
  assert.equal(raw.filter((e) => e.kind === 'mark').length, 0);
  sp.close();
});

test('the mouth is measured: janus keeps calling while surprise decays, audited per round', async () => {
  const sp = await open();
  let call = 0;
  const askModel = async () => (++call === 1 ? '**draft**' : 'clean final');
  await swarm(sp, { askModel, material: [{ addr: 'material:x', text: 'seed' }] });
  const rounds = sp.raw().filter((e) => e.kind === 'act' && e.body.organ === 'janus' && Number.isInteger(e.body.round));
  assert.equal(rounds.length, 2);
  assert.deepEqual(rounds.map((e) => e.body.surprise), [1, 0]);
  // the best raw mouth won (surprise 0); penelope then judged it clean
  assert.equal(sp.raw().find((e) => e.kind === 'mark').body.text, 'clean final');
  assert.equal(sp.raw().find((e) => e.kind === 'voice').body.verdict, 'ok');
  sp.close();
});
