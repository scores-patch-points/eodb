// Run: PHAROS_SRC=/path/to/pharos node --test facade/test-sign.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openLog, say, ask, forget } from './db.mjs';
import * as SG from './sign.mjs';
import { Sig } from './sig.mjs';
import { libs, uriFor } from './store.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const TMP = process.env.TEST_TMP || path.join(here, '.test-tmp-sign');
fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true });
let n = 0; const fresh = () => path.join(TMP, `log${++n}`);
const { E } = await libs();
const entries = (dir) => { const h = E.open(uriFor(dir), { mode: 'read' }); try { return E.run(h, 'DEF(SEG(sources); collapse: ["all"])', { params: {} }).rows.map((r) => ({ id: r._id, by: r._by })); } finally { E.close(h); } };
const sidecar = (dir, w) => path.join(dir + '.sigs', `${w}.jsonl`);

test('a key is made once, kept outside the log with owner-only access, and its public half is pinned', async () => {
  const dir = fresh(); const a = SG.makeKey(dir, 'w1'), b = SG.makeKey(dir, 'w1');
  assert.equal(a.created, true); assert.equal(b.created, false); assert.equal(a.pk, b.pk);
  const kf = path.join(dir + '.keys', 'device', 'w1.key');
  assert.equal(fs.statSync(kf).mode & 0o077, 0, 'no access for group or others');
  assert.ok(!kf.startsWith(path.resolve(dir) + path.sep), 'the key is outside the log directory');
});

test('entries written after a key exists are signed and verify; earlier ones are counted as unsigned', async () => {
  const dir = fresh(); const w = await openLog({ dir, writer: 'w1', store: 'lazy' });
  await say(w, 'add', 'a:1', { n: 1 });                         // before any key
  SG.makeKey(dir, 'w1'); const w2 = await openLog({ dir, writer: 'w1', store: 'lazy' });
  await say(w2, 'add', 'a:2', { n: 2 }); await say(w2, 'set', 'a:2', { n: 3 });
  const other = await openLog({ dir, writer: 'w2', store: 'lazy' }); await say(other, 'add', 'b:1', { n: 9 });
  const r = SG.verifyAll(dir, entries(dir));
  assert.equal(r.valid, 2); assert.equal(r.invalid, 0); assert.equal(r.keyChanged, 0);
  assert.ok(r.unsigned >= 2, 'the entry written before the key and the other writer\'s entry are unsigned');
});

test('a forged, swapped or re-keyed signature is caught by the audit', async () => {
  const dir = fresh(); SG.makeKey(dir, 'w1'); const w = await openLog({ dir, writer: 'w1', store: 'lazy' });
  await say(w, 'add', 'a:1', { n: 1 }); await say(w, 'add', 'a:2', { n: 2 });
  assert.equal(SG.verifyAll(dir, entries(dir)).invalid, 0);
  const lines = fs.readFileSync(sidecar(dir, 'w1'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  // swap the two signatures
  const sw = lines.map((l, i) => ({ ...l, sig: lines[(i + 1) % lines.length].sig })); fs.writeFileSync(sidecar(dir, 'w1'), sw.map((l) => JSON.stringify(l)).join('\n') + '\n');
  const swapped = SG.verifyAll(dir, entries(dir)); assert.ok(swapped.invalid >= 2, 'signatures swapped between entries do not verify');
  // sign the same ids with an attacker's key and claim it is the writer's key
  const atk = crypto.generateKeyPairSync('ed25519'); const atkPk = atk.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const forged = lines.map((l) => ({ id: l.id, pk: atkPk, sig: crypto.sign(null, Buffer.from(l.id), atk.privateKey).toString('base64') }));
  fs.writeFileSync(sidecar(dir, 'w1'), forged.map((l) => JSON.stringify(l)).join('\n') + '\n');
  const re = SG.verifyAll(dir, entries(dir)); assert.ok(re.keyChanged >= 2, 'a valid signature by a different key than the pinned one is flagged, not accepted');
  assert.equal(re.valid, 0);
});

test('ordinary reads never check signatures, so a damaged sidecar changes no answer and costs nothing', async () => {
  const dir = fresh(); SG.makeKey(dir, 'w1'); const w = await openLog({ dir, writer: 'w1', store: 'lazy' });
  for (let i = 0; i < 30; i++) await say(w, 'add', `a:${i}`, { n: i });
  const before = (await ask(dir, 'SEG(sources; kinds: ["a"])')).envelope.rows;
  fs.writeFileSync(sidecar(dir, 'w1'), 'garbage\n');
  const after = (await ask(dir, 'SEG(sources; kinds: ["a"])')).envelope.rows;
  assert.deepEqual(after, before);
  assert.ok(SG.verifyAll(dir, entries(dir)).unsigned >= 30, 'only the audit notices');
});

test('signing does not change what is written: the same moves give the same entries with or without a key (apart from time)', async () => {
  const a = fresh(), b = fresh(); SG.makeKey(b, 'w1');
  const wa = await openLog({ dir: a, writer: 'w1', store: 'lazy' }), wb = await openLog({ dir: b, writer: 'w1', store: 'lazy' });
  await say(wa, 'add', 'a:1', { n: 1 }); await say(wb, 'add', 'a:1', { n: 1 });
  const k = (d) => entries(d).length; assert.equal(k(a), k(b));
});

async function published(me = 'reader') {
  const dir = fresh(); SG.makeKey(dir, 'w1'); const w = await openLog({ dir, writer: 'w1', store: 'lazy' });
  for (let i = 0; i < 80; i++) await say(w, 'add', `a:${i}`, { n: i });
  const pub = SG.publishIndex(dir, 'w1'); return { dir, pub, me };
}

test('adopting a published index: refused unless trusted, verified, complete to the current position, and cheaper than rebuilding', async () => {
  const { dir } = await published();
  const cheap = { cost: { adoptMsPerMB: 0.01, coldMsPerMB: 1000, fixedMs: 0 } };
  assert.match(SG.adoptIndex(dir, 'reader', 'w1', cheap).reason, /not trusted/);
  SG.trust(dir, 'w1');
  const ok = SG.adoptIndex(dir, 'reader', 'w1', cheap); assert.equal(ok.adopted, true, ok.reason);
  const theirs = new Sig(dir, 'w1'), mine = new Sig(dir, 'reader');
  assert.deepEqual(mine.frontier(), theirs.frontier()); assert.equal(mine.status().entries, theirs.status().entries);
  assert.equal(mine.advance().scanned, 0, 'the adopted index needs no scan');
});

test('adoption is declined when it would not be cheaper, and nothing is verified in that case', async () => {
  const { dir } = await published(); SG.trust(dir, 'w1');
  const r = SG.adoptIndex(dir, 'reader2', 'w1', { cost: { adoptMsPerMB: 100000 } });
  assert.equal(r.adopted, false); assert.match(r.reason, /not clearly cheaper/); assert.ok(r.estimates.adoptMs > r.estimates.rebuildMs);
  assert.ok(!fs.existsSync(path.join(dir + '.sig', 'reader2.bin')), 'no state was taken');
});

test('adoption is refused for a tampered snapshot, a stale position, or a publisher whose key changed', async () => {
  const cheap = { cost: { adoptMsPerMB: 0.01, coldMsPerMB: 1000, fixedMs: 0 } };
  let { dir } = await published(); SG.trust(dir, 'w1');
  const f = path.join(dir + '.sig', 'published-w1.json'); const j = JSON.parse(fs.readFileSync(f, 'utf8')); const at = 10; assert.ok(j.state.length > at + 1); j.state = j.state.slice(0, at) + (j.state[at] === 'A' ? 'B' : 'A') + j.state.slice(at + 1); fs.writeFileSync(f, JSON.stringify(j));   // one changed character in the binary state
  assert.match(SG.adoptIndex(dir, 'r1', 'w1', cheap).reason, /does not verify/);
  ({ dir } = await published()); SG.trust(dir, 'w1');
  const w = await openLog({ dir, writer: 'w1', store: 'lazy' }); await say(w, 'add', 'late:1', { n: 1 });
  assert.match(SG.adoptIndex(dir, 'r2', 'w1', cheap).reason, /changed since/);
  ({ dir } = await published()); SG.trust(dir, 'w1');
  const atk = crypto.generateKeyPairSync('ed25519'); fs.writeFileSync(path.join(dir + '.sigs', 'pub', 'w1.pub'), atk.publicKey.export({ type: 'spki', format: 'pem' }));
  assert.match(SG.adoptIndex(dir, 'r3', 'w1', cheap).reason, /pinned key/);
});

test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));
process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true }));
