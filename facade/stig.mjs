// stig.mjs: the stigmergy kit. One use case: coding sessions that share a pharos in a project leave marks for each other,
// so a new session reads a short brief instead of re-reading files. Marks are notes (with file hashes, so staleness is detectable),
// claims (who is working on what, with an expiry), decisions, and verifications (a note someone used and found right).
// Everything is an ordinary pharos entry written through db.mjs; nothing here is special-cased in the log.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openLog, say, forget, ask } from './db.mjs';
import * as MK from './marks.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BEGIN = '<!-- pharos:begin -->', END = '<!-- pharos:end -->';
export const findRoot = (start = process.cwd()) => {
  let d = path.resolve(start);
  for (;;) { if (fs.existsSync(path.join(d, '.pharos', 'log')) || fs.existsSync(path.join(d, '.pharos', 'README.md'))) return d; const up = path.dirname(d); if (up === d) return null; d = up; }
};
const logDir = (root) => path.join(root, '.pharos', 'log');
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const safeName = (s) => String(s).replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 40) || 's';
const iso = (ms = Date.now()) => new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z');
const ago = (t, now = Date.now()) => { const m = Math.max(0, Math.round((now - Date.parse(t)) / 60000)); return m < 90 ? `${m}m` : m < 2880 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`; };

export const CLAUDE_BLOCK = `${BEGIN}
## Shared notes (pharos): read this first

Other sessions working in this project leave short notes here. Using them saves you re-reading files.

1. **Start:** run \`./.pharos/db brief\`. Trust a note marked FRESH; re-read the file if it is STALE or MISSING.
2. **When you learn something others will need**, record it in one or two sentences:
   \`./.pharos/db note <topic> "<what you learned>" --files path/a,path/b --session <your-task-name>\`
   Name files so the note goes stale if they change.
3. **Before a big change:** \`./.pharos/db claim "<what you will change>" --session <your-task-name>\`; when finished: \`./.pharos/db release "<same text>" --session <your-task-name>\`. If the brief shows someone else claimed it, talk to the user first.
4. **If a note helped and was right:** \`./.pharos/db verify <topic> --session <your-task-name>\`. Verified notes rise; unverified notes fade.
5. Record decisions with \`./.pharos/db decide <topic> "<decision and why>" --session <your-task-name>\`.

Use one stable \`--session\` name per task (letters, digits, dashes). Notes are marks, not orders: check them against the code when it matters.
${END}`;

export async function init({ root, hooks = false }) {
  root = path.resolve(root || process.cwd());
  const p = path.join(root, '.pharos');
  fs.mkdirSync(path.join(p, 'log'), { recursive: true });
  // New notebooks use the lazy store (writes stay flat as the log grows); an existing notebook keeps whatever store it already has.
  if (!fs.readdirSync(path.join(p, 'log')).length) await openLog({ dir: path.join(p, 'log'), writer: 'init', store: process.env.DB_STORE || 'lazy' });
  const dbjs = path.join(HERE, 'db.mjs');
  const src = process.env.PHAROS_SRC;
  if (!src) throw new Error('Set PHAROS_SRC to a clone of the pharos repo first (git clone https://github.com/scores-patch-points/pharos.git).');
  fs.writeFileSync(path.join(p, 'db'), `#!/bin/sh\nexport PHAROS_SRC="\${PHAROS_SRC:-${src}}"\nexec node "${dbjs}" "$@"\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(p, '.gitignore'), 'db\nlog/\n');
  fs.writeFileSync(path.join(p, 'README.md'), '# .pharos\n\nA shared, append-only notebook for the sessions working in this project. `./.pharos/db brief` shows what is known. Each session writes only its own file under `log/`. Delete this folder to remove it. See the db.mjs README for details.\n');
  const cm = path.join(root, 'CLAUDE.md');
  const cur = fs.existsSync(cm) ? fs.readFileSync(cm, 'utf8') : '';
  const next = cur.includes(BEGIN) ? cur.replace(new RegExp(`${BEGIN}[\\s\\S]*?${END}`), CLAUDE_BLOCK) : (cur ? cur.replace(/\s*$/, '\n\n') : '') + CLAUDE_BLOCK + '\n';
  fs.writeFileSync(cm, next);
  const hook = { hooks: { SessionStart: [{ hooks: [{ type: 'command', command: './.pharos/db brief --max-chars 3000' }] }] } };
  fs.writeFileSync(path.join(p, 'hooks.example.json'), JSON.stringify(hook, null, 2) + '\n');
  return { root, installed: ['.pharos/log/', '.pharos/db', '.pharos/hooks.example.json', 'CLAUDE.md (pharos block)'], next: ['Start a Claude Code session in this folder: CLAUDE.md tells it to run ./.pharos/db brief.', 'Optional: copy .pharos/hooks.example.json into .claude/settings.json so the brief is injected at session start (it runs a command, so review it first).'] };
}

const need = (root) => { if (!root) throw new Error('no .pharos here or above: run `db init` in the project first'); return root; };
const liveAt = (rows, kind) => rows.filter((r) => r._kind === kind && r._retracted !== 1);

export async function note(root, session, topic, text, { files = [] } = {}) {
  need(root);
  const hashes = {}; let bytes = 0;
  for (const f of files) { const fp = path.join(root, f); if (!fs.existsSync(fp)) throw new Error(`file not found: ${f}`); hashes[f] = sha(fp); bytes += fs.statSync(fp).size; }
  const h = await openLog({ dir: logDir(root), writer: safeName(session) });
  const addr = `note:${topic}`;
  const prior = (await headsMine(h, addr, 'note'));
  return say(h, 'add', addr, { text, files: hashes, bytes, session: safeName(session), at: iso() }, { of: prior });
}
async function headsMine(h, addr, kind) {
  return h.liveAt(addr).filter((e) => e.by === h.by && e.kind === kind).map((e) => e.id);
}
export async function claim(root, session, what, { ttlMinutes = 240 } = {}) {
  need(root);
  const h = await openLog({ dir: logDir(root), writer: safeName(session) });
  const addr = `claim:${what}`;
  return say(h, 'add', addr, { what, session: safeName(session), at: iso(), until: iso(Date.now() + ttlMinutes * 60000) }, { of: await headsMine(h, addr, 'claim') });
}
export async function release(root, session, what) {
  need(root);
  const h = await openLog({ dir: logDir(root), writer: safeName(session) });
  return forget(h, `claim:${what}`);
}
export async function decide(root, session, topic, text) {
  need(root);
  const h = await openLog({ dir: logDir(root), writer: safeName(session) });
  const addr = `decision:${topic}`;
  return say(h, 'add', addr, { text, session: safeName(session), at: iso() }, { of: await headsMine(h, addr, 'decision') });
}
export async function verify(root, session, topic) {
  need(root);
  const h = await openLog({ dir: logDir(root), writer: safeName(session) });
  const target = h.liveAt(`note:${topic}`).filter((e) => e.kind === 'note');
  if (!target.length) throw new Error(`no note called ${topic}`);
  return say(h, 'check', `note:${topic}`, { session: safeName(session), at: iso() }, { of: target.map((e) => e.id) });
}

// brief: what the sessions in this project know, compact. Fresh notes first; stale and missing flagged; claims and conflicts surfaced.
export async function brief(root, { maxChars = 6000, ttlDays = 7, now = Date.now() } = {}) {
  need(root);
  const dir = logDir(root);
  if (!fs.existsSync(dir) || !fs.readdirSync(dir).length) return { text: '(no shared notes yet)', stats: { notes: 0 } };
  const get = async (kind) => (await ask(dir, `SEG(sources; kinds: ["${kind}"])`, { mark: false })).envelope.rows;
  const [notes, checks, claims, decisions] = await Promise.all([get('note'), get('note.check').catch(() => []), get('claim'), get('decision')]);
  await MK.noteRead(dir, 'reader', { question: 'brief', via: 'brief', rows: [...notes, ...checks, ...claims, ...decisions] });   // one co-read set for the whole brief
  const verifiedBy = new Map();
  for (const c of checks) for (const id of c._of || []) { const s = verifiedBy.get(id) || new Set(); s.add(c.body?.session); verifiedBy.set(id, s); }
  const out = []; let freshBytes = 0, nFresh = 0, nStale = 0, nMissing = 0;
  const rank = (n) => (verifiedBy.get(n._id)?.size || 0);
  const live = liveAt(notes, 'note').map((n) => {
    const files = n.body?.files || {}; let state = 'FRESH';
    for (const [f, hsh] of Object.entries(files)) { const fp = path.join(root, f); if (!fs.existsSync(fp)) { state = 'MISSING'; break; } if (sha(fp) !== hsh) state = 'STALE'; }
    return { n, state, age: now - Date.parse(n.body?.at || n._at), v: rank(n) };
  }).filter((x) => x.v > 0 || x.age <= ttlDays * 86400000);     // unverified marks fade; verified ones stay
  const byTopic = new Map(); for (const x of live) { const t = x.n._addr; (byTopic.get(t) || byTopic.set(t, []).get(t)).push(x); }
  const sorted = [...byTopic.values()].sort((a, b) => (Math.max(...b.map((x) => x.v)) - Math.max(...a.map((x) => x.v))) || (Math.min(...a.map((x) => x.age)) - Math.min(...b.map((x) => x.age))));
  const liveClaims = liveAt(claims, 'claim').filter((c) => Date.parse(c.body?.until) > now);
  const byWhat = new Map(); for (const c of liveClaims) { const w = c.body.what; (byWhat.get(w) || byWhat.set(w, []).get(w)).push(c.body.session); }
  out.push('SHARED NOTES');
  if (byWhat.size) { out.push('\nIn progress (claims):'); for (const [w, s] of byWhat) out.push(`- ${w}  [${[...new Set(s)].join(', ')}]${new Set(s).size > 1 ? '  CONFLICT: more than one session claims this' : ''}`); }
  const decs = liveAt(decisions, 'decision'); if (decs.length) { out.push('\nDecisions:'); for (const d of decs) out.push(`- ${d._addr.slice(9)}: ${d.body.text}  [${d.body.session}, ${ago(d.body.at, now)} ago]`); }
  out.push('\nNotes (use FRESH ones instead of re-reading; re-read STALE or MISSING ones):');
  for (const group of sorted) {
    const topic = group[0].n._addr.slice(5);
    if (group.length > 1) out.push(`- ${topic}  CONTESTED: ${group.length} sessions wrote different notes`);
    for (const x of group) {
      if (x.state === 'FRESH') { nFresh++; freshBytes += x.n.body?.bytes || 0; } else if (x.state === 'STALE') nStale++; else nMissing++;
      out.push(`${group.length > 1 ? '    ' : '- '}${group.length > 1 ? '' : topic + ': '}${x.n.body.text}  [${x.state}${x.v ? `, verified by ${x.v}` : ''}, ${x.n.body.session}, ${ago(x.n.body.at, now)} ago${x.n.body.files && Object.keys(x.n.body.files).length ? ', files: ' + Object.keys(x.n.body.files).join(' ') : ''}]`);
    }
  }
  if (!sorted.length) out.push('(none)');
  out.push(`\n${nFresh} fresh, ${nStale} stale, ${nMissing} missing. Fresh notes stand in for ${freshBytes} bytes of files (about ${Math.round(freshBytes / 4)} tokens at a rough 4 bytes per token).`);
  let text = out.join('\n');
  if (text.length > maxChars) text = text.slice(0, maxChars - 40) + '\n... (brief truncated to fit the limit)';
  return { text, stats: { notes: sorted.length, fresh: nFresh, stale: nStale, missing: nMissing, freshBytes, claims: byWhat.size, briefChars: text.length } };
}

export async function run(cmd, argv) {
  const flags = {}, pos = [];
  for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const k = a.slice(2); const nx = argv[i + 1]; if (nx === undefined || nx.startsWith('--')) flags[k] = true; else { flags[k] = nx; i++; } } else pos.push(a); }
  const session = flags.session || `s-${crypto.randomBytes(3).toString('hex')}`;
  if (!flags.session && ['note', 'claim', 'release', 'decide', 'verify'].includes(cmd)) console.error(`(no --session given; using ${session}. Use one stable name per task so your marks stay together.)`);
  if (cmd === 'init') { console.log(JSON.stringify(await init({ root: flags.dir || process.cwd(), hooks: !!flags.hooks }), null, 2)); return; }
  const root = findRoot(flags.dir || process.cwd());
  if (cmd === 'brief') { const b = await brief(root, { maxChars: flags['max-chars'] ? Number(flags['max-chars']) : 6000 }); console.log(b.text); return; }
  if (cmd === 'note') { const [topic, text] = pos; if (!topic || !text) throw new Error('usage: db note <topic> "<text>" [--files a,b] --session NAME'); const e = await note(root, session, topic, text, { files: flags.files ? String(flags.files).split(',') : [] }); console.log(JSON.stringify({ noted: topic, id: e.id.slice(0, 12) })); return; }
  if (cmd === 'claim') { const e = await claim(root, session, pos[0], { ttlMinutes: flags.ttl ? Number(flags.ttl) : 240 }); console.log(JSON.stringify({ claimed: pos[0], id: e.id.slice(0, 12) })); return; }
  if (cmd === 'release') { await release(root, session, pos[0]); console.log(JSON.stringify({ released: pos[0] })); return; }
  if (cmd === 'decide') { const e = await decide(root, session, pos[0], pos[1]); console.log(JSON.stringify({ decided: pos[0], id: e.id.slice(0, 12) })); return; }
  if (cmd === 'verify') { await verify(root, session, pos[0]); console.log(JSON.stringify({ verified: pos[0] })); return; }
}
