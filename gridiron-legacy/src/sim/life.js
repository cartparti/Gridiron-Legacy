// Life outside football: meeting someone, first dates, date nights and hangouts.
// Every plan uses a day of the week (and energy/money). Pure sim, no DOM.
import { FIRST_DATE, DATE_VENUES, HANGOUTS, PERSONALITIES, INTERESTS } from '../data/life.js';
import { PARTNER_NAMES } from '../data/names.js';
import { pick, rand, chance } from '../core/rng.js';
import { clamp, fillTokens } from '../core/util.js';
import { applyEffects } from './effects.js';
import { maxEnergy, planCost } from './week.js';
import { randomLook as genLook } from '../data/looks.js';
import { useDaySlot } from './social.js';

const freeDay = (state) => (state.week ? state.week.plan.findIndex((x) => !x) : -1);
const energyLeft = (state) => (state.week ? maxEnergy(state) - planCost(state.week.plan) : 0);

/** Why an option can't be done right now (or null). */
export function lifeBlock(state, { cost = 1, money = 0 } = {}) {
  if (!state.week || state.phase !== 'plan') return 'Only during the week';
  if (freeDay(state) < 0) return 'No free days left';
  if (energyLeft(state) < cost) return 'Not enough energy';
  if (state.player.money < money) return 'Not enough money';
  return null;
}

// ------------------------------------------------------------------ meeting someone new

/** Start a first date with a new person. Returns the candidate. */
export function meetSomeone(state) {
  const p = state.player;
  const cand = {
    name: pick(state, PARTNER_NAMES),
    personality: pick(state, PERSONALITIES).id,
    interest: pick(state, INTERESTS),
    look: genLook(() => rand(state)),
    chem: clamp(20 + p.fame * 0.25 + (p.mood - 50) * 0.15, 10, 45),
    round: 0,
  };
  state.week.dating = cand;
  return cand;
}

export function datingRound(state) {
  const c = state.week?.dating;
  if (!c || c.round >= FIRST_DATE.length) return null;
  const r = FIRST_DATE[c.round];
  return { text: fillTokens(r.text, { name: c.name, interest: c.interest }), choices: r.choices.map((x) => x.label), round: c.round, of: FIRST_DATE.length, chem: c.chem };
}

/** Answer a first-date question. Returns { reaction, done, success? , changes? }. */
export function answerDate(state, idx) {
  const c = state.week.dating;
  const r = FIRST_DATE[c.round];
  const style = r.choices[idx].style;
  const pers = PERSONALITIES.find((x) => x.id === c.personality);
  const d = style === pers.likes ? 24 : style === pers.dislikes ? -12 : 9;
  c.chem = clamp(c.chem + d + (rand(state) - 0.5) * 6, 0, 100);
  c.round++;
  const reaction = d > 20 ? `${c.name} lights up. You can feel the spark.` : d < 0 ? `${c.name} gives a polite smile. Hmm.` : `${c.name} laughs. Not bad.`;
  if (c.round < FIRST_DATE.length) return { reaction, done: false };
  // end of the date
  const cost = { money: -40 };
  const success = c.chem >= 58;
  const p = state.player;
  const changes = applyEffects(state, { ...cost, mood: success ? 6 : -2 });
  if (success) {
    p.partnerName = c.name;
    p.partnerLook = { ...c.look };
    p.rel.partner = 55 + Math.round((c.chem - 58) / 3);
    changes.push({ label: 'Relationship', delta: 1, text: `Dating ${c.name}` });
  }
  useDaySlot(state, `First date (${c.name})`, 'partner', 1);
  state.week.dating = null;
  return {
    reaction, done: true, success, changes,
    text: success ? `"I had a really good time," ${c.name} says at the door. "Same time next week?" You're officially seeing each other.` : `"You're sweet, but I don't think we click," ${c.name} says. No hard feelings.`,
  };
}

// ------------------------------------------------------------------ date nights (with your partner)

export function openDate(state, venueId) {
  const v = DATE_VENUES.find((x) => x.id === venueId);
  const name = state.player.partnerName;
  return { venue: v, moment: fillTokens(pick(state, v.moments), { name }), choices: v.choices.map((c) => c.label + (c.money ? ` ($${c.money})` : '')) };
}

export function finishDate(state, venueId, idx) {
  const v = DATE_VENUES.find((x) => x.id === venueId);
  const c = v.choices[idx];
  const name = state.player.partnerName;
  let effects = mergeFx(v.base, c.effects, { money: -(v.money + (c.money ?? 0)) });
  let text = c.result;
  if (c.chance) {
    const ok = chance(state, c.chance.p);
    text = ok ? c.chance.successText : c.chance.failText;
    if (!ok && c.chance.failEffects) effects = mergeFx(effects, c.chance.failEffects);
  }
  const changes = applyEffects(state, effects);
  useDaySlot(state, `${v.label} (${name})`, 'partner', v.cost);
  return { text: fillTokens(text, { name }), changes };
}

// ------------------------------------------------------------------ hangouts

export function openHangout(state, id) {
  const hg = HANGOUTS.find((x) => x.id === id);
  const mate = state.player.teammates?.length ? pick(state, state.player.teammates).name.split(' ')[0] : 'Your buddy';
  state.week.hangMate = mate;
  return { hangout: hg, text: fillTokens(hg.text, { mate }), choices: hg.choices.map((c) => c.label) };
}

export function finishHangout(state, id, idx) {
  const hg = HANGOUTS.find((x) => x.id === id);
  const c = hg.choices[idx];
  const mate = state.week.hangMate ?? 'your buddy';
  let effects = mergeFx(hg.base, c.effects, { money: -hg.money });
  let text = c.result;
  if (c.chance) {
    const ok = chance(state, c.chance.p);
    text = ok ? c.chance.successText : c.chance.failText;
    if (!ok && c.chance.failEffects) effects = mergeFx(effects, c.chance.failEffects);
  }
  // friends you hang out with get closer
  for (const m of state.player.teammates ?? []) if (m.name.startsWith(mate)) m.bond = clamp(m.bond + 4, 0, 100);
  const changes = applyEffects(state, effects);
  useDaySlot(state, hg.label, 'teammate', hg.cost);
  return { text: fillTokens(text, { mate }), changes };
}

/** Merge effect objects, adding numbers (rel/train merged per key). */
function mergeFx(...list) {
  const out = {};
  for (const fx of list) {
    if (!fx) continue;
    for (const [k, v] of Object.entries(fx)) {
      if (typeof v === 'number') out[k] = (out[k] ?? 0) + v;
      else if (v && typeof v === 'object') { out[k] = { ...(out[k] ?? {}) }; for (const [k2, v2] of Object.entries(v)) out[k][k2] = (out[k][k2] ?? 0) + v2; }
      else out[k] = v;
    }
  }
  if (out.money === 0) delete out.money;
  return out;
}

export { DATE_VENUES, HANGOUTS, PERSONALITIES };
