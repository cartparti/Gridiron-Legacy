// Unlockable player traits. Each has an unlock goal (career stat, level, relationship) and a perk that
// the free-control play engine reads (opts.traits). Equip slots: 1 at level 1, 2 at level 5, 3 at level 10.
export const TRAITS = [
  // ---------------- QB
  { id: 'gunslinger', pos: 'QB', name: 'Gunslinger', icon: 'flame', desc: 'Throws get there 12% faster.', goal: { stat: 'passTD', n: 25, label: 'Career passing TDs' } },
  { id: 'dimes', pos: 'QB', name: 'Dime Dropper', icon: 'target', desc: 'Throws are 25% more accurate.', goal: { stat: 'passYds', n: 5000, label: 'Career passing yards' } },
  { id: 'pocket', pos: 'QB', name: 'Pocket Presence', icon: 'shield', desc: 'Pass rushers take longer to reach you and you escape sacks more.', goal: { stat: 'passAtt', n: 300, label: 'Career pass attempts' } },
  { id: 'escape', pos: 'QB', name: 'Escape Artist', icon: 'bolt', desc: '+8% speed and bigger juke windows when you run.', goal: { stat: 'rushYds', n: 400, label: 'Career rushing yards' } },
  { id: 'icevein', pos: 'QB', name: 'Ice Veins', icon: 'snow', desc: 'Quick-time events are 40% easier.', goal: { stat: 'clutch', n: 5, label: 'Clutch plays' } },
  // ---------------- RB
  { id: 'truck', pos: 'RB', name: 'Truck Stick', icon: 'flame', desc: 'Stiff arms and broken tackles work 30% more.', goal: { stat: 'rushTD', n: 15, label: 'Career rushing TDs' } },
  { id: 'ankles', pos: 'RB', name: 'Ankle Breaker', icon: 'bolt', desc: 'Juke and spin windows are 40% bigger.', goal: { stat: 'rushYds', n: 2000, label: 'Career rushing yards' } },
  { id: 'gear2', pos: 'RB', name: 'Second Gear', icon: 'star', desc: '+8% top speed when sprinting.', goal: { stat: 'rushYds', n: 1000, label: 'Career rushing yards' } },
  { id: 'workhorse', pos: 'RB', name: 'Workhorse', icon: 'dumbbell', desc: 'Game energy drains 30% slower.', goal: { stat: 'rushAtt', n: 300, label: 'Career carries' } },
  { id: 'secure', pos: 'RB', name: 'Ball Security', icon: 'shield', desc: 'Fumbles are half as likely.', goal: { stat: 'games', n: 20, label: 'Career games' } },
  // ---------------- WR
  { id: 'velcro', pos: 'WR', name: 'Velcro Hands', icon: 'target', desc: 'Catch timing window 30% bigger.', goal: { stat: 'rec', n: 60, label: 'Career catches' } },
  { id: 'deep', pos: 'WR', name: 'Deep Threat', icon: 'bolt', desc: '+7% speed once you\'re 10 yards downfield.', goal: { stat: 'recYds', n: 1500, label: 'Career receiving yards' } },
  { id: 'moss', pos: 'WR', name: 'Moss Master', icon: 'trophy', desc: 'Contested catches are much easier.', goal: { stat: 'recTD', n: 12, label: 'Career receiving TDs' } },
  { id: 'yac', pos: 'WR', name: 'YAC Monster', icon: 'flame', desc: 'Break 40% more tackles after the catch.', goal: { stat: 'recYds', n: 3000, label: 'Career receiving yards' } },
  { id: 'routes', pos: 'WR', name: 'Route Technician', icon: 'clipboard', desc: 'Defenders trail you by an extra step.', goal: { stat: 'games', n: 25, label: 'Career games' } },
  // ---------------- CB
  { id: 'ballhawk', pos: 'CB', name: 'Ballhawk', icon: 'star', desc: '+20% interception chance.', goal: { stat: 'defInt', n: 8, label: 'Career interceptions' } },
  { id: 'lockdown', pos: 'CB', name: 'Lockdown', icon: 'shield', desc: 'Receivers you cover catch fewer balls.', goal: { stat: 'pd', n: 20, label: 'Career pass breakups' } },
  { id: 'hitstick', pos: 'CB', name: 'Hit Stick', icon: 'flame', desc: 'Big hits nearly twice as often, more forced fumbles.', goal: { stat: 'tackles', n: 80, label: 'Career tackles' } },
  { id: 'closing', pos: 'CB', name: 'Closing Speed', icon: 'bolt', desc: '+10% speed while the ball is in the air.', goal: { stat: 'games', n: 20, label: 'Career games' } },
  { id: 'jumper', pos: 'CB', name: 'Jumper', icon: 'target', desc: 'Break-up quick-time events are 40% easier.', goal: { stat: 'defInt', n: 3, label: 'Career interceptions' } },
  // ---------------- DT
  { id: 'bulldozer', pos: 'DT', name: 'Bulldozer', icon: 'dumbbell', desc: 'Bull rush wins 20% more.', goal: { stat: 'defSacks', n: 10, label: 'Career sacks' } },
  { id: 'swimclub', pos: 'DT', name: 'Swim Club', icon: 'bolt', desc: 'Rip and swim moves win 20% more.', goal: { stat: 'tfl', n: 15, label: 'Career tackles for loss' } },
  { id: 'motor', pos: 'DT', name: 'Relentless Motor', icon: 'flame', desc: 'Leverage builds 40% faster.', goal: { stat: 'tackles', n: 60, label: 'Career tackles' } },
  { id: 'batter', pos: 'DT', name: 'Batting Practice', icon: 'target', desc: 'Batting passes at the line is much easier.', goal: { stat: 'games', n: 20, label: 'Career games' } },
  { id: 'closer', pos: 'DT', name: 'Sack Artist', icon: 'star', desc: 'Your sack lunge reaches 30% farther.', goal: { stat: 'defSacks', n: 5, label: 'Career sacks' } },
  // ---------------- mascot
  { id: 'showman', pos: 'MS', name: 'Born Showman', icon: 'star', desc: 'Beat windows in Hype the Crowd are 30% bigger.', goal: { stat: 'hype', n: 400, label: 'Career crowd hype' } },
  { id: 'cannonarm', pos: 'MS', name: 'Cannon Arm', icon: 'target', desc: 'One extra T-shirt and bigger targets.', goal: { stat: 'shirts', n: 40, label: 'Career shirts landed' } },
  { id: 'smoothmoves', pos: 'MS', name: 'Smooth Moves', icon: 'bolt', desc: 'More time to answer in mascot showdowns.', goal: { stat: 'danceWins', n: 5, label: 'Career showdown wins' } },
  { id: 'acrobat', pos: 'MS', name: 'Acrobat', icon: 'flame', desc: 'The trampoline power zone is 40% bigger.', goal: { stat: 'stunts', n: 4, label: 'Career stunts landed' } },
  // ---------------- everyone
  { id: 'captain', pos: 'ANY', name: 'Team Captain', icon: 'crown', desc: 'Momentum swings your way 25% harder.', goal: { rel: 'teammates', n: 75, label: 'Teammate relationship' } },
  { id: 'clutchgene', pos: 'ANY', name: 'Clutch Gene', icon: 'trophy', desc: 'All quick-time events are 25% easier.', goal: { level: 8, label: 'Player level' } },
  { id: 'ironman', pos: 'ANY', name: 'Iron Man', icon: 'bandage', desc: 'Injuries from big hits are half as likely.', goal: { stat: 'games', n: 40, label: 'Career games' } },
];
export const TRAIT_BY_ID = Object.fromEntries(TRAITS.map((t) => [t.id, t]));
export const slotsForLevel = (lvl) => (lvl >= 10 ? 3 : lvl >= 5 ? 2 : 1);
