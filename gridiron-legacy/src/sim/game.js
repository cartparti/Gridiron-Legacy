// The user's game: a drive-by-drive simulation that pauses on key moments.
//
// Flow: createUserGame() -> repeatedly stepGame() until it returns a moment ->
// the UI plays a minigame (or autoMoment() sims it) -> resolveMoment() -> ...
// until stepGame() returns { type: 'end' }.
import { PLAY_CALLS } from '../data/config.js';
import { clamp } from '../core/util.js';
import { rand, randInt, gauss, chance, pick } from '../core/rng.js';
import { gameRatings, driveOutcome, POINTS, breakTie, getTeam } from './league.js';
import { emptyStats } from './player.js';

const MOMENT_TYPE = { QB: 'qb_throw', RB: 'rb_run', WR: 'wr_catch' };

export function momentCount(state, { playoff, rivalry }) {
  const c = state.player.rel.coach;
  let n = 3;
  if (c >= 60) n++;
  if (c >= 80) n++;
  if (playoff || rivalry) n++;
  return clamp(n, 3, 6);
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
  // Coin toss: maybe the away team receives first.
  if (chance(state, 0.5)) for (let i = 0; i < drives.length; i += 2) [drives[i], drives[i + 1]] = [drives[i + 1], drives[i]];
  drives.forEach((d, idx) => {
    d.quarter = Math.min(4, 1 + Math.floor((idx / drives.length) * 4));
    const mins = 15 - Math.floor(((idx / drives.length) * 4 - (d.quarter - 1)) * 15);
    d.clock = `${clamp(mins, 1, 15)}:${String(randInt(state, 0, 59)).padStart(2, '0')}`;
  });
  const n = sitOut ? 0 : momentCount(state, { playoff, rivalry });
  const userSide = isHome ? 'home' : 'away';
  const userDrives = drives.filter((d) => d.side === userSide);
  // Spread moments across the game, always keeping one late for drama.
  const chosen = new Set();
  if (n > 0) chosen.add(userDrives.length - 1 - randInt(state, 0, 1));
  let guard = 0;
  while (chosen.size < n && guard++ < 100) chosen.add(randInt(state, 0, userDrives.length - 1));
  for (const idx of chosen) userDrives[idx].moment = true;

  return {
    homeId: sched.home,
    awayId: sched.away,
    userSide,
    oppId,
    playoff,
    round,
    rivalry,
    sitOut,
    playingHurt,
    ratings: { home: hr, away: ar },
    score: { home: 0, away: 0 },
    toBonus: { home: 0, away: 0 },
    drives,
    cursor: 0,
    log: [],
    pending: null,
    moments: [],
    userStats: emptyStats(),
    finished: false,
    week: state.league.week,
  };
}

const otherSide = (s) => (s === 'home' ? 'away' : 'home');

function teamAbbr(state, id) {
  return getTeam(state.league, id)?.id ?? id;
}

function yardText(yl) {
  return yl <= 50 ? `OPP ${yl}` : `OWN ${100 - yl}`;
}

/** Advance until the next key moment or the end of the game. */
export function stepGame(state) {
  const g = state.game;
  if (g.finished) return { type: 'end' };
  if (g.pending) return { type: 'moment', moment: g.pending };
  while (g.cursor < g.drives.length) {
    const d = g.drives[g.cursor];
    if (d.moment && !g.sitOut) {
      g.pending = buildMoment(state, g, d);
      return { type: 'moment', moment: g.pending };
    }
    const off = g.ratings[d.side].off;
    const def = g.ratings[otherSide(d.side)].def;
    const out = driveOutcome(state, off, def, g.toBonus[d.side]);
    g.toBonus[d.side] = 0;
    finishDrive(state, g, d, out, null);
    g.cursor++;
  }
  endGame(state, g);
  return { type: 'end' };
}

function buildMoment(state, g, d) {
  const pos = state.player.position;
  const downRoll = rand(state);
  const down = downRoll < 0.25 ? 1 : downRoll < 0.55 ? 2 : 3;
  const distance = down === 1 ? 10 : down === 2 ? randInt(state, 3, 10) : randInt(state, 2, 12);
  const yardLine = randInt(state, 12, 78);
  const userScore = g.score[g.userSide];
  const oppScore = g.score[otherSide(g.userSide)];
  const clutch = d.quarter === 4 && Math.abs(userScore - oppScore) <= 8;
  return {
    type: MOMENT_TYPE[pos],
    down,
    distance,
    yardLine,
    quarter: d.quarter,
    clock: d.clock,
    clutch,
    label: `${['', '1st', '2nd', '3rd'][down]} & ${yardLine < distance ? 'Goal' : distance} at ${yardText(yardLine)}`,
    trailing: userScore < oppScore,
  };
}

/** How forgiving minigames are for this player right now (about 0.5 to 1.6). */
export function tolerance(state, call = 'balanced') {
  const p = state.player;
  let t = 0.6 + (p.ovr / 100) * 0.75;
  if (p.health < 60) t *= 0.75 + p.health / 240;
  t *= 0.9 + p.mood / 1000;
  t *= 1 + (state.week?.freshness ?? 0) * 0.18;
  if (state.game?.playingHurt) t *= 0.75;
  return clamp(t / PLAY_CALLS[call].difficulty, 0.4, 1.8);
}

/**
 * Simulated result for a moment, used for "sim" and by the balance bot.
 * skill: how good the (pretend) human is, 0..1. 0.5 = average.
 */
export function autoMoment(state, call = 'balanced', skill = 0.5) {
  const m = state.game.pending;
  const tol = tolerance(state, call);
  const q = clamp(gauss(state, 0.18 + tol * 0.32 + (skill - 0.5) * 0.3, 0.2), 0, 1);
  return outcomeFromQuality(state, m, q, call);
}

/** Convert a 0..1 execution quality into football results for a moment type. */
export function outcomeFromQuality(state, m, q, call) {
  const pc = PLAY_CALLS[call];
  const res = { quality: q, yards: 0, td: false, turnover: false, sack: false, complete: false, call };
  const pTO = Math.max(0, 0.3 - q) * 0.9 * pc.turnover;
  if (chance(state, pTO)) {
    res.turnover = true;
    res.text = m.type === 'rb_run' ? 'FUMBLE! Defense recovers.' : 'INTERCEPTED!';
    return res;
  }
  if (m.type === 'rb_run') {
    let y = -1 + q * 11 * pc.reward + gauss(state, 0, 1.5);
    if (q > 0.82 && chance(state, 0.35 * pc.reward)) y += rand(state) * 45 * pc.reward;
    res.yards = Math.round(y);
    res.complete = true;
  } else {
    if (q < 0.33) {
      if (m.type === 'qb_throw' && chance(state, 0.3)) {
        res.sack = true;
        res.yards = -randInt(state, 3, 8);
        res.text = 'SACKED!';
      } else res.text = m.type === 'wr_catch' ? 'Pass breaks up at the catch point.' : 'Incomplete.';
      return res;
    }
    let y = (4 + q * 16) * pc.reward + gauss(state, 0, 3);
    if (q > 0.85 && chance(state, 0.3 * pc.reward)) y += rand(state) * 35 * pc.reward;
    res.yards = Math.max(1, Math.round(y));
    res.complete = true;
  }
  if (res.yards >= m.yardLine) {
    res.yards = m.yardLine;
    res.td = true;
  }
  res.text = res.td ? 'TOUCHDOWN!' : res.yards >= m.distance ? `${res.yards} yards. First down!` : `${res.yards} yards.`;
  return res;
}

/** Apply the outcome of the pending key moment and finish that drive. */
export function resolveMoment(state, result) {
  const g = state.game;
  const m = g.pending;
  if (!m) return null;
  const d = g.drives[g.cursor];
  const p = state.player;
  const s = g.userStats;
  // Personal stats for the moment.
  if (m.type === 'qb_throw') {
    if (result.sack) s.sacks++;
    else {
      s.passAtt++;
      if (result.complete) { s.passComp++; s.passYds += result.yards; if (result.td) s.passTD++; }
      if (result.turnover) s.int++;
    }
  } else if (m.type === 'rb_run') {
    s.rushAtt++;
    s.rushYds += result.yards;
    if (result.td) s.rushTD++;
    if (result.turnover) s.fumbles++;
  } else {
    s.targets++;
    if (result.complete) { s.rec++; s.recYds += result.yards; if (result.td) s.recTD++; }
    else if (!result.turnover && result.quality > 0.15) s.drops++;
  }
  if (m.clutch && (result.td || (result.complete && result.yards >= m.distance))) s.clutch++;

  // Drive result.
  let out;
  if (result.td) out = 'TD';
  else if (result.turnover) out = 'TO';
  else {
    const yl = m.yardLine - result.yards;
    const converted = result.yards >= m.distance;
    const off = g.ratings[d.side].off;
    const def = g.ratings[otherSide(d.side)].def;
    const diff = (off - def) / 100;
    let pTD = 0;
    if (converted) pTD = 0.32 - yl * 0.004 + diff * 0.4 + result.quality * 0.12;
    else if (m.down < 3) pTD = 0.2 - yl * 0.003 + diff * 0.3;
    pTD = clamp(pTD, 0, 0.9);
    if (chance(state, pTD)) out = 'TD';
    else if (yl <= 38 && chance(state, 0.85)) out = 'FG';
    else out = 'PUNT';
  }
  g.moments.push({ ...m, call: result.call, quality: result.quality, yards: result.yards, td: result.td, turnover: result.turnover, text: result.text, outcome: out, played: !!result.played });
  finishDrive(state, g, d, out, { moment: m, result });
  g.pending = null;
  g.cursor++;
  return { outcome: out };
}

function finishDrive(state, g, d, out, momentInfo) {
  g.score[d.side] += POINTS[out];
  if (out === 'TO') g.toBonus[otherSide(d.side)] = 0.07;
  const team = d.side === 'home' ? g.homeId : g.awayId;
  const isUser = d.side === g.userSide;
  if (isUser && !g.sitOut && !momentInfo) autoDriveStats(state, g, out);
  const verb = { TD: 'Touchdown', FG: 'Field goal', TO: 'Turnover', PUNT: 'Punt' }[out];
  const who = isUser && momentInfo ? `${state.player.last}: ${momentInfo.result.text} → ` : '';
  g.log.push({
    q: d.quarter, clock: d.clock, team: teamAbbr(state, team), user: isUser, out,
    text: `${who}${verb}`, score: `${g.score.away}-${g.score.home}`, key: !!momentInfo,
  });
}

/** Personal production on drives that weren't key moments. */
function autoDriveStats(state, g, out) {
  const p = state.player;
  const s = g.userStats;
  const o = p.ovr;
  if (p.position === 'QB') {
    const att = randInt(state, 2, 5);
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
    if (out === 'TD' && chance(state, 0.38)) s.rushTD++;
    if (out === 'TO' && chance(state, 0.22)) s.fumbles++;
    if (chance(state, 0.3)) { s.targets++; s.rec++; s.recYds += randInt(state, 2, 12); }
  } else {
    const tg = chance(state, 0.5) ? (chance(state, 0.25) ? 2 : 1) : 0;
    s.targets += tg;
    for (let i = 0; i < tg; i++) {
      if (chance(state, 0.5 + o * 0.0022)) { s.rec++; s.recYds += Math.max(1, Math.round(gauss(state, 7 + o * 0.06, 4))); }
    }
    if (out === 'TD' && chance(state, 0.26)) s.recTD++;
  }
}

function endGame(state, g) {
  if (g.score.home === g.score.away) {
    const [h, a] = breakTie(state, g.score.home, g.score.away, g.ratings.home, g.ratings.away);
    const side = h > g.score.home ? 'home' : 'away';
    const pts = Math.max(h - g.score.home, a - g.score.away);
    g.score.home = h; g.score.away = a;
    g.log.push({ q: 'OT', clock: '', team: teamAbbr(state, side === 'home' ? g.homeId : g.awayId), user: side === g.userSide, out: pts === 7 ? 'TD' : 'FG', text: `Overtime ${pts === 7 ? 'touchdown' : 'field goal'}!`, score: `${a}-${h}`, key: false });
  }
  g.finished = true;
  g.won = g.score[g.userSide] > g.score[otherSide(g.userSide)];
  g.grade = gameGrade(state, g);
}

/** 0-100 grade for the user's performance this game. */
export function gameGrade(state, g) {
  if (g.sitOut) return 0;
  const pos = state.player.position;
  const s = g.userStats;
  let prod;
  if (pos === 'QB') prod = s.passYds / 3.2 * 0.45 + s.passTD * 14 + (s.passAtt ? (s.passComp / s.passAtt - 0.5) * 60 : 0) - s.int * 12 - s.sacks * 2;
  else if (pos === 'RB') prod = s.rushYds / 1.2 * 0.55 + s.rushTD * 15 + s.recYds * 0.3 - s.fumbles * 14;
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

export function randomCallFor(state) {
  return pick(state, ['safe', 'balanced', 'risky']);
}
