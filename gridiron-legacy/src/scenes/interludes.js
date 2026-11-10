// Short broadcast-style shots between plays: the mascot dancing, the cheer squad, the head coach on the
// headset, the crowd going wild, your huddle, or your sideline hyping you up. ~3 seconds, tap to skip.
// buildInterlude(kind, ctx) -> update(dt, t) returning false when finished. ctx: { group, camera, stadium, opts, say, hype }.
import * as THREE from 'three';
import { makePlayer, faceToward, setPose, applyWear } from './actors.js';

export const INTERLUDES = ['mascot', 'cheer', 'coach', 'crowd', 'huddle', 'bench'];

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => (k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k));

const LINES = {
  mascot: ['{mascot} is fired up!', '{mascot} is leading the crowd!', 'Look at {mascot} go!', '{mascot} with the dance moves!'],
  cheer: ['The cheer squad has the crowd rocking.', 'The spirit squad is bringing the noise.', 'Pom-poms flying behind the end zone!'],
  coach: ['Coach is on the headset, dialing it up.', 'Coach checks the call sheet…', 'Coach is barking at the officials!', 'Coach signals the play in.'],
  crowd: ['{nick} is SHAKING right now!', 'The crowd is on its feet!', 'Listen to this place!', 'You can feel the stands rumbling.'],
  huddle: ['Huddle up. The call is in.', 'Everybody in. Big play coming.', 'Eyes up in the huddle.', 'The huddle breaks with a clap!'],
  bench: ['The sideline is going crazy!', 'Teammates are hyping you up.', 'The bench is up on its feet!', 'Helmets raised on the sideline!'],
};
const MASCOT_NAME = { cat: 'the big cat', wolf: 'the wolf', bird: 'the bird', horse: 'the stallion', bear: 'the bear', bison: 'the bull', sea: 'the shark', scorpion: 'the stinger', storm: 'Captain Thunder', flame: 'the fireball', skull: 'the pirate', crown: 'the king', shield: 'the knight' };

const wp = (obj) => { const v = new THREE.Vector3(); obj.getWorldPosition(v); return v; };

export function buildInterlude(kind, ctx) {
  const { camera, stadium, opts } = ctx;
  const spots = stadium.sideline?.spots?.() ?? {};
  const center = stadium.world.position.clone();
  const mascotName = opts.homeName ? `the ${opts.homeName} mascot` : MASCOT_NAME[opts.culture?.mascot] ?? 'the mascot';
  const fill = (s) => s.replace('{mascot}', mascotName).replace('{nick}', opts.culture?.nickname ?? 'The stadium').replace(/^(\w)/, (c) => c.toUpperCase());
  ctx.say(fill(pick(LINES[kind] ?? LINES.crowd)), 3000);
  stadium.hideLines?.(); // no down-marker sticks in the shot
  let dur = 3.2;
  let shot;
  const temp = [];
  // a camera that orbits/dollies around a target object, from the field side
  const orbitShot = (obj, { dist = 6, h = 1.8, lookY = 1.6, sweep = 0.5 } = {}) => {
    const tp = wp(obj);
    const dir = new THREE.Vector3(center.x - tp.x, 0, center.z - tp.z);
    if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
    dir.normalize();
    const a0 = Math.atan2(dir.x, dir.z);
    return (k) => {
      const p = wp(obj);
      const a = a0 + (k - 0.5) * sweep;
      const d = lerp(dist * 1.25, dist, ease(k));
      camera.position.set(p.x + Math.sin(a) * d, p.y + h, p.z + Math.cos(a) * d);
      camera.lookAt(p.x, p.y + lookY, p.z);
    };
  };
  if (kind === 'mascot' && spots.mascot) { shot = orbitShot(Math.random() < 0.6 ? spots.mascot : spots.mascotEnd, { dist: 9.5, h: 2.4, lookY: 1.8 }); ctx.hype(0.95, dur); }
  else if (kind === 'cheer' && spots.cheer) { shot = orbitShot(spots.cheer, { dist: 13, h: 3.6, lookY: 1.3, sweep: 0.8 }); ctx.hype(0.9, dur); }
  else if (kind === 'coach' && spots.coach) { shot = orbitShot(spots.coach, { dist: 6, h: 1.7, lookY: 1.6, sweep: 0.4 }); ctx.hype(0.3, dur); }
  else if (kind === 'huddle') {
    // your unit in a huddle a few yards behind the line, camera circling overhead
    const n = 10;
    const cz = opts.moment?.defense ? -6 : 6;
    for (let i = 0; i <= n; i++) {
      const isUser = i === 0;
      const m = makePlayer(opts.teamColors, { uniform: opts.teamUniform, look: isUser ? opts.look : undefined, number: isUser ? opts.number : undefined, highlight: false });
      const a = (i / (n + 1)) * Math.PI * 2;
      m.position.set(Math.sin(a) * 1.7, 0, cz + Math.cos(a) * 1.7);
      faceToward(m, 0, cz);
      setPose(m, 'stance');
      const wx = opts.moment?.weather;
      if (opts.wear) applyWear(m, { level: (opts.wear.progress ?? 0) * (0.5 + Math.random() * 0.8), wet: wx === 'rain' || wx === 'storm' ? 0.9 : wx === 'snow' ? 0.5 : 0, snow: wx === 'snow', mud: wx === 'rain' || wx === 'storm', blood: 0 });
      ctx.group.add(m);
      temp.push(m);
    }
    dur = 3;
    shot = (k) => {
      const a = 0.6 + k * 1.1;
      camera.position.set(Math.sin(a) * 6.5, lerp(9, 5.5, ease(k)), cz + Math.cos(a) * 6.5);
      camera.lookAt(0, 0.9, cz);
    };
  } else if (kind === 'bench') {
    const sd = opts.moment?.defense ? -1 : 1; // your sideline: near side on offense, far side on defense
    const x = sd * (53.3 / 2 + 4) + center.x;
    shot = (k) => {
      camera.position.set(x - sd * 4.5, 5.2, center.z + lerp(-14, 2, k));
      camera.lookAt(x + sd * 0.3, 0.9, center.z + lerp(-8, 8, k));
    };
    ctx.hype(1, dur);
  } else {
    // crowd: low shot from the field up into the stands, slow pan
    const sd = Math.random() < 0.5 ? 1 : -1;
    shot = (k) => {
      camera.position.set(center.x + sd * 18, 1.6, center.z + lerp(-10, 10, k) - 50 + 50);
      camera.lookAt(center.x + sd * 45, lerp(5, 9, k), center.z + lerp(-14, 14, k));
    };
    ctx.hype(1, dur);
    ctx.roar?.();
  }
  return (dt, t) => {
    const k = Math.min(1, t / dur);
    shot(k);
    if (kind === 'huddle' && t > dur - 0.6 && !temp.broke) { temp.broke = true; temp.forEach((m) => setPose(m, null)); }
    if (t >= dur) {
      temp.forEach((m) => ctx.group.remove(m));
      return false;
    }
    return true;
  };
}
