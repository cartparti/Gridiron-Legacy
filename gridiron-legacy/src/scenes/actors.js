// Pixel-art players, ball, rings, labels and effects (three.js sprites).
import * as THREE from 'three';
import { playerSheet, casualSheet, ballCanvas, FW, FH, COLS, ROWS, poseCol } from './pixelart.js';

const texCache = new Map();
function sheetTexture(key, make) {
  if (!texCache.has(key)) {
    const t = new THREE.CanvasTexture(make());
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.colorSpace = THREE.SRGBColorSpace;
    texCache.set(key, t);
  }
  return texCache.get(key);
}

const shadowGeo = new THREE.CircleGeometry(0.75, 12);
const shadowMat = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.35, depthWrite: false });

const SPRITE_W = 1.75;
const SPRITE_H = SPRITE_W * (FH / FW);
let FRAME = 0;
/** Called once per rendered frame by the director. */
export function nextFrame() { FRAME++; }
/** Keep every character animating (idle breathing, celebrations) even if a minigame stopped updating it. */
export function tickIdle(root, dt) {
  root.traverse((o) => { if (o.userData?.sprite && o.userData.tex && o.userData.ticked !== FRAME) animateRun(o, dt, 0); });
}

const RUN = ['run0', 'run1', 'run2', 'run3', 'run4', 'run5'];
const BACK = ['back0', 'idle0', 'back1', 'idle0'];
const IDLE = ['idle0', 'idle1'];

function makeSprite(baseTex) {
  const tex = baseTex.clone();
  tex.repeat.set(1 / COLS, 1 / ROWS);
  tex.needsUpdate = true;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.5 }));
  sprite.center.set(0.5, 0.06);
  sprite.scale.set(SPRITE_W, SPRITE_H, 1);
  return { sprite, tex };
}

function wrap(sprite, tex, { highlight = false } = {}) {
  const root = new THREE.Group();
  root.add(sprite);
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(1, 0.6, 1);
  shadow.position.y = 0.02;
  root.add(shadow);
  if (highlight) {
    const ring = makeRing('#ffd43b', 0.85, 1.1, 1);
    root.add(ring);
    root.userData.ring = ring;
  }
  root.userData = { ...root.userData, sprite, tex, view: 0, flip: false, pose: 'idle0', t: Math.random() * 3, hold: null, action: null, down: false, hop: 0, back: false };
  setFrame(root);
  return root;
}

/** A pixel-art football player in team colors. Faces -z (away from camera) by default. */
export function makePlayer(colors, { highlight = false, skin } = {}) {
  const skinIdx = skin ?? Math.floor(Math.random() * 5);
  const base = sheetTexture(`fb|${colors[0]}|${colors[1]}|${skinIdx}`, () => playerSheet(colors, skinIdx));
  const { sprite, tex } = makeSprite(base);
  return wrap(sprite, tex, { highlight });
}

/** A person in casual clothes for the walkable world. look = { shirt, pants, skin, hair, hairStyle } */
export function makePerson(look, { highlight = false } = {}) {
  const base = sheetTexture(`cas|${look.shirt}|${look.pants}|${look.skin}|${look.hair}|${look.hairStyle}`, () => casualSheet(look));
  const { sprite, tex } = makeSprite(base);
  return wrap(sprite, tex, { highlight });
}

function setFrame(p) {
  const u = p.userData;
  const name = u.down ? 'down' : u.action ? u.action.seq[Math.min(u.action.seq.length - 1, Math.floor(u.action.t * u.action.fps))] : u.hold ?? u.pose;
  const col = poseCol(name);
  const row = name === 'down' ? 2 : u.view;
  const flip = (row === 2) && (u.view === 2 ? u.flip : false);
  u.tex.repeat.x = (flip ? -1 : 1) / COLS;
  u.tex.offset.x = (col + (flip ? 1 : 0)) / COLS;
  u.tex.offset.y = (ROWS - 1 - row) / ROWS;
}

/** Advance locomotion animation (run / backpedal / idle) and any one-shot action. speed in yards/sec. */
export function animateRun(p, dt, speed) {
  const u = p.userData;
  u.ticked = FRAME;
  u.t += dt;
  if (u.action) {
    u.action.t += dt;
    if (u.action.t * u.action.fps >= u.action.seq.length) {
      if (u.action.loop) u.action.t = 0;
      else {
        const done = u.action.then;
        u.action = null;
        if (done === 'down') u.down = true;
        else if (typeof done === 'string') u.hold = done;
      }
    }
  } else if (!u.hold && !u.down) {
    if (speed > 0.6) {
      const seq = u.back ? BACK : RUN;
      u.pose = seq[Math.floor(u.t * (5 + speed * 1.15)) % seq.length];
    } else u.pose = IDLE[Math.floor(u.t * 1.6) % 2];
  }
  u.sprite.position.y = u.hop;
  setFrame(p);
}

/** Choose back / front / side frames from the direction of travel or facing. */
export function faceToward(p, x, z) {
  const dx = x - p.position.x;
  const dz = z - p.position.z;
  if (dx * dx + dz * dz < 1e-4) return;
  const u = p.userData;
  if (Math.abs(dx) > Math.abs(dz) * 0.9) { u.view = 2; u.flip = dx < 0; }
  else u.view = dz < 0 ? 0 : 1;
  setFrame(p);
}

/** Backpedal mode: run cycle plays as a backpedal (for defensive backs). */
export function setBackpedal(p, on) { p.userData.back = on; }

const POSE_ALIAS = { throw: 'throwWind', catch: 'catchReach', dive: 'dive', jump: 'jumpCatch', stance: 'stance', sit: 'sit', wave: 'wave' };

/** Hold a pose until cleared (setPose(p, null)). */
export function setPose(p, pose) {
  p.userData.hold = pose ? POSE_ALIAS[pose] ?? pose : null;
  setFrame(p);
}

/** Play a one-shot sequence of poses, then optionally hold a final pose ('down' lies down). */
export function playAction(p, seq, { fps = 8, loop = false, then = null } = {}) {
  p.userData.action = { seq, fps, t: 0, loop, then };
  p.userData.hold = null;
  setFrame(p);
}

export function celebrate(p) {
  p.userData.down = false;
  playAction(p, ['celebrate0', 'celebrate1'], { fps: 4, loop: true });
}

/** Tackled: impact, fall, then lie on the ground. */
export function knockDown(p, t = 1) {
  if (t <= 0) { p.userData.down = false; setFrame(p); return; }
  playAction(p, ['tackle', 'fall', 'fall'], { fps: 9, then: 'down' });
}

/** Small vertical hop (jumps, dives). */
export function setHop(p, h) {
  p.userData.hop = h;
  p.userData.sprite.position.y = h;
}

export function makeBall() {
  const g = new THREE.Group();
  const t = new THREE.CanvasTexture(ballCanvas());
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, alphaTest: 0.5 }));
  s.scale.set(0.75, 0.52, 1);
  g.add(s);
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.setScalar(0.3);
  g.userData.shadow = shadow;
  return g;
}

export function makeRing(color, inner = 0.8, outer = 1.0, opacity = 0.9) {
  const m = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 20), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.04;
  return m;
}

/** Ground marker (filled disc). */
export function makeDisc(color, r = 1, opacity = 0.5) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 18), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.035;
  return m;
}

/** Pixel label bubble (e.g. receiver numbers). */
export function makeLabel(text, { color = '#ffd43b', size = 1.3 } = {}) {
  const c = document.createElement('canvas');
  c.width = 12;
  c.height = 12;
  const g = c.getContext('2d');
  g.fillStyle = '#101418';
  g.fillRect(1, 0, 10, 12); g.fillRect(0, 1, 12, 10);
  g.fillStyle = color;
  g.fillRect(2, 1, 8, 10); g.fillRect(1, 2, 10, 8);
  // 3x5 pixel digits
  const D = { 1: ['010', '110', '010', '010', '111'], 2: ['111', '001', '111', '100', '111'], 3: ['111', '001', '111', '001', '111'], 4: ['101', '101', '111', '001', '001'] };
  const rows = D[text] ?? D[1];
  g.fillStyle = '#101418';
  rows.forEach((r, y) => [...r].forEach((b, x) => { if (b === '1') g.fillRect(4 + x * 1, 3 + y, 1, 1); }));
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
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

/** Pixel confetti burst for touchdowns and turnovers. Returns an updater (false when done). */
export function confetti(scene, origin, colors) {
  const n = 90;
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
  const pts = new THREE.Points(geoP, new THREE.PointsMaterial({ size: 0.5, vertexColors: true }));
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
