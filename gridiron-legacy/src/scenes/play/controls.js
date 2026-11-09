// On-screen controls for free-control plays: a floating joystick (left half of the screen),
// context buttons (right side), and keyboard (WASD / arrows, Shift sprint, Space + letter keys).
//
// Buttons are described as { id, label, hold?, key } and can be swapped at any time with setButtons().
// Callbacks: onPress(id), onRelease(id), onTap(clientX, clientY) for taps that are not joystick drags.

export function makeControls(ctx, { onPress, onRelease, onTap }) {
  const hudEl = ctx.hud.el;
  const pad = document.createElement('div');
  pad.className = 'fc-buttons';
  hudEl.append(pad);
  const joy = document.createElement('div');
  joy.className = 'fc-joy';
  joy.innerHTML = '<i></i>';
  document.body.append(joy);
  const knob = joy.firstChild;

  const state = { x: 0, z: 0, sprint: false, active: false };
  const keys = {};
  let drag = null;
  let buttons = [];

  const updateFromKeys = () => {
    if (drag) return;
    let x = 0;
    let z = 0;
    if (keys.a || keys.arrowleft) x -= 1;
    if (keys.d || keys.arrowright) x += 1;
    if (keys.w || keys.arrowup) z -= 1;
    if (keys.s || keys.arrowdown) z += 1;
    const l = Math.hypot(x, z);
    state.x = l ? x / l : 0;
    state.z = l ? z / l : 0;
    state.active = l > 0;
  };

  const press = (id) => {
    const b = buttons.find((x) => x.id === id);
    if (!b) return;
    if (id === 'sprint') state.sprint = true;
    onPress?.(id);
    const el = pad.querySelector(`[data-id="${id}"]`);
    el?.classList.add('on');
  };
  const release = (id) => {
    if (id === 'sprint') state.sprint = false;
    onRelease?.(id);
    pad.querySelector(`[data-id="${id}"]`)?.classList.remove('on');
  };

  const setButtons = (list) => {
    buttons = list;
    pad.replaceChildren();
    for (const b of list) {
      const el = document.createElement('button');
      el.className = `fc-btn${b.big ? ' big' : ''}${b.tint ? ` ${b.tint}` : ''}`;
      el.dataset.id = b.id;
      el.innerHTML = `${b.label}${b.key ? `<small>${b.key}</small>` : ''}`;
      el.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); el.setPointerCapture?.(ev.pointerId); press(b.id); });
      el.addEventListener('pointerup', (ev) => { ev.preventDefault(); release(b.id); });
      el.addEventListener('pointercancel', () => release(b.id));
      pad.append(el);
    }
  };

  // Joystick: any touch/press on the left ~55% of the screen (not on a button).
  const pd = (ev) => {
    if (ev.target.closest?.('.fc-btn, .tipbox, .fc-plays, .hud-choices')) return;
    const left = ev.clientX < window.innerWidth * 0.55;
    if (!left) { onTap?.(ev.clientX, ev.clientY, ev); return; }
    ev.preventDefault();
    drag = { id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, moved: false };
    joy.style.display = 'block';
    joy.style.left = `${ev.clientX}px`;
    joy.style.top = `${ev.clientY}px`;
    knob.style.transform = 'translate(0,0)';
  };
  const pm = (ev) => {
    if (!drag || ev.pointerId !== drag.id) return;
    const dx = ev.clientX - drag.x0;
    const dy = ev.clientY - drag.y0;
    const l = Math.hypot(dx, dy);
    if (l > 8) drag.moved = true;
    const k = Math.min(1, l / 55);
    state.x = l ? (dx / l) * k : 0;
    state.z = l ? (dy / l) * k : 0;
    state.active = k > 0.15;
    const c = Math.min(l, 55);
    knob.style.transform = `translate(${l ? (dx / l) * c * 0.7 : 0}px, ${l ? (dy / l) * c * 0.7 : 0}px)`;
  };
  const pu = (ev) => {
    if (!drag || ev.pointerId !== drag.id) return;
    if (!drag.moved) onTap?.(ev.clientX, ev.clientY, ev);
    drag = null;
    joy.style.display = 'none';
    state.x = 0; state.z = 0; state.active = false;
    updateFromKeys();
  };
  const kd = (ev) => {
    const k = ev.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) ev.preventDefault();
    if (ev.repeat) return;
    keys[k] = true;
    if (k === 'shift') { state.sprint = true; onPress?.('sprint'); }
    const b = buttons.find((x) => x.key && x.key.toLowerCase() === (k === ' ' ? 'space' : k));
    if (b) press(b.id);
    if (/^[1-5]$/.test(k)) onPress?.(`key${k}`);
    updateFromKeys();
  };
  const ku = (ev) => {
    const k = ev.key.toLowerCase();
    keys[k] = false;
    if (k === 'shift') { state.sprint = false; onRelease?.('sprint'); }
    const b = buttons.find((x) => x.key && x.key.toLowerCase() === (k === ' ' ? 'space' : k));
    if (b) release(b.id);
    updateFromKeys();
  };
  ctx.canvas.addEventListener('pointerdown', pd);
  hudEl.addEventListener('pointerdown', pd);
  window.addEventListener('pointermove', pm);
  window.addEventListener('pointerup', pu);
  window.addEventListener('keydown', kd);
  window.addEventListener('keyup', ku);
  ctx.addCleanup(() => {
    ctx.canvas.removeEventListener('pointerdown', pd);
    hudEl.removeEventListener('pointerdown', pd);
    window.removeEventListener('pointermove', pm);
    window.removeEventListener('pointerup', pu);
    window.removeEventListener('keydown', kd);
    window.removeEventListener('keyup', ku);
    joy.remove();
    pad.remove();
  });
  return { state, setButtons };
}
