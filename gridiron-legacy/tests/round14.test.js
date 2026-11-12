import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as flow from '../src/sim/flow.js';
import { stepGame, resolveMoment, autoMoment, resolveDecision, resolveGameEvent, outcomeFromQuality, MOMENT_NAMES } from '../src/sim/game.js';
import { simulateCareer, randomCareerOpts, STRATEGIES } from '../src/sim/bot.js';
import { awardLabel } from '../src/sim/awards.js';
import { POSITIONS } from '../src/data/positions.js';

test('the mascot is a position with its own moments', () => {
  assert.equal(POSITIONS.MS.label, 'Mascot');
  for (const t of ['ms_hype', 'ms_tshirt', 'ms_rival', 'ms_stunt']) assert.ok(MOMENT_NAMES[t], t);
  const st = flow.newCareer(randomCareerOpts(12, 'MS'));
  for (const q of [0.05, 0.5, 0.95]) {
    const r = outcomeFromQuality(st, { type: 'ms_tshirt', defense: false, yardLine: 40, distance: 10, down: 1 }, q, 'balanced');
    assert.ok(r.text && r.mascot && r.hype >= 0 && r.hype <= 20 && r.shirts >= 0 && r.shirts <= 6);
  }
});

test('a mascot game: moments never move the ball for you, stats are mascot stats, the game finishes', () => {
  const st = flow.newCareer(randomCareerOpts(321, 'MS'));
  st.player.depth.role = 'starter';
  while (st.phase === 'event') flow.resolveEvent(st, 0);
  flow.submitPlan(st, [null, null, null, null, null]);
  let moments = 0;
  for (let guard = 0; guard < 200; guard++) {
    const r = stepGame(st);
    if (r.type === 'end') break;
    if (r.type === 'decision') { resolveDecision(st, false); continue; }
    if (r.type === 'gameEvent') { resolveGameEvent(st, 0); continue; }
    if (r.type === 'halftime') continue;
    moments++;
    assert.ok(r.moment.type.startsWith('ms_'), r.moment.type);
    resolveMoment(st, autoMoment(st, 'balanced'));
  }
  assert.ok(moments >= 3);
  const s = st.game.userStats;
  assert.ok(s.hype > 0);
  assert.equal(s.passYds + s.rushYds + s.recYds + s.tackles, 0);
  flow.finishGame(st);
  assert.equal(st.phase, 'postgame');
});

test('mascot careers reach retirement with mascot awards, in range of the football positions', () => {
  const st = simulateCareer(randomCareerOpts(2024, 'MS'), STRATEGIES.balanced);
  assert.equal(st.phase, 'retired');
  assert.ok(st.player.careerStats.hype > 1000);
  assert.equal(awardLabel('Most Valuable Player', 'MS'), 'Mascot of the Year');
  assert.equal(awardLabel('Most Valuable Player', 'QB'), 'Most Valuable Player');
});

test('mascots have their own skills, traits and costume', async () => {
  const { statLabel } = await import('../src/data/positions.js');
  const { traitList } = await import('../src/sim/traits.js');
  const { costumeSpec, mascotDisplayName } = await import('../src/data/mascots.js');
  const { activityFor, ACTIVITIES } = await import('../src/data/activities.js');
  assert.equal(statLabel('skill', 'MS'), 'Showmanship');
  assert.equal(statLabel('skill', 'QB'), 'Skill');
  const st = flow.newCareer(randomCareerOpts(5, 'MS'));
  const traits = traitList(st);
  assert.ok(traits.length >= 8 && traits.every((t) => t.pos === 'MS'), traits.map((t) => t.id).join());
  const cs = costumeSpec({ costume: { kind: 'team', fur: 'gold', hat: 'crown' } }, 'wolf', ['#000', '#fff']);
  assert.equal(cs.kind, 'wolf'); assert.deepEqual(cs.costume.fur, ['#e8b730', '#7a4a10']); assert.equal(cs.costume.hat, 'crown');
  assert.ok(mascotDisplayName(st.player).length > 3);
  assert.equal(activityFor(ACTIVITIES.find((a) => a.id === 'drills'), 'MS').label, 'Routine Rehearsal');
});
