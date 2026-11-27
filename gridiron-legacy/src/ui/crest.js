// Pixel-art team crests: a shield in team colors with a mascot glyph picked from the team name.
// Glyphs are 16x16 masks: '#' = mascot color, 'o' = dark detail, '+' = highlight, '.' = empty.

import { GLYPHS as G, mascotKind } from '../data/mascots.js';
import { proTeamDef } from '../data/teams.js';
export { mascotKind };


const cache = new Map();

// ---------------------------------------------------------------- pro club logos: detailed vector art at 4x resolution
const hexRgb = (c) => { const v = parseInt(c.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
const lum = (c) => { const [r, g, b] = hexRgb(c); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
const tint = (c, k) => { const [r, g, b] = hexRgb(c); const f = (x) => Math.max(0, Math.min(255, Math.round(k >= 0 ? x + (255 - x) * k : x * (1 + k)))); return `rgb(${f(r)},${f(g)},${f(b)})`; };
const PRO_SHAPES = ['shield', 'round', 'hex', 'badge', 'heater', 'roundel'];
function proCrestURL(team) {
  const key = `pro2|${team.id}|${team.colors.join('')}`;
  if (cache.has(key)) return cache.get(key);
  const W = 136, H = 160;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const [p, s] = team.colors;
  let hsh = 7; for (const ch of `${team.id}|${team.name}`) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
  const shape = PRO_SHAPES[hsh % PRO_SHAPES.length];
  const ink = '#0b0d10';
  const path = (inset = 0) => {
    g.beginPath();
    const L = 6 + inset, R = W - 6 - inset, T = 6 + inset, B = H - 6 - inset, cx = W / 2;
    if (shape === 'round' || shape === 'roundel') g.ellipse(cx, 76, 62 - inset, 66 - inset, 0, 0, Math.PI * 2);
    else if (shape === 'hex') { const r = 64 - inset; for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3; g.lineTo(cx + Math.cos(a) * r, 78 + Math.sin(a) * r * 1.12); } g.closePath(); }
    else if (shape === 'badge') { g.moveTo(L + 14, T); g.lineTo(R - 14, T); g.quadraticCurveTo(R, T, R, T + 14); g.lineTo(R, B - 44); g.quadraticCurveTo(R, B - 14, cx, B); g.quadraticCurveTo(L, B - 14, L, B - 44); g.lineTo(L, T + 14); g.quadraticCurveTo(L, T, L + 14, T); g.closePath(); }
    else if (shape === 'heater') { g.moveTo(L, T); g.quadraticCurveTo(cx, T + 18, R, T); g.lineTo(R, T + 70); g.quadraticCurveTo(R - 4, B - 26, cx, B); g.quadraticCurveTo(L + 4, B - 26, L, T + 70); g.closePath(); }
    else { g.moveTo(L, T); g.lineTo(R, T); g.lineTo(R, T + 78); g.quadraticCurveTo(R - 8, B - 22, cx, B); g.quadraticCurveTo(L + 8, B - 22, L, T + 78); g.closePath(); }
  };
  // body: dark rim, secondary ring, primary field with a soft gradient and a sheen
  g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 6; g.shadowOffsetY = 3; path(0); g.fillStyle = ink; g.fill(); g.shadowColor = 'transparent';
  path(4); g.fillStyle = s; g.fill();
  path(9); const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, tint(p, 0.18)); gr.addColorStop(0.55, p); gr.addColorStop(1, tint(p, -0.35)); g.fillStyle = gr; g.fill();
  if (shape === 'roundel') { g.lineWidth = 3; g.strokeStyle = tint(s, 0); g.beginPath(); g.ellipse(W / 2, 76, 44, 47, 0, 0, Math.PI * 2); g.stroke(); }
  g.save(); path(9); g.clip();
  g.globalAlpha = 0.14; g.fillStyle = '#fff'; g.beginPath(); g.ellipse(36, 30, 70, 40, -0.5, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
  g.restore();
  // mascot glyph: chunky cells with a thick outline, a drop shadow and two-tone shading
  const glyph = G[mascotKind(team)];
  const at = (x, y) => glyph[y]?.[x] ?? '.';
  const cs = 4.6, ox = W / 2 - 8 * cs, oy = 30;
  const main = Math.abs(lum(s) - lum(p)) > 0.25 ? s : lum(p) > 0.5 ? '#14171c' : '#ffffff';
  const hi = main === '#ffffff' ? '#ffd43b' : '#ffffff';
  const cells = (pad, col, filter) => { g.fillStyle = col; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (filter(at(x, y))) { g.beginPath(); g.roundRect?.(ox + x * cs - pad, oy + y * cs - pad, cs + pad * 2, cs + pad * 2, pad * 0.9 + 0.6); g.fill(); } };
  g.save(); g.translate(2, 3); g.globalAlpha = 0.35; cells(2.4, '#000', (ch) => ch !== '.'); g.restore();
  cells(2.6, ink, (ch) => ch !== '.');
  cells(0.15, main, (ch) => ch === '#');
  g.save(); g.beginPath(); g.rect(0, 0, W, oy + 7 * cs); g.clip(); g.globalAlpha = 0.22; cells(0.15, '#fff', (ch) => ch === '#'); g.restore();
  cells(0.15, hi, (ch) => ch === '+');
  cells(0.15, ink, (ch) => ch === 'o');
  // wordmark banner with the club name
  const name = String(team.name ?? '').toUpperCase();
  const by = shape === 'round' || shape === 'roundel' || shape === 'hex' ? 108 : 112;
  g.fillStyle = ink; g.beginPath(); g.moveTo(4, by - 3); g.lineTo(W - 4, by - 3); g.lineTo(W - 12, by + 14); g.lineTo(W - 4, by + 31); g.lineTo(4, by + 31); g.lineTo(12, by + 14); g.closePath(); g.fill();
  g.fillStyle = s; g.beginPath(); g.moveTo(8, by); g.lineTo(W - 8, by); g.lineTo(W - 15, by + 14); g.lineTo(W - 8, by + 28); g.lineTo(8, by + 28); g.lineTo(15, by + 14); g.closePath(); g.fill();
  const txt = lum(s) > 0.55 ? '#14171c' : '#ffffff';
  let fs = 19; g.font = `900 ${fs}px "Arial Black", Impact, sans-serif`;
  while (g.measureText(name).width > W - 36 && fs > 9) { fs -= 1; g.font = `900 ${fs}px "Arial Black", Impact, sans-serif`; }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = txt; g.fillText(name, W / 2, by + 15);
  // city tag on top
  g.font = '900 11px "Arial Black", Impact, sans-serif'; g.fillStyle = main === '#ffffff' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.6)';
  g.fillText(String(team.id ?? '').toUpperCase(), W / 2, shape === 'heater' ? 26 : 22);
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

/** Pixel crest as a data URL (34x40 pixels); built-in pro clubs get the detailed logo. */
export function crestURL(team) {
  if (proTeamDef(team.id)) return proCrestURL(team);
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
  // Schools get their own badge shape and pattern (stable per team); the built-in pro clubs keep the classic shield.
  let hsh = 7; for (const ch of `${team.id}|${team.name}`) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
  const pro = !!proTeamDef(team.id);
  const shape = pro ? 'shield' : ['shield', 'round', 'octagon', 'pennant', 'arch', 'shield'][hsh % 6];
  const pattern = pro ? 'plain' : ['plain', 'stripe', 'chevron', 'split', 'band', 'plain', 'quarter'][(hsh >> 4) % 7];
  const inShield = (x, y) => {
    const dx = Math.abs(x - 16.5), dy = y - 20;
    if (shape === 'round') return dx * dx + dy * dy <= 16.4 * 16.4 * (y > 20 ? 1.18 : 1) && y >= 1 && y <= 38;
    if (shape === 'octagon') return y >= 1 && y <= 38 && dx <= 16 && dx + Math.abs(dy) <= 25;
    if (shape === 'pennant') return y >= 1 && y <= 38 && dx <= 15.5 && (y < 30 || y - 30 < dx * 0.85);
    if (shape === 'arch') return y <= 38 && dx <= 15.5 && (y >= 14 || (x - 16.5) ** 2 + (y - 14) ** 2 <= 15.5 * 15.5);
    if (y < 1 || y > 38) return false;
    const half = y < 24 ? 16 : 16 - (y - 24) * 1.15;
    return dx <= half;
  };
  const shade = (hex, k) => { const v = parseInt(hex.slice(1), 16); const f = (c) => Math.max(0, Math.min(255, Math.round(c * k))); return `rgb(${f((v >> 16) & 255)},${f((v >> 8) & 255)},${f(v & 255)})`; };
  const fill = (x, y) => {
    const dx = x - 16.5;
    if (pattern === 'stripe' && Math.abs(dx) < 3) return s;
    if (pattern === 'chevron' && y > 26 && Math.abs(y - 26 - Math.abs(dx) * 0.55) < 2.2) return s;
    if (pattern === 'split' && dx < 0) return shade(p, 0.78);
    if (pattern === 'band' && y >= 29 && y <= 32) return s;
    if (pattern === 'quarter' && ((dx < 0) !== (y < 20))) return shade(p, 0.8);
    return y < 4 ? s : p;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!inShield(x, y)) continue;
    const edge = !inShield(x - 1, y) || !inShield(x + 1, y) || !inShield(x, y - 1) || !inShield(x, y + 1);
    const edge2 = !inShield(x - 2, y) || !inShield(x + 2, y) || !inShield(x, y - 2) || !inShield(x, y + 2);
    px(x, y, edge ? '#0b0d10' : edge2 ? s : fill(x, y));
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
  img.className = proTeamDef(team.id) ? 'crest hd' : 'crest';
  img.style.width = `${size}px`;
  img.style.height = `${Math.round(size * 40 / 34)}px`;
  return img;
}
