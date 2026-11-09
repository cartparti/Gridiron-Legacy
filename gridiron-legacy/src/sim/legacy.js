// Legacy score: turns a career into Journeyman / Solid Starter / Star / Hall of Fame.
import { LEGACY_TIERS } from '../data/config.js';

const AWARD_POINTS = {
  'Most Valuable Player': 32,
  'Offensive Player of the Year': 16,
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
  const s = p.proCareerStats;
  const yards = s.passYds / 3 + s.rushYds + s.recYds;
  const tds = s.passTD * 0.6 + s.rushTD + s.recTD;
  add('Career production', yards / 500 + tds * 0.4);
  const peak = Math.max(0, ...p.history.map((h) => h.ovr));
  add(`Peak overall ${Math.round(peak)}`, Math.max(0, peak - 75) * 2);
  add('Fame', p.fame / 4);
  const score = lines.reduce((a, l) => a + l.pts, 0);
  let tier = LEGACY_TIERS[0];
  for (const t of LEGACY_TIERS) if (score >= t.min) tier = t;
  // The Hall needs longevity, not just a hot streak.
  if (tier.id === 'hof' && proSeasons < 6) tier = LEGACY_TIERS[2];
  return { score: Math.round(score), tier, lines: lines.sort((a, b) => b.pts - a.pts) };
}
