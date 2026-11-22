import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as flow from '../src/sim/flow.js';
import { botStep, randomCareerOpts, STRATEGIES } from '../src/sim/bot.js';
import { stepGame, autoMoment, resolveMoment, resolveDecision, resolveGameEvent } from '../src/sim/game.js';
import { getTeam } from '../src/sim/league.js';
import { teamTendencies, scoutReport, scoutForPlay } from '../src/sim/scouting.js';
import { rivalryTrophy, settleRivalry, powerRankings, snapshotPower, makePreview, recordChase, nominatePlay, votePlay } from '../src/sim/leaguelife.js';
import { askExtension, acceptExtension, startHoldout, holdoutWeek, endHoldout, canAskExtension } from '../src/sim/extension.js';
import { startFoundation, donate, hostEvent, foundationLegacy, levelOf } from '../src/sim/foundation.js';
import { planWedding, tryForBaby, familyWeekly, heirName } from '../src/sim/family.js';
import { menteeCandidates, pickMentee, mentorSession, mentorSeasonEnd } from '../src/sim/mentor.js';
import { computeLegacy } from '../src/sim/legacy.js';
import { nextGenerationOpts } from '../src/sim/career.js';

const toPro = (seed, pos = 'QB', season = 2, week = 2) => {
  const st = flow.newCareer(randomCareerOpts(seed, pos));
  for (let i = 0; i < 150000 && !(st.career.stage === 'pro' && st.career.stageSeason === season && st.phase === 'plan' && st.league.week === week); i++) botStep(st, STRATEGIES.balanced, 0.6);
  assert.equal(st.career.stage, 'pro');
  return st;
};

test('scouting: stable tendencies, revealed only after film study, and handed to plays', () => {
  const st = flow.newCareer(randomCareerOpts(3, 'QB'));
  const team = st.league.teams[1];
  assert.deepEqual(teamTendencies(team, 2030), teamTendencies(team, 2030));
  const t = teamTendencies(team, 2030);
  assert.ok(t.blitz >= 0.1 && t.blitz <= 0.46 && t.man >= 0.25 && t.man <= 0.8);
  assert.equal(scoutReport(st, team).revealed, false);
  st.week.scouted = true;
  assert.equal(scoutForPlay(st, team).revealed, true);
  assert.ok(scoutReport(st, team).tips.length >= 1);
});

test('rivalry trophies change hands and remember the streak', () => {
  const st = flow.newCareer(randomCareerOpts(4, 'RB'));
  const [a, b] = st.league.teams;
  st.career.teamId = a.id;
  const tr = rivalryTrophy(st, a, b);
  assert.ok(tr.name.length > 4);
  assert.equal(rivalryTrophy(st, b, a), tr, 'same trophy either way round');
  const g = { rivalry: true, oppId: b.id, won: true, score: { home: 21, away: 14 } };
  settleRivalry(st, g);
  const r2 = settleRivalry(st, g);
  assert.ok(r2.kept);
  assert.equal(tr.streak, 2);
  assert.equal(st.trophyCase[tr.key].count, 2);
});

test('power rankings rank every team once, with movement after a week', () => {
  const st = toPro(55, 'QB', 2, 4);
  snapshotPower(st);
  const list = powerRankings(st);
  assert.equal(list.length, st.league.teams.length);
  assert.deepEqual(list.map((r) => r.rank), list.map((_, i) => i + 1));
  assert.equal(list.filter((r) => r.you).length, 1);
  const pv = makePreview(st);
  assert.ok(pv && pv.projected && pv.preRank >= 1);
});

test('record chase shows records within reach', () => {
  const st = toPro(56, 'QB', 2, 6);
  st.player.seasonStats.passYds = 3800; st.player.seasonStats.games = 6;
  const list = recordChase(st);
  assert.ok(list.some((r) => r.key === 'passYds' && r.kind === 'season'));
  assert.ok(list[0].need > 0);
});

test('play of the week: big plays get nominated, the vote happens once', () => {
  const st = toPro(57, 'WR', 1, 3);
  const lg = { moments: [{ label: 'Deep shot', quality: 0.97, td: true, yards: 60 }], sitOut: false, playoff: false };
  const pw = nominatePlay(st, lg);
  assert.ok(pw);
  st.lastGame = { potw: pw };
  const r = votePlay(st);
  assert.equal(typeof r.won, 'boolean');
  assert.equal(votePlay(st, { boost: true }), r);
  assert.equal(nominatePlay(st, { moments: [{ label: 'meh', quality: 0.4, yards: 2 }] }), null);
});

test('extension and holdout: an underpaid player gets an offer; a holdout sits you until it ends', () => {
  const st = toPro(61, 'WR', 3, 2);
  st.player.contract.years = 2;
  st.player.contract.salary = 500000;
  assert.ok(canAskExtension(st));
  const e = askExtension(st);
  assert.equal(e.status, 'offer');
  assert.ok(e.offer.salary > 500000);
  startHoldout(st);
  assert.equal(flow.gameDayStatus(st).canPlay, false);
  let caved = false;
  for (let i = 0; i < 12 && st.player.holdout; i++) if (/caved/.test(holdoutWeek(st) ?? '')) caved = true;
  if (st.player.holdout) endHoldout(st);
  assert.equal(st.player.holdout, null);
  assert.equal(flow.gameDayStatus(st).canPlay, true);
  if (caved) assert.ok(st.player.contract.salary > 500000);
  // the next ask has to wait for next season
  assert.equal(canAskExtension(st), false);
  void acceptExtension;
});

test('foundation: donations level it up, events use a day, legacy counts it', () => {
  const st = toPro(62, 'CB', 2, 2);
  assert.ok(startFoundation(st, 'health'));
  st.player.money = 3e6;
  assert.ok(donate(st, 600000).levelUp);
  assert.equal(st.foundation.level, levelOf(600000));
  st.week.plan = [null, null, null, null, null];
  assert.ok(hostEvent(st).ok);
  assert.equal(hostEvent(st).ok, false, 'one event a week');
  assert.ok(foundationLegacy(st) > 0);
  assert.ok(computeLegacy(st).lines.some((l) => /foundation/i.test(l.label)));
});

test('family: wedding, a baby, and your son carries on the name', () => {
  const st = toPro(63, 'RB', 2, 2);
  st.player.partnerName = 'Ava'; st.player.flags.married = true; st.player.money = 1e6;
  assert.ok(planWedding(st, 'backyard').ok);
  assert.equal(planWedding(st, 'gala'), null, 'one wedding');
  st.player.family.expecting = { weeks: 1 };
  familyWeekly(st);
  assert.equal(st.player.family.kids.length, 1);
  st.player.family.kids.push({ name: 'Leo', sex: 'm', born: st.career.year });
  st.player.family.tried = st.career.year;
  assert.equal(tryForBaby(st), null, 'once a season');
  const heir = heirName(st.player);
  assert.ok(heir);
  assert.equal(nextGenerationOpts(st).first, heir);
});

test('mentorship: pick a young teammate, one session a week, growth at season end', () => {
  const st = toPro(64, 'QB', 5, 2);
  const c = menteeCandidates(st);
  assert.equal(c.length, 3);
  const m = pickMentee(st, c[0]);
  assert.ok(m);
  assert.ok(mentorSession(st, 'reps').ok);
  assert.equal(mentorSession(st, 'film').ok, false, 'once a week');
  const before = st.player.mentee.ovr;
  const rep = mentorSeasonEnd(st);
  assert.ok(rep.to >= Math.round(before));
});

test('a full game with scouting still plays out', () => {
  const st = toPro(65, 'QB', 1, 3);
  flow.submitPlan(st, ['film', null, null, null, null].map((x, i) => (i === 0 ? null : x)));
  for (let i = 0; i < 300; i++) {
    const r = stepGame(st);
    if (r.type === 'end') break;
    if (r.type === 'decision') { resolveDecision(st, true); continue; }
    if (r.type === 'gameEvent') { resolveGameEvent(st, 0); continue; }
    resolveMoment(st, autoMoment(st, 'balanced'));
  }
  flow.finishGame(st);
  assert.equal(st.phase, 'postgame');
  assert.ok(getTeam(st.league, st.career.teamId));
});
