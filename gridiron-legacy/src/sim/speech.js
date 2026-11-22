// Hall of Fame induction speech: pick how you open, who you thank (two), and how you close; the game writes the
// speech from your own career (hometown, teams, family, coach, rival, mentees, titles). Pure sim.
// state.legacy.speech = { open, thanks: [ids], close, text }
import { logJournal } from './journal.js';

export const SPEECH_OPENS = [
  { id: 'humble', label: 'Start humble', line: (c) => `I never thought a kid from ${c.town} would be standing up here. I'm still not sure I belong.` },
  { id: 'joke', label: 'Open with a joke', line: (c) => `They gave me ten minutes. ${c.rival ? `${c.rival} would tell you I never could stick to a game plan.` : 'My coaches will tell you I never stuck to a game plan.'}` },
  { id: 'roots', label: 'Talk about where it started', line: (c) => `It started on a field in ${c.town}, with ${c.hs} on my chest and big dreams.` },
];

/** Who you can thank (built from this career). */
export function speechThanks(state) {
  const p = state.player;
  const list = [{ id: 'family', label: 'Mom and Dad', line: () => 'Mom, Dad: you drove me to every practice and sat in the cold for every game. This is yours.' }];
  if (p.partnerName) list.push({ id: 'partner', label: p.partnerName, line: () => `${p.partnerName}, you carried our family while I chased this. I love you.` });
  if ((p.family?.kids ?? []).length) list.push({ id: 'kids', label: 'My kids', line: () => `${p.family.kids.map((k) => k.name).join(', ')}: whatever you chase, chase it with everything.` });
  list.push({ id: 'coach', label: 'My coaches', line: () => 'To every coach who pushed me when I wanted to quit: thank you for not letting me.' });
  list.push({ id: 'team', label: 'My teammates', line: () => (p.position === 'QB' || p.position === 'RB' ? 'To my offensive linemen: every yard I ever gained, you gained first.' : 'To my teammates: you made me better every single day.') });
  if (p.rivalName) list.push({ id: 'rival', label: `My rival, ${p.rivalName}`, line: () => `${p.rivalName}, you made me sharper. I hated losing to you, and I'll miss chasing you.` });
  if ((p.mentees ?? []).length) list.push({ id: 'mentees', label: 'The young guys I mentored', line: () => `${p.mentees.map((m) => m.name).join(', ')}: watching you grow was my favorite part.` });
  list.push({ id: 'fans', label: 'The fans', line: () => 'And to the fans: every Sunday you showed up loud. You were the reason the lights felt bright.' });
  return list;
}

export const SPEECH_CLOSES = [
  { id: 'giveback', label: 'Promise to give back', line: (c) => `${c.foundation ? `Through ${c.foundation}, ` : ''}I'm going to spend the rest of my life giving back to the game that gave me everything.` },
  { id: 'kids', label: 'Talk to the kids watching', line: () => 'To every kid watching: they will tell you it\'s impossible. Go prove them wrong.' },
  { id: 'game', label: 'Thank the game itself', line: (c) => `Football, you gave a kid from ${c.town} ${c.titles ? `${c.titles} championship${c.titles > 1 ? 's' : ''} and ` : ''}a life I couldn't have dreamed of. Thank you.` },
  { id: 'mic', label: 'Mic drop', line: () => 'People ask if I\'d change anything. Not one snap. I\'d do it all again. Thank you!' },
];

function ctx(state) {
  const p = state.player;
  const hsYear = p.history.find((x) => x.stage === 'hs');
  return { town: p.hometown ?? 'my hometown', hs: hsYear?.teamId ?? 'my high school', rival: p.rivalName ?? null, titles: (p.titles ?? []).length, foundation: state.foundation?.name ?? null };
}

/** Write the speech. picks = { open, thanks: [id, id], close }. */
export function giveSpeech(state, picks) {
  const L = state.legacy;
  if (!L || L.speech) return L?.speech ?? null;
  const c = ctx(state);
  const open = SPEECH_OPENS.find((o) => o.id === picks.open) ?? SPEECH_OPENS[0];
  const all = speechThanks(state);
  const thanks = (picks.thanks ?? []).map((id) => all.find((t) => t.id === id)).filter(Boolean).slice(0, 2);
  const close = SPEECH_CLOSES.find((o) => o.id === picks.close) ?? SPEECH_CLOSES[0];
  const text = [open.line(c), ...thanks.map((t) => t.line(c)), close.line(c)].join(' ');
  L.speech = { open: open.id, thanks: thanks.map((t) => t.id), close: close.id, text };
  logJournal(state, 'retire', 'Gave your Hall of Fame induction speech.', { big: true });
  return L.speech;
}
