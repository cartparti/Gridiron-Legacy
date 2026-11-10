// Indoor sets for scenes away from the field: the halftime locker room (different for high school, college and
// pro, in your team's colors with its crest and mascot) and short life cutscenes (awards banquet, date night,
// hanging out with friends, gaming). Built from the same rounded props and characters as the rest of the game.
import * as THREE from 'three';
import { makePlayer, makePerson, setPose, faceToward, celebrate, animateRun, applyWear } from './actors.js';
import { roundedBox, M, makeProp } from './props.js';
import { makeMascot } from './sideline.js';
import { randomLook } from '../data/looks.js';

const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => (k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k));
const shade = (hex, amt) => { const c = new THREE.Color(hex); c.offsetHSL(0, 0, amt); return `#${c.getHexString()}`; };

function rb(parent, w, h, d, mat, x = 0, y = 0, z = 0, r) {
  const m = new THREE.Mesh(roundedBox(w, h, d, r ?? Math.min(w, h, d) * 0.15), mat);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function textPlane(text, { w = 4, h = 0.8, bg = null, fg = '#ffffff', font = 800 } = {}) {
  const t = canvasTex(512, Math.round(512 * h / w), (g, W, H) => {
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, W, H); }
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    let size = H * 0.62; g.font = `${font} ${size}px Inter, "Arial Black", sans-serif`;
    while (g.measureText(text).width > W * 0.92 && size > 8) { size -= 2; g.font = `${font} ${size}px Inter, "Arial Black", sans-serif`; }
    g.fillText(text, W / 2, H / 2 + 2);
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: !bg, toneMapped: false }));
}
function imagePlane(url, w, h, crisp = true) {
  const tex = new THREE.TextureLoader().load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (crisp) { tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; }
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
}

/** A simple room: floor with a painted texture, back + side walls, lights with soft shadows. */
function room(scene, { w, d, h = 3.6, floorDraw, floorRough = 0.85, wall = '#d8d4cc', band = null, light = '#fff3e2', lightK = 1 }) {
  const g = new THREE.Group();
  scene.add(g);
  const ft = canvasTex(1024, Math.round(1024 * d / w), floorDraw);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: ft, roughness: floorRough }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
  const wm = M(wall, 0.92);
  const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.2), wm); back.position.set(0, h / 2, -d / 2 - 0.1); back.receiveShadow = true; g.add(back);
  for (const sd of [-1, 1]) { const side = new THREE.Mesh(new THREE.BoxGeometry(0.2, h, d), wm); side.position.set(sd * (w / 2 + 0.1), h / 2, 0); side.receiveShadow = true; g.add(side); }
  if (band) {
    const bm = M(band, 0.7);
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, 0.03), bm); b1.position.set(0, h - 0.5, -d / 2 + 0.02); g.add(b1);
    for (const sd of [-1, 1]) { const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.35, d), bm); b2.position.set(sd * (w / 2 - 0.02), h - 0.5, 0); g.add(b2); }
  }
  g.add(new THREE.HemisphereLight('#ffffff', '#55504a', 0.75 * lightK));
  const key = new THREE.DirectionalLight(light, 1.9 * lightK);
  key.position.set(-w * 0.25, 9, d * 0.9);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  const half = Math.max(w, d) * 0.7;
  Object.assign(key.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 1, far: 40 });
  key.shadow.bias = -0.0008; key.shadow.normalBias = 0.02;
  g.add(key, key.target);
  return g;
}
const shadows = (obj) => { obj.traverse((o) => { if (o.isMesh) o.castShadow = true; }); return obj; };
function seat(person, x, z, lookX, lookZ) {
  person.position.set(x, 0, z);
  faceToward(person, lookX, lookZ);
  person.rotation.y = person.userData.u.targetYaw;
  setPose(person, 'sit');
  return person;
}
function stand(person, x, z, lookX, lookZ) {
  person.position.set(x, 0, z);
  faceToward(person, lookX, lookZ);
  person.rotation.y = person.userData.u.targetYaw;
  return person;
}

// ------------------------------------------------------------------ halftime locker room

/** One locker stall, 1.9 wide, back toward -z. kind: hs (metal), college (wood), pro (lit). */
function stall(kind, colors, i) {
  const g = new THREE.Group();
  const [c0, c1] = colors;
  if (kind === 'hs') {
    rb(g, 1.86, 2.1, 0.55, M(c0, 0.45, 0.45), 0, 0, 0, 0.03);
    for (const x of [-0.47, 0.47]) { rb(g, 0.02, 1.9, 0.01, M(shade(c0, -0.15), 0.6), x + 0.4, 0.1, 0.285, 0.004); for (let y = 1.65; y < 1.95; y += 0.07) rb(g, 0.5, 0.018, 0.01, M(shade(c0, -0.18), 0.6), x, y, 0.285, 0.004); rb(g, 0.05, 0.12, 0.03, M('#c9ced4', 0.3, 0.8), x + 0.3, 1.05, 0.29, 0.01); }
    const num = textPlane(String(10 + i * 7), { w: 0.4, h: 0.22, fg: c1 }); num.position.set(0, 1.45, 0.3); g.add(num);
  } else {
    const wood = kind === 'pro' ? M('#1c1f24', 0.5, 0.1) : M('#8a5f3c', 0.6);
    for (const x of [-0.93, 0.93]) rb(g, 0.07, 2.3, 0.7, wood, x, 0, 0, 0.02);
    rb(g, 1.9, 0.07, 0.7, wood, 0, 2.25, 0, 0.02);
    rb(g, 1.8, 2.3, 0.05, kind === 'pro' ? M('#2a2e35', 0.6) : M('#a57850', 0.7), 0, 0, -0.32, 0.01);
    rb(g, 1.8, 0.06, 0.6, wood, 0, 1.7, 0, 0.02); // shelf
    rb(g, 1.8, 0.42, 0.62, kind === 'pro' ? M('#30343b', 0.8) : wood, 0, 0, 0.02, 0.05); // seat box
    rb(g, 1.7, 0.08, 0.55, M(c0, 0.9), 0, 0.42, 0.04, 0.03); // cushion
    // helmet on the shelf, jersey on a hanger
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), M(c0, 0.3)); helm.position.set(-0.45, 1.95, 0); helm.scale.set(1, 0.95, 1.1); helm.castShadow = true; g.add(helm);
    rb(g, 0.06, 0.24, 0.3, M(c1, 0.4), -0.45, 1.84, 0.0, 0.02);
    rb(g, 0.75, 0.85, 0.08, M(c0, 0.85), 0.4, 0.72, -0.2, 0.06); rb(g, 0.75, 0.1, 0.085, M(c1, 0.85), 0.4, 1.3, -0.2, 0.02);
    const plate = textPlane(String(10 + ((i * 13) % 80)), { w: 0.5, h: 0.2, bg: c0, fg: c1 }); plate.position.set(0, 2.42, 0.36); g.add(plate);
    if (kind === 'pro') { // glowing team-color light strips
      const led = M(c1, 0.3, 0, c1);
      rb(g, 1.8, 0.03, 0.03, led, 0, 2.2, 0.3, 0.01);
      for (const x of [-0.88, 0.88]) rb(g, 0.03, 2.2, 0.03, led, x, 0, 0.33, 0.01);
    }
  }
  return g;
}

/**
 * Halftime locker room. opts: { stage, colors, uniform, crestUrl, teamName, mascot, look, number, coachLook,
 * mateLooks, wear, winning }. Returns update(dt, t).
 */
export function lockerRoom(ctx, opts) {
  const { scene, camera } = ctx;
  const kind = opts.stage === 'hs' ? 'hs' : opts.stage === 'college' ? 'college' : 'pro';
  const [c0, c1] = opts.colors;
  const W = 17; const D = 11;
  const floorDraw = (g, w, h) => {
    if (kind === 'hs') { // sealed concrete with a painted team stripe
      g.fillStyle = '#8d9398'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
      g.fillStyle = c0; g.fillRect(0, h * 0.47, w, h * 0.06); g.fillStyle = c1; g.fillRect(0, h * 0.455, w, h * 0.012); g.fillRect(0, h * 0.533, w, h * 0.012);
    } else { // carpet in team colors
      const base = kind === 'pro' ? '#22252b' : shade(c0, -0.12);
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 5000; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.035)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      g.strokeStyle = c1; g.lineWidth = 10; g.strokeRect(40, 40, w - 80, h - 80);
      g.fillStyle = kind === 'pro' ? c0 : shade(c0, 0.06); g.beginPath(); g.ellipse(w / 2, h * 0.56, h * 0.3, h * 0.3, 0, 0, 7); g.fill();
      g.strokeStyle = c1; g.lineWidth = 12; g.beginPath(); g.ellipse(w / 2, h * 0.56, h * 0.3, h * 0.3, 0, 0, 7); g.stroke();
    }
  };
  room(scene, { w: W, d: D, h: kind === 'hs' ? 3.3 : 3.9, floorDraw, floorRough: kind === 'hs' ? 0.6 : 0.95,
    wall: kind === 'hs' ? '#d9d2bf' : kind === 'college' ? '#e9e4da' : '#2b2f36', band: c0, light: kind === 'pro' ? '#eaf2ff' : '#fff3e2', lightK: kind === 'pro' ? 0.9 : 1 });
  scene.background = new THREE.Color(kind === 'pro' ? '#0e1013' : '#1c1d20');
  // crest on the floor (college/pro) and on the back wall
  if (opts.crestUrl) {
    if (kind !== 'hs') { const fc = imagePlane(opts.crestUrl, 2.6, 3.05); fc.rotation.x = -Math.PI / 2; fc.position.set(0, 0.012, 0.66); scene.add(fc); }
    const wc = imagePlane(opts.crestUrl, 1.5, 1.76); wc.position.set(0, kind === 'hs' ? 2.55 : 3.0, -D / 2 + 0.03); scene.add(wc);
  }
  const name = textPlane(String(opts.teamName ?? '').toUpperCase(), { w: 5.2, h: 0.5, fg: kind === 'pro' ? c1 : c0 }); name.position.set(-4.6, kind === 'hs' ? 2.9 : 3.35, -D / 2 + 0.03); scene.add(name);
  const slogan = textPlane(kind === 'hs' ? 'PLAY FOR EACH OTHER' : kind === 'college' ? 'TRADITION · EFFORT · PRIDE' : 'FINISH', { w: 5.2, h: 0.5, fg: kind === 'pro' ? c1 : c0 }); slogan.position.set(4.6, kind === 'hs' ? 2.9 : 3.35, -D / 2 + 0.03); scene.add(slogan);
  // stalls along the back wall and both sides
  for (let i = 0; i < 8; i++) { const s = stall(kind, opts.colors, i); s.position.set(-7.35 + i * 2.1, 0, -D / 2 + 0.4); scene.add(s); }
  for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) { const s = stall(kind, opts.colors, 8 + i); s.position.set(sd * (W / 2 - 0.42), 0, -2.6 + i * 2.1); s.rotation.y = -sd * Math.PI / 2; scene.add(s); }
  // benches (hs: wood on steel legs; others sit at their stalls + a center bench)
  const benchMat = kind === 'pro' ? M('#15171b', 0.6) : M('#b08458', 0.6);
  for (const x of [-3.2, 3.2]) { rb(scene, 4.6, 0.09, 0.5, benchMat, x, 0.4, -0.9, 0.03); for (const dx of [-1.9, 1.9]) rb(scene, 0.1, 0.4, 0.4, M('#3a3f46', 0.4, 0.6), x + dx, 0, -0.9, 0.02); }
  // whiteboard with the second-half plan
  const board = new THREE.Group();
  rb(board, 3.0, 1.9, 0.08, M('#f7f7f4', 0.4), 0, 0.9, 0, 0.03);
  const plan = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.7), new THREE.MeshBasicMaterial({ toneMapped: false, map: canvasTex(512, 310, (g, w, h) => {
    g.fillStyle = '#f7f7f4'; g.fillRect(0, 0, w, h); g.strokeStyle = '#1d3557'; g.lineWidth = 5; g.lineCap = 'round';
    for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(150 + i * 50, 200, 14, 0, 7); g.stroke(); }
    g.strokeStyle = '#c0392b';
    for (let i = 0; i < 6; i++) { const x = 130 + i * 48; const y = 110 + (i % 2) * 30; g.beginPath(); g.moveTo(x - 12, y - 12); g.lineTo(x + 12, y + 12); g.moveTo(x + 12, y - 12); g.lineTo(x - 12, y + 12); g.stroke(); }
    g.strokeStyle = '#1d3557'; g.setLineDash([10, 8]); g.beginPath(); g.moveTo(250, 186); g.quadraticCurveTo(300, 90, 420, 60); g.stroke(); g.beginPath(); g.moveTo(150, 186); g.quadraticCurveTo(100, 100, 60, 70); g.stroke();
    g.setLineDash([]); g.fillStyle = '#111'; g.font = '800 30px Inter, sans-serif'; g.fillText('2ND HALF', 20, 40);
  }) }));
  plan.position.set(0, 1.85, 0.05); board.add(plan);
  for (const x of [-1.3, 1.3]) rb(board, 0.08, 0.9, 0.5, M('#555b63', 0.4, 0.6), x, 0, 0, 0.02);
  board.position.set(5.6, 0, 2.2); board.rotation.y = -0.9; scene.add(board);
  // mascot statue in the corner (college / pro)
  if (kind !== 'hs') { const mas = makeMascot(opts.mascot ?? 'shield', opts.colors); mas.position.set(-7.0, 0, 3.4); mas.rotation.y = 0.9; mas.scale.setScalar(0.85); scene.add(shadows(mas)); rb(scene, 1.5, 0.12, 1.5, M(c1, 0.5, 0.3), -7.0, 0, 3.4, 0.04); }
  // water cooler + towels
  rb(scene, 0.7, 0.9, 0.7, M('#f2f2f2', 0.5), 7.2, 0, 4.2, 0.05); rb(scene, 0.6, 0.55, 0.6, M('#ff7a1a', 0.5), 7.2, 0.9, 4.2, 0.12);
  // ---- people
  const wearOf = () => (opts.wear ? { level: Math.min(1, (opts.wear.progress ?? 0.5) * (0.5 + Math.random() * 0.8)), wet: opts.wear.wet ?? 0, snow: !!opts.wear.snow, mud: !!opts.wear.mud, blood: 0 } : null);
  const mk = (look, number) => { const p = makePlayer(opts.colors, { uniform: opts.uniform, look, number, helmet: false }); const w = wearOf(); if (w) applyWear(p, w); shadows(p); scene.add(p); return p; };
  const me = seat(mk(opts.look, opts.number), -0.9, -0.82, 4.5, 2.5);
  const spots = [[-3.0, -0.82], [-4.6, -0.82], [1.6, -0.82], [3.2, -0.82], [4.8, -0.82]];
  const mates = spots.map(([x, z], i) => seat(mk(opts.mateLooks?.[i], undefined), x, z, 4.5 + (i % 2), 2.6));
  mates.push(stand(mk(opts.mateLooks?.[5]), -5.6, 1.6, 4, 2), stand(mk(opts.mateLooks?.[6]), 0.8, -3.6, 4, 2));
  const coach = makePerson({ ...(opts.coachLook ?? randomLook('coach')), outfit: 'casual', shirt: c0, pants: '#c8b48a', shoe: '#f1f1f1' });
  stand(shadows(coach), 3.9, 2.0, -1, -1); scene.add(coach);
  let nextGesture = 1.2;
  return (dt, t) => {
    // coach talks with his hands; now and then a teammate reacts
    if (t > nextGesture) {
      nextGesture = t + 2.4 + Math.random() * 2;
      celebrate(coach, opts.winning ? 'point' : 'pump');
      if (Math.random() < 0.5) celebrate(mates[5 + Math.floor(Math.random() * 2)], 'pump');
    }
    const a = Math.sin(t * 0.22) * 0.5;
    // on a tall phone screen the stats panel covers the bottom half, so aim low to lift the room into the top half
    const tall = camera.aspect < 0.9 && !opts.fullView?.();
    camera.position.set(-1.5 + Math.sin(a) * 4.2, (tall ? 4.4 : 3.0) + Math.sin(t * 0.3) * 0.15, (tall ? 10.6 : 7.4) + Math.cos(a) * 1.2);
    camera.lookAt(0.6, tall ? -2.6 : 1.25, -1.2);
    void me;
  };
}

// ------------------------------------------------------------------ life cutscenes

const woodFloor = (base = '#8a5f3c') => (g, w, h) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 26) { g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, y, w, 2); for (let x = ((y / 26) % 2) * 90; x < w; x += 180) g.fillRect(x, y, 2, 26); g.fillStyle = `rgba(255,255,255,${0.02 + ((y / 26) % 3) * 0.015})`; g.fillRect(0, y + 2, w, 24); }
};
const carpet = (base) => (g, w, h) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 6000; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.04)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  g.strokeStyle = 'rgba(255,215,120,0.35)'; g.lineWidth = 3;
  for (let x = 60; x < w; x += 120) for (let y = 60; y < h; y += 120) { g.beginPath(); g.moveTo(x, y - 22); g.lineTo(x + 22, y); g.lineTo(x, y + 22); g.lineTo(x - 22, y); g.closePath(); g.stroke(); }
};
function roundTable(scene, x, z, r = 0.95) {
  const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.06, 28), M('#f5f3ee', 0.8)); top.position.set(x, 0.76, z); top.castShadow = true; top.receiveShadow = true; scene.add(top);
  const cloth = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.01, r + 0.12, 0.5, 28, 1, true), M('#efece6', 0.9)); cloth.position.set(x, 0.5, z); scene.add(cloth);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.25, 0.75, 12), M('#3a3f46', 0.5, 0.5)); stem.position.set(x, 0.375, z); scene.add(stem);
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.14, 8), M('#fff7e0', 0.5, 0, '#ffcf70')); candle.position.set(x, 0.86, z); scene.add(candle);
}
function chair(scene, x, z, yaw, col = '#5a3b28') {
  const g = new THREE.Group();
  rb(g, 0.48, 0.07, 0.48, M(col, 0.7), 0, 0.43, 0, 0.03); rb(g, 0.48, 0.6, 0.06, M(col, 0.7), 0, 0.45, 0.22, 0.03);
  for (const [dx, dz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) rb(g, 0.05, 0.43, 0.05, M(shade(col, -0.1), 0.7), dx, 0, dz, 0.01);
  g.position.set(x, 0, z); g.rotation.y = yaw; scene.add(g);
  return g;
}
const gala = (seed, extra = {}) => ({ ...randomLook(seed, extra), outfit: 'gala', suit: ['#16181f', '#1d2a44', '#3b3f48', '#5a1e2a', '#2f4a3a'][Math.abs(String(seed).length * 7 + String(seed).charCodeAt(0)) % 5] });

function trophy() {
  const g = new THREE.Group();
  const gold = M('#f2c12e', 0.25, 0.9);
  rb(g, 0.36, 0.14, 0.36, M('#2a1f16', 0.5), 0, 0, 0, 0.03);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 0.26, 12), gold); stem.position.y = 0.27; g.add(stem);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.09, 0.3, 20), gold); cup.position.y = 0.55; g.add(cup);
  for (const sd of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 8, 16, Math.PI), gold); h.position.set(sd * 0.21, 0.56, 0); h.rotation.z = -sd * Math.PI / 2; g.add(h); }
  return g;
}

/** Awards banquet. opts: { look, name, awards: [strings], colors, year } */
export function banquetScene(ctx, opts) {
  const { scene, camera } = ctx;
  room(scene, { w: 18, d: 12, h: 4.4, floorDraw: carpet('#5a1f2a'), floorRough: 0.95, wall: '#2a2530', band: '#d4af37', light: '#ffe9c4', lightK: 0.9 });
  scene.background = new THREE.Color('#0d0b10');
  // stage, curtain, banner, podium
  rb(scene, 10, 0.4, 3.2, M('#3a2a20', 0.6), 0, 0, -4.2, 0.04);
  for (let i = 0; i < 12; i++) rb(scene, 0.8, 4, 0.2, M(i % 2 ? '#7a1626' : '#8f1c2e', 0.9), -4.6 + i * 0.84, 0.4, -5.85, 0.08);
  const ban = textPlane(`AWARDS BANQUET ${opts.year ?? ''}`.trim(), { w: 7, h: 0.8, bg: '#16181f', fg: '#f2c12e' }); ban.position.set(0, 3.6, -5.6); scene.add(ban);
  rb(scene, 0.8, 1.1, 0.5, M('#2b2f36', 0.5), 1.4, 0.4, -3.6, 0.05);
  const spot = new THREE.SpotLight('#fff2cf', 60, 14, 0.5, 0.5); spot.position.set(0, 4.2, -0.5); spot.target.position.set(0.3, 1.2, -3.8); scene.add(spot, spot.target);
  // tables with guests
  const guests = [];
  [[-4.6, 0.6], [0, 1.8], [4.6, 0.6], [-2.6, 3.6], [2.6, 3.6]].forEach(([x, z], ti) => {
    roundTable(scene, x, z);
    for (let k = 0; k < 3; k++) {
      const a = 0.6 + k * 1.0 + (ti % 2) * 0.4;
      const gx = x + Math.cos(a) * 1.45; const gz = z + Math.sin(a) * 1.45;
      chair(scene, gx, gz, Math.atan2(gx - x, gz - z));
      const p = makePerson(gala(`g${ti}${k}`, { gender: (ti + k) % 2 ? 'f' : 'm' }));
      seat(shadows(p), gx, gz, 0.5, -4); scene.add(p); guests.push(p);
    }
  });
  const host = makePerson(gala('host')); stand(shadows(host), 1.4, -3.0, 0, 5); host.position.y = 0.4; scene.add(host);
  const me = makePerson({ ...opts.look, outfit: 'gala' }); shadows(me); me.position.set(-6.5, 0.4, -3.9); scene.add(me);
  const tr = trophy(); tr.position.set(1.4, 1.52, -3.6); scene.add(tr);
  const list = (opts.awards ?? []).slice(0, 3).join(' · ');
  ctx.caption('Awards Banquet', `${opts.name ?? ''}${list ? ` · ${list}` : ''}`);
  let cheered = false;
  return (dt, t) => {
    // walk across the stage to the podium, take the trophy, turn to the room
    const k = ease(Math.min(1, t / 3.2));
    const x = lerp(-6.5, 0.3, k);
    if (k < 1) { me.position.x = x; faceToward(me, x + 1, -3.9); animateRun(me, dt, 2.2); }
    else {
      faceToward(me, 0.3, 6);
      const lift = ease(Math.min(1, (t - 3.4) / 1.0));
      tr.position.set(lerp(1.4, 0.3, lift), lerp(1.52, 2.55, lift), lerp(-3.6, -3.75, lift));
      tr.rotation.y = t * 1.2;
      if (!cheered && t > 3.6) { cheered = true; celebrate(me, 'point'); guests.forEach((g, i) => setTimeout(() => { setPose(g, null); celebrate(g, 'pump'); }, i * 70)); celebrate(host, 'pump'); }
    }
    const a = -0.5 + t * 0.09;
    camera.position.set(Math.sin(a) * 7.5, 2.6 + t * 0.05, 6.4 - t * 0.25);
    camera.lookAt(lerp(-2, 0.3, k), 1.6, -3.2);
    return t < 7.6;
  };
}

/** Date night. opts: { look, partnerLook, partnerName, venue } */
export function dateScene(ctx, opts) {
  const { scene, camera } = ctx;
  room(scene, { w: 13, d: 9, h: 3.6, floorDraw: woodFloor('#6e4a30'), wall: '#3b2b2b', band: '#8a5a3b', light: '#ffd9a8', lightK: 0.8 });
  scene.background = new THREE.Color('#120d0d');
  for (const [x, z] of [[-4, -2.4], [4, -2.2], [-4.2, 2.2]]) { roundTable(scene, x, z, 0.8); chair(scene, x - 1.2, z, -Math.PI / 2); chair(scene, x + 1.2, z, Math.PI / 2); }
  roundTable(scene, 0, 0.4, 0.85);
  chair(scene, -1.25, 0.4, -Math.PI / 2); chair(scene, 1.25, 0.4, Math.PI / 2);
  for (const sd of [-1, 1]) { rb(scene, 0.34, 0.03, 0.34, M('#ffffff', 0.4), sd * 0.4, 0.79, 0.4, 0.01); rb(scene, 0.07, 0.2, 0.07, M('#c8e0f0', 0.1, 0.3), sd * 0.25, 0.79, 0.15, 0.02); }
  const glow = new THREE.PointLight('#ffb760', 14, 6); glow.position.set(0, 1.25, 0.4); scene.add(glow);
  // window with city lights, wall sconces, plants
  const win = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.7), new THREE.MeshBasicMaterial({ toneMapped: false, map: canvasTex(512, 200, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#16213a'); gr.addColorStop(1, '#3a2a4a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { const bw = 14 + Math.random() * 26; const bh = 30 + Math.random() * 110; const x = Math.random() * w; g.fillStyle = '#0c1220'; g.fillRect(x, h - bh, bw, bh); g.fillStyle = '#ffd98a'; for (let k = 0; k < 8; k++) g.fillRect(x + 3 + Math.random() * (bw - 6), h - bh + 4 + Math.random() * (bh - 8), 2, 3); }
  }) }));
  win.position.set(0, 2.1, -4.48); scene.add(win);
  for (const x of [-5.6, 5.6]) { const p = makeProp('plant'); p.position.set(x, 0, -3.6); scene.add(p); }
  const me = makePerson({ ...opts.look, outfit: 'gala' }); seat(shadows(me), -1.25, 0.4, 1.25, 0.4); scene.add(me);
  const partner = makePerson({ ...(opts.partnerLook ?? randomLook('partner', { gender: 'f' })), outfit: 'gala', suit: '#7a1f3a' }); seat(shadows(partner), 1.25, 0.4, -1.25, 0.4); scene.add(partner);
  const waiter = makePerson({ ...randomLook('waiter'), outfit: 'gala', suit: '#16181f' }); shadows(waiter); waiter.position.set(-6, 0, 2.6); scene.add(waiter);
  ctx.caption(`Date night with ${opts.partnerName ?? 'your partner'}`, opts.venue ?? '');
  let laughed = false;
  return (dt, t) => {
    const wx = -6 + t * 1.5;
    waiter.position.x = wx; faceToward(waiter, wx + 1, 2.6); animateRun(waiter, dt, 1.5);
    glow.intensity = 14 + Math.sin(t * 9) * 1.5;
    if (!laughed && t > 2.6) { laughed = true; setPose(partner, null); celebrate(partner, 'pump'); setTimeout(() => setPose(partner, 'sit'), 1400); }
    const k = ease(Math.min(1, t / 6));
    camera.position.set(lerp(-3.6, 2.2, k), lerp(2.3, 1.75, k), lerp(5.6, 4.0, k));
    camera.lookAt(0, 1.15, 0.3);
    return t < 6.4;
  };
}

/** Hanging out with friends. opts: { look, friendLooks: [], title, sub } */
export function hangoutScene(ctx, opts) {
  const { scene, camera } = ctx;
  room(scene, { w: 13, d: 9, h: 3.5, floorDraw: carpet('#2c3440'), wall: '#3a4250', band: '#e76f51', light: '#f2f4ff' });
  scene.background = new THREE.Color('#101318');
  // arcade cabinets along the back wall, neon sign, couch + pizza
  const cols = ['#e63946', '#3a86ff', '#ffbe0b', '#8338ec', '#06d6a0'];
  for (let i = 0; i < 5; i++) {
    const x = -4.8 + i * 2.4;
    rb(scene, 1.0, 2.0, 0.9, M('#1b1e24', 0.5), x, 0, -3.9, 0.05);
    rb(scene, 0.8, 0.6, 0.05, M(cols[i], 0.3, 0, cols[i]), x, 1.1, -3.43, 0.02);
    rb(scene, 0.9, 0.3, 0.06, M(cols[(i + 2) % 5], 0.4, 0, cols[(i + 2) % 5]), x, 1.75, -3.43, 0.02);
    rb(scene, 0.9, 0.1, 0.4, M('#2b2f36', 0.5), x, 0.9, -3.3, 0.02);
  }
  const neon = textPlane('GAME ON', { w: 3.6, h: 0.7, fg: '#ff4fa3' }); neon.position.set(0, 2.95, -4.45); scene.add(neon);
  const couch = makeProp('couch', { w: 2, color: '#b5523b' }); couch.position.set(0.3, 0, 1.2); scene.add(couch);
  rb(scene, 0.7, 0.06, 0.7, M('#d9b38c', 0.8), 0.3, 0.37, 2.35, 0.02); rb(scene, 0.5, 0.02, 0.5, M('#e8b04a', 0.8), 0.3, 0.43, 2.35, 0.01);
  const friends = (opts.friendLooks ?? []).slice(0, 3);
  while (friends.length < 3) friends.push(randomLook(`friend${friends.length}`));
  const f1 = makePerson({ ...friends[0], outfit: 'casual' }); seat(shadows(f1), -0.7, 1.25, 0, 6); scene.add(f1);
  const f2 = makePerson({ ...friends[1], outfit: 'casual' }); seat(shadows(f2), 1.3, 1.25, 0, 6); scene.add(f2);
  const f3 = makePerson({ ...friends[2], outfit: 'casual' }); stand(shadows(f3), -3.6, -2.6, -3.6, -4); scene.add(f3);
  const me = makePerson({ ...opts.look, outfit: 'casual' }); stand(shadows(me), 0.3, 1.25, 0, 6); setPose(me, 'sit'); scene.add(me);
  ctx.caption(opts.title ?? 'Hanging out', opts.sub ?? 'Good friends, bad jokes.');
  let step = 0;
  return (dt, t) => {
    if (step === 0 && t > 1.6) { step = 1; setPose(f1, null); celebrate(f1, 'dance'); }
    if (step === 1 && t > 3.0) { step = 2; setPose(me, null); celebrate(me, 'pump'); celebrate(f3, 'flex'); }
    if (step === 2 && t > 4.4) { step = 3; setPose(f2, null); celebrate(f2, 'pump'); }
    const a = 0.7 - t * 0.16;
    camera.position.set(Math.sin(a) * 6.4, 2.4, 2.2 + Math.cos(a) * 4.6);
    camera.lookAt(0.2, 1.1, 0.4);
    return t < 6.2;
  };
}

/** Video games on the couch. opts: { look, friendLook } */
export function gamingScene(ctx, opts) {
  const { scene, camera } = ctx;
  room(scene, { w: 9, d: 8, h: 3.2, floorDraw: woodFloor('#9a6c46'), wall: '#cfd6dd', band: '#5b7ca0', light: '#dfe8ff', lightK: 0.75 });
  scene.background = new THREE.Color('#0f1216');
  // TV wall
  rb(scene, 3.4, 0.5, 0.5, M('#3a2f28', 0.55), 0, 0, -3.5, 0.04);
  rb(scene, 3.3, 1.9, 0.07, M('#111316', 0.4), 0, 0.85, -3.75, 0.02);
  const scr = canvasTex(256, 144, (g) => { g.fillStyle = '#0a2a12'; g.fillRect(0, 0, 256, 144); });
  const screenMat = new THREE.MeshBasicMaterial({ map: scr, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.15, 1.75), screenMat); screen.position.set(0, 1.8, -3.7); scene.add(screen);
  const g2 = scr.image.getContext('2d');
  const tvGlow = new THREE.PointLight('#7fb6ff', 10, 7); tvGlow.position.set(0, 1.6, -2.6); scene.add(tvGlow);
  rb(scene, 2.6, 0.02, 1.8, M('#5b7ca0', 0.95), 0, 0, -0.6, 0.01); // rug
  const couch = makeProp('couch', { w: 1.6, color: '#4a5563' }); couch.rotation.y = Math.PI; couch.position.set(0, 0, 1.3); scene.add(couch);
  rb(scene, 0.4, 0.12, 0.3, M('#111', 0.4), 0, 0.5, -3.3, 0.03); // console
  const me = makePerson({ ...opts.look, outfit: 'casual' }); seat(shadows(me), -0.5, 1.1, -0.5, -4); scene.add(me);
  const pal = makePerson({ ...(opts.friendLook ?? randomLook('gamer')), outfit: 'casual' }); seat(shadows(pal), 0.75, 1.1, 0.75, -4); scene.add(pal);
  ctx.caption('Game night', 'Just one more game...');
  let won = false; let drawT = 0;
  return (dt, t) => {
    drawT -= dt;
    if (drawT <= 0) { // a little football game on the TV
      drawT = 0.08;
      g2.fillStyle = '#1f6a2c'; g2.fillRect(0, 0, 256, 144);
      g2.fillStyle = 'rgba(255,255,255,0.7)'; for (let x = 16 - ((t * 40) % 32); x < 256; x += 32) g2.fillRect(x, 0, 2, 144);
      for (let i = 0; i < 10; i++) { g2.fillStyle = i < 5 ? '#f4f4f4' : '#d33a2c'; g2.beginPath(); g2.arc(128 + Math.sin(t * 2 + i) * 60 + (i < 5 ? -20 : 20), 72 + Math.cos(t * 1.7 + i * 2) * 44, 5, 0, 7); g2.fill(); }
      g2.fillStyle = '#111'; g2.fillRect(0, 0, 256, 16); g2.fillStyle = '#ffd43b'; g2.font = '800 11px Inter, sans-serif'; g2.fillText(`P1 ${14 + (t > 4 ? 7 : 0)}   P2 17   Q4 0:${String(Math.max(0, 9 - Math.floor(t))).padStart(2, '0')}`, 8, 12);
      if (t > 4 && t < 5.6) { g2.fillStyle = '#ffd43b'; g2.font = '800 30px Inter, sans-serif'; g2.fillText('TOUCHDOWN!', 30, 84); }
      scr.needsUpdate = true;
    }
    tvGlow.intensity = 9 + Math.sin(t * 13) * 2;
    if (!won && t > 4.1) { won = true; setPose(me, null); celebrate(me, 'pump'); }
    const k = ease(Math.min(1, t / 6));
    camera.position.set(lerp(2.8, 2.2, k), lerp(2.9, 2.7, k), lerp(4.0, 3.6, k));
    camera.lookAt(0, 1.05, -1.0);
    return t < 6.4;
  };
}
