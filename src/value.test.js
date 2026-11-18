import { test } from 'node:test';
import assert from 'node:assert/strict';
import { valueLists } from './value.js';

const gear = (count, tierOf, rateOf, rarity = 'Satanic') =>
  Array.from({ length: count }, (_, index) => ({ name: `gear ${tierOf}-${index}`, type: 3, tier: tierOf, rate: rateOf(index), rarity }));
const keys = Array.from({ length: 10 }, (_, index) => ({ name: `key ${index}`, type: 12, tier: 6, rate: (index + 1) * 1000, rarity: 'Common' }));

function tables(entries) {
  const items = {};
  const tier = {};
  const rate = {};
  const rarity = {};
  entries.forEach((entry, index) => {
    items[`${entry.type}:${index}:0`] = entry.name;
    const lower = entry.name.toLowerCase();
    if (entry.tier) tier[lower] = entry.tier;
    if (entry.rate) rate[lower] = entry.rate;
    rarity[lower] = entry.rarity;
  });
  return { items, tier, rate, rarity };
}

const ss = gear(9, 6, (index) => (index + 1) * 100_000);
const s = gear(9, 5, (index) => (index + 1) * 1_000);
const angelic = { name: 'Halo', type: 0, tier: 6, rate: 2_000_000, rarity: 'Angelic' };
const all = tables([...ss, ...s, ...keys, angelic]);

test('the rarest third of SS gear and every Angelic item is a jackpot', () => {
  const { jackpot } = valueLists(all);
  for (const index of [6, 7, 8]) assert.ok(jackpot.includes(`gear 6-${index}`), `SS ${index}`);
  assert.ok(!jackpot.includes('gear 6-5'));
  assert.ok(jackpot.includes('halo'));
});

test('the rest of SS gear and the rarer two thirds of S gear are good', () => {
  const { good } = valueLists(all);
  assert.ok(good.includes('gear 6-0') && good.includes('gear 6-5'));
  assert.ok(good.includes('gear 5-3') && good.includes('gear 5-8'));
  assert.ok(!good.includes('gear 5-2'), 'the commonest S items stay on their rarity sound');
});

test('keys are ranked against keys by how rarely they drop, not by grade', () => {
  const { good, jackpot } = valueLists(all);
  assert.ok(jackpot.includes('key 9'));
  assert.ok(good.includes('key 7') && good.includes('key 8'));
  assert.ok(!good.includes('key 2') && !jackpot.includes('key 2'), 'a common key marked SS is still common');
});

test('an upgrade for the build is a jackpot, matched however HSPlanner spells it', () => {
  const { jackpot, good } = valueLists(all, { upgrades: ['GEAR 5-0'] });
  assert.ok(jackpot.includes('gear 5-0'));
  assert.ok(!good.includes('gear 5-0'), 'a name sits on one list only');
});

test('an item the player muted is left off both lists', () => {
  const { jackpot, good } = valueLists(all, { muted: ['Halo', 'gear 6-0'] });
  assert.ok(!jackpot.includes('halo') && !good.includes('gear 6-0'));
});
