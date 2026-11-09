// Run plays: RB handoff, QB scramble, and RB screen pass (catch first, then run).
//
// Controls: tap left/right side (or swipe, or ←/→) to cut a lane, JUKE button / swipe up / Space to juke.
// Screen: tap when the rings meet to catch the pass first.
// Stats: Speed = top speed, Skill = juke window + catch, Strength = breaking tackles, IQ = seeing the hole.
import * as THREE from 'three';
import { makePlayer, animateRun, makeBall, makeRing, knockDown, faceToward, setPose, playAction, celebrate, confetti } from '../actors.js';
import { bindInput, maybeTip, rig, endPlay, finalize } from './common.js';
import { sfx } from '../../audio/sfx.js';

const LANES = [-4.4, -2.2, 0, 2.2, 4.4];

export function runPlay(ctx) {
  const { group, camera, hud, opts } = ctx;
  const m = opts.moment;
  const st = opts.stats;
  const tol = opts.tolerance;
  const call = opts.call;
  const kind = ctx.type === 'qb_scramble' ? 'scramble' : ctx.type === 'rb_screen' ? 'screen' : 'run';
  const off = opts.teamColors;
  const def = opts.oppColors;

  const cfg = {
    safe: { defSpeed: 6.8, lateral: 4.0, safeties: [-12], fumble: 0.015, hole: [1, 2, 3] },
    balanced: { defSpeed: 7.4, lateral: 4.6, safeties: [-15, -21], fumble: 0.035, hole: [0, 1, 2, 3, 4] },
    risky: { defSpeed: 7.9, lateral: 5.2, safeties: [-24], fumble: 0.07, hole: [0, 4] },
  }[call];
  const holeLane = cfg.hole[Math.floor(Math.random() * cfg.hole.length)];

  const runner = makePlayer(off, { highlight: true });
  const startZ = kind === 'scramble' ? 6 : kind === 'screen' ? 3 : 4.5;
  const startX = kind === 'screen' ? -5 : 0;
  runner.position.set(startX, 0, startZ);
  group.add(runner);
  const ball = makeBall();
  group.add(ball);
  group.add(ball.userData.shadow);
  ball.visible = kind !== 'screen';

  const defenders = [];
  const addDef = (x, z, blockedFor) => {
    const d = makePlayer(def);
    z = Math.max(z, -m.yardLine - 8);
    d.position.set(x, 0, z);
    faceToward(d, x, 10);
    group.add(d);
    defenders.push({ mesh: d, x, z, blocked: blockedFor, down: false, speed: cfg.defSpeed * (0.94 + Math.random() * 0.14) });
  };
  const blockers = [];
  for (let i = 0; i < 5; i++) {
    const ol = makePlayer(off);
    ol.position.set(LANES[i], 0, 0.8);
    setPose(ol, 'tackle');
    group.add(ol);
    blockers.push(ol);
  }
  let qb = null;
  if (kind === 'screen') {
    qb = makePlayer(off);
    qb.position.set(0, 0, 6);
    group.add(qb);
  }
  for (let i = 0; i < 5; i++) {
    if (kind === 'run' && i === holeLane) continue;
    if (i % 2 === 1 && Math.random() < 0.3) continue;
    const blocked = kind === 'scramble' ? (Math.abs(i - 2) <= 1 ? 0.15 : 1.0) : kind === 'screen' ? 0.5 : 1.1 + Math.random() * 0.8;
    addDef(LANES[i] + (Math.random() - 0.5) * 0.4, -1, blocked);
  }
  const lbCount = call === 'safe' ? 2 : 3;
  for (let i = 0; i < lbCount; i++) addDef(LANES[Math.floor(Math.random() * 5)] + (Math.random() - 0.5), -6 - Math.random() * 3, 0.3 + Math.random() * 0.3);
  for (const z of cfg.safeties) addDef((Math.random() - 0.5) * 10, z - Math.random() * 3, 0.5);

  // Hole indicator (runs only). Higher IQ shows it longer.
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(1, 2.4, 3), new THREE.MeshBasicMaterial({ color: '#4ade80', transparent: true, opacity: 0.9 }));
  arrow.rotation.x = -Math.PI / 2;
  arrow.position.set(LANES[holeLane], 0.1, -1.4);
  arrow.visible = kind === 'run';
  group.add(arrow);
  const arrowTime = 0.5 + (st.iq / 100) * 1.4;

  // Screen pass catch rings.
  const target = makeRing('#ffffff', 0.55, 0.75, 0.95);
  const closing = makeRing('#ffd43b', 2.8, 3.1, 0.95);
  target.visible = closing.visible = false;
  group.add(target, closing);

  const btns = document.createElement('div');
  btns.className = 'hud-pad';
  btns.innerHTML = '<button class="hbtn" data-a="left" aria-label="Cut left">◀</button><button class="hbtn big" data-a="juke">JUKE</button><button class="hbtn" data-a="right" aria-label="Cut right">▶</button>';
  hud.bottom(btns);

  const jukeWindow = (0.22 + (st.skill / 100) * 0.22) * tol;
  const vmax = (6.2 + (st.speed / 100) * 3.6) * (kind === 'scramble' ? 0.9 : 1);
  let lane = kind === 'screen' ? 0 : 2;
  let x = startX;
  let z = startZ;
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
  let pass = null; // screen: { t0, T, tap }
  let ended = false;

  rig(camera, x, z, 0, { zoom: 0.8, ahead: 9, snap: true });

  const cut = (dir) => {
    if (phase !== 'live') return;
    lane = Math.max(0, Math.min(4, lane + dir));
    sfx.juke();
  };
  const doJuke = () => {
    if (phase === 'catch') return tapCatch();
    if (phase !== 'live' || jukeCd > 0) return;
    juke = jukeWindow;
    jukeStart = t;
    jukeCd = jukeWindow + 0.6;
    sfx.juke();
    playAction(runner, ['juke', 'juke', 'run2'], { fps: 10 });
    const b = btns.querySelector('[data-a="juke"]');
    b.classList.add('on');
    setTimeout(() => b?.classList.remove('on'), 200);
  };
  const tapCatch = () => {
    if (pass && pass.tap === null) { pass.tap = t - pass.t0 - pass.T; sfx.click(); }
  };

  btns.addEventListener('pointerdown', (ev) => {
    const a = ev.target.closest('.hbtn')?.dataset.a;
    if (!a) return;
    ev.preventDefault();
    if (phase === 'catch') return tapCatch();
    if (a === 'left') cut(-1);
    else if (a === 'right') cut(1);
    else doJuke();
  });

  bindInput(ctx, {
    down: (ev) => { if (phase === 'catch') return tapCatch(); swipe = { x: ev.clientX, y: ev.clientY, t: performance.now() }; },
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

  const tips = {
    run: ['The green arrow shows the hole. Higher Football IQ shows it longer.', 'Tap left/right (or swipe) to cut lanes. Defenders are slow to change direction, so cut late.', 'Hit JUKE (swipe up / Space) right before contact. Strength breaks tackles.'],
    scramble: ['The pocket collapsed! Tuck it and run.', 'Tap left/right to cut, JUKE right before contact.'],
    screen: ['First catch the screen pass: tap when the yellow ring meets the white ring.', 'Then follow your blockers: cut and juke like a running back.'],
  };
  maybeTip(ctx, { run: 'Running Back', scramble: 'Scramble!', screen: 'Screen Pass' }[kind], tips[kind], () => {
    phase = 'pre';
    hud.instr(kind === 'run' ? 'Find the hole!' : kind === 'scramble' ? 'Pocket collapsing — RUN!' : 'Catch the screen…');
  });

  const finish = (result) => {
    if (ended) return;
    ended = true;
    phase = 'over';
    endPlay(ctx, finalize(result, m));
  };

  return (dt) => {
    if (phase === 'wait') return;
    t += dt;
    if (fx && !fx(dt)) fx = null;
    if (phase === 'pre') {
      if (t > 0.5) {
        t = 0;
        sfx.whistle();
        hud.instr('');
        if (kind === 'screen') {
          phase = 'catch';
          pass = { t0: 0.35, T: 0.9, tap: null };
          hud.instr('Tap when the rings meet!');
        } else phase = 'live';
      }
      return;
    }
    if (phase === 'over') {
      rig(camera, x, z, dt, { zoom: 0.8, ahead: 9 });
      return;
    }

    // Screen pass: swing to the flat and catch.
    if (phase === 'catch') {
      x = Math.max(-9, x - 4 * dt);
      z = Math.max(1, z - 1.5 * dt);
      runner.position.set(x, 0, z);
      faceToward(runner, x - 1, z);
      animateRun(runner, dt, 4);
      faceToward(qb, x, z);
      if (t >= pass.t0) {
        if (!pass.thrown) { pass.thrown = true; playAction(qb, ['throwWind', 'throwRelease', 'throwRelease'], { fps: 8 }); setPose(runner, 'catch'); }
        ball.visible = true;
        target.visible = closing.visible = true;
        const f = Math.min(1, (t - pass.t0) / pass.T);
        ball.position.set(qb.position.x + (x - qb.position.x) * f, 2.2 + 3 * f * (1 - f), qb.position.z + (z - qb.position.z) * f);
        ball.userData.shadow.position.set(ball.position.x, 0.04, ball.position.z);
        target.position.set(x, 0.06, z);
        closing.position.set(x, 0.07, z);
        closing.scale.setScalar(Math.max(0.24, (1 + (1 - f) * 3.2) * 0.24));
        if (t - pass.t0 > pass.T + 0.15) {
          target.visible = closing.visible = false;
          const win = 0.11 * tol * (0.85 + st.skill / 400);
          const err = pass.tap === null ? 9 : Math.abs(pass.tap);
          if (err > win * 2.2) {
            ball.position.y = 0.2;
            return finish({ complete: false, yards: 0, quality: 0.15, text: pass.tap === null ? 'Never looked it in.' : 'Dropped the screen pass.' });
          }
          sfx.catch();
          setPose(runner, null);
          hud.big(err <= win ? 'CLEAN CATCH' : 'BOBBLED… GOT IT', '#fff', 600);
          if (err > win) slow = 0.5;
          phase = 'live';
          lane = 0;
          t = 0.6; // defenders get moving
        }
      }
      rig(camera, x, z, dt, { zoom: 0.8, ahead: 9 });
      return;
    }

    arrow.visible = kind === 'run' && t < arrowTime;
    arrow.material.opacity = 0.9 * Math.max(0, 1 - t / arrowTime);
    juke = Math.max(0, juke - dt);
    jukeCd = Math.max(0, jukeCd - dt);
    slow = Math.max(0, slow - dt);
    burst = Math.max(0, burst - dt);
    v = Math.min(vmax * (burst > 0 ? 1.18 : 1) * (slow > 0 ? 0.55 : 1), v + 7 * dt);
    z -= v * dt;
    const tx = LANES[lane];
    x += Math.sign(tx - x) * Math.min(Math.abs(tx - x), 10 * dt);
    runner.position.set(x, 0, z);
    faceToward(runner, x + (tx - x) * 0.6, z - 1);
    animateRun(runner, dt, v);
    ball.position.set(x + 0.45, 1.3, z - 0.1);
    ball.userData.shadow.visible = false;
    blockers.forEach((b, i) => {
      if (t < 1.6) b.position.z = 0.8 - t * 0.6;
      b.position.x = LANES[i] + (kind === 'run' && i === holeLane ? (LANES[i] < 0 ? -0.9 : 0.9) * Math.min(1, t * 2) : 0);
      animateRun(b, dt, 1.2);
    });

    for (const d of defenders) {
      if (d.down) continue;
      if (t < d.blocked) { animateRun(d.mesh, dt, 0.8); continue; }
      const dx = x - d.x;
      const dz = z - v * 0.25 - d.z;
      const dd = Math.hypot(dx, dz) || 1;
      d.x += Math.max(-cfg.lateral, Math.min(cfg.lateral, (dx / dd) * d.speed)) * dt;
      d.z += (dz / dd) * d.speed * dt;
      d.mesh.position.set(d.x, 0, d.z);
      faceToward(d.mesh, x, z);
      animateRun(d.mesh, dt, d.speed);
      if (Math.abs(d.x - x) < 0.95 && Math.abs(d.z - z) < 0.9) {
        if (juke > 0) {
          d.down = true;
          knockDown(d.mesh, 1);
          const perfect = t - jukeStart < 0.14;
          hud.big(perfect ? 'PERFECT JUKE!' : 'JUKE!', perfect ? '#4ade80' : '#fff', 700);
          burst = perfect ? 0.6 : 0.3;
          sfx.cheer();
          if (perfect) ctx.slowMo(0.35);
          continue;
        }
        const pBreak = (st.strength / 100) * 0.45 * (0.6 + tol * 0.4) * Math.pow(0.5, broken);
        if (Math.random() < pBreak) {
          d.down = true;
          knockDown(d.mesh, 1);
          broken++;
          slow = 0.45;
          hud.big('BROKE A TACKLE!', '#fbbf24', 700);
          sfx.hit();
          ctx.shake(0.25);
          continue;
        }
        sfx.hit();
        ctx.shake(0.35);
        knockDown(runner, 1);
        const yards = -z;
        if (Math.random() < cfg.fumble * (yards > 0 ? 1 : 1.5)) {
          return finish({ turnover: true, complete: false, yards: Math.round(yards), quality: 0.05, text: 'FUMBLE! Defense recovers.' });
        }
        return finish({ complete: true, yards, quality: 0.25 + yards / 24 + broken * 0.06 });
      }
    }
    rig(camera, x, z, dt, { zoom: 0.8, ahead: 9, k: 5 });
    if (z <= -m.yardLine) {
      fx = confetti(ctx.scene, new THREE.Vector3(x, 0, z - 2), [opts.teamColors[0], opts.teamColors[1], '#fff']);
      celebrate(runner);
      return finish({ complete: true, yards: m.yardLine, quality: 0.95 });
    }
    if (t > 11) {
      sfx.whistle();
      return finish({ complete: true, yards: -z, quality: 0.3 - z / 22 });
    }
  };
}
