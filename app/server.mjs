// server.mjs: a real server PROJECTED from the EOT. It is not an orchestrator — it is a peer with a mouth and an eye. It reads the
// pharos, folds it into tables, and answers HTTP (read-only projections: tables, SQL, export). Its one write path is intake: a
// webhook POST becomes an `auto-event` entry (audited, like everything), and — reading the log for a matching webhook trigger —
// it runs that automation as any peer would, recording the run and every node result as entries.
//
//   node app/server.mjs --dir /var/lib/eodb --passphrase "$PW" --port 8852
//
//   GET  /health              -> ok
//   GET  /api/tables          -> materialized table names + columns + row counts
//   GET  /api/tables/:name    -> a table's rows (name-keyed)
//   POST /api/query {sql}     -> { columns, rows }
//   GET  /api/query?sql=...   -> { columns, rows }
//   GET  /api/export.sql      -> SQLite DDL + INSERT dump
//   GET  /api/export.json     -> portable { tables: { name: { columns, rows } } }
//   GET  /api/automations     -> the audit log: definitions, triggers, runs, node results, events, claims
//   POST /webhook/:path       -> write an auto-event entry, then run any automation whose webhook trigger matches
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { materialize, select, toSQLite, toJSON } from './relational.mjs';
import { automations, processEvents } from './worker.mjs';
import { openSpace } from './engine.mjs';
import { fsBackend } from './fs-backend.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const JSON_OK = { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, PUT, OPTIONS', 'access-control-allow-headers': '*' };

const send = (res, code, body) => { res.writeHead(code, typeof body === 'string' && !body.startsWith('{') && !body.startsWith('[') ? { ...JSON_OK, 'content-type': 'text/plain; charset=utf-8' } : JSON_OK); res.end(body); };
const sendJson = (res, code, obj) => send(res, code, JSON.stringify(obj));

const readBody = (req) => new Promise((resolve, reject) => { const chunks = []; req.on('data', (c) => chunks.push(c)); req.on('end', () => resolve(Buffer.concat(chunks))); req.on('error', reject); });

/** build an HTTP server over an open space. `ctx` is passed through to automation runs (e.g. { fetch }). */
export function createServer(space, ctx = {}) {
  const db = () => materialize(space.view());

  return http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') return send(res, 204, '');
    const u = new URL(req.url, 'http://x');
    const p = u.pathname;
    try {
      if (p === '/health') return send(res, 200, 'ok');

      if (p === '/api/tables') {
        const tables = db().tables.map((t) => ({ name: t.name, ws: t.ws, columns: t.columns.map((c) => ({ name: c.name, type: c.type })), rows: t.rows.length }));
        return sendJson(res, 200, { tables });
      }
      const tm = /^\/api\/tables\/(.+)$/.exec(p);
      if (tm) {
        const name = decodeURIComponent(tm[1]);
        const t = db().tables.find((x) => x.name === name);
        if (!t) return sendJson(res, 404, { error: `no table "${name}"` });
        return sendJson(res, 200, { name, columns: t.columns.map((c) => c.name), rows: t.rows.map((r) => Object.fromEntries(t.columns.map((c) => [c.name, r.v[c.id]]))) });
      }
      if (p === '/api/query') {
        let sql;
        if (req.method === 'POST') { const b = await readBody(req); let j; try { j = JSON.parse(b.toString()); } catch { /* raw */ } sql = j && j.sql ? j.sql : b.toString(); }
        else sql = u.searchParams.get('sql') || '';
        if (!sql) return sendJson(res, 400, { error: 'missing sql' });
        return sendJson(res, 200, select(db(), sql));
      }
      if (p === '/api/export.sql') { res.writeHead(200, { ...JSON_OK, 'content-type': 'application/sql; charset=utf-8', 'content-disposition': 'attachment; filename="eodb.sql"' }); return res.end(toSQLite(db())); }
      if (p === '/api/export.json') return sendJson(res, 200, toJSON(db()));
      if (p === '/api/convert') {
        const format = u.searchParams.get('format') || 'sqlite', table = u.searchParams.get('table') || undefined, ws = u.searchParams.get('ws') || undefined;
        const r = space.convert({ format, table, ws });
        res.writeHead(200, { ...JSON_OK, 'content-type': r.mime + '; charset=utf-8', 'content-disposition': `attachment; filename="${r.name}"` });
        return res.end(r.bytes);
      }
      if (p === '/api/automations') return sendJson(res, 200, { log: space.automationLog() });

      const wm = /^\/webhook\/(.+)$/.exec(p);
      if (wm && req.method === 'POST') {
        const wp = decodeURIComponent(wm[1]);
        const raw = (await readBody(req)).toString();
        let body; try { body = JSON.parse(raw); } catch { body = raw; }
        const ev = space.append('auto-event+', { path: wp, body, headers: req.headers, ts: Date.now() });
        const pr = await processEvents(space, ctx);
        const runs = pr.ran.filter((r) => r.event === ev.id).map((r) => ({ trigger: r.trigger, runId: r.runId, ok: r.ok }));
        return sendJson(res, 200, { path: wp, event: ev.id, runs });
      }

      sendJson(res, 404, { error: 'not found' });
    } catch (e) { sendJson(res, 500, { error: String(e && e.message || e) }); }
  });
}

// ---- CLI --------------------------------------------------------------------------------------------------------
async function main() {
  const argv = process.argv.slice(2); const flags = {};
  for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const k = a.slice(2); const nxt = argv[i + 1]; if (nxt === undefined || nxt.startsWith('--')) flags[k] = true; else { flags[k] = nxt; i++; } } }
  const dir = flags.dir || process.env.EODB_DIR || '.';
  const passphrase = flags.passphrase || process.env.EODB_PASSPHRASE;
  if (!passphrase) { console.error('server needs a passphrase (--passphrase or $EODB_PASSPHRASE)'); process.exit(2); }
  const cells = JSON.parse(fs.readFileSync(path.join(here, 'vendor', 'pharos', 'cells.json'), 'utf8'));
  const names = JSON.parse(fs.readFileSync(path.join(here, 'vendor', 'node-names.json'), 'utf8'));
  const routes = (flags.routes ? String(flags.routes).split(',') : []).map((r) => r.trim()).filter(Boolean);
  const space = await openSpace({ name: flags.name || 'eodb', backend: fsBackend(path.join(dir, 'store')), blobBackend: fsBackend(path.join(dir, 'blobs')), cells, names, passphrase, join: flags.join || undefined, autosync: true, syncMs: Number(flags['sync-ms'] || 5000) });

  // become part of the sync mesh: a founder shares (announcing routes), a guest already joined. Either way the server stays in sync.
  if (space.role !== 'guest' && routes.length) { const link = await space.share({ routes }); process.stdout.write(JSON.stringify({ role: space.role, link }) + '\n'); }
  else process.stdout.write(JSON.stringify({ role: space.role, peers: space.peers() }) + '\n');

  const port = Number(flags.port || 8852);
  const server = createServer(space);
  server.listen(port, '0.0.0.0', () => console.log(`eodb projection server on http://0.0.0.0:${port} (tables, SQL, export, webhooks)`));

  // optional: this peer also acts as a worker — sync, claim due triggers / unhandled events, run, publish.
  if (flags.worker) {
    const { workerPass } = await import('./worker.mjs');
    const ms = Number(flags['worker-ms'] || 30_000);
    const pass = async () => { try { const r = await workerPass(space, {}); if (r.poll.length || r.events.length || r.errors.length) process.stdout.write(JSON.stringify({ pass: r }) + '\n'); } catch (e) { process.stderr.write('worker pass: ' + (e && e.message || e) + '\n'); } };
    await pass();
    setInterval(pass, ms);
  }

  const stop = () => { server.close(); space.close(); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
if (process.argv[1] && process.argv[1].endsWith('server.mjs')) main();
