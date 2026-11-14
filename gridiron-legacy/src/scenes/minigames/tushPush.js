// Tush push: 3rd/4th and inches (or a yard from the end zone). The QB sneaks under center and the backs
// shove him from behind into the pile. Tap as fast as you can: your taps drive the pile, their D-line
// surges back. Get the ball past the line to gain.
// You are the QB (carrying) or, as a running back, one of the pushers behind him.
// Stats: Strength = push per tap. Opponent strength and the call set how hard they push back.
import * as THREE from 'three';
import { makePlayer, animateRun, faceToward, knockDown, setPose, celebrate, playAction, dustPuff } from '../actors.js';
import { bindInput, maybeTip, endPlay, finalize, hudMeter, withPlays, routineQ } from './common.js';
import { sfx } from '../../audio/sfx.js';

function tushPushGame(ctx) {
  const { group, camera, hud, opts } = ctx;
  const m = opts.moment;
  const st = opts.stats;
  const call = opts.call;
  const pusherUser = !!m.pusher; // RB: you're the one shoving
  const need = Math.min(m.distance, m.yardLine); // yards to the sticks (or the goal line)
  const goal = m.yardLine <= m.distance;

  const mk = (colors, extra) => makePlayer(colors, extra);
  const qb = mk(opts.teamColors, pusherUser ? { uniform: opts.teamUniform, number: 7 } : { highlight: true, look: opts.look, number: opts.number, uniform: opts.teamUniform });
  qb.position.set(0, 0, 1.15);
  group.add(qb);
  // the pushers: two backs right behind the QB (you're the left one when you're the RB)
  const pushers = [-0.45, 0.45].map((x, i) => {
    const p = pusherUser && i === 0 ? mk(opts.teamColors, { highlight: true, look: opts.look, number: opts.number, uniform: opts.teamUniform }) : mk(opts.teamColors, { uniform: opts.teamUniform, number: 30 + i * 4 });
    p.position.set(x, 0, 2.05);
    group.add(p);
    return p;
  });
  const ol = [];
  const dl = [];
  for (let i = 0; i < 7; i++) {
    const x = (i - 3) * 1.05;
    const o = mk(opts.teamColors, { uniform: opts.teamUniform, number: 60 + i });
    o.position.set(x, 0, 0.55);
    group.add(o);
    ol.push(o);
    const d = mk(opts.oppColors, { uniform: opts.oppUniform, number: 90 + i });
    d.position.set(x * 1.05, 0, -0.6);
    faceToward(d, x, 5);
    group.add(d);
    dl.push(d);
  }
  // linebackers stacked in the gaps, ready to fill
  const lbs = [-1.6, 0, 1.6].map((x) => { const l = mk(opts.oppColors, { uniform: opts.oppUniform, number: 50 }); l.position.set(x, 0, -2.6); faceToward(l, x, 5); group.add(l); return l; });
  for (const p of [...ol, ...dl]) setPose(p, 'stance');
  setPose(qb, 'stance');
  for (const p of pushers) setPose(p, 'stance');

  // line to gain: a yellow stripe across the field
  const lineMat = new THREE.MeshBasicMaterial({ color: goal ? 0xffffff : 0xffd43b, transparent: true, opacity: 0.85, depthWrite: false });
  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(14, 0.14), lineMat);
  stripe.rotation.x = -Math.PI / 2;
  stripe.position.set(0, 0.025, -need);
  group.add(stripe);
  ctx.addCleanup(() => { stripe.geometry.dispose(); lineMat.dispose(); });

  const pushM = hudMeter(pusherUser ? 'Your shove' : 'Your push');
  const progM = hudMeter(goal ? 'To the goal line' : 'To the sticks');
  const box = document.createElement('div');
  box.className = 'hud-meters';
  box.append(pushM.el, progM.el);
  hud.bottom(box);
  const tapsEl = document.createElement('div');
  tapsEl.className = 'tush-taps';
  hud.el.append(tapsEl);
  ctx.addCleanup(() => tapsEl.remove());

  // Tuning: an average thumb (~7 taps/s) at average strength just about moves the pile a yard in 3 seconds.
  const R = opts.routine ?? {};
  const dur = 3.0 + (R.durAdd ?? 0);
  const perTap = (R.tapK ?? 1) * (0.13 + (st.strength / 100) * 0.07) * (call === 'risky' ? 1.12 : call === 'safe' ? 0.94 : 1);
  const defBase = (R.defK ?? 1) * (call === 'safe' ? 0.66 : call === 'risky' ? 0.86 : 0.76) * (1 + (opts.oppStrength ?? 0) * 0.1) * (opts.hurt ? 1 / opts.hurt : 1);
  let phase = 'wait';
  let t = 0;
  let adv = 0; // yards the ball has gone (+ = forward)
  let taps = [];
  let tapCount = 0;
  let surge = 0; // their D-line fires off: a few tenths of a second of extra push
  let nextSurge = 0.9 + Math.random() * 0.6;
  let endT = 0;
  let outcome = null;

  // low side-on camera: you can see the pile and the line to gain
  const camAt = (dt, snap) => {
    const a = snap ? 1 : 1 - Math.exp(-3 * dt);
    const tx = 11.5, ty = 5.2, tz = -need * 0.4 + 3.4 - adv * 0.5;
    camera.position.x += (tx - camera.position.x) * a;
    camera.position.y += (ty - camera.position.y) * a;
    camera.position.z += (tz - camera.position.z) * a;
    camera.lookAt(0.6, 0.4, -need * 0.45 - adv * 0.6 + 0.4);
  };
  camAt(0, true);

  let snapBtn = null;
  const goPush = () => {
    snapBtn?.remove();
    phase = 'push'; t = 0;
    sfx.whistle();
    hud.instr(pusherUser ? 'TAP TAP TAP! Shove him over!' : 'TAP TAP TAP! Push the pile!');
    for (const p of [...ol, ...dl]) setPose(p, 'block');
    setPose(qb, 'tackle');
    for (const p of pushers) setPose(p, 'block');
    for (const l of lbs) setPose(l, 'tackle');
    sfx.hit(); ctx.shake(0.3);
    ctx.hype?.(0.8, 3);
  };
  const tap = () => {
    if (phase === 'presnap') { if (t > 0.3) goPush(); return; }
    if (phase !== 'push') return;
    taps.push(t);
    tapCount++;
    sfx.tick();
    if (tapCount % 4 === 0) ctx.shake(0.05);
    tapsEl.textContent = `${tapCount}`;
    tapsEl.classList.remove('pop'); void tapsEl.offsetWidth; tapsEl.classList.add('pop');
  };
  bindInput(ctx, { down: () => tap(), key: (ev, down) => { if (down && (ev.key === ' ' || ev.key === 'Enter')) tap(); } });

  maybeTip(ctx, 'Tush Push', [
    pusherUser ? 'Short yardage: your QB sneaks it and you shove him from behind.' : 'Short yardage: you sneak it and your backs shove you from behind.',
    'Tap as fast as you can. Their D-line surges back, so don\'t stop. Get the ball past the yellow line.',
  ], () => {
    phase = 'presnap'; t = 0;
    hud.instr(goal ? 'A yard from the end zone. SNAP when ready' : 'Short yardage. SNAP when ready');
    snapBtn = document.createElement('button');
    snapBtn.className = 'fc-btn big gold gl-snap';
    snapBtn.innerHTML = '<b>SNAP</b><small>Space</small>';
    snapBtn.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); goPush(); });
    hud.el.append(snapBtn);
    ctx.addCleanup(() => snapBtn?.remove());
  });

  const finish = (r) => { phase = 'over'; endPlay(ctx, finalize({ ...r, quality: routineQ(opts, r.quality) }, m), { delay: 1500 }); };

  const lean = (p, z0, k = 1) => { p.position.z = z0 - adv * k; };

  return (dt) => {
    if (phase === 'presnap') { t += dt; if (t > 15) goPush(); for (const p of [qb, ...pushers, ...ol, ...dl, ...lbs]) animateRun(p, dt, 0); camAt(dt); return; }
    if (phase === 'wait') { for (const p of [qb, ...pushers, ...ol, ...dl, ...lbs]) animateRun(p, dt, 0); return; }
    t += dt;
    if (phase === 'push') {
      // tap rate over the last 0.6 s, then push vs. push
      taps = taps.filter((x) => t - x < 0.6);
      const rate = taps.length / Math.min(0.6, Math.max(0.15, t));
      if (t > nextSurge) { surge = 0.35; nextSurge = t + 0.8 + Math.random() * 0.7; hud.big('THEY SURGE!', '#f87171', 450); sfx.hit(); }
      if (surge > 0) surge -= dt;
      const def = defBase * (surge > 0 ? 1.9 * (R.surgeK ?? 1) : 1) * (t < (R.early ?? 0.25) ? 0.4 : 1);
      const v = rate * perTap - def;
      adv = Math.max(-0.8, Math.min(need + 1.6, adv + v * dt * 0.9));
      pushM.set(Math.min(1, rate / 11), rate > 8 ? '#4ade80' : rate > 5 ? '#fbbf24' : '#f87171');
      progM.set(Math.max(0, adv / need), adv >= need ? '#4ade80' : '#60a5fa');
      // the pile moves together; legs churn harder the faster you tap
      const churn = 1.2 + Math.min(4, rate * 0.4);
      ol.forEach((o) => { lean(o, 0.55); animateRun(o, dt, churn); });
      dl.forEach((d, i) => { lean(d, -0.6); d.position.x = (i - 3) * 1.1 + Math.sin(t * 7 + i) * 0.04; animateRun(d, dt, churn); });
      lbs.forEach((l, i) => { l.position.z += ((-1.3 - adv) - l.position.z) * Math.min(1, dt * 3); l.position.x += ((i - 1) * 0.6 - l.position.x) * dt * 2; animateRun(l, dt, 2); });
      lean(qb, 1.15, 1.02); animateRun(qb, dt, churn);
      pushers.forEach((p) => { lean(p, 2.05, 1.02); animateRun(p, dt, churn); });
      if (Math.random() < dt * rate * 0.15) dustPuff(group, { x: (Math.random() - 0.5) * 3, z: -adv + 0.3 }, 3);
      camAt(dt);
      if (t >= dur || adv >= need + 1.2) {
        phase = 'end'; endT = 0;
        const made = adv >= need;
        // a held-up QB stretches the ball out on the last push (Strength helps)
        const y = Math.max(-1, Math.round(adv + (made ? 0.4 : 0)));
        const fumbleP = (R.fumK ?? 1) * (call === 'risky' ? 0.05 : 0.015) * (made ? 0.3 : 1) * (pusherUser ? 0.5 : 1);
        if (Math.random() < fumbleP) outcome = { turnover: true, complete: false, yards: 0, quality: 0.05, text: 'FUMBLE in the pile!' };
        else if (made && goal) outcome = { complete: true, yards: m.yardLine, quality: 0.7 + Math.min(0.3, (adv - need) * 0.3), text: pusherUser ? 'You shove him over the goal line! TOUCHDOWN!' : 'Pushed over the top! TOUCHDOWN!' };
        else if (made) outcome = { complete: true, yards: Math.max(y, need), quality: 0.62 + Math.min(0.3, (adv - need) * 0.3), text: pusherUser ? 'You drive him past the sticks. First down!' : 'Tush push. First down!' };
        else outcome = { complete: true, yards: Math.max(0, Math.min(need - 1, y)), quality: Math.max(0.05, 0.12 + adv / need * 0.3), text: 'Stuffed! Short of the line.' };
        if (outcome.turnover || !made) { knockDown(qb, 1); sfx.groan?.(); ctx.shake(0.3); }
        else { setPose(qb, null); playAction(qb, 'spike'); sfx.cheer(); ctx.hype?.(1, 2.5); }
        for (const p of [...ol, ...dl, ...pushers, ...lbs]) setPose(p, null);
        dl.forEach((d) => { if (made && Math.random() < 0.5) knockDown(d, 1); });
      }
      return;
    }
    if (phase === 'end') {
      endT += dt;
      for (const p of [...ol, ...dl, ...pushers, ...lbs]) animateRun(p, dt, 0);
      camAt(dt);
      if (endT > 0.5 && outcome) {
        if (outcome.td || (outcome.complete && outcome.yards >= m.yardLine)) celebrate(pusherUser ? pushers[0] : qb);
        const o = outcome; outcome = null;
        finish(o);
      }
    }
  };
}

export const SNEAK_PLAYS = [
  { name: 'Tush Push', desc: 'The backs shove from behind. Tap like crazy.' },
  { name: 'Quick Count', desc: 'Snap it before they set. A head start, a shorter push.', early: 0.65, durAdd: -0.5 },
  { name: 'Wedge', desc: 'The line blocks inward. Their surges hit softer.', surgeK: 0.7 },
  { name: 'Power Push', desc: 'Everyone shoves harder. Easier to fumble in the pile.', tapK: 1.12, fumK: 1.8 },
  { name: 'Long Count', desc: 'More time to push, but they\'re ready for it.', durAdd: 0.6, defK: 1.08 },
];
export const tushPush = withPlays(tushPushGame, SNEAK_PLAYS, 'Pick your short-yardage play');
