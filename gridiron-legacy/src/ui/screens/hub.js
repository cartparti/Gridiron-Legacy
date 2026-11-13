// Main career hub: top bar with meters, bottom tabs, and the five tab views.
import { friendsPage } from './friends.js';
import { achievementsPage, goalsCard } from './achievements.js';
import { activityFor } from '../../data/activities.js';
import { costumeSpec, mascotDisplayName } from '../../data/mascots.js';
import { awardLabel } from '../../sim/awards.js';
import { injuryInfo, injuryNote } from '../../sim/injury.js';
import { h, clear } from '../dom.js';
import { maybeTour } from '../onboarding.js';
import { seasonStakes, awardRace, depthScore } from '../../sim/career.js';
import { STAGES, DAYS, WEATHER } from '../../data/config.js';
import { POSITIONS } from '../../data/positions.js';
import { HOUSING, CARS, PERKS, INVESTMENTS } from '../../data/lifestyle.js';
import { RECORD_LABELS, seasonPerf, TROPHIES, awardWatch } from '../../sim/awards.js';
import { availableActivities, maxEnergy, planCost, ACTIVITY_BY_ID } from '../../sim/week.js';
import { getTeam, standings, roundName, capSpace, isDivisionLeague, projectedSeeds, leagueDivisions } from '../../sim/league.js';
import * as flow from '../../sim/flow.js';
import { fmtMoney, ordinal, fillTokens } from '../../core/util.js';
import { meter, teamBadge, jersey, ratingChart, statBars, openModal, changeChips, toast, confirmDialog } from '../components.js';
import { sfx } from '../../audio/sfx.js';
import { eventModal } from './event.js';
import { tipCard } from './tips.js';
import { icon, activityIcon } from '../icons.js';
import { peopleView, storeView } from './people.js';
import { placeCards, enterWorld } from './world.js';
import { openPhone, phoneBadge } from './phone.js';
import { openLookModal } from './look.js';
import { socialView } from './social.js';
import { lineupView } from './lineup.js';
import { homeView } from './home.js';
import { careerStatsSections, legendsPage, racePage, traitsPage } from './careerStats.js';
import { DRILLS, DRILL_NAMES, openDrill, grade } from './drills.js';
import { creditTraining } from '../../sim/progress.js';
import { teamKits } from '../../data/kits.js';
import { fmtSize } from '../../data/looks.js';
import { crest, mascotKind } from '../crest.js';
import { portraitImg } from '../../scenes/portrait.js';
import { people } from '../../sim/social.js';

function forecastRow(st) {
  const f = st.week?.forecast;
  if (!f) return null;
  const w = WEATHER[f];
  return h('div.row', { style: { marginTop: '10px', gap: '8px', alignItems: 'flex-start' } },
    h('span.chip.info', icon(w.icon), `Forecast: ${w.label}`),
    w.desc ? h('span.tiny.muted', { style: { flex: '1' } }, w.desc) : null);
}

const DONE_ICONS = { coach: 'clipboard', teammate: 'users', family: 'home', partner: 'heart', agent: 'briefcase', rival: 'flame', fan: 'star' };

const TABS = [
  ['week', 'calendar', 'Week'],
  ['team', 'ball', 'Team'],
  ['life', 'chat', 'Life'],
  ['career', 'star', 'Career'],
  ['news', 'news', 'News'],
];

export function topBar(app) {
  const st = app.state;
  const p = st.player;
  const team = getTeam(st.league, st.career.teamId);
  const stageLbl = st.career.stage === 'retired' ? 'Retired' : `${STAGES[st.career.stage].label} · Yr ${st.career.stageSeason}`;
  const wk = st.league.phase === 'playoffs' ? roundName(st.league, st.league.playoffs.round) : `Week ${st.league.week + 1}`;
  return h('header.topbar',
    h('div.who',
      h('div.ovr-badge', Math.round(p.ovr), h('small', 'OVR')),
      h('div.grow',
        h('div.name', `${p.first} ${p.last}`),
        h('div.sub', `${p.position === 'MS' ? `"${mascotDisplayName(p)}" · Mascot` : `#${p.number} ${p.position}`} · Age ${p.age} · ${team ? team.name : ''}`),
        h('div.sub', `${stageLbl} · ${st.career.year} · ${wk} · LV ${p.level ?? 1}${p.skillPoints ? ` · ${p.skillPoints} pts` : ''}`)),
      h('button.icon-btn.phone-btn', { 'aria-label': 'Phone', onclick: () => openPhone(app) }, icon('chat'), phoneBadge(st) ? h('span.app-badge', phoneBadge(st)) : null),
      h('button.icon-btn', { 'aria-label': 'Settings', onclick: () => { app.ui.back = 'career'; app.go('settings'); } }, icon('gear'))),
    h('div.meters',
      meter('Energy', maxEnergy(st), 12),
      meter('Mood', p.mood),
      meter('Health', p.health),
      meter('Fame', p.fame),
      meter('Bank', Math.max(0, Math.min(100, Math.log10(Math.max(1, p.money)) * 12)), 100, fmtMoney(p.money))));
}

export function hubScreen(app) {
  setTimeout(() => { if (app.state?.phase === 'plan' && !app.ui.world) maybeTour(app); }, 500);
  const st = app.state;
  const wrap = h('div');
  wrap.append(topBar(app));
  const body = h('div.screen');
  const views = { week: weekView, team: teamView, life: lifeView, career: careerView, news: newsView };
  body.append(views[app.hubTab](app));
  wrap.append(body);
  // decorations beside the app on wide screens: crest + highlight photos
  const myTeam = getTeam(st.league, st.career.teamId);
  if (myTeam) {
    const hl = (st.highlights ?? []).slice(0, 4);
    wrap.append(
      h('div.side-deco.left', crest(myTeam, 150), h('div.sd-name.pix', myTeam.name), h('div.sd-city', `${myTeam.city} · ${myTeam.w}-${myTeam.l}`)),
      h('div.side-deco.right', hl.length ? hl.map((x, i) => h('figure.polaroid', { style: { transform: `rotate(${[-6, 4, -3, 7][i]}deg)` } }, h('img', { src: x.img, alt: x.label }), h('figcaption', h('b', x.label), h('span', `vs ${x.opp}`))))
        : h('div.sd-empty.pix', 'Your highlights will hang here')));
  }
  wrap.append(h('nav.tabs', TABS.map(([id, ico, label]) =>
    h(`button.tab${app.hubTab === id ? '.on' : ''}`, { onclick: () => { sfx.click(); app.hubTab = id; app.render(); } },
      icon(ico), label))));
  if (st.phase === 'event' && st.pendingEvent) setTimeout(() => eventModal(app), 30);
  return wrap;
}

// ------------------------------------------------------------------ WEEK

/** Last 5 results as colored chips (newest last). */
function formChips(st, teamId) {
  const res = [];
  for (const wk of st.league.schedule) for (const gm of wk) if (gm.result && (gm.home === teamId || gm.away === teamId)) {
    const us = gm.home === teamId ? gm.result.home : gm.result.away;
    const them = gm.home === teamId ? gm.result.away : gm.result.home;
    res.push(us > them ? 'W' : 'L');
  }
  const last = res.slice(-5);
  while (last.length < 5) last.unshift('-');
  return h('div.form.form-lg', last.map((r) => h(`i.${r === 'W' ? 'w' : r === 'L' ? 'l' : 'n'}`, r)));
}

/** "The Stands": a scrolling ticker of fan posts. */
function standsTicker(st) {
  const posts = (st.news ?? []).filter((n) => n.kind === 'fan').slice(0, 6);
  if (!posts.length) return null;
  const line = posts.map((n) => `${n.handle}: ${n.text}`).join('   •   ');
  return h('div.stands', h('span.st-tag.pix', 'THE STANDS'), h('div.st-wrap', h('div.st-run', `${line}   •   ${line}`)));
}

function weekView(app) {
  const st = app.state;
  const p = st.player;
  const plan = st.week.plan; // shared with the walkable world: things done there fill these days
  if (app.ui.activeSlot === undefined || plan[app.ui.activeSlot]) app.ui.activeSlot = plan.findIndex((x) => !x);
  const max = maxEnergy(st);
  const cost = planCost(plan);
  const left = max - cost;
  const m = flow.currentMatchup(st);
  const status = flow.gameDayStatus(st);
  const acts = availableActivities(st);
  const tokens = { partner: p.partnerName ?? 'your partner', agent: p.agentName ?? 'your agent', business: p.business?.name ?? 'business' };
  const opp = m ? getTeam(st.league, m.oppId) : null;
  const me = getTeam(st.league, st.career.teamId);

  const setSlot = (i, id) => {
    plan[i] = id;
    app.save();
    const next = plan.findIndex((x) => !x);
    app.ui.activeSlot = next;
    app.render();
  };

  const container = h('div.col', { style: { gap: '14px' } });
  container.append(tipCard(app, 'week', 'Plan your week', 'Tap a day, then pick an activity. Each costs energy. Energy you save becomes freshness on game day, which makes the key-moment minigames more forgiving.'));
  if (st.week?.notice) container.append(h('div.card.flat', { style: { borderColor: 'var(--bad)' } }, h('b.bad', st.week.notice)));
  if (st.lastEventResult && app.ui.showEventResult) {
    container.append(h('div.card.flat', h('div.small.muted', st.lastEventResult.title), h('p', st.lastEventResult.result), changeChips(st.lastEventResult.changes)));
  }

  // Team banner: crest, mascot, record, streak, rank
  {
    const conf = st.league.kind === 'pro' ? (me.conf ?? me.div) : null;
    const rank = standings(st.league, conf).findIndex((t) => t.id === me.id) + 1;
    const streak = me.streak > 0 ? `W${me.streak}` : me.streak < 0 ? `L${-me.streak}` : '-';
    container.append(h('div.team-hero',
      h('div.th-crest', crest(me, 92)),
      h('div.th-info',
        h('div.th-kicker.pix', `${STAGES[st.career.stage]?.label ?? ''} · ${st.career.year}`),
        h('div.th-name.pix', me.name),
        h('div.th-city', me.city),
        h('div.th-stats',
          h('span', h('b', `${me.w}-${me.l}`), ' record'),
          h('span', h('b', streak), ' streak'),
          h('span', h('b', `#${rank}`), conf ? ` ${conf}` : ' league')))));
  }

  // Highlight reel: pictures from your big plays
  const reel = st.highlights ?? [];
  container.append(h('div.card.reel-card',
    h('div.card-title', h('h3', 'Highlight Reel'), h('span.tiny.muted', reel.length ? `${reel.length} clip${reel.length === 1 ? '' : 's'}` : 'Make some plays!')),
    h('div.reel', reel.length ? reel.map((x, i) => h(`figure.polaroid${i % 2 ? '.tilt' : ''}`, h('img', { src: x.img, alt: x.label }), h('figcaption', h('b', x.label), h('span', `vs ${x.opp} · Wk ${x.week}`))))
      : [0, 1, 2].map(() => h('figure.polaroid.empty', h('div.ph', crest(me, 40)), h('figcaption', h('b', 'Your highlight'), h('span', 'TDs, big hits, picks')))))));

  // Matchup card
  if (m && opp) {
    const home = m.home;
    container.append(h('div.card.hero',
      h('div.card-title', h('h3', m.playoff ? roundName(st.league, st.league.playoffs.round) : `Week ${st.league.week + 1} of ${st.league.schedule.length}`),
        h('div.row', { style: { gap: '6px' } }, h('span.chip.pix', home ? 'HOME' : 'AWAY'), opp.id === st.career.rivalTeamId ? h('span.chip.bad.pix', icon('flame'), 'RIVAL') : null)),
      h('div.matchup',
        h('div.team-badge', teamBadge(me, 56), h('span.nm', me.name), h('span.rec', `${me.w}-${me.l}`), formChips(st, me.id)),
        h('span.vs.pix', home ? 'VS' : 'AT'),
        h('div.team-badge', teamBadge(opp, 56), h('span.nm', opp.name), h('span.rec', `${opp.w}-${opp.l}`), formChips(st, opp.id))),
      standsTicker(st),
      h('div.row.between.small.muted', { style: { marginTop: '8px' } },
        h('span', `Your OFF ${Math.round(me.off)} · DEF ${Math.round(me.def)}`),
        h('span', `Their OFF ${Math.round(opp.off)} · DEF ${Math.round(opp.def)}`)),
      forecastRow(st)));
  }

  // the coach's goals for this season
  { const gc = goalsCard(app); if (gc) container.append(gc); }

  // Season stakes: your role on the depth chart, the playoff race and the award race
  container.append(seasonCard(st));

  // Walkable places: doing things there fills your days.
  container.append(h('div.card',
    h('div.card-title', h('h3', 'Go somewhere'), h('span.tiny.muted', 'Activities there fill your days')),
    placeCards(app, (id) => enterWorld(app, id))));

  // Energy + days
  const pips = [];
  for (let i = 0; i < max; i++) pips.push(h(`span.pip${i >= left ? '.used' : ''}`));
  container.append(h('div.card',
    h('div.card-title', h('h3', 'This Week'), h('span.small', h('b', `${left}`), ` / ${max} energy left`)),
    h('div.pips', pips),
    h('div.days', { style: { marginTop: '12px' } }, DAYS.map((d, i) => {
      const e = plan[i];
      if (e && typeof e === 'object') {
        return h('button.slot.filled.done', { 'aria-label': `${d}: ${e.label}`, title: 'Already done this week' },
          h('span.day', d), icon(DONE_ICONS[e.icon] ?? 'check'), h('span', e.label), h('span.tiny', e.cost ? `−${e.cost} energy` : 'done'));
      }
      const a = e ? activityFor(ACTIVITY_BY_ID[e], st.player.position) : null;
      return h(`button.slot${a ? '.filled' : ''}${app.ui.activeSlot === i ? '.active' : ''}`, {
        'aria-label': `${d}: ${a ? a.label : 'empty'}`,
        onclick: () => { sfx.click(); if (a) { plan[i] = null; if (st.week.drills) delete st.week.drills[i]; app.ui.activeSlot = i; app.save(); } else app.ui.activeSlot = i; app.render(); },
      }, h('span.day', d), a ? activityIcon(a.id) : icon('plus'), h('span', a ? a.label : 'Free'), a ? h('span.tiny', a.cost ? `−${a.cost} energy` : 'free') : null);
    })),
    h('p.tiny.muted', { style: { marginTop: '8px' } }, `Game-day freshness: ${Math.round((left / max) * 100)}%. Tap a filled day to clear it.`)));

  // Playable training drills for planned training days
  const drillSlots = plan.map((id, i) => ({ id, i })).filter(({ id }) => typeof id === 'string' && DRILLS[id]);
  if (drillSlots.length) {
    container.append(h('div.card',
      h('div.card-title', h('h3', 'Training Drills'), h('span.tiny.muted', 'Play them for bigger gains')),
      h('div.col', { style: { gap: '8px' } }, drillSlots.map(({ id, i }) => {
        const q = st.week.drills?.[i];
        return h('div.row.drill-row',
          activityIcon(id),
          h('div.grow', h('b.small', `${DAYS[i]} · ${activityFor(ACTIVITY_BY_ID[id], st.player.position).label}`), h('div.tiny.muted', DRILL_NAMES[DRILLS[id]])),
          q !== undefined ? h('span.chip.gold.pix', `GRADE ${grade(q)}`) : null,
          h(`button.btn.small${q === undefined ? '.primary' : ''}`, { onclick: () => {
            sfx.click();
            openDrill(id, (res) => {
              st.week.drills ??= {};
              const cr = creditTraining(st, res, q);
              st.week.drills[i] = Math.max(res, q ?? 0);
              app.save(); app.render();
              if (cr.points) { sfx.levelUp(); toast(`+${cr.points} SKILL POINT from training! Spend it in Career.`); }
              else if (cr.gain) toast(`Training points +${Math.round(cr.gain * 100)}%`);
            });
          } }, q === undefined ? '▶ Play' : 'Retry'));
      })),
      h('div.train-pts', h('div.row', h('b.tiny.pix', 'TRAINING POINTS'), h('span.grow'), h('span.tiny', `${Math.round((p.trainPts ?? 0) * 100)}% to next skill point`)),
        h('div.watch-bar', h('i', { style: { width: `${Math.min(100, (p.trainPts ?? 0) * 100)}%` } }))),
      h('p.tiny.muted', { style: { marginTop: '8px' } }, 'Great drills give up to +50% training that day and earn training points (A+ 60%, A 45%, B 30%, C 15%). Every 100% = 1 skill point. Skip it for normal gains.')));
  }

  // Activity picker
  if (app.ui.activeSlot >= 0) {
    const groups = {};
    for (const a of acts) (groups[a.group] ??= []).push(a);
    const grid = h('div.acts');
    for (const [g, list] of Object.entries(groups)) {
      grid.append(h('div.group-label', g));
      for (const a of list) {
        const a2 = activityFor(a, st.player.position);
        const ok = a.cost <= left;
        grid.append(h('button.act', { disabled: !ok, onclick: () => { sfx.select(); setSlot(app.ui.activeSlot, a.id); } },
          activityIcon(a.id),
          h('span.t', h('span', a2.label), h('span.cost', a.cost ? `${a.cost}⚡` : 'FREE')),
          h('span.d', fillTokens(a2.desc, tokens))));
      }
    }
    container.append(h('div.card', h('h3', `Pick an activity for ${DAYS[app.ui.activeSlot]}`), grid));
  }

  // Game day button
  let playHurt = app.ui.playHurt ?? false;
  const hurtToggle = status.hurt
    ? h('div.card.flat', { style: { borderColor: 'var(--warn)' } },
      h('p', h('b.warn', `Injured: ${status.reason}.`), ` ${injuryNote(st.player.injury, st.player.position)} `, status.injury === 'questionable' ? 'Playing shrinks your timing windows a lot and slows you down.' : 'Playing costs you a little timing.'),
      h('div.row', h(`button.subtab${!playHurt ? '.on' : ''}`, { onclick: () => { app.ui.playHurt = false; app.render(); } }, 'Sit out & heal'),
        h(`button.subtab${playHurt ? '.on' : ''}`, { onclick: () => { app.ui.playHurt = true; app.render(); } }, 'Play hurt')))
    : null;
  if (hurtToggle) container.append(hurtToggle);
  else if (!status.canPlay && status.injury) container.append(h('div.card.flat', { style: { borderColor: 'var(--bad)' } }, h('p', h('b.bad', `${status.reason}.`), ` ${injuryNote(st.player.injury, st.player.position)}`)));
  const cantPlay = !status.canPlay;
  container.append(h('button.btn.primary.block', {
    style: { minHeight: '58px', fontSize: '1.2rem' },
    onclick: () => {
      sfx.whistle();
      try {
        flow.submitPlan(st, plan, { playHurt });
      } catch (e) {
        toast('That plan uses more energy than you have.');
        return;
      }
      app.ui.activeSlot = undefined;
      app.ui.playHurt = false;
      app.ui.showEventResult = false;
      app.commit();
    },
  }, icon('whistle'), cantPlay ? `Game Day (out: ${status.reason})` : status.hurt && !playHurt ? 'Game Day (sitting out)' : 'Go to Game Day'));
  return container;
}

// ------------------------------------------------------------------ TEAM

function seasonCard(st) {
  const p = st.player;
  const d = p.depth;
  const sk = seasonStakes(st);
  const race = awardRace(st).slice(0, 5);
  const myRank = awardRace(st).findIndex((r) => r.you) + 1;
  const prog = d ? Math.max(0, Math.min(100, 50 + (depthScore(st) - d.rival.ovr) * 10)) : 0;
  return h('div.card.season-card',
    h('div.card-title', h('h3', 'Your Season'), sk ? h('span.chip.pix', sk.record) : null),
    d ? h('div.depth-box',
      h('div.row.between', h('b', d.role === 'starter' ? `Starting ${p.position === 'MS' ? 'mascot' : p.position}` : `Backup ${p.position === 'MS' ? 'mascot' : p.position}`), h('span.tiny.muted', d.role === 'starter' ? `Holding off ${d.rival.name} (${Math.round(d.rival.ovr)})` : `Behind ${d.rival.name} (${Math.round(d.rival.ovr)})`)),
      h('div.depth-bar', h('i', { style: { width: `${prog}%`, background: d.role === 'starter' ? 'var(--good)' : 'var(--accent)' } }), h('span.mark')),
      h('p.tiny.muted', d.role === 'starter' ? 'Keep playing well to keep the job. A few bad weeks and coach could make a change.' : 'Win the job: train hard, play well when you get your snaps, and keep coach happy. Backups only get a couple of late snaps.')) : null,
    sk ? h('div.stakes', h('div', h('b', `#${sk.rank}`), h('span', sk.conf ? `${sk.conf} Conf.` : sk.div ? sk.div : 'League')), h('div', h('b', sk.left), h('span', 'Games left')), h('div.wide', h('b.small', sk.status), h('span', 'Playoff race'))) : null,
    h('div.race', h('div.row.between', h('span.section-label', 'Award race'), h('span.tiny.muted', myRank ? `You: #${myRank}` : '')),
      race.map((r, i) => h(`div.race-row${r.you ? '.me' : ''}`, h('span.rk', i + 1), h('span.grow', r.name, h('span.tiny.muted', ` · ${r.team}`)), h('span.pts', r.perf ? Math.round(r.perf) : '—')))));
}

function teamView(app) {
  const st = app.state;
  const league = st.league;
  const sub = app.ui.teamSub ?? 'lineup';
  const tabs = h('div.subtabs', [['lineup', 'Lineup'], ['standings', 'Standings'], ['schedule', 'Schedule'], ['playoffs', 'Playoffs'], ['roster', 'Roster'], ['history', 'History']]
    .filter(([id]) => (id === 'roster' ? league.kind === 'pro' : id === 'history' ? st.proHistory.length || st.records : true))
    .map(([id, l]) => h(`button.subtab${sub === id ? '.on' : ''}`, { onclick: () => { app.ui.teamSub = id; app.render(); } }, l)));
  const out = h('div.col', { style: { gap: '14px' } }, h('h2', STAGES[league.kind].leagueName), tabs);
  if (sub === 'lineup') out.append(lineupView(app));
  else if (sub === 'standings') {
    const divLeague = isDivisionLeague(league);
    const proj = divLeague ? projectedSeeds(league) : null;
    const myDiv = getTeam(league, st.career.teamId)?.div;
    const confs = divLeague ? leagueDivisions(league).sort((a, b) => (a === myDiv ? -1 : b === myDiv ? 1 : 0)) : league.kind === 'pro' ? ['Summit', 'Coastal'] : league.kind === 'college' ? [...new Set(league.teams.map((t) => t.conf))].sort((a, b) => (a === getTeam(league, st.career.teamId).conf ? -1 : b === getTeam(league, st.career.teamId).conf ? 1 : 0)) : [null];
    // last-5 form from the schedule
    const form = {};
    for (const wk of league.schedule) for (const gm of wk) if (gm.result) {
      const hw = gm.result.home > gm.result.away;
      (form[gm.home] ??= []).push(hw ? 'W' : 'L');
      (form[gm.away] ??= []).push(hw ? 'L' : 'W');
    }
    const playoffSpots = 4;
    const nationwide = league.kind === 'college';
    const natRank = nationwide ? standings(league).map((t) => t.id) : null;
    for (const c of confs) {
      const rows = standings(league, c);
      const lead = rows[0];
      out.append(h('div.card.standings', c ? h('div.card-title', h('h3', divLeague ? `${c} Division` : `${c} Conference`), divLeague && proj.winners.find((t) => t.div === c) ? h('span.tiny.muted', 'Leader takes a playoff spot') : null) : null, h('div.scroll-x', h('table.tbl.stand',
        h('tr', h('th', '#'), h('th', 'Team'), h('th.num', 'W-L'), h('th.num', 'GB'), h('th.num', '+/-'), h('th', 'Last 5')),
        rows.map((t, i) => {
          const inPO = divLeague ? proj.seeds.includes(t) : nationwide ? natRank.indexOf(t.id) < playoffSpots : i < playoffSpots;
          const gb = ((lead.w - t.w) + (t.l - lead.l)) / 2;
          const diff = t.pf - t.pa;
          return h(`tr${t.id === st.career.teamId ? '.me' : ''}${inPO ? '.po' : ''}${i === playoffSpots - 1 && !nationwide && !divLeague ? '.cut' : ''}`,
            h('td', i + 1),
            h('td', h('div.row', { style: { gap: '6px', flexWrap: 'nowrap' } }, teamBadge(t, 20), h('b.small', t.name), t.id === st.career.rivalTeamId ? h('span.rival-dot', { title: 'Rival' }, icon('flame')) : null)),
            h('td.num', `${t.w}-${t.l}`), h('td.num', gb ? (gb % 1 ? gb.toFixed(1) : gb) : '-'),
            h(`td.num.${diff > 0 ? 'good' : diff < 0 ? 'bad' : ''}`, `${diff > 0 ? '+' : ''}${diff}`),
            h('td', h('div.form', (form[t.id] ?? []).slice(-5).map((r) => h(`i.${r === 'W' ? 'w' : 'l'}`, r)))));
        })))));
    }
    out.append(h('p.tiny.muted', divLeague ? 'Highlighted: the 5 division winners plus the 3 best other records (wild cards) make the playoffs.' : league.kind === 'pro' ? 'Highlighted: top 4 in each conference make the playoffs.' : nationwide ? 'Highlighted: the top 4 records nationwide make the playoff.' : 'Highlighted: top 4 make the playoffs.'));
  } else if (sub === 'schedule') {
    out.append(h('div.card', h('div.list', league.schedule.map((wk, i) => {
      const g = wk.find((x) => x.home === st.career.teamId || x.away === st.career.teamId);
      if (!g) return null;
      const home = g.home === st.career.teamId;
      const opp = getTeam(league, home ? g.away : g.home);
      let res = h('span.muted.small', i === league.week && league.phase === 'regular' ? 'THIS WEEK' : '');
      if (g.result) {
        const us = home ? g.result.home : g.result.away;
        const them = home ? g.result.away : g.result.home;
        res = h(`b.${us > them ? 'good' : 'bad'}`, `${us > them ? 'W' : 'L'} ${us}-${them}`);
      }
      return h('div.li', h('span.muted.small', { style: { width: '44px' } }, `Wk ${i + 1}`), teamBadge(opp, 26), h('span.grow', `${home ? 'vs' : '@'} ${opp.city} ${opp.name}`), res);
    }))));
  } else if (sub === 'playoffs') {
    if (!league.playoffs) out.append(h('div.card', h('p.muted', 'The playoff bracket is set after the regular season.')));
    else {
      league.playoffs.rounds.forEach((r, ri) => out.append(h('div.card', h('h3', roundName(league, ri)), h('div.list', r.map((g) => {
        const a = getTeam(league, g.away);
        const hm = getTeam(league, g.home);
        return h('div.li', teamBadge(a, 24), h('span', a.name), h('b', g.result ? g.result.away : ''), h('span.muted', '@'), teamBadge(hm, 24), h('span.grow', hm.name), h('b', g.result ? g.result.home : ''));
      })))));
    }
  } else if (sub === 'roster') {
    const roster = league.players.filter((x) => x.teamId === st.career.teamId).sort((a, b) => b.ovr - a.ovr);
    const team = getTeam(league, st.career.teamId);
    out.append(h('div.card',
      h('div.row.between.small', h('span', `Cap space: ${fmtMoney(capSpace(league, team.id))}`), h('span', `OFF ${Math.round(team.off)} · DEF ${Math.round(team.def)}`)),
      h('div.scroll-x', h('table.tbl', h('tr', h('th', 'Pos'), h('th', 'Name'), h('th.num', 'Age'), h('th.num', 'OVR'), h('th.num', 'Salary'), h('th.num', 'Yrs')),
        h('tr.me', h('td', st.player.position), h('td', `${st.player.first} ${st.player.last}`), h('td.num', st.player.age), h('td.num', Math.round(st.player.ovr)), h('td.num', fmtMoney(st.player.contract?.salary ?? 0)), h('td.num', st.player.contract?.years ?? '-')),
        roster.map((x) => h('tr', h('td', x.pos), h('td', `${x.first} ${x.last}`), h('td.num', x.age), h('td.num', x.ovr), h('td.num', fmtMoney(x.salary)), h('td.num', x.years)))))));
  } else if (sub === 'history') {
    if (st.records) {
      out.append(h('div.card', h('h3', 'Record Book (single season)'), h('table.tbl', Object.entries(st.records.season).map(([k, r]) =>
        h(`tr${r.user ? '.me' : ''}`, h('td', RECORD_LABELS[k]), h('td.num', r.value.toLocaleString()), h('td', r.holder), h('td.num', r.year))))));
      out.append(h('div.card', h('h3', 'Record Book (career)'), h('table.tbl', Object.entries(st.records.career).map(([k, r]) =>
        h(`tr${r.user ? '.me' : ''}`, h('td', RECORD_LABELS[k]), h('td.num', r.value.toLocaleString()), h('td', r.holder), h('td.num', r.year))))));
    }
    if (st.proHistory.length) {
      out.append(h('div.card', h('h3', `${STAGES.pro.titleName} Champions`), h('div.list', st.proHistory.slice().reverse().slice(0, 30).map((y) => {
        const t = getTeam(league, y.champion) ?? { id: y.champion, city: y.champion, name: '', colors: ['#555', '#fff'] };
        return h('div.li', h('span.muted.small', { style: { width: '44px' } }, y.year), teamBadge(t, 24), h('span.grow', `${t.city} ${t.name}`), y.mvp ? h('span.chip.gold', `MVP ${y.mvp}`) : null);
      }))));
    }
  }
  return out;
}

// ------------------------------------------------------------------ LIFE


function lifeView(app) {
  const st = app.state;
  const p = st.player;
  const sub = app.ui.lifeSub ?? 'social';
  const out = h('div.col', { style: { gap: '14px' } },
    h('div.subtabs', [['social', 'Social'], ['home', 'Home'], ['people', 'People'], ['store', 'Store'], ['money', 'Money'], ['lifestyle', 'Housing & Cars'], ['invest', 'Invest']].map(([id, l]) =>
      h(`button.subtab${sub === id ? '.on' : ''}`, { onclick: () => { app.ui.lifeSub = id; app.render(); } }, l))));
  if (sub === 'social') out.append(socialView(app));
  else if (sub === 'home') out.append(homeView(app));
  else if (sub === 'people') {
    out.append(peopleView(app));
    if (st.career.stage !== 'pro') out.append(h('div.card', h('h3', 'Grades'), h('div.statbar', h('span', 'Academics'), h('div.track', h('div.fill', { style: { width: `${p.academics}%`, background: p.academics < 40 ? 'var(--bad)' : undefined } })), h('span.val', Math.round(p.academics))), h('p.tiny.muted', 'Drop below 30 and you are ineligible. Study Hall raises it.')));
  } else if (sub === 'store') {
    out.append(storeView(app));
  } else if (sub === 'money') {
    const house = HOUSING.find((x) => x.id === p.housing);
    const car = CARS.find((x) => x.id === p.car);
    const weeklyPerks = p.perks.reduce((a, id) => a + (PERKS.find((x) => x.id === id)?.weekly ?? 0), 0);
    out.append(h('div.card', h('h3', 'Bank'), h('div.display', { style: { fontSize: '2.2rem', color: p.money < 0 ? 'var(--bad)' : 'var(--good)' } }, fmtMoney(p.money)),
      h('div.list',
        p.contract ? h('div.li', h('span.grow', `Contract: ${fmtMoney(p.contract.salary)}/yr`), h('span.muted', `${p.contract.years} yr left`)) : null,
        h('div.li', h('span.grow', `Rent: ${house.label}`), h('span.bad', `−${fmtMoney(house.rent)}/wk`)),
        h('div.li', h('span.grow', `Car: ${car.label}`), h('span.bad', `−${fmtMoney(car.upkeep)}/wk`)),
        weeklyPerks ? h('div.li', h('span.grow', 'Staff & perks'), h('span.bad', `−${fmtMoney(weeklyPerks)}/wk`)) : null,
        p.business ? h('div.li', h('span.grow', `Business: ${p.business.name}`), h('span.good', 'passive income')) : null)));
    out.append(h('div.card', h('h3', 'Sponsors'), p.sponsors.length ? h('div.list', p.sponsors.map((s) => h('div.li', h('span.grow', h('b', s.brand), ` · ${s.product}`), h('span.good', `${fmtMoney(s.weekly)}/wk`), h('span.tiny.muted', `${s.weeks} wk`))))
      : h('p.small.muted', 'No sponsors yet. Fame, an agent and big games bring offers.')));
  } else if (sub === 'lifestyle') {
    const stage = st.career.stage;
    out.append(h('div.card', h('h3', 'Housing'), h('p.tiny.muted', 'Rent is weekly. Nicer places lift your mood every week.'), h('div.list', HOUSING.filter((x) => x.stages.includes(stage) || x.id === p.housing).map((x) =>
      h('div.li', h('div.grow', h('b', x.label), h('div.tiny.muted', x.desc), h('div.tiny', `${fmtMoney(x.rent)}/wk · mood +${x.mood}`)),
        p.housing === x.id ? h('span.chip.good', 'Home') : h('button.btn.small', { onclick: async () => {
          if (!(await confirmDialog(`Move to ${x.label}?`, `Rent will be ${fmtMoney(x.rent)} per week.`, 'Move in'))) return;
          p.housing = x.id; if (x.fame) p.fame = Math.min(100, p.fame + x.fame); sfx.cash(); app.commit();
        } }, 'Move'))))));
    out.append(h('div.card', h('h3', 'Garage'), h('div.list', CARS.map((x) =>
      h('div.li', h('div.grow', h('b', x.label), h('div.tiny.muted', x.desc), h('div.tiny', `${fmtMoney(x.price)} · upkeep ${fmtMoney(x.upkeep)}/wk`)),
        p.car === x.id ? h('span.chip.good', 'Driving') : h('button.btn.small', { disabled: p.money < x.price, onclick: async () => {
          if (!(await confirmDialog(`Buy ${x.label}?`, `Costs ${fmtMoney(x.price)}. Your old ride is traded in for 30%.`, 'Buy'))) return;
          const old = CARS.find((c) => c.id === p.car);
          p.money += Math.round(old.price * 0.3) - x.price; p.car = x.id; p.flags.car_super = x.id === 'super'; p.fame = Math.min(100, p.fame + x.fame);
          sfx.cash(); app.commit();
        } }, 'Buy'))))));
    out.append(h('div.card', h('h3', 'Staff & Upgrades'), h('div.list', PERKS.map((x) =>
      h('div.li', h('div.grow', h('b', x.label), h('div.tiny.muted', x.desc), h('div.tiny', `${fmtMoney(x.price)}${x.weekly ? ` + ${fmtMoney(x.weekly)}/wk` : ''}`)),
        p.perks.includes(x.id) ? h('span.chip.good', 'Owned') : h('button.btn.small', { disabled: p.money < x.price, onclick: () => { p.money -= x.price; p.perks.push(x.id); sfx.cash(); toast(`${x.label} added!`); app.commit(); } }, 'Buy'))))));
  } else if (sub === 'invest') {
    out.append(h('div.card', h('h3', 'Investments'), h('p.small.muted', 'Returns are applied at the end of each season. Risky funds swing hard.'),
      h('div.list', INVESTMENTS.map((inv) => {
        const amt = p.investments[inv.id] ?? 0;
        const step = Math.max(500, Math.round(Math.max(0, p.money) * 0.1 / 500) * 500);
        return h('div.li', h('div.grow', h('b', inv.label), h('div.tiny.muted', inv.desc), h('div.small', `Invested: ${fmtMoney(amt)}`)),
          h('div.col', { style: { gap: '4px' } },
            h('button.btn.small', { disabled: p.money < step, onclick: () => { p.money -= step; p.investments[inv.id] = amt + step; sfx.cash(); app.commit(); } }, `+${fmtMoney(step)}`),
            h('button.btn.small.ghost', { disabled: amt <= 0, onclick: () => { p.money += amt; p.investments[inv.id] = 0; sfx.cash(); app.commit(); } }, 'Cash out')));
      }))));
  }
  return out;
}

// ------------------------------------------------------------------ CAREER

function careerView(app) {
  const sub = app.ui.careerSub ?? 'profile';
  const tabs = h('div.subtabs', [['profile', 'Career'], ['achievements', 'Achievements'], ['friends', 'Friends'], ['traits', 'Traits'], ['awards', 'Trophies'], ['race', 'Award Race'], ['legends', 'Legends'], ['league', 'League Awards']].map(([id, l]) =>
    h(`button.subtab${sub === id ? '.on' : ''}`, { onclick: () => { sfx.click(); app.ui.careerSub = id; app.render(); } }, l)));
  let body;
  if (sub === 'awards') body = awardsView(app);
  else if (sub === 'league') body = leagueAwardsView(app);
  else if (sub === 'legends') body = legendsPage(app);
  else if (sub === 'race') body = racePage(app);
  else if (sub === 'traits') body = traitsPage(app);
  else if (sub === 'friends') body = friendsPage(app);
  else if (sub === 'achievements') body = achievementsPage(app);
  else { body = profileView(app); body.append(...careerStatsSections(app)); }
  return h('div.col', { style: { gap: '14px' } }, tabs, body);
}

const STAGE_LABEL = { hs: 'High School', college: 'College', pro: 'Pro' };

/** Trophy case: individual awards, team titles, and the live award watch. */
function awardsView(app) {
  const st = app.state;
  const p = st.player;
  const all = Object.values(TROPHIES).flat();
  const kindOf = (n) => all.find((t) => t.name === n)?.kind ?? 'ind';
  const iconOf = (n) => all.find((t) => t.name === n)?.icon ?? 'medal';
  const counts = {};
  for (const a of p.awards) { counts[a.name] ??= { n: 0, years: [], stage: a.stage }; counts[a.name].n++; counts[a.name].years.push(a.year); }
  const tile = (name, c) => h(`div.trophy${c ? '' : '.locked'}${kindOf(name) === 'team' ? '.team' : ''}`,
    h('div.trophy-ic', icon(iconOf(name))), h('b.tiny', awardLabel(name, p.position)), c ? h('span.tiny.muted', `${c.n > 1 ? `${c.n}× · ` : ''}${c.years.join(', ')}`) : h('span.tiny.muted', 'Not yet'));
  const w = awardWatch(st);
  const madePO = p.history.filter((x) => x.madePlayoffs).length;
  const titles = p.history.filter((x) => x.champion);
  const best = p.history.slice().sort((a, b) => parseInt(b.record, 10) - parseInt(a.record, 10))[0];
  return h('div.col', { style: { gap: '14px' } },
    h('div.card.hero', h('div.card-title', h('h2', 'Award Watch'), h('span.chip.pix', `${STAGE_LABEL[st.career.stage] ?? ''} · ${st.career.year}`)),
      w.games ? [h('p.small.muted', `Season rating ${w.perf} after ${w.games} games · team ${Math.round(w.winPct * 100)}% wins`),
        ...w.rows.map((r) => h('div.watch-row', h('div.row.between', h('b.small', r.name), h(`span.tiny.${r.pct >= 1 ? 'good' : 'muted'}`, r.pct >= 1 ? 'ON PACE' : `${Math.round(r.pct * 100)}%`)),
          h('div.watch-bar', h('i', { style: { width: `${Math.min(100, r.pct * 100)}%` } }))))]
        : h('p.small.muted', 'Play some games to see how you stack up for this season\'s awards.')),
    h('div.card', h('h2', 'Individual Awards'),
      Object.entries(TROPHIES).map(([stage, list]) => h('div', h('div.section-label', { style: { margin: '10px 0 8px' } }, STAGE_LABEL[stage]),
        h('div.trophy-grid', list.filter((t) => t.kind === 'ind').map((t) => tile(t.name, counts[t.name])))))),
    h('div.card', h('h2', 'Team Achievements'),
      h('div.trophy-grid', Object.values(TROPHIES).flat().filter((t) => t.kind === 'team').map((t) => tile(t.name, counts[t.name]))),
      h('div.row.wrap', { style: { marginTop: '12px' } },
        h('span.chip', icon('trophy'), `${titles.length} title${titles.length === 1 ? '' : 's'}`),
        h('span.chip', icon('shield'), `${madePO} playoff trip${madePO === 1 ? '' : 's'}`),
        best ? h('span.chip', icon('crown'), `Best record ${best.record} (${best.year})`) : null)),
    p.records.length ? h('div.card', h('h2', 'Records Held'), h('div.row.wrap', p.records.map((r) => h('span.chip.gold', icon('scroll'), `${r.label} (${r.year})`)))) : null);
}

/** Who won what, every season of your career. */
function leagueAwardsView(app) {
  const st = app.state;
  const hist = (st.awardHistory ?? []).slice().reverse();
  if (!hist.length) return h('div.card', h('h2', 'League Awards'), h('p.small.muted', 'Award winners are announced at the end of each season.'));
  return h('div.col', { style: { gap: '14px' } }, hist.map((season) => h('div.card',
    h('div.card-title', h('h3', `${season.year} · ${STAGE_LABEL[season.stage]}`)),
    h('div.list', season.rows.map((r) => h(`div.li${r.you ? '.me' : ''}`,
      h('span.trophy-ic.sm', icon(r.team_ ? 'trophy' : 'medal')),
      h('div.grow', h('div.tiny.muted', r.name), h('b', r.winner, r.you ? ' (you)' : '')),
      r.pos ? h('span.chip.pix', r.pos) : null))))));
}

function profileView(app) {
  const st = app.state;
  const p = st.player;
  const team = getTeam(st.league, st.career.teamId);
  const s = p.seasonStats;
  const posLine = (x) => (p.position === 'QB' ? `${x.passComp}/${x.passAtt}, ${x.passYds} yds, ${x.passTD} TD, ${x.int} INT`
    : p.position === 'K' ? `${x.fgMade ?? 0}/${x.fgAtt ?? 0} FG (long ${x.fgLong ?? 0}), ${x.xpMade ?? 0}/${x.xpAtt ?? 0} XP, ${x.touchbacks ?? 0} touchbacks`
    : p.position === 'MS' ? `${x.hype ?? 0} hype, ${x.shirts ?? 0} shirts, ${x.danceWins ?? 0} showdown wins, ${x.stunts ?? 0} stunts`
    : p.position === 'DT' ? `${x.defSacks ?? 0} sacks, ${x.tfl ?? 0} TFL, ${x.tackles ?? 0} tkl`
    : p.position === 'CB' ? `${x.defInt ?? 0} INT, ${x.pd ?? 0} PD, ${x.tackles ?? 0} tkl, ${x.defTD ?? 0} TD · ${x.ydsAllowed ?? 0} yds allowed`
    : p.position === 'RB' ? `${x.rushAtt} car, ${x.rushYds} yds, ${x.rushTD} TD · ${x.rec} rec ${x.recYds} yds`
      : `${x.rec} rec, ${x.recYds} yds, ${x.recTD} TD · ${x.drops} drops`);
  const awardCounts = {};
  for (const a of p.awards) awardCounts[a.name] = (awardCounts[a.name] ?? 0) + 1;
  return h('div.col', { style: { gap: '14px' } },
    h('div.card', h('div.row',
      h('div.col', { style: { alignItems: 'center', gap: '6px' } },
        (people(st), p.position === 'MS'
          ? h('div.ms-profile', portraitImg({ mascot: costumeSpec(p.look, mascotKind(team), team.colors) }, 130, { full: true, big: true }), h('span.chip.gold.pix', 'MASCOT'))
          : portraitImg({ uniform: teamKits(team).home, look: p.look, number: p.number, helmet: false }, 130, { full: true, big: true })),
        h('button.btn.small', { onclick: () => { sfx.click(); openLookModal(app, { uniform: teamKits(team).home }); } }, icon('star'), p.position === 'MS' ? 'Edit costume' : 'Edit look')),
      h('div.col.grow', { style: { gap: '4px' } },
        h('h2', `${p.first} ${p.last}`),
        p.position === 'MS' ? h('span.small', h('b', `"${mascotDisplayName(p)}"`), ` · ${team.name} mascot`) : null,
        h('span.small.muted', `${POSITIONS[p.position].label} · ${p.hometown}`),
        p.look?.heightIn ? h('span.small', fmtSize(p.look)) : null,
        h('span.small', `${team.city} ${team.name}`),
        p.draft ? h('span.small.muted', p.position === 'MS' ? `Hired as the team mascot (${p.draft.year})` : p.draft.undrafted ? 'Undrafted free agent' : `Drafted ${ordinal(p.draft.pick)} overall (${p.draft.year})`) : null,
        p.injury ? h('span.chip.bad', icon('bandage'), `${p.injury.label} · ${injuryInfo(p.injury, p.position)?.label} · ${p.injury.weeks} wk`) : null,
        p.suspended ? h('span.chip.bad', `Suspended ${p.suspended}`) : null))),
    h('div.card', h('div.card-title', h('h3', 'Ratings'), h('span.display', { style: { fontSize: '1.4rem' } }, `${Math.round(p.ovr)} OVR`)), statBars(p.stats, POSITIONS[p.position].statNotes, p.position)),
    h('div.card', h('h3', 'Overall by Season'), ratingChart(p.history, Math.round(p.ovr * 10) / 10)),
    h('div.card', h('h3', `This Season (${s.games} games)`), h('p.small', posLine(s)),
      s.games ? h('p.tiny.muted', `Average grade ${Math.round(s.grades / s.games)} · Season rating ${Math.round(seasonPerf(p.position, s))}`) : null),
    h('div.card', h('h3', 'Trophy Case'),
      Object.keys(awardCounts).length ? h('div.row.wrap', Object.entries(awardCounts).map(([n, c]) => h('span.chip.gold', icon('trophy'), `${c > 1 ? `${c}× ` : ''}${n}`))) : h('p.small.muted', 'Empty, for now.'),
      p.records.length ? h('div.row.wrap', { style: { marginTop: '8px' } }, p.records.map((r) => h('span.chip', icon('scroll'), `${r.label} (${r.year})`))) : null),
    p.history.length ? h('div.card', h('h3', 'Career History'), h('div.scroll-x', h('table.tbl',
      h('tr', h('th', 'Year'), h('th', 'Team'), h('th.num', 'Age'), h('th.num', 'OVR'), h('th', 'Rec'), h('th', 'Line')),
      p.history.slice().reverse().map((x) => h('tr', h('td', x.year), h('td', h('span.swatch', { style: { background: x.colors[0] } }), x.teamId, x.champion ? ' ★' : ''), h('td.num', x.age), h('td.num', Math.round(x.ovr)), h('td', x.record), h('td.tiny', posLine(x.seasonStats))))))) : null,
    h('div.card', h('h3', 'Career Totals'), h('p.small', posLine(p.careerStats)), st.career.stage === 'pro' || p.proCareerStats.games ? h('p.small.muted', `Pro: ${posLine(p.proCareerStats)}`) : null));
}

// ------------------------------------------------------------------ NEWS

function newsView(app) {
  const st = app.state;
  const icons = { headline: 'news', fan: 'chat', injury: 'bandage', money: 'dollar', scandal: 'alert', award: 'trophy', record: 'scroll', story: 'mic' };
  return h('div.col', { style: { gap: '14px' } },
    h('h2', 'News and Feed'),
    h('div.card', st.news.length ? st.news.map((n) => h(`div.news-item.${n.kind}`,
      h('div.src', n.kind === 'fan' ? n.handle : [icon(icons[n.kind] ?? 'news'), `${n.outlet ?? n.kind} · ${n.year} wk ${n.week}`]),
      h('div.txt', n.text))) : h('p.muted', 'Quiet so far.')));
}

export { clear, openModal };
