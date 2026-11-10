// Team & city identity: where the stadium is (biome), its name and nickname, traditions, home-field
// traits, field paint and fan culture. Everything is derived from the team (stable, no save data needed).
import { seededRandom } from './looks.js';

const BIOMES = [
  ['swamp', /saltmarsh|bayou|marsh/i],
  ['snow', /northwind|frost|silverpine|stormcliff|glacier/i],
  ['coast', /bay|harbor|shore|point|crescent|palm|lake|cove|port|beach|rapids/i],
  ['desert', /mesa|dune|canyon|copper|sunspire|gold|vista|sand|ember/i],
  ['mountain', /pine|granite|ridge|falls|kestrel|summit|peak|thunder/i],
  ['city', /steel|iron|brass|neon|westgate|lincoln|metro|city|haven/i],
  ['plains', /.*/],
];

export const BIOME_INFO = {
  coast: { label: 'Coastal', desc: 'Ocean breeze, gulls and a harbor full of boats.' },
  desert: { label: 'Desert', desc: 'Red rock mesas and blazing sunsets.' },
  mountain: { label: 'Mountain', desc: 'Pine forests and peaks on the horizon.' },
  snow: { label: 'Northern', desc: 'Snowy pines and frozen hills.' },
  city: { label: 'Big City', desc: 'A skyline of towers right outside the gates.' },
  plains: { label: 'Small Town', desc: 'Farm fields, silos and water towers.' },
  swamp: { label: 'Bayou', desc: 'Cypress trees and steamy wetlands.' },
};

export function biomeFor(team) {
  const key = `${team.city} ${team.name} ${team.town ?? ''}`;
  return BIOMES.find(([, re]) => re.test(key))[0];
}

const pick = (r, a) => a[Math.floor(r() * a.length) % a.length];

const STADIUM_NAMES = {
  hs: ['{town} Memorial Field', '{town} High Stadium', '{name} Field', 'Veterans Field', 'The {name} Den', 'Coach {coach} Field'],
  college: ['{city} Stadium', '{name} Bowl', 'Memorial Coliseum', '{city} Field House', 'The {name} Grounds', 'University Field'],
  pro: ['{brand} Field', '{brand} Dome', '{city} Arena', 'The {brand} Center', '{brand} Park', '{city} Coliseum'],
};
const NICKNAMES = {
  coast: ['The Dock', 'The Tank', 'The Shoreline', 'The Lighthouse'], desert: ['The Furnace', 'The Oven', 'The Canyon', 'The Kiln'],
  mountain: ['The Peak', 'The Summit', 'The Rockpile', 'The Ridge'], snow: ['The Icebox', 'The Tundra', 'The Igloo', 'The Freezer'],
  city: ['The Concrete Jungle', 'The Factory', 'The Grid', 'The Steel Yard'], plains: ['The Barn', 'The Pasture', 'The Silo', 'Friday Field'],
  swamp: ['The Swamp', 'The Bog', 'The Bayou', 'The Marsh'],
};
const BRANDS = ['Voltade', 'Ironclad', 'Fizz Cola', 'Turbo Tires', 'Bolt Energy', 'Summit Bank', 'Nova Air', 'Crest Mobile'];
const COACHES = ['Hargrove', 'Whitley', 'Pruitt', 'Delgado', 'Okafor', 'Brennan'];

const TRADITIONS = {
  hs: ['The whole town closes shop by 6pm on game nights.', 'Seniors burst through a paper banner made by the art club.', 'Tailgate barbecue behind the bleachers before every game.', 'The band plays the fight song from the back of a pickup truck.', 'Parents ring cowbells on every third down.', 'Students paint the rock by the parking lot every week.'],
  college: ['Players slap the lucky horseshoe hanging in the tunnel.', 'The marching band forms the team crest at midfield.', 'Students ring the victory bell after every win.', 'A live mascot leads the team out of the tunnel.', 'The whole stadium sways and sings the alma mater after the 3rd quarter.', 'Fans throw rolls of streamers after the first touchdown.'],
  pro: ['60,000 fans do the Thunder Clap before kickoff.', 'Everyone waves rally towels on third down.', 'A franchise legend sounds the giant horn.', 'A cannon fires after every home touchdown.', 'The drumline marches through the parking lot before warmups.', 'Fans chant the defense\'s nickname on every stop.'],
};
const BIOME_TRADITION = {
  coast: 'A foghorn blasts from the harbor after touchdowns.', desert: 'Kickoff is timed to the sunset, the whole stadium glows orange.',
  mountain: 'Fans ring bells that echo off the peaks.', snow: 'Shirtless superfans sit in the front row no matter the cold.',
  city: 'Fireworks go off from the rooftops downtown after wins.', plains: 'A tractor parade circles the field at halftime.',
  swamp: 'Fans swear the humidity is worth a touchdown.',
};

/** Home-field traits: small, real effects for the visiting team. */
export const TRAITS = {
  loud: { label: 'Loud House', desc: 'Visitors can barely hear the snap count.', awayTol: 0.96 },
  altitude: { label: 'Thin Air', desc: 'Visitors get winded faster up here.', awayDrain: 1.5 },
  heat: { label: 'Furnace Heat', desc: 'Blazing heat saps visiting players.', awayDrain: 1, awayTol: 0.98 },
  cold: { label: 'Frozen Tundra', desc: 'Cold hands, slippery ball for visitors.', awayTol: 0.97 },
  humid: { label: 'Steam Bath', desc: 'Thick humid air wears visitors down.', awayDrain: 1.2 },
  wind: { label: 'Wind Tunnel', desc: 'Swirling winds off the water confuse visiting passers.', awayTol: 0.97 },
  intimate: { label: 'Close Quarters', desc: 'Fans right on top of the field. Momentum swings hard.', momentum: 1.3 },
};
const BIOME_TRAIT = { coast: 'wind', desert: 'heat', mountain: 'altitude', snow: 'cold', city: 'loud', plains: 'intimate', swamp: 'humid' };

const TURFS = [['#2f6f35', '#377b3a'], ['#2f6f35', '#377b3a'], ['#2f6f35', '#377b3a'], ['#2c6a3e', '#33774a'], ['#1f4f9c', '#2a5fb0'], ['#7a1f2b', '#8c2834'], ['#1c1d22', '#26272e'], ['#4a2a7a', '#56338a']];
const PATTERNS = ['stripes', 'diagonal', 'checker', 'solid', 'diamond'];
const CROWD_LOOKS = ['normal', 'normal', 'normal', 'whiteout', 'colorrush', 'blackout'];
const SONGS = ['hype', 'charge', 'groove', 'anthem'];

/** Full identity for a team at a level. */
export function teamCulture(team, level = 'pro') {
  const r = seededRandom(`culture:${team.id}`);
  const biome = biomeFor(team);
  const tokens = { town: team.town ?? team.city, city: team.city, name: team.name, brand: pick(r, BRANDS), coach: pick(r, COACHES) };
  const fill = (s) => s.replace(/\{(\w+)\}/g, (_, k) => tokens[k] ?? '');
  const traitId = r() < 0.7 ? BIOME_TRAIT[biome] : pick(r, Object.keys(TRAITS));
  // special turf only for a few teams (and more often in college), green otherwise
  const turf = r() < (level === 'college' ? 0.2 : 0.08) ? TURFS[4 + Math.floor(r() * 4)] : TURFS[Math.floor(r() * 4)];
  return {
    biome,
    stadium: fill(pick(r, STADIUM_NAMES[level] ?? STADIUM_NAMES.pro)),
    nickname: pick(r, NICKNAMES[biome]),
    tradition: r() < 0.4 ? BIOME_TRADITION[biome] : pick(r, TRADITIONS[level] ?? TRADITIONS.pro),
    traitId,
    trait: TRAITS[traitId],
    turf,
    pattern: pick(r, PATTERNS),
    crowd: level === 'hs' ? 'normal' : pick(r, CROWD_LOOKS),
    song: pick(r, SONGS),
    seed: Math.floor(r() * 1e9),
  };
}
