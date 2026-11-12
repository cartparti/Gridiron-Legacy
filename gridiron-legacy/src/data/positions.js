// Positions, stat weights and starting backgrounds.

export const STAT_KEYS = ['speed', 'skill', 'iq', 'strength'];

export const STAT_LABELS = {
  speed: 'Speed',
  skill: 'Skill',
  iq: 'Football IQ',
  strength: 'Strength',
};

export const STAT_SHORT = { speed: 'SPD', skill: 'SKL', iq: 'IQ', strength: 'STR' };

export const POSITIONS = {
  QB: {
    label: 'Quarterback',
    short: 'QB',
    weights: { speed: 0.12, skill: 0.36, iq: 0.36, strength: 0.16 },
    blurb: 'Read the defense, pick your target, put the ball where only your guy can catch it.',
    statNotes: {
      speed: 'Escape pressure',
      skill: 'Throw accuracy',
      iq: 'Reading coverage, pocket time',
      strength: 'Arm power',
    },
  },
  RB: {
    label: 'Running Back',
    short: 'RB',
    weights: { speed: 0.34, skill: 0.22, iq: 0.1, strength: 0.34 },
    blurb: 'Hit the hole, time your cuts, juke the linebacker, and finish runs with power.',
    statNotes: {
      speed: 'Top speed, breakaways',
      skill: 'Juke timing window',
      iq: 'Spotting the hole',
      strength: 'Breaking tackles',
    },
  },
  WR: {
    label: 'Wide Receiver',
    short: 'WR',
    weights: { speed: 0.34, skill: 0.36, iq: 0.14, strength: 0.16 },
    blurb: 'Sell the route, snap your break, and win the ball at its highest point.',
    statNotes: {
      speed: 'Beating coverage',
      skill: 'Catch window, route breaks',
      iq: 'Route timing',
      strength: 'Contested catches',
    },
  },
  CB: {
    label: 'Cornerback',
    short: 'CB',
    weights: { speed: 0.34, skill: 0.26, iq: 0.26, strength: 0.14 },
    blurb: 'Shadow the league\'s best receivers, jump routes for interceptions, and make the open-field tackle.',
    statNotes: {
      speed: 'Staying on top of routes',
      skill: 'Breaking on the ball, ball skills',
      iq: 'Reading the QB and routes',
      strength: 'Tackling',
    },
  },
  DT: {
    label: 'Defensive Tackle',
    short: 'DT',
    weights: { speed: 0.18, skill: 0.24, iq: 0.14, strength: 0.44 },
    blurb: 'Fight through blockers with rip, swim and bull-rush moves. Sack the quarterback, stuff the run.',
    statNotes: {
      speed: 'First step, chasing the QB',
      skill: 'Rip and swim moves',
      iq: 'Reading run or pass',
      strength: 'Bull rush, taking on double teams',
    },
  },
};

// The mascot: you never play a snap. You're inside the costume, winning the crowd, firing T-shirts, taking on the
// other team's mascot and pulling off halftime stunts. Same four stats, read differently.
POSITIONS.MS = {
  label: 'Mascot',
  short: 'MASCOT',
  mascot: true,
  weights: { speed: 0.22, skill: 0.34, iq: 0.22, strength: 0.22 },
  blurb: 'Be the big-headed legend in the costume. Pump up the crowd, fire the T-shirt cannon, win mascot dance-offs and stick the halftime backflip.',
  statNotes: {
    speed: 'Hustle: dance moves and getting around',
    skill: 'Showmanship: rhythm, aim and stunts',
    iq: 'Crowd IQ: reading the moment',
    strength: 'Stamina: surviving a game in a 40 lb costume',
  },
};
export const isMascotPos = (pos) => pos === 'MS';

/** Background picked at character creation: shapes starting stats. */
export const BACKGROUNDS = [
  { id: 'natural', label: 'Natural Athlete', desc: 'Born fast. Everything else is a work in progress.', stats: { speed: 8, skill: 0, iq: -3, strength: 1 } },
  { id: 'gymrat', label: 'Gym Rat', desc: 'First in the weight room, last to leave.', stats: { speed: 0, skill: -2, iq: 0, strength: 8 } },
  { id: 'student', label: 'Film Junkie', desc: 'You know the playbook better than the coaches.', stats: { speed: -2, skill: 1, iq: 9, strength: -2 } },
  { id: 'technician', label: 'Technician', desc: 'Footwork, hands, mechanics. Flawless fundamentals.', stats: { speed: -1, skill: 8, iq: 1, strength: -2 } },
];

