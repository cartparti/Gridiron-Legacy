// Career achievements: one-time milestones (first win, a 300-yard game, a title, a 60-yard field goal...).
// Checked after every game, at the end of each season and at retirement. Each one pays XP and a little fame.
// Stored in player.achievements { id: { year, stage } }. Pure sim.
import { clamp } from '../core/util.js';
import { addXp } from './progress.js';
import { addNews } from './press.js';

const TD = (s) => (s.passTD ?? 0) + (s.rushTD ?? 0) + (s.recTD ?? 0) + (s.defTD ?? 0);
const FOOTBALL = (pos) => pos !== 'MS';

/**
 * tier: 1 bronze, 2 silver, 3 gold. pos: only for that position. when: 'game' (g = last game: userStats, won, grade,
 * rivalry, comeback, isTitle) | 'season' (s = season stats, team record, champion) | 'career' (any time).
 */
export const ACHIEVEMENTS = [
  // ---- career milestones
  { id: 'debut', name: 'Debut', desc: 'Play your first game.', icon: 'star', tier: 1, when: 'game', test: ({ g }) => !g.sitOut },
  { id: 'firstw', name: 'First W', desc: 'Win your first game.', icon: 'trophy', tier: 1, when: 'game', test: ({ g }) => !g.sitOut && g.won },
  { id: 'firsttd', name: 'Six Points', desc: 'Score your first touchdown.', icon: 'flame', tier: 1, when: 'game', test: ({ p }) => TD(p.careerStats) > 0, pos: ['QB', 'RB', 'WR', 'CB'] },
  { id: 'agrade', name: 'Flawless', desc: 'Get an A+ game grade.', icon: 'star', tier: 2, when: 'game', test: ({ g }) => !g.sitOut && g.grade >= 93 },
  { id: 'potg', name: 'Player of the Game', desc: 'Be named player of the game.', icon: 'crown', tier: 1, when: 'game', test: ({ g }) => !!g.potg },
  { id: 'rivalw', name: 'Bragging Rights', desc: 'Beat your rival.', icon: 'flame', tier: 1, when: 'game', test: ({ g }) => !g.sitOut && g.rivalry && g.won },
  { id: 'comeback', name: 'Never Out of It', desc: 'Win after trailing by 10+ at halftime.', icon: 'bolt', tier: 2, when: 'game', test: ({ g }) => !g.sitOut && g.won && g.comeback },
  { id: 'titlegame', name: 'Big Stage', desc: 'Win a championship game.', icon: 'trophy', tier: 2, when: 'game', test: ({ g }) => !g.sitOut && g.isTitle && g.won },
  { id: 'clutch10', name: 'Ice in the Veins', desc: 'Make 10 clutch plays in your career.', icon: 'snow', tier: 2, when: 'career', test: ({ p }) => (p.careerStats.clutch ?? 0) >= 10 },
  { id: 'games50', name: 'Workhorse', desc: 'Play 50 games.', icon: 'dumbbell', tier: 1, when: 'career', test: ({ p }) => (p.careerStats.games ?? 0) >= 50 },
  { id: 'games150', name: 'Iron Man', desc: 'Play 150 games.', icon: 'shield', tier: 3, when: 'career', test: ({ p }) => (p.careerStats.games ?? 0) >= 150 },
  { id: 'level10', name: 'Grinder', desc: 'Reach player level 10.', icon: 'bolt', tier: 1, when: 'career', test: ({ p }) => (p.level ?? 1) >= 10 },
  { id: 'level25', name: 'Elite Grinder', desc: 'Reach player level 25.', icon: 'bolt', tier: 3, when: 'career', test: ({ p }) => (p.level ?? 1) >= 25 },
  { id: 'ovr80', name: 'Starter Material', desc: 'Reach an 80 overall.', icon: 'star', tier: 1, when: 'career', test: ({ p }) => p.ovr >= 80 },
  { id: 'ovr90', name: 'Superstar', desc: 'Reach a 90 overall.', icon: 'star', tier: 3, when: 'career', test: ({ p }) => p.ovr >= 90 },
  { id: 'fame75', name: 'Household Name', desc: 'Reach 90 fame.', icon: 'crown', tier: 2, when: 'career', test: ({ p }) => p.fame >= 90 },
  { id: 'million', name: 'Millionaire', desc: 'Have $1,000,000 in the bank.', icon: 'dollar', tier: 2, when: 'career', test: ({ p }) => (p.money ?? 0) >= 1e6 },
  { id: 'mansion', name: 'Dream Home', desc: 'Fully upgrade three parts of your home.', icon: 'home', tier: 2, when: 'career', test: ({ p }) => Object.values(p.home ?? {}).filter((v) => v >= 3).length >= 3 },
  { id: 'firstaward', name: 'Hardware', desc: 'Win your first individual award.', icon: 'medal', tier: 1, when: 'season', test: ({ p }) => p.awards.some((a) => !/Champion$/.test(a.name)) },
  { id: 'awards10', name: 'Trophy Case', desc: 'Win 10 individual awards.', icon: 'medal', tier: 3, when: 'season', test: ({ p }) => p.awards.filter((a) => !/Champion$/.test(a.name)).length >= 10 },
  { id: 'mvp', name: 'Most Valuable', desc: 'Win the pro MVP.', icon: 'crown', tier: 3, when: 'season', test: ({ p }) => p.awards.some((a) => a.name === 'Most Valuable Player') },
  { id: 'statechamp', name: 'State Champs', desc: 'Win a high school state title.', icon: 'trophy', tier: 2, when: 'season', test: ({ p }) => p.titles.some((t) => t.stage === 'hs') },
  { id: 'natchamp', name: 'National Champs', desc: 'Win a college national title.', icon: 'trophy', tier: 2, when: 'season', test: ({ p }) => p.titles.some((t) => t.stage === 'college') },
  { id: 'ring', name: 'Legacy Bowl Ring', desc: 'Win the Legacy Bowl.', icon: 'trophy', tier: 3, when: 'season', test: ({ p }) => p.titles.some((t) => t.stage === 'pro') },
  { id: 'dynasty', name: 'Dynasty', desc: 'Win three championships.', icon: 'crown', tier: 3, when: 'season', test: ({ p }) => p.titles.length >= 3 },
  { id: 'unbeaten', name: 'Perfect Season', desc: 'Go unbeaten in the regular season.', icon: 'star', tier: 3, when: 'season', test: ({ team }) => team && team.l === 0 && team.w >= 8 },
  { id: 'record', name: 'History Maker', desc: 'Break a record.', icon: 'scroll', tier: 3, when: 'season', test: ({ p }) => p.records.length > 0 },
  { id: 'round1', name: 'First-Round Pick', desc: 'Get drafted in the first round.', icon: 'star', tier: 2, when: 'career', test: ({ p }) => p.draft?.round === 1, pos: ['QB', 'RB', 'WR', 'CB', 'DT', 'K'] },
  { id: 'hof', name: 'Hall of Famer', desc: 'Get into the Hall of Fame.', icon: 'crown', tier: 3, when: 'retire', test: ({ state }) => state.legacy?.tier?.id === 'hof' },
  // ---- position feats (one game)
  { id: 'qb300', name: '300 Club', desc: 'Throw for 300 yards in a game.', icon: 'target', tier: 2, pos: ['QB'], when: 'game', test: ({ s }) => s.passYds >= 300 },
  { id: 'qb5td', name: 'Five-Star Day', desc: 'Throw 5 touchdowns in a game.', icon: 'flame', tier: 3, pos: ['QB'], when: 'game', test: ({ s }) => s.passTD >= 5 },
  { id: 'rb150', name: 'Workhorse Back', desc: 'Run for 150 yards in a game.', icon: 'bolt', tier: 2, pos: ['RB'], when: 'game', test: ({ s }) => s.rushYds >= 150 },
  { id: 'rb3td', name: 'Hat Trick', desc: 'Run for 3 touchdowns in a game.', icon: 'flame', tier: 3, pos: ['RB'], when: 'game', test: ({ s }) => s.rushTD >= 3 },
  { id: 'wr150', name: 'Can\'t Guard Him', desc: '150 receiving yards in a game.', icon: 'bolt', tier: 2, pos: ['WR'], when: 'game', test: ({ s }) => s.recYds >= 150 },
  { id: 'wr3td', name: 'End Zone Magnet', desc: 'Catch 3 touchdowns in a game.', icon: 'flame', tier: 3, pos: ['WR'], when: 'game', test: ({ s }) => s.recTD >= 3 },
  { id: 'cb2int', name: 'Thief', desc: 'Two interceptions in a game.', icon: 'shield', tier: 2, pos: ['CB'], when: 'game', test: ({ s }) => s.defInt >= 2 },
  { id: 'pick6', name: 'Pick Six', desc: 'Return an interception for a touchdown.', icon: 'flame', tier: 2, pos: ['CB'], when: 'game', test: ({ s }) => s.defTD >= 1 },
  { id: 'dt3sack', name: 'Quarterback\'s Nightmare', desc: 'Three sacks in a game.', icon: 'dumbbell', tier: 3, pos: ['DT'], when: 'game', test: ({ s }) => (s.defSacks ?? 0) >= 3 },
  { id: 'dt2tfl', name: 'In the Backfield', desc: 'Two tackles for loss in a game.', icon: 'bolt', tier: 1, pos: ['DT'], when: 'game', test: ({ s }) => (s.tfl ?? 0) >= 2 },
  { id: 'k50', name: 'Fifty Burger', desc: 'Make a 50-yard field goal.', icon: 'target', tier: 2, pos: ['K'], when: 'game', test: ({ s }) => (s.fgLong ?? 0) >= 50 },
  { id: 'k58', name: 'From the Logo', desc: 'Make a 60-yard field goal.', icon: 'flame', tier: 3, pos: ['K'], when: 'game', test: ({ s }) => (s.fgLong ?? 0) >= 60 },
  { id: 'kperfect', name: 'Perfect Day', desc: 'Go 4-for-4 or better on field goals in a game.', icon: 'star', tier: 2, pos: ['K'], when: 'game', test: ({ s }) => (s.fgAtt ?? 0) >= 4 && s.fgMade === s.fgAtt },
  { id: 'kwinner', name: 'Walk-Off', desc: 'Kick a game-winning field goal.', icon: 'crown', tier: 3, pos: ['K'], when: 'game', test: ({ s }) => (s.gameWinners ?? 0) >= 1 },
  { id: 'konside', name: 'Surprise!', desc: 'Recover an onside kick.', icon: 'bolt', tier: 2, pos: ['K'], when: 'game', test: ({ s }) => (s.onsideRec ?? 0) >= 1 },
  { id: 'mshype', name: 'Stadium Shaker', desc: 'Get 90 crowd hype in a game.', icon: 'flame', tier: 2, pos: ['MS'], when: 'game', test: ({ s }) => (s.hype ?? 0) >= 90 },
  { id: 'msstunt', name: 'Stuck It', desc: 'Land a halftime stunt.', icon: 'star', tier: 1, pos: ['MS'], when: 'game', test: ({ s }) => (s.stunts ?? 0) >= 1 },
  // ---- position seasons
  { id: 'qb4000', name: '4,000-Yard Season', desc: 'Throw for 4,000 yards in a season.', icon: 'target', tier: 3, pos: ['QB'], when: 'season', test: ({ ss }) => ss.passYds >= 4000 },
  { id: 'rb1000', name: 'Thousand-Yard Rusher', desc: 'Run for 1,000 yards in a season.', icon: 'bolt', tier: 2, pos: ['RB'], when: 'season', test: ({ ss }) => ss.rushYds >= 1000 },
  { id: 'wr1000', name: 'Thousand-Yard Receiver', desc: '1,000 receiving yards in a season.', icon: 'bolt', tier: 2, pos: ['WR'], when: 'season', test: ({ ss }) => ss.recYds >= 1000 },
  { id: 'cb6int', name: 'No Fly Zone', desc: 'Six interceptions in a season.', icon: 'shield', tier: 3, pos: ['CB'], when: 'season', test: ({ ss }) => ss.defInt >= 6 },
  { id: 'dt10sack', name: 'Double-Digit Sacks', desc: 'Ten sacks in a season.', icon: 'dumbbell', tier: 3, pos: ['DT'], when: 'season', test: ({ ss }) => (ss.defSacks ?? 0) >= 10 },
  { id: 'kpct', name: 'Money Man', desc: 'Make 90% of your field goals in a season (15+ tries).', icon: 'dollar', tier: 3, pos: ['K'], when: 'season', test: ({ ss }) => (ss.fgAtt ?? 0) >= 15 && ss.fgMade / ss.fgAtt >= 0.9 },
  { id: 'msshow', name: 'Showdown King', desc: 'Win 5 mascot showdowns in a season.', icon: 'crown', tier: 2, pos: ['MS'], when: 'season', test: ({ ss }) => (ss.danceWins ?? 0) >= 5 },
];
export const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
export const TIER_XP = { 1: 25, 2: 60, 3: 120 };
export const TIER_NAME = { 1: 'Bronze', 2: 'Silver', 3: 'Gold' };

/** Achievements that apply to this position. */
export const achievementsFor = (pos) => ACHIEVEMENTS.filter((a) => (a.pos ? a.pos.includes(pos) : a.id !== 'firsttd' || FOOTBALL(pos)));

/**
 * Check achievements. moment: 'game' (pass lastGame as g) | 'season' (pass the team) | 'retire'.
 * 'career' ones are checked every time. Returns the newly unlocked achievements.
 */
export function checkAchievements(state, moment, { g = null, team = null } = {}) {
  const p = state.player;
  if (!p) return [];
  p.achievements ??= {};
  const ctx = { state, p, g, s: g?.userStats ?? {}, ss: p.seasonStats ?? {}, team };
  const fresh = [];
  for (const a of achievementsFor(p.position)) {
    if (p.achievements[a.id]) continue;
    if (a.when !== 'career' && a.when !== moment) continue;
    if (a.when === 'game' && !g) continue;
    let ok = false;
    try { ok = !!a.test(ctx); } catch { ok = false; }
    if (!ok) continue;
    p.achievements[a.id] = { year: state.career?.year ?? 0, stage: state.career?.stage ?? 'hs' };
    addXp(state, TIER_XP[a.tier] ?? 25);
    p.fame = clamp(p.fame + a.tier * 0.5, 0, 100);
    if (a.tier >= 2) addNews(state, 'story', `${p.first} ${p.last} unlocks an achievement: ${a.name}.`);
    fresh.push(a);
  }
  return fresh;
}

/** { done, total, pct, points } for the achievements page and friend cards. */
export function achievementSummary(p) {
  const list = achievementsFor(p.position);
  const got = list.filter((a) => p.achievements?.[a.id]);
  return { done: got.length, total: list.length, pct: list.length ? got.length / list.length : 0, points: got.reduce((n, a) => n + a.tier * 10, 0) };
}
