// lxmf-bot.mjs: drive a space from Sideband (or any LXMF client) on a phone. The node's LXMF daemon (app/reticulum/lxmf_bridge.py) hands it
// every signed text message; this answers ONLY senders on the allow-list (their LXMF addresses, as Sideband shows them) and stays silent to
// everyone else. Every write it makes is an ordinary append by this node, so it passes the same grants and signing as any other.
//
// The commands are a declared protocol, not language: the first word must equal a verb in COMMANDS exactly, and the rest of the message is
// carried verbatim as data (a note's text). Nothing here reads meaning into the text.
//   help | status | recent [n] | note <text>
import { tcpChannel } from './tcp.mjs';

const NOTES_DOC = 'lxmf-notes';
const RATE = { perMinute: 30 };

/** split off the first word without a pattern: the verb is everything before the first whitespace character. */
function verbAndRest(text) {
  const t = String(text).trim();
  let i = 0; while (i < t.length && t[i] !== ' ' && t[i] !== '\n' && t[i] !== '\t') i++;
  return [t.slice(0, i).toLowerCase(), t.slice(i).trim()];
}
const label = (e) => { const b = e.body || {}; return b.name || b.title || b.x || b.id || ''; };

export const COMMANDS = {
  help: () => 'commands: status | recent [n] | note <text>',
  status: (space) => {
    const r = space.report(), sh = r.share;
    return `entries ${r.entries}; role ${space.role}; routes up ${sh ? `${sh.routesUp}/${sh.routes}` : '0/0'}; last sync ${sh && sh.last ? new Date(sh.last).toISOString() : 'never'}`;
  },
  recent: (space, rest) => {
    const n = Math.min(10, Math.max(1, Number(verbAndRest(rest)[0]) || 5));
    const v = space.view().filter((e) => e.op && !e.op.startsWith('sig')).slice(-n);
    return v.length ? v.map((e) => `${e.op} ${label(e)}`.trim()).join('\n') : 'no entries yet';
  },
  note: async (space, rest, from) => {
    if (!rest) return 'usage: note <text>';
    const view = space.view();
    if (!view.some((e) => e.op === 'doc+' && e.body && e.body.id === NOTES_DOC)) {
      const ws = (view.find((e) => e.op === 'ws+') || {}).body?.id || (space.append('ws+', { id: 'w-lxmf', name: 'From LXMF' }), 'w-lxmf');
      space.append('doc+', { id: NOTES_DOC, ws, title: 'Notes from LXMF', kind: 'note' });
    }
    const id = `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    space.append('blk+', { doc: NOTES_DOC, id, t: 'p', x: rest.slice(0, 4000), from });
    await space.settle();
    return `noted (${id})`;
  },
};

/** attach a bot to `space` through the local daemon at `bridge`. `allow`: LXMF addresses (32 hex) that may command it; at least one. */
export async function startLxmfBot(space, { bridge = process.env.EODB_LXMF_BRIDGE || '127.0.0.1:7772', allow = [] } = {}) {
  const allowed = new Set(allow.map((a) => String(a).trim().toLowerCase()).filter((a) => a.length === 32));
  if (!allowed.size) throw new Error('lxmf bot: give at least one allowed LXMF address (--bot-allow). It never answers someone who merely messages it.');
  const [host, port] = bridge.split(':');
  const ch = await tcpChannel(host, Number(port));
  const up = await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('lxmf bot: the daemon did not answer')), 30000); ch.onMessage((m) => { clearTimeout(t); res(JSON.parse(m)); }); ch.send(JSON.stringify({ t: 'bot' })); });
  if (up.t !== 'up') throw new Error('lxmf bot: refused by the daemon');
  const refused = new Map(), recent = new Map();
  const handled = [];
  ch.onMessage(async (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t !== 'msg') return;
    if (!allowed.has(m.from)) { refused.set(m.from, (refused.get(m.from) || 0) + 1); return; }   // silent: an unknown sender learns nothing
    const now = Date.now(), times = (recent.get(m.from) || []).filter((t) => now - t < 60000);
    if (times.length >= RATE.perMinute) return;
    times.push(now); recent.set(m.from, times);
    const [verb, rest] = verbAndRest(m.text);
    const fn = Object.hasOwn(COMMANDS, verb) ? COMMANDS[verb] : null;
    let reply; try { reply = fn ? await fn(space, rest, m.from) : `unknown command "${verb}". ${COMMANDS.help()}`; } catch (e) { reply = `error: ${e.message || e}`; }
    handled.push({ from: m.from, verb });
    ch.send(JSON.stringify({ t: 'send', to: m.from, text: reply }));
  });
  return { address: up.address, refused, handled, close: () => ch.close() };
}
