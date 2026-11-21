#!/usr/bin/env node
// cli.mjs: talk to the EO///DB API from the shell. Auth is an API key (--key or $EO_KEY) or a challenge-signature (--dir --writer).
//   node cli.mjs --key eok_… query 'SEG(sources)'
//   node cli.mjs --dir DB --writer alice say add contact:ana '{"name":"Ana"}'
//   node cli.mjs --dir DB --writer alice apikeys issue --name "my script" --readonly
//   node cli.mjs --dir DB serve --port 8853
import { makeClient } from './client.mjs';
import { serve } from './api.mjs';

const out = (x) => process.stdout.write((typeof x === 'string' ? x : JSON.stringify(x, null, 2)) + '\n');
const die = (m) => { process.stderr.write(String(m) + '\n'); process.exit(2); };

// ---- render a query result for a human (or raw JSON with --json) ----
function renderQuery(r) {
  const { card, envelope } = r;
  const lines = [`rows ${card.rows} · ${card.standpoint} · ${card.determined ? 'determined' : 'CONTESTED'}${card.cache && card.cache !== 'off' ? ` · cache ${card.cache}` : ''}`];
  if (envelope && Array.isArray(envelope.rows)) {
    for (const row of envelope.rows) {
      const body = row.body === undefined ? '' : JSON.stringify(row.body);
      lines.push(`${row._kind || ''}\t${row._addr || ''}\t${body.length > 240 ? body.slice(0, 240) + '…' : body}`);
    }
  }
  if (card.gaps && card.gaps.length) lines.push(`gaps ${card.gaps.join(', ')}`);
  return lines.join('\n');
}

async function main(argv) {
  const flags = {}; const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); const nxt = argv[i + 1]; if (nxt === undefined || nxt.startsWith('--')) flags[k] = true; else { flags[k] = nxt; i++; } continue; }
    pos.push(a);
  }
  const [cmd, ...rest] = pos;
  if (!cmd) die('usage: node cli.mjs [--url U] [--key eok_… | --dir D --writer W] <serve|query|say|forget|who|catalog|views|formats|permissions|disclose|share|revoke|group|apikeys> …');

  if (cmd === 'serve') {
    if (!flags.dir) die('serve needs --dir');
    const s = await serve(flags.dir, { port: flags.port ? Number(flags.port) : 0, host: flags.host, www: flags.www, site: !!flags.site });
    out({ listening: `http://${flags.host || '127.0.0.1'}:${s.port}`, note: 'bind 127.0.0.1 and reach it through a trusted network or a reverse proxy' });
    const stop = async () => { await s.close(); process.exit(0); };
    process.on('SIGINT', stop); process.on('SIGTERM', stop);
    return new Promise(() => {});
  }

  const c = makeClient({ url: flags.url, key: flags.key, dir: flags.dir, writer: flags.writer });

  switch (cmd) {
    case 'query': case 'sql': {
      if (!rest[0]) die('query needs a query string');
      const o = { language: cmd === 'sql' ? 'sql' : flags.language || 'eoql', as: flags.as, params: flags.params ? JSON.parse(flags.params) : undefined };
      const r = await c.query(rest[0], o);
      return out(flags.json ? JSON.stringify(r) : renderQuery(r));
    }
    case 'say': {
      if (!rest[0] || !rest[1]) die('say needs <verb> <addr> [body-json]');
      const body = rest[2] ? JSON.parse(rest[2]) : null;
      return out(await c.say(rest[0], rest[1], body, { seal: !!flags.seal }));
    }
    case 'forget': { if (!rest[0]) die('forget needs <addr>'); return out(await c.forget(rest[0], !!flags.permanent)); }
    case 'who': return out(await c.who());
    case 'catalog': return out(await c.catalog());
    case 'views': return out(await c.views());
    case 'formats': return out(await c.formats());
    case 'permissions': { if (!rest[0]) die('permissions needs <reader>'); return out(await c.permissions(rest[0])); }
    case 'disclose': { if (!rest[0] || !rest[1]) die('disclose needs <reader> <addr>'); return out(await c.disclose(rest[0], rest[1])); }
    case 'share': {
      if (!rest[0]) die('share needs <to> (writer, group:name, or *)');
      return out(await c.share({ to: rest[0], scope: flags.scope ? JSON.parse(flags.scope) : undefined, can: flags.can ? String(flags.can).split(',') : undefined, until: flags.until, for: flags.for, give: !!flags.give }));
    }
    case 'revoke': { if (!rest[0]) die('revoke needs <grant-id-or-addr>'); return out(await c.revoke(rest[0])); }
    case 'group': { if (!rest[0]) die('group needs <name> [member…]'); return out(await c.group(rest[0], rest.slice(1))); }
    case 'apikeys': {
      const sub = rest[0] || 'list';
      if (sub === 'list') return out(await c.apikeys());
      if (sub === 'issue') return out(await c.issueKey({ name: flags.name, rights: flags.readonly ? ['read'] : undefined, expires: flags.expires }));
      if (sub === 'revoke') { if (!rest[1]) die('apikeys revoke needs <id>'); return out(await c.revokeKey(rest[1])); }
      die('apikeys needs list | issue [--name X] [--readonly] [--expires ISO] | revoke <id>');
      break;
    }
    default: die(`unknown command "${cmd}"`);
  }
}

main(process.argv.slice(2)).catch((e) => { process.stderr.write(String(e && e.message ? e.message : e) + '\n'); process.exit(1); });
