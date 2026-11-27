// Signature shoe: a brand builds a shoe around you. Design it (colors, sole, pattern, cut, name), wear it in games,
// earn royalties every week, and drop a new edition every season. Pure sim; no save-RNG use (stable hashes only).
import { clamp } from '../core/util.js';
import { addNews } from './press.js';
import { logJournal } from './journal.js';

export const SHOE_BRANDS = ['Strideline', 'Apex Athletics', 'Vanta', 'Kinetix', 'Northpeak', 'Volt Supply'];
export const SHOE_COLORS = ['#16181c', '#f2f2f2', '#d33a2c', '#2f6fd6', '#f2c12e', '#2fb35a', '#f27a1a', '#d640a0', '#8a8f98', '#d4af37', '#c9ced6', '#39ff14', '#7b2ff7', '#00c2d1', '#ff4fa3'];
export const SHOE_SOLES = [{ id: 'white', label: 'White', color: '#f4f4f4' }, { id: 'black', label: 'Black', color: '#141518' }, { id: 'gum', label: 'Gum', color: '#b77a3a' }, { id: 'icy', label: 'Icy', color: '#bfe3f2' }, { id: 'gold', label: 'Gold', color: '#d4af37' }];
export const SHOE_PATTERNS = [{ id: 'sig', label: 'Signature swoosh' }, { id: 'stripe', label: 'Stripe' }, { id: 'twotone', label: 'Two-tone' }, { id: 'heel', label: 'Heel cap' }, { id: 'flames', label: 'Flames' }, { id: 'bolt', label: 'Lightning' }, { id: 'speckle', label: 'Speckle' }, { id: 'checker', label: 'Checker' }];
export const SHOE_CUTS = [{ id: 'low', label: 'Low' }, { id: 'mid', label: 'Mid' }, { id: 'high', label: 'High top' }];

const hash = (s) => { let x = 7; for (const ch of String(s)) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return x; };
const rgb = (c) => { const v = parseInt(c.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
const cdist = (a, b) => { const A = rgb(a), B = rgb(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]) / 441; };

export const shoeOf = (state) => state.shoe ?? null;
export function shoeEligible(state) {
  const p = state.player, st = state.career.stage;
  return (st === 'pro' && p.fame >= 55) || (st === 'college' && p.fame >= 75);
}

/** beginWeek: a brand comes calling (once you're famous enough; a declined offer comes back next season). */
export function shoeOfferCheck(state) {
  if (state.shoe?.status === 'active' || state.shoe?.status === 'offer') return null;
  if (state.shoe?.declined === state.career.year || !shoeEligible(state)) return null;
  const p = state.player, pro = state.career.stage === 'pro';
  const brand = SHOE_BRANDS[hash(p.first + p.last) % SHOE_BRANDS.length];
  state.shoe = { status: 'offer', brand, year: state.career.year, upfront: pro ? Math.round((250000 + p.fame * 9000) / 10000) * 10000 : Math.round((30000 + p.fame * 600) / 1000) * 1000, royalty: pro ? 0.06 : 0.03 };
  addNews(state, 'money', `${brand} wants to build a signature shoe around ${p.first} ${p.last}.`);
  return state.shoe;
}

export function declineShoe(state) {
  if (state.shoe?.status !== 'offer') return null;
  state.shoe = { status: 'none', declined: state.career.year };
  return true;
}

export function acceptShoe(state) {
  const s = state.shoe, p = state.player;
  if (s?.status !== 'offer') return null;
  p.money += s.upfront;
  const team = state.league?.teams?.find((t) => t.id === state.career.teamId);
  const initials = `${p.first[0]}${p.last[0]}`.toUpperCase();
  state.shoe = {
    status: 'active', brand: s.brand, royalty: s.royalty, since: state.career.year, edition: 1, designed: false, wear: true,
    name: `${s.brand.split(' ')[0]} ${initials} ${p.number ?? 1}`,
    design: { base: team?.colors?.[0] ?? '#16181c', accent: team?.colors?.[1] ?? '#f2f2f2', sole: 'white', pattern: 'sig', cut: 'mid', logo: initials },
    sold: 0, earned: s.upfront, editions: [],
  };
  p.fame = clamp(p.fame + 3, 0, 100);
  logJournal(state, 'contract', `Signed a signature shoe deal with ${s.brand}.`, { big: true });
  return state.shoe;
}

/** Critics score 1-10: contrast that reads from the stands, a sole that fits, a bold pattern, team colors. */
export function designScore(state, d) {
  const team = state.league?.teams?.find((t) => t.id === state.career.teamId);
  const sole = SHOE_SOLES.find((x) => x.id === d.sole)?.color ?? '#f4f4f4';
  const contrast = cdist(d.base, d.accent); // 0..1
  let score = 4 + Math.min(1, contrast / 0.55) * 3;
  if (cdist(sole, d.base) > 0.25) score += 0.8;
  if (['sig', 'flames', 'bolt', 'speckle'].includes(d.pattern)) score += 0.7;
  if (team && (cdist(d.base, team.colors[0]) < 0.12 || cdist(d.accent, team.colors[0]) < 0.12)) score += 0.8; // fans want team colors
  if (d.cut === 'mid') score += 0.3;
  score += ((hash(`${d.base}${d.accent}${d.pattern}`) % 7) - 3) * 0.12; // taste varies a little
  return Math.round(clamp(score, 1, 10) * 10) / 10;
}

const cleanName = (n) => String(n ?? '').replace(/[^\p{L}\p{N} '.&-]/gu, '').trim().slice(0, 22);

/** Save a design (and release this season's edition the first time). Also puts them on your feet if you wear them. */
export function designShoe(state, design, name) {
  const s = state.shoe, p = state.player;
  if (s?.status !== 'active') return null;
  const d = { ...s.design, ...design };
  if (!SHOE_PATTERNS.some((x) => x.id === d.pattern)) d.pattern = 'sig';
  if (!SHOE_CUTS.some((x) => x.id === d.cut)) d.cut = 'mid';
  if (!SHOE_SOLES.some((x) => x.id === d.sole)) d.sole = 'white';
  s.design = d;
  const nm = cleanName(name);
  if (nm) s.name = nm;
  s.score = designScore(state, d);
  const first = !s.designed;
  s.designed = true;
  if (first || s.releasedYear !== state.career.year) {
    s.releasedYear = state.career.year;
    s.editions.push({ year: state.career.year, edition: s.edition, name: s.name, design: { ...d }, score: s.score });
    addNews(state, 'money', `The ${s.name} drops today. Critics give it ${s.score}/10.`);
    if (first) logJournal(state, 'contract', `Released your first signature shoe, the ${s.name}.`, { big: true });
  }
  if (s.wear) applyShoeLook(p, s);
  return s;
}

/** Your in-game cleats use the design. */
export function applyShoeLook(p, s) {
  if (!p.look || !s?.design) return;
  p.look.cleats = s.design.base;
  p.look.cleatAccent = s.design.accent;
  p.look.cleatDesign = s.design.pattern;
  p.look.cleatCut = s.design.cut;
  p.look.cleatSole = SHOE_SOLES.find((x) => x.id === s.design.sole)?.color ?? null;
}
export function setWearShoe(state, on) {
  const s = state.shoe;
  if (s?.status !== 'active') return null;
  s.wear = !!on;
  if (on) applyShoeLook(state.player, s);
  return s.wear;
}

/** Weekly sales: units depend on fame, the design's score, winning and how new the edition is. */
export function shoeWeekly(state) {
  const s = state.shoe, p = state.player;
  if (s?.status !== 'active' || !s.designed) return null;
  const team = state.league?.teams?.find((t) => t.id === state.career.teamId);
  const pro = state.career.stage === 'pro';
  const winK = team ? 1 + ((team.w - team.l) / Math.max(1, team.w + team.l)) * 0.3 : 1;
  const fresh = s.releasedYear === state.career.year ? 1.15 : 0.8;
  const units = Math.round((pro ? 900 : 180) * (0.4 + p.fame / 80) * (0.5 + (s.score ?? 5) / 10) * winK * fresh);
  const price = pro ? 160 : 120;
  const pay = Math.round(units * price * s.royalty);
  s.sold += units;
  s.earned += pay;
  s.lastWeek = { units, pay };
  p.money += pay;
  return { units, pay };
}

/** endSeason: a sales report and a new edition to design next season. */
export function shoeSeasonEnd(state) {
  const s = state.shoe;
  if (s?.status !== 'active' || !s.designed) return null;
  const report = { name: s.name, edition: s.edition, sold: s.sold, earned: s.earned, score: s.score };
  s.edition += 1;
  return report;
}
