// Extra visual effects: pyrotechnic flame jets, fireworks, and a ball trail.
import * as THREE from 'three';

/** Flame jet shooting up from the ground (orange/yellow voxels). Returns updater. */
export function flameJet(scene, pos, dur = 1.8) {
  const n = 60;
  const geo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95 }), n);
  const cols = ['#fff3b0', '#ffd43b', '#ff922b', '#f03e3e'].map((c) => new THREE.Color(c));
  const P = Array.from({ length: n }, (_, i) => ({ life: -i * (dur / n) * 0.6, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }));
  P.forEach((_, i) => mesh.setColorAt(i, cols[i % 4]));
  scene.add(mesh);
  const d = new THREE.Object3D();
  let t = 0;
  return (dt) => {
    t += dt;
    P.forEach((p, i) => {
      p.life += dt;
      if (p.life > 0.7 && t < dur) { p.life = 0; }
      if (p.life <= dt && p.life > 0 && t < dur) { p.x = pos.x + (Math.random() - 0.5) * 0.4; p.y = 0.2; p.z = pos.z + (Math.random() - 0.5) * 0.4; p.vx = (Math.random() - 0.5) * 1.2; p.vy = 9 + Math.random() * 5; p.vz = (Math.random() - 0.5) * 1.2; }
      if (p.life > 0) { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= 6 * dt; }
      const k = p.life > 0 ? Math.max(0.01, 1.2 - p.life * 1.6) : 0.001;
      d.position.set(p.x, p.y, p.z); d.scale.setScalar(k); d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      mesh.setColorAt(i, cols[Math.max(0, Math.min(3, Math.floor(p.life * 5)))]);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    if (t > dur + 0.8) { scene.remove(mesh); geo.dispose(); return false; }
    return true;
  };
}

/** Firework shell bursting in the sky. Returns updater. */
export function firework(scene, pos, color = '#ffd43b', delay = 0) {
  const n = 70;
  const geo = new THREE.BufferGeometry();
  const arr = new Float32Array(n * 3);
  const vel = [];
  for (let i = 0; i < n; i++) {
    arr.set([pos.x, pos.y, pos.z], i * 3);
    const u = Math.random() * 2 - 1;
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    const sp = 9 + Math.random() * 4;
    vel.push(new THREE.Vector3(r * Math.cos(a) * sp, u * sp, r * Math.sin(a) * sp));
  }
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const mat = new THREE.PointsMaterial({ color, size: 4, sizeAttenuation: false, transparent: true, depthWrite: false });
  const pts = new THREE.Points(geo, mat);
  pts.visible = false;
  scene.add(pts);
  let t = -delay;
  return (dt) => {
    t += dt;
    if (t < 0) return true;
    pts.visible = true;
    for (let i = 0; i < n; i++) {
      vel[i].y -= 6 * dt;
      vel[i].multiplyScalar(0.985);
      arr[i * 3] += vel[i].x * dt; arr[i * 3 + 1] += vel[i].y * dt; arr[i * 3 + 2] += vel[i].z * dt;
    }
    geo.attributes.position.needsUpdate = true;
    mat.opacity = Math.max(0, 1 - t / 1.8);
    if (t > 1.9) { scene.remove(pts); geo.dispose(); return false; }
    return true;
  };
}

/** Fading streak behind the ball. call push(pos) each frame while in the air. */
export function makeTrail(scene) {
  const n = 18;
  const geo = new THREE.BufferGeometry();
  const arr = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 3, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false }));
  scene.add(pts);
  let head = 0;
  return {
    push(p) {
      arr.set([p.x, p.y, p.z], head * 3);
      head = (head + 1) % n;
      for (let i = 0; i < n; i++) { const age = (head - i + n) % n; const v = Math.max(0, 1 - age / n); col.set([v, v, v * 0.85], i * 3); }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
    fade() { for (let i = 0; i < col.length; i++) col[i] *= 0.85; geo.attributes.color.needsUpdate = true; },
    remove() { scene.remove(pts); geo.dispose(); },
  };
}
