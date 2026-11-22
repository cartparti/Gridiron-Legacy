// Opponent scouting: every team has real tendencies (how often they blitz, man vs zone, how deep they throw) that
// the play engine actually uses. Film study reveals them before the game and shows pre-snap tells in plays. Pure sim.
import { clamp } from '../core/util.js';

const hash = (s) => { let x = 2166136261; for (const ch of String(s)) { x ^= ch.charCodeAt(0); x = Math.imul(x, 16777619); } return (x >>> 0) / 4294967296; };

/** Stable tendencies for a team (same every game, a little different each season). */
export function teamTendencies(team, year = 0) {
  if (!team) return null;
  const k = (salt) => hash(`${team.id}|${team.name}|${salt}|${Math.floor(year / 2)}`);
  const def = team.def ?? 65;
  const blitz = clamp(0.12 + k('blitz') * 0.32 + (def - 65) / 400, 0.1, 0.46);
  const man = clamp(0.28 + k('man') * 0.5, 0.25, 0.8);
  const deep = clamp(0.15 + k('deep') * 0.4, 0.12, 0.55); // how often their offense takes shots
  const runHeavy = clamp(0.3 + k('run') * 0.4, 0.3, 0.7);
  const style = blitz > 0.34 ? (man > 0.55 ? 'Blitz and press man' : 'Zone blitz') : man > 0.6 ? 'Press man coverage' : man < 0.4 ? 'Bend-don\'t-break zone' : 'Balanced defense';
  const offense = deep > 0.4 ? 'Shot-happy offense' : runHeavy > 0.58 ? 'Run-first offense' : 'Short, quick passing game';
  return { blitz, man, deep, runHeavy, style, offense };
}

/** What your position should know about this opponent. */
export function scoutTips(t, pos) {
  if (!t) return [];
  const tips = [];
  if (pos === 'QB') {
    if (t.blitz > 0.32) tips.push('They bring the blitz a lot: look for the red ! before the snap and audible to a quick pass.');
    else tips.push('They rarely blitz: you will have time. Take your shots downfield.');
    tips.push(t.man > 0.55 ? 'Mostly man coverage: crossing routes and double moves get open.' : 'Mostly zone: find the soft spots between defenders and sit in them.');
  } else if (pos === 'WR') {
    tips.push(t.man > 0.55 ? 'Press man: win off the line, the deep ball is there if you beat your man.' : 'Zone coverage: settle in the holes, the hitch and curl work.');
    if (t.blitz > 0.32) tips.push('Blitzes leave you one-on-one. Hot routes (slant, quick out) get the ball out fast.');
  } else if (pos === 'RB') {
    tips.push(t.blitz > 0.32 ? 'Aggressive front: cutbacks and counters can hit big.' : 'Disciplined front: be patient and follow your blocks.');
    tips.push(t.man > 0.55 ? 'Linebackers chase in man: screens work.' : 'They keep everything in front: grind out the yards.');
  } else if (pos === 'CB') {
    tips.push(t.deep > 0.4 ? 'Their QB loves the deep ball: stay on top of your man.' : 'Short, quick throws: drive on the ball and break up the underneath stuff.');
    tips.push(t.runHeavy > 0.58 ? 'Run-first team: set the edge and tackle.' : 'Pass-first team: expect a lot of targets.');
  } else if (pos === 'DT') {
    tips.push(t.runHeavy > 0.58 ? 'They run right at you: anchor and plug the gaps.' : 'Pass-first: get after the quarterback.');
  } else if (pos === 'K') tips.push('Special teams: their return unit is ' + (t.deep > 0.35 ? 'dangerous. Kick it deep or out of reach.' : 'average.'));
  else tips.push('Their crowd is ' + (t.blitz > 0.3 ? 'loud and rowdy. Bring the energy.' : 'polite. Wake them up.'));
  return tips;
}

/** The week's scouting report for your next opponent (revealed = you studied film this week). */
export function scoutReport(state, oppTeam) {
  const t = teamTendencies(oppTeam, state.career?.year ?? 0);
  if (!t) return null;
  const revealed = !!state.week?.scouted;
  return { ...t, revealed, tips: scoutTips(t, state.player?.position) };
}

/** The tendencies the play engine uses (always real; `revealed` decides whether you see the tells). */
export function scoutForPlay(state, oppTeam) {
  const t = teamTendencies(oppTeam, state.career?.year ?? 0);
  return t ? { blitz: t.blitz, man: t.man, deep: t.deep, revealed: !!state.week?.scouted } : null;
}
