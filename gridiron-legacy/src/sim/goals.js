// Season goals: before every season your coach sets three targets (a main stat, a second one or a grade, and a team
// goal; backups are asked to win the job). Live progress on the Week tab, rewards at the end of the season.
// Stored in state.goals { year, stage, list: [{ id, label, kind, key, target, reward }] }. Pure sim.
import { clamp } from '../core/util.js';
import { rand } from '../core/rng.js';
import { getTeam } from './league.js';
import { addXp } from './progress.js';

// per-game expectations for a solid starter (hs, college, pro), scaled by how good you are
const PER_GAME = {
  QB: [['passYds', 'passing yards', [150, 205, 235]], ['passTD', 'touchdown passes', [1.3, 1.7, 1.6]]],
  RB: [['rushYds', 'rushing yards', [70, 78, 72]], ['rushTD', 'rushing touchdowns', [0.75, 0.8, 0.65]]],
  WR: [['recYds', 'receiving yards', [55, 64, 66]], ['recTD', 'receiving touchdowns', [0.5, 0.55, 0.5]]],
  CB: [['pd', 'pass breakups', [0.9, 1.0, 1.0]], ['defInt', 'interceptions', [0.22, 0.26, 0.25]]],
  DT: [['defSacks', 'sacks', [0.4, 0.5, 0.55]], ['tfl', 'tackles for loss', [0.7, 0.8, 0.8]]],
  K: [['fgMade', 'field goals', [1.0, 1.4, 1.6]], ['xpMade', 'extra points', [2.2, 2.4, 2.2]]],
  MS: [['hype', 'crowd hype', [62, 64, 66]], ['danceWins', 'showdown wins', [0.4, 0.45, 0.45]]],
};
const STAGE_IDX = { hs: 0, college: 1, pro: 2 };
const nice = (n) => (n >= 1000 ? Math.round(n / 50) * 50 : n >= 100 ? Math.round(n / 10) * 10 : n >= 20 ? Math.round(n / 5) * 5 : Math.max(1, Math.round(n)));

/** Make this season's goals (called when a season starts). */
export function setSeasonGoals(state) {
  const p = state.player;
  const c = state.career;
  if (!p || !c || c.stage === 'retired') return null;
  const games = state.league?.schedule?.length ?? 10;
  const si = STAGE_IDX[c.stage] ?? 0;
  const backup = p.depth?.role === 'backup';
  const k = clamp(0.75 + ((p.ovr ?? 60) - 60) / 80, 0.65, 1.25) * (backup ? 0.35 : 1);
  const [main, second] = PER_GAME[p.position] ?? PER_GAME.WR;
  const list = [];
  list.push({ id: 'main', kind: 'stat', key: main[0], target: nice(main[2][si] * games * k), label: '' });
  if (backup) list.push({ id: 'job', kind: 'starter', target: 1, label: 'Win the starting job' });
  else if (rand(state) < 0.5) list.push({ id: 'second', kind: 'stat', key: second[0], target: nice(second[2][si] * games * k), label: '' });
  else list.push({ id: 'grade', kind: 'grade', target: p.ovr >= 78 ? 74 : 68, label: '' });
  const teamBase = getTeam(state.league, c.teamId)?.base ?? 60;
  const strong = teamBase >= 66;
  list.push(strong ? { id: 'playoffs', kind: 'playoffs', target: 1, label: 'Make the playoffs' } : { id: 'wins', kind: 'wins', target: Math.max(3, Math.round(games * (teamBase >= 58 ? 0.55 : 0.4))), label: '' });
  for (const gl of list) {
    if (gl.kind === 'stat') gl.label = `${gl.target.toLocaleString('en-US')} ${(main[0] === gl.key ? main : second)[1]}`;
    if (gl.kind === 'grade') gl.label = `Average a ${gl.target >= 74 ? 'B+' : 'B'} game grade or better`;
    if (gl.kind === 'wins') gl.label = `Win ${gl.target} games`;
    gl.reward = { xp: 50 + si * 15, coach: 4, fame: 1 + si, money: c.stage === 'pro' ? 40000 : 0 };
  }
  state.goals = { year: c.year, stage: c.stage, list };
  return state.goals;
}

/** Live progress for each goal: { ...goal, cur, pct, done, text } */
export function goalProgress(state) {
  const G = state.goals;
  if (!G || G.year !== state.career?.year) return [];
  const p = state.player;
  const s = p.seasonStats ?? {};
  const team = getTeam(state.league, state.career.teamId);
  return G.list.map((gl) => {
    let cur = 0;
    let text = '';
    if (gl.kind === 'stat') { cur = s[gl.key] ?? 0; text = `${cur.toLocaleString('en-US')} / ${gl.target.toLocaleString('en-US')}`; }
    else if (gl.kind === 'grade') { cur = s.games ? Math.round(s.grades / s.games) : 0; text = s.games ? `Averaging ${cur}` : 'No games yet'; }
    else if (gl.kind === 'wins') { cur = team?.w ?? 0; text = `${cur} / ${gl.target} wins`; }
    else if (gl.kind === 'playoffs') { cur = state.league?.playoffs?.seeds?.includes(state.career.teamId) ? 1 : 0; text = cur ? 'In!' : state.league?.phase === 'regular' ? 'Still to play for' : 'Missed'; }
    else if (gl.kind === 'starter') { cur = p.depth?.role === 'starter' ? 1 : 0; text = cur ? 'You\'re the starter' : 'Still the backup'; }
    const pct = gl.kind === 'grade' ? (s.games ? clamp(cur / gl.target, 0, 1) : 0) : clamp(cur / gl.target, 0, 1);
    return { ...gl, cur, pct, done: cur >= gl.target, text };
  });
}

/** End of season: pay out completed goals. Returns { results, hit }. */
export function resolveGoals(state) {
  const rows = goalProgress(state);
  if (!rows.length) return null;
  const p = state.player;
  let hit = 0;
  for (const r of rows) {
    if (!r.done) continue;
    hit++;
    addXp(state, r.reward.xp);
    p.rel.coach = clamp(p.rel.coach + r.reward.coach, 0, 100);
    p.fame = clamp(p.fame + r.reward.fame, 0, 100);
    if (r.reward.money) p.money = (p.money ?? 0) + r.reward.money;
  }
  // a coach who sets goals notices when you blow all of them
  if (hit === 0) p.rel.coach = clamp(p.rel.coach - 3, 0, 100);
  state.goals.resolved = true;
  return { results: rows.map((r) => ({ label: r.label, done: r.done, text: r.text, reward: r.reward })), hit };
}
