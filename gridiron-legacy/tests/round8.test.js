import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hometownSchools } from '../src/data/hometown.js';
import { PLAYS, dealPlays, playCount } from '../src/data/playbook.js';
import { randomLook, feminize, masculinize, FEMALE_HAIR, MALE_HAIR, seededRandom } from '../src/data/looks.js';
import { INJURIES } from '../src/data/lifestyle.js';
import { newInjury } from '../src/sim/effects.js';
import * as flow from '../src/sim/flow.js';
import { stepGame, HALFTIME_CHOICES, halftimeChoice, resolveMoment, autoMoment, resolveDecision, resolveGameEvent } from '../src/sim/game.js';

test('typing Sandy as your hometown gives you Stone Lopez Academy', () => {
  for (const t of ['Sandy', 'sandy', '  SANDY ']) assert.equal(hometownSchools(t)[0].city, 'Stone Lopez Academy');
  assert.notEqual(hometownSchools('Sandyville')[0].city, 'Stone Lopez Academy');
});

test('every play type has a deep playbook and the deal rotates through it', () => {
  for (const mode of Object.keys(PLAYS)) {
    assert.ok(playCount(mode) >= 12, `${mode} has only ${playCount(mode)} plays`);
    const seen = new Set();
    for (let i = 0; i < 8; i++) for (const p of dealPlays(mode, 'balanced')) seen.add(p.name);
    assert.ok(seen.size >= 9, `${mode} only showed ${seen.size} different plays in 8 snaps`);
  }
});

test('girls get girl looks and guys get guy looks', () => {
  const r = seededRandom('looks8');
  for (let i = 0; i < 60; i++) {
    const f = randomLook(r, { gender: 'f' });
    assert.equal(f.gender, 'f');
    assert.equal(f.beard, 'none');
    assert.ok(FEMALE_HAIR.includes(f.hairStyle));
    assert.notEqual(f.earrings, 'none');
    const m = randomLook(r, { gender: 'm' });
    assert.ok(MALE_HAIR.includes(m.hairStyle));
    assert.equal(m.dress, null);
  }
  const g = feminize(randomLook(r, { gender: 'm' }));
  assert.equal(g.gender, 'f'); assert.equal(g.beard, 'none'); assert.ok(FEMALE_HAIR.includes(g.hairStyle));
  const b = masculinize(randomLook(r, { gender: 'f' }));
  assert.equal(b.gender, 'm'); assert.ok(MALE_HAIR.includes(b.hairStyle));
});

test('the injury report matches the injury you saw on the field', () => {
  const st = flow.newCareer({ first: 'A', last: 'B', position: 'WR', background: 'natural', number: 9, hometown: 'Westfield', hsTeamId: 'WFW', seed: 5 });
  for (const inj of INJURIES.filter((i) => i.part)) assert.equal(newInjury(st, { allowMajor: true, id: inj.id }).id, inj.id);
  assert.ok(INJURIES.some((i) => i.bone), 'some injuries show bone');
});

test('the game stops at halftime for the locker room and each choice applies once', () => {
  const st = flow.newCareer({ first: 'A', last: 'B', position: 'RB', background: 'natural', number: 22, hometown: 'Westfield', hsTeamId: 'WFW', seed: 9 });
  while (st.phase === 'event') flow.resolveEvent(st, 0);
  flow.submitPlan(st, [null, null, null, null, null]);
  assert.ok(st.game, 'a game is underway');
  st.game.halftimeUI = true;
  let hit = false;
  for (let guard = 0; guard < 400; guard++) {
    const r = stepGame(st);
    if (r.type === 'halftime') { hit = true; break; }
    if (r.type === 'end') break;
    if (r.type === 'decision') { resolveDecision(st, false); continue; }
    if (r.type === 'gameEvent') { resolveGameEvent(st, 0); continue; }
    resolveMoment(st, autoMoment(st));
  }
  assert.ok(hit, 'halftime stop reached');
  assert.ok(st.game.half, 'first-half snapshot saved');
  const e0 = st.game.energy ?? 80;
  assert.ok(halftimeChoice(st, 'rest'));
  assert.equal(st.game.energy, Math.min(100, e0 + 15));
  assert.equal(halftimeChoice(st, 'speech'), false, 'only one pick per halftime');
  assert.deepEqual(Object.keys(HALFTIME_CHOICES), ['rest', 'speech', 'study']);
});
