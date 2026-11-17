import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvDelimiter, localStamp, toCsv } from './runscsv.js';

test('a region that writes a decimal comma gets semicolons', () => {
  assert.equal(csvDelimiter('nl-NL'), ';');
  assert.equal(csvDelimiter('de-DE'), ';');
  assert.equal(csvDelimiter('en-US'), ',');
});

test('a run start reads as a local date and minute', () => {
  const ms = new Date(2026, 10, 7, 9, 5).getTime();
  assert.equal(localStamp(ms), '2026-11-07 09:05');
});

test('rows join with the delimiter and open with a byte order mark', () => {
  const csv = toCsv(['gold', 'kills'], [[1200, 30], [0, null]], ';');
  assert.equal(csv, '﻿gold;kills\r\n1200;30\r\n0;\r\n');
});

test('a cell holding the delimiter, a quote or a line break is quoted', () => {
  const csv = toCsv(['name'], [['Ragnar, the Bold'], ['say "hi"'], ['two\nlines']], ',');
  assert.equal(csv, '﻿name\r\n"Ragnar, the Bold"\r\n"say ""hi"""\r\n"two\nlines"\r\n');
});
