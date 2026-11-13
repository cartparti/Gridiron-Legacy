// Legacy score: turns a career into Journeyman / Solid Starter / Star / Hall of Fame.
import { LEGACY_TIERS, DIFFICULTIES } from '../data/config.js';

const AWARD_POINTS = {
  'Most Valuable Player': 32,
  'Offensive Player of the Year': 16,
  'Defensive Player of the Year': 16,
  'All-League': 9,
  'Rookie of the Year': 7,
  'Comeback Player of the Year': 5,
  'Legacy Bowl Champion': 22,
  'Legacy Bowl MVP': 12,
  'Ironstone Trophy': 10,
  'Heritage Bowl Champion': 4,
  'All-Conference': 2,
  'Freshman of the Year': 2,
  'State Player of the Year': 2,
  'All-State': 1,
  'State Champion': 1,
};

export function computeLegacy(state) {
  const p = state.player;
  const lines = [];
  const add = (label, pts) => { if (pts) lines.push({ label, pts: Math.round(pts) }); };
  const proSeasons = p.history.filter((h) => h.stage === 'pro').length;
  add(`${proSeasons} pro season${proSeasons === 1 ? '' : 's'}`, proSeasons * 2.5);
  const counts = {};
  for (const a of p.awards) counts[a.name] = (counts[a.name] ?? 0) + 1;
  for (const [name, n] of Object.entries(counts)) add(`${n}× ${name}`, (AWARD_POINTS[name] ?? 1) * n);
  add(`${p.records.length} record${p.records.length === 1 ? '' : 's'} broken`, p.records.length * 8);
  // production from each pro season's rating (position-neutral: a great DT season counts like a great QB season)
  const prod = p.history.filter((h) => h.stage === 'pro').reduce((a, h) => a + Math.max(0, (h.perf ?? 50) - 45) * 0.5 * Math.min(1, (h.seasonStats?.games ?? 17) / 12), 0);
  add('Career production', prod);
  const peak = Math.max(0, ...p.history.map((h) => h.ovr));
  // relative to what's typical at the position (QBs rate higher, RBs peak lower and shorter)
  const POS_PEAK = { QB: 77.5, RB: 70, WR: 75, CB: 75, DT: 75, MS: 75, K: 75 };
  add(`Peak overall ${Math.round(peak)}`, Math.max(0, peak - (POS_PEAK[p.position] ?? 75)) * 2);
  add('Fame', p.fame / 4);
  let score = lines.reduce((a, l) => a + l.pts, 0);
  const diff = DIFFICULTIES[state.difficulty ?? 'normal'];
  if (diff.legacy !== 1) {
    const bonus = Math.round(score * (diff.legacy - 1));
    lines.push({ label: `${diff.label} difficulty`, pts: bonus });
    score += bonus;
  }
  let tier = LEGACY_TIERS[0];
  for (const t of LEGACY_TIERS) if (score >= t.min) tier = t;
  // The Hall needs longevity, not just a hot streak.
  if (tier.id === 'hof' && proSeasons < 6) tier = LEGACY_TIERS[2];
  return { score: Math.round(score), tier, lines: lines.sort((a, b) => b.pts - a.pts) };
}
