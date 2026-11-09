// Home upgrades (they move with you) and small weekly actions at home.
// Each upgrade has 3 levels; price[level] is the cost of buying that level. Perks scale with the level.
export const HOME_UPGRADES = [
  { id: 'rest', label: 'Bedroom', icon: 'moon', desc: 'Better sleep, more energy.', price: [300, 2500, 25000], perk: { energy: [1, 1, 2] }, levels: ['Memory foam bed', 'Blackout room', 'Sleep pod'] },
  { id: 'kitchen', label: 'Kitchen', icon: 'leaf', desc: 'Eat like a pro.', price: [400, 4000, 30000], perk: { health: [1, 2, 3], mood: [1, 1, 2] }, levels: ['Meal prep station', 'Smoothie bar', 'Personal chef kitchen'] },
  { id: 'recovery', label: 'Recovery Room', icon: 'snow', desc: 'Heal faster between games.', price: [800, 8000, 60000], perk: { health: [2, 3, 5] }, levels: ['Ice tub', 'Massage chair', 'Hyperbaric chamber'] },
  { id: 'gym', label: 'Home Gym', icon: 'dumbbell', desc: 'Every rep counts double.', price: [1000, 10000, 75000], perk: { train: [0.05, 0.1, 0.18] }, levels: ['Dumbbells', 'Full weight room', 'Pro training center'] },
  { id: 'games', label: 'Game Room', icon: 'gamepad', desc: 'Unwind with friends.', price: [250, 3000, 20000], perk: { mood: [2, 3, 5] }, levels: ['Console setup', 'Arcade cabinets', 'Theater room'] },
  { id: 'display', label: 'Trophy Wall', icon: 'trophy', desc: 'Show off your hardware.', price: [200, 2500, 18000], perk: { fame: [0.1, 0.2, 0.35], mood: [1, 1, 2] }, levels: ['Shelf', 'Lit display case', 'Hall of trophies'] },
  { id: 'garden', label: 'Garden', icon: 'sun', desc: 'Fresh air and calm.', price: [300, 3500, 25000], perk: { mood: [1, 2, 3], health: [0, 1, 1] }, levels: ['Patio', 'Pool', 'Backyard field'] },
  { id: 'pets', label: 'Pets', icon: 'heart', desc: 'Best friends that never boo.', price: [400, 1500, 6000], perk: { mood: [2, 3, 4] }, levels: ['Goldfish', 'Dog', 'Dog + cat crew'] },
];

/** Free actions at home: pick up to 2 per week. */
export const HOME_ACTIONS = [
  { id: 'physio', label: 'Physiotherapy', icon: 'bandage', desc: '+6 health', effects: { health: 6 } },
  { id: 'sleep', label: 'Sleep Properly', icon: 'moon', desc: '+1 energy this week', week: { energyBonus: 1 } },
  { id: 'eat', label: 'Eat Well', icon: 'leaf', desc: '+3 health, +2 mood', effects: { health: 3, mood: 2 } },
  { id: 'study', label: 'Study the Opponent', icon: 'film', desc: 'Wider timing windows this game', week: { studied: true } },
  { id: 'stretch', label: 'Stretch & Mobility', icon: 'bolt', desc: 'Lower injury risk this week', week: { stretched: true }, effects: { health: 2 } },
];
export const HOME_ACTIONS_PER_WEEK = 2;
