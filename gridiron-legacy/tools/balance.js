#!/usr/bin/env node
// Balance report: simulates many full careers with different strategies and prints
// win rates, career length, legacy tiers and more, so we can spot broken numbers.
//
// Usage: node tools/balance.js [careersPerStrategy=60] [skill=0.5]
import { simulateCareer, randomCareerOpts, STRATEGIES } from '../src/sim/bot.js';
import { seasonPerf } from '../src/sim/awards.js';

const N = Number(process.argv[2] ?? 60);
const SKILL = Number(process.argv[3] ?? 0.5);

const pct = (n, d) => `${((100 * n) / Math.max(1, d)).toFixed(1)}%`;
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const fmtM = (n) => `$${(n / 1e6).toFixed(1)}M`;

console.log(`Gridiron Legacy balance report — ${N} careers per strategy, human skill ${SKILL}\n`);
const started = Date.now();
const rows = [];
for (const [key, strat] of Object.entries(STRATEGIES)) {
  const tiers = {};
  const peak = [];
  const proSeasons = [];
  const winPct = [];
  const money = [];
  const legacy = [];
  const reasons = {};
  const awards = {};
  const perfByPos = { QB: [], RB: [], WR: [], CB: [] };
  let seasons = 0;
  let titles = 0;
  let undrafted = 0;
  const draftPicks = [];
  const perGame = { QB: [], RB: [], WR: [], CB: [] };
  const perGameTD = { QB: [], RB: [], WR: [], CB: [] };
  for (let i = 0; i < N; i++) {
    const seed = 1000 + i * 7919 + key.length * 104729;
    const st = simulateCareer(randomCareerOpts(seed), strat, SKILL);
    const p = st.player;
    tiers[st.legacy.tier.label] = (tiers[st.legacy.tier.label] ?? 0) + 1;
    reasons[st.legacy.reason] = (reasons[st.legacy.reason] ?? 0) + 1;
    peak.push(Math.max(...p.history.map((h) => h.ovr)));
    const pro = p.history.filter((h) => h.stage === 'pro');
    proSeasons.push(pro.length);
    for (const h of p.history) {
      const [w, l] = h.record.split('-').map(Number);
      winPct.push(w / Math.max(1, w + l));
      if (h.stage === 'pro') perfByPos[p.position].push(seasonPerf(p.position, h.seasonStats));
    }
    seasons += p.history.length;
    titles += p.titles.length;
    money.push(p.money);
    legacy.push(st.legacy.score);
    for (const a of p.awards) awards[a.name] = (awards[a.name] ?? 0) + 1;
    if (p.draft?.undrafted) undrafted++;
    else if (p.draft) draftPicks.push(p.draft.pick);
    const g = Math.max(1, p.proCareerStats.games);
    const s = p.proCareerStats;
    perGame[p.position].push(p.position === 'QB' ? s.passYds / g : p.position === 'RB' ? s.rushYds / g : p.position === 'CB' ? s.pd / g : s.recYds / g);
    perGameTD[p.position].push(p.position === 'CB' ? s.defInt / g : (s.passTD + s.rushTD + s.recTD) / g);
  }
  rows.push({ perGame, perGameTD, key, tiers, peak, proSeasons, winPct, money, legacy, reasons, awards, seasons, titles, perfByPos, undrafted, draftPicks });
}

for (const r of rows) {
  console.log(`== ${STRATEGIES[r.key].name} ==`);
  console.log(`  Legacy tiers: ${['Journeyman', 'Solid Starter', 'Star of Your Era', 'Hall of Fame'].map((t) => `${t} ${pct(r.tiers[t] ?? 0, N)}`).join(' | ')}`);
  console.log(`  Avg legacy score ${mean(r.legacy).toFixed(0)}, peak OVR ${mean(r.peak).toFixed(1)} (max ${Math.max(...r.peak).toFixed(1)}), pro seasons ${mean(r.proSeasons).toFixed(1)}`);
  console.log(`  Team win% ${(mean(r.winPct) * 100).toFixed(1)}, titles per career ${(r.titles / N).toFixed(2)}, final bank ${fmtM(mean(r.money))}`);
  console.log(`  Draft: avg pick ${mean(r.draftPicks).toFixed(0)}, undrafted ${pct(r.undrafted, N)}`);
  console.log(`  Pro season perf: ${Object.entries(r.perfByPos).map(([k, v]) => `${k} ${mean(v).toFixed(1)}`).join(', ')}`);
  console.log(`  Pro yards/game (CB: PD/game): ${Object.entries(r.perGame).map(([k, v]) => `${k} ${mean(v).toFixed(0)}`).join(', ')}; TD/game (CB: INT/game): ${Object.entries(r.perGameTD).map(([k, v]) => `${k} ${mean(v).toFixed(2)}`).join(', ')}`);
  console.log(`  Retirement: ${Object.entries(r.reasons).map(([k, v]) => `${k} ${pct(v, N)}`).join(', ')}`);
  const top = Object.entries(r.awards).sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log(`  Awards per career: ${top.map(([k, v]) => `${k} ${(v / N).toFixed(2)}`).join(', ')}\n`);
}
console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
