import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as flow from '../src/sim/flow.js';
import { botStep, randomCareerOpts, STRATEGIES } from '../src/sim/bot.js';
import { fantasyPoints, jerseySales, bucketList, handshakeDue, doHandshake, isBirthdayWeek, throwParty } from '../src/sim/moments.js';

test('v0.62: fantasy points, jersey sales, bucket list, handshake and birthday over a full career', () => {
  assert.equal(fantasyPoints('QB', { passYds: 250, passTD: 2, int: 1 }), 16);
  const seen = { birthday: 0, handshake: 0, fantasy: 0, jersey: 0 };
  for (const [seed, pos] of [[71, 'QB'], [72, 'CB'], [73, 'MS']]) {
    const st = flow.newCareer(randomCareerOpts(seed, pos));
    for (let i = 0; i < 200000 && st.phase !== 'retired'; i++) {
      if (st.phase === 'plan' && isBirthdayWeek(st) && !st.birthday.party && throwParty(st, 'family')) seen.birthday++;
      if (st.phase === 'plan' && jerseySales(st)) seen.jersey++;
      if (st.phase === 'postgame') { if (st.lastGame.fantasy) seen.fantasy++; if (handshakeDue(st) && doHandshake(st, 'shake')) seen.handshake++; }
      botStep(st, STRATEGIES.balanced, 0.6);
    }
    assert.equal(st.phase, 'retired');
    const b = bucketList(st);
    assert.ok(b.total >= 13 && b.done >= 1, `${pos} bucket ${b.done}/${b.total}`);
  }
  for (const [k, v] of Object.entries(seen)) assert.ok(v > 0, `${k} happened`);
});
