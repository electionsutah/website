import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false, ws: false } });
const globals = ['window', 'IntersectionObserver', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'];
const descriptors = new Map(globals.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
try {
  const { revealVoteBar, VOTE_ANIMATION_DURATION } = await server.ssrLoadModule('/src/lib/vote-animation.ts');
  let clock = 0;
  let nextFrame = 0;
  let reduced = false;
  const frames = new Map();
  const preferences = new Set();
  const observers = [];
  const media = {
    get matches() { return reduced; },
    addEventListener: (_type, listener) => preferences.add(listener),
    removeEventListener: (_type, listener) => preferences.delete(listener)
  };
  class Observer {
    constructor(callback, options) { this.callback = callback; this.options = options; observers.push(this); }
    observe(node) { this.node = node; }
    disconnect() { this.disconnected = true; }
    intersect(isIntersecting) { this.callback([{ isIntersecting, target: this.node }]); }
  }
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: { matchMedia: () => media, IntersectionObserver: Observer } },
    IntersectionObserver: { configurable: true, value: Observer },
    performance: { configurable: true, value: { now: () => clock } },
    requestAnimationFrame: { configurable: true, value: callback => { const id = ++nextFrame; frames.set(id, callback); return id; } },
    cancelAnimationFrame: { configurable: true, value: id => frames.delete(id) }
  });
  function node() {
    const properties = new Map();
    return { properties, style: { setProperty: (key, value) => properties.set(key, value), removeProperty: key => properties.delete(key) } };
  }
  const progress = element => Number(element.properties.get('--vote-progress'));
  function advance(milliseconds) {
    clock += milliseconds;
    const current = [...frames.values()];
    frames.clear();
    current.forEach(callback => callback(clock));
  }

  const bar = node();
  const action = revealVoteBar(bar, 'statewide');
  const observer = observers.at(-1);
  assert.equal(progress(bar), 0);
  assert.equal(frames.size, 0, 'Offscreen bars wait instead of finishing before they are viewed');
  observer.intersect(false);
  assert.equal(frames.size, 0);
  observer.intersect(true);
  advance(VOTE_ANIMATION_DURATION / 2);
  assert(progress(bar) > 0 && progress(bar) < 1, 'Reveal has a real intermediate state');
  advance(VOTE_ANIMATION_DURATION / 2);
  assert.equal(progress(bar), 1);
  observer.intersect(false);
  observer.intersect(true);
  assert.equal(frames.size, 0, 'Scrolling past the same chart does not continually replay it');
  action.update('statewide');
  assert.equal(frames.size, 0, 'Unchanged data does not restart animation');
  observer.intersect(false);
  action.update('county');
  assert.equal(progress(bar), 0);
  assert.equal(frames.size, 0, 'New results received offscreen wait for their reveal');
  observer.intersect(true);
  advance(VOTE_ANIMATION_DURATION / 4);
  assert(progress(bar) > 0 && progress(bar) < 1);
  reduced = true;
  preferences.forEach(listener => listener());
  assert.equal(progress(bar), 1);
  assert.equal(frames.size, 0, 'Enabling reduced motion cancels active animation');
  action.update('another county');
  assert.equal(progress(bar), 1);
  assert.equal(frames.size, 0);
  action.destroy();
  assert(observer.disconnected);
  assert.equal(preferences.size, 0);
  assert(!bar.properties.has('--vote-progress'));

  const staticBar = node();
  const staticAction = revealVoteBar(staticBar, 'reduced at mount');
  assert.equal(progress(staticBar), 1, 'Reduced-motion visitors immediately see final proportions');
  staticAction.destroy();
  reduced = false;
  delete window.IntersectionObserver;
  const fallbackBar = node();
  const fallback = revealVoteBar(fallbackBar, 'no observer');
  assert.equal(progress(fallbackBar), 1, 'Unsupported observers leave final data visible');
  fallback.update('updated fallback');
  assert.equal(progress(fallbackBar), 1);
  fallback.destroy();

  window.IntersectionObserver = Observer;
  const removedBar = node();
  const removed = revealVoteBar(removedBar, 'removed while animating');
  observers.at(-1).intersect(true);
  assert.equal(frames.size, 1);
  removed.destroy();
  assert.equal(frames.size, 0, 'Unmounting a chart cancels pending frames');
  assert.equal(preferences.size, 0);
  console.log('Vote animation: viewport reveal, intermediate/final proportions, data changes, reduced motion, fallback and cleanup passed.');
} finally {
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
  await server.close();
}
