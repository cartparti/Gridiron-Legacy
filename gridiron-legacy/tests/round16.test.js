import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as flow from '../src/sim/flow.js';
import { stepGame, resolveMoment, autoMoment, resolveDecision, resolveGameEvent, outcomeFromQuality, MOMENT_NAMES, fgDistance } from '../src/sim/game.js';
import { simulateCareer, randomCareerOpts, STRATEGIES } from '../src/sim/bot.js';
import { POSITIONS } from '../src/data/positions.js';
import { addStats, emptyStats } from '../src/sim/player.js';
import { ACHIEVEMENTS, checkAchievements, achievementSummary } from '../src/sim/achievements.js';
import { setSeasonGoals, goalProgress, resolveGoals } from '../src/sim/goals.js';

test('the kicker is a position with field goals, extra points and kickoffs', () => {
  assert.equal(POSITIONS.K.label, 'Kicker');
  for (const t of ['k_fg', 'k_pat', 'k_kickoff', 'k_onside']) assert.ok(MOMENT_NAMES[t], t);
  const st = flow.newCareer(randomCareerOpts(7, 'K'));
  const fg = { type: 'k_fg', defense: false, yardLine: 30, distance: 10, down: 4 };
  assert.equal(fgDistance(30), 47);
  assert.equal(outcomeFromQuality(st, fg, 0.95, 'balanced').made, true);
  assert.equal(outcomeFromQuality(st, fg, 0.02, 'balanced').made, false);
  const ko = outcomeFromQuality(st, { type: 'k_kickoff', defense: false, yardLine: 65, distance: 10, down: 1 }, 0.9, 'balanced');
  assert.ok(ko.kick && ko.touchback);
});

test('a kicker game: kicks score points, misses do not, stats are kicking stats', () => {
  let fgAtt = 0, xpAtt = 0, kicks = 0;
  for (let seed = 400; seed < 406; seed++) {
    const st = flow.newCareer(randomCareerOpts(seed, 'K'));
    st.player.depth.role = 'starter';
    while (st.phase === 'event') flow.resolveEvent(st, 0);
    flow.submitPlan(st, [null, null, null, null, null]);
    for (let guard = 0; guard < 300; guard++) {
      const r = stepGame(st);
      if (r.type === 'end') break;
      if (r.type === 'decision') { resolveDecision(st, false); continue; }
      if (r.type === 'gameEvent') { resolveGameEvent(st, 0); continue; }
      if (r.type === 'halftime') continue;
      const m = st.game.pending;
      assert.ok(m.type.startsWith('k_'), m.type);
      const before = { ...st.game.score };
      const res = autoMoment(st, 'balanced');
      resolveMoment(st, res);
      kicks++;
      const side = st.game.userSide;
      if (m.type === 'k_fg') assert.equal(st.game.score[side] - before[side], res.made ? 3 : 0);
      if (m.type === 'k_pat') assert.equal(st.game.score[side] - before[side], res.made ? 7 : 6);
    }
    const s = st.game.userStats;
    fgAtt += s.fgAtt; xpAtt += s.xpAtt;
    assert.equal(s.passYds + s.rushYds + s.recYds, 0, 'no offensive stats for a kicker');
    flow.finishGame(st);
  }
  assert.ok(kicks > 10 && fgAtt + xpAtt > 6, `kicks ${kicks} fg ${fgAtt} xp ${xpAtt}`);
});

test('longest field goal keeps the best, not the sum', () => {
  const a = emptyStats(); addStats(a, { fgLong: 44, fgMade: 2 }); addStats(a, { fgLong: 51, fgMade: 1 }); addStats(a, { fgLong: 30, fgMade: 1 });
  assert.equal(a.fgLong, 51); assert.equal(a.fgMade, 4);
});

test('achievements unlock once and pay XP; a whole career unlocks a good number', () => {
  const st = flow.newCareer(randomCareerOpts(31, 'QB'));
  const xp0 = st.player.xp ?? 0;
  const g = { sitOut: false, won: true, grade: 95, userStats: { ...emptyStats(), passYds: 320, passTD: 2 } };
  const first = checkAchievements(st, 'game', { g }).map((a) => a.id);
  assert.ok(first.includes('debut') && first.includes('firstw') && first.includes('qb300') && first.includes('agrade'), first.join());
  assert.ok((st.player.xp ?? 0) > xp0 || st.player.level > 1);
  assert.equal(checkAchievements(st, 'game', { g }).length, 0, 'never twice');
  const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
  assert.equal(ids.size, ACHIEVEMENTS.length, 'unique ids');
  const done = simulateCareer(randomCareerOpts(77, 'K'), STRATEGIES.balanced, 0.6);
  const sum = achievementSummary(done.player);
  assert.ok(sum.done >= 8 && sum.done <= sum.total, JSON.stringify(sum));
});

test('season goals: three goals, live progress, rewards for the ones you hit', () => {
  const st = flow.newCareer(randomCareerOpts(55, 'RB'));
  assert.ok(st.goals && st.goals.list.length === 3, 'set at the start of the season');
  const rows = goalProgress(st);
  assert.equal(rows.length, 3);
  for (const r of rows) assert.ok(r.label && r.target > 0 && r.pct >= 0 && r.pct <= 1, JSON.stringify(r));
  // hit everything
  st.player.seasonStats.rushYds = 99999; st.player.seasonStats.rushTD = 999; st.player.seasonStats.games = 10; st.player.seasonStats.grades = 990;
  st.player.depth.role = 'starter';
  const coach0 = st.player.rel.coach;
  const team = st.league.teams.find((t) => t.id === st.career.teamId); team.w = 12;
  st.league.playoffs = { seeds: [st.career.teamId] };
  const res = resolveGoals(st);
  assert.equal(res.hit, 3);
  assert.ok(st.player.rel.coach > coach0);
  // a new season gets new goals
  st.career.year++;
  setSeasonGoals(st);
  assert.equal(st.goals.year, st.career.year);
});
