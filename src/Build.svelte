<script>
  import { invoke } from './bridge.js';
  import { art } from './skin.svelte.js';
  import { placeList, t } from './say.svelte.js';
  import { fmt, RARITY_CLASS } from './format.js';
  import { DROP_CHASE, DROP_PLACES, DROP_RATE } from './items.js';
  import { save, startSettings, store } from './settings.svelte.js';
  import { dropLookup, farmPlaces, oneIn } from './farm.js';
  import { defenseChange, keepsDefense } from './defense.js';

  startSettings();
  let settings = $derived(store.settings);

  const SLOT_LABEL = {
    weapon: 'Weapon', offhand: 'Offhand', armor: 'Armor', helmet: 'Helmet', gloves: 'Gloves',
    boots: 'Boots', belt: 'Belt', amulet: 'Amulet', ring_1: 'Ring', ring_2: 'Ring',
  };
  const RARITY = { satanic: 'Satanic', satanic_set: 'Set', heroic: 'Heroic', angelic: 'Angelic', unholy: 'Unholy' };
  const PLACES_SHOWN = 6;

  const lookup = dropLookup({ rate: DROP_RATE, chase: DROP_CHASE, places: DROP_PLACES });

  let link = $state('');
  let report = $state(null);
  let error = $state('');
  let busy = $state(false);

  async function measure() {
    if (!link.trim() || busy) return;
    busy = true;
    error = '';
    try {
      report = await invoke('analyse_build', { link });
      if (settings && settings.build_link !== link) {
        settings.build_link = link;
        save();
      }
    } catch (e) {
      report = null;
      error = String(e);
    } finally {
      busy = false;
    }
  }

  // The link is read back once, when the settings first arrive, and measured
  // straight away: the page is opened to see the answer, not to press a button.
  let restored = false;
  $effect(() => {
    if (restored || !settings) return;
    restored = true;
    link = settings.build_link ?? '';
    measure();
  });

  const costOf = (swap) => defenseChange(report.defense, swap.defense);

  // Farming advice follows the swaps you could make today without dying more:
  // a slot whose best swap trades defense away offers its best safe one instead.
  const bestPerSlot = $derived(
    (report?.slots ?? []).map((slot) => slot.swaps.find((swap) => keepsDefense(costOf(swap)))?.name).filter(Boolean),
  );
  const farm = $derived(farmPlaces(bestPerSlot, lookup));

  function where(name) {
    const drop = lookup(name);
    if (!drop) return t('not in the drop tables');
    const odds = (rate) => (rate > 0 ? ` · ${oneIn(rate)}` : '');
    return drop.places.length
      ? `${placeList(drop.places, ', ')}${odds(drop.there)}`
      : `${t('anywhere')}${odds(drop.anywhere)}`;
  }

  const percent = (gain) => `+${(gain * 100).toFixed(gain < 0.1 ? 1 : 0)}%`;
  const signed = (value) => `${value > 0 ? '+' : ''}${Math.round(value)}`;
  const ONE_PERCENT = 0.01;

  function costParts(swap) {
    const change = costOf(swap);
    const parts = [];
    if (Math.abs(change.resistance) >= 1)
      parts.push({ text: `${t('res')} ${Math.round(report.defense.lowest_resistance)} → ${Math.round(swap.defense.lowest_resistance)}`, up: change.resistance > 0 });
    if (Math.abs(change.elemental) >= ONE_PERCENT)
      parts.push({ text: `${t('vs elements')} ${signed(change.elemental * 100)}%`, up: change.elemental > 0 });
    if (Math.abs(change.physical) >= ONE_PERCENT)
      parts.push({ text: `${t('vs physical')} ${signed(change.physical * 100)}%`, up: change.physical > 0 });
    if (Math.abs(change.life) >= 1) parts.push({ text: `${t('life')} ${signed(change.life)}`, up: change.life > 0 });
    return parts;
  }
</script>

<div class="panel">
  <div class="box" style:border-image-source="url({art('chip_dark')})">
    <div class="head"><span class="accent">{t('Build')}</span></div>
    <div class="note">
      {t('Make your character in HSPlanner, press Share there, and paste the link here. Every unique your character can wear is tried in each slot, and the damage is measured with HSPlanner’s own engine.')}
    </div>
    <div class="linkrow">
      <input
        id="build-link"
        class="field"
        placeholder={t('HSPlanner share link')}
        bind:value={link}
        onkeydown={(e) => e.key === 'Enter' && measure()}
      />
      <button
        class="btn"
        style:--btn="url({art('button')})"
        style:--btn-hover="url({art('button_hover')})"
        style:--btn-down="url({art('button_down')})"
        disabled={busy || !link.trim()}
        onclick={measure}
      >{busy ? t('Measuring…') : t('Measure')}</button>
    </div>
    {#if error}<div class="error">{error}</div>{/if}
    {#if report}
      <div class="summary">
        {report.class ?? t('unknown class')} · {t('Lv')} {report.level}{#if report.skill}{' · '}{report.skill}{/if}
        · <b class="c-gold">{fmt(Math.round(report.dps))}</b> {t('DPS')}
      </div>
      <div class="dim">
        {t('lowest resistance')} {Math.round(report.defense.lowest_resistance)} · {t('life')} {fmt(Math.round(report.defense.life))}
      </div>
    {/if}
  </div>

  {#if report}
    <div class="cols">
      <div class="box grow" style:border-image-source="url({art('chip_dark')})">
        <div class="head"><span class="accent">{t('Best swaps')}</span><span class="right">{t('DPS gain')}</span></div>
        <div class="scroll">
          {#each report.slots as slot}
            <div class="slot">
              <span class="slotname">{t(SLOT_LABEL[slot.slot] ?? slot.slot)}</span>
              <span class="dim worn">{slot.worn ?? t('empty')}</span>
            </div>
            {#each slot.swaps as swap}
              <div class="swap">
                <span class="name {RARITY_CLASS[RARITY[swap.rarity]] ?? ''}">{swap.name}</span>
                <span class="dim">{swap.grade ?? ''}</span>
                {#if !keepsDefense(costOf(swap))}<span class="trade">{t('costs defense')}</span>{/if}
                <span class="gain">{percent(swap.gain)}</span>
              </div>
              <div class="cost">
                {#each costParts(swap) as part}
                  <span class:up={part.up} class:down={!part.up}>{part.text}</span>
                {:else}
                  <span class="dim">{t('defense unchanged')}</span>
                {/each}
              </div>
              <div class="where dim">{where(swap.name)}</div>
            {:else}
              <div class="where dim">{t('nothing you can wear here does more damage')}</div>
            {/each}
          {/each}
        </div>
      </div>

      <div class="box side" style:border-image-source="url({art('chip_dark')})">
        <div class="head"><span class="accent">{t('Where to farm')}</span></div>
        <div class="note">{t('For the best swap in each slot that keeps your defense: the places most likely to drop one of them.')}</div>
        {#each farm.places.slice(0, PLACES_SHOWN) as place}
          <div class="place">
            <div class="placehead">
              <span>{placeList([place.place])}</span>
              <span class="dim">{place.chance > 0 ? oneIn(Math.round(1 / place.chance)) : ''}</span>
            </div>
            <div class="dim">{place.items.join(', ')}</div>
          </div>
        {:else}
          <div class="dim">{t('none of these is tied to a place')}</div>
        {/each}
        {#if farm.anywhere.length}
          <div class="subhead">{t('Drop anywhere')}</div>
          <div class="dim">{farm.anywhere.map((it) => `${it.name} ${oneIn(it.rate)}`).join(', ')}</div>
        {/if}
        {#if farm.unknown.length}
          <div class="subhead">{t('Not in the drop tables')}</div>
          <div class="dim">{farm.unknown.join(', ')}</div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .panel {
    box-sizing: border-box;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-family: var(--face);
    font-size: 12px;
    color: var(--bone-6);
  }
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
    gap: 4px;
    min-width: 0;
  }
  .box.grow { flex: 1 1 auto; min-height: 0; }
  .box.side { flex: 0 1 260px; overflow-y: auto; }
  .cols { flex: 1 1 auto; min-height: 0; display: flex; gap: 6px; }
  .head {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }
  .accent { color: var(--edge-2b); }
  .right { margin-left: auto; color: var(--dim-2); }
  .note { font-size: 10px; line-height: 14px; color: var(--edge-8); }
  .dim { color: var(--edge-8); font-size: 10px; }
  .error { color: #e08a8a; font-size: 11px; }
  .summary { font-size: 12px; color: var(--bone-9); }

  .linkrow { display: flex; gap: 6px; }
  .field {
    flex: 1 1 auto;
    min-width: 0;
    font: inherit;
    font-size: 11px;
    color: var(--bone-9);
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid var(--edge-1);
    padding: 3px 6px;
  }
  .btn {
    box-sizing: border-box;
    height: 24px;
    flex: none;
    font: inherit;
    font-size: 10px;
    color: var(--bone-13);
    border: 6px solid transparent;
    border-image-source: var(--btn);
    border-image-slice: 6 fill;
    border-image-width: 6px;
    image-rendering: pixelated;
    padding: 0 8px;
    cursor: pointer;
  }
  .btn:hover { border-image-source: var(--btn-hover); }
  .btn:active { border-image-source: var(--btn-down); }
  .btn:disabled { opacity: 0.5; cursor: default; }

  .scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 1px; }
  .slot { display: flex; align-items: baseline; gap: 8px; margin-top: 6px; }
  .slotname { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--bone-4); }
  .worn { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .swap { display: flex; align-items: baseline; gap: 8px; }
  .swap .name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gain { color: var(--gold-2); font-variant-numeric: tabular-nums; }
  .trade { font-size: 9px; text-transform: uppercase; letter-spacing: 0.4px; color: #e08a8a; }
  .cost { display: flex; flex-wrap: wrap; gap: 0 10px; padding-left: 8px; font-size: 10px; }
  .cost .up { color: #7cc47c; }
  .cost .down { color: #e08a8a; }
  .where { padding-left: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .place { display: flex; flex-direction: column; padding: 2px 0; }
  .placehead { display: flex; justify-content: space-between; gap: 8px; color: var(--bone-9); }
  .subhead {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--bone-4);
    margin-top: 6px;
  }

  .c-sat { color: var(--rar-satanic); }
  .c-set { color: #40d040; }
  .c-her { color: #00ffae; }
  .c-ang { color: #f6f794; }
  .c-unh { color: #e04a7a; }
  .c-gold { color: var(--gold-2); }
</style>
