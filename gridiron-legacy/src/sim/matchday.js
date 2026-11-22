// Game-day extras around the core game sim (pure, no DOM):
//   coin toss   - call it, then receive or defer; decides who gets the ball first in each half
//   in the zone - a hot streak of great moments makes the next ones easier until you cool off
//   challenges  - one bonus goal per game (XP + fame, a little money in the pros)
//   primetime   - the big night games: under the lights, more fame
import { clamp } from '../core/util.js';
import { rand, chance, pick } from '../core/rng.js';
import { addXp } from './progress.js';

const other = (s) => (s === 'home' ? 'away' : 'home');

// ---------------------------------------------------------------- coin toss

/**
 * Put the drives in order so `firstSide` has the ball first in the first half and the other team first after
 * halftime. Quarters and clocks stay where they were (they belong to the slot, not the drive).
 */
export function setPossessionOrder(g, firstSide) {
  const slots = g.drives.map((d) => ({ quarter: d.quarter, clock: d.clock }));
  for (let i = 0; i + 1 < g.drives.length; i += 2) {
    const firstHalf = slots[i].quarter <= 2;
    const want = firstHalf ? firstSide : other(firstSide);
    if (g.drives[i].side !== want && g.drives[i + 1].side === want) [g.drives[i], g.drives[i + 1]] = [g.drives[i + 1], g.drives[i]];
  }
  g.drives.forEach((d, i) => { d.quarter = slots[i].quarter; d.clock = slots[i].clock; });
}

/** Flip the coin. call: 'heads' | 'tails'. Returns g.toss { call, side, won, choice?, firstSide? }. */
export function tossCoin(state, call) {
  const g = state.game;
  if (!g || g.toss?.side) return g?.toss;
  const side = rand(state) < 0.5 ? 'heads' : 'tails';
  const won = side === call;
  g.toss = { call, side, won };
  if (!won) tossChoice(state, chance(state, 0.7) ? 'defer' : 'receive', { ai: true });
  return g.toss;
}

/** The winner picks: 'receive' (ball first) or 'defer' (ball first after halftime). */
export function tossChoice(state, choice, { ai = false } = {}) {
  const g = state.game;
  if (!g?.toss || g.toss.choice) return g?.toss;
  const winner = g.toss.won && !ai ? g.userSide : other(g.userSide);
  const firstSide = choice === 'receive' ? winner : other(winner);
  g.toss.choice = choice;
  g.toss.firstSide = firstSide;
  setPossessionOrder(g, firstSide);
  if (g.toss.won) g.momentum = clamp((g.momentum ?? 0) + 0.05, -1, 1);
  const youFirst = firstSide === (g.momentSide ?? g.userSide);
  g.toss.text = `${g.toss.won ? 'You won the toss' : 'They won the toss'} (${g.toss.side}) and chose to ${choice}. ${firstSide === g.userSide ? 'Your team gets' : 'They get'} the ball first.`;
  g.toss.youFirst = youFirst;
  return g.toss;
}

/** Nobody called it (sim / bot / skipped): flip it for them. */
export function autoToss(state) {
  const g = state.game;
  if (!g || g.toss?.choice) return;
  tossCoin(state, rand(state) < 0.5 ? 'heads' : 'tails');
  if (!g.toss.choice) tossChoice(state, chance(state, 0.6) ? 'defer' : 'receive');
}

// ---------------------------------------------------------------- in the zone

export const ZONE_AT = 3; // great moments in a row to get in the zone
export const ZONE_TOL = 1.08;

/** After every moment you played: build or break the streak. Returns 'in' | 'out' | null (what changed). */
export function zoneAfterMoment(state, q) {
  const g = state.game;
  if (!g) return null;
  g.streak ??= 0;
  const was = !!g.zone;
  if (q >= 0.7) g.streak++;
  else if (q < 0.45) g.streak = 0;
  else g.streak = Math.max(0, g.streak - 1);
  if (!was && g.streak >= ZONE_AT) { g.zone = true; g.zoneCount = (g.zoneCount ?? 0) + 1; return 'in'; }
  if (was && q < 0.45) { g.zone = false; return 'out'; }
  return null;
}

// ---------------------------------------------------------------- game challenges

const big = (g, n) => g.moments.filter((m) => !m.defense && (m.yards ?? 0) >= n).length;
const won = (g) => g.score[g.userSide] > g.score[other(g.userSide)];
const margin = (g) => g.score[g.userSide] - g.score[other(g.userSide)];
const bestQ = (g) => Math.max(0, ...g.moments.map((m) => m.quality ?? 0));
const allQ = (g, n) => g.moments.length > 0 && g.moments.every((m) => (m.quality ?? 0) >= n);

// id, label, positions ('*' = any), check(g, s) -> bool
export const CHALLENGES = [
  { id: 'win', label: 'Win the game', pos: '*', check: (g) => won(g) },
  { id: 'win10', label: 'Win by 10 or more', pos: '*', check: (g) => margin(g) >= 10 },
  { id: 'gradeA', label: 'Earn an A game grade', pos: '*', check: (g) => (g.grade ?? 0) >= 85 },
  { id: 'zone', label: 'Get in the zone (3 great plays in a row)', pos: '*', check: (g) => (g.zoneCount ?? 0) > 0 },
  { id: 'clean', label: 'Every key moment graded B or better', pos: '*', check: (g) => allQ(g, 0.62) },
  { id: 'perfect', label: 'Nail one play perfectly (A+)', pos: '*', check: (g) => bestQ(g) >= 0.92 },
  { id: 'td', label: 'Score a touchdown', pos: ['QB', 'RB', 'WR'], check: (g, s) => s.passTD + s.rushTD + s.recTD > 0 },
  { id: 'td2', label: 'Two touchdowns', pos: ['QB', 'RB', 'WR'], check: (g, s) => s.passTD + s.rushTD + s.recTD >= 2 },
  { id: 'big20', label: 'Make a 20+ yard play', pos: ['QB', 'RB', 'WR'], check: (g) => big(g, 20) > 0 },
  { id: 'noTO', label: 'No turnovers', pos: ['QB', 'RB', 'WR'], check: (g, s) => !g.moments.some((m) => m.turnover && !m.defense) && s.int + s.fumbles === 0 },
  { id: 'qb200', label: '200 passing yards', pos: ['QB'], check: (g, s) => s.passYds >= 200 },
  { id: 'qbpct', label: 'Complete 70% of your passes', pos: ['QB'], check: (g, s) => s.passAtt >= 6 && s.passComp / s.passAtt >= 0.7 },
  { id: 'rb100', label: '100 rushing yards', pos: ['RB'], check: (g, s) => s.rushYds >= 100 },
  { id: 'rb5', label: 'Average 5+ yards a carry', pos: ['RB'], check: (g, s) => s.rushAtt >= 6 && s.rushYds / s.rushAtt >= 5 },
  { id: 'wr100', label: '100 receiving yards', pos: ['WR'], check: (g, s) => s.recYds >= 100 },
  { id: 'wr6', label: 'Six catches', pos: ['WR'], check: (g, s) => s.rec >= 6 },
  { id: 'nodrop', label: 'No drops', pos: ['WR'], check: (g, s) => s.targets >= 3 && s.drops === 0 },
  { id: 'pick', label: 'Get your hands on the ball (INT or 2 breakups)', pos: ['CB'], check: (g, s) => s.defInt > 0 || s.pd >= 2 },
  { id: 'lock', label: 'Allow 40 yards or less', pos: ['CB'], check: (g, s) => s.ydsAllowed <= 40 },
  { id: 'notd', label: 'Give up no touchdowns', pos: ['CB'], check: (g, s) => s.tdAllowed === 0 },
  { id: 'cb5', label: 'Five tackles', pos: ['CB', 'DT'], check: (g, s) => s.tackles >= 5 },
  { id: 'sack', label: 'Get a sack', pos: ['DT'], check: (g, s) => (s.defSacks ?? 0) >= 1 },
  { id: 'tfl2', label: 'Two tackles for loss', pos: ['DT'], check: (g, s) => (s.tfl ?? 0) >= 2 },
  { id: 'fgall', label: 'Make every kick', pos: ['K'], check: (g, s) => s.fgAtt + s.xpAtt > 0 && s.fgMade === s.fgAtt && s.xpMade === s.xpAtt },
  { id: 'fg45', label: 'Make a 45+ yard field goal', pos: ['K'], check: (g, s) => (s.fgLong ?? 0) >= 45 },
  { id: 'tb2', label: 'Two touchbacks', pos: ['K'], check: (g, s) => (s.touchbacks ?? 0) >= 2 },
  { id: 'hype70', label: 'Crowd hype 70+', pos: ['MS'], check: (g, s) => (s.hype ?? 0) >= 70 },
  { id: 'dance', label: 'Win the mascot showdown', pos: ['MS'], check: (g, s) => (s.danceWins ?? 0) >= 1 },
];
export const CHALLENGE_BY_ID = Object.fromEntries(CHALLENGES.map((c) => [c.id, c]));

const fits = (c, pos) => c.pos === '*' || c.pos.includes(pos);

/** Pick this game's challenge (createUserGame). Position goals are picked twice as often as general ones. */
export function pickChallenge(state, g) {
  if (g.sitOut) return null;
  const pos = state.player.position;
  const pool = CHALLENGES.filter((c) => fits(c, pos) && !(state.player.depth?.role === 'backup' && ['qb200', 'rb100', 'wr100', 'td2', 'win10'].includes(c.id)));
  const weighted = pool.flatMap((c) => (c.pos === '*' ? [c] : [c, c]));
  const recent = state.recentChallenges ?? [];
  const fresh = weighted.filter((c) => !recent.includes(c.id));
  const c = pick(state, fresh.length ? fresh : weighted);
  state.recentChallenges = [c.id, ...recent].slice(0, 4);
  const stage = state.career.stage;
  return { id: c.id, label: c.label, reward: { xp: stage === 'pro' ? 40 : 30, fame: 1, money: stage === 'pro' ? 25000 : 0 }, done: null };
}

/** Postgame: did you do it? Pays out. */
export function resolveChallenge(state, g) {
  const ch = g.challenge;
  if (!ch || ch.done !== null || g.sitOut) return ch;
  const def = CHALLENGE_BY_ID[ch.id];
  ch.done = !!def?.check(g, g.userStats ?? {});
  if (ch.done) {
    const p = state.player;
    addXp(state, ch.reward.xp);
    p.fame = clamp((p.fame ?? 0) + ch.reward.fame, 0, 100);
    if (ch.reward.money) p.money += ch.reward.money;
    state.challengeStreak = (state.challengeStreak ?? 0) + 1;
  } else state.challengeStreak = 0;
  return ch;
}

// ---------------------------------------------------------------- primetime

/** Some big games are primetime: under the lights, national TV, more fame (and more pressure). */
export function isPrimetime(state, g, { rivalry, playoff }) {
  const stage = state.career.stage;
  if (stage === 'hs') return false; // Friday night is already the lights
  if (playoff && (g.round ?? 0) > 0) return true;
  const p = (rivalry ? 0.5 : 0.12) + (stage === 'pro' ? 0.06 : 0) + ((state.player.fame ?? 0) > 60 ? 0.05 : 0);
  return rand(state) < p;
}
export const PRIMETIME_NAME = { college: 'Saturday Night Spotlight', pro: 'Prime Night Football' };
