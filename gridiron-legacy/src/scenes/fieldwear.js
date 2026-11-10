// Field weathering: a transparent pixel layer over the turf that collects footprints, cleat divots, slide
// marks and worn patches as a game goes on. Wet games turn the worn spots to mud; snow games start under a
// white blanket that players churn up. One layer per game (reset by key), drawn in field-local coordinates.
import * as THREE from 'three';

const PPY = 6; // pixels per yard

export function buildFieldWear(world, FIELD_W, FIELD_L) {
  const W = Math.round(FIELD_W * PPY);
  const H = Math.round(FIELD_L * PPY);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(FIELD_W, FIELD_L), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.012;
  mesh.renderOrder = 1;
  world.add(mesh);
  let key = '';
  let level = 0;
  let wx = 'clear';
  let dirty = false;
  let lastUp = 0;

  const wet = () => wx === 'rain' || wx === 'storm';
  const snow = () => wx === 'snow';
  const toPx = (x, z) => [Math.round((x + FIELD_W / 2) * PPY), Math.round((z - world.position.z + FIELD_L / 2) * PPY)];
  const dot = (x, y, w, h, col, a = 1) => { g.globalAlpha = a; g.fillStyle = col; g.fillRect(x, y, w, h); g.globalAlpha = 1; };
  const scuff = (px, py, r) => {
    if (snow()) {
      // churned snow: cut through to the turf, leave a grey-green rut
      g.globalCompositeOperation = 'destination-out';
      dot(px - r, py - r, r * 2, r * 2, '#000', 0.85);
      g.globalCompositeOperation = 'source-over';
      dot(px - r + 1, py - r + 1, r * 2 - 2, r * 2 - 2, '#6f7f6a', 0.35);
    } else if (wet()) {
      dot(px - r, py - r, r * 2, r * 2, '#4a3520', 0.5);
      dot(px - r + 1, py - r + 1, Math.max(1, r * 2 - 3), Math.max(1, r - 1), '#5d4428', 0.6);
      if (Math.random() < 0.3) dot(px, py, 1, 1, '#a8c0d0', 0.6); // puddle glint
    } else {
      dot(px - r, py - r, r * 2, r * 2, '#6b5a3a', 0.28);
      if (Math.random() < 0.5) dot(px, py, 1, 1, '#3b2c1a', 0.5);
    }
  };
  const print = (px, py) => {
    if (snow()) { g.globalCompositeOperation = 'destination-out'; dot(px, py, 2, 2, '#000', 0.8); g.globalCompositeOperation = 'source-over'; dot(px, py, 2, 1, '#566352', 0.4); }
    else if (wet()) dot(px, py, 2, 1, '#3f2d1a', 0.55);
    else dot(px, py, 1, 1, '#2d4a22', 0.45); // flattened grass
  };
  const slideMark = (px, py, dx, dy, len) => {
    const n = Math.max(3, Math.round(len * PPY));
    for (let i = 0; i < n; i++) {
      const k = i / n;
      const x = Math.round(px + dx * i), y = Math.round(py + dy * i);
      if (snow()) { g.globalCompositeOperation = 'destination-out'; dot(x - 1, y - 1, 3, 3, '#000', 0.9); g.globalCompositeOperation = 'source-over'; dot(x - 1, y, 3, 1, '#5d6b58', 0.35); }
      else if (wet()) { dot(x - 1, y - 1, 3, 3, '#4b3620', 0.55 * (1 - k * 0.5)); dot(x, y, 1, 1, '#6b4f2f', 0.7); }
      else { dot(x - 1, y - 1, 3, 2, '#6d5b3a', 0.3 * (1 - k * 0.5)); dot(x, y, 1, 1, '#2f4d24', 0.5); }
    }
  };
  /** Accumulated wear from the drives played between your plays. Between the hashes and near midfield. */
  const preWear = (amount) => {
    const n = Math.round(amount * (snow() ? 260 : wet() ? 220 : 140));
    for (let i = 0; i < n; i++) {
      const lane = (Math.random() - 0.5) * (Math.random() < 0.75 ? 14 : 44); // most traffic between the hashes
      const along = (Math.random() + Math.random() + Math.random() - 1.5) * 34; // centered on midfield
      const [px, py] = toPx(lane, along + world.position.z);
      const r = Math.random();
      if (r < 0.55) print(px, py);
      else if (r < 0.94) scuff(px, py, 1 + Math.floor(Math.random() * (snow() ? 2 : wet() ? 3 : 2)));
      else { const a = Math.random() * Math.PI * 2; slideMark(px, py, Math.cos(a), Math.sin(a), 0.8 + Math.random() * 1.6); }
    }
    dirty = true;
  };

  return {
    mesh,
    /** Start / continue the wear for a game. key = game id, progress 0..1 through the game. */
    set(gameKey, weather, progress = 0) {
      wx = weather;
      if (gameKey !== key) {
        key = gameKey;
        level = 0;
        g.clearRect(0, 0, W, H);
        if (snow()) { // a blanket of snow with a little texture; the field lines show through faintly
          dot(0, 0, W, H, '#eef3f7', 0.78);
          for (let i = 0; i < 900; i++) dot(Math.floor(Math.random() * W), Math.floor(Math.random() * H), 2, 1, '#ffffff', 0.6);
        }
      }
      if (progress > level) { preWear(progress - level); level = progress; }
      mesh.visible = !!gameKey;
      tex.needsUpdate = true;
    },
    step(x, z) { if (!key) return; const [px, py] = toPx(x, z); print(px, py); dirty = true; },
    divot(x, z, r = 2) { if (!key) return; const [px, py] = toPx(x, z); scuff(px, py, r); dirty = true; },
    slide(x, z, vx, vz, len = 2) {
      if (!key) return;
      const [px, py] = toPx(x, z);
      const l = Math.hypot(vx, vz) || 1;
      slideMark(px, py, vx / l, vz / l, len);
      dirty = true;
    },
    clear() { key = ''; g.clearRect(0, 0, W, H); mesh.visible = false; tex.needsUpdate = true; },
    /** Upload changes at most ~6 times a second. */
    tick(now = performance.now()) { if (dirty && now - lastUp > 160) { dirty = false; lastUp = now; tex.needsUpdate = true; } },
  };
}
