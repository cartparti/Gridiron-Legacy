// Pets: adopt a dog or a cat, name it, play with it once a week. A pet lifts your mood every week, costs a little to
// look after, and now and then does something that ends up on the internet. Pure sim.
import { clamp } from '../core/util.js';
import { rand, pick } from '../core/rng.js';
import { addNews } from './press.js';
import { logJournal } from './journal.js';

export const PET_KINDS = [
  { id: 'golden', label: 'Golden Retriever', kind: 'dog', emoji: '🐕', fee: 400, desc: 'Loves everyone. Will steal your socks.' },
  { id: 'bulldog', label: 'Bulldog', kind: 'dog', emoji: '🐶', fee: 600, desc: 'Snores like a lineman. Tough as nails.' },
  { id: 'husky', label: 'Husky', kind: 'dog', emoji: '🐺', fee: 500, desc: 'Loud, dramatic and fast. Needs runs.' },
  { id: 'mutt', label: 'Shelter mix', kind: 'dog', emoji: '🐕‍🦺', fee: 75, desc: 'Nobody knows what breed. Best dog ever.' },
  { id: 'corgi', label: 'Corgi', kind: 'dog', emoji: '🦮', fee: 700, desc: 'Short legs, huge personality.' },
  { id: 'cat', label: 'Tabby cat', kind: 'cat', emoji: '🐈', fee: 60, desc: 'Ignores you until you are sad. Then never leaves.' },
  { id: 'blackcat', label: 'Black cat', kind: 'cat', emoji: '🐈‍⬛', fee: 40, desc: 'Lucky or unlucky. You decide.' },
];
export const PET_NAMES = ['Blitz', 'Touchdown', 'Biscuit', 'Moose', 'Nugget', 'Rookie', 'Pepper', 'Tank', 'Waffles', 'Duke', 'Luna', 'Gravy', 'Hail Mary', 'Pickles'];
const WEEKLY = { hs: 10, college: 25, pro: 150 };

export const petOf = (state) => state.player?.pet ?? null;

export function adoptPet(state, kindId, name) {
  const p = state.player;
  const k = PET_KINDS.find((x) => x.id === kindId);
  if (!k || p.pet) return null;
  if (p.money < k.fee) return { ok: false, text: `You need ${k.fee} dollars for the adoption fee.` };
  const clean = String(name ?? '').replace(/[^\p{L}\p{N} '.-]/gu, '').trim().slice(0, 16) || pick(state, PET_NAMES);
  p.money -= k.fee;
  p.pet = { kind: k.id, name: clean, year: state.career.year, bond: 30, playedWeek: null, tricks: 0 };
  p.mood = clamp(p.mood + 8, 0, 100);
  logJournal(state, 'game', `Adopted ${clean} the ${k.label.toLowerCase()}.`);
  return { ok: true, text: `Welcome home, ${clean}!` };
}

const weekKey = (state) => `${state.career.year}-${state.career.stage}-${state.league?.week ?? 0}`;
export const canPlayWithPet = (state) => !!state.player?.pet && state.player.pet.playedWeek !== weekKey(state);

/** Free, once a week. */
export function playWithPet(state) {
  const p = state.player, pet = p.pet;
  if (!canPlayWithPet(state)) return null;
  pet.playedWeek = weekKey(state);
  pet.bond = clamp(pet.bond + 6, 0, 100);
  p.mood = clamp(p.mood + 3, 0, 100);
  p.health = clamp(p.health + 1, 0, 100);
  let text = `${pet.name} is thrilled. You are too.`;
  if (pet.bond >= 60 && pet.tricks < 3 && rand(state) < 0.35) { pet.tricks++; text = `${pet.name} learned a new trick: ${['high five', 'play dead when you say "flag"', 'fetch your helmet'][pet.tricks - 1]}!`; }
  return { text };
}

/** beginWeek: mood lift, upkeep, the odd adventure. */
export function petWeekly(state) {
  const p = state.player, pet = p.pet;
  if (!pet) return null;
  p.money -= WEEKLY[state.career.stage] ?? 25;
  p.mood = clamp(p.mood + 1 + pet.bond / 100, 0, 100);
  pet.bond = clamp(pet.bond - 1, 0, 100);
  const r = rand(state);
  if (r < 0.05) {
    p.fame = clamp(p.fame + 1, 0, 100);
    addNews(state, 'story', `Video of ${p.last}'s ${PET_KINDS.find((k) => k.id === pet.kind)?.kind ?? 'pet'} ${pet.name} goes viral.`);
    return `${pet.name} went viral! A fan filmed ${pet.name} wearing your helmet. +1 fame.`;
  }
  if (r < 0.09) { p.money -= state.career.stage === 'pro' ? 900 : 60; return `${pet.name} chewed up your favorite cleats. New pair ordered.`; }
  return null;
}
