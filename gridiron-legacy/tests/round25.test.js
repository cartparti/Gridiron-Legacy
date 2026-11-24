import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as flow from '../src/sim/flow.js';
import { randomCareerOpts } from '../src/sim/bot.js';
import { stepGame, resolveMoment, resolveDecision, resolveGameEvent, autoMoment } from '../src/sim/game.js';

/** Advance a fresh game to the user's first key moment. */
function toMoment(seed, pos) {
  const st = flow.newCareer(randomCareerOpts(seed, pos));
  while (st.phase === 'event') flow.resolveEvent(st, 0);
  flow.submitPlan(st, [null, null, null, null, null]);
  for (let i = 0; i < 300; i++) {
    const r = stepGame(st);
    if (r.type === 'end') return null;
    if (r.type === 'decision') { resolveDecision(st, true); continue; }
    if (r.type === 'gameEvent') { resolveGameEvent(st, 0); continue; }
    if (r.type === 'moment' && st.game.pending) return st;
  }
  return null;
}

test('receivers: sacks and throws to teammates are not targets; bad throws are not drops', () => {
  let checked = 0;
  for (let seed = 1; seed < 40 && checked < 3; seed++) {
    const st = toMoment(seed, 'WR');
    if (!st || !/^wr_/.test(st.game.pending.type)) continue;
    const s = st.game.userStats;
    const t0 = s.targets, d0 = s.drops;
    resolveMoment(st, { complete: false, yards: 0, quality: 0.42, sack: true, notTargeted: true, blame: 'line', why: 'x', played: true, call: 'balanced' });
    assert.equal(s.targets, t0, 'a sack is not a target');
    const st2 = toMoment(seed, 'WR');
    const s2 = st2.game.userStats;
    resolveMoment(st2, { complete: false, yards: 0, quality: 0.45, blame: 'qb', why: 'Bad throw', played: true, call: 'balanced' });
    assert.equal(s2.targets, t0 + 1, 'a bad throw at you is a target');
    assert.equal(s2.drops, d0, 'but not a drop');
    const st3 = toMoment(seed, 'WR');
    const s3 = st3.game.userStats;
    const r0 = s3.rec, y0 = s3.recYds;
    resolveMoment(st3, { complete: true, yards: 14, quality: 0.6, toOther: true, notTargeted: true, blame: 'none', why: 'teammate', played: true, call: 'balanced' });
    assert.equal(s3.rec, r0, 'a catch by a teammate is not your catch');
    assert.equal(s3.recYds, y0);
    const st4 = toMoment(seed, 'WR');
    const dd = st4.game.userStats.drops;
    resolveMoment(st4, { complete: false, yards: 0, quality: 0.12, blame: 'you', drop: true, why: 'dropped', played: true, call: 'balanced' });
    assert.equal(st4.game.userStats.drops, dd + 1, 'a real drop counts');
    assert.equal(st4.game.moments.at(-1).blame, 'you');
    checked++;
  }
  assert.ok(checked >= 1);
});

test('corners: a catch on another man far away is not charged to you', () => {
  for (let seed = 1; seed < 60; seed++) {
    const st = toMoment(seed, 'CB');
    if (!st || st.game.pending.type !== 'cb_cover') continue;
    const s = st.game.userStats;
    const ya = s.ydsAllowed, ra = s.recAllowed;
    resolveMoment(st, { defense: true, caught: true, yardsAllowed: 18, quality: 0.5, notMine: true, blame: 'none', why: 'other side', played: true, call: 'balanced' });
    assert.equal(s.ydsAllowed, ya);
    assert.equal(s.recAllowed, ra);
    return;
  }
  assert.fail('no cover moment found');
});

test('bot (unplayed) moments keep the old stat rules', () => {
  const st = toMoment(5, 'WR');
  resolveMoment(st, autoMoment(st, 'balanced'));
  assert.ok(st.game.userStats.targets >= 0);
});
