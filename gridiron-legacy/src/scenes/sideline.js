// Sideline life: team mascots (one per mascot kind), cheer squads, bench backrests, coaches with headsets,
// cooler tables and photographers behind the end zones. Everything is chunky voxel boxes like the players.
// buildSideline(world) returns { paint(homeColors, awayColors, nearColors, farColors, mascotKind, level), animate(t, ex), spots() }.
import * as THREE from 'three';

const FIELD_W = 53.3;
const box = (w, h, d, color, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z);
  return m;
};
/**
 * Merge the plain box meshes that are direct children of a group into one vertex-colored mesh (recursing into
 * sub-groups first). Cuts hundreds of draw calls down to a handful per figure; animated sub-groups keep moving.
 */
const bakedMat = new THREE.MeshLambertMaterial({ vertexColors: true });
function bake(g) {
  for (const c of [...g.children]) if (c.isGroup) bake(c);
  const meshes = g.children.filter((c) => c.isMesh && !Array.isArray(c.material) && c.geometry.index);
  if (meshes.length < 2) return g;
  const pos = []; const nor = []; const col = []; const idx = []; let off = 0;
  const v = new THREE.Vector3(); const nm = new THREE.Matrix3();
  for (const m of meshes) {
    m.updateMatrix();
    nm.getNormalMatrix(m.matrix);
    const ga = m.geometry.attributes;
    const c = m.material.color;
    for (let i = 0; i < ga.position.count; i++) {
      v.fromBufferAttribute(ga.position, i).applyMatrix4(m.matrix); pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(ga.normal, i).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z);
      col.push(c.r, c.g, c.b);
    }
    for (const i of m.geometry.index.array) idx.push(i + off);
    off += ga.position.count;
    g.remove(m);
    m.geometry.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  g.add(new THREE.Mesh(geo, bakedMat));
  return g;
}

const SKINS = ['#f7dcc0', '#e0ab7f', '#cc9260', '#b07646', '#8f5a34', '#6e4126'];
const HAIR = ['#2b1d14', '#5a3a22', '#c9a15a', '#1a1a1a', '#8a3b1f'];

/** A big-headed voxel mascot. kind matches the crest mascots (cat, wolf, bird, ...). */
export function makeMascot(kind = 'shield', colors = ['#1d3557', '#f1c40f']) {
  const [c0, c1] = colors;
  const g = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 1.0; g.add(hips);
  const legL = box(0.42, 1.0, 0.42, c0, -0.28, -0.5, 0); const legR = box(0.42, 1.0, 0.42, c0, 0.28, -0.5, 0);
  hips.add(legL, legR);
  const shoeL = box(0.5, 0.25, 0.7, '#f4f4f4', -0.28, -0.95, 0.1); const shoeR = box(0.5, 0.25, 0.7, '#f4f4f4', 0.28, -0.95, 0.1);
  hips.add(shoeL, shoeR);
  const torso = new THREE.Group(); hips.add(torso);
  torso.add(box(1.25, 1.2, 0.9, c0, 0, 0.6, 0));
  torso.add(box(0.8, 0.8, 0.1, c1, 0, 0.55, 0.46)); // belly / jersey patch
  torso.add(box(1.3, 0.16, 0.95, c1, 0, 1.14, 0)); // collar trim
  torso.add(box(0.22, 0.42, 0.04, c0, -0.16, 0.6, 0.52), box(0.22, 0.42, 0.04, c0, 0.16, 0.6, 0.52)); // big number "11"
  torso.add(box(1.0, 0.7, 0.06, c1, 0, 0.62, -0.46)); // back plate
  // tail
  const tailCol = kind === 'scorpion' ? '#111111' : kind === 'horse' ? c1 : c0;
  const tail = new THREE.Group(); tail.position.set(0, 0.1, -0.5); torso.add(tail);
  if (['cat', 'wolf', 'horse', 'bear', 'bison', 'scorpion', 'sea'].includes(kind)) {
    const len = kind === 'bear' ? 0.25 : kind === 'scorpion' ? 1.0 : 0.8;
    tail.add(box(0.2, 0.2, len, tailCol, 0, 0, -len / 2));
    tail.add(box(0.26, 0.26, 0.26, kind === 'scorpion' ? c1 : kind === 'wolf' ? '#f4f4f4' : tailCol, 0, kind === 'scorpion' ? 0.25 : 0.05, -len));
  }
  const arm = (sx) => {
    const sh = new THREE.Group(); sh.position.set(sx * 0.78, 1.05, 0);
    const a = box(0.36, 0.95, 0.36, c0, 0, -0.42, 0); sh.add(a);
    sh.add(box(0.44, 0.36, 0.44, '#f4f4f4', 0, -0.95, 0)); // big glove
    sh.add(box(0.4, 0.1, 0.4, c1, 0, -0.1, 0)); // sleeve stripe
    for (const dx of [-0.13, 0, 0.13]) sh.add(box(0.08, 0.08, 0.06, '#d0d0d0', dx, -1.14, 0.18)); // fingers
    torso.add(sh);
    return sh;
  };
  const armL = arm(-1); const armR = arm(1);
  const head = new THREE.Group(); head.position.y = 1.95; torso.add(head);
  head.add(box(1.5, 1.35, 1.35, c0, 0, 0, 0));
  // googly eyes
  for (const sx of [-0.33, 0.33]) { head.add(box(0.38, 0.42, 0.08, '#ffffff', sx, 0.18, 0.7)); head.add(box(0.16, 0.2, 0.06, '#111111', sx, 0.14, 0.75)); }
  head.add(box(0.7, 0.14, 0.06, '#111111', 0, -0.32, 0.7)); // grin
  head.add(box(0.5, 0.08, 0.04, '#ffffff', 0, -0.27, 0.72)); // teeth
  for (const sx of [-0.33, 0.33]) head.add(box(0.36, 0.08, 0.06, '#111111', sx, 0.45, 0.71)); // eyebrows
  for (const sx of [-0.55, 0.55]) head.add(box(0.2, 0.14, 0.04, '#ff9aa8', sx, -0.12, 0.69)); // cheeks
  const feat = {
    cat: () => { head.add(box(0.34, 0.4, 0.2, c0, -0.52, 0.82, 0), box(0.34, 0.4, 0.2, c0, 0.52, 0.82, 0), box(0.2, 0.2, 0.08, c1, -0.52, 0.8, 0.12), box(0.2, 0.2, 0.08, c1, 0.52, 0.8, 0.12), box(0.24, 0.16, 0.1, '#ff8fa3', 0, -0.06, 0.72), box(1.9, 0.04, 0.04, '#eeeeee', 0, -0.14, 0.74)); },
    wolf: () => { head.add(box(0.3, 0.5, 0.2, c0, -0.5, 0.88, -0.1), box(0.3, 0.5, 0.2, c0, 0.5, 0.88, -0.1), box(0.62, 0.5, 0.6, c1, 0, -0.22, 0.9), box(0.24, 0.18, 0.12, '#111', 0, -0.02, 1.2)); },
    bird: () => { head.add(box(0.56, 0.3, 0.7, '#ffb000', 0, -0.12, 0.95), box(0.2, 0.6, 0.6, c1, 0, 0.9, -0.1), box(0.2, 0.4, 0.4, c1, 0, 0.95, -0.55)); },
    horse: () => { head.add(box(0.7, 0.62, 0.95, c0, 0, -0.32, 0.95), box(0.24, 0.42, 0.18, c0, -0.38, 0.86, 0), box(0.24, 0.42, 0.18, c0, 0.38, 0.86, 0), box(0.22, 0.26, 1.6, c1, 0, 0.72, -0.3)); },
    bear: () => { head.add(box(0.42, 0.42, 0.24, c0, -0.58, 0.72, 0), box(0.42, 0.42, 0.24, c0, 0.58, 0.72, 0), box(0.62, 0.42, 0.4, '#d9b38c', 0, -0.25, 0.8), box(0.26, 0.18, 0.1, '#111', 0, -0.12, 1.0)); },
    bison: () => { head.add(box(0.6, 0.18, 0.18, '#f2ead8', -0.95, 0.42, 0), box(0.6, 0.18, 0.18, '#f2ead8', 0.95, 0.42, 0), box(0.18, 0.4, 0.18, '#f2ead8', -1.2, 0.68, 0), box(0.18, 0.4, 0.18, '#f2ead8', 1.2, 0.68, 0), box(0.8, 0.4, 0.4, '#6b4a2e', 0, -0.3, 0.75)); },
    sea: () => { head.add(box(0.18, 0.8, 0.8, c1, 0, 0.95, -0.1), box(1.2, 0.2, 0.08, '#ffffff', 0, -0.45, 0.71)); },
    scorpion: () => { head.add(box(0.1, 0.6, 0.1, '#111', -0.4, 0.95, 0.3), box(0.1, 0.6, 0.1, '#111', 0.4, 0.95, 0.3), box(0.2, 0.2, 0.2, c1, -0.4, 1.3, 0.3), box(0.2, 0.2, 0.2, c1, 0.4, 1.3, 0.3)); },
    storm: () => { head.add(box(0.3, 0.7, 0.2, '#ffe14d', 0.1, 1.0, 0), box(0.3, 0.5, 0.2, '#ffe14d', -0.12, 1.45, 0)); },
    flame: () => { head.add(box(1.2, 0.5, 1.0, '#ff7a1a', 0, 0.85, 0), box(0.8, 0.5, 0.7, '#ffcf3f', 0, 1.25, 0), box(0.35, 0.4, 0.35, '#fff3a0', 0, 1.6, 0)); },
    skull: () => { head.children[0].material.color.set('#f2f2ea'); head.add(box(1.8, 0.3, 1.6, '#16181c', 0, 0.82, 0), box(1.1, 0.5, 1.1, '#16181c', 0, 1.1, 0), box(0.4, 0.4, 0.08, '#111', 0.33, 0.18, 0.76)); },
    crown: () => { head.add(box(1.3, 0.3, 1.2, '#f1c40f', 0, 0.82, 0)); for (const x of [-0.5, 0, 0.5]) head.add(box(0.22, 0.34, 0.22, '#f1c40f', x, 1.1, 0.4)); },
    shield: () => { head.add(box(1.6, 0.18, 1.45, '#c0c6cf', 0, 0.72, 0), box(0.24, 0.8, 1.2, c1, 0, 1.1, 0)); },
  };
  (feat[kind] ?? feat.shield)();
  g.userData = { hips, torso, armL, armR, head, legL, legR, kind };
  if (kind === 'skull') head.children[0].material = head.children[0].material.clone();
  return bake(g);
}

function animateMascot(m, t, ex, phase = 0) {
  const u = m.userData;
  const k = t * (4 + ex * 4) + phase;
  const hop = Math.max(0, Math.sin(k * 2)) * (0.15 + ex * 0.45);
  u.hips.position.y = 1.0 + hop;
  u.torso.rotation.z = Math.sin(k) * 0.18;
  u.head.rotation.y = Math.sin(k * 0.7) * 0.4;
  u.head.rotation.z = Math.sin(k * 1.3) * 0.12;
  const wave = ex > 0.55;
  u.armL.rotation.z = wave ? -2.4 + Math.sin(k * 3) * 0.5 : -0.3 - Math.max(0, Math.sin(k)) * 1.2;
  u.armR.rotation.z = wave ? 2.4 + Math.sin(k * 3 + 1) * 0.5 : 0.3 + Math.max(0, Math.sin(k + 1.6)) * 1.2;
  u.legL.rotation.x = Math.sin(k * 2) * 0.35; u.legR.rotation.x = -Math.sin(k * 2) * 0.35;
  // the occasional spin move
  const spin = (t + phase) % 9;
  m.rotation.y = (m.userData.baseYaw ?? 0) + (spin < 1 ? spin * Math.PI * 2 : 0);
}

function makeCheerleader(c0, c1, i) {
  const g = new THREE.Group();
  const skin = SKINS[i % SKINS.length];
  g.add(box(0.18, 0.8, 0.22, skin, -0.13, 0.4, 0), box(0.18, 0.8, 0.22, skin, 0.13, 0.4, 0), box(0.5, 0.14, 0.32, '#f4f4f4', 0, 0.07, 0.03)); // legs + sneakers
  g.add(box(0.62, 0.32, 0.46, c1, 0, 0.88, 0)); // skirt
  const top = box(0.56, 0.62, 0.34, c0, 0, 1.33, 0); g.add(top);
  g.add(box(0.42, 0.42, 0.4, skin, 0, 1.86, 0));
  const hair = HAIR[i % HAIR.length];
  g.add(box(0.46, 0.2, 0.44, hair, 0, 2.07, -0.02));
  const style = i % 3;
  if (style === 0) g.add(box(0.2, 0.42, 0.14, hair, 0, 1.85, -0.26)); // ponytail
  else if (style === 1) g.add(box(0.26, 0.24, 0.24, hair, 0, 2.2, -0.12)); // bun
  else g.add(box(0.48, 0.3, 0.12, hair, 0, 1.86, -0.22)); // long
  g.add(box(0.3, 0.12, 0.1, c1, 0, 2.12, -0.24)); // bow
  g.add(box(0.07, 0.07, 0.03, '#1a1410', -0.1, 1.9, 0.21), box(0.07, 0.07, 0.03, '#1a1410', 0.1, 1.9, 0.21)); // eyes
  g.add(box(0.14, 0.04, 0.03, '#c0392b', 0, 1.76, 0.21)); // smile
  g.add(box(0.56, 0.08, 0.36, c1, 0, 1.58, 0), box(0.12, 0.3, 0.36, c1, 0, 1.3, 0.001)); // top trim + stripe
  const arm = (sx) => {
    const sh = new THREE.Group(); sh.position.set(sx * 0.36, 1.58, 0);
    sh.add(box(0.16, 0.6, 0.16, skin, 0, -0.28, 0));
    sh.add(box(0.36, 0.36, 0.36, c1, 0, -0.64, 0)); // pom-pom
    g.add(sh);
    return sh;
  };
  g.userData = { armL: arm(-1), armR: arm(1) };
  return bake(g);
}

function makeCoach(polo, i) {
  const g = new THREE.Group();
  const skin = SKINS[(i * 3 + 1) % SKINS.length];
  g.add(box(0.5, 0.85, 0.34, '#c8b48a', 0, 0.43, 0)); // khakis
  const body = box(0.7, 0.8, 0.4, polo, 0, 1.25, 0); g.add(body);
  g.add(box(0.44, 0.46, 0.42, skin, 0, 1.9, 0));
  g.add(box(0.5, 0.14, 0.5, '#1c1f26', 0, 2.17, 0), box(0.5, 0.06, 0.3, '#1c1f26', 0, 2.12, 0.3)); // cap
  g.add(box(0.06, 0.3, 0.06, '#111', -0.25, 1.95, 0), box(0.06, 0.3, 0.06, '#111', 0.25, 1.95, 0), box(0.2, 0.06, 0.06, '#111', 0.2, 1.8, 0.24)); // headset + mic
  const arm = (sx) => { const sh = new THREE.Group(); sh.position.set(sx * 0.45, 1.6, 0); sh.add(box(0.2, 0.7, 0.2, polo, 0, -0.32, 0)); g.add(sh); return sh; };
  g.add(box(0.26, 0.34, 0.04, '#f4f4f4', 0.26, 1.2, 0.26)); // play sheet
  g.userData = { armL: arm(-1), armR: arm(1) };
  return bake(g);
}

export function buildSideline(world) {
  const root = new THREE.Group();
  world.add(root);
  const ext = new THREE.Group(); root.add(ext); // rebuilt on paint
  let key = '';
  const mascots = []; const cheer = []; const coaches = []; const bodies = [];
  const spotsObj = {};
  // static: cooler tables, photographers, bench backs (painted later)
  const backs = [];
  const statics = new THREE.Group(); root.add(statics);
  for (const sd of [-1, 1]) {
    for (const z of [-11, 0, 11]) {
      const back = box(0.25, 0.9, 9, '#1d3557', sd * (FIELD_W / 2 + 6.9), 0.95, z);
      root.add(back); backs.push({ m: back, sd });
    }
    const table = box(1.2, 0.8, 2.6, '#9aa3ad', sd * (FIELD_W / 2 + 5.2), 0.4, 19);
    statics.add(table);
    for (const dz of [-0.7, 0.7]) statics.add(box(0.7, 0.8, 0.7, '#ff7a1a', sd * (FIELD_W / 2 + 5.2), 1.2, 19 + dz), box(0.74, 0.12, 0.74, '#f4f4f4', sd * (FIELD_W / 2 + 5.2), 1.66, 19 + dz));
    statics.add(box(0.8, 0.5, 1.6, '#3a7bd5', sd * (FIELD_W / 2 + 5.2), 0.25, -20)); // equipment trunk
    statics.add(box(0.12, 2.6, 2.4, '#222831', sd * (FIELD_W / 2 + 7.6), 1.3, -24)); // kicking net frame
    statics.add(box(0.06, 2.3, 2.2, '#e8ecf0', sd * (FIELD_W / 2 + 7.55), 1.35, -24));
  }
  bake(statics);
  // photographers kneeling behind each end zone
  for (const ez of [-1, 1]) for (let i = 0; i < 6; i++) {
    const x = ez < 0 ? 13 + i * 2.6 : -20 + i * 8 + (i % 2) * 1.5; // far end: leave room for the cheer squad + mascot
    const g = new THREE.Group();
    g.add(box(0.5, 0.5, 0.6, '#2b2f36', 0, 0.3, 0), box(0.55, 0.7, 0.4, i % 2 ? '#f2c94c' : '#2f3640', 0, 0.9, 0), box(0.4, 0.4, 0.4, SKINS[i % SKINS.length], 0, 1.45, 0));
    g.add(box(0.3, 0.3, 0.6, '#111', 0, 1.2, -ez * 0.45), box(0.18, 0.18, 0.5, '#333', 0, 1.2, -ez * 0.95)); // camera + lens
    g.position.set(x, 0, ez * 61.9);
    root.add(bake(g));
  }
  return {
    paint(homeColors, awayColors, nearColors, farColors, kind = 'shield', level = 'pro') {
      for (const b of backs) b.m.material.color.set((b.sd > 0 ? nearColors : farColors)[0]);
      const k = `${kind}|${homeColors.join()}|${awayColors.join()}|${level}`;
      if (k === key) return;
      key = k;
      ext.clear(); mascots.length = 0; cheer.length = 0; coaches.length = 0; bodies.length = 0;
      // mascot on the near sideline + one behind the far end zone
      const homeSide = nearColors.join() === homeColors.join() ? 1 : -1;
      const m1 = makeMascot(kind, homeColors); m1.position.set(homeSide * (FIELD_W / 2 + 2.2), 0, -16); m1.userData.baseYaw = -homeSide * Math.PI / 2;
      const m2 = makeMascot(kind, homeColors); m2.position.set(9, 0, -61.7); m2.userData.baseYaw = 0;
      ext.add(m1, m2); mascots.push(m1, m2);
      spotsObj.mascot = m1; spotsObj.mascotEnd = m2;
      // cheer squads (college/pro): home colors behind the far end zone and on the home sideline
      const nCheer = level === 'hs' ? 4 : 7;
      for (let i = 0; i < nCheer; i++) {
        const c = makeCheerleader(homeColors[0], homeColors[1] ?? '#ffffff', i);
        c.position.set(-22 + i * 2.7, 0, -61.6);
        ext.add(c); cheer.push(c);
      }
      for (let i = 0; i < (level === 'hs' ? 0 : 5); i++) {
        const c = makeCheerleader(homeColors[0], homeColors[1] ?? '#ffffff', i + 3);
        c.position.set(homeSide * (FIELD_W / 2 + 1.6), 0, 28 + i * 2.6);
        c.rotation.y = -homeSide * Math.PI / 2;
        ext.add(c); cheer.push(c);
      }
      spotsObj.cheer = cheer[Math.floor(nCheer / 2)];
      // head coaches with headsets, walking the sideline
      for (const sd of [-1, 1]) {
        const c = makeCoach((sd > 0 ? nearColors : farColors)[0], sd + 2);
        c.position.set(sd * (FIELD_W / 2 + 1.4), 0, sd * 2);
        c.rotation.y = -sd * Math.PI / 2;
        c.userData.sd = sd;
        ext.add(c); coaches.push(c);
      }
      spotsObj.coach = coaches[1];
    },
    animate(t, ex = 0.3) {
      mascots.forEach((m, i) => animateMascot(m, t, ex, i * 2.1));
      cheer.forEach((c, i) => {
        const k = t * 5 + i * 0.9;
        const hi = ex > 0.5;
        c.userData.armL.rotation.z = hi ? -2.7 + Math.sin(k * 2) * 0.3 : -0.4 - Math.max(0, Math.sin(k)) * 2.2;
        c.userData.armR.rotation.z = hi ? 2.7 + Math.sin(k * 2 + 1) * 0.3 : 0.4 + Math.max(0, Math.sin(k + 1.5)) * 2.2;
        c.position.y = Math.max(0, Math.sin(k * 1.3)) * (hi ? 0.6 : 0.15);
      });
      coaches.forEach((c) => {
        c.position.z = c.userData.sd * 2 + Math.sin(t * 0.4 + c.userData.sd) * 4; // pacing
        c.rotation.y = -c.userData.sd * Math.PI / 2 + (Math.cos(t * 0.4 + c.userData.sd) > 0 ? 0.6 : -0.6);
        c.userData.armL.rotation.x = -0.6 + Math.sin(t * 1.3) * 0.2;
        c.userData.armR.rotation.z = ex > 0.6 ? 2.6 : 0.2 + Math.sin(t * 2) * 0.1;
      });
    },
    /** World-space anchor objects for cinematic shots. */
    spots: () => spotsObj,
  };
}
