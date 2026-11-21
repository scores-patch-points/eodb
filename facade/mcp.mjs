#!/usr/bin/env node
// mcp.mjs: an MCP server (stdio, JSON-RPC 2.0, line-delimited) exposing the EO///DB API as tools, so any MCP client
// (opencode, Claude, a local assistant) can query and write the log seamlessly. Auth via EO_KEY / EO_URL env, or --dir --writer.
//   node mcp.mjs --url http://127.0.0.1:8853 --key eok_…
import { makeClient } from './client.mjs';

const flags = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v === undefined ? true : v]));
const client = makeClient({ url: flags.url, key: flags.key, dir: flags.dir, writer: flags.writer });

const TOOLS = [
  { name: 'query', description: 'Run an EOQL query against the log (the native language). Use language:"sql" for SQL.', inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'EOQL or SQL text' }, language: { type: 'string', enum: ['eoql', 'sql'], description: 'default eoql' }, as: { type: 'string', description: 'standpoint (reader) to answer as' }, params: { type: 'object' } }, required: ['query'] } },
  { name: 'say', description: 'Append a signed entry: a verb, an address, and a body.', inputSchema: { type: 'object', properties: { verb: { type: 'string' }, addr: { type: 'string' }, body: { type: 'object', description: 'JSON value (null for none)' }, seal: { type: 'boolean', description: 'seal the body end-to-end' } }, required: ['verb', 'addr'] } },
  { name: 'forget', description: 'Retract the live entry at an address (or permanently delete sealed bytes you own).', inputSchema: { type: 'object', properties: { addr: { type: 'string' }, permanent: { type: 'boolean' } }, required: ['addr'] } },
  { name: 'who', description: 'List the writers present in the log.', inputSchema: { type: 'object', properties: {} } },
  { name: 'catalog', description: 'The SQL catalog: tables and columns.', inputSchema: { type: 'object', properties: {} } },
  { name: 'views', description: 'List defined views.', inputSchema: { type: 'object', properties: {} } },
  { name: 'permissions', description: 'What a reader can see and do, with the grant chains that admit them.', inputSchema: { type: 'object', properties: { reader: { type: 'string' } }, required: ['reader'] } },
  { name: 'disclose', description: 'Which fields of a record a reader is allowed to see.', inputSchema: { type: 'object', properties: { reader: { type: 'string' }, addr: { type: 'string' } }, required: ['reader', 'addr'] } },
  { name: 'share', description: 'Grant access: to a writer, group:name, or * (lend by default; give for a permanent copy).', inputSchema: { type: 'object', properties: { to: { type: 'string' }, scope: { type: 'object', description: '{ addr? | kind? | view? , fields?: [...] }' }, can: { type: 'array', items: { type: 'string' } }, until: { type: 'string' }, give: { type: 'boolean' } }, required: ['to'] } },
  { name: 'revoke', description: 'Revoke a grant by id or address.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  { name: 'group', description: 'Define a group of members.', inputSchema: { type: 'object', properties: { name: { type: 'string' }, members: { type: 'array', items: { type: 'string' } } }, required: ['name', 'members'] } },
];

const text = (s) => ({ content: [{ type: 'text', text: typeof s === 'string' ? s : JSON.stringify(s, null, 2) }] });
const errText = (s) => ({ content: [{ type: 'text', text: String(s) }], isError: true });

async function call(name, args) {
  switch (name) {
    case 'query': return client.query(args.query, { language: args.language, as: args.as, params: args.params });
    case 'say': return client.say(args.verb, args.addr, args.body, { seal: !!args.seal });
    case 'forget': return client.forget(args.addr, !!args.permanent);
    case 'who': return client.who();
    case 'catalog': return client.catalog();
    case 'views': return client.views();
    case 'permissions': return client.permissions(args.reader);
    case 'disclose': return client.disclose(args.reader, args.addr);
    case 'share': return client.share({ to: args.to, scope: args.scope, can: args.can, until: args.until, give: !!args.give });
    case 'revoke': return client.revoke(args.id);
    case 'group': return client.group(args.name, args.members || []);
    default: throw new Error(`unknown tool ${name}`);
  }
}

const respond = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');
process.stdin.setEncoding('utf8');
let buf = '';
process.stdin.on('data', async (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i); buf = buf.slice(i + 1);
    if (!line.trim()) continue;
    let msg; try { msg = JSON.parse(line); } catch { continue; }
    if (msg.method === 'notifications/initialized' || msg.method === 'notifications/cancelled') continue;
    if (msg.id === undefined) continue;   // we only answer requests, not notifications
    try {
      if (msg.method === 'initialize') respond({ jsonrpc: '2.0', id: msg.id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'eodb', version: '1.0.0' } } });
      else if (msg.method === 'ping') respond({ jsonrpc: '2.0', id: msg.id, result: {} });
      else if (msg.method === 'tools/list') respond({ jsonrpc: '2.0', id: msg.id, result: { tools: TOOLS } });
      else if (msg.method === 'tools/call') {
        const { name, arguments: args } = msg.params || {};
        const r = await call(name, args || {});
        respond({ jsonrpc: '2.0', id: msg.id, result: text(r) });
      } else respond({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: `method not found: ${msg.method}` } });
    } catch (e) {
      if (msg.method === 'tools/call') respond({ jsonrpc: '2.0', id: msg.id, result: errText(e.message || e) });
      else respond({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: String(e.message || e) } });
    }
  }
});
