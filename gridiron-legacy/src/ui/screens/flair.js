// v0.63 screens: tunnel fit, bold prediction, card show, signature dish, streaks.
import { h } from '../dom.js';
import { sfx } from '../../audio/sfx.js';
import { fmtMoney } from '../../core/util.js';
import { toast } from '../components.js';
import { FITS, fitToday, pickFit, PREDICTIONS, canPredict, makePrediction, canCardShow, cardShow, streakRows } from '../../sim/flair.js';

const STAGE_I = { hs: 0, college: 1, pro: 2 };

export function fitCard(app) {
  const st = app.state;
  const today = fitToday(st);
  if (st.league?.phase === undefined) return null;
  if (today) { const f = FITS.find((x) => x.id === today.id); return h('div.card.flat', h('p.small', `${f.emoji} Tunnel fit: `, h('b', f.label), today.best ? ' · 🔥 best dressed of the week' : '')); }
  return h('div.card', h('div.card-title', h('h3', '📸 Tunnel fit'), h('span.tiny.muted', 'Cameras are waiting at the stadium')),
    h('div.ritual-grid', FITS.map((f) => {
      const cost = f.cost ? f.cost[STAGE_I[st.career.stage] ?? 1] : 0;
      return h('button.ritual', { onclick: () => { sfx.click(); const r = pickFit(st, f.id); if (r?.text) toast(r.text); app.commit(); } },
        h('span.rt-e', f.emoji), h('b.tiny', f.label), h('span.tiny.muted', cost ? `${f.desc} ${fmtMoney(cost)}` : f.desc));
    })),
    h('p.tiny.muted', 'Wearing the same thing two weeks in a row gets fewer photos.'));
}

export function predictionCard(app) {
  const st = app.state;
  const pr = st.prediction;
  if (pr && pr.year === st.career.year && pr.stage === st.career.stage && !pr.settled) {
    const lab = PREDICTIONS.find((x) => x.id === pr.id)?.label;
    return h('div.card.flat', h('p.small', '🗣️ Your guarantee this season: ', h('b', lab), pr.id === 'stat' ? ` (${pr.target.toLocaleString('en-US')} ${pr.noun}, you have ${(st.player.seasonStats?.[pr.key] ?? 0).toLocaleString('en-US')})` : pr.id === 'rival' && pr.rivalWon ? ' ✅ done!' : ''));
  }
  if (!canPredict(st)) return null;
  return h('div.card', h('div.card-title', h('h3', '🗣️ Make a bold prediction'), h('span.tiny.muted', 'Optional')),
    h('p.small', 'Reporters want a headline for the new season. Back it up and fans love you. Miss and you hear about it all offseason.'),
    h('div.col', { style: { gap: '6px' } }, PREDICTIONS.map((x) => h('button.btn.block', { onclick: () => { sfx.click(); if (makePrediction(st, x.id)) toast('It is on every sports show. No going back now.'); app.commit(); } },
      x.label, x.desc ? h('div.tiny.muted', x.desc(st)) : null))));
}

export function cardShowCard(app) {
  const st = app.state;
  if (st.career.stage === 'hs' || !(st.player.cards?.length)) return null;
  const done = st.cardShowYear === st.career.year;
  return h('div.card', h('div.card-title', h('h3', '✍️ Card show'), done ? h('span.chip.good.pix', 'DONE THIS SEASON') : h('span.tiny.muted', 'Once a season · uses a day')),
    h('p.small.muted', 'Collectors line up for your autograph on your cards. More valuable cards and more fame mean a bigger payday.'),
    done ? null : h('button.btn.small.primary', { disabled: !canCardShow(st), onclick: () => { const r = cardShow(st); if (r) { sfx.cash?.(); toast(r.text); } app.commit(); } }, canCardShow(st) ? 'Do a signing' : 'Needs a free day this week'));
}

export function dishCard(app) {
  const p = app.state.player;
  if (!p.dishes?.length) return null;
  return h('div.card.flat', h('p.small', '🍔 On the stadium menu: ', p.dishes.map((d, i) => h('span', i ? ', ' : '', h('b', `"${d.name}"`), ` (${d.teamName}, ${d.year})`))));
}

export function streaksCard(app) {
  const rows = streakRows(app.state);
  if (!rows.some((r) => r.best > 0)) return null;
  return h('div.card', h('h3', '🔥 Streaks'),
    h('div.list', rows.map((r) => h('div.li', h('span', r.icon), h('span.grow.small', r.label), h(`b${r.cur >= 3 ? '.good' : ''}`, r.cur), h('span.tiny.muted', `best ${r.best}`)))));
}

export function streakNote(g) {
  return g.streak ? h('div.card.flat.unlock-card', h('p.small', `🔥 ${g.streak.n} straight: ${g.streak.label.toLowerCase()}. A new personal best!`)) : null;
}
export function predictionReview(r) {
  if (!r.prediction) return null;
  return h('div.card', { style: { borderColor: r.prediction.hit ? 'var(--good)' : 'var(--bad)' } }, h('h3', '🗣️ Your guarantee'),
    h('p.small', r.prediction.hit ? `You said ${r.prediction.label} and you backed it up. +fame, +XP.` : `You said ${r.prediction.label} It did not happen. The radio shows will not let it go.`));
}
