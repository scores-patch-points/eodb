// project.mjs: convert the log into any database/file format — the Proteus shape. A projector is a declarative recipe: it folds
// the materialized tables into bytes of one target format. The projection is recorded as a `vfile` entry (project + sequence +
// projector + recipe + size + sha256 + of), so the converted file is content-addressed and audited, and the recipe (not the bytes)
// is what stays in the ledger. Add a projector to PROJECTORS to support a new format — "convert to any" is one entry.
import { materialize } from './relational.mjs';

// field type -> column type, per SQL dialect
const TYPES = {
  sqlite:   { text: 'TEXT', longtext: 'TEXT', single: 'TEXT', email: 'TEXT', url: 'TEXT', link: 'TEXT', attach: 'TEXT', formula: 'REAL', number: 'REAL', currency: 'REAL', percent: 'REAL', checkbox: 'INTEGER', date: 'TEXT' },
  postgres: { text: 'TEXT', longtext: 'TEXT', single: 'TEXT', email: 'TEXT', url: 'TEXT', link: 'TEXT', attach: 'BYTEA', formula: 'DOUBLE PRECISION', number: 'DOUBLE PRECISION', currency: 'NUMERIC', percent: 'NUMERIC', checkbox: 'BOOLEAN', date: 'DATE' },
  mysql:    { text: 'TEXT', longtext: 'LONGTEXT', single: 'VARCHAR(255)', email: 'VARCHAR(255)', url: 'VARCHAR(2048)', link: 'VARCHAR(255)', attach: 'LONGBLOB', formula: 'DOUBLE', number: 'DOUBLE', currency: 'DECIMAL(20,2)', percent: 'DECIMAL(10,4)', checkbox: 'TINYINT(1)', date: 'DATE' },
};

const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
const lit = (v) => v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'";

function sqlDump(tables, dialect) {
  const T = TYPES[dialect];
  const lines = [];
  for (const t of tables) {
    lines.push(`CREATE TABLE ${q(t.name)} (${t.columns.map((c) => `${q(c.name)} ${T[c.type] || 'TEXT'}`).join(', ')});`);
    const cols = t.columns.map((c) => q(c.name)).join(', ');
    for (const r of t.rows) lines.push(`INSERT INTO ${q(t.name)} (${cols}) VALUES (${t.columns.map((c) => lit(r.v[c.id])).join(', ')});`);
  }
  return lines.join('\n') + '\n';
}

function csv(t) {
  const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const out = [t.columns.map((c) => esc(c.name)).join(',')];
  for (const r of t.rows) out.push(t.columns.map((c) => esc(r.v[c.id])).join(','));
  return out.join('\n') + '\n';
}

const row = (t, r) => Object.fromEntries(t.columns.map((c) => [c.name, r.v[c.id]]));
const jsonl = (t) => t.rows.map((r) => JSON.stringify(row(t, r))).join('\n') + (t.rows.length ? '\n' : '');
const json = (tables) => JSON.stringify({ tables: Object.fromEntries(tables.map((t) => [t.name, { columns: t.columns.map((c) => c.name), rows: t.rows.map((r) => row(t, r)) }])) }, null, 2) + '\n';
const md = (tables, wsName) => {
  let out = `# ${wsName}\n\n`;
  for (const t of tables) {
    out += `## ${t.name}\n\n`;
    if (t.columns.length) {
      out += '| ' + t.columns.map((c) => c.name).join(' | ') + ' |\n| ' + t.columns.map(() => '---').join(' | ') + ' |\n';
      for (const r of t.rows) out += '| ' + t.columns.map((c) => String(r.v[c.id] ?? '').replace(/\|/g, '\\|')).join(' | ') + ' |\n';
    }
    out += '\n';
  }
  return out;
};

/** the projector registry. `table` = can project a single table; otherwise projects the whole database (optionally one workspace). */
export const PROJECTORS = {
  csv:      { label: 'CSV', ext: 'csv', mime: 'text/csv', table: true },
  json:     { label: 'JSON', ext: 'json', mime: 'application/json', table: false },
  jsonl:    { label: 'JSON Lines (NDJSON)', ext: 'jsonl', mime: 'application/x-ndjson', table: true },
  sqlite:   { label: 'SQLite (loadable SQL)', ext: 'sql', mime: 'application/sql', table: false },
  postgres: { label: 'PostgreSQL (DDL + INSERT)', ext: 'sql', mime: 'application/sql', table: false },
  mysql:    { label: 'MySQL (DDL + INSERT)', ext: 'sql', mime: 'application/sql', table: false },
  markdown: { label: 'Markdown', ext: 'md', mime: 'text/markdown', table: false },
};

/** render tables to the target format. Returns { name, mime, bytes, text, vfileId, sha256 }. */
export function convert(space, { format = 'sqlite', table, ws } = {}) {
  const P = PROJECTORS[format];
  if (!P) throw new Error(`unknown format "${format}"`);
  const db = materialize(space.view());
  let tables = db.tables;
  if (table) { const t = db.tables.find((x) => x.id === table || x.name === table); if (!t) throw new Error(`no table "${table}"`); tables = [t]; }
  else if (ws) tables = tables.filter((t) => t.ws === ws);
  if (!tables.length) throw new Error('nothing to convert');

  let text;
  if (format === 'csv') text = tables.map(csv).join('\n');
  else if (format === 'json') text = json(tables);
  else if (format === 'jsonl') text = tables.map(jsonl).join('');
  else if (TYPES[format]) text = sqlDump(tables, format);
  else if (format === 'markdown') text = md(tables, space.name);
  else throw new Error(`no renderer for "${format}"`);

  const bytes = new TextEncoder().encode(text);
  const sha256 = space.sha(bytes);
  const ofIds = space.view().filter((e) => e.op === 'tb+' && tables.some((t) => t.id === e.body.id)).map((e) => e.id);
  const sequence = space.view().filter((e) => e.op === 'vfile+').length + 1;
  const name = (table ? tables[0].name : ws || 'database').replace(/[^\w.-]+/g, '-') + '.' + P.ext;
  const vf = space.append('vfile+', { project: space.name, sequence, projector: format, recipe: { format, table: table || null, ws: ws || null }, size: bytes.length, sha256, name }, ofIds);
  return { name, mime: P.mime, bytes, text, vfileId: vf.id, sha256 };
}
