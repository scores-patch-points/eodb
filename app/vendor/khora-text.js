// native/adapters/text/priors.js
var NEGATION_WORDS = Object.freeze(/* @__PURE__ */ new Set([
  "not",
  "never",
  "hardly",
  "scarcely",
  "neither",
  "nor",
  "didn't",
  "don't",
  "doesn't",
  "wouldn't",
  "couldn't",
  "shouldn't",
  "won't",
  "can't",
  "cannot",
  "isn't",
  "aren't",
  "wasn't",
  "weren't",
  "haven't",
  "hasn't",
  "hadn't",
  "mustn't",
  "needn't",
  "shan't",
  "daren't",
  "mightn't",
  "oughtn't"
]));
var NEGATION_WORDS_META = Object.freeze({ giver: "lang/en", scope: null });
var NEGATION_CORRELATIVES = Object.freeze(/* @__PURE__ */ new Set(["only", "just"]));
var NEGATION_CORRELATIVES_META = Object.freeze({ giver: "lang/en", scope: null });
var NEVER_A_NAME = Object.freeze(/* @__PURE__ */ new Set(["i", "i'm", "i'll", "i'd", "i've"]));
var NEVER_A_NAME_META = Object.freeze({ giver: "lang/en", scope: null });
var FIRST_PERSON_META = Object.freeze({ giver: "lang/en", scope: null });
var SUBJECT_PRONOUNS = Object.freeze(/* @__PURE__ */ new Set([
  "i",
  "you",
  "he",
  "she",
  "it",
  "we",
  "they",
  "this",
  "that",
  "these",
  "those",
  "who",
  "what",
  "which",
  "whoever",
  "whatever"
]));
var SUBJECT_PRONOUNS_META = Object.freeze({ giver: "lang/en", scope: null });
var PREDETERMINERS = Object.freeze(/* @__PURE__ */ new Set(["all", "both", "half", "such", "quite", "rather"]));
var PREDETERMINERS_META = Object.freeze({ giver: "lang/en", scope: null });
var THIRD_PERSON_SINGULAR = Object.freeze({
  he: "m",
  him: "m",
  his: "m",
  himself: "m",
  she: "f",
  her: "f",
  hers: "f",
  herself: "f"
});
var THIRD_PERSON_SINGULAR_META = Object.freeze({ giver: "lang/en", scope: null });
var INDEFINITE_DETERMINERS = Object.freeze(/* @__PURE__ */ new Set([
  "a",
  "an",
  "some",
  "any",
  "another"
]));
var INDEFINITE_DETERMINERS_META = Object.freeze({ giver: "lang/en", scope: null });
var DEFINITE_DETERMINERS = Object.freeze(/* @__PURE__ */ new Set([
  "the",
  "this",
  "that",
  "these",
  "those"
]));
var DEFINITE_DETERMINERS_META = Object.freeze({ giver: "lang/en", scope: null });
var INTERROGATIVE_PRONOUNS = Object.freeze(/* @__PURE__ */ new Map([
  ["who", "person"],
  ["whom", "person"],
  ["whose", "person"],
  ["what", "thing"],
  ["which", "thing"],
  ["where", "place"],
  ["when", "time"]
]));
var INTERROGATIVE_PRONOUNS_META = Object.freeze({ giver: "lang/en", scope: null });
var MANNER_REASON_PRONOUNS = Object.freeze(/* @__PURE__ */ new Set(["how", "why"]));
var MANNER_REASON_PRONOUNS_META = Object.freeze({ giver: "lang/en", scope: null });
var ANAPHORIC_PRONOUNS = Object.freeze(/* @__PURE__ */ new Set([
  "it",
  "it's",
  "this",
  "this's",
  "that",
  "that's",
  "these",
  "those"
]));
var ANAPHORIC_PRONOUNS_META = Object.freeze({ giver: "lang/en", scope: null });
var POSSESSIVE_DETERMINERS = Object.freeze(/* @__PURE__ */ new Set([
  "my",
  "your",
  "his",
  "her",
  "its",
  "our",
  "their"
]));
var POSSESSIVE_DETERMINERS_META = Object.freeze({ giver: "lang/en", scope: null });
var NP_COORDINATORS = Object.freeze(/* @__PURE__ */ new Set(["and", "or"]));
var NP_COORDINATORS_META = Object.freeze({ giver: "lang/en", scope: null });
var CLAUSE_COORDINATORS = Object.freeze(/* @__PURE__ */ new Set(["and", "but", "or", "nor", "so", "yet", "for"]));
var CLAUSE_COORDINATORS_META = Object.freeze({ giver: "lang/en", scope: null });
var AUXILIARY_VERBS = Object.freeze(/* @__PURE__ */ new Set([
  "am",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "shall",
  "should",
  "would",
  "could",
  "can",
  "may",
  "might",
  "must"
]));
var AUXILIARY_VERBS_META = Object.freeze({ giver: "lang/en", scope: null });
var INFLECTIONAL_SUFFIXES = Object.freeze(/* @__PURE__ */ new Set([
  "s",
  "es",
  "ed",
  "ing",
  "er",
  "est",
  "'s"
]));
var INFLECTIONAL_SUFFIXES_META = Object.freeze({ giver: "lang/en", scope: null });
var SENTENCE_TERMINATORS = Object.freeze(/* @__PURE__ */ new Set([
  ".",
  "!",
  "?",
  "\u2026",
  // Other scripts' own terminators, declared by the script they belong to
  // (Unicode block names, not a language list): CJK ideographic and
  // halfwidth full stop / question / exclamation, Arabic question mark and
  // full stop (Urdu), Devanagari danda / double danda, Armenian full stop,
  // Ethiopic full stop.
  "\u3002",
  "\uFF01",
  "\uFF1F",
  "\uFF61",
  "\u061F",
  "\u06D4",
  "\u0964",
  "\u0965",
  "\u0589",
  "\u1362"
]));
var SENTENCE_TERMINATORS_META = Object.freeze({ giver: "script/latn + script/hani,jpan,arab,deva,armn,ethi (Unicode terminator characters)", scope: null });
var ASCII_DANDA_STEMS = Object.freeze(/* @__PURE__ */ new Set(["san"]));
var ASCII_DANDA_META = Object.freeze({ giver: "GRETIL plain-text transformations (header: 'plain text transformation'; | and || are the danda and double danda), observed in sa_viSNuzarman-paJcatantra.txt", scope: "san, Latin script" });
var UNSPACED_TERMINATORS = Object.freeze(/* @__PURE__ */ new Set(["\u3002", "\uFF01", "\uFF1F", "\uFF61"]));
var CLOSING_QUOTES = Object.freeze(/* @__PURE__ */ new Set(['"', "'", "\u201D", "\u2019", "\u300D", "\u300F", "\u201D", "\uFF09", "\xBB"]));
var CLOSING_QUOTES_META = Object.freeze({ giver: "script/latn", scope: null });
var HONORIFIC_TITLES = Object.freeze(/* @__PURE__ */ new Set([
  "mr",
  "mrs",
  "miss",
  "ms",
  "mx",
  "dr",
  "prof",
  "professor",
  "rev",
  "reverend",
  "fr",
  "sir",
  "madam",
  "madame",
  "mademoiselle",
  "monsieur",
  "herr",
  "frau",
  "fraulein",
  "signor",
  "signora",
  "signorina",
  "lord",
  "lady",
  "dame",
  "count",
  "countess",
  "duke",
  "duchess",
  "baron",
  "baroness",
  "viscount",
  "viscountess",
  "earl",
  "marquis",
  "marquess",
  "voivode",
  "king",
  "queen",
  "prince",
  "princess",
  "captain",
  "capt",
  "colonel",
  "col",
  "major",
  "general",
  "gen",
  "admiral",
  "lieutenant",
  "lt",
  "sergeant",
  "sgt"
]));
var HONORIFIC_TITLES_META = Object.freeze({ giver: "lang/en", scope: null });
var STRUCTURAL_LABELS = Object.freeze(/* @__PURE__ */ new Set(["chapter", "part", "book", "volume"]));
var STRUCTURAL_LABELS_META = Object.freeze({ giver: "lang/en", scope: null });
var CLAUSE_OPENERS = Object.freeze(/* @__PURE__ */ new Set([
  "that",
  "which",
  "who",
  "whom",
  "whose",
  "because",
  "although",
  "though",
  "while",
  "when",
  "whether",
  "unless",
  "since",
  "before",
  "after",
  "until",
  "if",
  "to",
  // "how" — the fronted interrogative/adverbial ("How she longed to get
  // out" — the clause opens with How; the subject is she). Added 2026-09-13
  // after the golden measured the subject swallowing the opener ("How she"
  // as end1). Same class as when/while/whether already in this set.
  "how"
]));
var CLAUSE_OPENERS_META = Object.freeze({ giver: "lang/en", scope: null });
var COPULA_PARADIGM = Object.freeze({
  be: "be",
  am: "be",
  is: "be",
  are: "be",
  was: "be",
  were: "be",
  been: "be",
  being: "be",
  "'s": "be",
  "'re": "be",
  "'m": "be"
});
var COPULA_PARADIGM_META = Object.freeze({ giver: "lang/en", scope: "the copula's paradigm alone; tense is not carried" });
var SUBORDINATING_CONJUNCTIONS = Object.freeze(/* @__PURE__ */ new Set([
  "because",
  "although",
  "while",
  "since",
  "if",
  "after",
  "before",
  "unless",
  "until",
  "though"
]));
var SUBORDINATING_CONJUNCTIONS_META = Object.freeze({ giver: "lang/en", scope: "opens a subordinate clause; says nothing about where it ends" });
var NEUTER_THIRD_PERSON = Object.freeze(/* @__PURE__ */ new Set(["it", "its", "itself"]));
var NEUTER_THIRD_PERSON_META = Object.freeze({ giver: "lang/en", scope: null });

// native/adapters/text/spans.js
var GUTENBERG_START = /^[^\S\n]*\*{3}[^\S\n]*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK\b[^\n]*$/im;
var GUTENBERG_END = /^[^\S\n]*\*{3}[^\S\n]*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK\b[^\n]*$/im;
var FRONT_FIELD = /^(?:Title|Author|Editor|Translator|Illustrator|Release date|Language|Original publication|Credits)\s*:/i;
var PG_CREDIT_URL = /\b(?:pgdp\.net|gutenberg\.org|www\.gutenberg)/i;
var ORNAMENT_RULE = /^[\s*]+$/;
var BOX_BLOCK = /^[\s+|=_-]*$/;
var BOX_ROW = /^\s*\|.*\|\s*$/;
var isContainerParagraph = (p) => {
  const trimmed = p.trim();
  if (!trimmed) return true;
  if (ORNAMENT_RULE.test(trimmed)) return true;
  if (PG_CREDIT_URL.test(trimmed)) return true;
  const lines = trimmed.split("\n");
  if (lines.every((l) => BOX_BLOCK.test(l) || BOX_ROW.test(l))) return true;
  return false;
};
var CELL = Object.freeze({ op: "SEG", grain: "Ground" });
var looksLikeMaterial = (text) => {
  const t = String(text ?? "").replace(/^﻿/, "").trimStart();
  if (t.length < 200) return false;
  if (/^<(?:!doctype|html|head|body|div|meta|title|\?xml)\b/i.test(t)) return false;
  return true;
};
var stripContainer = (text) => {
  let s = String(text ?? "");
  let offset = 0;
  const front = [];
  const start = s.match(GUTENBERG_START);
  if (start) {
    for (const line of s.slice(0, start.index).split("\n")) {
      const trimmed = line.trim();
      if (FRONT_FIELD.test(trimmed)) {
        const at = trimmed.indexOf(":");
        front.push(Object.freeze({ field: trimmed.slice(0, at).trim(), value: trimmed.slice(at + 1).trim() }));
      }
    }
    offset = start.index + start[0].length;
    s = s.slice(offset);
    for (; ; ) {
      const m = s.match(/^(\s*)([\s\S]*?)(\n\s*\n|$)/);
      if (!m) break;
      const paragraph = m[2];
      if (!paragraph.trim()) break;
      if (!isContainerParagraph(paragraph)) break;
      const consumed = m[0].length;
      if (consumed === 0) break;
      offset += consumed;
      s = s.slice(consumed);
    }
  }
  const end = s.match(GUTENBERG_END);
  if (end) s = s.slice(0, end.index);
  return { text: s, offset, front: Object.freeze(front), looks_like_material: looksLikeMaterial(s) };
};
var PARAGRAPH_BREAK = /\n\s*\n+/g;
var TOKEN_BEFORE_DOT = /(\p{L}[\p{L}\p{M}]*)\./gu;
var TOKEN_RE = /\p{L}[\p{L}\p{M}]*/gu;
var deriveAbbreviations = (text) => {
  const withDot = /* @__PURE__ */ new Map();
  const total2 = /* @__PURE__ */ new Map();
  const lengths = [];
  for (const m of text.matchAll(TOKEN_BEFORE_DOT)) withDot.set(m[1], (withDot.get(m[1]) || 0) + 1);
  for (const m of text.matchAll(TOKEN_RE)) {
    total2.set(m[0], (total2.get(m[0]) || 0) + 1);
    lengths.push(m[0].length);
  }
  if (lengths.length === 0) return /* @__PURE__ */ new Set();
  lengths.sort((a, b) => a - b);
  const bar = lengths[Math.floor(lengths.length * 0.1)];
  const out = /* @__PURE__ */ new Set();
  for (const [token, n] of withDot) if (n >= 2 && total2.get(token) === n && token.length <= bar) out.add(token);
  return out;
};
var tokenEndingAt = (s, i) => {
  let j = i;
  while (j > 0 && /[\p{L}\p{M}]/u.test(s[j - 1])) j--;
  return s.slice(j, i);
};
var pushSentence = (s, start, end, out) => {
  const raw = s.slice(start, end);
  const trimmed = raw.trim();
  if (!trimmed) return;
  const leading = raw.length - raw.trimStart().length;
  out.push({ text: trimmed, offset: start + leading, order: out.length });
};
var UPPERCASE = /\p{Lu}/u;
var LETTER_CHAR = /\p{L}/u;
var isNameInitial = (s, i, rangeStart, rangeEnd) => {
  const x = i - 1;
  if (x < rangeStart || !UPPERCASE.test(s[x])) return false;
  if (x > rangeStart && LETTER_CHAR.test(s[x - 1])) return false;
  let n = i + 1;
  while (n < rangeEnd && (s[n] === " " || s[n] === "	")) n += 1;
  if (n === i + 1 || n >= rangeEnd || !UPPERCASE.test(s[n])) return false;
  const beforeInitial = s[n + 1] === "." && !(n + 2 < rangeEnd && LETTER_CHAR.test(s[n + 2]));
  let p = x - 1;
  while (p >= rangeStart && (s[p] === " " || s[p] === "	")) p -= 1;
  if (p === x - 1) return beforeInitial;
  let w = p;
  while (w >= rangeStart && LETTER_CHAR.test(s[w])) w -= 1;
  const previous = s.slice(w + 1, p + 1);
  const afterCapitalised = previous.length >= 2 && UPPERCASE.test(previous[0]);
  const afterInitial = p > rangeStart && s[p] === "." && UPPERCASE.test(s[p - 1]) && !(p - 2 >= rangeStart && LETTER_CHAR.test(s[p - 2]));
  return afterCapitalised || afterInitial || beforeInitial;
};
var splitSentencesInRange = (s, rangeStart, rangeEnd, out, abbreviations, extra = null) => {
  let start = rangeStart;
  for (let i = rangeStart; i < rangeEnd; i++) {
    if (!SENTENCE_TERMINATORS.has(s[i]) && !(extra && extra.has(s[i]))) continue;
    let end = i + 1;
    while (end < rangeEnd && CLOSING_QUOTES.has(s[end])) end += 1;
    if (end < rangeEnd && !/\s/.test(s[end]) && !UNSPACED_TERMINATORS.has(s[i])) continue;
    if (s[i] === "." && abbreviations.has(tokenEndingAt(s, i))) continue;
    if (s[i] === "." && end === i + 1 && isNameInitial(s, i, rangeStart, rangeEnd)) continue;
    pushSentence(s, start, end, out);
    start = end;
  }
  pushSentence(s, start, rangeEnd, out);
};
var splitSentences = (text, { abbreviations = null, extraTerminators = null } = {}) => {
  const s = String(text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const abbrev = abbreviations ? new Set(abbreviations) : deriveAbbreviations(s);
  const paragraphs = [];
  let paraStart = 0;
  let pm;
  PARAGRAPH_BREAK.lastIndex = 0;
  while (pm = PARAGRAPH_BREAK.exec(s)) {
    paragraphs.push({ start: paraStart, end: pm.index });
    paraStart = pm.index + pm[0].length;
  }
  paragraphs.push({ start: paraStart, end: s.length });
  const sentences = [];
  for (const para of paragraphs) splitSentencesInRange(s, para.start, para.end, sentences, abbrev, extraTerminators);
  sentences.forEach((sent, i) => {
    sent.order = i;
  });
  return sentences;
};

// native/adapters/text/sha256hex.js
var K = new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var H0 = new Uint32Array([
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
]);
var rotr = (x, n) => x >>> n | x << 32 - n;
function sha256hex(text) {
  const bytes = new TextEncoder().encode(String(text ?? ""));
  const bitLenHi = Math.floor(bytes.length * 8 / 4294967296);
  const bitLenLo = bytes.length * 8 >>> 0;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 128;
  const dv = new DataView(padded.buffer);
  dv.setUint32(paddedLen - 8, bitLenHi);
  dv.setUint32(paddedLen - 4, bitLenLo);
  const h = Uint32Array.from(H0);
  const w = new Uint32Array(64);
  for (let i = 0; i < paddedLen; i += 64) {
    for (let j = 0; j < 16; j++) w[j] = dv.getUint32(i + j * 4);
    for (let j = 16; j < 64; j++) {
      const s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ w[j - 15] >>> 3;
      const s1 = rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ w[j - 2] >>> 10;
      w[j] = w[j - 16] + s0 + w[j - 7] + s1 >>> 0;
    }
    let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
    for (let j = 0; j < 64; j++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = e & f ^ ~e & g;
      const t1 = hh + S1 + ch + K[j] + w[j] >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = a & b ^ a & c ^ b & c;
      const t2 = S0 + maj >>> 0;
      hh = g;
      g = f;
      f = e;
      e = d + t1 >>> 0;
      d = c;
      c = b;
      b = a;
      a = t1 + t2 >>> 0;
    }
    h[0] = h[0] + a >>> 0;
    h[1] = h[1] + b >>> 0;
    h[2] = h[2] + c >>> 0;
    h[3] = h[3] + d >>> 0;
    h[4] = h[4] + e >>> 0;
    h[5] = h[5] + f >>> 0;
    h[6] = h[6] + g >>> 0;
    h[7] = h[7] + hh >>> 0;
  }
  let out = "";
  for (let i = 0; i < 8; i++) out += h[i].toString(16).padStart(8, "0");
  return out.slice(0, 32);
}

// native/adapters/text/active-ear.js
var current = null;
function hear(text) {
  const t = String(text ?? "");
  if (!current) return t;
  let out = t.toLowerCase();
  if (current.segment) out = current.segment(out);
  if (current.peel) out = current.peel(out);
  return out;
}

// native/adapters/text/material.js
var WORD_RE = /[\p{L}\p{N}']+/gu;
var tokenize = (text) => hear(text.toLowerCase()).match(WORD_RE) || [];
var DEFAULT_RELEVANCE_THRESHOLD = 6e-3;
var functionWordSet = (table, { threshold = DEFAULT_RELEVANCE_THRESHOLD } = {}) => {
  const set = /* @__PURE__ */ new Set();
  for (const [word, count] of table.freq) {
    if (count / table.total >= threshold) set.add(word);
  }
  return set;
};
var _utf8 = new TextEncoder();

// native/adapters/text/surfaces.js
var DIA_RE = /[áàâäéèêëíìîïóòôöúùûü]/g;
var DIA_TO = { \u00E1: "a", \u00E0: "a", \u00E2: "a", \u00E4: "a", \u00E9: "e", \u00E8: "e", \u00EA: "e", \u00EB: "e", \u00ED: "i", \u00EC: "i", \u00EE: "i", \u00EF: "i", \u00F3: "o", \u00F2: "o", \u00F4: "o", \u00F6: "o", \u00FA: "u", \u00F9: "u", \u00FB: "u", \u00FC: "u" };
var DENSE_TOKEN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
var individuatesName = (t) => t.length > (DENSE_TOKEN.test(t) ? 1 : 2);
var diaNorm = (t) => String(t ?? "").toLowerCase().trim().replace(DIA_RE, (c) => DIA_TO[c]);
var CELL2 = Object.freeze({ op: "SIG", grain: "Ground" });
var rawTokensOf = (id) => diaNorm(id).split(/\s+/).filter(individuatesName);
var tokensOf = (id, fold) => rawTokensOf(id).map(fold ?? ((t) => t));
var tokenEq = (x, y, sameStem) => x === y || !!sameStem && (sameStem(x, y) || sameStem(y, x));
var tokenSetContains = (from, into, sameStem) => from.every((t) => into.some((u) => tokenEq(t, u, sameStem)));
var isContiguousRun = (short, long, sameStem) => {
  if (short.length > long.length) return false;
  for (let start = 0; start <= long.length - short.length; start += 1) {
    if (short.every((t, i) => tokenEq(t, long[start + i], sameStem))) return true;
  }
  return false;
};
var namesCorefer = (a, b, opts) => {
  const { sameStem = null, fold = null, witness = null, commonNoun = null, contiguitySensitive = true } = typeof opts === "function" ? { fold: opts } : opts ?? {};
  const ta = tokensOf(a, fold);
  const tb = tokensOf(b, fold);
  if (!ta.length || !tb.length) return false;
  const singleGeneric = (from) => from.length === 1 && typeof commonNoun === "function" && commonNoun(from[0]);
  const taSubsetTb = tokenSetContains(ta, tb, sameStem) && !singleGeneric(ta);
  const tbSubsetTa = tokenSetContains(tb, ta, sameStem) && !singleGeneric(tb);
  if (taSubsetTb || tbSubsetTa) {
    if (!contiguitySensitive) return true;
    const [short, long] = taSubsetTb ? [ta, tb] : [tb, ta];
    if (isContiguousRun(short, long, sameStem)) return true;
    if (typeof witness === "function" && witness(a, b)) return true;
  }
  const sharedFinal = tokenEq(ta[ta.length - 1], tb[tb.length - 1], sameStem);
  if (!sharedFinal) return false;
  return typeof witness === "function" ? !!witness(a, b) : false;
};
var CAP_TOKEN = /^[\p{Lu}][\p{L}'’]*$/u;
var LOWER_TOKEN = /^[\p{Ll}][\p{L}'’]*$/u;
var CAPTION_CUE = /\[(?:\d{1,2}(?::\d{2}){1,2}|\p{Ll}[\p{Ll}\s,'’-]{0,40})\]/gu;
var CAP_SIG_ALPHA = 0.05;
var logBinomialTailAtHalf = (k, n) => {
  if (k <= 0) return 0;
  if (k > n) return -Infinity;
  const logHalf = Math.log(0.5);
  let logTerm = n * logHalf;
  let logMax = -Infinity;
  const kept = [];
  for (let j = 1; j <= n; j += 1) {
    logTerm = logTerm + Math.log(n - j + 1) - Math.log(j);
    if (j >= k) {
      kept.push(logTerm);
      if (logTerm > logMax) logMax = logTerm;
    }
  }
  let sumExp = 0;
  for (const lt of kept) sumExp += Math.exp(lt - logMax);
  return logMax + Math.log(sumExp);
};
var TWIN_TIED = Object.freeze(["name", "function word"]);
var capitalisationIsSignificant = (cap, lower) => {
  const n = cap + lower;
  return Math.exp(logBinomialTailAtHalf(cap, n)) < CAP_SIG_ALPHA;
};
var POSSESSIVE = /['’]s?$/i;
var stripPossessive = (token) => token.replace(POSSESSIVE, "");
var ROMAN = /^M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;
var isRomanNumeral = (token) => token.length > 0 && token === token.toUpperCase() && ROMAN.test(token);
var isAllCaps = (token) => {
  const letters = token.replace(/[^\p{L}]/gu, "");
  return letters.length > 0 && letters === letters.toUpperCase();
};
var stripNumeralIndex = (tokens2) => {
  const out = tokens2.slice();
  while (out.length > 1 && isRomanNumeral(out[out.length - 1])) out.pop();
  return out;
};
var normaliseSurface = (surface) => stripNumeralIndex(String(surface).split(/\s+/).map(stripPossessive)).join(" ");
var ENC = new TextEncoder();
var createSurfaceEvidence = () => ({
  capCounts: /* @__PURE__ */ new Map(),
  // surface -> times seen capitalised, NOT sentence-initial
  lowerCounts: /* @__PURE__ */ new Map(),
  // lowercased form -> times seen lowercase anywhere
  sentenceIndex: /* @__PURE__ */ new Map(),
  // surface -> Set(sentence order)
  lowerSentenceIndex: /* @__PURE__ */ new Map()
  // lowercased form -> Set(sentence order) — the case-free path's reach
});
var accumulateSurfaceEvidence = (sentences, evidence, { abbreviations = null, runBreak = null } = {}) => {
  const { capCounts, lowerCounts, sentenceIndex, lowerSentenceIndex } = evidence;
  const abbrev = abbreviations ? new Set(abbreviations) : deriveAbbreviations(sentences.map((s) => s.text).join(" "));
  for (const sent of sentences) {
    const rawToks = sent.text.replace(CAPTION_CUE, " \u2014 ").split(/\s+/).filter(Boolean);
    const toks = [];
    const breaksAfter = [];
    const leadingJunk = [];
    let pendingHardBreak = false;
    for (const raw of rawToks) {
      const withoutLeading = raw.replace(/^[^\p{L}]+/gu, "");
      const cleaned = withoutLeading.replace(/[^\p{L}'’]+$/gu, "");
      if (!cleaned) {
        pendingHardBreak = true;
        continue;
      }
      toks.push(cleaned);
      leadingJunk.push(withoutLeading.length !== raw.length || pendingHardBreak);
      pendingHardBreak = false;
      const trailing = withoutLeading.slice(cleaned.length);
      const isAbbreviatedTitle = trailing === "." && (abbrev.has(cleaned) || HONORIFIC_TITLES.has(cleaned.toLowerCase()));
      breaksAfter.push(trailing.length > 0 && !isAbbreviatedTitle);
    }
    const hardBreakAfter = toks.map((_, k) => breaksAfter[k] || (leadingJunk[k + 1] ?? false));
    if (toks.length > 1 && toks.every(isAllCaps)) continue;
    for (let i2 = 0; i2 < toks.length; i2++) {
      if (LOWER_TOKEN.test(toks[i2])) {
        const k = diaNorm(toks[i2]);
        lowerCounts.set(k, (lowerCounts.get(k) ?? 0) + 1);
        if (!lowerSentenceIndex.has(k)) lowerSentenceIndex.set(k, /* @__PURE__ */ new Set());
        lowerSentenceIndex.get(k).add(sent.order);
      }
    }
    let i = 1;
    while (i < toks.length) {
      if (NEVER_A_NAME.has(toks[i].toLowerCase())) {
        i++;
        continue;
      }
      if (!CAP_TOKEN.test(toks[i])) {
        i++;
        continue;
      }
      let j = i + 1;
      while (j < toks.length && CAP_TOKEN.test(toks[j]) && !NEVER_A_NAME.has(toks[j].toLowerCase()) && !hardBreakAfter[j - 1] && !(runBreak && runBreak(toks[j - 1], toks[j]))) j++;
      const run = toks.slice(i, j);
      if (run.length > 1 && run.every(isAllCaps)) {
        i = j;
        continue;
      }
      for (let len = 1; len <= Math.min(run.length, 4); len++) {
        const surface = normaliseSurface(run.slice(0, len).join(" "));
        if (!surface) continue;
        capCounts.set(surface, (capCounts.get(surface) ?? 0) + 1);
        if (!sentenceIndex.has(surface)) sentenceIndex.set(surface, /* @__PURE__ */ new Set());
        sentenceIndex.get(surface).add(sent.order);
      }
      i = j;
    }
  }
  return evidence;
};
var surfacesFromEvidence = (evidence, { functionWords = null, abbreviations = null, minGlyphs = 2, formUsage = null, verdicts = null } = {}) => {
  const { capCounts, lowerCounts, sentenceIndex, lowerSentenceIndex } = evidence;
  const abbrev = abbreviations ? new Set(abbreviations) : null;
  const surfaces = [];
  let runHeads = null;
  for (const [surface, cap] of capCounts) {
    const words2 = surface.split(/\s+/);
    if (words2.every(isRomanNumeral)) continue;
    if (surface.replace(/[^\p{L}\p{N}]/gu, "").length < minGlyphs) continue;
    if (words2.length === 1) {
      if (abbrev && abbrev.has(surface)) continue;
      const lower = lowerCounts.get(diaNorm(surface)) ?? 0;
      if (functionWords && lower > 0 && functionWords.has(diaNorm(surface))) continue;
      if (lower > 0 && cap > 0 && !capitalisationIsSignificant(cap, lower)) continue;
      if (lower === 0 && cap > 0 && typeof formUsage === "function") {
        const u = formUsage(surface);
        if (u?.twin) {
          runHeads ??= new Set([...capCounts.keys()].filter((k) => /\s/.test(k)).map((k) => k.split(/\s+/)[0]));
          if (runHeads.has(surface)) verdicts?.separated.push({ surface, tied: TWIN_TIED, nominal: u.nominal, other: u.other, capitals: cap });
          else {
            verdicts?.undecided.push({ surface, tied: TWIN_TIED, nominal: u.nominal, other: u.other, capitals: cap });
            continue;
          }
        } else if (u && u.other > 0 && capitalisationIsSignificant(u.other, u.nominal + cap)) continue;
      }
    }
    surfaces.push({ surface, mentions: cap, sentences: sentenceIndex.get(surface).size });
  }
  if (capCounts.size === 0 && functionWords) {
    const floor = 3;
    for (const [surface, sentSet] of lowerSentenceIndex.entries()) {
      if (surface.replace(/[^\p{L}\p{N}]/gu, "").length < minGlyphs) continue;
      if (functionWords.has(surface)) continue;
      if (surface.split(/\s+/).some(isRomanNumeral)) continue;
      if (sentSet.size < 3) continue;
      const mentions = lowerCounts.get(surface) ?? 0;
      if (mentions < floor) continue;
      surfaces.push({ surface, mentions, sentences: sentSet.size });
    }
  }
  return surfaces.sort((a, b) => b.mentions - a.mentions);
};
var extractSurfaces = (sentences, opts = {}) => surfacesFromEvidence(accumulateSurfaceEvidence(sentences, createSurfaceEvidence(), { abbreviations: opts.abbreviations, runBreak: opts.runBreak ?? null }), opts);
var quantileOf = (sorted, q) => {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
};
var deriveMinPartners = (partners) => {
  const counts = [...partners.values()].map((s) => s.size).sort((a, b) => a - b);
  if (counts.length === 0) return Infinity;
  const q1 = quantileOf(counts, 0.25);
  const q3 = quantileOf(counts, 0.75);
  return q3 + (q3 - q1);
};
var genericTokens = (surfaces, { minPartners } = {}) => {
  const partners = /* @__PURE__ */ new Map();
  for (const { surface } of surfaces) {
    const toks = diaNorm(surface).split(/\s+/).filter(individuatesName);
    if (toks.length < 2) continue;
    for (const t of toks) {
      if (!partners.has(t)) partners.set(t, /* @__PURE__ */ new Set());
      for (const u of toks) if (u !== t) partners.get(t).add(u);
    }
  }
  const fence = minPartners ?? deriveMinPartners(partners);
  const generic = /* @__PURE__ */ new Set();
  for (const [tok, set] of partners) if (set.size > fence) generic.add(tok);
  return generic;
};
var deriveMinSentences = (surfaces) => {
  const counts = surfaces.map((s) => s.sentences).sort((a, b) => a - b);
  if (counts.length === 0) return 0;
  const floor = quantileOf(counts, 0.25);
  return counts.every((c) => c <= floor) ? 0 : floor;
};
var discoverReferents = (surfaces, { minSentences, minPartners, groups, foldToken, sameStem = null, prior = null, commonNoun = null } = {}) => {
  const events = [];
  const assigned = /* @__PURE__ */ new Map();
  const generic = groups ? groups.reduce((out, g) => {
    for (const t of genericTokens(g, { minPartners })) out.add(t);
    return out;
  }, /* @__PURE__ */ new Set()) : genericTokens(surfaces, { minPartners });
  const sentencesFloorOf = groups ? (() => {
    const byGroup = groups.map((g) => minSentences ?? deriveMinSentences(g));
    const lookup = /* @__PURE__ */ new Map();
    groups.forEach((g, gi) => {
      for (const s of g) lookup.set(s, byGroup[gi]);
    });
    return (s) => lookup.get(s);
  })() : (() => {
    const floor = minSentences ?? deriveMinSentences(surfaces);
    return () => floor;
  })();
  const normMemo = /* @__PURE__ */ new Map();
  const normOf = (surface) => {
    let n = normMemo.get(surface);
    if (n === void 0) {
      n = diaNorm(surface);
      normMemo.set(surface, n);
    }
    return n;
  };
  const indMemo = /* @__PURE__ */ new Map();
  const individuating = (surface) => {
    let v = indMemo.get(surface);
    if (v === void 0) {
      v = normOf(surface).split(/\s+/).filter((t) => individuatesName(t) && !generic.has(t));
      indMemo.set(surface, v);
    }
    return v;
  };
  const eligiblePartners = (() => {
    const m = /* @__PURE__ */ new Map();
    for (const entry of surfaces) {
      if (entry.sentences <= sentencesFloorOf(entry)) continue;
      const toks = diaNorm(entry.surface).split(/\s+/).filter(individuatesName);
      for (const t of toks) {
        if (!m.has(t)) m.set(t, /* @__PURE__ */ new Set());
        for (const u of toks) if (u !== t) m.get(t).add(u);
      }
    }
    return m;
  })();
  const corefersIndividuated = (a, b) => {
    const ia = individuating(a);
    const ib = individuating(b);
    if (ia.length && ib.length) return namesCorefer(ia.join(" "), ib.join(" "), { fold: foldToken, sameStem, commonNoun, contiguitySensitive: false });
    const rescued = (bare, other) => {
      const toks = normOf(bare).split(/\s+/).filter(individuatesName);
      if (toks.length !== 1) return false;
      const ps = eligiblePartners.get(toks[0]);
      if (!ps || ps.size !== 1) return false;
      const [only] = ps;
      return normOf(other).split(/\s+/).includes(only);
    };
    if (!ia.length && ib.length && rescued(a, b)) return true;
    if (!ib.length && ia.length && rescued(b, a)) return true;
    return normOf(a) === normOf(b);
  };
  const partiallyOverlaps = (a, b) => {
    if (!a.length || !b.length) return false;
    const shared = a.some((t) => b.includes(t));
    if (!shared) return false;
    const aInB = a.every((t) => b.includes(t));
    const bInA = b.every((t) => a.includes(t));
    return !aInB && !bInA;
  };
  const clusters = /* @__PURE__ */ new Map();
  const aliases = /* @__PURE__ */ new Map();
  const resolveId = (id) => {
    let c = id;
    while (aliases.has(c)) c = aliases.get(c);
    return c;
  };
  const merges = [];
  const ambiguities = [];
  const assignmentOrder = [...surfaces].sort((a, b) => {
    const ia = individuating(a.surface).length;
    const ib = individuating(b.surface).length;
    if (ib !== ia) return ib - ia;
    if (b.sentences !== a.sentences) return b.sentences - a.sentences;
    if ((b.mentions ?? 0) !== (a.mentions ?? 0)) return (b.mentions ?? 0) - (a.mentions ?? 0);
    return a.surface < b.surface ? -1 : a.surface > b.surface ? 1 : 0;
  });
  for (const entry of assignmentOrder) {
    const { surface, sentences } = entry;
    if (sentences <= sentencesFloorOf(entry)) continue;
    const arriving = individuating(surface);
    const matched = [];
    for (const [id, g] of clusters) {
      if (corefersIndividuated(surface, g.maximal)) matched.push([id, g]);
    }
    let referentId = null;
    let basis = "name-variant coreference";
    if (matched.length === 1) {
      const [id, g] = matched[0];
      const sibling = g.children.find((c) => partiallyOverlaps(arriving, c.tokens));
      if (sibling) {
        ambiguities.push({ surface, candidates: [id], conflictsWith: sibling.surface });
        continue;
      }
      if (arriving.length && g.maximalTokens.length && arriving.length < g.maximalTokens.length && !isContiguousRun(arriving, g.maximalTokens, sameStem)) {
        ambiguities.push({ surface, candidates: [id], conflictsWith: g.maximal });
        continue;
      }
      referentId = id;
    } else if (matched.length > 1) {
      const witnessed = arriving.length > 0 && matched.every(([, g]) => g.maximalTokens.length > 0 && g.maximalTokens.every((t) => arriving.includes(t)));
      if (witnessed) {
        matched.sort((a, b) => a[1].born - b[1].born);
        referentId = matched[0][0];
        const kept = matched[0][1];
        const folded = [];
        for (const [otherId, og] of matched.slice(1)) {
          aliases.set(otherId, referentId);
          clusters.delete(otherId);
          folded.push(otherId);
          kept.children.push({ surface: og.maximal, tokens: og.maximalTokens }, ...og.children);
        }
        merges.push({ kept: referentId, folded, witness: surface });
        basis = "name-variant coreference (this surface's own tokens contain every merged referent's evidence \u2014 a witnessed merge)";
      } else {
        ambiguities.push({ surface, candidates: matched.map(([id]) => id) });
        continue;
      }
    }
    if (!referentId) {
      referentId = `ref:auto:${diaNorm(surface).replace(/\s+/g, "_")}`;
      clusters.set(referentId, { maximal: surface, maximalTokens: arriving, born: clusters.size + aliases.size, children: [] });
    } else {
      const g = clusters.get(referentId);
      if (arriving.length > g.maximalTokens.length) {
        g.children.push({ surface: g.maximal, tokens: g.maximalTokens });
        g.maximal = surface;
        g.maximalTokens = arriving;
      } else {
        g.children.push({ surface, tokens: arriving });
      }
    }
    events.push({
      type: "DEF.admit",
      referent_id: referentId,
      surface,
      provenance: { giver: "surfaces/discoverReferents", tier: "engine", basis }
    });
    assigned.set(surface, referentId);
  }
  for (const e of events) e.referent_id = resolveId(e.referent_id);
  let addresses = null;
  if (prior) {
    const priorBorn = prior.born ?? /* @__PURE__ */ new Map();
    let next = prior.next ?? (priorBorn.size ? Math.max(...priorBorn.values()) + 1 : 0);
    const members = /* @__PURE__ */ new Map();
    for (const e of events) {
      if (!members.has(e.referent_id)) members.set(e.referent_id, []);
      members.get(e.referent_id).push(e.surface);
    }
    const claims = /* @__PURE__ */ new Map();
    for (const [id, ms] of members) {
      const c = /* @__PURE__ */ new Map();
      for (const m of ms) {
        const pid = prior.refs?.get(diaNorm(m));
        if (pid) c.set(pid, (c.get(pid) ?? 0) + 1);
      }
      claims.set(id, c);
    }
    const bornOrder = [...new Set([...claims.values()].flatMap((c) => [...c.keys()]))].sort((a, b) => (priorBorn.get(a) ?? Infinity) - (priorBorn.get(b) ?? Infinity) || (a < b ? -1 : 1));
    const rename = /* @__PURE__ */ new Map();
    const taken = /* @__PURE__ */ new Set();
    const clusterBorn = (id) => clusters.get(id)?.born ?? Infinity;
    for (const address of bornOrder) {
      const holders = [...claims].filter(([id, c]) => c.has(address) && !rename.has(id)).sort((x, y) => y[1].get(address) - x[1].get(address) || clusterBorn(x[0]) - clusterBorn(y[0]));
      if (!holders.length) continue;
      rename.set(holders[0][0], address);
      taken.add(address);
    }
    const born = /* @__PURE__ */ new Map();
    for (const id of members.keys()) {
      if (rename.has(id)) {
        born.set(rename.get(id), priorBorn.get(rename.get(id)) ?? next++);
        continue;
      }
      let fresh = id;
      if (priorBorn.has(fresh) || taken.has(fresh)) fresh = `${id}:${next}`;
      rename.set(id, fresh);
      taken.add(fresh);
      born.set(fresh, next++);
    }
    for (const [id, c] of claims) {
      const kept = rename.get(id);
      const folded = [...c.keys()].filter((pid) => pid !== kept && ![...rename.values()].includes(pid));
      if (folded.length) merges.push({ kept, folded, witness: clusters.get(id)?.maximal ?? members.get(id)[0], basis: "two prior addresses' bearers cluster as one being under this refresh's own evidence" });
    }
    for (const e of events) e.referent_id = rename.get(e.referent_id) ?? e.referent_id;
    for (const m of merges) {
      m.kept = rename.get(m.kept) ?? m.kept;
      m.folded = m.folded.map((f) => rename.get(f) ?? f);
    }
    for (const a of ambiguities) a.candidates = a.candidates.map((cid) => rename.get(resolveId(cid)) ?? resolveId(cid));
    addresses = { born, next };
  }
  const referentIds = new Set(events.map((e) => e.referent_id));
  const gaps = [...referentIds].map((id) => ({
    reason: "pronoun_and_descriptor_mentions_unresolved",
    referent: id,
    tier: "model",
    needsWitness: true,
    detail: "name-variant coreference is engine-tier and complete; binding pronouns and definite descriptions to this referent is not derivable (eoreader5 measured distributional coref failing twice). Supply a per-text prior to close this gap."
  }));
  for (const a of ambiguities) {
    gaps.push({
      reason: "ambiguous_surface",
      surface: a.surface,
      candidates: a.candidates.map(resolveId),
      conflictsWith: a.conflictsWith ?? null,
      tier: "model",
      needsWitness: true,
      detail: a.conflictsWith ? `this form corefers with the group's maximal member but partially overlaps a sibling already in it ("${a.conflictsWith}") without containing it or being contained by it \u2014 two different sub-phrases of one anchor, or two fragments of one name that only world knowledge could tell apart; the type level withholds admission rather than guess. Each of its mentions is an occurrence-level question \u2014 resolve by activation recall against the candidate (the perceiver's pronouns/roles machinery), or close with a per-text prior.` : "this form corefers with more than one established referent, so the type level withholds admission; each of its mentions is an occurrence-level question \u2014 resolve by activation recall against the candidates (the perceiver's pronouns/roles machinery), or close with a per-text prior."
    });
  }
  return { events, gaps, merges, addresses };
};

// native/organs/kind-standing.js
function contextVectors(sentences, surfaces, { clean } = {}) {
  if (sentences?.schema === "EOCompanyIndex@1" && typeof sentences.vectors === "function") return sentences.vectors(surfaces);
  const toks = clean ?? ((t) => t.replace(/^[^\p{L}]+|[^\p{L}'’]+$/gu, ""));
  const vecs = new Map(surfaces.map((s) => [s, /* @__PURE__ */ new Map()]));
  const parts = surfaces.map((s) => s.split(" "));
  const byFirst = /* @__PURE__ */ new Map();
  parts.forEach((pw, k) => {
    if (!byFirst.has(pw[0])) byFirst.set(pw[0], []);
    byFirst.get(pw[0]).push(k);
  });
  for (const sent of sentences) {
    const words2 = String(sent.text ?? sent).split(/\s+/).map(toks);
    for (let i = 0; i < words2.length; i++) {
      const ks = byFirst.get(words2[i]);
      if (!ks) continue;
      for (const k of ks) {
        const pw = parts[k];
        if (i + pw.length > words2.length) continue;
        let ok = true;
        for (let j = 1; j < pw.length; j++) if (words2[i + j] !== pw[j]) {
          ok = false;
          break;
        }
        if (!ok) continue;
        const v = vecs.get(surfaces[k]);
        const before = i > 0 ? words2[i - 1].toLowerCase() : "^";
        const after = i + pw.length < words2.length ? words2[i + pw.length].toLowerCase() : "$";
        v.set(`before=${before}`, (v.get(`before=${before}`) ?? 0) + 1);
        v.set(`after=${after}`, (v.get(`after=${after}`) ?? 0) + 1);
      }
    }
  }
  for (const [k, v] of [...vecs]) if (!v.size) vecs.delete(k);
  return vecs;
}
function discoverCompanyKinds(sentences, vocabulary, { minMentions, minShare, minMembers, clean, nullArm = null } = {}) {
  for (const [k, v] of Object.entries({ minMentions, minShare, minMembers }))
    if (!Number.isFinite(v)) throw new Error(`discoverCompanyKinds: ${k} must be declared`);
  if (nullArm) {
    for (const k of ["draws", "seed", "alpha"])
      if (!Number.isFinite(nullArm[k])) throw new Error(`discoverCompanyKinds: nullArm.${k} must be declared`);
  }
  if (nullArm && sentences?.schema === "EOCompanyIndex@1") throw new TypeError("discoverCompanyKinds: the null arm shuffles sentences it is handed \u2014 hand it sentences, never an index");
  const vecs = contextVectors(sentences, vocabulary, { clean });
  const bySignature = /* @__PURE__ */ new Map();
  for (const [word, v] of vecs) {
    let total2 = 0, best = null, bestN = 0;
    for (const [f, n] of v) {
      if (!f.startsWith("before=")) continue;
      total2 += n;
      if (n > bestN) {
        bestN = n;
        best = f;
      }
    }
    if (!best || total2 < minMentions) continue;
    const share = bestN / total2;
    if (share < minShare) continue;
    if (!bySignature.has(best)) bySignature.set(best, []);
    bySignature.get(best).push({ word, share });
  }
  let ceiling = null;
  if (nullArm) {
    let seed = nullArm.seed >>> 0;
    const rnd = () => (seed = seed * 1103515245 + 12345 & 2147483647) / 2147483647;
    const perWord = /* @__PURE__ */ new Map();
    for (let d = 0; d < nullArm.draws; d++) {
      const redealt = sentences.map((sent) => {
        const words2 = String(sent.text ?? sent).split(/\s+/);
        for (let i = words2.length - 1; i > 0; i--) {
          const j = Math.floor(rnd() * (i + 1));
          [words2[i], words2[j]] = [words2[j], words2[i]];
        }
        return { text: words2.join(" ") };
      });
      const nv = contextVectors(redealt, vocabulary, { clean });
      for (const [word, v] of nv) {
        let tot = 0, best = 0;
        for (const [f, n] of v) {
          if (!f.startsWith("before=")) continue;
          tot += n;
          if (n > best) best = n;
        }
        if (!tot) continue;
        if (!perWord.has(word)) perWord.set(word, []);
        perWord.get(word).push(best / tot);
      }
    }
    ceiling = /* @__PURE__ */ new Map();
    for (const [word, shares] of perWord) {
      shares.sort((a, b) => a - b);
      const idx = Math.min(shares.length - 1, Math.ceil((1 - nullArm.alpha) * shares.length) - 1);
      ceiling.set(word, shares[Math.max(0, idx)]);
    }
  }
  const kinds = [];
  for (const [signature, members] of bySignature) {
    if (members.length < minMembers) continue;
    const kept = ceiling ? members.filter((m) => m.share > (ceiling.get(m.word) ?? 1)) : members;
    if (kept.length < minMembers) continue;
    kinds.push({
      name: `kind:${signature}`,
      signature,
      members: kept.map((m) => m.word),
      share: new Map(kept.map((m) => [m.word, m.share])),
      ...ceiling ? { nullCeiling: new Map(kept.map((m) => [m.word, ceiling.get(m.word) ?? null])) } : {}
    });
  }
  return kinds;
}

// native/adapters/text/wordclass.js
var THRAX_MAP = Object.freeze({
  // ónoma (ὄνομα) — Thrax's own category, unmarked for proper/common.
  NOUN: "noun",
  PROPN: "noun",
  // rhêma (ῥῆμα) — Thrax's own category. UD splits AUX (copula/auxiliary
  // "to be", "to have") from VERB for typological reasons foreign to
  // Thrax's Greek-specific scheme; both fall under one ancient category.
  VERB: "verb",
  AUX: "verb",
  // antōnymía (ἀντωνυμία) — Thrax's own category.
  PRON: "pronoun",
  // arthron (ἄρθρον) — Thrax's own category, but narrower than UD's DET:
  // Thrax's article was specifically the Greek DEFINITE article. UD's DET
  // also covers English's indefinite article and demonstratives/
  // possessives ("a", "this", "my") — a real widening, not a literal match.
  DET: "article",
  // próthesis (πρόθεσις) — Thrax's own category.
  ADP: "preposition",
  // sýndesmos (σύνδεσμος) — Thrax's own category, UNDIVIDED. UD's
  // coordinating/subordinating split (CCONJ/SCONJ) is a modern refinement
  // with no ancient counterpart; both map to the one Thrax category.
  CCONJ: "conjunction",
  SCONJ: "conjunction",
  // epírrhēma (ἐπίρρημα) — Thrax's own category.
  ADV: "adverb",
  // NOT Thrax's own: Donatus and Priscian (Latin grammarians, a few
  // centuries after Thrax) dropped the article — Latin has none — and
  // added the interjection in its place. Kept here, named as the addition
  // it is, never presented as Thrax's original eight.
  INTJ: "interjection"
});
var THRAX_OUT_OF_SCOPE = Object.freeze(/* @__PURE__ */ new Set(["ADJ", "PART", "NUM", "PUNCT", "SYM", "X"]));
var THRAX_META = Object.freeze({
  giver: "Dionysius Thrax, Tekhn\u0113 grammatik\u0113, Alexandria, ~100 BCE (interjection: Donatus/Priscian, Latin, later)",
  scope: null
});
var POS_PRIOR_META = Object.freeze({
  giver: "Universal Dependencies UD_English-EWT, CC BY-SA 4.0 (scripts/build-pos-prior.mjs)",
  scope: "lang/en"
});
var APOSTROPHES = /[\u2019\u2018\u02BC\u2032\uFF07`\u00B4]/g;
var EDGE_NON_WORD = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;
var normalizeForm = (surface) => {
  const steps = [];
  let f = String(surface ?? "");
  const nfkc = f.normalize("NFKC");
  if (nfkc !== f) {
    steps.push({ step: "unicode", note: "NFKC \u2014 compatibility characters folded" });
    f = nfkc;
  }
  const ap = f.replace(APOSTROPHES, "'");
  if (ap !== f) {
    steps.push({ step: "apostrophe", note: "curly/modifier apostrophe \u2192 the prior's straight apostrophe" });
    f = ap;
  }
  const edge = f.replace(EDGE_NON_WORD, "");
  if (edge && edge !== f) {
    steps.push({ step: "edge-punctuation", note: `\u201C${f.match(EDGE_NON_WORD).join("")}\u201D is the sentence's punctuation, not part of the form` });
    f = edge;
  }
  return { form: f, steps };
};
var SHAPES = [
  ["email", /^[\w.+-]+@[\w-]+(?:\.[\w-]+)+$/, "X", "an e-mail address"],
  ["url", /^(?:https?:\/\/|www\.)\S+$/i, "X", "a URL"],
  ["ordinal", /^\d+(?:st|nd|rd|th)$/i, "ADJ", "an ordinal numeral"],
  ["number", /^[+-]?[$€£]?\d[\d,]*(?:\.\d+)?%?$/, "NUM", "a numeral (digits, grouping, currency or percent)"],
  ["identifier", /^[A-Z]{1,3}\d{4,}(?:\.\d+)?$/, "X", "a document or account identifier (letters then a digit run)"]
];
var shapeClass = (form) => {
  for (const [rule, re, upos, note] of SHAPES) if (re.test(form)) return { rule, upos, note };
  return null;
};
var LEXICON_INDEX = /* @__PURE__ */ new WeakMap();
var lexiconIndex = (lex) => {
  let m = LEXICON_INDEX.get(lex);
  if (!m) {
    m = /* @__PURE__ */ new Map();
    for (const [key, forms] of Object.entries(lex?.classes ?? {})) {
      const upos = key.split("|");
      for (const f of forms) if (!m.has(f)) m.set(f, { key, upos });
    }
    LEXICON_INDEX.set(lex, m);
  }
  return m;
};
var classifyWord = (surface, { posPrior } = {}) => {
  const hit = (form2) => posPrior?.forms?.[form2.toLowerCase()];
  let counts = hit(surface ?? "");
  let form = surface, via = [];
  const norm6 = counts ? null : normalizeForm(surface);
  if (!counts && norm6.steps.length && norm6.form) {
    counts = hit(norm6.form);
    if (counts) {
      form = norm6.form;
      via = norm6.steps;
    }
  }
  if (!counts) {
    const probe = norm6.form || "";
    const hops = norm6.steps;
    const sh = probe ? shapeClass(probe) : null;
    if (sh) {
      return {
        surface,
        found: true,
        total: 0,
        form: probe,
        via: [...hops, { step: "shape", rule: sh.rule, note: sh.note }],
        attested: "shape",
        candidates: [{ upos: sh.upos, count: 0, share: 1, thraxClass: THRAX_MAP[sh.upos] ?? null, attested: "shape" }]
      };
    }
    const lex = posPrior?.lexicon;
    const ent = lex && probe ? lexiconIndex(lex).get(probe.toLowerCase()) : null;
    if (ent) {
      const giver = lex.provenance?.givers ?? null;
      return {
        surface,
        found: true,
        total: 0,
        form: probe,
        via: [...hops, { step: "lexicon", class: ent.key, note: "not in the treebank prior; attested in the received class lexicon \u2014 attestation only, no frequency" }],
        attested: "lexicon",
        givers: giver,
        candidates: ent.upos.map((upos) => ({ upos, count: 0, share: null, thraxClass: THRAX_MAP[upos] ?? null, attested: "lexicon" }))
      };
    }
    return { surface, found: false, total: 0, candidates: [] };
  }
  const total2 = Object.values(counts).reduce((a, b) => a + b, 0);
  const candidates = Object.entries(counts).map(([upos, count]) => ({
    upos,
    count,
    share: total2 > 0 ? count / total2 : 0,
    thraxClass: THRAX_MAP[upos] ?? null
  })).sort((a, b) => b.count - a.count);
  return via.length ? { surface, found: true, total: total2, candidates, form, via } : { surface, found: true, total: total2, candidates };
};
var dominantClass = (classification, { minShare } = {}) => {
  if (!Number.isFinite(minShare) || minShare < 0 || minShare > 1)
    throw new TypeError("dominantClass: minShare is declared \u2014 how dominant a candidate must be is never a default");
  const top = classification?.candidates?.[0];
  if (!top || top.share == null || top.share < minShare) return null;
  return top;
};

// native/kernel/cube.js
var MODES = Object.freeze(["Differentiate", "Relate", "Generate"]);
var DOMAINS = Object.freeze(["Existence", "Structure", "Interpretation"]);
var GRAINS = Object.freeze(["Ground", "Figure", "Pattern"]);
var OP_MODE = Object.freeze({
  NUL: "Differentiate",
  SIG: "Relate",
  INS: "Generate",
  SEG: "Differentiate",
  CON: "Relate",
  SYN: "Generate",
  DEF: "Differentiate",
  EVA: "Relate",
  REC: "Generate"
});
var OP_DOMAIN = Object.freeze({
  NUL: "Existence",
  SIG: "Existence",
  INS: "Existence",
  SEG: "Structure",
  CON: "Structure",
  SYN: "Structure",
  DEF: "Interpretation",
  EVA: "Interpretation",
  REC: "Interpretation"
});
var TERRAIN_BY_DOMAIN = Object.freeze({
  Existence: Object.freeze({ Ground: "Void", Figure: "Entity", Pattern: "Kind" }),
  Structure: Object.freeze({ Ground: "Field", Figure: "Link", Pattern: "Network" }),
  Interpretation: Object.freeze({ Ground: "Atmosphere", Figure: "Lens", Pattern: "Paradigm" })
});
var STANCE_BY_MODE = Object.freeze({
  Differentiate: Object.freeze({ Ground: "Clearing", Figure: "Dissecting", Pattern: "Unraveling" }),
  Relate: Object.freeze({ Ground: "Tending", Figure: "Binding", Pattern: "Tracing" }),
  Generate: Object.freeze({ Ground: "Cultivating", Figure: "Making", Pattern: "Composing" })
});
var gap = (type, detail = {}) => Object.freeze({ gap: type, ...detail });
var cellOf = (op, grain) => {
  if (!OP_MODE[op]) return gap("unknown_spec", { reason: `no such operator: ${op}`, known: Object.keys(OP_MODE) });
  if (!GRAINS.includes(grain)) return gap("unknown_spec", { reason: `no such grain: ${grain}`, known: GRAINS });
  const mode = OP_MODE[op];
  const domain = OP_DOMAIN[op];
  return Object.freeze({ op, grain, mode, domain, terrain: TERRAIN_BY_DOMAIN[domain][grain], stance: STANCE_BY_MODE[mode][grain] });
};
var OPERATOR_CHAIN = Object.freeze(
  DOMAINS.flatMap(
    (domain) => MODES.map((mode) => Object.keys(OP_MODE).find((op) => OP_DOMAIN[op] === domain && OP_MODE[op] === mode))
  ).filter(Boolean)
);
var CELL_OF_GRAMMAR = Object.freeze({
  Case: { Nom: ["SEG", "Figure"], Acc: ["CON", "Figure"], Gen: ["CON", "Pattern"], Dat: ["CON", "Ground"], Voc: ["SIG", "Ground"], Loc: ["SIG", "Ground"], Ins: ["SIG", "Pattern"], Abl: ["SEG", "Ground"] },
  Person: { "1": ["SIG", "Ground"], "2": ["SIG", "Figure"], "3": ["INS", "Figure"] },
  Number: { Sing: ["SIG", "Figure"], Plur: ["SIG", "Pattern"], Dual: ["SIG", "Ground"] },
  VerbForm: { Fin: ["EVA", "Pattern"], Part: ["SEG", "Pattern"], Inf: ["SYN", "Figure"], Ger: ["DEF", "Pattern"] },
  Mood: { Ind: ["EVA", "Ground"], Sub: ["EVA", "Pattern"], Opt: ["EVA", "Pattern"], Imp: ["NUL", "Ground"] },
  Voice: { Act: ["EVA", "Figure"], Pass: ["REC", "Figure"], Mid: ["REC", "Ground"] },
  Tense: { Past: ["REC", "Pattern"], Pres: ["EVA", "Figure"], Fut: ["SYN", "Pattern"] },
  Aspect: { Imp: ["NUL", "Ground"], Perf: ["INS", "Pattern"], Prog: ["SIG", "Pattern"] }
});

// native/the-fold/prior-source.mjs
var IS_NODE = typeof process !== "undefined" && !!process.versions?.node && typeof window === "undefined";
var fs = IS_NODE ? (await import("node:fs")).default : null;
var path = IS_NODE ? (await import("node:path")).default : null;
var url = IS_NODE ? await import("node:url") : null;
var os = IS_NODE ? (await import("node:os")).default : null;
function nodeHome() {
  const here = path.dirname(url.fileURLToPath(import.meta.url));
  const root = path.join(here, "..", "..", "..");
  const janus = path.join(root, "janus", "priors");
  const vendored = path.join(here, "..", "priors");
  const userJanus = os ? path.join(os.homedir(), "Documents", "janus", "priors") : null;
  const dir = process.env.KHORA_PRIORS_DIR || (fs.existsSync(janus) ? janus : userJanus && fs.existsSync(userJanus) ? userJanus : fs.existsSync(vendored) ? vendored : janus);
  const also = !process.env.KHORA_PRIORS_DIR && dir !== vendored && fs.existsSync(vendored) && fs.realpathSync(vendored) !== fs.realpathSync(dir) ? vendored : null;
  const shipped = path.join(here, "..", "priors-shipped");
  return { kind: "fs", dir, also, shipped: fs.existsSync(shipped) ? shipped : null, base: null, root, janus: path.join(root, "janus") };
}
var HOME = IS_NODE ? nodeHome() : { kind: "fetch", dir: null, base: new URL("../priors/", import.meta.url).href, root: null, janus: null };
function readJsonAt(dir, name) {
  if (!fs || !dir) return null;
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
  } catch {
    return null;
  }
}
var listAt = (dir) => {
  try {
    return dir ? fs.readdirSync(dir) : [];
  } catch {
    return [];
  }
};
var fsSource = () => ({
  read: (name) => readJsonAt(HOME.dir, name) ?? (HOME.also ? readJsonAt(HOME.also, name) : null) ?? (HOME.shipped ? readJsonAt(HOME.shipped, name) : null),
  list: () => [.../* @__PURE__ */ new Set([...listAt(HOME.dir), ...listAt(HOME.also), ...listAt(HOME.shipped)])]
});
var fetched = /* @__PURE__ */ new Map();
var misses = /* @__PURE__ */ new Set();
var fetchSource = () => ({
  read: (name) => {
    if (fetched.has(name)) return fetched.get(name);
    misses.add(name);
    return null;
  },
  list: () => [...fetched.keys()].filter((n) => fetched.get(n) != null)
});
var source = IS_NODE ? fsSource() : fetchSource();
var cache = /* @__PURE__ */ new Map();
var generation = 0;
function priorJson(name) {
  if (!cache.has(name)) cache.set(name, source.read(name) ?? null);
  return cache.get(name);
}
var PRIORS_HOME = HOME;
async function preloadPriors(names = [], { base = HOME.base } = {}) {
  if (IS_NODE) return { loaded: names.filter((n) => priorJson(n) != null), missing: names.filter((n) => priorJson(n) == null) };
  const loaded = [], missing = [];
  await Promise.all([...new Set(names)].map(async (name) => {
    if (fetched.has(name)) {
      (fetched.get(name) != null ? loaded : missing).push(name);
      return;
    }
    let json = null;
    try {
      const r = await fetch(new URL(name, base));
      if (r.ok) json = await r.json();
    } catch {
      json = null;
    }
    fetched.set(name, json);
    cache.delete(name);
    misses.delete(name);
    generation++;
    (json != null ? loaded : missing).push(name);
  }));
  return { loaded, missing };
}
if (!IS_NODE) await preloadPriors(["reading-rules.json"]);

// native/kernel/reading-rules.js
var fs2 = IS_NODE ? (await import("node:fs")).default : null;
var NAME = "reading-rules.json";
var env = () => IS_NODE ? process.env.ER7_READING_RULES_FILE : void 0;
var HOME_FILE = PRIORS_HOME.dir ? `${PRIORS_HOME.dir}/${NAME}` : new URL(NAME, PRIORS_HOME.base).href;
var READING_RULES_FILE = env() ?? HOME_FILE;
var resolveReadingRulesFile = () => env() ?? READING_RULES_FILE;
var _cache = null;
function loadReadingRules() {
  if (_cache) return _cache;
  const source2 = resolveReadingRulesFile();
  let rules = null, gap2 = null;
  try {
    const d = source2 !== HOME_FILE && fs2 ? JSON.parse(fs2.readFileSync(source2, "utf8")) : priorJson(NAME);
    if (d == null) throw new Error("absent");
    rules = Object.freeze(d?.rules ?? null);
    if (!rules || rules.surprise === void 0) gap2 = { refused: "no_reading_rule", detail: `reading rules at ${source2} carry no rule object` };
  } catch {
    gap2 = { refused: "absent", detail: `reading rules not found at ${source2} \u2014 the khora is bare (a typed gap, never a guessed number)` };
  }
  _cache = Object.freeze({ schema: "ReadingRules@1", source: source2, rules, gap: gap2 });
  return _cache;
}

// native/adapters/text/grain-typing.js
var _readShare = loadReadingRules().rules?.grammarMinShare;
var GRAMMAR_MIN_SHARE = Number.isFinite(_readShare) ? _readShare : null;
var grammarIsDominant = (share) => Number.isFinite(GRAMMAR_MIN_SHARE) ? share >= GRAMMAR_MIN_SHARE : true;
var GRAIN_BY_THRAX = Object.freeze({
  verb: { op: "CON", grain: "Figure" },
  participle: { op: "CON", grain: "Figure" },
  preposition: { op: "CON", grain: "Ground" },
  conjunction: { op: "SEG", grain: "Figure" }
});
function makeGrainTyper(posPrior) {
  const thraxOf = (label) => {
    const head = String(label ?? "").trim().split(/\s+/).pop()?.toLowerCase();
    if (!head) return null;
    return dominantClass(classifyWord(head, { posPrior }), { minShare: GRAMMAR_MIN_SHARE })?.thraxClass ?? null;
  };
  const grainOf = (label) => {
    const thrax = thraxOf(label);
    const spec = thrax ? GRAIN_BY_THRAX[thrax] : null;
    if (!spec) {
      if (thrax) return { refused: true, settledAs: thrax };
      return {
        grain_gap: `connector does not settle in the received prior (Universal Dependencies has no Thrax-tradition category for it, e.g. the infinitive marker "to" is PART) \u2014 kept, not discarded`,
        settledAs: null
      };
    }
    const cell = cellOf(spec.op, spec.grain);
    return { operator: spec.op, grain: spec.grain, terrain: cell.terrain, stance: cell.stance, settledAs: thrax };
  };
  return { thraxOf, grainOf };
}
function cellLabelOf(grain) {
  if (!grain || grain.grain_gap) return "grain_gap";
  const op = grain.operator ?? grain.op;
  if (op === "CON" && grain.grain === "Ground") return "CON\xB7Ground (Field)";
  if (op === "CON" && grain.grain === "Figure") return "CON\xB7Figure (Link)";
  if (op === "SEG" && grain.grain === "Figure") return "SEG\xB7Figure (Distinction)";
  return "grain_gap";
}

// native/organs/heard-surfaces.js
var NAMING_CLASSES = Object.freeze(/* @__PURE__ */ new Set(["NOUN", "PROPN"]));
var POSITIONAL_SIGNATURE = "before=^";
var isPositionallySigned = (kind) => kind?.signature === POSITIONAL_SIGNATURE;
var PROCLITIC_MAX_PEEL = 3;
var peelProclitics = (word, proclitics, posPrior) => {
  if (!proclitics || !proclitics.size || !posPrior?.forms) return null;
  const peeled = [];
  let rest = word;
  for (let depth = 0; depth < PROCLITIC_MAX_PEEL; depth++) {
    if (rest.length < 3) break;
    const lead = rest[0];
    if (!proclitics.has(lead)) break;
    const candidate = rest.slice(1);
    peeled.push(lead);
    rest = candidate;
    if (posPrior.forms[rest]) return { proclitics: peeled, stem: rest };
  }
  return null;
};
var applyProcliticPeel = (text, proclitics, posPrior) => text.replace(/[\p{L}\p{N}']+/gu, (word) => {
  const peel = peelProclitics(word, proclitics, posPrior);
  return peel ? [...peel.proclitics, peel.stem].join(" ") : word;
});
var DENSE_SCRIPT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
var minWordLength = (w) => DENSE_SCRIPT.test(w) ? 2 : 3;
function heardSurfaces(sentences, { minMentions, minShare, minMembers, nullArm = null, clean, posPrior = null, classifyWord: classifyWord2 = null, dominantClass: dominantClass2 = null, classShare = GRAMMAR_MIN_SHARE, proclitics = null, index = null, segment = null } = {}) {
  for (const [k, v] of Object.entries({ minMentions, minShare, minMembers }))
    if (!Number.isFinite(v)) throw new Error(`heardSurfaces: ${k} must be declared`);
  const gated = posPrior && classifyWord2 && dominantClass2;
  const procliticSet = proclitics ? new Set(proclitics) : null;
  const heard = (sentences ?? []).map((s) => {
    let lower = String(s?.text ?? s ?? "").toLowerCase();
    if (segment) lower = segment(lower);
    return { text: procliticSet && posPrior ? applyProcliticPeel(lower, procliticSet, posPrior) : lower };
  });
  let counts, sentenceCounts, company;
  if (index && index.schema === "EOCompanyIndex@1") {
    if (nullArm) throw new TypeError("heardSurfaces: the null arm shuffles sentences \u2014 omit `index` when declaring nullArm");
    for (let i = index.size; i < heard.length; i += 1) index.add(heard[i]);
    counts = index.counts;
    sentenceCounts = index.sentenceCounts;
    company = index;
  } else {
    counts = /* @__PURE__ */ new Map();
    sentenceCounts = /* @__PURE__ */ new Map();
    for (const s of heard) {
      const seen = /* @__PURE__ */ new Set();
      for (const w of s.text.split(/[^\p{L}\p{N}']+/u)) {
        if (w.length < minWordLength(w)) continue;
        counts.set(w, (counts.get(w) ?? 0) + 1);
        if (!seen.has(w)) {
          seen.add(w);
          sentenceCounts.set(w, (sentenceCounts.get(w) ?? 0) + 1);
        }
      }
    }
    company = heard;
  }
  const vocabulary = [...counts.entries()].filter(([, n]) => n >= minMentions).map(([w]) => w);
  if (!vocabulary.length) return [];
  const kinds = discoverCompanyKinds(company, vocabulary, { minMentions, minShare, minMembers, nullArm, clean });
  const beings = /* @__PURE__ */ new Set();
  for (const kind of kinds) if (isPositionallySigned(kind)) for (const m of kind.members) beings.add(m);
  const settledNonNaming = (form) => {
    const d = dominantClass2(classifyWord2(form, { posPrior }), { minShare: classShare });
    return d && d.upos ? !NAMING_CLASSES.has(d.upos) : false;
  };
  const refuse = (word) => {
    if (!gated) return false;
    if (settledNonNaming(word)) return true;
    const clitic = word.indexOf("'");
    if (clitic > 0 && settledNonNaming(word.slice(0, clitic))) return true;
    return false;
  };
  return [...beings].filter((surface) => !refuse(surface)).map((surface) => ({ surface, mentions: counts.get(surface) ?? 0, sentences: sentenceCounts.get(surface) ?? 0 })).sort((a, b) => b.mentions - a.mentions);
}

// native/organs/company-index.js
var DEFAULT_CLEAN = (t) => t.replace(/^[^\p{L}]+|[^\p{L}'’]+$/gu, "");
var DEFAULT_COUNT_SPLIT = /[^\p{L}\p{N}']+/u;
var DENSE_SCRIPT2 = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
function createCompanyIndex({ clean = DEFAULT_CLEAN, countSplit = DEFAULT_COUNT_SPLIT, minCountLength = 3 } = {}) {
  const words2 = [];
  const byWord = /* @__PURE__ */ new Map();
  const counts = /* @__PURE__ */ new Map();
  const sentenceCounts = /* @__PURE__ */ new Map();
  const single = /* @__PURE__ */ new Map();
  const add = (sentence) => {
    const text = String(sentence?.text ?? sentence ?? "");
    const idx = words2.length;
    const ws = text.split(/\s+/).map(clean);
    words2.push(ws);
    ws.forEach((w, i) => {
      if (!w) return;
      if (!byWord.has(w)) byWord.set(w, []);
      byWord.get(w).push([idx, i]);
      if (!single.has(w)) single.set(w, /* @__PURE__ */ new Map());
      const v = single.get(w);
      const before = i > 0 ? ws[i - 1].toLowerCase() : "^";
      const after = i + 1 < ws.length ? ws[i + 1].toLowerCase() : "$";
      v.set(`before=${before}`, (v.get(`before=${before}`) ?? 0) + 1);
      v.set(`after=${after}`, (v.get(`after=${after}`) ?? 0) + 1);
    });
    const seen = /* @__PURE__ */ new Set();
    for (const w of text.split(countSplit)) {
      if (w.length < (DENSE_SCRIPT2.test(w) ? Math.min(2, minCountLength) : minCountLength)) continue;
      counts.set(w, (counts.get(w) ?? 0) + 1);
      if (!seen.has(w)) {
        seen.add(w);
        sentenceCounts.set(w, (sentenceCounts.get(w) ?? 0) + 1);
      }
    }
    return idx;
  };
  const vectors = (surfaces) => {
    const vecs = new Map(surfaces.map((s) => [s, /* @__PURE__ */ new Map()]));
    for (const s of surfaces) {
      const pw = s.split(" ");
      if (pw.length === 1) {
        const v2 = single.get(s);
        if (v2) vecs.set(s, new Map(v2));
        else vecs.delete(s);
        continue;
      }
      const hits = byWord.get(pw[0]);
      if (!hits) continue;
      const v = vecs.get(s);
      for (const [si, i] of hits) {
        const ws = words2[si];
        if (i + pw.length > ws.length) continue;
        let ok = true;
        for (let j = 1; j < pw.length; j++) if (ws[i + j] !== pw[j]) {
          ok = false;
          break;
        }
        if (!ok) continue;
        const before = i > 0 ? ws[i - 1].toLowerCase() : "^";
        const after = i + pw.length < ws.length ? ws[i + pw.length].toLowerCase() : "$";
        v.set(`before=${before}`, (v.get(`before=${before}`) ?? 0) + 1);
        v.set(`after=${after}`, (v.get(`after=${after}`) ?? 0) + 1);
      }
    }
    for (const [k, v] of [...vecs]) if (!v.size) vecs.delete(k);
    return vecs;
  };
  return Object.freeze({ schema: "EOCompanyIndex@1", add, vectors, counts, sentenceCounts, get size() {
    return words2.length;
  } });
}

// native/adapters/text/heard-nominals.js
var UNIT = /[\p{L}\p{M}\p{N}'’]+|[^\s\p{L}\p{M}\p{N}]/gu;
var WORDISH = /^[\p{L}\p{M}\p{N}'’]+$/u;
var DENSE_SCRIPT3 = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
var NUMERIC = /^[\p{N}'’]+$/u;
var NAMING = ["NOUN", "PROPN"];
var LOCATOR = /\b(?:https?|ftp):\/\/\S+|\bwww\.\S+|\S+@\S+\.\S+/giu;
var isReduplication = (w) => {
  const cs = [...w];
  return cs.length >= 4 && new Set(cs).size <= 2;
};
var total = (m) => Object.values(m).reduce((a, b) => a + b, 0);
var majorityClass = (counts, minShare) => {
  const t = total(counts);
  if (!t) return null;
  const [upos, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return n / t >= minShare ? upos : null;
};
var neighbourClass = (unit, posPrior, minShare) => {
  if (unit == null) return null;
  if (!WORDISH.test(unit)) return "PUNCT";
  const counts = posPrior.forms[unit];
  if (!counts || total(counts) < 2) return "UNK";
  return majorityClass(counts, minShare) ?? "UNK";
};
var normalise = (dist) => {
  const t = total(dist);
  if (!t) return null;
  const out = {};
  for (const [k, v] of Object.entries(dist)) out[k] = v / t;
  return out;
};
function frameDistribution(framePrior, p, n) {
  const f = framePrior?.frames;
  if (!f) return null;
  for (const key of [`${p}|${n}`, `${p}|*`, `*|${n}`, "*|*"]) if (f[key]) return { dist: normalise(f[key]), key };
  return null;
}
function classAt(unit, prev, next, { posPrior, framePrior = null, minShare = 0.5 }) {
  let counts = posPrior.forms[unit];
  const apos = unit.search(/['’]/);
  if (!counts && apos > 0) {
    const stem = unit.slice(0, apos);
    counts = posPrior.forms[stem] ?? (stem.endsWith("n") ? posPrior.forms[stem.slice(0, -1)] : void 0);
  }
  const p = prev == null ? "^" : neighbourClass(prev, posPrior, minShare);
  const n = next == null ? "$" : neighbourClass(next, posPrior, minShare);
  const frame = framePrior ? frameDistribution(framePrior, p, n) : null;
  if (counts && total(counts) >= 1 && (counts.X ?? 0) / total(counts) >= 0.5) counts = void 0;
  if (counts && total(counts) >= 1) {
    const own = normalise(counts);
    const settled = Math.max(...Object.values(own)) >= 0.8;
    if (settled || !frame) return { dist: own, basis: settled ? "attested-settled" : "attested-ambiguous" };
    const marg = normalise(framePrior.marginal ?? {}) ?? {};
    const mix = {};
    for (const [c, pc] of Object.entries(own)) mix[c] = pc * ((frame.dist[c] ?? 1e-3) / (marg[c] ?? 0.01));
    return { dist: normalise(mix), basis: `attested-ambiguous|frame:${frame.key}` };
  }
  if (frame) return { dist: frame.dist, basis: `unseen|frame:${frame.key}` };
  return { dist: null, basis: "unseen|no-frame-prior" };
}
var naming = (dist) => dist ? NAMING.reduce((s, c) => s + (dist[c] ?? 0), 0) : null;
function createNominalIndex({ posPrior = null, framePrior = null, segment = null, peel = null, minShare = 0.5, commonNouns = true } = {}) {
  const stats = /* @__PURE__ */ new Map();
  const pairs = /* @__PURE__ */ new Map();
  const admitted = (w) => w.length >= (DENSE_SCRIPT3.test(w) ? 2 : 3) && !NUMERIC.test(w);
  let size = 0;
  const add = (s) => {
    const si = size++;
    if (!posPrior?.forms) return;
    let text = String(s?.text ?? s ?? "").toLowerCase().replace(LOCATOR, " ");
    if (segment) text = segment(text);
    if (peel) text = peel(text);
    const units = text.match(UNIT) ?? [];
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (!WORDISH.test(u) || !admitted(u) || isReduplication(u)) continue;
      const { dist, basis } = classAt(u, units[i - 1], units[i + 1], { posPrior, framePrior, minShare });
      const mass = naming(dist);
      if (mass == null) continue;
      const st = stats.get(u) ?? { n: 0, sents: /* @__PURE__ */ new Set(), mass: 0, unseen: 0, bases: /* @__PURE__ */ new Map() };
      st.n += 1;
      st.sents.add(si);
      st.mass += mass;
      if (!posPrior.forms[u]) st.unseen += 1;
      const b = basis.split("|")[0];
      st.bases.set(b, (st.bases.get(b) ?? 0) + 1);
      stats.set(u, st);
    }
    for (let i = 0; i + 1 < units.length; i++) {
      const a = units[i], b = units[i + 1];
      if (!WORDISH.test(a) || !WORDISH.test(b) || !admitted(a) || !admitted(b)) continue;
      const key = `${a} ${b}`;
      const pr = pairs.get(key) ?? { n: 0, sents: /* @__PURE__ */ new Set() };
      pr.n += 1;
      pr.sents.add(si);
      pairs.set(key, pr);
    }
  };
  const settledCommon = (w) => {
    const c = posPrior.forms[w];
    if (!c) return false;
    const t = total(c);
    return t >= 3 && (c.NOUN ?? 0) / t >= 0.7;
  };
  const beings = ({ minMentions = 2, nameShare = 0.5, compounds = true } = {}) => {
    if (!Number.isFinite(minMentions)) throw new Error("heardNominals: minMentions must be declared");
    const out = [];
    const kept = /* @__PURE__ */ new Map();
    for (const [w, st] of stats) {
      if (st.n < minMentions) continue;
      if (!commonNouns && settledCommon(w)) continue;
      const share = st.mass / st.n;
      if (share < nameShare) continue;
      kept.set(w, { surface: w, mentions: st.n, sentences: st.sents.size, namingShare: Number(share.toFixed(3)), unseen: st.unseen, basis: [...st.bases.keys()].join("+") });
    }
    out.push(...kept.values());
    if (compounds) {
      const commonNoun = (w) => {
        const c = posPrior.forms[w];
        if (!c) return false;
        const t = total(c);
        return t >= 3 && (c.NOUN ?? 0) / t >= 0.7;
      };
      for (const [key, pr] of pairs) {
        if (pr.n < minMentions) continue;
        const [a, b] = key.split(" ");
        if (!kept.has(a) || !kept.has(b) || commonNoun(a) || commonNoun(b)) continue;
        out.push({ surface: key, mentions: pr.n, sentences: pr.sents.size, namingShare: Math.min(kept.get(a).namingShare, kept.get(b).namingShare), unseen: Math.min(kept.get(a).unseen, kept.get(b).unseen), basis: "compound" });
      }
    }
    return out.sort((x, y) => y.mentions - x.mentions);
  };
  return { add, beings, get size() {
    return size;
  } };
}

// native/adapters/text/script-segment.js
var UNSPACED = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;
var KATAKANA_RUN = /^[\p{Script=Katakana}ー]+$/u;
var RUN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}ー々〆]+/gu;
var isUnspacedScript = (s) => UNSPACED.test(String(s ?? ""));
var UNSPACED_PRIORS = /* @__PURE__ */ new WeakMap();
function priorIsUnspaced(posPrior, { share = 0.5 } = {}) {
  const memo = posPrior && typeof posPrior === "object" ? UNSPACED_PRIORS.get(posPrior) ?? UNSPACED_PRIORS.set(posPrior, /* @__PURE__ */ new Map()).get(posPrior) : null;
  if (memo?.has(share)) return memo.get(share);
  const forms = Object.keys(posPrior?.forms ?? {});
  let out = false;
  if (forms.length >= 100) {
    let n = 0;
    for (const f of forms) if (isUnspacedScript(f)) n += 1;
    out = n / forms.length >= share;
  }
  memo?.set(share, out);
  return out;
}
var SEGMENTERS = /* @__PURE__ */ new WeakMap();
function makeSegmenter(posPrior) {
  if (posPrior && typeof posPrior === "object" && SEGMENTERS.has(posPrior)) return SEGMENTERS.get(posPrior);
  const seg = buildSegmenter(posPrior);
  if (posPrior && typeof posPrior === "object") SEGMENTERS.set(posPrior, seg);
  return seg;
}
function buildSegmenter(posPrior) {
  if (!priorIsUnspaced(posPrior)) return null;
  const lex = /* @__PURE__ */ new Set();
  let maxLen = 1;
  for (const f of Object.keys(posPrior.forms)) {
    if (!isUnspacedScript(f) || /[^\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}ー々〆]/u.test(f)) continue;
    lex.add(f);
    if ([...f].length > maxLen) maxLen = [...f].length;
  }
  maxLen = Math.min(maxLen, 8);
  const FRAGMENT_MAX = 5;
  const mergeable = (w) => {
    const c = posPrior.forms[w];
    if (!c) return true;
    const total2 = Object.values(c).reduce((x, y) => x + y, 0);
    if (total2 >= FRAGMENT_MAX) return false;
    const naming2 = (c.NOUN ?? 0) + (c.PROPN ?? 0);
    return total2 < 2 || naming2 / total2 > 0.2;
  };
  const segmentRun = (run) => {
    if (KATAKANA_RUN.test(run)) return [run];
    const cs = [...run];
    const n = cs.length;
    const best = new Array(n + 1).fill(-Infinity);
    const back = new Array(n + 1).fill(0);
    best[0] = 0;
    for (let i = 1; i <= n; i++) {
      if (best[i - 1] > best[i]) {
        best[i] = best[i - 1];
        back[i] = i - 1;
      }
      for (let l = 1; l <= Math.min(maxLen, i); l++) {
        const w = cs.slice(i - l, i).join("");
        if (!lex.has(w)) continue;
        const sc = best[i - l] + l * l;
        if (sc > best[i] || sc === best[i] && back[i] < i - l) {
          best[i] = sc;
          back[i] = i - l;
        }
      }
    }
    const pieces = [];
    for (let i = n; i > 0; i = back[i]) pieces.push(cs.slice(back[i], i).join(""));
    pieces.reverse();
    const out = [];
    let open = null;
    const flush = () => {
      if (open !== null) {
        out.push(open);
        open = null;
      }
    };
    for (const p of pieces) {
      const frag = [...p].length === 1 && mergeable(p);
      if (frag) {
        open = (open ?? "") + p;
        continue;
      }
      flush();
      out.push(p);
    }
    flush();
    return out;
  };
  const alreadySpaced = (text) => {
    return (text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}] [\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu) ?? []).length >= 2;
  };
  return function segment(text) {
    if (alreadySpaced(String(text ?? ""))) return String(text ?? "");
    return String(text ?? "").replace(RUN, (run) => ` ${segmentRun(run).join(" ")} `).replace(/ {2,}/g, " ").trim();
  };
}

// native/adapters/text/ear.js
var WORD = /[\p{L}\p{M}\p{N}']+/gu;
var WORD_APOS = /[\p{L}\p{M}\p{N}'’]+/gu;
var straight = (w) => w.replace(/’/g, "'");
var topClass = (counts) => Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
var ENCLITIC_DEPTH = 2;
var WHOLE_WORD_FLOOR = 3;
function applyAffixes(word, rules) {
  return affixPeel(word, rules)?.parts ?? null;
}
function affixPeel(word, { prefixes = [], suffixes = [], posPrior = null } = {}) {
  const w = straight(word), lw = w.toLowerCase();
  const whole = posPrior?.forms?.[lw];
  if (whole && Object.values(whole).reduce((a, b) => a + b, 0) >= WHOLE_WORD_FLOOR) return null;
  let head = null, rest = lw, tail = null;
  for (const p of prefixes) if (lw.length > p.affix.length && lw.startsWith(p.affix)) {
    head = p.affix;
    rest = lw.slice(p.affix.length);
    break;
  }
  for (const x of suffixes) {
    if (rest.length <= x.affix.length || !rest.endsWith(x.affix)) continue;
    const stem = rest.slice(0, -x.affix.length);
    const c = posPrior?.forms?.[stem];
    if (c) {
      if (!x.hosts?.includes(topClass(c))) continue;
    } else if (!x.marked) continue;
    tail = x.affix;
    rest = stem;
    break;
  }
  if (!head && !tail) return null;
  const parts = [];
  let at = 0;
  if (head) {
    const comps = prefixes.find((p) => p.affix === head)?.comps;
    if (comps) {
      const cap = /^\p{Lu}/u.test(w);
      comps.forEach((c, i) => parts.push(cap && i === 0 ? c[0].toUpperCase() + c.slice(1) : c));
    } else parts.push(w.slice(0, head.length));
    at = head.length;
  }
  parts.push(w.slice(at, w.length - (tail ? tail.length : 0)));
  if (tail) parts.push(w.slice(w.length - tail.length));
  return { parts, head, tail };
}
function makeEar({ posPrior = null, proclitics = null, enclitics = null, contractions = null } = {}) {
  const splits = contractions?.splits ?? null;
  const rules = contractions ? {
    prefixes: [...contractions.prefixes ?? []].sort((a, b) => b.affix.length - a.affix.length),
    suffixes: [...contractions.suffixes ?? []].sort((a, b) => b.affix.length - a.affix.length),
    posPrior
  } : null;
  const hasAffixRules = Boolean(rules && (rules.prefixes.length || rules.suffixes.length));
  const splitWhole = (word) => {
    const lw = straight(word).toLowerCase();
    const comps = splits && Object.hasOwn(splits, lw) ? splits[lw] : null;
    if (!comps) return null;
    if (comps.join("") === lw) {
      let at = 0;
      return comps.map((c) => {
        const part = straight(word).slice(at, at + c.length);
        at += c.length;
        return part;
      });
    }
    const cap = /^\p{Lu}/u.test(word);
    return comps.map((c, i) => cap && i === 0 ? c[0].toUpperCase() + c.slice(1) : c);
  };
  const set = proclitics ? new Set(proclitics) : null;
  const enc = enclitics && enclitics.length ? [...new Set(enclitics)].sort((a, b) => b.length - a.length) : null;
  const total2 = (c) => Object.values(c).reduce((x, y) => x + y, 0);
  const peelEnclitics = (word) => {
    if (!enc || !posPrior?.forms) return null;
    const whole = posPrior.forms[word];
    if (whole && total2(whole) >= WHOLE_WORD_FLOOR) return null;
    let rest = word;
    const tail = [];
    for (let d = 0; d < ENCLITIC_DEPTH; d++) {
      const e = enc.find((x) => rest.length > x.length && rest.endsWith(x));
      if (!e) break;
      tail.unshift(e);
      rest = rest.slice(0, -e.length);
      if (posPrior.forms[rest]) return { stem: rest, enclitics: tail };
    }
    return null;
  };
  const segment = posPrior ? makeSegmenter(posPrior) : null;
  const hasPro = Boolean(set && set.size && posPrior);
  const peel = hasPro || enc || splits || hasAffixRules ? (text) => text.replace(splits || hasAffixRules ? WORD_APOS : WORD, (word) => {
    const whole = splits ? splitWhole(word) : null;
    if (whole) return whole.join(" ");
    if (hasPro) {
      const hit = peelProclitics(word, set, posPrior);
      if (hit) return [...hit.proclitics, hit.stem].join(" ");
    }
    const e = peelEnclitics(word);
    if (e) return [e.stem, ...e.enclitics].join(" ");
    const a = hasAffixRules ? applyAffixes(word, rules) : null;
    return a ? a.join(" ") : word;
  }) : null;
  return Object.freeze({ segment, peel, proclitics: set, enclitics: enc ? new Set(enc) : null });
}

// native/adapters/text/script-floor.js
var DENSE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
var ABJAD = /[\p{Script=Arabic}\p{Script=Hebrew}]/u;
var wordFloor = (w, base) => DENSE.test(w) ? Math.min(base, 2) : ABJAD.test(w) ? Math.min(base, 3) : base;

// native/adapters/text/clause-spans.js
var WORD2 = /[\p{L}\p{N}']+/gu;
var RELATIVIZERS = new Set(INTERROGATIVE_PRONOUNS.keys());
function clauseSpans(text, opts = {}) {
  const s = String(text ?? "");
  const coordinators = opts.coordinators ?? CLAUSE_COORDINATORS;
  const subordinators = opts.subordinators ?? SUBORDINATING_CONJUNCTIONS;
  const relativizers = opts.relativizers ?? RELATIVIZERS;
  const subjectPronouns = opts.subjectPronouns ?? SUBJECT_PRONOUNS;
  const posPrior = opts.posPrior ?? null;
  const rows2 = opts.rows ?? null;
  if (!s.trim()) return [];
  const tokens2 = [...s.matchAll(WORD2)].map((m) => ({ tok: m[0], lower: m[0].toLowerCase(), start: m.index, end: m.index + m[0].length }));
  if (!tokens2.length) return [{ start: 0, end: s.length, text: s, parentIndex: null, relation: "root" }];
  const byId = rows2 ? new Map(rows2.map((r) => [r.id, r])) : null;
  const rowAt = (t) => rows2 ? rows2.find((r) => r.at >= t.start && r.at < t.end) ?? null : null;
  const tagOf = (t) => {
    const e = posPrior?.forms?.[t.lower];
    return e ? dominant(e) : null;
  };
  const isPred = (t) => {
    if (rows2) {
      const r = rowAt(t);
      return !!r && (r.upos === "VERB" || r.upos === "AUX");
    }
    if (posPrior) {
      const d = tagOf(t);
      return d === "VERB" || d === "AUX";
    }
    return null;
  };
  const known = !!(rows2 || posPrior);
  const anyPred = (ts) => known ? ts.some((t) => isPred(t)) : true;
  const quoted = [];
  if (opts.opaqueQuotes) for (const m of s.matchAll(/“[^”]*”|"[^"]*"|«[^»]*»/g)) quoted.push([m.index, m.index + m[0].length]);
  const inQuote = (at) => quoted.some(([a, b]) => at > a && at < b - 1);
  const clausal = (deprel) => /^(advcl|acl)/.test(deprel ?? "");
  const COMPLEMENT = /^(ccomp|csubj|xcomp)/;
  const subordinatorHere = (t) => {
    const listed = subordinators.has(t.lower) || relativizers.has(t.lower);
    if (!rows2) return listed;
    const r = rowAt(t);
    if (!r) return false;
    const head = byId.get(r.head);
    if (head && COMPLEMENT.test(head.deprel)) return false;
    const parseSays = r.upos === "SCONJ" || /PronType=(Rel|Int)/.test(r.feats ?? "") || r.deprel === "mark" && head && clausal(head.deprel);
    if (t.lower === "that") return r.deprel === "mark" && !!head && clausal(head.deprel) || /PronType=Rel/.test(r.feats ?? "");
    return listed ? parseSays && r.upos !== "ADP" : parseSays && (r.upos === "SCONJ" || r.deprel === "mark");
  };
  const fronted = [];
  let segStart = 0;
  for (; ; ) {
    let comma = -1;
    for (let k = segStart; k < s.length; k += 1) if (s[k] === "," && !inQuote(k)) {
      comma = k;
      break;
    }
    if (comma < 0) break;
    const seg = tokens2.filter((t) => t.start >= segStart && t.start < comma);
    const rest = tokens2.filter((t) => t.start > comma);
    if (!seg.length || !rest.length || !anyPred(rest)) break;
    const opener = fronted.length && coordinators.has(seg[0].lower) && seg[1] ? seg[1] : seg[0];
    let kind = null;
    if (subordinatorHere(opener) || rows2 && subordinators.has(opener.lower) && rowAt(opener)?.deprel === "mark") kind = "subordinate";
    else if (known && !seg.some((t) => isPred(t))) {
      const subjOfRest = rows2 && seg.some((t) => {
        const r = rowAt(t);
        return r && /^(nsubj|csubj|expl)/.test(r.deprel) && rest.some((x) => rowAt(x)?.id === r.head);
      });
      const d = rows2 ? rowAt(opener)?.upos : tagOf(opener);
      const adjunctOpener = d === "ADP" || d === "ADV" || d === "NUM" || d === "SCONJ" || /^\d/.test(opener.tok);
      if (rows2 ? !subjOfRest : adjunctOpener) kind = "adjunct";
    }
    if (!kind) break;
    const last = fronted[fronted.length - 1];
    const from = (fronted.length && coordinators.has(seg[0].lower) ? seg[1] ?? seg[0] : seg[0]).start;
    if (last && last.relation === "adjunct" && kind === "adjunct") last.end = comma;
    else fronted.push({ start: from, end: comma, relation: kind });
    segStart = comma + 1;
  }
  const mainFrom = segStart;
  const mainTokens = tokens2.filter((t) => t.start >= mainFrom);
  if (!mainTokens.length) return [{ start: 0, end: s.length, text: s, parentIndex: null, relation: "root" }];
  const boundaries = [];
  for (let i = mainFrom; i < s.length; i += 1) {
    if (inQuote(i)) continue;
    if (s[i] === ";") boundaries.push({ at: i + 1, relation: "coordinate" });
    else if (s[i] === ":") boundaries.push({ at: i + 1, relation: "elaborates" });
  }
  for (let i = 0; i < mainTokens.length; i += 1) {
    const t = mainTokens[i];
    if (inQuote(t.start)) continue;
    const before = s.slice(mainFrom, t.start);
    const afterComma = /,\s*$/.test(before);
    if (coordinators.has(t.lower) && i + 1 < mainTokens.length && subjectPronouns.has(mainTokens[i + 1].lower) && (!rows2 || /^(nsubj|expl)/.test(rowAt(mainTokens[i + 1])?.deprel ?? ""))) {
      boundaries.push({ at: t.start, relation: "coordinate" });
    } else if (coordinators.has(t.lower) && known && i > 0) {
      const nextComma = mainTokens.findIndex((x, k) => k > i && /,\s*$/.test(s.slice(mainFrom, x.start)) && x.start > t.end);
      const right = mainTokens.slice(i + 1, nextComma < 0 ? mainTokens.length : nextComma);
      const lastCut = boundaries.length ? boundaries[boundaries.length - 1].at : mainFrom;
      const left = mainTokens.slice(0, i).filter((x) => x.start >= lastCut);
      const r = rowAt(t), head = r && byId.get(r.head);
      const ccOfPred = !!(head && (head.upos === "VERB" || head.upos === "AUX") && /^conj/.test(head.deprel));
      if ((afterComma || ccOfPred) && anyPred(left) && anyPred(right)) boundaries.push({ at: t.start, relation: "coordinate" });
    } else if (i > 0 && (subordinatorHere(t) || afterComma && rows2 && /PronType=Rel/.test(rowAt(t)?.feats ?? ""))) {
      const r = rowAt(t);
      const rel = relativizers.has(t.lower) || /PronType=Rel/.test(r?.feats ?? "") ? "relative" : "subordinate";
      if (!rows2 || afterComma || r?.deprel === "mark" && clausal(byId.get(r.head)?.deprel) || /PronType=Rel/.test(r?.feats ?? "")) boundaries.push({ at: t.start, relation: rel });
    }
  }
  boundaries.sort((a, b) => a.at - b.at);
  const cuts = [];
  for (const b of boundaries) {
    if (b.at <= mainFrom) continue;
    if (cuts.length && cuts[cuts.length - 1].at === b.at) continue;
    cuts.push(b);
  }
  const trimmed = (rawStart, rawEnd) => {
    const raw = s.slice(rawStart, rawEnd);
    const clauseText = raw.trim();
    if (!clauseText) return null;
    return { start: rawStart + (raw.length - raw.trimStart().length), end: rawEnd - (raw.length - raw.trimEnd().length), text: clauseText };
  };
  const out = [];
  for (const f of fronted) {
    const sp = trimmed(f.start, f.end);
    if (sp) out.push({ ...sp, parentIndex: null, relation: f.relation, fronted: true });
  }
  const rootIndex = out.length;
  const bounds = [mainFrom, ...cuts.map((c) => c.at), s.length];
  for (let i = 0; i < bounds.length - 1; i += 1) {
    const sp = trimmed(bounds[i], bounds[i + 1]);
    if (!sp) continue;
    const isRoot = out.length === rootIndex;
    const relation = isRoot ? "root" : cuts[i - 1].relation;
    const parentIndex = isRoot ? null : relation === "elaborates" ? out.length - 1 : rootIndex;
    out.push({ ...sp, parentIndex, relation });
  }
  for (const o of out) if (o.fronted) o.parentIndex = out.length > rootIndex ? rootIndex : null;
  return out.length ? out : [{ start: 0, end: s.length, text: s, parentIndex: null, relation: "root" }];
}
var dominant = (tags) => {
  const entries = Object.entries(tags ?? {});
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0];
};

// native/adapters/text/relations-gfp.js
var FUNCTION_CLASSES = /* @__PURE__ */ new Set(["ADP", "CCONJ", "SCONJ", "DET", "PRON", "AUX", "PART", "INTJ", "NUM", "PUNCT", "SYM", "X"]);
var WORD3 = /[\p{L}\p{N}]+/gu;
var MAX_ADJACENCY = 200;
var MAX_LABEL = 40;
var dominant2 = (tags) => {
  const entries = Object.entries(tags ?? {});
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0];
};
function extractGfpRelations(text, { posPrior = null, functionWords = null, minRec = 2, figures = null, clauseAware = false } = {}) {
  text = hear(text);
  const typer = posPrior ? makeGrainTyper(posPrior) : null;
  const isFunction = (tok) => {
    if (functionWords?.has(tok.toLowerCase())) return true;
    if (!posPrior) return false;
    const e = posPrior.forms?.[tok.toLowerCase()];
    return e ? FUNCTION_CLASSES.has(dominant2(e)) : false;
  };
  const tokens2 = [...String(text ?? "").matchAll(WORD3)].map((m) => ({ tok: m[0], start: m.index, end: m.index + m[0].length }));
  const clauseWindows = clauseAware ? splitSentences(String(text ?? "")).flatMap((sent) => clauseSpans(sent.text).map((c) => ({ start: sent.offset + c.start, end: sent.offset + c.end }))) : null;
  const sameClause = (a, b) => !clauseWindows || clauseWindows.some((w) => a >= w.start && a < w.end && b >= w.start && b < w.end);
  const counts = /* @__PURE__ */ new Map();
  for (const { tok } of tokens2) counts.set(tok.toLowerCase(), (counts.get(tok.toLowerCase()) ?? 0) + 1);
  const figureSet = figures ?? new Set(
    [...counts.entries()].filter(([t, c]) => c >= minRec && t.length >= wordFloor(t, 3) && !isFunction(t)).map(([t]) => t)
  );
  if (figureSet.size === 0) return [];
  const singleWordFigures = /* @__PURE__ */ new Set();
  const multiWordFigures = /* @__PURE__ */ new Map();
  for (const f of figureSet) {
    const words2 = String(f).split(/\s+/).filter(Boolean);
    if (words2.length <= 1) {
      if (words2[0]) singleWordFigures.add(words2[0]);
      continue;
    }
    const first = words2[0];
    if (!multiWordFigures.has(first)) multiWordFigures.set(first, []);
    multiWordFigures.get(first).push(words2);
  }
  for (const arr of multiWordFigures.values()) arr.sort((a, b) => b.length - a.length);
  const mentions = [];
  for (let i = 0; i < tokens2.length; ) {
    const lower = tokens2[i].tok.toLowerCase();
    let matchLen = 0;
    for (const words2 of multiWordFigures.get(lower) ?? []) {
      if (i + words2.length > tokens2.length) continue;
      if (words2.every((w, k) => tokens2[i + k].tok.toLowerCase() === w)) {
        matchLen = words2.length;
        break;
      }
    }
    if (matchLen > 0) {
      mentions.push({ tok: tokens2.slice(i, i + matchLen).map((t) => t.tok).join(" "), start: tokens2[i].start, end: tokens2[i + matchLen - 1].end });
      i += matchLen;
    } else {
      if (singleWordFigures.has(lower)) mentions.push(tokens2[i]);
      i += 1;
    }
  }
  if (mentions.length < 2) return [];
  const out = [];
  for (let i = 0; i < mentions.length - 1; i += 1) {
    const f1 = mentions[i];
    const f2 = mentions[i + 1];
    if (f2.start - f1.end > MAX_ADJACENCY) continue;
    if (clauseAware && !sameClause(f1.start, f2.start)) continue;
    const label = String(text).slice(f1.end, f2.start).replace(/\s+/g, " ").trim();
    if (!label || label.length > MAX_LABEL) continue;
    if (label === f2.tok) continue;
    const headToken = String(label).split(/[^-\p{L}\p{N}]+/u).filter(Boolean)[0];
    const grain = typer && headToken ? typer.grainOf(headToken) : null;
    const cell = typer ? cellLabelOf(grain) : "grain_gap";
    out.push({
      end1: f1.tok,
      label,
      end2: f2.tok,
      cell,
      grain: grain && !grain.grain_gap ? { operator: grain.op, grain: grain.grain, terrain: grain.terrain, stance: grain.stance, settledAs: grain.settledAs } : grain?.grain_gap ? { grain_gap: grain.grain_gap, settledAs: null } : null,
      polarity: "+",
      // polarity is a language-specific lens (negation class); GFP leaves it unmeasured rather than guessing
      offset: f1.end
    });
  }
  const seen = /* @__PURE__ */ new Set();
  const unique = [];
  for (const a of out) {
    const k = `${a.end1}|${a.label.slice(0, 12)}|${a.end2}`;
    if (!seen.has(k)) {
      seen.add(k);
      unique.push(a);
    }
  }
  return unique;
}
function discoverGfpVocabulary(text, { figures = null, minRec = null, minSurfaces = null, posPrior = null, functionWords = null } = {}) {
  text = hear(text);
  const floor = minRec ?? minSurfaces ?? 2;
  const isFunction = (tok) => {
    if (functionWords?.has(tok.toLowerCase())) return true;
    if (!posPrior) return false;
    const e = posPrior.forms?.[tok.toLowerCase()];
    return e ? FUNCTION_CLASSES.has(dominant2(e)) : false;
  };
  const counts = /* @__PURE__ */ new Map();
  for (const m of String(text ?? "").matchAll(WORD3)) {
    const t = m[0].toLowerCase();
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const verbs = /* @__PURE__ */ new Set();
  const candidates = [];
  if (figures) {
    for (const f of figures) candidates.push({ verb: f, surfaceForms: [f], verbDominant: true });
  } else {
    for (const [t, c] of counts) {
      if (c >= floor && t.length >= wordFloor(t, 3) && !isFunction(t)) candidates.push({ verb: t, surfaceForms: [t], verbDominant: true });
    }
  }
  return { verbs, candidates };
}

// native/adapters/text/relations-positional.js
var NOMINAL_CLASSES = Object.freeze(/* @__PURE__ */ new Set(["NOUN", "PROPN"]));
var VERB_LIKE = Object.freeze(/* @__PURE__ */ new Set(["VERB", "AUX"]));
var stripPunct = (w) => w.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
function isHeadOfPhraseUpos(prevUpos) {
  return prevUpos !== "ADP" && prevUpos !== "NOUN" && prevUpos !== "PROPN";
}
function extractPositionalRelation(text, { roleConfig, posPrior, classifyWord: classifyWord2, dominantClass: dominantClass2, classShare = GRAMMAR_MIN_SHARE, proclitics = null, phrasalPredicates = false, auxiliaryVerbs = null, verbForms = null, subjectPronouns = null, nominalForms = null, chainBridge = null } = {}) {
  if (!roleConfig) throw new Error("extractPositionalRelation: roleConfig must be supplied");
  if (!posPrior || !classifyWord2 || !dominantClass2) throw new Error("extractPositionalRelation: posPrior, classifyWord and dominantClass must all be supplied");
  if (phrasalPredicates && !auxiliaryVerbs) throw new Error("extractPositionalRelation: phrasalPredicates requires auxiliaryVerbs \u2014 the received closed class it collapses, never guessed");
  const peel = (w) => {
    if (!proclitics) return w;
    const p = peelProclitics(w, proclitics, posPrior);
    return p ? p.stem : w;
  };
  const rawWords = String(text ?? "").split(/\s+/).map(stripPunct).filter(Boolean);
  const words2 = rawWords.map((w) => ({ raw: w, stem: peel(w) }));
  const classOf = (stem) => dominantClass2(classifyWord2(stem, { posPrior }), { minShare: classShare });
  const lexClassOf = (stem) => {
    const lower = stem.toLowerCase();
    if (verbForms?.has(lower)) return { upos: "VERB", count: 0, share: 1, thraxClass: null, fromLexicon: true };
    if (nominalForms?.has(lower)) return { upos: "NOUN", count: 0, share: 1, thraxClass: null, fromLexicon: true };
    return classOf(stem);
  };
  const classified = words2.map((w) => verbForms || nominalForms ? lexClassOf(w.stem) : classOf(w.stem));
  let verbLikeIdx = words2.map((w, i) => ({ i, w, c: classified[i] })).filter((x) => VERB_LIKE.has(x.c?.upos));
  let verbCandidates = verbLikeIdx;
  if (phrasalPredicates && verbLikeIdx.length > 1) {
    const MAX_AUX_HOPS = 4;
    const bridgedGap = (fromI, toI) => {
      if (!chainBridge || toI <= fromI + 1) return false;
      for (let p = fromI + 1; p < toI; p += 1) if (!chainBridge.has(words2[p]?.stem?.toLowerCase())) return false;
      return true;
    };
    const collapsed = [];
    let k = 0;
    while (k < verbLikeIdx.length) {
      let j = k;
      while (j + 1 < verbLikeIdx.length && j - k < MAX_AUX_HOPS && // an ordinary adjacent auxiliary/modal step (unchanged)
      (verbLikeIdx[j + 1].i === verbLikeIdx[j].i + 1 && auxiliaryVerbs.has(verbLikeIdx[j].w.stem.toLowerCase()) || bridgedGap(verbLikeIdx[j].i, verbLikeIdx[j + 1].i))) j += 1;
      if (j > k) {
        const raw = words2.slice(verbLikeIdx[k].i, verbLikeIdx[j].i + 1).map((w) => w.raw).join(" ");
        collapsed.push({ i: verbLikeIdx[j].i, w: { raw, stem: verbLikeIdx[j].w.stem }, c: verbLikeIdx[j].c });
        k = j + 1;
      } else {
        collapsed.push(verbLikeIdx[k]);
        k += 1;
      }
    }
    verbCandidates = collapsed;
  }
  if (verbCandidates.length === 0) return { end1: null, label: null, end2: null, gap: { reason: "no_verb_found" } };
  if (verbCandidates.length > 1) return { end1: null, label: null, end2: null, gap: { reason: "ambiguous_verb", candidates: verbCandidates.map((c) => c.w.raw) } };
  const verb = verbCandidates[0];
  const nominals = words2.map((w, i) => ({ i, w, c: classified[i] })).filter((x) => x.i !== verb.i && (NOMINAL_CLASSES.has(x.c?.upos) || subjectPronouns?.has(x.w.stem.toLowerCase())) && (x.i === 0 || isHeadOfPhraseUpos(classified[x.i - 1]?.upos)));
  const before = nominals.filter((n) => n.i < verb.i);
  const after = nominals.filter((n) => n.i > verb.i);
  const bySide = { before, after };
  const gaps = [];
  let end2 = null;
  if (roleConfig.object.usable !== false && roleConfig.object.dominantSide) {
    let candidates = bySide[roleConfig.object.dominantSide] ?? [];
    if (candidates.length > 1 && roleConfig.object.marker) {
      const markerForm = roleConfig.object.marker.form;
      const markerSide = roleConfig.object.dominantSide === "after" ? -1 : 1;
      const marked = candidates.filter((n) => words2[n.i + markerSide]?.raw === markerForm);
      if (marked.length === 1) candidates = marked;
    }
    if (candidates.length === 1) end2 = candidates[0];
    else if (candidates.length > 1) gaps.push("ambiguous_object");
    else gaps.push("intransitive_or_no_object_found");
  } else {
    gaps.push("object_side_not_usable_for_this_language");
  }
  let end1 = null;
  if (roleConfig.subject.usable !== false && roleConfig.subject.dominantSide) {
    let candidates = (bySide[roleConfig.subject.dominantSide] ?? []).filter((n) => n !== end2);
    if (candidates.length > 1 && roleConfig.subject.marker) {
      const markerForm = roleConfig.subject.marker.form;
      const markerSide = roleConfig.subject.dominantSide === "after" ? -1 : 1;
      const marked = candidates.filter((n) => words2[n.i + markerSide]?.raw === markerForm);
      if (marked.length === 1) candidates = marked;
    }
    if (candidates.length === 1) end1 = candidates[0];
    else if (candidates.length > 1) gaps.push("ambiguous_subject");
    else gaps.push("no_subject_found");
  } else {
    const remaining = nominals.filter((n) => n !== end2);
    if (remaining.length === 1) end1 = remaining[0];
    else if (remaining.length > 1) gaps.push("ambiguous_subject");
    else gaps.push("no_subject_found");
  }
  return {
    end1: end1 ? { word: end1.w.raw, upos: end1.c.upos } : null,
    label: { word: verb.w.raw, upos: verb.c.upos },
    end2: end2 ? { word: end2.w.raw, upos: end2.c.upos } : null,
    gap: gaps.length ? gaps : null
  };
}

// native/adapters/text/relations-language.js
function relationExtractorsFor({ language = null, roleConfig = null, posPrior = null, classifyWord: classifyWord2 = null, dominantClass: dominantClass2 = null, ...extras } = {}) {
  const hasRoleConfig = Boolean(roleConfig) && Boolean(posPrior);
  if (roleConfig && !posPrior) {
    throw new TypeError("relationExtractorsFor: a RoleConfig@1 without a posPrior is a role assignment with no evidence to read \u2014 posPrior is required whenever roleConfig is supplied");
  }
  if (hasRoleConfig) {
    const typer = makeGrainTyper(posPrior);
    const extractRelations2 = (text, opts = {}) => {
      const phrasal = opts.phrasalPredicates && extras.auxiliaryVerbs;
      const r = extractPositionalRelation(text, {
        roleConfig,
        posPrior,
        classifyWord: classifyWord2,
        dominantClass: dominantClass2,
        ...extras.auxiliaryVerbs ? { auxiliaryVerbs: extras.auxiliaryVerbs } : {},
        ...extras.verbForms ? { verbForms: extras.verbForms } : {},
        ...extras.subjectPronouns ? { subjectPronouns: extras.subjectPronouns } : {},
        ...extras.nominalForms ? { nominalForms: extras.nominalForms } : {},
        ...extras.chainBridge ? { chainBridge: extras.chainBridge } : {},
        ...extras.proclitics ? { proclitics: extras.proclitics } : {},
        ...phrasal ? { phrasalPredicates: true } : {}
      });
      if (!r.end1 || !r.label || !r.end2) return [];
      const grain = typer.grainOf(r.label.word);
      return [{
        end1: r.end1.word,
        label: r.label.word,
        end2: r.end2.word,
        cell: grain && !grain.grain_gap ? cellLabelOf(grain) : "CON\xB7Figure (Link)",
        grain: grain && !grain.grain_gap ? { operator: grain.op, grain: grain.grain, terrain: grain.terrain, stance: grain.stance, settledAs: grain.settledAs } : { settledAs: null, grain_gap: "connector unsettled \u2014 kept, never guessed" },
        polarity: "+",
        // a negation class is a language's own lens; unmeasured here, never guessed
        offset: 0
      }];
    };
    const discoverRelationVocab2 = () => ({ verbs: /* @__PURE__ */ new Set(), candidates: [] });
    return { mode: "svo", language, discoverRelationVocab: discoverRelationVocab2, extractRelations: extractRelations2 };
  }
  return {
    mode: "gfp",
    language: language ?? null,
    discoverRelationVocab: discoverGfpVocabulary,
    extractRelations: extractGfpRelations
  };
}

// native/adapters/text/relations.js
var CELL3 = Object.freeze({ op: "CON", grain: "Figure" });
var W = "[\\p{L}\\p{N}_'\u2019]+";
var TOKEN_STRIP = /^[^\p{L}\p{N}'’]+|[^\p{L}\p{N}'’]+$/gu;
var escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
var WCHAR = "[\\p{L}\\p{N}_'\u2019]";
var bWord = (pattern) => `(?<!${WCHAR})(?:${pattern})(?!${WCHAR})`;
var collapseWs = (t) => String(t ?? "").replace(/\s+/g, " ");
var ALT = /* @__PURE__ */ new WeakMap();
var altOf = (forms) => {
  let alt = ALT.get(forms);
  if (alt === void 0) {
    alt = [...forms].map(escapeRe).join("|");
    ALT.set(forms, alt);
  }
  return alt;
};
var NEGATION_RE = /* @__PURE__ */ new WeakMap();
var negationBeforeVerbFor = (words2) => {
  let re = NEGATION_RE.get(words2);
  if (re) return re;
  const isEnglishDefault = words2 === NEGATION_WORDS;
  const guardNot = isEnglishDefault && words2.has("not");
  const alt = (guardNot ? [`not(?!\\s+(?:${altOf(NEGATION_CORRELATIVES)})\\b)`, altOf(new Set([...words2].filter((w) => w !== "not")))] : [altOf(words2)]).join("|").replace(/'/g, "['\u2019]");
  const extra = isEnglishDefault ? "|no longer" : "";
  re = new RegExp(bWord(`${alt}${extra}`), "iu");
  NEGATION_RE.set(words2, re);
  return re;
};
var CLAUSE_OPENER_RE = /* @__PURE__ */ new WeakMap();
var clauseOpenerWallFor = (words2) => {
  let re = CLAUSE_OPENER_RE.get(words2);
  if (re) return re;
  re = new RegExp(bWord(altOf(words2)), "iu");
  CLAUSE_OPENER_RE.set(words2, re);
  return re;
};
var LEADING_WS = /^[ \t\n\r]*/;
var frontedClauseFloor = (s, windowStart, subjEnd, clauseOpeners) => {
  const openerRe = clauseOpenerWallFor(clauseOpeners);
  const lead = LEADING_WS.exec(s.slice(windowStart, subjEnd))[0].length;
  openerRe.lastIndex = 0;
  const openerMatch = openerRe.exec(s.slice(windowStart + lead, subjEnd));
  if (!openerMatch || openerMatch.index !== 0) return windowStart;
  const afterOpener = windowStart + lead + openerMatch[0].length;
  const comma = s.indexOf(",", afterOpener);
  return comma !== -1 && comma < subjEnd ? comma + 1 : windowStart;
};
var MATCHERS = /* @__PURE__ */ new Map();
var matcherFor = (source2, flags) => {
  const key = `${flags}:${source2}`;
  let re = MATCHERS.get(key);
  if (!re) {
    if (MATCHERS.size >= 32) MATCHERS.clear();
    re = new RegExp(source2, flags);
    MATCHERS.set(key, re);
  }
  re.lastIndex = 0;
  return re;
};
var NOISE_RUN = /[^\p{L}\p{N}_'’]+/gu;
var SENTENCE_END = /[.!?;]/g;
var discoverRelationVocab = (text, { surfaces, functionWords = null, minSurfaces, negationWords = NEGATION_WORDS, posPrior = null, verbForms = null, anchorSpans = null, phrasalPredicates = false, auxiliaryVerbs = AUXILIARY_VERBS } = {}) => {
  if (!Number.isInteger(minSurfaces) || minSurfaces < 1)
    throw new TypeError("discoverRelationVocab: minSurfaces is declared \u2014 how much recurrence counts as a pattern is the caller's to say, never a default here");
  const s = String(text ?? "");
  const names = [...surfaces ?? []].map((x) => typeof x === "string" ? x : x?.surface).filter((x) => typeof x === "string" && x.length > 0);
  const uniqueNames = [...new Set(names)].sort((a, b) => b.length - a.length);
  if (!uniqueNames.length && !anchorSpans?.length) return { verbs: /* @__PURE__ */ new Set(), candidates: [] };
  const AFTER = /^\s*(?:[\p{Ps}][^\p{Pe}]*[\p{Pe}]\s*)*([\p{L}\p{N}'’]+)/u;
  const surfacesByToken = /* @__PURE__ */ new Map();
  const MAX_AUX_HOPS = 4;
  const tallyAfter = (afterEnd, anchorId) => {
    let cursor = afterEnd;
    for (let hop = 0; hop <= MAX_AUX_HOPS; hop += 1) {
      const after = s.slice(cursor, cursor + 40).match(AFTER);
      if (!after) return;
      const cleaned = after[1].replace(TOKEN_STRIP, "");
      if (!cleaned) return;
      if (/^\p{Lu}/u.test(cleaned)) return;
      if (/^\p{Nd}+$/u.test(cleaned)) return;
      const lower = cleaned.toLowerCase();
      cursor += after[0].length;
      if (phrasalPredicates && (auxiliaryVerbs.has(lower) || negationWords.has(lower))) {
        if (auxiliaryVerbs.has(lower)) {
          if (!surfacesByToken.has(lower)) surfacesByToken.set(lower, /* @__PURE__ */ new Set());
          surfacesByToken.get(lower).add(anchorId);
        }
        continue;
      }
      if (functionWords && functionWords.has(lower)) return;
      if (negationWords.has(lower)) return;
      if (!surfacesByToken.has(lower)) surfacesByToken.set(lower, /* @__PURE__ */ new Set());
      surfacesByToken.get(lower).add(anchorId);
      return;
    }
  };
  if (uniqueNames.length) {
    const SURFACE_RE = new RegExp(bWord(uniqueNames.map(escapeRe).join("|")), "gu");
    let m;
    while ((m = SURFACE_RE.exec(s)) !== null) tallyAfter(m.index + m[0].length, diaNorm(m[0]));
  }
  for (const span of anchorSpans ?? []) {
    if (!Number.isFinite(span?.index) || !Number.isFinite(span?.length) || !span?.anchor) continue;
    tallyAfter(span.index + span.length, String(span.anchor));
  }
  const verbs = /* @__PURE__ */ new Set();
  const candidates = [];
  for (const [token, seenAfter] of surfacesByToken) {
    const attested = posPrior?.forms?.[token] ?? null;
    const attestedTotal = attested ? Object.values(attested).reduce((sum, count) => sum + count, 0) : 0;
    const verbShare = attestedTotal ? ((attested.VERB ?? 0) + (attested.AUX ?? 0)) / attestedTotal : 0;
    const lexiconKnows = verbForms ? verbForms.has(token) : null;
    const verbDominant = !posPrior ? true : !attested ? lexiconKnows !== false : grammarIsDominant(verbShare);
    const posStanding = !posPrior ? "not_supplied" : !attested ? lexiconKnows === null ? "gap" : lexiconKnows ? "gap_lexicon_admits" : "gap_lexicon_refuses" : verbDominant ? "verb_dominant" : "nonverb_dominant";
    candidates.push({ verb: token, surfaces: seenAfter.size, surfaceForms: Array.from(seenAfter), verbDominant, verbShare, posStanding, upos: attested });
    if (seenAfter.size >= minSurfaces && verbDominant) verbs.add(token);
  }
  candidates.sort((x, y) => y.surfaces - x.surfaces);
  return { verbs, candidates };
};
var WORD_TOKEN = /[\p{L}\p{N}_'’-]+(?:[.,]\d+)*/gu;
function expandSubjectNP(s, anchorStart, anchorEnd, leftBound, closed = {}) {
  const {
    definiteDeterminers = DEFINITE_DETERMINERS,
    indefiniteDeterminers = INDEFINITE_DETERMINERS,
    possessiveDeterminers = POSSESSIVE_DETERMINERS,
    npCoordinators = NP_COORDINATORS,
    auxiliaryVerbs = AUXILIARY_VERBS,
    clauseOpeners = CLAUSE_OPENERS,
    // THE SUBJECT WALLS (2026-09-02, measured on real Dracula prose — see the
    // walk below). All received classes with their giver, or the caller's
    // own vocabulary; `subjectWalls: false` reproduces the earlier walk
    // byte-for-byte, so the two can be measured against each other.
    subjectWalls = true,
    clauseCoordinators = CLAUSE_COORDINATORS,
    subjectPronouns = SUBJECT_PRONOUNS,
    negationWords = null,
    verbs = null,
    // RECEIVED adpositions (a POS prior's ADP-dominant forms): an NP's own
    // determiner may lie further left across one ("every joint IN my body",
    // "the ruins OF the abbey"). Absent, only "of" chains, as before.
    adpositions = null,
    predeterminers = PREDETERMINERS
  } = closed;
  const toks = [];
  WORD_TOKEN.lastIndex = 0;
  let tm;
  while ((tm = WORD_TOKEN.exec(s)) !== null) {
    if (tm.index >= anchorEnd) break;
    const end2 = tm.index + tm[0].length;
    if (end2 > Math.max(0, leftBound)) toks.push({ text: tm[0], start: tm.index, end: end2 });
  }
  let i = toks.findIndex((t) => t.start === anchorStart || t.start < anchorStart && t.end > anchorStart);
  if (i < 0) return null;
  if (!subjectWalls) return legacyWalk(s, toks, i, anchorEnd, { definiteDeterminers, indefiniteDeterminers, possessiveDeterminers, npCoordinators, auxiliaryVerbs, clauseOpeners });
  const low = (t) => t.text.toLowerCase();
  const isDet = (t) => definiteDeterminers.has(low(t)) || indefiniteDeterminers.has(low(t)) || possessiveDeterminers.has(low(t));
  const isCoord = (t) => npCoordinators.has(low(t)) || clauseCoordinators.has(low(t));
  const isWordy = (t) => /[\p{L}\p{N}]/u.test(t.text);
  const isAdp = (t) => low(t) === "of" || (adpositions ? adpositions.has(low(t)) : false);
  const anchorTokIdx = i;
  const anchorEndIdx = toks.length;
  let end = anchorEndIdx;
  const isVerbHere = (k) => verbs && verbs.has(low(toks[k])) && !(k > 0 && isDet(toks[k - 1]));
  while (end > i && (clauseOpeners.has(low(toks[end - 1])) || negationWords && negationWords.has(low(toks[end - 1])) || isVerbHere(end - 1))) end -= 1;
  for (let k = end - 1; k >= i; k -= 1) if (subjectPronouns.has(low(toks[k])) && !(k > 0 && npCoordinators.has(low(toks[k - 1])))) return done(k, k + 1);
  if (end > i && isDet(toks[i])) {
    let left = i;
    while (left > 0 && predeterminers.has(low(toks[left - 1]))) left -= 1;
    if (!(left > 0 && isAdp(toks[left - 1]))) return done(left, end);
    i = left;
  }
  let j = i;
  let sawCoord = toks.slice(i, end).some(isCoord);
  while (j > 0) {
    const prev = toks[j - 1];
    const between = s.slice(prev.end, toks[j].start);
    if (/[^\s.]/u.test(between)) break;
    if (!isWordy(prev)) break;
    const lower = low(prev);
    if (auxiliaryVerbs.has(lower)) return null;
    if (clauseOpeners.has(lower)) break;
    if (subjectPronouns.has(lower)) {
      if (j === end) {
        j -= 1;
      }
      break;
    }
    if (verbs && verbs.has(lower) && !(j - 1 > 0 && isDet(toks[j - 2]))) {
      if (sawCoord) {
        j -= 1;
        end = j;
        sawCoord = false;
        continue;
      }
      break;
    }
    if (isDet(prev)) {
      j -= 1;
      if (j > 0 && isAdp(toks[j - 1]) && !/[,;:]/.test(s.slice(toks[j - 1].end, toks[j].start))) {
        j -= 1;
        continue;
      }
      break;
    }
    if (npCoordinators.has(lower)) {
      if (j - 1 === 0) break;
      sawCoord = true;
      j -= 1;
      continue;
    }
    j -= 1;
  }
  while (j < end && (isCoord(toks[j]) || clauseOpeners.has(low(toks[j])))) j += 1;
  return done(j, end);
  function done(from, to) {
    if (from >= to) return { refused: "no_subject" };
    if (from === anchorTokIdx && to === anchorEndIdx) return null;
    return { subject: collapseWs(s.slice(toks[from].start, toks[to - 1].end)), start: toks[from].start, end: toks[to - 1].end };
  }
}
function legacyWalk(s, toks, i, anchorEnd, { definiteDeterminers, indefiniteDeterminers, possessiveDeterminers, npCoordinators, auxiliaryVerbs, clauseOpeners }) {
  if (i <= 0) return null;
  const anchorTokIdx = i;
  while (i > 0) {
    const prev = toks[i - 1];
    const between = s.slice(prev.end, toks[i].start);
    if (/[^\s.]/u.test(between)) break;
    if (!/[\p{L}\p{N}]/u.test(prev.text)) break;
    const lower = prev.text.toLowerCase();
    if (auxiliaryVerbs.has(lower)) return null;
    if (clauseOpeners.has(lower)) break;
    if (definiteDeterminers.has(lower) || indefiniteDeterminers.has(lower) || possessiveDeterminers.has(lower)) {
      i -= 1;
      if (i > 0 && toks[i - 1].text.toLowerCase() === "of" && !/[,;:]/.test(s.slice(toks[i - 1].end, toks[i].start))) {
        i -= 1;
        continue;
      }
      break;
    }
    if (npCoordinators.has(lower)) {
      if (i - 1 === 0) break;
      i -= 1;
      continue;
    }
    i -= 1;
  }
  while (i < anchorTokIdx && npCoordinators.has(toks[i].text.toLowerCase())) i += 1;
  if (i === anchorTokIdx) return null;
  return { subject: collapseWs(s.slice(toks[i].start, anchorEnd)), start: toks[i].start };
}
var BOUNDARY_CLASSES = Object.freeze(/* @__PURE__ */ new Set(["ADP", "SCONJ", "VERB"]));
var extractRelations = (text, { verbs, limit = Infinity, functionWords = null, negationWords = NEGATION_WORDS, phrasalPredicates = false, auxiliaryVerbs = AUXILIARY_VERBS, nounPhraseSubjects = false, subjectWalls = true, verbWall = null, adpositions = null, subjectPronouns = SUBJECT_PRONOUNS, clauseOpeners = CLAUSE_OPENERS, definiteDeterminers = DEFINITE_DETERMINERS, indefiniteDeterminers = INDEFINITE_DETERMINERS, possessiveDeterminers = POSSESSIVE_DETERMINERS, npCoordinators = NP_COORDINATORS, objectBoundary = null } = {}) => {
  const negationBeforeVerb = negationBeforeVerbFor(negationWords);
  const vocab = verbs instanceof Set ? verbs : new Set(verbs ?? []);
  if (vocab.size === 0) return [];
  const trimObject = (o) => {
    if (!objectBoundary?.size) return o;
    const toks = o.split(/\s+/);
    for (let i = 1; i < toks.length; i += 1) if (objectBoundary.has(toks[i].toLowerCase())) return toks.slice(0, i).join(" ");
    return o;
  };
  const VERB_ALT = altOf(vocab);
  const OBJECT_GROUP = functionWords && functionWords.size ? `(${W}(?:\\s+(?!${bWord(altOf(functionWords))})${W})*)` : `(.+?)(?:\\.|,|;|$)`;
  const ASIDE = `[\\p{Ps}][^\\p{Pe}]*[\\p{Pe}]`;
  const AUX_HOP_LIMIT = 4;
  const AUX_GROUP_RE = phrasalPredicates ? `((?:${bWord([.../* @__PURE__ */ new Set([...auxiliaryVerbs, ...negationWords])].map(escapeRe).join("|"))}\\s+){0,${AUX_HOP_LIMIT}})` : "";
  const VERB_IDX = phrasalPredicates ? 3 : 2;
  const OBJECT_IDX = phrasalPredicates ? 4 : 3;
  const SUBJECT_SECOND_GUARD = phrasalPredicates ? `(?!\\s+${bWord([.../* @__PURE__ */ new Set([...auxiliaryVerbs, ...negationWords])].map(escapeRe).join("|"))})` : "";
  const MATCHER = matcherFor(`(?<=^|[^\\p{L}])(${W}(?:${SUBJECT_SECOND_GUARD}\\s+${W})?)\\s+(?:${ASIDE}\\s+)*${AUX_GROUP_RE}(${VERB_ALT})\\s+${OBJECT_GROUP}`, "giu");
  const clauseEndAfter = (from) => {
    let end = s.length;
    for (const ch of [".", ",", ";"]) {
      const idx = s.indexOf(ch, from);
      if (idx !== -1 && idx < end) end = idx;
    }
    return end === s.length ? end : end + 1;
  };
  const rels = [];
  let refusedSubjects = 0;
  const seen = /* @__PURE__ */ new Set();
  const s = String(text ?? "");
  let m;
  let previousMatchEnd = 0;
  let lastSentenceEnd = -1;
  SENTENCE_END.lastIndex = 0;
  while ((m = MATCHER.exec(s)) !== null) {
    let subject = collapseWs(m[1].trim());
    let subjectStart = m.index;
    const leadingStrip = (w) => functionWords?.has(w) || CLAUSE_COORDINATORS.has(w) || CLAUSE_OPENERS.has(w);
    {
      const subjTokens = subject.split(/\s+/);
      if (subjTokens.length === 2 && leadingStrip(subjTokens[0].toLowerCase()) && !negationWords.has(subjTokens[1].toLowerCase()) && !(subjTokens[0].toLowerCase() in THIRD_PERSON_SINGULAR)) {
        subjectStart = m.index + m[1].lastIndexOf(subjTokens[1]);
        subject = subjTokens[1];
      } else if (subjTokens.length === 2 && CLAUSE_OPENERS.has(subjTokens[1].toLowerCase()) && !negationWords.has(subjTokens[0].toLowerCase())) {
        subject = subjTokens[0];
      }
    }
    const auxText = phrasalPredicates ? (m[2] ?? "").trim() : "";
    const anchorVerb = m[VERB_IDX].trim().toLowerCase();
    const verb = auxText ? `${auxText.toLowerCase()} ${anchorVerb}` : anchorVerb;
    const object = trimObject(collapseWs(m[OBJECT_IDX].trim()).replace(/[.,;]$/, ""));
    if (!subject || !object) {
      previousMatchEnd = clauseEndAfter(m.index + m[0].length);
      continue;
    }
    const key = `${subject}|${verb}|${object}`.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      const subjEnd = m.index + m[1].length;
      while (SENTENCE_END.lastIndex <= m.index) {
        const sm = SENTENCE_END.exec(s);
        if (sm === null) break;
        if (sm.index >= m.index) {
          SENTENCE_END.lastIndex = sm.index;
          break;
        }
        lastSentenceEnd = sm.index;
      }
      const windowStart = Math.max(previousMatchEnd, lastSentenceEnd + 1, 0);
      const polarityWindowStart = frontedClauseFloor(s, windowStart, subjEnd, clauseOpeners);
      const before = s.slice(polarityWindowStart, subjEnd + 1).replace(NOISE_RUN, " ");
      let finalSubject = subject;
      let finalSubjectStart = subjectStart;
      if (nounPhraseSubjects) {
        const expanded = expandSubjectNP(s, subjectStart, subjEnd, windowStart, {
          definiteDeterminers,
          indefiniteDeterminers,
          possessiveDeterminers,
          npCoordinators,
          auxiliaryVerbs,
          subjectWalls,
          negationWords,
          subjectPronouns,
          clauseOpeners,
          adpositions,
          // The verb wall: this material's own cleared vocabulary plus any
          // RECEIVED verb forms the caller supplies (`verbWall` — a POS
          // prior's verb-dominant forms). Received, asymmetric: a form here
          // can only wall a subject, never admit an edge.
          verbs: verbWall ? /* @__PURE__ */ new Set([...vocab, ...verbWall]) : vocab
        });
        if (expanded?.refused) {
          refusedSubjects += 1;
          previousMatchEnd = clauseEndAfter(m.index + m[0].length);
          continue;
        }
        if (expanded) {
          finalSubject = expanded.subject;
          finalSubjectStart = expanded.start;
        }
      }
      rels.push({
        subject: finalSubject,
        verb,
        object,
        // Additive to the existing `before`-window check, never a
        // replacement for it: DR5's own aux-chain capture is the first time
        // a negation sitting BETWEEN subject and verb ("does NOT measure")
        // is captured text at all rather than silently swallowed into the
        // object, so it could never be seen by any polarity check before —
        // widening the SIGNAL a check can see is not the same risk as
        // widening what the check itself accepts.
        polarity: negationBeforeVerb.test(before) || phrasalPredicates && negationBeforeVerb.test(auxText) ? "-" : "+",
        offset: m.index,
        subjectOffset: finalSubjectStart,
        objectOffset: m.index + m[0].lastIndexOf(m[OBJECT_IDX])
      });
      if (rels.length >= limit) {
        previousMatchEnd = clauseEndAfter(m.index + m[0].length);
        break;
      }
    }
    previousMatchEnd = clauseEndAfter(m.index + m[0].length);
  }
  Object.defineProperty(rels, "refusedSubjects", { value: refusedSubjects, enumerable: false });
  const REDUCED = /,\s*([\p{L}’']+ing)\s+([\s\S]+)$/u;
  REDUCED.lastIndex = 0;
  let rmr;
  if ((rmr = REDUCED.exec(s)) !== null) {
    const participle = rmr[1];
    const reducedInVocab = vocab.has(participle.toLowerCase());
    const before = s.slice(0, rmr.index);
    let inheritedSubject = null;
    if (rels.length) {
      for (let i = rels.length - 1; i >= 0; i -= 1) {
        if (!rels[i].reduced) {
          inheritedSubject = rels[i].subject;
          break;
        }
      }
    }
    if (!inheritedSubject) {
      const firstNP = before.match(/^([\p{L}][\p{L}’'\- ]*?)\s+(?:was|were|is|are|had|have|has|ran|said|took|thought|began|went)\b/i);
      inheritedSubject = firstNP ? firstNP[1].trim() : null;
    }
    if (reducedInVocab && inheritedSubject && rels.length < limit) {
      const verb = participle;
      const object = rmr[2].trim();
      const subject = inheritedSubject;
      const beforeForPolarity = before.slice(Math.max(0, before.length - 60));
      rels.push({
        subject,
        verb,
        object,
        polarity: negationBeforeVerb.test(beforeForPolarity) ? "-" : "+",
        offset: rmr.index + 1,
        // the participle's own start (after the comma)
        subjectOffset: before.lastIndexOf(subject),
        objectOffset: rmr.index + 1 + verb.length + 1,
        reduced: true,
        subjectBasis: "inherited (reduced participial clause \u2014 the noun phrase before the comma)"
      });
    }
  }
  const PARTICIPLE_AFTER_MATRIX = /(\b(?:[\p{L}’']+ing)\b)\s+(.+?)(?:[.,;]|$)/u;
  const commaReducedFired = rels.some((r) => r.reduced && r.subjectBasis?.includes("comma"));
  if (!commaReducedFired && !/,\s*[\p{L}’']+ing\s/.test(s) && rels.length && rels.length < limit) {
    const lastMatrix = [...rels].reverse().find((r) => !r.reduced);
    if (lastMatrix) {
      PARTICIPLE_AFTER_MATRIX.lastIndex = 0;
      let pm;
      const from = Math.max(0, (lastMatrix.objectOffset ?? 0) + (lastMatrix.object?.length ?? 0));
      const tail = s.slice(from);
      if ((pm = PARTICIPLE_AFTER_MATRIX.exec(tail)) !== null) {
        const participle = pm[1];
        const inVocab = vocab.has(participle.toLowerCase());
        if (inVocab && !lastMatrix.verb.toLowerCase().endsWith(participle.toLowerCase())) {
          const object = pm[2].trim();
          rels.push({
            subject: lastMatrix.subject,
            verb: participle,
            object,
            polarity: lastMatrix.polarity,
            // same clause, same polarity
            offset: from + pm.index,
            subjectOffset: lastMatrix.subjectOffset,
            objectOffset: from + pm.index + participle.length + 1,
            reduced: true,
            subjectBasis: "inherited (non-comma participial clause \u2014 the matrix subject does the participle too)"
          });
        }
      }
    }
  }
  return rels;
};

// native/adapters/text/fragment-relations.js
var FRAGMENT_DISCLOSURE = Object.freeze({
  assembly: "text/fragment-transitive",
  stagesNotRun: Object.freeze(["register-learned-construction@2", "implicit-endpoint-resolution"]),
  gap: "fragment_construction_prior_unavailable",
  basis: "measured heads with literal endpoints; the logged baby-learning assembly is absent"
});
function fragmentRelations(text, { prior = null, verbs = /* @__PURE__ */ new Set() } = {}) {
  if (!["en", "eng"].includes(prior?.language)) return [];
  const allowed = new Set([...verbs].filter((word) => {
    const row = prior?.forms?.[String(word).toLowerCase()];
    if (!row) return true;
    const total2 = Object.values(row).reduce((a, b) => a + b, 0);
    return total2 > 0 && (row.VERB ?? 0) / total2 >= 0.5;
  }));
  if (!allowed.size) return [];
  return extractRelations(String(text ?? ""), { verbs: allowed }).filter((r) => r.subject && r.object && allowed.has(r.verb)).map((r) => ({
    end1: r.subject,
    label: r.verb,
    end2: r.object,
    offset: r.offset,
    polarity: r.polarity,
    grain: { operator: "CON", grain: "Figure" },
    basis: FRAGMENT_DISCLOSURE.assembly
  }));
}

// native/kernel/fold.js
function eoOperation({ id = null, op, grain, witness = null, consequence = null, inputs = [], outputs = [], payload = null, provenance = null }) {
  const cell = cellOf(op, grain);
  if (cell.gap) throw new TypeError(cell.reason);
  if (op === "NUL" && payload?.action) {
    throw new TypeError("NUL records no transformation and cannot carry a mutating payload");
  }
  return Object.freeze({
    schema: "EOOperation@1",
    id,
    mode: cell.mode,
    domain: cell.domain,
    grain: cell.grain,
    operator: cell.op,
    terrain: cell.terrain,
    stance: cell.stance,
    witness,
    consequence,
    inputs: Object.freeze([...inputs]),
    outputs: Object.freeze([...outputs]),
    payload,
    // A5.1 (assemblies spec): every fold contribution carries its producer.
    // Optional and absent-when-unsupplied, so every existing operation —
    // and every byte-compared delta — is unchanged; stampDelta
    // (kernel/assembly.js) is the one place a producing assembly lands it.
    ...provenance ? { provenance: Object.freeze({ ...provenance }) } : {}
  });
}
function deltaFold(operations = [], meta = {}) {
  return Object.freeze({
    schema: "DeltaFold@1",
    operations: Object.freeze([...operations]),
    ...meta
  });
}
var STREAM = /* @__PURE__ */ new WeakMap();
function chainView(compute, foldStep) {
  const memo = /* @__PURE__ */ new WeakMap();
  return (list) => {
    if (!Array.isArray(list)) return compute(list ?? []);
    const s = STREAM.get(list) ?? null;
    const hit = memo.get(list);
    if (hit && (s === null || hit.at === s.tail)) return hit.state;
    let state = null;
    if (hit && s !== null && hit.at) {
      state = hit.state;
      for (let node = hit.at.next; node && state != null; node = node.next) state = foldStep(state, node);
    }
    if (state == null) state = compute(list);
    memo.set(list, { at: s?.tail ?? null, state });
    return state;
  };
}
var idSetOf = chainView(
  (list) => {
    const ids = /* @__PURE__ */ new Set();
    for (const e of list) if (e?.id != null) ids.add(e.id);
    return ids;
  },
  (ids, d) => {
    for (const e of d.appended) if (e?.id != null) ids.add(e.id);
    return ids;
  }
);

// native/adapters/text/individuation.js
var occurrenceContent = ({ encounterRef, canonicalSurface, head, determination, role, index }) => `ref-occ|enc:${encounterRef ?? "unknown"}|canon:${canonicalSurface}|head:${head}|det:${determination}|role:${role ?? ""}|at:${index ?? ""}`;
var WORD4 = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
var norm = (x) => (String(x ?? "").toLowerCase().match(WORD4) ?? []).join(" ");
var words = (x) => String(x ?? "").toLowerCase().match(WORD4) ?? [];
var slug = (x) => norm(x).replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "");
var PERSONAL_PRONOUNS = /* @__PURE__ */ new Set([
  "i",
  "me",
  "mine",
  "myself",
  "we",
  "us",
  "ours",
  "ourselves",
  "you",
  "yours",
  "yourself",
  "yourselves",
  "they",
  "them",
  "theirs",
  "themselves",
  "who",
  "whom",
  "whose",
  "which",
  "what"
]);
var POSSESSIVE_DETERMINERS2 = /* @__PURE__ */ new Set(["my", "your", "his", "her", "our", "their"]);
var CLAUSE_LEADERS = /* @__PURE__ */ new Set(["when", "where", "if", "while", "because", "although", "though", "since", "before", "after", "until"]);
var pronounToken = (w) => PERSONAL_PRONOUNS.has(w) || ANAPHORIC_PRONOUNS.has(w) || Object.hasOwn(THIRD_PERSON_SINGULAR, w);
var containsPronoun = (ws) => ws.some(pronounToken);
var determinationOf = (first) => DEFINITE_DETERMINERS.has(first) ? "definite" : INDEFINITE_DETERMINERS.has(first) ? "indefinite" : POSSESSIVE_DETERMINERS2.has(first) ? "possessive" : "bare";
var occurrence = ({ surface, determination, encounterRef, role = null, edge = null, relation = null, giver, basis, at = "" }) => {
  const ws = words(surface);
  if (!ws.length) return null;
  const canonicalSurface = ws.join(" ");
  const head = ws[ws.length - 1];
  return Object.freeze({
    schema: "EOReferentOccurrence@1",
    // A4 (THE-ADDRESS.md): the occurrence's id is a content hash of its own
    // content — encounterRef + canonicalSurface + head + determination +
    // role + the byte/discriminator position — never a sequence number.
    // Same occurrence re-read dedups; different content never collides.
    id: sha256hex(occurrenceContent({ encounterRef, canonicalSurface, head, determination, role, index: at })),
    surface,
    canonicalSurface,
    head,
    determination,
    role,
    encounterRef,
    edge,
    relation,
    standing: "unresolved_identity",
    provenance: Object.freeze({ giver, basis })
  });
};
function descriptorOccurrence(participant, { encounterRef = null, edge = null } = {}) {
  if (participant?.standing !== "unresolved_surface") return null;
  const surface = String(participant.surface ?? "").trim();
  const ws = words(surface);
  if (!surface || ws.length < 2 || containsPronoun(ws) || CLAUSE_LEADERS.has(ws[0])) return null;
  const determination = determinationOf(ws[0]);
  if (determination === "bare") return null;
  return occurrence({
    surface,
    determination,
    role: participant.role ?? null,
    encounterRef,
    edge: edge?.id ?? null,
    relation: edge?.relation ?? null,
    at: participant.occurrence ?? slug(surface),
    giver: "text/individuation::descriptorOccurrence",
    basis: "determiner-marked unresolved relation participant"
  });
}
function directDescriptorOccurrences(text, { encounterRef = "unknown" } = {}) {
  const source2 = String(text ?? "");
  const out = [];
  const determinerAlternation = [...DEFINITE_DETERMINERS, ...INDEFINITE_DETERMINERS, ...POSSESSIVE_DETERMINERS2].sort((a, b) => b.length - a.length).join("|");
  const re = new RegExp(`\\b(${determinerAlternation})\\s+([\\p{L}\\p{N}]+(?:['\u2019][\\p{L}\\p{N}]+)*)`, "giu");
  let m;
  while (m = re.exec(source2)) {
    const surface = `${m[1]} ${m[2]}`;
    const ws = words(surface);
    if (containsPronoun([ws[1]])) continue;
    out.push(occurrence({
      surface,
      determination: determinationOf(ws[0]),
      encounterRef,
      at: `direct:${m.index}`,
      giver: "text/individuation::directDescriptorOccurrences",
      basis: "closed-class determiner plus witnessed lexical form"
    }));
  }
  return Object.freeze(out.filter(Boolean));
}
var HYPOTHESIS = /* @__PURE__ */ new WeakMap();
function hypothesisForGroup(surface, group) {
  const hit = HYPOTHESIS.get(group);
  if (hit !== void 0 && hit.surface === surface && hit.length === group.length) return hit.value;
  const one = hypothesesFrom(/* @__PURE__ */ new Map([[surface, group]]));
  const value = one.length ? one[0] : null;
  HYPOTHESIS.set(group, { surface, length: group.length, value });
  return value;
}
var emptyState = () => ({ groups: /* @__PURE__ */ new Map(), order: /* @__PURE__ */ new Map(), out: [], outOrder: [], frozen: null, fresh: true, pending: /* @__PURE__ */ new Set() });
function slot(st, surface) {
  const o = st.order.get(surface);
  let lo = 0, hi = st.outOrder.length;
  while (lo < hi) {
    const mid = lo + hi >> 1;
    if (st.outOrder[mid] < o) lo = mid + 1;
    else hi = mid;
  }
  return { at: lo, found: lo < st.outOrder.length && st.outOrder[lo] === o };
}
function place(st, surface, value) {
  const { at, found } = slot(st, surface);
  if (found) {
    if (value == null) throw new Error("individuation: a hypothesis once earned cannot be lost on an append-only group");
    if (st.out[at] === value) return false;
    st.out[at] = value;
    return true;
  }
  if (value == null) return false;
  st.out.splice(at, 0, value);
  st.outOrder.splice(at, 0, st.order.get(surface));
  return true;
}
function foldGroups(st, entries, alsoTouched = []) {
  const touched = new Set(alsoTouched);
  for (const x of entries) {
    if (x?.schema !== "EOReferentOccurrence@1") continue;
    const key = x.canonicalSurface;
    if (!st.groups.has(key)) {
      st.groups.set(key, []);
      st.order.set(key, st.order.size);
    }
    st.groups.get(key).push(x);
    touched.add(key);
  }
  let changed = false;
  for (const key of [...touched].sort((a, b) => st.order.get(a) - st.order.get(b))) {
    st.pending.add(key);
    changed = place(st, key, hypothesisForGroup(key, st.groups.get(key))) || changed;
  }
  if (changed || !st.frozen) st.frozen = Object.freeze([...st.out]);
  return st;
}
var surfaceState = chainView(
  (graphEntries) => {
    const st = foldGroups(emptyState(), graphEntries);
    st.fresh = true;
    return st;
  },
  (st, d) => {
    foldGroups(st, d.appended);
    const touched = [];
    for (const x of d.updated) {
      if (x?.schema !== "EOReferentOccurrence@1") continue;
      const group = st.groups.get(x.canonicalSurface);
      const i = group ? group.findIndex((g) => g.id === x.id) : -1;
      if (i < 0) return null;
      group[i] = x;
      HYPOTHESIS.delete(group);
      touched.push(x.canonicalSurface);
    }
    return touched.length ? foldGroups(st, [], touched) : st;
  }
);
var NOTHING = Object.freeze([]);
function descriptorHypothesesWith(foldEntries = [], extraOccurrences = [], { changedOnly = false } = {}) {
  const st = surfaceState(foldEntries);
  const offerAll = !changedOnly || st.fresh;
  const carried = st.pending;
  if (changedOnly) {
    st.fresh = false;
    st.pending = /* @__PURE__ */ new Set();
  }
  const extra = /* @__PURE__ */ new Map();
  for (const x of extraOccurrences) {
    if (x?.schema !== "EOReferentOccurrence@1") continue;
    const key = x.canonicalSurface;
    if (!extra.has(key)) extra.set(key, [...st.groups.get(key) ?? []]);
    extra.get(key).push(x);
  }
  if (!offerAll) {
    const touched = /* @__PURE__ */ new Set([...carried, ...extra.keys()]);
    if (!touched.size) return NOTHING;
    const known2 = [...touched].filter((k2) => st.order.has(k2)).sort((a, b) => st.order.get(a) - st.order.get(b));
    const fresh2 = [...touched].filter((k2) => !st.order.has(k2));
    const out2 = [];
    for (const key of [...known2, ...fresh2]) {
      const h = hypothesisForGroup(key, extra.get(key) ?? st.groups.get(key));
      if (h) out2.push(h);
    }
    return Object.freeze(out2);
  }
  if (!extra.size) return st.frozen;
  const known = [...extra.keys()].filter((k2) => st.order.has(k2)).sort((a, b) => st.order.get(a) - st.order.get(b));
  const fresh = [...extra.keys()].filter((k2) => !st.order.has(k2));
  const out = [];
  let k = 0;
  const pushKnown = (limitOrder) => {
    while (k < known.length && st.order.get(known[k]) < limitOrder) {
      const h = hypothesisForGroup(known[k], extra.get(known[k]));
      if (h) out.push(h);
      k += 1;
    }
  };
  for (let i = 0; i < st.out.length; i += 1) {
    const o = st.outOrder[i];
    pushKnown(o);
    if (k < known.length && st.order.get(known[k]) === o) {
      const h = hypothesisForGroup(known[k], extra.get(known[k]));
      if (h) out.push(h);
      k += 1;
    } else out.push(st.out[i]);
  }
  pushKnown(Infinity);
  for (const key of fresh) {
    const h = hypothesisForGroup(key, extra.get(key));
    if (h) out.push(h);
  }
  return Object.freeze(out);
}
function hypothesesFrom(bySurface) {
  const hypotheses = [];
  for (const [surface, group] of bySurface) {
    if (group.length < 2) continue;
    const encounterRefs = [...new Set(group.map((x) => x.encounterRef).filter(Boolean))];
    if (encounterRefs.length < 2) continue;
    const determinations = [...new Set(group.map((x) => x.determination).filter(Boolean))];
    hypotheses.push(Object.freeze({
      schema: "EOIdentityHypothesis@1",
      id: `identity:descriptor:${slug(surface)}`,
      surface,
      determinations: Object.freeze(determinations),
      occurrenceRefs: Object.freeze(group.map((x) => x.id)),
      encounterRefs: Object.freeze(encounterRefs),
      relationContexts: Object.freeze(group.map((x) => ({ edge: x.edge, relation: x.relation, role: x.role }))),
      standing: "live_hypothesis",
      provenance: Object.freeze({
        giver: "text/individuation::descriptorHypotheses",
        basis: "same descriptor recurred across distinct encounters; identity remains defeasible"
      })
    }));
  }
  return Object.freeze(hypotheses);
}

// native/memory/activation.js
var WORD_RE2 = /[\p{L}\p{N}']+/gu;
var CELL4 = Object.freeze({ op: "CON", grain: "Figure" });
var tokens = (t) => hear(String(t ?? "").toLowerCase()).match(WORD_RE2) ?? [];
var bump = (map, key, amount) => map.set(key, (map.get(key) ?? 0) + amount);
var IDF_FLOOR = 2;
var MIN_LEN = 4;
var floorFor = wordFloor;
var codeOf = (ws, state, { minLen = MIN_LEN, idfFloor = IDF_FLOOR } = {}) => {
  const { df, gramDf, read } = state;
  const idfOf = (w) => Math.log(Math.max(1, read) / Math.max(1, df.get(w) ?? 0));
  const trace = /* @__PURE__ */ new Map();
  const cue = /* @__PURE__ */ new Map();
  for (const w of ws) {
    if (w.length < floorFor(w, minLen)) continue;
    const s = idfOf(w);
    if (s < idfFloor) continue;
    trace.set(w, Math.max(trace.get(w) ?? 0, s));
    if ((df.get(w) ?? 0) >= 2) cue.set(w, Math.max(cue.get(w) ?? 0, s));
  }
  const long = ws.filter((w) => w.length >= floorFor(w, 3));
  for (let i = 0; i + 2 < long.length; i++) {
    const g = `${long[i]} ${long[i + 1]} ${long[i + 2]}`;
    const seen = gramDf.get(g) ?? 0;
    if (seen < 1) continue;
    const s = idfOf(long[i]) + idfOf(long[i + 1]) + idfOf(long[i + 2]);
    if (s < idfFloor) continue;
    trace.set(g, Math.max(trace.get(g) ?? 0, s));
    if (seen >= 2) cue.set(g, Math.max(cue.get(g) ?? 0, s));
  }
  return { trace, cue };
};
var NO_EMBEDDER = Object.freeze({
  gap: "undeclared",
  what: "embed",
  why: "descriptor synonymy is model-tier and needs a resolver with a giver; none was supplied"
});
var recall = (code, state, { completion, topEdges, selfOrder }) => {
  const { posting, edges } = state;
  const activation = /* @__PURE__ */ new Map();
  const add = (order, amt) => {
    if (order === selfOrder) return;
    bump(activation, order, amt);
  };
  for (const [m, w] of code) {
    const p = posting.get(m);
    if (p) for (const [order, pw] of p) add(order, w * pw);
    if (completion <= 0) continue;
    const nbrs = edges.get(m);
    if (!nbrs) continue;
    const top = [...nbrs].sort((a, b) => b[1] - a[1]).slice(0, topEdges);
    const norm6 = top.reduce((s, [, str]) => s + str, 0) || 1;
    for (const [nb, str] of top) {
      const np = posting.get(nb);
      if (!np) continue;
      const gate = completion * w * (str / norm6);
      for (const [order, pw] of np) add(order, gate * pw);
    }
  }
  return activation;
};
var encodeFrame = (state, order, ws, trace, { edgeSlots = 24 } = {}) => {
  for (const [m, w] of trace) {
    let p = state.posting.get(m);
    if (!p) state.posting.set(m, p = /* @__PURE__ */ new Map());
    p.set(order, w);
  }
  const wired = [...trace].sort((a, b) => b[1] - a[1]).slice(0, edgeSlots);
  for (let a = 0; a < wired.length; a++) {
    for (let b = a + 1; b < wired.length; b++) {
      const inc = Math.min(wired[a][1], wired[b][1]);
      let ea = state.edges.get(wired[a][0]);
      if (!ea) state.edges.set(wired[a][0], ea = /* @__PURE__ */ new Map());
      bump(ea, wired[b][0], inc);
      let eb = state.edges.get(wired[b][0]);
      if (!eb) state.edges.set(wired[b][0], eb = /* @__PURE__ */ new Map());
      bump(eb, wired[a][0], inc);
    }
  }
  const seenU = new Set(ws);
  for (const w of seenU) bump(state.df, w, 1);
  const long = ws.filter((w) => w.length >= floorFor(w, 3));
  const seenG = /* @__PURE__ */ new Set();
  for (let k = 0; k + 2 < long.length; k++) seenG.add(`${long[k]} ${long[k + 1]} ${long[k + 2]}`);
  for (const g of seenG) bump(state.gramDf, g, 1);
  state.read++;
};

// native/adapters/text/anchoring.js
var DEFAULT_COMPLETION = 0.5;
var DEFAULT_TOP_EDGES = 6;
var DEFAULT_EDGE_SLOTS = 24;
var norm2 = (x) => String(x ?? "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
var escapeRe2 = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
var surfaceMatcher = (surfaces) => {
  const parts = [...surfaces].filter(Boolean).sort((a, b) => b.length - a.length).map(escapeRe2);
  if (!parts.length) return null;
  return new RegExp(`\\b(${parts.join("|")})\\b`, "giu");
};
function createDescriptorAnchoring({
  minActivation,
  minMargin,
  idfFloor,
  minLen,
  completion = DEFAULT_COMPLETION,
  topEdges = DEFAULT_TOP_EDGES,
  edgeSlots = DEFAULT_EDGE_SLOTS,
  born = false,
  bornActivationFloor,
  bornMarginFloor,
  minWindow = 4
} = {}) {
  if (born) {
    if (!Number.isFinite(bornActivationFloor) || bornActivationFloor <= 0 || bornActivationFloor >= 1)
      throw new TypeError("createDescriptorAnchoring (born): bornActivationFloor is declared \u2014 the bootstrap share a leader must clear before the material has spoken");
    if (!Number.isFinite(bornMarginFloor) || bornMarginFloor <= 0)
      throw new TypeError("createDescriptorAnchoring (born): bornMarginFloor is declared \u2014 the bootstrap lead the leader must keep before the material has spoken");
    if (!Number.isInteger(minWindow) || minWindow < 1)
      throw new TypeError("createDescriptorAnchoring (born): minWindow is declared \u2014 how many scenes give a floor before the material itself says");
  } else {
    if (!Number.isFinite(minActivation) || minActivation < 0)
      throw new TypeError("createDescriptorAnchoring: minActivation is declared \u2014 how much recall counts as a real echo is never a default");
    if (!Number.isFinite(minMargin) || minMargin < 0)
      throw new TypeError("createDescriptorAnchoring: minMargin is declared \u2014 how far a candidate must lead the runner-up is never a default");
  }
  const state = { df: /* @__PURE__ */ new Map(), gramDf: /* @__PURE__ */ new Map(), posting: /* @__PURE__ */ new Map(), edges: /* @__PURE__ */ new Map(), read: 0 };
  const namedByFrame = /* @__PURE__ */ new Map();
  let matcher = null;
  let matcherSurfaceCount = -1;
  let surfaceToReferent = /* @__PURE__ */ new Map();
  let normToReferent = /* @__PURE__ */ new Map();
  let displayById = /* @__PURE__ */ new Map();
  let castSeen = null;
  const bornTops = [];
  const bornMargins = [];
  const median = (a) => {
    if (!a.length) return null;
    const b = [...a].sort((x, y) => x - y);
    const mid = b.length >> 1;
    return b.length % 2 ? b[mid] : (b[mid - 1] + b[mid]) / 2;
  };
  const bornFloors = () => {
    const activation = bornTops.length >= minWindow ? median(bornTops) : bornActivationFloor;
    const margin = bornMargins.length >= minWindow ? median(bornMargins) : bornMarginFloor;
    return { activation, margin, contextual: bornTops.length >= minWindow };
  };
  const bornOf = (candidates) => {
    let sq = 0;
    for (const [, a] of candidates) sq += a * a;
    if (!(sq > 0)) return null;
    return candidates.map(([r, a]) => [r, a * a / sq]);
  };
  const refreshCast = (referents) => {
    if (referents === castSeen) return;
    castSeen = referents;
    const surfaces = /* @__PURE__ */ new Map();
    const displays = /* @__PURE__ */ new Map();
    const norms = /* @__PURE__ */ new Map();
    for (const ref of referents ?? []) {
      if (!ref?.id) continue;
      displays.set(ref.id, ref.display ?? (ref.surfaces ?? [])[0] ?? ref.id);
      for (const s of ref.surfaces ?? []) if (s) surfaces.set(s, ref.id);
    }
    for (const [surface, ref] of surfaces) {
      const k = norm2(surface);
      if (!norms.has(k)) norms.set(k, ref);
    }
    if (surfaces.size !== matcherSurfaceCount) {
      matcher = surfaceMatcher(surfaces.keys());
      matcherSurfaceCount = surfaces.size;
    }
    surfaceToReferent = surfaces;
    normToReferent = norms;
    displayById = displays;
  };
  const namedIn = (text) => {
    const named = /* @__PURE__ */ new Set();
    if (!matcher) return named;
    matcher.lastIndex = 0;
    let m;
    while (m = matcher.exec(text)) {
      const hit = m[1];
      const direct = surfaceToReferent.get(hit);
      if (direct) {
        named.add(direct);
        continue;
      }
      const ref = normToReferent.get(norm2(hit));
      if (ref) named.add(ref);
    }
    return named;
  };
  const observe = (sentence, occurrences = [], referents = []) => {
    refreshCast(referents);
    const ws = tokens(sentence.text);
    const { trace, cue } = codeOf(ws, state, { minLen, idfFloor });
    const named = namedIn(sentence.text);
    const evidence = [];
    const gaps = [];
    const resolvable = (occurrences ?? []).filter(
      (occ) => occ && (occ.determination === "definite" || occ.determination === "possessive")
    );
    if (named.size === 0 && resolvable.length > 0) {
      const activation = recall(cue, state, { completion, topEdges, selfOrder: sentence.order });
      const referentScore = /* @__PURE__ */ new Map();
      for (const [order, amt] of activation) {
        const refs = namedByFrame.get(order);
        if (!refs) continue;
        for (const r of refs) if (amt > (referentScore.get(r) ?? -Infinity)) referentScore.set(r, amt);
      }
      const candidates = [...referentScore.entries()].sort((a, b) => b[1] - a[1]);
      for (const occ of resolvable) {
        if (!candidates.length) {
          gaps.push({ reason: "descriptor_no_candidate", tier: "engine", sentenceOrder: sentence.order, descriptor: occ.canonicalSurface, detail: "no admitted referent has been named and activated yet \u2014 nothing here to bind to" });
          continue;
        }
        if (candidates.length < 2) {
          gaps.push({ reason: "descriptor_no_competition", tier: "engine", sentenceOrder: sentence.order, descriptor: occ.canonicalSurface, top: candidates[0][0], detail: "only one referent has any recall \u2014 a margin against nothing is not a measurement" });
          continue;
        }
        const [topRef, topScore] = candidates[0];
        const judged = born ? bornOf(candidates) : candidates.map(([r, a]) => [r, a / (candidates[0]?.[1] ?? 1)]);
        const judgedTop = judged[0]?.[1] ?? 0;
        const judgedSecond = judged[1]?.[1] ?? 0;
        const marginOf = judgedTop > 0 ? Math.max(0, (judgedTop - judgedSecond) / judgedTop) : 0;
        const floor = born ? bornFloors() : { activation: minActivation, margin: minMargin, contextual: false };
        if (born) {
          bornTops.push(judgedTop);
          bornMargins.push(marginOf);
        }
        if (judgedTop < floor.activation) {
          gaps.push({ reason: "descriptor_below_floor", tier: "engine", sentenceOrder: sentence.order, descriptor: occ.canonicalSurface, top: topRef, activation: born ? judgedTop : topScore, contextual: floor.contextual, detail: born ? `top candidate's born mass (${judgedTop.toFixed(3)}) does not clear the floor ${floor.contextual ? `the session's own median (${floor.activation.toFixed(3)})` : `(bootstrap ${floor.activation.toFixed(3)})`}` : `top candidate's recall (${topScore.toFixed(3)}) does not clear minActivation (${minActivation})` });
          continue;
        }
        const second = candidates[1]?.[1] ?? 0;
        const margin = topScore > 0 ? (topScore - second) / topScore : 0;
        if (marginOf < floor.margin) {
          gaps.push({ reason: "descriptor_no_margin", tier: "engine", sentenceOrder: sentence.order, descriptor: occ.canonicalSurface, top: topRef, runnerUp: candidates[1]?.[0] ?? null, margin: born ? marginOf : margin, contextual: floor.contextual, detail: born ? `top candidate leads the runner-up by only ${(marginOf * 100).toFixed(1)}% born mass, short of ${floor.contextual ? `the session's own median lead (${(floor.margin * 100).toFixed(1)}%)` : `the bootstrap lead (${(floor.margin * 100).toFixed(1)}%)`}` : `top candidate leads the runner-up by only ${(margin * 100).toFixed(1)}%, short of minMargin (${(minMargin * 100).toFixed(1)}%)` });
          continue;
        }
        const anchorContent = `anchor|text:${sentence.text}|off:${sentence.offset}|canon:${occ.canonicalSurface}|head:${(occ.canonicalSurface ?? "").split(/\s+/).at(-1)}|det:${occ.determination}|ref:${topRef}`;
        evidence.push(Object.freeze({
          schema: "EOAnchorEvidence@1",
          id: sha256hex(anchorContent),
          descriptor: occ.canonicalSurface,
          determination: occ.determination,
          occurrenceRef: occ.id ?? null,
          // The occurrence id an EDGE PARTICIPANT actually carries, when
          // this occurrence came from one. Edge participants live in their
          // own id space (`occ:{seq}:{rel}:{role}`), separate from
          // text-derived descriptor occurrences (`ref-occ:...`) — measured
          // at zero overlap, which is why binding only the latter left the
          // composition ledger with no bridges at all.
          participantOccurrence: occ.participantOccurrence ?? null,
          referent: topRef,
          referentSurface: displayById.get(topRef) ?? topRef,
          activation: topScore,
          bornMass: born ? judgedTop : void 0,
          margin,
          sentenceOrder: sentence.order,
          witness: sha256hex(`${anchorContent}|wit`),
          provenance: Object.freeze({
            giver: "text/anchoring::createDescriptorAnchoring",
            tier: "engine",
            basis: born ? `one-hop activation recall over the already-admitted cast, contextual born floors \u2014 p_i = a_i^2 / \u03A3a^2, floors from the session's own prior verdicts (${floor.contextual ? "material-derived" : "declared bootstrap"})` : "one-hop activation recall over the already-admitted cast, floors declared by the caller"
          })
        }));
      }
    }
    namedByFrame.set(sentence.order, named);
    encodeFrame(state, sentence.order, ws, trace, { edgeSlots });
    return { evidence, gaps };
  };
  return Object.freeze({ observe });
}
function identityEvidenceFromAnchors(anchors = [], fold = {}) {
  const supports = [];
  const attacks = [];
  const live = (fold?.unresolvedAlternatives ?? []).filter(
    (x) => x?.schema === "EOIdentityAlternative@1" && x.standing !== "distinct" && x.standing !== "refused"
  );
  for (const anchor of anchors) {
    if (anchor?.schema !== "EOAnchorEvidence@1") continue;
    const left = norm2(anchor.descriptor);
    const right = norm2(anchor.referentSurface);
    if (!left || !right || left === right) continue;
    supports.push({ left, right, witness: anchor.witness, giver: anchor.provenance?.giver ?? "text/anchoring", reason: "descriptor_activation_anchor" });
    for (const alt of live) {
      const pairsDescriptor = alt.left === left || alt.right === left;
      if (!pairsDescriptor) continue;
      const other = alt.left === left ? alt.right : alt.left;
      if (other === right) continue;
      attacks.push({ left: alt.left, right: alt.right, witness: anchor.witness, giver: anchor.provenance?.giver ?? "text/anchoring", reason: "descriptor_bound_to_different_referent" });
    }
  }
  return { supports, attacks };
}

// native/kernel/hypergraph.js
var freeze = (value) => Object.freeze(value);
function hyperedge({ id, relation, participants = [], witness = null, scope = null, eo = null, meta = {} }) {
  if (!id) throw new TypeError("Hyperedge requires stable id");
  if (!relation) throw new TypeError("Hyperedge requires relation");
  if (!Array.isArray(participants) || participants.length === 0) throw new TypeError("Hyperedge requires participants");
  return freeze({ schema: "EOHyperedge@1", id, relation, participants: freeze(participants.map((p) => freeze({ ...p }))), witness, scope, eo, meta: freeze({ ...meta }) });
}

// native/adapters/text/english-parser.js
var CLITIC = /^(.+?)(n['’]t|['’](?:s|re|ve|ll|m|d|S|RE|VE|LL|M|D))$/;
var NEGATIVE_CLITIC = /^(.+?)(N['’]T)$/;
var KEEP_WHOLE = /^(?:https?:\/\/\S+|www\.\S+|\S+@\S+\.\S+|\d+(?:[.,:]\d+)+|[A-Za-z]\.(?:[A-Za-z]\.)+|(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Mt|vs|etc|Prof|Gen|Col|Capt|Lt|Rev|Hon|No)\.)$/;
function tokenize2(text) {
  const out = [];
  const raw = String(text ?? "");
  const re = /\S+/g;
  let m;
  while (m = re.exec(raw)) {
    let chunk = m[0];
    let at = m.index;
    const pieces = [];
    if (KEEP_WHOLE.test(chunk)) {
      pieces.push(chunk);
    } else {
      const lead = [];
      while (chunk.length > 1 && /^[\p{P}\p{S}]/u.test(chunk) && !/^['’][a-z]/i.test(chunk.slice(0, 2))) {
        lead.push(chunk[0]);
        chunk = chunk.slice(1);
      }
      if (/^['’]\S/.test(chunk) && !/^['’](s|re|ve|ll|m|d|t)\b/i.test(chunk)) {
        lead.push(chunk[0]);
        chunk = chunk.slice(1);
      }
      const trail = [];
      while (chunk.length > 1 && /[\p{P}\p{S}]$/u.test(chunk) && !KEEP_WHOLE.test(chunk)) {
        trail.unshift(chunk[chunk.length - 1]);
        chunk = chunk.slice(0, -1);
      }
      pieces.push(...lead);
      const c = CLITIC.exec(chunk) || NEGATIVE_CLITIC.exec(chunk);
      if (c && c[1].length) {
        pieces.push(c[1], c[2]);
      } else if (chunk.includes("\u2014") || chunk.includes("--")) {
        for (const p of chunk.split(/(—|--)/)) if (p) pieces.push(p);
      } else pieces.push(chunk);
      pieces.push(...trail);
    }
    for (const p of pieces) {
      const i = raw.indexOf(p, at);
      out.push({ form: p, start: i, end: i + p.length });
      at = i + p.length;
    }
  }
  return out;
}
var SENTENCE = new Intl.Segmenter("en", { granularity: "sentence" });
var normalize = (w) => {
  if (w.includes("-") && w[0] !== "-") return "!HYPHEN";
  if (/^\d{4}$/.test(w)) return "!YEAR";
  if (/^\d/.test(w)) return "!DIGITS";
  return w.toLowerCase();
};
var shapeOf = (w) => w.replace(/[A-Z]+/g, "X").replace(/[a-z]+/g, "x").replace(/[0-9]+/g, "d").slice(0, 6);
function tagFeatures(i, word, context, prev, prev2) {
  const f = [];
  const add = (...k) => f.push(k.join(" "));
  const w = context[i + 2];
  add("b");
  add("s3", w.slice(-3));
  add("s2", w.slice(-2));
  add("p1", w[0]);
  add("t-1", prev);
  add("t-2", prev2);
  add("t-1t-2", prev, prev2);
  add("w", w);
  add("t-1w", prev, w);
  add("w-1", context[i + 1]);
  add("s3-1", context[i + 1].slice(-3));
  add("w-2", context[i]);
  add("w+1", context[i + 3]);
  add("s3+1", context[i + 3].slice(-3));
  add("w+2", context[i + 4]);
  add("sh", shapeOf(word));
  add("cap", /^[A-Z]/.test(word) ? i === 0 ? "first" : "mid" : "no");
  return f;
}
function tagSentence(tagger, words2) {
  const context = ["-START-", "-START2-", ...words2.map(normalize), "-END-", "-END2-"];
  let prev = "-START-", prev2 = "-START2-";
  const tags = [];
  for (let i = 0; i < words2.length; i++) {
    const c = tagger.best(tagFeatures(i, words2[i], context, prev, prev2));
    const t = tagger.classes[c];
    tags.push(t);
    prev2 = prev;
    prev = t;
  }
  return tags;
}
var distBucket = (d) => d <= 4 ? String(d) : d <= 7 ? "5-7" : "8+";
function parseFeatures(st, words2, tags) {
  const f = [];
  const add = (...k) => f.push(k.join(" "));
  const s0 = st.stack.length ? st.stack[st.stack.length - 1] : -1;
  const s1 = st.stack.length > 1 ? st.stack[st.stack.length - 2] : -1;
  const n0 = st.i < st.n ? st.i : -1, n1 = st.i + 1 < st.n ? st.i + 1 : -1, n2 = st.i + 2 < st.n ? st.i + 2 : -1;
  const W2 = (k) => k < 0 ? "\u2205" : k === 0 ? "ROOT" : words2[k];
  const T = (k) => k < 0 ? "\u2205" : k === 0 ? "ROOT" : tags[k];
  const lc = (k) => k > 0 && st.left[k].length ? T(st.left[k][0]) : "\u2205";
  const rc = (k) => k > 0 && st.right[k].length ? T(st.right[k][st.right[k].length - 1]) : "\u2205";
  const s0w = W2(s0), s0t = T(s0), n0w = W2(n0), n0t = T(n0), n1t = T(n1), n2t = T(n2), n1w = W2(n1), s1t = T(s1);
  const dist = s0 > 0 && n0 > 0 ? distBucket(n0 - s0) : "\u2205";
  const s0h = s0 > 0 && st.head[s0] >= 0 ? T(st.head[s0]) : "\u2205";
  add("b");
  add("s0w", s0w);
  add("s0t", s0t);
  add("s0wt", s0w, s0t);
  add("n0w", n0w);
  add("n0t", n0t);
  add("n0wt", n0w, n0t);
  add("n1w", n1w);
  add("n1t", n1t);
  add("n2t", n2t);
  add("s1t", s1t);
  add("s0w n0w", s0w, n0w);
  add("s0t n0t", s0t, n0t);
  add("s0wt n0t", s0w, s0t, n0t);
  add("s0t n0wt", s0t, n0w, n0t);
  add("s0t n0t n1t", s0t, n0t, n1t);
  add("n0t n1t n2t", n0t, n1t, n2t);
  add("s1t s0t n0t", s1t, s0t, n0t);
  add("s0t s0l n0t", s0t, lc(s0), n0t);
  add("s0t s0r n0t", s0t, rc(s0), n0t);
  add("s0t n0t n0l", s0t, n0t, lc(n0));
  add("s0h s0t n0t", s0h, s0t, n0t);
  add("d s0t n0t", dist, s0t, n0t);
  add("d s0w", dist, s0w);
  add("d n0w", dist, n0w);
  add("vl s0", s0t, s0 > 0 ? st.left[s0].length : 0);
  add("vr s0", s0t, s0 > 0 ? st.right[s0].length : 0);
  add("vl n0", n0t, n0 > 0 ? st.left[n0].length : 0);
  add("s0hasHead", s0 > 0 ? String(st.head[s0] >= 0) : "\u2205");
  return f;
}
function newState(n) {
  return { n, i: 1, stack: [0], head: new Array(n).fill(-1), left: Array.from({ length: n }, () => []), right: Array.from({ length: n }, () => []) };
}
function validMoves(st) {
  const s0 = st.stack.length ? st.stack[st.stack.length - 1] : -1;
  const hasBuf = st.i < st.n;
  return [
    hasBuf,
    // SHIFT
    s0 > 0 && st.head[s0] >= 0,
    // REDUCE
    hasBuf && s0 > 0 && st.head[s0] < 0,
    // LEFT: n0 → s0
    hasBuf && s0 >= 0
    // RIGHT: s0 → n0
  ];
}
function apply(st, a) {
  const s0 = st.stack[st.stack.length - 1];
  if (a === 0) {
    st.stack.push(st.i);
    st.i++;
  } else if (a === 1) {
    st.stack.pop();
  } else if (a === 2) {
    st.head[s0] = st.i;
    st.left[st.i].unshift(s0);
    st.stack.pop();
  } else if (a === 3) {
    st.head[st.i] = s0;
    st.right[s0].push(st.i);
    st.stack.push(st.i);
    st.i++;
  }
}
function parseSentence(parser, words2, tags) {
  const n = words2.length;
  const st = newState(n);
  let guard = 0;
  while ((st.i < n || st.stack.length > 1) && guard++ < 4 * n + 10) {
    const valid = validMoves(st);
    if (!valid.some(Boolean)) break;
    const a = parser.best(parseFeatures(st, words2, tags), valid);
    apply(st, a);
  }
  const roots = [];
  for (let k = 1; k < n; k++) if (st.head[k] < 0 || st.head[k] === 0) roots.push(k);
  const root = roots[0] ?? 1;
  for (let k = 1; k < n; k++) {
    if (k === root) st.head[k] = 0;
    else if (st.head[k] < 0 || st.head[k] === 0) st.head[k] = root;
  }
  return st.head;
}
function labelFeatures(d, heads, words2, tags, children) {
  const h = heads[d];
  const f = [];
  const add = (...k) => f.push(k.join(" "));
  const dw = words2[d].toLowerCase(), dt = tags[d];
  const hw = h === 0 ? "ROOT" : words2[h].toLowerCase(), ht = h === 0 ? "ROOT" : tags[h];
  const dir = h === 0 ? "root" : d < h ? "L" : "R";
  add("b");
  add("dw", dw);
  add("dt", dt);
  add("hw", hw);
  add("ht", ht);
  add("dt ht", dt, ht);
  add("dt ht dir", dt, ht, dir);
  add("dw ht", dw, ht);
  add("dt hw", dt, hw);
  add("dir dist", dir, distBucket(Math.abs(d - h)));
  add("dsuf ht", dw.slice(-3), ht);
  add("dt ht dir dist", dt, ht, dir, distBucket(Math.abs(d - h)));
  for (const c of children[d]) {
    add("dchild", tags[c]);
    add("dchild w", words2[c].toLowerCase());
    add("dchild dt", tags[c], dt, ht);
  }
  const hh = h > 0 ? heads[h] : -1;
  add("hht", hh > 0 ? tags[hh] : hh === 0 ? "ROOT" : "\u2205", ht, dt);
  return f;
}
var childrenOf = (heads) => {
  const c = heads.map(() => []);
  for (let k = 1; k < heads.length; k++) if (heads[k] > 0) c[heads[k]].push(k);
  return c;
};
function labelSentence(labeller, heads, words2, tags) {
  const children = childrenOf(heads);
  const labels = new Array(heads.length).fill("_");
  for (let d = 1; d < heads.length; d++) labels[d] = heads[d] === 0 ? "root" : labeller.classes[labeller.best(labelFeatures(d, heads, words2, tags, children))];
  return labels;
}
function applyRule(form, rule) {
  const [cut, add] = [Number(rule.split(":")[0]), rule.split(":").slice(1).join(":")];
  const base = form.toLowerCase();
  return base.slice(0, base.length - cut) + add;
}
function lemmaAndFeats(lexicon, form, upos) {
  const lf = form.toLowerCase();
  const hit = lexicon.form[`${lf}|${upos}`];
  if (hit) {
    const [lemma, feats] = hit.split("	");
    return { lemma: upos === "PROPN" && lemma.toLowerCase() === lf ? form : lemma, feats, basis: "form" };
  }
  for (const k of [3, 2, 1]) {
    const r = lexicon.suffix[`${lf.slice(-k)}|${k}|${upos}`];
    if (r) {
      const [rule, feats] = r.split("	"), cut = Number(rule.split(":")[0]);
      if (cut > k || lf.length - cut + rule.split(":").slice(1).join(":").length < 3) continue;
      const lemma = applyRule(form, rule);
      return { lemma: upos === "PROPN" ? form : lemma, feats, basis: `ending -${lf.slice(-k)}` };
    }
  }
  return { lemma: upos === "PROPN" ? form : lf, feats: lexicon.upos[upos] ?? "_", basis: "word class" };
}
function analyse(model, forms) {
  const tags = tagSentence(model.tagger, forms);
  const words2 = ["ROOT", ...forms], T = ["ROOT", ...tags];
  const heads = parseSentence(model.parser, words2, T);
  const labels = labelSentence(model.labeller, heads, words2, T);
  return forms.map((form, k) => {
    const { lemma, feats } = lemmaAndFeats(model.lexicon, form, tags[k]);
    return { id: k + 1, form, lemma, upos: tags[k], xpos: "_", feats, head: heads[k + 1], deprel: labels[k + 1], deps: "_", misc: "_" };
  });
}
var CLOSED_UPOS = Object.freeze(["ADP", "AUX", "CCONJ", "DET", "PART", "PRON", "SCONJ"]);

// native/adapters/text/recursive.js
var slug2 = (value) => diaNorm(value).replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "");
var escapeRe3 = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
var WORD_RE3 = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
var FUNCTION_CLASSES2 = /* @__PURE__ */ new Set(["ADP", "CCONJ", "SCONJ", "DET", "PRON", "AUX", "PART", "INTJ", "NUM", "PUNCT", "SYM", "X"]);
var dominantOf = (counts, total2) => {
  if (!total2) return null;
  let best = null, n = -1;
  for (const [tag, count] of Object.entries(counts)) if (count > n) {
    n = count;
    best = tag;
  }
  return best;
};
function surfaceMap(events = []) {
  const map = /* @__PURE__ */ new Map();
  for (const event of events) {
    if (event?.type !== "DEF.admit") continue;
    map.set(diaNorm(event.surface), event.referent_id);
  }
  return map;
}
function referentObjects(events = []) {
  const byId = /* @__PURE__ */ new Map();
  for (const event of events) {
    if (event?.type !== "DEF.admit") continue;
    if (!byId.has(event.referent_id)) byId.set(event.referent_id, { schema: "EOReferent@1", id: event.referent_id, surfaces: [], provenance: [] });
    const ref = byId.get(event.referent_id);
    if (!ref.surfaces.includes(event.surface)) ref.surfaces.push(event.surface);
    ref.provenance.push(event.provenance);
  }
  return [...byId.values()].map((value) => Object.freeze({
    ...value,
    // THE CONSTITUTION-STANDING (2026-09-16): a being is on the record when
    // the reader admitted it BY EVIDENCE (recurrence past the material's own
    // floor — S24/P38: "presence is not establishment") — never by presence.
    // So every admitted referent carries `established_by_evidence` as its
    // standing, plus the mention count that earned it. The finer ladder
    // (hypothesized / sustained / contested) is the identity organ's to
    // adjudicate — its live alternatives, splits and refusals — never this
    // perceiver's, which only ever reports what it admitted.
    standing: "established_by_evidence",
    mentions: value.provenance.length,
    surfaces: Object.freeze(value.surfaces),
    provenance: Object.freeze(value.provenance)
  }));
}
var UNSPACED_EDGE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;
var PROCLITIC_DEPTH = 3;
var ENCLITIC_DEPTH2 = 2;
var isUnspacedNeedle = (needle) => {
  const cs = [...needle];
  return UNSPACED_EDGE.test(cs[0]) && UNSPACED_EDGE.test(cs[cs.length - 1]);
};
function containsSurface(text, surface, { proclitics = null, enclitics = null } = {}) {
  const hay = diaNorm(text);
  const needle = diaNorm(surface);
  if (!needle) return false;
  if (isUnspacedNeedle(needle)) return hay.includes(needle);
  const fused = proclitics && proclitics.size ? `(?:[${[...proclitics].map(escapeRe3).join("")}]{0,${PROCLITIC_DEPTH}})` : "";
  const bound = enclitics && enclitics.size ? `(?:${[...enclitics].sort((a, b) => b.length - a.length).map(escapeRe3).join("|")}){0,${ENCLITIC_DEPTH2}}` : "";
  return new RegExp(`(^|[^\\p{L}\\p{N}])${fused}${escapeRe3(needle)}${bound}([^\\p{L}\\p{N}]|$)`, "u").test(hay);
}
var ALNUM_RE = /[\p{L}\p{N}]/u;
var WORD_START_RE = /[\p{L}\p{N}]+/gu;
var alnumAt = (s, i) => i < s.length && ALNUM_RE.test(String.fromCodePoint(s.codePointAt(i)));
function onlyEnclitics(hay, at, restLen, enclitics) {
  const rest = hay.slice(at, at + restLen);
  const go = (r, depth) => r === "" || depth < ENCLITIC_DEPTH2 && [...enclitics].some((e) => r.startsWith(e) && go(r.slice(e.length), depth + 1));
  return rest.length > 0 && go(rest, 0);
}
function surfaceIndex(surfaces, { proclitics = null, enclitics = null } = {}) {
  const byFirst = /* @__PURE__ */ new Map();
  const fallback = [];
  const unspaced = [];
  const order = /* @__PURE__ */ new Map();
  for (const surface of surfaces) {
    const needle = diaNorm(surface);
    if (!needle || order.has(needle)) continue;
    order.set(needle, order.size);
    if (isUnspacedNeedle(needle)) {
      unspaced.push(needle);
      continue;
    }
    const m = needle.match(/^[\p{L}\p{N}]+/u);
    if (!m) {
      fallback.push(needle);
      continue;
    }
    if (!byFirst.has(m[0])) byFirst.set(m[0], []);
    byFirst.get(m[0]).push(needle);
  }
  return Object.freeze({ byFirst, fallback, unspaced, order, proclitics: proclitics && proclitics.size ? proclitics : null, enclitics: enclitics && enclitics.size ? enclitics : null });
}
function surfacesIn(text, index) {
  const hay = diaNorm(text);
  const present = /* @__PURE__ */ new Set();
  WORD_START_RE.lastIndex = 0;
  let m;
  while (m = WORD_START_RE.exec(hay)) {
    const cands = index.byFirst.get(m[0]);
    if (!cands) continue;
    for (const needle of cands) {
      if (present.has(needle)) continue;
      if (!hay.startsWith(needle, m.index)) continue;
      const after = m.index + needle.length;
      if (!alnumAt(hay, after) || index.enclitics && onlyEnclitics(hay, after, m[0].length - needle.length, index.enclitics)) present.add(needle);
    }
  }
  for (const needle of index.fallback) if (containsSurface(hay, needle)) present.add(needle);
  for (const needle of index.unspaced ?? []) if (hay.includes(needle)) present.add(needle);
  if (index.proclitics) {
    WORD_START_RE.lastIndex = 0;
    while (m = WORD_START_RE.exec(hay)) {
      const word = m[0];
      for (let k = 1; k <= PROCLITIC_DEPTH && k < word.length; k++) {
        if (!index.proclitics.has(word[k - 1])) break;
        const cands = index.byFirst.get(word.slice(k));
        if (!cands) continue;
        for (const needle of cands) {
          if (present.has(needle)) continue;
          if (hay.startsWith(needle, m.index + k) && !alnumAt(hay, m.index + k + needle.length)) present.add(needle);
        }
      }
    }
  }
  return [...present].sort((a, b) => index.order.get(a) - index.order.get(b));
}
function surfaceMatcher2(map, referents, bound = {}) {
  return Object.freeze({ index: surfaceIndex(map.keys(), bound), map, referents: referents.map((ref) => ({ ref, needles: new Set(ref.surfaces.map(diaNorm).filter(Boolean)) })) });
}
function currentReferents(text, matcher) {
  if (!matcher) return [];
  const present = new Set(surfacesIn(text, matcher.index));
  return matcher.referents.filter(({ ref, needles }) => [...needles].some((n) => present.has(n) || !matcher.index.order.has(n) && containsSurface(text, n, { proclitics: matcher.index.proclitics, enclitics: matcher.index.enclitics }))).map(({ ref }) => ref);
}
function referentsInSpan(span, matcher) {
  const matches = /* @__PURE__ */ new Map();
  for (const surface of surfacesIn(span, matcher.index)) {
    const ref = matcher.map.get(surface);
    if (!matches.has(ref)) matches.set(ref, []);
    matches.get(ref).push(surface);
  }
  return matches;
}
function resolveParticipant(surface, matcher, sequencePosition, relationIndex, role) {
  const occurrence2 = sha256hex(`occ|surface:${surface}|seq:${sequencePosition}|rel:${relationIndex}|role:${role}`);
  const exact = matcher.map.get(diaNorm(surface));
  if (exact) return { ref: exact, occurrence: occurrence2, role, standing: "referent", surface, resolution: "exact_surface" };
  const candidates = referentsInSpan(surface, matcher);
  if (candidates.size === 1) {
    const [[ref, matchedSurfaces]] = candidates;
    return { ref, occurrence: occurrence2, role, standing: "referent", surface, resolution: "unique_surface_in_span", matchedSurfaces };
  }
  const ds = diaNorm(surface);
  const contained = [];
  if (ds.length >= 3) {
    for (const [k, ref] of matcher.map) {
      const dk = diaNorm(k);
      if (dk.length >= 3 && (ds.includes(dk) || dk.includes(ds))) contained.push([ref, k]);
    }
    const uniq = new Set(contained.map(([ref]) => ref));
    if (uniq.size === 1) {
      return { ref: [...uniq][0], occurrence: occurrence2, role, standing: "referent", surface, resolution: "containment_surface_in_span", matchedSurfaces: contained.map(([, k]) => k) };
    }
  }
  const POSS = /^(my|her|his|our|their|your)\s+([\p{L}][\p{L}' -]{1,24})$/iu;
  const pm = POSS.exec(surface);
  if (pm) {
    const noun = diaNorm(pm[2]);
    const inside = matcher.map.get(noun);
    if (inside) return { ref: inside, occurrence: occurrence2, role, standing: "referent", surface, resolution: "possessive_head_surface", possessiveAnchor: pm[1].toLowerCase() };
    return { ref: `identity:poss:${noun}:${pm[1].toLowerCase()}`, occurrence: occurrence2, role, standing: "hypothesis", surface, resolution: "possessive_holding", possessiveAnchor: pm[1].toLowerCase() };
  }
  const lexical = slug2(surface) || "unknown";
  return {
    ref: occurrence2,
    occurrence: occurrence2,
    surfaceKey: `surface:${lexical}`,
    role,
    standing: "unresolved_surface",
    surface,
    candidateReferents: [...candidates.keys()]
  };
}
function earnedClosedClass(table) {
  if (!table?.total || table.freq.size === 0) return /* @__PURE__ */ new Set();
  const candidate = functionWordSet(table);
  return candidate.size * 2 < table.freq.size ? candidate : /* @__PURE__ */ new Set();
}
function relationStanding(verb, posPrior) {
  const counts = posPrior?.forms?.[diaNorm(String(verb ?? ""))];
  if (!counts) return Object.freeze({ eligible: true, basis: "no received evidence about this form; absence is not a refusal" });
  const total2 = Object.values(counts).reduce((sum, n) => sum + n, 0);
  if (!total2) return Object.freeze({ eligible: true, basis: "no received evidence about this form; absence is not a refusal" });
  let dominant3 = null, best = -1;
  for (const [tag, n] of Object.entries(counts)) if (n > best) {
    best = n;
    dominant3 = tag;
  }
  const eligible = dominant3 === "VERB";
  return Object.freeze({
    eligible,
    dominantClass: dominant3,
    share: best / total2,
    basis: eligible ? "treebank-dominant VERB \u2014 eligible as portable relation memory" : `treebank-dominant ${dominant3} \u2014 an auxiliary or non-verb form does not become familiarity by recurring`,
    giver: "UD_English-EWT via bin/priors/pos/en-ud-ewt.json"
  });
}
function lexicalNounOccurrences(text, sequencePosition, encounterRef, posPrior, source2) {
  if (!posPrior?.forms) return [];
  const out = [];
  for (const match of text.matchAll(WORD_RE3)) {
    const raw = match[0];
    const form = diaNorm(raw);
    const counts = posPrior.forms[form];
    if (!counts) continue;
    const total2 = Object.values(counts).reduce((sum, count) => sum + count, 0);
    const nounShare = total2 ? (counts.NOUN ?? 0) / total2 : 0;
    if (Number.isFinite(GRAMMAR_MIN_SHARE) && nounShare <= GRAMMAR_MIN_SHARE) continue;
    const surfaceKey = `surface:${slug2(raw) || "unknown"}`;
    const content = `lex|src:${source2 ?? ""}|seq:${sequencePosition}|off:${match.index}|surface:${raw}`;
    out.push(Object.freeze({
      schema: "EOLexicalOccurrence@1",
      id: sha256hex(content),
      surfaceKey,
      surface: raw,
      upos: "NOUN",
      standing: "occurrence",
      encounterRef,
      offset: match.index,
      witness: sha256hex(`${content}|wit`)
    }));
  }
  return out;
}
function taskTargetSurfaceKeys(orientation = {}) {
  const out = /* @__PURE__ */ new Set();
  for (const task of orientation.activeTasks ?? []) {
    for (const target of task.targets ?? []) {
      if (typeof target === "string" && target.startsWith("surface:")) out.add(target);
    }
  }
  return out;
}
function taskTargetOccurrences(text, sequencePosition, encounterRef, orientation, alreadySeen = /* @__PURE__ */ new Set(), source2 = null) {
  const out = [];
  for (const surfaceKey of taskTargetSurfaceKeys(orientation)) {
    if (alreadySeen.has(surfaceKey)) continue;
    const surface = surfaceKey.slice("surface:".length).replace(/_/g, " ");
    if (!surface || !containsSurface(text, surface)) continue;
    const content = `task-target|src:${source2 ?? ""}|seq:${sequencePosition}|surface:${surfaceKey}`;
    out.push(Object.freeze({
      schema: "EOTaskTargetOccurrence@1",
      id: sha256hex(content),
      surfaceKey,
      surface,
      standing: "task_nominated_occurrence",
      encounterRef,
      witness: sha256hex(`${content}|wit`),
      provenance: Object.freeze({ giver: "active-reading-task", basis: "targeted recurrence check" })
    }));
  }
  return out;
}
function mergeRelationEvidence(store, candidates = []) {
  for (const candidate of candidates) {
    if (!candidate?.verb) continue;
    if (!store.has(candidate.verb)) store.set(candidate.verb, { surfaceForms: /* @__PURE__ */ new Set(), relatedPairs: /* @__PURE__ */ new Set(), upos: candidate.upos ?? null, verbDominant: candidate.verbDominant !== false });
    const record = store.get(candidate.verb);
    for (const surface of candidate.surfaceForms ?? []) record.surfaceForms.add(surface);
    if (candidate.upos) record.upos = candidate.upos;
    if (candidate.verbDominant === false) record.verbDominant = false;
  }
}
function admittedRelationVerbs(store, minSurfaces, posPrior, language = null) {
  const verbs = /* @__PURE__ */ new Set();
  for (const [verb, record] of store) {
    if (record.verbDominant === false) continue;
    const anchorEvidence = record.surfaceForms.size;
    const relationEvidence = record.relatedPairs?.size ?? 0;
    if (anchorEvidence >= minSurfaces || relationEvidence >= minSurfaces) verbs.add(verb);
  }
  if (posPrior && (!posPrior.language || !language || posPrior.language === language)) {
    for (const form of receivedVerbTier(posPrior)) verbs.add(form);
  }
  return verbs;
}
var RECEIVED_VERB_TIERS = /* @__PURE__ */ new WeakMap();
function receivedVerbTier(posPrior) {
  const hit = RECEIVED_VERB_TIERS.get(posPrior);
  if (hit) return hit;
  const forms = posPrior.forms ?? posPrior;
  const tier = [];
  for (const [form, tags] of Object.entries(forms)) {
    const counts = Object.values(tags);
    const total2 = counts.reduce((a, b) => a + b, 0);
    if (!total2) continue;
    const verbish = (tags.VERB ?? 0) + (tags.AUX ?? 0);
    if (grammarIsDominant(verbish / total2)) tier.push(form);
  }
  RECEIVED_VERB_TIERS.set(posPrior, tier);
  return tier;
}
function witnessRelatedPairs(store, sentences, refs, matcher = null) {
  if (!refs?.size || !store.size) return;
  const index = matcher?.index ?? surfaceIndex(refs.keys());
  const verbs = [...store].map(([verb, record]) => [diaNorm(verb), record]);
  for (const sentence of sentences) {
    const hay = diaNorm(sentence.text);
    const present = surfacesIn(sentence.text, index).slice(0, 3).map((surface) => refs.get(surface));
    const distinct = [...new Set(present)];
    if (distinct.length < 2) continue;
    const pairKey = distinct.slice(0, 2).sort().join("\0");
    for (const [verb, record] of verbs) {
      if (!record.relatedPairs) record.relatedPairs = /* @__PURE__ */ new Set();
      if (hay.includes(verb)) record.relatedPairs.add(pairKey);
    }
  }
}
function createCausalTextPerceiver({ minRelationSurfaces = 2, refreshEvery = 1, reprojectEvery = null, posPrior = null, descriptorAnchoring = null, addresses = "birth", idFactory = null, recipe = null, language = null, roleConfig = null, parseModel = null, fragmentSeam = true, framePrior = null, proclitics = null, enclitics = null, contractions = null } = {}) {
  if (addresses !== "founder" && addresses !== "birth") throw new TypeError('addresses is "founder" or "birth"');
  if (!Number.isInteger(refreshEvery) || refreshEvery < 1) throw new TypeError("refreshEvery must be a positive integer");
  if (reprojectEvery != null && (!Number.isInteger(reprojectEvery) || reprojectEvery < 1)) throw new TypeError("reprojectEvery must be a positive integer when declared");
  const reprojectEveryFinal = reprojectEvery ?? refreshEvery;
  if (posPrior && (posPrior.schema !== "POSPrior@1" || !(posPrior.provenance?.source || posPrior.giver?.resource))) throw new TypeError("posPrior must be a giver-named POSPrior@1");
  const ear = makeEar({ posPrior, proclitics, enclitics, contractions });
  const { mode, discoverRelationVocab: discoverRelationVocab2, extractRelations: extractRelations2 } = relationExtractorsFor({ language, roleConfig, posPrior, classifyWord, dominantClass });
  const newId = (content) => idFactory && typeof idFactory === "function" ? idFactory(content ?? "") : content ? sha256hex(content) : sha256hex(`${Date.now()}:${Math.random()}`);
  const anchoring = descriptorAnchoring ? createDescriptorAnchoring(descriptorAnchoring) : null;
  const synPropnSeen = parseModel ? /* @__PURE__ */ new Set() : null;
  const priorSentences = [];
  let priorText = "";
  let relationRefreshFrom = 0;
  let reprojectedTo = 0;
  const relationEvidence = /* @__PURE__ */ new Map();
  let cache2 = { closed: /* @__PURE__ */ new Set(), refs: /* @__PURE__ */ new Map(), referents: [], matcher: surfaceMatcher2(/* @__PURE__ */ new Map(), [], { proclitics: ear.proclitics, enclitics: ear.enclitics }), gaps: [], merges: [], reassignments: [], verbs: /* @__PURE__ */ new Set() };
  const emittedMerges = /* @__PURE__ */ new Set();
  const surfaceEvidence = createSurfaceEvidence();
  const runningFreq = /* @__PURE__ */ new Map();
  let runningTotal = 0;
  let foldedTo = 0;
  const refresh = () => {
    for (const sent of priorSentences.slice(foldedTo)) {
      accumulateSurfaceEvidence([sent], surfaceEvidence);
      for (const w of tokenize(sent.text)) {
        runningFreq.set(w, (runningFreq.get(w) || 0) + 1);
        runningTotal += 1;
      }
      if (parseModel) {
        try {
          const toks = tokenize2(sent.text);
          const rows2 = analyse(parseModel, toks.map((t) => t.form));
          for (const r of rows2) if (r.upos === "PROPN") synPropnSeen.add(r.form.toLowerCase());
        } catch {
        }
      }
    }
    foldedTo = priorSentences.length;
    const table = { freq: runningFreq, total: runningTotal };
    const closed = earnedClosedClass(table);
    const minFigureRec = 2;
    const figures = /* @__PURE__ */ new Set();
    for (const [w, c] of runningFreq) {
      const lower = w.toLowerCase();
      if (c < minFigureRec || lower.length < wordFloor(lower, 3)) continue;
      if (closed.has(lower)) continue;
      if (posPrior?.forms?.[lower]) {
        const counts = posPrior.forms[lower];
        const total2 = Object.values(counts).reduce((a, b) => a + b, 0);
        const func = FUNCTION_CLASSES2.has(dominantOf(counts, total2));
        if (func) continue;
      }
      figures.add(lower);
    }
    cache2 = { ...cache2, figures };
    const newSinceReproject = priorSentences.length - reprojectedTo;
    const runReproject = newSinceReproject >= reprojectEveryFinal || reprojectedTo === 0 && newSinceReproject > 0;
    let surfaces = cache2.surfaces ?? [];
    let nextRefs = cache2.refs ?? /* @__PURE__ */ new Map();
    let referents = cache2.referents ?? [];
    let discovered = null;
    let reassignments = cache2.reassignments ?? [];
    if (runReproject) {
      surfaces = surfacesFromEvidence(surfaceEvidence, { functionWords: closed });
      if (parseModel) {
        surfaces = surfaces.filter((s) => (s.surface.toLowerCase().match(WORD_RE3) ?? []).some((w) => synPropnSeen.has(w)));
      }
      let heard = [];
      if (posPrior && framePrior) {
        if (!cache2.nominalIndex) cache2 = { ...cache2, nominalIndex: createNominalIndex({ posPrior, framePrior, segment: ear.segment, peel: ear.peel }) };
        try {
          for (let i = cache2.nominalIndex.size; i < priorSentences.length; i += 1) cache2.nominalIndex.add(priorSentences[i]);
          heard = cache2.nominalIndex.beings({ minMentions: 2 });
        } catch {
          heard = [];
        }
      } else if (posPrior) {
        if (!cache2.companyIndex) cache2 = { ...cache2, companyIndex: createCompanyIndex() };
        try {
          heard = heardSurfaces(priorSentences, { minMentions: 2, minShare: 0.3, minMembers: 2, posPrior, classifyWord, dominantClass, index: cache2.companyIndex, segment: ear.segment, proclitics: ear.proclitics });
        } catch {
          heard = [];
        }
      }
      if (heard.length && process.env.ER7_DEBUG_READER === "1") console.error(`[recursive] heardSurfaces added ${heard.length}: ${heard.map((h) => h.surface).join(",")}`);
      const capitalised = new Set(surfaces.map((x) => diaNorm(x.surface)));
      const combinedSurfaces = [...surfaces, ...heard.filter((h) => !capitalised.has(diaNorm(h.surface)))];
      discovered = discoverReferents(combinedSurfaces, addresses === "birth" ? { prior: { refs: cache2.refs, born: cache2.born ?? /* @__PURE__ */ new Map(), next: cache2.bornNext ?? 0 } } : {});
      nextRefs = surfaceMap(discovered.events);
      const originalSurface = /* @__PURE__ */ new Map();
      for (const e of discovered.events) if (e?.type === "DEF.admit" && !originalSurface.has(diaNorm(e.surface))) originalSurface.set(diaNorm(e.surface), e.surface);
      reassignments = [];
      for (const [key, from] of cache2.refs ?? []) {
        const to = nextRefs.get(key);
        if (to && to !== from) reassignments.push({ from, to, surface: originalSurface.get(key) ?? key, basis: "reassigned on refresh \u2014 the fuller name cleared its floor and this surface now points at a new address" });
      }
      referents = referentObjects(discovered.events);
      if (referents.length && process.env.ER7_DEBUG_READER === "1") console.error(`[recursive] refresh cast ${referents.length}: ${referents.map((r) => r.surfaces[0]).join(",")}`);
      reprojectedTo = priorSentences.length;
    }
    const batchSentences = priorSentences.slice(relationRefreshFrom);
    const batchText = batchSentences.map((sentence) => sentence.text).join("\n");
    if (batchText && surfaces.length) {
      const relationResult = discoverRelationVocab2(batchText, {
        surfaces,
        functionWords: closed,
        minSurfaces: 1,
        posPrior,
        figures: cache2.figures ?? null
      });
      mergeRelationEvidence(relationEvidence, relationResult.candidates);
    }
    const matcher = surfaceMatcher2(nextRefs, referents, { proclitics: ear.proclitics, enclitics: ear.enclitics });
    witnessRelatedPairs(relationEvidence, batchSentences, nextRefs, matcher);
    relationRefreshFrom = priorSentences.length;
    cache2 = {
      closed,
      refs: nextRefs,
      referents,
      matcher,
      surfaces,
      figures,
      gaps: discovered?.gaps ?? cache2.gaps,
      // THE MERGE RECORD, KEPT (P165). discoverReferents detects when two
      // surface clusters name one being and records it — `merges.push({kept,
      // folded, witness})` — and the projection reads it (a node at cursor 500
      // may be two nodes at cursor 200). Only recomputed at a reprojection.
      merges: discovered?.merges ?? cache2.merges,
      reassignments,
      born: discovered?.addresses?.born ?? cache2.born,
      bornNext: discovered?.addresses?.next ?? cache2.bornNext,
      verbs: admittedRelationVerbs(relationEvidence, minRelationSurfaces, posPrior, language),
      companyIndex: cache2.companyIndex,
      nominalIndex: cache2.nominalIndex
    };
  };
  return Object.freeze({
    id: "text/recursive",
    // Restore the perceiver's causal accumulators from the encounters that
    // produced the persisted log. A Fold seed alone cannot restore these
    // accumulators; without this replay, a resumed reader is a new instrument.
    async restore(entries = []) {
      for (const entry of entries) if (entry?.schema === "Encounter@1") await this.perceive(entry);
    },
    async perceive(encounter, orientation = {}) {
      if (encounter?.modality !== "text" || typeof encounter.material !== "string") return [];
      const sequencePosition = encounter.sequencePosition ?? priorSentences.length;
      const encounterRef = `encounter:${sequencePosition}`;
      if (priorSentences.length === 0 || priorSentences.length % refreshEvery === 0) refresh();
      const parsedRelations = extractRelations2(encounter.material, { verbs: cache2.verbs, functionWords: cache2.closed, phrasalPredicates: true, figures: cache2.figures ?? cache2.verbs });
      const relations = [
        ...parsedRelations,
        ...fragmentSeam ? fragmentRelations(encounter.material, { prior: posPrior, verbs: cache2.verbs }).filter((r) => !parsedRelations.some((p) => (p.end1 ?? p.subject) === r.end1 && (p.label ?? p.verb) === r.label && (p.end2 ?? p.object) === r.end2 && p.offset === r.offset)) : []
      ];
      const sourceScope = String(encounter.source ?? "text");
      const encounterBase = Number(encounter?.anchor?.start);
      const edges = relations.map((rel, index) => {
        const content = `edge|src:${sourceScope}|rel:${rel.label ?? rel.verb}|end1:${rel.end1 ?? rel.subject}|end2:${rel.end2 ?? rel.object}|off:${rel.offset}|recipe:${recipe ?? ""}`;
        const eid = newId(content);
        const ewit = newId(`${content}|wit`);
        const grain = rel.grain && !rel.grain.grain_gap ? rel.grain.grain : rel.grain_gap ? null : "Figure";
        return hyperedge({
          id: eid,
          relation: rel.label ?? rel.verb,
          participants: [
            resolveParticipant(rel.end1 ?? rel.subject, cache2.matcher, sequencePosition, index, "end1"),
            resolveParticipant(rel.end2 ?? rel.object, cache2.matcher, sequencePosition, index, "end2")
          ],
          witness: ewit,
          scope: { sequencePosition, offset: rel.offset, byteOffset: Number.isFinite(encounterBase) && Number.isFinite(rel.offset) ? encounterBase + rel.offset : null },
          eo: { op: rel.grain?.operator ?? "CON", grain: grain ?? "Figure" },
          // compositionStanding: whether this relation FORM is eligible to be
          // carried as portable experience or composed with another relation.
          // experience-priors.js reads exactly this field ("auxiliaries/noise
          // do not become familiarity merely because they appeared often") but
          // nothing on this side ever set it, so a reader's carried memory
          // filled with `were`/`would`/`has`/`could` — measured, not
          // hypothesized (the first experienced-new-book run's own carried
          // memory was 4 auxiliaries and nothing else). Decided by the SAME
          // received POS prior the descriptor-head gate already uses: a form
          // the treebank says is dominantly AUX (or any non-VERB class) is
          // ineligible; a form ABSENT from the prior stays eligible, the same
          // absent-is-a-gap-not-a-mismatch polarity that gate already holds.
          meta: { polarity: rel.polarity, source: encounter.source, encounterRef, compositionStanding: relationStanding(rel.label ?? rel.verb, posPrior) }
        });
      });
      const seenReferents = currentReferents(encounter.material, cache2.matcher);
      const mergeEntries = [];
      const witnessedMerges = (cache2.merges ?? []).map((m) => ({ ...m, basis: m.basis ?? "name-variant coreference \u2014 a witnessed merge, recorded where it was decided" }));
      for (const m of witnessedMerges) {
        const key = `${m.kept}|${[...m.folded ?? []].sort().join("+")}`;
        if (emittedMerges.has(key) || !m.kept || !(m.folded ?? []).length) continue;
        emittedMerges.add(key);
        const mergeContent = `merge|kept:${m.kept}|folded:${[...m.folded ?? []].sort().join("+")}|wit:${m.witness ?? ""}|recipe:${recipe ?? ""}`;
        mergeEntries.push(Object.freeze({
          schema: "EOReferentMerge@1",
          id: newId(mergeContent),
          kept: m.kept,
          folded: Object.freeze([...m.folded ?? []]),
          witness: m.witness ?? null,
          encounterRef: `encounter:${sequencePosition}`,
          provenance: { giver: "surfaces/discoverReferents", tier: "engine", basis: m.basis }
        }));
      }
      for (const r of cache2.reassignments ?? []) {
        const key = `${r.from}|${r.to}|${r.surface}`;
        if (emittedMerges.has(`reassignment:${key}`) || !r.from || !r.to || r.from === r.to) continue;
        emittedMerges.add(`reassignment:${key}`);
        const reassignmentContent = `reassignment|from:${r.from}|to:${r.to}|surface:${r.surface ?? ""}|recipe:${recipe ?? ""}`;
        mergeEntries.push(Object.freeze({
          schema: "EOReferentReassignment@1",
          id: newId(reassignmentContent),
          from: r.from,
          to: r.to,
          surface: r.surface ?? null,
          encounterRef: `encounter:${sequencePosition}`,
          provenance: { giver: "surfaces/discoverReferents", tier: "engine", basis: r.basis }
        }));
      }
      const mentions = seenReferents.map((ref) => {
        const mentionContent = `mention|src:${sourceScope}|enc:${encounterRef}|ref:${ref.id}`;
        return Object.freeze({
          schema: "EOMention@1",
          id: newId(mentionContent),
          referent: ref.id,
          encounterRef,
          anchor: encounter.anchor,
          witness: newId(`${mentionContent}|wit`),
          source: encounter.source
        });
      });
      const lexicalOccurrences = lexicalNounOccurrences(encounter.material, sequencePosition, encounterRef, posPrior, sourceScope);
      const lexicalKeys = new Set(lexicalOccurrences.map((occ) => occ.surfaceKey));
      const targetedOccurrences = taskTargetOccurrences(encounter.material, sequencePosition, encounterRef, orientation, lexicalKeys, sourceScope);
      const activeIds = new Set(seenReferents.map((ref) => ref.id));
      for (const edge of edges) for (const participant of edge.participants ?? []) if (participant.standing === "referent") activeIds.add(participant.ref);
      const gaps = cache2.gaps.filter((gap2) => activeIds.has(gap2.referent)).map((gap2) => ({ schema: "EOReferentGap@1", id: `gap:referent:${slug2(gap2.referent)}`, ...gap2 }));
      const currentSentence = { text: encounter.material, offset: encounter.anchor?.start ?? 0, order: priorSentences.length };
      let anchorEvidence = [];
      let descriptorOccsEmitted = [];
      if (anchoring) {
        const participantOccs = edges.flatMap((edge) => (edge.participants ?? []).filter((p) => p.standing === "unresolved_surface").map((p) => {
          const occ = descriptorOccurrence(p, { encounterRef, edge });
          return occ ? { ...occ, participantOccurrence: p.occurrence ?? p.ref } : null;
        }).filter(Boolean));
        const descriptorOccs = [...participantOccs, ...directDescriptorOccurrences(encounter.material, { encounterRef })].filter((occ) => {
          const head = (occ.canonicalSurface ?? "").split(/\s+/).at(-1);
          if (!head || cache2.closed.has(head)) return false;
          const counts = posPrior?.forms?.[diaNorm(head)];
          if (!counts) return true;
          const total2 = Object.values(counts).reduce((sum, count) => sum + count, 0);
          const nounShare = total2 ? ((counts.NOUN ?? 0) + (counts.PROPN ?? 0)) / total2 : 0;
          return nounShare > GRAMMAR_MIN_SHARE;
        });
        anchorEvidence = anchoring.observe(currentSentence, descriptorOccs, cache2.referents).evidence;
        descriptorOccsEmitted = descriptorOccs;
      }
      priorSentences.push(currentSentence);
      priorText += `${priorText ? "\n" : ""}${encounter.material}`;
      if (edges.length === 0 && seenReferents.length === 0 && lexicalOccurrences.length === 0 && targetedOccurrences.length === 0 && anchorEvidence.length === 0 && descriptorOccsEmitted.length === 0) return [];
      return [{
        candidate: {
          ...fragmentSeam ? { fragmentDisclosure: FRAGMENT_DISCLOSURE } : {},
          distinctions: [
            ...seenReferents.map((ref) => ({ referent: ref.id, surfaces: ref.surfaces })),
            ...edges.map((edge) => ({ relation: edge.relation, participants: edge.participants })),
            ...lexicalOccurrences.map((occ) => ({ occurrence: occ.id, surfaceKey: occ.surfaceKey, upos: occ.upos })),
            ...targetedOccurrences.map((occ) => ({ occurrence: occ.id, surfaceKey: occ.surfaceKey, taskNominated: true }))
          ],
          hyperedges: edges,
          graphEntries: [...cache2.referents, ...seenReferents, ...mergeEntries, ...mentions, ...lexicalOccurrences, ...targetedOccurrences, ...gaps, ...anchorEvidence, ...descriptorOccsEmitted]
        },
        anchor: encounter.anchor,
        evidence: encounter.material,
        nominationCause: targetedOccurrences.length ? ["bottom_up_difference", "active_task"] : "bottom_up_difference"
      }];
    }
  });
}
function textEncounters(text, { source: source2 = "text", offset = 0 } = {}) {
  return splitSentences(text).map((sentence) => ({
    schema: "Encounter@1",
    source: source2,
    modality: "text",
    anchor: { start: offset + sentence.offset, end: offset + sentence.offset + sentence.text.length },
    extent: sentence.text.length,
    material: sentence.text,
    sequencePosition: sentence.order
  }));
}

// native/kernel/assembly.js
var freeze2 = (value) => Object.freeze(value);
var TERRAINS = freeze2(Object.values(TERRAIN_BY_DOMAIN).flatMap((byGrain) => GRAINS.map((g) => byGrain[g])));
var DYNAMICS_FEEDS = freeze2(["surprise", "tension", "release"]);
var CONSUME_TAGS = freeze2(["prior", "witness"]);
var LAYERS = freeze2(["lattice", "baseline", "projection"]);
function stampDelta(delta, { id, version } = {}) {
  if (delta?.schema !== "DeltaFold@1") throw new TypeError("stampDelta requires a DeltaFold@1");
  if (typeof id !== "string" || !id.startsWith("assembly:") || !Number.isInteger(version))
    throw new TypeError("stampDelta: the producing assembly is named as { id, version } \u2014 an unattributed contribution is what A5 exists to prevent");
  const producer = freeze2({ id, version });
  return freeze2({
    ...delta,
    operations: freeze2((delta.operations ?? []).map((op) => freeze2({
      ...op,
      provenance: freeze2({ ...op.provenance ?? {}, assembly: producer })
    })))
  });
}

// native/kernel/expectations.js
var EXPECTATION_STATES = Object.freeze(["open", "strengthened", "weakened", "fulfilled", "violated", "reframed", "superseded"]);
function expectation({ id, hypothesis, giver, grounds = [], openedAt = null, scope = null, consequences = [], state = "open" }) {
  if (!id) throw new TypeError("Expectation requires id");
  if (!EXPECTATION_STATES.includes(state)) throw new TypeError(`unknown expectation state: ${state}`);
  return Object.freeze({ schema: "EOExpectation@1", id, hypothesis, giver, grounds: Object.freeze([...grounds]), openedAt, scope, consequences: Object.freeze([...consequences]), state });
}
function expectationTransition(current2, state, { witness, consequence = null, grain = "Figure", reframes = null } = {}) {
  if (!EXPECTATION_STATES.includes(state)) throw new TypeError(`unknown expectation state: ${state}`);
  const op = state === "reframed" || reframes ? "REC" : "EVA";
  return eoOperation({ op, grain, witness, inputs: [current2.id], outputs: [current2.id], consequence, payload: { action: "expectation", value: { ...current2, state, ...reframes ? { reframes } : {} } } });
}
function openExpectation(value, { witness, grain = "Figure", op = "INS", consequence = null } = {}) {
  return eoOperation({ op, grain, witness, inputs: [...value.grounds ?? []], outputs: [value.id], consequence, payload: { action: "expectation", value } });
}

// native/kernel/for-whom.js
var K256 = new Uint32Array([1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298]);

// native/kernel/identity.js
var norm3 = (x) => String(x ?? "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
var stablePair = (a, b) => [norm3(a), norm3(b)].sort();
var stable = (x) => JSON.stringify(x);
var identityId = (a, b) => {
  const [left, right] = stablePair(a, b);
  return `identity:${left.replace(/\s+/g, "_")}:${right.replace(/\s+/g, "_")}`;
};
var findAlternative = (fold, a, b) => {
  const id = identityId(a, b);
  return (fold?.unresolvedAlternatives ?? []).find((x) => x?.id === id) ?? null;
};
function identityAlternative({ left, right, standing = "live_hypothesis", supportRefs = [], attackRefs = [], giver = null } = {}) {
  const [a, b] = stablePair(left, right);
  if (!a || !b || a === b) throw new TypeError("identityAlternative requires two distinct forms");
  return Object.freeze({
    schema: "EOIdentityAlternative@1",
    id: identityId(a, b),
    left: a,
    right: b,
    standing,
    supportRefs: Object.freeze([...new Set(supportRefs.filter(Boolean))]),
    attackRefs: Object.freeze([...new Set(attackRefs.filter(Boolean))]),
    giver
  });
}
var participantValue = (participant) => {
  if (participant?.standing === "unresolved_surface" && participant?.surface) return norm3(participant.surface);
  return norm3(participant?.ref ?? participant?.value ?? participant?.surface);
};
var activeByValue = (alternatives = []) => {
  const by = /* @__PURE__ */ new Map();
  for (const x of alternatives ?? []) {
    if (x?.schema !== "EOIdentityAlternative@1" || x.standing === "distinct" || x.standing === "refused") continue;
    for (const v of [x.left, x.right]) {
      if (!by.has(v)) by.set(v, []);
      by.get(v).push(x);
    }
  }
  return by;
};
function canonicalizeHyperedge(edge, alternatives = [], byValue = null) {
  if (edge?.schema !== "EOHyperedge@1") throw new TypeError("canonicalizeHyperedge requires EOHyperedge@1");
  const active = byValue ?? activeByValue(alternatives);
  const participants = (edge.participants ?? []).map((participant) => {
    const value = participantValue(participant);
    const values = /* @__PURE__ */ new Set([value]);
    for (const identity of active.get(value) ?? []) {
      if (identity.left === value) values.add(identity.right);
      if (identity.right === value) values.add(identity.left);
    }
    return Object.freeze({ role: participant.role ?? null, value, alternatives: Object.freeze([...values].sort()) });
  });
  return Object.freeze({
    schema: "EOCanonicalHyperedge@1",
    id: `canonical:${edge.id}`,
    sourceEdge: edge.id,
    relation: edge.relation,
    participants: Object.freeze(participants),
    witness: edge.witness ?? null,
    scope: edge.scope ?? null
  });
}
var valuesOf = (edge) => (edge.participants ?? []).map(participantValue);
var emptyEdgeIndex = () => ({ byValue: /* @__PURE__ */ new Map(), byId: /* @__PURE__ */ new Map(), pos: /* @__PURE__ */ new Map(), canonical: /* @__PURE__ */ new Map(), n: 0 });
var foldEdgeIndex = (st, entries) => {
  for (const x of entries) {
    if (x?.schema === "EOCanonicalHyperedge@1") {
      st.canonical.set(x.sourceEdge, x);
      continue;
    }
    if (x?.schema !== "EOHyperedge@1") continue;
    st.byId.set(x.id, x);
    st.pos.set(x.id, st.n++);
    for (const v of new Set(valuesOf(x))) {
      if (!st.byValue.has(v)) st.byValue.set(v, []);
      st.byValue.get(v).push(x);
    }
  }
  return st;
};
var identityStats = { computes: 0 };
var edgeIndex = chainView(
  (list) => {
    identityStats.computes += 1;
    return foldEdgeIndex(emptyEdgeIndex(), list);
  },
  (st, d) => {
    foldEdgeIndex(st, d.appended);
    for (const x of d.updated) {
      if (x?.schema === "EOCanonicalHyperedge@1") {
        st.canonical.set(x.sourceEdge, x);
        continue;
      }
      if (x?.schema !== "EOHyperedge@1") continue;
      const old = st.byId.get(x.id);
      if (!old) return null;
      const before = [...new Set(valuesOf(old))].sort().join("\0"), after = [...new Set(valuesOf(x))].sort().join("\0");
      if (before !== after) return null;
      for (const v of new Set(valuesOf(x))) {
        const bucket = st.byValue.get(v);
        const i = bucket.findIndex((e) => e.id === x.id);
        if (i < 0) return null;
        bucket[i] = x;
      }
      st.byId.set(x.id, x);
    }
    return st;
  }
);
var currentCanonical = (index, edgeId) => index.canonical.get(edgeId) ?? null;
var touchedEdges = (index, identity) => {
  const seen = /* @__PURE__ */ new Map();
  for (const v of [identity.left, identity.right]) for (const e of index.byValue.get(v) ?? []) seen.set(e.id, e);
  return [...seen.values()].sort((a, b) => index.pos.get(a.id) - index.pos.get(b.id));
};
var meetsFloor = (alternative, floor) => !Number.isFinite(floor) || (alternative.supportRefs ?? []).length >= floor;
var touchesIdentity = (edge, identity) => valuesOf(edge).some((v) => v === identity.left || v === identity.right);
function recanonicalizationOperations(fold, extraEntries, alternatives, touchedIdentity, witness, floor) {
  const operations = [];
  const projecting = activeByValue(alternatives.filter((x) => meetsFloor(x, floor)));
  const index = edgeIndex(fold?.graphEntries ?? []);
  const extraCanonical = /* @__PURE__ */ new Map();
  const extraEdges = [];
  for (const x of extraEntries ?? []) {
    if (x?.schema === "EOCanonicalHyperedge@1" && !extraCanonical.has(x.sourceEdge)) extraCanonical.set(x.sourceEdge, x);
    else if (x?.schema === "EOHyperedge@1" && touchesIdentity(x, touchedIdentity)) extraEdges.push(x);
  }
  for (const edge of [...touchedEdges(index, touchedIdentity), ...extraEdges]) {
    const next = canonicalizeHyperedge(edge, null, projecting);
    const before = currentCanonical(index, edge.id) ?? extraCanonical.get(edge.id) ?? null;
    if (before && stable(before) === stable(next)) continue;
    operations.push(eoOperation({
      op: "REC",
      grain: "Figure",
      witness,
      inputs: [edge.id, touchedIdentity.id],
      outputs: [next.id],
      consequence: { kind: "relation_recanonicalized", sourceEdge: edge.id, identity: touchedIdentity.id, from: before?.participants ?? null, to: next.participants },
      payload: { action: "graph-object", value: next }
    }));
  }
  return operations;
}
function deriveIdentityRevision({ fold = {}, extraEntries = [], supports = [], attacks = [], witness = null, giver = null, canonicalizationFloor = void 0, forWhom = null } = {}) {
  if (canonicalizationFloor !== void 0 && (!Number.isInteger(canonicalizationFloor) || canonicalizationFloor < 1))
    throw new TypeError("deriveIdentityRevision: canonicalizationFloor, when declared, is a positive integer \u2014 how much corroboration licenses canonical projection is never a fraction or a guess");
  const operations = [];
  const working = new Map((fold?.unresolvedAlternatives ?? []).filter((x) => x?.schema === "EOIdentityAlternative@1").map((x) => [x.id, x]));
  const expId = (altId) => `expectation:${altId}`;
  const expWorking = new Map((fold?.expectations ?? []).filter((x) => x?.schema === "EOExpectation@1").map((x) => [x.id, x]));
  const expectationsOn = Number.isFinite(canonicalizationFloor);
  const expectFor = (alt, ref) => {
    if (!expectationsOn || (alt.supportRefs ?? []).length >= canonicalizationFloor) return;
    if (expWorking.has(expId(alt.id))) return;
    const value = expectation({
      id: expId(alt.id),
      hypothesis: `corroboration expected: ${alt.left} <-> ${alt.right}`,
      giver: alt.giver ?? null,
      grounds: [alt.id],
      openedAt: null
    });
    expWorking.set(value.id, value);
    operations.push(openExpectation(value, { witness: ref, consequence: { kind: "expectation_opened", expectation: value.id, identity: alt.id } }));
  };
  const transitionFor = (altId, state, ref, kind) => {
    if (!expectationsOn) return;
    const current2 = expWorking.get(expId(altId));
    if (!current2 || !["open", "strengthened", "weakened"].includes(current2.state)) return;
    const next = { ...current2, state };
    expWorking.set(next.id, next);
    operations.push(expectationTransition(current2, state, { witness: ref, consequence: { kind, expectation: current2.id, identity: altId } }));
  };
  for (const evidence of supports ?? []) {
    const left = norm3(evidence?.left), right = norm3(evidence?.right);
    if (!left || !right || left === right) continue;
    const prior = working.get(identityId(left, right)) ?? findAlternative(fold, left, right);
    if (prior?.standing === "distinct" || prior?.standing === "refused") continue;
    const ref = evidence?.witness ?? witness;
    const next = identityAlternative({ left, right, standing: "live_hypothesis", supportRefs: [...prior?.supportRefs ?? [], ref], attackRefs: prior?.attackRefs ?? [], giver: evidence?.giver ?? giver });
    working.set(next.id, next);
    operations.push(eoOperation({
      op: "CON",
      grain: "Figure",
      witness: ref,
      inputs: [next.left, next.right],
      outputs: [next.id],
      consequence: { kind: prior ? "identity_hypothesis_supported" : "identity_hypothesis_opened", identity: next.id },
      payload: { action: "alternative", value: next }
    }));
    if (!prior) {
      expectFor(next, ref);
    } else if ((next.supportRefs ?? []).length >= (canonicalizationFloor ?? Infinity)) {
      transitionFor(next.id, "fulfilled", ref, "expectation_fulfilled");
    } else {
      transitionFor(next.id, "strengthened", ref, "expectation_strengthened");
    }
    operations.push(...recanonicalizationOperations(fold, extraEntries, [...working.values()], next, ref, canonicalizationFloor));
  }
  for (const evidence of attacks ?? []) {
    const left = norm3(evidence?.left), right = norm3(evidence?.right);
    if (!left || !right || left === right) continue;
    const prior = working.get(identityId(left, right)) ?? findAlternative(fold, left, right);
    if (!prior || prior.standing === "distinct" || prior.standing === "refused") continue;
    const ref = evidence?.witness ?? witness;
    const next = identityAlternative({ left: prior.left, right: prior.right, standing: "distinct", supportRefs: prior.supportRefs ?? [], attackRefs: [...prior.attackRefs ?? [], ref], giver: evidence?.giver ?? giver ?? prior.giver });
    working.set(next.id, next);
    operations.push(eoOperation({
      op: "SEG",
      grain: "Figure",
      witness: ref,
      inputs: [prior.id],
      outputs: [next.id],
      consequence: { kind: "identity_split", identity: next.id, reason: evidence?.reason ?? "incompatible multiplicity" },
      payload: { action: "alternative", value: next }
    }));
    operations.push(eoOperation({
      op: "DEF",
      grain: "Figure",
      witness: ref,
      inputs: [prior.id],
      outputs: [`exclusion:${prior.id}`],
      consequence: { kind: "identity_reading_refused", identity: prior.id },
      payload: { action: "exclusion", value: Object.freeze({ schema: "EOExclusion@1", id: `exclusion:${prior.id}`, kind: "identity_refused", target: prior.id, witness: ref }) }
    }));
    transitionFor(prior.id, "violated", ref, "expectation_violated");
    operations.push(...recanonicalizationOperations(fold, extraEntries, [...working.values()], next, ref, canonicalizationFloor));
  }
  return deltaFold(operations, {
    schemaVersion: "EOIdentityRevision@1",
    // S113 / S42: a claim without a frame is a view from nowhere. When the
    // revision is made FOR a for-whom, the delta carries the frame it was read
    // under — absent when unsupplied, so every existing delta is byte-identical.
    ...forWhom ? { forWhom: forWhom.id, frame: Object.freeze({ giver: forWhom.giver ?? null, question: forWhom.question ?? null }) } : {}
  });
}

// native/adapters/text/discourse-referents.js
var WORD5 = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
var norm4 = (x) => (String(x ?? "").toLowerCase().match(WORD5) ?? []).join(" ");
var slug3 = (x) => norm4(x).replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "");
var descriptor = ({ encounterRef, offset, exactSurface, canonicalSurface, determination = "definite", basis }) => {
  const canon = canonicalSurface ?? norm4(exactSurface);
  return Object.freeze({
    schema: "EOReferentOccurrence@1",
    // A4 (THE-ADDRESS.md): content occurrence — the id hashes the
    // occurrence's own content (encounter + exact surface + canonical
    // surface + the discourse byte offset), so a re-read of the same
    // occurrence at the same position dedups and nothing else collides.
    id: sha256hex(`ref-occ|enc:${encounterRef ?? "unknown"}|discourse|off:${offset}|exact:${exactSurface}|canon:${canon}`),
    surface: exactSurface,
    canonicalSurface: canon,
    exactSurface,
    determination,
    role: null,
    encounterRef,
    edge: null,
    relation: null,
    standing: "unresolved_identity",
    provenance: Object.freeze({ giver: "text/discourse-referents", basis })
  });
};
var bind = ({ left, right, witness, kind, basis }) => Object.freeze({
  schema: "EODiscourseIdentityLink@1",
  // A5 (THE-ADDRESS.md): a link is an ACT over two occurrences — hashed over
  // (left + right + kind), so the same link under the same kind dedups and
  // a different pair is a different link. The occurrences' own ids are
  // content hashes, so the link's content is two content addresses + the
  // label.
  id: sha256hex(`discourse-link|left:${left.id}|right:${right.id}|kind:${kind}`),
  leftOccurrence: left.id,
  rightOccurrence: right.id,
  witness,
  kind,
  standing: "supported",
  provenance: Object.freeze({ giver: "text/discourse-referents", basis })
});
function appositionalDescriptorBindings(text, { encounterRef = "unknown", witness = null } = {}) {
  const source2 = String(text ?? "");
  const outOccurrences = [];
  const links = [];
  const re = /\b(the\s+[\p{L}][\p{L}\p{M}'’]*)\s*(?:—|–|-)\s*(the\s+([\p{L}][\p{L}\p{M}'’]*)(?:\s+([\p{L}][\p{L}\p{M}'’]*))?)(?=\s+(?:who|whom|that)\b|\s*[,;:])/giu;
  let m;
  while (m = re.exec(source2)) {
    const leftExact = m[1];
    const rightExact = m[2];
    const rightHead = `the ${m[4] ?? m[3]}`;
    const left = descriptor({
      encounterRef,
      offset: m.index,
      exactSurface: leftExact,
      canonicalSurface: norm4(leftExact),
      basis: "left side of explicit descriptor apposition"
    });
    const right = descriptor({
      encounterRef,
      offset: m.index + m[0].indexOf(rightExact),
      exactSurface: rightExact,
      canonicalSurface: norm4(rightHead),
      basis: "right side of explicit descriptor apposition; final lexical item projected as head"
    });
    outOccurrences.push(left, right);
    links.push(bind({
      left,
      right,
      witness,
      kind: "apposition",
      basis: "explicit appositional construction supports occurrence-level co-reference"
    }));
  }
  return Object.freeze({
    schema: "EOTextDiscourseBindings@1",
    occurrences: Object.freeze(outOccurrences),
    links: Object.freeze(links)
  });
}
var DiscourseState = class {
  constructor(base = null) {
    this.base = base;
    this.parent = /* @__PURE__ */ new Map();
    this.links = /* @__PURE__ */ new Map();
    this.groups = /* @__PURE__ */ new Map();
    this.index = /* @__PURE__ */ new Map();
    this.gone = /* @__PURE__ */ new Set();
    this.multi = /* @__PURE__ */ new Set();
    this.unmulti = /* @__PURE__ */ new Set();
    this.count = base ? base.count : 0;
    this.seq = base ? base.seq : 0;
    this.pending = base ? [...base.pending] : [];
  }
  getParent(x) {
    return this.parent.has(x) ? this.parent.get(x) : this.base?.getParent(x);
  }
  setParent(x, v) {
    this.parent.set(x, v);
  }
  hasOcc(id) {
    return this.getParent(id) !== void 0;
  }
  indexOf(id) {
    return this.index.has(id) ? this.index.get(id) : this.base?.indexOf(id);
  }
  getLinks(r) {
    if (this.links.has(r)) return this.links.get(r);
    if (this.gone.has(r)) return void 0;
    return this.base?.getLinks(r);
  }
  setLinks(r, arr) {
    this.links.set(r, arr);
    this.gone.delete(r);
  }
  appendLink(r, stamped) {
    if (this.links.has(r)) this.links.get(r).push(stamped);
    else this.setLinks(r, [...this.getLinks(r) ?? [], stamped]);
  }
  getGroup(r) {
    if (this.groups.has(r)) return this.groups.get(r);
    if (this.gone.has(r)) return void 0;
    return this.base?.getGroup(r);
  }
  setGroup(r, arr) {
    this.groups.set(r, arr);
    this.gone.delete(r);
  }
  appendOcc(r, occ) {
    if (this.groups.has(r)) this.groups.get(r).push(occ);
    else this.setGroup(r, [...this.getGroup(r) ?? [], occ]);
  }
  drop(r) {
    this.links.delete(r);
    this.groups.delete(r);
    this.gone.add(r);
  }
  isMulti(r) {
    if (this.multi.has(r)) return true;
    if (this.unmulti.has(r)) return false;
    return this.base ? this.base.isMulti(r) : false;
  }
  setMulti(r, on) {
    if (on) {
      this.multi.add(r);
      this.unmulti.delete(r);
    } else {
      this.unmulti.add(r);
      this.multi.delete(r);
    }
  }
  multiRoots() {
    const out = this.base ? this.base.multiRoots().filter((r) => !this.unmulti.has(r)) : [];
    for (const r of this.multi) out.push(r);
    return out;
  }
  find(x) {
    let p = this.getParent(x);
    if (p == null) return null;
    while (p !== this.getParent(p)) p = this.getParent(p);
    let y = x;
    while (this.getParent(y) !== p) {
      const next = this.getParent(y);
      this.setParent(y, p);
      y = next;
    }
    return p;
  }
  /** Swap an updated occurrence into its group if id, surface and canonicalSurface are unchanged; false demands a recompute. */
  replaceOcc(occ) {
    if (!this.hasOcc(occ.id)) return false;
    const r = this.find(occ.id);
    const group = this.getGroup(r) ?? [];
    const i = group.findIndex((g) => g.id === occ.id);
    if (i < 0) return false;
    const was = group[i];
    if (was.surface !== occ.surface || was.canonicalSurface !== occ.canonicalSurface) return false;
    if (was === occ) return true;
    if (this.groups.has(r)) group[i] = occ;
    else {
      const copy = [...group];
      copy[i] = occ;
      this.setGroup(r, copy);
    }
    return true;
  }
  addOcc(occ) {
    const i = this.count++;
    this.index.set(occ.id, i);
    if (!this.hasOcc(occ.id)) {
      this.setParent(occ.id, occ.id);
      this.setLinks(occ.id, []);
      this.setGroup(occ.id, [occ]);
      return;
    }
    const r = this.find(occ.id);
    this.appendOcc(r, occ);
    if ((this.getGroup(r) ?? []).length >= 2 && !this.isMulti(r)) this.setMulti(r, true);
  }
};
var mergeByIndex = (st, a = [], b = []) => {
  const out = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (st.indexOf(a[i].id) <= st.indexOf(b[j].id)) out.push(a[i++]);
    else out.push(b[j++]);
  }
  while (i < a.length) out.push(a[i++]);
  while (j < b.length) out.push(b[j++]);
  return out;
};
function foldDiscourse(st, entries) {
  const tryLink = (link) => {
    const ra = st.find(link.leftOccurrence);
    const rb = st.find(link.rightOccurrence);
    if (ra == null || rb == null) return false;
    const stamped = { seq: st.seq++, id: link.id };
    if (ra === rb) {
      st.appendLink(ra, stamped);
      return true;
    }
    const [keep, drop] = ra < rb ? [ra, rb] : [rb, ra];
    st.setParent(drop, keep);
    st.setLinks(keep, [...st.getLinks(keep) ?? [], ...st.getLinks(drop) ?? [], stamped]);
    st.setGroup(keep, mergeByIndex(st, st.getGroup(keep), st.getGroup(drop)));
    st.drop(drop);
    if (st.isMulti(drop)) st.setMulti(drop, false);
    if (!st.isMulti(keep)) st.setMulti(keep, true);
    return true;
  };
  for (const x of entries ?? []) {
    if (x?.schema === "EOReferentOccurrence@1") {
      st.addOcc(x);
      if (st.pending.length) st.pending = st.pending.filter((l) => !tryLink(l));
    } else if (x?.schema === "EODiscourseIdentityLink@1" && x.standing !== "refused") {
      if (!tryLink(x)) st.pending.push(x);
    }
  }
}
var discourseStats = { computes: 0 };
var discourseState = chainView(
  (graphEntries) => {
    discourseStats.computes += 1;
    const st = new DiscourseState();
    foldDiscourse(st, graphEntries);
    return st;
  },
  (st, d) => {
    foldDiscourse(st, d.appended);
    for (const x of d.updated) {
      if (x?.schema === "EODiscourseIdentityLink@1") return null;
      if (x?.schema !== "EOReferentOccurrence@1") continue;
      if (!st.replaceOcc(x)) return null;
    }
    return st;
  }
);
var PROJECTION = /* @__PURE__ */ new WeakMap();
function projectState(st) {
  const roots = st.multiRoots().filter((r) => (st.getLinks(r) ?? []).length > 0);
  roots.sort((a, b) => st.indexOf(st.getGroup(a)[0].id) - st.indexOf(st.getGroup(b)[0].id));
  const referents = [];
  for (const root of roots) {
    const group = st.getGroup(root);
    const stampedLinks = st.getLinks(root);
    const linkedIds = [...new Map([...stampedLinks].sort((a, b) => a.seq - b.seq).map((l) => [l.id, l])).keys()];
    const surfaces = [...new Set(group.map((x) => x.canonicalSurface).filter(Boolean))];
    referents.push(Object.freeze({
      schema: "EOReferent@1",
      id: `ref:discourse:${slug3(root)}`,
      display: group[0].surface,
      surfaces: Object.freeze(surfaces),
      occurrenceRefs: Object.freeze(group.map((x) => x.id)),
      supportRefs: Object.freeze([...linkedIds]),
      standing: "provisional",
      revisable: true,
      provenance: Object.freeze({
        giver: "text/discourse-referents::projectDiscourseReferents",
        basis: "connected component of explicitly supported occurrence-level identity links"
      })
    }));
  }
  return Object.freeze(referents);
}
var touchesDiscourse = (entries = []) => entries.some((x) => x?.schema === "EOReferentOccurrence@1" || x?.schema === "EODiscourseIdentityLink@1" && x.standing !== "refused");
function projectDiscourseReferentsWith(foldEntries = [], extraEntries = []) {
  if (!touchesDiscourse(extraEntries)) return projectDiscourseReferents(foldEntries);
  const layer = new DiscourseState(discourseState(foldEntries));
  foldDiscourse(layer, extraEntries);
  return projectState(layer);
}
function projectDiscourseReferents(graphEntries = []) {
  const st = discourseState(graphEntries);
  const cached = PROJECTION.get(st);
  if (cached && cached.count === st.count && cached.seq === st.seq) return cached.value;
  const value = projectState(st);
  PROJECTION.set(st, { count: st.count, seq: st.seq, value });
  return value;
}

// native/adapters/text/identity-evidence.js
var WORD6 = /\p{L}[\p{L}\p{M}'’]*/gu;
var TITLE = /^\p{Lu}/u;
var LOWER = /^\p{Ll}/u;
var APPOSITIONAL_DELIMITER = /^\s*[,;:—–-]\s*$/u;
var APPOSITIONAL_CLOSE = /^\s*[,;:—–-]/u;
var norm5 = (x) => String(x ?? "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
var DESCRIPTOR_CLASSES = Object.freeze(/* @__PURE__ */ new Set(["NOUN", "ADJ"]));
var CONJUNCTION_CLASSES = Object.freeze(/* @__PURE__ */ new Set(["CCONJ"]));
var namingTokenTest = (posPrior, classifyWord2, dominantClass2, classShare) => {
  if (!(posPrior && classifyWord2 && dominantClass2)) return (token) => TITLE.test(token);
  return (token) => {
    const d = dominantClass2(classifyWord2(token, { posPrior }), { minShare: classShare });
    return !d || !d.upos || d.upos === "PROPN";
  };
};
var descriptorTokenTest = (posPrior, classifyWord2, dominantClass2, classShare) => {
  if (!(posPrior && classifyWord2 && dominantClass2)) return (token) => LOWER.test(token);
  return (token) => {
    const d = dominantClass2(classifyWord2(token, { posPrior }), { minShare: classShare });
    return !!(d && d.upos && (DESCRIPTOR_CLASSES.has(d.upos) || CONJUNCTION_CLASSES.has(d.upos)));
  };
};
var rows = (text) => [...String(text ?? "").matchAll(WORD6)].map((m, at) => ({
  token: m[0],
  key: norm5(m[0]),
  at,
  charStart: m.index,
  charEnd: m.index + m[0].length
}));
var supportEvidence = (text, witness, giver, { determiners, isNamingToken, isDescriptorToken }) => {
  const rs = rows(text);
  const supports = [];
  for (let i = 0; i < rs.length; i += 1) {
    if (!determiners.has(rs[i].key)) continue;
    for (let nameAt = i + 2; nameAt <= Math.min(i + 5, rs.length - 1); nameAt += 1) {
      if (!isNamingToken(rs[nameAt].token)) continue;
      const descriptorRows = rs.slice(i + 1, nameAt);
      if (!descriptorRows.length || !descriptorRows.every((x) => isDescriptorToken(x.token))) continue;
      const delimiter = text.slice(descriptorRows.at(-1).charEnd, rs[nameAt].charStart);
      const afterName = text.slice(rs[nameAt].charEnd, rs[nameAt + 1]?.charStart ?? text.length);
      const delimited = APPOSITIONAL_DELIMITER.test(delimiter) && APPOSITIONAL_CLOSE.test(afterName);
      const bare = /^\s+$/u.test(delimiter);
      if (!delimited && !bare) continue;
      supports.push(Object.freeze({
        left: [rs[i].key, ...descriptorRows.map((x) => x.key)].join(" "),
        right: rs[nameAt].key,
        witness,
        giver,
        reason: delimited ? "text_appositional_identity" : "text_bare_appositional_identity"
      }));
    }
  }
  return supports;
};
var copularEvidence = (text, witness, giver, { determiners, copulaParadigm, subjectPronouns, neverAName, isNamingToken, isDescriptorToken }) => {
  const rs = rows(text);
  const supports = [];
  for (let i = 0; i < rs.length; i += 1) {
    if (!isNamingToken(rs[i].token)) continue;
    if (subjectPronouns.has(rs[i].key) || neverAName.has(rs[i].key) || determiners.has(rs[i].key)) continue;
    const cop = rs[i + 1];
    if (!cop || !copulaParadigm[cop.key]) continue;
    const det = rs[i + 2];
    if (!det || !determiners.has(det.key)) continue;
    const descriptorRows = rs.slice(i + 3, i + 4);
    if (!descriptorRows.length || !descriptorRows.every((x) => isDescriptorToken(x.token))) continue;
    supports.push(Object.freeze({
      left: rs[i].key,
      right: [det.key, ...descriptorRows.map((x) => x.key)].join(" "),
      witness,
      giver,
      reason: "text_copular_identity"
    }));
  }
  return supports;
};
var ALT_INDEX = /* @__PURE__ */ new WeakMap();
var alternativesIndex = (alternatives) => {
  let idx = ALT_INDEX.get(alternatives);
  if (idx) return idx;
  const byFirst = /* @__PURE__ */ new Map();
  const rows_ = [];
  (alternatives ?? []).forEach((identity, i) => {
    if (identity?.schema !== "EOIdentityAlternative@1" || identity.standing === "distinct" || identity.standing === "refused") return;
    const leftT = norm5(identity.left).split(/\s+/).filter(Boolean);
    const rightT = norm5(identity.right).split(/\s+/).filter(Boolean);
    const row = { identity, i, leftT, rightT, leftWidth: norm5(identity.left).split(/\s+/).length, key: `${norm5(identity.left)}\0${norm5(identity.right)}`, rkey: `${norm5(identity.right)}\0${norm5(identity.left)}` };
    rows_.push(row);
    for (const t of new Set([leftT[0], rightT[0]].filter(Boolean))) {
      if (!byFirst.has(t)) byFirst.set(t, []);
      byFirst.get(t).push(row);
    }
  });
  idx = { byFirst, rows: rows_ };
  ALT_INDEX.set(alternatives, idx);
  return idx;
};
var phraseStartsAt = (rs, target, first) => {
  const starts = [];
  if (!target.length) return starts;
  for (const i of first.get(target[0]) ?? []) {
    if (i > rs.length - target.length) continue;
    let match = true;
    for (let j = 1; j < target.length; j += 1) if (rs[i + j].key !== target[j]) {
      match = false;
      break;
    }
    if (match) starts.push({ start: i, end: i + target.length - 1 });
  }
  return starts;
};
var attackEvidence = (text, alternatives, supports, witness, giver) => {
  const rs = rows(text);
  const supportKeys = new Set(supports.map((x) => `${norm5(x.left)}\0${norm5(x.right)}`));
  const attacks = [];
  const first = /* @__PURE__ */ new Map();
  rs.forEach((r, i) => {
    if (!first.has(r.key)) first.set(r.key, []);
    first.get(r.key).push(i);
  });
  const { byFirst } = alternativesIndex(alternatives);
  const candidates = /* @__PURE__ */ new Map();
  for (const t of first.keys()) for (const row of byFirst.get(t) ?? []) candidates.set(row.i, row);
  for (const row of [...candidates.values()].sort((a, b) => a.i - b.i)) {
    const { identity } = row;
    const leftHits = phraseStartsAt(rs, row.leftT, first);
    const rightHits = phraseStartsAt(rs, row.rightT, first);
    if (!leftHits.length || !rightHits.length) continue;
    if (supportKeys.has(row.key) || supportKeys.has(row.rkey)) continue;
    const leftWidth = row.leftWidth;
    const separated = leftHits.some((left) => rightHits.some((right) => {
      const leftCenter = (left.start + left.end) / 2;
      const rightCenter = (right.start + right.end) / 2;
      return Math.abs(rightCenter - leftCenter) > leftWidth + 3;
    }));
    if (!separated) continue;
    attacks.push(Object.freeze({
      left: identity.left,
      right: identity.right,
      witness,
      giver,
      reason: "text_separated_copresentation"
    }));
  }
  return attacks;
};
function textIdentityEvidence(text, {
  alternatives = [],
  witness = null,
  giver = "lang/en:text-identity@1",
  determiners = null,
  copulaParadigm = null,
  subjectPronouns = null,
  neverAName = null,
  posPrior = null,
  classifyWord: classifyWord2 = null,
  dominantClass: dominantClass2 = null,
  classShare = GRAMMAR_MIN_SHARE
} = {}) {
  const source2 = String(text ?? "");
  const dets = determiners ?? /* @__PURE__ */ new Set([...DEFINITE_DETERMINERS, ...INDEFINITE_DETERMINERS]);
  const cops = copulaParadigm ?? COPULA_PARADIGM;
  const subjPron = subjectPronouns ?? SUBJECT_PRONOUNS;
  const neverName = neverAName ?? NEVER_A_NAME;
  const isNamingToken = namingTokenTest(posPrior, classifyWord2, dominantClass2, classShare);
  const isDescriptorToken = descriptorTokenTest(posPrior, classifyWord2, dominantClass2, classShare);
  const supports = [
    ...supportEvidence(source2, witness, giver, { determiners: dets, isNamingToken, isDescriptorToken }),
    ...copularEvidence(source2, witness, giver, { determiners: dets, copulaParadigm: cops, subjectPronouns: subjPron, neverAName: neverName, isNamingToken, isDescriptorToken })
  ];
  const attacks = attackEvidence(source2, alternatives, supports, witness, giver);
  return Object.freeze({
    schema: "EOTextIdentityEvidence@1",
    supports: Object.freeze(supports),
    attacks: Object.freeze(attacks)
  });
}

// native/adapters/text/revision.js
var existingIds = (fold) => {
  const base = idSetOf(fold?.graphEntries ?? []);
  const added = /* @__PURE__ */ new Set();
  return { has: (id) => base.has(id) || added.has(id), add: (id) => added.add(id) };
};
async function reviseTextFold({ observations = [], fold = {}, canonicalizationFloor = void 0, assembly = null } = {}) {
  const known = existingIds(fold);
  const operations = [];
  const newDescriptorOccurrences = [];
  const currentGraphEntries = [];
  const identitySupports = [];
  const identityAttacks = [];
  const admittedReferents = [];
  const referencedThisTurn = /* @__PURE__ */ new Set();
  const admitGraphObject = (value, { op = "INS", grain = "Ground", witness = null, consequence = null } = {}) => {
    if (!value?.id || known.has(value.id)) return false;
    known.add(value.id);
    currentGraphEntries.push(value);
    operations.push(eoOperation({
      op,
      grain,
      witness,
      outputs: [value.id],
      consequence,
      payload: { action: "graph-object", value }
    }));
    return true;
  };
  const admitOccurrence = (occurrence2, witnessRef) => {
    if (!occurrence2 || !admitGraphObject(occurrence2, {
      op: "INS",
      grain: "Ground",
      witness: witnessRef,
      consequence: { kind: "referent_occurrence_witnessed", occurrence: occurrence2.id }
    })) return;
    newDescriptorOccurrences.push(occurrence2);
  };
  for (const observation of observations) {
    const witnessRef = observation?.id ?? observation?.witness ?? null;
    const encounterRef = observation?.provenance?.source != null ? `${observation.provenance.source}:${observation.anchor?.start ?? observation.id ?? "?"}` : observation?.id ?? "unknown";
    const identity = textIdentityEvidence(observation?.witness, {
      alternatives: fold?.unresolvedAlternatives ?? [],
      witness: witnessRef
    });
    identitySupports.push(...identity.supports);
    identityAttacks.push(...identity.attacks);
    for (const occurrence2 of directDescriptorOccurrences(observation?.witness, { encounterRef })) {
      admitOccurrence(occurrence2, witnessRef);
    }
    const discourse = appositionalDescriptorBindings(observation?.witness, {
      encounterRef,
      witness: witnessRef
    });
    for (const occurrence2 of discourse.occurrences) admitOccurrence(occurrence2, witnessRef);
    for (const link of discourse.links) {
      admitGraphObject(link, {
        op: "CON",
        grain: "Figure",
        witness: witnessRef,
        consequence: { kind: "discourse_identity_supported", link: link.id }
      });
    }
    for (const entry of observation?.graphEntries ?? []) {
      currentGraphEntries.push(entry);
      if (entry?.referent) referencedThisTurn.add(entry.referent);
      if (entry?.referentId) referencedThisTurn.add(entry.referentId);
      if (entry?.schema !== "EOReferent@1" || !entry.id || known.has(entry.id)) continue;
      known.add(entry.id);
      admittedReferents.push(entry.id);
      const fedBy = (observation?.graphEntries ?? []).filter((x) => x?.id && x.id !== entry.id && (x.referent === entry.id || x.referentId === entry.id)).map((x) => x.id);
      operations.push(eoOperation({
        op: "INS",
        grain: "Figure",
        witness: witnessRef,
        inputs: fedBy,
        outputs: [entry.id],
        consequence: { kind: "referent_admitted", ref: entry.id },
        payload: { action: "graph-object", value: fedBy.length ? { ...entry, fedBy: Object.freeze(fedBy) } : entry }
      }));
    }
    for (const edge of observation?.hyperedges ?? []) {
      if (edge?.schema !== "EOHyperedge@1") continue;
      currentGraphEntries.push(edge);
      for (const participant of edge.participants ?? []) {
        if (participant?.ref) referencedThisTurn.add(participant.ref);
        admitOccurrence(descriptorOccurrence(participant, {
          encounterRef: edge.meta?.encounterRef ?? encounterRef,
          edge
        }), witnessRef);
      }
      if (!edge.id || known.has(edge.id)) continue;
      known.add(edge.id);
      operations.push(eoOperation({
        op: "CON",
        grain: "Figure",
        witness: witnessRef,
        inputs: (edge.participants ?? []).map((participant) => participant.ref).filter(Boolean),
        outputs: [edge.id],
        consequence: { kind: "relation_witnessed", edge: edge.id },
        payload: { action: "hyperedge", value: edge }
      }));
    }
  }
  for (const hypothesis of descriptorHypothesesWith(fold?.graphEntries ?? [], newDescriptorOccurrences, { changedOnly: true })) {
    if (known.has(hypothesis.id)) continue;
    known.add(hypothesis.id);
    operations.push(eoOperation({
      op: "CON",
      grain: "Figure",
      inputs: [...hypothesis.occurrenceRefs],
      outputs: [hypothesis.id],
      consequence: { kind: "identity_hypothesis_opened", hypothesis: hypothesis.id },
      payload: { action: "provisional", value: hypothesis }
    }));
  }
  for (const referent of projectDiscourseReferentsWith(fold?.graphEntries ?? [], currentGraphEntries)) {
    if (known.has(referent.id)) continue;
    admitGraphObject(referent, {
      op: "INS",
      grain: "Figure",
      consequence: {
        kind: "contextual_referent_admitted",
        ref: referent.id,
        defeasibleBy: ["SEG", "DEF", "REC"]
      }
    });
  }
  const anchors = observations.flatMap((o) => (o?.graphEntries ?? []).filter((x) => x?.schema === "EOAnchorEvidence@1"));
  if (anchors.length) {
    const anchorEvidence = identityEvidenceFromAnchors(anchors, fold);
    identitySupports.push(...anchorEvidence.supports);
    identityAttacks.push(...anchorEvidence.attacks);
  }
  const identityDelta = deriveIdentityRevision({
    fold,
    extraEntries: currentGraphEntries,
    supports: identitySupports,
    attacks: identityAttacks,
    canonicalizationFloor
  });
  operations.push(...identityDelta.operations);
  const OPEN_X = /* @__PURE__ */ new Set(["open", "strengthened", "weakened"]);
  const priorExpectations = fold?.expectations ?? [];
  for (const exp of priorExpectations) {
    if (exp?.schema !== "EOExpectation@1" || !OPEN_X.has(exp.state)) continue;
    const ref = exp?.scope?.ref ?? exp?.grounds?.[0];
    if (ref && referencedThisTurn.has(ref)) {
      operations.push(expectationTransition(exp, "fulfilled", { witness: "bharata:recurrence", consequence: { kind: "anticipation_fulfilled", ref } }));
    }
  }
  for (const ref of admittedReferents) {
    const exp = expectation({ id: `exp:recur:${ref}`, hypothesis: `${ref} recurs`, giver: "bharata", grounds: [ref], scope: { ref }, openedAt: (fold?.sequence ?? 0) + 1, state: "open" });
    operations.push(openExpectation(exp, { witness: "bharata:admitted", consequence: { kind: "anticipation_opened", ref } }));
  }
  const delta = deltaFold(operations);
  return assembly ? stampDelta(delta, assembly) : delta;
}
export {
  GRAIN_BY_THRAX,
  cellLabelOf,
  createCausalTextPerceiver,
  deriveAbbreviations,
  diaNorm,
  discoverGfpVocabulary,
  discoverReferents,
  discoverRelationVocab,
  extractGfpRelations,
  extractRelations,
  extractSurfaces,
  looksLikeMaterial,
  makeGrainTyper,
  namesCorefer,
  relationExtractorsFor,
  reviseTextFold,
  splitSentences,
  stripContainer,
  textEncounters
};
