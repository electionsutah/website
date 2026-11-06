/** Keep a native popover beside its trigger without affecting the surrounding layout. */
export function anchoredPopover(node: HTMLElement, id: string) {
  const place = () => {
    if (!node.matches(':popover-open')) return;
    const button = document.querySelector<HTMLElement>(`[popovertarget="${CSS.escape(id)}"]:not([popovertargetaction])`);
    if (!button) return;
    const style = getComputedStyle(node);
    const gap = parseFloat(style.getPropertyValue('--space-2'));
    const margin = parseFloat(style.getPropertyValue('--space-3'));
    const anchor = button.getBoundingClientRect();
    const width = node.offsetWidth, height = node.offsetHeight;
    const left = Math.max(margin, Math.min(anchor.right - width, window.innerWidth - width - margin));
    const below = anchor.bottom + gap + height <= window.innerHeight - margin || anchor.top - gap - height < margin;
    const top = below ? anchor.bottom + gap : anchor.top - gap - height;
    node.style.left = `${left}px`;
    node.style.top = `${Math.max(margin, Math.min(top, window.innerHeight - height - margin))}px`;
  };
  const toggle = (event: Event) => {
    const open = (event as ToggleEvent).newState === 'open';
    if (open) place();
    for (const type of ['scroll', 'resize']) (open ? addEventListener : removeEventListener)(type, place, true);
  };
  // Reposition when expandable content inside the popover changes its size.
  const observer = new ResizeObserver(place);
  observer.observe(node);
  node.addEventListener('toggle', toggle);
  return {
    update(nextId: string) {
      if (nextId !== id && node.matches(':popover-open')) node.hidePopover();
      id = nextId;
    },
    destroy() {
      observer.disconnect();
      node.removeEventListener('toggle', toggle);
      removeEventListener('scroll', place, true);
      removeEventListener('resize', place, true);
    }
  };
}
