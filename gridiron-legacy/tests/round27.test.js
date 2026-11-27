import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as flow from '../src/sim/flow.js';
import { botStep, randomCareerOpts, STRATEGIES } from '../src/sim/bot.js';
import { acceptShoe, designShoe, designScore, setWearShoe } from '../src/sim/shoes.js';
import { PLAYS, dealPlays } from '../src/data/playbook.js';
import { PRO_TEAMS } from '../src/data/teams.js';

test('signature shoe: offer when famous, design it, wear it, weekly royalties, new edition each season', () => {
  const st = flow.newCareer(randomCareerOpts(33, 'WR'));
  for (let i = 0; i < 200000 && !(st.career.stage === 'pro' && st.phase === 'plan'); i++) botStep(st, STRATEGIES.balanced, 0.6);
  st.player.fame = 80;
  st.player.look = st.player.look ?? {};
  for (let i = 0; i < 20000 && st.shoe?.status !== 'offer'; i++) botStep(st, STRATEGIES.balanced, 0.6);
  assert.equal(st.shoe.status, 'offer');
  const money = st.player.money;
  assert.ok(acceptShoe(st));
  assert.ok(st.player.money > money, 'signing bonus paid');
  const s = designShoe(st, { base: '#16181c', accent: '#f2c12e', pattern: 'bolt', sole: 'gum', cut: 'high' }, 'Thunder <b>One</b>');
  assert.ok(s.name.startsWith('Thunder'), 'name kept');
  assert.ok(!/[<>]/.test(s.name), 'no markup in the name');
  assert.equal(st.player.look.cleatDesign, 'bolt', 'wearing them in games');
  assert.equal(st.player.look.cleatCut, 'high');
  assert.ok(s.score >= 1 && s.score <= 10);
  assert.ok(designScore(st, { base: '#16181c', accent: '#f2c12e', pattern: 'bolt', sole: 'gum', cut: 'mid' }) > designScore(st, { base: '#16181c', accent: '#1d1f24', pattern: 'stripe', sole: 'black', cut: 'low' }), 'contrast scores higher');
  setWearShoe(st, false);
  const ed = st.shoe.edition, earned = st.shoe.earned;
  for (let i = 0; i < 40000 && st.phase !== 'review'; i++) botStep(st, STRATEGIES.balanced, 0.6);
  assert.ok(st.shoe.earned > earned, 'royalties came in');
  assert.ok(st.review.shoe && st.shoe.edition === ed + 1, 'sales report and a new edition');
});

test('playbook: every mode/call has lots of plays with unique names, and dealing still works', () => {
  for (const [mode, calls] of Object.entries(PLAYS)) for (const [call, list] of Object.entries(calls)) {
    assert.ok(list.length >= 12, `${mode}/${call} has ${list.length}`);
    assert.equal(new Set(list.map((x) => x.name)).size, list.length, `${mode}/${call} unique names`);
    const dealt = dealPlays(mode, call, { yardLine: 50, distance: 10, down: 1 }, 5);
    assert.ok(dealt.length >= 3);
  }
});

test('every pro team has its own jersey pattern', () => {
  const pats = PRO_TEAMS.map((t) => t.kit?.pattern);
  assert.equal(new Set(pats).size, pats.length);
});
