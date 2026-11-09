// Season awards, league leaders and records that persist across decades.
import { clamp } from '../core/util.js';
import { gauss, chance, rand } from '../core/rng.js';
import { getTeam, genName } from './league.js';
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
  } else if (pos === 'DT') {
    prod = ((s.defSacks ?? 0) / g / 0.7) * 36 + ((s.tfl ?? 0) / g / 1.0) * 20 + (s.tackles / g / 3.5) * 22 + (s.pd / g / 0.4) * 6 + 8;
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
  DT: [['defSacks', 'Sacks'], ['tfl', 'Tackles for Loss']],
};

/** Generated stat leaders for the pro league (the competition you're measured against). */
export function genLeaders(state, league) {
  const leaders = {};
  const scale = { passYds: [3600, 70], passTD: [26, 0.7], rushYds: [1150, 30], rushTD: [10, 0.4], recYds: [1150, 30], recTD: [9, 0.35], defInt: [6, 0.2], defTD: [1.5, 0.06], defSacks: [12, 0.35], tfl: [15, 0.35] };
  for (const [pos, cats] of Object.entries(STAT_CATS)) {
    const top = league.players.filter((p) => p.pos === (pos === 'DT' ? 'DL' : pos)).sort((a, b) => b.ovr - a.ovr).slice(0, 3);
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
      defSacks: { value: 23, holder: 'Big Earl Mabry', year: 1994 },
      tfl: { value: 39, holder: 'Hollis "Hammer" Grant', year: 2013 },
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
      defSacks: { value: 201, holder: 'Big Earl Mabry', year: 2002 },
      tfl: { value: 230, holder: 'Hollis "Hammer" Grant', year: 2020 },
    },
  };
}

export const RECORD_LABELS = {
  passYds: 'Passing Yards', passTD: 'Passing TDs', rushYds: 'Rushing Yards',
  rushTD: 'Rushing TDs', recYds: 'Receiving Yards', recTD: 'Receiving TDs', defInt: 'Interceptions', defTD: 'Defensive TDs', defSacks: 'Sacks', tfl: 'Tackles for Loss',
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
    if (enough && perf >= 74 && beats(80, 3.5)) awards.push(p.position === 'CB' || p.position === 'DT' ? 'Defensive Player of the Year' : 'Offensive Player of the Year');
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

// ------------------------------------------------------------------ league award races

/** The headline trophies for each level, in display order. ind = individual, team = team trophy. */
export const TROPHIES = {
  hs: [
    { name: 'State Player of the Year', kind: 'ind', icon: 'star' },
    { name: 'All-State', kind: 'ind', icon: 'medal' },
    { name: 'State Champion', kind: 'team', icon: 'trophy' },
  ],
  college: [
    { name: 'Ironstone Trophy', kind: 'ind', icon: 'star' },
    { name: 'All-Conference', kind: 'ind', icon: 'medal' },
    { name: 'Freshman of the Year', kind: 'ind', icon: 'medal' },
    { name: 'Heritage Bowl Champion', kind: 'team', icon: 'trophy' },
  ],
  pro: [
    { name: 'Most Valuable Player', kind: 'ind', icon: 'star' },
    { name: 'Offensive Player of the Year', kind: 'ind', icon: 'medal' },
    { name: 'Defensive Player of the Year', kind: 'ind', icon: 'medal' },
    { name: 'Rookie of the Year', kind: 'ind', icon: 'medal' },
    { name: 'Comeback Player of the Year', kind: 'ind', icon: 'medal' },
    { name: 'All-League', kind: 'ind', icon: 'medal' },
    { name: 'Legacy Bowl Champion', kind: 'team', icon: 'trophy' },
    { name: 'Legacy Bowl MVP', kind: 'ind', icon: 'star' },
  ],
};

const AWARD_POS = { 'Defensive Player of the Year': ['CB', 'S', 'LB', 'DL'], 'Offensive Player of the Year': ['QB', 'RB', 'WR', 'TE'] };

/**
 * Who won each headline award this season (you, or someone else in the league).
 * Stored in state.awardHistory so the Awards screen can show every season's winners.
 */
export function recordLeagueAwards(state, myAwards) {
  const league = state.league;
  const stage = state.career.stage;
  const champ = getTeam(league, league.champion);
  const me = state.player;
  const myTeam = getTeam(league, state.career.teamId);
  const pool = (positions) => {
    if (league.players?.length) {
      const c = league.players.filter((x) => !positions || positions.includes(x.pos)).sort((a, b) => b.ovr - a.ovr).slice(0, 8);
      if (c.length) { const pl = c[Math.floor(rand(state) * Math.min(4, c.length))]; return { name: `${pl.first} ${pl.last}`, team: pl.teamId, pos: pl.pos }; }
    }
    const n = genName(state);
    const t = league.teams.slice().sort((a, b) => b.w - a.w)[Math.floor(rand(state) * 4)];
    const pos = positions ? positions[Math.floor(rand(state) * positions.length)] : ['QB', 'RB', 'WR', 'CB', 'LB'][Math.floor(rand(state) * 5)];
    return { name: `${n.first} ${n.last}`, team: t.id, pos };
  };
  const rows = [];
  for (const tr of TROPHIES[stage] ?? []) {
    if (tr.name === 'Rookie of the Year' || tr.name === 'Comeback Player of the Year' || tr.name === 'Freshman of the Year' || tr.name === 'All-State' || tr.name === 'All-Conference' || tr.name === 'All-League') {
      if (myAwards.includes(tr.name)) rows.push({ name: tr.name, winner: `${me.first} ${me.last}`, team: myTeam.id, pos: me.position, you: true });
      continue; // multi-winner or niche awards only listed when you win them
    }
    if (tr.kind === 'team') { rows.push({ name: tr.name, winner: `${champ.city} ${champ.name}`, team: champ.id, you: champ.id === myTeam.id, team_: true }); continue; }
    if (tr.name === 'Legacy Bowl MVP') {
      if (myAwards.includes(tr.name)) rows.push({ name: tr.name, winner: `${me.first} ${me.last}`, team: myTeam.id, pos: me.position, you: true });
      else { const w = pool(); rows.push({ name: tr.name, winner: w.name, team: champ.id, pos: w.pos, you: false }); }
      continue;
    }
    if (myAwards.includes(tr.name)) rows.push({ name: tr.name, winner: `${me.first} ${me.last}`, team: myTeam.id, pos: me.position, you: true });
    else { const w = pool(AWARD_POS[tr.name]); rows.push({ name: tr.name, winner: w.name, team: w.team, pos: w.pos, you: false }); }
  }
  state.awardHistory ??= [];
  state.awardHistory.push({ year: state.career.year, stage, rows });
  return rows;
}

/** Live "award watch": how close your season is to each award's bar (0-1+). */
export function awardWatch(state) {
  const p = state.player;
  const s = p.seasonStats;
  const stage = state.career.stage;
  const perf = s.games ? seasonPerf(p.position, s) : 0;
  const team = getTeam(state.league, state.career.teamId);
  const bars = {
    hs: [['All-State', 64], ['State Player of the Year', 76]],
    college: [['All-Conference', 66], ['Ironstone Trophy', 80]],
    pro: [['All-League', 71], [p.position === 'CB' || p.position === 'DT' ? 'Defensive Player of the Year' : 'Offensive Player of the Year', 80], ['Most Valuable Player', 83]],
  }[stage] ?? [];
  return { perf: Math.round(perf), games: s.games, winPct: team.w / Math.max(1, team.w + team.l), rows: bars.map(([name, bar]) => ({ name, bar, pct: Math.max(0, Math.min(1.1, perf / bar)) })) };
}
