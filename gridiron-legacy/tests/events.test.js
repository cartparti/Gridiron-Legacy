import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_EVENTS, EVENTS_BY_ID } from '../src/data/events/index.js';
import { ACTIVITIES } from '../src/data/activities.js';
import { presentEvent, chooseOption, isEligible } from '../src/sim/events.js';
import { applyEffects } from '../src/sim/effects.js';
import * as flow from '../src/sim/flow.js';
import { randomCareerOpts } from '../src/sim/bot.js';

const KNOWN_EFFECTS = new Set([
  'mood', 'health', 'fame', 'academics', 'money', 'moneyPct', 'energy', 'stats', 'train', 'rel', 'flags', 'clearFlags',
  'injury', 'suspend', 'scandal', 'newPartner', 'breakup', 'hireAgent', 'fireAgent', 'sponsor', 'sponsorChance',
  'business', 'businessWork', 'rehab', 'setHousing', 'salaryBump', 'newCoach', 'transfer', 'trade', 'risk', 'chain',
]);
const KNOWN_COND = new Set([
  'minAge', 'maxAge', 'minFame', 'maxFame', 'minMoney', 'maxMoney', 'minMood', 'maxMood', 'minHealth', 'maxHealth',
  'minOvr', 'minAcademics', 'maxAcademics', 'minWeek', 'maxWeek', 'positions', 'partner', 'agent', 'injured', 'flags', 'rel',
]);
const STATS = new Set(['speed', 'skill', 'iq', 'strength']);
const RELS = new Set(['coach', 'teammates', 'family', 'partner', 'agent', 'rival']);

function checkEffects(where, eff) {
  assert.ok(eff && typeof eff === 'object', `${where}: missing effects`);
  for (const [k, v] of Object.entries(eff)) {
    assert.ok(KNOWN_EFFECTS.has(k), `${where}: unknown effect "${k}"`);
    if (k === 'stats' || k === 'train') for (const s of Object.keys(v)) assert.ok(STATS.has(s), `${where}: bad stat ${s}`);
    if (k === 'rel') for (const r of Object.keys(v)) assert.ok(RELS.has(r), `${where}: bad relationship ${r}`);
    if (k === 'chain') assert.ok(EVENTS_BY_ID[typeof v === 'string' ? v : v.id], `${where}: chain to unknown event`);
  }
}

test('there are well over 100 events with unique ids', () => {
  assert.ok(ALL_EVENTS.length >= 100, `only ${ALL_EVENTS.length} events`);
  const ids = new Set();
  for (const e of ALL_EVENTS) {
    assert.ok(!ids.has(e.id), `duplicate id ${e.id}`);
    ids.add(e.id);
  }
});

test('every event is well formed', () => {
  for (const e of ALL_EVENTS) {
    assert.ok(e.title && e.text, `${e.id}: needs title and text`);
    assert.ok(e.choices?.length >= 1 && e.choices.length <= 3, `${e.id}: 1-3 choices`);
    for (const k of Object.keys(e.cond ?? {})) assert.ok(KNOWN_COND.has(k), `${e.id}: unknown condition ${k}`);
    e.choices.forEach((c, i) => {
      const where = `${e.id}[${i}]`;
      assert.ok(c.label, `${where}: label`);
      if (c.chance) {
        assert.ok(c.chance.p > 0 && c.chance.p < 1, `${where}: p`);
        checkEffects(`${where}.success`, c.chance.success.effects);
        checkEffects(`${where}.fail`, c.chance.fail.effects);
        assert.ok(c.chance.success.result && c.chance.fail.result, `${where}: results`);
      } else {
        checkEffects(where, c.effects);
        assert.ok(typeof c.result === 'string', `${where}: result text`);
      }
    });
  }
});

test('activities use only known effects', () => {
  for (const a of ACTIVITIES) {
    checkEffects(`activity ${a.id}`, a.effects);
    assert.ok(a.cost >= 0 && a.cost <= 3);
  }
});

test('presented events have no unfilled tokens, and every choice applies cleanly', () => {
  const state = flow.newCareer(randomCareerOpts(12));
  state.player.partnerName = 'Maya';
  state.player.rel.partner = 60;
  state.player.agentName = 'Dana Whitlock';
  state.player.rel.agent = 50;
  state.player.business = { name: 'clothing line', level: 1 };
  for (const e of ALL_EVENTS) {
    const pending = presentEvent(state, e);
    assert.ok(!/\{\w+\}/.test(pending.text), `${e.id}: unfilled token in "${pending.text}"`);
    for (const c of pending.choices) assert.ok(!/\{\w+\}/.test(c.label), `${e.id}: token in label`);
    for (let i = 0; i < e.choices.length; i++) {
      const copy = JSON.parse(JSON.stringify(state));
      const res = chooseOption(copy, pending, i);
      assert.ok(typeof res.result === 'string');
      assert.ok(Number.isFinite(copy.player.money));
      assert.ok(copy.player.mood >= 0 && copy.player.mood <= 100);
    }
  }
});

test('each career stage has a healthy pool of events', () => {
  for (const stage of ['hs', 'college', 'pro']) {
    const n = ALL_EVENTS.filter((e) => !e.stages || e.stages.includes(stage)).length;
    assert.ok(n >= 40, `${stage} has only ${n} events`);
  }
});

test('conditions gate events', () => {
  const state = flow.newCareer(randomCareerOpts(3));
  const ev = EVENTS_BY_ID.pro_proposal;
  assert.equal(isEligible(state, ev, 'season'), false); // high school, no partner
});

test('relationship effects ignore people you do not have yet', () => {
  const state = flow.newCareer(randomCareerOpts(4));
  applyEffects(state, { rel: { partner: 10, agent: 10 } });
  assert.equal(state.player.rel.partner, null);
  assert.equal(state.player.rel.agent, null);
});
