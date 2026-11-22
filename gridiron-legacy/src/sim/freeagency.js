// Free agency pitches and visits: every offer comes with the team's pitch (your role, their scheme, the city, how
// good they are). Visit up to two teams to find out what they'd add in person: a signing bonus, a locker room that
// already loves you, a coach who builds around you, or a city your family will love. Only perks you visited for
// come with the deal. Pure sim.
import { rand, pick } from '../core/rng.js';
import { clamp } from '../core/util.js';
import { teamTendencies } from './scouting.js';
import { teamCulture, BIOME_INFO } from '../data/culture.js';

const PERKS = [
  { id: 'bonus', label: 'Signing bonus', text: (o) => `A ${Math.round(o.salary * 0.12 / 1e5) / 10}M signing bonus, paid on day one.` },
  { id: 'locker', label: 'Locker room ready', text: () => 'The veterans took you to dinner. You\'d walk into a locker room that already has your back (+teammates).' },
  { id: 'coach', label: 'Built around you', text: () => 'The head coach showed you a playbook built around you (+coach trust, a starting role).' },
  { id: 'family', label: 'Family-friendly', text: () => 'Great schools, a quiet neighborhood, a house with a yard. Your family loved it (+mood, +family).' },
];
const PITCHES = [
  'We have been watching you for years. You are the missing piece.',
  'Come win a title with us. This roster is ready right now.',
  'Our fans will love you. This city is football.',
  'We have the cap space and the vision. Be the face of what we build.',
];

/** Add the pitch to an offer (called from contractOffers). */
export function pitchOffer(state, o, team) {
  const p = state.player;
  const t = teamTendencies(team, state.career.year);
  const cul = teamCulture(team, 'pro');
  o.role = o.loyal ? (p.depth?.role === 'backup' ? 'Backup' : 'Starter') : (o.contender < 66 || rand(state) < 0.7 ? 'Starter' : 'Rotation');
  o.scheme = p.position === 'QB' || p.position === 'WR' ? (t.deep > 0.35 ? 'Air-it-out offense: lots of deep shots' : 'Quick, short passing game')
    : p.position === 'RB' ? (t.runHeavy > 0.5 ? 'Run-first offense: you get the ball' : 'Pass-first: fewer carries, more catches')
      : p.position === 'CB' ? (t.man > 0.55 ? 'Press-man defense: islands for corners' : 'Zone defense: read and react')
        : p.position === 'DT' ? (t.blitz > 0.3 ? 'Attacking front: get after the QB' : 'Two-gap front: eat blocks, stop the run')
          : 'Big crowds, big moments';
  o.city = `${BIOME_INFO[cul.biome]?.label ?? 'City'} · ${cul.trait?.label ?? 'home crowd'}`;
  o.pitch = o.loyal ? 'You built something here. Let\'s finish it together.' : pick(state, PITCHES);
  o.perk = pick(state, PERKS).id;
  o.visited = false;
  return o;
}

export const perkInfo = (o) => PERKS.find((x) => x.id === o.perk);
export const visitsLeft = (state) => 2 - (state.offers ?? []).filter((o) => o.visited).length;

/** Visit a team (max two): reveals their in-person perk. */
export function visitTeam(state, idx) {
  const o = state.offers?.[idx];
  if (!o || o.visited || visitsLeft(state) <= 0) return null;
  o.visited = true;
  const perk = perkInfo(o);
  return { ok: true, perk, text: `${o.city.split(' · ')[0]} visit: ${perk.text(o)}` };
}

/** Signing: apply the perk if you visited (called from signContract). */
export function applyPerk(state, o) {
  if (!o?.visited) return null;
  const p = state.player;
  if (o.perk === 'bonus') p.money += Math.round(o.salary * 0.12);
  if (o.perk === 'locker') p.rel.teammates = clamp((p.rel.teammates ?? 50) + 15, 0, 100);
  if (o.perk === 'coach') { p.rel.coach = clamp((p.rel.coach ?? 50) + 12, 0, 100); if (p.depth) p.depth.role = 'starter'; }
  if (o.perk === 'family') { p.mood = clamp(p.mood + 8, 0, 100); p.rel.family = clamp((p.rel.family ?? 50) + 6, 0, 100); }
  return perkInfo(o);
}
