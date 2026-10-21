/* One persistent cursor above page transitions; updates only on input events. */
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const forcedColors = matchMedia('(forced-colors: active)');
const cursor = document.querySelector('.site-cursor');
const point = cursor?.querySelector('.site-cursor-point');
let mousePosition;
const enabled = () => finePointer.matches && !reducedMotion.matches && !forcedColors.matches;
const reset = () => {
  mousePosition = undefined;
  document.documentElement.removeAttribute('data-site-cursor');
};
function update(event) {
  const target = event.target;
  // Keep native selection, drag, touch and editable controls intact.
  if (!cursor || !point || !enabled() || event.pointerType !== 'mouse' ||
      (event.type === 'pointermove' && event.buttons) || !(target instanceof Element) ||
      target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) {
    reset();
    return;
  }
  mousePosition = { x: event.clientX, y: event.clientY };
  point.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
  cursor.dataset.mode = target.closest('a, button, summary, [role="button"]') ? 'link' : 'default';
  document.documentElement.setAttribute('data-site-cursor', '');
}
function refresh() {
  if (!mousePosition) return;
  update({ pointerType: 'mouse', clientX: mousePosition.x, clientY: mousePosition.y,
    target: document.elementFromPoint(mousePosition.x, mousePosition.y) });
}
document.addEventListener('pointermove', update, { passive: true });
document.addEventListener('pointerdown', update, { passive: true });
document.addEventListener('pointerup', event => {
  if (document.getSelection()?.isCollapsed === false) { reset(); return; }
  update(event);
}, { passive: true });
document.addEventListener('pointerout', event => { if (!event.relatedTarget) reset(); });
document.addEventListener('pointercancel', reset);
window.addEventListener('scroll', refresh, { passive: true });
window.addEventListener('resize', refresh, { passive: true });
window.addEventListener('blur', reset);
document.addEventListener('visibilitychange', reset);
document.addEventListener('keydown', reset);
for (const preference of [finePointer, reducedMotion, forcedColors]) preference.addEventListener('change', reset);
document.addEventListener('astro:before-swap', event => {
  // Astro replaces root attributes but preserves this cursor node and its listeners.
  event.newDocument.documentElement.toggleAttribute('data-site-cursor', enabled() && !!mousePosition);
});
document.addEventListener('astro:after-swap', refresh);
document.addEventListener('astro:page-load', refresh);
