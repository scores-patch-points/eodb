// build-titanic-demo.mjs: turns the holodeck "Titanic, 1912" sample into the one data file the demo workspace loads.
//
//   node tools/build-titanic-demo.mjs <readings.json> <holodeck/samples.json> [app/demo/titanic-1912.json]
//
// <readings.json> is the sample's published readings (holodeck samples.json -> samples["titanic-1912"].readings is its URL).
// Nothing is invented here: every title, figure and link is the sample's own. The one reading that is a table ("Numbers saved")
// becomes rows; the other readings stay full text; the three recordings stay pointers (their bytes are not shipped).
import fs from 'node:fs';
import path from 'node:path';

const [readingsPath, samplesPath, outPath = 'app/demo/titanic-1912.json'] = process.argv.slice(2);
if (!readingsPath || !samplesPath) { console.error('usage: node tools/build-titanic-demo.mjs <readings.json> <holodeck/samples.json> [out]'); process.exit(2); }

const R = JSON.parse(fs.readFileSync(readingsPath, 'utf8'));
const S = JSON.parse(fs.readFileSync(samplesPath, 'utf8')).samples['titanic-1912'];
if (!R.readings || !S) { console.error('not a Titanic sample'); process.exit(2); }

// the table reading is HTML: read its header and body cells (a markup shape, not language)
const cells = (html, tag) => [...html.matchAll(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>', 'g'))].map((m) => m[1].replace(/<[^>]*>/g, '').trim()); // regex-ok: HTML table markup, not language
const rowsOf = (html) => [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => m[1]); // regex-ok: HTML table markup, not language
const num = (s) => (s === '' || s == null || Number.isNaN(Number(s)) ? s : Number(s));

const tableReading = R.readings.find((d) => d.type === 'Data table');
let numbers = null;
if (tableReading) {
  const rows = rowsOf(tableReading.html);
  const cols = cells(rows[0], 'th');
  const body = rows.slice(1).map((r) => cells(r, 'td')).filter((r) => r.length === cols.length);
  numbers = { title: tableReading.title, note: tableReading.note || '', year: tableReading.year || null, cols, rows: body.map((r) => r.map((v, i) => (i >= 2 ? num(v) : v))) };
}

const out = {
  id: 'titanic-1912',
  name: S.name,
  version: R.version || S.version,
  from: { readings: S.readings, samples: 'holodeck/samples.json' },
  readings: R.readings.filter((d) => d !== tableReading).map((d) => ({
    title: d.title, type: d.type, year: d.year || null, authors: d.authors || [], publisher: d.publisher || '', url: d.url || '', note: d.note || '',
    published: d.published || '', html: d.html,
  })),
  numbers,
  media: (S.docs || []).map((d) => ({ kind: d.kind, title: d.title, year: d.year || null, publisher: d.publisher || '', url: d.url || '', note: d.note || '', dur: d.dur || null })),
  try: S.try || [],
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out));
console.log(`${outPath}: ${out.readings.length} readings, ${numbers ? numbers.rows.length : 0} table rows, ${out.media.length} recordings, ${out.try.length} questions, ${fs.statSync(outPath).size} bytes`);
