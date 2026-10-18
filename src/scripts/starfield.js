/* Persistent, time-based starfield. CSS-pixel physics, capped draw rate and cached halos. */
const canvas = document.getElementById('starfield');
const ctx = canvas?.getContext('2d');
if (canvas && ctx) {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = matchMedia('(pointer: coarse)');
  const palette = ['255,255,255', '190,215,255', '255,240,205', '255,180,140', '255,150,160'];
  const halos = palette.map(color => {
    const image = document.createElement('canvas'); image.width = image.height = 64;
    const paint = image.getContext('2d');
    const gradient = paint.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, `rgba(${color},0.45)`); gradient.addColorStop(0.4, `rgba(${color},0.15)`); gradient.addColorStop(1, `rgba(${color},0)`);
    paint.fillStyle = gradient; paint.fillRect(0, 0, 64, 64);
    return image;
  });
  let width, height, stars = [], shooting = null, active = false, raf, last = 0, resizeFrame, originX = 0, originY = 0, links = [], nextLinks = 0, navigating = false;
  let scrollingUntil = 0, reading = document.body.classList.contains('document-page');
  const mouse = { x: -9999, y: -9999, active: false, strength: 0 };
  const compact = () => coarse.matches || innerWidth < 700;
  function resize() {
    const bounds = canvas.parentElement.getBoundingClientRect();
    originX = bounds.left || 0; originY = bounds.top || 0;
    const previousWidth = width, previousHeight = height;
    if (width === bounds.width && height === bounds.height) return;
    width = bounds.width; height = bounds.height;
    const dpr = Math.min(devicePixelRatio || 1, compact() ? 1 : 1.25);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    canvas.style.width = '100%'; canvas.style.height = '100%';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const target = compact() ? 42 : Math.min(88, Math.max(55, Math.floor(width * height / 16000)));
    const previous = stars;
    stars = Array.from({ length: target }, (_, index) => {
      if (previous[index]) {
        const star = previous[index], sx = width / previousWidth, sy = height / previousHeight;
        return { ...star, x: star.x * sx, y: star.y * sy, hx: star.hx * sx, hy: star.hy * sy };
      }
      const x = Math.random() * width, y = Math.random() * height, r = 0.35 + Math.pow(Math.random(), 2.4) * 1.5;
      return { x, y, hx: x, hy: y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6,
        r, color: Math.random() < 0.52 ? 0 : 1 + Math.floor(Math.random() * 4), tw: Math.random() * Math.PI * 2,
        twSpeed: 0.48 + Math.random() * 1.32, alpha: 0.45 + Math.random() * 0.55, flare: Math.random() < 0.08 };
    });
    shooting = null; links = []; nextLinks = 0;
    if (!document.hidden && document.documentElement.dataset.theme === 'dark') draw();
  }
  function update(dt, now) {
    mouse.strength += ((mouse.active && !coarse.matches ? 1 : 0) - mouse.strength) * (1 - Math.exp(-2.45 * dt));
    for (const star of stars) {
      if (mouse.strength > 0.01) {
        const dx = mouse.x - star.x, dy = mouse.y - star.y, dist = Math.hypot(dx, dy) + 0.001;
        let force = Math.min(0.85 * mouse.strength / (dist + 45), 0.055);
        if (dist < 26) force -= (1 - dist / 26) * 0.055 * mouse.strength;
        star.vx += dx / dist * force * 3600 * dt; star.vy += dy / dist * force * 3600 * dt;
      } else {
        star.vx += (star.hx - star.x) * 0.288 * dt; star.vy += (star.hy - star.y) * 0.288 * dt;
      }
      const damping = Math.exp(-2.14 * dt);
      star.vx *= damping; star.vy *= damping;
      const speed = Math.hypot(star.vx, star.vy);
      if (speed > 132) { star.vx *= 132 / speed; star.vy *= 132 / speed; }
      star.x += star.vx * dt; star.y += star.vy * dt; star.tw += star.twSpeed * dt;
      if (star.x < -20 || star.x > width + 20) star.hx = star.x = star.x < 0 ? width + 20 : -20;
      if (star.y < -20 || star.y > height + 20) star.hy = star.y = star.y < 0 ? height + 20 : -20;
    }
    if (!reading && !shooting && now > scrollingUntil && Math.random() < 1 - Math.exp(-0.28 * dt)) {
      const left = Math.random() < 0.5;
      shooting = { x: left ? -50 : width + 50, y: Math.random() * height * 0.5, vx: (left ? 1 : -1) * 540, vy: 240, life: 1, len: 90 };
    }
    if (shooting) {
      shooting.x += shooting.vx * dt; shooting.y += shooting.vy * dt; shooting.life -= 0.9 * dt;
      if (shooting.life <= 0) shooting = null;
    }
  }
  function draw() {
    ctx.clearRect(0, 0, width, height);
    // Reuse a short constellation list. Rebuild topology at most five times a second.
    if (!compact() && !reading && performance.now() >= nextLinks) {
      nextLinks = performance.now() + 200;
      links = [];
      const buckets = new Map(), cell = 110;
      for (const star of stars) {
        const cx = Math.floor(star.x / cell), cy = Math.floor(star.y / cell);
        for (let x = cx - 1; x <= cx + 1; x++) for (let y = cy - 1; y <= cy + 1; y++) {
          for (const other of buckets.get(`${x},${y}`) || []) {
            const distance = Math.hypot(star.x - other.x, star.y - other.y);
            if (distance < cell) links.push([star, other, (1 - distance / cell) * 0.1]);
          }
        }
        const key = `${cx},${cy}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(star);
      }
    }
    if (!compact() && !reading) for (const [star, other, alpha] of links) {
      ctx.strokeStyle = `rgba(${palette[star.color]},${alpha})`; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(star.x, star.y); ctx.lineTo(other.x, other.y); ctx.stroke();
    }
    for (const star of stars) {
      const alpha = star.alpha * (0.72 + 0.28 * Math.sin(star.tw));
      if (star.r > 1.35) {
        ctx.globalAlpha = alpha;
        const radius = star.r * 6;
        ctx.drawImage(halos[star.color], star.x - radius, star.y - radius, radius * 2, radius * 2);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = `rgba(${palette[star.color]},${alpha})`;
      ctx.beginPath(); ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2); ctx.fill();
      if (star.flare && star.r > 1.35) {
        ctx.strokeStyle = `rgba(${palette[star.color]},${alpha * 0.35})`; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(star.x - star.r * 5, star.y); ctx.lineTo(star.x + star.r * 5, star.y);
        ctx.moveTo(star.x, star.y - star.r * 5); ctx.lineTo(star.x, star.y + star.r * 5); ctx.stroke();
      }
    }
    if (shooting) {
      const tailX = shooting.x - Math.sign(shooting.vx) * shooting.len, tailY = shooting.y - 40;
      const gradient = ctx.createLinearGradient(shooting.x, shooting.y, tailX, tailY);
      gradient.addColorStop(0, `rgba(255,255,255,${shooting.life * 0.95})`); gradient.addColorStop(1, 'rgba(190,215,255,0)');
      ctx.strokeStyle = gradient; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(shooting.x, shooting.y); ctx.lineTo(tailX, tailY); ctx.stroke();
    }
  }
  function tick(now) {
    if (!active) return;
    raf = requestAnimationFrame(tick);
    const fps = now < scrollingUntil ? 12 : reading ? 12 : compact() ? 18 : mouse.active ? 36 : 24;
    if (last && now - last < 1000 / fps - 1) return;
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 1 / fps;
    last = now; update(dt, now); draw();
  }
  function sync() {
    const dark = document.documentElement.dataset.theme === 'dark';
    const still = document.documentElement.dataset.motion === 'still' || motion.matches;
    const on = dark && !still && !document.hidden && !navigating;
    if (on === active) { if (dark && !active && !document.hidden) draw(); return; }
    active = on; last = 0; cancelAnimationFrame(raf);
    if (on) raf = requestAnimationFrame(tick);
    else { mouse.active = false; if (dark && !document.hidden) draw(); }
  }
  window.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || coarse.matches) return;
    mouse.x = event.clientX - originX; mouse.y = event.clientY - originY; mouse.active = true;
  }, { passive: true });
  window.addEventListener('pointerout', event => { if (!event.relatedTarget) mouse.active = false; });
  window.addEventListener('pointercancel', () => { mouse.active = false; });
  window.addEventListener('blur', () => { mouse.active = false; });
  window.addEventListener('scroll', () => { scrollingUntil = performance.now() + 180; }, { passive: true });
  window.addEventListener('resize', () => {
    if (!resizeFrame) resizeFrame = requestAnimationFrame(() => { resizeFrame = null; resize(); });
  }, { passive: true });
  window.addEventListener('themechange', sync);
  window.addEventListener('motionchange', sync);
  window.addEventListener('site:navigation-end', () => { navigating = false; sync(); });
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('astro:before-preparation', () => { navigating = true; sync(); });
  document.addEventListener('astro:after-swap', () => { reading = document.body.classList.contains('document-page'); navigating = false; mouse.active = false; sync(); });
  document.addEventListener('astro:page-load', () => { navigating = false; sync(); });
  motion.addEventListener('change', sync);
  coarse.addEventListener('change', resize);
  // Parent dimensions are fixed by CSS; redraw in the observer before the next paint.
  const viewportObserver = new ResizeObserver(resize);
  viewportObserver.observe(canvas.parentElement);
  resize(); sync();
}
