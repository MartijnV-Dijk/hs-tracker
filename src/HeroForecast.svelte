<script>
  import { t } from './say.svelte.js';
  import { fmt, span } from './format.js';
  import { art } from './skin.svelte.js';
  import { levelForecast, levelProgress } from './heroxp.js';

  let { herolevel, xpInLevel, xpPerHour } = $props();

  const LEVELS_AHEAD = 5;
  const progress = $derived(levelProgress(herolevel, xpInLevel));
  const rows = $derived(levelForecast(herolevel, xpInLevel, xpPerHour, LEVELS_AHEAD));
</script>

<div class="box" style:border-image-source="url({art('chip_dark')})">
  <div class="box-head">
    <span class="accent">{t('Hero level')} {herolevel}</span>
    <span class="right" title={t('No packet says what a hero level needs. These come from a community curve, so treat them as a guide.')}>
      {t('estimate')}
    </span>
  </div>
  <div class="bar"><div class="fill" style:width="{progress.share * 100}%"></div></div>
  <div class="sub">{fmt(xpInLevel)} / {fmt(progress.required)} · {(progress.share * 100).toFixed(1)}%</div>
  <div class="grid">
    <span class="dim">{t('to')}</span>
    <span class="dim num">{t('xp needed')}</span>
    <span class="dim num">{t('at this rate')}</span>
    {#each rows as row}
      <span>{t('HLv')} {row.level}</span>
      <span class="num">{fmt(row.needed)}</span>
      <span class="num">{row.secs == null ? '—' : span(row.secs)}</span>
    {/each}
  </div>
</div>

<style>
  .box {
    box-sizing: border-box;
    border: 6px solid transparent;
    border-image-slice: 6 fill;
    border-image-width: 6px;
    image-rendering: pixelated;
    padding: 4px 8px 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .box-head {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }
  .accent { color: var(--edge-2b); }
  .right { margin-left: auto; color: var(--dim-2); cursor: help; }
  .bar { height: 6px; background: rgba(0, 0, 0, 0.35); border-radius: 3px; overflow: hidden; }
  .fill { height: 100%; background: #a06ae0; }
  .sub { font-size: 10px; color: var(--edge-8); }
  .grid {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 1px 12px;
    font-size: 11px;
    color: var(--bone-9);
  }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .dim { color: var(--edge-8); font-size: 10px; }
</style>
