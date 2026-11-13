// The player's athlete: overall rating, training and aging.
import { POSITIONS, STAT_KEYS, BACKGROUNDS } from '../data/positions.js';
import { PERKS } from '../data/lifestyle.js';
import { itemTrainBonus } from './shop.js';
import { clamp } from '../core/util.js';
import { gauss, randRange } from '../core/rng.js';
import { sizeStatMods } from '../data/looks.js';

/** Weighted average of the four stats using the position's weights. */
export function calcOverall(stats, pos) {
  const w = POSITIONS[pos].weights;
  let total = 0;
  for (const k of STAT_KEYS) total += stats[k] * w[k];
  return clamp(total, 0, 99);
}

export function refreshOverall(p) {
  p.ovr = calcOverall(p.stats, p.position);
  return p.ovr;
}

export function createAthlete(state, opts) {
  const bg = BACKGROUNDS.find((b) => b.id === opts.background) ?? BACKGROUNDS[0];
  const stats = {};
  const mods = opts.look ? sizeStatMods(opts.look, opts.position) : {};
  for (const k of STAT_KEYS) stats[k] = clamp(43 + bg.stats[k] + (mods[k] ?? 0) + gauss(state, 0, 2), 30, 60);
  const p = {
    first: opts.first,
    last: opts.last,
    position: opts.position,
    number: opts.number,
    look: opts.look ?? null,
    hometown: opts.hometown,
    background: bg.id,
    age: 16,
    stats,
    potential: clamp(randRange(state, 0.8, 1.18), 0.8, 1.25), // hidden growth multiplier
    health: 100,
    mood: 70,
    fame: 2,
    money: 300,
    academics: 72,
    rel: { coach: 50, teammates: 50, family: 70, partner: null, agent: null, rival: 30 },
    partnerName: null,
    agentName: null,
    rivalName: opts.rivalName,
    coachName: opts.coachName,
    injury: null,
    suspended: 0,
    housing: 'parents',
    car: 'none',
    perks: [],
    items: {},
    inventory: {},
    investments: {},
    sponsors: [],
    business: null,
    contract: null,
    flags: {},
    seasonStats: null,
    careerStats: emptyStats(),
    proCareerStats: emptyStats(),
    history: [],
    awards: [],
    titles: [],
    records: [],
    ovr: 0,
  };
  refreshOverall(p);
  return p;
}

export function emptyStats() {
  return {
    games: 0, wins: 0,
    passAtt: 0, passComp: 0, passYds: 0, passTD: 0, int: 0, sacks: 0,
    rushAtt: 0, rushYds: 0, rushTD: 0, fumbles: 0,
    targets: 0, rec: 0, recYds: 0, recTD: 0, drops: 0,
    tackles: 0, defInt: 0, pd: 0, defTD: 0, defSacks: 0, tfl: 0, tgtAgainst: 0, recAllowed: 0, ydsAllowed: 0, tdAllowed: 0,
    hype: 0, shirts: 0, danceWins: 0, stunts: 0, // mascot
    fgAtt: 0, fgMade: 0, fgLong: 0, xpAtt: 0, xpMade: 0, kickoffs: 0, touchbacks: 0, onsideRec: 0, gameWinners: 0, // kicker
    grades: 0, // sum of game grades (average = grades / games)
    clutch: 0,
  };
}

export function addStats(into, from) {
  // "long" stats (longest field goal) keep the best, everything else adds up
  for (const k of Object.keys(from)) into[k] = k.endsWith('Long') ? Math.max(into[k] ?? 0, from[k] ?? 0) : (into[k] ?? 0) + from[k];
}

function perkTrainBonus(p, stat) {
  let b = 0;
  for (const id of p.perks) {
    const perk = PERKS.find((x) => x.id === id);
    if (perk?.bonus?.train?.[stat]) b += perk.bonus.train[stat];
  }
  return b;
}

/**
 * Turn "training units" into a real stat gain. Young, high-potential, happy
 * players with room to grow improve fastest. Gains shrink near the top.
 */
export function trainingGain(p, stat, units) {
  const cur = p.stats[stat];
  const ageF = p.age <= 18 ? 1.25 : p.age <= 22 ? 1.1 : p.age <= 26 ? 0.95 : p.age <= 29 ? 0.7 : 0.45;
  const moodF = 0.7 + (p.mood / 100) * 0.5;
  const room = clamp((100 - cur) / 50, 0.04, 1.3);
  const perk = 1 + perkTrainBonus(p, stat) + itemTrainBonus(p, stat);
  return units * 0.4 * ageF * p.potential * moodF * room * perk;
}

export function applyTraining(p, train) {
  const gains = {};
  for (const [stat, units] of Object.entries(train)) {
    const g = units >= 0 ? trainingGain(p, stat, units) : units;
    p.stats[stat] = clamp(p.stats[stat] + g, 20, 99);
    gains[stat] = g;
  }
  refreshOverall(p);
  return gains;
}

/** End-of-season natural growth or decline by age. Returns per-stat change. */
export function ageProgression(state) {
  const p = state.player;
  const a = p.age;
  let base;
  // Running backs take the most hits and age about two years faster.
  const a2 = p.position === 'RB' ? a + 2 : a;
  if (a <= 17) base = { speed: 1.6, skill: 1.6, iq: 1.4, strength: 1.9 };
  else if (a <= 20) base = { speed: 1.0, skill: 1.2, iq: 1.2, strength: 1.2 };
  else if (a2 <= 23) base = { speed: 0.3, skill: 0.6, iq: 0.8, strength: 0.6 };
  else if (a2 <= 26) base = { speed: -0.3, skill: 0.2, iq: 0.5, strength: 0.1 };
  else if (a2 <= 29) base = { speed: -1.3, skill: -0.3, iq: 0.3, strength: -0.6 };
  else if (a2 <= 31) base = { speed: -2.6, skill: -1.0, iq: 0.1, strength: -1.5 };
  else base = { speed: -3.8, skill: -2.0, iq: -0.3, strength: -2.5 };
  const changes = {};
  for (const k of STAT_KEYS) {
    let d = base[k];
    d = d > 0 ? d * p.potential : d;
    d += gauss(state, 0, 0.5);
    p.stats[k] = clamp(p.stats[k] + d, 20, 99);
    changes[k] = d;
  }
  refreshOverall(p);
  return changes;
}
