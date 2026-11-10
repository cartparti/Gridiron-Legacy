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

/** Training points: how well you do in training drills. Every 100% = 1 skill point. */
export const trainValue = (q) => (q === undefined || q === null ? 0 : q >= 0.92 ? 0.6 : q >= 0.8 ? 0.45 : q >= 0.65 ? 0.3 : q >= 0.5 ? 0.15 : 0);

/**
 * Credit a drill result (q 0..1). Only an improvement over the previous grade for that day counts (no farming
 * retries). Returns { gain, points } where points = skill points earned.
 */
export function creditTraining(state, q, prevQ) {
  const p = ensure(state.player);
  p.trainPts ??= 0;
  const gain = Math.max(0, trainValue(q) - trainValue(prevQ));
  p.trainPts += gain;
  let points = 0;
  while (p.trainPts >= 1 - 1e-9) { p.trainPts -= 1; p.skillPoints++; points++; }
  p.trainPts = Math.max(0, Math.round(p.trainPts * 100) / 100);
  return { gain, points };
}
