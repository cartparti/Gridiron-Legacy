import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as flow from '../src/sim/flow.js';
import { creditTraining, trainValue, levelInfo } from '../src/sim/progress.js';
import { stepGame, resolveMoment, autoMoment, resolveDecision, resolveGameEvent, outcomeFromQuality } from '../src/sim/game.js';

const career = (pos = 'QB', seed = 77) => flow.newCareer({ first: 'A', last: 'B', position: pos, background: 'natural', number: 9, hometown: 'Westfield', hsTeamId: 'WFW', seed });

test('acing training drills earns skill points; retries only count the improvement', () => {
  const st = career();
  const p0 = levelInfo(st).points;
  assert.equal(trainValue(0.3), 0);
  let r = creditTraining(st, 0.95); // A+ = 60%
  assert.equal(r.points, 0);
  assert.equal(st.player.trainPts, 0.6);
  r = creditTraining(st, 0.95, 0.95); // same grade again: nothing
  assert.equal(r.gain, 0);
  r = creditTraining(st, 0.85); // A = 45% -> crosses 100%
  assert.equal(r.points, 1);
  assert.equal(levelInfo(st).points, p0 + 1);
  assert.ok(Math.abs(st.player.trainPts - 0.05) < 1e-9);
});

test('good plays can keep you on the field for the next snap of the same series', () => {
  let series = 0;
  for (let seed = 1; seed <= 12 && !series; seed++) {
    const state = career('RB', seed);
    while (state.phase === 'event') flow.resolveEvent(state, 0);
    flow.submitPlan(state, [null, null, null, null, null]);
    for (let guard = 0; guard < 300; guard++) {
      const r = stepGame(state);
      if (r.type === 'end') break;
      if (r.type === 'decision') { resolveDecision(state, false); continue; }
      if (r.type === 'gameEvent') { resolveGameEvent(state, 0); continue; }
      if (r.moment.series) { series++; assert.match(r.moment.situation, /series|drill|stand|Clutch/i); }
      // a strong but non-scoring gain, so the drive keeps going
      const res = outcomeFromQuality(state, r.moment, 0.7, 'balanced');
      if (res.td) { resolveMoment(state, autoMoment(state)); continue; }
      resolveMoment(state, res);
    }
  }
  assert.ok(series > 0, 'expected at least one same-series snap');
});
