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
import { draftCutscene } from '../../scenes/cutscenes.js';
import { openModal, closeAllModals } from '../components.js';
import { recruitStars, visitSchool, answerInterview, projection } from '../../sim/career.js';

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
    h('button.btn.block.team', { onclick: () => choose('rest') }, `Rest and recover (health ${Math.round(p.health)} → 100)`)),
    flow.canRetire(st) ? h('button.btn.danger.block', {
      onclick: async () => { if (await confirmDialog('Retire?', 'Hang up the cleats and see your legacy. This ends your career.', 'Retire')) { flow.chooseCamp(st, 'retire'); app.commit(); } },
    }, 'Retire from football') : null));
}

export function recruitingScreen(app) {
  const st = app.state;
  const p = st.player;
  const starsN = recruitStars(st);
  const visitsLeft = Math.max(0, 2 - (st.visits ?? 0));
  return h('div.screen',
    h('h1', 'Recruiting'),
    h('div.card.recruit-head',
      h('div.recruit-stars', '★'.repeat(starsN), h('span.dim', '★'.repeat(5 - starsN))),
      h('div', h('b', `${starsN}-star ${p.position} recruit`), h('p.small.muted', `${st.offers.length} programs offered you a scholarship. You can take ${visitsLeft} more official visit${visitsLeft === 1 ? '' : 's'}: a visit shows whether you would start there.`))),
    st.offers.map((o) => h('div.card.offer', { style: { borderLeftColor: o.colors[0] } },
      h('div.row', teamBadge({ id: o.teamId, city: o.city, name: o.name, colors: o.colors }, 48),
        h('div.grow', h('h3', `${o.city} ${o.name}`), h('div.row', { style: { gap: '8px' } }, stars(o.prestige), o.conf ? h('span.tiny.muted', `${o.conf} Conf.`) : null), h('p.small.muted', `"${o.pitch}"`))),
      o.visit ? h('div.visit-box',
        h('div.row.between', h('b', o.visit.start), h('span.chip', o.visit.edge <= 0 ? 'STARTER' : o.visit.edge <= 3 ? 'COMPETE' : 'BACKUP')),
        h('p.tiny.muted', `Starter at ${p.position} now: ${o.visit.incumbent}. ${o.visit.vibe}`)) : null,
      h('div.row', { style: { gap: '8px', marginTop: '8px' } },
        !o.visit ? h('button.btn.grow', { disabled: !visitsLeft, onclick: () => { sfx.click(); visitSchool(st, o.teamId); app.save(); app.render(); } }, visitsLeft ? 'Official visit' : 'No visits left') : null,
        h('button.btn.primary.grow', { onclick: () => signingDay(app, o) }, 'Commit')))));
}

/** Signing day: the hat on the table, the family watching, then you're in. */
function signingDay(app, o) {
  const st = app.state;
  const p = st.player;
  sfx.levelUp();
  openModal(h('div.signing',
    h('div.kicker', 'SIGNING DAY'),
    h('div.signing-hat', { style: { background: `linear-gradient(160deg, ${o.colors[0]}, ${o.colors[1] ?? o.colors[0]})` } }, teamBadge({ id: o.teamId, city: o.city, name: o.name, colors: o.colors }, 64)),
    h('h2', `${p.first} ${p.last} is going to ${o.city}!`),
    h('p.small.muted', `The gym erupts as you put on the ${o.name} hat. Your family is in the front row. ${o.visit ? o.visit.start + '.' : ''}`),
    h('button.btn.primary.block', { onclick: () => { closeAllModals(); flow.chooseCollege(st, o.teamId); app.commit(); } }, 'Sign the letter')));
}

/** The pre-draft combine: testing numbers, one interview question, then draft night. */
export function combineScreen(app) {
  const st = app.state;
  const p = st.player;
  const c = st.combine;
  const ds = flow.draftStock(st);
  const proj = projection(ds.value + (c.bonus ?? 0));
  const iv = c.interview;
  return h('div.screen',
    h('h1', 'The Combine'),
    h('p.muted', 'Every scout in the league is here. Your numbers and your interview move your draft stock.'),
    h('div.card', h('h3', 'Testing'),
      h('div.bigstat',
        h('div', h('b', `${c.forty}s`), h('span', '40-yard dash')),
        h('div', h('b', c.bench), h('span', 'Bench reps')),
        h('div', h('b', `${c.vert}"`), h('span', 'Vertical')),
        h('div', h('b', c.drill), h('span', `${p.position} drills`)))),
    h('div.card', h('h3', 'Team Interview'), h('p', iv.q),
      c.answer === null
        ? h('div.col', { style: { gap: '8px' } }, iv.a.map((a, i) => h('button.btn.block.left', { onclick: () => { sfx.click(); answerInterview(st, i); app.save(); app.render(); } }, a.t)))
        : h('p.small', h('b', iv.a[c.answer].t), h('br'), h('span.muted', iv.a[c.answer].note))),
    h('div.card.center', h('div.small.muted', 'Scouts project you'), h('div.display', { style: { fontSize: '1.4rem' } }, proj),
      h('p.tiny.muted', `College production ${ds.perf} · ${ds.awards} award${ds.awards === 1 ? '' : 's'}`)),
    h('button.btn.primary.block', { disabled: c.answer === null, onclick: () => { sfx.select(); flow.finishCombine(st); app.commit(); } }, c.answer === null ? 'Answer the interview first' : 'On to Draft Night'));
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
  if (!d.undrafted && !d.cutPlayed && !app.settings.reducedMotion) {
    d.cutPlayed = true;
    app.save();
    setTimeout(() => draftCutscene({ colors: team.colors, teamName: `${team.city} ${team.name}`, look: p.look, number: p.number,
      pickText: `With pick #${d.pick} in round ${d.round}...`, playerName: `${p.first} ${p.last}`, sub: `${p.position} · ${team.name}` }), 50);
  }
  return h('div.screen',
    h('h1', 'Draft Night'),
    h('div.card.center', { style: { borderColor: team.colors[0], borderWidth: '3px' } },
      teamBadge(team, 80),
      h('div.display', { style: { fontSize: '1.6rem', marginTop: '6px' } }, d.undrafted ? 'Undrafted' : `Round ${d.round} · Pick ${d.pick}`),
      h('h2', `${team.city} ${team.name}`),
      h('p', d.undrafted ? 'Nobody called your name. The phone rings at midnight: a tryout contract.' : `With the ${ordinal(d.pick)} pick, the ${team.name} select ${p.first} ${p.last}!`),
      h('p.small.muted', `Rookie contract: ${fmtMoney(d.salary)}/yr for ${p.contract.years} years`),
      d.reason ? h('p.small', { style: { marginTop: '8px' } }, d.reason) : null,
      d.stock ? h('p.tiny.muted', `Your college résumé: season rating ${d.stock.perf} average, ${d.stock.awards} award${d.stock.awards === 1 ? '' : 's'}.`) : null),
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
