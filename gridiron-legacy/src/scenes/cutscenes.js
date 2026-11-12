// Story cutscenes played with the in-game engine: running out of the tunnel, draft night,
// lifting a championship trophy, and the Hall of Fame induction. Each is a short scripted
// sequence of camera moves, character animation and captions. Tap Skip to jump past it.
import * as THREE from 'three';
import { runCutscene } from './director.js';
import { makePlayer, makePerson, animateRun, faceToward, celebrate, playAction, setPose, confetti, toon, makeBall } from './actors.js';
import { randomLook } from '../data/looks.js';

const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => (k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k));

/** Camera path: keys = [{ t, pos:[x,y,z], look:[x,y,z] }]. */
function camPath(camera, keys, t) {
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const a = keys[i];
  const b = keys[Math.min(i + 1, keys.length - 1)];
  const k = ease((t - a.t) / Math.max(0.001, b.t - a.t));
  camera.position.set(lerp(a.pos[0], b.pos[0], k), lerp(a.pos[1], b.pos[1], k), lerp(a.pos[2], b.pos[2], k));
  camera.lookAt(lerp(a.look[0], b.look[0], k), lerp(a.look[1], b.look[1], k), lerp(a.look[2], b.look[2], k));
}

function smoke(group, origin, n = 40) {
  const geo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
  const mat = new THREE.MeshBasicMaterial({ color: '#e8ecf2', transparent: true, opacity: 0.55, depthWrite: false });
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  const P = Array.from({ length: n }, () => ({ x: origin.x + (Math.random() - 0.5) * 4, y: Math.random() * 2, z: origin.z + (Math.random() - 0.5) * 3, vx: (Math.random() - 0.5) * 1.2, vy: 0.4 + Math.random() * 0.8, vz: -0.5 - Math.random(), s: 0.6 + Math.random() }));
  const d = new THREE.Object3D();
  group.add(mesh);
  return (dt) => {
    P.forEach((p, i) => {
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.s += dt * 0.5;
      d.position.set(p.x, p.y, p.z); d.scale.setScalar(p.s); d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mat.opacity = Math.max(0, mat.opacity - dt * 0.07);
  };
}

const stadiumSetup = (colors, name, level = 'pro', culture = null) => (r) => {
  r.stadium.setLevel?.(level);
  if (culture) r.stadium.setEnvironment?.(culture.biome, culture.seed, { landmarks: culture.landmarks });
  r.stadium.setTeams(colors, colors, name, name, colors);
  r.stadium.setYardLine(50, 10);
  r.stadium.hideLines();
};

// ------------------------------------------------------------------ tunnel run-out

/** opts: { colors, uniform, look, number, teamName, title, sub } */
export function tunnelCutscene(opts) {
  return runCutscene((ctx) => {
    const team = [];
    const user = makePlayer(opts.colors, { uniform: opts.uniform, look: opts.look, number: opts.number, highlight: false });
    user.position.set(0, 0, 64);
    ctx.group.add(user);
    team.push({ m: user, x: 0, z: 64, delay: 0.6, speed: 7.5 });
    for (let i = 0; i < 12; i++) {
      const m = makePlayer(opts.colors, { uniform: opts.uniform });
      const x = (Math.random() - 0.5) * 6;
      const z = 66 + i * 0.9;
      m.position.set(x, 0, z);
      ctx.group.add(m);
      team.push({ m, x, z, delay: 0.9 + i * 0.12, speed: 6.5 + Math.random() * 1.5 });
    }
    // tunnel arch
    const arch = new THREE.Group();
    const side = toon('#20242c');
    const l = new THREE.Mesh(new THREE.BoxGeometry(1, 4.5, 3), side); l.position.set(-4, 2.25, 66);
    const rr = l.clone(); rr.position.x = 4;
    const top = new THREE.Mesh(new THREE.BoxGeometry(9, 1, 3), toon(opts.colors[0])); top.position.set(0, 5, 66);
    arch.add(l, rr, top);
    ctx.group.add(arch);
    const puff = smoke(ctx.group, { x: 0, z: 63 }, 46);
    let fx = null;
    ctx.caption(opts.title, opts.sub);
    return (dt, t) => {
      const T = (ctx._t = (ctx._t ?? 0) + dt);
      puff(dt);
      for (const p of team) {
        if (T < p.delay) { animateRun(p.m, dt, 0); continue; }
        const target = p.m === user ? 44 : 46 + Math.random() * 0.1;
        if (p.z > target) {
          p.z -= p.speed * dt;
          p.m.position.set(p.x, 0, p.z);
          faceToward(p.m, p.x, p.z - 5);
          animateRun(p.m, dt, p.speed);
        } else {
          if (!p.cheer) { p.cheer = true; celebrate(p.m, p.m === user ? 'point' : 'pump'); }
          animateRun(p.m, dt, 0);
        }
      }
      if (T > 3.2 && !fx) fx = confetti(ctx.scene, new THREE.Vector3(0, 2, 44), [opts.colors[0], opts.colors[1], '#ffffff']);
      if (fx && !fx(dt)) fx = null;
      camPath(ctx.camera, [
        { t: 0, pos: [3, 1.6, 52], look: [0, 1.8, 64] },
        { t: 2.2, pos: [4, 2.2, 48], look: [0, 1.4, 56] },
        { t: 4.2, pos: [6, 3.5, 36], look: [0, 1.2, 45] },
        { t: 6.5, pos: [0, 9, 28], look: [0, 1, 45] },
      ], T);
      return T < 6.8;
    };
  }, { setup: stadiumSetup(opts.colors, opts.teamName, opts.stage, opts.culture) });
}

// ------------------------------------------------------------------ draft night

function jerseyCard(colors, number) {
  const c = document.createElement('canvas');
  c.width = 24; c.height = 24;
  const g = c.getContext('2d');
  g.fillStyle = colors[0]; g.fillRect(0, 0, 24, 24);
  g.fillStyle = colors[1]; g.fillRect(0, 3, 24, 2);
  g.font = 'bold 13px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(number), 12, 14);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.8, 0.04), new THREE.MeshBasicMaterial({ map: t }));
}

function banner(text, colors) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 40;
  const g = c.getContext('2d');
  g.fillStyle = '#0d1018'; g.fillRect(0, 0, 128, 40);
  g.fillStyle = colors[0]; g.fillRect(0, 0, 128, 6); g.fillRect(0, 34, 128, 6);
  g.fillStyle = '#ffffff'; g.font = 'bold 14px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 64, 21);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(12, 3.75), new THREE.MeshBasicMaterial({ map: t }));
}

/** opts: { colors, teamName, look, number, pickText, playerName } */
export function draftCutscene(opts) {
  return runCutscene((ctx) => {
    const g = ctx.group;
    const stage = new THREE.Mesh(new THREE.BoxGeometry(14, 1, 7), toon('#1a1d26'));
    stage.position.set(0, 0.5, 0);
    g.add(stage);
    const back = banner('DRAFT NIGHT', opts.colors);
    back.position.set(0, 4.2, -3.2);
    g.add(back);
    const podium = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.3, 0.8), toon(opts.colors[0]));
    podium.position.set(-2.2, 1.65, -0.6);
    g.add(podium);
    // spotlights
    for (const x of [-4, 0, 4]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(2.2, 12, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#fff6cc', transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide }));
      cone.position.set(x, 7, 0);
      g.add(cone);
    }
    const commish = makePerson({ ...randomLook('commish'), shirt: '#20232b', pants: '#20232b', hairStyle: 'short', hairColor: 8 });
    commish.position.set(-1.2, 1, -0.4);
    commish.rotation.y = Math.PI + 0.4;
    commish.userData.u.targetYaw = commish.rotation.y;
    g.add(commish);
    const me = makePerson({ ...opts.look, outfit: 'gala' });
    me.position.set(5, 1, 0.8);
    g.add(me);
    const card = jerseyCard(opts.colors, opts.number);
    card.visible = false;
    g.add(card);
    let fx = null;
    let phase = 0;
    ctx.caption(opts.pickText, '');
    return (dt) => {
      const T = (ctx._t = (ctx._t ?? 0) + dt);
      if (T > 2.4 && phase === 0) { phase = 1; ctx.caption(`The ${opts.teamName} select...`, ''); }
      if (T > 4.0 && phase === 1) { phase = 2; ctx.caption(opts.playerName.toUpperCase(), opts.sub ?? ''); fx = confetti(ctx.scene, new THREE.Vector3(0, 3, 0), [opts.colors[0], opts.colors[1], '#ffffff']); ctx.shake(0.2); }
      // walk to the commissioner, shake hands, hold up the jersey
      const x = me.position.x;
      if (T > 2.6 && x > 0.2) {
        me.position.x = Math.max(0.2, x - dt * 3.2);
        faceToward(me, me.position.x - 5, 0.8);
        animateRun(me, dt, 3);
      } else {
        if (T > 2.6) { faceToward(me, 0, 10); if (phase === 2) { phase = 3; celebrate(me, 'point'); card.visible = true; } }
        animateRun(me, dt, 0);
      }
      if (card.visible) { card.position.set(me.position.x, 3.25 + Math.sin(T * 3) * 0.04, me.position.z + 0.15); }
      if (T > 4.0 && !commish.userData.waving) { commish.userData.waving = true; setPose(commish, 'wave'); }
      animateRun(commish, dt, 0);
      if (fx && !fx(dt)) fx = null;
      camPath(ctx.camera, [
        { t: 0, pos: [0, 4, 16], look: [0, 3, -2] },
        { t: 3.0, pos: [2, 3.2, 11], look: [0.5, 2.4, 0] },
        { t: 5.2, pos: [0.5, 2.8, 7.5], look: [-0.4, 2.3, 0] },
        { t: 8, pos: [-0.6, 2.9, 6.2], look: [-0.2, 2.5, 0] },
      ], T);
      return T < 8.4;
    };
  }, {
    setup: (r) => {
      stadiumSetup(opts.colors, opts.teamName)(r);
      r.scene.background = new THREE.Color('#05070d');
      r.stadium.setTint('night');
    },
  });
}

// ------------------------------------------------------------------ trophy lift

function trophyMesh() {
  const g = new THREE.Group();
  const gold = toon('#f2c12e');
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.42), toon('#3a2a1a'));
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.12), gold);
  stem.position.y = 0.24;
  const cup = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.42), gold);
  cup.position.y = 0.55;
  const hl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.06), gold); hl.position.set(-0.27, 0.58, 0);
  const hr = hl.clone(); hr.position.x = 0.27;
  g.add(base, stem, cup, hl, hr);
  return g;
}

/** opts: { colors, uniform, look, number, title, sub } */
export function trophyCutscene(opts) {
  return runCutscene((ctx) => {
    const g = ctx.group;
    const me = makePlayer(opts.colors, { uniform: opts.uniform, look: opts.look, number: opts.number, helmet: false });
    me.position.set(0, 0, 0);
    me.rotation.y = 0;
    g.add(me);
    const mates = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = 2.2 + Math.random() * 1.6;
      const m = makePlayer(opts.colors, { uniform: opts.uniform, helmet: Math.random() < 0.5 });
      m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      faceToward(m, 0, 0);
      m.rotation.y = m.userData.u.targetYaw;
      g.add(m);
      mates.push(m);
      setTimeout(() => celebrate(m, ['pump', 'dance', 'flex', 'pump'][i % 4]), 200 + i * 60);
    }
    const trophy = trophyMesh();
    g.add(trophy);
    celebrate(me, 'point');
    const bursts = [];
    let next = 0.5;
    ctx.caption(opts.title, opts.sub);
    return (dt) => {
      const T = (ctx._t = (ctx._t ?? 0) + dt);
      const lift = Math.min(1, Math.max(0, (T - 0.6) / 1.2));
      trophy.position.set(0, lerp(1.4, 2.8, ease(lift)) + Math.sin(T * 6) * 0.05 * lift, -0.1);
      trophy.rotation.y = Math.sin(T * 1.5) * 0.25;
      if (T > next) { next += 2.4; bursts.push(confetti(ctx.scene, new THREE.Vector3((Math.random() - 0.5) * 6, 3, (Math.random() - 0.5) * 6), [opts.colors[0], opts.colors[1], '#ffd43b', '#ffffff'])); }
      for (let i = bursts.length - 1; i >= 0; i--) if (!bursts[i](dt)) bursts.splice(i, 1);
      animateRun(me, dt, 0);
      for (const m of mates) animateRun(m, dt, 0);
      const a = T * 0.45;
      ctx.camera.position.set(Math.sin(a) * 9.5, 3.2 + Math.sin(T * 0.7) * 0.4, Math.cos(a) * 9.5);
      ctx.camera.lookAt(0, 1.8, 0);
      return T < 8;
    };
  }, { setup: stadiumSetup(opts.colors, opts.teamName, opts.stage) });
}

// ------------------------------------------------------------------ hall of fame

/** opts: { look, name, year, colors } */
export function hofCutscene(opts) {
  return runCutscene((ctx) => {
    const g = ctx.group;
    const ped = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.6), toon('#2a2d36'));
    ped.position.set(-1.6, 0.7, 0);
    g.add(ped);
    const statue = makePerson({ ...opts.look, shirt: '#c9a227', pants: '#c9a227', shoe: '#c9a227' });
    statue.traverse((o) => { if (o.isMesh && o.material && !o.material.transparent) o.material = toon('#d4af37'); });
    statue.position.set(-1.6, 1.4, 0);
    statue.rotation.y = Math.PI + 0.3;
    statue.userData.u.targetYaw = statue.rotation.y;
    g.add(statue);
    celebrate(statue, 'point');
    for (let i = 0; i < 8; i++) animateRun(statue, 0.2, 0);
    statue.userData.frozen = true;
    const me = makePerson({ ...opts.look, outfit: 'gala' });
    me.position.set(1.4, 0, 0.6);
    me.rotation.y = Math.PI - 0.3;
    me.userData.u.targetYaw = me.rotation.y;
    g.add(me);
    setPose(me, 'wave');
    const back = banner('HALL OF FAME', ['#d4af37', '#ffffff']);
    back.position.set(0, 4.5, -3);
    g.add(back);
    let fx = null;
    ctx.caption('HALL OF FAME', `${opts.name} · Class of ${opts.year}`);
    return (dt) => {
      const T = (ctx._t = (ctx._t ?? 0) + dt);
      if (!statue.userData.done) { statue.userData.done = true; }
      animateRun(me, dt, 0);
      if (T > 1.5 && !fx) fx = confetti(ctx.scene, new THREE.Vector3(0, 4, 0), ['#d4af37', '#ffffff', '#f2c12e']);
      if (fx && !fx(dt)) fx = null;
      camPath(ctx.camera, [
        { t: 0, pos: [-1.6, 2.6, 4], look: [-1.6, 2.6, 0] },
        { t: 3, pos: [0, 2.6, 7], look: [0, 2, 0] },
        { t: 7, pos: [2.5, 2.2, 6], look: [0, 1.8, 0] },
      ], T);
      return T < 7.5;
    };
  }, {
    setup: (r) => {
      stadiumSetup(opts.colors ?? ['#d4af37', '#111111'], 'LEGENDS')(r);
      r.scene.background = new THREE.Color('#05070d');
      r.stadium.setTint('night');
    },
  });
}

// ------------------------------------------------------------------ player of the game

/** opts: { colors, uniform, look, number, teamName, stage, culture, title, sub } */
export function playerOfGameCutscene(opts) {
  return runCutscene((ctx) => {
    const g = ctx.group;
    const me = makePlayer(opts.colors, { uniform: opts.uniform, look: opts.look, number: opts.number, helmet: false });
    me.position.set(0, 0, 0);
    me.rotation.y = Math.PI; // face the reporters (and the camera)
    me.userData.u.targetYaw = Math.PI;
    g.add(me);
    // game ball raised in one hand
    const ball = makeBall();
    ball.scale.setScalar(1.15);
    g.add(ball);
    // reporters with mics and a camera operator, in a half circle in front
    const press = [];
    for (let i = 0; i < 4; i++) {
      const a = -0.9 + i * 0.6;
      const p = makePerson({ ...randomLook(`press${i}`, { gender: i % 2 ? 'f' : 'm' }), outfit: 'casual', shirt: ['#2b2f36', '#5a6472', '#1d3557', '#7a1f2b'][i], pants: '#2b2d42' });
      p.position.set(Math.sin(a) * 2.4, 0, Math.cos(a) * 2.4);
      faceToward(p, 0, 0);
      p.rotation.y = p.userData.u.targetYaw;
      g.add(p);
      press.push(p);
      if (i !== 3) { // handheld mic toward you
        const mic = new THREE.Group();
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), toon('#1b1d22'));
        stick.rotation.x = Math.PI / 2 - 0.4; mic.add(stick);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), toon('#3a3f46')); head.position.set(0, 0.06, -0.14); mic.add(head);
        const flag = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.09), toon(['#c0392b', '#2471a3', '#d4ac0d'][i])); flag.position.set(0, 0.0, -0.06); mic.add(flag);
        mic.position.set(Math.sin(a) * 1.75, 1.45, Math.cos(a) * 1.75);
        mic.lookAt(0, 1.55, 0);
        g.add(mic);
      } else { // TV camera on the shoulder
        const cam = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.55), toon('#22262c'));
        cam.position.set(Math.sin(a) * 2.25, 1.78, Math.cos(a) * 2.25); cam.lookAt(0, 1.6, 0); g.add(cam);
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.14, 12), toon('#111')); lens.position.copy(cam.position).lerp(new THREE.Vector3(0, 1.7, 0), 0.12); lens.lookAt(0, 1.6, 0); lens.rotateX(Math.PI / 2); g.add(lens);
      }
    }
    // teammates celebrating behind you
    const mates = [];
    for (let i = 0; i < 6; i++) {
      const m = makePlayer(opts.colors, { uniform: opts.uniform, helmet: Math.random() < 0.4 });
      m.position.set(-3 + i * 1.2 + (Math.random() - 0.5) * 0.4, 0, -2.4 - Math.random() * 1.2);
      faceToward(m, 0, 0);
      m.rotation.y = m.userData.u.targetYaw;
      g.add(m);
      mates.push(m);
      setTimeout(() => celebrate(m, ['pump', 'dance', 'flex'][i % 3]), 400 + i * 120);
    }
    // camera flashes
    const flash = new THREE.PointLight('#ffffff', 0, 6);
    flash.position.set(0, 2, 2.5);
    g.add(flash);
    let nextFlash = 0.4;
    let fx = null;
    ctx.caption(opts.title ?? 'PLAYER OF THE GAME', opts.sub ?? '');
    return (dt) => {
      const T = (ctx._t = (ctx._t ?? 0) + dt);
      // raise the game ball at 1s
      const up = Math.min(1, Math.max(0, (T - 1) / 0.6));
      if (up > 0 && !me.userData.raised) { me.userData.raised = true; celebrate(me, 'point'); }
      ball.position.set(-0.32, lerp(1.1, 2.35, ease(up)), 0.05);
      ball.rotation.set(0.2, T * 0.6, 0.4 + up);
      if (T > nextFlash) { nextFlash = T + 0.25 + Math.random() * 0.5; flash.intensity = 30; flash.position.set((Math.random() - 0.5) * 4, 1.8, 2 + Math.random()); }
      flash.intensity *= 0.82;
      if (T > 2.2 && !fx) fx = confetti(ctx.scene, new THREE.Vector3(0, 4, -1), [opts.colors[0], opts.colors[1], '#ffffff']);
      if (fx && !fx(dt)) fx = null;
      animateRun(me, dt, 0);
      for (const p of press) animateRun(p, dt, 0);
      for (const m of mates) animateRun(m, dt, 0);
      camPath(ctx.camera, [
        { t: 0, pos: [1.5, 2.1, 1.7], look: [0, 1.55, 0] },
        { t: 3.2, pos: [0.35, 1.9, 1.55], look: [0, 1.75, 0] },
        { t: 6.5, pos: [-1.3, 2.2, 1.8], look: [0, 1.5, -0.6] },
      ], T);
      return T < 6.6;
    };
  }, {
    setup: (r) => {
      stadiumSetup(opts.colors, opts.teamName, opts.stage, opts.culture)(r);
      r.stadium.setTint?.('night');
    },
  });
}
