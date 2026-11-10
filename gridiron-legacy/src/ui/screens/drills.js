// Playable training drills: quick arcade minigames that scale that day's training gains.
//   sprints  -> Sprint Ladder: alternate LEFT / RIGHT as fast as you can
//   weights  -> Power Reps: stop the bar inside the green zone (it shrinks each rep)
//   drills   -> Cone Reaction: tap the lit cone as fast as you can
//   film     -> Film Room: spot the open receiver before the clock runs out
//   doubles  -> Sprint Ladder + Power Reps
import { h, clear } from '../dom.js';
import { openModal } from '../components.js';
import { sfx } from '../../audio/sfx.js';
import { drillMultiplier } from '../../sim/week.js';
import { trainValue } from '../../sim/progress.js';

export const DRILLS = { sprints: 'sprint', weights: 'reps', drills: 'cones', film: 'film', doubles: 'sprint' };
export const DRILL_NAMES = { sprint: 'Sprint Ladder', reps: 'Power Reps', cones: 'Cone Reaction', film: 'Film Room' };

export const grade = (q) => (q >= 0.92 ? 'A+' : q >= 0.8 ? 'A' : q >= 0.65 ? 'B' : q >= 0.5 ? 'C' : q >= 0.3 ? 'D' : 'F');

/** Open the drill for an activity id. onDone(q 0..1). */
export function openDrill(actId, onDone) {
  const kind = DRILLS[actId];
  const box = h('div.drill');
  const m = openModal(box, { dismissable: false });
  let cleanup = null;
  const finish = (q) => {
    cleanup?.();
    clear(box);
    const mult = drillMultiplier(q);
    if (q >= 0.65) sfx.cheer(); else sfx.click();
    box.append(
      h('div.kicker.pix', DRILL_NAMES[kind]),
      h('div.drill-grade.pix', grade(q)),
      h('p.center', `Training gains today: ${mult >= 1 ? '+' : ''}${Math.round((mult - 1) * 100)}%`),
      h('p.center.small.muted', trainValue(q) ? `Training points: up to +${Math.round(trainValue(q) * 100)}% toward a skill point` : 'Score a C or better to earn training points.'),
      h('button.btn.primary.block', { onclick: () => { m.close(); onDone(q); } }, 'Done'));
  };
  const intro = (title, how, startFn) => {
    clear(box);
    box.append(h('div.kicker.pix', 'Training drill'), h('h2', title), h('p.small.muted', how),
      h('button.btn.primary.block', { style: { marginTop: '12px' }, onclick: () => { sfx.whistle(); cleanup = startFn(); } }, 'Start'),
      h('button.btn.ghost.block', { style: { marginTop: '6px' }, onclick: () => m.close() }, 'Skip (normal gains)'));
  };
  if (kind === 'sprint') intro('Sprint Ladder', 'Alternate LEFT and RIGHT as fast as you can for 5 seconds. Keyboard: ← → or A D.', () => sprint(box, finish));
  else if (kind === 'reps') intro('Power Reps', 'Stop the bar inside the green zone. 6 reps, and the zone shrinks every time. Keyboard: Space.', () => reps(box, finish));
  else if (kind === 'cones') intro('Cone Reaction', 'Tap the lit cone as fast as you can. 12 cones.', () => cones(box, finish));
  else intro('Film Room', 'Find the OPEN receiver (the one with the most space) before time runs out. 6 plays.', () => film(box, finish));
  return m;
}

// ------------------------------------------------------------------ sprint ladder
function sprint(box, finish) {
  clear(box);
  let taps = 0;
  let last = null;
  let t0 = null;
  const DUR = 5000;
  const bar = h('i');
  const runner = h('div.sprint-runner');
  const timer = h('b.pix', '5.0');
  const step = (side) => {
    if (last === side) { runner.classList.add('stumble'); setTimeout(() => runner.classList.remove('stumble'), 120); return; }
    if (t0 === null) t0 = performance.now();
    last = side;
    taps++;
    sfx.tick();
    runner.style.left = `${Math.min(92, taps * 1.9)}%`;
    runner.classList.toggle('alt');
    bar.style.width = `${Math.min(100, (taps / 48) * 100)}%`;
  };
  const L = h('button.btn.drill-pad', { onpointerdown: (e) => { e.preventDefault(); step('L'); } }, 'LEFT');
  const R = h('button.btn.drill-pad', { onpointerdown: (e) => { e.preventDefault(); step('R'); } }, 'RIGHT');
  box.append(h('div.row.between', h('span.pix.small', 'SPRINT LADDER'), timer), h('div.sprint-track', runner), h('div.watch-bar', bar), h('div.row', { style: { marginTop: '12px' } }, L, R));
  const key = (e) => { if (['ArrowLeft', 'a', 'A'].includes(e.key)) step('L'); if (['ArrowRight', 'd', 'D'].includes(e.key)) step('R'); };
  window.addEventListener('keydown', key);
  const iv = setInterval(() => {
    if (t0 === null) return;
    const left = Math.max(0, DUR - (performance.now() - t0));
    timer.textContent = (left / 1000).toFixed(1);
    if (left <= 0) { clearInterval(iv); window.removeEventListener('keydown', key); finish(Math.min(1, taps / 48)); }
  }, 50);
  return () => { clearInterval(iv); window.removeEventListener('keydown', key); };
}

// ------------------------------------------------------------------ power reps
function reps(box, finish) {
  clear(box);
  const N = 6;
  let rep = 0;
  let score = 0;
  let pos = 0;
  let dir = 1;
  let raf = 0;
  const zone = h('div.reps-zone');
  const marker = h('div.reps-marker');
  const lift = h('div.reps-lifter', h('i'));
  const label = h('b.pix', `REP 1/${N}`);
  const setZone = () => {
    const w = 26 - rep * 3.2;
    const c = 18 + Math.random() * (64 - w);
    zone.style.left = `${c}%`;
    zone.style.width = `${w}%`;
    zone.dataset.a = c;
    zone.dataset.b = c + w;
  };
  setZone();
  const press = () => {
    const a = Number(zone.dataset.a);
    const b = Number(zone.dataset.b);
    const mid = (a + b) / 2;
    if (pos >= a && pos <= b) { score += 1 - Math.abs(pos - mid) / ((b - a) / 2) * 0.35; sfx.catch(); lift.classList.add('up'); }
    else { sfx.error?.(); lift.classList.add('fail'); }
    setTimeout(() => lift.classList.remove('up', 'fail'), 260);
    rep++;
    if (rep >= N) { cancelAnimationFrame(raf); window.removeEventListener('keydown', key); finish(Math.max(0, score / N)); return; }
    label.textContent = `REP ${rep + 1}/${N}`;
    setZone();
  };
  const btn = h('button.btn.primary.block.drill-pad', { onpointerdown: (e) => { e.preventDefault(); press(); } }, 'LIFT!');
  const key = (e) => { if (e.code === 'Space') { e.preventDefault(); press(); } };
  window.addEventListener('keydown', key);
  box.append(h('div.row.between', h('span.pix.small', 'POWER REPS'), label), lift, h('div.reps-track', zone, marker), h('div', { style: { marginTop: '12px' } }, btn));
  let lastT = performance.now();
  const loop = (now) => {
    const dt = (now - lastT) / 1000;
    lastT = now;
    pos += dir * dt * (70 + rep * 14);
    if (pos > 100) { pos = 100; dir = -1; }
    if (pos < 0) { pos = 0; dir = 1; }
    marker.style.left = `${pos}%`;
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', key); };
}

// ------------------------------------------------------------------ cone reaction
function cones(box, finish) {
  clear(box);
  const N = 12;
  let n = 0;
  let total = 0;
  let litAt = 0;
  let lit = -1;
  let timer = 0;
  const label = h('b.pix', `0/${N}`);
  const grid = h('div.cone-grid');
  const cells = [];
  for (let i = 0; i < 9; i++) {
    const c = h('button.cone', { onpointerdown: (e) => { e.preventDefault(); hit(i); } }, h('i'));
    cells.push(c);
    grid.append(c);
  }
  const next = () => {
    if (lit >= 0) cells[lit].classList.remove('on');
    let k;
    do k = Math.floor(Math.random() * 9); while (k === lit);
    lit = k;
    timer = setTimeout(() => { cells[lit].classList.add('on'); litAt = performance.now(); }, 200 + Math.random() * 500);
  };
  const hit = (i) => {
    if (i !== lit || !cells[i].classList.contains('on')) { total += 0.35; sfx.click(); return; }
    total += (performance.now() - litAt) / 1000;
    sfx.tick();
    n++;
    label.textContent = `${n}/${N}`;
    if (n >= N) { cells[lit].classList.remove('on'); finish(Math.max(0, Math.min(1, 1.35 - (total / N) * 1.2))); return; }
    next();
  };
  box.append(h('div.row.between', h('span.pix.small', 'CONE REACTION'), label), grid);
  next();
  return () => clearTimeout(timer);
}

// ------------------------------------------------------------------ film room
function film(box, finish) {
  clear(box);
  const N = 6;
  let round = 0;
  let score = 0;
  let deadline = 0;
  let iv = 0;
  const label = h('b.pix', `PLAY 1/${N}`);
  const clock = h('div.watch-bar', h('i'));
  const field = h('div.film-field');
  const show = () => {
    clear(field);
    const open = Math.floor(Math.random() * 4);
    const xs = [12, 36, 62, 86];
    xs.forEach((x, i) => {
      const y = 22 + Math.random() * 40;
      const gap = i === open ? 13 + Math.random() * 6 : 3 + Math.random() * 4.5;
      const ang = Math.random() * Math.PI * 2;
      field.append(
        h('button.film-wr', { style: { left: `${x}%`, top: `${y}%` }, onpointerdown: (e) => { e.preventDefault(); pick(i === open); } }, String(i + 1)),
        h('i.film-db', { style: { left: `${x + Math.cos(ang) * gap * 0.8}%`, top: `${y + Math.sin(ang) * gap}%` } }));
    });
    field.append(h('i.film-qb', { style: { left: '50%', top: '88%' } }));
    deadline = performance.now() + Math.max(1700, 3200 - round * 250);
  };
  const pick = (ok) => {
    if (ok) { score++; sfx.catch(); field.classList.add('good'); } else { sfx.click(); field.classList.add('bad'); }
    setTimeout(() => field.classList.remove('good', 'bad'), 220);
    round++;
    if (round >= N) { clearInterval(iv); finish(score / N); return; }
    label.textContent = `PLAY ${round + 1}/${N}`;
    show();
  };
  box.append(h('div.row.between', h('span.pix.small', 'FILM ROOM'), label), field, clock);
  show();
  iv = setInterval(() => {
    const left = deadline - performance.now();
    clock.firstChild.style.width = `${Math.max(0, left / 32)}%`;
    if (left <= 0) pick(false);
  }, 50);
  return () => clearInterval(iv);
}

// ------------------------------------------------------------------ in-game event challenges

/**
 * One-shot clutch challenge for a risky in-game choice.
 * kind 'timing': stop the sweeping marker in the zone (zone size from the odds p).
 * kind 'mash': tap as fast as you can before time runs out.
 * onDone(success:boolean)
 */
export function clutchChallenge({ title, kind = 'timing', p = 0.5 }, onDone) {
  const box = h('div.drill');
  const m = openModal(box, { dismissable: false });
  let stop = null;
  const end = (ok) => {
    stop?.();
    clear(box);
    if (ok) sfx.cheer(); else sfx.error?.();
    box.append(h('div.drill-grade.pix', { style: { color: ok ? 'var(--good)' : 'var(--bad)' } }, ok ? 'YES!' : 'NO!'),
      h('button.btn.primary.block', { onclick: () => { m.close(); onDone(ok); } }, 'Continue'));
  };
  if (kind === 'mash') {
    const need = Math.round(22 - p * 10);
    let taps = 0;
    let left = 3000;
    const bar = h('i');
    const tm = h('b.pix', '3.0');
    const tap = () => { taps++; sfx.tick(); bar.style.width = `${Math.min(100, (taps / need) * 100)}%`; if (taps >= need) end(true); };
    const btn = h('button.btn.primary.block.drill-pad', { onpointerdown: (e) => { e.preventDefault(); tap(); } }, 'TAP TAP TAP!');
    const key = (e) => { if (e.code === 'Space') { e.preventDefault(); tap(); } };
    window.addEventListener('keydown', key);
    box.append(h('div.kicker.pix', title), h('div.row.between', h('span.small', `Tap ${need} times!`), tm), h('div.watch-bar', bar), btn);
    const t0 = performance.now();
    const iv = setInterval(() => { left = 3000 - (performance.now() - t0); tm.textContent = Math.max(0, left / 1000).toFixed(1); if (left <= 0) end(false); }, 50);
    stop = () => { clearInterval(iv); window.removeEventListener('keydown', key); };
    return m;
  }
  // timing
  const w = Math.max(8, Math.min(40, p * 42));
  const a = 15 + Math.random() * (70 - w);
  const zone = h('div.reps-zone', { style: { left: `${a}%`, width: `${w}%` } });
  const marker = h('div.reps-marker');
  let pos = 0;
  let dir = 1;
  let raf = 0;
  let last = performance.now();
  const press = () => end(pos >= a && pos <= a + w);
  const btn = h('button.btn.primary.block.drill-pad', { onpointerdown: (e) => { e.preventDefault(); press(); } }, 'NOW!');
  const key = (e) => { if (e.code === 'Space') { e.preventDefault(); press(); } };
  window.addEventListener('keydown', key);
  box.append(h('div.kicker.pix', title), h('p.small.muted', 'Stop the marker in the green zone!'), h('div.reps-track', zone, marker), btn);
  const loop = (now) => {
    pos += dir * ((now - last) / 1000) * 95;
    last = now;
    if (pos > 100) { pos = 100; dir = -1; }
    if (pos < 0) { pos = 0; dir = 1; }
    marker.style.left = `${pos}%`;
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  stop = () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', key); };
  return m;
}
