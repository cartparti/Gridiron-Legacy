// Tunable numbers for the whole game. Balance changes usually start here.

export const START_YEAR = 2026;

export const STAGES = {
  hs: {
    label: 'High School',
    seasons: 2,
    games: 8,
    playoffTeams: 4,
    startAge: 16,
    titleName: 'State Championship',
    leagueName: 'Tri-County Athletic League',
  },
  college: {
    label: 'College',
    seasons: 3,
    games: 10,
    playoffTeams: 4,
    titleName: 'Heritage Bowl',
    leagueName: 'Heartland Athletic Conference',
  },
  pro: {
    label: 'Pro',
    games: 14,
    playoffTeams: 8, // top 4 in each conference
    titleName: 'Legacy Bowl',
    leagueName: 'Grand Gridiron League',
  },
};

export const SLOTS_PER_WEEK = 5;
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
export const BASE_ENERGY = 7; // plus up to +4 from health, +1 from perks

export const RETIRE_AGE = 34; // career ends after the season you turn this age
export const EARLY_RETIRE_AGE = 30; // you may choose to retire from here on

export const SALARY_CAP = 225_000_000;
export const MIN_SALARY = 850_000;
export const ROOKIE_CONTRACT_YEARS = 3;

/** How each play call changes a key moment. */
export const PLAY_CALLS = {
  safe: { label: 'Safe', difficulty: 0.8, reward: 0.75, turnover: 0.35, desc: 'Short and sure. Smaller gains, few mistakes.' },
  balanced: { label: 'Balanced', difficulty: 1.0, reward: 1.0, turnover: 1.0, desc: 'The honest play.' },
  risky: { label: 'Risky', difficulty: 1.3, reward: 1.4, turnover: 2.2, desc: 'Go for the big one. Turnovers happen.' },
};

export const LEGACY_TIERS = [
  { min: 0, id: 'journeyman', label: 'Journeyman', blurb: 'You suited up, you competed, you belonged.' },
  { min: 140, id: 'starter', label: 'Solid Starter', blurb: 'Coaches trusted you. Teammates leaned on you.' },
  { min: 215, id: 'star', label: 'Star of Your Era', blurb: 'Kids wore your number. Defenses game-planned for you.' },
  { min: 300, id: 'hof', label: 'Hall of Fame', blurb: 'Immortal. Your bust stands in Canton Ridge forever.' },
];
