// Home: upgrades with weekly perks, and free weekly home actions. Pure sim.
import { HOME_UPGRADES, HOME_ACTIONS, HOME_ACTIONS_PER_WEEK } from '../data/home.js';
import { applyEffects } from './effects.js';
import { clamp } from '../core/util.js';

const lvls = (p) => (p.home ??= {});

/** Sum of perks from all owned upgrade levels: { energy, health, mood, fame, train }. */
export function homePerks(p) {
  const out = { energy: 0, health: 0, mood: 0, fame: 0, train: 0 };
  const L = p.home ?? {};
  for (const u of HOME_UPGRADES) {
    const n = L[u.id] ?? 0;
    for (let i = 0; i < n; i++) for (const [k, arr] of Object.entries(u.perk)) out[k] += arr[i] ?? 0;
  }
  return out;
}

export function upgradeInfo(p) {
  const L = lvls(p);
  return HOME_UPGRADES.map((u) => ({ ...u, level: L[u.id] ?? 0, nextPrice: u.price[L[u.id] ?? 0] ?? null }));
}

export function buyUpgrade(state, id) {
  const p = state.player;
  const u = HOME_UPGRADES.find((x) => x.id === id);
  const L = lvls(p);
  const lvl = L[id] ?? 0;
  const price = u?.price[lvl];
  if (!u || price === undefined) return { ok: false, why: 'Maxed out' };
  if (p.money < price) return { ok: false, why: 'Not enough money' };
  p.money -= price;
  L[id] = lvl + 1;
  return { ok: true, label: u.levels[lvl] };
}

/** Weekly perks from your home (called once per week). */
export function applyHomeWeekly(state) {
  const p = state.player;
  const k = homePerks(p);
  if (k.health) p.health = clamp(p.health + k.health, 0, 100);
  if (k.mood) p.mood = clamp(p.mood + k.mood, 0, 100);
  if (k.fame) p.fame = clamp(p.fame + k.fame, 0, 100);
}

export function homeActionsLeft(state) {
  return HOME_ACTIONS_PER_WEEK - (state.week?.homeActions?.length ?? 0);
}

export function doHomeAction(state, id) {
  const a = HOME_ACTIONS.find((x) => x.id === id);
  if (!a || !state.week || homeActionsLeft(state) <= 0 || state.week.homeActions?.includes(id)) return null;
  (state.week.homeActions ??= []).push(id);
  const changes = a.effects ? applyEffects(state, a.effects) : [];
  if (a.week?.energyBonus) { state.week.energyBonus = (state.week.energyBonus ?? 0) + a.week.energyBonus; changes.push({ label: 'Energy', delta: 1, text: '+1' }); }
  if (a.week?.studied) { state.week.studied = true; changes.push({ label: 'Game prep', delta: 1, text: 'Timing +4%' }); }
  if (a.week?.stretched) state.week.stretched = true;
  return changes;
}
