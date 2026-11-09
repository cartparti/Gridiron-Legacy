import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomLook, normalizeLook, bodyScale, sizeStatMods, defaultLook, HAIR_STYLES } from '../src/data/looks.js';
import { teamKits, oppKitFor, colorDist } from '../src/data/kits.js';
import { HS_TEAMS } from '../src/data/teams.js';
import { newCareer } from '../src/sim/flow.js';
import { people } from '../src/sim/social.js';

test('seeded looks are stable and varied', () => {
  assert.deepEqual(randomLook('abc'), randomLook('abc'));
  const styles = new Set(Array.from({ length: 60 }, (_, i) => randomLook(`p${i}`).hairStyle));
  assert.ok(styles.size >= 8);
  for (const s of styles) assert.ok(HAIR_STYLES.some((h) => h.id === s));
});

test('old simple looks upgrade to full looks', () => {
  const L = normalizeLook({ shirt: '#fff', pants: '#000', skin: 2, hair: 3, hairStyle: 3 }, 'seed');
  assert.equal(L.hairStyle, 'afro');
  assert.equal(L.hairColor, 3);
  assert.ok(L.eyes && L.mouth);
});

test('body size changes model scale and nudges ratings a little', () => {
  const big = bodyScale({ heightIn: 79, weightLb: 320 });
  const small = bodyScale({ heightIn: 67, weightLb: 165 });
  assert.ok(big.height > small.height && big.build > small.build);
  const mods = sizeStatMods({ heightIn: 75, weightLb: 260 }, 'QB');
  assert.ok(mods.strength > 0 && mods.speed < 0);
  for (const v of Object.values(mods)) assert.ok(Math.abs(v) <= 3);
});

test('every team has three distinct kits and opponents avoid clashes', () => {
  for (const t of HS_TEAMS) {
    const k = teamKits(t);
    assert.ok(k.home.jersey && k.away.jersey && k.third.jersey);
    assert.notEqual(k.home.jersey, k.away.jersey);
  }
  const a = HS_TEAMS[0];
  const b = { id: 'SAME', colors: a.colors.slice() };
  const opp = oppKitFor(teamKits(a).home, b, true);
  assert.ok(colorDist(opp.jersey, teamKits(a).home.jersey) > 0.2);
});

test('new career stores the custom look and everyone gets a full look', () => {
  const look = { ...defaultLook('RB'), hairStyle: 'dreads', tatL: 'sleeve' };
  const st = newCareer({ first: 'A', last: 'B', position: 'RB', background: 'natural', number: 22, hometown: 'Westfield', hsTeamId: 'WFW', look, seed: 7 });
  assert.equal(st.player.look.hairStyle, 'dreads');
  for (const pp of people(st)) assert.ok(typeof pp.look.hairStyle === 'string' && pp.look.eyes, pp.name);
});
