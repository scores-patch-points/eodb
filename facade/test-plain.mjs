// The plain store is a pharos in pharos's own (binary) format. These hold the facade to it: another repo's pharos, written by pharos's own
// library, is read correctly; the cache key moves when it grows; trace, the chooser and stored views work on it. (EOQL's own `lib:` reader lists
// only legacy .jsonl files, so on the binary core it sees an empty log: the facade reads a plain log through pharos's library instead.)
// Run: PHAROS_SRC=/path/to/pharos node --test test-plain.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ask, get, who, trace, readKind, defineView, openLog, say } from './db.mjs';
import { libs, detect } from './store.mjs';
import { position } from './sig.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const TMP = process.env.TEST_TMP || path.join(here, '.test-tmp-plain');
fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true });
let n = 0; const fresh = () => path.join(TMP, `log${++n}`);
process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true }));
const { P } = await libs();

// A pharos written by another repo, with pharos's own library only: nothing of this facade.
function foreign(dir) {
  const h = P.open('theirs', { dir, writer: 'other-repo' });
  P.weave(h, { cell: 'DEF·Figure', kind: 'kind', addr: 'kind:placement', body: { name: 'placement', cell: 'INS·Figure' } });
  const a = P.weave(h, { cell: 'INS·Figure', kind: 'placement', addr: 'clip:1', body: { s: 0, e: 3 } });
  const b = P.weave(h, { cell: 'INS·Figure', kind: 'placement', addr: 'clip:2', body: { s: 3, e: 6 }, of: [a.id] });
  return { h, a, b };
}

test('a binary pharos is detected as plain', () => {
  const dir = fresh(); foreign(dir);
  assert.ok(fs.readdirSync(dir).some((f) => f.endsWith('.phr'))); assert.equal(detect(dir), 'plain');
});

test("another repo's pharos, written by pharos's own library, is read: ask, get, who, and a kind read all see its entries", async () => {
  const dir = fresh(); foreign(dir);
  const { envelope } = await ask(dir, 'SEG(sources; kinds: ["placement"])');
  assert.deepEqual(envelope.rows.map((r) => r._addr).sort(), ['clip:1', 'clip:2']);
  const g = await get(dir, 'clip:1'); assert.equal(g.history.length, 1);
  assert.deepEqual((await who(dir)).find((x) => x.writer === 'other-repo').entries > 0, true);
  const r = await readKind(dir, 'placement'); assert.equal(r.rows.length, 2); assert.equal(r.strategy, 'scan', 'a plain log has no .jsonl index: it is always scanned');
});

test('the cache key moves when a binary pharos grows: a cached ask never serves a stale answer', async () => {
  const dir = fresh(), { h } = foreign(dir), q = 'SEG(sources; kinds: ["placement"])';
  const before = position(dir); const a1 = await ask(dir, q, { cached: true });
  assert.equal(a1.envelope.rows.length, 2);
  P.weave(h, { cell: 'INS·Figure', kind: 'placement', addr: 'clip:3', body: { s: 6, e: 9 } });
  assert.notEqual(position(dir), before, 'position covers .phr streams');
  const a2 = await ask(dir, q, { cached: true });
  assert.equal(a2.envelope.rows.length, 3, 'the new entry is seen');
});

test('trace walks the of-links of a plain pharos, breadth first, the way the index walk does', async () => {
  const dir = fresh(), { a, b } = foreign(dir);
  const t = (await trace(dir, b.id))[0];
  assert.deepEqual(t.ancestors.map((x) => x.id), [a.id]); assert.equal(t.hops, 2);
});

test('a stored view defined on a plain log lands in the binary core and is asked by name', async () => {
  const dir = fresh(); const h = await openLog({ dir, writer: 'me', store: 'plain' });
  await say(h, 'add', 'contact:ana', { name: 'Ana' }); await say(h, 'add', 'contact:ben', { name: 'Ben' });
  await defineView(dir, 'me', 'names', 'REC(SEG(sources; kinds: ["contact"]); pick: ["name"])');
  const viaLib = P.entries(P.open('db', { dir, writer: 'x', frame: false })).filter((e) => e.kind === 'view');
  assert.equal(viaLib.length, 1, 'the view is in the binary core, not only in a legacy .jsonl');
  const { envelope } = await ask(dir, 'names'); assert.deepEqual(envelope.rows.map((r) => r.name).sort(), ['Ana', 'Ben']);
});
