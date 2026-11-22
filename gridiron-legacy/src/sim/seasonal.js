// Season traditions: Homecoming week, Senior Night (your last home game at a level, or the farewell home finale in
// the pros), the video game ratings reveal before each season, and designing your championship ring. Pure sim.
import { clamp } from '../core/util.js';
import { rand, gauss } from '../core/rng.js';
import { STAGES } from '../data/config.js';
import { addNews } from './press.js';
import { logJournal } from './journal.js';
import { addXp } from './progress.js';

const thisWeekHome = (state) => {
  const wk = state.league?.schedule?.[state.league.week];
  const g = wk?.find((x) => x.home === state.career.teamId || x.away === state.career.teamId);
  return g ? g.home === state.career.teamId : false;
};

// ---------------------------------------------------------------- homecoming

export const HOMECOMING_PLANS = [
  { id: 'partner', label: 'Take {partner} to the dance', needs: 'partner', fx: { mood: 6, rel: { partner: 8 } }, text: 'You danced all night. {partner} still talks about it.' },
  { id: 'friends', label: 'Go with the team', fx: { mood: 4, rel: { teammates: 4 } }, text: 'The whole team showed up in matching ties. Legendary group photo.' },
  { id: 'family', label: 'Bring the family to the parade', fx: { mood: 3, rel: { family: 6 } }, text: 'Mom cried when your float went by. Dad filmed all of it, mostly sideways.' },
  { id: 'rest', label: 'Skip it and rest up', fx: { health: 6, mood: -1 }, text: 'An early night. Your legs will thank you on Friday.' },
];

/** beginWeek: one home game between weeks 2 and 5 of a school season is Homecoming. */
export function homecomingCheck(state) {
  const c = state.career, lg = state.league;
  if (!['hs', 'college'].includes(c.stage) || lg?.phase !== 'regular') return null;
  if (state.homecoming?.year === c.year) return null;
  const wk = lg.week ?? 0;
  if (wk < 2 || wk > 5 || !thisWeekHome(state)) return null;
  // later weeks always count, so a home game in the window always becomes homecoming
  const laterHome = (lg.schedule ?? []).slice(wk + 1, 6).some((games) => games.some((x) => x.home === c.teamId));
  if (laterHome && rand(state) < 0.45) return null;
  const p = state.player;
  const odds = clamp((c.stage === 'hs' ? 0.15 + p.fame / 55 : 0.05 + p.fame / 85) + (p.rel.teammates - 50) / 250, 0.03, 0.92);
  state.homecoming = { year: c.year, week: wk, king: rand(state) < odds, plan: null, won: null };
  return state.homecoming;
}

export const isHomecomingWeek = (state) => state.homecoming?.year === state.career?.year && state.homecoming.week === state.league?.week && state.league?.phase === 'regular';

export function chooseHomecoming(state, id) {
  const hc = state.homecoming;
  if (!isHomecomingWeek(state) || hc.plan) return null;
  const plan = HOMECOMING_PLANS.find((x) => x.id === id);
  if (!plan || (plan.needs === 'partner' && !state.player.partnerName)) return null;
  const p = state.player;
  hc.plan = id;
  applyFx(p, plan.fx);
  if (hc.king) { p.fame = clamp(p.fame + 2, 0, 100); logJournal(state, 'award', 'Crowned Homecoming King.', { big: false }); }
  return { text: plan.text.replace(/\{partner\}/g, p.partnerName ?? 'your date'), king: hc.king };
}

// ---------------------------------------------------------------- senior night

export const ESCORTS = [
  { id: 'family', label: 'Mom and Dad', fx: { rel: { family: 8 }, mood: 6 } },
  { id: 'partner', label: '{partner}', needs: 'partner', fx: { rel: { partner: 8 }, mood: 5 } },
  { id: 'coach', label: 'Coach {coach}', fx: { rel: { coach: 8 }, mood: 3 } },
  { id: 'teammates', label: 'Your position group', fx: { rel: { teammates: 5 }, mood: 4 } },
];

/** Is this week the last regular-season home game of your final season at this level (or of your farewell tour)? */
export function seniorNightKind(state) {
  const c = state.career, lg = state.league;
  if (lg?.phase !== 'regular' || !thisWeekHome(state)) return null;
  const last = c.stage === 'hs' ? c.stageSeason >= STAGES.hs.seasons
    : c.stage === 'college' ? c.stageSeason >= STAGES.college.seasons
      : c.stage === 'pro' && state.farewell?.year === c.year;
  if (!last) return null;
  const laterHome = (lg.schedule ?? []).slice((lg.week ?? 0) + 1).some((games) => games.some((x) => x.home === c.teamId));
  if (laterHome) return null;
  return c.stage === 'pro' ? 'farewell' : 'senior';
}

/** beginWeek */
export function seniorNightCheck(state) {
  const kind = seniorNightKind(state);
  if (!kind) return null;
  const key = `${state.career.stage}-${state.career.year}`;
  if (state.seniorNight?.key === key) return state.seniorNight;
  state.seniorNight = { key, kind, week: state.league.week, escort: null, watched: false };
  return state.seniorNight;
}

export const isSeniorNight = (state) => !!state.seniorNight && state.seniorNight.key === `${state.career?.stage}-${state.career?.year}` && state.seniorNight.week === state.league?.week && state.league?.phase === 'regular';

export function chooseEscort(state, id) {
  const sn = state.seniorNight;
  if (!isSeniorNight(state) || sn.escort) return null;
  const e = ESCORTS.find((x) => x.id === id);
  if (!e || (e.needs === 'partner' && !state.player.partnerName)) return null;
  sn.escort = id;
  applyFx(state.player, e.fx);
  const where = state.career.stage === 'hs' ? 'high school' : state.career.stage === 'college' ? 'college' : 'home';
  logJournal(state, 'game', sn.kind === 'farewell' ? 'Played your last game in front of the home crowd.' : `Senior Night: walked onto the field for your last ${where} home game.`, { big: true });
  return sn;
}

export const escortLabel = (state, id) => (ESCORTS.find((x) => x.id === id)?.label ?? '').replace('{partner}', state.player.partnerName ?? 'your partner').replace('{coach}', state.player.coachName ?? '');

// ---------------------------------------------------------------- ratings reveal

const GAME_TITLE = (year) => `Blitz Kings '${String(year + 1).slice(-2)}`;
export const REACTIONS = [
  { id: 'post', label: 'Post it', desc: 'Show the world your card' },
  { id: 'fuel', label: 'Disrespect!', desc: 'Use it as fuel this season' },
  { id: 'laugh', label: 'Laugh it off', desc: 'Roast your own speed rating' },
];

/** beginWeek at week 0 (college and pro): the video game drops this year's ratings. */
export function ratingRevealCheck(state) {
  const c = state.career, p = state.player;
  if (!['college', 'pro'].includes(c.stage) || state.league?.phase !== 'regular' || (state.league.week ?? 0) !== 0) return null;
  if (state.ratingReveal?.year === c.year) return null;
  const rating = clamp(Math.round(p.ovr + gauss(state, 0, 1.6) + (p.fame - 40) / 25 - (c.stage === 'college' ? 3 : 0)), 40, 99);
  p.gameRatings ??= [];
  const prev = p.gameRatings.length ? p.gameRatings[p.gameRatings.length - 1].rating : null;
  p.gameRatings.push({ year: c.year, stage: c.stage, rating });
  state.ratingReveal = { year: c.year, title: GAME_TITLE(c.year), rating, prev, revealed: false, reaction: null };
  if (rating >= 90) addNews(state, 'story', `${GAME_TITLE(c.year)} ratings: ${p.first} ${p.last} lands a ${rating}.`);
  return state.ratingReveal;
}

export function revealRating(state) { if (state.ratingReveal) state.ratingReveal.revealed = true; return state.ratingReveal; }

export function reactToRating(state, id) {
  const r = state.ratingReveal, p = state.player;
  if (!r || r.reaction || !REACTIONS.some((x) => x.id === id)) return null;
  r.revealed = true;
  r.reaction = id;
  let text;
  if (id === 'post') { p.fame = clamp(p.fame + (r.rating >= 85 ? 2 : 0.8), 0, 100); p.mood = clamp(p.mood + 2, 0, 100); text = r.rating >= 85 ? 'Your post goes everywhere. Kids are already arguing about your card.' : 'A few thousand likes and one guy asking why your speed is so low.'; }
  if (id === 'fuel') { p.fuel = state.career.year; p.rel.coach = clamp(p.rel.coach + 3, 0, 100); p.mood = clamp(p.mood - 1, 0, 100); text = 'You screenshot it and set it as your lock screen. Every game this season is personal.'; }
  if (id === 'laugh') { p.mood = clamp(p.mood + 4, 0, 100); p.rel.teammates = clamp(p.rel.teammates + 2, 0, 100); text = 'Your video roasting your own card has the whole locker room crying laughing.'; }
  return { text };
}

/** Tolerance multiplier from using the rating as fuel. */
export const fuelTol = (state) => (state.player?.fuel === state.career?.year ? 1.01 : 1);

// ---------------------------------------------------------------- championship rings

export const RING_STONES = [
  { id: 'diamond', label: 'Diamond', color: '#e8f4ff' }, { id: 'ruby', label: 'Ruby', color: '#d0213a' }, { id: 'sapphire', label: 'Sapphire', color: '#2456c8' },
  { id: 'emerald', label: 'Emerald', color: '#18a058' }, { id: 'onyx', label: 'Onyx', color: '#1b1c20' }, { id: 'team', label: 'Team color', color: null },
];
export const RING_BANDS = [{ id: 'gold', label: 'Yellow gold', color: '#d4af37' }, { id: 'white', label: 'White gold', color: '#d9dde3' }, { id: 'rose', label: 'Rose gold', color: '#d8957c' }];
export const RING_ENGRAVINGS = ['number', 'hometown', 'Believe', 'Earned', 'For Mom', 'Unfinished business', 'Brick by brick'];

/** endSeason: a title earns a ring to design. */
export function ringEarned(state, team, titleName) {
  state.pendingRings ??= [];
  state.pendingRings.push({ year: state.career.year, stage: state.career.stage, title: titleName, team: `${team.city} ${team.name}`, colors: team.colors.slice() });
}

export function designRing(state, { stone = 'diamond', band = 'gold', engraving = 'number' } = {}) {
  const r = state.pendingRings?.shift();
  if (!r) return null;
  const p = state.player;
  const eng = engraving === 'number' ? `#${p.number ?? 1}` : engraving === 'hometown' ? (p.hometown ?? 'Home') : engraving;
  const ring = { ...r, stone, band, engraving: eng };
  (p.rings ??= []).push(ring);
  p.mood = clamp(p.mood + 4, 0, 100);
  addXp(state, 20);
  logJournal(state, 'title', `Received your ${r.year} ${r.title} ring, engraved "${eng}".`);
  return ring;
}

export const ringColors = (ring) => ({
  stone: RING_STONES.find((s) => s.id === ring.stone)?.color ?? ring.colors?.[0] ?? '#d0213a',
  band: RING_BANDS.find((b) => b.id === ring.band)?.color ?? '#d4af37',
});

// ---------------------------------------------------------------- after the game

/** finishGame: homecoming / senior night results. */
export function traditionsAfterGame(state, g) {
  const p = state.player;
  const out = {};
  if (isHomecomingWeek(state)) {
    state.homecoming.won = !!g.won;
    if (!g.sitOut && g.won) { p.fame = clamp(p.fame + 1.5, 0, 100); p.mood = clamp(p.mood + 3, 0, 100); }
    out.homecoming = { won: !!g.won, king: state.homecoming.king };
  }
  if (isSeniorNight(state)) {
    out.seniorNight = { kind: state.seniorNight.kind, won: !!g.won };
    if (g.won) p.mood = clamp(p.mood + 4, 0, 100);
  }
  return Object.keys(out).length ? out : null;
}

function applyFx(p, fx = {}) {
  for (const k of ['mood', 'health', 'fame']) if (fx[k]) p[k] = clamp((p[k] ?? 50) + fx[k], 0, 100);
  for (const [k, v] of Object.entries(fx.rel ?? {})) p.rel[k] = clamp((p.rel[k] ?? 50) + v, 0, 100);
}
