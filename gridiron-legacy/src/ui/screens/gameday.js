// Game day: scoreboard with momentum, drive ticker, key moments (play call -> minigame),
// 4th-down decisions and mid-game events.
import { h, clear } from '../dom.js';
import { PLAY_CALLS, WEATHER } from '../../data/config.js';
import { getTeam } from '../../sim/league.js';
import {
  stepGame, resolveMoment, autoMoment, tolerance, outcomeFromQuality, resolveDecision, autoDecision,
  resolveGameEvent, autoGameEvent, MOMENT_NAMES, setGamePlan,
} from '../../sim/game.js';
import { crest } from '../crest.js';
import { teamCulture, BIOME_INFO } from '../../data/culture.js';
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

/** Mini field diagram showing where you line up. */
export function positionDiagram(pos) {
  // offense formation (x 0..100, y 0..100 with the line of scrimmage at y=55)
  const off = { QB: [50, 70], RB: [50, 82], WR1: [8, 57], WR2: [92, 57], SL: [24, 59], TE: [66, 58], OL1: [38, 57], OL2: [44, 57], OL3: [50, 57], OL4: [56, 57], OL5: [62, 57] };
  const def = { DT1: [44, 50], DT2: [56, 50], DE1: [34, 50], DE2: [66, 50], LB1: [40, 40], LB2: [60, 40], CB1: [8, 46], CB2: [92, 46], NB: [24, 44], SS: [36, 26], FS: [64, 22] };
  const me = { QB: 'QB', RB: 'RB', WR: 'WR2', CB: 'CB2', DT: 'DT2' }[pos];
  const dots = (set, color) => Object.entries(set).map(([k, [x, y]]) => `<rect x="${x - 2.5}" y="${y - 2.5}" width="5" height="5" fill="${k === me ? '#ffd43b' : color}" stroke="#000" stroke-width="0.8"/>${k === me ? `<rect x="${x - 5}" y="${y - 5}" width="10" height="10" fill="none" stroke="#ffd43b" stroke-width="1"/>` : ''}`).join('');
  const svg = `<svg viewBox="0 0 100 100" width="100%" height="100%" shape-rendering="crispEdges">
    <rect width="100" height="100" fill="#2f6f35"/>${[10, 20, 30, 40, 60, 70, 80, 90].map((y) => `<rect x="0" y="${y}" width="100" height="0.6" fill="rgba(255,255,255,0.35)"/>`).join('')}
    <rect x="0" y="53.5" width="100" height="1" fill="#4dabf7"/>${dots(off, '#e9ecef')}${dots(def, '#ff6b6b')}</svg>`;
  return h('div.pos-diagram', { html: svg });
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
  const culture = teamCulture(home, st.career.stage);
  const gid = `${g.homeId}-${g.awayId}-${g.week}`;
  const ui = app.ui.game && app.ui.game.id === gid ? app.ui.game
    : (app.ui.game = { id: gid, shown: g.log.length, started: g.log.length > 0 || !!g.pending || g.pregameDone, busy: false });

  // ---- Scoreboard + momentum
  const ptsAway = h('span.mh-pts', g.score.away);
  const ptsHome = h('span.mh-pts', g.score.home);
  const clock = h('div.mh-clock', g.roundName);
  const sideEl = (t, right, isUser) => h(`div.mh-side${right ? '.r' : ''}`, crest(t, 44), h('div.mh-name', t.city), h('div.mh-sub', `${t.name}${isUser ? ' ★' : ''}`));
  // momentum / possession chart: one bar per drive, markers for scores and turnovers
  const chart = h('canvas.mh-chart', { width: 600, height: 120 });
  const momPct = h('div.mh-mompct');
  root.append(h('div.match-head',
    h('div.mh-top', h('span.pix', league.kind === 'pro' ? 'PRO LEAGUE' : league.kind === 'college' ? 'COLLEGE' : 'HIGH SCHOOL'), h('span.tiny', `${culture.stadium} · Wk ${(g.week ?? 0) + 1}`)),
    h('div.mh-row', sideEl(away, false, g.userSide === 'away'), h('div.mh-score', ptsAway, h('div.mh-mid', h('span.mh-live', '● LIVE'), clock), ptsHome), sideEl(home, true, g.userSide === 'home'))),
    h('div.mh-chartbox', momPct, chart, h('div.mh-axis', h('span', 'Q1'), h('span', 'Q2'), h('span', 'Q3'), h('span', 'Q4'))));
  const myColor = getTeam(league, st.career.teamId).colors[0];
  const drawChart = () => {
    const c2 = chart.getContext('2d');
    const W = 600;
    const H2 = 120;
    c2.clearRect(0, 0, W, H2);
    c2.fillStyle = 'rgba(255,255,255,0.08)';
    c2.fillRect(0, H2 / 2, W, 1);
    for (let i = 1; i < 4; i++) c2.fillRect((W / 4) * i, 0, 1, H2);
    const pts = g.chart ?? [];
    const n = Math.max(20, g.drives.length);
    const bw = W / n;
    const H_OUT = { TD: 1, FG: 0.62, PUNT: 0.28, TO: 0.45, DOWNS: 0.38 };
    pts.forEach((p, i) => {
      // one bar per drive: up = your team's drive, down = theirs; height = how it ended
      const up = p.user;
      const hgt = (H_OUT[p.out] ?? 0.3) * (H2 / 2 - 8);
      c2.fillStyle = p.out === 'TO' || p.out === 'DOWNS' ? '#ff5d5d' : up ? myColor : '#9aa3ad';
      c2.fillRect(i * bw + 1, up ? H2 / 2 - hgt : H2 / 2, Math.max(2, bw - 3), hgt);
      if (p.out === 'TD' || p.out === 'FG') {
        c2.fillStyle = up ? '#4ade80' : '#ffd43b';
        const y = up ? H2 / 2 - hgt - 10 : H2 / 2 + hgt + 2;
        c2.fillRect(i * bw + bw / 2 - 4, y, 8, 8);
        c2.fillStyle = '#0b0d10';
        c2.font = 'bold 8px monospace';
        c2.textAlign = 'center';
        c2.fillText(p.out === 'TD' ? 'T' : 'F', i * bw + bw / 2, y + 7);
      }
    });
    // momentum line
    c2.strokeStyle = 'rgba(255,255,255,0.8)';
    c2.lineWidth = 2;
    c2.beginPath();
    pts.forEach((p, i) => { const y = H2 / 2 - p.m * (H2 / 2 - 6); if (i) c2.lineTo(i * bw + bw / 2, y); else c2.moveTo(i * bw + bw / 2, y); });
    c2.stroke();
    const pct = Math.round(50 + (g.momentum ?? 0) * 50);
    momPct.innerHTML = `<b>${getTeam(league, st.career.teamId).name}</b> momentum <span>${pct}%</span>`;
  };
  const setMomentum = drawChart;
  setMomentum();

  const body = h('div.screen.match-body');
  root.append(body);
  const momentSlot = h('div.col');
  const controls = h('div.col');
  const headline = h('div.mh-headline', h('span.hl-q', ''), h('div.hl-text.pix', 'Kickoff coming up...'));
  const ticker = h('div.ticker.feed');
  body.append(headline, momentSlot, controls, ticker);

  // ---- bottom control bar: rating, energy, game plan, pause/speed
  ui.speed ??= 1;
  const ratingVal = h('b.rb-val');
  const ratingDelta = h('span.rb-delta');
  const spark = h('span.rb-spark');
  const energyFill = h('i');
  const energyVal = h('b.eb-val');
  const APPROACH = [['aggressive', 'ATTACKING'], ['balanced', 'BALANCED'], ['conservative', 'CAREFUL']];
  const INTENS = [['low', 'LOW'], ['mid', 'MID'], ['high', 'HIGH']];
  const cyc = (list, cur) => list[(list.findIndex(([k]) => k === cur) + 1) % list.length][0];
  const approachBtn = h('button.mb-btn.mb-appr');
  const intensBtn = h('button.mb-btn.mb-int');
  const pauseBtn = h('button.mb-btn.mb-sq', 'II');
  const speedBtn = h('button.mb-btn.mb-sq');
  const drawBar = () => {
    g.plan ??= { approach: 'balanced', intensity: 'mid' };
    ratingVal.textContent = (g.rating ?? 6).toFixed(1);
    const dl = g.lastDelta ?? 0;
    ratingDelta.textContent = Math.abs(dl) >= 0.05 ? `${dl > 0 ? '+' : ''}${dl.toFixed(1)}` : '';
    ratingDelta.className = `rb-delta ${dl > 0 ? 'good' : 'bad'}`;
    const hist = g.ratingHist ?? [6];
    const pts = hist.map((v, i) => `${(i / Math.max(1, hist.length - 1)) * 100},${24 - ((v - 3) / 7) * 24}`).join(' ');
    spark.innerHTML = `<svg viewBox="0 0 100 24" preserveAspectRatio="none" width="100%" height="100%"><polyline points="${pts}" fill="none" stroke="#ffd43b" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
    const e = Math.round(g.energy ?? 80);
    energyFill.style.width = `${e}%`;
    energyFill.style.background = e < 35 ? 'var(--bad)' : e < 60 ? 'var(--warn)' : 'var(--good)';
    energyVal.textContent = `${e}%`;
    approachBtn.innerHTML = `<small>APPROACH</small>${APPROACH.find(([k]) => k === g.plan.approach)[1]}`;
    approachBtn.dataset.v = g.plan.approach;
    intensBtn.innerHTML = `<small>INTENSITY</small>${INTENS.find(([k]) => k === g.plan.intensity)[1]}`;
    intensBtn.dataset.v = g.plan.intensity;
    pauseBtn.textContent = ui.paused ? '▶' : 'II';
    speedBtn.textContent = `x${ui.speed}`;
  };
  approachBtn.onclick = () => { sfx.click(); setGamePlan(st, 'approach', cyc(APPROACH, g.plan.approach)); app.save(); drawBar(); };
  intensBtn.onclick = () => { sfx.click(); setGamePlan(st, 'intensity', cyc(INTENS, g.plan.intensity)); app.save(); drawBar(); };
  pauseBtn.onclick = () => { sfx.click(); ui.paused = !ui.paused; drawBar(); };
  speedBtn.onclick = () => { sfx.click(); ui.speed = ui.speed >= 3 ? 1 : ui.speed + 1; drawBar(); };
  if (!g.sitOut) {
    root.append(h('div.match-bar',
      h('div.mb-rating', h('small', 'RATING'), h('div.row', { style: { gap: '6px', alignItems: 'baseline' } }, ratingVal, ratingDelta), spark),
      h('div.mb-energy', h('small', 'ENERGY'), h('div.eb-track', energyFill), energyVal),
      approachBtn, intensBtn, pauseBtn, speedBtn));
    drawBar();
  }

  const FEED_IC = { TD: ['trophy', '#4ade80'], FG: ['target', '#ffd43b'], TO: ['alert', '#ff5d5d'], DOWNS: ['alert', '#ff5d5d'], PUNT: ['ball', '#9aa3ad'], INFO: ['whistle', '#4da3ff'], HALF: ['clipboard', '#9aa3ad'] };
  const tickEl = (e) => h(`div.tick${e.out === 'TD' ? '.td' : e.out === 'TO' || e.out === 'DOWNS' ? '.to' : ''}${e.key ? '.key' : ''}${e.out === 'INFO' || e.out === 'HALF' ? '.info' : ''}`,
    h('span.f-ic', { style: { color: (FEED_IC[e.out] ?? FEED_IC.INFO)[1] } }, icon((FEED_IC[e.out] ?? FEED_IC.INFO)[0])),
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
      if (e.text && (e.key || e.out === 'TD' || e.out === 'TO' || e.out === 'INFO')) {
        headline.querySelector('.hl-q').textContent = e.q ? `Q${e.q} ${e.clock ?? ''}` : '';
        headline.querySelector('.hl-text').textContent = e.text.replace(/^[^:]*: /, '');
        headline.classList.remove('flash'); void headline.offsetWidth; headline.classList.add('flash');
      }
      if (e.out === 'TD') touchdownBanner(e);
      drawBar?.();
      const wait = () => (ui.paused && !ui.skipAnim ? setTimeout(wait, 150) : setTimeout(step, fast || ui.skipAnim ? 0 : 520 / (ui.speed ?? 1)));
      wait();
    };
    step();
  };

  /** Big TOUCHDOWN banner with the scoring team's crest. */
  const touchdownBanner = (e) => {
    if (ui.skipAnim || fast) return;
    const t = getTeam(league, e.team) ?? home;
    const b = h('div.td-banner', { style: { '--c1': t.colors[0], '--c2': t.colors[1] } }, h('span.pix', 'TOUCHDOWN!'), crest(t, 40));
    root.append(b);
    setTimeout(() => b.remove(), 1800);
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
          onclick: (e) => {
            if (card.dataset.busy) return; // one choice only (Space/Enter can re-trigger a focused button)
            card.dataset.busy = '1';
            e?.currentTarget?.blur?.();
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
      stage: st.career.stage,
      culture,
      song: culture.song,
      bigGame: !!(g.playoff || g.rivalry),
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
    // keep highlight pictures for the menus (last 8)
    if (res.highlights?.length) {
      st.highlights ??= [];
      for (const hl of res.highlights) st.highlights.unshift({ img: hl.img, label: hl.label, opp: opp.name, oppId: opp.id, week: (league.week ?? 0) + 1, year: st.career.year });
      st.highlights.length = Math.min(st.highlights.length, 8);
    }
    delete res.highlights;
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
        h('div.row', { style: { gap: '10px', alignItems: 'center' } }, positionDiagram(st.player.position), h('div.grow', h('div.section-label', 'Where you line up'), h('p.tiny.muted', `You're the highlighted square. ${{ QB: 'Under center, running the show.', RB: 'Behind the QB, ready for the handoff.', WR: 'Split out wide on the right.', CB: 'Across from their top receiver.', DT: 'In the trenches, over the guard.' }[st.player.position] ?? ''}`))),
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
        h('span.vs.pix', 'AT'),
        h('div.team-badge', teamBadge(home, 64), h('span.nm', home.city), h('span.rec', `${home.w}-${home.l}`))),
      h('div.weather-row',
        h('span.chip', icon(w.icon), w.label, g.wind?.mph >= 4 ? ` · wind ${g.wind.mph} mph` : ''),
        g.rivalry ? h('span.chip.bad', icon('flame'), `Rivalry vs ${opp.name}`) : null,
        g.isTitle ? h('span.chip.gold', icon('trophy'), g.roundName) : g.playoff ? h('span.chip.info', g.roundName) : null),
      w.desc ? h('p.center.tiny.muted', { style: { marginTop: '8px' } }, w.desc) : null,
      h('div.venue-card',
        h('div.vc-head', h('b.pix', culture.stadium), h('span.tiny.muted', `"${culture.nickname}" · ${BIOME_INFO[culture.biome].label}`)),
        h('p.tiny', culture.tradition),
        h('div.row.wrap', { style: { gap: '6px', marginTop: '6px' } },
          h(`span.chip.pix${g.userSide === 'away' ? '.bad' : '.good'}`, `HOME FIELD: ${culture.trait.label.toUpperCase()}`),
          h('span.tiny.muted', g.userSide === 'away' ? culture.trait.desc : 'Your crowd gives you a small lift.')),
        culture.crowd !== 'normal' ? h('p.tiny', { style: { marginTop: '6px' } }, `Fans are doing a ${culture.crowd === 'whiteout' ? 'WHITEOUT' : culture.crowd === 'blackout' ? 'BLACKOUT' : 'COLOR RUSH'} tonight.`) : null),
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
          await tunnelCutscene({ stage, culture: teamCulture(me, stage), colors: me.colors, uniform: kitUniform(mine), look: st.player.look, number: st.player.number, teamName: me.name,
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
