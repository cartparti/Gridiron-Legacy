// Postgame report and end-of-season review.
import { awardLabel } from '../../sim/awards.js';
import { achUnlockRows, goalsReview } from './achievements.js';
import { injuryInfo, injuryNote } from '../../sim/injury.js';
import { h } from '../dom.js';
import { backupModal } from './slots.js';
import { STAGES, PLAY_CALLS } from '../../data/config.js';
import { STAT_KEYS, STAT_LABELS, statLabel } from '../../data/positions.js';
import { getTeam } from '../../sim/league.js';
import * as flow from '../../sim/flow.js';
import { fmtMoney, signed } from '../../core/util.js';
import { teamBadge } from '../components.js';
import { sfx } from '../../audio/sfx.js';
import { icon } from '../icons.js';
import { trophyCutscene, playerOfGameCutscene } from '../../scenes/cutscenes.js';
import { runSetCutscene } from '../../scenes/director.js';
import { banquetScene } from '../../scenes/sets.js';
import { teamCulture } from '../../data/culture.js';
import { teamKits } from '../../data/kits.js';

const AWARD_ICONS = { 'Most Valuable Player': 'crown', 'Legacy Bowl Champion': 'trophy', 'Heritage Bowl Champion': 'trophy', 'State Champion': 'trophy', 'Ironstone Trophy': 'medal', 'Legacy Bowl MVP': 'star' };

export function statLine(pos, s) {
  if (pos === 'QB') return [[`${s.passComp}/${s.passAtt}`, 'Comp/Att'], [s.passYds, 'Pass Yds'], [`${s.passTD}/${s.int}`, 'TD/INT']];
  if (pos === 'RB') return [[s.rushAtt, 'Carries'], [s.rushYds, 'Rush Yds'], [s.rushTD, 'TD']];
  if (pos === 'DT') return [[s.defSacks ?? 0, 'Sacks'], [s.tfl ?? 0, 'TFL'], [s.tackles ?? 0, 'Tackles']];
  if (pos === 'CB') return [[s.defInt ?? 0, 'INT'], [s.pd ?? 0, 'Pass Def'], [s.tackles ?? 0, 'Tackles']];
  if (pos === 'K') return [[`${s.fgMade ?? 0}/${s.fgAtt ?? 0}`, 'Field Goals'], [`${s.xpMade ?? 0}/${s.xpAtt ?? 0}`, 'Extra Points'], [s.fgLong ?? 0, 'Longest']];
  if (pos === 'MS') return [[s.hype ?? 0, 'Crowd Hype'], [s.shirts ?? 0, 'Shirts Landed'], [`${s.danceWins ?? 0}/${s.stunts ?? 0}`, 'Showdowns/Stunts']];
  return [[`${s.rec}/${s.targets}`, 'Rec/Tgt'], [s.recYds, 'Rec Yds'], [s.recTD, 'TD']];
}

export function postgameScreen(app) {
  const st = app.state;
  const g = st.lastGame;
  const p = st.player;
  const home = getTeam(st.league, g.homeId);
  const away = getTeam(st.league, g.awayId);
  const d = g.deltas;
  if (g.potg && !g.potgPlayed && !app.settings.reducedMotion) {
    g.potgPlayed = true;
    app.save();
    const mine = getTeam(st.league, st.career.teamId);
    const homeT = getTeam(st.league, g.homeId);
    const top = statLine(p.position, g.userStats).map(([v, l]) => `${v} ${l.toLowerCase()}`).slice(0, 2).join(' · ');
    setTimeout(() => playerOfGameCutscene({ colors: mine.colors, uniform: teamKits(mine).home, look: p.look, number: p.number, teamName: mine.name,
      stage: st.career.stage, culture: teamCulture(homeT, st.career.stage), title: 'PLAYER OF THE GAME', sub: `${p.first} ${p.last} · ${top}` }), 60);
  }
  return h('div.screen',
    h('div.card',
      h('div.row.between', h('span.chip', g.roundName), g.won ? h('span.chip.good', 'WIN') : h('span.chip.bad', 'LOSS')),
      h('div.matchup', { style: { marginTop: '10px' } },
        h('div.team-badge', teamBadge(away, 50), h('span.nm', away.city), h('span.display', { style: { fontSize: '2rem' } }, g.score.away)),
        h('span.vs', 'FINAL'),
        h('div.team-badge', teamBadge(home, 50), h('span.nm', home.city), h('span.display', { style: { fontSize: '2rem' } }, g.score.home)))),
    h('div.card',
      h('div.src.small.muted', g.outlet),
      h('h2', { style: { textTransform: 'none' } }, g.headline)),
    g.sitOut ? h('div.card', h('p', 'You watched this one from the sideline.')) : h('div.card',
      h('div.row', h('div.grade', { style: { color: g.grade >= 70 ? 'var(--good)' : g.grade >= 50 ? 'var(--warn)' : 'var(--bad)' } }, g.letter),
        h('div.grow', h('b', 'Your game'), h('div.small.muted', `Grade ${g.grade}/100`)), g.potg ? h('span.chip.gold.pix', 'PLAYER OF THE GAME') : null),
      h('div.bigstat', { style: { marginTop: '10px' } }, statLine(p.position, g.userStats).map(([v, l]) => h('div', h('b', v), h('span', l))))),
    g.moments.length ? h('div.card', h('h3', 'Key Moments'), h('div.list', g.moments.map((m) =>
      h('div.li', h('span.chip', PLAY_CALLS[m.call]?.label ?? m.call), h('div.grow', h('div.small', m.label), h('div.tiny.muted', `${m.text} → ${m.outcome === 'TD' ? 'Touchdown' : m.outcome === 'FG' ? 'Field goal' : m.outcome === 'MISS' ? 'No good' : m.outcome === 'KICK' ? 'Kickoff' : m.outcome === 'TO' ? 'Turnover' : m.outcome === 'DOWNS' ? 'Turnover on downs' : 'Punt'}`)),
        h('b', { style: { color: m.quality > 0.7 ? 'var(--good)' : m.quality < 0.35 ? 'var(--bad)' : 'inherit' } }, `${Math.round(m.quality * 100)}%`))))) : null,
    h('div.card', h('h3', 'Fallout'), h('div.changes',
      h(`span.chip.${d.fame >= 0 ? 'good' : 'bad'}`, `Fame ${signed(d.fame, 1)}`),
      h(`span.chip.${d.coach >= 0 ? 'good' : 'bad'}`, `Coach ${signed(d.coach, 1)}`),
      h(`span.chip.${d.mood >= 0 ? 'good' : 'bad'}`, `Mood ${signed(d.mood, 1)}`)),
      g.injury ? h('p.bad', h('b', `Injured: ${g.injury.label} (${injuryInfo(g.injury, st.player.position)?.label ?? 'Out'}), ~${g.injury.weeks} week${g.injury.weeks > 1 ? 's' : ''}.`), ' ', h('span.small', injuryNote(g.injury, st.player.position))) : null),
    g.newTraits?.length || g.levelUps ? h('div.card.unlock-card',
      g.levelUps ? h('div.row', { style: { gap: '8px' } }, h('span.chip.gold.pix', 'LEVEL UP'), h('span.small', `Level ${st.player.level}. You have ${st.player.skillPoints} skill point${st.player.skillPoints === 1 ? '' : 's'} to spend (Career tab).`)) : null,
      (g.newTraits ?? []).map((n) => h('div.row', { style: { gap: '8px', marginTop: '6px' } }, h('span.chip.good.pix', 'NEW TRAIT'), h('b', n), h('span.tiny.muted', 'Equip it in Career → Traits')))) : null,
    g.newAch?.length ? h('div.card.unlock-card', h('h3', 'Achievement unlocked'), h('div.col', { style: { gap: '8px' } }, achUnlockRows(g.newAch))) : null,
    h('button.btn.primary.block', { onclick: () => { sfx.click(); flow.continueAfterGame(st); app.hubTab = 'week'; app.commit(); } }, 'Continue'));
}

export function reviewScreen(app) {
  const st = app.state;
  const r = st.review;
  const p = st.player;
  const champ = getTeam(st.league, r.championId);
  if (r.champion && !r.cutPlayed && !app.settings.reducedMotion) {
    r.cutPlayed = true;
    app.save();
    const titleName = STAGES[st.career.stage]?.titleName ?? 'Championship';
    setTimeout(() => trophyCutscene({ stage: st.career.stage, colors: champ.colors, uniform: teamKits(champ).home, look: p.look, number: p.number, teamName: champ.name,
      title: 'Champions!', sub: `${champ.city} ${champ.name} win the ${titleName}` }), 50);
  }
  if (r.awards.length && !r.banquetPlayed && !app.settings.reducedMotion) {
    r.banquetPlayed = true;
    app.save();
    const wait = r.champion ? 8600 : 60; // after the trophy lift
    setTimeout(() => runSetCutscene((ctx) => banquetScene(ctx, { look: p.look, name: `${p.first} ${p.last}`, awards: r.awards.map((a) => awardLabel(a, p.position)), year: r.year }), { music: 'anthem' }), wait);
  }
  const delta = r.ovrAfter - r.ovrBefore;
  setTimeout(() => (r.awards.length ? sfx.levelUp() : null), 300);
  return h('div.screen',
    h('div', h('div.small.muted', `${STAGES[r.stage].label} · Season ${r.stageSeason}`), h('h1', `${r.year} Season Review`)),
    h('div.card',
      h('div.bigstat',
        h('div', h('b', r.record), h('span', 'Record')),
        h('div', h('b', r.champion ? '★' : r.seed >= 0 ? `#${(r.seed % 4) + 1}` : '—'), h('span', r.champion ? 'Champions' : r.seed >= 0 ? 'Playoff seed' : 'No playoffs')),
        h('div', h('b', r.perf), h('span', 'Season rating'))),
      h('p.small.muted', { style: { marginTop: '8px' } }, `${STAGES[r.stage].titleName}: ${champ.city} ${champ.name}`)),
    r.awards.length ? h('div.col', r.awards.map((a, i) => h('div.award', { style: { animationDelay: `${i * 0.15}s` } }, h('span.ic', icon(AWARD_ICONS[a] ?? 'medal')), h('div', h('div.nm', awardLabel(a, p.position)), h('div.tiny.muted', `${r.year}`))))) : null,
    r.records.length ? h('div.card', { style: { borderColor: 'var(--accent)' } }, h('h3', 'Records Broken'), r.records.map((x) => h('p', h('b', x)))) : null,
    h('div.card', h('h3', 'Season Stats'), h('div.bigstat', statLine(p.position, r.seasonStats).map(([v, l]) => h('div', h('b', v), h('span', l)))),
      h('p.tiny.muted', { style: { marginTop: '6px' } }, `${r.seasonStats.games} games played`)),
    goalsReview(r.goals),
    r.newAch?.length ? h('div.card.unlock-card', h('h3', 'Achievements unlocked'), h('div.col', { style: { gap: '8px' } }, achUnlockRows(r.newAch))) : null,
    r.leaders && p.position !== 'MS' && p.position !== 'K' ? h('div.card', h('h3', 'League Leaders'), leadersTable(r.leaders, p)) : null,
    h('div.card', h('h3', 'Aging & Growth'),
      h('p', `Overall ${Math.round(r.ovrBefore)} → `, h(`b.${delta >= 0 ? 'good' : 'bad'}`, `${Math.round(r.ovrAfter)} (${signed(delta, 1)})`), ` · now age ${p.age}`),
      h('div.changes', STAT_KEYS.map((k) => h(`span.chip.${r.ageChanges[k] >= 0 ? 'good' : 'bad'}`, `${statLabel(k, p.position)} ${signed(r.ageChanges[k], 1)}`)))),
    r.invest.length ? h('div.card', h('h3', 'Investments'), r.invest.map((x) => h('div.row.between.small', h('span', x.label), h(`b.${x.r >= 0 ? 'good' : 'bad'}`, `${fmtMoney(x.from)} → ${fmtMoney(x.to)} (${signed(x.r * 100, 0)}%)`)))) : null,
    h('div.card.flat.backup-nudge', h('div.row', { style: { gap: '10px', alignItems: 'center' } }, h('span', { style: { fontSize: '1.4rem' } }, '💾'),
      h('div.grow', h('b', 'Back up your career'), h('p.tiny.muted', 'Saves live only on this phone. A backup code keeps your career safe.')),
      h('button.btn.small', { onclick: () => { app.save(); backupModal(app.slot, `${p.first} ${p.last}`); } }, 'Back up'))),
    h('button.btn.primary.block', { onclick: () => { sfx.click(); flow.continueAfterReview(st); app.commit(); } }, 'Into the Offseason'));
}

function leadersTable(leaders, p) {
  const keys = p.position === 'QB' ? ['passYds', 'passTD'] : p.position === 'RB' ? ['rushYds', 'rushTD'] : ['recYds', 'recTD'];
  const labels = { passYds: 'Passing Yards', passTD: 'Passing TDs', rushYds: 'Rushing Yards', rushTD: 'Rushing TDs', recYds: 'Receiving Yards', recTD: 'Receiving TDs' };
  return keys.map((k) => {
    const list = [...leaders[k], { name: `${p.first[0]}. ${p.last}`, team: 'YOU', value: p.seasonStats[k], me: true }].sort((a, b) => b.value - a.value).slice(0, 4);
    return h('div', { style: { marginBottom: '8px' } }, h('div.small.muted', labels[k]), h('table.tbl', list.map((x, i) => h(`tr${x.me ? '.me' : ''}`, h('td', i + 1), h('td', x.name), h('td', x.team), h('td.num', x.value.toLocaleString())))));
  });
}
