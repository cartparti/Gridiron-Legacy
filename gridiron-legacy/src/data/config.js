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
    playoffTeams: 8, // 5 division winners + 3 wild cards (older saves: top 4 in each conference)
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
  safe: { label: 'Safe', difficulty: 0.92, reward: 0.62, turnover: 0.45, desc: 'Short and sure. Smaller gains, few mistakes.' },
  balanced: { label: 'Balanced', difficulty: 1.0, reward: 1.0, turnover: 1.0, desc: 'The honest play.' },
  risky: { label: 'Risky', difficulty: 1.2, reward: 1.5, turnover: 1.9, desc: 'Go for the big one. Turnovers happen.' },
};

/** Difficulty: scales minigame timing windows. Harder settings also earn more legacy. */
export const DIFFICULTIES = {
  easy: { label: 'Easy', tol: 1.25, legacy: 0.9, desc: 'Generous timing. Learn the ropes.' },
  normal: { label: 'Normal', tol: 1.0, legacy: 1.0, desc: 'A real challenge.' },
  hard: { label: 'Hard', tol: 0.82, legacy: 1.1, desc: 'Tight windows, smart defenses.' },
  legend: { label: 'Legend', tol: 0.68, legacy: 1.2, desc: 'Only the greats. Every mistake hurts.' },
};

/** Game-day weather. tol scales timing windows; pass extra-penalizes throws and catches. */
// slip: extra drop/fumble chance; speed: player speed multiplier; wind: max wind (yards/sec of ball drift);
// fog: visibility (lower = shorter view, coverage harder to read).
export const WEATHER = {
  clear: { label: 'Clear', icon: 'sun', tol: 1, pass: 1, slip: 0, speed: 1, wind: 1 },
  night: { label: 'Night game', icon: 'moon', tol: 1, pass: 1, slip: 0, speed: 1, wind: 1 },
  rain: { label: 'Rain', icon: 'rain', tol: 0.93, pass: 0.9, slip: 0.07, speed: 0.97, wind: 2, desc: 'Slippery ball: more drops and fumbles, players slip on hard cuts.' },
  storm: { label: 'Thunderstorm', icon: 'rain', tol: 0.88, pass: 0.84, slip: 0.1, speed: 0.95, wind: 5, desc: 'Heavy rain and wind. Lightning. Hold on to the ball.' },
  snow: { label: 'Snow', icon: 'snow', tol: 0.9, pass: 0.92, slip: 0.04, speed: 0.88, wind: 2, desc: 'Everyone is slower. Footing is tricky.' },
  wind: { label: 'Windy', icon: 'wind', tol: 0.97, pass: 0.85, slip: 0, speed: 1, wind: 7, desc: 'Passes drift with the wind. Watch the arrow.' },
  fog: { label: 'Fog', icon: 'wind', tol: 0.92, pass: 0.9, slip: 0, speed: 1, wind: 1, fog: true, desc: 'Hard to see downfield. Coverage reads come late.' },
};

export const LEGACY_TIERS = [
  { min: 0, id: 'journeyman', label: 'Journeyman', blurb: 'You suited up, you competed, you belonged.' },
  { min: 170, id: 'starter', label: 'Solid Starter', blurb: 'Coaches trusted you. Teammates leaned on you.' },
  { min: 245, id: 'star', label: 'Star of Your Era', blurb: 'Kids wore your number. Defenses game-planned for you.' },
  { min: 315, id: 'hof', label: 'Hall of Fame', blurb: 'Immortal. Your bust stands in Canton Ridge forever.' },
];
