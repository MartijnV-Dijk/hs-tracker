import { locale } from './say.svelte.js';
import { RARITIES } from './format.js';

export const perHour = (value, secs) => (secs > 0 ? Math.round((value * 3600) / secs) : 0);

export const runDrops = (run) => RARITIES.reduce((sum, name) => sum + (run.items?.[name] ?? 0), 0);

export const runDay = (ms) =>
  new Date(ms).toLocaleString(locale(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export const tallyTotal = (run, group) =>
  (run.tallies ?? []).filter((row) => row.group === group).reduce((sum, row) => sum + row.total, 0);
