import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itemLines, matchItemNames, nameKey } from './itemlist.js';

const KNOWN = ["Azazel's Despair", 'Leviathan´s Spine', 'Shrunken Head', 'Angelic Key'];

test('a name matches whatever its case, accents and punctuation', () => {
  assert.equal(nameKey("AZAZEL'S DESPAIR"), nameKey('azazels despair'));
  assert.equal(nameKey('Leviathan’s Spine'), nameKey('Leviathan´s Spine'));
  assert.equal(nameKey('Sahköpuimuri'), nameKey('Sahkopuimuri'));
});

test('bullets, counts, blank lines and comments are not part of a name', () => {
  const text = '# my hunt\n- Azazel\'s Despair\r\n\n2x Angelic Key\n3. Shrunken Head\n// later\n  • Leviathan´s Spine  ';
  assert.deepEqual(itemLines(text), ["Azazel's Despair", 'Angelic Key', 'Shrunken Head', 'Leviathan´s Spine']);
});

test('known names come back spelled as the tables spell them, once each', () => {
  const { found, unknown } = matchItemNames('azazels despair\nANGELIC KEY\nAzazel’s Despair\n', KNOWN);
  assert.deepEqual(found, ["Azazel's Despair", 'Angelic Key']);
  assert.deepEqual(unknown, []);
});

test('lines that match nothing are reported, not dropped silently', () => {
  const { found, unknown } = matchItemNames('Shrunken Head\nShrunken Hed\nShrunken Hed', KNOWN);
  assert.deepEqual(found, ['Shrunken Head']);
  assert.deepEqual(unknown, ['Shrunken Hed']);
});
