// Fan mail: most weeks a letter shows up (a kid who wants a signed photo, a critic, a superfan with a gift, someone from
// your hometown, a kid in the hospital...). How you answer moves fame, mood and relationships. Pure sim.
import { clamp } from '../core/util.js';
import { rand, pick } from '../core/rng.js';
import { useDaySlot } from './social.js';

const KIDS = ['Mason', 'Ava', 'Jaylen', 'Sofia', 'Eli', 'Maya', 'Noah', 'Zoe', 'Leo', 'Nia', 'Owen', 'Isla'];
const ADULTS = ['Mr. Delgado', 'Mrs. Whitfield', 'Coach Barnes', 'Grandma June', 'Pastor Lyle', 'Mrs. Okafor', 'Mr. Petrakis'];
const TOWNS = ['Cedar Falls', 'Pine Bluff', 'Harbor City', 'Elm Grove', 'Red Rock', 'Lake Vista'];

// Each letter: who, text, and replies [{ label, fx, result, day? }]. Tokens: {kid} {adult} {town} {hometown} {team} {first}
const LETTERS = [
  { id: 'kid_photo', from: 'kid', w: 4, text: 'Dear {first}, I am 9 and I play {pos} just like you. Can you send me a signed picture? I will put it above my bed. From {kid}, {town}.',
    replies: [
      { label: 'Sign a photo and a note', fx: { fame: 0.6, mood: 3 }, result: 'A week later {kid}\'s mom posts the photo, taped above the bed. It gets thousands of shares.' },
      { label: 'Send a signed jersey too', fx: { fame: 1.2, mood: 4, money: -150 }, result: '{kid} wore it to school every day for a month. The video of the unboxing is everywhere.' },
      { label: 'Toss it on the pile', fx: { mood: -1 }, result: 'It gets lost under the others.' } ] },
  { id: 'critic', from: 'adult', w: 2, cond: (s) => s.player.mood < 70 || (s.lastGame && !s.lastGame.won), text: 'To {first}: I have watched this team for 40 years and you are not the answer. Prove me wrong. Sincerely, {adult}.',
    replies: [
      { label: 'Write back: "Watch me."', fx: { mood: 2, fame: 0.3 }, result: 'You pin the letter in your locker. Fuel.' },
      { label: 'Invite them to practice', fx: { fame: 0.8, rel: { coach: 2 } }, result: '{adult} came, watched you work for two hours and left a note: "Fine. You might be the answer."' },
      { label: 'Post it and roast it', fx: { fame: 0.5, mood: 1, rel: { coach: -2 } }, chance: 0.5, fail: { fx: { fame: -1, mood: -2 }, result: 'People think you went too far. The story drags on.' }, result: 'Your followers love it. {adult} even laughs about it on local radio.' } ] },
  { id: 'gift', from: 'adult', w: 2, text: 'Hi {first}! I knitted you a scarf in {team} colors. It took three months. Go get \'em! Love, {adult}.',
    replies: [
      { label: 'Wear it on the sideline', fx: { fame: 0.7, mood: 3 }, result: 'The cameras catch it. {adult} gets a call from a TV station.' },
      { label: 'Send a thank-you card', fx: { mood: 2 }, result: 'A small thing. It made someone\'s whole year.' } ] },
  { id: 'hometown', from: 'adult', w: 2, text: '{first}, the whole diner in {hometown} stops to watch your games. We are all so proud. Come by for pie when you are home. {adult}',
    replies: [
      { label: 'Promise to visit', fx: { mood: 4, rel: { family: 3 } }, result: 'You stop by over the break. They have your picture on the wall.' },
      { label: 'Send signed menus for the wall', fx: { fame: 0.4, mood: 2, money: -80 }, result: 'Business at the diner doubles that month.' } ] },
  { id: 'hospital', from: 'kid', w: 1, minFame: 15, text: 'Hello. My son {kid} is in the hospital for a long stay. You are his favorite player. If you are ever nearby, it would mean the world. {adult}',
    replies: [
      { label: 'Visit him (uses a day)', day: true, fx: { fame: 1.5, mood: 8, rel: { teammates: 2 } }, result: 'You spent the afternoon playing video games with {kid}. You let him win. Mostly.' },
      { label: 'Video call him', fx: { fame: 0.6, mood: 5 }, result: '{kid} screamed so loud the nurses came running. Worth it.' },
      { label: 'Send a care package', fx: { mood: 2, money: -200 }, result: 'Jersey, ball, a note. His mom says he sleeps with the ball.' } ] },
  { id: 'advice', from: 'kid', w: 2, text: 'Dear {first}, coaches say I am too small to play. How did you get good? Please write back. {kid}, age 14.',
    replies: [
      { label: '"Outwork everyone."', fx: { mood: 2 }, result: 'Three years later a letter arrives: {kid} made varsity and framed your reply.' },
      { label: '"Love the game first."', fx: { mood: 3 }, result: '{kid} writes back with a drawing of you two playing catch.' } ] },
  { id: 'rivalfan', from: 'adult', w: 1, cond: (s) => !!s.career.rivalTeamId, text: 'Enjoy it while it lasts. Our team is coming for you. - A {rival} fan (and proud of it)',
    replies: [
      { label: 'Frame it in the locker room', fx: { mood: 2, rel: { teammates: 3 } }, result: 'It becomes the team\'s rallying cry this week.' },
      { label: 'Send them a signed photo anyway', fx: { fame: 0.8, mood: 1 }, result: 'They post it with the caption "OK, he\'s classy." Even rival fans like you a little now.' } ] },
  { id: 'teacher', from: 'adult', w: 2, stages: ['hs', 'college'], text: '{first}, I saw your game on Friday. Don\'t forget the essay is due Monday. Proud of you, but I will not accept it late. {adult}',
    replies: [
      { label: 'Stay up and finish it', fx: { academics: 4, health: -2 }, result: 'Turned in on time. A B+ and a smiley face.' },
      { label: 'Ask for an extension', fx: { academics: -1, mood: 1 }, result: 'Denied. You write it in the bus on the way to practice.' } ] },
  { id: 'soldier', from: 'adult', w: 1, text: 'Sir, our unit overseas watches your games at 3 a.m. You make it feel like home for a few hours. Thank you. Sgt. {adult}',
    replies: [
      { label: 'Send signed gear to the unit', fx: { fame: 1, mood: 5, money: -400 }, result: 'Photo of the whole unit in your jersey arrives a month later. It goes on your fridge.' },
      { label: 'Record a video message', fx: { fame: 0.7, mood: 4 }, result: 'They play it before every game night now.' } ] },
  { id: 'proposal', from: 'adult', w: 1, minFame: 30, text: '{first}! I want to propose to my girlfriend at your next game. Could you help? She is your biggest fan. - {adult}',
    replies: [
      { label: 'Hand over the ring after warm-ups', fx: { fame: 1.2, mood: 4 }, result: 'She said yes. On the big screen. The whole stadium lost it.' },
      { label: 'Politely pass', fx: {}, result: 'He did it at halftime himself. She still said yes.' } ] },
];

const fill = (s, t) => s.replace(/\{(\w+)\}/g, (m, k) => t[k] ?? m);

/** beginWeek: maybe a letter arrives. */
export function mailWeek(state) {
  const p = state.player;
  if (state.week.mail) return state.week.mail;
  if ((p.fame ?? 0) < 4 || rand(state) > 0.4) return null;
  const stage = state.career.stage;
  const pool = LETTERS.filter((l) => (!l.stages || l.stages.includes(stage)) && (!l.minFame || p.fame >= l.minFame) && (!l.cond || l.cond(state)) && l.id !== state.lastMailId);
  if (!pool.length) return null;
  let r = rand(state) * pool.reduce((a, l) => a + l.w, 0);
  const l = pool.find((x) => (r -= x.w) <= 0) ?? pool[0];
  const rival = state.league?.teams?.find((t) => t.id === state.career.rivalTeamId);
  const team = state.league?.teams?.find((t) => t.id === state.career.teamId);
  const tok = { kid: pick(state, KIDS), adult: pick(state, ADULTS), town: pick(state, TOWNS), hometown: p.hometown ?? 'your hometown', first: p.first, team: team?.name ?? 'the team', rival: rival?.name ?? 'rival', pos: p.position === 'MS' ? 'mascot' : p.position };
  state.lastMailId = l.id;
  state.week.mail = { id: l.id, from: l.from, text: fill(l.text, tok), tok, replies: l.replies.map((x) => ({ label: fill(x.label, tok), day: !!x.day })), answered: null };
  return state.week.mail;
}

export function answerMail(state, idx) {
  const m = state.week?.mail;
  if (!m || m.answered != null) return null;
  const l = LETTERS.find((x) => x.id === m.id);
  const r = l?.replies[idx];
  if (!r) return null;
  if (r.day && !useDaySlot(state, 'Hospital visit', 'heart', 1)) return { ok: false, text: 'No free day left this week.' };
  const p = state.player;
  let fx = r.fx, result = r.result;
  if (r.chance && rand(state) > r.chance) { fx = r.fail.fx; result = r.fail.result; }
  for (const k of ['fame', 'mood', 'health', 'academics']) if (fx[k] && typeof p[k] === 'number') p[k] = clamp(p[k] + fx[k], 0, 100);
  if (fx.money) p.money += fx.money;
  for (const [k, v] of Object.entries(fx.rel ?? {})) p.rel[k] = clamp((p.rel[k] ?? 50) + v, 0, 100);
  m.answered = idx;
  m.result = fill(result, m.tok);
  p.lettersAnswered = (p.lettersAnswered ?? 0) + 1;
  return { ok: true, text: m.result };
}

export const lettersAnswered = (state) => state.player?.lettersAnswered ?? 0;
