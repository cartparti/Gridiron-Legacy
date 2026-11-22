// Trade requests (pros): unhappy where you are? Ask out. Your agent finds teams that want you, you pick one, and the
// front office decides before the deadline. It costs you with the coach and the locker room either way. Pure sim.
// state.tradeReq = { year, status: 'open' | 'accepted' | 'denied' | 'cancelled', teams: [{ id, city, name, colors, why }], to }
import { clamp } from '../core/util.js';
import { rand } from '../core/rng.js';
import { getTeam } from './league.js';
import { addNews } from './press.js';
import { teamNeed } from './flow.js';

export const TRADE_DEADLINE = 9; // regular-season week (0-based) after which no more trades

export function canRequestTrade(state) {
  const c = state.career;
  const L = state.league;
  if (c?.stage !== 'pro' || L?.phase !== 'regular' || (L.week ?? 0) >= TRADE_DEADLINE) return false;
  if (c.pendingMove) return false;
  const r = state.tradeReq;
  return !(r && r.year === c.year && r.status !== 'cancelled');
}

/** Ask for a trade: your agent comes back with up to three teams that want you. */
export function requestTrade(state) {
  if (!canRequestTrade(state)) return null;
  const p = state.player;
  const c = state.career;
  const L = state.league;
  const me = getTeam(L, c.teamId);
  const pos = p.position === 'K' ? 'K' : p.position;
  const cands = L.teams.filter((t) => t.id !== c.teamId).map((t) => {
    const need = pos === 'MS' ? 10 : teamNeed(L, t.id, pos);
    const contender = (t.w ?? 0) - (t.l ?? 0);
    return { t, score: need + contender * 1.5 + rand(state) * 8, need, contender };
  }).sort((a, b) => b.score - a.score).slice(0, 3);
  state.tradeReq = {
    year: c.year, status: 'open', from: me?.id,
    teams: cands.map(({ t, need, contender }) => ({ id: t.id, city: t.city, name: t.name, colors: t.colors, record: `${t.w ?? 0}-${t.l ?? 0}`,
      why: need >= 15 ? `They need a ${pos} badly` : contender >= 2 ? 'A contender looking for the last piece' : 'They like your fit in their scheme' })),
  };
  p.rel.coach = clamp(p.rel.coach - 12, 0, 100);
  p.rel.teammates = clamp(p.rel.teammates - 6, 0, 100);
  addNews(state, 'story', `Report: ${p.first} ${p.last} has asked the ${me?.name ?? 'team'} for a trade.`);
  return state.tradeReq;
}

/** Pick where you want to go. The front office says yes (you move next week) or no. */
export function chooseTrade(state, teamId) {
  const r = state.tradeReq;
  const p = state.player;
  if (!r || r.status !== 'open' || !r.teams.some((t) => t.id === teamId)) return null;
  const odds = clamp(0.55 + ((p.ovr ?? 70) - 72) / 60 + (p.fame ?? 0) / 400 - (p.contract?.rookie ? 0.15 : 0), 0.25, 0.9);
  const dest = r.teams.find((t) => t.id === teamId);
  if (rand(state) < odds) {
    r.status = 'accepted';
    r.to = teamId;
    state.career.pendingMove = teamId; // applied at the start of next week (between games)
    if (p.contract) p.contract.teamId = teamId;
    return { ok: true, text: `Done deal. You're headed to the ${dest.city} ${dest.name} next week.` };
  }
  r.status = 'denied';
  p.mood = clamp(p.mood - 6, 0, 100);
  p.rel.coach = clamp(p.rel.coach - 3, 0, 100);
  addNews(state, 'story', `The ${getTeam(state.league, state.career.teamId)?.name ?? 'team'} turn down ${p.last}'s trade request.`);
  return { ok: false, text: 'The front office said no. You\'re staying, and everyone knows you wanted out.' };
}

/** Take it back (some of the damage heals). */
export function cancelTrade(state) {
  const r = state.tradeReq;
  if (!r || r.status !== 'open') return false;
  r.status = 'cancelled';
  const p = state.player;
  p.rel.coach = clamp(p.rel.coach + 6, 0, 100);
  p.rel.teammates = clamp(p.rel.teammates + 3, 0, 100);
  return true;
}
