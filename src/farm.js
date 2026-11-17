import { nameKey } from './itemlist.js';

export function oneIn(rate) {
  if (rate >= 1e6) return `1/${(rate / 1e6).toFixed(1)}M`;
  if (rate >= 1e4) return `1/${Math.round(rate / 1e3)}k`;
  return `1/${rate}`;
}

// The build page's names come from HSPlanner and the drop tables from the
// game, and the two spell punctuation differently, so they meet on the same
// loose key a watchlist import uses.
export function dropLookup({ rate, chase, places }) {
  const byKey = new Map(Object.keys(rate).map((key) => [nameKey(key), key]));
  return (name) => {
    const key = byKey.get(nameKey(name));
    if (!key) return null;
    const anywhere = rate[key] ?? 0;
    return { anywhere, there: chase[key] ?? anywhere, places: (places[key] ?? []).filter(Boolean) };
  };
}

// A place is worth more the likelier any one of the wanted items is to drop
// there, so each item adds its own chance at that place. Items not tied to a
// place drop everywhere at their base rate and are listed apart: they do not
// make one place better than another.
export function farmPlaces(names, lookup) {
  const byPlace = new Map();
  const anywhere = [];
  const unknown = [];
  for (const name of new Set(names)) {
    const drop = lookup(name);
    if (!drop) unknown.push(name);
    else if (!drop.places.length) anywhere.push({ name, rate: drop.anywhere });
    else
      for (const place of drop.places) {
        const entry = byPlace.get(place) ?? { place, chance: 0, items: [] };
        if (drop.there > 0) entry.chance += 1 / drop.there;
        entry.items.push(name);
        byPlace.set(place, entry);
      }
  }
  const places = [...byPlace.values()].sort((a, b) => b.chance - a.chance || b.items.length - a.items.length);
  return { places, anywhere, unknown };
}
