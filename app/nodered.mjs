// nodered.mjs: import a Node-RED flow (the JSON export from flows.nodered.org or the Node-RED editor) into this app's
// automation graph. Flows are DATA, so they map straight across: each Node-RED node's `type` is mapped to an app node type,
// and its `wires` become edges. Unknown / contrib node types fall back to the universal `http` node (most are API wrappers).
// The `function` node's JavaScript is NOT executed — it is mapped to a `transform` node and flagged.
import { NODE_TYPES } from './automation.mjs';

const MAP = {
  'http request': { type: 'http', fields: (n) => ({ url: n.url || '', method: String(n.method || 'GET').toUpperCase() }) },
  'http in': { type: 'webhook', fields: (n) => ({ path: n.url || '' }) },
  'http response': { type: 'store', fields: (n) => ({ name: n.name || 'response', ws: 'w1' }) },
  'rss': { type: 'rss', fields: (n) => ({ url: n.url || n.feed || '' }) },
  'function': { type: 'transform', fields: () => ({ op: 'flatten', arg: '' }), warn: 'function JavaScript is not executed' },
  'change': { type: 'transform', fields: (n) => ({ op: 'rename', arg: (n.rules || []).map((r) => r.t === 'set' ? (r.p || '') + '=' + (r.to || '') : '').filter(Boolean).join(',') }), warn: 'change rules mapped to rename where possible' },
  'switch': { type: 'transform', fields: () => ({ op: 'filter', arg: '' }), warn: 'switch routing not applied' },
  'split': { type: 'transform', fields: () => ({ op: 'flatten', arg: '' }) },
  'join': { type: 'transform', fields: () => ({ op: 'flatten', arg: '' }) },
  'template': { type: 'text', fields: (n) => ({ text: n.template || n.field || '' }) },
  'inject': { type: 'text', fields: (n) => ({ text: n.payload !== undefined ? String(n.payload) : '' }) },
  'debug': { type: 'store', fields: (n) => ({ name: n.name || 'debug', ws: 'w1' }), warn: 'debug output stored as a table' },
};

/** Node-RED flow JSON -> { nodes, edges, warnings }. */
export function importFlow(json) {
  let arr;
  try { arr = typeof json === 'string' ? JSON.parse(json) : json; } catch { throw new Error('not valid JSON'); }
  if (!Array.isArray(arr)) arr = arr.flow || arr.nodes;
  if (!Array.isArray(arr)) throw new Error('no nodes found (expected a Node-RED flow array)');

  const appId = (n) => 'nr' + String(n.id || Math.random().toString(36).slice(2, 8)).replace(/[^a-zA-Z0-9]/g, '');
  const nodes = [], warnings = [], byId = new Map();
  arr.forEach((n, i) => {
    const m = MAP[n.type] || { type: 'http', fields: () => ({ url: n.url || '', method: 'GET' }), warn: `unknown node type "${n.type}" → HTTP (set the URL)` };
    const node = { id: appId(n), type: m.type, x: 40 + (i % 6) * 220, y: 40 + Math.floor(i / 6) * 280, fields: m.fields(n), nr: n.type };
    nodes.push(node); byId.set(n.id, node);
    if (m.warn) warnings.push(`${n.type}: ${m.warn}`);
  });

  const edges = [];
  for (const n of arr) {
    const src = byId.get(n.id); if (!src) continue;
    const out = (NODE_TYPES[src.type] && NODE_TYPES[src.type].out) || ['out'];
    (n.wires || []).forEach((targets, outIdx) => {
      const fp = out[Math.min(outIdx, out.length - 1)] || 'out';
      for (const t of targets || []) {
        const dst = byId.get(t); if (!dst) continue;
        const inp = (NODE_TYPES[dst.type] && NODE_TYPES[dst.type].in) || ['in'];
        edges.push({ from: src.id, fromPort: fp, to: dst.id, toPort: inp[0] || 'in' });
      }
    });
  }
  return { nodes, edges, warnings };
}
