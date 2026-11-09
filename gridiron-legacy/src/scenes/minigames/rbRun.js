// Running back key moment: hit the hole, cut between lanes, juke defenders, break tackles.
//
// Controls
//   Touch/mouse: tap the left or right side of the screen (or swipe) to cut. Tap JUKE (or swipe up) to juke.
//   Keyboard:    ← / → (or A / D) to cut, Space (or ↑ / W) to juke.
//
// Stats: Speed = top speed, Skill = juke window, Strength = breaking tackles, Football IQ = seeing the hole.
import * as THREE from 'three';
import { makePlayer, animateRun, makeBall, knockDown, faceToward, confetti } from '../actors.js';
import { bindInput, maybeTip, follow, endPlay, finalize } from './common.js';
import { sfx } from '../../audio/sfx.js';

const LANES = [-4.2, -2.1, 0, 2.1, 4.2];

export function rbRun(ctx) {
  const { group, camera, hud, opts } = ctx;
  const m = opts.moment;
  const st = opts.stats;
  const tol = opts.tolerance;
  const call = opts.call;
  const off = opts.teamColors;
  const def = opts.oppColors;

  const cfg = {
    safe: { defSpeed: 6.4, lateral: 3.6, safeties: [-12], fumble: 0.01, hole: [1, 2, 3] },
    balanced: { defSpeed: 7.0, lateral: 4.2, safeties: [-15, -21], fumble: 0.03, hole: [0, 1, 2, 3, 4] },
    risky: { defSpeed: 7.6, lateral: 4.8, safeties: [-24], fumble: 0.06, hole: [0, 4] },
  }[call];
  const holeLane = cfg.hole[Math.floor(Math.random() * cfg.hole.length)];

  const runner = makePlayer(off, { highlight: true });
  runner.position.set(0, 0, 4.5);
  group.add(runner);
  const ball = makeBall();
  ball.scale.setScalar(0.9);
  runner.add(ball);
  ball.position.set(0.45, 1.35, -0.1);

  // Offensive line and defensive front. Defenders in the hole lane get pushed aside.
  const defenders = [];
  const addDef = (x, z, blockedFor) => {
    const d = makePlayer(def);
    d.position.set(x, 0, z);
    d.rotation.y = Math.PI;
    group.add(d);
    defenders.push({ mesh: d, x, z, blocked: blockedFor, down: false, downT: 0, speed: cfg.defSpeed * (0.92 + Math.random() * 0.16) });
  };
  const blockers = [];
  for (let i = 0; i < 5; i++) {
    const ol = makePlayer(off);
    ol.position.set(LANES[i], 0, 0.8);
    group.add(ol);
    blockers.push(ol);
  }
  for (let i = 0; i < 5; i++) {
    if (i === holeLane) continue;
    if (i % 2 === 1 && Math.random() < 0.3) continue;
    addDef(LANES[i] + (Math.random() - 0.5) * 0.4, -1, 1.3 + Math.random() * 0.9);
  }
  // Linebackers and safeties.
  const lbCount = call === 'safe' ? 2 : 3;
  for (let i = 0; i < lbCount; i++) addDef(LANES[Math.floor(Math.random() * 5)] + (Math.random() - 0.5), -6 - Math.random() * 3, 0.35 + Math.random() * 0.3);
  for (const z of cfg.safeties) addDef((Math.random() - 0.5) * 10, z - Math.random() * 3, 0.6);
  // Clamp anything placed beyond the end zone.
  for (const d of defenders) d.z = Math.max(d.z, -m.yardLine - 8);

  // Hole indicator: an arrow on the ground (clearer with higher IQ).
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.2, 3), new THREE.MeshBasicMaterial({ color: '#4ade80', transparent: true, opacity: 0.9 }));
  arrow.rotation.x = -Math.PI / 2;
  arrow.position.set(LANES[holeLane], 0.1, -1.2);
  group.add(arrow);
  const arrowTime = 0.6 + (st.iq / 100) * 1.8;

  // HUD juke button.
  const btns = document.createElement('div');
  btns.className = 'btns';
  btns.innerHTML = '<button class="hbtn" data-a="left">◀</button><button class="hbtn" data-a="juke">JUKE</button><button class="hbtn" data-a="right">▶</button>';
  hud.bottom(btns);

  const jukeWindow = (0.28 + (st.skill / 100) * 0.26) * tol;
  const vmax = (6.4 + (st.speed / 100) * 3.6) * (call === 'risky' ? 1.04 : 1);
  let lane = 2;
  let x = 0;
  let z = 4.5;
  let v = 2;
  let t = 0;
  let phase = 'wait';
  let juke = 0;
  let jukeStart = -9;
  let jukeCd = 0;
  let slow = 0;
  let burst = 0;
  let broken = 0;
  let fx = null;
  let swipe = null;

  camera.position.set(0, 6, 14);
  camera.lookAt(0, 0.5, -8);

  const cut = (dir) => {
    if (phase !== 'live') return;
    lane = Math.max(0, Math.min(4, lane + dir));
    sfx.juke();
  };
  const doJuke = () => {
    if (phase !== 'live' || jukeCd > 0) return;
    juke = jukeWindow;
    jukeStart = t;
    jukeCd = jukeWindow + 0.55;
    sfx.juke();
    btns.querySelector('[data-a="juke"]').classList.add('on');
    setTimeout(() => btns.querySelector('[data-a="juke"]')?.classList.remove('on'), 200);
  };

  btns.addEventListener('pointerdown', (ev) => {
    const a = ev.target.closest('.hbtn')?.dataset.a;
    if (!a) return;
    ev.preventDefault();
    if (a === 'left') cut(-1);
    else if (a === 'right') cut(1);
    else doJuke();
  });

  bindInput(ctx, {
    down: (ev) => { swipe = { x: ev.clientX, y: ev.clientY, t: performance.now() }; },
    up: (ev) => {
      if (!swipe) return;
      const dx = ev.clientX - swipe.x;
      const dy = ev.clientY - swipe.y;
      const s = swipe;
      swipe = null;
      if (Math.abs(dy) > 40 && dy < 0 && Math.abs(dy) > Math.abs(dx)) return doJuke();
      if (Math.abs(dx) > 30) return cut(dx > 0 ? 1 : -1);
      if (performance.now() - s.t < 400) cut(ev.clientX < window.innerWidth / 2 ? -1 : 1);
    },
    key: (ev, down) => {
      if (!down) return;
      if (ev.key === 'ArrowLeft' || ev.key === 'a' || ev.key === 'A') cut(-1);
      if (ev.key === 'ArrowRight' || ev.key === 'd' || ev.key === 'D') cut(1);
      if (ev.key === ' ' || ev.key === 'ArrowUp' || ev.key === 'w' || ev.key === 'W') doJuke();
    },
  });

  maybeTip(ctx, 'Running Back', [
    'The green arrow shows the hole. Higher Football IQ shows it longer.',
    'Tap left/right (or swipe) to cut between lanes. Defenders are slow to change direction, so cut late.',
    'Hit JUKE (swipe up / Space) just before contact to make them miss. Strength helps you break tackles.',
  ], () => { phase = 'pre'; hud.instr('Find the hole!'); });

  const finish = (result) => {
    phase = 'over';
    endPlay(ctx, finalize(result, m));
  };

  return (dt) => {
    if (phase === 'wait') return;
    t += dt;
    if (fx && !fx(dt)) fx = null;
    if (phase === 'pre') {
      if (t > 0.5) { phase = 'live'; t = 0; sfx.whistle(); hud.instr(''); }
      return;
    }
    if (phase === 'over') {
      if (fx) follow(camera, x, z, { x: 0, y: 7, z: 11 }, { x: 0, y: 0.5, z: -6 }, dt, 3);
      return;
    }
    arrow.visible = t < arrowTime;
    arrow.material.opacity = 0.9 * Math.max(0, 1 - t / arrowTime);
    juke = Math.max(0, juke - dt);
    jukeCd = Math.max(0, jukeCd - dt);
    slow = Math.max(0, slow - dt);
    burst = Math.max(0, burst - dt);
    v = Math.min(vmax * (burst > 0 ? 1.18 : 1) * (slow > 0 ? 0.6 : 1), v + 7 * dt);
    z -= v * dt;
    const tx = LANES[lane];
    x += Math.sign(tx - x) * Math.min(Math.abs(tx - x), 10 * dt);
    runner.position.set(x, 0, z);
    runner.rotation.y = (tx - x) * -0.15;
    if (juke > 0) runner.userData.body.rotation.z = Math.sin((t - jukeStart) * 25) * 0.5;
    else runner.userData.body.rotation.z = 0;
    animateRun(runner, dt, v);
    blockers.forEach((b, i) => { if (t < 1.6) b.position.z = 0.8 - t * 0.6; animateRun(b, dt, 1.5); b.position.x = LANES[i] + (i === holeLane ? (LANES[i] < 0 ? -0.8 : 0.8) * Math.min(1, t * 2) : 0); });

    // Defenders pursue.
    for (const d of defenders) {
      if (d.down) {
        d.downT += dt * 3;
        knockDown(d.mesh, d.downT, -1);
        continue;
      }
      if (t < d.blocked) { animateRun(d.mesh, dt, 1); continue; }
      const px = x;
      const pz = z - v * 0.25;
      const dx = px - d.x;
      const dz = pz - d.z;
      const dd = Math.hypot(dx, dz) || 1;
      d.x += Math.max(-cfg.lateral, Math.min(cfg.lateral, (dx / dd) * d.speed)) * dt;
      d.z += (dz / dd) * d.speed * dt;
      d.mesh.position.set(d.x, 0, d.z);
      faceToward(d.mesh, x, z);
      animateRun(d.mesh, dt, d.speed);
      // Contact.
      if (Math.abs(d.x - x) < 0.95 && Math.abs(d.z - z) < 0.9) {
        if (juke > 0) {
          d.down = true;
          const perfect = t - jukeStart < 0.16;
          hud.big(perfect ? 'PERFECT JUKE!' : 'JUKE!', perfect ? '#4ade80' : '#fff', 700);
          burst = perfect ? 0.6 : 0.3;
          sfx.cheer();
          continue;
        }
        const pBreak = (st.strength / 100) * 0.55 * (0.6 + tol * 0.4) * Math.pow(0.55, broken);
        if (Math.random() < pBreak) {
          d.down = true;
          broken++;
          slow = 0.45;
          hud.big('BROKE A TACKLE!', '#fbbf24', 700);
          sfx.hit();
          continue;
        }
        // Tackled.
        sfx.hit();
        knockDown(runner, 1, 1);
        const yards = -z;
        if (Math.random() < cfg.fumble * (yards > 0 ? 1 : 1.5)) {
          return finish({ turnover: true, complete: false, yards: Math.round(yards), quality: 0.05, text: 'FUMBLE! Defense recovers.' });
        }
        return finish({ complete: true, yards, quality: 0.28 + yards / 22 + broken * 0.06 });
      }
    }
    follow(camera, x * 0.6, z, { x: 0, y: 7.5, z: 10 }, { x: 0, y: 0.5, z: -10 }, dt, 5);
    if (z <= -m.yardLine) {
      fx = confetti(ctx.scene, new THREE.Vector3(x, 0, z - 2), [opts.teamColors[0], opts.teamColors[1], '#fff']);
      runner.rotation.y = 0;
      return finish({ complete: true, yards: m.yardLine, quality: 0.95 });
    }
    if (t > 11) {
      sfx.whistle();
      return finish({ complete: true, yards: -z, quality: 0.3 - z / 22 });
    }
  };
}
