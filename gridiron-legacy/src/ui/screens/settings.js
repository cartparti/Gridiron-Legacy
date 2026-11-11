import { h } from '../dom.js';
import { CHANGELOG } from '../../data/changelog.js';
import { backupModal } from './slots.js';
import { sfx } from '../../audio/sfx.js';
import { confirmDialog } from '../components.js';
import { DIFFICULTIES } from '../../data/config.js';

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
      opt('Stadium music', 'music', [[true, 'On'], [false, 'Off']]),
      opt('Game speed (plays)', 'gameSpeed', [[0.72, 'Slow'], [0.85, 'Realistic'], [1, 'Fast']]),
      h('div.li', h('div.grow', h('span', 'Plays per game'), h('div.tiny.muted', 'Key moments = 5-8 big plays. More = 9-12. Every drive = you play every series your unit is on the field.')),
        h('div.row', [['moments', 'Key'], ['more', 'More'], ['every', 'Every']].map(([v, l]) => h(`button.subtab${(s.playStyle ?? 'moments') === v ? '.on' : ''}`, { onclick: () => { s.playStyle = v; if (app.state) { app.state.playStyle = v; app.save(); } app.saveSettings(); sfx.click(); app.render(); } }, l)))),
      opt('Play-by-play voice', 'voice', [[false, 'Off'], [true, 'On']]),
      opt('Menu music', 'menuMusic', [[true, 'On'], [false, 'Off']]),
      opt('Reduced motion', 'reducedMotion', [[false, 'Off'], [true, 'On']]),
      opt('Blood effects', 'blood', [[true, 'On'], [false, 'Off']]),
      opt('Tutorial tips', 'tutorials', [[true, 'On'], [false, 'Off']]))),
    h('div.card',
      h('h3', app.state ? 'Difficulty (this career)' : 'Default difficulty'),
      h('div.diff-cards', { style: { marginTop: '10px' } }, Object.entries(DIFFICULTIES).map(([id, d]) => {
        const cur = app.state ? (app.state.difficulty ?? 'normal') : (s.difficulty ?? 'normal');
        return h(`button.pick-card${cur === id ? '.on' : ''}`, { onclick: () => {
          if (app.state) { app.state.difficulty = id; app.save(); } else { s.difficulty = id; app.saveSettings(); }
          sfx.click(); app.render();
        } }, h('b', d.label));
      })),
      h('p.tiny.muted', { style: { marginTop: '8px' } }, 'Harder settings shrink timing windows and boost your final legacy score.')),
    h('div.card',
      h('h3', 'Controls'),
      h('p.small', 'Touch: tap and drag on the field. Mouse works the same way.'),
      h('p.small', 'Keyboard: ', h('span.kbd', '1'), ' ', h('span.kbd', '2'), ' ', h('span.kbd', '3'), ' pick a receiver, ', h('span.kbd', '←'), h('span.kbd', '→'), ' cut or aim, ', h('span.kbd', 'Space'), ' throw / juke / catch.')),
    app.state ? h('div.card',
      h('h3', 'Career'),
      h('div.col',
        h('button.btn.block', { onclick: () => { s.seenTips = {}; if (app.state?.tutorial) app.state.tutorial.done = {}; app.saveSettings(); app.save(); sfx.click(); } }, 'Replay tutorial tips'),
        h('button.btn.block', { onclick: () => { app.save(); backupModal(app.slot, `${app.state.player.first} ${app.state.player.last}`); } }, 'Back up this career'),
        h('button.btn.danger.block', { onclick: async () => { if (await confirmDialog('Quit to title?', 'Your career is saved automatically.', 'Quit')) app.quitToTitle(); } }, 'Save and quit'))) : null,
    h('p.tiny.muted.center', `Gridiron Legacy · v${CHANGELOG[0].v} · all names fictional`));
}
