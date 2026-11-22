// All-Star selection: great seasons earn an invite to the level's all-star event, with a skills challenge you play.
// state.review.allStar = { name, test, title, selected, result } ; player.allStars = [{ year, stage, won, place }]
import { clamp } from '../core/util.js';
import { rand } from '../core/rng.js';
import { addNews } from './press.js';
import { logJournal } from './journal.js';
import { addXp } from './progress.js';

export const ALLSTAR_NAME = { hs: 'All-State Showcase', college: 'All-American Bowl', pro: 'All-Star Classic' };
// the skills challenge for each position (uses the combine mini-games)
export const SKILLS = {
  QB: { test: 'drill', title: 'Accuracy Challenge' }, WR: { test: 'forty', title: 'Fastest Player' }, RB: { test: 'forty', title: 'Fastest Player' },
  CB: { test: 'drill', title: 'Reaction Drill' }, DT: { test: 'bench', title: 'Strongman' }, K: { test: 'vert', title: 'Long Ball' }, MS: { test: 'drill', title: 'Crowd Games' },
};
const ALL_TEAM = /^All-(League|Conference|State|American)/;

/** Season end: were you picked? perf = season rating, awards = this season's awards. */
export function allStarSelect(state, { perf, awards = [] }) {
  const p = state.player;
  const c = state.career;
  if (!p || c.stage === 'retired' || (p.seasonStats?.games ?? 0) < 4) return null;
  const picked = awards.some((a) => ALL_TEAM.test(a) || /Most Valuable|Player of the Year/.test(a)) || perf >= 72;
  if (!picked) return null;
  const sk = SKILLS[p.position] ?? SKILLS.WR;
  const as = { name: ALLSTAR_NAME[c.stage], test: sk.test, title: sk.title, selected: true, result: null, year: c.year, stage: c.stage };
  p.allStars ??= [];
  p.allStars.push({ year: c.year, stage: c.stage, won: false, place: null });
  addXp(state, 40);
  p.fame = clamp((p.fame ?? 0) + 2, 0, 100);
  addNews(state, 'award', `${p.first} ${p.last} selected to the ${as.name}.`);
  logJournal(state, 'award', `Selected to the ${as.name}.`);
  return as;
}

/** Play the skills challenge: perf 0..1 from the mini-game. Returns { place, won, text }. */
export function allStarChallenge(state, perf) {
  const as = state.review?.allStar;
  if (!as || as.result) return as?.result ?? null;
  const p = state.player;
  // seven other all-stars; your perf against theirs (they're good: centered on 0.55)
  let place = 1;
  for (let i = 0; i < 7; i++) if (0.55 + (rand(state) - 0.5) * 0.5 > perf) place++;
  const won = place === 1;
  const fame = won ? 5 : place <= 3 ? 3 : 1;
  p.fame = clamp((p.fame ?? 0) + fame, 0, 100);
  addXp(state, won ? 90 : place <= 3 ? 50 : 25);
  if (won && state.career.stage === 'pro') p.money += 50000;
  const rec = p.allStars?.[p.allStars.length - 1];
  if (rec) { rec.won = won; rec.place = place; }
  const ord = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'][place - 1];
  as.result = { place, won, fame, text: won ? `You won the ${as.title}!` : `${ord} place in the ${as.title}.` };
  if (won) { addNews(state, 'award', `${p.first} ${p.last} wins the ${as.title} at the ${as.name}.`); logJournal(state, 'award', `Won the ${as.title} at the ${as.name}.`, { big: true }); }
  return as.result;
}
