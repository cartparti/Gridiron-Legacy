// Housing, cars, perks, investments, sponsors and injuries.

// Housing: pay weekly rent. `mood` is a weekly mood nudge, `fame` a small status bump on move-in.
export const HOUSING = [
  { id: 'parents', label: "Parents' House", rent: 0, mood: 0, stages: ['hs'], desc: 'Free, loud, and Mom still checks your homework.' },
  { id: 'dorm', label: 'Campus Dorm', rent: 0, mood: 0, stages: ['college'], desc: 'Paper-thin walls. Free.' },
  { id: 'offcampus', label: 'Off-Campus Apartment', rent: 220, mood: 1, stages: ['college', 'pro'], desc: 'Your own space (and dishes).' },
  { id: 'condo', label: 'City Condo', rent: 1600, mood: 2, stages: ['pro'], fame: 1, desc: 'Doorman, gym, skyline view.' },
  { id: 'loft', label: 'Downtown Loft', rent: 4200, mood: 3, stages: ['pro'], fame: 2, desc: 'Exposed brick and exposed lifestyle.' },
  { id: 'house', label: 'Suburban House', rent: 6500, mood: 4, stages: ['pro'], fame: 2, desc: 'Big yard, quiet street, room for family.' },
  { id: 'mansion', label: 'Hillside Mansion', rent: 22000, mood: 5, stages: ['pro'], fame: 5, desc: 'Infinity pool. Infinite bills.' },
  { id: 'estate', label: 'Oceanfront Estate', rent: 48000, mood: 6, stages: ['pro'], fame: 8, desc: 'The house on every highlight intro.' },
];

// Cars: one-time purchase plus weekly upkeep.
export const CARS = [
  { id: 'none', label: 'Bus Pass', price: 0, upkeep: 0, mood: 0, fame: 0, desc: 'Route 9, every 20 minutes.' },
  { id: 'hatch', label: 'Used Hatchback', price: 4500, upkeep: 25, mood: 1, fame: 0, desc: '210,000 miles of character.' },
  { id: 'pickup', label: 'Pickup Truck', price: 28000, upkeep: 60, mood: 2, fame: 0, desc: 'Hauls gear, hauls teammates.' },
  { id: 'sedan', label: 'Sport Sedan', price: 62000, upkeep: 120, mood: 2, fame: 1, desc: 'Quiet power.' },
  { id: 'suv', label: 'Luxury SUV', price: 115000, upkeep: 220, mood: 3, fame: 2, desc: 'Tinted windows, heated everything.' },
  { id: 'super', label: 'Supercar', price: 340000, upkeep: 900, mood: 4, fame: 4, desc: 'Zero to scandal in 2.9 seconds.' },
];

// One-time perks with permanent gameplay bonuses.
export const PERKS = [
  { id: 'trainer', label: 'Personal Trainer', price: 15000, weekly: 400, desc: '+20% speed & strength training.', bonus: { train: { speed: 0.2, strength: 0.2 } } },
  { id: 'qbcoach', label: 'Private Position Coach', price: 20000, weekly: 500, desc: '+25% skill training.', bonus: { train: { skill: 0.25 } } },
  { id: 'filmroom', label: 'Home Film Room', price: 30000, weekly: 0, desc: '+30% Football IQ training.', bonus: { train: { iq: 0.3 } } },
  { id: 'chef', label: 'Personal Chef', price: 10000, weekly: 700, desc: '+4 health every week.', bonus: { health: 4 } },
  { id: 'sleeppod', label: 'Recovery Suite', price: 75000, weekly: 0, desc: '+1 energy every week.', bonus: { energy: 1 } },
  { id: 'therapist', label: 'Sports Psychologist', price: 8000, weekly: 300, desc: '+3 mood every week.', bonus: { mood: 3 } },
  { id: 'pr', label: 'PR Team', price: 25000, weekly: 1500, desc: 'Scandals hurt half as much. +0.5 fame/wk.', bonus: { fame: 0.5, scandalShield: 0.5 } },
];

// Investments: yearly return is drawn from a normal distribution (mean, sd).
export const INVESTMENTS = [
  { id: 'savings', label: 'Savings Account', mean: 0.03, sd: 0.0, desc: 'Safe and boring. 3% a year.' },
  { id: 'index', label: 'Index Fund', mean: 0.07, sd: 0.15, desc: 'The whole market. Patient money.' },
  { id: 'realestate', label: 'Real Estate Fund', mean: 0.06, sd: 0.08, desc: 'Apartments and strip malls.' },
  { id: 'startup', label: 'Startup Portfolio', mean: 0.12, sd: 0.55, desc: 'Your teammate\'s cousin\'s app. Could be huge.' },
];

// Sponsor brands (fictional). Weekly pay scales with fame.
export const SPONSORS = [
  { brand: 'Voltade', product: 'sports drink' },
  { brand: 'Strideline', product: 'cleats' },
  { brand: 'Kodiak Bars', product: 'protein bars' },
  { brand: 'Northpeak', product: 'outerwear' },
  { brand: 'Glidewell', product: 'razors' },
  { brand: 'Ironclad Insurance', product: 'insurance' },
  { brand: 'Pulse Audio', product: 'headphones' },
  { brand: 'Brightwave Mobile', product: 'phones' },
  { brand: 'Crunch Kingdom', product: 'cereal' },
  { brand: 'Summit Motors', product: 'trucks' },
  { brand: 'FreshFold', product: 'meal kits' },
  { brand: 'Arcwing', product: 'video games' },
];

// Injuries: weeks out is a [min, max] range. `perm` permanently changes stats.
export const INJURIES = [
  { id: 'bruise', label: 'Bruised Ribs', weeks: [1, 1], weight: 6 },
  { id: 'hamstring', label: 'Hamstring Strain', weeks: [1, 3], weight: 5 },
  { id: 'ankle', label: 'Sprained Ankle', weeks: [1, 3], weight: 5 },
  { id: 'concussion', label: 'Concussion', weeks: [1, 3], weight: 3 },
  { id: 'shoulder', label: 'Separated Shoulder', weeks: [2, 5], weight: 2 },
  { id: 'highankle', label: 'High Ankle Sprain', weeks: [3, 6], weight: 2 },
  { id: 'hand', label: 'Broken Hand', weeks: [3, 5], weight: 2 },
  { id: 'acl', label: 'Torn ACL', weeks: [30, 40], weight: 0.35, perm: { speed: -4 }, major: true },
];
