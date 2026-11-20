// Run: PHAROS_SRC=/path/to/pharos node --test facade/test-vault.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openLog, say, get, ask, forget, forgetPermanent, finishDeletes } from './db.mjs';
import * as V from './vault.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const TMP = process.env.TEST_TMP || path.join(here, '.test-tmp-vault');
fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true });
let n = 0; const fresh = () => path.join(TMP, `log${++n}`);
const q = 'SEG(sources; kinds: ["secret"])';
const logText = (dir) => { const out = []; const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else out.push(fs.readFileSync(p, 'utf8')); } }; walk(dir); return out.join('\n'); };
const sealedEntry = async (dir, w = 'me', text = 'my diagnosis is private', addr = 'secret:a') => {
  const h = await openLog({ dir, writer: w });
  const e = await say(h, 'add', addr, { note: text }, { seal: true });
  return { h, e };
};

test('a sealed body never appears in the log, the log holds only a commitment, and get decrypts it', async () => {
  const dir = fresh(); const { e } = await sealedEntry(dir);
  assert.ok(!logText(dir).includes('my diagnosis'), 'plaintext must not be in the log');
  assert.equal(e.body.sealed, 2); assert.match(e.body.bodyc, /^[0-9a-f]{64}$/);
  assert.ok(V.hasKey(dir, e.body.bodyc) && V.hasBlob(dir, e.body.bodyc));
  assert.ok(!fs.readFileSync(path.join(dir + '.bodies', e.body.bodyc), 'utf8').includes('diagnosis'), 'plaintext must not be in the blob');
  const g = await get(dir, 'secret:a');
  assert.deepEqual(g.current, { note: 'my diagnosis is private' });
});

test('the key store is outside the log directory', async () => {
  const dir = fresh(); await sealedEntry(dir);
  const p = V.paths(dir);
  assert.ok(!p.keys.startsWith(path.resolve(dir) + path.sep));
  assert.ok(!p.bodies.startsWith(path.resolve(dir) + path.sep));
});

test('the commitment is salted: the same body sealed twice gives unrelated commitments, and a guess cannot confirm it', async () => {
  const dir = fresh(); const h = await openLog({ dir, writer: 'me' });
  const a = await say(h, 'add', 'secret:a', { v: 'yes' }, { seal: true });
  const b = await say(h, 'add', 'secret:b', { v: 'yes' }, { seal: true });
  assert.notEqual(a.body.bodyc, b.body.bodyc);
  for (const guess of ['{"v":"yes"}', '{"v": "yes"}', 'yes']) assert.notEqual(crypto.createHash('sha256').update(guess).digest('hex'), a.body.bodyc);
});

test('size classes: bodies of different small lengths give ciphertexts of the same length', async () => {
  const dir = fresh(); const h = await openLog({ dir, writer: 'me' });
  const a = await say(h, 'add', 'secret:a', { v: 'x' }, { seal: true });
  const b = await say(h, 'add', 'secret:b', { v: 'x'.repeat(150) }, { seal: true });
  const len = (e) => JSON.parse(fs.readFileSync(path.join(dir + '.bodies', e.body.bodyc), 'utf8')).ct.length;
  assert.equal(len(a), len(b));
});

test('a ciphertext cannot be moved to another entry or altered', async () => {
  const dir = fresh(); const h = await openLog({ dir, writer: 'me' });
  const a = await say(h, 'add', 'secret:a', { v: 'A' }, { seal: true });
  const b = await say(h, 'add', 'secret:b', { v: 'B' }, { seal: true });
  const fa = path.join(dir + '.bodies', a.body.bodyc), fb = path.join(dir + '.bodies', b.body.bodyc);
  const goodA = fs.readFileSync(fa);
  fs.writeFileSync(fa, fs.readFileSync(fb));               // put b's ciphertext where a's was
  assert.equal(V.open(dir, { cell: a.cell, kind: a.kind, addr: a.addr }, a.body).ok, false);
  fs.writeFileSync(fa, goodA);
  assert.equal(V.open(dir, { cell: a.cell, kind: a.kind, addr: a.addr }, a.body).ok, true);
  assert.equal(V.open(dir, { cell: a.cell, kind: a.kind, addr: 'secret:other' }, a.body).ok, false, 'wrong address is rejected');
  const j = JSON.parse(goodA); j.ct = (j.ct[0] === 'a' ? 'b' : 'a') + j.ct.slice(1); fs.writeFileSync(fa, JSON.stringify(j));
  assert.equal(V.open(dir, { cell: a.cell, kind: a.kind, addr: a.addr }, a.body).ok, false, 'a changed byte is detected');
});

test('ask counts sealed rows it cannot read (no silent skip)', async () => {
  const dir = fresh(); const { e } = await sealedEntry(dir);
  const withKey = await ask(dir, q); assert.equal(withKey.card.sealed, 1); assert.equal(withKey.card.unreadSealed, 0);
  const other = await ask(dir, q, { keysDir: path.join(TMP, 'empty-keys') });
  assert.equal(other.card.unreadSealed, 1); assert.match(other.card.unread, /1 of 1 sealed rows not read/);
});

test('permanent delete: tombstone, key destroyed, ciphertext removed, receipt; the log keeps its entries', async () => {
  const dir = fresh(); const { h, e } = await sealedEntry(dir);
  const before = (await ask(dir, 'SEG(sources)')).envelope.rows.length;
  const r = await forgetPermanent(h, 'secret:a');
  assert.deepEqual(r.done, ['tombstone', 'key', 'blob', 'receipt']);
  assert.equal(V.hasKey(dir, e.body.bodyc), false); assert.equal(V.hasBlob(dir, e.body.bodyc), false);
  const g = await get(dir, 'secret:a');
  assert.equal(g.permanentlyDeleted, true); assert.equal(g.hidden, true); assert.deepEqual(g.current, {});
  const after = (await ask(dir, 'SEG(sources)')).envelope.rows.length;
  assert.ok(after > before, 'the original entry stays and tombstone and receipt are added; nothing is rewritten');
  assert.equal((await ask(dir, q)).card.unreadSealed, 1, 'the header is still there but cannot be read');
});

test('only the owner can permanently delete, and only sealed entries', async () => {
  const dir = fresh(); await sealedEntry(dir, 'w1');
  const w2 = await openLog({ dir, writer: 'w2' });
  await assert.rejects(() => forgetPermanent(w2, 'secret:a'), /only the owner/);
  const h = await openLog({ dir, writer: 'w1' }); await say(h, 'add', 'plain:b', { v: 1 });
  await assert.rejects(() => forgetPermanent(h, 'plain:b'), /not sealed.*--seal/);
});

test('a delete interrupted at any step is finished by the watcher, and running it again does nothing', async () => {
  for (const stop of ['tombstone', 'key', 'blob']) {
    const dir = fresh(); const { h, e } = await sealedEntry(dir);
    await forgetPermanent(h, 'secret:a', { stopAfter: stop });
    if (stop === 'tombstone') assert.ok(V.hasKey(dir, e.body.bodyc), 'before the key step the key still exists');
    const first = await finishDeletes(h);
    assert.ok(first.actions > 0, `finish did work after stopping at ${stop}`);
    assert.equal(V.hasKey(dir, e.body.bodyc), false); assert.equal(V.hasBlob(dir, e.body.bodyc), false);
    assert.equal((await finishDeletes(h)).actions, 0, 'idempotent');
    assert.equal((await get(dir, 'secret:a')).permanentlyDeleted, true);
  }
});

test('forget without --permanent hides but leaves the key and body in place', async () => {
  const dir = fresh(); const { h, e } = await sealedEntry(dir);
  await forget(h, 'secret:a');
  assert.ok(V.hasKey(dir, e.body.bodyc) && V.hasBlob(dir, e.body.bodyc));
  assert.equal((await get(dir, 'secret:a')).permanentlyDeleted, false);
});

test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));
process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true }));
