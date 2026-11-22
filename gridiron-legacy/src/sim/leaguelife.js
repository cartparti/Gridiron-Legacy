// League life around your games (pure sim):
//   rivalry trophies   - every rivalry plays for a named trophy; who holds it, the streak, the history
//   power rankings     - weekly top-to-bottom rankings with movement and a one-line take on every team
//   preseason preview  - the season magazine: projected record, preseason rank, your award odds, a bold prediction
//   record chase       - records within reach this season / career, with what you need per game
//   play of the week   - your best play gets nominated; the fans vote
import { clamp } from '../core/util.js';
import { rand, pick } from '../core/rng.js';
import { getTeam, standings } from './league.js';
import { addNews } from './press.js';
import { logJournal } from './journal.js';
import { STAT_CATS, RECORD_LABELS } from './awards.js';
import { addXp } from './progress.js';

const hash = (s) => { let x = 2166136261; for (const ch of String(s)) { x ^= ch.charCodeAt(0); x = Math.imul(x, 16777619); } return x >>> 0; };

// ---------------------------------------------------------------- rivalry trophies

const TROPHY_THINGS = ['Copper Kettle', 'Iron Lantern', 'Golden Spur', 'Stone Anvil', 'Silver Compass', 'Brass Horseshoe', 'River Oar', 'Prairie Bell', 'Old Lantern',
  'Rusty Plow', 'Bronze Boot', 'Granite Cup', 'Steel Spike', 'Hickory Stick', 'Cast-Iron Skillet', 'Golden Goalpost', 'Silver Saddle', 'Big Brass Key'];
const TROPHY_FORMS = ['The {T}', 'The Battle for the {T}', 'The {T} Game', '{C1}-{C2} {T} Classic'];

const rivKey = (a, b) => [a, b].sort().join('~');

/** The trophy two teams play for (stable name). */
export function rivalryTrophy(state, a, b) {
  state.rivalTrophies ??= {};
  const key = rivKey(a.id, b.id);
  if (!state.rivalTrophies[key]) {
    const h = hash(key);
    const thing = TROPHY_THINGS[h % TROPHY_THINGS.length];
    const form = TROPHY_FORMS[(h >>> 5) % TROPHY_FORMS.length];
    const [x, y] = [a, b].sort((p, q) => p.id.localeCompare(q.id));
    state.rivalTrophies[key] = { key, name: form.replace('{T}', thing).replace('{C1}', x.city).replace('{C2}', y.city), teams: [a.id, b.id], holder: null, streak: 0, history: [] };
  }
  return state.rivalTrophies[key];
}

/** After a rivalry game: the trophy changes hands (or stays). Returns { trophy, kept, won, lost }. */
export function settleRivalry(state, g) {
  if (!g?.rivalry) return null;
  const L = state.league;
  const me = getTeam(L, state.career.teamId), opp = getTeam(L, g.oppId);
  if (!me || !opp) return null;
  const tr = rivalryTrophy(state, me, opp);
  const winner = g.won ? me.id : opp.id;
  const prev = tr.holder;
  tr.streak = prev === winner ? tr.streak + 1 : 1;
  tr.holder = winner;
  tr.history.push({ year: state.career.year, winner, score: `${Math.max(g.score.home, g.score.away)}-${Math.min(g.score.home, g.score.away)}`, you: g.won });
  if (tr.history.length > 30) tr.history.splice(0, tr.history.length - 30);
  const res = { trophy: tr, kept: g.won && prev === me.id, won: g.won && prev !== me.id, lost: !g.won };
  if (g.won) {
    state.player.rivalWins = (state.player.rivalWins ?? 0) + 1;
    state.trophyCase ??= {};
    state.trophyCase[tr.key] = { name: tr.name, count: (state.trophyCase[tr.key]?.count ?? 0) + 1, opp: `${opp.city} ${opp.name}` };
    addNews(state, 'story', `The ${me.name} ${res.kept ? 'keep' : 'take'} ${tr.name}${tr.streak > 1 ? ` (${tr.streak} straight)` : ''}.`);
    logJournal(state, 'title', `${res.kept ? 'Kept' : 'Won'} ${tr.name} against the ${opp.city} ${opp.name}${tr.streak > 1 ? `, ${tr.streak} in a row` : ''}.`);
  }
  return res;
}

// ---------------------------------------------------------------- power rankings

function powerScore(L, t) {
  const gp = Math.max(1, t.w + t.l);
  const wp = t.w / gp;
  const diff = (t.pf - t.pa) / gp;
  return wp * 60 + clamp(diff, -25, 25) * 1.1 + ((t.off ?? 65) + (t.def ?? 65)) / 2 * 0.45 + (gp < 2 ? ((t.base ?? 65) - 65) * 0.4 : 0);
}
const TAKES = {
  up: ['Rolling. Nobody wants to see them right now.', 'Climbing fast after a statement win.', 'Hot streak, and it looks real.', 'Finding their identity at the right time.'],
  down: ['Free fall. Something has to change.', 'Stumbling. The schedule is not getting easier.', 'Big questions after that loss.', 'Sliding, and the locker room knows it.'],
  top: ['The team to beat until someone does.', 'Complete team. No weakness to attack.', 'Built for January.'],
  bottom: ['Rebuilding, and it shows.', 'Looking for answers on both sides of the ball.', 'Playing for pride (and next year).'],
  mid: ['Somewhere in the middle, waiting for a breakout.', 'Good enough to beat anyone, bad enough to lose to anyone.', 'Steady, unspectacular, in the mix.', 'Defense is carrying them.', 'Can score with anybody.'],
};

/** This week's power rankings: [{ rank, team, move, take, record, you }] */
export function powerRankings(state) {
  const L = state.league;
  if (!L?.teams?.length) return [];
  const list = L.teams.slice().sort((a, b) => powerScore(L, b) - powerScore(L, a) || a.id.localeCompare(b.id));
  const prev = L.powerPrev ?? {};
  const n = list.length;
  return list.map((t, i) => {
    const rank = i + 1;
    const move = prev[t.id] ? prev[t.id] - rank : 0;
    const h = hash(`${t.id}${L.week}`);
    const pool = rank <= 2 ? TAKES.top : rank > n - 2 ? TAKES.bottom : move >= 2 ? TAKES.up : move <= -2 ? TAKES.down : TAKES.mid;
    return { rank, team: t, move, take: pool[(h + rank) % pool.length], record: `${t.w}-${t.l}`, you: t.id === state.career.teamId };
  });
}
/** Remember last week's ranks (called at the start of each week). */
export function snapshotPower(state) {
  const L = state.league;
  if (!L?.teams?.length) return;
  const fresh = L.teams.every((t) => t.w + t.l === 0); // a new season: no movement yet
  L.powerPrev = fresh ? {} : L.powerNow ?? {};
  L.powerNow = fresh ? {} : Object.fromEntries(powerRankings(state).map((r) => [r.team.id, r.rank]));
}

// ---------------------------------------------------------------- preseason preview magazine

const MAGS = { hs: 'Friday Night Preview', college: 'Campus Gridiron Annual', pro: 'Pro Football Preview' };
const BOLD = ['{last} finishes top three in the award race.', 'The {team} make a run nobody saw coming.', '{last} breaks out and owns the highlight reels.',
  'This is the year {last} becomes a household name.', 'A rivalry win flips the whole season.', 'Someone in this division goes undefeated at home. It might be the {team}.'];

/** Build the preview at the start of a season (stored in state.preview). */
export function makePreview(state) {
  const c = state.career, p = state.player, L = state.league;
  if (!L || state.preview?.year === c.year && state.preview?.stage === c.stage) return state.preview;
  const me = getTeam(L, c.teamId);
  const ranked = L.teams.slice().sort((a, b) => ((b.off + b.def) / 2 + (b.base ?? 0) * 0.2) - ((a.off + a.def) / 2 + (a.base ?? 0) * 0.2));
  const preRank = ranked.findIndex((t) => t.id === me.id) + 1;
  const games = L.schedule?.length ?? 10;
  const strength = 1 - (preRank - 1) / Math.max(1, ranked.length - 1);
  const projW = clamp(Math.round(games * (0.25 + strength * 0.6) + (rand(state) - 0.5) * 2), 1, games);
  const cover = (p.fame ?? 0) >= 55 || (preRank <= 2 && (p.ovr ?? 0) >= 75);
  const odds = clamp(Math.round(((p.ovr ?? 60) - 60) * 1.4 + (p.fame ?? 0) * 0.25 - (p.depth?.role === 'backup' ? 25 : 0) + strength * 10), 1, 60);
  state.preview = {
    year: c.year, stage: c.stage, mag: MAGS[c.stage], cover, preRank, teams: ranked.length,
    projected: `${projW}-${games - projW}`, odds,
    headline: cover ? `${p.first} ${p.last}: ${pick(state, ['The Main Event', 'Ready to Take Over', 'No Ceiling', 'The Franchise', 'Built Different'])}` : `${me.city} ${me.name}: ${preRank <= 3 ? 'Contenders' : preRank <= ranked.length / 2 ? 'Dark Horse' : 'Long Season Ahead?'}`,
    bold: pick(state, BOLD).replace('{last}', p.last).replace('{team}', me.name),
    toWatch: ranked.slice(0, 3).filter((t) => t.id !== me.id).slice(0, 2).map((t) => `${t.city} ${t.name}`),
  };
  return state.preview;
}

// ---------------------------------------------------------------- record chase

/** Records you can chase right now (pros): [{ key, label, kind: 'season'|'career', cur, record, holder, need, perGame, pace, pct }] */
export function recordChase(state) {
  const p = state.player;
  const R = state.records;
  if (state.career?.stage !== 'pro' || !R) return [];
  const L = state.league;
  const games = L?.schedule?.length ?? 17;
  const played = p.seasonStats?.games ?? 0;
  const left = Math.max(0, games - (L?.week ?? 0));
  const out = [];
  for (const [key] of STAT_CATS[p.position] ?? []) {
    const label = RECORD_LABELS[key] ?? key;
    const sr = R.season?.[key];
    if (sr && !sr.user) {
      const cur = p.seasonStats?.[key] ?? 0;
      const pace = played ? Math.round((cur / played) * games) : 0;
      const need = Math.max(0, sr.value + 1 - cur);
      if (played >= 3 && pace >= sr.value * 0.82) out.push({ key, label, kind: 'season', cur, record: sr.value, holder: sr.holder, year: sr.year, need, perGame: left ? Math.ceil(need / left) : need, pace, pct: clamp(cur / sr.value, 0, 1) });
    }
    const cr = R.career?.[key];
    if (cr && !cr.user) {
      const cur = p.proCareerStats?.[key] ?? 0;
      if (cur >= cr.value * 0.7) out.push({ key, label, kind: 'career', cur, record: cr.value, holder: cr.holder, year: cr.year, need: Math.max(0, cr.value + 1 - cur), perGame: null, pace: null, pct: clamp(cur / cr.value, 0, 1) });
    }
  }
  return out.sort((a, b) => b.pct - a.pct);
}

// ---------------------------------------------------------------- play of the week

/** After a game: your best play may be nominated (stored on lastGame.potw). */
export function nominatePlay(state, lg) {
  if (!lg || lg.sitOut || !lg.moments?.length) return null;
  const best = lg.moments.slice().sort((a, b) => (b.quality ?? 0) + (b.td ? 0.15 : 0) + ((b.yards ?? 0) / 100) - ((a.quality ?? 0) + (a.td ? 0.15 : 0) + ((a.yards ?? 0) / 100)))[0];
  const score = (best.quality ?? 0) + (best.td ? 0.12 : 0) + clamp((best.yards ?? 0) / 120, 0, 0.25) + (lg.isTitle || lg.playoff ? 0.05 : 0);
  if (score < 1.03) return null;
  const others = ['A one-handed grab in traffic', 'A 70-yard punt return', 'A strip-sack fumble return', 'A juggling sideline catch', 'A goal-line stand stop'];
  const a = pick(state, others);
  return { label: best.label, text: best.text, score, rivals: [a, pick(state, others.filter((x) => x !== a))], voted: false, won: null };
}

/** The fans vote. boost = you campaigned on social (a little more likely). */
export function votePlay(state, { boost = false } = {}) {
  const pw = state.lastGame?.potw;
  if (!pw || pw.voted) return pw;
  pw.voted = true;
  const pct = clamp(0.3 + (pw.score - 1.03) * 2.2 + (state.player.fame ?? 0) / 300 + (boost ? 0.12 : 0) + (rand(state) - 0.5) * 0.3, 0.05, 0.85);
  pw.share = Math.round(clamp(pct + 0.12, 0.2, 0.75) * 100);
  pw.won = rand(state) < pct;
  const p = state.player;
  if (pw.won) {
    p.potw = (p.potw ?? 0) + 1;
    p.fame = clamp((p.fame ?? 0) + 3, 0, 100);
    addXp(state, 40);
    addNews(state, 'award', `${p.first} ${p.last} wins Play of the Week: ${pw.label}.`);
    logJournal(state, 'award', `Play of the Week: ${pw.label}.`);
  } else p.fame = clamp((p.fame ?? 0) + 0.5, 0, 100);
  if (boost) p.mood = clamp(p.mood - 1, 0, 100); // begging for votes is a little embarrassing
  return pw;
}
