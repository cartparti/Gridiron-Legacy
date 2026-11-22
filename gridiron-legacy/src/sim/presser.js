// Postgame press conferences: reporters ask about the game, you pick how to answer (humble, confident, fiery).
// Answers move fame, the coach, teammates, the rivalry and your mood, and build a media persona over a career.
// state.lastGame.presser = { questions: [{ q, outlet, answers: [{ label, tone, quote, fx }], picked }] }
// state.persona = { humble, confident, fiery } (answer counts). Pure sim.
import { clamp, fillTokens } from '../core/util.js';
import { rand, pick, chance } from '../core/rng.js';
import { addNews } from './press.js';
import { OUTLETS } from '../data/press.js';

const TONES = {
  humble: { label: 'Humble', fx: { coach: 2, teammates: 2, fame: 0.3, mood: 0 } },
  confident: { label: 'Confident', fx: { coach: 0, teammates: 0, fame: 1.2, mood: 2 } },
  fiery: { label: 'Fiery', fx: { coach: -2, teammates: -1, fame: 2.2, mood: 3, rival: 4 } },
};

// question banks by situation; {opp} {team} {last} {score} {stat}
const Q = {
  win: [
    { q: 'Big win over {opp}. What was working out there?', a: ['Credit to the guys up front. I just did my job.', 'We knew they couldn\'t stay with us. Not today.', 'Honestly? {opp} made it easy. They weren\'t ready.'] },
    { q: 'You finished with {stat}. Did you see that coming?', a: ['The coaches put us in great spots. It\'s on film, not on me.', 'That\'s what I expect from myself every week.', 'Put it on a poster. That\'s just who I am.'] },
    { q: 'Where does this team go from here?', a: ['One week at a time. Back to work Monday.', 'Wherever we want. Nobody in this league scares us.', 'Book the parade. Seriously.'] },
  ],
  loss: [
    { q: 'Tough loss to {opp}. What went wrong?', a: ['That\'s on me. I have to be better for this team.', 'We beat ourselves. They didn\'t beat us.', 'Lucky bounces. Run it back and it\'s not close.'] },
    { q: 'Is there frustration in that locker room?', a: ['We stay together. That\'s the only way out of this.', 'Of course. We\'re competitors. We\'ll fix it.', 'Some guys need to look in the mirror. Not naming names.'] },
    { q: 'What do you say to the fans after that one?', a: ['Thank you for sticking with us. We\'ll earn it back.', 'Keep believing. This one won\'t define us.', 'If you\'re leaving now, don\'t come back when we win.'] },
  ],
  rival: [
    { q: 'This rivalry with {opp} is heating up. Any message for them?', a: ['Respect. They\'re a good team and it\'s always a battle.', 'They know where to find us.', 'Tell them to circle the date. I\'m coming for them again.'] },
  ],
  big: [
    { q: 'Huge stage tonight. Did the moment feel big?', a: ['Just blessed to play in games like this.', 'Big games are where I live.', 'The bigger the lights, the worse it gets for the other guys.'] },
  ],
  bad: [
    { q: 'Not your sharpest day. What happened?', a: ['I left plays out there. I\'ll watch the tape and fix it.', 'One game. I\'m not worried about it at all.', 'Ask the refs. Half those calls were a joke.'] },
  ],
  hurt: [
    { q: 'Everyone saw that injury. How are you feeling?', a: ['Day by day. I trust our trainers.', 'I\'ll be back before you know it.', 'Nothing keeps me off that field. Nothing.'] },
  ],
};

/** Should there be a press conference after this game, and with which questions? */
export function makePresser(state, g, { oppName, teamName, statText, hurt = false } = {}) {
  if (g.sitOut) return null;
  const big = g.playoff || g.rivalry || g.primetime || g.isTitle;
  const notable = (g.grade ?? 0) >= 82 || (g.grade ?? 0) <= 45;
  if (!big && !notable && rand(state) > 0.45) return null;
  const tokens = { opp: oppName ?? 'them', team: teamName ?? 'us', last: state.player.last, stat: statText || 'a big day' };
  const pools = [g.won ? Q.win : Q.loss];
  if (g.rivalry) pools.unshift(Q.rival);
  if (big) pools.push(Q.big);
  if ((g.grade ?? 0) <= 45) pools.unshift(Q.bad);
  if (hurt) pools.unshift(Q.hurt);
  const picked = [];
  for (const pool of pools) {
    const item = pick(state, pool);
    if (!picked.includes(item)) picked.push(item);
    if (picked.length >= 2) break;
  }
  while (picked.length < 2) { const item = pick(state, g.won ? Q.win : Q.loss); if (!picked.includes(item)) picked.push(item); }
  return {
    questions: picked.map((it) => ({
      q: fillTokens(it.q, tokens),
      outlet: pick(state, OUTLETS),
      answers: ['humble', 'confident', 'fiery'].map((tone, i) => ({ tone, label: TONES[tone].label, quote: fillTokens(it.a[i], tokens) })),
      picked: null,
    })),
  };
}

/** Answer question qi with answer ai: applies the effects. Returns [{ label, delta, text }]. */
export function answerPresser(state, qi, ai) {
  const pr = state.lastGame?.presser;
  const q = pr?.questions?.[qi];
  if (!q || q.picked !== null) return [];
  const a = q.answers[ai];
  q.picked = ai;
  const p = state.player;
  const fx = TONES[a.tone].fx;
  const out = [];
  const rel = (k, d, label) => { if (!d || p.rel[k] == null) return; const b = p.rel[k]; p.rel[k] = clamp(b + d, 0, 100); out.push({ label, delta: d, text: `${d > 0 ? '+' : ''}${Math.round(p.rel[k] - b)}` }); };
  rel('coach', fx.coach, 'Coach');
  rel('teammates', fx.teammates, 'Teammates');
  if (fx.rival && state.lastGame?.rivalry) rel('rival', fx.rival, 'Rivalry');
  if (fx.fame) { p.fame = clamp((p.fame ?? 0) + fx.fame, 0, 100); out.push({ label: 'Fame', delta: 1, text: `+${fx.fame}` }); }
  if (fx.mood) { p.mood = clamp(p.mood + fx.mood, 0, 100); out.push({ label: 'Mood', delta: 1, text: `+${fx.mood}` }); }
  state.persona ??= { humble: 0, confident: 0, fiery: 0 };
  state.persona[a.tone]++;
  // the quote makes the news (fiery ones always do)
  if (a.tone === 'fiery' || chance(state, 0.4)) addNews(state, 'press', `${p.last} on ${q.outlet}: "${a.quote}"`);
  return out;
}

/** Your media reputation from how you answer. */
export function mediaPersona(state) {
  const P = state.persona ?? { humble: 0, confident: 0, fiery: 0 };
  const n = P.humble + P.confident + P.fiery;
  if (n < 3) return { id: 'new', label: 'Unknown', desc: 'The media is still figuring you out.' };
  const top = Object.entries(P).sort((a, b) => b[1] - a[1])[0][0];
  if (top === 'fiery' && P.fiery / n > 0.45) return { id: 'villain', label: 'The Villain', desc: 'Every quote is a headline. Rivals hate you, cameras love you.' };
  if (top === 'humble' && P.humble / n > 0.45) return { id: 'leader', label: 'Locker Room Leader', desc: 'Coaches and teammates trust you. Never a bad word.' };
  if (top === 'confident' && P.confident / n > 0.45) return { id: 'star', label: 'Swagger', desc: 'Confident, not cocky. Fans eat it up.' };
  return { id: 'balanced', label: 'Media Pro', desc: 'You know when to joke, when to lead and when to fire back.' };
}
