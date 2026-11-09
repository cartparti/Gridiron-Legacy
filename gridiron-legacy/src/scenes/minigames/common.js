// Shared minigame helpers: input binding, first-time tips, camera follow, ending a play.
import { sfx } from '../../audio/sfx.js';
import { WEATHER } from '../../data/config.js';

/** Weather effects for a moment: { speed, slip, wind {x,z}, fog, id }. */
export function weatherFx(m) {
  const w = WEATHER[m.weather] ?? WEATHER.clear;
  return { id: m.weather ?? 'clear', speed: w.speed ?? 1, slip: w.slip ?? 0, wind: m.wind ?? { x: 0, z: 0, mph: 0 }, fog: !!w.fog };
}

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
  box.innerHTML = `<div class="tip-k">How to play</div><div class="tip-t">${title}</div>${lines.map((l) => `<p>${l}</p>`).join('')}<div class="tip-go">Tap to start</div>`;
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

/**
 * Retro broadcast camera: fixed high angle behind the play, smoothly tracking a point.
 * zoom 1 = wide (whole route tree), 0.6 = tight (run plays).
 */
export function rig(camera, x, z, dt, { zoom = 1, ahead = 8, k = 4, snap = false } = {}) {
  const h = 30 * zoom;
  const back = 26 * zoom;
  const a = snap ? 1 : 1 - Math.exp(-k * dt);
  camera.position.x += (x * 0.85 - camera.position.x) * a;
  camera.position.y += (h - camera.position.y) * a;
  camera.position.z += (z + back - camera.position.z) * a;
  camera.userData.look = camera.userData.look ?? { x, z };
  const L = camera.userData.look;
  L.x += (x - L.x) * a;
  L.z += (z - ahead - L.z) * a;
  camera.lookAt(L.x, 0, L.z);
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
  let big;
  let good;
  if (result.defense) {
    big = result.defTD ? 'PICK SIX!' : result.int ? 'INTERCEPTION!' : result.forcedFumble ? 'FUMBLE!' : result.pd ? 'BROKEN UP!' : result.tdAllowed ? 'TOUCHDOWN...' : result.tackle ? `STOP! ${result.yardsAllowed} YDS` : `+${result.yardsAllowed} ALLOWED`;
    good = result.int || result.pd || result.forcedFumble || (result.tackle && result.yardsAllowed < 6);
  } else {
    big = result.td ? 'TOUCHDOWN!' : result.turnover ? (result.text?.includes('FUMBLE') ? 'FUMBLE!' : 'INTERCEPTED!') : result.sack ? 'SACKED!' : result.complete ? `${result.yards >= 0 ? '+' : ''}${result.yards} YDS` : 'INCOMPLETE';
    good = result.td || (result.complete && result.yards >= 10);
  }
  const bad = result.defense ? result.tdAllowed || result.yardsAllowed >= 15 : result.turnover || result.sack;
  ctx.hud.big(big, color ?? (good ? '#4ade80' : bad ? '#f87171' : '#ffffff'), delay + 400);
  ctx.hud.instr('');
  if (result.td || result.int || result.defTD) { sfx.touchdown(); ctx.slowMo?.(0.5); }
  else if (result.turnover) { sfx.groan(); ctx.shake?.(0.25); }
  else if (result.complete && result.yards >= 15) sfx.cheer();
  setTimeout(() => ctx.done(result), ctx.opts.reducedMotion ? 500 : delay);
}

export function finalize(result, moment) {
  if (result.defense) {
    result.yardsAllowed = Math.max(0, Math.round(result.yardsAllowed ?? 0));
    if (!result.turnover && !result.pd && result.yardsAllowed >= moment.yardLine) { result.yardsAllowed = moment.yardLine; result.tdAllowed = true; }
    result.text = result.text ?? (result.defTD ? 'PICK SIX!' : result.int ? 'INTERCEPTED!' : result.pd ? 'Broken up!' : result.tdAllowed ? 'They scored on you.' : `${result.yardsAllowed} yards allowed.`);
    result.quality = Math.max(0, Math.min(1, result.quality));
    return result;
  }
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
