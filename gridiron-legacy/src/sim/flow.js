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
import { INVESTMENTS } from '../data/lifestyle.js';
import { clamp } from '../core/util.js';
import { newSeed, gauss, chance, pick, randInt, shuffle } from '../core/rng.js';
import { createAthlete, emptyStats, addStats, applyTraining, ageProgression, refreshOverall } from './player.js';
import {
  createLeague, getTeam, findGame, recordResult, simOtherGames, seedPlayoffs, advancePlayoffRound,
  isEliminated, proOffseason, resetSeason, standings, salaryFor, capSpace, genName, roundName,
} from './league.js';
import { createUserGame, letterGrade } from './game.js';
import { rollEvent, chooseOption } from './events.js';
import { newWeek, applyPlan } from './week.js';
import { newInjury, applyInjury, genPersonName } from './effects.js';
import { addNews, postGamePress } from './press.js';
import { seasonAwards, checkRecords, genLeaders, seedRecords, seedHistory, seasonPerf } from './awards.js';
import { computeLegacy } from './legacy.js';
import { genTeammates } from './social.js';

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
  const others = state.league.teams.filter((t) => t.id !== state.career.teamId);
  const strongest = others.slice().sort((a, b) => b.base - a.base).slice(0, 4);
  state.career.rivalTeamId = pick(state, strongest).id;
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
  if (c.stage !== 'pro' && p.academics < 30 && !p.suspended) {
    p.suspended = 1;
    state.week.notice = 'Your grades dropped too low. You are academically ineligible this week.';
    addNews(state, 'scandal', `${p.first} ${p.last} ruled academically ineligible.`);
  }
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
  state.game = createUserGame(state, league, sched, { playoff, round, sitOut, playingHurt: !sitOut && !!state.player.injury });
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

export function collegeOffers(state) {
  const p = state.player;
  const awardsHs = p.awards.filter((a) => a.stage === 'hs').length;
  const score = p.ovr + p.fame * 0.25 + awardsHs * 2.5 + gauss(state, 0, 2);
  const list = createLeague(state, 'college').teams; // fresh copy for prestige/base
  const offers = [];
  for (const t of list) {
    const need = 40 + t.prestige * 4.5 + gauss(state, 0, 2.5);
    if (score >= need) offers.push(t);
  }
  const sorted = list.slice().sort((a, b) => a.prestige - b.prestige);
  for (const t of sorted) {
    if (offers.length >= 2) break;
    if (!offers.includes(t)) offers.push(t);
  }
  const pitches = ['Starting job from day one.', 'National TV every Saturday.', 'Our offense was built for a player like you.', 'Family atmosphere. Coach calls your mom weekly.', 'State-of-the-art facilities.', 'We develop pros.'];
  return shuffle(state, offers).sort((a, b) => b.prestige - a.prestige).slice(0, 4).map((t) => ({
    teamId: t.id, city: t.city, name: t.name, colors: t.colors, prestige: t.prestige, base: t.base, pitch: pick(state, pitches),
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

export function runDraft(state, early) {
  const p = state.player;
  const c = state.career;
  const league = createLeague(state, 'pro');
  state.records = state.records ?? seedRecords(state);
  if (!state.proHistory.length) state.proHistory = seedHistory(state, league);
  // Draft order: weakest teams pick first.
  const order = league.teams.slice().sort((a, b) => a.base + gauss(state, 0, 4) - (b.base + gauss(state, 0, 4))).map((t) => t.id);
  const posPool = ['QB', 'RB', 'WR', 'WR', 'TE', 'OL', 'OL', 'DL', 'DL', 'LB', 'CB', 'CB', 'S'];
  const prospects = [];
  for (let i = 0; i < 64; i++) {
    const n = genName(state);
    prospects.push({ name: `${n.first} ${n.last}`, pos: pick(state, posPool), stock: gauss(state, 70, 6.5), college: pick(state, ['NRS', 'BEL', 'LKT', 'MAR', 'PAC', 'SVS', 'HVU', 'CPU']) });
  }
  const collegeAwards = p.awards.filter((a) => a.stage === 'college').length;
  const userStock = p.ovr * 1.0 + p.fame * 0.1 + collegeAwards * 2 + gauss(state, 0, 2.5) - (early ? 1 : 0);
  const sorted = prospects.slice().sort((a, b) => b.stock - a.stock);
  let pickNo = 1 + sorted.filter((x) => x.stock > userStock).length;
  if (pickNo > 64) pickNo = Math.round(64 + (sorted[63].stock - userStock) * 14);
  const undrafted = pickNo > 210;
  const teamId = undrafted ? order[randInt(state, 0, 9)] : order[(pickNo - 1) % 30];
  const salary = undrafted ? MIN_SALARY : rookieSalary(pickNo);
  // Board for the draft-night screen.
  const board = [];
  let si = 0;
  for (let n = 1; n <= 32; n++) {
    if (n === pickNo) board.push({ pick: n, name: `${p.first} ${p.last}`, pos: p.position, team: order[(n - 1) % 30], user: true });
    else { const pr = sorted[si++]; board.push({ pick: n, name: pr.name, pos: pr.pos, team: order[(n - 1) % 30], college: pr.college }); }
  }
  state.league = league;
  c.stage = 'pro';
  c.stageSeason = 1;
  c.teamId = teamId;
  p.contract = { teamId, years: ROOKIE_CONTRACT_YEARS, salary, rookie: true };
  newCoach(state);
  p.rel.teammates = 45;
  if (p.housing === 'dorm' || p.housing === 'parents') p.housing = 'offcampus';
  p.draft = { pick: pickNo, round: Math.ceil(pickNo / 30), teamId, undrafted, year: c.year };
  state.draft = { pick: pickNo, round: Math.ceil(pickNo / 30), teamId, undrafted, salary, board, early };
  addNews(state, 'story', undrafted
    ? `${p.first} ${p.last} goes undrafted but signs with ${teamName(state)}.`
    : `With pick #${pickNo}, the ${teamName(state)} select ${p.first} ${p.last}!`);
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
