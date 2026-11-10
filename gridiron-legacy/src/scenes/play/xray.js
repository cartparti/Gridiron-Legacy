// Injury X-ray card: a small medical-scan style picture of the hurt body part with the damage marked.
// xrayCard(injury) -> element. injury: { label, part, bone }

const BONE = '#cfe6ff';
function draw(g, part, bone) {
  const W = 220; const H = 220;
  const bg = g.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, 160);
  bg.addColorStop(0, '#0f2a3d'); bg.addColorStop(1, '#040a10');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.shadowColor = '#7fc4ff'; g.shadowBlur = 10;
  const boneLine = (pts, w) => { g.strokeStyle = BONE; g.lineWidth = w; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) g.lineTo(p[0], p[1]); g.stroke(); };
  const knob = (x, y, r) => { g.fillStyle = BONE; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
  const soft = (pts, w) => { g.save(); g.shadowBlur = 0; g.strokeStyle = 'rgba(160,200,230,0.16)'; g.lineWidth = w; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) g.lineTo(p[0], p[1]); g.stroke(); g.restore(); };
  let hot = [110, 110];
  if (part === 'ankle') {
    soft([[105, 0], [105, 150], [170, 190]], 70);
    boneLine([[95, 0], [98, 118]], 16); boneLine([[122, 0], [120, 112]], 9); // tibia + fibula
    knob(98, 124, 12); knob(121, 118, 8);
    if (bone) { boneLine([[100, 142], [128, 150]], 14); boneLine([[128, 150], [182, 176]], 11); } // foot shifted off the joint
    else { boneLine([[104, 140], [130, 150]], 14); boneLine([[130, 150], [182, 172]], 11); }
    for (let i = 0; i < 4; i++) boneLine([[150 + i * 9, 160 + i * 4], [168 + i * 9, 168 + i * 5]], 4);
    knob(96, 152, 13); // heel
    hot = [106, 130];
  } else if (part === 'knee') {
    soft([[110, 0], [110, 220]], 86);
    boneLine([[108, 0], [106, 86]], 20); knob(96, 92, 14); knob(118, 92, 14); // femur
    boneLine([[112, 130], [116, 220]], 17); knob(112, 124, 15); boneLine([[136, 134], [138, 220]], 8); // tibia / fibula
    knob(84, 104, 9); // kneecap pushed out
    g.save(); g.shadowBlur = 0; g.strokeStyle = '#ff5d5d'; g.lineWidth = 3; g.setLineDash([5, 5]); g.beginPath(); g.moveTo(100, 96); g.lineTo(112, 122); g.stroke(); g.restore(); // torn ligament
    hot = [106, 108];
  } else if (part === 'shin' || part === 'thigh') {
    soft([[110, 0], [110, 220]], 84);
    if (part === 'shin') { boneLine([[100, 0], [104, 96]], 17); boneLine([[122, 104], [112, 220]], 17); boneLine([[130, 0], [132, 90]], 8); boneLine([[142, 100], [138, 220]], 8); hot = [112, 100]; }
    else { boneLine([[108, 0], [112, 220]], 22); g.save(); g.shadowBlur = 14; g.shadowColor = '#ff5d5d'; g.strokeStyle = 'rgba(255,93,93,0.75)'; g.lineWidth = 9; g.beginPath(); g.moveTo(140, 70); g.quadraticCurveTo(158, 110, 142, 150); g.stroke(); g.restore(); hot = [146, 110]; }
  } else if (part === 'arm') {
    soft([[40, 40], [110, 110], [190, 150]], 60);
    boneLine([[30, 30], [102, 100]], 17); knob(104, 103, 13); // humerus + elbow
    if (bone) { boneLine([[112, 112], [146, 120]], 9); boneLine([[158, 142], [200, 160]], 9); boneLine([[110, 122], [142, 138]], 7); boneLine([[150, 156], [196, 172]], 7); hot = [152, 136]; }
    else { boneLine([[122, 92], [200, 132]], 9); boneLine([[118, 104], [196, 146]], 7); hot = [110, 100]; } // forearm popped off the joint
  } else if (part === 'hand') {
    soft([[110, 220], [110, 60]], 110);
    boneLine([[96, 220], [98, 170]], 12); boneLine([[122, 220], [120, 170]], 10);
    for (let i = 0; i < 5; i++) { const x = 70 + i * 20; const top = 60 + Math.abs(i - 2) * 14; if (i === 3) { boneLine([[x, 160], [x + 2, 128]], 7); boneLine([[x + 10, 118], [x + 8, top + 6]], 7); } else boneLine([[x, 160], [x + (i - 2) * 3, top]], 7); knob(x, 162, 6); }
    hot = [136, 122];
  } else if (part === 'shoulder') {
    soft([[20, 80], [200, 80]], 120);
    boneLine([[10, 62], [120, 52]], 10); // clavicle
    boneLine([[110, 40], [150, 60], [150, 110], [118, 96]], 8); // scapula outline
    knob(166, 96, 17); boneLine([[170, 104], [190, 220]], 16); // humerus head sitting below the socket
    g.save(); g.shadowBlur = 0; g.strokeStyle = 'rgba(207,230,255,0.5)'; g.setLineDash([4, 5]); g.lineWidth = 2; g.beginPath(); g.arc(150, 74, 17, 0, 7); g.stroke(); g.restore(); // where it should be
    for (let i = 0; i < 4; i++) boneLine([[30, 110 + i * 26], [112, 100 + i * 26]], 6);
    hot = [158, 86];
  } else if (part === 'ribs') {
    boneLine([[110, 10], [110, 210]], 12);
    for (let i = 0; i < 7; i++) { const y = 32 + i * 25; g.strokeStyle = BONE; g.lineWidth = 7; g.beginPath(); g.moveTo(110, y); g.quadraticCurveTo(40, y - 6, 34, y + 26); g.stroke(); g.beginPath(); g.moveTo(110, y); if (i === 3) { g.quadraticCurveTo(150, y - 6, 160, y + 6); g.stroke(); g.beginPath(); g.moveTo(170, y + 14); g.quadraticCurveTo(184, y + 16, 186, y + 26); } else g.quadraticCurveTo(180, y - 6, 186, y + 26); g.stroke(); }
    hot = [166, 116];
  } else { // head
    g.fillStyle = 'rgba(160,200,230,0.12)'; g.beginPath(); g.ellipse(110, 100, 78, 88, 0, 0, 7); g.fill();
    g.strokeStyle = BONE; g.lineWidth = 7; g.beginPath(); g.ellipse(108, 92, 66, 72, 0, Math.PI * 0.95, Math.PI * 2.25); g.stroke();
    boneLine([[150, 150], [142, 190], [96, 196], [70, 160]], 7); // jaw
    g.fillStyle = '#06131d'; g.beginPath(); g.ellipse(128, 104, 15, 13, 0, 0, 7); g.fill(); // eye socket
    boneLine([[96, 184], [140, 180]], 3);
    g.save(); g.shadowColor = '#ff5d5d'; g.shadowBlur = 16; g.strokeStyle = 'rgba(255,93,93,0.8)'; g.lineWidth = 3; for (const r of [14, 24, 34]) { g.beginPath(); g.arc(70, 66, r, 0, 7); g.stroke(); } g.restore();
    hot = [70, 66];
  }
  // fracture mark + target ring on the damage
  g.shadowColor = '#ff3b3b'; g.shadowBlur = 14;
  g.strokeStyle = '#ff5d5d'; g.lineWidth = 3;
  g.beginPath(); g.arc(hot[0], hot[1], 22, 0, 7); g.stroke();
  g.beginPath(); g.moveTo(hot[0] - 30, hot[1]); g.lineTo(hot[0] - 16, hot[1]); g.moveTo(hot[0] + 16, hot[1]); g.lineTo(hot[0] + 30, hot[1]); g.moveTo(hot[0], hot[1] - 30); g.lineTo(hot[0], hot[1] - 16); g.moveTo(hot[0], hot[1] + 16); g.lineTo(hot[0], hot[1] + 30); g.stroke();
  // scan lines + frame text
  g.shadowBlur = 0;
  g.fillStyle = 'rgba(255,255,255,0.035)'; for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
  g.fillStyle = 'rgba(160,210,255,0.7)'; g.font = '700 10px Inter, sans-serif'; g.fillText('L', 8, 16); g.fillText('SCAN 01', W - 54, 16);
}

export function xrayCard(injury) {
  const el = document.createElement('div');
  el.className = 'xray';
  const c = document.createElement('canvas');
  c.width = 220; c.height = 220;
  draw(c.getContext('2d'), injury.part ?? 'ribs', !!injury.boneOut);
  const cap = document.createElement('div');
  cap.className = 'xray-cap';
  cap.innerHTML = `<small>INJURY REPORT</small><b>${injury.label}</b><span>${injury.boneOut ? 'Open fracture. ' : ''}Trainers are on the field.</span>`;
  el.append(c, cap);
  return el;
}
