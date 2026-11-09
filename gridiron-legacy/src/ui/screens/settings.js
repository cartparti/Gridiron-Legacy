import { h } from '../dom.js';
import { sfx } from '../../audio/sfx.js';
import { confirmDialog } from '../components.js';

export function settingsScreen(app) {
  const s = app.settings;
  const opt = (label, key, values) => h('div.li',
    h('span.grow', label),
    h('div.row', values.map(([v, l]) => h(`button.subtab${s[key] === v ? '.on' : ''}`, { onclick: () => { s[key] = v; app.saveSettings(); sfx.click(); app.render(); } }, l))));
  const back = () => { app.screen = app.ui.back === 'title' ? 'title' : 'career'; app.render(); };
  return h('div.screen',
    h('div.row.between', h('h1', 'Settings'), h('button.btn.small.ghost', { onclick: back }, 'Done')),
    h('div.card', h('div.list',
      opt('Theme (menus)', 'theme', [['auto', 'Auto'], ['dark', 'Dark'], ['light', 'Light']]),
      opt('Sound effects', 'sound', [[true, 'On'], [false, 'Off']]),
      opt('Reduced motion', 'reducedMotion', [[false, 'Off'], [true, 'On']]),
      opt('Tutorial tips', 'tutorials', [[true, 'On'], [false, 'Off']]))),
    h('div.card',
      h('h3', 'Controls'),
      h('p.small', 'Touch: tap and drag on the field. Mouse works the same way.'),
      h('p.small', 'Keyboard: ', h('span.kbd', '1'), ' ', h('span.kbd', '2'), ' ', h('span.kbd', '3'), ' pick a receiver, ', h('span.kbd', '←'), h('span.kbd', '→'), ' cut or aim, ', h('span.kbd', 'Space'), ' throw / juke / catch.')),
    app.state ? h('div.card',
      h('h3', 'Career'),
      h('div.col',
        h('button.btn.block', { onclick: () => { s.seenTips = {}; app.saveSettings(); sfx.click(); } }, 'Replay tutorial tips'),
        h('button.btn.danger.block', { onclick: async () => { if (await confirmDialog('Quit to title?', 'Your career is saved automatically.', 'Quit')) app.quitToTitle(); } }, 'Save & quit to title'))) : null,
    h('p.tiny.muted.center', 'Gridiron Legacy · v0.1 · all names fictional'));
}
