// Game day: scoreboard with momentum, drive ticker, key moments (play call -> minigame),
// 4th-down decisions and mid-game events.
import { h, clear } from '../dom.js';
import { PLAY_CALLS, WEATHER } from '../../data/config.js';
import { getTeam } from '../../sim/league.js';
import {
  stepGame, resolveMoment, autoMoment, tolerance, outcomeFromQuality, resolveDecision, autoDecision,
  resolveGameEvent, autoGameEvent, MOMENT_NAMES,
} from '../../sim/game.js';
import * as flow from '../../sim/flow.js';
import { teamBadge, changeChips } from '../components.js';
import { sfx } from '../../audio/sfx.js';
import { runMinigame } from '../../scenes/director.js';
import { tipCard } from './tips.js';
import { icon } from '../icons.js';
import { teamKits, oppKitFor, kitUniform, KIT_IDS } from '../../data/kits.js';
import { randomLook, fmtSize } from '../../data/looks.js';
import { portraitImg } from '../../scenes/portrait.js';
import { clutchChallenge } from './drills.js';
import { tunnelCutscene } from '../../scenes/cutscenes.js';

/** Small pixel jersey icon for a kit. */
export function kitIcon(kit, number = '') {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 22');
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.classList.add('kit-ic');
  const rect = (x, y, w, hh, fill) => { const r = document.createElementNS(NS, 'rect'); Object.entries({ x, y, width: w, height: hh, fill }).forEach(([k, v]) => r.setAttribute(k, v)); svg.append(r); };
  rect(2, 3, 20, 7, '#0b0d10'); rect(5, 2, 14, 19, '#0b0d10');
  rect(3, 4, 18, 5, kit.jersey); rect(6, 3, 12, 17, kit.jersey);
  rect(3, 7, 3, 1, kit.trim); rect(18, 7, 3, 1, kit.trim);
  rect(10, 3, 4, 2, '#0b0d10');
  const t = document.createElementNS(NS, 'text');
  Object.entries({ x: 12, y: 16, 'text-anchor': 'middle', 'font-size': 8, 'font-family': 'Silkscreen, monospace', fill: kit.numbers }).forEach(([k, v]) => t.setAttribute(k, v));
  t.textContent = number;
  svg.append(t);
  return svg;
}

/** The kits both teams wear in the current game. */
export function gameKits(st, me, opp) {
  const g = st.game;
  const myId = g.kit ?? (g.userSide === 'home' ? 'home' : 'away');
  const mine = teamKits(me)[myId] ?? teamKits(me).home;
  const theirs = oppKitFor(mine, opp, g.userSide !== 'home');
  return { myId, mine, theirs };
}

const CALL_DESC_DEF = {
  safe: 'Play soft. Fewer big plays, fewer picks.',
  balanced: 'Mirror and react.',
  risky: 'Press and jump routes. Picks or burns.',
};

export function gamedayScreen(app) {
  const st = app.state;
  const g = st.game;
  const league = st.league;
  const home = getTeam(league, g.homeId);
  const away = getTeam(league, g.awayId);
  const defense = st.player.position === 'CB' || st.player.position === 'DT';
  const root = h('div');
  const gid = `${g.homeId}-${g.awayId}-${g.week}`;
  const ui = app.ui.game && app.ui.game.id === gid ? app.ui.game
    : (app.ui.game = { id: gid, shown: g.log.length, started: g.log.length > 0 || !!g.pending || g.pregameDone, busy: false });

  // ---- Scoreboard + momentum
  const ptsAway = h('span.pts', g.score.away);
  const ptsHome = h('span.pts', g.score.home);
  const clock = h('div.clock', g.roundName);
  const momBar = h('i');
  const side = (t, pts, right, isUser) => h(`div.side${right ? '.right' : ''}`,
    h('span.abbr', { style: { background: t.colors[0], color: t.colors[1] } }, t.id), pts, isUser ? h('span.user-mark', { title: 'Your team' }) : null);
  root.append(h('div.scoreboard',
    h('div.sb', side(away, ptsAway, false, g.userSide === 'away'), clock, side(home, ptsHome, true, g.userSide === 'home')),
    h('div.momentum', momBar),
    h('div.momentum-label', h('span', 'THEM'), h('span', 'MOMENTUM'), h('span', 'YOU'))));
  const setMomentum = () => {
    const v = g.momentum;
    momBar.className = v < 0 ? 'neg' : '';
    momBar.style.left = v >= 0 ? '50%' : `${50 + v * 50}%`;
    momBar.style.width = `${Math.abs(v) * 50}%`;
  };
  setMomentum();

  const body = h('div.screen');
  root.append(body);
  const momentSlot = h('div.col');
  const controls = h('div.col');
  const ticker = h('div.ticker');
  body.append(momentSlot, controls, ticker);

  const tickEl = (e) => h(`div.tick${e.out === 'TD' ? '.td' : e.out === 'TO' || e.out === 'DOWNS' ? '.to' : ''}${e.key ? '.key' : ''}${e.out === 'INFO' || e.out === 'HALF' ? '.info' : ''}`,
    h('span.q', e.q === 'OT' ? 'OT' : e.q ? `Q${e.q} ${e.clock}` : ''),
    h('span', e.team ? h('b', `${e.team} `) : null, e.text),
    h('span.sc', e.score));
  for (const e of g.log.slice(0, ui.shown).reverse()) ticker.append(tickEl(e));

  const fast = app.settings.reducedMotion;
  const bump = (el, v) => {
    if (el.textContent !== String(v)) { el.textContent = v; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  };
  const setScore = () => { bump(ptsAway, g.score.away); bump(ptsHome, g.score.home); setMomentum(); };

  const reveal = (done) => {
    const step = () => {
      if (ui.shown >= g.log.length) { setScore(); done(); return; }
      const e = g.log[ui.shown++];
      ticker.prepend(tickEl(e));
      if (e.out === 'TD' && e.user) sfx.cheer();
      else sfx.tick();
      setScore();
      if (e.q) clock.textContent = e.q === 'OT' ? 'Overtime' : `Q${e.q} · ${e.clock}`;
      setTimeout(step, fast || ui.skipAnim ? 0 : 240);
    };
    step();
  };

  const advance = () => {
    const r = stepGame(st);
    app.save();
    reveal(() => {
      if (r.type === 'moment') showMoment(r.moment);
      else if (r.type === 'decision') showDecision(r.decision);
      else if (r.type === 'gameEvent') showGameEvent(r.event);
      else showEnd();
    });
  };

  const resultCard = (result, m) => {
    const good = m.defense ? result.int || result.pd || result.forcedFumble || (result.tackle && (result.yardsAllowed ?? 99) < m.distance) : result.td || (result.complete && result.yards >= m.distance);
    const bad = m.defense ? result.tdAllowed || (result.yardsAllowed ?? 0) >= 15 : result.turnover || result.sack;
    return h('div.card.flat', { style: { boxShadow: `inset 4px 0 0 ${good ? 'var(--good)' : bad ? 'var(--bad)' : 'var(--line2)'}` } },
      h('b', result.text ?? ''), result.played ? h('span.small.muted', ` · execution ${Math.round(result.quality * 100)}%`) : null);
  };

  const finishMoment = (result) => {
    const m = g.pending;
    resolveMoment(st, result);
    app.save();
    if (result.td || result.int || result.defTD) sfx.touchdown();
    else if ((result.turnover && !m.defense) || result.tdAllowed) sfx.groan();
    clear(momentSlot);
    momentSlot.append(resultCard(result, m));
    advance();
  };

  const showMoment = (m) => {
    clear(momentSlot);
    clear(controls);
    const tolTxt = (c) => `${Math.round(tolerance(st, c, m.type) * 100)}% window`;
    const w = WEATHER[g.weather];
    const card = h('div.card.moment-card',
      h('div.row.between',
        h('div.row', { style: { gap: '6px' } }, h('span.chip.gold.pix', icon('bolt'), defense ? 'DEFENSE' : 'KEY MOMENT'), m.situation ? h('span.chip.bad.pix', m.situation.toUpperCase()) : null, m.fourth ? h('span.chip.info.pix', '4TH DOWN') : null),
        h('span.small.muted', `Q${m.quarter} ${m.clock}`)),
      h('h2', { style: { marginTop: '10px' } }, m.label),
      h('p.small.muted', `${MOMENT_NAMES[m.type] ?? 'Key moment'}${m.trailing ? ' · you are trailing' : ''}${g.weather !== 'clear' && g.weather !== 'night' ? ` · ${w.label.toLowerCase()}` : ''}. Pick a play call:`),
      h('div.calls', Object.entries(PLAY_CALLS).map(([id, c]) => h(`button.btn.call.${id}`, { onclick: () => play(m, id) },
        c.label, h('span.cd', defense ? CALL_DESC_DEF[id] : c.desc), h('span.tw', tolTxt(id))))),
      h('button.btn.small.ghost.block', { style: { marginTop: '8px' }, onclick: () => { sfx.click(); finishMoment(autoMoment(st, 'balanced')); } }, 'Sim this play'));
    const tip = tipCard(app, 'moment', 'Key moments', 'Safe plays are easier with smaller gains. Risky plays are harder but can break open. Your ratings, health, freshness, weather and momentum set the timing window.');
    if (tip) momentSlot.append(tip);
    momentSlot.append(card);
    controls.append(simRestBtn());
  };

  const showDecision = (d) => {
    clear(momentSlot);
    clear(controls);
    sfx.select();
    momentSlot.append(h('div.card.decision',
      h('div.row', { style: { gap: '6px' } }, h('span.chip.info.pix', '4TH DOWN')),
      h('h2', { style: { marginTop: '10px' } }, `4th and ${d.distance} at ${d.yardLine <= 50 ? 'OPP' : 'OWN'} ${d.yardLine <= 50 ? d.yardLine : 100 - d.yardLine}`),
      h('p.small.muted', d.fgRange ? 'You are in field goal range. Kick it, or go for the first down?' : 'Punt it away, or go for it?'),
      h('div.row', { style: { marginTop: '8px' } },
        h('button.btn.primary.grow', { onclick: () => { sfx.whistle(); resolveDecision(st, true); app.save(); clear(momentSlot); advance(); } }, 'Go for it'),
        h('button.btn.grow', { onclick: () => { sfx.click(); resolveDecision(st, false); app.save(); clear(momentSlot); advance(); } }, d.fgRange ? 'Kick FG' : 'Punt'))));
  };

  const showGameEvent = (ev) => {
    clear(momentSlot);
    clear(controls);
    sfx.select();
    const card = h('div.card', { style: { borderColor: 'var(--accent)' } });
    const draw = () => {
      card.append(
        h('div.kicker.pix', { style: { color: 'var(--accent)', fontSize: '0.64rem', letterSpacing: '0.12em' } }, 'DURING THE GAME'),
        h('h2', { style: { marginTop: '4px' } }, ev.title),
        h('p', { style: { margin: '8px 0 12px' } }, ev.text),
        h('div.col', ev.choices.map((c, i) => h('button.btn.block.choice', {
          onclick: () => {
            sfx.click();
            if (c.play && !app.ui.game?.skipAnim) {
              clutchChallenge({ title: c.label, kind: c.play, p: c.p ?? 0.5 }, (ok) => showRes(i, ok));
              return;
            }
            showRes(i);
          },
        }, h('span', c.label), c.risky ? h('span.dice', icon(c.play === 'mash' ? 'bolt' : 'target'), c.play === 'mash' ? ' MASH' : ' CLUTCH') : null))));
    };
    const showRes = (i, forced) => {
            const res = resolveGameEvent(st, i, forced);
            app.save();
            clear(card);
            card.append(h('h2', ev.title), h('p', { style: { margin: '8px 0' } }, res.text), changeChips(res.changes),
              h('button.btn.primary.block', { onclick: () => { clear(momentSlot); setScore(); advance(); } }, 'Back to the game'));
            setScore();
    };
    draw();
    momentSlot.append(card);
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
      tolerance: tolerance(st, call, m.type),
      stats: st.player.stats,
      position: st.player.position,
      teamColors: me.colors,
      oppColors: opp.colors,
      teamUniform: kitUniform(gameKits(st, me, opp).mine),
      oppUniform: kitUniform(gameKits(st, me, opp).theirs),
      look: st.player.look,
      number: st.player.number,
      lastName: st.player.last,
      userHome: g.userSide === 'home',
      teamName: me.name,
      oppName: opp.name,
      scoreInfo: { home: home.name, away: away.name, homePts: g.score.home, awayPts: g.score.away, homeColors: home.colors, awayColors: away.colors, clock: `Q${m.quarter} ${m.clock}` },
      homeColors: home.colors,
      showTips: app.settings.tutorials && !app.settings.seenTips?.[`mg_${m.type}`],
      markTip: () => { app.settings.seenTips = { ...(app.settings.seenTips ?? {}), [`mg_${m.type}`]: true }; app.saveSettings(); },
      reducedMotion: app.settings.reducedMotion,
      blood: app.settings.blood !== false,
      health: st.player.health,
    });
    ui.busy = false;
    if (res.fallbackQuality !== undefined) res = outcomeFromQuality(st, m, res.fallbackQuality, call);
    finishMoment({ ...res, call, played: true });
  };

  const simRestBtn = () => h('button.btn.small.ghost.block', {
    onclick: () => {
      sfx.click();
      ui.skipAnim = true;
      for (let guard = 0; guard < 300; guard++) {
        if (g.pendingEvent) { resolveGameEvent(st, autoGameEvent(st)); continue; }
        if (g.pendingDecision) { resolveDecision(st, autoDecision(st)); continue; }
        if (g.pending) { resolveMoment(st, autoMoment(st, 'balanced')); continue; }
        const r = stepGame(st);
        if (r.type === 'end') break;
      }
      clear(momentSlot);
      clear(controls);
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
      h('div.display', { style: { fontSize: '2.2rem', color: won ? 'var(--good)' : 'var(--bad)' } }, won ? 'VICTORY' : 'DEFEAT'),
      h('p.muted', `${away.city} ${g.score.away} · ${home.city} ${g.score.home}`),
      h('button.btn.primary.block', { onclick: () => { sfx.click(); flow.finishGame(st); app.ui.game = null; app.commit(); } }, 'Postgame Report')));
  };

  // ---- Uniform picker + lineup preview
  function kitPicker() {
    const me = getTeam(league, st.career.teamId);
    const opp = getTeam(league, g.oppId);
    const box = h('div.kit-picker');
    const draw = () => {
      clear(box);
      const { myId, mine, theirs } = gameKits(st, me, opp);
      const kits = teamKits(me);
      const star = randomLook(`${opp.id}-star`, { position: { CB: 'WR', DT: 'OL', QB: 'DL', RB: 'LB', WR: 'CB' }[st.player.position] ?? 'CB' });
      box.append(
        h('div.lineup',
          h('div.lineup-side', portraitImg({ uniform: kitUniform(mine), look: st.player.look, number: st.player.number, helmet: false }, 120, { full: true, big: true, yaw: -0.5 }), h('span.lineup-size.pix', fmtSize(st.player.look))),
          h('div.lineup-vs.pix', 'VS'),
          h('div.lineup-side', portraitImg({ uniform: kitUniform(theirs), look: star, number: 1 + (opp.id.charCodeAt(0) % 40), helmet: false }, 120, { full: true, big: true, yaw: 0.5 }), h('span.lineup-size.pix', fmtSize(star)))),
        h('div.section-label', 'Choose your uniform'),
        h('div.kit-row',
          KIT_IDS.map((id) => h(`button.kit-btn${myId === id ? '.on' : ''}`, { 'aria-label': kits[id].label, onclick: () => { sfx.click(); g.kit = id; app.save(); draw(); } },
            kitIcon(kits[id], st.player.number), h('span.tiny', kits[id].label))),
          h('div.kit-opp', kitIcon(theirs, ''), h('span.tiny.muted', `${opp.name}: ${theirs.label}`))));
    };
    draw();
    return box;
  }

  // ---- Initial state
  if (!ui.started) {
    const opp = getTeam(league, g.oppId);
    const w = WEATHER[g.weather];
    momentSlot.append(h('div.card.hero',
      h('div.matchup',
        h('div.team-badge', teamBadge(away, 64), h('span.nm', away.city), h('span.rec', `${away.w}-${away.l}`)),
        h('span.vs', '@'),
        h('div.team-badge', teamBadge(home, 64), h('span.nm', home.city), h('span.rec', `${home.w}-${home.l}`))),
      h('div.weather-row',
        h('span.chip', icon(w.icon), w.label, g.wind?.mph >= 4 ? ` · wind ${g.wind.mph} mph` : ''),
        g.rivalry ? h('span.chip.bad', icon('flame'), `Rivalry vs ${opp.name}`) : null,
        g.isTitle ? h('span.chip.gold', icon('trophy'), g.roundName) : g.playoff ? h('span.chip.info', g.roundName) : null),
      w.desc ? h('p.center.tiny.muted', { style: { marginTop: '8px' } }, w.desc) : null,
      h('p.center.small.muted', { style: { marginTop: '10px' } }, g.sitOut ? 'You are sitting out this one.'
        : `${g.drives.filter((d) => d.moment).length}+ ${defense ? 'defensive snaps' : 'key moments'} expected · freshness ${Math.round((st.week.freshness ?? 0) * 100)}%`),
      g.sitOut ? null : kitPicker(),
      h('button.btn.primary.block.big', { style: { marginTop: '12px' }, onclick: async () => {
        const stage = st.career.stage;
        st.career.tunnelSeen ??= {};
        if (!g.sitOut && !st.career.tunnelSeen[stage] && !app.settings.reducedMotion) {
          st.career.tunnelSeen[stage] = true;
          app.save();
          const me = getTeam(league, st.career.teamId);
          const { mine } = gameKits(st, me, getTeam(league, g.oppId));
          await tunnelCutscene({ colors: me.colors, uniform: kitUniform(mine), look: st.player.look, number: st.player.number, teamName: me.name,
            title: { hs: 'Friday Night Lights', college: 'Welcome to College Football', pro: 'Welcome to the League' }[stage] ?? 'Game Time', sub: `${me.city} ${me.name} take the field` });
        }
        sfx.whistle(); ui.started = true; clear(momentSlot); controls.append(simRestBtn()); advance();
      } },
        g.sitOut ? 'Watch from the sideline' : 'Kick Off')));
  } else if (g.finished) showEnd();
  else if (g.pendingEvent) showGameEvent(g.pendingEvent);
  else if (g.pendingDecision) showDecision(g.pendingDecision);
  else if (g.pending) showMoment(g.pending);
  else setTimeout(advance, 50);
  return root;
}
