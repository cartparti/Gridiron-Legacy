// Shared minigame helpers: input binding, first-time tips, camera follow, ending a play.
import { sfx } from '../../audio/sfx.js';

/** Pointer + keyboard input. handlers: { down(ev, pt), move(ev, pt), up(ev, pt), key(ev, isDown) } */
export function bindInput(ctx, handlers) {
  const c = ctx.canvas;
  const hudEl = ctx.hud.el;
  const pd = (ev) => { if (ev.target.closest?.('.hbtn, .tipbox, .skip')) return; ev.preventDefault(); handlers.down?.(ev, ctx.groundPoint(ev)); };
  const pm = (ev) => { handlers.move?.(ev, ctx.groundPoint(ev)); };
  const pu = (ev) => { handlers.up?.(ev, ctx.groundPoint(ev)); };
  const kd = (ev) => { if (ev.repeat) return; if ([' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(ev.key)) ev.preventDefault(); handlers.key?.(ev, true); };
  const ku = (ev) => handlers.key?.(ev, false);
  c.addEventListener('pointerdown', pd);
  hudEl.addEventListener('pointerdown', pd);
  window.addEventListener('pointermove', pm);
  window.addEventListener('pointerup', pu);
  window.addEventListener('keydown', kd);
  window.addEventListener('keyup', ku);
  ctx.addCleanup(() => {
    c.removeEventListener('pointerdown', pd);
    hudEl.removeEventListener('pointerdown', pd);
    window.removeEventListener('pointermove', pm);
    window.removeEventListener('pointerup', pu);
    window.removeEventListener('keydown', kd);
    window.removeEventListener('keyup', ku);
  });
}

/** Show a "how to play" card the first time. Calls start() when dismissed (or immediately). */
export function maybeTip(ctx, title, lines, start) {
  if (!ctx.opts.showTips) { start(); return; }
  const box = document.createElement('div');
  box.className = 'tipbox';
  box.style.cssText = 'position:absolute;left:16px;right:16px;top:30%;background:rgba(10,15,12,0.92);border:2px solid #f4c430;border-radius:16px;padding:16px;pointer-events:auto;font-family:system-ui,sans-serif;text-shadow:none;text-align:left;';
  box.innerHTML = `<div style="font-weight:900;font-size:1.2rem;text-transform:uppercase;color:#f4c430;margin-bottom:6px">${title}</div>${lines.map((l) => `<p style="margin:6px 0;font-size:0.95rem">${l}</p>`).join('')}<div style="margin-top:12px;font-weight:800;text-align:center;background:#f4c430;color:#111;border-radius:10px;padding:12px">TAP TO START</div>`;
  ctx.hud.el.append(box);
  const go = (ev) => {
    ev?.preventDefault?.();
    ev?.stopPropagation?.();
    box.remove();
    window.removeEventListener('keydown', key);
    ctx.opts.markTip?.();
    sfx.whistle();
    setTimeout(start, 120);
  };
  const key = (ev) => { if (ev.key === ' ' || ev.key === 'Enter') go(ev); };
  box.addEventListener('pointerdown', go);
  window.addEventListener('keydown', key);
}

/** Smoothly move the camera toward an offset from a target and look ahead. */
export function follow(camera, tx, tz, off, look, dt, k = 4) {
  const a = 1 - Math.exp(-k * dt);
  camera.position.x += (tx + off.x - camera.position.x) * a;
  camera.position.y += (off.y - camera.position.y) * a;
  camera.position.z += (tz + off.z - camera.position.z) * a;
  camera.lookAt(tx + look.x, look.y, tz + look.z);
}

/** Show the outcome, wait, then hand the result back. */
export function endPlay(ctx, result, { color, delay = 1600 } = {}) {
  if (ctx.ended) return;
  ctx.ended = true;
  const big = result.td ? 'TOUCHDOWN!' : result.turnover ? (result.text?.includes('FUMBLE') ? 'FUMBLE!' : 'INTERCEPTED!') : result.sack ? 'SACKED!' : result.complete ? `${result.yards >= 0 ? '+' : ''}${result.yards} YDS` : 'INCOMPLETE';
  ctx.hud.big(big, color ?? (result.td ? '#4ade80' : result.turnover || result.sack ? '#f87171' : result.complete ? '#ffffff' : '#fbbf24'), delay + 400);
  ctx.hud.instr('');
  if (result.td) sfx.touchdown();
  else if (result.turnover) sfx.groan();
  else if (result.complete && result.yards >= 15) sfx.cheer();
  setTimeout(() => ctx.done(result), ctx.opts.reducedMotion ? 500 : delay);
}

export function finalize(result, moment) {
  // Clamp to the goal line and mark touchdowns.
  if (!result.turnover && result.complete && result.yards >= moment.yardLine) {
    result.yards = moment.yardLine;
    result.td = true;
  }
  result.yards = Math.round(result.yards);
  if (!result.text) {
    result.text = result.td ? 'TOUCHDOWN!' : result.turnover ? 'Turnover!' : result.sack ? 'SACKED!'
      : result.complete ? (result.yards >= moment.distance ? `${result.yards} yards. First down!` : `${result.yards} yards.`) : 'Incomplete.';
  }
  result.quality = Math.max(0, Math.min(1, result.quality));
  return result;
}

export const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** A meter bar element for the HUD. Returns { el, set(fraction, color?) }. */
export function hudMeter(label) {
  const el = document.createElement('div');
  el.innerHTML = `<div class="label">${label}</div><div class="meterbar"><i style="width:0%"></i></div>`;
  const bar = el.querySelector('i');
  return { el, set: (f, bg) => { bar.style.width = `${Math.max(0, Math.min(1, f)) * 100}%`; if (bg) bar.style.background = bg; } };
}

export function gaussR() {
  let u = 0;
  while (u === 0) u = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
}
