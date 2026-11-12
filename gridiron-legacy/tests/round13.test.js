import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as flow from '../src/sim/flow.js';
import { injuryStatus, inGameOutcome } from '../src/sim/injury.js';
import { INJURIES } from '../src/data/lifestyle.js';
import { outcomeFromQuality, MOMENT_NAMES } from '../src/sim/game.js';
import { randomCareerOpts, botStep, STRATEGIES } from '../src/sim/bot.js';

const inj = (id, weeks) => ({ id, label: id, weeks, major: !!INJURIES.find((i) => i.id === id).major });

test('injury severity decides whether you can play', () => {
  assert.equal(injuryStatus(inj('bruise', 1), 'RB'), 'probable');
  assert.equal(injuryStatus(inj('hamstring', 2), 'RB'), 'questionable');
  assert.equal(injuryStatus(inj('concussion', 1), 'QB'), 'out');
  assert.equal(injuryStatus(inj('arm', 3), 'DT'), 'out'); // a broken arm: nobody plays on that
  assert.equal(injuryStatus(inj('brokenankle', 1), 'CB'), 'out');
  assert.equal(injuryStatus(inj('acl', 30), 'WR'), 'season');
  // a broken hand: a lineman can play in a cast for the last weeks, a QB can't
  assert.equal(injuryStatus(inj('hand', 4), 'DT'), 'out');
  assert.equal(injuryStatus(inj('hand', 2), 'DT'), 'questionable');
  assert.equal(injuryStatus(inj('hand', 2), 'QB'), 'out');
  // old saves without an id fall back by the major flag
  assert.equal(injuryStatus({ label: 'Old', weeks: 2, major: true }, 'QB'), 'out');
  assert.equal(inGameOutcome('bruise', 0.9), 'return');
  assert.equal(inGameOutcome('arm', 0.01), 'out');
});

test('gameDayStatus keeps you out on a broken bone and lets you play hurt on a strain', () => {
  const st = flow.newCareer(randomCareerOpts(41, 'RB'));
  st.player.injury = inj('arm', 5);
  assert.equal(flow.gameDayStatus(st).canPlay, false);
  st.player.injury = inj('ankle', 2);
  const s = flow.gameDayStatus(st);
  assert.ok(s.canPlay && s.hurt && s.injury === 'questionable');
});

test('tush push results are football', () => {
  const st = flow.newCareer(randomCareerOpts(9, 'QB'));
  assert.equal(MOMENT_NAMES.qb_sneak, 'Tush Push');
  for (const q of [0.05, 0.3, 0.6, 0.95]) {
    const m = { type: 'qb_sneak', defense: false, yardLine: 40, distance: 1, down: 3 };
    const r = outcomeFromQuality(st, m, q, 'balanced');
    assert.ok(r.text);
    if (!r.turnover) assert.ok(r.yards >= 0 && r.yards <= 2);
    const g = outcomeFromQuality(st, { ...m, yardLine: 1 }, 0.95, 'balanced');
    assert.ok(g.td);
  }
});

test('texts after games are occasional and do not repeat the same line back to back', () => {
  const st = flow.newCareer(randomCareerOpts(77));
  let games = 0;
  for (let i = 0; i < 3000 && games < 30; i++) { const ph = st.phase; botStep(st, STRATEGIES.balanced); if (st.phase === 'postgame' && ph !== 'postgame') games++; }
  const all = Object.values(st.phone.threads).flatMap((t) => t.filter((m) => m.from === 'them'));
  assert.ok(all.length < games * 2.2, `${all.length} texts in ${games} games`);
  for (const t of Object.values(st.phone.threads)) {
    const them = t.filter((m) => m.from === 'them').map((m) => m.text);
    for (let i = 1; i < them.length; i++) assert.notEqual(them[i], them[i - 1]);
  }
});
