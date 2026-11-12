// Procedural low-poly stadium: striped field with painted lines, end zones,
// stepped stands with an instanced crowd, light towers and goalposts.
// Field coordinates (yards): x across (-26.65..26.65), z along. Goal lines at z = ±50.
import * as THREE from 'three';
import { buildEnvironment } from './environment.js';
import { buildGrounds } from './grounds.js';
import { buildSideline } from './sideline.js';
import { buildFieldWear } from './fieldwear.js';

const FIELD_W = 53.3;
const FIELD_L = 120;

const shadeHex = (hex, k) => { const c = new THREE.Color(hex); if (k > 0) c.lerp(new THREE.Color('#ffffff'), k); else c.multiplyScalar(1 + k); return `#${c.getHexString()}`; };

function fieldTexture(homeColors, awayColors, homeName = 'HOME', awayName = 'AWAY', style = null) {
  const ppy = 16; // pixels per yard: sharp, realistic turf
  const cw = Math.round(FIELD_W * ppy);
  const ch = FIELD_L * ppy;
  const c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  const g = c.getContext('2d');
  
  // Mowed grass: alternating 5-yard bands with soft edges, a cross-mow sheen, blotches and fine blade noise.
  const tA = style?.turf?.[0] ?? '#2c6b33'; const tB = style?.turf?.[1] ?? '#367a3b';
  for (let y = 0; y < FIELD_L; y += 5) {
    const gr = g.createLinearGradient(0, y * ppy, 0, (y + 5) * ppy);
    const c0 = Math.floor(y / 5) % 2 ? tA : tB;
    gr.addColorStop(0, c0); gr.addColorStop(0.5, Math.floor(y / 5) % 2 ? shadeHex(c0, 0.03) : shadeHex(c0, -0.02)); gr.addColorStop(1, c0);
    g.fillStyle = gr; g.fillRect(0, y * ppy, cw, 5 * ppy);
  }
  g.globalAlpha = 0.05; // cross-mow (faint lengthwise bands)
  for (let x = 0; x < cw; x += 6 * ppy) { g.fillStyle = (x / (6 * ppy)) % 2 ? '#ffffff' : '#000000'; g.fillRect(x, 0, 3 * ppy, ch); }
  g.globalAlpha = 1;
  for (let i = 0; i < 260; i++) { // uneven patches
    const x = Math.random() * cw; const y = Math.random() * ch; const r = (1 + Math.random() * 3) * ppy;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, Math.random() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,200,0.05)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < cw * ch * 0.06; i++) { // blades
    const x = Math.random() * cw; const y = Math.random() * ch;
    g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(210,255,190,0.06)';
    g.fillRect(x, y, 1, 2);
  }
  // End zones.
  const ez = (y0, col, txt) => {
    g.fillStyle = col[0];
    g.fillRect(0, y0 * ppy, cw, 10 * ppy);
    g.save();
    g.fillStyle = col[1];
    g.font = `900 ${5 * ppy}px "Arial Black", Impact, "Inter", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.translate(cw / 2, (y0 + 5) * ppy);
    if (y0 > 50) g.rotate(Math.PI);
    g.fillText(txt.toUpperCase(), 0, 0);
    g.restore();
  };
  ez(0, homeColors, homeName);
  ez(110, awayColors, awayName);
  // end zone pattern: each home team paints theirs differently
  const pat = style?.pattern ?? 'diagonal';
  g.save();
  g.globalAlpha = 0.16;
  g.fillStyle = '#ffffff';
  for (const y0 of [0, 110]) {
    g.save();
    g.beginPath(); g.rect(0, y0 * ppy, cw, 10 * ppy); g.clip();
    if (pat === 'diagonal' || pat === 'stripes') {
      for (let x = -ch; x < cw + ch; x += 18) {
        g.beginPath();
        if (pat === 'diagonal') { g.moveTo(x, y0 * ppy); g.lineTo(x + 8, y0 * ppy); g.lineTo(x + 8 - 10 * ppy, (y0 + 10) * ppy); g.lineTo(x - 10 * ppy, (y0 + 10) * ppy); }
        else g.rect(x, y0 * ppy, 8, 10 * ppy);
        g.fill();
      }
    } else if (pat === 'checker') {
      for (let yy = 0; yy < 10; yy += 2.5) for (let x = 0; x < cw; x += 2.5 * ppy) if ((Math.round(x / (2.5 * ppy)) + Math.round(yy / 2.5)) % 2) g.fillRect(x, (y0 + yy) * ppy, 2.5 * ppy, 2.5 * ppy);
    } else if (pat === 'diamond') {
      for (let x = ppy * 3; x < cw; x += ppy * 6) { g.beginPath(); g.moveTo(x, (y0 + 1) * ppy); g.lineTo(x + 2.5 * ppy, (y0 + 5) * ppy); g.lineTo(x, (y0 + 9) * ppy); g.lineTo(x - 2.5 * ppy, (y0 + 5) * ppy); g.fill(); }
    }
    g.restore();
  }
  g.restore();
  // Lines.
  g.fillStyle = 'rgba(250,250,245,0.92)';
  g.fillRect(0, 0, cw, 4); g.fillRect(0, ch - 4, cw, 4); g.fillRect(0, 0, 4, ch); g.fillRect(cw - 4, 0, 4, ch);
  for (let y = 10; y <= 110; y += 5) g.fillRect(0, Math.round(y * ppy) - 1.5, cw, y === 10 || y === 110 ? 5 : 3);
  // Hash marks.
  for (let y = 11; y < 110; y++) {
    for (const hx of [1, 18.4, FIELD_W - 18.4 - 1, FIELD_W - 2]) g.fillRect(Math.round(hx * ppy), Math.round(y * ppy) - 1, 0.9 * ppy, 2);
  }
  // Numbers.
  g.font = `bold ${Math.round(2.6 * ppy)}px "Arial Black", Impact, "Inter", sans-serif`;
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
  g.font = `bold ${Math.round(3.2 * ppy)}px "Arial Black", Impact, "Inter", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(homeName).slice(0, 3).toUpperCase(), cw / 2, 60 * ppy + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Merge simple box geometries into one (for instanced multi-part figures). */
function mergeBoxes(list) {
  const pos = []; const nor = []; const idx = []; let off = 0;
  for (const gm of list) {
    pos.push(...gm.attributes.position.array); nor.push(...gm.attributes.normal.array);
    idx.push(...gm.index.array.map((i) => i + off)); off += gm.attributes.position.count;
  }
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  gg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  gg.setIndex(idx);
  return gg;
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
  const fieldWear = buildFieldWear(world, FIELD_W, FIELD_L);

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
  const standMeshes = [];
  const crowdMeta = [];
  const addStand = (cx, cz, len, alongX, facing) => {
    for (let tier = 0; tier < 11; tier++) { // tiers 7-10 are the pro upper deck
      const depth = 3;
      const geo = new THREE.BoxGeometry(alongX ? len : depth, 1.6 + tier * 1.6, alongX ? depth : len);
      const m = new THREE.Mesh(geo, tier % 2 ? standMat : standMat2);
      const off = 6 + tier * depth;
      m.position.set(alongX ? cx : cx + facing * off, (1.6 + tier * 1.6) / 2, alongX ? cz + facing * off : cz);
      world.add(m);
      standMeshes.push({ m, tier, end: alongX });
      const n = Math.floor(len / 1.3);
      for (let i = 0; i < n; i++) {
        const along = -len / 2 + (i + 0.5) * (len / n) + (Math.random() - 0.5) * 0.4;
        crowdMeta.push({ tier, end: alongX, band: alongX && facing < 0 && tier < 3 && Math.abs(along) < 12,
          yaw: alongX ? (facing > 0 ? Math.PI : 0) : (facing > 0 ? -Math.PI / 2 : Math.PI / 2), sx: 0.84 + Math.random() * 0.32, sy: 0.88 + Math.random() * 0.26 });
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
  // faces on the front of each head (instance color = skin tone, so white pixels take the skin color)
  const faceTex = (() => {
    const c2 = document.createElement('canvas'); c2.width = 6; c2.height = 6;
    const g2 = c2.getContext('2d');
    g2.fillStyle = '#ffffff'; g2.fillRect(0, 0, 6, 6);
    g2.fillStyle = '#1a1410'; g2.fillRect(1, 2, 1, 1); g2.fillRect(4, 2, 1, 1);
    g2.fillStyle = '#7a3b2e'; g2.fillRect(2, 4, 2, 1);
    g2.fillStyle = '#d9d9d9'; g2.fillRect(0, 5, 6, 1);
    const t = new THREE.CanvasTexture(c2); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const plainHead = new THREE.MeshBasicMaterial();
  const heads = new THREE.InstancedMesh(headGeo, [plainHead, plainHead, plainHead, plainHead, new THREE.MeshBasicMaterial({ map: faceTex }), plainHead], crowdPositions.length);
  // hair, caps and beanies on top
  const topGeo = new THREE.BoxGeometry(0.46, 0.16, 0.46); topGeo.translate(0, 0.9, 0);
  const tops = new THREE.InstancedMesh(topGeo, new THREE.MeshBasicMaterial(), crowdPositions.length);
  const hairCols = ['#1a1410', '#2b1d14', '#5a3a22', '#8a5a2b', '#c9a15a', '#e0c070', '#8a3b1f', '#9a9a9a', '#d8d8d8'].map((c) => new THREE.Color(c));
  const dummy = new THREE.Object3D();
  let crowdBuilt = false;
  let lastCrowdT = -1;
  const skins = ['#f7dcc0', '#e0ab7f', '#cc9260', '#b07646', '#8f5a34', '#6e4126', '#4d2c1a'].map((c) => new THREE.Color(c));
  crowdPositions.forEach((p, i) => {
    dummy.position.copy(p);
    dummy.updateMatrix();
    crowd.setMatrixAt(i, dummy.matrix);
    heads.setMatrixAt(i, dummy.matrix);
    const sk = skins[Math.floor(Math.random() * skins.length)];
    heads.setColorAt(i, sk);
    tops.setColorAt(i, Math.random() < 0.1 ? sk : hairCols[Math.floor(Math.random() * hairCols.length)]);
  });
  crowd.userData.base = crowdPositions;
  world.add(crowd, heads, tops);

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
  const roofParts = [];
  for (const sd of [-1, 1]) {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(14, 1.2, FIELD_L + 10), lambert('#1c2029'));
    roofParts.push(roof);
    roof.position.set(sd * (FIELD_W / 2 + 26), 20.5, 0);
    world.add(roof);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(1, 0.3, FIELD_L + 6), new THREE.MeshBasicMaterial({ color: '#fff6d8' }));
    strip.position.set(sd * (FIELD_W / 2 + 20), 19.8, 0);
    world.add(strip);
    roofParts.push(strip);
    for (let z = -FIELD_L / 2; z <= FIELD_L / 2; z += 15) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 20, 0.6), lambert('#2a2f3a'));
      post.position.set(sd * (FIELD_W / 2 + 37), 10, z);
      world.add(post);
      roofParts.push(post);
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
    // more detail: shoulder pads, sleeves, a facemask and a back number stripe; every player a different size
    const padsG = new THREE.BoxGeometry(0.88, 0.24, 0.5); padsG.translate(0, 1.52, 0);
    const armsG = (() => { const a = new THREE.BoxGeometry(0.2, 0.72, 0.22); a.translate(-0.42, 1.2, 0); const b = new THREE.BoxGeometry(0.2, 0.72, 0.22); b.translate(0.42, 1.2, 0); return mergeBoxes([a, b]); })();
    const maskG = new THREE.BoxGeometry(0.38, 0.16, 0.06); maskG.translate(0, 1.76, -0.25);
    const numG = new THREE.BoxGeometry(0.3, 0.36, 0.04); numG.translate(0, 1.16, 0.22);
    const sockG = new THREE.BoxGeometry(0.52, 0.18, 0.34); sockG.translate(0, 0.09, 0);
    const parts = [bodyG, legG, headG, padsG, armsG, maskG, numG, sockG].map((geo) => new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: '#ffffff' }), n));
    const base = [];
    const scl = [];
    const bare = [];
    for (let i = 0; i < n; i++) {
      const p = new THREE.Vector3(sd * (FIELD_W / 2 + 3 + Math.random() * 2.2), 0, -18 + (i / n) * 36 + Math.random() * 0.8);
      base.push(p);
      scl.push([0.88 + Math.random() * 0.3, 0.9 + Math.random() * 0.2]);
      bare.push(i % 5 === 0); // helmet off
    }
    parts.forEach((m) => world.add(m));
    sideGroups[sd] = { parts, base, scl, bare, rot: sd > 0 ? Math.PI / 2 : -Math.PI / 2 };
  }

  const sideline = buildSideline(world);
  let sidePaint = null;

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

  // Bunting: little triangle pennants strung along the front of the stands.
  const flagGeo = new THREE.BufferGeometry();
  {
    const pos = [];
    for (const sd of [-1, 1]) for (let z = -FIELD_L / 2; z < FIELD_L / 2; z += 1.6) {
      const x = sd * (FIELD_W / 2 + 9.2);
      pos.push(x, 3.4, z, x, 3.4, z + 1.2, x, 2.5, z + 0.6);
    }
    flagGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    flagGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Array(pos.length).fill(1), 3));
  }
  const bunting = new THREE.Mesh(flagGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  world.add(bunting);
  // Tifo: a giant fan banner over the stands behind the far end zone.
  const tifoCanvas = document.createElement('canvas');
  tifoCanvas.width = 128; tifoCanvas.height = 40;
  const tifoTex = new THREE.CanvasTexture(tifoCanvas);
  tifoTex.magFilter = THREE.NearestFilter;
  tifoTex.colorSpace = THREE.SRGBColorSpace;
  const tifo = new THREE.Mesh(new THREE.PlaneGeometry(52, 16), new THREE.MeshBasicMaterial({ map: tifoTex }));
  tifo.position.set(0, 9.5, -FIELD_L / 2 - 14);
  tifo.rotation.x = -0.62;
  world.add(tifo);
  const paintTifo = (cols, text) => {
    const g = tifoCanvas.getContext('2d');
    g.fillStyle = cols[0]; g.fillRect(0, 0, 128, 40);
    g.fillStyle = cols[1];
    for (let x = -40; x < 128; x += 16) { g.beginPath(); g.moveTo(x, 40); g.lineTo(x + 8, 40); g.lineTo(x + 28, 0); g.lineTo(x + 20, 0); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(8, 9, 112, 22);
    g.fillStyle = '#ffffff'; g.font = 'bold 14px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(text).toUpperCase().slice(0, 12), 64, 21);
    tifoTex.needsUpdate = true;
  };

  // High school extras: chain-link fence and a little press box.
  const hsParts = [];
  const fenceMat = new THREE.MeshBasicMaterial({ color: '#b8c0c8', transparent: true, opacity: 0.55 });
  for (const sd of [-1, 1]) {
    const fence = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.6, FIELD_L + 8), fenceMat);
    fence.position.set(sd * (FIELD_W / 2 + 8.5), 0.8, 0);
    world.add(fence); hsParts.push(fence);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, FIELD_L + 8), lambert('#8a939e'));
    rail.position.set(sd * (FIELD_W / 2 + 8.5), 1.6, 0);
    world.add(rail); hsParts.push(rail);
  }
  const press = new THREE.Group();
  const pb = new THREE.Mesh(new THREE.BoxGeometry(16, 3.2, 3.5), lambert('#3a3f4a'));
  const win = new THREE.Mesh(new THREE.BoxGeometry(14, 1.2, 0.1), new THREE.MeshBasicMaterial({ color: '#9fd3ff' }));
  win.position.set(0, 0.2, -1.8);
  press.add(pb, win);
  press.rotation.y = Math.PI / 2;
  press.position.set(FIELD_W / 2 + 18, 7.5, 0);
  world.add(press); hsParts.push(press);

  const env = buildEnvironment(world);
  env.set('plains', 1);
  const grounds = buildGrounds(world);

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
    sideline,
    fieldWear,
    crowd,
    /** Re-paint the field and crowd. far = end zone the offense attacks (-z), near = behind the offense. */
    setTeams(farColors, nearColors, farName, nearName, crowdColors = nearColors, style = null) {
      grounds.setColors(crowdColors);
      fieldMat.map.dispose();
      fieldMat.map = fieldTexture(farColors, nearColors, farName, nearName, style);
      border.material.color.set(crowdColors[0]).multiplyScalar(0.55);
      fieldMat.needsUpdate = true;
      // fan culture: whiteouts, blackouts and color rushes
      const look = style?.crowd ?? 'normal';
      const base = look === 'whiteout' ? ['#f4f4f4', '#f4f4f4', '#f4f4f4', crowdColors[0]] : look === 'blackout' ? ['#16181c', '#16181c', '#26292f', crowdColors[0]]
        : look === 'colorrush' ? [crowdColors[0], crowdColors[0], crowdColors[0], crowdColors[1]] : [crowdColors[0], crowdColors[1], crowdColors[0], farColors[0], '#d9d9d9', '#6c757d', crowdColors[0]];
      const palette = base.map((c) => new THREE.Color(c));
      for (let i = 0; i < crowd.count; i++) crowd.setColorAt(i, crowdMeta[i]?.band && this.level === 'college' ? new THREE.Color(i % 2 ? '#f4f4f4' : crowdColors[0]) : palette[Math.floor(Math.random() * palette.length)]);
      crowd.instanceColor.needsUpdate = true;
      const skinsA = ['#f7dcc0', '#e0ab7f', '#cc9260', '#b07646', '#8f5a34', '#6e4126'].map((cc) => new THREE.Color(cc));
      for (let i = 0; i < arms.count; i++) arms.setColorAt(i, Math.random() < 0.5 ? skinsA[i % skinsA.length] : palette[i % palette.length]);
      arms.instanceColor.needsUpdate = true;
      // sideline teams: near team on the right side (+x), far team on the left
      const paint = (sd, cols) => {
        const sg = sideGroups[sd];
        const [body, legs, head, pads, armsP, mask, num, sock] = sg.parts;
        const c0 = new THREE.Color(cols[0]); const c1 = new THREE.Color(cols[1]);
        const skinsB = ['#f1d0b0', '#d9a477', '#c68a56', '#a06a3e', '#7c4a2a', '#5a341d'].map((x) => new THREE.Color(x));
        const lum = (cc) => { const c = new THREE.Color(cc); return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b; };
        const pantsC = new THREE.Color(lum(cols[1]) > 0.6 ? '#e3e6ea' : cols[1]);
        for (let i = 0; i < body.count; i++) {
          body.setColorAt(i, c0); pads.setColorAt(i, c0.clone().multiplyScalar(0.85)); armsP.setColorAt(i, c0);
          legs.setColorAt(i, pantsC); sock.setColorAt(i, c0);
          head.setColorAt(i, sg.bare[i] ? skinsB[i % skinsB.length] : c0); mask.setColorAt(i, new THREE.Color('#9aa3ad'));
          num.setColorAt(i, c1);
        }
        sg.parts.forEach((m) => { m.instanceColor.needsUpdate = true; });
      };
      paint(1, nearColors);
      paint(-1, farColors);
      // bunting + tifo in the home crowd's colors
      const bc = [new THREE.Color(crowdColors[0]), new THREE.Color(crowdColors[1]), new THREE.Color('#ffffff')];
      const col = flagGeo.attributes.color;
      for (let i = 0; i < col.count; i += 3) { const c = bc[(i / 3) % 3]; for (let k = 0; k < 3; k++) col.setXYZ(i + k, c.r, c.g, c.b); }
      col.needsUpdate = true;
      paintTifo(crowdColors, crowdColors === nearColors ? nearName : farName);
      sidePaint = [crowdColors, crowdColors === nearColors ? farColors : nearColors, nearColors, farColors, style?.mascot ?? 'shield'];
      sideline.paint(...sidePaint, this.level ?? 'pro');
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
      for (const hm of [...new Set(heads.material), tops.material]) hm.color.copy(crowd.material.color);
    },
    /** Make the crowd bounce (excitement 0..1). */
    /** Scenery outside the stadium for the home team's city. */
    setEnvironment(biome, seed, opts) { const k = `${biome}:${seed}:${opts?.night}:${(opts?.landmarks ?? []).join(",")}`; if (this._env !== k) { this._env = k; env.set(biome, seed, opts); } },
    /** Big games (playoffs, rivalries) bring out the tifo even in high school. */
    setBigGame(on) { this.bigGame = !!on; tifo.visible = this.level !== 'hs' || this.bigGame; },
    /** Match the venue to the level: 'hs' bleachers, 'college' bowl + band, 'pro' upper deck + roof. */
    setLevel(level = 'pro') {
      grounds.setLevel(level);
      const maxTier = level === 'hs' ? 3 : level === 'college' ? 7 : 11;
      const ends = level !== 'hs';
      for (const s2 of standMeshes) s2.m.visible = s2.tier < maxTier && (ends || !s2.end);
      crowdMeta.forEach((c) => { c.hidden = !(c.tier < maxTier && (ends || !c.end)) || (level === 'hs' && Math.random() < 0.35); });
      for (const r of roofParts) r.visible = level === 'pro';
      for (const p2 of hsParts) p2.visible = level === 'hs';
      tifo.visible = level !== 'hs' || this.bigGame;
      tifo.position.y = level === 'pro' ? 13 : 9.5;
      jumbo.scale.setScalar(level === 'hs' ? 0.42 : level === 'college' ? 0.72 : 1);
      jumbo.position.y = level === 'hs' ? 9 : level === 'college' ? 22 : 33;
      const metal = level === 'hs';
      standMat.color.set(metal ? '#c8d0d8' : '#ffffff');
      standMat2.color.set(metal ? '#aeb6bf' : '#ffffff');
      this.level = level;
      if (sidePaint) sideline.paint(...sidePaint, level);
      // camera flashes only where people are sitting
      const vis = crowdPositions.filter((_, i) => !crowdMeta[i].hidden);
      for (let i = 0; i < flashN; i++) { const p2 = vis[Math.floor(Math.random() * vis.length)] ?? crowdPositions[0]; fpos.set([p2.x, p2.y + 0.9, p2.z], i * 3); }
      flashGeo.attributes.position.needsUpdate = true;
      this.animateCrowd(0, 0, true);
    },
    /** How hyped the crowd is (more bouncing and camera flashes). */
    setExcitement(e) { flashRate = 0.003 + e * 0.02; },
    animateCrowd(t, excitement = 0.2, force = false) {
      // the crowd only needs ~30 updates a second (each one re-uploads thousands of fans to the GPU)
      if (!force && crowdBuilt && t >= lastCrowdT && t - lastCrowdT < 1 / 30) return;
      lastCrowdT = t;
      grounds.animate(t);
      const base = crowd.userData.base;
      // camera flashes
      for (let i = 0; i < flashN; i++) { const on = Math.random() < flashRate ? 1 : fcol[i * 3] * 0.6; fcol[i * 3] = fcol[i * 3 + 1] = fcol[i * 3 + 2] = on > 0.05 ? on : 0; }
      flashGeo.attributes.color.needsUpdate = true;
      // cheering arms and signs bounce with their fans
      cheerIdx.forEach((ci, k) => {
        const p = base[ci];
        const bob = Math.max(0, Math.sin(t * 9 + ci * 1.7)) * 0.35 * excitement;
        dummy.position.set(p.x, crowdMeta[ci]?.hidden ? -200 : p.y + 0.3 + bob, p.z);
        dummy.rotation.set(0, 0, Math.sin(t * 6 + ci) * 0.25 * excitement);
        dummy.updateMatrix();
        arms.setMatrixAt(k, dummy.matrix);
      });
      dummy.rotation.set(0, 0, 0);
      arms.instanceMatrix.needsUpdate = true;
      for (const mm of signMeshes) {
        mm.userData.list.forEach((ci, k) => {
          const p = base[ci];
          dummy.position.set(p.x, crowdMeta[ci]?.hidden ? -200 : p.y + 1.45 + Math.max(0, Math.sin(t * 7 + ci)) * 0.3 * excitement, p.z);
          dummy.lookAt(0, p.y + 1.4, p.z * 0.6);
          dummy.updateMatrix();
          mm.setMatrixAt(k, dummy.matrix);
        });
        dummy.rotation.set(0, 0, 0);
        mm.instanceMatrix.needsUpdate = true;
      }
      if (force || !crowdBuilt) {
        // full matrices (facing + size) once; afterwards only the bounce height changes
        crowdBuilt = true;
        for (let i = 0; i < base.length; i++) {
          const p = base[i];
          const cm = crowdMeta[i];
          dummy.position.set(p.x, cm?.hidden ? -200 : p.y, p.z);
          dummy.rotation.set(0, cm?.yaw ?? 0, 0);
          dummy.scale.set(cm?.sx ?? 1, cm?.sy ?? 1, cm?.sx ?? 1);
          dummy.updateMatrix();
          crowd.setMatrixAt(i, dummy.matrix);
          heads.setMatrixAt(i, dummy.matrix);
          tops.setMatrixAt(i, dummy.matrix);
        }
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
      } else {
        const A = crowd.instanceMatrix.array; const B = heads.instanceMatrix.array; const C = tops.instanceMatrix.array;
        for (let i = 0; i < base.length; i++) {
          const cm = crowdMeta[i];
          const y = cm?.hidden ? -200 : base[i].y + Math.max(0, Math.sin(t * 9 + i * 1.7)) * 0.35 * excitement;
          const o = i * 16 + 13;
          A[o] = y; B[o] = y; C[o] = y;
        }
      }
      crowd.instanceMatrix.needsUpdate = true;
      heads.instanceMatrix.needsUpdate = true;
      tops.instanceMatrix.needsUpdate = true;
      sideline.animate(t, excitement);
      fieldWear.tick();
      for (const sd of [-1, 1]) {
        const sg = sideGroups[sd];
        sg.base.forEach((p, i) => {
          dummy.position.set(p.x, Math.max(0, Math.sin(t * 7 + i * 2.3)) * 0.25 * excitement, p.z);
          dummy.rotation.y = sg.rot + Math.sin(t * 0.7 + i) * 0.25; // looking around
          dummy.scale.set(sg.scl[i][0], sg.scl[i][1], sg.scl[i][0]);
          dummy.updateMatrix();
          sg.parts.forEach((m, k) => {
            if (k === 5 && sg.bare[i]) { dummy.scale.setScalar(0); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); dummy.scale.set(sg.scl[i][0], sg.scl[i][1], sg.scl[i][0]); dummy.updateMatrix(); return; }
            m.setMatrixAt(i, dummy.matrix);
          });
        });
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        sg.parts.forEach((m) => { m.instanceMatrix.needsUpdate = true; });
      }
    },
  };
  api.setTeams(['#1d3557', '#f1c40f'], ['#b5121b', '#f5d547'], 'Gridiron', 'Legacy');
  return api;
}
