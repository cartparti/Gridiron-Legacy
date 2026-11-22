// Match-screen extras: coin toss, the game's bonus challenge, the primetime banner, the in-the-zone meter.
import { h, clear } from '../dom.js';
import { icon } from '../icons.js';
import { sfx } from '../../audio/sfx.js';
import { fmtMoney } from '../../core/util.js';
import { tossCoin, tossChoice, ZONE_AT, PRIMETIME_NAME } from '../../sim/matchday.js';
import { answerPresser } from '../../sim/presser.js';
import { SPEECHES, speechDue, giveSpeech, isCaptain } from '../../sim/captain.js';
import { allStarChallenge } from '../../sim/allstar.js';
import { openCombineTest } from './combineGames.js';
import { TRADE_DEADLINE, canRequestTrade, requestTrade, chooseTrade, cancelTrade } from '../../sim/trade.js';
import { toast, confirmDialog } from '../components.js';

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

/** Captain's pregame speech before big games. */
export function speechCard(app) {
  const st = app.state;
  const g = st.game;
  if (!speechDue(st, g) && !g.speech) return null;
  if (!isCaptain(st)) return null;
  const box = h('div.speech-card');
  const draw = () => {
    clear(box);
    box.append(h('div.tiny.pix', 'CAPTAIN\'S SPEECH'));
    if (g.speech) {
      const s = SPEECHES.find((x) => x.id === g.speech);
      box.append(h('p.small', `You: "${s.label}." ${s.desc}`));
      return;
    }
    box.append(h('p.small.muted', 'Big game. The locker room is looking at you.'),
      h('div.col', { style: { gap: '6px', marginTop: '6px' } }, SPEECHES.map((s) => h('button.btn.block', { style: { textAlign: 'left' }, onclick: () => { sfx.select(); giveSpeech(st, s.id); app.save(); draw(); } },
        h('b', s.label), h('div.tiny.muted', s.desc)))));
  };
  draw();
  return box;
}

/** Week tab: the result of the captain vote, shown early in the season. */
export function captainCard(app) {
  const st = app.state;
  const v = st.captainVote;
  if (!v || v.year !== st.career.year || v.stage !== st.career.stage || (st.league?.week ?? 0) > 1) return null;
  return h(`div.card.captain-card${v.won ? '.won' : ''}`,
    h('div.row', { style: { gap: '12px', alignItems: 'center' } },
      h('span.cap-c', 'C'),
      h('div.grow', h('b', v.won ? 'Voted team captain!' : 'Captain vote'),
        h('div.tiny.muted', v.won ? 'You wear the C this season: teammates rally around you every week, you play with a little more poise, and you give the speech before big games.'
          : `Not this year (about ${v.pct}% of the vote). Teammates, your play, years with the team and how you handle the media all count.`))));
}

/** Season review: All-Star selection and the skills challenge you play. */
export function allStarCard(app) {
  const st = app.state;
  const as = st.review?.allStar;
  if (!as?.selected) return null;
  const base = { forty: 4.6, bench: 22, vert: 34, drill: 75 }[as.test] ?? 70;
  return h('div.card.allstar-card',
    h('div.card-title', h('h3', `⭐ ${as.name}`), h('span.chip.gold.pix', 'SELECTED')),
    h('p.small', 'Your season earned you a spot with the best players in the league.'),
    as.result
      ? h(`p.small${as.result.won ? '.good' : ''}`, h('b', as.result.text), ` +${as.result.fame} fame.`)
      : h('div.row', { style: { gap: '8px', alignItems: 'center', marginTop: '6px' } },
        h('span.small.grow', `Skills challenge: ${as.title}`),
        h('button.btn.primary.small', { onclick: () => { sfx.click(); openCombineTest(as.test, { base, title: as.title }, (perf) => { allStarChallenge(st, perf); app.save(); app.render(); }); } }, 'Compete'),
        h('button.btn.small.ghost', { onclick: () => { sfx.click(); allStarChallenge(st, 0.45 + Math.random() * 0.2); app.save(); app.render(); } }, 'Sim it')));
}

/** Team tab (pros): ask for a trade. */
export function tradeCard(app) {
  const st = app.state;
  if (st.career.stage !== 'pro') return null;
  const r = st.tradeReq && st.tradeReq.year === st.career.year ? st.tradeReq : null;
  const card = h('div.card.trade-card', h('div.card-title', h('h3', 'Trade Request'), h('span.tiny.muted', `Deadline: week ${TRADE_DEADLINE}`)));
  const say = (res) => { if (res?.text) toast(res.text); app.commit(); };
  if (!r || r.status === 'cancelled') {
    if (!canRequestTrade(st)) { card.append(h('p.small.muted', st.league.phase !== 'regular' ? 'Trades only happen during the regular season.' : 'The trade deadline has passed.')); return card; }
    card.append(h('p.small.muted', 'Not happy here? Ask out. Your agent will find teams that want you. The coach and the locker room will not like it.'),
      h('button.btn.small', { onclick: async () => { if (!(await confirmDialog('Ask for a trade?', 'The coach and teammates will take it badly (coach -12, teammates -6), even if you end up staying.', 'Ask for a trade'))) return; sfx.click(); requestTrade(st); app.commit(); } }, 'Ask for a trade'));
    return card;
  }
  if (r.status === 'open') {
    card.append(h('p.small', 'Your agent found interest from:'),
      h('div.list', r.teams.map((t) => h('div.li', h('span.swatch', { style: { background: t.colors[0] } }), h('div.grow', h('b', `${t.city} ${t.name}`), h('div.tiny.muted', `${t.record} · ${t.why}`)),
        h('button.btn.small.primary', { onclick: () => { sfx.select(); say(chooseTrade(st, t.id)); } }, 'Go here')))),
      h('button.btn.small.ghost', { style: { marginTop: '8px' }, onclick: () => { sfx.click(); cancelTrade(st); toast('You took it back. Some of the damage heals.'); app.commit(); } }, 'Never mind, I\'ll stay'));
    return card;
  }
  const dest = r.teams.find((t) => t.id === r.to);
  card.append(h(`p.small${r.status === 'accepted' ? '.good' : '.bad'}`, r.status === 'accepted' ? `Traded! You join the ${dest?.city} ${dest?.name} next week.` : 'Request denied. You\'re staying this season.'));
  return card;
}
