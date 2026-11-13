// Friends & leaderboard: share your friend card (a link or code), add friends' cards, compare careers, open a
// friend's card (portrait, team, stats, awards, house). Friends live in the settings, so every save slot sees them.
import { h, clear } from '../dom.js';
import { openModal, toast } from '../components.js';
import { sfx } from '../../audio/sfx.js';
import { portraitImg } from '../../scenes/portrait.js';
import { teamKits } from '../../data/kits.js';
import { costumeSpec } from '../../data/mascots.js';
import { POSITIONS } from '../../data/positions.js';
import { friendCard, careerId, addFriend, leaderboard, BOARDS, stageName, fmtMoney } from '../../sim/friends.js';
import { encodeCard, decodeCard, shareLink } from '../../core/friendcode.js';

const friendsOf = (app) => (app.settings.friends ??= []);
const saveFriends = (app, list) => { app.settings.friends = list; app.saveSettings(); };

/** Add a friend from a pasted code or link. Returns a short message. */
export async function addFriendFrom(app, text) {
  const card = await decodeCard(text);
  if (!card) return { ok: false, msg: 'That code didn\'t work. Copy the whole link or code your friend sent.' };
  const selfId = app.state?.player?.uid ?? null;
  const r = addFriend(friendsOf(app), card, selfId);
  if (r.status === 'bad') return { ok: false, msg: 'That code is from a different version of the game, or it got cut off.' };
  if (r.status === 'self') return { ok: false, msg: 'That\'s your own card!' };
  saveFriends(app, r.list);
  const name = `${r.card.first} ${r.card.last}`;
  return { ok: true, msg: r.status === 'added' ? `Added ${name} as a friend!` : r.status === 'updated' ? `Updated ${name}'s card.` : `You already have a newer card from ${name}.` };
}

/** A small portrait for a card: their costume if they're a mascot, otherwise them in their team's home uniform. */
function cardPortrait(c, size, opts = {}) {
  const team = c.team ? { id: c.team.id, name: c.team.name, city: c.team.city, colors: c.team.colors } : null;
  if (c.pos === 'MS') return portraitImg({ mascot: costumeSpec(c.look, c.team?.kind ?? 'bear', c.team?.colors) }, size, opts);
  if (!c.look) return h('div.fr-dot', { style: { background: c.team?.colors?.[0] ?? '#777', width: `${size * 0.8}px`, height: `${size}px` } });
  try {
    return portraitImg({ uniform: team ? teamKits(team).home : undefined, colors: team ? undefined : ['#555', '#ddd'], look: c.look, number: c.number, helmet: false }, size, opts);
  } catch { return h('div.fr-dot'); }
}

const ago = (t) => {
  const d = Math.max(0, Date.now() - (t ?? 0));
  if (d < 3600e3) return 'just now';
  if (d < 86400e3) return `${Math.round(d / 3600e3)} h ago`;
  return `${Math.round(d / 86400e3)} days ago`;
};
const posName = (c) => (c.pos === 'MS' ? `Mascot "${c.mascotName ?? ''}"` : POSITIONS[c.pos]?.label ?? c.pos);

/** Big card for one friend (or you). */
function openCard(app, c, { me = false, onRemove } = {}) {
  const box = h('div.fr-card');
  const m = openModal(box, { dismissable: true });
  box.append(
    h('div.fr-head',
      h('div.fr-pic', cardPortrait(c, 150, { full: true, big: true })),
      h('div.col.grow', { style: { gap: '4px' } },
        h('h2', `${c.first} ${c.last}`),
        h('span.small', posName(c)),
        c.team ? h('span.small.muted', `${c.team.city} ${c.team.name}`) : null,
        h('span.small.muted', `${stageName(c.stage)} · ${c.year} · age ${c.age}`),
        h('span.chip.gold.pix', c.tier || 'Rookie'),
        h('span.tiny.muted', me ? 'Your card right now' : `Card from ${ago(c.at)}`))),
    h('div.fr-stats',
      [['Legacy', c.legacy], ['Overall', c.ovr], ['Level', c.level], ['Fame', c.fame], ['Games', c.games], ['Wins', c.wins], ...c.stats, ['Titles', c.titles], ['Records', c.records], ['Bank', fmtMoney(c.money)]]
        .map(([l, v]) => h('div', h('b', String(v)), h('span', l)))),
    h('div.card.flat', h('h3', `Awards (${c.ind})`),
      c.awards.length ? h('div.chip-row', c.awards.map(([n, k]) => h('span.chip', `${k > 1 ? `${k}× ` : ''}${n}`))) : h('p.small.muted', 'No hardware yet.')),
    h('div.card.flat', h('h3', `🏠 ${c.house.name}`),
      c.house.rooms.length
        ? h('div.list', c.house.rooms.map(([room, lv, what]) => h('div.li', h('span.grow', h('b', room), what ? h('span.tiny.muted', ` · ${what}`) : null), h('span.fr-pips', '★'.repeat(lv) + '☆'.repeat(Math.max(0, 3 - lv))))))
        : h('p.small.muted', 'Nothing upgraded yet. Just the basics.')),
    h('div.row', { style: { gap: '8px', marginTop: '10px' } },
      !me && onRemove ? h('button.btn.ghost.grow', { onclick: () => { if (confirm(`Remove ${c.first} ${c.last} from your friends?`)) { onRemove(); m.close(); } } }, 'Remove friend') : null,
      h('button.btn.primary.grow', { onclick: () => m.close() }, 'Close')));
}

/** The friends page. In a career it shows "share my card"; on the title screen just your friends. */
export function friendsPage(app) {
  const wrap = h('div.col', { style: { gap: '14px' } });
  const ui = (app.ui.friends ??= { board: 'legacy', msg: '' });
  const st = app.state;
  let mine = null;
  try { mine = st?.player ? friendCard(st) : null; } catch (err) { console.error('friend card', err); }

  const share = async () => {
    sfx.click();
    if (!mine) return;
    app.save?.(); // keeps the career id
    const code = await encodeCard(mine);
    const link = shareLink(code);
    const text = `Add me on Gridiron Legacy: ${mine.first} ${mine.last}${mine.pos === 'MS' ? ' (mascot)' : ''}, legacy ${mine.legacy}. Open this link to add me:`;
    try {
      if (navigator.share) { await navigator.share({ title: 'Gridiron Legacy friend card', text, url: link }); return; }
    } catch (err) { if (err?.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(link); toast('Link copied. Send it to a friend!'); }
    catch { showCode(link); }
  };
  const showCode = (link) => {
    const ta = h('textarea.fr-code', { readOnly: true, rows: 5 }, link);
    const m = openModal(h('div', h('h2', 'Your friend link'), h('p.small.muted', 'Copy this and send it to a friend. Opening it adds you, or they can paste it into Add a friend.'), ta,
      h('button.btn.primary.block', { style: { marginTop: '10px' }, onclick: () => m.close() }, 'Done')), { dismissable: true });
    setTimeout(() => { ta.focus(); ta.select(); }, 50);
  };

  const draw = () => {
    clear(wrap);
    const friends = friendsOf(app);
    // your card
    if (mine) {
      wrap.append(h('div.card.hero',
        h('div.card-title', h('h2', 'Your friend card'), h('span.chip.pix', `LEGACY ${mine.legacy}`)),
        h('div.row', { style: { gap: '12px', alignItems: 'center' } },
          h('div.fr-pic.sm', cardPortrait(mine, 70)),
          h('div.grow', h('b', `${mine.first} ${mine.last}`), h('div.tiny.muted', `${posName(mine)} · ${stageName(mine.stage)} ${mine.year}`), h('div.tiny.muted', `${mine.ind} awards · ${mine.titles} titles · OVR ${mine.ovr}`))),
        h('p.tiny.muted', 'Share your card with friends. They see your career, awards and house as it is right now. Share again any time to update it.'),
        h('div.row', { style: { gap: '8px' } },
          h('button.btn.primary.grow', { onclick: share }, '📤 Share my card'),
          h('button.btn.grow', { onclick: () => openCard(app, mine, { me: true }) }, 'Preview'))));
    } else {
      wrap.append(h('div.card.flat', h('p.small.muted', 'Open one of your careers (Continue or Load) to share your own friend card.')));
    }
    // add a friend
    const input = h('textarea.fr-code', { rows: 2, placeholder: 'Paste a friend\'s link or code here' });
    wrap.append(h('div.card',
      h('h3', 'Add a friend'),
      h('p.tiny.muted', 'When a friend sends you their link, just open it and they\'re added. Or paste it here.'),
      input,
      ui.msg ? h(`p.small.${ui.ok ? 'good' : 'bad'}`, ui.msg) : null,
      h('button.btn.block', { style: { marginTop: '8px' }, onclick: async () => {
        const r = await addFriendFrom(app, input.value);
        ui.msg = r.msg; ui.ok = r.ok;
        if (r.ok) sfx.levelUp(); else sfx.error?.();
        draw();
      } }, 'Add friend')));
    // leaderboard
    const rows = leaderboard(friends, mine, ui.board);
    wrap.append(h('div.card',
      h('div.card-title', h('h2', 'Leaderboard'), h('span.tiny.muted', `${friends.length} friend${friends.length === 1 ? '' : 's'}`)),
      h('div.row.wrap', { style: { gap: '6px', marginBottom: '8px' } }, Object.entries(BOARDS).map(([id, b]) =>
        h(`button.subtab${ui.board === id ? '.on' : ''}`, { onclick: () => { sfx.click(); ui.board = id; draw(); } }, b.label))),
      rows.length
        ? h('div.list', rows.map((r) => h(`button.li.fr-row${r.me ? '.me' : ''}`, { onclick: () => openCard(app, r.card, { me: r.me, onRemove: () => { saveFriends(app, friendsOf(app).filter((x) => x.id !== r.card.id)); draw(); } }) },
          h('b.pix.lg-rank', r.rank),
          h('div.fr-pic.xs', cardPortrait(r.card, 40)),
          h('div.grow', h('b', `${r.card.first} ${r.card.last}${r.me ? ' (you)' : ''}`), h('div.tiny.muted', `${posName(r.card)} · ${r.card.team ? r.card.team.name : ''} · ${stageName(r.card.stage)}${r.me ? '' : ` · ${ago(r.card.at)}`}`)),
          h('b.pix', r.text))))
        : h('p.small.muted', 'No friends yet. Share your card and ask your friends to share theirs.')));
  };
  draw();
  return wrap;
}

/** Standalone screen (from the title). */
export function friendsScreen(app) {
  return h('div.screen.fr-screen',
    h('div.row.between', h('h1', 'Friends'), h('button.btn.small.ghost', { onclick: () => app.go('title') }, 'Back')),
    friendsPage(app));
}

export { careerId };
