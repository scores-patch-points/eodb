// bundle-falsify.mjs — bundle the fold's real falsifier (vendor/the-fold/fold-chat-falsify-answer.js) for the browser.
// The language priors (8MB, treebank/Zenodotus-derived) are stubbed out: they load live, not bundled.
// English-only for now; wire Zenodotus priors back in at runtime later.
import esbuild from 'esbuild';
import path from 'node:path';
import fs from 'node:fs';

const KHORA = '/Users/mlacy/Downloads/workspace/khora-clone/vendor/the-fold';
const OUT = path.join(process.cwd(), 'app/vendor/falsify.js');
const TMP = '/tmp/scratchpad/falsify-stub';

fs.mkdirSync(TMP, { recursive: true });
// English-only language stub (full detection needs the 8MB priors)
fs.writeFileSync(path.join(TMP, 'lang-stub.js'), `export const DECLARED=Object.freeze({minReplyLetters:24,threadTurns:6});export const LANG_NAMES={en:'English'};export const FAMILIES=[];export const sameFamily=(a,b)=>a===b;export function proseOf(t){return String(t??'')}export function threadLanguage(){return 'en'}export function detectLang(){return {lang:'en',script:'Latin',hits:1,name:'English',confident:true,inherited:false,margin:0}}export function sameLanguage(){return {same:true}}export function languageInstruction(){return 'Reply in English.'}export function restateMessages(){return []}export function languageNotice(){return null}`);
// empty priors stubs (anything else that imports big data)
fs.writeFileSync(path.join(TMP, 'empty.js'), `export default {};`);

await esbuild.build({
  entryPoints: [path.join(KHORA, 'fold-chat-falsify-answer.js')],
  bundle: true,
  format: 'iife',
  globalName: 'Falsify',
  outfile: OUT,
  plugins: [{
    name: 'stub-priors',
    setup(build) {
      build.onResolve({ filter: /fold-chat-lang(?:id)?\.js$/ }, () => ({ path: path.join(TMP, 'lang-stub.js') }));
      build.onResolve({ filter: /(lang-priors|salience-prior|lemmas|creole-priors)\.js$/ }, () => ({ path: path.join(TMP, 'empty.js') }));
    },
  }],
});
console.log('bundled ->', OUT, fs.statSync(OUT).size, 'bytes');
