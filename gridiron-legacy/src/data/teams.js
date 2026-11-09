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

export const COLLEGE_TEAMS = [
  { id: 'NRS', city: 'Northridge State', name: 'Owls', colors: ['#283618', '#dda15e'], base: 72, prestige: 4 },
  { id: 'BEL', city: 'Bellmont', name: 'Cardinals', colors: ['#9d0208', '#f8f9fa'], base: 78, prestige: 5 },
  { id: 'LKT', city: 'Lakeland Tech', name: 'Engineers', colors: ['#003049', '#fcbf49'], base: 64, prestige: 2 },
  { id: 'ASH', city: 'Ashford', name: 'Foxes', colors: ['#bc4b51', '#f4e285'], base: 60, prestige: 2 },
  { id: 'CPU', city: 'Coastal Plains', name: 'Gulls', colors: ['#118ab2', '#ffffff'], base: 66, prestige: 3 },
  { id: 'SVS', city: 'Sierra Vista State', name: 'Pumas', colors: ['#6b4226', '#e9d8a6'], base: 70, prestige: 3 },
  { id: 'MAR', city: 'Marston', name: 'Knights', colors: ['#22223b', '#c9ada7'], base: 75, prestige: 4 },
  { id: 'RAM', city: 'Redwood A&M', name: 'Lumberjacks', colors: ['#7f4f24', '#99d98c'], base: 62, prestige: 2 },
  { id: 'HVU', city: 'Highland Valley', name: 'Hawks', colors: ['#3c096c', '#ff9e00'], base: 68, prestige: 3 },
  { id: 'BFS', city: 'Brookfield State', name: 'Bulldogs', colors: ['#495057', '#e63946'], base: 58, prestige: 1 },
  { id: 'PAC', city: 'Pacifica', name: 'Swells', colors: ['#0096c7', '#ffd166'], base: 74, prestige: 4 },
  { id: 'IHB', city: 'Iron Hills', name: 'Bighorns', colors: ['#5f0f40', '#fb8b24'], base: 56, prestige: 1 },
];

export const HS_TEAMS = [
  { id: 'WFW', city: 'Westfield', name: 'Wildcats', colors: ['#1d3557', '#f1c40f'], base: 62 },
  { id: 'OHE', city: 'Oak Hollow', name: 'Eagles', colors: ['#2b9348', '#ffffff'], base: 58 },
  { id: 'LPP', city: 'Lincoln Park', name: 'Panthers', colors: ['#111111', '#ff595e'], base: 66 },
  { id: 'CGH', city: 'Cedar Grove', name: 'Hornets', colors: ['#ffca3a', '#1b1b1b'], base: 55 },
  { id: 'BSM', city: 'Bayside', name: 'Mustangs', colors: ['#3a86ff', '#ff006e'], base: 60 },
  { id: 'PVP', city: 'Pine Valley', name: 'Pioneers', colors: ['#6a994e', '#f2e8cf'], base: 52 },
  { id: 'EVS', city: 'Eastview', name: 'Spartans', colors: ['#7b2cbf', '#e0aaff'], base: 64 },
  { id: 'MCB', city: 'Mill Creek', name: 'Bobcats', colors: ['#bc6c25', '#fefae0'], base: 50 },
  { id: 'NPN', city: 'North Point', name: 'Navigators', colors: ['#003566', '#ffc300'], base: 57 },
  { id: 'SLS', city: 'Southlake', name: 'Sharks', colors: ['#0a9396', '#e9d8a6'], base: 61 },
];

export const teamFullName = (t) => `${t.city} ${t.name}`;
