// The world outside the stadium: skyline, forests, mountains, desert mesas, farmland, coast or bayou,
// depending on where the team plays. Built from instanced voxel shapes so it stays cheap on phones.
import * as THREE from 'three';
import { seededRandom } from '../data/looks.js';

const GROUND = { coast: '#c9b98a', desert: '#c9955b', mountain: '#3f6b35', snow: '#e8eef2', city: '#4a4f57', plains: '#5d8c3a', swamp: '#3d4a2c' };

function windowTexture(lit) {
  const c = document.createElement('canvas');
  c.width = 8; c.height = 8;
  const g = c.getContext('2d');
  g.fillStyle = '#9aa3ae'; g.fillRect(0, 0, 8, 8);
  for (let y = 1; y < 8; y += 2) for (let x = 1; x < 8; x += 2) {
    g.fillStyle = Math.random() < lit ? '#ffe9a8' : '#4a5566';
    g.fillRect(x, y, 1, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildEnvironment(world) {
  const group = new THREE.Group();
  world.add(group);
  const mats = [];
  const geos = [];
  const lam = (color, extra = {}) => { const m = new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra }); mats.push(m); return m; };
  const basic = (color, extra = {}) => { const m = new THREE.MeshBasicMaterial({ color, ...extra }); mats.push(m); return m; };
  const clear = () => {
    for (const c of [...group.children]) group.remove(c);
    for (const m of mats) { m.map?.dispose(); m.dispose(); }
    for (const g of geos) g.dispose();
    mats.length = 0; geos.length = 0;
  };
  /** Instanced boxes/cones: items = [{x,y,z,sx,sy,sz,ry,color}] */
  const inst = (geo, mat, items) => {
    if (!items.length) return null;
    geos.push(geo);
    const m = new THREE.InstancedMesh(geo, mat, items.length);
    const d = new THREE.Object3D();
    items.forEach((it, i) => {
      d.position.set(it.x, it.y ?? 0, it.z);
      d.scale.set(it.sx ?? 1, it.sy ?? 1, it.sz ?? 1);
      d.rotation.set(0, it.ry ?? 0, 0);
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
      if (it.color) m.setColorAt(i, new THREE.Color(it.color));
    });
    group.add(m);
    return m;
  };
  const unitBox = () => { const b = new THREE.BoxGeometry(1, 1, 1); b.translate(0, 0.5, 0); return b; };
  const unitCone = (seg = 4) => { const c = new THREE.ConeGeometry(1, 1, seg); c.translate(0, 0.5, 0); return c; };
  const unitCyl = (seg = 8) => { const c = new THREE.CylinderGeometry(1, 1, 1, seg); c.translate(0, 0.5, 0); return c; };
  // place things in a ring around the stadium (outside the stands)
  const ring = (r, n, rMin, rMax, fn, { arc = [0, Math.PI * 2] } = {}) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = arc[0] + r() * (arc[1] - arc[0]);
      const d = rMin + r() * (rMax - rMin);
      const x = Math.cos(a) * d * 1.05;
      const z = Math.sin(a) * d * 1.25;
      const item = fn(x, z, d, a);
      if (item) (Array.isArray(item) ? out.push(...item) : out.push(item));
    }
    return out;
  };

  // ---- builders for each piece of scenery
  const pines = (r, n, rMin, rMax, snowy = false) => {
    const trunks = [];
    const tiers = [];
    ring(r, n, rMin, rMax, (x, z) => {
      const s = 0.8 + r() * 0.9;
      trunks.push({ x, z, sx: 0.8 * s, sy: 3 * s, sz: 0.8 * s });
      for (let k = 0; k < 3; k++) tiers.push({ x, y: (2 + k * 2.6) * s, z, sx: (4.2 - k * 1.2) * s, sy: 3 * s, sz: (4.2 - k * 1.2) * s, ry: r(), color: snowy && k === 2 ? '#f2f6f8' : ['#2d5a2e', '#2f6b34', '#25502a'][k] });
    });
    inst(unitBox(), lam('#6b4423'), trunks);
    inst(unitCone(4), lam('#ffffff'), tiers);
  };
  const roundTrees = (r, n, rMin, rMax) => {
    const trunks = [];
    const tops = [];
    ring(r, n, rMin, rMax, (x, z) => {
      const s = 0.8 + r() * 0.8;
      trunks.push({ x, z, sx: 0.8 * s, sy: 3.5 * s, sz: 0.8 * s });
      tops.push({ x, y: 3 * s, z, sx: 4 * s, sy: 3.4 * s, sz: 4 * s, ry: r(), color: ['#3d7a32', '#4a8a3a', '#356b2c'][Math.floor(r() * 3)] });
    });
    inst(unitBox(), lam('#6b4423'), trunks);
    inst(unitBox(), lam('#ffffff'), tops);
  };
  const mountains = (r, n, rMin, rMax, snow) => {
    const peaks = [];
    const caps = [];
    ring(r, n, rMin, rMax, (x, z) => {
      const h = 70 + r() * 110;
      const w = 50 + r() * 70;
      peaks.push({ x, z, sx: w, sy: h, sz: w, ry: r() * 3, color: ['#5b6470', '#6a6f7a', '#4f5a52'][Math.floor(r() * 3)] });
      if (snow || h > 130) caps.push({ x, y: h * 0.62, z, sx: w * 0.38, sy: h * 0.38, sz: w * 0.38, ry: r() * 3 });
    });
    inst(unitCone(5), lam('#ffffff'), peaks);
    inst(unitCone(5), lam('#f4f7fa'), caps);
  };
  const buildings = (r, n, rMin, rMax, maxH, lit, palette) => {
    const tex = windowTexture(lit);
    const sets = [[], [], []];
    ring(r, n, rMin, rMax, (x, z, d) => {
      const tall = (d - rMin) / (rMax - rMin);
      const h = 10 + r() * maxH * (0.4 + tall * 0.8);
      const w = 8 + r() * 12;
      const k = h > maxH * 0.7 ? 2 : h > maxH * 0.35 ? 1 : 0;
      sets[k].push({ x, z, sx: w, sy: h, sz: w * (0.7 + r() * 0.6), ry: Math.round(r() * 4) * (Math.PI / 2) + (r() - 0.5) * 0.3, color: palette[Math.floor(r() * palette.length)] });
    });
    [[2, 4], [3, 8], [4, 14]].forEach(([rx, ry], k) => {
      const t = tex.clone();
      t.needsUpdate = true;
      t.repeat.set(rx, ry);
      inst(unitBox(), lam('#ffffff', { map: t }), sets[k]);
    });
    // rooftop antennas on the tallest towers
    inst(unitBox(), basic('#ff4d4d'), sets[2].slice(0, 12).map((b) => ({ x: b.x, y: b.sy, z: b.z, sx: 0.5, sy: 8, sz: 0.5 })));
  };

  // ---- city landmarks (built-in pro teams). The offense attacks toward -z, so the big ones stand past that end
  const one = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) => { geos.push(geo); const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.y = ry; group.add(m); return m; };
  const water = (x, z, w, d, col = '#2f75c7') => { const m = one(new THREE.PlaneGeometry(w, d), basic(col), x, -0.04, z); m.rotation.x = -Math.PI / 2; return m; };
  const glow = (col) => basic(col, { toneMapped: false });
  const skyline = (r, n, maxH, night, palette = ['#9aa3ad', '#c8ccd2', '#7d8590', '#b8a99a', '#5f6875'], arc = [Math.PI * 1.15, Math.PI * 1.85], rr = [200, 330]) => {
    const tex = windowTexture(night ? 0.55 : 0.22);
    const items = [];
    for (let i = 0; i < n; i++) {
      const a = arc[0] + r() * (arc[1] - arc[0]); const d = rr[0] + r() * (rr[1] - rr[0]);
      const h = 14 + r() * maxH * (0.35 + r() * 0.65); const w = 8 + r() * 12;
      items.push({ x: Math.cos(a) * d, z: Math.sin(a) * d * 1.2, sx: w, sy: h, sz: w * (0.7 + r() * 0.5), ry: (r() - 0.5) * 0.4, color: palette[Math.floor(r() * palette.length)] });
    }
    const t = tex.clone(); t.needsUpdate = true; t.repeat.set(3, 9);
    inst(unitBox(), lam('#ffffff', { map: t }), items);
    return items;
  };
  const LANDMARKS = {
    skyline: (r, night) => skyline(r, 46, 95, night),
    bridge: () => { // a red suspension bridge across the bay past the far end zone
      const red = lam('#c0362c'); const z = -430;
      water(0, z, 1600, 120);
      one(unitBox(), red, 0, 14, z, 640, 2, 7); // deck
      for (const x of [-130, 130]) { for (const dz of [-3.5, 3.5]) one(unitBox(), red, x, 0, z + dz, 3, 125, 3); for (const y of [118, 80, 45]) one(unitBox(), red, x, y, z, 3, 2.5, 10); }
      const segs = [];
      for (const dz of [-3.5, 3.5]) for (let i = 0; i <= 64; i++) {
        const x = -320 + i * 10; let y;
        if (x < -130) y = 124 - ((-130 - x) / 190) * 108; else if (x > 130) y = 124 - ((x - 130) / 190) * 108; else { const k = x / 130; y = 18 + 106 * k * k; }
        segs.push({ x, y: Math.max(16, y), z: z + dz, sx: 10.5, sy: 0.8, sz: 0.8 });
        if (i % 2 === 0) segs.push({ x, y: 16, z: z + dz, sx: 0.3, sy: Math.max(0.1, y - 16), sz: 0.3 });
      }
      inst(unitBox(), red, segs);
    },
    hills: (r) => inst(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), lam('#ffffff'), ring(r, 16, 380, 560, (x, z) => (x > 150 ? null : { x, z, sx: 70 + r() * 70, sy: 30 + r() * 40, sz: 70 + r() * 70, color: ['#6f8f4a', '#8a9a5a', '#a0905a'][Math.floor(r() * 3)] }))),
    needle: (r, night) => { // a tall observation tower with a saucer on top
      const x = -80; const z = -290; const wm = lam('#e8ecef');
      for (const [dx, dz] of [[-3, -3], [3, -3], [0, 3.5]]) one(unitCyl(6), wm, x + dx, 0, z + dz, 1.2, 128, 1.2);
      one(unitCyl(16), wm, x, 0, z, 2, 145, 2);
      one(new THREE.CylinderGeometry(17, 7, 8, 24), lam('#d8dde2'), x, 145, z);
      one(new THREE.CylinderGeometry(11, 17, 3.5, 24), night ? glow('#ffcf7a') : lam('#f0a020'), x, 151, z);
      one(unitCone(8), wm, x, 154, z, 1.2, 26, 1.2);
    },
    volcano: () => { // one great snow-capped peak on the horizon
      one(unitCone(9), lam('#5d6670'), -260, 0, -760, 260, 300, 240);
      one(unitCone(9), lam('#f4f7fa'), -260, 175, -760, 108, 125, 100);
    },
    rockies: (r) => {
      const peaks = []; const caps = [];
      for (let i = 0; i < 22; i++) { const x = -720 + i * 68 + r() * 30; const h = 150 + r() * 160; const w = 110 + r() * 80; peaks.push({ x, z: -720 - r() * 120, sx: w, sy: h, sz: w, ry: r() * 3, color: ['#5b6470', '#6a6f7a', '#535d68'][i % 3] }); caps.push({ x: peaks[i].x, y: h * 0.6, z: peaks[i].z, sx: w * 0.4, sy: h * 0.4, sz: w * 0.4 }); }
      inst(unitCone(5), lam('#ffffff'), peaks); inst(unitCone(5), lam('#f4f7fa'), caps);
    },
    saltflat: () => { const m = one(new THREE.CircleGeometry(1, 48), basic('#eef0ea'), -120, -0.03, -560, 340, 1, 160); m.rotation.x = -Math.PI / 2; },
    temple: () => { // a pale granite cathedral with six spires
      const x = 150; const z = -300; const st = lam('#d9d6cc');
      one(unitBox(), st, x, 0, z, 38, 24, 22);
      for (const dx of [-15, -5, 5, 15]) for (const dz of [-8, 8]) if (Math.abs(dx) > 10 || dz < 0) { one(unitBox(), st, x + dx, 24, z + dz, 5, 16, 5); one(unitCone(4), st, x + dx, 40, z + dz, 3.5, 12, 3.5); }
      one(unitBox(), lam('#e8c45a'), x + 15, 52, z - 8, 0.8, 4, 0.8);
    },
    bridges: (r) => { // a river with steel bridges
      water(0, -300, 1600, 46, '#3b6e8f');
      for (const x of [-260, -90, 120, 300]) { one(unitBox(), lam('#3f4a52'), x, 6, -300, 14, 1.4, 60); for (const dz of [-20, 0, 20]) one(unitBox(), lam(x % 2 ? '#2f6f7a' : '#3f4a52'), x, 7, -300 + dz, 14, 10, 1.2); }
      void r;
    },
    river: () => water(0, -420, 1600, 60, '#3b6e8f'),
    lake: () => { water(520, 0, 760, 1600, '#3a7fbf'); },
    lakes: (r) => { for (let i = 0; i < 7; i++) { const a = r() * Math.PI * 2; const d = 190 + r() * 260; const m = one(new THREE.CircleGeometry(1, 28), basic('#5a8fc4'), Math.cos(a) * d, -0.04, Math.sin(a) * d * 1.2, 40 + r() * 60, 1, 25 + r() * 40); m.rotation.x = -Math.PI / 2; } },
    palms: (r) => {
      const trunks = []; const leaves = [];
      ring(r, 50, 115, 260, (x, z) => { if (x > 120) return null; const s = 1.1 + r() * 0.6; trunks.push({ x, z, sx: 0.7 * s, sy: 16 * s, sz: 0.7 * s }); leaves.push({ x, y: 16 * s, z, sx: 9 * s, sy: 1.2, sz: 2 * s, ry: r() * 3 }, { x, y: 16 * s, z, sx: 2 * s, sy: 1.2, sz: 9 * s, ry: r() * 3 }); return null; });
      inst(unitBox(), lam('#8b6a43'), trunks); inst(unitBox(), lam('#3d9a4a'), leaves);
    },
    saguaro: (r) => {
      const parts = [];
      ring(r, 60, 120, 320, (x, z) => { const s = 1.3 + r() * 0.9; parts.push({ x, z, sx: 1.6 * s, sy: 11 * s, sz: 1.6 * s }, { x: x + 2 * s, y: 4 * s, z, sx: 2.4 * s, sy: 1.2 * s, sz: 1.2 * s }, { x: x + 3 * s, y: 4 * s, z, sx: 1.2 * s, sy: 4.5 * s, sz: 1.2 * s }, { x: x - 2 * s, y: 6 * s, z, sx: 2.2 * s, sy: 1.1 * s, sz: 1.1 * s }, { x: x - 2.8 * s, y: 6 * s, z, sx: 1.1 * s, sy: 3.5 * s, sz: 1.1 * s }); });
      inst(unitBox(), lam('#3f7a35'), parts);
    },
    orb: (r, night) => { // a tower crowned by a lit geodesic ball
      const x = -150; const z = -320;
      one(unitCyl(10), lam('#bfc6cd'), x, 0, z, 3, 90, 3);
      one(new THREE.IcosahedronGeometry(11, 1), night ? glow('#9fe0ff') : lam('#dfe7ee', { flatShading: true }), x, 100, z);
    },
    strip: (r, night) => { // casino towers with neon bands and a needle tower
      const neon = ['#ff2ea6', '#2ef0ff', '#ffd23a', '#9b5cff', '#3dff8b'];
      const towers = skyline(r, 18, 80, true, ['#2a2433', '#3a2f45', '#1f2a3a', '#e8d9b8'], [Math.PI * 1.25, Math.PI * 1.75], [190, 280]);
      inst(unitBox(), glow('#ffffff'), towers.flatMap((t, i) => [0.35, 0.7, 0.95].map((k) => ({ x: t.x, y: t.sy * k, z: t.z, sx: t.sx + 0.6, sy: 1.6, sz: t.sz + 0.6, ry: t.ry, color: neon[(i + Math.round(k * 10)) % neon.length] }))));
      const x = 70; const z = -300;
      one(unitCyl(10), lam('#d8dde2'), x, 0, z, 4, 130, 4);
      one(new THREE.CylinderGeometry(12, 8, 10, 16), night ? glow('#ff2ea6') : lam('#c8ccd2'), x, 130, z);
      one(unitCone(6), lam('#d8dde2'), x, 140, z, 1.4, 26, 1.4);
    },
    pyramid: (r, night) => {
      one(new THREE.ConeGeometry(55, 60, 4), lam('#141416', { flatShading: true }), -230, 30, -360, 1, 1, 1, Math.PI / 4);
      if (night) one(unitCyl(8), glow('#fff6d6'), -230, 60, -360, 1.6, 500, 1.6);
    },
    spire: (r, night) => { // two record-tall towers with spires
      const tex = windowTexture(night ? 0.6 : 0.25); tex.repeat.set(3, 18);
      const m = lam('#ffffff', { map: tex });
      one(unitBox(), m, -60, 0, -380, 26, 120, 26); one(unitBox(), m, -60, 120, -380, 18, 30, 18); one(unitBox(), m, -60, 150, -380, 10, 18, 10); one(unitCone(4), lam('#c8ccd2'), -60, 168, -380, 3, 40, 3, Math.PI / 4);
      one(unitBox(), m, 90, 0, -420, 22, 170, 22); one(unitCone(4), lam('#dfe4ea'), 90, 170, -420, 2, 45, 2);
    },
    supertall: (r, night) => { // a black stepped tower with twin antennas
      const tex = windowTexture(night ? 0.5 : 0.12); tex.repeat.set(3, 20);
      const m = lam('#3a3d44', { map: tex });
      one(unitBox(), m, -110, 0, -380, 40, 110, 40); one(unitBox(), m, -110, 110, -380, 30, 50, 30); one(unitBox(), m, -110, 160, -380, 20, 30, 20);
      for (const dx of [-5, 5]) one(unitBox(), lam('#e6e6e6'), -110 + dx, 190, -380, 1.2, 50, 1.2);
    },
    obelisk: () => {
      one(unitBox(), lam('#f2efe6'), 0, 0, -420, 13, 140, 13);
      one(unitCone(4), lam('#f2efe6'), 0, 140, -420, 9.2, 14, 9.2, Math.PI / 4);
      water(0, -360, 40, 90, '#7fa8c9');
    },
    dome: () => { // a white capitol dome on a columned base
      const x = 100; const z = -320; const w = lam('#f4f2ec'); const k = 1.6;
      one(unitBox(), w, x, 0, z, 70 * k, 18 * k, 30 * k);
      one(unitCyl(16), w, x, 18 * k, z, 14 * k, 16 * k, 14 * k);
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; one(unitCyl(6), lam('#e2ded4'), x + Math.cos(a) * 13 * k, 18 * k, z + Math.sin(a) * 13 * k, 0.8 * k, 16 * k, 0.8 * k); }
      one(new THREE.SphereGeometry(14 * k, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), w, x, 34 * k, z);
      one(unitCyl(8), w, x, 47 * k, z, 2.5 * k, 8 * k, 2.5 * k);
    },
    superdome: () => { // a huge low white dome
      const x = -60; const z = -310;
      one(unitCyl(32), lam('#cfd3d8'), x, 0, z, 52, 24, 52);
      one(new THREE.SphereGeometry(52, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2), lam('#eef0f2', { flatShading: false }), x, 24, z, 1, 0.32, 1);
    },
    towers: (r, night) => { // a cluster of round glass towers by the river
      const tex = windowTexture(night ? 0.55 : 0.2); tex.repeat.set(8, 16);
      const g = lam('#ffffff', { map: tex, color: '#9fb4c8' });
      const x = 40; const z = -330;
      one(unitCyl(16), g, x, 0, z, 16, 175, 16);
      for (const [dx, dz, h] of [[-30, 10, 115], [30, 10, 115], [-26, -22, 115], [26, -22, 115]]) one(unitCyl(16), g, x + dx, 0, z + dz, 10, h, 10);
    },
    deco: (r) => { // pastel art-deco hotels along the beach
      const cols = ['#ffd1dc', '#b5ead7', '#fff1b6', '#c7ceea', '#ffdac1', '#e2f0cb'];
      const items = [];
      for (let i = 0; i < 26; i++) { const z = -520 + i * 40; const h = 14 + r() * 22; items.push({ x: 150 + r() * 10, z, sx: 24, sy: h, sz: 26, color: cols[i % cols.length] }, { x: 150, y: h, z, sx: 10, sy: 6, sz: 6, color: '#ffffff' }); }
      inst(unitBox(), lam('#ffffff'), items);
    },
    speedway: () => { // a racing oval with grandstands
      const x = -240; const z = -330;
      const track = one(new THREE.RingGeometry(46, 60, 40), basic('#4a4d52'), x, 0.05, z, 1.6, 1, 1); track.rotation.x = -Math.PI / 2;
      for (const dz of [-64, 64]) one(unitBox(), lam('#c8ccd2'), x, 0, z + dz * 0.98, 120, 10, 10);
      one(unitBox(), lam('#ffffff'), x, 10, z - 64, 120, 1.5, 10);
    },
    twinspire: (r, night) => { // a tower topped with two pointed spires
      const tex = windowTexture(night ? 0.55 : 0.2); tex.repeat.set(3, 14);
      const m = lam('#ffffff', { map: tex, color: '#9aa6b4' });
      one(unitBox(), m, -90, 0, -380, 32, 95, 24); one(unitBox(), m, -90, 95, -380, 22, 18, 20);
      for (const dx of [-8, 8]) one(unitCone(4), lam('#4a5560'), -90 + dx, 113, -380, 3.5, 38, 3.5, Math.PI / 4);
    },
    fountains: () => { for (const [x, z] of [[-140, -260], [140, -260], [0, -330]]) { one(unitCyl(16), lam('#cfc9be'), x, 0, z, 14, 2, 14); one(unitCyl(12), basic('#8fd0f0'), x, 2, z, 12, 0.3, 12); one(unitCone(8), basic('#e8f6ff'), x, 2, z, 3, 16, 3); } },
    arch: () => { // the stainless steel gateway arch
      const a = 1.32; const pts = [];
      for (let i = 0; i <= 40; i++) { const k = (i / 40) * 2 - 1; pts.push(new THREE.Vector3(k * 95, (190 * (Math.cosh(a) - Math.cosh(a * k))) / (Math.cosh(a) - 1), 0)); }
      one(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 4.2, 6), lam('#dfe4ea', { flatShading: false }), 0, 0, -430);
    },
  };

  return {
    group,
    /** Build scenery for a biome. opts: { night } */
    set(biome = 'plains', seed = 1, opts = {}) {
      clear();
      const r = seededRandom(`env:${biome}:${seed}`);
      // ground
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), lam(GROUND[biome] ?? GROUND.plains));
      geos.push(ground.geometry);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.12;
      group.add(ground);
      const night = !!opts.night;
      if (biome === 'city') {
        const lmk = (opts.landmarks ?? []).length > 0; // let the team's landmarks stand out over the skyline
        buildings(r, lmk ? 80 : 140, 130, 300, lmk ? 80 : 120, night ? 0.55 : 0.25, ['#9aa3ad', '#c8ccd2', '#7d8590', '#b8a99a', '#5f6875']);
        roundTrees(r, 40, 110, 135);
      } else if (biome === 'plains') {
        // fields in strips, barns, silos, a water tower
        const fields = [];
        for (let i = 0; i < 26; i++) { const a = r() * Math.PI * 2; const d = 170 + r() * 220; fields.push({ x: Math.cos(a) * d, y: -0.05, z: Math.sin(a) * d * 1.2, sx: 50 + r() * 60, sy: 0.1, sz: 30 + r() * 40, ry: r() * 3, color: ['#c9b458', '#7aa63a', '#9c7a3c', '#5d8c3a', '#b5c96a'][Math.floor(r() * 5)] }); }
        inst(unitBox(), lam('#ffffff'), fields);
        const barns = ring(r, 12, 150, 320, (x, z) => ({ x, z, sx: 14, sy: 10, sz: 20, ry: r() * 3, color: '#a83a2c' }));
        inst(unitBox(), lam('#ffffff'), barns);
        inst(unitCone(4), lam('#5a2a22'), barns.map((b) => ({ x: b.x, y: 10, z: b.z, sx: 11, sy: 6, sz: 15, ry: b.ry + Math.PI / 4 })));
        inst(unitCyl(8), lam('#d6dbe2'), ring(r, 10, 150, 320, (x, z) => ({ x, z, sx: 4, sy: 22 + r() * 10, sz: 4 })));
        const wt = { x: 160, z: -170 };
        inst(unitBox(), lam('#9aa3ad'), [[-3, -3], [3, -3], [-3, 3], [3, 3]].map(([dx, dz]) => ({ x: wt.x + dx, z: wt.z + dz, sx: 0.8, sy: 30, sz: 0.8 })));
        inst(unitCyl(10), lam('#e9ecef'), [{ x: wt.x, y: 30, z: wt.z, sx: 9, sy: 10, sz: 9 }]);
        roundTrees(r, 90, 115, 380);
      } else if (biome === 'mountain' || biome === 'snow') {
        pines(r, 220, 110, 330, biome === 'snow');
        mountains(r, 18, 380, 520, biome === 'snow');
      } else if (biome === 'desert') {
        const mesas = ring(r, 26, 220, 480, (x, z) => { const h = 25 + r() * 45; const w = 40 + r() * 60; return [{ x, z, sx: w, sy: h, sz: w * 0.7, ry: r() * 3, color: '#b5532d' }, { x, y: h, z, sx: w * 0.9, sy: 4, sz: w * 0.62, ry: 0, color: '#8a3a20' }]; });
        inst(unitBox(), lam('#ffffff'), mesas);
        const cacti = [];
        ring(r, 90, 110, 260, (x, z) => { const s = 0.8 + r() * 0.8; cacti.push({ x, z, sx: 1.2 * s, sy: 7 * s, sz: 1.2 * s }, { x: x + 1.4 * s, y: 3 * s, z, sx: 0.9 * s, sy: 3 * s, sz: 0.9 * s }); });
        inst(unitBox(), lam('#4f8a3a'), cacti);
        buildings(r, 24, 120, 160, 18, opts.night ? 0.5 : 0.15, ['#d9b48f', '#e8d4b0', '#c99a6b']);
      } else if (biome === 'coast') {
        // the ocean on one side, beach, boats, a lighthouse, palms, beach houses
        const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 1600), basic('#2f75c7'));
        geos.push(sea.geometry);
        sea.rotation.x = -Math.PI / 2;
        sea.position.set(560, -0.05, 0);
        group.add(sea);
        const foam = [];
        for (let i = 0; i < 70; i++) foam.push({ x: 140 + r() * 600, y: 0, z: -700 + r() * 1400, sx: 6 + r() * 10, sy: 0.15, sz: 1, color: '#dfeefe' });
        inst(unitBox(), basic('#ffffff'), foam);
        const boats = [];
        for (let i = 0; i < 14; i++) { const x = 180 + r() * 380; const z = -400 + r() * 800; boats.push({ x, y: 0, z, sx: 10, sy: 3, sz: 4, ry: r() * 3, color: '#f2f2f2' }, { x, y: 3, z, sx: 4, sy: 3, sz: 3, ry: 0, color: ['#e63946', '#1d3557', '#ffd166'][i % 3] }); }
        inst(unitBox(), lam('#ffffff'), boats);
        const lh = { x: 150, z: -230 };
        inst(unitCyl(10), lam('#ffffff'), [0, 1, 2, 3].map((k) => ({ x: lh.x, y: k * 9, z: lh.z, sx: 5 - k * 0.5, sy: 9, sz: 5 - k * 0.5, color: k % 2 ? '#d62828' : '#f4f4f4' })));
        inst(unitBox(), basic('#fff3a8'), [{ x: lh.x, y: 36, z: lh.z, sx: 4, sy: 4, sz: 4 }]);
        const trunks = [];
        const leaves = [];
        ring(r, 70, 110, 200, (x, z) => { if (x > 120) return null; const s = 0.9 + r() * 0.6; trunks.push({ x, z, sx: 0.8 * s, sy: 10 * s, sz: 0.8 * s }); leaves.push({ x, y: 10 * s, z, sx: 7 * s, sy: 1.2, sz: 2 * s, ry: r() * 3 }, { x, y: 10 * s, z, sx: 2 * s, sy: 1.2, sz: 7 * s, ry: r() * 3 }); return null; });
        inst(unitBox(), lam('#8b6a43'), trunks);
        inst(unitBox(), lam('#3d9a4a'), leaves);
        buildings(r, 40, 200, 320, 40, opts.night ? 0.5 : 0.2, ['#f2e6d0', '#a9d6e5', '#f4a261', '#ffffff'], );
      } else if (biome === 'swamp') {
        const pools = [];
        for (let i = 0; i < 30; i++) { const a = r() * Math.PI * 2; const d = 140 + r() * 260; pools.push({ x: Math.cos(a) * d, y: -0.06, z: Math.sin(a) * d * 1.2, sx: 30 + r() * 50, sy: 0.1, sz: 20 + r() * 40, ry: r() * 3, color: '#3b5a4a' }); }
        inst(unitBox(), basic('#ffffff'), pools);
        const trunks = [];
        const tops = [];
        ring(r, 140, 110, 360, (x, z) => { const s = 0.8 + r() * 0.8; trunks.push({ x, z, sx: 1.4 * s, sy: 12 * s, sz: 1.4 * s }); tops.push({ x, y: 11 * s, z, sx: 8 * s, sy: 2.5 * s, sz: 8 * s, ry: r(), color: ['#4a5a2c', '#3d4f26', '#5a6b34'][Math.floor(r() * 3)] }); });
        inst(unitBox(), lam('#5a4630'), trunks);
        inst(unitBox(), lam('#ffffff'), tops);
      }
      for (const lm of opts.landmarks ?? []) { try { LANDMARKS[lm]?.(seededRandom(`lm:${lm}:${seed}`), night); } catch (err) { console.error('landmark', lm, err); } }
    },
  };
}
