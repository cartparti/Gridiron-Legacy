// v0.42: the pro league in real cities (five divisions of four) and the college signing day.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRO_TEAMS, PRO_DIVISIONS, COLLEGE_TEAMS, HS_TEAMS, proTeamDef } from '../src/data/teams.js';
import { GLYPHS, mascotKind } from '../src/data/mascots.js';
import { teamIdentity, teamKits } from '../src/data/kits.js';
import { teamCulture, biomeFor } from '../src/data/culture.js';
import { createLeague, recordResult, seedPlayoffs, advancePlayoffRound, isDivisionLeague, projectedSeeds, roundName, standings } from '../src/sim/league.js';
import { seasonStakes } from '../src/sim/career.js';

const holder = (seed) => ({ rngState: seed, career: { year: 2026, stage: 'pro', teamId: 'SEA' }, player: { rel: { teammates: 50 }, ovr: 70 } });

test('pro league: 20 teams, five divisions of four, the requested cities', () => {
  assert.equal(PRO_TEAMS.length, 20);
  assert.deepEqual(PRO_DIVISIONS, ['Northwest', 'Southwest', 'Northeast', 'Southeast', 'Heartland']);
  for (const d of PRO_DIVISIONS) assert.equal(PRO_TEAMS.filter((t) => t.div === d).length, 4, d);
  const cities = (d) => PRO_TEAMS.filter((t) => t.div === d).map((t) => t.city).sort();
  assert.deepEqual(cities('Northwest'), ['Portland', 'Salt Lake', 'San Francisco', 'Seattle']);
  assert.deepEqual(cities('Southwest'), ['Dallas', 'Las Vegas', 'Los Angeles', 'Phoenix']);
  assert.deepEqual(cities('Northeast'), ['Chicago', 'Detroit', 'New York', 'Washington']);
  assert.deepEqual(cities('Southeast'), ['Charlotte', 'Miami', 'Nashville', 'New Orleans']);
  const ids = new Set([...PRO_TEAMS, ...COLLEGE_TEAMS, ...HS_TEAMS].map((t) => t.id));
  assert.equal(ids.size, PRO_TEAMS.length + COLLEGE_TEAMS.length + HS_TEAMS.length, 'team ids are unique across levels');
});

test('every pro team is unique: name, colors, mascot glyph, uniform and scenery', () => {
  assert.equal(new Set(PRO_TEAMS.map((t) => t.name)).size, 20);
  assert.equal(new Set(PRO_TEAMS.map((t) => t.colors.join())).size, 20);
  const looks = new Set();
  for (const t of PRO_TEAMS) {
    assert.ok(GLYPHS[mascotKind(t)], `${t.name} glyph`);
    assert.equal(mascotKind(t), t.glyph);
    const id = teamIdentity(t);
    for (const k of Object.keys(t.kit)) assert.equal(id[k], t.kit[k], `${t.name} kit.${k}`);
    looks.add(`${id.glyph}|${id.pattern}|${id.font}|${id.stripe}|${t.colors.join()}`);
    const kits = teamKits(t);
    assert.equal(kits.home.style.pattern, t.kit.pattern);
    assert.equal(biomeFor(t), t.biome);
    const c = teamCulture(t, 'pro');
    assert.deepEqual(c.landmarks, t.landmarks);
    assert.equal(c.traitId, t.trait);
  }
  assert.equal(looks.size, 20);
  // other levels are untouched: no landmarks, random identity
  assert.equal(proTeamDef(COLLEGE_TEAMS[0].id), null);
  assert.deepEqual(teamCulture(COLLEGE_TEAMS[0], 'college').landmarks, []);
});

test('glyphs are 16x16', () => {
  for (const [k, g] of Object.entries(GLYPHS)) { assert.equal(g.length, 16, k); for (const row of g) assert.equal(row.length, 16, k); }
});

test('division playoffs: 5 division winners + 3 wild cards, bracket plays out to a champion', () => {
  const st = holder(11);
  const league = createLeague(st, 'pro');
  assert.ok(isDivisionLeague(league));
  for (const wk of league.schedule) for (const g of wk) { const a = Math.floor(Math.random() * 40); recordResult(league, g, a, a + 1 + Math.floor(Math.random() * 10) * (Math.random() < 0.5 ? -1 : 1) || a + 3); }
  const { seeds, winners, wild } = projectedSeeds(league);
  assert.equal(seeds.length, 8); assert.equal(winners.length, 5); assert.equal(wild.length, 3);
  for (const d of PRO_DIVISIONS) assert.equal(winners.find((t) => t.div === d)?.id, standings(league, d)[0].id, `${d} winner`);
  const po = seedPlayoffs(league);
  assert.equal(po.rounds[0].length, 4);
  assert.equal(roundName(league, 0), 'Wild Card');
  assert.equal(roundName(league, 1), 'Semifinal');
  for (let guard = 0; guard < 5 && !league.champion; guard++) {
    for (const g of league.playoffs.rounds[league.playoffs.round]) if (!g.result) recordResult(league, g, 21, 14, false);
    advancePlayoffRound(league);
  }
  assert.ok(seeds.some((t) => t.id === league.champion));
  st.league = league;
  const sk = seasonStakes(st);
  assert.equal(sk.div, 'Northwest'); assert.equal(sk.of, 4);
});

test('older saves keep their two-conference pro league', () => {
  const st = holder(5);
  const league = createLeague(st, 'pro');
  league.teams.forEach((t, i) => { t.conf = i % 2 ? 'Summit' : 'Coastal'; });
  assert.ok(!isDivisionLeague(league));
  for (const wk of league.schedule) for (const g of wk) recordResult(league, g, 20, 10);
  const po = seedPlayoffs(league);
  assert.equal(po.seeds.length, 8);
  assert.equal(roundName(league, 1), 'Conference Final');
});
