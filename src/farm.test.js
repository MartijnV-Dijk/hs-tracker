import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dropLookup, farmPlaces, oneIn } from './farm.js';

const lookup = dropLookup({
  rate: { 'crackling thunder': 400_000, "ra's band": 90_000, 'chaoswalkers': 300_000, 'majorie’s belt': 50_000 },
  chase: { 'crackling thunder': 20_000, "ra's band": 10_000, 'chaoswalkers': 40_000 },
  places: { 'crackling thunder': ['Act IX Zone 4-5', 'Golden Chest'], "ra's band": ['Act IX Zone 4-5'], 'chaoswalkers': ['Golden Chest'] },
});

test('odds read the way the Items page writes them', () => {
  assert.equal(oneIn(850), '1/850');
  assert.equal(oneIn(157_718), '1/158k');
  assert.equal(oneIn(2_400_000), '1/2.4M');
});

test('names meet the drop tables whatever their punctuation', () => {
  assert.equal(lookup("Majorie's Belt").anywhere, 50_000);
  assert.equal(lookup('Not An Item'), null);
});

test('a place shared by several upgrades ranks above one that holds a single one', () => {
  const { places } = farmPlaces(['Crackling Thunder', "Ra's Band", 'Chaoswalkers'], lookup);
  assert.deepEqual(places.map((p) => p.place), ['Act IX Zone 4-5', 'Golden Chest']);
  assert.deepEqual(places[0].items, ['Crackling Thunder', "Ra's Band"]);
  assert.equal(places[0].chance, 1 / 20_000 + 1 / 10_000);
});

test('untied and unknown items are set apart, and a name counts once', () => {
  const result = farmPlaces(["Majorie's Belt", 'Mystery', "Majorie's Belt"], lookup);
  assert.deepEqual(result.places, []);
  assert.deepEqual(result.anywhere, [{ name: "Majorie's Belt", rate: 50_000 }]);
  assert.deepEqual(result.unknown, ['Mystery']);
});
