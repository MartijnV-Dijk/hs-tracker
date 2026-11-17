<script>
  import { t } from './say.svelte.js';
  import { fmt, span, RARITIES, RARITY_CLASS, difficulty } from './format.js';
  import { zoneName } from './buffs.js';
  import { art } from './skin.svelte.js';
  import { perHour, runDay, runDrops, tallyTotal } from './runfigures.js';

  let { a, b } = $props();

  const rate = (count, secs) => (secs > 0 ? (count * 3600) / secs : 0);
  const oneDecimal = (value) => value.toFixed(1);

  // Rates, not totals: two runs of different length are only comparable per
  // hour. Time, magic find and hero level are context for those rates, so
  // their difference is shown without calling it better or worse.
  const ROWS = [
    { label: 'Time', of: (r) => r.secs, show: span, context: true },
    { label: 'Gold/h', of: (r) => perHour(r.gold, r.secs), show: fmt, cls: 'c-gold' },
    { label: 'XP/h', of: (r) => perHour(r.xp, r.secs), show: fmt, cls: 'c-xp' },
    { label: 'Kills/h', of: (r) => perHour(r.kills, r.secs), show: fmt },
    { label: 'Drops/h', of: (r) => perHour(runDrops(r), r.secs), show: fmt },
    ...RARITIES.map((name) => ({
      label: `${name}/h`,
      of: (r) => rate(r.items?.[name] ?? 0, r.secs),
      show: oneDecimal,
      cls: RARITY_CLASS[name],
    })),
    { label: 'Bosses/h', of: (r) => rate(tallyTotal(r, 'boss'), r.secs), show: oneDecimal },
    { label: 'Chests/h', of: (r) => rate(tallyTotal(r, 'chest'), r.secs), show: oneDecimal },
    { label: 'Magic find', of: (r) => r.mf ?? 0, show: fmt, context: true },
    { label: 'Hero level', of: (r) => r.herolevel ?? 0, show: String, context: true },
  ];

  const change = (from, to) => (from ? Math.round(((to - from) / from) * 100) : null);

  const zones = $derived.by(() => {
    const byRoom = new Map();
    [a, b].forEach((run, column) => {
      for (const [room, secs] of run.zones ?? []) {
        const row = byRoom.get(room) ?? [0, 0];
        row[column] = secs;
        byRoom.set(room, row);
      }
    });
    return [...byRoom].sort(([, first], [, second]) => second[0] + second[1] - (first[0] + first[1]));
  });
</script>

<div class="box" style:border-image-source="url({art('chip_dark')})">
  <div class="grid">
    <span></span>
    <span class="col">
      <span class="accent">{runDay(a.started_ms)}</span>
      <span class="dim">{difficulty(a.difficulty, a.hell_sub) ?? ''}</span>
    </span>
    <span class="col">
      <span class="accent">{runDay(b.started_ms)}</span>
      <span class="dim">{difficulty(b.difficulty, b.hell_sub) ?? ''}</span>
    </span>
    <span class="col dim">{t('change')}</span>

    {#each ROWS as row}
      {@const from = row.of(a)}
      {@const to = row.of(b)}
      {@const apart = change(from, to)}
      <span class="label">{t(row.label)}</span>
      <span class="num {row.cls ?? ''}">{row.show(from)}</span>
      <span class="num {row.cls ?? ''}">{row.show(to)}</span>
      <span class="num vs" class:up={!row.context && apart > 0} class:down={!row.context && apart < 0}>
        {apart == null ? '' : `${apart > 0 ? '+' : ''}${apart}%`}
      </span>
    {/each}
  </div>
</div>

{#if zones.length}
  <div class="box" style:border-image-source="url({art('chip_dark')})">
    <div class="head"><span class="accent">{t('Time by zone')}</span></div>
    <div class="grid">
      {#each zones as [room, [secsA, secsB]]}
        <span class="label">{zoneName(room)}</span>
        <span class="num">{secsA ? span(secsA) : ''}</span>
        <span class="num">{secsB ? span(secsB) : ''}</span>
        <span></span>
      {/each}
    </div>
  </div>
{/if}

<style>
  .box {
    box-sizing: border-box;
    flex: none;
    border: 6px solid transparent;
    border-image-slice: 6 fill;
    border-image-width: 6px;
    image-rendering: pixelated;
    padding: 4px 8px 6px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .head {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }
  .accent { color: var(--edge-2b); }
  .dim { color: var(--edge-8); font-size: 10px; }

  .grid {
    display: grid;
    grid-template-columns: minmax(70px, 1fr) repeat(2, minmax(56px, auto)) minmax(40px, auto);
    gap: 2px 12px;
    align-items: baseline;
    font-size: 11px;
  }
  .col { display: flex; flex-direction: column; text-align: right; font-size: 10px; }
  .label { color: var(--bone-4); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .num { text-align: right; color: var(--bone-9); font-variant-numeric: tabular-nums; }
  .vs { font-size: 10px; color: var(--bone-4); }
  .vs.up { color: var(--gold-2); }
  .vs.down { color: #b06a6a; }

  .c-sat { color: var(--rar-satanic); }
  .c-set { color: #40d040; }
  .c-her { color: #00ffae; }
  .c-ang { color: #f6f794; }
  .c-unh { color: #e04a7a; }
  .c-gold { color: var(--gold-2); }
  .c-xp { color: #a06ae0; }
</style>
