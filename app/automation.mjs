// automation.mjs: a node-graph automation engine — n8n-shaped but grown from the pharos model. A graph is DATA (nodes + edges),
// so it is saved as entries and replayed; each run is itself an entry (the audit log). Nothing here writes unless a node's ctx does.
//
//   runAutomation(graph, ctx)              -> { results, order }   topo-sorted; each node runs once its inputs resolve
//   NODE_TYPES                              -> the node palette (registry of connectors + transforms + sinks)
//   toRows(value, opts)                     -> { columns, rows }   the ingest primitive: JSON -> table rows
//   parseRss(xml)                           -> { title, description, items }
//
// ctx = { fetch, space, askModel, fs, triggerData, log }. Nodes only use what they name; a deterministic graph needs no model.
// A node's inputs come from upstream edges; its `fields` are its literal parameters (the n8n "parameters" panel).

export const NODE_TYPES = {
  text: { label: 'Text', in: [], out: ['text'], fields: [['text', 'textarea', 'paste or write…']] },
  http: {
    label: 'HTTP request', in: ['body', 'headers'], out: ['status', 'json', 'body', 'headers'],
    fields: [['url', 'text', 'https://api.example.com/…'], ['method', 'select', 'GET', ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']], ['headers', 'textarea', '{"Accept":"application/json"}'], ['auth', 'text', 'Bearer <token> or user:pass']],
  },
  rss: { label: 'RSS / Atom feed', in: ['url'], out: ['items', 'title', 'description'], fields: [['url', 'text', 'https://example.com/feed.xml']] },
  file: { label: 'File (URL or path)', in: ['url', 'bytes'], out: ['bytes', 'name', 'type'], fields: [['url', 'text', 'https://… or ./data.csv'], ['path', 'text', 'local path (headless)']] },
  json: { label: 'Parse JSON', in: ['text'], out: ['data'], fields: [['text', 'textarea', 'or wire text in']] },
  transform: { label: 'Transform rows', in: ['data'], out: ['rows', 'columns'], fields: [['op', 'select', 'flatten', ['flatten', 'pick', 'filter', 'rename']], ['arg', 'text', 'columns/keys to pick, or col=value']] },
  store: { label: 'Store to table', in: ['rows', 'columns', 'name'], out: ['tableId', 'count'], fields: [['name', 'text', 'table name'], ['ws', 'text', 'w1'], ['append', 'checkbox', 'append to existing table']] },
  webhook: { label: 'Webhook', in: [], out: ['data'], fields: [] },
  model: { label: 'Model', in: ['prompt'], out: ['answer'], fields: [['prompt', 'textarea', 'prompt (or wire it in)']] },
};

// ---- the ingest primitive: any JSON value -> { columns, rows } ------------------------------------------------
function flattenObject(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flattenObject(v, key, out);
    else if (Array.isArray(v)) out[key] = JSON.stringify(v);
    else out[key] = v;
  }
  return out;
}

const ARRAY_KEYS = ['rows', 'items', 'data', 'results', 'records', 'entries', 'values'];

/** turn any value into table rows. Arrays become rows; objects become a single row; nested objects flatten with dot keys.
 *  A wrapper object like { rows: [...] } / { data: [...] } unwraps to its array. `pick` also projects the rows to those keys. */
export function toRows(value, { pick } = {}) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const k of ARRAY_KEYS) if (Array.isArray(value[k])) return toRows(value[k], { pick });
    const arrays = Object.entries(value).filter(([, v]) => Array.isArray(v));
    if (arrays.length === 1) return toRows(arrays[0][1], { pick });
  }
  const arr = Array.isArray(value) ? value : value == null ? [] : [value];
  let rows = arr.map((o) => (o && typeof o === 'object' && !Array.isArray(o) ? flattenObject(o) : { value: o }));
  let columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  if (pick) {
    const keep = String(pick).split(',').map((s) => s.trim()).filter(Boolean);
    columns = columns.filter((c) => keep.includes(c));
    rows = rows.map((r) => Object.fromEntries(keep.filter((k) => k in r).map((k) => [k, r[k]])));
  }
  return { columns, rows };
}

// ---- transforms (declarative; no model, no eval) --------------------------------------------------------------
export function transform(data, { op = 'flatten', arg = '' } = {}) {
  if (op === 'flatten') return toRows(data);
  const { columns, rows } = toRows(data);
  if (op === 'pick') return toRows(rows, { pick: arg });
  if (op === 'filter') {
    const [key, ...rest] = String(arg).split(/(!=|>=|<=|=|>|<)/);
    const opSym = rest[0], target = rest.slice(1).join('');
    const kept = rows.filter((r) => {
      const a = r[key], b = target;
      const na = Number(a), nb = Number(b);
      if (opSym === '=') return String(a) === String(b);
      if (opSym === '!=') return String(a) !== String(b);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) { if (opSym === '>') return na > nb; if (opSym === '<') return na < nb; if (opSym === '>=') return na >= nb; if (opSym === '<=') return na <= nb; }
      return false;
    });
    return { columns, rows: kept };
  }
  if (op === 'rename') {
    const map = Object.fromEntries(String(arg).split(',').map((s) => { const [a, b] = s.split('='); return [a.trim(), (b || a).trim()]; }));
    return { columns: columns.map((c) => map[c] || c), rows: rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [map[k] || k, v]))) };
  }
  return { columns, rows };
}

// ---- RSS/Atom (regex-based; no XML dependency) -----------------------------------------------------------------
const tag = (block, name) => { const m = block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i')); return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim() : ''; };
const blocks = (xml, name) => { const out = []; const re = new RegExp(`<${name}\\b[\\s\\S]*?<\\/${name}>`, 'gi'); let m; while ((m = re.exec(xml))) out.push(m[0]); return out; };

export function parseRss(xml) {
  const title = tag(xml, 'title'), description = tag(xml, 'description');
  const items = [...blocks(xml, 'item'), ...blocks(xml, 'entry')].map((b) => ({
    title: tag(b, 'title'), link: tag(b, 'link') || (b.match(/<link[^>]*href="([^"]+)"/i) || [])[1] || '',
    description: tag(b, 'description') || tag(b, 'summary') || tag(b, 'content'),
    date: tag(b, 'pubDate') || tag(b, 'updated') || tag(b, 'published') || '',
    guid: tag(b, 'guid') || tag(b, 'id') || '',
  })).filter((i) => i.title || i.link);
  return { title, description, items };
}

// ---- header parsing for the http node --------------------------------------------------------------------------
function parseHeaders(raw, auth) {
  const h = {};
  const add = (k, v) => { if (k && v != null && v !== '') h[k.trim()] = String(v).trim(); };
  if (typeof raw === 'string' && raw.trim()) {
    try { Object.entries(JSON.parse(raw)).forEach(([k, v]) => add(k, v)); }
    catch { for (const line of raw.split('\n')) { const i = line.indexOf(':'); if (i > 0) add(line.slice(0, i), line.slice(i + 1)); } }
  } else if (raw && typeof raw === 'object') Object.entries(raw).forEach(([k, v]) => add(k, v));
  if (auth) { if (/^[^:\s]+:.+/.test(auth)) h.Authorization = 'Basic ' + btoa(auth); else h.Authorization = auth; }
  return h;
}

// ---- the node runners (one async call per type) ----------------------------------------------------------------
const RUNNERS = {
  text: async ({ fields }) => ({ text: fields.text || '' }),
  http: async ({ fields, inputs, ctx }) => {
    const url = inputs.url || fields.url || '';
    const method = fields.method || 'GET';
    const headers = parseHeaders(inputs.headers !== undefined ? inputs.headers : fields.headers, fields.auth);
    let body = inputs.body !== undefined ? inputs.body : undefined;
    if (body !== undefined && typeof body !== 'string') body = JSON.stringify(body);
    const res = await (ctx.fetch || fetch)(url, { method, headers, body });
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, json, body: text, headers: Object.fromEntries(res.headers.entries()) };
  },
  rss: async ({ fields, inputs, ctx }) => {
    const url = inputs.url || fields.url || '';
    const text = await (ctx.fetch || fetch)(url).then((r) => r.text());
    const { title, description, items } = parseRss(text);
    return { items, title, description };
  },
  file: async ({ fields, inputs, ctx }) => {
    let bytes, name = '', type = '';
    if (inputs.bytes) { bytes = inputs.bytes; }
    else if (inputs.url || fields.url) {
      const url = inputs.url || fields.url;
      const r = await (ctx.fetch || fetch)(url); bytes = new Uint8Array(await r.arrayBuffer());
      name = url.split('/').pop().split('?')[0] || ''; type = r.headers.get('content-type') || '';
    } else if (fields.path && ctx.fs && ctx.fs.read) { const r = await ctx.fs.read(fields.path); bytes = r.bytes; name = r.name || fields.path.split('/').pop(); type = r.type || ''; }
    else throw new Error('file node needs a url, bytes input, or a path');
    return { bytes, name, type };
  },
  json: async ({ fields, inputs }) => {
    let v;
    if (inputs.text !== undefined) v = inputs.text; else v = fields.text || '';
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { throw new Error('not valid JSON: ' + e.message); } }
    return { data: v };
  },
  transform: async ({ fields, inputs }) => {
    const { columns, rows } = transform(inputs.data !== undefined ? inputs.data : [], { op: fields.op || 'flatten', arg: fields.arg || '' });
    return { rows, columns };
  },
  store: async ({ fields, inputs, ctx }) => {
    if (!ctx.space || !ctx.space.landTable) throw new Error('store node needs ctx.space.landTable');
    const columns = inputs.columns;
    const rows = inputs.rows || [];
    const name = inputs.name || fields.name || 'Imported';
    const ws = fields.ws || 'w1';
    const r = await ctx.space.landTable({ name, columns, rows, ws, append: !!fields.append });
    return { tableId: r.tableId, count: r.rows };
  },
  model: async ({ fields, inputs, ctx }) => {
    if (!ctx.askModel) throw new Error('model node needs ctx.askModel');
    const prompt = inputs.prompt !== undefined ? inputs.prompt : (fields.prompt || '');
    return { answer: await ctx.askModel(prompt) };
  },
  webhook: async ({ ctx }) => ({ data: ctx.triggerData && ctx.triggerData.body !== undefined ? ctx.triggerData.body : (ctx.triggerData || {}) }),
};

/** run one node. Returns { ok, output, error }. */
export async function runNode(node, inputs, ctx) {
  const type = NODE_TYPES[node.type];
  if (!type) return { ok: false, output: null, error: `unknown node type "${node.type}"` };
  try { return { ok: true, output: await (RUNNERS[node.type] || RUNNERS.text)({ fields: node.fields || {}, inputs, ctx }), error: null }; }
  catch (e) { return { ok: false, output: null, error: String(e && e.message || e) }; }
}

// ---- the runner: topo-sort, resolve inputs from edges, run each once -------------------------------------------
export async function runAutomation(graph, ctx = {}) {
  const nodes = graph.nodes || [];
  const edges = graph.edges || [];
  const results = {}; const order = [];
  // incoming edges per (node, port) -> { from, fromPort }
  const incoming = new Map();
  for (const e of edges) incoming.set(`${e.to}\u0000${e.toPort}`, { from: e.from, fromPort: e.fromPort });

  const pending = new Set(nodes.map((n) => n.id));
  let guard = nodes.length + 1;
  while (pending.size && guard-- > 0) {
    let progressed = false;
    for (const id of [...pending]) {
      const node = nodes.find((n) => n.id === id);
      const inputs = {};
      let ready = true;
      for (const port of NODE_TYPES[node.type].in) {
        const src = incoming.get(`${id}\u0000${port}`);
        if (src) { const up = results[src.from]; if (up === undefined) { ready = false; break; } inputs[port] = up.output[src.fromPort]; }
      }
      if (!ready) continue;
      const r = await runNode(node, inputs, ctx);
      results[id] = r;
      order.push(id);
      pending.delete(id); progressed = true;
    }
    if (!progressed) break;
  }
  if (pending.size) {
    for (const id of pending) { results[id] = { ok: false, output: null, error: 'unresolved inputs (cycle or missing upstream)' }; order.push(id); }
  }
  const ok = nodes.every((n) => results[n.id] && results[n.id].ok);
  return { results, order, ok };
}

/** the trigger shape a graph may carry (metadata; the host — server or scheduler — acts on it). */
export function triggerOf(graph) {
  const t = graph.trigger || {};
  return { type: t.type || 'manual', cron: t.cron || null, intervalMs: t.intervalMs || null, path: t.path || null, ...t };
}
