// Season awards, league leaders and records that persist across decades.
import { clamp } from '../core/util.js';
import { gauss, chance } from '../core/rng.js';
import { getTeam } from './league.js';
import { addNews } from './press.js';

/** Production score 0-100 from per-game stats, comparable across positions. */
export function seasonPerf(pos, s) {
  const g = Math.max(1, s.games);
  let prod;
  if (pos === 'QB') {
    const pct = s.passAtt ? s.passComp / s.passAtt : 0;
    prod = (s.passYds / g / 280) * 45 + (s.passTD / g / 2.4) * 35 + (pct - 0.55) * 80 - (s.int / g) * 10;
  } else if (pos === 'RB') {
    prod = (s.rushYds / g / 120) * 55 + (s.rushTD / g / 1.2) * 30 + (s.recYds / g / 40) * 10 - (s.fumbles / g) * 12;
  } else if (pos === 'CB') {
    prod = (s.defInt / g / 0.4) * 32 + (s.pd / g / 1.1) * 22 + (s.tackles / g / 4.5) * 18 + (s.defTD / g / 0.1) * 8 - (s.ydsAllowed / g / 60) * 12 - (s.tdAllowed / g / 0.4) * 8 + 8;
  } else {
    prod = (s.recYds / g / 120) * 50 + (s.recTD / g / 1.0) * 30 + (s.rec / g / 8) * 12 - (s.drops / g) * 3;
  }
  const grade = s.games ? s.grades / s.games : 0;
  return clamp(prod * 0.5 + grade * 0.5, 0, 100);
}

const STAT_CATS = {
  QB: [['passYds', 'Passing Yards'], ['passTD', 'Passing TDs']],
  RB: [['rushYds', 'Rushing Yards'], ['rushTD', 'Rushing TDs']],
  WR: [['recYds', 'Receiving Yards'], ['recTD', 'Receiving TDs']],
  CB: [['defInt', 'Interceptions'], ['defTD', 'Defensive TDs']],
};

/** Generated stat leaders for the pro league (the competition you're measured against). */
export function genLeaders(state, league) {
  const leaders = {};
  const scale = { passYds: [3600, 70], passTD: [26, 0.7], rushYds: [1150, 30], rushTD: [10, 0.4], recYds: [1150, 30], recTD: [9, 0.35], defInt: [6, 0.2], defTD: [1.5, 0.06] };
  for (const [pos, cats] of Object.entries(STAT_CATS)) {
    const top = league.players.filter((p) => p.pos === pos).sort((a, b) => b.ovr - a.ovr).slice(0, 3);
    for (const [key] of cats) {
      leaders[key] = top.map((pl) => {
        const [base, per] = scale[key];
        return { name: `${pl.first[0]}. ${pl.last}`, team: pl.teamId, value: Math.max(0, Math.round(gauss(state, base + (pl.ovr - 80) * per * 1.0, base * 0.09))) };
      }).sort((a, b) => b.value - a.value);
    }
  }
  return leaders;
}

export function seedRecords(state) {
  return {
    season: {
      passYds: { value: 5120, holder: 'Dex Holloway', year: 2011 },
      passTD: { value: 49, holder: 'Dex Holloway', year: 2011 },
      rushYds: { value: 1984, holder: 'Marcus "Train" Odum', year: 1998 },
      rushTD: { value: 24, holder: 'Bo Fairbanks', year: 2005 },
      recYds: { value: 1830, holder: 'Andre Whitfield', year: 2016 },
      recTD: { value: 21, holder: 'Jalen Sutton', year: 2009 },
      defInt: { value: 14, holder: 'Night Train Lowry', year: 1987 },
      defTD: { value: 5, holder: 'Deion Abara', year: 2001 },
    },
    career: {
      passYds: { value: 68400, holder: 'Ty Prescott', year: 2019 },
      passTD: { value: 512, holder: 'Ty Prescott', year: 2019 },
      rushYds: { value: 17200, holder: 'Marcus "Train" Odum', year: 2006 },
      rushTD: { value: 158, holder: 'Bo Fairbanks', year: 2012 },
      recYds: { value: 21500, holder: 'Andre Whitfield', year: 2023 },
      recTD: { value: 182, holder: 'Andre Whitfield', year: 2023 },
      defInt: { value: 81, holder: 'Paul Kraemer', year: 1979 },
      defTD: { value: 15, holder: 'Rod Wedgewood', year: 2004 },
    },
  };
}

export const RECORD_LABELS = {
  passYds: 'Passing Yards', passTD: 'Passing TDs', rushYds: 'Rushing Yards',
  rushTD: 'Rushing TDs', recYds: 'Receiving Yards', recTD: 'Receiving TDs', defInt: 'Interceptions', defTD: 'Defensive TDs',
};

/** Check the user's (and the league leaders') numbers against the record book. */
export function checkRecords(state, league) {
  if (!state.records) state.records = seedRecords(state);
  const seeded = seedRecords(state);
  for (const k of ['season', 'career']) for (const [key, v] of Object.entries(seeded[k])) state.records[k][key] ??= v;
  const p = state.player;
  const broken = [];
  const name = `${p.first} ${p.last}`;
  for (const [key] of STAT_CATS[p.position]) {
    const rec = state.records.season[key];
    if (p.seasonStats[key] > rec.value) {
      state.records.season[key] = { value: p.seasonStats[key], holder: name, year: state.career.year, user: true };
      // Beating your own record updates the book but only counts once for legacy.
      if (!rec.user) broken.push(`Single-season ${RECORD_LABELS[key]}`);
      else addNews(state, 'record', `${name} extends the single-season ${RECORD_LABELS[key]} record: ${p.seasonStats[key]}.`);
    }
    const crec = state.records.career[key];
    if (p.proCareerStats[key] > crec.value && !crec.user) {
      state.records.career[key] = { value: p.proCareerStats[key], holder: name, year: state.career.year, user: true };
      broken.push(`Career ${RECORD_LABELS[key]}`);
    } else if (crec.user) crec.value = p.proCareerStats[key];
  }
  // League leaders can break records too, keeping the book alive across decades.
  if (league?.leaders) {
    for (const [key, list] of Object.entries(league.leaders)) {
      const top = list[0];
      if (top && top.value > state.records.season[key].value) {
        state.records.season[key] = { value: top.value, holder: top.name, year: state.career.year };
        addNews(state, 'record', `${top.name} sets a new single-season ${RECORD_LABELS[key]} record: ${top.value}.`);
      }
    }
  }
  for (const b of broken) {
    p.records.push({ label: b, year: state.career.year });
    addNews(state, 'record', `HISTORY! ${name} breaks the ${b} record.`);
  }
  return broken;
}

/** Decide end-of-season awards for the user. */
export function seasonAwards(state, { champion, titleGrade, rookie, missedLastSeason }) {
  const p = state.player;
  const s = p.seasonStats;
  const stage = state.career.stage;
  const perf = seasonPerf(p.position, s);
  const team = getTeam(state.league, state.career.teamId);
  const winPct = team.w / Math.max(1, team.w + team.l);
  const enough = s.games >= Math.ceil(state.league.schedule.length * 0.6);
  const awards = [];
  const beats = (mean, sd) => perf > gauss(state, mean, sd);
  if (stage === 'hs') {
    if (enough && perf >= 62 && beats(64, 6)) awards.push('All-State');
    if (enough && perf >= 72 && winPct >= 0.6 && beats(76, 5)) awards.push('State Player of the Year');
    if (champion) awards.push('State Champion');
  } else if (stage === 'college') {
    if (enough && perf >= 62 && beats(66, 6)) awards.push('All-Conference');
    if (state.career.stageSeason === 1 && enough && perf >= 60 && beats(64, 6)) awards.push('Freshman of the Year');
    if (enough && perf >= 76 && winPct >= 0.6 && beats(80, 4)) awards.push('Ironstone Trophy');
    if (champion) awards.push('Heritage Bowl Champion');
  } else {
    if (enough && perf >= 66 && beats(71, 5)) awards.push('All-League');
    if (enough && perf >= 74 && beats(80, 3.5)) awards.push(p.position === 'CB' ? 'Defensive Player of the Year' : 'Offensive Player of the Year');
    if (enough && perf >= 77 && winPct >= 0.6 && beats(83, 3)) awards.push('Most Valuable Player');
    if (rookie && enough && perf >= 58 && beats(64, 5)) awards.push('Rookie of the Year');
    if (missedLastSeason && enough && perf >= 62) awards.push('Comeback Player of the Year');
    if (champion) awards.push('Legacy Bowl Champion');
    if (champion && titleGrade >= 72) awards.push('Legacy Bowl MVP');
  }
  for (const a of awards) {
    p.awards.push({ name: a, year: state.career.year, stage });
    if (!/Champion$/.test(a)) addNews(state, 'award', `${p.first} ${p.last} wins ${a}!`);
  }
  if (champion) p.titles.push({ year: state.career.year, stage });
  return { awards, perf: Math.round(perf), winPct };
}

/** Pro league history: champions and MVPs going back decades (seeded with fiction). */
export function seedHistory(state, league) {
  const hist = [];
  for (let y = state.career.year - 20; y < state.career.year; y++) {
    const t = league.teams[Math.floor(Math.abs(Math.sin(y * 9.7)) * league.teams.length)];
    hist.push({ year: y, champion: t.id, mvp: null });
  }
  return hist;
}

export function legacyBonusForChampionship(state) {
  return chance(state, 0.5);
}
