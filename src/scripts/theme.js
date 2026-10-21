/* One persisted theme controller across client-side navigations. */
import { navigationPath } from '../lib/site';
const key = 'highlight-info-theme';
const media = matchMedia('(prefers-color-scheme: dark)');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
function readChoice() { try { const value = localStorage.getItem(key); return ['light', 'dark', 'auto'].includes(value) ? value : 'auto'; } catch { return 'auto'; } }
function applyMotion(root = document.documentElement) {
  const still = motion.matches;
  const value = still ? 'still' : 'full';
  const changed = root.dataset.motion !== value;
  root.dataset.motion = value;
  if (root !== document.documentElement || !changed) return;
  window.dispatchEvent(new CustomEvent('motionchange', { detail: { still } }));
}
applyMotion();
function apply(choice, root = document.documentElement) {
  const theme = choice === 'auto' ? (media.matches ? 'dark' : 'light') : choice;
  root.dataset.theme = theme;
  root.dataset.themeChoice = choice;
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
document.addEventListener('astro:before-swap', event => {
  apply(readChoice(), event.newDocument.documentElement);
  applyMotion(event.newDocument.documentElement);
});
document.addEventListener('astro:after-swap', () => {
  apply(readChoice());
  applyMotion();
  const active = navigationPath(location.pathname);
  document.querySelectorAll('.nav-links a:not([target])').forEach(link => {
    const current = link.getAttribute('href') === active;
    link.classList.toggle('active', current);
    if (current) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
});
motion.addEventListener('change', () => applyMotion());
