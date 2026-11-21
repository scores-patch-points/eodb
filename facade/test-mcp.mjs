import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { openLog, say } from './db.mjs';
import * as SG from './sign.mjs';
import { serve } from './api.mjs';
import * as AK from './apikeys.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const TMP = process.env.TEST_TMP || path.join(here, '.test-tmp-mcp');
const dir = path.join(TMP, 'db');

let s = null, base = '', key = '';

// a minimal JSON-RPC line client over stdio
function rpc(proc) {
  let buf = ''; const pending = new Map(); let n = 0;
  proc.stdout.setEncoding('utf8');
  proc.stdout.on('data', (chunk) => {
    buf += chunk; let i;
    while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); if (!line.trim()) continue; let m; try { m = JSON.parse(line); } catch { continue; } const p = pending.get(m.id); if (p) { pending.delete(m.id); p(m); } }
  });
  return { call: (method, params) => new Promise((res) => { const id = ++n; pending.set(id, res); proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); }), notify: (method) => proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method }) + '\n') };
}

test('mcp: initialize, list tools, and run a query over stdio', async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  const w = await openLog({ dir, writer: 'alice', store: 'lazy' });
  await say(w, 'add', 'contact:ana', { name: 'Ana' });
  SG.makeKey(dir, 'alice');
  const k = AK.issueKey(dir, { name: 'mcp', writer: 'alice' });   // issue directly: the API's own path is covered by test-apikeys
  key = k.raw;
  s = await serve(dir, { port: 0 });
  base = String(s.port);

  const proc = spawn(process.execPath, ['mcp.mjs', `--url=http://127.0.0.1:${base}`, `--key=${key}`], { cwd: here });
  const io = rpc(proc);
  const fail = () => { proc.kill(); };

  try {
    const init = await io.call('initialize', { protocolVersion: '2024-11-05', capabilities: {} });
    assert.equal(init.result.protocolVersion, '2024-11-05');
    assert.ok(init.result.capabilities.tools, 'advertises tools capability');
    io.notify('notifications/initialized');

    const tools = await io.call('tools/list', {});
    const names = tools.result.tools.map((t) => t.name);
    assert.ok(names.includes('query') && names.includes('say') && names.includes('share'), 'the core tools are present');

    const q = await io.call('tools/call', { name: 'query', arguments: { query: 'SEG(sources; kinds: ["contact"])' } });
    const text = q.result.content[0].text;
    assert.match(text, /Ana/, 'the query result mentions the written contact');

    const ping = await io.call('ping', {});
    assert.deepEqual(ping.result, {});
  } finally {
    proc.kill(); if (s) await s.close();
  }
});
