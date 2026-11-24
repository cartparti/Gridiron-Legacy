import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as flow from '../src/sim/flow.js';
import { botStep, randomCareerOpts, STRATEGIES } from '../src/sim/bot.js';
import { pickFit, fitToday, canPredict, makePrediction, canCardShow, cardShow, streakRows } from '../src/sim/flair.js';

test('v0.63: fits, predictions, card shows, dishes and streaks through full careers', () => {
  const seen = { fit: 0, best: 0, pred: 0, settled: 0, hit: 0, show: 0, dish: 0 };
  for (const [seed, pos] of [[91, 'QB'], [92, 'RB'], [93, 'K'], [94, 'MS']]) {
    const st = flow.newCareer(randomCareerOpts(seed, pos));
    for (let i = 0; i < 200000 && st.phase !== 'retired'; i++) {
      if (st.phase === 'plan') {
        if (!fitToday(st)) { const r = pickFit(st, ['suit', 'street', 'throwback', 'hoodie'][i % 4]); if (r?.ok) { seen.fit++; if (r.best) seen.best++; } assert.equal(pickFit(st, 'suit'), null, 'one fit a week'); }
        if (canPredict(st)) { makePrediction(st, ['playoffs', 'stat', 'rival', 'twoLoss'][i % 4]); seen.pred++; }
        if (canCardShow(st) && cardShow(st)) seen.show++;
      }
      if (st.phase === 'review' && st.review.prediction && !st.review._c) { st.review._c = 1; seen.settled++; if (st.review.prediction.hit) seen.hit++; }
      botStep(st, STRATEGIES.balanced, 0.6);
    }
    assert.equal(st.phase, 'retired');
    if (st.player.dishes?.length) seen.dish++;
    assert.ok(streakRows(st).some((r) => r.best >= 3), `${pos} has a streak`);
  }
  for (const k of ['fit', 'best', 'pred', 'settled', 'hit', 'show', 'dish']) assert.ok(seen[k] > 0, `${k}: ${JSON.stringify(seen)}`);
});
