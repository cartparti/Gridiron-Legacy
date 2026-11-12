// All teams are fictional. Colors are [primary, secondary].
// `base` is a rough strength from 0-99 that the league generator jitters each season.

// Pro league (v0.42): 20 teams in five divisions of four, in real cities with original names. Each team has its own
// mascot glyph, colors, hand-picked uniform (`kit` overrides teamIdentity in kits.js), stadium scenery (`biome` +
// `landmarks`, see environment.js) and home-field edge (`trait`, see culture.js).
export const PRO_DIVISIONS = ['Northwest', 'Southwest', 'Northeast', 'Southeast', 'Heartland'];
const P = (id, city, name, colors, div, base, extra) => ({ id, city, name, colors, div, base, conf: null, ...extra });
export const PRO_TEAMS = [
  // Northwest: mountains, fog, rain forests
  P('SLC', 'Salt Lake', 'Trappers', ['#4e3220', '#15110d'], 'Northwest', 72, { glyph: 'coonskin', accent: '#d8b98a', biome: 'mountain', landmarks: ['saltflat', 'temple', 'cabins'], trait: 'altitude',
    // mountain men: leather brown and black, buckskin numbers, fringed yoke, matte leather helmet, coonskin cap logo
    kit: { pattern: 'fringe', font: 'serif', stripe: 'wide', finish: 'matte', mask: 'dark', sleeve: 0, pants: 'single', collar: 'round', chestLogo: true, logo: 'glyph' } }),
  P('SFO', 'San Francisco', 'Sea Lions', ['#a3232c', '#c9ced6'], 'Northwest', 77, { glyph: 'sea', biome: 'coast', landmarks: ['bridge', 'hills'], trait: 'wind',
    kit: { pattern: 'tvStripe', font: 'varsity', stripe: 'double', finish: 'gloss', mask: 'gray', sleeve: 2, pants: 'double', collar: 'round', chestLogo: false, logo: 'glyph' } }),
  P('SEA', 'Seattle', 'Sasquatch', ['#1f4d3a', '#8fb3d1'], 'Northwest', 75, { glyph: 'bear', biome: 'mountain', landmarks: ['needle', 'skyline', 'volcano'], trait: 'loud',
    kit: { pattern: 'fade', font: 'rounded', stripe: 'single', finish: 'matte', mask: 'dark', sleeve: 0, pants: 'single', collar: 'v', chestLogo: true, logo: 'glyph' } }),
  P('POR', 'Portland', 'Lumberjacks', ['#b3282d', '#1c1c1c'], 'Northwest', 66, { glyph: 'axe', biome: 'snow', landmarks: ['volcano', 'bridges'], trait: 'intimate',
    kit: { pattern: 'plaid', font: 'serif', stripe: 'none', finish: 'matte', mask: 'dark', sleeve: 0, pants: 'none', collar: 'round', chestLogo: false, logo: 'glyph' } }),
  // Southwest: beaches, desert and neon
  P('LAX', 'Los Angeles', 'Comets', ['#4a2a86', '#ff8a3d'], 'Southwest', 79, { glyph: 'star', biome: 'coast', landmarks: ['skyline', 'hills', 'palms'], trait: 'loud',
    kit: { pattern: 'chestBand', font: 'italic', stripe: 'tri', finish: 'metallic', mask: 'trim', sleeve: 2, pants: 'tri', collar: 'v', chestLogo: false, logo: 'glyph' } }),
  P('PHX', 'Phoenix', 'Infernos', ['#d9531e', '#3a1a12'], 'Southwest', 70, { glyph: 'flame', biome: 'desert', landmarks: ['saguaro', 'skyline'], trait: 'heat',
    kit: { pattern: 'flames', font: 'italic', stripe: 'single', finish: 'satin', mask: 'dark', sleeve: 0, pants: 'single', collar: 'v', chestLogo: true, logo: 'glyph' } }),
  P('DAL', 'Dallas', 'Stampede', ['#7a1c24', '#e8d3a6'], 'Southwest', 76, { glyph: 'horse', biome: 'plains', landmarks: ['skyline', 'orb'], trait: 'heat',
    kit: { pattern: 'yoke', font: 'serif', stripe: 'triple', finish: 'matte', mask: 'white', sleeve: 3, pants: 'double', collar: 'v', chestLogo: false, logo: 'glyph' } }),
  P('LVG', 'Las Vegas', 'Scorpions', ['#14141a', '#ff2ea6'], 'Southwest', 68, { glyph: 'scorpion', biome: 'desert', landmarks: ['strip', 'pyramid'], trait: 'loud',
    kit: { pattern: 'sidePanels', font: 'stencil', stripe: 'none', finish: 'chrome', mask: 'trim', sleeve: 0, pants: 'single', collar: 'v', chestLogo: true, logo: 'glyph' } }),
  // Northeast: big skylines
  P('NYC', 'New York', 'Empire', ['#1b1d24', '#d4af37'], 'Northeast', 80, { glyph: 'crown', biome: 'city', landmarks: ['skyline', 'spire', 'river'], trait: 'loud',
    kit: { pattern: 'pinstripe', font: 'serif', stripe: 'single', finish: 'gloss', mask: 'dark', sleeve: 0, pants: 'single', collar: 'round', chestLogo: true, logo: 'glyph' } }),
  P('CHI', 'Chicago', 'Gales', ['#1d2d44', '#e63946'], 'Northeast', 74, { glyph: 'storm', biome: 'city', landmarks: ['skyline', 'supertall', 'lake'], trait: 'wind',
    kit: { pattern: 'shoulders', font: 'block', stripe: 'double', finish: 'gloss', mask: 'gray', sleeve: 2, pants: 'double', collar: 'v', chestLogo: false, logo: 'glyph' } }),
  P('WDC', 'Washington', 'Sentinels', ['#2f4b7c', '#e8e6df'], 'Northeast', 69, { glyph: 'shield', biome: 'city', landmarks: ['obelisk', 'dome', 'river'], trait: 'intimate',
    kit: { pattern: 'stars', font: 'varsity', stripe: 'tri', finish: 'satin', mask: 'white', sleeve: 2, pants: 'tri', collar: 'v', chestLogo: false, logo: 'letter', letter: 'W' } }),
  P('DET', 'Detroit', 'Gearheads', ['#4f5963', '#ff7a00'], 'Northeast', 65, { glyph: 'gear', biome: 'city', landmarks: ['skyline', 'towers', 'river'], trait: 'cold',
    kit: { pattern: 'shoulders', font: 'stencil', stripe: 'wide', finish: 'metallic', mask: 'trim', sleeve: 1, pants: 'single', collar: 'round', chestLogo: true, logo: 'glyph' } }),
  // Southeast: beaches, bayous and music
  P('MIA', 'Miami', 'Flamingos', ['#ff5fa2', '#13b5b1'], 'Southeast', 73, { glyph: 'bird', biome: 'coast', landmarks: ['deco', 'palms', 'skyline'], trait: 'humid',
    kit: { pattern: 'fade', font: 'rounded', stripe: 'tri', finish: 'gloss', mask: 'white', sleeve: 2, pants: 'tri', collar: 'v', chestLogo: false, logo: 'glyph' } }),
  P('NOL', 'New Orleans', 'Gators', ['#4b2a7b', '#e6b422'], 'Southeast', 71, { glyph: 'gator', biome: 'swamp', landmarks: ['skyline', 'superdome', 'river'], trait: 'humid',
    kit: { pattern: 'yoke', font: 'varsity', stripe: 'double', finish: 'metallic', mask: 'trim', sleeve: 3, pants: 'double', collar: 'v', chestLogo: true, logo: 'glyph' } }),
  P('CLT', 'Charlotte', 'Copperheads', ['#0e3b43', '#c0743a'], 'Southeast', 67, { glyph: 'snake', biome: 'mountain', landmarks: ['skyline', 'speedway'], trait: 'loud',
    kit: { pattern: 'scales', font: 'italic', stripe: 'single', finish: 'satin', mask: 'trim', sleeve: 0, pants: 'single', collar: 'round', chestLogo: false, logo: 'glyph' } }),
  P('NSH', 'Nashville', 'Outlaws', ['#22324f', '#d29a3a'], 'Southeast', 70, { glyph: 'skull', biome: 'plains', landmarks: ['skyline', 'twinspire', 'river'], trait: 'intimate',
    kit: { pattern: 'yoke', font: 'serif', stripe: 'double', finish: 'matte', mask: 'gray', sleeve: 2, pants: 'double', collar: 'v', chestLogo: true, logo: 'glyph' } }),
  // Heartland (the middle of the map): the Rockies, the plains, the lakes and the river
  P('DEN', 'Denver', 'Pumas', ['#10223e', '#6cb4e4'], 'Heartland', 74, { glyph: 'cat', biome: 'mountain', landmarks: ['skyline', 'rockies'], trait: 'altitude',
    kit: { pattern: 'claws', font: 'block', stripe: 'single', finish: 'gloss', mask: 'gray', sleeve: 2, pants: 'single', collar: 'v', chestLogo: false, logo: 'glyph' } }),
  P('KCY', 'Kansas City', 'Bison', ['#5a3a22', '#e3b448'], 'Heartland', 72, { glyph: 'bison', biome: 'plains', landmarks: ['skyline', 'fountains'], trait: 'loud',
    kit: { pattern: 'shoulders', font: 'varsity', stripe: 'triple', finish: 'matte', mask: 'white', sleeve: 3, pants: 'tri', collar: 'round', chestLogo: true, logo: 'glyph' } }),
  P('MSP', 'Minneapolis', 'Frostwolves', ['#3e6c9a', '#eef5fb'], 'Heartland', 69, { glyph: 'wolf', biome: 'snow', landmarks: ['skyline', 'lakes'], trait: 'cold',
    kit: { pattern: 'sidePanels', font: 'rounded', stripe: 'wide', finish: 'satin', mask: 'white', sleeve: 2, pants: 'single', collar: 'v', chestLogo: false, logo: 'glyph' } }),
  P('STL', 'St. Louis', 'Riverhawks', ['#1b6f7a', '#c9452f'], 'Heartland', 68, { glyph: 'bird', biome: 'city', landmarks: ['arch', 'river'], trait: 'intimate',
    kit: { pattern: 'tvStripe', font: 'serif', stripe: 'double', finish: 'gloss', mask: 'gray', sleeve: 2, pants: 'double', collar: 'round', chestLogo: true, logo: 'glyph' } }),
];
const PRO_BY_ID = new Map(PRO_TEAMS.map((t) => [t.id, t]));
/** The built-in pro team definition for an id (glyph, biome, landmarks, kit...), or null for other teams. */
export const proTeamDef = (id) => PRO_BY_ID.get(id) ?? null;

// 32 colleges in 4 conferences. prestige 1-5 drives recruiting interest and program strength.
const C = (id, city, name, colors, conf, prestige) => ({ id, city, name, colors, conf, prestige, base: 52 + prestige * 5 + ((id.charCodeAt(0) + id.charCodeAt(2)) % 7) - 3 });
export const COLLEGE_TEAMS = [
  // Heartland Conference
  C('NRS', 'Northridge State', 'Owls', ['#283618', '#dda15e'], 'Heartland', 4),
  C('BEL', 'Bellmont', 'Cardinals', ['#9d0208', '#f8f9fa'], 'Heartland', 5),
  C('LKT', 'Lakeland Tech', 'Engineers', ['#003049', '#fcbf49'], 'Heartland', 2),
  C('ASH', 'Ashford', 'Foxes', ['#bc4b51', '#f4e285'], 'Heartland', 2),
  C('MAR', 'Marston', 'Knights', ['#22223b', '#c9ada7'], 'Heartland', 4),
  C('RAM', 'Redwood A&M', 'Lumberjacks', ['#7f4f24', '#99d98c'], 'Heartland', 2),
  C('BFS', 'Brookfield State', 'Bulldogs', ['#495057', '#e63946'], 'Heartland', 1),
  C('IHB', 'Iron Hills', 'Bighorns', ['#5f0f40', '#fb8b24'], 'Heartland', 1),
  // Pacific Rim Conference
  C('PAC', 'Pacifica', 'Swells', ['#0096c7', '#ffd166'], 'Pacific Rim', 4),
  C('SVS', 'Sierra Vista State', 'Pumas', ['#6b4226', '#e9d8a6'], 'Pacific Rim', 3),
  C('CPU', 'Coastal Plains', 'Gulls', ['#118ab2', '#ffffff'], 'Pacific Rim', 3),
  C('GLU', 'Golden Lake', 'Miners', ['#b5838d', '#ffcb69'], 'Pacific Rim', 5),
  C('SBU', 'Summit Bay', 'Sea Lions', ['#023e8a', '#90e0ef'], 'Pacific Rim', 3),
  C('DVC', 'Desert Valley', 'Roadrunners', ['#d00000', '#ffba08'], 'Pacific Rim', 2),
  C('OKS', 'Oak Shore', 'Otters', ['#386641', '#a7c957'], 'Pacific Rim', 1),
  C('CNU', 'Canyon', 'Condors', ['#9c6644', '#ede0d4'], 'Pacific Rim', 2),
  // Atlantic Conference
  C('HVU', 'Highland Valley', 'Hawks', ['#3c096c', '#ff9e00'], 'Atlantic', 3),
  C('KNG', 'Kingsport', 'Royals', ['#240046', '#e0aaff'], 'Atlantic', 5),
  C('BWU', 'Bay Water', 'Mariners', ['#14213d', '#fca311'], 'Atlantic', 4),
  C('NEC', 'New Easton', 'Colonials', ['#1d3557', '#e63946'], 'Atlantic', 3),
  C('HRS', 'Harbor State', 'Anchors', ['#0b525b', '#e0e1dd'], 'Atlantic', 2),
  C('MTV', 'Mount Vernon Tech', 'Rockets', ['#6c757d', '#ff006e'], 'Atlantic', 2),
  C('CHU', 'Chesterfield', 'Chargers', ['#03045e', '#00b4d8'], 'Atlantic', 1),
  C('WSF', 'Westford', 'Wolves', ['#212529', '#adb5bd'], 'Atlantic', 3),
  // Southern Plains Conference
  C('TXU', 'Tall Grass', 'Stampede', ['#9a031e', '#fb8b24'], 'Southern Plains', 5),
  C('RVS', 'River State', 'Gators', ['#2d6a4f', '#ffd60a'], 'Southern Plains', 4),
  C('MDS', 'Meadow Springs', 'Mustangs', ['#7b2cbf', '#ffffff'], 'Southern Plains', 2),
  C('PLU', 'Pine Lake', 'Panthers', ['#000000', '#ffd166'], 'Southern Plains', 3),
  C('BYU', 'Bayou', 'Herons', ['#004b23', '#ccff33'], 'Southern Plains', 3),
  C('CLS', 'Clay Springs', 'Hornets', ['#ffb703', '#023047'], 'Southern Plains', 1),
  C('SLU', 'Sunland', 'Suns', ['#f77f00', '#003049'], 'Southern Plains', 4),
  C('RGC', 'Red Gulch', 'Rattlers', ['#6a040f', '#e9d8a6'], 'Southern Plains', 2),
];
export const COLLEGE_CONFS = ['Heartland', 'Pacific Rim', 'Atlantic', 'Southern Plains'];

// High schools grouped by city: 2-3 schools per town. Crosstown schools are natural rivals.
export const CITIES = [
  { name: 'Westfield', schools: [
    { id: 'WFW', city: 'Westfield North', name: 'Wildcats', colors: ['#1d3557', '#f1c40f'], base: 62 },
    { id: 'WFS', city: 'Westfield South', name: 'Stallions', colors: ['#6a040f', '#ffffff'], base: 57 },
  ] },
  { name: 'Oak Hollow', schools: [
    { id: 'OHE', city: 'Oak Hollow', name: 'Eagles', colors: ['#2b9348', '#ffffff'], base: 58 },
    { id: 'OHC', city: 'Oak Hollow Central', name: 'Comets', colors: ['#3a0ca3', '#f72585'], base: 55 },
    { id: 'OHP', city: 'Oak Hollow Prep', name: 'Lions', colors: ['#8d6a3a', '#111111'], base: 63 },
  ] },
  { name: 'Lincoln Park', schools: [
    { id: 'LPP', city: 'Lincoln Park', name: 'Panthers', colors: ['#111111', '#ff595e'], base: 66 },
    { id: 'LPE', city: 'Lincoln Park East', name: 'Hurricanes', colors: ['#0077b6', '#caf0f8'], base: 54 },
  ] },
  { name: 'Bayside', schools: [
    { id: 'BSM', city: 'Bayside', name: 'Mustangs', colors: ['#3a86ff', '#ff006e'], base: 60 },
    { id: 'BSH', city: 'Bayside Harbor', name: 'Pirates', colors: ['#000000', '#e5e5e5'], base: 53 },
    { id: 'BSC', city: 'Bayside Catholic', name: 'Crusaders', colors: ['#7f1d1d', '#fbbf24'], base: 61 },
  ] },
  { name: 'Mill Creek', schools: [
    { id: 'MCB', city: 'Mill Creek', name: 'Bobcats', colors: ['#bc6c25', '#fefae0'], base: 50 },
    { id: 'MCV', city: 'Mill Creek Valley', name: 'Vikings', colors: ['#2d3142', '#bfc0c0'], base: 56 },
  ] },
  { name: 'Southlake', schools: [
    { id: 'SLS', city: 'Southlake', name: 'Sharks', colors: ['#0a9396', '#e9d8a6'], base: 61 },
    { id: 'SLR', city: 'Southlake Ridge', name: 'Rams', colors: ['#5a189a', '#ffd60a'], base: 58 },
  ] },
];
export const HS_TEAMS = CITIES.flatMap((c) => c.schools.map((s) => ({ ...s, town: c.name })));
export const HOMETOWN_NAMES = CITIES.map((c) => c.name);

export const teamFullName = (t) => `${t.city} ${t.name}`;
