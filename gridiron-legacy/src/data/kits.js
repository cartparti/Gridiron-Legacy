// Uniforms: every team has a home, away and third (alternate) kit, derived from its two colors.
// A kit = { id, label, jersey, trim, numbers, pants, helmet, stripe, socks }.

const hex = (c) => parseInt(c.slice(1), 16);
const rgb = (c) => { const v = hex(c); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
const toHex = ([r, g, b]) => `#${[r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('')}`;
export const luma = (c) => { const [r, g, b] = rgb(c); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
export const mix = (a, b, t) => { const A = rgb(a); const B = rgb(b); return toHex(A.map((x, i) => x + (B[i] - x) * t)); };
export const shade = (c, t) => (t < 0 ? mix(c, '#000000', -t) : mix(c, '#ffffff', t));
export function colorDist(a, b) { const A = rgb(a); const B = rgb(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]) / 441; }

import { mascotKind } from './mascots.js';

const ALT_STYLES = ['black', 'secondary', 'gray', 'cream', 'dark'];

// Team identity: every team gets its own uniform design (same on all three kits, colors change), picked from its id
// so it never changes: helmet logo / stripe / finish / facemask, jersey pattern, number font, sleeve and pants stripes.
export const JERSEY_PATTERNS = ['plain', 'shoulders', 'chestBand', 'sidePanels', 'yoke', 'pinstripe', 'fade', 'claws', 'tvStripe'];
export const NUMBER_FONTS = ['block', 'varsity', 'rounded', 'serif', 'italic', 'stencil'];
export const HELMET_STRIPES = ['single', 'double', 'triple', 'wide', 'none', 'tri'];
export const HELMET_FINISHES = ['gloss', 'gloss', 'matte', 'metallic', 'chrome', 'satin'];
export function teamIdentity(team) {
  let seed = hashId(`${team.id}|${team.name}`) || 1;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const glyph = mascotKind(team);
  return {
    glyph,
    // generic-shield teams wear their letter
    logo: glyph !== 'shield' && r() < 0.72 ? 'glyph' : 'letter', letter: (team.name || team.city || '?').trim()[0].toUpperCase(),
    stripe: pick(HELMET_STRIPES), finish: pick(HELMET_FINISHES),
    mask: pick(['gray', 'gray', 'trim', 'dark', 'white', 'shell']),
    pattern: pick(JERSEY_PATTERNS), font: pick(NUMBER_FONTS),
    sleeve: pick([0, 2, 2, 3, 1]), pants: pick(['single', 'double', 'tri', 'none', 'single']),
    collar: pick(['v', 'round', 'v']), chestLogo: r() < 0.5,
  };
}
function hashId(id) { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }

/** The three kits for a team ({ id, colors: [primary, secondary] }). */
export function teamKits(team) {
  const [p, s] = team.colors;
  const pLight = luma(p) > 0.75;
  const contrast = (bg, pref) => (Math.abs(luma(bg) - luma(pref)) > 0.3 ? pref : luma(bg) > 0.5 ? '#14171c' : '#ffffff');
  const home = {
    id: 'home', label: 'Home', jersey: p, trim: s, numbers: contrast(p, s), pants: luma(s) > 0.8 ? '#eceef1' : pLight ? s : '#eceef1',
    helmet: p, stripe: s, socks: p,
  };
  const away = {
    id: 'away', label: 'Away', jersey: pLight ? '#2a2f38' : '#f3f4f6', trim: pLight ? s : p, numbers: pLight ? contrast('#2a2f38', s) : contrast('#f3f4f6', p),
    pants: pLight ? '#2a2f38' : luma(s) > 0.8 ? p : s, helmet: p, stripe: s, socks: pLight ? '#2a2f38' : '#f3f4f6',
  };
  const style = ALT_STYLES[hashId(team.id) % ALT_STYLES.length];
  let alt;
  if (style === 'black') alt = { jersey: '#17191d', trim: p, numbers: contrast('#17191d', s), pants: '#17191d', helmet: '#17191d', stripe: p, socks: '#17191d' };
  else if (style === 'secondary') alt = { jersey: luma(s) > 0.85 ? shade(p, -0.45) : s, trim: p, numbers: contrast(luma(s) > 0.85 ? shade(p, -0.45) : s, p), pants: p, helmet: s === '#ffffff' ? p : s, stripe: p, socks: s };
  else if (style === 'gray') alt = { jersey: '#7b828c', trim: p, numbers: '#ffffff', pants: '#5b616a', helmet: '#5b616a', stripe: p, socks: '#7b828c' };
  else if (style === 'cream') alt = { jersey: '#efe3c8', trim: p, numbers: p, pants: '#efe3c8', helmet: shade(p, -0.2), stripe: '#efe3c8', socks: p };
  else alt = { jersey: shade(p, -0.5), trim: s, numbers: contrast(shade(p, -0.5), s), pants: shade(p, -0.5), helmet: shade(p, -0.5), stripe: s, socks: shade(p, -0.5) };
  const third = { id: 'third', label: style === 'cream' ? 'Throwback' : style === 'black' ? 'Blackout' : 'Alternate', ...alt };
  const id = teamIdentity(team);
  // throwbacks go old school: serif numbers, sleeve stripes, no fancy pattern, a plain matte shell
  const tid = style === 'cream' ? { ...id, pattern: 'plain', font: 'serif', sleeve: 3, finish: 'matte', stripe: 'single', logo: 'letter' } : style === 'black' ? { ...id, finish: 'matte' } : id;
  home.style = id; away.style = id; third.style = tid;
  return { home, away, third };
}

export const KIT_IDS = ['home', 'away', 'third'];

/** The opponent kit that clashes least with yours. */
export function oppKitFor(myKit, oppTeam, isOppHome) {
  const kits = teamKits(oppTeam);
  const order = isOppHome ? ['home', 'third', 'away'] : ['away', 'home', 'third'];
  for (const id of order) if (colorDist(kits[id].jersey, myKit.jersey) > 0.35 && Math.abs(luma(kits[id].jersey) - luma(myKit.jersey)) > 0.12) return kits[id];
  let best = kits.home;
  for (const id of KIT_IDS) if (colorDist(kits[id].jersey, myKit.jersey) > colorDist(best.jersey, myKit.jersey)) best = kits[id];
  return best;
}

/** Uniform object for the 3D model. */
export function kitUniform(kit) {
  return { jersey: kit.jersey, trim: kit.trim, numbers: kit.numbers, pants: kit.pants, helmet: kit.helmet, stripe: kit.stripe, socks: kit.socks, style: kit.style };
}
