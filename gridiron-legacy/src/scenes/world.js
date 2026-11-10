// Walkable world engine: builds a place from a text map, then lets the player walk around
// (touch joystick or WASD/arrows) and interact with people and objects.
import * as THREE from 'three';
import { PLACES, LEGEND, FLOOR_COLORS } from '../data/places.js';
import { makePerson, animateRun, faceToward, setPose, playAction, makeLabel } from './actors.js';

const S = 2; // tile size in world units

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

// ------------------------------------------------------------------ props

const matCache = new Map();
function mat(color) {
  if (!matCache.has(color)) matCache.set(color, new THREE.MeshLambertMaterial({ color, flatShading: true }));
  return matCache.get(color);
}
function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y + h / 2, z);
  return m;
}
function cyl(r, h, color, x = 0, y = 0, z = 0, seg = 8) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat(color));
  m.position.set(x, y + h / 2, z);
  return m;
}

/** Build a little low-poly prop. Returns a Group sitting on the ground, centered in its tile. */
export function makeProp(type, opts = {}) {
  const g = new THREE.Group();
  const add = (...ms) => ms.forEach((m) => g.add(m));
  switch (type) {
    case 'bed': add(box(1.8, 0.45, 1.9, '#6b4423'), box(1.7, 0.25, 1.8, '#f1f1f1', 0, 0.45), box(1.7, 0.2, 1.1, opts.color ?? '#3a86ff', 0, 0.62, 0.35), box(0.7, 0.18, 0.4, '#ffffff', -0.45, 0.7, -0.6), box(0.7, 0.18, 0.4, '#ffffff', 0.45, 0.7, -0.6)); break;
    case 'desk': add(box(1.7, 0.75, 0.9, '#8d6748'), box(0.6, 0.4, 0.05, '#222831', 0, 0.75, -0.2), box(0.55, 0.32, 0.02, '#4da3ff', 0, 0.79, -0.17), box(0.5, 0.5, 0.5, '#2b2d42', 0.2, 0, 0.7)); break;
    case 'tv': add(box(1.8, 0.5, 0.6, '#3d2b1f'), box(1.6, 0.9, 0.08, '#111111', 0, 0.5, 0), box(1.45, 0.75, 0.02, '#2ec4b6', 0, 0.58, 0.05)); break;
    case 'couch': add(box(1.9, 0.45, 0.9, opts.color ?? '#6d597a'), box(1.9, 0.5, 0.25, hexShade(opts.color ?? '#6d597a', -0.08), 0, 0.45, -0.32), box(0.25, 0.3, 0.9, hexShade(opts.color ?? '#6d597a', -0.05), -0.85, 0.45), box(0.25, 0.3, 0.9, hexShade(opts.color ?? '#6d597a', -0.05), 0.85, 0.45)); break;
    case 'counter': add(box(1.95, 0.9, 0.9, '#f1f1f1'), box(1.95, 0.08, 0.95, '#495057', 0, 0.9), box(0.4, 0.15, 0.3, '#adb5bd', 0.4, 0.98)); break;
    case 'table': add(box(1.6, 0.08, 1.2, '#a0714f', 0, 0.7), cyl(0.07, 0.7, '#6b4423', -0.65, 0, -0.45), cyl(0.07, 0.7, '#6b4423', 0.65, 0, -0.45), cyl(0.07, 0.7, '#6b4423', -0.65, 0, 0.45), cyl(0.07, 0.7, '#6b4423', 0.65, 0, 0.45)); break;
    case 'mat': add(box(1.4, 0.04, 1.8, opts.color ?? '#7b2cbf')); break;
    case 'rack': add(box(1.8, 0.1, 0.5, '#343a40', 0, 1.0), box(0.1, 1.1, 0.5, '#495057', -0.85), box(0.1, 1.1, 0.5, '#495057', 0.85), cyl(0.3, 0.1, '#212529', -0.6, 1.05, 0), cyl(0.3, 0.1, '#212529', 0.6, 1.05, 0), box(1.0, 0.25, 0.6, '#c1121f', 0, 0, 0.6)); g.children[3].rotation.z = Math.PI / 2; g.children[4].rotation.z = Math.PI / 2; break;
    case 'treadmill': add(box(0.9, 0.2, 1.8, '#343a40'), box(0.8, 0.04, 1.6, '#111', 0, 0.2), box(0.1, 1.2, 0.1, '#495057', -0.4, 0, -0.8), box(0.1, 1.2, 0.1, '#495057', 0.4, 0, -0.8), box(0.9, 0.3, 0.2, '#4da3ff', 0, 1.1, -0.8)); break;
    case 'locker': add(box(1.9, 2.0, 0.6, '#3a506b'), box(0.04, 1.8, 0.02, '#1c2541', -0.32, 0.1, 0.31), box(0.04, 1.8, 0.02, '#1c2541', 0.32, 0.1, 0.31), box(1.9, 0.08, 0.62, '#5bc0be', 0, 1.6)); break;
    case 'tree': {
      const leaf = opts.color ?? '#2d6a4f';
      add(box(0.36, 1.5, 0.36, '#6b4423'), box(1.9, 1.0, 1.9, leaf, 0, 1.4), box(1.4, 0.8, 1.4, hexShade(leaf, 0.05), 0.1, 2.35, -0.1),
        box(0.8, 0.5, 0.8, hexShade(leaf, 0.1), -0.1, 3.1, 0.1), box(0.5, 0.4, 0.5, hexShade(leaf, -0.06), 0.85, 1.1, 0.6));
      break;
    }
    case 'bench': add(box(1.8, 0.1, 0.5, '#a0714f', 0, 0.45), box(1.8, 0.4, 0.1, '#a0714f', 0, 0.55, -0.22), box(0.1, 0.45, 0.4, '#343a40', -0.75), box(0.1, 0.45, 0.4, '#343a40', 0.75)); break;
    case 'hoop': add(cyl(0.08, 2.6, '#adb5bd'), box(1.1, 0.7, 0.06, '#ffffff', 0, 2.5, 0.25)); { const r = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.03, 4, 10), mat('#e85d04')); r.rotation.x = Math.PI / 2; r.position.set(0, 2.55, 0.55); add(r); } break;
    case 'fountain': add(cyl(1.6, 0.5, '#adb5bd', 0, 0, 0, 10), cyl(1.35, 0.06, '#4cc9f0', 0, 0.45, 0, 10), cyl(0.2, 1.2, '#ced4da', 0, 0.4), cyl(0.5, 0.12, '#adb5bd', 0, 1.5, 0, 8)); break;
    case 'truck': add(box(1.9, 1.3, 1.4, '#ffd166', 0, 0.3), box(1.9, 0.5, 1.4, '#ef476f', 0, 1.6), box(1.2, 0.5, 0.05, '#222', 0, 0.9, 0.71), cyl(0.25, 0.2, '#111', -0.6, 0, 0.6), cyl(0.25, 0.2, '#111', 0.6, 0, 0.6)); break;
    case 'booth': add(box(1.8, 1.0, 0.8, '#ffffff'), box(1.9, 0.1, 1.0, '#fb8500', 0, 1.8), box(0.08, 0.8, 0.08, '#adb5bd', -0.85, 1.0, 0.3), box(0.08, 0.8, 0.08, '#adb5bd', 0.85, 1.0, 0.3), box(1.2, 0.3, 0.02, '#fb8500', 0, 0.55, 0.41)); break;
    case 'shopfront': {
      const c = opts.color ?? '#3a86ff';
      add(box(1.98, 2.6, 1.9, '#e9ecef'), box(1.98, 0.5, 0.2, c, 0, 2.1, 0.96), box(0.9, 1.5, 0.06, '#1b263b', 0, 0, 0.96), box(0.7, 1.0, 0.03, '#a9d6e5', 0, 0.6, 0.99));
      const aw = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.08, 0.7), mat(hexShade(c, 0.1)));
      aw.position.set(0, 1.85, 1.25); aw.rotation.x = 0.3; add(aw);
      break;
    }
    case 'sign': add(cyl(0.06, 1.2, '#6b4423'), box(0.9, 0.5, 0.06, '#ffd166', 0, 1.1)); break;
    case 'plant': add(box(0.55, 0.45, 0.55, '#bc6c25'), box(0.7, 0.45, 0.7, '#40916c', 0, 0.45), box(0.4, 0.35, 0.4, '#52b788', 0.05, 0.9, 0)); break;
    case 'door': add(box(1.4, 0.04, 0.8, '#6b4423')); break;
    case 'cone': add(new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.6, 6), mat('#fb8500'))); g.children[0].position.y = 0.3; break;
    case 'mic': add(cyl(0.05, 1.3, '#adb5bd'), new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), mat('#212529')), box(1.8, 0.8, 0.6, '#1d3557', 0, 0, -0.7)); g.children[1].position.y = 1.35; break;
    case 'dog': {
      const c = opts.color ?? '#c68642';
      add(box(0.9, 0.4, 0.4, c, 0, 0.3), box(0.4, 0.35, 0.35, c, 0.55, 0.55), box(0.12, 0.3, 0.12, hexShade(c, -0.1), -0.3, 0), box(0.12, 0.3, 0.12, hexShade(c, -0.1), 0.3, 0), box(0.3, 0.08, 0.08, c, -0.55, 0.55), box(0.1, 0.1, 0.1, '#111', 0.78, 0.65));
      break;
    }
    default: break;
  }
  return g;
}

/** Pixel-font sign that always faces the camera. */
function textSprite(text, color) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = '800 10px Inter, sans-serif';
  const w = Math.ceil(g.measureText(text.toUpperCase()).width) + 8;
  c.width = w;
  c.height = 14;
  g.fillStyle = '#0e1116';
  g.fillRect(0, 0, w, 14);
  g.fillStyle = color;
  g.fillRect(1, 1, w - 2, 12);
  g.font = '800 10px Inter, sans-serif';
  g.fillStyle = '#ffffff';
  g.textBaseline = 'middle';
  g.fillText(text.toUpperCase(), 4, 7.5);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  s.scale.set(w * 0.05, 14 * 0.05, 1);
  return s;
}

// ------------------------------------------------------------------ world

/**
 * Build a place. ctx: { scene, camera, state, lookFor(key), nameFor(key), check(needs) }
 * Returns { update(dt), interactables, player, spawn(), setInput(vec), tryInteract(), dispose() }.
 */
export function buildWorld(placeId, ctx) {
  const place = PLACES[placeId];
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

  // Floor texture: one pixel-art canvas for the whole map.
  const PX = 16;
  const cv = document.createElement('canvas');
  cv.width = W * PX;
  cv.height = H * PX;
  const g2 = cv.getContext('2d');
  const floorColors = (kind) => (kind && kind !== 'floor' && FLOOR_COLORS[kind]) || [place.floor, place.floorAlt];
  const kindFor = (ch, entry) => {
    if (entry?.floor) return entry.floor;
    if (ch === ',') return 'grass';
    if (ch === ':') return place.outdoor ? 'path' : 'floor';
    if (ch === '=') return 'road';
    if (ch === '~') return 'water';
    if (ch === '_') return 'turf';
    if (ch === 'E') return 'door';
    return place.ground ?? (place.outdoor ? 'grass' : 'floor');
  };
  // deterministic per-pixel noise
  const nz = (x, y) => { const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return v - Math.floor(v); };
  const dot = (x, y, col) => { g2.fillStyle = col; g2.fillRect(x, y, 1, 1); };
  let startTile = null;
  const tufts = [];
  for (let r = 0; r < H; r++) {
    solid.push([]);
    for (let c = 0; c < W; c++) {
      const ch = charAt(r, c);
      const entry = resolveEntry(place.legend[ch] ?? LEGEND[ch], ctx.check);
      const isWall = ch === '#';
      const kind = isWall ? 'floor' : kindFor(ch, entry);
      const [a, b] = floorColors(place.outdoor && kind === 'floor' ? 'path' : kind);
      const X0 = c * PX;
      const Y0 = r * PX;
      g2.fillStyle = kind === 'grass' || kind === 'road' || kind === 'water' || kind === 'path' ? a : (r + c) % 2 ? a : b;
      g2.fillRect(X0, Y0, PX, PX);
      // pixel texture details per surface
      for (let y = 0; y < PX; y++) {
        for (let x = 0; x < PX; x++) {
          const n = nz(X0 + x, Y0 + y);
          if (kind === 'grass') { if (n < 0.1) dot(X0 + x, Y0 + y, hexShade(a, -0.07)); else if (n > 0.93) dot(X0 + x, Y0 + y, hexShade(a, 0.06)); }
          else if (kind === 'path') { if (n < 0.08) dot(X0 + x, Y0 + y, hexShade(a, -0.09)); else if (n > 0.95) dot(X0 + x, Y0 + y, hexShade(a, 0.07)); }
          else if (kind === 'road') { if (n < 0.12) dot(X0 + x, Y0 + y, hexShade(a, 0.04)); else if (n > 0.96) dot(X0 + x, Y0 + y, hexShade(a, -0.05)); }
          else if (kind === 'water') { if ((y + Math.floor(x / 4) + r) % 6 === 0 && n > 0.4) dot(X0 + x, Y0 + y, hexShade(a, 0.12)); }
          else if (kind === 'floor' && !place.outdoor) {
            // wood planks: 4 planks per tile, staggered seams, a little grain
            if (y % 4 === 3) dot(X0 + x, Y0 + y, hexShade(a, -0.08));
            else if ((x + (Math.floor((Y0 + y) / 4) % 2) * 8 + c * 5) % 16 === 0) dot(X0 + x, Y0 + y, hexShade(a, -0.07));
            else if (n < 0.06) dot(X0 + x, Y0 + y, hexShade(a, -0.03));
          }
        }
      }
      if (kind === 'road' && r % 2 === 0 && c % 3 === 0) { g2.fillStyle = '#ffd166'; g2.fillRect(X0 + 2, Y0 + PX - 2, 10, 2); }
      if (kind === 'turf') { g2.fillStyle = 'rgba(255,255,255,0.9)'; if (c % 3 === 0) g2.fillRect(X0, Y0, 2, PX); }
      if (kind === 'court') { g2.fillStyle = '#ffffff'; if (r % 3 === 0) g2.fillRect(X0, Y0, PX, 2); }
      if (kind === 'door') { g2.fillStyle = hexShade(a, -0.12); g2.fillRect(X0, Y0 + 7, PX, 2); }
      if (kind === 'grass' && !entry && nz(r * 3.1, c * 7.7) > 0.72) tufts.push({ x: toX(c) + (nz(c, r) - 0.5) * 1.4, z: toZ(r) + (nz(r, c) - 0.5) * 1.4, flower: nz(c * 2, r * 5) > 0.7 });
      solid[r][c] = isWall || ch === '~' || !!entry?.solid;
      if (ch === place.start && !startTile) startTile = { r, c };
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W * S, H * S), new THREE.MeshLambertMaterial({ map: tex }));
  floor.rotation.x = -Math.PI / 2;
  root.add(floor);
  // Big ground around outdoor places.
  if (place.outdoor) {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(W * S + 80, H * S + 80), new THREE.MeshLambertMaterial({ color: placeId === 'downtown' ? '#6c757d' : '#3d8b37' }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    root.add(ground);
  }

  // Walls (instanced so they can be cut away near the camera).
  const wallCells = [];
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (charAt(r, c) === '#') wallCells.push({ r, c });
  // Interior walls stay low (cutaway view) so you can see into every room; the back wall is tall.
  const wallH = place.outdoor ? 1.2 : 1.1;
  const wallCol = place.wall ?? '#7f8c8d';
  const wallSide = (() => {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    const g = c.getContext('2d');
    g.fillStyle = wallCol; g.fillRect(0, 0, 16, 16);
    if (place.outdoor) { // brick
      g.fillStyle = hexShade(wallCol, -0.08);
      for (let y = 0; y < 16; y += 4) { g.fillRect(0, y + 3, 16, 1); for (let x = (y / 4) % 2 ? 0 : 4; x < 16; x += 8) g.fillRect(x, y, 1, 3); }
    } else { // painted wall with a baseboard and trim
      g.fillStyle = hexShade(wallCol, 0.06); g.fillRect(0, 0, 16, 2);
      g.fillStyle = hexShade(wallCol, -0.18); g.fillRect(0, 13, 16, 3);
    }
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshLambertMaterial({ map: t });
  })();
  const wallTop = new THREE.MeshLambertMaterial({ color: hexShade(wallCol, 0.14) });
  const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(S, 1, S), [wallSide, wallSide, wallTop, wallTop, wallSide, wallSide], Math.max(1, wallCells.length));
  const dummy = new THREE.Object3D();
  const placeWalls = (playerRow) => {
    wallCells.forEach((w, i) => {
      // Walls in front of the player (closer to the camera) drop low so you can always see yourself.
      const h = w.r === 0 ? (place.outdoor ? 1.2 : 2.6) : w.r > playerRow || w.r === H - 1 ? 0.3 : wallH;
      dummy.position.set(toX(w.c), h / 2, toZ(w.r));
      dummy.scale.set(1, h, 1);
      dummy.updateMatrix();
      walls.setMatrixAt(i, dummy.matrix);
    });
    walls.instanceMatrix.needsUpdate = true;
  };
  walls.count = wallCells.length;
  root.add(walls);

  // Grass tufts and little flowers (instanced voxels).
  if (tufts.length) {
    const tg = new THREE.BoxGeometry(0.12, 0.22, 0.12);
    tg.translate(0, 0.11, 0);
    const tm = new THREE.InstancedMesh(tg, new THREE.MeshLambertMaterial({ color: '#ffffff' }), tufts.length * 3);
    const flowerCols = ['#ffd166', '#ef476f', '#ffffff', '#9b5de5'].map((x) => new THREE.Color(x));
    const grassCol = new THREE.Color(hexShade(FLOOR_COLORS.grass[0], -0.1));
    let k = 0;
    for (const t of tufts) {
      for (let j = 0; j < 3; j++) {
        dummy.position.set(t.x + (j - 1) * 0.14, 0, t.z + ((j * 7) % 3 - 1) * 0.1);
        dummy.scale.set(1, j === 1 ? 1.4 : 1, 1);
        dummy.updateMatrix();
        tm.setMatrixAt(k, dummy.matrix);
        tm.setColorAt(k, t.flower && j === 1 ? flowerCols[k % 4] : grassCol);
        k++;
      }
    }
    dummy.scale.set(1, 1, 1);
    root.add(tm);
  }

  // Props, NPCs and interactables.
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const ch = charAt(r, c);
      const entry = resolveEntry(place.legend[ch] ?? LEGEND[ch], ctx.check);
      if (!entry) continue;
      const x = toX(c);
      const z = toZ(r);
      if (entry.npc) {
        const key = entry.npc.key;
        let mesh;
        if (key === 'pet') mesh = makeProp('dog');
        else mesh = makePerson(ctx.lookFor(key) ?? { shirt: '#888', pants: '#333', skin: 1, hair: 1, hairStyle: 0 });
        mesh.position.set(x, 0, z);
        root.add(mesh);
        const npc = { key, mesh, home: { x, z }, wander: entry.npc.wander ?? 0, target: null, wait: Math.random() * 2, pet: key === 'pet' };
        npcs.push(npc);
        if (key === 'pet') interactables.push({ x, z, r: 1.6, label: 'Pet your dog', act: { kind: 'pet' }, npc });
        else interactables.push({ x, z, r: 1.8, label: key === 'fan' ? 'Talk to fan' : `Talk to ${ctx.nameFor(key)}`, act: { kind: 'person', key }, npc });
        continue;
      }
      if (entry.prop) {
        const prop = makeProp(entry.prop, { color: entry.color });
        prop.position.set(x, 0, z);
        root.add(prop);
        if (entry.prop === 'shopfront' && entry.label && charAt(r, c - 1) !== ch) {
          const sign = textSprite(entry.label.split(':')[0], entry.color ?? '#3a86ff');
          sign.position.set(x + (charAt(r, c + 1) === ch ? S / 2 : 0), 3.3, z + 0.6);
          root.add(sign);
        }
      }
      if (entry.act && !(ch === place.start && interactables.some((i) => i.act.kind === 'travel'))) {
        interactables.push({ x, z, r: entry.solid ? 2.0 : 1.4, label: entry.label ?? entry.act.name ?? '', act: entry.act });
      }
    }
  }

  // Lights.
  const hemi = new THREE.HemisphereLight('#ffffff', '#666666', 2.0);
  const sun = new THREE.DirectionalLight('#fff4e0', 1.6);
  sun.position.set(-10, 25, 15);
  root.add(hemi, sun);

  // Player.
  const look = ctx.lookFor('self');
  const player = makePerson(look, { highlight: true });
  // Spawn on the nearest open tile next to the entrance (search outward from the door).
  const sr0 = startTile ?? { r: H - 2, c: Math.floor(W / 2) };
  let sr = { r: sr0.r - 1, c: sr0.c };
  outer: for (let d = 1; d < 6; d++) {
    for (let dc = -d; dc <= d; dc++) {
      const r = sr0.r - d;
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
    const rad = 0.45;
    return !blocked(x - rad, z - rad) && !blocked(x + rad, z - rad) && !blocked(x - rad, z + rad) && !blocked(x + rad, z + rad);
  };

  let input = { x: 0, z: 0 };
  let focus = null;
  let lastRow = -1;
  const zoom = place.outdoor ? 1.15 : 1.0;
  ctx.camera.position.set(pos.x, 15 * zoom, pos.z + 12 * zoom);
  ctx.camera.lookAt(pos.x, 0, pos.z - 1);

  const update = (dt) => {
    // Move.
    const len = Math.hypot(input.x, input.z);
    let speed = 0;
    if (len > 0.08) {
      const k = Math.min(1, len);
      const vx = (input.x / len) * k * 6.5;
      const vz = (input.z / len) * k * 6.5;
      const nx = pos.x + vx * dt;
      const nz = pos.z + vz * dt;
      if (canStand(nx, pos.z)) pos.x = nx;
      if (canStand(pos.x, nz)) pos.z = nz;
      speed = 6.5 * k;
      faceToward(player, pos.x + vx, pos.z + vz);
    }
    player.position.set(pos.x, 0, pos.z);
    animateRun(player, dt, speed);
    // NPCs idle and wander.
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
          sp = n.pet ? 3 : 1.6;
          n.mesh.position.x += (dx / d) * sp * dt;
          n.mesh.position.z += (dz / d) * sp * dt;
          if (n.pet) n.mesh.rotation.y = Math.atan2(-dz, dx);
          else faceToward(n.mesh, n.mesh.position.x + dx, n.mesh.position.z + dz);
        }
      } else if (!n.pet) {
        // Face the player when nearby.
        const dp = Math.hypot(n.mesh.position.x - pos.x, n.mesh.position.z - pos.z);
        if (dp < 4) faceToward(n.mesh, pos.x, pos.z);
      }
      if (!n.pet) animateRun(n.mesh, dt, sp);
    }
    // Interactable focus.
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
      marker.position.set(ix, 3.6 + Math.sin(performance.now() / 200) * 0.15, iz);
    }
    // Walls cut away in front of the player.
    const row = Math.floor((pos.z + (H * S) / 2) / S);
    if (row !== lastRow) { placeWalls(row); lastRow = row; }
    // Camera follow.
    const a = 1 - Math.exp(-5 * dt);
    const cam = ctx.camera;
    cam.position.x += (pos.x - cam.position.x) * a;
    cam.position.y += (15 * zoom - cam.position.y) * a;
    cam.position.z += (pos.z + 12 * zoom - cam.position.z) * a;
    cam.lookAt(cam.position.x, 0, cam.position.z - 12 * zoom - 1);
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

export { setPose };
