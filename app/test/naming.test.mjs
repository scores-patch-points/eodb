import { test } from 'node:test';
import assert from 'node:assert';
import { colorFor, parseName, makeName, NAME_RE } from '../naming.mjs';

const WORDS = ['spacingGuild', 'kwisatzHaderach', 'noShip', 'stillsuit', 'fremen', 'shaiHulud'];
const color6 = /^[0-9A-F]{6}$/;

test('a made name matches the word_HEXCODE contract', () => {
  for (let i = 0; i < 50; i++) {
    const n = makeName(WORDS);
    assert.match(n, NAME_RE, `bad name: ${n}`);
    const word = n.slice(0, n.lastIndexOf('_'));
    assert.ok(WORDS.includes(word));
    assert.match(n.slice(n.lastIndexOf('_') + 1), color6);
  }
});

test('colours are assigned at random, not fixed to the word', () => {
  // the same word must appear under many different colours: word × 24-bit colour is the near-infinite space
  const colors = new Set();
  for (let i = 0; i < 2000; i++) {
    const n = makeName(WORDS);
    if (n.startsWith('spacingGuild_')) colors.add(n.slice('spacingGuild_'.length));
  }
  assert.ok(colors.size > 50, `only ${colors.size} colours seen for one word`);
});

test('makeName avoids names already taken', () => {
  const taken = new Set(['spacingGuild_000001', 'fremen_000002']);
  for (let i = 0; i < 100; i++) assert.ok(!taken.has(makeName(WORDS, taken)));
});

test('parseName splits on the last underscore', () => {
  const { word, color } = parseName('spacingGuild_29FC31');
  assert.equal(word, 'spacingGuild');
  assert.equal(color, '#29FC31');
});

test('an empty lexicon falls back to a valid name, never throws', () => {
  assert.match(makeName([]), NAME_RE);
});
