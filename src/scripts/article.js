/* Page-scoped listeners are disposed before Astro swaps the document. */
let dispose = () => {};
function initArticle() {
  dispose();
  if (!document.querySelector('.article-content')) return;
  const controller = new AbortController();
  const on = (target, name, fn, options = {}) => target?.addEventListener(name, fn, { ...options, signal: controller.signal });
  const tocLinks = [...document.querySelectorAll('.toc-link')];
  const headings = tocLinks.map(link => document.getElementById(link.dataset.target)).filter(Boolean);
  const sidebar = document.querySelector('.article-sidebar');
  const back = document.querySelector('.back-to-top');
  let positions = [], navHeight = 0, activeId, frame;
  function measure() {
    navHeight = document.querySelector('.site-nav')?.getBoundingClientRect().height || 0;
    positions = headings.map(heading => ({ heading, top: heading.getBoundingClientRect().top + scrollY }));
    schedule();
  }
  function update() {
    frame = null;
    let current = positions[0]?.heading;
    for (const item of positions) { if (item.top > scrollY + navHeight + 40) break; current = item.heading; }
    if (scrollY + innerHeight >= document.documentElement.scrollHeight - 2) current = positions.at(-1)?.heading;
    back?.classList.toggle('visible', scrollY > 500);
    if (!current || current.id === activeId) return;
    activeId = current.id;
    tocLinks.forEach(link => {
      const active = link.dataset.target === activeId;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
    });
    const active = tocLinks.find(link => link.dataset.target === activeId);
    if (active && sidebar && innerWidth > 1080) {
      const box = active.getBoundingClientRect(), panel = sidebar.getBoundingClientRect();
      if (box.top < panel.top || box.bottom > panel.bottom) sidebar.scrollTop += box.top - panel.top - panel.height / 2;
    }
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(update); }
  on(window, 'scroll', schedule, { passive: true });
  on(window, 'resize', measure, { passive: true });
  on(document, 'load', measure, { capture: true });
  const observer = new ResizeObserver(measure);
  observer.observe(document.querySelector('.article-content'));

  document.querySelectorAll('.article-content pre').forEach(pre => {
    if (pre.closest('.code-block')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'markdown-code code-block';
    pre.before(wrapper); wrapper.append(pre);
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'markdown-copy code-copy';
    button.setAttribute('aria-label', '复制代码');
    button.innerHTML = '<span aria-live="polite">复制代码</span>';
    wrapper.append(button);
  });
  const timers = new Map();
  on(document, 'click', async event => {
    const button = event.target.closest('.code-copy');
    if (!button) return;
    const code = button.closest('.code-block')?.querySelector('code');
    if (!code) return;
    const label = button.querySelector('span'), original = button.dataset.copyLabel || label?.textContent;
    if (label) button.dataset.copyLabel = original;
    clearTimeout(timers.get(button));
    try {
      await navigator.clipboard.writeText(code.textContent);
      if (label) label.textContent = '已复制';
      button.dataset.copyState = 'success';
    } catch {
      const range = document.createRange(); range.selectNodeContents(code);
      const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
      if (label) label.textContent = '已选中，请复制';
      delete button.dataset.copyState;
    }
    if (controller.signal.aborted) return;
    const timer = setTimeout(() => { if (label) label.textContent = original; delete button.dataset.copyState; timers.delete(button); }, 1600);
    timers.set(button, timer);
  });
  on(back, 'click', () => scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }));
  const toggle = document.querySelector('.toc-toggle');
  if (toggle && sidebar) {
    const mobile = matchMedia('(max-width: 1080px)');
    const setOpen = (open, restoreFocus = false) => {
      sidebar.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? '关闭目录' : '显示目录');
      if (restoreFocus) toggle.focus({ preventScroll: true });
    };
    on(toggle, 'click', () => {
      const open = !sidebar.classList.contains('open'); setOpen(open);
      if (open) (sidebar.querySelector('[aria-current]') || sidebar.querySelector('a'))?.focus();
    });
    on(sidebar.querySelector('.toc-close'), 'click', () => setOpen(false, true));
    on(document, 'keydown', event => { if (event.key === 'Escape' && sidebar.classList.contains('open')) setOpen(false, true); });
    on(document, 'click', event => { if (!sidebar.contains(event.target) && !toggle.contains(event.target)) setOpen(false); });
    on(document, 'focusin', event => { if (mobile.matches && !sidebar.contains(event.target) && !toggle.contains(event.target)) setOpen(false); });
    tocLinks.forEach(link => on(link, 'click', () => {
      if (!mobile.matches) return;
      setOpen(false);
      const heading = document.getElementById(link.dataset.target);
      heading?.setAttribute('tabindex', '-1'); heading?.focus({ preventScroll: true });
    }));
    on(mobile, 'change', () => setOpen(false));
  }
  measure();
  dispose = () => { controller.abort(); observer.disconnect(); cancelAnimationFrame(frame); timers.forEach(timer => clearTimeout(timer)); };
}
document.addEventListener('astro:before-swap', () => dispose());
document.addEventListener('astro:page-load', initArticle);
initArticle();
