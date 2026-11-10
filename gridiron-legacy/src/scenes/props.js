// Furniture and street objects for the walkable places. Smooth rounded shapes and real materials.
// Every prop is a Group sitting on the ground, centered on its footprint, with its "back" toward -z
// (the world engine turns it so the back faces the nearest wall).
//   makeProp(type, { w, d, color, accent, label, seed }) — w/d = footprint in tiles (1 tile = 2 units)
import * as THREE from 'three';

const T = 2; // tile size

// ---- rounded box geometry (same idea as the character builder)
const geoCache = new Map();
export function roundedBox(w, h, d, r = Math.min(w, h, d) * 0.18, seg = 2) {
  const key = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}|${r.toFixed(3)}|${seg}`;
  if (geoCache.has(key)) return geoCache.get(key);
  const geo = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  r = Math.min(r, w / 2, h / 2, d / 2);
  const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
  const p = new THREE.Vector3(); const inner = new THREE.Vector3(); const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    inner.set(Math.max(-hx, Math.min(hx, p.x)), Math.max(-hy, Math.min(hy, p.y)), Math.max(-hz, Math.min(hz, p.z)));
    n.subVectors(p, inner);
    if (n.lengthSq() < 1e-12) n.fromBufferAttribute(nor, i); else n.normalize();
    pos.setXYZ(i, inner.x + n.x * r, inner.y + n.y * r, inner.z + n.z * r);
    nor.setXYZ(i, n.x, n.y, n.z);
  }
  geoCache.set(key, geo);
  return geo;
}

const mats = new Map();
export function M(color, rough = 0.7, metal = 0, emissive = null) {
  const key = `${color}|${rough}|${metal}|${emissive}`;
  if (!mats.has(key)) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    if (emissive) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = 0.9; }
    mats.set(key, m);
  }
  return mats.get(key);
}
const WOOD = M('#8a5a3b', 0.6); const WOOD_L = M('#b88a5e', 0.6); const METAL = M('#9aa3ad', 0.35, 0.7); const DARK = M('#22262c', 0.5, 0.2);
const WHITE = M('#f1f1ee', 0.55); const BLACK = M('#15171b', 0.4, 0.1); const STEEL = M('#c9ced4', 0.25, 0.85); const GLASS = M('#9cc7e6', 0.05, 0.6);

/** Mesh helper: rounded box with its bottom at y. */
function rb(g, w, h, d, mat, x = 0, y = 0, z = 0, r) {
  const m = new THREE.Mesh(roundedBox(w, h, d, r ?? Math.min(w, h, d) * 0.2), mat);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true; m.receiveShadow = true;
  g.add(m);
  return m;
}
function cyl(g, rt, rb2, h, mat, x = 0, y = 0, z = 0, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb2, h, seg), mat);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true; m.receiveShadow = true;
  g.add(m);
  return m;
}
function ball(g, r, mat, x, y, z, detail = 1) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  g.add(m);
  return m;
}
const hash = (n) => { const v = Math.sin(n * 127.1) * 43758.5453; return v - Math.floor(v); };

/** A canvas label texture (shop signs, screens, posters). */
function labelTex(text, bg, fg = '#ffffff', w = 512, h = 128) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = h * 0.48;
  g.font = `800 ${size}px Inter, "Arial Black", sans-serif`;
  while (g.measureText(text).width > w * 0.9 && size > 10) { size -= 2; g.font = `800 ${size}px Inter, "Arial Black", sans-serif`; }
  g.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function screenTex(seed = 0) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 144;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 144); gr.addColorStop(0, '#2a6fbf'); gr.addColorStop(1, '#0f2a4a');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 144);
  g.fillStyle = '#3f9a3c'; g.fillRect(0, 80, 256, 64); // a football field on screen
  g.fillStyle = 'rgba(255,255,255,0.8)'; for (let x = 10; x < 256; x += 30) g.fillRect(x, 80, 2, 64);
  for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? '#e8e8e8' : '#c0392b'; g.beginPath(); g.arc(40 + ((i * 53 + seed * 17) % 180), 95 + (i * 13) % 40, 4, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Build a prop. opts: { w, d (tiles), color, accent, label, seed } */
export function makeProp(type, opts = {}) {
  const g = new THREE.Group();
  const W = (opts.w ?? 1) * T;
  const D = (opts.d ?? 1) * T;
  const acc = opts.accent ?? '#5b7ca0';
  const seed = opts.seed ?? 1;
  switch (type) {
    case 'bed': {
      const bw = Math.min(W - 0.3, 2.2); const bl = 2.3;
      rb(g, bw + 0.1, 0.35, bl, WOOD, 0, 0, 0.1);
      rb(g, bw, 0.28, bl - 0.1, WHITE, 0, 0.33, 0.12, 0.1);
      rb(g, bw + 0.04, 0.16, bl * 0.62, M(acc, 0.85), 0, 0.55, 0.45, 0.07); // duvet
      rb(g, bw * 0.4, 0.14, 0.38, WHITE, -bw * 0.24, 0.6, -0.72, 0.07);
      rb(g, bw * 0.4, 0.14, 0.38, WHITE, bw * 0.24, 0.6, -0.72, 0.07);
      rb(g, bw + 0.15, 1.05, 0.12, WOOD, 0, 0, -1.02); // headboard
      rb(g, 0.45, 0.5, 0.42, WOOD_L, bw / 2 + 0.38, 0, -0.85); // nightstand
      cyl(g, 0.07, 0.1, 0.32, M('#e8d9b5', 0.5), bw / 2 + 0.38, 0.5, -0.85); // lamp
      ball(g, 0.14, M('#fff3d6', 0.6, 0, '#ffdca0'), bw / 2 + 0.38, 0.92, -0.85, 1);
      break;
    }
    case 'bunk': {
      for (const y of [0, 1.1]) { rb(g, 1.2, 0.18, 2.1, WHITE, 0, y + 0.3, 0.1, 0.06); rb(g, 1.22, 0.1, 2.12, M('#6b7f99', 0.8), 0, y + 0.46, 0.25, 0.04); }
      for (const [x, z] of [[-0.62, -0.95], [0.62, -0.95], [-0.62, 1.15], [0.62, 1.15]]) cyl(g, 0.04, 0.04, 2.1, METAL, x, 0, z, 8);
      for (let y = 0.4; y < 1.9; y += 0.35) rb(g, 0.04, 0.04, 0.4, METAL, 0.66, y, 0.7);
      break;
    }
    case 'desk': {
      rb(g, 1.5, 0.06, 0.75, WOOD_L, 0, 0.74, -0.35);
      for (const x of [-0.68, 0.68]) rb(g, 0.06, 0.74, 0.7, WOOD, x, 0, -0.35, 0.02);
      rb(g, 0.62, 0.38, 0.04, BLACK, 0, 0.82, -0.6, 0.02);
      const scr = rb(g, 0.58, 0.33, 0.01, M('#7fb6ff', 0.3, 0, '#3f7fd8'), 0, 0.845, -0.575, 0.005); scr.castShadow = false;
      rb(g, 0.45, 0.02, 0.15, DARK, 0, 0.8, -0.25, 0.01);
      // chair
      rb(g, 0.5, 0.08, 0.5, M('#2b2f36', 0.7), 0, 0.46, 0.3, 0.04);
      rb(g, 0.5, 0.55, 0.07, M('#2b2f36', 0.7), 0, 0.5, 0.56, 0.04);
      cyl(g, 0.03, 0.03, 0.46, METAL, 0, 0, 0.3, 8);
      break;
    }
    case 'bookshelf': {
      rb(g, 1.5, 2.0, 0.4, WOOD, 0, 0, -0.75, 0.03);
      const cols = ['#c0392b', '#2471a3', '#d4ac0d', '#229954', '#6c3483', '#ca6f1e', '#f0f3f4'];
      for (let s = 0; s < 4; s++) {
        rb(g, 1.4, 0.04, 0.36, WOOD_L, 0, 0.12 + s * 0.46, -0.72, 0.01);
        let x = -0.62;
        while (x < 0.6) { const bw = 0.06 + hash(seed + x * 13 + s) * 0.06; const bh = 0.28 + hash(x * 7 + s) * 0.1; rb(g, bw, bh, 0.26, M(cols[Math.floor(hash(x * 3 + s * 5 + seed) * 7)], 0.8), x + bw / 2, 0.16 + s * 0.46, -0.72, 0.01); x += bw + 0.01; }
      }
      break;
    }
    case 'counter': {
      rb(g, T - 0.04, 0.88, 0.7, WHITE, 0, 0, -0.62, 0.03);
      rb(g, T, 0.05, 0.76, M('#3b3f46', 0.25, 0.1), 0, 0.88, -0.6, 0.02);
      rb(g, 0.02, 0.6, 0.01, M('#c8c8c2', 0.5), 0, 0.15, -0.265, 0.005);
      if (hash(seed) < 0.4) { rb(g, 0.6, 0.02, 0.45, STEEL, 0, 0.92, -0.62, 0.02); cyl(g, 0.02, 0.02, 0.3, STEEL, 0, 0.93, -0.88, 8); } // sink
      else if (hash(seed) < 0.7) { rb(g, 0.7, 0.02, 0.55, BLACK, 0, 0.93, -0.6, 0.02); for (const [x, z] of [[-0.17, -0.45], [0.17, -0.45], [-0.17, -0.75], [0.17, -0.75]]) cyl(g, 0.1, 0.1, 0.005, M('#444', 0.5), x, 0.955, z); }
      else { rb(g, 0.4, 0.25, 0.3, M('#a8afb7', 0.4, 0.5), 0.3, 0.93, -0.7, 0.04); }
      break;
    }
    case 'fridge': rb(g, 0.95, 1.95, 0.8, STEEL, 0, 0, -0.55, 0.06); rb(g, 0.02, 0.5, 0.04, DARK, 0.3, 1.2, -0.14, 0.01); rb(g, 0.02, 0.5, 0.04, DARK, 0.3, 0.45, -0.14, 0.01); break;
    case 'minifridge': rb(g, 0.6, 0.85, 0.6, M('#e4e6e8', 0.4, 0.2), 0, 0, -0.6, 0.05); rb(g, 0.02, 0.3, 0.03, DARK, 0.2, 0.4, -0.29, 0.01); break;
    case 'island': {
      rb(g, W - 0.4, 0.9, 1.1, M('#2f3b45', 0.5), 0, 0, 0, 0.04);
      rb(g, W - 0.25, 0.06, 1.25, M('#e9e6df', 0.15, 0.05), 0, 0.9, 0, 0.03);
      for (let x = -W / 2 + 0.6; x < W / 2 - 0.3; x += 0.8) { cyl(g, 0.18, 0.18, 0.06, M('#1e2228', 0.6), x, 0.72, 0.85); cyl(g, 0.025, 0.025, 0.72, STEEL, x, 0, 0.85, 8); }
      break;
    }
    case 'table': {
      const tw = Math.max(1.4, W - 0.6);
      rb(g, tw, 0.07, 1.1, WOOD_L, 0, 0.72, 0, 0.03);
      for (const [x, z] of [[-tw / 2 + 0.12, -0.42], [tw / 2 - 0.12, -0.42], [-tw / 2 + 0.12, 0.42], [tw / 2 - 0.12, 0.42]]) cyl(g, 0.04, 0.035, 0.72, WOOD, x, 0, z, 8);
      for (let x = -tw / 2 + 0.4; x < tw / 2 - 0.2; x += 0.8) for (const z of [-0.78, 0.78]) { rb(g, 0.45, 0.06, 0.42, WOOD, x, 0.44, z, 0.03); rb(g, 0.45, 0.5, 0.05, WOOD, x, 0.47, z + Math.sign(z) * 0.2, 0.02); }
      break;
    }
    case 'tv': {
      const tw = Math.min(W - 0.3, 3.2);
      rb(g, tw * 0.9, 0.45, 0.45, M('#3a2f28', 0.55), 0, 0, -0.68, 0.04);
      rb(g, tw, tw * 0.56, 0.06, BLACK, 0, 0.95, -0.9, 0.02);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(tw * 0.95, tw * 0.52), new THREE.MeshBasicMaterial({ map: screenTex(seed), toneMapped: false }));
      s.position.set(0, 0.95 + tw * 0.28, -0.865); g.add(s);
      rb(g, tw * 0.55, 0.06, 0.1, DARK, 0, 0.47, -0.62, 0.02); // soundbar
      break;
    }
    case 'screen': { // film room: wall screen + rows of seats
      const tw = W - 0.4;
      rb(g, tw, tw * 0.45, 0.06, BLACK, 0, 0.9, -0.92, 0.02);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(tw * 0.96, tw * 0.42), new THREE.MeshBasicMaterial({ map: screenTex(seed + 3), toneMapped: false }));
      s.position.set(0, 0.9 + tw * 0.225, -0.885); g.add(s);
      for (let x = -tw / 2 + 0.5; x < tw / 2 - 0.2; x += 0.75) { rb(g, 0.55, 0.42, 0.55, M('#26313d', 0.8), x, 0, 0.35, 0.08); rb(g, 0.55, 0.5, 0.12, M('#26313d', 0.8), x, 0.38, 0.62, 0.05); }
      break;
    }
    case 'couch': {
      const cw = Math.min(W - 0.2, 3.6);
      const cm = M(opts.color ?? acc, 0.9);
      rb(g, cw, 0.42, 0.95, cm, 0, 0, 0, 0.12);
      rb(g, cw, 0.6, 0.28, cm, 0, 0.3, -0.38, 0.12);
      for (const x of [-cw / 2 + 0.12, cw / 2 - 0.12]) rb(g, 0.24, 0.62, 0.95, cm, x, 0, 0, 0.1);
      const n = Math.max(2, Math.round(cw / 0.9));
      for (let i = 0; i < n; i++) rb(g, (cw - 0.5) / n - 0.04, 0.14, 0.72, M(opts.color ?? acc, 0.95), -cw / 2 + 0.25 + (i + 0.5) * ((cw - 0.5) / n), 0.42, 0.06, 0.06);
      rb(g, cw * 0.5, 0.36, 0.6, WOOD_L, 0, 0, 1.15, 0.05); // coffee table
      break;
    }
    case 'mat': rb(g, 0.75, 0.02, 1.7, M(opts.color ?? '#7b2cbf', 0.9), 0, 0, 0, 0.01); cyl(g, 0.08, 0.08, 0.7, M('#f5f5f5', 0.9), 0.55, 0.08, -0.6, 10).rotation.z = Math.PI / 2; break;
    case 'rack': case 'bench_press': {
      if (type === 'rack') { for (const x of [-0.75, 0.75]) for (const z of [-0.45, 0.45]) rb(g, 0.08, 2.1, 0.08, DARK, x, 0, z, 0.02); rb(g, 1.6, 0.08, 0.08, DARK, 0, 2.05, -0.45, 0.02); rb(g, 1.6, 0.08, 0.08, DARK, 0, 2.05, 0.45, 0.02); }
      rb(g, 0.32, 0.45, 1.2, M('#1b1d22', 0.7), 0, 0, 0.1, 0.06); rb(g, 0.34, 0.06, 1.2, M('#b0222c', 0.8), 0, 0.45, 0.1, 0.03);
      const bar = cyl(g, 0.025, 0.025, 2.0, STEEL, 0, 0, 0, 10); bar.rotation.z = Math.PI / 2; bar.position.set(0, 1.25, -0.1);
      for (const x of [-0.85, 0.85]) { const p = cyl(g, 0.22, 0.22, 0.06, BLACK, 0, 0, 0, 20); p.rotation.z = Math.PI / 2; p.position.set(x, 1.25, -0.1); }
      break;
    }
    case 'treadmill': rb(g, 0.85, 0.22, 1.8, DARK, 0, 0, 0.1, 0.06); rb(g, 0.65, 0.03, 1.5, BLACK, 0, 0.22, 0.15, 0.01); for (const x of [-0.38, 0.38]) rb(g, 0.06, 1.15, 0.08, METAL, x, 0, -0.75, 0.02); rb(g, 0.85, 0.3, 0.18, M('#2b2f36', 0.4, 0, '#2d6cdf'), 0, 1.1, -0.8, 0.04); break;
    case 'locker': {
      rb(g, T - 0.06, 2.0, 0.55, M('#3b5b7a', 0.45, 0.5), 0, 0, -0.68, 0.02);
      for (const x of [-0.48, 0, 0.48]) { rb(g, 0.02, 1.85, 0.01, M('#1f3247', 0.6), x + 0.24, 0.05, -0.4, 0.005); for (let y = 1.55; y < 1.85; y += 0.08) rb(g, 0.3, 0.02, 0.01, M('#1f3247', 0.6), x, y, -0.4, 0.005); }
      rb(g, T - 0.3, 0.08, 0.38, WOOD_L, 0, 0.42, 0.2, 0.02); for (const x of [-0.7, 0.7]) rb(g, 0.06, 0.42, 0.3, METAL, x, 0, 0.2, 0.02);
      break;
    }
    case 'trainertable': rb(g, 0.75, 0.08, 1.9, M('#3a5f8a', 0.5), 0, 0.72, 0, 0.04); for (const z of [-0.8, 0.8]) for (const x of [-0.3, 0.3]) cyl(g, 0.035, 0.035, 0.72, STEEL, x, 0, z, 8); rb(g, 0.6, 0.1, 0.3, WHITE, 0, 0.8, -0.75, 0.05); break;
    case 'coldtub': { cyl(g, 0.75, 0.7, 0.85, STEEL, 0, 0, 0, 24); const w = cyl(g, 0.68, 0.68, 0.02, M('#7fd0ff', 0.05, 0.1, '#2a8fd8'), 0, 0.78, 0, 24); w.castShadow = false; break; }
    case 'sled': rb(g, 0.9, 0.12, 1.1, M('#d32f2f', 0.5, 0.2), 0, 0, 0, 0.04); for (const x of [-0.3, 0.3]) rb(g, 0.08, 1.0, 0.08, STEEL, x, 0.1, -0.35, 0.02); rb(g, 0.6, 0.12, 0.3, M('#1a1a1a', 0.6), 0, 0.12, 0.2, 0.04); break;
    case 'podium': {
      rb(g, W - 0.3, 2.2, 0.08, M(acc, 0.6), 0, 0, -0.9, 0.02);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.6, 0.5), new THREE.MeshBasicMaterial({ map: labelTex('PRESS CONFERENCE', acc), toneMapped: false }));
      s.position.set(0, 1.6, -0.855); g.add(s);
      rb(g, 0.7, 1.1, 0.5, M('#2b2f36', 0.5), 0, 0, -0.3, 0.06);
      cyl(g, 0.015, 0.015, 0.35, BLACK, 0, 1.1, -0.42, 6); ball(g, 0.05, BLACK, 0, 1.47, -0.42, 1);
      break;
    }
    case 'vending': rb(g, 0.9, 1.9, 0.75, M('#b71c1c', 0.4, 0.2), 0, 0, -0.6, 0.05); rb(g, 0.55, 1.2, 0.02, M('#cfe8ff', 0.1, 0, '#6fb8ff'), -0.1, 0.55, -0.22, 0.02); break;
    case 'plant': {
      cyl(g, 0.28, 0.22, 0.45, M('#d9d4cc', 0.6), 0, 0, 0, 16);
      const lm = M('#3f8f4a', 0.85); const lm2 = M('#58a85f', 0.85);
      ball(g, 0.38, lm, 0, 0.8, 0, 1); ball(g, 0.26, lm2, 0.18, 1.08, 0.08, 1); ball(g, 0.24, lm, -0.16, 1.05, -0.1, 1);
      break;
    }
    case 'tree': {
      cyl(g, 0.16, 0.24, 1.6, M('#6b4a32', 0.9), 0, 0, 0, 10);
      const greens = ['#2f7d3a', '#3c8f45', '#4e9e4f', '#2a6e35'];
      for (let i = 0; i < 4; i++) ball(g, 0.75 + hash(seed + i) * 0.35, M(greens[(i + Math.floor(seed)) % 4], 0.85), (hash(seed * 3 + i) - 0.5) * 0.9, 2.0 + i * 0.32 + hash(i + seed) * 0.2, (hash(seed * 7 + i) - 0.5) * 0.9, 1);
      break;
    }
    case 'campus': { // brick academic building with columns and windows
      rb(g, T, 4.2, T, M('#9c4a3a', 0.85), 0, 0, -0.1, 0.02);
      for (let y = 0.6; y < 3.6; y += 1.2) { rb(g, 0.7, 0.8, 0.05, GLASS, -0.42, y, 0.92, 0.02); rb(g, 0.7, 0.8, 0.05, GLASS, 0.42, y, 0.92, 0.02); }
      rb(g, T + 0.05, 0.3, T + 0.05, M('#e8e1d4', 0.6), 0, 4.2, -0.1, 0.03);
      break;
    }
    case 'bench': rb(g, 1.7, 0.07, 0.5, WOOD_L, 0, 0.44, 0, 0.02); rb(g, 1.7, 0.4, 0.06, WOOD_L, 0, 0.55, -0.24, 0.02); for (const x of [-0.72, 0.72]) rb(g, 0.06, 0.48, 0.48, DARK, x, 0, -0.02, 0.02); break;
    case 'hoop': {
      cyl(g, 0.08, 0.1, 3.0, DARK, 0, 0, -0.7, 10);
      rb(g, 1.2, 0.75, 0.05, M('#f4f6f8', 0.3), 0, 2.75, -0.45, 0.02);
      rb(g, 0.45, 0.3, 0.06, M('#e74c3c', 0.5), 0, 2.85, -0.42, 0.01);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.02, 8, 24), M('#e8590c', 0.4, 0.4)); rim.rotation.x = Math.PI / 2; rim.position.set(0, 2.88, -0.15); g.add(rim);
      break;
    }
    case 'fountain': { const r = Math.min(W, D) / 2 - 0.3; cyl(g, r, r + 0.1, 0.5, M('#c7c3bb', 0.7), 0, 0, 0, 32); const w = cyl(g, r - 0.15, r - 0.15, 0.02, M('#6fb7e8', 0.05, 0.2), 0, 0.46, 0, 32); w.castShadow = false; cyl(g, 0.22, 0.32, 1.0, M('#d8d4cc', 0.6), 0, 0.4, 0, 16); cyl(g, 0.6, 0.3, 0.15, M('#d8d4cc', 0.6), 0, 1.35, 0, 20); break; }
    case 'truck': case 'cart': {
      const big = type === 'truck';
      rb(g, big ? 1.9 : 1.1, big ? 1.6 : 0.95, big ? 1.4 : 0.7, M(big ? '#f2c14e' : '#f7f1e3', 0.5, 0.1), 0, 0.35, 0, 0.12);
      rb(g, big ? 1.95 : 1.15, 0.12, big ? 1.5 : 0.8, M(big ? '#e63946' : '#e85d75', 0.6), 0, big ? 1.95 : 1.4, 0, 0.04);
      if (big) rb(g, 1.2, 0.55, 0.04, M('#1a1a1a', 0.3), 0, 1.05, 0.7, 0.02);
      for (const x of (big ? [-0.6, 0.6] : [-0.35, 0.35])) { const wh = cyl(g, 0.25, 0.25, 0.15, BLACK, x, 0, big ? 0.62 : 0.3, 16); wh.rotation.x = Math.PI / 2; wh.position.y = 0.25; }
      break;
    }
    case 'booth': rb(g, 1.7, 0.9, 0.75, WHITE, 0, 0, 0, 0.04); for (const [x, z] of [[-0.8, -0.35], [0.8, -0.35], [-0.8, 0.35], [0.8, 0.35]]) cyl(g, 0.03, 0.03, 2.1, METAL, x, 0, z, 8); rb(g, 1.9, 0.12, 1.0, M('#e76f51', 0.6), 0, 2.05, 0, 0.04); break;
    case 'sign': cyl(g, 0.05, 0.05, 1.3, DARK, 0, 0, 0, 8); rb(g, 0.9, 0.5, 0.05, M('#2e7d32', 0.5), 0, 1.15, 0, 0.02); break;
    case 'lamppost': { cyl(g, 0.06, 0.09, 3.2, M('#2b2f36', 0.4, 0.5), 0, 0, 0, 10); const l = ball(g, 0.2, M('#fff7e0', 0.3, 0, '#ffe7a8'), 0, 3.3, 0, 1); l.castShadow = false; break; }
    case 'shopfront': {
      const fw = W - 0.06;
      const col = opts.color ?? '#3a86ff';
      const wallC = ['#d9cbb5', '#c9b8a0', '#b9c2c9', '#e3d9c6', '#a99c8c'][Math.floor(hash(seed) * 5)];
      rb(g, fw, 4.6, 1.2, M(wallC, 0.85), 0, 0, -0.45, 0.02);
      rb(g, fw * 0.62, 1.7, 0.06, GLASS, -fw * 0.12, 0.35, 0.18, 0.02); // window
      rb(g, 0.7, 2.0, 0.06, M('#3d2b1f', 0.5), fw * 0.33, 0, 0.18, 0.02); // door
      const aw = rb(g, fw * 0.95, 0.12, 0.9, M(col, 0.7), 0, 2.4, 0.55, 0.04); aw.rotation.x = 0.25;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(fw * 0.85, 0.55), new THREE.MeshBasicMaterial({ map: labelTex((opts.label ?? '').split(':')[0].toUpperCase(), col), toneMapped: false }));
      sign.position.set(0, 3.15, 0.17); g.add(sign);
      for (let x = -fw / 2 + 0.5; x < fw / 2 - 0.3; x += 0.9) rb(g, 0.5, 0.6, 0.04, GLASS, x, 3.7, 0.16, 0.01); // upstairs windows
      break;
    }
    case 'facade': { const h = opts.h ?? 4.6; rb(g, T, h, 1.2, M(opts.color ?? '#bfb6a8', 0.85), 0, 0, -0.45, 0.02); for (let y = 1; y < h - 0.6; y += 1.2) rb(g, 0.6, 0.65, 0.04, GLASS, 0, y, 0.16, 0.01); break; }
    case 'hedge': rb(g, T, 0.9, 0.7, M('#2f6e35', 0.9), 0, 0, 0, 0.3); break;
    case 'dog': {
      const c = M(opts.color ?? '#c68642', 0.85);
      rb(g, 0.85, 0.36, 0.36, c, 0, 0.3, 0, 0.16); rb(g, 0.36, 0.32, 0.32, c, 0.5, 0.55, 0, 0.14); rb(g, 0.2, 0.14, 0.2, c, 0.72, 0.56, 0, 0.06);
      for (const [x, z] of [[-0.3, -0.12], [-0.3, 0.12], [0.3, -0.12], [0.3, 0.12]]) rb(g, 0.1, 0.32, 0.1, c, x, 0, z, 0.04);
      rb(g, 0.28, 0.07, 0.07, c, -0.52, 0.55, 0, 0.03); ball(g, 0.04, BLACK, 0.83, 0.62, 0, 0); for (const z of [-0.1, 0.1]) rb(g, 0.08, 0.16, 0.04, M('#7a4a26', 0.9), 0.48, 0.82, z, 0.02);
      break;
    }
    default: break;
  }
  return g;
}
