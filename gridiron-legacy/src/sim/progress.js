// Player levels and skill points. XP comes from games, training and awards; each level = 1 skill point.
import { clamp } from '../core/util.js';
import { STAT_KEYS } from '../data/positions.js';
import { calcOverall } from './player.js';

export const xpForLevel = (lvl) => 120 + lvl * 70; // XP needed to go from lvl to lvl+1

function ensure(p) {
  p.level ??= 1;
  p.xp ??= 0;
  p.skillPoints ??= 0;
  return p;
}

/** Add XP. Returns the number of levels gained. */
export function addXp(state, amount) {
  const p = ensure(state.player);
  if (!(amount > 0)) return 0;
  p.xp += amount;
  let gained = 0;
  while (p.xp >= xpForLevel(p.level)) {
    p.xp -= xpForLevel(p.level);
    p.level++;
    p.skillPoints++;
    gained++;
  }
  return gained;
}

/** Cost of raising a stat by one (gets pricier at the top). */
export const pointCost = (v) => (v >= 90 ? 3 : v >= 80 ? 2 : 1);

/** Spend skill points on a stat. Returns true on success. */
export function spendPoint(state, stat) {
  const p = ensure(state.player);
  if (!STAT_KEYS.includes(stat)) return false;
  const cost = pointCost(p.stats[stat]);
  if (p.skillPoints < cost || p.stats[stat] >= 99) return false;
  p.skillPoints -= cost;
  p.stats[stat] = clamp(p.stats[stat] + 1, 0, 99);
  p.ovr = calcOverall(p.stats, p.position);
  return true;
}

export function levelInfo(state) {
  const p = ensure(state.player);
  return { level: p.level, xp: p.xp, need: xpForLevel(p.level), points: p.skillPoints };
}
