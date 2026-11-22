// Contract extensions and holdouts (pros). Outplaying your deal? Ask for an extension: the team makes an offer,
// you accept, push for more, or hold out (you miss games until they pay you or you give in). Pure sim.
// state.extension = { year, status: 'offer'|'signed'|'refused'|'holdout'|'ended', offer: { years, salary }, ask, weeks }
import { clamp } from '../core/util.js';
import { rand } from '../core/rng.js';
import { addNews } from './press.js';
import { logJournal } from './journal.js';
import { marketValue } from './flow.js';

const round10k = (n) => Math.round(n / 10000) * 10000;

/** How underpaid you are (market value / current salary). */
export function leverage(state) {
  const p = state.player;
  if (!p.contract?.salary) return 0;
  return marketValue(state) / p.contract.salary;
}

export function canAskExtension(state) {
  const c = state.career, p = state.player;
  if (c?.stage !== 'pro' || !p.contract || p.contract.years < 1 || state.league?.phase !== 'regular') return false;
  const e = state.extension;
  return !(e && e.year === c.year);
}

/** Ask the front office. Returns the extension state (an offer, or a refusal if you haven't earned it). */
export function askExtension(state) {
  if (!canAskExtension(state)) return null;
  const p = state.player;
  const lev = leverage(state);
  const value = marketValue(state);
  if (lev < 1.05) {
    state.extension = { year: state.career.year, status: 'refused', text: 'The GM says your current deal is fair. Play your way into a raise.' };
    p.rel.coach = clamp(p.rel.coach - 2, 0, 100);
    return state.extension;
  }
  const trust = ((p.rel.coach ?? 50) - 50) / 250;
  const years = clamp(Math.round(2 + ((p.ovr ?? 70) - 70) / 8 - Math.max(0, (p.age ?? 26) - 29) / 2), 1, 5);
  const salary = round10k(value * clamp(0.82 + trust + rand(state) * 0.1, 0.75, 1.05));
  state.extension = { year: state.career.year, status: 'offer', offer: { years, salary }, base: salary, lev: Math.round(lev * 100) / 100, pushes: 0 };
  return state.extension;
}

export function acceptExtension(state) {
  const e = state.extension;
  if (!e || !['offer', 'holdout'].includes(e.status)) return null;
  const p = state.player;
  p.contract = { ...p.contract, years: e.offer.years + (p.contract.years ?? 0), salary: e.offer.salary, rookie: false, extended: state.career.year };
  e.status = 'signed';
  p.holdout = null;
  p.mood = clamp(p.mood + 8, 0, 100);
  addNews(state, 'money', `${p.first} ${p.last} signs a ${e.offer.years}-year extension: $${(e.offer.salary / 1e6).toFixed(1)}M a year.`);
  logJournal(state, 'contract', `Signed a ${e.offer.years}-year extension worth ${(e.offer.salary / 1e6).toFixed(1)}M a year.`, { big: true });
  return { ok: true, text: `Extension signed: ${e.offer.years} more years at $${(e.offer.salary / 1e6).toFixed(1)}M a year.` };
}

/** Push for more (up to twice). They might move, hold firm, or pull the offer. */
export function pushExtension(state) {
  const e = state.extension;
  if (!e || e.status !== 'offer' || e.pushes >= 2) return null;
  const p = state.player;
  e.pushes++;
  const odds = clamp(0.35 + (e.lev - 1) * 0.6 + (p.agentName ? 0.1 : 0) - e.pushes * 0.1, 0.1, 0.85);
  const r = rand(state);
  if (r < odds) { e.offer.salary = round10k(e.offer.salary * (1.08 + rand(state) * 0.07)); return { ok: true, text: `They came up: $${(e.offer.salary / 1e6).toFixed(1)}M a year.` }; }
  if (r < odds + 0.45) return { ok: false, text: 'They won\'t move. The offer stands.' };
  e.status = 'ended';
  p.rel.coach = clamp(p.rel.coach - 4, 0, 100);
  return { ok: false, pulled: true, text: 'They pulled the offer. Maybe next year.' };
}

/** Hold out: you sit until they pay what you ask (ask = 15% over their offer). */
export function startHoldout(state) {
  const e = state.extension;
  if (!e || e.status !== 'offer') return null;
  const p = state.player;
  e.status = 'holdout';
  e.ask = round10k(e.offer.salary * 1.15);
  e.weeks = 0;
  p.holdout = { since: state.league?.week ?? 0, ask: e.ask };
  p.rel.coach = clamp(p.rel.coach - 10, 0, 100);
  p.rel.teammates = clamp(p.rel.teammates - 8, 0, 100);
  addNews(state, 'story', `${p.first} ${p.last} is holding out for a new deal.`);
  return { ok: true, text: `You're holding out for $${(e.ask / 1e6).toFixed(1)}M a year. You won't play until they pay or you report back.` };
}

/** Each week of a holdout: will they cave? Fines and fan anger pile up. Returns a note or null. */
export function holdoutWeek(state) {
  const e = state.extension, p = state.player;
  if (!p.holdout || e?.status !== 'holdout') return null;
  e.weeks++;
  const fine = round10k((p.contract?.salary ?? 0) / 17 * 0.6);
  p.money -= fine;
  p.fame = clamp((p.fame ?? 0) - 1, 0, 100);
  const cave = clamp(0.12 + (e.lev - 1) * 0.35 + e.weeks * 0.06, 0.05, 0.75);
  if (rand(state) < cave) {
    e.offer.salary = e.ask;
    const res = acceptExtension(state);
    addNews(state, 'money', `The team caves: ${p.last} gets his money and reports back.`);
    return `They caved. ${res.text}`;
  }
  return `Holdout week ${e.weeks}: fined $${(fine / 1000).toFixed(0)}K. Fans are restless.`;
}

/** Give up the holdout and report back (the old offer is gone). */
export function endHoldout(state) {
  const e = state.extension, p = state.player;
  if (!p.holdout) return null;
  p.holdout = null;
  if (e) e.status = 'ended';
  p.mood = clamp(p.mood - 6, 0, 100);
  return { ok: true, text: 'You reported back on your current deal. The locker room is glad to have you.' };
}
