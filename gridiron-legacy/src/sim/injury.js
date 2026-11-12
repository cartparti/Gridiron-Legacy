// How serious an injury is right now, and whether you can actually play on it.
import { INJURIES } from '../data/lifestyle.js';

export const INJURY_STATUS = {
  probable: { label: 'Probable', play: true, tol: 0.93, speed: 0.97, aggravate: 0.12, color: 'var(--warn)' },
  questionable: { label: 'Questionable', play: true, tol: 0.72, speed: 0.86, aggravate: 0.38, color: 'var(--warn)' },
  out: { label: 'Out', play: false, color: 'var(--bad)' },
  season: { label: 'Out for the season', play: false, color: 'var(--bad)' },
};

export const injuryDef = (inj) => (inj ? INJURIES.find((i) => i.id === inj.id) ?? null : null);

/** 'probable' | 'questionable' | 'out' | 'season' | null for this injury, this week, at this position. */
export function injuryStatus(inj, pos) {
  if (!inj) return null;
  const def = injuryDef(inj);
  const tier = def?.tier ?? (inj.major ? 'season' : 'moderate');
  if (tier === 'season' || inj.major) return inj.weeks > 2 ? 'season' : 'out';
  if (tier === 'minor') return 'probable';
  if (tier === 'moderate') return 'questionable';
  // out: back as questionable for the last few weeks (in a cast / brace), unless your position can't
  if (def?.limited && inj.weeks <= def.limited && !(def.noPlay ?? []).includes(pos)) return 'questionable';
  return 'out';
}

export function injuryInfo(inj, pos) {
  const s = injuryStatus(inj, pos);
  return s ? { status: s, ...INJURY_STATUS[s] } : null;
}

/** One line on why: what the doctors are saying. */
export function injuryNote(inj, pos) {
  const s = injuryStatus(inj, pos);
  const def = injuryDef(inj);
  if (!s) return '';
  if (s === 'season') return 'Surgery and months of rehab. There is no playing through this.';
  if (s === 'out') {
    if (inj.id === 'concussion') return 'Concussion protocol: no contact until the doctors clear you.';
    if (def?.bone) return 'The bone has to heal. Doctors will not clear you to play.';
    if (def?.limited && (def.noPlay ?? []).includes(pos)) return `You can't play ${pos} with this. You sit until it heals.`;
    if (def?.limited) return `Doctors won't clear you yet. In ${inj.weeks - def.limited} wk you can try to play through it.`;
    return 'Doctors will not clear you to play.';
  }
  if (s === 'questionable') return def?.tier === 'out' ? 'Cleared to play in a brace, but you are not 100% and it could flare up.' : 'You can play, but you will be slower and it could get worse.';
  return 'Sore, but you can play through it.';
}

/**
 * What happens in the game right after you get hurt on the field:
 * 'return' (shaken up, back after a series), 'out' (done for the day).
 */
export function inGameOutcome(injId, roll) {
  const def = INJURIES.find((i) => i.id === injId);
  const tier = def?.tier ?? 'moderate';
  if (tier === 'minor') return 'return';
  if (tier === 'moderate') return roll < 0.35 ? 'return' : 'out';
  return 'out';
}
