// Practice mode (main menu): play any key moment for any position as often as you like, with your choice of
// skill level, opponent, weather, field position and play call. Also the training drills and clutch challenges.
// Nothing here touches a career save.
import { h, clear } from '../dom.js';
import { PLAY_CALLS, WEATHER } from '../../data/config.js';
import { MOMENT_NAMES } from '../../sim/game.js';
import { runMinigame } from '../../scenes/director.js';
import { INTERLUDES } from '../../scenes/interludes.js';
import { defaultLook } from '../../data/looks.js';
import { sfx } from '../../audio/sfx.js';
import { openDrill, clutchChallenge, grade, DRILL_NAMES } from './drills.js';
import { toast } from '../components.js';

const BY_POS = {
  QB: ['qb_throw', 'qb_scramble', 'qb_hailmary'],
  RB: ['rb_run', 'rb_screen', 'rb_goalline'],
  WR: ['wr_route', 'wr_jumpball', 'wr_toetap'],
  CB: ['cb_cover', 'cb_tackle'],
  DT: ['dt_rush', 'dt_run'],
};
const HOW = {
  qb_throw: 'Read the coverage and hit the open man before the rush gets you.',
  qb_scramble: 'The pocket collapses. Escape and pick up yards with your legs.',
  qb_hailmary: 'Last play. Everyone to the end zone, throw it up.',
  rb_run: 'Follow your blocks, hit the hole, make people miss.',
  rb_screen: 'Catch the screen and get upfield behind your linemen.',
  rb_goalline: 'Drive the pile, then time your leap over the top.',
  wr_route: 'Run your route, get open, call for it and make the catch.',
  wr_jumpball: 'A deep ball up for grabs. Win it at the highest point.',
  wr_toetap: 'Catch it on the sideline and get both feet down.',
  cb_cover: 'Stick to your man and break up (or pick off) the pass.',
  cb_tackle: 'Square up the ball carrier in space and bring him down.',
  dt_rush: 'Beat your blocker with rip, swim or bull rush and get the sack.',
  dt_run: 'Shed the block and stuff the run at the line.',
};
const LEVELS = { rookie: ['Rookie', 55], starter: ['Starter', 70], star: ['Star', 84], legend: ['Legend', 96] };
const OPPS = { weak: ['Weak', -1.1], even: ['Even', 0], tough: ['Tough', 0.7], elite: ['Elite', 1.4] };
const SPOTS = { random: 'Random', red: 'Red zone', goal: 'Goal line', own: 'Backed up', two: 'Two-minute' };
const COLORS = [['#1d3557', '#f1c40f'], ['#b5121b', '#f5d547']];

function buildMoment(type, spot, weather) {
  const defense = type.startsWith('cb') || type.startsWith('dt');
  let yardLine = 20 + Math.floor(Math.random() * 55);
  if (spot === 'red') yardLine = 8 + Math.floor(Math.random() * 12);
  if (spot === 'goal' || type === 'rb_goalline') yardLine = 1 + Math.floor(Math.random() * 3);
  if (spot === 'own') yardLine = 88 + Math.floor(Math.random() * 8);
  if (type === 'qb_hailmary') yardLine = 40 + Math.floor(Math.random() * 15);
  const down = spot === 'two' ? 1 : 1 + Math.floor(Math.random() * 3);
  const distance = Math.min(yardLine, down === 1 ? 10 : 2 + Math.floor(Math.random() * 9));
  const ords = ['', '1st', '2nd', '3rd', '4th'];
  const side = yardLine > 50 ? `OWN ${100 - yardLine}` : yardLine === 50 ? '50' : `OPP ${yardLine}`;
  const ang = Math.random() * Math.PI * 2;
  const wmph = weather === 'wind' ? 7 : weather === 'storm' ? 5 : 1;
  return {
    type, defense, down, distance, yardLine, quarter: spot === 'two' ? 4 : 1 + Math.floor(Math.random() * 4), clock: spot === 'two' ? '1:48' : '8:12',
    weather, wind: { x: Math.cos(ang) * wmph * 0.7, z: Math.sin(ang) * wmph * 0.7, mph: Math.round(wmph * 2.2) },
    label: `${ords[down]} and ${yardLine <= distance ? 'Goal' : distance} at ${side}`,
    situation: spot === 'two' ? 'Two-minute drill' : 'Practice', practice: true,
  };
}

export function practiceScreen(app) {
  const P = app.ui.practice ?? (app.ui.practice = { pos: 'QB', level: 'starter', opp: 'even', weather: 'clear', spot: 'random', call: 'balanced', log: [], number: 7 });
  const wrap = h('div.screen.practice');
  const chips = (key, options) => h('div.subtabs', { style: { flexWrap: 'wrap' } }, Object.entries(options).map(([id, lbl]) =>
    h(`button.subtab${P[key] === id ? '.on' : ''}`, { onclick: () => { sfx.click(); P[key] = id; draw(); } }, Array.isArray(lbl) ? lbl[0] : lbl)));

  const play = async (type) => {
    sfx.whistle();
    const v = LEVELS[P.level][1];
    const stats = { speed: v, skill: v, iq: v, strength: v };
    const m = buildMoment(type, P.spot, P.weather);
    const w = WEATHER[P.weather] ?? WEATHER.clear;
    const oppK = OPPS[P.opp][1];
    const passy = ['qb_throw', 'qb_hailmary', 'wr_route', 'wr_jumpball', 'wr_toetap', 'rb_screen', 'cb_cover', 'dt_rush'].includes(type);
    const tol = Math.max(0.35, Math.min(1.8, ((0.5 + (v / 100) * 0.7) * w.tol * (passy ? w.pass : 1) * (1 - oppK * 0.09)) / PLAY_CALLS[P.call].difficulty));
    const res = await runMinigame(type, {
      moment: m, call: P.call, tolerance: tol, stats, position: P.pos,
      teamColors: COLORS[0], oppColors: COLORS[1], homeColors: COLORS[0], userHome: true,
      look: defaultLook(P.pos), number: P.number, lastName: 'You', teamName: 'Practice', oppName: 'Scout Team', homeName: 'Practice',
      stage: P.level === 'rookie' ? 'hs' : P.level === 'starter' ? 'college' : 'pro',
      culture: { biome: 'plains', seed: 7, mascot: 'cat', nickname: 'Practice Field', crowd: 'normal', song: 'groove' },
      interlude: Math.random() < 0.3 ? INTERLUDES[Math.floor(Math.random() * INTERLUDES.length)] : null,
      showTips: app.settings.tutorials && !app.settings.seenTips?.[`mg_${type}`],
      markTip: () => { app.settings.seenTips = { ...(app.settings.seenTips ?? {}), [`mg_${type}`]: true }; app.saveSettings(); },
      reducedMotion: app.settings.reducedMotion, blood: app.settings.blood !== false, gameSpeed: app.settings.gameSpeed ?? 0.85,
      oppStrength: oppK, health: 100, traits: [], wear: { key: `practice-${P.weather}`, progress: 0.35 },
    });
    const q = res.fallbackQuality ?? res.quality ?? 0;
    P.log.unshift({ type, text: res.text ?? '', q, td: !!(res.td || res.defTD), at: Date.now() });
    P.log.length = Math.min(P.log.length, 12);
    P.last = P.log[0];
    app.render();
  };

  const draw = () => {
    clear(wrap);
    const types = BY_POS[P.pos];
    const reps = P.log.length;
    const avg = reps ? P.log.reduce((a, r) => a + r.q, 0) / reps : 0;
    wrap.append(
      h('div.row.between', h('h1', 'Practice'), h('button.btn.small.ghost', { onclick: () => app.go('title') }, 'Back')),
      h('p.small.muted', 'Play any key moment as many times as you like. Nothing here affects your careers.'),
      P.last ? h('div.card.practice-last',
        h('div.row.between', h('b.pix', MOMENT_NAMES[P.last.type]), h(`span.chip.pix${P.last.q >= 0.6 ? '.good' : P.last.q < 0.35 ? '.bad' : ''}`, `GRADE ${grade(P.last.q)}`)),
        h('p', P.last.text || '—'),
        h('div.row', { style: { gap: '8px' } },
          h('button.btn.primary.grow', { onclick: () => play(P.last.type) }, 'Run it back'),
          h('span.tiny.muted', `${reps} rep${reps === 1 ? '' : 's'} · avg ${grade(avg)}`))) : null,
      h('div.card',
        h('h2', 'Position'),
        chips('pos', { QB: 'QB', RB: 'RB', WR: 'WR', CB: 'CB', DT: 'DT' }),
        h('div.col', { style: { gap: '8px', marginTop: '12px' } }, types.map((t) =>
          h('button.practice-ev', { onclick: () => play(t) },
            h('div.grow', h('b', MOMENT_NAMES[t]), h('div.tiny.muted', HOW[t])),
            h('span.chip.pix.gold', '▶ PLAY'))))),
      h('div.card',
        h('h2', 'Setup'),
        h('div.tiny.muted.pix', 'YOUR SKILL'), chips('level', LEVELS),
        h('div.tiny.muted.pix', { style: { marginTop: '10px' } }, 'OPPONENT'), chips('opp', OPPS),
        h('div.tiny.muted.pix', { style: { marginTop: '10px' } }, 'WEATHER'), chips('weather', Object.fromEntries(Object.entries(WEATHER).map(([k, w]) => [k, w.label]))),
        h('div.tiny.muted.pix', { style: { marginTop: '10px' } }, 'FIELD POSITION'), chips('spot', SPOTS),
        h('div.tiny.muted.pix', { style: { marginTop: '10px' } }, 'PLAY CALL'), chips('call', Object.fromEntries(Object.entries(PLAY_CALLS).map(([k, c]) => [k, c.label])))),
      h('div.card',
        h('h2', 'Drills & clutch moments'),
        h('div.col', { style: { gap: '8px' } },
          ...[['sprints', 'sprint'], ['weights', 'reps'], ['drills', 'cones'], ['film', 'film']].map(([id, k]) =>
            h('button.practice-ev', { onclick: () => { sfx.click(); openDrill(id, (q) => toast(`${DRILL_NAMES[k]}: grade ${grade(q)}`)); } },
              h('div.grow', h('b', DRILL_NAMES[k]), h('div.tiny.muted', 'Training drill')), h('span.chip.pix', '▶'))),
          h('button.practice-ev', { onclick: () => clutchChallenge({ title: 'Clutch timing', kind: 'timing', p: 0.5 }, (ok) => toast(ok ? 'Clutch!' : 'Missed it.')) },
            h('div.grow', h('b', 'Clutch timing'), h('div.tiny.muted', 'Stop the marker in the zone (in-game event challenge)')), h('span.chip.pix', '▶')),
          h('button.practice-ev', { onclick: () => clutchChallenge({ title: 'Fight for it', kind: 'mash', p: 0.5 }, (ok) => toast(ok ? 'You won it!' : 'Not enough.')) },
            h('div.grow', h('b', 'Fight for it'), h('div.tiny.muted', 'Tap as fast as you can (in-game event challenge)')), h('span.chip.pix', '▶')))),
      P.log.length > 1 ? h('div.card', h('h3', 'Recent reps'), h('div.col', { style: { gap: '4px' } }, P.log.slice(0, 8).map((r) =>
        h('div.row.between.small', h('span', MOMENT_NAMES[r.type]), h('span.muted.grow', { style: { margin: '0 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, r.text), h('b.pix', grade(r.q)))))) : null);
  };
  draw();
  return wrap;
}
