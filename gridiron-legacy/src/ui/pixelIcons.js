// Hand-drawn 16x16 pixel icons for weekly activities. Each: { pal: {char: color}, px: [16 rows] }.
// 'k' is always the dark outline, '.' is transparent.

const K = '#1b1b1f';
const ICONS = {
  sprints: { pal: { a: '#ff5d5d', b: '#ffffff', c: '#ffd43b', g: '#9aa3ad' }, px: [
    '................', '................', '................', '.........kkk....', '........kaaak...', '.......kaaaaak..',
    'gg....kaabbaak..', '......kaaaaaaak.', 'ggg..kaaaaaaaak.', '....kaaaaaaaaak.', 'gg.kaaaaaaaaaak.', '...kbbbbbbbbbbk.',
    '...kkkkkkkkkkkk.', '....c.c.c.c.c...', '................', '................'] },
  weights: { pal: { a: '#5c6370', b: '#9aa3ad', c: '#d0d5db' }, px: [
    '................', '................', '................', '.kkk........kkk.', 'kaabk......kaabk', 'kaabk......kaabk',
    'kaabkkkkkkkkaabk', 'kaabcccccccbaabk', 'kaabkkkkkkkkaabk', 'kaabk......kaabk', 'kaabk......kaabk', '.kkk........kkk.',
    '................', '................', '................', '................'] },
  drills: { pal: { a: '#ff922b', b: '#ffffff', c: '#8b4513', d: '#ffffff' }, px: [
    '................', '.......kk.......', '......kaak......', '......kaak......', '.....kbbbbk.....', '.....kaaaak.....',
    '....kaaaaaak....', '....kbbbbbbk....', '...kaaaaaaaak...', '..kkkkkkkkkkkk..', '................', '..........kkkk..',
    '.........kcccck.', '.........kcddck.', '..........kkkk..', '................'] },
  film: { pal: { a: '#2b2f38', b: '#ffffff', c: '#4dabf7' }, px: [
    '................', '..kkkkkkkkkkkk..', '..kbabababababk.', '..kkkkkkkkkkkkk.', '..kaaaaaaaaaaak.', '..kaaccccccaaak.',
    '..kaaccccccaaak.', '..kaaccccccaaak.', '..kaaccccccaaak.', '..kaaaaaaaaaaak.', '..kkkkkkkkkkkkk.', '................',
    '................', '................', '................', '................'] },
  doubles: { pal: { a: '#ff6b00', b: '#ffd43b', c: '#fff3b0' }, px: [
    '................', '.......k........', '......kak.......', '......kaak..k...', '.....kaaak.kak..', '....kaaaaakaak..',
    '....kaabaaaaak..', '...kaabbbaaaak..', '...kabbcbbaaak..', '...kabccccbaak..', '...kabccccbak...', '....kabccbak....',
    '.....kkkkkk.....', '................', '................', '................'] },
  recovery: { pal: { a: '#ffffff', b: '#ff5d5d', c: '#74c0fc' }, px: [
    '................', '...kkkkkkkkkk...', '..kaaaaaaaaaak..', '..kaaaabbaaaak..', '..kaaaabbaaaak..', '..kabbbbbbbbak..',
    '..kabbbbbbbbak..', '..kaaaabbaaaak..', '..kaaaabbaaaak..', '..kaaaaaaaaaak..', '...kkkkkkkkkk...', '................',
    '..cc..cc..cc....', '.c..cc..cc..c...', '................', '................'] },
  rehab: { pal: { a: '#f1d6b8', b: '#d9b48f', c: '#ffffff' }, px: [
    '................', '..........kkk...', '.........kaaak..', '........kaabak..', '.......kaabaak..', '......kccbaak...',
    '.....kcccck.....', '....kaccck......', '...kaabak.......', '..kaabaak.......', '..kabaak........', '..kaaak.........',
    '...kkk..........', '................', '................', '................'] },
  yoga: { pal: { a: '#63e6be', b: '#20c997', c: '#c3fae8' }, px: [
    '................', '.......kk.......', '......kack......', '.....kaacak.....', '..k..kaaaak..k..', '.kak.kabbak.kak.',
    '.kaakkabbakkaak.', '..kaaaabbaaaak..', '...kaaabbaaak...', '....kkkbbkkk....', '.......bb.......', '.......bb.......',
    '................', '................', '................', '................'] },
  classes: { pal: { a: '#4dabf7', b: '#1c7ed6', c: '#ffffff' }, px: [
    '................', '................', '..kkkkkk.kkkkk..', '.kaaaaaakaaaaak.', '.kaccccakacccak.', '.kaaaaaakaaaaak.',
    '.kaccccakacccak.', '.kaaaaaakaaaaak.', '.kaccccakacccak.', '.kaaaaaakaaaaak.', '.kbbbbbbkbbbbbk.', '..kkkkkkkkkkkk..',
    '................', '................', '................', '................'] },
  meetcoach: { pal: { a: '#b08968', b: '#ffffff', c: '#adb5bd', d: '#ff5d5d' }, px: [
    '......kkkk......', '.....kccccк.....', '..kkkkccckkkkk..', '..kaaaaaaaaaak..', '..kabbbbbbbbak..', '..kabdbbbbdbak..',
    '..kabbdbbdbbak..', '..kabbbddbbbak..', '..kabbdbbdbbak..', '..kabdbbbbdbak..', '..kabbbbbbbbak..', '..kaaaaaaaaaak..',
    '...kkkkkkkkkk...', '................', '................', '................'] },
  hangout: { pal: { a: '#ffd43b', b: '#e8590c', c: '#ff8787' }, px: [
    '................', '..kkkkkkkkkkkk..', '..kbbbbbbbbbbk..', '...kaacaaaaak...', '...kaaaaacaak...', '....kaacaaak....',
    '....kaaaaaak....', '.....kacaak.....', '.....kaaaak.....', '......kaak......', '......kaak......', '.......kk.......',
    '................', '................', '................', '................'] },
  family: { pal: { a: '#ffa94d', b: '#e8590c', c: '#ff6b6b', d: '#fff4e6' }, px: [
    '................', '.......kk.......', '......kbbk......', '.....kbbbbk.....', '....kbbbbbbk....', '...kbbbbbbbbk...',
    '..kkdddddddkkk..', '...kddcdcddk....', '...kdcccccdk....', '...kddcccddk....', '...kdddcdddk....', '...kddddddddk...',
    '...kkkkkkkkkk...', '................', '................', '................'] },
  date: { pal: { a: '#ff4d6d', b: '#ffb3c1', c: '#c9184a' }, px: [
    '................', '................', '...kkk...kkk....', '..kaaak.kaaak...', '.kabbaakaaaaak..', '.kabaaaaaaaaak..',
    '.kaaaaaaaaaaak..', '..kaaaaaaaaak...', '...kaaaaaaak....', '....kaaaaak.....', '.....kaaak......', '......kak.......',
    '.......k........', '................', '................', '................'] },
  mentor: { pal: { a: '#ffd43b', b: '#fab005', c: '#fff3bf' }, px: [
    '................', '.......kk.......', '......kack......', '......kaak......', '.kkkkkkaakkkkkk.', '.kaaaaaaaaaaaak.',
    '..kaaaaaaaaaak..', '...kaaaaaaaak...', '....kaaaaaak....', '....kaabbaak....', '...kaabkkbaak...', '...kabk..kbak...',
    '...kkk....kkk...', '................', '................', '................'] },
  media: { pal: { a: '#868e96', b: '#343a40', c: '#ff5d5d' }, px: [
    '......kkkk......', '.....kaaaak.....', '.....kabbak.....', '.....kaaaak.....', '.....kabbak.....', '.....kaaaak.....',
    '...k.kkkkkk.k...', '...k..kbbk..k...', '....k.kbbk.k....', '.....kkbbkk.....', '.......bb.......', '.......bb.......',
    '.....kkkkkk.....', '....c........c..', '................', '................'] },
  charity: { pal: { a: '#ff6b6b', b: '#ffd43b', c: '#ffffff' }, px: [
    '................', '.....kk..kk.....', '....kbbkkbbk....', '.....kbbbbk.....', '..kkkkkbbkkkkk..', '..kaaaabbaaaak..',
    '..kaaaabbaaaak..', '..kkkkkkkkkkkk..', '...kaaabbaaak...', '...kaaabbaaak...', '...kaaabbaaak...', '...kaaabbaaak...',
    '...kkkkkkkkkk...', '................', '................', '................'] },
  agentcall: { pal: { a: '#8d5524', b: '#5c3a1e', c: '#ffd43b' }, px: [
    '................', '................', '.....kkkkkk.....', '.....k....k.....', '..kkkkkkkkkkkk..', '..kaaaaaaaaaak..',
    '..kaaaaaaaaaak..', '..kbbbbccbbbbk..', '..kaaaaccaaaak..', '..kaaaaaaaaaak..', '..kaaaaaaaaaak..', '..kkkkkkkkkkkk..',
    '................', '................', '................', '................'] },
  business: { pal: { a: '#94d82d', b: '#5c940d', c: '#ffffff' }, px: [
    '................', '......kkkk......', '.......kk.......', '......kaak......', '....kkaaaakk....', '...kaaaaaaaak...',
    '..kaaaacaaaaak..', '..kaaaccccaaak..', '..kaaaacaaaaak..', '..kaaaccccaaak..', '..kaaaacaaaaak..', '...kaaaaaaaak...',
    '....kkkkkkkk....', '................', '................', '................'] },
  parttime: { pal: { a: '#ffd43b', b: '#f08c00', c: '#fff3bf' }, px: [
    '................', '................', '.....kkkkkk.....', '....kaaaaaak....', '....kccccccк....', '....kkkkkkkk....',
    '....kaaaaaak....', '....kccccccк....', '....kkkkkkkk....', '....kaaaaaak....', '....kccccccк....', '....kbbbbbbk....',
    '.....kkkkkk.....', '................', '................', '................'] },
  nightout: { pal: { a: '#cc5de8', b: '#ffffff', c: '#ffd43b', d: '#4dabf7' }, px: [
    '.......k........', '.......k........', '......kkk.......', '.....kabdak.....', '....kadbabdk....', '....kbabdbak....',
    '....kdbabdak....', '.....kabdak.....', '......kkk.......', '..c..........c..', '.c.c.......c.c..', '..c..........c..',
    '................', '...b......b.....', '................', '................'] },
  gaming: { pal: { a: '#5f3dc4', b: '#ffffff', c: '#ff5d5d', d: '#51cf66' }, px: [
    '................', '................', '................', '...kkkkkkkkkk...', '..kaaaaaaaaaak..', '.kaabaaaaaacaak.',
    '.kabbbaaaadaaak.', '.kaabaaaaaaaaak.', '.kaaaaakkaaaaak.', '.kaaaak..kaaaak.', '..kkkk....kkkk..', '................',
    '................', '................', '................', '................'] },
};

const cache = new Map();
/** Data URL for an activity's pixel icon (or null if none). */
export function pixelIconURL(id) {
  const def = ICONS[id];
  if (!def) return null;
  if (cache.has(id)) return cache.get(id);
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 16;
  const g = c.getContext('2d');
  def.px.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.' || x > 15) return;
      g.fillStyle = ch === 'k' || ch === 'к' ? K : def.pal[ch] ?? '#ffffff';
      g.fillRect(x, y, 1, 1);
    });
  });
  const url = c.toDataURL();
  cache.set(id, url);
  return url;
}
