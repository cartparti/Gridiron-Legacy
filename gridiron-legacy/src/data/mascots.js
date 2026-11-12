import { proTeamDef } from './teams.js';
// Mascot glyphs (16x16 masks: '#' = mascot color, 'o' = dark detail, '+' = highlight, '.' = empty), picked from the
// team name. Used by the menu crests and the helmet / jersey logos.
export const GLYPHS = {
  coonskin: [
    '................', '................', '.....######.....', '....########....', '...##+#######...', '...#+########...',
    '..############..', '..############..', '.oooooooooooooo.', '.##############.', '...........##...', '...........oo...',
    '...........##...', '...........oo...', '...........##...', '............o...'],
  axe: [
    '................', '..........oo....', '....######oo....', '...#######oo....', '..########oo....', '..##+#####oo....',
    '..########oo....', '...#######oo....', '....######oo....', '..........oo....', '..........oo....', '..........oo....',
    '..........oo....', '..........oo....', '.........oooo...', '................'],
  star: [
    '................', '.......##.......', '.......##.......', '......####......', '......####......', '.##############.',
    '..############..', '...##########...', '....###++###....', '....########....', '...####..####...', '...###....###...',
    '..###......###..', '..##........##..', '.#............#.', '................'],
  gear: [
    '................', '......#..#......', '....#.####.#....', '...##########...', '....###oo###....', '..###oooooo###..',
    '..##oo....oo##..', '.###o......o###.', '.###o......o###.', '..##oo....oo##..', '..###oooooo###..', '....###oo###....',
    '...##########...', '....#.####.#....', '......#..#......', '................'],
  gator: [
    '................', '................', '..###...........', '.#o###..........', '.######.........', '.##############.',
    '.###############', '.+.+.+.+.+.+.+..', '..+.+.+.+.+.+.+.', '.###############', '.##############.', '..############..',
    '................', '................', '................', '................'],
  snake: [
    '................', '.......####.....', '......######....', '......#o##o#....', '......######....', '.......####.....',
    '........##......', '...#######......', '..########......', '..##............', '..##########....', '...##########...',
    '............##..', '..###########...', '.###########....', '................'],
  cat: [
    '................', '..#.........#...', '..##.......##...', '..###.....###...', '..###########...', '.#############..',
    '.###o#####o###..', '.###oo###oo###..', '.#############..', '..#####o#####...', '..####ooo####...', '...####o####....',
    '....#######.....', '.....#####......', '................', '................'],
  wolf: [
    '................', '.#............#.', '.##..........##.', '.###........###.', '.####......####.', '..############..',
    '..##o######o##..', '..###########...', '...#########....', '....#######.....', '.....#####......', '.....##o##......',
    '......###.......', '.......#........', '................', '................'],
  bird: [
    '................', '.....######.....', '...##########...', '..####o#######..', '..############++', '.#############++',
    '.###########+++.', '.##########++...', '..#########.....', '..########......', '...######.......', '...#####........',
    '....###.........', '....##..........', '................', '................'],
  horse: [
    '................', '.......##.......', '......####......', '.....######.....', '....###o####....', '...##########...',
    '...###########..', '....##########..', '.....#....#####.', '..........#####.', '.........######.', '........#######.',
    '.......########.', '................', '................', '................'],
  bear: [
    '................', '..###......###..', '..#+#......#+#..', '..##########.#..', '.##############.', '.###o######o###.',
    '.##############.', '.#####++++#####.', '.####+oooo+####.', '..####++++####..', '...##########...', '....########....',
    '................', '................', '................', '................'],
  bison: [
    '................', '+..............+', '++............++', '.++..........++.', '..+##########+..', '..############..',
    '.##o########o##.', '.##############.', '..############..', '...##########...', '....#++++++#....', '....#+oo+o+#....',
    '.....######.....', '................', '................', '................'],
  sea: [
    '................', '.......#........', '......##........', '.....###........', '....####........', '...#####........',
    '..######........', '.########.......', '##########......', '................', '+.++.++.++.++.++', '.++.++.++.++.++.',
    '................', '+.++.++.++.++.++', '.++.++.++.++.++.', '................'],
  scorpion: [
    '................', '..........###...', '............##..', '.............#..', '............##..', '..#.......###...',
    '.##.....###.....', '.#..#######.....', '...#########....', '..##o#####o##...', '..###########...', '.#.#.#.#.#.#.#..',
    '#.#.#.#.#.#.#.#.', '................', '................', '................'],
  storm: [
    '................', '.........####...', '........####....', '.......####.....', '......####......', '.....#########..',
    '....#########...', '.......####.....', '......####......', '.....####.......', '....####........', '...###..........',
    '..##............', '.#..............', '................', '................'],
  flame: [
    '................', '.......#........', '......##........', '......###.......', '.....####.#.....', '....######.#....',
    '....#######.....', '...####++###....', '...###++++###...', '..###++++++##...', '..##+++oo+++#...', '..##++oooo++#...',
    '...#++oooo++....', '....########....', '................', '................'],
  skull: [
    '................', '....########....', '...##########...', '..############..', '..############..', '..##oo####oo##..',
    '..##oo####oo##..', '..############..', '...#####o####...', '....########....', '....#.#.#.#.#...', '....########....',
    '................', '#..............#', '.##..........##.', '...##......##...'],
  shield: [
    '.......##.......', '.......##.......', '..############..', '..#++++##++++#..', '..#+++####+++#..', '..#++++##++++#..',
    '..#++++##++++#..', '...#+++##+++#...', '...#+++##+++#...', '....#++##++#....', '.....#+##+#.....', '......####......',
    '.......##.......', '.......##.......', '......####......', '................'],
  crown: [
    '................', '................', '.#.....#.....#..', '.##...###...##..', '.###.#####.###..', '.#############..',
    '.#############..', '.##+##+##+##+#..', '.#############..', '.#############..', '................', '................',
    '................', '................', '................', '................'],
};

export const KEYWORDS = [
  ['horse', /stallion|mustang|bronco|colt/i], // before cat: "Stallions" contains "lion"
  ['cat', /wildcat|lion|panther|bobcat|tiger|cougar/i],
  ['wolf', /wol|jackal|coyote|fox|dog/i],
  ['bird', /talon|heron|firebird|condor|eagle|pelican|hawk|falcon|raven/i],
  ['bear', /grizzl|bear/i],
  ['bison', /bison|ram|bull/i],
  ['sea', /kraken|shark|croc|rapid|breaker|marlin|wave/i],
  ['scorpion', /scorpion|hornet|bee/i],
  ['storm', /squall|cyclone|hurricane|voltage|frost|thunder|bolt|storm/i],
  ['flame', /forge|solar|comet|blaze|fire|flame|sun/i],
  ['skull', /pirate|corsair|phantom|raider/i],
  ['crown', /monarch|king|royal/i],
  ['shield', /.*/],
];

export function mascotKind(team) {
  const fixed = team.glyph ?? proTeamDef(team.id)?.glyph; // built-in pro teams pick their own
  if (fixed && GLYPHS[fixed]) return fixed;
  return KEYWORDS.find(([, re]) => re.test(team.name))?.[0] ?? 'shield';
}

// ------------------------------------------------------------------ the mascot player's costume
export const COSTUME_ANIMALS = [
  { id: 'team', label: 'Team mascot' }, { id: 'bear', label: 'Bear' }, { id: 'wolf', label: 'Wolf' }, { id: 'cat', label: 'Big cat' },
  { id: 'bird', label: 'Bird' }, { id: 'horse', label: 'Horse' }, { id: 'bison', label: 'Bison' }, { id: 'gator', label: 'Gator' },
  { id: 'snake', label: 'Snake' }, { id: 'scorpion', label: 'Scorpion' }, { id: 'sea', label: 'Shark' }, { id: 'flame', label: 'Fireball' },
  { id: 'storm', label: 'Lightning' }, { id: 'skull', label: 'Skull' }, { id: 'coonskin', label: 'Mountain man' }, { id: 'axe', label: 'Lumberjack' },
  { id: 'gear', label: 'Robot' }, { id: 'star', label: 'Star' }, { id: 'crown', label: 'Royal' }, { id: 'shield', label: 'Knight' },
];
export const COSTUME_FURS = [
  { id: 'team', label: 'Team colors' }, { id: 'swap', label: 'Team colors, swapped' },
  { id: 'brown', label: 'Brown', fur: ['#7a4a2a', '#e8c9a0'] }, { id: 'grey', label: 'Grey', fur: ['#7d848c', '#f1f3f5'] },
  { id: 'black', label: 'Black', fur: ['#1e2126', '#c9ced6'] }, { id: 'white', label: 'Snow', fur: ['#f1f3f5', '#4dabf7'] },
  { id: 'gold', label: 'Gold', fur: ['#e8b730', '#7a4a10'] }, { id: 'green', label: 'Green', fur: ['#2f9e44', '#d8f5a2'] },
  { id: 'purple', label: 'Purple', fur: ['#6741d9', '#ffd43b'] }, { id: 'pink', label: 'Pink', fur: ['#f06595', '#ffffff'] },
  { id: 'red', label: 'Red', fur: ['#c92a2a', '#ffe066'] }, { id: 'blue', label: 'Blue', fur: ['#1c7ed6', '#ffffff'] },
];
export const COSTUME_EYES = [{ id: 'googly', label: 'Googly' }, { id: 'angry', label: 'Fierce' }, { id: 'sleepy', label: 'Sleepy' }, { id: 'star', label: 'Star-struck' }, { id: 'hearts', label: 'Hearts' }, { id: 'shades', label: 'Shades' }];
export const COSTUME_MOUTHS = [{ id: 'grin', label: 'Big grin' }, { id: 'fangs', label: 'Fangs' }, { id: 'tongue', label: 'Tongue out' }, { id: 'o', label: 'Surprised' }, { id: 'smirk', label: 'Smirk' }, { id: 'mustache', label: 'Mustache' }];
export const COSTUME_HATS = [{ id: 'none', label: 'None' }, { id: 'cap', label: 'Ball cap' }, { id: 'crown', label: 'Crown' }, { id: 'tophat', label: 'Top hat' }, { id: 'headband', label: 'Headband' }, { id: 'propeller', label: 'Propeller' }, { id: 'viking', label: 'Viking' }, { id: 'chef', label: 'Chef' }];
export const COSTUME_EXTRAS = [{ id: 'none', label: 'None' }, { id: 'cape', label: 'Cape' }, { id: 'bowtie', label: 'Bow tie' }, { id: 'chain', label: 'Gold chain' }, { id: 'finger', label: 'Foam finger' }, { id: 'scarf', label: 'Scarf' }, { id: 'tutu', label: 'Tutu' }];
export const COSTUME_SHOES = ['#f4f4f4', '#16181c', '#e63946', '#ffd43b', '#3a86ff', '#2a9d8f', '#ff006e', '#f4a261'];
export const COSTUME_DEFAULTS = { kind: 'team', fur: 'team', eyes: 'googly', mouth: 'grin', hat: 'none', extra: 'none', shoes: '#f4f4f4', shoesBig: false, name: '' };
const NAME_A = ['Sir', 'Big', 'Captain', 'Lil', 'Mighty', 'Professor', 'Sergeant', 'King', 'Baron', 'Uncle'];
const NAME_B = ['Growls', 'Fuzzy', 'Bounce', 'Rumble', 'Stomp', 'Whiskers', 'Chomp', 'Fluff', 'Thunder', 'Hoot', 'Snout', 'Wiggles'];
/** A goofy default mascot name, stable for a seed string. */
export function mascotName(seed = 'x') {
  let hsh = 0; for (const ch of String(seed)) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
  return `${NAME_A[hsh % NAME_A.length]} ${NAME_B[(hsh >> 5) % NAME_B.length]}`;
}
/** The costume with every field filled in. */
export const costumeOf = (look) => ({ ...COSTUME_DEFAULTS, ...(look?.costume ?? {}) });
/** What to build: { kind, colors, costume } for makeMascot, given your team's mascot kind and colors. */
export function costumeSpec(look, teamKind = 'bear', teamColors = ['#1d3557', '#f1c40f']) {
  const c = costumeOf(look);
  const fur = COSTUME_FURS.find((f) => f.id === c.fur)?.fur ?? (c.fur === 'swap' ? 'swap' : 'team');
  return { kind: c.kind === 'team' ? teamKind : c.kind, colors: teamColors, costume: { ...c, fur } };
}
/** The name on the costume (yours, or a goofy default). */
export const mascotDisplayName = (p) => costumeOf(p?.look).name || mascotName(`${p?.first ?? ''}${p?.last ?? ''}`);
