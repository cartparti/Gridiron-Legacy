// NIL deals (college) and endorsements (pro): brands make offers, you accept, decline or haggle. Pure sim.
//
// Signed deals live in player.sponsors (the same list the old sponsor system uses, so weekly pay, sponsored posts
// and the bank keep working). New fields on a deal: id, kind, cat (one deal per category), bonus { key, per, cap,
// paid }, morality (a suspension can void it), collective, signedYear, total (paid so far), nil.
// state.nil = { offers: [], earned: { [year]: $ }, seq, suspendHandled, gameDeal, lastWeek }
import { clamp } from '../core/util.js';
import { rand, randInt, pick, chance } from '../core/rng.js';
import { getTeam } from './league.js';
import { marketValue } from './legends.js';
import { addNews } from './press.js';
import { AGENT_NAMES } from '../data/names.js';

export const MAX_DEALS = 6;
const POS_NIL = { QB: 1.4, WR: 1.1, RB: 1.05, CB: 0.95, DT: 0.9, K: 0.6, MS: 0.75 };

// main stat a performance clause pays on, per position
const BONUS_STAT = { QB: ['passTD', 'touchdown pass'], RB: ['rushTD', 'rushing touchdown'], WR: ['recTD', 'receiving touchdown'], CB: ['pd', 'pass breakup'], DT: ['defSacks', 'sack'], K: ['fgMade', 'field goal'], MS: ['danceWins', 'showdown win'] };

const LOCAL = [
  ['{city} Auto Mall', 'car dealership', 'auto'], ['Gridiron Grill', 'sports bar', 'food'], ['Big Sal\'s Pizza', 'pizza', 'food'], ['Iron Temple Gym', 'gym', 'fitness'],
  ['Fade Factory', 'barbershop', 'style'], ['Smokestack BBQ', 'barbecue', 'food'], ['DreamRest Mattress', 'mattresses', 'home'], ['{city} Credit Union', 'banking', 'finance'],
  ['Sparkle Car Wash', 'car wash', 'auto'], ['Corner Stop Market', 'convenience store', 'food'], ['Hometown Hardware', 'hardware', 'home'], ['Brew Bros Coffee', 'coffee', 'drink'],
];
const BRANDS = [
  ['Voltade', 'sports drink', 'drink'], ['Strideline', 'cleats', 'shoes'], ['Kodiak Bars', 'protein bars', 'food'], ['Northpeak', 'outerwear', 'apparel'], ['Glidewell', 'razors', 'style'],
  ['Pulse Audio', 'headphones', 'audio'], ['Brightwave Mobile', 'phones', 'phone'], ['Crunch Kingdom', 'cereal', 'food'], ['Summit Motors', 'trucks', 'auto'], ['FreshFold', 'meal kits', 'food'],
  ['Arcwing', 'video games', 'games'], ['Apex Athletics', 'apparel', 'apparel'], ['Hydra Wear', 'compression gear', 'apparel'], ['Flashpoint', 'energy drink', 'drink'], ['Quickfuel', 'sports nutrition', 'food'],
];
const SOCIAL = [['Huddle Creator Fund', 'creator program', 'social'], ['SnapStack', 'photo app', 'social'], ['Glow Up Skincare', 'skincare', 'style'], ['Loot Crate Co.', 'subscription boxes', 'social'], ['TicketDash', 'ticket app', 'social']];
const APPEAR = [
  ['Autograph signing', 'at {local}', 0.9], ['Youth football camp', 'coaching kids for a day', 1.2], ['Grand opening', 'cutting the ribbon at {local}', 0.8],
  ['Charity meet & greet', 'at the children\'s hospital', 0.7], ['Card show', 'signing trading cards', 1.0], ['Podcast guest spot', 'on a big sports podcast', 0.75],
];

export const DEAL_KINDS = {
  local: { label: 'Local business', icon: 'briefcase' },
  brand: { label: 'Brand ambassador', icon: 'star' },
  social: { label: 'Social campaign', icon: 'chat' },
  appearance: { label: 'Appearance (one day)', icon: 'calendar' },
  performance: { label: 'Performance deal', icon: 'trophy' },
  collective: { label: 'Booster collective', icon: 'users' },
  merch: { label: 'Jersey & merch', icon: 'medal' },
  game: { label: 'Video game likeness', icon: 'gamepad' },
  shady: { label: 'Under the table', icon: 'alert' },
};

const isCollege = (state) => state.career?.stage === 'college';
export const dealsOpen = (state) => state.career?.stage === 'college' || state.career?.stage === 'pro';
export const dealsTitle = (state) => (isCollege(state) ? 'NIL Deals' : 'Endorsements');

function ensure(state) {
  state.nil ??= { offers: [], earned: {}, seq: 1 };
  state.nil.offers ??= [];
  state.nil.earned ??= {};
  state.nil.seq ??= 1;
  return state.nil;
}

/** What you're worth to brands for a year (college NIL value / pro endorsement value). */
export function nilValue(state) {
  const p = state.player;
  const c = state.career;
  if (!p || !dealsOpen(state)) return 0;
  const team = state.league ? getTeam(state.league, c.teamId) : null;
  const pos = POS_NIL[p.position] ?? 1;
  const starter = p.depth?.role === 'backup' ? 0.55 : 1;
  const form = p.seasonStats?.games ? clamp(0.8 + ((p.seasonStats.grades / p.seasonStats.games) - 60) / 60, 0.7, 1.35) : 1;
  if (isCollege(state)) {
    const prestige = team?.prestige ?? 3;
    const base = marketValue('college', p.ovr ?? 60, p.age ?? 19, p.fame ?? 0);
    return Math.round((base * (0.7 + prestige * 0.12) * pos * starter * form) / 1000) * 1000;
  }
  const fame = Math.max(3, p.fame ?? 0);
  return Math.round((Math.pow(fame, 1.7) * 1500 * (0.6 + pos * 0.4) * starter * form + Math.max(0, (p.ovr ?? 60) - 75) * 25000) / 10000) * 10000;
}

const roundPay = (n) => (n >= 10000 ? Math.round(n / 500) * 500 : n >= 1000 ? Math.round(n / 50) * 50 : Math.max(10, Math.round(n / 10) * 10));

function cityOf(state) {
  const t = state.league ? getTeam(state.league, state.career.teamId) : null;
  return t?.city ?? state.player.hometown ?? 'Hometown';
}

/** Build one offer of a kind (or a random kind that fits). */
export function makeOffer(state, kind = null) {
  const N = ensure(state);
  const p = state.player;
  const V = Math.max(isCollege(state) ? 6000 : 60000, nilValue(state));
  const wk = V / 22; // a value-week
  const college = isCollege(state);
  if (!kind) {
    const fame = p.fame ?? 0;
    const opts = [['local', 5], ['appearance', 3], ['social', fame >= 15 ? 2.5 : 0.6], ['brand', fame >= 30 ? 2.2 : 0.4], ['performance', 1.6],
      ['merch', fame >= 45 ? 1 : 0], ['collective', college && !p.sponsors.some((d) => d.collective) && !N.offers.some((o) => o.kind === 'collective') ? 0.8 : 0],
      ['shady', college ? 0.35 : 0], ['game', !N.gameDeal && fame >= 25 ? 0.4 : 0]];
    const tot = opts.reduce((a, [, w]) => a + w, 0);
    let r = rand(state) * tot;
    kind = opts.find(([, w]) => (r -= w) < 0)?.[0] ?? 'local';
  }
  const city = cityOf(state);
  // never the same brand twice at once (offers or signed deals)
  const taken = new Set([...N.offers.map((x) => x.brand), ...p.sponsors.map((x) => x.brand)]);
  const fresh = (list, name = (x) => x[0]) => { const ok = list.filter((x) => !taken.has(name(x).replace('{city}', city))); return pick(state, ok.length ? ok : list); };
  const local = fresh(LOCAL);
  const localName = local[0].replace('{city}', city);
  const o = { id: `o${N.seq++}`, kind, weeksLeft: 2, made: state.career.year };
  const v = () => 0.75 + rand(state) * 0.5;
  if (kind === 'local') Object.assign(o, { brand: localName, product: local[1], cat: `local-${local[2]}`, weekly: roundPay(wk * 0.06 * v()), weeks: randInt(state, 6, 12), morality: true });
  else if (kind === 'brand') { const b = fresh(BRANDS); Object.assign(o, { brand: b[0], product: b[1], cat: b[2], weekly: roundPay(wk * 0.16 * v()), weeks: randInt(state, 10, 22), upfront: roundPay(wk * 0.3 * v()), morality: true, fameMin: 30 }); }
  else if (kind === 'social') { const b = fresh(SOCIAL); Object.assign(o, { brand: b[0], product: b[1], cat: 'social', weekly: roundPay(wk * 0.07 * v()), weeks: randInt(state, 4, 8), upfront: roundPay(wk * 0.12 * v()), fame: 1 }); }
  else if (kind === 'appearance') {
    const a = fresh(APPEAR);
    Object.assign(o, { brand: a[0], product: a[1].replace('{local}', localName), cat: 'appearance', upfront: roundPay(wk * 0.18 * a[2] * v()), weeks: 0, weekly: 0, day: true, weeksLeft: 1, fame: a[0].startsWith('Charity') ? 2 : 0.5, mood: a[0].startsWith('Charity') || a[0].startsWith('Youth') ? 3 : 0 });
  } else if (kind === 'performance') {
    const [key, noun] = BONUS_STAT[p.position] ?? BONUS_STAT.WR;
    const per = roundPay(wk * (key === 'passTD' ? 0.05 : key === 'pd' || key === 'fgMade' ? 0.045 : 0.09) * v());
    const b = fresh(BRANDS);
    Object.assign(o, { brand: b[0], product: b[1], cat: b[2], weekly: roundPay(wk * 0.03 * v()), weeks: randInt(state, 8, 14), bonus: { key, noun, per, cap: per * 14, paid: 0 }, morality: true });
  } else if (kind === 'collective') {
    const t = state.league ? getTeam(state.league, state.career.teamId) : null;
    Object.assign(o, { brand: `${t?.name ?? 'Booster'} Collective`, product: 'booster collective', cat: 'collective', weekly: roundPay(wk * 0.3 * v()), weeks: randInt(state, 14, 20), collective: true, weeksLeft: 3, morality: true });
  } else if (kind === 'merch') Object.assign(o, { brand: `${p.last} #${p.number ?? 1} jerseys`, product: 'licensed jersey sales', cat: 'merch', weekly: roundPay(wk * 0.09 * v() * (0.6 + (p.fame ?? 0) / 100)), weeks: randInt(state, 12, 24) });
  else if (kind === 'game') Object.assign(o, { brand: college ? 'College Gridiron 27' : 'Pro Gridiron 27', product: 'your likeness in a video game', cat: 'game', upfront: roundPay(college ? Math.max(1500, wk * 0.15) : wk * 0.4), weeks: 0, weekly: 0, fame: 2 });
  else if (kind === 'shady') Object.assign(o, { brand: 'A "friend of the program"', product: 'a bag of cash. No paperwork.', cat: 'shady', upfront: roundPay(wk * 0.9 * v()), weeks: 0, weekly: 0, shady: true, weeksLeft: 1 });
  o.base = { weekly: o.weekly ?? 0, upfront: o.upfront ?? 0 };
  return o;
}

/** Total value of an offer over its length. */
export const offerTotal = (o) => (o.weekly ?? 0) * (o.weeks ?? 0) + (o.upfront ?? 0);

/** Called at the start of each week (college/pro): new offers, expired offers, suspension fallout, workload. */
export function nilWeek(state) {
  if (!dealsOpen(state)) return [];
  const N = ensure(state);
  const p = state.player;
  const notes = [];
  for (const o of N.offers) o.weeksLeft--;
  const gone = N.offers.filter((o) => o.weeksLeft <= 0);
  N.offers = N.offers.filter((o) => o.weeksLeft > 0);
  // morality clauses: a suspension can void deals
  if (p.suspended > 0 && !N.suspendHandled) {
    N.suspendHandled = true;
    const dropped = p.sponsors.filter((d) => d.morality && chance(state, 0.5));
    if (dropped.length) {
      p.sponsors = p.sponsors.filter((d) => !dropped.includes(d));
      addNews(state, 'money', `${dropped.map((d) => d.brand).join(', ')} ${dropped.length > 1 ? 'end their deals' : 'ends its deal'} with ${p.last} after the suspension.`);
      notes.push(`Morality clause: ${dropped.length} deal${dropped.length > 1 ? 's' : ''} cancelled.`);
    }
  }
  if (!(p.suspended > 0)) N.suspendHandled = false;
  // new offers: more when you're worth more and famous
  const V = nilValue(state);
  const ref = isCollege(state) ? 250000 : 1500000;
  const n = clamp(0.35 + Math.sqrt(V / ref) * 0.65 + (p.agentName ? 0.25 : 0), 0.3, 1.6);
  let count = Math.floor(n) + (rand(state) < n % 1 ? 1 : 0);
  // a collective always comes calling at the start of a college season if you're a starter
  const wk = state.league?.week ?? 0;
  if (isCollege(state) && wk === 0 && p.depth?.role !== 'backup' && !p.sponsors.some((d) => d.collective) && !N.offers.some((o) => o.kind === 'collective') && (p.ovr ?? 0) >= 64) N.offers.push(makeOffer(state, 'collective'));
  while (count-- > 0 && N.offers.length < 5) N.offers.push(makeOffer(state));
  N.lastWeek = `${state.career.year}-${wk}`;
  void gone;
  return notes;
}

/** Workload: more than 3 deals eats into study time (college) and energy. Applied in the weekly upkeep. */
export function nilWorkload(state) {
  const extra = Math.max(0, (state.player.sponsors?.length ?? 0) - 3);
  return { academics: isCollege(state) ? extra * 1.5 : 0, mood: extra > 1 ? -1 : 0 };
}

function conflict(state, o) {
  if (!o.cat || o.cat === 'appearance' || o.cat === 'game' || o.cat === 'shady' || o.cat === 'social' || o.cat.startsWith('local-')) return null;
  return state.player.sponsors.find((d) => d.cat === o.cat) ?? null;
}

/** Why you can't take an offer right now (or null). */
export function offerBlock(state, o) {
  const p = state.player;
  if (o.fameMin && (p.fame ?? 0) < o.fameMin) return `Needs ${o.fameMin} fame`;
  const c = conflict(state, o);
  if (c) return `Clashes with your ${c.brand} deal (${c.product})`;
  if (o.day && !state.week?.plan?.some((x) => !x)) return 'No free day this week';
  if (!o.day && !o.shady && o.kind !== 'game' && p.sponsors.length >= MAX_DEALS) return `You already have ${MAX_DEALS} deals`;
  return null;
}

/** Accept an offer. share: give 20% to the offensive line (or the team). Returns { ok, text, changes }. */
export function acceptOffer(state, id, { share = false } = {}) {
  const N = ensure(state);
  const p = state.player;
  const o = N.offers.find((x) => x.id === id);
  if (!o) return { ok: false, text: 'That offer is gone.' };
  const block = offerBlock(state, o);
  if (block) return { ok: false, text: block };
  N.offers = N.offers.filter((x) => x !== o);
  const k = share ? 0.8 : 1;
  const cut = p.agentName && isCollege(state) ? 0.95 : 1; // college NIL agents take 5% (pro agents already take 3% of all income)
  const changes = [];
  const pay = (amt) => { const a = Math.round(amt * k * cut); p.money += a; earn(state, a); return a; };
  if (o.shady) {
    const a = pay(o.upfront);
    p.flags ??= {};
    p.flags.nilBag = (p.flags.nilBag ?? 0) + 1;
    changes.push({ label: 'Cash', delta: 1, text: `+$${a.toLocaleString('en-US')}` });
    // it can come out right away, or later (nilWeek has no memory of this: the risk is rolled now and next season)
    if (chance(state, 0.35)) {
      const games = randInt(state, 2, 4);
      p.suspended = Math.max(p.suspended ?? 0, games);
      p.money -= Math.round(a * 0.5);
      p.fame = clamp((p.fame ?? 0) - 8, 0, 100);
      p.rel.coach = clamp(p.rel.coach - 12, 0, 100);
      addNews(state, 'scandal', `Compliance investigation: ${p.first} ${p.last} suspended ${games} games for taking improper benefits.`);
      return { ok: true, caught: true, text: `Someone talked. Compliance found out. Suspended ${games} games and you had to pay half of it back.`, changes: [...changes, { label: 'Suspended', delta: -1, text: `${games} games` }, { label: 'Fame', delta: -1, text: '-8' }] };
    }
    return { ok: true, text: 'Nobody saw a thing. For now.', changes };
  }
  if (o.day) {
    const a = pay(o.upfront);
    state.week.plan[state.week.plan.findIndex((x) => !x)] = { done: true, label: `${o.brand}`, icon: 'star', cost: 1 };
    if (o.fame) p.fame = clamp((p.fame ?? 0) + o.fame, 0, 100);
    if (o.mood) p.mood = clamp(p.mood + o.mood, 0, 100);
    changes.push({ label: 'Paid', delta: 1, text: `+$${a.toLocaleString('en-US')}` });
    if (o.fame) changes.push({ label: 'Fame', delta: 1, text: `+${o.fame}` });
    addNews(state, 'money', `${p.last}: ${o.brand.toLowerCase()} ${o.product}.`);
    return { ok: true, text: `Done. $${a.toLocaleString('en-US')} for a day's work.`, changes };
  }
  if (o.kind === 'game') {
    N.gameDeal = true;
    const a = pay(o.upfront);
    p.fame = clamp((p.fame ?? 0) + (o.fame ?? 0), 0, 100);
    addNews(state, 'money', `${p.first} ${p.last} will be in ${o.brand}.`);
    return { ok: true, text: `You're in the game! $${a.toLocaleString('en-US')}.`, changes: [{ label: 'Paid', delta: 1, text: `+$${a.toLocaleString('en-US')}` }] };
  }
  const deal = {
    id: o.id, kind: o.kind, brand: o.brand, product: o.product, cat: o.cat, weekly: Math.round(o.weekly * k * cut), weeks: o.weeks,
    bonus: o.bonus ? { ...o.bonus, per: Math.round(o.bonus.per * k * cut) } : null, morality: !!o.morality, collective: !!o.collective,
    signedYear: state.career.year, total: 0, nil: isCollege(state),
  };
  if (o.upfront) { const a = pay(o.upfront); deal.total += a; changes.push({ label: 'Signing bonus', delta: 1, text: `+$${a.toLocaleString('en-US')}` }); }
  p.sponsors.push(deal);
  if (o.fame) p.fame = clamp((p.fame ?? 0) + o.fame, 0, 100);
  if (share) { p.rel.teammates = clamp(p.rel.teammates + 6, 0, 100); changes.push({ label: 'Teammates', delta: 1, text: '+6' }); }
  else if (offerTotal(o) > nilValue(state) * 0.25 && isCollege(state)) { p.rel.teammates = clamp(p.rel.teammates - 2, 0, 100); changes.push({ label: 'Teammates', delta: -1, text: '-2 (jealous)' }); }
  addNews(state, 'money', `${p.last} signs ${isCollege(state) ? 'an NIL deal' : 'an endorsement'} with ${o.brand}: $${deal.weekly.toLocaleString('en-US')}/week.`);
  return { ok: true, text: `Signed with ${o.brand}.`, changes };
}

export function declineOffer(state, id) {
  const N = ensure(state);
  N.offers = N.offers.filter((x) => x.id !== id);
}

/** Ask for more. Better with an agent and more fame. Win: +15-30%. Lose: they may walk away. */
export function negotiateOffer(state, id) {
  const N = ensure(state);
  const p = state.player;
  const o = N.offers.find((x) => x.id === id);
  if (!o || o.haggled || o.shady) return { ok: false, text: 'No more room to talk.' };
  o.haggled = true;
  const pr = clamp(0.32 + (p.agentName ? 0.12 + (p.rel.agent ?? 50) / 400 : 0) + (p.fame ?? 0) / 300, 0.2, 0.8);
  if (rand(state) < pr) {
    const up = 1.15 + rand(state) * 0.15;
    o.weekly = roundPay((o.weekly ?? 0) * up);
    if (o.upfront) o.upfront = roundPay(o.upfront * up);
    if (o.bonus) o.bonus.per = roundPay(o.bonus.per * up);
    return { ok: true, won: true, text: `${o.brand} bumped it up ${Math.round((up - 1) * 100)}%.` };
  }
  if (rand(state) < 0.4) {
    N.offers = N.offers.filter((x) => x !== o);
    return { ok: true, won: false, walked: true, text: `${o.brand} walked away.` };
  }
  return { ok: true, won: false, text: `${o.brand} won't budge. The offer stands.` };
}

/** Hire an agent for deals (5% of every deal). */
export function hireNilAgent(state) {
  const p = state.player;
  if (p.agentName) return false;
  p.agentName = pick(state, AGENT_NAMES);
  p.rel.agent = 55;
  addNews(state, 'money', `${p.first} ${p.last} hires ${p.agentName} to handle ${isCollege(state) ? 'NIL deals' : 'endorsements'}.`);
  return true;
}

function earn(state, a) {
  const N = ensure(state);
  const y = state.career.year;
  N.earned[y] = (N.earned[y] ?? 0) + a;
}

/** After each game: performance clauses pay out. Returns [{ brand, amount, n, noun }]. */
export function nilAfterGame(state, userStats) {
  if (!dealsOpen(state) || !userStats) return [];
  const p = state.player;
  const out = [];
  for (const d of p.sponsors) {
    if (!d.bonus) continue;
    const n = Math.floor(userStats[d.bonus.key] ?? 0);
    if (n <= 0) continue;
    const amt = Math.min(n * d.bonus.per, Math.max(0, d.bonus.cap - d.bonus.paid));
    if (amt <= 0) continue;
    d.bonus.paid += amt;
    d.total = (d.total ?? 0) + amt;
    p.money += amt;
    earn(state, amt);
    out.push({ brand: d.brand, amount: amt, n, noun: d.bonus.noun });
  }
  return out;
}

/** Weekly pay bookkeeping (called from weeklyUpkeep before weeks tick down). */
export function trackWeeklyPay(state) {
  if (!dealsOpen(state)) return;
  for (const d of state.player.sponsors) { d.total = (d.total ?? 0) + d.weekly; earn(state, d.weekly); }
}

/** Leaving school (declaring for the draft / going pro): collective deals end; college NIL deals carry over 50%. */
export function nilLeaveCollege(state) {
  const p = state.player;
  const N = ensure(state);
  p.sponsors = p.sponsors.filter((d) => !d.collective);
  N.offers = [];
}

/** The collective's offer to keep you for another season (shown on the declare screen). */
export function retentionOffer(state) {
  if (!isCollege(state)) return 0;
  const V = nilValue(state);
  return roundPay(V * 0.45);
}

/** Total NIL / endorsement money: this year and all time. */
export function nilEarnings(state) {
  const N = ensure(state);
  const all = Object.values(N.earned).reduce((a, b) => a + b, 0);
  return { year: N.earned[state.career.year] ?? 0, all };
}
