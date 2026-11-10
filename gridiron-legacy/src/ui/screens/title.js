import { h } from '../dom.js';
import { listSlots } from '../../core/storage.js';
import { sfx } from '../../audio/sfx.js';
import { startBackdrop } from '../../scenes/director.js';

export function titleScreen(app) {
  const root = document.getElementById('app');
  root.classList.add('full', 'transparent');
  startBackdrop();
  const slots = listSlots();
  const last = app.settings.lastSlot;
  const cont = last !== null && slots[last] && !slots[last].empty ? slots[last] : null;
  const anySaves = slots.some((s) => !s.empty);
  return h('div.title-screen',
    h('div.logo',
      h('div.l1', 'Gridiron'),
      h('div.l2', 'Legacy'),
      h('div.tag', 'One athlete. High school to the Hall of Fame.')),
    h('div.title-btns',
      cont ? h('button.btn.primary.block', { onclick: () => { sfx.select(); app.loadSlot(cont.slot); } },
        `Continue · ${cont.meta.name}`) : null,
      h(`button.btn.block${cont ? '' : '.primary'}`, { onclick: () => { sfx.select(); app.ui.newCareer = true; app.go('slots'); } }, 'New Career'),
      anySaves ? h('button.btn.block', { onclick: () => { sfx.click(); app.ui.newCareer = false; app.go('slots'); } }, 'Load Career') : null,
      h('button.btn.block', { onclick: () => { sfx.click(); app.go('practice'); } }, 'Practice'),
      h('button.btn.block', { onclick: () => { sfx.click(); app.ui.back = 'title'; app.go('settings'); } }, 'Settings')),
    h('p.tiny.center', { style: { color: 'rgba(255,255,255,0.7)' } }, 'All teams, players and leagues are fictional.'));
}
