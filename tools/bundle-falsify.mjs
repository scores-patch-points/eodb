// bundle-falsify.mjs — bundle the fold's real falsifier (vendor/the-fold/fold-chat-falsify-answer.js) for the browser,
// WITH the real Zenodotus/treebank language priors inlined, so language detection is multilingual (not the English-only stub).
// The priors are ~10 MB (40 languages from Universal Dependencies gold treebanks + UDHR + salience + lemmas); they load once
// and are browser-cached. To serve them lazily instead, split this into a small bundle + a fetched priors module.
import esbuild from 'esbuild';
import path from 'node:path';
import fs from 'node:fs';

const KHORA = '/Users/mlacy/Downloads/workspace/khora-clone/vendor/the-fold';
const OUT = path.join(process.cwd(), 'app/vendor/falsify.js');

await esbuild.build({
  entryPoints: [path.join(KHORA, 'fold-chat-falsify-answer.js')],
  bundle: true,
  format: 'iife',
  globalName: 'Falsify',
  outfile: OUT,
  legalComments: 'none',
});
console.log('bundled ->', OUT, fs.statSync(OUT).size, 'bytes');
