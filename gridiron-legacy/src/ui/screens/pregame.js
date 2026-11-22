// Match-screen extras: coin toss, the game's bonus challenge, the primetime banner, the in-the-zone meter.
import { h, clear } from '../dom.js';
import { icon } from '../icons.js';
import { sfx } from '../../audio/sfx.js';
import { fmtMoney } from '../../core/util.js';
import { tossCoin, tossChoice, ZONE_AT, PRIMETIME_NAME } from '../../sim/matchday.js';
import { answerPresser } from '../../sim/presser.js';

/** Coin toss: call it, watch it spin, then receive or defer if you won. */
export function coinTossCard(app, onDone) {
  const st = app.state;
  const g = st.game;
  const box = h('div.toss-card');
  const coin = h('div.toss-coin', h('span.tc-face.tc-h', 'H'), h('span.tc-face.tc-t', 'T'));
  const draw = () => {
    clear(box);
    const t = g.toss;
    box.append(h('div.tiny.pix.muted', 'COIN TOSS'));
    if (t?.choice) {
      coin.className = `toss-coin show-${t.side}`;
      box.append(h('div.row', { style: { gap: '12px', alignItems: 'center' } }, coin, h('p.small', t.text)));
      onDone?.();
      return;
    }
    if (t?.won) {
      coin.className = `toss-coin show-${t.side}`;
      box.append(h('div.row', { style: { gap: '12px', alignItems: 'center' } }, coin, h('p.small.good', `It's ${t.side}. You won the toss!`)),
        h('div.row', { style: { gap: '8px', marginTop: '8px' } },
          h('button.btn.grow', { onclick: () => { sfx.click(); tossChoice(st, 'receive'); app.save(); draw(); } }, h('b', 'Receive'), h('div.tiny.muted', 'Ball first')),
          h('button.btn.grow', { onclick: () => { sfx.click(); tossChoice(st, 'defer'); app.save(); draw(); } }, h('b', 'Defer'), h('div.tiny.muted', 'Ball first after halftime'))));
      return;
    }
    box.append(h('p.small', 'The captains meet at midfield. Call it in the air:'),
      h('div.row', { style: { gap: '8px', marginTop: '6px' } }, ['heads', 'tails'].map((c) => h('button.btn.grow', { onclick: () => flip(c) }, c === 'heads' ? 'Heads' : 'Tails'))));
  };
  const flip = (call) => {
    sfx.whistle();
    const t = tossCoin(st, call);
    app.save();
    clear(box);
    coin.className = `toss-coin spin-${t.side}`;
    box.append(h('div.tiny.pix.muted', 'COIN TOSS'), h('div.row', { style: { gap: '12px', alignItems: 'center' } }, coin, h('p.small.muted', `You called ${call}...`)));
    setTimeout(() => { if (t.won) sfx.cheer?.(true); else sfx.click(); draw(); }, app.settings.reducedMotion ? 50 : 1300);
  };
  draw();
  return box;
}

/** The game's bonus challenge (pregame / live). */
export function challengeChip(ch) {
  if (!ch) return null;
  const r = ch.reward;
  const reward = [`+${r.xp} XP`, `+${r.fame} fame`, r.money ? fmtMoney(r.money) : null].filter(Boolean).join(' · ');
  return h(`div.challenge${ch.done === true ? '.done' : ch.done === false ? '.miss' : ''}`,
    h('span.ch-ic', icon(ch.done === false ? 'alert' : 'target')),
    h('div.grow', h('div.tiny.pix', ch.done === true ? 'CHALLENGE COMPLETE' : ch.done === false ? 'CHALLENGE MISSED' : 'GAME CHALLENGE'), h('b.small', ch.label)),
    h('span.tiny.muted', reward));
}

export function primetimeBanner(st, g) {
  if (!g.primetime) return null;
  return h('div.primetime', h('span.pt-star', '★'), h('div', h('b.pix', (PRIMETIME_NAME[st.career.stage] ?? 'Primetime').toUpperCase()), h('div.tiny', 'National TV, under the lights. Big games here mean big fame.')));
}

/** Streak dots / IN THE ZONE badge for the match bar. */
export function zoneMeter(g) {
  if (g.zone) return h('div.mb-zone.on', { title: 'In the zone' }, h('b', '🔥 ZONE'));
  const n = Math.min(ZONE_AT, g.streak ?? 0);
  return h('div.mb-zone', { title: 'Great plays in a row (3 = in the zone)' }, h('div.zdots', Array.from({ length: ZONE_AT }, (_, i) => h(`i${i < n ? '.on' : ''}`))));
}

/** Big flash when you get in the zone. */
export function zoneFlash(root) {
  const b = h('div.zone-flash', h('span.pix', 'IN THE ZONE'), h('small', 'Three great plays in a row. Everything slows down.'));
  root.append(b);
  setTimeout(() => b.remove(), 2200);
}

/** Postgame press conference: one question at a time, three ways to answer. */
export function pressCard(app) {
  const st = app.state;
  const pr = st.lastGame?.presser;
  if (!pr?.questions?.length) return null;
  const card = h('div.card.presser');
  const draw = () => {
    clear(card);
    card.append(h('div.card-title', h('h3', '🎤 Press Conference'), h('span.tiny.muted', `${pr.questions.filter((q) => q.picked !== null).length}/${pr.questions.length}`)));
    pr.questions.forEach((q, qi) => {
      const prevDone = qi === 0 || pr.questions[qi - 1].picked !== null;
      if (!prevDone) return;
      card.append(h('div.pq', h('div.tiny.muted', q.outlet), h('b', `"${q.q}"`)));
      if (q.picked === null) {
        card.append(h('div.pq-answers', q.answers.map((a, ai) => h(`button.btn.pq-a.${a.tone}`, { onclick: () => {
          sfx.click();
          const ch = answerPresser(st, qi, ai);
          app.save();
          q.changes = ch;
          draw();
        } }, h('span.tiny.pix', a.label.toUpperCase()), h('span.small', a.quote)))));
      } else {
        const a = q.answers[q.picked];
        card.append(h(`div.pq-picked.${a.tone}`, h('span.small', `You: "${a.quote}"`)), q.changes?.length ? h('div.changes', q.changes.map((c) => h(`span.chip.${c.delta > 0 ? 'good' : 'bad'}`, `${c.label} ${c.text}`))) : null);
      }
    });
  };
  draw();
  return card;
}
