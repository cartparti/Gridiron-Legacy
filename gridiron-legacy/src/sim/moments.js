// v0.62: fantasy points, jersey sales rankings (pros), a career bucket list, the postgame handshake with your rival,
// and a birthday party once a year. Pure sim.
import { clamp } from '../core/util.js';
import { logJournal } from './journal.js';

// ---------------------------------------------------------------- fantasy points

/** Standard-ish fantasy scoring for one stat line (any position). */
export function fantasyPoints(pos, s = {}) {
  let p = (s.passYds ?? 0) / 25 + (s.passTD ?? 0) * 4 - (s.int ?? 0) * 2
    + (s.rushYds ?? 0) / 10 + (s.rushTD ?? 0) * 6 + (s.recYds ?? 0) / 10 + (s.recTD ?? 0) * 6 + (s.rec ?? 0) * 0.5
    + (s.defInt ?? 0) * 3 + (s.defSacks ?? 0) * 2 + (s.defTD ?? 0) * 6 + (s.pd ?? 0) * 1 + (s.tfl ?? 0) * 1 + (s.tackles ?? 0) * 0.5
    + (s.fgMade ?? 0) * 3 + (s.xpMade ?? 0) - ((s.fgAtt ?? 0) - (s.fgMade ?? 0));
  if (pos === 'MS') p = (s.hype ?? 0) / 8 + (s.danceWins ?? 0) * 4 + (s.stunts ?? 0) * 2;
  return Math.round(p * 10) / 10;
}

/** Where a weekly score ranks among players at your position (1 = best), from a bell curve per position. */
const FP_MEAN = { QB: 18, RB: 13, WR: 12, CB: 7, DT: 6, K: 8, MS: 10 };
export function fantasyRank(pos, pts) {
  const mean = FP_MEAN[pos] ?? 10;
  const z = (pts - mean) / (mean * 0.45);
  const pct = 1 / (1 + Math.exp(-1.7 * z)); // share of players you beat
  return Math.max(1, Math.round((1 - pct) * 40) + 1);
}

// ---------------------------------------------------------------- jersey sales (pros)

/** This week's top-10 jersey sales list, with you placed by fame, wins and big games. */
export function jerseySales(state) {
  const p = state.player;
  if (state.career?.stage !== 'pro') return null;
  const team = state.league.teams.find((t) => t.id === state.career.teamId);
  const score = p.fame * 1.0 + (team ? (team.w - team.l) * 1.5 : 0) + (p.playerOfWeek ?? 0) * 0.6 + (p.rings?.length ?? 0) * 4 + (state.lastGame?.potg ? 4 : 0);
  const rank = clamp(Math.round(42 - score * 0.42), 1, 40);
  const units = Math.round(9000 * Math.exp(-rank / 9) * (1 + p.fame / 200));
  const prev = state.jerseyRank ?? null;
  return { rank, units, prev, moved: prev ? prev - rank : 0 };
}
/** beginWeek: remember last week's rank so the list can show movement. */
export function trackJerseySales(state) {
  const js = jerseySales(state);
  if (js) state.jerseyRank = js.rank;
}

// ---------------------------------------------------------------- bucket list

const sumTD = (s) => (s?.passTD ?? 0) + (s?.rushTD ?? 0) + (s?.recTD ?? 0) + (s?.defTD ?? 0);
export const BUCKET = [
  { id: 'title_hs', label: 'Win a state title', done: (st) => st.player.history.some((h) => h.stage === 'hs' && h.champion) },
  { id: 'title_col', label: 'Win a college title', done: (st) => st.player.history.some((h) => h.stage === 'college' && h.champion) },
  { id: 'drafted_r1', label: 'Go in the first round', done: (st) => st.player.draft?.round === 1 },
  { id: 'ring', label: 'Win the Legacy Bowl', done: (st) => st.player.history.some((h) => h.stage === 'pro' && h.champion) },
  { id: 'mvp', label: 'Win MVP', done: (st) => st.player.history.some((h) => h.awards?.includes('Most Valuable Player')) },
  { id: 'td50', label: 'Score 50 career touchdowns', skip: (st) => ['K', 'MS'].includes(st.player.position), done: (st) => sumTD(st.player.careerStats) >= 50 },
  { id: 'mom', label: 'Buy Mom a house', done: (st) => !!st.player.flags?.bought_mom_house },
  { id: 'married', label: 'Get married', done: (st) => !!st.player.family?.wedding },
  { id: 'kid', label: 'Start a family', done: (st) => (st.player.family?.kids?.length ?? 0) > 0 },
  { id: 'pet', label: 'Adopt a pet', done: (st) => !!st.player.pet },
  { id: 'foundation', label: 'Start a charity foundation', done: (st) => !!st.foundation?.cause },
  { id: 'million', label: 'Have $10 million in the bank', done: (st) => st.player.money >= 10e6 },
  { id: 'legend_card', label: 'Pull a Legendary trading card', done: (st) => (st.player.cards ?? []).some((c) => c.rarity === 'legendary') },
  { id: 'jersey1', label: 'Top-selling jersey in the league', done: (st) => st.jerseyTop === true },
  { id: 'hof', label: 'Make the Hall of Fame', done: (st) => st.legacy?.tier?.id === 'hof' },
];
export function bucketList(state) {
  const list = BUCKET.filter((b) => !b.skip?.(state)).map((b) => ({ id: b.id, label: b.label, done: !!b.done(state) }));
  return { list, done: list.filter((x) => x.done).length, total: list.length };
}
/** After games/seasons: celebrate newly checked items once. */
export function bucketCheck(state) {
  const js = jerseySales(state);
  if (js?.rank === 1) state.jerseyTop = true;
  state.bucketDone ??= [];
  const fresh = bucketList(state).list.filter((x) => x.done && !state.bucketDone.includes(x.id));
  for (const x of fresh) { state.bucketDone.push(x.id); logJournal(state, 'ach', `Bucket list: ${x.label}.`); }
  return fresh.map((x) => x.label);
}

// ---------------------------------------------------------------- rival handshake

export const HANDSHAKES = [
  { id: 'shake', label: 'Shake hands', text: 'A firm handshake and a nod. Respect.', fx: { rival: 6, fame: 0.5, coach: 1 } },
  { id: 'hug', label: 'Hug it out', text: 'The cameras catch the hug at midfield. Both fan bases kind of love it.', fx: { rival: 10, fame: 1 } },
  { id: 'talk', label: 'Talk trash', text: 'You let him hear it all the way to the tunnel. The clip goes everywhere.', fx: { rival: -8, fame: 1.5, coach: -2 } },
  { id: 'walk', label: 'Walk away', text: 'No handshake. Just a long look and the tunnel.', fx: { rival: -4, mood: 1 } },
];
/** The postgame card shows after rivalry games until you pick. */
export function handshakeDue(state) {
  const g = state.lastGame;
  return !!g && g.rivalry && !g.sitOut && !g.handshake;
}
export function doHandshake(state, id) {
  const g = state.lastGame, p = state.player;
  const h = HANDSHAKES.find((x) => x.id === id);
  if (!h || !handshakeDue(state)) return null;
  g.handshake = id;
  if (h.fx.rival) p.rel.rival = clamp((p.rel.rival ?? 50) + h.fx.rival, 0, 100);
  if (h.fx.coach) p.rel.coach = clamp(p.rel.coach + h.fx.coach, 0, 100);
  if (h.fx.fame) p.fame = clamp(p.fame + h.fx.fame, 0, 100);
  if (h.fx.mood) p.mood = clamp(p.mood + h.fx.mood, 0, 100);
  return { text: h.text };
}

// ---------------------------------------------------------------- birthday

export const PARTIES = [
  { id: 'family', label: 'Dinner with the family', text: 'Mom made your favorite. Dad told the same embarrassing story again.', fx: { mood: 6, rel: { family: 6 } } },
  { id: 'team', label: 'Throw a party for the team', text: 'The whole locker room shows up. Someone brings a cake shaped like a football.', fx: { mood: 8, rel: { teammates: 4 }, money: -1 } },
  { id: 'partner', label: 'A quiet night with {partner}', needs: 'partner', text: '{partner} surprises you with tickets to a concert. Best birthday ever.', fx: { mood: 7, rel: { partner: 8 } } },
  { id: 'fans', label: 'Live stream with fans', text: 'Thousands of fans sing happy birthday in the chat.', fx: { mood: 4, fame: 1.5 } },
];
const PARTY_COST = { hs: 60, college: 300, pro: 15000 };

/** beginWeek: the birthday is one fixed regular-season week per career (from the save seed). */
export function birthdayCheck(state) {
  const c = state.career, lg = state.league;
  if (lg?.phase !== 'regular') return null;
  const nm = `${state.player.first}${state.player.last}`;
  let hsh = 7; for (const ch of nm) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
  const wk = (state.player.birthWeek ??= hsh % 7); // stable, never touches the save's dice
  if ((lg.week ?? 0) !== Math.min(wk, (lg.schedule?.length ?? 8) - 1) || state.birthday?.year === c.year) return null;
  state.birthday = { year: c.year, age: state.player.age, party: null };
  return state.birthday;
}
export const isBirthdayWeek = (state) => state.birthday?.year === state.career?.year && !state.birthday.done && state.league?.phase === 'regular';

export function throwParty(state, id) {
  const b = state.birthday, p = state.player;
  const party = PARTIES.find((x) => x.id === id);
  if (!b || b.party || !party || (party.needs === 'partner' && !p.partnerName)) return null;
  b.party = id;
  if (party.fx.money) p.money -= PARTY_COST[state.career.stage] ?? 300;
  for (const k of ['mood', 'fame']) if (party.fx[k]) p[k] = clamp(p[k] + party.fx[k], 0, 100);
  for (const [k, v] of Object.entries(party.fx.rel ?? {})) p.rel[k] = clamp((p.rel[k] ?? 50) + v, 0, 100);
  return { text: party.text.replace(/\{partner\}/g, p.partnerName ?? 'your partner') };
}
/** finishGame: the birthday week ends after the game. */
export function birthdayAfterGame(state) { if (isBirthdayWeek(state)) state.birthday.done = true; }
