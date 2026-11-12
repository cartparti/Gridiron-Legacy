import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rand, randInt, shuffle } from '../src/core/rng.js';
import { POSITIONS, STAT_KEYS } from '../src/data/positions.js';
import { calcOverall, trainingGain } from '../src/sim/player.js';
import { createLeague, makeSchedule, quickSim, recordResult, standings, seedPlayoffs, advancePlayoffRound, simOtherGames, capSpace } from '../src/sim/league.js';
import { SALARY_CAP, STAGES } from '../src/data/config.js';
import * as flow from '../src/sim/flow.js';
import { simulateCareer, randomCareerOpts, STRATEGIES, botStep, botPlan } from '../src/sim/bot.js';
import { stepGame, resolveMoment, autoMoment, tolerance, resolveDecision, resolveGameEvent, outcomeFromQuality } from '../src/sim/game.js';
import { maxEnergy, planCost } from '../src/sim/week.js';
import { computeLegacy } from '../src/sim/legacy.js';

const holder = (seed) => ({ rngState: seed, career: { year: 2026, stage: 'pro', teamId: 'SLC' }, player: { rel: { teammates: 50 }, ovr: 70 } });

test('rng is deterministic for a seed', () => {
  const a = holder(42);
  const b = holder(42);
  const xs = Array.from({ length: 20 }, () => rand(a));
  const ys = Array.from({ length: 20 }, () => rand(b));
  assert.deepEqual(xs, ys);
  for (const x of xs) assert.ok(x >= 0 && x < 1);
  const h = holder(7);
  for (let i = 0; i < 200; i++) {
    const v = randInt(h, 3, 5);
    assert.ok(v >= 3 && v <= 5);
  }
  assert.equal(shuffle(holder(1), [1, 2, 3, 4, 5]).sort().join(), '1,2,3,4,5');
});

test('position weights sum to 1 and overall is a weighted average', () => {
  for (const [pos, def] of Object.entries(POSITIONS)) {
    const total = STAT_KEYS.reduce((a, k) => a + def.weights[k], 0);
    assert.ok(Math.abs(total - 1) < 1e-9, `${pos} weights sum to ${total}`);
    assert.equal(Math.round(calcOverall({ speed: 70, skill: 70, iq: 70, strength: 70 }, pos)), 70);
  }
});

test('training gains shrink as a stat gets higher', () => {
  const p = { age: 20, mood: 70, potential: 1, perks: [], stats: { speed: 50 } };
  const low = trainingGain(p, 'speed', 1);
  p.stats.speed = 90;
  const high = trainingGain(p, 'speed', 1);
  assert.ok(low > high * 3, `low ${low} vs high ${high}`);
});

test('schedules never pair a team with itself or repeat a team in a week', () => {
  for (const n of [10, 12, 30]) {
    const ids = Array.from({ length: n }, (_, i) => `T${i}`);
    const games = n === 30 ? 14 : n - 2;
    const sched = makeSchedule(holder(n), ids, games);
    assert.equal(sched.length, games);
    const pairs = new Set();
    for (const week of sched) {
      const seen = new Set();
      for (const g of week) {
        assert.notEqual(g.home, g.away);
        assert.ok(!seen.has(g.home) && !seen.has(g.away));
        seen.add(g.home); seen.add(g.away);
        const key = [g.home, g.away].sort().join('-');
        assert.ok(!pairs.has(key), `repeat matchup ${key}`);
        pairs.add(key);
      }
      assert.equal(seen.size, n);
    }
  }
});

test('a full league season produces valid standings and one champion', () => {
  for (const kind of ['hs', 'college', 'pro']) {
    const st = holder(99);
    st.career.teamId = 'none';
    const league = createLeague(st, kind);
    for (let w = 0; w < league.schedule.length; w++) {
      league.week = w;
      simOtherGames(st, league, null);
    }
    const table = standings(league);
    const games = table.reduce((a, t) => a + t.w + t.l, 0);
    assert.equal(games, league.teams.length * STAGES[kind].games);
    seedPlayoffs(league);
    let guard = 0;
    while (league.phase === 'playoffs' && guard++ < 10) {
      simOtherGames(st, league, null);
      advancePlayoffRound(league);
    }
    assert.equal(league.phase, 'done');
    assert.ok(league.teams.some((t) => t.id === league.champion));
  }
});

test('quick-simmed games never end in a tie and scores look like football', () => {
  const st = holder(5);
  st.career.teamId = 'none';
  const league = createLeague(st, 'pro');
  let total = 0;
  for (let i = 0; i < 300; i++) {
    const r = quickSim(st, league, 'SLC', 'SFO');
    assert.notEqual(r.home, r.away);
    total += r.home + r.away;
  }
  const avg = total / 300;
  assert.ok(avg > 25 && avg < 65, `average combined score ${avg}`);
});

test('pro teams stay under the salary cap', () => {
  const st = holder(11);
  const league = createLeague(st, 'pro');
  for (const t of league.teams) assert.ok(capSpace(league, t.id) > 0, `${t.id} over cap by ${-capSpace(league, t.id)}`);
});

test('a user game pauses for key moments, decisions and events, then finishes', () => {
  for (const pos of ['QB', 'RB', 'WR', 'CB', 'DT']) {
    const state = flow.newCareer(randomCareerOpts(321, pos));
    while (state.phase === 'event') flow.resolveEvent(state, 0);
    assert.equal(state.phase, 'plan');
    flow.submitPlan(state, [null, null, null, null, null]);
    assert.equal(state.phase, 'game');
    let moments = 0;
    for (let guard = 0; guard < 200; guard++) {
      const r = stepGame(state);
      if (r.type === 'end') break;
      if (r.type === 'decision') { resolveDecision(state, true); continue; }
      if (r.type === 'gameEvent') { resolveGameEvent(state, r.event.choices.length - 1); continue; }
      moments++;
      assert.equal(r.moment.defense, pos === 'CB' || pos === 'DT');
      const res = autoMoment(state, 'balanced');
      assert.ok(res.quality >= 0 && res.quality <= 1);
      resolveMoment(state, res);
    }
    const minM = state.player.depth?.role === 'backup' ? 2 : 3; // backups only get a couple of late snaps
    assert.ok(moments >= minM && moments <= 16, `${pos} moments: ${moments}`);
    flow.finishGame(state);
    assert.equal(state.phase, 'postgame');
    assert.notEqual(state.lastGame.score.home, state.lastGame.score.away);
  }
});

test('every moment type produces a valid simulated outcome', () => {
  const state = flow.newCareer(randomCareerOpts(9, 'QB'));
  const types = ['qb_throw', 'qb_scramble', 'qb_hailmary', 'rb_run', 'rb_screen', 'rb_goalline', 'wr_route', 'wr_jumpball', 'wr_toetap', 'cb_cover', 'cb_tackle', 'dt_rush', 'dt_run'];
  for (const type of types) {
    for (const q of [0, 0.3, 0.6, 0.95]) {
      const m = { type, defense: type.startsWith('cb'), yardLine: type === 'rb_goalline' ? 2 : 40, distance: 8, down: 3 };
      const r = outcomeFromQuality(state, m, q, 'balanced');
      assert.ok(typeof r.text === 'string' && r.text.length, `${type} q${q} text`);
      if (!m.defense) assert.ok(r.yards <= m.yardLine, `${type} yards past goal`);
    }
  }
});

test('difficulty scales the timing window', () => {
  const state = flow.newCareer(randomCareerOpts(10));
  state.difficulty = 'easy';
  const easy = tolerance(state, 'balanced');
  state.difficulty = 'legend';
  assert.ok(tolerance(state, 'balanced') < easy * 0.6);
});

test('weekly plans from the bot never exceed the energy budget', () => {
  const state = flow.newCareer(randomCareerOpts(77));
  for (let i = 0; i < 50; i++) {
    const plan = botPlan(state, STRATEGIES.grinder);
    assert.ok(planCost(plan) <= maxEnergy(state));
  }
});

test('tolerance is easier on Safe and harder on Risky', () => {
  const state = flow.newCareer(randomCareerOpts(8));
  assert.ok(tolerance(state, 'safe') > tolerance(state, 'balanced'));
  assert.ok(tolerance(state, 'balanced') > tolerance(state, 'risky'));
});

test('full careers reach retirement with a legacy, deterministically', () => {
  const a = simulateCareer(randomCareerOpts(2024));
  const b = simulateCareer(randomCareerOpts(2024));
  assert.equal(a.phase, 'retired');
  assert.ok(a.legacy && a.legacy.tier.label);
  assert.equal(a.legacy.score, b.legacy.score);
  assert.equal(a.player.history.length, b.player.history.length);
  // HS 2 seasons, college 2-3, then pro.
  const stages = a.player.history.map((h) => h.stage);
  assert.equal(stages.filter((s) => s === 'hs').length, 2);
  assert.ok(stages.filter((s) => s === 'college').length >= 2);
  assert.ok(a.player.age <= 36);
});

test('careers survive every strategy and position without errors', () => {
  for (const [key, strat] of Object.entries(STRATEGIES)) {
    for (const pos of ['QB', 'RB', 'WR', 'CB']) {
      const st = simulateCareer(randomCareerOpts(key.length * 100 + pos.charCodeAt(0), pos), strat);
      assert.equal(st.phase, 'retired');
      assert.ok(Number.isFinite(st.player.money));
      assert.ok(Number.isFinite(st.player.ovr));
    }
  }
});

test('the state survives a JSON save/load round trip mid-career', () => {
  const state = flow.newCareer(randomCareerOpts(55));
  for (let i = 0; i < 60; i++) botStep(state, STRATEGIES.balanced);
  const copy = JSON.parse(JSON.stringify(state));
  for (let i = 0; i < 60; i++) {
    botStep(state, STRATEGIES.balanced);
    botStep(copy, STRATEGIES.balanced);
  }
  assert.equal(JSON.stringify(state.player), JSON.stringify(copy.player));
});

test('legacy score increases with awards', () => {
  const st = simulateCareer(randomCareerOpts(31));
  const base = computeLegacy(st).score;
  st.player.awards.push({ name: 'Most Valuable Player', year: 2040, stage: 'pro' });
  assert.ok(computeLegacy(st).score > base);
});

test('salary cap constant is sane', () => {
  assert.ok(SALARY_CAP > 1e8);
});
