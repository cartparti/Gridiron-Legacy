// The career state machine. The UI and the balance bot both drive the game through
// these functions, so whatever the bot can do, a player can do, and vice versa.
//
// state.phase is one of:
//   event            a weekly event is waiting for a choice       -> resolveEvent()
//   plan             pick this week's schedule                     -> submitPlan()
//   game             game in progress (state.game)                 -> stepGame/resolveMoment, then finishGame()
//   postgame         game summary (state.lastGame)                 -> continueAfterGame()
//   review           season review (state.review)                  -> continueAfterReview()
//   offseason_event  offseason event waiting                       -> resolveEvent()
//   camp             offseason training focus                      -> chooseCamp()
//   recruiting       pick a college (state.offers)                 -> chooseCollege()
//   declare          leave college early?                          -> declareForDraft()
//   draft            draft results (state.draft)                   -> ackDraft()
//   contract         free agency offers (state.offers)             -> signContract() / retire()
//   retired          career over (state.legacy)
import { STAGES, START_YEAR, RETIRE_AGE, EARLY_RETIRE_AGE, MIN_SALARY, ROOKIE_CONTRACT_YEARS } from '../data/config.js';
import { STAT_KEYS } from '../data/positions.js';
import { COLLEGE_TEAMS } from '../data/teams.js';
import { INVESTMENTS } from '../data/lifestyle.js';
import { clamp } from '../core/util.js';
import { newSeed, gauss, chance, pick, randInt, shuffle, rand } from '../core/rng.js';
import { createAthlete, emptyStats, addStats, applyTraining, ageProgression, refreshOverall } from './player.js';
import {
  createLeague, getTeam, findGame, recordResult, simOtherGames, seedPlayoffs, advancePlayoffRound,
  isEliminated, proOffseason, resetSeason, standings, salaryFor, capSpace, genName, roundName,
} from './league.js';
import { createUserGame, letterGrade, chooseWeather, initWeather } from './game.js';
import { rollEvent, chooseOption } from './events.js';
import { newWeek, applyPlan } from './week.js';
import { newInjury, applyInjury, genPersonName } from './effects.js';
import { addNews, postGamePress } from './press.js';
import { addXp } from './progress.js';
import { seasonAwards, checkRecords, genLeaders, seedRecords, seedHistory, seasonPerf, recordLeagueAwards } from './awards.js';
import { computeLegacy } from './legacy.js';
import { genTeammates } from './social.js';
import { postGameTexts, weeklyTexts, textFrom } from './phone.js';

// ---------------------------------------------------------------- new career

export function newCareer(opts) {
  const seed = opts.seed ?? newSeed();
  const state = {
    version: 1,
    seed,
    rngState: seed >>> 0,
    createdAt: Date.now(),
    phase: 'init',
    career: { stage: 'hs', stageSeason: 1, year: START_YEAR, teamId: opts.hsTeamId, teamAbbr: opts.hsTeamId, rivalTeamId: null },
    news: [],
    seenEvents: {},
    chainQueue: [],
    records: null,
    proHistory: [],
    tutorial: { done: {} },
    difficulty: opts.difficulty ?? 'normal',
  };
  const rival = genName(state);
  state.player = createAthlete(state, { ...opts, rivalName: `${rival.first} ${rival.last}`, coachName: genPersonName(state) });
  state.league = createLeague(state, 'hs');
  if (!getTeam(state.league, opts.hsTeamId)) state.career.teamId = state.league.teams[0].id;
  pickRivalTeam(state);
  state.player.seasonStats = emptyStats();
  addNews(state, 'story', `${state.player.first} ${state.player.last} joins the ${teamName(state)} varsity as a sophomore ${state.player.position}.`);
  beginWeek(state);
  return state;
}

export function teamName(state, id = state.career.teamId) {
  const t = getTeam(state.league, id);
  return t ? `${t.city} ${t.name}` : '';
}

function pickRivalTeam(state) {
  const mine = getTeam(state.league, state.career.teamId);
  const others = state.league.teams.filter((t) => t.id !== state.career.teamId);
  // High school: the crosstown school is the rival.
  const crosstown = others.filter((t) => t.town && mine?.town && t.town === mine.town);
  if (crosstown.length) { state.career.rivalTeamId = pick(state, crosstown).id; return; }
  const sameConf = others.filter((t) => t.conf && t.conf === mine?.conf);
  const pool = (sameConf.length ? sameConf : others).slice().sort((a, b) => b.base - a.base).slice(0, 4);
  state.career.rivalTeamId = pick(state, pool).id;
}

function newCoach(state) {
  state.player.coachName = genPersonName(state);
  state.player.rel.coach = 50;
  state.player.coachLook = null;
  genTeammates(state); // new team, new friends
}

// ---------------------------------------------------------------- weekly loop

export function beginWeek(state) {
  const p = state.player;
  const c = state.career;
  // Trades and transfers only take effect during the regular season, never mid-playoffs.
  if (c.pendingMove && !getTeam(state.league, c.pendingMove)) delete c.pendingMove; // stale (changed leagues)
  if (c.pendingMove && state.league.phase === 'regular') {
    const old = teamName(state);
    c.teamId = c.pendingMove;
    c.teamAbbr = c.teamId;
    delete c.pendingMove;
    if (p.contract) p.contract.teamId = c.teamId;
    newCoach(state);
    p.rel.teammates = 40;
    if (c.rivalTeamId === c.teamId) pickRivalTeam(state);
    addNews(state, 'story', `${p.first} ${p.last} leaves the ${old} for the ${teamName(state)}.`);
  }
  newWeek(state);
  {
    const m = currentMatchup(state);
    state.week.forecast = chooseWeather(state, state.league, !!m?.playoff, m ? m.oppId === c.rivalTeamId : false);
  }
  if (c.stage !== 'pro' && p.academics < 30 && !p.suspended) {
    p.suspended = 1;
    state.week.notice = 'Your grades dropped too low. You are academically ineligible this week.';
    addNews(state, 'scandal', `${p.first} ${p.last} ruled academically ineligible.`);
  }
  weeklyTexts(state);
  const ev = rollEvent(state, 'season', 0.5);
  if (ev) {
    state.pendingEvent = ev;
    state.phase = 'event';
  } else state.phase = 'plan';
}

export function resolveEvent(state, choiceIdx) {
  const pending = state.pendingEvent;
  const res = chooseOption(state, pending, choiceIdx);
  state.lastEventResult = { title: pending.title, ...res };
  state.pendingEvent = null;
  state.phase = state.phase === 'offseason_event' ? 'camp' : 'plan';
  return res;
}

/** What the player must or may do about game day this week. */
export function gameDayStatus(state) {
  const p = state.player;
  if (p.suspended > 0) return { canPlay: false, reason: `Suspended (${p.suspended} game${p.suspended > 1 ? 's' : ''})` };
  if (p.injury?.major) return { canPlay: false, reason: `${p.injury.label}: ${p.injury.weeks} wk` };
  if (p.injury) return { canPlay: true, hurt: true, reason: `${p.injury.label}: ${p.injury.weeks} wk` };
  return { canPlay: true };
}

export function currentMatchup(state) {
  const g = findGame(state.league, state.career.teamId);
  if (!g) return null;
  const home = g.home === state.career.teamId;
  return { sched: g, home, oppId: home ? g.away : g.home, playoff: state.league.phase === 'playoffs' };
}

/** Apply the week's schedule and start the game. `playHurt` only matters when injured. */
export function submitPlan(state, plan, { playHurt = false } = {}) {
  const summary = applyPlan(state, plan);
  const status = gameDayStatus(state);
  const sitOut = !status.canPlay || (status.hurt && !playHurt);
  const league = state.league;
  const sched = findGame(league, state.career.teamId);
  const playoff = league.phase === 'playoffs';
  const round = playoff ? league.playoffs.round : 0;
  state.game = initWeather(state, createUserGame(state, league, sched, { playoff, round, sitOut, playingHurt: !sitOut && !!state.player.injury }));
  state.game.isTitle = playoff && league.playoffs.rounds[round].length === 1;
  state.game.roundName = playoff ? roundName(league, round) : `Week ${league.week + 1}`;
  state.week.summary = summary;
  state.phase = 'game';
  return summary;
}

const STAGE_FAME = { hs: 0.6, college: 1.0, pro: 1.25 };

export function finishGame(state) {
  const g = state.game;
  const p = state.player;
  const league = state.league;
  const sched = findGame(league, state.career.teamId);
  recordResult(league, sched, g.score.home, g.score.away, league.phase === 'regular');
  const before = { fame: p.fame, coach: p.rel.coach, mood: p.mood };
  let newInj = null;
  const hadInjury = !!p.injury;
  if (!g.sitOut) {
    g.userStats.games = 1;
    g.userStats.wins = g.won ? 1 : 0;
    g.userStats.grades = g.grade;
    addStats(p.seasonStats, g.userStats);
    addStats(p.careerStats, g.userStats);
    if (state.career.stage === 'pro') addStats(p.proCareerStats, g.userStats);
    const sm = STAGE_FAME[state.career.stage];
    let fame = ((g.grade - 55) / 12) * sm + (g.won ? 0.5 : 0) + g.userStats.clutch * 0.8;
    if (g.playoff) fame += 1;
    if (g.rivalry && g.won) fame += 2;
    if (g.isTitle && g.won) fame += 6;
    p.fame = clamp(p.fame + Math.max(-2, fame), 0, 100);
    p.rel.coach = clamp(p.rel.coach + (g.grade - 58) / 9, 0, 100);
    p.rel.teammates = clamp(p.rel.teammates + (g.won ? 2 : -1), 0, 100);
    p.mood = clamp(p.mood + (g.won ? 5 : -4) + (g.grade - 60) / 10, 0, 100);
    g.levelUps = addXp(state, Math.round(10 + g.grade * 0.55 + (g.won ? 10 : 0) + (g.playoff ? 15 : 0)));
    p.health = clamp(p.health - (4 + g.moments.length * 1.5), 0, 100);
    if (g.rivalry) p.rel.rival = clamp(p.rel.rival + 5, 0, 100);
    // Injury roll.
    const risky = g.moments.filter((m) => m.call === 'risky').length;
    const pInj = 0.022 + (1 - p.health / 100) * 0.05 + risky * 0.008 - (p.stats.strength / 100) * 0.012 + (g.playingHurt ? 0.08 : 0);
    if (chance(state, Math.max(0.005, pInj))) {
      newInj = newInjury(state, { allowMajor: true });
      applyInjury(state, newInj);
    }
  } else {
    p.mood = clamp(p.mood + (g.won ? 1 : -2), 0, 100);
    if (p.suspended > 0) p.suspended--;
  }
  // Injury recovery: a week passes.
  if (hadInjury && p.injury && p.injury !== newInj) {
    if (g.playingHurt && chance(state, 0.3)) {
      p.injury.weeks += randInt(state, 1, 2);
      addNews(state, 'injury', `${p.last} aggravates the ${p.injury.label.toLowerCase()} playing through it.`);
    } else p.injury.weeks--;
    if (p.injury.weeks <= 0) {
      addNews(state, 'injury', `${p.last} is fully healed from the ${p.injury.label.toLowerCase()}.`);
      p.injury = null;
    }
  }
  const opp = getTeam(league, g.oppId);
  const press = postGamePress(state, g, `${opp.city}`, teamName(state));
  simOtherGames(state, league, sched);
  state.lastGame = {
    won: g.won,
    score: { ...g.score },
    userSide: g.userSide,
    homeId: g.homeId,
    awayId: g.awayId,
    oppId: g.oppId,
    grade: g.grade,
    letter: letterGrade(g.grade),
    userStats: g.userStats,
    moments: g.moments,
    sitOut: g.sitOut,
    playoff: g.playoff,
    isTitle: g.isTitle,
    roundName: g.roundName,
    rivalry: g.rivalry,
    headline: press.headline,
    outlet: press.outlet,
    deltas: { fame: p.fame - before.fame, coach: p.rel.coach - before.coach, mood: p.mood - before.mood },
    injury: newInj,
    log: g.log,
    weather: g.weather,
  };
  postGameTexts(state, state.lastGame);
  state.game = null;
  state.phase = 'postgame';
}

export function continueAfterGame(state) {
  const league = state.league;
  league.week++;
  if (league.phase === 'regular') {
    if (league.week < league.schedule.length) return beginWeek(state);
    seedPlayoffs(league);
    const madeIt = league.playoffs.seeds.includes(state.career.teamId);
    addNews(state, 'story', madeIt ? `The ${teamName(state)} are headed to the playoffs!` : `The ${teamName(state)} miss the playoffs.`);
  } else if (league.phase === 'playoffs') {
    advancePlayoffRound(league);
  }
  return playoffStep(state);
}

function playoffStep(state) {
  const league = state.league;
  while (league.phase === 'playoffs' && isEliminated(league, state.career.teamId)) {
    simOtherGames(state, league, null);
    advancePlayoffRound(league);
  }
  if (league.phase === 'done') return endSeason(state);
  return beginWeek(state);
}

// ---------------------------------------------------------------- season end

export function endSeason(state) {
  const p = state.player;
  const c = state.career;
  const league = state.league;
  const team = getTeam(league, c.teamId);
  const champion = league.champion === c.teamId;
  const champTeam = getTeam(league, league.champion);
  addNews(state, 'story', `${champTeam.city} ${champTeam.name} win the ${STAGES[c.stage].titleName}!`);
  if (c.stage === 'pro') league.leaders = genLeaders(state, league);
  const proSeasonsBefore = p.history.filter((h) => h.stage === 'pro').length;
  const lastHist = p.history[p.history.length - 1];
  const missedLastSeason = !!lastHist && lastHist.stage === 'pro' && lastHist.seasonStats.games < 7;
  const titleGrade = champion && state.lastGame?.isTitle ? state.lastGame.grade : 0;
  const aw = seasonAwards(state, { champion, titleGrade, rookie: c.stage === 'pro' && proSeasonsBefore === 0, missedLastSeason });
  const records = c.stage === 'pro' ? checkRecords(state, league) : [];
  recordLeagueAwards(state, aw.awards);
  addXp(state, aw.awards.length * 60 + (champion ? 120 : 0));
  const entry = {
    year: c.year,
    age: p.age,
    stage: c.stage,
    stageSeason: c.stageSeason,
    teamId: c.teamId,
    teamName: teamName(state),
    colors: team.colors.slice(),
    ovr: Math.round(p.ovr * 10) / 10,
    stats: { ...p.stats },
    seasonStats: { ...p.seasonStats },
    record: `${team.w}-${team.l}`,
    awards: aw.awards,
    champion,
    madePlayoffs: !!league.playoffs?.seeds?.includes(c.teamId),
    seed: (league.playoffs?.seeds?.indexOf(c.teamId) ?? -1) + 1 || null,
    perf: aw.perf,
    fame: Math.round(p.fame),
  };
  p.history.push(entry);
  if (c.stage === 'pro') state.proHistory.push({ year: c.year, champion: league.champion, mvp: aw.awards.includes('Most Valuable Player') ? `${p.first} ${p.last}` : null });

  // Money: investments grow or shrink.
  const invest = [];
  for (const [id, amt] of Object.entries(p.investments)) {
    const inv = INVESTMENTS.find((i) => i.id === id);
    if (!inv || amt <= 0) continue;
    const r = Math.max(-0.95, gauss(state, inv.mean, inv.sd));
    const next = Math.round(amt * (1 + r));
    invest.push({ label: inv.label, from: amt, to: next, r });
    p.investments[id] = next;
  }

  const ageChanges = ageProgression(state);
  const ovrBefore = entry.ovr;
  p.age++;
  p.fame = clamp(p.fame * (c.stage === 'pro' ? 0.93 : 0.9), 0, 100);
  p.health = clamp(p.health + 30, 0, 100);
  if (p.injury) {
    p.injury.weeks = Math.max(0, p.injury.weeks - 10);
    if (p.injury.weeks === 0) p.injury = null;
  }
  p.suspended = 0;
  if (c.stage !== 'pro') p.academics = Math.max(p.academics, 65);
  if (p.contract) p.contract.years--;

  state.review = {
    year: c.year,
    stage: c.stage,
    stageSeason: c.stageSeason,
    record: entry.record,
    seed: league.playoffs?.seeds.indexOf(c.teamId) ?? -1,
    champion,
    championId: league.champion,
    awards: aw.awards,
    perf: aw.perf,
    records,
    invest,
    ageChanges,
    ovrBefore,
    ovrAfter: Math.round(p.ovr * 10) / 10,
    seasonStats: { ...p.seasonStats },
    leaders: league.leaders,
    standings: standings(league).map((t) => ({ id: t.id, w: t.w, l: t.l })),
  };
  state.phase = 'review';
}

export function continueAfterReview(state) {
  state.review = null;
  const ev = rollEvent(state, 'offseason', 0.85);
  if (ev) {
    state.pendingEvent = ev;
    state.phase = 'offseason_event';
  } else state.phase = 'camp';
}

/** Can the player retire now (at the camp screen)? */
export function canRetire(state) {
  return state.career.stage === 'pro' && state.player.age >= EARLY_RETIRE_AGE;
}

/** Offseason training focus: one stat gets a big boost, or rest fully. */
export function chooseCamp(state, focus) {
  const p = state.player;
  let changes = {};
  if (focus === 'retire' && canRetire(state)) return retire(state, 'choice');
  if (STAT_KEYS.includes(focus)) changes = applyTraining(p, { [focus]: 3.2 });
  else {
    p.health = 100;
    p.mood = clamp(p.mood + 15, 0, 100);
    for (const k of STAT_KEYS) changes[k] = 0;
  }
  state.campResult = { focus, changes };
  return nextStageStep(state);
}

function nextStageStep(state) {
  const c = state.career;
  const p = state.player;
  c.year++;
  if (c.stage === 'hs') {
    if (c.stageSeason < STAGES.hs.seasons) {
      c.stageSeason++;
      return startNewSeason(state, { reset: true });
    }
    state.offers = collegeOffers(state);
    state.phase = 'recruiting';
    return;
  }
  if (c.stage === 'college') {
    if (c.stageSeason === 2 && p.ovr >= 68) { state.phase = 'declare'; return; }
    if (c.stageSeason < STAGES.college.seasons) {
      c.stageSeason++;
      return startNewSeason(state, { reset: true });
    }
    return runDraft(state, false);
  }
  // Pro
  if (p.age > RETIRE_AGE) return retire(state, 'age');
  const peak = Math.max(...p.history.map((h) => h.ovr));
  if (p.ovr < 60 || (p.age >= 32 && p.ovr < peak - 8)) return retire(state, 'decline');
  c.stageSeason++;
  if (!p.contract || p.contract.years <= 0) {
    proOffseason(state, state.league);
    state.offers = contractOffers(state);
    if (!state.offers.length) return retire(state, 'unsigned');
    state.phase = 'contract';
    return;
  }
  proOffseason(state, state.league);
  return startNewSeason(state, { reset: false });
}

function startNewSeason(state, { reset }) {
  if (reset) resetSeason(state, state.league);
  const p = state.player;
  p.seasonStats = emptyStats();
  state.career.teamAbbr = state.career.teamId;
  if (!getTeam(state.league, state.career.rivalTeamId) || state.career.rivalTeamId === state.career.teamId) pickRivalTeam(state);
  beginWeek(state);
}

// ---------------------------------------------------------------- college recruiting

/**
 * College offers: every school rolls its own interest based on your rating, fame and awards
 * versus its prestige, plus a big dose of luck, so each career sees a different mix of schools.
 */
export function collegeOffers(state) {
  const p = state.player;
  const awardsHs = p.awards.filter((a) => a.stage === 'hs').length;
  const hsGames = p.history.filter((h) => h.stage === 'hs');
  const perfAvg = hsGames.length ? hsGames.reduce((a, h) => a + (h.perf ?? 50), 0) / hsGames.length : 50;
  const score = p.ovr + p.fame * 0.2 + awardsHs * 2 + (perfAvg - 50) * 0.15;
  const list = createLeague(state, 'college').teams;
  const offers = [];
  for (const t of shuffle(state, list)) {
    const need = 46 + t.prestige * 3.2;
    const pInterest = clamp(0.12 + (score - need) * 0.06, 0.03, 0.85);
    if (rand(state) < pInterest) offers.push(t);
  }
  // Always a couple of options, from random smaller programs.
  const small = shuffle(state, list.filter((t) => t.prestige <= 2 && !offers.includes(t)));
  while (offers.length < 3 && small.length) offers.push(small.pop());
  const pitches = ['Starting job from day one.', 'National TV every Saturday.', 'Our offense was built for a player like you.', 'Family atmosphere. Coach calls your mom weekly.', 'State-of-the-art facilities.', 'We develop pros.', 'Early playing time, guaranteed.', 'A degree that opens doors.', 'Our fans sell out every game.', 'Close to home.'];
  return offers.sort((a, b) => b.prestige - a.prestige).slice(0, 6).map((t) => ({
    teamId: t.id, city: t.city, name: t.name, colors: t.colors, prestige: t.prestige, base: t.base, conf: t.conf, pitch: pick(state, pitches),
  }));
}

export function chooseCollege(state, teamId) {
  const p = state.player;
  const c = state.career;
  const offer = state.offers.find((o) => o.teamId === teamId) ?? state.offers[0];
  c.stage = 'college';
  c.stageSeason = 1;
  state.league = createLeague(state, 'college');
  c.teamId = offer.teamId;
  newCoach(state);
  p.rel.teammates = 45;
  if (p.housing === 'parents') p.housing = 'dorm';
  p.fame = p.fame * 0.85;
  state.offers = null;
  addNews(state, 'story', `${p.first} ${p.last} commits to ${offer.city}!`);
  textFrom(state, 'family', `${offer.city}!!! We are so proud of you. Your mom already ordered the sweatshirt.`);
  startNewSeason(state, { reset: false });
}

export function declareForDraft(state, yes) {
  if (yes) return runDraft(state, true);
  state.career.stageSeason++;
  addNews(state, 'story', `${state.player.last} returns for a senior season.`);
  return startNewSeason(state, { reset: true });
}

// ---------------------------------------------------------------- draft

function rookieSalary(pick) {
  return Math.max(MIN_SALARY, Math.round((11e6 * Math.exp(-(pick - 1) / 20)) / 10000) * 10000);
}

/** How badly a pro team needs a position: weak or aging starters create need. 0..~30 */
export function teamNeed(league, teamId, pos) {
  if (pos === 'DT') pos = 'DL';
  const roster = league.players.filter((x) => x.teamId === teamId && x.pos === pos).sort((a, b) => b.ovr - a.ovr);
  const take = { QB: 1, RB: 1, WR: 3, TE: 1, OL: 5, DL: 4, LB: 3, CB: 3, S: 2, K: 1 }[pos] ?? 1;
  const starters = roster.slice(0, take);
  if (!starters.length) return 30;
  const worst = starters[starters.length - 1];
  return clamp((76 - worst.ovr) * 1.1 + Math.max(0, worst.age - 30) * 3 + (roster.length < take ? 15 : 0), 0, 30);
}

/** Draft stock from your college career: rating, production, awards, fame, team success. */
export function draftStock(state) {
  const p = state.player;
  const col = p.history.filter((h) => h.stage === 'college');
  const perf = col.length ? col.reduce((a, h) => a + (h.perf ?? 50), 0) / col.length : 50;
  const best = col.length ? Math.max(...col.map((h) => h.perf ?? 50)) : 50;
  const awards = p.awards.filter((a) => a.stage === 'college');
  const big = awards.filter((a) => /Ironstone|Champion/.test(a.name)).length;
  const wins = col.reduce((a, h) => a + Number(h.record.split('-')[0]), 0) / Math.max(1, col.length);
  return { value: p.ovr * 0.8 + (perf - 50) * 0.35 + (best - 50) * 0.15 + awards.length * 1.6 + big * 3 + p.fame * 0.08 + wins * 0.3 + 12, perf: Math.round(perf), awards: awards.length };
}

export function runDraft(state, early) {
  const p = state.player;
  const c = state.career;
  const league = createLeague(state, 'pro');
  state.records = state.records ?? seedRecords(state);
  if (!state.proHistory.length) state.proHistory = seedHistory(state, league);
  // Draft order: weakest teams pick first.
  const order = league.teams.slice().sort((a, b) => a.base + gauss(state, 0, 4) - (b.base + gauss(state, 0, 4))).map((t) => t.id);
  const posPool = ['QB', 'RB', 'WR', 'WR', 'TE', 'OL', 'OL', 'OL', 'DL', 'DL', 'LB', 'LB', 'CB', 'CB', 'S', 'K'];
  const prospects = [];
  const collegeIds = COLLEGE_TEAMS.map((t) => t.id);
  for (let i = 0; i < 240; i++) {
    const n = genName(state);
    prospects.push({ name: `${n.first} ${n.last}`, pos: pick(state, posPool), stock: gauss(state, 62, 9), college: pick(state, collegeIds) });
  }
  const ds = draftStock(state);
  const me = { name: `${p.first} ${p.last}`, pos: p.position, stock: ds.value - (early ? 1 : 0) + gauss(state, 0, 2), user: true, college: c.teamId };
  prospects.push(me);
  // Each pick: the team takes the best mix of talent and need, with a little unpredictability.
  const need = {};
  for (const t of order) need[t] = {};
  const board = [];
  let pickNo = 0;
  let userPick = null;
  let reason = null;
  const available = prospects.slice();
  for (let round = 1; round <= 7 && !userPick; round++) {
    for (const teamId of order) {
      pickNo++;
      let best = null;
      let bestScore = -Infinity;
      for (const pr of available) {
        const nd = need[teamId][pr.pos] ?? (need[teamId][pr.pos] = teamNeed(league, teamId, pr.pos));
        const score = pr.stock + nd * 0.35 + gauss(state, 0, 1.5) - (pr.pos === 'K' ? 8 : 0);
        if (score > bestScore) { bestScore = score; best = pr; }
      }
      available.splice(available.indexOf(best), 1);
      need[teamId][best.pos] = Math.max(0, (need[teamId][best.pos] ?? 0) - 15); // need filled
      if (pickNo <= 32 || best.user) board.push({ pick: pickNo, name: best.name, pos: best.pos, team: teamId, user: !!best.user, college: best.college });
      if (best.user) {
        userPick = { pick: pickNo, round, teamId };
        const nd = teamNeed(league, teamId, p.position);
        const starter = league.players.filter((x) => x.teamId === teamId && x.pos === p.position).sort((a, b) => b.ovr - a.ovr)[0];
        reason = nd >= 12 && starter
          ? `The ${getTeam(league, teamId).name} needed a ${p.position}: their starter ${starter.first} ${starter.last} is ${starter.age} with a ${starter.ovr} rating.`
          : `The ${getTeam(league, teamId).name} took the best player on their board: you.`;
        break;
      }
    }
  }
  const undrafted = !userPick;
  // Undrafted: the team with the biggest need at your position signs you.
  const teamId = undrafted ? order.slice().sort((a, b) => teamNeed(league, b, p.position) - teamNeed(league, a, p.position))[0] : userPick.teamId;
  const pickNum = undrafted ? 999 : userPick.pick;
  const salary = undrafted ? MIN_SALARY : rookieSalary(pickNum);
  if (undrafted) reason = `Nobody called your name, but the ${getTeam(league, teamId).name} needed a ${p.position} and offered a tryout deal.`;
  state.league = league;
  c.stage = 'pro';
  c.stageSeason = 1;
  c.teamId = teamId;
  p.contract = { teamId, years: ROOKIE_CONTRACT_YEARS, salary, rookie: true };
  newCoach(state);
  p.rel.teammates = 45;
  if (p.housing === 'dorm' || p.housing === 'parents') p.housing = 'offcampus';
  p.draft = { pick: pickNum, round: undrafted ? 0 : userPick.round, teamId, undrafted, year: c.year };
  state.draft = { pick: pickNum, round: undrafted ? 0 : userPick.round, teamId, undrafted, salary, board, early, reason, stock: ds };
  addNews(state, 'story', undrafted
    ? `${p.first} ${p.last} goes undrafted but signs with ${teamName(state)}.`
    : `With pick #${pickNum}, the ${teamName(state)} select ${p.first} ${p.last}!`);
  textFrom(state, 'family', undrafted ? 'We believe in you. Go prove them all wrong. ❤️' : `PICK #${pickNum}!!! We are crying. Our kid is a pro!!`);
  state.phase = 'draft';
}

export function ackDraft(state) {
  state.draft = null;
  startNewSeason(state, { reset: false });
}

// ---------------------------------------------------------------- free agency

export function marketValue(state) {
  const p = state.player;
  let v = salaryFor(p.ovr, p.position) * (1 + p.fame / 250);
  v *= p.agentName ? 1 + ((p.rel.agent ?? 50) - 40) / 300 : 0.92;
  if (p.age >= 33) v *= 0.6;
  else if (p.age >= 31) v *= 0.8;
  return Math.round(v / 10000) * 10000;
}

export function contractOffers(state) {
  const p = state.player;
  const league = state.league;
  const value = marketValue(state);
  const cur = state.career.teamId;
  const others = shuffle(state, league.teams.filter((t) => t.id !== cur)).slice(0, 5);
  const candidates = [];
  if (p.rel.coach >= 35 || p.ovr >= 75) candidates.push(getTeam(league, cur));
  // Fewer teams call as you age or slip.
  const interest = clamp(Math.round(4 - Math.max(0, p.age - 29) * 0.6 - Math.max(0, 72 - p.ovr) / 4), 0, 4);
  candidates.push(...others.slice(0, interest));
  const ranks = standings(league).map((t) => t.id);
  const offers = [];
  for (const t of candidates) {
    const space = capSpace(league, t.id);
    let salary = Math.round((value * clamp(gauss(state, 1, 0.08), 0.8, 1.2) * (t.id === cur ? 1.03 : 1)) / 10000) * 10000;
    salary = Math.min(salary, Math.max(0, space - 2e6));
    if (salary < MIN_SALARY) continue;
    const maxYears = p.age <= 27 ? 5 : p.age <= 30 ? 3 : 2;
    offers.push({
      teamId: t.id, city: t.city, name: t.name, colors: t.colors, salary, years: randInt(state, Math.max(1, maxYears - 2), maxYears),
      capSpace: space, contender: Math.round((t.off + t.def) / 2), lastRank: ranks.indexOf(t.id) + 1, loyal: t.id === cur,
    });
  }
  if (!offers.length && p.ovr >= 58) {
    const worst = standings(league).slice(-1)[0];
    offers.push({ teamId: worst.id, city: worst.city, name: worst.name, colors: worst.colors, salary: MIN_SALARY, years: 1, capSpace: capSpace(league, worst.id), contender: Math.round((worst.off + worst.def) / 2), lastRank: 30, loyal: false, prove: true });
  }
  return offers.sort((a, b) => b.salary - a.salary);
}

export function signContract(state, idx) {
  const p = state.player;
  const o = state.offers[idx];
  const moved = o.teamId !== state.career.teamId;
  p.contract = { teamId: o.teamId, years: o.years, salary: o.salary, rookie: false };
  if (moved) {
    state.career.teamId = o.teamId;
    newCoach(state);
    p.rel.teammates = 45;
    addNews(state, 'story', `${p.first} ${p.last} signs a ${o.years}-year deal with the ${o.city} ${o.name}.`);
  } else addNews(state, 'story', `${p.first} ${p.last} re-signs with the ${o.city} ${o.name}: ${o.years} years.`);
  if (p.agentName) p.rel.agent = clamp(p.rel.agent + 5, 0, 100);
  state.offers = null;
  startNewSeason(state, { reset: false });
}

// ---------------------------------------------------------------- retirement

export function retire(state, reason) {
  const p = state.player;
  state.career.stage = 'retired';
  state.legacy = computeLegacy(state);
  state.legacy.reason = reason;
  state.phase = 'retired';
  addNews(state, 'story', `${p.first} ${p.last} retires. Legacy: ${state.legacy.tier.label}.`);
}
