// The user's game: a drive-by-drive simulation that pauses for the player.
//
// stepGame() advances until something needs the player, returning one of:
//   { type: 'moment', moment }      play a key moment -> resolveMoment(state, result)
//   { type: 'decision', decision }  4th down: go for it? -> resolveDecision(state, go)
//   { type: 'gameEvent', event }    mid-game story choice -> resolveGameEvent(state, idx)
//   { type: 'end' }                 game over -> flow.finishGame(state)
//
// Game situations: weather, momentum, two-minute drills (offense) / goal-line stands (defense),
// 4th-down decisions, penalties, extra moments earned through mid-game events.
import { PLAY_CALLS, DIFFICULTIES, WEATHER } from '../data/config.js';
import { GAME_EVENTS } from '../data/gameEvents.js';
import { teamCulture, TRAITS } from '../data/culture.js';
import { clamp, fillTokens } from '../core/util.js';
import { rand, randInt, gauss, chance, pick, weightedPick } from '../core/rng.js';
import { gameRatings, driveOutcome, POINTS, breakTie, getTeam } from './league.js';
import { emptyStats } from './player.js';
import { applyEffects } from './effects.js';
import { eventTokens } from './events.js';
import { gearBonus } from './shop.js';

// Moment types per position with relative weights.
const MOMENT_POOL = {
  QB: [['qb_throw', 7], ['qb_scramble', 2]],
  RB: [['rb_run', 7], ['rb_screen', 2.5]],
  WR: [['wr_route', 6], ['wr_jumpball', 2], ['wr_toetap', 2]],
  CB: [['cb_cover', 6], ['cb_tackle', 3]],
  DT: [['dt_rush', 6], ['dt_run', 3]],
};
export const MOMENT_NAMES = {
  qb_throw: 'Pass Play', qb_scramble: 'Scramble', qb_hailmary: 'Hail Mary',
  rb_run: 'Run Play', rb_screen: 'Screen Pass', rb_goalline: 'Goal-Line Dive',
  wr_route: 'Route & Catch', wr_jumpball: 'Jump Ball', wr_toetap: 'Sideline Toe-Tap',
  cb_cover: 'Coverage', cb_tackle: 'Open-Field Tackle',
  dt_rush: 'Pass Rush', dt_run: 'Run Stop',
};
const PASS_TYPES = new Set(['qb_throw', 'qb_hailmary', 'wr_route', 'wr_jumpball', 'wr_toetap', 'rb_screen', 'cb_cover', 'dt_rush']);
const DEEP_TYPES = new Set(['qb_hailmary', 'wr_jumpball']);
const CONTACT_TYPES = new Set(['rb_run', 'rb_screen', 'rb_goalline', 'qb_scramble', 'wr_route', 'wr_jumpball', 'cb_tackle', 'dt_rush', 'dt_run']);
const MAX_EVENTS = 3;

export const DEF_POSITIONS = new Set(['CB', 'DT']);
export const isDefense = (state) => DEF_POSITIONS.has(state.player.position);

export function momentCount(state, { playoff, rivalry }) {
  const c = state.player.rel.coach;
  // 5-8 drives with a key moment; a series can keep you on the field for more snaps (see resolveMoment).
  let n = 5;
  if (c >= 60) n++;
  if (c >= 80) n++;
  if (playoff || rivalry) n++;
  return clamp(n, 5, 8);
}

/** Pick game-day weather (used for the weekly forecast). Late season brings snow. */
export function chooseWeather(state, league, playoff = false, rivalry = false) {
  const frac = league.week / Math.max(1, league.schedule.length);
  const r = rand(state);
  if (frac > 0.6 && r < 0.18) return 'snow';
  if (r < 0.27) return 'rain';
  if (r < 0.33) return 'storm';
  if (r < 0.42) return 'wind';
  if (r < 0.47) return 'fog';
  if (playoff || rivalry || r > 0.8) return 'night';
  return 'clear';
}

/** Wind as a direction + strength in yards/sec of ball drift. */
export function makeWind(state, weather) {
  const w = WEATHER[weather] ?? WEATHER.clear;
  const strength = w.wind * (0.5 + rand(state) * 0.5);
  const angle = rand(state) * Math.PI * 2;
  return { x: Math.cos(angle) * strength, z: Math.sin(angle) * strength, mph: Math.round(strength * 3.2) };
}

export function createUserGame(state, league, sched, { playoff = false, round = 0, sitOut = false, playingHurt = false } = {}) {
  const userTeam = state.career.teamId;
  const isHome = sched.home === userTeam;
  const oppId = isHome ? sched.away : sched.home;
  const rivalry = oppId === state.career.rivalTeamId;
  const hr = gameRatings(state, league, sched.home, { userPlaying: !sitOut });
  const ar = gameRatings(state, league, sched.away, { userPlaying: !sitOut });
  hr.off += 1.5;
  const perTeam = randInt(state, 10, 12);
  const drives = [];
  for (let i = 0; i < perTeam; i++) {
    drives.push({ side: 'home', i, moment: false, result: null });
    drives.push({ side: 'away', i, moment: false, result: null });
  }
  if (chance(state, 0.5)) for (let i = 0; i < drives.length; i += 2) [drives[i], drives[i + 1]] = [drives[i + 1], drives[i]];
  drives.forEach((d, idx) => {
    d.quarter = Math.min(4, 1 + Math.floor((idx / drives.length) * 4));
    const mins = 15 - Math.floor(((idx / drives.length) * 4 - (d.quarter - 1)) * 15);
    d.clock = `${clamp(mins, 1, 15)}:${String(randInt(state, 0, 59)).padStart(2, '0')}`;
  });
  const userSide = isHome ? 'home' : 'away';
  const momentSide = isDefense(state) ? (userSide === 'home' ? 'away' : 'home') : userSide;
  const n = sitOut ? 0 : momentCount(state, { playoff, rivalry });
  const candidates = drives.filter((d) => d.side === momentSide);
  const chosen = new Set();
  if (n > 0) chosen.add(candidates.length - 2 - randInt(state, 0, 1)); // something late for drama
  let guard = 0;
  while (chosen.size < Math.min(n, candidates.length - 1) && guard++ < 200) chosen.add(randInt(state, 0, candidates.length - 2));
  for (const idx of chosen) candidates[idx].moment = true;

  return {
    homeId: sched.home, awayId: sched.away, userSide, momentSide, oppId, playoff, round, rivalry, sitOut, playingHurt,
    weather: state.week?.forecast ?? chooseWeather(state, league, playoff, rivalry),
    ratings: { home: hr, away: ar },
    score: { home: 0, away: 0 },
    toBonus: { home: 0, away: 0 },
    drives, cursor: 0, log: [], pending: null, pendingDecision: null, pendingEvent: null,
    moments: [], userStats: emptyStats(), finished: false, week: state.league.week,
    momentum: 0, tolMod: 1, extraPending: sitOut ? 0 : (state.week?.extraMoments ?? 0), skipNext: false, flagNext: false, userOut: false,
    eventsFired: [], pregameDone: false, halfDone: false, twoMinDone: false,
    // game plan, energy and live rating (shown on the match screen)
    plan: { approach: 'balanced', intensity: 'mid' },
    homeTrait: teamCulture(getTeam(league, sched.home) ?? { id: sched.home, city: '', name: '' }, state.career.stage).traitId,
    energy: Math.round(70 + (state.week?.freshness ?? 0) * 30), rating: 6.0, ratingHist: [6.0], lastDelta: 0, chart: [],
  };
}

/** Called after createUserGame: wind for this game. */
export function initWeather(state, g) {
  g.wind = makeWind(state, g.weather);
  return g;
}

const otherSide = (s) => (s === 'home' ? 'away' : 'home');
const yardText = (yl) => (yl <= 50 ? `OPP ${yl}` : `OWN ${100 - yl}`);
const userScore = (g) => g.score[g.userSide];
const oppScore = (g) => g.score[otherSide(g.userSide)];

/** Advance until the player is needed or the game ends. */
export function stepGame(state) {
  const g = state.game;
  if (g.finished) return { type: 'end' };
  if (g.pendingEvent) return { type: 'gameEvent', event: g.pendingEvent };
  if (g.pendingDecision) return { type: 'decision', decision: g.pendingDecision };
  if (g.pending) return { type: 'moment', moment: g.pending };
  if (!g.pregameDone) {
    g.pregameDone = true;
    if (!g.sitOut && maybeEvent(state, 'pregame', 0.55)) return { type: 'gameEvent', event: g.pendingEvent };
  }
  while (g.cursor < g.drives.length) {
    const d = g.drives[g.cursor];
    if (!g.halfDone && d.quarter >= 3) {
      g.halfDone = true;
      g.log.push({ q: 2, clock: '0:00', team: '', user: false, out: 'HALF', text: 'Halftime', score: `${g.score.away}-${g.score.home}`, key: false });
      g.energy = Math.min(100, (g.energy ?? 80) + 10); // catch your breath
      if (!g.sitOut && !g.userOut && maybeEvent(state, 'halftime', 0.5)) return { type: 'gameEvent', event: g.pendingEvent };
    }
    const active = !g.sitOut && !g.userOut;
    // Two-minute drill / final defensive stand.
    if (active && !g.twoMinDone && d.quarter === 4 && isLastDriveFor(g, g.cursor, d.side) && d.side === g.momentSide) {
      const diff = userScore(g) - oppScore(g);
      const needed = isDefense(state) ? diff >= 1 && diff <= 8 : diff <= 0 && diff >= -8;
      if (needed) {
        g.twoMinDone = true;
        d.moment = true;
        d.twoMin = true;
        d.chain = 0;
        g.log.push({ q: 4, clock: '2:00', team: '', user: true, out: 'INFO', text: isDefense(state) ? 'Final stand: stop them to win!' : 'Two-minute drill: it\'s on you!', score: `${g.score.away}-${g.score.home}`, key: true });
      }
    }
    if (active && g.extraPending > 0 && !d.moment && d.side === g.momentSide && g.cursor > 0) {
      d.moment = true;
      g.extraPending--;
    }
    if (d.moment && active) {
      if (g.skipNext && !d.twoMin) {
        g.skipNext = false;
        d.moment = false;
        g.log.push({ q: d.quarter, clock: d.clock, team: '', user: true, out: 'INFO', text: `${state.player.last} sits this series out.`, score: `${g.score.away}-${g.score.home}`, key: false });
      } else {
        if (!d.clutchChecked && d.quarter === 4 && Math.abs(userScore(g) - oppScore(g)) <= 8) {
          d.clutchChecked = true;
          if (maybeEvent(state, 'clutch', 0.4)) return { type: 'gameEvent', event: g.pendingEvent };
        }
        g.pending = buildMoment(state, g, d);
        return { type: 'moment', moment: g.pending };
      }
    }
    let out = driveOutcome(state, g.ratings[d.side].off, g.ratings[otherSide(d.side)].def, g.toBonus[d.side] + momentumBonus(g, d.side) + planBonus(state, g, d.side));
    out = planRisk(state, g, d.side, out);
    if (active && d.side === (isDefense(state) ? otherSide(g.userSide) : g.userSide)) g.energy = Math.max(0, (g.energy ?? 80) - 0.8);
    g.toBonus[d.side] = 0;
    finishDrive(state, g, d, out, null);
    g.cursor++;
    if (active && maybeEvent(state, 'random', 0.06)) return { type: 'gameEvent', event: g.pendingEvent };
  }
  endGame(state, g);
  return { type: 'end' };
}

// ---------------- game plan (approach + intensity)
const INTENSITY = { low: { tol: 0.95, drain: 4 }, mid: { tol: 1, drain: 6 }, high: { tol: 1.07, drain: 9 } };
/** Change the game plan mid-game. key 'approach' (aggressive/balanced/conservative) or 'intensity' (low/mid/high). */
export function setGamePlan(state, key, value) {
  const g = state.game;
  if (!g) return;
  g.plan ??= { approach: 'balanced', intensity: 'mid' };
  g.plan[key] = value;
}
/** The unit you influence: your offense (or the opponent's offense if you play defense). */
const userUnitSide = (state, g) => (isDefense(state) ? otherSide(g.userSide) : g.userSide);
function planBonus(state, g, side) {
  const a = g.plan?.approach ?? 'balanced';
  if (side !== userUnitSide(state, g)) return 0;
  const sign = isDefense(state) ? -1 : 1; // aggressive defense makes their drives worse
  return a === 'aggressive' ? 0.035 * sign : a === 'conservative' ? -0.03 * sign : 0;
}
function planRisk(state, g, side, out) {
  const a = g.plan?.approach ?? 'balanced';
  if (side !== userUnitSide(state, g) || a !== 'aggressive') return out;
  // aggressive football: more turnovers on offense, more big plays allowed on defense
  if (!isDefense(state) && out === 'PUNT' && chance(state, 0.14)) return 'TO';
  if (isDefense(state) && out === 'PUNT' && chance(state, 0.08)) return 'TD';
  return out;
}

function isLastDriveFor(g, idx, side) {
  for (let i = idx + 1; i < g.drives.length; i++) if (g.drives[i].side === side) return false;
  return true;
}

function momentumBonus(g, side) {
  return (side === g.userSide ? 1 : -1) * g.momentum * 0.025;
}

function pickType(state, g, d, yl) {
  const pos = state.player.position;
  if (pos === 'RB' && yl <= 3) return 'rb_goalline';
  if (pos === 'QB' && d.twoMin && d.chain >= 1 && yl > 34) return 'qb_hailmary';
  if (pos === 'QB' && d.quarter === 2 && isLastDriveFor(g, g.cursor, d.side) === false && yl > 45 && chance(state, 0.08)) return 'qb_hailmary';
  let pool = MOMENT_POOL[pos];
  if (pos === 'WR' && yl < 18) pool = pool.filter(([t]) => t !== 'wr_jumpball');
  return weightedPick(state, pool, ([, w]) => w)[0];
}

function buildMoment(state, g, d, over = {}) {
  let yardLine = over.yardLine ?? (d.twoMin && d.chain === 0 ? randInt(state, 55, 78) : randInt(state, 12, 78));
  // Occasional goal-line situations.
  if (over.yardLine === undefined && !d.twoMin && chance(state, 0.1)) yardLine = randInt(state, 1, 4);
  let label = '';
  if (g.flagNext && !isDefense(state)) {
    yardLine = Math.min(95, yardLine + 15);
    g.flagNext = false;
    label = 'Penalty! ';
  }
  const downRoll = rand(state);
  let down = over.down ?? (downRoll < 0.25 ? 1 : downRoll < 0.55 ? 2 : 3);
  let distance = over.distance ?? (down === 1 ? 10 : down === 2 ? randInt(state, 3, 10) : randInt(state, 2, 12));
  if (yardLine <= 4 && over.distance === undefined) { distance = yardLine; down = Math.max(down, 2); }
  if (d.twoMin && over.down === undefined) { down = 1; distance = 10; }
  const type = over.type ?? pickType(state, g, d, yardLine);
  const clutch = d.quarter === 4 && Math.abs(userScore(g) - oppScore(g)) <= 8;
  const ords = ['', '1st', '2nd', '3rd', '4th'];
  const clock = d.twoMin ? `${Math.max(0, 2 - (d.chain ?? 0) * 0.6).toFixed(0)}:${String(randInt(state, 0, 59)).padStart(2, '0')}` : d.clock;
  return {
    type,
    defense: isDefense(state),
    down, distance, yardLine, quarter: d.quarter, clock, clutch,
    twoMin: !!d.twoMin,
    weather: g.weather,
    wind: g.wind,
    label: `${label}${ords[down]} and ${yardLine <= distance ? 'Goal' : distance} at ${yardText(yardLine)}`,
    trailing: userScore(g) < oppScore(g),
    situation: d.twoMin ? (isDefense(state) ? 'Final stand' : 'Two-minute drill') : clutch ? 'Clutch' : null,
  };
}

/** How forgiving minigames are right now (roughly 0.4 to 1.6). */
/**
 * How tough is the unit you're facing? Compares the opponent's offense (you on defense) or defense (you on
 * offense) to the league average. k: -1.5 (weak) .. +1.5 (elite). Used by tolerance() and the play engine.
 */
export function matchup(state, g = state.game) {
  if (!g?.ratings) return { k: 0, label: 'Even', opp: 0, avg: 0 };
  const oppSide = g.userSide === 'home' ? 'away' : 'home';
  const unit = isDefense(state) ? 'off' : 'def';
  const opp = g.ratings[oppSide][unit];
  const teams = state.league?.teams ?? [];
  const avg = teams.length ? teams.reduce((a, t) => a + (t[unit] ?? 60), 0) / teams.length : opp;
  const k = clamp((opp - avg) / 8, -1.5, 1.5);
  const label = k > 0.9 ? 'Elite' : k > 0.35 ? 'Tough' : k < -0.9 ? 'Weak' : k < -0.35 ? 'Soft' : 'Even';
  return { k, label, opp: Math.round(opp), avg: Math.round(avg), unit: unit === 'def' ? 'defense' : 'offense' };
}

export function tolerance(state, call = 'balanced', type = state.game?.pending?.type) {
  const p = state.player;
  const g = state.game;
  let t = 0.5 + (p.ovr / 100) * 0.7;
  if (p.health < 60) t *= 0.75 + p.health / 240;
  t *= 0.9 + p.mood / 1000;
  t *= 1 + (state.week?.freshness ?? 0) * 0.15;
  if (state.week?.studied) t *= 1.04;
  t *= DIFFICULTIES[state.difficulty ?? 'normal'].tol;
  t *= 1 + gearBonus(p, type);
  if (g) {
    const w = WEATHER[g.weather] ?? WEATHER.clear;
    t *= w.tol * (type && PASS_TYPES.has(type) ? w.pass : 1);
    t *= g.tolMod;
    t *= INTENSITY[g.plan?.intensity ?? 'mid'].tol;
    // home-field: visitors feel the stadium, the home team gets a little crowd lift
    if (g.userSide === 'away') t *= TRAITS[g.homeTrait]?.awayTol ?? 1;
    else if (g.homeTrait) t *= 1.02;
    if ((g.energy ?? 100) < 50) t *= 0.8 + (g.energy ?? 100) / 250;
    t *= 1 + g.momentum * 0.06;
    if (g.playingHurt) t *= 0.75;
    t *= 1 - matchup(state, g).k * 0.09; // good teams make for hard games
  }
  return clamp(t / PLAY_CALLS[call].difficulty, 0.35, 1.8);
}

/** Simulated moment for "sim this play" and for the balance bot. skill 0..1 (0.5 = average human). */
export function autoMoment(state, call = 'balanced', skill = 0.5) {
  const m = state.game.pending;
  const tol = tolerance(state, call, m.type);
  const q = clamp(gauss(state, 0.16 + tol * 0.32 + (skill - 0.5) * 0.3, 0.2), 0, 1);
  return outcomeFromQuality(state, m, q, call);
}

/** Turn a 0..1 execution quality into a football result for any moment type. */
export function outcomeFromQuality(state, m, q, call) {
  const pc = PLAY_CALLS[call];
  const res = { quality: q, yards: 0, td: false, turnover: false, sack: false, complete: false, call };
  if (m.defense) return defenseOutcome(state, m, q, call, res);
  if (m.type === 'rb_goalline') {
    if (q > 0.45 || (q > 0.3 && chance(state, 0.3))) { res.complete = true; res.yards = m.yardLine; res.td = true; res.text = 'Over the top! TOUCHDOWN!'; }
    else if (chance(state, 0.04 * pc.turnover)) { res.turnover = true; res.text = 'FUMBLE at the goal line!'; }
    else { res.complete = true; res.yards = q > 0.2 ? Math.max(0, m.yardLine - 1) : 0; res.text = 'Stuffed at the line!'; if (res.yards >= m.yardLine) { res.td = true; res.text = 'TOUCHDOWN!'; } }
    return res;
  }
  const deep = DEEP_TYPES.has(m.type);
  const slip = WEATHER[m.weather]?.slip ?? 0;
  const pTO = Math.max(0, (deep ? 0.4 : 0.3) - q) * 0.9 * pc.turnover + slip * 0.35;
  if (chance(state, pTO)) {
    res.turnover = true;
    res.text = m.type === 'rb_run' || m.type === 'qb_scramble' ? 'FUMBLE! Defense recovers.' : 'INTERCEPTED!';
    return res;
  }
  if (m.type === 'rb_run' || m.type === 'qb_scramble') {
    let y = -1 + q * 11 * pc.reward + gauss(state, 0, 1.5);
    if (q > 0.82 && chance(state, 0.35 * pc.reward)) y += rand(state) * 45 * pc.reward;
    res.yards = Math.round(y);
    res.complete = true;
  } else if (deep) {
    if (q < 0.55) { res.text = 'Knocked down in a crowd.'; return res; }
    res.yards = Math.round(Math.min(m.yardLine, 25 + rand(state) * 20) * (q > 0.85 ? 1.6 : 0.5 + rand(state) * 0.5));
    res.complete = true;
  } else {
    if (q < 0.33) {
      if (m.type === 'qb_throw' && chance(state, 0.3)) { res.sack = true; res.yards = -randInt(state, 3, 8); res.text = 'SACKED!'; }
      else res.text = m.type === 'qb_throw' ? 'Incomplete.' : 'Pass falls incomplete.';
      return res;
    }
    let y = (4 + q * 16) * pc.reward + gauss(state, 0, 3);
    if (q > 0.85 && chance(state, 0.3 * pc.reward)) y += rand(state) * 35 * pc.reward;
    res.yards = Math.max(1, Math.round(y));
    res.complete = true;
  }
  if (res.yards >= m.yardLine) { res.yards = m.yardLine; res.td = true; }
  res.text = res.td ? 'TOUCHDOWN!' : res.yards >= m.distance ? `${res.yards} yards. First down!` : `${res.yards} yards.`;
  return res;
}

function defenseOutcome(state, m, q, call, res) {
  const pc = PLAY_CALLS[call];
  res.defense = true;
  if (m.type === 'dt_rush') {
    if (q > 0.74) { res.sack = true; res.tackle = true; res.tfl = true; res.yardsAllowed = -Math.round(5 + q * 5); res.text = 'SACK! You got home!'; if (q > 0.9 && chance(state, 0.2)) { res.forcedFumble = true; res.turnover = true; res.text = 'STRIP SACK! Fumble recovered!'; } }
    else if (q > 0.5) { res.pd = chance(state, 0.3); res.pressure = true; res.yardsAllowed = 0; res.text = res.pd ? 'Batted at the line!' : 'Pressure! The pass falls incomplete.'; }
    else { res.caught = true; res.yardsAllowed = Math.max(2, Math.round(6 + (0.5 - q) * 30 + gauss(state, 0, 3))); res.text = `They had time. ${res.yardsAllowed}-yard completion.`; }
  } else if (m.type === 'dt_run') {
    if (q > 0.7) { res.tackle = true; res.tfl = true; res.yardsAllowed = -Math.round(1 + q * 3); res.text = 'Tackle for loss!'; }
    else if (q > 0.45) { res.tackle = true; res.yardsAllowed = Math.round(1 + (0.7 - q) * 8); res.text = 'Stuffed at the line.'; }
    else { res.yardsAllowed = Math.round(5 + (0.45 - q) * 30 * pc.reward); res.text = 'They ran right past you.'; }
  } else if (m.type === 'cb_tackle') {
    if (q > 0.45) { res.tackle = true; res.yardsAllowed = Math.max(0, Math.round(8 - q * 10 + gauss(state, 0, 1.5))); res.text = 'Wrapped up! Big stop.'; }
    else { res.yardsAllowed = Math.round(10 + (0.45 - q) * 60 * pc.reward); res.text = 'Missed tackle!'; }
    if (q > 0.85 && chance(state, 0.15 * pc.reward)) { res.forcedFumble = true; res.turnover = true; res.text = 'Forced FUMBLE! Your ball!'; }
  } else {
    if (q > 0.78 && chance(state, 0.42 * (call === 'risky' ? 1.45 : call === 'safe' ? 0.5 : 1))) {
      res.int = true; res.turnover = true; res.text = 'INTERCEPTED! You jumped the route!';
      if (chance(state, 0.12 * pc.reward)) { res.defTD = true; res.text = 'PICK SIX! TOUCHDOWN!'; }
      return res;
    }
    if (q > 0.52) { res.pd = true; res.text = 'Pass broken up!'; res.yardsAllowed = 0; return res; }
    res.caught = true;
    res.yardsAllowed = Math.max(1, Math.round((5 + (0.55 - q) * 30) * (call === 'risky' ? 1.45 : call === 'safe' ? 0.85 : 1) + gauss(state, 0, 2)));
    res.tackle = chance(state, 0.6);
    res.text = `Caught on you for ${res.yardsAllowed}.`;
  }
  if (res.yardsAllowed >= m.yardLine) { res.yardsAllowed = m.yardLine; res.tdAllowed = true; res.text = 'They score on you. Touchdown.'; }
  return res;
}

/** Apply a played or simulated moment. */
export function resolveMoment(state, result) {
  const g = state.game;
  const m = g.pending;
  if (!m) return null;
  const d = g.drives[g.cursor];
  const s = g.userStats;
  g.pending = null;
  let out = null;
  let yl = m.yardLine;
  let converted = false;
  if (result.injured && !g.userOut) {
    applyEffects(state, { injury: true });
    g.userOut = true;
    g.log.push({ q: m.quarter, clock: m.clock, team: '', user: true, out: 'INFO', text: `${state.player.last} is helped off the field${state.player.injury ? ` (${state.player.injury.label.toLowerCase()})` : ''}.`, score: `${g.score.away}-${g.score.home}`, key: true });
  }

  // energy and live rating
  const eq = state.player.traits?.equipped ?? [];
  g.energy = Math.max(0, (g.energy ?? 80) - (INTENSITY[g.plan?.intensity ?? 'mid'].drain + (g.userSide === 'away' ? TRAITS[g.homeTrait]?.awayDrain ?? 0 : 0)) * (eq.includes('workhorse') ? 0.7 : 1));
  {
    const big = result.td || result.int || result.defTD || result.sack && m.defense;
    const bad = (!m.defense && (result.turnover || result.sack)) || result.tdAllowed;
    const delta = (result.quality - 0.5) * 1.5 + (big ? 0.5 : 0) - (bad ? 0.5 : 0);
    g.rating = clamp((g.rating ?? 6) + delta, 3, 10);
    g.lastDelta = delta;
    (g.ratingHist ??= [6]).push(Math.round(g.rating * 10) / 10);
  }

  if (m.defense) {
    s.tgtAgainst += m.type === 'cb_cover' ? 1 : 0;
    if (result.int) { s.defInt++; s.pd++; }
    if (result.pd) s.pd++;
    if (result.defTD) s.defTD++;
    if (result.tackle) s.tackles++;
    if (result.sack && result.tackle) s.defSacks = (s.defSacks ?? 0) + 1;
    if (result.tfl && result.tackle) s.tfl = (s.tfl ?? 0) + 1;
    if (result.forcedFumble) s.tackles++;
    if (result.caught || m.type === 'cb_tackle') {
      if (result.caught) s.recAllowed++;
      s.ydsAllowed += result.yardsAllowed ?? 0;
    }
    if (result.tdAllowed) s.tdAllowed++;
    if (m.clutch && (result.int || result.pd || result.sack || (result.tackle && (result.yardsAllowed ?? 0) < m.distance))) s.clutch++;
    if (result.turnover) out = 'TO';
    else if (result.tdAllowed) out = 'TD';
    else {
      // penalty yards move the ball but never count in anyone's stats
      yl = m.yardLine - (result.yardsAllowed ?? 0) - (result.penYds ?? 0);
      converted = (result.yardsAllowed ?? 0) + (result.penYds ?? 0) >= m.distance || !!result.autoFirst;
      yl = Math.min(99, yl);
    }
    momentumShift(g, ((result.quality - 0.5) * 0.35 + (result.turnover ? 0.25 : 0) - (result.tdAllowed ? 0.2 : 0)) * ((state.player.traits?.equipped ?? []).includes('captain') && result.quality > 0.5 ? 1.25 : 1));
  } else {
    if (m.type === 'qb_throw' || m.type === 'qb_hailmary') {
      if (result.sack) s.sacks++;
      else {
        s.passAtt++;
        if (result.complete) { s.passComp++; s.passYds += result.yards; if (result.td) s.passTD++; }
        if (result.turnover) s.int++;
      }
    } else if (m.type === 'rb_run' || m.type === 'rb_goalline' || m.type === 'qb_scramble') {
      s.rushAtt++;
      s.rushYds += result.yards;
      if (result.td) s.rushTD++;
      if (result.turnover) s.fumbles++;
    } else {
      s.targets++;
      if (result.complete) { s.rec++; s.recYds += result.yards; if (result.td) s.recTD++; }
      else if (!result.turnover && result.quality > 0.15 && m.type !== 'rb_screen') s.drops++;
    }
    if (m.clutch && (result.td || (result.complete && result.yards >= m.distance))) s.clutch++;
    if (result.td) out = 'TD';
    else if (result.turnover) out = 'TO';
    else {
      yl = m.yardLine - result.yards - (result.penYds ?? 0);
      converted = result.yards + (result.penYds ?? 0) >= m.distance || !!result.autoFirst;
      yl = Math.min(99, yl);
    }
    momentumShift(g, (result.quality - 0.5) * 0.35 + (result.td ? 0.2 : 0) - (result.turnover ? 0.3 : 0));
  }
  g.moments.push({ ...m, call: result.call, quality: result.quality, yards: m.defense ? -(result.yardsAllowed ?? 0) : result.yards, td: m.defense ? !!result.defTD : result.td, turnover: result.turnover, text: result.text, outcome: null, played: !!result.played });
  const rec = g.moments[g.moments.length - 1];

  if (out === null) {
    // Drive continues: two-minute chain, 4th-down decision, or simulate the rest.
    if (d.twoMin && (d.chain ?? 0) < 2) {
      d.chain = (d.chain ?? 0) + 1;
      g.pending = buildMoment(state, g, d, { yardLine: Math.max(1, yl), down: 1, distance: Math.min(10, Math.max(1, yl)) });
      rec.outcome = 'CONT';
      afterMomentEvents(state, result, m);
      return { outcome: 'CONT' };
    }
    // Same series: you stay on the field for the next snap (more often for better players and good plays).
    if (!d.twoMin && (d.series ?? 0) < 2 && yl > 0 && (converted || m.down < 3)) {
      const ovr = state.player.ovr ?? 60;
      const pNext = clamp((d.series ? 0.1 : 0.2) + (ovr - 60) / 300 + (result.quality - 0.5) * 0.2 + (converted ? 0.05 : 0), 0.08, 0.45);
      if (chance(state, pNext)) {
        d.series = (d.series ?? 0) + 1;
        const left = Math.max(1, m.distance - Math.max(0, m.yardLine - yl));
        g.pending = buildMoment(state, g, d, converted
          ? { yardLine: Math.min(99, yl), down: 1, distance: Math.min(10, yl) }
          : { yardLine: Math.min(99, yl), down: m.down + 1, distance: Math.min(left, yl) });
        g.pending.series = true;
        g.pending.situation ??= 'Same series: you stay on the field';
        // keep the game's total workload sane: a long series can use up one of your later drives
        if (chance(state, 0.7)) { const later = g.drives.slice(g.cursor + 1).find((x) => x.moment && !x.twoMin && x.side === d.side); if (later) later.moment = false; }
        rec.outcome = 'CONT';
        afterMomentEvents(state, result, m);
        return { outcome: 'CONT' };
      }
    }
    if (!m.defense && !d.twoMin && m.down === 3 && !converted && yl <= 55 && yl > 0) {
      g.pendingDecision = { yardLine: yl, distance: Math.max(1, m.distance - Math.max(0, m.yardLine - yl)), quarter: d.quarter, clock: d.clock, fgRange: yl <= 38 };
      rec.outcome = 'DECIDE';
      afterMomentEvents(state, result, m);
      return { outcome: 'DECIDE' };
    }
    out = continueDrive(state, g, d, m, yl, converted, result.quality);
  }
  rec.outcome = out;
  if (result.defTD) g.score[g.userSide] += 7;
  finishDrive(state, g, d, out, { moment: m, result });
  g.cursor++;
  afterMomentEvents(state, result, m);
  return { outcome: out };
}

/** Rest of a drive after a moment that neither scored nor turned it over. */
function continueDrive(state, g, d, m, yl, converted, q) {
  const off = g.ratings[d.side].off;
  const def = g.ratings[otherSide(d.side)].def;
  const diff = (off - def) / 100;
  let pTD = 0;
  if (m.defense) {
    if (converted) pTD = 0.3 - yl * 0.004 + diff * 0.4 - q * 0.1;
    else if (m.down < 3) pTD = 0.14 - yl * 0.002 + diff * 0.3;
  } else if (converted) pTD = 0.32 - yl * 0.004 + diff * 0.4 + q * 0.12;
  else if (m.down < 3) pTD = 0.2 - yl * 0.003 + diff * 0.3;
  if (d.twoMin) pTD = 0; // chain is over: kick if close, otherwise the drive dies
  pTD = clamp(pTD, 0, 0.9);
  if (chance(state, pTD)) return 'TD';
  if (yl <= 38 && chance(state, d.twoMin ? 0.8 : 0.85)) return 'FG';
  return d.twoMin ? 'DOWNS' : 'PUNT';
}

/** 4th down: go for it (another moment) or kick. */
export function resolveDecision(state, go) {
  const g = state.game;
  const dec = g.pendingDecision;
  if (!dec) return;
  g.pendingDecision = null;
  const d = g.drives[g.cursor];
  if (go) {
    g.pending = buildMoment(state, g, d, { yardLine: dec.yardLine, down: 4, distance: dec.distance });
    g.pending.fourth = true;
    return { go: true };
  }
  const out = dec.fgRange && chance(state, 0.85) ? 'FG' : 'PUNT';
  finishDrive(state, g, d, out, null);
  g.cursor++;
  return { go: false, out };
}

/** Simple AI for 4th downs (bot / sim rest). */
export function autoDecision(state) {
  const dec = state.game.pendingDecision;
  return dec.distance <= 2 && dec.yardLine <= 45 && !(dec.fgRange && dec.distance > 1);
}

function momentumShift(g, v) {
  g.momentum = clamp(g.momentum + v * (TRAITS[g.homeTrait]?.momentum ?? 1), -1, 1);
}

function finishDrive(state, g, d, out, momentInfo) {
  const pts = out === 'DOWNS' ? 0 : POINTS[out];
  g.score[d.side] += pts;
  if (out === 'TO' || out === 'DOWNS') g.toBonus[otherSide(d.side)] = 0.07;
  const team = d.side === 'home' ? g.homeId : g.awayId;
  const isUserTeam = d.side === g.userSide;
  if (momentInfo && isUserTeam && !isDefense(state) && !g.sitOut && (out === 'TD' || out === 'FG' || out === 'PUNT') && !momentInfo.result.td && !d.series) {
    autoDriveStats(state, g, out, true); // the rest of the drive after the key moment
  }
  if (!momentInfo) {
    if (out === 'TD') momentumShift(g, isUserTeam ? 0.15 : -0.15);
    if (out === 'TO') momentumShift(g, isUserTeam ? -0.15 : 0.15);
    if (!g.sitOut && !g.userOut) {
      if (isUserTeam && !isDefense(state)) autoDriveStats(state, g, out);
      if (!isUserTeam && isDefense(state)) autoDefenseStats(state, g, out);
    }
  }
  (g.chart ??= []).push({ m: g.momentum, out, user: isUserTeam, q: d.quarter });
  const verb = { TD: 'Touchdown', FG: 'Field goal', TO: 'Turnover', PUNT: 'Punt', DOWNS: 'Turnover on downs' }[out];
  const who = momentInfo ? `${state.player.last}: ${momentInfo.result.text} → ` : '';
  // penalties happen on the simulated drives too, for both teams
  let flagNote = '';
  if (!momentInfo && chance(state, 0.16)) {
    const notes = {
      TD: [' (a pass interference flag set it up)', ' (helped by a roughing-the-passer call)', ' (after a defensive holding flag kept it alive)', ' (a facemask call added 15)'],
      FG: [' (a holding call stalled it)', ' (after a false start)', ' (offensive pass interference pushed them back)'],
      PUNT: [' (a holding flag killed the drive)', ' (back-to-back false starts)', ' (an illegal block wiped out a big return)', ' (intentional grounding)'],
      TO: [' (after a chop block backed them up)', ' (right after a delay of game)'],
      DOWNS: [' (a false start on 4th and short)'],
    }[out] ?? [];
    if (notes.length) flagNote = notes[Math.floor(rand(state) * notes.length)];
  }
  g.log.push({
    q: d.quarter, clock: d.clock, team: team, user: isUserTeam, out,
    text: `${who}${verb}${flagNote}${momentInfo?.result.defTD ? ' (then pick six!)' : ''}`, score: `${g.score.away}-${g.score.home}`, key: !!momentInfo,
  });
}

function autoDriveStats(state, g, out, partial = false) {
  const p = state.player;
  const s = g.userStats;
  const o = p.ovr;
  if (partial && (p.position === 'WR' || (p.position === 'RB' && chance(state, 0.5)) || (out !== 'TD' ? chance(state, 0.5) : chance(state, 0.45)))) return;
  if (p.position === 'QB') {
    const att = partial ? randInt(state, 1, 3) : randInt(state, 2, 5);
    let comp = 0;
    for (let i = 0; i < att; i++) if (chance(state, 0.48 + o * 0.0026)) comp++;
    s.passAtt += att; s.passComp += comp;
    s.passYds += Math.max(0, Math.round(comp * gauss(state, 8 + o * 0.05, 2.5)));
    if (out === 'TD' && chance(state, 0.72)) s.passTD++;
    if (out === 'TO' && chance(state, 0.6)) s.int++;
  } else if (p.position === 'RB') {
    const car = randInt(state, 1, 3);
    s.rushAtt += car;
    s.rushYds += Math.round(car * gauss(state, 1.6 + o * 0.026, 1.2));
    if (out === 'TD' && chance(state, 0.28)) s.rushTD++;
    if (out === 'TO' && chance(state, 0.22)) s.fumbles++;
    if (chance(state, 0.3)) { s.targets++; s.rec++; s.recYds += randInt(state, 2, 12); }
  } else {
    const tg = chance(state, 0.32) ? (chance(state, 0.2) ? 2 : 1) : 0;
    s.targets += tg;
    for (let i = 0; i < tg; i++) {
      if (chance(state, 0.5 + o * 0.0022)) { s.rec++; s.recYds += Math.max(1, Math.round(gauss(state, 7 + o * 0.06, 4))); }
    }
    if (out === 'TD' && chance(state, 0.16)) s.recTD++;
  }
}

function autoDefenseStats(state, g, out) {
  const s = g.userStats;
  const o = state.player.ovr;
  if (chance(state, 0.55)) s.tackles += chance(state, 0.3) ? 2 : 1;
  const tg = chance(state, 0.45) ? 1 : 0;
  s.tgtAgainst += tg;
  if (tg) {
    if (chance(state, 0.1 + (o - 60) * 0.003)) s.pd++;
    else if (chance(state, 0.65 - (o - 60) * 0.004)) { s.recAllowed++; s.ydsAllowed += randInt(state, 4, 16); }
  }
  if (out === 'TO' && chance(state, 0.2)) { s.defInt++; s.pd++; }
  if (out === 'TD' && chance(state, 0.15)) s.tdAllowed++;
}

function endGame(state, g) {
  if (g.score.home === g.score.away) {
    const [h, a] = breakTie(state, g.score.home, g.score.away, g.ratings.home, g.ratings.away);
    const side = h > g.score.home ? 'home' : 'away';
    const pts = Math.max(h - g.score.home, a - g.score.away);
    g.score.home = h; g.score.away = a;
    g.log.push({ q: 'OT', clock: '', team: side === 'home' ? g.homeId : g.awayId, user: side === g.userSide, out: pts === 7 ? 'TD' : 'FG', text: `Overtime ${pts === 7 ? 'touchdown' : 'field goal'}!`, score: `${a}-${h}`, key: false });
  }
  g.finished = true;
  g.won = userScore(g) > oppScore(g);
  g.grade = gameGrade(state, g);
}

/** 0-100 grade for the player's game. */
export function gameGrade(state, g) {
  if (g.sitOut) return 0;
  const pos = state.player.position;
  const s = g.userStats;
  let prod;
  if (pos === 'QB') prod = s.passYds / 3.2 * 0.45 + s.passTD * 14 + (s.passAtt ? (s.passComp / s.passAtt - 0.5) * 60 : 0) - s.int * 12 - s.sacks * 2 + s.rushYds * 0.3;
  else if (pos === 'RB') prod = s.rushYds / 1.2 * 0.55 + s.rushTD * 15 + s.recYds * 0.3 - s.fumbles * 14;
  else if (pos === 'CB') prod = 40 + s.tackles * 3 + s.defInt * 22 + s.pd * 8 + s.defTD * 18 - s.tdAllowed * 12 - s.ydsAllowed * 0.35;
  else if (pos === 'DT') prod = 32 + s.tackles * 4 + (s.defSacks ?? 0) * 20 + (s.tfl ?? 0) * 7 + s.pd * 6;
  else prod = s.recYds / 1.1 * 0.55 + s.recTD * 16 + s.rec * 2 - s.drops * 4;
  prod = clamp(prod, 0, 100);
  const mq = g.moments.length ? g.moments.reduce((a, m) => a + m.quality, 0) / g.moments.length : 0.5;
  return Math.round(clamp(prod * 0.55 + mq * 100 * 0.45 + (g.won ? 4 : -2), 0, 100));
}

export function letterGrade(n) {
  if (n >= 93) return 'A+';
  if (n >= 85) return 'A';
  if (n >= 78) return 'B+';
  if (n >= 70) return 'B';
  if (n >= 62) return 'C+';
  if (n >= 54) return 'C';
  if (n >= 45) return 'D';
  return 'F';
}

// ------------------------------------------------------------------ mid-game events

function eventEligible(state, g, ev) {
  const c = ev.cond ?? {};
  const p = state.player;
  if (g.eventsFired.includes(ev.id)) return false;
  if (c.rivalry && !g.rivalry) return false;
  if (c.playoff && !g.playoff) return false;
  if (c.trailing && !(userScore(g) < oppScore(g))) return false;
  if (c.leading && !(userScore(g) > oppScore(g))) return false;
  if (c.positions && !c.positions.includes(p.position)) return false;
  if (c.weather && !c.weather.includes(g.weather)) return false;
  if (c.minFame && p.fame < c.minFame) return false;
  if (c.stages && !c.stages.includes(state.career.stage)) return false;
  return true;
}

function maybeEvent(state, trigger, p) {
  const g = state.game;
  if (g.eventsFired.length >= MAX_EVENTS || g.pendingEvent) return false;
  if (!chance(state, p)) return false;
  const pool = GAME_EVENTS.filter((e) => e.trigger === trigger && eventEligible(state, g, e));
  if (!pool.length) return false;
  const ev = pick(state, pool);
  g.eventsFired.push(ev.id);
  const tokens = eventTokens(state);
  g.pendingEvent = {
    id: ev.id, trigger, title: ev.title, text: fillTokens(ev.text, tokens),
    choices: ev.choices.map((c) => ({
      label: fillTokens(c.label, tokens), risky: !!c.chance,
      play: c.chance ? (c.play ?? (/dive|fumble|loose|pile|scrum/i.test(c.label + ev.title) ? 'mash' : 'timing')) : null,
      p: c.chance ? Math.min(0.95, c.chance.p + (c.chance.stat ? (state.player.stats[c.chance.stat] - 50) / 200 : 0)) : null,
    })),
  };
  return true;
}

function afterMomentEvents(state, result, m) {
  const g = state.game;
  if (g.pendingEvent || g.sitOut) return;
  const big = m.defense ? result.int || result.defTD || result.forcedFumble : result.td || result.yards >= 25;
  const bad = result.turnover && !m.defense ? true : m.defense ? result.tdAllowed : result.quality < 0.18;
  if (big && maybeEvent(state, 'afterTD', 0.45)) return;
  if (bad && maybeEvent(state, 'afterBad', 0.4)) return;
  if (CONTACT_TYPES.has(m.type) && (result.complete || result.tackle) && maybeEvent(state, 'bigHit', 0.1)) return;
}

/** Apply a mid-game event choice. */
export function resolveGameEvent(state, idx, forced = undefined) {
  const g = state.game;
  const pe = g.pendingEvent;
  const ev = GAME_EVENTS.find((e) => e.id === pe.id);
  const choice = ev.choices[idx];
  g.pendingEvent = null;
  let effects = { ...(choice.effects ?? {}) };
  let game = { ...(choice.game ?? {}) };
  let text = choice.result;
  let success = null;
  if (choice.chance) {
    const c = choice.chance;
    const bonus = c.stat ? (state.player.stats[c.stat] - 50) / 200 : 0;
    success = typeof forced === 'boolean' ? forced : rand(state) < Math.min(0.95, c.p + bonus);
    if (success) {
      effects = { ...effects, ...(c.successEffects ?? {}) };
      game = { ...game, ...(c.successGame ?? {}) };
      text = c.successText ?? text;
    } else {
      effects = { ...effects, ...(c.failEffects ?? {}) };
      game = { ...game, ...(c.failGame ?? {}) };
      text = c.failText ?? text;
    }
  }
  const hadInjury = !!state.player.injury;
  const changes = applyEffects(state, effects);
  if (effects.injury && !hadInjury) g.userOut = true;
  if (game.tol) { g.tolMod = clamp(g.tolMod * (1 + game.tol), 0.7, 1.35); changes.push({ label: 'Timing', delta: game.tol, text: `${game.tol > 0 ? '+' : ''}${Math.round(game.tol * 100)}%` }); }
  if (game.momentum) { momentumShift(g, game.momentum); changes.push({ label: 'Momentum', delta: game.momentum, text: game.momentum > 0 ? '▲' : '▼' }); }
  if (game.extra) { g.extraPending++; changes.push({ label: 'Extra moment', delta: 1, text: '+1' }); }
  if (game.skip) { g.skipNext = true; changes.push({ label: 'Sitting a series', delta: -1, text: '' }); }
  if (game.flag) { g.flagNext = !isDefense(state); if (isDefense(state)) g.toBonus[otherSide(g.userSide)] += 0.06; changes.push({ label: 'Penalty', delta: -1, text: '15 yds' }); }
  if (game.oppBoost) g.toBonus[otherSide(g.userSide)] += 0.1;
  if (game.points) {
    g.score[g.userSide] = Math.max(0, g.score[g.userSide] + game.points);
    g.log.push({ q: '', clock: '', team: g.userSide === 'home' ? g.homeId : g.awayId, user: true, out: game.points >= 6 ? 'TD' : 'INFO', text: text, score: `${g.score.away}-${g.score.home}`, key: true });
  }
  return { text, changes, success, title: pe.title };
}

/** Bot / "sim rest": pick a random option. */
export function autoGameEvent(state) {
  return Math.floor(rand(state) * state.game.pendingEvent.choices.length);
}
