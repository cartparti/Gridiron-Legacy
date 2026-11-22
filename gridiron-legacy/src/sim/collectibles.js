// Things you collect over a career: a trading card for every season (rarity from how good it was) and game balls for
// milestones (career touchdowns, big seasons, games played, your first pro win, a huge playoff game). Pure sim.
import { mainStats } from './legends.js';
import { logJournal } from './journal.js';

// ---------------------------------------------------------------- trading cards

const TOP = ['Most Valuable Player', 'Ironstone Trophy', 'State Player of the Year'];
export const RARITY = {
  base: { label: 'Base', mult: 1 },
  silver: { label: 'Silver', mult: 3, print: 499 },
  gold: { label: 'Gold', mult: 10, print: 99 },
  legendary: { label: 'Legendary', mult: 40, print: 10 },
};

/** endSeason: print this season's card. entry = the history entry just pushed. */
export function printCard(state, entry, awards = []) {
  const p = state.player;
  const perf = entry.perf ?? 50;
  const top = awards.some((a) => TOP.includes(a));
  const rarity = top || (entry.champion && perf >= 80) ? 'legendary' : awards.length || perf >= 72 ? 'gold' : perf >= 60 ? 'silver' : 'base';
  const proSeasons = p.history.filter((h) => h.stage === 'pro').length;
  const card = {
    id: `${entry.year}-${entry.stage}`,
    year: entry.year,
    stage: entry.stage,
    team: entry.teamName,
    colors: entry.colors,
    pos: p.position,
    number: p.number ?? 1,
    name: `${p.first} ${p.last}`,
    ovr: Math.round(entry.ovr),
    perf: Math.round(perf),
    rarity,
    rookie: entry.stage === 'pro' && proSeasons === 1,
    award: awards[0] ?? (entry.champion ? 'Champion' : null),
    stats: mainStats(p.position, entry.seasonStats).map(([, l, v]) => [l, v]),
    record: entry.record,
    serial: RARITY[rarity].print ? 1 + Math.floor(((entry.year * 31 + perf * 7) % RARITY[rarity].print)) : null,
  };
  (p.cards ??= []).push(card);
  return card;
}

/** What a card sells for today (fame and later success push old cards up, like the real thing). */
export function cardValue(state, card) {
  const p = state.player;
  const stageK = card.stage === 'pro' ? 1 : card.stage === 'college' ? 0.8 : 0.5;
  const base = 2 + (card.perf / 10) ** 2 * stageK;
  const fameK = 1 + (p.fame ?? 0) / 25 + (p.rings?.length ?? 0) * 0.3 + (state.legacy?.tier?.id === 'hof' ? 3 : 0);
  return Math.round(base * RARITY[card.rarity].mult * fameK * (card.rookie ? 2.5 : 1));
}

// ---------------------------------------------------------------- game balls

const td = (s) => (s?.passTD ?? 0) + (s?.rushTD ?? 0) + (s?.recTD ?? 0) + (s?.defTD ?? 0);
const SEASON_YDS = { QB: ['passYds', [3000, 4000, 5000], 'passing yards'], RB: ['rushYds', [1000, 1500, 2000], 'rushing yards'], WR: ['recYds', [1000, 1500], 'receiving yards'] };
const CAREER_STAT = {
  CB: ['defInt', [10, 25, 50], 'career interceptions'], DT: ['defSacks', [10, 25, 50, 100], 'career sacks'],
  K: ['fgMade', [50, 100, 200, 300], 'career field goals'], MS: ['danceWins', [10, 25, 50], 'mascot showdown wins'],
};

/** All milestones you have reached (id -> label). */
function milestones(state, g) {
  const p = state.player, c = state.career;
  const out = [];
  const ctd = td(p.careerStats);
  if (!['K', 'MS'].includes(p.position)) for (const n of [1, 10, 25, 50, 100, 150]) if (ctd >= n) out.push([`td${n}`, n === 1 ? 'First career touchdown' : `${n} career touchdowns`]);
  const sy = SEASON_YDS[p.position];
  if (sy) for (const n of sy[1]) if ((p.seasonStats?.[sy[0]] ?? 0) >= n) out.push([`sy${n}-${c.year}-${c.stage}`, `${n.toLocaleString('en-US')} ${sy[2]} in a season (${c.year})`]);
  const cs = CAREER_STAT[p.position];
  if (cs) for (const n of cs[1]) if ((p.careerStats?.[cs[0]] ?? 0) >= n) out.push([`cs${n}`, `${n} ${cs[2]}`]);
  for (const n of [50, 100, 150, 200]) if ((p.careerStats?.games ?? 0) >= n) out.push([`gp${n}`, `${n} career games`]);
  if (c.stage === 'pro' && g?.won && !g.sitOut) out.push(['prowin', 'First pro win']);
  if (g?.playoff && g.won && !g.sitOut && (g.grade ?? 0) >= 90) out.push([`po-${c.year}-${c.stage}-${state.league?.playoffs?.round ?? 0}`, `Coach's game ball: ${g.roundName ?? 'playoff'} star`]);
  return out;
}

/** finishGame (after stats are added): new game balls this week. Old saves are backfilled silently the first time. */
export function gameBallsAfterGame(state, g, oppName) {
  const p = state.player;
  const first = !p.gameBalls;
  p.gameBalls ??= [];
  const have = new Set(p.gameBalls.map((b) => b.id));
  const fresh = [];
  for (const [id, label] of milestones(state, g)) {
    if (have.has(id)) continue;
    const ball = { id, label, year: state.career.year, stage: state.career.stage, opp: oppName ?? '' };
    p.gameBalls.push(ball);
    if (!first || p.careerStats?.games <= 1) fresh.push(ball);
  }
  for (const b of fresh) if (/First|100|Coach/.test(b.label)) logJournal(state, 'game', `Game ball: ${b.label}.`);
  return fresh;
}
