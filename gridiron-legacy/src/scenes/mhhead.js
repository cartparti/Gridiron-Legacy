// Human heads from the MakeHuman base mesh and its shape targets (CC0 1.0 Universal; see tools/head/).
// Every person's head = the base head + a weighted mix of targets picked from their look (gender, head shape,
// jaw, cheekbones, chin, face width, nose, eyes, brows) plus a little per-person variation, so no two match.
import * as THREE from 'three';
import { MH_HEAD } from '../data/mhhead.js';

const dec = (b64) => { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; };
let D = null;
function data() {
  if (D) return D;
  const T = {};
  for (const [name, t] of Object.entries(MH_HEAD.targets)) T[name] = { i: new Uint16Array(dec(t.i)), d: new Int16Array(dec(t.d)), q: t.q };
  D = {
    pos: new Float32Array(dec(MH_HEAD.pos)), uv: new Float32Array(dec(MH_HEAD.uv)), idx: new Uint16Array(dec(MH_HEAD.idx)),
    ear: new Uint8Array(dec(MH_HEAD.ear)), T, rings: MH_HEAD.eyeRings.map((r) => new Uint16Array(dec(r))),
  };
  return D;
}
/** Skull space used for hair and beards: centre and radii (no ears, no nose). */
export const SKULL = { c: [0, 0.23, 0], r: [0.135, 0.2, 0.165] };
export const MH_LANDMARKS = { eyes: MH_HEAD.eyes, eyeR: MH_HEAD.eyeR, mouth: MH_HEAD.mouth, chin: MH_HEAD.chin, dims: MH_HEAD.dims };

const SHAPE_W = {
  oval: { 'head-oval': 0.7 }, round: { 'head-round': 0.6 }, square: { 'head-square': 0.7 },
  long: { 'head-rectangular': 0.6 }, wide: { 'head-scale-horiz-incr': 0.45, 'head-square': 0.3 }, heart: { 'head-invertedtriangular': 0.7 },
};
const JAW_W = {
  defined: { 'chin-bones-incr': 0.45 }, sharp: { 'chin-bones-incr': 0.6, 'chin-width-decr': 0.45, 'head-invertedtriangular': 0.2 },
  square: { 'chin-width-incr': 0.6, 'chin-bones-incr': 0.55, 'head-square': 0.3 }, soft: { 'chin-bones-decr': 0.3 },
};
const CHEEK_W = { normal: {}, high: { 'cheek-bones-incr': 0.8 }, chiseled: { 'cheek-bones-incr': 0.6, 'cheek-volume-decr': 0.9, 'cheek-inner-decr': 0.5 } };
const CHIN_W = {
  normal: {}, strong: { 'chin-prominent-incr': 0.7, 'chin-height-incr': 0.3 }, pointed: { 'chin-width-decr': 0.7, 'chin-prominent-incr': 0.3 },
  small: { 'chin-prominent-decr': 0.6, 'chin-height-decr': 0.3 },
};
const FACEW_W = { narrow: { 'head-scale-horiz-decr': 0.55 }, normal: {}, broad: { 'head-scale-horiz-incr': 0.55 } };
const NOSE_W = {
  small: { 'nose-scale-horiz-decr': 0.4, 'nose-scale-vert-decr': 0.3, 'nose-volume-decr': 0.3 },
  wide: { 'nose-scale-horiz-incr': 0.6, 'nose-nostrils-width-incr': 0.5 }, long: { 'nose-scale-vert-incr': 0.6, 'nose-hump-incr': 0.3 },
};
const EYES_W = {
  round: {}, wide: { 'eye-height2-incr': 0.5 }, narrow: { 'eye-height2-decr': 0.6 }, sleepy: { 'eye-height2-decr': 0.45, 'eye-corner1-down': 0.4 },
};
const BROWS_W = { raised: { 'eyebrows-trans-up': 0.6 }, angry: { 'eyebrows-angle-down': 0.6 } };
// small per-person differences on top of the choices (everyone ends up a little different)
const JITTER = ['nose-point-width-incr', 'nose-point-width-decr', 'mouth-scale-horiz-incr', 'mouth-scale-horiz-decr', 'eye-corner1-up',
  'eye-corner1-down', 'chin-height-incr', 'nose-scale-depth-incr', 'forehead-temple-decr', 'mouth-angles-up'];

function hash(L) {
  let h = 0; for (const ch of `${L.skin}|${L.eyes}|${L.brows}|${L.mouth}|${L.hairStyle}|${L.eyeColor}|${L.headShape}|${L.nose}|${L.hairColor}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}
/** Target weights for a look (fp = the face build from actors.faceParams). */
export function mhWeights(L, fp, football = false) {
  const fem = L.gender === 'f';
  const w = {};
  const add = (o, k = 1) => { for (const [n, v] of Object.entries(o ?? {})) w[n] = (w[n] ?? 0) + v * k; };
  // build: gender, lean (no puffy faces), athletes a bit more muscular
  if (fem) add({ 'female-young': 1, 'universal-female-young-averagemuscle-minweight': 0.35 });
  else add({ 'male-young': 1, 'universal-male-young-maxmuscle-averageweight': football ? 0.45 : 0.25, 'universal-male-young-averagemuscle-minweight': 0.2 });
  add({ 'neck-double-decr': 1, 'head-fat-decr': 0.35, 'head-age-decr': 0.15 });
  add(SHAPE_W[L.headShape] ?? SHAPE_W.oval);
  add(JAW_W[fp.jaw]); add(CHEEK_W[fp.cheek]); add(CHIN_W[fp.chin]); add(FACEW_W[fp.faceW]); add(NOSE_W[fp.nose]);
  add(EYES_W[L.eyes]); add(BROWS_W[L.brows]);
  if (fem) add({ 'mouth-upperlip-volume-incr': 0.35, 'mouth-lowerlip-volume-incr': 0.35 });
  let h = hash(L);
  for (let k = 0; k < 4; k++) { const n = JITTER[h % JITTER.length]; h = (h * 1103515245 + 12345) >>> 0; add({ [n]: 0.15 + (h % 100) / 400 }); h = (h * 1103515245 + 12345) >>> 0; }
  // quantize so similar people share geometry
  const key = Object.keys(w).filter((n) => data().T[n]).sort().map((n) => `${n}:${Math.round(w[n] * 20)}`).join(',');
  for (const n of Object.keys(w)) w[n] = Math.round(w[n] * 20) / 20;
  return { w, key };
}

const geoCache = new Map();
/** The morphed head geometry: group 0 = plain skin, group 1 = the painted face (eyes at cols 3.1/8.9 etc.). */
export function mhHeadGeo(L, fp, football = false) {
  const { w, key } = mhWeights(L, fp, football);
  if (geoCache.has(key)) return geoCache.get(key);
  const d = data();
  const pos = new Float32Array(d.pos);
  for (const [n, k] of Object.entries(w)) {
    const t = d.T[n];
    if (!t || !k) continue;
    const s = t.q * k;
    for (let j = 0; j < t.i.length; j++) { const o = t.i[j] * 3; pos[o] += t.d[j * 3] * s; pos[o + 1] += t.d[j * 3 + 1] * s; pos[o + 2] += t.d[j * 3 + 2] * s; }
  }
  // gender/shape targets change the head's size and height: refit chin -> crown to the standard 0.40 so every head
  // sits the same on the neck and hair/beards (built in skull space) always fit
  const ci = MH_HEAD.chinI * 3, ki = MH_HEAD.crownI * 3;
  const chinY = pos[ci + 1], crownY = pos[ki + 1], crownZ = pos[ki + 2];
  const k = 0.4 / (crownY - chinY);
  for (let o = 0; o < pos.length; o += 3) { pos[o] *= k; pos[o + 1] = 0.03 + (pos[o + 1] - chinY) * k; pos[o + 2] = -0.0216 + (pos[o + 2] - crownZ) * k; }
  // the eyeballs follow the reshaped sockets
  const eyes = d.rings.map((r, j) => {
    const c = [0, 0, 0];
    for (const i of r) { c[0] += pos[i * 3]; c[1] += pos[i * 3 + 1]; c[2] += pos[i * 3 + 2]; }
    return c.map((v, a) => v / r.length + MH_HEAD.eyeOff[j][a] * k);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(d.uv, 2));
  g.setIndex(new THREE.BufferAttribute(d.idx, 1));
  const ns = MH_HEAD.skinTris * 3, nf = MH_HEAD.faceTris * 3;
  g.addGroup(0, ns, 0); g.addGroup(ns, nf, 1);
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.userData = { key, ear: d.ear, eyes, eyeR: MH_HEAD.eyeR * k };
  geoCache.set(key, g);
  return g;
}

/**
 * A shell grown out of a head (hair or beard): mask(nx, ny, nz, th, az, X, Y, Z) in 0..1 says where it grows,
 * thick(...) how far. Ears never grow hair. Below the mask the shell tucks just under the skin.
 */
export function mhShell(head, mask, thick, { uvMode = 'hair', sag = 0 } = {}) {
  const src = head.attributes.position, nor = head.attributes.normal, ear = head.userData.ear;
  const n = src.count;
  const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), mk = new Float32Array(n);
  const [cx, cy, cz] = SKULL.c, [rx, ry, rz] = SKULL.r;
  for (let i = 0; i < n; i++) {
    const x = src.getX(i), y = src.getY(i), z = src.getZ(i);
    const X = (x - cx) / rx, Y = (y - cy) / ry, Z = (z - cz) / rz;
    const len = Math.hypot(X, Y, Z) || 1;
    const nx = X / len, ny = Y / len, nz = Z / len;
    const th = Math.acos(Math.max(-1, Math.min(1, ny)));
    const az = Math.atan2(nx, -nz);
    let m = ear[i] ? 0 : mask(nx, ny, nz, th, az, X, Y, Z);
    mk[i] = m;
    const t = m > 0 ? thick(nx, ny, nz, th, az, X, Y, Z) : 0;
    const off = -0.011 + (t + 0.011) * Math.min(1, m * 1.3);
    pos[i * 3] = x + nor.getX(i) * off; pos[i * 3 + 1] = y + nor.getY(i) * off - sag * t; pos[i * 3 + 2] = z + nor.getZ(i) * off;
    uv[i * 2] = (Math.abs(az) / Math.PI) * 3; uv[i * 2 + 1] = (th / Math.PI) * 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  // keep only triangles that actually grow hair (hidden copies under the skin showed through as specks)
  const src_i = head.index.array, keep = [];
  for (let t = 0; t < src_i.length; t += 3) { const a = src_i[t], b = src_i[t + 1], c = src_i[t + 2]; if (mk[a] > 0.02 || mk[b] > 0.02 || mk[c] > 0.02) keep.push(a, b, c); }
  g.setIndex(keep);
  g.computeVertexNormals();
  return g;
}
