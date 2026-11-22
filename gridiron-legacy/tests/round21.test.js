import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as flow from '../src/sim/flow.js';
import { botStep, randomCareerOpts, STRATEGIES, simulateCareer } from '../src/sim/bot.js';
import { stepGame, autoMoment, resolveMoment, resolveDecision, resolveGameEvent, resolveTwoPoint } from '../src/sim/game.js';
import { chooseRehab, canRehab, rehabHealed } from '../src/sim/rehab.js';
import { canAnnounceFarewell, announceFarewell, farewellAfterGame } from '../src/sim/farewell.js';
import { speechThanks, giveSpeech } from '../src/sim/speech.js';
import { visitTeam, visitsLeft, applyPerk } from '../src/sim/freeagency.js';
import { commercialDeals, shootCommercial } from '../src/sim/commercial.js';
import { playerOfWeek } from '../src/sim/leaguelife.js';

const toGame = (seed, pos = 'QB') => {
  const st = flow.newCareer(randomCareerOpts(seed, pos));
  while (st.phase === 'event') flow.resolveEvent(st, 0);
  flow.submitPlan(st, [null, null, null, null, null]);
  return st;
};
const play = (st, onType = {}) => {
  for (let i = 0; i < 500; i++) {
    const r = stepGame(st);
    if (r.type === 'end') return;
    if (onType[r.type]) { onType[r.type](r); continue; }
    if (r.type === 'decision') { resolveDecision(st, true); continue; }
    if (r.type === 'gameEvent') { resolveGameEvent(st, 0); continue; }
    if (r.type === 'halftime') continue;
    resolveMoment(st, autoMoment(st, 'balanced'));
  }
};
const toPro = (seed, pos, season, week) => {
  const st = flow.newCareer(randomCareerOpts(seed, pos));
  for (let i = 0; i < 160000 && !(st.career.stage === 'pro' && st.career.stageSeason === season && st.phase === 'plan' && st.league.week === week); i++) botStep(st, STRATEGIES.balanced, 0.6);
  return st;
};

test('games never end tied when you play; overtime is sudden death', () => {
  let ots = 0;
  for (let s = 1; s < 80; s++) {
    const st = toGame(s, ['QB', 'RB', 'WR', 'CB'][s % 4]);
    play(st);
    const g = st.game;
    assert.notEqual(g.score.home, g.score.away, `seed ${s} tied`);
    if (g.ot) {
      ots++;
      const otScores = g.log.filter((e) => e.q === 'OT' && ['TD', 'FG'].includes(e.out));
      assert.ok(otScores.length <= 1, 'sudden death: one score ends it');
    }
  }
  assert.ok(ots >= 1, 'some games went to overtime');
});

test('two-point decisions: the match screen stops for them; kicking keeps the score, going for two moves it by one', () => {
  let asked = 0;
  for (let s = 1; s < 120 && asked < 3; s++) {
    const st = toGame(s, ['QB', 'RB', 'WR'][s % 3]);
    st.game.halftimeUI = true;
    play(st, { twoPoint: () => { asked++; const before = { ...st.game.score }; const side = st.game.userSide; resolveTwoPoint(st, true, asked % 2 === 0); assert.equal(Math.abs(st.game.score[side] - before[side]), 1); } });
  }
  assert.ok(asked >= 1, 'a two-point decision came up');
});

test('rehab plans change the timeline and their after-effects', () => {
  const st = toGame(3);
  st.player.injury = { id: 'x', label: 'Sprained Knee', weeks: 6, tier: 'out' };
  assert.ok(canRehab(st));
  chooseRehab(st, 'rush');
  assert.equal(st.player.injury.weeks, 3);
  assert.equal(canRehab(st), false, 'one plan per injury');
  rehabHealed(st, st.player.injury);
  assert.equal(st.player.rushedBack, 2);
  st.player.injury = { id: 'y', label: 'Pulled Hamstring', weeks: 4, tier: 'out' };
  const iq = st.player.stats.iq;
  chooseRehab(st, 'careful');
  assert.equal(st.player.injury.weeks, 5);
  rehabHealed(st, st.player.injury);
  assert.ok(st.player.stats.iq > iq);
});

test('award night: finalists include you and the envelope names the real winner', () => {
  let nights = 0;
  const st = flow.newCareer(randomCareerOpts(901, 'QB'));
  for (let i = 0; i < 160000 && st.phase !== 'retired'; i++) {
    botStep(st, STRATEGIES.balanced, 0.6);
    const an = st.review?.awardNight;
    if (st.phase === 'review' && an && !an.checked) {
      an.checked = true;
      nights++;
      assert.equal(an.finalists.length, 3);
      assert.ok(an.finalists.some((f) => f.you));
      if (an.youWon) assert.ok(st.review.awards.some((a) => /Player of the Year|Ironstone|Most Valuable/.test(a)));
      else assert.ok(an.finalists.some((f) => f.name === an.winner));
    }
  }
  assert.ok(nights >= 1, 'at least one award night in a full career');
});

test('farewell tour: gifts on the road, then you retire after the season', () => {
  const st = toPro(64, 'RB', 6, 1);
  st.player.age = Math.max(st.player.age, 30);
  assert.ok(canAnnounceFarewell(st));
  announceFarewell(st);
  const gift = farewellAfterGame(st, { userSide: 'away', oppId: st.league.teams.find((t) => t.id !== st.career.teamId).id, sitOut: false }, { biome: 'coast' });
  assert.ok(gift?.gift);
  for (let i = 0; i < 20000 && st.phase !== 'retired'; i++) botStep(st, STRATEGIES.balanced, 0.6);
  assert.equal(st.phase, 'retired');
  assert.equal(st.legacy.reason, 'farewell');
});

test('hall of fame speech is written from your career', () => {
  const st = simulateCareer(randomCareerOpts(31, 'RB'), STRATEGIES.balanced, 0.6);
  const thanks = speechThanks(st);
  assert.ok(thanks.length >= 3);
  const sp = giveSpeech(st, { open: 'roots', thanks: [thanks[0].id, thanks[1].id], close: 'mic' });
  assert.ok(sp.text.includes(st.player.hometown));
  assert.equal(giveSpeech(st, { open: 'joke', thanks: [], close: 'kids' }), sp, 'given once');
});

test('free agency: pitches on every offer, two visits, perks only if you visited', () => {
  const st = toPro(66, 'WR', 2, 1);
  st.player.contract.years = 0;
  st.offers = flow.contractOffers(st);
  assert.ok(st.offers.length >= 1);
  for (const o of st.offers) assert.ok(o.pitch && o.role && o.scheme && o.perk);
  const before = st.player.money;
  const fake = { ...st.offers[0], perk: 'bonus', visited: false };
  applyPerk(st, fake);
  assert.equal(st.player.money, before, 'no visit, no perk');
  visitTeam(st, 0);
  assert.equal(visitsLeft(st), 1);
  if (st.offers[1]) visitTeam(st, 1);
  if (st.offers[2]) assert.equal(visitTeam(st, 2), null, 'only two visits');
});

test('commercial shoots: once a season per brand, uses a day, pays more for a great take', () => {
  const st = toPro(67, 'QB', 2, 2);
  st.player.sponsors.push({ brand: 'Voltade', product: 'sports drink', kind: 'brand', cat: 'drink', weekly: 10000, weeks: 10 });
  assert.ok(commercialDeals(st).some((d) => d.brand === 'Voltade'));
  st.week.plan = [null, null, null, null, null];
  const r = shootCommercial(st, 'Voltade', 0.9);
  assert.ok(r.ok && r.viral && r.pay >= 50000);
  assert.equal(shootCommercial(st, 'Voltade', 1), null, 'once a season');
});

test('player of the week for monster games', () => {
  const st = toGame(5);
  assert.ok(playerOfWeek(st, { grade: 97, won: true, sitOut: false }));
  assert.equal(playerOfWeek(st, { grade: 60, won: true, sitOut: false }), null);
  assert.equal(st.player.playerOfWeek, 1);
});
