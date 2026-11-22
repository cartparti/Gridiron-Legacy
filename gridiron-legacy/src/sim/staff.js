// Front office and sideline: contract incentives (hit a number, get a bonus), the coaching carousel (coaches get
// fired or poached; the new one has a style), and your pregame ritual (keep winning with it and you feel lucky).
// Pure sim.
import { clamp } from '../core/util.js';
import { rand, pick } from '../core/rng.js';
import { STAGES } from '../data/config.js';
import { PER_GAME } from './goals.js';
import { addNews } from './press.js';
import { logJournal } from './journal.js';
import { genPersonName } from './effects.js';

// ---------------------------------------------------------------- incentives

/** An incentive clause for a pro contract: a season stat target and a bonus. */
export function makeIncentive(state, salary) {
  const p = state.player;
  const [k, noun, per] = (PER_GAME[p.position] ?? PER_GAME.WR)[rand(state) < 0.6 ? 0 : 1];
  const games = STAGES.pro.games;
  const raw = per[2] * games * clamp(0.85 + ((p.ovr ?? 70) - 70) / 60, 0.7, 1.25) * (1.05 + rand(state) * 0.15);
  const target = raw >= 1000 ? Math.round(raw / 50) * 50 : raw >= 100 ? Math.round(raw / 10) * 10 : Math.max(2, Math.round(raw));
  const bonus = Math.max(100000, Math.round((salary * (0.08 + rand(state) * 0.07)) / 50000) * 50000);
  return { key: k, noun, target, bonus };
}

export const incentiveProgress = (state) => {
  const inc = state.player?.contract?.incentive;
  if (!inc || state.career?.stage !== 'pro') return null;
  const now = state.player.seasonStats?.[inc.key] ?? 0;
  return { ...inc, now, hit: now >= inc.target, pct: clamp(now / inc.target, 0, 1) };
};

/** endSeason (pro): pay it if you hit it. */
export function settleIncentive(state) {
  const pr = incentiveProgress(state);
  if (!pr) return null;
  if (pr.hit) {
    state.player.money += pr.bonus;
    logJournal(state, 'contract', `Hit your contract incentive (${pr.target} ${pr.noun}): ${(pr.bonus / 1e6).toFixed(2)}M bonus.`);
  }
  return { hit: pr.hit, now: pr.now, target: pr.target, noun: pr.noun, bonus: pr.bonus };
}

// ---------------------------------------------------------------- coaching carousel

export const COACH_STYLES = [
  { id: 'offense', label: 'Offensive guru', desc: 'Schemes players open. Offense plays a little easier.', tol: (pos) => (['QB', 'RB', 'WR'].includes(pos) ? 1.02 : 1) },
  { id: 'defense', label: 'Defensive mastermind', desc: 'Every call has a plan. Defense plays a little easier.', tol: (pos) => (['CB', 'DT'].includes(pos) ? 1.02 : 1) },
  { id: 'special', label: 'Special teams whiz', desc: 'Kickers and spirit squads get real attention.', tol: (pos) => (['K', 'MS'].includes(pos) ? 1.02 : 1) },
  { id: 'players', label: "Players' coach", desc: 'Loose and loyal. Everyone\'s mood is a little better.', mood: 0.8 },
  { id: 'drill', label: 'Disciplinarian', desc: 'Hard practices, sharp games. A touch more pressure every week.', tol: () => 1.012, mood: -0.4 },
];
export const coachStyle = (state) => COACH_STYLES.find((s) => s.id === state.player?.coachStyle) ?? null;
export const coachTol = (state) => coachStyle(state)?.tol?.(state.player.position) ?? 1;

/** A new coach (new team or the carousel): pick a style. */
export function assignCoachStyle(state) {
  state.player.coachStyle = pick(state, COACH_STYLES).id;
  return coachStyle(state);
}

/** endSeason: the coach may be fired (losing) or poached (winning). Not when you're leaving the level anyway. */
export function coachingCarousel(state, team) {
  const c = state.career, p = state.player;
  if (c.stage === 'hs' && c.stageSeason >= STAGES.hs.seasons) return null;
  if (c.stage === 'college' && c.stageSeason >= STAGES.college.seasons) return null;
  const games = (team.w ?? 0) + (team.l ?? 0);
  if (!games) return null;
  const pct = team.w / games;
  const champion = state.league?.champion === team.id;
  let odds = 0.05, reason = 'retires';
  if (pct < 0.4) { odds = c.stage === 'pro' ? 0.45 : 0.3; reason = 'fired'; }
  else if (pct >= 0.75 && c.stage !== 'pro') { odds = champion ? 0.3 : 0.2; reason = 'poached'; }
  if (rand(state) > odds) return null;
  const old = p.coachName;
  p.coachName = genPersonName(state);
  p.coachLook = null;
  const style = assignCoachStyle(state);
  p.rel.coach = clamp(45 + (style.id === 'players' ? 8 : style.id === 'drill' ? -5 : 0) + (p.ovr - 70) / 4, 25, 70);
  const why = reason === 'fired' ? 'was fired after a losing season' : reason === 'poached' ? 'took a bigger job after the great season' : 'retired';
  addNews(state, 'story', `Coach ${old} ${why}. The ${team.name} hire ${p.coachName}.`);
  logJournal(state, 'move', `Coach ${old} ${why}. New head coach: ${p.coachName} (${style.label}).`);
  return { old, coach: p.coachName, reason, why, style: { id: style.id, label: style.label, desc: style.desc } };
}

/** beginWeek: the coach's style in the locker room. */
export function coachWeekly(state) {
  const s = coachStyle(state);
  if (s?.mood) state.player.mood = clamp(state.player.mood + s.mood, 0, 100);
}

// ---------------------------------------------------------------- pregame ritual

export const RITUALS = [
  { id: 'breakfast', label: 'Same breakfast', emoji: '🥞', desc: 'Pancakes, two eggs, banana. Every game day.', fx: { health: 1 } },
  { id: 'playlist', label: 'Hype playlist', emoji: '🎧', desc: 'Same 11 songs, same order, headphones on.', fx: { mood: 1 } },
  { id: 'callhome', label: 'Call home', emoji: '📞', desc: 'A quick call before you leave for the stadium.', fx: { rel: { family: 1 } } },
  { id: 'socks', label: 'Lucky socks', emoji: '🧦', desc: 'Never washed during a win streak. Never.', fx: {} },
  { id: 'meditate', label: 'Meditate', emoji: '🧘', desc: 'Ten quiet minutes in the locker room.', fx: { mood: 0.5, health: 0.5 } },
  { id: 'handshake', label: 'Team handshake', emoji: '🤝', desc: 'A 14-part handshake with your best friend on the team.', fx: { rel: { teammates: 0.5 } } },
];
export const LUCKY_AT = 3;
export const ritualOf = (state) => state.ritual ?? null;

export function chooseRitual(state, id) {
  if (!RITUALS.some((r) => r.id === id)) return null;
  if (state.ritual?.id === id) return state.ritual;
  state.ritual = { id, streak: 0, best: state.ritual?.best ?? 0 };
  return state.ritual;
}

export const isLucky = (state) => (state.ritual?.streak ?? 0) >= LUCKY_AT;
export const ritualTol = (state) => (isLucky(state) ? 1.02 : 1);

/** finishGame: the streak grows with wins and resets with a loss. */
export function ritualAfterGame(state, g) {
  const r = state.ritual;
  if (!r || g.sitOut) return null;
  const def = RITUALS.find((x) => x.id === r.id);
  const p = state.player;
  for (const k of ['health', 'mood']) if (def?.fx[k]) p[k] = clamp(p[k] + def.fx[k], 0, 100);
  for (const [k, v] of Object.entries(def?.fx.rel ?? {})) p.rel[k] = clamp((p.rel[k] ?? 50) + v, 0, 100);
  const wasLucky = isLucky(state);
  if (g.won) r.streak++; else r.streak = 0;
  r.best = Math.max(r.best ?? 0, r.streak);
  return { streak: r.streak, lucky: isLucky(state), broke: wasLucky && !g.won, label: def?.label };
}
