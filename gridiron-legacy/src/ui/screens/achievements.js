// Achievements page (Career > Achievements), unlock cards for the postgame / season review, and the coach's
// season goals card for the Week tab.
import { h } from '../dom.js';
import { icon } from '../icons.js';
import { ACH_BY_ID, TIER_NAME, TIER_XP, achievementsFor, achievementSummary } from '../../sim/achievements.js';
import { goalProgress } from '../../sim/goals.js';
import { fmtMoney } from '../../core/util.js';

const STAGE = { hs: 'High school', college: 'College', pro: 'Pro' };

/** Little "ACHIEVEMENT" rows for newly unlocked ids. */
export function achUnlockRows(ids = []) {
  return ids.map((id) => ACH_BY_ID[id]).filter(Boolean).map((a) => h(`div.ach-new.t${a.tier}`,
    h('span.ach-ic', icon(a.icon)),
    h('div.grow', h('div.tiny.pix', `${TIER_NAME[a.tier].toUpperCase()} ACHIEVEMENT`), h('b', a.name), h('div.tiny.muted', a.desc)),
    h('span.chip.gold.pix', `+${TIER_XP[a.tier]} XP`)));
}

/** Career > Achievements. */
export function achievementsPage(app) {
  const p = app.state.player;
  const sum = achievementSummary(p);
  const list = achievementsFor(p.position);
  const got = list.filter((a) => p.achievements?.[a.id]).sort((a, b) => (p.achievements[b.id].year - p.achievements[a.id].year) || b.tier - a.tier);
  const locked = list.filter((a) => !p.achievements?.[a.id]).sort((a, b) => a.tier - b.tier);
  const card = (a, on) => h(`div.ach-card.t${a.tier}${on ? '.on' : ''}`,
    h('span.ach-ic', icon(a.icon)),
    h('div.grow', h('b', a.name), h('div.tiny.muted', a.desc),
      on ? h('div.tiny', `${STAGE[p.achievements[a.id].stage] ?? ''} · ${p.achievements[a.id].year}`) : null),
    h('span.ach-tier.pix', on ? '★' : TIER_NAME[a.tier][0]));
  return h('div.col', { style: { gap: '14px' } },
    h('div.card.hero',
      h('div.card-title', h('h2', 'Achievements'), h('span.chip.pix.gold', `${sum.done} / ${sum.total}`)),
      h('div.ach-bar', h('i', { style: { width: `${Math.round(sum.pct * 100)}%` } })),
      h('p.tiny.muted', 'Milestones from your whole career. Each one pays XP (Bronze 25, Silver 60, Gold 120) and a little fame.')),
    got.length ? h('div.card', h('h3', `Unlocked (${got.length})`), h('div.ach-grid', got.map((a) => card(a, true)))) : null,
    h('div.card', h('h3', `Still to get (${locked.length})`), locked.length ? h('div.ach-grid', locked.map((a) => card(a, false))) : h('p.small.good', 'You got them all. Legend.')));
}

/** The coach's season goals with live progress (Week tab). */
export function goalsCard(app) {
  const st = app.state;
  const rows = goalProgress(st);
  if (!rows.length) return null;
  const r0 = rows[0].reward;
  const reward = [`+${r0.xp} XP`, 'coach trust', r0.money ? fmtMoney(r0.money) : null].filter(Boolean).join(', ');
  return h('div.card.goals-card',
    h('div.card-title', h('h3', 'Coach\'s Goals'), h('span.tiny.muted', `${rows.filter((r) => r.done).length}/${rows.length} done`)),
    h('div.col', { style: { gap: '9px' } }, rows.map((r) => h(`div.goal${r.done ? '.done' : ''}`,
      h('div.row.between', h('b.small', r.done ? `✓ ${r.label}` : r.label), h('span.tiny.muted', r.text)),
      h('div.goal-bar', h('i', { style: { width: `${Math.round(r.pct * 100)}%` } }))))),
    h('p.tiny.muted', { style: { marginTop: '8px' } }, `Each goal you hit by the end of the season: ${reward}.`));
}

/** Season review: how the goals went. */
export function goalsReview(goals) {
  if (!goals?.results?.length) return null;
  return h('div.card.goals-card',
    h('div.card-title', h('h3', 'Coach\'s Goals'), h('span.chip.pix', `${goals.hit}/${goals.results.length} HIT`)),
    h('div.list', goals.results.map((r) => h('div.li', h('span', r.done ? '✅' : '❌'), h('div.grow', h('b.small', r.label), h('div.tiny.muted', r.text)),
      r.done ? h('span.chip.good.pix', `+${r.reward.xp} XP${r.reward.money ? ` · ${fmtMoney(r.reward.money)}` : ''}`) : null))),
    goals.hit === 0 ? h('p.tiny.bad', 'The coach noticed. Trust took a small hit.') : null);
}
