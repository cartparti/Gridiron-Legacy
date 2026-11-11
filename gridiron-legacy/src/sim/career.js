// Career depth: earning your spot (depth chart), the season award race, recruiting stars + campus visits,
// the pre-draft combine, season stakes for the hub, life after football and the next generation.
import { clamp } from '../core/util.js';
import { gauss, chance, pick, randInt, rand } from '../core/rng.js';
import { getTeam, standings, genName } from './league.js';
import { seasonPerf } from './awards.js';
import { addNews } from './press.js';
import { textFrom } from './phone.js';

// ---------------------------------------------------------------- depth chart

/**
 * Start of a new team: you're the starter only if you're clearly better than the incumbent.
 * opts.edge: how much better (+) or worse (-) the incumbent is than you; defaults by stage.
 */
export function initDepth(state, { edge = null } = {}) {
  const p = state.player;
  const stage = state.career.stage;
  const n = genName(state);
  const base = edge ?? (stage === 'hs' ? randInt(state, 1, 5) : stage === 'college' ? randInt(state, 2, 7) : randInt(state, 0, 6));
  const rival = { name: `${n.first} ${n.last}`, ovr: Math.round(p.ovr + base), age: stage === 'pro' ? randInt(state, 25, 31) : null };
  p.depth = { role: base <= 0 ? 'starter' : 'backup', rival, trust: 50, weeks: 0, history: [] };
  if (p.depth.role === 'backup') addNews(state, 'story', `${p.first} ${p.last} opens as the backup ${p.position} behind ${rival.name}.`);
  return p.depth;
}

/** How strong your case is to start: rating + coach trust + relationship. */
export function depthScore(state) {
  const p = state.player;
  const d = p.depth;
  return p.ovr + (d.trust - 50) / 6 + (p.rel.coach - 50) / 12;
}

/** Weekly check (start of a week): the rival develops; promotions, benchings, injuries ahead of you. */
export function weeklyDepth(state) {
  const p = state.player;
  const d = p.depth;
  if (!d) return null;
  d.weeks++;
  d.rival.ovr += 0.08 + (d.rival.age && d.rival.age > 30 ? -0.12 : 0);
  const score = depthScore(state);
  let msg = null;
  if (d.role === 'backup') {
    if (chance(state, 0.04)) { msg = `${d.rival.name} is hurt. You're starting this week!`; d.role = 'starter'; d.trust = Math.max(d.trust, 52); }
    else if (score >= d.rival.ovr + 1) { msg = `You've won the starting job over ${d.rival.name}!`; d.role = 'starter'; }
  } else if (score < d.rival.ovr - 3.5 && d.weeks > 2) {
    msg = `Coach benches you for ${d.rival.name}. Win it back in practice and when you get your snaps.`;
    d.role = 'backup';
    d.trust = Math.min(d.trust, 45);
  }
  if (msg) {
    d.history.push({ week: state.league.week, role: d.role });
    addNews(state, 'story', msg.replace(/^You/, `${p.first} ${p.last}`).replace("You've", `${p.first} has`));
    textFrom(state, 'coach', d.role === 'starter' ? `${msg} Don't make me regret it.` : msg);
    state.week && (state.week.depthNews = msg);
  }
  return msg;
}

/** After a game: coach trust follows how you played (and how much you got to). */
export function depthAfterGame(state, grade, played) {
  const d = state.player.depth;
  if (!d || !played) return;
  d.trust = clamp(d.trust + (grade - 62) / (d.role === 'backup' ? 3.5 : 6), 0, 100);
}

/** Practice / training also counts (drill grades 0..1 from the week). */
export function depthFromPractice(state, q) {
  const d = state.player.depth;
  if (!d) return;
  d.trust = clamp(d.trust + (q - 0.5) * 6, 0, 100);
}

export const isBackup = (state) => state.player.depth?.role === 'backup';

// ---------------------------------------------------------------- award race

/** Four other contenders for the top award at your position, created at the start of each season. */
export function initRace(state) {
  const league = state.league;
  const teams = league.teams.filter((t) => t.id !== state.career.teamId);
  state.race = Array.from({ length: 4 }, () => {
    const n = genName(state);
    const t = pick(state, teams);
    return { name: `${n.first} ${n.last}`, teamId: t.id, base: clamp(gauss(state, 66, 7), 48, 88), perf: 0 };
  });
}

/** Weekly drift for the contenders; returns the sorted race with you in it. */
export function awardRace(state, { advance = false } = {}) {
  if (!state.race) initRace(state);
  const p = state.player;
  if (advance) for (const r of state.race) r.perf = clamp(r.base + gauss(state, 0, 4), 30, 98);
  const games = p.seasonStats?.games ?? 0;
  const mine = games ? seasonPerf(p.position, p.seasonStats) : 0;
  const list = state.race.map((r) => ({ name: r.name, team: getTeam(state.league, r.teamId)?.name ?? '', perf: games ? (r.perf || r.base) : 0 }));
  list.push({ name: `${p.first} ${p.last}`, team: getTeam(state.league, state.career.teamId)?.name ?? '', perf: mine, you: true });
  return list.sort((a, b) => b.perf - a.perf);
}

// ---------------------------------------------------------------- season stakes

export function seasonStakes(state) {
  const league = state.league;
  const me = getTeam(league, state.career.teamId);
  if (!me) return null;
  // playoffs: top 4 per conference in the pros, top 4 overall below that (see league.seedPlayoffs)
  const pro = league.kind === 'pro';
  const confTeams = pro ? standings(league, me.conf) : standings(league);
  const all = standings(league);
  const rank = confTeams.findIndex((t) => t.id === me.id) + 1;
  const spots = 4;
  const left = Math.max(0, league.schedule.length - league.week);
  const cutoff = confTeams[spots - 1];
  const behind = cutoff ? (cutoff.w - me.w) : 0;
  let status = rank <= spots ? (rank <= Math.max(1, Math.floor(spots / 3)) ? 'Leading the race' : 'In playoff position') : behind <= 0 ? 'On the bubble' : behind <= left ? `${behind} game${behind === 1 ? '' : 's'} out of a playoff spot` : 'Eliminated from playoff contention';
  if (league.phase === 'playoffs') status = 'Playoffs: win or go home';
  return { record: `${me.w}-${me.l}`, rank, of: confTeams.length, overall: all.findIndex((t) => t.id === me.id) + 1, status, left, conf: pro ? me.conf : null };
}

// ---------------------------------------------------------------- recruiting

/** Star rating as a recruit (1-5) from rating, production and buzz. */
export function recruitStars(state) {
  const p = state.player;
  const awards = p.awards.filter((a) => a.stage === 'hs').length;
  const score = p.ovr + p.fame * 0.15 + awards * 2;
  return score >= 74 ? 5 : score >= 67 ? 4 : score >= 60 ? 3 : score >= 53 ? 2 : 1;
}

/** Visit a campus: reveals your depth chart there and a feel for the place. Two visits per recruitment. */
export function visitSchool(state, teamId) {
  const o = state.offers.find((x) => x.teamId === teamId);
  if (!o || o.visit) return o?.visit ?? null;
  state.visits = (state.visits ?? 0) + 1;
  const p = state.player;
  // incumbent at your position: better programs have better players ahead of you
  const edge = Math.round((o.prestige - 2.5) * 2.4 + gauss(state, 0, 2.5) - (recruitStars(state) - 3) * 2);
  const n = genName(state);
  const vibe = pick(state, ['The players treated you like family.', 'The facilities blew you away.', 'The coach knew your stats by heart.', 'The campus is gorgeous. Your mom cried.', 'The locker room felt a little cold.', 'Game day there is insane: 90,000 fans.']);
  o.visit = { edge, incumbent: `${n.first} ${n.last}`, vibe, start: edge <= 0 ? 'Starting job from day one' : edge <= 3 ? 'Real shot to start as a freshman' : 'Likely a backup your first year' };
  if (vibe.includes('cold')) p.mood = clamp(p.mood - 2, 0, 100); else p.mood = clamp(p.mood + 2, 0, 100);
  return o.visit;
}

// ---------------------------------------------------------------- pre-draft combine

const INTERVIEW = [
  { q: '"Tell us about a time you failed."', a: [
    { t: 'Own a real mistake and what you learned.', d: 2.2, note: 'Scouts loved the honesty.' },
    { t: '"Honestly? I don\'t really fail."', d: -2, note: 'A few teams took you off their board.' },
    { t: 'Talk about a tough loss and moving on.', d: 0.8, note: 'Solid, safe answer.' }] },
  { q: '"Why should we draft you over the guy ranked ahead of you?"', a: [
    { t: 'Point to your film and work ethic.', d: 1.6, note: 'The GM nodded the whole time.' },
    { t: 'Trash the other guy.', d: -1.8, note: 'That went around the league fast.' },
    { t: '"Because I want it more."', d: 0.6, note: 'Cliché, but they believed you.' }] },
  { q: '"Draw up your favorite play on the whiteboard."', a: [
    { t: 'Break it down for every position.', d: 2, note: 'The coaches were impressed.' },
    { t: 'Just draw your own route / assignment.', d: 0.4, note: 'Fine, nothing special.' },
    { t: 'Freeze up.', d: -1.4, note: 'Rough. But only one team saw it.' }] },
];

/** Combine results from your ratings (with a little day-of luck). */
export function runCombine(state) {
  const p = state.player;
  const s = p.stats;
  const forty = clamp(4.95 - (s.speed - 50) * 0.016 + gauss(state, 0, 0.04), 4.22, 5.35);
  const bench = Math.round(clamp(8 + (s.strength - 40) * 0.42 + gauss(state, 0, 2), 4, 40));
  const vert = Math.round(clamp(26 + (s.speed + s.skill - 100) * 0.12 + gauss(state, 0, 1.5), 22, 44) * 2) / 2;
  const drill = clamp(Math.round(s.skill * 0.7 + s.iq * 0.3 + gauss(state, 0, 4)), 30, 99);
  const bonus = (4.6 - forty) * 4 + (drill - 70) * 0.05;
  state.combine = { forty: forty.toFixed(2), bench, vert, drill, bonus, interview: INTERVIEW[randInt(state, 0, INTERVIEW.length - 1)], answer: null };
  return state.combine;
}

export function answerInterview(state, i) {
  const c = state.combine;
  if (!c || c.answer !== null) return null;
  c.answer = i;
  c.bonus += c.interview.a[i].d;
  return c.interview.a[i];
}

/** Projected draft range from the draft stock (shown before the draft). */
export function projection(stockValue) {
  if (stockValue >= 86) return 'Top 10 pick';
  if (stockValue >= 80) return 'First round';
  if (stockValue >= 75) return 'Late first / early second round';
  if (stockValue >= 70) return 'Rounds 2-3';
  if (stockValue >= 64) return 'Rounds 4-5';
  if (stockValue >= 58) return 'Late rounds';
  return 'Undrafted free agent';
}

// ---------------------------------------------------------------- after football

export const POST_CAREER = [
  { id: 'coach', label: 'Coach', desc: 'Go back to your high school and coach the next wave.', epilogue: (p) => `Coach ${p.last} took over at ${p.hometown}, where kids still run your old plays. Every fall, the bleachers fill up a little more.` },
  { id: 'broadcast', label: 'Broadcaster', desc: 'Call games on TV. You know what a player sees.', epilogue: (p) => `${p.first} ${p.last} became the voice of Sunday afternoons. Your call of a rookie's game winner went viral: "THAT is football."` },
  { id: 'family', label: 'Family', desc: 'Step away from the spotlight and be there for every moment at home.', epilogue: (p) => `${p.first} traded film sessions for school pickups. On weekends you're in the stands, the loudest parent there.` },
  { id: 'business', label: 'Business', desc: 'Build something with what football gave you.', epilogue: (p) => `${p.last} Athletics started in a garage and now trains half the kids in ${p.hometown}. You still run the morning sessions.` },
];

/** A new career as your kid: same last name and hometown, a small head start from your legacy. */
export function nextGenerationOpts(state) {
  const p = state.player;
  const tier = state.legacy?.score ?? 50;
  const boy = genName(state);
  return {
    first: boy.first, last: p.last, position: p.position, background: 'natural', number: p.number,
    hometown: p.hometown, customTown: state.career.customTown ?? null, hsTeamId: null,
    difficulty: state.difficulty ?? 'normal', legacyBonus: clamp(Math.round(tier / 25), 1, 4), parentName: `${p.first} ${p.last}`,
  };
}

export const rollPct = (state) => rand(state);
