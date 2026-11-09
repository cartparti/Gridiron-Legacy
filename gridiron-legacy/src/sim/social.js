// People in your life and personal interactions with them.
import { INTERACTIONS, INTERACTION_BY_ID } from '../data/interactions.js';
import { ITEM_BY_ID } from '../data/items.js';
import { FIRST_NAMES, LAST_NAMES } from '../data/names.js';
import { clamp, fillTokens } from '../core/util.js';
import { rand, randInt, pick } from '../core/rng.js';
import { applyEffects } from './effects.js';
import { maxEnergy, planCost } from './week.js';
import { randomLook as genLook, normalizeLook, defaultLook } from '../data/looks.js';

const MATE_POS = ['OL', 'DL', 'LB', 'S', 'TE', 'WR', 'RB', 'QB', 'CB'];

export function randomLook(h, position) {
  return genLook(() => rand(h), { position });
}

/** Three named teammates: your closest friends on the current team. */
export function genTeammates(state) {
  const p = state.player;
  const used = new Set();
  p.teammates = [];
  for (let i = 0; i < 3; i++) {
    let name;
    do name = `${pick(state, FIRST_NAMES)} ${pick(state, LAST_NAMES)}`; while (used.has(name));
    used.add(name);
    const pos = pick(state, MATE_POS.filter((x) => x !== p.position));
    p.teammates.push({ id: `mate${i}`, name, pos, bond: randInt(state, 42, 58), look: randomLook(state, pos) });
  }
  p.teamLook = randomLook(state);
}

function ensure(state) {
  const p = state.player;
  if (!p.teammates?.length) genTeammates(state);
  p.familyLook ??= randomLook(state);
  p.partnerLook ??= randomLook(state);
  p.coachLook ??= randomLook(state);
  p.agentLook ??= randomLook(state);
  p.rivalLook ??= randomLook(state);
  p.look = p.look ? normalizeLook(p.look, p.first + p.last) : defaultLook(p.position);
  for (const m of p.teammates) m.look = normalizeLook(m.look, m.name);
  for (const k of ['familyLook', 'partnerLook', 'coachLook', 'agentLook', 'rivalLook']) p[k] = normalizeLook(p[k], k + p.last);
}

/** Everyone you can interact with right now. */
export function people(state) {
  ensure(state);
  const p = state.player;
  const list = [
    { key: 'coach', kind: 'coach', name: `Coach ${p.coachName.split(' ').slice(-1)[0]}`, short: p.coachName.split(' ').slice(-1)[0], value: p.rel.coach, look: p.coachLook, title: 'Head coach' },
    ...p.teammates.map((m) => ({ key: m.id, kind: 'teammate', name: m.name, short: m.name.split(' ')[0], value: m.bond, look: m.look, title: `Teammate · ${m.pos}` })),
    { key: 'family', kind: 'family', name: 'Mom', short: 'Mom', value: p.rel.family, look: p.familyLook, title: 'Family' },
  ];
  if (p.partnerName) list.push({ key: 'partner', kind: 'partner', name: p.partnerName, short: p.partnerName, value: p.rel.partner, look: p.partnerLook, title: p.flags.married ? 'Spouse' : 'Partner' });
  if (p.agentName) list.push({ key: 'agent', kind: 'agent', name: p.agentName, short: p.agentName.split(' ')[0], value: p.rel.agent, look: p.agentLook, title: 'Agent' });
  list.push({ key: 'rival', kind: 'rival', name: p.rivalName, short: p.rivalName.split(' ')[0], value: p.rel.rival, look: p.rivalLook, title: 'Rival' });
  return list;
}

export function findPerson(state, key) {
  if (key === 'fan') return { key: 'fan', kind: 'fan', name: 'A fan', short: 'Fan', value: state.player.fame, title: 'Fan' };
  return people(state).find((x) => x.key === key) ?? null;
}

function condOk(state, person, it) {
  const c = it.cond ?? {};
  const p = state.player;
  if (c.minRel !== undefined && person.value < c.minRel) return false;
  if (c.maxRel !== undefined && person.value > c.maxRel) return false;
  if (c.pro && state.career.stage !== 'pro') return false;
  if (c.flag && !p.flags[c.flag]) return false;
  if (c.notFlag && p.flags[c.notFlag]) return false;
  return true;
}

function chatKey(person, it) { return `${person.key}:${it.id}`; }

/** Interactions available with a person, each with { ok, why }. */
export function interactionsFor(state, person) {
  const p = state.player;
  const left = state.week ? maxEnergy(state) - planCost(state.week.plan) : 0;
  const freeSlot = state.week ? state.week.plan.findIndex((x) => !x) : -1;
  return INTERACTIONS.filter((it) => it.who.includes(person.kind) && condOk(state, person, it)).map((it) => {
    let why = null;
    if (!state.week || state.phase !== 'plan') why = 'Only during the week';
    else if (it.cost > 0 && freeSlot < 0) why = 'No free days left';
    else if (it.cost > left) why = 'Not enough energy';
    else if (it.money && p.money < it.money) why = 'Not enough money';
    else if (it.cost === 0 && state.week.chats?.[chatKey(person, it)]) why = 'Already this week';
    return { ...it, ok: !why, why };
  });
}

function tier(v) { return v < 35 ? 'low' : v >= 70 ? 'high' : 'mid'; }

/** Start an interaction: returns what they say and your response options. */
export function openInteraction(state, personKey, id) {
  const person = findPerson(state, personKey);
  const it = INTERACTION_BY_ID[id];
  const line = it.lines[tier(person.value)] || it.lines.mid || it.lines.high;
  return { person, it, line: fillTokens(line, { name: person.short }), responses: it.responses.map((r) => ({ label: fillTokens(r.label, { name: person.short }), risky: !!r.chance })) };
}

function changeBond(state, person, delta) {
  const p = state.player;
  if (!delta) return null;
  if (person.kind === 'teammate') {
    const m = p.teammates.find((x) => x.id === person.key);
    const before = m.bond;
    m.bond = clamp(m.bond + delta, 0, 100);
    p.rel.teammates = clamp(p.rel.teammates + delta * 0.4, 0, 100);
    return { label: person.short, delta: m.bond - before, text: `${m.bond - before > 0 ? '+' : ''}${Math.round(m.bond - before)}` };
  }
  const key = person.kind === 'fan' ? null : person.kind;
  if (!key || p.rel[key] === null || p.rel[key] === undefined) return null;
  const before = p.rel[key];
  p.rel[key] = clamp(p.rel[key] + delta, 0, 100);
  return { label: person.short, delta: p.rel[key] - before, text: `${p.rel[key] - before > 0 ? '+' : ''}${Math.round(p.rel[key] - before)}` };
}

/** Record that a day was spent on something already applied (shows in the week planner). */
export function useDaySlot(state, label, icon, cost) {
  const i = state.week.plan.findIndex((x) => !x);
  if (i < 0) return false;
  state.week.plan[i] = { done: true, label, icon, cost };
  return true;
}

/** Pick a response. Applies costs and effects; returns { result, changes }. */
export function respond(state, personKey, id, idx) {
  const p = state.player;
  const person = findPerson(state, personKey);
  const it = INTERACTION_BY_ID[id];
  const r = it.responses[idx];
  let branch = r;
  let success = null;
  if (r.chance) {
    let pr = r.chance.p;
    if (r.chance.stat) pr += (p.stats[r.chance.stat] - 50) / 200;
    if (r.chance.relScale) pr += (person.value - 50) / 150;
    success = rand(state) < Math.min(0.95, Math.max(0.05, pr));
    branch = success ? r.chance.success : r.chance.fail;
  }
  if (it.money) p.money -= it.money;
  if (it.cost > 0) useDaySlot(state, `${it.label} (${person.short})`, person.kind, it.cost);
  else { state.week.chats = state.week.chats ?? {}; state.week.chats[chatKey(person, it)] = true; }
  const { bond, extraMoment, ...rest } = branch.effects ?? {};
  const changes = [];
  const b = changeBond(state, person, bond);
  if (b) changes.push(b);
  if (extraMoment) { state.week.extraMoments = (state.week.extraMoments ?? 0) + extraMoment; changes.push({ label: 'Extra moment', delta: 1, text: 'next game' }); }
  changes.push(...applyEffects(state, rest));
  if (it.money) changes.push({ label: 'Money', delta: -1, text: `-$${it.money.toLocaleString()}` });
  return { result: fillTokens(branch.result ?? '', { name: person.short }), changes, success };
}

/** Give a gift from your inventory. */
export function giveGift(state, personKey, itemId) {
  const p = state.player;
  const person = findPerson(state, personKey);
  const item = ITEM_BY_ID[itemId];
  if (!item?.gift || !(p.inventory?.[itemId] > 0)) return null;
  const kind = person.kind === 'teammate' ? 'teammates' : person.kind;
  const amt = item.gift[kind] ?? 2;
  p.inventory[itemId]--;
  const b = changeBond(state, person, amt);
  const reactions = amt >= 10 ? 'They are speechless. That meant a lot.' : amt > 3 ? 'They love it.' : amt > 0 ? 'A polite thank-you.' : 'That... did not land.';
  return { result: `You give ${person.short} the ${item.name.toLowerCase()}. ${reactions}`, changes: b ? [b] : [] };
}

export function giftsOwned(state) {
  const inv = state.player.inventory ?? {};
  return Object.entries(inv).filter(([, n]) => n > 0).map(([id, n]) => ({ item: ITEM_BY_ID[id], n })).filter((x) => x.item);
}
