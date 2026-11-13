// The kicker's moments: field goals, extra points, kickoffs and onside kicks.
//
// Two taps: AIM (a marker slides across the goalposts, or across the landing zone on kickoffs) and POWER (a meter
// sweeps up and down; land it in the green sweet spot for clean contact). Then the real ball flies: gravity, wind
// drift, a hook or slice when you miss the sweet spot, doinks off the uprights and the crossbar.
// Stats: Skill = steadier aim + bigger sweet spot, Strength = range, IQ = composure on clutch kicks.
// Traits: bigleg (range), automatic (sweet spot), icewater (no nerves), windreader (shows the drift), hangtime (kickoffs).
import * as THREE from 'three';
import { makePlayer, makeBall, animateRun, faceToward, setPose, playAction, celebrate, knockDown, confetti } from '../actors.js';
import { bindInput, maybeTip, endPlay } from './common.js';
import { sfx } from '../../audio/sfx.js';
import { react } from '../../audio/stadium.js';

const G = 10.7; // gravity in yards/s^2
const POST_HALF = 3.08; // half the distance between the uprights (18.5 ft)
const BAR = 3.33; // crossbar height (10 ft)
const SIDELINE = 26.6;
const has = (opts, id) => (opts.traits ?? []).includes(id);

export function kick(ctx) {
  const { group, camera, hud, opts, stadium } = ctx;
  const m = opts.moment;
  const st = opts.stats ?? { speed: 60, skill: 60, iq: 60, strength: 60 };
  const call = opts.call ?? 'balanced';
  const tol = opts.tolerance ?? 1;
  const kickoff = m.type === 'k_kickoff';
  const onside = m.type === 'k_onside';
  const fg = !kickoff && !onside; // field goal or extra point
  const pat = m.type === 'k_pat';
  const wind = m.wind ?? { x: 0, z: 0, mph: 0 };
  const userHome = opts.userHome !== false;
  const nerves = (m.clutch || m.gw) && !has(opts, 'icewater') ? Math.max(0.15, 1 - (st.iq ?? 60) / 110) : 0;

  try { stadium?.hideLines?.(); stadium?.setPosts?.(1); } catch { /* old stadium */ }

  // ---- the people
  const spotZ = fg ? 7 : 0; // where the ball is kicked from
  const ball = makeBall();
  group.add(ball, ball.userData.shadow);
  const me = makePlayer(opts.teamColors, { highlight: true, look: opts.look, number: opts.number, uniform: opts.teamUniform, position: 'K' });
  group.add(me);
  const mates = [];
  const opps = [];
  let holder = null;
  let snapper = null;
  if (fg) {
    holder = makePlayer(opts.teamColors, { uniform: opts.teamUniform, number: 4 });
    holder.position.set(0.62, 0, spotZ);
    faceToward(holder, 0, 0);
    setPose(holder, 'kneel');
    group.add(holder);
    // the protection: a wall of linemen, wings and the snapper, and their rush
    for (let i = 0; i < 9; i++) {
      const x = (i - 4) * 0.95;
      const o = makePlayer(opts.teamColors, { uniform: opts.teamUniform, number: i === 4 ? 48 : 60 + i });
      o.position.set(x, 0, i === 0 || i === 8 ? 1.0 : 0.45);
      setPose(o, 'stance');
      group.add(o); mates.push(o);
      if (i === 4) snapper = o;
    }
    for (let i = 0; i < 10; i++) {
      const x = (i - 4.5) * 0.92;
      const d = makePlayer(opts.oppColors, { uniform: opts.oppUniform, number: 90 + i });
      d.position.set(x, 0, -0.65);
      faceToward(d, x, 5);
      setPose(d, 'stance');
      group.add(d); opps.push(d);
    }
    me.position.set(-1.9, 0, spotZ + 2.7);
    ball.position.set(0, 0.45, 0.05);
  } else {
    // kickoff: your coverage team lined up across the field, theirs waiting downfield
    for (let i = 0; i < 10; i++) {
      const x = (i < 5 ? -1 : 1) * (4 + (i % 5) * 4.4);
      const o = makePlayer(opts.teamColors, { uniform: opts.teamUniform, number: 20 + i * 3 });
      o.position.set(x, 0, 1.2);
      faceToward(o, x, -10);
      group.add(o); mates.push(o);
    }
    const spots = onside
      ? [[-12, -11], [-6, -11], [0, -11.5], [6, -11], [12, -11], [-9, -16], [-3, -17], [3, -17], [9, -16], [0, -30]]
      : [[-15, -12], [-7, -12], [0, -12.5], [7, -12], [15, -12], [-10, -27], [0, -30], [10, -27], [-7, -60], [7, -60]];
    for (const [x, z] of spots) {
      const d = makePlayer(opts.oppColors, { uniform: opts.oppUniform, number: 80 + opps.length });
      d.position.set(x, 0, z);
      faceToward(d, x, 5);
      group.add(d); opps.push(d);
    }
    me.position.set(onside ? -3 : -1.2, 0, 7.5);
    ball.position.set(0, 0.24, 0);
    ball.rotation.x = -Math.PI / 2 + 0.25; // standing on the tee
    const tee = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 0.1, 10), new THREE.MeshStandardMaterial({ color: '#f08c00' }));
    tee.position.set(0, 0.05, 0);
    group.add(tee);
  }
  faceToward(me, 0, -20);

  // ---- distances, range and the sweet spot
  const postZ = -(m.yardLine + 10);
  const dist = fg ? m.yardLine + 17 : 0;
  const range = 40 + (st.strength ?? 60) * 0.22 + ({ hs: -6, college: -2, pro: 0 }[opts.stage] ?? 0) + (has(opts, 'bigleg') ? 5 : 0) + (call === 'risky' ? 3 : call === 'safe' ? -2 : 0);
  const maxCarry = (range + 9) * 1.14; // landing distance at full power (a 35 degree launch)
  const maxKickoff = 60 + (st.strength ?? 60) * 0.17 + (has(opts, 'bigleg') ? 5 : 0) + (call === 'risky' ? 3 : call === 'safe' ? -2 : 0);
  const LAUNCH = fg ? 0.61 : onside ? 0.2 : 0.8; // radians
  // the carry a FG needs to clear the bar at the posts: x tan(a) (1 - x / L) >= bar
  const needL = fg ? dist / Math.max(0.2, 1 - (BAR + 0.5) / (dist * Math.tan(LAUNCH))) : 0;
  const headwind = wind.z * 0.9; // + = blowing toward the kicker (wind z is toward +z)
  const need = fg ? Math.min(0.96, (needL + headwind * 1.3) / maxCarry) : kickoff ? 0.78 : 0.2;
  let band = 0.13 * Math.min(1.5, tol) * (has(opts, 'automatic') ? 1.3 : 1) * (call === 'safe' ? 1.2 : call === 'risky' ? 0.8 : 1) * (0.85 + (st.skill ?? 60) / 400);
  if (onside) band *= has(opts, 'hangtime') ? 1.4 : 1;
  if (kickoff && has(opts, 'hangtime')) band *= 1.25;
  const zoneLo = fg ? need : kickoff ? Math.min(0.86, need) : 0.24;
  const zoneHi = Math.min(0.985, zoneLo + band);

  // ---- markers
  const AMP = fg ? (pat ? 5 : 6.5) : kickoff ? 22 : 14;
  // FG: a hot-pink bullseye floating over the crossbar with a line down to the grass; kickoffs: a ring on the turf
  const aimMat = new THREE.MeshBasicMaterial({ color: '#ff3d8b', transparent: true, opacity: 0.95, depthTest: false });
  const ghostMat = new THREE.MeshBasicMaterial({ color: '#4dd4ff', transparent: true, opacity: 0.6, depthTest: false });
  const geos = fg ? [new THREE.CylinderGeometry(0.06, 0.06, BAR + 1.6, 6), new THREE.TorusGeometry(0.55, 0.12, 8, 24), new THREE.CircleGeometry(0.18, 16)] : [new THREE.RingGeometry(onside ? 1.2 : 2.2, onside ? 1.7 : 3.1, 32), new THREE.CylinderGeometry(0.12, 0.12, 7, 6)];
  const mkMarker = (mat) => {
    const g = new THREE.Group();
    if (fg) {
      const line = new THREE.Mesh(geos[0], mat); line.position.y = (BAR + 1.6) / 2;
      const ring = new THREE.Mesh(geos[1], mat); ring.position.y = BAR + 2.2;
      const dot = new THREE.Mesh(geos[2], mat); dot.position.y = BAR + 2.2;
      g.add(line, ring, dot);
    } else { const r = new THREE.Mesh(geos[0], mat); r.rotation.x = -Math.PI / 2; const b = new THREE.Mesh(geos[1], mat); b.position.y = 3.5; g.add(r, b); }
    g.traverse((o) => { o.renderOrder = 998; });
    return g;
  };
  const marker = mkMarker(aimMat);
  const ghost = mkMarker(ghostMat);
  const markZ = fg ? postZ : kickoff ? -64 : -11.5;
  marker.position.set(0, fg ? 0 : 0.06, markZ); ghost.position.set(0, fg ? 0 : 0.05, markZ);
  group.add(marker);
  // flight time to the marker, for the wind drift preview
  const flightT = fg ? 2 * Math.sqrt(2 * Math.max(1, dist) / G) * 0.62 : kickoff ? 3.9 : 1.2;
  const driftX = wind.x * 0.35 * 0.5 * flightT * flightT;
  if (has(opts, 'windreader') && Math.abs(driftX) > 0.2) group.add(ghost);
  ctx.addCleanup(() => { geos.forEach((g) => g.dispose()); aimMat.dispose(); ghostMat.dispose(); });

  // ---- HUD: power meter with the sweet spot
  const meter = document.createElement('div');
  meter.className = 'kick-meter';
  meter.innerHTML = `<div class="km-label">${fg ? (pat ? 'EXTRA POINT' : `${dist} YARDS`) : onside ? 'ONSIDE' : 'KICKOFF'}<span>${wind.mph >= 3 ? `WIND ${wind.mph} MPH` : 'CALM'}</span></div>
    <div class="km-bar"><i class="km-zone" style="left:${zoneLo * 100}%;width:${(zoneHi - zoneLo) * 100}%"></i>${fg ? `<i class="km-need" style="left:${need * 100}%"></i>` : ''}<i class="km-cur"></i></div>
    <div class="km-steps"><b class="on">1 AIM</b><b>2 POWER</b></div>`;
  hud.bottom(meter);
  const cur = meter.querySelector('.km-cur');
  const steps = meter.querySelectorAll('.km-steps b');

  // ---- state
  let phase = 'wait';
  let t = 0;
  let aimX = 0;
  let aimLocked = 0;
  let power = 0;
  let powerLocked = 0;
  let launched = false;
  const v = new THREE.Vector3();
  let spin = 0;
  let result = null;
  let endT = 0;
  let bounces = 0;
  let crossed = false;
  let doinked = false;
  let returner = null;
  let retPlan = null;
  const period = 2.4 * Math.min(1.5, Math.max(0.55, tol)); // aim sweep (slower = easier)
  const pPeriod = 1.3 * Math.min(1.4, Math.max(0.6, tol)); // power sweep

  // camera
  const camHome = fg ? { p: [0.4, 2.7, spotZ + 7.5], l: [0, 3.2, postZ * 0.55] } : { p: [0.5, 5.2, 19], l: [0, 0.5, onside ? -9 : -26] };
  camera.position.set(...camHome.p);
  camera.lookAt(...camHome.l);
  const camTo = (p, l, dt, k = 3) => {
    const a = 1 - Math.exp(-k * dt);
    camera.position.x += (p[0] - camera.position.x) * a;
    camera.position.y += (p[1] - camera.position.y) * a;
    camera.position.z += (p[2] - camera.position.z) * a;
    const L = (camera.userData.kl ??= new THREE.Vector3(...camHome.l));
    L.x += (l[0] - L.x) * a; L.y += (l[1] - L.y) * a; L.z += (l[2] - L.z) * a;
    camera.lookAt(L);
  };

  const tap = () => {
    if (phase === 'aim') {
      aimLocked = aimX;
      phase = 'power'; t = 0;
      sfx.select();
      steps[0].classList.remove('on'); steps[1].classList.add('on');
      hud.instr('Tap in the GREEN for clean contact');
    } else if (phase === 'power') {
      powerLocked = power;
      phase = 'approach'; t = 0;
      sfx.click();
      steps[1].classList.remove('on');
      hud.instr('');
      marker.visible = false; ghost.visible = false;
      if (fg) { for (const o of mates) setPose(o, 'block'); for (const d of opps) setPose(d, 'tackle'); sfx.hit(); }
    }
  };
  bindInput(ctx, { down: () => tap(), key: (ev, down) => { if (down && (ev.key === ' ' || ev.key === 'Enter')) tap(); } });

  const tips = fg
    ? ['1. AIM: a marker slides across the goalposts. Tap to lock it. Watch the wind and aim into it.', '2. POWER: tap when the meter is in the GREEN. Too weak falls short, past the green you hook it.']
    : onside
      ? ['You need the ball back. Aim the short kick, then tap a soft power in the green.', 'It has to go 10 yards. Your teammates fight for it.']
      : ['1. AIM: pick a landing spot. Corners pin them deep, the sideline is out of bounds.', '2. POWER: tap in the green. Deep into the end zone is a touchback.'];
  maybeTip(ctx, fg ? (pat ? 'Extra Point' : 'Field Goal') : onside ? 'Onside Kick' : 'Kickoff', tips, () => {
    phase = 'aim'; t = 0;
    hud.instr(fg ? 'Tap to set your AIM' : 'Tap to pick your spot');
    if (m.gw) hud.say('This one is for the game...');
  });

  // ---- the kick itself
  const launch = () => {
    launched = true;
    sfx.kick();
    ctx.shake(0.08);
    const zoneMid = (zoneLo + zoneHi) / 2;
    let hook = 0; // radians of curve off line (negative = left for a right-footer)
    let p = powerLocked;
    if (p > zoneHi) hook = -(p - zoneHi) * (fg ? 1.1 : 0.9) * (0.7 + Math.random() * 0.6); // over-swung: hooks left
    else if (p < zoneLo && fg) hook = (zoneLo - p) * 0.35 * (Math.random() < 0.5 ? -1 : 1); // tentative: a little push either way
    if (p > 0.985) { hook *= 1.8; p *= 0.85; hud.big('SHANKED!', '#f87171', 900); }
    // nerves: the aim drifts a touch on the swing
    const aim = aimLocked + (nerves ? (Math.random() - 0.5) * nerves * 2.2 : 0);
    const sx = spotZ;
    const tz = fg ? postZ : kickoff ? -Math.max(8, p * maxKickoff) : -Math.max(3, p * 45);
    const dir = Math.atan2(aim, sx - tz) + hook * 0.35;
    if (fg) {
      const L = p * maxCarry;
      const sp = Math.sqrt((L * G) / Math.sin(2 * LAUNCH));
      v.set(Math.sin(dir) * Math.cos(LAUNCH) * sp, Math.sin(LAUNCH) * sp, -Math.cos(dir) * Math.cos(LAUNCH) * sp);
      spin = -12;
      // a low, weak kick into the rush gets blocked
      if (p < need * 0.55 && Math.random() < 0.65) result = { blocked: true };
    } else {
      const L = Math.abs(tz - sx);
      const sp = Math.sqrt((L * G) / Math.sin(2 * LAUNCH));
      v.set(Math.sin(dir) * Math.cos(LAUNCH) * sp, Math.sin(LAUNCH) * sp, -Math.cos(dir) * Math.cos(LAUNCH) * sp);
      spin = onside ? -18 : -9;
    }
    ball.userData.curve = hook * 6; // lateral acceleration from the hook
    ball.userData.zoneMid = zoneMid;
  };

  let ended = false;
  const finishWith = (r, delay = 1700) => {
    if (ended) return;
    ended = true;
    endPlay(ctx, { kick: true, complete: false, yards: 0, ...r, quality: Math.max(0, Math.min(1, r.quality)) }, { delay, color: r.good ? '#4ade80' : '#f87171' });
  };

  const fgResult = (made, how) => {
    const close = Math.max(0, 1 - Math.abs(ball.position.x) / POST_HALF);
    const q = made ? 0.6 + close * 0.22 + Math.min(1, Math.max(0, (dist - 20) / 35)) * 0.18 : Math.max(0.03, 0.28 - Math.min(1, Math.abs(Math.abs(ball.position.x) - POST_HALF) / 4) * 0.25);
    const text = made
      ? (pat ? 'Extra point is good.' : `${dist}-yard field goal is GOOD!${doinked ? ' Off the upright and in!' : ''}`)
      : (pat ? `Extra point is NO GOOD! ${how}` : `${dist}-yarder is no good. ${how}`);
    hud.big(made ? (doinked ? 'DOINK... GOOD!' : 'IT\'S GOOD!') : how === 'Blocked!' ? 'BLOCKED!' : 'NO GOOD', made ? '#4ade80' : '#f87171', 1800);
    if (made) {
      sfx.cheer(true); react(m.gw ? 'td' : 'good', userHome); ctx.hype?.(m.gw ? 1 : 0.8, 2.5);
      if (m.gw || dist >= 50) { celebrate(me); confetti(group, { x: 0, y: 3, z: postZ + 4 }, [opts.teamColors[0], opts.teamColors[1]]); ctx.slowMo?.(0.6); }
      for (const o of mates.slice(0, 4)) if (Math.random() < 0.6) playAction(o, 'jump');
    } else { sfx.groan(); react('bad', userHome); }
    finishWith({ made, quality: q, text, good: made, dist, doink: doinked }, made && (m.gw || dist >= 50) ? 2600 : 1800);
  };

  const dbg = globalThis.__playDebug ? (globalThis.__kick = { driftX, zoneLo, zoneHi, need, holder, group, me, camera, freeze: false }) : null;
  const camDbg = () => { if (dbg?.cam) { camera.position.set(...dbg.cam[0]); camera.lookAt(...dbg.cam[1]); } };
  return (dt) => { step(dt); camDbg(); };
  function step(dt) {
    t += dt;
    if (dbg) { dbg.phase = phase; dbg.aimX = aimX; dbg.power = power; dbg.ball = ball.position; dbg.aimLocked = aimLocked; dbg.powerLocked = powerLocked; dbg.v = v; }
    const all = [me, holder, ...mates, ...opps].filter(Boolean);
    if (phase === 'wait') { for (const p of all) animateRun(p, dt, 0); return; }
    if (phase === 'over') {
      if (launched && ball.visible) {
        v.y -= G * dt; ball.position.addScaledVector(v, dt); ball.rotation.x += spin * dt * 0.5;
        if (ball.position.y < 0.12) { ball.position.y = 0.12; v.y = Math.abs(v.y) * 0.4; v.x *= 0.6; v.z *= 0.6; }
        ball.userData.shadow.position.set(ball.position.x, 0.02, ball.position.z);
      }
      for (const p of all) animateRun(p, dt, 0);
      return;
    }
    if (phase === 'aim') {
      const s = Math.sin((t / period) * Math.PI * 2);
      aimX = s * AMP + (nerves ? Math.sin(t * 9.3) * nerves * 0.9 : 0);
      marker.position.x = aimX;
      ghost.position.x = aimX + driftX;
      cur.style.left = '0%';
      for (const p of all) animateRun(p, dt, 0);
      camTo(camHome.p, camHome.l, dt);
      return;
    }
    if (phase === 'power') {
      const ph = (t / pPeriod) % 2;
      power = ph < 1 ? ph : 2 - ph;
      cur.style.left = `${power * 100}%`;
      for (const p of all) animateRun(p, dt, 0);
      return;
    }
    if (phase === 'approach') {
      // snap and hold (FG), then two steps and the swing
      if (fg) {
        const sT = Math.min(1, t / 0.32);
        if (t < 0.36) ball.position.set(0, 0.45 + Math.sin(sT * Math.PI) * 0.5, 0.05 + sT * (spotZ - 0.35));
        else { ball.position.set(0.02, 0.24, spotZ); ball.rotation.set(-Math.PI / 2 + 0.12, 0, 0); }
        for (const d of opps) { d.position.z = Math.min(-0.2, d.position.z + dt * 0.6); animateRun(d, dt, 1.2); }
        for (const o of mates) animateRun(o, dt, 0.4);
      }
      const startAt = fg ? 0.36 : 0;
      const tt = Math.max(0, t - startAt);
      const dur = fg ? 0.5 : onside ? 0.55 : 0.9;
      const from = fg ? { x: -1.9, z: spotZ + 2.7 } : { x: onside ? -3 : -1.2, z: 7.5 };
      const to = { x: fg ? -0.42 : -0.38, z: spotZ + 0.55 };
      const k = Math.min(1, tt / dur);
      me.position.x = from.x + (to.x - from.x) * k;
      me.position.z = from.z + (to.z - from.z) * k;
      faceToward(me, me.position.x + (to.x - from.x) * 0.3, me.position.z - 2);
      animateRun(me, dt, tt > 0 && k < 1 ? 6 : 0);
      if (holder) animateRun(holder, dt, 0);
      if (!kickoff && !onside) { /* fg handled above */ } else for (const o of mates) { o.position.z -= dt * (tt > 0 ? 3 : 0); animateRun(o, dt, tt > 0 ? 4 : 0); }
      if (k >= 1 && !me.userData.kicked) { me.userData.kicked = true; faceToward(me, 0, -20); playAction(me, 'kick'); }
      if (me.userData.kicked && me.userData.u.action?.t > 0.36 && !launched) {
        launch();
        phase = 'flight'; t = 0;
        if (result?.blocked) {
          v.set((Math.random() - 0.5) * 6, 4, 7);
          sfx.hit();
        }
      }
      camTo(camHome.p, camHome.l, dt);
      return;
    }
    if (phase === 'flight') {
      // physics: gravity, wind drift, hook curve
      v.y -= G * dt;
      v.x += (wind.x * 0.35 + (ball.userData.curve ?? 0)) * dt;
      v.z += wind.z * 0.18 * dt;
      const prevZ = ball.position.z;
      ball.position.addScaledVector(v, dt);
      ball.rotation.x += spin * dt;
      ball.userData.shadow.position.set(ball.position.x, 0.02, ball.position.z);
      ball.userData.shadow.scale.setScalar(0.3 + ball.position.y * 0.04);
      for (const p of all) animateRun(p, dt, p === me ? 0 : fg ? 0.4 : 3);
      if (fg) {
        if (result?.blocked && !result.done) {
          result.done = true;
          hud.big('BLOCKED!', '#f87171', 1400); react('bad', userHome); sfx.groan();
          setTimeout(() => finishWith({ made: false, blocked: true, quality: 0.04, text: pat ? 'Extra point BLOCKED!' : 'Field goal BLOCKED!' }, 1500), 400);
        }
        if (result?.blocked) { if (ball.position.y < 0.12) { ball.position.y = 0.12; v.y = Math.abs(v.y) * 0.4; v.x *= 0.7; v.z *= 0.7; } camTo([ball.position.x * 0.4, 3, ball.position.z + 8], [ball.position.x, 0.5, ball.position.z], dt); return; }
        // the uprights and the crossbar
        if (!crossed && prevZ > postZ && ball.position.z <= postZ) {
          crossed = true;
          const ax = Math.abs(ball.position.x);
          const y = ball.position.y;
          if (Math.abs(ax - POST_HALF) < 0.22 && y > BAR - 0.2 && y < 13) {
            doinked = true; sfx.doink(); ctx.shake(0.1);
            if (Math.random() < 0.5) { v.x = -Math.sign(ball.position.x) * Math.abs(v.x * 0.5 + 1.5); v.z *= 0.35; ball.position.x = Math.sign(ball.position.x) * (POST_HALF - 0.25); fgResult(true); }
            else { v.x = Math.sign(ball.position.x) * Math.abs(v.x * 0.5 + 1.5); v.z = Math.abs(v.z) * 0.3; fgResult(false, ball.position.x < 0 ? 'Doinks off the left upright!' : 'Doinks off the right upright!'); }
          } else if (ax < POST_HALF && Math.abs(y - BAR) < 0.18) {
            doinked = true; sfx.doink();
            if (Math.random() < 0.45) { v.y = Math.abs(v.y) * 0.4 + 1; fgResult(true); } else { v.y = Math.abs(v.y) * 0.3; v.z = Math.abs(v.z) * 0.3; fgResult(false, 'Off the crossbar!'); }
          } else if (ax < POST_HALF && y > BAR) fgResult(true);
          else fgResult(false, y <= BAR ? 'Short!' : ball.position.x < 0 ? 'Wide left!' : 'Wide right!');
        }
        if (!crossed && ball.position.y < 0.15 && v.y < 0) { crossed = true; fgResult(false, 'It falls short!'); }
        if (ball.position.y < 0.12) { ball.position.y = 0.12; v.y = Math.abs(v.y) * 0.45; v.x *= 0.6; v.z *= 0.6; if (bounces++ < 3) sfx.bounce?.(0.6); }
        // follow the ball, then hold on the posts
        const camZ = Math.max(postZ + 6, ball.position.z + 8.5);
        camTo([ball.position.x * 0.5, Math.max(2.8, ball.position.y * 0.6 + 2.4), camZ], [ball.position.x * 0.6, Math.max(2.5, ball.position.y * 0.8), Math.min(ball.position.z - 4, postZ + 1)], dt, crossed ? 2 : 3.2);
        return;
      }
      // kickoffs / onside: coverage runs down, the ball comes down
      for (const o of mates) { const tx = onside ? ball.position.x + (o.position.x - ball.position.x) * 0.4 : o.position.x * 0.92; const tz = onside ? ball.position.z : Math.max(ball.position.z + 8, o.position.z - dt * 7.5); o.position.z += (tz - o.position.z) * Math.min(1, dt * (onside ? 1.6 : 1)); o.position.x += (tx - o.position.x) * Math.min(1, dt * 0.8); faceToward(o, ball.position.x, ball.position.z); }
      if (onside) {
        for (const d of opps) { d.position.z += (ball.position.z - 0.5 - d.position.z) * Math.min(1, dt * 1.3); d.position.x += (ball.position.x - d.position.x) * Math.min(1, dt * 0.7); faceToward(d, ball.position.x, ball.position.z); }
        if (ball.position.y < 0.12 && v.y < 0) {
          ball.position.y = 0.12; v.y = Math.abs(v.y) * 0.62; v.x *= 0.8; v.z *= 0.8; bounces++; sfx.bounce?.(0.8);
          if (bounces >= 3 || Math.abs(v.z) < 1.5) {
            const went = -ball.position.z;
            const inZone = powerLocked >= zoneLo && powerLocked <= zoneHi;
            let pRec = (inZone ? 0.48 : 0.2) + (has(opts, 'hangtime') ? 0.1 : 0) + (tol - 1) * 0.2 - (opts.oppStrength ?? 0) * 0.05;
            if (went < 10) pRec = 0;
            const rec = Math.random() < Math.max(0, Math.min(0.75, pRec));
            const pile = rec ? mates : opps;
            for (const p of pile.slice(0, 3)) { p.position.set(ball.position.x + (Math.random() - 0.5) * 1.2, 0, ball.position.z + (Math.random() - 0.5) * 1.2); knockDown(p, 1); }
            ball.visible = false;
            hud.big(rec ? 'RECOVERED!' : went < 10 ? 'NOT 10 YARDS' : 'THEIR BALL', rec ? '#4ade80' : '#f87171', 1800);
            if (rec) { sfx.touchdown(); react('turnover', userHome); ctx.hype?.(1, 3); } else { sfx.groan(); react('bad', userHome); }
            finishWith({ recovered: rec, quality: rec ? 0.9 : inZone ? 0.4 : 0.2, good: rec, text: rec ? 'ONSIDE KICK RECOVERED! It\'s your ball!' : went < 10 ? 'The onside kick doesn\'t go 10 yards. Their ball.' : 'They fall on the onside kick.' }, 2000);
            phase = 'over';
          }
        }
        camTo([ball.position.x * 0.5, 6, ball.position.z + 13], [ball.position.x, 0, ball.position.z - 2], dt);
        return;
      }
      // kickoff: the returner drifts under it
      if (!returner) {
        returner = opps.slice(-2).sort((a, b) => Math.abs(a.position.x - (aimLocked)) - Math.abs(b.position.x - (aimLocked)))[0];
        // where it will land (ignoring wind/curve for the drift target)
        const tl = (2 * v.y) / G;
        retPlan = { x: ball.position.x + v.x * tl, z: ball.position.z + v.z * tl };
      }
      returner.position.x += (Math.max(-SIDELINE + 1, Math.min(SIDELINE - 1, retPlan.x)) - returner.position.x) * Math.min(1, dt * 1.2);
      returner.position.z += (Math.max(-74, retPlan.z) - returner.position.z) * Math.min(1, dt * 1.2);
      animateRun(returner, dt, 4);
      if (ball.position.y < 0.3 && v.y < 0) {
        const lx = ball.position.x;
        const lz = ball.position.z;
        const goal = -65; // their goal line
        let start; let text; let q; let tb = false; let retTD = false;
        if (Math.abs(lx) > SIDELINE) { start = 40; q = 0.08; text = 'Out of bounds! They get it at the 40.'; }
        else if (lz < goal - 4.5) { start = 25; tb = true; q = 0.74; text = lz < goal - 10 ? 'Out of the back of the end zone. Touchback.' : 'Deep in the end zone. Touchback.'; }
        else {
          // caught: the deeper and higher, the less room to return it
          const depth = lz - goal; // yards in front of their goal line (negative = in the end zone)
          const hang = Math.min(1, Math.max(0, 1 - Math.abs(powerLocked - ball.userData.zoneMid) * 4));
          const ret = Math.max(4, 16 + (opts.oppStrength ?? 0) * 5 - hang * 7 + (Math.random() - 0.4) * 14);
          start = Math.max(1, Math.round(depth + ret));
          if (start >= 50 && Math.random() < 0.18) { retTD = true; start = 100; }
          q = retTD ? 0.02 : Math.max(0.1, Math.min(0.95, 1 - (start - 14) / 32));
          text = retTD ? 'They take it all the way back. Touchdown...' : start <= 20 ? `Pinned deep! Tackled at the ${start}.` : `Returned to the ${start > 50 ? `your ${100 - start}` : start}.`;
        }
        ball.visible = false;
        phase = 'return'; t = 0;
        result = { touchback: tb, returnTD: retTD, quality: q, text, good: q >= 0.6, start, returner: !tb && Math.abs(lx) <= SIDELINE };
        if (tb) { hud.big('TOUCHBACK', '#4ade80', 1500); react('good', userHome); }
      }
      camTo([ball.position.x * 0.4, Math.max(8, ball.position.y + 5), ball.position.z + 22], [ball.position.x, Math.max(0, ball.position.y * 0.5), ball.position.z - 6], dt, 2.5);
      return;
    }
    if (phase === 'return') {
      endT += dt;
      const r = result;
      if (r.returner && returner) {
        const runFor = r.returnTD ? 2.6 : 1.6;
        if (endT < runFor) { faceToward(returner, returner.position.x, returner.position.z + 5); returner.position.z += dt * 8.5; animateRun(returner, dt, 8); }
        else if (!r.down) { r.down = true; if (!r.returnTD) { knockDown(returner, 1); sfx.hit(); const tk = mates.reduce((a, b) => (Math.hypot(b.position.x - returner.position.x, b.position.z - returner.position.z) < Math.hypot(a.position.x - returner.position.x, a.position.z - returner.position.z) ? b : a)); tk.position.set(returner.position.x + 0.6, 0, returner.position.z - 0.6); playAction(tk, 'tackle'); hud.big(r.start <= 20 ? 'PINNED!' : `AT THE ${r.start > 50 ? 100 - r.start : r.start}`, r.good ? '#4ade80' : '#ffffff', 1500); } else { hud.big('RETURN TD...', '#f87171', 1500); react('td', !userHome); } }
        for (const o of mates) { o.position.x += (returner.position.x - o.position.x) * dt * 0.6; o.position.z += (returner.position.z - o.position.z) * dt * 0.6; animateRun(o, dt, 5); }
        camTo([returner.position.x * 0.5, 9, returner.position.z + 16], [returner.position.x, 0, returner.position.z - 2], dt, 2);
      }
      if (endT > (r.returner ? 2.2 : 0.6) && phase === 'return') {
        phase = 'over';
        finishWith({ touchback: r.touchback, returnTD: r.returnTD, quality: r.quality, text: r.text, good: r.good }, 1500);
      }
    }
  }
}
