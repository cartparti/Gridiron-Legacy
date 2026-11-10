// Player traits: progress toward unlocks, unlocking, equipping. Pure sim.
import { TRAITS, TRAIT_BY_ID, slotsForLevel } from '../data/traits.js';
import { addNews } from './press.js';

function bag(p) {
  p.traits ??= { unlocked: [], equipped: [] };
  return p.traits;
}

/** Progress 0..1 and current/target numbers for a trait. */
export function traitProgress(state, t) {
  const p = state.player;
  let cur = 0;
  if (t.goal.stat) cur = p.careerStats?.[t.goal.stat] ?? 0;
  else if (t.goal.level) cur = p.level ?? 1;
  else if (t.goal.rel) cur = p.rel?.[t.goal.rel] ?? 0;
  const n = t.goal.n ?? t.goal.level;
  return { cur: Math.round(cur), n, pct: Math.min(1, cur / n) };
}

/** Traits available to your position (plus universal ones), with status. */
export function traitList(state) {
  const p = state.player;
  const b = bag(p);
  return TRAITS.filter((t) => t.pos === p.position || t.pos === 'ANY').map((t) => ({ ...t, unlocked: b.unlocked.includes(t.id), equipped: b.equipped.includes(t.id), progress: traitProgress(state, t) }));
}

/** Check goals; unlock new traits. Returns newly unlocked traits. */
export function checkTraitUnlocks(state) {
  const p = state.player;
  const b = bag(p);
  const fresh = [];
  for (const t of TRAITS) {
    if (t.pos !== p.position && t.pos !== 'ANY') continue;
    if (b.unlocked.includes(t.id)) continue;
    if (traitProgress(state, t).pct >= 1) {
      b.unlocked.push(t.id);
      fresh.push(t);
      addNews(state, 'story', `${p.first} ${p.last} unlocks a new trait: ${t.name}.`);
      if (b.equipped.length < slotsForLevel(p.level ?? 1)) b.equipped.push(t.id); // auto-equip into a free slot
    }
  }
  return fresh;
}

export function equipSlots(state) {
  return slotsForLevel(state.player.level ?? 1);
}

/** Toggle a trait on/off. Returns { ok, why }. */
export function toggleTrait(state, id) {
  const b = bag(state.player);
  if (!b.unlocked.includes(id)) return { ok: false, why: 'Locked' };
  if (b.equipped.includes(id)) { b.equipped = b.equipped.filter((x) => x !== id); return { ok: true }; }
  if (b.equipped.length >= equipSlots(state)) return { ok: false, why: 'All slots full' };
  b.equipped.push(id);
  return { ok: true };
}

/** Equipped trait ids (for the play engine). */
export const equippedTraits = (state) => bag(state.player).equipped.filter((id) => TRAIT_BY_ID[id]);
