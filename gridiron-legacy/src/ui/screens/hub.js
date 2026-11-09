// Main career hub: top bar with meters, bottom tabs, and the five tab views.
import { h, clear } from '../dom.js';
import { STAGES, DAYS } from '../../data/config.js';
import { POSITIONS } from '../../data/positions.js';
import { HOUSING, CARS, PERKS, INVESTMENTS } from '../../data/lifestyle.js';
import { RECORD_LABELS, seasonPerf } from '../../sim/awards.js';
import { availableActivities, maxEnergy, planCost, ACTIVITY_BY_ID } from '../../sim/week.js';
import { getTeam, standings, roundName, capSpace } from '../../sim/league.js';
import * as flow from '../../sim/flow.js';
import { fmtMoney, ordinal, fillTokens } from '../../core/util.js';
import { meter, teamBadge, jersey, ratingChart, statBars, openModal, changeChips, toast, confirmDialog } from '../components.js';
import { sfx } from '../../audio/sfx.js';
import { eventModal } from './event.js';
import { tipCard } from './tips.js';

const TABS = [
  ['week', '📅', 'Week'],
  ['team', '🏈', 'Team'],
  ['life', '💬', 'Life'],
  ['career', '⭐', 'Career'],
  ['news', '📰', 'News'],
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
        h('div.sub', `#${p.number} ${p.position} · Age ${p.age} · ${team ? team.name : ''}`),
        h('div.sub', `${stageLbl} · ${st.career.year} · ${wk}`)),
      h('button.btn.small.ghost', { style: { color: '#fff', borderColor: 'rgba(255,255,255,0.4)' }, 'aria-label': 'Settings', onclick: () => { app.ui.back = 'career'; app.go('settings'); } }, '⚙')),
    h('div.meters',
      meter('Energy', maxEnergy(st), 12),
      meter('Mood', p.mood),
      meter('Health', p.health),
      meter('Fame', p.fame),
      meter('Bank', Math.max(0, Math.min(100, Math.log10(Math.max(1, p.money)) * 12)), 100, fmtMoney(p.money))));
}

export function hubScreen(app) {
  const st = app.state;
  const wrap = h('div');
  wrap.append(topBar(app));
  const body = h('div.screen');
  const views = { week: weekView, team: teamView, life: lifeView, career: careerView, news: newsView };
  body.append(views[app.hubTab](app));
  wrap.append(body);
  wrap.append(h('nav.tabs', TABS.map(([id, ico, label]) =>
    h(`button.tab${app.hubTab === id ? '.on' : ''}`, { onclick: () => { sfx.click(); app.hubTab = id; app.render(); } },
      h('span.ico', ico), label))));
  if (st.phase === 'event' && st.pendingEvent) setTimeout(() => eventModal(app), 30);
  return wrap;
}

// ------------------------------------------------------------------ WEEK

function weekView(app) {
  const st = app.state;
  const p = st.player;
  const plan = app.ui.plan ?? (app.ui.plan = Array(5).fill(null));
  if (app.ui.activeSlot === undefined) app.ui.activeSlot = plan.findIndex((x) => !x);
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

  // Matchup card
  if (m && opp) {
    const home = m.home;
    container.append(h('div.card',
      h('div.card-title', h('h3', m.playoff ? roundName(st.league, st.league.playoffs.round) : `Week ${st.league.week + 1} of ${st.league.schedule.length}`),
        h('span.chip', home ? 'HOME' : 'AWAY'), opp.id === st.career.rivalTeamId ? h('span.chip.bad', '🔥 RIVALRY') : null),
      h('div.matchup',
        h('div.team-badge', teamBadge(me, 44), h('span.nm', me.name), h('span.rec', `${me.w}-${me.l}`)),
        h('span.vs', home ? 'vs' : '@'),
        h('div.team-badge', teamBadge(opp, 44), h('span.nm', opp.name), h('span.rec', `${opp.w}-${opp.l}`))),
      h('div.row.between.small.muted', { style: { marginTop: '8px' } },
        h('span', `Your OFF ${Math.round(me.off)} · DEF ${Math.round(me.def)}`),
        h('span', `Their OFF ${Math.round(opp.off)} · DEF ${Math.round(opp.def)}`))));
  }

  // Energy + days
  const pips = [];
  for (let i = 0; i < max; i++) pips.push(h(`span.pip${i >= left ? '.used' : ''}`));
  container.append(h('div.card',
    h('div.card-title', h('h3', 'This Week'), h('span.small', h('b', `${left}`), ` / ${max} energy left`)),
    h('div.pips', pips),
    h('div.days', { style: { marginTop: '12px' } }, DAYS.map((d, i) => {
      const a = plan[i] ? ACTIVITY_BY_ID[plan[i]] : null;
      return h(`button.slot${a ? '.filled' : ''}${app.ui.activeSlot === i ? '.active' : ''}`, {
        'aria-label': `${d}: ${a ? a.label : 'empty'}`,
        onclick: () => { sfx.click(); if (a) { plan[i] = null; app.ui.activeSlot = i; } else app.ui.activeSlot = i; app.render(); },
      }, h('span.day', d), h('span.ico', a ? a.icon : '＋'), h('span', a ? a.label : 'Free'), a ? h('span.tiny', a.cost ? `−${a.cost}⚡` : 'free') : null);
    })),
    h('p.tiny.muted', { style: { marginTop: '8px' } }, `Game-day freshness: ${Math.round((left / max) * 100)}%. Tap a filled day to clear it.`)));

  // Activity picker
  if (app.ui.activeSlot >= 0) {
    const groups = {};
    for (const a of acts) (groups[a.group] ??= []).push(a);
    const grid = h('div.acts');
    for (const [g, list] of Object.entries(groups)) {
      grid.append(h('div.group-label', g));
      for (const a of list) {
        const ok = a.cost <= left;
        grid.append(h('button.act', { disabled: !ok, onclick: () => { sfx.select(); setSlot(app.ui.activeSlot, a.id); } },
          h('span.ico', a.icon),
          h('span.t', a.label, ' ', h('span.cost', a.cost ? `${a.cost}⚡` : 'free')),
          h('span.d', fillTokens(a.desc, tokens))));
      }
    }
    container.append(h('div.card', h('h3', `Pick an activity for ${DAYS[app.ui.activeSlot]}`), grid));
  }

  // Game day button
  let playHurt = app.ui.playHurt ?? false;
  const hurtToggle = status.hurt
    ? h('div.card.flat', { style: { borderColor: 'var(--warn)' } },
      h('p', h('b.warn', `Injured: ${status.reason}.`), ' Play through it? Your timing windows shrink and you risk making it worse.'),
      h('div.row', h(`button.subtab${!playHurt ? '.on' : ''}`, { onclick: () => { app.ui.playHurt = false; app.render(); } }, 'Sit out & heal'),
        h(`button.subtab${playHurt ? '.on' : ''}`, { onclick: () => { app.ui.playHurt = true; app.render(); } }, 'Play hurt')))
    : null;
  if (hurtToggle) container.append(hurtToggle);
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
      app.ui.plan = null;
      app.ui.activeSlot = undefined;
      app.ui.playHurt = false;
      app.ui.showEventResult = false;
      app.commit();
    },
  }, cantPlay ? `Game Day (sitting out: ${status.reason})` : status.hurt && !playHurt ? 'Game Day (sitting out)' : 'Go to Game Day 🏈'));
  return container;
}

// ------------------------------------------------------------------ TEAM

function teamView(app) {
  const st = app.state;
  const league = st.league;
  const sub = app.ui.teamSub ?? 'standings';
  const tabs = h('div.subtabs', [['standings', 'Standings'], ['schedule', 'Schedule'], ['playoffs', 'Playoffs'], ['roster', 'Roster'], ['history', 'History']]
    .filter(([id]) => (id === 'roster' ? league.kind === 'pro' : id === 'history' ? st.proHistory.length || st.records : true))
    .map(([id, l]) => h(`button.subtab${sub === id ? '.on' : ''}`, { onclick: () => { app.ui.teamSub = id; app.render(); } }, l)));
  const out = h('div.col', { style: { gap: '14px' } }, h('h2', STAGES[league.kind].leagueName), tabs);
  if (sub === 'standings') {
    const confs = league.kind === 'pro' ? ['Summit', 'Coastal'] : [null];
    for (const c of confs) {
      const rows = standings(league, c);
      out.append(h('div.card', c ? h('h3', `${c} Conference`) : null, h('div.scroll-x', h('table.tbl',
        h('tr', h('th', '#'), h('th', 'Team'), h('th.num', 'W'), h('th.num', 'L'), h('th.num', 'PF'), h('th.num', 'PA'), h('th.num', 'Str')),
        rows.map((t, i) => h(`tr${t.id === st.career.teamId ? '.me' : ''}`,
          h('td', i + 1), h('td', h('span.swatch', { style: { background: t.colors[0] } }), `${t.city} ${t.name}`, t.id === st.career.rivalTeamId ? ' 🔥' : ''),
          h('td.num', t.w), h('td.num', t.l), h('td.num', t.pf), h('td.num', t.pa), h('td.num', t.streak > 0 ? `W${t.streak}` : t.streak < 0 ? `L${-t.streak}` : '-')))))),
        h('p.tiny.muted', `Top ${league.kind === 'pro' ? 4 : STAGES[league.kind].playoffTeams} make the playoffs.`));
    }
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

const REL_INFO = [
  ['coach', '📋', 'Coach', (p) => `Coach ${p.coachName}`, 'More key moments per game when trust is high.'],
  ['teammates', '🤜', 'Teammates', () => 'Locker room', 'Team chemistry boosts your offense.'],
  ['family', '🏡', 'Family', () => 'Family', 'Keeps your mood steady.'],
  ['partner', '❤️', 'Partner', (p) => p.partnerName, 'A happy relationship lifts your mood.'],
  ['agent', '💼', 'Agent', (p) => p.agentName, 'Better contracts and sponsor deals.'],
  ['rival', '🔥', 'Rivalry', (p) => p.rivalName, 'Big games, big headlines.'],
];

function lifeView(app) {
  const st = app.state;
  const p = st.player;
  const sub = app.ui.lifeSub ?? 'people';
  const out = h('div.col', { style: { gap: '14px' } },
    h('div.subtabs', [['people', 'People'], ['money', 'Money'], ['lifestyle', 'Lifestyle'], ['invest', 'Invest']].map(([id, l]) =>
      h(`button.subtab${sub === id ? '.on' : ''}`, { onclick: () => { app.ui.lifeSub = id; app.render(); } }, l))));
  if (sub === 'people') {
    out.append(h('div.card', h('h3', 'Relationships'),
      REL_INFO.map(([k, ico, label, who, why]) => {
        const v = p.rel[k];
        if (v === null || v === undefined) return h('div.rel-row', h('span.ico', ico), h('div', h('b', label), h('div.tiny.muted', k === 'partner' ? 'Single. Events may change that.' : 'No agent yet. They find you in college or the pros.')), h('span.muted', '—'));
        return h('div.rel-row', h('span.ico', ico),
          h('div', h('div.row.between', h('b', who(p)), h('span.tiny.muted', label)), h('div.statbar', { style: { gridTemplateColumns: '1fr' } }, h('div.track', h('div.fill', { style: { width: `${v}%` } }))), h('div.tiny.muted', why)),
          h('b', Math.round(v)));
      })));
    if (st.career.stage !== 'pro') out.append(h('div.card', h('h3', 'Grades'), h('div.statbar', h('span', 'Academics'), h('div.track', h('div.fill', { style: { width: `${p.academics}%`, background: p.academics < 40 ? 'var(--bad)' : undefined } })), h('span.val', Math.round(p.academics))), h('p.tiny.muted', 'Drop below 30 and you are ineligible. Study Hall raises it.')));
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
  const st = app.state;
  const p = st.player;
  const team = getTeam(st.league, st.career.teamId);
  const s = p.seasonStats;
  const posLine = (x) => (p.position === 'QB' ? `${x.passComp}/${x.passAtt}, ${x.passYds} yds, ${x.passTD} TD, ${x.int} INT`
    : p.position === 'RB' ? `${x.rushAtt} car, ${x.rushYds} yds, ${x.rushTD} TD · ${x.rec} rec ${x.recYds} yds`
      : `${x.rec} rec, ${x.recYds} yds, ${x.recTD} TD · ${x.drops} drops`);
  const awardCounts = {};
  for (const a of p.awards) awardCounts[a.name] = (awardCounts[a.name] ?? 0) + 1;
  return h('div.col', { style: { gap: '14px' } },
    h('div.card', h('div.row', jersey(p, team.colors, 120),
      h('div.col.grow', { style: { gap: '4px' } },
        h('h2', `${p.first} ${p.last}`),
        h('span.small.muted', `${POSITIONS[p.position].label} · ${p.hometown}`),
        h('span.small', `${team.city} ${team.name}`),
        p.draft ? h('span.small.muted', p.draft.undrafted ? 'Undrafted free agent' : `Drafted ${ordinal(p.draft.pick)} overall (${p.draft.year})`) : null,
        p.injury ? h('span.chip.bad', `🩹 ${p.injury.label} · ${p.injury.weeks} wk`) : null,
        p.suspended ? h('span.chip.bad', `Suspended ${p.suspended}`) : null))),
    h('div.card', h('div.card-title', h('h3', 'Ratings'), h('span.display', { style: { fontSize: '1.4rem' } }, `${Math.round(p.ovr)} OVR`)), statBars(p.stats, POSITIONS[p.position].statNotes)),
    h('div.card', h('h3', 'Overall by Season'), ratingChart(p.history, Math.round(p.ovr * 10) / 10)),
    h('div.card', h('h3', `This Season (${s.games} games)`), h('p.small', posLine(s)),
      s.games ? h('p.tiny.muted', `Average grade ${Math.round(s.grades / s.games)} · Season rating ${Math.round(seasonPerf(p.position, s))}`) : null),
    h('div.card', h('h3', 'Trophy Case'),
      Object.keys(awardCounts).length ? h('div.row.wrap', Object.entries(awardCounts).map(([n, c]) => h('span.chip.gold', `🏆 ${c > 1 ? `${c}× ` : ''}${n}`))) : h('p.small.muted', 'Empty, for now.'),
      p.records.length ? h('div.row.wrap', { style: { marginTop: '8px' } }, p.records.map((r) => h('span.chip', `📜 ${r.label} (${r.year})`))) : null),
    p.history.length ? h('div.card', h('h3', 'Career History'), h('div.scroll-x', h('table.tbl',
      h('tr', h('th', 'Year'), h('th', 'Team'), h('th.num', 'Age'), h('th.num', 'OVR'), h('th', 'Rec'), h('th', 'Line')),
      p.history.slice().reverse().map((x) => h('tr', h('td', x.year), h('td', h('span.swatch', { style: { background: x.colors[0] } }), x.teamId, x.champion ? ' 🏆' : ''), h('td.num', x.age), h('td.num', Math.round(x.ovr)), h('td', x.record), h('td.tiny', posLine(x.seasonStats))))))) : null,
    h('div.card', h('h3', 'Career Totals'), h('p.small', posLine(p.careerStats)), st.career.stage === 'pro' || p.proCareerStats.games ? h('p.small.muted', `Pro: ${posLine(p.proCareerStats)}`) : null));
}

// ------------------------------------------------------------------ NEWS

function newsView(app) {
  const st = app.state;
  const icons = { headline: '📰', fan: '💬', injury: '🩹', money: '💰', scandal: '⚠️', award: '🏆', record: '📜', story: '📣' };
  return h('div.col', { style: { gap: '14px' } },
    h('h2', 'News & Feed'),
    h('div.card', st.news.length ? st.news.map((n) => h(`div.news-item.${n.kind}`,
      h('div.src', n.kind === 'fan' ? n.handle : `${icons[n.kind] ?? '•'} ${n.outlet ?? n.kind} · ${n.year} wk ${n.week}`),
      h('div.txt', n.text))) : h('p.muted', 'Quiet so far.')));
}

export { clear, openModal };
