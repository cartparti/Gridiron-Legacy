// Game day: scoreboard, drive ticker, and key moments (play call -> 3D minigame).
import { h, clear } from '../dom.js';
import { PLAY_CALLS } from '../../data/config.js';
import { getTeam } from '../../sim/league.js';
import { stepGame, resolveMoment, autoMoment, tolerance, outcomeFromQuality } from '../../sim/game.js';
import * as flow from '../../sim/flow.js';
import { teamBadge } from '../components.js';
import { sfx } from '../../audio/sfx.js';
import { runMinigame } from '../../scenes/director.js';
import { tipCard } from './tips.js';

const MOMENT_NAMES = { qb_throw: 'Pass Play', rb_run: 'Run Play', wr_catch: 'Route & Catch' };

export function gamedayScreen(app) {
  const st = app.state;
  const g = st.game;
  const league = st.league;
  const home = getTeam(league, g.homeId);
  const away = getTeam(league, g.awayId);
  const root = h('div');
  const ui = app.ui.game && app.ui.game.id === `${g.homeId}-${g.awayId}-${g.week}` ? app.ui.game
    : (app.ui.game = { id: `${g.homeId}-${g.awayId}-${g.week}`, shown: g.log.length, started: g.log.length > 0 || !!g.pending, busy: false });

  // Scoreboard
  const ptsAway = h('span.pts', g.score.away);
  const ptsHome = h('span.pts', g.score.home);
  const clock = h('div.clock', g.roundName);
  const side = (t, pts, right, isUser) => h(`div.side${right ? '.right' : ''}`,
    h('span.abbr', { style: { background: t.colors[0], color: t.colors[1] } }, t.id), pts, isUser ? h('span.user-mark', { title: 'Your team' }) : null);
  root.append(h('div.scoreboard', h('div.sb', side(away, ptsAway, false, g.userSide === 'away'), clock, side(home, ptsHome, true, g.userSide === 'home'))));

  const body = h('div.screen');
  root.append(body);
  const momentSlot = h('div');
  const controls = h('div.col');
  const ticker = h('div.ticker');
  body.append(momentSlot, controls, ticker);

  const tickEl = (e) => h(`div.tick${e.out === 'TD' ? '.td' : e.out === 'TO' ? '.to' : ''}${e.key ? '.key' : ''}`,
    h('span.q', e.q === 'OT' ? 'OT' : `Q${e.q} ${e.clock}`),
    h('span', h('b', e.team), ` ${e.text}`),
    h('span.sc', e.score));
  // Already-shown entries (e.g. after reload)
  for (const e of g.log.slice(0, ui.shown).reverse()) ticker.append(tickEl(e));

  const fast = app.settings.reducedMotion;
  const setScore = () => {
    if (ptsAway.textContent !== String(g.score.away)) { ptsAway.textContent = g.score.away; ptsAway.classList.remove('bump'); void ptsAway.offsetWidth; ptsAway.classList.add('bump'); }
    if (ptsHome.textContent !== String(g.score.home)) { ptsHome.textContent = g.score.home; ptsHome.classList.remove('bump'); void ptsHome.offsetWidth; ptsHome.classList.add('bump'); }
  };

  /** Reveal new log entries one at a time, then call done. */
  const reveal = (done) => {
    const step = () => {
      if (ui.shown >= g.log.length) { setScore(); done(); return; }
      const e = g.log[ui.shown++];
      ticker.prepend(tickEl(e));
      if (e.out === 'TD') { if (e.user) sfx.cheer(); }
      else sfx.tick();
      setScore();
      clock.textContent = e.q === 'OT' ? 'Overtime' : `Q${e.q} · ${e.clock}`;
      setTimeout(step, fast || ui.skipAnim ? 0 : 260);
    };
    step();
  };

  const advance = () => {
    const r = stepGame(st);
    app.save();
    reveal(() => {
      if (r.type === 'moment') showMoment(r.moment);
      else showEnd();
    });
  };

  const finishMoment = (result) => {
    resolveMoment(st, result);
    app.save();
    if (result.td) sfx.touchdown();
    else if (result.turnover) sfx.groan();
    clear(momentSlot);
    momentSlot.append(h(`div.card.flat${result.td ? '.good' : ''}`, { style: { borderColor: result.td ? 'var(--good)' : result.turnover ? 'var(--bad)' : 'var(--line)' } },
      h('b', result.text ?? ''), result.played ? h('span.small.muted', ` · execution ${Math.round(result.quality * 100)}%`) : null));
    advance();
  };

  const showMoment = (m) => {
    clear(momentSlot);
    clear(controls);
    const tolTxt = (c) => `${Math.round(tolerance(st, c) * 100)}% window`;
    const card = h('div.card.moment-card',
      h('div.row.between', h('span.chip.gold', '⚡ KEY MOMENT'), m.clutch ? h('span.chip.bad', 'CLUTCH') : null, h('span.small.muted', `Q${m.quarter} ${m.clock}`)),
      h('h2', { style: { marginTop: '8px' } }, m.label),
      h('p.small.muted', `${MOMENT_NAMES[m.type]}${m.trailing ? ' · you are trailing' : ''}. Pick a play call:`),
      h('div.calls', Object.entries(PLAY_CALLS).map(([id, c]) => h(`button.btn.call.${id}`, {
        onclick: () => play(m, id),
      }, c.label, h('span.cd', c.desc), h('span.cd', tolTxt(id))))),
      h('button.btn.small.ghost.block', { style: { marginTop: '8px' }, onclick: () => { sfx.click(); finishMoment(autoMoment(st, 'balanced')); } }, 'Sim this play'));
    momentSlot.append(card);
    const tip = tipCard(app, 'moment', 'Key moments', 'Safe plays are easier with smaller gains. Risky plays are harder but can break open. Your ratings, health and game-day freshness set the timing window.');
    if (tip) momentSlot.prepend(tip);
    controls.append(simRestBtn());
  };

  const play = async (m, call) => {
    if (ui.busy) return;
    ui.busy = true;
    sfx.whistle();
    const me = getTeam(league, st.career.teamId);
    const opp = getTeam(league, g.oppId);
    let res = await runMinigame(m.type, {
      moment: m,
      call,
      tolerance: tolerance(st, call),
      stats: st.player.stats,
      position: st.player.position,
      teamColors: me.colors,
      oppColors: opp.colors,
      homeColors: home.colors,
      showTips: app.settings.tutorials && !app.settings.seenTips?.[`mg_${m.type}`],
      markTip: () => { app.settings.seenTips = { ...(app.settings.seenTips ?? {}), [`mg_${m.type}`]: true }; app.saveSettings(); },
      reducedMotion: app.settings.reducedMotion,
    });
    ui.busy = false;
    if (res.fallbackQuality !== undefined) res = outcomeFromQuality(st, m, res.fallbackQuality, call);
    finishMoment({ ...res, call, played: true });
  };

  const simRestBtn = () => h('button.btn.small.ghost.block', {
    onclick: () => {
      sfx.click();
      ui.skipAnim = true;
      if (st.game.pending) resolveMoment(st, autoMoment(st, 'balanced'));
      for (;;) {
        const r = stepGame(st);
        if (r.type === 'end') break;
        resolveMoment(st, autoMoment(st, 'balanced'));
      }
      clear(momentSlot);
      reveal(showEnd);
    },
  }, 'Sim rest of game');

  const showEnd = () => {
    clear(momentSlot);
    clear(controls);
    const won = g.won;
    if (won) sfx.cheer(true); else sfx.groan();
    clock.textContent = 'FINAL';
    momentSlot.append(h('div.card.center',
      h('div.display', { style: { fontSize: '2.4rem', color: won ? 'var(--good)' : 'var(--bad)' } }, won ? 'VICTORY' : 'DEFEAT'),
      h('p.muted', `${away.city} ${g.score.away} · ${home.city} ${g.score.home}`),
      h('button.btn.primary.block', { onclick: () => { sfx.click(); flow.finishGame(st); app.ui.game = null; app.commit(); } }, 'Postgame Report')));
  };

  // Initial state
  if (!ui.started) {
    const opp = getTeam(league, g.oppId);
    momentSlot.append(h('div.card',
      h('div.matchup',
        h('div.team-badge', teamBadge(away, 64), h('span.nm', `${away.city}`), h('span.rec', `${away.w}-${away.l}`)),
        h('span.vs', '@'),
        h('div.team-badge', teamBadge(home, 64), h('span.nm', `${home.city}`), h('span.rec', `${home.w}-${home.l}`))),
      g.rivalry ? h('p.center.bad', { style: { marginTop: '8px' } }, h('b', `🔥 Rivalry game vs ${opp.name}`)) : null,
      g.isTitle ? h('p.center', h('b.warn', `🏆 ${g.roundName}`)) : null,
      h('p.center.small.muted', g.sitOut ? 'You are sitting out this one.' : `${g.drives.filter((d) => d.moment).length} key moments expected. Freshness ${Math.round((st.week.freshness ?? 0) * 100)}%.`),
      h('button.btn.primary.block', { style: { marginTop: '10px' }, onclick: () => { sfx.whistle(); ui.started = true; clear(momentSlot); controls.append(simRestBtn()); advance(); } }, g.sitOut ? 'Watch from the sideline' : 'Kick Off')));
  } else if (g.finished) showEnd();
  else if (g.pending) showMoment(g.pending);
  else setTimeout(advance, 50);
  return root;
}
