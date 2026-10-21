/* Small, bounded interaction animations. Astro owns navigation and its cancellation. */
import { navigationPath } from '../lib/site';
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const ease = 'cubic-bezier(.22,1,.36,1)';
const still = () => reduced.matches || document.documentElement.dataset.motion === 'still';
if (document.documentElement.hasAttribute('data-initial-page')) {
  const entranceEvents = new AbortController();
  const stopEntrance = () => {
    document.documentElement.removeAttribute('data-initial-page');
    entranceEvents.abort();
  };
  for (const name of ['pointerdown', 'keydown', 'astro:before-preparation', 'visibilitychange']) {
    document.addEventListener(name, stopEntrance, { once: true, signal: entranceEvents.signal });
  }
  for (const name of ['animationend', 'animationcancel']) {
    document.addEventListener(name, event => {
      if (event.animationName === 'home-develop') stopEntrance();
    }, { signal: entranceEvents.signal });
  }
  window.addEventListener('motionchange', stopEntrance, { once: true, signal: entranceEvents.signal });
}

let indicatorAnimation, indicatorFrame, indicatorReady = false;
const nav = document.querySelector('.nav-links');
const indicator = nav?.querySelector('.nav-indicator');
function moveIndicator(link, animate = true) {
  if (!indicator || !link) return;
  // Read the current animated box before canceling, so a new target never resets it.
  const origin = nav.getBoundingClientRect(), target = link.getBoundingClientRect();
  const previous = indicator.getBoundingClientRect();
  const width = Math.max(12, target.width - 24), height = 2;
  const x = target.left - origin.left + 12, y = target.bottom - origin.top - height;
  const transform = `translate(${x}px, ${y}px)`;
  if (indicatorReady && indicator.style.width === `${width}px` && indicator.style.transform === transform) return;
  indicatorAnimation?.cancel();
  Object.assign(indicator.style, { width: `${width}px`, height: `${height}px`, transform });
  nav.dataset.indicatorReady = '';
  if (animate && indicatorReady && !still()) {
    indicatorAnimation = indicator.animate([
      { transform: `translate(${previous.left - origin.left}px, ${previous.top - origin.top}px) scale(${previous.width / width}, ${previous.height / height})` },
      { transform },
    ], { duration: 180, easing: ease });
    const animation = indicatorAnimation;
    animation.finished.then(() => { if (indicatorAnimation === animation) indicatorAnimation = null; }, () => {});
  }
  indicatorReady = true;
}
function currentIndicator(animate = true) { moveIndicator(nav?.querySelector('[aria-current="page"]'), animate); }
function scheduleIndicator() {
  cancelAnimationFrame(indicatorFrame);
  indicatorFrame = requestAnimationFrame(() => currentIndicator(false));
}
if (nav) new ResizeObserver(scheduleIndicator).observe(nav);
window.addEventListener('resize', scheduleIndicator, { passive: true });
document.addEventListener('astro:after-swap', () => queueMicrotask(() => currentIndicator()));
document.addEventListener('astro:page-load', () => currentIndicator());
reduced.addEventListener('change', () => { clearPress(); currentIndicator(false); });
window.addEventListener('motionchange', () => { clearPress(); currentIndicator(false); });
currentIndicator(false);

// Use one delegated set of listeners for mouse, touch and keyboard press feedback.
const controlSelector = '.post-card, .feature-card, .btn, .site-nav button, .nav-links a, .code-copy, .toc-toggle, .back-to-top, .sync-start, .sync-refresh';
let pressed, pointerStart;
function clearPress() { pressed?.classList.remove('is-pressed'); pressed = null; pointerStart = null; }
document.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  clearPress();
  pressed = event.target.closest(controlSelector);
  pressed?.classList.add('is-pressed');
  pointerStart = { x: event.clientX, y: event.clientY };
}, { passive: true });
document.addEventListener('pointermove', event => {
  if (pressed && pointerStart && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 10) clearPress();
}, { passive: true });
for (const name of ['pointerup', 'pointercancel']) document.addEventListener(name, clearPress, { passive: true });
window.addEventListener('blur', clearPress);
window.addEventListener('scroll', clearPress, { passive: true });
document.addEventListener('keydown', event => {
  if (event.repeat || !['Enter', ' '].includes(event.key)) return;
  const control = event.target.closest(controlSelector);
  if (control) { clearPress(); pressed = control; pressed.classList.add('is-pressed'); }
});
document.addEventListener('keyup', clearPress);

// Expand the incoming page from the activated link; no title or layout morphing.
const origins = new WeakMap();
let activation, generation = 0;
document.addEventListener('click', event => {
  const source = event.target instanceof Element ? event.target.closest('a[href]') : null;
  activation = source && event.detail > 0 ? { source, x: event.clientX, y: event.clientY } : undefined;
}, { capture: true });
document.addEventListener('astro:before-preparation', event => {
  const request = ++generation;
  const source = event.sourceElement?.closest('a[href]');
  const box = source?.getBoundingClientRect();
  const clicked = source && activation?.source === source ? activation : null;
  origins.set(event.signal, {
    request,
    x: Math.max(0, Math.min(innerWidth, clicked?.x ?? (box ? box.left + box.width / 2 : innerWidth / 2))),
    y: Math.max(0, Math.min(innerHeight, clicked?.y ?? (box ? box.top + box.height / 2 : innerHeight / 2))),
  });
  activation = undefined;
  event.signal.addEventListener('abort', () => {
    if (request !== generation) return;
    delete document.documentElement.dataset.pageTransition;
    currentIndicator(false);
  }, { once: true });
  clearPress();
  const targetNav = [...(nav?.querySelectorAll('a:not([target])') || [])].find(link => link.getAttribute('href') === navigationPath(event.to.pathname));
  moveIndicator(targetNav);
  const load = event.loader;
  event.loader = async () => {
    try {
      await load();
      if (!event.signal.aborted && request === generation) document.documentElement.dataset.pageTransition = '';
    }
    catch (error) {
      if (request === generation) { delete document.documentElement.dataset.pageTransition; currentIndicator(); }
      throw error;
    }
  };
});
document.addEventListener('astro:before-swap', event => {
  clearPress();
  const { x, y, request } = origins.get(event.signal) ?? { x: innerWidth / 2, y: innerHeight / 2, request: generation };
  const root = event.newDocument.documentElement;
  root.dataset.pageTransition = '';
  root.style.setProperty('--page-reveal-x', `${x}px`);
  root.style.setProperty('--page-reveal-y', `${y}px`);
  root.style.setProperty('--page-reveal-radius', `${Math.ceil(Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))) + 2}px`);
  if (still()) event.viewTransition?.skipTransition();
  // A second navigation can interrupt the browser transition before it becomes ready.
  event.viewTransition?.ready.catch(() => {});
  const finish = () => { if (request === generation) delete document.documentElement.dataset.pageTransition; };
  if (event.viewTransition) event.viewTransition.finished.then(finish, finish);
  else finish();
});
