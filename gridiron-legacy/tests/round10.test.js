import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as flow from '../src/sim/flow.js';
import { momentCount } from '../src/sim/game.js';
import { initDepth, weeklyDepth, awardRace, recruitStars, visitSchool, runCombine, answerInterview, projection, nextGenerationOpts, seasonStakes } from '../src/sim/career.js';
import { botStep, STRATEGIES } from '../src/sim/bot.js';
import { EVENTS_BY_ID } from '../src/data/events/index.js';

const career = (pos = 'QB', seed = 11) => flow.newCareer({ first: 'A', last: 'B', position: pos, background: 'natural', number: 9, hometown: 'Westfield', hsTeamId: 'WFW', seed });

test('you can open as the backup, get fewer late snaps, and win the job', () => {
  const st = career();
  initDepth(st, { edge: 4 });
  assert.equal(st.player.depth.role, 'backup');
  assert.equal(momentCount(st, { playoff: false, rivalry: false }), 2);
  st.player.depth.trust = 100; st.player.rel.coach = 90; // dominate practice and games
  let won = false;
  for (let i = 0; i < 6 && !won; i++) { weeklyDepth(st); won = st.player.depth.role === 'starter'; }
  assert.ok(won, 'should earn the starting job');
  assert.ok(momentCount(st, { playoff: false, rivalry: false }) >= 5);
});

test('play style changes how many snaps you get', () => {
  const st = career();
  st.player.depth.role = 'starter';
  const key = momentCount(st, { playoff: false, rivalry: false });
  st.playStyle = 'more'; const more = momentCount(st, { playoff: false, rivalry: false });
  st.playStyle = 'every'; const every = momentCount(st, { playoff: false, rivalry: false });
  assert.ok(more > key && every > more);
});

test('season stakes and the award race include you', () => {
  const st = career('WR');
  const race = awardRace(st, { advance: true });
  assert.equal(race.length, 5);
  assert.ok(race.some((r) => r.you));
  const sk = seasonStakes(st);
  assert.ok(sk.rank >= 1 && typeof sk.status === 'string');
});

test('recruiting: stars, two visits that reveal your role, and a combine that moves stock', () => {
  const st = career('RB', 4);
  st.offers = flow.collegeOffers(st);
  const s = recruitStars(st);
  assert.ok(s >= 1 && s <= 5);
  const v = visitSchool(st, st.offers[0].teamId);
  assert.ok(v.start && typeof v.edge === 'number');
  const c = runCombine(st);
  assert.ok(Number(c.forty) > 4 && Number(c.forty) < 5.5);
  const before = c.bonus;
  const a = answerInterview(st, 0);
  assert.equal(c.bonus, before + a.d);
  assert.equal(answerInterview(st, 1), null, 'only one answer');
  assert.equal(projection(90), 'Top 10 pick');
});

test('full careers reach the combine and the draft, then retire with a next generation', () => {
  const st = career('QB', 21);
  let sawCombine = false;
  for (let i = 0; i < 4000 && st.phase !== 'retired'; i++) { if (st.phase === 'combine') sawCombine = true; botStep(st, STRATEGIES.balanced, 0.6); }
  assert.ok(sawCombine, 'combine happened');
  assert.equal(st.phase, 'retired');
  const o = nextGenerationOpts(st);
  assert.equal(o.last, 'B');
  assert.ok(o.legacyBonus >= 1);
  const kid = flow.newCareer({ ...o, hsTeamId: 'WFW', hometown: 'Westfield' });
  assert.ok(kid.player.parentName);
});

test('storylines chain into follow-ups', () => {
  for (const id of ['arc_feud_1', 'arc_love_1', 'arc_agent_1', 'arc_rival_1']) assert.ok(EVENTS_BY_ID[id], id);
  const chained = Object.values(EVENTS_BY_ID).filter((e) => e.id.startsWith('arc_')).flatMap((e) => e.choices.flatMap((c) => [c.effects?.chain?.id, c.chance?.success?.effects?.chain?.id, c.chance?.fail?.effects?.chain?.id])).filter(Boolean);
  for (const id of chained) assert.ok(EVENTS_BY_ID[id], `missing chapter ${id}`);
});

test('every position is balanced over full careers (awards and legacy within range of each other)', async () => {
  const { simulateCareer, randomCareerOpts, STRATEGIES } = await import('../src/sim/bot.js');
  const avg = {};
  for (const pos of ['QB', 'RB', 'WR', 'CB', 'DT']) {
    let aw = 0, lg = 0;
    for (let i = 0; i < 40; i++) { const st = simulateCareer(randomCareerOpts(5000 + i, pos), STRATEGIES.balanced, 0.6); aw += st.player.awards.length; lg += st.legacy?.score ?? 0; }
    avg[pos] = { aw: aw / 40, lg: lg / 40 };
  }
  const aws = Object.values(avg).map((v) => v.aw), lgs = Object.values(avg).map((v) => v.lg);
  assert.ok(Math.max(...aws) / Math.min(...aws) < 1.7, `awards spread ${JSON.stringify(avg)}`);
  assert.ok(Math.max(...lgs) / Math.min(...lgs) < 1.35, `legacy spread ${JSON.stringify(avg)}`);
});
