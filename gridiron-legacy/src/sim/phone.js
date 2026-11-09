// Your phone: text messages from the people in your life, and a social media account.
import { FAN_HANDLES } from '../data/names.js';
import { clamp, fillTokens } from '../core/util.js';
import { rand, randInt, pick, chance } from '../core/rng.js';
import { applyEffects } from './effects.js';
import { people } from './social.js';

const MAX_MSGS = 40;
const MAX_POSTS = 40;

function phone(state) {
  state.phone = state.phone ?? { threads: {}, posts: [], unread: 0, nextId: 1 };
  return state.phone;
}

export function followers(p) {
  return Math.round(50 + Math.pow(Math.max(0, p.fame), 2.6) * 9);
}

export function fmtCount(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e4) return `${Math.round(n / 1e3)}K`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

/** Someone texts you. key = person key (coach, mate0, family, partner, agent, rival). */
export function textFrom(state, key, text) {
  const ph = phone(state);
  const t = (ph.threads[key] = ph.threads[key] ?? []);
  t.push({ from: 'them', text, year: state.career.year, week: (state.league?.week ?? 0) + 1, read: false });
  if (t.length > MAX_MSGS) t.shift();
  ph.unread = Object.values(ph.threads).reduce((a, th) => a + th.filter((m) => !m.read && m.from === 'them').length, 0);
}

export function markRead(state, key) {
  const ph = phone(state);
  for (const m of ph.threads[key] ?? []) m.read = true;
  ph.unread = Object.values(ph.threads).reduce((a, th) => a + th.filter((m) => !m.read && m.from === 'them').length, 0);
}

const REPLIES = [
  { label: '❤️', bond: 1 },
  { label: 'Thanks! Means a lot.', bond: 2 },
  { label: '👍', bond: 1 },
];
export const replyOptions = () => REPLIES.map((r) => r.label);

/** Quick reply (small relationship bump, once per contact per week). */
export function reply(state, key, idx) {
  const ph = phone(state);
  const r = REPLIES[idx];
  (ph.threads[key] = ph.threads[key] ?? []).push({ from: 'me', text: r.label, year: state.career.year, week: (state.league?.week ?? 0) + 1, read: true });
  state.week = state.week ?? {};
  state.week.replied = state.week.replied ?? {};
  if (state.week.replied[key]) return null;
  state.week.replied[key] = true;
  const p = state.player;
  if (key.startsWith('mate')) {
    const m = p.teammates?.find((x) => x.id === key);
    if (m) m.bond = clamp(m.bond + r.bond, 0, 100);
  } else if (p.rel[key] !== null && p.rel[key] !== undefined) p.rel[key] = clamp(p.rel[key] + r.bond, 0, 100);
  return r.bond;
}

// ------------------------------------------------------------------ automatic texts

const GAME_TEXTS = {
  coach: {
    great: ['Film session was fun today. You were the best player on the field.', 'That\'s the standard. Keep it there.', 'Proud of you. Rest up.'],
    good: ['Solid game. Clean up the details and you\'re dangerous.', 'Good work. Film at 8.'],
    bad: ['We need more from you. My office, Monday.', 'Shake it off. Watch the tape, learn, move on.', 'That\'s not who you are. Bounce back.'],
  },
  family: {
    win: ['WE WON!!! Your dad screamed so loud the neighbors called 😂', 'So proud of you, sweetie ❤️', 'Grandpa says that was your best game yet!'],
    loss: ['Tough one. We love you no matter what ❤️', 'Head up, kiddo. Call us tonight?'],
    hurt: ['We saw you get hurt. Are you okay?? Call us!', 'Please rest. Your health matters more than any game.'],
  },
  partner: {
    win: ['You were amazing today 😍', 'Dinner\'s on me tonight, superstar.'],
    loss: ['Come home, I made your favorite. Forget football tonight.', 'I\'m proud of you anyway ❤️'],
  },
  mate: {
    great: ['BRO. 🔥🔥🔥', 'You were COOKING today', 'Wings on me. You earned it.'],
    win: ['Big W 💪', 'Good win. Recovery tomorrow?'],
  },
  agent: {
    great: ['Phones are ringing after that one. Keep it up.', 'That game just added zeros to your next deal.'],
  },
  rival: {
    beat: ['Lucky day. See you next year.', 'Enjoy it while it lasts.'],
    lost: ['Better luck next time 😘', 'Told you.'],
  },
};

/** Texts after a game, based on how it went. */
export function postGameTexts(state, lg) {
  const p = state.player;
  if (!lg || lg.sitOut) return;
  const tier = lg.grade >= 75 ? 'great' : lg.grade >= 55 ? 'good' : 'bad';
  textFrom(state, 'coach', pick(state, GAME_TEXTS.coach[tier]));
  if (lg.injury) textFrom(state, 'family', pick(state, GAME_TEXTS.family.hurt));
  else if (chance(state, 0.55)) textFrom(state, 'family', pick(state, GAME_TEXTS.family[lg.won ? 'win' : 'loss']));
  if (p.partnerName && chance(state, 0.6)) textFrom(state, 'partner', pick(state, GAME_TEXTS.partner[lg.won ? 'win' : 'loss']));
  if (lg.won && p.teammates?.length && chance(state, 0.6)) {
    const m = pick(state, p.teammates);
    textFrom(state, m.id, pick(state, GAME_TEXTS.mate[tier === 'great' ? 'great' : 'win']));
  }
  if (p.agentName && tier === 'great' && chance(state, 0.5)) textFrom(state, 'agent', pick(state, GAME_TEXTS.agent.great));
  if (lg.rivalry) textFrom(state, 'rival', pick(state, GAME_TEXTS.rival[lg.won ? 'beat' : 'lost']));
}

const WEEK_TEXTS = [
  ['mate', 'Anyone down for wings Thursday?'],
  ['mate', 'Did you see the new playbook install? My brain hurts'],
  ['mate', 'Lift at 6am. Don\'t be late 😤'],
  ['family', 'Don\'t forget to eat a vegetable this week.'],
  ['family', 'Your little cousin wore your jersey to school today!'],
  ['coach', 'Extra film session available Wednesday if you want it.'],
  ['partner', 'Miss you. Movie night soon?'],
  ['agent', 'A couple of brands asked about you. Let\'s talk.'],
];

/** Occasional texts at the start of a week. */
export function weeklyTexts(state) {
  const p = state.player;
  if (!chance(state, 0.45)) return;
  const options = WEEK_TEXTS.filter(([k]) => (k !== 'partner' || p.partnerName) && (k !== 'agent' || p.agentName));
  const [k, text] = pick(state, options);
  const key = k === 'mate' ? (p.teammates?.length ? pick(state, p.teammates).id : 'family') : k;
  textFrom(state, key, text);
}

// ------------------------------------------------------------------ social media

export const POST_TYPES = [
  { id: 'highlight', label: 'Post your highlights', needs: (st) => st.lastGame && !st.lastGame.sitOut && st.lastGame.grade >= 65, fame: 1.5, rate: 0.09, captions: ['Another day at the office. 🏈', 'Film don\'t lie. 🎥', 'All glory to the O-line 🙏'] },
  { id: 'workout', label: 'Workout pic', fame: 0.5, rate: 0.04, captions: ['5am club. 💪', 'Nobody sees the work. Until they do.', 'Leg day survived. Barely.'] },
  { id: 'hype', label: 'Game week hype', fame: 0.6, rate: 0.05, captions: ['Locked in. 🔒', 'Saturday can\'t come fast enough.', 'Bring the noise. 📣'] },
  { id: 'fans', label: 'Thank the fans', fame: 0.8, rate: 0.06, effects: { mood: 2 }, captions: ['Y\'all are the best fans in the world. ❤️', 'Love the support. Every single one of you.'] },
  { id: 'life', label: 'Life update', needs: (st) => !!st.player.partnerName || st.player.flags.has_dog, fame: 0.5, rate: 0.07, captions: ['Off-day vibes. ☀️', 'Home team. ❤️', 'Couldn\'t ask for a better crew.'] },
  { id: 'sponsor', label: 'Sponsored post', needs: (st) => st.player.sponsors?.length > 0, fame: 0.3, rate: 0.03, money: true, captions: ['Fueled by {brand}. #ad', 'Can\'t play without my {brand}. #partner'] },
  { id: 'rival', label: 'Call out your rival', fame: 2, rate: 0.11, effects: { rel: { rival: 8, coach: -2 } }, captions: ['Heard {rival} has been talking. See you soon. 🤫', 'Some people talk. Some people play.'] },
  { id: 'charity', label: 'Charity spotlight', fame: 1, rate: 0.06, effects: { mood: 3 }, captions: ['Spent the day with the kids at the youth center. Best part of my week.', 'Give back. Always. ❤️'] },
];

const COMMENTS = {
  highlight: ['THAT\'S MY QB', 'clip of the year', 'unreal 🔥', 'goat behavior'],
  workout: ['beast mode', 'built different', 'teach me', 'go to sleep lol'],
  hype: ['LETS GOOO', 'we ready', '🔥🔥', 'big game incoming'],
  fans: ['love you too!!', 'best athlete ever', '❤️❤️❤️'],
  life: ['cute 😭', 'love this', 'living the dream'],
  sponsor: ['ad lol', 'bag secured 💰', 'is it actually good tho'],
  rival: ['OHHHH', 'it\'s on 🍿', 'messy, love it', 'they\'re gonna respond lol'],
  charity: ['this is what it\'s about', 'class act', 'role model ❤️'],
};

export function postOptions(state) {
  return POST_TYPES.filter((t) => !t.needs || t.needs(state)).map((t) => ({ id: t.id, label: t.label }));
}

export function canPost(state) {
  return !state.week?.posted;
}

/** Make a post (once per week). Returns the post. */
export function makePost(state, typeId) {
  const p = state.player;
  const ph = phone(state);
  const t = POST_TYPES.find((x) => x.id === typeId);
  if (!t || !canPost(state)) return null;
  state.week.posted = true;
  const f = followers(p);
  const brand = p.sponsors?.[0]?.brand ?? 'Voltade';
  const caption = fillTokens(pick(state, t.captions), { rival: p.rivalName.split(' ')[0], brand });
  const likes = Math.max(3, Math.round(f * t.rate * (0.6 + rand(state) * 0.8)));
  const comments = [];
  const n = randInt(state, 2, 3);
  for (let i = 0; i < n; i++) comments.push({ handle: pick(state, FAN_HANDLES), text: pick(state, COMMENTS[t.id]) });
  const post = { id: ph.nextId++, kind: t.id, text: caption, likes, comments, year: state.career.year, week: (state.league?.week ?? 0) + 1, mine: true };
  ph.posts.unshift(post);
  if (ph.posts.length > MAX_POSTS) ph.posts.length = MAX_POSTS;
  const changes = applyEffects(state, { fame: t.fame, ...(t.effects ?? {}) });
  if (t.money && p.sponsors?.length) {
    const bonus = Math.round(p.sponsors[0].weekly * 0.5);
    p.money += bonus;
    changes.push({ label: 'Sponsor bonus', delta: 1, text: `+$${bonus.toLocaleString()}` });
  }
  if (t.id === 'rival' && chance(state, 0.6)) textFrom(state, 'rival', pick(state, ['Cute post. 🙄', 'Keep my name out your mouth.', 'Screenshot saved. See you on the field.']));
  return { post, changes };
}

/** Social feed: your posts plus fan posts and league headlines, newest first. */
export function feed(state) {
  const p = state.player;
  const ph = phone(state);
  const items = [];
  for (const post of ph.posts) items.push({ ...post, author: `@${p.first.toLowerCase()}${p.last.toLowerCase()}${p.number}`, name: `${p.first} ${p.last}` });
  for (const n of (state.news ?? []).slice(0, 40)) {
    if (n.kind === 'fan') items.push({ author: n.handle, name: n.handle.slice(1), text: n.text, year: n.year, week: n.week, likes: 0 });
    else if (n.kind === 'headline' || n.kind === 'award' || n.kind === 'record') items.push({ author: `@${(n.outlet ?? 'SportsDesk').replace(/\W/g, '')}`, name: n.outlet ?? 'Sports Desk', text: n.text, year: n.year, week: n.week, likes: 0, press: true });
  }
  return items.sort((a, b) => b.year - a.year || b.week - a.week || (b.mine ? 1 : 0) - (a.mine ? 1 : 0));
}

export function contactName(state, key) {
  return people(state).find((x) => x.key === key)?.name ?? key;
}

export { phone as phoneState };
