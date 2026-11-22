// Career Journal: an automatic timeline of everything that mattered, from your first snap to the Hall of Fame.
// state.journal = [{ year, stage, week, kind, icon, text, big }] (oldest first). Pure sim.
import { ACH_BY_ID } from './achievements.js';

const MAX = 400;
const ICON = { debut: 'ball', td: 'trophy', game: 'star', award: 'medal', title: 'crown', record: 'scroll', draft: 'briefcase', commit: 'handshake', move: 'users',
  captain: 'shield', injury: 'bandage', ach: 'target', retire: 'flame', contract: 'dollar', zone: 'bolt', declare: 'bolt' };

export function logJournal(state, kind, text, { big = false } = {}) {
  state.journal ??= [];
  const c = state.career ?? {};
  state.journal.push({ year: c.year, stage: c.stage, week: (state.league?.week ?? 0) + 1, kind, icon: ICON[kind] ?? 'star', text, big });
  if (state.journal.length > MAX) state.journal.splice(0, state.journal.length - MAX);
}

const STAGE_WORD = { hs: 'high school', college: 'college', pro: 'pro' };

/** After every game: debuts, first touchdowns, monster games, big injuries, achievements. */
export function journalAfterGame(state, lg, { stageGames, stageTDs, careerTDsBefore, oppName }) {
  if (!lg) return;
  const p = state.player;
  const s = lg.userStats ?? {};
  const tds = (s.passTD ?? 0) + (s.rushTD ?? 0) + (s.recTD ?? 0) + (s.defTD ?? 0);
  if (!lg.sitOut && stageGames === 1) logJournal(state, 'debut', `${STAGE_WORD[state.career.stage] === 'pro' ? 'Pro' : STAGE_WORD[state.career.stage][0].toUpperCase() + STAGE_WORD[state.career.stage].slice(1)} debut against ${oppName}: ${lg.won ? 'a win' : 'a loss'}, grade ${lg.letter}.`, { big: true });
  if (tds > 0 && careerTDsBefore === 0) logJournal(state, 'td', `First career touchdown, against ${oppName}.`, { big: true });
  else if (tds > 0 && stageTDs === tds && state.career.stage !== 'hs') logJournal(state, 'td', `First ${STAGE_WORD[state.career.stage]} touchdown, against ${oppName}.`);
  if (!lg.sitOut && (lg.grade ?? 0) >= 92) logJournal(state, 'game', `A+ game vs ${oppName} (${lg.grade}/100)${lg.won ? '' : ' in a loss'}.`);
  if (lg.isTitle && lg.won) logJournal(state, 'title', `Won the ${lg.roundName ?? 'title game'}!`, { big: true });
  if (lg.injury && ['out', 'season'].includes(lg.injury.tier)) logJournal(state, 'injury', `Injured vs ${oppName}: ${lg.injury.label}, out ${lg.injury.weeks} weeks.`);
  for (const id of lg.newAch ?? []) { const a = ACH_BY_ID[id]; if (a && a.tier >= 2) logJournal(state, 'ach', `Achievement: ${a.name}.`); }
}

/** Season end: record, awards, titles, records. */
export function journalSeason(state, review, { teamName, titleName, awardLabel }) {
  if (!review) return;
  const lbl = awardLabel ?? ((n) => n);
  if (review.champion && !(state.journal ?? []).some((e) => e.kind === 'title' && e.year === review.year)) logJournal(state, 'title', `${titleName} champions with the ${teamName} (${review.record}).`, { big: true });
  for (const a of review.awards ?? []) if (!/Champion$/.test(a)) logJournal(state, 'award', `${lbl(a)}.`, { big: /Most Valuable|Player of the Year|Heisman|Ironstone|Rookie of the Year/.test(a) });
  for (const r of review.records ?? []) logJournal(state, 'record', `New record: ${r.label ?? r}.`, { big: true });
}

/** Journal for the Career > Journal page: newest year first, entries grouped by year. */
export function journalByYear(state) {
  backfillJournal(state);
  const by = new Map();
  for (const e of state.journal ?? []) { if (!by.has(e.year)) by.set(e.year, []); by.get(e.year).push(e); }
  return [...by.entries()].sort((a, b) => b[0] - a[0]).map(([year, list]) => ({ year, stage: list[0].stage, list: list.slice().reverse() }));
}

/** Older saves: rebuild a short journal from the season history (once). */
export function backfillJournal(state) {
  if (state.journal?.length || !state.player?.history?.length) return;
  const p = state.player;
  state.journal = [];
  const STAGE_TITLE = { hs: 'State Championship', college: 'Heritage Bowl', pro: 'Legacy Bowl' };
  for (const hst of p.history) {
    const add = (kind, text, big = false) => state.journal.push({ year: hst.year, stage: hst.stage, week: 1, kind, icon: ICON[kind] ?? 'star', text, big });
    add('game', `Season with ${hst.teamId}: ${hst.record}${hst.champion ? ', champions' : ''}.`);
    if (hst.champion) add('title', `${STAGE_TITLE[hst.stage] ?? 'Title'} champions (${hst.record}).`, true);
    for (const a of hst.awards ?? []) if (!/Champion$/.test(a)) add('award', `${a}.`, /Most Valuable|Player of the Year/.test(a));
  }
  if (p.draft && !p.draft.undrafted) state.journal.push({ year: p.draft.year, stage: 'pro', week: 1, kind: 'draft', icon: ICON.draft, text: `Drafted ${p.draft.pick}${p.draft.pick === 1 ? 'st' : p.draft.pick === 2 ? 'nd' : p.draft.pick === 3 ? 'rd' : 'th'} overall.`, big: true });
  state.journal.sort((a, b) => a.year - b.year);
}
