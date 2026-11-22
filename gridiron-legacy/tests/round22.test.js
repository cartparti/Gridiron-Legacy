import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as flow from '../src/sim/flow.js';
import { botStep, randomCareerOpts, STRATEGIES } from '../src/sim/bot.js';
import { chooseHomecoming, chooseEscort, reactToRating, designRing, HOMECOMING_PLANS, ESCORTS } from '../src/sim/seasonal.js';
import { cardValue } from '../src/sim/collectibles.js';
import { answerMail } from '../src/sim/mailbag.js';
import { adoptPet, playWithPet, canPlayWithPet } from '../src/sim/pets.js';
import { chooseRitual, incentiveProgress, RITUALS, COACH_STYLES } from '../src/sim/staff.js';
import { tolerance } from '../src/sim/game.js';

/** Run a whole career with the bot, poking every new feature the way a player would. */
function fullCareer(seed, pos) {
  const st = flow.newCareer(randomCareerOpts(seed, pos));
  const seen = { homecoming: 0, senior: 0, reveal: 0, mail: 0, cards: 0, balls: 0, rings: 0, incentives: 0, coach: 0, lucky: 0, pet: 0 };
  chooseRitual(st, RITUALS[seed % RITUALS.length].id);
  for (let i = 0; i < 200000 && st.phase !== 'retired'; i++) {
    if (st.phase === 'plan') {
      if (st.homecoming?.year === st.career.year && st.homecoming.week === st.league.week && !st.homecoming.plan) { assert.ok(chooseHomecoming(st, 'friends')); seen.homecoming++; }
      if (st.seniorNight && st.seniorNight.week === st.league.week && !st.seniorNight.escort && st.league.phase === 'regular' && chooseEscort(st, 'family')) seen.senior++;
      if (st.ratingReveal && !st.ratingReveal.reaction) { reactToRating(st, 'fuel'); seen.reveal++; }
      if (st.week.mail && st.week.mail.answered == null) { const r = answerMail(st, 0); assert.ok(r); seen.mail++; }
      if (!st.player.pet && st.player.money > 1000) { adoptPet(st, 'mutt', 'Blitz'); seen.pet++; }
      if (canPlayWithPet(st)) playWithPet(st);
      if (st.pendingRings?.length) { designRing(st, { stone: 'ruby', band: 'white', engraving: 'Believe' }); seen.rings++; }
      if ((st.ritual?.streak ?? 0) >= 3) seen.lucky++;
    }
    if (st.phase === 'review') {
      if (st.review.card) seen.cards++;
      if (st.review.incentive) seen.incentives++;
      if (st.review.coachChange) seen.coach++;
    }
    botStep(st, STRATEGIES.balanced, 0.6);
  }
  seen.balls = st.player.gameBalls?.length ?? 0;
  return { st, seen };
}

test('a full career touches every new tradition and collectible without breaking', () => {
  const total = {};
  for (const [seed, pos] of [[11, 'QB'], [12, 'RB'], [13, 'CB'], [14, 'K'], [15, 'MS'], [16, 'WR'], [17, 'DT']]) {
    const { st, seen } = fullCareer(seed, pos);
    assert.equal(st.phase, 'retired', `${pos} career finished`);
    assert.equal(st.player.cards.length, st.player.history.length, 'one card per season');
    for (const c of st.player.cards) assert.ok(cardValue(st, c) > 0);
    for (const [k, v] of Object.entries(seen)) total[k] = (total[k] ?? 0) + v;
  }
  for (const k of ['homecoming', 'senior', 'reveal', 'mail', 'cards', 'balls', 'incentives', 'pet', 'lucky']) assert.ok(total[k] > 0, `${k} happened at least once (${JSON.stringify(total)})`);
});

test('homecoming plans and senior night escorts apply once', () => {
  const st = flow.newCareer(randomCareerOpts(3, 'QB'));
  while (st.phase === 'event') flow.resolveEvent(st, 0);
  st.homecoming = { year: st.career.year, week: st.league.week, king: true, plan: null };
  const fame = st.player.fame;
  assert.equal(chooseHomecoming(st, 'partner'), null, 'no partner, no date');
  const r = chooseHomecoming(st, HOMECOMING_PLANS[1].id);
  assert.ok(r.king && st.player.fame > fame);
  assert.equal(chooseHomecoming(st, 'rest'), null, 'only once');
  st.seniorNight = { key: `${st.career.stage}-${st.career.year}`, kind: 'senior', week: st.league.week, escort: null };
  const tolBefore = tolerance(st);
  assert.ok(chooseEscort(st, ESCORTS[0].id));
  assert.equal(chooseEscort(st, 'coach'), null);
  flow.submitPlan(st, [null, null, null, null, null]);
  assert.equal(st.game.seniorNight, 'senior');
  assert.ok(st.game.homecoming);
  assert.ok(tolerance(st) > 0 && tolBefore > 0);
});

test('pro contracts carry an incentive that tracks season stats', () => {
  const st = flow.newCareer(randomCareerOpts(21, 'RB'));
  for (let i = 0; i < 160000 && !(st.career.stage === 'pro' && st.phase === 'plan'); i++) botStep(st, STRATEGIES.balanced, 0.6);
  const pr = incentiveProgress(st);
  assert.ok(pr && pr.target > 0 && pr.bonus >= 100000, 'rookie deal has an incentive');
  assert.ok(COACH_STYLES.some((s) => s.id === st.player.coachStyle), 'the new coach has a style');
});
