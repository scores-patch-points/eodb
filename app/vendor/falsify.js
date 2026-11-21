var Falsify = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // ../khora-clone/vendor/the-fold/fold-chat-falsify-answer.js
  var fold_chat_falsify_answer_exports = {};
  __export(fold_chat_falsify_answer_exports, {
    FAILING: () => FAILING,
    FALSIFY: () => FALSIFY,
    claimQuery: () => claimQuery,
    claimSentences: () => claimSentences,
    clausesOf: () => clausesOf,
    falsifyAnswer: () => falsifyAnswer,
    governedPredicate: () => governedPredicate,
    namesOf: () => namesOf,
    negationFlips: () => negationFlips,
    normalizeForms: () => normalizeForms,
    passagesOfRecord: () => passagesOfRecord,
    pickPassages: () => pickPassages,
    reImpress: () => reImpress,
    replaceSentence: () => replaceSentence,
    restateClaimMessages: () => restateClaimMessages,
    roleConfusion: () => roleConfusion,
    routeOf: () => routeOf,
    sourcesOf: () => sourcesOf,
    withoutSourceTag: () => withoutSourceTag
  });

  // ../khora-clone/vendor/the-fold/fold-chat-foldtext.js
  var DIA_RE = /[áàâäéèêëíìîïóòôöúùûü]/g;
  var DIA_TO = { "\xE1": "a", "\xE0": "a", "\xE2": "a", "\xE4": "a", "\xE9": "e", "\xE8": "e", "\xEA": "e", "\xEB": "e", "\xED": "i", "\xEC": "i", "\xEE": "i", "\xEF": "i", "\xF3": "o", "\xF2": "o", "\xF4": "o", "\xF6": "o", "\xFA": "u", "\xF9": "u", "\xFB": "u", "\xFC": "u" };
  var GREEK_RE = /[άέήίόύώϊϋΐΰς]/g;
  var GREEK_TO = { "\u03AC": "\u03B1", "\u03AD": "\u03B5", "\u03AE": "\u03B7", "\u03AF": "\u03B9", "\u03CC": "\u03BF", "\u03CD": "\u03C5", "\u03CE": "\u03C9", "\u03CA": "\u03B9", "\u03CB": "\u03C5", "\u0390": "\u03B9", "\u03B0": "\u03C5", "\u03C2": "\u03C3" };
  function foldText(s) {
    const t = String(s ?? "");
    const n = t.normalize ? t.normalize("NFKC") : t;
    return n.replace(/[İı]/g, "i").toLowerCase().replace(DIA_RE, (c) => DIA_TO[c]).replace(GREEK_RE, (c) => GREEK_TO[c]);
  }
  var FOLD_SCOPE = Object.freeze({
    giver: "Latin vowels: the khora's diaNorm (perceiver/text/surfaces.js). Greek tonos/dialytika/final-sigma: the author, with its fixture. Constitution II.13 \xB7 2026-10-11",
    folds: "the five Latin vowels' acute/grave/circumflex/umlaut accents, and Greek tonos/dialytika and final sigma \u03C2\u2192\u03C3",
    doesNotFold: "\xF1 \xE7 \xF8 \xE5 \xE6 \xDF \u0161 \u017E \u0142, Cyrillic (\u0451/\u0439 are letters), Hebrew niqqud, Arabic tashkil, Devanagari/Thai matras"
  });

  // ../khora-clone/vendor/the-fold/fold-chat-mind.js
  var DECLARED = Object.freeze({
    // How many of the most active referents a question with no entity of its own
    // activates. Declared, not measured: the surface shows the carry and the
    // person can remove it. 2 keeps a person and the place they belong to.
    carryMax: 2,
    // How many candidates a clarifying question offers as clickable options (a presentation cap, not evidence).
    optionsMax: 4,
    // A question this long (in word-like segments) names enough on its own that
    // carrying a referent would be a guess, even if no known referent matched.
    selfSufficientSegments: 9,
    // Referent record cap: the oldest, least-active entries fall off.
    recordMax: 24,
    // Weight per turn of age (activation decays; THE-HOLOGRAPH §6 'decays at a
    // rate the material measures' — until measured, this is a declared 0.8).
    decay: 0.8
  });
  var SCRIPTS = [
    ["Han", /\p{Script=Han}/u],
    ["Hiragana", /\p{Script=Hiragana}/u],
    ["Katakana", /\p{Script=Katakana}/u],
    ["Hangul", /\p{Script=Hangul}/u],
    ["Arabic", /\p{Script=Arabic}/u],
    ["Hebrew", /\p{Script=Hebrew}/u],
    ["Devanagari", /\p{Script=Devanagari}/u],
    ["Thai", /\p{Script=Thai}/u],
    ["Cyrillic", /\p{Script=Cyrillic}/u],
    ["Greek", /\p{Script=Greek}/u],
    ["Latin", /\p{Script=Latin}/u]
  ];
  function scriptOf(text) {
    const counts = /* @__PURE__ */ new Map();
    for (const ch of String(text ?? "")) {
      if (!/\p{L}/u.test(ch)) continue;
      for (const [name, re] of SCRIPTS) if (re.test(ch)) {
        counts.set(name, (counts.get(name) || 0) + 1);
        break;
      }
    }
    if (counts.get("Hiragana") || counts.get("Katakana")) return "Japanese";
    let best = "Other", n = 0;
    for (const [k, v] of counts) if (v > n) {
      best = k;
      n = v;
    }
    return best;
  }
  var segmenters = /* @__PURE__ */ new Map();
  function segmenterFor(locale) {
    if (typeof Intl === "undefined" || !Intl.Segmenter) return null;
    if (!segmenters.has(locale)) segmenters.set(locale, new Intl.Segmenter(locale, { granularity: "word" }));
    return segmenters.get(locale);
  }
  var LOCALE_OF = { Han: "zh", Japanese: "ja", Hangul: "ko", Thai: "th", Arabic: "ar", Hebrew: "he", Devanagari: "hi", Cyrillic: "ru", Greek: "el", Latin: "en", Other: "en" };
  function segments(text, script = scriptOf(text)) {
    const s = String(text ?? "");
    const seg = segmenterFor(LOCALE_OF[script] || "en");
    const out = [];
    if (seg) {
      for (const x of seg.segment(s)) if (x.isWordLike) out.push({ text: x.segment, start: x.index, end: x.index + x.segment.length });
    } else {
      const re = /[\p{L}\p{N}][\p{L}\p{N}'’\-.]*/gu;
      let m;
      while ((m = re.exec(s)) !== null) out.push({ text: m[0], start: m.index, end: m.index + m[0].length });
    }
    return out;
  }
  function fold(s) {
    return foldText(s);
  }
  var SITE_NAMES = Object.freeze(["wikipedia", "wikip\xE9dia", "\u0432\u0438\u043A\u0438\u043F\u0435\u0434\u0438\u044F", "\u0432\u0456\u043A\u0456\u043F\u0435\u0434\u0456\u044F", "\u7EF4\u57FA\u767E\u79D1", "\u7DAD\u57FA\u767E\u79D1", "\u30A6\u30A3\u30AD\u30DA\u30C7\u30A3\u30A2", "\uC704\uD0A4\uBC31\uACFC", "\u0648\u064A\u0643\u064A\u0628\u064A\u062F\u064A\u0627", "\u05D5\u05D9\u05E7\u05D9\u05E4\u05D3\u05D9\u05D4", "\u0935\u093F\u0915\u093F\u092A\u0940\u0921\u093F\u092F\u093E", "\u0E27\u0E34\u0E01\u0E34\u0E1E\u0E35\u0E40\u0E14\u0E35\u0E22", "\u03B2\u03B9\u03BA\u03B9\u03C0\u03B1\u03AF\u03B4\u03B5\u03B9\u03B1", "vikipedi", "\u0648\u06CC\u06A9\u06CC\u200C\u067E\u062F\u06CC\u0627", "\u0648\u06CC\u06A9\u06CC\u067E\u062F\u06CC\u0627", "wikipedie", "wikipedija", "wikipedia"]);
  var SITE_RE = SITE_NAMES.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");

  // ../khora-clone/vendor/the-fold/fold-chat-function-words.js
  var GIVERS = Object.freeze({ "ar": { "file": "pos-arb.json", "giver": "Universal Dependencies", "tokens": 223881 }, "zh": { "file": "pos-cmn.json", "giver": "Universal Dependencies", "tokens": 98614 }, "el": { "file": "pos-ell.json", "giver": "Universal Dependencies", "tokens": 42326 }, "en": { "file": "pos-en.json", "giver": "Universal Dependencies", "tokens": 229726 }, "fa": { "file": "pos-fas.json", "giver": "Universal Dependencies", "tokens": 452496 }, "fi": { "file": "pos-fin.json", "giver": "Universal Dependencies", "tokens": 162815 }, "fr": { "file": "pos-fra.json", "giver": "Universal Dependencies", "tokens": 354647 }, "he": { "file": "pos-heb.json", "giver": "Universal Dependencies", "tokens": 136501 }, "ko": { "file": "pos-kor.json", "giver": "Universal Dependencies", "tokens": 56687 }, "la": { "file": "pos-lat.json", "giver": "Universal Dependencies", "tokens": 18259 }, "ru": { "file": "pos-rus.json", "giver": "Universal Dependencies", "tokens": 74900 }, "es": { "file": "pos-spa.json", "giver": "Universal Dependencies", "tokens": 453039 }, "tr": { "file": "pos-tur.json", "giver": "Universal Dependencies", "tokens": 37522 } });
  var FUNCTION_WORDS = Object.freeze({ "ar": ["\u0648", "\u0641\u064A", "\u0644", "\u0628", "\u0645\u0646", "\u0647", "\u0647\u0627", "\u0639\u0644\u0649", "\u0623\u0646", "\u0627\u0646", "\u0627\u0644\u0649", "\u0625\u0644\u0649", "\u0627\u0644\u062A\u064A", "\u0641\u0649", "\u0639\u0646", "\u0645\u0639", "\u0645\u0627", "\u0647\u0645", "\u0633", "\u0628\u064A\u0646", "\u0644\u0627", "\u0625\u0646", "\u0627\u0644\u0630\u064A", "\u0647\u0630\u0647", "\u062E\u0644\u0627\u0644", "\u0647\u0630\u0627", "\u0641", "\u0628\u0639\u062F", "\u0642\u062F", "\u0647\u0648", "\u0644\u0645", "\u0643\u0645\u0627", "\u0643", "\u0639\u0644\u064A", "\u0646\u0627", "\u0630\u0644\u0643", "\u0623\u0648", "\u0647\u064A", "\u062D\u064A\u062B", "\u062D\u062A\u0649", "\u0645\u0646\u0630", "\u0642\u0628\u0644", "\u0646\u062D\u0648", "\u062D\u0648\u0644", "\u0647\u0645\u0627", "\u0627\u0644\u062A\u0649", "\u0644\u0670\u0643\u0646", "\u062F\u0648\u0646", "\u0627\u0644\u0630\u064A\u0646", "\u064A\u0643\u0648\u0646", "\u0636\u062F", "\u0630\u0670\u0644\u0643", "\u0627\u0648", "\u062A\u0643\u0648\u0646", "\u0645\u062B\u0644", "\u0644\u0646", "\u0644\u064A\u0633", "\u0645\u0642\u0627\u0628\u0644", "\u0644\u0643\u0646", "\u062F\u0627\u062E\u0644", "\u0631\u063A\u0645", "\u0625\u0630\u0627", "\u0647\u0670\u0630\u0627", "\u0644\u062F\u0649", "\u0623\u0645\u0627\u0645", "\u0644\u0623\u0646", "\u062D\u064A\u0646", "\u0625\u0644\u064A", "\u062A\u0644\u0643", "\u0645\u0645\u0627", "\u0644\u0640", "\u0627\u0644\u0630\u0649", "\u0644\u062F\u064A", "\u0647\u0670\u0630\u0647", "\u062D\u0633\u0628", "\u0625\u0644\u0627", "\u062B\u0645", "\u062A\u062D\u062A", "\u0633\u0648\u0641", "\u0639\u0628\u0631", "\u0627\u0644\u0627", "\u0627\u0630\u0627", "\u064A", "\u0639\u0646\u062F", "\u0639\u0646\u062F\u0645\u0627", "\u0627\u0645\u0627\u0645", "\u062D\u0648\u0627\u0644\u064A", "\u0628\u0644", "\u062E\u0627\u0631\u062C", "\u0648\u0633\u0637", "\u0628\u0640", "\u0636\u0645\u0646", "\u0641\u064A\u0645\u0627", "\u0628\u064A\u0646\u0645\u0627", "\u0623\u0645\u0627", "\u0647\u0624\u0644\u0627\u0621", "\u0639\u0642\u0628", "\u0627\u0630", "\u0644\u0648", "\u0646\u062D\u0646", "\u0648\u0631\u0627\u0621", "\u0628\u0639\u062F\u0645\u0627", "\u0643\u0645", "\u0646\u064A", "\u0644\u064A\u0633\u062A", "\u0647\u0644", "\u0633\u0648\u0649", "\u0625\u0630", "\u0627\u062B\u0631", "\u0642\u0631\u0628", "\u0631\u0628\u0645\u0627", "\u0627\u0644", "\u062D\u0648\u0627\u0644\u0649", "\u0627\u0645\u0627", "\u0627\u0644\u0640", "\u0647\u0646", "\u0644\u0627\u0646", "\u062D\u0633\u0628\u0645\u0627", "\u062A\u062C\u0627\u0647", "\u0648\u0641\u0642", "\u0644\u0643\u064A", "\u0641\u0648\u0642", "\u0625\u0646\u0645\u0627", "\u0647\u0649", "\u0643\u064A", "\u0628\u064A\u062F", "\u0643\u064A\u0641", "\u0623\u062B\u0646\u0627\u0621", "\u0643\u0644\u0627", "\u062D\u064A\u0627\u0644", "\u0623\u0645", "\u0627\u062B\u0646\u0627\u0621", "\u0623\u0646\u0627", "\u0644\u0630\u0627", "\u0627\u0632\u0627\u0621", "\u062C\u0631\u0627\u0621", "\u0637\u0627\u0644\u0645\u0627", "\u0644\u0630\u0644\u0643", "\u0645\u0627\u0630\u0627", "\u0642\u0628\u064A\u0644", "\u0637\u0648\u0627\u0644", "\u0644\u0645\u0627\u0630\u0627", "\u0625\u0632\u0627\u0621", "\u0642\u0628\u0627\u0644\u0629", "\u0623\u064A\u0646", "\u0645\u062A\u0649", "\u0625\u0645\u0627", "\u0645\u0647\u0645\u0627", "\u0642\u0631\u0627\u0628\u0629", "\u0630\u064A", "\u0627\u0644\u0644\u0630\u064A\u0646", "\u0625\u064A\u0627", "\u0625\u062B\u0631", "\u0627\u0644\u0644\u0648\u0627\u062A\u064A", "\u062E\u0644\u0641", "\u0627\u0644\u0644\u062A\u064A\u0646", "\u0628\u0627\u0644\u062C\u0646\u064A\u0647", "\u0644\u0645\u0635\u0631", "\u0641\u0648\u0631", "\u064A\u0627", "\u0643\u0630\u0627"], "zh": ["\u7684", "\u5728", "\u662F", "\u70BA", "\u548C", "\u4E86", "\u4ED6", "\u4E2D", "\u8207", "\u88AB", "\u9019", "\u6703", "\u4E26", "\u4EE5", "\u800C", "\u4E5F", "\u4E0A", "\u4E4B", "\u5F8C", "\u6642", "\u53CA", "\u4F46", "\u5927", "\u5176", "\u5C0D", "\u6240", "\u6B64", "\u6216", "\u5C07", "\u5979", "\u8005", "\u81F3", "\u8A72", "\u5340", "\u5BB6", "\u90FD", "\u53EF\u4EE5", "\u90E8", "\u4F86", "\u56E0", "\u5E02", "\u8ECD", "\u570B", "\u7701", "\u5F9E", "\u8457", "\u5247", "\u5730", "\u4ED6\u5011", "\u6027", "\u5DDE", "\u65B0", "\u5C31", "\u7531\u65BC", "\u53EF", "\u81EA", "\u4E0B", "\u5C0F", "\u56E0\u70BA", "\u81EA\u5DF1", "\u7E23", "\u9084", "\u7E3D", "\u524D", "\u5411", "\u5B83", "\u7AD9", "\u4E5F\u662F", "\u9019\u4E9B", "\u6751", "\u4EE5\u53CA", "\u53C8", "\u5B78", "\u8981", "\u80FD", "\u4E4B\u5F8C", "\u4EA6", "\u5176\u4ED6", "\u70BA\u4E86", "\u7DDA", "\u628A", "\u904E", "\u53EF\u80FD", "\u5C40", "\u53F0", "\u9EE8", "\u4E4B\u9593", "\u968A", "\u4F46\u662F", "\u6839\u64DA", "\u6240\u6709", "\u6A5F", "\u8A9E", "\u4FBF", "\u7576", "\u6BD4", "\u5C31\u662F", "\u9577", "\u5C71", "\u93AE", "\u6CB3", "\u9928", "\u8DEF", "\u537B", "\u5404", "\u624D", "\u4E0D\u662F", "\u6587", "\u6559", "\u96D6\u7136", "\u6211", "\u54E1", "\u5BFA", "\u8857", "\u8D77", "\u5668", "\u53E6", "\u540C", "\u5F0F", "\u5982\u679C", "\u5F97", "\u5CF6", "\u6BCF", "\u7D1A", "\u6D3E", "\u9662", "\u9053", "\u7136\u800C", "\u90FD\u662F", "\u4E26\u4E14", "\u7269", "\u5B83\u5011", "\u5C0D\u65BC", "\u9EDE", "\u7D93\u904E", "\u5BA4", "\u57CE", "\u6B0A", "\u751A\u81F3", "\u88E1", "\u4E0D\u904E", "\u8CFD", "\u672C", "\u6211\u5011", "\u9109", "\u6E56", "\u4E3B", "\u5011", "\u696D", "\u5FC5\u9808", "\u65CF", "\u65BC\u662F", "\u79D1", "\u5316", "\u6D77", "\u578B", "\u91CF", "\u5168", "\u6574\u500B", "\u91CC", "\u7063", "\u529B", "\u7248", "\u53E4", "\u7387", "\u526F", "\u5E9C", "\u80FD\u5920", "\u5236", "\u6D0B", "\u9AD4", "\u539F", "\u5B57", "\u4E0D\u6703", "\u4E0D\u80FD", "\u4EE5\u4E0A", "\u6240\u4EE5", "\u66F2", "\u90A3", "\u6BCF\u5E74", "\u800C\u4E14", "\u60F3", "\u985E", "\u4EFB\u4F55", "\u5287", "\u5546", "\u7BC0", "\u8ECA", "\u7D93", "\u4F60", "\u7247", "\u661F", "\u6230", "\u9084\u662F", "\u6216\u8005", "\u5404\u7A2E", "\u7260\u5011", "\u9019\u88E1", "\u5247\u662F", "\u521D", "\u7D44", "\u4F4E", "\u9152", "\u4E4B\u524D", "\u8DDF", "\u8001", "\u6A4B", "\u4EE5\u4F86", "\u9019\u6A23", "\u76F4\u5230", "\u734E", "\u5F62", "\u5916", "\u4E14", "\u9580", "\u6545", "\u8272", "\u6A13", "\u7CFB", "\u6848", "\u4EC0\u9EBC", "\u75C5", "\u5168\u90E8", "\u820A", "\u5E2B", "\u76EE", "\u5802", "\u56E0\u800C", "\u793E", "\u672B", "\u90E1", "\u6BCF\u500B", "\u76C3", "\u5E1D", "\u64DA", "\u9700", "\u53EF\u662F", "\u61C9", "\u8239", "\u795E", "\u900F\u904E", "\u4EE5\u4E0B", "\u5EE0", "\u8D85", "\u82E5", "\u5712", "\u6D32", "\u5718", "\u4EE5\u5F8C", "\u5118\u7BA1", "\u7BA1", "\u4E4B\u4E2D", "\u800C\u662F", "\u8A71", "\u754C", "\u75C7", "\u4E00\u5207", "\u7FA4", "\u95DC\u65BC", "\u4E4B\u5916", "\u5708", "\u6CE2", "\u5831", "\u7DAB", "\u8A18", "\u93E1", "\u91AB", "\u901A", "\u54C1", "\u6BBF", "\u5404\u985E", "\u672C\u8EAB", "\u672C\u4EBA", "\u5EDF", "\u7F72", "\u53E3", "\u5373\u4F7F", "\u672A\u80FD", "\u5854", "\u5716", "\u5291", "\u7684\u8A71", "\u5B98", "\u4F9D\u64DA", "\u9760", "\u6309", "\u5EF3", "\u6216\u662F", "\u4EE5\u5916", "\u7D20", "\u5DE6\u53F3", "\u5361", "\u71B1", "\u90A8", "\u5E97", "\u50B3", "\u5979\u5011", "\u6C0F", "\u88D4", "\u7901", "\u4E0D\u53EF", "\u67D0\u4E9B", "\u5E63", "\u8266", "\u9B5A", "\u7DB2", "\u6A39", "\u753A", "\u7DB1", "\u6232", "\u81FA", "\u8A69", "\u5176\u5B83", "\u8336", "\u4E4B\u4E0B", "\u96D6", "\u6C60", "\u7891", "\u5F92", "\u9808", "\u5F7C\u6B64", "\u5074", "\u5DE5", "\u5728\u5167", "\u517C", "\u7121\u8AD6", "\u76F4\u81F3", "\u96E2", "\u671D", "\u6200", "\u5BAE", "\u699C", "\u9435", "\u676F", "\u516C", "\u5E95", "\u53F8", "\u5FC3", "\u6BCF\u5929", "\u4EA6\u662F", "\u90A3\u88E1", "\u7AEF", "\u724C", "\u90A6", "\u8AD6", "\u611F", "\u85C9\u7531", "\u5F80", "\u67D0\u7A2E", "\u5176\u9918", "\u4EA6\u70BA", "\u6309\u7167", "\u7E5E", "\u89C0", "\u5821", "\u7763", "\u5148", "\u708E", "\u7E7C", "\u8DDD", "\u773C", "\u53F2", "\u6709\u7684", "\u5404\u500B", "\u6A02", "\u6BCF\u79D2", "\u570D", "\u5175", "\u4E0D\u50C5"], "el": ["\u03C4\u03B7\u03BD", "\u03C3", "\u03BA\u03B1\u03B9", "\u03C4\u03BF", "\u03BD\u03B1", "\u03C4\u03B7\u03C2", "\u03B7", "\u03C4\u03BF\u03C5", "\u03BC\u03B5", "\u03B3\u03B9\u03B1", "\u03C4\u03C9\u03BD", "\u03C4\u03B7", "\u03C0\u03BF\u03C5", "\u03B1\u03C0\u03CC", "\u03C4\u03B9\u03C2", "\u03CC\u03C4\u03B9", "\u03C4\u03B1", "\u03BF\u03B9", "\u03C4\u03BF\u03C5\u03C2", "\u03B8\u03B1", "\u03BF", "\u03C3\u03B5", "\u03C4\u03BF\u03BD", "\u03B5\u03AF\u03BD\u03B1\u03B9", "\u03B4\u03B5\u03BD", "\u03B1\u03C5\u03C4\u03CC", "\u03BC\u03B1\u03C2", "\u03BA\u03B1\u03C4\u03AC", "\u03AD\u03BD\u03B1", "\u03BC\u03B9\u03B1", "\u03AD\u03C7\u03B5\u03B9", "\u03BF\u03C0\u03BF\u03AF\u03B1", "\u03B1\u03C5\u03C4\u03AE", "\u03B1\u03BB\u03BB\u03AC", "\u03AE\u03C4\u03B1\u03BD", "\u03C0\u03C1\u03BF\u03C2", "\u03AD\u03C7\u03BF\u03C5\u03BD", "\u03C3\u03B1\u03C2", "\u03B5\u03BD\u03CE", "\u03BC\u03AF\u03B1", "\u03AE", "\u03BC\u03B5\u03C4\u03AC", "\u03BC\u03BF\u03C5", "\u03BC\u03B5\u03C4\u03B1\u03BE\u03CD", "\u03B5\u03AF\u03C7\u03B5", "\u03BF\u03C0\u03BF\u03AF\u03BF", "\u03C9\u03C3\u03C4\u03CC\u03C3\u03BF", "\u03CC\u03BC\u03C9\u03C2", "\u03B5\u03AC\u03BD", "\u03B1\u03BD", "\u03BC\u03AD\u03C7\u03C1\u03B9", "\u03B1\u03C5\u03C4\u03AC", "\u03B5\u03BD", "\u03BF\u03C0\u03BF\u03AF\u03B5\u03C2", "\u03CC\u03C4\u03B1\u03BD", "\u03B1\u03C5\u03C4\u03AD\u03C2", "\u03C0\u03C1\u03BF\u03BA\u03B5\u03B9\u03BC\u03AD\u03BD\u03BF\u03C5", "\u03CC\u03C7\u03B9", "\u03BC\u03AD\u03C3\u03C9", "\u03BF\u03C0\u03BF\u03AF\u03BF\u03C2", "\u03CE\u03C3\u03C4\u03B5", "\u03C5\u03C0\u03CC", "\u03B5\u03AF\u03C7\u03B1\u03BD", "\u03C0\u03C9\u03C2", "\u03C7\u03C9\u03C1\u03AF\u03C2", "\u03BC\u03B7\u03BD", "\u03BA\u03AC\u03B8\u03B5", "\u03BA\u03AC\u03C4\u03B9", "\u03B1\u03C5\u03C4\u03CE\u03BD", "\u03C5\u03C0\u03AD\u03C1", "\u03AD\u03BD\u03B1\u03C2", "\u03B4\u03B9\u03CC\u03C4\u03B9", "\u03B5\u03BC\u03B5\u03AF\u03C2", "\u03BC\u03B9\u03B1\u03C2", "\u03B3\u03B9'", "\u03B5\u03C0\u03B5\u03B9\u03B4\u03AE", "\u03B1\u03C5\u03C4\u03AE\u03C2", "\u03B5\u03BD\u03CC\u03C2", "\u03BF\u03CD\u03C4\u03B5", "\u03B1\u03C5\u03C4\u03CC\u03BD", "\u03B1\u03C5\u03C4\u03BF\u03CD", "\u03B5\u03BA", "\u03B5\u03BD\u03B1\u03BD\u03C4\u03AF\u03BF\u03BD", "\u03AD\u03BD\u03B1\u03BD", "\u03B5\u03AF\u03BC\u03B1\u03C3\u03C4\u03B5", "\u03AC\u03BB\u03BB\u03B1", "\u03BA\u03B1\u03BD\u03B5\u03AF\u03C2", "\u03AC\u03BB\u03BB\u03B5\u03C2", "\u03AC\u03BB\u03BB\u03B7", "\u03BF\u03C0\u03BF\u03AF\u03C9\u03BD", "\u03BA\u03AC\u03C0\u03BF\u03B9\u03B1", "\u03B3\u03B9\u03B1\u03C4\u03AF", "\u03B1\u03C0'", "\u03BA\u03B9", "\u03B1\u03C5\u03C4\u03BF\u03CD\u03C2", "\u03C4\u03B9", "\u03C4\u03BF\u03CD\u03C4\u03BF", "\u03B5\u03BE\u03B1\u03B9\u03C4\u03AF\u03B1\u03C2", "\u03BC\u03B7", "\u03BF\u03C0\u03BF\u03AF\u03BF\u03B9", "\u03AC\u03BB\u03BB\u03BF", "\u03AC\u03BB\u03BB\u03C9\u03BD", "\u03B1\u03C5\u03C4\u03AE\u03BD", "\u03B5\u03AF\u03C4\u03B5", "\u03C4\u03AD\u03C4\u03BF\u03B9\u03BF", "\u03AD\u03C9\u03C2", "\u03CC\u03C3\u03B1", "\u03B5\u03C0\u03AF", "\u03B2\u03AC\u03C3\u03B5\u03B9", "\u03B5\u03C6\u03CC\u03C3\u03BF\u03BD", "\u03BA\u03B1\u03BC\u03AF\u03B1", "\u03C0\u03B1\u03C1\u03AC", "\u03BA\u03B1\u03BD\u03AD\u03BD\u03B1", "\u03B5\u03BE", "\u03B1\u03C6\u03BF\u03CD", "\u03C3'", "\u03B5\u03C3\u03B5\u03AF\u03C2", "\u03B1\u03BD\u03C4\u03AF", "\u03AC\u03BB\u03BB\u03BF\u03B9", "\u03B1\u03C5\u03C4\u03BF\u03AF", "\u03BA\u03AC\u03C0\u03BF\u03B9\u03BF", "\u03B5\u03B3\u03CE", "\u03B5\u03AF\u03BC\u03B1\u03B9", "\u03BF\u03C0\u03BF\u03AF\u03B1\u03C2", "\u03BF\u03C0\u03BF\u03AF\u03BF\u03C5", "\u03BC\u03B5\u03C1\u03B9\u03BA\u03AD\u03C2", "\u03BA\u03B1\u03C4\u03CC\u03C0\u03B9\u03BD", "\u03BF\u03C0\u03BF\u03B9\u03B1\u03B4\u03AE\u03C0\u03BF\u03C4\u03B5", "\u03AC\u03BB\u03BB\u03BF\u03C5\u03C2", "\u03BF\u03C0\u03BF\u03AF\u03BF\u03C5\u03C2", "\u03B1\u03C2", "\u03CC,\u03C4\u03B9", "\u03B1\u03C1\u03BA\u03B5\u03C4\u03AD\u03C2", "\u03B5\u03BA\u03B5\u03AF\u03BD\u03B7"], "en": ["the", "to", "and", "a", "of", "i", "in", "is", "you", "that", "it", "for", "on", "was", "with", "this", "are", "be", "they", "not", "as", "'s", "my", "we", "do", "will", "at", "he", "but", "if", "or", "your", "from", "n't", "can", "by", "me", "there", "would", "all", "has", "an", "what", "about", "out", "like", "their", "up", "were", "his", "been", "who", "some", "them", "our", "am", "which", "any", "us", "no", "did", "could", "him", "she", "should", "may", "after", "her", "because", "than", "'m", "into", "these", "over", "s", "before", "its", "does", "being", "'ll", "'ve", "those", "another", "off", "around", "since", "down", "&", "both", "through", "while", "'re", "ca", "every", "anyone", "something", "between", "under", "might", "against", "each", "during", "anything", "nt", "though", "nothing", "someone", "until", "must", "without", "per", "everything", "within", "'d", "everyone", "wo", "either", "along", "whether", "although", "upon", "\u2019s", "yourself", "among", "across", "unless", "near", "shall", "behind", "itself", "myself", "themselves", "except", "whatever", "plus", "r", "re", "mine", "via", "beyond", "whom", "himself", "vs.", "u", "nor", "none", "toward", "despite", "whose", "throughout", "everybody", "na", "yo", "towards", "ve", "anybody", "n\u2019t", "it's", "`s", "ta", "nobody", "somebody", "neither", "onto", "o", "till", "ourselves", "besides", "herself", "\u2019", "vs", "thru", "ur"], "fa": ["\u0648", "\u0631\u0627", "\u0628\u0647", "\u062F\u0631", "\u0627\u0632", "\u06A9\u0647", "\u0628\u0627", "\u0627\u06CC\u0646", "\u0627\u0633\u062A", "\u062E\u0648\u062F", "\u0622\u0646", "\u0628\u0631\u0627\u06CC", "\u0628\u0648\u062F", "\u0628\u0631", "\u0627\u0648", "\u0634", "\u062A\u0627", "\u0645\u0627", "\u062E\u0648\u0627\u0647\u062F", "\u0645\u0646", "\u0645", "\u0647\u0631", "\u0627\u06AF\u0631", "\u0634\u0645\u0627", "\u062E\u0648\u0627\u0647\u0646\u062F", "\u0622\u0646\u0647\u0627", "\u06CC\u0627", "\u0628\u0627\u06CC\u062F", "\u0628\u0627\u0634\u062F", "\u0628\u0648\u062F\u0646\u062F", "\u0631\u0648\u06CC", "\u0686\u0647", "\u062A\u0648", "\u0634\u0627\u0646", "\u062E\u0648\u0627\u0647\u0645", "\u067E\u0633", "\u062A\u0627\u0646", "\u0627\u0645\u0627", "\u0645\u0627\u0646", "\u0628\u0639\u062F", "\u0647\u06CC\u0686", "\u0686\u0646\u062F", "\u0628\u0627\u0634\u0646\u062F", "\u062E\u0648\u0627\u0647\u06CC\u0645", "\u062A", "\u0648\u06CC", "\u0647\u0645\u0627\u0646", "\u0633\u062A", "\u0622\u06CC\u0627", "\u0647\u0645\u06CC\u0646", "\u0642\u0628\u0644", "\u0628\u0648\u062F\u0645", "\u0648\u0644\u06CC", "\u0622\u0646\u0627\u0646", "\u0686\u0648\u0646", "\u0627\u0634", "\u0628\u06CC\u0646", "\u0628\u0631\u062E\u06CC", "\u0645\u06CC\u200C\u062A\u0648\u0627\u0646", "\u0628\u062F\u0648\u0646", "\u0627\u06CC\u0634\u0627\u0646", "\u0632\u06CC\u0631", "\u062E\u0648\u06CC\u0634", "\u062F\u0631\u0628\u0627\u0631\u0647\u0654", "\u0639\u0644\u06CC\u0647", "\u0645\u062B\u0644", "\u0646\u0633\u0628\u062A", "\u0646\u0628\u0627\u06CC\u062F", "\u0628\u0648\u062F\u06CC\u0645", "\u0628\u0648\u062F\u0647", "\u0628\u0627\u0634\u06CC\u062F", "\u062A\u0648\u0633\u0637", "\u0645\u0627\u0646\u0646\u062F", "\u0686\u0646\u06CC\u0646", "\u0627\u0645", "\u062D\u062F\u0648\u062F", "\u062E\u0648\u0627\u0647\u06CC\u062F", "\u0628\u062F", "\u0646\u0628\u0648\u062F", "\u062A\u0648\u06CC", "\u06CC\u06A9\u062F\u06CC\u06AF\u0631", "\u0628\u0627\u0634\u0645", "\u0637\u06CC", "\u0632\u06CC\u0631\u0627", "\u0646\u0632\u062F", "\u0628\u0627\u0634\u06CC\u0645", "\u0646\u062E\u0648\u0627\u0647\u062F", "\u062A\u062D\u062A", "\u0686\u0646\u0627\u0646", "\u06CC\u0634", "\u0645\u06CC\u200C\u0628\u0627\u0634\u062F", "\u0645\u06AF\u0631", "\u062C\u0644\u0648\u06CC", "\u0647\u0645\u0686\u0648\u0646", "\u06A9\u062C\u0627", "\u062E\u0648\u0627\u0647\u06CC", "\u0622\u0646\u200C\u0647\u0627", "\u0686\u0646\u062F\u06CC\u0646", "\u0637\u0628\u0642", "\u062C\u0632", "\u0636\u0645\u0646", "\u0646\u0645\u06CC\u200C\u062A\u0648\u0627\u0646", "\u0646\u062E\u0648\u0627\u0647\u0645", "\u0627\u062A", "\u0627\u06CC\u0646\u0647\u0627", "\u0686\u0646\u0627\u0646\u0686\u0647", "\u06CC\u0646", "\u0647\u0632\u0627\u0631\u0627\u0646", "\u0636\u062F", "\u0628\u0648\u062F\u06CC", "\u0645\u0642\u062F\u0627\u0631\u06CC", "\u0628\u06CC", "\u0628\u0648\u062F\u06CC\u062F", "\u0646\u062E\u0648\u0627\u0647\u0646\u062F", "\u0646\u0628\u0627\u0634\u062F", "\u0647\u0645\u062F\u06CC\u06AF\u0631", "\u06A9\u06CC", "\u0627\u0646", "\u0686\u06CC", "\u0628\u0627\u0634", "\u0647\u0645\u0627\u0646\u0646\u062F", "\u0628\u0627\u06CC\u0633\u062A\u06CC", "\u0646\u062E\u0648\u0627\u0647\u06CC\u0645", "\u0634\u0628\u06CC\u0647", "\u0622\u0646\u0647\u0627\u06CC\u06CC", "\u0647\u0631\u0686\u0646\u062F", "\u0628\u0648\u062F\u0647\u200C\u0627\u0646\u062F", "\u0627\u06AF\u0631\u0686\u0647", "\u0628\u0627\u0634\u06CC", "\u0641\u0644\u0627\u0646", "\u067E\u06CC\u0631\u0627\u0645\u0648\u0646", "\u0628\u062A\u0648\u0627\u0646", "\u0645\u06CC\u200C\u0628\u0627\u06CC\u0633\u062A", "\u06CC\u062A", "\u06AF\u0631\u0686\u0647", "\u0648\u06AF\u0631\u0646\u0647", "\u06CC\u0634\u0627\u0646", "\u0628\u0627\u0628\u062A", "\u0627\u0644\u06CC", "\u062E\u0648\u06CC\u0634\u062A\u0646", "\u0686\u0631\u0627\u06A9\u0647", "\u0631\u0627\u062C\u0639", "\u0622\u0646\u0627\u0646\u06CC", "\u0627\u06CC\u0646\u0627\u0646", "\u062C\u0632\u0648", "\u0646\u0628\u0648\u062F\u0646\u062F", "\u062D\u0648\u0644", "\u06CC\u062A\u0627\u0646", "\u06CC\u0645\u0627\u0646", "\u0646\u0628\u0627\u0634\u06CC\u062F", "\u0627\u06CC\u0646\u062C\u0627\u0646\u0628", "\u0639\u0644\u06CC\u200C\u0631\u063A\u0645", "\u062F\u0631\u062E\u0648\u0627\u0647\u062F", "\u0646\u0628\u0627\u0634\u0646\u062F", "\u0646\u0638\u06CC\u0631", "\u0641\u0631\u0648\u062E\u0648\u0627\u0647\u062F", "\u0646\u062E\u0648\u0627\u0647\u06CC\u062F", "\u0646\u0628\u0648\u062F\u0645", "\u0645\u06CC\u200C\u0628\u0627\u0634\u0646\u062F", "\u06A9\u062F\u0627\u0645\u06CC\u0646", "\u0627\u06CC\u0646\u200C\u0647\u0627", "\u0628\u0631\u062E\u0648\u0627\u0647\u062F", "\u0648\u0627\u0644\u0627", "\u0634\u0645\u0627\u0647\u0627", "\u0645\u06CC\u200C\u0628\u0627\u06CC\u062F", "\u062F\u0631\u062E\u0648\u0627\u0647\u0646\u062F", "\u0631\u0648\u0628\u0631\u0648\u06CC", "\u0644\u06CC\u06A9\u0646", "\u0628\u0627\u0632\u062E\u0648\u0627\u0647\u062F", "\u062F\u0631\u0628\u0627\u0631\u0647\u200C", "\u0628\u0648\u062F\u0647\u200C\u0627\u0645", "\u0628\u0627\u0632\u062E\u0648\u0627\u0647\u0645", "\u0644\u06A9\u0646", "\u0628\u0631\u062E\u0648\u0627\u0647\u0646\u062F", "\u0646\u0628\u0627\u0634\u06CC\u0645", "\u0628\u062F\u06CC\u0646", "\u0646\u06CC\u0633\u062A\u06CC\u062F"], "fi": ["ja", "on", "ett\xE4", "ei", "oli", "se", "tai", "h\xE4n", "mutta", "sen", "kuin", "kun", "ovat", "joka", "ole", "sek\xE4", "jos", "voi", "sit\xE4", "mukaan", "olisi", "olla", "kanssa", "t\xE4m\xE4", "t\xE4m\xE4n", "siit\xE4", "ollut", "mit\xE4", "en", "jotka", "ne", "j\xE4lkeen", "h\xE4nen", "sill\xE4", "kaikki", "eiv\xE4t", "jonka", "jossa", "vaikka", "min\xE4", "t\xE4ss\xE4", "olivat", "eik\xE4", "koska", "voidaan", "vaan", "ennen", "niiden", "olen", "siin\xE4", "meid\xE4n", "siihen", "t\xE4t\xE4", "eli", "he", "vuoksi", "olevan", "vastaan", "niit\xE4", "mik\xE4", "mit\xE4\xE4n", "t\xE4ll\xE4", "jota", "t\xE4st\xE4", "olin", "t\xE4h\xE4n", "jotain", "me", "jotta", "heid\xE4n", "m\xE4", "joita", "pit\xE4isi", "voisi", "minun", "n\xE4m\xE4", "joiden", "kautta", "olemme", "joku", "ilman", "toinen", "v\xE4lill\xE4", "et", "muiden", "voivat", "minua", "muita", "onko", "joissa", "kohti", "johon", "muuta", "jolla", "sijaan", "niist\xE4", "vai", "muut", "emme", "joilla", "meill\xE4", "josta", "h\xE4net", "mukana", "puolesta", "kaiken", "minulla", "kukaan", "miss\xE4", "piti", "n\xE4iden", "t\xE4ytyy", "kaikkien", "h\xE4nt\xE4", "saattaa", "n\xE4it\xE4", "tuo", "mist\xE4", "t\xE4n\xE4", "huolimatta", "minut", "minulle", "varten", "joista", "mik\xE4li", "takia", "pitkin", "sin\xE4", "asti", "olleet", "l\xE4htien", "olisin", "alla", "kaikissa", "mink\xE4", "meille", "p\xE4\xE4lle", "samaan", "ku", "saman", "enk\xE4", "itsens\xE4", "onkin", "joko", "h\xE4nelle", "muutaman", "jossain", "voida", "takana", "kuka", "l\xE4pi", "s\xE4", "olet", "voinut", "niiss\xE4", "sama", "saakka", "ymp\xE4ri", "n\xE4iss\xE4", "mik\xE4\xE4n", "edess\xE4", "monet", "mun", "kaikille", "h\xE4nell\xE4", "kaikkia", "mihin", "tarvitse", "jokainen", "sille", "molemmat", "ohi", "jotakin", "takaa", "er\xE4s", "jokin", "sis\xE4ll\xE4", "menness\xE4", "olisivat", "kaikista", "muutama", "minusta", "kaikkea", "silt\xE4", "p\xE4\xE4ss\xE4", "toiseen", "jonkun", "voitaisiin", "voimme", "itselleen", "niille", "taakse", "jostain", "jonkin", "kunnes", "samaa", "toiselle", "ainoa", "itse\xE4\xE4n", "heit\xE4", "pit\xE4nyt", "kesken", "teit\xE4", "muista", "t\xE4\xE4", "\xE4l\xE4", "kohtaan", "h\xE4nest\xE4", "ett", "p\xE4in", "monta", "n\xE4ist\xE4", "olikin", "ollaan", "jotkut", "joihin", "my\xF6t\xE4", "eiv\xE4tk\xE4", "tuon", "moni", "sinun", "olemaan", "n\xE4ill\xE4", "kunkin", "p\xE4\xE4ll\xE4", "ulkopuolelle", "oltava", "keskell\xE4", "eik\xF6", "ulkopuolella", "meit\xE4", "vieress\xE4", "niihin", "mut", "ollu", "alkaen", "eteen", "muille", "muihin", "johdosta", "joskin", "ottamatta", "joutuu", "jokaisen", "jossakin", "sinulle", "jokaiselle", "voin", "ymp\xE4rill\xE4", "olleen", "saattoi", "voisivat", "toiset", "meist\xE4", "ohella", "monia", "niill\xE4", "suhteen", "aikoo", "sun", "heille", "monien", "tuota", "heill\xE4", "eih\xE4n", "n\xE4ihin", "joidenkin", "oltiin", "v\xE4liss\xE4", "oliko", "nojalla", "muilla", "sinua", "vasten", "l\xE4hell\xE4", "meid\xE4t", "miss\xE4\xE4n", "joutuvat", "kaikesta", "nuo", "teille", "v\xE4liin", "taitaa", "parissa", "kaikkiin", "ollessa", "heist\xE4", "muissa", "toistensa", "ket\xE4\xE4n", "olevansa", "muutamia", "luo", "samat", "kumpikin", "per\xE4\xE4n", "samana", "toista", "riippumatta", "kaikilta", "toisiaan", "vaikkakin", "muu", "mulla", "t\xE4lt\xE4", "mukaansa", "itse\xE4ni", "kanssaan", "voit", "tuosta", "itseni", "sekin", "min\xE4kin", "olisimme", "mitk\xE4", "mua", "toisistaan", "er\xE4\xE4n", "heid\xE4t", "keskuudessa", "jotkin", "toisten", "oo", "alta", "monessa", "luona", "jollain", "keskelle", "h\xE4neen", "t\xE4lle", "toisiinsa", "olis", "kera", "muitakin", "samassa", "mill\xE4\xE4n", "muulla", "kaikilla", "lienee", "halki", "\xE4lk\xE4\xE4", "taisi", "mill\xE4", "ja/tai", "olenko", "kumpikaan", "edest\xE4", "samoja", "itselleni", "olekaan", "sinut", "tuohon", "joudun", "olipa", "sekaan", "jolle", "sua", "kohden", "monissa", "er\xE4it\xE4", "ainoan", "sijasta", "saattavat", "teid\xE4n", "ymp\xE4rille", "sinulla", "johonkin", "poikki", "mihink\xE4\xE4n", "jokaisella", "rinnalla", "er\xE4iden", "minuun", "minulta", "sulla", "olisiko", "voitte", "kaikessa", "er\xE4\xE4ss\xE4", "olenkin", "tarvinnut", "l\xE4helle", "pit\xE4isik\xF6", "mink\xE4\xE4n", "samasta", "saattanut", "joillakin", "voisin", "per", "jokaisessa", "vois", "onpa", "voitu", "oltu", "oon", "mulle", "monen", "ette", "varrella", "jona", "taikka", "joitakin", "v\xE4lille", "yl\xE4puolella", "monille", "teill\xE4", "sit\xE4kin", "t\xE4ytyi", "olisikin", "mille", "ois", "tarvitsisi", "ovatkin", "voinu", "luokse", "varalta", "l\xE4hell\xE4k\xE4\xE4n"], "fr": ["de", "le", "la", "\xE0", "les", "et", "l'", "en", "est", "d'", "un", "une", "il", "dans", "pour", "par", "a", "qui", "que", "des", "sur", "son", "avec", "se", "sont", "ce", "s'", "qu'", "elle", "sa", "\xE9t\xE9", "ou", "cette", "mais", "ses", "comme", "ont", "c'", "on", "\xE9tait", "y", "ils", "leur", "apr\xE8s", "entre", "\xEAtre", "fut", "lui", "ces", "dont", "nous", "sous", "depuis", "je", "contre", "plusieurs", "avait", "avant", "vous", "si", "puis", "sans", "jusqu'", "avoir", "j'", "selon", "leurs", "vers", "pendant", "cet", "ai", "soit", "chez", "sera", "\xE9taient", "quelques", "cela", "chaque", "durant", "car", "d\xE8s", "elles", "certains", "\xE9tant", "du", "celle", "quand", "lequel", "celui", "parmi", "avons", "notre", "aurait", "ayant", "furent", "malgr\xE9", "ceux", "rien", "eux", "devant", "suis", "laquelle", "me", "mon", "avaient", "l'on", "lorsque", "certaines", "ni", "aucun", "ma", "nos", "-t-il", "lui-m\xEAme", "serait", "aucune", "votre", "m'", "celui-ci", "seront", "c'est-\xE0-dire", "-il", "lorsqu'", "moi", "sommes", "celles", "concernant", "quelque", "fit", "mes", "ait", "\xE7a", "celle-ci", "chacun", "puisque", "derri\xE8re", "divers", "quel", "quelle", "lesquels", "vos", "voire", "soient", "-ce", "ceci", "lesquelles", "via", "ceux-ci", "auraient", "elle-m\xEAme", "av.", "quoi", "-ils", "-vous", "-elle", "eux-m\xEAmes", "envers", "-t-elle", "l", "sauf", "-on", "chacune", "avez", "ton", "avais", "seraient", "celles-ci", "aient", "puisqu'", "tu", "quelqu'un", "soi", "\xEAtes", "\xE9tais", "jusque", "auront", "uns", "-t-on", "ca", "aurais", "-je", "f\xFBt", "autrui", "es"], "he": ["\u05D4", "\u05D1", "\u05D5", "\u05DC", "\u05E9", "\u05D4_", "_\u05E9\u05DC_", "_\u05D4\u05D5\u05D0", "\u05E9\u05DC", "\u05D0\u05EA", "\u05DE", "\u05E2\u05DC", "_\u05D4\u05DD", "_\u05D4\u05D9\u05D0", "\u05DB\u05D9", "\u05D4\u05D5\u05D0", "\u05DB", "\u05DB\u05DC", "\u05D6\u05D4", "\u05E2\u05DD", "\u05DC_", "\u05D4\u05D9\u05D0", "\u05DB\u05DA", "\u05D4\u05D9\u05D4", "\u05D1_", "\u05D1\u05D9\u05DF", "\u05D0\u05DD", "\u05D4\u05DD", "\u05D0\u05EA_", "\u05D0\u05D5", "\u05D6\u05D5", "\u05E2\u05D3", "\u05E9\u05DC_", "\u05D0\u05DC\u05D4", "_\u05D4\u05DF", "\u05D0\u05D1\u05DC", "_\u05D0\u05E0\u05D9", "\u05D0\u05DA", "\u05DB\u05D3\u05D9", "\u05D4\u05D9\u05D5", "\u05D6\u05D0\u05EA", "\u05DC\u05D0\u05D7\u05E8", "_\u05D0\u05E0\u05D7\u05E0\u05D5", "\u05DC\u05E4\u05E0\u05D9", "\u05D4\u05D9\u05EA\u05D4", "\u05DB\u05DE\u05D5", "\u05DB\u05E9", "\u05DB\u05DE\u05D4", "\u05D0\u05E0\u05D9", "\u05E0\u05D2\u05D3", "\u05D0\u05DC", "\u05D0\u05D9\u05E0\u05D5", "\u05DB\u05D0\u05E9\u05E8", "\u05E2\u05DC_", "\u05DE\u05DF", "\u05D9\u05D4\u05D9\u05D4", "\u05DE\u05DF_", "\u05D0\u05D7\u05E8\u05D9", "\u05D0\u05DC\u05D0", "\u05D4\u05DF", "\u05DC\u05D4\u05D9\u05D5\u05EA", "\u05DC\u05DC\u05D0", "\u05E2\u05E6\u05DE\u05D5", "\u05D0\u05D9\u05E0\u05D4", "\u05D0\u05DC_", "\u05D0\u05D5\u05DC\u05DD", "\u05D0\u05E9\u05E8", "\u05D0\u05D9\u05E0\u05DD", "\u05DE\u05E1\u05E4\u05E8", "\u05D4\u05E8\u05D1\u05D4", "\u05EA\u05D4\u05D9\u05D4", "\u05DB\u05E4\u05D9", "\u05DC\u05E2\u05D5\u05DE\u05EA", "\u05E8\u05D5\u05D1", "\u05E2\u05DD_", "\u05DE\u05E9\u05D5\u05DD", "\u05D1\u05D9\u05D3\u05D9", "\u05DC\u05DE\u05E8\u05D5\u05EA", "_\u05D0\u05EA\u05D4", "\u05D0\u05E0\u05D5", "\u05D9\u05D4\u05D9\u05D5", "\u05DE\u05E4\u05E0\u05D9", "\u05D1\u05D0\u05DE\u05E6\u05E2\u05D5\u05EA", "\u05DC\u05D9\u05D3", "\u05D1\u05D2\u05DC\u05DC", "\u05EA\u05D5\u05DA", "\u05DC\u05E4\u05D9", "\u05D1\u05D9\u05DF_", "\u05D0\u05D5\u05EA\u05D5", "\u05D0\u05D9\u05DC\u05D5", "\u05E2\u05E6\u05DE\u05D4", "\u05D1\u05DC\u05D9", "\u05E2\u05E6\u05DE\u05DD", "\u05DC\u05D2\u05D1\u05D9", "\u05D1\u05E2\u05E7\u05D1\u05D5\u05EA", "\u05D0\u05DC\u05D5", "\u05E9\u05D5\u05DD", "\u05D1\u05DE\u05E9\u05DA", "\u05DC\u05D1\u05D9\u05DF", "\u05D1\u05E4\u05E0\u05D9", "\u05D1\u05E9\u05DC", "\u05D1\u05DE\u05E7\u05D5\u05DD", "\u05E2\u05E7\u05D1", "\u05D0\u05D5\u05EA\u05D4", "\u05DE\u05EA\u05D5\u05DA", "\u05DB\u05D9\u05D5\u05D5\u05DF", "\u05D0\u05D9\u05E0\u05DF", "\u05DE\u05D5\u05DC", "\u05DB\u05DB\u05DC", "\u05D0\u05EA\u05D4", "\u05D0\u05E0\u05D7\u05E0\u05D5", "\u05D4\u05DC\u05DC\u05D5", "\u05DE\u05E2\u05D1\u05E8", "\u05DE\u05E2\u05DC", "\u05DC\u05E4\u05D9_", "\u05E9\u05DB\u05DF", "\u05DB\u05DC\u05E4\u05D9", "\u05DE\u05E2\u05D8", "\u05DC\u05E7\u05E8\u05D0\u05EA", "\u05DC\u05E2\u05D1\u05E8", "\u05D1\u05EA\u05D5\u05DA", "\u05DC\u05DE\u05E2\u05DF", "\u05D0\u05D9\u05E0\u05E0\u05D5", "\u05EA\u05DE\u05D5\u05E8\u05EA", "\u05D1\u05E7\u05E8\u05D1", "\u05D1\u05D0\u05E9\u05E8", "\u05D0\u05E6\u05DC", "\u05D4\u05D9\u05D9\u05EA\u05D9", "\u05DE\u05D0\u05E9\u05E8", "\u05DE\u05D1\u05D9\u05DF", "\u05D6\u05D4\u05D5", "\u05D1\u05E0\u05D9\u05D2\u05D5\u05D3", "\u05D1\u05E2\u05D5\u05D3", "\u05DB\u05D0\u05D9\u05DC\u05D5", "\u05D1\u05E2\u05D3", "_\u05D0\u05EA\u05DD", "\u05DE\u05E6\u05D3", "\u05D1\u05DC\u05D0", "\u05DE\u05E8\u05D1\u05D9\u05EA", "\u05DE\u05D0\u05D7\u05E8", "\u05D0\u05D9\u05E0\u05E0\u05D4", "\u05D0\u05E6\u05DC_", "\u05DE\u05D0\u05D7\u05D5\u05E8\u05D9", "\u05E2\u05E6\u05DE\u05D9", "\u05EA\u05D7\u05EA", "\u05D4\u05D9\u05D9\u05E0\u05D5", "\u05D1\u05D8\u05E8\u05DD", "\u05DB\u05DC\u05E9\u05D4\u05D5", "\u05E2\u05D1\u05D5\u05E8", "\u05DC\u05E0\u05D5\u05DB\u05D7", "\u05D0\u05D5\u05EA\u05DD", "\u05E1\u05D1\u05D9\u05D1", "\u05DE\u05D1\u05DC\u05D9", "\u05D0\u05D5\u05EA\u05D5_", "\u05D0\u05D7\u05E8\u05D9_", "\u05DE\u05EA\u05D7\u05EA", "\u05DB\u05DE\u05D5_", "\u05DC\u05D5", "\u05D0\u05D9\u05D6\u05D5", "\u05DE\u05E0\u05EA", "\u05DC\u05E9\u05DD", "\u05E0\u05D5\u05DB\u05D7", "\u05DE\u05DB\u05D9\u05D5\u05D5\u05DF", "\u05E9\u05DC\u05D4\u05DD", "\u05DC\u05E6\u05D3", "\u05D1\u05E9\u05D1\u05D9\u05DC", "\u05E0\u05D2\u05D3_", "\u05E1\u05D1\u05D9\u05D1_", "\u05D0\u05EA\u05DD", "\u05D1\u05D6\u05DB\u05D5\u05EA", "\u05E2\u05E6\u05DE\u05DF", "\u05E2\u05D1\u05D5\u05E8_", "\u05D0\u05D9\u05E0\u05E0\u05D9", "\u05DE\u05D4\u05DD", "\u05D0\u05D5\u05EA\u05DF", "\u05DB\u05E2\u05D1\u05D5\u05E8", "\u05E9\u05DE\u05D0", "\u05D0\u05EA\u05D5", "\u05DB\u05DC\u05E9\u05D4\u05D9", "\u05DC\u05D0\u05D5\u05E8\u05DA", "\u05D0\u05D9\u05D6\u05D4", "\u05DE\u05DC\u05D1\u05D3", "\u05DC\u05D9\u05D3\u05D9", "\u05D4\u05D5\u05D3\u05D5\u05EA", "\u05E9\u05DC\u05D5", "\u05DB\u05D2\u05D5\u05DF", '\u05E2"\u05D9', "\u05D1\u05E9\u05D1\u05D9\u05DC_", "\u05DC\u05E4\u05E0\u05D9_", "\u05DE\u05E8\u05D1\u05D4", "\u05DE\u05D4\u05D5", "\u05E2\u05E6\u05DE\u05E0\u05D5", "\u05DB\u05E9\u05DD", "\u05D1\u05D2\u05D9\u05DF_", "\u05DE\u05D0\u05EA", "\u05D0\u05DC\u05DE\u05DC\u05D0", "\u05E9\u05E0\u05D9\u05D4\u05DD", "\u05D7\u05E8\u05E3"], "ko": ["\uC774", "\uADF8", "\uACE0", "\uB294", "\uC911", "\uBC0F", "\uC758", "\uB97C", "\uC744", "\uAC00", "\uADF8\uB294", "\uD6C4", "\uB54C\uBB38\uC5D0", "\uBA87", "\uC5D0", "\uC740", "\uB85C", "\uADF8\uB9AC\uACE0", "\uC774\uB77C\uACE0", "\uADF8\uC758", "\uAC00\uC6B4\uB370", "\uC774\uB294", "\uC774\uB97C", "\uB3D9\uC548", "\uB610\uB294", "\uC5D0\uC11C", "\uC6B0\uB9AC", "\uBAA8\uB4E0", "\uC73C\uB85C", "\uB0B4", "\uC5EC\uAE30", "\uC774\uC0C1", "\uC790\uC2E0\uC758", "\uACFC", "\uAC01", "\uB77C\uACE0", "\uC640", "\uB0B4\uAC00", "\uC815\uB3C4", "\uC81C", "\uC911\uC5D0", "\uC81C\uAC00", "\uC774\uB4E4", "\uC790\uC2E0\uC774", "\uAC04", "\uC548\uC5D0", "\uB9CC\uC5D0", "\uC5B4\uB290", "\uC5B4\uB5A4", "\uC774\uB77C\uBA70", "\uD639\uC740", "\uC804\uC5D0", "\uB098", "\uC774\uB77C\uB294", "\uB204\uAC00", "\uC774\uB4E4\uC740", "\uC5D0\uB294", "\uAE4C\uC9C0", "\uC678\uC5D0", "\uADF8\uB4E4\uC740", "\uC5D0\uC11C\uB294", "\uC6B0\uB9AC\uB294", "\uB3C4", "\uC55E\uC5D0", "\uC774\uB780", "\uC0AC\uC774\uC5D0", "\uAC04\uC758", "\uC55E\uC5D0\uC11C", "\uADF8\uB97C", "\uC0AC\uC774\uC758", "\uC678\uC5D0\uB3C4", "\uC18D", "\uADF8\uAC00", "\uC548\uC5D0\uC11C", "\uC911\uC5D0\uC11C", "\uC9C1\uD6C4", "\uD6C4\uC5D0\uB294", "\uC800\uB3C4", "\uC774\uC0C1\uC758", "\uADF8\uB140\uB294", "\uC800\uB294"], "la": ["et", "in", "non", "que", "ut", "qui", "cum", "ad", "si", "atque", "a", "quod", "de", "quae", "sed", "mihi", "per", "me", "quam", "te", "est", "ex", "quid", "ac", "se", "ego", "aut", "tibi", "quis", "eius", "c", "haec", "ea", "quo", "super", "nam", "illa", "ab", "pro", "hoc", "illi", "post", "ille", "eos", "omnia", "ubi", "mea", "eorum", "quem", "nec", "eum", "nisi", "dum", "tu", "suis", "contra", "at", "inter", "ipse", "id", "sibi", "erat", "quidem", "illis", "vel", "quibus", "esse", "quia", "nihil", "his", "omnis", "sua", "sine", "quos", "apud", "nos", "vos", "uti", "omnibus", "eo", "fuit", "quoque", "omnium", "tua", "multa", "autem", "igitur", "illos", "hanc", "sunt", "quoniam", "hic", "enim", "nobis", "nostro", "eam", "suam", "erit", "haud", "tantum", "suo", "suum", "qua", "sit", "omnes", "meis", "hac", "an", "quas", "illam", "nostra", "quom", "tuae", "quidam", "esset", "tuis", "omni", "nullo", "e", "tanta", "nostri", "coram", "postquam", "sese", "quantum", "quicquam", "alii", "quamvis", "propter", "fuerunt", "meo", "nulla", "eadem", "is", "ipsa", "tamquam", "sicut", "tuos", "vobis", "cuius", "solus", "nostrum", "huic", "fuisse", "namque", "quisque", "meus", "alterius", "sub", "mei", "meae", "ei", "ipsi", "suas", "quemque", "ceteros", "illum", "ista", "hunc", "toto", "foret", "omnem", "paucis", "meum", "tuo", "multarum", "quanto", "praeter", "eas", "intra", "tota", "alios", "ceteri", "seu", "ulla", "fore", "quin", "alio", "iis", "ob", "multi", "donec", "illo", "hi", "quorum", "nostris", "sui", "eris", "alia"], "ru": ["\u0432", "\u0438", "\u043D\u0430", "\u0441", "\u043F\u043E", "\u043D\u0435", "\u0438\u0437", "\u043A", "\u0447\u0442\u043E", "\u0431\u044B\u043B", "\u043E\u0442", "\u0430", "\u0437\u0430", "\u0434\u043B\u044F", "\u043A\u0430\u043A", "\u0435\u0433\u043E", "\u043E\u043D", "\u0434\u043E", "\u043F\u043E\u0441\u043B\u0435", "\u0442\u0430\u043A\u0436\u0435", "\u043E", "\u043F\u0440\u0438", "\u0431\u044B\u043B\u043E", "\u043D\u043E", "\u0431\u044B\u043B\u0438", "\u0438\u043B\u0438", "\u044D\u0442\u043E", "\u0432\u043E", "\u0443", "\u0431\u044B\u043B\u0430", "\u0436\u0435", "\u0438\u0445", "\u043A\u043E\u0442\u043E\u0440\u044B\u0439", "\u0435\u0451", "\u0442\u043E", "\u043F\u043E\u0434", "\u044D\u0442\u043E\u0433\u043E", "\u0442\u043E\u043C", "\u043E\u0434\u043D\u0430\u043A\u043E", "\u0442\u043E\u0433\u043E", "\u0442\u043E\u043B\u044C\u043A\u043E", "\u043E\u043D\u0438", "\u043E\u043D\u0430", "\u043A\u043E\u0442\u043E\u0440\u044B\u0435", "\u0441\u043E", "\u043C\u0435\u0436\u0434\u0443", "\u0442\u0435\u043C", "\u0447\u0435\u0440\u0435\u0437", "\u0432\u0441\u0435", "\u0447\u0442\u043E\u0431\u044B", "\u0441\u0440\u0435\u0434\u0438", "\u0441\u0432\u043E\u0435\u0439", "\u043E\u043A\u043E\u043B\u043E", "\u043A\u043E\u0442\u043E\u0440\u044B\u0445", "\u043A\u0440\u043E\u043C\u0435", "\u0432\u0441\u0435\u0433\u043E", "\u0432\u0441\u0435\u0445", "\u044D\u0442\u043E\u0442", "\u043A\u043E\u0442\u043E\u0440\u043E\u0439", "\u0431\u044B\u0442\u044C", "\u044D\u0442\u043E\u043C", "\u0438\u043C", "\u043A\u043E\u0442\u043E\u0440\u043E\u0433\u043E", "\u0438\u0437-\u0437\u0430", "\u043A\u043E\u0442\u043E\u0440\u0430\u044F", "\u043B\u0438\u0448\u044C", "\u0435\u043C\u0443", "\u0441\u0435\u0431\u044F", "\u043E\u0431", "\u043F\u0440\u043E\u0442\u0438\u0432", "\u0441\u043E\u0431\u043E\u0439", "\u043D\u0438", "\u0431\u0435\u0437", "\u043D\u0430\u0434", "\u0434\u0430\u0436\u0435", "\u043D\u0435\u0433\u043E", "\u043D\u0438\u0445", "\u043D\u0435\u043A\u043E\u0442\u043E\u0440\u044B\u0435", "\u0431\u0443\u0434\u0435\u0442", "\u043D\u0438\u043C", "\u044D\u0442\u043E\u0439", "\u0445\u043E\u0442\u044F", "\u0434\u0435", "\u0447\u0435\u043C", "\u044D\u0442\u0438", "\u0441\u043E\u0433\u043B\u0430\u0441\u043D\u043E", "\u0441\u0432\u043E\u044E", "\u0442\u0438\u043F\u0430", "\u0441\u0432\u043E\u0439", "\u0441\u0432\u043E\u0438\u0445", "\u0441\u0432\u043E\u0451", "\u043D\u0435\u0439", "\u043A\u043E\u0442\u043E\u0440\u043E\u043C", "\u0441\u0432\u043E\u0435\u0433\u043E", "\u044F", "\u043F\u043E\u0442\u043E\u043C\u0443", "\u0442\u0430\u043A\u0438\u0435", "\u0442.", "\u044D\u0442\u0438\u0445", "\u043F\u0435\u0440\u0435\u0434", "\u044D\u0442\u0430", "\u0435\u0441\u043B\u0438", "\u0441\u0432\u043E\u0438", "\u044D\u0442\u0438\u043C", "\u0442\u0435\u0445", "\u043F\u043E\u044D\u0442\u043E\u043C\u0443", "\u043A\u043E\u0442\u043E\u0440\u043E\u0435", "\u043B\u0438\u0431\u043E", "\u043F\u043E\u0441\u043A\u043E\u043B\u044C\u043A\u0443", "\u0432\u0441\u0451", "\u0431\u043B\u0430\u0433\u043E\u0434\u0430\u0440\u044F", "\u043A\u043E\u0442\u043E\u0440\u043E\u043C\u0443", "\u0432\u043E\u043A\u0440\u0443\u0433", "\u043A\u043E\u0442\u043E\u0440\u0443\u044E", "\u043D.", "\u0438\u043C\u0435\u043D\u043D\u043E", "\u044D\u0442\u0443", "\u0442\u0430\u043A\u0438\u0445", "\u0442\u043E\u0442", "\u043D\u0451\u043C", "\u0432\u0441\u0435\u0439", "\u043D\u0435\u0451", "\u043A\u043E\u0442\u043E\u0440\u044B\u043C", "\u043F\u043E\u043A\u0430", "\u043A\u0442\u043E", "\u043A\u0430\u0436\u0434\u044B\u0439", "\u043C\u044B", "\u0431\u0443\u0434\u0443\u0447\u0438", "\u043D\u0435\u043A\u043E\u0442\u043E\u0440\u044B\u0445", "\u0432\u0441\u0435\u043C", "\u0432\u0434\u043E\u043B\u044C", "\u0447\u0435\u0433\u043E", "\u0432\u0441\u044E", "\u043E\u043D\u043E", "\u0442\u043E\u0436\u0435", "\u043F\u0440\u043E\u0441\u0442\u043E", "\u043B\u0438", "\u043A\u043E\u0442\u043E\u0440\u044B\u043C\u0438", "\u0431\u044B", "\u043D\u0438\u043C\u0438", "\u0435\u0439", "\u0442\u0435", "\u0441\u0432\u043E\u0438\u043C\u0438", "\u0441\u0435\u0431\u0435", "\u0432\u043C\u0435\u0441\u0442\u043E", "\u0441\u0432\u043E\u0435", "\u0441\u0432\u043E\u0438\u043C", "\u0441\u0432\u043E\u0435\u043C\u0443", "\u043B\u0430", "\u0432\u0435\u0441\u044C", "c", "\u043F\u0443\u0442\u0451\u043C", "\u0441\u043F\u0443\u0441\u0442\u044F", "\u043A\u0430\u0436\u0434\u043E\u0439", "\u043F\u043E\u043C\u0438\u043C\u043E", "\u0431\u0443\u0434\u0443\u0442", "\u043D\u0438\u0447\u0435\u0433\u043E", "\u043A\u0430\u0436\u0434\u0430\u044F", "\u0432\u043D\u0443\u0442\u0440\u0438", "\u0442\u0430\u043A\u043E\u0439", "\u043D\u0430\u0448\u0438", "\u0442\u0430\u043A\u0438\u043C", "\u0442\u043E\u043C\u0443", "\u0441\u0432\u043E\u0451\u043C", "\u043D\u0435\u043C\u0443", "\u044D\u0442\u043E\u043C\u0443", "\u0444\u043E\u043D", "\u043F\u0440\u0438\u0447\u0451\u043C", "\u043F\u0440\u043E", "\u043D\u0430\u043C", "\u0432\u044B", "\u0441\u0432\u043E\u0435\u043C", "\u0434\u0430", "\u0441\u0438\u0445"], "es": ["de", "el", "la", "que", "en", "a", "y", "los", "se", "un", "las", "por", "con", "una", "para", "su", "es", "ha", "lo", "como", "sus", "pero", "le", "o", "este", "entre", "sobre", "han", "fue", "si", "sin", "esta", "cuando", "desde", "seg\xFAn", "est\xE1", "hasta", "ser", "todo", "porque", "son", "ante", "contra", "me", "durante", "aunque", "tras", "hab\xEDa", "sido", "puede", "otros", "todos", "nos", "ni", "uno", "era", "mientras", "e", "quien", "unos", "les", "ese", "mismo", "esa", "otro", "cada", "ser\xE1", "\xE9l", "haber", "sino", "est\xE1n", "otra", "qu\xE9", "eso", "nada", "estos", "ellos", "algunos", "sea", "fueron", "otras", "todas", "debe", "mi", "hacia", "toda", "muchos", "estas", "algo", "unas", "estaba", "estar", "pueden", "yo", "ello", "bajo", "misma", "pues", "nadie", "esto", "c\xF3mo", "ning\xFAn", "ser\xEDa", "podr\xEDa", "ella", "varios", "haya", "cualquier", "algunas", "hab\xEDan", "he", "esos", "hemos", "nosotros", "nuestra", "muchas", "nuestro", "propio", "te", "propia", "varias", "eran", "cuanto", "\xE9ste", "cual", "quienes", "deben", "estamos", "alg\xFAn", "diferentes", "siendo", "cuyo", "ninguna", "ellas", "alguna", "estoy", "esas", "hubiera", "estuvo", "pudo", "ser\xE1n", "cuya", "pod\xEDa", "aquel", "estaban", "m\xED", "dem\xE1s", "pueda", "pocos", "mediante", "mucha", "habr\xEDa", "\xE9sta", "deber\xE1", "cuales", "usted", "qui\xE9n", "nuestros", "podido", "puedan", "alguien", "podr\xE1", "mis", "podemos", "i", "somos", "diversos", "sean", "mismos", "estar\xE1", "soy", "aquella", "aquellos", "podr\xEDan", "cu\xE1l", "ninguno", "nuestras", "deber\xEDa", "pocas", "diversas", "deber\xE1n", "tu", "distintos", "distintas", "est\xE9", "pudiera", "alguno", "tantos", "podr\xE1n", "mismas", "tanta", "puedo", "poca", "u", "estar\xE1n", "deber\xEDan", "hayan", "deb\xEDa", "debemos", "cierta", "salvo", "pudieron", "aquellas", "tales", "debi\xF3", "querer", "ciertas", "cualquiera", "\xE9stos", "tantas", "cuyos", "suyo", "aquello", "t\xFA", "fueran", "hubiese", "ciertos", "per", "fuese", "estar\xEDa", "estuvieron", "estando", "deb\xEDan", "suyos", "els", "\xE9stas", "est\xE9n", "escasos", "pod\xEDan", "ser\xEDan", "cuantos", "excepto", "pudieran", "suya", "cuyas", "hubieran", "eres", "habr\xEDan", "os", "podamos", "in", "ti", "podr\xEDamos", "hubiesen", "estuve", "est\xE1bamos", "ustedes", "cu\xE1nto", "podremos", "puedes", "sendas", "est\xE1s", "m\xEDo", "bastantes", "fui", "estuviera", "cu\xE1les", "pude"], "tr": ["bir", "bu", "ve", "de", "da", "ki", "o", "i\xE7in", "gibi", "ben", "ama", "diye", "sonra", "kadar", "ne", "her", "li", "ile", "ya", "\xF6nce", "olarak", "de\u011Fil", "l\u0131", "beni", "bana", "d\u0131r", "ise", "dir", "benim", "hem", "g\xF6re", "ancak", "ydi", "onun", "onu", "siz", "m\u0131", "d\u0131", "mi", "biri", "ona", "biz", "sen", "sana", "kendi", "bunu", "\xE7\xFCnk\xFC", "t\xFCm", "birlikte", "yd\u0131", "\u015Fu", "dur", "birka\xE7", "lu", "bunlar", "tu", "neden", "bizim", "bunun", "kendini", "veya", "hi\xE7bir", "buna", "de\u011Fildir", "a", "yani", "senin", "\xFCzere", "onlar\u0131n", "tir", "kimi", "im", "baz\u0131", "sa", "lar", "bir\xE7ok", "ler", "bize", "hatta", "t\u0131r", "bizi", "ca", "ydu", "mu", "seni", "oysa", "ili\u015Fkin", "kar\u015F\u0131", "kendisine", "ondan", "onlar\u0131", "bence", "s\u0131z", "bunlar\u0131", "de\u011Filim", "onunla", "kendimi", "size", "hepsi", "fakat", "de\u011Fildi", "tur", "se", "onlara", "boyunca", "onlar", "l\u0131k", "ti", "beri", "e\u011Fer", "kendisini", "l\xFC", "ce", "\u0131c\u0131", "ici", "ken", "t\u0131", "\u015Funlar\u0131", "kendine", "ydim", "\xE7a", "d\xFCr", "\u0131z", "birer", "yim", "ait", "sizin", "\xE7o\u011Fu", "ra\u011Fmen", "di", "sizi", "\xF6rne\u011Fin", "kendisi", "lik", "dek", "lar\u0131", "bunlar\u0131n", "benimle", "hi\xE7biri", "neler", "kar\u015F\u0131n", "m\xFC", "y\u0131m", "y\xF6nelik", "hepsinin", "du", "iz", "leri", "seninle", "\u015Funu", "bundan", "kim", "edir", "birini", "itibaren", "m\u0131\u015F", "dolay\u0131", "lar\u0131n", "'li"] });

  // ../../../../../tmp/scratchpad/falsify-stub/lang-stub.js
  var DECLARED2 = Object.freeze({ minReplyLetters: 24, threadTurns: 6 });

  // ../khora-clone/vendor/the-fold/fold-chat-ground.js
  var STOP_EN = ["the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "are", "was", "were", "be", "been", "by", "as", "at", "it", "its", "this", "that", "these", "those", "with", "from", "into", "his", "her", "their", "they", "them", "we", "you", "he", "she", "had", "has", "have", "not", "but", "also", "first", "one", "two", "new", "old", "then", "than", "when", "where", "which", "who", "will", "would", "could", "should", "said", "says", "any", "all", "some", "may", "more", "most", "other", "such", "only", "own", "same", "so", "no", "nor", "too", "very"];
  var HEDGE_EN = ["roughly", "officially", "formally", "widely", "commonly", "traditionally", "approximately", "approx", "nearly", "likely", "probably", "possibly", "perhaps", "apparently", "believed", "thought", "considered", "indicate", "indicates", "suggest", "suggests", "source", "sources", "article", "page", "almost", "circa", "estimated", "reportedly", "generally", "typically", "usually", "often", "really", "actually", "simply", "basically", "currently", "still", "just", "even", "ever", "about", "around", "located", "situated", "found", "known", "called", "named", "stands", "stand", "lies", "became", "become", "becomes", "made", "makes", "make", "using", "used", "uses", "being", "there", "their", "which", "while", "since", "many", "much", "well", "year", "years", "today", "currently", "overall", "namely", "indeed", "exactly"];
  var cps = (ranges) => new RegExp("[" + ranges.map(([a, b]) => String.fromCharCode(a) + (b ? "-" + String.fromCharCode(b) : "")).join("") + "]", "g");
  var FOLD_MARKS = cps([[768, 879], [1600], [1611, 1631], [1648], [1425, 1479]]);
  var PLAIN_ASCII = /^[\x00-\x7f]*$/;
  var foldWord = (t) => {
    const s = String(t);
    return PLAIN_ASCII.test(s) ? s.toLowerCase() : s.normalize("NFD").replace(FOLD_MARKS, "").normalize("NFC").toLowerCase();
  };
  var STOP = /* @__PURE__ */ new Set([...STOP_EN, ...Object.values(FUNCTION_WORDS).flat().map(foldWord)]);
  var HEDGE = new Set(HEDGE_EN);
  var UNSPACED = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}]/u;
  var DIGIT_ZEROS = [1632, 1776, 2406, 2534, 2662, 2790, 2918, 3046, 3174, 3302, 3430, 3664, 3872, 65296];
  var NON_ASCII_DIGIT = cps([[1632, 1641], [1776, 1785], [2406, 2415], [2534, 2543], [2662, 2671], [2790, 2799], [2918, 2927], [3046, 3055], [3174, 3183], [3302, 3311], [3430, 3439], [3664, 3673], [3872, 3881], [65296, 65305]]);
  var asciiDigits = (s) => !NON_ASCII_DIGIT.test(s) ? s : s.replace(/\p{Nd}/gu, (ch) => {
    const cp = ch.codePointAt(0);
    if (cp < 128) return ch;
    for (const z of DIGIT_ZEROS) if (cp >= z && cp < z + 10) return String(cp - z);
    return ch;
  });
  var TAG_RE = /\[\s*[WSM]?\d+\s*\]|\b[WS]\d+\b(?!\.\d)/g;
  var SOURCEY = /wikipedia|article|page|source|site|website|passage|text|document|encyclop\w*|entry|report|\bW\d+\b|\[\s*[WS]\d+\s*\]/i;
  var LEAD_IN = /^\s*(?:according to|per|as (?:stated|reported|noted|described|explained|written|shown) (?:by|in|on)|based on|from|drawing on|source:)\s+[^,:;]{0,90}[,:]\s*/iu;
  var SAYS = /^\s*(?:(?:the|these|those|my|your|this|that)\s+(?:[\p{L}'’-]+\s+){0,2})?(?:sources?|passages?|articles?|pages?|documents?|texts?|results?|excerpts?|materials?)(?:\s+(?:I|we)\s+(?:have|read|found))?\s+(?:indicates?|shows?|says?|states?|suggests?|mentions?|notes?|reports?|confirms?|explains?|describes?|tells?|supports?|puts? it)(?:\s+(?:us|you))?(?:\s+that)?\s*[,:]?\s*|^\s*as\s+(?:the|this|that|these)\s+(?:[\p{L}'’-]+\s+){0,2}(?:sources?|passages?|articles?|pages?|documents?|texts?|results?|excerpts?|materials?)\s+(?:puts? it|says?|states?|explains?|notes?|describes?)\s*[,:]?\s*|^\s*based on\s+(?:the\s+)?(?:[\p{L}'’-]+\s+){0,2}(?:sources?|passages?|articles?|pages?|documents?|texts?|results?|excerpts?|materials?)[^,:;]{0,40}[,:]\s*/iu;
  var TRAIL_SRC = /[,;]?\s*(?:according to|as (?:stated|reported|noted) (?:by|in)|per)\s+(?:the\s+)?(?:\[?[WS]\d+\]?|sources?|articles?|pages?)[^.!?]*(?=[.!?]?$)/iu;
  var TRAIL_EMPTY = /[,;]?\s*(?:according to|as (?:stated|reported|noted) (?:by|in)|per)\s*[.!?]*\s*$/iu;
  var TRAIL_SAYS = /[,;]?\s*(?:the|this|that|my)\s+(?:[\p{L}'’-]+\s+)?(?:sources?|reports?|articles?|pages?|passages?|texts?|documents?|studies|study|data|material)\s+(?:says?|states?|notes?|reports?|indicates?|shows?|suggests?|explains?|adds?)\W*$/iu;
  var escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  var SITE_LIST = [...SITE_NAMES].map((n) => n.toLowerCase());
  var SITE_RE2 = new RegExp(`(?<![\\p{L}\\p{N}])(?:${[...SITE_NAMES].sort((a, b) => b.length - a.length).map(escRe).join("|")})(?![\\p{L}\\p{N}])`, "giu");
  function claimOf(text, extraSiteNames = []) {
    let s = String(text ?? "").replace(/^\s*[*\-•]\s*\*\*[^*\n]{1,60}:\*\*\s*/u, "").replace(/[*_`#>]+/g, " ").replace(TAG_RE, " ");
    const lead = s.match(LEAD_IN);
    if (lead && SOURCEY.test(lead[0])) s = s.slice(lead[0].length);
    s = s.replace(SAYS, "").replace(TRAIL_SRC, "").replace(TRAIL_EMPTY, "").replace(TRAIL_SAYS, "").replace(/^[\s"'“”‘’>-]+|[\s"'“”‘’]+$/gu, "");
    const low = s.toLowerCase();
    if (SITE_LIST.some((n) => low.includes(n))) s = s.replace(SITE_RE2, " ");
    for (const n of extraSiteNames) s = s.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escRe(n)}(?![\\p{L}\\p{N}])`, "giu"), " ");
    return s.replace(/\s+/g, " ").trim();
  }
  var NAME_RUN_RE = /(?<![\p{L}\p{N}_])(\p{Lu}[\p{L}\p{N}_.'-]*(?:\s+\p{Lu}[\p{L}\p{N}_.'-]*)+)(?<=[\p{L}\p{N}_])/gu;
  var ACRONYM_RE = /(?<![\p{L}\p{N}_])(\p{Lu}{2,})(?![\p{L}\p{N}_])/gu;
  var LONE_NAME_RE = /(?<![\p{L}\p{N}_.'-])(\p{Lu}[\p{L}\p{N}_'-]+)(?![\p{L}\p{N}_'-])(?!\.[\p{L}\p{N}])/gu;
  var COMMON_CAP = /* @__PURE__ */ new Set([
    "The",
    "A",
    "An",
    "In",
    "On",
    "At",
    "Of",
    "For",
    "To",
    "And",
    "But",
    "Or",
    "It",
    "Its",
    "This",
    "That",
    "These",
    "Those",
    "When",
    "Where",
    "Which",
    "Who",
    "Why",
    "How",
    "As",
    "By",
    "From",
    "With",
    "His",
    "Her",
    "Their",
    "They",
    "We",
    "You",
    "He",
    "She",
    "If",
    "So",
    "Then",
    "There",
    "Here",
    "Today",
    "Tomorrow",
    "Yesterday",
    "It's",
    "There's",
    "However",
    "Meanwhile",
    "Also",
    "Both",
    "Each",
    "Every",
    "Some",
    "Most",
    "Many",
    "After",
    "Before",
    "During",
    "Between",
    "Under",
    "Over",
    "Now",
    "Once",
    "Yet",
    "Thus",
    "Hence",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
    // sentence openers of the other languages we answer in: interrogatives and articles are not names
    "Qu\xE9",
    "Cu\xE1l",
    "Cu\xE1les",
    "C\xF3mo",
    "Cu\xE1ndo",
    "D\xF3nde",
    "Qui\xE9n",
    "Por",
    "El",
    "La",
    "Los",
    "Las",
    "Un",
    "Una",
    "Es",
    "Seg\xFAn",
    "Quel",
    "Quelle",
    "Quels",
    "Quelles",
    "Comment",
    "Quand",
    "O\xF9",
    "Qui",
    "Quoi",
    "Pourquoi",
    "Le",
    "Les",
    "Une",
    "Des",
    "Du",
    "Selon",
    "Wie",
    "Was",
    "Wer",
    "Wann",
    "What",
    "Whose",
    "Whom",
    "Based",
    "Note",
    "As\xED",
    "Entonces",
    "Donc",
    "Dann",
    "Wo",
    "Warum",
    "Welche",
    "Welcher",
    "Welches",
    "Der",
    "Die",
    "Das",
    "Ein",
    "Eine",
    "Es",
    "Laut",
    "Qual",
    "Quais",
    "Quem",
    "Quando",
    "Onde",
    "Porque",
    "Como",
    "O",
    "Os",
    "As",
    "Um",
    "Uma",
    "Segundo",
    "Quale",
    "Dove",
    "Perch\xE9",
    "Il",
    "Lo",
    "Gli",
    "Wat",
    "Waar",
    "Wanneer",
    "Waarom",
    "Het",
    "Een"
  ]);
  for (const w of ["According", "However", "Although", "Because", "While", "After", "Before", "Since", "During", "If", "Yet", "Also", "Some", "Many", "Most", "Other", "Others", "Such", "Each", "Every", "Both", "Several", "Overall", "Instead", "Meanwhile", "Furthermore", "Moreover", "Additionally", "Despite", "Unlike", "Like", "Following", "Through", "Within", "Without", "Between", "Today", "Here", "There", "Their", "They", "We", "Our", "His", "Her", "She", "He", "Yes", "No", "Not"]) COMMON_CAP.add(w);
  function namesIn(text) {
    const s = claimOf(text);
    const names = /* @__PURE__ */ new Set();
    const taken = [];
    for (const m of s.matchAll(NAME_RUN_RE)) {
      names.add(m[1]);
      taken.push([m.index, m.index + m[0].length]);
    }
    for (const m of s.matchAll(ACRONYM_RE)) {
      names.add(m[1]);
      taken.push([m.index, m.index + m[0].length]);
    }
    const inTaken = (i) => taken.some(([a, b]) => i >= a && i < b);
    for (const m of s.matchAll(LONE_NAME_RE)) {
      const w = m[1];
      if (COMMON_CAP.has(w)) continue;
      if (inTaken(m.index)) continue;
      if (/^[A-Z][a-z]?$/.test(w)) continue;
      names.add(w);
    }
    return [...names];
  }
  var UNIT_TABLE = [
    ["len", 1, ["m", "metre", "metres", "meter", "meters", "metro", "metros", "m\xE8tre", "m\xE8tres", "metr", "\u043C\u0435\u0442\u0440", "\u043C\u0435\u0442\u0440\u0430", "\u043C\u0435\u0442\u0440\u043E\u0432", "\u7C73", "\u516C\u5C3A", "\u0645\u062A\u0631", "\u0645\u062A\u0631\u0627", "\u0623\u0645\u062A\u0627\u0631", "\u0627\u0645\u062A\u0627\u0631", "\u092E\u0940\u091F\u0930", "\u30E1\u30FC\u30C8\u30EB", "\uBBF8\uD130"]],
    ["len", 1e3, ["km", "kilometre", "kilometres", "kilometer", "kilometers", "kil\xF3metro", "kil\xF3metros", "kilom\xE8tre", "kilom\xE8tres", "\u043A\u0438\u043B\u043E\u043C\u0435\u0442\u0440", "\u043A\u0438\u043B\u043E\u043C\u0435\u0442\u0440\u0430", "\u043A\u0438\u043B\u043E\u043C\u0435\u0442\u0440\u043E\u0432", "\u043A\u043C", "\u516C\u91CC", "\u5343\u7C73", "\u0643\u064A\u0644\u0648\u0645\u062A\u0631", "\u0915\u093F\u0932\u094B\u092E\u0940\u091F\u0930", "\u30AD\u30ED\u30E1\u30FC\u30C8\u30EB", "\u30AD\u30ED"]],
    ["len", 0.01, ["cm", "centimetre", "centimetres", "centimeter", "centimeters", "\u5398\u7C73", "\u516C\u5206"]],
    ["len", 0.3048, ["ft", "foot", "feet", "pie", "pies", "pied", "pieds", "p\xE9", "p\xE9s", "fu\xDF", "fuss", "\u0444\u0443\u0442", "\u0444\u0443\u0442\u043E\u0432", "\u82F1\u5C3A", "\u0642\u062F\u0645", "\u092B\u093C\u0940\u091F", "\u092B\u0940\u091F"]],
    ["len", 1609.344, ["mi", "mile", "miles", "milla", "millas", "mille", "milles", "meile", "meilen", "\u043C\u0438\u043B\u044F", "\u043C\u0438\u043B\u044C", "\u82F1\u91CC", "\u0645\u064A\u0644", "\u092E\u0940\u0932"]],
    ["mass", 1, ["kg", "kilogram", "kilograms", "kilogramme", "kilogrammes", "kilo", "kilos", "\u516C\u65A4", "\u5343\u514B"]],
    ["mass", 1e-3, ["g", "gram", "grams", "gramme", "grammes"]],
    ["mass", 0.45359237, ["lb", "lbs", "pound", "pounds", "libra", "libras", "livre", "livres", "\u78C5"]]
  ];
  var UNITS = /* @__PURE__ */ new Map();
  for (const [dim, f, words2] of UNIT_TABLE) for (const w of words2) UNITS.set(foldWord(w), { dim, f, w: foldWord(w) });
  var UNIT_WORDS = [...UNITS.keys()].sort((a, b) => b.length - a.length);
  var NUMBER_RE = /\b\d[\d,]*(?:\.\d+)?%?(?:st|nd|rd|th|s)?\b/g;
  function figuresIn(text, base = 0) {
    const src = asciiDigits(String(text ?? ""));
    const out = [];
    for (const m of src.matchAll(NUMBER_RE)) {
      const norm = m[0].replace(/,/g, "").toLowerCase();
      const end = m.index + m[0].length;
      const rest = foldWord(src.slice(end, end + 16).replace(/^\s?/, ""));
      let unit = null;
      for (const w of UNIT_WORDS) {
        if (!rest.startsWith(w)) continue;
        const nx = rest.slice(w.length, w.length + 1);
        if (UNSPACED.test(w) || !nx || !/[\p{L}\p{N}²³]/u.test(nx)) {
          unit = UNITS.get(w);
          break;
        }
      }
      const numeric = /^\d[\d.]*$/.test(norm);
      const dec = numeric && norm.includes(".") ? norm.length - norm.indexOf(".") - 1 : 0;
      out.push({ raw: m[0], norm, v: numeric ? parseFloat(norm) : NaN, dec, numeric, unit, start: base + m.index, end: base + end });
    }
    return out;
  }
  var nearFig = (v, c) => Math.abs(v - c.v) <= 0.5 * Math.pow(10, -c.dec) + 1e-9 * Math.abs(c.v);
  function figureMatches(c, w) {
    if (c.norm === w.norm) return true;
    if (!c.numeric || !w.numeric) return false;
    if (c.unit && w.unit) return c.unit.dim === w.unit.dim && nearFig(w.v * w.unit.f / c.unit.f, c);
    if (w.dec > c.dec) return Number(w.v.toFixed(c.dec)) === c.v;
    return false;
  }
  var STEM_RE = /^[a-z]+$/;
  var IRREGULAR = Object.fromEntries(Object.entries({
    fall: "fell fallen",
    rise: "rose risen",
    begin: "began begun",
    write: "wrote written",
    build: "built",
    become: "became",
    hold: "held",
    take: "took taken",
    give: "gave given",
    lead: "led",
    win: "won",
    fly: "flew flown",
    see: "saw seen",
    go: "went gone",
    make: "made",
    know: "knew known",
    find: "found",
    bear: "bore born borne",
    die: "died",
    lose: "lost",
    send: "sent",
    stand: "stood",
    sit: "sat",
    speak: "spoke spoken",
    choose: "chose chosen",
    break: "broke broken",
    drive: "drove driven",
    ride: "rode ridden",
    teach: "taught",
    buy: "bought",
    sell: "sold",
    pay: "paid",
    say: "said",
    tell: "told",
    think: "thought",
    bring: "brought",
    come: "came",
    run: "ran",
    leave: "left",
    meet: "met",
    keep: "kept",
    grow: "grew grown",
    draw: "drew drawn",
    throw: "threw thrown",
    sing: "sang sung",
    swim: "swam swum"
  }).flatMap(([base, forms]) => forms.split(" ").map((f) => [f, base])));
  var stemOf = (t) => {
    if (!STEM_RE.test(t)) return t;
    if (IRREGULAR[t]) return IRREGULAR[t];
    if (t.length < 5) return t;
    const r = t.replace(/(?:ing|ed|es|ly|s|e)$/, "");
    return r.length >= 4 ? r : t;
  };
  var EN_FUNCTION = new Set(FUNCTION_WORDS.en.map(foldWord));
  var QUANT_WORDS = /* @__PURE__ */ new Set(["reach", "reaches", "reached", "reaching", "measure", "measures", "measured", "measuring", "rise", "rises", "rose", "span", "spans", "extend", "extends", "weigh", "weighs", "cover", "covers", "high", "tall", "long", "wide", "deep", "thick", "heavy", "higher", "highest", "taller", "tallest", "longer", "longest", "wider", "widest", "deeper", "deepest", "thicker", "thickest", "heavier", "heaviest", "height", "length", "width", "depth", "weight", "altitude", "elevation", "distance", "size"]);
  var QUANT_LIST = [...QUANT_WORDS];

  // ../khora-clone/native/the-fold/relative.js
  var SDR_BITS = 4096;
  var ECHO_BITS = 512;
  var PAIR = "";
  var isWord = (t) => !t.includes(PAIR);
  function hash32(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }
  function tokensOf(text) {
    const words2 = String(text ?? "").toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
    const out = words2.slice();
    for (let i = 1; i < words2.length; i++) out.push(`${words2[i - 1]}${PAIR}${words2[i]}`);
    return out;
  }
  function sdrOf(text, { bits = SDR_BITS } = {}) {
    const set = /* @__PURE__ */ new Set();
    for (const t of tokensOf(text)) set.add(hash32(t) % bits);
    return Uint32Array.from([...set].sort((a, b) => a - b));
  }
  function sharedBits(a, b) {
    let i = 0, j = 0, n = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) {
        n++;
        i++;
        j++;
      } else if (a[i] < b[j]) i++;
      else j++;
    }
    return n;
  }
  function overlap(a, b) {
    return a.length && b.length ? sharedBits(a, b) / Math.sqrt(a.length * b.length) : 0;
  }
  var POPCOUNT8 = (() => {
    const t = new Uint8Array(256);
    for (let i = 1; i < 256; i++) t[i] = t[i >> 1] + (i & 1);
    return t;
  })();
  function packSdr(sdr, { bits = SDR_BITS } = {}) {
    const out = new Uint8Array(Math.ceil(bits / 8));
    for (let i = 0; i < sdr.length; i++) {
      const b = sdr[i];
      out[b >> 3] |= 1 << (b & 7);
    }
    return out;
  }
  function popcountPacked(u8) {
    let n = 0;
    for (let i = 0; i < u8.length; i++) n += POPCOUNT8[u8[i]];
    return n;
  }
  function packedOverlap(a, b) {
    if (!a?.length || !b?.length) return 0;
    let shared = 0;
    for (let i = 0; i < a.length; i++) shared += POPCOUNT8[a[i] & b[i]];
    const wa = popcountPacked(a), wb = popcountPacked(b);
    return wa && wb ? shared / Math.sqrt(wa * wb) : 0;
  }
  var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  function bytesToBase64(u8) {
    let out = "";
    for (let i = 0; i < u8.length; i += 3) {
      const b0 = u8[i], b1 = u8[i + 1], b2 = u8[i + 2];
      out += B64[b0 >> 2] + B64[(b0 & 3) << 4 | b1 >> 4];
      out += b1 !== void 0 ? B64[(b1 & 15) << 2 | (b2 ?? 0) >> 6] : "=";
      out += b2 !== void 0 ? B64[b2 & 63] : "=";
    }
    return out;
  }
  function base64ToBytes(s) {
    const out = [];
    let buf = 0, nb = 0;
    for (const c of s) {
      if (c === "=") break;
      const v = B64.indexOf(c);
      if (v < 0) continue;
      buf = buf << 6 | v;
      nb += 6;
      if (nb >= 8) {
        nb -= 8;
        out.push(buf >> nb & 255);
      }
    }
    return Uint8Array.from(out);
  }
  var Node = class {
    constructor(text, payload, tier = "holograph", sdr = null) {
      this.tier = tier;
      this.sdr = sdr ?? sdrOf(text, { bits: tier === "echo" ? ECHO_BITS : SDR_BITS });
      this.text = tier === "holograph" ? text : null;
      this.payload = payload;
      this.next = /* @__PURE__ */ new Map();
      this.prev = /* @__PURE__ */ new Map();
      this.signature = tier === "holograph" ? hash32(text).toString(16) : stateSignature(this.sdr);
    }
  };
  function stateSignature(sdr) {
    let h = 2166136261;
    for (let i = 0; i < sdr.length; i++) {
      h ^= sdr[i];
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(16);
  }
  var Field = class _Field {
    constructor({ spread = 0.25, steps = 1, packed = false } = {}) {
      this.nodes = [];
      this.spread = spread;
      this.steps = steps;
      this.last = null;
      this.vocab = /* @__PURE__ */ new Map();
      this.posting = /* @__PURE__ */ new Map();
      this._index = null;
      this.packed = Boolean(packed);
    }
    get size() {
      return this.nodes.length;
    }
    /** The set bits of a state, whichever form — sparse indices or packed bytes. */
    static setBitsOf(sdr) {
      const out = [];
      if (sdr instanceof Uint8Array) {
        for (let b = 0; b < sdr.length * 8; b++) if (sdr[b >> 3] & 1 << (b & 7)) out.push(b);
      } else {
        for (let k = 0; k < sdr.length; k++) out.push(sdr[k]);
      }
      return out;
    }
    /** Rebuild the posting lists (bit → node indices) — the recall index of GFP
     * Pass 36. Bits are FEATURES, never addresses of nodes (F1 still holds); the
     * posting is derived from the states and is always rebuildable. */
    buildPostings() {
      this.posting = /* @__PURE__ */ new Map();
      this._index = null;
      for (let i = 0; i < this.nodes.length; i++) {
        for (const bit of _Field.setBitsOf(this.nodes[i].sdr)) {
          let list = this.posting.get(bit);
          if (!list) {
            list = [];
            this.posting.set(bit, list);
          }
          list.push(i);
        }
      }
      return this;
    }
    /** Admit a text as one of the memory's tiers: "holograph" (full tokens +
     * address), "shadow" (state + address, no words), "echo" (coarse state +
     * address, no words). A PACKED field stores each state as a bitfield —
     * 2.4× smaller, bitwise overlap (GFP Pass 36 second half). */
    admit(text, payload = null, { after = this.last, tier = "holograph" } = {}) {
      const bits = tier === "echo" ? ECHO_BITS : SDR_BITS;
      const raw = sdrOf(text, { bits });
      const node = new Node(text, payload, tier, this.packed ? packSdr(raw, { bits }) : raw);
      if (after) {
        after.next.set(node, (after.next.get(node) ?? 0) + 1);
        node.prev.set(after, (node.prev.get(after) ?? 0) + 1);
      }
      this.nodes.push(node);
      this.last = node;
      this._index = null;
      const i = this.nodes.length - 1;
      for (const bit of _Field.setBitsOf(node.sdr)) {
        let list = this.posting.get(bit);
        if (!list) {
          list = [];
          this.posting.set(bit, list);
        }
        list.push(i);
      }
      for (const w of tokensOf(text)) if (isWord(w)) this.vocab.set(w, (this.vocab.get(w) ?? 0) + 1);
      return node;
    }
    /** Strengthen a synapse between two nodes that were reached together (Hebb). */
    bind(a, b, w = 1) {
      a.next.set(b, (a.next.get(b) ?? 0) + w);
      b.prev.set(a, (b.prev.get(a) ?? 0) + w);
    }
    /** One synapse forward or back: the neighbour the strongest link names. */
    after(node) {
      let best = null, bw = 0;
      for (const [n, w] of node.next) if (w > bw) {
        best = n;
        bw = w;
      }
      return best;
    }
    before(node) {
      let best = null, bw = 0;
      for (const [n, w] of node.prev) if (w > bw) {
        best = n;
        bw = w;
      }
      return best;
    }
    /**
     * Start from a cue's state and settle. Returns the nodes in activation
     * order with the activation each settled at; nothing about which counts
     * as a recall — that is the null band's to say (see `recallAgainstNull`).
     */
    recall(cue, { steps = this.steps, spread = this.spread } = {}) {
      const q = typeof cue === "string" ? this.packed ? packSdr(sdrOf(cue)) : sdrOf(cue) : cue;
      let a = new Float64Array(this.nodes.length);
      const n = this.nodes.length;
      if (this._index === null || this._index.size !== n) this._index = new Map(this.nodes.map((nd, i) => [nd, i]));
      const index = this._index;
      const seen = /* @__PURE__ */ new Set();
      const cueBits = _Field.setBitsOf(q);
      for (let k = 0; k < cueBits.length; k++) {
        const list = this.posting.get(cueBits[k]);
        if (list) {
          for (let j = 0; j < list.length; j++) if (!seen.has(list[j])) seen.add(list[j]);
        }
      }
      const score = this.packed ? packedOverlap : overlap;
      if (seen.size) {
        for (const i of seen) a[i] = score(q, this.nodes[i].sdr);
      } else {
        for (let i = 0; i < n; i++) a[i] = score(q, this.nodes[i].sdr);
      }
      for (let s = 0; s < steps; s++) {
        const b = Float64Array.from(a);
        for (let i = 0; i < this.nodes.length; i++) {
          if (!a[i]) continue;
          for (const [n2, w] of this.nodes[i].next) b[index.get(n2)] += spread * w * a[i];
          for (const [n2, w] of this.nodes[i].prev) b[index.get(n2)] += spread * w * a[i];
        }
        a = b;
      }
      const order = [];
      const nz = [];
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== 0) nz.push(i);
        else order.push(i);
      }
      nz.sort((i, j) => a[j] - a[i]);
      return [...nz, ...order].map((i) => ({ node: this.nodes[i], activation: a[i] }));
    }
    /**
     * What a cue of `tokenCount` words pulls out of THIS field by chance: random
     * words drawn from the field's own vocabulary, `draws` times; the band is
     * the lowest and highest top activation seen, and the widest gap between a
     * top and its runner-up. Measured, not chosen.
     *
     * `steps`/`spread` are NEW (2026-09-08), additive, and default to the
     * field's own — every existing caller is byte-identical. They exist
     * because a null band measured at one hop count is the wrong control for
     * a recall measured at another: more spreading steps changes what chance
     * alone can pull out of this field, so a multi-hop question ("does this
     * cue still settle on something above chance after N hops") needs its own
     * band at that same N, never the field's default band reused past hop 1.
     */
    nullBand(tokenCount, { draws = 200, rng = Math.random, steps = this.steps, spread = this.spread } = {}) {
      const words2 = [...this.vocab.keys()];
      if (!words2.length || !this.nodes.length) return { lo: 0, hi: 0, margin: 0, draws: 0, steps };
      let lo = Infinity, hi = 0, margin = 0;
      for (let d = 0; d < draws; d++) {
        const cue = Array.from({ length: Math.max(1, tokenCount) }, () => words2[Math.floor(rng() * words2.length)]).join(" ");
        const r = this.recall(cue, { steps, spread });
        const top = r[0]?.activation ?? 0, second = r[1]?.activation ?? 0;
        lo = Math.min(lo, top);
        hi = Math.max(hi, top);
        margin = Math.max(margin, top - second);
      }
      return { lo: lo === Infinity ? 0 : lo, hi, margin, draws, steps };
    }
    /**
     * A recall that says whether it is one: the top node when its activation
     * clears the null band AND its lead over the runner-up exceeds the widest
     * lead chance produced; `ambiguous` when the field settled on more than
     * one figure; `nothing` when it is inside the band.
     *
     * `steps`/`spread` (new, additive, default the field's own — every
     * existing caller unchanged): passed to BOTH the recall and a
     * self-measured band, so a caller cannot accidentally compare a hop-N
     * recall against a hop-1 band by only setting one of the two. A `band`
     * passed in explicitly is trusted as already measured at the right hop
     * count — the caller's own responsibility, same as before.
     */
    recallAgainstNull(cue, { band = null, draws = 200, steps = this.steps, spread = this.spread } = {}) {
      const words2 = tokensOf(cue).filter(isWord).length;
      const b = band ?? this.nullBand(words2, { draws, steps, spread });
      const r = this.recall(cue, { steps, spread });
      const top = r[0], second = r[1];
      if (!top || top.activation <= b.hi) return { kind: "nothing", top: top ?? null, band: b, ranked: r };
      if (second && top.activation - second.activation <= b.margin) return { kind: "ambiguous", top, second, band: b, ranked: r };
      return { kind: "figure", top, band: b, ranked: r };
    }
    /** Nodes with their neighbours named by SIGNATURE — a store with no positions.
     * A shadow or echo node (no text) persists its STATE (`sdr`), since nothing
     * else can rebuild it; a holograph node rebuilds its state from its words.
     * A PACKED node persists its bitfield as base64 — the truly-small row. */
    serialize() {
      return this.nodes.map((n) => ({ tier: n.tier, text: n.text, ...n.tier !== "holograph" ? { sdr: n.sdr instanceof Uint8Array ? bytesToBase64(n.sdr) : Array.from(n.sdr), ...n.sdr instanceof Uint8Array ? { packed: true } : {} } : {}, payload: n.payload, signature: n.signature, next: [...n.next].map(([m, w]) => [m.signature, w]), prev: [...n.prev].map(([m, w]) => [m.signature, w]) }));
    }
    static deserialize(rows, opts) {
      const f = new _Field(opts);
      const bySig = /* @__PURE__ */ new Map();
      for (const r of rows) {
        const tier = r.tier ?? (r.text == null ? "shadow" : "holograph");
        let restored = null;
        if (tier !== "holograph") {
          if (r.packed && typeof r.sdr === "string") restored = base64ToBytes(r.sdr);
          else if (Array.isArray(r.sdr)) restored = Uint32Array.from(r.sdr);
        }
        const n = tier === "holograph" ? new Node(r.text, r.payload, "holograph", f.packed ? packSdr(sdrOf(r.text), { bits: SDR_BITS }) : null) : new Node("", r.payload, tier, restored);
        bySig.set(r.signature, n);
        f.nodes.push(n);
        if (r.text) {
          for (const w of tokensOf(r.text)) if (isWord(w)) f.vocab.set(w, (f.vocab.get(w) ?? 0) + 1);
        }
      }
      for (const r of rows) {
        const n = bySig.get(r.signature);
        for (const [sig, w] of r.next ?? []) {
          const m = bySig.get(sig);
          if (m) n.next.set(m, w);
        }
        for (const [sig, w] of r.prev ?? []) {
          const m = bySig.get(sig);
          if (m) n.prev.set(m, w);
        }
      }
      f.last = f.nodes.at(-1) ?? null;
      f.buildPostings();
      return f;
    }
  };

  // ../khora-clone/vendor/the-fold/fold-chat-junk-lexicon.js
  var CHROME = Object.freeze({
    en: [
      "skip to main content",
      "skip to content",
      "skip to navigation",
      "skip to footer",
      "jump to content",
      "jump to navigation",
      "jump to search",
      "main menu",
      "move to sidebar",
      "toggle navigation",
      "open menu",
      "close menu",
      "sign in",
      "sign up",
      "log in",
      "log out",
      "register now",
      "create an account",
      "create account",
      "my account",
      "your account",
      "newsletter",
      "sign up for our",
      "this website uses cookies",
      "this site uses cookies",
      "we use cookies",
      "cookie settings",
      "cookie policy",
      "cookie preferences",
      "cookie consent",
      "accept all cookies",
      "accept all",
      "reject all",
      "manage preferences",
      "manage cookies",
      "consent details",
      "necessary cookies",
      "preference cookies",
      "statistics cookies",
      "marketing cookies",
      "privacy policy",
      "privacy notice",
      "terms of use",
      "terms of service",
      "terms and conditions",
      "legal notice",
      "do not sell or share",
      "do not sell my",
      "all rights reserved",
      "back to top",
      "site map",
      "sitemap",
      "print this page",
      "email this page",
      "reload to refresh your session",
      "you switched accounts on another tab",
      "you signed in with another tab",
      "dismiss alert",
      "repository files navigation",
      "gov website belongs to an official government organization",
      "official websites use",
      "secure .gov websites use",
      "here's how you know",
      "an official website of",
      "give feedback",
      "log in to",
      "mychart",
      "find a provider",
      "donate now",
      "affiliate commission",
      "affiliate links",
      "may earn a commission",
      "this post may contain",
      "thanks for supporting the site",
      "thank you for your interest",
      "sign up to get",
      "sign up for",
      "receive regular emails",
      "other subscribers",
      "unsubscribe",
      "we do not endorse",
      "advertising on our site",
      "helps support our mission",
      "this feature is well established",
      "baseline widely available",
      "calendar notifications",
      "notify me",
      "are updated with the completion",
      "updated daily",
      "last updated",
      "learn about vigilant mode",
      "if an article link referred you here",
      "it lists works that share the same title",
      "this disambiguation page",
      "[#iabv2settings#]",
      "make valid reports on the unique number of visitors",
      "distribution of traffic",
      "remember information that changes the way the website behaves",
      "cookies are small text files",
      "strictly necessary",
      "verified signature",
      "gpg key"
    ],
    es: ["saltar al contenido", "ir al contenido", "men\xFA principal", "iniciar sesi\xF3n", "cerrar sesi\xF3n", "registrarse", "suscr\xEDbete", "suscribirse", "bolet\xEDn", "pol\xEDtica de privacidad", "t\xE9rminos de uso", "t\xE9rminos y condiciones", "aviso legal", "pol\xEDtica de cookies", "usamos cookies", "este sitio utiliza cookies", "aceptar todas", "rechazar todas", "todos los derechos reservados", "derechos de autor", "cont\xE1ctenos", "contacto", "sobre nosotros", "s\xEDguenos", "compartir", "leer m\xE1s", "ver m\xE1s", "buscar", "volver arriba", "publicidad", "mapa del sitio", "m\xE1s informaci\xF3n"],
    fr: ["aller au contenu", "passer au contenu", "menu principal", "se connecter", "connexion", "se d\xE9connecter", "s'inscrire", "inscription", "s'abonner", "abonnez-vous", "infolettre", "politique de confidentialit\xE9", "conditions d'utilisation", "mentions l\xE9gales", "politique de cookies", "nous utilisons des cookies", "ce site utilise des cookies", "tout accepter", "tout refuser", "tous droits r\xE9serv\xE9s", "nous contacter", "\xE0 propos", "suivez-nous", "partager", "lire la suite", "voir plus", "rechercher", "haut de page", "publicit\xE9", "plan du site", "en savoir plus"],
    de: ["zum inhalt springen", "zum hauptinhalt", "hauptmen\xFC", "anmelden", "abmelden", "registrieren", "newsletter abonnieren", "datenschutz", "datenschutzerkl\xE4rung", "nutzungsbedingungen", "allgemeine gesch\xE4ftsbedingungen", "impressum", "cookie-richtlinie", "wir verwenden cookies", "diese website verwendet cookies", "alle akzeptieren", "alle ablehnen", "alle rechte vorbehalten", "kontakt", "\xFCber uns", "folgen sie uns", "teilen", "weiterlesen", "mehr anzeigen", "suche", "nach oben", "werbung", "sitemap", "mehr erfahren"],
    pt: ["ir para o conte\xFAdo", "saltar para o conte\xFAdo", "menu principal", "entrar", "sair", "cadastre-se", "inscreva-se", "assinar", "newsletter", "pol\xEDtica de privacidade", "termos de uso", "termos e condi\xE7\xF5es", "pol\xEDtica de cookies", "usamos cookies", "este site usa cookies", "aceitar todos", "todos os direitos reservados", "fale conosco", "contato", "sobre n\xF3s", "siga-nos", "compartilhar", "leia mais", "ver mais", "buscar", "voltar ao topo", "publicidade", "mapa do site", "saiba mais"],
    it: ["vai al contenuto", "salta al contenuto", "menu principale", "accedi", "esci", "registrati", "iscriviti", "newsletter", "informativa sulla privacy", "termini di utilizzo", "termini e condizioni", "cookie policy", "utilizziamo i cookie", "questo sito utilizza i cookie", "accetta tutti", "rifiuta tutti", "tutti i diritti riservati", "contattaci", "chi siamo", "seguici", "condividi", "leggi di pi\xF9", "mostra altro", "cerca", "torna su", "pubblicit\xE0", "mappa del sito", "scopri di pi\xF9"],
    nl: ["ga naar de inhoud", "hoofdmenu", "inloggen", "uitloggen", "registreren", "nieuwsbrief", "privacybeleid", "gebruiksvoorwaarden", "cookiebeleid", "wij gebruiken cookies", "alles accepteren", "alle rechten voorbehouden", "contact", "over ons", "volg ons", "delen", "lees meer", "zoeken", "terug naar boven", "advertentie"],
    ru: ["\u043F\u0435\u0440\u0435\u0439\u0442\u0438 \u043A \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u043C\u043E\u043C\u0443", "\u043F\u0435\u0440\u0435\u0439\u0442\u0438 \u043A \u043E\u0441\u043D\u043E\u0432\u043D\u043E\u043C\u0443 \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u043D\u0438\u044E", "\u0433\u043B\u0430\u0432\u043D\u043E\u0435 \u043C\u0435\u043D\u044E", "\u0432\u043E\u0439\u0442\u0438", "\u0432\u044B\u0439\u0442\u0438", "\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044F", "\u043F\u043E\u0434\u043F\u0438\u0441\u0430\u0442\u044C\u0441\u044F", "\u0440\u0430\u0441\u0441\u044B\u043B\u043A\u0430", "\u043F\u043E\u043B\u0438\u0442\u0438\u043A\u0430 \u043A\u043E\u043D\u0444\u0438\u0434\u0435\u043D\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u0441\u0442\u0438", "\u0443\u0441\u043B\u043E\u0432\u0438\u044F \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u044F", "\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u0441\u043A\u043E\u0435 \u0441\u043E\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u0435", "\u0444\u0430\u0439\u043B\u044B cookie", "\u043C\u044B \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u043C cookie", "\u043F\u0440\u0438\u043D\u044F\u0442\u044C \u0432\u0441\u0435", "\u0432\u0441\u0435 \u043F\u0440\u0430\u0432\u0430 \u0437\u0430\u0449\u0438\u0449\u0435\u043D\u044B", "\u043A\u043E\u043D\u0442\u0430\u043A\u0442\u044B", "\u043E \u043D\u0430\u0441", "\u043F\u043E\u0434\u0435\u043B\u0438\u0442\u044C\u0441\u044F", "\u0447\u0438\u0442\u0430\u0442\u044C \u0434\u0430\u043B\u0435\u0435", "\u043F\u043E\u0434\u0440\u043E\u0431\u043D\u0435\u0435", "\u043F\u043E\u0438\u0441\u043A", "\u043D\u0430\u0432\u0435\u0440\u0445", "\u0440\u0435\u043A\u043B\u0430\u043C\u0430", "\u043A\u0430\u0440\u0442\u0430 \u0441\u0430\u0439\u0442\u0430"],
    zh: ["\u8DF3\u81F3\u5185\u5BB9", "\u8DF3\u5230\u5185\u5BB9", "\u4E3B\u83DC\u5355", "\u4E3B\u9078\u55AE", "\u767B\u5F55", "\u767B\u5165", "\u767B\u51FA", "\u6CE8\u518C", "\u8A3B\u518A", "\u8BA2\u9605", "\u8A02\u95B1", "\u9690\u79C1\u653F\u7B56", "\u96B1\u79C1\u6B0A\u653F\u7B56", "\u4F7F\u7528\u6761\u6B3E", "\u4F7F\u7528\u689D\u6B3E", "\u670D\u52A1\u6761\u6B3E", "\u7248\u6743\u6240\u6709", "\u7248\u6B0A\u6240\u6709", "\u4FDD\u7559\u6240\u6709\u6743\u5229", "\u6211\u4EEC\u4F7F\u7528cookie", "\u63A5\u53D7\u6240\u6709", "\u8054\u7CFB\u6211\u4EEC", "\u806F\u7D61\u6211\u5011", "\u5173\u4E8E\u6211\u4EEC", "\u95DC\u65BC\u6211\u5011", "\u5206\u4EAB", "\u9605\u8BFB\u66F4\u591A", "\u95B1\u8B80\u66F4\u591A", "\u67E5\u770B\u66F4\u591A", "\u641C\u7D22", "\u641C\u5C0B", "\u8FD4\u56DE\u9876\u90E8", "\u5E7F\u544A", "\u5EE3\u544A", "\u7F51\u7AD9\u5730\u56FE", "\u4E86\u89E3\u66F4\u591A"],
    ja: ["\u30E1\u30A4\u30F3\u30B3\u30F3\u30C6\u30F3\u30C4\u3078\u30B9\u30AD\u30C3\u30D7", "\u672C\u6587\u3078\u79FB\u52D5", "\u30E1\u30A4\u30F3\u30E1\u30CB\u30E5\u30FC", "\u30ED\u30B0\u30A4\u30F3", "\u30ED\u30B0\u30A2\u30A6\u30C8", "\u65B0\u898F\u767B\u9332", "\u4F1A\u54E1\u767B\u9332", "\u8CFC\u8AAD", "\u30E1\u30EB\u30DE\u30AC", "\u30D7\u30E9\u30A4\u30D0\u30B7\u30FC\u30DD\u30EA\u30B7\u30FC", "\u5229\u7528\u898F\u7D04", "\u500B\u4EBA\u60C5\u5831", "\u30AF\u30C3\u30AD\u30FC", "cookie\u3092\u4F7F\u7528", "\u3059\u3079\u3066\u8A31\u53EF", "\u3059\u3079\u3066\u62D2\u5426", "\u7121\u65AD\u8EE2\u8F09", "\u8457\u4F5C\u6A29", "\u304A\u554F\u3044\u5408\u308F\u305B", "\u4F1A\u793E\u6982\u8981", "\u30D5\u30A9\u30ED\u30FC", "\u30B7\u30A7\u30A2", "\u3082\u3063\u3068\u898B\u308B", "\u7D9A\u304D\u3092\u8AAD\u3080", "\u691C\u7D22", "\u30DA\u30FC\u30B8\u30C8\u30C3\u30D7", "\u5E83\u544A", "\u30B5\u30A4\u30C8\u30DE\u30C3\u30D7", "\u8A73\u3057\u304F\u898B\u308B"],
    ko: ["\uBCF8\uBB38 \uBC14\uB85C\uAC00\uAE30", "\uC8FC \uBA54\uB274", "\uB85C\uADF8\uC778", "\uB85C\uADF8\uC544\uC6C3", "\uD68C\uC6D0\uAC00\uC785", "\uAD6C\uB3C5", "\uB274\uC2A4\uB808\uD130", "\uAC1C\uC778\uC815\uBCF4\uCC98\uB9AC\uBC29\uCE68", "\uC774\uC6A9\uC57D\uAD00", "\uCFE0\uD0A4", "\uBAA8\uB450 \uC218\uB77D", "\uBAA8\uB4E0 \uAD8C\uB9AC \uBCF4\uC720", "\uC800\uC791\uAD8C", "\uBB38\uC758\uD558\uAE30", "\uD68C\uC0AC \uC18C\uAC1C", "\uACF5\uC720", "\uB354 \uBCF4\uAE30", "\uAC80\uC0C9", "\uB9E8 \uC704\uB85C", "\uAD11\uACE0", "\uC0AC\uC774\uD2B8\uB9F5"],
    ar: ["\u0627\u0646\u062A\u0642\u0644 \u0625\u0644\u0649 \u0627\u0644\u0645\u062D\u062A\u0648\u0649", "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629", "\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644", "\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062E\u0631\u0648\u062C", "\u0625\u0646\u0634\u0627\u0621 \u062D\u0633\u0627\u0628", "\u0627\u0634\u062A\u0631\u0643", "\u0627\u0644\u0646\u0634\u0631\u0629 \u0627\u0644\u0625\u062E\u0628\u0627\u0631\u064A\u0629", "\u0633\u064A\u0627\u0633\u0629 \u0627\u0644\u062E\u0635\u0648\u0635\u064A\u0629", "\u0634\u0631\u0648\u0637 \u0627\u0644\u0627\u0633\u062A\u062E\u062F\u0627\u0645", "\u0645\u0644\u0641\u0627\u062A \u062A\u0639\u0631\u064A\u0641 \u0627\u0644\u0627\u0631\u062A\u0628\u0627\u0637", "\u0642\u0628\u0648\u0644 \u0627\u0644\u0643\u0644", "\u062C\u0645\u064A\u0639 \u0627\u0644\u062D\u0642\u0648\u0642 \u0645\u062D\u0641\u0648\u0638\u0629", "\u0627\u062A\u0635\u0644 \u0628\u0646\u0627", "\u0645\u0646 \u0646\u062D\u0646", "\u0634\u0627\u0631\u0643", "\u0627\u0642\u0631\u0623 \u0627\u0644\u0645\u0632\u064A\u062F", "\u0628\u062D\u062B", "\u0625\u0639\u0644\u0627\u0646", "\u062E\u0631\u064A\u0637\u0629 \u0627\u0644\u0645\u0648\u0642\u0639", "\u0645\u0646 \u0648\u064A\u0643\u064A\u0628\u064A\u062F\u064A\u0627\u060C \u0627\u0644\u0645\u0648\u0633\u0648\u0639\u0629 \u0627\u0644\u062D\u0631\u0629", "\u0647\u0630\u0647 \u0627\u0644\u0645\u0642\u0627\u0644\u0629 \u0639\u0646", "\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0639\u0646 \u0645\u0639\u0627\u0646", "\u0637\u0627\u0644\u0639"],
    hi: ["\u092E\u0941\u0916\u094D\u092F \u0938\u093E\u092E\u0917\u094D\u0930\u0940 \u092A\u0930 \u091C\u093E\u090F\u0902", "\u092E\u0941\u0916\u094D\u092F \u092E\u0947\u0928\u0942", "\u0932\u0949\u0917 \u0907\u0928", "\u0932\u0949\u0917 \u0906\u0909\u091F", "\u0938\u093E\u0907\u0928 \u0905\u092A", "\u0938\u0926\u0938\u094D\u092F\u0924\u093E \u0932\u0947\u0902", "\u0917\u094B\u092A\u0928\u0940\u092F\u0924\u093E \u0928\u0940\u0924\u093F", "\u0909\u092A\u092F\u094B\u0917 \u0915\u0940 \u0936\u0930\u094D\u0924\u0947\u0902", "\u0915\u0941\u0915\u0940\u091C\u093C", "\u0938\u092D\u0940 \u0905\u0927\u093F\u0915\u093E\u0930 \u0938\u0941\u0930\u0915\u094D\u0937\u093F\u0924", "\u0938\u0902\u092A\u0930\u094D\u0915 \u0915\u0930\u0947\u0902", "\u0939\u092E\u093E\u0930\u0947 \u092C\u093E\u0930\u0947 \u092E\u0947\u0902", "\u0938\u093E\u091D\u093E \u0915\u0930\u0947\u0902", "\u0914\u0930 \u092A\u0922\u093C\u0947\u0902", "\u0916\u094B\u091C\u0947\u0902", "\u0935\u093F\u091C\u094D\u091E\u093E\u092A\u0928"],
    tr: ["i\xE7eri\u011Fe atla", "ana men\xFC", "giri\u015F yap", "\xE7\u0131k\u0131\u015F yap", "kay\u0131t ol", "abone ol", "b\xFClten", "gizlilik politikas\u0131", "kullan\u0131m ko\u015Fullar\u0131", "\xE7erez", "t\xFCm\xFCn\xFC kabul et", "t\xFCm haklar\u0131 sakl\u0131d\u0131r", "bize ula\u015F\u0131n", "hakk\u0131m\u0131zda", "payla\u015F", "devam\u0131n\u0131 oku", "ara", "reklam", "site haritas\u0131"],
    pl: ["przejd\u017A do tre\u015Bci", "menu g\u0142\xF3wne", "zaloguj si\u0119", "wyloguj si\u0119", "zarejestruj si\u0119", "subskrybuj", "newsletter", "polityka prywatno\u015Bci", "regulamin", "pliki cookie", "akceptuj wszystkie", "wszelkie prawa zastrze\u017Cone", "kontakt", "o nas", "udost\u0119pnij", "czytaj wi\u0119cej", "szukaj", "reklama", "mapa serwisu"],
    id: ["langsung ke konten", "menu utama", "masuk", "keluar", "daftar", "berlangganan", "buletin", "kebijakan privasi", "syarat dan ketentuan", "kami menggunakan cookie", "terima semua", "hak cipta dilindungi", "hubungi kami", "tentang kami", "bagikan", "baca selengkapnya", "cari", "iklan", "peta situs"]
  });
  var STRONG = Object.freeze({
    en: ["affiliate commission", "affiliate links", "may earn a commission", "this post may contain", "thanks for supporting the site", "sign up to get", "receive regular emails", "other subscribers", "we do not endorse", "advertising on our site", "helps support our mission", "this feature is well established", "baseline widely available", "calendar notifications", "are updated with the completion", "thank you for your interest in"],
    es: ["enlaces de afiliado", "puede contener enlaces", "recibe correos regulares", "no respaldamos"],
    fr: ["liens d'affiliation", "peut contenir des liens", "nous n'approuvons pas"],
    de: ["affiliate-links", "kann werbelinks enthalten", "wir empfehlen keine"],
    pt: ["links de afiliados", "pode conter links", "n\xE3o endossamos"],
    it: ["link di affiliazione", "pu\xF2 contenere link", "non sosteniamo"]
  });
  var WALL = Object.freeze({
    en: [
      "access denied",
      "access issue",
      "403 forbidden",
      "402 payment",
      "complete the challenge",
      "complete the security challenge",
      "checking your connection",
      "challenge-platform",
      "cf-chl",
      "prove you are not a bot",
      "prove you're not a robot",
      "verifying you are human",
      "attention required",
      "pardon our interruption",
      "please enable cookies",
      "request blocked",
      "you have been blocked",
      "you've been blocked",
      "403 forbidden",
      "429 too many requests",
      "too many requests",
      "just a moment",
      "checking your browser",
      "checking if the site connection is secure",
      "verify you are human",
      "verify that you are human",
      "verify you're a human",
      "are you a robot",
      "are you a human",
      "robot or human",
      "unusual traffic",
      "attention required",
      "pardon our interruption",
      "enable javascript and cookies",
      "please enable cookies",
      "complete the security check",
      "temporarily blocked",
      "page not found",
      "this page doesn't exist",
      "this page does not exist",
      "page can't be found",
      "page cannot be found",
      "no longer available",
      "is no longer available",
      "has expired",
      "this listing has expired",
      "this job has expired",
      "this job is no longer",
      "position has been filled",
      "link has expired",
      "link is no longer",
      "member-only story",
      "member only story",
      "members only",
      "only available to members",
      "exclusive to members",
      "sign in to continue",
      "log in to continue",
      "log in to view",
      "sign in to view",
      "login required",
      "subscribe to continue",
      "subscribe to read",
      "subscribe to unlock",
      "subscribers only",
      "for subscribers",
      "subscription required",
      "create a free account to continue",
      "register to continue",
      "register to read",
      "you've reached your",
      "you have reached your",
      "read the full story",
      "this page will automatically refresh",
      "should be up and moving shortly",
      "hands full at the moment",
      "you are in line",
      "you're in line",
      "you are in the queue",
      "waiting room",
      "estimated wait",
      "your place in line",
      "we're experiencing high traffic",
      "service unavailable",
      "bad gateway",
      "internal server error",
      "access to this page has been denied",
      "accept cookies to continue"
    ],
    es: ["acceso denegado", "verifica que eres humano", "no soy un robot", "p\xE1gina no encontrada", "ya no est\xE1 disponible", "ha caducado", "inicia sesi\xF3n para continuar", "suscr\xEDbete para continuar", "solo para suscriptores", "tr\xE1fico inusual"],
    fr: ["acc\xE8s refus\xE9", "v\xE9rifiez que vous \xEAtes humain", "je ne suis pas un robot", "page introuvable", "n'est plus disponible", "a expir\xE9", "connectez-vous pour continuer", "abonnez-vous pour continuer", "r\xE9serv\xE9 aux abonn\xE9s", "trafic inhabituel"],
    de: ["zugriff verweigert", "best\xE4tigen sie, dass sie ein mensch sind", "ich bin kein roboter", "seite nicht gefunden", "nicht mehr verf\xFCgbar", "ist abgelaufen", "melden sie sich an, um fortzufahren", "nur f\xFCr abonnenten", "ungew\xF6hnlicher datenverkehr"],
    pt: ["acesso negado", "verifique que voc\xEA \xE9 humano", "n\xE3o sou um rob\xF4", "p\xE1gina n\xE3o encontrada", "n\xE3o est\xE1 mais dispon\xEDvel", "expirou", "entre para continuar", "somente para assinantes", "tr\xE1fego incomum"],
    it: ["accesso negato", "verifica di essere umano", "non sono un robot", "pagina non trovata", "non \xE8 pi\xF9 disponibile", "\xE8 scaduto", "accedi per continuare", "solo per abbonati", "traffico insolito"],
    nl: ["toegang geweigerd", "ik ben geen robot", "pagina niet gevonden", "niet meer beschikbaar", "is verlopen", "log in om door te gaan", "ongebruikelijk verkeer"],
    ru: ["\u0434\u043E\u0441\u0442\u0443\u043F \u0437\u0430\u043F\u0440\u0435\u0449\u0435\u043D", "\u0434\u043E\u0441\u0442\u0443\u043F \u0437\u0430\u043F\u0440\u0435\u0449\u0451\u043D", "\u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435, \u0447\u0442\u043E \u0432\u044B \u0447\u0435\u043B\u043E\u0432\u0435\u043A", "\u044F \u043D\u0435 \u0440\u043E\u0431\u043E\u0442", "\u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430", "\u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430", "\u0441\u0440\u043E\u043A \u0438\u0441\u0442\u0451\u043A", "\u0432\u043E\u0439\u0434\u0438\u0442\u0435, \u0447\u0442\u043E\u0431\u044B \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C", "\u043D\u0435\u043E\u0431\u044B\u0447\u043D\u044B\u0439 \u0442\u0440\u0430\u0444\u0438\u043A"],
    zh: ["\u8BBF\u95EE\u88AB\u62D2\u7EDD", "\u8A2A\u554F\u88AB\u62D2\u7D55", "\u8BF7\u9A8C\u8BC1\u60A8\u662F\u771F\u4EBA", "\u6211\u4E0D\u662F\u673A\u5668\u4EBA", "\u9875\u9762\u4E0D\u5B58\u5728", "\u627E\u4E0D\u5230\u9875\u9762", "\u5DF2\u4E0D\u53EF\u7528", "\u5DF2\u8FC7\u671F", "\u5DF2\u904E\u671F", "\u8BF7\u767B\u5F55\u540E\u7EE7\u7EED", "\u7570\u5E38\u6D41\u91CF", "\u5F02\u5E38\u6D41\u91CF"],
    ja: ["\u30A2\u30AF\u30BB\u30B9\u304C\u62D2\u5426", "\u30A2\u30AF\u30BB\u30B9\u3067\u304D\u307E\u305B\u3093", "\u30ED\u30DC\u30C3\u30C8\u3067\u306F\u3042\u308A\u307E\u305B\u3093", "\u30DA\u30FC\u30B8\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093", "\u63B2\u8F09\u306F\u7D42\u4E86", "\u6709\u52B9\u671F\u9650\u304C\u5207\u308C", "\u30ED\u30B0\u30A4\u30F3\u3057\u3066\u7D9A\u3051", "\u4F1A\u54E1\u9650\u5B9A", "\u7570\u5E38\u306A\u30C8\u30E9\u30D5\u30A3\u30C3\u30AF"],
    ko: ["\uC811\uADFC\uC774 \uAC70\uBD80", "\uB85C\uBD07\uC774 \uC544\uB2D9\uB2C8\uB2E4", "\uD398\uC774\uC9C0\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4", "\uB354 \uC774\uC0C1 \uC0AC\uC6A9\uD560 \uC218 \uC5C6", "\uB9CC\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4", "\uB85C\uADF8\uC778\uD558\uC5EC \uACC4\uC18D", "\uBE44\uC815\uC0C1\uC801\uC778 \uD2B8\uB798\uD53D"],
    ar: ["\u062A\u0645 \u0631\u0641\u0636 \u0627\u0644\u0648\u0635\u0648\u0644", "\u0644\u0633\u062A \u0631\u0648\u0628\u0648\u062A\u0627", "\u0627\u0644\u0635\u0641\u062D\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629", "\u0644\u0645 \u062A\u0639\u062F \u0645\u062A\u0627\u062D\u0629", "\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629", "\u0633\u062C\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0644\u0644\u0645\u062A\u0627\u0628\u0639\u0629", "\u062D\u0631\u0643\u0629 \u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0639\u0627\u062F\u064A\u0629"]
  });
  var WALL_WEAK = Object.freeze({
    en: ["captcha", "paywall", "security check", "unusual activity", "automated access", "automated requests", "bot detection", "queue-it", "ray id", "reference id", "incident id", "support id", "ddos protection", "not a robot"],
    es: ["captcha", "verificaci\xF3n de seguridad"],
    fr: ["captcha", "v\xE9rification de s\xE9curit\xE9"],
    de: ["captcha", "sicherheits\xFCberpr\xFCfung"],
    pt: ["captcha"],
    it: ["captcha"],
    nl: ["captcha"],
    ru: ["captcha", "\u043A\u0430\u043F\u0447\u0430"],
    zh: ["\u9A8C\u8BC1\u7801", "\u9A57\u8B49\u78BC"],
    ja: ["\u30AD\u30E3\u30D7\u30C1\u30E3", "\u8A8D\u8A3C\u30B3\u30FC\u30C9"],
    ko: ["\uCEA1\uCC28"],
    ar: ["\u0643\u0627\u0628\u062A\u0634\u0627"]
  });

  // ../khora-clone/vendor/the-fold/fold-chat-junk.js
  var JUNK = Object.freeze({
    DOMINATED: 0.5,
    LEAD_MIN: 3,
    LEAD_UNITS: 2,
    WINDOW: 40,
    STEP: 20,
    COVER: 0.4,
    STOPLESS_MIN: 12,
    FW_MAX: 0.1,
    CODE_SYMBOLS: 0.06,
    TITLE_SHARE: 0.6,
    // walls: a wall's own text is short; a long page that merely mentions a captcha in a footer is not a wall.
    WALL_SHORT: 2500,
    // chars of visible text under which any wall phrase makes the page a wall
    WALL_LEAD: 240,
    // chars of the opening text whose first unit is read for a wall notice
    WALL_LEAD_COVER: 0.4,
    WALL_NEAR: 600,
    // chars from the top of a short page within which a (non-weak) wall phrase is a notice, not a mention
    WALL_SHORT_COVER: 0.08,
    // a short page is a wall when the wall phrases cover this share of its letters (a passing mention of a captcha covers ~0.02)  // share of the title / first unit's letters the wall phrases must cover for it to be a notice
    WALL_PROSE_SHARE: 0.25,
    // ...and under this share of the page's text (a short page that is all prose is a short page, not a wall)
    WALL_PROSE: 400,
    // a page whose prose (non-chrome text) is under this many chars, and that is mostly chrome, shows nothing
    SENTENCE_MIN: 6,
    // a passage holds a unit of at least this many word tokens (a label or a date line is not a passage)
    SENTENCE_CJK: 12,
    // ...or, in an unspaced script, this many characters
    STRONG_MAX: 40,
    // a unit this short (word tokens) that holds one STRONG phrase is chrome
    HOLLOW_MIN: 30
    // a declared block with fewer than this many chars of VALUES (after labels) is a hollow template
  });
  var FW = new Set(Object.values(FUNCTION_WORDS).flat().map(fold));
  var CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
  var phrases = (lex) => [...new Set(Object.values(lex).flat().map(fold))].filter((p) => p.length >= 3 || p.length >= 2 && CJK.test(p)).sort((a, b) => b.length - a.length);
  var CHROME_P = phrases(CHROME);
  var STRONG_P = phrases(STRONG);
  var WALL_P = phrases(WALL);
  var WALL_ALL_P = phrases({ a: [...Object.values(WALL).flat(), ...Object.values(WALL_WEAK).flat()] });
  var ABBREV = /(?:^|[\s(])(?:mr|mrs|ms|dr|prof|sr|jr|st|vs|etc|no|nos|fig|figs|eq|inc|ltd|co|corp|mt|ave|gen|col|capt|lt|sgt|rev|vol|vols|pp|ca|approx|est|dept|univ|e\.g|i\.e|cf|al)\.$/iu;
  var endsWithAbbreviation = (t) => {
    const x = String(t ?? "").replace(/["')\]”’]+$/u, "");
    return ABBREV.test(x) || /(?:^|[\s(])(?:\p{Lu}\.){2,}$/u.test(x) || /(?:^|[\s(])\p{Lu}\.$/u.test(x);
  };

  // ../khora-clone/vendor/the-fold/fold-chat-impression.js
  var DECLARED3 = Object.freeze({
    // A line shorter than this many words is a heading, a label, a nav item — it
    // says nothing alone. Words are the SCRIPT's own segments, never characters.
    minWords: 5,
    // A run longer than this with no stop is a table or a wall, not a sentence.
    maxWords: 140,
    // Draws for the null band: enough to find the chance ceiling of a small field.
    nullDraws: 60,
    // A word in at least this share of the page's sentences tells them apart not
    // at all (it is the page's subject, or its grammar).
    commonShare: 0.5
  });
  function fingerprint(text) {
    let h = 2166136261;
    const s = String(text ?? "");
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  }
  function sentencesWithOffsets(text) {
    const src = String(text ?? "");
    const n = src.length, out = [];
    let start = 0, i = 0;
    const push = (a, b) => {
      let s = a, e = b;
      while (s < e && /\s/.test(src[s])) s++;
      while (e > s && /\s/.test(src[e - 1])) e--;
      if (e > s) out.push({ text: src.slice(s, e), start: s, end: e });
    };
    while (i < n) {
      const ch = src[i];
      if (ch === "\n") {
        push(start, i);
        start = ++i;
        continue;
      }
      if (ch === "\u3002" || ch === "\uFF01" || ch === "\uFF1F") {
        let j = i + 1;
        while (j < n && /[。！？]/.test(src[j])) j++;
        while (j < n && /["')\]”’」』]/.test(src[j])) j++;
        push(start, j);
        start = i = j;
        continue;
      }
      if (ch === "." || ch === "!" || ch === "?") {
        let j = i + 1;
        while (j < n && /[.!?]/.test(src[j])) j++;
        let k = j;
        while (k < n && /["')\]”’]/.test(src[k])) k++;
        if (k >= n || /\s/.test(src[k])) {
          const lone = ch === "." && j === i + 1;
          if (!(lone && endsWithAbbreviation(src.slice(start, j)))) {
            push(start, k);
            start = i = k;
            continue;
          }
        }
        i = j;
        continue;
      }
      i++;
    }
    push(start, n);
    return out;
  }
  var wordsOf = (s) => segments(s).map((x) => fold(x.text));
  var spaced = (s) => wordsOf(s).join(" ");
  var isFigure = (w) => /^\p{N}/u.test(w);
  function rngFrom(seed) {
    let a = parseInt(fingerprint(seed), 16) >>> 0;
    return () => {
      a = a + 1831565813 >>> 0;
      let t = a;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function impressionOf(text, question, { budget = 3e3, lead = true } = {}) {
    const src = String(text ?? "");
    const hash = fingerprint(src);
    const whole = () => ({ text: src, shadow: { chars: src.length, kept: src.length, hash, segments: src.length ? [{ start: 0, end: src.length }] : [], echo: echoOf(src) } });
    if (src.length <= budget) return whole();
    const headEnd = /^Recipe: /.test(src) ? src.indexOf("\n\n") : -1;
    if (headEnd > 0 && headEnd < budget) {
      const head = src.slice(0, headEnd);
      const shift = headEnd + 2;
      const tail = impressionOf(src.slice(shift), question, { budget: Math.max(0, budget - head.length - 1), lead: false });
      const segs = [{ start: 0, end: headEnd }, ...tail.shadow.segments.map((g) => ({ start: g.start + shift, end: g.end + shift }))];
      const out2 = tail.text ? head + "\n" + tail.text : head;
      return { text: out2, shadow: { chars: src.length, kept: head.length + tail.shadow.kept, hash, segments: segs, echo: echoOf(out2), band: tail.shadow.band, recalled: tail.shadow.recalled } };
    }
    const sents = sentencesWithOffsets(src).map((s) => ({ ...s, w: wordsOf(s.text) })).filter((s) => s.w.length >= DECLARED3.minWords && s.w.length <= DECLARED3.maxWords);
    if (!sents.length) return whole();
    const field = new Field({ spread: 0.25, steps: 1 });
    sents.forEach((s, i) => field.admit(s.w.join(" "), { i, start: s.start, end: s.end }, { tier: "shadow" }));
    const cueWords = wordsOf(question);
    const df = /* @__PURE__ */ new Map();
    for (const s of sents) for (const w of new Set(s.w)) df.set(w, (df.get(w) || 0) + 1);
    const tells = new Set(cueWords.filter((w) => (df.get(w) || 0) > 0 && (df.get(w) || 0) / sents.length < DECLARED3.commonShare));
    const kept = /* @__PURE__ */ new Set();
    let used = 0;
    const take = (i) => {
      kept.add(i);
      used += sents[i].text.length + 1;
    };
    if (lead) take(0);
    let band = { lo: 0, hi: 0 }, recalled = 0;
    if (tells.size && sents.length > 1) {
      const cue = [...tells];
      band = field.nullBand(cue.length, { draws: DECLARED3.nullDraws, rng: rngFrom(hash + "|" + cue.join(" ")) });
      const hits = field.recall(cue.join(" ")).filter((r) => r.activation > band.lo);
      recalled = hits.length;
      const covered = /* @__PURE__ */ new Set();
      const cover = (i) => {
        for (const w of sents[i].w) if (tells.has(w) || isFigure(w)) covered.add(w);
      };
      if (kept.has(0)) cover(0);
      for (const { node } of hits) {
        const i = node.payload.i;
        if (kept.has(i) || used + sents[i].text.length + 1 > budget) continue;
        const w = sents[i].w;
        const onAsk = w.some((x) => tells.has(x));
        const adds = w.some((x) => tells.has(x) && !covered.has(x)) || onAsk && w.some((x) => isFigure(x) && !covered.has(x));
        if (!adds) continue;
        take(i);
        cover(i);
      }
    }
    const idx = [...kept].sort((a, b) => a - b);
    const sel = idx.map((i) => sents[i]);
    const out = sel.map((s) => s.text).join("\n");
    return {
      text: out,
      shadow: { chars: src.length, kept: sel.reduce((n, s) => n + s.text.length, 0), hash, segments: sel.map((s) => ({ start: s.start, end: s.end })), echo: echoOf(out), band: { lo: +(band.lo || 0).toFixed(4), hi: +(band.hi || 0).toFixed(4) }, recalled }
    };
  }
  function echoOf(text) {
    return bytesToBase64(packSdr(sdrOf(spaced(text), { bits: ECHO_BITS }), { bits: ECHO_BITS }));
  }

  // ../khora-clone/vendor/the-fold/fold-chat-falsify-answer.js
  var FALSIFY = Object.freeze({ RUN: 4, STATE_OVERLAP: 0.5, STATE_MIN_SHARED: 3, ABOUT_OVERLAP: 0.4, SYNDICATED_RUN: 12, MAX_SENTS_PER_SOURCE: 400 });
  var HEDGE2 = "some many most several critics experts economists researchers scholars studies study analysts proponents supporters others claim claims claimed argue argues argued suggest suggests suggested say says said believe believes believed note notes noted report reports reported state states stated generally often widely broadly largely commonly usually typically considered seen viewed regarded thought known shown according overall also however although though while whereas indeed particularly especially notably".split(" ");
  var FW2 = /* @__PURE__ */ new Set([...FUNCTION_WORDS?.en || [], ..."the a an and or but of in to with by for on at from as is are was were be been being has have had it its this that these those which who what when where why how than then so also there their they he she we you i".split(" "), ...HEDGE2]);
  var fold2 = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  var words = (s) => fold2(s).match(/[\p{L}\p{N}]+/gu) || [];
  var contentStems = (s) => [...new Set(words(s).filter((w) => w.length > 2 && !FW2.has(w) && !/^\d+$/.test(w)).map((w) => stemOf(w)))];
  var NEG = /\b(?:not|no|never|neither|nor|none|without|cannot|n't|failed to|did not|does not|is not|was not)\b/i;
  var PNEG = /\b(?:refused?|denied|denies|rejected|rejects|declined|declines)\b/i;
  var VOID_NEG = /\bnot\s+(?:only|just|merely|simply)\b|\bno\s+(?:doubt|question)\b/i;
  var stripVoid = (s) => String(s ?? "").replace(VOID_NEG, " ");
  var neg = (s) => NEG.test(stripVoid(s)) || PNEG.test(String(s));
  var SKIP_GOV = /* @__PURE__ */ new Set(["only", "just", "merely", "simply", "even", "really", "certainly", "probably", "quite", "rather"]);
  var PRON = /* @__PURE__ */ new Set(["he", "she", "it", "they", "we", "you", "i", "this", "that", "these", "those", "there", "here", "who", "which"]);
  var tokClean = (x) => String(x ?? "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  function levCapped(a, b, cap = 1) {
    a = String(a);
    b = String(b);
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > cap) return cap + 1;
    let prev = [];
    for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let rowMin = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < rowMin) rowMin = cur[j];
      }
      if (rowMin > cap) return cap + 1;
      prev = cur;
    }
    return prev[b.length];
  }
  var GOV_CLOSED = new Set("the a an of in to with by for on at from as is are was were be been being has have had do does did will would could should shall may might must can it its this that these those which who whom whose and or but so than then too also there their they he she we you i my your his her our their my we our your an no not never neither nor none without cannot n't 's 'm 're 've 'll 'd s".split(" "));
  function governedPredicate(s) {
    const toks = String(s ?? "").toLowerCase().split(/[\s\-–—/]+/);
    for (let i = 0; i < toks.length; i++) {
      if (!NEG.test(toks[i]) && !PNEG.test(toks[i])) continue;
      for (const x of toks.slice(i + 1, i + 7)) {
        const t = tokClean(x);
        if (t.length <= 2 || GOV_CLOSED.has(t) || SKIP_GOV.has(t)) continue;
        return stemOf(t);
      }
    }
    return null;
  }
  function negSubject(text, upto) {
    const pre = String(text ?? "").slice(0, upto);
    const ns = namesIn(pre);
    const multi = ns.filter((n) => /\s/.test(n.trim()));
    if (multi.length) return { name: multi[multi.length - 1], pronoun: false };
    if (ns.length) return { name: ns[ns.length - 1], pronoun: false };
    const first = (String(text ?? "").trim().match(/^[\p{L}'-]+/u) || [""])[0];
    if (first && PRON.has(first.toLowerCase())) return { name: first, pronoun: true };
    return first ? { name: first, pronoun: false } : null;
  }
  function tokGap(text, a, b) {
    const toks = wordsLc(text);
    const ia = toks.findIndex((w) => fold2(w) === fold2(a) || fold2(a).includes(w) || w.includes(fold2(a)));
    const ib = toks.findIndex((w) => w === b || stemOf(w) === b || levCapped(w, b) <= 1);
    if (ia < 0 || ib < 0) return Infinity;
    return Math.abs(ia - ib);
  }
  function sameSubject(negName, negPronoun, otherText, aroundText, claimHead, predStem = "") {
    if (!negName) return true;
    if (negPronoun) {
      const hay = fold2(String(otherText ?? "") + " " + String(aroundText ?? ""));
      return !!claimHead && hay.includes(fold2(claimHead));
    }
    if (!subjectNamesMatch(negName, String(otherText ?? "").slice(0, 200))) return false;
    if (predStem && tokGap(otherText, negName.split(/\s+/).pop(), predStem) > 5) return false;
    return true;
  }
  function subjectNamesMatch(a, bText) {
    const x = fold2(a), y = fold2(bText);
    if (!x || !y) return false;
    if (x.includes(y) || y.includes(x)) return true;
    const mods = (s) => {
      const w = String(s).split(/[^a-zA-Z]+/).filter((t) => /^[A-Z]/.test(t) && t.length > 1 && !/^(?:the|a|an)$/i.test(t));
      return { head: w.length ? w[w.length - 1].toLowerCase() : "", mods: w.slice(0, -1).map((t) => t.toLowerCase()) };
    };
    const A = mods(a);
    if (!A.head) return false;
    const m = String(bText).match(new RegExp(`([A-Z][a-zA-Z'\u2019-]*\\s+){0,3}${A.head.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "iu"));
    if (!m) return false;
    const Bm = mods(m[0]);
    if (Bm.head !== A.head) return false;
    return !A.mods.some((m1) => Bm.mods.some((m2) => m1 !== m2 && !m1.includes(m2) && !m2.includes(m1)));
  }
  function negationFlips(negText, otherText, otherStems, aroundText = "", claimHead = "") {
    const t = stripVoid(negText);
    if (!NEG.test(t) && !PNEG.test(t)) return false;
    const p = governedPredicate(t);
    if (!p) return false;
    const hit = (k) => k === p || stemOf(k) === p || levCapped(k, p) <= 1;
    if (!otherStems.some(hit)) return false;
    const idx = String(t).toLowerCase().search(NEG.test(t) ? NEG : PNEG);
    const subj = negSubject(t, idx < 0 ? t.length : idx);
    if (!subj) return true;
    return sameSubject(subj.name, subj.pronoun, otherText, aroundText, claimHead, p);
  }
  var flipsPolarity = (claim, sent, cs, ss, around = "", cHead = "") => {
    const cn = neg(claim), sn = neg(sent);
    if (cn === sn) return false;
    return sn ? negationFlips(sent, claim, cs, around, cHead) : negationFlips(claim, sent, ss, around, cHead);
  };
  var domainOf = (u) => {
    try {
      return new URL(u).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  };
  var SENT = /(?<=[.!?。！？])\s+(?=[\p{Lu}\p{N}"“(])/u;
  var sentencesOf = (t) => String(t ?? "").replace(/\s+/g, " ").split(SENT).map((s) => s.trim()).filter((s) => s.length >= 12);
  function longestRun(claim, sent) {
    const a = words(claim), bRaw = String(sent).match(/[\p{L}\p{N}]+/gu) || [], b = bRaw.map(fold2);
    let best = 0, end = 0;
    const prev = new Array(b.length + 1).fill(0);
    for (let i = 1; i <= a.length; i++) {
      let diag = 0;
      for (let j = 1; j <= b.length; j++) {
        const tmp = prev[j];
        prev[j] = a[i - 1] === b[j - 1] ? diag + 1 : 0;
        if (prev[j] > best) {
          best = prev[j];
          end = j;
        }
        diag = tmp;
      }
    }
    return { n: best, text: best ? bRaw.slice(end - best, end).join(" ") : "" };
  }
  function isBound(sent, fig) {
    if (typeof fig?.start !== "number") return false;
    const before = String(sent).slice(Math.max(0, fig.start - 16), fig.start).toLowerCase().trimEnd();
    return /(?:than|over|above|under|below|beyond|exceeding|least|most)$/.test(before);
  }
  function figuresAgree(claimFigs, sent) {
    const sf = figuresIn(sent);
    const missing = claimFigs.filter((c) => !sf.some((w) => figureMatches(c, w)));
    const year = (f) => f.numeric && !f.unit && /^\d{4}$/.test(f.norm) && f.v >= 1e3 && f.v <= 2200;
    const clash = missing.map((c) => ({ c, w: sf.find((w) => !isBound(sent, w) && w.numeric && c.numeric && w.norm !== c.norm && (c.unit && w.unit && c.unit.dim === w.unit.dim || year(c) && year(w) || !c.unit && !w.unit && c.norm.endsWith("%") === w.norm.endsWith("%") && c.norm.endsWith("%"))) })).filter((x) => x.w);
    return { missing, clash };
  }
  function nearestVerb(text, offset) {
    const s = String(text ?? "");
    const bounds = [0];
    for (const m of s.matchAll(/[,;]|\b(?:but|and|while|though|whereas)\b/gu)) bounds.push(m.index, m.index + m[0].length);
    bounds.push(s.length + 1);
    let lo = 0, hi = s.length + 1;
    for (let i = 0; i < bounds.length; i += 2) {
      if (offset >= bounds[i] && offset < (bounds[i + 1] ?? s.length + 1)) {
        lo = bounds[i];
        hi = bounds[i + 1] ?? s.length + 1;
        break;
      }
    }
    let best = null, bd = Infinity;
    for (const m of s.toLowerCase().matchAll(/[\p{L}\p{N}]+/gu)) {
      if (m.index < lo || m.index >= hi) continue;
      if (/^\d+$/.test(m[0])) continue;
      const v = stemOf(m[0]);
      if (!v || v.length < 3 || BE_VERB.has(v) || !isVerbish(m[0])) continue;
      const d = Math.abs(m.index - offset);
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    return best;
  }
  var BE_VERB = /* @__PURE__ */ new Set(["am", "is", "are", "was", "were", "be", "been", "being"]);
  var STATIVE = /* @__PURE__ */ new Set(["stand", "stood", "sit", "sat", "lie", "lay", "lain", "exist", "existed", "has", "have", "had"]);
  var wordsLc = (s) => String(s ?? "").toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  var DET = /* @__PURE__ */ new Set(["the", "a", "an"]);
  var CLAUSE_CUT = /[,;]|\b(?:but|and|while|though|whereas)\b/;
  var cutPost = (toks) => toks.join(" ").split(CLAUSE_CUT).map((x) => x.trim()).filter(Boolean)[0] || "";
  function rolesOf(text, verbStem) {
    const toks = wordsLc(text);
    const raw = String(text ?? "").match(/[\p{L}\p{N}]+/gu) || [];
    const isNameToken = (i) => {
      const r = raw[i] || "";
      return /^\p{Lu}/u.test(r) && !/^[A-Z][a-z]?$/.test(r) && i > 0;
    };
    let vi = -1;
    for (let i = 0; i < toks.length; i++) {
      if (stemOf(toks[i]) !== verbStem) continue;
      if (isNameToken(i)) continue;
      if (i > 0 && DET.has(toks[i - 1])) continue;
      vi = i;
      break;
    }
    if (vi < 0) return null;
    const beBefore = toks.slice(Math.max(0, vi - 3), vi).some((w) => BE_VERB.has(w));
    const byAfter = toks.slice(vi + 1, vi + 7).includes("by");
    const pre = toks.slice(Math.max(0, vi - 6), vi).join(" ");
    const post = cutPost(toks.slice(vi + 1, vi + 7));
    if (beBefore && byAfter) {
      const bym = String(text).toLowerCase().match(/\bby\s+([a-z][\p{L}\p{N}'’.-]*(?:\s+[a-z][\p{L}\p{N}'’.-]*){0,3})/u);
      return { agent: bym ? bym[1] : "", patient: pre, passive: true };
    }
    return { agent: pre, patient: post, passive: false };
  }
  var phraseHas = (phrase, name) => {
    const p = fold2(phrase), n = fold2(name);
    if (!n || !p) return false;
    if (p.includes(n) || n.includes(p)) return true;
    const NUMW = /^(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twice|thrice|several|few|many|both)$/;
    const stems = (x) => new Set(words(x).filter((w) => w.length > 1 && !FW2.has(w) && !NUMW.test(w) && !/^\d+$/.test(w)).map((w) => stemOf(w)));
    const a = stems(p), b = stems(n);
    const within = (x, y) => x.size > 0 && [...x].every((k) => y.has(k));
    return within(a, b) || within(b, a);
  };
  var COUNTING = /^(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|dozen|several|many|few|both)$/i;
  var LIGHT_VERB = /* @__PURE__ */ new Set(["has", "have", "had", "do", "does", "did", "make", "made"]);
  function isVerbish(w) {
    const t = String(w ?? "").toLowerCase();
    if (t.length < 3 || LIGHT_VERB.has(t)) return LIGHT_VERB.has(t);
    if (/(?:ing|ed|es|s)$/.test(t) && t.length >= 4) return true;
    const g = stemOf(t);
    return g !== t && g !== t.replace(/e$/, "");
  }
  var rawWords = (s) => String(s ?? "").match(/[\p{L}\p{N}]+/gu) || [];
  function firstSharedVerb(claim, sent, cnames) {
    const inNames = (w) => (cnames || []).some((n) => fold2(n).split(/[^a-z0-9]+/i).includes(fold2(w)));
    const verbStemsOf = (text) => {
      const toks = String(text ?? "").match(/[\p{L}\p{N}]+/gu) || [];
      const out = /* @__PURE__ */ new Set();
      toks.forEach((raw, i) => {
        if (i > 0 && /^\p{Lu}/u.test(raw)) return;
        out.add(stemOf(raw.toLowerCase()));
      });
      return out;
    };
    const sgs = verbStemsOf(sent);
    const claimWords = rawWords(claim);
    for (let i = 0; i < claimWords.length; i++) {
      const raw = claimWords[i];
      if (/^\p{Lu}/u.test(raw)) continue;
      if (i > 0 && COUNTING.test(claimWords[i - 1])) continue;
      const w = raw.toLowerCase();
      if (w.length < 3 || inNames(w)) continue;
      const v = stemOf(w);
      if (!v || BE_VERB.has(v) || STATIVE.has(v)) continue;
      if (i > 0 && v === stemOf((claimWords[0] || "").toLowerCase())) continue;
      if (!isVerbish(w)) continue;
      if (sgs.has(v)) return v;
    }
    return null;
  }
  function roleConfusion(claim, sent, cnames) {
    if (neg(claim) || neg(sent)) return null;
    const verb = firstSharedVerb(claim, sent, cnames);
    if (!verb) return null;
    const noRoles = (text) => {
      const toks = rawWords(text).map((w) => w.toLowerCase());
      const at = toks.findIndex((w) => stemOf(w) === verb);
      const appositive = at >= 0 && String(text).toLowerCase().includes(", " + toks[at] + " ");
      return appositive || at > 0 && (BE_VERB.has(stemOf(toks[at - 1])) || toks[at + 1] === "as");
    };
    if (noRoles(claim) || noRoles(sent)) return null;
    const sharedName = (cnames || []).some((n) => {
      const nw = words(n).filter((w) => w.length > 1 && !FW2.has(w));
      const head = nw[nw.length - 1];
      return head && (fold2(sent).includes(head) || nw.every((w) => fold2(sent).includes(w)));
    });
    if (!sharedName) return null;
    const cr = rolesOf(claim, verb), sr = rolesOf(sent, verb);
    if (!cr || !sr) return null;
    const vacuous = (ph) => !String(ph ?? "").split(/[^a-z0-9]+/i).filter((w) => w.length > 1 && !FW2.has(w.toLowerCase())).length;
    const agentOk = vacuous(cr.agent) || vacuous(sr.agent) || !cr.agent || !sr.agent || phraseHas(cr.agent, sr.agent);
    const patientOk = vacuous(cr.patient) || vacuous(sr.patient) || !cr.patient || !sr.patient || phraseHas(cr.patient, sr.patient);
    if (!agentOk && !patientOk) return { confused: true, why: `reverses who did what to whom (${verb}): ${cr.agent.slice(0, 40)} / ${cr.patient.slice(0, 40)}` };
    if (!agentOk !== !patientOk) {
      const pair = !agentOk ? [cr.agent, sr.agent] : [cr.patient, sr.patient];
      const inNames = (ph, list) => (list || []).filter((n) => phraseHas(ph, n));
      const a = inNames(pair[0], cnames), b = inNames(pair[1], namesOf(sent));
      const headOf = (n) => {
        const w = words(n).filter((x) => x.length > 1 && !FW2.has(x));
        return w.length ? stemOf(w[w.length - 1]) : "";
      };
      const stacked = (x, y) => {
        const both = [String(claim), String(sent)].join(" ").split(/(?<=[.!?])\s+/);
        const fx = fold2(x), fy = fold2(y);
        return both.some((s) => {
          const ls = fold2(s), ix = ls.indexOf(fx), iy = ls.indexOf(fy);
          if (ix < 0 || iy < 0) return false;
          const lo = Math.min(ix, iy), hi = Math.max(ix, iy);
          const between = ls.slice(lo, hi);
          if (!/\b(?:in|near|of)\b/.test(between)) return false;
          return !between.split(/[^a-z0-9]+/i).filter((w) => w.length > 2).some(isVerbish);
        });
      };
      for (const x of a) for (const y of b) {
        if (headOf(x) && headOf(y) && headOf(x) !== headOf(y) && !stacked(x, y)) return { confused: true, why: `substitutes ${x.slice(0, 40)} for ${y.slice(0, 40)} (${verb})` };
      }
    }
    return null;
  }
  var TRACE = () => {
    try {
      return typeof process !== "undefined" && !!(process.env && process.env.FCFA_TRACE);
    } catch {
      return false;
    }
  };
  function headIsSame(name, nw, head, around) {
    if (nw.length < 2) return true;
    const raw = String(around).match(/[\p{L}\p{N}'’-]+/gu) || [];
    const at = raw.map((w, i) => fold2(w) === head ? i : -1).filter((i) => i >= 0);
    if (!at.length) return true;
    return at.some((i) => {
      const before = raw[i - 1];
      if (!before || !/^\p{Lu}/u.test(before) || FW2.has(fold2(before))) return true;
      return nw.some((w) => w === fold2(before));
    });
  }
  var SUBJECT_REACH = 3;
  function directionSwapped(claim, sent) {
    const sides = (text) => {
      const ws = [...String(text).toLowerCase().matchAll(/[\p{L}\p{N}]+/gu)].map((m) => m[0]);
      const at = ws.indexOf("into");
      if (at < 1 || at > ws.length - 2) return null;
      const stems = (list) => list.filter((w2) => w2.length > 2 && !FW2.has(w2)).map((w2) => stemOf(w2));
      return { left: stems(ws.slice(Math.max(0, at - 3), at)).slice(-2), right: stems(ws.slice(at + 1, at + 4)).slice(0, 2) };
    };
    const c = sides(claim), w = sides(sent);
    if (!c || !w || !c.left.length || !c.right.length) return false;
    const same = (x, y) => x.length === y.length && x.every((k) => y.includes(k));
    return same(c.left, w.right) && same(c.right, w.left) && !same(c.left, c.right);
  }
  function figuresSwapped(claim, sent, cfigs) {
    if ((cfigs || []).length < 2) return false;
    const sfigs = figuresIn(sent);
    const pairs = cfigs.map((c) => ({ c, w: sfigs.find((w) => figureMatches(c, w)) }));
    if (pairs.some((x) => !x.w) || new Set(pairs.map((x) => x.c.norm)).size < 2) return false;
    const shared = new Set(contentStems(claim).filter((k) => contentStems(sent).includes(k)));
    const toks = (text) => [...String(text).matchAll(/[\p{L}\p{N}]+/gu)].map((m) => ({ at: m.index, stem: /^\p{N}+$/u.test(m[0]) ? null : stemOf(fold2(m[0])) }));
    const anchorOf = (text, figStart) => {
      const ts = toks(text);
      const fi = ts.findIndex((t) => t.at >= figStart);
      if (fi < 0) return null;
      let best = null, bd = Infinity;
      ts.forEach((t, i) => {
        if (!t.stem || !shared.has(t.stem)) return;
        const d = Math.abs(i - fi) + (i > fi ? 0.5 : 0);
        if (d < bd) {
          bd = d;
          best = t.stem;
        }
      });
      return best;
    };
    const moved = pairs.filter((x) => {
      const a = anchorOf(claim, x.c.start), b = anchorOf(sent, x.w.start);
      return a && b && a !== b;
    });
    const anchors = new Set(pairs.map((x) => anchorOf(claim, x.c.start)).filter(Boolean));
    return moved.length >= 2 && anchors.size >= 2;
  }
  function judge(claim, cs, cfigs, cnames, sent, around, joined = false) {
    const ss = new Set(contentStems(sent));
    const shared = cs.filter((k) => ss.has(k));
    const overlap2 = cs.length ? shared.length / cs.length : 0;
    const run = longestRun(claim, sent);
    const { missing, clash } = figuresAgree(cfigs, sent);
    const hay = fold2(around);
    const namesMissing = cnames.filter((n) => {
      const nw = words(n).filter((w) => w.length > 1 && !FW2.has(w));
      if (!nw.length) return false;
      const head = nw[nw.length - 1];
      if (nw.every((w) => hay.includes(w))) return false;
      if (!hay.includes(head)) return true;
      return !headIsSame(n, nw, head, around);
    });
    let subjectMissing = false;
    if (cnames.length) {
      const subj = words(cnames[0]).filter((w) => w.length > 1 && !FW2.has(w));
      const head = subj[subj.length - 1];
      const openIdx = words(claim).indexOf(subj[0]);
      if (head && run.text && openIdx >= 0 && openIdx <= SUBJECT_REACH) {
        const stoks = words(sent);
        const hi = stoks.indexOf(head), ri = stoks.indexOf(fold2(run.text).split(" ")[0]);
        if (hi >= 0 && ri >= 0 && hi > ri + 2) subjectMissing = true;
      }
      if (subjectMissing) {
        const fc = (String(claim).trim().match(/^[\p{Lu}][\p{L}'-]+/u) || [""])[0];
        if (fc && fc.length > 1 && !/^[A-Z][a-z]?$/.test(fc)) {
          const stoks = words(sent);
          const fi = stoks.indexOf(fold2(fc)), ri = stoks.indexOf(fold2(run.text).split(" ")[0]);
          if (fi >= 0 && ri >= 0 && fi <= ri + 2) subjectMissing = false;
        }
      }
    }
    const cHead = (() => {
      const w = words(cnames[0] || "").filter((x) => x.length > 1 && !FW2.has(x));
      return w.length ? w[w.length - 1] : (String(claim).trim().match(/^[\p{L}'-]+/u) || [""])[0].toLowerCase();
    })();
    const scopedNeg = neg(sent) && !neg(claim) && figuresIn(sent).some((f) => f.numeric && !f.unit && /^\d{4}$/.test(f.norm) && f.v >= 1e3 && f.v <= 2200) && !cfigs.some((f) => /^\d{4}$/.test(f.norm));
    const polarity = clash.length || joined || scopedNeg ? true : !flipsPolarity(claim, sent, cs, [...ss], around, cHead);
    const about = overlap2 >= FALSIFY.ABOUT_OVERLAP && shared.length >= 1;
    const ordered = cs.length > 3 || !joined && (() => {
      const ssArr = contentStems(sent);
      let from = 0, prev = -1;
      for (const k of cs) {
        const i = ssArr.indexOf(k, from);
        if (i < 0 || prev >= 0 && i - prev > 3) return false;
        prev = i;
        from = i + 1;
      }
      return true;
    })();
    const close = run.n >= FALSIFY.RUN || overlap2 >= FALSIFY.STATE_OVERLAP && shared.length >= Math.min(FALSIFY.STATE_MIN_SHARED, cs.length) && ordered;
    const role = about && !joined ? roleConfusion(claim, sent, cnames) : null;
    if (TRACE()) console.error("DBG q=" + JSON.stringify(claim.slice(0, 40)) + " s=" + JSON.stringify(sent.slice(0, 50)) + " about=" + about + " pol=" + polarity + " ov=" + overlap2.toFixed(2) + " sh=" + shared.length + " role=" + JSON.stringify(role) + " clashN=" + clash.length);
    const pairVerb = about ? firstSharedVerb(claim, sent, cnames) : null;
    const aboutSubject = !cnames.length || (() => {
      const opener = fold2((String(claim).trim().match(/^[\p{Lu}][\p{L}'-]+/u) || [""])[0]);
      const sw = opener.length > 2 && !FW2.has(opener) ? [opener] : words(cnames[0]).filter((w) => w.length > 1 && !FW2.has(w));
      return !sw.length || sw.some((w) => fold2(sent).includes(w));
    })();
    const clashHere = !joined && aboutSubject && neg(claim) === neg(sent) ? clash.filter((x) => pairVerb && nearestVerb(claim, x.c.start) === pairVerb) : [];
    if (TRACE() && clash.length) console.error("DBGCL3 pv=" + pairVerb + " nv=" + JSON.stringify(clash.map((x) => [x.c.raw, nearestVerb(claim, x.c.start)])) + " joined=" + joined);
    let verdict = "silent", why = "", kind = null;
    if (TRACE() && about) console.error("DBG role=" + JSON.stringify(role) + " clashN=" + clash.length + " clashHere=" + clashHere.length);
    if (about && !polarity) {
      verdict = "contradicts";
      kind = "polarity";
      why = "same subject, opposite polarity";
    } else if (about && !joined && directionSwapped(claim, sent)) {
      verdict = "contradicts";
      kind = "direction";
      why = "runs the other way (into)";
    } else if (about && !joined && figuresSwapped(claim, sent, cfigs)) {
      verdict = "contradicts";
      kind = "pairing";
      why = "gives the figures to the other names";
    } else if (role && role.confused) {
      verdict = "contradicts";
      kind = "role";
      why = role.why;
    } else if (about && clashHere.length) {
      verdict = "contradicts";
      kind = "figure";
      why = `gives ${clashHere[0].w.raw} where the claim says ${clashHere[0].c.raw}`;
    } else if (close && !missing.length && !namesMissing.length && !subjectMissing) {
      verdict = "states";
      why = run.n >= FALSIFY.RUN ? `shares the run \u201C${run.text}\u201D` : `${shared.length} of ${cs.length} content words`;
    } else if (close) {
      verdict = "near";
      why = subjectMissing ? `the claim's subject ${cnames[0]} is only the source's object` : missing.length ? `the figure ${missing[0].raw} is not in it` : `the name ${namesMissing[0]} is not near it`;
    }
    return { verdict, why, kind, overlap: overlap2, shared: shared.length, runN: run.n, run: run.text, score: run.n * 2 + shared.length + (verdict === "states" ? 100 : verdict === "contradicts" ? 50 : 0) };
  }
  function sourcesOf(passages) {
    const by = /* @__PURE__ */ new Map();
    for (const p of passages || []) {
      const text = String(p?.text ?? [p?.before, p?.mark, p?.after].filter(Boolean).join(" "));
      if (!text.trim()) continue;
      const url = p.url || p.source || "";
      const key = domainOf(url) || p.ref || url || "source";
      if (!by.has(key)) by.set(key, { key, domain: domainOf(url), url, ref: p.ref || p.label || key, texts: [] });
      const s = by.get(key);
      if (!s.texts.some((t) => t === text || t.includes(text) || text.includes(t))) s.texts.push(text);
    }
    return [...by.values()].map((s) => ({ ...s, sents: s.texts.flatMap(sentencesOf).slice(0, FALSIFY.MAX_SENTS_PER_SOURCE) }));
  }
  function bestIn(src, claim, cs, cfigs, cnames) {
    let best = null, contraAlt = null;
    const consider = (sent, i, around, joined = false) => {
      const j = judge(claim, cs, cfigs, cnames, sent, around, joined);
      const w = { ...j, sentence: sent, i };
      if (!best || j.score > best.score) best = w;
      if (j.verdict === "contradicts" && (!contraAlt || j.score > contraAlt.score)) contraAlt = { ...w, src: src.key };
    };
    src.sents.forEach((sent, i) => {
      const around = [src.sents[i - 1], sent, src.sents[i + 1]].filter(Boolean).join(" ");
      consider(sent, i, around, false);
      const nx = src.sents[i + 1];
      if (nx && sent.length + nx.length < 520) consider(sent + " " + nx, i, around + " " + (src.sents[i + 2] || ""), true);
    });
    const out = best || { verdict: "silent", why: "nothing read from it", score: 0, sentence: "", overlap: 0, shared: 0, runN: 0, run: "" };
    if (contraAlt && contraAlt !== best) out.contraAlt = contraAlt;
    return out;
  }
  var CALENDAR = /^(?:January|February|March|April|May|June|July|August|September|October|November|December|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/;
  function namesOf(s) {
    const first = (String(s).trim().match(/^[\p{L}'-]+/u) || [""])[0];
    return namesIn(s).map((n) => n.replace(/^(?:In|On|At|By|From|Since|During|After|Before|The)\s+/u, "").replace(/['’]s$/u, "")).filter((n) => n && !CALENDAR.test(n) && !(n === first && !/\s/.test(n) && !/^\p{Lu}{2,}$/u.test(n)));
  }
  function swapTest(claim, cfigs, cnames, src, witness) {
    const allFigs = src.sents.flatMap((s) => figuresIn(s));
    const inClaimFigs = figuresIn(claim);
    for (const c of cfigs) {
      const comp = allFigs.find((w) => w.norm !== c.norm && !figureMatches(c, w) && !inClaimFigs.some((k) => k.norm === w.norm || figureMatches(k, w)) && (c.unit && w.unit && c.unit.dim === w.unit.dim || !c.unit && !w.unit && c.norm.length === w.norm.length));
      if (!comp) continue;
      const swapped = claim.replace(c.raw, comp.raw);
      const core = sentencesOf(witness.sentence).find((x) => figuresIn(x).some((w) => figureMatches(c, w))) || witness.sentence;
      const j = judge(swapped, contentStems(swapped), figuresIn(swapped), cnames, core, core);
      return { armed: true, kind: "figure", from: c.raw, to: comp.raw, discriminates: j.verdict !== "states" };
    }
    const capSeq = /(?<![\p{L}])\p{Lu}[\p{L}\p{N}'’-]+(?:\s+\p{Lu}[\p{L}\p{N}'’-]+)*/gu;
    const inClaim = new Set(words(claim));
    for (const n of cnames) {
      const multi = /\s/.test(n.trim());
      const pool = /* @__PURE__ */ new Set();
      const stating = String(witness?.sentence || "");
      const sameSent = (s) => !!stating && (stating.includes(s) || s.includes(stating));
      const alongside = (s, t) => {
        const a = s.indexOf(n), b = s.indexOf(t);
        if (a < 0 || b < 0) return false;
        const lo = a < b ? a + n.length : b + t.length, hi = a < b ? b : a;
        return /^\s*(?:,|and|or|&|with|,\s*and|and\s+also)\s*$/i.test(s.slice(lo, hi));
      };
      for (const s of src.sents) for (const m of s.matchAll(capSeq)) {
        const t = m[0].replace(/['’]s$/u, ""), before = s.slice(Math.max(0, m.index - 4), m.index).toLowerCase();
        if (m.index === 0 && !/\s/.test(t)) continue;
        if (/\b(?:a|an|the)\s$/.test(before)) continue;
        if (/\s/.test(t) !== multi) continue;
        if (stating.includes(t) && !alongside(stating, t)) continue;
        pool.add(t);
      }
      const comp = [...pool].find((x) => !inClaim.has(fold2(x)) && !words(x).some((w) => inClaim.has(w)) && !FW2.has(fold2(x)) && !CALENDAR.test(x));
      if (!comp) continue;
      const swapped = claim.replace(n, comp);
      const j = judge(swapped, contentStems(swapped), figuresIn(swapped), namesOf(swapped), witness.sentence, witness.sentence);
      return { armed: true, kind: "name", from: n, to: comp, discriminates: j.verdict !== "states" };
    }
    return { armed: false };
  }
  function clausesOf(s) {
    const text = String(s).trim();
    const parts = text.split(/\s*;\s*|\s+(?:but|whereas)\s+|\s+and\s+(?=\S+(?:\s+\S+){3,})/u).map((x) => x.trim()).filter((x) => x.length >= 12);
    return parts.length >= 2 ? parts : [text];
  }
  function withoutSourceTag(text) {
    const t = String(text ?? "").trim();
    let end = t.length;
    while (end > 0 && `.!?;:"\u201D\u2019' `.includes(t[end - 1]) && t[end - 1] !== ")") end--;
    if (t[end - 1] !== ")") return t;
    let depth = 0, open = -1;
    for (let i = end - 1; i >= 0; i--) {
      if (t[i] === ")") depth++;
      else if (t[i] === "(") {
        depth--;
        if (depth === 0) {
          open = i;
          break;
        }
      }
    }
    if (open <= 0) return t;
    const group = t.slice(open, end);
    const isTag = group.includes("](") || group.includes("http") || group.includes("\u201C") || group.includes('"') || group.includes("\xAB");
    if (!isTag) return t;
    const body = t.slice(0, open).trimEnd();
    return /[.!?]$/.test(body) || !/[.!?]$/.test(t) ? body : body + t.slice(-1);
  }
  function normalizeForms(text) {
    const t = String(text ?? "").normalize("NFKC");
    return t.includes("<su") ? t.replace(/<\/?su[bp]>/gi, "") : t;
  }
  function falsifyAnswer(sentences, passages) {
    const sources = sourcesOf((passages || []).map((p) => p && typeof p === "object" && typeof p.text === "string" ? { ...p, text: normalizeForms(p.text) } : p));
    const claims = (sentences || []).map((raw, i) => {
      const shown = String(raw ?? "").trim();
      const s = withoutSourceTag(normalizeForms(shown));
      const cs = contentStems(s), cfigs = figuresIn(s), cnames = namesOf(s);
      const per = sources.map((src) => {
        const b = bestIn(src, s, cs, cfigs, cnames);
        if (b.verdict !== "states") {
          const cl = clausesOf(s);
          if (cl.length > 1) {
            const each = cl.map((c) => bestIn(src, c, contentStems(c), figuresIn(c), namesOf(c)));
            if (each.every((x) => x.verdict === "states")) return { src: src.key, ...b, verdict: "states", why: "every clause is stated", clauseSupport: true };
          }
        }
        return { src: src.key, ...b };
      });
      const states = per.filter((w) => w.verdict === "states");
      const chains = [];
      for (const w of states) {
        const c = chains.find((ch) => longestRun(ch[0].sentence, w.sentence).n >= FALSIFY.SYNDICATED_RUN);
        if (c) {
          c.push(w);
          w.sameChainAs = c[0].src;
        } else chains.push([w]);
      }
      const contra = per.filter((w) => w.verdict === "contradicts" && !(w.kind === "role" && states.length));
      const stated = states.some((w) => words(w.sentence).join(" ").includes(words(s).join(" ")));
      const contraBuried = stated ? [] : per.filter((w) => w.verdict !== "contradicts" && w.contraAlt && !(w.contraAlt.kind === "role" && states.length));
      const lead = states[0] ? sources.find((x) => x.key === states[0].src) : null;
      const swap = lead && !states[0].clauseSupport ? swapTest(s, cfigs, cnames, lead, states[0]) : { armed: false };
      let verdict;
      if (!cs.length && !cfigs.length) verdict = "n/a";
      else if (contra.length || contraBuried.length) verdict = "contested";
      else if (states.length && swap.armed && !swap.discriminates) verdict = "weak";
      else if (chains.length >= 2) verdict = "corroborated";
      else if (chains.length === 1) verdict = "held";
      else if (per.some((w) => w.verdict === "near")) verdict = "weak";
      else verdict = "unsupported";
      return { i, s: shown, figures: cfigs.map((f) => f.raw), names: cnames, witnesses: per, chains: chains.length, contradictions: contra.length, swap, verdict };
    });
    const count = (v) => claims.filter((c) => c.verdict === v).length;
    const scored = claims.filter((c) => c.verdict !== "n/a");
    return {
      sources: sources.map((s) => ({ key: s.key, domain: s.domain, url: s.url, ref: s.ref, sentences: s.sents.length })),
      claims,
      summary: {
        claims: scored.length,
        corroborated: count("corroborated"),
        held: count("held"),
        weak: count("weak"),
        contested: count("contested"),
        unsupported: count("unsupported"),
        backed: count("corroborated") + count("held"),
        swapsArmed: claims.filter((c) => c.swap.armed).length,
        swapsFailed: claims.filter((c) => c.swap.armed && !c.swap.discriminates).length,
        cleared: scored.length > 0 && scored.every((c) => c.verdict === "corroborated" || c.verdict === "held")
      }
    };
  }
  var FAILING = /* @__PURE__ */ new Set(["unsupported", "contested", "weak"]);
  var claimSentences = (text) => sentencesOf(text);
  function reImpress(claim, pages, { budget = 1400 } = {}) {
    const out = [];
    for (const pg of pages || []) {
      const page = String(pg?.text ?? pg?.page ?? "");
      if (page.length < 200) continue;
      let e;
      try {
        e = impressionOf(page, claim, { budget, lead: false });
      } catch {
        continue;
      }
      if (!e || !e.text || !e.shadow || !(e.shadow.recalled > 0) || e.shadow.kept >= page.length) continue;
      const had = new Set((pg.shadow?.segments || []).map((g) => g.start + ":" + g.end));
      const fresh = (e.shadow.segments || []).filter((g) => !had.has(g.start + ":" + g.end));
      if (!fresh.length) continue;
      out.push({ ref: pg.ref, url: pg.url, source: pg.url, text: e.text, via: "re-impression", shadow: e.shadow, forClaim: claim.slice(0, 160) });
    }
    return out;
  }
  function claimQuery(s) {
    const toks = String(s ?? "").match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu) || [];
    return toks.filter((w) => !FW2.has(fold2(w)) && w.length > 1).slice(0, 10).join(" ");
  }
  function routeOf(c) {
    const why = c.verdict === "contested" ? "a source contradicts it \u2014 two cannot settle it, so a third, independent source" : c.verdict === "weak" ? c.swap?.armed && !c.swap.discriminates ? `the evidence does not tell \u201C${c.swap.from}\u201D from \u201C${c.swap.to}\u201D \u2014 a sharper sentence` : "close, but a figure or name is missing \u2014 a sentence that states all of it" : "no kept passage states it \u2014 look in the whole pages, then search with the claim itself";
    return { op: "INS", why, query: claimQuery(c.s) };
  }
  function pickPassages(claim, passages, n = 4) {
    const cs = new Set(contentStems(claim));
    return (passages || []).map((p) => ({ p, k: contentStems(p.text).filter((x) => cs.has(x)).length })).filter((x) => x.k >= 2).sort((a, b) => b.k - a.k).slice(0, n).map((x) => ({ ref: x.p.ref, url: x.p.url || x.p.source, text: String(x.p.text || "").slice(0, 1500) }));
  }
  function restateClaimMessages(sentence, passages) {
    return [
      { role: "system", content: "You restate one sentence so that the passages below state it. Use only what the passages say; keep every figure and name a passage gives exactly as written. Reply with the one sentence only, in the same language as the sentence. If the passages support no version of it, reply exactly: NONE" },
      { role: "user", content: passages.map((p, i) => `[${i + 1}] ${p.text}`).join("\n\n") + `

Sentence: ${sentence}` }
    ];
  }
  function replaceSentence(text, from, to) {
    const esc = String(from).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    const re = new RegExp(esc);
    return re.test(text) ? String(text).replace(re, () => to) : text;
  }
  function passagesOfRecord(rec) {
    const out = [];
    for (const p of rec?.passages || []) if (p && p.text) out.push({ text: p.text, url: p.url || p.source, ref: p.ref });
    for (const e of rec?.tape || []) if (e && e.kind === "quick" && e.p) out.push({ text: e.p.text, url: e.p.url, ref: e.p.ref });
    for (const s of rec?.facing?.sources || []) out.push({ before: s.before, mark: s.mark, after: s.after, url: s.url, ref: s.ref || s.label });
    for (const m of rec?.material || []) if (m && m.text) out.push({ text: m.text, url: m.url || m.source, ref: m.ref });
    return out;
  }
  return __toCommonJS(fold_chat_falsify_answer_exports);
})();
