// Friends and leaderboards without a server: your career packs into a "friend card" (a snapshot), you share it as a
// link or code, and friends keep the cards they've been sent. Pure sim (no DOM): building, checking and ranking cards.
import { computeLegacy } from './legacy.js';
import { mainStats, myTrophies } from './legends.js';
import { awardLabel } from './awards.js';
import { getTeam } from './league.js';
import { HOME_UPGRADES } from '../data/home.js';
import { placeFor } from '../data/places.js';
import { mascotKind, mascotDisplayName } from '../data/mascots.js';
import { POSITIONS } from '../data/positions.js';

export const CARD_VERSION = 1;
export const MAX_FRIENDS = 60;

const STAGE_NAMES = { hs: 'High school', college: 'College', pro: 'Pro', retired: 'Retired' };

/** A stable id for this career (so a friend's newer card replaces their old one). */
export function careerId(state) {
  const p = state.player;
  p.uid ??= `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return p.uid;
}

/** Your career as a friend card: everything a friend sees, nothing private (no texts, no relationships). */
export function friendCard(state) {
  const p = state.player;
  const team = state.league ? getTeam(state.league, state.career.teamId) : null;
  const stage = state.career.stage ?? 'hs';
  const L = computeLegacy(state);
  const counts = {};
  for (const a of p.awards ?? []) counts[a.name] = (counts[a.name] ?? 0) + 1;
  const cs = p.careerStats ?? {};
  const home = placeFor('home', stage === 'retired' ? 'pro' : stage);
  const lv = (u) => (p.home ?? {})[u.id] ?? 0;
  return {
    v: CARD_VERSION,
    id: careerId(state),
    at: Date.now(),
    first: p.first, last: p.last, pos: p.position, number: p.number, age: p.age, hometown: p.hometown,
    mascotName: p.position === 'MS' ? mascotDisplayName(p) : null,
    stage, year: state.career.year,
    team: team ? { id: team.id, name: team.name, city: team.city, colors: team.colors, kind: mascotKind(team) } : null,
    ovr: Math.round(p.ovr ?? 0), level: p.level ?? 1, fame: Math.round(p.fame ?? 0), money: Math.round(p.money ?? 0),
    legacy: L.score, tier: L.tier?.label ?? '',
    awards: Object.entries(counts).map(([n, c]) => [awardLabel(n, p.position), c]),
    ind: myTrophies(p).ind, titles: (p.titles ?? []).length, records: (p.records ?? []).length,
    games: cs.games ?? 0, wins: cs.wins ?? 0,
    stats: mainStats(p.position, cs).map(([, label, v]) => [label, Math.round(v)]),
    seasons: (p.history ?? []).length,
    house: { name: home?.name ?? 'Home', rooms: HOME_UPGRADES.filter((u) => lv(u) > 0).map((u) => [u.label, lv(u), u.levels[lv(u) - 1] ?? null]) },
    look: p.look ?? null,
  };
}

const str = (v, n = 40) => (typeof v === 'string' ? v.slice(0, n) : '');
const num = (v, lo = 0, hi = 1e12) => (Number.isFinite(+v) ? Math.max(lo, Math.min(hi, Math.round(+v))) : 0);
const col = (v) => (typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : '#666666');

/** A card that came from someone else: keep only what we know, with sane sizes and types. Returns null if it's junk. */
export function cleanCard(c) {
  if (!c || typeof c !== 'object' || c.v !== CARD_VERSION || typeof c.id !== 'string' || !c.first) return null;
  const pos = POSITIONS[c.pos] ? c.pos : 'QB';
  return {
    v: CARD_VERSION, id: str(c.id, 40), at: num(c.at, 0, 1e14),
    first: str(c.first, 24), last: str(c.last, 24), pos, number: num(c.number, 0, 99), age: num(c.age, 0, 99), hometown: str(c.hometown, 40),
    mascotName: c.mascotName ? str(c.mascotName, 24) : null,
    stage: STAGE_NAMES[c.stage] ? c.stage : 'hs', year: num(c.year, 1900, 3000),
    team: c.team ? { id: str(c.team.id, 12), name: str(c.team.name, 30), city: str(c.team.city, 30), colors: [col(c.team.colors?.[0]), col(c.team.colors?.[1])], kind: str(c.team.kind, 16) || 'shield' } : null,
    ovr: num(c.ovr, 0, 99), level: num(c.level, 1, 999), fame: num(c.fame, 0, 100), money: num(c.money, -1e12, 1e12),
    legacy: num(c.legacy, -1e6, 1e6), tier: str(c.tier, 30),
    awards: Array.isArray(c.awards) ? c.awards.slice(0, 40).filter(Array.isArray).map(([n, k]) => [str(n, 50), num(k, 0, 999)]).filter(([n]) => n) : [],
    ind: num(c.ind, 0, 999), titles: num(c.titles, 0, 99), records: num(c.records, 0, 99),
    games: num(c.games, 0, 9999), wins: num(c.wins, 0, 9999),
    stats: Array.isArray(c.stats) ? c.stats.slice(0, 4).filter(Array.isArray).map(([l, v]) => [str(l, 20), num(v, -1e6, 1e7)]) : [],
    seasons: num(c.seasons, 0, 60),
    house: { name: str(c.house?.name, 30) || 'Home', rooms: Array.isArray(c.house?.rooms) ? c.house.rooms.slice(0, 12).filter(Array.isArray).map(([l, lv, nm]) => [str(l, 30), num(lv, 0, 3), nm ? str(nm, 40) : null]) : [] },
    look: c.look && typeof c.look === 'object' && !Array.isArray(c.look) ? c.look : null,
  };
}

/** Add or update a friend (newest card wins). Returns { list, status: 'added' | 'updated' | 'older' | 'self' | 'bad', card }. */
export function addFriend(list, card, selfId = null) {
  const c = cleanCard(card);
  if (!c) return { list, status: 'bad' };
  if (selfId && c.id === selfId) return { list, status: 'self' };
  const i = list.findIndex((x) => x.id === c.id);
  if (i >= 0) {
    if ((list[i].at ?? 0) > c.at) return { list, status: 'older', card: list[i] };
    const next = list.slice(); next[i] = c;
    return { list: next, status: 'updated', card: c };
  }
  return { list: [c, ...list].slice(0, MAX_FRIENDS), status: 'added', card: c };
}

const money = (v) => (Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1e3)}K`);
export const BOARDS = {
  legacy: { label: 'Legacy', value: (c) => c.legacy, fmt: (v) => `${v}` },
  ovr: { label: 'Overall', value: (c) => c.ovr, fmt: (v) => `${v} OVR` },
  awards: { label: 'Awards', value: (c) => c.ind, fmt: (v) => `${v} awards` },
  titles: { label: 'Titles', value: (c) => c.titles, fmt: (v) => `${v} titles` },
  fame: { label: 'Fame', value: (c) => c.fame, fmt: (v) => `${v} fame` },
  money: { label: 'Money', value: (c) => c.money, fmt: money },
};
export const fmtMoney = money;

/** Ranked rows for one board: friends plus you (marked). */
export function leaderboard(friends, me, board = 'legacy') {
  const b = BOARDS[board] ?? BOARDS.legacy;
  const rows = [...friends.map((c) => ({ card: c, me: false })), ...(me ? [{ card: me, me: true }] : [])];
  rows.sort((a, z) => b.value(z.card) - b.value(a.card));
  return rows.map((r, i) => ({ ...r, rank: i + 1, value: b.value(r.card), text: b.fmt(b.value(r.card)) }));
}

export const stageName = (s) => STAGE_NAMES[s] ?? s;
