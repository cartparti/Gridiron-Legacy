// Offseason screens: training camp focus, college recruiting, early draft entry, draft night, free agency.
import { h } from '../dom.js';
import { STAT_KEYS, STAT_LABELS, POSITIONS } from '../../data/positions.js';
import { getTeam } from '../../sim/league.js';
import * as flow from '../../sim/flow.js';
import { fmtMoney, ordinal, signed } from '../../core/util.js';
import { teamBadge, stars, confirmDialog } from '../components.js';
import { sfx } from '../../audio/sfx.js';
import { eventModal } from './event.js';
import { topBar } from './hub.js';

export function campScreen(app) {
  const st = app.state;
  const p = st.player;
  if (st.phase === 'offseason_event') setTimeout(() => eventModal(app), 30);
  const w = POSITIONS[p.position].weights;
  const choose = (focus) => { sfx.levelUp(); flow.chooseCamp(st, focus); app.commit(); };
  return h('div', topBar(app), h('div.screen',
    h('h1', 'Offseason Camp'),
    h('p.muted', 'Pick one focus for the summer. A big boost to one rating, or rest to fully heal and recharge.'),
    st.lastEventResult && st.phase === 'camp' ? h('div.card.flat', h('div.small.muted', st.lastEventResult.title), h('p.small', st.lastEventResult.result)) : null,
    h('div.col', STAT_KEYS.map((k) => h('button.btn.block', { style: { justifyContent: 'space-between' }, onclick: () => choose(k) },
      h('span', `${STAT_LABELS[k]} camp`), h('span.small', `${Math.round(p.stats[k])} · ${Math.round(w[k] * 100)}% of OVR`))),
    h('button.btn.block.team', { onclick: () => choose('rest') }, `Rest & recover (health ${Math.round(p.health)} → 100)`)),
    flow.canRetire(st) ? h('button.btn.danger.block', {
      onclick: async () => { if (await confirmDialog('Retire?', 'Hang up the cleats and see your legacy. This ends your career.', 'Retire')) { flow.chooseCamp(st, 'retire'); app.commit(); } },
    }, 'Retire from football') : null));
}

export function recruitingScreen(app) {
  const st = app.state;
  const p = st.player;
  return h('div.screen',
    h('h1', 'Signing Day'),
    h('p.muted', `${p.first}, these programs want you. Prestige means a stronger team and more spotlight. Pick your school.`),
    st.offers.map((o) => h('div.card.offer', { style: { borderLeftColor: o.colors[0] } },
      h('div.row', teamBadge({ id: o.teamId, city: o.city, name: o.name, colors: o.colors }, 48),
        h('div.grow', h('h3', `${o.city} ${o.name}`), h('div', stars(o.prestige)), h('p.small.muted', `"${o.pitch}"`))),
      h('button.btn.primary.block', { style: { marginTop: '8px' }, onclick: () => { sfx.levelUp(); flow.chooseCollege(st, o.teamId); app.commit(); } }, `Commit to ${o.city}`))));
}

export function declareScreen(app) {
  const st = app.state;
  const p = st.player;
  return h('div.screen',
    h('h1', 'Declare Early?'),
    h('div.card',
      h('p', `Scouts project you as a ${p.ovr >= 76 ? 'first-round' : p.ovr >= 71 ? 'second or third-round' : 'mid-round'} pick right now (overall ${Math.round(p.ovr)}).`),
      h('p.small.muted', 'Leaving now starts your pro career and paycheck a year early. Staying gives you one more season to grow and win.')),
    h('button.btn.primary.block', { onclick: () => { sfx.select(); flow.declareForDraft(st, true); app.commit(); } }, 'Declare for the Draft'),
    h('button.btn.block', { onclick: () => { sfx.click(); flow.declareForDraft(st, false); app.commit(); } }, 'Return for Senior Season'));
}

export function draftScreen(app) {
  const st = app.state;
  const d = st.draft;
  const p = st.player;
  const team = getTeam(st.league, d.teamId);
  setTimeout(() => sfx.cheer(true), 300);
  return h('div.screen',
    h('h1', 'Draft Night'),
    h('div.card.center', { style: { borderColor: team.colors[0], borderWidth: '3px' } },
      teamBadge(team, 80),
      h('div.display', { style: { fontSize: '1.6rem', marginTop: '6px' } }, d.undrafted ? 'Undrafted' : `Round ${d.round} · Pick ${d.pick}`),
      h('h2', `${team.city} ${team.name}`),
      h('p', d.undrafted ? 'Nobody called your name. The phone rings at midnight: a tryout contract.' : `With the ${ordinal(d.pick)} pick, the ${team.name} select ${p.first} ${p.last}!`),
      h('p.small.muted', `Rookie contract: ${fmtMoney(d.salary)}/yr for ${p.contract.years} years`)),
    h('div.card.draft-board', h('h3', 'First Round'), h('div.list', d.board.map((x) => {
      const t = getTeam(st.league, x.team);
      return h(`div.li${x.user ? '.me' : ''}`, h('span.muted.small', { style: { width: '26px' } }, x.pick), teamBadge(t, 24), h('span.grow', x.name), h('span.chip', x.pos));
    }))),
    h('button.btn.primary.block', { onclick: () => { sfx.click(); flow.ackDraft(st); app.commit(); } }, 'Start Pro Career'));
}

export function contractScreen(app) {
  const st = app.state;
  const p = st.player;
  const value = flow.marketValue(st);
  return h('div.screen',
    h('h1', 'Free Agency'),
    h('div.card',
      h('p', `Your contract is up. Age ${p.age}, overall ${Math.round(p.ovr)}, fame ${Math.round(p.fame)}.`),
      h('p.small.muted', `Estimated market value: ${fmtMoney(value)}/yr. ${p.agentName ? `${p.agentName} is negotiating for you.` : 'No agent: you are leaving money on the table.'}`),
      h('p.tiny.muted', 'Teams can only offer what fits under their salary cap.')),
    st.offers.map((o, i) => h('div.card.offer', { style: { borderLeftColor: o.colors[0] } },
      h('div.row', teamBadge({ id: o.teamId, city: o.city, name: o.name, colors: o.colors }, 44),
        h('div.grow', h('h3', `${o.city} ${o.name}`, o.loyal ? ' · current team' : ''), h('div.small.muted', `Team strength ${o.contender} · Cap space ${fmtMoney(o.capSpace)}`))),
      h('div.bigstat', { style: { marginTop: '8px' } },
        h('div', h('b', fmtMoney(o.salary)), h('span', 'Per year')),
        h('div', h('b', o.years), h('span', 'Years')),
        h('div', h('b', fmtMoney(o.salary * o.years)), h('span', 'Total'))),
      o.prove ? h('p.tiny.warn', 'Prove-it deal: the only offer on the table.') : null,
      h('button.btn.primary.block', { style: { marginTop: '8px' }, onclick: () => { sfx.cash(); flow.signContract(st, i); app.commit(); } }, 'Sign'))),
    flow.canRetire(st) ? h('button.btn.danger.block', { onclick: async () => { if (await confirmDialog('Retire?', 'Walk away and see your legacy.', 'Retire')) { flow.retire(st, 'choice'); app.commit(); } } }, 'Retire instead') : null);
}

export { signed };
