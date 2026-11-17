import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heroXpRequired, levelForecast, levelProgress } from './heroxp.js';

test('an anchor level needs exactly its anchor', () => {
  assert.equal(heroXpRequired(0), 3_208_120);
  assert.equal(heroXpRequired(10), 4_123_490);
  assert.equal(heroXpRequired(149), 177_327_360);
});

test('a level between anchors sits on the straight line between them', () => {
  assert.equal(heroXpRequired(37), Math.round((8_196_982 + 8_734_805) / 2));
});

test('past the last anchor the last slope carries on', () => {
  const slope = (177_327_360 - 28_654_905) / (149 - 72);
  assert.equal(heroXpRequired(150), Math.round(177_327_360 + slope));
});

test('a level that is not a level has no requirement', () => {
  assert.equal(heroXpRequired(-1), null);
  assert.equal(heroXpRequired(Number.NaN), null);
});

test('a bar past the estimate is full rather than overflowing', () => {
  assert.deepEqual(levelProgress(10, 5_000_000), { required: 5_000_000, share: 1 });
  assert.equal(levelProgress(10, 2_061_745).share, 0.5);
});

test('the forecast adds each level onto what is left of this one', () => {
  const [first, second] = levelForecast(10, 4_000_000, 1_000_000, 2);
  assert.equal(first.level, 11);
  assert.equal(first.needed, 123_490);
  assert.equal(second.needed, 123_490 + heroXpRequired(11));
  assert.equal(second.secs, (second.needed / 1_000_000) * 3600);
});

test('with no xp coming in there is no time to give', () => {
  assert.equal(levelForecast(10, 0, 0, 1)[0].secs, null);
});
