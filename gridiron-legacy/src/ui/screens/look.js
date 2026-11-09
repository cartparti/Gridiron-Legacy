// Character look editor: body, hair, face, tattoos, gear and celebration, with a live 3D pixel preview.
import { h, clear } from '../dom.js';
import { openModal, toast } from '../components.js';
import {
  SKIN_TONES, HAIR_COLORS, EYE_COLORS, GEAR_COLORS, HAIR_STYLES, BROWS, EYES, NOSES, MOUTHS, BEARDS, TATTOOS,
  SIDES, VISORS, CELEBRATIONS, HEIGHT_RANGE, WEIGHT_RANGE, fmtHeight, randomLook, sizeStatMods,
} from '../../data/looks.js';
import { portraitImg } from '../../scenes/portrait.js';
import { sfx } from '../../audio/sfx.js';
import { STAT_LABELS } from '../../data/positions.js';

const TABS = [['body', 'Body'], ['hair', 'Hair'], ['face', 'Face'], ['ink', 'Ink'], ['gear', 'Gear'], ['celeb', 'Celebrate']];

/**
 * Build the editor. opts: { look (mutated), uniform, number, position, lockBody, onChange }
 * Returns an element.
 */
export function lookEditor(opts) {
  const L = opts.look;
  const st = { tab: 'body', helmet: false, yaw: 0.35 };
  if (opts.lockBody) st.tab = 'hair';
  const wrap = h('div.look-editor');
  const changed = () => { opts.onChange?.(L); draw(); };
  const set = (k, v) => { sfx.click(); L[k] = v; changed(); };

  const chips = (label, list, key) => h('div.look-row', h('div.section-label', label),
    h('div.chip-row', list.map((o) => h(`button.opt${L[key] === o.id ? '.on' : ''}`, { onclick: () => set(key, o.id) }, o.label))));
  const swatches = (label, colors, key, { index = false, none = false } = {}) => h('div.look-row', h('div.section-label', label),
    h('div.swatch-row',
      none ? h(`button.sw.none${L[key] == null ? '.on' : ''}`, { 'aria-label': 'None', onclick: () => set(key, null) }, '—') : null,
      colors.map((c, i) => {
        const v = index ? i : c;
        return h(`button.sw${L[key] === v ? '.on' : ''}`, { style: { background: c }, 'aria-label': c, onclick: () => set(key, v) });
      })));
  const slider = (label, key, [a, b], fmt) => h('div.look-row', h('div.row.between', h('div.section-label', label), h('b.pix', fmt(L[key]))),
    h('input.slider', { type: 'range', min: a, max: b, value: L[key], oninput: (e) => { L[key] = Number(e.target.value); opts.onChange?.(L); draw(); } }));

  const preview = () => {
    const spec = { uniform: opts.uniform, look: { ...L }, number: opts.number ?? 1, helmet: st.helmet };
    return h('div.look-preview',
      h('div.look-stage', portraitImg(spec, 200, { full: true, big: true, yaw: st.yaw })),
      h('div.row', { style: { justifyContent: 'center', gap: '6px' } },
        h('button.btn.small', { 'aria-label': 'Turn left', onclick: () => { st.yaw -= 0.8; draw(); } }, '⟲'),
        h(`button.btn.small${st.helmet ? '.primary' : ''}`, { onclick: () => { st.helmet = !st.helmet; draw(); } }, st.helmet ? 'Helmet on' : 'Helmet off'),
        h('button.btn.small', { 'aria-label': 'Turn right', onclick: () => { st.yaw += 0.8; draw(); } }, '⟳'),
        h('button.btn.small', { onclick: () => {
          sfx.click();
          const keep = { heightIn: L.heightIn, weightLb: L.weightLb };
          Object.assign(L, randomLook(Math.random, { position: opts.position }), keep);
          changed();
        } }, '🎲')));
  };

  const body = () => {
    const mods = sizeStatMods(L, opts.position);
    const modTxt = Object.entries(mods).filter(([, v]) => v).map(([k, v]) => `${STAT_LABELS[k]} ${v > 0 ? '+' : ''}${v}`).join(' · ');
    return [
      swatches('Skin tone', SKIN_TONES, 'skin', { index: true }),
      opts.lockBody ? h('p.small.muted', `${fmtHeight(L.heightIn)} · ${L.weightLb} lb (set at creation)`) : [
        slider('Height', 'heightIn', HEIGHT_RANGE, fmtHeight),
        slider('Weight', 'weightLb', WEIGHT_RANGE, (v) => `${v} lb`),
        h('p.tiny.muted', modTxt ? `Starting ratings: ${modTxt}` : 'Average size for your position.'),
      ],
    ];
  };
  const views = {
    body,
    hair: () => [chips('Style', HAIR_STYLES, 'hairStyle'), swatches('Color', HAIR_COLORS, 'hairColor', { index: true })],
    face: () => [chips('Eyes', EYES, 'eyes'), swatches('Eye color', EYE_COLORS, 'eyeColor', { index: true }), chips('Brows', BROWS, 'brows'),
      chips('Nose', NOSES, 'nose'), chips('Mouth', MOUTHS, 'mouth'), chips('Facial hair', BEARDS, 'beard')],
    ink: () => [chips('Left arm', TATTOOS, 'tatL'), chips('Right arm', TATTOOS, 'tatR')],
    gear: () => [
      swatches('Cleats', GEAR_COLORS, 'cleats'),
      swatches('Gloves', GEAR_COLORS, 'gloves', { none: true }),
      chips('Wristbands', SIDES, 'wristband'), L.wristband !== 'none' ? swatches('Wristband color', GEAR_COLORS, 'wristColor') : null,
      chips('Arm sleeve', SIDES, 'sleeve'), L.sleeve !== 'none' ? swatches('Sleeve color', GEAR_COLORS, 'sleeveColor') : null,
      chips('Visor', VISORS, 'visor'),
      h('div.look-row', h('div.section-label', 'Eye black'), h('div.chip-row',
        h(`button.opt${L.eyeBlack ? '.on' : ''}`, { onclick: () => set('eyeBlack', true) }, 'On'),
        h(`button.opt${!L.eyeBlack ? '.on' : ''}`, { onclick: () => set('eyeBlack', false) }, 'Off'))),
    ],
    celeb: () => [chips('Touchdown celebration', CELEBRATIONS, 'celebration'), h('p.tiny.muted', 'Shown in the end zone after you score.')],
  };

  const draw = () => {
    clear(wrap);
    wrap.append(
      preview(),
      h('div.subtabs.look-tabs', TABS.map(([id, l]) =>
        h(`button.subtab${st.tab === id ? '.on' : ''}`, { onclick: () => { sfx.click(); st.tab = id; st.helmet = id === 'gear'; draw(); } }, l))),
      h('div.look-panel', views[st.tab]()));
  };
  draw();
  return wrap;
}

/** Modal editor for an existing athlete (body size is locked after creation). */
export function openLookModal(app, { uniform, onDone } = {}) {
  const p = app.state.player;
  const look = { ...p.look };
  const content = h('div');
  const m = openModal(content, { dismissable: true });
  content.append(
    h('div.row.between', h('h2', 'Your Look'), h('span.tiny.muted', 'Free to change')),
    lookEditor({ look, uniform, number: p.number, position: p.position, lockBody: true }),
    h('div.row', { style: { marginTop: '12px' } },
      h('button.btn.grow', { onclick: () => m.close() }, 'Cancel'),
      h('button.btn.primary.grow', { onclick: () => { p.look = look; app.save(); sfx.select(); toast('Look saved'); m.close(); onDone?.(); app.render(); } }, 'Save')));
  return m;
}
