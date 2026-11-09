// Event engine: picks an eligible event, fills in names, applies the chosen option.
import { ALL_EVENTS, EVENTS_BY_ID } from '../data/events/index.js';
import { PARTNER_NAMES, AGENT_NAMES } from '../data/names.js';
import { fillTokens } from '../core/util.js';
import { pick, weightedPick, chance, rand } from '../core/rng.js';
import { applyEffects } from './effects.js';
import { getTeam } from './league.js';

const inRange = (v, r) => v !== null && v !== undefined && v >= r[0] && v <= r[1];

/** Can this event happen right now? */
export function isEligible(state, ev, phase) {
  const p = state.player;
  const stage = state.career.stage;
  if (ev.stages && !ev.stages.includes(stage)) return false;
  const evPhase = ev.phase ?? 'season';
  if (evPhase !== 'any' && evPhase !== phase) return false;
  if (!ev.repeat && state.seenEvents?.[ev.id]) return false;
  const c = ev.cond ?? {};
  const week = (state.league?.week ?? 0) + 1;
  if (c.minAge !== undefined && p.age < c.minAge) return false;
  if (c.maxAge !== undefined && p.age > c.maxAge) return false;
  if (c.minFame !== undefined && p.fame < c.minFame) return false;
  if (c.maxFame !== undefined && p.fame > c.maxFame) return false;
  if (c.minMoney !== undefined && p.money < c.minMoney) return false;
  if (c.maxMoney !== undefined && p.money > c.maxMoney) return false;
  if (c.minMood !== undefined && p.mood < c.minMood) return false;
  if (c.maxMood !== undefined && p.mood > c.maxMood) return false;
  if (c.minHealth !== undefined && p.health < c.minHealth) return false;
  if (c.maxHealth !== undefined && p.health > c.maxHealth) return false;
  if (c.minOvr !== undefined && p.ovr < c.minOvr) return false;
  if (c.minAcademics !== undefined && p.academics < c.minAcademics) return false;
  if (c.maxAcademics !== undefined && p.academics > c.maxAcademics) return false;
  if (c.minWeek !== undefined && week < c.minWeek) return false;
  if (c.maxWeek !== undefined && week > c.maxWeek) return false;
  if (c.positions && !c.positions.includes(p.position)) return false;
  if (c.partner !== undefined && !!p.partnerName !== c.partner) return false;
  if (c.agent !== undefined && !!p.agentName !== c.agent) return false;
  if (c.injured !== undefined && !!p.injury !== c.injured) return false;
  if (c.flags) for (const [f, want] of Object.entries(c.flags)) if (!!p.flags[f] !== want) return false;
  if (c.rel) for (const [k, r] of Object.entries(c.rel)) if (!inRange(p.rel[k], r)) return false;
  return true;
}

export function eligibleEvents(state, phase) {
  return ALL_EVENTS.filter((e) => isEligible(state, e, phase));
}

/** Maybe pick an event for this week (or offseason). Chained follow-ups come first. */
export function rollEvent(state, phase, probability = 0.55) {
  if (phase === 'season' && state.chainQueue?.length) {
    for (const c of state.chainQueue) c.inWeeks--;
    const ready = state.chainQueue.find((c) => c.inWeeks <= 0);
    if (ready) {
      state.chainQueue = state.chainQueue.filter((c) => c !== ready);
      const ev = EVENTS_BY_ID[ready.id];
      if (ev) return presentEvent(state, ev);
    }
  }
  if (!chance(state, probability)) return null;
  const pool = eligibleEvents(state, phase);
  // Events whose conditions are specific (flags, relationships) are follow-ups: make them likelier.
  const ev = weightedPick(state, pool, (e) => (e.weight ?? 1) * (e.cond?.flags || e.cond?.rel ? 1.8 : 1));
  return ev ? presentEvent(state, ev) : null;
}

export function presentEvent(state, ev) {
  const p = state.player;
  const rivalTeam = state.league ? getTeam(state.league, state.career.rivalTeamId) : null;
  const ctx = {
    partnerCandidate: pick(state, PARTNER_NAMES),
    agentCandidate: pick(state, AGENT_NAMES),
  };
  const tokens = eventTokens(state, ctx, rivalTeam);
  return {
    id: ev.id,
    title: ev.title,
    text: fillTokens(ev.text, tokens),
    choices: ev.choices.map((c) => ({ label: fillTokens(c.label, tokens), hint: c.hint ? fillTokens(c.hint, tokens) : null, risky: !!c.chance })),
    ctx,
    tokens,
  };
}

export function eventTokens(state, ctx = {}, rivalTeam = null) {
  const p = state.player;
  const team = state.league ? getTeam(state.league, state.career.teamId) : null;
  return {
    first: p.first,
    last: p.last,
    team: team ? `${team.city} ${team.name}` : 'your team',
    coach: p.coachName?.split(' ').slice(-1)[0] ?? 'Coach',
    partner: p.partnerName ?? 'your partner',
    agent: p.agentName ?? 'your agent',
    rival: p.rivalName,
    rivalTeam: rivalTeam ? `${rivalTeam.city}` : 'your rival',
    hometown: p.hometown,
    business: p.business?.name ?? 'business',
    partnerCandidate: ctx.partnerCandidate ?? 'someone',
    agentCandidate: ctx.agentCandidate ?? 'an agent',
    partnerOrFamily: p.partnerName ?? 'Your mom',
  };
}

/** Apply a choice. Returns { result, changes, success }. */
export function chooseOption(state, pending, idx) {
  const ev = EVENTS_BY_ID[pending.id];
  const choice = ev.choices[idx];
  state.seenEvents = state.seenEvents ?? {};
  state.seenEvents[ev.id] = (state.seenEvents[ev.id] ?? 0) + 1;
  let branch = choice;
  let success = null;
  if (choice.chance) {
    const statBonus = choice.chance.stat ? (state.player.stats[choice.chance.stat] - 50) / 200 : 0;
    success = rand(state) < Math.min(0.95, choice.chance.p + statBonus);
    branch = success ? choice.chance.success : choice.chance.fail;
  }
  const changes = applyEffects(state, branch.effects, pending.ctx);
  const result = fillTokens(branch.result ?? '', eventTokens(state, pending.ctx));
  return { result, changes, success };
}
