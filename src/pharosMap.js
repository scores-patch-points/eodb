/**
 * pharosMap.js — an eodb event as a pharos weft, and back.
 *
 * PURE: no imports, no Matrix, no pharos, no browser or Node APIs. It only says what a stored operator
 * event becomes in a pharos and how to get the event back, so the same mapping serves the Node importer
 * (tools/pharosImport.mjs) and any in-browser carrier. A weft is { writer, cell, kind, addr, body, basis }.
 *
 *   The weft carries the WHOLE event: `kind` is the event type, `body` is the event content untouched,
 *   and `basis` holds what Matrix metadata the fold reads (event id, origin timestamp, sender). So the
 *   mapping is lossless: fromWeft(toWeft(e)) rebuilds the event the fold saw, and the fold's state is
 *   identical. Nothing about the event is inferred.
 *
 *   op   cell        addr
 *   ins  INS·Figure  anchor
 *   def  DEF·Figure  <anchor>#<path>            (kind <ns>.def)
 *   def  DEF·Ground  _schema#<path>             (kind <ns>.schema: a DEF with anchor null)
 *   seg  SEG·Figure  anchor
 *   con  CON·Figure  <source>><relation><target>
 *   syn  SYN·Figure  syn_<eventId>              (the anchor the fold derives)
 *   eva  EVA·Figure  anchor
 *   rec  REC·Figure  scope
 *
 * Cell rank order (INS 7, SEG 10, CON 13, SYN 16, DEF 19, EVA 22, REC 25) matches the dependency order of the
 * operators, so pharos's tie-break by rank agrees with the fold's dependency check. NUL and SIG are ephemeral
 * and never stored, so they never appear. An event with no stored operator (undecryptable, empty, another
 * namespace) is not mapped: toWeft returns { skip: reason }, never a guess.
 */

export const OPS = ['ins', 'def', 'seg', 'con', 'syn', 'eva', 'rec'];
const CELL = { ins: 'INS·Figure', def: 'DEF·Figure', seg: 'SEG·Figure', con: 'CON·Figure', syn: 'SYN·Figure', eva: 'EVA·Figure', rec: 'REC·Figure' };
export const SCHEMA_CELL = 'DEF·Ground';

/** the pharos kinds an eodb namespace needs declared: one per stored operator, plus the schema DEF */
export function kindsFor(ns) {
  return [...OPS.map((op) => ({ name: `${ns}.${op}`, cell: CELL[op] })), { name: `${ns}.schema`, cell: SCHEMA_CELL }];
}

// Events arrive as plain objects or as SDK MatrixEvents: read both the way the fold does.
const field = (e, getter, key) => (typeof e?.[getter] === 'function' ? e[getter]() : e?.[key]);
export const typeOf = (e) => field(e, 'getType', 'type');
export const contentOf = (e) => field(e, 'getContent', 'content');
export const tsOf = (e) => (typeof e?.getTs === 'function' ? e.getTs() : e?.origin_server_ts) || 0;
export const senderOf = (e) => field(e, 'getSender', 'sender');
export const idOf = (e) => (typeof e?.getId === 'function' ? e.getId() : e?.event_id) || null;

/** the stored operator key ('ins'…'rec') of an event type in a namespace, or null */
export function opOf(type, ns) {
  if (typeof type !== 'string' || !type.startsWith(ns + '.')) return null;
  const op = type.slice(ns.length + 1);
  return OPS.includes(op) ? op : null;
}

/** a Matrix user id as a pharos writer name (one writer file per sender): letters, digits, dot, dash, underscore */
export function senderWriter(sender) {
  return String(sender || 'anon').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'anon';
}

/** the order the fold replays events in: timestamp, then event id, then input order. A copy of fold.js `chronological`; the tests hold it to the fold. */
export function chronological(events) {
  return events
    .map((e, i) => [e, i])
    .sort((a, b) => {
      const d = tsOf(a[0]) - tsOf(b[0]);
      if (d !== 0) return d;
      const ia = idOf(a[0]) || '', ib = idOf(b[0]) || '';
      if (ia < ib) return -1;
      if (ia > ib) return 1;
      return a[1] - b[1];
    })
    .map((p) => p[0]);
}

const s = (v) => (v === undefined || v === null || v === '' ? '(none)' : String(v));

function addrOf(op, c, id, ts, sender) {
  switch (op) {
    case 'ins': case 'seg': case 'eva': return s(c.anchor);
    case 'def': return `${c.anchor == null ? '_schema' : c.anchor}#${s(c.path)}`;
    case 'con': return `${s(c.source_anchor)}>${s(c.relation_type)}>${s(c.target_anchor)}`;
    case 'syn': return id ? `syn_${id}` : `syn_${ts}_${sender || 'anon'}`;   // exactly the anchor fold.js derives
    case 'rec': return s(c.scope);
    default: return '(none)';
  }
}

/**
 * An event as a weft, or { skip: reason }.
 * `n` is the event's position in chronological order; it is recorded only when the event has no id, so two identical id-less events stay two wefts.
 */
export function toWeft(event, { ns, room = null, n = null } = {}) {
  const type = typeOf(event), content = contentOf(event);
  if (type === 'm.room.encrypted') return { skip: 'undecryptable' };
  const op = opOf(type, ns);
  if (!op) return { skip: 'not-eodb' };
  if (!content || typeof content !== 'object' || Object.keys(content).length === 0) return { skip: 'empty' };
  const id = idOf(event), ts = tsOf(event), sender = senderOf(event) || null, schema = op === 'def' && content.anchor == null;
  return {
    writer: senderWriter(sender),
    cell: schema ? SCHEMA_CELL : CELL[op],
    kind: schema ? `${ns}.schema` : type,
    addr: addrOf(op, content, id, ts, sender),
    body: content,
    basis: { matrix_event: id, origin_ts: ts, sender, ...(room ? { room } : {}), ...(id ? {} : { n }) },
  };
}

/** a weft (a pharos entry) back as the event the fold reads, or null if it is not an eodb weft of this namespace */
export function fromWeft(entry, { ns }) {
  const b = entry && entry.basis;
  if (!b || !('matrix_event' in b) || !('origin_ts' in b)) return null;
  const type = entry.kind === `${ns}.schema` ? `${ns}.def` : entry.kind;
  if (!opOf(type, ns)) return null;
  return { type, content: entry.body, origin_server_ts: b.origin_ts, sender: b.sender, event_id: b.matrix_event };
}
