// The dev connection graph: which devices a space sees, through which transports, and which links are up. Built against a real
// two-device space over a relay (as the browser engine runs it), then checks the serializers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSpace } from '../engine.mjs';
import { startRelay } from '../relay.mjs';
import { networkGraph, toDOT, toMermaid, shortRoute } from '../graph.mjs';
import * as B from '../vendor/pharos/browser-store.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cells = JSON.parse(fs.readFileSync(path.join(here, '..', 'vendor', 'pharos', 'cells.json'), 'utf8'));
const mk = () => ({ backend: B.memoryBackend(), blobBackend: B.memoryBackend() });
const opened = [], relays = [];
const open = async (b, extra = {}) => { const sp = await openSpace({ name: 'eodb', ...b, cells, autosync: false, ...extra }); opened.push(sp); return sp; };
const relay = async (port = 0) => { const r = await startRelay({ port }); relays.push(r); return r; };
test.after(async () => { for (const sp of opened) sp.close(); for (const r of relays) await r.close(); });

test('1. a two-device space graphs as: space hub, two devices, one transport, with live links', async () => {
  const r = await relay();
  const A = await open(mk());
  A.append('ws+', { id: 'w1', name: 'Work' });
  const link = await A.share({ routes: [`relay:${r.url}`] }); await A.settle();
  const G = await open(mk(), { join: link });
  G.append('ws+', { id: 'w2', name: 'Guest work' });   // the guest writes data, so it shows as a peer
  await G.syncOnce(); await A.syncOnce();              // guest publishes, founder fetches

  const g = A.networkGraph();
  const kinds = Object.fromEntries(g.nodes.map((n) => [n.id, n.kind]));
  assert.equal(kinds['space:eodb'], 'space');
  assert.equal(kinds[`device:${A.network().self}`], 'device');
  assert.equal(g.summary.devices, 2, 'self + the guest');
  assert.equal(g.summary.routes, 1);
  assert.equal(g.summary.routesUp, 1);

  const edges = g.edges;
  const self = A.network().self, peer = G.network().self;
  assert.ok(edges.some((e) => e.from === `device:${self}` && e.to === 'space:eodb' && e.kind === 'member'));
  assert.ok(edges.some((e) => e.from === `device:${peer}` && e.to === 'space:eodb' && e.kind === 'member'), 'the peer is a member too');
  assert.ok(edges.some((e) => e.from === `device:${self}` && e.to.startsWith('route:relay:') && e.status === 'up'), 'self reaches the relay');
  assert.ok(edges.some((e) => e.from === `device:${peer}` && e.to.startsWith('route:relay:') && e.status === 'inferred'), 'the peer shares the route');
  assert.ok(!edges.some((e) => e.from === `device:${self}` && e.status === 'inferred'), 'self never gets inferred edges (its links are real)');
});

test('2. a route that drops flips its edge to down, and the other device still sees a live link', async () => {
  const r1 = await relay(), r2 = await relay();
  const A = await open(mk());
  A.append('ws+', { id: 'w1', name: 'Work' });
  await A.share({ routes: [`relay:${r1.url}`, `relay:${r2.url}`] }); await A.settle();
  await A.syncOnce();   // both routes up

  const up = A.networkGraph().edges.filter((e) => e.kind === 'connect' && e.status === 'up');
  assert.equal(up.length, 2, 'both routes up at first');

  const port = new URL(r2.url).port; await r2.close(); relays.splice(relays.indexOf(r2), 1);
  await A.syncOnce();   // r2 now down

  const g = A.networkGraph();
  assert.equal(g.summary.routesUp, 1);
  const r2edge = g.edges.find((e) => e.from.startsWith('device:') && e.to.endsWith(`:${port}`));
  assert.equal(r2edge.status, 'down', 'the dropped route is marked down');
  assert.ok(g.edges.some((e) => e.status === 'up' && e.to.startsWith('route:relay:')), 'the other route is still up');
});

test('3. the serializers emit valid graphviz and mermaid', () => {
  const g = networkGraph({ name: 'eodb', self: 'ab12', peers: ['cd34'], routes: [{ uri: 'relay:http://127.0.0.1:8853', scheme: 'relay', ok: true }, { uri: 'mailbox:https://m.example#tok', scheme: 'mailbox', ok: false }] });
  const dot = toDOT(g);
  assert.ok(dot.startsWith('digraph eodb {') && dot.endsWith('}'));
  assert.match(dot, /device:ab12/);
  assert.match(dot, /route:mailbox:https/);
  assert.match(dot, /label="down"/, 'a down route is labelled');
  const mm = toMermaid(g);
  assert.ok(mm.startsWith('graph LR'));
  assert.match(mm, /device_ab12/);
  assert.match(mm, /-\.->/, 'inferred edges are dashed');
  assert.equal(shortRoute({ uri: 'relay:https://very-long-host.example.com/path/that/keeps/going' }).length <= 40, true);
});
