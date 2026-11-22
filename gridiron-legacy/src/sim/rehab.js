// Injury rehab plans: when you're hurt for a couple of weeks or more, choose how to come back. Rush it (faster, but a
// real chance of re-injury in your first games back), follow the trainers, take it slow (cross-train and come back
// fresh), or pay for an elite recovery program. Pure sim. Stored on player.injury.plan; player.rushedBack counts
// the risky games after a rushed return.
import { clamp } from '../core/util.js';
import { rand } from '../core/rng.js';
import { addNews } from './press.js';

export const REHAB_PLANS = [
  { id: 'rush', label: 'Rush back', desc: 'About a third faster. Real risk of getting hurt again in your first two games back.' },
  { id: 'standard', label: 'Follow the trainers', desc: 'The normal timeline. No surprises.' },
  { id: 'careful', label: 'Take it slow', desc: 'One extra week, but you cross-train and come back fresh (+health, +Football IQ, +mood).' },
  { id: 'elite', label: 'Elite recovery program', desc: 'Hyperbaric chamber, private physio, cryo. A quarter faster, no extra risk. Costs money.' },
];
export const eliteCost = (state) => (state.career.stage === 'pro' ? 250000 : 15000);

export const canRehab = (state) => {
  const inj = state.player?.injury;
  return !!inj && inj.weeks >= 2 && !inj.plan && state.career.stage !== 'retired';
};

export function chooseRehab(state, id) {
  const p = state.player;
  if (!canRehab(state)) return null;
  const inj = p.injury;
  if (id === 'elite') {
    if (state.career.stage === 'hs') return { ok: false, text: 'Not available in high school.' };
    if (p.money < eliteCost(state)) return { ok: false, text: 'You can\'t afford the elite program.' };
    p.money -= eliteCost(state);
    inj.weeks = Math.max(1, Math.round(inj.weeks * 0.75));
  } else if (id === 'rush') inj.weeks = Math.max(1, Math.floor(inj.weeks * 0.65));
  else if (id === 'careful') inj.weeks += 1;
  inj.plan = id;
  const plan = REHAB_PLANS.find((x) => x.id === id);
  return { ok: true, text: `${plan.label}: back in about ${inj.weeks} week${inj.weeks === 1 ? '' : 's'}.` };
}

/** The injury just healed: apply the plan's after-effects. */
export function rehabHealed(state, inj) {
  const p = state.player;
  if (!inj?.plan) return;
  if (inj.plan === 'rush') p.rushedBack = 2;
  if (inj.plan === 'careful') {
    p.health = clamp(p.health + 15, 0, 100);
    p.mood = clamp(p.mood + 5, 0, 100);
    p.stats.iq = clamp(p.stats.iq + 1, 0, 99);
  }
  if (inj.plan === 'elite') p.health = clamp(p.health + 10, 0, 100);
}

/** After each game you play: a rushed return can go wrong. Returns a re-injury or null. */
export function rushedRisk(state, makeInjury) {
  const p = state.player;
  if (!(p.rushedBack > 0)) return null;
  p.rushedBack--;
  if (rand(state) < 0.14) {
    const inj = makeInjury();
    inj.weeks = Math.max(1, Math.round(inj.weeks * 0.7));
    addNews(state, 'injury', `${p.last} re-injured after rushing back.`);
    p.rushedBack = 0;
    return inj;
  }
  return null;
}
