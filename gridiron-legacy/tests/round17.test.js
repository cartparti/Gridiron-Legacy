import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as flow from '../src/sim/flow.js';
import { botStep, randomCareerOpts, STRATEGIES } from '../src/sim/bot.js';
import { PLAYS, dealPlays, playCount } from '../src/data/playbook.js';

test('every play call deals five different plays, in every situation', () => {
  const spots = [{ yardLine: 45, down: 1, distance: 10 }, { yardLine: 3, down: 2, distance: 3 }, { yardLine: 15, down: 3, distance: 8 }, { yardLine: 92, down: 2, distance: 6 }, { yardLine: 50, down: 3, distance: 1 }];
  for (const mode of Object.keys(PLAYS)) {
    assert.ok(playCount(mode) >= 30, `${mode} has ${playCount(mode)} plays`);
    for (const call of ['safe', 'balanced', 'risky']) for (const m of spots) {
      const out = dealPlays(mode, call, m);
      assert.equal(out.length, 5, `${mode}/${call}`);
      assert.equal(new Set(out.map((x) => x.name)).size, 5, `${mode}/${call} unique`);
    }
  }
});

test('early draft: offered after the first and second college seasons, with a mock draft built from last season', () => {
  const st = flow.newCareer(randomCareerOpts(91, 'WR'));
  const seen = [];
  for (let i = 0; i < 20000 && st.career.stage !== 'pro'; i++) {
    if (st.phase === 'declare') {
      seen.push(st.career.stageSeason);
      const pr = st.declareProj;
      assert.ok(pr && pr.label && pr.lo <= pr.median && pr.median <= pr.hi, JSON.stringify(pr));
      assert.ok(pr.pRound1 >= 0 && pr.pRound1 <= 1 && pr.pUndrafted >= 0 && pr.pUndrafted <= 1);
      assert.ok(pr.stock.lastYear, 'built from last season');
      flow.declareForDraft(st, false); // stay every time
      continue;
    }
    botStep(st, STRATEGIES.balanced, 0.6);
  }
  assert.deepEqual(seen, [1, 2]);
  assert.ok(st.draft?.proj?.label, 'draft night remembers the projection');
});

test('a better last season projects higher', () => {
  const st = flow.newCareer(randomCareerOpts(5, 'QB'));
  for (let i = 0; i < 20000 && !(st.career.stage === 'college' && st.phase === 'declare'); i++) botStep(st, STRATEGIES.balanced, 0.6);
  const h = st.player.history[st.player.history.length - 1];
  h.perf = 40; const bad = flow.projectDraft(st, { early: true }).median;
  h.perf = 95; const good = flow.projectDraft(st, { early: true }).median;
  assert.ok(good < bad, `good season pick ${good} vs bad ${bad}`);
});
