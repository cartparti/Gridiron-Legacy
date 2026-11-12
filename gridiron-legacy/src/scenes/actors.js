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
import { shade, mix, colorDist, luma } from '../data/kits.js';
import { GLYPHS } from '../data/mascots.js';

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
// ---- cache housekeeping ----
// Every play builds 22 new random players, and each unique face, head, hair and beard used to be cached
// forever. On phones (iPhone Safari above all) that filled the graphics memory after a few games and the
// 3D view froze when the next play loaded. Caches now remember when each entry was last used, and
// `sweepActorCaches()` (called before each play / cutscene) frees what the last play didn't use.
let cacheGen = 0;
const trackedCaches = [];
/** Map that stamps each entry with the generation it was last read or written in. */
function trackedMap(owned) {
  const m = new Map(); const gen = new Map();
  const get = m.get.bind(m), set = m.set.bind(m), has = m.has.bind(m);
  m.get = (k) => { if (has(k)) gen.set(k, cacheGen); return get(k); };
  m.set = (k, v) => { gen.set(k, cacheGen); return set(k, v); };
  trackedCaches.push({ m, gen, owned, isMap: true });
  return m;
}
/** Plain-object cache (obj[key], obj[key] ??= ...) with the same last-used stamps. */
function trackedObj() {
  const gen = new Map(); const t = {};
  const p = new Proxy(t, {
    get(o, k) { if (typeof k === 'string' && k in o) gen.set(k, cacheGen); return o[k]; },
    set(o, k, v) { gen.set(k, cacheGen); o[k] = v; return true; },
  });
  trackedCaches.push({ m: t, gen, isMap: false });
  return p;
}
function disposeCached(v, owned) {
  if (!v) return;
  if (Array.isArray(v)) { for (const x of v) disposeCached(x, owned); return; }
  if (v.isBufferGeometry) { v.dispose(); return; }
  if (v.isMaterial) {
    if (owned && v.map) {
      v.map.dispose();
      // Safari only gives canvas memory back when the canvas is emptied, not when it is garbage collected
      const img = v.map.image; if (img && typeof img.width === 'number' && img.getContext) { img.width = 0; img.height = 0; }
    }
    v.dispose(); return;
  }
  if (v.shell || v.extras) { disposeCached(v.shell); for (const e of v.extras ?? []) disposeCached(e.geo); }
}
/**
 * Free cached textures, materials and geometry that weren't used in the last `keep` generations.
 * Call between plays: anything still on screen gets re-uploaded by three.js if it is ever drawn again.
 */
export function sweepActorCaches(keep = 1) {
  cacheGen++;
  let freed = 0;
  for (const c of trackedCaches) {
    for (const [k, g] of c.gen) {
      if (g >= cacheGen - keep) continue;
      const v = c.isMap ? c.m.get(k) : c.m[k];
      if (c.isMap) c.m.delete(k); else delete c.m[k];
      c.gen.delete(k);
      disposeCached(v, c.owned);
      freed++;
    }
  }
  return freed;
}
/** Number of live cache entries (for tests and debugging). */
export const actorCacheSize = () => trackedCaches.reduce((n, c) => n + c.gen.size, 0);

const matCache = trackedMap(false);
/** Shaded material for a flat color (name kept from the cel-shaded days). Realistic, slightly soft fabric/skin. */
export function toon(color, rough = 0.72) {
  const key = `${color}|${rough}`;
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 }));
  return matCache.get(key);
}
/**
 * Skin: a soft warm sheen at glancing angles and a hint of gloss read as living skin; plain matte read as clay.
 * A touch of warm emissive keeps shadows from going grey (cheap stand-in for light scattering under the skin).
 */
// Fine pores and uneven shine: perfectly smooth skin is what made people read as plastic or clay.
let skinDetail = null;
function skinDetailTex() {
  if (skinDetail || typeof document === 'undefined') return skinDetail;
  const N = 256; const c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
  let seed = 5; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#808080'; g.fillRect(0, 0, N, N);
  for (let i = 0; i < 9000; i++) { const v = (100 + rnd() * 70) | 0; g.fillStyle = `rgba(${v},${v},${v},0.35)`; g.beginPath(); g.arc(rnd() * N, rnd() * N, 0.5 + rnd() * 1.1, 0, 7); g.fill(); }
  for (let i = 0; i < 60; i++) { const v = (120 + rnd() * 30) | 0; const gr = g.createRadialGradient(0, 0, 0, 0, 0, 30); gr.addColorStop(0, `rgba(${v},${v},${v},0.25)`); gr.addColorStop(1, 'rgba(128,128,128,0)'); g.save(); g.translate(rnd() * N, rnd() * N); g.fillStyle = gr; g.fillRect(-30, -30, 60, 60); g.restore(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3);
  return (skinDetail = t);
}
// Phones during plays: players are small on screen, so skip the sheen / clearcoat / pore bump (the most expensive
// part of the skin shader). Portraits and cutscenes keep the full look.
let LITE = false;
export function setLiteMaterials(on) { LITE = !!on; }
function skinPhys(params) {
  if (LITE) return new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0, ...params });
  const d = skinDetailTex();
  return new THREE.MeshPhysicalMaterial({ roughness: 0.52, metalness: 0, sheen: 0.45, sheenRoughness: 0.5, sheenColor: new THREE.Color('#ff9478'), clearcoat: 0.12, clearcoatRoughness: 0.42,
    ...(d ? { bumpMap: d, bumpScale: 0.3 } : {}), ...params });
}
export function skinMat(color) {
  const key = `skin2|${color}${LITE ? '|lite' : ''}`;
  if (!matCache.has(key)) matCache.set(key, skinPhys({ color, emissive: new THREE.Color(color).multiplyScalar(0.07) }));
  return matCache.get(key);
}
/** Shiny / metallic variants (helmets, facemasks, chains). */
export function shiny(color, { rough = 0.28, metal = 0 } = {}) {
  const key = `shiny|${color}|${rough}|${metal}`;
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }));
  return matCache.get(key);
}

const texCache = trackedMap(true);
/** Pixel texture: draw(g, w, h) on a tiny canvas; cached by key. Returns a toon material. */
// Textures are drawn on a small logical grid (w x h) and then rendered smooth:
//   crisp (default): drawn at TEX_SCALE x, so stripes and numbers have clean, sharp edges;
//   soft: drawn small then upscaled with smoothing (hair, skin, tattoos look organic, not blocky).
const TEX_SCALE = 6;
function pixMat(key, w, h, draw, { transparent = false, soft = false, rough = 0.72, metal = 0, skin = false, scale = TEX_SCALE } = {}) {
  if (skin && LITE) key += '|lite';
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = w * scale;
  c.height = h * scale;
  const g = c.getContext('2d');
  if (!g) return toon('#888888', rough); // no canvas memory left (Safari): a plain material instead of a crash
  if (soft) {
    const small = document.createElement('canvas');
    small.width = w; small.height = h;
    const sg = small.getContext('2d');
    draw(sg, w, h);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(small, 0, 0, c.width, c.height);
  } else {
    g.scale(scale, scale);
    draw(g, w, h);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  const m = skin ? skinPhys({ map: t, emissiveMap: t, emissive: new THREE.Color(0.07, 0.07, 0.07) })
    : new THREE.MeshStandardMaterial({ map: t, roughness: rough, metalness: metal, transparent, alphaTest: transparent ? 0.5 : 0 });
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
/** Head shapes: proportions (w, h, d), corner rounding, jaw taper. Real heads are taller and deeper than wide. */
// (v0.35: a little shorter and less rounded: tall, soft heads read as pudgy balloons)
const HEAD_DIMS = { oval: [0.3, 0.375, 0.335, 0.1, 0.74], round: [0.315, 0.36, 0.34, 0.12, 0.84], square: [0.31, 0.375, 0.33, 0.08, 0.92],
  long: [0.29, 0.405, 0.33, 0.095, 0.74], wide: [0.325, 0.36, 0.34, 0.095, 0.86], heart: [0.305, 0.375, 0.33, 0.1, 0.62] };
const headCache = trackedObj();
const EYE_COLS = [3.1, 8.9]; // eye centres on the 12-wide face texture (wider set than before: features were bunched up)
const gss = (dx, dy, sx, sy) => Math.exp(-(dx * dx) / (2 * sx * sx) - (dy * dy) / (2 * sy * sy));
const sst = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
/**
 * Taubin smoothing (shrink-free): blends the sculpted features into one continuous surface so no combination of
 * choices leaves a lump, crease or step. Vertices that share a position (box seams) move together.
 */
function blendSurface(g, iters) {
  if (!iters) return;
  const pos = g.attributes.position; const idx = g.index; if (!idx) return;
  const id = new Int32Array(pos.count); const keyId = new Map(); let n = 0;
  for (let i = 0; i < pos.count; i++) { const k = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`; let v = keyId.get(k); if (v === undefined) { v = n++; keyId.set(k, v); } id[i] = v; }
  const P = new Float64Array(n * 3); for (let i = 0; i < pos.count; i++) { P[id[i] * 3] = pos.getX(i); P[id[i] * 3 + 1] = pos.getY(i); P[id[i] * 3 + 2] = pos.getZ(i); }
  const nb = Array.from({ length: n }, () => new Set());
  for (let t = 0; t < idx.count; t += 3) { const a = id[idx.getX(t)], b = id[idx.getX(t + 1)], c = id[idx.getX(t + 2)]; nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b); }
  const N = nb.map((s) => [...s]); const Q = new Float64Array(n * 3);
  const step = (lam) => {
    for (let v = 0; v < n; v++) { const L = N[v]; if (!L.length) continue; let sx = 0, sy = 0, sz = 0; for (const u of L) { sx += P[u * 3]; sy += P[u * 3 + 1]; sz += P[u * 3 + 2]; } const k = 1 / L.length;
      Q[v * 3] = P[v * 3] + lam * (sx * k - P[v * 3]); Q[v * 3 + 1] = P[v * 3 + 1] + lam * (sy * k - P[v * 3 + 1]); Q[v * 3 + 2] = P[v * 3 + 2] + lam * (sz * k - P[v * 3 + 2]); }
    P.set(Q);
  };
  for (let i = 0; i < iters; i++) { step(0.5); step(-0.53); }
  for (let i = 0; i < pos.count; i++) pos.setXYZ(i, P[id[i] * 3], P[id[i] * 3 + 1], P[id[i] * 3 + 2]);
}
/** Average normals of vertices that share a position, so the seams of the box faces never show. */
function smoothSeams(g) {
  const pos = g.attributes.position; const nor = g.attributes.normal; const acc = new Map();
  for (let i = 0; i < pos.count; i++) {
    const k = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
    const a = acc.get(k) ?? [0, 0, 0, []]; a[0] += nor.getX(i); a[1] += nor.getY(i); a[2] += nor.getZ(i); a[3].push(i); acc.set(k, a);
  }
  for (const [x, y, z, ids] of acc.values()) { const l = Math.hypot(x, y, z) || 1; for (const i of ids) nor.setXYZ(i, x / l, y / l, z / l); }
}
/**
 * A sculpted human head: skull (occiput, sloped forehead, temples, the nape tucked in for the neck, a jaw angle)
 * and a face (brow ridge, eye sockets, nose bridge/tip/nostrils, cheekbones, muzzle, lips, chin) lined up with the
 * painted face texture. Keeps the six face groups + UVs of a box so the face/side/top/back materials still map.
 */
// Per-person face build. Old looks without these get a stable pick from their other features (so they're unique too).
const JAW_K = { // lift: how flat/high the underside of the jaw is (no double chin); steep: where it meets the neck;
  // angle: jaw width under the ears; vee: extra taper toward the chin
  defined: { lift: 0.85, steep: -0.42, angle: 1.04, vee: 0.06 }, sharp: { lift: 1, steep: -0.3, angle: 0.94, vee: 0.2 },
  square: { lift: 0.9, steep: -0.45, angle: 1.2, vee: -0.1 }, soft: { lift: 0.65, steep: -0.55, angle: 1.06, vee: -0.02 },
};
const CHEEK_K = { normal: { bone: 1, hollow: 1, y: 6.9 }, high: { bone: 1.5, hollow: 1.3, y: 6.55 }, chiseled: { bone: 1.45, hollow: 1.9, y: 6.75 } };
const CHIN_K = { normal: { size: 1, wide: 1, down: 0 }, strong: { size: 1.5, wide: 1.3, down: 0.01 }, pointed: { size: 1.15, wide: 0.75, down: 0.018 }, small: { size: 0.5, wide: 0.85, down: -0.01 } };
const FACEW_K = { narrow: 0.9, normal: 1, broad: 1.09 };
const NOSE_K = { small: { len: 0.85, wide: 0.9, tip: 0.85 }, wide: { len: 1, wide: 1.25, tip: 1.0 }, long: { len: 1.25, wide: 0.92, tip: 1.1 } };
function faceParams(L) {
  let hsh = 0; for (const ch of `${L.skin}|${L.eyes}|${L.brows}|${L.mouth}|${L.hairStyle}|${L.eyeColor}|${L.headShape}`) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
  const pick = (list, salt) => list[((hsh >>> salt) ^ (hsh * (salt + 7))) % list.length >>> 0];
  const fem = L.gender === 'f';
  return {
    jaw: JAW_K[L.jaw] ? L.jaw : pick(fem ? ['defined', 'sharp', 'soft'] : ['defined', 'sharp', 'square', 'defined'], 3),
    cheek: CHEEK_K[L.cheek] ? L.cheek : pick(['normal', 'high', 'chiseled', 'normal'], 7),
    chin: CHIN_K[L.chin] ? L.chin : pick(fem ? ['normal', 'pointed', 'small'] : ['normal', 'strong', 'pointed', 'strong'], 11),
    faceW: FACEW_K[L.faceW] ? L.faceW : pick(['narrow', 'normal', 'normal', 'broad'], 15),
    nose: NOSE_K[L.nose] ? L.nose : 'small',
    fs: fsOf(L),
  };
}
// Face sliders (-1..1, the Face tab's "Fine tune"); rounded to tenths so cached heads are shared.
export const FACE_SLIDERS = ['browH', 'eyeSize', 'eyeSpace', 'eyeTilt', 'noseW', 'noseL', 'lips', 'jawW', 'cheekS', 'chinS', 'neck'];
const fsOf = (L) => { const o = {}; for (const k of FACE_SLIDERS) { const v = Number(L?.fs?.[k]) || 0; o[k] = Math.max(-1, Math.min(1, Math.round(v * 10) / 10)); } return o; };
const fsKey = (fs) => (fs ? FACE_SLIDERS.map((k) => fs[k] || 0).join(',') : '');
const eyeCols = (fs) => { const d = 0.35 * (fs?.eyeSpace ?? 0); return [EYE_COLS[0] - d, EYE_COLS[1] + d]; };
const fpKey = (fp) => `${fp.jaw}|${fp.cheek}|${fp.chin}|${fp.faceW}|${fp.nose}|${fsKey(fp.fs)}`;
const FP0 = { jaw: 'defined', cheek: 'normal', chin: 'normal', faceW: 'normal', nose: 'small' };
function headGeo(shape = 'oval', seg = 6, sex = 'm', fp = FP0) {
  const ck = `${shape}|${seg}|${sex}|${fpKey(fp)}`;
  const fs = fp.fs ?? fsOf(null);
  const J0 = JAW_K[fp.jaw] ?? JAW_K.defined, CK0 = CHEEK_K[fp.cheek] ?? CHEEK_K.normal, CH0 = CHIN_K[fp.chin] ?? CHIN_K.normal, NK0 = NOSE_K[fp.nose] ?? NOSE_K.small;
  // combined choices + sliders are clamped to a human range (stacked extremes made spiky chins, pitted cheeks, flared jaws)
  const clamp = (v, a, b2) => Math.max(a, Math.min(b2, v));
  const J = { ...J0, angle: clamp(J0.angle * (1 + 0.08 * fs.jawW), 0.88, 1.2) };
  const CK = { ...CK0, bone: clamp(CK0.bone * (1 + 0.5 * fs.cheekS), 0.5, 1.9), hollow: clamp(CK0.hollow * (1 + 0.3 * fs.cheekS), 0.5, 2.3) };
  const CH = { ...CH0, size: clamp(CH0.size * (1 + 0.45 * fs.chinS), 0.3, 1.7), down: clamp(CH0.down + 0.006 * fs.chinS, -0.015, 0.025) };
  const NK = { len: NK0.len * (1 + 0.25 * fs.noseL), wide: NK0.wide * (1 + 0.25 * fs.noseW), tip: NK0.tip * (1 + 0.15 * fs.noseL) };
  const FW = FACEW_K[fp.faceW] ?? 1, EC = eyeCols(fs), LIP = 1 + 0.6 * fs.lips, BROW = -0.45 * fs.browH;
  if (headCache[ck]) return headCache[ck];
  const [w, h, d, r, jaw] = HEAD_DIMS[shape] ?? HEAD_DIMS.oval;
  const b = softBox(w, h, d, r, seg);
  const pos = b.attributes.position;
  const hw = w / 2, hh = h / 2, hd = d / 2;
  const fem = sex === 'f';
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), yy = pos.getY(i), z = pos.getZ(i);
    const y = yy / hh; // -1 chin .. 1 crown
    // the sides of the face come down fairly straight to a jaw angle, then turn in to the chin (a steady taper all the
    // way down made a soft, round lower face)
    if (y < 0.1) {
      const lin = Math.min(1, (0.1 - y) / 1.1);
      const t = fem ? lin : 0.4 * lin + 0.75 * sst(-0.42, -1.0, y);
      x *= 1 - (1 - jaw) * t;
    }
    if (y < -0.3) z *= 1 - (-0.3 - y) * 0.12;
    // round the cranium toward an ellipsoid (back and top); the face stays flatter for the features
    const back = z > 0 ? Math.min(1, z / hd) : 0;
    // the face wraps around too (a flat front read as a mask strapped to an egg); the centre stays put
    // ...but only side to side (a cylinder), so the chin and mouth keep their place in profile instead of being
    // pulled back toward the middle of the head (that receding chin made a beak-like muzzle)
    const fwrap = z < 0 ? 0.18 * Math.min(1, -z / hd) : 0;
    const k = Math.min(1, back * 0.7 + Math.max(0, y) * 0.5 * (z > 0 ? 1 : 0.6));
    if (k > 0) {
      const ex = x / hw, ey = yy / hh, ez = z / hd; const len = Math.hypot(ex, ey, ez) || 1;
      x += (ex / len * hw - x) * k * 0.6; yy += (ey / len * hh - yy) * k * 0.35; z += (ez / len * hd - z) * k * 0.6;
    }
    if (fwrap > 0) {
      const ex = x / hw, ez = z / hd; const l2 = Math.hypot(ex, ez) || 1;
      x += (ex / l2 * hw - x) * fwrap; z += (ez / l2 * hd - z) * fwrap;
    }
    // ---- skull
    const X = x / hw, Y = yy / hh, Z = z / hd;
    const lowBack = sst(-0.15, 0.75, Z) * sst(0.05, -0.85, Y);
    z -= lowBack * hd * 0.2; yy += lowBack * hh * 0.05; // the nape tucks in: room for the neck behind the jaw
    z += sst(0.25, 1, Z) * Math.exp(-((Y - 0.2) ** 2) / 0.16) * hd * 0.08; // occiput
    z += sst(0.25, 1, Y) * sst(0, -1, Z) * hd * 0.07; // forehead slopes back to the crown
    x *= 1 - 0.07 * Math.exp(-((Y - 0.28) ** 2) / 0.05) * sst(0.3, -0.7, Z); // temples
    x *= 1 + ((fem ? 0.97 : 1.0) * J.angle - 1) * 0.7 * gss(Y + 0.55, Z + 0.1, 0.24, 0.65); // jaw width (cheek to ear), kept narrower than the cheekbones
    x *= 1 - J.vee * sst(-0.35, -1, Y) * sst(0.3, -0.9, Z); // taper toward the chin
    // the underside of the jaw: one clean slanted plane from the chin back to the neck (no double chin)
    {
      const Zn = z / hd, Yn = yy / hh;
      if (Yn < 0 && Zn > -0.95) {
        // human profile: the jawline runs nearly level from the chin back to a jaw angle under the ear, then the back
        // of the jaw rises steeply to the skull base (one long slope from chin to occiput read as an insect's head)
        const floor = -1 + 0.2 * sst(-0.85, -0.05, Zn) + (0.5 + 0.15 * (J.steep + 0.42)) * sst(-0.05, 0.38, Zn);
        if (Yn < floor) yy += (floor - Yn) * hh * J.lift;
      }
    }
    x *= FW;
    pos.setXYZ(i, x, yy, z);
  }
  // ---- face, placed by the texture's own coordinates (12 x 12 grid: eyes at row 5.7, mouth 9.3)
  const n = (seg + 1) * (seg + 1);
  const uv = b.attributes.uv; const nor = b.attributes.normal;
  const disp = new Float32Array(pos.count);
  const sw = (v, m, f) => (fem ? f : m) * v;
  for (let i = 5 * n; i < 6 * n; i++) {
    const cx = uv.getX(i) * 12, cy = (1 - uv.getY(i)) * 12;
    let f = 0;
    f += sw(gss(cx - 6, cy - 4.75 - BROW, 3.0, 0.5), 0.018, 0.008); // brow ridge
    f += 0.004 * gss(cx - 6, cy - 3.2, 3.6, 1.2); // forehead
    for (const ex of EC) f -= 0.014 * gss(cx - ex, cy - 5.75, 1.55, 0.85); // eye sockets
    // nose (from the head references): a straight bridge from between the eyes down to a rounded tip, sides that read
    // as planes (not a soft bump), wings at the base, and an underside that tucks back to the lip
    {
      const tipY = 7.5 + 0.35 * (NK.len - 1), rootY = 4.75;
      const t = Math.max(0, Math.min(1, (cy - rootY) / (tipY - rootY)));
      const proj = (fem ? 0.029 : 0.036) * (0.45 + 0.55 * Math.pow(t, 1.25)) * (0.9 + 0.1 * NK.tip); // the root sits out level with the brow, so the bridge runs straight up into it
      const W = (0.4 + 0.42 * t) * NK.wide, dx = Math.abs(cx - 6);
      const ridge = sst(W, W * 0.2, dx);
      const top = sst(4.2, 4.8, cy), under = 1 - sst(tipY - 0.2, tipY + 0.75, cy);
      f += proj * ridge * top * under;
      f += (fem ? 0.008 : 0.01) * NK.tip * gss(cx - 6, cy - tipY, 0.52 * NK.wide, 0.55); // the ball of the tip (rounded, not a point)
      for (const sd of [-1, 1]) f += (fem ? 0.01 : 0.013) * NK.wide * gss(cx - 6 - sd * 0.82 * NK.wide, cy - tipY - 0.28, 0.36 * NK.wide, 0.34); // wings
    }
    for (const sd of [-1, 1]) f += sw(gss(cx - 6 - sd * 3.4, cy - CK.y, 1.3, 0.8), 0.012, 0.011) * CK.bone; // cheekbones
    for (const sd of [-1, 1]) f -= (fem ? 0.004 : 0.008) * CK.hollow * gss(cx - 6 - sd * 3.9, cy - 9.3, 0.85, 1.0); // hollows under them, out toward the jaw
    f += 0.006 * gss(cx - 6, cy - 9.3, 1.9, 0.9); // muzzle
    f += sw(gss(cx - 6, cy - 8.65, 1.5, 0.75), 0.013, 0.011); // the upper-lip area between nose and mouth (no deep notch under the nose)
    for (const sd of [-1, 1]) f += 0.004 * gss(cx - 6 - sd * 2.7, cy - 8.3, 1.5, 1.5); // cheeks come forward beside the mouth, so the middle doesn't jut out alone
    f += sw(gss(cx - 6, cy - 9.12, 1.55, 0.26), 0.008, 0.01) * LIP; // upper lip
    f += sw(gss(cx - 6, cy - 9.8, 1.3, 0.3), 0.01, 0.012) * LIP; // lower lip
    f -= 0.004 * gss(cx - 6, cy - 9.45, 1.7, 0.1); // the line between them
    f -= 0.0022 * gss(cx - 6, cy - 10.4, 1.3, 0.4); // a soft dip above the chin (a narrow one read as a crease)
    f += sw(gss(cx - 6, cy - 11.0 - CH.down * 20, 1.45 * CH.wide, 0.95), 0.03, 0.017) * CH.size; // chin (projects forward: a receding chin read as weak and soft)
    disp[i] = f;
  }
  // coincident vertices (box-face seams) share the front face's value so nothing cracks
  const key = (i) => `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
  const byPos = new Map();
  for (let i = 5 * n; i < 6 * n; i++) byPos.set(key(i), disp[i]);
  for (let i = 0; i < pos.count; i++) {
    const f = i >= 5 * n && i < 6 * n ? disp[i] : byPos.get(key(i)) ?? 0;
    if (!f) continue;
    // push forward (out of the face), blended with the surface normal on curved parts
    const nx = nor.getX(i) * 0.4, ny = nor.getY(i) * 0.4, nz = nor.getZ(i) * 0.4 - 0.6;
    const l = Math.hypot(nx, ny, nz) || 1;
    pos.setXYZ(i, pos.getX(i) + (nx / l) * f, pos.getY(i) + (ny / l) * f, pos.getZ(i) + (nz / l) * f);
  }
  blendSurface(b, Math.round(2 * (seg / 40) ** 2));
  b.computeVertexNormals();
  smoothSeams(b);
  b.computeBoundingBox();
  // where the eyes sit: the socket centres (face texture col 3.5 / 8.5, row 5.75)
  b.userData.eyes = EC.map((col) => {
    let best = 5 * n, bd = 1e9;
    for (let i = 5 * n; i < 6 * n; i++) { const du = uv.getX(i) * 12 - col, dv = (1 - uv.getY(i)) * 12 - 5.75; const dd = du * du + dv * dv; if (dd < bd) { bd = dd; best = i; } }
    return [pos.getX(best), pos.getY(best), pos.getZ(best)];
  });
  headCache[ck] = b;
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
/**
 * Tattoos as real ink art (vector, soft-edged), painted on the limb's wrap-around texture. Region x0..x0+w wraps all
 * the way round the limb (front at the middle), y0..y0+h runs down it. `aspect` = how much wider one texture unit
 * is around the limb than along it (arms ~2.4), so designs keep their proportions.
 */
const INK_C = 'rgba(26,32,46,0.86)';
function drawTattoo(g, style, x0, y0, w, h, { aspect = 2.4, seed = 1, skin = '#e0ab7f', size = 1 } = {}) {
  if (!style || style === 'none') return;
  const cx = x0 + w / 2, cy = y0 + h / 2;
  g.save();
  g.beginPath(); g.rect(x0, y0, w, h); g.clip();
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.shadowColor = 'rgba(26,32,46,0.35)'; g.shadowBlur = 2.5; // ink bleeds a little into the skin
  h /= size; // designs that use the region height work in the scaled units
  const ink = (a = 1) => { g.fillStyle = INK_C; g.strokeStyle = INK_C; g.globalAlpha = a; };
  // draw in "true shape" units (1 unit = one texture row) centred on the front of the limb
  const local = (fn, ox = 0, oy = 0) => { g.save(); g.translate(cx + ox / aspect, cy + oy); g.scale(size / aspect, size); fn(); g.restore(); };
  const star5 = (r, inner = 0.42) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rr = i % 2 ? r * inner : r; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); };
  const W = w * aspect; // full way round, in true units
  ink();
  if (style === 'band') {
    // a tribal armband all the way round: two lines with interlocking teeth between
    g.save(); g.translate(x0, y0 + 1.2); g.scale(1 / aspect, 1);
    g.lineWidth = 0.28; g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.moveTo(0, 2.2); g.lineTo(W, 2.2); g.stroke();
    const n = Math.round(W / 1.3);
    for (let i = 0; i < n; i++) { const x = (i / n) * W; g.beginPath(); g.moveTo(x, 0.2); g.lineTo(x + W / n * 0.5, 1.6); g.lineTo(x + W / n, 0.2); g.closePath(); g.fill(); g.beginPath(); g.moveTo(x + W / n * 0.5, 2.0); g.lineTo(x + W / n, 0.9); g.lineTo(x + W / n * 1.5, 2.0); g.closePath(); g.fill(); }
    g.restore();
  } else if (style === 'tribal') {
    local(() => {
      const thorn = (x, y, len, ang, wid) => { g.save(); g.translate(x, y); g.rotate(ang); g.beginPath(); g.moveTo(0, -wid); g.quadraticCurveTo(len * 0.55, -wid * 1.2, len, 0); g.quadraticCurveTo(len * 0.5, wid * 0.2, 0, wid); g.closePath(); g.fill(); g.restore(); };
      for (const sd of [-1, 1]) { thorn(0, -h * 0.3, 4.2, sd > 0 ? 0.35 : Math.PI - 0.35, 0.55); thorn(0, 0, 5, sd > 0 ? -0.25 : Math.PI + 0.25, 0.7); thorn(0, h * 0.28, 3.6, sd > 0 ? 0.6 : Math.PI - 0.6, 0.5); }
      g.beginPath(); g.ellipse(0, 0, 0.9, 1.6, 0, 0, Math.PI * 2); g.fill();
    });
  } else if (style === 'sleeve') {
    // full sleeve: Japanese-style waves and wind bars over soft grey shading
    const sh = g.createLinearGradient(0, y0, 0, y0 + h); sh.addColorStop(0, 'rgba(26,32,46,0.32)'); sh.addColorStop(0.5, 'rgba(26,32,46,0.12)'); sh.addColorStop(1, 'rgba(26,32,46,0.3)');
    g.fillStyle = sh; g.fillRect(x0, y0, w, h);
    g.save(); g.translate(x0, y0); g.scale(1 / aspect, 1);
    g.lineWidth = 0.22;
    for (let row = 0; row < h / 1.6 + 1; row++) {
      const y = row * 1.6 + 0.6, off = row % 2 ? 0.9 : 0;
      for (let x = -2 + off; x < W + 2; x += 1.8) { g.beginPath(); g.arc(x, y, 0.9, Math.PI, 0); g.stroke(); g.beginPath(); g.arc(x, y, 0.5, Math.PI, 0); g.stroke(); }
    }
    g.lineWidth = 0.4; for (const y of [h * 0.33, h * 0.7]) { g.beginPath(); g.moveTo(W * 0.15, y); g.bezierCurveTo(W * 0.35, y - 1.2, W * 0.6, y + 1.2, W * 0.85, y); g.stroke(); }
    g.restore();
  } else if (style === 'stars') {
    local(() => {
      for (const [x, y, r] of [[-1.6, -h * 0.28, 1.25], [1.8, -h * 0.02, 0.95], [-0.6, h * 0.26, 1.1]]) {
        g.save(); g.translate(x, y);
        star5(r); g.lineWidth = 0.16; g.stroke();
        // nautical star: alternate halves filled
        for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); g.lineTo(Math.cos(a + Math.PI / 5) * r * 0.42, Math.sin(a + Math.PI / 5) * r * 0.42); g.closePath(); g.fill(); }
        g.restore();
      }
    });
  } else if (style === 'script') {
    // a word written down the inside of the arm
    const words = ['Loyalty', 'Blessed', 'Family', 'Legacy', 'Faith'];
    local(() => { g.rotate(Math.PI / 2); g.font = `italic 600 ${Math.min(2.2, w * aspect * 0.12)}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(words[seed % words.length], 0, 0); });
  } else if (style === 'cross') {
    local(() => {
      g.lineWidth = 0.12;
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.beginPath(); g.moveTo(Math.cos(a) * 1.4, Math.sin(a) * 1.4 - 0.8); g.lineTo(Math.cos(a) * 3, Math.sin(a) * 3 - 0.8); g.stroke(); }
      g.fillRect(-0.45, -3.6, 0.9, 7); g.fillRect(-1.9, -1.9, 3.8, 0.9);
      g.globalAlpha = 0.5; g.fillStyle = '#f2e9dc'; g.fillRect(-0.15, -3.2, 0.3, 6.2); g.globalAlpha = 1;
    });
  } else if (style === 'flames') {
    // flames licking up from the wrist (bottom of the region), round the front of the arm
    g.save(); g.translate(x0, y0); g.scale(1 / aspect, 1);
    const n = 7;
    for (let i = 0; i < n; i++) {
      const x = W * (0.12 + 0.76 * i / (n - 1)), top = h * (0.25 + 0.3 * ((i * 37 + seed) % 5) / 5);
      for (const [col, k] of [['rgba(214,72,30,0.8)', 1], ['rgba(236,160,58,0.85)', 0.62]]) {
        g.fillStyle = col; g.beginPath(); g.moveTo(x - 1.1 * k, h); g.quadraticCurveTo(x - 1.2 * k, top + (h - top) * 0.45, x + 0.3 * k, top + (h - top) * (1 - k) * 0.6);
        g.quadraticCurveTo(x + 0.2 * k, top + (h - top) * 0.55, x + 1.1 * k, h); g.closePath(); g.fill();
      }
    }
    ink(); g.lineWidth = 0.14; g.globalAlpha = 0.9;
    for (let i = 0; i < n; i++) { const x = W * (0.12 + 0.76 * i / (n - 1)), top = h * (0.25 + 0.3 * ((i * 37 + seed) % 5) / 5); g.beginPath(); g.moveTo(x - 1.1, h); g.quadraticCurveTo(x - 1.2, top + (h - top) * 0.45, x + 0.3, top); g.quadraticCurveTo(x + 0.2, top + (h - top) * 0.55, x + 1.1, h); g.stroke(); }
    g.restore();
  } else if (style === 'skull') {
    local(() => {
      g.beginPath(); g.ellipse(0, -0.6, 2.1, 2.2, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.roundRect?.(-1.25, 0.9, 2.5, 1.5, 0.4); if (!g.roundRect) g.rect(-1.25, 0.9, 2.5, 1.5); g.fill();
      // eye sockets, nose and the gaps between the teeth show skin through the ink
      g.shadowBlur = 0; g.globalAlpha = 1; g.fillStyle = skin;
      for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(sd * 0.85, -0.5, 0.62, 0.72, 0, 0, Math.PI * 2); g.fill(); }
      g.beginPath(); g.moveTo(0, 0.25); g.lineTo(-0.3, 0.85); g.lineTo(0.3, 0.85); g.closePath(); g.fill();
      for (let i = -2; i <= 2; i++) g.fillRect(i * 0.48 - 0.06, 1.55, 0.12, 0.85);
      g.globalAlpha = 0.5; for (let i = -2; i <= 2; i++) g.fillRect(i * 0.5 - 0.18, 1.1, 0.36, 0.18);
    });
  } else if (style === 'wings') {
    local(() => {
      for (const sd of [-1, 1]) for (let i = 0; i < 5; i++) {
        g.save(); g.scale(sd, 1); g.translate(0.5, -0.6 + i * 0.75); g.rotate(-0.35 + i * 0.16);
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(2.6 - i * 0.25, -0.9, 4.4 - i * 0.55, -0.15); g.quadraticCurveTo(2.4 - i * 0.2, 0.35, 0, 0.45); g.closePath(); g.fill();
        g.restore();
      }
    });
  } else if (style === 'rose') {
    local(() => {
      g.fillStyle = 'rgba(54,112,62,0.85)';
      for (const [x, y, r] of [[-1.7, 1.4, 0.6], [1.6, 1.8, -0.5]]) { g.save(); g.translate(x, y); g.rotate(r); g.beginPath(); g.ellipse(0, 0, 1.2, 0.5, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
      g.fillRect(-0.12, 1, 0.24, h * 0.4);
      g.fillStyle = 'rgba(178,32,42,0.88)'; g.beginPath(); g.arc(0, -0.2, 1.7, 0, Math.PI * 2); g.fill();
      ink(); g.lineWidth = 0.14;
      for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(0, -0.2, 0.35 + i * 0.36, i * 1.3, i * 1.3 + Math.PI * 1.35); g.stroke(); }
      g.beginPath(); g.arc(0, -0.2, 1.7, 0, Math.PI * 2); g.stroke();
    });
  } else if (style === 'numbers') {
    local(() => {
      g.font = `900 ${Math.min(4.4, h * 0.55)}px Impact, 'Arial Black', sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const txt = String(10 + (seed % 89));
      g.lineWidth = 0.3; g.strokeText(txt, 0, 0); g.globalAlpha = 0.35; g.fillText(txt, 0, 0);
    });
  } else if (style === 'geo') {
    local(() => {
      g.lineWidth = 0.13;
      for (let ring = 1; ring <= 3; ring++) { g.beginPath(); for (let i = 0; i <= 6; i++) { const a = i * Math.PI / 3 + ring * 0.26; g.lineTo(Math.cos(a) * ring * 1.05, Math.sin(a) * ring * 1.05); } g.stroke(); }
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 3.3, Math.sin(a) * 3.3); g.stroke(); }
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6; g.beginPath(); g.arc(Math.cos(a) * 2.2, Math.sin(a) * 2.2, 0.28, 0, Math.PI * 2); g.fill(); }
    });
  } else if (style === 'koi') {
    local(() => {
      g.save(); g.rotate(0.5);
      g.fillStyle = 'rgba(226,112,42,0.88)'; g.beginPath(); g.ellipse(0, 0, 1.2, 3, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(0, 2.6); g.quadraticCurveTo(-1.6, 4.4, -1.2, 4.6); g.quadraticCurveTo(0, 3.8, 1.2, 4.6); g.quadraticCurveTo(1.6, 4.4, 0, 2.6); g.fill();
      g.fillStyle = 'rgba(245,240,230,0.8)'; g.beginPath(); g.ellipse(0.3, -0.8, 0.5, 0.9, 0, 0, Math.PI * 2); g.fill();
      ink(); g.lineWidth = 0.12;
      g.beginPath(); g.ellipse(0, 0, 1.2, 3, 0, 0, Math.PI * 2); g.stroke();
      for (let y = -1.6; y < 2.2; y += 0.6) { g.beginPath(); g.arc(0, y, 0.7, 0.3, Math.PI - 0.3); g.stroke(); }
      g.beginPath(); g.arc(-0.45, -2.2, 0.16, 0, Math.PI * 2); g.fill();
      g.restore();
      g.strokeStyle = 'rgba(58,111,181,0.75)'; g.lineWidth = 0.2;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(-2.6 + i * 2.4, 4.4, 1.1, Math.PI, 0); g.stroke(); }
    });
  }
  g.restore();
}
function neckMat(skin, tat) {
  // neck: wraps round the neck (front at the middle), rows run down it; designs sit on the side of the neck
  return pixMat(`neck2|${skin}|${tat}`, 6, 4, (g) => {
    px(g, 0, 0, skin, 6, 4);
    if (!tat || tat === 'none') return;
    g.save(); g.translate(-1.2, 0); // shift toward the side of the neck
    if (tat === 'script') { g.translate(0, 0.4); drawTattoo(g, 'script', 1.8, 1.4, 2.4, 2.2, { aspect: 1, seed: skin.length, skin, size: 0.6 }); }
    else if (tat === 'stars') drawTattoo(g, 'stars', 1.6, 1.3, 2.8, 2.4, { aspect: 1.1, skin, size: 0.55 });
    else drawTattoo(g, tat, 1.6, 1.2, 2.8, 2.6, { aspect: 1.1, skin, size: 0.5 });
    g.restore();
  }, { skin: true, scale: 32 });
}

// ---- head textures (12x12 pixels per face)
const HAIR_FRONT = { bald: 0, buzz: 1, short: 2, fade: 2, flattop: 2, curly: 3, afro: 3, mohawk: 0, dreads: 3, braids: 2, long: 3, bun: 2, twists: 3, cornrows: 1, undercut: 2, pompadour: 2, spiky: 2, ponytail: 2, waves: 1, frohawk: 0, slick: 1 };
const HAIR_BACK = { bald: 0, buzz: 6, short: 7, fade: 5, flattop: 6, curly: 8, afro: 10, mohawk: 0, dreads: 12, braids: 12, long: 12, bun: 8, twists: 9, cornrows: 7, undercut: 4, pompadour: 6, spiky: 6, ponytail: 7, waves: 5, frohawk: 0, slick: 8 };

function faceMat(L, hc, { eyeBlack = false } = {}) {
  const fem = L.gender === 'f';
  const fs = fsOf(L), EC = eyeCols(fs);
  const key = `face8|${fs.noseL}|${fs.noseW}|${fs.browH}|${fs.eyeSpace}|${fs.lips}|${L.skin}|${L.hairStyle}|${L.hairColor}|${L.eyeColor}|${L.eyes}|${L.brows}|${L.nose}|${L.mouth}|${L.beard}|${eyeBlack}|${L.gender}|${L.lips}`;
  // Drawn with smooth shapes on a 12x12 logical grid (rendered at 72x72): shading, real eyes, nose, lips.
  return pixMat(key, 12, 12, (g) => {
    const sk = SKIN_TONES[L.skin % SKIN_TONES.length];
    const dk = shade(sk, -0.16);
    const dk2 = shade(sk, -0.32);
    const ell = (x, y, rx, ry, col, rot = 0) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); g.fill(); };
    // skin with soft shading (cheeks lit, jaw and temples darker)
    // the same base as the sides of the head (so there's no line where the face meets them), plus a soft highlight
    // in the middle that fades out well before the edges
    const vg = g.createLinearGradient(0, 0, 0, 12); vg.addColorStop(0, shade(sk, 0.03)); vg.addColorStop(0.7, sk); vg.addColorStop(1, shade(sk, -0.1));
    g.fillStyle = vg; g.fillRect(0, 0, 12, 12);
    const base = g.createRadialGradient(6, 5.4, 0.5, 6, 6, 5.2);
    base.addColorStop(0, shade(sk, 0.06)); base.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = base; g.fillRect(0, 0, 12, 12);
    for (const bx of [3.0, 9.0]) { const bg = g.createRadialGradient(bx, 7.6, 0.2, bx, 7.6, 2.2); bg.addColorStop(0, 'rgba(224,122,106,0.13)'); bg.addColorStop(1, 'rgba(224,122,106,0)'); g.fillStyle = bg; g.fillRect(0, 0, 12, 12); } // a little warmth in the cheeks
    // hairline / fringe
    const fr = HAIR_FRONT[L.hairStyle] ?? 2;
    const hcol = L.hairStyle === 'buzz' ? shade(hc, 0.15) : hc;
    if (fr) {
      // only a soft hairline shadow: the 3D hair makes the real hairline (a painted block of bangs looked like a wig)
      const fy = Math.min(fr, 1.6);
      const fg = g.createLinearGradient(0, 0, 0, fy + 0.6); fg.addColorStop(0, hcol); fg.addColorStop(0.6, hcol); fg.addColorStop(1, 'rgba(0,0,0,0)');
      g.save(); g.globalAlpha = 0.85; g.fillStyle = fg; g.beginPath(); g.moveTo(0, 0); g.lineTo(12, 0); g.lineTo(12, fy + 0.5);
      g.quadraticCurveTo(9, fy - 0.2, 6, fy + 0.3); g.quadraticCurveTo(3, fy - 0.2, 0, fy + 0.5); g.closePath(); g.fill(); g.restore();
      if (L.hairStyle === 'buzz') { g.globalAlpha = 0.5; g.fillStyle = sk; g.fillRect(0, 0, 12, fr); g.globalAlpha = 1; }
    }
    if (L.hairStyle === 'mohawk' || L.hairStyle === 'frohawk') { g.fillStyle = shade(sk, -0.08); g.fillRect(0, 0, 12, 1); g.fillStyle = hc; g.fillRect(L.hairStyle === 'mohawk' ? 5 : 3.5, 0, L.hairStyle === 'mohawk' ? 2 : 5, 1.6); }
    // brows
    const bc = (L.hairColor ?? 0) > 8 ? '#2a1a12' : shade(hc, -0.12);
    // brows: tapered (full at the inner end, fine at the tail) and arched
    const by = (L.brows === 'raised' ? 3.95 : fem ? 4.35 : 4.6) - 0.45 * fs.browH;
    const th = fem ? 0.36 : L.brows === 'thick' ? 0.75 : L.brows === 'thin' ? 0.3 : 0.5;
    const brow = (xIn, xOut, tilt) => {
      const mid = (xIn + xOut) / 2, arch = fem ? 0.5 : 0.22;
      g.fillStyle = bc; g.globalAlpha = 0.92; g.beginPath();
      g.moveTo(xIn, by + tilt - th / 2);
      g.quadraticCurveTo(mid + (xOut - xIn) * 0.1, by - arch - th * 0.5, xOut, by + 0.15 - th * 0.15);
      g.quadraticCurveTo(mid + (xOut - xIn) * 0.1, by - arch + th * 0.35, xIn, by + tilt + th / 2);
      g.closePath(); g.fill(); g.globalAlpha = 1;
    };
    const [eL, eR] = EC;
    const tilt = L.brows === 'angry' ? 0.35 : 0;
    brow(eL + 1.25, eL - 1.6, tilt); brow(eR - 1.25, eR + 1.6, tilt);
    // eyes are 3D (makeEyes); the face only gets soft socket shading and a lid crease above them
    for (const cx of EC) {
      g.save(); g.globalAlpha = 0.2; ell(cx, 5.75, 1.75, 1.0, dk); g.restore();
      g.strokeStyle = shade(sk, -0.28); g.globalAlpha = 0.45; g.lineWidth = 0.14;
      g.beginPath(); g.ellipse(cx, 5.5, 1.4, 0.8, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke(); g.globalAlpha = 1;
    }
    if (eyeBlack) { g.globalAlpha = 0.9; ell(3.4, 7.15, 1.2, 0.38, '#111111'); ell(8.6, 7.15, 1.2, 0.38, '#111111'); g.globalAlpha = 1; }
    // nose, painted to match the sculpt: highlight down the bridge, a soft crease around the wings, nostrils under the tip
    {
      const N0 = NOSE_K[L.nose] ?? NOSE_K.small;
      const nl = N0.len * (1 + 0.25 * fs.noseL), nwd = N0.wide * (1 + 0.25 * fs.noseW);
      const tipY = 7.5 + 0.35 * (nl - 1);
      const hl = shade(sk, 0.16);
      const bg = g.createLinearGradient(6, 5.0, 6, tipY + 0.2); bg.addColorStop(0, 'rgba(255,255,255,0)'); bg.addColorStop(0.55, hl); bg.addColorStop(1, 'rgba(255,255,255,0)');
      g.save(); g.globalAlpha = 0.3; g.fillStyle = bg; g.beginPath(); g.ellipse(6, (5.0 + tipY) / 2 + 0.2, 0.26, (tipY - 5.0) / 2 + 0.2, 0, 0, Math.PI * 2); g.fill(); g.restore();
      // wing creases
      g.save(); g.strokeStyle = shade(sk, -0.35); g.globalAlpha = 0.32; g.lineWidth = 0.09; g.lineCap = 'round';
      for (const sd of [-1, 1]) { const wx = 6 + sd * 0.82 * nwd; g.beginPath(); g.moveTo(wx - sd * 0.12, tipY - 0.15); g.quadraticCurveTo(wx + sd * 0.42 * nwd, tipY + 0.05, wx + sd * 0.12, tipY + 0.55); g.stroke(); }
      g.restore();
      // nostrils: small dark teardrops angled in under the tip
      g.save(); g.globalAlpha = 0.6;
      for (const sd of [-1, 1]) ell(6 + sd * 0.42 * nwd, tipY + 0.48, 0.24 * nwd, 0.11, dk2, sd * 0.35);
      g.globalAlpha = 0.22; ell(6, tipY + 0.62, 0.55 * nwd, 0.12, dk); // a little shade where the tip tucks back
      g.restore();
    }
    // facial hair
    const natural = (L.hairColor ?? 0) <= 8 ? hc : HAIR_COLORS[1];
    const bh = shade(natural, -0.05);
    const beardArea = (yTop, sides = true) => {
      g.beginPath(); g.moveTo(0, yTop);
      if (sides) { g.lineTo(1.6, yTop); g.quadraticCurveTo(2.2, 9.6, 4.2, 9.2); g.lineTo(7.8, 9.2); g.quadraticCurveTo(9.8, 9.6, 10.4, yTop); }
      g.lineTo(12, yTop); g.lineTo(12, 12); g.lineTo(0, 12); g.closePath(); g.fill();
    };
    // big beards are 3D now (addBeard); the face only gets a soft shadow under them that fades out before
    // the edges of the face (an opaque painted patch ended in a hard line at the side of the head)
    const shadowBeard = (yTop, a) => {
      g.save(); g.globalAlpha = a;
      const gr = g.createLinearGradient(0, 0, 12, 0); gr.addColorStop(0, sk); gr.addColorStop(0.22, bh); gr.addColorStop(0.78, bh); gr.addColorStop(1, sk);
      g.fillStyle = gr; beardArea(yTop); g.restore();
    };
    if (L.beard === 'stubble') shadowBeard(6.8, 0.28);
    if (L.beard === 'full' || L.beard === 'long' || L.beard === 'boxed' || L.beard === 'chinstrap' || L.beard === 'muttonchops') shadowBeard(L.beard === 'full' || L.beard === 'long' ? 6.4 : 7.2, 0.35);
    g.save(); g.globalAlpha = 0.45;
    if (L.beard === 'goatee' || L.beard === 'vandyke') ell(6, 10.6, L.beard === 'vandyke' ? 0.9 : 1.6, 1.1, bh);
    if (L.beard === 'soulpatch') ell(6, 10.3, 0.5, 0.35, bh);
    if (['mustache', 'goatee', 'full', 'boxed', 'long', 'vandyke', 'handlebar'].includes(L.beard)) {
      g.fillStyle = bh; g.beginPath(); g.moveTo(3.6, 8.75); g.quadraticCurveTo(6, 7.9, 8.4, 8.75); g.quadraticCurveTo(6, 8.5, 3.6, 8.75); g.fill();
      ell(6, 8.45, 2.1, 0.4, bh);
      if (L.beard === 'handlebar') { g.strokeStyle = bh; g.lineWidth = 0.35; g.beginPath(); g.moveTo(3.9, 8.6); g.quadraticCurveTo(3, 8.8, 2.9, 8); g.moveTo(8.1, 8.6); g.quadraticCurveTo(9, 8.8, 9.1, 8); g.stroke(); }
    }
    g.restore();
    // mouth: real lip shapes (a cupid's bow upper lip, a fuller lower lip, a soft line between) instead of a cut line
    {
      const m = L.mouth ?? 'neutral';
      const cl = m === 'smile' || m === 'grin' ? -0.22 : m === 'smirk' ? -0.04 : m === 'serious' ? 0.06 : 0; // corner lift
      const cr = m === 'smile' || m === 'grin' ? -0.22 : m === 'smirk' ? -0.26 : m === 'serious' ? 0.06 : 0;
      const hw = fem ? 1.42 : 1.5, my = 9.42, x0 = 6 - hw, x1 = 6 + hw;
      const lipBase = fem && L.lips && L.lips !== 'none' ? L.lips : mix(sk, '#a8505a', 0.4);
      const upper = shade(lipBase, -0.08), lower = shade(lipBase, 0.03);
      const lineY = (x) => { const t = (x - x0) / (x1 - x0); return my + 0.08 * Math.sin(t * Math.PI) + (1 - t) * cl + t * cr; };
      const upH = (fem ? 0.36 : 0.28) * (1 + 0.45 * fs.lips), loH = (fem ? 0.5 : 0.4) * (1 + 0.45 * fs.lips);
      g.save(); g.globalAlpha = fem && L.lips && L.lips !== 'none' ? 0.9 : 0.62;
      // upper lip
      g.fillStyle = upper; g.beginPath(); g.moveTo(x0, lineY(x0));
      g.bezierCurveTo(x0 + 0.5, my - upH * 0.6, 5.35, my - upH, 5.62, my - upH);
      g.quadraticCurveTo(6, my - upH * 0.62, 6.38, my - upH);
      g.bezierCurveTo(6.65, my - upH, x1 - 0.5, my - upH * 0.6, x1, lineY(x1));
      for (let x = x1; x >= x0; x -= 0.25) g.lineTo(x, lineY(x));
      g.closePath(); g.fill();
      // lower lip
      g.fillStyle = lower; g.beginPath(); g.moveTo(x0, lineY(x0));
      for (let x = x0; x <= x1; x += 0.25) g.lineTo(x, lineY(x));
      g.bezierCurveTo(x1 - 0.35, my + loH * 0.75, 6.6, my + loH, 6, my + loH);
      g.bezierCurveTo(5.4, my + loH, x0 + 0.35, my + loH * 0.75, x0, lineY(x0));
      g.closePath(); g.fill();
      g.restore();
      if (m === 'grin') { g.save(); g.fillStyle = '#f2ede6'; g.globalAlpha = 0.95; g.beginPath(); g.moveTo(x0 + 0.35, lineY(x0 + 0.35)); for (let x = x0 + 0.35; x <= x1 - 0.35; x += 0.25) g.lineTo(x, lineY(x) - 0.04); g.quadraticCurveTo(6, my + 0.42, x0 + 0.35, lineY(x0 + 0.35)); g.fill(); g.restore(); }
      // a soft highlight on the lower lip, then the parting line (dark in the middle, fading at the corners)
      g.save(); g.globalAlpha = 0.18; ell(6, my + loH * 0.5, 0.55, 0.12, '#ffffff'); g.restore();
      const lg = g.createLinearGradient(x0, 0, x1, 0); const dline = shade(sk, -0.55);
      lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(0.18, dline); lg.addColorStop(0.82, dline); lg.addColorStop(1, 'rgba(0,0,0,0)');
      g.save(); g.strokeStyle = lg; g.globalAlpha = 0.6; g.lineWidth = 0.1; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, lineY(x0));
      for (let x = x0; x <= x1; x += 0.2) g.lineTo(x, lineY(x)); g.stroke(); g.restore();
      // small shadows at the corners and under the lower lip
      g.save(); g.globalAlpha = 0.14; ell(x0 - 0.05, lineY(x0), 0.18, 0.14, dk2); ell(x1 + 0.05, lineY(x1), 0.18, 0.14, dk2); g.globalAlpha = 0.1; ell(6, my + loH + 0.22, 0.9, 0.16, dk); g.restore();
    }
  }, { rough: 0.6, skin: true, scale: 24 });
}

function sideMat(L, hc, flip) {
  // plain skin with a little shading: the 3D hair, beard and ears do the rest (painted hair showed as blocks)
  const key = `side4|${L.skin}|${flip}`;
  return pixMat(key, 12, 12, (g) => {
    const sk = SKIN_TONES[L.skin % SKIN_TONES.length];
    const gr = g.createLinearGradient(0, 0, 0, 12); gr.addColorStop(0, shade(sk, 0.03)); gr.addColorStop(0.7, sk); gr.addColorStop(1, shade(sk, -0.1));
    g.fillStyle = gr; g.fillRect(0, 0, 12, 12);
  }, { soft: true, rough: 0.6, skin: true });
}

function backMat(L, hc) {
  return sideMat(L, hc, 'back');
}

function topMat(L, hc) {
  return sideMat(L, hc, 'top');
}

/** Arm texture: 8x16. top rows = sleeve (jersey/shirt) unless bare, rest skin + tattoo or arm sleeve. */
function armMat(skin, sleeveCol, trim, tattoo, part, armSleeve, rows = 7, stripes = 1) {
  const key = `arm2|${skin}|${sleeveCol}|${trim}|${tattoo}|${part}|${armSleeve}|${rows}|${stripes}`;
  return pixMat(key, 8, 16, (g) => {
    px(g, 0, 0, skin, 8, 16);
    if (part === 'upper') {
      drawTattoo(g, tattoo, 0, rows, 8, 16 - rows, { aspect: 2.6, seed: rows, skin });
      if (armSleeve) px(g, 0, rows - 1, armSleeve, 8, 17 - rows);
      px(g, 0, 0, sleeveCol, 8, rows);
      if (trim && rows > 3) { if (stripes === 1) px(g, 0, rows - 2, trim, 8, 1); else for (let i = 0; i < stripes; i++) px(g, 0, rows - 1.6 - i * 1.1, trim, 8, 0.6); }
    } else {
      drawTattoo(g, tattoo, 0, 1.2, 8, 12.4, { aspect: 2.2, seed: 3, skin });
      if (armSleeve) px(g, 0, 0, armSleeve, 8, 15);
    }
  }, { skin: true, scale: 24 });
}

/** Team logo: the mascot glyph (smoothly drawn cells with an outline) or the team letter. */
function drawLogo(g, st, cx, cy, size, main, hi, { mirror = false, outline = '#0b0d10' } = {}) {
  if (!st) return;
  if (st.logo === 'letter' || !GLYPHS[st.glyph]) {
    g.save(); g.font = `900 ${size}px "Arial Black", Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.strokeStyle = outline; g.lineWidth = size * 0.16; g.strokeText(st.letter ?? '?', cx, cy + size * 0.05);
    g.fillStyle = main; g.fillText(st.letter ?? '?', cx, cy + size * 0.05); g.restore();
    return;
  }
  const rows = GLYPHS[st.glyph]; const c = size / 16;
  const at = (x, y) => rows[y]?.[mirror ? 15 - x : x] ?? '.';
  const cell = (x, y, col, grow = 0) => { g.fillStyle = col; g.fillRect(cx - size / 2 + x * c - grow, cy - size / 2 + y * c - grow, c + grow * 2, c + grow * 2); };
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (at(x, y) !== '.') cell(x, y, outline, c * 0.55);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const ch = at(x, y); if (ch === '#') cell(x, y, main, 0.02); else if (ch === '+') cell(x, y, hi, 0.02); else if (ch === 'o') cell(x, y, outline, 0.02); }
}
const logoColors = (bg, un) => {
  const main = Math.abs(luma(un.trim) - luma(bg)) > 0.22 ? un.trim : luma(bg) > 0.5 ? '#14171c' : '#ffffff';
  return [main, main === '#ffffff' ? '#ffd43b' : '#ffffff'];
};
const NUM_FONTS = {
  block: (px) => `900 ${px}px "Arial Black", Impact, sans-serif`, varsity: (px) => `900 ${px}px "Arial Black", Impact, sans-serif`,
  rounded: (px) => `bold ${px}px "Trebuchet MS", Verdana, sans-serif`, serif: (px) => `bold ${px}px Georgia, "Times New Roman", serif`,
  italic: (px) => `italic 900 ${px}px "Arial Black", Impact, sans-serif`, stencil: (px) => `${px}px Impact, "Arial Black", sans-serif`,
};
/** Jersey torso texture: the team's pattern, collar, chest logo and numbers in the team's font. */
function jerseyMat(un, number, side) {
  const st = un.style;
  const key = `jersey3|${un.jersey}|${un.trim}|${un.numbers}|${number}|${side}|${st ? `${st.pattern}|${st.font}|${st.collar}|${st.chestLogo}|${st.glyph}|${st.logo}` : ''}`;
  return pixMat(key, 22, 26, (g) => {
    const J = un.jersey, T = un.trim;
    px(g, 0, 0, J, 22, 26);
    const P = st?.pattern ?? 'plain';
    const band = colorDist(un.numbers, T) < 0.25 ? shade(J, luma(J) > 0.5 ? -0.25 : 0.25) : T;
    const poly = (pts, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(...pts[0]); for (const q of pts.slice(1)) g.lineTo(...q); g.closePath(); g.fill(); };
    // all-over patterns for the built-in pro teams (front, back and sides)
    if (P === 'plaid') { // lumberjack flannel: dark crossing bands + thin trim lines
      const dk = shade(J, -0.38);
      g.globalAlpha = 0.55; for (let x = 0; x < 22; x += 5.5) px(g, x, 0, dk, 2.6, 26); for (let y = 0; y < 26; y += 5.5) px(g, 0, y, dk, 22, 2.6);
      g.globalAlpha = 0.5; for (let x = 4; x < 22; x += 5.5) px(g, x, 0, T, 0.25, 26); for (let y = 4; y < 26; y += 5.5) px(g, 0, y, T, 22, 0.25); g.globalAlpha = 1;
    }
    if (P === 'fringe' && side !== 'side') { // buckskin yoke with leather fringe hanging off it
      poly([[0, 0], [22, 0], [22, 4], [11, 7.5], [0, 4]], T);
      g.strokeStyle = T; g.lineWidth = 0.32;
      for (let x = 0.5; x < 22; x += 0.9) { const y0 = x < 11 ? 4 + (x / 11) * 3.5 : 7.5 - ((x - 11) / 11) * 3.5; g.beginPath(); g.moveTo(x, y0 - 0.2); g.lineTo(x + 0.15, y0 + 2.4); g.stroke(); }
      g.strokeStyle = shade(T, -0.35); g.lineWidth = 0.25; g.setLineDash([0.5, 0.5]); g.beginPath(); g.moveTo(0, 3.6); g.lineTo(11, 7.1); g.lineTo(22, 3.6); g.stroke(); g.setLineDash([]); // stitching
    }
    if (P === 'fringe' && side === 'side') { px(g, 0, 0, T, 22, 4); g.strokeStyle = T; g.lineWidth = 0.32; for (let x = 0.5; x < 22; x += 0.9) { g.beginPath(); g.moveTo(x, 3.8); g.lineTo(x, 6.2); g.stroke(); } }
    if (P === 'scales') { // snake scales: rows of small arcs
      g.strokeStyle = shade(J, 0.14); g.lineWidth = 0.22; g.globalAlpha = 0.7;
      for (let y = 0, row = 0; y < 27; y += 1.4, row++) for (let x = (row % 2) * 1.2; x < 23; x += 2.4) { g.beginPath(); g.arc(x, y, 1.2, 0, Math.PI); g.stroke(); }
      g.globalAlpha = 1;
    }
    if (P === 'flames' && side !== 'back') { // flames licking up from the hem
      const fl = (x0, w, h, col) => poly([[x0, 26], [x0 + w * 0.15, 26 - h * 0.55], [x0 + w * 0.3, 26 - h * 0.35], [x0 + w * 0.5, 26 - h], [x0 + w * 0.68, 26 - h * 0.4], [x0 + w * 0.85, 26 - h * 0.7], [x0 + w, 26]], col);
      for (let x = -2; x < 22; x += 5) fl(x, 6, 8 + ((x * 7) % 5), T);
      for (let x = 0.5; x < 22; x += 5) fl(x, 4, 4.5 + ((x * 3) % 3), shade(T, 0.3));
    }
    if (P === 'stars' && side !== 'side') { // a band of stars across the shoulders
      px(g, 0, 0, T, 22, 3.6);
      g.fillStyle = J;
      const star = (cx, cy, r) => { g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5; const rr = k % 2 ? r * 0.45 : r; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); g.fill(); };
      for (let x = 1.5; x < 22; x += 3.2) if (side !== 'front' || Math.abs(x - 11) > 3.5) star(x, 1.8, 1.1);
      px(g, 0, 3.6, shade(T, -0.3), 22, 0.35);
    }
    if (P === 'stars' && side === 'side') { px(g, 0, 0, T, 22, 3.6); }
    if (side === 'side') {
      if (P === 'sidePanels' || P === 'claws') px(g, 7, 0, T, 8, 26);
      if (P === 'shoulders' || P === 'yoke') px(g, 0, 0, T, 22, 4);
      if (P === 'tvStripe') { px(g, 0, 18, T, 22, 1.2); px(g, 0, 20, T, 22, 1.2); }
      if (P === 'claws') for (let i = 0; i < 3; i++) poly([[2 + i * 2.2, 10], [3 + i * 2.2, 10], [7 + i * 2.2, 22], [6 + i * 2.2, 22]], shade(J, -0.3));
    } else {
      if (P === 'shoulders') { px(g, 0, 0, T, 22, 4); px(g, 0, 4, shade(J, -0.3), 22, 0.4); }
      if (P === 'yoke') poly([[0, 0], [22, 0], [22, 3.5], [11, 8], [0, 3.5]], T);
      if (P === 'chestBand') { px(g, 0, 6.2, band, 22, 7.6); px(g, 0, 6.2, shade(band, -0.25), 22, 0.4); px(g, 0, 13.4, shade(band, -0.25), 22, 0.4); }
      if (P === 'sidePanels') { poly([[0, 3], [3, 3], [2, 26], [0, 26]], T); poly([[22, 3], [19, 3], [20, 26], [22, 26]], T); }
      if (P === 'pinstripe') { g.globalAlpha = 0.35; for (let x = 1; x < 22; x += 1.8) px(g, x, 0, T, 0.18, 26); g.globalAlpha = 1; }
      if (P === 'fade') { const fg = g.createLinearGradient(0, 11, 0, 26); fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, T); g.globalAlpha = 0.75; g.fillStyle = fg; g.fillRect(0, 11, 22, 15); g.globalAlpha = 1; }
      if (P === 'tvStripe') { px(g, 0, 19, T, 22, 1.1); px(g, 0, 21, T, 22, 1.1); }
      if (P === 'claws') for (let i = 0; i < 3; i++) poly([[1 + i * 1.6, 15], [1.8 + i * 1.6, 15], [4 + i * 1.6, 25], [3.2 + i * 1.6, 25]], T);
      // collar
      if (side === 'front') {
        if (st?.collar === 'round') { g.fillStyle = shade(J, -0.3); g.beginPath(); g.ellipse(11, 0, 3.6, 2.4, 0, 0, Math.PI); g.fill(); g.strokeStyle = T; g.lineWidth = 0.5; g.beginPath(); g.ellipse(11, 0, 3.8, 2.6, 0, 0, Math.PI); g.stroke(); }
        else { poly([[7.4, 0], [14.6, 0], [11, 3.6]], shade(J, -0.3)); g.strokeStyle = T; g.lineWidth = 0.55; g.beginPath(); g.moveTo(7, 0); g.lineTo(11, 4); g.lineTo(15, 0); g.stroke(); }
      } else { g.strokeStyle = T; g.lineWidth = 0.5; g.beginPath(); g.moveTo(7.5, 0.3); g.quadraticCurveTo(11, 1.4, 14.5, 0.3); g.stroke(); }
    }
    // mesh fabric + folds + hem
    g.globalAlpha = 0.05; for (let y = 0; y < 26; y += 0.5) px(g, 0, y, y % 1 ? '#000' : '#fff', 22, 0.25); g.globalAlpha = 1;
    const fold = g.createLinearGradient(0, 0, 22, 0); fold.addColorStop(0, 'rgba(0,0,0,0.16)'); fold.addColorStop(0.5, 'rgba(255,255,255,0.05)'); fold.addColorStop(1, 'rgba(0,0,0,0.16)');
    g.fillStyle = fold; g.fillRect(0, 0, 22, 26);
    px(g, 0, 24.5, shade(J, -0.15), 22, 1.5);
    if (side === 'front' && st?.chestLogo && number !== undefined) { const [m, h2] = logoColors(J, un); drawLogo(g, st, 18, 4.6, 3.2, m, h2); }
    if (number === undefined || side === 'side') return;
    // numbers in the team's font, with a smooth outline (two outlines for varsity)
    const sNum = String(number); const font = NUM_FONTS[st?.font ?? 'block'] ?? NUM_FONTS.block;
    const fpx = side === 'front' ? 11 : 15; const y = side === 'front' ? 10.3 : 12.3;
    g.font = font(fpx); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    const outline = T === un.numbers ? shade(J, -0.4) : T;
    if (st?.font === 'varsity') { g.strokeStyle = shade(J, luma(J) > 0.5 ? -0.5 : -0.6); g.lineWidth = 2.6; g.strokeText(sNum, 11, y); }
    g.strokeStyle = outline; g.lineWidth = st?.font === 'varsity' ? 1.4 : 1.1; g.strokeText(sNum, 11, y);
    g.fillStyle = un.numbers; g.fillText(sNum, 11, y);
    if (st?.font === 'stencil') { g.fillStyle = J; px(g, 0, y - 0.25, J, 22, 0.5); }
  }, { scale: 9 });
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
  const st = un.stripeStyle ?? 'single'; const ts = un.style;
  const key = `helm3|${un.helmet}|${un.stripe}|${un.trim}|${side}|${st}|${un.finish ?? 'gloss'}|${ts ? `${ts.glyph}|${ts.logo}|${ts.letter}` : ''}`;
  return pixMat(key, 12, 12, (g) => {
    px(g, 0, 0, un.helmet, 12, 12);
    const dk = shade(un.helmet, -0.2);
    px(g, 0, 10.5, dk, 12, 1.5);
    const strip = (x, w, col = un.stripe) => px(g, x, 0, col, w, side === 'back' ? 10.5 : 12);
    if (side === 'top' || side === 'back') {
      const edge = luma(un.stripe) > 0.6 ? shade(un.stripe, -0.5) : '#ffffff';
      if (st === 'single') strip(5, 2);
      else if (st === 'double') { strip(3.6, 1.4); strip(7, 1.4); }
      else if (st === 'triple') { strip(2.6, 0.8); strip(5, 2); strip(8.6, 0.8); }
      else if (st === 'wide') { strip(3.5, 5, edge); strip(4, 4); }
      else if (st === 'tri') { strip(4, 4, edge); strip(4.6, 2.8, un.stripe); strip(5.5, 1, edge); }
    }
    if (side === 'top' && un.finish !== 'matte') { g.globalAlpha = 0.5; px(g, 3, 3, shade(un.helmet, un.finish === 'chrome' ? 0.6 : 0.35), 2, 2); g.globalAlpha = 1; }
    if (side === 'side' || side === 'sideL') {
      if (ts) { const [m, h2] = logoColors(un.helmet, un); drawLogo(g, ts, 6.3, 5.4, 7.2, m, h2, { mirror: side === 'sideL' && ts.logo !== 'letter' }); }
      else { px(g, 3, 3, un.stripe, 6, 4); px(g, 4, 4, shade(un.stripe, -0.2), 4, 2); }
      if (un.finish === 'chrome') { g.globalAlpha = 0.6; px(g, 1, 1, '#ffffff', 2, 0.6); g.globalAlpha = 1; }
    }
  }, { scale: 16 });
}

/** Pants with the team's stripe down the outside of the thigh (lathe UVs: u 0.25 / 0.75 are the outsides). */
function pantsStripeMat(un) {
  const kind = un.style?.pants ?? 'none';
  const key = `pstripe|${un.pants}|${un.trim}|${un.jersey}|${kind}`;
  return pixMat(key, 32, 8, (g) => {
    px(g, 0, 0, un.pants, 32, 8);
    const T = colorDist(un.trim, un.pants) < 0.2 ? un.jersey : un.trim;
    for (const cx of [8, 24]) {
      if (kind === 'single') px(g, cx - 0.7, 0, T, 1.4, 8);
      else if (kind === 'double') { px(g, cx - 1.3, 0, T, 0.8, 8); px(g, cx + 0.5, 0, T, 0.8, 8); }
      else if (kind === 'tri') { px(g, cx - 1.6, 0, T, 0.6, 8); px(g, cx - 0.6, 0, un.jersey === un.pants ? '#ffffff' : un.jersey, 1.2, 8); px(g, cx + 1, 0, T, 0.6, 8); }
    }
  }, { rough: 0.72 });
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
  const skin = skinMat(skinC);
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
    const th = new THREE.Mesh(g.thigh, football && un.style && un.style.pants !== 'none' ? pantsStripeMat(un) : pants); th.scale.set(bt.leg, 1, bt.leg); hip.add(th);
    hip.add(joint(0.088 * bt.leg, pants, 0, -0.025, 0)); // hip joint blends thigh into hips (no bigger than the thigh, or it reads as a ball)
    const knee = new THREE.Group();
    knee.position.y = -0.48;
    hip.add(knee);
    const legSleeve = football && onSide(L.legSleeve, side);
    const shin = new THREE.Mesh(g.shin, legSleeve ? toon(L.legSleeveColor ?? '#16181c') : football ? sock : pants);
    shin.scale.set(bt.leg, 1, bt.leg);
    knee.add(shin);
    knee.add(joint(0.066 * bt.leg, legSleeve ? toon(L.legSleeveColor ?? '#16181c') : football ? pants : pants, 0, 0.01, 0)); // knee: just covers the thigh/shin seam when it bends
    if (football && !legSleeve) { const sk = new THREE.Mesh(box(0.15, 0.05, 0.155), toon(un.trim)); sk.position.y = -0.1; knee.add(sk); }
    if (football && onSide(L.kneeBrace, side)) {
      const kb = new THREE.Mesh(box(0.19, 0.16, 0.2), braceTex(L.kneeColor ?? '#16181c'));
      kb.position.y = -0.01;
      knee.add(kb);
    }
    // ankle joint: the foot pivots here so it can sit flat on the ground, roll off the toes and point in the air
    const ankle = new THREE.Group();
    ankle.position.set(0, -0.44, 0);
    knee.add(ankle);
    ankle.add(joint(0.047 * bt.leg, legSleeve ? toon(L.legSleeveColor ?? '#16181c') : football ? sock : skin, 0, 0.02, 0));
    const foot = new THREE.Mesh(g.shoe, cleatMat);
    foot.position.set(0, 0, -0.05);
    ankle.add(foot);
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
    return { hip, knee, ankle, foot };
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
      // a lower-back protector peeking out at the bottom of the jersey (it used to sit over the number)
      const bp = new THREE.Mesh(box(0.26, 0.085, 0.035, 0, 0.45, 2), toon(teamCol(L.backplate)));
      bp.position.set(0, -0.4, 0.14 * fitK);
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
  // a real neck: wider at the base where it meets the traps, sitting a touch behind the jaw
  const neckK = (football ? 1.32 : L.gender === 'f' ? 1.06 : 1.22) * (1 + 0.12 * fsOf(L).neck); // a real neck is ~2/3 of the head's width
  const neckBox = new THREE.Mesh(neckGeo(neckK), L.tatNeck && L.tatNeck !== 'none' ? neckMat(skinC, L.tatNeck) : skin);
  neckBox.position.set(0, 0.2, 0.035); // rises from behind the jaw, leaning forward (not under the middle like a stick)
  neckBox.rotation.x = -0.16;
  neck.add(neckBox);
  if (L.gender !== 'f') { const apple = new THREE.Mesh(G.joint, skin); apple.scale.set(0.016, 0.022, 0.014); apple.position.set(0, 0.105, 0.024 - 0.054 * neckK); neck.add(apple); }
  const helmetOn = football && o.helmet !== false;
  const sex = L.gender === 'f' ? 'f' : 'm';
  const fp = faceParams(L);

  const head = new THREE.Mesh(headGeo(L.headShape, helmetOn ? 12 : 40, sex, fp), sixFaces(
    sideMat(L, hairC, false), sideMat(L, hairC, true), topMat(L, hairC), skin, backMat(L, hairC),
    faceMat(L, hairC, { eyeBlack: helmetOn && L.eyeBlack }),
  ));
  head.position.y = 0.23;
  // the nose, brow, cheekbones and chin are sculpted into the head; ears sit level with the eyes, set back
  const hd = HEAD_DIMS[L.headShape] ?? HEAD_DIMS.oval;
  const ears = [];
  for (const sd of [-1, 1]) {
    const e = new THREE.Mesh(earGeo(), skin);
    e.position.set(sd * (hd[0] / 2 * (FACEW_K[fp.faceW] ?? 1) - 0.002), 0.2, 0.03); e.rotation.y = sd * 0.4; e.scale.set(sd * 1.15, 1.2, 1.2); // a clear ear: the landmark that makes a profile read as human
    ears.push(e);
  }
  // Big chunky heads: everything above the neck lives in a scaled group.
  const headGroup = new THREE.Group();
  headGroup.scale.setScalar(g.headScale * 1.05);
  headGroup.position.y = -0.002; // sits down onto the neck (a long thin neck looked like a mannequin)
  neck.add(headGroup);
  headGroup.add(head);
  const eyes = makeEyes(head.geometry.userData.eyes ?? [[-0.072, 0.012, -0.17], [0.072, 0.012, -0.17]], L, skin, head.position.y);
  headGroup.add(eyes.group);
  if (!(football && o.helmet !== false)) headGroup.add(...ears);
  if (helmetOn) addHelmet(headGroup, un, L, hairC);
  else { addHairVolume(headGroup, L, hairC); addBeard(headGroup, L, hairC); }
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
    const upper = new THREE.Mesh(g.upper, armMat(skinC, shirtC, football ? un.trim : null, tat, 'upper', armSleeve, rows, football ? (un.style?.sleeve ?? 1) : 1));
    if (football && L.jFit === 'tight') upper.scale.set(0.94, 1, 0.94);
    upper.scale.x *= bt.arm; upper.scale.z *= bt.arm;
    sh.add(upper);
    // deltoid blends shoulder into arm (sleeve colour on players, shirt/skin on people)
    sh.add(joint(0.085 * bt.arm, football ? (rows <= 3 ? skin : toon(shirtC)) : (o.tie ? toon(shirtC) : toon(shirtC)), 0, -0.02, 0, 1.05));
    const el = new THREE.Group();
    el.position.y = -0.31;
    sh.add(el);
    const fore = new THREE.Mesh(g.fore, armMat(skinC, shirtC, null, tat, 'fore', armSleeve)); fore.scale.set(bt.arm, 1, bt.arm); el.add(fore);
    el.add(joint(0.054 * bt.arm, armSleeve ? toon(armSleeve) : skin, 0, 0.005, 0)); // elbow (covers the seam without a knob)
    if (football && onSide(L.elbowPad, side)) { const ep = new THREE.Mesh(box(0.145, 0.09, 0.145), toon(L.elbowColor ?? '#16181c')); ep.position.y = -0.02; el.add(ep); }
    const band = football && (L.wristband === 'both' || L.wristband === (side < 0 ? 'left' : 'right'));
    if (band) { const b = new THREE.Mesh(g.band, toon(L.wristColor ?? '#f2f2f2')); b.position.y = -0.25; el.add(b); }
    const hand = new THREE.Mesh(g.hand, football && L.gloves ? (L.gloveDesign && L.gloveDesign !== 'solid' ? gloveTex(L.gloves, L.gloveAccent ?? '#f2f2f2', L.gloveDesign) : toon(L.gloves)) : skin);
    // wrist joint: the hand flexes a beat behind the forearm (secondary motion) instead of being welded on
    const wrist = new THREE.Group();
    wrist.position.y = -0.3;
    el.add(wrist);
    hand.position.y = -0.04;
    wrist.add(hand);
    chest.add(sh);
    return { sh, el, wrist, hand };
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
    rig: { body, hips, spine, chest, neck, legL, legR, armL, armR, headG: headGroup },
    u: { speed: 0, phase: Math.random() * 6, back: false, hold: null, action: null, down: false, downT: 0, hop: 0, yaw: 0, targetYaw: 0, celebrate: null,
      // everyone runs a little differently
      gait: { stride: 0.88 + Math.random() * 0.24, arm: 0.82 + Math.random() * 0.34, lean: -0.04 + Math.random() * 0.12, tempo: 0.93 + Math.random() * 0.14, bounce: 0.8 + Math.random() * 0.45 } },
    look: L,
    lids: eyes.lids,
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
      const part = k.startsWith('jersey') || k.startsWith('pads|') ? 'jersey' : k.startsWith('helm') ? 'helmet' : m === ud.pantsMat || k.startsWith('pstripe|') ? 'pants' : null;
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
  // the team decides the shell, stripe, finish and logo (a uniform without a team style falls back to the look)
  const ts = un.style;
  const fin = ts?.finish ?? L.helmetFinish ?? 'gloss';
  const shellC = fin === 'matte' ? shade(un.helmet, -0.18) : fin === 'chrome' ? shade(un.helmet, 0.22) : fin === 'metallic' ? shade(un.helmet, 0.06) : un.helmet;
  const stripe = ts?.stripe ?? L.helmetStripe ?? 'single';
  const hu = { ...un, helmet: shellC, stripeStyle: stripe, finish: fin };
  const rough = fin === 'matte' ? 0.75 : fin === 'chrome' ? 0.18 : fin === 'satin' ? 0.5 : fin === 'metallic' ? 0.26 : 0.3;
  const metal = fin === 'chrome' ? 0.85 : fin === 'metallic' ? 0.5 : fin === 'satin' ? 0.1 : 0;
  const shellMat = (m) => { const c = m.clone(); c.roughness = rough; c.metalness = metal; c.side = THREE.DoubleSide; return c; };
  const shell = shiny(shellC, { rough, metal });
  const add = (geom, mat, x, y, z) => { const m = new THREE.Mesh(geom, mat); m.position.set(x, y, z); H.add(m); return m; };
  const open = new THREE.MeshBasicMaterial({ visible: false });
  const shellGeo = softBox(0.44, 0.43, 0.47, 0.2, 6);
  const sideM = shellMat(helmetMat(hu, 'side')), sideL = shellMat(helmetMat(hu, 'sideL'));
  const dome = add(shellGeo, [sideM, sideL, shellMat(helmetMat(hu, 'top')), shellMat(shell), shellMat(helmetMat(hu, 'back')), open], 0, 0.01, 0.01);
  dome.scale.set(1, 1, 1);
  add(box(0.4, 0.05, 0.06, 0, 0.45, 3), shell, 0, 0.15, -0.205); // brim
  // jaw pads
  add(box(0.05, 0.14, 0.16, 0, 0.45, 3), shell, -0.2, -0.08, -0.12);
  add(box(0.05, 0.14, 0.16, 0, 0.45, 3), shell, 0.2, -0.08, -0.12);
  // facemask
  const teamMask = ts ? ({ gray: '#c3cad3', trim: un.stripe, dark: '#16181c', white: '#f4f4f4', shell: shade(un.helmet, -0.1) }[ts.mask] ?? '#c3cad3') : un.stripe;
  // the team's facemask color unless you picked your own
  const mc = !L.maskColor || L.maskColor === 'team' || (ts && L.maskColor === '#c3cad3') ? teamMask : L.maskColor;
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
  // long hair, ponytails, braids and locs hang out the back of the helmet
  helmetHair(neck, L, hairC);
}

// ---------------- hair: smooth sculpted shells + tapered locks (no blocks)
// The shell is a hi-res copy of the person's own head pushed out by a per-style thickness; below the hairline
// it tucks under the scalp, so the edge feathers in like a real hairline. Hanging hair is tapered tubes.
const sstep = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const hairTexCache = {};
function hairTex(kind) {
  if (hairTexCache[kind]) return hairTexCache[kind];
  const N = 128;
  const c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d');
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#e4e4e4'; g.fillRect(0, 0, N, N);
  const strands = (count, lo, alpha) => {
    for (let i = 0; i < count; i++) {
      const x = rnd() * N; const v = (lo + rnd() * (255 - lo)) | 0;
      g.strokeStyle = `rgba(${v},${v},${v},${alpha})`; g.lineWidth = 0.6 + rnd() * 1.3;
      const dx1 = (rnd() - 0.5) * 8, dx2 = (rnd() - 0.5) * 8, dx3 = (rnd() - 0.5) * 5;
      for (const o of [-N, 0, N]) { g.beginPath(); g.moveTo(x + o, 0); g.bezierCurveTo(x + o + dx1, N * 0.33, x + o + dx2, N * 0.66, x + o + dx3, N); g.stroke(); }
    }
  };
  if (kind === 'curl') {
    for (let i = 0; i < 1400; i++) { const v = (130 + rnd() * 125) | 0; g.fillStyle = `rgba(${v},${v},${v},0.8)`; const x = rnd() * N, y = rnd() * N, r = 1 + rnd() * 2.4; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  } else if (kind === 'wave') {
    for (let y = 0; y < N; y++) { const v = (175 + 75 * Math.sin((y / N) * Math.PI * 2 * 9)) | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, y, N, 1); }
    strands(120, 170, 0.35);
  } else if (kind === 'rows') {
    strands(200, 150, 0.5);
    for (let x = 0; x < N; x += 16) { g.fillStyle = 'rgba(70,70,70,0.75)'; g.fillRect(x, 0, 2.5, N); }
  } else strands(280, 120, 0.55);
  const map = new THREE.CanvasTexture(c); map.wrapS = map.wrapT = THREE.RepeatWrapping; map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  const bump = new THREE.CanvasTexture(c); bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  return (hairTexCache[kind] = { map, bump });
}
function hairMat(color, kind = 'strand', rough = 0.6) {
  const key = `hair2|${color}|${kind}|${rough}`;
  if (!matCache.has(key)) {
    const t = hairTex(kind);
    matCache.set(key, new THREE.MeshStandardMaterial({ color, map: t.map, bumpMap: t.bump, bumpScale: 1.4, roughness: rough, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  }
  return matCache.get(key);
}
const top = (ny) => Math.max(0, ny);
const front = (nz) => Math.max(0, -nz);
// F/S/B: hairline as a polar angle from the crown (radians) at the front, sides and back.
// a crest stops at the hairline on the forehead (it used to run down over the face) and at the nape behind
const hawkLim = (az) => { const c = Math.cos(az); return c >= 0 ? 1.9 - 0.95 * c : 1.9; };
const HAIR_SPEC = {
  buzz: { F: 0.95, S: 1.45, B: 1.9, thick: () => 0.005, kind: 'curl', rough: 0.9 },
  short: { F: 0.95, S: 1.45, B: 1.95, thick: (nx, ny, nz) => 0.009 + 0.016 * top(ny) + 0.008 * front(nz) * top(ny) },
  fade: { F: 0.95, S: 1.5, B: 1.9, thick: (nx, ny) => 0.003 + 0.034 * sstep(0.15, 0.7, ny) },
  waves: { F: 0.85, S: 1.45, B: 1.9, thick: () => 0.01, kind: 'wave', rough: 0.45 },
  cornrows: { F: 0.8, S: 1.45, B: 1.95, thick: () => 0.012, kind: 'rows' },
  flattop: { F: 0.95, S: 1.45, B: 1.85, thick: (nx, ny, nz) => 0.005 + 0.12 * sstep(0.2, 0.85, ny) * (1 - 0.6 * front(nz)), flat: 0.06, kind: 'curl', rough: 0.8 },
  curly: { F: 1.05, S: 1.5, B: 2.0, thick: (nx, ny) => 0.03 + 0.03 * top(ny), noise: 0.012, kind: 'curl', rough: 0.8 },
  afro: { F: 1.1, S: 1.65, B: 2.05, thick: (nx, ny) => 0.075 + 0.075 * top(ny) + 0.02 * Math.abs(nx), noise: 0.014, kind: 'curl', rough: 0.85 },
  mohawk: { mask: (nx, ny, nz, th, az) => sstep(0.26, 0.16, Math.abs(nx)) * sstep(hawkLim(az) + 0.08, hawkLim(az) - 0.08, th), thick: () => 0.008, ridge: { w: 0.35, r: 0.06 } },
  frohawk: { mask: (nx, ny, nz, th, az) => sstep(0.45, 0.32, Math.abs(nx)) * sstep(hawkLim(az) + 0.08, hawkLim(az) - 0.08, th), thick: () => 0.02, ridge: { w: 0.6, r: 0.07 }, kind: 'curl', rough: 0.85 },
  undercut: { F: 0.92, S: 0.98, B: 1.05, thick: (nx, ny, nz) => 0.03 + 0.025 * front(nz) },
  pompadour: { F: 0.95, S: 1.45, B: 1.9, thick: (nx, ny, nz) => 0.014 + 0.018 * top(ny) + 0.08 * front(nz) * sstep(0.15, 0.8, ny), rough: 0.4 },
  spiky: { F: 0.95, S: 1.45, B: 1.9, thick: (nx, ny) => 0.018 + 0.012 * top(ny) },
  slick: { F: 0.85, S: 1.45, B: 2.05, thick: (nx, ny, nz) => 0.012 + 0.012 * top(ny) + 0.006 * Math.max(0, nz), rough: 0.28 },
  long: { F: 0.95, S: 1.85, B: 2.3, thick: (nx, ny, nz) => 0.02 + 0.018 * top(ny) + 0.012 * Math.max(0, nz), rough: 0.5 },
  bun: { F: 0.95, S: 1.5, B: 2.0, thick: (nx, ny) => 0.012 + 0.008 * top(ny), rough: 0.45 },
  ponytail: { F: 0.95, S: 1.5, B: 2.0, thick: (nx, ny) => 0.012 + 0.008 * top(ny), rough: 0.45 },
  braids: { F: 0.85, S: 1.5, B: 2.0, thick: () => 0.013, kind: 'rows' },
  dreads: { F: 1.0, S: 1.55, B: 2.0, thick: () => 0.026, kind: 'curl', rough: 0.85 },
  twists: { F: 1.0, S: 1.5, B: 1.95, thick: () => 0.026, kind: 'curl', rough: 0.8 },
};
const hairGeoCache = trackedObj();
function hairShellGeo(shape, style, spec) {
  const [w0, h, d] = HEAD_DIMS[shape] ?? HEAD_DIMS.oval;
  const w = w0 * (FACEW_K[spec.fp?.faceW] ?? 1);
  const g = headGeo(shape, 24, spec.sex ?? 'm', spec.fp ?? FP0).clone();
  const pos = g.attributes.position; const uv = g.attributes.uv;
  const hw = w / 2, hh = h / 2, hd = d / 2;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const ex = v.x / hw, ey = v.y / hh, ez = v.z / hd;
    const len = Math.hypot(ex, ey, ez) || 1;
    const nx = ex / len, ny = ey / len, nz = ez / len;
    const th = Math.acos(Math.max(-1, Math.min(1, ny)));
    const az = Math.atan2(nx, -nz); // 0 = face, +-PI = back of the head
    let m;
    if (spec.mask) m = spec.mask(nx, ny, nz, th, az);
    else {
      const c = Math.cos(az);
      const lim = c >= 0 ? spec.S + (spec.F - spec.S) * c : spec.S + (spec.B - spec.S) * -c;
      m = sstep(lim + 0.08, lim - 0.08, th + (spec.noTemple ? 0 : 0.14 * Math.exp(-((Math.abs(az) - 0.8) ** 2) / 0.06)));
    }
    let t = spec.thick(nx, ny, nz, th, az);
    if (spec.noise) t += spec.noise * Math.sin(17 * nx + 3.1) * Math.sin(19 * ny + 1.3) * Math.sin(23 * nz + 2.2);
    const off = -0.009 + (t + 0.009) * m;
    // push out along the ellipsoid normal (smooth everywhere, no seams at the box faces)
    const gx = ex / hw, gy = ey / hh, gz = ez / hd; const gl = Math.hypot(gx, gy, gz) || 1;
    v.x += (gx / gl) * off; v.y += (gy / gl) * off; v.z += (gz / gl) * off;
    if (spec.flat !== undefined && v.y > hh + spec.flat) v.y = hh + spec.flat;
    pos.setXYZ(i, v.x, v.y, v.z);
    uv.setXY(i, (Math.abs(az) / Math.PI) * 3, (th / Math.PI) * 2);
  }
  g.computeVertexNormals();
  // average normals across coincident vertices so the box seams of the base mesh don't show
  const nor = g.attributes.normal; const acc = new Map();
  for (let i = 0; i < pos.count; i++) {
    const k = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
    const a = acc.get(k) ?? [0, 0, 0, []]; a[0] += nor.getX(i); a[1] += nor.getY(i); a[2] += nor.getZ(i); a[3].push(i); acc.set(k, a);
  }
  for (const [x, y, z, ids] of acc.values()) { const l = Math.hypot(x, y, z) || 1; for (const i of ids) nor.setXYZ(i, x / l, y / l, z / l); }
  g.translate(0, 0.23, 0);
  return g;
}
/** A tapered (optionally braided) tube along points; prof = [[t, r], ...] radius along the length. */
function lockGeo(points, prof, { bumps = 0, amp = 0, squash = 1, seg = 22, radial = 10 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points);
  const g = new THREE.TubeGeometry(curve, seg, 1, radial, false);
  const pos = g.attributes.position;
  const rAt = (t) => { for (let k = 1; k < prof.length; k++) if (t <= prof[k][0]) { const [t0, r0] = prof[k - 1]; const [t1, r1] = prof[k]; return r0 + (r1 - r0) * ((t - t0) / (t1 - t0 || 1)); } return prof[prof.length - 1][1]; };
  const ctr = new THREE.Vector3(); const p = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    curve.getPointAt(t, ctr);
    let r = rAt(t);
    if (bumps) r *= 1 + amp * (Math.abs(Math.sin(t * bumps * Math.PI)) - 0.5);
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      p.fromBufferAttribute(pos, idx).sub(ctr).multiplyScalar(r);
      p.x *= squash;
      pos.setXYZ(idx, ctr.x + p.x, ctr.y + p.y, ctr.z + p.z);
    }
  }
  g.computeVertexNormals();
  return g;
}
const SPH = new THREE.SphereGeometry(1, 20, 14);
function hairExtras(shape, style, spec, fw = 1) {
  const [w0, h, d] = HEAD_DIMS[shape] ?? HEAD_DIMS.oval;
  const w = w0 * fw;
  const hw = w / 2, hh = h / 2, hd = d / 2, cy = 0.23;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // point on (a little outside) the head: az 0 = face, PI = back; th from the crown
  const surf = (az, th, k = 1) => V(Math.sin(th) * Math.sin(az) * hw * k, cy + Math.cos(th) * hh * k, -Math.sin(th) * Math.cos(az) * hd * k);
  let seed = [...style].reduce((a, ch) => a + ch.charCodeAt(0), 7); const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const out = []; // { geo, matrix?, tie? }
  const blob = (x, y, z, rx, ry, rz, rot = null) => { const g = SPH.clone(); g.scale(rx, ry, rz); if (rot) g.applyQuaternion(rot); g.translate(x, y, z); out.push({ geo: g }); };
  const along = (n, len, rad) => { const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), n.clone().normalize()); return q; };
  switch (style) {
    case 'long': {
      // one smooth curtain of hair from the scalp down past the shoulders (rows of tubes read as ringlets / a wig)
      const NU = 34, NV = 18, A0 = 1.12, A1 = Math.PI * 2 - 1.12;
      const P = [], UV = [], I = [];
      for (let j = 0; j <= NV; j++) {
        const v = j / NV;
        for (let i = 0; i <= NU; i++) {
          const u = i / NU; const az = A0 + (A1 - A0) * u; const back = (1 - Math.cos(az)) / 2;
          const endY = cy - (0.27 + 0.13 * back) - 0.012 * Math.sin(u * 23);
          let pt;
          if (v < 0.32) { const t = v / 0.32; pt = surf(az, 0.95 + t * 0.85, 1.045 + 0.06 * t); }
          else {
            const t = (v - 0.32) / 0.68; const p1 = surf(az, 1.8, 1.105);
            const flare = 1 + 0.12 * Math.sin(t * Math.PI * 0.6) - 0.05 * t * (1 - back);
            pt = V(p1.x * flare, p1.y + (endY - p1.y) * t, Math.max(p1.z * flare, -hd * 0.55 + 0.02) + 0.03 * t * back);
          }
          P.push(pt.x, pt.y, pt.z); UV.push(u * 4, v * 2.2);
        }
      }
      for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = j * (NU + 1) + i, b2 = a + 1, c = a + NU + 1, d2 = c + 1; I.push(a, c, b2, b2, c, d2); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
      g.setIndex(I); g.computeVertexNormals();
      out.push({ geo: g, double: true });
      break;
    }
    case 'bun': {
      const c = surf(Math.PI, 0.72, 1.18);
      blob(c.x, c.y, c.z, 0.085, 0.075, 0.08);
      const tieP = surf(Math.PI, 0.82, 1.06); out.push({ geo: new THREE.TorusGeometry(0.05, 0.01, 8, 18).rotateX(Math.PI / 2 - 0.7).translate(tieP.x, tieP.y, tieP.z), tie: true });
      break;
    }
    case 'ponytail': {
      const s0 = surf(Math.PI, 1.0, 1.04);
      const pts = [s0, V(0, s0.y - 0.01, s0.z + 0.06), V(0, cy - 0.12, hd + 0.08), V(0, cy - 0.3, hd + 0.05), V(0, cy - 0.38, hd + 0.04)];
      out.push({ geo: lockGeo(pts, [[0, 0.036], [0.15, 0.05], [0.5, 0.048], [0.85, 0.03], [1, 0.006]]) });
      out.push({ geo: new THREE.TorusGeometry(0.036, 0.01, 8, 16).translate(s0.x, s0.y - 0.005, s0.z + 0.035).rotateX(0), tie: true });
      break;
    }
    case 'braids': {
      for (const sd of [-1, 1]) {
        const p0 = surf(sd * 2.4, 1.55, 1.0);
        const pts = [p0, V(sd * 0.09, cy - 0.16, hd * 0.95), V(sd * 0.105, cy - 0.3, hd * 0.9 + 0.02), V(sd * 0.1, cy - 0.42, hd * 0.85 + 0.03)];
        out.push({ geo: lockGeo(pts, [[0, 0.03], [0.1, 0.034], [0.9, 0.028], [1, 0.01]], { bumps: 11, amp: 0.4, seg: 44 }) });
        const tp = pts[3]; out.push({ geo: new THREE.TorusGeometry(0.02, 0.007, 6, 12).rotateX(Math.PI / 2).translate(tp.x, tp.y + 0.015, tp.z), tie: true });
      }
      break;
    }
    case 'dreads': {
      for (let i = 0; i < 16; i++) {
        const sd = i % 2 ? 1 : -1; const az = sd * (1.25 + (Math.floor(i / 2) / 7) * (Math.PI - 1.25) + rnd() * 0.06);
        const th = 1.3 + rnd() * 0.2; const back = (1 - Math.cos(az)) / 2;
        const p0 = surf(az, th, 0.98); const p1 = surf(az, th + 0.4, 1.12);
        const len = 0.22 + 0.12 * back + rnd() * 0.05;
        const p2 = V(p1.x * 1.05, p1.y - len * 0.55, p1.z + 0.02 * back + 0.01); const p3 = V(p1.x * 1.02, p1.y - len, p1.z + 0.03 * back);
        out.push({ geo: lockGeo([p0, p1, p2, p3], [[0, 0.02], [0.1, 0.023], [0.92, 0.02], [1, 0.012]], { radial: 7, seg: 14 }) });
      }
      break;
    }
    case 'twists': {
      for (let i = 0; i < 30; i++) {
        const th = 0.12 + Math.sqrt(rnd()) * 1.3; const az = rnd() * Math.PI * 2;
        const p = surf(az, th, 1.06); const n = V(p.x / (hw * hw), (p.y - cy) / (hh * hh), p.z / (hd * hd)).normalize();
        blob(p.x + n.x * 0.025, p.y + n.y * 0.025, p.z + n.z * 0.025, 0.021, 0.045, 0.021, along(n));
      }
      break;
    }
    case 'spiky': {
      for (let i = 0; i < 16; i++) {
        const th = 0.1 + Math.sqrt(rnd()) * 0.95; const az = rnd() * Math.PI * 2;
        const p = surf(az, th, 1.05); const n = V(p.x / (hw * hw), (p.y - cy) / (hh * hh), p.z / (hd * hd)).normalize();
        n.z -= 0.25; n.normalize(); // swept up and forward a touch
        const g = new THREE.ConeGeometry(0.03, 0.085, 10).translate(0, 0.04, 0).applyQuaternion(along(n)).translate(p.x, p.y, p.z);
        out.push({ geo: g });
      }
      break;
    }
    case 'curly': {
      for (let i = 0; i < 22; i++) {
        const th = 0.1 + Math.sqrt(rnd()) * 1.15; const az = rnd() * Math.PI * 2;
        const p = surf(az, th, 1.12 + 0.05 * Math.cos(th)); blob(p.x, p.y, p.z, 0.04, 0.035, 0.04);
      }
      break;
    }
    default: break;
  }
  if (spec.ridge) {
    // mohawk / frohawk: a crest from the forehead over the crown to the nape
    const pts = [];
    for (const [az, th] of [[0, 0.5], [0, 0.3], [0, 0.1], [Math.PI, 0.15], [Math.PI, 0.55], [Math.PI, 1.0], [Math.PI, 1.45], [Math.PI, 1.8]]) pts.push(surf(az, th, 0.98));
    const r = spec.ridge.r;
    out.push({ geo: lockGeo(pts, [[0, r * 0.45], [0.2, r], [0.5, r * 1.05], [0.8, r * 0.7], [1, r * 0.25]], { squash: spec.ridge.w, seg: 30, radial: 14 }) });
  }
  return out;
}
// ---------------- eyes: glossy eyeballs with an iris, set in the sockets behind real lids (painted eyes looked dead)
const irisCache = {};
function eyeMat(color) {
  if (irisCache[color]) return irisCache[color];
  const W = 256, H = 128;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#f3eee8'; g.fillRect(0, 0, W, H);
  // faint veins/shade toward the corners, then the iris facing forward (u 0.75 = -z)
  const cx = W * 0.75, cy = H / 2;
  const wg = g.createRadialGradient(cx, cy, 20, cx, cy, 64); wg.addColorStop(0, 'rgba(0,0,0,0)'); wg.addColorStop(1, 'rgba(120,80,70,0.25)');
  g.fillStyle = wg; g.fillRect(0, 0, W, H);
  const r = 27;
  const ig = g.createRadialGradient(cx, cy, 3, cx, cy, r);
  ig.addColorStop(0, shade(color, 0.25)); ig.addColorStop(0.55, color); ig.addColorStop(0.92, shade(color, -0.35)); ig.addColorStop(1, '#1a1412');
  g.fillStyle = ig; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1;
  for (let a = 0; a < Math.PI * 2; a += 0.3) { g.beginPath(); g.moveTo(cx + Math.cos(a) * 10, cy + Math.sin(a) * 10); g.lineTo(cx + Math.cos(a) * (r - 3), cy + Math.sin(a) * (r - 3)); g.stroke(); }
  g.fillStyle = '#0a0808'; g.beginPath(); g.arc(cx, cy, 10, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (irisCache[color] = new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04, metalness: 0 }));
}
const EYE_R = 0.033; // a natural eye is about a fifth of the face's width (smaller read as beady)
const EYE_OPEN = { round: [1.2, 2.04], wide: [1.1, 2.1], narrow: [1.27, 2.0], sleepy: [1.34, 2.05] }; // almond, not round
const eyeGeoCache = trackedObj();
function lidGeo(top, edge) {
  const key = `${top}|${edge}`;
  if (eyeGeoCache[key]) return eyeGeoCache[key];
  const R = EYE_R * 1.06;
  const g = top ? new THREE.SphereGeometry(R, 24, 10, 0, Math.PI * 2, 0, edge) : new THREE.SphereGeometry(R, 24, 8, 0, Math.PI * 2, edge, Math.PI - edge);
  return (eyeGeoCache[key] = g);
}
/** Two eyes for a head; returns { group, lids } (lids blink in animateRun). */
function makeEyes(anchors, L, skin, headY) {
  const fem = L.gender === 'f';
  const [up, low] = EYE_OPEN[L.eyes] ?? EYE_OPEN.round;
  const ball = eyeGeoCache.ball ??= new THREE.SphereGeometry(EYE_R, 24, 16);
  const lash = shiny('#141010', { rough: 0.7 });
  const group = new THREE.Group();
  const lids = [];
  anchors.forEach(([x, y, z], i) => {
    const sd = i === 0 ? -1 : 1;
    const e = new THREE.Group();
    const fs = fsOf(L);
    e.position.set(x, headY + y + 0.003, z + EYE_R * 0.8); // set back under the brow (a bulging eyeball looked bug-like in profile)
    e.scale.setScalar(1 + 0.12 * fs.eyeSize); e.position.z += EYE_R * 0.12 * fs.eyeSize; // bigger eyes sit deeper, never bulge
    const b = new THREE.Mesh(ball, eyeMat(EYE_COLORS[(L.eyeColor ?? 0) % EYE_COLORS.length]));
    e.add(b);
    const lidsG = new THREE.Group(); lidsG.rotation.set(0, sd * 0.18, sd * -(0.07 + 0.16 * fs.eyeTilt)); e.add(lidsG); // follow the face's curve, outer corner up
    const upper = new THREE.Mesh(lidGeo(true, up), skin); lidsG.add(upper);
    const lower = new THREE.Mesh(lidGeo(false, low), skin); lidsG.add(lower);
    // lash line along the upper lid's edge (front half)
    const rr = EYE_R * 1.06 * Math.sin(up), yy = EYE_R * 1.06 * Math.cos(up);
    const lg = new THREE.TorusGeometry(rr, fem ? 0.0019 : 0.0011, 4, 20, Math.PI);
    const lm = new THREE.Mesh(lg, lash); lm.rotation.x = Math.PI / 2; lm.position.y = yy; upper.add(lm);
    if (fem) { const wing = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.0016, 0.002), lash); wing.position.set(sd * (rr + 0.002), yy + 0.002, -0.004); wing.rotation.z = sd * 0.5; upper.add(wing); }
    lids.push(upper);
    group.add(e);
  });
  return { group, lids };
}
/** Blink every few seconds (the upper lids tip down over the eyes and back). */
function blink(p, u, dt) {
  const lids = p.userData.lids;
  if (!lids || !(dt > 0)) return;
  u.blinkT = (u.blinkT ?? 1 + Math.random() * 3) - dt;
  let k = 0;
  if (u.blinkT < 0) { const t = -u.blinkT; k = t < 0.07 ? t / 0.07 : t < 0.16 ? 1 - (t - 0.07) / 0.09 : 0; if (t > 0.16) u.blinkT = 2 + Math.random() * 4; }
  for (const l of lids) l.rotation.x = -0.95 * k;
}
/** Neck: sternocleidomastoid taper, flaring into the traps at the base. k = thickness. */
const neckCache = trackedObj();
function neckGeo(k = 1) {
  const key = k.toFixed(2);
  if (neckCache[key]) return neckCache[key];
  const g = sculpt(0.27, [[0, 0.056 * k], [0.25, 0.058 * k], [0.55, 0.061 * k], [0.78, 0.07 * k], [0.92, 0.088 * k], [1, 0.1 * k]], 0.92, 16);
  return (neckCache[key] = g);
}
let earG = null;
/** An ear: a flattened shell with a rim, thicker at the top, a lobe at the bottom. */
function earGeo() {
  if (earG) return earG;
  const pts = [[0, 0.004], [0.15, 0.016], [0.35, 0.021], [0.6, 0.019], [0.82, 0.014], [0.95, 0.009], [1, 0.002]].map(([t, r]) => new THREE.Vector2(r, 0.03 - t * 0.062));
  const g = new THREE.LatheGeometry(pts, 12);
  g.scale(0.55, 1, 1.15);
  g.translate(0.006, 0, 0);
  g.computeVertexNormals();
  return (earG = g);
}
/** Facial hair with real volume (the painted beard stays underneath as the dense base). */
// Measured on the sculpted head (Y: crown +1, chin bottom -0.83): nose tip -0.27, under the nose -0.40,
// mouth -0.56, lower lip -0.62, chin -0.78; mouth corners at X +-0.19.
// cheek line: from the mustache corner (front) sloping up and back to the sideburn at the ear
const beardTop = (X, Z, center, side, burn) => { const front = center + (side - center) * sst(0.22, 0.6, Math.abs(X)); return front + (burn - front) * sst(-0.9, 0.1, Z); };
// ...and the back edge follows the jaw down toward the neck instead of a vertical cut
const beardArea = (X, Y, Z, center, side, burn) => { const top = beardTop(X, Z, center, side, burn); const backZ = 0.22 + 0.32 * Math.min(0, Y); return sst(top + 0.07, top - 0.07, Y) * sst(backZ + 0.12, backZ - 0.12, Z); };
function lipHole(X, Y) { return sst(0.27, 0.19, Math.abs(X)) * sst(-0.505, -0.54, Y) * sst(-0.68, -0.64, Y); }
function mustache(X, Y, Z) { return sst(0.3, 0.21, Math.abs(X)) * sst(-0.33, -0.38, Y) * sst(-0.56, -0.51, Y) * sst(-0.45, -0.75, Z); }
const BEARD_MASK = {
  full: (X, Y, Z) => beardArea(X, Y, Z, -0.34, -0.12, 0.02) * (1 - lipHole(X, Y)),
  long: (X, Y, Z) => beardArea(X, Y, Z, -0.34, -0.12, 0.02) * (1 - lipHole(X, Y)),
  boxed: (X, Y, Z) => Math.max(beardArea(X, Y, Z, -0.5, -0.3, -0.15), mustache(X, Y, Z)) * (1 - lipHole(X, Y)),
  chinstrap: (X, Y, Z) => beardArea(X, Y, Z, -0.6, -0.2, 0.0) * Math.max(sst(-0.66, -0.72, Y), sst(0.5, 0.62, Math.abs(X)), sst(-0.4, -0.2, Z)),
  muttonchops: (X, Y, Z) => beardArea(X, Y, Z, -0.5, -0.12, 0.05) * Math.max(sst(0.32, 0.62, Math.abs(X)), sst(-0.55, -0.15, Z)) * sst(-0.88, -0.5, Y) * (1 - 0.6 * sst(-0.3, -0.6, Y) * sst(0.62, 0.4, Math.abs(X))),
  goatee: (X, Y, Z) => Math.max(sst(0.3, 0.22, Math.abs(X)) * sst(-0.6, -0.66, Y) * sst(-0.4, -0.7, Z), mustache(X, Y, Z)) * (1 - lipHole(X, Y)),
  vandyke: (X, Y, Z) => Math.max(sst(0.18, 0.11, Math.abs(X)) * sst(-0.64, -0.7, Y) * sst(-0.4, -0.7, Z), mustache(X, Y, Z)) * (1 - lipHole(X, Y)),
  mustache: (X, Y, Z) => mustache(X, Y, Z),
  handlebar: (X, Y, Z) => mustache(X, Y, Z),
  soulpatch: (X, Y, Z) => sst(0.09, 0.05, Math.abs(X)) * sst(-0.64, -0.67, Y) * sst(-0.73, -0.7, Y) * sst(-0.5, -0.8, Z),
};
const beardCache = trackedObj();
function addBeard(neck, L, hairC) {
  const mask = BEARD_MASK[L.beard];
  if (!mask) return;
  const shape = L.headShape ?? 'oval';
  const fp = faceParams(L);
  const key = `${shape}|${L.beard}|${fpKey(fp)}`;
  const geo = (beardCache[key] ??= (() => {
    const [w0, h, d] = HEAD_DIMS[shape] ?? HEAD_DIMS.oval;
    const w = w0 * (FACEW_K[fp.faceW] ?? 1);
    const g = headGeo(shape, 40, 'm', fp).clone();
    const pos = g.attributes.position; const nor = g.attributes.normal;
    const thick = L.beard === 'long' ? 0.022 : L.beard === 'full' ? 0.016 : L.beard === 'boxed' ? 0.012 : L.beard === 'muttonchops' ? 0.006 : 0.01;
    for (let i = 0; i < pos.count; i++) {
      const X = pos.getX(i) / (w / 2), Y = pos.getY(i) / (h / 2), Z = pos.getZ(i) / (d / 2);
      let m = mask(X, Y, Z);
      let t = thick * m;
      if (L.beard === 'long') t += 0.03 * m * sst(-0.6, -1, Y) * sst(0.5, 0, Math.abs(X)); // hangs at the chin
      const off = -0.004 + (t + 0.004) * Math.min(1, m * 1.4);
      pos.setXYZ(i, pos.getX(i) + nor.getX(i) * off, pos.getY(i) + nor.getY(i) * off - (L.beard === 'long' ? t * 0.8 : 0), pos.getZ(i) + nor.getZ(i) * off);
    }
    g.computeVertexNormals(); smoothSeams(g);
    g.translate(0, 0.23, 0);
    return g;
  })());
  const natural = (L.hairColor ?? 0) <= 8 ? hairC : HAIR_COLORS[1];
  // very dark beards get a little lift and sheen so they read as hair, not a black blob
  const bcol = (L.hairColor ?? 0) <= 1 ? shade(natural, 0.22) : shade(natural, -0.05);
  neck.add(new THREE.Mesh(geo, hairMat(bcol, 'curl', 0.62)));
}
function addHairVolume(neck, L, hairC) {
  const style = L.hairStyle;
  const spec = HAIR_SPEC[style];
  if (!spec) return; // bald
  const shape = L.headShape ?? 'oval';
  const sex = L.gender === 'f' ? 'f' : 'm';
  const fp = faceParams(L);
  const key = `${shape}|${style}|${sex}|${fpKey(fp)}`;
  const cached = (hairGeoCache[key] ??= { shell: hairShellGeo(shape, style, { ...spec, sex, fp }), extras: hairExtras(shape, style, spec, FACEW_K[fp.faceW] ?? 1) });
  const mat = hairMat(hairC, spec.kind ?? 'strand', spec.rough ?? 0.6);
  const lockMat = style === 'dreads' || style === 'twists' || style === 'curly' ? hairMat(hairC, 'curl', 0.85) : hairMat(hairC, 'strand', spec.rough ?? 0.55);
  const tieMat = shiny(L.gender === 'f' ? '#c2185b' : '#1b1b1b', { rough: 0.5 });
  neck.add(new THREE.Mesh(cached.shell, mat));
  const dbl = (m) => { const k = m.uuid + '|dbl'; if (!matCache.has(k)) { const c = m.clone(); c.side = THREE.DoubleSide; matCache.set(k, c); } return matCache.get(k); };
  for (const e of cached.extras) neck.add(new THREE.Mesh(e.geo, e.tie ? tieMat : e.double ? dbl(lockMat) : lockMat));
}
/** Hair that shows under a helmet: long hair, ponytails, braids and locs hang out the back. */
function helmetHair(neck, L, hairC) {
  const style = L.hairStyle;
  if (!['long', 'ponytail', 'braids', 'dreads', 'bun'].includes(style)) return;
  const key = `helmet|${style}`;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const geos = (hairGeoCache[key] ??= (() => {
    const out = [];
    if (style === 'long') for (const x of [-0.12, -0.06, 0, 0.06, 0.12]) out.push(lockGeo([V(x * 0.9, 0.08, 0.17), V(x, 0.0, 0.225), V(x * 1.05, -0.1, 0.24), V(x, -0.2 - Math.abs(x) * 0.3, 0.235)], [[0, 0.035], [0.2, 0.045], [0.8, 0.04], [1, 0.006]]));
    else if (style === 'ponytail' || style === 'bun') out.push(lockGeo([V(0, 0.06, 0.2), V(0, -0.01, 0.245), V(0, -0.12, 0.25), V(0, -0.22, 0.235)], [[0, 0.035], [0.25, 0.045], [0.8, 0.032], [1, 0.006]]));
    else if (style === 'braids') for (const sd of [-1, 1]) out.push(lockGeo([V(sd * 0.08, 0.06, 0.19), V(sd * 0.09, -0.04, 0.235), V(sd * 0.1, -0.16, 0.24), V(sd * 0.1, -0.27, 0.23)], [[0, 0.028], [0.9, 0.026], [1, 0.01]], { bumps: 10, amp: 0.4, seg: 40 }));
    else for (let i = 0; i < 7; i++) { const x = -0.14 + i * 0.047; out.push(lockGeo([V(x * 0.9, 0.07, 0.18), V(x, -0.02, 0.228), V(x * 1.04, -0.12, 0.236), V(x, -0.18 - (i % 3) * 0.03, 0.232)], [[0, 0.02], [0.9, 0.019], [1, 0.012]], { radial: 7, seg: 12 })); }
    return out;
  })());
  const mat = hairMat(hairC, style === 'dreads' ? 'curl' : 'strand', 0.55);
  for (const g of geos) neck.add(new THREE.Mesh(g, mat));
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

// ------------------------------------------------------------------ celebrations
// Each routine is a little sequence on a loop: beats with anticipation (a dip before a jump, a wind-up before a
// spike), overshoot and settle, the whole body involved (knees, hips, head), never a pure metronome sine.
const ease = (x) => smooth01(Math.max(0, Math.min(1, x)));
const pulse = (x, at, len) => { const q = (x - at) / len; return q <= 0 || q >= 1 ? 0 : Math.sin(q * Math.PI); }; // 0 -> 1 -> 0 bump
const wob = (t, a, b, c) => Math.sin(t * a) * 0.6 + Math.sin(t * b + 1.3) * 0.3 + Math.sin(t * c + 2.1) * 0.1; // irregular sway
function celebPose(c, t, P, u, m) {
  const L = m > 0; // lead arm: right when m > 0
  const setArm = (lead, sh, el, out) => { if (lead === L) { P.rs = sh; P.re = el; if (out !== undefined) P.rout = -out; } else { P.ls = sh; P.le = el; if (out !== undefined) P.lout = out; } };
  if (c === 'pump') {
    // crouch, explode up with a double fist pump, a few quick pumps with knee drive, then a roar to the crowd
    const x = t % 2.6;
    const dip = pulse(x, 0, 0.35);
    const up = ease((x - 0.25) / 0.2) * (1 - ease((x - 2.2) / 0.4));
    const beat = Math.max(0, Math.sin((x - 0.45) * 11)) * (x > 0.45 && x < 1.8 ? 1 : 0);
    P.y = -0.18 * dip + 0.02 * up; P.spine = 0.35 * dip - 0.18 * up; P.head = 0.3 * up;
    P.lh = 0.6 * dip + 0.5 * beat * (L ? 1 : 0.3); P.lk = 0.9 * dip + 0.9 * beat * (L ? 1 : 0.3);
    P.rh = 0.6 * dip + 0.5 * beat * (L ? 0.3 : 1); P.rk = 0.9 * dip + 0.9 * beat * (L ? 0.3 : 1);
    setArm(true, 0.4 + 2.3 * up - 0.5 * beat, 1.6 - 0.9 * up + 0.6 * beat, 0.2);
    setArm(false, 0.4 + 1.8 * up * (x > 1.2 ? 1 : 0.4), 1.4, 0.35);
    u.hop = Math.max(u.hop, pulse(x, 0.3, 0.45) * 0.45 + beat * 0.06);
    P.ny = m * 0.4 * ease((x - 1.8) / 0.3); P.sy = m * 0.15 * up;
  } else if (c === 'dance') {
    // loose two-step: weight rolls hip to hip, shoulders shimmy off the beat, arms swing relaxed, knees bounce
    const b = t * 7.2;
    const sway = Math.sin(b * 0.5);
    const bounce = Math.abs(Math.sin(b));
    P.y = -0.1 - bounce * 0.06; P.rz = sway * 0.18; P.hy = sway * 0.35; P.sy = -sway * 0.25 + Math.sin(b * 2 + 0.6) * 0.08;
    P.lh = Math.max(0, sway) * 0.55; P.lk = 0.35 + Math.max(0, sway) * 0.7; P.rh = Math.max(0, -sway) * 0.55; P.rk = 0.35 + Math.max(0, -sway) * 0.7;
    P.ls = 0.9 + Math.sin(b * 0.5 + 0.8) * 0.7; P.rs = 0.9 - Math.sin(b * 0.5 + 0.8) * 0.7; P.le = 1.3 + bounce * 0.3; P.re = 1.3 + bounce * 0.3;
    P.lout = 0.35 + Math.sin(b) * 0.1; P.rout = -0.35 - Math.sin(b) * 0.1; P.lw = 0.4; P.rw = 0.4;
    P.head = 0.08 + Math.sin(b + 0.4) * 0.07; P.ny = sway * 0.25; P.spine = 0.12 + bounce * 0.05;
    const spin = (t % 5.5) > 4.4 ? ease(((t % 5.5) - 4.4) / 0.9) : 0; // a little spin every so often
    if (spin > 0) P.ry = m * spin * Math.PI * 2;
  } else if (c === 'flex') {
    // land into a wide base, hit the double-bicep pose with a squeeze, turn to show each arm, then a roar
    const x = t % 3.4;
    const set = ease(x / 0.3);
    const squeeze = pulse(x, 0.35, 0.5) + pulse(x, 1.5, 0.5) * 0.8;
    const look = x < 1.2 ? 1 : x < 2.2 ? -1 : 0;
    const roar = pulse(x, 2.3, 1.0);
    P.y = -0.14 * set - 0.05 * squeeze; P.lh = 0.45 * set; P.rh = -0.2 * set; P.lk = 0.55 * set; P.rk = 0.45 * set;
    P.ls = 1.6 * set - 0.4 * roar; P.rs = 1.6 * set - 0.4 * roar; P.lout = 1.3 * set + 0.15 * squeeze; P.rout = -1.3 * set - 0.15 * squeeze;
    P.le = 2.2 * set + 0.15 * squeeze - 0.8 * roar; P.re = 2.2 * set + 0.15 * squeeze - 0.8 * roar;
    P.spine = -0.12 * set + 0.25 * roar; P.head = 0.25 * roar - 0.05; P.ny = look * m * 0.55 * set * (1 - roar);
    P.sy = look * m * 0.12 * set; P.lw = -0.3; P.rw = -0.3;
  } else if (c === 'flip') {
    // crouch (anticipation), launch, tuck and rotate, land and absorb, then a fist pump while you catch your breath
    const x = t % 2.8;
    const crouch = pulse(x, 0, 0.5);
    const air = (x - 0.32) / 0.75;
    if (air > 0 && air < 1) {
      P.rx = -ease(air) * Math.PI * 2; u.hop = Math.max(u.hop, Math.sin(air * Math.PI) * 1.4);
      const tuck = Math.sin(air * Math.PI);
      P.lh = 1.7 * tuck; P.rh = 1.7 * tuck; P.lk = 2.1 * tuck; P.rk = 2.1 * tuck; P.ls = 1.2 * tuck; P.rs = 1.2 * tuck; P.le = 1.4 * tuck; P.re = 1.4 * tuck;
    } else {
      const land = pulse(x, 1.07, 0.4);
      P.y = -0.3 * crouch - 0.24 * land; P.lh = 0.9 * (crouch + land); P.rh = 0.9 * (crouch + land); P.lk = 1.5 * (crouch + land); P.rk = 1.5 * (crouch + land);
      P.spine = 0.5 * (crouch + land); P.ls = -0.7 * crouch + 0.6 * land; P.rs = -0.7 * crouch + 0.6 * land;
      const after = ease((x - 1.45) / 0.3) * (1 - ease((x - 2.5) / 0.3));
      if (after > 0) { setArm(true, 0.4 + 2.2 * after, 0.8, 0.2); P.head = 0.25 * after; }
    }
  } else if (c === 'salute') {
    // snap to attention, sharp salute held a beat, then drop it and pound the chest twice
    const x = t % 3.0;
    const att = ease(x / 0.25);
    const sal = ease((x - 0.2) / 0.18) * (1 - ease((x - 1.6) / 0.25));
    const pound = pulse(x, 1.9, 0.28) + pulse(x, 2.3, 0.28);
    P.spine = -0.06 * att; P.head = 0.04 * att; P.y = 0.01 * att;
    setArm(true, 0.2 + 2.4 * sal + 1.1 * (1 - sal) * ease((x - 1.75) / 0.15), 0.3 + 2.0 * sal + 1.6 * (1 - sal) * ease((x - 1.75) / 0.15) - 0.6 * pound, 0.1 + 0.5 * sal);
    setArm(false, 0.05, 0.15);
    P.ny = m * 0.2 * sal;
  } else if (c === 'point') {
    // both arms to the sky, look up, slowly turn to the crowd with one finger up, then the other
    const x = t % 4.0;
    const raise = ease(x / 0.4);
    const swap = x > 2.0 ? ease((x - 2.0) / 0.35) : 0;
    const sway = wob(t, 1.3, 2.1, 3.7);
    setArm(true, 2.9 * raise * (1 - swap * 0.65), 0.05, 0.35);
    setArm(false, 2.9 * raise * (0.4 + swap * 0.6), 0.05 + 0.6 * (1 - raise), 0.35);
    P.head = 0.45 * raise - 0.2 * swap; P.spine = -0.12 * raise; P.ny = m * 0.35 * swap + sway * 0.08;
    P.sy = sway * 0.08; P.rz = sway * 0.03; P.y = -0.03 * Math.abs(sway);
  } else if (c === 'bow') {
    // a slow theatrical bow with an arm sweep, rise, a little wave to the crowd
    const x = t % 3.6;
    const down = ease((x - 0.3) / 0.6) * (1 - ease((x - 1.6) / 0.5));
    const sweep = ease(x / 0.5);
    P.spine = 1.0 * down; P.head = -0.3 * down; P.y = -0.06 * down; P.rh = -0.25 * down; P.lk = 0.25 * down;
    setArm(true, 1.2 * sweep * (1 - down) + 0.9 * down, 0.5 + 0.9 * down, 0.9 * sweep * (1 - down) + 0.2);
    setArm(false, 0.25 + 0.4 * down, 1.3 * down, -0.1);
    const wave = ease((x - 2.3) / 0.3) * (1 - ease((x - 3.3) / 0.3));
    if (wave > 0) { setArm(true, 2.6 * wave, 0.4 + Math.sin(t * 13) * 0.35 * wave, 0.4); }
  } else if (c === 'shuffle') {
    // quick feet: side-to-side shuffle, arms swinging loose, then stop and point at the crowd
    const x = t % 3.2;
    const go = x < 2.2 ? 1 : 0;
    const f = Math.sin(t * 15);
    P.lh = go * Math.max(0, f) * 0.6; P.rh = go * Math.max(0, -f) * 0.6; P.lk = 0.35 + go * Math.max(0, f) * 0.9; P.rk = 0.35 + go * Math.max(0, -f) * 0.9;
    P.y = -0.12 - go * Math.abs(f) * 0.04; P.sx = go * Math.sin(t * 3) * 0.06; P.rz = go * Math.sin(t * 3) * 0.08;
    P.ls = go * f * 0.9 + 0.3; P.rs = -go * f * 0.9 + 0.3; P.le = 1.1; P.re = 1.1; P.spine = 0.18; P.hy = go * f * 0.2; P.sy = -go * f * 0.15;
    if (!go) { const pt = ease((x - 2.2) / 0.2); setArm(true, 1.6 * pt, 0.05, 0.1); P.ny = m * 0.3 * pt; P.head = 0.1; }
  } else if (c === 'heart') {
    // hands come together into a heart over the chest, held up to the crowd, then a hand on the crest
    const x = t % 3.6;
    const up = ease((x - 0.1) / 0.4) * (1 - ease((x - 2.2) / 0.4));
    const crest = ease((x - 2.5) / 0.3);
    P.ls = 1.5 * up + 0.9 * crest * (L ? 0 : 1); P.rs = 1.5 * up + 0.9 * crest * (L ? 1 : 0); P.le = 1.5 * up + 2.0 * crest * (L ? 0 : 1); P.re = 1.5 * up + 2.0 * crest * (L ? 1 : 0);
    P.lout = -0.55 * up; P.rout = 0.55 * up; P.lw = -0.6 * up; P.rw = -0.6 * up; P.head = 0.15 * up - 0.1 * crest;
    const sway = wob(t, 1.1, 1.9, 3.1); P.ny = sway * 0.3 * up; P.rz = sway * 0.03;
  } else if (c === 'leanback') {
    // lean way back, arms spread wide, rocking with the crowd
    const x = t % 3.0;
    const lean = ease(x / 0.4) * (1 - ease((x - 2.5) / 0.4));
    const rock = Math.sin(t * 4) * lean;
    P.spine = -0.45 * lean; P.head = 0.35 * lean; P.y = -0.12 * lean; P.lk = 0.6 * lean; P.rk = 0.6 * lean; P.lh = 0.3 * lean; P.rh = 0.3 * lean;
    P.ls = 0.6 * lean; P.rs = 0.6 * lean; P.lout = 1.3 * lean + rock * 0.12; P.rout = -1.3 * lean + rock * 0.12; P.le = 0.3; P.re = 0.3; P.rz = rock * 0.07;
  } else {
    celebPose('pump', t, P, u, m);
  }
}

const ACTION_DUR = { slip: 0.55, stuck: 0.45, throw: 0.55, catch: 0.5, jump: 0.7, juke: 0.35, spin: 0.5, stiff: 0.6, dive: 0.7, tackle: 0.55, lunge: 0.4, fall: 0.5, getup: 0.7, wave: 1.2, spike: 0.9, release: 0.3, cut: 0.25 };

/** Pose for this frame. Returns target joint angles. */
function computePose(u, dt) {
  const P = { lh: 0, lk: 0, rh: 0, rk: 0, ls: 0.1, le: 0.3, rs: 0.1, re: 0.3, lout: 0.12, rout: -0.12, spine: 0.05, y: 0, rz: 0, ry: 0, rx: 0, head: 0, hy: 0, sy: 0, ny: 0, sx: 0, lw: 0.08, rw: 0.08 };
  const s = u.speed;
  // ---- locomotion
  if (s > 0.4 && !u.down) {
    const run = Math.min(1, s / 7);
    const gt = u.gait ?? { stride: 1, arm: 1, lean: 0, tempo: 1, bounce: 1 };
    // cadence follows ground speed: one full stride cycle covers cycleLen yards, so planted feet don't skate
    // (longer strides when sprinting, quicker shorter steps when backpedalling)
    const cycleLen = Math.min(3.7, Math.max(1.0, 0.95 + s * 0.29)) * gt.stride * (u.back ? 0.62 : 1) * (u.legK ?? 1);
    u.omega = Math.max(4.5, (2 * Math.PI * s) / cycleLen) * gt.tempo;
    u.cycleLen = cycleLen;
    u.duty = u.back ? 0.6 : 0.62 - run * 0.26; // share of the cycle a foot is on the ground (sprinters fly)
    u.phase += dt * u.omega;
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
      // hands flick at the end of each arm swing (relaxed wrists, knife-hand when sprinting)
      P.lw = 0.05 + Math.max(0, a) * 0.3 * run; P.rw = 0.05 + Math.max(0, -a) * 0.3 * run;
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
    // glance around every few seconds (eased, not snapped)
    if (!u.lookT || u.idleT > u.lookT) { u.lookT = u.idleT + 2 + Math.random() * 3; u.look = (Math.random() - 0.5) * 1.1; }
    u.lookS = (u.lookS ?? 0) + ((u.look ?? 0) - (u.lookS ?? 0)) * Math.min(1, dt * 3);
    P.ny = u.lookS;
    // fidgets now and then: hands on hips, bounce on the toes, shake the arms out, a clap
    if (!u.hold && !u.action && !u.celebrate) {
      if (!u.fidT) u.fidT = u.idleT + 3 + Math.random() * 5;
      if (!u.fid && u.idleT > u.fidT) { u.fid = { k: ['hips', 'bounce', 'shake', 'clap', 'hips'][Math.floor(Math.random() * 5)], t: 0, dur: 1.6 + Math.random() * 1.6 }; }
      if (u.fid) {
        const f = u.fid; f.t += dt;
        const w = smooth01(Math.min(f.t / 0.3, (f.dur - f.t) / 0.3));
        const F = {};
        if (f.k === 'hips') { F.ls = -0.15; F.rs = -0.15; F.lout = 0.75; F.rout = -0.75; F.le = 1.9; F.re = 1.9; F.spine = 0.0; }
        else if (f.k === 'bounce') { F.y = -0.04 - Math.abs(Math.sin(f.t * 9)) * 0.04; F.lk = 0.25 + Math.abs(Math.sin(f.t * 9)) * 0.15; F.rk = F.lk; F.ls = 0.25; F.rs = 0.25; F.le = 0.9; F.re = 0.9; }
        else if (f.k === 'shake') { F.ls = 0.15 + Math.sin(f.t * 21) * 0.25; F.rs = 0.15 - Math.sin(f.t * 23) * 0.25; F.lw = Math.sin(f.t * 30) * 0.6; F.rw = Math.cos(f.t * 28) * 0.6; F.lout = 0.25; F.rout = -0.25; F.head = -0.1; }
        else if (f.k === 'clap') { const c = Math.max(0, Math.sin(f.t * 10)); F.ls = 1.0; F.rs = 1.0; F.le = 1.3; F.re = 1.3; F.lout = -0.25 - c * 0.3; F.rout = 0.25 + c * 0.3; }
        for (const key in F) P[key] = P[key] + (F[key] - P[key]) * w;
        if (f.t >= f.dur) { u.fid = null; u.fidT = u.idleT + 4 + Math.random() * 7; }
      }
    }
  }
  if (s > 0.4 || u.hold || u.action || u.celebrate) u.fid = null;
  // ---- held poses
  const hold = u.hold;
  if (hold === 'stance') { P.y = -0.32; P.spine = 1.0; P.lh = 0.9; P.lk = 1.5; P.rh = 0.3; P.rk = 1.1; P.ls = 1.4; P.le = 0; P.rs = 0.5; P.re = 0.5; P.head = -0.6; }
  if (hold === 'block' || hold === 'tackle') { P.y = -0.16; P.spine = 0.55; P.lh = 0.5; P.lk = 0.9; P.rh = -0.3; P.rk = 0.7; P.ls = 1.35; P.rs = 1.35; P.le = 0.25; P.re = 0.25; P.lout = -0.15; P.rout = 0.15; P.head = -0.3; }
  if (hold === 'throw' || hold === 'throwWind') { P.rs = -2.5; P.re = 1.3; P.rout = -0.3; P.ls = 0.9; P.le = 0.6; P.spine = -0.1; P.ry = 0.5; }
  if (hold === 'catch' || hold === 'catchReach') { P.ls = 1.7; P.rs = 1.7; P.le = 0.2; P.re = 0.2; P.lout = -0.1; P.rout = 0.1; P.lw = -0.4; P.rw = -0.4; }
  if (hold === 'jump' || hold === 'jumpCatch') { P.ls = 2.9; P.rs = 2.9; P.le = 0.1; P.re = 0.1; P.lh = 0.9; P.lk = 1.6; P.rh = 0.3; P.rk = 1.0; }
  if (hold === 'dive') { P.rx = 1.2; P.y = -0.5; P.ls = 2.8; P.rs = 2.8; P.le = 0; P.re = 0; P.lh = -0.3; P.rh = -0.4; }
  if (hold === 'sit') { P.y = -0.45; P.lh = 1.55; P.rh = 1.55; P.lk = 1.55; P.rk = 1.55; P.ls = 0.4; P.rs = 0.4; P.le = 1.1; P.re = 1.1; }
  if (hold === 'wave') { P.rs = 2.8; P.re = 0.6 + Math.sin(u.phase * 6) * 0.4; }
  if (hold === 'reach') { P.spine = 0.38; P.rs = 1.05; P.re = 0.25; P.rout = 0.05; P.ls = 0.3; P.le = 0.4; P.head = -0.25; } // reach for something on a table
  if (hold === 'hatOn') { P.ls = 2.75; P.rs = 2.75; P.le = 1.75; P.re = 1.75; P.lout = -0.35; P.rout = 0.35; } // both hands up at the head
  // nobody holds a stance like a statue: breathing, small weight shifts, eyes moving
  if (hold === 'stance' || hold === 'block' || hold === 'tackle' || hold === 'sit') {
    u.br = (u.br ?? Math.random() * 6) + dt * (hold === 'sit' ? 1.4 : 2.4);
    P.spine += Math.sin(u.br) * 0.03; P.head += Math.sin(u.br * 0.37 + 1) * 0.04; P.ny += Math.sin(u.br * 0.21) * 0.12;
    P.ls += Math.sin(u.br + 0.5) * 0.04; P.rs += Math.sin(u.br + 1.7) * 0.04; P.y += Math.sin(u.br) * 0.008;
  }
  if (hold === 'getup') { P.y = -0.5; P.spine = 0.9; P.lh = 1.4; P.lk = 2; P.rh = 0.6; P.rk = 1.4; P.ls = 1; P.rs = 1; }
  // ---- one-shot actions (blended in and out of the pose underneath so they don't snap)
  const act = u.action;
  const preAct = act ? { ...P } : null;
  if (act) {
    act.t += dt;
    const p = Math.min(1, act.t / act.dur);
    const k = Math.sin(p * Math.PI);
    const e = smooth01(p); // eased progress
    switch (act.name) {
      case 'throw': if (p < 0.45) { const w = smooth01(p / 0.45); P.rs = -2.6 * w; P.re = 1.4; P.ry = 0.6 * w; P.spine = -0.12 * w; P.rw = -0.5 * w; P.ls = 0.8 + 0.4 * w; P.lh = 0.25 * w; P.rk = 0.3 * w; } else { const w = 1 - Math.pow(1 - (p - 0.45) / 0.55, 3); P.rs = -2.6 + 4.2 * w; P.re = 1.4 - 1.1 * w; P.ry = 0.6 - 0.95 * w; P.spine = -0.12 + 0.45 * w; P.rw = -0.5 + 1.2 * w; P.ls = 1.2 - 1.0 * w; P.lout = 0.3 * w; P.rh = 0.3 * w; P.lk = 0.25 * w; } break; // step into it, the hips lead, the arm whips through // wrist cocks back, then snaps through the release
      case 'release': P.rs = 1.6; P.re = 0.2; P.spine = 0.3; P.ry = -0.3; break;
      case 'catch': P.ls = 1.6 + k * 0.6; P.rs = 1.6 + k * 0.6; P.le = 0.2; P.re = 0.2; P.lw = -0.45; P.rw = -0.45; break; // hands open toward the ball
      case 'jump': P.ls = 2.9; P.rs = 2.9; P.le = 0.1; P.re = 0.1; P.lh = 0.9 * k; P.lk = 1.6 * k; P.rh = 0.3; P.rk = 1.0 * k; u.hop = Math.max(u.hop, k * 0.9); break;
      case 'slip': P.y = -0.22 * k; P.rz = (act.dir ?? 1) * 0.5 * k; P.lh = 0.9 * k; P.lk = 0.2; P.rh = -0.3 * k; P.rk = 0.9 * k; P.ls = 1.3 * k; P.rs = 0.4; P.lout = 0.9 * k; P.rout = -1.1 * k; P.spine = -0.2 * k; break; // a foot kicks out, arms fly out for balance
      case 'stuck': P.spine = 0.45; P.y = -0.1; P.lh = 0.7 * Math.max(0, Math.sin(act.t * 22)); P.rh = 0.7 * Math.max(0, -Math.sin(act.t * 22)); P.lk = 1.1; P.rk = 1.1; P.ls = -Math.sin(act.t * 22) * 1.1; P.rs = Math.sin(act.t * 22) * 1.1; P.le = 1.4; P.re = 1.4; break; // churning legs, going nowhere
      case 'juke': case 'cut': P.rz = (act.dir ?? 1) * 0.45 * k; P.y = -0.15 * k; P.lh = 0.6 * k * (act.dir ?? 1); P.rh = -0.6 * k * (act.dir ?? 1); P.lk = 0.6; P.rk = 0.6; P.spine = 0.3; break;
      case 'spin': P.ry = p * Math.PI * 2; P.spine = 0.25; P.ls = 1.1; P.rs = 0.4; P.lout = 0.6; P.rout = -0.9; break;
      case 'stiff': P.ls = 1.55; P.le = 0; P.lout = -0.05; P.spine = 0.35; P.rs = 0.2; P.re = 1.5; break;
      case 'dive': P.rx = 1.25 * smooth01(Math.min(1, p * 2)); P.y = -0.55 * smooth01(Math.min(1, p * 2)); P.ls = 2.8; P.rs = 2.8; P.le = 0; P.re = 0; P.lh = -0.3; P.rh = -0.4; break;
      case 'lunge': if (p < 0.5) { P.y = -0.25 * (p / 0.5); P.spine = 0.7; P.ls = -0.4; P.rs = -0.4; } else { P.y = -0.2; P.spine = 1.0; P.rx = 0.5 * ((p - 0.5) / 0.5); P.ls = 1.6; P.rs = 1.6; P.le = 0.3; P.re = 0.3; } break;
      case 'tackle': P.rx = 0.9 * k; P.y = -0.35 * k; P.ls = 1.5; P.rs = 1.5; P.lout = -0.4; P.rout = 0.4; P.le = 0.6; P.re = 0.6; P.spine = 0.6; break;
      case 'fall': P.rx = -1.45 * e; P.y = -0.62 * e; P.ls = 1.8 * e; P.rs = 2.2 * e; P.lh = 0.8 * e; P.rh = 1.2 * e; P.lout = 0.5 * k; P.rout = -0.6 * k; P.head = 0.4 * k; break; // arms fly out to break the fall
      case 'getup': { // roll to a knee, push off the ground with a hand, stand
        const q = 1 - e;
        P.rx = -1.45 * Math.max(0, 1 - p * 1.8) + 0.5 * Math.sin(Math.min(1, p * 1.6) * Math.PI); P.y = -0.62 * q;
        P.lh = 1.5 * q; P.lk = 2.0 * q; P.rh = 0.5 * q; P.rk = 1.3 * Math.sin(p * Math.PI);
        P.rs = 1.2 * Math.sin(Math.min(1, p * 1.5) * Math.PI); P.re = 0.2; P.ls = 0.4 * q; P.spine = 0.7 * k; P.head = -0.2 * k; break;
      }
      case 'spike': if (p < 0.5) { P.rs = 2.8; P.re = 0.2; u.hop = Math.max(u.hop, k * 0.5); } else { P.rs = 2.8 - 4.2 * ((p - 0.5) / 0.5); P.spine = 0.6; } break;
      case 'wave': P.rs = 2.8; P.re = 0.6 + Math.sin(act.t * 14) * 0.4; break;
      default: break;
    }
    // fade in over the first ~0.1 s; actions that return to normal also fade out over the last ~0.15 s
    const keepEnd = act.then || act.name === 'fall' || act.name === 'dive' || act.name === 'spin';
    const win = Math.min(1, act.t / Math.min(0.1, act.dur * 0.3), keepEnd ? 1 : Math.max(0, act.dur - act.t) / Math.min(0.15, act.dur * 0.35));
    const bw = smooth01(win);
    if (bw < 1 && act.name !== 'spin') for (const key in P) P[key] = preAct[key] + (P[key] - preAct[key]) * bw;
    if (p >= 1) {
      u.action = null;
      if (act.then === 'down') { u.down = true; u.downT = 0; }
      else if (act.then) u.hold = act.then;
    }
  }
  // ---- celebrations: multi-beat routines with anticipation and follow-through, eased in, every player at
  // their own tempo and mirrored at random so a group of teammates doesn't move in lockstep
  if (u.celebrate && !u.down) {
    const t = (u.celebT = (u.celebT ?? 0) + dt);
    u.cs ??= 0.86 + Math.random() * 0.28; // personal tempo
    u.cm ??= Math.random() < 0.5 ? 1 : -1; // lead side
    const base = { ...P };
    celebPose(u.celebrate, t * u.cs, P, u, u.cm);
    const w = smooth01(Math.min(1, t / 0.35)); // ease into it from whatever they were doing
    for (const key in P) P[key] = base[key] + (P[key] - base[key]) * w;
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
  const k = 1 - Math.exp(-12 * dt); // body offsets ease (a touch softer than the joints' springs)
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
  if (r.armL.wrist) { S(r.armL.wrist.rotation, 'x', P.lw, 80, 9); S(r.armR.wrist.rotation, 'x', P.rw, 80, 9); } // loose wrists lag and overshoot a touch
  L(r.hips.rotation, 'y', P.hy);
  L(r.spine.rotation, 'y', P.sy + (u.lookW > 0.01 ? u.spineLook ?? 0 : 0));
  L(r.neck.rotation, 'y', P.ny - P.sy * 0.6 - P.hy * 0.6);
  L(r.body.position, 'x', P.sx);
  // body: position offset (crouch/hop), roll (juke lean), pitch (dive/fall), yaw (spin)
  u.hop = Math.max(0, u.hop - dt * 2.2);
  L(r.body.position, 'y', P.y + u.hop + (u.gfix ?? 0) - (u.pelvis ?? 0));
  // body roll wobbles a little (bumps, cuts) on a softer spring
  u.rzv = (u.rzv ?? 0) + (95 * (P.rz - r.body.rotation.z) - 11 * (u.rzv ?? 0)) * sdt;
  r.body.rotation.z += u.rzv * sdt;
  if (Math.abs(r.body.rotation.x) > Math.PI * 1.5 && Math.abs(P.rx) < 1) r.body.rotation.x -= Math.sign(r.body.rotation.x) * Math.PI * 2; // after a flip, don't unwind it backwards
  r.body.rotation.x += (-P.rx - r.body.rotation.x) * k; // pitch forward = negative x on this rig
  if (Math.abs(P.ry) > 3) r.body.rotation.y = P.ry; else L(r.body.rotation, 'y', P.ry);
  // smooth facing
  let d = u.targetYaw - p.rotation.y;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  p.rotation.y += d * (1 - Math.exp(-12 * dt));
  lookAtTarget(p, P, dt);
  legIK(p, dt, jv);
  jointLimits(r);
  groundContact(p, dt);
}

// ------------------------------------------------------------------ biomechanics: IK feet, joint limits, ground, gaze
// Leg lengths in the hips' local space (hip pivot -> knee -> ankle), see mkLeg.
const THIGH = 0.48, SHIN = 0.44;
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const IK_HOLDS = new Set([null, 'catch', 'throw', 'wave', 'reach', 'hatOn', 'block', 'tackle']);
const IK_ACTIONS = new Set(['throw', 'release', 'catch', 'stiff', 'wave']);
// stance offsets per held pose (forward, width) in yards: a staggered, wide base for blocking
const STANCE = { block: [[0.22, 0.2], [-0.18, 0.2]], tackle: [[0.22, 0.2], [-0.18, 0.2]] };
const smooth01 = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

/**
 * Feet that stay planted. Each foot is either on the ground (locked to a world spot while the body moves over it)
 * or swinging along an arc to the next footstep. While running, the stride phase decides lift-off and landing;
 * standing still, a foot steps back under the hip when the body drifts away from it. A two-bone IK then solves the
 * hip and knee angles that put the ankle on that spot, the ankle keeps the sole flat (toe-off and toes-up in the
 * swing), and the pelvis drops a little when a foot would be out of reach.
 */
function legIK(p, dt, jv) {
  const u = p.userData.u;
  const r = p.userData.rig;
  if (!r.legL.ankle) return;
  const hold = u.hold ?? null;
  const want = !u.rag && !u.down && !u.celebrate && IK_HOLDS.has(hold) && (!u.action || IK_ACTIONS.has(u.action.name)) && (u.hop ?? 0) < 0.03 && Math.abs(r.body.rotation.x) < 0.5;
  u.ikW = (u.ikW ?? 0) + ((want ? 1 : 0) - (u.ikW ?? 0)) * Math.min(1, dt * (want ? 7 : 16));
  if (!want) u.feet = null;
  const w = u.ikW;
  const legs = [r.legL, r.legR];
  if (w < 0.01) {
    for (const lg of legs) { lg.ankle.rotation.x *= 0.8; lg.ankle.rotation.z *= 0.8; lg.hip.rotation.z *= 0.8; }
    u.pelvis = (u.pelvis ?? 0) * 0.9;
    return;
  }
  r.hips.updateWorldMatrix(true, false);
  const sy = r.body.scale.y;
  const root = _v1.setFromMatrixPosition(p.matrixWorld);
  const groundY = root.y;
  const yaw = p.rotation.y;
  const fwdX = -Math.sin(yaw), fwdZ = -Math.cos(yaw); // characters face -z at yaw 0
  const rgtX = Math.cos(yaw), rgtZ = -Math.sin(yaw);
  const half = 0.135 * r.body.scale.x; // an athletic base, feet about shoulder width
  const st = STANCE[hold];
  const restSpot = (i, out) => {
    const sd = i === 0 ? -1 : 1;
    const f = st ? st[i][0] : 0, wdt = st ? st[i][1] : half;
    return out.set(root.x + rgtX * sd * wdt + fwdX * f, groundY, root.z + rgtZ * sd * wdt + fwdZ * f);
  };
  // seat the feet where they are right now (first frame, or coming back from a dive / ragdoll / celebration)
  if (!u.feet) {
    u.feet = legs.map((lg, i) => { lg.foot.updateWorldMatrix(true, false); const fp = new THREE.Vector3().setFromMatrixPosition(lg.foot.matrixWorld); fp.y = groundY; if (fp.distanceTo(restSpot(i, _v2)) > 0.5) fp.copy(_v2); return { pos: fp, plant: true, from: fp.clone(), to: fp.clone(), t: 0, dur: 0.25, sw: 0 }; });
  }
  const vel = u.vel ?? { x: 0, z: 0 };
  const moving = (u.speed ?? 0) > 0.4;
  const T = moving ? (2 * Math.PI) / (u.omega || 8) : 0.6;
  const duty = u.duty ?? 0.6;
  const vl = Math.hypot(vel.x, vel.z);
  const dX = vl > 0.3 ? vel.x / vl : fwdX, dZ = vl > 0.3 ? vel.z / vl : fwdZ;
  const landing = (i, timeLeft, out) => {
    restSpot(i, out);
    const ahead = moving ? duty * (u.cycleLen ?? 1.5) * 0.42 : 0; // land a touch ahead of the hips, not out in front (good sprint form)
    out.x += vel.x * timeLeft + dX * ahead; out.z += vel.z * timeLeft + dZ * ahead;
    return out;
  };
  legs.forEach((lg, i) => {
    const F = u.feet[i];
    const other = u.feet[1 - i];
    if (moving) {
      const c = ((((u.phase - Math.PI / 2 - i * Math.PI) / (2 * Math.PI)) % 1) + 1) % 1;
      const stance = c < duty;
      if (stance && !F.plant) { F.plant = true; F.pos.copy(landing(i, 0, _v2)); }
      else if (!stance && F.plant) { F.plant = false; F.from.copy(F.pos); }
      if (!F.plant) {
        F.sw = (c - duty) / (1 - duty);
        const tl = (1 - F.sw) * (1 - duty) * T;
        landing(i, tl, F.to);
        const k = smooth01(F.sw);
        F.pos.set(F.from.x + (F.to.x - F.from.x) * k, groundY, F.from.z + (F.to.z - F.from.z) * k);
      }
      // a foot left far behind (sharp cut, shove) lets go early
      if (F.plant && Math.hypot(F.pos.x - root.x, F.pos.z - root.z) > 0.95 * sy) { F.plant = false; F.from.copy(F.pos); }
    } else {
      if (F.plant) {
        const rs = restSpot(i, _v2);
        // step when the body has drifted off this foot, or a turn has left it on the wrong side (crossed legs)
        const side = (F.pos.x - root.x) * rgtX + (F.pos.z - root.z) * rgtZ;
        const crossed = (i === 0 ? side > -0.04 : side < 0.04);
        if ((Math.hypot(F.pos.x - rs.x, F.pos.z - rs.z) > 0.17 || crossed) && other.plant) { F.plant = false; F.from.copy(F.pos); F.to.copy(rs); F.t = 0; F.dur = 0.24; }
      } else {
        F.t += dt; restSpot(i, F.to);
        F.sw = Math.min(1, F.t / F.dur);
        const k = smooth01(F.sw);
        F.pos.set(F.from.x + (F.to.x - F.from.x) * k, groundY, F.from.z + (F.to.z - F.from.z) * k);
        if (F.sw >= 1) { F.plant = true; F.pos.copy(F.to); }
      }
    }
  });
  // solve each leg in the hips' local space (the body's scale and lean are taken into account by worldToLocal)
  let deficit = 0;
  legs.forEach((lg, i) => {
    const F = u.feet[i];
    const lift = F.plant ? 0 : Math.sin(Math.PI * F.sw) * (moving ? 0.07 + 0.2 * Math.min(1, (u.speed ?? 0) / 8) : 0.06);
    // the model's legs are a touch long for its hip height: aim the ankle slightly low (the cleat sinks into the turf a
    // little) so a standing player's knees stay soft instead of squatting
    const tgt = _v3.set(F.pos.x, groundY + 0.008 * sy - (F.plant ? SURF.footSink ?? 0 : 0) + lift, F.pos.z); // cleats sink into mud / snow
    r.hips.worldToLocal(tgt);
    const dx = tgt.x - lg.hip.position.x, dy = tgt.y - lg.hip.position.y, dz = tgt.z - lg.hip.position.z;
    const raw = Math.hypot(dx, dy, dz);
    if (F.plant) deficit = Math.max(deficit, raw - (THIGH + SHIN - 0.01));
    const len = Math.min(THIGH + SHIN - 0.004, Math.max(0.3, raw));
    const roll = Math.max(-0.35, Math.min(0.35, Math.atan2(dx, -dy)));
    const phi = Math.atan2(-dz, Math.max(0.05, -dy));
    const cosK = (THIGH * THIGH + SHIN * SHIN - len * len) / (2 * THIGH * SHIN);
    const bend = Math.PI - Math.acos(Math.max(-1, Math.min(1, cosK)));
    const gam = Math.acos(Math.max(-1, Math.min(1, (THIGH * THIGH + len * len - SHIN * SHIN) / (2 * THIGH * len))));
    const hipX = phi + gam, kneeX = -bend;
    lg.hip.rotation.x += (hipX - lg.hip.rotation.x) * w;
    lg.knee.rotation.x += (kneeX - lg.knee.rotation.x) * w;
    lg.hip.rotation.z += (roll - lg.hip.rotation.z) * w;
    // sole flat on the ground in stance; toes push off, then pull up to clear the turf, then flat for the landing
    const sw = F.plant ? 0 : F.sw;
    const toe = F.plant ? 0 : sw < 0.3 ? -0.75 * (1 - sw / 0.3) : sw < 0.75 ? 0.25 * Math.sin(((sw - 0.3) / 0.45) * Math.PI) : 0.12 * (1 - (sw - 0.75) / 0.25);
    const flat = -(r.body.rotation.x + lg.hip.rotation.x + lg.knee.rotation.x);
    lg.ankle.rotation.x += (Math.max(-1.1, Math.min(0.9, flat + toe)) - lg.ankle.rotation.x) * w;
    lg.ankle.rotation.z += ((-lg.hip.rotation.z - r.body.rotation.z) * 0.9 - lg.ankle.rotation.z) * w;
  });
  // the springs keep their own velocity; zero it while IK drives the legs so nothing jumps when IK lets go
  if (w > 0.5) for (let k = 0; k < 4; k++) jv[k] = 0;
  // pelvis drops (bends both knees) when a planted foot would be out of reach
  u.pelvis = (u.pelvis ?? 0) + (Math.min(0.14, Math.max(0, deficit) * sy) * w - (u.pelvis ?? 0)) * Math.min(1, dt * 10);
}

/** Anatomical limits: knees and elbows only bend one way; nothing folds past what a human joint can do. */
function jointLimits(r) {
  const c = (o, k, lo, hi) => { if (o[k] < lo) o[k] = lo; else if (o[k] > hi) o[k] = hi; };
  for (const lg of [r.legL, r.legR]) { c(lg.knee.rotation, 'x', -2.6, 0.02); c(lg.hip.rotation, 'x', -1.0, 2.7); c(lg.hip.rotation, 'z', -0.6, 0.6); }
  for (const a of [r.armL, r.armR]) { c(a.el.rotation, 'x', -0.03, 2.6); if (a.wrist) c(a.wrist.rotation, 'x', -0.9, 0.9); }
  c(r.spine.rotation, 'x', -1.35, 0.5);
  c(r.neck.rotation, 'x', -0.75, 0.9); c(r.neck.rotation, 'y', -1.25, 1.25);
}

/**
 * Head and eyes: when the game gives a look target (the ball, the carrier), the neck turns toward it within human
 * limits, the head leading and the spine following a little (set via setLookAt).
 */
function lookAtTarget(p, P, dt) {
  const u = p.userData.u;
  const r = p.userData.rig;
  const tg = u.lookAt;
  const on = tg && !u.rag && !u.down;
  u.lookW = (u.lookW ?? 0) + ((on ? 1 : 0) - (u.lookW ?? 0)) * Math.min(1, dt * 5);
  if (u.lookW < 0.01) return;
  if (on) {
    const hx = p.position.x, hz = p.position.z;
    const dx = tg.x - hx, dz = tg.z - hz;
    let rel = Math.atan2(-dx, -dz) - p.rotation.y;
    while (rel > Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;
    const reach = Math.abs(rel) < 2.2; // can't look straight behind: keep the last comfortable angle
    if (reach) u.lkY = (u.lkY ?? 0) + (Math.max(-1.15, Math.min(1.15, rel)) - (u.lkY ?? 0)) * Math.min(1, dt * 9);
    const dist = Math.hypot(dx, dz);
    const pitch = Math.atan2((tg.y ?? 1) - 1.7 * r.body.scale.y, Math.max(0.5, dist));
    u.lkP = (u.lkP ?? 0) + (Math.max(-0.5, Math.min(0.55, pitch)) - (u.lkP ?? 0)) * Math.min(1, dt * 7);
  }
  const k = u.lookW * 0.85;
  const ny = (u.lkY ?? 0) - r.hips.rotation.y - r.spine.rotation.y;
  r.neck.rotation.y += (ny - r.neck.rotation.y) * k;
  const nx = (u.lkP ?? 0) - r.spine.rotation.x - r.body.rotation.x * 0.6;
  r.neck.rotation.x += (nx - r.neck.rotation.x) * k * 0.7;
  // the chest turns a little with a big head turn so it doesn't look like the head is screwed on
  u.spineLook = (u.lkY ?? 0) * 0.18 * u.lookW; // applied as an offset on the spine's twist target in applyPose
}
/** Give a character something to watch (a world-space point with x, y, z), or null to look ahead. */
export function setLookAt(p, target) { if (p?.userData?.u) p.userData.u.lookAt = target; }

/**
 * Ground contact for poses that aren't on the feet (dives, falls, tackles, lying down, getting up): find the lowest
 * body part and lift (or settle) the body so it rests on the turf instead of sinking into it or hovering.
 */
const GC_PARTS = (r) => [[r.headG, 0.2], [r.chest, 0.17], [r.hips, 0.14], [r.armL.hand, 0.05], [r.armR.hand, 0.05], [r.legL.foot, 0.05], [r.legR.foot, 0.05], [r.legL.knee, 0.07], [r.legR.knee, 0.07], [r.armL.el, 0.05], [r.armR.el, 0.05]];
let GC_STAMP = 0;
function groundContact(p, dt) {
  const u = p.userData.u;
  const r = p.userData.rig;
  const act = u.action?.name;
  const need = !u.rag && (u.down || Math.abs(r.body.rotation.x) > 0.45 || act === 'dive' || act === 'tackle' || act === 'fall' || act === 'getup' || act === 'lunge' || u.hold === 'dive' || u.hold === 'getup' || u.hold === 'stance');
  if (!need) { if (u.gfix) u.gfix *= Math.max(0, 1 - dt * 6); if (Math.abs(u.gfix ?? 0) < 0.002) u.gfix = 0; return; }
  // only the joints we measure (and their parents) need fresh matrices, not every mesh on the body
  r.body.updateWorldMatrix(true, false);
  const groundY = _v1.setFromMatrixPosition(p.matrixWorld).y;
  const s = r.body.scale.y;
  let low = Infinity;
  const stamp = ++GC_STAMP;
  const fresh = (o) => { if (!o || o.userData.gcs === stamp) return; if (o.parent && o.parent !== r.body) fresh(o.parent); o.updateMatrix(); o.matrixWorld.multiplyMatrices(o.parent.matrixWorld, o.matrix); o.userData.gcs = stamp; };
  for (const [o, rad] of GC_PARTS(r)) { if (!o) continue; fresh(o); _v2.setFromMatrixPosition(o.matrixWorld); low = Math.min(low, _v2.y - rad * s - groundY); }
  if (!Number.isFinite(low)) return;
  // sinking: push up right away; hovering while lying down: settle down onto the turf
  const fix = low < 0 ? -low : (u.down || act === 'fall') && low > 0.02 ? -Math.min(low - 0.02, dt * 2) : 0;
  u.gfix = Math.max(-0.4, Math.min(1.2, (u.gfix ?? 0) + fix));
  r.body.position.y += fix;
}

// ------------------------------------------------------------------ ground surface (set per play by the engine)
// { grip, sink, slip, slide, bounce, debris, footSink } from data/surface.js; dry grass when nothing is set
let SURF = { slide: 1, bounce: 1, footSink: 0, debris: 'grass' };
export function setSurface(s) { SURF = s ? { ...SURF, ...s } : { slide: 1, bounce: 1, footSink: 0, debris: 'grass' }; }

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
      // hard turf bounces bodies back up, mud and snow swallow the hit; slick ground keeps them moving
      const bz = SURF.bounce ?? 1;
      const rest = Math.min(0.62, 0.3 * bz * (bz > 1.2 ? 1.25 : 1));
      const keep = Math.min(0.9, 0.45 * Math.pow(SURF.slide ?? 1, 0.75));
      g.vy = -g.vy * rest + (bz > 1.2 && g.bounce === 1 ? 0.9 : 0); // turf kicks a body back up off the hard surface
      g.vx *= keep; g.vz *= keep; g.wx *= 0.4; g.wz *= 0.4; g.wy *= 0.4;
      if (g.bounce >= (bz > 1.2 ? 3 : 2) || Math.abs(g.vy) < (bz > 1.2 ? 0.35 : 0.7)) { g.settled = true; g.slideV = { x: g.vx, z: g.vz }; }
      g.splash = (g.splash ?? 0) + 1; // the engine kicks up turf / mud / snow on each impact (u.groundHit)
      u.groundHit = (u.groundHit ?? 0) + 1;
    }
  } else if (g.settled) b.position.y -= Math.min(low - 0.02, dt * 3);
  // sliding along the ground after landing: far on wet turf / snow, a short skid on grass, barely in mud
  if (g.settled && g.slideV) {
    const fr = Math.exp(-dt * 5 / Math.max(0.6, SURF.slide ?? 1));
    g.slideV.x *= fr; g.slideV.z *= fr;
    b.position.x += g.slideV.x * dt; b.position.z += g.slideV.z * dt;
    if (Math.hypot(g.slideV.x, g.slideV.z) < 0.05) g.slideV = null;
  }
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
  blink(p, u, dt);
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
    // ground velocity (yards/s, parent space) for footstep placement
    const pv = (u.prevPos ??= { x: p.position.x, z: p.position.z });
    const vx = (p.position.x - pv.x) / dt, vz = (p.position.z - pv.z) / dt;
    const jump = Math.hypot(vx, vz) > 25; // teleported (new play, replay): don't treat it as running
    u.vel = u.vel ?? { x: 0, z: 0 };
    if (jump) { u.vel.x = 0; u.vel.z = 0; u.feet = null; }
    else { u.vel.x += (vx - u.vel.x) * Math.min(1, dt * 12); u.vel.z += (vz - u.vel.z) * Math.min(1, dt * 12); }
    pv.x = p.position.x; pv.z = p.position.z;
    u.legK ??= p.userData.rig.body.scale.y;
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

const CELEBRATIONS = ['pump', 'dance', 'flex', 'flip', 'salute', 'point', 'bow', 'shuffle', 'heart', 'leanback'];
export function celebrate(p, style) {
  const u = p.userData.u;
  u.down = false;
  u.hold = null;
  u.celebT = 0;
  u.cs = 0.86 + Math.random() * 0.28; u.cm = Math.random() < 0.5 ? 1 : -1;
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

const ballParts = {};
/** A real football: pointed prolate spheroid, pebbled leather, white stripes and laces. Local +z = long axis. */
export function makeBall() {
  if (!ballParts.body) {
    const A = 0.19, B = 0.11;
    const pts = [];
    for (let i = 0; i <= 24; i++) { const s = -1 + (i / 24) * 2; pts.push(new THREE.Vector2(Math.max(0.0015, B * Math.pow(1 - s * s, 0.78)), s * A)); }
    ballParts.body = new THREE.LatheGeometry(pts, 22).rotateX(Math.PI / 2);
    // pebbled leather texture
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'); g.fillStyle = '#d0d0d0'; g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 700; i++) { const v = (150 + Math.random() * 105) | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.random() * 64, Math.random() * 64, 1.2, 1.2); }
    const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(4, 4);
    ballParts.leather = new THREE.MeshStandardMaterial({ color: '#7a3b1a', roughness: 0.62, bumpMap: tex, bumpScale: 0.6 });
    ballParts.white = new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.5 });
    const rAt = (s) => B * Math.pow(1 - s * s, 0.78);
    ballParts.stripe = (s) => new THREE.TorusGeometry(rAt(s) + 0.001, 0.0055, 6, 24, Math.PI * 0.9).rotateZ(Math.PI * 0.05).translate(0, 0, s * A);
    ballParts.lace = new THREE.BoxGeometry(0.018, 0.012, 0.13);
    ballParts.stitch = new THREE.BoxGeometry(0.05, 0.01, 0.012);
  }
  const g = new THREE.Group();
  g.add(new THREE.Mesh(ballParts.body, ballParts.leather));
  for (const s of [-0.62, 0.62]) g.add(new THREE.Mesh(ballParts.stripe(s), ballParts.white));
  const lace = new THREE.Mesh(ballParts.lace, ballParts.white); lace.position.y = 0.109; g.add(lace);
  for (let i = 0; i < 6; i++) { const st = new THREE.Mesh(ballParts.stitch, ballParts.white); st.position.set(0, 0.108, -0.055 + i * 0.022); g.add(st); }
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
const DEBRIS = {
  grass: ['#5a8f3c', '#3f7a33', '#b8a37a', '#d8cfb8'],
  pellets: ['#141414', '#222222', '#2f6f35', '#1a1a1a'], // turf rubber crumbs
  mud: ['#4a3520', '#5d4428', '#3a2a18', '#6e4e2e'],
  snow: ['#f4f8fb', '#e6eef4', '#ffffff', '#d8e4ec'],
  spray: ['#d8ecff', '#b8d8f2', '#ffffff', '#9fc2e0'],
};
/** Turf, mud, snow or water kicked up from the ground. kind defaults to the current play's surface. */
export function dustPuff(scene, origin, n = 12, kind = SURF.debris) {
  const geoD = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  const mesh = new THREE.InstancedMesh(geoD, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 }), n);
  const cols = (DEBRIS[kind] ?? DEBRIS.grass).map((c) => new THREE.Color(c));
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
export const __headGeo = headGeo; // debug/tests
