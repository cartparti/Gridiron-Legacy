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

test('a typed hometown gets its own two schools (yours + crosstown rival), stable by name', async () => {
  const { hometownSchools, cleanTown } = await import('../src/data/hometown.js');
  assert.equal(cleanTown('  cedar   falls!! '), 'Cedar Falls');
  const a = hometownSchools('Cedar Falls');
  const b = hometownSchools('cedar falls');
  assert.deepEqual(a, b);
  assert.equal(a.length, 2);
  assert.notEqual(a[0].name, a[1].name);
  const st = flow.newCareer({ first: 'A', last: 'B', position: 'WR', background: 'natural', number: 9, hometown: 'Cedar Falls', customTown: 'Cedar Falls', hsTeamId: a[0].id, seed: 3 });
  assert.equal(st.career.teamId, a[0].id);
  assert.equal(st.career.rivalTeamId, a[1].id);
  assert.ok(st.league.teams.length >= 12);
});

test('playing a stronger opponent makes the timing window smaller', async () => {
  const { tolerance, matchup } = await import('../src/sim/game.js');
  const st = career('QB', 5);
  while (st.phase === 'event') flow.resolveEvent(st, 0);
  flow.submitPlan(st, [null, null, null, null, null]);
  const g = st.game;
  const oppSide = g.userSide === 'home' ? 'away' : 'home';
  g.ratings[oppSide].def = 40;
  const easy = tolerance(st, 'balanced', 'qb_throw');
  assert.ok(matchup(st).k < 0);
  g.ratings[oppSide].def = 85;
  const hard = tolerance(st, 'balanced', 'qb_throw');
  assert.ok(matchup(st).k > 0);
  assert.ok(hard < easy * 0.9, `${hard} vs ${easy}`);
});

test('penalty yards move the ball and can give a first down, without counting in stats', () => {
  const st = career('RB', 8);
  st.player.depth.role = 'starter'; // a starter's game (backups only get late snaps)
  while (st.phase === 'event') flow.resolveEvent(st, 0);
  flow.submitPlan(st, [null, null, null, null, null]);
  let r;
  for (let i = 0; i < 50; i++) { r = stepGame(st); if (r.type === 'moment') break; if (r.type === 'gameEvent') resolveGameEvent(st, 0); if (r.type === 'decision') resolveDecision(st, false); }
  assert.equal(r.type, 'moment');
  const before = st.game.userStats.rushYds;
  // a penalty big enough to reach the end zone, so the drive ends here (no simulated carries mixed into the stats)
  const res = resolveMoment(st, { complete: true, yards: 2, penYds: 99, autoFirst: true, flag: true, quality: 0.5, text: 'Facemask! Half the distance.' });
  // the 2 rushing yards count; the 99 penalty yards don't (simulated filler carries on the same drive may add a few)
  const gained = st.game.userStats.rushYds - before;
  assert.ok(gained >= 2 && gained < 30, `rush yards ${gained}`);
  assert.ok(res.outcome);
});

test('older looks pick up the new jersey/cleat/hair options; random looks fit the position', async () => {
  const L = await import('../src/data/looks.js');
  const old = { ...L.defaultLook('QB') };
  for (const k of Object.keys(L.JERSEY_DEFAULTS)) delete old[k];
  const n = L.normalizeLook(old);
  assert.equal(n.jSleeve, 'short');
  assert.equal(n.cleatDesign, 'stripe');
  assert.equal(n.padSize, 'normal');
  let big = 0;
  for (let i = 0; i < 40; i++) if (L.randomLook(`ol${i}`, { position: 'OL' }).padSize === 'big') big++;
  assert.ok(big > 10, `linemen with big pads: ${big}`);
  assert.ok(L.HAIR_STYLES.length >= 21 && L.BEARDS.length >= 12 && L.TATTOOS.length >= 14);
});
