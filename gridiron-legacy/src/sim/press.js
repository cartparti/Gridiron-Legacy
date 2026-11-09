// News feed: headlines, fan posts and notable moments.
import { HEADLINES, FAN_POSTS, OUTLETS } from '../data/press.js';
import { FAN_HANDLES } from '../data/names.js';
import { STAGES } from '../data/config.js';
import { fillTokens } from '../core/util.js';
import { pick, chance } from '../core/rng.js';

const MAX_NEWS = 80;

export function addNews(state, kind, text, extra = {}) {
  state.news = state.news ?? [];
  state.news.unshift({ kind, text, year: state.career.year, week: (state.league?.week ?? 0) + 1, stage: state.career.stage, ...extra });
  if (state.news.length > MAX_NEWS) state.news.length = MAX_NEWS;
}

/** Headline + a few fan posts after a game. Returns the headline. */
export function postGamePress(state, g, oppName, teamName) {
  const p = state.player;
  const s = g.userStats;
  const yards = s.passYds + s.rushYds + s.recYds;
  const tds = s.passTD + s.rushTD + s.recTD;
  const tokens = {
    name: `${p.first} ${p.last}`, last: p.last, team: teamName, opp: oppName,
    score: `${Math.max(g.score.home, g.score.away)}-${Math.min(g.score.home, g.score.away)}`,
    yards, tds, title: STAGES[state.career.stage].titleName, line: statPhrase(p.position, s),
  };
  let key;
  if (g.sitOut) key = 'sat_out';
  else if (g.isTitle && g.won) key = 'title';
  else if (s.clutch > 0 && g.won && chance(state, 0.6)) key = 'clutch';
  else {
    const tier = g.grade >= 78 ? 'great' : g.grade >= 55 ? 'good' : 'bad';
    key = `${tier}_${g.won ? 'win' : 'loss'}`;
  }
  const headline = fillTokens(pick(state, HEADLINES[key]), tokens);
  const outlet = pick(state, OUTLETS[state.career.stage]);
  addNews(state, 'headline', headline, { outlet });
  if (!g.sitOut && p.fame >= 5) {
    const mood = g.grade >= 75 ? 'great' : g.grade >= 52 ? 'good' : 'bad';
    const n = p.fame > 40 ? 2 : 1;
    for (let i = 0; i < n; i++) addNews(state, 'fan', fillTokens(pick(state, FAN_POSTS[mood]), tokens), { handle: pick(state, FAN_HANDLES) });
  }
  return { headline, outlet };
}

/** Short stat phrase for headlines, e.g. "312 yards, 3 TD" or "2 INT, 7 tackles". */
export function statPhrase(pos, s) {
  if (pos === 'DT') return `${s.defSacks ?? 0} Sacks, ${s.tfl ?? 0} TFL, ${s.tackles} Tackles`;
  if (pos === 'CB') return `${s.defInt} INT, ${s.pd} PD, ${s.tackles} Tackles`;
  if (pos === 'QB') return `${s.passYds} Yards, ${s.passTD} TD`;
  if (pos === 'RB') return `${s.rushYds} Yards, ${s.rushTD} TD`;
  return `${s.recYds} Yards, ${s.recTD} TD`;
}
