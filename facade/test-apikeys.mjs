import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openLog, say } from './db.mjs';
import * as SG from './sign.mjs';
import { serve } from './api.mjs';
import * as AK from './apikeys.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const TMP = process.env.TEST_TMP || path.join(here, '.test-tmp-keys');
const dir = path.join(TMP, 'db');

let s = null, base = '';
const signNonce = (nonce) => crypto.sign(null, Buffer.from(nonce), crypto.createPrivateKey(fs.readFileSync(path.join(path.resolve(dir) + '.keys', 'device', 'alice.key'), 'utf8'))).toString('base64');
const req = async (method, p, body, headers = {}) => {
  const res = await fetch(`http://127.0.0.1:${base}${p}`, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const sig = async () => { const ch = await req('GET', '/challenge'); return { 'x-writer': 'alice', 'x-nonce': ch.body.nonce, 'x-signature': signNonce(ch.body.nonce) }; };

test('apikeys: the store keeps only hashes, verifies, revokes', () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  const { raw, key } = AK.issueKey(dir, { name: 'script', writer: 'alice' });
  assert.ok(raw.startsWith('eok_'), 'keys are recognizable');
  assert.ok(key.hash && !key.hash.includes(raw), 'only a hash is stored');
  assert.deepEqual(AK.verifyKey(dir, raw), { ok: true, writer: 'alice', rights: ['read', 'write'], id: key.id, name: 'script' });
  assert.equal(AK.verifyKey(dir, 'eok_bad').ok, false);
  assert.equal(AK.verifyKey(dir, 'not-a-key').ok, false);

  // list never leaks the hash
  const list = AK.listKeys(dir);
  assert.equal(list.length, 1);
  assert.equal(list[0].hash, undefined, 'hash is stripped from listings');

  AK.revokeKey(dir, key.id);
  assert.equal(AK.verifyKey(dir, raw).ok, false, 'a revoked key no longer verifies');
});

test('apikeys: issued over the API, a key writes; a read-only key cannot; revocation kills it', async () => {
  const w = await openLog({ dir, writer: 'alice', store: 'lazy' });
  await say(w, 'add', 'contact:ana', { name: 'Ana' });
  SG.makeKey(dir, 'alice');
  s = await serve(dir, { port: 0 });
  base = String(s.port);

  // a bare key (no auth) cannot write
  assert.equal((await req('POST', '/say', { verb: 'add', addr: 'contact:x', body: { name: 'x' } })).status, 401);

  // issue a write key with a challenge signature
  const issue = await req('POST', '/apikeys', { name: 'automation' }, await sig());
  assert.equal(issue.status, 201, JSON.stringify(issue.body));
  const raw = issue.body.raw;
  assert.ok(raw.startsWith('eok_'));

  // the write key writes
  const wrote = await req('POST', '/say', { verb: 'add', addr: 'contact:bob', body: { name: 'Bob' } }, { authorization: `Bearer ${raw}` });
  assert.equal(wrote.status, 200, JSON.stringify(wrote.body));

  // a read-only key cannot write
  const ro = await req('POST', '/apikeys', { name: 'reader', rights: ['read'] }, await sig());
  const denied = await req('POST', '/say', { verb: 'add', addr: 'contact:cara', body: { name: 'Cara' } }, { authorization: `Bearer ${ro.body.raw}` });
  assert.equal(denied.status, 403, 'read-only key is refused a write');

  // listing keys requires auth and shows no hashes
  const list = await req('GET', '/apikeys', undefined, await sig());
  assert.equal(list.status, 200);
  assert.ok(list.body.length >= 2);
  assert.ok(list.body.every((k) => k.hash === undefined));

  // revoke the write key: it stops working
  const rev = await req('POST', '/apikeys/revoke', { id: issue.body.key.id }, await sig());
  assert.equal(rev.status, 200);
  const after = await req('POST', '/say', { verb: 'add', addr: 'contact:d', body: { name: 'D' } }, { authorization: `Bearer ${raw}` });
  assert.equal(after.status, 401, 'a revoked key is rejected');

  // a key for someone else is refused (v1: you mint only for yourself)
  const other = await req('POST', '/apikeys', { name: 'x', writer: 'bob' }, await sig());
  assert.equal(other.status, 403);
});

test('apikeys: teardown', async () => { if (s) await s.close(); });
