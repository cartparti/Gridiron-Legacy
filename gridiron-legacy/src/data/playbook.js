// Playbook for free-control plays. Positions in yards: x across the field, z downfield
// (negative = toward the end zone you attack). The line of scrimmage is z = 0.
//
// Pass routes are lists of [dx, dz] waypoints from the player's starting spot.
// Slots: X (wide left), Z (wide right), S (slot left), TE (tight end, right), RB.

export const OFF_FORMATION = {
  shotgun: { QB: [0, 5], RB: [-1.6, 5.2], X: [-12, 0.4], Z: [11, 0.4], S: [-6, 0.6], TE: [4.6, 0.9] },
  pistol: { QB: [0, 3.5], RB: [0, 6.5], X: [-12, 0.4], Z: [11, 0.4], S: [-6, 0.6], TE: [4.6, 0.9] },
  // under centre: for when you're backed up against your own goal line
  under: { QB: [0, 1.2], RB: [0, 4.4], X: [-12, 0.4], Z: [11, 0.4], S: [-6, 0.6], TE: [4.6, 0.9] },
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

// ---------------- big playbook: route library + many more concepts for every position
// Routes are written for a receiver on the LEFT (inside = +x); `mir` flips them for the right side.
const R = {
  slant: [[0, -3], [5, -8]], out5: [[0, -5], [-4, -5]], hitch: [[0, -6], [0, -5]], curl: [[0, -10], [1, -8]], dig: [[0, -11], [11, -12]],
  post: [[0, -12], [7, -26]], corner: [[0, -11], [-5, -22]], go: [[0, -40]], fade: [[-2, -14], [-2, -36]], comeback: [[0, -14], [-3, -11]],
  drag: [[0, -2], [14, -4]], cross: [[0, -6], [18, -14]], seam: [[0, -30]], wheel: [[-4, -2], [-5, -22]], flat: [[-5, -2]],
  whip: [[3, -4], [-3, -5]], out10: [[0, -10], [-5, -10]], stickNod: [[0, -6], [1, -6], [0, -22]], sluggo: [[0, -3], [3, -6], [2, -30]],
  spot: [[3, -5], [3, -4]], over: [[0, -8], [20, -18]], sail: [[0, -12], [-5, -17]], pivot: [[4, -5], [-3, -6]], skinny: [[0, -10], [3, -24]],
};
const RBR = { flatL: [[-5, -1]], flatR: [[5, -1]], angle: [[3, -2], [-2, -6]], swing: [[6, 0], [8, -4]], check: [[0, -3]], wheelR: [[5, -1], [7, -18]], swingL: [[-6, 0], [-8, -4]] };
const mir = (r) => r.map(([x, z]) => [-x, z]);
/** concept('Name', 'desc', 'X route', 'Z route', 'S route', 'TE route', 'RB route') */
const concept = (name, desc, x, z, sl, te, rb) => ({ name, desc, form: 'shotgun', routes: { X: R[x], Z: mir(R[z]), S: R[sl], TE: mir(R[te]), RB: RBR[rb] } });
const BIG = {
  pass: {
    safe: [
      concept('Stick', 'Tight end sits at the sticks. Easy read.', 'hitch', 'out5', 'flat', 'spot', 'check'),
      concept('Spacing', 'Five short targets spread across the field.', 'spot', 'hitch', 'hitch', 'flat', 'flatL'),
      concept('Drive', 'Shallow drag with a dig behind it.', 'drag', 'curl', 'dig', 'flat', 'check'),
      concept('Snag', 'Corner, spot and flat on one side.', 'spot', 'hitch', 'corner', 'flat', 'flatL'),
      concept('Arrow Quick', 'Slants outside, arrows underneath.', 'slant', 'slant', 'flat', 'flat', 'check'),
      concept('Double Hitch', 'Both outside receivers turn around at 5.', 'hitch', 'hitch', 'out5', 'spot', 'swing'),
      concept('Texas', 'Back angles inside under the coverage.', 'curl', 'out5', 'out5', 'curl', 'angle'),
      concept('Whip Flat', 'Whip routes freeze the corners.', 'whip', 'whip', 'flat', 'hitch', 'flatR'),
      concept('Tosser', 'Double slants to one side.', 'slant', 'out5', 'slant', 'flat', 'swing'),
      concept('Bench', 'Both outside receivers break to the sideline.', 'out5', 'out5', 'hitch', 'spot', 'check'),
    ],
    balanced: [
      concept('Levels', 'In-breakers at two depths.', 'dig', 'curl', 'drag', 'dig', 'flatR'),
      concept('Flood', 'Three receivers flood one sideline.', 'go', 'sail', 'out10', 'flat', 'flatL'),
      concept('Y-Cross', 'Tight end crosses the whole field.', 'curl', 'post', 'out5', 'cross', 'swing'),
      concept('Shallow Cross', 'Drag underneath, dig over the top.', 'drag', 'dig', 'dig', 'drag', 'check'),
      concept('Curls', 'Everyone curls at ten yards.', 'curl', 'curl', 'curl', 'curl', 'flatR'),
      concept('Scissors', 'Post and corner cross each other.', 'post', 'curl', 'corner', 'flat', 'check'),
      concept('China', 'Quick ins with a corner behind.', 'spot', 'corner', 'corner', 'spot', 'flatL'),
      concept('Drive Sail', 'Sail route over a drag.', 'drag', 'sail', 'out10', 'dig', 'swing'),
      concept('Bow', 'Dig behind a pivot route.', 'dig', 'pivot', 'pivot', 'dig', 'check'),
      concept('Comebacks', 'Outside comebacks, seams inside.', 'comeback', 'comeback', 'seam', 'curl', 'flatR'),
      concept('Wheel Mesh', 'Back wheels out of the mesh.', 'drag', 'curl', 'dig', 'drag', 'wheelR'),
      concept('Stick Nod', 'Fake the stick, go up the seam.', 'hitch', 'out5', 'stickNod', 'spot', 'flatL'),
    ],
    risky: [
      concept('Dagger', 'Seam clears it out, dig behind.', 'dig', 'go', 'seam', 'drag', 'check'),
      concept('Mills', 'Post over a dig. Beat the safety.', 'post', 'dig', 'dig', 'post', 'flatR'),
      concept('Sluggo Seam', 'Slant-and-go with a seam inside.', 'sluggo', 'go', 'seam', 'curl', 'check'),
      concept('Yankee', 'Deep post and a deep over.', 'post', 'over', 'flat', 'curl', 'check'),
      concept('Fade Seams', 'Fades outside, seams inside.', 'fade', 'fade', 'seam', 'seam', 'swing'),
      concept('Double Post', 'Two posts split the safeties.', 'post', 'post', 'skinny', 'flat', 'flatL'),
      concept('Switch Verts', 'Receivers cross, then go deep.', 'skinny', 'go', 'wheel', 'seam', 'check'),
      concept('Wheel Post', 'Post inside, wheel up the sideline.', 'post', 'go', 'wheel', 'curl', 'wheelR'),
      concept('Corner Strike', 'Corners outside, post in the middle.', 'corner', 'corner', 'post', 'flat', 'check'),
      concept('Deep Sail', 'Go, deep sail and a flat. Take your shot.', 'go', 'go', 'sail', 'out10', 'flatL'),
    ],
  },
  run: {
    safe: [
      { name: 'Duo', desc: 'Double teams up front. Downhill.', form: 'pistol', hole: [-0.8, -0.8] },
      { name: 'Wham', desc: 'Tight end traps the tackle.', form: 'pistol', hole: [1.6, 1.6] },
      { name: 'Iso', desc: 'Lead blocker on the linebacker.', form: 'pistol', hole: [-1.6, -1.6] },
      { name: 'Lead', desc: 'Follow your blocker through the A gap.', form: 'pistol', hole: [0.8, 0.8] },
      { name: 'Blast', desc: 'Quick hitter before they react.', form: 'pistol', hole: [0, 0.8] },
      { name: 'Zone Weak', desc: 'Inside zone to the weak side.', form: 'pistol', hole: [-2.4, -1.2] },
      { name: 'Belly', desc: 'Ride the fake, hit the B gap.', form: 'pistol', hole: [2, 2] },
    ],
    balanced: [
      { name: 'Power Weak', desc: 'Pull the guard to the left.', form: 'pistol', hole: [-2.4, -2.4] },
      { name: 'Counter Trey', desc: 'Two pullers. Wait for it.', form: 'pistol', hole: [2.4, 3.2] },
      { name: 'Off Tackle', desc: 'Outside the tackle, inside the end.', form: 'pistol', hole: [3.2, 4] },
      { name: 'Split Zone', desc: 'Tight end cuts off the back side.', form: 'pistol', hole: [-1.2, 2.4] },
      { name: 'Pin & Pull', desc: 'Pin the end, pull around him.', form: 'pistol', hole: [4, 5] },
      { name: 'Cutback', desc: 'Start right, cut back left.', form: 'pistol', hole: [-3.2, -1.6] },
      { name: 'Lead Draw', desc: 'Drop back look, then a lead block.', form: 'shotgun', hole: [-1.6, 0], draw: true },
      { name: 'Delay', desc: 'Let the rush fly by, then go.', form: 'shotgun', hole: [0.8, 2.4], draw: true },
    ],
    risky: [
      { name: 'Outside Zone', desc: 'Stretch it to the sideline.', form: 'pistol', hole: [5, 7] },
      { name: 'Stretch Weak', desc: 'Wide to the left, one cut.', form: 'pistol', hole: [-5, -6] },
      { name: 'Crack Toss', desc: 'Receivers crack down, you get the edge.', form: 'pistol', hole: [8, 10], pitch: true },
      { name: 'Speed Sweep', desc: 'Full speed to the weak side.', form: 'pistol', hole: [-8, -10], pitch: true },
      { name: 'Bounce', desc: 'Press inside, bounce it outside.', form: 'pistol', hole: [4.5, 6] },
      { name: 'Quick Pitch', desc: 'Pitch at the snap. Race the edge.', form: 'pistol', hole: [6, 8], pitch: true },
      { name: 'Naked Toss', desc: 'No lead blocker. All you.', form: 'pistol', hole: [-6, -8], pitch: true },
    ],
  },
  // WR routes for the user (lined up on the right: inside = -x)
  route: {
    safe: [
      { name: 'Drag', desc: 'Shallow across the field.', route: [[0, -2], [-14, -4]] },
      { name: 'Speed Out', desc: 'Round it off to the sideline.', route: [[0, -4], [7, -5]] },
      { name: 'Stick', desc: 'Sit down at six yards.', route: [[0, -6], [1, -6]], sit: true },
      { name: 'Whip', desc: 'Fake inside, whip back out.', route: [[-3, -4], [4, -5]] },
      { name: 'Arrow', desc: 'Straight to the flat.', route: [[5, -3]] },
      { name: 'Spot', desc: 'Find the soft spot inside and sit.', route: [[-3, -5], [-3, -4]], sit: true },
      { name: 'Shallow Cross', desc: 'Run away from your man across the middle.', route: [[0, -3], [-18, -6]] },
      { name: 'Quick Fade', desc: 'Short fade to the back shoulder.', route: [[2, -10], [2, -16]] },
    ],
    balanced: [
      { name: 'Out', desc: 'Ten yards and out.', route: [[0, -10], [6, -10]] },
      { name: 'Deep Curl', desc: 'Fifteen yards, then come back.', route: [[0, -15], [-1, -13]], sit: true },
      { name: 'Skinny Post', desc: 'A narrow post between defenders.', route: [[0, -10], [-3, -22]] },
      { name: 'Over', desc: 'Deep crossing route.', route: [[0, -6], [-18, -16]] },
      { name: 'Back Shoulder', desc: 'Stop and turn for the back-shoulder ball.', route: [[1, -13], [2, -12]], sit: true },
      { name: 'Sail', desc: 'Break to the sideline at 12.', route: [[0, -12], [6, -17]] },
      { name: 'Dagger', desc: 'Deep dig at 14.', route: [[0, -14], [-10, -17]] },
      { name: 'Option', desc: 'Read the corner and sit.', route: [[0, -7], [-3, -8]], sit: true },
      { name: 'Pivot', desc: 'Start in, pivot back out.', route: [[-4, -5], [3, -6]] },
      { name: 'Deep Out', desc: 'Fourteen and out. Needs a strong arm.', route: [[0, -14], [6, -14]] },
    ],
    risky: [
      { name: 'Fade', desc: 'Up the sideline. Win the jump ball.', route: [[2, -14], [2, -38]] },
      { name: 'Stop & Go', desc: 'Fake the hitch, then fly.', route: [[0, -6], [0, -5], [0, -36]] },
      { name: 'Sluggo', desc: 'Slant, then go.', route: [[0, -3], [-3, -6], [-2, -34]] },
      { name: 'Post Corner', desc: 'Fake the post, break to the corner.', route: [[0, -12], [-4, -17], [5, -30]] },
      { name: 'Deep Over', desc: 'All the way across, deep.', route: [[0, -10], [-22, -24]] },
      { name: 'Seam', desc: 'Straight up the seam.', route: [[-1, -36]] },
      { name: 'Out & Up', desc: 'Fake the out, turn it up.', route: [[0, -6], [4, -7], [5, -30]] },
      { name: 'Dino Post', desc: 'Fake the corner, break to the post.', route: [[0, -12], [3, -16], [-7, -30]] },
    ],
  },
  cover: {
    safe: [
      { name: 'Tampa 2', desc: 'Sink under the flat, eyes on the QB.', coverage: 'zone', user: 'flat' },
      { name: 'Cover 6', desc: 'Quarter-quarter-half. You take deep.', coverage: 'zone', user: 'deep' },
      { name: 'Palms', desc: 'Trap the out route in the flat.', coverage: 'zone', user: 'flat' },
      { name: 'Match 3', desc: 'Zone that turns into man deep.', coverage: 'zone', user: 'deep' },
      { name: 'Cloud', desc: 'Roll up to the flat.', coverage: 'zone', user: 'flat' },
      { name: 'Prevent', desc: 'Keep everything in front of you.', coverage: 'zone', user: 'deep' },
    ],
    balanced: [
      { name: 'Man Free', desc: 'Lock your man. Help in the middle.', coverage: 'man', user: 'man' },
      { name: 'Trail', desc: 'Trail underneath with safety help.', coverage: 'man', user: 'man', twoDeep: true },
      { name: 'Off Man', desc: 'Give a cushion, break on the ball.', coverage: 'man', user: 'man' },
      { name: 'Inside Leverage', desc: 'Take away the slant.', coverage: 'man', user: 'man' },
      { name: 'Combo', desc: 'Man with a zone eye.', coverage: 'man', user: 'man', twoDeep: true },
      { name: 'Banjo', desc: 'Switch on crossing routes.', coverage: 'man', user: 'man' },
    ],
    risky: [
      { name: 'Jam & Trail', desc: 'Jam him, then chase.', coverage: 'man', user: 'man', press: true },
      { name: 'Zero Press', desc: 'No help. Win at the line.', coverage: 'man', user: 'man', blitz: true, press: true },
      { name: 'Nickel Fire', desc: 'You come off the edge!', coverage: 'man', user: 'blitz', blitz: true },
      { name: 'Bail Press', desc: 'Show press, bail at the snap.', coverage: 'man', user: 'man', press: true },
      { name: 'Jump the Route', desc: 'Sit on it. Pick six or burned.', coverage: 'man', user: 'man', press: true },
      { name: 'Edge Dog', desc: 'Blitz the QB from the boundary!', coverage: 'man', user: 'blitz', blitz: true },
    ],
  },
  runD: {
    safe: [{ name: 'Box', desc: 'Turn everything back inside.' }, { name: 'Stay Home', desc: 'Watch for the cutback.' }, { name: 'Soft Edge', desc: 'Give ground, make the sure tackle.' }, { name: 'Leverage', desc: 'Keep your outside arm free.' }, { name: 'Trail Run', desc: 'Follow from the back side.' }],
    balanced: [{ name: 'Alley', desc: 'Fill the alley fast.' }, { name: 'Crack Replace', desc: 'Replace the cracked defender.' }, { name: 'Wrap Up', desc: 'Break down and wrap.' }, { name: 'Downhill', desc: 'Trigger on the handoff.' }, { name: 'Hammer', desc: 'Set a hard edge.' }],
    risky: [{ name: 'Corner Cat', desc: 'Blitz off the corner into the backfield!' }, { name: 'Shoot It', desc: 'Guess the gap and go.' }, { name: 'Strip Attempt', desc: 'Go for the ball, not the man.' }, { name: 'Smoke', desc: 'Come untouched off the edge.' }, { name: 'Blow It Up', desc: 'Meet him at the handoff.' }],
  },
};
PLAYS.rush.safe.push({ name: 'Mush Rush', desc: 'Collapse the pocket slowly.' }, { name: 'Spy', desc: 'Mirror the QB. Don\'t let him run.' }, { name: 'Power Step', desc: 'Short, heavy steps. Stay square.' }, { name: 'Hands Up', desc: 'Get in the passing lane.' }, { name: 'Squeeze Rush', desc: 'Shrink the pocket from the inside.' });
PLAYS.rush.balanced.push({ name: 'Club Rip', desc: 'Club his arm, rip through.' }, { name: 'Push Pull', desc: 'Jolt him back, yank him forward.' }, { name: 'Arm Over', desc: 'Quick arm-over at the snap.' }, { name: 'Spin Counter', desc: 'Inside spin when he oversets.' }, { name: 'Hump Move', desc: 'Throw him with his own weight.' }, { name: 'Jab Swim', desc: 'Jab step, then swim.' });
PLAYS.rush.risky.push({ name: 'Jet Rush', desc: 'Guess the count. First step wins.', blitz: true }, { name: 'Pirate Stunt', desc: 'Whole line slants one way.', blitz: true }, { name: 'Mike Fire', desc: 'Middle linebacker comes with you.', blitz: true }, { name: 'Zero Rush', desc: 'Send the house.', blitz: true }, { name: 'Loop Game', desc: 'Loop around the tackle.', blitz: true });
PLAYS.runStop.safe.push({ name: 'Stack', desc: 'Stack him up at the line.' }, { name: 'Sit & Read', desc: 'Stay square, read the back.' }, { name: 'Heavy Hands', desc: 'Lock out and wait.' }, { name: 'Wall', desc: 'Build a wall in the A gap.' });
PLAYS.runStop.balanced.push({ name: 'Cross Face', desc: 'Get across the blocker\'s face.' }, { name: 'Gap Exchange', desc: 'Trade gaps with the linebacker.' }, { name: 'Rip Under', desc: 'Rip under the block.' }, { name: 'Shed & Tackle', desc: 'Throw him off and hit.' }, { name: 'Chase', desc: 'Run it down from behind.' });
PLAYS.runStop.risky.push({ name: 'Gap Shoot', desc: 'Dive through at the snap.' }, { name: 'Backdoor', desc: 'Go around the block.' }, { name: 'Jet Stunt', desc: 'Up the field as fast as you can.', blitz: true }, { name: 'Swim Shoot', desc: 'Swim and knife into the backfield.' }, { name: 'Sell Out', desc: 'All or nothing in the backfield.', blitz: true });
for (const [mode, calls] of Object.entries(BIG)) for (const [call, list] of Object.entries(calls)) {
  const have = new Set(PLAYS[mode][call].map((x) => x.name));
  for (const pl of list) if (!have.has(pl.name)) PLAYS[mode][call].push(pl);
}

// ---------------- v0.55: even more plays for every position (each snap now offers five)
const EXTRA = {
  pass: {
    safe: [
      concept('Quick Game', 'Hitch, slant, flat. Ball out in two seconds.', 'hitch', 'slant', 'flat', 'spot', 'check'),
      concept('All Hitch', 'Everyone turns around at five.', 'hitch', 'hitch', 'spot', 'hitch', 'flatR'),
      concept('Slant Flat', 'The oldest combo in football.', 'slant', 'slant', 'flat', 'flat', 'swing'),
      concept('Ohio', 'Out and up outside, spot inside.', 'out5', 'out5', 'spot', 'drag', 'check'),
      concept('Pivot Flat', 'Pivot routes with a flat underneath.', 'pivot', 'hitch', 'flat', 'pivot', 'flatL'),
      concept('Quick Drag', 'Shallow drags rub off each other.', 'drag', 'slant', 'drag', 'spot', 'check'),
    ],
    balanced: [
      concept('Dig Drag', 'A dig over a drag. Read the linebacker.', 'dig', 'drag', 'curl', 'dig', 'flatR'),
      concept('Sail Flat', 'High-low on the sideline.', 'sail', 'curl', 'flat', 'out10', 'flatL'),
      concept('Skinny Curl', 'Skinny post with curls under it.', 'skinny', 'curl', 'curl', 'drag', 'check'),
      concept('Out Seam', 'Ten-yard outs, seam down the middle.', 'out10', 'out10', 'seam', 'curl', 'swing'),
      concept('Hi-Lo Cross', 'Two crossers at different depths.', 'cross', 'curl', 'drag', 'cross', 'check'),
      concept('Pivot Dagger', 'Pivot underneath, dig behind it.', 'pivot', 'dig', 'seam', 'pivot', 'flatR'),
    ],
    risky: [
      concept('Bomb Squad', 'Two go routes and a deep over.', 'go', 'go', 'over', 'seam', 'check'),
      concept('Stick Nod', 'Fake the stick, then go deep.', 'stickNod', 'curl', 'stickNod', 'flat', 'check'),
      concept('Post Wheel', 'Post inside, the back wheels outside.', 'post', 'dig', 'post', 'curl', 'wheelR'),
      concept('Corner Post', 'Corner on one side, post on the other.', 'corner', 'post', 'seam', 'drag', 'flatL'),
      concept('Max Verts', 'Max protection, three deep shots.', 'go', 'fade', 'seam', 'hitch', 'check'),
      concept('Sluggo Corner', 'Slant-and-go with a corner behind.', 'sluggo', 'corner', 'corner', 'curl', 'swing'),
    ],
  },
  run: {
    safe: [
      { name: 'Wedge', desc: 'Everyone blocks inward. Follow the wedge.', form: 'pistol', hole: [0.2, 0.2] },
      { name: 'Inside Trap', desc: 'Let the tackle in, kick him out.', form: 'pistol', hole: [-1, -1] },
      { name: 'Hammer', desc: 'Short, quick hit off the guard.', form: 'pistol', hole: [1.2, 0.4] },
      { name: 'Slam', desc: 'Straight downhill behind the center.', form: 'pistol', hole: [-0.4, 0.4] },
    ],
    balanced: [
      { name: 'Power Read', desc: 'Pull the guard and read the end.', form: 'pistol', hole: [2.8, 3.2] },
      { name: 'Buck Sweep', desc: 'Both guards pull outside.', form: 'pistol', hole: [4, 5.2] },
      { name: 'Weak Draw', desc: 'Fake the pass, hit the weak side.', form: 'shotgun', hole: [-1.6, -0.8], draw: true },
      { name: 'Counter Bash', desc: 'Back goes away from the guard.', form: 'pistol', hole: [-3.2, -2.4] },
    ],
    risky: [
      { name: 'Option Pitch', desc: 'Pitched at the last moment. Turn the corner.', form: 'pistol', hole: [7, 9.5], pitch: true },
      { name: 'Wide Zone Weak', desc: 'All the way to the weak sideline.', form: 'pistol', hole: [-6, -7.5] },
      { name: 'Rocket Toss', desc: 'Motion and toss. Pure speed.', form: 'pistol', hole: [9, 11], pitch: true },
      { name: 'Bootleg Keep', desc: 'Fake it inside, bend it outside.', form: 'pistol', hole: [5.5, 7.5] },
    ],
  },
  route: {
    safe: [
      { name: 'Slant & Sit', desc: 'Slant, then settle in the window.', route: [[0, -3], [-4, -6], [-4, -5]], sit: true },
      { name: 'Bubble', desc: 'Step back and catch it behind the line.', route: [[3, 1], [6, 0.5]] },
      { name: 'Short Curl', desc: 'Seven yards and come back to the ball.', route: [[0, -8], [-1, -6]], sit: true },
      { name: 'Hook In', desc: 'Push five, hook inside.', route: [[0, -5], [-3, -5]], sit: true },
    ],
    balanced: [
      { name: 'Deep Dig', desc: 'Twelve yards and flat across.', route: [[0, -12], [-14, -13]] },
      { name: 'Corner Stop', desc: 'Start the corner, stop and turn.', route: [[0, -10], [4, -14], [4, -13]], sit: true },
      { name: 'Square Out', desc: 'Nine yards, sharp cut to the sideline.', route: [[0, -9], [7, -9]] },
      { name: 'Post Curl', desc: 'Lean on the post, then curl back.', route: [[0, -10], [-3, -14], [-3, -12]], sit: true },
    ],
    risky: [
      { name: 'Go Stop Go', desc: 'Stop at 12, then explode deep again.', route: [[0, -12], [0, -11], [0, -38]] },
      { name: 'Bang 8', desc: 'Skinny post straight up the seam.', route: [[0, -8], [-5, -34]] },
      { name: 'Wheel Up', desc: 'Out to the flat, turn it up the sideline.', route: [[4, -2], [6, -34]] },
      { name: 'Deep Comeback', desc: 'Eighteen yards, snap back to the sideline.', route: [[0, -18], [3, -15]], sit: true },
    ],
  },
  cover: {
    safe: [
      { name: 'Cover 4 Drop', desc: 'Bail to your quarter. Nothing deep.', coverage: 'zone', user: 'deep' },
      { name: 'Hard Flat', desc: 'Sit on the flat route and tackle.', coverage: 'zone', user: 'flat' },
      { name: 'Deep Half', desc: 'You and the safety split the deep half.', coverage: 'zone', user: 'deep' },
    ],
    balanced: [
      { name: 'Man Lock', desc: 'Him and you. Nobody else.', coverage: 'man', user: 'man' },
      { name: 'Two Man Under', desc: 'Trail him, safety over the top.', coverage: 'man', user: 'man', twoDeep: true },
      { name: 'Mable', desc: 'Man on your side, zone on the other.', coverage: 'man', user: 'man' },
    ],
    risky: [
      { name: 'Thunder Press', desc: 'Jam hard and stay on his hip.', coverage: 'man', user: 'man', press: true },
      { name: 'Cover 0 Lock', desc: 'Everybody blitzes. Don\'t get beat.', coverage: 'man', user: 'man', blitz: true, press: true },
      { name: 'Boundary Blitz', desc: 'Off the short side after the QB!', coverage: 'man', user: 'blitz', blitz: true },
    ],
  },
  runD: {
    safe: [{ name: 'Fold', desc: 'Stay square, take the safe tackle.', lev: 0.95, win: 0.04 }, { name: 'Shadow', desc: 'Mirror the back from outside.', lev: 1, win: 0.03 }, { name: 'Wall Off', desc: 'Take on the block with your shoulder.', lev: 1.1, win: 0.02 }],
    balanced: [{ name: 'Slice', desc: 'Cut under the block.', lev: 1.15 }, { name: 'Hard Fill', desc: 'Downhill into the alley.', lev: 1.2, win: -0.01 }, { name: 'Read Step', desc: 'One read step, then attack.', lev: 1.05, win: 0.02 }],
    risky: [{ name: 'Jet Edge', desc: 'Time the snap and fly off the edge.', lev: 1.35, win: -0.04 }, { name: 'Club & Rip', desc: 'Club the blocker, rip past him.', lev: 1.25, win: 0.03 }, { name: 'Ball Hunt', desc: 'Go straight for the strip.', lev: 1.3, win: -0.02 }],
  },
  rush: {
    safe: [{ name: 'Bull Push', desc: 'Drive him straight back.', lev: 1.05, win: 0.02 }, { name: 'Lane Discipline', desc: 'Stay in your lane, rush under control.', lev: 0.95, win: 0.04 }, { name: 'Hands Up', desc: 'Push, then get your hands up for a bat.', lev: 1, win: 0.02 }],
    balanced: [{ name: 'Hump', desc: 'Jolt him, then a quick arm-over.', lev: 1.15, win: 0.02 }, { name: 'Ghost', desc: 'Dip the shoulder past his punch.', lev: 1.1, win: 0.04 }, { name: 'Long Arm Rip', desc: 'Long arm, then rip through.', lev: 1.2 }],
    risky: [{ name: 'Tex Stunt', desc: 'Loop around the end at full speed.', lev: 1.35, win: -0.02, blitz: true }, { name: 'Spin Counter', desc: 'Go wide, spin back inside.', lev: 1.25, win: 0.03 }, { name: 'Zero Blitz', desc: 'Everyone comes. Get home NOW.', lev: 1.4, win: -0.04, blitz: true }],
  },
  runStop: {
    safe: [{ name: 'Square Up', desc: 'Stay square, shed late.', lev: 0.95, win: 0.04 }, { name: 'Shock', desc: 'Strike him and hold your ground.', lev: 1.05, win: 0.02 }, { name: 'Plug', desc: 'Fill your gap and wait.', lev: 1, win: 0.03 }],
    balanced: [{ name: 'Angle Slant', desc: 'Slant into the next gap.', lev: 1.15 }, { name: 'Wrong Arm', desc: 'Blow up the puller.', lev: 1.2, win: -0.01 }, { name: 'Long Arm Hold', desc: 'Lock out, then throw him aside.', lev: 1.1, win: 0.03 }],
    risky: [{ name: 'Knife', desc: 'Slice through the gap at the snap.', lev: 1.35, win: -0.03 }, { name: 'Twist Fire', desc: 'Twist with the end, linebackers fill.', lev: 1.3, blitz: true }, { name: 'Backfield Raid', desc: 'Get in the backfield or get pancaked.', lev: 1.4, win: -0.04 }],
  },
};
for (const [mode, calls] of Object.entries(EXTRA)) for (const [call, list] of Object.entries(calls)) {
  const have = new Set(PLAYS[mode][call].map((x) => x.name));
  for (const pl of list) if (!have.has(pl.name)) PLAYS[mode][call].push(pl);
}

// ---------------- situational football: the plays you're offered fit where you are on the field
// Red-zone / goal-line concepts (red: true) only show up near the end zone; routes are built for ~10-15 yards.
const RED = {
  pass: [
    { name: 'Fade-Stop', desc: 'Back-shoulder fades to both corners.', form: 'shotgun', red: true, routes: { X: [[-2, -12]], Z: [[2, -12]], S: [[0, -4], [4, -6]], TE: [[0, -3], [-3, -4]], RB: [[3, -1]] } },
    { name: 'Slant-Flat', desc: 'Quick slant inside, flat outside. In and out.', form: 'shotgun', red: true, routes: { X: [[0, -2], [5, -6]], Z: [[0, -2], [-5, -6]], S: [[-2, 0], [-6, -1]], TE: [[0, -4], [-1, -4]], RB: [[4, -1]] } },
    { name: 'Pylon Corner', desc: 'Corner to the pylon over a flat route.', form: 'shotgun', red: true, routes: { X: [[0, -6], [-6, -12]], Z: [[0, -4], [0, -3]], S: [[0, -6], [6, -11]], TE: [[0, -1], [5, -2]], RB: [[-4, -1]] } },
    { name: 'Rub Cross', desc: 'Crossers rub off each other at the goal line.', form: 'shotgun', red: true, routes: { X: [[0, -1], [12, -2]], Z: [[0, -3], [-10, -4]], S: [[0, -7], [3, -9]], TE: [[0, -5], [0, -4]], RB: [[3, -1]] } },
    { name: 'Smash Corner', desc: 'Hitch outside, corner from the slot.', form: 'shotgun', red: true, routes: { X: [[0, -4], [0, -3]], Z: [[0, -4], [0, -3]], S: [[0, -5], [-6, -11]], TE: [[0, -5], [6, -11]], RB: [[3, -1]] } },
    { name: 'TE Leak', desc: 'Tight end blocks, then leaks to the back line.', form: 'pistol', red: true, routes: { X: [[0, -6], [1, -5]], Z: [[0, -6], [-1, -5]], S: [[0, -1], [-6, -2]], TE: [[0, -2], [-2, -3], [2, -11]], RB: [[4, -1]] } },
  ],
  route: [
    { name: 'Fade', desc: 'Win the corner of the end zone.', route: [[2, -12]], red: true },
    { name: 'Back Shoulder', desc: 'Stop late; the ball comes to your back shoulder.', route: [[1.5, -10], [2, -9]], sit: true, red: true },
    { name: 'Corner', desc: 'Push inside, break to the pylon.', route: [[0, -5], [6, -11]], red: true },
    { name: 'Drag Pick', desc: 'Underneath the rub, across the goal line.', route: [[0, -1], [-12, -3]], red: true },
    { name: 'Whip', desc: 'Fake in, whip back out.', route: [[0, -4], [-3, -5], [3, -5]], red: true },
  ],
  run: [
    { name: 'Goal Line Dive', desc: 'Behind the center. Push the pile.', form: 'pistol', hole: [0, 0], red: true },
    { name: 'Power O', desc: 'Guard pulls. Hit it off tackle.', form: 'pistol', hole: [2.4, 2.4], red: true },
    { name: 'Pylon Toss', desc: 'Pitch it and race the corner to the pylon.', form: 'pistol', hole: [8, 10], pitch: true, red: true },
    { name: 'Leap', desc: 'Go over the top of the pile.', form: 'pistol', hole: [0.4, 0.4], red: true },
  ],
  cover: [
    { name: 'Goal Line Man', desc: 'Press him. No room behind you anyway.', coverage: 'man', user: 'man', press: true, red: true },
    { name: 'Red Zone Bracket', desc: 'Squeeze the flat; the end line is your help.', coverage: 'zone', user: 'flat', red: true },
    { name: 'Goal Line Zero', desc: 'Everyone comes. Win now.', coverage: 'man', user: 'blitz', blitz: true, press: true, red: true },
  ],
  rush: [{ name: 'Goal Line Surge', desc: 'Low pad level, knock him back.', blitz: true, red: true }],
  runStop: [{ name: 'Goal Line Plug', desc: 'Get under him and plug the A gap.', red: true }],
  runD: [{ name: 'Goal Line Fill', desc: 'Fill the edge at the goal line.', red: true }],
};
const RED_SPLIT = { safe: [0, 2], balanced: [2, 4], risky: [4, 9] };

/** Down, distance and field position, plus a short tag for the play picker. */
export function situationOf(m = {}) {
  const yl = m.yardLine ?? 50, down = m.down ?? 1, dist = Math.min(m.distance ?? 10, yl);
  const s = { yl, down, dist, goalLine: yl <= 5, redZone: yl <= 20, backedUp: yl >= 88, short: dist <= 2, long: (dist >= 8 && down >= 3) || dist >= 14 };
  const ord = ['', '1st', '2nd', '3rd', '4th'][down] ?? '';
  const dd = `${ord} & ${yl <= (m.distance ?? 10) ? 'Goal' : dist}`;
  s.tag = s.goalLine ? `GOAL LINE · ${dd}` : s.redZone ? `RED ZONE · ${dd}` : s.backedUp ? `BACKED UP · ${dd}` : s.short && down >= 3 ? `SHORT YARDAGE · ${dd}` : s.long ? `LONG YARDAGE · ${dd}` : dd;
  return s;
}
/** How deep a play goes (the deepest receiver route), in yards. */
export function depthOf(pl) {
  if (pl.route) return Math.max(...pl.route.map(([, z]) => -z));
  if (pl.routes) return Math.max(0, ...Object.entries(pl.routes).filter(([k]) => k !== 'RB').map(([, r]) => Math.max(...r.map(([, z]) => -z))));
  return 0;
}
const insideRun = (pl) => !!pl.hole && !pl.pitch && Math.abs((pl.hole[0] + pl.hole[1]) / 2) < 1.6;
const isDraw = (pl) => /draw|delay|counter/i.test(pl.name);
/** How well a play fits the situation (higher = better). */
export function playFit(mode, pl, s) {
  let f = 0;
  if (pl.red && !s.redZone) return -9; // goal-line stuff stays near the goal line
  const d = depthOf(pl);
  if (mode === 'pass' || mode === 'route') {
    if (s.redZone) { if (pl.red) f += s.goalLine ? 3.2 : 2; if (d > s.yl + 18) f -= s.goalLine ? 3 : 1.5; }
    else {
      if (s.long) { if (d < s.dist) f -= 2.5; else if (d >= s.dist + 2) f += 1; }
      if (s.short) { if (d <= 7) f += 1.5; if (d >= 20) f -= 1.5; }
      if (s.backedUp && d >= 25) f -= 1;
    }
  } else if (mode === 'run') {
    if (s.short || s.goalLine) { if (insideRun(pl) && !isDraw(pl)) f += 2; if (pl.red) f += 2; if (isDraw(pl)) f -= 1.5; }
    if (s.long) { if (insideRun(pl) && !isDraw(pl)) f -= 1; if (isDraw(pl) || pl.pitch) f += 1; }
    if (s.backedUp && pl.pitch) f -= 1.5; // no tosses from your own end zone
  } else if (mode === 'cover') {
    const prevent = /prevent/i.test(pl.name);
    if (prevent && !(s.long && !s.redZone)) f -= 5;
    if (s.redZone) { if (pl.coverage === 'man') f += 1; if (pl.red) f += 2.5; }
    if (s.long && !s.redZone) { if (pl.coverage === 'zone' && pl.user === 'deep') f += 1.5; if (pl.blitz) f -= 0.6; }
    if (s.short) { if (pl.press || pl.blitz) f += 1.2; }
  } else {
    if ((s.short || s.goalLine) && (pl.blitz || pl.red)) f += 1.2;
    if (s.long && mode === 'rush' && pl.blitz) f += 0.6;
  }
  return f;
}

// Recently shown plays (per mode) are skipped, so you don't keep seeing the same ones.
const recent = {};
/** Five plays for this snap that fit the situation: three from your play call and two wildcards from the others. */
export function dealPlays(mode, call, m = {}, n = 5) {
  const s = situationOf(m);
  const seen = (recent[mode] ??= []);
  const red = (RED[mode] ?? []).slice(...(mode === 'pass' || mode === 'route' || mode === 'run' || mode === 'cover' ? RED_SPLIT[call] : [0, 9]));
  const rank = (list) => list.map((pl) => ({ pl, sc: playFit(mode, pl, s) + Math.random() * 1.2 - (seen.includes(pl.name) ? 1.4 : 0) })).sort((a, b) => b.sc - a.sc);
  const own = rank(PLAYS[mode][call].concat(s.redZone ? red : []));
  const others = Object.keys(PLAYS[mode]).filter((c) => c !== call);
  const out = own.slice(0, Math.max(1, n - others.length)).map((x) => x.pl);
  const taken = new Set(out.map((x) => x.name));
  // one wildcard from each of the other calls (if it fits the situation at all)
  for (const c of others) {
    const w = rank(PLAYS[mode][c].concat(s.redZone ? RED[mode] ?? [] : [])).find((x) => !taken.has(x.pl.name) && x.sc > -5);
    if (w && out.length < n) { out.push(w.pl); taken.add(w.pl.name); }
  }
  for (const x of own) { if (out.length >= n) break; if (!taken.has(x.pl.name)) { out.push(x.pl); taken.add(x.pl.name); } }
  seen.push(...out.map((x) => x.name));
  while (seen.length > 25) seen.shift();
  return out;
}

export const playCount = (mode) => Object.values(PLAYS[mode]).reduce((a, l) => a + l.length, 0);
