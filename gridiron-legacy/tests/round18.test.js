import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as flow from '../src/sim/flow.js';
import { botStep, randomCareerOpts, STRATEGIES } from '../src/sim/bot.js';
import { PLAYS } from '../src/data/playbook.js';
import { playArtSVG } from '../src/scenes/play/playart.js';
import * as nil from '../src/sim/nil.js';

const toCollege = (seed, pos, season = 1, week = 3) => {
  const st = flow.newCareer(randomCareerOpts(seed, pos));
  for (let i = 0; i < 40000 && !(st.career.stage === 'college' && st.career.stageSeason === season && st.league.week === week && st.phase === 'plan'); i++) botStep(st, STRATEGIES.balanced, 0.6);
  assert.equal(st.career.stage, 'college');
  return st;
};

test('play art: every play in every mode draws a diagram with no bad numbers', () => {
  for (const [mode, calls] of Object.entries(PLAYS)) for (const [call, list] of Object.entries(calls)) for (const pl of list) {
    const svg = playArtSVG(mode, pl, { call, userRole: mode === 'run' ? 'RB' : undefined });
    assert.ok(svg.startsWith('<svg'), `${mode}/${pl.name}`);
    assert.ok(!svg.includes('NaN') && !svg.includes('undefined'), `${mode}/${pl.name}`);
  }
});

test('NIL: offers arrive in college, can be signed, haggled and declined, and pay every week', () => {
  const st = toCollege(31, 'QB', 1, 3);
  assert.ok(nil.dealsOpen(st));
  assert.ok(nil.nilValue(st) > 0);
  assert.ok(st.nil.offers.length > 0, 'offers waiting');
  const o = nil.makeOffer(st, 'local');
  st.nil.offers.push(o);
  const r = nil.acceptOffer(st, o.id);
  assert.ok(r.ok, r.text);
  const deal = st.player.sponsors.find((d) => d.id === o.id);
  assert.ok(deal && deal.nil && deal.weekly > 0);
  // no two offers or deals from the same brand
  for (let i = 0; i < 4; i++) st.nil.offers.push(nil.makeOffer(st, 'local'));
  const brands = [...st.nil.offers, ...st.player.sponsors].map((x) => x.brand);
  assert.equal(new Set(brands).size, brands.length);
  // haggle once
  const h = nil.makeOffer(st, 'brand');
  st.nil.offers.push(h);
  nil.negotiateOffer(st, h.id);
  assert.equal(nil.negotiateOffer(st, h.id).ok, false);
  nil.declineOffer(st, h.id);
  assert.ok(!st.nil.offers.some((x) => x.id === h.id));
  // performance bonus pays per stat
  const perf = nil.makeOffer(st, 'performance');
  st.nil.offers.push(perf);
  st.player.sponsors = st.player.sponsors.slice(0, 2);
  assert.ok(nil.acceptOffer(st, perf.id).ok);
  const before = st.player.money;
  const paid = nil.nilAfterGame(st, { [perf.bonus.key]: 2 });
  assert.equal(paid.length, 1);
  assert.equal(st.player.money - before, paid[0].amount);
  // money keeps coming through a season
  const earned0 = nil.nilEarnings(st).year;
  for (let i = 0; i < 400 && st.league.week < 7; i++) botStep(st, STRATEGIES.balanced, 0.6);
  assert.ok(nil.nilEarnings(st).year > earned0);
});

test('NIL: collective money ends when you leave school; not offered in high school', () => {
  const hs = flow.newCareer(randomCareerOpts(32, 'RB'));
  assert.equal(nil.dealsOpen(hs), false);
  const st = toCollege(33, 'RB', 1, 2);
  const c = nil.makeOffer(st, 'collective');
  st.nil.offers.push(c);
  st.player.sponsors = [];
  assert.ok(nil.acceptOffer(st, c.id).ok);
  assert.ok(st.player.sponsors.some((d) => d.collective));
  nil.nilLeaveCollege(st);
  assert.ok(!st.player.sponsors.some((d) => d.collective));
});

test('draft stock: live projection during college with a weekly trend and a position rank', () => {
  const st = toCollege(34, 'WR', 2, 4);
  const pr = flow.liveDraftProjection(st);
  assert.ok(pr && pr.median >= 1 && pr.posRank >= 1);
  assert.equal(pr.stock.live, true);
  assert.ok((st.draftWatch ?? []).length >= 4);
  // outside college there's no live board
  const hs = flow.newCareer(randomCareerOpts(35, 'WR'));
  assert.equal(flow.liveDraftProjection(hs), null);
});
