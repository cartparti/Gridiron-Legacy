// Offseason screens: training camp focus, college recruiting, early draft entry, draft night, free agency.
import { h } from '../dom.js';
import { STAT_KEYS, STAT_LABELS, POSITIONS, statLabel } from '../../data/positions.js';
import { getTeam } from '../../sim/league.js';
import * as flow from '../../sim/flow.js';
import { fmtMoney, ordinal, signed } from '../../core/util.js';
import { teamBadge, stars, confirmDialog } from '../components.js';
import { sfx } from '../../audio/sfx.js';
import { eventModal } from './event.js';
import { topBar } from './hub.js';
import { runSetCutscene } from '../../scenes/director.js';
import { commitScene, draftNightScene } from '../../scenes/sets.js';
import { teamKits, kitUniform } from '../../data/kits.js';
import { COLLEGE_TEAMS } from '../../data/teams.js';
import { crestURL } from '../crest.js';
import { people } from '../../sim/social.js';
import { openModal, closeAllModals } from '../components.js';
import { recruitStars, visitSchool, answerInterview, projection } from '../../sim/career.js';
import { statLine } from './results.js';
import { STAGES } from '../../data/config.js';

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
      h('span', `${statLabel(k, p.position)} camp`), h('span.small', `${Math.round(p.stats[k])} · ${Math.round(w[k] * 100)}% of OVR`))),
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
async function signingDay(app, o) {
  const st = app.state;
  const p = st.player;
  if (signingDay.busy) return;
  signingDay.busy = true;
  // the ceremony: hats from your top 3 schools on the table (the one you picked + your two best other offers)
  if (!app.settings.reducedMotion) {
    try {
      const others = st.offers.filter((x) => x.teamId !== o.teamId).sort((a, b) => b.prestige - a.prestige).slice(0, 2);
      const list = [o, ...others];
      // shuffle the table order so the chosen hat isn't always in the same spot
      const order = list.map((x, i) => [x, (x.teamId.charCodeAt(0) * 7 + i * 13 + (p.last ?? '').length) % 11]).sort((a, b) => a[1] - b[1]).map((x) => x[0]);
      const hs = getTeam(st.league, st.career.teamId);
      const folks = people(st);
      const asTeam = (x) => ({ id: x.teamId, city: x.city, name: x.name, colors: x.colors });
      await runSetCutscene((ctx) => commitScene(ctx, {
        look: p.look, name: `${p.first} ${p.last}`, hsName: hs ? `${hs.city} ${hs.name}` : '', hsColors: hs?.colors, hsCrest: hs ? crestURL(hs) : null,
        hats: order.map((x) => ({ city: x.city, name: x.name, colors: x.colors, crest: crestURL(asTeam(x)), chosen: x === o })),
        momLook: p.familyLook, mateLooks: folks.filter((x) => x.kind === 'teammate').map((x) => x.look),
      }), { music: 'anthem' });
    } catch (err) { console.error('signing day', err); }
  }
  signingDay.busy = false;
  sfx.levelUp();
  openModal(h('div.signing',
    h('div.kicker', 'SIGNING DAY'),
    h('div.signing-hat', { style: { background: `linear-gradient(160deg, ${o.colors[0]}, ${o.colors[1] ?? o.colors[0]})` } }, teamBadge({ id: o.teamId, city: o.city, name: o.name, colors: o.colors }, 64)),
    h('h2', `${p.first} ${p.last} is going to ${o.city}!`),
    h('p.small.muted', `The gym erupts as you pull on the ${o.name} hat. Your family is in the front row. ${o.visit ? o.visit.start + '.' : ''}`),
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
  const pr = st.declareProj ?? flow.projectDraft(st, { early: true });
  const ds = pr.stock;
  const seasonsLeft = STAGES.college.seasons - st.career.stageSeason;
  const pct = (x) => `${Math.round(x * 100)}%`;
  // what the scouts say, built from last season and the whole résumé
  const plus = [], minus = [];
  if (ds.last >= 72) plus.push(`Dominant last season (season rating ${ds.last}).`);
  else if (ds.last >= 62) plus.push(`Solid last season (season rating ${ds.last}).`);
  else minus.push(`Quiet last season (season rating ${ds.last}). Another year could help.`);
  if (ds.lastAwards) plus.push(`${ds.lastAwards} award${ds.lastAwards === 1 ? '' : 's'} last season.`);
  if (ds.lastChamp) plus.push('Won it all last season.');
  if (p.ovr >= 76) plus.push(`Pro-ready tools (overall ${Math.round(p.ovr)}).`);
  else if (p.ovr < 70) minus.push(`Still raw (overall ${Math.round(p.ovr)}).`);
  if (p.fame >= 60) plus.push('Big name: teams know who you are.');
  if (ds.seasons < 2) minus.push('Only one season of tape.');
  if (p.injury) minus.push(`Coming off an injury (${p.injury.label.toLowerCase()}).`);
  if (p.position === 'K') minus.push('Teams rarely spend high picks on kickers.');
  const advice = pr.pRound1 >= 0.6 ? 'Your agent: "You\'re a first-rounder. The money is there right now."'
    : pr.pUndrafted >= 0.35 ? 'Your agent: "Honestly? You could go undrafted. Another year of tape would help."'
      : pr.round && pr.round <= 3 ? 'Your agent: "Day two pick. Good money, but a big year could push you up."'
        : 'Your agent: "Late-round range right now. It\'s your call."';
  return h('div.screen',
    h('h1', 'Declare Early?'),
    h('p.small.muted', `You have ${seasonsLeft} college season${seasonsLeft === 1 ? '' : 's'} left. Leave now and the draft is next.`),
    h('div.card',
      h('div.card-title', h('h3', `Your ${ds.lastYear ?? ''} season`), ds.lastChamp ? h('span.chip.gold.pix', 'CHAMPIONS') : null),
      h('div.bigstat',
        h('div', h('b', ds.lastRecord ?? '-'), h('span', 'Team record')),
        h('div', h('b', ds.last), h('span', 'Season rating')),
        h('div', h('b', ds.lastAwards), h('span', 'Awards'))),
      ds.lastStats ? h('div.bigstat', { style: { marginTop: '8px' } }, statLine(p.position, ds.lastStats).map(([v, l]) => h('div', h('b', v), h('span', l)))) : null),
    h('div.card.hero',
      h('div.card-title', h('h3', 'Mock draft'), h('span.chip.pix', pr.label.toUpperCase())),
      h('div.bigstat',
        h('div', h('b', pr.round ? `#${pr.lo}-${Math.min(pr.hi, 140)}` : '—'), h('span', 'Likely pick range')),
        h('div', h('b', pct(pr.pRound1)), h('span', 'Chance of round 1')),
        h('div', h('b', pct(pr.pUndrafted)), h('span', 'Chance undrafted'))),
      h('p.small', { style: { marginTop: '8px' } }, `Projected rookie deal: about ${fmtMoney(pr.salary)}/yr.`),
      plus.length ? h('div', h('div.tiny.pix.good', 'SCOUTS LIKE'), h('ul.small', plus.map((x) => h('li', x)))) : null,
      minus.length ? h('div', h('div.tiny.pix.bad', 'SCOUTS WORRY'), h('ul.small', minus.map((x) => h('li', x)))) : null,
      h('p.small', h('i', advice)),
      h('p.tiny.muted', 'Projections come from last season, your whole college résumé, your overall and fame. The combine can still move you up or down.')),
    h('button.btn.primary.block', { onclick: () => { sfx.select(); flow.declareForDraft(st, true); app.commit(); } }, 'Declare for the Draft'),
    h('button.btn.block', { onclick: () => { sfx.click(); flow.declareForDraft(st, false); app.commit(); } }, seasonsLeft === 1 ? 'Return for Senior Season' : 'Stay in School'));
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
    // the full draft night: the theater, the commissioner, your name on the big screen, the walk, the hat, the jersey
    const col = COLLEGE_TEAMS.find((t) => t.id === d.board?.find((x) => x.user)?.college);
    setTimeout(() => runSetCutscene((ctx) => draftNightScene(ctx, {
      look: p.look, name: `${p.first} ${p.last}`, last: p.last, number: p.number, pos: p.position, college: col ? `${col.city} ${col.name}` : '',
      team: { city: team.city, name: team.name, colors: team.colors }, kit: kitUniform(teamKits(team).home), crest: crestURL(team),
      round: d.round, pick: d.pick, year: st.career.year, momLook: p.familyLook, fanColors: st.league.teams.map((t) => t.colors),
    }), { music: 'anthem', crowd: 0.3 }), 50);
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
      d.proj ? h('p.small', `Mock drafts had you: ${d.proj.label} (around pick ${d.proj.median}). ${d.undrafted ? 'Ouch.' : d.pick + 10 < d.proj.median ? 'You went way higher than expected!' : d.pick > d.proj.median + 15 ? 'You slid on draft night.' : 'Right about where the experts said.'}`) : null,
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
