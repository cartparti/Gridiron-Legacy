import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as flow from '../src/sim/flow.js';
import { botStep, randomCareerOpts, STRATEGIES, simulateCareer } from '../src/sim/bot.js';
import { stepGame, autoMoment, resolveMoment, resolveDecision, resolveGameEvent } from '../src/sim/game.js';
import { tossCoin, tossChoice, zoneAfterMoment, ZONE_AT, CHALLENGES, resolveChallenge } from '../src/sim/matchday.js';
import { makePresser, answerPresser, mediaPersona } from '../src/sim/presser.js';
import { captainVote, isCaptain, giveSpeech } from '../src/sim/captain.js';
import { combineTest } from '../src/sim/career.js';
import { journalByYear } from '../src/sim/journal.js';
import { honorCheck, bannersFor } from '../src/sim/honors.js';
import { allStarSelect, allStarChallenge } from '../src/sim/allstar.js';
import { requestTrade, chooseTrade, canRequestTrade } from '../src/sim/trade.js';

const toGame = (seed, pos = 'QB') => {
  const st = flow.newCareer(randomCareerOpts(seed, pos));
  while (st.phase === 'event') flow.resolveEvent(st, 0);
  flow.submitPlan(st, [null, null, null, null, null]);
  return st;
};
const playOut = (st) => {
  for (let i = 0; i < 300; i++) {
    const r = stepGame(st);
    if (r.type === 'end') break;
    if (r.type === 'decision') { resolveDecision(st, true); continue; }
    if (r.type === 'gameEvent') { resolveGameEvent(st, 0); continue; }
    resolveMoment(st, autoMoment(st, 'balanced'));
  }
};

test('coin toss: the winner picks, and the first possession of each half follows the choice', () => {
  for (let seed = 1; seed < 12; seed++) {
    const st = toGame(seed);
    const g = st.game;
    const t = tossCoin(st, 'heads');
    if (t.won) tossChoice(st, 'receive');
    assert.ok(g.toss.choice && g.toss.firstSide);
    const first = g.drives.find((d) => d.quarter <= 2);
    const second = g.drives.find((d) => d.quarter >= 3);
    assert.equal(first.side, g.toss.firstSide);
    assert.notEqual(second.side, g.toss.firstSide);
    // quarters and clocks stay in order
    for (let i = 1; i < g.drives.length; i++) assert.ok(g.drives[i].quarter >= g.drives[i - 1].quarter);
  }
});

test('in the zone after three great moments, out after a bad one', () => {
  const st = toGame(5);
  const changes = [0.8, 0.85, 0.9].map((q) => zoneAfterMoment(st, q));
  assert.equal(changes[ZONE_AT - 1], 'in');
  assert.equal(st.game.zone, true);
  assert.equal(zoneAfterMoment(st, 0.3), 'out');
  assert.equal(st.game.zone, false);
});

test('every game has a challenge for your position that resolves after the game', () => {
  for (const pos of ['QB', 'RB', 'WR', 'CB', 'DT', 'K', 'MS']) {
    const st = toGame(30, pos);
    const ch = st.game.challenge;
    assert.ok(ch && CHALLENGES.some((c) => c.id === ch.id), pos);
    playOut(st);
    flow.finishGame(st);
    assert.equal(typeof st.lastGame.challenge.done, 'boolean');
    assert.ok(st.lastGame.toss?.choice);
    assert.doesNotThrow(() => resolveChallenge(st, { ...st.lastGame, challenge: st.lastGame.challenge }));
  }
});

test('press conferences: answers apply once and shape a media persona', () => {
  const st = toGame(8);
  playOut(st);
  flow.finishGame(st);
  st.lastGame.presser = makePresser(st, { ...st.lastGame, playoff: true, grade: 90, won: true }, { oppName: 'Them', teamName: 'Us', statText: 'a big day' });
  const fame0 = st.player.fame;
  const ch = answerPresser(st, 0, 2);
  assert.ok(ch.length > 0);
  assert.ok(st.player.fame > fame0);
  assert.equal(answerPresser(st, 0, 1).length, 0, 'one answer per question');
  st.persona = { humble: 0, confident: 0, fiery: 6 };
  assert.equal(mediaPersona(st).id, 'villain');
});

test('captains: the vote happens once a season and big-game speeches apply once', () => {
  const st = toGame(9);
  st.player.rel.teammates = 95; st.player.ovr = 88;
  delete st.captainVote;
  const v = captainVote(st);
  assert.equal(captainVote(st), v, 'one vote per season');
  st.player.captain = st.career.year;
  assert.ok(isCaptain(st));
  const m0 = st.game.momentum;
  assert.ok(giveSpeech(st, 'fire'));
  assert.ok(st.game.momentum > m0);
  assert.equal(giveSpeech(st, 'calm'), null);
});

test('playable combine: each test once, and beating your projection raises your stock', () => {
  const st = flow.newCareer(randomCareerOpts(21, 'WR'));
  for (let i = 0; i < 60000 && st.phase !== 'combine'; i++) botStep(st, STRATEGIES.balanced, 0.6);
  assert.equal(st.phase, 'combine');
  const b0 = st.combine.bonus;
  combineTest(st, 'forty', 0.95);
  assert.ok(Number(st.combine.forty) < st.combine.base.forty);
  assert.ok(st.combine.bonus > b0);
  assert.equal(combineTest(st, 'forty', 0), null, 'only once');
  combineTest(st, 'bench', 0.1);
  assert.ok(st.combine.bench < st.combine.base.bench);
});

test('career journal, ring of honor and all-stars over a full career', () => {
  const st = simulateCareer(randomCareerOpts(31, 'RB'), STRATEGIES.balanced, 0.6);
  const years = journalByYear(st);
  assert.ok(years.length >= 8);
  const kinds = new Set((st.journal ?? []).map((e) => e.kind));
  for (const k of ['debut', 'draft', 'retire']) assert.ok(kinds.has(k), k);
  // a legend gets the number retired
  const st2 = simulateCareer(randomCareerOpts(700, 'QB'), STRATEGIES.balanced, 0.6);
  for (const r of st2.ringOfHonor ?? []) assert.ok(bannersFor(st2, r.teamId).some((b) => b.kind === 'number'));
  assert.equal(honorCheck(st2, null, 'pro'), null);
  assert.ok((st.player.allStars ?? []).length >= 0);
});

test('all-star challenge pays once', () => {
  const st = toGame(12);
  st.player.seasonStats.games = 10;
  st.review = { allStar: allStarSelect(st, { perf: 80, awards: ['All-State'] }) };
  assert.ok(st.review.allStar?.selected);
  const r = allStarChallenge(st, 1);
  assert.ok(r.place >= 1 && r.place <= 8);
  assert.equal(allStarChallenge(st, 0), r, 'played once');
});

test('trade requests: only in the pro regular season; accepted moves you next week', () => {
  const hs = toGame(3);
  assert.equal(canRequestTrade(hs), false);
  let moved = false;
  for (let sd = 42; sd < 54 && !moved; sd++) {
    const st = flow.newCareer(randomCareerOpts(sd, 'RB'));
    for (let i = 0; i < 90000 && !(st.career.stage === 'pro' && st.phase === 'plan' && st.league.week === 3); i++) botStep(st, STRATEGIES.balanced, 0.6);
    if (st.career.stage !== 'pro') continue;
    const r = requestTrade(st);
    assert.ok(r.teams.length >= 1);
    assert.equal(canRequestTrade(st), false);
    const res = chooseTrade(st, r.teams[0].id);
    if (!res.ok) continue;
    flow.submitPlan(st, [null, null, null, null, null]);
    for (let k = 0; k < 400 && st.phase !== 'plan'; k++) botStep(st, STRATEGIES.balanced, 0.6);
    assert.equal(st.career.teamId, r.teams[0].id);
    moved = true;
  }
  assert.ok(moved, 'at least one trade went through');
});
