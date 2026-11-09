// All-time legends (generated, stable per save), award races during the season, market value.
// Pure sim: no DOM. Generated people use the save's seed so the lists never shuffle between visits.
import { seededRandom } from '../data/looks.js';
import { FIRST_NAMES, LAST_NAMES } from '../data/names.js';
import { TROPHIES, seasonPerf } from './awards.js';
import { getTeam } from './league.js';

const POS = ['QB', 'RB', 'WR', 'CB', 'DT'];
const IND = new Set(Object.values(TROPHIES).flat().filter((t) => t.kind === 'ind').map((t) => t.name));

/** The two headline numbers for a position (for tables and charts). */
export function mainStats(pos, s = {}) {
  switch (pos) {
    case 'QB': return [['passYds', 'Pass Yds', s.passYds ?? 0], ['passTD', 'Pass TD', s.passTD ?? 0]];
    case 'RB': return [['rushYds', 'Rush Yds', s.rushYds ?? 0], ['rushTD', 'Rush TD', s.rushTD ?? 0]];
    case 'WR': return [['recYds', 'Rec Yds', s.recYds ?? 0], ['recTD', 'Rec TD', s.recTD ?? 0]];
    case 'CB': return [['defInt', 'INT', s.defInt ?? 0], ['tackles', 'Tackles', s.tackles ?? 0]];
    case 'DT': return [['defSacks', 'Sacks', s.defSacks ?? 0], ['tackles', 'Tackles', s.tackles ?? 0]];
    default: return [['tackles', 'Tackles', s.tackles ?? 0], ['games', 'Games', s.games ?? 0]];
  }
}

export const totalTD = (s = {}) => (s.passTD ?? 0) + (s.rushTD ?? 0) + (s.recTD ?? 0) + (s.defTD ?? 0);
export const bigPlaysD = (s = {}) => (s.defInt ?? 0) + (s.defSacks ?? 0);

/** Your trophy counts. */
export function myTrophies(p) {
  const ind = p.awards.filter((a) => IND.has(a.name)).length;
  const team = (p.titles ?? []).length;
  return { ind, team };
}

/** All-time greats (retired) + a few active stars. Same list every time for this save. */
export function legends(state) {
  const out = [];
  const seed = String(state.seed ?? 1);
  for (let i = 0; i < 90; i++) {
    const r = seededRandom(`${seed}:legend:${i}`);
    const pos = POS[Math.floor(r() * POS.length)];
    const start = 1965 + Math.floor(r() * 50);
    const len = 8 + Math.floor(r() * 9);
    const star = Math.pow(r(), 1.8); // most are good, a few are all-time great
    const yrs = len;
    const L = {
      name: `${FIRST_NAMES[Math.floor(r() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(r() * LAST_NAMES.length)]}`,
      pos, years: `${start}-${start + len}`, active: false,
      ind: Math.round(star * 22 + r() * 3), team: Math.round(star * 6 + r() * 2),
      td: 0, big: 0,
    };
    if (pos === 'QB') L.td = Math.round(yrs * (14 + star * 22));
    else if (pos === 'RB') L.td = Math.round(yrs * (5 + star * 10));
    else if (pos === 'WR') L.td = Math.round(yrs * (4 + star * 9));
    else L.big = Math.round(yrs * (3 + star * 9));
    out.push(L);
  }
  // active stars from the current pro league (if any), with partial careers
  const pl = state.league?.kind === 'pro' ? state.league.players.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 8) : [];
  for (const x of pl) {
    const r = seededRandom(`${seed}:active:${x.first}${x.last}`);
    const yrs = Math.max(1, (x.age ?? 26) - 22);
    const star = (x.ovr - 70) / 30;
    out.push({ name: `${x.first} ${x.last}`, pos: x.pos, years: 'active', active: true, ind: Math.round(yrs * star * 1.2 + r() * 2), team: Math.round(r() * 2), td: ['QB', 'RB', 'WR', 'TE'].includes(x.pos) ? Math.round(yrs * (6 + star * 14)) : 0, big: ['CB', 'S', 'LB', 'DL'].includes(x.pos) ? Math.round(yrs * (3 + star * 6)) : 0 });
  }
  return out;
}

/** Ranked list for a category ('ind' | 'team' | 'td' | 'big') including you. */
export function legendBoard(state, key) {
  const p = state.player;
  const t = myTrophies(p);
  const me = { name: `${p.first} ${p.last}`, pos: p.position, years: 'you', active: state.career.stage !== 'retired', you: true, ind: t.ind, team: t.team, td: totalTD(p.careerStats), big: bigPlaysD(p.careerStats) };
  const list = legends(state).filter((x) => (key === 'td' ? x.td > 0 : key === 'big' ? x.big > 0 : true));
  if (key !== 'td' || totalTD(p.careerStats) > 0 || ['QB', 'RB', 'WR'].includes(p.position)) list.push(me);
  list.sort((a, b) => b[key] - a[key] || (a.you ? 1 : -1));
  return list.map((x, i) => ({ ...x, rank: i + 1 }));
}

/** Where you'd rank all-time by a blended legacy score, and who is next to pass. */
export function allTimeRank(state) {
  const p = state.player;
  const t = myTrophies(p);
  const score = (x) => x.ind * 3 + x.team * 5 + x.td * 0.08 + x.big * 0.15;
  const meScore = score({ ind: t.ind, team: t.team, td: totalTD(p.careerStats), big: bigPlaysD(p.careerStats) });
  const all = legends(state).map((x) => ({ ...x, s: score(x) })).sort((a, b) => b.s - a.s);
  const rank = all.filter((x) => x.s > meScore).length + 1;
  const next = all.filter((x) => x.s > meScore).at(-1) ?? null;
  return { rank, of: all.length + 1, next, gap: next ? Math.ceil(next.s - meScore) : 0 };
}

// ------------------------------------------------------------------ award race

const RACE = {
  hs: ['State Player of the Year', 'Underclassman of the Year'],
  college: ['Ironstone Trophy', 'Freshman of the Year'],
  pro: ['Most Valuable Player', 'Rookie of the Year'],
};

/** Season award race: { award, kidAward, rows, kids }. Points build up week by week. */
export function awardRace(state) {
  const p = state.player;
  const lg = state.league;
  const stage = state.career.stage;
  const weeks = Math.max(0, Math.min(lg.week ?? 0, lg.schedule?.length ?? 0));
  const seed = `${state.seed}:${state.career.year}`;
  // contenders: real pro players, or generated stars on the best teams
  let pool;
  if (lg.kind === 'pro' && lg.players?.length) {
    pool = lg.players.filter((x) => ['QB', 'RB', 'WR', 'CB', 'DL', 'LB'].includes(x.pos)).sort((a, b) => b.ovr - a.ovr).slice(0, 14)
      .map((x) => ({ name: `${x.first} ${x.last}`, team: x.teamId, pos: x.pos, lvl: x.ovr, age: x.age ?? 26 }));
  } else {
    pool = [];
    const teams = lg.teams.slice().sort((a, b) => b.base - a.base);
    for (let i = 0; i < 14; i++) {
      const r = seededRandom(`${seed}:c:${i}`);
      const t = teams[i % teams.length];
      if (t.id === state.career.teamId) continue;
      pool.push({ name: `${FIRST_NAMES[Math.floor(r() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(r() * LAST_NAMES.length)]}`, team: t.id, pos: POS[Math.floor(r() * POS.length)], lvl: 62 + r() * 26, age: stage === 'hs' ? 15 + Math.floor(r() * 3) : stage === 'college' ? 18 + Math.floor(r() * 4) : 22 + Math.floor(r() * 10) });
    }
  }
  const rows = pool.map((c) => {
    const r = seededRandom(`${seed}:${c.name}`);
    let pts = 0;
    for (let w = 0; w < weeks; w++) pts += Math.max(0, 3 + (c.lvl - 70) * 0.28 + (r() - 0.5) * 7);
    return { ...c, pts: Math.round(pts) };
  });
  const s = p.seasonStats;
  const grade = s.games ? s.grades / s.games : 0;
  const myPts = Math.round(s.games * Math.max(0, (grade - 40) / 5.5) + (s.wins ?? 0) * 1.5);
  rows.push({ name: `${p.first} ${p.last}`, team: state.career.teamId, pos: p.position, pts: myPts, age: p.age, you: true });
  rows.sort((a, b) => b.pts - a.pts);
  const kids = rows.filter((x) => (stage === 'pro' ? (x.you ? !p.history.some((h) => h.stage === 'pro') : x.age <= 23) : stage === 'college' ? x.age <= 19 : x.age <= 16)).slice(0, 6);
  return { award: RACE[stage]?.[0] ?? 'MVP', kidAward: RACE[stage]?.[1] ?? 'Rookie of the Year', rows: rows.map((x, i) => ({ ...x, rank: i + 1 })), kids, weeks, perf: Math.round(seasonPerf(p.position, s)) };
}

// ------------------------------------------------------------------ market value & journey

/** Rough market value for a season (pro: contract value, college: NIL value, HS: recruiting value). */
export function marketValue(stage, ovr, age, fame) {
  if (stage === 'pro') return Math.round((Math.pow(Math.max(0, ovr - 55) / 40, 2.2) * 42e6 * Math.max(0.35, 1 - Math.max(0, age - 28) * 0.08) + fame * 9e4) / 1e4) * 1e4;
  if (stage === 'college') return Math.round((Math.pow(Math.max(0, ovr - 45) / 45, 2) * 900e3 + fame * 6e3) / 1e3) * 1e3;
  return Math.round((Math.max(0, ovr - 40) * 1800 + fame * 900) / 100) * 100;
}

/** Your career path: one entry per team stint. */
export function journey(state) {
  const p = state.player;
  const stints = [];
  for (const hst of p.history) {
    const last = stints[stints.length - 1];
    if (last && last.teamId === hst.teamId && last.stage === hst.stage) { last.to = hst.year; last.seasons++; continue; }
    stints.push({ teamId: hst.teamId, name: hst.teamName, colors: hst.colors, stage: hst.stage, from: hst.year, to: hst.year, seasons: 1 });
  }
  // current team (season in progress)
  const cur = getTeam(state.league, state.career.teamId);
  const last = stints[stints.length - 1];
  if (cur && state.career.stage !== 'retired' && !(last && last.teamId === cur.id && last.stage === state.career.stage)) stints.push({ teamId: cur.id, name: `${cur.city} ${cur.name}`, colors: cur.colors, stage: state.career.stage, from: state.career.year, to: state.career.year, seasons: 0, current: true });
  else if (last && cur && last.teamId === cur.id) last.current = state.career.stage !== 'retired';
  return stints.map((s2, i) => {
    let how = '';
    if (s2.stage === 'hs') how = `Hometown school in ${p.hometown}`;
    else if (s2.stage === 'college') how = i && stints[i - 1].stage === 'hs' ? 'Committed out of high school' : 'Transferred';
    else if (p.draft && stints.findIndex((x) => x.stage === 'pro') === i) how = p.draft.undrafted ? 'Signed as an undrafted free agent' : `Drafted #${p.draft.pick} overall (${p.draft.year})`;
    else how = 'Signed in free agency';
    return { ...s2, how };
  });
}
