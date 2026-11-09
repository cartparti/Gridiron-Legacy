// Wide receiver plays: pick a route, snap your break, time the catch.
// Modes: route (pick 1 of 3 routes), jump ball (deep contested catch), toe-tap (sideline catch + drag your feet).
// Controls: tap / Space. Before the snap pick a route with the buttons or 1/2/3.
// Stats: Speed = separation, Skill = catch window + cleaner breaks, Strength = contested catches, IQ = break timing.
import * as THREE from 'three';
import { makePlayer, animateRun, makeBall, makeRing, makeDisc, faceToward, knockDown, setPose, setHop, playAction, celebrate, setBackpedal, makeRouteLine, confetti } from '../actors.js';
import { bindInput, maybeTip, rig, endPlay, finalize, dist2, weatherFx } from './common.js';
import { sfx } from '../../audio/sfx.js';

// Route tree per play call. dir = direction after the break, sit = settles after the break.
const ROUTES = {
  safe: [
    { name: 'Hitch', depth: 5, dir: { x: 0, z: 1 }, sit: 0.4 },
    { name: 'Quick Out', depth: 5, dir: { x: 1, z: 0 } },
    { name: 'Slant', depth: 3, dir: { x: -1, z: -1.1 } },
  ],
  balanced: [
    { name: 'Dig', depth: 10, dir: { x: -1, z: -0.12 } },
    { name: 'Curl', depth: 11, dir: { x: -0.3, z: 1 }, sit: 0.5 },
    { name: 'Comeback', depth: 13, dir: { x: 1, z: 0.8 }, sit: 0.6 },
  ],
  risky: [
    { name: 'Post', depth: 12, dir: { x: -0.55, z: -1 } },
    { name: 'Corner', depth: 12, dir: { x: 0.6, z: -1 } },
    { name: 'Go', depth: 7, dir: { x: 0.05, z: -1 } },
  ],
};

export function routePlay(ctx) {
  const { group, camera, hud, opts } = ctx;
  const m = opts.moment;
  const st = opts.stats;
  const tol = opts.tolerance;
  const call = opts.call;
  const mode = ctx.type === 'wr_jumpball' ? 'jump' : ctx.type === 'wr_toetap' ? 'toetap' : 'route';
  const off = opts.teamColors;
  const def = opts.oppColors;
  const startX = mode === 'toetap' ? 20 : 10;
  const SIDELINE = 26.65;

  let route;
  const options = mode === 'jump' ? [{ name: 'Fade', depth: 6, dir: { x: 0.12, z: -1 } }]
    : mode === 'toetap' ? [{ name: 'Sideline Out', depth: Math.min(8 + (call === 'risky' ? 6 : 0), m.yardLine + 2), dir: { x: 1, z: -0.15 } }]
      : ROUTES[call];

  const wr = makePlayer(off, { highlight: true });
  const pos = { x: startX, z: 0 };
  wr.position.set(pos.x, 0, 0);
  setPose(wr, 'stance');
  group.add(wr);
  const qb = makePlayer(off);
  qb.position.set(0, 0, 5);
  group.add(qb);
  const press = call === 'risky' || mode === 'jump';
  const cbPos = { x: startX + 0.6, z: Math.max(press ? -1.6 : -6, -m.yardLine - 8) };
  const cb = makePlayer(def);
  cb.position.set(cbPos.x, 0, cbPos.z);
  faceToward(cb, cbPos.x, 5);
  group.add(cb);
  let safety = null;
  if (call === 'risky' || mode === 'jump') {
    safety = { pos: { x: startX - 6, z: Math.max(-22, -m.yardLine - 6) }, mesh: makePlayer(def) };
    safety.mesh.position.set(safety.pos.x, 0, safety.pos.z);
    group.add(safety.mesh);
  }
  for (let i = 0; i < 5; i++) {
    const ol = makePlayer(off);
    ol.position.set(-4 + i * 2, 0, 1);
    group.add(ol);
    const dl = makePlayer(def);
    dl.position.set(-4 + i * 2, 0, -1);
    faceToward(dl, -4 + i * 2, 5);
    group.add(dl);
  }

  const zone = makeDisc('#ffd43b', 1, 0.45);
  zone.visible = false;
  group.add(zone);
  let routeLine = null;
  const ball = makeBall();
  ball.visible = false;
  group.add(ball);
  group.add(ball.userData.shadow);
  const target = makeRing('#ffffff', 0.55, 0.75, 0.95);
  const closing = makeRing('#ffd43b', 2.8, 3.1, 0.95);
  target.visible = closing.visible = false;
  group.add(target, closing);
  // Sideline glow for toe-taps.
  const boundary = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 140), new THREE.MeshBasicMaterial({ color: '#f87171', transparent: true, opacity: 0.6 }));
  boundary.rotation.x = -Math.PI / 2;
  boundary.position.set(SIDELINE, 0.05, 0);
  boundary.visible = mode === 'toetap';
  group.add(boundary);

  const wfx = weatherFx(m);
  const vR = (7.2 + (st.speed / 100) * 2.6) * wfx.speed;
  const vCB = (7.9 + Math.random() * 0.6) * wfx.speed;
  let zoneHalf = 1.0 * tol;
  let phase = 'wait';
  let t = 0;
  let dir = { x: 0, z: -1 };
  let sep = 0.4;
  let throwAt = null;
  let flight = null;
  let tapErr = null;
  let after = null;
  let toe = null;
  let fx = null;
  let sitT = 0;

  rig(camera, startX * 0.6, -6, 0, { zoom: 1.05, snap: true });

  const pickRoute = (i) => {
    if (phase !== 'pick') return;
    route = options[Math.max(0, Math.min(options.length - 1, i))];
    sfx.select();
    hud.bottom(null);
    const pts = [{ x: startX, z: 0 }, { x: startX, z: -route.depth }];
    const L = Math.hypot(route.dir.x, route.dir.z);
    pts.push({ x: startX + (route.dir.x / L) * 6, z: -route.depth + (route.dir.z / L) * 6 });
    routeLine = makeRouteLine(pts, '#ffd43b', 0.7);
    group.add(routeLine);
    zone.position.set(startX, 0.04, -route.depth);
    zone.scale.set(1.6, zoneHalf, 1);
    zone.visible = mode !== 'jump';
    phase = 'pre';
    t = 0;
    hud.instr(mode === 'jump' ? 'Beat the press, then go up and get it!' : `${route.name} · tap in the yellow zone to cut`);
  };

  const showPicker = () => {
    if (options.length === 1) { phase = 'pick'; pickRoute(0); return; }
    phase = 'pick';
    hud.instr('Pick your route');
    const box = document.createElement('div');
    box.className = 'hud-choices';
    options.forEach((r, i) => {
      const b = document.createElement('button');
      b.className = 'hbtn wide';
      b.innerHTML = `<span class="k">${i + 1}</span>${r.name}<small>${r.depth} yds</small>`;
      b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); pickRoute(i); });
      box.append(b);
    });
    hud.bottom(box);
  };

  const tap = () => {
    if (phase === 'route') doCut(Math.abs(-pos.z - route.depth));
    else if (phase === 'flight' && tapErr === null) { tapErr = (t - flight.t0) - flight.T; sfx.click(); if (mode === 'jump') { setPose(wr, 'catch'); jumpT = 0.01; } }
    else if (phase === 'toe' && toe && toe.tap === null) { toe.tap = t; sfx.click(); }
  };
  let jumpT = 0;

  const doCut = (e) => {
    phase = 'break';
    const perfect = e < zoneHalf * 0.4;
    const good = e < zoneHalf;
    let base = perfect ? 3.0 : good ? 1.8 : e < zoneHalf * 2.2 ? 0.9 : 0.3;
    if (press && !perfect) base *= 0.7;
    sep = base + (st.speed / 100) * 0.6 + (st.skill / 100) * 0.4;
    hud.big(perfect ? 'PERFECT BREAK!' : good ? 'GOOD BREAK' : 'SLOPPY BREAK', perfect ? '#4ade80' : good ? '#fff' : '#fbbf24', 700);
    sfx.juke();
    playAction(wr, ['juke', 'juke'], { fps: 10 });
    const L = Math.hypot(route.dir.x, route.dir.z);
    dir = { x: route.dir.x / L, z: route.dir.z / L };
    zone.visible = false;
    if (routeLine) routeLine.material.opacity = 0.2;
    hud.instr(mode === 'jump' ? 'Tap at the top of the jump!' : 'Tap when the rings meet!');
    throwAt = t + 0.3;
  };

  bindInput(ctx, {
    down: () => tap(),
    key: (ev, down) => {
      if (!down) return;
      if (phase === 'pick' && ['1', '2', '3'].includes(ev.key)) return pickRoute(Number(ev.key) - 1);
      if (ev.key === ' ' || ev.key === 'Enter') tap();
    },
  });

  const tips = {
    route: ['Before the snap, pick one of three routes.', 'Tap when you hit the yellow zone to snap your break. Perfect timing = big separation.', 'Then tap again exactly when the shrinking ring meets the white ring.'],
    jump: ['A deep ball against tight coverage.', 'Tap when the shrinking ring meets the white ring to leap at the right moment. Strength wins contested balls.'],
    toetap: ['Run the out route to the sideline and catch it (tap when the rings meet).', 'Then tap AGAIN before you cross the red line to drag your feet in bounds!'],
  };
  maybeTip(ctx, { route: 'Wide Receiver', jump: 'Jump Ball', toetap: 'Sideline Toe-Tap' }[mode], tips[mode], showPicker);

  const finish = (result) => {
    if (phase === 'over') return;
    phase = 'over';
    endPlay(ctx, finalize(result, m));
  };

  // Auto-pick if the player waits too long.
  let pickTimer = 0;

  return (dt) => {
    if (phase === 'wait') return;
    t += dt;
    if (fx && !fx(dt)) fx = null;
    if (phase === 'pick') {
      pickTimer += dt;
      if (pickTimer > 6) pickRoute(1);
      return;
    }
    if (phase === 'pre') {
      if (t > 0.45) { phase = 'route'; t = 0; sfx.whistle(); setPose(wr, null); if (mode === 'jump') doCut(zoneHalf * 0.7); }
      return;
    }
    if (phase === 'over') return;

    if (!after) {
      let sp = vR * Math.min(1, t / 0.4 + 0.2);
      if (route.sit && phase !== 'route') { sitT += dt; if (sitT > route.sit) sp *= 0.15; }
      if (phase === 'toe') sp *= 0.6;
      pos.x += dir.x * sp * dt;
      pos.z += dir.z * sp * dt;
      if (mode !== 'toetap') pos.x = Math.max(-25.5, Math.min(25.5, pos.x));
      pos.z = Math.max(pos.z, -m.yardLine - 9);
      wr.position.set(pos.x, 0, pos.z);
      faceToward(wr, pos.x + dir.x, pos.z + dir.z);
      animateRun(wr, dt, sp);
    }
    if (phase === 'route' && -pos.z > route.depth + zoneHalf * 2.4) doCut(99);

    // Cornerback trails by the separation you earned.
    let cbT;
    if (phase === 'route') cbT = press ? { x: pos.x + 0.4, z: pos.z - 0.9 } : { x: pos.x + 0.6, z: Math.min(cbPos.z, pos.z - 2.2) };
    else {
      cbT = { x: pos.x - dir.x * sep + 0.3, z: pos.z - dir.z * sep };
      if (flight && t - flight.t0 > flight.T * 0.5) cbT = { x: flight.land.x + 0.5 * Math.sign(cbPos.x - flight.land.x || 1), z: flight.land.z };
    }
    const dx = cbT.x - cbPos.x;
    const dz = cbT.z - cbPos.z;
    const dd = Math.hypot(dx, dz);
    const csp = Math.min(vCB * (phase === 'route' && !press ? 0.85 : 1), dd / Math.max(dt, 1e-3));
    if (dd > 0.02) { cbPos.x += (dx / dd) * csp * dt; cbPos.z += (dz / dd) * csp * dt; }
    cb.position.set(cbPos.x, 0, cbPos.z);
    const pedal = phase === 'route' && dz < -0.1;
    setBackpedal(cb, pedal);
    faceToward(cb, pedal ? cbPos.x : cbPos.x + dx, pedal ? cbPos.z + 5 : cbPos.z + dz);
    animateRun(cb, dt, csp);
    if (safety) {
      const sx = (flight ? flight.land.x : pos.x) - safety.pos.x;
      const sz = (flight ? flight.land.z : pos.z - 4) - safety.pos.z;
      const sd = Math.hypot(sx, sz);
      if (sd > 0.3) { safety.pos.x += (sx / sd) * 6.5 * dt; safety.pos.z += (sz / sd) * 6.5 * dt; }
      safety.mesh.position.set(safety.pos.x, 0, safety.pos.z);
      faceToward(safety.mesh, safety.pos.x + sx, safety.pos.z + sz);
      animateRun(safety.mesh, dt, 6.5);
    }

    if (throwAt !== null && t >= throwAt && !flight) {
      const T = mode === 'jump' ? 1.5 : 0.8 + route.depth / 32;
      let lead = { x: pos.x + dir.x * vR * T * (route.sit ? 0.3 : 1), z: pos.z + dir.z * vR * T * (route.sit ? 0.3 : 1) };
      if (mode === 'toetap') lead.x = Math.min(lead.x, SIDELINE - 1.2);
      lead.x = Math.max(-25.5, Math.min(mode === 'toetap' ? SIDELINE : 25.5, lead.x));
      lead.z = Math.max(lead.z, -m.yardLine - 8);
      flight = { from: { x: 0.4, z: 4.7 }, land: lead, T, t0: t };
      phase = 'flight';
      ball.visible = true;
      target.visible = closing.visible = true;
      playAction(qb, ['throwWind', 'throwRelease', 'throwRelease'], { fps: 8 });
      faceToward(qb, lead.x, lead.z);
      sfx.throw();
    }
    if (flight && !after && phase === 'flight') {
      const f = Math.min(1, (t - flight.t0) / flight.T);
      const H = mode === 'jump' ? 6 : 3;
      const bx = flight.from.x + (flight.land.x - flight.from.x) * f;
      const bz = flight.from.z + (flight.land.z - flight.from.z) * f;
      ball.position.set(bx, 2.2 + (1.6 - 2.2) * f + 4 * H * f * (1 - f), bz);
      ball.userData.shadow.position.set(bx, 0.04, bz);
      target.position.set(pos.x, 0.06, pos.z);
      closing.position.set(pos.x, 0.07, pos.z);
      closing.scale.setScalar(Math.max(0.05, (1 + (1 - f) * 3.2) * 0.24));
      if (jumpT > 0) { jumpT += dt; setHop(wr, Math.sin(Math.min(Math.PI, jumpT * 5)) * 1.2); }
      if (f >= 1 && t - flight.t0 > flight.T + 0.15) resolveCatch();
    }

    // Toe-tap: drift toward the sideline after the catch.
    if (phase === 'toe') {
      ball.position.set(pos.x + 0.4, 1.4, pos.z);
      const crossed = pos.x >= SIDELINE;
      if (toe.tap !== null) {
        const inb = toe.tap < toe.crossT;
        if (inb) { hud.big('FEET IN!', '#4ade80', 700); sfx.cheer(true); ctx.slowMo(0.5); }
        return finish(inb ? toe.result : { complete: false, yards: 0, quality: 0.3, text: 'Out of bounds. No catch.' });
      }
      if (crossed) return finish({ complete: false, yards: 0, quality: 0.3, text: 'Out of bounds. No catch.' });
    }

    if (!after) rig(camera, pos.x * 0.75, Math.min(-4, pos.z), dt, { zoom: 1.05, k: 3 });
    if (after) {
      after.time += dt;
      if (after.time < after.dur) {
        pos.z -= 8.2 * dt;
        wr.position.set(pos.x, 0, pos.z);
        faceToward(wr, pos.x, pos.z - 1);
        animateRun(wr, dt, 8.2);
        ball.position.set(pos.x + 0.4, 1.4, pos.z);
        rig(camera, pos.x * 0.75, pos.z, dt, { zoom: 1, k: 3 });
      } else {
        if (!after.result.td) { sfx.hit(); ctx.shake(0.2); knockDown(wr, 1); }
        else celebrate(wr);
        finish(after.result);
      }
    }
  };

  function resolveCatch() {
    target.visible = closing.visible = false;
    setHop(wr, 0);
    const window = (mode === 'jump' ? 0.12 : 0.09) * tol * (1 + sep * 0.12) * (0.85 + st.skill / 400);
    const err = tapErr === null ? 9 : Math.abs(tapErr);
    const nearDef = Math.min(dist2(cbPos, pos), safety ? dist2(safety.pos, pos) : 99);
    const contested = nearDef < 1.3 || sep < 1 || mode === 'jump';
    let result;
    if (err <= window * 2.2) {
      const perfect = err <= window;
      let caught = true;
      if (Math.random() < wfx.slip * (perfect ? 0.5 : 1)) caught = false;
      else if (contested) {
        const p = (perfect ? 0.72 : 0.42) + st.strength / 400 - (mode === 'jump' && safety && dist2(safety.pos, pos) < 2 ? 0.15 : 0);
        caught = Math.random() < p;
      }
      if (caught) {
        sfx.catch();
        setPose(wr, null);
        hud.big(perfect ? 'HANDS!' : 'CAUGHT', perfect ? '#4ade80' : '#fff', 700);
        const air = -pos.z;
        const yac = mode === 'toetap' ? 0 : Math.max(0, sep * 1.9 + (perfect ? 3 : 0) + (st.speed / 100) * 3 + Math.random() * 3 - (contested ? 3 : 0)) * (call === 'risky' ? 1.15 : 1);
        const quality = (perfect ? 0.72 : 0.55) + Math.min(3.5, sep) * 0.06 + Math.min(0.15, (air + yac) / 100) + (mode !== 'route' ? 0.05 : 0);
        const res = finalize({ complete: true, yards: air + yac, quality }, m);
        if (mode === 'jump' || res.yards >= 20) ctx.slowMo(0.5);
        if (mode === 'toetap') {
          phase = 'toe';
          const toTravel = SIDELINE - pos.x;
          const windowT = Math.max(0.2, (0.35 + st.skill / 500) * tol);
          toe = { tap: null, result: res, crossT: t + Math.min(windowT, toTravel / (vR * 0.6 * Math.max(0.2, dir.x))) };
          hud.instr('TAP NOW: drag your feet!');
          return;
        }
        after = { time: 0, dur: Math.max(0.1, (res.yards - air) / 8.2), result: res };
        if (res.td) fx = confetti(ctx.scene, new THREE.Vector3(pos.x, 0, -m.yardLine - 2), [opts.teamColors[0], opts.teamColors[1], '#fff']);
        return;
      }
      result = { complete: false, yards: 0, quality: 0.3, text: mode === 'jump' ? 'Out-muscled at the catch point.' : 'Ripped away at the catch point!' };
    } else if (contested && Math.random() < (call === 'risky' || mode === 'jump' ? 0.38 : 0.18)) {
      result = { turnover: true, complete: false, yards: 0, quality: 0.04, text: 'INTERCEPTED!' };
    } else {
      result = { complete: false, yards: 0, quality: tapErr === null ? 0.12 : 0.22, text: tapErr === null ? 'Never looked for it.' : tapErr < 0 ? 'Too early: dropped.' : 'Too late: off the hands.' };
    }
    ball.position.y = 0.2;
    setPose(wr, null);
    finish(result);
  }
}
