// Farewell tour: a veteran can announce that this season is his last. Every road stadium sends him off with a gift
// and a standing ovation, the locker room plays for him, and when the season ends he retires on his own terms.
// state.farewell = { year, gifts: [{ team, gift }], ovations } . Pure sim.
import { clamp } from '../core/util.js';
import { pick } from '../core/rng.js';
import { getTeam } from './league.js';
import { addNews } from './press.js';
import { logJournal } from './journal.js';

const GIFTS = {
  coast: ['a custom surfboard', 'a framed map of the coastline', 'a hand-carved ship in a bottle'],
  desert: ['a cowboy hat and boots', 'a painted cactus pot', 'a turquoise belt buckle'],
  mountains: ['a hand-built rocking chair', 'a pair of skis', 'a framed mountain photo signed by the team'],
  city: ['a key to the city', 'a skyline painting', 'a custom watch'],
  farm: ['a restored tractor', 'a hand-stitched quilt in team colors', 'a year of fresh pie from a local diner'],
  bayou: ['a lifetime supply of hot sauce', 'a brass band send-off', 'a hand-carved cypress cane'],
  any: ['a framed game jersey', 'a golf cart in team colors', 'a signed game ball from the whole team', 'a portrait painted by a fan'],
};

export const isFarewellSeason = (state) => state.farewell?.year === state.career?.year;

export function canAnnounceFarewell(state) {
  const c = state.career, p = state.player;
  if (c?.stage !== 'pro' || state.farewell || state.league?.phase !== 'regular' || (state.league?.week ?? 0) > 3) return false;
  const proSeasons = p.history.filter((h) => h.stage === 'pro').length;
  return (p.age ?? 0) >= 30 || proSeasons >= 8;
}

export function announceFarewell(state) {
  if (!canAnnounceFarewell(state)) return null;
  const p = state.player;
  state.farewell = { year: state.career.year, gifts: [], ovations: 0 };
  p.fame = clamp((p.fame ?? 0) + 3, 0, 100);
  p.rel.teammates = clamp((p.rel.teammates ?? 50) + 5, 0, 100);
  addNews(state, 'story', `${p.first} ${p.last} announces this will be his final season.`);
  logJournal(state, 'retire', 'Announced this season would be your last. The farewell tour begins.', { big: true });
  return state.farewell;
}

/** After each game of the farewell season: road teams send you off with a gift and an ovation. */
export function farewellAfterGame(state, g, culture) {
  if (!isFarewellSeason(state) || !g || g.sitOut) return null;
  const F = state.farewell;
  if (g.userSide === 'away') {
    const opp = getTeam(state.league, g.oppId);
    const pool = [...(GIFTS[culture?.biome] ?? []), ...GIFTS.any];
    const gift = pick(state, pool);
    F.gifts.push({ team: `${opp.city} ${opp.name}`, gift });
    F.ovations++;
    state.player.fame = clamp((state.player.fame ?? 0) + 0.5, 0, 100);
    addNews(state, 'story', `The ${opp.name} honor ${state.player.last} before kickoff with ${gift}. The road crowd gives him a standing ovation.`);
    return { gift, team: `${opp.city} ${opp.name}` };
  }
  return null;
}
