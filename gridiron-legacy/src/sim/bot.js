// A headless "player" used by tests and balance scripts. It makes decisions
// through the same flow functions as the UI.
import { STAT_KEYS, POSITIONS } from '../data/positions.js';
import { answerInterview } from './career.js';
import { pick, rand, chance } from '../core/rng.js';
import { availableActivities, maxEnergy, planCost } from './week.js';
import { stepGame, resolveMoment, autoMoment, resolveDecision, autoDecision, resolveGameEvent, autoGameEvent } from './game.js';
import * as flow from './flow.js';

export const STRATEGIES = {
  balanced: { name: 'Balanced', weights: { sprints: 2, weights: 2, drills: 2, film: 2, recovery: 1.5, meetcoach: 1.5, hangout: 1, family: 1, classes: 2, media: 0.6, date: 1, rehab: 4, agentcall: 1, charity: 0.6, yoga: 1 }, keep: 2, call: { safe: 0.25, balanced: 0.5, risky: 0.25 } },
  grinder: { name: 'Grinder', weights: { sprints: 3, weights: 3, drills: 3, film: 3, doubles: 2, classes: 1.5, rehab: 4 }, keep: 0, call: { safe: 0.2, balanced: 0.6, risky: 0.2 } },
  social: { name: 'Social', weights: { hangout: 3, family: 3, date: 3, nightout: 2, gaming: 2, media: 2, classes: 1.5, recovery: 1, rehab: 4 }, keep: 1, call: { safe: 0.3, balanced: 0.5, risky: 0.2 } },
  gunslinger: { name: 'Gunslinger', weights: { sprints: 2, weights: 2, drills: 2, film: 1, recovery: 1, classes: 1.5, rehab: 4 }, keep: 2, call: { safe: 0, balanced: 0.2, risky: 0.8 } },
  cautious: { name: 'Cautious', weights: { sprints: 2, weights: 2, drills: 2, film: 2, recovery: 2, classes: 2, rehab: 4 }, keep: 3, call: { safe: 0.8, balanced: 0.2, risky: 0 } },
};

function weightedKey(state, obj) {
  const entries = Object.entries(obj).filter(([, w]) => w > 0);
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let r = rand(state) * total;
  for (const [k, w] of entries) { r -= w; if (r <= 0) return k; }
  return entries[entries.length - 1][0];
}

export function botPlan(state, strat) {
  const acts = availableActivities(state);
  const max = maxEnergy(state);
  const plan = Array(5).fill(null);
  const w = { ...strat.weights };
  // Keep grades up and health okay, like a sensible player would.
  if (state.player.academics < 50) w.classes = (w.classes ?? 0) + 6;
  if (state.player.health < 55) w.recovery = (w.recovery ?? 0) + 5;
  for (let i = 0; i < 5; i++) {
    const options = {};
    for (const a of acts) {
      if (!w[a.id]) continue;
      if (planCost(plan) + a.cost > max - strat.keep && a.cost > 0) continue;
      options[a.id] = w[a.id];
    }
    if (!Object.keys(options).length) break;
    plan[i] = weightedKey(state, options);
  }
  return plan;
}

/** Play out the current game automatically. */
export function botPlayGame(state, strat, skill) {
  for (;;) {
    const r = stepGame(state);
    if (r.type === 'end') break;
    if (r.type === 'decision') { resolveDecision(state, autoDecision(state)); continue; }
    if (r.type === 'gameEvent') { resolveGameEvent(state, autoGameEvent(state)); continue; }
    const call = weightedKey(state, strat.call);
    resolveMoment(state, autoMoment(state, call, skill));
  }
  flow.finishGame(state);
}

/** Advance one decision. Returns false when the career is over. */
export function botStep(state, strat, skill = 0.5) {
  switch (state.phase) {
    case 'event':
    case 'offseason_event':
      flow.resolveEvent(state, Math.floor(rand(state) * state.pendingEvent.choices.length));
      return true;
    case 'plan': {
      const status = flow.gameDayStatus(state);
      flow.submitPlan(state, botPlan(state, strat), { playHurt: status.hurt && chance(state, 0.3) });
      return true;
    }
    case 'game':
      botPlayGame(state, strat, skill);
      return true;
    case 'postgame':
      flow.continueAfterGame(state);
      return true;
    case 'review':
      flow.continueAfterReview(state);
      return true;
    case 'camp': {
      const w = POSITIONS[state.player.position].weights;
      const focus = state.player.health < 50 ? 'rest' : weightedKey(state, w);
      flow.chooseCamp(state, focus);
      return true;
    }
    case 'recruiting':
      flow.chooseCollege(state, state.offers[0].teamId);
      return true;
    case 'declare':
      flow.declareForDraft(state, state.career.stageSeason >= 2 && state.player.ovr >= 74);
      return true;
    case 'combine':
      answerInterview(state, 0);
      flow.finishCombine(state);
      return true;
    case 'draft':
      flow.ackDraft(state);
      return true;
    case 'contract':
      flow.signContract(state, 0);
      return true;
    case 'retired':
      return false;
    default:
      throw new Error(`Unknown phase ${state.phase}`);
  }
}

export function simulateCareer(opts, strat = STRATEGIES.balanced, skill = 0.5, maxSteps = 20000) {
  const state = flow.newCareer(opts);
  let steps = 0;
  while (botStep(state, strat, skill)) {
    if (++steps > maxSteps) throw new Error('Career did not finish');
  }
  return state;
}

export function randomCareerOpts(seed, position) {
  return {
    seed,
    first: 'Test',
    last: `Player${seed}`,
    position: position ?? ['QB', 'RB', 'WR', 'CB', 'DT'][seed % 5],
    number: 7,
    hometown: 'Westfield',
    background: ['natural', 'gymrat', 'student', 'technician'][seed % 4],
    hsTeamId: 'WFW',
  };
}

export { STAT_KEYS, pick };
