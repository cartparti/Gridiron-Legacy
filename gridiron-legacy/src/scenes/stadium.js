// Procedural low-poly stadium: striped field with painted lines, end zones,
// stepped stands with an instanced crowd, light towers and goalposts.
// Field coordinates (yards): x across (-26.65..26.65), z along. Goal lines at z = ±50.
import * as THREE from 'three';

const FIELD_W = 53.3;
const FIELD_L = 120;

function fieldTexture(homeColors, awayColors, homeName = 'HOME', awayName = 'AWAY') {
  const ppy = 10; // pixels per yard: low on purpose for a chunky retro look
  const cw = Math.round(FIELD_W * ppy);
  const ch = FIELD_L * ppy;
  const c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  const g = c.getContext('2d');
  
  // Grass stripes every 5 yards.
  for (let y = 0; y < FIELD_L; y += 5) {
    g.fillStyle = Math.floor(y / 5) % 2 ? '#2f6f35' : '#377b3a';
    g.fillRect(0, y * ppy, cw, 5 * ppy);
  }
  // Pixel grass noise.
  for (let i = 0; i < cw * ch * 0.05; i++) {
    const x = Math.floor(Math.random() * cw);
    const y = Math.floor(Math.random() * ch);
    g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.05)';
    g.fillRect(x, y, 1, 1);
  }
  // End zones.
  const ez = (y0, col, txt) => {
    g.fillStyle = col[0];
    g.fillRect(0, y0 * ppy, cw, 10 * ppy);
    g.save();
    g.fillStyle = col[1];
    g.font = `900 ${5 * ppy}px "Silkscreen", "Courier New", monospace`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.translate(cw / 2, (y0 + 5) * ppy);
    if (y0 > 50) g.rotate(Math.PI);
    g.fillText(txt.toUpperCase(), 0, 0);
    g.restore();
  };
  ez(0, homeColors, homeName);
  ez(110, awayColors, awayName);
  // diagonal pinstripes in the end zones
  g.save();
  g.globalAlpha = 0.14;
  g.fillStyle = '#ffffff';
  for (const y0 of [0, 110]) {
    g.save();
    g.beginPath(); g.rect(0, y0 * ppy, cw, 10 * ppy); g.clip();
    for (let x = -ch; x < cw + ch; x += 18) { g.beginPath(); g.moveTo(x, y0 * ppy); g.lineTo(x + 8, y0 * ppy); g.lineTo(x + 8 - 10 * ppy, (y0 + 10) * ppy); g.lineTo(x - 10 * ppy, (y0 + 10) * ppy); g.fill(); }
    g.restore();
  }
  g.restore();
  // Lines.
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, cw, 2); g.fillRect(0, ch - 2, cw, 2); g.fillRect(0, 0, 2, ch); g.fillRect(cw - 2, 0, 2, ch);
  for (let y = 10; y <= 110; y += 5) g.fillRect(0, Math.round(y * ppy) - 1, cw, y === 10 || y === 110 ? 3 : 1);
  // Hash marks.
  for (let y = 11; y < 110; y++) {
    for (const hx of [1, 18.4, FIELD_W - 18.4 - 1, FIELD_W - 2]) g.fillRect(Math.round(hx * ppy), Math.round(y * ppy), 3, 1);
  }
  // Numbers.
  g.font = `bold ${Math.round(2.6 * ppy)}px "Silkscreen", "Courier New", monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let y = 20; y <= 100; y += 10) {
    const n = y <= 60 ? y - 10 : 110 - y;
    for (const [xx, rot] of [[9, -Math.PI / 2], [FIELD_W - 9, Math.PI / 2]]) {
      g.save();
      g.translate(xx * ppy, y * ppy);
      g.rotate(rot);
      g.fillText(String(n), 0, 0);
      g.restore();
    }
  }
  // Midfield logo.
  g.beginPath();
  g.arc(cw / 2, 60 * ppy, 5 * ppy, 0, Math.PI * 2);
  g.fillStyle = homeColors[0];
  g.globalAlpha = 0.85;
  g.fill();
  g.globalAlpha = 1;
  g.lineWidth = 4;
  g.strokeStyle = homeColors[1];
  g.stroke();
  g.fillStyle = homeColors[1];
  g.font = `bold ${Math.round(3.2 * ppy)}px "Silkscreen", "Courier New", monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(homeName).slice(0, 3).toUpperCase(), cw / 2, 60 * ppy + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.anisotropy = 4;
  return tex;
}

export function buildStadium(scene) {
  const world = new THREE.Group();
  scene.add(world);
  // Flat, unlit colors read as clean pixel art once the scene is rendered at low resolution.
  const lambert = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });

  // Surrounding turf / track.
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(FIELD_W + 24, FIELD_L + 24), lambert('#2a6430'));
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.02;
  world.add(apron);
  const track = new THREE.Mesh(new THREE.PlaneGeometry(FIELD_W + 60, FIELD_L + 60), lambert('#6b4b3a'));
  track.rotation.x = -Math.PI / 2;
  track.position.y = -0.05;
  world.add(track);

  const border = new THREE.Mesh(new THREE.PlaneGeometry(FIELD_W + 6, FIELD_L + 6), new THREE.MeshBasicMaterial({ color: '#1d3557' }));
  border.rotation.x = -Math.PI / 2;
  border.position.y = -0.01;
  world.add(border);
  const fieldMat = new THREE.MeshBasicMaterial({ map: fieldTexture(['#1d3557', '#f1c40f'], ['#b5121b', '#f5d547']) });
  const field = new THREE.Mesh(new THREE.PlaneGeometry(FIELD_W, FIELD_L), fieldMat);
  field.rotation.x = -Math.PI / 2; // canvas top ends up at -z (the end zone the offense attacks)
  world.add(field);

  // Stands: stepped tiers on all four sides.
  const pixTex = (w, h, draw, repeat = [1, 1]) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'));
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  // Concrete tiers with a painted railing stripe and seat backs.
  const tierTex = (base) => pixTex(16, 16, (g) => {
    g.fillStyle = base; g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#5a6272'; g.fillRect(0, 0, 16, 2);
    g.fillStyle = '#1f2430'; for (let x = 1; x < 16; x += 4) g.fillRect(x, 4, 2, 4);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 14, 16, 2);
  }, [40, 1]);
  const standMat = new THREE.MeshBasicMaterial({ map: tierTex('#3b4252') });
  const standMat2 = new THREE.MeshBasicMaterial({ map: tierTex('#323847') });
  const crowdPositions = [];
  const addStand = (cx, cz, len, alongX, facing) => {
    for (let tier = 0; tier < 7; tier++) {
      const depth = 3;
      const geo = new THREE.BoxGeometry(alongX ? len : depth, 1.6 + tier * 1.6, alongX ? depth : len);
      const m = new THREE.Mesh(geo, tier % 2 ? standMat : standMat2);
      const off = 6 + tier * depth;
      m.position.set(alongX ? cx : cx + facing * off, (1.6 + tier * 1.6) / 2, alongX ? cz + facing * off : cz);
      world.add(m);
      const n = Math.floor(len / 1.3);
      for (let i = 0; i < n; i++) {
        const along = -len / 2 + (i + 0.5) * (len / n) + (Math.random() - 0.5) * 0.4;
        crowdPositions.push(alongX
          ? new THREE.Vector3(cx + along, 1.6 + tier * 1.6 + 0.45, cz + facing * off)
          : new THREE.Vector3(cx + facing * off, 1.6 + tier * 1.6 + 0.45, cz + along));
      }
    }
  };
  addStand(FIELD_W / 2 + 4, 0, FIELD_L, false, 1);
  addStand(-FIELD_W / 2 - 4, 0, FIELD_L, false, -1);
  addStand(0, FIELD_L / 2 + 4, FIELD_W + 20, true, 1);
  addStand(0, -FIELD_L / 2 - 4, FIELD_W + 20, true, -1);

  // Voxel fans: a body and a head per seat (two instanced meshes, colored per instance).
  const crowdGeo = new THREE.BoxGeometry(0.72, 0.8, 0.5);
  const headGeo = new THREE.BoxGeometry(0.42, 0.42, 0.42);
  headGeo.translate(0, 0.62, 0);
  const crowd = new THREE.InstancedMesh(crowdGeo, new THREE.MeshBasicMaterial(), crowdPositions.length);
  const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshBasicMaterial(), crowdPositions.length);
  const dummy = new THREE.Object3D();
  const skins = ['#f7dcc0', '#e0ab7f', '#cc9260', '#b07646', '#8f5a34', '#6e4126', '#4d2c1a'].map((c) => new THREE.Color(c));
  crowdPositions.forEach((p, i) => {
    dummy.position.copy(p);
    dummy.updateMatrix();
    crowd.setMatrixAt(i, dummy.matrix);
    heads.setMatrixAt(i, dummy.matrix);
    heads.setColorAt(i, skins[Math.floor(Math.random() * skins.length)]);
  });
  crowd.userData.base = crowdPositions;
  world.add(crowd, heads);

  // About a third of the fans have their arms up (one instanced mesh of V-shaped arms).
  const armGeo = (() => {
    const a = new THREE.BoxGeometry(0.16, 0.62, 0.16); a.translate(0, 0.31, 0);
    const l = a.clone(); l.rotateZ(0.45); l.translate(-0.34, 0.25, 0);
    const r = a.clone(); r.rotateZ(-0.45); r.translate(0.34, 0.25, 0);
    const pos = [...l.attributes.position.array, ...r.attributes.position.array];
    const nor = [...l.attributes.normal.array, ...r.attributes.normal.array];
    const idx = [...l.index.array, ...r.index.array.map((i) => i + l.attributes.position.count)];
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    gg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    gg.setIndex(idx);
    return gg;
  })();
  const cheerIdx = crowdPositions.map((_, i) => i).filter(() => Math.random() < 0.34);
  const arms = new THREE.InstancedMesh(armGeo, new THREE.MeshBasicMaterial({ color: '#ffffff' }), cheerIdx.length);
  world.add(arms);
  // Signs and foam fingers held above some heads.
  const signTex = (() => {
    const c2 = document.createElement('canvas'); c2.width = 64; c2.height = 16;
    const g2 = c2.getContext('2d');
    const designs = [['#ffffff', '#c62f2f', 'GO!'], ['#f2c12e', '#1d1f24', '#1'], ['#ffffff', '#1f3a7a', 'D!'], ['#e63946', '#ffffff', 'TD!']];
    designs.forEach(([bg, fg, txt], i) => { g2.fillStyle = bg; g2.fillRect(i * 16, 0, 16, 16); g2.fillStyle = fg; g2.font = 'bold 8px monospace'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText(txt, i * 16 + 8, 8.5); });
    const t = new THREE.CanvasTexture(c2); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const signIdx = crowdPositions.map((_, i) => i).filter(() => Math.random() < 0.07);
  const signGeo = new THREE.PlaneGeometry(1.2, 0.8);
  const uv = signGeo.attributes.uv;
  const signMeshes = [0, 1, 2, 3].map((k) => {
    const gq = signGeo.clone();
    const u = gq.attributes.uv;
    for (let i = 0; i < u.count; i++) u.setX(i, (k + uv.getX(i)) / 4);
    const list = signIdx.filter((_, j) => j % 4 === k);
    const mm = new THREE.InstancedMesh(gq, new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide }), Math.max(1, list.length));
    mm.count = list.length;
    mm.userData.list = list;
    world.add(mm);
    return mm;
  });
  // Camera flashes popping in the stands.
  const flashN = 260;
  const flashGeo = new THREE.BufferGeometry();
  const fpos = new Float32Array(flashN * 3);
  const fcol = new Float32Array(flashN * 3);
  for (let i = 0; i < flashN; i++) { const p = crowdPositions[Math.floor(Math.random() * crowdPositions.length)]; fpos.set([p.x, p.y + 0.9, p.z], i * 3); }
  flashGeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
  flashGeo.setAttribute('color', new THREE.BufferAttribute(fcol, 3));
  const flashes = new THREE.Points(flashGeo, new THREE.PointsMaterial({ size: 3, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false }));
  world.add(flashes);
  let flashRate = 0.004;

  // Ad boards around the field.
  const adTex = (() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 16;
    const g = c.getContext('2d');
    const slogans = ['GRIDIRON LEAGUE', 'FIZZ COLA', 'IRONCLAD GYM', 'GRIDIRON LEAGUE', 'TURBO TIRES', 'BOLT ENERGY'];
    const cols = [['#c62f2f', '#ffffff'], ['#ffffff', '#1f3a7a'], ['#1d1f24', '#f2c12e'], ['#c62f2f', '#ffffff'], ['#2c6fd6', '#ffffff'], ['#f2c12e', '#1d1f24']];
    g.font = 'bold 9px monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let i = 0; i < 6; i++) {
      const x = i * (256 / 6);
      g.fillStyle = cols[i][0];
      g.fillRect(x, 0, 256 / 6, 16);
      g.fillStyle = cols[i][1];
      g.fillText(slogans[i].split(' ')[0], x + 256 / 12, 8.5);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    t.wrapS = THREE.RepeatWrapping;
    return t;
  })();
  const board = (len, x, z, rotY) => {
    const tex = adTex.clone();
    tex.needsUpdate = true;
    tex.repeat.set(len / 40, 1);
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, 1.1, 0.2), [lambert('#222'), lambert('#222'), lambert('#333'), lambert('#222'), new THREE.MeshBasicMaterial({ map: tex }), new THREE.MeshBasicMaterial({ map: tex })]);
    m.position.set(x, 0.55, z);
    m.rotation.y = rotY;
    world.add(m);
  };
  board(FIELD_L + 6, FIELD_W / 2 + 3.2, 0, Math.PI / 2);
  board(FIELD_L + 6, -FIELD_W / 2 - 3.2, 0, -Math.PI / 2);
  board(FIELD_W + 6, 0, FIELD_L / 2 + 3, 0);
  board(FIELD_W + 6, 0, -FIELD_L / 2 - 3, 0);


  // Roof canopies over the sideline stands, with a strip of lights underneath.
  for (const sd of [-1, 1]) {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(14, 1.2, FIELD_L + 10), lambert('#1c2029'));
    roof.position.set(sd * (FIELD_W / 2 + 22), 15.5, 0);
    world.add(roof);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(1, 0.3, FIELD_L + 6), new THREE.MeshBasicMaterial({ color: '#fff6d8' }));
    strip.position.set(sd * (FIELD_W / 2 + 16), 14.8, 0);
    world.add(strip);
    for (let z = -FIELD_L / 2; z <= FIELD_L / 2; z += 15) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 15, 0.6), lambert('#2a2f3a'));
      post.position.set(sd * (FIELD_W / 2 + 28), 7.5, z);
      world.add(post);
    }
  }

  // Big screen behind the far end zone.
  const jumboCanvas = document.createElement('canvas');
  jumboCanvas.width = 128;
  jumboCanvas.height = 48;
  const jumboTex = new THREE.CanvasTexture(jumboCanvas);
  jumboTex.magFilter = THREE.NearestFilter;
  jumboTex.colorSpace = THREE.SRGBColorSpace;
  const jumbo = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(34, 14, 1.2), lambert('#15181e'));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(32, 12), new THREE.MeshBasicMaterial({ map: jumboTex }));
  screen.position.z = 0.62;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(1.2, 22, 1.2), lambert('#2a2f3a'));
  legL.position.set(-12, -16, 0);
  const legR = legL.clone();
  legR.position.x = 12;
  jumbo.add(frame, screen, legL, legR);
  jumbo.position.set(0, 30, -FIELD_L / 2 - 30);
  world.add(jumbo);
  const drawJumbo = (info = {}) => {
    const g = jumboCanvas.getContext('2d');
    g.fillStyle = '#05070a'; g.fillRect(0, 0, 128, 48);
    // LED dot texture
    g.fillStyle = 'rgba(255,255,255,0.03)';
    for (let y = 0; y < 48; y += 2) g.fillRect(0, y, 128, 1);
    const half = (x, col, name, pts) => {
      g.fillStyle = col[0]; g.fillRect(x, 4, 56, 12);
      g.fillStyle = col[1]; g.font = 'bold 9px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(name).slice(0, 9).toUpperCase(), x + 28, 10.5);
      g.fillStyle = '#ffd43b'; g.font = 'bold 20px monospace'; g.fillText(String(pts ?? 0), x + 28, 30);
    };
    half(4, info.awayColors ?? ['#b5121b', '#ffffff'], info.away ?? 'AWAY', info.awayPts);
    half(68, info.homeColors ?? ['#1d3557', '#ffffff'], info.home ?? 'HOME', info.homePts);
    g.fillStyle = '#ffffff'; g.font = 'bold 7px monospace'; g.textAlign = 'center';
    g.fillText(info.clock ?? 'GRIDIRON LEAGUE', 64, 44);
    jumboTex.needsUpdate = true;
  };
  drawJumbo();

  // Sidelines: benches and a row of teammates in uniform on each side (instanced, cheap).
  const sideGroups = {};
  for (const sd of [-1, 1]) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 26), lambert('#2a2f3a'));
    bench.position.set(sd * (FIELD_W / 2 + 6.2), 0.3, 0);
    world.add(bench);
    const area = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.12 }));
    area.rotation.x = -Math.PI / 2;
    area.position.set(sd * (FIELD_W / 2 + 4), 0.01, 0);
    world.add(area);
    const n = 22;
    const bodyG = new THREE.BoxGeometry(0.62, 0.9, 0.4); bodyG.translate(0, 1.15, 0);
    const legG = new THREE.BoxGeometry(0.5, 0.75, 0.32); legG.translate(0, 0.38, 0);
    const headG = new THREE.BoxGeometry(0.46, 0.46, 0.44); headG.translate(0, 1.85, 0);
    const parts = [bodyG, legG, headG].map((geo) => new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: '#ffffff' }), n));
    const base = [];
    for (let i = 0; i < n; i++) {
      const p = new THREE.Vector3(sd * (FIELD_W / 2 + 3 + Math.random() * 2.2), 0, -18 + (i / n) * 36 + Math.random() * 0.8);
      base.push(p);
      dummy.position.copy(p);
      dummy.rotation.y = sd > 0 ? Math.PI / 2 : -Math.PI / 2;
      dummy.updateMatrix();
      parts.forEach((m) => m.setMatrixAt(i, dummy.matrix));
    }
    dummy.rotation.set(0, 0, 0);
    parts.forEach((m) => world.add(m));
    sideGroups[sd] = { parts, base, rot: sd > 0 ? Math.PI / 2 : -Math.PI / 2 };
  }

  // Pylons at the corners of each end zone.
  const pylonMat = lambert('#ff7a1a');
  for (const z of [-50, -60, 50, 60]) for (const x of [-FIELD_W / 2, FIELD_W / 2]) {
    const py = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.1, 0.35), pylonMat);
    py.position.set(x, 0.55, z);
    world.add(py);
  }

  // Down markers (sideline sticks for line of scrimmage / first down).
  const stick = (col) => {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.6, 0.15), lambert('#222'));
    pole.position.y = 1.3;
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.7, 0.7), lambert(col));
    flag.position.y = 2.6;
    g.add(pole, flag);
    g.position.x = -FIELD_W / 2 - 1.4;
    scene.add(g);
    return g;
  };
  const losStick = stick('#ff7a1a');
  const fdStick = stick('#ffd43b');

  // Light towers.
  const poleMat = lambert('#9aa3ad');
  const lampMat = new THREE.MeshBasicMaterial({ color: '#fffbe6' });
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 34, 6), poleMat);
    pole.position.set(x * (FIELD_W / 2 + 30), 17, z * (FIELD_L / 2 + 22));
    world.add(pole);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 1), lampMat);
    lamp.position.set(pole.position.x, 35, pole.position.z);
    lamp.lookAt(0, 0, 0);
    world.add(lamp);
  }

  // Goalposts at the back of each end zone.
  const postMat = lambert('#ffd43b', { transparent: true });
  for (const z of [-60, 60]) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 3.3, 6), postMat);
    base.position.y = 1.65;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6.2, 6), postMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.y = 3.3;
    const up1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 10, 6), postMat);
    up1.position.set(-3.1, 8.3, 0);
    const up2 = up1.clone();
    up2.position.x = 3.1;
    g.add(base, bar, up1, up2);
    g.position.z = z;
    world.add(g);
  }

  // Line of scrimmage + first-down markers (repositioned per play).
  const los = new THREE.Mesh(new THREE.PlaneGeometry(FIELD_W, 0.25), new THREE.MeshBasicMaterial({ color: '#4dabf7', transparent: true, opacity: 0.85 }));
  los.rotation.x = -Math.PI / 2;
  los.position.y = 0.02;
  scene.add(los);
  const fd = new THREE.Mesh(new THREE.PlaneGeometry(FIELD_W, 0.25), new THREE.MeshBasicMaterial({ color: '#ffd43b', transparent: true, opacity: 0.9 }));
  fd.rotation.x = -Math.PI / 2;
  fd.position.y = 0.021;
  scene.add(fd);

  const api = {
    world,
    crowd,
    /** Re-paint the field and crowd. far = end zone the offense attacks (-z), near = behind the offense. */
    setTeams(farColors, nearColors, farName, nearName, crowdColors = nearColors) {
      fieldMat.map.dispose();
      fieldMat.map = fieldTexture(farColors, nearColors, farName, nearName);
      border.material.color.set(crowdColors[0]).multiplyScalar(0.55);
      fieldMat.needsUpdate = true;
      const palette = [crowdColors[0], crowdColors[1], crowdColors[0], farColors[0], '#d9d9d9', '#6c757d', crowdColors[0]].map((c) => new THREE.Color(c));
      for (let i = 0; i < crowd.count; i++) crowd.setColorAt(i, palette[Math.floor(Math.random() * palette.length)]);
      crowd.instanceColor.needsUpdate = true;
      const skinsA = ['#f7dcc0', '#e0ab7f', '#cc9260', '#b07646', '#8f5a34', '#6e4126'].map((cc) => new THREE.Color(cc));
      for (let i = 0; i < arms.count; i++) arms.setColorAt(i, Math.random() < 0.5 ? skinsA[i % skinsA.length] : palette[i % palette.length]);
      arms.instanceColor.needsUpdate = true;
      // sideline teams: near team on the right side (+x), far team on the left
      const paint = (sd, cols) => {
        const [body, legs, head] = sideGroups[sd].parts;
        for (let i = 0; i < body.count; i++) { body.setColorAt(i, new THREE.Color(cols[0])); legs.setColorAt(i, new THREE.Color(cols[1])); head.setColorAt(i, new THREE.Color(i % 3 ? cols[0] : '#c68a56')); }
        [body, legs, head].forEach((m) => { m.instanceColor.needsUpdate = true; });
      };
      paint(1, nearColors);
      paint(-1, farColors);
    },
    /** Place the world so the opponent goal line is `yardLine` yards ahead of z = 0. */
    setYardLine(yardLine, distance) {
      world.position.z = -yardLine + 50;
      los.position.z = 0;
      fd.position.z = -Math.min(distance, yardLine);
      fd.visible = distance < yardLine;
      los.visible = true;
      losStick.position.z = 0; losStick.visible = true;
      fdStick.position.z = fd.position.z; fdStick.visible = fd.visible;
      // Fade the goalposts when the play is close enough for them to block the view.
      postMat.opacity = yardLine < 35 ? 0.3 : 1;
    },
    hideLines() { los.visible = false; fd.visible = false; losStick.visible = false; fdStick.visible = false; },
    /** Update the big screen: { home, away, homePts, awayPts, homeColors, awayColors, clock } */
    setScoreboard(info) { drawJumbo(info); },
    /** Darken / cool the scene for night and bad weather. */
    setTint(weather) {
      const t = { night: 0x8a93b8, rain: 0x9aa4ae, storm: 0x7a8490, snow: 0xf2f6fa, wind: 0xf2efe6, fog: 0xc8ced4 }[weather] ?? 0xffffff;
      fieldMat.color.setHex(t);
      apron.material.color.setHex(weather === 'snow' ? 0xe6edf2 : weather === 'night' ? 0x1f5a24 : weather === 'storm' ? 0x24582a : weather === 'rain' ? 0x2a6a2f : 0x2a6430);
      crowd.material.color.setHex(weather === 'storm' || weather === 'rain' ? 0x8f99a3 : weather === 'night' ? 0x9aa0b8 : 0xffffff);
      heads.material.color.copy(crowd.material.color);
    },
    /** Make the crowd bounce (excitement 0..1). */
    /** How hyped the crowd is (more bouncing and camera flashes). */
    setExcitement(e) { flashRate = 0.003 + e * 0.02; },
    animateCrowd(t, excitement = 0.2) {
      const base = crowd.userData.base;
      // camera flashes
      for (let i = 0; i < flashN; i++) { const on = Math.random() < flashRate ? 1 : fcol[i * 3] * 0.6; fcol[i * 3] = fcol[i * 3 + 1] = fcol[i * 3 + 2] = on > 0.05 ? on : 0; }
      flashGeo.attributes.color.needsUpdate = true;
      // cheering arms and signs bounce with their fans
      cheerIdx.forEach((ci, k) => {
        const p = base[ci];
        const bob = Math.max(0, Math.sin(t * 9 + ci * 1.7)) * 0.35 * excitement;
        dummy.position.set(p.x, p.y + 0.3 + bob, p.z);
        dummy.rotation.set(0, 0, Math.sin(t * 6 + ci) * 0.25 * excitement);
        dummy.updateMatrix();
        arms.setMatrixAt(k, dummy.matrix);
      });
      dummy.rotation.set(0, 0, 0);
      arms.instanceMatrix.needsUpdate = true;
      for (const mm of signMeshes) {
        mm.userData.list.forEach((ci, k) => {
          const p = base[ci];
          dummy.position.set(p.x, p.y + 1.45 + Math.max(0, Math.sin(t * 7 + ci)) * 0.3 * excitement, p.z);
          dummy.lookAt(0, p.y + 1.4, p.z * 0.6);
          dummy.updateMatrix();
          mm.setMatrixAt(k, dummy.matrix);
        });
        dummy.rotation.set(0, 0, 0);
        mm.instanceMatrix.needsUpdate = true;
      }
      const step = base.length > 2500 ? 2 : 1;
      for (let i = 0; i < base.length; i += step) {
        const p = base[i];
        dummy.position.set(p.x, p.y + Math.max(0, Math.sin(t * 9 + i * 1.7)) * 0.35 * excitement, p.z);
        dummy.updateMatrix();
        crowd.setMatrixAt(i, dummy.matrix);
        heads.setMatrixAt(i, dummy.matrix);
      }
      crowd.instanceMatrix.needsUpdate = true;
      heads.instanceMatrix.needsUpdate = true;
      for (const sd of [-1, 1]) {
        const sg = sideGroups[sd];
        sg.base.forEach((p, i) => {
          dummy.position.set(p.x, Math.max(0, Math.sin(t * 7 + i * 2.3)) * 0.25 * excitement, p.z);
          dummy.rotation.y = sg.rot;
          dummy.updateMatrix();
          sg.parts.forEach((m) => m.setMatrixAt(i, dummy.matrix));
        });
        dummy.rotation.set(0, 0, 0);
        sg.parts.forEach((m) => { m.instanceMatrix.needsUpdate = true; });
      }
    },
  };
  api.setTeams(['#1d3557', '#f1c40f'], ['#b5121b', '#f5d547'], 'Gridiron', 'Legacy');
  return api;
}
