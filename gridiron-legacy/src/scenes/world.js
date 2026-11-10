// Walkable world engine: builds a place (layout depends on your level of play) from a text map, then lets the
// player walk around (touch joystick or WASD/arrows) and interact with people and objects.
// Graphics: smooth painted floors (wood, marble, tile, rugs, rubber, turf, court, grass, pavers...), thin walls
// with baseboards and windows, rounded furniture turned to face the room, room labels, soft shadows.
import * as THREE from 'three';
import { placeFor, LEGEND, FLOOR_CHARS } from '../data/places.js';
import { makePerson, animateRun, faceToward, setPose, playAction, makeLabel } from './actors.js';
import { makeProp, M } from './props.js';

const S = 2; // tile size in world units
const PX = 48; // floor texture pixels per tile

function hexShade(hex, amt) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amt);
  return `#${c.getHexString()}`;
}

/** Resolve a legend entry, honoring `needs` (falls back to `alt`, or nothing). */
function resolveEntry(entry, check) {
  if (!entry) return null;
  if (entry.needs && !check(entry.needs)) return entry.alt ?? { floor: entry.floor };
  return entry;
}

// Floor palettes per kind (base, alt)
const FLOOR = {
  wood: ['#a9784f', '#93633f'], vinyl: ['#c9bba6', '#bcae98'], marble: ['#eeebe6', '#d9d5cf'], tile: ['#e4e1dc', '#d2cec8'],
  concrete: ['#9ea4a9', '#8f959a'], polished: ['#b9bec3', '#a9aeb3'], rubber: ['#2a2d31', '#33373c'], turf: ['#3a8a3d', '#43974a'],
  court: ['#d29a5f', '#c68d52'], grass: ['#5aa04c', '#4f9343'], path: ['#cdb68c', '#bfa87e'], pavers: ['#a9a49c', '#9a958d'],
  road: ['#3a3e43', '#33373b'], water: ['#3e8fd0', '#2f7cbf'], boardwalk: ['#8a6a4c', '#7a5c40'], door: ['#5a4634', '#4c3b2c'], rug: null,
};

const nz = (x, y) => { const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return v - Math.floor(v); };

/** Paint one tile of floor at (X0, Y0) in the floor canvas. */
function paintTile(g, kind, X0, Y0, r, c, ctx) {
  const P = PX;
  const [a, b] = FLOOR[kind] ?? FLOOR.concrete;
  const rect = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(X0 + x, Y0 + y, w, h); };
  switch (kind) {
    case 'wood': case 'vinyl': case 'boardwalk': {
      const n = kind === 'boardwalk' ? 3 : 4; const bh = P / n;
      for (let i = 0; i < n; i++) {
        const row = r * n + i;
        const off = (nz(row, 3) * P * 3) | 0;
        for (let x = -off; x < P; x += P * 1.5) {
          const shadeK = (nz(row, Math.floor((c * P + x) / (P * 1.5))) - 0.5) * 0.08;
          rect(Math.max(0, x), i * bh, P * 1.5, bh, hexShade(a, shadeK));
          rect(Math.max(0, x), i * bh, 1, bh, 'rgba(0,0,0,0.25)');
        }
        rect(0, i * bh + bh - 1, P, 1, 'rgba(0,0,0,0.22)');
        g.globalAlpha = 0.08; for (let k = 0; k < 3; k++) rect(0, i * bh + 2 + k * (bh / 3), P, 1, '#3a2414'); g.globalAlpha = 1;
      }
      break;
    }
    case 'marble': {
      rect(0, 0, P, P, a);
      g.strokeStyle = 'rgba(120,115,110,0.25)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(X0, Y0 + nz(r, c) * P); g.bezierCurveTo(X0 + P * 0.3, Y0 + nz(c, r) * P, X0 + P * 0.7, Y0 + nz(r + 1, c) * P, X0 + P, Y0 + nz(r, c + 1) * P); g.stroke();
      rect(0, 0, P, 1, 'rgba(0,0,0,0.08)'); rect(0, 0, 1, P, 'rgba(0,0,0,0.08)');
      break;
    }
    case 'tile': for (const [x, y] of [[0, 0], [P / 2, 0], [0, P / 2], [P / 2, P / 2]]) { rect(x, y, P / 2, P / 2, hexShade(a, (nz(X0 + x, Y0 + y) - 0.5) * 0.03)); rect(x, y, P / 2, 1.5, 'rgba(0,0,0,0.12)'); rect(x, y, 1.5, P / 2, 'rgba(0,0,0,0.12)'); } break;
    case 'concrete': case 'polished': {
      rect(0, 0, P, P, a);
      for (let i = 0; i < 40; i++) rect(nz(i, r * 31 + c) * P, nz(c * 17 + i, r) * P, 2, 2, nz(i, c) < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)');
      if (kind === 'polished') { const gr = g.createLinearGradient(X0, Y0, X0 + P, Y0 + P); gr.addColorStop(0, 'rgba(255,255,255,0.07)'); gr.addColorStop(1, 'rgba(0,0,0,0.04)'); g.fillStyle = gr; g.fillRect(X0, Y0, P, P); }
      if (c % 3 === 0) rect(0, 0, 1, P, 'rgba(0,0,0,0.1)'); if (r % 3 === 0) rect(0, 0, P, 1, 'rgba(0,0,0,0.1)');
      break;
    }
    case 'rubber': rect(0, 0, P, P, a); g.globalAlpha = 0.35; for (let i = 0; i < 26; i++) rect(nz(i, r * 13 + c) * P, nz(c * 7 + i, r) * P, 1.2, 1.2, ['#8a3b33', '#3a6a8f', '#6b7378'][i % 3]); g.globalAlpha = 1; rect(0, 0, P, 1, 'rgba(0,0,0,0.35)'); rect(0, 0, 1, P, 'rgba(0,0,0,0.35)'); break;
    case 'turf': rect(0, 0, P, P, (c % 2) ? a : b); if (c % 5 === 0) rect(0, 0, 3, P, 'rgba(255,255,255,0.85)'); for (let i = 0; i < 60; i++) rect(nz(i, r + c * 3) * P, nz(i * 3, c + r) * P, 1, 2, 'rgba(0,0,0,0.12)'); break;
    case 'court': for (let i = 0; i < 6; i++) rect(0, i * (P / 6), P, P / 6 - 1, hexShade(a, (nz(r * 6 + i, c) - 0.5) * 0.05)); break;
    case 'grass': case 'path': case 'pavers': case 'road': case 'water': case 'door': {
      rect(0, 0, P, P, a);
      if (kind === 'grass') for (let i = 0; i < 90; i++) rect(nz(i, r * 9 + c) * P, nz(c * 5 + i, r) * P, 1, 3, nz(i, r) < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(230,255,200,0.08)');
      if (kind === 'path') for (let i = 0; i < 60; i++) rect(nz(i, r * 9 + c) * P, nz(c * 5 + i, r) * P, 2, 2, 'rgba(0,0,0,0.08)');
      if (kind === 'pavers') for (let y = 0; y < P; y += P / 4) for (let x = ((y / (P / 4)) % 2) * (P / 4); x < P; x += P / 2) { rect(x, y, P / 2, P / 4, hexShade(a, (nz(X0 + x, Y0 + y) - 0.5) * 0.06)); rect(x, y, P / 2, 1, 'rgba(0,0,0,0.15)'); rect(x, y, 1, P / 4, 'rgba(0,0,0,0.15)'); }
      if (kind === 'road') { for (let i = 0; i < 80; i++) rect(nz(i, r * 9 + c) * P, nz(c * 5 + i, r) * P, 1.5, 1.5, 'rgba(255,255,255,0.05)'); if (ctx.roadCenter === r && c % 2 === 0) rect(4, P - 2, P - 8, 4, '#f2c94c'); }
      if (kind === 'water') { const gr = g.createLinearGradient(X0, Y0, X0, Y0 + P); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(X0, Y0, P, P); }
      if (kind === 'door') { rect(P * 0.1, P * 0.25, P * 0.8, P * 0.5, '#3b2f25'); rect(P * 0.14, P * 0.29, P * 0.72, P * 0.42, '#4d3d2f'); }
      break;
    }
    default: rect(0, 0, P, P, a);
  }
}

/** Floating name board (always faces the camera). */
function nameSign(text, color) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 112;
  const g = c.getContext('2d');
  g.fillStyle = color; g.beginPath(); g.roundRect?.(4, 4, 504, 104, 22); if (!g.roundRect) g.rect(4, 4, 504, 104); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 5; g.stroke();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = 56; g.font = `800 ${size}px Inter, sans-serif`;
  while (g.measureText(text.toUpperCase()).width > 460 && size > 20) { size -= 2; g.font = `800 ${size}px Inter, sans-serif`; }
  g.fillText(text.toUpperCase(), 256, 58);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, toneMapped: false }));
  sp.scale.set(3.2, 0.7, 1);
  return sp;
}

/** Big world-space room label lying on the floor. */
function floorLabel(text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.font = '800 54px Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillText(text.toUpperCase(), 256, 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.83), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  return m;
}

// ------------------------------------------------------------------ world

/**
 * Build a place. ctx: { scene, camera, state, stage, lookFor(key), nameFor(key), check(needs) }
 * Returns { update(dt), place, setInput(vec), focus(), emote(kind), dispose() }.
 */
export function buildWorld(placeId, ctx) {
  const place = placeFor(placeId, ctx.stage ?? ctx.state?.career?.stage ?? 'pro');
  const rows = place.map;
  const W = Math.max(...rows.map((r) => r.length));
  const H = rows.length;
  const root = new THREE.Group();
  ctx.scene.add(root);
  const toX = (c) => (c - W / 2) * S + S / 2;
  const toZ = (r) => (r - H / 2) * S + S / 2;
  const solid = [];
  const interactables = [];
  const npcs = [];
  const charAt = (r, c) => (rows[r]?.[c] ?? '#');
  const entryAt = (r, c) => { const ch = charAt(r, c); return resolveEntry(place.legend[ch] ?? LEGEND[ch], ctx.check); };
  const isWall = (r, c) => charAt(r, c) === '#';
  const outdoor = place.outdoor;

  // ---- floor kinds per tile
  const baseKind = place.floor ?? (outdoor ? 'grass' : 'wood');
  const altKind = place.alt ?? (outdoor ? 'path' : 'tile');
  const kindOf = (r, c) => {
    const ch = charAt(r, c);
    if (ch === '#') return outdoor ? 'pavers' : baseKind;
    const fc = FLOOR_CHARS[ch];
    if (fc === 'alt') return altKind;
    if (fc) return fc;
    const e = entryAt(r, c);
    if (e?.floor) return e.floor === 'floor' ? baseKind : e.floor;
    // props inherit the floor of a non-prop neighbour (so a couch on a rug sits on the rug)
    for (const [dr, dc] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { const n = charAt(r + dr, c + dc); const k = FLOOR_CHARS[n]; if (k && k !== 'door' && k !== 'water') return k === 'alt' ? altKind : k; }
    return baseKind;
  };
  // the road's middle row gets the dashed center line
  const roadRows = rows.map((row, r) => (row.includes('=') ? r : -1)).filter((r) => r >= 0);
  const roadCenter = roadRows.length ? roadRows[Math.floor(roadRows.length / 2) - (roadRows.length % 2 ? 0 : 1)] : -1;

  const cv = document.createElement('canvas');
  cv.width = W * PX; cv.height = H * PX;
  const g2 = cv.getContext('2d');
  let startTile = null;
  for (let r = 0; r < H; r++) {
    solid.push([]);
    for (let c = 0; c < W; c++) {
      const ch = charAt(r, c);
      const kind = kindOf(r, c);
      if (kind === 'rug') {
        // rugs: accent colour with a border, drawn over the room floor
        paintTile(g2, baseKind, c * PX, r * PX, r, c, { roadCenter });
        const acc = place.accent ?? '#5b7ca0';
        g2.fillStyle = acc; g2.fillRect(c * PX, r * PX, PX, PX);
        g2.fillStyle = hexShade(acc, 0.12);
        const edge = (dr, dc) => charAt(r + dr, c + dc) !== ';';
        if (edge(-1, 0)) g2.fillRect(c * PX, r * PX + 4, PX, 3);
        if (edge(1, 0)) g2.fillRect(c * PX, r * PX + PX - 7, PX, 3);
        if (edge(0, -1)) g2.fillRect(c * PX + 4, r * PX, 3, PX);
        if (edge(0, 1)) g2.fillRect(c * PX + PX - 7, r * PX, 3, PX);
        for (let i = 0; i < 50; i++) { g2.fillStyle = 'rgba(0,0,0,0.06)'; g2.fillRect(c * PX + nz(i, r) * PX, r * PX + nz(c, i) * PX, 1, 1); }
      } else paintTile(g2, kind, c * PX, r * PX, r, c, { roadCenter });
      const e = entryAt(r, c);
      solid[r][c] = ch === '#' || ch === '~' || !!e?.solid;
      if (ch === place.start && !startTile) startTile = { r, c };
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W * S, H * S), new THREE.MeshStandardMaterial({ map: tex, roughness: baseKind === 'marble' || baseKind === 'polished' ? 0.35 : 0.85 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);
  // water surfaces (pool / harbor) sit a little lower and shine
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (charAt(r, c) === '~') {
    const wm = new THREE.Mesh(new THREE.PlaneGeometry(S, S), M('#3c94d6', 0.08, 0.3));
    wm.rotation.x = -Math.PI / 2; wm.position.set(toX(c), 0.03, toZ(r)); root.add(wm);
  }
  {
    // what's around the building / park: lawn for the family home, hallway for the dorm, terrace stone for the penthouse
    const around = outdoor ? (placeId === 'downtown' ? '#7d8288' : '#4c8f42')
      : ({ home: { hs: '#5d8f4a', college: '#7b8088', pro: '#3a3f46' }, stadium: { hs: '#6f7a62', college: '#5c636b', pro: '#454b52' } }[placeId]?.[ctx.stage ?? 'pro'] ?? '#444a50');
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(W * S + 140, H * S + 140), M(around, 0.95));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true;
    root.add(ground);
  }

  // ---- walls: thin segments along the wall lines (indoors), building fronts / hedges (outdoors)
  const wallCol = place.wall ?? '#e3ded6';
  const wallMat = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, hexShade(wallCol, 0.03)); gr.addColorStop(1, hexShade(wallCol, -0.04));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 128);
    g.fillStyle = hexShade(wallCol, -0.25); g.fillRect(0, 116, 64, 12); // baseboard
    g.fillStyle = hexShade(wallCol, 0.06); g.fillRect(0, 0, 64, 4);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
  })();
  const capMat = M(hexShade(wallCol, -0.12), 0.8);
  const segs = [];
  const THK = 0.24;
  if (!outdoor) {
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      if (!isWall(r, c)) continue;
      const hz = isWall(r, c - 1) || isWall(r, c + 1);
      const vt = isWall(r - 1, c) || isWall(r + 1, c);
      const x = toX(c); const z = toZ(r);
      if (hz || !vt) segs.push({ r, x, z, sx: S, sz: THK });
      if (vt && r !== H - 1) segs.push({ r, x, z, sx: THK, sz: S, v: true }); // no stubs along the cut-away front edge
    }
  }
  const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), [wallMat, wallMat, capMat, capMat, wallMat, wallMat], Math.max(1, segs.length));
  walls.castShadow = true; walls.receiveShadow = true;
  const dummy = new THREE.Object3D();
  const placeWalls = (playerRow) => {
    segs.forEach((w, i) => {
      // tall at the back, low in front of the player so you can always see yourself
      const h = w.r === 0 ? 3.0 : w.r > playerRow || w.r === H - 1 ? 0.28 : 1.15;
      dummy.position.set(w.x, h / 2, w.z);
      dummy.scale.set(w.sx, h, w.sz);
      dummy.updateMatrix();
      walls.setMatrixAt(i, dummy.matrix);
    });
    walls.instanceMatrix.needsUpdate = true;
  };
  walls.count = segs.length;
  root.add(walls);
  // windows along the back wall (indoors)
  if (!outdoor) {
    for (let c = 2; c < W - 2; c += 4) if (isWall(0, c) && !isWall(1, c)) {
      const win = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.1, 0.06), M('#f4f4f2', 0.5));
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.95), new THREE.MeshBasicMaterial({ color: place.id === 'home' && ctx.stage === 'pro' ? '#9fc6ea' : '#bcdcf5', toneMapped: false }));
      glass.position.z = 0.035; win.add(frame, glass);
      win.position.set(toX(c), 1.75, toZ(0) + THK / 2 + 0.02);
      root.add(win);
    }
  } else {
    // outdoors: '#' tiles are building fronts next to shops and hedges elsewhere
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (isWall(r, c)) {
      const nearShop = ['G', 'S', 'H', 'P', 'X', 'Q', 'B', 'f', 'C', 'R', '$', 'U', 'J', 'Z', 'I', 'h'].some((k) => charAt(r, c - 1) === k || charAt(r, c + 1) === k) || r === 0 || r === H - 1;
      const p = nearShop && placeId === 'downtown' ? makeProp('facade', { color: ['#b7ad9f', '#a7a19a', '#c4b7a3'][(r + c) % 3], h: r === 0 || r === H - 1 ? 4.6 : 4.6 }) : makeProp('hedge');
      p.position.set(toX(c), 0, toZ(r));
      if (r === H - 1) p.rotation.y = Math.PI;
      if (r > H / 2 && placeId === 'downtown') p.scale.y = r === H - 1 ? 0.18 : 0.3; // keep the street visible
      root.add(p);
    }
  }

  // ---- skyline / backdrop outdoors
  if (outdoor) {
    const back = new THREE.Group();
    const kind = place.skyline ?? (placeId === 'park' ? 'trees' : 'town');
    for (let i = -14; i <= 14; i++) {
      const x = i * 5 + (nz(i, 2) - 0.5) * 2;
      if (kind === 'city' || kind === 'college' || kind === 'town') {
        const h = kind === 'city' ? 10 + nz(i, 5) * 28 : kind === 'college' ? 5 + nz(i, 5) * 8 : 3.5 + nz(i, 5) * 3;
        const b = new THREE.Mesh(new THREE.BoxGeometry(4.2, h, 4), M(['#9aa5b1', '#b4aa9b', '#8a96a3', '#c0b5a5', '#7d8894'][(i + 20) % 5], 0.8, kind === 'city' ? 0.25 : 0));
        b.position.set(x, h / 2, toZ(0) - 9 - nz(i, 9) * 6); back.add(b);
      } else {
        const t = makeProp('tree', { seed: i + 30 }); t.position.set(x, 0, toZ(0) - 5 - nz(i, 4) * 6); t.scale.setScalar(1.2 + nz(i, 7) * 0.6); back.add(t);
      }
    }
    root.add(back);
  }

  // ---- props, NPCs and interactables
  const tvSpots = [];
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) { const e = entryAt(r, c); if (e?.prop === 'tv' || e?.prop === 'screen') tvSpots.push({ x: toX(c), z: toZ(r) }); }
  const done = new Set();
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const ch = charAt(r, c);
      const entry = entryAt(r, c);
      if (!entry) continue;
      const x = toX(c);
      const z = toZ(r);
      if (entry.npc) {
        const key = entry.npc.key;
        let mesh;
        if (key === 'pet') mesh = makeProp('dog');
        else mesh = makePerson(ctx.lookFor(key) ?? { shirt: '#888', pants: '#333', skin: 1, hair: 1, hairStyle: 0 });
        mesh.position.set(x, 0, z);
        mesh.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        root.add(mesh);
        const npc = { key, mesh, home: { x, z }, wander: entry.npc.wander ?? 0, target: null, wait: Math.random() * 2, pet: key === 'pet' };
        npcs.push(npc);
        if (key === 'pet') interactables.push({ x, z, r: 1.6, label: 'Pet your dog', act: { kind: 'pet' }, npc });
        else interactables.push({ x, z, r: 1.8, label: key === 'fan' ? 'Talk to fan' : `Talk to ${ctx.nameFor(key)}`, act: { kind: 'person', key }, npc });
        continue;
      }
      if (done.has(`${r},${c}`)) continue;
      // footprint: a run of the same character (span props are built once across it)
      let w = 1; let d = 1;
      if (entry.span) {
        while (charAt(r, c + w) === ch) w++;
        while (charAt(r + d, c) === ch) d++;
        for (let rr = 0; rr < d; rr++) for (let cc = 0; cc < w; cc++) done.add(`${r + rr},${c + cc}`);
      }
      const cx = x + (w - 1) * S / 2;
      const cz = z + (d - 1) * S / 2;
      if (entry.prop) {
        const prop = makeProp(entry.prop, { w, d, color: entry.color, accent: place.accent, label: entry.label, seed: r * 31 + c });
        // face the room: back against the nearest wall; couches face the TV
        let rot = 0;
        if (entry.prop === 'couch' && tvSpots.length) {
          const tv = tvSpots.reduce((best, t) => (Math.hypot(t.x - cx, t.z - cz) < Math.hypot(best.x - cx, best.z - cz) ? t : best));
          rot = Math.atan2(cx - tv.x, cz - tv.z) + Math.PI;
          rot = Math.round(rot / (Math.PI / 2)) * (Math.PI / 2);
        } else {
          const wallN = [...Array(w)].some((_, k) => isWall(r - 1, c + k) || (outdoor && r === 1));
          const wallS = [...Array(w)].some((_, k) => isWall(r + d, c + k));
          const wallW = [...Array(d)].some((_, k) => isWall(r + k, c - 1));
          const wallE = [...Array(d)].some((_, k) => isWall(r + k, c + w));
          if (wallN) rot = 0; else if (wallS) rot = Math.PI; else if (wallW && w === 1) rot = -Math.PI / 2; else if (wallE && w === 1) rot = Math.PI / 2;
          if (outdoor && entry.prop === 'shopfront' && r > H / 2) rot = Math.PI;
        }
        prop.rotation.y = rot;
        prop.position.set(cx, 0, cz);
        // buildings on the near side of the street face away from the camera: cut them down low and float a sign
        if (outdoor && entry.prop === 'shopfront' && r > H / 2) {
          prop.scale.y = 0.3;
          const sign = nameSign((entry.label ?? '').split(':')[0], entry.color ?? '#3a86ff');
          sign.position.set(cx, 2.2, cz);
          root.add(sign);
        }
        if (outdoor && entry.prop === 'tree' && r === H - 1) prop.scale.setScalar(0.7);
        root.add(prop);
      }
      if (entry.act && !(ch === place.start && interactables.some((i) => i.act.kind === 'travel'))) {
        interactables.push({ x: cx, z: cz, r: (entry.solid ? 2.0 : 1.4) + (Math.max(w, d) - 1) * 0.9, label: entry.label ?? entry.act.name ?? '', act: entry.act });
      }
    }
  }
  // room labels
  for (const [text, r, c] of place.rooms ?? []) {
    const l = floorLabel(text);
    l.position.x = toX(c); l.position.z = toZ(r);
    root.add(l);
  }

  // ---- lights (soft shadows from the key light)
  const hemi = new THREE.HemisphereLight(outdoor ? '#dceaff' : '#fff6ea', outdoor ? '#4c6a42' : '#6a5a4a', outdoor ? 1.0 : 0.85);
  const sun = new THREE.DirectionalLight(outdoor ? '#fff2dc' : '#fff1e0', outdoor ? 2.6 : 1.8);
  sun.position.set(-W * 0.6, 30, H * 0.8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const half = Math.max(W, H) * S * 0.62;
  Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 1, far: 90 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  root.add(hemi, sun, sun.target);

  // ---- player
  const look = ctx.lookFor('self');
  const player = makePerson(look, { highlight: true });
  player.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const sr0 = startTile ?? { r: H - 2, c: Math.floor(W / 2) };
  let sr = { r: sr0.r - 1, c: sr0.c };
  outer: for (let dd = 1; dd < 6; dd++) {
    for (let dc = -dd; dc <= dd; dc++) {
      const r = sr0.r - dd;
      const c = sr0.c + dc;
      if (r >= 0 && c >= 0 && c < W && !solid[r][c]) { sr = { r, c }; break outer; }
    }
  }
  const pos = { x: toX(sr.c), z: toZ(sr.r) };
  player.position.set(pos.x, 0, pos.z);
  faceToward(player, pos.x, pos.z - 1);
  root.add(player);

  const marker = makeLabel('!', { color: '#ffd43b', size: 0.9 });
  marker.visible = false;
  root.add(marker);

  const blocked = (x, z) => {
    const c = Math.floor((x + (W * S) / 2) / S);
    const r = Math.floor((z + (H * S) / 2) / S);
    if (r < 0 || c < 0 || r >= H || c >= W) return true;
    return solid[r][c];
  };
  const canStand = (x, z) => {
    const rad = 0.4;
    return !blocked(x - rad, z - rad) && !blocked(x + rad, z - rad) && !blocked(x - rad, z + rad) && !blocked(x + rad, z + rad);
  };

  let input = { x: 0, z: 0 };
  let focus = null;
  let lastRow = -1;
  const zoom = outdoor ? 1.15 : 1.0;
  ctx.camera.position.set(pos.x, 14 * zoom, pos.z + 11 * zoom);
  ctx.camera.lookAt(pos.x, 0, pos.z - 1);

  const update = (dt) => {
    // move
    const len = Math.hypot(input.x, input.z);
    let speed = 0;
    if (len > 0.08) {
      const k = Math.min(1, len);
      const vx = (input.x / len) * k * 5.2;
      const vz = (input.z / len) * k * 5.2;
      const nx = pos.x + vx * dt;
      const nzz = pos.z + vz * dt;
      if (canStand(nx, pos.z)) pos.x = nx;
      if (canStand(pos.x, nzz)) pos.z = nzz;
      speed = 5.2 * k;
      faceToward(player, pos.x + vx, pos.z + vz);
    }
    player.position.set(pos.x, 0, pos.z);
    animateRun(player, dt, speed);
    // NPCs idle and wander
    for (const n of npcs) {
      n.wait -= dt;
      if (n.wander > 0 && n.wait <= 0 && !n.target) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * n.wander * S * 0.5;
        const t = { x: n.home.x + Math.cos(a) * d, z: n.home.z + Math.sin(a) * d };
        if (canStand(t.x, t.z)) n.target = t;
        n.wait = 1.5 + Math.random() * 3;
      }
      let sp = 0;
      if (n.target) {
        const dx = n.target.x - n.mesh.position.x;
        const dz = n.target.z - n.mesh.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.1) n.target = null;
        else {
          sp = n.pet ? 3 : 1.4;
          n.mesh.position.x += (dx / d) * sp * dt;
          n.mesh.position.z += (dz / d) * sp * dt;
          if (n.pet) n.mesh.rotation.y = Math.atan2(-dz, dx);
          else faceToward(n.mesh, n.mesh.position.x + dx, n.mesh.position.z + dz);
        }
      } else if (!n.pet) {
        const dp = Math.hypot(n.mesh.position.x - pos.x, n.mesh.position.z - pos.z);
        if (dp < 4) faceToward(n.mesh, pos.x, pos.z);
      }
      if (!n.pet) animateRun(n.mesh, dt, sp);
    }
    // interactable focus
    let best = null;
    let bd = Infinity;
    for (const it of interactables) {
      const ix = it.npc ? it.npc.mesh.position.x : it.x;
      const iz = it.npc ? it.npc.mesh.position.z : it.z;
      const d = Math.hypot(ix - pos.x, iz - pos.z);
      if (d < it.r && d < bd) { bd = d; best = it; }
    }
    if (best !== focus) {
      focus = best;
      ctx.onFocus?.(focus);
    }
    marker.visible = !!focus;
    if (focus) {
      const ix = focus.npc ? focus.npc.mesh.position.x : focus.x;
      const iz = focus.npc ? focus.npc.mesh.position.z : focus.z;
      marker.position.set(ix, 3.4 + Math.sin(performance.now() / 200) * 0.15, iz);
    }
    // walls cut away in front of the player
    const row = Math.floor((pos.z + (H * S) / 2) / S);
    if (row !== lastRow) { placeWalls(row); lastRow = row; }
    // camera follow
    const a = 1 - Math.exp(-5 * dt);
    const cam = ctx.camera;
    cam.position.x += (pos.x - cam.position.x) * a;
    cam.position.y += (14 * zoom - cam.position.y) * a;
    cam.position.z += (pos.z + 11 * zoom - cam.position.z) * a;
    cam.lookAt(cam.position.x, 0, cam.position.z - 11 * zoom - 1);
  };

  return {
    update,
    place,
    setInput(v) { input = v; },
    focus: () => focus,
    /** Play a short animation on the player (doing an activity, waving). */
    emote(kind) {
      if (kind === 'wave') playAction(player, ['wave', 'idle0', 'wave'], { fps: 4 });
      else playAction(player, ['celebrate0', 'celebrate1', 'celebrate0'], { fps: 5 });
    },
    dispose() { ctx.scene.remove(root); tex.dispose(); },
  };
}

export { setPose, makeProp };
