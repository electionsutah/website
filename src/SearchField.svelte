<script lang="ts">
  import Icon from './Icon.svelte';

  export let value = '';
  export let label: string;
  export let placeholder = '';
  export let className = '';
  export let shortcut = '';
  export let input: HTMLInputElement | undefined = undefined;
  export let onQuery: (value: string) => void = () => {};

  function clear() {
    value = '';
    onQuery(value);
    input?.focus();
  }
</script>

<div class={`search-field ${className}`}>
  <span><Icon name="search" /></span>
  <input
    bind:this={input}
    {value}
    type="search"
    placeholder={placeholder || `${label}…`}
    aria-label={label}
    autocomplete="off"
    oninput={(event) => { value = event.currentTarget.value; onQuery(value); }}
  />
  {#if value.length}
    <button type="button" class="search-clear" aria-label={`Clear ${label.toLowerCase()}`} title="Clear search" onclick={clear}><Icon name="close" /></button>
  {:else if shortcut}
    <kbd aria-hidden="true">{shortcut}</kbd>
  {/if}
</div>
