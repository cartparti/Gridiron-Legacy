// Your charity foundation: put your money to work for your hometown. Donations raise its level, unlock programs and
// community events; the work builds fame, mood and legacy, and can win Humanitarian of the Year. Pure sim.
// state.foundation = { name, cause, donated, level, events, kids, programs: [], humanitarian: [years], eventWeek }
import { clamp } from '../core/util.js';
import { rand } from '../core/rng.js';
import { addNews } from './press.js';
import { logJournal } from './journal.js';

export const CAUSES = [
  { id: 'youth', label: 'Youth football', desc: 'Free camps, equipment and coaching for kids.' },
  { id: 'education', label: 'Education', desc: 'Scholarships, tutoring and school supplies.' },
  { id: 'health', label: 'Children\'s health', desc: 'Hospital visits, research and family support.' },
  { id: 'hunger', label: 'Fighting hunger', desc: 'Meal programs and food banks.' },
];
export const LEVELS = [0, 25000, 100000, 500000, 2000000, 8000000];
export const PROGRAMS = [
  { level: 1, id: 'camp', label: 'Free summer camp', desc: '+0.2 fame a week' },
  { level: 2, id: 'scholar', label: 'Scholarship fund', desc: '+1 mood a week, legacy points' },
  { level: 3, id: 'field', label: 'Hometown field renovation', desc: 'Your old school field gets rebuilt. +family' },
  { level: 4, id: 'center', label: 'Community center', desc: '+0.4 fame a week, big legacy points' },
  { level: 5, id: 'national', label: 'National chapters', desc: 'The foundation goes nationwide' },
];
export const levelOf = (donated) => LEVELS.reduce((lv, min, i) => (donated >= min ? i : lv), 0);
export const canFound = (state) => ['college', 'pro'].includes(state.career?.stage) && !state.foundation;

export function startFoundation(state, causeId) {
  if (!canFound(state)) return null;
  const p = state.player;
  const cause = CAUSES.find((c) => c.id === causeId) ?? CAUSES[0];
  state.foundation = { name: `The ${p.last} Foundation`, cause: cause.id, donated: 0, level: 0, events: 0, kids: 0, humanitarian: [], since: state.career.year };
  addNews(state, 'story', `${p.first} ${p.last} launches ${state.foundation.name} (${cause.label.toLowerCase()}).`);
  logJournal(state, 'record', `Started ${state.foundation.name} for ${cause.label.toLowerCase()}.`, { big: true });
  return state.foundation;
}

/** Give money. Returns { ok, text, levelUp }. */
export function donate(state, amount) {
  const F = state.foundation, p = state.player;
  if (!F || amount <= 0) return { ok: false, text: 'Start your foundation first.' };
  if (p.money < amount) return { ok: false, text: 'Not enough money in the bank.' };
  p.money -= amount;
  const before = F.level;
  F.donated += amount;
  F.level = levelOf(F.donated);
  F.kids += Math.round(amount / 400);
  p.fame = clamp((p.fame ?? 0) + Math.min(3, amount / 200000), 0, 100);
  p.mood = clamp(p.mood + Math.min(4, 1 + amount / 250000), 0, 100);
  const levelUp = F.level > before;
  if (levelUp) {
    const prog = PROGRAMS.find((x) => x.level === F.level);
    addNews(state, 'story', `${F.name} reaches level ${F.level}${prog ? `: ${prog.label.toLowerCase()} opens` : ''}.`);
    logJournal(state, 'record', `${F.name} reached level ${F.level}${prog ? ` (${prog.label})` : ''}.`);
  }
  return { ok: true, levelUp, text: levelUp ? `Level ${F.level}! ${PROGRAMS.find((x) => x.level === F.level)?.label ?? ''} unlocked.` : `Donated $${amount.toLocaleString('en-US')}.` };
}

/** Host a community event (uses a free day this week). */
export function hostEvent(state) {
  const F = state.foundation, p = state.player;
  if (!F) return { ok: false, text: 'Start your foundation first.' };
  if (F.eventWeek === `${state.career.year}-${state.league?.week}`) return { ok: false, text: 'You already hosted an event this week.' };
  const i = state.week?.plan?.findIndex((x) => !x) ?? -1;
  if (i < 0) return { ok: false, text: 'No free day this week.' };
  state.week.plan[i] = { done: true, label: `${F.name} event`, icon: 'heart', cost: 1 };
  F.eventWeek = `${state.career.year}-${state.league?.week}`;
  F.events++;
  F.kids += 40 + F.level * 60;
  p.fame = clamp((p.fame ?? 0) + 1 + F.level * 0.3, 0, 100);
  p.mood = clamp(p.mood + 4, 0, 100);
  p.rel.family = clamp((p.rel.family ?? 50) + 1, 0, 100);
  const what = { youth: 'ran a free youth camp', education: 'handed out scholarships at a school assembly', health: 'spent the day at the children\'s hospital', hunger: 'served meals at the food bank' }[F.cause];
  addNews(state, 'story', `${p.first} ${p.last} ${what}.`);
  return { ok: true, text: `You ${what}. The kids will remember it forever.` };
}

/** Weekly: active programs pay back in fame and mood. */
export function foundationWeekly(state) {
  const F = state.foundation, p = state.player;
  if (!F) return;
  if (F.level >= 1) p.fame = clamp((p.fame ?? 0) + 0.2 + (F.level >= 4 ? 0.4 : 0), 0, 100);
  if (F.level >= 2) p.mood = clamp(p.mood + 1, 0, 100);
  if (F.level >= 3) p.rel.family = clamp((p.rel.family ?? 50) + 0.3, 0, 100);
}

/** Season end: Humanitarian of the Year? Returns true when you win. */
export function humanitarianVote(state) {
  const F = state.foundation;
  if (!F || state.career.stage !== 'pro') return false;
  const score = F.level * 0.12 + Math.min(F.events, 10) * 0.04;
  if (rand(state) < clamp(score - 0.15, 0, 0.7)) {
    F.humanitarian.push(state.career.year);
    addNews(state, 'award', `${state.player.first} ${state.player.last} named Humanitarian of the Year.`);
    logJournal(state, 'award', 'Humanitarian of the Year.', { big: true });
    state.player.fame = clamp((state.player.fame ?? 0) + 4, 0, 100);
    return true;
  }
  return false;
}

/** Legacy points from the foundation (shown on the legacy screen). */
export const foundationLegacy = (state) => {
  const F = state.foundation;
  if (!F) return 0;
  return F.level * 3 + (F.level >= 2 ? 3 : 0) + (F.level >= 4 ? 6 : 0) + F.humanitarian.length * 5;
};
