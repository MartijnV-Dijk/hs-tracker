import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defenseChange, keepsDefense } from './defense.js';

const now = { lowest_resistance: 90, elemental_ehp: 8400, physical_ehp: 2550, life: 1785 };

test('an amulet that strips resistances shows what it costs', () => {
  const change = defenseChange(now, { lowest_resistance: 50, elemental_ehp: 3310, physical_ehp: 1947, life: 1655 });
  assert.equal(change.resistance, -40);
  assert.equal(Math.round(change.elemental * 100), -61);
  assert.equal(Math.round(change.physical * 100), -24);
  assert.equal(change.life, -130);
  assert.equal(keepsDefense(change), false);
});

test('a swap that leaves defense as it was, or raises it, keeps it', () => {
  assert.equal(keepsDefense(defenseChange(now, now)), true);
  assert.equal(keepsDefense(defenseChange(now, { ...now, elemental_ehp: 10080, life: 2135 })), true);
});

test('a loss too small to be anything but rounding still keeps defense', () => {
  assert.equal(keepsDefense(defenseChange(now, { ...now, physical_ehp: 2540 })), true);
});

test('a build with nothing to compare against changes nothing', () => {
  const change = defenseChange({ ...now, physical_ehp: 0 }, now);
  assert.equal(change.physical, 0);
});
