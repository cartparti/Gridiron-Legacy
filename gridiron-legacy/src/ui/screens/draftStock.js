// Career > Draft Stock: where the pro scouts have you, live during college (and your draft recap once you're a pro).
import { h } from '../dom.js';
import { fmtMoney } from '../../core/util.js';
import { STAGES } from '../../data/config.js';
import { statLabel, POSITIONS } from '../../data/positions.js';
import { getTeam } from '../../sim/league.js';
import { PRO_TEAMS } from '../../data/teams.js';
import { teamBadge } from '../components.js';
import * as flow from '../../sim/flow.js';

const pct = (x) => `${Math.round(x * 100)}%`;
const letter = (v) => (v >= 90 ? 'A+' : v >= 84 ? 'A' : v >= 78 ? 'B+' : v >= 72 ? 'B' : v >= 66 ? 'C+' : v >= 60 ? 'C' : v >= 52 ? 'D' : 'F');

/** Is the tab shown? College always, pros once they have a draft to look back on. */
export const draftTabOpen = (st) => st.career.stage === 'college' || (st.career.stage === 'pro' && !!st.draft);

function trendChart(points) {
  if (points.length < 2) return h('p.tiny.muted', 'Your trend line starts after a couple of weeks.');
  const W = 300, H = 90, pad = 6;
  const maxPick = 150;
  const xs = (i) => pad + (i / (points.length - 1)) * (W - pad * 2);
  const ys = (pk) => pad + (Math.min(maxPick, pk) / maxPick) * (H - pad * 2); // top = pick 1
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)} ${ys(p.median).toFixed(1)}`).join(' ');
  const grid = [20, 60, 100, 140].map((pk) => `<line x1="0" x2="${W}" y1="${ys(pk)}" y2="${ys(pk)}" stroke="currentColor" stroke-opacity="0.12"/><text x="${W - 2}" y="${ys(pk) - 2}" font-size="8" text-anchor="end" fill="currentColor" fill-opacity="0.5">${pk === 20 ? 'Rd 1' : pk === 60 ? 'Rd 3' : pk === 100 ? 'Rd 5' : 'Rd 7'}</text>`).join('');
  const seasons = [];
  points.forEach((p, i) => { if (i && p.season !== points[i - 1].season) seasons.push(`<line x1="${xs(i)}" x2="${xs(i)}" y1="0" y2="${H}" stroke="currentColor" stroke-opacity="0.25" stroke-dasharray="3 3"/>`); });
  const last = points[points.length - 1];
  const svg = `<svg viewBox="0 0 ${W} ${H}" class="ds-chart" role="img" aria-label="Projected pick by week">${grid}${seasons.join('')}<path d="${d}" fill="none" stroke="var(--accent, #ffd43b)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${xs(points.length - 1)}" cy="${ys(last.median)}" r="4" fill="var(--accent, #ffd43b)"/></svg>`;
  const el = h('div');
  el.innerHTML = svg;
  return el;
}

function proRecap(st) {
  const d = st.draft;
  const team = getTeam(st.league, d.teamId) ?? PRO_TEAMS.find((t) => t.id === d.teamId);
  return h('div.col', { style: { gap: '14px' } },
    h('div.card.hero',
      h('div.card-title', h('h2', 'Your Draft'), h('span.chip.pix', d.early ? 'LEFT EARLY' : 'SENIOR')),
      h('div.row', { style: { gap: '12px', alignItems: 'center' } }, team ? teamBadge(team, 56) : null,
        h('div', h('div.display', { style: { fontSize: '1.4rem' } }, d.undrafted ? 'Undrafted' : `Round ${d.round} · Pick ${d.pick}`), team ? h('div.small.muted', `${team.city} ${team.name}`) : null)),
      d.proj ? h('p.small', { style: { marginTop: '8px' } }, `Mock drafts had you at ${d.proj.label.toLowerCase()} (around pick ${d.proj.median}). ${d.undrafted ? '' : d.pick < d.proj.median - 8 ? 'You went higher than expected.' : d.pick > d.proj.median + 8 ? 'You slid a bit on draft night.' : 'Right where the scouts said.'}`) : null,
      h('p.small', `Rookie deal: ${fmtMoney(d.salary)}/yr.`)));
}

export function draftStockPage(app) {
  const st = app.state;
  const p = st.player;
  if (st.career.stage === 'pro') return st.draft ? proRecap(st) : h('p.muted', 'No draft on record.');
  if (st.career.stage !== 'college') return h('div.card', h('h3', 'Draft Stock'), h('p.small.muted', 'Pro scouts start tracking you in college.'));
  const pr = flow.liveDraftProjection(st);
  const ds = pr.stock;
  const yr = st.career.stageSeason;
  const final = yr >= STAGES.college.seasons;
  const W = (st.draftWatch ?? []).filter((x) => x.year >= st.career.year - 3);
  const prev = W.length >= 2 ? W[W.length - 2] : null;
  const move = prev ? prev.median - pr.median : 0; // positive = moving up
  const posName = POSITIONS[p.position]?.label ?? p.position;
  // scouting grades on each rating
  const stats = Object.entries(p.stats ?? {}).filter(([k]) => ['speed', 'strength', 'skill', 'iq'].includes(k));
  // what moves your stock
  const factor = (label, val, good, ok, hint) => ({ label, val, cls: val >= good ? 'good' : val >= ok ? '' : 'bad', hint });
  const factors = [
    factor('Overall rating', Math.round(p.ovr), 78, 70, `OVR ${Math.round(p.ovr)}`),
    factor(ds.live ? 'This season so far' : 'Last season', ds.last, 70, 60, `rating ${ds.last}`),
    factor('College career', ds.perf, 68, 58, `avg rating ${ds.perf}`),
    factor('Awards', ds.awards, 2, 1, `${ds.awards} in college`),
    factor('Fame', Math.round(p.fame), 55, 30, `${Math.round(p.fame)}`),
  ];
  const tips = [];
  if (ds.last < 66) tips.push('A big season moves you up the most: scouts weigh your latest season heaviest.');
  if (p.ovr < 76) tips.push('Raise your overall: training, drills and skill points.');
  if (!ds.awards) tips.push('Win an award: All-Conference and Player of the Year honors jump you up boards.');
  if (p.fame < 40) tips.push('Get your name out there: big games, rivalry wins and social posts build fame.');
  if (p.position === 'K') tips.push('Kickers rarely go early. Being automatic still lifts you a round or two.');
  if (!tips.length) tips.push('Keep doing what you\'re doing. Stay healthy and don\'t give teams a reason to doubt you.');
  const scouts = Math.max(1, Math.round((150 - Math.min(150, pr.median)) / 12));
  return h('div.col', { style: { gap: '14px' } },
    h('div.card.hero',
      h('div.card-title', h('h2', 'Draft Stock'), h('span.chip.pix', pr.label.toUpperCase())),
      h('div.bigstat',
        h('div', h('b', pr.round ? `#${pr.median}` : '—'), h('span', 'Projected pick')),
        h('div', h('b', `#${pr.posRank}`), h('span', `${posName} prospect`)),
        h('div', h('b', { class: move > 3 ? 'good' : move < -3 ? 'bad' : '' }, prev ? (move > 3 ? `▲ ${move}` : move < -3 ? `▼ ${-move}` : '—') : '—'), h('span', 'Since last week'))),
      h('div.bigstat', { style: { marginTop: '8px' } },
        h('div', h('b', pct(pr.pRound1)), h('span', 'Round 1 chance')),
        h('div', h('b', pct(pr.pUndrafted)), h('span', 'Undrafted chance')),
        h('div', h('b', fmtMoney(pr.salary)), h('span', 'Rookie deal/yr'))),
      h('p.tiny.muted', { style: { marginTop: '8px' } }, `Likely range: ${pr.round ? `picks ${pr.lo}-${Math.min(pr.hi, 140)}` : 'late rounds to undrafted'}. About ${scouts} pro scout${scouts === 1 ? '' : 's'} watched your last game.`)),
    h('div.card',
      h('div.card-title', h('h3', 'When can you go pro?'), h('span.chip.pix', `COLLEGE YEAR ${yr}/${STAGES.college.seasons}`)),
      h('p.small', final
        ? 'This is your final college season. You enter the draft when it ends.'
        : `You can declare for the draft when this season ends (after year ${yr}). You'll see a full scouting report and mock draft then and choose to go pro or stay.`),
      !final && pr.early ? h('p.tiny.muted', 'Leaving early costs you a little with scouts (less tape), but a great season makes up for it.') : null),
    h('div.card',
      h('h3', 'Trend'),
      trendChart(W.map((x) => ({ median: x.median, season: x.season }))),
      h('p.tiny.muted', 'Projected pick each week (higher on the chart = earlier pick). Dashed lines mark new seasons.')),
    h('div.card',
      h('h3', 'What scouts weigh'),
      h('div.list', factors.map((f) => h('div.li', h('span.grow', f.label), h(`span.small${f.cls ? `.${f.cls}` : ''}`, f.hint)))),
      h('div.tiny.pix.muted', { style: { marginTop: '10px' } }, 'SCOUTING GRADES'),
      h('div.ds-grades', stats.map(([k, v]) => h('div', h('b', letter(v)), h('span', statLabel(k, p.position))))),
      h('div.tiny.pix.muted', { style: { marginTop: '10px' } }, 'HOW TO MOVE UP'),
      h('ul.small', tips.map((t) => h('li', t)))));
}
