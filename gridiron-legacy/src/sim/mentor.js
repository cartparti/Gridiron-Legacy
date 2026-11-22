// Mentorship: veterans (28+, or 4+ pro seasons) take a young teammate under their wing. Weekly sessions build the bond
// and the rookie's game; at season's end you see how he grew. Mentees who make it become your "coaching tree" and
// count toward your legacy. Pure sim.
// player.mentee = { name, pos, ovr0, ovr, bond, sessions, since, lastWeek } ; player.mentees = [past mentees]
import { clamp } from '../core/util.js';
import { rand, pick, randInt } from '../core/rng.js';
import { genName } from './league.js';
import { addNews } from './press.js';
import { logJournal } from './journal.js';

export const canMentor = (state) => {
  const p = state.player, c = state.career;
  if (c?.stage !== 'pro') return false;
  const proSeasons = p.history.filter((h) => h.stage === 'pro').length;
  return (p.age ?? 0) >= 28 || proSeasons >= 4;
};

/** Three young players on your team to choose from (same position group first). */
export function menteeCandidates(state) {
  const p = state.player;
  const L = state.league;
  const roster = (L?.players ?? []).filter((x) => x.teamId === state.career.teamId && (x.age ?? 30) <= 24);
  const same = roster.filter((x) => x.pos === p.position || (p.position === 'DT' && x.pos === 'DL'));
  const list = [...same, ...roster.filter((x) => !same.includes(x))].slice(0, 3).map((x) => ({ name: x.name ?? `${x.first} ${x.last}`, pos: x.pos, ovr: Math.round(x.ovr), age: x.age }));
  while (list.length < 3) { const n = genName(state); list.push({ name: `${n.first} ${n.last}`, pos: p.position === 'MS' ? 'WR' : p.position, ovr: randInt(state, 58, 66), age: randInt(state, 21, 23) }); }
  return list;
}

export function pickMentee(state, cand) {
  const p = state.player;
  if (!canMentor(state) || p.mentee) return null;
  p.mentee = { name: cand.name, pos: cand.pos, ovr0: cand.ovr, ovr: cand.ovr, age: cand.age, bond: 20, sessions: 0, since: state.career.year, lastWeek: null };
  addNews(state, 'story', `${p.last} takes rookie ${cand.name} under his wing.`);
  return p.mentee;
}

const TOPICS = [
  { id: 'film', label: 'Film session', desc: 'Watch tape together: reads, leverage, tells.', ovr: 0.6, bond: 6, you: { iq: 0.15 } },
  { id: 'reps', label: 'Extra reps after practice', desc: 'Footwork and technique, rep after rep.', ovr: 0.8, bond: 5, energy: true },
  { id: 'life', label: 'Life talk', desc: 'Money, fame, staying out of trouble.', ovr: 0.25, bond: 10, mood: 2 },
];
export const MENTOR_TOPICS = TOPICS;

/** One session a week. */
export function mentorSession(state, topicId) {
  const p = state.player;
  const m = p.mentee;
  const T = TOPICS.find((x) => x.id === topicId) ?? TOPICS[0];
  const wk = `${state.career.year}-${state.league?.week}`;
  if (!m) return null;
  if (m.lastWeek === wk) return { ok: false, text: 'You already met this week.' };
  m.lastWeek = wk;
  m.sessions++;
  m.bond = clamp(m.bond + T.bond, 0, 100);
  const gain = T.ovr * (0.8 + m.bond / 200) * (0.8 + rand(state) * 0.4);
  m.ovr = Math.round(clamp(m.ovr + gain, 40, 95) * 10) / 10;
  if (T.you?.iq) p.stats.iq = clamp(p.stats.iq + T.you.iq, 0, 99);
  if (T.mood) p.mood = clamp(p.mood + T.mood, 0, 100);
  p.rel.coach = clamp((p.rel.coach ?? 50) + 0.8, 0, 100);
  p.rel.teammates = clamp((p.rel.teammates ?? 50) + 0.4, 0, 100);
  return { ok: true, text: `${T.label} with ${m.name}: +${gain.toFixed(1)} overall (now ${Math.round(m.ovr)}).` };
}

const LINES = ['{m} says you are the reason he made it.', '{m} thanked you in his postgame interview.', 'Coaches noticed: {m} plays like a vet now.'];

/** Season end: how the mentee grew. Big growth goes in the journal; a finished mentee joins your coaching tree. */
export function mentorSeasonEnd(state) {
  const p = state.player;
  const m = p.mentee;
  if (!m) return null;
  // natural growth on top of your sessions
  m.ovr = Math.round(clamp(m.ovr + 1 + m.bond / 40, 40, 95) * 10) / 10;
  m.age = (m.age ?? 22) + 1;
  const grew = Math.round(m.ovr - m.ovr0);
  const made = m.ovr >= 78;
  const report = { name: m.name, from: m.ovr0, to: Math.round(m.ovr), grew, made, line: pick(state, LINES).replace('{m}', m.name) };
  if (made || (state.career.year - m.since) >= 2) {
    p.mentees ??= [];
    p.mentees.push({ name: m.name, pos: m.pos, from: m.ovr0, to: Math.round(m.ovr), made, year: state.career.year });
    addNews(state, 'story', made ? `${m.name}, mentored by ${p.last}, becomes a star.` : `${m.name} graduates from ${p.last}'s mentorship.`);
    logJournal(state, 'record', made ? `Your mentee ${m.name} became a star (${m.ovr0} to ${Math.round(m.ovr)} overall).` : `Mentored ${m.name} for two seasons (${m.ovr0} to ${Math.round(m.ovr)}).`, { big: made });
    p.mentee = null;
    report.done = true;
  }
  return report;
}

export const mentorLegacy = (p) => (p.mentees ?? []).reduce((a, m) => a + (m.made ? 6 : 2), 0);
