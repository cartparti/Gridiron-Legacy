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
  return null;
}
