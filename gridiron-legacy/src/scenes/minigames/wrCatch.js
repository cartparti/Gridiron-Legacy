// Wide receiver key moment: snap your route break in the zone, then time the catch.
//
// Controls: tap anywhere (or Space) once to make your cut, then again when the shrinking ring meets the target.
// Stats: Speed = beating the corner, Skill = catch window + cleaner breaks, Strength = contested catches.
import * as THREE from 'three';
import { makePlayer, animateRun, makeBall, makeRing, faceToward, knockDown, confetti } from '../actors.js';
import { bindInput, maybeTip, follow, endPlay, finalize, dist2 } from './common.js';
import { sfx } from '../../audio/sfx.js';

export function wrCatch(ctx) {
  const { group, camera, hud, opts } = ctx;
  const m = opts.moment;
  const st = opts.stats;
  const tol = opts.tolerance;
  const call = opts.call;
  const off = opts.teamColors;
  const def = opts.oppColors;
  const route = {
    safe: { depth: 5, dir: { x: 1, z: 0 }, name: 'Quick out' },
    balanced: { depth: 10, dir: { x: -1, z: -0.15 }, name: 'Dig' },
    risky: { depth: 17, dir: { x: -0.55, z: -1 }, name: 'Post' },
  }[call];
  const depth = Math.min(route.depth, m.yardLine + 4);
  const zoneHalf = 1.3 * tol;

  const wr = makePlayer(off, { highlight: true });
  const start = { x: 9, z: 0 };
  wr.position.set(start.x, 0, start.z);
  group.add(wr);
  const qb = makePlayer(off);
  qb.position.set(0, 0, 5);
  group.add(qb);
  const cb = makePlayer(def);
  const cbPos = { x: 9.6, z: -6.5 };
  cb.position.set(cbPos.x, 0, cbPos.z);
  cb.rotation.y = Math.PI;
  group.add(cb);
  for (let i = 0; i < 5; i++) {
    const ol = makePlayer(off);
    ol.position.set(-4 + i * 2, 0, 1);
    group.add(ol);
    const dl = makePlayer(def);
    dl.position.set(-4 + i * 2, 0, -1);
    dl.rotation.y = Math.PI;
    group.add(dl);
  }

  // Break zone on the ground.
  const zone = new THREE.Mesh(new THREE.PlaneGeometry(4, zoneHalf * 2), new THREE.MeshBasicMaterial({ color: '#ffd43b', transparent: true, opacity: 0.45, depthWrite: false }));
  zone.rotation.x = -Math.PI / 2;
  zone.position.set(start.x, 0.05, -depth);
  group.add(zone);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.6, 3), new THREE.MeshBasicMaterial({ color: '#ffd43b' }));
  arrow.rotation.x = -Math.PI / 2;
  arrow.rotation.z = Math.atan2(-route.dir.x, -route.dir.z) + Math.PI;
  arrow.position.set(start.x + route.dir.x * 2.5, 0.1, -depth + route.dir.z * 2.5);
  group.add(arrow);

  const ball = makeBall();
  ball.visible = false;
  group.add(ball);
  group.add(ball.userData.shadow);
  const target = makeRing('#ffffff', 0.55, 0.75, 0.95);
  const closing = makeRing('#ffd43b', 2.8, 3.1, 0.95);
  target.visible = false;
  closing.visible = false;
  group.add(target, closing);

  const vR = 7.4 + (st.speed / 100) * 2.6;
  const vCB = 7.6 + Math.random() * 0.6;
  let phase = 'wait';
  let t = 0;
  let pos = { ...start };
  let dir = { x: 0, z: -1 };
  let sep = 0.5;
  let cutAt = null;
  let throwAt = null;
  let flight = null;
  let tapErr = null;
  let after = null;
  let fx = null;

  camera.position.set(10, 11, 13);
  camera.lookAt(8, 0, -9);

  const tap = () => {
    if (phase === 'route') {
      const e = Math.abs(-pos.z - depth);
      doCut(e);
    } else if (phase === 'flight' && tapErr === null) {
      tapErr = (t - flight.t0) - flight.T; // negative = early
      sfx.click();
    }
  };

  const doCut = (e) => {
    phase = 'break';
    cutAt = t;
    const base = e < zoneHalf * 0.4 ? 3.3 : e < zoneHalf ? 2.1 : e < zoneHalf * 2.2 ? 1.1 : 0.4;
    sep = base + (st.speed / 100) * 0.7 + (st.skill / 100) * 0.4 - (call === 'risky' ? 0.3 : 0);
    const label = e < zoneHalf * 0.4 ? 'PERFECT BREAK!' : e < zoneHalf ? 'GOOD BREAK' : 'SLOPPY BREAK';
    hud.big(label, e < zoneHalf * 0.4 ? '#4ade80' : e < zoneHalf ? '#fff' : '#fbbf24', 700);
    sfx.juke();
    const len = Math.hypot(route.dir.x, route.dir.z);
    dir = { x: route.dir.x / len, z: route.dir.z / len };
    zone.visible = false;
    arrow.visible = false;
    hud.instr('Tap when the rings meet!');
    throwAt = t + 0.35;
  };

  bindInput(ctx, {
    down: () => tap(),
    key: (ev, down) => { if (down && (ev.key === ' ' || ev.key === 'Enter')) tap(); },
  });

  maybeTip(ctx, 'Wide Receiver', [
    'Run your route and tap when you reach the yellow zone to snap your break. Perfect timing = big separation.',
    'Then the ball is in the air: tap again exactly when the shrinking yellow ring meets the white ring.',
    'Low separation means a contested catch. Strength helps you win those.',
  ], () => { phase = 'pre'; hud.instr('Tap in the yellow zone to cut'); });

  const finish = (result) => {
    phase = 'over';
    endPlay(ctx, finalize(result, m));
  };

  return (dt) => {
    if (phase === 'wait') return;
    t += dt;
    if (fx && !fx(dt)) fx = null;
    if (phase === 'pre') {
      if (t > 0.5) { phase = 'route'; t = 0; sfx.whistle(); }
      return;
    }
    if (phase === 'over') return;

    // Receiver movement.
    if (!after) {
      const sp = vR * Math.min(1, t / 0.4 + 0.2);
      pos.x += dir.x * sp * dt;
      pos.z += dir.z * sp * dt;
      pos.x = Math.max(-25.5, Math.min(25.5, pos.x));
      wr.position.set(pos.x, 0, pos.z);
      faceToward(wr, pos.x + dir.x, pos.z + dir.z);
      animateRun(wr, dt, sp);
    }
    // Missed the zone entirely: forced late, sloppy cut.
    if (phase === 'route' && -pos.z > depth + zoneHalf * 2.5) doCut(99);

    // Cornerback: backpedal, then trail at a distance set by separation.
    let cbTarget;
    if (phase === 'route') {
      cbTarget = { x: pos.x + 0.6, z: Math.min(cbPos.z, pos.z - 2.2) };
    } else {
      cbTarget = { x: pos.x - dir.x * sep + 0.3, z: pos.z - dir.z * sep };
      if (flight && t - flight.t0 > flight.T * 0.55) cbTarget = { x: flight.land.x + 0.6 * Math.sign(cbPos.x - flight.land.x || 1), z: flight.land.z };
    }
    const dx = cbTarget.x - cbPos.x;
    const dz = cbTarget.z - cbPos.z;
    const dd = Math.hypot(dx, dz);
    const csp = Math.min(vCB * (phase === 'route' ? 0.85 : 1), dd / dt);
    if (dd > 0.02) { cbPos.x += (dx / dd) * csp * dt; cbPos.z += (dz / dd) * csp * dt; }
    cb.position.set(cbPos.x, 0, cbPos.z);
    faceToward(cb, pos.x, pos.z);
    animateRun(cb, dt, csp);

    // Throw and flight.
    if (throwAt !== null && t >= throwAt && !flight) {
      const T = 0.85 + depth / 30;
      const lead = { x: pos.x + dir.x * vR * T, z: pos.z + dir.z * vR * T };
      lead.x = Math.max(-25, Math.min(25, lead.x));
      flight = { from: { x: 0.4, z: 4.7 }, land: lead, T, t0: t };
      phase = 'flight';
      ball.visible = true;
      target.visible = true;
      closing.visible = true;
      sfx.throw();
      faceToward(qb, lead.x, lead.z);
    }
    if (flight && !after) {
      const f = Math.min(1, (t - flight.t0) / flight.T);
      const bx = flight.from.x + (flight.land.x - flight.from.x) * f;
      const bz = flight.from.z + (flight.land.z - flight.from.z) * f;
      ball.position.set(bx, 2.2 + (1.5 - 2.2) * f + 4 * 3 * f * (1 - f), bz);
      ball.rotation.y = Math.atan2(flight.land.x - flight.from.x, flight.land.z - flight.from.z);
      ball.userData.shadow.position.set(bx, 0.04, bz);
      target.position.set(pos.x, 0.06, pos.z);
      closing.position.set(pos.x, 0.07, pos.z);
      const s = Math.max(0.01, 1 + (1 - f) * 3.2);
      closing.scale.setScalar(s * 0.24);
      if (f >= 1 && t - flight.t0 > flight.T + 0.18) resolveCatch();
    }
    if (!after) follow(camera, pos.x, pos.z, { x: 1.5, y: 11, z: 13 }, { x: -1, y: 0, z: -8 }, dt, 3);

    if (after) {
      after.time += dt;
      if (after.time < after.dur) {
        pos.z -= 8.5 * dt;
        wr.position.set(pos.x, 0, pos.z);
        wr.rotation.y = 0;
        animateRun(wr, dt, 8.5);
        ball.position.set(pos.x + 0.4, 1.4, pos.z);
        follow(camera, pos.x, pos.z, { x: 1.5, y: 11, z: 13 }, { x: -1, y: 0, z: -8 }, dt, 3);
      } else {
        if (!after.result.td) { sfx.hit(); knockDown(wr, 1, -1); }
        finish(after.result);
      }
    }
  };

  function resolveCatch() {
    target.visible = false;
    closing.visible = false;
    const window = 0.13 * tol * (1 + sep * 0.12) * (0.85 + st.skill / 400);
    const err = tapErr === null ? 9 : Math.abs(tapErr);
    const contested = dist2(cbPos, pos) < 1.1 || sep < 1;
    let result;
    if (err <= window || (err <= window * 2.3)) {
      const perfect = err <= window;
      let caught = true;
      if (contested && Math.random() > (perfect ? 0.75 : 0.5) + st.strength / 400) caught = false;
      if (caught) {
        sfx.catch();
        hud.big(perfect ? 'HANDS!' : 'CAUGHT', perfect ? '#4ade80' : '#fff', 700);
        const air = -pos.z;
        const yac = Math.max(0, sep * 2.1 + (perfect ? 3.5 : 0) + (st.speed / 100) * 3.5 + Math.random() * 3 - (contested ? 3 : 0)) * (call === 'risky' ? 1.2 : 1);
        const quality = (perfect ? 0.72 : 0.55) + Math.min(3.5, sep) * 0.06 + Math.min(0.15, (air + yac) / 100);
        const res = finalize({ complete: true, yards: air + yac, quality }, m);
        after = { time: 0, dur: Math.max(0.1, (res.yards - air) / 8.5), result: res };
        if (res.td) fx = confetti(ctx.scene, new THREE.Vector3(pos.x, 0, -m.yardLine - 2), [opts.teamColors[0], opts.teamColors[1], '#fff']);
        return;
      }
      result = { complete: false, yards: 0, quality: 0.3, text: 'Ripped away at the catch point!' };
    } else if (contested && Math.random() < (call === 'risky' ? 0.4 : 0.2)) {
      result = { turnover: true, complete: false, yards: 0, quality: 0.04, text: 'INTERCEPTED!' };
    } else {
      result = { complete: false, yards: 0, quality: tapErr === null ? 0.12 : 0.22, text: tapErr === null ? 'Never looked for it.' : tapErr < 0 ? 'Grabbed too early — dropped.' : 'Too late — off the hands.' };
    }
    ball.position.y = 0.2;
    finish(result);
  }
}
