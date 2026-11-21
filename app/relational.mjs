// relational.mjs: the log, seen as a conventional relational database. Everything here is DERIVED — a deletable cache folded
// from the EOT (the pharos mark stream). Nothing in this module writes to the log.
//
//   materialize(entries)                 -> { tables: [{ id, ws, name, std, columns, rows }] }   (fold tb+/fld+/rows+/cell= forward)
//   select(db, 'SELECT … FROM …')        -> { columns, rows }                                     (a SQL subset)
//   query(db, {select, from, …})         -> { columns, rows }                                     (structured form)
//   toSQLite(db)                         -> 'CREATE TABLE …; INSERT …;'                            (load into any SQLite/Postgres)
//   toJSON(db)                           -> { tables: { name: { columns, rows } } }                (portable JSON form)
//
// Rows are keyed by FIELD ID (stable, content-addressed). The SQL layer resolves column names through each table's columns,
// so users address columns by their human name and the engine never re-keys the log.

const TYPE_SQLITE = { text: 'TEXT', longtext: 'TEXT', single: 'TEXT', email: 'TEXT', url: 'TEXT', link: 'TEXT', attach: 'TEXT', formula: 'REAL', number: 'REAL', currency: 'REAL', percent: 'REAL', checkbox: 'INTEGER', date: 'TEXT' };

/** fold a log view into current tables. `entries` is the page's LOG shape (op + body). Retractions and edits are applied in order. */
export function materialize(entries) {
  const dead = new Set(entries.filter((e) => e.op === 'retract').map((e) => e.body.of));
  const tables = new Map();
  for (const e of entries) {
    if (e.op === 'retract' || dead.has(e.id)) continue;
    const b = e.body;
    const table = () => tables.get(b.tb);
    switch (e.op) {
      case 'tb+': tables.set(b.id, { id: b.id, ws: b.ws, name: b.name, std: b.std || null, columns: [], rows: [] }); break;
      case 'fld+': { const t = table(); if (t && !t.columns.some((c) => c.id === b.id)) t.columns.push({ id: b.id, name: b.n, type: b.t || 'text', mapping: b.m || null, to: b.to || null }); break; }
      case 'fld=': { const t = table(); const c = t && t.columns.find((x) => x.id === b.id); if (c && b.set) Object.assign(c, b.set); break; }
      case 'row+': { const t = table(); if (t && !t.rows.some((x) => x.id === b.id)) t.rows.push({ id: b.id, v: { ...b.v } }); break; }
      case 'rows+': { const t = table(); if (t) for (const r of b.rows || []) if (!t.rows.some((x) => x.id === r.id)) t.rows.push({ id: r.id, v: { ...r.v }, src: b.src || null }); break; }
      case 'cell=': { const t = table(); const r = t && t.rows.find((x) => x.id === b.rid); if (r) r.v[b.fid] = b.v; break; }
    }
  }
  return { tables: [...tables.values()] };
}

// ---------------------------------------------------------------- SQL ----------------------------------------------------------------
// A joined row is { [tableName]: { v: { fieldId: value } } }. Column references are "col" or "alias.col".

const tokenize = (sql) => {
  const out = []; let i = 0; const s = sql;
  const push = (t, v) => out.push({ t, v });
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "'") { let j = i + 1, str = ''; while (j < s.length && s[j] !== "'") { if (s[j] === '\\' && s[j + 1] === "'") { str += "'"; j += 2; } else str += s[j++]; } push('string', str); i = j + 1; continue; }
    if (c === '"' || c === '`') { let j = i + 1, str = ''; while (j < s.length && s[j] !== c) str += s[j++]; push('word', str); i = j + 1; continue; }
    if (/[\w.]/.test(c)) { let j = i; while (j < s.length && /[\w.]/.test(s[j])) j++; push('word', s.slice(i, j)); i = j; continue; }
    if (c === '-' && /[0-9]/.test(s[i + 1] || '')) { let j = i + 1; while (j < s.length && /[0-9.]/.test(s[j])) j++; push('number', s.slice(i, j)); i = j; continue; }
    if (/[0-9]/.test(c)) { let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++; push('number', s.slice(i, j)); i = j; continue; }
    const two = s.slice(i, i + 2);
    if (['<=', '>=', '<>', '!='].includes(two)) { push('op', two); i += 2; continue; }
    if (',*()=<>'.includes(c)) { push(c, c); i++; continue; }
    i++;
  }
  return out;
};

const AGG = new Set(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX']);
const CLAUSE = new Set(['FROM', 'WHERE', 'GROUP', 'ORDER', 'LIMIT', 'OFFSET', 'JOIN', 'LEFT', 'INNER', 'ON', 'AS', 'AND', 'OR', 'ASC', 'DESC', 'BY', 'IS', 'NOT', 'NULL', 'LIKE', 'IN', 'DISTINCT']);

class Parser {
  constructor(sql) { this.toks = tokenize(sql); this.i = 0; }
  peek() { return this.i < this.toks.length ? this.toks[this.i] : null; }
  next() { return this.toks[this.i++]; }
  isWord(v) { const t = this.peek(); return t && t.t === 'word' && t.v.toUpperCase() === v; }
  eatWord(v) { const t = this.next(); if (!t || t.t !== 'word' || t.v.toUpperCase() !== v) throw new Error(`expected ${v}, got ${t ? t.v : 'end'}`); return t.v; }
  eat(kind) { const t = this.next(); if (!t || t.t !== kind) throw new Error(`expected "${kind}", got ${t ? t.v : 'end'}`); return t; }
  isKeyword() { const t = this.peek(); return t && t.t === 'word' && CLAUSE.has(t.v.toUpperCase()); }

  parse() {
    this.eatWord('SELECT');
    const q = { distinct: this.isWord('DISTINCT') ? (this.next(), true) : false, select: this.selectList(), from: [], joins: [], where: null, groupBy: null, orderBy: [], limit: null, offset: 0 };
    this.eatWord('FROM');
    q.from.push(this.parseTable());
    while (this.isWord('JOIN') || this.isWord('LEFT') || this.isWord('INNER')) {
      let kind = 'inner';
      if (this.isWord('LEFT')) { this.eatWord('LEFT'); kind = 'left'; } else if (this.isWord('INNER')) this.eatWord('INNER');
      this.eatWord('JOIN');
      const item = this.parseTable();
      this.eatWord('ON');
      const on = { a: this.next().v, op: this.next().v, b: this.next().v };
      q.joins.push({ token: item, kind, on });
    }
    if (this.isWord('WHERE')) { this.next(); q.where = this.parseExpr(); }
    if (this.isWord('GROUP')) { this.next(); this.eatWord('BY'); q.groupBy = this.next().v; }
    if (this.isWord('ORDER')) { this.next(); this.eatWord('BY'); for (;;) { const col = this.next().v; const dir = (this.peek() && this.peek().t === 'word' && ['ASC', 'DESC'].includes(this.peek().v.toUpperCase())) ? this.next().v.toUpperCase() : 'ASC'; q.orderBy.push({ col, dir }); if (this.peek() && this.peek().t === ',') this.next(); else break; } }
    if (this.isWord('LIMIT')) { this.next(); q.limit = Number(this.next().v); }
    if (this.isWord('OFFSET')) { this.next(); q.offset = Number(this.next().v); }
    return q;
  }
  parseTable() {
    const name = this.next().v;
    let alias = name;
    if (this.isWord('AS')) { this.next(); alias = this.next().v; }
    else if (this.peek() && this.peek().t === 'word' && !this.isKeyword()) alias = this.next().v;
    return { name, alias };
  }
  selectList() {
    const items = [];
    for (;;) {
      if (this.peek() && this.peek().t === '*') { this.next(); items.push({ star: true }); }
      else {
        const t = this.peek();
        if (t && t.t === 'word' && AGG.has(t.v.toUpperCase())) {
          const fn = this.next().v.toUpperCase();
          this.eat('(');
          let arg;
          if (this.peek() && this.peek().t === '*') { this.next(); arg = '*'; }
          else { arg = this.next().v; if (this.isWord('DISTINCT')) { this.eatWord('DISTINCT'); arg = { distinct: true, col: arg }; } }
          this.eat(')');
          const alias = this.isWord('AS') ? (this.next(), this.next().v) : ((this.peek() && this.peek().t === 'word' && !this.isKeyword()) ? this.next().v : null);
          items.push({ aggregate: fn, arg, alias });
        } else {
          const col = this.next().v;
          const alias = this.isWord('AS') ? (this.next(), this.next().v) : ((this.peek() && this.peek().t === 'word' && !this.isKeyword()) ? this.next().v : null);
          items.push({ column: col, alias });
        }
      }
      if (this.peek() && this.peek().t === ',') { this.next(); continue; }
      break;
    }
    return items;
  }
  parseExpr() { return this.parseOr(); }
  parseOr() { let l = this.parseAnd(); while (this.isWord('OR')) { this.next(); l = { or: [l, this.parseAnd()] }; } return l; }
  parseAnd() { let l = this.parseCond(); while (this.isWord('AND')) { this.next(); l = { and: [l, this.parseCond()] }; } return l; }
  parseCond() {
    if (this.peek() && this.peek().t === '(') { this.next(); const e = this.parseExpr(); this.eat(')'); return e; }
    const lhs = this.next().v;
    const kw = this.peek() ? this.peek().v : '';
    if (kw.toUpperCase() === 'IS') { this.next(); const not = this.isWord('NOT'); if (not) this.next(); this.eatWord('NULL'); return { col: lhs, op: not ? 'IS NOT NULL' : 'IS NULL' }; }
    if (kw.toUpperCase() === 'LIKE') { this.next(); return { col: lhs, op: 'LIKE', val: this.next().v }; }
    if (kw.toUpperCase() === 'NOT' && this.toks[this.i + 1] && this.toks[this.i + 1].v.toUpperCase() === 'LIKE') { this.next(); this.next(); return { col: lhs, op: 'NOT LIKE', val: this.next().v }; }
    if (kw.toUpperCase() === 'IN') { this.next(); this.eat('('); const vals = []; for (;;) { vals.push(this.next().v); if (this.peek() && this.peek().t === ',') this.next(); else break; } this.eat(')'); return { col: lhs, op: 'IN', vals }; }
    const op = this.next().v;
    const rhs = this.next();
    return { col: lhs, op, val: rhs.v, type: rhs.t };
  }
}

const toNumber = (v) => { if (typeof v === 'number') return v; if (typeof v === 'boolean') return v ? 1 : 0; const n = Number(String(v).replace(/[$,%\s]/g, '')); return String(v).trim() !== '' && Number.isFinite(n) ? n : null; };
const cmp = (a, b) => { const na = toNumber(a), nb = toNumber(b); if (na !== null && nb !== null && na !== nb) return na > nb ? 1 : -1; const sa = String(a), sb = String(b); return sa > sb ? 1 : sa < sb ? -1 : 0; };
const eq = (a, b) => cmp(a, b) === 0;
const likeRe = (p) => new RegExp('^' + String(p).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i');

export function query(db, q) {
  const aliases = new Map();
  const byName = (name) => { const t = db.tables.find((x) => x.name === name); if (!t) throw new Error(`no table named "${name}"`); return t; };
  for (const f of q.from) aliases.set(f.alias, byName(f.name));
  for (const j of q.joins || []) aliases.set(j.token.alias, byName(j.token.name));
  // resolve "x" or "alias.col" -> { table, column }
  const resolveCol = (ref) => {
    if (ref.includes('.')) { const [al, c] = ref.split('.'); const t = aliases.get(al); if (!t) throw new Error(`unknown alias "${al}"`); const col = t.columns.find((x) => x.name === c); if (!col) throw new Error(`no column "${c}" in "${t.name}"`); return { table: t, column: col }; }
    for (const t of new Set(aliases.values())) { const col = t.columns.find((x) => x.name === ref); if (col) return { table: t, column: col }; }
    throw new Error(`no column named "${ref}"`);
  };
  // a joined row maps table NAME -> row object ({v}). Access a cell by column ref.
  const cell = (joined, ref) => { const { table, column } = resolveCol(ref); const rr = joined.get(table.name); return rr ? rr.v[column.id] : null; };

  // FROM + JOINs -> joined rows
  let rows = byName(q.from[0].name).rows.map((r) => { const m = new Map(); m.set(q.from[0].name, r); return m; });
  for (const j of q.joins || []) {
    const jt = byName(j.token.name);
    const next = [];
    for (const r of rows) {
      let matched = false;
      for (const rr of jt.rows) { const a = cell(r, j.on.a), b = rr.v[resolveCol(j.on.b).column.id]; if (cmp(a, b) === 0) { const m = new Map(r); m.set(j.token.name, rr); next.push(m); matched = true; } }
      if (!matched && j.kind === 'left') { const m = new Map(r); m.set(j.token.name, null); next.push(m); }
    }
    rows = next;
  }

  // WHERE
  const evCond = (c) => {
    if (!c) return () => true;
    if (c.and) { const fs = c.and.map(evCond); return (r) => fs.every((f) => f(r)); }
    if (c.or) { const fs = c.or.map(evCond); return (r) => fs.some((f) => f(r)); }
    return (r) => {
      const a = cell(r, c.col);
      if (c.op === 'IS NULL') return a === null || a === undefined || a === '';
      if (c.op === 'IS NOT NULL') return !(a === null || a === undefined || a === '');
      if (c.op === 'LIKE') return likeRe(c.val).test(String(a));
      if (c.op === 'NOT LIKE') return !likeRe(c.val).test(String(a));
      if (c.op === 'IN') return c.vals.some((v) => eq(a, v));
      const b = c.type === 'number' ? Number(c.val) : c.val;
      if (c.op === '=') return eq(a, b);
      if (c.op === '!=' || c.op === '<>') return !eq(a, b);
      const d = cmp(a, b);
      if (c.op === '>') return d > 0; if (c.op === '<') return d < 0; if (c.op === '>=') return d >= 0; if (c.op === '<=') return d <= 0;
      return false;
    };
  };
  rows = rows.filter(evCond(q.where));

  // GROUP BY / aggregates
  const hasAgg = (q.select || []).some((s) => s.aggregate);
  if (q.groupBy || hasAgg) {
    let groups;
    if (q.groupBy) {
      const gmap = new Map();
      for (const r of rows) { const k = cell(r, q.groupBy); if (!gmap.has(k)) gmap.set(k, []); gmap.get(k).push(r); }
      groups = [...gmap.entries()];
    } else groups = [[null, rows]];
    const labels = q.select.map((s) => ({ ...s }));
    const columns = labels.map((s) => s.star ? '*' : s.aggregate ? (s.alias || `${s.aggregate}(${typeof s.arg === 'string' ? s.arg : s.arg.col})`) : (s.alias || s.column));
    const outRows = groups.map(([gk, g]) => {
      const o = {};
      for (const s of labels) {
        if (s.star) { const first = g[0]; for (const t of new Set(aliases.values())) if (first && first.get(t.name)) for (const c of t.columns) o[`${t.name}.${c.name}`] = first.get(t.name).v[c.id]; continue; }
        if (s.aggregate) {
          const argCol = typeof s.arg === 'string' ? s.arg : s.arg.col;
          let vals;
          if (s.arg === '*') vals = g.map(() => 1);
          else { const { column } = resolveCol(argCol); vals = g.map((r) => { const rr = r.get(resolveCol(argCol).table.name); return rr ? rr.v[column.id] : null; }); if (s.arg && s.arg.distinct) vals = [...new Set(vals.map(String))].map((x) => (toNumber(x) !== null ? toNumber(x) : x)); }
          const nums = vals.map(toNumber);
          if (s.aggregate === 'COUNT') o[columns[labels.indexOf(s)]] = vals.length;
          else if (s.aggregate === 'SUM') o[columns[labels.indexOf(s)]] = nums.reduce((a, b) => a + (b || 0), 0);
          else if (s.aggregate === 'AVG') o[columns[labels.indexOf(s)]] = nums.length ? nums.reduce((a, b) => a + (b || 0), 0) / nums.length : null;
          else if (s.aggregate === 'MIN') o[columns[labels.indexOf(s)]] = nums.length ? Math.min(...nums.filter((x) => x !== null)) : null;
          else if (s.aggregate === 'MAX') o[columns[labels.indexOf(s)]] = nums.length ? Math.max(...nums.filter((x) => x !== null)) : null;
          continue;
        }
        // plain column alongside a group by
        const ref = s.column; const first = g[0]; const { column } = resolveCol(ref); const t = aliases.get(ref.includes('.') ? ref.split('.')[0] : q.from[0].alias); const rr = first && t ? first.get(t.name) : null; o[columns[labels.indexOf(s)]] = rr ? rr.v[column.id] : null;
      }
      return o;
    });
    return { columns, rows: outRows };
  }

  // plain projection
  if (q.orderBy && q.orderBy.length) {
    const specs = q.orderBy.map((o) => ({ ref: o.col, dir: o.dir }));
    rows.sort((a, b) => { let d = 0; for (const s of specs) { d = cmp(cell(a, s.ref), cell(b, s.ref)) * (s.dir === 'DESC' ? -1 : 1); if (d) break; } return d; });
  }
  let columns, outRows;
  const star = (q.select || []).some((s) => s.star);
  if (star) {
    const all = []; for (const t of new Set(aliases.values())) for (const c of t.columns) all.push({ table: t, column: c });
    columns = all.map(({ column }) => column.name);
    outRows = rows.map((r) => { const o = {}; for (const { table, column } of all) { const rr = r.get(table.name); o[column.name] = rr ? rr.v[column.id] : null; } return o; });
  } else {
    columns = q.select.map((s) => s.alias || s.column);
    outRows = rows.map((r) => { const o = {}; for (const s of q.select) { const ref = s.column; const { column } = resolveCol(ref); const t = aliases.get(ref.includes('.') ? ref.split('.')[0] : q.from[0].alias); const rr = r.get(t.name); o[s.alias || s.column] = rr ? rr.v[column.id] : null; } return o; });
  }
  if (q.distinct) { const seen = new Set(); outRows = outRows.filter((r) => { const k = JSON.stringify(r); if (seen.has(k)) return false; seen.add(k); return true; }); }

  if (q.limit != null || q.offset) { outRows = outRows.slice(q.offset || 0, q.limit != null ? (q.offset || 0) + q.limit : undefined); }
  return { columns, rows: outRows };
}

export function select(db, sql) { return query(db, new Parser(sql).parse()); }

// ----------------------------------------------------------------- export -------------------------------------------------------------
export function toSQLite(db) {
  const lines = [];
  const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
  const lit = (v) => v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'";
  for (const t of db.tables) {
    lines.push(`CREATE TABLE ${q(t.name)} (${t.columns.map((c) => `${q(c.name)} ${TYPE_SQLITE[c.type] || 'TEXT'}`).join(', ')});`);
    for (const r of t.rows) lines.push(`INSERT INTO ${q(t.name)} (${t.columns.map((c) => q(c.name)).join(', ')}) VALUES (${t.columns.map((c) => lit(r.v[c.id])).join(', ')});`);
  }
  return lines.join('\n') + '\n';
}

export function toJSON(db) {
  const out = {};
  for (const t of db.tables) out[t.name] = { columns: t.columns.map((c) => c.name), rows: t.rows.map((r) => Object.fromEntries(t.columns.map((c) => [c.name, r.v[c.id]]))) };
  return { tables: out };
}
