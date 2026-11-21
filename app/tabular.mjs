// tabular.mjs: read a file's bytes into columns and rows, infer each column's type, and produce a table spec — the portable
// core of "view a file natively and turn it into a database table". Supports CSV, TSV, JSON (array of objects), and JSONL.
//   parse(bytes, name, type)      -> { columns: [..], rows: [{col: value}] }
//   inferType(values)             -> 'text'|'number'|'currency'|'percent'|'date'|'checkbox'|'email'|'url'
//   tableSpec({ name, columns, rows }) -> { name, fields: [{ n, t }], rows }
const td = new TextDecoder();

/** split text into records with a separator and RFC-4180 quoting (double quotes, embedded separator/newline, "" escape). */
function parseDelimited(text, sep) {
  const records = [];
  let field = '', row = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === sep) { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows(records, row); row = []; field = ''; }
      else if (c !== '\r') field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows(records, row); }
  return records.filter((r) => r.some((x) => x !== ''));
}
function rows(records, row) { records.push(row); }

function dedupeColumns(headers) {
  const seen = new Map(); const out = [];
  for (let i = 0; i < headers.length; i++) {
    let h = (headers[i] == null ? '' : String(headers[i])).trim();
    if (!h) h = `column${i + 1}`;
    const n = seen.get(h) || 0; seen.set(h, n + 1);
    out.push(n ? `${h} (${n + 1})` : h);
  }
  return out;
}

function objectRows(columns, rows) { return rows.map((r) => Object.fromEntries(columns.map((c, i) => [c, r[i] == null ? '' : r[i]]))); }

export function parse(bytes, name = '', type = '') {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const mime = (type || '').toLowerCase();
  const text = td.decode(bytes);

  if (mime.includes('json') || ext === 'json') {
    let v; try { v = JSON.parse(text); } catch { throw new Error('not valid JSON'); }
    const arr = Array.isArray(v) ? v : [v];
    const columns = dedupeColumns([...new Set(arr.flatMap((o) => (o && typeof o === 'object' ? Object.keys(o) : [])))]);
    return { columns, rows: arr.map((o) => (o && typeof o === 'object' ? Object.fromEntries(columns.map((c) => [c, o[c] ?? ''])) : {})) };
  }
  if (ext === 'jsonl' || ext === 'ndjson') {
    const arr = text.split('\n').filter((l) => l.trim()).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const columns = dedupeColumns([...new Set(arr.flatMap((o) => (o && typeof o === 'object' ? Object.keys(o) : [])))]);
    return { columns, rows: arr.map((o) => (o && typeof o === 'object' ? Object.fromEntries(columns.map((c) => [c, o[c] ?? ''])) : {})) };
  }

  const sep = mime.includes('tsv') || ext === 'tsv' || mime.includes('tab-separated') ? '\t' : ',';
  const recs = parseDelimited(text, sep);
  if (!recs.length) return { columns: [], rows: [] };
  const columns = dedupeColumns(recs[0]);
  return { columns, rows: objectRows(columns, recs.slice(1)) };
}

const TYPE_CHECKS = [
  ['checkbox', (v) => /^(true|false|yes|no)$/i.test(v)],
  ['percent', (v) => /^-?\d+(\.\d+)?%$/.test(v)],
  ['currency', (v) => /^-?\$[\d,]+(\.\d+)?$/.test(v)],
  ['number', (v) => /^-?[\d,]+(\.\d+)?$/.test(v)],
  ['date', (v) => /^\d{4}-\d{2}-\d{2}/.test(v)],
  ['email', (v) => /^\S+@\S+\.\S+$/.test(v)],
  ['url', (v) => /^https?:\/\//.test(v)],
];

export function inferType(values) {
  const v = values.map((x) => String(x == null ? '' : x).trim()).filter((x) => x !== '');
  if (!v.length) return 'text';
  for (const [type, test] of TYPE_CHECKS) if (v.every(test)) return type;
  return 'text';
}

/** a table definition from parsed columns + rows: field names with inferred types, and the rows as objects keyed by column name. */
export function tableSpec({ name = 'Imported table', columns = [], rows = [] } = {}) {
  return { name, fields: columns.map((c) => ({ n: c, t: inferType(rows.map((r) => r[c])) })), rows };
}
