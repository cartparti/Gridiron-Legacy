import { h, clear } from '../dom.js';
import { POSITIONS, BACKGROUNDS, STAT_KEYS, STAT_LABELS } from '../../data/positions.js';
import { HS_TEAMS, CITIES } from '../../data/teams.js';
import { FIRST_NAMES, LAST_NAMES } from '../../data/names.js';
import { calcOverall } from '../../sim/player.js';
import { newCareer } from '../../sim/flow.js';
import { jersey, teamBadge, stars } from '../components.js';
import { sfx } from '../../audio/sfx.js';
import { DIFFICULTIES } from '../../data/config.js';
import { portraitImg } from '../../scenes/portrait.js';

/** Full-body 3D preview of the athlete in school colors. */
function spritePreview(colors, number) {
  return portraitImg({ colors, number, skin: 2 }, 120, { full: true });
}

const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function createScreen(app) {
  const f = app.ui.form ?? (app.ui.form = {
    first: rnd(FIRST_NAMES), last: rnd(LAST_NAMES), position: 'QB', background: 'natural',
    number: 7, hometown: 'Westfield', hsTeamId: 'WFW', difficulty: app.settings.difficulty ?? 'normal',
  });
  const wrap = h('div.screen');
  const draw = () => {
    clear(wrap);
    const school = HS_TEAMS.find((t) => t.id === f.hsTeamId);
    const bg = BACKGROUNDS.find((b) => b.id === f.background);
    const preview = {};
    for (const k of STAT_KEYS) preview[k] = 43 + bg.stats[k];
    const ovr = Math.round(calcOverall(preview, f.position));
    wrap.append(
      h('div.row.between', h('h1', 'New Athlete'), h('button.btn.small.ghost', { onclick: () => app.go('slots') }, 'Back')),
      h('div.card',
        h('div.row', { style: { alignItems: 'flex-start' } },
          h('div.col', { style: { alignItems: 'center', gap: '4px' } }, spritePreview(school.colors, f.number), h('span.tiny.muted', school.name)),
          h('div.col.grow', { style: { gap: '8px' } },
            h('label.field', 'First name', h('input', { type: 'text', value: f.first, maxlength: 14, oninput: (e) => { f.first = e.target.value; } , onchange: draw })),
            h('label.field', 'Last name', h('input', { type: 'text', value: f.last, maxlength: 14, oninput: (e) => { f.last = e.target.value; }, onchange: draw })),
            h('div.row',
              h('label.field.grow', 'Number', h('input', { type: 'number', min: 0, max: 99, value: f.number, onchange: (e) => { f.number = Math.max(0, Math.min(99, Number(e.target.value) || 0)); draw(); } })),
              h('button.btn.small', { style: { marginTop: '18px' }, onclick: () => { sfx.click(); f.first = rnd(FIRST_NAMES); f.last = rnd(LAST_NAMES); f.number = Math.floor(Math.random() * 90) + 1; draw(); } }, '🎲 Random'))))),
      h('div.card',
        h('h2', 'Position'),
        h('div.pos-cards', Object.entries(POSITIONS).map(([id, p]) =>
          h(`button.pick-card${f.position === id ? '.on' : ''}`, { onclick: () => { sfx.click(); f.position = id; draw(); } },
            h('span.big', id), h('span.lbl', p.label)))),
        h('p.small.muted', { style: { marginTop: '10px' } }, POSITIONS[f.position].blurb),
        h('div.small', { style: { marginTop: '6px' } },
          STAT_KEYS.map((k) => h('div.row.between', h('span', STAT_LABELS[k]),
            h('span.muted', `${POSITIONS[f.position].statNotes[k]} · ${Math.round(POSITIONS[f.position].weights[k] * 100)}%`))))),
      h('div.card',
        h('h2', 'Background'),
        h('div.bg-cards', BACKGROUNDS.map((b) =>
          h(`button.pick-card${f.background === b.id ? '.on' : ''}`, { onclick: () => { sfx.click(); f.background = b.id; draw(); } },
            h('b', b.label), h('span.lbl', b.desc)))),
        h('p.small', { style: { marginTop: '10px' } }, 'Starting overall: ', h('b', `~${ovr}`))),
      h('div.card',
        h('h2', 'Hometown'),
        h('div.subtabs', { style: { flexWrap: 'wrap' } }, CITIES.map((c) => h(`button.subtab${f.hometown === c.name ? '.on' : ''}`, { onclick: () => {
          sfx.click(); f.hometown = c.name; f.hsTeamId = c.schools[0].id; draw();
        } }, c.name))),
        h('h2', { style: { marginTop: '16px' } }, 'High School'),
        h('p.small.muted', `${f.hometown} has ${CITIES.find((c) => c.name === f.hometown).schools.length} high schools. The other one in town will be your crosstown rival.`),
        h('div.list', HS_TEAMS.filter((t) => t.town === f.hometown).map((t) =>
          h('button.li', { style: { background: f.hsTeamId === t.id ? 'color-mix(in srgb, var(--accent) 16%, transparent)' : 'none', border: '0', borderBottom: '1px solid var(--line)', cursor: 'pointer', textAlign: 'left', minHeight: '48px', color: 'inherit' }, onclick: () => { sfx.click(); f.hsTeamId = t.id; draw(); } },
            teamBadge(t, 30), h('span.grow', h('b', `${t.city} ${t.name}`)), stars(Math.max(1, Math.round((t.base - 45) / 4))))))),
      h('div.card',
        h('h2', 'Difficulty'),
        h('div.diff-cards', Object.entries(DIFFICULTIES).map(([id, d]) =>
          h(`button.pick-card${f.difficulty === id ? '.on' : ''}`, { onclick: () => { sfx.click(); f.difficulty = id; draw(); } }, h('b', d.label)))),
        h('p.small.muted', { style: { marginTop: '8px' } }, DIFFICULTIES[f.difficulty].desc, f.difficulty !== 'normal' ? ` Legacy ×${DIFFICULTIES[f.difficulty].legacy}.` : '')),
      h('button.btn.primary.block', {
        onclick: () => {
          if (!f.first.trim() || !f.last.trim()) return;
          sfx.select();
          const state = newCareer({ ...f, first: f.first.trim(), last: f.last.trim() });
          app.ui.form = null;
          app.screen = 'career';
          app.startCareer(state, app.ui.createSlot ?? 0);
        },
      }, 'Start Career'));
  };
  draw();
  return wrap;
}
