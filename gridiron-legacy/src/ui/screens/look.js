// Character look editor: body, hair, face, tattoos, gear and celebration, with a live 3D pixel preview.
import { h, clear } from '../dom.js';
import { openModal, toast } from '../components.js';
import {
  SKIN_TONES, HAIR_COLORS, EYE_COLORS, GEAR_COLORS, HAIR_STYLES, BROWS, EYES, NOSES, MOUTHS, BEARDS, TATTOOS,
  SIDES, VISORS, CELEBRATIONS, SPATS, TOWELS, CHAINS, normalizeLook, MASKS, MASK_COLORS, STRIPES, FINISHES, HEIGHT_RANGE, WEIGHT_RANGE, fmtHeight, randomLook, sizeStatMods,
} from '../../data/looks.js';
import { portraitImg } from '../../scenes/portrait.js';
import { sfx } from '../../audio/sfx.js';
import { STAT_LABELS } from '../../data/positions.js';

const TABS = [['body', 'Body'], ['hair', 'Hair'], ['face', 'Face'], ['ink', 'Ink'], ['helmet', 'Helmet'], ['gear', 'Gear'], ['swag', 'Swag'], ['casual', 'Casual'], ['gala', 'Gala'], ['celeb', 'Celebrate']];
const CLOTHES = ['#f4f4f4', '#16181c', '#3a86ff', '#e63946', '#2a9d8f', '#f4a261', '#6d597a', '#ff006e', '#8ac926', '#264653', '#c8b38a', '#6c757d', '#1d3557', '#9c3d2b'];
const SUITS = ['#16181f', '#1d2a44', '#3b3f48', '#5a1e2a', '#f2f2f2', '#2f4a3a', '#7a5a2a'];

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
    const spec = st.tab === 'casual' ? { ...L, outfit: 'casual' } : st.tab === 'gala' ? { ...L, outfit: 'gala' } : { uniform: opts.uniform, look: { ...L }, number: opts.number ?? 1, helmet: st.helmet };
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
    helmet: () => [
      chips('Facemask', MASKS, 'maskStyle'),
      h('div.look-row', h('div.section-label', 'Facemask color'), h('div.swatch-row', MASK_COLORS.map((c) => h(`button.sw${L.maskColor === c ? '.on' : ''}`, {
        style: { background: c === 'team' ? `linear-gradient(135deg, ${opts.uniform?.stripe ?? '#ffd43b'} 50%, ${opts.uniform?.helmet ?? '#1d3557'} 50%)` : c }, 'aria-label': c, onclick: () => set('maskColor', c) })))),
      chips('Helmet stripe', STRIPES, 'helmetStripe'),
      chips('Shell finish', FINISHES, 'helmetFinish'),
      chips('Visor tint', VISORS, 'visor'),
      h('p.tiny.muted', 'Helmet colors come from your team. The facemask, stripe and finish are yours.'),
    ],
    gear: () => [
      swatches('Cleats', GEAR_COLORS, 'cleats'),
      swatches('Cleat stripe', GEAR_COLORS, 'cleatAccent'),
      chips('Spats / tape', SPATS, 'spats'),
      swatches('Gloves', GEAR_COLORS, 'gloves', { none: true }),
      chips('Visor tint', VISORS, 'visor'),
      h('div.look-row', h('div.section-label', 'Eye black'), h('div.chip-row',
        h(`button.opt${L.eyeBlack ? '.on' : ''}`, { onclick: () => set('eyeBlack', true) }, 'On'),
        h(`button.opt${!L.eyeBlack ? '.on' : ''}`, { onclick: () => set('eyeBlack', false) }, 'Off'))),
    ],
    swag: () => [
      chips('Arm sleeves', SIDES, 'sleeve'), L.sleeve !== 'none' ? swatches('Arm sleeve color', GEAR_COLORS, 'sleeveColor') : null,
      chips('Wristbands', SIDES, 'wristband'), L.wristband !== 'none' ? swatches('Wristband color', GEAR_COLORS, 'wristColor') : null,
      chips('Elbow pads', SIDES, 'elbowPad'), L.elbowPad !== 'none' ? swatches('Elbow pad color', GEAR_COLORS, 'elbowColor') : null,
      chips('Knee braces', SIDES, 'kneeBrace'), L.kneeBrace !== 'none' ? swatches('Brace color', GEAR_COLORS, 'kneeColor') : null,
      chips('Leg sleeves', SIDES, 'legSleeve'), L.legSleeve !== 'none' ? swatches('Leg sleeve color', GEAR_COLORS, 'legSleeveColor') : null,
      chips('Towel', TOWELS, 'towel'),
      h('div.look-row', h('div.section-label', 'Hand warmer'), h('div.chip-row',
        h(`button.opt${L.handWarmer ? '.on' : ''}`, { onclick: () => set('handWarmer', true) }, 'On'),
        h(`button.opt${!L.handWarmer ? '.on' : ''}`, { onclick: () => set('handWarmer', false) }, 'Off'))),
      chips('Chain', CHAINS, 'chain'),
    ],
    casual: () => [swatches('Shirt', CLOTHES, 'shirt'), swatches('Pants', CLOTHES, 'pants'), swatches('Shoes', CLOTHES, 'shoe'), h('p.tiny.muted', 'What you wear around town, at home and on your phone.')],
    gala: () => [swatches('Suit', SUITS, 'suit'), swatches('Tie', ['#c92a2a', '#1c7ed6', '#e8b730', '#16181c', '#f4f4f4', '#2f9e44', '#ae3ec9'], 'tie'), h('p.tiny.muted', 'Worn on draft night, award shows and the Hall of Fame.')],
    celeb: () => [chips('Touchdown celebration', CELEBRATIONS, 'celebration'), h('p.tiny.muted', 'Shown in the end zone after you score.')],
  };

  const draw = () => {
    clear(wrap);
    wrap.append(
      preview(),
      h('div.subtabs.look-tabs', TABS.map(([id, l]) =>
        h(`button.subtab${st.tab === id ? '.on' : ''}`, { onclick: () => { sfx.click(); st.tab = id; st.helmet = id === 'gear' || id === 'swag' || id === 'helmet'; draw(); } }, l))),
      h('div.look-panel', views[st.tab]()));
  };
  draw();
  return wrap;
}

/** Modal editor for an existing athlete (body size is locked after creation). */
export function openLookModal(app, { uniform, onDone } = {}) {
  const p = app.state.player;
  const look = normalizeLook({ ...p.look }, p.first + p.last);
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
