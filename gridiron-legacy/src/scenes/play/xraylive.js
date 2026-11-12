// Live X-ray for extreme hits: the two players turn into glowing see-through shells with their skeletons inside,
// tracked from the rig every frame while the hit plays out in slow motion. If the hit breaks something, that
// bone flashes red and snaps apart on screen.
import * as THREE from 'three';

let mats = null;
const getMats = () => mats ?? (mats = {
  shell: new THREE.MeshBasicMaterial({ color: '#4fb3ff', transparent: true, opacity: 0.13, depthWrite: false, blending: THREE.AdditiveBlending }),
  ghost: new THREE.MeshBasicMaterial({ color: '#0d2a44', transparent: true, opacity: 0.12, depthWrite: false }),
  bone: new THREE.MeshBasicMaterial({ color: '#eaf6ff', transparent: true, opacity: 0.96, depthTest: false }),
  hot: new THREE.MeshBasicMaterial({ color: '#ff4d4d', transparent: true, opacity: 1, depthTest: false }),
});
const CYL = new THREE.CylinderGeometry(1, 0.8, 1, 8, 1);
const SPH = new THREE.SphereGeometry(1, 12, 8);
const RING = new THREE.TorusGeometry(1, 0.11, 6, 18);
const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3();

/** One skeleton that follows a player's rig. */
function skeleton(scene, mesh) {
  const r = mesh.userData.rig;
  const M = getMats();
  const parts = [];
  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.renderOrder = 999; m.frustumCulled = false; scene.add(m); parts.push(m); return m; };
  const P = (obj, x = 0, y = 0, z = 0) => () => obj.localToWorld(_a.set(x, y, z)).clone();
  // segments: [name, from(), to(), radius]
  const seg = [];
  for (const [sd, lg, ar] of [['L', r.legL, r.armL], ['R', r.legR, r.armR]]) {
    seg.push([`thigh${sd}`, P(lg.hip), P(lg.knee), 0.034]);
    seg.push([`shin${sd}`, P(lg.knee), P(lg.ankle ?? lg.knee, 0, lg.ankle ? 0 : -0.44, 0), 0.026]);
    if (lg.ankle) seg.push([`foot${sd}`, P(lg.ankle), P(lg.ankle, 0, -0.05, -0.17), 0.02]);
    seg.push([`upper${sd}`, P(ar.sh), P(ar.el), 0.028]);
    seg.push([`fore${sd}`, P(ar.el), P(ar.wrist ?? ar.el, 0, ar.wrist ? 0 : -0.3, 0), 0.021]);
    seg.push([`hand${sd}`, P(ar.wrist ?? ar.el, 0, ar.wrist ? 0 : -0.3, 0), P(ar.wrist ?? ar.el, 0, ar.wrist ? -0.11 : -0.41, 0), 0.016]);
  }
  seg.push(['spine', P(r.spine, 0, 0.02, 0.04), P(r.neck, 0, 0, 0.03), 0.028]);
  seg.push(['neck', P(r.neck, 0, 0, 0.03), P(r.headG, 0, 0.12, 0.02), 0.022]);
  seg.push(['clav', P(r.armL.sh, 0.04, 0.02, 0), P(r.armR.sh, -0.04, 0.02, 0), 0.02]);
  seg.push(['pelvis', P(r.legL.hip, 0, 0.03, 0), P(r.legR.hip, 0, 0.03, 0), 0.04]);
  const segs = seg.map(([name, f, t, rad]) => ({ name, f, t, rad, a: add(CYL, M.bone), b: add(CYL, M.bone), split: 0 }));
  const knobs = [r.legL.knee, r.legR.knee, r.armL.el, r.armR.el, r.legL.hip, r.legR.hip, r.armL.sh, r.armR.sh].map((j) => ({ j, m: add(SPH, M.bone) }));
  const skull = add(SPH, M.bone);
  const jaw = add(SPH, M.bone);
  // ribcage: rings around the chest, children of the spine so they bend with it
  const ribs = [];
  for (let i = 0; i < 5; i++) {
    const ring = new THREE.Mesh(RING, M.bone);
    ring.renderOrder = 999; ring.frustumCulled = false;
    const w = 0.15 - Math.abs(i - 1.5) * 0.012;
    ring.scale.set(w, 0.1, w);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 0.2 + i * 0.055, 0.0);
    ring.scale.z = w * 0.72;
    r.spine.add(ring);
    ribs.push(ring);
  }
  const place = (m, a, b, rad) => {
    _d.subVectors(b, a);
    const len = _d.length();
    if (len < 1e-4) { m.visible = false; return; }
    m.visible = true;
    m.position.copy(a).addScaledVector(_d, 0.5);
    m.quaternion.setFromUnitVectors(UP, _d.multiplyScalar(1 / len));
    m.scale.set(rad * 0.8, len, rad * 0.8);
  };
  return {
    segs, ribs, skull,
    update() {
      mesh.updateMatrixWorld(true);
      for (const s of segs) {
        const a = s.f(); const b = s.t();
        if (s.split > 0) {
          // broken: two pieces, the lower one knocked off line at the break
          const mid = _b.lerpVectors(a, b, 0.5);
          const off = new THREE.Vector3(s.split * 0.05, -s.split * 0.02, s.split * 0.04);
          place(s.a, a, mid.clone().addScaledVector(_d.subVectors(b, a).normalize(), -0.012), s.rad);
          place(s.b, mid.clone().add(off), b.clone().add(off.multiplyScalar(0.4)), s.rad);
        } else { place(s.a, a, b, s.rad); s.b.visible = false; }
      }
      for (const k of knobs) { k.j.localToWorld(_a.set(0, 0, 0)); k.m.position.copy(_a); k.m.scale.setScalar(0.045); }
      r.headG.localToWorld(_a.set(0, 0.25, 0.005)); skull.position.copy(_a); skull.scale.set(0.11, 0.13, 0.125); skull.quaternion.copy(r.headG.getWorldQuaternion(new THREE.Quaternion()));
      r.headG.localToWorld(_a.set(0, 0.15, -0.06)); jaw.position.copy(_a); jaw.scale.set(0.07, 0.04, 0.07);
    },
    /** Light up (and maybe snap) the bone for an injured body part. */
    crack(part, bone) {
      const side = Math.random() < 0.5 ? 'L' : 'R';
      const map = { arm: [`fore${side}`], hand: [`hand${side}`], shin: [`shin${side}`], ankle: [`shin${side}`, `foot${side}`], thigh: [`thigh${side}`], knee: [`thigh${side}`, `shin${side}`], shoulder: ['clav', `upper${side}`], head: [], ribs: [] };
      const names = map[part] ?? [];
      const hot = getMats().hot;
      for (const s of segs) if (names.includes(s.name)) { s.a.material = hot; s.b.material = hot; if (bone && s.name === names[0]) s.split = 1; }
      if (part === 'head') { skull.material = hot; jaw.material = hot; }
      if (part === 'ribs') for (const rg of ribs.slice(1, 4)) rg.material = hot;
      if (part === 'knee' || part === 'shoulder') for (const k of knobs) if (k.j === r[`leg${side}`]?.knee || k.j === r[`arm${side}`]?.sh) k.m.material = hot;
    },
    dispose() {
      for (const m of parts) scene.remove(m);
      for (const rg of ribs) rg.parent?.remove(rg);
    },
  };
}

/**
 * Turn the X-ray on for these players. Returns { update(), crack(mesh, part, bone), off() }.
 * Their materials are swapped for a see-through shell (and put back by off()).
 */
export function liveXray(scene, meshes, others = []) {
  const M = getMats();
  const saved = new Map(); // mesh part -> its real material
  // the two players become glowing shells; everyone else fades to faint ghosts so nothing blocks the view
  const skin = (list, mat) => { for (const p of list) p.traverse((o) => { if (!o.isMesh || o === p.userData.shadow || o === p.userData.ring || o.renderOrder === 999) return; if (o.material !== M.shell && o.material !== M.ghost) saved.set(o, o.material); o.material = mat; }); };
  const apply = () => { skin(meshes, M.shell); skin(others, M.ghost); };
  apply();
  const skels = new Map(meshes.map((p) => [p, skeleton(scene, p)]));
  const ov = document.createElement('div');
  ov.className = 'xray-fx';
  ov.innerHTML = '<div class="xray-scan"></div><div class="xray-tag">X-RAY</div>';
  document.body.append(ov);
  return {
    update() { apply(); for (const s of skels.values()) s.update(); }, // re-apply: uniforms get swapped for dirtier ones when players go down
    crack(mesh, part, bone) {
      skels.get(mesh)?.crack(part, bone);
      ov.classList.add('hit');
      const t = document.createElement('div');
      t.className = 'xray-crack';
      t.textContent = bone ? 'FRACTURE' : part === 'head' ? 'CONCUSSION' : 'INJURY';
      ov.append(t);
    },
    off() {
      for (const [o, m] of saved) o.material = m;
      for (const p of meshes) p.userData.u && (p.userData.u.wearDirty = true);
      for (const s of skels.values()) s.dispose();
      ov.remove();
    },
  };
}
