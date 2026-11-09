// Playbook for free-control plays. Positions in yards: x across the field, z downfield
// (negative = toward the end zone you attack). The line of scrimmage is z = 0.
//
// Pass routes are lists of [dx, dz] waypoints from the player's starting spot.
// Slots: X (wide left), Z (wide right), S (slot left), TE (tight end, right), RB.

export const OFF_FORMATION = {
  shotgun: { QB: [0, 5], RB: [-1.6, 5.2], X: [-12, 0.4], Z: [11, 0.4], S: [-6, 0.6], TE: [4.6, 0.9] },
  pistol: { QB: [0, 3.5], RB: [0, 6.5], X: [-12, 0.4], Z: [11, 0.4], S: [-6, 0.6], TE: [4.6, 0.9] },
};
export const OL_X = [-3.2, -1.6, 0, 1.6, 3.2];

export const PLAYS = {
  // ---------------- QB: pass concepts
  pass: {
    safe: [
      { name: 'Slants', desc: 'Quick throws inside. Get it out fast.', form: 'shotgun', routes: { X: [[0, -3], [5, -8]], Z: [[0, -3], [-5, -8]], S: [[0, -2], [4, -6]], TE: [[0, -4], [0, -3]], RB: [[3, -1]] } },
      { name: 'Quick Outs', desc: 'Short sideline throws. Low risk.', form: 'shotgun', routes: { X: [[0, -5], [-4, -5]], Z: [[0, -5], [4, -5]], S: [[0, -4], [-5, -4]], TE: [[0, -3], [3, -4]], RB: [[-4, -1]] } },
      { name: 'Curl Flat', desc: 'Receivers sit down in soft spots.', form: 'shotgun', routes: { X: [[0, -9], [1, -7]], Z: [[0, -9], [-1, -7]], S: [[0, -1], [-6, -2]], TE: [[0, -6], [-1, -5]], RB: [[4, -2]] } },
    ],
    balanced: [
      { name: 'Mesh', desc: 'Crossing routes rub off defenders.', form: 'shotgun', routes: { X: [[0, -4], [16, -6]], Z: [[0, -14]], S: [[0, -5], [-12, -6]], TE: [[0, -10], [-6, -12]], RB: [[3, -2]] } },
      { name: 'Smash', desc: 'Hitch underneath, corner over the top.', form: 'shotgun', routes: { X: [[0, -5], [0, -4]], Z: [[0, -10], [6, -18]], S: [[0, -10], [-7, -18]], TE: [[0, -6], [4, -8]], RB: [[-4, -1]] } },
      { name: 'Dig Seam', desc: 'Intermediate in-breakers and a seam.', form: 'shotgun', routes: { X: [[0, -11], [12, -12]], Z: [[0, -11], [-10, -12]], S: [[0, -18]], TE: [[0, -6], [3, -6]], RB: [[3, -1]] } },
    ],
    risky: [
      { name: 'Four Verticals', desc: 'Everyone goes deep. Find the open lane.', form: 'shotgun', routes: { X: [[0, -40]], Z: [[0, -40]], S: [[1, -40]], TE: [[-1, -35]], RB: [[4, -2]] } },
      { name: 'Post Corner', desc: 'Double moves to beat the safeties.', form: 'shotgun', routes: { X: [[0, -12], [4, -17], [-4, -28]], Z: [[0, -12], [-9, -30]], S: [[0, -10], [-8, -22]], TE: [[0, -8], [2, -8]], RB: [[-4, -2]] } },
      { name: 'Deep Cross', desc: 'Long crossers behind the linebackers.', form: 'shotgun', routes: { X: [[0, -8], [22, -20]], Z: [[0, -16], [-4, -20]], S: [[0, -30]], TE: [[0, -6], [-14, -10]], RB: [[3, -1]] } },
    ],
  },
  // ---------------- RB / QB designed runs. hole = x where the line opens; pitch = toss to the RB.
  run: {
    safe: [
      { name: 'Inside Zone', desc: 'Read the A and B gaps. Patience.', form: 'pistol', hole: [-1.2, 1.2] },
      { name: 'Dive', desc: 'Straight up the middle. Short, sure yards.', form: 'pistol', hole: [0, 0] },
      { name: 'Trap', desc: 'Let the tackle in, then hit the crease.', form: 'pistol', hole: [0.8, 0.8] },
    ],
    balanced: [
      { name: 'Power', desc: 'Guard pulls to lead you through the hole.', form: 'pistol', hole: [2.4, 2.4] },
      { name: 'Counter', desc: 'Fake one way, cut back the other.', form: 'pistol', hole: [-2.4, -2.4] },
      { name: 'Draw', desc: 'Looks like a pass. Catch them rushing.', form: 'shotgun', hole: [0, 1.6], draw: true },
    ],
    risky: [
      { name: 'Toss Sweep', desc: 'Pitch outside and race for the edge.', form: 'pistol', hole: [7, 9], pitch: true },
      { name: 'Stretch', desc: 'Run wide, plant, and cut upfield.', form: 'pistol', hole: [5, 6] },
      { name: 'Counter Pitch', desc: 'Toss to the weak side. Home run or loss.', form: 'pistol', hole: [-7, -9], pitch: true },
    ],
  },
  // ---------------- WR: your route (the rest of the team runs the concept)
  route: {
    safe: [
      { name: 'Slant', desc: 'Three steps and break inside.', route: [[0, -3], [-6, -9]] },
      { name: 'Hitch', desc: 'Five yards, turn around, ball is there.', route: [[0, -6], [0, -5]], sit: true },
      { name: 'Quick Out', desc: 'Five yards and out to the sideline.', route: [[0, -5], [6, -5]] },
    ],
    balanced: [
      { name: 'Dig', desc: 'Ten yards and break flat across the field.', route: [[0, -10], [-12, -11]] },
      { name: 'Curl', desc: 'Push deep, then settle back to the QB.', route: [[0, -12], [-1, -10]], sit: true },
      { name: 'Comeback', desc: 'Sell deep, snap back to the sideline.', route: [[0, -14], [3, -11]], sit: true },
    ],
    risky: [
      { name: 'Go', desc: 'Pure speed. Beat your man deep.', route: [[0, -40]] },
      { name: 'Post', desc: 'Break toward the goalposts.', route: [[0, -12], [-8, -28]] },
      { name: 'Corner', desc: 'Break toward the back pylon.', route: [[0, -12], [7, -24]] },
    ],
  },
  // ---------------- CB coverage calls
  cover: {
    safe: [
      { name: 'Cover 3', desc: 'You have the deep third. Nothing behind you.', coverage: 'zone', user: 'deep' },
      { name: 'Cover 2', desc: 'Squat on the flat. Safeties help deep.', coverage: 'zone', user: 'flat' },
      { name: 'Quarters', desc: 'Read the receiver: carry them if they go deep.', coverage: 'zone', user: 'deep' },
    ],
    balanced: [
      { name: 'Cover 1', desc: 'Man to man, one safety over the top.', coverage: 'man', user: 'man' },
      { name: 'Cover 2 Man', desc: 'Man under, two safeties deep. Play tight.', coverage: 'man', user: 'man', twoDeep: true },
      { name: 'Robber', desc: 'Man coverage with a lurker underneath.', coverage: 'man', user: 'man' },
    ],
    risky: [
      { name: 'Press Man', desc: 'Jam at the line. Win or get beat deep.', coverage: 'man', user: 'man', press: true },
      { name: 'Cover 0 Blitz', desc: 'Everyone rushes. No help behind you.', coverage: 'man', user: 'man', blitz: true, press: true },
      { name: 'Corner Blitz', desc: 'YOU blitz the quarterback!', coverage: 'man', user: 'blitz', blitz: true },
    ],
  },
  // ---------------- CB vs the run (open-field tackle moments)
  runD: {
    safe: [{ name: 'Contain', desc: 'Keep outside leverage. Force it back inside.' }, { name: 'Read Run', desc: 'Read the play, then fly downhill.' }, { name: 'Cover 3 Sky', desc: 'Help underneath, rally to the ball.' }],
    balanced: [{ name: 'Fill', desc: 'Attack the alley and make the tackle.' }, { name: 'Scrape', desc: 'Flow to the ball and wrap up.' }, { name: 'Cloud', desc: 'Squeeze the edge.' }],
    risky: [{ name: 'Fire Zone', desc: 'Blitz off the edge into the backfield!' }, { name: 'Run Blitz', desc: 'Shoot the gap. Big hit or big gain.' }, { name: 'Cat Blitz', desc: 'Come off the slot at full speed.' }],
  },
};

/** Which playbook a moment type uses. */
export function playMode(type) {
  if (type === 'qb_throw' || type === 'qb_hailmary') return 'pass';
  if (type === 'rb_run' || type === 'qb_scramble' || type === 'rb_screen') return 'run';
  if (type.startsWith('wr_')) return 'route';
  if (type === 'cb_cover') return 'cover';
  if (type === 'cb_tackle') return 'runD';
  if (type === 'dt_rush') return 'rush';
  if (type === 'dt_run') return 'runStop';
  return null;
}

// ---------------- extra plays: each snap shows 3 random plays from the pool for your call.
const MORE = {
  pass: {
    safe: [
      { name: 'Stick', desc: 'TE sits at 6, slot runs to the flat.', form: 'shotgun', routes: { X: [[0, -3], [5, -8]], Z: [[0, -12]], S: [[0, -1], [-6, -2]], TE: [[0, -6], [0, -5]], RB: [[4, -1]] } },
      { name: 'Spacing', desc: 'Everyone hitches at 5. Pick the soft spot.', form: 'shotgun', routes: { X: [[0, -6], [0, -5]], Z: [[0, -6], [0, -5]], S: [[0, -6], [0, -5]], TE: [[0, -5], [0, -4]], RB: [[3, -2]] } },
      { name: 'Bubble Screen', desc: 'Throw it to the slot behind the line.', form: 'shotgun', routes: { X: [[0, -6]], Z: [[0, -8], [-3, -8]], S: [[-3, 1], [-6, 0.5]], TE: [[0, -4]], RB: [[3, -1]] } },
      { name: 'Levels', desc: 'In-breakers at 5 and 10 yards.', form: 'shotgun', routes: { X: [[0, -5], [8, -5]], Z: [[0, -10], [-9, -10]], S: [[0, -10], [7, -10]], TE: [[0, -4], [-4, -4]], RB: [[-3, -1]] } },
      { name: 'Drive', desc: 'Shallow cross with a dig behind it.', form: 'shotgun', routes: { X: [[0, -2], [18, -3]], Z: [[0, -11], [-10, -12]], S: [[0, -6], [0, -5]], TE: [[0, -6], [4, -7]], RB: [[4, -1]] } },
      { name: 'Y-Option', desc: 'Tight end wins inside or out.', form: 'shotgun', routes: { X: [[0, -14]], Z: [[0, -14]], S: [[0, -3], [-4, -3]], TE: [[0, -6], [-2, -6]], RB: [[-3, -1]] } },
    ],
    balanced: [
      { name: 'Flood', desc: 'Three levels to one sideline.', form: 'shotgun', routes: { X: [[0, -20]], Z: [[0, -18], [4, -24]], S: [[0, -9], [9, -11]], TE: [[0, -2], [8, -3]], RB: [[4, -1]] } },
      { name: 'Shallow Cross', desc: 'Drag under, dig over.', form: 'shotgun', routes: { X: [[0, -2], [20, -3]], Z: [[0, -12], [-10, -13]], S: [[0, -16]], TE: [[0, -7], [-3, -7]], RB: [[3, -2]] } },
      { name: 'Snag', desc: 'Triangle read: corner, snag, flat.', form: 'shotgun', routes: { X: [[0, -10], [-6, -18]], Z: [[0, -5], [-2, -5]], S: [[0, -1], [-6, -2]], TE: [[0, -10], [5, -16]], RB: [[3, -1]] } },
      { name: 'Sail', desc: 'Go, out, and flat stacked on one side.', form: 'shotgun', routes: { X: [[0, -30]], Z: [[0, -12], [6, -12]], S: [[0, -1], [-6, -1]], TE: [[0, -12], [7, -13]], RB: [[-4, -1]] } },
      { name: 'Spot', desc: 'Curl, corner and flat all at once.', form: 'shotgun', routes: { X: [[0, -7], [1, -6]], Z: [[0, -10], [6, -18]], S: [[0, -9], [-2, -8]], TE: [[0, -1], [6, -2]], RB: [[3, -1]] } },
    ],
    risky: [
      { name: 'Sluggo', desc: 'Fake the slant, then go long.', form: 'shotgun', routes: { X: [[0, -4], [3, -6], [3, -36]], Z: [[0, -4], [-3, -6], [-3, -36]], S: [[0, -10], [-4, -12]], TE: [[0, -6]], RB: [[3, -1]] } },
      { name: 'Mills', desc: 'Post over a dig. Safeties must choose.', form: 'shotgun', routes: { X: [[0, -12], [12, -13]], Z: [[0, -12], [-7, -30]], S: [[0, -14], [8, -28]], TE: [[0, -6]], RB: [[-3, -1]] } },
      { name: 'Wheel', desc: 'Running back wheels up the sideline.', form: 'shotgun', routes: { X: [[0, -12], [10, -14]], Z: [[0, -10], [-6, -10]], S: [[0, -18]], TE: [[0, -8]], RB: [[-8, -1], [-10, -30]] } },
      { name: 'Yankee', desc: 'Play-action deep cross with a post.', form: 'shotgun', routes: { X: [[0, -14], [-3, -32]], Z: [[0, -10], [-22, -24]], S: [[0, -8]], TE: [[0, -6], [4, -6]], RB: [[3, -1]] } },
      { name: 'Seam Bender', desc: 'Slot splits the safeties.', form: 'shotgun', routes: { X: [[0, -22]], Z: [[0, -22]], S: [[0, -16], [3, -34]], TE: [[0, -16], [-3, -34]], RB: [[3, -2]] } },
    ],
  },
  run: {
    safe: [
      { name: 'Iso', desc: 'Fullback leads straight ahead.', form: 'pistol', hole: [-0.6, -0.6] },
      { name: 'Zone Read', desc: 'Find the cutback lane.', form: 'pistol', hole: [-0.8, 0.8] },
      { name: 'Wham', desc: 'The TE kicks out the tackle. Hit it inside.', form: 'pistol', hole: [1.4, 1.4] },
    ],
    balanced: [
      { name: 'Outside Zone', desc: 'Stretch to the C gap, then cut.', form: 'pistol', hole: [3.6, 4.4] },
      { name: 'Split Zone', desc: 'Backside cut behind a crossing TE.', form: 'pistol', hole: [-1.8, -1.8] },
      { name: 'Duo', desc: 'Double teams up front. Read the linebacker.', form: 'pistol', hole: [1.6, 0.6] },
    ],
    risky: [
      { name: 'Jet Sweep', desc: 'Fly around the edge at full speed.', form: 'pistol', hole: [9, 11], pitch: true },
      { name: 'Pin Pull', desc: 'Linemen pull and lead you outside.', form: 'pistol', hole: [5.5, 7] },
      { name: 'Reverse', desc: 'Everyone flows right... you go left.', form: 'pistol', hole: [-8, -10], pitch: true },
    ],
  },
  route: {
    safe: [
      { name: 'Drag', desc: 'Shallow across the field under the linebackers.', route: [[0, -2], [-14, -3]] },
      { name: 'Whip', desc: 'Fake in, whip back out.', route: [[0, -4], [-3, -5], [3, -5]] },
      { name: 'Flat', desc: 'Quick release to the flat.', route: [[0, -1], [6, -2]] },
      { name: 'Stick', desc: 'Six yards and sit in the window.', route: [[0, -6], [-1, -6]], sit: true },
    ],
    balanced: [
      { name: 'Deep Out', desc: 'Twelve yards and snap to the sideline.', route: [[0, -12], [7, -12]] },
      { name: 'Square In', desc: 'Eight yards and cut flat inside.', route: [[0, -8], [-10, -9]] },
      { name: 'Option', desc: 'Read your man: break in or out at 7.', route: [[0, -7], [-4, -7]], sit: true },
      { name: 'Skinny Post', desc: 'Sharp slant at depth.', route: [[0, -9], [-4, -20]] },
    ],
    risky: [
      { name: 'Fade', desc: 'Outside release, ball over the shoulder.', route: [[2, -35]] },
      { name: 'Double Move', desc: 'Hitch fake... then GO.', route: [[0, -6], [0, -5], [1, -34]] },
      { name: 'Seam', desc: 'Slide inside and race up the seam.', route: [[-4, -2], [-4, -36]] },
      { name: 'Post Corner', desc: 'Sell the post, break to the corner.', route: [[0, -12], [-4, -17], [6, -28]] },
    ],
  },
  cover: {
    safe: [
      { name: 'Tampa 2', desc: 'Sit in the flat, LB carries the middle.', coverage: 'zone', user: 'flat' },
      { name: 'Cover 6', desc: 'Quarter on your side. Stay deep.', coverage: 'zone', user: 'deep' },
      { name: 'Soft Squat', desc: 'Give the short stuff, make the tackle.', coverage: 'zone', user: 'flat' },
    ],
    balanced: [
      { name: 'Bracket', desc: 'Man coverage with help over the top.', coverage: 'man', user: 'man', twoDeep: true },
      { name: 'Banjo', desc: 'Switch on crossers. Talk to the safety.', coverage: 'man', user: 'man' },
      { name: 'Cover 3 Match', desc: 'Match routes in zone. Play it like man.', coverage: 'man', user: 'man' },
    ],
    risky: [
      { name: 'Zero Press', desc: 'Press with no safety. All or nothing.', coverage: 'man', user: 'man', press: true, blitz: true },
      { name: 'Nickel Fire', desc: 'Slot blitz, you lock your man.', coverage: 'man', user: 'man', blitz: true },
      { name: 'Corner Fire', desc: 'Off the edge after the QB!', coverage: 'man', user: 'blitz', blitz: true },
    ],
  },
  runD: {
    safe: [{ name: 'Spill', desc: 'Push the runner sideways to help.' }, { name: 'Rally', desc: 'Stay home, then swarm.' }],
    balanced: [{ name: 'Squeeze', desc: 'Close the cutback lane.' }, { name: 'Force', desc: 'Set the edge hard.' }],
    risky: [{ name: 'Sting Blitz', desc: 'Off the edge before the snap count.' }, { name: 'Edge Crash', desc: 'Crash the backfield. Boom or bust.' }],
  },
};
// ---------------- DT: pass rush and run stopping
PLAYS.rush = {
  safe: [
    { name: 'Two-Gap', desc: 'Stack the blocker, keep the QB in the pocket.' },
    { name: 'Contain Rush', desc: 'Rush under control. Don\'t let him escape.' },
    { name: 'Read & React', desc: 'Feel the play, then go get him.' },
    { name: 'Bull & Hold', desc: 'Push the pocket straight back.' },
  ],
  balanced: [
    { name: 'Speed Rush', desc: 'Win off the snap with quickness.' },
    { name: 'Long Arm', desc: 'Lock out the blocker, then shed.' },
    { name: 'Stunt', desc: 'Loop around your teammate on the snap.' },
    { name: 'Swim Set', desc: 'Set up the swim move early.' },
  ],
  risky: [
    { name: 'Overload Blitz', desc: 'Linebackers come too. Get home fast!', blitz: true },
    { name: 'Twist', desc: 'Cross with the end. Confuse the line.', blitz: true },
    { name: 'All-Out Rush', desc: 'Everyone pins their ears back.', blitz: true },
  ],
};
PLAYS.runStop = {
  safe: [{ name: 'Anchor', desc: 'Hold your gap. Don\'t get moved.' }, { name: 'Two-Gap Hold', desc: 'Control the blocker, find the ball.' }, { name: 'Squeeze', desc: 'Close the hole from the inside.' }],
  balanced: [{ name: 'Slant', desc: 'Angle into the next gap at the snap.' }, { name: 'Pinch', desc: 'Crash inside and plug the middle.' }, { name: 'Spill', desc: 'Force the runner to bounce outside.' }],
  risky: [{ name: 'Penetrate', desc: 'Shoot the gap. Tackle for loss or nothing.' }, { name: 'Run Blitz', desc: 'Linebackers fill behind you.', blitz: true }, { name: 'Stem & Shoot', desc: 'Shift late and knife through.' }],
};

for (const [mode, calls] of Object.entries(MORE)) for (const [call, list] of Object.entries(calls)) PLAYS[mode][call].push(...list);

/** Three random plays for this snap (from the pool for your play call). */
export function dealPlays(mode, call) {
  const pool = PLAYS[mode][call].slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, 3);
}
