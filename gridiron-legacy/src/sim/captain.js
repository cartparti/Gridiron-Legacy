// Team captains: before each season the locker room votes. Captains wear the C, lift the room every week, play
// with a little more poise, and give the pregame speech before big games. Pure sim.
// player.captain = the year you're captain; state.captainVote = { year, stage, won, pct }
import { clamp } from '../core/util.js';
import { rand } from '../core/rng.js';
import { addNews } from './press.js';
import { logJournal } from './journal.js';

export const isCaptain = (state) => !!state.player && state.player.captain === state.career?.year;

/** The preseason vote (called once at the start of each season). */
export function captainVote(state) {
  const p = state.player;
  const c = state.career;
  if (!p || !c || c.stage === 'retired') return null;
  if (state.captainVote?.year === c.year && state.captainVote?.stage === c.stage) return state.captainVote;
  const seasonsHere = p.history.filter((h) => h.teamId === c.teamId).length;
  const persona = state.persona ?? {};
  const n = (persona.humble ?? 0) + (persona.confident ?? 0) + (persona.fiery ?? 0);
  const leader = n >= 3 ? ((persona.humble ?? 0) - (persona.fiery ?? 0) * 0.5) / n : 0;
  let pct = 0.08 + ((p.rel.teammates ?? 50) - 50) / 90 + ((p.ovr ?? 60) - 66) / 55 + seasonsHere * 0.13 + (c.stageSeason - 1) * 0.06 + leader * 0.25 + ((p.fame ?? 0) - 30) / 300;
  if (p.depth?.role === 'backup') pct -= 0.35;
  if (c.stageSeason === 1) pct -= 0.08; // newcomers rarely get the C
  if (p.position === 'MS' || p.position === 'K') pct -= 0.12;
  pct = clamp(pct, 0.02, 0.95);
  const won = rand(state) < pct;
  if (won) {
    p.captain = c.year;
    p.captainYears = (p.captainYears ?? 0) + 1;
    addNews(state, 'story', `${p.first} ${p.last} voted a team captain by teammates.`);
    logJournal(state, 'captain', `Voted team captain (${p.captainYears === 1 ? 'first time' : `${p.captainYears} seasons`}).`, { big: p.captainYears === 1 });
  }
  state.captainVote = { year: c.year, stage: c.stage, won, pct: Math.round(pct * 100) };
  return state.captainVote;
}

/** Weekly: a captain keeps the room together. */
export function captainWeekly(state) {
  if (!isCaptain(state)) return;
  const p = state.player;
  // the room stays together: chemistry doesn't slip below 60 while you wear the C
  if ((p.rel.teammates ?? 50) < 60) p.rel.teammates = clamp((p.rel.teammates ?? 50) + 0.5, 0, 60);
}

export const SPEECHES = [
  { id: 'fire', label: 'Fire them up', desc: 'Momentum starts on your side.', fx: (g) => { g.momentum = clamp((g.momentum ?? 0) + 0.15, -1, 1); } },
  { id: 'calm', label: 'Stay calm', desc: 'Everyone plays loose: slightly bigger timing windows.', fx: (g) => { g.tolMod = (g.tolMod ?? 1) * 1.04; } },
  { id: 'example', label: 'Lead by example', desc: 'You come out fresh: +12 energy.', fx: (g) => { g.energy = Math.min(100, (g.energy ?? 80) + 12); } },
];

/** Big games: the captain speaks before kickoff. */
export const speechDue = (state, g) => isCaptain(state) && !g.sitOut && !g.speech && !!(g.playoff || g.rivalry || g.primetime || g.isTitle);

export function giveSpeech(state, id) {
  const g = state.game;
  const s = SPEECHES.find((x) => x.id === id);
  if (!g || !s || g.speech) return null;
  g.speech = id;
  s.fx(g);
  return s;
}
