// graph.mjs: the connection graph of a space, for development — which devices are connected, through which transports, and
// which of those connections are up. Pure (no DOM, no node built-ins): it takes a snapshot and returns nodes + edges, with
// serializers for JSON, graphviz DOT and Mermaid. It is a dev tool, never user-facing.
//
// Snapshot shape (as returned by engine.mjs `space.network()`):
//   { name, self, peers: [writer], routes: [{ uri, scheme, ok, error, at }] }
//
// The model: a space hub, the devices in it (self + peers), and the transports each device reaches. Self->route edges carry
// the real health (up/down); peer->route edges are inferred (routes are announced in the log, so members are presumed to
// share them) and are drawn dashed.
export function networkGraph({ name = 'eodb', self, peers = [], routes = [] } = {}) {
  const nodes = [], edges = [];
  const dev = (w) => `device:${w}`;
  const rid = (r) => `route:${r.uri}`;
  const selfId = dev(self);

  nodes.push({ id: `space:${name}`, kind: 'space', label: name });
  nodes.push({ id: selfId, kind: 'device', label: self, self: true });
  for (const p of peers) if (p !== self && !nodes.some((n) => n.id === dev(p))) nodes.push({ id: dev(p), kind: 'device', label: p });
  for (const r of routes) nodes.push({ id: rid(r), kind: 'transport', label: shortRoute(r), scheme: r.scheme, ok: r.ok });

  edges.push({ from: selfId, to: `space:${name}`, kind: 'member', label: name });
  for (const p of peers) if (p !== self) edges.push({ from: dev(p), to: `space:${name}`, kind: 'member', label: name });
  for (const r of routes) edges.push({ from: selfId, to: rid(r), kind: 'connect', status: r.ok ? 'up' : 'down', error: r.error || null, at: r.at || null });
  for (const p of peers) if (p !== self) for (const r of routes) edges.push({ from: dev(p), to: rid(r), kind: 'connect', status: 'inferred' });

  return { name, nodes, edges, summary: { devices: 1 + peers.filter((p) => p !== self).length, routes: routes.length, routesUp: routes.filter((r) => r.ok).length } };
}

/** a short, readable label for a route: relay:https://host/path -> "relay · host/path" */
export function shortRoute(r) {
  const uri = r.uri || r;
  const i = uri.indexOf(':');
  const scheme = i < 0 ? 'route' : uri.slice(0, i);
  let tail = i < 0 ? uri : uri.slice(i + 1).replace(/^\/+/, '');
  if (tail.length > 24) tail = tail.slice(0, 24) + '…';
  return `${scheme} · ${tail}`;
}

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
const mid = (s) => String(s).replace(/[^A-Za-z0-9_]/g, '_');

export function toJSON(g) { return JSON.stringify(g, null, 2); }

export function toDOT(g) {
  const shape = { device: 'ellipse', transport: 'box', space: 'diamond' };
  const color = { device: 'black', space: 'purple' };
  const out = ['digraph eodb {', '  rankdir=LR;', '  labelloc="t";'];
  for (const n of g.nodes) {
    const c = n.kind === 'transport' ? (n.ok === false ? 'red' : 'dodgerblue') : (color[n.kind] || 'black');
    out.push(`  "${esc(n.id)}" [label="${esc(n.label)}" shape=${shape[n.kind] || 'box'} color=${c}${n.self ? ' penwidth=2' : ''}];`);
  }
  for (const e of g.edges) {
    let attr = '';
    if (e.kind === 'member') attr = 'style=dotted color=gray';
    else if (e.status === 'down') attr = 'color=red';
    else if (e.status === 'inferred') attr = 'style=dashed color=gray';
    else attr = 'color=green';
    out.push(`  "${esc(e.from)}" -> "${esc(e.to)}" [${attr}${e.kind === 'connect' && e.status === 'up' ? ' label="up"' : ''}${e.status === 'down' ? ' label="down"' : ''}];`);
  }
  out.push('}');
  return out.join('\n');
}

export function toMermaid(g) {
  const out = ['graph LR'];
  for (const n of g.nodes) {
    const wrap = n.kind === 'device' ? ['[', ']'] : n.kind === 'space' ? ['{', '}'] : ['(', ')'];
    out.push(`  ${mid(n.id)}${wrap[0]}"${esc(n.label)}"${wrap[1]}`);
  }
  for (const e of g.edges) {
    const arrow = e.status === 'down' ? '--|down|' : e.status === 'inferred' ? '-.->' : e.kind === 'member' ? '---' : '-->';
    out.push(`  ${mid(e.from)} ${arrow} ${mid(e.to)}`);
  }
  return out.join('\n');
}
