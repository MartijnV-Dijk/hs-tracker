import { nameKey } from './itemlist.js';

// The game sends no prices, so worth stands in for them: how good the game
// grades an item, how rarely it drops, and whether it would raise this build's
// damage. Rarity is ranked within a kind of item, because a key the tables
// grade SS can still drop one time in four hundred.
const LAST_GEAR_TYPE = 10;
const SS = 6;
const S = 5;
const ALWAYS_JACKPOT = new Set(['angelic', 'unholy']);
const SMALLEST_KIND = 5;

const atShare = (sortedRates, share) => sortedRates[Math.min(sortedRates.length - 1, Math.floor(sortedRates.length * share))];

export function valueLists({ items, tier, rate, rarity }, { upgrades = [], muted = [] } = {}) {
  const typeOf = new Map();
  for (const [identity, name] of Object.entries(items)) {
    const lower = name.toLowerCase();
    if (!typeOf.has(lower)) typeOf.set(lower, Number(identity.split(':')[0]));
  }
  const names = [...typeOf.keys()];
  const isGear = (name) => typeOf.get(name) <= LAST_GEAR_TYPE;
  const sortedRates = (pool) => pool.map((name) => rate[name]).filter(Boolean).sort((a, b) => a - b);

  const graded = (grade) =>
    sortedRates(names.filter((name) => isGear(name) && tier[name] === grade && !ALWAYS_JACKPOT.has(rarity[name]?.toLowerCase())));
  const ssRates = graded(SS);
  const sRates = graded(S);
  const kindRates = new Map();
  for (const name of names.filter((name) => !isGear(name))) {
    const kind = typeOf.get(name);
    if (!kindRates.has(kind)) kindRates.set(kind, sortedRates(names.filter((other) => typeOf.get(other) === kind)));
  }

  const byKey = new Map(names.map((name) => [nameKey(name), name]));
  const upgraded = new Set(upgrades.map((name) => byKey.get(nameKey(name))).filter(Boolean));
  const silenced = new Set(muted.map((name) => name.trim().toLowerCase()));

  const levelOf = (name) => {
    if (upgraded.has(name)) return 'jackpot';
    const dropRate = rate[name];
    if (isGear(name)) {
      if (ALWAYS_JACKPOT.has(rarity[name]?.toLowerCase())) return 'jackpot';
      if (!dropRate) return null;
      if (tier[name] === SS) return ssRates.length && dropRate >= atShare(ssRates, 2 / 3) ? 'jackpot' : 'good';
      if (tier[name] === S && sRates.length && dropRate >= atShare(sRates, 1 / 3)) return 'good';
      return null;
    }
    const kind = kindRates.get(typeOf.get(name)) ?? [];
    if (!dropRate || kind.length < SMALLEST_KIND) return null;
    if (dropRate >= atShare(kind, 0.9)) return 'jackpot';
    return dropRate >= atShare(kind, 2 / 3) ? 'good' : null;
  };

  const lists = { jackpot: [], good: [] };
  for (const name of names) {
    const level = silenced.has(name) ? null : levelOf(name);
    if (level) lists[level].push(name);
  }
  lists.jackpot.sort();
  lists.good.sort();
  return lists;
}
