// Buying items, gear bonuses, and weekly effects of owned things.
import { ITEMS, ITEM_BY_ID } from '../data/items.js';
import { clamp } from '../core/util.js';
import { addNews } from './press.js';

const STAGE_ORDER = { hs: 0, college: 1, pro: 2, retired: 3 };

export function owned(p, id) {
  return !!p.items?.[id];
}

export function canBuy(state, item) {
  const p = state.player;
  if (item.minStage && STAGE_ORDER[state.career.stage] < STAGE_ORDER[item.minStage]) return { ok: false, why: `Unlocks in ${item.minStage === 'pro' ? 'the pros' : 'college'}` };
  if (item.minFame && p.fame < item.minFame) return { ok: false, why: `Needs fame ${item.minFame}` };
  if (!item.gift && owned(p, item.id)) return { ok: false, why: 'Owned' };
  if (p.money < item.price) return { ok: false, why: 'Not enough money' };
  return { ok: true };
}

/** Buy an item. Returns { ok, why }. */
export function buyItem(state, id) {
  const p = state.player;
  const item = ITEM_BY_ID[id];
  if (!item) return { ok: false, why: 'Unknown item' };
  const c = canBuy(state, item);
  if (!c.ok) return c;
  p.money -= item.price;
  p.items = p.items ?? {};
  p.inventory = p.inventory ?? {};
  if (item.gift) p.inventory[id] = (p.inventory[id] ?? 0) + 1;
  else p.items[id] = true;
  if (item.fame) p.fame = clamp(p.fame + item.fame, 0, 100);
  if (item.flag) p.flags[item.flag] = true;
  if (item.price >= 100000) addNews(state, 'money', `${p.first} ${p.last} splashes out on a ${item.name.toLowerCase()}.`);
  return { ok: true };
}

/** Timing-window bonus from gear for this moment type (best item per slot). */
export function gearBonus(p, type) {
  const best = {};
  for (const id of Object.keys(p.items ?? {})) {
    const g = ITEM_BY_ID[id]?.gear;
    if (!g) continue;
    if (g.types && type && !g.types.includes(type)) continue;
    best[g.slot] = Math.max(best[g.slot] ?? 0, g.tol);
  }
  return Object.values(best).reduce((a, b) => a + b, 0);
}

/** Weekly totals from owned items: { mood, energy, cost }. */
export function itemWeekly(p) {
  let mood = 0;
  let energy = 0;
  let cost = 0;
  for (const id of Object.keys(p.items ?? {})) {
    const it = ITEM_BY_ID[id];
    if (!it) continue;
    mood += it.mood ?? 0;
    energy += it.energy ?? 0;
    cost += it.weekly ?? 0;
  }
  return { mood, energy, cost };
}

export function itemTrainBonus(p, stat) {
  let b = 0;
  for (const id of Object.keys(p.items ?? {})) b += ITEM_BY_ID[id]?.train?.[stat] ?? 0;
  return b;
}

export function itemsInCat(cat) {
  return ITEMS.filter((i) => i.cat === cat);
}
