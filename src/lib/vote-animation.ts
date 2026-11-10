export const VOTE_ANIMATION_DURATION = 1100;
export const voteEase = (progress: number) => 1 - Math.pow(1 - progress, 3);

/** Reveal once per result, when the bar enters view; keep final data available without motion. */
export function revealVoteBar(node: HTMLElement, resultKey: unknown) {
  let frame = 0;
  let visible = false;
  let revealed = false;
  let observer: IntersectionObserver | undefined;
  const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const setProgress = (progress: number) => node.style.setProperty('--vote-progress', String(progress));
  const finish = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    revealed = true;
    setProgress(1);
  };
  const play = () => {
    if (revealed) return;
    if (motion?.matches) { finish(); return; }
    revealed = true;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - start) / VOTE_ANIMATION_DURATION));
      setProgress(voteEase(progress));
      if (progress < 1) frame = requestAnimationFrame(step);
      else frame = 0;
    };
    frame = requestAnimationFrame(step);
  };
  const preferenceChanged = () => { if (motion?.matches) finish(); };
  motion?.addEventListener?.('change', preferenceChanged);

  if (motion?.matches || !('IntersectionObserver' in window)) finish();
  else setProgress(0);
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      if (visible) play();
    }, { threshold: 0.4 });
    observer.observe(node);
  }

  return {
    update(nextKey: unknown) {
      if (Object.is(nextKey, resultKey)) return;
      resultKey = nextKey;
      cancelAnimationFrame(frame);
      frame = 0;
      revealed = false;
      if (motion?.matches || !observer) finish();
      else {
        setProgress(0);
        if (visible) play();
      }
    },
    destroy() {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      motion?.removeEventListener?.('change', preferenceChanged);
      node.style.removeProperty('--vote-progress');
    }
  };
}
