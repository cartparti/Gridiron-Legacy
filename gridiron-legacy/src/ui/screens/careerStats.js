// Career pages: stats overview (by season, by level, journey, market value), Legends, Award Race.
import { awardLabel } from '../../sim/awards.js';
import { h } from '../dom.js';
import { fmtMoney } from '../../core/util.js';
import { getTeam } from '../../sim/league.js';
import { seasonPerf } from '../../sim/awards.js';
import { mainStats, totalTD, bigPlaysD, myTrophies, legendBoard, allTimeRank, awardRace, marketValue, journey } from '../../sim/legends.js';
import { crest } from '../crest.js';
import { icon } from '../icons.js';
import { levelInfo, spendPoint, pointCost } from '../../sim/progress.js';
import { traitList, toggleTrait, equipSlots } from '../../sim/traits.js';
import { STAT_KEYS, STAT_LABELS, statLabel } from '../../data/positions.js';
import { sfx } from '../../audio/sfx.js';

const STAGE = { hs: 'High School', college: 'College', pro: 'Pro' };
const fmtN = (n) => (n >= 10000 ? `${(n / 1000).toFixed(1)}K` : String(Math.round(n)));

/** Pixel bar chart: values [{label, v, hi}] */
function bars(list, color = 'var(--accent)') {
  const max = Math.max(1, ...list.map((x) => x.v));
  return h('div.px-bars', list.map((x) => h(`div.pb${x.hi ? '.hi' : ''}`, h('span.pb-v', fmtN(x.v)), h('i', { style: { height: `${Math.max(4, (x.v / max) * 100)}%`, background: x.hi ? '#fff' : color } }), h('span.pb-l', x.label))));
}

/** Extra stats sections appended to the Career profile. */
export function careerStatsSections(app) {
  const st = app.state;
  const p = st.player;
  const cs = p.careerStats;
  const t = myTrophies(p);
  const [[, l1, v1], [, l2, v2]] = mainStats(p.position, cs);
  const rank = allTimeRank(st);
  const seasons = p.history.length + (st.career.stage !== 'retired' && p.seasonStats.games ? 1 : 0);
  const teams = new Set([...p.history.map((x) => x.teamId), st.career.teamId]).size;
  const bestPerf = Math.max(0, ...p.history.map((x) => x.perf ?? 0));
  const card = (ic, v, l, sub) => h('div.ov-card', h('span.ov-ic', icon(ic)), h('div', h('b.pix', v), h('div.tiny', l), sub ? h('div.tiny.muted', sub) : null));
  const out = [];

  // level + skill points
  const lv = levelInfo(st);
  out.push(h('div.card.skill-card',
    h('div.card-title', h('h3', `Level ${lv.level}`), h(`span.chip.pix${lv.points ? '.gold' : ''}`, `${lv.points} SKILL POINT${lv.points === 1 ? '' : 'S'}`)),
    h('div.watch-bar', h('i', { style: { width: `${(lv.xp / lv.need) * 100}%` } })),
    h('p.tiny.muted', `${lv.xp} / ${lv.need} XP · earn XP from games, training and awards. Each level = 1 point.`),
    h('p.tiny.muted', `Training points: ${Math.round((p.trainPts ?? 0) * 100)}% · ace your training drills (Week tab) to earn extra skill points.`),
    h('div.col', { style: { gap: '6px', marginTop: '8px' } }, STAT_KEYS.map((k) => {
      const v = Math.round(p.stats[k]);
      const cost = pointCost(v);
      return h('div.sp-row', h('span.grow', statLabel(k, p.position)), h('b.pix', v),
        h('button.btn.small.sp-plus', { disabled: lv.points < cost || v >= 99, onclick: () => { if (spendPoint(st, k)) { sfx.levelUp(); app.save(); app.render(); } } }, cost > 1 ? `+1 (${cost})` : '+1'));
    }))));

  // all-time rank teaser
  out.push(h('div.card.rank-teaser',
    h('div.row', { style: { gap: '10px' } }, h('span.ov-ic.gold', icon('crown')),
      h('div.grow', h('b.pix', rank.rank <= 30 ? `#${rank.rank} all-time` : `Outside the all-time top 30`), h('div.tiny.muted', rank.next ? `Next to overtake: ${rank.next.name} (${rank.next.pos}, ${rank.next.years})` : 'You are the greatest of all time.')),
      h('span.chip.pix', `#${rank.rank}`))));

  // overall
  out.push(h('div.card', h('h3', 'Overall'), h('div.ov-grid',
    card('ball', cs.games ?? 0, 'Games', `${cs.wins ?? 0} wins`),
    card('star', fmtN(v1), l1, `${fmtN(v2)} ${l2}`),
    card('trophy', t.ind, 'Individual awards', `${t.team} team title${t.team === 1 ? '' : 's'}`),
    card('scroll', seasons, 'Seasons', `${teams} team${teams === 1 ? '' : 's'}`),
    card('bolt', bestPerf ? Math.round(bestPerf) : '-', 'Best season rating', ''),
    card('flame', p.position === 'K' ? (cs.fgMade ?? 0) * 3 + (cs.xpMade ?? 0) : p.position === 'MS' ? (cs.stunts ?? 0) : ['CB', 'DT'].includes(p.position) ? bigPlaysD(cs) : totalTD(cs), p.position === 'K' ? 'Points kicked' : p.position === 'MS' ? 'Halftime stunts landed' : ['CB', 'DT'].includes(p.position) ? 'Big plays (INT + sacks)' : 'Total touchdowns', ''))));

  // by season
  const rows = p.history.map((x) => ({ year: x.year, stage: x.stage, team: x.teamId, colors: x.colors, s: x.seasonStats, perf: x.perf, champ: x.champion }));
  if (st.career.stage !== 'retired' && p.seasonStats.games) rows.push({ year: st.career.year, stage: st.career.stage, team: st.career.teamId, colors: getTeam(st.league, st.career.teamId)?.colors ?? ['#888', '#fff'], s: p.seasonStats, perf: seasonPerf(p.position, p.seasonStats), live: true });
  if (rows.length) {
    out.push(h('div.card', h('h3', 'By Season'), h('p.tiny.muted', `${l1} per season`),
      bars(rows.map((r) => ({ label: `'${String(r.year).slice(2)}`, v: mainStats(p.position, r.s)[0][2], hi: r.live }))),
      h('div.scroll-x', h('table.tbl.season-tbl',
        h('tr', h('th', 'Yr'), h('th', 'Team'), h('th.num', 'G'), h('th.num', l1), h('th.num', l2), h('th.num', 'RTG')),
        rows.slice().reverse().map((r) => h(`tr${r.live ? '.me' : ''}`, h('td', `${r.year}${r.live ? '*' : ''}`), h('td', h('span.swatch', { style: { background: r.colors[0] } }), r.team, r.champ ? ' ★' : ''), h('td.num', r.s.games),
          h('td.num', fmtN(mainStats(p.position, r.s)[0][2])), h('td.num', fmtN(mainStats(p.position, r.s)[1][2])), h('td.num', h('b', Math.round(r.perf ?? 0))))))),
      h('p.tiny.muted', '* season in progress')));
  }

  // by level
  const lvl = {};
  for (const r of rows) { lvl[r.stage] ??= { games: 0, a: 0, b: 0 }; lvl[r.stage].games += r.s.games; lvl[r.stage].a += mainStats(p.position, r.s)[0][2]; lvl[r.stage].b += mainStats(p.position, r.s)[1][2]; }
  if (Object.keys(lvl).length) out.push(h('div.card', h('h3', 'Career by Level'), h('table.tbl', h('tr', h('th', 'Level'), h('th.num', 'G'), h('th.num', l1), h('th.num', l2)),
    Object.entries(lvl).map(([k, v]) => h('tr', h('td', STAGE[k]), h('td.num', v.games), h('td.num', fmtN(v.a)), h('td.num', fmtN(v.b)))))));

  // journey
  const jr = journey(st);
  out.push(h('div.card', h('h3', 'Your Journey'), h('div.list', jr.map((j) => {
    const tm = getTeam(st.league, j.teamId) ?? { id: j.teamId, city: '', name: j.name, colors: j.colors };
    return h('div.li', crest(tm, 30), h('div.grow', h('b', j.name), h('div.tiny.muted', j.how)), h('span.tiny.muted', `${STAGE[j.stage]} · ${j.from}${j.to !== j.from ? `-${String(j.to).slice(2)}` : ''}${j.current ? ' · now' : ''}`));
  }))));

  // market value
  const mv = p.history.map((x) => ({ label: `'${String(x.year).slice(2)}`, v: marketValue(x.stage, x.ovr, x.age, x.fame ?? 0) }));
  const nowV = marketValue(st.career.stage === 'retired' ? 'pro' : st.career.stage, p.ovr, p.age, p.fame);
  mv.push({ label: 'now', v: nowV, hi: true });
  const peak = Math.max(...mv.map((x) => x.v));
  out.push(h('div.card', h('div.card-title', h('h3', st.career.stage === 'pro' ? 'Market Value' : st.career.stage === 'college' ? 'NIL Value' : 'Recruiting Value'), h('b.pix', { style: { color: 'var(--good)' } }, fmtMoney(nowV))),
    h('p.tiny.muted', `Peak ${fmtMoney(peak)}`), bars(mv, 'var(--good)')));
  return out;
}

// ------------------------------------------------------------------ Legends

export function legendsPage(app) {
  const st = app.state;
  const cat = app.ui.legendCat ?? 'ind';
  const CATS = [['ind', 'Most Individual Trophies', 'Awards you win as a player: MVPs, all-league teams, player of the year.'], ['team', 'Most Team Titles', 'Championships won with your team.'], ['td', 'Career Touchdowns', 'Passing, rushing, receiving and return touchdowns.'], ['big', 'Defensive Big Plays', 'Interceptions plus sacks.']];
  const i = CATS.findIndex((c) => c[0] === cat);
  const board = legendBoard(st, cat);
  const me = board.find((x) => x.you);
  const top = board.slice(0, 15);
  const nav = (d) => { app.ui.legendCat = CATS[(i + d + CATS.length) % CATS.length][0]; app.render(); };
  return h('div.col', { style: { gap: '14px' } },
    h('div.card',
      h('h2', 'World Legends'),
      h('p.tiny.muted', 'Everyone who ever played, ranked. Your numbers count from day one.'),
      h('div.legend-nav', h('button.btn.small', { onclick: () => nav(-1) }, '‹'), h('b.pix', CATS[i][1]), h('button.btn.small', { onclick: () => nav(1) }, '›')),
      h('p.tiny.muted', CATS[i][2]),
      h('div.list.legend-list', top.map((x) => legendRow(x, cat)),
        me && me.rank > 15 ? [h('div.tiny.muted.center', { style: { padding: '6px' } }, 'You, further down:'), legendRow(me, cat)] : null)));
}

function legendRow(x, cat) {
  return h(`div.li${x.you ? '.me' : ''}`,
    h('b.pix.lg-rank', x.rank),
    h('div.grow', h('b', x.name, x.you ? ' (you)' : ''), h('div.tiny.muted', `${x.pos} · ${x.years}`)),
    h(`span.chip.pix${x.active ? '.good' : ''}`, x.active ? 'ACTIVE' : 'RETIRED'),
    h('b.pix.lg-val', x[cat]));
}

// ------------------------------------------------------------------ Award race

export function racePage(app) {
  const st = app.state;
  const r = awardRace(st);
  const top3 = r.rows.slice(0, 3);
  const me = r.rows.find((x) => x.you);
  const teamOf = (id) => getTeam(st.league, id);
  const pod = (x, place) => x ? h(`div.podium.p${place}`, teamOf(x.team) ? crest(teamOf(x.team), place === 1 ? 44 : 34) : null,
    h('b', x.name.split(' ').slice(-1)[0], x.you ? ' ★' : ''), h('span.tiny', `${x.pts} PTS`), h('div.pod-block.pix', place === 1 ? '1st' : place === 2 ? '2nd' : '3rd')) : h('div');
  return h('div.col', { style: { gap: '14px' } },
    h('div.card.race-card',
      h('div.card-title', h('h2', awardLabel(r.award, st.player.position)), h('span.chip.pix', `WEEK ${r.weeks}`)),
      h('div.race-me', h('div', h('small.pix', 'YOUR POSITION'), h('b.pix', me ? `${me.rank}${['st', 'nd', 'rd'][me.rank - 1] ?? 'th'}` : '-')), h('div', h('small.pix', 'POINTS'), h('b.pix', me?.pts ?? 0)), h('div', h('small.pix', 'GAP TO 1ST'), h('b.pix', me && me.rank > 1 ? `-${r.rows[0].pts - me.pts}` : '—'))),
      h('div.podiums', pod(top3[1], 2), pod(top3[0], 1), pod(top3[2], 3)),
      h('div.list', r.rows.slice(3, 12).map((x) => h(`div.li${x.you ? '.me' : ''}`, h('b.pix.lg-rank', x.rank), teamOf(x.team) ? crest(teamOf(x.team), 22) : null, h('div.grow', h('b', x.name), h('span.tiny.muted', ` ${x.pos}`)), h('b.pix', x.pts)))),
      me && me.rank > 12 ? h('div.li.me', h('b.pix.lg-rank', me.rank), h('div.grow', h('b', `${me.name} (you)`)), h('b.pix', me.pts)) : null,
      h('p.tiny.muted', 'Points come from game performance and team wins. Voters decide at the end of the season.')),
    h('div.card', h('h3', awardLabel(r.kidAward, st.player.position)), h('div.list', r.kids.map((x, i) => h(`div.li${x.you ? '.me' : ''}`, h('b.pix.lg-rank', i + 1), h('div.grow', h('b', x.name, x.you ? ' (you)' : ''), h('span.tiny.muted', ` ${x.pos} · age ${x.age}`)), h('b.pix', x.pts)))),
      r.kids.length ? null : h('p.small.muted', 'No eligible young players yet.')));
}

// ------------------------------------------------------------------ Traits

export function traitsPage(app) {
  const st = app.state;
  const list = traitList(st);
  const slots = equipSlots(st);
  const eq = list.filter((t) => t.equipped);
  const card = (t) => h(`div.trait${t.unlocked ? '' : '.locked'}${t.equipped ? '.on' : ''}`,
    h('div.row', { style: { gap: '10px' } },
      h('span.tr-ic', icon(t.icon)),
      h('div.grow', h('b', t.name), h('div.tiny.muted', t.pos === 'ANY' ? 'Any position' : t.pos === 'MS' ? 'Mascot' : t.pos)),
      t.unlocked ? h(`button.btn.small${t.equipped ? '.primary' : ''}`, { onclick: () => {
        const r = toggleTrait(st, t.id);
        if (!r.ok) { sfx.error?.(); return; }
        sfx.select(); app.save(); app.render();
      } }, t.equipped ? 'Equipped' : 'Equip') : h('span.chip.pix', 'LOCKED')),
    h('p.small', { style: { margin: '6px 0 4px' } }, t.desc),
    t.unlocked ? null : h('div', h('div.watch-bar', h('i', { style: { width: `${t.progress.pct * 100}%` } })), h('div.tiny.muted', `${t.goal.label}: ${t.progress.cur} / ${t.progress.n}`)));
  return h('div.col', { style: { gap: '14px' } },
    h('div.card',
      h('div.card-title', h('h2', 'Traits'), h('span.chip.pix', `${eq.length} / ${slots} SLOTS`)),
      h('p.tiny.muted', 'Unlock traits by hitting career goals, then equip them. Slots: 1 at the start, 2 at level 5, 3 at level 10.'),
      h('div.tr-slots', [0, 1, 2].map((i) => {
        const t = eq[i];
        return h(`div.tr-slot${i >= slots ? '.lockedslot' : ''}`, t ? [h('span.tr-ic', icon(t.icon)), h('b.tiny', t.name)] : h('span.tiny.muted', i >= slots ? `Level ${i === 1 ? 5 : 10}` : 'Empty'));
      }))),
    h('div.col', { style: { gap: '8px' } }, list.sort((a, b) => (b.unlocked - a.unlocked) || (b.progress.pct - a.progress.pct)).map(card)));
}
