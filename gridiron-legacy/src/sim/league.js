// Leagues: teams, generated rosters (pro), schedules, standings, playoffs and quick-simmed games.
import { PRO_TEAMS, COLLEGE_TEAMS, HS_TEAMS, PRO_DIVISIONS } from '../data/teams.js';
import { hometownSchools } from '../data/hometown.js';
import { FIRST_NAMES, LAST_NAMES } from '../data/names.js';
import { STAGES, SALARY_CAP, MIN_SALARY } from '../data/config.js';
import { clamp } from '../core/util.js';
import { rand, randInt, gauss, pick, shuffle, chance } from '../core/rng.js';

export const ROSTER_TEMPLATE = ['QB', 'RB', 'WR', 'WR', 'WR', 'TE', 'OL', 'OL', 'OL', 'OL', 'OL', 'DL', 'DL', 'DL', 'DL', 'LB', 'LB', 'LB', 'CB', 'CB', 'CB', 'S', 'S', 'K'];
const OFF_WEIGHTS = { QB: 0.32, RB: 0.12, WR: 0.24, TE: 0.1, OL: 0.22 };
const DEF_WEIGHTS = { DL: 0.3, LB: 0.25, CB: 0.27, S: 0.18 };
const POS_SALARY_MAX = { QB: 52e6, WR: 30e6, RB: 16e6, TE: 17e6, OL: 22e6, DL: 28e6, LB: 20e6, CB: 22e6, S: 17e6, K: 5e6 };

export function teamDefs(kind, state = null) {
  if (kind === 'hs' && state?.career?.customTown) {
    // your typed hometown takes the place of one built-in town (same league size)
    return [...HS_TEAMS.filter((t) => t.town !== 'Mill Creek'), ...hometownSchools(state.career.customTown)];
  }
  return kind === 'hs' ? HS_TEAMS : kind === 'college' ? COLLEGE_TEAMS : PRO_TEAMS;
}

/** Salary for a player of this overall at this position (pro). */
export function salaryFor(ovr, pos) {
  const t = clamp((ovr - 55) / 42, 0, 1);
  return Math.round((MIN_SALARY + Math.pow(t, 2.6) * (POS_SALARY_MAX[pos] ?? 15e6)) / 10000) * 10000;
}

export function genName(h) {
  return { first: pick(h, FIRST_NAMES), last: pick(h, LAST_NAMES) };
}

export function genProPlayer(state, league, pos, teamId, targetOvr, age) {
  const n = genName(state);
  const ovr = clamp(Math.round(gauss(state, targetOvr, 6)), 45, 97);
  const p = {
    id: league.nextId++,
    ...n,
    pos,
    age: age ?? randInt(state, 22, 33),
    ovr,
    pot: clamp(gauss(state, 1, 0.12), 0.7, 1.3),
    teamId,
    years: randInt(state, 1, 4),
  };
  p.salary = salaryFor(p.ovr, pos);
  return p;
}

export function createLeague(state, kind) {
  const defs = teamDefs(kind, state);
  const league = {
    kind,
    year: state.career.year,
    nextId: 1,
    teams: defs.map((d) => ({
      id: d.id, city: d.city, name: d.name, colors: d.colors.slice(), conf: d.conf ?? null, div: d.div ?? null, town: d.town ?? null,
      base: d.base, prestige: d.prestige ?? null, off: 0, def: 0, w: 0, l: 0, pf: 0, pa: 0, streak: 0,
    })),
    players: [],
    schedule: [],
    week: 0,
    phase: 'regular',
    playoffs: null,
    champion: null,
    leaders: null,
  };
  if (kind === 'pro') {
    for (const t of league.teams) {
      for (const pos of ROSTER_TEMPLATE) league.players.push(genProPlayer(state, league, pos, t.id, t.base));
    }
  }
  refreshTeamRatings(state, league);
  league.schedule = makeSchedule(state, league.teams.map((t) => t.id), STAGES[kind].games);
  return league;
}

/** Recompute offense/defense ratings. Pro uses rosters, lower levels jitter a base rating. */
export function refreshTeamRatings(state, league) {
  for (const t of league.teams) {
    if (league.kind === 'pro') {
      const roster = league.players.filter((p) => p.teamId === t.id);
      t.off = unitRating(roster, OFF_WEIGHTS);
      t.def = unitRating(roster, DEF_WEIGHTS);
    } else {
      t.off = clamp(t.base + gauss(state, 0, 5), 40, 95);
      t.def = clamp(t.base + gauss(state, 0, 5), 40, 95);
    }
  }
}

function unitRating(roster, weights) {
  let total = 0;
  let wsum = 0;
  for (const [pos, w] of Object.entries(weights)) {
    const at = roster.filter((p) => p.pos === pos).sort((a, b) => b.ovr - a.ovr);
    if (!at.length) continue;
    const take = pos === 'OL' ? 5 : pos === 'WR' || pos === 'CB' || pos === 'LB' ? 3 : pos === 'DL' ? 4 : pos === 'S' ? 2 : 1;
    const used = at.slice(0, take);
    const v = used.reduce((a, p) => a + p.ovr, 0) / used.length;
    total += v * w;
    wsum += w;
  }
  return wsum ? total / wsum : 60;
}

export function payroll(league, teamId) {
  return league.players.filter((p) => p.teamId === teamId).reduce((a, p) => a + p.salary, 0);
}

export function capSpace(league, teamId) {
  return SALARY_CAP - payroll(league, teamId);
}

/** Round-robin schedule using the circle method: nobody plays twice or plays themselves. */
export function makeSchedule(h, ids, games) {
  let arr = shuffle(h, ids);
  if (arr.length % 2) arr.push(null);
  const n = arr.length;
  const rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const week = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a && b) {
        const flip = (r + i) % 2 === 0;
        week.push({ home: flip ? a : b, away: flip ? b : a, result: null });
      }
    }
    rounds.push(week);
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }
  return shuffle(h, rounds).slice(0, Math.min(games, rounds.length));
}

export const getTeam = (league, id) => league.teams.find((t) => t.id === id);

/** Effective ratings for a game. The user's team mixes in the player's overall and team chemistry. */
export function gameRatings(state, league, teamId, { userPlaying = true } = {}) {
  const t = getTeam(league, teamId);
  let off = t.off;
  let def = t.def;
  if (teamId === state.career.teamId) {
    const p = state.player;
    const chem = (p.rel.teammates - 50) / 20;
    if (p.position === 'CB' || p.position === 'DT') {
      // A cornerback lifts the defense instead of the offense.
      if (userPlaying) def = def * 0.92 + p.ovr * 0.08 + chem;
      else def = def * 0.96 + chem - 2;
    } else if (userPlaying && p.position === 'K') off = off * 0.96 + p.ovr * 0.04 + chem * 0.5; // a kicker matters, but less than a QB
    else if (userPlaying) off = off * 0.92 + p.ovr * 0.08 + chem;
    else off = off * 0.96 + chem - 2;
  }
  return { off, def };
}

/** Outcome of one drive given offense and defense ratings. */
export function driveOutcome(h, off, def, bonus = 0) {
  const d = (off - def) / 100;
  const pTD = clamp(0.2 + d * 0.6 + bonus, 0.04, 0.62);
  const pFG = clamp(0.14 + d * 0.1, 0.05, 0.25);
  const pTO = clamp(0.11 - d * 0.22, 0.03, 0.25);
  const r = rand(h);
  if (r < pTD) return 'TD';
  if (r < pTD + pFG) return 'FG';
  if (r < pTD + pFG + pTO) return 'TO';
  return 'PUNT';
}

export const POINTS = { TD: 7, FG: 3, TO: 0, PUNT: 0 };

/** Simulate a full game between two teams quickly (no key moments). */
export function quickSim(state, league, homeId, awayId) {
  const hr = gameRatings(state, league, homeId, { userPlaying: false });
  const ar = gameRatings(state, league, awayId, { userPlaying: false });
  hr.off += 1.5; // home field
  const drives = randInt(state, 10, 12);
  let hs = 0;
  let as = 0;
  let hBonus = 0;
  let aBonus = 0;
  for (let i = 0; i < drives; i++) {
    const ho = driveOutcome(state, hr.off, ar.def, hBonus);
    hBonus = 0;
    hs += POINTS[ho];
    if (ho === 'TO') aBonus = 0.06;
    const ao = driveOutcome(state, ar.off, hr.def, aBonus);
    aBonus = 0;
    as += POINTS[ao];
    if (ao === 'TO') hBonus = 0.06;
  }
  [hs, as] = breakTie(state, hs, as, hr, ar);
  return { home: hs, away: as };
}

/** Overtime: alternate drives until someone scores, then a coin flip field goal. */
export function breakTie(h, hs, as, hr, ar) {
  let tries = 0;
  while (hs === as && tries < 4) {
    const a = driveOutcome(h, hr.off, ar.def);
    if (a === 'TD' || a === 'FG') return [hs + POINTS[a], as];
    const b = driveOutcome(h, ar.off, hr.def);
    if (b === 'TD' || b === 'FG') return [hs, as + POINTS[b]];
    tries++;
  }
  if (hs === as) return chance(h, 0.5) ? [hs + 3, as] : [hs, as + 3];
  return [hs, as];
}

export function recordResult(league, game, homeScore, awayScore, countStandings = true) {
  game.result = { home: homeScore, away: awayScore };
  if (!countStandings) return;
  const h = getTeam(league, game.home);
  const a = getTeam(league, game.away);
  h.pf += homeScore; h.pa += awayScore;
  a.pf += awayScore; a.pa += homeScore;
  if (homeScore > awayScore) { h.w++; a.l++; h.streak = Math.max(1, h.streak + 1); a.streak = Math.min(-1, a.streak - 1); }
  else { a.w++; h.l++; a.streak = Math.max(1, a.streak + 1); h.streak = Math.min(-1, h.streak - 1); }
}

export function standings(league, conf = null) {
  return league.teams
    .filter((t) => !conf || t.conf === conf || (!t.conf && t.div === conf))
    .slice()
    .sort((a, b) => b.w - a.w || (b.pf - b.pa) - (a.pf - a.pa) || b.pf - a.pf || a.id.localeCompare(b.id));
}

/** The v0.42+ pro league: five divisions of four, no conferences (older saves keep Summit / Coastal). */
export const isDivisionLeague = (league) => league.kind === 'pro' && league.teams.some((t) => t.div) && !league.teams.some((t) => t.conf);

/** The pro divisions in display order (only for a division league). */
export function leagueDivisions(league) {
  const present = new Set(league.teams.map((t) => t.div).filter(Boolean));
  return [...PRO_DIVISIONS.filter((d) => present.has(d)), ...[...present].filter((d) => !PRO_DIVISIONS.includes(d))];
}

/**
 * Playoff seeds for a division league if the season ended now: the five division winners (seeds 1-5 by record),
 * then the three best other records as wild cards (6-8).
 */
export function projectedSeeds(league) {
  const all = standings(league);
  const winners = leagueDivisions(league).map((d) => all.find((t) => t.div === d)).filter(Boolean);
  const wild = all.filter((t) => !winners.includes(t)).slice(0, Math.max(0, 8 - winners.length));
  return { seeds: [...winners, ...wild], winners, wild };
}

/** Build the playoff bracket from current standings. */
export function seedPlayoffs(league) {
  const games = [];
  let seeds;
  if (isDivisionLeague(league)) {
    const s = projectedSeeds(league).seeds;
    seeds = s.map((t) => t.id);
    // 1v8 and 4v5 meet in one semifinal, 2v7 and 3v6 in the other
    games.push(mk(s[0], s[7]), mk(s[3], s[4]), mk(s[1], s[6]), mk(s[2], s[5]));
  } else if (league.kind === 'pro') {
    const s = standings(league, 'Summit').slice(0, 4);
    const c = standings(league, 'Coastal').slice(0, 4);
    seeds = [...s.map((t) => t.id), ...c.map((t) => t.id)];
    games.push(mk(s[0], s[3]), mk(s[1], s[2]), mk(c[0], c[3]), mk(c[1], c[2]));
  } else {
    const top = standings(league).slice(0, 4);
    seeds = top.map((t) => t.id);
    games.push(mk(top[0], top[3]), mk(top[1], top[2]));
  }
  league.phase = 'playoffs';
  league.playoffs = { seeds, rounds: [games], round: 0 };
  return league.playoffs;
  function mk(a, b) { return { home: a.id, away: b.id, result: null }; }
}

export function roundName(league, round) {
  const totalRounds = league.kind === 'pro' ? 3 : 2;
  const fromEnd = totalRounds - 1 - round;
  if (fromEnd === 0) return STAGES[league.kind].titleName;
  if (league.kind === 'pro') return fromEnd === 1 ? (isDivisionLeague(league) ? 'Semifinal' : 'Conference Final') : 'Wild Card';
  return 'Semifinal';
}

export const winnerOf = (g) => (g.result.home > g.result.away ? g.home : g.away);
export const loserOf = (g) => (g.result.home > g.result.away ? g.away : g.home);

/** After every game in the current round has a result, create the next round (or crown a champion). */
export function advancePlayoffRound(league) {
  const po = league.playoffs;
  const cur = po.rounds[po.round];
  if (cur.some((g) => !g.result)) return false;
  const winners = cur.map(winnerOf);
  if (winners.length === 1) {
    league.champion = winners[0];
    league.phase = 'done';
    return true;
  }
  const next = [];
  for (let i = 0; i < winners.length; i += 2) {
    const a = winners[i];
    const b = winners[i + 1];
    const per = isDivisionLeague(league) ? 8 : 4; // seeds are league-wide in a division league, per conference before
    const seedA = po.seeds.indexOf(a) % per;
    const seedB = po.seeds.indexOf(b) % per;
    next.push(seedA <= seedB ? { home: a, away: b, result: null } : { home: b, away: a, result: null });
  }
  po.rounds.push(next);
  po.round++;
  return true;
}

export function isEliminated(league, teamId) {
  if (!league.playoffs) return false;
  if (!league.playoffs.seeds.includes(teamId)) return true;
  for (const r of league.playoffs.rounds) for (const g of r) if (g.result && loserOf(g) === teamId) return true;
  return false;
}

/** Find this week's game for a team: regular season week or current playoff round. */
export function findGame(league, teamId) {
  if (league.phase === 'regular') {
    const wk = league.schedule[league.week];
    return wk ? wk.find((g) => g.home === teamId || g.away === teamId) ?? null : null;
  }
  if (league.phase === 'playoffs') {
    const r = league.playoffs.rounds[league.playoffs.round];
    return r.find((g) => !g.result && (g.home === teamId || g.away === teamId)) ?? null;
  }
  return null;
}

/** Quick-sim every other unplayed game this week / playoff round. */
export function simOtherGames(state, league, exceptGame) {
  const list = league.phase === 'regular' ? league.schedule[league.week] : league.playoffs.rounds[league.playoffs.round];
  for (const g of list) {
    if (g === exceptGame || g.result) continue;
    const r = quickSim(state, league, g.home, g.away);
    recordResult(league, g, r.home, r.away, league.phase === 'regular');
  }
}

/** Yearly pro roster churn: aging, retirements, contracts, rookies. */
export function proOffseason(state, league) {
  league.year = state.career.year;
  const keep = [];
  for (const p of league.players) {
    p.age++;
    const growth = p.age <= 25 ? gauss(state, 2.2, 1.5) * p.pot : p.age <= 29 ? gauss(state, 0.3, 1.2) : gauss(state, -2.2, 1.4);
    p.ovr = clamp(Math.round(p.ovr + growth), 40, 98);
    const retire = p.age >= 37 || (p.age >= 31 && p.ovr < 60 && chance(state, 0.5)) || (p.age >= 34 && chance(state, 0.35));
    if (retire) continue;
    p.years--;
    if (p.years <= 0) {
      if (chance(state, 0.7)) {
        p.years = randInt(state, 1, 4);
        p.salary = salaryFor(p.ovr, p.pos);
      } else {
        p.teamId = null; // free agent
        p.years = randInt(state, 1, 3);
        p.salary = salaryFor(p.ovr, p.pos);
      }
    }
    keep.push(p);
  }
  league.players = keep;
  // Fill each team's roster holes, worst teams first, from free agents then rookies.
  const order = standings(league).reverse();
  for (const t of order) {
    const roster = league.players.filter((p) => p.teamId === t.id);
    const need = ROSTER_TEMPLATE.slice();
    for (const p of roster) {
      const i = need.indexOf(p.pos);
      if (i >= 0) need.splice(i, 1);
    }
    for (const pos of need) {
      const fa = league.players.filter((p) => p.teamId === null && p.pos === pos).sort((a, b) => b.ovr - a.ovr)[0];
      if (fa && chance(state, 0.6)) fa.teamId = t.id;
      else league.players.push(genProPlayer(state, league, pos, t.id, t.base - 6 + gauss(state, 0, 3), 22));
    }
  }
  league.players = league.players.filter((p) => p.teamId !== null);
  // Keep every team under the salary cap by trimming the most expensive extras.
  for (const t of league.teams) {
    let guard = 0;
    while (capSpace(league, t.id) < 8e6 && guard++ < 10) {
      const roster = league.players.filter((p) => p.teamId === t.id).sort((a, b) => b.salary - a.salary);
      roster[0].salary = Math.round(roster[0].salary * 0.85);
    }
  }
  resetSeason(state, league);
}

export function resetSeason(state, league) {
  for (const t of league.teams) {
    t.w = 0; t.l = 0; t.pf = 0; t.pa = 0; t.streak = 0;
    // Lower levels drift: programs rise and fall.
    if (league.kind !== 'pro') t.base = clamp(t.base + gauss(state, 0, 3), 45, 85);
  }
  league.week = 0;
  league.phase = 'regular';
  league.playoffs = null;
  league.champion = null;
  league.leaders = null;
  league.year = state.career.year;
  refreshTeamRatings(state, league);
  league.schedule = makeSchedule(state, league.teams.map((t) => t.id), STAGES[league.kind].games);
}
