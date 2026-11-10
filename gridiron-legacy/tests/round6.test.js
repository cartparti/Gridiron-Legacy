import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newCareer } from '../src/sim/flow.js';
import { addXp, spendPoint, levelInfo } from '../src/sim/progress.js';
import { buyUpgrade, homePerks, doHomeAction, homeActionsLeft } from '../src/sim/home.js';
import { legendBoard, allTimeRank, awardRace, journey, marketValue } from '../src/sim/legends.js';
import { maxEnergy } from '../src/sim/week.js';
import { setGamePlan, tolerance } from '../src/sim/game.js';

const career = (pos = 'QB') => newCareer({ first: 'A', last: 'B', position: pos, background: 'natural', number: 9, hometown: 'Westfield', hsTeamId: 'WFW', seed: 77 });

test('XP levels you up and skill points raise ratings', () => {
  const st = career();
  const gained = addXp(st, 1000);
  assert.ok(gained >= 3);
  const { points } = levelInfo(st);
  const before = st.player.stats.skill;
  assert.ok(spendPoint(st, 'skill'));
  assert.equal(st.player.stats.skill, before + 1);
  assert.equal(levelInfo(st).points, points - 1);
});

test('home upgrades give weekly perks; home actions are limited to 2 a week', () => {
  const st = career();
  st.player.money = 100000;
  const e0 = maxEnergy(st);
  assert.ok(buyUpgrade(st, 'rest').ok);
  assert.equal(maxEnergy(st), e0 + 1);
  assert.ok(buyUpgrade(st, 'gym').ok);
  assert.ok(homePerks(st.player).train > 0);
  assert.ok(doHomeAction(st, 'physio'));
  assert.ok(doHomeAction(st, 'study'));
  assert.equal(homeActionsLeft(st), 0);
  assert.equal(doHomeAction(st, 'eat'), null);
});

test('legends boards include you; award race ranks contenders; journey and value make sense', () => {
  const st = career('WR');
  const b = legendBoard(st, 'ind');
  assert.ok(b.some((x) => x.you));
  assert.ok(b[0].ind >= b[b.length - 1].ind);
  assert.equal(JSON.stringify(legendBoard(st, 'ind').slice(0, 5)), JSON.stringify(b.slice(0, 5)), 'stable per save');
  assert.ok(allTimeRank(st).rank > 1);
  const r = awardRace(st);
  assert.ok(r.rows.some((x) => x.you));
  assert.ok(journey(st).length >= 1);
  assert.ok(marketValue('pro', 90, 26, 50) > marketValue('pro', 70, 26, 50));
});

test('game plan intensity changes the timing window', () => {
  const st = career();
  st.game = { plan: { approach: 'balanced', intensity: 'mid' }, energy: 90, tolMod: 1, momentum: 0, weather: 'clear' };
  const mid = tolerance(st, 'balanced', 'qb_throw');
  setGamePlan(st, 'intensity', 'high');
  assert.ok(tolerance(st, 'balanced', 'qb_throw') > mid);
  st.game.energy = 20;
  assert.ok(tolerance(st, 'balanced', 'qb_throw') < mid * 1.07);
});

test('every team has a stable, varied culture (biome, stadium, trait)', async () => {
  const { teamCulture, biomeFor, TRAITS } = await import('../src/data/culture.js');
  const { HS_TEAMS } = await import('../src/data/teams.js');
  const biomes = new Set();
  const stadiums = new Set();
  for (const t of HS_TEAMS) {
    const a = teamCulture(t, 'hs');
    assert.deepEqual(a, teamCulture(t, 'hs'));
    assert.ok(TRAITS[a.traitId]);
    biomes.add(biomeFor(t));
    stadiums.add(a.stadium);
  }
  assert.ok(biomes.size >= 2 && stadiums.size >= 5);
  assert.equal(biomeFor({ city: 'Palm Shores', name: 'Sharks' }), 'coast');
  assert.equal(biomeFor({ city: 'Red Mesa', name: 'Scorpions' }), 'desert');
});

test('traits unlock from career goals and equip into limited slots', async () => {
  const T = await import('../src/sim/traits.js');
  const st = career('QB');
  st.player.careerStats.passTD = 30;
  st.player.careerStats.passYds = 6000;
  const fresh = T.checkTraitUnlocks(st);
  assert.ok(fresh.some((t) => t.id === 'gunslinger') && fresh.some((t) => t.id === 'dimes'));
  assert.equal(T.equippedTraits(st).length, 1, 'level 1 = one slot');
  assert.equal(T.toggleTrait(st, 'dimes').ok, false, 'slots full');
  st.player.level = 5;
  assert.ok(T.toggleTrait(st, 'dimes').ok);
  assert.equal(T.equippedTraits(st).length, 2);
  assert.equal(T.toggleTrait(st, 'velcro').ok, false, 'other positions are locked');
});
