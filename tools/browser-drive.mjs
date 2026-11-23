// browser-drive.mjs — drive the running EODB app in a real Chrome (via Playwright) and exercise an automation end-to-end.
// This is the dev tool for "prove it in the browser": it opens the app, skips the passphrase on a fresh space, builds an
// automation on the Automations canvas (the same AUTO state the canvas edits), clicks Run, and reports the results + audit,
// with a screenshot at each step.
//
//   node tools/browser-drive.mjs [url] [--headed] [--shot-dir DIR] [--auto http|rss]
//
// Requires `npm install playwright-core` and a system Chrome at the path below. Defaults: http://127.0.0.1:8852, headless,
// --auto http (jsonplaceholder -> table). NOTE: in-browser cross-origin fetch is CORS-gated, so the `rss` recipe (hnrss.org)
// fails in the browser unless the source sends CORS headers — run it against a CORS-friendly feed or behind a proxy. Webhooks
// are driven by the server intake (/webhook/:path), not the canvas Run button.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : null; };
const has = (n) => argv.includes('--' + n);
const url = argv.find((a) => !a.startsWith('--')) || 'http://127.0.0.1:8852';
const headless = !has('headed');
const shotDir = flag('shot-dir') || '/tmp/eodb-shots';
const auto = flag('auto') || 'http';

const RECIPES = {
  http: {
    nodes: [
      { id: 'h1', type: 'http', x: 60, y: 80, fields: { url: 'https://jsonplaceholder.typicode.com/users', method: 'GET' } },
      { id: 't2', type: 'transform', x: 300, y: 80, fields: { op: 'pick', arg: 'name,email' } },
      { id: 's3', type: 'store', x: 540, y: 80, fields: { name: 'Users (browser)', ws: 'w1' } },
    ],
    edges: [
      { from: 'h1', fromPort: 'json', to: 't2', toPort: 'data' },
      { from: 't2', fromPort: 'rows', to: 's3', toPort: 'rows' },
    ],
    table: 'Users (browser)', query: 'SELECT name,email FROM "Users (browser)" LIMIT 4',
  },
  rss: {
    nodes: [
      { id: 'r1', type: 'rss', x: 60, y: 80, fields: { url: 'https://hnrss.org/frontpage' } },
      { id: 't2', type: 'transform', x: 300, y: 80, fields: { op: 'pick', arg: 'title,link' } },
      { id: 's3', type: 'store', x: 540, y: 80, fields: { name: 'HN (browser)', ws: 'w1' } },
    ],
    edges: [
      { from: 'r1', fromPort: 'items', to: 't2', toPort: 'data' },
      { from: 't2', fromPort: 'rows', to: 's3', toPort: 'rows' },
    ],
    table: 'HN (browser)', query: 'SELECT title FROM "HN (browser)" LIMIT 4',
  },
};

const recipe = RECIPES[auto];
if (!recipe) { console.error('unknown --auto; use http|rss'); process.exit(2); }

fs.mkdirSync(shotDir, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const shot = (n) => page.screenshot({ path: path.join(shotDir, n + '.png') });

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
try { await page.waitForSelector('#bskip', { timeout: 12000 }); await page.click('#bskip'); } catch { /* already unlocked */ }
await page.waitForFunction(() => window.ENGINE && window.Automation && document.querySelector('.brand'), null, { timeout: 30000 });
await page.waitForTimeout(1000);
await shot('01-home');

await page.click('aside .it:has-text("Automations")');
await page.waitForFunction(() => document.querySelector('#auto-canv'), null, { timeout: 10000 });

await page.evaluate(({ nodes, edges }) => { AUTO.nodes = nodes; AUTO.edges = edges; drawAuto(); }, recipe);
await page.waitForTimeout(300);
await shot('02-automation-built');

await page.click('#auto-pal button:has-text("Run")');
await page.waitForTimeout(6000);
await shot('03-ran');

const out = await page.evaluate(({ table, query }) => ({
  nodeOutputs: [...document.querySelectorAll('.au-node .ov')].map((e) => e.textContent.trim().slice(0, 120)),
  tables: ENGINE.materialize().tables.map((t) => `${t.name}:${t.rows.length}`),
  rows: (() => { try { return ENGINE.sql(query).rows; } catch (e) { return ['ERR ' + e.message]; } })(),
  audit: { auto: ENGINE.view().filter((e) => e.op === 'auto+').length, run: ENGINE.view().filter((e) => e.op === 'auto-run+').length, node: ENGINE.view().filter((e) => e.op === 'auto-node+').length },
}), recipe);

console.log(JSON.stringify(out, null, 2));
await browser.close();
console.log('screenshots:', fs.readdirSync(shotDir).join(', '));
