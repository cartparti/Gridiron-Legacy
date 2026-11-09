// Your phone: text messages from the people in your life, and a social media account.
import { FAN_HANDLES } from '../data/names.js';
import { clamp, fillTokens } from '../core/util.js';
import { rand, randInt, pick, chance } from '../core/rng.js';
import { applyEffects } from './effects.js';
import { people } from './social.js';
import { TEXTS, AFTER_GAME, WEEKLY, TROLL_COMMENTS, COMMENT_REPLIES, CLAPBACKS, ALT, ALT_BACK, TAGS } from '../data/texts.js';
import { FIRST_NAMES } from '../data/names.js';
import { addNews } from './press.js';

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
export function textFrom(state, key, text, tid = null, opts = null) {
  const ph = phone(state);
  const t = (ph.threads[key] = ph.threads[key] ?? []);
  t.push({ from: 'them', text, tid, opts, year: state.career.year, week: (state.league?.week ?? 0) + 1, read: false });
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

/** The message in this thread waiting for an answer (latest from them, not yet answered). */
export function pendingMessage(state, key) {
  const t = phone(state).threads[key] ?? [];
  const last = t[t.length - 1];
  return last && last.from === 'them' && !last.answered ? last : null;
}

/** Reply choices for a thread: contextual for templated texts, generic otherwise. */
export function replyOptions(state, key) {
  const m = state ? pendingMessage(state, key) : null;
  if (!m) return [];
  if (m.opts) return m.opts.map((o) => o.label);
  const tpl = m.tid ? TEXTS[m.tid] : null;
  return (tpl?.replies ?? REPLIES).map((r) => r.label);
}

/** Resolve the reply choices for a template right now (random wordings from ALT / ALT_BACK). */
function resolveOptions(state, tid, replies) {
  return replies.map((r, i) => {
    const labels = Array.isArray(r.label) ? r.label : [r.label, ...(ALT[tid]?.[i]?.slice(1) ?? [])];
    const backs = Array.isArray(r.back) ? r.back : r.back === undefined ? [null] : [r.back, ...(ALT_BACK[tid]?.[i]?.slice(1) ?? [])];
    return { label: pick(state, ALT[tid]?.[i] && !Array.isArray(r.label) ? ALT[tid][i] : labels), back: pick(state, backs) ?? (r.back === null ? null : r.back ?? null), i };
  });
}

const bump = (state, key, d) => {
  const p = state.player;
  if (!d) return null;
  if (key.startsWith('mate')) {
    const m = p.teammates?.find((x) => x.id === key);
    if (m) m.bond = clamp(m.bond + d, 0, 100);
  } else if (p.rel[key] !== null && p.rel[key] !== undefined) p.rel[key] = clamp(p.rel[key] + d, 0, 100);
  else return null;
  return { label: contactName(state, key), delta: d, text: `${d > 0 ? '+' : ''}${d}` };
};

/** Answer the pending message. Returns { changes, back } (their response is added to the thread). */
export function reply(state, key, idx) {
  const ph = phone(state);
  const m = pendingMessage(state, key);
  if (!m) return null;
  const tpl = m.tid === 'tag' ? { replies: TAGS[m.tagIdx]?.replies ?? REPLIES } : m.tid ? TEXTS[m.tid] : null;
  const base = (tpl?.replies ?? REPLIES)[idx];
  if (!base) return null;
  const chosen = m.opts?.[idx];
  const r = { ...base, label: chosen?.label ?? (Array.isArray(base.label) ? base.label[0] : base.label), back: chosen ? chosen.back : base.back };
  m.answered = true;
  const wk = (state.league?.week ?? 0) + 1;
  const t = (ph.threads[key] = ph.threads[key] ?? []);
  t.push({ from: 'me', text: r.label, year: state.career.year, week: wk, read: true });
  const changes = [];
  const b = bump(state, key, r.bond);
  if (b) changes.push(b);
  if (r.effects) changes.push(...applyEffects(state, r.effects));
  if (r.risk && chance(state, r.risk)) {
    changes.push(...applyEffects(state, { mood: -3, rel: { coach: -2 }, fame: -0.5 }));
    addNews(state, 'scandal', `${state.player.first} ${state.player.last} gets into it online. Not a great look.`);
    r.back = 'That reply is going viral... for the wrong reasons. 😬';
  }
  if (r.back) t.push({ from: 'them', text: r.back, year: state.career.year, week: wk, read: true, answered: true });
  if (t.length > MAX_MSGS) t.splice(0, t.length - MAX_MSGS);
  return { changes, back: r.back };
}

/** Send a templated text from a contact. who = coach/family/partner/agent/rival/mate. */
function sendTemplate(state, tid) {
  const tpl = TEXTS[tid];
  const p = state.player;
  if (!tpl) return;
  if (tpl.who === 'partner' && !p.partnerName) return;
  if (tpl.who === 'agent' && !p.agentName) return;
  const key = tpl.who === 'mate' ? (p.teammates?.length ? pick(state, p.teammates).id : null) : tpl.who;
  if (!key) return;
  textFrom(state, key, pick(state, tpl.text), tid, resolveOptions(state, tid, tpl.replies));
}

/** Someone tags you on Huddle. when: great / bad / any. Lands in the "Huddle Mentions" thread. */
export function sendTag(state, when = 'any') {
  const p = state.player;
  const pool = TAGS.map((tg, i) => ({ tg, i })).filter(({ tg }) => tg.when === 'any' || tg.when === when);
  if (!pool.length) return;
  const { tg, i } = pick(state, pool);
  const handle = pick(state, FAN_HANDLES).replace('@', '');
  const mate = p.teammates?.length ? pick(state, p.teammates).name.split(' ')[0] : pick(state, FIRST_NAMES);
  const me = `${p.first.toLowerCase()}${p.last.toLowerCase()}${p.number}`;
  const text = fillTokens(pick(state, tg.text), { handle, first: p.first, me, mate, rival: p.rivalName });
  const opts = tg.replies.map((r, k) => ({ label: pick(state, Array.isArray(r.label) ? r.label : [r.label]), back: null, i: k }));
  textFrom(state, 'tags', text, 'tag', opts);
  const t = phone(state).threads.tags;
  t[t.length - 1].tagIdx = i;
}

/** Reply to a comment on one of your posts. kind 'fan' or 'troll'. */
export function replyToComment(state, postId, ci, idx) {
  const ph = phone(state);
  const post = ph.posts.find((x) => x.id === postId);
  const c = post?.comments?.[ci];
  if (!c || c.replied) return null;
  const opts = COMMENT_REPLIES[c.troll ? 'troll' : 'fan'];
  const r = opts[idx];
  c.replied = r.label === 'Ignore' ? 'ignored' : r.label === 'Clap back' ? pick(state, CLAPBACKS) : r.label;
  const changes = applyEffects(state, r.effects ?? {});
  let text = null;
  if (r.risk && chance(state, r.risk)) {
    changes.push(...applyEffects(state, { mood: -3, rel: { coach: -2 }, fame: -0.5 }));
    addNews(state, 'scandal', `${state.player.first} ${state.player.last} gets into it with fans online. The clapback is going viral, and not in a good way.`);
    text = 'It blew up. Your coach saw it. Not great.';
  } else if (r.risk) text = 'The internet loves it. 🔥';
  return { changes, text };
}
export const commentReplyOptions = (c) => COMMENT_REPLIES[c.troll ? 'troll' : 'fan'].map((r) => r.label);

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
  sendTemplate(state, AFTER_GAME.coach[tier]);
  if (lg.injury) sendTemplate(state, AFTER_GAME.family.hurt);
  else if (chance(state, 0.55)) sendTemplate(state, AFTER_GAME.family[lg.won ? 'win' : 'loss']);
  if (p.partnerName && chance(state, 0.6)) sendTemplate(state, AFTER_GAME.partner[lg.won ? 'win' : 'loss']);
  if (lg.won && p.teammates?.length && chance(state, 0.6)) sendTemplate(state, AFTER_GAME.mate[tier === 'great' ? 'great' : 'win']);
  if (p.agentName && tier === 'great' && chance(state, 0.5)) sendTemplate(state, AFTER_GAME.agent.great);
  if (lg.rivalry) sendTemplate(state, AFTER_GAME.rival[lg.won ? 'beat' : 'lost']);
  if (chance(state, tier === 'bad' ? 0.6 : 0.7)) sendTag(state, tier === 'great' ? 'great' : tier === 'bad' ? 'bad' : 'any');
  if (tier === 'great' && chance(state, 0.4)) sendTag(state, 'great');
}

/** Occasional texts at the start of a week. */
export function weeklyTexts(state) {
  const p = state.player;
  if (!chance(state, 0.6)) return;
  const options = WEEKLY.filter((tid) => (TEXTS[tid].who !== 'partner' || p.partnerName) && (TEXTS[tid].who !== 'agent' || p.agentName));
  sendTemplate(state, pick(state, options));
  if (chance(state, 0.35)) sendTag(state, 'any');
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
  if (chance(state, 0.45)) comments.push({ handle: pick(state, FAN_HANDLES), text: pick(state, TROLL_COMMENTS), troll: true });
  const post = { id: ph.nextId++, kind: t.id, text: caption, likes, comments, year: state.career.year, week: (state.league?.week ?? 0) + 1, mine: true };
  ph.posts.unshift(post);
  if (ph.posts.length > MAX_POSTS) ph.posts.length = MAX_POSTS;
  const changes = applyEffects(state, { fame: t.fame, ...(t.effects ?? {}) });
  if (t.money && p.sponsors?.length) {
    const bonus = Math.round(p.sponsors[0].weekly * 0.5);
    p.money += bonus;
    changes.push({ label: 'Sponsor bonus', delta: 1, text: `+$${bonus.toLocaleString()}` });
  }
  if (t.id === 'rival' && chance(state, 0.6)) sendTemplate(state, 'rival_trash');
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
  if (key === 'tags') return 'Huddle Mentions';
  return people(state).find((x) => x.key === key)?.name ?? key;
}

export { phone as phoneState };
