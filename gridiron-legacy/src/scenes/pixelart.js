// Procedural pixel-art sprite sheets for players and the ball.
//
// Each player sheet is a grid of 16x20 frames:
//   rows:    0 = back view (running away from camera), 1 = front view, 2 = side view (facing right)
//   columns: 0 idle, 1-4 run cycle, 5 throw / reach, 6 arms up (catch), 7 dive / juke, 8 down (tackled)
// A dark 1px outline is added automatically so sprites read clearly on grass.

export const FW = 16;
export const FH = 20;
export const COLS = 9;
export const ROWS = 3;
export const SKINS = ['#f2cba0', '#e0ac69', '#c68642', '#8d5524', '#5e3b22'];

const sheetCache = new Map();

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Draw one frame into ctx at (ox, oy). */
function drawFrame(ctx, ox, oy, view, col, pal) {
  const px = (x, y, c, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(ox + x, oy + y, w, h); };
  const { jersey, jerseyDk, trim, helmet, helmetDk, skin, pants, sock, mask } = pal;
  if (col === 8) {
    // Lying on the ground (same for every view).
    px(2, 14, helmet, 4, 4); px(2, 15, mask, 1, 2);
    px(6, 14, jersey, 6, 4); px(6, 14, trim, 1, 4);
    px(12, 15, pants, 2, 3); px(14, 16, sock, 1, 2);
    px(15, 17, '#1b1b1b');
    return;
  }
  const run = col >= 1 && col <= 4;
  const phase = run ? col - 1 : -1; // 0..3
  const bob = run && (phase === 1 || phase === 3) ? 1 : 0;
  const dive = col === 7;
  const y0 = bob + (dive ? 2 : 0);

  if (view === 2) {
    // ---- side view, facing right
    const lean = run ? 1 : 0;
    // helmet
    px(5 + lean, 1 + y0, helmet, 6, 5); px(5 + lean, 1 + y0, helmetDk, 6, 1);
    px(6 + lean, 2 + y0, trim, 1, 3); // stripe
    px(10 + lean, 3 + y0, skin, 1, 2); px(11 + lean, 3 + y0, mask, 1, 2);
    // torso + pads
    px(4 + lean, 6 + y0, jersey, 7, 2); px(5, 8 + y0, jersey, 6, 4); px(5, 11 + y0, jerseyDk, 6, 1);
    px(5, 8 + y0, trim, 1, 3); // number side stripe
    // legs
    const legs = run ? [[-2, 2], [1, -1], [2, -2], [-1, 1]][phase] : [0, 0];
    px(6 + legs[0], 12 + y0, pants, 2, 3); px(6 + legs[0], 15 + y0, sock, 2, 3 - bob); px(6 + legs[0], 18, '#1b1b1b', 3, 1);
    px(8 + legs[1], 12 + y0, shade(pants, -25), 2, 3); px(8 + legs[1], 15 + y0, shade(sock, -25), 2, 3 - bob); px(8 + legs[1], 18, '#1b1b1b', 3, 1);
    // arm
    if (col === 5) { px(9, 6 + y0, jersey, 2, 1); px(11, 4 + y0, skin, 1, 3); }
    else if (col === 6) { px(9, 3 + y0, skin, 1, 3); px(11, 2 + y0, skin, 1, 3); }
    else if (dive) { px(11, 7 + y0, skin, 4, 1); }
    else { const a = run ? [1, 0, -1, 0][phase] : 0; px(7 + a, 7 + y0, jerseyDk, 2, 2); px(7 + a * 2, 9 + y0, skin, 2, 2); }
    return;
  }
  // ---- back (0) / front (1) view
  const front = view === 1;
  px(5, 1 + y0, helmet, 6, 5); px(5, 1 + y0, helmetDk, 6, 1);
  px(7, 1 + y0, trim, 2, 5); // center stripe
  if (front) { px(6, 3 + y0, skin, 4, 2); px(6, 4 + y0, mask, 4, 1); px(7, 3 + y0, mask, 2, 1); }
  // shoulder pads + torso
  px(3, 6 + y0, jersey, 10, 2); px(3, 6 + y0, trim, 2, 1); px(11, 6 + y0, trim, 2, 1);
  px(4, 8 + y0, jersey, 8, 4); px(4, 11 + y0, jerseyDk, 8, 1);
  // number blob on back / chest
  px(6, 8 + y0, trim, 1, 3); px(8, 8 + y0, trim, 2, 1); px(9, 9 + y0, trim, 1, 1); px(8, 10 + y0, trim, 2, 1);
  // arms
  let la = 0;
  let ra = 0;
  if (run) { la = [1, 0, -1, 0][phase]; ra = -la; }
  if (col === 6) { px(2, 1 + y0, skin, 2, 6); px(12, 1 + y0, skin, 2, 6); }
  else if (col === 5) { px(2, 8 + y0, skin, 2, 3); px(12, 3 + y0, skin, 2, 4); }
  else if (dive) { px(1, 7 + y0, skin, 3, 2); px(12, 7 + y0, skin, 3, 2); }
  else { px(2, 8 + y0 + la, jerseyDk, 2, 2); px(2, 10 + y0 + la, skin, 2, 2); px(12, 8 + y0 + ra, jerseyDk, 2, 2); px(12, 10 + y0 + ra, skin, 2, 2); }
  // legs
  const lift = run ? [[1, 0], [0, 0], [0, 1], [0, 0]][phase] : [0, 0];
  px(5, 12 + y0, pants, 3, 3 - lift[0]); px(5, 15 + y0 - lift[0], sock, 3, 3 - bob); px(5, 18 - lift[0], '#1b1b1b', 3, 1);
  px(8, 12 + y0, shade(pants, -20), 3, 3 - lift[1]); px(8, 15 + y0 - lift[1], shade(sock, -20), 3, 3 - bob); px(8, 18 - lift[1], '#1b1b1b', 3, 1);
}

function outline(ctx, w, h, color = '#101418') {
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
      const near = (dx, dy) => {
        const nx = fx + dx;
        const ny = fy + dy;
        if (nx < 0 || ny < 0 || nx >= FW || ny >= FH) return false;
        return d[((y + dy) * w + (x + dx)) * 4 + 3] > 0;
      };
      if (near(1, 0) || near(-1, 0) || near(0, 1) || near(0, -1)) {
        out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = 255;
      }
    }
  }
  img.data.set(out);
  ctx.putImageData(img, 0, 0);
}

/** A canvas sprite sheet for one team look + skin tone (cached). */
export function playerSheet(colors, skinIdx = 0) {
  const key = `${colors[0]}|${colors[1]}|${skinIdx}`;
  if (sheetCache.has(key)) return sheetCache.get(key);
  const [primary, secondary] = colors;
  const pal = {
    jersey: primary,
    jerseyDk: shade(primary, -35),
    trim: secondary,
    helmet: primary,
    helmetDk: shade(primary, 40),
    skin: SKINS[skinIdx % SKINS.length],
    pants: secondary === '#ffffff' || secondary === '#f1faee' ? '#e9ecef' : secondary,
    sock: primary,
    mask: '#9aa4ae',
  };
  const c = document.createElement('canvas');
  c.width = FW * COLS;
  c.height = FH * ROWS;
  const ctx = c.getContext('2d');
  for (let v = 0; v < ROWS; v++) for (let f = 0; f < COLS; f++) drawFrame(ctx, f * FW, v * FH, v, f, pal);
  outline(ctx, c.width, c.height);
  sheetCache.set(key, c);
  return c;
}

/** 8x6 pixel football. */
export function ballCanvas() {
  if (sheetCache.has('ball')) return sheetCache.get('ball');
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 6;
  const g = c.getContext('2d');
  g.fillStyle = '#101418';
  g.fillRect(1, 0, 6, 6); g.fillRect(0, 1, 8, 4);
  g.fillStyle = '#8b4513';
  g.fillRect(2, 1, 4, 4); g.fillRect(1, 2, 6, 2);
  g.fillStyle = '#ffffff';
  g.fillRect(3, 2, 2, 1);
  sheetCache.set('ball', c);
  return c;
}
