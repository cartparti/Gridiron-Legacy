// Your real hometown: type any town name and it gets two high schools (yours + the crosstown rival) with
// mascots and colors picked from the name. Stable: the same name always makes the same schools.
import { seededRandom } from './looks.js';

// name hints -> mascot pools (every mascot maps to a crest glyph in ui/crest.js)
const HINTS = [
  [/bay|harbor|harbour|beach|port|shore|cove|lake|sea|ocean|island|marina|coast/i, ['Sharks', 'Pirates', 'Pelicans', 'Marlins', 'Breakers', 'Waves']],
  [/hill|mount|mt\.?|ridge|peak|summit|cliff|rock|stone|highland/i, ['Rams', 'Eagles', 'Bears', 'Falcons', 'Grizzlies']],
  [/spring|falls|river|creek|brook|rapids|water|ford/i, ['Rapids', 'Herons', 'Hawks', 'Bobcats', 'Foxes']],
  [/wood|forest|oak|pine|grove|cedar|elm|maple|timber|birch/i, ['Wolves', 'Bears', 'Ravens', 'Panthers', 'Grizzlies']],
  [/field|farm|plain|prairie|valley|meadow|acre|ranch|dale/i, ['Mustangs', 'Bulldogs', 'Broncos', 'Bison', 'Stallions']],
  [/fort|camp|guard|liberty|union|independ/i, ['Knights', 'Titans', 'Raiders', 'Royals']],
  [/north|snow|frost|winter|ice|glacier|polar/i, ['Wolves', 'Coyotes', 'Thunder', 'Bears']],
  [/sun|desert|mesa|sand|dune|canyon|solar|gold|copper/i, ['Scorpions', 'Coyotes', 'Blaze', 'Comets', 'Hornets']],
  [/storm|wind|thunder|cloud|sky/i, ['Thunder', 'Cyclones', 'Hurricanes', 'Storm']],
  [/king|queen|royal|crown|prince|castle/i, ['Royals', 'Kings', 'Knights']],
  [/ville|town|burg|city|ton$|ham$|port/i, ['Wildcats', 'Tigers', 'Lions', 'Bulldogs', 'Titans', 'Knights']],
];
const ANY = ['Wildcats', 'Tigers', 'Panthers', 'Cougars', 'Eagles', 'Hawks', 'Falcons', 'Wolves', 'Bulldogs', 'Mustangs', 'Broncos',
  'Bears', 'Rams', 'Hornets', 'Cyclones', 'Comets', 'Raiders', 'Knights', 'Titans', 'Lions', 'Stallions', 'Sharks', 'Thunder'];
const PALETTE = [
  ['#1d3557', '#f1c40f'], ['#6a040f', '#ffffff'], ['#2b9348', '#ffffff'], ['#3a0ca3', '#f72585'], ['#111111', '#ff595e'],
  ['#0077b6', '#caf0f8'], ['#7f1d1d', '#fbbf24'], ['#bc6c25', '#fefae0'], ['#2d3142', '#bfc0c0'], ['#0a9396', '#e9d8a6'],
  ['#5a189a', '#ffd60a'], ['#e85d04', '#111111'], ['#003049', '#d62828'], ['#14532d', '#facc15'], ['#1e3a8a', '#e5e7eb'],
  ['#9d0208', '#f4a261'], ['#4c1d95', '#a3e635'], ['#0f766e', '#f8fafc'], ['#b91c1c', '#1f2937'], ['#ca8a04', '#1c1917'],
];
const SECOND = ['Central', 'East', 'West', 'North', 'South', 'Catholic', 'Prep', 'Valley', 'Heights', 'Memorial'];

/** Clean up what was typed: trimmed, title case, max 18 characters. */
export function cleanTown(raw) {
  return String(raw ?? '').replace(/[^\p{L}\p{N} .'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 18)
    .replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

/** Two schools for a typed hometown. Ids are stable and never clash with the built-in schools. */
export function hometownSchools(rawTown) {
  const town = cleanTown(rawTown) || 'Hometown';
  const r = seededRandom(`town:${town.toLowerCase()}`);
  const pick = (a) => a[Math.floor(r() * a.length) % a.length];
  const pools = HINTS.filter(([re]) => re.test(town)).map(([, list]) => list);
  const pool = pools.length ? [...new Set(pools.flat())] : ANY;
  const m1 = pick(pool);
  let m2 = pick(ANY);
  for (let i = 0; i < 8 && m2 === m1; i++) m2 = pick(ANY);
  const c1 = pick(PALETTE);
  let c2 = pick(PALETTE);
  for (let i = 0; i < 8 && c2 === c1; i++) c2 = pick(PALETTE);
  const flip = r() < 0.3;
  const code = town.replace(/[^A-Za-z]/g, '').toUpperCase().padEnd(3, 'X').slice(0, 3);
  return [
    { id: `H${code}1`, city: town, name: m1, colors: flip ? [c1[1], c1[0]] : c1.slice(), base: 56 + Math.floor(r() * 9), town },
    { id: `H${code}2`, city: `${town} ${pick(SECOND)}`, name: m2, colors: c2.slice(), base: 52 + Math.floor(r() * 11), town },
  ];
}
