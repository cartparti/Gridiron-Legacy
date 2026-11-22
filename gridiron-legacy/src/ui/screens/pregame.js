// Match-screen extras: coin toss, the game's bonus challenge, the primetime banner, the in-the-zone meter.
import { h, clear } from '../dom.js';
import { icon } from '../icons.js';
import { sfx } from '../../audio/sfx.js';
import { fmtMoney } from '../../core/util.js';
import { tossCoin, tossChoice, ZONE_AT, PRIMETIME_NAME } from '../../sim/matchday.js';
import { answerPresser } from '../../sim/presser.js';
import { scoutReport } from '../../sim/scouting.js';
import { recordChase, rivalryTrophy, votePlay, powerRankings } from '../../sim/leaguelife.js';
import { leverage, canAskExtension, askExtension, acceptExtension, pushExtension, startHoldout, endHoldout } from '../../sim/extension.js';
import { marketValue } from '../../sim/flow.js';
import { canMentor, menteeCandidates, pickMentee, mentorSession, MENTOR_TOPICS } from '../../sim/mentor.js';
import { isMarried, WEDDINGS, planWedding, tryForBaby, kidAge, heirName } from '../../sim/family.js';
import { CAUSES, LEVELS, PROGRAMS, canFound, startFoundation, donate, hostEvent } from '../../sim/foundation.js';
import { REHAB_PLANS, canRehab, chooseRehab, eliteCost } from '../../sim/rehab.js';
import { canAnnounceFarewell, announceFarewell, isFarewellSeason } from '../../sim/farewell.js';
import { getTeam } from '../../sim/league.js';
import { portraitImg } from '../../scenes/portrait.js';
import { teamKits } from '../../data/kits.js';
import { crest } from '../crest.js';
import { teamBadge } from '../components.js';
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

/** Scouting report on this week's opponent (full report after Film Study). */
export function scoutCard(app, opp, { compact = false } = {}) {
  const st = app.state;
  if (!opp) return null;
  const r = scoutReport(st, opp);
  if (!r) return null;
  const pct = (x) => `${Math.round(x * 100)}%`;
  const bar = (label, v, hint) => h('div.sc-row', h('span.small', label), h('div.sc-bar', h('i', { style: { width: pct(v) } })), h('b.small', r.revealed ? pct(v) : '?'), h('span.tiny.muted', r.revealed ? hint : ''));
  return h('div.card.scout-card',
    h('div.card-title', h('h3', `🎬 Scouting: ${opp.name}`), h(`span.chip.pix${r.revealed ? '.good' : ''}`, r.revealed ? 'FILM STUDIED' : 'NO FILM')),
    h('p.small', h('b', r.style), ` · ${r.offense}`),
    r.revealed ? h('div.col', { style: { gap: '4px', marginTop: '6px' } },
      bar('Blitz', r.blitz, r.blitz > 0.32 ? 'often' : r.blitz < 0.2 ? 'rarely' : 'sometimes'),
      bar('Man coverage', r.man, r.man > 0.55 ? 'press man team' : r.man < 0.4 ? 'zone team' : 'mixes it up'),
      bar('Deep shots', r.deep, r.deep > 0.4 ? 'loves the deep ball' : 'short game'),
      compact ? null : h('ul.small', { style: { margin: '8px 0 0 16px' } }, r.tips.map((t) => h('li', t))),
      h('p.tiny.muted', { style: { marginTop: '6px' } }, 'In plays you will see their tells before the snap: a red ! over blitzers. QBs and running backs can AUDIBLE (Q), receivers can call a HOT ROUTE.'))
      : h('p.tiny.muted', { style: { marginTop: '6px' } }, 'Put Film Study in your week plan to unlock their tendencies, tips for your position and pre-snap tells (a red ! over blitzers) in every play this game. You can still AUDIBLE (Q) at the line either way.'));
}

// ---------------------------------------------------------------- league life
/** Week tab, start of the season: the preseason magazine. */
export function previewCard(app) {
  const st = app.state;
  const pv = st.preview;
  if (!pv || pv.year !== st.career.year || pv.stage !== st.career.stage || (st.league?.week ?? 0) > 1) return null;
  const p = st.player;
  const team = getTeam(st.league, st.career.teamId);
  return h('div.card.mag-card', { style: { '--c1': team.colors[0], '--c2': team.colors[1] } },
    h('div.mag-cover',
      h('div.mag-title.pix', pv.mag.toUpperCase()),
      h('div.mag-issue.tiny', `${pv.year} SEASON PREVIEW`),
      pv.cover ? h('div.mag-photo', portraitImg({ uniform: teamKits(team).home, look: p.look, number: p.number, helmet: false }, 110, { full: true })) : h('div.mag-photo.team', crest(team, 80)),
      h('div.mag-head', pv.headline)),
    h('div.mag-body',
      h('div.bigstat',
        h('div', h('b', `#${pv.preRank}`), h('span', `Preseason rank (of ${pv.teams})`)),
        h('div', h('b', pv.projected), h('span', 'Projected record')),
        h('div', h('b', `${pv.odds}%`), h('span', 'Your top-award odds'))),
      h('p.small', { style: { marginTop: '8px' } }, h('b', 'Bold prediction: '), pv.bold),
      pv.toWatch?.length ? h('p.tiny.muted', `Teams to watch: ${pv.toWatch.join(', ')}`) : null));
}

/** Week tab (pros): records you're chasing. */
export function recordChaseCard(app) {
  const list = recordChase(app.state);
  if (!list.length) return null;
  return h('div.card.chase-card',
    h('div.card-title', h('h3', '📜 Record Chase'), h('span.tiny.muted', 'History is within reach')),
    h('div.col', { style: { gap: '10px' } }, list.slice(0, 3).map((r) => h('div',
      h('div.row.between', h('b.small', `${r.kind === 'season' ? 'Single-season' : 'Career'} ${r.label}`), h('span.tiny.muted', `${r.holder} (${r.year}): ${r.record.toLocaleString('en-US')}`)),
      h('div.goal-bar', h('i', { style: { width: `${Math.round(r.pct * 100)}%` } })),
      h('div.tiny', `${r.cur.toLocaleString('en-US')} so far · need ${r.need.toLocaleString('en-US')} more${r.perGame ? ` (about ${r.perGame.toLocaleString('en-US')} a game)` : ''}${r.pace ? ` · on pace for ${r.pace.toLocaleString('en-US')}` : ''}`)))));
}

/** The rivalry trophy at stake (Week tab matchup / pregame). */
export function rivalryChip(app, opp) {
  const st = app.state;
  if (!opp || opp.id !== st.career.rivalTeamId) return null;
  const me = getTeam(st.league, st.career.teamId);
  const tr = rivalryTrophy(st, me, opp);
  const holder = tr.holder === me.id ? 'You hold it' : tr.holder === opp.id ? `${opp.name} hold it` : 'Up for grabs';
  return h('div.rival-trophy', h('span.rt-ic', '🏆'), h('div.grow', h('div.tiny.pix', 'RIVALRY TROPHY'), h('b.small', tr.name)), h('span.tiny.muted', `${holder}${tr.streak > 1 && tr.holder ? ` · ${tr.streak} straight` : ''}`));
}

/** Postgame: rivalry result + Play of the Week vote. */
export function rivalryResultCard(lg) {
  const r = lg?.rivalryResult;
  if (!r) return null;
  return h(`div.card.rival-result${r.lost ? '.lost' : ''}`, h('div.row', { style: { gap: '10px', alignItems: 'center' } }, h('span', { style: { fontSize: '2rem' } }, r.lost ? '😤' : '🏆'),
    h('div', h('b', r.lost ? `They took ${r.name}` : r.kept ? `You kept ${r.name}!` : `You won ${r.name}!`), h('div.tiny.muted', r.lost ? 'It sits in their trophy case for a year.' : r.streak > 1 ? `${r.streak} straight. It stays in your building.` : 'It comes home with you.'))));
}
export function potwCard(app) {
  const st = app.state;
  const pw = st.lastGame?.potw;
  if (!pw) return null;
  const card = h('div.card.potw-card');
  const draw = () => {
    clear(card);
    card.append(h('div.card-title', h('h3', '⭐ Play of the Week nominee'), pw.voted ? h(`span.chip.pix${pw.won ? '.gold' : ''}`, pw.won ? 'WINNER' : 'RUNNER-UP') : null),
      h('p.small', h('b', pw.label), ` · ${pw.text ?? ''}`),
      h('p.tiny.muted', `Up against: ${pw.rivals.join(' · ')}`));
    if (!pw.voted) card.append(h('div.row', { style: { gap: '8px', marginTop: '6px' } },
      h('button.btn.small.primary', { onclick: () => { sfx.click(); votePlay(st); app.save(); draw(); } }, 'Let the fans decide'),
      h('button.btn.small', { onclick: () => { sfx.click(); votePlay(st, { boost: true }); app.save(); draw(); } }, 'Campaign on Huddle')));
    else card.append(h(`p.small${pw.won ? '.good' : ''}`, pw.won ? `You won with ${pw.share}% of the vote! +3 fame.` : `So close: ${pw.share}% of the vote.`));
  };
  draw();
  return card;
}

/** Team tab: power rankings. */
export function powerView(app) {
  const st = app.state;
  const list = powerRankings(st);
  return h('div.card', h('div.card-title', h('h3', 'Power Rankings'), h('span.tiny.muted', `Week ${(st.league?.week ?? 0) + 1}`)),
    h('div.list', list.map((r) => h(`div.li.pr-row${r.you ? '.you' : ''}`,
      h('b.pr-rank.pix', r.rank),
      h('span.pr-move', { class: r.move > 0 ? 'good' : r.move < 0 ? 'bad' : 'muted' }, r.move > 0 ? `▲${r.move}` : r.move < 0 ? `▼${-r.move}` : '–'),
      teamBadge(r.team, 28),
      h('div.grow', h('b.small', `${r.team.city} ${r.team.name}`), h('div.tiny.muted', r.take)),
      h('span.small', r.record)))));
}

// ---------------------------------------------------------------- off the field
const M$ = (n) => fmtMoney(n);

/** Team tab (pros): contract extension / holdout. */
export function extensionCard(app) {
  const st = app.state;
  const p = st.player;
  if (st.career.stage !== 'pro' || !p.contract) return null;
  const e = st.extension && st.extension.year === st.career.year ? st.extension : null;
  const say = (res) => { if (res?.text) toast(res.text); app.commit(); };
  const card = h('div.card.ext-card', h('div.card-title', h('h3', 'Contract'), h('span.tiny.muted', `${M$(p.contract.salary)}/yr · ${p.contract.years} yr left`)));
  const lev = leverage(st);
  card.append(h('p.small', lev >= 1.15 ? `You're outplaying this deal: your market value is about ${M$(marketValue(st))} a year.` : lev >= 1.05 ? 'You\'re a little underpaid. You could ask for an extension.' : 'Your deal is about right for how you\'re playing.'));
  if (p.holdout) {
    card.append(h('p.small.bad', `Holding out for ${M$(e?.ask ?? p.holdout.ask)} a year. You sit every game and get fined every week until they pay or you report back.`),
      h('button.btn.small', { onclick: () => { sfx.click(); say(endHoldout(st)); } }, 'Report back'));
    return card;
  }
  if (!e && canAskExtension(st)) { card.append(h('button.btn.small', { onclick: () => { sfx.click(); askExtension(st); app.commit(); } }, 'Ask for an extension')); return card; }
  if (e?.status === 'offer') {
    card.append(h('div.ext-offer', h('div.tiny.pix.muted', 'THEIR OFFER'), h('b', `${e.offer.years} more years · ${M$(e.offer.salary)}/yr`), h('div.tiny.muted', `Total about ${M$(e.offer.salary * e.offer.years)}`)),
      h('div.row.wrap', { style: { gap: '6px', marginTop: '8px' } },
        h('button.btn.small.primary', { onclick: () => { sfx.cash(); say(acceptExtension(st)); } }, 'Sign it'),
        e.pushes < 2 ? h('button.btn.small', { onclick: () => { sfx.click(); say(pushExtension(st)); } }, 'Push for more') : null,
        h('button.btn.small.ghost', { onclick: async () => { if (!(await confirmDialog('Hold out?', 'You will sit out games and be fined every week until they pay 15% more, or you give in. Coach and teammates will be upset.', 'Hold out'))) return; sfx.click(); say(startHoldout(st)); } }, 'Hold out')));
    return card;
  }
  if (e) card.append(h('p.small.muted', e.status === 'signed' ? 'Extension signed this season.' : e.text ?? 'No more talks this season.'));
  return card;
}

/** Team tab (veterans): mentor a young teammate. */
export function mentorCard(app) {
  const st = app.state;
  const p = st.player;
  if (!canMentor(st) && !p.mentee) return null;
  const card = h('div.card.mentor-card', h('div.card-title', h('h3', '🧑‍🏫 Mentorship'), h('span.tiny.muted', `${(p.mentees ?? []).length} in your coaching tree`)));
  const m = p.mentee;
  if (!m) {
    card.append(h('p.small.muted', 'You have been around. Take a young teammate under your wing: weekly sessions grow his game, and every mentee who makes it counts toward your legacy.'),
      h('div.list', menteeCandidates(st).map((c) => h('div.li', h('div.grow', h('b.small', c.name), h('div.tiny.muted', `${c.pos} · ${c.age ?? 22} yrs · ${c.ovr} OVR`)), h('button.btn.small', { onclick: () => { sfx.select(); pickMentee(st, c); app.commit(); } }, 'Mentor him')))));
    return card;
  }
  const wk = `${st.career.year}-${st.league?.week}`;
  card.append(h('div.row.between', h('b', m.name), h('span.small', `${m.pos} · ${Math.round(m.ovr)} OVR (${m.ovr - m.ovr0 >= 0 ? '+' : ''}${(m.ovr - m.ovr0).toFixed(1)})`)),
    h('div.tiny.muted', 'Bond'), h('div.goal-bar', h('i', { style: { width: `${m.bond}%` } })),
    m.lastWeek === wk ? h('p.tiny.muted', { style: { marginTop: '6px' } }, 'You already met this week.')
      : h('div.col', { style: { gap: '6px', marginTop: '8px' } }, MENTOR_TOPICS.map((t) => h('button.btn.block.small', { style: { textAlign: 'left' }, onclick: () => { sfx.click(); const r = mentorSession(st, t.id); if (r?.text) toast(r.text); app.commit(); } }, h('b', t.label), h('span.tiny.muted', ` · ${t.desc}`)))));
  return card;
}

/** Life > Family. */
export function familyView(app) {
  const st = app.state;
  const p = st.player;
  const F = p.family ?? { kids: [] };
  if (!isMarried(p)) {
    return h('div.card', h('h3', 'Family'),
      h('p.small.muted', p.partnerName ? `You're with ${p.partnerName}. When the time is right, propose (People tab, once you live together) or wait for the moment in a story event. After that you can plan the wedding and start a family here.`
        : 'Meet someone first (Social tab). Fall in love, move in together, propose, and you can plan a wedding and start a family here.'),
      F.kids?.length ? kidsList(st, F) : null);
  }
  const out = h('div.col', { style: { gap: '14px' } });
  if (!F.wedding) {
    out.append(h('div.card.wedding-card', h('h3', `💍 Plan your wedding with ${p.partnerName}`),
      h('div.col', { style: { gap: '8px', marginTop: '8px' } }, WEDDINGS.filter((w) => w.id !== 'gala' || st.career.stage === 'pro').map((w) => h('button.btn.block', { style: { textAlign: 'left' }, disabled: p.money < w.cost, onclick: () => { sfx.cash(); const r = planWedding(st, w.id); if (r?.text) toast(r.text); app.commit(); } },
        h('div.row.between', h('b', w.label), h('span.small', M$(w.cost))), h('div.tiny.muted', w.desc))))));
  } else {
    out.append(h('div.card', h('div.card-title', h('h3', `Married to ${p.partnerName}`), h('span.tiny.muted', `since ${F.wedding.year}`)),
      h('p.small.muted', `${WEDDINGS.find((w) => w.id === F.wedding.kind)?.label ?? 'Wedding'} in ${F.wedding.year}.`)));
  }
  const ff = p.family ?? F;
  out.append(h('div.card', h('div.card-title', h('h3', 'Kids'), h('span.tiny.muted', ff.expecting ? `Baby due in ${ff.expecting.weeks} weeks` : `${ff.kids?.length ?? 0} kid${(ff.kids?.length ?? 0) === 1 ? '' : 's'}`)),
    ff.kids?.length ? kidsList(st, ff) : h('p.small.muted', 'No kids yet.'),
    !ff.expecting && (ff.kids?.length ?? 0) < 4 && ff.tried !== st.career.year && F.wedding
      ? h('button.btn.small', { style: { marginTop: '8px' }, onclick: () => { sfx.click(); const r = tryForBaby(st); if (r?.text) toast(r.text); app.commit(); } }, 'Talk about starting a family') : null,
    heirName(p) ? h('p.tiny.muted', { style: { marginTop: '8px' } }, `When you retire, ${heirName(p)} can carry on the ${p.last} name in a new career.`) : null));
  return out;
}
function kidsList(st, F) {
  return h('div.list', F.kids.map((k) => h('div.li', h('span', { style: { fontSize: '1.3rem' } }, kidAge(st, k) < 3 ? '👶' : k.sex === 'm' ? '👦' : '👧'), h('div.grow', h('b.small', k.name), h('div.tiny.muted', `${k.sex === 'm' ? 'Son' : 'Daughter'} · ${kidAge(st, k) === 0 ? 'newborn' : `${kidAge(st, k)} years old`}`)))));
}

/** Life > Giving: your foundation. */
export function givingView(app) {
  const st = app.state;
  const p = st.player;
  const F = st.foundation;
  if (!F) {
    if (!canFound(st)) return h('div.card', h('h3', 'Charity foundation'), h('p.small.muted', 'In college and the pros you can start your own foundation and give back to your hometown.'));
    return h('div.card', h('h3', 'Start a foundation'), h('p.small.muted', 'Pick the cause closest to your heart. Donations unlock programs and community events that build fame, mood and your legacy.'),
      h('div.col', { style: { gap: '8px', marginTop: '8px' } }, CAUSES.map((c) => h('button.btn.block', { style: { textAlign: 'left' }, onclick: () => { sfx.select(); startFoundation(st, c.id); app.commit(); } }, h('b', c.label), h('div.tiny.muted', c.desc)))));
  }
  const next = LEVELS[F.level + 1];
  const amounts = st.career.stage === 'pro' ? [10000, 100000, 1000000] : [1000, 5000, 25000];
  const cause = CAUSES.find((c) => c.id === F.cause);
  return h('div.col', { style: { gap: '14px' } },
    h('div.card.hero', h('div.card-title', h('h2', F.name), h('span.chip.pix.gold', `LEVEL ${F.level}`)),
      h('p.small.muted', cause?.desc),
      h('div.bigstat', h('div', h('b', M$(F.donated)), h('span', 'Donated')), h('div', h('b', F.kids.toLocaleString('en-US')), h('span', 'Kids helped')), h('div', h('b', F.events), h('span', 'Events'))),
      next ? h('div', { style: { marginTop: '8px' } }, h('div.tiny.muted', `Next level at ${M$(next)}`), h('div.goal-bar', h('i', { style: { width: `${Math.min(100, (F.donated / next) * 100)}%` } }))) : h('p.small.good', 'Max level: a national foundation.'),
      F.humanitarian.length ? h('p.small', `🏅 Humanitarian of the Year: ${F.humanitarian.join(', ')}`) : null),
    h('div.card', h('h3', 'Donate'), h('div.row.wrap', { style: { gap: '8px' } }, amounts.map((a) => h('button.btn.small', { disabled: p.money < a, onclick: () => { sfx.cash(); const r = donate(st, a); if (r?.text) toast(r.text); app.commit(); } }, M$(a))))),
    h('div.card', h('h3', 'Community event'), h('p.small.muted', 'Spend a free day this week with the kids your foundation helps. Big fame and mood boost.'),
      h('button.btn.small.primary', { onclick: () => { sfx.select(); const r = hostEvent(st); if (r?.text) toast(r.text); app.commit(); } }, 'Host an event (uses a day)')),
    h('div.card', h('h3', 'Programs'), h('div.list', PROGRAMS.map((pr) => h(`div.li${F.level >= pr.level ? '' : '.locked'}`, h('span', F.level >= pr.level ? '✅' : '🔒'), h('div.grow', h('b.small', pr.label), h('div.tiny.muted', `Level ${pr.level} · ${pr.desc}`)))))),
    h('p.tiny.muted', 'In the pros, a strong foundation and community work can win Humanitarian of the Year, and it all counts toward your legacy.'));
}

/** Season review: Humanitarian award and the mentee's report. */
export function offFieldReview(r) {
  const out = [];
  if (r?.humanitarian) out.push(h('div.card.unlock-card', h('h3', '🏅 Humanitarian of the Year'), h('p.small', 'For everything your foundation did for the community this season.')));
  if (r?.mentor) out.push(h('div.card', h('h3', `🧑‍🏫 ${r.mentor.name}'s season`), h('p.small', `${r.mentor.from} → ${r.mentor.to} overall (${r.mentor.grew >= 0 ? '+' : ''}${r.mentor.grew}). ${r.mentor.line}`), r.mentor.done ? h('p.tiny.good', r.mentor.made ? 'He made it. He joins your coaching tree.' : 'He graduates from your mentorship.') : null));
  return out;
}

/** Week tab: hurt for 2+ weeks? Pick a rehab plan. */
export function rehabCard(app) {
  const st = app.state;
  const p = st.player;
  if (!p.injury) return null;
  if (!canRehab(st)) {
    if (!p.injury.plan) return null;
    const plan = REHAB_PLANS.find((x) => x.id === p.injury.plan);
    return h('div.card.rehab-card', h('div.card-title', h('h3', '🩹 Rehab'), h('span.chip.pix', plan.label.toUpperCase())), h('p.small.muted', `${p.injury.weeks} week${p.injury.weeks === 1 ? '' : 's'} to go. ${plan.desc}`));
  }
  return h('div.card.rehab-card',
    h('div.card-title', h('h3', '🩹 Rehab plan'), h('span.tiny.muted', `${p.injury.label} · ${p.injury.weeks} weeks`)),
    h('p.small.muted', 'How do you want to come back?'),
    h('div.col', { style: { gap: '8px', marginTop: '6px' } }, REHAB_PLANS.filter((r) => r.id !== 'elite' || st.career.stage !== 'hs').map((r) => h('button.btn.block', {
      style: { textAlign: 'left' }, disabled: r.id === 'elite' && p.money < eliteCost(st),
      onclick: () => { sfx.click(); const res = chooseRehab(st, r.id); if (res?.text) toast(res.text); app.commit(); },
    }, h('div.row.between', h('b', r.label), r.id === 'elite' ? h('span.small', fmtMoney(eliteCost(st))) : null), h('div.tiny.muted', r.desc)))));
}

/** Season review: award night. Finalists, then open the envelope. */
export function awardNightCard(app) {
  const st = app.state;
  const an = st.review?.awardNight;
  if (!an) return null;
  const card = h('div.card.award-night');
  const draw = (phase) => {
    clear(card);
    card.append(h('div.an-kicker.pix', 'AWARD NIGHT'), h('h2.an-title', an.award), h('p.tiny.muted', 'And the finalists are...'),
      h('div.an-finalists', an.finalists.map((f) => h(`div.an-f${phase === 'open' && f.name === an.winner ? '.win' : phase === 'open' ? '.lose' : ''}${f.you ? '.you' : ''}`,
        h('b', f.you ? 'You' : f.name), h('span.tiny.muted', f.team), h('span.tiny', `season rating ${f.perf}`)))));
    if (phase === 'wait') card.append(h('button.btn.primary.block', { style: { marginTop: '10px' }, onclick: () => { sfx.click(); draw('drum'); setTimeout(() => { an.opened = true; app.save(); draw('open'); if (an.youWon) sfx.cheer?.(true); else sfx.click(); }, app.settings.reducedMotion ? 50 : 1600); } }, '✉️ Open the envelope'));
    else if (phase === 'drum') card.append(h('div.an-envelope', '✉️'), h('p.center.small.muted', 'The envelope, please...'));
    else card.append(h(`p.an-result${an.youWon ? '.good' : ''}`, an.youWon ? `🏆 The ${an.award} goes to... YOU!` : `The ${an.award} goes to ${an.winner}.`),
      an.youWon ? null : h('p.tiny.muted', 'Being a finalist is an honor. Next year.'));
  };
  draw(an.opened ? 'open' : 'wait');
  return card;
}

/** Career tab (veterans): the farewell tour. */
export function farewellCard(app) {
  const st = app.state;
  if (isFarewellSeason(st)) {
    const F = st.farewell;
    return h('div.card.farewell-card', h('div.card-title', h('h3', '👋 Farewell Tour'), h('span.chip.gold.pix', 'FINAL SEASON')),
      h('p.small.muted', 'Every road stadium is sending you off. When this season ends, you retire.'),
      F.gifts.length ? h('div.list', F.gifts.map((g) => h('div.li', h('span', '🎁'), h('div.grow', h('b.small', g.gift), h('div.tiny.muted', `from the ${g.team}`))))) : h('p.tiny.muted', 'Your first road game is coming. Bring tissues.'));
  }
  if (!canAnnounceFarewell(st)) return null;
  return h('div.card.farewell-card', h('h3', '👋 Farewell tour'),
    h('p.small.muted', 'Announce that this season is your last. Every road team will honor you with a gift and an ovation, your teammates will play for you, and you retire at the end of the season on your own terms.'),
    h('button.btn.small', { onclick: async () => { if (!(await confirmDialog('Make this your final season?', 'You will retire when the season ends. This cannot be undone.', 'Announce it'))) return; sfx.cheer?.(true); announceFarewell(st); app.commit(); } }, 'Announce my final season'));
}
