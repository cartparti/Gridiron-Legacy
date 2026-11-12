// Field surface + weather = footing. Natural grass or artificial turf (a stadium trait, see culture.js), changed by
// the weather and by how chewed up the field is (wear progress). The play engine and the animation read these:
//   grip   acceleration and cutting traction (1 = dry grass)
//   sink   how much the ground bogs players down (mud, deep snow): top speed loss, chance to get stuck
//   slip   chance to lose footing on a hard cut at speed
//   slide  how far bodies keep sliding after falls, dives and tackles
//   bounce how hard bodies bounce when they hit the ground
//   debris what kicks up: grass, pellets (turf rubber), mud, snow, spray
//   footSink how far cleats sink in (yards)
const BASE = {
  grass: { grip: 1, sink: 0, slip: 0, slide: 1, bounce: 1, debris: 'grass', footSink: 0 },
  turf: { grip: 1.12, sink: 0, slip: 0, slide: 1.15, bounce: 1.45, debris: 'pellets', footSink: 0 },
};
const WET = {
  grass: { grip: 0.8, sink: 0.07, slip: 0.1, slide: 1.8, bounce: 0.45, debris: 'mud', footSink: 0.02 },
  turf: { grip: 0.86, sink: 0, slip: 0.1, slide: 2.0, bounce: 1.25, debris: 'spray', footSink: 0 },
};
const SNOW = {
  grass: { grip: 0.72, sink: 0.08, slip: 0.14, slide: 2.2, bounce: 0.55, debris: 'snow', footSink: 0.035 },
  turf: { grip: 0.74, sink: 0.04, slip: 0.14, slide: 2.3, bounce: 0.75, debris: 'snow', footSink: 0.02 },
};

/** Footing for a play. culture: teamCulture() of the home team (or null), weather id, wear 0..1 (how far into the game). */
export function surfaceFor(culture, weather = 'clear', wear = 0) {
  const kind = culture?.surface === 'turf' ? 'turf' : 'grass';
  const wet = weather === 'rain' || weather === 'storm';
  const snow = weather === 'snow';
  const s = { ...(wet ? WET : snow ? SNOW : BASE)[kind], kind, cond: wet ? 'wet' : snow ? 'snow' : 'dry' };
  // natural grass turns into a mud bath as the game goes on (storms faster)
  if (wet && kind === 'grass') {
    const mud = Math.min(1, 0.35 + wear * (weather === 'storm' ? 1.1 : 0.8));
    s.sink = 0.04 + 0.1 * mud; s.grip = 0.86 - 0.12 * mud; s.footSink = 0.01 + 0.025 * mud; s.mud = mud;
  }
  s.label = kind === 'turf' ? (wet ? 'Slick turf' : snow ? 'Snowy turf' : 'Artificial turf') : wet ? (s.mud > 0.6 ? 'Mud bath' : 'Muddy grass') : snow ? 'Snow-covered grass' : 'Natural grass';
  s.short = kind === 'turf' ? (wet ? 'Slick turf' : snow ? 'Snow' : 'Turf') : wet ? 'Mud' : snow ? 'Snow' : '';
  s.desc = kind === 'turf'
    ? (wet ? 'Fast but slick: hard cuts can slip, and bodies hydroplane after falls.' : snow ? 'Slippery: footing goes on hard cuts.' : 'Fast and grippy. Sharp cuts, and falls bounce on the hard surface.')
    : wet ? 'Players bog down and sometimes get stuck. Falls slide and splat. It gets worse as the field tears up.' : snow ? 'Slow and slippery. Cuts are risky and falls slide.' : 'Classic grass: honest footing.';
  return s;
}
