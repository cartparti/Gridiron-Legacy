// Guided first week: a short tour the first time you reach the career screen (once per career).
import { h } from './dom.js';
import { openModal } from './components.js';
import { sfx } from '../audio/sfx.js';

const STEPS = [
  { icon: '🏈', title: 'Welcome to the team', text: 'This is your career hub. Each week you train, live your life and then play the game. Your goal: go from high school all the way to the Hall of Fame.' },
  { icon: '📋', title: 'Earn your spot', text: '"Your Season" shows where you stand. You may start as the backup: play well, train hard and keep coach happy to win the starting job. Starters get way more snaps.' },
  { icon: '⚡', title: 'Plan your week', text: 'Fill your days with training, recovery and life. Each activity costs energy. Training drills are mini-games: ace them for bigger stat gains and skill points.' },
  { icon: '📱', title: 'Your phone', text: 'Coach, family, teammates and (later) your agent text you. Post on social, answer messages and keep your relationships healthy.' },
  { icon: '🗺️', title: 'Go somewhere', text: 'Walk around your home, the stadium, the park and downtown. Talk to people and do activities there.' },
  { icon: '🏟️', title: 'Game day', text: 'You play the key moments at your position. Want more snaps? Settings → Plays per game. The play picker always shows the situation (red zone, 3rd & long...).' },
  { icon: '💾', title: 'Keep it safe', text: 'Your career saves on this phone automatically. Back it up now and then (Settings or the season review) so you never lose it.' },
];

export function maybeTour(app) {
  const st = app.state;
  if (!st || app.settings.tutorials === false) return;
  st.tutorial = st.tutorial ?? { done: {} };
  if (st.tutorial.done.tour || document.querySelector('.tour')) return;
  if (navigator.webdriver && !window.__forceTour) return; // automated test browsers skip it
  let i = 0;
  const body = h('div.tour');
  const finish = () => { st.tutorial.done.tour = true; app.save(); m.close(); };
  const draw = () => {
    const s = STEPS[i];
    body.replaceChildren(
      h('div.tour-icon', s.icon),
      h('div.tiny.muted', `Step ${i + 1} of ${STEPS.length}`),
      h('h2', s.title),
      h('p', s.text),
      h('div.tour-dots', STEPS.map((_, k) => h(`span${k === i ? '.on' : ''}`))),
      h('div.row', { style: { gap: '8px' } },
        h('button.btn.ghost.grow', { onclick: () => { sfx.click(); finish(); } }, 'Skip'),
        h('button.btn.primary.grow', { onclick: () => { sfx.click(); if (i < STEPS.length - 1) { i++; draw(); } else finish(); } }, i < STEPS.length - 1 ? 'Next' : "Let's play")));
  };
  draw();
  const m = openModal(body);
  m.box.style.animation = 'none';
}
