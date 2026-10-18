/* One theme controller and one reveal observer across client-side navigations. */
import { navigationPath } from '../lib/site';
const key = 'highlight-info-theme';
const media = matchMedia('(prefers-color-scheme: dark)');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
function readChoice() { try { return localStorage.getItem(key) || 'light'; } catch { return 'light'; } }
function apply(choice, root = document.documentElement) {
  const theme = choice === 'auto' ? (media.matches ? 'dark' : 'light') : choice;
  root.dataset.theme = theme;
  root.dataset.themeChoice = choice;
  if (!motion.matches) root.dataset.motionReady = '';
  if (root !== document.documentElement) return;
  document.querySelectorAll('.theme-switch button').forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.themeValue === choice)));
  window.dispatchEvent(new CustomEvent('themechange', { detail: { theme, choice } }));
}
window.__theme = { get: () => document.documentElement.dataset.theme, apply };
apply(readChoice());
document.addEventListener('click', event => {
  const btn = event.target.closest('.theme-switch button[data-theme-value]');
  if (btn) { try { localStorage.setItem(key, btn.dataset.themeValue); } catch {} apply(btn.dataset.themeValue); }
  const anchor = event.target.closest('a[href^="#"]');
  if (!anchor || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  let target;
  try { target = document.getElementById(decodeURIComponent(anchor.hash.slice(1))); } catch { return; }
  if (target) {
    event.preventDefault();
    history.replaceState(history.state, '', anchor.hash);
    target.scrollIntoView({ behavior: motion.matches ? 'instant' : 'smooth', block: 'start' });
  }
});
media.addEventListener('change', () => { if (readChoice() === 'auto') apply('auto'); });
document.addEventListener('astro:before-swap', event => apply(readChoice(), event.newDocument.documentElement));
document.addEventListener('astro:after-swap', () => {
  apply(readChoice());
  const active = navigationPath(location.pathname);
  document.querySelectorAll('.nav-links a:not([target])').forEach(link => {
    const current = link.getAttribute('href') === active;
    link.classList.toggle('active', current);
    if (current) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
});
let observer;
function revealPage() {
  observer?.disconnect();
  const nodes = document.querySelectorAll('.reveal');
  if (motion.matches || !('IntersectionObserver' in window)) {
    nodes.forEach(el => el.classList.add('in'));
  } else {
    document.documentElement.dataset.motionReady = '';
    observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('in'); observer.unobserve(entry.target); }
    }), { threshold: 0, rootMargin: '0px 0px -24px 0px' });
    nodes.forEach(el => {
      // Nested card entries carry their own motion, without moving the whole section.
      if (el.querySelector('.reveal')) el.classList.add('reveal-container');
      observer.observe(el);
    });
  }
  window.__motionInitialized = true;
}
motion.addEventListener('change', revealPage);
document.addEventListener('astro:page-load', revealPage);
document.addEventListener('astro:before-swap', () => observer?.disconnect());

revealPage();
