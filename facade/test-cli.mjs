import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { openLog, say } from './db.mjs';
import * as SG from './sign.mjs';
import { serve } from './api.mjs';
import * as AK from './apikeys.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const TMP = process.env.TEST_TMP || path.join(here, '.test-tmp-cli');
const dir = path.join(TMP, 'db');

let s = null, base = '', key = '';

const runCli = (args) => new Promise((resolve) => {
  const p = spawn(process.execPath, ['cli.mjs', ...args], { cwd: here });
  let out = '', err = ''; p.stdout.setEncoding('utf8'); p.stderr.setEncoding('utf8');
  p.stdout.on('data', (c) => (out += c)); p.stderr.on('data', (c) => (err += c));
  p.on('close', (code) => resolve({ code, out, err }));
});

test('cli: query, write, and key management over the API', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  const w = await openLog({ dir, writer: 'alice', store: 'lazy' });
  await say(w, 'add', 'contact:ana', { name: 'Ana' });
  SG.makeKey(dir, 'alice');
  key = AK.issueKey(dir, { name: 'cli', writer: 'alice' }).raw;
  s = await serve(dir, { port: 0 });
  base = String(s.port);
  const url = `http://127.0.0.1:${base}`;

  // query with a key, human table output
  const q = await runCli(['--url', url, '--key', key, 'query', 'SEG(sources; kinds: ["contact"])']);
  assert.equal(q.code, 0, q.err);
  assert.match(q.out, /Ana/, 'the table shows the contact');

  // write with a key
  const w2 = await runCli(['--url', url, '--key', key, 'say', 'add', 'contact:bob', '{"name":"Bob"}']);
  assert.equal(w2.code, 0, w2.err);
  assert.ok(JSON.parse(w2.out).id);

  // who over the key
  const who = await runCli(['--url', url, '--key', key, 'who']);
  assert.deepEqual(JSON.parse(who.out).map((x) => x.writer), ['alice']);

  // issue a new key with a challenge signature (--dir --writer)
  const issue = await runCli(['--url', url, '--dir', dir, '--writer', 'alice', 'apikeys', 'issue', '--name', 'from-cli', '--readonly']);
  assert.equal(issue.code, 0, issue.err);
  assert.match(JSON.parse(issue.out).raw, /^eok_/);

  // the challenge-signature path writes too
  const w3 = await runCli(['--url', url, '--dir', dir, '--writer', 'alice', 'say', 'add', 'contact:cara', '{"name":"Cara"}']);
  assert.equal(w3.code, 0, w3.err);
  assert.ok(JSON.parse(w3.out).id);
});

test('cli: teardown', async () => { if (s) await s.close(); });
