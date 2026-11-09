// Quarterback pass play (also the Hail Mary).
//
// Read the coverage (man, zone or blitz), pick a receiver, drag to set where the ball lands,
// hold for power, release to throw. Keyboard: 1/2/3 pick, arrows aim, hold Space.
// Stats: Skill = accuracy, IQ = coverage read + pocket time, Strength = ball speed, Speed = escape time.
import * as THREE from 'three';
import { makePlayer, animateRun, makeBall, makeRing, makeLabel, makeRouteLine, faceToward, knockDown, setPose, playAction, celebrate, setBackpedal, confetti } from '../actors.js';
import { bindInput, maybeTip, rig, endPlay, finalize, dist2, hudMeter, gaussR, weatherFx } from './common.js';
import { sfx } from '../../audio/sfx.js';

// Route concepts: start x and waypoints relative to the start. sit = receiver stops at the end.
const CONCEPTS = {
  safe: [
    { name: 'Slants', r: [{ x: -10, p: [[0, -3], [6, -8]] }, { x: -4.5, p: [[0, -3], [5, -7]] }, { x: 9.5, p: [[0, -3], [-6, -8]] }] },
    { name: 'Quick Outs', r: [{ x: -10, p: [[0, -5], [-5, -5]] }, { x: -4.5, p: [[0, -4], [-6, -4]] }, { x: 9.5, p: [[0, -5], [5, -5]] }] },
    { name: 'Curl-Flat', r: [{ x: -10, p: [[0, -9], [1, -7]], sit: true }, { x: -4.5, p: [[0, -2], [-7, -3]] }, { x: 9.5, p: [[0, -9], [-1, -7]], sit: true }] },
  ],
  balanced: [
    { name: 'Dig-Seam', r: [{ x: -10, p: [[0, -11], [12, -12]] }, { x: -4.5, p: [[0, -18]] }, { x: 9.5, p: [[0, -11], [6, -11]] }] },
    { name: 'Smash', r: [{ x: -10, p: [[0, -5], [0, -4]], sit: true }, { x: -4.5, p: [[0, -10], [-7, -18]] }, { x: 9.5, p: [[0, -12], [-10, -13]] }] },
    { name: 'Mesh', r: [{ x: -10, p: [[0, -4], [18, -6]] }, { x: -4.5, p: [[0, -6], [-14, -7]] }, { x: 9.5, p: [[0, -15]] }] },
  ],
  risky: [
    { name: 'Four Verticals', r: [{ x: -10, p: [[0, -42]] }, { x: -4.5, p: [[1, -42]] }, { x: 9.5, p: [[0, -42]] }] },
    { name: 'Post-Corner', r: [{ x: -10, p: [[0, -12], [4, -17], [-4, -28]] }, { x: -4.5, p: [[0, -12], [9, -30]] }, { x: 9.5, p: [[0, -10], [6, -22]] }] },
    { name: 'Deep Cross', r: [{ x: -10, p: [[0, -8], [20, -22]] }, { x: -4.5, p: [[0, -30]] }, { x: 9.5, p: [[0, -16], [-4, -20]] }] },
  ],
};
const COVERAGES = [
  { id: 'man', label: 'MAN COVERAGE', w: 4 },
  { id: 'zone', label: 'ZONE COVERAGE', w: 4 },
  { id: 'blitz', label: 'BLITZ!', w: 2 },
];

function pathPoint(path, s, ext) {
  let acc = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 0.001;
    if (acc + len >= s || (i === path.length - 1 && !ext)) {
      const f = Math.min(1, (s - acc) / len);
      return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f };
    }
    acc += len;
  }
  const a = path[path.length - 2];
  const b = path[path.length - 1];
  const len = Math.hypot(b.x - a.x, b.z - a.z) || 0.001;
  const over = s - acc;
  return { x: b.x + ((b.x - a.x) / len) * over, z: b.z + ((b.z - a.z) / len) * over };
}

export function passPlay(ctx) {
  const { group, camera, hud, opts } = ctx;
  const m = opts.moment;
  const st = opts.stats;
  const tol = opts.tolerance;
  const wfx = weatherFx(m);
  const hail = ctx.type === 'qb_hailmary';
  const off = opts.teamColors;
  const def = opts.oppColors;
  const backLine = -(m.yardLine + 9.5);
  const clampField = (p) => ({ x: Math.max(-25.5, Math.min(25.5, p.x)), z: Math.max(backLine, p.z) });

  const concept = hail
    ? { name: 'Hail Mary', r: [-10, -4, 9.5].map((x, i) => ({ x, p: [[0, -m.yardLine - 4 + i * 1.5]], ext: false, sit: true })) }
    : CONCEPTS[opts.call][Math.floor(Math.random() * 3)];
  const coverage = hail ? COVERAGES[1] : (() => { const r = Math.random() * 10; return r < 4 ? COVERAGES[0] : r < 8 ? COVERAGES[1] : COVERAGES[2]; })();

  // --- cast
  const qb = makePlayer(off, { highlight: true });
  qb.position.set(0, 0, 5);
  group.add(qb);
  const linemen = [];
  for (let i = 0; i < 5; i++) {
    const ol = makePlayer(off);
    ol.position.set(-4 + i * 2, 0, 1);
    setPose(ol, 'stance');
    group.add(ol);
    linemen.push(ol);
  }
  const rushers = [];
  const nRush = coverage.id === 'blitz' ? 6 : 4;
  for (let i = 0; i < nRush; i++) {
    const dl = makePlayer(def);
    const x = -(nRush - 1) + i * 2;
    dl.position.set(x, 0, -1.2);
    faceToward(dl, x, 5);
    setPose(dl, 'stance');
    group.add(dl);
    rushers.push({ mesh: dl, x0: x });
  }
  const lags = [0.2, 0.38, 0.62].sort(() => Math.random() - 0.5);
  const recs = concept.r.map((r, i) => {
    const path = [{ x: r.x, z: 0 }, ...r.p.map(([dx, dz]) => clampField({ x: r.x + dx, z: dz }))];
    const ext = !r.sit && r.ext !== false;
    const mesh = makePlayer(off);
    mesh.position.set(path[0].x, 0, 0);
    setPose(mesh, 'stance');
    group.add(mesh);
    const label = makeLabel(String(i + 1));
    label.position.set(0, 3.4, 0);
    mesh.add(label);
    const ring = makeRing('#4ade80', 0.9, 1.25, 0.9);
    mesh.add(ring);
    const lineEnd = ext ? [clampField(pathPoint(path, 60, true))] : [];
    const line = makeRouteLine(path.concat(lineEnd), '#ffffff', 0.6);
    group.add(line);
    const dmesh = makePlayer(def);
    const dpos = hail ? { x: r.x * 0.8, z: -m.yardLine + 2 + Math.random() * 3 } : { x: r.x + (r.x < 0 ? 1 : -1), z: Math.max(backLine + 2, -(coverage.id === 'zone' ? 7 : 5.5) - Math.random() * 2) };
    dmesh.position.set(dpos.x, 0, dpos.z);
    faceToward(dmesh, dpos.x, 5);
    group.add(dmesh);
    return {
      path, ext, mesh, ring, line, s: 0, speed: (8.2 + Math.random() * 1.1) * wfx.speed, pos: { ...path[0] }, vel: { x: 0, z: 0 }, hist: [],
      d: { mesh: dmesh, pos: dpos, lag: lags[i], speed: (8.8 + Math.random() * 0.6) * wfx.speed, zone: { x: dpos.x, z: dpos.z - (i === 1 ? 6 : 3) } }, sep: 5,
    };
  });
  const safeties = [];
  if (opts.call !== 'safe' || hail) {
    const ns = hail ? 3 : coverage.id === 'blitz' ? 0 : 1 + (coverage.id === 'zone' ? 1 : 0);
    for (let i = 0; i < ns; i++) {
      const s = { mesh: makePlayer(def), pos: clampField({ x: (i - (ns - 1) / 2) * 12, z: hail ? -m.yardLine - 2 : Math.max(-20 - Math.random() * 4, backLine + 3) }), speed: 7.6 };
      s.mesh.position.set(s.pos.x, 0, s.pos.z);
      faceToward(s.mesh, s.pos.x, 5);
      group.add(s.mesh);
      safeties.push(s);
    }
  }

  const ball = makeBall();
  group.add(ball);
  group.add(ball.userData.shadow);
  ball.visible = false;
  const reticle = makeRing('#ffd43b', 0.5, 0.8, 1);
  reticle.visible = false;
  group.add(reticle);
  const arcGeo = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 20 }, () => new THREE.Vector3()));
  const arc = new THREE.Line(arcGeo, new THREE.LineDashedMaterial({ color: '#ffd43b', dashSize: 0.6, gapSize: 0.4 }));
  arc.visible = false;
  group.add(arc);

  // --- HUD
  const pocketM = hudMeter('Pocket');
  const powerM = hudMeter('Power');
  const box = document.createElement('div');
  box.className = 'hud-meters';
  box.append(pocketM.el, powerM.el);
  hud.bottom(box);

  // --- state
  let pocketTime = (2.2 + st.iq * 0.011 + st.speed * 0.004) * (0.75 + tol * 0.25) + (opts.call === 'risky' ? 0.45 : 0) + (hail ? 0.8 : 0);
  if (coverage.id === 'blitz') pocketTime *= 0.72;
  const iqNoise = Math.max(0, (100 - st.iq) / 28) * (wfx.fog ? 2 : 1);
  const readsCoverage = st.iq >= 55 || Math.random() < st.iq / 120;
  let phase = 'wait';
  let t = 0;
  let aim = null;
  let flight = null;
  let after = null;
  const keys = {};
  let fx = null;

  rig(camera, 0, -5, 0, { zoom: hail ? 1.75 : 1.45, snap: true });

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
    setPose(qb, 'throw');
    sfx.select();
  };

  const release = () => {
    if (!aim || flight || phase !== 'live') return;
    if (aim.chargeStart === null) aim.chargeStart = t - 0.4;
    const p = Math.min(1.4, (t - aim.chargeStart) / 0.8);
    const over = p > 1.1;
    const pocketFrac = t / pocketTime;
    const sd = ((1.7 - st.skill * 0.011) / tol) * (over ? 1.9 : 1) * (pocketFrac > 0.8 ? 1.4 : 1);
    let land = clampField({ x: aim.point.x + gaussR() * sd * 0.8, z: aim.point.z + gaussR() * sd });
    const from = { x: qb.position.x + 0.4, z: qb.position.z - 0.3 };
    const dist = Math.hypot(land.x - from.x, land.z - from.z);
    const v = 14 + Math.min(1, p) * (7 + st.strength * 0.1);
    const T = Math.max(0.35, dist / v);
    // Wind pushes the ball while it is in the air.
    land = clampField({ x: land.x + wfx.wind.x * T * 0.45, z: land.z + wfx.wind.z * T * 0.45 });
    const H = Math.max(1.2, dist * 0.14 * (1.25 - Math.min(1, p) * 0.45));
    const r = aim.rec;
    const routeAt = pathPoint(r.path, r.s + r.speed * T, r.ext);
    const reach = 3 * Math.sqrt(tol);
    const adjusts = dist2(routeAt, land) <= reach || dist2(r.pos, land) <= r.speed * T * 1.05;
    flight = { from, land, T, H, t0: t, rec: r, adjusts, over, p };
    playAction(qb, ['throwRelease', 'throwRelease', 'throwRelease'], { fps: 6 });
    ball.visible = true;
    reticle.visible = false;
    arc.visible = false;
    hud.instr('');
    sfx.throw();
    if (over) hud.big('TOO HOT!', '#fbbf24', 700);
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

  maybeTip(ctx, hail ? 'Hail Mary' : 'Quarterback', hail ? [
    'Everyone is going deep. Throw it high into the end zone and pray.',
    'Drag to place the ball near your receivers, hold for power, release.',
  ] : [
    'Before the snap, read the defense: man, zone or blitz (higher IQ reads it clearly).',
    'Green ring = open, red = covered. Press near a receiver, drag to lead the receiver, hold for power, release.',
    'Too much power sails the ball. Hold it too long and you get sacked. Blitzes give you less time.',
    'Keyboard: 1 / 2 / 3, arrows to aim, hold Space.',
  ], () => { phase = 'pre'; t = 0; hud.instr(`${concept.name} · ${readsCoverage ? coverage.label : 'READ THE DEFENSE…'}`); });

  const ringColor = (sep) => (sep > 3.4 ? '#4ade80' : sep > 1.8 ? '#fbbf24' : '#f87171');

  return (dt) => {
    if (phase === 'wait') return;
    t += dt;
    if (phase === 'pre') {
      if (t > 1.1) {
        phase = 'live'; t = 0; sfx.whistle(); hud.instr('Pick a receiver and throw!');
        recs.forEach((r) => { r.line.material.opacity = 0.25; setPose(r.mesh, null); });
        // Linemen engage: both lines lock up in a blocking pose.
        linemen.forEach((o) => setPose(o, 'tackle'));
        rushers.forEach((d) => setPose(d.mesh, 'tackle'));
      }
      return;
    }
    if (fx && !fx(dt)) fx = null;

    for (const r of recs) {
      const prev = { ...r.pos };
      if (after && after.rec === r) {
        // run after catch handled below
      } else if (flight && flight.rec === r && flight.adjusts) {
        const remain = Math.max(0.05, flight.T - (t - flight.t0));
        const dx = flight.land.x - r.pos.x;
        const dz = flight.land.z - r.pos.z;
        const d = Math.hypot(dx, dz);
        const sp = Math.min(r.speed * 1.1, d / remain);
        if (d > 0.01) { r.pos.x += (dx / d) * sp * dt; r.pos.z += (dz / d) * sp * dt; }
      } else if (!after) {
        r.s += r.speed * dt * Math.min(1, t / 0.35);
        Object.assign(r.pos, clampField(pathPoint(r.path, r.s, r.ext)));
      }
      r.vel = { x: (r.pos.x - prev.x) / Math.max(dt, 1e-3), z: (r.pos.z - prev.z) / Math.max(dt, 1e-3) };
      r.hist.push({ t, x: r.pos.x, z: r.pos.z });
      if (r.hist.length > 120) r.hist.shift();
      r.mesh.position.set(r.pos.x, 0, r.pos.z);
      const sp = Math.hypot(r.vel.x, r.vel.z);
      if (sp > 0.3) faceToward(r.mesh, r.pos.x + r.vel.x, r.pos.z + r.vel.z);
      animateRun(r.mesh, dt, sp);
      // Defender logic: man trails with lag; zone guards an area and jumps throws.
      const D = r.d;
      let target;
      if (flight && (flight.rec === r || coverage.id === 'zone') && t - flight.t0 > 0.2 && dist2(D.pos, flight.land) < 12) target = flight.land;
      else if (after && after.rec === r) target = r.pos;
      else if (coverage.id === 'zone' && !hail) {
        const inZone = dist2(r.pos, D.zone) < 7;
        target = inZone ? { x: r.pos.x * 0.8 + D.zone.x * 0.2, z: r.pos.z - 0.8 } : D.zone;
      } else {
        const h = r.hist.find((x) => x.t >= t - D.lag * (coverage.id === 'blitz' ? 1.4 : 1)) ?? r.hist[0];
        target = { x: h.x + (h.x < 0 ? 0.6 : -0.6), z: h.z - 0.6 };
      }
      const dx = target.x - D.pos.x;
      const dz = target.z - D.pos.z;
      const dd = Math.hypot(dx, dz);
      const dsp = Math.min(D.speed, dd / Math.max(dt, 1e-3));
      if (dd > 0.05) { D.pos.x += (dx / dd) * dsp * dt; D.pos.z += (dz / dd) * dsp * dt; }
      D.mesh.position.set(D.pos.x, 0, D.pos.z);
      // Defensive backs backpedal (face the QB) while bailing deep, then turn and run.
      const bailing = !flight && dz < -0.1 && t < 2.2;
      setBackpedal(D.mesh, bailing);
      if (bailing) faceToward(D.mesh, D.pos.x, D.pos.z + 5);
      else if (dsp > 0.5) faceToward(D.mesh, D.pos.x + dx, D.pos.z + dz);
      animateRun(D.mesh, dt, dsp);
      r.sep = Math.min(dist2(r.pos, D.pos), ...safeties.map((s) => dist2(r.pos, s.pos)), ...recs.filter((o) => o !== r).map((o) => dist2(r.pos, o.d.pos) + 1));
      const shown = r.sep + iqNoise * Math.sin(t * 3.1 + r.d.lag * 9);
      r.ring.material.color.set(ringColor(shown));
      r.ring.visible = !wfx.fog || t > 1.0; // fog: reads come late
    }
    for (const s of safeties) {
      const deepest = recs.reduce((a, b) => (b.pos.z < a.pos.z ? b : a));
      const target = flight ? flight.land : { x: deepest.pos.x * 0.6 + s.pos.x * 0.4, z: Math.min(s.pos.z, deepest.pos.z - 3) };
      const dx = target.x - s.pos.x;
      const dz = target.z - s.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.1) { s.pos.x += (dx / d) * s.speed * dt; s.pos.z += (dz / d) * s.speed * dt * (flight ? 1 : 0.6); }
      s.mesh.position.set(s.pos.x, 0, s.pos.z);
      faceToward(s.mesh, s.pos.x + dx, s.pos.z + dz);
      animateRun(s.mesh, dt, d > 0.1 ? s.speed : 0);
    }

    // Pass rush.
    const pf = Math.min(1, t / pocketTime);
    if (!flight && !after) {
      pocketM.set(1 - pf, pf > 0.7 ? '#f87171' : undefined);
      rushers.forEach((d) => {
        d.mesh.position.z = -1.2 + pf * pf * 5.6;
        d.mesh.position.x = d.x0 * (1 - pf * 0.7);
        animateRun(d.mesh, dt, 2 + pf * 5);
      });
      if (pf >= 1 && phase === 'live') {
        phase = 'over';
        sfx.hit();
        ctx.shake(0.4);
        knockDown(qb, 1);
        endPlay(ctx, finalize({ sack: true, complete: false, yards: -(4 + Math.floor(Math.random() * 5)), quality: 0.06, text: 'SACKED!' }, m));
        return;
      }
    }

    if (aim && !flight) {
      if (aim.keyboard) {
        const sp = 14 * dt;
        if (keys.ArrowLeft) aim.point.x -= sp;
        if (keys.ArrowRight) aim.point.x += sp;
        if (keys.ArrowUp) aim.point.z -= sp;
        if (keys.ArrowDown) aim.point.z += sp;
        aim.point = clampField(aim.point);
      }
      reticle.position.set(aim.point.x, 0.05, aim.point.z);
      const p = aim.chargeStart === null ? 0 : Math.min(1.4, (t - aim.chargeStart) / 0.8);
      powerM.set(p / 1.4, p > 1.1 ? '#f87171' : undefined);
      const pos = arcGeo.attributes.position;
      const from = { x: qb.position.x, z: qb.position.z };
      const d = Math.hypot(aim.point.x - from.x, aim.point.z - from.z);
      const H = Math.max(1.2, d * 0.14 * (1.25 - Math.min(1, p) * 0.45));
      for (let i = 0; i < 20; i++) {
        const f = i / 19;
        pos.setXYZ(i, from.x + (aim.point.x - from.x) * f, 2.4 + (1.3 - 2.4) * f + 4 * H * f * (1 - f), from.z + (aim.point.z - from.z) * f);
      }
      pos.needsUpdate = true;
      arc.computeLineDistances();
      faceToward(qb, aim.point.x, aim.point.z);
    }

    if (flight) {
      const f = Math.min(1, (t - flight.t0) / flight.T);
      const x = flight.from.x + (flight.land.x - flight.from.x) * f;
      const z = flight.from.z + (flight.land.z - flight.from.z) * f;
      const y = 2.4 + (1.3 - 2.4) * f + 4 * flight.H * f * (1 - f);
      ball.position.set(x, y, z);
      ball.userData.shadow.position.set(x, 0.04, z);
      rig(camera, x * 0.6, Math.min(0, z * 0.7), dt, { zoom: hail ? 1.6 : 1.3, k: 2.5 });
      if (f >= 1) resolveCatch();
    } else if (!after) rig(camera, 0, -5, dt, { zoom: hail ? 1.75 : 1.45 });

    if (after) {
      const r = after.rec;
      after.time += dt;
      if (after.time < after.dur) {
        r.pos.z -= after.speed * dt;
        r.pos = clampField(r.pos);
        r.mesh.position.set(r.pos.x, 0, r.pos.z);
        faceToward(r.mesh, r.pos.x, r.pos.z - 1);
        animateRun(r.mesh, dt, after.speed);
        ball.position.set(r.pos.x + 0.4, 1.4, r.pos.z);
        rig(camera, r.pos.x, r.pos.z, dt, { zoom: 0.75, k: 3 });
      } else if (!after.done) {
        after.done = true;
        if (!after.td) { sfx.hit(); ctx.shake(0.2); knockDown(r.mesh, 1); }
        else celebrate(r.mesh);
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
    const defs = [...recs.map((o) => o.d.pos), ...safeties.map((s) => s.pos)];
    const dD = Math.min(...defs.map((d) => dist2(d, land)));
    const crowd = defs.filter((d) => dist2(d, land) < 2.2).length;
    const catchR = (hail ? 1.6 : 1.0) + 0.2 * tol;
    let result;
    setPose(r.mesh, 'catch');
    if (dR <= catchR) {
      let caught = true;
      if (hail) {
        const p = 0.4 + (1 - dR / catchR) * 0.25 - crowd * 0.08 + st.strength / 500;
        if (Math.random() > p) {
          caught = false;
          result = crowd && Math.random() < 0.3 ? { turnover: true, complete: false, yards: 0, quality: 0.05, text: 'INTERCEPTED in the end zone!' } : { complete: false, yards: 0, quality: 0.3, text: 'Batted down in a crowd!' };
        }
      } else if (dD <= 0.9 && dD < dR) {
        caught = false;
        result = Math.random() < 0.5 ? { turnover: true, complete: false, yards: 0, quality: 0.03, text: 'INTERCEPTED!' } : { complete: false, yards: 0, quality: 0.2, text: 'Broken up at the catch point.' };
      } else if (dD <= 1.6 && Math.random() > 0.5 + st.strength / 400) {
        caught = false;
        result = { complete: false, yards: 0, quality: 0.25, text: 'Contested… knocked away.' };
      }
      if (caught && Math.random() < wfx.slip) {
        caught = false;
        result = { complete: false, yards: 0, quality: 0.25, text: 'Slippery ball! It squirts through the hands.' };
      }
      if (caught) {
        sfx.catch();
        const sep = Math.max(0, dD);
        const yac = hail ? 0 : Math.max(0, Math.min(30, sep * 1.5 + Math.random() * 3 - 1 + (sep > 5 ? 7 : 0)));
        const air = -land.z;
        const total = air + yac;
        const quality = 0.45 + Math.min(4, sep) * 0.07 + (1 - dR / catchR) * 0.15 + Math.min(0.25, total / 80) * (opts.call === 'risky' ? 1.4 : 1);
        result = finalize({ complete: true, yards: total, quality }, m);
        if (result.yards >= 20) ctx.slowMo(0.5);
        after = { rec: r, time: 0, dur: Math.max(0.2, (result.yards - air) / 8), speed: 8, result, td: result.td };
        setTimeout(() => setPose(r.mesh, null), 250);
        if (result.td) fx = confetti(ctx.scene, new THREE.Vector3(r.pos.x, 0, -m.yardLine - 2), [opts.teamColors[0], opts.teamColors[1], '#ffffff']);
        return;
      }
    } else if (dD <= 1.1 && Math.random() < 0.35) {
      result = { turnover: true, complete: false, yards: 0, quality: 0.03, text: 'INTERCEPTED!' };
    } else {
      result = { complete: false, yards: 0, quality: Math.max(0.05, 0.25 - (dR - catchR) * 0.05), text: fl.over ? 'Sailed over the receiver.' : 'Incomplete.' };
    }
    ball.position.y = 0.2;
    if (result.turnover) { sfx.hit(); ctx.shake(0.25); }
    endPlay(ctx, finalize(result, m));
  }
}
