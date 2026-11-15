// Copy / paste a character's look: a clipboard kept in settings (shared by every save slot), looks from your other
// save slots, and a "GLL1." code you can send to yourself (or a friend) to move a look between devices.
import { h } from './dom.js';
import { openModal, toast } from './components.js';
import { sfx } from '../audio/sfx.js';
import { normalizeLook } from '../data/looks.js';
import { listSlots, loadGame } from '../core/storage.js';
import { POSITIONS } from '../data/positions.js';

const b64u = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

/** "GLL1.<base64url json>" */
export function encodeLook(look, meta = {}) {
  return `GLL1.${b64u(JSON.stringify({ v: 1, look, name: meta.name ?? '', pos: meta.pos ?? '' }))}`;
}
/** Finds a look code anywhere in pasted text. Returns { look, name, pos } or null. */
export function decodeLook(text) {
  const m = /GLL1\.([A-Za-z0-9_-]{20,})/.exec(String(text ?? ''));
  if (!m) return null;
  try {
    const o = JSON.parse(unb64u(m[1]));
    if (!o || typeof o.look !== 'object' || !o.look || Array.isArray(o.look)) return null;
    return { look: o.look, name: String(o.name ?? '').slice(0, 40), pos: String(o.pos ?? '').slice(0, 4) };
  } catch {
    return null;
  }
}

/** Copy a look to the in-game clipboard (and the system clipboard as a code). */
export async function copyLook(app, look, meta = {}) {
  const clip = { look: JSON.parse(JSON.stringify(look)), name: meta.name ?? '', pos: meta.pos ?? '', at: Date.now() };
  app.settings.lookClip = clip;
  app.saveSettings();
  let sys = false;
  try { await navigator.clipboard?.writeText(encodeLook(clip.look, clip)); sys = true; } catch { /* clipboard blocked: the in-game copy still works */ }
  sfx.select();
  toast(sys ? 'Look copied. Paste it when you create your next athlete.' : 'Look copied.');
}

/**
 * The look to put on a character: a deep copy, upgraded to the current look format, always a guy (players are guys).
 * keepSize: keep the target's height and weight (in a career they're locked; for a new player at another position
 * the size that fits the position is kept).
 */
export function lookFrom(src, target, { keepSize = false, seed = 'paste' } = {}) {
  const L = normalizeLook(JSON.parse(JSON.stringify(src)), seed);
  // keep every choice (hair included): only the things players never wear go
  if (L.gender === 'f') { L.lips = 'none'; L.dress = null; }
  L.gender = 'm';
  if (keepSize && target) { L.heightIn = target.heightIn; L.weightLb = target.weightLb; }
  return L;
}

/** Every look you could paste: the clipboard, then the characters in your save slots. */
export function lookSources(app, { exceptSlot = null } = {}) {
  const out = [];
  const clip = app.settings.lookClip;
  if (clip?.look) out.push({ id: 'clip', label: clip.name ? `${clip.name} (copied)` : 'Copied look', name: clip.name || 'the copied', pos: clip.pos, look: clip.look });
  for (const s of listSlots()) {
    if (s.empty || s.slot === exceptSlot) continue;
    const st = loadGame(s.slot);
    const p = st?.player;
    if (!p?.look) continue;
    out.push({ id: `slot${s.slot}`, label: `${p.first} ${p.last}`, name: `${p.first} ${p.last}`, pos: p.position, look: p.look, sub: `Save slot ${s.slot + 1}${st.career?.stage === 'retired' ? ' · retired' : ''}` });
  }
  return out;
}

/** Copy / paste buttons for a look editor. onPaste(srcLook, srcPos) applies it. */
export function lookClipBar(app, { look, meta, onPaste, exceptSlot = null }) {
  const pick = () => {
    const sources = lookSources(app, { exceptSlot });
    const content = h('div');
    const m = openModal(content, { dismissable: true });
    let code = '';
    const use = (src) => { m.close(); onPaste(src.look, src.pos, src.name ?? src.label); };
    content.append(
      h('h2', 'Use a saved look'),
      h('p.small.muted', 'Put the look from one of your characters on this one: face, hair, tattoos, gear, everything.'),
      sources.length ? h('div.list', sources.map((s) => h('button.li.look-src', { onclick: () => { sfx.click(); use(s); } },
        h('div.grow', h('b', s.label), h('div.tiny.muted', [POSITIONS[s.pos]?.label, s.sub].filter(Boolean).join(' · '))),
        h('span.chip.pix', 'USE'))))
        : h('p.small.muted', 'No saved looks yet. Tap "Copy look" on a character (Career > Edit look) to save one.'),
      h('div.tiny.pix.muted', { style: { marginTop: '12px' } }, 'OR PASTE A LOOK CODE'),
      h('textarea.look-code', { rows: 2, placeholder: 'GLL1....', oninput: (e) => { code = e.target.value; } }),
      h('div.row', { style: { marginTop: '8px', gap: '8px' } },
        h('button.btn.grow', { onclick: () => m.close() }, 'Cancel'),
        h('button.btn.primary.grow', { onclick: () => {
          const d = decodeLook(code);
          if (!d) { toast('That is not a look code.'); return; }
          use({ look: d.look, pos: d.pos, label: d.name || 'Pasted look' });
        } }, 'Paste code')));
  };
  const clip = app.settings.lookClip;
  return h('div.look-clip',
    h('button.btn.small', { onclick: () => copyLook(app, look, meta) }, '📋 Copy look'),
    h('button.btn.small', { onclick: () => { sfx.click(); pick(); } }, clip?.look ? `📥 Paste look${clip.name ? ` (${clip.name.split(' ')[0]})` : ''}` : '📥 Use a saved look'));
}
