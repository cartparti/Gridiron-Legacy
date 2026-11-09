// All teams are fictional. Colors are [primary, secondary].
// `base` is a rough strength from 0-99 that the league generator jitters each season.

export const PRO_TEAMS = [
  // Summit Conference
  { id: 'IRV', city: 'Ironvale', name: 'Forge', colors: ['#8a2b0f', '#f2a541'], conf: 'Summit', div: 'North', base: 74 },
  { id: 'HBC', city: 'Harbor City', name: 'Krakens', colors: ['#0b3954', '#2ec4b6'], conf: 'Summit', div: 'North', base: 78 },
  { id: 'RMS', city: 'Red Mesa', name: 'Scorpions', colors: ['#b5121b', '#f5d547'], conf: 'Summit', div: 'North', base: 70 },
  { id: 'CBY', city: 'Cobalt Bay', name: 'Squalls', colors: ['#1f4e9c', '#e8eef7'], conf: 'Summit', div: 'North', base: 66 },
  { id: 'GFG', city: 'Granite Falls', name: 'Grizzlies', colors: ['#4a3b2a', '#d9a441'], conf: 'Summit', div: 'North', base: 72 },
  { id: 'NWF', city: 'Northwind', name: 'Frost', colors: ['#5b8fc7', '#f4f9ff'], conf: 'Summit', div: 'Central', base: 69 },
  { id: 'SPW', city: 'Silverpine', name: 'Wolves', colors: ['#4d5d53', '#c9ccce'], conf: 'Summit', div: 'Central', base: 75 },
  { id: 'KPT', city: 'Kestrel Point', name: 'Talons', colors: ['#5b2a86', '#f2c14e'], conf: 'Summit', div: 'Central', base: 80 },
  { id: 'BRP', city: 'Brassport', name: 'Engineers', colors: ['#b08d57', '#222222'], conf: 'Summit', div: 'Central', base: 64 },
  { id: 'TRS', city: 'Thunder Ridge', name: 'Stallions', colors: ['#222831', '#ffd369'], conf: 'Summit', div: 'Central', base: 77 },
  { id: 'LKH', city: 'Lakeshore', name: 'Herons', colors: ['#2a9d8f', '#e9c46a'], conf: 'Summit', div: 'South', base: 68 },
  { id: 'CPM', city: 'Copperton', name: 'Miners', colors: ['#b87333', '#1d3557'], conf: 'Summit', div: 'South', base: 71 },
  { id: 'EMF', city: 'Emberfield', name: 'Firebirds', colors: ['#e85d04', '#370617'], conf: 'Summit', div: 'South', base: 76 },
  { id: 'STH', city: 'Steelhaven', name: 'Sentinels', colors: ['#3d405b', '#e07a5f'], conf: 'Summit', div: 'South', base: 73 },
  { id: 'PCR', city: 'Pinecrest', name: 'Rangers', colors: ['#2d6a4f', '#f1faee'], conf: 'Summit', div: 'South', base: 63 },
  // Coastal Conference
  { id: 'SUN', city: 'Sunspire', name: 'Solar', colors: ['#ffb703', '#023047'], conf: 'Coastal', div: 'North', base: 79 },
  { id: 'DCJ', city: 'Dune City', name: 'Jackals', colors: ['#c9a227', '#5c4033'], conf: 'Coastal', div: 'North', base: 67 },
  { id: 'BVP', city: 'Bayview', name: 'Pelicans', colors: ['#00a6a6', '#f49d37'], conf: 'Coastal', div: 'North', base: 70 },
  { id: 'MBP', city: 'Midnight Bay', name: 'Phantoms', colors: ['#14213d', '#fca311'], conf: 'Coastal', div: 'North', base: 81 },
  { id: 'RBR', city: 'Riverbend', name: 'Rapids', colors: ['#0077b6', '#90e0ef'], conf: 'Coastal', div: 'North', base: 65 },
  { id: 'CCC', city: 'Crescent City', name: 'Corsairs', colors: ['#6a040f', '#d4af37'], conf: 'Coastal', div: 'Central', base: 76 },
  { id: 'PSC', city: 'Palm Shores', name: 'Cyclones', colors: ['#1b998b', '#ed217c'], conf: 'Coastal', div: 'Central', base: 72 },
  { id: 'GFP', city: 'Goldfield', name: 'Prospectors', colors: ['#d4a017', '#2b2d42'], conf: 'Coastal', div: 'Central', base: 69 },
  { id: 'VVC', city: 'Vista Verde', name: 'Condors', colors: ['#386641', '#f2e8cf'], conf: 'Coastal', div: 'Central', base: 66 },
  { id: 'SCB', city: 'Stormcliff', name: 'Breakers', colors: ['#3a506b', '#5bc0be'], conf: 'Coastal', div: 'Central', base: 74 },
  { id: 'CSC', city: 'Canyon Springs', name: 'Coyotes', colors: ['#a44a3f', '#f6e27f'], conf: 'Coastal', div: 'South', base: 71 },
  { id: 'WGM', city: 'Westgate', name: 'Monarchs', colors: ['#4b0082', '#e0aaff'], conf: 'Coastal', div: 'South', base: 77 },
  { id: 'SMC', city: 'Saltmarsh', name: 'Crocs', colors: ['#3a5a40', '#a3b18a'], conf: 'Coastal', div: 'South', base: 62 },
  { id: 'NVV', city: 'Neon Valley', name: 'Voltage', colors: ['#7209b7', '#4cc9f0'], conf: 'Coastal', div: 'South', base: 73 },
  { id: 'HPB', city: 'Highplains', name: 'Bison', colors: ['#432818', '#bb9457'], conf: 'Coastal', div: 'South', base: 68 },
];

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
