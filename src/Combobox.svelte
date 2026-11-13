<script lang="ts">
  import Icon from './Icon.svelte';
  import { tick } from 'svelte';
  import { rankByTitle } from './lib/search';
  export let id: string;
  export let label: string;
  export let value = '';
  export let valueLabel = '';
  export let options: { value: string; label: string; description?: string; searchText?: string }[] = [];
  /** Prefer visible option labels over matches found only in supporting metadata. */
  export let rankLabelMatches = false;
  export let placeholder = 'Type to search…';
  export let clearable = true;
  export let itemLabel = 'district';
  export let itemsLabel = 'districts';
  export let hint = 'Type a district number or candidate name.';
  export let emptyMessage = 'No matching districts in this view. Try another number or name.';
  export let onSelect: (value: string) => void;
  let input: HTMLInputElement;
  let root: HTMLDivElement;
  let open = false;
  let text = '';
  let query = '';
  let active = -1;
  let previousValue = value;
  const normalize = (text: string) => text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  $: selectedLabel = options.find(option => option.value === value)?.label || valueLabel || value;
  $: numericValues = options.length > 0 && options.every(option => /^\d+$/.test(option.value));
  $: matches = options.filter(option => {
    const search = normalize(query);
    if (numericValues && /^\d+$/.test(search)) return option.value.startsWith(search);
    return search.split(/\s+/).every(token => normalize(`${option.label} ${option.description || ''} ${option.searchText || ''}`).includes(token));
  });
  $: filtered = rankLabelMatches
    ? rankByTitle(matches, normalize(query).split(/\s+/).filter(Boolean), option => normalize(option.label))
    : matches;
  $: if (value !== previousValue) {
    previousValue = value; open = false; query = ''; text = selectedLabel; active = -1;
  }
  $: if (!open) text = selectedLabel;
  $: activeId = open && filtered[active] ? `${id}-option-${active}` : undefined;
  function dismiss() { open = false; query = ''; text = selectedLabel; active = -1; }
  async function show() {
    if (open) return;
    query = ''; open = true;
    active = options.findIndex(option => option.value === value);
    await tick(); input?.select(); reveal();
  }
  function reveal() {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' });
  }
  async function move(step: number) {
    if (!open) { await show(); if (active < 0) active = step > 0 ? 0 : filtered.length - 1; }
    else if (filtered.length) active = Math.max(0, Math.min(filtered.length - 1, active < 0 ? (step > 0 ? 0 : filtered.length - 1) : active + step));
    await tick(); reveal();
  }
  async function onInput(event: Event) {
    text = (event.currentTarget as HTMLInputElement).value; query = text; open = true; active = 0;
    await tick(); reveal();
  }
  function choose(next: string) { onSelect(next); dismiss(); input?.focus({ preventScroll: true }); }
  function onKeydown(event: KeyboardEvent) {
    if (event.isComposing) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); void move(event.key === 'ArrowDown' ? 1 : -1); }
    else if (event.key === 'Enter' && open) { event.preventDefault(); if (filtered[active]) choose(filtered[active].value); }
    else if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); dismiss(); }
    else if (event.key === 'Tab') dismiss();
    // Home/End and text-editing keys retain native input behavior.
  }
  function outside(event: PointerEvent) { if (open && !root?.contains(event.target as Node)) dismiss(); }
</script>

<svelte:window onpointerdown={outside} />
<div class="district-combobox" bind:this={root} onfocusout={(event) => { if (!root.contains(event.relatedTarget as Node)) dismiss(); }}>
  <label for={id} id={`${id}-label`}>{label}</label>
  <div class="combobox-field">
    <input bind:this={input} {id} role="combobox" type="text" autocomplete="off" spellcheck="false" {placeholder}
      value={text} aria-autocomplete="list" aria-expanded={open} aria-controls={open ? `${id}-listbox` : undefined} aria-activedescendant={activeId} aria-describedby={`${id}-hint`}
      onfocus={() => { void show(); }} onclick={() => { void show(); }} onkeydown={onKeydown}
      oninput={onInput} />
    {#if value && clearable}<button type="button" class="combobox-clear" aria-label={`Clear selected ${itemLabel}`} onpointerdown={(event) => event.preventDefault()} onclick={() => choose('')}><Icon name="close" /></button>{/if}
    <button type="button" class="combobox-toggle" aria-label={`${open ? 'Hide' : 'Show'} ${itemLabel} options`} aria-expanded={open} aria-controls={open ? `${id}-listbox` : undefined} tabindex="-1" onpointerdown={(event) => event.preventDefault()} onclick={() => { if (open) dismiss(); else { input?.focus(); void show(); } }}><Icon name="expand_more" /></button>
  </div>
  <p id={`${id}-hint`} class="combobox-hint">{hint}</p>
  {#if open}
    <div class="combobox-popup">
      <ul role="listbox" id={`${id}-listbox`} aria-labelledby={`${id}-label`}>
        {#each filtered as option, index (option.value)}
          <li role="option" id={`${id}-option-${index}`} aria-selected={value === option.value} tabindex="-1" class:highlighted={index === active}
            onpointerdown={(event) => event.preventDefault()} onclick={() => choose(option.value)} onkeydown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(option.value); } }} onmouseenter={() => active = index}>
            <span><strong>{option.label}</strong>{#if option.description}<small>{option.description}</small>{/if}</span>{#if value === option.value}<span class="combobox-check" aria-hidden="true">✓</span>{/if}
          </li>
        {/each}
      </ul>
      {#if !filtered.length}<p class="combobox-empty">{emptyMessage}</p>{/if}
      <p class="combobox-count" role="status">{filtered.length} {filtered.length === 1 ? itemLabel : itemsLabel} available</p>
    </div>
  {/if}
</div>
