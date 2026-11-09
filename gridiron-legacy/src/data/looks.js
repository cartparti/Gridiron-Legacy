// Character appearance data: skin tones, hair, faces, tattoos, gear, body size.
// Pure data + generators (no DOM), shared by the sim (to store looks) and the renderer.

export const SKIN_TONES = ['#f7dcc0', '#efc6a0', '#e0ab7f', '#cc9260', '#b07646', '#8f5a34', '#6e4126', '#4d2c1a'];
export const HAIR_COLORS = ['#151112', '#2f1d13', '#4d3120', '#774a2a', '#a6703f', '#d4ad69', '#ebe0b5', '#8e2f1b', '#bfbfbf', '#3657c9', '#c23b88', '#2e9e64'];
export const EYE_COLORS = ['#3a2416', '#1b1b1b', '#2f6db3', '#3e8a4c', '#7c5b2b', '#7d8b99'];
export const GEAR_COLORS = ['#16181c', '#f2f2f2', '#d33a2c', '#2f6fd6', '#f2c12e', '#2fb35a', '#f27a1a', '#d640a0', '#8a8f98', '#d4af37', '#c9ced6', '#39ff14', '#7b2ff7', '#00c2d1', '#ff4fa3'];

export const HAIR_STYLES = [
  { id: 'bald', label: 'Bald' }, { id: 'buzz', label: 'Buzz' }, { id: 'short', label: 'Short' }, { id: 'fade', label: 'Fade' },
  { id: 'flattop', label: 'Flat top' }, { id: 'curly', label: 'Curly' }, { id: 'afro', label: 'Afro' }, { id: 'mohawk', label: 'Mohawk' },
  { id: 'dreads', label: 'Locs' }, { id: 'braids', label: 'Braids' }, { id: 'long', label: 'Long' }, { id: 'bun', label: 'Bun' },
];
export const BROWS = [{ id: 'normal', label: 'Normal' }, { id: 'thick', label: 'Thick' }, { id: 'thin', label: 'Thin' }, { id: 'angry', label: 'Fierce' }, { id: 'raised', label: 'Raised' }];
export const EYES = [{ id: 'round', label: 'Round' }, { id: 'narrow', label: 'Narrow' }, { id: 'wide', label: 'Wide' }, { id: 'sleepy', label: 'Sleepy' }];
export const NOSES = [{ id: 'small', label: 'Small' }, { id: 'wide', label: 'Wide' }, { id: 'long', label: 'Long' }];
export const MOUTHS = [{ id: 'neutral', label: 'Neutral' }, { id: 'smile', label: 'Smile' }, { id: 'grin', label: 'Grin' }, { id: 'smirk', label: 'Smirk' }, { id: 'serious', label: 'Serious' }];
export const BEARDS = [{ id: 'none', label: 'None' }, { id: 'stubble', label: 'Stubble' }, { id: 'mustache', label: 'Mustache' }, { id: 'goatee', label: 'Goatee' }, { id: 'chinstrap', label: 'Chinstrap' }, { id: 'full', label: 'Full' }];
export const TATTOOS = [{ id: 'none', label: 'None' }, { id: 'band', label: 'Band' }, { id: 'tribal', label: 'Tribal' }, { id: 'sleeve', label: 'Sleeve' }, { id: 'stars', label: 'Stars' }, { id: 'script', label: 'Script' }, { id: 'cross', label: 'Cross' }];
export const SIDES = [{ id: 'none', label: 'None' }, { id: 'left', label: 'Left' }, { id: 'right', label: 'Right' }, { id: 'both', label: 'Both' }];
export const VISORS = [{ id: 'none', label: 'None' }, { id: 'clear', label: 'Clear' }, { id: 'dark', label: 'Smoke' }, { id: 'gold', label: 'Gold' }, { id: 'chrome', label: 'Chrome' }, { id: 'blue', label: 'Ice blue' }, { id: 'red', label: 'Red' }, { id: 'purple', label: 'Iridescent' }, { id: 'amber', label: 'Amber' }];
export const VISOR_TINTS = { clear: ['#cfe8ff', 0.35], dark: ['#111418', 0.85], gold: ['#e8b730', 0.85], chrome: ['#d9e1ea', 0.9], blue: ['#3fb6ff', 0.75], red: ['#e0302a', 0.75], purple: ['#8a4dff', 0.8], amber: ['#ff9a1f', 0.75] };
export const SPATS = [{ id: 'none', label: 'None' }, { id: 'white', label: 'White tape' }, { id: 'black', label: 'Black tape' }, { id: 'team', label: 'Team color' }];
export const TOWELS = [{ id: 'none', label: 'None' }, { id: 'white', label: 'White' }, { id: 'black', label: 'Black' }, { id: 'team', label: 'Team color' }];
export const CHAINS = [{ id: 'none', label: 'None' }, { id: 'gold', label: 'Gold' }, { id: 'silver', label: 'Silver' }, { id: 'ice', label: 'Iced out' }];
export const CELEBRATIONS = [{ id: 'pump', label: 'Fist pump' }, { id: 'dance', label: 'Dance' }, { id: 'flex', label: 'Flex' }, { id: 'flip', label: 'Backflip' }, { id: 'salute', label: 'Salute' }, { id: 'point', label: 'Point up' }];

/** Typical size by position (inches, pounds). */
export const POS_SIZE = { DT: [76, 300], QB: [75, 220], RB: [70, 212], WR: [73, 196], CB: [72, 190], TE: [77, 250], OL: [77, 312], DL: [76, 290], LB: [74, 238], S: [72, 205] };
export const HEIGHT_RANGE = [66, 80];
export const WEIGHT_RANGE = [160, 340];

export const fmtHeight = (inches) => `${Math.floor(inches / 12)}'${inches % 12}"`;
export const fmtSize = (look) => (look?.heightIn ? `${fmtHeight(look.heightIn)} · ${look.weightLb} lb` : '');

/** Width / height multipliers for the 3D body from height and weight. */
export function bodyScale(look) {
  const hIn = look.heightIn ?? 72;
  const w = look.weightLb ?? 200;
  const bmi = (703 * w) / (hIn * hIn);
  return {
    height: 0.88 + ((hIn - 66) / 14) * 0.24,
    build: Math.max(0.84, Math.min(1.42, 0.86 + (bmi - 22) * 0.032)),
  };
}

/** Starting stat nudges from body size (small, so it is mostly cosmetic). */
export function sizeStatMods(look, position) {
  const [h0, w0] = POS_SIZE[position] ?? [72, 200];
  const dh = (look.heightIn ?? h0) - h0;
  const dw = (look.weightLb ?? w0) - w0;
  const c = (v) => Math.max(-3, Math.min(3, Math.round(v)));
  return { speed: c(-dw / 14 - dh / 6), strength: c(dw / 12), skill: c(dh / 3), iq: 0 };
}

const pickR = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];
const idOf = (x) => (typeof x === 'string' ? x : x.id);

/** Seeded random generator from a string/number (mulberry32). */
export function seededRandom(seed) {
  let h = 2166136261 >>> 0;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SHIRTS = ['#e63946', '#457b9d', '#2a9d8f', '#e9c46a', '#f4a261', '#6d597a', '#3a86ff', '#ff006e', '#8ac926', '#ffffff', '#222222', '#c0c4cc'];
const PANTS = ['#264653', '#1d3557', '#3d405b', '#5c4033', '#2b2d42', '#6c757d', '#c8b38a'];

/**
 * A full random look. r: () => [0,1) or a seed string. opts: { position, gender-neutral always }.
 * Every person in the game gets one of these, so nobody looks the same.
 */
export function randomLook(r, opts = {}) {
  if (typeof r !== 'function') r = seededRandom(r);
  const skin = Math.floor(r() * SKIN_TONES.length);
  // Darker hair is more common; bright dyes are rare.
  const hc = r() < 0.06 ? 9 + Math.floor(r() * 3) : r() < 0.12 ? 8 : Math.floor(Math.pow(r(), 1.6) * 8);
  const style = pickR(r, HAIR_STYLES).id;
  const [h0, w0] = POS_SIZE[opts.position] ?? [70 + Math.floor(r() * 6), 175 + Math.floor(r() * 50)];
  const tat = () => (r() < 0.72 ? 'none' : pickR(r, TATTOOS.slice(1)).id);
  return {
    skin, hairStyle: style, hairColor: style === 'bald' ? 0 : hc, eyeColor: skin > 3 ? (r() < 0.8 ? 0 : 1) : Math.floor(r() * EYE_COLORS.length),
    eyes: pickR(r, EYES).id, brows: pickR(r, BROWS).id, nose: pickR(r, NOSES).id, mouth: pickR(r, MOUTHS).id,
    beard: r() < 0.55 ? 'none' : pickR(r, BEARDS.slice(1)).id,
    tatL: tat(), tatR: tat(),
    heightIn: Math.round(h0 + (r() - 0.5) * 4), weightLb: Math.round(w0 + (r() - 0.5) * 30),
    gloves: r() < 0.5 ? null : pickR(r, GEAR_COLORS), cleats: pickR(r, GEAR_COLORS),
    wristband: pickR(r, SIDES).id, wristColor: pickR(r, GEAR_COLORS),
    sleeve: r() < 0.6 ? 'none' : pickR(r, SIDES.slice(1)).id, sleeveColor: pickR(r, GEAR_COLORS),
    visor: r() < 0.75 ? 'none' : pickR(r, VISORS.slice(1)).id, eyeBlack: r() < 0.35,
    cleatAccent: pickR(r, GEAR_COLORS), spats: r() < 0.7 ? 'none' : pickR(r, SPATS.slice(1)).id,
    kneeBrace: r() < 0.85 ? 'none' : pickR(r, SIDES.slice(1)).id, kneeColor: r() < 0.5 ? '#16181c' : '#f2f2f2',
    legSleeve: r() < 0.8 ? 'none' : pickR(r, SIDES.slice(1)).id, legSleeveColor: pickR(r, GEAR_COLORS),
    elbowPad: r() < 0.85 ? 'none' : pickR(r, SIDES.slice(1)).id, elbowColor: pickR(r, GEAR_COLORS),
    towel: r() < 0.75 ? 'none' : pickR(r, TOWELS.slice(1)).id, handWarmer: r() < 0.12, chain: r() < 0.88 ? 'none' : pickR(r, CHAINS.slice(1)).id,
    celebration: pickR(r, CELEBRATIONS).id,
    shirt: pickR(r, SHIRTS), pants: pickR(r, PANTS), shoe: pickR(r, ['#f1f1f1', '#222222', '#c0392b', '#2f6fd6']),
  };
}

/** Starting look for a new athlete. */
export function defaultLook(position = 'QB') {
  const [h, w] = POS_SIZE[position] ?? [72, 200];
  return {
    skin: 2, hairStyle: 'short', hairColor: 2, eyeColor: 0, eyes: 'round', brows: 'normal', nose: 'small', mouth: 'smile', beard: 'none',
    tatL: 'none', tatR: 'none', heightIn: h, weightLb: w, gloves: null, cleats: '#16181c', wristband: 'none', wristColor: '#f2f2f2',
    sleeve: 'none', sleeveColor: '#16181c', visor: 'none', eyeBlack: true, celebration: 'pump',
    cleatAccent: '#f2f2f2', spats: 'none', kneeBrace: 'none', kneeColor: '#16181c', legSleeve: 'none', legSleeveColor: '#16181c',
    elbowPad: 'none', elbowColor: '#16181c', towel: 'none', handWarmer: false, chain: 'none',
    shirt: '#3a86ff', pants: '#2b2d42', shoe: '#f1f1f1',
  };
}

const SWAG_DEFAULTS = {
  cleatAccent: '#f2f2f2', spats: 'none', kneeBrace: 'none', kneeColor: '#16181c', legSleeve: 'none', legSleeveColor: '#16181c',
  elbowPad: 'none', elbowColor: '#16181c', towel: 'none', handWarmer: false, chain: 'none',
};
const OLD_STYLES = ['short', 'buzz', 'bun', 'afro'];
/** Upgrade an older save's simple look ({ skin 0-4, hair, hairStyle 0-3 }) to the full look. */
export function normalizeLook(look, seed = 'x') {
  if (!look) return randomLook(seed);
  if (typeof look.hairStyle === 'string' && look.eyes) {
    if (look.spats === undefined) return { ...SWAG_DEFAULTS, ...look };
    return look;
  }
  const base = randomLook(seed);
  const out = { ...base, ...look };
  if (typeof look.hairStyle === 'number') out.hairStyle = OLD_STYLES[look.hairStyle] ?? 'short';
  if (look.hairColor === undefined && look.hair !== undefined) out.hairColor = Math.min(7, look.hair);
  if (typeof look.skin === 'number' && look.skin <= 4 && !look.eyes) out.skin = Math.round(look.skin * 1.7);
  return out;
}

export const LOOK_IDS = { HAIR_STYLES: HAIR_STYLES.map(idOf) };
