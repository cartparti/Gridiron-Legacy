// 2D timing-meter fallback for devices without WebGL. A marker sweeps a bar; tap in the green zone.
import { sfx } from '../../audio/sfx.js';

export function fallbackMeter({ hud, opts, done, addCleanup }) {
  const zone = Math.max(0.06, Math.min(0.3, 0.12 * opts.tolerance));
  const wrap = document.createElement('div');
  wrap.style.cssText = 'pointer-events:auto;padding:20px 8px;';
  wrap.innerHTML = `<div class="label">Tap when the marker is in the green</div>
    <div style="position:relative;height:36px;border-radius:12px;background:rgba(0,0,0,0.6);border:2px solid #fff;overflow:hidden">
      <div style="position:absolute;top:0;bottom:0;left:${(0.5 - zone / 2) * 100}%;width:${zone * 100}%;background:#4ade80"></div>
      <div class="mk" style="position:absolute;top:-4px;bottom:-4px;width:6px;background:#ffd43b;left:0"></div>
    </div>`;
  hud.bottom(wrap);
  hud.instr('3D view unavailable — timing mode');
  document.body.style.background = '#0d1b2a';
  const mk = wrap.querySelector('.mk');
  let x = 0;
  let dir = 1;
  let raf = 0;
  let last = performance.now();
  const speed = 0.9 * (opts.call === 'risky' ? 1.3 : opts.call === 'safe' ? 0.8 : 1);
  const tick = (now) => {
    const dt = (now - last) / 1000;
    last = now;
    x += dir * speed * dt;
    if (x > 1) { x = 1; dir = -1; }
    if (x < 0) { x = 0; dir = 1; }
    mk.style.left = `calc(${x * 100}% - 3px)`;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  const go = () => {
    cancelAnimationFrame(raf);
    const off = Math.abs(x - 0.5) / (zone / 2);
    const q = Math.max(0, Math.min(1, 1 - off * 0.45));
    sfx.click();
    document.body.style.background = '';
    setTimeout(() => done({ fallbackQuality: q }), 300);
  };
  wrap.addEventListener('pointerdown', go, { once: true });
  const key = (e) => { if (e.key === ' ') { window.removeEventListener('keydown', key); go(); } };
  window.addEventListener('keydown', key);
  addCleanup(() => { cancelAnimationFrame(raf); window.removeEventListener('keydown', key); });
}
