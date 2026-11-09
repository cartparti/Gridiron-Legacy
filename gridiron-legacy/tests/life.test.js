import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as flow from '../src/sim/flow.js';
import { randomCareerOpts } from '../src/sim/bot.js';
import { ITEMS, ITEM_BY_ID } from '../src/data/items.js';
import { INTERACTIONS } from '../src/data/interactions.js';
import { PLACES } from '../src/data/places.js';
import { ACTIVITY_BY_ID, planCost, maxEnergy } from '../src/sim/week.js';
import { buyItem, gearBonus, itemWeekly } from '../src/sim/shop.js';
import { people, interactionsFor, openInteraction, respond, giveGift } from '../src/sim/social.js';
import { tolerance } from '../src/sim/game.js';

const fresh = (seed = 5) => {
  const st = flow.newCareer(randomCareerOpts(seed));
  while (st.phase === 'event') flow.resolveEvent(st, 0);
  return st;
};

test('items have unique ids and valid categories', () => {
  const ids = new Set();
  for (const it of ITEMS) {
    assert.ok(!ids.has(it.id), it.id);
    ids.add(it.id);
    assert.ok(['gear', 'style', 'home', 'pets', 'toys', 'gifts'].includes(it.cat), it.id);
    assert.ok(it.price > 0);
  }
  assert.ok(ITEMS.length >= 35);
});

test('buying gear widens the timing window; only the best per slot counts', () => {
  const st = fresh();
  st.player.money = 100000;
  st.game = null;
  const before = tolerance(st, 'balanced', 'wr_route');
  assert.equal(buyItem(st, 'cleats1').ok, true);
  assert.equal(buyItem(st, 'cleats2').ok, true);
  assert.ok(Math.abs(gearBonus(st.player, 'wr_route') - 0.05) < 1e-9);
  assert.ok(tolerance(st, 'balanced', 'wr_route') > before);
  assert.equal(buyItem(st, 'cleats2').ok, false); // already owned
  assert.equal(buyItem(st, 'yacht').ok, false); // pro only
});

test('owned items add weekly mood and costs', () => {
  const st = fresh();
  st.player.money = 5000;
  buyItem(st, 'dog');
  const w = itemWeekly(st.player);
  assert.ok(w.mood > 0 && w.cost > 0);
  assert.equal(st.player.flags.has_dog, true);
});

test('interactions: chats are free once a week, plans use a day slot', () => {
  const st = fresh();
  const coach = people(st).find((p) => p.kind === 'coach');
  const chat = interactionsFor(st, coach).find((i) => i.id === 'coach_talk');
  assert.equal(chat.ok, true);
  openInteraction(st, 'coach', 'coach_talk');
  respond(st, 'coach', 'coach_talk', 0);
  assert.equal(interactionsFor(st, coach).find((i) => i.id === 'coach_talk').ok, false);
  const before = planCost(st.week.plan);
  respond(st, 'coach', 'coach_film', 0);
  assert.equal(planCost(st.week.plan), before + 1);
  assert.ok(st.week.plan.some((e) => e && e.done));
  // the plan still submits with done entries in it
  flow.submitPlan(st, st.week.plan);
  assert.equal(st.phase, 'game');
});

test('teammate bonds change and gifts work', () => {
  const st = fresh();
  st.player.money = 1000;
  const mate = people(st).find((p) => p.kind === 'teammate');
  const b0 = mate.value;
  respond(st, mate.key, 'mate_hangout', 0);
  assert.ok(people(st).find((p) => p.key === mate.key).value > b0);
  buyItem(st, 'g_jersey');
  const r = giveGift(st, 'family', 'g_jersey');
  assert.ok(r && r.result);
  assert.equal(st.player.inventory.g_jersey, 0);
});

test('every interaction and place references valid things', () => {
  for (const it of INTERACTIONS) {
    assert.ok(it.responses.length >= 1, it.id);
    assert.ok(it.lines.mid || it.lines.high, it.id);
  }
  for (const [id, place] of Object.entries(PLACES)) {
    for (const entry of Object.values(place.legend)) {
      for (const e of [entry, entry.alt].filter(Boolean)) {
        if (e.act?.kind === 'activity') assert.ok(ACTIVITY_BY_ID[e.act.id], `${id}: ${e.act.id}`);
        if (e.act?.kind === 'shop') assert.ok(ITEMS.some((i) => i.cat === e.act.cat), `${id}: ${e.act.cat}`);
      }
    }
    assert.ok(place.map.some((row) => row.includes(place.start)), `${id} has an entrance`);
  }
});

test('energy budget includes item bonuses', () => {
  const st = fresh();
  const e0 = maxEnergy(st);
  st.player.items.cryo = true;
  assert.equal(maxEnergy(st), e0 + 1);
  assert.ok(ITEM_BY_ID.cryo.energy === 1);
});
