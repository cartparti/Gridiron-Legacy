// Career over: legacy tier, Hall of Fame ceremony, career summary.
import { h } from '../dom.js';
import { POSITIONS } from '../../data/positions.js';
import { jersey, ratingChart } from '../components.js';
import { fmtMoney } from '../../core/util.js';
import { sfx } from '../../audio/sfx.js';
import { statLine } from './results.js';
import { icon } from '../icons.js';

const REASONS = {
  age: 'Father Time remains undefeated.',
  decline: 'Your body told you it was time.',
  unsigned: 'The phone stopped ringing.',
  choice: 'You walked away on your own terms.',
};

export function legacyScreen(app) {
  const st = app.state;
  const p = st.player;
  const L = st.legacy;
  const last = p.history[p.history.length - 1];
  const colors = last?.colors ?? ['#333', '#f4c430'];
  const hof = L.tier.id === 'hof';
  setTimeout(() => (hof ? sfx.touchdown() : sfx.cheer()), 300);
  const awardCounts = {};
  for (const a of p.awards) awardCounts[a.name] = (awardCounts[a.name] ?? 0) + 1;
  return h('div.screen',
    h('div.center', h('div.small.muted', REASONS[L.reason] ?? ''), h('h1', `${p.first} ${p.last}`), h('div.muted', `${POSITIONS[p.position].label} · ${p.history[0]?.year}–${last?.year}`)),
    h('div.card.center', { style: { borderColor: 'var(--accent)', borderWidth: '3px' } },
      hof ? h('div', { style: { fontSize: '2.6rem', color: 'var(--accent)' } }, icon('crown')) : null,
      h('div.tier', L.tier.label),
      h('p', L.tier.blurb),
      h('div.display', { style: { fontSize: '1.2rem' } }, `Legacy score ${L.score}`)),
    jersey(p, colors, 170),
    hof ? h('p.center.small', h('b', 'Your number is retired. Your jersey hangs in the rafters forever.')) : null,
    h('div.card', h('h3', 'Legacy Breakdown'), h('table.tbl', L.lines.map((l) => h('tr', h('td', l.label), h('td.num', `+${l.pts}`))))),
    h('div.card', h('h3', 'Pro Career'), h('div.bigstat', statLine(p.position, p.proCareerStats).map(([v, l]) => h('div', h('b', v), h('span', l)))),
      h('p.small.muted', { style: { marginTop: '8px' } }, `${p.proCareerStats.games} pro games · ${p.titles.filter((t) => t.stage === 'pro').length} titles · career earnings banked: ${fmtMoney(p.money)}`)),
    Object.keys(awardCounts).length ? h('div.card', h('h3', 'Trophy Case'), h('div.row.wrap', Object.entries(awardCounts).map(([n, c]) => h('span.chip.gold', icon('trophy'), `${c > 1 ? `${c}× ` : ''}${n}`)))) : null,
    h('div.card', h('h3', 'Overall by Season'), ratingChart(p.history)),
    h('button.btn.primary.block', { onclick: () => { app.ui.newCareer = true; app.state = null; app.go('slots'); } }, 'Start a New Career'),
    h('button.btn.block', { onclick: () => app.quitToTitle() }, 'Title Screen'));
}
