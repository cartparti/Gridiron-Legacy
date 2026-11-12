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
  { id: 'twists', label: 'Twists' }, { id: 'cornrows', label: 'Cornrows' }, { id: 'undercut', label: 'Undercut' }, { id: 'pompadour', label: 'Pompadour' },
  { id: 'spiky', label: 'Spiky' }, { id: 'ponytail', label: 'Ponytail' }, { id: 'waves', label: 'Waves' }, { id: 'frohawk', label: 'Frohawk' }, { id: 'slick', label: 'Slicked back' },
];
export const BROWS = [{ id: 'normal', label: 'Normal' }, { id: 'thick', label: 'Thick' }, { id: 'thin', label: 'Thin' }, { id: 'angry', label: 'Fierce' }, { id: 'raised', label: 'Raised' }];
export const EYES = [{ id: 'round', label: 'Round' }, { id: 'narrow', label: 'Narrow' }, { id: 'wide', label: 'Wide' }, { id: 'sleepy', label: 'Sleepy' }];
export const NOSES = [{ id: 'small', label: 'Small' }, { id: 'wide', label: 'Wide' }, { id: 'long', label: 'Long' }];
export const MOUTHS = [{ id: 'neutral', label: 'Neutral' }, { id: 'smile', label: 'Smile' }, { id: 'grin', label: 'Grin' }, { id: 'smirk', label: 'Smirk' }, { id: 'serious', label: 'Serious' }];
export const BEARDS = [{ id: 'none', label: 'None' }, { id: 'stubble', label: 'Stubble' }, { id: 'mustache', label: 'Mustache' }, { id: 'goatee', label: 'Goatee' }, { id: 'chinstrap', label: 'Chinstrap' }, { id: 'full', label: 'Full' },
  { id: 'boxed', label: 'Boxed' }, { id: 'long', label: 'Long beard' }, { id: 'muttonchops', label: 'Mutton chops' }, { id: 'handlebar', label: 'Handlebar' }, { id: 'vandyke', label: 'Van Dyke' }, { id: 'soulpatch', label: 'Soul patch' }];
export const TATTOOS = [{ id: 'none', label: 'None' }, { id: 'band', label: 'Band' }, { id: 'tribal', label: 'Tribal' }, { id: 'sleeve', label: 'Sleeve' }, { id: 'stars', label: 'Stars' }, { id: 'script', label: 'Script' }, { id: 'cross', label: 'Cross' },
  { id: 'flames', label: 'Flames' }, { id: 'skull', label: 'Skull' }, { id: 'wings', label: 'Wings' }, { id: 'rose', label: 'Rose' }, { id: 'numbers', label: 'Numbers' }, { id: 'geo', label: 'Geometric' }, { id: 'koi', label: 'Koi' }];
export const NECK_TATTOOS = [{ id: 'none', label: 'None' }, { id: 'script', label: 'Script' }, { id: 'stars', label: 'Stars' }, { id: 'wings', label: 'Wings' }, { id: 'rose', label: 'Rose' }, { id: 'cross', label: 'Cross' }];
// ---- jersey + gear customization
export const JERSEY_SLEEVES = [{ id: 'short', label: 'Standard' }, { id: 'cutoff', label: 'Cut-off' }, { id: 'long', label: 'Long sleeves' }];
export const JERSEY_LENGTHS = [{ id: 'normal', label: 'Full' }, { id: 'crop', label: 'Cropped' }];
export const JERSEY_FITS = [{ id: 'tight', label: 'Skin tight' }, { id: 'normal', label: 'Normal' }, { id: 'loose', label: 'Loose' }];
export const PAD_SIZES = [{ id: 'small', label: 'Small' }, { id: 'normal', label: 'Normal' }, { id: 'big', label: 'Big' }];
export const PAD_EXTRAS = [{ id: 'none', label: 'None' }, { id: 'black', label: 'Black' }, { id: 'white', label: 'White' }, { id: 'team', label: 'Team' }];
export const SOCKS = [{ id: 'team', label: 'Team' }, { id: 'white', label: 'White' }, { id: 'black', label: 'Black' }, { id: 'stripes', label: 'Striped' }];
export const MOUTHGUARDS = [{ id: 'none', label: 'None' }, { id: 'clear', label: 'Clear' }, { id: 'black', label: 'Black' }, { id: 'red', label: 'Red' }, { id: 'gold', label: 'Gold' }, { id: 'team', label: 'Team' }];
export const MOUTHGUARD_COLORS = { clear: '#dfe8ee', black: '#16181c', red: '#d33a2c', gold: '#e8b730' };
export const CLEAT_DESIGNS = [{ id: 'stripe', label: 'Stripe' }, { id: 'solid', label: 'Solid' }, { id: 'twotone', label: 'Two-tone' }, { id: 'heel', label: 'Heel cap' },
  { id: 'checker', label: 'Checker' }, { id: 'flames', label: 'Flames' }, { id: 'bolt', label: 'Lightning' }, { id: 'speckle', label: 'Speckle' }];
export const CLEAT_CUTS = [{ id: 'low', label: 'Low' }, { id: 'mid', label: 'Mid' }, { id: 'high', label: 'High top' }];
export const GLOVE_DESIGNS = [{ id: 'solid', label: 'Solid' }, { id: 'palm', label: 'Two-tone palm' }, { id: 'stripe', label: 'Wrist stripe' }];
// Hair that reads as a guy's cut vs a girl's style (random people only pick from their own list).
export const MALE_HAIR = ['bald', 'buzz', 'short', 'fade', 'flattop', 'curly', 'afro', 'mohawk', 'dreads', 'braids', 'twists', 'cornrows', 'undercut', 'pompadour', 'spiky', 'waves', 'frohawk', 'slick'];
export const FEMALE_HAIR = ['long', 'long', 'bun', 'ponytail', 'ponytail', 'braids', 'curly', 'afro', 'twists', 'dreads'];
export const EARRINGS = [{ id: 'none', label: 'None' }, { id: 'studs', label: 'Studs' }, { id: 'hoops', label: 'Hoops' }, { id: 'drops', label: 'Drops' }];
export const LIP_COLORS = ['none', '#b5485d', '#c9305a', '#8e3b46', '#d97a7a', '#a0522d'];
export const HEAD_SHAPES = [{ id: 'oval', label: 'Oval' }, { id: 'round', label: 'Round' }, { id: 'square', label: 'Square jaw' }, { id: 'long', label: 'Long' }, { id: 'wide', label: 'Wide' }, { id: 'heart', label: 'Narrow chin' }];
export const JAWS = [{ id: 'defined', label: 'Defined' }, { id: 'sharp', label: 'Sharp' }, { id: 'square', label: 'Square' }, { id: 'soft', label: 'Soft' }];
export const CHEEKS = [{ id: 'normal', label: 'Normal' }, { id: 'high', label: 'High' }, { id: 'chiseled', label: 'Chiseled' }];
export const CHINS = [{ id: 'normal', label: 'Normal' }, { id: 'strong', label: 'Strong' }, { id: 'pointed', label: 'Pointed' }, { id: 'small', label: 'Small' }];
export const FACE_WIDTHS = [{ id: 'narrow', label: 'Narrow' }, { id: 'normal', label: 'Normal' }, { id: 'broad', label: 'Broad' }];
// Face sliders (-1..1) and their ends, for the Face tab's "Fine tune" section.
export const FACE_SLIDER_DEFS = [
  ['browH', 'Brow height', 'Low', 'High'], ['eyeSize', 'Eye size', 'Small', 'Big'], ['eyeSpace', 'Eye spacing', 'Close', 'Wide'],
  ['eyeTilt', 'Eye tilt', 'Down', 'Up'], ['noseW', 'Nose width', 'Narrow', 'Wide'], ['noseL', 'Nose length', 'Short', 'Long'],
  ['lips', 'Lips', 'Thin', 'Full'], ['jawW', 'Jaw width', 'Narrow', 'Wide'], ['cheekS', 'Cheekbones', 'Soft', 'Strong'],
  ['chinS', 'Chin', 'Small', 'Big'], ['neck', 'Neck', 'Slim', 'Thick'],
];
// Starting faces: a good-looking base to tweak (face only; skin, hair and beard stay yours).
export const FACE_PRESETS = [
  { id: 'classic', label: 'Classic', f: { headShape: 'oval', jaw: 'defined', cheek: 'high', chin: 'strong', faceW: 'normal', nose: 'small', eyes: 'round', brows: 'normal', fs: {} } },
  { id: 'chiseled', label: 'Leading man', f: { headShape: 'square', jaw: 'square', cheek: 'chiseled', chin: 'strong', faceW: 'normal', nose: 'long', eyes: 'narrow', brows: 'thick', fs: { cheekS: 0.4, jawW: 0.3, lips: -0.2 } } },
  { id: 'babyface', label: 'Baby face', f: { headShape: 'round', jaw: 'soft', cheek: 'normal', chin: 'small', faceW: 'normal', nose: 'small', eyes: 'wide', brows: 'thin', fs: { eyeSize: 0.4, noseL: -0.4, lips: 0.3 } } },
  { id: 'sharp', label: 'Sharp', f: { headShape: 'heart', jaw: 'sharp', cheek: 'high', chin: 'pointed', faceW: 'narrow', nose: 'small', eyes: 'narrow', brows: 'angry', fs: { eyeTilt: 0.4, cheekS: 0.3, jawW: -0.3 } } },
  { id: 'bruiser', label: 'Bruiser', f: { headShape: 'wide', jaw: 'square', cheek: 'normal', chin: 'strong', faceW: 'broad', nose: 'wide', eyes: 'sleepy', brows: 'thick', fs: { noseW: 0.4, browH: -0.4, neck: 0.8, jawW: 0.4 } } },
  { id: 'model', label: 'Model', f: { headShape: 'oval', jaw: 'sharp', cheek: 'chiseled', chin: 'normal', faceW: 'narrow', nose: 'small', eyes: 'round', brows: 'normal', fs: { cheekS: 0.6, lips: 0.4, eyeTilt: 0.2, noseW: -0.3 } } },
  { id: 'nextdoor', label: 'Next door', f: { headShape: 'oval', jaw: 'defined', cheek: 'normal', chin: 'normal', faceW: 'normal', nose: 'small', eyes: 'round', brows: 'raised', fs: { eyeSize: 0.2, lips: 0.1 } } },
  { id: 'veteran', label: 'Veteran', f: { headShape: 'long', jaw: 'defined', cheek: 'chiseled', chin: 'strong', faceW: 'normal', nose: 'long', eyes: 'narrow', brows: 'thick', fs: { browH: -0.3, noseL: 0.3, eyeSize: -0.2 } } },
  { id: 'gentle', label: 'Gentle giant', f: { headShape: 'round', jaw: 'soft', cheek: 'normal', chin: 'normal', faceW: 'broad', nose: 'wide', eyes: 'sleepy', brows: 'normal', fs: { neck: 0.6, lips: 0.3, eyeTilt: -0.3 } } },
  { id: 'intense', label: 'Intense', f: { headShape: 'square', jaw: 'defined', cheek: 'high', chin: 'strong', faceW: 'normal', nose: 'small', eyes: 'narrow', brows: 'angry', fs: { browH: -0.5, eyeSpace: -0.3, cheekS: 0.3 } } },
  { id: 'charmer', label: 'Charmer', f: { headShape: 'heart', jaw: 'defined', cheek: 'high', chin: 'normal', faceW: 'normal', nose: 'small', eyes: 'wide', brows: 'raised', fs: { eyeTilt: 0.3, lips: 0.4, eyeSize: 0.2 } } },
  { id: 'rugged', label: 'Rugged', f: { headShape: 'long', jaw: 'square', cheek: 'normal', chin: 'strong', faceW: 'broad', nose: 'wide', eyes: 'sleepy', brows: 'thick', fs: { jawW: 0.5, noseL: 0.2, chinS: 0.4 } } },
];
export const BODY_TYPES = [{ id: 'lean', label: 'Lean' }, { id: 'athletic', label: 'Athletic' }, { id: 'muscular', label: 'Muscular' }, { id: 'stocky', label: 'Stocky' }, { id: 'lanky', label: 'Lanky' }];
export const SIDES = [{ id: 'none', label: 'None' }, { id: 'left', label: 'Left' }, { id: 'right', label: 'Right' }, { id: 'both', label: 'Both' }];
export const VISORS = [{ id: 'none', label: 'None' }, { id: 'clear', label: 'Clear' }, { id: 'dark', label: 'Smoke' }, { id: 'gold', label: 'Gold' }, { id: 'chrome', label: 'Chrome' }, { id: 'blue', label: 'Ice blue' }, { id: 'red', label: 'Red' }, { id: 'purple', label: 'Iridescent' }, { id: 'amber', label: 'Amber' }];
export const VISOR_TINTS = { clear: ['#cfe8ff', 0.35], dark: ['#111418', 0.85], gold: ['#e8b730', 0.85], chrome: ['#d9e1ea', 0.9], blue: ['#3fb6ff', 0.75], red: ['#e0302a', 0.75], purple: ['#8a4dff', 0.8], amber: ['#ff9a1f', 0.75] };
export const MASKS = [{ id: 'single', label: 'Single bar' }, { id: 'two', label: 'Two-bar' }, { id: 'three', label: 'Three-bar' }, { id: 'skill', label: 'Skill' },
  { id: 'robot', label: 'Robot' }, { id: 'bull', label: 'Bull bar' }, { id: 'cage', label: 'Cage' }, { id: 'open', label: 'Open speed' }];
export const MASK_COLORS = ['#c3cad3', '#16181c', '#f4f4f4', 'team', '#e8b730', '#e9eef4', '#d33a2c', '#2f6fd6'];
export const STRIPES = [{ id: 'single', label: 'Single' }, { id: 'double', label: 'Double' }, { id: 'triple', label: 'Triple' }, { id: 'none', label: 'None' }];
export const FINISHES = [{ id: 'gloss', label: 'Gloss' }, { id: 'matte', label: 'Matte' }, { id: 'chrome', label: 'Chrome' }];
/** Typical facemask for a position. */
export const POS_MASK = { OL: ['cage', 'bull'], DL: ['cage', 'bull', 'robot'], LB: ['robot', 'bull', 'three'], TE: ['robot', 'three'], RB: ['robot', 'three', 'skill'], QB: ['two', 'three', 'skill'], WR: ['skill', 'two', 'open'], CB: ['skill', 'open', 'two'], S: ['skill', 'two', 'three'], DT: ['cage', 'bull', 'robot'], K: ['single'] };
export const SPATS = [{ id: 'none', label: 'None' }, { id: 'white', label: 'White tape' }, { id: 'black', label: 'Black tape' }, { id: 'team', label: 'Team color' }];
export const TOWELS = [{ id: 'none', label: 'None' }, { id: 'white', label: 'White' }, { id: 'black', label: 'Black' }, { id: 'team', label: 'Team color' }];
export const CHAINS = [{ id: 'none', label: 'None' }, { id: 'gold', label: 'Gold' }, { id: 'silver', label: 'Silver' }, { id: 'ice', label: 'Iced out' }];
export const CELEBRATIONS = [{ id: 'pump', label: 'Fist pump' }, { id: 'dance', label: 'Dance' }, { id: 'flex', label: 'Flex' }, { id: 'flip', label: 'Backflip' }, { id: 'salute', label: 'Salute' }, { id: 'point', label: 'Point up' }, { id: 'bow', label: 'Take a bow' }, { id: 'shuffle', label: 'Shuffle' }, { id: 'heart', label: 'Heart hands' }, { id: 'leanback', label: 'Lean back' }];

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
  // players are guys; everyone else is a guy or a girl (pass gender to choose)
  const gender = opts.gender ?? (opts.position ? 'm' : r() < 0.5 ? 'f' : 'm');
  const skin = Math.floor(r() * SKIN_TONES.length);
  // Darker hair is more common; bright dyes are rare.
  const hc = r() < 0.06 ? 9 + Math.floor(r() * 3) : r() < 0.12 ? 8 : Math.floor(Math.pow(r(), 1.6) * 8);
  const style = gender === 'f' ? FEMALE_HAIR[Math.floor(r() * FEMALE_HAIR.length)] : MALE_HAIR[Math.floor(r() * MALE_HAIR.length)];
  const [h0, w0] = POS_SIZE[opts.position] ?? [70 + Math.floor(r() * 6), 175 + Math.floor(r() * 50)];
  const tat = () => (r() < 0.72 ? 'none' : pickR(r, TATTOOS.slice(1)).id);
  return {
    skin, hairStyle: style, hairColor: style === 'bald' ? 0 : hc, eyeColor: skin > 3 ? (r() < 0.8 ? 0 : 1) : Math.floor(r() * EYE_COLORS.length),
    eyes: pickR(r, EYES).id, brows: pickR(r, BROWS).id, nose: pickR(r, NOSES).id, mouth: pickR(r, MOUTHS).id,
    beard: gender === 'f' || r() < 0.55 ? 'none' : pickR(r, BEARDS.slice(1)).id,
    gender, earrings: gender === 'f' ? pickR(r, EARRINGS.slice(1)).id : r() < 0.12 ? 'studs' : 'none',
    lips: gender === 'f' && r() < 0.75 ? pickR(r, LIP_COLORS.slice(1)) : 'none',
    dress: gender === 'f' ? pickR(r, ['#7a1f3a', '#1d3557', '#16181f', '#2f4a3a', '#c9a227', '#b5485d', '#5b2c6f']) : null,
    tatL: tat(), tatR: tat(),
    heightIn: gender === 'f' && !opts.position ? Math.round(64 + r() * 6) : Math.round(h0 + (r() - 0.5) * 4), weightLb: gender === 'f' && !opts.position ? Math.round(120 + r() * 40) : Math.round(w0 + (r() - 0.5) * 30),
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
    headShape: gender === 'f' ? pickR(r, ['oval', 'heart', 'round', 'long']) : pickR(r, HEAD_SHAPES).id,
    // everyone's face is built differently
    jaw: gender === 'f' ? pickR(r, ['defined', 'sharp', 'sharp', 'soft']) : pickR(r, ['defined', 'defined', 'sharp', 'square', 'square', 'soft']),
    cheek: pickR(r, ['normal', 'normal', 'high', 'chiseled']),
    chin: gender === 'f' ? pickR(r, ['normal', 'pointed', 'small', 'pointed']) : pickR(r, ['normal', 'strong', 'strong', 'pointed', 'small']),
    faceW: pickR(r, ['narrow', 'normal', 'normal', 'broad']), bodyType: gender === 'f' ? pickR(r, ['lean', 'athletic', 'athletic', 'stocky']) : randomBodyType(r, opts.position),
    ...randomJersey(r, opts.position), tatNeck: r() < 0.9 ? 'none' : pickR(r, NECK_TATTOOS.slice(1)).id,
    cleatDesign: pickR(r, CLEAT_DESIGNS).id, cleatCut: r() < 0.6 ? 'low' : r() < 0.75 ? 'mid' : 'high',
    gloveDesign: pickR(r, GLOVE_DESIGNS).id, gloveAccent: pickR(r, GEAR_COLORS),
    maskStyle: pickR(r, POS_MASK[opts.position] ?? MASKS.map((m) => m.id)), maskColor: r() < 0.7 ? '#c3cad3' : pickR(r, MASK_COLORS), helmetStripe: 'single', helmetFinish: 'gloss',
    shirt: pickR(r, SHIRTS), pants: pickR(r, PANTS), shoe: pickR(r, ['#f1f1f1', '#222222', '#c0392b', '#2f6fd6']),
    fs: Object.fromEntries(FACE_SLIDER_DEFS.map(([k]) => [k, Math.round((r() + r() - 1) * 7) / 10])),
  };
}

const BIG_POS = new Set(['OL', 'DL', 'DT', 'TE', 'LB']);
function randomBodyType(r, pos) {
  if (pos === 'OL' || pos === 'DL' || pos === 'DT') return r() < 0.7 ? 'stocky' : 'muscular';
  if (pos === 'LB' || pos === 'TE' || pos === 'RB') return r() < 0.55 ? 'muscular' : 'athletic';
  if (pos === 'WR' || pos === 'CB' || pos === 'S') return r() < 0.45 ? 'lean' : r() < 0.75 ? 'athletic' : 'lanky';
  return pickR(r, BODY_TYPES).id;
}
const SKILL_POS = new Set(['WR', 'CB', 'S', 'RB']);
/** Jersey style that fits the position (linemen: big pads + neck rolls, skill players: small pads, crop tops). */
function randomJersey(r, pos) {
  const big = BIG_POS.has(pos); const skill = SKILL_POS.has(pos);
  return {
    jSleeve: r() < 0.12 ? 'long' : r() < (big ? 0.25 : 0.12) ? 'cutoff' : 'short',
    jLength: skill && r() < 0.35 ? 'crop' : 'normal',
    jFit: skill ? (r() < 0.6 ? 'tight' : 'normal') : big ? (r() < 0.4 ? 'loose' : 'normal') : pickR(r, JERSEY_FITS).id,
    padSize: big ? (r() < 0.6 ? 'big' : 'normal') : skill ? (r() < 0.55 ? 'small' : 'normal') : 'normal',
    backplate: r() < (skill ? 0.3 : 0.1) ? pickR(r, PAD_EXTRAS.slice(1)).id : 'none',
    neckRoll: r() < (big ? 0.35 : pos === 'RB' ? 0.15 : 0.03) ? pickR(r, PAD_EXTRAS.slice(1)).id : 'none',
    underColor: r() < 0.5 ? '#16181c' : r() < 0.6 ? 'team' : pickR(r, GEAR_COLORS),
    sockStyle: r() < 0.6 ? 'team' : pickR(r, SOCKS).id,
    mouthguard: r() < 0.6 ? 'none' : pickR(r, MOUTHGUARDS.slice(1)).id,
  };
}

/**
 * Make a look a girl's (keeps skin, eyes and face shape; swaps hair to a girl's style, no beard, adds earrings and
 * lipstick). Used for Mom, partners and anyone saved before looks had a gender.
 */
export function feminize(look, seed = 'f') {
  const r = seededRandom(`fem:${seed}`);
  const out = { ...look, gender: 'f', beard: 'none' };
  if (!FEMALE_HAIR.includes(out.hairStyle)) out.hairStyle = FEMALE_HAIR[Math.floor(r() * FEMALE_HAIR.length)];
  if (!out.earrings || out.earrings === 'none') out.earrings = ['studs', 'hoops', 'drops'][Math.floor(r() * 3)];
  if (!out.lips || out.lips === 'none') out.lips = LIP_COLORS[1 + Math.floor(r() * (LIP_COLORS.length - 1))];
  out.dress ??= ['#7a1f3a', '#1d3557', '#16181f', '#2f4a3a', '#b5485d'][Math.floor(r() * 5)];
  if ((out.heightIn ?? 70) > 70) out.heightIn = 64 + Math.floor(r() * 6);
  if ((out.weightLb ?? 150) > 165) out.weightLb = 125 + Math.floor(r() * 35);
  if (out.bodyType === 'muscular' || out.bodyType === 'lanky') out.bodyType = 'athletic';
  if (out.headShape === 'square' || out.headShape === 'wide') out.headShape = 'oval';
  return out;
}
/** Make a look a guy's (girl-only hair styles swapped, no makeup or dress). */
export function masculinize(look, seed = 'm') {
  const r = seededRandom(`masc:${seed}`);
  const out = { ...look, gender: 'm', lips: 'none', dress: null };
  if (!MALE_HAIR.includes(out.hairStyle)) out.hairStyle = MALE_HAIR[Math.floor(r() * MALE_HAIR.length)];
  if (out.earrings && out.earrings !== 'studs') out.earrings = 'none';
  return out;
}

/** Starting look for a new athlete. */
export function defaultLook(position = 'QB') {
  const [h, w] = POS_SIZE[position] ?? [72, 200];
  return {
    skin: 2, hairStyle: 'short', hairColor: 2, eyeColor: 0, eyes: 'round', brows: 'normal', nose: 'small', mouth: 'smile', beard: 'none',
    tatL: 'none', tatR: 'none', heightIn: h, weightLb: w, gloves: null, cleats: '#16181c', wristband: 'none', wristColor: '#f2f2f2',
    sleeve: 'none', sleeveColor: '#16181c', visor: 'none', eyeBlack: true, celebration: 'pump',
    cleatAccent: '#f2f2f2', spats: 'none', kneeBrace: 'none', kneeColor: '#16181c', legSleeve: 'none', legSleeveColor: '#16181c',
    elbowPad: 'none', elbowColor: '#16181c', towel: 'none', handWarmer: false, chain: 'none', suit: '#16181f', tie: '#c92a2a',
    maskStyle: (POS_MASK[position] ?? ['three'])[0], maskColor: '#c3cad3', helmetStripe: 'single', helmetFinish: 'gloss',
    shirt: '#3a86ff', pants: '#2b2d42', shoe: '#f1f1f1',
    ...JERSEY_DEFAULTS, jaw: 'defined', cheek: 'high', chin: 'strong', faceW: 'normal',
  };
}

/** New customization fields (older saves get these). */
export const JERSEY_DEFAULTS = {
  headShape: 'oval', bodyType: 'athletic', gender: 'm', earrings: 'none', lips: 'none',
  jSleeve: 'short', jLength: 'normal', jFit: 'normal', padSize: 'normal', backplate: 'none', neckRoll: 'none', underColor: '#16181c',
  sockStyle: 'team', mouthguard: 'none', tatNeck: 'none', cleatDesign: 'stripe', cleatCut: 'low', gloveDesign: 'solid', gloveAccent: '#f2f2f2',
};

const SWAG_DEFAULTS = {
  cleatAccent: '#f2f2f2', spats: 'none', kneeBrace: 'none', kneeColor: '#16181c', legSleeve: 'none', legSleeveColor: '#16181c',
  elbowPad: 'none', elbowColor: '#16181c', towel: 'none', handWarmer: false, chain: 'none', suit: '#16181f', tie: '#c92a2a',
  maskStyle: 'three', maskColor: '#c3cad3', helmetStripe: 'single', helmetFinish: 'gloss',
};
const OLD_STYLES = ['short', 'buzz', 'bun', 'afro'];
/** Upgrade an older save's simple look ({ skin 0-4, hair, hairStyle 0-3 }) to the full look. */
export function normalizeLook(look, seed = 'x') {
  if (!look) return randomLook(seed);
  if (typeof look.hairStyle === 'string' && look.eyes) {
    if (look.spats === undefined || look.suit === undefined || look.maskStyle === undefined) return { ...SWAG_DEFAULTS, ...JERSEY_DEFAULTS, ...look };
    if (look.jSleeve === undefined) return { ...JERSEY_DEFAULTS, ...look };
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
