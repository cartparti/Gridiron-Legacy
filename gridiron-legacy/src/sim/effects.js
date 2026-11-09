// Applies "effects" objects from events and activities to the game state.
// Returns a list of human-readable changes so the UI can show what happened.
import { clamp } from '../core/util.js';
import { rand, randInt, pick, weightedPick, chance } from '../core/rng.js';
import { INJURIES, PERKS, SPONSORS } from '../data/lifestyle.js';
import { PARTNER_NAMES, AGENT_NAMES, FIRST_NAMES, LAST_NAMES } from '../data/names.js';
import { STAT_LABELS } from '../data/positions.js';
import { applyTraining, refreshOverall } from './player.js';
import { addNews } from './press.js';

const REL_LABELS = { coach: 'Coach', teammates: 'Teammates', family: 'Family', partner: 'Partner', agent: 'Agent', rival: 'Rivalry' };

export function relLabel(k) {
  return REL_LABELS[k] ?? k;
}

export function newInjury(state, { allowMajor = false } = {}) {
  const pool = INJURIES.filter((i) => allowMajor || !i.major);
  const inj = weightedPick(state, pool, (i) => i.weight);
  return { id: inj.id, label: inj.label, weeks: randInt(state, inj.weeks[0], inj.weeks[1]), major: !!inj.major, perm: inj.perm ?? null };
}

export function applyInjury(state, inj) {
  const p = state.player;
  if (p.injury) {
    p.injury.weeks += Math.ceil(inj.weeks / 2);
  } else {
    p.injury = inj;
  }
  if (inj.perm) {
    for (const [k, v] of Object.entries(inj.perm)) p.stats[k] = clamp(p.stats[k] + v, 20, 99);
    refreshOverall(p);
  }
  p.health = clamp(p.health - (inj.major ? 40 : 15), 5, 100);
  addNews(state, 'injury', `${p.first} ${p.last} suffers ${inj.label.toLowerCase()} — out ${inj.weeks} week${inj.weeks > 1 ? 's' : ''}.`);
}

export function createSponsor(state, mult = 1) {
  const p = state.player;
  const s = pick(state, SPONSORS);
  const stageMult = state.career.stage === 'pro' ? 160 : state.career.stage === 'college' ? 3 : 1;
  const weekly = Math.round((Math.pow(Math.max(5, p.fame), 1.5) * stageMult * mult) / 10) * 10;
  const deal = { brand: s.brand, product: s.product, weekly, weeks: randInt(state, 14, 42) };
  p.sponsors.push(deal);
  // You can only carry so many deals: the weakest one is dropped.
  if (p.sponsors.length > 4) p.sponsors.sort((a, b) => b.weekly - a.weekly).pop();
  addNews(state, 'money', `${p.last} signs with ${s.brand} ${s.product}: ${fmt(weekly)}/week.`);
  return deal;
}

const fmt = (n) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${n}`);

export function scandalShield(p) {
  return p.perks.reduce((a, id) => a + (PERKS.find((x) => x.id === id)?.bonus?.scandalShield ?? 0), 0);
}

export function applyEffects(state, eff, ctx = {}) {
  const p = state.player;
  const out = [];
  if (!eff) return out;
  const push = (label, delta, fmtFn) => {
    if (!delta) return;
    out.push({ label, delta, text: fmtFn ? fmtFn(delta) : `${delta > 0 ? '+' : ''}${Math.round(delta * 10) / 10}` });
  };

  if (eff.mood) { const before = p.mood; p.mood = clamp(p.mood + eff.mood, 0, 100); push('Mood', p.mood - before); }
  if (eff.health) { const before = p.health; p.health = clamp(p.health + eff.health, 0, 100); push('Health', p.health - before); }
  if (eff.fame) {
    let f = eff.fame;
    if (f < 0) f *= 1 - scandalShield(p);
    const before = p.fame;
    p.fame = clamp(p.fame + f, 0, 100);
    push('Fame', p.fame - before);
  }
  if (eff.academics && state.career.stage !== 'pro') { const b = p.academics; p.academics = clamp(p.academics + eff.academics, 0, 100); push('Grades', p.academics - b); }
  if (eff.money) { p.money += eff.money; push('Money', eff.money, (d) => `${d > 0 ? '+' : '-'}${fmt(Math.abs(d))}`); }
  if (eff.moneyPct) {
    const d = Math.round(Math.max(0, p.money) * eff.moneyPct);
    p.money += d;
    push('Money', d, (x) => `${x > 0 ? '+' : '-'}${fmt(Math.abs(x))}`);
  }
  if (eff.energy && state.week) { state.week.energyBonus = (state.week.energyBonus ?? 0) + eff.energy; push('Energy (this week)', eff.energy); }
  if (eff.stats) {
    for (const [k, v] of Object.entries(eff.stats)) { p.stats[k] = clamp(p.stats[k] + v, 20, 99); push(STAT_LABELS[k], v); }
    refreshOverall(p);
  }
  if (eff.train) {
    const gains = applyTraining(p, eff.train);
    for (const [k, v] of Object.entries(gains)) push(STAT_LABELS[k], v, (d) => `${d > 0 ? '+' : ''}${d.toFixed(1)}`);
  }
  if (eff.rel) {
    for (const [k, v] of Object.entries(eff.rel)) {
      if (p.rel[k] === null || p.rel[k] === undefined) continue;
      const b = p.rel[k];
      p.rel[k] = clamp(p.rel[k] + v, 0, 100);
      push(relLabel(k), p.rel[k] - b);
    }
  }
  if (eff.flags) Object.assign(p.flags, eff.flags);
  if (eff.clearFlags) for (const f of eff.clearFlags) delete p.flags[f];
  if (eff.injury) {
    const inj = newInjury(state);
    applyInjury(state, inj);
    out.push({ label: 'Injury', delta: -1, text: `${inj.label} (${inj.weeks} wk)` });
  }
  if (eff.suspend) {
    p.suspended += eff.suspend;
    out.push({ label: 'Suspended', delta: -1, text: `${eff.suspend} game${eff.suspend > 1 ? 's' : ''}` });
    addNews(state, 'scandal', `${p.first} ${p.last} suspended ${eff.suspend} game${eff.suspend > 1 ? 's' : ''}.`);
  }
  if (eff.scandal) {
    const shield = scandalShield(p);
    p.fame = clamp(p.fame - 3 * (1 - shield), 0, 100);
    p.rel.coach = clamp(p.rel.coach - 4, 0, 100);
    addNews(state, 'scandal', `Controversy follows ${p.first} ${p.last} after a rough week off the field.`);
    out.push({ label: 'Scandal', delta: -1, text: 'Bad press' });
  }
  if (eff.newPartner && !p.partnerName) {
    p.partnerName = ctx.partnerCandidate ?? pick(state, PARTNER_NAMES);
    p.rel.partner = 60;
    out.push({ label: 'Relationship', delta: 1, text: `Dating ${p.partnerName}` });
  }
  if (eff.breakup && p.partnerName) {
    out.push({ label: 'Relationship', delta: -1, text: `Split with ${p.partnerName}` });
    p.partnerName = null;
    p.rel.partner = null;
    delete p.flags.married;
  }
  if (eff.hireAgent && !p.agentName) {
    p.agentName = ctx.agentCandidate ?? pick(state, AGENT_NAMES);
    p.rel.agent = 55;
    out.push({ label: 'Agent', delta: 1, text: `Hired ${p.agentName}` });
  }
  if (eff.fireAgent && p.agentName) {
    out.push({ label: 'Agent', delta: -1, text: `Fired ${p.agentName}` });
    p.agentName = null;
    p.rel.agent = null;
  }
  if (eff.sponsor) {
    const d = createSponsor(state, eff.sponsor);
    out.push({ label: 'Sponsor', delta: 1, text: `${d.brand} ${fmt(d.weekly)}/wk` });
  }
  if (eff.sponsorChance && chance(state, eff.sponsorChance * (0.6 + (p.rel.agent ?? 50) / 125) * (0.5 + p.fame / 60))) {
    const d = createSponsor(state, 0.7);
    out.push({ label: 'Sponsor', delta: 1, text: `${d.brand} ${fmt(d.weekly)}/wk` });
  }
  if (eff.business && !p.business) {
    p.business = { name: eff.business, level: 1 };
    p.flags.has_business = true;
    out.push({ label: 'Business', delta: 1, text: `Launched ${eff.business}` });
  }
  if (eff.businessWork && p.business) {
    const base = (p.flags.business_big ? 12000 : 4000) * (1 + p.fame / 100);
    const earned = Math.round(base * (0.6 + rand(state) * 0.8));
    p.money += earned;
    push('Money', earned, (d) => `+${fmt(d)}`);
  }
  if (eff.rehab && p.injury) {
    p.injury.weeks = Math.max(0, p.injury.weeks - eff.rehab);
    out.push({ label: 'Rehab', delta: 1, text: p.injury.weeks ? `${p.injury.weeks} wk left` : 'Cleared!' });
    if (p.injury.weeks === 0) p.injury = null;
  }
  if (eff.setHousing) { p.housing = eff.setHousing; out.push({ label: 'Housing', delta: 1, text: 'Moved' }); }
  if (eff.salaryBump && p.contract) {
    p.contract.salary = Math.round(p.contract.salary * (1 + eff.salaryBump));
    out.push({ label: 'Salary', delta: 1, text: `+${Math.round(eff.salaryBump * 100)}%` });
  }
  if (eff.newCoach) {
    p.coachName = `${pick(state, FIRST_NAMES)} ${pick(state, LAST_NAMES)}`;
    p.rel.coach = 45;
    out.push({ label: 'New Coach', delta: 0, text: `Coach ${p.coachName}` });
  }
  if ((eff.transfer || eff.trade) && state.league) {
    const options = state.league.teams.filter((t) => t.id !== state.career.teamId);
    const t = pick(state, options);
    state.career.pendingMove = t.id; // applied at a safe point (between games)
    out.push({ label: eff.trade ? 'Traded' : 'Transfer', delta: 0, text: `${t.city} ${t.name}` });
  }
  if (eff.risk && chance(state, eff.risk)) {
    if (chance(state, 0.5)) {
      const inj = newInjury(state);
      inj.weeks = Math.min(inj.weeks, 2);
      applyInjury(state, inj);
      out.push({ label: 'Mishap', delta: -1, text: `${inj.label}` });
    } else {
      p.fame = clamp(p.fame - 2 * (1 - scandalShield(p)), 0, 100);
      p.rel.coach = clamp(p.rel.coach - 5, 0, 100);
      addNews(state, 'scandal', `Photos of ${p.last} out late raise eyebrows.`);
      out.push({ label: 'Mishap', delta: -1, text: 'Bad press' });
    }
  }
  if (eff.chain) {
    const c = typeof eff.chain === 'string' ? { id: eff.chain, delay: 1 } : eff.chain;
    state.chainQueue = state.chainQueue ?? [];
    state.chainQueue.push({ id: c.id, inWeeks: c.delay ?? 1 });
  }
  return out;
}

export function genPersonName(state) {
  return `${pick(state, FIRST_NAMES)} ${pick(state, LAST_NAMES)}`;
}
