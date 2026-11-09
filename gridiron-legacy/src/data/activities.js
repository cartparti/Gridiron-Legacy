// Weekly schedule activities. Each week has 5 day slots and an energy budget.
// Unused energy becomes game-day "freshness", which widens minigame timing windows.
//
// effects:
//   train:   training units per stat (real gain depends on age, potential, mood, current level)
//   mood, health, fame, academics: flat changes
//   money:   dollars (negative = cost)
//   rel:     relationship changes (coach, teammates, family, partner, agent)
//   rehab:   weeks taken off a current injury
//   risk:    chance of a random mishap (minor injury or bad press) handled in sim/week.js
// requires: conditions to show the activity (stage list, partner, agent, injured, flag)

export const ACTIVITIES = [
  {
    id: 'sprints', label: 'Sprint Work', icon: '⚡', cost: 2, group: 'Training',
    desc: 'Hills, sleds and stopwatch reps.',
    effects: { train: { speed: 1 }, mood: -1 },
  },
  {
    id: 'weights', label: 'Weight Room', icon: '🏋️', cost: 2, group: 'Training',
    desc: 'Squats, cleans and bench.',
    effects: { train: { strength: 1 }, mood: -1 },
  },
  {
    id: 'drills', label: 'Position Drills', icon: '🎯', cost: 2, group: 'Training',
    desc: 'Footwork, hands, mechanics.',
    effects: { train: { skill: 1 }, mood: -1 },
  },
  {
    id: 'film', label: 'Film Study', icon: '🎬', cost: 1, group: 'Training',
    desc: 'Break down tape of this week\'s opponent.',
    effects: { train: { iq: 0.9 }, rel: { coach: 1 } },
  },
  {
    id: 'doubles', label: 'Two-a-Days', icon: '🔥', cost: 3, group: 'Training',
    desc: 'Everything, twice. Big gains, real injury risk.',
    effects: { train: { speed: 0.6, strength: 0.6, skill: 0.6, iq: 0.3 }, mood: -3, health: -4, risk: 0.07 },
  },
  {
    id: 'recovery', label: 'Recovery & Treatment', icon: '🧊', cost: 0, group: 'Health',
    desc: 'Ice baths, massage, sleep. Restores health.',
    effects: { health: 9, mood: 1 },
  },
  {
    id: 'rehab', label: 'Rehab Session', icon: '🩹', cost: 1, group: 'Health',
    desc: 'Work with trainers on your injury.',
    requires: { injured: true },
    effects: { rehab: 1, health: 4, rel: { coach: 1 } },
  },
  {
    id: 'yoga', label: 'Yoga & Mobility', icon: '🧘', cost: 1, group: 'Health',
    desc: 'Loose hips, calm mind.',
    effects: { health: 5, mood: 3 },
  },
  {
    id: 'classes', label: 'Study Hall', icon: '📚', cost: 1, group: 'School',
    desc: 'Keep your grades up or lose eligibility.',
    requires: { stages: ['hs', 'college'] },
    effects: { academics: 9, mood: -1, rel: { family: 1 } },
  },
  {
    id: 'meetcoach', label: 'Meet With Coach', icon: '📋', cost: 1, group: 'People',
    desc: 'Talk scheme and earn trust (more key moments).',
    effects: { rel: { coach: 5 }, train: { iq: 0.3 } },
  },
  {
    id: 'hangout', label: 'Team Hangout', icon: '🍕', cost: 1, group: 'People',
    desc: 'Wings, video games, locker room bonds.',
    effects: { rel: { teammates: 5 }, mood: 4, money: -30 },
  },
  {
    id: 'family', label: 'Family Time', icon: '🏡', cost: 1, group: 'People',
    desc: 'Sunday dinner, even on a Tuesday.',
    effects: { rel: { family: 6 }, mood: 5 },
  },
  {
    id: 'date', label: 'Date Night', icon: '🌹', cost: 1, group: 'People',
    desc: 'Quality time with {partner}.',
    requires: { partner: true },
    effects: { rel: { partner: 7 }, mood: 6, money: -120 },
  },
  {
    id: 'mentor', label: 'Mentor Rookies', icon: '🤝', cost: 1, group: 'People',
    desc: 'Pass on what you know.',
    requires: { stages: ['pro'], minAge: 26 },
    effects: { rel: { teammates: 6, coach: 2 }, fame: 1, mood: 2 },
  },
  {
    id: 'media', label: 'Media & Socials', icon: '📱', cost: 1, group: 'Fame',
    desc: 'Interviews, posts, highlight reels.',
    effects: { fame: 2, mood: -1, rel: { coach: -1 } },
  },
  {
    id: 'charity', label: 'Community Work', icon: '💛', cost: 1, group: 'Fame',
    desc: 'Youth camps, food drives, hospital visits.',
    effects: { fame: 1.5, mood: 4, rel: { family: 2 } },
  },
  {
    id: 'agentcall', label: 'Agent Meeting', icon: '💼', cost: 1, group: 'Money',
    desc: 'Chase sponsor deals with {agent}.',
    requires: { agent: true },
    effects: { rel: { agent: 6 }, sponsorChance: 0.25 },
  },
  {
    id: 'business', label: 'Side Business', icon: '🧾', cost: 2, group: 'Money',
    desc: 'Work on your {business}.',
    requires: { flag: 'has_business' },
    effects: { businessWork: 1, mood: -1 },
  },
  {
    id: 'parttime', label: 'Part-Time Job', icon: '🛒', cost: 1, group: 'Money',
    desc: 'Stocking shelves for gas money.',
    requires: { stages: ['hs', 'college'] },
    effects: { money: 90, mood: -2 },
  },
  {
    id: 'nightout', label: 'Night Out', icon: '🎉', cost: 1, group: 'Fun',
    desc: 'Big mood boost. Things can go sideways.',
    effects: { mood: 9, health: -3, rel: { teammates: 2 }, money: -80, risk: 0.12 },
  },
  {
    id: 'gaming', label: 'Gaming & Chill', icon: '🎮', cost: 0, group: 'Fun',
    desc: 'Couch, controller, zero responsibilities.',
    effects: { mood: 4 },
  },
];
