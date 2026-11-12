// Team → Lineup: your unit's starting 11 as player cards on a field, plus the bench.
import { costumeSpec, mascotDisplayName } from '../../data/mascots.js';
import { mascotKind } from '../crest.js';
import { h } from '../dom.js';
import { getTeam } from '../../sim/league.js';
import { randomLook, seededRandom } from '../../data/looks.js';
import { teamKits, kitUniform } from '../../data/kits.js';
import { FIRST_NAMES, LAST_NAMES } from '../../data/names.js';
import { portraitImg } from '../../scenes/portrait.js';

// slot -> [x%, y%, roster position, label]
const OFF = [
  ['WR1', 8, 18, 'WR', 'WR'], ['TE', 70, 30, 'TE', 'TE'], ['WR2', 92, 18, 'WR', 'WR'],
  ['OL1', 18, 42, 'OL', 'LT'], ['OL2', 34, 49, 'OL', 'LG'], ['OL3', 50, 42, 'OL', 'C'], ['OL4', 66, 49, 'OL', 'RG'], ['OL5', 82, 42, 'OL', 'RT'],
  ['SL', 28, 66, 'WR', 'SL'], ['QB', 50, 66, 'QB', 'QB'], ['RB', 72, 66, 'RB', 'RB'],
];
const DEF = [
  ['FS', 30, 14, 'S', 'FS'], ['SS', 70, 14, 'S', 'SS'],
  ['CB1', 8, 34, 'CB', 'CB'], ['LB1', 36, 36, 'LB', 'LB'], ['LB2', 64, 36, 'LB', 'LB'], ['CB2', 92, 34, 'CB', 'CB'],
  ['DE1', 12, 60, 'DL', 'DE'], ['DT1', 36, 64, 'DL', 'DT'], ['DT2', 64, 64, 'DL', 'DT'], ['DE2', 88, 60, 'DL', 'DE'], ['NB', 50, 84, 'CB', 'NB'],
];
const MY_SLOT = { QB: 'QB', RB: 'RB', WR: 'WR2', CB: 'CB2', DT: 'DT2' };

/** Roster for your team: real league players in the pros, generated (but stable) players otherwise. */
function roster(st, team) {
  if (st.league.kind === 'pro' && st.league.players?.length) {
    return st.league.players.filter((x) => x.teamId === team.id).map((x) => ({ name: `${x.first} ${x.last}`, pos: x.pos, ovr: Math.round(x.ovr), seed: `${x.first}${x.last}` }));
  }
  const out = [];
  const need = { QB: 2, RB: 2, WR: 5, TE: 2, OL: 7, DL: 6, LB: 4, CB: 4, S: 3 };
  for (const [pos, n] of Object.entries(need)) {
    for (let i = 0; i < n; i++) {
      const r = seededRandom(`${team.id}:${st.career.year}:${pos}:${i}`);
      const base = st.league.kind === 'college' ? 58 : 44;
      out.push({ name: `${FIRST_NAMES[Math.floor(r() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(r() * LAST_NAMES.length)]}`, pos, ovr: Math.round(base + (team.base - 60) * 0.4 + r() * 16 - i * 4), seed: `${team.id}${pos}${i}` });
    }
  }
  return out;
}

export function lineupView(app) {
  const st = app.state;
  const p = st.player;
  const team = getTeam(st.league, st.career.teamId);
  const defense = p.position === 'CB' || p.position === 'DT';
  const unit = defense ? DEF : OFF;
  const uni = kitUniform(teamKits(team).home);
  const all = roster(st, team).sort((a, b) => b.ovr - a.ovr);
  const used = new Set();
  const mySlot = MY_SLOT[p.position];
  const captain = (p.rel.teammates ?? 0) >= 70 || p.fame >= 55;
  const cards = unit.map(([slot, x, y, pos, label]) => {
    let pl;
    if (slot === mySlot) pl = { name: `${p.first} ${p.last}`, pos, ovr: Math.round(p.ovr), you: true, look: p.look, number: p.number };
    else {
      const posKey = pos === 'TE' ? 'TE' : pos;
      pl = all.find((r) => r.pos === posKey && !used.has(r)) ?? all.find((r) => !used.has(r));
      if (pl) used.add(pl);
    }
    const look = pl?.look ?? randomLook(pl?.seed ?? slot, { position: pos });
    const num = pl?.number ?? (1 + (seededRandom(pl?.seed ?? slot)() * 98 | 0));
    return h(`div.lu-card${pl?.you ? '.you' : ''}${pos === 'OL' ? '.sm' : ''}`, { style: { left: `${x}%`, top: `${y}%` } },
      h('div.lu-pic', portraitImg({ uniform: uni, look, number: num, helmet: false }, 58), h('span.lu-pos.pix', label), h('span.lu-ovr.pix', pl?.ovr ?? '-'), pl?.you && captain ? h('span.lu-c.pix', 'C') : null),
      h('div.lu-name', (pl?.name ?? 'Open').split(' ').slice(-1)[0]));
  });
  if (p.position === 'MS') { // the mascot works the sideline
    cards.push(h('div.lu-card.you', { style: { left: '50%', top: '95%' } },
      h('div.lu-pic', portraitImg({ mascot: costumeSpec(p.look, mascotKind(team), team.colors) }, 58), h('span.lu-pos.pix', 'MASCOT'), h('span.lu-ovr.pix', Math.round(p.ovr)), captain ? h('span.lu-c.pix', 'C') : null),
      h('div.lu-name', mascotDisplayName(p).split(' ').slice(-1)[0])));
  }
  const bench = all.filter((r) => !used.has(r)).slice(0, 10);
  return h('div.col', { style: { gap: '14px' } },
    h('div.card',
      h('div.card-title', h('h2', defense ? 'Starting Defense' : 'Starting Offense'), h('span.chip.pix', `${team.name}`)),
      h('p.tiny.muted', captain ? 'You wear the captain\'s C. The locker room follows your lead.' : 'Earn your teammates\' trust (or fame) to become a captain.'),
      h('div.lu-field', h('i.lu-los'), cards)),
    h('div.card', h('h3', 'Depth Chart · Bench'), h('div.list', bench.map((r) => h('div.li', h('span.chip.pix', r.pos), h('span.grow', r.name), h('b.pix', r.ovr))))));
}
