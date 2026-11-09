// Quarterback key moment: read the coverage, pick a receiver, set aim and power, throw.
//
// Controls
//   Touch/mouse: press near a receiver to pick him, drag to place the ball, hold to build power, release to throw.
//   Keyboard:    1/2/3 pick a receiver, arrows nudge the aim, hold Space for power, release to throw.
//
// Stats: Skill = accuracy, Football IQ = clearer coverage read + more pocket time,
//        Strength = ball speed, Speed = a little extra time to escape pressure.
import * as THREE from 'three';
import { makePlayer, animateRun, makeBall, makeRing, makeLabel, makeRouteLine, faceToward, knockDown, confetti } from '../actors.js';
import { bindInput, maybeTip, follow, endPlay, finalize, dist2, hudMeter, gaussR } from './common.js';
import { sfx } from '../../audio/sfx.js';

// Route shapes per play call: start [x, z] and waypoints relative to the start.
const ROUTES = {
  safe: [
    { start: [-11, 0], pts: [[0, -4], [6, -9]], ext: true },
    { start: [-5, 0], pts: [[0, -3], [-6, -5]], ext: true },
    { start: [10, 0], pts: [[0, -9], [-1, -7]], ext: false },
  ],
  balanced: [
    { start: [-11, 0], pts: [[0, -11], [12, -12]], ext: true },
    { start: [-5, 0], pts: [[0, -18]], ext: true },
    { start: [10, 0], pts: [[0, -11], [6, -11]], ext: true },
  ],
  risky: [
    { start: [-11, 0], pts: [[0, -42]], ext: true },
    { start: [-5, 0], pts: [[0, -12], [10, -30]], ext: true },
    { start: [10, 0], pts: [[0, -11], [9, -23]], ext: true },
  ],
};

function pathPoint(path, s, ext) {
  let acc = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (acc + len >= s || (i === path.length - 1 && !ext)) {
      const f = Math.min(1, (s - acc) / len);
      return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f };
    }
    acc += len;
  }
  const a = path[path.length - 2];
  const b = path[path.length - 1];
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const over = s - acc;
  return { x: b.x + ((b.x - a.x) / len) * over, z: b.z + ((b.z - a.z) / len) * over };
}

export function qbThrow(ctx) {
  const { group, camera, hud, opts } = ctx;
  const m = opts.moment;
  const st = opts.stats;
  const tol = opts.tolerance;
  const off = opts.teamColors;
  const def = opts.oppColors;
  const backLine = -(m.yardLine + 9.5);
  const clampField = (p) => ({ x: Math.max(-25.5, Math.min(25.5, p.x)), z: Math.max(backLine, p.z) });

  // --- cast
  const qb = makePlayer(off, { highlight: true });
  qb.position.set(0, 0, 5);
  group.add(qb);
  for (let i = 0; i < 5; i++) {
    const ol = makePlayer(off);
    ol.position.set(-4 + i * 2, 0, 1);
    group.add(ol);
  }
  const dls = [];
  for (let i = 0; i < 4; i++) {
    const dl = makePlayer(def);
    dl.position.set(-3 + i * 2, 0, -1);
    dl.rotation.y = Math.PI;
    group.add(dl);
    dls.push(dl);
  }
  const lags = [0.25, 0.45, 0.75].sort(() => Math.random() - 0.5);
  const recs = ROUTES[opts.call].map((r, i) => {
    const path = [{ x: r.start[0], z: r.start[1] }, ...r.pts.map(([dx, dz]) => clampField({ x: r.start[0] + dx, z: r.start[1] + dz }))];
    const mesh = makePlayer(off);
    mesh.position.set(path[0].x, 0, path[0].z);
    group.add(mesh);
    const label = makeLabel(String(i + 1), { color: '#ffd43b' });
    label.position.set(0, 3.3, 0);
    mesh.add(label);
    const ring = makeRing('#4ade80', 0.9, 1.25, 0.85);
    mesh.add(ring);
    const line = makeRouteLine(path.concat(r.ext ? [pathPoint(path, 1e3 / 25, true)] : []).map(clampField), '#ffffff');
    group.add(line);
    const dmesh = makePlayer(def);
    const dpos = { x: path[0].x + (path[0].x < 0 ? 1 : -1), z: path[0].z - 6 - Math.random() * 2 };
    dmesh.position.set(dpos.x, 0, dpos.z);
    dmesh.rotation.y = Math.PI;
    group.add(dmesh);
    return {
      path, ext: r.ext, mesh, ring, label, line, s: 0, speed: 8.2 + Math.random() * 1.2, pos: { ...path[0] }, vel: { x: 0, z: 0 },
      hist: [], d: { mesh: dmesh, pos: dpos, lag: lags[i], speed: 8.4 }, sep: 5,
    };
  });
  let safety = null;
  if (opts.call !== 'safe') {
    safety = { mesh: makePlayer(def), pos: { x: 0, z: -20 - Math.random() * 4 }, speed: 7 };
    safety.mesh.rotation.y = Math.PI;
    safety.mesh.position.set(safety.pos.x, 0, safety.pos.z);
    group.add(safety.mesh);
  }

  const ball = makeBall();
  group.add(ball);
  group.add(ball.userData.shadow);
  ball.visible = false;
  const reticle = makeRing('#ffd43b', 0.55, 0.8, 1);
  reticle.visible = false;
  group.add(reticle);
  const arcGeo = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 24 }, () => new THREE.Vector3()));
  const arc = new THREE.Line(arcGeo, new THREE.LineBasicMaterial({ color: '#ffd43b', transparent: true, opacity: 0.8 }));
  arc.visible = false;
  group.add(arc);

  // --- HUD
  const pocketM = hudMeter('Pocket');
  const powerM = hudMeter('Power');
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;gap:12px;';
  pocketM.el.style.flex = '1';
  powerM.el.style.flex = '1';
  box.append(pocketM.el, powerM.el);
  hud.bottom(box);

  // --- state
  const pocketTime = (2.6 + st.iq * 0.012 + st.speed * 0.005) * (0.75 + tol * 0.25) + (opts.call === 'risky' ? 0.5 : 0);
  const iqNoise = Math.max(0, (100 - st.iq) / 32);
  let phase = 'pre';
  let t = 0;
  let aim = null; // { rec, point, charge, chargeStart, keyboard }
  let flight = null;
  let after = null;
  const keys = {};
  let fx = null;

  camera.position.set(0, 19, 22);
  camera.lookAt(0, 0, -9);

  const pickRec = (pt) => {
    let best = recs[0];
    let bd = Infinity;
    for (const r of recs) {
      const d = pt ? dist2(r.pos, pt) : -r.sep;
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  };

  const startAim = (rec, point, keyboard) => {
    if (phase !== 'live' || flight) return;
    aim = { rec, point: point ? clampField({ x: point.x, z: point.z }) : { x: rec.pos.x + rec.vel.x * 0.8, z: rec.pos.z + rec.vel.z * 0.8 }, chargeStart: keyboard ? null : t, keyboard };
    reticle.visible = true;
    arc.visible = true;
    sfx.select();
  };

  const release = () => {
    if (!aim || flight || phase !== 'live') return;
    if (aim.chargeStart === null) aim.chargeStart = t - 0.4; // keyboard throw without hold = soft toss
    const p = Math.min(1.4, (t - aim.chargeStart) / 0.85);
    const over = p > 1.12;
    const pocketFrac = t / pocketTime;
    const sd = ((1.5 - st.skill * 0.011) / tol) * (over ? 1.9 : 1) * (pocketFrac > 0.85 ? 1.35 : 1);
    const land = clampField({ x: aim.point.x + gaussR() * sd * 0.8, z: aim.point.z + gaussR() * sd });
    const from = { x: qb.position.x + 0.4, z: qb.position.z - 0.3 };
    const dist = Math.hypot(land.x - from.x, land.z - from.z);
    const v = 14 + Math.min(1, p) * (7 + st.strength * 0.1);
    const T = Math.max(0.35, dist / v);
    const H = Math.max(1.2, dist * 0.13 * (1.25 - Math.min(1, p) * 0.45));
    // Will the receiver get there? He adjusts if the ball is within reach of his route.
    const r = aim.rec;
    const routeAt = pathPoint(r.path, r.s + r.speed * T, r.ext);
    const reach = 3.4 * Math.sqrt(tol);
    const adjusts = dist2(routeAt, land) <= reach || dist2(r.pos, land) <= r.speed * T * 1.1;
    flight = { from, land, T, H, t0: t, rec: r, adjusts, over, p };
    ball.visible = true;
    reticle.visible = false;
    arc.visible = false;
    hud.instr('');
    sfx.throw();
    if (over) hud.big('OVERTHROWN!', '#fbbf24', 700);
    aim = null;
  };

  bindInput(ctx, {
    down: (ev, pt) => { if (pt && phase === 'live' && !flight) startAim(pickRec(pt), pt, false); },
    move: (ev, pt) => { if (aim && !aim.keyboard && pt) aim.point = clampField({ x: pt.x, z: pt.z }); },
    up: () => { if (aim && !aim.keyboard) release(); },
    key: (ev, down) => {
      keys[ev.key] = down;
      if (!down) { if (ev.key === ' ' && aim) release(); return; }
      if (['1', '2', '3'].includes(ev.key)) startAim(recs[Number(ev.key) - 1], null, true);
      if (ev.key === ' ') {
        if (!aim) startAim(pickRec(null), null, true);
        if (aim) aim.chargeStart = t;
      }
    },
  });

  const begin = () => {
    phase = 'pre';
    t = 0;
    hud.instr('Read the defense…');
  };
  maybeTip(ctx, 'Quarterback', [
    'Green rings = open, red = covered. A higher Football IQ makes the colors more reliable.',
    'Press near a receiver, drag to where the ball should land (lead him!), hold for power, release to throw.',
    'Too much power overthrows. Wait too long and you get sacked.',
    'Keyboard: 1 / 2 / 3, arrows to aim, hold Space.',
  ], begin);
  phase = 'wait';

  const ringColor = (sep) => (sep > 3.2 ? '#4ade80' : sep > 1.7 ? '#fbbf24' : '#f87171');

  return (dt) => {
    if (phase === 'wait') return;
    t += dt;
    if (phase === 'pre') {
      if (t > 0.9) { phase = 'live'; t = 0; sfx.whistle(); hud.instr('Pick a receiver & throw!'); recs.forEach((r) => (r.line.material.opacity = 0.35)); }
      return;
    }
    if (fx && !fx(dt)) fx = null;

    // Receivers run routes (unless adjusting to a thrown ball or running after the catch).
    for (const r of recs) {
      const prev = { ...r.pos };
      if (after && after.rec === r) {
        // handled below
      } else if (flight && flight.rec === r && flight.adjusts) {
        const remain = Math.max(0.05, flight.T - (t - flight.t0));
        const dx = flight.land.x - r.pos.x;
        const dz = flight.land.z - r.pos.z;
        const d = Math.hypot(dx, dz);
        const sp = Math.min(r.speed * 1.15, d / remain);
        if (d > 0.01) { r.pos.x += (dx / d) * sp * dt; r.pos.z += (dz / d) * sp * dt; }
      } else if (!after) {
        r.s += r.speed * dt * Math.min(1, t / 0.35);
        Object.assign(r.pos, clampField(pathPoint(r.path, r.s, r.ext)));
      }
      r.vel = { x: (r.pos.x - prev.x) / dt, z: (r.pos.z - prev.z) / dt };
      r.hist.push({ t, x: r.pos.x, z: r.pos.z });
      if (r.hist.length > 120) r.hist.shift();
      r.mesh.position.set(r.pos.x, 0, r.pos.z);
      const sp = Math.hypot(r.vel.x, r.vel.z);
      if (sp > 0.3) faceToward(r.mesh, r.pos.x + r.vel.x, r.pos.z + r.vel.z);
      animateRun(r.mesh, dt, sp);
      // Defender trails the receiver's position from `lag` seconds ago.
      const D = r.d;
      let target;
      if (flight && flight.rec === r && t - flight.t0 > 0.25) target = flight.land;
      else if (after && after.rec === r) target = r.pos;
      else {
        const h = r.hist.find((x) => x.t >= t - D.lag) ?? r.hist[0];
        target = { x: h.x + (h.x < 0 ? 0.7 : -0.7), z: h.z - 0.6 };
      }
      const dx = target.x - D.pos.x;
      const dz = target.z - D.pos.z;
      const dd = Math.hypot(dx, dz);
      const dsp = Math.min(D.speed, dd / dt);
      if (dd > 0.05) { D.pos.x += (dx / dd) * dsp * dt; D.pos.z += (dz / dd) * dsp * dt; }
      D.mesh.position.set(D.pos.x, 0, D.pos.z);
      faceToward(D.mesh, r.pos.x, r.pos.z);
      animateRun(D.mesh, dt, dsp);
      r.sep = Math.min(dist2(r.pos, D.pos), safety ? dist2(r.pos, safety.pos) : 99);
      const shown = r.sep + iqNoise * Math.sin(t * 3.1 + r.d.lag * 9);
      r.ring.material.color.set(ringColor(shown));
    }
    if (safety) {
      const deepest = recs.reduce((a, b) => (b.pos.z < a.pos.z ? b : a));
      const tx = deepest.pos.x * 0.7;
      const tz = Math.min(safety.pos.z, deepest.pos.z - 3);
      const dx = tx - safety.pos.x;
      const dz = (flight ? flight.land.z : tz) - safety.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.1) { safety.pos.x += (dx / d) * safety.speed * dt; safety.pos.z += (dz / d) * safety.speed * dt * 0.6; }
      safety.mesh.position.set(safety.pos.x, 0, safety.pos.z);
      animateRun(safety.mesh, dt, safety.speed * 0.6);
    }

    // Pass rush.
    const pf = Math.min(1, t / pocketTime);
    if (!flight && !after) {
      pocketM.set(1 - pf, pf > 0.75 ? '#f87171' : undefined);
      dls.forEach((d, i) => {
        d.position.z = -1 + pf * pf * 5;
        d.position.x = (-3 + i * 2) * (1 - pf * 0.6);
        animateRun(d, dt, 2 + pf * 4);
      });
      if (pf >= 1 && phase === 'live') {
        phase = 'over';
        sfx.hit();
        knockDown(qb, 1, 1);
        endPlay(ctx, finalize({ sack: true, complete: false, yards: -(4 + Math.floor(Math.random() * 5)), quality: 0.08, text: 'SACKED!' }, m));
        return;
      }
    }

    // Aiming.
    if (aim && !flight) {
      if (aim.keyboard) {
        const s = 14 * dt;
        if (keys.ArrowLeft) aim.point.x -= s;
        if (keys.ArrowRight) aim.point.x += s;
        if (keys.ArrowUp) aim.point.z -= s;
        if (keys.ArrowDown) aim.point.z += s;
        aim.point = clampField(aim.point);
      }
      reticle.position.set(aim.point.x, 0.05, aim.point.z);
      const p = aim.chargeStart === null ? 0 : Math.min(1.4, (t - aim.chargeStart) / 0.85);
      powerM.set(p / 1.4, p > 1.12 ? '#f87171' : 'linear-gradient(90deg,#4ade80,#fbbf24)');
      const pos = arcGeo.attributes.position;
      const from = { x: qb.position.x, z: qb.position.z };
      const d = Math.hypot(aim.point.x - from.x, aim.point.z - from.z);
      const H = Math.max(1.2, d * 0.13 * (1.25 - Math.min(1, p) * 0.45));
      for (let i = 0; i < 24; i++) {
        const f = i / 23;
        pos.setXYZ(i, from.x + (aim.point.x - from.x) * f, 2.2 + (1.3 - 2.2) * f + 4 * H * f * (1 - f), from.z + (aim.point.z - from.z) * f);
      }
      pos.needsUpdate = true;
      faceToward(qb, aim.point.x, aim.point.z);
      qb.userData.arms[1].rotation.x = -2.2;
    }

    // Ball in flight.
    if (flight) {
      const f = Math.min(1, (t - flight.t0) / flight.T);
      const x = flight.from.x + (flight.land.x - flight.from.x) * f;
      const z = flight.from.z + (flight.land.z - flight.from.z) * f;
      const y = 2.2 + (1.3 - 2.2) * f + 4 * flight.H * f * (1 - f);
      ball.position.set(x, y, z);
      ball.rotation.y = Math.atan2(flight.land.x - flight.from.x, flight.land.z - flight.from.z);
      ball.rotation.z += dt * 20;
      ball.userData.shadow.position.set(x, 0.04, z);
      follow(camera, x * 0.6, Math.min(5, z * 0.6 + 4), { x: 0, y: 18, z: 19 }, { x: 0, y: 0, z: -12 }, dt, 2.5);
      if (f >= 1) resolveCatch();
    }

    if (after) {
      const r = after.rec;
      after.time += dt;
      if (after.time < after.dur) {
        r.pos.z -= after.speed * dt;
        r.pos = clampField(r.pos);
        r.mesh.position.set(r.pos.x, 0, r.pos.z);
        r.mesh.rotation.y = 0;
        animateRun(r.mesh, dt, after.speed);
        ball.position.set(r.pos.x + 0.4, 1.4, r.pos.z);
        follow(camera, r.pos.x * 0.5, r.pos.z, { x: 0, y: 11, z: 13 }, { x: 0, y: 0, z: -8 }, dt, 3);
      } else if (!after.done) {
        after.done = true;
        if (!after.td) { sfx.hit(); knockDown(r.mesh, 1, -1); }
        endPlay(ctx, after.result);
      }
    }
  };

  function resolveCatch() {
    const fl = flight;
    flight = null;
    const r = fl.rec;
    const land = fl.land;
    const dR = dist2(r.pos, land);
    let dD = dist2(r.d.pos, land);
    if (safety) dD = Math.min(dD, dist2(safety.pos, land));
    const catchR = 1.25 + 0.25 * tol;
    let result;
    if (dR <= catchR) {
      let caught = true;
      if (dD <= 1.0 && dD < dR) {
        if (Math.random() < 0.45) { result = { turnover: true, complete: false, yards: 0, quality: 0.03, text: 'INTERCEPTED!' }; caught = false; }
        else { result = { complete: false, yards: 0, quality: 0.2, text: 'Broken up at the catch point.' }; caught = false; }
      } else if (dD <= 1.6 && Math.random() > 0.55 + st.strength / 400) {
        result = { complete: false, yards: 0, quality: 0.25, text: 'Contested… and knocked away.' };
        caught = false;
      }
      if (caught) {
        sfx.catch();
        const sep = Math.max(0, dD);
        const yac = Math.max(0, Math.min(30, sep * 1.6 + Math.random() * 3 - 0.5 + (sep > 5 ? 8 : 0)));
        const air = -land.z;
        const total = air + yac;
        const quality = 0.45 + Math.min(4, sep) * 0.07 + (1 - dR / catchR) * 0.15 + Math.min(0.25, total / 80) * (opts.call === 'risky' ? 1.4 : 1);
        result = finalize({ complete: true, yards: total, quality }, m);
        const speed = 8;
        after = { rec: r, time: 0, dur: Math.max(0.2, (result.yards - air) / speed), speed, result, td: result.td };
        if (result.td) fx = confetti(ctx.scene, new THREE.Vector3(r.pos.x, 0, -m.yardLine - 2), [opts.teamColors[0], opts.teamColors[1], '#ffffff']);
        return;
      }
    } else if (dD <= 1.2 && Math.random() < 0.35) {
      result = { turnover: true, complete: false, yards: 0, quality: 0.03, text: 'INTERCEPTED!' };
    } else {
      result = { complete: false, yards: 0, quality: Math.max(0.05, 0.25 - (dR - catchR) * 0.05), text: fl.over ? 'Sailed over his head.' : 'Incomplete.' };
    }
    ball.position.y = 0.2;
    if (result.turnover) { sfx.hit(); knockDown(r.mesh, 0.6); }
    endPlay(ctx, finalize(result, m));
  }
}
