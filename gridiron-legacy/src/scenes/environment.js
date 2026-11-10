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
        buildings(r, 140, 130, 300, 120, night ? 0.55 : 0.25, ['#9aa3ad', '#c8ccd2', '#7d8590', '#b8a99a', '#5f6875']);
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
    },
  };
}
