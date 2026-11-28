// Sharing between separate browsers, with a REAL relay over HTTP. Each space below has its own storage (separate backends), exactly as two incognito windows do.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSpace, parseJoin, sha } from '../engine.mjs';
import { startRelay } from '../relay.mjs';
import * as B from '../vendor/pharos/browser-store.mjs';
import * as core from '../vendor/pharos/core.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cells = JSON.parse(fs.readFileSync(path.join(here, '..', 'vendor', 'pharos', 'cells.json'), 'utf8'));
const mk = () => ({ backend: B.memoryBackend(), blobBackend: B.memoryBackend() });
const opened = [], relays = [];
const open = async (b, extra = {}) => { const sp = await openSpace({ name: 'eodb', ...b, cells, autosync: false, ...extra }); opened.push(sp); return sp; };
const relay = async (port = 0) => { const r = await startRelay({ port }); relays.push(r); return r; };
test.after(async () => { for (const sp of opened) sp.close(); for (const r of relays) await r.close(); });
const BASE = [['ws+', { id: 'w1', name: 'Shared work' }], ['tb+', { id: 't1', ws: 'w1', name: 'T' }], ['fld+', { tb: 't1', id: 'f1', n: 'N', t: 'text' }], ['row+', { tb: 't1', id: 'r1', v: { f1: 'start' } }]];
const cell = (sp) => { const e = sp.view().filter((x) => x.op === 'cell=').at(-1); return e && e.body.v; };

async function pair(relayUrls) {
  const A = await open(mk()); for (const [op, body] of BASE) A.append(op, body);
  const link = await A.share({ routes: relayUrls.map((u) => `relay:${u}`) }); await A.settle();
  const G = await open(mk(), { join: link }); return { A, G, link };
}

test('0. the role follows reality: solo until shared, then founder; a joined space is a guest', async () => {
  const r = await relay(); const A = await open(mk()); assert.equal(A.role, 'solo'); for (const [op, body] of BASE) A.append(op, body);
  const link = await A.share({ routes: [`relay:${r.url}`] }); assert.equal(A.role, 'founder'); const G = await open(mk(), { join: link }); assert.equal(G.role, 'guest');
});

test('1. a guest opens a share link in a SEPARATE browser (own storage) and sees the founder\'s data; edits flow both ways', async () => {
  const r = await relay(); const { A, G } = await pair([r.url]);
  assert.equal(G.role, 'guest'); assert.deepEqual(G.view().map((e) => e.op), BASE.map((b) => b[0]), 'the guest sees what the founder wrote');
  A.append('cell=', { tb: 't1', rid: 'r1', fid: 'f1', v: 'from founder' }); await A.syncOnce(); await G.syncOnce(); assert.equal(cell(G), 'from founder');
  G.append('cell=', { tb: 't1', rid: 'r1', fid: 'f1', v: 'from guest' }); await G.syncOnce(); await A.syncOnce(); assert.equal(cell(A), 'from guest');
  assert.ok(G.view().every((e) => e.ok) && A.view().every((e) => e.ok), 'everything on both sides verifies');
  assert.deepEqual(A.view().map((e) => e.id), G.view().map((e) => e.id), 'the same log on both sides, same order');
});

test('2. the relay never sees contents: only sealed bytes, with object names and sizes', async () => {
  const r = await relay(); const { A, G } = await pair([r.url]);
  A.append('cell=', { tb: 't1', rid: 'r1', fid: 'f1', v: 'TOP-SECRET-VALUE' }); await A.syncOnce(); await G.syncOnce();
  const all = Buffer.concat([...r.store.values()]).toString('latin1');
  for (const needle of ['TOP-SECRET', 'Shared work', 'cell-set', 'guest', 'PHR1']) assert.ok(!all.includes(needle), `"${needle}" must not be readable on the relay`);
  assert.ok(r.store.size > 0);
});

test('3. someone with the relay address but not the link cannot read: a wrong key sees nothing, and cannot add entries that count', async () => {
  const r = await relay(); const { A, link } = await pair([r.url]);
  const j = parseJoin(link); const bad = `eodb-join:1:${Buffer.from(JSON.stringify({ v: 1, routes: j.routes, key: '00'.repeat(32), root: j.root, invite: j.invite })).toString('base64url')}`;
  await assert.rejects(open(mk(), { join: bad }), /not been published|cannot reach/i);
});

test('4. a rogue writer with the right key but no grant: its entries are quarantined by the founder, never shown', async () => {
  const r = await relay(); const { A, G, link } = await pair([r.url]); const j = parseJoin(link);
  // a third device that knows the space key but fabricates its own account: it can publish sealed segments, but they do not count under the founder's root
  const rogue = await open(mk()); rogue.append('ws+', { id: 'evil', name: 'INJECTED' });
  const { sealedCarrier, httpCarrier, importKey } = await import('../net.mjs'); const C = await import('../vendor/pharos/carrier.mjs');
  const carrier = sealedCarrier(httpCarrier(r.url), await importKey(j.key)); await rogue.settle(); await C.publish(rogue._handle, carrier);
  await A.syncOnce(); await G.syncOnce();
  assert.ok(!A.view().some((e) => e.body && e.body.name === 'INJECTED'), 'not in the founder\'s view'); assert.ok(!G.view().some((e) => e.body && e.body.name === 'INJECTED'), 'nor the guest\'s');
});

test('5. several routes at once: one relay down changes nothing for the user; a route that was down is repaired when it returns', async () => {
  const r1 = await relay(), r2 = await relay(); const { A, G } = await pair([r1.url, r2.url]);
  assert.deepEqual([...r1.store.keys()].sort(), [...r2.store.keys()].sort(), 'both routes hold everything');
  const port = new URL(r2.url).port; await r2.close(); relays.splice(relays.indexOf(r2), 1);
  A.append('cell=', { tb: 't1', rid: 'r1', fid: 'f1', v: 'while one route is down' }); const res = await A.syncOnce(); assert.ok(!res.error, 'sync still works'); await G.syncOnce();
  assert.equal(cell(G), 'while one route is down'); assert.ok(A.report().share.routesUp >= 1);
  const r2b = await relay(Number(port)); await A.syncOnce();
  assert.deepEqual([...r1.store.keys()].sort(), [...r2b.store.keys()].sort(), 'the returning route was repaired');
});

test('6. routes announced later are learned from the space itself: a guest that joined by one route ends up using the other too', async () => {
  const r1 = await relay(), r2 = await relay(); const { A, G } = await pair([r1.url]);
  await A.share({ routes: [`relay:${r2.url}`] }); await A.syncOnce(); await G.syncOnce(); await G.syncOnce();
  assert.ok(G.report().share.routes >= 2, 'the guest now knows both routes'); assert.ok(r2.store.size > 0, 'and has used the second');
});

test('7. files travel too, sealed: a guest gets the founder\'s file bytes, verified against their hash', async () => {
  const r = await relay(); const { A, G } = await pair([r.url]); const bytes = new TextEncoder().encode('col\n1\n2'), h = sha(bytes);
  A.blobs.put(h, bytes, 'text/csv'); A.append('file+', { ws: 'w1', hash: h, name: 'a.csv', size: bytes.length, type: 'text/csv', at: 'now' });
  await A.syncOnce(); await G.syncOnce();
  assert.equal(new TextDecoder().decode(G.blobs.get(h).bytes), 'col\n1\n2'); assert.equal(G.blobs.get(h).type, 'text/csv');
  assert.ok(!Buffer.concat([...r.store.values()]).toString('latin1').includes('col\n1'), 'the relay holds the file sealed');
});

test('8. a guest keeps its place across a reload: no link needed again, same device, still syncing', async () => {
  const r = await relay(); const A = await open(mk()); for (const [op, body] of BASE) A.append(op, body); const link = await A.share({ routes: [`relay:${r.url}`] }); await A.settle();
  const b = mk(); let G = await open(b, { join: link }); const dev = G.devicePub; await G.settle(); G.close();
  G = await open(b, { tab: 'second' }); assert.equal(G.role, 'guest'); assert.equal(G.devicePub, dev);
  A.append('cell=', { tb: 't1', rid: 'r1', fid: 'f1', v: 'after reload' }); await A.syncOnce(); await G.syncOnce(); assert.equal(cell(G), 'after reload');
});

test('9. unshare: the link stops admitting new devices', async () => {
  const r = await relay(); const { A, link } = await pair([r.url]); assert.equal(await A.unshare(), true); await A.syncOnce();
  const late = await open(mk(), { join: link }); late.append('ws+', { id: 'late', name: 'LATE-GUEST' }); await late.settle(); await late.syncOnce(); await A.syncOnce();
  assert.ok(!A.view().some((e) => e.body && e.body.name === 'LATE-GUEST'), 'a guest admitted after the link was revoked does not count');
});

test('10. links are checked: malformed, incomplete and old single-relay forms', () => {
  assert.throws(() => parseJoin('nope'), /not a share link/); assert.throws(() => parseJoin('eodb-join:1:@@@'), /malformed|not a share link/);
  const enc = (o) => `eodb-join:1:${Buffer.from(JSON.stringify(o)).toString('base64url')}`; const k = 'a'.repeat(64);
  assert.throws(() => parseJoin(enc({ routes: [], key: k, root: k, invite: 'x' })), /incomplete/); assert.throws(() => parseJoin(enc({ routes: ['relay:http://x'], key: 'short', root: k, invite: 'x' })), /incomplete/);
  assert.deepEqual(parseJoin(enc({ relay: 'http://old', key: k, root: k, invite: 'x' })).routes, ['relay:http://old']);
});

test('11. a file object whose bytes do not match its hash is refused, even if sealed with the right key', async () => {
  const r = await relay(); const { A, G, link } = await pair([r.url]); const j = parseJoin(link);
  const { sealedCarrier, httpCarrier, importKey } = await import('../net.mjs'); const carrier = sealedCarrier(httpCarrier(r.url), await importKey(j.key));
  const real = new TextEncoder().encode('the real file'), h = sha(real); const fake = new TextEncoder().encode('SUBSTITUTED CONTENT'); const payload = new Uint8Array(1 + fake.length); payload.set(fake, 1);
  A.append('file+', { ws: 'w1', hash: h, name: 'x.txt', size: real.length, type: 'text/plain', at: 'now' }); await A.syncOnce();
  await carrier.putNew(await A.blobName(h), payload);                 // a hostile route (or member) serves other bytes under the real file's object name
  await G.syncOnce(); assert.equal(G.blobs.has(h), false, 'rejected: the bytes do not hash to the file hash');
});

test('12. two spaces on ONE server holding the same file each get their own copy: names are per space, and the server cannot see file hashes', async () => {
  const r = await relay(); const bytes = new TextEncoder().encode('the same file in both spaces'), h = sha(bytes);
  const mkPair = async () => { const A = await open(mk()); for (const [op, body] of BASE) A.append(op, body); A.blobs.put(h, bytes, 'text/plain'); A.append('file+', { ws: 'w1', hash: h, name: 'same.txt', size: bytes.length, type: 'text/plain', at: 'now' }); const link = await A.share({ routes: [`relay:${r.url}`] }); await A.settle(); const G = await open(mk(), { join: link }); return { A, G }; };
  const one = await mkPair(), two = await mkPair(); await one.G.syncOnce(); await two.G.syncOnce();
  assert.equal(new TextDecoder().decode(one.G.blobs.get(h).bytes), 'the same file in both spaces'); assert.equal(new TextDecoder().decode(two.G.blobs.get(h).bytes), 'the same file in both spaces');
  const names = [...r.store.keys()].filter((n) => n.startsWith('blob/')); assert.equal(names.length, 2, 'one object per space, not one shared object');
  assert.ok(names.every((n) => !n.includes(h)), 'no object name contains the file hash');
});


test('13. the link names the space: a guest joins a founder whose space has another name than the guest\'s own (e.g. "Titanic demo" into a device on "Work")', async () => {
  const r = await relay(); const A = await openSpace({ name: 'Titanic demo', ...mk(), cells, autosync: false }); opened.push(A);
  for (const [op, body] of BASE) A.append(op, body);
  const link = await A.share({ routes: [`relay:${r.url}`] }); await A.settle();
  assert.equal(parseJoin(link).space, 'Titanic demo', 'the link carries the founder\'s space name');
  const G = await open(mk(), { name: 'Work (shared)', join: link });   // stored under any local name
  assert.equal(G.role, 'guest'); assert.equal(G.logName, 'Titanic demo');
  assert.deepEqual(G.view().map((e) => e.op), BASE.map((b) => b[0]));
  G.append('cell=', { tb: 't1', rid: 'r1', fid: 'f1', v: 'from guest' }); await G.syncOnce(); await A.syncOnce(); assert.equal(cell(A), 'from guest');
});

test('14. a link from before the name was carried still joins under a matching name, and under a different one says why it cannot', async () => {
  const r = await relay(); const A = await openSpace({ name: 'Other', ...mk(), cells, autosync: false }); opened.push(A);
  for (const [op, body] of BASE) A.append(op, body);
  const b = parseJoin(await A.share({ routes: [`relay:${r.url}`] })); await A.settle(); delete b.space;
  const old = `eodb-join:1:${Buffer.from(JSON.stringify(b)).toString('base64url')}`;
  const ok = await open(mk(), { name: 'Other', join: old }); assert.equal(ok.role, 'guest');
  await assert.rejects(open(mk(), { name: 'Work', join: old }), (e) => e.code === 'NOT_VERIFIED' && /older version/.test(e.message));
});
