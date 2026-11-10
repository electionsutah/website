<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { VOTE_ANIMATION_DURATION, voteEase } from './lib/vote-animation';
  /** Number to show. Counts up from zero the first time it scrolls into view, then eases between later values. */
  export let value: number;
  export let format: (value: number) => string = (n) => Math.round(n).toLocaleString('en-US');
  export let duration = VOTE_ANIMATION_DURATION;
  let element: HTMLSpanElement;
  let shown = 0;
  let seen = false;
  let frame = 0;
  let observer: IntersectionObserver | undefined;
  let motion: MediaQueryList | undefined;
  const preferenceChanged = () => {
    if (!motion?.matches) return;
    cancelAnimationFrame(frame);
    observer?.disconnect();
    seen = true;
    shown = value;
  };
  const reduced = () => typeof window === 'undefined' || !window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function animate(from: number, to: number, time: number) {
    cancelAnimationFrame(frame);
    if (reduced() || from === to) { shown = to; return; }
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / time);
      shown = from + (to - from) * voteEase(t);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  }

  onMount(() => {
    motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    motion?.addEventListener?.('change', preferenceChanged);
    if (reduced() || !('IntersectionObserver' in window)) { seen = true; shown = value; return; }
    observer = new IntersectionObserver((entries) => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      seen = true;
      observer?.disconnect();
      animate(0, value, duration);
    }, { threshold: 0.4 });
    observer.observe(element);
  });
  onDestroy(() => { observer?.disconnect(); cancelAnimationFrame(frame); motion?.removeEventListener?.('change', preferenceChanged); });

  // After the first reveal, changes (e.g. picking a county) ease from the current number.
  let last = value;
  $: if (value !== last) { const from = seen ? shown : value; last = value; if (seen) animate(from, value, duration * 0.6); }
  // The animated digits are hidden from assistive tech, which reads only the final value.
  $: display = format(seen ? shown : 0);
</script>

<span class="count-up" bind:this={element}><span aria-hidden="true">{display}</span><span class="sr-only">{format(value)}</span></span>

<style>
  .count-up{font-variant-numeric:tabular-nums}
</style>
