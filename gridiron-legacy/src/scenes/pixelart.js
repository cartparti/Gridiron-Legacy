// Procedural pixel-art sprite sheets, drawn from a simple skeleton so we get lots of animation frames.
//
// Sheet layout: rows = views (0 back / running away, 1 front / toward camera, 2 side facing right),
// columns = poses listed in POSES. Each frame is FW x FH pixels. A dark outline is added afterwards.
// Two styles: 'football' (helmet, pads, uniform) and 'casual' (hair, t-shirt, jeans) for the walkable world.

export const FW = 24;
export const FH = 32;
export const ROWS = 3;
export const SKINS = ['#f3cfa6', '#e2b07a', '#c68a52', '#94603a', '#62402a'];
export const HAIRS = ['#1c1410', '#3b2414', '#6b4423', '#a8743f', '#d9b36a', '#7a2e1c', '#2b2b2b'];

// Pose = joint angles in degrees (0 = straight down, + = forward / up) and body offsets in pixels.
// legs: [thigh angle, knee bend]; arms: [upper angle, elbow bend]
const P = (o) => ({ bob: 0, crouch: 0, lean: 0, armL: [10, 20], armR: [-10, 20], legL: [0, 0], legR: [0, 0], ...o });
export const POSES = {
  idle0: P({}),
  idle1: P({ bob: 1, armL: [12, 24], armR: [-12, 24] }),
  run0: P({ lean: 2, legL: [38, 50], legR: [-30, 20], armL: [-45, 70], armR: [50, 80], bob: 0 }),
  run1: P({ lean: 2, legL: [18, 70], legR: [-10, 10], armL: [-20, 70], armR: [25, 80], bob: -1 }),
  run2: P({ lean: 2, legL: [-10, 30], legR: [10, 80], armL: [10, 70], armR: [-5, 80], bob: -1 }),
  run3: P({ lean: 2, legL: [-30, 20], legR: [38, 50], armL: [50, 80], armR: [-45, 70], bob: 0 }),
  run4: P({ lean: 2, legL: [-10, 10], legR: [18, 70], armL: [25, 80], armR: [-20, 70], bob: -1 }),
  run5: P({ lean: 2, legL: [10, 80], legR: [-10, 30], armL: [-5, 80], armR: [10, 70], bob: -1 }),
  back0: P({ lean: -1, legL: [-20, 30], legR: [10, 10], armL: [30, 60], armR: [10, 60] }),
  back1: P({ lean: -1, legL: [10, 10], legR: [-20, 30], armL: [10, 60], armR: [30, 60], bob: -1 }),
  stance: P({ crouch: 4, lean: 3, legL: [40, 80], legR: [-10, 60], armL: [70, 10], armR: [20, 40] }),
  throwWind: P({ lean: -2, legL: [20, 10], legR: [-25, 10], armL: [60, 20], armR: [-120, 80] }),
  throwRelease: P({ lean: 3, legL: [-20, 10], legR: [30, 30], armL: [-20, 30], armR: [100, 10] }),
  catchReach: P({ lean: 1, legL: [15, 20], legR: [-15, 20], armL: [85, 10], armR: [95, 10] }),
  jumpCatch: P({ bob: -3, legL: [40, 90], legR: [10, 70], armL: [165, 5], armR: [175, 5] }),
  dive: P({ crouch: 5, lean: 7, legL: [-60, 10], legR: [-75, 20], armL: [100, 0], armR: [110, 0] }),
  juke: P({ crouch: 2, lean: 4, legL: [45, 30], legR: [-35, 10], armL: [-40, 60], armR: [70, 40] }),
  tackle: P({ crouch: 3, lean: 6, legL: [-30, 30], legR: [20, 40], armL: [80, 30], armR: [90, 30] }),
  fall: P({ crouch: 6, lean: -5, legL: [60, 10], legR: [80, 10], armL: [120, 20], armR: [140, 20] }),
  getup: P({ crouch: 7, lean: 4, legL: [70, 120], legR: [20, 90], armL: [40, 0], armR: [60, 0] }),
  celebrate0: P({ legL: [10, 0], legR: [-10, 0], armL: [170, 0], armR: [170, 0] }),
  celebrate1: P({ bob: -2, legL: [25, 60], legR: [-5, 10], armL: [150, 30], armR: [170, 0] }),
  wave: P({ armL: [10, 20], armR: [160, 60] }),
  sit: P({ crouch: 7, legL: [85, 90], legR: [85, 90], armL: [30, 50], armR: [30, 50] }),
  down: P({}),
};
export const POSE_NAMES = Object.keys(POSES);
export const COLS = POSE_NAMES.length;
export const poseCol = (name) => Math.max(0, POSE_NAMES.indexOf(name));

const sheetCache = new Map();

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const rad = (d) => (d * Math.PI) / 180;

function painter(ctx, ox, oy) {
  const px = (x, y, c, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(ox + Math.round(x), oy + Math.round(y), w, h); };
  /** Thick pixel line from (x0,y0) to (x1,y1). */
  const line = (x0, y0, x1, y1, c, t = 2) => {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      px(x0 + (x1 - x0) * f - (t - 1) / 2, y0 + (y1 - y0) * f - (t - 1) / 2, c, t, t);
    }
  };
  const disc = (cx, cy, r, c) => {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) px(cx + x, cy + y, c);
  };
  return { px, line, disc };
}

/**
 * Draw one character frame.
 * view: 0 back, 1 front, 2 side (facing right). pal: colors. style: 'football' | 'casual'.
 */
function drawFrame(ctx, ox, oy, view, poseName, pal, style) {
  const { px, line, disc } = painter(ctx, ox, oy);
  const pose = POSES[poseName];
  const fb = style === 'football';
  if (poseName === 'down') {
    // Lying on the ground, seen from the side (same for all views).
    const y = 27;
    line(4, y, 18, y, pal.jersey, 5);
    line(4, y - 2, 18, y - 2, pal.jerseyLt, 1);
    line(18, y + 1, 23, y + 1, pal.pants, 3);
    px(22, y, '#16181c', 2, 3);
    disc(3, y - 1, 3, fb ? pal.helmet : pal.skin);
    if (!fb) disc(2, y - 2, 2, pal.hair);
    line(8, y + 2, 13, y + 4, pal.skin, 2);
    return;
  }
  const cx = 12;
  const ground = 30;
  const crouch = pose.crouch;
  const hipY = 19 + crouch * 0.6;
  const shY = 11 + crouch + pose.bob;
  const lean = pose.lean;
  const side = view === 2;
  const front = view === 1;

  // --- legs (drawn first, behind the torso)
  const leg = (angles, hx, far) => {
    const [a, bend] = angles;
    const len = 6;
    let kx, ky, fx, fy;
    if (side) {
      kx = hx + Math.sin(rad(a)) * len;
      ky = hipY + Math.cos(rad(a)) * len;
      fx = kx + Math.sin(rad(a - bend)) * len;
      fy = ky + Math.cos(rad(a - bend)) * len;
    } else {
      // Front/back: the forward leg lifts its knee (shorter), the planted leg stays long.
      const lift = Math.max(0, a) / 40 * 3.2 + Math.max(0, bend - 20) / 90 * 1.5;
      kx = hx + (a < -15 ? (hx < cx ? -0.5 : 0.5) : 0);
      ky = hipY + len - lift * 0.9;
      fx = hx + (hx < cx ? -0.5 : 0.5);
      fy = ky + len - lift * 0.8;
    }
    fy = Math.min(fy, ground);
    const thigh = far ? shade(pal.pants, -28) : pal.pants;
    const sock = far ? shade(pal.sock, -28) : pal.sock;
    line(hx, hipY, kx, ky, thigh, 3);
    line(kx, ky, fx, fy, sock, 3);
    // shoe
    if (side) px(fx - 1, fy, '#16181c', 4, 2);
    else px(fx - 1.5, fy, '#16181c', 3, 2);
  };
  if (side) {
    leg(pose.legR, cx + lean * 0.3, true);
    leg(pose.legL, cx + lean * 0.3, false);
  } else {
    leg(front ? pose.legR : pose.legL, cx - 2, false);
    leg(front ? pose.legL : pose.legR, cx + 2, false);
  }

  // --- arm helper
  const arm = (angles, sx, far) => {
    const [a, bend] = angles;
    const u = 4.5;
    const l = 4.5;
    let ex, ey, hx, hy;
    if (side) {
      ex = sx + Math.sin(rad(a)) * u;
      ey = shY + 1 + Math.cos(rad(a)) * u;
      hx = ex + Math.sin(rad(a + bend)) * l;
      hy = ey + Math.cos(rad(a + bend)) * l;
    } else {
      // Front/back: arms mostly swing up/down; big angles raise the hand above the shoulder.
      const dir = sx < cx ? -1 : 1;
      const up = Math.cos(rad(a));
      ex = sx + dir * 1;
      ey = shY + 1 + up * u;
      hx = ex + dir * (Math.abs(a) > 60 && Math.abs(a) < 120 ? 1 : 0) - (a > 20 && a < 70 ? dir * 1 : 0);
      // Swinging forward pulls the hand up toward the chest.
      hy = ey + Math.cos(rad(a + bend * 0.3)) * l - (a > 20 && a < 70 ? 2 : 0);
    }
    const sleeve = far ? shade(pal.sleeve, -30) : pal.sleeve;
    const skin = far ? shade(pal.skin, -25) : pal.skin;
    line(sx, shY + 1, ex, ey, sleeve, 2);
    line(ex, ey, hx, hy, skin, 2);
    px(hx - 1, hy - 1, fb ? (far ? shade(pal.glove, -30) : pal.glove) : skin, 2, 2);
  };
  if (side) arm(pose.armR, cx + lean, true);

  // --- torso
  const tx = cx + (side ? lean : 0);
  const tw = side ? 6 : fb ? 10 : 8;
  const torsoTop = shY;
  const torsoBot = hipY + 1;
  for (let y = torsoTop; y <= torsoBot; y++) {
    const f = (y - torsoTop) / Math.max(1, torsoBot - torsoTop);
    const w = Math.round(tw - f * (fb ? 3 : 1));
    const x0 = tx - w / 2 + (side ? (1 - f) * 0 : 0);
    px(x0, y, pal.jersey, w, 1);
    px(x0, y, pal.jerseyDk, 1, 1); // shaded edge
    if (y === torsoTop || y === torsoTop + 1) px(x0 + 1, y, pal.jerseyLt, Math.max(1, w - 2), 1);
  }
  if (fb) {
    // shoulder pads
    px(tx - tw / 2 - (side ? 0 : 1), torsoTop, pal.jersey, tw + (side ? 0 : 2), 3);
    px(tx - tw / 2 - (side ? 0 : 1), torsoTop, pal.jerseyLt, tw + (side ? 0 : 2), 1);
    // stripes / number
    if (!side) {
      px(tx - tw / 2 - 1, torsoTop + 1, pal.trim, 2, 1);
      px(tx + tw / 2 - 1, torsoTop + 1, pal.trim, 2, 1);
      // number: two chunky digits
      const ny = torsoTop + 4;
      px(tx - 3, ny, pal.trim, 2, 4); px(tx, ny, pal.trim, 3, 1); px(tx + 2, ny, pal.trim, 1, 4); px(tx, ny + 3, pal.trim, 3, 1);
    } else {
      px(tx - 1, torsoTop + 3, pal.trim, 2, 3);
    }
    // belt / pants top
    px(tx - tw / 2 + 1, torsoBot, pal.pants, tw - 2, 2);
  } else {
    // casual shirt detail: collar and hem
    px(tx - 1, torsoTop, shade(pal.jersey, -30), 2, 1);
    px(tx - tw / 2, torsoBot, pal.pants, tw, 2);
  }

  // --- arms in front of torso
  if (side) arm(pose.armL, cx + lean, false);
  else {
    arm(front ? pose.armR : pose.armL, tx - tw / 2 - 1, false);
    arm(front ? pose.armL : pose.armR, tx + tw / 2, false);
  }

  // --- head / helmet
  const hx = tx + (side ? 1 : 0);
  const hy = shY - 4;
  if (fb) {
    disc(hx, hy, 4, pal.helmet);
    // shading: dark lower-left, highlight upper-right
    px(hx - 4, hy + 1, pal.helmetDk, 1, 2); px(hx - 3, hy + 3, pal.helmetDk, 3, 1);
    px(hx + 1, hy - 3, pal.helmetLt, 2, 1); px(hx + 2, hy - 2, pal.helmetLt, 1, 1);
    // center stripe
    if (!side) px(hx - 0.5, hy - 4, pal.trim, 1, 4);
    else px(hx - 3, hy - 3, pal.trim, 4, 1);
    if (front) { px(hx - 2, hy, pal.skin, 4, 2); px(hx - 3, hy + 1, pal.mask, 6, 1); px(hx - 1, hy - 0, pal.mask, 1, 2); px(hx + 1, hy, pal.mask, 1, 2); }
    if (side) { px(hx + 2, hy - 0, pal.skin, 2, 2); px(hx + 3, hy - 1, pal.mask, 1, 4); px(hx + 1, hy + 2, pal.mask, 3, 1); }
  } else {
    disc(hx, hy, 3, pal.skin);
    px(hx - 3, hy + 1, shade(pal.skin, -25), 1, 2);
    // hair styles
    const hs = pal.hairStyle;
    if (hs === 0) { px(hx - 3, hy - 3, pal.hair, 7, 2); px(hx - 3, hy - 1, pal.hair, 1, 1); }
    else if (hs === 1) { disc(hx, hy - 1, 3, pal.hair); px(hx - 2, hy, pal.skin, 5, 3); }
    else if (hs === 2) { px(hx - 3, hy - 3, pal.hair, 7, 2); px(hx - 4, hy - 2, pal.hair, 1, 6); px(hx + 3, hy - 2, pal.hair, 1, 6); if (view === 0) px(hx - 3, hy - 1, pal.hair, 7, 4); }
    else { disc(hx, hy - 2, 4, pal.hair); px(hx - 2, hy, pal.skin, 5, 3); }
    if (view === 0) px(hx - 3, hy - 2, pal.hair, 7, 3);
    if (front) { px(hx - 2, hy, '#1a1a1a'); px(hx + 1, hy, '#1a1a1a'); }
    if (side) px(hx + 2, hy, '#1a1a1a');
  }
}

function outline(ctx, w, h, color = '#0e1116') {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const out = new Uint8ClampedArray(d);
  const [r, g, b] = [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] > 0) continue;
      const fx = x % FW;
      const fy = y % FH;
      const on = (dx, dy) => {
        const nx = fx + dx;
        const ny = fy + dy;
        if (nx < 0 || ny < 0 || nx >= FW || ny >= FH) return false;
        return d[((y + dy) * w + (x + dx)) * 4 + 3] > 0;
      };
      if (on(1, 0) || on(-1, 0) || on(0, 1) || on(0, -1)) { out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = 255; }
    }
  }
  img.data.set(out);
  ctx.putImageData(img, 0, 0);
}

function footballPalette(colors, skinIdx) {
  const [primary, secondary] = colors;
  const lightTrim = parseInt(secondary.slice(1), 16) > 0xdddddd;
  return {
    jersey: primary, jerseyDk: shade(primary, -40), jerseyLt: shade(primary, 35), sleeve: primary,
    trim: secondary, helmet: primary, helmetDk: shade(primary, -45), helmetLt: shade(primary, 70),
    skin: SKINS[skinIdx % SKINS.length], pants: lightTrim ? '#e6e9ee' : secondary, sock: primary,
    mask: '#aab4be', glove: lightTrim ? '#f2f2f2' : shade(secondary, -10),
  };
}

/** Football sprite sheet for a team look + skin tone (cached). */
export function playerSheet(colors, skinIdx = 0) {
  return buildSheet(`fb|${colors[0]}|${colors[1]}|${skinIdx}`, footballPalette(colors, skinIdx), 'football');
}

/** Casual-clothes sheet for the walkable world. look = { shirt, pants, skin, hair, hairStyle } */
export function casualSheet(look) {
  const pal = {
    jersey: look.shirt, jerseyDk: shade(look.shirt, -40), jerseyLt: shade(look.shirt, 35), sleeve: look.shirt,
    trim: shade(look.shirt, 60), skin: SKINS[look.skin % SKINS.length], pants: look.pants ?? '#34495e', sock: look.pants ?? '#34495e',
    hair: HAIRS[look.hair % HAIRS.length], hairStyle: look.hairStyle ?? 0, glove: SKINS[look.skin % SKINS.length],
  };
  return buildSheet(`cas|${look.shirt}|${look.pants}|${look.skin}|${look.hair}|${look.hairStyle}`, pal, 'casual');
}

function buildSheet(key, pal, style) {
  if (sheetCache.has(key)) return sheetCache.get(key);
  const c = document.createElement('canvas');
  c.width = FW * COLS;
  c.height = FH * ROWS;
  const ctx = c.getContext('2d');
  for (let v = 0; v < ROWS; v++) POSE_NAMES.forEach((name, i) => drawFrame(ctx, i * FW, v * FH, v, name, pal, style));
  outline(ctx, c.width, c.height);
  sheetCache.set(key, c);
  return c;
}

/** 10x7 pixel football with laces and shading. */
export function ballCanvas() {
  if (sheetCache.has('ball')) return sheetCache.get('ball');
  const c = document.createElement('canvas');
  c.width = 10;
  c.height = 7;
  const g = c.getContext('2d');
  const px = (x, y, col, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  px(2, 0, '#0e1116', 6, 7); px(1, 1, '#0e1116', 8, 5); px(0, 2, '#0e1116', 10, 3);
  px(2, 1, '#8b4513', 6, 5); px(1, 2, '#8b4513', 8, 3);
  px(3, 1, '#b5652a', 4, 1); px(2, 4, '#5e2f0d', 6, 1);
  px(3, 3, '#ffffff', 4, 1); px(4, 2, '#ffffff'); px(6, 2, '#ffffff');
  sheetCache.set('ball', c);
  return c;
}
