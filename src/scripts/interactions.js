/* Small, bounded interaction animations. Astro owns navigation and its cancellation. */
import { navigationPath } from '../lib/site';
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const ease = 'cubic-bezier(.22,1,.36,1)';
const still = () => reduced.matches || document.documentElement.dataset.motion === 'still';
let indicatorAnimation, indicatorFrame, indicatorReady = false;
const nav = document.querySelector('.nav-links');
const indicator = nav?.querySelector('.nav-indicator');
function moveIndicator(link, animate = true) {
  if (!indicator || !link) return;
  // Read the current animated box before canceling, so a new target never resets it.
  const origin = nav.getBoundingClientRect(), target = link.getBoundingClientRect();
  const previous = indicator.getBoundingClientRect();
  indicatorAnimation?.cancel();
  const x = target.left - origin.left, y = target.top - origin.top;
  const transform = `translate(${x}px, ${y}px)`;
  Object.assign(indicator.style, { width: `${target.width}px`, height: `${target.height}px`, transform });
  nav.dataset.indicatorReady = '';
  if (animate && indicatorReady && !still()) {
    indicatorAnimation = indicator.animate([
      { transform: `translate(${previous.left - origin.left}px, ${previous.top - origin.top}px) scale(${previous.width / target.width}, ${previous.height / target.height})` },
      { transform },
    ], { duration: 260, easing: ease });
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

// Share only the chosen title, rather than morphing a whole page or reading column.
let shared = null, generation = 0, loadingTimer;
function finishNavigation(resume = true) {
  clearTimeout(loadingTimer);
  delete document.documentElement.dataset.navigationLoading;
  if (resume) window.dispatchEvent(new Event('site:navigation-end'));
}
document.addEventListener('astro:after-swap', finishNavigation);
function visible(element) {
  if (!element) return false;
  const box = element.getBoundingClientRect();
  const navBottom = document.querySelector('.site-nav')?.getBoundingClientRect().bottom || 0;
  return box.width > 0 && box.bottom > navBottom && box.top < innerHeight;
}
function matchingCard(doc, path) {
  return [...doc.querySelectorAll('.post-card, .feature-card')].find(card => new URL(card.getAttribute('href'), location.origin).pathname === path);
}
function clearShared(value = shared) {
  if (!value) return;
  for (const title of [value.from, value.to]) {
    title.classList.add('motion-settled');
    title.closest('.post-card, .feature-card')?.classList.add('motion-settled');
    title.style.removeProperty('view-transition-name');
    title.classList.remove('shared-document-title');
    title.closest('.post-card, .feature-card')?.classList.remove('shared-document-card');
  }
  if (shared === value) shared = null;
}
document.addEventListener('astro:before-preparation', event => {
  const request = ++generation;
  finishNavigation(false);
  loadingTimer = setTimeout(() => { if (request === generation) document.documentElement.dataset.navigationLoading = ''; }, 140);
  event.signal.addEventListener('abort', () => {
    if (request !== generation) return;
    currentIndicator(false);
    finishNavigation();
  }, { once: true });
  clearPress();
  clearShared();
  const targetNav = [...(nav?.querySelectorAll('a:not([target])') || [])].find(link => link.getAttribute('href') === navigationPath(event.to.pathname));
  moveIndicator(targetNav);
  const load = event.loader;
  event.loader = async () => {
    try { await load(); } catch (error) { if (request === generation) { currentIndicator(); finishNavigation(); } throw error; }
    if (event.signal.aborted || request !== generation || still() || !document.startViewTransition) return;
    const incoming = event.newDocument;
    let from, to;
    if (incoming.querySelector('.article-title')) {
      from = matchingCard(document, event.to.pathname)?.querySelector('.post-title');
      to = incoming.querySelector('.article-title');
    } else if (document.querySelector('.article-title')) {
      from = document.querySelector('.article-title');
      to = matchingCard(incoming, event.from.pathname)?.querySelector('.post-title');
    } else if (incoming.querySelector('.collection-hero h1')) {
      from = matchingCard(document, event.to.pathname)?.querySelector('.feature-title');
      to = incoming.querySelector('.collection-hero h1');
    } else if (document.querySelector('.collection-hero h1')) {
      from = document.querySelector('.collection-hero h1');
      to = matchingCard(incoming, event.from.pathname)?.querySelector('.feature-title');
    }
    if (!to || !visible(from)) return;
    shared = { from, to, request };
    for (const title of [from, to]) {
      title.style.viewTransitionName = 'document-title';
      title.classList.add('shared-document-title');
      title.closest('.post-card, .feature-card')?.classList.add('shared-document-card', 'in');
    }
  };
});
document.addEventListener('astro:before-swap', event => {
  clearPress();
  const value = shared;
  if (still()) event.viewTransition?.skipTransition();
  // ready can reject when a new navigation interrupts the browser transition.
  event.viewTransition?.ready.catch(() => {});
  event.viewTransition?.finished.then(() => clearShared(value), () => clearShared(value));
});
