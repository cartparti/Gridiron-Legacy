// Life > NIL (college) / Endorsements (pro): your value, offers to accept / haggle / decline, and active deals.
import { h } from '../dom.js';
import { icon } from '../icons.js';
import { fmtMoney } from '../../core/util.js';
import { toast, confirmDialog } from '../components.js';
import { commercialDeals, canShoot, shootCommercial, scriptFor } from '../../sim/commercial.js';
import { openCommercial } from './combineGames.js';
import { sfx } from '../../audio/sfx.js';
import { shoeCard } from './shoes.js';
import { DEAL_KINDS, MAX_DEALS, nilValue, nilEarnings, offerTotal, offerBlock, acceptOffer, declineOffer, negotiateOffer, hireNilAgent, dealsTitle, nilWorkload } from '../../sim/nil.js';

const payLine = (o) => {
  const bits = [];
  if (o.weekly) bits.push(`${fmtMoney(o.weekly)}/wk × ${o.weeks} wk`);
  if (o.upfront) bits.push(o.weekly ? `+ ${fmtMoney(o.upfront)} to sign` : fmtMoney(o.upfront));
  if (o.bonus) bits.push(`+ ${fmtMoney(o.bonus.per)} per ${o.bonus.noun} (max ${fmtMoney(o.bonus.cap)})`);
  return bits.join(' ');
};

/** Week tab nudge when offers are waiting. */
export function dealsNudge(app) {
  const st = app.state;
  const n = st.nil?.offers?.length ?? 0;
  if (!n) return null;
  const college = st.career.stage === 'college';
  const best = Math.max(...st.nil.offers.map(offerTotal));
  return h('button.card.deals-nudge', { onclick: () => { sfx.click(); app.hubTab = 'life'; app.ui.lifeSub = 'deals'; app.render(); } },
    h('span.deals-ic', icon('briefcase')),
    h('div.grow', h('b', `${n} ${college ? 'NIL' : 'endorsement'} offer${n > 1 ? 's' : ''} waiting`), h('div.tiny.muted', `Best one is worth ${fmtMoney(best)}. Offers expire.`)),
    h('span.chip.gold.pix', 'VIEW'));
}

export function dealsView(app) {
  const st = app.state;
  const p = st.player;
  const college = st.career.stage === 'college';
  const V = nilValue(st);
  const earn = nilEarnings(st);
  const offers = st.nil?.offers ?? [];
  const wl = nilWorkload(st);
  const act = async (fn) => { const r = fn(); if (r?.text) toast(r.text); app.commit(); return r; };

  const offerCard = (o) => {
    const kind = DEAL_KINDS[o.kind] ?? DEAL_KINDS.local;
    const block = offerBlock(st, o);
    const big = ['brand', 'collective', 'merch'].includes(o.kind) && offerTotal(o) >= 20000;
    return h(`div.deal${o.shady ? '.shady' : ''}`,
      h('div.row', { style: { gap: '10px', alignItems: 'flex-start' } },
        h('span.deal-ic', icon(kind.icon)),
        h('div.grow',
          h('div.tiny.pix.muted', kind.label.toUpperCase()),
          h('b', o.brand), h('div.tiny.muted', o.product),
          h('div.small', { style: { marginTop: '4px' } }, payLine(o)),
          h('div.tiny', { style: { marginTop: '2px' } }, h('span.good', `Total ${fmtMoney(offerTotal(o))}`), h('span.muted', ` · ${o.weeksLeft <= 1 ? 'expires this week' : `expires in ${o.weeksLeft} weeks`}`)),
          o.day ? h('div.tiny.muted', 'Uses one free day this week.') : null,
          o.morality ? h('div.tiny.muted', 'Morality clause: a suspension can cancel it.') : null,
          o.collective ? h('div.tiny.muted', 'Paid by boosters to keep top players. Ends if you leave school.') : null,
          o.shady ? h('div.tiny.bad', 'Against the rules. If it gets out you get suspended and pay half of it back.') : null,
          block ? h('div.tiny.bad', block) : null)),
      h('div.row.deal-btns',
        h(`button.btn.small${o.shady ? '' : '.primary'}`, { disabled: !!block, onclick: async () => {
          if (o.shady && !(await confirmDialog('Take the cash?', 'No contract, no paperwork. A real chance someone talks.', 'Take it'))) return;
          const r = await act(() => acceptOffer(st, o.id));
          if (r?.ok) sfx.cash();
        } }, o.shady ? 'Take it' : 'Accept'),
        big && !block ? h('button.btn.small', { onclick: () => { act(() => acceptOffer(st, o.id, { share: true })); sfx.cash(); } }, 'Accept & share 20%') : null,
        !o.haggled && !o.shady ? h('button.btn.small', { onclick: () => act(() => negotiateOffer(st, o.id)) }, 'Ask for more') : null,
        h('button.btn.small.ghost', { onclick: () => { declineOffer(st, o.id); app.commit(); } }, 'Decline')));
  };

  const dealRow = (d) => h('div.li',
    h('span.deal-ic.sm', icon((DEAL_KINDS[d.kind] ?? DEAL_KINDS.brand).icon)),
    h('div.grow', h('b', d.brand), h('div.tiny.muted', d.product),
      d.bonus ? h('div.tiny', `${fmtMoney(d.bonus.per)} per ${d.bonus.noun} · ${fmtMoney(d.bonus.paid)} of ${fmtMoney(d.bonus.cap)} earned`) : null),
    h('div', { style: { textAlign: 'right' } }, h('div.good.small', `${fmtMoney(d.weekly)}/wk`), h('div.tiny.muted', `${d.weeks} wk left${d.total ? ` · ${fmtMoney(d.total)} so far` : ''}`),
      commercialDeals(st).includes(d) ? h('button.btn.small', { style: { marginTop: '4px' }, disabled: !canShoot(st), title: canShoot(st) ? '' : 'Needs a free day this week', onclick: () => { sfx.click(); openCommercial(d.brand, scriptFor(d), (perf) => { const r = shootCommercial(st, d.brand, perf); if (r?.text) toast(r.text); if (r?.ok) sfx.cash(); app.commit(); }); } }, '🎬 Shoot ad') : null));

  return h('div.col', { style: { gap: '14px' } },
    shoeCard(app),
    h('div.card.hero',
      h('div.card-title', h('h2', dealsTitle(st)), h('span.chip.pix', `${p.sponsors.length}/${MAX_DEALS} DEALS`)),
      h('div.deal-stats',
        h('div', h('div.tiny.muted.pix', college ? 'NIL VALUE' : 'BRAND VALUE'), h('div.display.good', fmtMoney(V)), h('div.tiny.muted', 'per year')),
        h('div', h('div.tiny.muted.pix', 'THIS YEAR'), h('div.display', fmtMoney(earn.year))),
        h('div', h('div.tiny.muted.pix', 'ALL TIME'), h('div.display', fmtMoney(earn.all)))),
      h('p.tiny.muted', college
        ? 'Brands pay for your name, image and likeness. Your value goes up with fame, wins, playing time, a big-name school and your position (quarterbacks get the most).'
        : 'Endorsements follow fame. Big games, awards and a winning team bring better brands.'),
      p.agentName
        ? h('div.tiny', `Agent: ${p.agentName}${college ? ' (takes 5%, better haggling, more offers)' : ''}`)
        : h('div.row.between', { style: { marginTop: '6px', gap: '8px' } }, h('span.tiny.muted', 'No agent. An agent brings more offers and wins more haggles (takes 5%).'),
          h('button.btn.small', { onclick: () => { if (hireNilAgent(st)) { toast(`Hired ${st.player.agentName}.`); sfx.cash(); app.commit(); } } }, 'Hire an agent')),
      wl.academics ? h('p.tiny.bad', `Busy schedule: more than 3 deals costs ${wl.academics} grade points a week.`) : null),
    h('div.card',
      h('div.card-title', h('h3', `Offers (${offers.length})`), h('span.tiny.muted', 'New ones come in every week')),
      offers.length ? h('div.col', { style: { gap: '10px' } }, offers.map(offerCard))
        : h('p.small.muted', college ? 'No offers right now. Play well, get famous, and brands will call.' : 'No offers right now.')),
    h('div.card',
      h('h3', `Active deals (${p.sponsors.length})`),
      p.sponsors.length ? h('div.list', p.sponsors.map(dealRow)) : h('p.small.muted', 'No deals signed yet.')));
}
