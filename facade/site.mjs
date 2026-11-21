// site.mjs: the mini-site — pages over the log, rendered as HTML with field-level disclosure.
// The site definition is itself an entry (kind "site", cell DEF·Pattern): { title, pages: [{ path, title, view|kind|query }] }.
// Rendering runs each page's query and discloses every row to the reader (default "*" = the public standpoint), so one log
// yields a different site per reader. Bodies are objects; a scalar body is disclosed whole (no field redaction).
import { libs, openRead } from './store.mjs';
import { ask } from './db.mjs';
import { disclose } from './grant.mjs';

let E = null;
async function load() { if (!E) ({ E } = await libs()); }

export const SITE_CELL = 'DEF·Pattern';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function defineSite(h, { title, pages = [] }) {
  await load();
  let cited = [];
  const prior = h.liveAt('site:main').filter((e) => e.by === h.by && e.kind === 'site');
  if (prior.length) cited = prior.map((e) => e.id);
  return h.weave({ cell: SITE_CELL, kind: 'site', addr: 'site:main', body: { title, pages }, of: cited });
}

export async function readSite(dir) {
  await load();
  const h = openRead(dir);
  try {
    const env = E.run(h, `SEG(sources; kinds: ["site"])`, { params: {} });
    const rows = env.rows.filter((r) => r._retracted === 0).sort((a, b) => (a._pos ?? 0) - (b._pos ?? 0));
    if (!rows.length) return { title: 'EODB site', pages: [] };
    const b = rows[rows.length - 1].body;
    return { title: b.title || 'EODB site', pages: b.pages || [] };
  } finally { E.close(h); }
}

async function pageRows(dir, page) {
  const q = page.query ? page.query
    : page.view ? page.view
    : page.kind ? `SEG(sources; kinds: [${JSON.stringify(page.kind)}])`
    : 'SEG(sources)';
  const { envelope } = await ask(dir, q, { mark: false });
  return envelope.rows;
}

export async function renderPage(dir, page, { reader = '*' } = {}) {
  const rows = await pageRows(dir, page);
  const cards = [];
  for (const r of rows) {
    const addr = r._addr;
    if (!addr) continue;
    const d = await disclose(dir, reader, addr);
    cards.push({ addr, disclosed: d.disclosed, redacted: d.redacted, hidden: d.hidden, unreadSealed: d.unreadSealed });
  }
  return cards;
}

function cardHtml(c) {
  const body = c.disclosed && typeof c.disclosed === 'object'
    ? Object.entries(c.disclosed).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(typeof v === 'string' ? v : JSON.stringify(v))}</dd>`).join('')
    : `<dd>${esc(typeof c.disclosed === 'string' ? c.disclosed : JSON.stringify(c.disclosed))}</dd>`;
  const red = c.redacted.length ? `<span class="muted">(${c.redacted.length} field${c.redacted.length === 1 ? '' : 's'} redacted: ${esc(c.redacted.join(', '))})</span>` : '';
  return `<article><h3>${esc(c.addr)} ${red}</h3><dl>${body}</dl></article>`;
}

export async function renderSiteHtml(dir, { reader = '*' } = {}) {
  const site = await readSite(dir);
  const pages = site.pages.length ? site.pages : [{ path: '/', title: 'Entries' }];
  const sections = [];
  for (const p of pages) {
    const cards = await renderPage(dir, p, { reader });
    sections.push(`<section><h2>${esc(p.title || p.path)}</h2>${cards.length ? cards.map(cardHtml).join('') : '<p class="muted">(no rows)</p>'}</section>`);
  }
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(site.title)}</title><style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;font:15px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;background:#0f172a;color:#e2e8f0}
header{padding:20px 24px;border-bottom:1px solid #1e293b}header h1{margin:0;font-size:20px}header h1 span{color:#fbbf24}.muted{color:#64748b}
main{padding:20px 24px;max-width:900px}section{margin-bottom:28px;border:1px solid #1e293b;border-radius:8px;overflow:hidden}
section>h2{margin:0;padding:10px 14px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;background:#1e293b;color:#94a3b8}
section article{padding:12px 16px;border-bottom:1px solid #1e293b}section article:last-child{border-bottom:0}
article h3{margin:0 0 8px;font-size:15px}dl{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;margin:0}
dt{color:#94a3b8}dd{margin:0;word-break:break-word}</style></head><body>
<header><h1>${esc(site.title)} <span>·</span> <span class="muted">as ${esc(reader)}</span></h1>
<div class="muted">the log is the database — this page is a disclosed view. append <code>?as=&lt;writer&gt;</code> to read as a different reader.</div></header>
<main>${sections.join('')}</main></body></html>`;
}
