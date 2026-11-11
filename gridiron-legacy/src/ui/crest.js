// Pixel-art team crests: a shield in team colors with a mascot glyph picked from the team name.
// Glyphs are 16x16 masks: '#' = mascot color, 'o' = dark detail, '+' = highlight, '.' = empty.

import { GLYPHS as G, mascotKind } from '../data/mascots.js';
export { mascotKind };


const cache = new Map();

/** Pixel crest as a data URL (34x40 pixels). */
export function crestURL(team) {
  const key = team.id + team.colors.join('');
  if (cache.has(key)) return cache.get(key);
  const W = 34;
  const H = 40;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const [p, s] = team.colors;
  const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  // shield outline: rows narrow toward the bottom point
  const inShield = (x, y) => {
    if (y < 1 || y > 38) return false;
    const half = y < 24 ? 16 : 16 - (y - 24) * 1.15;
    return Math.abs(x - 16.5) <= half;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!inShield(x, y)) continue;
    const edge = !inShield(x - 1, y) || !inShield(x + 1, y) || !inShield(x, y - 1) || !inShield(x, y + 1);
    const edge2 = !inShield(x - 2, y) || !inShield(x + 2, y) || !inShield(x, y - 2) || !inShield(x, y + 2);
    px(x, y, edge ? '#0b0d10' : edge2 ? s : y < 4 ? s : p);
  }
  // diagonal shine
  g.globalAlpha = 0.12;
  for (let y = 4; y < 22; y++) for (let x = 4; x < 12 - y * 0.2; x++) if (inShield(x, y)) px(x, y, '#ffffff');
  g.globalAlpha = 1;
  // mascot glyph with a dark outline
  const glyph = G[mascotKind(team)];
  const ox = 9;
  const oy = 9;
  const at = (x, y) => glyph[y]?.[x] ?? '.';
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (at(x, y) !== '.') continue;
    if ([at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].some((ch) => ch === '#' || ch === '+')) px(ox + x, oy + y, '#0b0d10');
  }
  const light = (col) => { const v = parseInt(col.slice(1), 16); return (0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) / 255; };
  const main = Math.abs(light(s) - light(p)) > 0.25 ? s : light(p) > 0.5 ? '#14171c' : '#ffffff';
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const ch = at(x, y);
    if (ch === '#') px(ox + x, oy + y, main);
    else if (ch === '+') px(ox + x, oy + y, main === '#ffffff' ? '#ffd43b' : '#ffffff');
    else if (ch === 'o') px(ox + x, oy + y, '#0b0d10');
  }
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

/** <img> crest element. */
export function crest(team, size = 64) {
  const img = document.createElement('img');
  img.src = crestURL(team);
  img.alt = `${team.city} ${team.name}`;
  img.className = 'crest';
  img.style.width = `${size}px`;
  img.style.height = `${Math.round(size * 40 / 34)}px`;
  return img;
}
