// Run: PHAROS_SRC=/path/to/pharos node --test facade/test-stig.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { init, note, claim, release, decide, verify, brief, findRoot } from './stig.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const TMP = process.env.TEST_TMP || path.join(here, '.test-tmp-stig');
fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true });
let n = 0;
async function project() {
  const root = path.join(TMP, `p${++n}`); fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'a.js'), 'A'.repeat(1000)); fs.writeFileSync(path.join(root, 'src', 'b.js'), 'B'.repeat(3000));
  await init({ root });
  return root;
}

test('init installs the log, a wrapper, hook example, and one CLAUDE.md block even when run twice', async () => {
  const root = await project(); await init({ root });
  assert.ok(fs.existsSync(path.join(root, '.pharos', 'log')));
  assert.ok(fs.statSync(path.join(root, '.pharos', 'db')).mode & 0o100, 'wrapper is executable');
  assert.ok(fs.existsSync(path.join(root, '.pharos', 'hooks.example.json')));
  const md = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
  assert.equal(md.split('<!-- pharos:begin -->').length - 1, 1, 'exactly one block');
  assert.match(md, /\.\/\.pharos\/db brief/);
  assert.equal(findRoot(path.join(root, 'src')), root, 'a command run in a subfolder finds the project');
});

test('init keeps an existing CLAUDE.md and its other content', async () => {
  const root = path.join(TMP, `p${++n}`); fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'CLAUDE.md'), '# My project\n\nUse tabs.\n');
  await init({ root });
  const md = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
  assert.ok(md.startsWith('# My project') && md.includes('Use tabs.') && md.includes('pharos:begin'));
});

test('a note is fresh until a file it names changes, then stale, then missing', async () => {
  const root = await project();
  await note(root, 'one', 'auth', 'Cookies; check in a.js', { files: ['src/a.js'] });
  assert.match((await brief(root)).text, /auth: Cookies.*\[FRESH/);
  fs.appendFileSync(path.join(root, 'src', 'a.js'), 'x');
  assert.match((await brief(root)).text, /\[STALE/);
  fs.unlinkSync(path.join(root, 'src', 'a.js'));
  assert.match((await brief(root)).text, /\[MISSING/);
});

test('the brief reports the bytes fresh notes stand in for, and nothing for stale ones', async () => {
  const root = await project();
  await note(root, 'one', 'a', 'about a', { files: ['src/a.js'] });
  await note(root, 'one', 'b', 'about b', { files: ['src/b.js'] });
  const b = await brief(root);
  assert.equal(b.stats.freshBytes, 4000); assert.equal(b.stats.fresh, 2);
  fs.appendFileSync(path.join(root, 'src', 'b.js'), 'x');
  const c = await brief(root);
  assert.equal(c.stats.freshBytes, 1000); assert.equal(c.stats.stale, 1);
});

test('a note names only files that exist', async () => {
  const root = await project();
  await assert.rejects(() => note(root, 'one', 't', 'x', { files: ['nope.js'] }), /file not found/);
});

test('one session updating its own note replaces it; two sessions writing the same topic are shown as contested', async () => {
  const root = await project();
  await note(root, 'one', 'auth', 'first version');
  await note(root, 'one', 'auth', 'second version');
  let t = (await brief(root)).text;
  assert.ok(t.includes('second version') && !t.includes('CONTESTED'), 'own update replaces');
  await note(root, 'two', 'auth', 'a different view');
  t = (await brief(root)).text;
  assert.match(t, /auth\s+CONTESTED: 2 sessions/); assert.ok(t.includes('second version') && t.includes('a different view'));
});

test('claims: shown, conflict when two sessions claim the same work, hidden after release or expiry', async () => {
  const root = await project();
  await claim(root, 'one', 'rewrite routes');
  let t = (await brief(root)).text;
  assert.match(t, /rewrite routes\s+\[one\]/); assert.ok(!t.includes('CONFLICT'));
  await claim(root, 'two', 'rewrite routes');
  assert.match((await brief(root)).text, /CONFLICT: more than one session claims this/);
  await release(root, 'one', 'rewrite routes'); await release(root, 'two', 'rewrite routes');
  assert.ok(!(await brief(root)).text.includes('rewrite routes'));
  await claim(root, 'three', 'old work', { ttlMinutes: -1 });
  assert.ok(!(await brief(root)).text.includes('old work'), 'an expired claim is not shown');
});

test('unverified notes fade with age; verified ones stay', async () => {
  const root = await project();
  await note(root, 'one', 'kept', 'useful and verified'); await note(root, 'one', 'faded', 'never used');
  await verify(root, 'two', 'kept');
  const t = (await brief(root, { ttlDays: 0, now: Date.now() + 60000 })).text;
  assert.ok(t.includes('useful and verified') && t.includes('verified by 1'));
  assert.ok(!t.includes('never used'));
  await assert.rejects(() => verify(root, 'two', 'no-such'), /no note called/);
});

test('decisions appear in the brief', async () => {
  const root = await project();
  await decide(root, 'one', 'db', 'Use sqlite, no ORM');
  assert.match((await brief(root)).text, /Decisions:[\s\S]*db: Use sqlite, no ORM/);
});

test('the brief respects a size limit', async () => {
  const root = await project();
  for (let i = 0; i < 40; i++) await note(root, 'one', `topic${i}`, 'x'.repeat(200));
  const b = await brief(root, { maxChars: 1500 });
  assert.ok(b.text.length <= 1500); assert.match(b.text, /truncated/);
});

test('the installed wrapper works from a subfolder', async () => {
  const root = await project();
  await note(root, 'one', 'wrapped', 'reachable from the wrapper');
  const r = spawnSync(path.join(root, '.pharos', 'db'), ['brief'], { cwd: path.join(root, 'src'), encoding: 'utf8', env: { ...process.env } });
  assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /reachable from the wrapper/);
  const none = spawnSync('node', [path.join(here, 'db.mjs'), 'brief'], { cwd: TMP, encoding: 'utf8', env: { ...process.env } });
  assert.equal(none.status, 1); assert.match(none.stderr, /no \.pharos here/);
});

test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));
process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true }));
