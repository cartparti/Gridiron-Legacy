// Career over: legacy tier, Hall of Fame ceremony, career summary.
import { h } from '../dom.js';
import { POSITIONS } from '../../data/positions.js';
import { jersey, ratingChart } from '../components.js';
import { fmtMoney } from '../../core/util.js';
import { sfx } from '../../audio/sfx.js';
import { statLine } from './results.js';
import { icon } from '../icons.js';
import { hofCutscene } from '../../scenes/cutscenes.js';
import { POST_CAREER, nextGenerationOpts } from '../../sim/career.js';
import { choosePostCareer, newCareer } from '../../sim/flow.js';
import { hometownSchools } from '../../data/hometown.js';
import { CITIES } from '../../data/teams.js';
import { defaultLook } from '../../data/looks.js';
import { SPEECH_OPENS, SPEECH_CLOSES, speechThanks, giveSpeech } from '../../sim/speech.js';
import { heirName } from '../../sim/family.js';
import { clear } from '../dom.js';

const REASONS = {
  age: 'Father Time remains undefeated.',
  decline: 'Your body told you it was time.',
  unsigned: 'The phone stopped ringing.',
  choice: 'You walked away on your own terms.',
  farewell: 'A farewell tour, a standing ovation in every stadium, and out on your own terms.',
};

export function legacyScreen(app) {
  const st = app.state;
  const p = st.player;
  const L = st.legacy;
  const last = p.history[p.history.length - 1];
  const colors = last?.colors ?? ['#333', '#f4c430'];
  const hof = L.tier.id === 'hof';
  setTimeout(() => (hof ? sfx.touchdown() : sfx.cheer()), 300);
  if (hof && !L.cutPlayed && !app.settings.reducedMotion) {
    L.cutPlayed = true;
    app.save();
    setTimeout(() => hofCutscene({ look: p.look, name: `${p.first} ${p.last}`, year: (last?.year ?? 2040) + 5, colors }), 50);
  }
  const awardCounts = {};
  for (const a of p.awards) awardCounts[a.name] = (awardCounts[a.name] ?? 0) + 1;
  return h('div.screen',
    h('div.center', h('div.small.muted', REASONS[L.reason] ?? ''), h('h1', `${p.first} ${p.last}`), h('div.muted', `${POSITIONS[p.position].label} · ${p.history[0]?.year}–${last?.year}`)),
    h('div.card.center', { style: { borderColor: 'var(--accent)', borderWidth: '3px' } },
      hof ? h('div', { style: { fontSize: '2.6rem', color: 'var(--accent)' } }, icon('crown')) : null,
      h('div.tier', L.tier.label),
      h('p', L.tier.blurb),
      h('div.display', { style: { fontSize: '1.2rem' } }, `Legacy score ${L.score}`)),
    jersey(p, colors, 170),
    hof ? h('p.center.small', h('b', 'Your number is retired. Your jersey hangs in the rafters forever.')) : null,
    hof ? speechCard(app) : null,
    h('div.card', h('h3', 'Legacy Breakdown'), h('table.tbl', L.lines.map((l) => h('tr', h('td', l.label), h('td.num', `+${l.pts}`))))),
    h('div.card', h('h3', 'Pro Career'), h('div.bigstat', statLine(p.position, p.proCareerStats).map(([v, l]) => h('div', h('b', v), h('span', l)))),
      h('p.small.muted', { style: { marginTop: '8px' } }, `${p.proCareerStats.games} pro games · ${p.titles.filter((t) => t.stage === 'pro').length} titles · career earnings banked: ${fmtMoney(p.money)}`)),
    Object.keys(awardCounts).length ? h('div.card', h('h3', 'Trophy Case'), h('div.row.wrap', Object.entries(awardCounts).map(([n, c]) => h('span.chip.gold', icon('trophy'), `${c > 1 ? `${c}× ` : ''}${n}`)))) : null,
    h('div.card', h('h3', 'Overall by Season'), ratingChart(p.history)),
    // life after football
    h('div.card', h('h3', 'Life After Football'),
      L.post ? h('p', POST_CAREER.find((x) => x.id === L.post).epilogue(p))
        : [h('p.small.muted', 'What comes next?'), h('div.post-grid', POST_CAREER.map((x) => h('button.pick-card', { onclick: () => { sfx.select(); choosePostCareer(st, x.id); app.save(); app.render(); } }, h('b', x.label), h('span.lbl', x.desc))))]),
    // the next generation: play as your kid
    h('div.card.nextgen', h('h3', 'The Next Generation'),
      h('p.small.muted', `Years later, a kid with the ${p.last} name on their back steps onto the field in ${p.hometown}. Play as your child, with a head start from your legacy.`),
      h('button.btn.primary.block', { onclick: () => {
        sfx.levelUp();
        const o = nextGenerationOpts(st);
        const town = o.customTown;
        o.hsTeamId = town ? hometownSchools(town)[0].id : (CITIES.find((c) => c.name === o.hometown) ?? CITIES[0]).schools[0].id;
        if (!town && !CITIES.find((c) => c.name === o.hometown)) o.hometown = CITIES[0].name;
        o.look = { ...defaultLook(o.position), skin: p.look?.skin ?? 2, hairColor: p.look?.hairColor ?? 2, eyeColor: p.look?.eyeColor ?? 0 };
        o.playStyle = app.settings.playStyle ?? 'moments';
        app.startCareer(newCareer(o), app.slot);
      } }, `Play as ${heirName(p) ? `${heirName(p)} ${p.last}` : `${p.last} Jr.`}`)),
    h('button.btn.block', { onclick: () => { app.ui.newCareer = true; app.state = null; app.go('slots'); } }, 'Start a New Career'),
    h('button.btn.block', { onclick: () => app.quitToTitle() }, 'Title Screen'));
}

/** The Hall of Fame induction speech: open, thank two people, close. */
function speechCard(app) {
  const st = app.state;
  const L = st.legacy;
  const card = h('div.card.speech-hof');
  const picks = { open: null, thanks: [], close: null };
  const draw = () => {
    clear(card);
    card.append(h('div.card-title', h('h3', '🎙️ Induction Speech'), h('span.tiny.muted', 'Your moment at the podium')));
    if (L.speech) { card.append(h('blockquote.hof-quote', L.speech.text)); return; }
    const step = !picks.open ? 'open' : picks.thanks.length < 2 ? 'thanks' : !picks.close ? 'close' : 'done';
    const row = (list, onPick, picked = []) => h('div.col', { style: { gap: '6px', marginTop: '6px' } }, list.map((o) => h(`button.btn.block${picked.includes(o.id) ? '.primary' : ''}`, { style: { textAlign: 'left' }, disabled: picked.includes(o.id), onclick: () => { sfx.click(); onPick(o.id); draw(); } }, o.label)));
    if (step === 'open') card.append(h('p.small.muted', 'The crowd goes quiet. How do you begin?'), row(SPEECH_OPENS, (id) => { picks.open = id; }));
    else if (step === 'thanks') card.append(h('p.small.muted', `Who do you thank? (${picks.thanks.length + 1} of 2)`), row(speechThanks(st), (id) => { picks.thanks.push(id); }, picks.thanks));
    else if (step === 'close') card.append(h('p.small.muted', 'How do you end it?'), row(SPEECH_CLOSES, (id) => { picks.close = id; }));
    else { giveSpeech(st, picks); app.save(); sfx.cheer?.(true); draw(); }
  };
  draw();
  return card;
}
