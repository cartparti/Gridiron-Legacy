// Seeded random numbers (mulberry32).
//
// Every random roll in the simulation goes through an object that has an
// `rngState` number (usually the game state itself). Because that number is
// saved with the game, loading a save continues the exact same random
// sequence, and tests can use a fixed seed to get repeatable results.
//
// Real-time minigame visuals use Math.random instead; they don't affect saves.

export function nextU32(holder) {
  let t = (holder.rngState = (holder.rngState + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

/** Float in [0, 1). */
export const rand = (h) => nextU32(h) / 4294967296;
/** Integer in [a, b] inclusive. */
export const randInt = (h, a, b) => a + Math.floor(rand(h) * (b - a + 1));
export const randRange = (h, a, b) => a + rand(h) * (b - a);
export const chance = (h, p) => rand(h) < p;
export const pick = (h, arr) => arr[Math.floor(rand(h) * arr.length)];

/** Normally distributed number (Box–Muller). */
export function gauss(h, mean = 0, sd = 1) {
  let u = 0;
  while (u === 0) u = rand(h);
  const v = rand(h);
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Pick one item where weightFn(item) gives its relative likelihood. */
export function weightedPick(h, items, weightFn) {
  let total = 0;
  for (const it of items) total += Math.max(0, weightFn(it));
  if (total <= 0) return null;
  let r = rand(h) * total;
  for (const it of items) {
    r -= Math.max(0, weightFn(it));
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

export function shuffle(h, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand(h) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function newSeed() {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}
