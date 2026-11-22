// The playable combine: 40-yard dash, bench press, vertical jump and a position drill. Each returns perf 0..1
// (0.5 = what your ratings say) to onDone; the sim turns that into the official number.
import { h, clear } from '../dom.js';
import { openModal } from '../components.js';
import { sfx } from '../../audio/sfx.js';

export const COMBINE_TESTS = {
  forty: { name: '40-Yard Dash', how: 'Wait for GO (jumping early is a false start), then alternate LEFT and RIGHT as fast as you can. Keyboard: ← → or A D.' },
  bench: { name: 'Bench Press', how: '225 pounds, as many reps as you can in 12 seconds. Tap LIFT (or Space) fast to drive the bar up. Every rep gets heavier.' },
  vert: { name: 'Vertical Jump', how: 'Hold JUMP to load your legs, let go when the meter is in the green. Two tries, best one counts.' },
  drill: { name: 'Position Drill', how: 'Cut to each cone the moment it lights up. 10 cones, quick feet.' },
};

/** Open a test. base = your projected value (for the live display); onDone(perf). */
export function openCombineTest(id, { base, posLabel, title } = {}, onDone) {
  const box = h('div.drill.combine-game');
  const m = openModal(box, { dismissable: false });
  let cleanup = null;
  const done = (perf, line) => {
    cleanup?.();
    clear(box);
    if (perf >= 0.6) sfx.cheer?.(true); else sfx.click();
    box.append(h('div.kicker.pix', title ?? COMBINE_TESTS[id].name), h('div.drill-grade.pix', line), h('p.center.small.muted', title ? (perf >= 0.62 ? 'Huge score. The other all-stars are watching.' : perf <= 0.38 ? 'Not your best. The crowd still cheered.' : 'A solid score. Now it comes down to the others.') : perf >= 0.62 ? 'Scouts are scribbling. That beat your projection.' : perf <= 0.38 ? 'Under what they expected.' : 'Right about where they had you.'),
      h('button.btn.primary.block', { onclick: () => { m.close(); onDone(perf); } }, 'Done'));
  };
  const T = COMBINE_TESTS[id];
  clear(box);
  box.append(h('div.kicker.pix', title ? 'All-Star Skills Challenge' : 'The Combine'), h('h2', title ?? (id === 'drill' ? `${posLabel ?? ''} ${T.name}`.trim() : T.name)), h('p.small.muted', T.how),
    h('button.btn.primary.block', { style: { marginTop: '12px' }, onclick: () => { sfx.whistle(); cleanup = GAMES[id](box, done, base); } }, 'Start'));
  return m;
}

// ---------------------------------------------------------------- 40-yard dash
function forty(box, done, base) {
  clear(box);
  const NEED = 36; // alternating taps to cover 40 yards
  let taps = 0, last = null, t0 = null, goAt = null, fs = 0, over = false;
  const runner = h('div.sprint-runner');
  const light = h('div.cg-light', 'SET...');
  const clock = h('b.pix', '0.00');
  const track = h('div.sprint-track.cg-forty', runner, h('i.cg-finish'));
  const goTimer = { id: 0 };
  const arm = () => { light.className = 'cg-light'; light.textContent = 'SET...'; goAt = null; goTimer.id = setTimeout(() => { goAt = performance.now(); light.className = 'cg-light go'; light.textContent = 'GO!'; sfx.whistle(); }, 900 + Math.random() * 1600); };
  const step = (side) => {
    if (over) return;
    if (goAt === null) { // false start
      clearTimeout(goTimer.id); fs++; sfx.click(); light.className = 'cg-light bad'; light.textContent = 'FALSE START'; setTimeout(arm, 900); return;
    }
    if (last === side) { runner.classList.add('stumble'); setTimeout(() => runner.classList.remove('stumble'), 120); return; }
    if (t0 === null) t0 = goAt;
    last = side; taps++;
    sfx.tick();
    runner.style.left = `${Math.min(94, (taps / NEED) * 94)}%`;
    runner.classList.toggle('alt');
    if (taps >= NEED) {
      over = true;
      const t = (performance.now() - t0) / 1000;
      // 4.0 s of tapping is elite, 8 s is slow; each false start costs a little
      const perf = Math.max(0, Math.min(1, (8.2 - t) / 4.6 - fs * 0.08));
      const official = Math.max(4.18, base - (perf - 0.5) * 0.32);
      setTimeout(() => done(perf, `${official.toFixed(2)}s`), 300);
    }
  };
  const L = h('button.btn.drill-pad', { onpointerdown: (e) => { e.preventDefault(); step('L'); } }, 'LEFT');
  const R = h('button.btn.drill-pad', { onpointerdown: (e) => { e.preventDefault(); step('R'); } }, 'RIGHT');
  const key = (e) => { if (['ArrowLeft', 'a', 'A'].includes(e.key)) step('L'); if (['ArrowRight', 'd', 'D'].includes(e.key)) step('R'); };
  window.addEventListener('keydown', key);
  box.append(h('div.row.between', h('span.pix.small', '40-YARD DASH'), clock), light, track, h('div.row', { style: { marginTop: '12px' } }, L, R));
  const iv = setInterval(() => { if (t0 !== null && !over) clock.textContent = ((performance.now() - t0) / 1000).toFixed(2); }, 50);
  arm();
  return () => { clearInterval(iv); clearTimeout(goTimer.id); window.removeEventListener('keydown', key); };
}

// ---------------------------------------------------------------- bench press
function bench(box, done, base) {
  clear(box);
  const DUR = 12000;
  // average tapping (about 4.5 taps a second) lands right on your projected reps
  const perRep0 = Math.max(2, (4.5 * 12) / Math.max(4, base) * 0.8);
  let taps = 0, reps = 0, need = perRep0, prog = 0, t0 = null, over = false;
  const barFill = h('i');
  const repsEl = h('b.pix.cg-reps', '0');
  const clock = h('b.pix', '12.0');
  const lifter = h('div.cg-bench', h('div.cg-barbell'), h('div.cg-body'));
  const press = () => {
    if (over) return;
    if (t0 === null) t0 = performance.now();
    taps++; prog++;
    lifter.classList.add('push'); setTimeout(() => lifter.classList.remove('push'), 80);
    if (prog >= need) { reps++; prog = 0; need = perRep0 * (1 + reps * 0.035); repsEl.textContent = String(reps); sfx.catch(); }
    barFill.style.height = `${(prog / need) * 100}%`;
  };
  const btn = h('button.btn.primary.block.drill-pad', { onpointerdown: (e) => { e.preventDefault(); press(); } }, 'LIFT!');
  const key = (e) => { if (e.code === 'Space') { e.preventDefault(); press(); } };
  window.addEventListener('keydown', key);
  box.append(h('div.row.between', h('span.pix.small', 'BENCH PRESS · 225 LB'), clock), h('div.row', { style: { gap: '14px', alignItems: 'center', justifyContent: 'center' } }, lifter, h('div.cg-meter', barFill), h('div.center', repsEl, h('div.tiny.muted', 'REPS'))), h('div', { style: { marginTop: '12px' } }, btn));
  const iv = setInterval(() => {
    if (t0 === null || over) return;
    const left = Math.max(0, DUR - (performance.now() - t0));
    clock.textContent = (left / 1000).toFixed(1);
    if (left <= 0) {
      over = true;
      const perf = Math.max(0, Math.min(1, (reps / Math.max(1, base) - 0.75) / 0.5));
      done(perf, `${Math.max(1, Math.round(base * (1 + (perf - 0.5) * 0.5)))} reps`);
    }
  }, 50);
  return () => { clearInterval(iv); window.removeEventListener('keydown', key); };
}

// ---------------------------------------------------------------- vertical jump
function vert(box, done, base) {
  clear(box);
  let tries = 0, best = 0, holding = false, lvl = 0, dir = 1, raf = 0, lastT = 0;
  const fill = h('i');
  const zone = h('div.cg-vzone');
  const label = h('b.pix', 'TRY 1/2');
  const jumper = h('div.cg-jumper');
  const result = h('p.small.center', '');
  const zoneA = 70 + Math.random() * 12, zoneW = 9;
  zone.style.bottom = `${zoneA}%`; zone.style.height = `${zoneW}%`;
  const loop = (now) => {
    const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    if (holding) { lvl += dir * dt * 115; if (lvl > 100) { lvl = 100; dir = -1; } if (lvl < 0) { lvl = 0; dir = 1; } }
    fill.style.height = `${lvl}%`;
    jumper.style.transform = `translateY(${holding ? lvl * 0.12 : 0}px) scaleY(${holding ? 1 - lvl * 0.002 : 1})`;
    raf = requestAnimationFrame(loop);
  };
  const start = () => { if (tries >= 2 || holding) return; holding = true; lvl = 0; dir = 1; };
  const release = () => {
    if (!holding) return;
    holding = false; tries++;
    const mid = zoneA + zoneW / 2;
    const q = Math.max(0, 1 - Math.abs(lvl - mid) / 40);
    best = Math.max(best, q);
    const inches = Math.round((base + (q - 0.5) * 9) * 2) / 2;
    jumper.classList.add('jump'); setTimeout(() => jumper.classList.remove('jump'), 600);
    sfx[q > 0.8 ? 'catch' : 'tick']?.();
    result.textContent = `Try ${tries}: ${inches}"`;
    label.textContent = tries >= 2 ? 'DONE' : 'TRY 2/2';
    if (tries >= 2) setTimeout(() => done(best, `${Math.round((base + (best - 0.5) * 9) * 2) / 2}"`), 700);
  };
  const btn = h('button.btn.primary.block.drill-pad', { onpointerdown: (e) => { e.preventDefault(); start(); }, onpointerup: release, onpointerleave: release }, 'HOLD TO LOAD · LET GO TO JUMP');
  const kd = (e) => { if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) start(); } };
  const ku = (e) => { if (e.code === 'Space') release(); };
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
  box.append(h('div.row.between', h('span.pix.small', 'VERTICAL JUMP'), label), h('div.row', { style: { gap: '18px', justifyContent: 'center', alignItems: 'flex-end', height: '150px' } }, jumper, h('div.cg-meter.tall', fill, zone)), result, h('div', { style: { marginTop: '8px' } }, btn));
  lastT = performance.now(); raf = requestAnimationFrame(loop);
  return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
}

// ---------------------------------------------------------------- position drill (cone cuts)
function drill(box, done, base) {
  clear(box);
  const N = 10;
  let n = 0, total = 0, litAt = 0, lit = -1, timer = 0;
  const label = h('b.pix', `0/${N}`);
  const grid = h('div.cone-grid');
  const cells = [];
  for (let i = 0; i < 9; i++) { const c = h('button.cone', { onpointerdown: (e) => { e.preventDefault(); hit(i); } }, h('i')); cells.push(c); grid.append(c); }
  const next = () => {
    if (lit >= 0) cells[lit].classList.remove('on');
    let k; do k = Math.floor(Math.random() * 9); while (k === lit);
    lit = k;
    timer = setTimeout(() => { cells[lit].classList.add('on'); litAt = performance.now(); }, 150 + Math.random() * 400);
  };
  const hit = (i) => {
    if (i !== lit || !cells[i].classList.contains('on')) { total += 0.3; sfx.click(); return; }
    total += (performance.now() - litAt) / 1000;
    sfx.tick(); n++; label.textContent = `${n}/${N}`;
    if (n >= N) {
      cells[lit].classList.remove('on');
      const perf = Math.max(0, Math.min(1, 1.3 - (total / N) * 1.25));
      done(perf, `${Math.min(99, Math.max(20, Math.round(base + (perf - 0.5) * 22)))} grade`);
      return;
    }
    next();
  };
  box.append(h('div.row.between', h('span.pix.small', 'POSITION DRILL'), label), grid);
  next();
  return () => clearTimeout(timer);
}

const GAMES = { forty, bench, vert, drill };

// ---------------------------------------------------------------- commercial shoot
/** Say each line on your mark: tap ACTION (or Space) when the cursor is in the green. onDone(perf 0..1). */
export function openCommercial(brand, lines, onDone) {
  const box = h('div.drill.combine-game');
  const m = openModal(box, { dismissable: false });
  let raf = 0, idx = 0, score = 0, pos = 0, dir = 1, lastT = 0, zone = null, locked = false;
  const lineEl = h('div.cm-line');
  const takeEl = h('b.pix', '');
  const bar = h('div.cm-bar');
  const mark = h('div.cm-mark');
  const cur = h('div.cm-cur');
  bar.append(mark, cur);
  const setLine = () => {
    const w = 20 - idx * 3;
    zone = { a: 10 + Math.random() * (80 - w), w };
    mark.style.left = `${zone.a}%`; mark.style.width = `${zone.w}%`;
    lineEl.textContent = `"${lines[idx]}"`;
    takeEl.textContent = `LINE ${idx + 1}/${lines.length}`;
  };
  const press = () => {
    if (locked) return;
    const mid = zone.a + zone.w / 2;
    const q = Math.max(0, 1 - Math.abs(pos - mid) / (zone.w / 2 + 8));
    score += q;
    locked = true;
    lineEl.classList.add(q > 0.6 ? 'good' : 'bad');
    sfx[q > 0.6 ? 'catch' : 'click']?.();
    setTimeout(() => {
      lineEl.classList.remove('good', 'bad');
      locked = false;
      idx++;
      if (idx >= lines.length) { cleanup(); finish(score / lines.length); } else setLine();
    }, 650);
  };
  const key = (e) => { if (e.code === 'Space') { e.preventDefault(); press(); } };
  const cleanup = () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', key); };
  const finish = (perf) => {
    clear(box);
    box.append(h('div.kicker.pix', `${brand} commercial`), h('div.drill-grade.pix', perf >= 0.85 ? 'THAT\'S A WRAP!' : perf >= 0.5 ? 'GOOD TAKE' : 'ROUGH DAY'),
      h('p.center.small.muted', perf >= 0.85 ? 'The director is crying. This one is going viral.' : perf >= 0.5 ? 'Solid. The brand is happy.' : 'It took 40 takes, but they got something usable.'),
      h('button.btn.primary.block', { onclick: () => { m.close(); onDone(perf); } }, 'Done'));
  };
  const start = () => {
    clear(box);
    box.append(h('div.row.between', h('span.pix.small', `🎬 ${brand.toUpperCase()}`), takeEl), lineEl, bar,
      h('div', { style: { marginTop: '12px' } }, h('button.btn.primary.block.drill-pad', { onpointerdown: (e) => { e.preventDefault(); press(); } }, 'ACTION!')));
    setLine();
    window.addEventListener('keydown', key);
    lastT = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
      if (!locked) { pos += dir * dt * (80 + idx * 15); if (pos > 100) { pos = 100; dir = -1; } if (pos < 0) { pos = 0; dir = 1; } }
      cur.style.left = `${pos}%`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  };
  box.append(h('div.kicker.pix', 'Commercial shoot'), h('h2', brand), h('p.small.muted', 'Hit your mark on every line: tap ACTION (or Space) when the cursor is in the green. Each line the mark gets smaller.'),
    h('button.btn.primary.block', { style: { marginTop: '12px' }, onclick: () => { sfx.whistle(); start(); } }, 'Lights, camera...'));
  return m;
}
