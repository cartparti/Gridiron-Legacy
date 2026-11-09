// Stylized low-poly players, the ball, rings and labels. Geometries are shared for speed.
import * as THREE from 'three';

const GEO = {};
function geo() {
  if (GEO.torso) return GEO;
  GEO.torso = new THREE.CylinderGeometry(0.42, 0.5, 0.95, 7);
  GEO.pads = new THREE.BoxGeometry(1.25, 0.28, 0.62);
  GEO.helmet = new THREE.IcosahedronGeometry(0.34, 1);
  GEO.mask = new THREE.BoxGeometry(0.42, 0.12, 0.12);
  GEO.leg = new THREE.BoxGeometry(0.24, 0.85, 0.28);
  GEO.arm = new THREE.BoxGeometry(0.2, 0.75, 0.22);
  GEO.shadow = new THREE.CircleGeometry(0.65, 14);
  GEO.ball = new THREE.SphereGeometry(0.2, 10, 8);
  GEO.lace = new THREE.BoxGeometry(0.03, 0.03, 0.2);
  return GEO;
}

const matCache = new Map();
function mat(color) {
  if (!matCache.has(color)) matCache.set(color, new THREE.MeshLambertMaterial({ color, flatShading: true }));
  return matCache.get(color);
}
const shadowMat = new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.3, depthWrite: false });

/** A player figure. Facing -z by default (offense). */
export function makePlayer(colors, { scale = 1, highlight = false } = {}) {
  const G = geo();
  const [jersey, trim] = colors;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const torso = new THREE.Mesh(G.torso, mat(jersey));
  torso.position.y = 1.3;
  const pads = new THREE.Mesh(G.pads, mat(jersey));
  pads.position.y = 1.72;
  const helmet = new THREE.Mesh(G.helmet, mat(trim));
  helmet.position.y = 2.12;
  const mask = new THREE.Mesh(G.mask, mat('#9ca3af'));
  mask.position.set(0, 2.05, -0.3);
  body.add(torso, pads, helmet, mask);
  const legs = [];
  for (const sx of [-0.17, 0.17]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx, 0.88, 0);
    const leg = new THREE.Mesh(G.leg, mat(trim));
    leg.position.y = -0.42;
    pivot.add(leg);
    body.add(pivot);
    legs.push(pivot);
  }
  const arms = [];
  for (const sx of [-0.68, 0.68]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx, 1.68, 0);
    const arm = new THREE.Mesh(G.arm, mat(jersey));
    arm.position.y = -0.35;
    pivot.add(arm);
    body.add(pivot);
    arms.push(pivot);
  }
  const shadow = new THREE.Mesh(G.shadow, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  root.add(shadow);
  if (highlight) {
    const ring = makeRing('#ffd43b', 0.75, 0.95);
    root.add(ring);
    root.userData.ring = ring;
  }
  root.scale.setScalar(scale);
  root.userData = { ...root.userData, legs, arms, body, phase: Math.random() * 6, down: 0 };
  return root;
}

/** Animate running legs and arms. speed in yards/sec. */
export function animateRun(p, dt, speed) {
  const u = p.userData;
  u.phase += dt * (4 + speed * 1.3);
  const a = Math.min(0.9, speed * 0.12);
  u.legs[0].rotation.x = Math.sin(u.phase) * a;
  u.legs[1].rotation.x = -Math.sin(u.phase) * a;
  u.arms[0].rotation.x = -Math.sin(u.phase) * a * 0.8;
  u.arms[1].rotation.x = Math.sin(u.phase) * a * 0.8;
  u.body.position.y = Math.abs(Math.sin(u.phase)) * 0.06 * Math.min(1, speed / 4);
}

/** Tip a player over (tackled / juked). t from 0 to 1. */
export function knockDown(p, t, dir = 1) {
  p.userData.body.rotation.x = dir * Math.min(1, t) * 1.35;
  p.userData.body.position.y = -Math.min(1, t) * 0.5;
}

export function faceToward(obj, x, z) {
  const dx = x - obj.position.x;
  const dz = z - obj.position.z;
  if (dx * dx + dz * dz < 1e-4) return;
  obj.rotation.y = Math.atan2(-dx, -dz);
}

export function makeBall() {
  const G = geo();
  const g = new THREE.Group();
  const b = new THREE.Mesh(G.ball, mat('#8b4513'));
  b.scale.set(1, 1, 1.7);
  const lace = new THREE.Mesh(G.lace, mat('#ffffff'));
  lace.position.y = 0.19;
  g.add(b, lace);
  const shadow = new THREE.Mesh(G.shadow, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.setScalar(0.35);
  g.userData.shadow = shadow;
  return g;
}

export function makeRing(color, inner = 0.8, outer = 1.0, opacity = 0.9) {
  const m = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.04;
  return m;
}

export function makeLabel(text, { color = '#ffffff', bg = 'rgba(0,0,0,0.65)', size = 1.4 } = {}) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.beginPath();
  g.arc(64, 64, 56, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 8;
  g.strokeStyle = color;
  g.stroke();
  g.fillStyle = color;
  g.font = '900 70px Arial Black, Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.setScalar(size);
  s.renderOrder = 10;
  return s;
}

/** Simple dashed route line on the ground. */
export function makeRouteLine(points, color = '#ffffff') {
  const pts = points.map((p) => new THREE.Vector3(p.x, 0.06, p.z));
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  const line = new THREE.Line(g, new THREE.LineDashedMaterial({ color, dashSize: 0.8, gapSize: 0.5, transparent: true, opacity: 0.75 }));
  line.computeLineDistances();
  return line;
}

/** Burst of confetti particles for touchdowns. Returns an updater. */
export function confetti(scene, origin, colors) {
  const n = 120;
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
  const pts = new THREE.Points(geoP, new THREE.PointsMaterial({ size: 0.35, vertexColors: true }));
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
