// Life → Home: your house, weekly home actions and upgrades.
import { h } from '../dom.js';
import { toast, changeChips } from '../components.js';
import { HOUSING } from '../../data/lifestyle.js';
import { HOME_ACTIONS } from '../../data/home.js';
import { upgradeInfo, buyUpgrade, homeActionsLeft, doHomeAction, homePerks } from '../../sim/home.js';
import { fmtMoney } from '../../core/util.js';
import { icon } from '../icons.js';
import { sfx } from '../../audio/sfx.js';
import { enterWorld } from './world.js';

export function homeView(app) {
  const st = app.state;
  const p = st.player;
  const house = HOUSING.find((x) => x.id === p.housing) ?? HOUSING[0];
  const left = homeActionsLeft(st);
  const perks = homePerks(p);
  const perkTxt = [perks.energy && `+${perks.energy} energy/wk`, perks.health && `+${perks.health} health/wk`, perks.mood && `+${perks.mood} mood/wk`, perks.train && `+${Math.round(perks.train * 100)}% training`, perks.fame && `+${perks.fame.toFixed(1)} fame/wk`].filter(Boolean).join(' · ');
  return h('div.col', { style: { gap: '14px' } },
    h('div.card.home-hero',
      h('div.hh-scene', h('div.hh-house', h('i.roof'), h('i.body'), h('i.door'), h('i.win.w1'), h('i.win.w2')), h('div.hh-label.pix', house.label)),
      h('p.small.muted', house.desc ?? ''),
      h('p.tiny', perkTxt || 'No upgrades yet. Upgrades come with you every time you move.'),
      h('button.btn.primary.block', { onclick: () => { sfx.select(); enterWorld(app, 'home'); } }, icon('home'), 'Visit my home')),
    h('div.card',
      h('div.card-title', h('h3', 'This Week, At Home'), h('span.chip.pix', `${left} OF 2 LEFT`)),
      h('div.ha-grid', HOME_ACTIONS.map((a) => {
        const done = st.week?.homeActions?.includes(a.id);
        return h(`button.ha${done ? '.done' : ''}`, { disabled: done || left <= 0 || st.phase !== 'plan', onclick: () => {
          const ch = doHomeAction(st, a.id);
          if (!ch) return;
          sfx.select(); app.save(); toast(`${a.label}: ${a.desc}`); app.render();
        } }, h('span.v-ic', icon(a.icon)), h('b', a.label), h('span.tiny.muted', done ? 'Done ✓' : a.desc));
      }))),
    h('div.card',
      h('div.card-title', h('h3', 'Upgrades'), h('b.pix', fmtMoney(p.money))),
      h('div.up-grid', upgradeInfo(p).map((u) => h('div.up',
        h('div.row', { style: { gap: '8px' } }, h('span.v-ic', icon(u.icon)), h('div.grow', h('b', u.label), h('div.tiny.muted', u.level ? u.levels[u.level - 1] : u.desc))),
        h('div.up-pips', [0, 1, 2].map((i) => h(`i${i < u.level ? '.on' : ''}`))),
        u.nextPrice === null ? h('span.chip.good.pix', 'MAXED')
          : h('button.btn.small.block', { disabled: p.money < u.nextPrice, onclick: () => {
            const r = buyUpgrade(st, u.id);
            if (!r.ok) return toast(r.why);
            sfx.cash(); app.save(); toast(`Installed: ${r.label}`); app.render();
          } }, `${u.levels[u.level]} · ${fmtMoney(u.nextPrice)}`))))));
}
