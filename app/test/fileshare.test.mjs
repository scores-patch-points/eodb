// File shares: a short, scoped, read-only link to one file. A founder shares the space, then shares a single file; a stranger with only the
// file link reads exactly that file and nothing else. Proves: key derivation, short-link round-trip, end-to-end fetch, and isolation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSpace, parseJoin, sha } from '../engine.mjs';
import { startRelay } from '../relay.mjs';
import * as B from '../vendor/pharos/browser-store.mjs';
import * as N from '../net.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cells = JSON.parse(fs.readFileSync(path.join(here, '..', 'vendor', 'pharos', 'cells.json'), 'utf8'));
const mk = () => ({ backend: B.memoryBackend(), blobBackend: B.memoryBackend() });
const opened = [], relays = [];
const open = async (b, extra = {}) => { const sp = await openSpace({ name: 'eodb', ...b, cells, autosync: false, ...extra }); opened.push(sp); return sp; };
const relay = async (port = 0) => { const r = await startRelay({ port }); relays.push(r); return r; };
test.after(async () => { for (const sp of opened) sp.close(); for (const r of relays) await r.close(); });

test('1. a file key is deterministic, domain-separated, and one-way', async () => {
  const k = 'ab'.repeat(32);
  const a = await N.deriveFileKeyHex(k, 'fileA'), b = await N.deriveFileKeyHex(k, 'fileA'), c = await N.deriveFileKeyHex(k, 'fileB');
  assert.equal(a, b, 'same input -> same key');
  assert.notEqual(a, c, 'different file -> different key');
  assert.notEqual(a, k, 'the file key is not the space key');
  assert.match(a, /^[0-9a-f]{64}$/);
});

test('2. the file-share link is short and round-trips', () => {
  const link = N.fileShareLink({ routes: ['http://127.0.0.1:8853'], hash: 'ab'.repeat(32), key: 'cd'.repeat(32), type: 'text/csv', name: 'metro-contracts.csv' });
  assert.ok(link.length < 200, `link should be short, got ${link.length}: ${link}`);
  assert.deepEqual(N.parseFileShare(link), { routes: ['http://127.0.0.1:8853'], hash: 'ab'.repeat(32), key: 'cd'.repeat(32), type: 'text/csv', name: 'metro-contracts.csv' });
  assert.throws(() => N.parseFileShare('nope'), /not a file-share link/);
  assert.throws(() => N.parseFileShare('eodb-file:1:@@@@'), /malformed|not a file-share link/);
});

test('3. a founder shares one file; a stranger with only the link reads exactly that file', async () => {
  const r = await relay();
  const A = await open(mk());
  const bytes = new TextEncoder().encode('col\n1\n2'); const h = sha(bytes);
  A.blobs.put(h, bytes, 'text/csv');
  A.append('file+', { ws: 'w1', hash: h, name: 'a.csv', size: bytes.length, type: 'text/csv', at: 'now' });
  const spaceLink = await A.share({ routes: [`relay:${r.url}`] });
  const link = await A.shareFile(h);

  const got = await N.fetchSharedFile(link);   // no space, no openSpace, no key beyond the link
  assert.equal(new TextDecoder().decode(got.bytes), 'col\n1\n2');
  assert.equal(got.type, 'text/csv');
  assert.equal(got.name, 'a.csv');
  assert.ok(!link.includes(parseJoin(spaceLink).key), 'the file link never carries the space key');
  assert.ok(!link.includes('col'), 'the file link never carries plaintext');
});

test('4. isolation: one link opens one file; it reveals neither the space key nor sibling files', async () => {
  const r = await relay();
  const A = await open(mk());
  const b1 = new TextEncoder().encode('SECRET-FILE-ONE'), b2 = new TextEncoder().encode('SECRET-FILE-TWO');
  const h1 = sha(b1), h2 = sha(b2);
  A.blobs.put(h1, b1, 'text/plain'); A.blobs.put(h2, b2, 'text/plain');
  await A.share({ routes: [`relay:${r.url}`] });
  const link1 = await A.shareFile(h1);
  const s1 = N.parseFileShare(link1);

  // a recipient who knows only link1 cannot read file2: rebuilding a link with file1's key and file2's hash fails
  const forged = N.fileShareLink({ routes: s1.routes, hash: h2, key: s1.key, type: '', name: '' });
  await assert.rejects(N.fetchSharedFile(forged), /not reachable|does not match/);

  // file2 is reachable only with its own link (its own key)
  const link2 = await A.shareFile(h2);
  assert.equal(new TextDecoder().decode((await N.fetchSharedFile(link2)).bytes), 'SECRET-FILE-TWO');

  // the relay holds only sealed bytes
  const all = Buffer.concat([...r.store.values()]).toString('latin1');
  assert.ok(!all.includes('SECRET-FILE'), 'the relay holds no file plaintext');
});

test('5. a wrong key cannot open the file, and wrong bytes under the real name are refused by the hash check', async () => {
  const r = await relay();
  const A = await open(mk());
  const bytes = new TextEncoder().encode('real file contents'); const h = sha(bytes);
  A.blobs.put(h, bytes, 'text/plain');
  const spaceLink = await A.share({ routes: [`relay:${r.url}`] });
  const spaceKey = parseJoin(spaceLink).key;
  const s = N.parseFileShare(await A.shareFile(h));

  // a wrong key in the link cannot decrypt the blob
  await assert.rejects(N.fetchSharedFile(N.fileShareLink({ routes: s.routes, hash: h, key: '00'.repeat(32), type: '', name: '' })), /not reachable|does not match/);

  // a key-holder (a malicious member, who can derive the file key) serves valid ciphertext of the WRONG bytes under the real file's name;
  // the content hash must refuse it. Simulated by overwriting the relay object directly, as a hostile relay would.
  const fake = new TextEncoder().encode('SUBSTITUTED'); const payload = new Uint8Array(1 + fake.length); payload.set(fake, 1);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(`eodb-file/1|blob/${h}`) }, await N.importKey(await N.deriveFileKeyHex(spaceKey, h)), payload));
  const sealed = new Uint8Array(12 + ct.length); sealed.set(iv); sealed.set(ct, 12);
  r.store.set(`blob/${h}`, Buffer.from(sealed));

  await assert.rejects(N.fetchSharedFile(await A.shareFile(h)), /not match/);
});
