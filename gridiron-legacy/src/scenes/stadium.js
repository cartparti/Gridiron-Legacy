// Procedural low-poly stadium: striped field with painted lines, end zones,
// stepped stands with an instanced crowd, light towers and goalposts.
// Field coordinates (yards): x across (-26.65..26.65), z along. Goal lines at z = ±50.
import * as THREE from 'three';

const FIELD_W = 53.3;
const FIELD_L = 120;

function fieldTexture(homeColors, awayColors, homeName = 'HOME', awayName = 'AWAY') {
  const ppy = 10; // pixels per yard
  const cw = Math.round(FIELD_W * ppy);
  const ch = FIELD_L * ppy;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 1200;
  const g = c.getContext('2d');
  const sx = c.width / cw;
  g.scale(sx, 1);
  // Grass stripes every 5 yards.
  for (let y = 0; y < FIELD_L; y += 5) {
    g.fillStyle = Math.floor(y / 5) % 2 ? '#2f7d3b' : '#358a42';
    g.fillRect(0, y * ppy, cw, 5 * ppy);
  }
  // End zones.
  const ez = (y0, col, txt) => {
    g.fillStyle = col[0];
    g.fillRect(0, y0 * ppy, cw, 10 * ppy);
    g.save();
    g.fillStyle = col[1];
    g.font = `900 ${6 * ppy}px Arial Black, Arial, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.translate(cw / 2, (y0 + 5) * ppy);
    if (y0 > 50) g.rotate(Math.PI);
    g.fillText(txt.toUpperCase(), 0, 0);
    g.restore();
  };
  ez(0, homeColors, homeName);
  ez(110, awayColors, awayName);
  // Lines.
  g.strokeStyle = 'rgba(255,255,255,0.92)';
  g.fillStyle = 'rgba(255,255,255,0.92)';
  g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, cw - 3, ch - 3);
  for (let y = 10; y <= 110; y += 5) {
    g.lineWidth = y === 10 || y === 110 ? 5 : 2.5;
    g.beginPath();
    g.moveTo(0, y * ppy);
    g.lineTo(cw, y * ppy);
    g.stroke();
  }
  // Hash marks.
  for (let y = 11; y < 110; y++) {
    for (const hx of [1, 18.4, FIELD_W - 18.4 - 1, FIELD_W - 2]) g.fillRect(hx * ppy, y * ppy - 1, ppy, 2);
  }
  // Numbers.
  g.font = `bold ${2.6 * ppy}px Arial, sans-serif`;
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
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function buildStadium(scene) {
  const world = new THREE.Group();
  scene.add(world);
  const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });

  // Surrounding turf / track.
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(FIELD_W + 24, FIELD_L + 24), lambert('#245e2e'));
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.02;
  world.add(apron);
  const track = new THREE.Mesh(new THREE.PlaneGeometry(FIELD_W + 60, FIELD_L + 60), lambert('#6b4b3a'));
  track.rotation.x = -Math.PI / 2;
  track.position.y = -0.05;
  world.add(track);

  const fieldMat = new THREE.MeshLambertMaterial({ map: fieldTexture(['#1d3557', '#f1c40f'], ['#b5121b', '#f5d547']) });
  const field = new THREE.Mesh(new THREE.PlaneGeometry(FIELD_W, FIELD_L), fieldMat);
  field.rotation.x = -Math.PI / 2; // canvas top ends up at -z (the end zone the offense attacks)
  world.add(field);

  // Stands: stepped tiers on all four sides.
  const standMat = lambert('#39424e');
  const standMat2 = lambert('#2c333c');
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

  const crowdGeo = new THREE.BoxGeometry(0.7, 0.9, 0.5);
  const crowd = new THREE.InstancedMesh(crowdGeo, new THREE.MeshLambertMaterial({ flatShading: true }), crowdPositions.length);
  const dummy = new THREE.Object3D();
  crowdPositions.forEach((p, i) => {
    dummy.position.copy(p);
    dummy.updateMatrix();
    crowd.setMatrixAt(i, dummy.matrix);
  });
  crowd.userData.base = crowdPositions;
  world.add(crowd);

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
  const postMat = lambert('#ffd43b');
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
      fieldMat.needsUpdate = true;
      const palette = [crowdColors[0], crowdColors[1], crowdColors[0], farColors[0], '#d9d9d9', '#6c757d', crowdColors[0]].map((c) => new THREE.Color(c));
      for (let i = 0; i < crowd.count; i++) crowd.setColorAt(i, palette[Math.floor(Math.random() * palette.length)]);
      crowd.instanceColor.needsUpdate = true;
    },
    /** Place the world so the opponent goal line is `yardLine` yards ahead of z = 0. */
    setYardLine(yardLine, distance) {
      world.position.z = -yardLine + 50;
      los.position.z = 0;
      fd.position.z = -Math.min(distance, yardLine);
      fd.visible = distance < yardLine;
      los.visible = true;
    },
    hideLines() { los.visible = false; fd.visible = false; },
    /** Make the crowd bounce (excitement 0..1). */
    animateCrowd(t, excitement = 0.2) {
      const base = crowd.userData.base;
      const step = base.length > 2500 ? 2 : 1;
      for (let i = 0; i < base.length; i += step) {
        const p = base[i];
        dummy.position.set(p.x, p.y + Math.max(0, Math.sin(t * 9 + i * 1.7)) * 0.35 * excitement, p.z);
        dummy.updateMatrix();
        crowd.setMatrixAt(i, dummy.matrix);
      }
      crowd.instanceMatrix.needsUpdate = true;
    },
  };
  api.setTeams(['#1d3557', '#f1c40f'], ['#b5121b', '#f5d547'], 'Gridiron', 'Legacy');
  return api;
}
