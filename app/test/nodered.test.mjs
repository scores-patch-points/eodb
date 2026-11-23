// nodered.mjs: importing a Node-RED flow JSON into the app's automation graph.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importFlow } from '../nodered.mjs';

test('imports a flow: http request -> function -> debug, with edges wired by output index', () => {
  const flow = [
    { id: 'a', type: 'http request', url: 'https://api.example.com/x', method: 'get', wires: [['b']] },
    { id: 'b', type: 'function', func: 'return msg;', wires: [['c']] },
    { id: 'c', type: 'debug', name: 'out', wires: [] },
  ];
  const r = importFlow(flow);
  assert.equal(r.nodes.length, 3);
  assert.equal(r.nodes[0].type, 'http');
  assert.equal(r.nodes[0].fields.url, 'https://api.example.com/x');
  assert.equal(r.nodes[0].fields.method, 'GET');
  assert.equal(r.nodes[1].type, 'transform');
  assert.equal(r.nodes[2].type, 'store');
  // wires -> edges: a->b->c
  assert.equal(r.edges.length, 2);
  assert.equal(r.edges[0].from, r.nodes[0].id);
  assert.equal(r.edges[0].to, r.nodes[1].id);
  assert.ok(r.edges[0].fromPort, 'the http output port is resolved');
  assert.ok(r.warnings.some((w) => w.includes('function')), 'the function node is flagged');
});

test('unknown node types fall back to the universal http node and are warned', () => {
  const flow = [{ id: 'x', type: 'telegram sender', wires: [] }];
  const r = importFlow(flow);
  assert.equal(r.nodes[0].type, 'http');
  assert.ok(r.warnings.some((w) => w.includes('telegram sender')));
});

test('a string payload and non-array flow are handled; bad JSON throws', () => {
  const r = importFlow(JSON.stringify([{ id: 'n1', type: 'inject', payload: 'hi', wires: [] }]));
  assert.equal(r.nodes.length, 1);
  assert.equal(r.nodes[0].type, 'text');
  assert.throws(() => importFlow('{not json'), /not valid JSON/);
});
