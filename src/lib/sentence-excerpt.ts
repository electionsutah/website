import { descriptionLinks } from './description-links';

type Options = { text: string; self: string; navigate: (href: string) => void };

/** Show complete sentences within the intro's token-defined line budget. */
export function sentenceExcerpt(node: HTMLElement, options: Options) {
  let text = options.text;
  const render = (excerpt: string) => {
    node.replaceChildren(...descriptionLinks(excerpt, options.self).map(part => {
      if (!part.href) return document.createTextNode(part.text);
      const link = document.createElement('a');
      link.href = part.href;
      link.textContent = part.text;
      link.onclick = event => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        options.navigate(part.href!);
      };
      return link;
    }));
  };
  let frame = 0;
  let destroyed = false;
  const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });

  const fit = () => {
    const style = getComputedStyle(node);
    const lines = parseFloat(style.getPropertyValue('--lines-place-intro'));
    const budget = lines * parseFloat(style.lineHeight);
    const sentences: string[] = [];
    for (const { segment } of segmenter.segment(text)) {
      const sentence = segment.trim();
      if (!sentence) continue;
      const previous = sentences.at(-1);
      // Intl may split place names such as “St. George” at the abbreviation.
      if (previous && /(?:\b(?:St|Mt|Ft|Dr|Mr|Mrs|Ms|Prof|Sr|Jr|Rev)\.|(?:^|\s)[A-Z]\.)$/.test(previous)) {
        sentences[sentences.length - 1] += ` ${sentence}`;
      } else {
        sentences.push(sentence);
      }
    }
    // The source may end with an incomplete fragment. Never append that fragment
    // to an otherwise complete excerpt.
    const complete = sentences.filter(sentence => /[.!?][\u201d\u2019"')\]]*$/.test(sentence));
    const candidates = complete.length ? complete : sentences;
    const probe = node.cloneNode(false) as HTMLElement;
    Object.assign(probe.style, {
      position: 'fixed', visibility: 'hidden', pointerEvents: 'none',
      width: `${node.getBoundingClientRect().width}px`, minBlockSize: '0',
      blockSize: 'auto', maxBlockSize: 'none'
    });
    probe.removeAttribute('id');
    node.parentElement!.append(probe);
    // Always retain at least the first sentence, even at large text sizes or
    // narrow widths where it needs more than the target number of lines.
    let excerpt = candidates[0] ?? text;
    try {
      for (let count = 1; count <= candidates.length; count++) {
        const candidate = candidates.slice(0, count).join(' ');
        probe.textContent = candidate;
        if (probe.getBoundingClientRect().height > budget) break;
        excerpt = candidate;
      }
    } finally {
      probe.remove();
    }
    render(excerpt);
  };
  const schedule = () => {
    if (destroyed) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => { if (!destroyed) fit(); });
  };
  // Width changes and late font loads can change which sentence fits.
  let width = 0;
  const observer = new ResizeObserver(([entry]) => {
    if (entry.contentRect.width !== width) {
      width = entry.contentRect.width;
      schedule();
    }
  });
  render(text);
  observer.observe(node);
  fit();
  document.fonts.ready.then(schedule);
  document.fonts.addEventListener('loadingdone', schedule);
  window.addEventListener('resize', schedule);
  return {
    update(next: Options) { options = next; text = next.text; schedule(); },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.fonts.removeEventListener('loadingdone', schedule);
      window.removeEventListener('resize', schedule);
    }
  };
}
