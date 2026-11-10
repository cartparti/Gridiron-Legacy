// Goal-line dive: tap fast to drive the pile forward, then time your leap.
// Stats: Strength = push per tap, Skill = leap timing window.
import * as THREE from 'three';
import { makePlayer, animateRun, faceToward, knockDown, setPose, setHop, celebrate, confetti } from '../actors.js';
import { bindInput, maybeTip, rig, endPlay, finalize, hudMeter } from './common.js';
import { sfx } from '../../audio/sfx.js';

export function goalLine(ctx) {
  const { group, camera, hud, opts } = ctx;
  const m = opts.moment;
  const st = opts.stats;
  const tol = opts.tolerance;
  const call = opts.call;
  const off = opts.teamColors;
  const def = opts.oppColors;

  const runner = makePlayer(off, { highlight: true, look: opts.look, number: opts.number, uniform: opts.teamUniform });
  runner.position.set(0, 0, 4);
  group.add(runner);
  const ol = [];
  const dl = [];
  for (let i = 0; i < 7; i++) {
    const x = -6 + i * 2;
    const o = makePlayer(off, { uniform: opts.teamUniform });
    o.position.set(x, 0, 0.9);
    setPose(o, 'tackle');
    group.add(o);
    ol.push(o);
    const d = makePlayer(def, { uniform: opts.oppUniform });
    d.position.set(x, 0, -0.9);
    faceToward(d, x, 5);
    setPose(d, 'tackle');
    group.add(d);
    dl.push(d);
  }
  const pushM = hudMeter('Your push');
  const defM = hudMeter('Defense');
  const box = document.createElement('div');
  box.className = 'hud-meters';
  box.append(pushM.el, defM.el);
  hud.bottom(box);

  const dur = 2.2;
  const defRate = { safe: 0.34, balanced: 0.4, risky: 0.46 }[call];
  const perTap = 0.045 + (st.strength / 100) * 0.04;
  let push = 0;
  let defense = 0;
  let phase = 'wait';
  let t = 0;
  let marker = 0;
  let dirM = 1;
  let fx = null;
  const zone = Math.max(0.08, Math.min(0.32, 0.13 * tol * (0.8 + st.skill / 250)));
  let leap = null;

  rig(camera, 0, 0, 0, { zoom: 0.7, ahead: 4, snap: true });

  let snapBtn = null;
  const goPush = () => { snapBtn?.remove(); phase = 'push'; t = 0; sfx.whistle(); hud.instr('TAP TAP TAP! Drive the pile!'); };
  const tap = () => {
    if (phase === 'presnap') { if (t > 0.3) goPush(); return; }
    if (phase === 'push') {
      push = Math.min(1, push + perTap);
      sfx.tick();
      ctx.shake(0.06);
    } else if (phase === 'leap' && !leap) {
      const off = Math.abs(marker - 0.5) / (zone / 2);
      leap = { timing: Math.max(0, 1 - off * 0.5), t };
      sfx.juke();
    }
  };
  bindInput(ctx, { down: () => tap(), key: (ev, down) => { if (down && (ev.key === ' ' || ev.key === 'Enter')) tap(); } });

  maybeTip(ctx, 'Goal-Line Dive', [
    'Tap as fast as you can to drive the pile (Strength makes each tap count more).',
    'Then a marker swings across the bar: tap when it is in the green to leap over the top.',
  ], () => {
    // you snap the ball yourself
    phase = 'presnap'; t = 0;
    hud.instr('Goal line. Press SNAP when you are ready');
    snapBtn = document.createElement('button');
    snapBtn.className = 'fc-btn big gold gl-snap';
    snapBtn.innerHTML = '<b>SNAP</b><small>Space</small>';
    snapBtn.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); goPush(); });
    hud.el.append(snapBtn);
    ctx.addCleanup(() => snapBtn?.remove());
  });

  const finish = (r) => { phase = 'over'; endPlay(ctx, finalize(r, m)); };

  return (dt) => {
    if (phase === 'presnap') { t += dt; if (t > 15) goPush(); return; }
    if (phase === 'wait' || phase === 'over') { if (fx && !fx(dt)) fx = null; return; }
    t += dt;
    if (fx && !fx(dt)) fx = null;
    if (phase === 'push') {
      defense = Math.min(1, defense + defRate * dt);
      pushM.set(push);
      defM.set(defense, '#f87171');
      const lean = (push - defense) * 1.2;
      ol.forEach((o, i) => { o.position.z = 0.9 - lean; animateRun(o, dt, 3); });
      dl.forEach((d) => { d.position.z = -0.9 - lean; animateRun(d, dt, 3); });
      runner.position.z = 3 - lean * 0.5;
      animateRun(runner, dt, 2);
      if (t >= dur) {
        phase = 'leap';
        t = 0;
        hud.instr('LEAP! Tap in the green');
        const bar = document.createElement('div');
        bar.className = 'hud-timing';
        bar.innerHTML = `<div class="zone" style="left:${(0.5 - zone / 2) * 100}%;width:${zone * 100}%"></div><div class="mk"></div>`;
        hud.bottom(bar);
        leap = null;
        ctx.markerEl = bar.querySelector('.mk');
      }
      return;
    }
    if (phase === 'leap') {
      if (!leap) {
        marker += dirM * dt * (call === 'risky' ? 1.5 : 1.15);
        if (marker > 1) { marker = 1; dirM = -1; }
        if (marker < 0) { marker = 0; dirM = 1; }
        if (ctx.markerEl) ctx.markerEl.style.left = `calc(${marker * 100}% - 3px)`;
        if (t > 3) leap = { timing: 0, t };
        return;
      }
      const lt = t - leap.t;
      const pushRatio = push / Math.max(0.2, push + defense);
      const q = call === 'risky' ? leap.timing * 0.8 + pushRatio * 0.2 : leap.timing * 0.5 + pushRatio * 0.5;
      const success = q > 0.48;
      // Leap animation.
      setPose(runner, 'dive');
      runner.position.z = 3 - Math.min(1, lt * 1.6) * (success ? 5 : 3.2);
      setHop(runner, Math.sin(Math.min(Math.PI, lt * 3.2)) * (success ? 2.6 : 1.4));
      rig(camera, 0, runner.position.z, dt, { zoom: 0.7, ahead: 4 });
      if (lt > 1) {
        setHop(runner, 0);
        if (success) {
          setPose(runner, null);
          celebrate(runner);
          fx = confetti(ctx.scene, new THREE.Vector3(0, 0, -m.yardLine - 1), [opts.teamColors[0], opts.teamColors[1], '#fff']);
          return finish({ complete: true, yards: m.yardLine, quality: 0.6 + q * 0.4, text: 'Over the top! TOUCHDOWN!' });
        }
        knockDown(runner, 1);
        sfx.hit();
        ctx.shake(0.35);
        if (Math.random() < (call === 'risky' ? 0.12 : 0.03) * (1.2 - q)) return finish({ turnover: true, complete: false, yards: 0, quality: 0.05, text: 'FUMBLE at the goal line!' });
        return finish({ complete: true, yards: Math.max(0, Math.min(m.yardLine - 1, Math.round(q * 2))), quality: 0.15 + q * 0.4, text: 'Stuffed short of the goal line!' });
      }
    }
  };
}
