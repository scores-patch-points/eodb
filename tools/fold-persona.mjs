// fold-persona.mjs — the instruction corpus is the FULL Claude behavior, NOT pre-built rules.
// It reads the leaked claude-sonnet prompt, splits the behavior sections into directive facts,
// tags each, and emits the whole set as data. The FOLD (select + prosify) happens at query time.
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.argv[2] || '/tmp/scratchpad/spl/Anthropic/claude-sonnet-4.6-no-tools.md';
const OUT = process.argv[3] || path.join(process.cwd(), 'app/persona/rules.json');
const s = fs.readFileSync(SRC, 'utf8');
const section = (name) => { const m = new RegExp('<' + name + '>([\\s\\S]*?)</' + name + '>').exec(s); return m ? m[1].trim() : ''; };

// section -> tags (what kind of question each rule is for)
const SECTIONS = {
  'tone_and_formatting': ['*'],
  'lists_and_bullets': ['*'],
  'responding_to_mistakes_and_criticism': ['mistake', 'wrong', 'sorry', 'apologize'],
  'evenhandedness': ['opinion', 'should', 'recommend', 'best', 'better', 'versus', 'vs', 'argue', 'political'],
};

// anchors: the numbers and distinctive quoted terms that make a rule true of one thing and false of another (prosify.js::anchorsFor)
function anchorsOf(text) {
  const nums = [...new Set((text.match(/\d[\d,.]*/g) || []).map((n) => n.replace(/,/g, '')))];
  const quotes = [...new Set(text.match(/"([^"]+)"/g) || [])].map((q) => q.slice(1, -1));
  return { nums, quotes };
}

const rules = [];
for (const [name, tags] of Object.entries(SECTIONS)) {
  const text = section(name);
  for (const sent of text.split(/(?<=\.)\s+/)) {
    const r = sent.replace(/\s+/g, ' ').trim();
    if (!r || r.length < 12 || r.length > 400) continue;
    if (!/^(Claude|In general|If|When|Keep|It is best|Avoid|Never|Always|There is)/i.test(r)) continue;
    rules.push({ r, tags, ...anchorsOf(r) });
  }
}
fs.writeFileSync(OUT, JSON.stringify(rules, null, 1));
console.log('corpus: ' + rules.length + ' directive facts (full, unfolded) -> ' + OUT);
