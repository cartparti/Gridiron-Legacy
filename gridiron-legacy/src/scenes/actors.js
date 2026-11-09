// Pixel-art players, ball, rings, labels and effects (three.js sprites).
import * as THREE from 'three';
import { playerSheet, ballCanvas, FW, FH, COLS, ROWS } from './pixelart.js';

const texCache = new Map();
function sheetTexture(colors, skin) {
  const key = `${colors[0]}|${colors[1]}|${skin}`;
  if (!texCache.has(key)) {
    const t = new THREE.CanvasTexture(playerSheet(colors, skin));
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.colorSpace = THREE.SRGBColorSpace;
    texCache.set(key, t);
  }
  return texCache.get(key);
}

const shadowGeo = new THREE.CircleGeometry(0.75, 10);
const shadowMat = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.35, depthWrite: false });

const SPRITE_W = 1.6;
const SPRITE_H = SPRITE_W * (FH / FW);

/** A pixel-art player. Position the returned group in yards; it faces -z (away) by default. */
export function makePlayer(colors, { highlight = false, skin } = {}) {
  const root = new THREE.Group();
  const skinIdx = skin ?? Math.floor(Math.random() * 5);
  const tex = sheetTexture(colors, skinIdx).clone();
  tex.repeat.set(1 / COLS, 1 / ROWS);
  tex.needsUpdate = true;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.5 }));
  sprite.center.set(0.5, 0);
  sprite.scale.set(SPRITE_W, SPRITE_H, 1);
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
  root.userData = { ...root.userData, sprite, tex, view: 0, flip: false, frame: 0, t: Math.random(), pose: null, down: false, hop: 0 };
  setFrame(root);
  return root;
}

function setFrame(p) {
  const u = p.userData;
  const col = u.down ? 8 : u.pose === 'throw' ? 5 : u.pose === 'catch' ? 6 : u.pose === 'dive' ? 7 : u.frame;
  const row = u.down ? 1 : u.view;
  // Texture rows go bottom-up in UV space.
  const flip = u.view === 2 && u.flip;
  u.tex.repeat.x = (flip ? -1 : 1) / COLS;
  u.tex.offset.x = (col + (flip ? 1 : 0)) / COLS;
  u.tex.offset.y = (ROWS - 1 - row) / ROWS;
}

/** Advance the run cycle. speed in yards/sec. */
export function animateRun(p, dt, speed) {
  const u = p.userData;
  if (speed > 0.6) {
    u.t += dt * (3 + speed * 0.9);
    u.frame = 1 + (Math.floor(u.t * 2) % 4);
  } else u.frame = 0;
  u.sprite.position.y = u.hop;
  setFrame(p);
}

/** Choose the back / front / side frames based on direction of travel or facing. */
export function faceToward(p, x, z) {
  const dx = x - p.position.x;
  const dz = z - p.position.z;
  if (dx * dx + dz * dz < 1e-4) return;
  const u = p.userData;
  if (Math.abs(dx) > Math.abs(dz) * 0.9) { u.view = 2; u.flip = dx < 0; }
  else u.view = dz < 0 ? 0 : 1;
  setFrame(p);
}

export function setPose(p, pose) {
  p.userData.pose = pose;
  setFrame(p);
}

/** Tackled / fallen. */
export function knockDown(p, t = 1) {
  p.userData.down = t > 0;
  setFrame(p);
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
  s.scale.set(0.8, 0.6, 1);
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
