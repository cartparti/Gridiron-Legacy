// Ring of Honor: when you leave a team as a legend, they retire your number (and it hangs in their stadium).
// Titles you won there hang as championship banners. Pure sim.
// state.ringOfHonor = [{ teamId, name, city, colors, number, year, stage, line }]
import { addNews } from './press.js';
import { logJournal } from './journal.js';

const NEED = { hs: 5, college: 7, pro: 15 };
const BIG = /Most Valuable|Player of the Year|Ironstone|Defensive Player|Special Teams Player/;

/** How much you meant to a team: seasons, awards, titles, MVP-level awards. */
export function teamLegacy(state, teamId, stage) {
  const p = state.player;
  const seasons = p.history.filter((h) => h.teamId === teamId && h.stage === stage);
  const awards = seasons.flatMap((h) => (h.awards ?? []).filter((a) => !/Champion$/.test(a)));
  const titles = seasons.filter((h) => h.champion).length;
  const big = awards.filter((a) => BIG.test(a)).length;
  const score = seasons.length * 1 + awards.length * 1.5 + titles * 4 + big * 3;
  return { seasons: seasons.length, awards: awards.length, titles, big, score };
}

/** Leaving a team (or retiring): retire the number if you were a legend there. Returns the honor or null. */
export function honorCheck(state, team, stage) {
  if (!team || !state.player) return null;
  state.ringOfHonor ??= [];
  if (state.ringOfHonor.some((r) => r.teamId === team.id && r.stage === stage)) return null;
  const L = teamLegacy(state, team.id, stage);
  if (L.score < (NEED[stage] ?? 12)) return null;
  const p = state.player;
  const line = [L.titles ? `${L.titles} title${L.titles > 1 ? 's' : ''}` : null, L.awards ? `${L.awards} award${L.awards > 1 ? 's' : ''}` : null, `${L.seasons} season${L.seasons > 1 ? 's' : ''}`].filter(Boolean).join(', ');
  const honor = { teamId: team.id, name: team.name, city: team.city, colors: team.colors, number: p.position === 'MS' ? '★' : p.number, year: state.career.year, stage, line, last: p.last };
  state.ringOfHonor.push(honor);
  addNews(state, 'story', `The ${team.city} ${team.name} will retire ${p.first} ${p.last}'s #${honor.number}.`);
  logJournal(state, 'record', `The ${team.city} ${team.name} retired your #${honor.number} (${line}).`, { big: true });
  return honor;
}

/** What hangs in this team's stadium for you: your retired number, and the titles you won there. */
export function bannersFor(state, teamId) {
  if (!state?.player) return [];
  const out = [];
  for (const r of state.ringOfHonor ?? []) if (r.teamId === teamId) out.push({ kind: 'number', number: r.number, name: r.last, year: r.year });
  for (const h of state.player.history) if (h.teamId === teamId && h.champion) out.push({ kind: 'title', year: h.year });
  return out.slice(0, 6);
}
