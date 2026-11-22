// Family life: once you're married (proposals happen through story events or asking your partner), plan the
// wedding, start a family, and watch your kids grow up. Kids lift your mood, show up in the journal and, when you
// retire, your son can carry on the name in a new career (players are always boys; daughters stay family). Pure sim.
// player.family = { wedding: { year, kind } | null, kids: [{ name, sex, born }], expecting: { weeks } | null, tried }
import { clamp } from '../core/util.js';
import { rand, pick } from '../core/rng.js';
import { addNews } from './press.js';
import { logJournal } from './journal.js';
import { FIRST_NAMES } from '../data/names.js';

const GIRL_NAMES = ['Maya', 'Ava', 'Zoe', 'Lila', 'Nora', 'Isla', 'Ruby', 'June', 'Hazel', 'Aria', 'Elena', 'Skye'];
export const WEDDINGS = [
  { id: 'courthouse', label: 'Courthouse', cost: 2000, desc: 'Just the two of you and a judge. Sweet and simple.', mood: 8, partner: 8, fame: 0 },
  { id: 'backyard', label: 'Backyard party', cost: 25000, desc: 'Family, friends, string lights and a DJ.', mood: 14, partner: 14, fame: 1, family: 6 },
  { id: 'destination', label: 'Destination wedding', cost: 250000, desc: 'A beach far away. Everyone you love flies in.', mood: 18, partner: 18, fame: 3, family: 4 },
  { id: 'gala', label: 'Grand gala', cost: 1500000, desc: 'Magazine cover, celebrity guests, fireworks.', mood: 16, partner: 12, fame: 8 },
];

const fam = (p) => (p.family ??= { wedding: null, kids: [], expecting: null, tried: null });
export const isMarried = (p) => !!p.flags?.married && !!p.partnerName;
export const kidAge = (state, k) => Math.max(0, (state.career?.year ?? k.born) - k.born);

/** Plan the wedding (once married). */
export function planWedding(state, id) {
  const p = state.player;
  const F = fam(p);
  const w = WEDDINGS.find((x) => x.id === id);
  if (!isMarried(p) || F.wedding || !w) return null;
  if (p.money < w.cost) return { ok: false, text: 'Not enough money for that one.' };
  p.money -= w.cost;
  F.wedding = { year: state.career.year, kind: w.id };
  p.mood = clamp(p.mood + w.mood, 0, 100);
  if (p.rel.partner != null) p.rel.partner = clamp(p.rel.partner + w.partner, 0, 100);
  p.fame = clamp((p.fame ?? 0) + w.fame, 0, 100);
  if (w.family) p.rel.family = clamp((p.rel.family ?? 50) + w.family, 0, 100);
  addNews(state, 'story', `${p.first} ${p.last} marries ${p.partnerName}${w.id === 'gala' ? ' in a star-studded gala' : w.id === 'destination' ? ' on a faraway beach' : ''}.`);
  logJournal(state, 'record', `Married ${p.partnerName} (${w.label.toLowerCase()}).`, { big: true });
  return { ok: true, text: `You married ${p.partnerName}! ${w.desc}` };
}

/** Talk about starting a family (once a season). */
export function tryForBaby(state) {
  const p = state.player;
  const F = fam(p);
  if (!isMarried(p) || F.expecting || F.kids.length >= 4 || F.tried === state.career.year) return null;
  F.tried = state.career.year;
  if (rand(state) < 0.7) { F.expecting = { weeks: 8 + Math.floor(rand(state) * 6) }; return { ok: true, text: `${p.partnerName} is pregnant! The baby is due in about ${F.expecting.weeks} weeks.` }; }
  return { ok: false, text: 'Not yet. Maybe next season.' };
}

function bear(state) {
  const p = state.player;
  const F = fam(p);
  const sex = rand(state) < 0.5 ? 'm' : 'f';
  const used = new Set(F.kids.map((k) => k.name));
  const pool = (sex === 'm' ? FIRST_NAMES : GIRL_NAMES).filter((n) => !used.has(n) && n !== p.first);
  const kid = { name: pick(state, pool.length ? pool : sex === 'm' ? FIRST_NAMES : GIRL_NAMES), sex, born: state.career.year };
  F.kids.push(kid);
  F.expecting = null;
  p.flags.has_kid = true;
  p.mood = clamp(p.mood + 15, 0, 100);
  p.rel.family = clamp((p.rel.family ?? 50) + 8, 0, 100);
  addNews(state, 'story', `${p.first} ${p.last} welcomes a ${sex === 'm' ? 'son' : 'daughter'}, ${kid.name}.`);
  logJournal(state, 'record', `Welcomed a ${sex === 'm' ? 'son' : 'daughter'}, ${kid.name}.`, { big: true });
  return kid;
}

const MOMENTS = [
  '{kid} drew a picture of you scoring a touchdown. It is on the fridge now.',
  '{kid} wore your jersey to school and told everyone you are the best player ever.',
  '{kid} learned to throw a spiral today!',
  '{kid} asked if they can come to your next game. The answer is yes.',
  '{kid} lost a tooth and put it under the pillow with a football card of you.',
  '{kid} started a new school and already has a lot of friends.',
];

/** Weekly: births, family moments, and a little mood from home. Returns a note or null. */
export function familyWeekly(state) {
  const p = state.player;
  if (!p) return null;
  const F = fam(p);
  // a baby from the older story event (has_kid) shows up in the family too
  if (p.flags?.has_kid && !F.kids.length && !F.expecting) bear(state);
  if (F.expecting) { F.expecting.weeks--; if (F.expecting.weeks <= 0) { const k = bear(state); return `${k.name} was born this week!`; } }
  if (isMarried(p)) p.mood = clamp(p.mood + 0.5 + Math.min(2, F.kids.length) * 0.4, 0, 100);
  if (F.kids.length && rand(state) < 0.15) {
    const k = pick(state, F.kids);
    return MOMENTS[Math.floor(rand(state) * MOMENTS.length)].replace('{kid}', kidAge(state, k) < 3 ? `Little ${k.name}` : k.name);
  }
  return null;
}

/** The next generation: your oldest son if you have one. */
export const heirName = (p) => (p.family?.kids ?? []).filter((k) => k.sex === 'm').sort((a, b) => a.born - b.born)[0]?.name ?? null;
