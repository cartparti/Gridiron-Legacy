// Chunky voxel athletes with pixel-art faces, a jointed rig and smooth procedural animation.
//
// Every character is a small hierarchy of boxes (hips, legs with knees, spine, chest, arms with
// elbows, a big blocky head). Faces, hair, tattoos and jersey numbers are tiny canvas textures drawn
// pixel by pixel and shown with nearest-neighbour filtering, so they stay crisp and retro.
// Poses are computed each frame from a locomotion state (idle / run / sprint / backpedal) plus
// optional one-shot actions (throw, catch, juke, spin, stiff-arm, dive, tackle, fall, get up,
// celebrate ...) and blended smoothly.
//
// Looks (skin, hair, face, tattoos, gear, height/weight) come from src/data/looks.js.
import * as THREE from 'three';
import {
  SKIN_TONES, HAIR_COLORS, EYE_COLORS, VISOR_TINTS, MOUTHGUARD_COLORS, bodyScale, randomLook, normalizeLook, masculinize,
} from '../data/looks.js';
import { shade } from '../data/kits.js';

// ------------------------------------------------------------------ materials & textures

let gradient = null;
function toonGradient() {
  if (gradient) return gradient;
  const data = new Uint8Array([120, 120, 120, 255, 200, 200, 200, 255, 255, 255, 255, 255]);
  gradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  return gradient;
}
const matCache = new Map();
/** Shaded material for a flat color (name kept from the cel-shaded days). Realistic, slightly soft fabric/skin. */
export function toon(color, rough = 0.72) {
  const key = `${color}|${rough}`;
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 }));
  return matCache.get(key);
}
/** Shiny / metallic variants (helmets, facemasks, chains). */
export function shiny(color, { rough = 0.28, metal = 0 } = {}) {
  const key = `shiny|${color}|${rough}|${metal}`;
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }));
  return matCache.get(key);
}

const texCache = new Map();
/** Pixel texture: draw(g, w, h) on a tiny canvas; cached by key. Returns a toon material. */
// Textures are drawn on a small logical grid (w x h) and then rendered smooth:
//   crisp (default): drawn at TEX_SCALE x, so stripes and numbers have clean, sharp edges;
//   soft: drawn small then upscaled with smoothing (hair, skin, tattoos look organic, not blocky).
const TEX_SCALE = 6;
function pixMat(key, w, h, draw, { transparent = false, soft = false, rough = 0.72, metal = 0 } = {}) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = w * TEX_SCALE;
  c.height = h * TEX_SCALE;
  const g = c.getContext('2d');
  if (soft) {
    const small = document.createElement('canvas');
    small.width = w; small.height = h;
    const sg = small.getContext('2d');
    draw(sg, w, h);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(small, 0, 0, c.width, c.height);
  } else {
    g.scale(TEX_SCALE, TEX_SCALE);
    draw(g, w, h);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: rough, metalness: metal, transparent, alphaTest: transparent ? 0.5 : 0 });
  m.userData.key = key;
  m.userData.logical = [w, h];
  texCache.set(key, m);
  return m;
}
const px = (g, x, y, c, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

const G = {};
/**
 * A box with rounded edges (radius r) that keeps the six face groups and UVs of a BoxGeometry, so the per-face
 * materials (jersey front/back, face, hair) still map. Normals point out of the rounding: smooth shading.
 */
function softBox(w, h, d, r = Math.min(w, h, d) * 0.3, seg = 3) {
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
  pos.needsUpdate = true; nor.needsUpdate = true;
  return geo;
}
const box = (w, h, d, py = 0, round = 0.32, seg = 2) => { const b = softBox(w, h, d, Math.min(w, h, d) * round, seg); if (py) b.translate(0, py, 0); return b; };
/**
 * Sculpted limb: a lathe (turned) shape following a muscle profile, so thighs, calves, biceps and forearms
 * bulge and taper like real ones. prof = [[t 0..1 from the top joint, radius], ...]; depth = front-to-back scale.
 * Points run bottom -> top so the top of the texture (sleeve rows) lands at the shoulder / hip.
 */
const sculpt = (len, prof, depth = 1, seg = 14) => {
  const pts = prof.slice().reverse().map(([t, r]) => new THREE.Vector2(Math.max(0.002, r), -t * len));
  const g = new THREE.LatheGeometry(pts, seg);
  g.scale(1, 1, depth);
  g.computeVertexNormals();
  g.computeBoundingBox();
  return g;
};
/** Limb: almost capsule-like (big rounding) and a touch of taper read as muscle. */
const limb = (w, h, d, py, taper = 0.9) => {
  const b = softBox(w, h, d, Math.min(w, d) * 0.48, 4);
  const pos = b.attributes.position;
  for (let i = 0; i < pos.count; i++) { const k = 1 + (pos.getY(i) / h) * (1 - taper); pos.setX(i, pos.getX(i) * k); pos.setZ(i, pos.getZ(i) * k); }
  if (py) b.translate(0, py, 0);
  b.computeBoundingBox();
  return b;
};
function geo() {
  if (G.thigh) return G;
  // human proportions: smaller head, tapered limbs, rounded torso and pads
  G.thigh = sculpt(0.5, [[0, 0.07], [0.04, 0.094], [0.22, 0.104], [0.48, 0.092], [0.78, 0.074], [0.95, 0.064], [1, 0.05]], 1.06);
  G.shin = sculpt(0.45, [[0, 0.052], [0.06, 0.066], [0.24, 0.078], [0.45, 0.068], [0.75, 0.05], [0.94, 0.043], [1, 0.03]], 1.1);
  G.shoe = box(0.15, 0.09, 0.29, 0, 0.45, 3);
  G.hips = box(0.37, 0.21, 0.24, 0, 0.42, 3);
  G.torso = (() => { const b = softBox(0.44, 0.54, 0.27, 0.11, 5); const pos = b.attributes.position; for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); pos.setX(i, pos.getX(i) * (0.86 + (y + 0.27) * 0.3)); } b.translate(0, 0.26, 0); return b; })(); // V-taper
  G.pads = softBox(0.64, 0.18, 0.35, 0.085, 4);
  G.upper = sculpt(0.34, [[-0.05, 0.03], [0, 0.064], [0.18, 0.074], [0.45, 0.078], [0.75, 0.064], [0.95, 0.054], [1, 0.04]], 0.98);
  G.fore = sculpt(0.31, [[-0.02, 0.03], [0.02, 0.056], [0.22, 0.064], [0.5, 0.054], [0.85, 0.042], [1, 0.036]], 0.85);
  G.hand = box(0.1, 0.12, 0.11, 0, 0.45, 3);
  G.band = box(0.135, 0.06, 0.135, 0, 0.45, 3);
  G.head = headGeo('oval');
  G.headScale = 0.86;
  G.joint = new THREE.SphereGeometry(1, 16, 12);
  G.ball = new THREE.SphereGeometry(0.11, 8, 6);
  G.shadow = new THREE.CircleGeometry(0.5, 14);
  return G;
}
// soft contact shadow under each player (radial gradient), cheaper than real shadow maps
/** Head shapes: proportions + jaw taper (lower half narrower or squarer). Keeps the six face groups. */
const HEAD_DIMS = { oval: [0.33, 0.39, 0.36, 0.15, 0.84], round: [0.37, 0.36, 0.37, 0.18, 0.95], square: [0.36, 0.38, 0.35, 0.075, 1.04],
  long: [0.31, 0.43, 0.35, 0.13, 0.84], wide: [0.39, 0.36, 0.36, 0.13, 0.97], heart: [0.35, 0.39, 0.35, 0.15, 0.66] };
const headCache = {};
function headGeo(shape = 'oval') {
  if (headCache[shape]) return headCache[shape];
  const [w, h, d, r, jaw] = HEAD_DIMS[shape] ?? HEAD_DIMS.oval;
  const b = softBox(w, h, d, r, 6);
  const pos = b.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / (h / 2); // -1 chin .. 1 crown
    if (y < 0.1) { const k = 1 - (1 - jaw) * Math.min(1, (0.1 - y) / 1.1); pos.setX(i, pos.getX(i) * k); }
    if (y < -0.3) pos.setZ(i, pos.getZ(i) * (1 - (-0.3 - y) * 0.12)); // chin a touch forward/narrower front to back
    // round the cranium: back and top blend toward an ellipsoid; the face (front, -z) stays flatter for the features
    const x = pos.getX(i); const z = pos.getZ(i); const yy = pos.getY(i);
    const back = z > 0 ? Math.min(1, z / (d / 2)) : 0;
    const top = Math.max(0, y);
    const k = Math.min(1, back * 0.7 + top * 0.5);
    if (k > 0) {
      const ex = x / (w / 2); const ey = yy / (h / 2); const ez = z / (d / 2);
      const len = Math.hypot(ex, ey, ez) || 1;
      pos.setXYZ(i, x + (ex / len * (w / 2) - x) * k * 0.6, yy + (ey / len * (h / 2) - yy) * k * 0.35, z + (ez / len * (d / 2) - z) * k * 0.6);
    }
  }
  headCache[shape] = b;
  return b;
}
/** Body types: overall build multipliers + limb thickness. */
const BODY_TYPES = {
  lean: { torso: 0.92, depth: 0.92, arm: 0.88, leg: 0.9 }, athletic: { torso: 1, depth: 1, arm: 1, leg: 1 },
  muscular: { torso: 1.08, depth: 1.06, arm: 1.16, leg: 1.1 }, stocky: { torso: 1.12, depth: 1.18, arm: 1.1, leg: 1.14, belly: true },
  lanky: { torso: 0.9, depth: 0.9, arm: 0.86, leg: 0.88, tall: 1.04 },
};

const shadowMat = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false });
})();

// ---- legacy palettes (kept for older callers)
export const SKINS = SKIN_TONES;
export const HAIRS = HAIR_COLORS;

const INK = '#22324a';
function drawTattoo(g, style, x0, y0, w, h) {
  if (!style || style === 'none') return;
  const P = (x, y) => px(g, x0 + x, y0 + y, INK);
  if (style === 'band') { for (let x = 0; x < w; x++) { P(x, 2); P(x, 4); if (x % 2) P(x, 3); } }
  else if (style === 'tribal') { for (let x = 0; x < w; x++) { P(x, 1 + (x % 3)); P(x, 4 + ((x + 1) % 3)); } }
  else if (style === 'sleeve') { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x * 3 + y * 5) % 4 !== 0) P(x, y); }
  else if (style === 'stars') { [[1, 1], [5, 3], [2, 6], [6, 8], [3, 10]].forEach(([x, y]) => { if (y < h) { P(x, y); P(x - 1, y); P(x + 1, y); P(x, y - 1); P(x, y + 1); } }); }
  else if (style === 'script') { for (let y = 2; y < h - 1; y += 3) for (let x = 1; x < w - 1; x++) if ((x + y) % 3) P(x, y); }
  else if (style === 'cross') { for (let y = 1; y < Math.min(h, 8); y++) P(Math.floor(w / 2), y); for (let x = Math.floor(w / 2) - 2; x <= Math.floor(w / 2) + 2; x++) P(x, 3); }
  else {
    const C = (x, y, c) => { if (x >= 0 && x < w && y >= 0 && y < h) px(g, x0 + x, y0 + y, c); };
    if (style === 'flames') { for (let x = 0; x < w; x++) { const top = 2 + ((x * 7) % 5); for (let y = top; y < h; y++) C(x, y, y - top < 2 ? '#d9481e' : y - top < 4 ? '#e8a23a' : INK); } }
    else if (style === 'skull') { const cx = Math.floor(w / 2) - 2; for (let y = 1; y < 5; y++) for (let x = 0; x < 5; x++) C(cx + x, y, INK); C(cx + 1, 2, '#e9e1d0'); C(cx + 3, 2, '#e9e1d0'); C(cx + 1, 5, INK); C(cx + 3, 5, INK); }
    else if (style === 'wings') { for (let x = 0; x < w; x++) { C(x, 2 + Math.floor(Math.abs(x - w / 2) / 2), INK); C(x, 4 + Math.floor(Math.abs(x - w / 2) / 2), INK); } }
    else if (style === 'rose') { const cx = Math.floor(w / 2); C(cx, 2, '#b3202a'); C(cx - 1, 3, '#b3202a'); C(cx + 1, 3, '#b3202a'); C(cx, 3, '#7a1218'); C(cx, 4, '#b3202a'); for (let y = 5; y < Math.min(h, 10); y++) C(cx, y, '#2f6a3a'); C(cx + 1, 7, '#2f6a3a'); }
    else if (style === 'numbers') { for (const [x, y] of [[1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [3, 2], [4, 2], [5, 2], [5, 3], [4, 4], [3, 5], [3, 6], [4, 6], [5, 6]]) C(x, y, INK); }
    else if (style === 'geo') { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x + y) % 4 === 0 || (x - y + 40) % 4 === 0) if (y > 1 && y < 9) C(x, y, INK); }
    else if (style === 'koi') { for (let x = 1; x < w - 1; x++) C(x, 3 + Math.round(Math.sin(x) * 1.2), '#e2702a'); C(1, 3, INK); for (let y = 5; y < Math.min(h, 12); y++) C((y * 3) % w, y, '#3a6fb5'); }
  }
}
function neckMat(skin, tat) {
  return pixMat(`neck|${skin}|${tat}`, 6, 4, (g) => {
    px(g, 0, 0, skin, 6, 4);
    if (tat === 'script') { px(g, 1, 1, INK, 4, 1); px(g, 2, 2, INK, 2, 1); }
    else if (tat === 'stars') { px(g, 1, 1, INK); px(g, 4, 2, INK); px(g, 2, 3, INK); }
    else if (tat === 'wings') { px(g, 0, 1, INK, 2, 1); px(g, 4, 1, INK, 2, 1); px(g, 1, 2, INK); px(g, 4, 2, INK); }
    else if (tat === 'rose') { px(g, 2, 1, '#b3202a', 2, 2); px(g, 3, 3, '#2f6a3a'); }
    else if (tat === 'cross') { px(g, 3, 0, INK, 1, 4); px(g, 2, 1, INK, 3, 1); }
  });
}

// ---- head textures (12x12 pixels per face)
const HAIR_FRONT = { bald: 0, buzz: 1, short: 2, fade: 2, flattop: 2, curly: 3, afro: 3, mohawk: 0, dreads: 3, braids: 2, long: 3, bun: 2, twists: 3, cornrows: 1, undercut: 2, pompadour: 2, spiky: 2, ponytail: 2, waves: 1, frohawk: 0, slick: 1 };
const HAIR_BACK = { bald: 0, buzz: 6, short: 7, fade: 5, flattop: 6, curly: 8, afro: 10, mohawk: 0, dreads: 12, braids: 12, long: 12, bun: 8, twists: 9, cornrows: 7, undercut: 4, pompadour: 6, spiky: 6, ponytail: 7, waves: 5, frohawk: 0, slick: 8 };

function faceMat(L, hc, { eyeBlack = false } = {}) {
  const fem = L.gender === 'f';
  const key = `face2|${L.skin}|${L.hairStyle}|${L.hairColor}|${L.eyeColor}|${L.eyes}|${L.brows}|${L.nose}|${L.mouth}|${L.beard}|${eyeBlack}|${L.gender}|${L.lips}`;
  // Drawn with smooth shapes on a 12x12 logical grid (rendered at 72x72): shading, real eyes, nose, lips.
  return pixMat(key, 12, 12, (g) => {
    const sk = SKIN_TONES[L.skin % SKIN_TONES.length];
    const dk = shade(sk, -0.16);
    const dk2 = shade(sk, -0.32);
    const ell = (x, y, rx, ry, col, rot = 0) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); g.fill(); };
    // skin with soft shading (cheeks lit, jaw and temples darker)
    const base = g.createRadialGradient(6, 5.2, 1, 6, 6, 8.5);
    base.addColorStop(0, shade(sk, 0.06)); base.addColorStop(0.65, sk); base.addColorStop(1, shade(sk, -0.12));
    g.fillStyle = base; g.fillRect(0, 0, 12, 12);
    g.globalAlpha = 0.18; ell(3.2, 8, 1.6, 1.1, '#e07a6a'); ell(8.8, 8, 1.6, 1.1, '#e07a6a'); g.globalAlpha = 1; // a bit of colour in the cheeks
    // hairline / fringe
    const fr = HAIR_FRONT[L.hairStyle] ?? 2;
    const hcol = L.hairStyle === 'buzz' ? shade(hc, 0.15) : hc;
    if (fr) {
      g.fillStyle = hcol; g.beginPath(); g.moveTo(0, 0); g.lineTo(12, 0); g.lineTo(12, fr + 0.4);
      g.quadraticCurveTo(9, fr - 0.4, 6, fr + 0.3); g.quadraticCurveTo(3, fr - 0.4, 0, fr + 0.4); g.closePath(); g.fill();
      if (L.hairStyle === 'buzz') { g.globalAlpha = 0.5; g.fillStyle = sk; g.fillRect(0, 0, 12, fr); g.globalAlpha = 1; }
    }
    if (['long', 'dreads', 'braids'].includes(L.hairStyle)) { g.fillStyle = hcol; g.fillRect(0, 0, 1.6, 10); g.fillRect(10.4, 0, 1.6, 10); }
    if (L.hairStyle === 'mohawk' || L.hairStyle === 'frohawk') { g.fillStyle = shade(sk, -0.08); g.fillRect(0, 0, 12, 1); g.fillStyle = hc; g.fillRect(L.hairStyle === 'mohawk' ? 5 : 3.5, 0, L.hairStyle === 'mohawk' ? 2 : 5, 1.6); }
    // brows
    const bc = (L.hairColor ?? 0) > 8 ? '#2a1a12' : shade(hc, -0.12);
    g.strokeStyle = bc; g.lineCap = 'round';
    const by = L.brows === 'raised' ? 3.6 : 4.2;
    g.lineWidth = fem ? 0.38 : L.brows === 'thick' ? 0.9 : L.brows === 'thin' ? 0.35 : 0.6;
    const brow = (x0, x1, tilt) => { g.beginPath(); g.moveTo(x0, by + tilt); g.quadraticCurveTo((x0 + x1) / 2, by - 0.5, x1, by - tilt); g.stroke(); };
    if (L.brows === 'angry') { brow(2, 4.8, -0.5); brow(9.9, 7.2, -0.5); } else { brow(2, 4.9, 0); brow(7.1, 10, 0); }
    // eyes: white, iris, pupil, a highlight, lid line
    const ec = EYE_COLORS[L.eyeColor % EYE_COLORS.length];
    const ry = L.eyes === 'narrow' ? 0.38 : L.eyes === 'wide' ? 0.75 : L.eyes === 'sleepy' ? 0.45 : 0.6;
    for (const cx of [3.5, 8.5]) {
      g.fillStyle = dk; g.globalAlpha = 0.35; ell(cx, 5.7, 1.45, ry + 0.35, dk); g.globalAlpha = 1; // eye socket shade
      ell(cx, 5.7, 1.25, ry, '#f4f1ec');
      ell(cx, 5.75, 0.55, Math.min(0.55, ry), ec);
      ell(cx, 5.75, 0.25, Math.min(0.25, ry), '#0d0d0d');
      ell(cx + 0.18, 5.55, 0.1, 0.1, '#ffffff');
      g.strokeStyle = fem ? '#1a1210' : shade(sk, -0.45); g.lineWidth = fem ? 0.42 : L.eyes === 'sleepy' ? 0.45 : 0.25;
      g.beginPath(); g.ellipse(cx, 5.7, 1.25, ry, 0, Math.PI, 0); g.stroke();
      if (fem) { const out = cx < 6 ? -1 : 1; g.beginPath(); g.moveTo(cx + out * 1.2, 5.6); g.lineTo(cx + out * 1.6, 5.15); g.stroke(); } // lashes
    }
    if (eyeBlack) { g.globalAlpha = 0.9; ell(3.4, 7.15, 1.2, 0.38, '#111111'); ell(8.6, 7.15, 1.2, 0.38, '#111111'); g.globalAlpha = 1; }
    // nose: side shadow + nostrils
    const nw = L.nose === 'wide' ? 1.5 : L.nose === 'long' ? 0.9 : 1.1;
    const nb = L.nose === 'long' ? 7.9 : 7.6;
    g.fillStyle = dk; g.globalAlpha = 0.55; g.beginPath(); g.moveTo(6.1, 5.4); g.quadraticCurveTo(6.9, 6.8, 6 + nw, nb); g.lineTo(6, nb + 0.2); g.closePath(); g.fill(); g.globalAlpha = 1;
    ell(6 - nw * 0.45, nb, 0.28, 0.16, dk2); ell(6 + nw * 0.45, nb, 0.28, 0.16, dk2);
    // facial hair
    const natural = (L.hairColor ?? 0) <= 8 ? hc : HAIR_COLORS[1];
    const bh = shade(natural, -0.05);
    const beardArea = (yTop, sides = true) => {
      g.fillStyle = bh; g.beginPath(); g.moveTo(0, yTop);
      if (sides) { g.lineTo(1.6, yTop); g.quadraticCurveTo(2.2, 9.6, 4.2, 9.2); g.lineTo(7.8, 9.2); g.quadraticCurveTo(9.8, 9.6, 10.4, yTop); }
      g.lineTo(12, yTop); g.lineTo(12, 12); g.lineTo(0, 12); g.closePath(); g.fill();
    };
    if (L.beard === 'stubble') { g.globalAlpha = 0.28; beardArea(6.8); g.globalAlpha = 1; }
    if (L.beard === 'full' || L.beard === 'long') beardArea(6.2);
    if (L.beard === 'boxed') beardArea(6.8);
    if (L.beard === 'chinstrap') { g.strokeStyle = bh; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0.4, 5.6); g.quadraticCurveTo(1, 11.3, 6, 11.4); g.quadraticCurveTo(11, 11.3, 11.6, 5.6); g.stroke(); }
    if (L.beard === 'muttonchops') { ell(0.9, 7.6, 1.1, 2.6, bh); ell(11.1, 7.6, 1.1, 2.6, bh); }
    if (L.beard === 'goatee' || L.beard === 'vandyke') ell(6, 10.6, L.beard === 'vandyke' ? 0.9 : 1.6, 1.1, bh);
    if (L.beard === 'soulpatch') ell(6, 10.3, 0.5, 0.35, bh);
    if (['mustache', 'goatee', 'full', 'boxed', 'long', 'vandyke', 'handlebar'].includes(L.beard)) {
      g.fillStyle = bh; g.beginPath(); g.moveTo(3.6, 8.75); g.quadraticCurveTo(6, 7.9, 8.4, 8.75); g.quadraticCurveTo(6, 8.5, 3.6, 8.75); g.fill();
      ell(6, 8.45, 2.1, 0.4, bh);
      if (L.beard === 'handlebar') { g.strokeStyle = bh; g.lineWidth = 0.35; g.beginPath(); g.moveTo(3.9, 8.6); g.quadraticCurveTo(3, 8.8, 2.9, 8); g.moveTo(8.1, 8.6); g.quadraticCurveTo(9, 8.8, 9.1, 8); g.stroke(); }
    }
    // mouth
    const lip = shade(sk, -0.35);
    g.strokeStyle = shade(sk, -0.5); g.lineWidth = 0.32; g.lineCap = 'round';
    g.beginPath();
    if (L.mouth === 'smile') { g.moveTo(4.5, 9.2); g.quadraticCurveTo(6, 10.1, 7.5, 9.2); }
    else if (L.mouth === 'grin') { g.fillStyle = '#f7f4ef'; g.moveTo(4.4, 9.2); g.quadraticCurveTo(6, 10.5, 7.6, 9.2); g.closePath(); g.fill(); g.moveTo(4.4, 9.2); g.quadraticCurveTo(6, 10.5, 7.6, 9.2); }
    else if (L.mouth === 'smirk') { g.moveTo(4.8, 9.5); g.quadraticCurveTo(6.5, 9.6, 7.6, 9); }
    else if (L.mouth === 'serious') { g.moveTo(4.7, 9.5); g.lineTo(7.3, 9.5); }
    else { g.moveTo(4.6, 9.4); g.quadraticCurveTo(6, 9.7, 7.4, 9.4); }
    g.stroke();
    g.globalAlpha = 0.35; ell(6, 9.95, 1.1, 0.25, lip); g.globalAlpha = 1; // lower lip
    if (fem && L.lips && L.lips !== 'none') { g.globalAlpha = 0.9; ell(6, 9.35, 1.25, 0.28, L.lips); ell(6, 9.85, 1.05, 0.3, L.lips); g.globalAlpha = 1; }
  }, { rough: 0.6 });
}

function sideMat(L, hc, flip) {
  const key = `side|${L.skin}|${L.hairStyle}|${L.hairColor}|${L.beard}|${flip}`;
  return pixMat(key, 12, 12, (g) => {
    const sk = SKIN_TONES[L.skin % SKIN_TONES.length];
    px(g, 0, 0, sk, 12, 12);
    const fx = (x, w = 1) => (flip ? 12 - x - w : x); // x measured from the back of the head
    const top = HAIR_FRONT[L.hairStyle] ?? 2;
    const back = HAIR_BACK[L.hairStyle] ?? 6;
    if (top) px(g, 0, 0, hc, 12, Math.max(top, 2));
    if (back) for (let x = 0; x < 6; x++) px(g, fx(x), 0, hc, 1, Math.max(0, back - x));
    if (L.hairStyle === 'fade') px(g, fx(0, 7), 3, shade(hc, 0.25), 7, 2);
    if (L.hairStyle === 'mohawk' || L.hairStyle === 'frohawk') px(g, 0, 0, shade(sk, -0.1), 12, 1);
    if (L.hairStyle === 'undercut' || L.hairStyle === 'frohawk') px(g, 0, 2, shade(sk, -0.12), 12, 4); // shaved sides
    if (L.hairStyle === 'cornrows') for (let y = 0; y < 6; y += 2) px(g, 0, y, shade(hc, -0.3), 12, 1);
    if (L.hairStyle === 'slick') px(g, 0, 1, shade(hc, 0.2), 12, 1);
    px(g, fx(5, 2), 5, shade(sk, -0.2), 2, 3); // ear
    if (L.beard === 'muttonchops' || L.beard === 'boxed' || L.beard === 'long') px(g, fx(6, 3), 5, shade((L.hairColor ?? 0) <= 8 ? hc : HAIR_COLORS[1], -0.05), 3, 7);
    if (L.beard === 'full' || L.beard === 'chinstrap' || L.beard === 'boxed' || L.beard === 'long') px(g, fx(6, 6), 9, shade((L.hairColor ?? 0) <= 8 ? hc : HAIR_COLORS[1], -0.05), 6, 3);
  });
}

function backMat(L, hc) {
  const key = `back|${L.skin}|${L.hairStyle}|${L.hairColor}`;
  return pixMat(key, 12, 12, (g) => {
    const sk = SKIN_TONES[L.skin % SKIN_TONES.length];
    px(g, 0, 0, sk, 12, 12);
    const back = HAIR_BACK[L.hairStyle] ?? 6;
    if (back) px(g, 0, 0, hc, 12, back);
    if (L.hairStyle === 'fade') px(g, 0, 4, shade(hc, 0.25), 12, 1);
    if (L.hairStyle === 'braids') for (let x = 1; x < 12; x += 3) px(g, x, 0, shade(hc, -0.3), 1, 12);
    if (L.hairStyle === 'dreads') for (let x = 0; x < 12; x += 2) px(g, x, 2, shade(hc, -0.25), 1, 10);
    if (L.hairStyle === 'mohawk') px(g, 5, 0, hc, 2, 7);
    if (L.hairStyle === 'frohawk') px(g, 3, 0, hc, 6, 7);
    if (L.hairStyle === 'cornrows' || L.hairStyle === 'waves') for (let x = 1; x < 12; x += 2) px(g, x, 0, shade(hc, -0.3), 1, L.hairStyle === 'waves' ? 5 : 7);
    if (L.hairStyle === 'twists') for (let x = 0; x < 12; x += 2) px(g, x, 1, shade(hc, -0.25), 1, 8);
    if (L.hairStyle === 'undercut') px(g, 0, 3, shade(sk, -0.12), 12, 2);
  }, { soft: true });
}

function topMat(L, hc) {
  const key = `top|${L.skin}|${L.hairStyle}|${L.hairColor}`;
  return pixMat(key, 12, 12, (g) => {
    const sk = SKIN_TONES[L.skin % SKIN_TONES.length];
    if (L.hairStyle === 'bald') { px(g, 0, 0, sk, 12, 12); px(g, 4, 4, shade(sk, 0.15), 3, 2); return; }
    if (L.hairStyle === 'mohawk') { px(g, 0, 0, shade(sk, -0.05), 12, 12); px(g, 5, 0, hc, 2, 12); return; }
    if (L.hairStyle === 'frohawk') { px(g, 0, 0, shade(sk, -0.05), 12, 12); px(g, 3, 0, hc, 6, 12); return; }
    px(g, 0, 0, hc, 12, 12);
    const hi = shade(hc, 0.18);
    for (let i = 0; i < 9; i++) px(g, (i * 5) % 12, (i * 7) % 12, hi);
    if (L.hairStyle === 'braids') for (let x = 1; x < 12; x += 3) px(g, x, 0, shade(hc, -0.3), 1, 12);
    if (L.hairStyle === 'cornrows') for (let x = 1; x < 12; x += 2) px(g, x, 0, shade(hc, -0.3), 1, 12);
    if (L.hairStyle === 'waves') for (let y = 1; y < 12; y += 2) for (let x = 0; x < 12; x++) if ((x + y) % 3 === 0) px(g, x, y, shade(hc, -0.28));
    if (L.hairStyle === 'twists') for (let y = 0; y < 12; y += 2) for (let x = (y / 2) % 2; x < 12; x += 2) px(g, x, y, shade(hc, -0.22));
    if (L.hairStyle === 'slick') for (let x = 0; x < 12; x += 3) px(g, x, 0, shade(hc, 0.22), 1, 12);
    if (L.hairStyle === 'undercut') { px(g, 0, 0, shade(sk, -0.12), 2, 12); px(g, 10, 0, shade(sk, -0.12), 2, 12); }
  }, { soft: true });
}

/** Arm texture: 8x16. top rows = sleeve (jersey/shirt) unless bare, rest skin + tattoo or arm sleeve. */
function armMat(skin, sleeveCol, trim, tattoo, part, armSleeve, rows = 7) {
  const key = `arm|${skin}|${sleeveCol}|${trim}|${tattoo}|${part}|${armSleeve}|${rows}`;
  return pixMat(key, 8, 16, (g) => {
    px(g, 0, 0, skin, 8, 16);
    if (part === 'upper') {
      drawTattoo(g, tattoo, 0, rows, 8, 16 - rows);
      if (armSleeve) px(g, 0, rows - 1, armSleeve, 8, 17 - rows);
      px(g, 0, 0, sleeveCol, 8, rows);
      if (trim && rows > 3) px(g, 0, rows - 2, trim, 8, 1);
    } else {
      drawTattoo(g, tattoo, 0, 1, 8, 13);
      if (armSleeve) px(g, 0, 0, armSleeve, 8, 15);
    }
  }, { soft: true });
}

/** Jersey torso texture with stripes and a big blocky number. */
function jerseyMat(un, number, side) {
  const key = `jersey|${un.jersey}|${un.trim}|${un.numbers}|${number}|${side}`;
  return pixMat(key, 22, 26, (g) => {
    px(g, 0, 0, un.jersey, 22, 26);
    g.globalAlpha = 0.06; for (let y = 0; y < 26; y += 0.5) px(g, 0, y, y % 1 ? '#000' : '#fff', 22, 0.25); g.globalAlpha = 1; // mesh fabric
    const fold = g.createLinearGradient(0, 0, 22, 0); fold.addColorStop(0, 'rgba(0,0,0,0.18)'); fold.addColorStop(0.5, 'rgba(255,255,255,0.06)'); fold.addColorStop(1, 'rgba(0,0,0,0.18)');
    g.fillStyle = fold; g.fillRect(0, 0, 22, 26);
    px(g, 0, 22, shade(un.jersey, -0.15), 22, 4);
    if (side === 'front') { px(g, 8, 0, shade(un.jersey, -0.25), 6, 2); px(g, 9, 2, shade(un.jersey, -0.25), 4, 1); }
    if (number === undefined || side === 'side') { px(g, 0, 3, un.trim, 22, 1); return; }
    const s = String(number);
    g.font = side === 'front' ? 'bold 12px "Arial Black", Impact, sans-serif' : 'bold 16px "Arial Black", Impact, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const y = side === 'front' ? 10 : 12;
    // pixel outline
    g.fillStyle = un.trim === un.numbers ? shade(un.jersey, -0.4) : un.trim;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) g.fillText(s, 11 + dx, y + dy);
    g.fillStyle = un.numbers;
    g.fillText(s, 11, y);
  });
}

function padsMat(un) {
  const key = `pads|${un.jersey}|${un.trim}`;
  return pixMat(key, 16, 8, (g) => {
    px(g, 0, 0, un.jersey, 16, 8);
    px(g, 0, 2, un.trim, 16, 2);
    px(g, 0, 7, shade(un.jersey, -0.2), 16, 1);
  });
}

function shirtMat(color, side, tie = null) {
  const key = `shirt|${color}|${side}|${tie}`;
  return pixMat(key, 12, 14, (g) => {
    px(g, 0, 0, color, 12, 14);
    px(g, 0, 12, shade(color, -0.15), 12, 2);
    if (side === 'front' && tie) {
      // suit: white shirt V, lapels, tie
      px(g, 4, 0, '#f4f4f4', 4, 5); px(g, 5, 5, '#f4f4f4', 2, 2);
      px(g, 5, 1, tie, 2, 8); px(g, 5, 9, shade(tie, -0.2), 2, 1);
      px(g, 3, 0, shade(color, -0.25), 1, 6); px(g, 8, 0, shade(color, -0.25), 1, 6);
      px(g, 2, 8, shade(color, 0.2), 1, 1);
    } else if (side === 'front') { px(g, 4, 0, shade(color, -0.3), 4, 1); px(g, 5, 1, shade(color, -0.3), 2, 1); }
  });
}

function helmetMat(un, side) {
  const st = un.stripeStyle ?? 'single';
  const key = `helm|${un.helmet}|${un.stripe}|${side}|${st}|${un.finish ?? 'gloss'}`;
  return pixMat(key, 12, 12, (g) => {
    px(g, 0, 0, un.helmet, 12, 12);
    px(g, 0, 10, shade(un.helmet, -0.2), 12, 2);
    const strip = (x, w) => px(g, x, 0, un.stripe, w, side === 'back' ? 10 : 12);
    if (side === 'top' || side === 'back') {
      if (st === 'single') strip(5, 2);
      else if (st === 'double') { strip(3, 2); strip(7, 2); }
      else if (st === 'triple') { strip(2, 1); strip(5, 2); strip(9, 1); }
    }
    if (side === 'top' && un.finish !== 'matte') px(g, 3, 3, shade(un.helmet, un.finish === 'chrome' ? 0.6 : 0.35), 2, 2);
    if (side === 'side') { px(g, 3, 3, un.stripe, 6, 4); px(g, 4, 4, shade(un.stripe, -0.2), 4, 2); if (un.finish === 'chrome') px(g, 1, 1, '#ffffff', 2, 1); }
  });
}

function cleatTex(base, accent) {
  return pixMat(`cleat|${base}|${accent}`, 8, 8, (g) => {
    px(g, 0, 0, base, 8, 8);
    px(g, 0, 3, accent, 8, 2);
    px(g, 0, 7, shade(base, -0.35), 8, 1);
  });
}
function cleatDesignTex(base, accent, design) {
  return pixMat(`cleat2|${base}|${accent}|${design}`, 8, 8, (g) => {
    px(g, 0, 0, base, 8, 8);
    if (design === 'stripe') px(g, 0, 3, accent, 8, 2);
    else if (design === 'twotone') px(g, 0, 0, accent, 8, 4);
    else if (design === 'heel') { px(g, 5, 0, accent, 3, 8); px(g, 0, 6, accent, 8, 1); }
    else if (design === 'checker') { for (let y = 0; y < 7; y += 2) for (let x = (y / 2) % 2; x < 8; x += 2) px(g, x, y, accent, 1, 2); }
    else if (design === 'flames') { for (let x = 0; x < 8; x++) px(g, x, 2 + ((x * 5) % 3), accent, 1, 6 - ((x * 5) % 3)); px(g, 1, 5, '#ffcf3f', 2, 1); px(g, 5, 4, '#ffcf3f', 2, 1); }
    else if (design === 'bolt') { px(g, 5, 0, accent, 2, 2); px(g, 3, 2, accent, 3, 2); px(g, 2, 4, accent, 2, 2); px(g, 1, 6, accent, 1, 1); }
    else if (design === 'speckle') { for (let i = 0; i < 12; i++) px(g, (i * 5) % 8, (i * 3) % 7, accent); }
    px(g, 0, 7, shade(base, -0.35), 8, 1);
  });
}
function sockTex(style, team, trim) {
  return pixMat(`sock|${style}|${team}|${trim}`, 8, 12, (g) => {
    const c = style === 'white' ? '#f2f2f2' : style === 'black' ? '#16181c' : team;
    px(g, 0, 0, c, 8, 12);
    if (style === 'stripes') { px(g, 0, 2, trim, 8, 2); px(g, 0, 5, trim, 8, 1); }
    else if (style !== 'team') px(g, 0, 1, shade(c, -0.15), 8, 1);
  });
}
function gloveTex(base, accent, design) {
  return pixMat(`glove|${base}|${accent}|${design}`, 8, 8, (g) => {
    px(g, 0, 0, base, 8, 8);
    if (design === 'palm') px(g, 0, 3, accent, 8, 5);
    else if (design === 'stripe') px(g, 0, 0, accent, 8, 2);
    px(g, 2, 6, shade(base, -0.2), 4, 1);
  });
}
function braceTex(c) {
  return pixMat(`brace|${c}`, 8, 8, (g) => {
    px(g, 0, 0, c, 8, 8);
    px(g, 0, 1, '#9aa3ad', 8, 1);
    px(g, 0, 6, '#9aa3ad', 8, 1);
    px(g, 3, 2, shade(c, 0.25), 2, 4);
  });
}
function towelTex(c) {
  return pixMat(`towel|${c}`, 4, 10, (g) => {
    px(g, 0, 0, c, 4, 10);
    px(g, 0, 7, shade(c, -0.15), 4, 1);
    px(g, 0, 9, shade(c, -0.2), 4, 1);
  });
}

const sixFaces = (right, left, top, bottom, back, front) => [right, left, top, bottom, back, front];

// ------------------------------------------------------------------ rig

/**
 * Build a character. o = { football, uniform, look, number, helmet (bool), highlight, shirt, pants, shoe }
 */
function buildRig(o) {
  const g = geo();
  const L = o.look;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const sc = bodyScale(L);
  const bt = BODY_TYPES[L.bodyType] ?? BODY_TYPES.athletic;
  body.scale.set(sc.build, sc.height * (bt.tall ?? 1), Math.min(1.15, 0.5 + sc.build * 0.5));
  const joint = (r, mat, x = 0, y = 0, z = 0, sy = 1) => { const m = new THREE.Mesh(g.joint, mat); m.scale.set(r, r * sy, r); m.position.set(x, y, z); return m; };
  const skinC = SKIN_TONES[L.skin % SKIN_TONES.length];
  const hairC = HAIR_COLORS[(L.hairColor ?? 0) % HAIR_COLORS.length];
  const skin = toon(skinC);
  const un = o.uniform;
  const football = !!o.football;
  const shirtC = football ? un.jersey : o.shirt;
  const fem = L.gender === 'f';
  const pantsC = football ? un.pants : o.dress ? skinC : o.pants;
  const pants = toon(pantsC, o.dress ? 0.6 : 0.72);
  const sock = football && L.sockStyle && L.sockStyle !== 'team' ? sockTex(L.sockStyle, un.socks ?? un.jersey, un.trim) : toon(football ? un.socks ?? un.jersey : skinC);
  const teamCol = (v, white = '#f4f4f4', black = '#16181c') => (v === 'white' ? white : v === 'black' ? black : v === 'team' ? un?.trim ?? '#c0392b' : v);
  const underC = football ? (L.underColor === 'team' ? un.jersey : L.underColor ?? '#16181c') : null;
  const shoe = toon(football ? L.cleats ?? '#16181c' : o.shoe ?? '#f1f1f1');

  const hips = new THREE.Group();
  hips.position.y = 0.95;
  body.add(hips);
  const hipMesh = new THREE.Mesh(g.hips, o.dress ? toon(o.dress, 0.6) : pants);
  if (fem) hipMesh.scale.x = 1.08; // wider hips
  hips.add(hipMesh);
  if (o.dress) { // a-line skirt from the waist to the knee
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.55, 18, 1, true), new THREE.MeshStandardMaterial({ color: o.dress, roughness: 0.55, side: THREE.DoubleSide }));
    skirt.scale.z = 0.72; skirt.position.y = -0.22; skirt.castShadow = true;
    hips.add(skirt);
  }
  if (football && L.towel && L.towel !== 'none') {
    const tw = new THREE.Mesh(box(0.12, 0.3, 0.02), towelTex(L.towel === 'white' ? '#f4f4f4' : L.towel === 'black' ? '#16181c' : un.trim));
    tw.position.set(0.09, -0.2, -0.13);
    hips.add(tw);
  }
  if (football && L.handWarmer) {
    const hw = new THREE.Mesh(box(0.28, 0.11, 0.09), toon(un.trim === un.jersey ? '#16181c' : un.trim));
    hw.position.set(0, 0.08, -0.16);
    hips.add(hw);
  }

  const onSide = (v, side) => v === 'both' || v === (side < 0 ? 'left' : 'right');
  const teamOr = (v, white = '#f4f4f4', black = '#16181c') => (v === 'white' ? white : v === 'black' ? black : football ? un.trim : '#c0392b');
  const cleatMat = football ? cleatDesignTex(L.cleats ?? '#16181c', L.cleatAccent ?? '#f2f2f2', L.cleatDesign ?? 'stripe') : shoe;
  const mkLeg = (side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.1, -0.04, 0);
    const th = new THREE.Mesh(g.thigh, pants); th.scale.set(bt.leg, 1, bt.leg); hip.add(th);
    hip.add(joint(0.098 * bt.leg, pants, 0, -0.02, 0)); // hip joint blends thigh into hips
    const knee = new THREE.Group();
    knee.position.y = -0.48;
    hip.add(knee);
    const legSleeve = football && onSide(L.legSleeve, side);
    const shin = new THREE.Mesh(g.shin, legSleeve ? toon(L.legSleeveColor ?? '#16181c') : football ? sock : pants);
    shin.scale.set(bt.leg, 1, bt.leg);
    knee.add(shin);
    knee.add(joint(0.082 * bt.leg, legSleeve ? toon(L.legSleeveColor ?? '#16181c') : football ? pants : pants, 0, 0.01, 0)); // knee
    if (football && !legSleeve) { const sk = new THREE.Mesh(box(0.15, 0.05, 0.155), toon(un.trim)); sk.position.y = -0.1; knee.add(sk); }
    if (football && onSide(L.kneeBrace, side)) {
      const kb = new THREE.Mesh(box(0.19, 0.16, 0.2), braceTex(L.kneeColor ?? '#16181c'));
      kb.position.y = -0.01;
      knee.add(kb);
    }
    const foot = new THREE.Mesh(g.shoe, cleatMat);
    foot.position.set(0, -0.44, -0.05);
    knee.add(foot);
    if (football && (L.cleatCut === 'mid' || L.cleatCut === 'high')) { // mid / high-top cleats
      const hi = L.cleatCut === 'high';
      const ank = new THREE.Mesh(box(0.165, hi ? 0.15 : 0.08, 0.17), toon(L.cleats ?? '#16181c'));
      ank.position.set(0, hi ? -0.33 : -0.37, 0);
      knee.add(ank);
    }
    if (football && L.spats && L.spats !== 'none') {
      const sp = new THREE.Mesh(box(0.175, 0.13, 0.22), toon(teamOr(L.spats)));
      sp.position.set(0, -0.4, -0.03);
      knee.add(sp);
    }
    hips.add(hip);
    return { hip, knee, foot };
  };
  const legL = mkLeg(-1);
  const legR = mkLeg(1);

  const spine = new THREE.Group();
  hips.add(spine);
  const tm = football
    ? sixFaces(jerseyMat(un, undefined, 'side'), jerseyMat(un, undefined, 'side'), toon(un.jersey), toon(un.jersey), jerseyMat(un, o.number, 'back'), jerseyMat(un, o.number, 'front'))
    : sixFaces(toon(shirtC), toon(shirtC), toon(shirtC), toon(shirtC), shirtMat(shirtC, 'back'), shirtMat(shirtC, 'front', o.tie));
  const torso = new THREE.Mesh(g.torso, tm);
  torso.position.y = -0.02;
  spine.add(torso);
  const fitK = football ? ({ tight: 0.92, loose: 1.09 }[L.jFit] ?? 1) : 1;
  torso.scale.set(fitK * bt.torso * (fem ? 0.84 : 1), 1, fitK * bt.depth * (fem ? 0.92 : 1));
  if (bt.belly) { const belly = joint(0.17, football ? toon(un.jersey) : toon(shirtC), 0, 0.12, -0.07, 0.85); belly.scale.z *= 0.75; spine.add(belly); }
  // trapezius: slopes the neck down into the shoulders so the head doesn't sit on a flat shelf
  const traps = joint(fem ? 0.12 : 0.15, football ? toon(un.jersey) : toon(shirtC), 0, 0.5, 0.02, 0.45); traps.scale.x *= fem ? 1.05 : 1.25; spine.add(traps);
  if (football && L.jLength === 'crop') {
    // cropped jersey: shorter, showing a band of undershirt (or skin) above the pants
    torso.scale.y = 0.8;
    torso.position.y = -0.02 + 0.1;
    const band = new THREE.Mesh(box(0.4, 0.12, 0.23), underC === 'skin' ? skin : toon(underC ?? skinC));
    band.position.y = 0.04;
    spine.add(band);
  }
  const chest = new THREE.Group();
  chest.position.y = 0.5;
  spine.add(chest);
  const padK = football ? ({ small: 0.86, big: 1.2 }[L.padSize] ?? 1) : 1;
  if (football) {
    const pads = new THREE.Mesh(g.pads, padsMat(un));
    pads.position.y = -0.04;
    pads.scale.set(padK, padK > 1 ? 1.15 : padK < 1 ? 0.9 : 1, Math.min(1.12, padK));
    chest.add(pads);
    if (L.backplate && L.backplate !== 'none') { // back plate below the shoulder pads
      const bp = new THREE.Mesh(box(0.3, 0.16, 0.04), toon(teamCol(L.backplate)));
      bp.position.set(0, -0.2, 0.155 * fitK);
      chest.add(bp);
    }
    if (L.neckRoll && L.neckRoll !== 'none') { // horse collar / neck roll
      const nm = toon(teamCol(L.neckRoll));
      const back = new THREE.Mesh(box(0.34, 0.09, 0.09), nm); back.position.set(0, 0.06, 0.12); chest.add(back);
      for (const sd of [-1, 1]) { const side = new THREE.Mesh(box(0.08, 0.08, 0.24), nm); side.position.set(sd * 0.15, 0.05, 0.01); chest.add(side); }
    }
  }

  if (L.chain && L.chain !== 'none') {
    const cm = shiny({ gold: '#e6b422', silver: '#d6dbe2', ice: '#eaf6ff' }[L.chain], { rough: 0.2, metal: 0.9 });
    const z = -0.142;
    const y0 = football ? -0.13 : -0.02;
    for (const sd of [-1, 1]) { const link = new THREE.Mesh(box(0.11, 0.025, 0.02), cm); link.position.set(sd * 0.05, y0 - 0.03, z); link.rotation.z = -sd * 0.6; chest.add(link); }
    const pend = new THREE.Mesh(box(0.06, 0.07, 0.025), toon(L.chain === 'ice' ? '#9fe7ff' : L.chain === 'gold' ? '#ffd84a' : '#ffffff'));
    pend.position.set(0, y0 - 0.085, z - 0.005);
    chest.add(pend);
  }
  const neck = new THREE.Group();
  neck.position.y = 0.07;
  chest.add(neck);
  // counter the body's width scale so heads stay square
  neck.scale.set(1 / sc.build, 1 / sc.height * 0.96 + 0.04, 1 / body.scale.z);
  const neckBox = new THREE.Mesh(limb(0.17, 0.13, 0.16, 0, 0.92), L.tatNeck && L.tatNeck !== 'none' ? neckMat(skinC, L.tatNeck) : skin);
  neckBox.position.y = 0.035;
  neck.add(neckBox);
  const helmetOn = football && o.helmet !== false;
  const head = new THREE.Mesh(headGeo(L.headShape), sixFaces(
    sideMat(L, hairC, false), sideMat(L, hairC, true), topMat(L, hairC), skin, backMat(L, hairC),
    faceMat(L, hairC, { eyeBlack: helmetOn && L.eyeBlack }),
  ));
  head.position.y = 0.23;
  // 3D nose and ears so the face has real shape (the face texture shades the rest)
  const nw = L.nose === 'wide' ? 0.06 : L.nose === 'long' ? 0.04 : 0.048;
  const noseM = new THREE.Mesh(new THREE.ConeGeometry(nw * 0.6, L.nose === 'long' ? 0.085 : 0.07, 4), skin);
  noseM.rotation.x = -Math.PI / 2 + 0.35; noseM.rotation.y = Math.PI / 4; noseM.scale.set(1, 1, 0.7);
  const hd = HEAD_DIMS[L.headShape] ?? HEAD_DIMS.oval;
  noseM.position.set(0, 0.23 - hd[1] * 0.06, -hd[2] / 2 - 0.012);
  const ears = [];
  for (const sd of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), skin); e.scale.set(0.45, 1, 0.75); e.position.set(sd * (hd[0] / 2 - 0.004), 0.22, 0.01); ears.push(e); }
  // Big chunky heads: everything above the neck lives in a scaled group.
  const headGroup = new THREE.Group();
  headGroup.scale.setScalar(g.headScale);
  headGroup.position.y = -0.02;
  neck.add(headGroup);
  headGroup.add(head, noseM);
  if (!(football && o.helmet !== false)) headGroup.add(...ears);
  if (helmetOn) addHelmet(headGroup, un, L, hairC);
  else addHairVolume(headGroup, L, hairC);
  if (!helmetOn && L.earrings && L.earrings !== 'none') {
    const gold = shiny(L.earrings === 'studs' ? '#e9eef4' : '#e6b422', { rough: 0.2, metal: 0.9 });
    for (const sd of [-1, 1]) {
      const x = sd * 0.172; const y = 0.15; const z = 0.0;
      if (L.earrings === 'hoops') { const r = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.007, 6, 16), gold); r.position.set(x, y - 0.03, z); r.rotation.y = Math.PI / 2; headGroup.add(r); }
      else if (L.earrings === 'drops') { const d = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), gold); d.position.set(x, y - 0.045, z); headGroup.add(d); const st2 = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.03, 4), gold); st2.position.set(x, y - 0.02, z); headGroup.add(st2); }
      else { const d = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), gold); d.position.set(x, y, z); headGroup.add(d); }
    }
  }
  if (!helmetOn && L.beard === 'long') { // a beard that hangs below the chin
    const bm = toon(shade((L.hairColor ?? 0) <= 8 ? hairC : HAIR_COLORS[1], -0.05));
    const lb = new THREE.Mesh(box(0.22, 0.12, 0.1, 0, 0.45, 3), bm); lb.position.set(0, 0.05, -0.12); headGroup.add(lb);
  }
  if (helmetOn && L.mouthguard && L.mouthguard !== 'none') { // mouthguard hanging off the facemask
    const mg = toon(L.mouthguard === 'team' ? un.trim : MOUTHGUARD_COLORS[L.mouthguard] ?? '#dfe8ee');
    const piece = new THREE.Mesh(box(0.11, 0.045, 0.05), mg); piece.position.set(0.05, 0.1, -0.24); headGroup.add(piece);
    const strap = new THREE.Mesh(box(0.02, 0.07, 0.02), mg); strap.position.set(0.09, 0.15, -0.25); headGroup.add(strap);
  }

  const mkArm = (side) => {
    const sh = new THREE.Group();
    sh.position.set(side * (football ? 0.3 * (0.6 + padK * 0.4) * (0.7 + fitK * 0.3) : fem ? 0.235 : 0.27), -0.06, 0);
    const tat = side < 0 ? L.tatL : L.tatR;
    const sleeveOn = football && (L.sleeve === 'both' || L.sleeve === (side < 0 ? 'left' : 'right'));
    const longSleeve = football && L.jSleeve === 'long';
    const armSleeve = sleeveOn ? L.sleeveColor : longSleeve && underC !== 'skin' ? underC : o.tie ? shirtC : null; // suits have long sleeves
    const rows = football && L.jSleeve === 'cutoff' ? 3 : 7;
    const upper = new THREE.Mesh(g.upper, armMat(skinC, shirtC, football ? un.trim : null, tat, 'upper', armSleeve, rows));
    if (football && L.jFit === 'tight') upper.scale.set(0.94, 1, 0.94);
    upper.scale.x *= bt.arm; upper.scale.z *= bt.arm;
    sh.add(upper);
    // deltoid blends shoulder into arm (sleeve colour on players, shirt/skin on people)
    sh.add(joint(0.085 * bt.arm, football ? (rows <= 3 ? skin : toon(shirtC)) : (o.tie ? toon(shirtC) : toon(shirtC)), 0, -0.02, 0, 1.05));
    const el = new THREE.Group();
    el.position.y = -0.31;
    sh.add(el);
    const fore = new THREE.Mesh(g.fore, armMat(skinC, shirtC, null, tat, 'fore', armSleeve)); fore.scale.set(bt.arm, 1, bt.arm); el.add(fore);
    el.add(joint(0.066 * bt.arm, armSleeve ? toon(armSleeve) : skin, 0, 0.005, 0)); // elbow
    if (football && onSide(L.elbowPad, side)) { const ep = new THREE.Mesh(box(0.145, 0.09, 0.145), toon(L.elbowColor ?? '#16181c')); ep.position.y = -0.02; el.add(ep); }
    const wrist = football && (L.wristband === 'both' || L.wristband === (side < 0 ? 'left' : 'right'));
    if (wrist) { const b = new THREE.Mesh(g.band, toon(L.wristColor ?? '#f2f2f2')); b.position.y = -0.25; el.add(b); }
    const hand = new THREE.Mesh(g.hand, football && L.gloves ? (L.gloveDesign && L.gloveDesign !== 'solid' ? gloveTex(L.gloves, L.gloveAccent ?? '#f2f2f2', L.gloveDesign) : toon(L.gloves)) : skin);
    hand.position.y = -0.34;
    el.add(hand);
    chest.add(sh);
    return { sh, el, hand };
  };
  const armL = mkArm(-1);
  const armR = mkArm(1);

  const shadow = new THREE.Mesh(g.shadow, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  root.add(shadow);
  root.userData.shadow = shadow;
  if (o.highlight) {
    const ring = makeRing('#ffd43b', 0.55, 0.72, 1);
    root.add(ring);
    root.userData.ring = ring;
  }
  root.userData = {
    ...root.userData,
    rig: { body, hips, spine, chest, neck, legL, legR, armL, armR },
    u: { speed: 0, phase: Math.random() * 6, back: false, hold: null, action: null, down: false, downT: 0, hop: 0, yaw: 0, targetYaw: 0, celebrate: null,
      // everyone runs a little differently
      gait: { stride: 0.88 + Math.random() * 0.24, arm: 0.82 + Math.random() * 0.34, lean: -0.04 + Math.random() * 0.12, tempo: 0.93 + Math.random() * 0.14, bounce: 0.8 + Math.random() * 0.45 } },
    look: L,
    ticked: 0,
    un: football ? un : null,
    number: o.number,
    pantsMat: football ? pants : null,
  };
  return root;
}

// ------------------------------------------------------------------ game wear: stains + wet gear
// wear = { level 0..1 (how dirty), wet 0..1, snow bool, blood 0..1, mud bool }. Materials are swapped for
// stained copies (cached by bucket + variant, so a crowd of players shares a handful of textures).
const STAIN = {
  grass: ['#4f7d2c', '#3e6b24', '#5d8f34'],
  mud: ['#4a3520', '#5d4428', '#6e4e2e', '#3a2a18'],
  dust: ['#8a7255', '#9c8463', '#7a6346'],
  blood: ['#7a0c0c', '#a31515', '#5e0909'],
};
function stainedMat(base, part, w, variant) {
  const lv = Math.min(4, Math.round(w.level * 4));
  const wetB = w.wet > 0.3 ? 1 : 0;
  const bl = w.blood > 0.5 ? 2 : w.blood > 0.15 ? 1 : 0;
  const baseKey = base.userData.key ?? `col|${base.color.getHexString()}`;
  const key = `${baseKey}|wear|${part}|${lv}|${wetB}|${w.snow ? 1 : 0}|${w.mud ? 1 : 0}|${bl}|${variant}`;
  if (texCache.has(key)) return texCache.get(key);
  const src = base.map?.image;
  const [W, H] = base.userData.logical ?? [8, 12];
  return pixMat(key, W, H, (g) => {
    if (src) g.drawImage(src, 0, 0, W, H); else px(g, 0, 0, `#${base.color.getHexString()}`, W, H);
    let seed = (variant + 1) * 9301 + lv * 49297 + W * 7 + (part === 'helmet' ? 17 : part === 'pants' ? 3 : 0);
    const r = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    if (wetB) {
      // soaked: darker fabric with a few wet highlights
      g.globalAlpha = 0.28; px(g, 0, 0, '#0b1220', W, H); g.globalAlpha = 1;
      const n = part === 'helmet' ? 6 : Math.round(W * H / 40);
      for (let i = 0; i < n; i++) { g.globalAlpha = part === 'helmet' ? 0.75 : 0.35; px(g, Math.floor(r() * W), Math.floor(r() * H * 0.8), '#e8f4ff', 1, part === 'helmet' ? 1 : 2); }
      g.globalAlpha = 1;
    }
    if (w.snow) { for (let i = 0; i < W * H / 22; i++) px(g, Math.floor(r() * W), Math.floor(r() * H * 0.45), '#f4f8fb'); }
    if (lv > 0) {
      const pal = w.mud ? [...STAIN.mud, ...STAIN.mud, ...STAIN.grass] : [...STAIN.grass, ...STAIN.grass, ...STAIN.dust];
      const blobs = Math.round(lv * (part === 'helmet' ? 1.5 : part === 'pants' ? W * H / 28 : W * H / 60));
      for (let i = 0; i < blobs; i++) {
        // pants: knees + thighs get it worst; jerseys: lower half and shoulders
        const y = part === 'pants' ? Math.floor(H * (0.35 + r() * 0.65)) : part === 'helmet' ? Math.floor(r() * H) : Math.floor(H * (r() < 0.7 ? 0.45 + r() * 0.55 : r() * 0.3));
        const x = Math.floor(r() * W);
        const col = pal[Math.floor(r() * pal.length)];
        g.globalAlpha = part === 'helmet' ? 0.7 : 0.6 + r() * 0.35;
        if (part === 'helmet') px(g, x, y, r() < 0.5 ? col : '#c8c8c8', 1 + Math.floor(r() * 2), 1);
        else { px(g, x, y, col, 1 + Math.floor(r() * 3), 1 + Math.floor(r() * 2)); if (r() < 0.4) px(g, x + 1, y + 1, col, 2, 1); }
      }
      // a long grass / mud streak from a slide
      if (lv >= 2 && part !== 'helmet') { const y = Math.floor(H * (0.55 + r() * 0.35)); g.globalAlpha = 0.55; px(g, 0, y, pal[0], Math.floor(W * (0.5 + r() * 0.5)), 1); }
      g.globalAlpha = 1;
    }
    if (bl && part !== 'helmet') {
      const n = bl === 2 ? 7 : 3;
      for (let i = 0; i < n; i++) { const x = Math.floor(r() * W), y = Math.floor(H * (0.1 + r() * 0.6)); px(g, x, y, STAIN.blood[Math.floor(r() * 3)], 1 + Math.floor(r() * 2), 1); if (r() < 0.5) px(g, x, y + 1, STAIN.blood[2], 1, 1 + Math.floor(r() * 2)); }
    }
  }, { rough: wetB ? 0.32 : 0.75 });
}

/** Dirty up a football player's uniform and helmet for the current game situation. */
export function applyWear(root, w) {
  const ud = root.userData;
  if (!ud.un || !w) return;
  ud.wear = { ...w };
  ud.wearVar ??= Math.floor(Math.random() * 3);
  ud.origMats ??= new Map();
  const v = ud.wearVar;
  root.traverse((o) => {
    if (!o.isMesh || o === ud.shadow || o === ud.ring) return;
    if (!ud.origMats.has(o)) ud.origMats.set(o, o.material);
    const orig = ud.origMats.get(o);
    const swap = (m) => {
      if (!m) return m;
      const k = m.userData?.key ?? '';
      const part = k.startsWith('jersey|') || k.startsWith('pads|') ? 'jersey' : k.startsWith('helm|') ? 'helmet' : m === ud.pantsMat ? 'pants' : null;
      if (!part) return m;
      if (w.level <= 0.05 && w.wet <= 0.3 && !w.snow && w.blood <= 0.15) return m;
      return stainedMat(m, part, w, v);
    };
    o.material = Array.isArray(orig) ? orig.map(swap) : swap(orig);
  });
}
/**
 * Show a bad injury on the body: the limb bends the wrong way, and for open breaks a bit of bone shows.
 * part: ankle | knee | shin | arm | hand | shoulder. opts: { side: -1 | 1, bone, blood }
 */
export function applyInjuryLook(root, part, { side = Math.random() < 0.5 ? -1 : 1, bone = false, blood = true } = {}) {
  const rig = root.userData.rig;
  if (!rig || root.userData.injuryLook) return;
  root.userData.injuryLook = part;
  const leg = side < 0 ? rig.legL : rig.legR;
  const arm = side < 0 ? rig.armL : rig.armR;
  // wrap everything below a joint in a "bend" group so it stays bent through every animation
  const bendBelow = (joint, rx, ry, rz) => {
    const bend = new THREE.Group();
    for (const c of [...joint.children]) bend.add(c);
    joint.add(bend);
    bend.rotation.set(rx, ry, rz);
    return bend;
  };
  const boneMat = shiny('#f3efe2', { rough: 0.5 });
  const bloodMat = toon('#7a0c0c', 0.4);
  const addBone = (parent, x, y, z, rz) => {
    if (!bone) return;
    const b = new THREE.Mesh(box(0.035, 0.13, 0.035, 0, 0.3, 2), boneMat); b.position.set(x, y, z); b.rotation.z = rz; parent.add(b);
    if (blood) for (let i = 0; i < 4; i++) { const d = new THREE.Mesh(box(0.05 + Math.random() * 0.04, 0.02, 0.05, 0, 0.4, 1), bloodMat); d.position.set(x + (Math.random() - 0.5) * 0.08, y - 0.03 - i * 0.03, z + (Math.random() - 0.5) * 0.08); parent.add(d); }
  };
  if (part === 'ankle') { leg.foot.rotation.set(0.2, side * 1.5, side * 0.5); leg.foot.position.x += side * 0.05; addBone(leg.knee, side * 0.07, -0.36, 0, side * 0.9); }
  else if (part === 'knee') bendBelow(leg.knee, -0.5, 0, side * 0.75); // lower leg buckled sideways
  else if (part === 'shin') { const bend = bendBelow(leg.knee, 0, 0, 0); bend.position.y = -0.2; for (const c of bend.children) c.position.y += 0.2; bend.rotation.z = side * 1.05; bend.rotation.x = 0.45; addBone(leg.knee, side * 0.05, -0.2, 0, side * 1.1); }
  else if (part === 'arm') { bendBelow(arm.el, 1.25, 0, side * 0.5); addBone(arm.el, side * 0.05, -0.03, 0.02, side * 0.8); } // elbow folds backwards
  else if (part === 'hand') { arm.hand.rotation.set(0.4, 0, side * 1.3); arm.hand.position.x += side * 0.04; }
  else if (part === 'shoulder') { arm.sh.position.y -= 0.08; arm.sh.position.z += 0.05; arm.sh.scale.y = 1.06; }
}

/** More dirt after going down hard (and a little blood now and then). */
export function addWear(root, dLevel = 0.15, dBlood = 0) {
  const w = root.userData.wear;
  if (!w) return;
  applyWear(root, { ...w, level: Math.min(1, w.level + dLevel), blood: Math.min(1, (w.blood ?? 0) + dBlood) });
}

/** Facemask bar layouts: [width, y, z] horizontals, [x, y, h] verticals. */
const MASK_BARS = {
  single: { h: [[0.4, -0.06, -0.235]], v: [] },
  two: { h: [[0.4, -0.04, -0.235], [0.36, -0.12, -0.225]], v: [] },
  three: { h: [[0.4, -0.04, -0.235], [0.36, -0.12, -0.225]], v: [[0, -0.08, 0.12]] },
  skill: { h: [[0.4, -0.03, -0.235], [0.34, -0.11, -0.225]], v: [[-0.07, -0.07, 0.1], [0.07, -0.07, 0.1]] },
  robot: { h: [[0.4, -0.02, -0.235], [0.36, -0.09, -0.23], [0.22, -0.15, -0.215]], v: [[0, -0.07, 0.14]] },
  bull: { h: [[0.4, -0.02, -0.235], [0.38, -0.08, -0.235], [0.3, -0.14, -0.225]], v: [[0, -0.07, 0.14], [-0.1, -0.05, 0.1], [0.1, -0.05, 0.1]] },
  cage: { h: [[0.4, -0.01, -0.235], [0.4, -0.06, -0.24], [0.38, -0.11, -0.235], [0.3, -0.16, -0.22]], v: [[0, -0.08, 0.17], [-0.08, -0.08, 0.16], [0.08, -0.08, 0.16]] },
  open: { h: [[0.4, -0.08, -0.235]], v: [[-0.12, -0.05, 0.08], [0.12, -0.05, 0.08]] },
};

function addHelmet(neck, un, L, hairC) {
  const H = new THREE.Group();
  H.position.y = 0.25;
  neck.add(H);
  // shell finish
  const fin = L.helmetFinish ?? 'gloss';
  const shellC = fin === 'matte' ? shade(un.helmet, -0.18) : fin === 'chrome' ? shade(un.helmet, 0.22) : un.helmet;
  const stripe = L.helmetStripe ?? 'single';
  const hu = { ...un, helmet: shellC, stripeStyle: stripe, finish: fin };
  const rough = fin === 'matte' ? 0.75 : fin === 'chrome' ? 0.18 : 0.3;
  const metal = fin === 'chrome' ? 0.85 : 0;
  const shellMat = (m) => { const c = m.clone(); c.roughness = rough; c.metalness = metal; c.side = THREE.DoubleSide; return c; };
  const shell = shiny(shellC, { rough, metal });
  const add = (geom, mat, x, y, z) => { const m = new THREE.Mesh(geom, mat); m.position.set(x, y, z); H.add(m); return m; };
  const open = new THREE.MeshBasicMaterial({ visible: false });
  const shellGeo = softBox(0.44, 0.43, 0.47, 0.2, 6);
  const sideM = shellMat(helmetMat(hu, 'side'));
  const dome = add(shellGeo, [sideM, sideM, shellMat(helmetMat(hu, 'top')), shellMat(shell), shellMat(helmetMat(hu, 'back')), open], 0, 0.01, 0.01);
  dome.scale.set(1, 1, 1);
  add(box(0.4, 0.05, 0.06, 0, 0.45, 3), shell, 0, 0.15, -0.205); // brim
  // jaw pads
  add(box(0.05, 0.14, 0.16, 0, 0.45, 3), shell, -0.2, -0.08, -0.12);
  add(box(0.05, 0.14, 0.16, 0, 0.45, 3), shell, 0.2, -0.08, -0.12);
  // facemask
  const mc = L.maskColor === 'team' ? un.stripe : (L.maskColor ?? '#c3cad3');
  const mask = shiny(mc, { rough: 0.35, metal: 0.4 });
  const bars = MASK_BARS[L.maskStyle] ?? MASK_BARS.three;
  for (const [w, y, z] of bars.h) add(box(w, 0.026, 0.026, 0, 0.5, 2), mask, 0, y, z);
  for (const [x, y, hh] of bars.v) add(box(0.026, hh, 0.026, 0, 0.5, 2), mask, x, y, -0.235);
  add(box(0.03, 0.1, 0.06), mask, -0.19, -0.07, -0.205);
  add(box(0.03, 0.1, 0.06), mask, 0.19, -0.07, -0.205);
  if (L.visor && L.visor !== 'none') {
    const [col, op] = VISOR_TINTS[L.visor] ?? VISOR_TINTS.dark;
    const v = new THREE.Mesh(box(0.36, 0.09, 0.012, 0, 0.3, 2), new THREE.MeshStandardMaterial({ color: col, transparent: true, opacity: op, roughness: 0.08, metalness: 0.6 }));
    v.position.set(0, 0.05, -0.2);
    H.add(v);
  }
  // long hair and locs hang out the back of the helmet
  if (['long', 'dreads', 'braids'].includes(L.hairStyle)) {
    const hm = toon(hairC);
    if (L.hairStyle === 'long') add(box(0.3, 0.22, 0.06), hm, 0, -0.27, 0.19);
    else for (const x of [-0.12, -0.04, 0.04, 0.12]) add(box(0.05, 0.26, 0.05), hm, x, -0.28, 0.2);
  }
}

function addHairVolume(neck, L, hairC) {
  const hm = toon(hairC, 0.85);
  // hair hugs the (smaller, rounder) head: pulled down and in a little, with soft rounded clumps
  const hg = new THREE.Group(); hg.position.y = -0.045; hg.scale.set(0.9, 1, 0.94); neck.add(hg);
  const add = (w, h, d, x, y, z, m = hm) => { const mesh = new THREE.Mesh(box(w, h, d, 0, 0.48, 3), m); mesh.position.set(x, y, z); hg.add(mesh); return mesh; };
  const top = 0.23 + 0.18;
  switch (L.hairStyle) {
    case 'afro': add(0.46, 0.22, 0.44, 0, top + 0.06, 0.02); add(0.44, 0.16, 0.2, 0, top - 0.08, 0.13); break;
    case 'curly': add(0.39, 0.08, 0.37, 0, top + 0.02, 0.01); add(0.1, 0.06, 0.1, -0.1, top + 0.08, -0.05); add(0.1, 0.06, 0.1, 0.08, top + 0.08, 0.06); break;
    case 'flattop': add(0.36, 0.12, 0.32, 0, top + 0.06, 0.01); break;
    case 'mohawk': add(0.07, 0.1, 0.36, 0, top + 0.05, 0.01); break;
    case 'short': add(0.37, 0.04, 0.35, 0, top + 0.01, 0.005); break;
    case 'bun': add(0.39, 0.06, 0.37, 0, top + 0.01, 0); add(0.2, 0.18, 0.18, 0, top + 0.07, 0.13); add(0.07, 0.16, 0.2, -0.18, 0.31, 0.02); add(0.07, 0.16, 0.2, 0.18, 0.31, 0.02); break;
    case 'long': // full hair that frames the face and falls past the shoulders
      add(0.4, 0.07, 0.38, 0, top + 0.02, 0.01); add(0.4, 0.5, 0.12, 0, 0.1, 0.17);
      add(0.07, 0.42, 0.24, -0.19, 0.17, 0.04); add(0.07, 0.42, 0.24, 0.19, 0.17, 0.04);
      add(0.36, 0.12, 0.08, 0, top - 0.06, -0.17); break;
    case 'dreads': add(0.38, 0.05, 0.36, 0, top + 0.02, 0); for (let i = 0; i < 6; i++) add(0.05, 0.32, 0.05, -0.15 + i * 0.06, 0.1, 0.18); add(0.05, 0.26, 0.05, -0.19, 0.13, 0.06); add(0.05, 0.26, 0.05, 0.19, 0.13, 0.06); break;
    case 'braids': add(0.37, 0.03, 0.35, 0, top, 0); add(0.06, 0.36, 0.06, -0.08, 0.1, 0.19); add(0.06, 0.36, 0.06, 0.08, 0.1, 0.19); break;
    case 'twists': add(0.39, 0.06, 0.37, 0, top + 0.02, 0.01); for (let i = 0; i < 7; i++) add(0.06, 0.08, 0.06, -0.15 + (i % 4) * 0.1, top + 0.08, -0.12 + Math.floor(i / 4) * 0.2); break;
    case 'undercut': add(0.24, 0.06, 0.34, 0, top + 0.03, 0); add(0.24, 0.05, 0.08, 0, top + 0.02, -0.17); break;
    case 'pompadour': add(0.34, 0.05, 0.3, 0, top + 0.02, 0.02); add(0.3, 0.12, 0.12, 0, top + 0.07, -0.12); break;
    case 'spiky': add(0.37, 0.04, 0.35, 0, top + 0.01, 0); for (let i = 0; i < 6; i++) { const sp = add(0.07, 0.11, 0.07, -0.13 + (i % 3) * 0.13, top + 0.08, -0.08 + Math.floor(i / 3) * 0.16); sp.rotation.z = (i % 2 ? 0.3 : -0.3); } break;
    case 'ponytail': add(0.39, 0.06, 0.37, 0, top + 0.01, 0); add(0.07, 0.18, 0.22, -0.18, 0.3, 0.03); add(0.07, 0.18, 0.22, 0.18, 0.3, 0.03); add(0.13, 0.13, 0.13, 0, 0.33, 0.2); add(0.1, 0.36, 0.1, 0, 0.12, 0.25); break;
    case 'frohawk': add(0.16, 0.16, 0.38, 0, top + 0.07, 0.01); break;
    case 'slick': add(0.37, 0.03, 0.36, 0, top + 0.01, 0.01); add(0.36, 0.08, 0.06, 0, 0.32, 0.18); break;
    default: break;
  }
}

function uniformFrom(colors) {
  const [p, s] = colors;
  const light = (c) => parseInt(c.slice(1), 16) > 0xdddddd;
  return { jersey: p, trim: s, numbers: light(p) ? s : light(s) ? s : '#ffffff', pants: light(s) ? '#eceef1' : s, helmet: p, stripe: s, socks: p };
}

/**
 * Football player. colors = [primary, secondary]; or pass a full `uniform` (see data/kits.js).
 * look: a full look (data/looks.js); random if omitted. helmet: false shows the head and hair.
 */
export function makePlayer(colors, { highlight = false, number, uniform, look, helmet = true, position } = {}) {
  // Only guys play on the team: girls are cheerleaders, fans, dates, family, press, never in a uniform.
  const base = look ? normalizeLook(look) : randomLook(Math.random, { position: position ?? 'WR', gender: 'm' });
  const L = base.gender === 'f' ? masculinize(base, JSON.stringify(look ?? {}).length) : { ...base, gender: 'm', lips: 'none', dress: null };
  return buildRig({
    football: true, uniform: uniform ?? uniformFrom(colors), look: L,
    number: number ?? Math.floor(Math.random() * 89) + 1, helmet, highlight,
  });
}

/** Person in casual clothes. look = full look (shirt, pants, shoe + face/hair/body fields). */
export function makePerson(look, { highlight = false } = {}) {
  const L = normalizeLook(look, JSON.stringify(look ?? {}).length);
  if (L.outfit === 'gala' && L.gender === 'f') return buildRig({ football: false, look: L, shirt: L.dress ?? L.suit ?? '#7a1f3a', pants: '#000', dress: L.dress ?? L.suit ?? '#7a1f3a', shoe: '#1b1b1b', highlight });
  if (L.outfit === 'gala') return buildRig({ football: false, look: L, shirt: L.suit ?? '#16181f', pants: L.suit ?? '#16181f', shoe: '#111111', tie: L.tie ?? '#c92a2a', highlight });
  return buildRig({ football: false, look: L, shirt: L.shirt ?? '#3a86ff', pants: L.pants ?? '#34495e', shoe: L.shoe ?? '#f1f1f1', highlight });
}

// ------------------------------------------------------------------ animation

let FRAME = 0;
export function nextFrame() { FRAME++; }
/** Mark a character as already animated this frame (used by instant replay). */
export function markTicked(p) { p.userData.ticked = FRAME; }
export function tickIdle(root, dt) {
  root.traverse((o) => { if (o.userData?.rig && o.userData.ticked !== FRAME) animateRun(o, dt, 0); });
}

const ACTION_DUR = { throw: 0.55, catch: 0.5, jump: 0.7, juke: 0.35, spin: 0.5, stiff: 0.6, dive: 0.7, tackle: 0.55, lunge: 0.4, fall: 0.5, getup: 0.7, wave: 1.2, spike: 0.9, release: 0.3, cut: 0.25 };

/** Pose for this frame. Returns target joint angles. */
function computePose(u, dt) {
  const P = { lh: 0, lk: 0, rh: 0, rk: 0, ls: 0.1, le: 0.3, rs: 0.1, re: 0.3, lout: 0.12, rout: -0.12, spine: 0.05, y: 0, rz: 0, ry: 0, rx: 0, head: 0, hy: 0, sy: 0, ny: 0, sx: 0 };
  const s = u.speed;
  // ---- locomotion
  if (s > 0.4 && !u.down) {
    const run = Math.min(1, s / 7);
    const gt = u.gait ?? { stride: 1, arm: 1, lean: 0, tempo: 1, bounce: 1 };
    u.phase += dt * (5 + s * 1.25) * (u.back ? 1.3 : 1) * gt.tempo;
    const a = Math.sin(u.phase);
    const b = Math.cos(u.phase);
    if (u.back) {
      P.lh = a * 0.35; P.rh = -a * 0.35; P.lk = 0.4 + Math.max(0, b) * 0.4; P.rk = 0.4 + Math.max(0, -b) * 0.4;
      P.ls = 0.4 - a * 0.3; P.rs = 0.4 + a * 0.3; P.le = 1.2; P.re = 1.2; P.spine = -0.08; P.y = -0.08;
    } else {
      // legs: long strides with high knee lift on the recovery swing
      P.lh = a * (0.45 + run * 0.6) * gt.stride + run * 0.08; P.rh = -a * (0.45 + run * 0.6) * gt.stride + run * 0.08;
      P.lk = 0.2 + Math.max(0, -b) * (0.6 + run * 1.1) + Math.max(0, a) * 0.25 * run;
      P.rk = 0.2 + Math.max(0, b) * (0.6 + run * 1.1) + Math.max(0, -a) * 0.25 * run;
      // arms pump opposite the legs; forearms whip a beat behind the upper arm
      P.ls = -a * (0.45 + run * 0.75) * gt.arm; P.rs = a * (0.45 + run * 0.75) * gt.arm;
      P.le = 0.7 + run * 0.8 + Math.max(0, a) * 0.35; P.re = 0.7 + run * 0.8 + Math.max(0, -a) * 0.35;
      P.lout = 0.1 + run * 0.08; P.rout = -0.1 - run * 0.08;
      // hips swing with the legs, shoulders counter-rotate, head stays steady
      P.hy = a * 0.22 * (0.4 + run * 0.6); P.sy = -a * 0.42 * (0.4 + run * 0.6); P.ny = a * 0.18 * run;
      P.spine = 0.1 + run * 0.3 + gt.lean; P.head = -run * 0.18 + Math.sin(u.phase * 2) * 0.03;
      // two bounces per stride (a small flight phase when sprinting) and a little side sway
      P.y = (-Math.abs(Math.sin(u.phase)) * (0.05 + 0.05 * run) + run * 0.02) * gt.bounce;
      P.rz = Math.sin(u.phase) * 0.035;
      P.sx = Math.sin(u.phase) * 0.02 * (1 - run * 0.5);
    }
  } else if (!u.down) {
    u.phase += dt * 1.6;
    u.idleT = (u.idleT ?? Math.random() * 10) + dt;
    P.spine = 0.04 + Math.sin(u.phase) * 0.025; // breathing
    P.ls = 0.08 + Math.sin(u.phase) * 0.03; P.rs = 0.08 - Math.sin(u.phase) * 0.03;
    P.le = 0.25 + Math.sin(u.phase * 0.7) * 0.06; P.re = 0.25 - Math.sin(u.phase * 0.7) * 0.06;
    // slow weight shift from foot to foot
    const w = Math.sin(u.idleT * 0.55);
    P.rz = w * 0.035; P.sx = w * 0.03; P.lh = Math.max(0, w) * 0.08; P.lk = Math.max(0, w) * 0.16; P.rh = Math.max(0, -w) * 0.08; P.rk = Math.max(0, -w) * 0.16;
    // glance around every few seconds
    if (!u.lookT || u.idleT > u.lookT) { u.lookT = u.idleT + 2 + Math.random() * 3; u.look = (Math.random() - 0.5) * 1.1; }
    P.ny = u.look ?? 0;
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
  // ---- momentum: bank into turns, lean into acceleration, dip when planting a cut
  if (!u.down && !u.celebrate && !u.action && s > 1) {
    const run = Math.min(1, s / 7);
    P.rz += Math.max(-0.4, Math.min(0.4, (u.turn ?? 0) * 0.07 * run));
    P.rx += Math.max(-0.12, Math.min(0.28, (u.accel ?? 0) * 0.025));
    P.y -= Math.min(0.1, Math.abs(u.turn ?? 0) * 0.012);
  }
  // ---- down on the ground
  if (u.down) { u.downT += dt; P.rx = -1.5; P.y = -0.66; P.ls = 2.2; P.rs = 1.6; P.lh = 0.3; P.rh = 0.6; P.lk = 0.4; }
  return P;
}

function applyPose(p, P, dt) {
  const r = p.userData.rig;
  const u = p.userData.u;
  if (u.rag) { applyRag(p, dt); return; }
  // ease back any offset left from a ragdoll
  r.body.position.z += (0 - r.body.position.z) * Math.min(1, dt * 5);
  if (p.userData.shadow) { p.userData.shadow.position.x = r.body.position.x; p.userData.shadow.position.z = r.body.position.z; }
  const k = 1 - Math.exp(-16 * dt);
  const L = (obj, prop, v) => { obj[prop] += (v - obj[prop]) * k; };
  // Joints ride on slightly under-damped springs: limbs overshoot a touch and settle, which reads as
  // weight and follow-through instead of snapping straight into each pose.
  const jv = (u.jv ??= {});
  const sdt = Math.min(dt, 0.034);
  let ji = 0;
  const S = (obj, prop, v, stiff = 165, damp = 19) => {
    const key = ji++;
    const vel = jv[key] ?? 0;
    const a = stiff * (v - obj[prop]) - damp * vel;
    const nv = vel + a * sdt;
    jv[key] = nv;
    obj[prop] += nv * sdt;
  };
  S(r.legL.hip.rotation, 'x', P.lh, 190, 21); S(r.legL.knee.rotation, 'x', -P.lk, 190, 21);
  S(r.legR.hip.rotation, 'x', P.rh, 190, 21); S(r.legR.knee.rotation, 'x', -P.rk, 190, 21);
  S(r.armL.sh.rotation, 'x', P.ls, 140, 15); S(r.armL.el.rotation, 'x', P.le, 120, 13); S(r.armL.sh.rotation, 'z', -P.lout, 120, 14);
  S(r.armR.sh.rotation, 'x', P.rs, 140, 15); S(r.armR.el.rotation, 'x', P.re, 120, 13); S(r.armR.sh.rotation, 'z', -P.rout, 120, 14);
  S(r.spine.rotation, 'x', -P.spine, 110, 14);
  S(r.neck.rotation, 'x', -P.head, 90, 12);
  L(r.hips.rotation, 'y', P.hy);
  L(r.spine.rotation, 'y', P.sy);
  L(r.neck.rotation, 'y', P.ny - P.sy * 0.6 - P.hy * 0.6);
  L(r.body.position, 'x', P.sx);
  // body: position offset (crouch/hop), roll (juke lean), pitch (dive/fall), yaw (spin)
  u.hop = Math.max(0, u.hop - dt * 2.2);
  L(r.body.position, 'y', P.y + u.hop);
  // body roll wobbles a little (bumps, cuts) on a softer spring
  u.rzv = (u.rzv ?? 0) + (95 * (P.rz - r.body.rotation.z) - 11 * (u.rzv ?? 0)) * sdt;
  r.body.rotation.z += u.rzv * sdt;
  r.body.rotation.x += (-P.rx - r.body.rotation.x) * k; // pitch forward = negative x on this rig
  if (Math.abs(P.ry) > 3) r.body.rotation.y = P.ry; else L(r.body.rotation, 'y', P.ry);
  // smooth facing
  let d = u.targetYaw - p.rotation.y;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  p.rotation.y += d * (1 - Math.exp(-12 * dt));
}

// ------------------------------------------------------------------ ragdoll tumble

/**
 * Knock a character flying: a simple physics tumble of the whole body plus flailing limbs, ending
 * flat on the ground. dir = world-space push direction {x, z}; power ~ 0.5 (light) .. 2 (huge hit).
 * The root stays where the game put it; only the body inside it moves, so gameplay positions are safe.
 */
export function ragdoll(p, dir = { x: 0, z: -1 }, power = 1) {
  const u = p.userData.u;
  const yaw = p.rotation.y;
  // world -> local (root is rotated by yaw around y)
  const lx = dir.x * Math.cos(yaw) - dir.z * Math.sin(yaw);
  const lz = dir.x * Math.sin(yaw) + dir.z * Math.cos(yaw);
  const n = Math.hypot(lx, lz) || 1;
  const sp = 1.6 + power * 1.7;
  u.rag = {
    t: 0, vx: (lx / n) * sp, vz: (lz / n) * sp, vy: 1.6 + power * 1.8,
    // tumble: pitch around local x (forward/back), some roll
    wx: (lz / n) * (5 + power * 4) * (Math.random() < 0.5 ? 1 : -1) * -1, wz: (Math.random() - 0.5) * 6 * power, wy: (Math.random() - 0.5) * 4,
    flail: 0, targets: null, settled: false, bounce: 0,
  };
  u.celebrate = null;
  u.action = null;
  u.hold = null;
  u.down = true;
  u.downT = 0;
  u.targetYaw = p.rotation.y;
}

const _box = new THREE.Box3();
function applyRag(p, dt) {
  const r = p.userData.rig;
  const u = p.userData.u;
  const g = u.rag;
  const b = r.body;
  g.t += dt;
  u.downT += dt;
  if (b.rotation.order !== 'YXZ') b.rotation.order = 'YXZ';
  if (!g.settled) {
    g.vy -= 14 * dt;
    b.position.x += g.vx * dt;
    b.position.z += g.vz * dt;
    b.position.y += g.vy * dt;
    b.rotation.x += g.wx * dt;
    b.rotation.z += g.wz * dt;
    b.rotation.y += g.wy * dt;
    // limbs flail wildly while airborne
    g.flail -= dt;
    if (g.flail <= 0 || !g.targets) {
      g.flail = 0.09;
      const R = () => (Math.random() - 0.5);
      g.targets = { ls: R() * 4, rs: R() * 4, le: Math.random() * 1.8, re: Math.random() * 1.8, lh: R() * 2.2, rh: R() * 2.2, lk: Math.random() * 1.8, rk: Math.random() * 1.8, lo: R() * 1.6, ro: R() * 1.6 };
    }
    if (g.t > 2.5) g.settled = true;
  } else {
    // settle flat on the back or the front, limbs sprawled
    if (g.faceX === undefined) {
      let x = b.rotation.x % (Math.PI * 2);
      if (x > Math.PI) x -= Math.PI * 2;
      if (x < -Math.PI) x += Math.PI * 2;
      b.rotation.x = x;
      g.faceX = x >= 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    b.rotation.x += (g.faceX - b.rotation.x) * Math.min(1, dt * 6);
    b.rotation.z += (0 - b.rotation.z) * Math.min(1, dt * 6);
    g.targets = g.rest ?? (g.rest = { ls: 2.2, rs: 1.4, le: 0.3, re: 0.6, lh: 0.3, rh: -0.2, lk: 0.5, rk: 0.2, lo: 0.6, ro: -0.4 });
  }
  // ground contact from the body's real lowest point (works in any orientation)
  p.updateMatrixWorld(true);
  _box.setFromObject(b);
  const low = _box.min.y - p.position.y;
  if (low < 0.02) {
    b.position.y += 0.02 - low;
    if (!g.settled && g.vy < 0) {
      g.bounce++;
      g.vy = -g.vy * 0.3;
      g.vx *= 0.45; g.vz *= 0.45; g.wx *= 0.4; g.wz *= 0.4; g.wy *= 0.4;
      if (g.bounce >= 2 || Math.abs(g.vy) < 0.7) g.settled = true;
    }
  } else if (g.settled) b.position.y -= Math.min(low - 0.02, dt * 3);
  const sh = p.userData.shadow;
  if (sh) { sh.position.x = b.position.x; sh.position.z = b.position.z; }
  const k = Math.min(1, dt * (g.settled ? 6 : 18));
  const T = g.targets;
  const L = (o, prop, v) => { o[prop] += (v - o[prop]) * k; };
  L(r.armL.sh.rotation, 'x', T.ls); L(r.armR.sh.rotation, 'x', T.rs);
  L(r.armL.el.rotation, 'x', T.le); L(r.armR.el.rotation, 'x', T.re);
  L(r.armL.sh.rotation, 'z', -T.lo); L(r.armR.sh.rotation, 'z', -T.ro);
  L(r.legL.hip.rotation, 'x', T.lh); L(r.legR.hip.rotation, 'x', T.rh);
  L(r.legL.knee.rotation, 'x', -T.lk); L(r.legR.knee.rotation, 'x', -T.rk);
  L(r.spine.rotation, 'x', 0); L(r.neck.rotation, 'x', g.settled ? 0 : (Math.random() - 0.5) * 0.6);
}

/** Bring a ragdolled character back to normal animation (they get up). */
export function endRagdoll(p) {
  const u = p.userData.u;
  if (!u.rag) return;
  const b = p.userData.rig.body;
  u.rag = null;
  // convert the tumble into the standard "lying down" pose so get-up blends from there
  b.rotation.order = 'XYZ';
  b.rotation.y = 0;
  b.rotation.z = 0;
  b.rotation.x = -1.45;
  b.position.y = -0.62;
}

/** Advance this character's animation. speed in yards/sec. */
export function animateRun(p, dt, speed) {
  if (!p.userData?.rig) return;
  const u = p.userData.u;
  p.userData.ticked = FRAME;
  if (dt > 0) {
    // turn rate (rad/s) and acceleration, smoothed, drive banking and leaning
    let dy = p.rotation.y - (u.prevYaw ?? p.rotation.y);
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    const k = Math.min(1, dt * 8);
    u.turn = (u.turn ?? 0) + (dy / dt - (u.turn ?? 0)) * k;
    u.accel = (u.accel ?? 0) + ((speed - (u.speed ?? 0)) / dt - (u.accel ?? 0)) * k;
    u.prevYaw = p.rotation.y;
  }
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
  u.celebrate = style ?? p.userData.look?.celebration ?? CELEBRATIONS[Math.floor(Math.random() * CELEBRATIONS.length)];
}
export function stopCelebrate(p) { p.userData.u.celebrate = null; }

/** Tackled: wrap, fall, then lie on the ground. knockDown(p, 0) gets them up again. */
export function knockDown(p, t = 1) {
  const u = p.userData.u;
  if (t <= 0) { endRagdoll(p); u.down = false; playAction(p, 'getup'); return; }
  u.celebrate = null;
  // a real stumble: tip over in a loose, physical way
  const a = Math.random() * Math.PI * 2;
  ragdoll(p, { x: Math.cos(a), z: Math.sin(a) }, 0.3);
}

/** A shove or collision: the body staggers sideways and the arms fly out for a moment. */
export function bump(p, dir = { x: 1, z: 0 }, strength = 1) {
  const u = p.userData.u;
  if (!u || u.rag || u.down) return;
  const yaw = p.rotation.y;
  const lx = dir.x * Math.cos(yaw) - dir.z * Math.sin(yaw);
  u.rzv = (u.rzv ?? 0) - lx * 4 * strength;
  u.hop = Math.max(u.hop, 0.05 * strength);
  const jv = (u.jv ??= {});
  jv[4] = (jv[4] ?? 0) + (Math.random() - 0.5) * 8 * strength;
  jv[7] = (jv[7] ?? 0) + (Math.random() - 0.5) * 8 * strength;
}

export function isDown(p) { return p.userData.u.down; }

export function setHop(p, h) { p.userData.u.hop = Math.max(p.userData.u.hop, h); }

// ------------------------------------------------------------------ ball & markers

export function makeBall() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(geo().ball, Object.assign(toon('#8b4513').clone(), { flatShading: true }));
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

/**
 * A short burst of pixel blood after a rough hit: small red voxels that arc out, fall,
 * and leave a few splats on the turf. Returns an updater (false when done).
 */
export function bloodBurst(scene, origin, dir = { x: 0, z: -1 }) {
  const n = 18;
  const geoB = new THREE.BoxGeometry(0.07, 0.07, 0.07);
  const mat = new THREE.MeshBasicMaterial({ color: '#b3001b' });
  const drops = new THREE.InstancedMesh(geoB, mat, n);
  const P = [];
  for (let i = 0; i < n; i++) P.push({ x: origin.x, y: origin.y, z: origin.z, vx: dir.x * 2 + (Math.random() - 0.5) * 3, vy: 1.5 + Math.random() * 2.5, vz: dir.z * 2 + (Math.random() - 0.5) * 3, landed: false });
  scene.add(drops);
  const splats = [];
  const splatMat = new THREE.MeshBasicMaterial({ color: '#8a0014', transparent: true, opacity: 0.85, depthWrite: false });
  const d = new THREE.Object3D();
  let life = 0;
  return (dt) => {
    life += dt;
    P.forEach((p, i) => {
      if (!p.landed) {
        p.vy -= 12 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y <= 0.03) {
          p.landed = true; p.y = 0.03;
          if (splats.length < 6 && Math.random() < 0.5) {
            const sp = new THREE.Mesh(new THREE.PlaneGeometry(0.12 + Math.random() * 0.18, 0.12 + Math.random() * 0.14), splatMat);
            sp.rotation.x = -Math.PI / 2; sp.position.set(p.x, 0.025, p.z);
            scene.add(sp); splats.push(sp);
          }
        }
      }
      d.position.set(p.x, p.landed ? -5 : p.y, p.z);
      d.updateMatrix();
      drops.setMatrixAt(i, d.matrix);
    });
    drops.instanceMatrix.needsUpdate = true;
    if (life > 1.6 && drops.parent) { scene.remove(drops); geoB.dispose(); }
    if (life > 6) { for (const sp of splats) { scene.remove(sp); sp.geometry.dispose(); } return false; }
    if (life > 4.5) splatMat.opacity = Math.max(0, 0.85 * (6 - life) / 1.5);
    return true;
  };
}

/** A puff of turf and dust where bodies hit the ground. Returns an updater (false when done). */
export function dustPuff(scene, origin, n = 12) {
  const geoD = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  const mesh = new THREE.InstancedMesh(geoD, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 }), n);
  const cols = ['#5a8f3c', '#3f7a33', '#b8a37a', '#d8cfb8'].map((c) => new THREE.Color(c));
  const P = [];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 1 + Math.random() * 2.5;
    P.push({ x: origin.x, y: 0.1, z: origin.z, vx: Math.cos(a) * sp, vy: 1.5 + Math.random() * 2.5, vz: Math.sin(a) * sp });
    mesh.setColorAt(i, cols[i % cols.length]);
  }
  scene.add(mesh);
  const d = new THREE.Object3D();
  let life = 0;
  return (dt) => {
    life += dt;
    P.forEach((p, i) => {
      p.vy -= 9 * dt; p.x += p.vx * dt; p.y = Math.max(0.05, p.y + p.vy * dt); p.z += p.vz * dt;
      p.vx *= 0.96; p.vz *= 0.96;
      d.position.set(p.x, p.y, p.z); d.scale.setScalar(Math.max(0.01, 1 - life * 0.9)); d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (life > 1.1) { scene.remove(mesh); geoD.dispose(); return false; }
    return true;
  };
}
