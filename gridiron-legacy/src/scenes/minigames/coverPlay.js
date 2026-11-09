// Cornerback coverage: shadow the receiver, then break on the ball.
//
// Controls: drag anywhere (or arrow keys) to steer your corner. When the ball is thrown,
// tap BREAK (or Space) right before it arrives to jump the route.
// Stats: Speed = keeping up, IQ = route hint before his break, Skill = break window, Strength = tackling.
import * as THREE from 'three';
import { makePlayer, animateRun, makeBall, makeRing, faceToward, knockDown, setPose, setHop, playAction, celebrate, setBackpedal, confetti } from '../actors.js';
import { bindInput, maybeTip, rig, endPlay, finalize, dist2, hudMeter } from './common.js';
import { sfx } from '../../audio/sfx.js';

// Receiver routes he might run (depth, direction after the break).
const ROUTES = [
  { name: 'Slant', depth: 3, dir: { x: -1, z: -1 } },
  { name: 'Out', depth: 6, dir: { x: 1, z: 0 } },
  { name: 'Curl', depth: 10, dir: { x: -0.3, z: 1 }, sit: 0.4 },
  { name: 'Dig', depth: 11, dir: { x: -1, z: -0.1 } },
  { name: 'Post', depth: 12, dir: { x: -0.6, z: -1 } },
  { name: 'Go', depth: 6, dir: { x: 0.08, z: -1 } },
  { name: 'Comeback', depth: 14, dir: { x: 0.8, z: 1 }, sit: 0.5 },
];

export function coverPlay(ctx) {
  const { group, camera, hud, opts } = ctx;
  const m = opts.moment;
  const st = opts.stats;
  const tol = opts.tolerance;
  const call = opts.call;
  const mine = opts.teamColors;
  const them = opts.oppColors;
  // The offense attacks toward -z; we defend.
  const startX = 11;
  const cushion = call === 'safe' ? 7 : call === 'risky' ? 1.5 : 4.5;
  const routePool = call === 'risky' ? ROUTES.filter((r) => r.depth >= 6) : call === 'safe' ? ROUTES.filter((r) => r.depth <= 11) : ROUTES;
  const route = routePool[Math.floor(Math.random() * routePool.length)];

  const wr = makePlayer(them);
  const wp = { x: startX, z: 0 };
  wr.position.set(wp.x, 0, 0);
  group.add(wr);
  const qb = makePlayer(them);
  qb.position.set(0, 0, 5);
  group.add(qb);
  for (let i = 0; i < 5; i++) {
    const o = makePlayer(them);
    o.position.set(-4 + i * 2, 0, 1);
    group.add(o);
    const d = makePlayer(mine);
    d.position.set(-4 + i * 2, 0, -1);
    faceToward(d, -4 + i * 2, 5);
    group.add(d);
  }
  const cb = makePlayer(mine, { highlight: true });
  const cp = { x: startX + 0.4, z: Math.max(-cushion, -m.yardLine - 8) };
  cb.position.set(cp.x, 0, cp.z);
  faceToward(cb, cp.x, 5);
  group.add(cb);

  const hint = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.8, 3), new THREE.MeshBasicMaterial({ color: '#60a5fa', transparent: true, opacity: 0.9 }));
  hint.rotation.x = -Math.PI / 2;
  hint.visible = false;
  group.add(hint);
  const ball = makeBall();
  ball.visible = false;
  group.add(ball);
  group.add(ball.userData.shadow);
  const landRing = makeRing('#ffd43b', 0.8, 1.05, 0.95);
  landRing.visible = false;
  group.add(landRing);

  const btns = document.createElement('div');
  btns.className = 'hud-pad';
  btns.innerHTML = '<button class="hbtn big" data-a="break">BREAK</button>';
  const sepM = hudMeter('Coverage');
  sepM.el.className = 'hud-meter-solo';
  const wrap = document.createElement('div');
  wrap.className = 'hud-stack';
  wrap.append(sepM.el, btns);
  hud.bottom(wrap);

  const vCB = 7.0 + (st.speed / 100) * 2.6;
  const vWR = 8.4 + Math.random() * 0.6;
  const reactLag = 0.32 - (st.iq / 100) * 0.18;
  const breakWindow = (0.16 + (st.skill / 100) * 0.12) * tol;
  let phase = 'wait';
  let t = 0;
  let wdir = { x: 0, z: -1 };
  let broke = false;
  let breakT = 0;
  let sitT = 0;
  let steer = null; // target point from the pointer
  const keys = {};
  let flight = null;
  let breakTap = null;
  let after = null;
  let fx = null;
  const throwDelay = route.depth <= 6 ? 0.25 : 0.45;

  rig(camera, startX * 0.6, -6, 0, { zoom: 1.05, snap: true });

  const doBreak = () => {
    if (phase === 'flight' && breakTap === null) {
      breakTap = t;
      sfx.juke();
      setPose(cb, 'dive');
      const b = btns.querySelector('.hbtn');
      b.classList.add('on');
    }
  };
  btns.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); doBreak(); });
  bindInput(ctx, {
    down: (ev, pt) => { if (pt) steer = { x: pt.x, z: pt.z }; },
    move: (ev, pt) => { if (steer && pt) steer = { x: pt.x, z: pt.z }; },
    up: () => { steer = null; },
    key: (ev, down) => { keys[ev.key] = down; if (down && ev.key === ' ') doBreak(); },
  });

  maybeTip(ctx, 'Cornerback', [
    'Stay with the receiver: drag on the field (or use arrow keys) to steer your corner.',
    'A blue arrow hints at the receiver\'s break (higher Football IQ shows it earlier).',
    'When the ball is thrown, tap BREAK right before it arrives. Perfect timing = interception.',
  ], () => { phase = 'pre'; hud.instr(call === 'risky' ? 'Press coverage: jam the receiver!' : call === 'safe' ? 'Soft coverage: keep him in front' : 'Mirror the receiver'); });

  const finish = (r) => { if (phase === 'over') return; phase = 'over'; endPlay(ctx, finalize({ ...r, defense: true }, m)); };

  return (dt) => {
    if (phase === 'wait' || phase === 'over') { if (fx && !fx(dt)) fx = null; return; }
    t += dt;
    if (fx && !fx(dt)) fx = null;
    if (phase === 'pre') {
      if (t > 0.5) { phase = 'live'; t = 0; sfx.whistle(); hud.instr(''); }
      return;
    }

    // Receiver runs his route.
    if (!after) {
      let sp = vWR * Math.min(1, t / 0.35 + 0.2);
      if (call === 'risky' && t < 0.5 && dist2(cp, wp) < 1.6) sp *= 0.5; // jam at the line
      if (!broke && -wp.z >= route.depth) {
        broke = true;
        breakT = t;
        const L = Math.hypot(route.dir.x, route.dir.z);
        wdir = { x: route.dir.x / L, z: route.dir.z / L };
      }
      if (broke && route.sit) { sitT += dt; if (sitT > route.sit) sp *= 0.15; }
      wp.x = Math.max(-25.5, Math.min(25.5, wp.x + wdir.x * sp * dt));
      wp.z = Math.max(-m.yardLine - 9, wp.z + wdir.z * sp * dt);
      wr.position.set(wp.x, 0, wp.z);
      faceToward(wr, wp.x + wdir.x, wp.z + wdir.z);
      animateRun(wr, dt, sp);
    }
    // IQ hint: shows the break direction a moment before he cuts.
    const hintLead = (st.iq / 100) * 0.6;
    const timeToBreak = (route.depth + wp.z) / vWR;
    if (!broke && timeToBreak < hintLead + 0.05 && phase === 'live') {
      hint.visible = true;
      hint.position.set(wp.x + route.dir.x * 2, 0.1, wp.z - 1 + route.dir.z * 2);
      hint.rotation.z = Math.atan2(route.dir.x, -route.dir.z) + Math.PI;
    } else hint.visible = false;

    // Your corner: steer toward the pointer / keys, with reaction lag to his break.
    if (!after) {
      let tx = cp.x;
      let tz = cp.z;
      if (steer) { tx = steer.x; tz = steer.z; }
      else {
        const k = 1;
        if (keys.ArrowLeft) tx -= k * 3;
        if (keys.ArrowRight) tx += k * 3;
        if (keys.ArrowUp) tz -= k * 3;
        if (keys.ArrowDown) tz += k * 3;
        if (!keys.ArrowLeft && !keys.ArrowRight && !keys.ArrowUp && !keys.ArrowDown) {
          // No input: drift with the receiver at a cushion, reacting late to his break.
          const lagging = broke && t - breakT < reactLag;
          const aim = lagging ? { x: wp.x, z: wp.z } : { x: wp.x + wdir.x * 0.5, z: wp.z - cushion * 0.35 };
          tx = aim.x; tz = aim.z;
        }
      }
      if (flight && breakTap !== null) { tx = flight.land.x; tz = flight.land.z; }
      const dx = tx - cp.x;
      const dz = tz - cp.z;
      const d = Math.hypot(dx, dz);
      const reacting = broke && t - breakT < reactLag * 0.6;
      const sp = Math.min(vCB * (reacting ? 0.4 : 1) * (breakTap !== null ? 1.15 : 1), d / Math.max(dt, 1e-3));
      if (d > 0.05) { cp.x += (dx / d) * sp * dt; cp.z += (dz / d) * sp * dt; }
      cb.position.set(cp.x, 0, cp.z);
      // Backpedal while bailing (moving away from the line), face the play.
      const pedal = dz < -0.1 && breakTap === null && !after;
      setBackpedal(cb, pedal);
      if (pedal) faceToward(cb, cp.x, cp.z + 5);
      else if (sp > 0.3) faceToward(cb, cp.x + dx, cp.z + dz);
      animateRun(cb, dt, sp);
    }
    const sep = dist2(cp, wp);
    sepM.set(Math.max(0, 1 - sep / 5), sep < 1.5 ? '#4ade80' : sep < 3 ? '#fbbf24' : '#f87171');

    // The QB throws after the break (or to a wide-open receiver).
    if (!flight && phase === 'live' && ((broke && t - breakT > throwDelay) || t > 3.2)) {
      const T = 0.75 + Math.min(1, Math.abs(wp.z) / 30) * 0.7;
      const lead = { x: wp.x + wdir.x * vWR * T * (route.sit ? 0.25 : 0.9), z: Math.max(-m.yardLine - 8, wp.z + wdir.z * vWR * T * (route.sit ? 0.25 : 0.9)) };
      flight = { from: { x: 0.4, z: 4.6 }, land: lead, T, t0: t };
      phase = 'flight';
      ball.visible = true;
      landRing.visible = true;
      landRing.position.set(lead.x, 0.05, lead.z);
      playAction(qb, ['throwWind', 'throwRelease', 'throwRelease'], { fps: 8 });
      faceToward(qb, lead.x, lead.z);
      sfx.throw();
      hud.instr('BREAK on the ball!');
    }
    if (flight && phase === 'flight') {
      const f = Math.min(1, (t - flight.t0) / flight.T);
      const bx = flight.from.x + (flight.land.x - flight.from.x) * f;
      const bz = flight.from.z + (flight.land.z - flight.from.z) * f;
      ball.position.set(bx, 2.2 + (1.4 - 2.2) * f + 4 * 3 * f * (1 - f), bz);
      ball.userData.shadow.position.set(bx, 0.04, bz);
      // Receiver adjusts to the ball late.
      if (f > 0.6) { wp.x += (flight.land.x - wp.x) * 0.15; wp.z += (flight.land.z - wp.z) * 0.15; }
      if (breakTap !== null) setHop(cb, Math.sin(Math.min(Math.PI, (t - breakTap) * 4)) * 0.8);
      if (f >= 1) resolve();
    }
    if (after) {
      after.time += dt;
      if (after.time < after.dur) {
        wp.z -= 8 * dt;
        wr.position.set(wp.x, 0, wp.z);
        animateRun(wr, dt, 8);
        ball.position.set(wp.x + 0.4, 1.4, wp.z);
        const dx = wp.x - cp.x;
        const dz = wp.z - cp.z;
        const d = Math.hypot(dx, dz) || 1;
        cp.x += (dx / d) * vCB * dt;
        cp.z += (dz / d) * vCB * dt;
        cb.position.set(cp.x, 0, cp.z);
        animateRun(cb, dt, vCB);
      } else if (!after.done) {
        after.done = true;
        if (after.result.tackle) { knockDown(wr, 1); sfx.hit(); ctx.shake(0.25); }
        finish(after.result);
      }
    }
    if (after?.pick) {
      // Interception return: run the other way.
      rig(camera, cp.x * 0.75, cp.z, dt, { zoom: 1.05, k: 3 });
    } else rig(camera, (cp.x + wp.x) * 0.4, Math.min(-4, (cp.z + wp.z) / 2), dt, { zoom: 1.05, k: 3 });
  };

  function resolve() {
    phase = 'resolved'; // stop re-resolving every frame
    landRing.visible = false;
    setHop(cb, 0);
    setPose(cb, null);
    const land = flight.land;
    const dC = dist2(cp, land);
    const dW = dist2(wp, land);
    const timing = breakTap === null ? 9 : Math.abs(flight.t0 + flight.T - breakTap - 0.15);
    const inReach = dC < 1.6 + tol * 0.4;
    let result;
    if (inReach && timing <= breakWindow && dC <= dW + 0.4) {
      // Jumped it.
      const intChance = (0.55 + (st.skill / 100) * 0.25) * (call === 'risky' ? 1.15 : call === 'safe' ? 0.8 : 1);
      if (Math.random() < intChance) {
        sfx.catch();
        setPose(cb, null);
        playAction(cb, ['jumpCatch', 'catchReach'], { fps: 5, then: null });
        setTimeout(() => celebrate(cb), 500);
        ball.visible = false;
        const pickSix = Math.random() < 0.1 + (st.speed / 100) * 0.1 + (call === 'risky' ? 0.08 : 0);
        if (pickSix) fx = confetti(ctx.scene, new THREE.Vector3(cp.x, 0, cp.z), [opts.teamColors[0], opts.teamColors[1], '#fff']);
        ctx.slowMo(0.6);
        return finish({ int: true, turnover: true, defTD: pickSix, quality: 0.95, text: pickSix ? 'PICK SIX!' : 'INTERCEPTED!' });
      }
      sfx.hit();
      return finish({ pd: true, quality: 0.75, yardsAllowed: 0, text: 'Swatted away!' });
    }
    if (inReach && (timing <= breakWindow * 2.2 || dC < 0.9)) {
      sfx.hit();
      return finish({ pd: true, quality: 0.6, yardsAllowed: 0, text: 'Broken up!' });
    }
    if (breakTap !== null && timing > breakWindow * 2.2 && breakTap < flight.t0 + flight.T - 0.3 && dC > 2.5) {
      // Guessed wrong and bit hard: bigger play.
      sfx.catch();
      const yac = 6 + Math.random() * 10;
      const res = finalize({ caught: true, defense: true, quality: 0.1, yardsAllowed: -land.z + yac, text: 'You bit on it. Big gain.' }, m);
      after = { time: 0, dur: Math.min(1.2, yac / 8), result: { ...res, tackle: !res.tdAllowed } };
      return;
    }
    // Caught in front of you: make the tackle.
    sfx.catch();
    const tackleQ = Math.max(0, 1 - dC / 5) * (0.7 + st.strength / 300);
    const yac = Math.max(0, (1 - tackleQ) * 8 + Math.random() * 2);
    const res = finalize({ caught: true, defense: true, quality: 0.2 + tackleQ * 0.35, yardsAllowed: -land.z + yac, text: `Caught. You make the tackle after ${Math.round(yac)} more.` }, m);
    after = { time: 0, dur: Math.max(0.15, yac / 8), result: { ...res, tackle: !res.tdAllowed } };
  }
}
