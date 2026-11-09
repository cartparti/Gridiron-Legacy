// The weekly life-sim loop: energy budget, schedule activities and weekly upkeep.
import { ACTIVITIES } from '../data/activities.js';
import { HOUSING, CARS, PERKS } from '../data/lifestyle.js';
import { BASE_ENERGY, SLOTS_PER_WEEK, STAGES } from '../data/config.js';
import { clamp } from '../core/util.js';
import { addXp } from './progress.js';
import { homePerks, applyHomeWeekly } from './home.js';
import { applyEffects } from './effects.js';
import { addNews } from './press.js';
import { itemWeekly } from './shop.js';

export const ACTIVITY_BY_ID = Object.fromEntries(ACTIVITIES.map((a) => [a.id, a]));

function perkBonus(p, key) {
  return p.perks.reduce((a, id) => a + (PERKS.find((x) => x.id === id)?.bonus?.[key] ?? 0), 0);
}

export function maxEnergy(state) {
  const p = state.player;
  return Math.max(3, BASE_ENERGY + Math.floor(p.health / 25) + perkBonus(p, 'energy') + itemWeekly(p).energy + homePerks(p).energy + (state.week?.energyBonus ?? 0));
}

export function isAvailable(state, act) {
  const p = state.player;
  const r = act.requires;
  if (!r) return true;
  if (r.stages && !r.stages.includes(state.career.stage)) return false;
  if (r.partner && !p.partnerName) return false;
  if (r.agent && !p.agentName) return false;
  if (r.injured && !p.injury) return false;
  if (r.flag && !p.flags[r.flag]) return false;
  if (r.minAge && p.age < r.minAge) return false;
  return true;
}

export function availableActivities(state) {
  return ACTIVITIES.filter((a) => isAvailable(state, a));
}

/** Plan entries are activity ids (applied when you submit) or { done, cost } records of things already done. */
export function planCost(plan) {
  return plan.reduce((a, e) => a + (!e ? 0 : typeof e === 'object' ? e.cost ?? 0 : ACTIVITY_BY_ID[e]?.cost ?? 0), 0);
}

export function newWeek(state) {
  state.week = { plan: Array(SLOTS_PER_WEEK).fill(null), energyBonus: 0, freshness: 0, summary: null, chats: {}, extraMoments: 0 };
}

/**
 * Apply the chosen schedule. Returns a summary list of changes for the UI.
 * Throws if the plan costs more energy than available (UI prevents this).
 */
export function applyPlan(state, plan) {
  const max = maxEnergy(state);
  const cost = planCost(plan);
  if (cost > max) throw new Error('Plan exceeds energy');
  const all = [];
  plan.forEach((id, i) => {
    if (!id || typeof id === 'object') return;
    const act = ACTIVITY_BY_ID[id];
    if (!act || !isAvailable(state, act)) return;
    all.push(...applyEffects(state, drillScaled(act.effects, state.week.drills?.[i], homePerks(state.player).train)));
    if (act.effects.train) addXp(state, Math.round(12 * (state.week.drills?.[i] !== undefined ? 0.6 + state.week.drills[i] : 1)));
  });
  state.week.plan = plan.slice();
  state.week.freshness = clamp((max - cost) / max, 0, 1);
  const upkeep = weeklyUpkeep(state);
  return { changes: mergeChanges(all), upkeep, freshness: state.week.freshness };
}

/** Training drill result q (0..1) scales training gains: 0.6x (botched) .. 1.5x (perfect). */
export function drillMultiplier(q) {
  return q === undefined || q === null ? 1 : 0.6 + 0.9 * Math.max(0, Math.min(1, q));
}
function drillScaled(effects, q, gym = 0) {
  if (!effects.train || ((q === undefined || q === null) && !gym)) return effects;
  const k = drillMultiplier(q) * (1 + gym);
  const train = {};
  for (const [stat, v] of Object.entries(effects.train)) train[stat] = v * k;
  return { ...effects, train };
}

function mergeChanges(list) {
  const map = new Map();
  for (const c of list) {
    if (typeof c.delta !== 'number' || c.label === 'Injury' || c.label === 'Mishap' || c.label === 'Sponsor' || c.label === 'Rehab') {
      map.set(c.label + Math.random(), c);
      continue;
    }
    const prev = map.get(c.label);
    if (prev) {
      prev.delta += c.delta;
      prev.text = c.label === 'Money' ? null : `${prev.delta > 0 ? '+' : ''}${Math.round(prev.delta * 10) / 10}`;
    } else map.set(c.label, { ...c });
  }
  return [...map.values()];
}

/** Money in/out, mood drift, natural healing, grades. Called once per week. */
export function weeklyUpkeep(state) {
  const p = state.player;
  const stage = state.career.stage;
  const house = HOUSING.find((h) => h.id === p.housing) ?? HOUSING[0];
  const car = CARS.find((c) => c.id === p.car) ?? CARS[0];
  let income = 0;
  let expenses = 0;
  if (stage === 'pro' && p.contract) income += Math.round(p.contract.salary / STAGES.pro.games);
  if (stage === 'hs') income += 20; // allowance
  for (const s of p.sponsors) { income += s.weekly; s.weeks--; }
  const expired = p.sponsors.filter((s) => s.weeks <= 0);
  for (const s of expired) addNews(state, 'money', `${s.brand} sponsorship has ended.`);
  p.sponsors = p.sponsors.filter((s) => s.weeks > 0);
  if (p.business) income += Math.round((p.flags.business_big ? 4000 : 1200) * (1 + p.fame / 120));
  if (stage === 'pro' && p.agentName) expenses += Math.round(income * 0.03);
  expenses += house.rent + car.upkeep;
  for (const id of p.perks) expenses += PERKS.find((x) => x.id === id)?.weekly ?? 0;
  const iw = itemWeekly(p);
  expenses += iw.cost;
  p.money += income - expenses;
  applyHomeWeekly(state);

  // Mood drifts toward a baseline set by family, partner, lifestyle and finances.
  let base = 50 + (p.rel.family - 50) * 0.15;
  if (p.partnerName) base += 3 + (p.rel.partner - 50) * 0.15;
  base += house.mood + car.mood + perkBonus(p, 'mood') + Math.min(12, iw.mood);
  if (p.money < 0) base -= 12;
  if (p.flags.has_dog) base += 2;
  if (p.injury) base -= 6;
  p.mood = clamp(p.mood + (base - p.mood) * 0.18, 0, 100);

  p.health = clamp(p.health + 5 + perkBonus(p, 'health'), 0, 100);
  p.fame = clamp(p.fame + perkBonus(p, 'fame'), 0, 100);
  if (stage !== 'pro') p.academics = clamp(p.academics - 3, 0, 100);
  return { income, expenses };
}
