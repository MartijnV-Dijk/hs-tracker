// Effective HP is a ratio of large numbers, and a swap that leaves defense
// alone can still move it by a hair. Anything inside this is not a cost.
const ROUNDING = 0.01;

const relative = (now, was) => (was > 0 ? now / was - 1 : 0);

export function defenseChange(before, after) {
  return {
    resistance: after.lowest_resistance - before.lowest_resistance,
    elemental: relative(after.elemental_ehp, before.elemental_ehp),
    physical: relative(after.physical_ehp, before.physical_ehp),
    life: after.life - before.life,
  };
}

export function keepsDefense(change) {
  return change.elemental >= -ROUNDING && change.physical >= -ROUNDING;
}
