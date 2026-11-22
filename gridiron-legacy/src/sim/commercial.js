// Commercial shoots: once a season, each brand you represent wants you on camera. Shoot the ad (a timing mini-game
// on your lines, uses a day) for a bonus check and fame; nail it and the ad goes viral. Pure sim.
import { clamp } from '../core/util.js';
import { addNews } from './press.js';
import { logJournal } from './journal.js';

const SCRIPTS = {
  drink: ['When the fourth quarter comes...', 'I reach for', 'the real thing.', 'Stay thirsty for wins.'],
  shoes: ['Every cut.', 'Every step.', 'Every touchdown.', 'Laced up in'],
  food: ['Breakfast of', 'champions?', 'No. Breakfast of', 'me.'],
  auto: ['Big game.', 'Bigger truck.', 'Built tough like', 'a goal-line stand.'],
  phone: ['My playbook.', 'My highlights.', 'My whole life.', 'In one hand.'],
  default: ['They said I couldn\'t.', 'I said watch me.', 'Now I say:', 'try it yourself.'],
};
export const scriptFor = (deal) => SCRIPTS[deal?.cat] ?? SCRIPTS.default;

/** Brands that want a commercial this season. */
export function commercialDeals(state) {
  const y = state.career?.year;
  return (state.player?.sponsors ?? []).filter((d) => ['brand', 'merch', 'performance', undefined].includes(d.kind) && d.shotYear !== y && (d.weekly ?? 0) > 0);
}
export const canShoot = (state) => !!state.week?.plan?.some((x) => !x);

/** Finish the shoot: perf 0..1 from the mini-game. */
export function shootCommercial(state, brand, perf) {
  const p = state.player;
  const d = p.sponsors.find((x) => x.brand === brand);
  if (!d || d.shotYear === state.career.year) return null;
  const i = state.week?.plan?.findIndex((x) => !x) ?? -1;
  if (i < 0) return { ok: false, text: 'No free day this week to shoot it.' };
  state.week.plan[i] = { done: true, label: `${d.brand} commercial`, icon: 'film', cost: 1 };
  d.shotYear = state.career.year;
  const q = clamp(perf, 0, 1);
  const pay = Math.round((d.weekly * (2 + q * 4)) / 100) * 100;
  const viral = q >= 0.85;
  p.money += pay;
  d.total = (d.total ?? 0) + pay;
  p.fame = clamp((p.fame ?? 0) + 1 + q * 2 + (viral ? 3 : 0), 0, 100);
  if (viral) {
    d.weeks += 6; // the brand extends the deal
    addNews(state, 'money', `${p.last}'s ${d.brand} commercial goes viral.`);
    logJournal(state, 'contract', `Your ${d.brand} commercial went viral.`);
  }
  return { ok: true, pay, viral, text: viral ? `It went viral! $${pay.toLocaleString('en-US')} bonus and ${d.brand} extended your deal.` : q >= 0.5 ? `A solid ad. $${pay.toLocaleString('en-US')} bonus.` : `A few too many takes. $${pay.toLocaleString('en-US')} bonus.` };
}
