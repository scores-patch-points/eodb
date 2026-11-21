import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openLog, say } from './db.mjs';
import * as SG from './sign.mjs';
import { serve } from './api.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const TMP = process.env.TEST_TMP || path.join(here, '.test-tmp-api');
const dir = path.join(TMP, 'db');

let s = null, base = '';
const signNonce = (nonce) => crypto.sign(null, Buffer.from(nonce), crypto.createPrivateKey(fs.readFileSync(path.join(path.resolve(dir) + '.keys', 'device', 'alice.key'), 'utf8'))).toString('base64');
const req = async (method, p, body, headers = {}) => {
  const res = await fetch(`http://127.0.0.1:${base}${p}`, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
};

test('api: setup and read surface', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  const w = await openLog({ dir, writer: 'alice', store: 'lazy' });
  await say(w, 'add', 'contact:ana', { name: 'Ana' });
  SG.makeKey(dir, 'alice');
  s = await serve(dir, { port: 0 });
  base = String(s.port);

  assert.equal((await req('GET', '/health')).body.ok, true);
  const who = await req('GET', '/who');
  assert.deepEqual(who.body.map((x) => x.writer), ['alice']);
  assert.ok((await req('GET', '/formats')).body.formats.length > 0);
  assert.ok((await req('GET', '/dialects')).body.length > 0);
});

test('api: eoql and sql reads', async () => {
  const eo = await req('POST', '/query', { language: 'eoql', query: 'SEG(sources; kinds: ["contact"])' });
  assert.equal(eo.status, 200);
  assert.equal(eo.body.card.rows, 1);

  const sql = await req('POST', '/query', { language: 'sql', query: 'SELECT count(*) AS n FROM entries' });
  assert.equal(sql.status, 200);
  assert.ok(sql.body.envelope.rows[0].n >= 1, 'sql count returns a row');
});

test('api: writes need a valid challenge signature', async () => {
  const denied = await req('POST', '/say', { verb: 'add', addr: 'contact:bob', body: { name: 'Bob' } });
  assert.equal(denied.status, 401);

  // a bad signature on a valid nonce is refused, and that nonce is spent
  const chBad = await req('GET', '/challenge');
  const bad = await req('POST', '/say', { verb: 'add', addr: 'contact:bob', body: { name: 'Bob' } }, { 'x-writer': 'alice', 'x-nonce': chBad.body.nonce, 'x-signature': 'not-a-signature' });
  assert.equal(bad.status, 403);

  const chGood = await req('GET', '/challenge');
  const good = await req('POST', '/say', { verb: 'add', addr: 'contact:bob', body: { name: 'Bob' } }, { 'x-writer': 'alice', 'x-nonce': chGood.body.nonce, 'x-signature': signNonce(chGood.body.nonce) });
  assert.equal(good.status, 200, JSON.stringify(good.body));
  assert.ok(good.body.id);

  // a nonce is one-time: replaying the good nonce is rejected
  const replay = await req('POST', '/say', { verb: 'add', addr: 'contact:cara', body: { name: 'Cara' } }, { 'x-writer': 'alice', 'x-nonce': chGood.body.nonce, 'x-signature': signNonce(chGood.body.nonce) });
  assert.equal(replay.status, 401, 'a used nonce is rejected');
});

test('api: the authenticated write is visible to reads', async () => {
  const eo = await req('POST', '/query', { language: 'eoql', query: 'SEG(sources; kinds: ["contact"])' });
  assert.equal(eo.body.card.rows, 2);
});

test('api: share discloses field-level, and permissions are readable', async () => {
  const ch = await req('GET', '/challenge');
  const share = await req('POST', '/share', { to: 'bob', scope: { addr: 'contact:ana', fields: ['name'] } }, { 'x-writer': 'alice', 'x-nonce': ch.body.nonce, 'x-signature': signNonce(ch.body.nonce) });
  assert.equal(share.status, 200, JSON.stringify(share.body));
  assert.ok(share.body.id);

  const dis = await req('GET', '/disclose?reader=bob&addr=contact:ana');
  assert.equal(dis.status, 200);
  assert.deepEqual(dis.body.disclosed, { name: 'Ana' });

  const perm = await req('GET', '/permissions?reader=bob');
  assert.equal(perm.body.grants.length, 1);
  assert.equal(perm.body.grants[0].to, 'bob');
  assert.equal(perm.body.grants[0].valid.ok, true);
});

test('api: teardown', async () => { if (s) await s.close(); });
