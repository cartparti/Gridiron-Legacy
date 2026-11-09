// Low-poly 3D athletes with a jointed rig and smooth procedural animation.
//
// Every character is a small hierarchy of meshes (hips, legs with knees, spine, chest, arms with
// elbows, head/helmet). Poses are computed each frame from a locomotion state (idle / run / sprint /
// backpedal) plus optional one-shot actions (throw, catch, juke, spin, stiff-arm, dive, tackle,
// fall, get up, celebrate ...) and blended smoothly, so movement reads clearly.
//
// The public API (makePlayer, makePerson, animateRun, faceToward, setPose, playAction, celebrate,
// knockDown, setHop, setBackpedal ...) is shared by the play engine, minigames and the walkable world.
import * as THREE from 'three';

// ------------------------------------------------------------------ materials & geometry

let gradient = null;
function toonGradient() {
  if (gradient) return gradient;
  const data = new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 255, 255, 255, 255]);
  gradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  return gradient;
}
const matCache = new Map();
export function toon(color) {
  const key = String(color);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshToonMaterial({ color, gradientMap: toonGradient() }));
  return matCache.get(key);
}

const G = {};
function geo() {
  if (G.limb) return G;
  G.limb = new THREE.CylinderGeometry(0.075, 0.062, 1, 7); G.limb.translate(0, -0.5, 0); // pivot at top
  G.thigh = new THREE.CylinderGeometry(0.095, 0.075, 1, 7); G.thigh.translate(0, -0.5, 0);
  G.torso = new THREE.CylinderGeometry(0.2, 0.16, 1, 8); G.torso.translate(0, 0.5, 0);
  G.pads = new THREE.BoxGeometry(0.62, 0.16, 0.34);
  G.helmet = new THREE.SphereGeometry(0.17, 12, 9);
  G.head = new THREE.SphereGeometry(0.13, 12, 9);
  G.mask = new THREE.TorusGeometry(0.13, 0.014, 4, 10, Math.PI);
  G.hand = new THREE.SphereGeometry(0.055, 6, 5);
  G.shoe = new THREE.BoxGeometry(0.12, 0.08, 0.26);
  G.hips = new THREE.BoxGeometry(0.36, 0.18, 0.22);
  G.shadow = new THREE.CircleGeometry(0.5, 14);
  G.plane = new THREE.PlaneGeometry(0.26, 0.26);
  G.hairCap = new THREE.SphereGeometry(0.138, 10, 6, 0, Math.PI * 2, 0, Math.PI / 1.9);
  G.afro = new THREE.SphereGeometry(0.19, 10, 8);
  G.ponytail = new THREE.BoxGeometry(0.16, 0.28, 0.08);
  G.ball = new THREE.SphereGeometry(0.11, 10, 8);
  return G;
}
const shadowMat = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.32, depthWrite: false });

const numberCache = new Map();
function numberTexture(num, fg, bg) {
  const key = `${num}|${fg}|${bg}`;
  if (numberCache.has(key)) return numberCache.get(key);
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 64, 64);
  g.font = '900 44px "Arial Black", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 5;
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.strokeText(String(num), 32, 35);
  g.fillStyle = fg;
  g.fillText(String(num), 32, 35);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshToonMaterial({ map: t, gradientMap: toonGradient() });
  numberCache.set(key, m);
  return m;
}

export const SKINS = ['#f3cfa6', '#e2b07a', '#c68a52', '#94603a', '#62402a'];
export const HAIRS = ['#1c1410', '#3b2414', '#6b4423', '#a8743f', '#d9b36a', '#7a2e1c', '#2b2b2b'];

// ------------------------------------------------------------------ rig

/**
 * Build a character. o = { jersey, trim, pants, helmet, skin, number, football, shirt, hair, hairStyle,
 * build (0.85-1.2 width), height (0.92-1.08), highlight }
 */
function buildRig(o) {
  const g = geo();
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const h = o.height ?? 1;
  const w = o.build ?? 1;
  body.scale.set(w, h, w);
  const skin = toon(o.skin);
  const shirt = toon(o.jersey);
  const pants = toon(o.pants);
  const sock = toon(o.football ? o.jersey : o.pants);
  const shoe = toon(o.shoe ?? '#16181c');

  const hips = new THREE.Group();
  hips.position.y = 0.95;
  body.add(hips);
  const hipBox = new THREE.Mesh(g.hips, pants);
  hips.add(hipBox);

  const mkLeg = (side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.11, -0.04, 0);
    const thigh = new THREE.Mesh(g.thigh, pants);
    thigh.scale.set(1, 0.46, 1);
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.46;
    hip.add(knee);
    const shin = new THREE.Mesh(g.limb, sock);
    shin.scale.set(1.05, 0.44, 1.05);
    knee.add(shin);
    const foot = new THREE.Mesh(g.shoe, shoe);
    foot.position.set(0, -0.46, -0.05);
    knee.add(foot);
    hips.add(hip);
    return { hip, knee };
  };
  const legL = mkLeg(-1);
  const legR = mkLeg(1);

  const spine = new THREE.Group();
  hips.add(spine);
  const torso = new THREE.Mesh(g.torso, shirt);
  torso.scale.set(1, 0.52, 0.8);
  spine.add(torso);
  const chest = new THREE.Group();
  chest.position.y = 0.5;
  spine.add(chest);
  if (o.football) {
    const pads = new THREE.Mesh(g.pads, shirt);
    pads.position.y = -0.02;
    chest.add(pads);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.035, 0.345), toon(o.trim));
    stripe.position.y = 0.02;
    chest.add(stripe);
    if (o.number !== undefined) {
      const back = new THREE.Mesh(g.plane, numberTexture(o.number, o.trim, o.jersey));
      back.position.set(0, -0.2, 0.152);
      chest.add(back);
      const front = new THREE.Mesh(g.plane, numberTexture(o.number, o.trim, o.jersey));
      front.position.set(0, -0.2, -0.152);
      front.rotation.y = Math.PI;
      chest.add(front);
    }
  }

  const neck = new THREE.Group();
  neck.position.y = 0.1;
  chest.add(neck);
  if (o.football) {
    const helmet = new THREE.Mesh(g.helmet, toon(o.helmet));
    helmet.scale.set(1, 1.05, 1.12);
    helmet.position.y = 0.14;
    neck.add(helmet);
    const hs = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.36), toon(o.trim));
    hs.position.y = 0.315;
    neck.add(hs);
    const face = new THREE.Mesh(g.head, skin);
    face.scale.set(0.8, 0.75, 0.6);
    face.position.set(0, 0.11, -0.1);
    neck.add(face);
    const mask = new THREE.Mesh(g.mask, toon('#aab4be'));
    mask.rotation.set(Math.PI / 2, 0, 0);
    mask.position.set(0, 0.06, -0.12);
    neck.add(mask);
  } else {
    const head = new THREE.Mesh(g.head, skin);
    head.position.y = 0.14;
    neck.add(head);
    const hair = toon(o.hair ?? '#1c1410');
    const style = o.hairStyle ?? 0;
    if (style === 3) { const a = new THREE.Mesh(g.afro, hair); a.position.set(0, 0.2, 0.02); neck.add(a); }
    else if (style !== 1) {
      const cap = new THREE.Mesh(g.hairCap, hair);
      cap.position.y = 0.155;
      neck.add(cap);
      if (style === 2) { const pt = new THREE.Mesh(g.ponytail, hair); pt.position.set(0, 0.06, 0.13); neck.add(pt); }
    } else { const buzz = new THREE.Mesh(g.hairCap, hair); buzz.scale.setScalar(0.96); buzz.position.y = 0.15; neck.add(buzz); }
    const eyeM = toon('#1a1a1a');
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.018, 4, 3), eyeM); e.position.set(s * 0.045, 0.16, -0.12); neck.add(e); }
  }

  const mkArm = (side) => {
    const sh = new THREE.Group();
    sh.position.set(side * (o.football ? 0.3 : 0.24), -0.05, 0);
    const upper = new THREE.Mesh(g.limb, shirt);
    upper.scale.set(1, 0.32, 1);
    sh.add(upper);
    const el = new THREE.Group();
    el.position.y = -0.32;
    sh.add(el);
    const fore = new THREE.Mesh(g.limb, o.football ? shirt : skin);
    fore.scale.set(0.9, 0.29, 0.9);
    el.add(fore);
    const hand = new THREE.Mesh(g.hand, o.football ? toon(o.glove ?? o.trim) : skin);
    hand.position.y = -0.31;
    el.add(hand);
    chest.add(sh);
    return { sh, el };
  };
  const armL = mkArm(-1);
  const armR = mkArm(1);

  const shadow = new THREE.Mesh(g.shadow, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  root.add(shadow);
  if (o.highlight) {
    const ring = makeRing('#ffd43b', 0.55, 0.72, 1);
    root.add(ring);
    root.userData.ring = ring;
  }
  root.userData = {
    ...root.userData,
    rig: { body, hips, spine, chest, neck, legL, legR, armL, armR },
    u: { speed: 0, phase: Math.random() * 6, back: false, hold: null, action: null, down: false, downT: 0, hop: 0, yaw: 0, targetYaw: 0, celebrate: null },
    ticked: 0,
  };
  return root;
}

const COLORS_DEFAULT_SKIN = () => SKINS[Math.floor(Math.random() * SKINS.length)];

/** Football player in team colors. colors = [primary, secondary] or a uniform object. */
export function makePlayer(colors, { highlight = false, skin, number, build, height, uniform } = {}) {
  const un = uniform ?? { jersey: colors[0], trim: colors[1], helmet: colors[0], pants: lightOrDark(colors[1]) };
  return buildRig({
    football: true, ...un, skin: typeof skin === 'number' ? SKINS[skin % 5] : skin ?? COLORS_DEFAULT_SKIN(),
    number: number ?? Math.floor(Math.random() * 89) + 1, build: build ?? 0.92 + Math.random() * 0.22, height: height ?? 0.95 + Math.random() * 0.1, highlight,
  });
}

function lightOrDark(c) {
  return parseInt(c.slice(1), 16) > 0xdddddd ? '#e6e9ee' : c;
}

/** Person in casual clothes. look = { shirt, pants, skin (index), hair (index), hairStyle, build, height } */
export function makePerson(look, { highlight = false } = {}) {
  return buildRig({
    football: false, jersey: look.shirt, pants: look.pants ?? '#34495e', skin: SKINS[(look.skin ?? 0) % 5],
    hair: HAIRS[(look.hair ?? 0) % HAIRS.length], hairStyle: look.hairStyle ?? 0, build: look.build ?? 1, height: look.height ?? 1, highlight,
    shoe: look.shoe ?? '#f1f1f1',
  });
}

// ------------------------------------------------------------------ animation

let FRAME = 0;
export function nextFrame() { FRAME++; }
export function tickIdle(root, dt) {
  root.traverse((o) => { if (o.userData?.rig && o.userData.ticked !== FRAME) animateRun(o, dt, 0); });
}

const ACTION_DUR = { throw: 0.55, catch: 0.5, jump: 0.7, juke: 0.35, spin: 0.5, stiff: 0.6, dive: 0.7, tackle: 0.55, lunge: 0.4, fall: 0.5, getup: 0.7, wave: 1.2, spike: 0.9, release: 0.3, cut: 0.25 };

/** Pose for this frame. Returns target joint angles. */
function computePose(u, dt) {
  const P = { lh: 0, lk: 0, rh: 0, rk: 0, ls: 0.1, le: 0.3, rs: 0.1, re: 0.3, lout: 0.12, rout: -0.12, spine: 0.05, y: 0, rz: 0, ry: 0, rx: 0, head: 0 };
  const s = u.speed;
  // ---- locomotion
  if (s > 0.4 && !u.down) {
    const run = Math.min(1, s / 7);
    u.phase += dt * (5 + s * 1.25) * (u.back ? 1.3 : 1);
    const a = Math.sin(u.phase);
    const b = Math.cos(u.phase);
    if (u.back) {
      P.lh = a * 0.35; P.rh = -a * 0.35; P.lk = 0.4 + Math.max(0, b) * 0.4; P.rk = 0.4 + Math.max(0, -b) * 0.4;
      P.ls = 0.4 - a * 0.3; P.rs = 0.4 + a * 0.3; P.le = 1.2; P.re = 1.2; P.spine = -0.08; P.y = -0.08;
    } else {
      P.lh = a * (0.45 + run * 0.55); P.rh = -a * (0.45 + run * 0.55);
      P.lk = 0.15 + Math.max(0, -b) * (0.6 + run * 0.9); P.rk = 0.15 + Math.max(0, b) * (0.6 + run * 0.9);
      P.ls = -a * (0.4 + run * 0.7); P.rs = a * (0.4 + run * 0.7); P.le = 0.6 + run * 0.9; P.re = 0.6 + run * 0.9;
      P.spine = 0.08 + run * 0.28; P.y = -Math.abs(Math.sin(u.phase)) * 0.06 * run;
    }
  } else if (!u.down) {
    u.phase += dt * 1.6;
    P.spine = 0.04 + Math.sin(u.phase) * 0.02; // breathing
    P.ls = 0.08 + Math.sin(u.phase) * 0.03; P.rs = 0.08 - Math.sin(u.phase) * 0.03;
  }
  // ---- held poses
  const hold = u.hold;
  if (hold === 'stance') { P.y = -0.32; P.spine = 1.0; P.lh = 0.9; P.lk = 1.5; P.rh = 0.3; P.rk = 1.1; P.ls = 1.4; P.le = 0; P.rs = 0.5; P.re = 0.5; P.head = -0.6; }
  if (hold === 'block' || hold === 'tackle') { P.y = -0.16; P.spine = 0.55; P.lh = 0.5; P.lk = 0.9; P.rh = -0.3; P.rk = 0.7; P.ls = 1.35; P.rs = 1.35; P.le = 0.25; P.re = 0.25; P.lout = -0.15; P.rout = 0.15; P.head = -0.3; }
  if (hold === 'throw' || hold === 'throwWind') { P.rs = -2.5; P.re = 1.3; P.rout = -0.3; P.ls = 0.9; P.le = 0.6; P.spine = -0.1; P.ry = 0.5; }
  if (hold === 'catch' || hold === 'catchReach') { P.ls = 1.7; P.rs = 1.7; P.le = 0.2; P.re = 0.2; P.lout = -0.1; P.rout = 0.1; }
  if (hold === 'jump' || hold === 'jumpCatch') { P.ls = 2.9; P.rs = 2.9; P.le = 0.1; P.re = 0.1; P.lh = 0.9; P.lk = 1.6; P.rh = 0.3; P.rk = 1.0; }
  if (hold === 'dive') { P.rx = 1.2; P.y = -0.5; P.ls = 2.8; P.rs = 2.8; P.le = 0; P.re = 0; P.lh = -0.3; P.rh = -0.4; }
  if (hold === 'sit') { P.y = -0.45; P.lh = 1.55; P.rh = 1.55; P.lk = 1.55; P.rk = 1.55; P.ls = 0.4; P.rs = 0.4; P.le = 1.1; P.re = 1.1; }
  if (hold === 'wave') { P.rs = 2.8; P.re = 0.6 + Math.sin(u.phase * 6) * 0.4; }
  if (hold === 'getup') { P.y = -0.5; P.spine = 0.9; P.lh = 1.4; P.lk = 2; P.rh = 0.6; P.rk = 1.4; P.ls = 1; P.rs = 1; }
  // ---- one-shot actions
  const act = u.action;
  if (act) {
    act.t += dt;
    const p = Math.min(1, act.t / act.dur);
    const k = Math.sin(p * Math.PI);
    switch (act.name) {
      case 'throw': if (p < 0.45) { P.rs = -2.6 * (p / 0.45); P.re = 1.4; P.ry = 0.6; P.spine = -0.12; } else { P.rs = -2.6 + 4.2 * ((p - 0.45) / 0.55); P.re = 0.3; P.ry = -0.3; P.spine = 0.3; } P.ls = 0.8; break;
      case 'release': P.rs = 1.6; P.re = 0.2; P.spine = 0.3; P.ry = -0.3; break;
      case 'catch': P.ls = 1.6 + k * 0.6; P.rs = 1.6 + k * 0.6; P.le = 0.2; P.re = 0.2; break;
      case 'jump': P.ls = 2.9; P.rs = 2.9; P.le = 0.1; P.re = 0.1; P.lh = 0.9 * k; P.lk = 1.6 * k; P.rh = 0.3; P.rk = 1.0 * k; u.hop = Math.max(u.hop, k * 0.9); break;
      case 'juke': case 'cut': P.rz = (act.dir ?? 1) * 0.45 * k; P.y = -0.15 * k; P.lh = 0.6 * k * (act.dir ?? 1); P.rh = -0.6 * k * (act.dir ?? 1); P.lk = 0.6; P.rk = 0.6; P.spine = 0.3; break;
      case 'spin': P.ry = p * Math.PI * 2; P.spine = 0.25; P.ls = 1.1; P.rs = 0.4; P.lout = 0.6; P.rout = -0.9; break;
      case 'stiff': P.ls = 1.55; P.le = 0; P.lout = -0.05; P.spine = 0.35; P.rs = 0.2; P.re = 1.5; break;
      case 'dive': P.rx = 1.25 * Math.min(1, p * 2); P.y = -0.55 * Math.min(1, p * 2); P.ls = 2.8; P.rs = 2.8; P.le = 0; P.re = 0; P.lh = -0.3; P.rh = -0.4; break;
      case 'lunge': if (p < 0.5) { P.y = -0.25 * (p / 0.5); P.spine = 0.7; P.ls = -0.4; P.rs = -0.4; } else { P.y = -0.2; P.spine = 1.0; P.rx = 0.5 * ((p - 0.5) / 0.5); P.ls = 1.6; P.rs = 1.6; P.le = 0.3; P.re = 0.3; } break;
      case 'tackle': P.rx = 0.9 * k; P.y = -0.35 * k; P.ls = 1.5; P.rs = 1.5; P.lout = -0.4; P.rout = 0.4; P.le = 0.6; P.re = 0.6; P.spine = 0.6; break;
      case 'fall': P.rx = -1.45 * p; P.y = -0.62 * p; P.ls = 1.8 * p; P.rs = 2.2 * p; P.lh = 0.8 * p; P.rh = 1.2 * p; break;
      case 'getup': P.rx = -1.45 * (1 - p); P.y = -0.62 * (1 - p); P.lh = 1.2 * (1 - p); P.lk = 1.5 * (1 - p); break;
      case 'spike': if (p < 0.5) { P.rs = 2.8; P.re = 0.2; u.hop = Math.max(u.hop, k * 0.5); } else { P.rs = 2.8 - 4.2 * ((p - 0.5) / 0.5); P.spine = 0.6; } break;
      case 'wave': P.rs = 2.8; P.re = 0.6 + Math.sin(act.t * 14) * 0.4; break;
      default: break;
    }
    if (p >= 1) {
      u.action = null;
      if (act.then === 'down') { u.down = true; u.downT = 0; }
      else if (act.then) u.hold = act.then;
    }
  }
  // ---- celebrations (looping)
  if (u.celebrate && !u.down) {
    const t = (u.celebT = (u.celebT ?? 0) + dt);
    const c = u.celebrate;
    if (c === 'pump') { const a = Math.sin(t * 9); P.ls = 2.6 + a * 0.3; P.rs = 2.6 - a * 0.3; P.le = 0.6; P.re = 0.6; u.hop = Math.max(0, Math.sin(t * 9)) * 0.25; }
    else if (c === 'dance') { const a = Math.sin(t * 8); P.rz = a * 0.25; P.ry = a * 0.3; P.ls = 1.2 + a * 0.8; P.rs = 1.2 - a * 0.8; P.le = 1.2; P.re = 1.2; P.lh = a * 0.4; P.rh = -a * 0.4; P.lk = 0.4; P.rk = 0.4; P.y = -0.08 - Math.abs(a) * 0.06; }
    else if (c === 'flex') { P.ls = 1.6; P.rs = 1.6; P.lout = 1.3; P.rout = -1.3; P.le = 2.2; P.re = 2.2; P.y = -0.12; P.lh = 0.4; P.rh = -0.4; P.lk = 0.5; P.rk = 0.5; }
    else if (c === 'flip') { const p = (t % 1.6) / 0.8; if (p < 1) { P.rx = -p * Math.PI * 2; u.hop = Math.sin(p * Math.PI) * 1.4; P.lh = 1.6; P.rh = 1.6; P.lk = 2; P.rk = 2; } }
    else if (c === 'salute') { P.rs = 2.6; P.re = 2.3; P.rout = -0.6; P.spine = -0.05; }
    else if (c === 'point') { P.rs = 2.9; P.re = 0; P.ls = 2.9; P.le = 0; P.lout = 0.4; P.rout = -0.4; P.head = 0.4; }
  }
  // ---- down on the ground
  if (u.down) { u.downT += dt; P.rx = -1.5; P.y = -0.66; P.ls = 2.2; P.rs = 1.6; P.lh = 0.3; P.rh = 0.6; P.lk = 0.4; }
  return P;
}

function applyPose(p, P, dt) {
  const r = p.userData.rig;
  const u = p.userData.u;
  const k = 1 - Math.exp(-16 * dt);
  const L = (obj, prop, v) => { obj[prop] += (v - obj[prop]) * k; };
  L(r.legL.hip.rotation, 'x', P.lh); L(r.legL.knee.rotation, 'x', -P.lk);
  L(r.legR.hip.rotation, 'x', P.rh); L(r.legR.knee.rotation, 'x', -P.rk);
  L(r.armL.sh.rotation, 'x', P.ls); L(r.armL.el.rotation, 'x', P.le); L(r.armL.sh.rotation, 'z', -P.lout);
  L(r.armR.sh.rotation, 'x', P.rs); L(r.armR.el.rotation, 'x', P.re); L(r.armR.sh.rotation, 'z', -P.rout);
  L(r.spine.rotation, 'x', -P.spine);
  L(r.neck.rotation, 'x', -P.head);
  // body: position offset (crouch/hop), roll (juke lean), pitch (dive/fall), yaw (spin)
  u.hop = Math.max(0, u.hop - dt * 2.2);
  L(r.body.position, 'y', P.y + u.hop);
  L(r.body.rotation, 'z', P.rz);
  r.body.rotation.x += (-P.rx - r.body.rotation.x) * k; // pitch forward = negative x on this rig
  if (Math.abs(P.ry) > 3) r.body.rotation.y = P.ry; else L(r.body.rotation, 'y', P.ry);
  // smooth facing
  let d = u.targetYaw - p.rotation.y;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  p.rotation.y += d * (1 - Math.exp(-12 * dt));
}

/** Advance this character's animation. speed in yards/sec. */
export function animateRun(p, dt, speed) {
  if (!p.userData?.rig) return;
  const u = p.userData.u;
  p.userData.ticked = FRAME;
  u.speed = speed;
  applyPose(p, computePose(u, dt), dt);
}

/** Turn toward a point (smoothly). Characters face -z when yaw = 0. */
export function faceToward(p, x, z) {
  const dx = x - p.position.x;
  const dz = z - p.position.z;
  if (dx * dx + dz * dz < 1e-4) return;
  p.userData.u.targetYaw = Math.atan2(-dx, -dz);
}

export function setBackpedal(p, on) { p.userData.u.back = on; }

const HOLD_ALIAS = { throwWind: 'throw', catchReach: 'catch', jumpCatch: 'jump' };

/** Hold a pose until cleared: stance, block, tackle, throw, catch, jump, dive, sit, wave, getup, or null. */
export function setPose(p, pose) {
  const u = p.userData.u;
  u.hold = pose ? HOLD_ALIAS[pose] ?? pose : null;
}

/**
 * Play a one-shot action. name can also be an array (legacy sprite sequences); the first entry is used.
 * opts: { dir (for juke), then: pose to hold afterwards or 'down', dur }
 */
export function playAction(p, name, opts = {}) {
  const u = p.userData.u;
  let n = Array.isArray(name) ? name[0] : name;
  n = { throwRelease: 'release', throwWind: 'throw', catchReach: 'catch', jumpCatch: 'jump', celebrate0: 'spike', celebrate1: 'spike', idle0: 'release' }[n] ?? n;
  u.action = { name: n, t: 0, dur: opts.dur ?? ACTION_DUR[n] ?? 0.5, dir: opts.dir ?? 1, then: opts.then ?? null };
  u.hold = null;
}

const CELEBRATIONS = ['pump', 'dance', 'flex', 'flip', 'salute', 'point'];
export function celebrate(p, style) {
  const u = p.userData.u;
  u.down = false;
  u.hold = null;
  u.celebT = 0;
  u.celebrate = style ?? CELEBRATIONS[Math.floor(Math.random() * CELEBRATIONS.length)];
}
export function stopCelebrate(p) { p.userData.u.celebrate = null; }

/** Tackled: wrap, fall, then lie on the ground. knockDown(p, 0) gets them up again. */
export function knockDown(p, t = 1) {
  const u = p.userData.u;
  if (t <= 0) { u.down = false; playAction(p, 'getup'); return; }
  u.celebrate = null;
  playAction(p, 'fall', { then: 'down' });
}

export function isDown(p) { return p.userData.u.down; }

export function setHop(p, h) { p.userData.u.hop = Math.max(p.userData.u.hop, h); }

// ------------------------------------------------------------------ ball & markers

export function makeBall() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(geo().ball, toon('#8b4513'));
  b.scale.set(1, 1, 1.75);
  g.add(b);
  const lace = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.02, 0.14), toon('#ffffff'));
  lace.position.y = 0.105;
  g.add(lace);
  const shadow = new THREE.Mesh(geo().shadow, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.setScalar(0.3);
  g.userData.shadow = shadow;
  return g;
}

export function makeRing(color, inner = 0.8, outer = 1.0, opacity = 0.9) {
  const m = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.04;
  return m;
}

export function makeDisc(color, r = 1, opacity = 0.5) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 20), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.035;
  return m;
}

/** Round badge label (receiver numbers, "!" markers). */
export function makeLabel(text, { color = '#ffd43b', size = 0.9 } = {}) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#0e1116';
  g.beginPath(); g.arc(32, 32, 30, 0, Math.PI * 2); g.fill();
  g.fillStyle = color;
  g.beginPath(); g.arc(32, 32, 25, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#0e1116';
  g.font = '900 34px "Arial Black", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(text), 32, 35);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.setScalar(size);
  s.renderOrder = 10;
  return s;
}

export function makeRouteLine(points, color = '#ffffff', opacity = 0.75) {
  const pts = points.map((p) => new THREE.Vector3(p.x, 0.06, p.z));
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  const line = new THREE.Line(g, new THREE.LineDashedMaterial({ color, dashSize: 0.8, gapSize: 0.6, transparent: true, opacity }));
  line.computeLineDistances();
  return line;
}

/** Confetti burst. Returns an updater (false when done). */
export function confetti(scene, origin, colors) {
  const n = 140;
  const geoP = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const vel = [];
  const palette = colors.map((c) => new THREE.Color(c));
  for (let i = 0; i < n; i++) {
    pos.set([origin.x, origin.y + 1, origin.z], i * 3);
    const c = palette[i % palette.length];
    col.set([c.r, c.g, c.b], i * 3);
    vel.push(new THREE.Vector3((Math.random() - 0.5) * 10, 6 + Math.random() * 8, (Math.random() - 0.5) * 10));
  }
  geoP.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geoP.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geoP, new THREE.PointsMaterial({ size: 0.22, vertexColors: true }));
  scene.add(pts);
  let life = 0;
  return (dt) => {
    life += dt;
    for (let i = 0; i < n; i++) {
      vel[i].y -= 12 * dt;
      pos[i * 3] += vel[i].x * dt;
      pos[i * 3 + 1] = Math.max(0.05, pos[i * 3 + 1] + vel[i].y * dt);
      pos[i * 3 + 2] += vel[i].z * dt;
    }
    geoP.attributes.position.needsUpdate = true;
    if (life > 3) { scene.remove(pts); geoP.dispose(); return false; }
    return true;
  };
}
