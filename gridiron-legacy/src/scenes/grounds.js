// The stadium grounds: an exterior facade wrapping the backs of the stands, the plaza, parking lots full of
// cars, tailgate tents and fans, light poles and a blimp overhead; plus sideline life inside (coolers, TV
// cameras, photographers, an inflatable team tunnel). Everything adapts to the level and the home colors.
import * as THREE from 'three';

const FIELD_W = 53.3;
const FIELD_L = 120;
// back of the highest visible tier (matches stadium.addStand: off = 6 + tier * 3, depth 3)
const BACK = (tiers) => 6 + (tiers - 1) * 3 + 1.5;
const LEVELS = { hs: { tiers: 3, ends: false }, college: { tiers: 7, ends: true }, pro: { tiers: 11, ends: true } };

function seeded(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function facadeTexture(c0, c1, hs) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  if (hs) {
    // bleacher back: painted steel frame and cross braces
    g.fillStyle = '#9aa4ae'; g.fillRect(0, 0, 128, 64);
    g.strokeStyle = '#6d7782'; g.lineWidth = 3;
    for (let x = 0; x <= 128; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 64); g.stroke(); g.beginPath(); g.moveTo(x, 64); g.lineTo(x + 32, 8); g.stroke(); }
    g.fillStyle = c0; g.fillRect(0, 0, 128, 7);
  } else {
    g.fillStyle = '#c9ccd1'; g.fillRect(0, 0, 128, 64);            // concrete
    g.fillStyle = '#20252e'; for (let y = 16; y < 52; y += 12) g.fillRect(0, y, 128, 6); // window bands
    g.fillStyle = 'rgba(255,240,200,0.55)'; for (let x = 3; x < 128; x += 9) for (let y = 17; y < 52; y += 12) if ((x * 7 + y) % 5) g.fillRect(x, y + 1, 4, 3);
    g.fillStyle = c0; for (let x = 0; x < 128; x += 32) g.fillRect(x, 6, 7, 58);  // team-colour ribs
    g.fillStyle = c0; g.fillRect(0, 0, 128, 7);                    // top band
    g.fillStyle = c1; g.fillRect(0, 7, 128, 2);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 60, 128, 4);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter;
  return t;
}
function lotTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#3d4248'; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`; g.fillRect(Math.random() * 64, Math.random() * 64, 2, 2); }
  g.fillStyle = 'rgba(240,240,230,0.7)'; for (let x = 0; x < 64; x += 8) { g.fillRect(x, 0, 1, 22); g.fillRect(x, 42, 1, 22); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function buildGrounds(world) {
  const root = new THREE.Group(); world.add(root);
  const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });
  const lam = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
  const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const cone4 = new THREE.ConeGeometry(0.72, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0);
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 10).translate(0, 0.5, 0);
  const inst = (geo, mat, items, parent = root) => {
    const m = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length));
    const d = new THREE.Object3D();
    items.forEach((it, i) => {
      d.position.set(it.x, it.y ?? 0, it.z); d.scale.set(it.sx ?? 1, it.sy ?? 1, it.sz ?? 1); d.rotation.set(0, it.ry ?? 0, 0); d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
      if (it.color) m.setColorAt(i, new THREE.Color(it.color));
    });
    m.count = items.length;
    parent.add(m);
    return m;
  };

  let level = 'pro';
  let colors = ['#1d3557', '#f1c40f'];
  let built = null;
  const facadeMat = basic('#ffffff');
  const blimp = new THREE.Group();
  {
    const env = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), lam('#e9ecef'));
    env.scale.set(14, 4, 4); blimp.add(env);
    const band = new THREE.Mesh(new THREE.SphereGeometry(1.01, 20, 12, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.16), basic('#1d3557'));
    band.scale.set(14, 4, 4); band.rotation.z = Math.PI / 2; blimp.add(band); blimp.userData.band = band;
    for (const [y, z, rx] of [[2.6, 0, 0], [-2.6, 0, 0], [0, 2.6, Math.PI / 2], [0, -2.6, Math.PI / 2]]) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 0.3), lam('#c92a2a')); fin.position.set(12, y * 0.8, z * 0.8); fin.rotation.x = rx; blimp.add(fin);
    }
    const gondola = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 1.2), lam('#5c636a')); gondola.position.y = -4.2; blimp.add(gondola);
    root.add(blimp);
  }

  const rebuild = () => {
    if (built) { root.remove(built); built.traverse((o) => { if (o.isMesh) { o.geometry !== box && o.geometry !== cone4 && o.geometry !== cyl && o.geometry.dispose(); } }); }
    built = new THREE.Group(); root.add(built);
    const L = LEVELS[level];
    const r = seeded(level.length * 97 + colors[0].charCodeAt(1));
    const hs = level === 'hs';
    const hTop = 1.6 + (L.tiers - 1) * 1.6;
    const sideX = FIELD_W / 2 + 4 + BACK(L.tiers);
    const endZ = FIELD_L / 2 + 4 + BACK(L.tiers);
    const wallH = hs ? hTop : hTop + 3;
    // ---- facade: walls behind the stands, corners filled
    facadeMat.map?.dispose(); facadeMat.map = facadeTexture(colors[0], colors[1], hs); facadeMat.needsUpdate = true;
    const wall = (len, x, z, ry) => {
      const geo = new THREE.PlaneGeometry(len, wallH); geo.translate(0, wallH / 2, 0);
      const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len / 14);
      const m = new THREE.Mesh(geo, facadeMat); m.position.set(x, 0, z); m.rotation.y = ry; built.add(m);
      const back = m.clone(); back.material = facadeMat; back.rotation.y = ry + Math.PI; built.add(back);
    };
    const sideLen = hs ? FIELD_L : 2 * endZ;
    wall(sideLen, sideX, 0, -Math.PI / 2); wall(sideLen, -sideX, 0, Math.PI / 2);
    if (L.ends) {
      wall(2 * sideX, 0, endZ, Math.PI); wall(2 * sideX, 0, -endZ, 0);
      // a lit crown around the top of the bowl
      const crown = basic(colors[1]);
      for (const [w, d, x, z] of [[2 * sideX + 1, 0.6, 0, endZ], [2 * sideX + 1, 0.6, 0, -endZ], [0.6, 2 * endZ, sideX, 0], [0.6, 2 * endZ, -sideX, 0]]) {
        const m = new THREE.Mesh(box, crown); m.scale.set(w, 0.5, d); m.position.set(x, wallH, z); built.add(m);
      }
      // big team banners on the outside walls
      for (const [x, z, ry] of [[sideX + 0.05, 0, Math.PI / 2], [-sideX - 0.05, 0, -Math.PI / 2], [0, endZ + 0.05, 0], [0, -endZ - 0.05, Math.PI]]) {
        const ban = new THREE.Mesh(new THREE.PlaneGeometry(10, wallH * 0.62), basic(colors[0]));
        ban.position.set(x, wallH * 0.5, z); ban.rotation.y = ry; built.add(ban);
        const stripe = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.2), basic(colors[1])); stripe.position.set(x * 1.0005, wallH * 0.3, z * 1.0005); stripe.rotation.y = ry; built.add(stripe);
      }
    }
    // ---- plaza
    const plazaOut = 14;
    const plaza = new THREE.Mesh(new THREE.PlaneGeometry(2 * (sideX + plazaOut), 2 * (endZ + plazaOut)), basic(hs ? '#8a8f85' : '#b9b4aa'));
    plaza.rotation.x = -Math.PI / 2; plaza.position.y = -0.08; built.add(plaza);
    // ---- parking lots on all four sides
    const lotMat = basic('#ffffff', { map: lotTexture() });
    const lots = [];
    const lotW = hs ? 26 : 40;
    lots.push([sideX + plazaOut + lotW / 2, 0, lotW, 2 * endZ + 20], [-(sideX + plazaOut + lotW / 2), 0, lotW, 2 * endZ + 20]);
    lots.push([0, endZ + plazaOut + lotW / 2, 2 * sideX + 20, lotW], [0, -(endZ + plazaOut + lotW / 2), 2 * sideX + 20, lotW]);
    const cars = [], roofs = [], tents = [], tables = [], fans = [], poles = [], heads = [];
    const carCols = ['#c92a2a', '#1c7ed6', '#f1f3f5', '#212529', '#868e96', '#2b8a3e', '#e8590c', '#495057', '#f8f9fa', '#364fc7'];
    for (const [cx, cz, w, d] of lots) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lotMat.clone());
      m.material.map = lotMat.map.clone(); m.material.map.repeat.set(w / 10, d / 10); m.material.map.needsUpdate = true;
      m.rotation.x = -Math.PI / 2; m.position.set(cx, -0.06, cz); built.add(m);
      const alongX = w > d;
      const rows = Math.floor((alongX ? d : w) / 7), slots = Math.floor((alongX ? w : d) / 2.6);
      for (let ri = 0; ri < rows; ri++) for (let si = 0; si < slots; si++) {
        if (r() < (hs ? 0.45 : 0.25)) continue;
        const a = -(alongX ? w : d) / 2 + (si + 0.5) * 2.6, b = -(alongX ? d : w) / 2 + 3 + ri * 7;
        const x = cx + (alongX ? a : b), z = cz + (alongX ? b : a);
        const ry = alongX ? 0 : Math.PI / 2;
        const col = carCols[Math.floor(r() * carCols.length)];
        // tailgates: some spots become a tent with a table and fans around it
        if (r() < (hs ? 0.05 : 0.09)) {
          tents.push({ x, y: 2.1, z, sx: 4, sy: 1.4, sz: 4, color: r() < 0.6 ? colors[0] : colors[1] });
          for (const [px, pz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) poles.push({ x: x + px, z: z + pz, sx: 0.06, sy: 2.1, sz: 0.06, color: '#dee2e6' });
          tables.push({ x, z, sx: 1.8, sy: 0.8, sz: 0.8, color: '#f1f3f5' });
          for (let k = 0; k < 4; k++) { const fx = x + (r() - 0.5) * 5, fz = z + (r() - 0.5) * 5; fans.push({ x: fx, z: fz, sx: 0.5, sy: 1.25, sz: 0.35, color: r() < 0.6 ? colors[0] : colors[1] }); heads.push({ x: fx, y: 1.25, z: fz, sx: 0.32, sy: 0.32, sz: 0.32, color: ['#f1c27d', '#c68642', '#8d5524', '#e0ac69'][k] }); }
          continue;
        }
        cars.push({ x, z, sx: alongX ? 1.7 : 3.9, sy: 1.0, sz: alongX ? 3.9 : 1.7, ry: 0, color: col });
        roofs.push({ x, y: 1.0, z, sx: alongX ? 1.5 : 2.2, sy: 0.55, sz: alongX ? 2.2 : 1.5, color: col === '#f1f3f5' || col === '#f8f9fa' ? '#ced4da' : '#2b2f33' });
      }
      // light poles down the lot
      for (let k = -2; k <= 2; k++) {
        const x = cx + (alongX ? k * w / 5 : 0), z = cz + (alongX ? 0 : k * d / 5);
        poles.push({ x, z, sx: 0.18, sy: 9, sz: 0.18, color: '#868e96' });
        heads.push({ x, y: 9, z, sx: 1.6, sy: 0.35, sz: 0.6, color: '#fff3bf' });
      }
    }
    inst(box, lam('#ffffff'), cars, built); inst(box, lam('#ffffff'), roofs, built);
    inst(cone4, lam('#ffffff'), tents, built); inst(box, lam('#ffffff'), tables, built);
    inst(box, lam('#ffffff'), fans, built); inst(box, basic('#ffffff'), poles, built); inst(box, basic('#ffffff'), heads, built);
    // fans walking across the plaza to the gates
    const walkers = [], walkerHeads = [];
    for (let i = 0; i < (hs ? 40 : 120); i++) {
      const side = Math.floor(r() * 4);
      const along = (r() - 0.5) * 2;
      const x = side < 2 ? (side ? 1 : -1) * (sideX + 2 + r() * (plazaOut - 3)) : along * sideX;
      const z = side < 2 ? along * endZ : (side === 2 ? 1 : -1) * (endZ + 2 + r() * (plazaOut - 3));
      walkers.push({ x, z, sx: 0.5, sy: 1.2, sz: 0.35, color: r() < 0.7 ? colors[r() < 0.5 ? 0 : 1] : ['#495057', '#f8f9fa', '#c92a2a'][i % 3] });
      walkerHeads.push({ x, y: 1.2, z, sx: 0.32, sy: 0.32, sz: 0.32, color: ['#f1c27d', '#c68642', '#8d5524', '#e0ac69', '#ffdbac'][i % 5] });
    }
    inst(box, lam('#ffffff'), walkers, built); inst(box, lam('#ffffff'), walkerHeads, built);

    // ---- inside: sideline life
    const inside = new THREE.Group(); built.add(inside);
    const coolers = [], cams = [], photogs = [], photoHeads = [];
    for (const sd of [-1, 1]) {
      for (const z of [-14, 0, 14]) coolers.push({ x: sd * (FIELD_W / 2 + 7.2), z, sx: 0.45, sy: 0.9, sz: 0.45, color: '#ff8c1a' });
      cams.push({ x: sd * (FIELD_W / 2 + 4.6), z: 0, sx: 0.5, sy: 2.2, sz: 0.5, color: '#2b2f33' }, { x: sd * (FIELD_W / 2 + 4.6), z: sd * 30, sx: 0.5, sy: 2.2, sz: 0.5, color: '#2b2f33' });
    }
    for (const ez of [-1, 1]) for (let i = 0; i < 7; i++) {
      const x = -18 + i * 6 + (r() - 0.5) * 2, z = ez * (FIELD_L / 2 + 2.6);
      photogs.push({ x, z, sx: 0.5, sy: 0.75, sz: 0.4, color: '#343a40' });
      photoHeads.push({ x, y: 0.75, z, sx: 0.3, sy: 0.3, sz: 0.3, color: ['#f1c27d', '#c68642', '#8d5524'][i % 3] });
      cams.push({ x: x + 0.15, y: 0.8, z: z - ez * 0.35, sx: 0.25, sy: 0.22, sz: 0.5, color: '#111111' });
    }
    inst(cyl, lam('#ffffff'), coolers, inside); inst(box, lam('#ffffff'), cams, inside);
    inst(box, lam('#ffffff'), photogs, inside); inst(box, lam('#ffffff'), photoHeads, inside);
    // TV camera heads on the sideline towers
    for (const sd of [-1, 1]) for (const z of [0, sd * 30]) {
      const head = new THREE.Mesh(box, lam('#1a1a1a')); head.scale.set(0.6, 0.5, 1.1); head.position.set(sd * (FIELD_W / 2 + 4.6), 2.2, z); built.add(head);
    }
    // inflatable team tunnel the home team runs out of (college / pro)
    if (L.ends) {
      const tun = new THREE.Group(); tun.position.set(FIELD_W / 2 - 4, 0, FIELD_L / 2 - 1);
      const arch = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 7, 16, 1, true, 0, Math.PI), lam(colors[0], { side: THREE.DoubleSide }));
      arch.rotation.z = Math.PI / 2; arch.rotation.y = Math.PI / 2; arch.position.set(0, 0, 3.5); tun.add(arch);
      const helmet = new THREE.Mesh(new THREE.SphereGeometry(3, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), lam(colors[0]));
      helmet.position.set(0, 0, 7.5); tun.add(helmet);
      const stripe = new THREE.Mesh(new THREE.TorusGeometry(3.02, 0.25, 6, 20, Math.PI), basic(colors[1])); stripe.rotation.y = Math.PI / 2; stripe.position.set(0, 0, 7.5); tun.add(stripe);
      built.add(tun);
    }
    blimp.visible = !hs;
    blimp.userData.band.material.color.set(colors[0]);
    blimp.userData.r = Math.max(sideX, endZ) + 70;
  };
  rebuild();
  return {
    setLevel(l) { if (l !== level && LEVELS[l]) { level = l; rebuild(); } },
    setColors(c) { if (c?.[0] && (c[0] !== colors[0] || c[1] !== colors[1])) { colors = [c[0], c[1] ?? c[0]]; rebuild(); } },
    animate(t) {
      if (!blimp.visible) return;
      const a = t * 0.025, R = blimp.userData.r ?? 140;
      blimp.position.set(Math.cos(a) * R, 62 + Math.sin(t * 0.3) * 1.5, Math.sin(a) * R * 1.2);
      blimp.rotation.y = -a - Math.PI / 2;
    },
  };
}
