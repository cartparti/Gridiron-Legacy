import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newCareer } from '../src/sim/flow.js';
import { textFrom, reply, replyOptions, makePost, replyToComment, phoneState } from '../src/sim/phone.js';
import { drillMultiplier, applyPlan } from '../src/sim/week.js';
import { GAME_EVENTS } from '../src/data/gameEvents.js';

const career = () => newCareer({ first: 'A', last: 'B', position: 'WR', background: 'natural', number: 11, hometown: 'Westfield', hsTeamId: 'WFW', seed: 42 });

test('templated texts offer contextual replies with social impact and a response', () => {
  const st = career();
  textFrom(st, 'coach', 'We need more from you.', 'coach_bad');
  const opts = replyOptions(st, 'coach');
  assert.equal(opts.length, 3);
  const before = st.player.rel.coach;
  const r = reply(st, 'coach', 1); // blame the line
  assert.ok(st.player.rel.coach < before);
  assert.ok(r.back && phoneState(st).threads.coach.at(-1).text === r.back);
  assert.equal(replyOptions(st, 'coach').length, 0, 'already answered');
});

test('troll comments can be answered once', () => {
  const st = career();
  st.week.posted = false;
  for (let i = 0; i < 6; i++) { st.week.posted = false; makePost(st, 'workout'); }
  const post = phoneState(st).posts.find((p) => p.comments.some((c) => c.troll));
  assert.ok(post, 'some post got a troll');
  const ci = post.comments.findIndex((c) => c.troll);
  assert.ok(replyToComment(st, post.id, ci, 1));
  assert.equal(replyToComment(st, post.id, ci, 1), null);
});

test('drills scale training gains', () => {
  assert.equal(drillMultiplier(undefined), 1);
  assert.ok(drillMultiplier(1) > 1.4 && drillMultiplier(0) < 0.7);
  const a = career();
  const b = career();
  a.week.plan = ['sprints', null, null, null, null];
  b.week.plan = ['sprints', null, null, null, null];
  b.week.drills = { 0: 1 };
  const sa = a.player.stats.speed;
  applyPlan(a, a.week.plan);
  applyPlan(b, b.week.plan);
  assert.ok(b.player.stats.speed - sa > a.player.stats.speed - sa);
});

test('presnap events exist for every position', () => {
  for (const pos of ['QB', 'RB', 'WR', 'CB']) assert.ok(GAME_EVENTS.some((e) => e.trigger === 'presnap' && (!e.cond?.positions || e.cond.positions.includes(pos))), pos);
});

test('tags land in Huddle Mentions with varied, answerable replies', async () => {
  const { sendTag } = await import('../src/sim/phone.js');
  const st = career();
  sendTag(st, 'great');
  const opts = replyOptions(st, 'tags');
  assert.ok(opts.length >= 2);
  const r = reply(st, 'tags', 0);
  assert.ok(r && r.changes.length >= 1);
  // weekly template texts carry pre-picked wordings
  textFrom(st, 'family', 'hi');
  const labels = new Set();
  for (let i = 0; i < 12; i++) { const s2 = career(); s2.rngState = 1000 + i * 77; const ph = await import('../src/sim/phone.js'); ph.postGameTexts(s2, { grade: 80, won: true }); const o = ph.replyOptions(s2, 'coach'); if (o[0]) labels.add(o[0]); }
  assert.ok(labels.size >= 2, 'reply wording varies');
});
