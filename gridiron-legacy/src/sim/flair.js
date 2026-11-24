// v0.63: tunnel fits (your pregame outfit), a bold preseason prediction, autograph card shows, a stadium menu item named
// after you, and career streaks. Pure sim; none of it touches the save's dice (no rand), so careers play out the same.
import { clamp } from '../core/util.js';
import { PER_GAME } from './goals.js';
import { getTeam, standings } from './league.js';
import { addNews } from './press.js';
import { logJournal } from './journal.js';
import { addXp } from './progress.js';
import { useDaySlot } from './social.js';
import { cardValue } from './collectibles.js';

const hash = (s) => { let x = 7; for (const ch of String(s)) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return x; };
const STAGE_I = { hs: 0, college: 1, pro: 2 };

// ---------------------------------------------------------------- tunnel fits

export const FITS = [
  { id: 'suit', label: 'Sharp suit', emoji: '🕴️', desc: 'Tailored, pressed, all business.', fame: 0.6, coach: 1 },
  { id: 'street', label: 'Streetwear', emoji: '🧢', desc: 'Limited sneakers and a big chain.', fame: 0.8 },
  { id: 'throwback', label: 'Throwback jersey', emoji: '👕', desc: 'A legend\'s old jersey. The fans see you.', fame: 0.7, teammates: 1 },
  { id: 'designer', label: 'Designer fit', emoji: '💎', desc: 'Runway-level. Costs real money.', fame: 1.4, cost: [60, 400, 25000] },
  { id: 'hoodie', label: 'Comfy hoodie', emoji: '🧥', desc: 'Headphones on, game face on.', fame: 0.1, mood: 2 },
];
const weekKey = (state) => `${state.career.year}-${state.career.stage}-${state.league?.phase}-${state.league?.week ?? 0}`;
export const fitToday = (state) => (state.fit?.week === weekKey(state) ? state.fit : null);

export function pickFit(state, id) {
  const f = FITS.find((x) => x.id === id);
  if (!f || fitToday(state)) return null;
  const p = state.player;
  const cost = f.cost ? f.cost[STAGE_I[state.career.stage] ?? 1] : 0;
  if (cost && p.money < cost) return { ok: false, text: 'Not enough money for that fit this week.' };
  p.money -= cost;
  const repeat = state.fit?.id === id; // wearing the same thing twice in a row gets fewer looks
  const fame = f.fame * (repeat ? 0.4 : 1) * (state.career.stage === 'hs' ? 0.5 : 1);
  p.fame = clamp(p.fame + fame, 0, 100);
  if (f.mood) p.mood = clamp(p.mood + f.mood, 0, 100);
  if (f.coach) p.rel.coach = clamp(p.rel.coach + f.coach, 0, 100);
  if (f.teammates) p.rel.teammates = clamp(p.rel.teammates + f.teammates, 0, 100);
  const best = !repeat && fame >= 0.7 && (hash(weekKey(state) + p.last) % 4 === 0);
  if (best) { p.fame = clamp(p.fame + 1, 0, 100); p.bestDressed = (p.bestDressed ?? 0) + 1; }
  state.fit = { week: weekKey(state), id, best };
  return { ok: true, best, text: best ? `${f.label}: the internet named you best dressed of the week! +fame` : repeat ? `${f.label} again? Fans noticed. Fewer photos this week.` : `${f.label}. The photographers loved it.` };
}

// ---------------------------------------------------------------- bold prediction

export const PREDICTIONS = [
  { id: 'playoffs', label: '"We are making the playoffs."' },
  { id: 'rival', label: '"We will beat our rival."' },
  { id: 'stat', label: '"I\'m having a career year."', desc: (st) => `${statTarget(st).target.toLocaleString('en-US')} ${statTarget(st).noun}` },
  { id: 'twoLoss', label: '"We won\'t lose more than two games."' },
  { id: 'title', label: '"We are winning it all."' },
];
export function statTarget(state) {
  const [key, noun, per] = (PER_GAME[state.player.position] ?? PER_GAME.WR)[0];
  const games = state.league?.schedule?.length ?? 10;
  const raw = per[STAGE_I[state.career.stage] ?? 1] * games * 1.15;
  return { key, noun, target: raw >= 100 ? Math.round(raw / 10) * 10 : Math.max(2, Math.round(raw)) };
}
export const canPredict = (state) => state.league?.phase === 'regular' && (state.league.week ?? 0) <= 1 && state.prediction?.year !== state.career.year;

export function makePrediction(state, id) {
  if (!canPredict(state) || !PREDICTIONS.some((x) => x.id === id)) return null;
  state.prediction = { year: state.career.year, stage: state.career.stage, id, rivalWon: false, ...(id === 'stat' ? statTarget(state) : {}) };
  const p = state.player;
  p.fame = clamp(p.fame + 1, 0, 100);
  addNews(state, 'story', `${p.first} ${p.last} guarantees it: ${PREDICTIONS.find((x) => x.id === id).label.replace(/"/g, '')}`);
  return state.prediction;
}
/** finishGame: remember a rivalry win. */
export function predictionAfterGame(state, g) { if (state.prediction?.year === state.career.year && g.rivalry && g.won) state.prediction.rivalWon = true; }

/** endSeason: was the guarantee right? */
export function settlePrediction(state, { champion, team }) {
  const pr = state.prediction, p = state.player;
  if (!pr || pr.year !== state.career.year || pr.stage !== state.career.stage || pr.settled) return null;
  const seeds = state.league?.playoffs?.seeds ?? [];
  const hit = pr.id === 'playoffs' ? seeds.includes(team.id) : pr.id === 'rival' ? pr.rivalWon : pr.id === 'title' ? champion
    : pr.id === 'twoLoss' ? (team.l ?? 0) <= 2 : (p.seasonStats?.[pr.key] ?? 0) >= pr.target;
  pr.settled = true;
  if (hit) { p.fame = clamp(p.fame + (pr.id === 'title' ? 6 : 3), 0, 100); addXp(state, 60); logJournal(state, 'award', `Called your shot and backed it up: ${PREDICTIONS.find((x) => x.id === pr.id).label}`); }
  else { p.fame = clamp(p.fame - 1.5, 0, 100); p.mood = clamp(p.mood - 3, 0, 100); }
  return { id: pr.id, label: PREDICTIONS.find((x) => x.id === pr.id).label, hit };
}

// ---------------------------------------------------------------- card show

export const canCardShow = (state) => state.career.stage !== 'hs' && (state.player.cards?.length ?? 0) > 0 && state.cardShowYear !== state.career.year && !!state.week?.plan?.some((x) => !x);

/** Once a season, uses a free day: sign cards for collectors. */
export function cardShow(state) {
  if (!canCardShow(state)) return null;
  const p = state.player;
  if (!useDaySlot(state, 'Card show signing', 'star', 1)) return null;
  const val = (p.cards ?? []).reduce((a, c) => a + cardValue(state, c), 0);
  const pay = Math.round((val * 0.6 + p.fame * (state.career.stage === 'pro' ? 900 : 60)) / 10) * 10;
  p.money += pay;
  p.fame = clamp(p.fame + 1, 0, 100);
  p.mood = clamp(p.mood + 2, 0, 100);
  state.cardShowYear = state.career.year;
  return { pay, text: `The line wrapped around the building. You signed for four hours and earned $${pay.toLocaleString('en-US')}.` };
}

// ---------------------------------------------------------------- signature dish

const DISHES = ['Burger', 'Nachos', 'Hot Dog', 'Wings', 'Sundae', 'Pretzel', 'Sliders', 'Loaded Fries'];
const POS_WORD = { QB: 'Gunslinger', RB: 'Workhorse', WR: 'Deep Ball', CB: 'Lockdown', DT: 'Big Man', K: 'Field Goal', MS: 'Mascot' };
/** beginWeek: a big enough star gets a menu item named after him at the home stadium. */
export function dishCheck(state) {
  const p = state.player, c = state.career;
  if (c.stage === 'hs' || p.fame < 60 || p.dish?.team === c.teamId) return null;
  const team = getTeam(state.league, c.teamId);
  if (!team) return null;
  const h = hash(p.last + team.name);
  const name = h % 2 ? `The ${p.last} ${DISHES[h % DISHES.length]}` : `${POS_WORD[p.position] ?? 'Star'} ${DISHES[(h >> 3) % DISHES.length]}`;
  p.dish = { name, team: c.teamId, teamName: `${team.city} ${team.name}`, year: c.year, fresh: true };
  (p.dishes ??= []).push({ name, teamName: p.dish.teamName, year: c.year });
  addNews(state, 'story', `The ${team.name} stadium adds "${name}" to the menu.`);
  logJournal(state, 'award', `The home stadium named a menu item after you: "${name}".`);
  return p.dish;
}

// ---------------------------------------------------------------- streaks

const tdsIn = (s) => (s?.passTD ?? 0) + (s?.rushTD ?? 0) + (s?.recTD ?? 0) + (s?.defTD ?? 0);
export const STREAK_INFO = {
  games: { label: 'Games played in a row', icon: '🛡️' },
  wins: { label: 'Wins in a row (when you play)', icon: '🏆' },
  td: { label: 'Games in a row with a touchdown', icon: '🏈', skip: ['K', 'MS'] },
  fg: { label: 'Games in a row without a missed kick', icon: '🎯', only: ['K'] },
  aGrade: { label: 'B or better games in a row', icon: '⭐' },
};
export function streaksAfterGame(state, g) {
  const p = state.player;
  const s = (p.streaks ??= { cur: {}, best: {} });
  const bump = (k, ok) => { s.cur[k] = ok ? (s.cur[k] ?? 0) + 1 : 0; s.best[k] = Math.max(s.best[k] ?? 0, s.cur[k]); };
  if (g.sitOut) { s.cur.games = 0; return null; }
  bump('games', true);
  bump('wins', g.won);
  bump('aGrade', (g.grade ?? 0) >= 80);
  if (!['K', 'MS'].includes(p.position)) bump('td', tdsIn(g.userStats) > 0);
  if (p.position === 'K') bump('fg', (g.userStats.fgAtt ?? 0) === (g.userStats.fgMade ?? 0) && (g.userStats.xpAtt ?? 0) === (g.userStats.xpMade ?? 0));
  const hot = Object.entries(s.cur).find(([k, v]) => k !== 'games' && v >= 3 && v % (v >= 10 ? 5 : 3) === 0 && s.best[k] === v);
  return hot ? { key: hot[0], n: hot[1], label: STREAK_INFO[hot[0]].label } : null;
}
export function streakRows(state) {
  const p = state.player, s = p.streaks ?? { cur: {}, best: {} };
  return Object.entries(STREAK_INFO).filter(([, i]) => !i.skip?.includes(p.position) && (!i.only || i.only.includes(p.position)))
    .map(([k, i]) => ({ key: k, ...i, cur: s.cur[k] ?? 0, best: s.best[k] ?? 0 }));
}
