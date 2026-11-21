// automation.mjs: the node-graph engine — toRows, parseRss, transform, and the topo-sorted runner, plus an end-to-end ingest.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toRows, transform, parseRss, runAutomation, NODE_TYPES } from '../automation.mjs';
import { openSpace } from '../engine.mjs';
import * as B from '../vendor/pharos/browser-store.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cells = JSON.parse(fs.readFileSync(path.join(here, '..', 'vendor', 'pharos', 'cells.json'), 'utf8'));

test('toRows flattens nested objects into rows with dot keys', () => {
  const data = [{ a: 1, b: { c: 2 } }, { a: 2, b: { c: 3 } }];
  const { columns, rows } = toRows(data);
  assert.deepEqual(columns, ['a', 'b.c']);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]['b.c'], 2);
});

test('transform supports flatten, pick, filter and rename', () => {
  const data = [{ name: 'a', x: 1 }, { name: 'b', x: 2 }];
  assert.equal(transform(data, { op: 'pick', arg: 'name' }).columns.length, 1);
  assert.equal(transform(data, { op: 'filter', arg: 'x>=2' }).rows.length, 1);
  assert.equal(transform(data, { op: 'filter', arg: 'x>=2' }).rows[0].name, 'b');
  const ren = transform(data, { op: 'rename', arg: 'name=label' });
  assert.deepEqual(ren.columns, ['label', 'x']);
});

test('parseRss reads RSS items and Atom entries', () => {
  const rss = '<rss><channel><title>Feed</title><item><title>A</title><link>http://a</link><description>d</description></item><item><title>B</title><link>http://b</link></item></channel></rss>';
  const r = parseRss(rss);
  assert.equal(r.title, 'Feed');
  assert.equal(r.items.length, 2);
  assert.equal(r.items[1].title, 'B');
  const atom = '<feed><title>F</title><entry><title>E</title><link href="http://e"/></entry></feed>';
  assert.equal(parseRss(atom).items[0].link, 'http://e');
});

test('the runner topo-sorts and wires inputs through edges', async () => {
  const graph = { nodes: [
    { id: 'n1', type: 'text', fields: { text: '{"rows":[{"v":"a"},{"v":"b"}]}' } },
    { id: 'n2', type: 'json', fields: {} },
    { id: 'n3', type: 'transform', fields: { op: 'flatten' } },
  ], edges: [
    { from: 'n1', fromPort: 'text', to: 'n2', toPort: 'text' },
    { from: 'n2', fromPort: 'data', to: 'n3', toPort: 'data' },
  ] };
  const r = await runAutomation(graph, {});
  assert.equal(r.ok, true);
  assert.deepEqual(r.order, ['n1', 'n2', 'n3']);
  assert.equal(r.results.n3.output.rows.length, 2);
});

test('http and rss nodes use the provided fetch; errors are caught per-node', async () => {
  const fetch = async (url) => ({ status: 200, text: async () => (url.includes('feed') ? '<rss><channel><title>F</title><item><title>I</title></item></channel></rss>' : '{"ok":true}'), headers: { entries: () => [['content-type', 'application/json']] } });
  const http = await runAutomation({ nodes: [{ id: 'h', type: 'http', fields: { url: 'https://api/x', method: 'GET' } }], edges: [] }, { fetch });
  assert.equal(http.results.h.output.json.ok, true);
  const rss = await runAutomation({ nodes: [{ id: 'r', type: 'rss', fields: { url: 'https://x/feed' } }], edges: [] }, { fetch });
  assert.equal(rss.results.r.output.items.length, 1);
  const bad = await runAutomation({ nodes: [{ id: 'b', type: 'http', fields: { url: 'https://x' } }], edges: [] }, { fetch: async () => { throw new Error('down'); } });
  assert.equal(bad.ok, false);
  assert.match(bad.results.b.error, /down/);
});

test('end-to-end: rss -> transform -> store lands rows the engine can query back', async () => {
  const sp = await openSpace({ name: 'eodb', backend: B.memoryBackend(), blobBackend: B.memoryBackend(), cells, autosync: false });
  const feed = '<rss><channel><title>Contracts</title><item><title>Acme</title><description>1500</description></item><item><title>Dell</title><description>86250</description></item></channel></rss>';
  const graph = { nodes: [
    { id: 'f', type: 'rss', fields: { url: 'https://x/feed' } },
    { id: 't', type: 'transform', fields: { op: 'pick', arg: 'title,description' } },
    { id: 's', type: 'store', fields: { name: 'Feed items', ws: 'w1' } },
  ], edges: [
    { from: 'f', fromPort: 'items', to: 't', toPort: 'data' },
    { from: 't', fromPort: 'rows', to: 's', toPort: 'rows' },
  ] };
  const r = await sp.runAutomation(graph, { fetch: async () => ({ text: async () => feed }) });
  assert.equal(r.ok, true);
  const rows = sp.sql('SELECT title FROM "Feed items" ORDER BY title');
  assert.deepEqual(rows.rows.map((x) => x.title), ['Acme', 'Dell']);
  sp.close();
});
