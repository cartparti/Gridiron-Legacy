// Character look editor: body, hair, face, tattoos, gear and celebration, with a live 3D pixel preview.
import { mascotKind } from '../crest.js';
import { h, clear } from '../dom.js';
import { openModal, toast } from '../components.js';
import {
  SKIN_TONES, HAIR_COLORS, EYE_COLORS, GEAR_COLORS, HAIR_STYLES, BROWS, EYES, NOSES, MOUTHS, BEARDS, TATTOOS,
  SIDES, VISORS, CELEBRATIONS, SPATS, TOWELS, CHAINS, normalizeLook,
  HEAD_SHAPES, JAWS, CHEEKS, CHINS, FACE_WIDTHS, BODY_TYPES, NECK_TATTOOS, JERSEY_SLEEVES, JERSEY_LENGTHS, JERSEY_FITS, PAD_SIZES, PAD_EXTRAS, SOCKS, MOUTHGUARDS, CLEAT_DESIGNS, CLEAT_CUTS, GLOVE_DESIGNS, MASKS, MASK_COLORS, STRIPES, FINISHES, HEIGHT_RANGE, WEIGHT_RANGE, fmtHeight, randomLook, sizeStatMods, FACE_SLIDER_DEFS, FACE_PRESETS,
} from '../../data/looks.js';
import { portraitImg } from '../../scenes/portrait.js';
import { sfx } from '../../audio/sfx.js';
import { STAT_LABELS, statLabel } from '../../data/positions.js';
import { COSTUME_ANIMALS, COSTUME_FURS, COSTUME_EYES, COSTUME_MOUTHS, COSTUME_HATS, COSTUME_EXTRAS, COSTUME_SHOES, costumeOf, costumeSpec, mascotName } from '../../data/mascots.js';

// tabs in three groups: you, your uniform, off the field
const TABS = [
  ['body', 'Body', '🧍'], ['face', 'Face', '🙂'], ['hair', 'Hair', '💇'], ['ink', 'Ink', '🖋️'],
  ['jersey', 'Jersey', '👕'], ['helmet', 'Helmet', '🏈'], ['gear', 'Gear', '👟'], ['swag', 'Swag', '⌚'],
  ['casual', 'Casual', '🧢'], ['gala', 'Gala', '🤵'], ['celeb', 'Celebrate', '🎉'],
  ['suit', 'Costume', '🐾'], ['cface', 'Mask face', '😜'], ['cextra', 'Extras', '🎩'],
];
// the mascot doesn't wear football gear: the costume replaces the uniform tabs (and there's no TD celebration)
const MASCOT_GROUPS = [['You (out of the suit)', ['body', 'face', 'hair', 'ink']], ['Costume', ['suit', 'cface', 'cextra']], ['Off the field', ['casual', 'gala']]];
const COSTUME_TABS = new Set(['suit', 'cface', 'cextra']);
const TAB_GROUPS = [['You', ['body', 'face', 'hair', 'ink']], ['Uniform', ['jersey', 'helmet', 'gear', 'swag']], ['Off the field', ['casual', 'gala', 'celeb']]];
const CLOTHES = ['#f4f4f4', '#16181c', '#3a86ff', '#e63946', '#2a9d8f', '#f4a261', '#6d597a', '#ff006e', '#8ac926', '#264653', '#c8b38a', '#6c757d', '#1d3557', '#9c3d2b'];
// What the preview shows: each tab has a default view, and changing an option moves the camera to that part
// (and puts the helmet on for things you only see with it on).
const TAB_VIEW = { body: 'full', face: 'face', hair: 'face', ink: 'upper', jersey: 'upper', helmet: 'face', gear: 'full', swag: 'full', casual: 'full', gala: 'full', celeb: 'full' };
const KEY_VIEW = {
  sockStyle: 'legs', cleats: 'legs', cleatDesign: 'legs', cleatAccent: 'legs', cleatCut: 'legs', spats: 'legs', kneeBrace: 'legs', kneeColor: 'legs',
  legSleeve: 'legs', legSleeveColor: 'legs', gloves: 'upper', gloveDesign: 'upper', gloveAccent: 'upper', sleeve: 'upper', sleeveColor: 'upper',
  wristband: 'upper', wristColor: 'upper', elbowPad: 'upper', elbowColor: 'upper', towel: 'upper', handWarmer: 'upper', chain: 'upper',
  visor: 'face', eyeBlack: 'face', mouthguard: 'face', maskStyle: 'face', maskColor: 'face', helmetStripe: 'face', helmetFinish: 'face', tatNeck: 'upper',
  heightIn: 'full', weightLb: 'full', bodyType: 'full', skin: 'full',
};
const HELMET_KEYS = new Set(['visor', 'eyeBlack', 'mouthguard', 'maskStyle', 'maskColor', 'helmetStripe', 'helmetFinish']);
const SUITS = ['#16181f', '#1d2a44', '#3b3f48', '#5a1e2a', '#f2f2f2', '#2f4a3a', '#7a5a2a'];

/**
 * Build the editor. opts: { look (mutated), uniform, number, position, lockBody, onChange }
 * Returns an element.
 */
export function lookEditor(opts) {
  const L = opts.look;
  const mascot = opts.position === 'MS';
  const st = { tab: mascot ? 'suit' : 'body', helmet: false, yaw: 0.35 };
  if (mascot) L.costume = costumeOf(L);
  const groups = mascot ? MASCOT_GROUPS : TAB_GROUPS;
  const setC = (k, v) => { sfx.click(); L.costume = { ...costumeOf(L), [k]: v }; changed(); };
  const cchips = (label, list, key) => h('div.look-row', h('div.section-label', label),
    h('div.chip-row', list.map((o) => h(`button.opt${costumeOf(L)[key] === o.id ? '.on' : ''}`, { onclick: () => setC(key, o.id) }, o.label))));
  if (opts.lockBody) st.tab = 'hair';
  const wrap = h('div.look-editor');
  const changed = () => { opts.onChange?.(L); draw(); };
  const focus = (k) => { if (KEY_VIEW[k]) st.view = KEY_VIEW[k]; st.helmet = HELMET_KEYS.has(k) || st.tab === 'helmet'; };
  const set = (k, v) => { sfx.click(); L[k] = v; focus(k); changed(); };

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
    h('input.slider', { type: 'range', min: a, max: b, value: L[key], oninput: (e) => { L[key] = Number(e.target.value); focus(key); opts.onChange?.(L); draw(); } }));

  // face sliders: -10..10 on screen, -1..1 in the look. The label updates while dragging; the preview on release.
  const faceSlider = (k, label, lo, hi) => {
    const v = Math.round((L.fs?.[k] ?? 0) * 10);
    const val = h('b.pix', v > 0 ? `+${v}` : `${v}`);
    return h('div.look-row.face-slider', h('div.row.between', h('div.section-label', label), val),
      h('div.row', { style: { gap: '8px', alignItems: 'center' } }, h('span.tiny.muted.fs-end', lo),
        h('input.slider.grow', { type: 'range', min: -10, max: 10, step: 1, value: v, 'aria-label': label,
          oninput: (e) => { const n = Number(e.target.value); val.textContent = n > 0 ? `+${n}` : `${n}`; },
          onchange: (e) => { L.fs = { ...(L.fs ?? {}), [k]: Number(e.target.value) / 10 }; changed(); } }),
        h('span.tiny.muted.fs-end.r', hi)));
  };
  // a titled group of options
  const sec = (title, ...rows) => h('section.look-sec', h('div.look-sec-title', title), h('div.look-sec-body', rows.flat().filter(Boolean)));
  const toggle = (label, key) => h('div.look-row', h('div.section-label', label), h('div.chip-row',
    h(`button.opt${L[key] ? '.on' : ''}`, { onclick: () => set(key, true) }, 'On'),
    h(`button.opt${!L[key] ? '.on' : ''}`, { onclick: () => set(key, false) }, 'Off')));

  const view = () => st.view ?? TAB_VIEW[st.tab] ?? 'full';
  const preview = () => {
    if (mascot && COSTUME_TABS.has(st.tab)) {
      const cs = costumeSpec(L, opts.mascotKind ?? 'bear', opts.teamColors ?? [opts.uniform?.jersey ?? '#1d3557', opts.uniform?.trim ?? '#f1c40f']);
      return h('div.look-preview',
        h('div.look-stage', portraitImg({ mascot: cs }, 200, { full: st.tab !== 'cface', big: true, yaw: st.yaw })),
        h('div.tiny.muted', { style: { textAlign: 'center' } }, `"${costumeOf(L).name || mascotName(opts.seed ?? 'x')}"`),
        h('div.row', { style: { justifyContent: 'center', gap: '6px' } },
          h('button.btn.small', { 'aria-label': 'Turn left', onclick: () => { st.yaw -= 0.8; draw(); } }, '⟲'),
          h('button.btn.small', { 'aria-label': 'Turn right', onclick: () => { st.yaw += 0.8; draw(); } }, '⟳'),
          h('button.btn.small', { onclick: () => {
            sfx.click();
            const pick = (list) => list[Math.floor(Math.random() * list.length)].id;
            L.costume = { ...costumeOf(L), kind: pick(COSTUME_ANIMALS), fur: pick(COSTUME_FURS), eyes: pick(COSTUME_EYES), mouth: pick(COSTUME_MOUTHS), hat: pick(COSTUME_HATS), extra: pick(COSTUME_EXTRAS), shoes: COSTUME_SHOES[Math.floor(Math.random() * COSTUME_SHOES.length)] };
            changed();
          } }, '🎲')));
    }
    const spec = st.tab === 'casual' ? { ...L, outfit: 'casual' } : st.tab === 'gala' ? { ...L, outfit: 'gala' } : { uniform: opts.uniform, look: { ...L }, number: opts.number ?? 1, helmet: st.helmet };
    return h('div.look-preview',
      h('div.look-stage', portraitImg(spec, 200, { view: view(), big: true, yaw: st.yaw })),
      h('div.view-pick', [['face', 'Face'], ['upper', 'Upper'], ['full', 'Full'], ['legs', 'Legs']].map(([v, l]) =>
        h(`button.subtab${view() === v ? '.on' : ''}`, { onclick: () => { sfx.click(); st.view = v; draw(); } }, l))),
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
    const modTxt = Object.entries(mods).filter(([, v]) => v).map(([k, v]) => `${statLabel(k, opts.position)} ${v > 0 ? '+' : ''}${v}`).join(' · ');
    return [
      sec('Skin', swatches('Skin tone', SKIN_TONES, 'skin', { index: true })),
      sec('Build', chips('Body type', BODY_TYPES, 'bodyType'),
        opts.lockBody ? h('p.small.muted', `${fmtHeight(L.heightIn)} · ${L.weightLb} lb (set at creation)`) : [
          slider('Height', 'heightIn', HEIGHT_RANGE, fmtHeight),
          slider('Weight', 'weightLb', WEIGHT_RANGE, (v) => `${v} lb`),
          h('p.tiny.muted', modTxt ? `Starting ratings: ${modTxt}` : 'Average size for your position.'),
        ]),
    ];
  };
  const views = {
    body,
    hair: () => [sec('Hairstyle', chips('Style', HAIR_STYLES, 'hairStyle')), sec('Color', swatches('Hair color', HAIR_COLORS, 'hairColor', { index: true }))],
    face: () => [
      sec('Starting face', h('div.chip-row', FACE_PRESETS.map((pr) => h(`button.opt${L.facePreset === pr.id ? '.on' : ''}`, { onclick: () => { sfx.click(); Object.assign(L, pr.f, { fs: { ...pr.f.fs }, facePreset: pr.id }); changed(); } }, pr.label))),
        h('p.tiny.muted', 'Pick a base face, then fine-tune it below. Your skin, hair and beard stay the same.')),
      sec('Face shape', chips('Head shape', HEAD_SHAPES, 'headShape'), chips('Jaw', JAWS, 'jaw'), chips('Cheekbones', CHEEKS, 'cheek'), chips('Chin', CHINS, 'chin'), chips('Face width', FACE_WIDTHS, 'faceW')),
      sec('Fine tune', FACE_SLIDER_DEFS.map(([k, label, lo, hi]) => faceSlider(k, label, lo, hi)),
        h('button.btn.small.ghost', { onclick: () => { sfx.click(); L.fs = {}; changed(); } }, 'Reset sliders')),
      sec('Eyes', chips('Eye shape', EYES, 'eyes'), swatches('Eye color', EYE_COLORS, 'eyeColor', { index: true }), chips('Brows', BROWS, 'brows')),
      sec('Nose & mouth', chips('Nose', NOSES, 'nose'), chips('Mouth', MOUTHS, 'mouth')),
      sec('Facial hair', chips('Style', BEARDS, 'beard')),
    ],
    ink: () => [sec('Arms', chips('Left arm', TATTOOS, 'tatL'), chips('Right arm', TATTOOS, 'tatR')), sec('Neck', chips('Neck', NECK_TATTOOS, 'tatNeck'))],
    jersey: () => [sec('Jersey',
      chips('Sleeves', JERSEY_SLEEVES, 'jSleeve'),
      chips('Length', JERSEY_LENGTHS, 'jLength'),
      chips('Fit', JERSEY_FITS, 'jFit'),
      h('div.look-row', h('div.section-label', L.jLength === 'crop' ? 'Undershirt / belly' : 'Undershirt'), h('div.swatch-row',
        [['team', `linear-gradient(135deg, ${opts.uniform?.jersey ?? '#1d3557'} 50%, ${opts.uniform?.trim ?? '#ffd43b'} 50%)`], ['skin', SKIN_TONES[L.skin % SKIN_TONES.length]], ...GEAR_COLORS.map((c) => [c, c])].map(([v, bg]) =>
          h(`button.sw${L.underColor === v ? '.on' : ''}`, { style: { background: bg }, 'aria-label': v, title: v === 'skin' ? 'No undershirt' : v === 'team' ? 'Team color' : v, onclick: () => set('underColor', v) }))))),
      sec('Pads', chips('Shoulder pads', PAD_SIZES, 'padSize'), chips('Back plate', PAD_EXTRAS, 'backplate'), chips('Horse collar (neck roll)', PAD_EXTRAS, 'neckRoll')),
      sec('Extras', chips('Socks', SOCKS, 'sockStyle'), chips('Mouthguard', MOUTHGUARDS, 'mouthguard')),
      h('p.tiny.muted', 'Jersey colors come from your team. How you wear it is up to you.'),
    ],
    helmet: () => [sec('Facemask',
      chips('Facemask', MASKS, 'maskStyle'),
      h('div.look-row', h('div.section-label', 'Facemask color'), h('div.swatch-row', MASK_COLORS.map((c) => h(`button.sw${L.maskColor === c ? '.on' : ''}`, {
        style: { background: c === 'team' ? `linear-gradient(135deg, ${opts.uniform?.stripe ?? '#ffd43b'} 50%, ${opts.uniform?.helmet ?? '#1d3557'} 50%)` : c }, 'aria-label': c, onclick: () => set('maskColor', c) }))))),

      sec('Visor', chips('Visor tint', VISORS, 'visor')),
      h('p.tiny.muted', 'Your team\'s helmet: its colors, logo, stripe and shell finish come with the team. The facemask style is yours, and the team color is the default for the facemask.'),
    ],
    gear: () => [
      sec('Cleats', swatches('Cleat color', GEAR_COLORS, 'cleats'), chips('Cleat design', CLEAT_DESIGNS, 'cleatDesign'),
        L.cleatDesign !== 'solid' ? swatches('Cleat accent', GEAR_COLORS, 'cleatAccent') : null, chips('Cleat cut', CLEAT_CUTS, 'cleatCut'), chips('Spats / tape', SPATS, 'spats')),
      sec('Gloves', swatches('Glove color', GEAR_COLORS, 'gloves', { none: true }), L.gloves ? chips('Glove design', GLOVE_DESIGNS, 'gloveDesign') : null,
        L.gloves && L.gloveDesign !== 'solid' ? swatches('Glove accent', GEAR_COLORS, 'gloveAccent') : null),
      sec('Face', chips('Visor tint', VISORS, 'visor'), toggle('Eye black', 'eyeBlack')),
    ],
    swag: () => [
      sec('Arms', chips('Arm sleeves', SIDES, 'sleeve'), L.sleeve !== 'none' ? swatches('Arm sleeve color', GEAR_COLORS, 'sleeveColor') : null,
        chips('Wristbands', SIDES, 'wristband'), L.wristband !== 'none' ? swatches('Wristband color', GEAR_COLORS, 'wristColor') : null,
        chips('Elbow pads', SIDES, 'elbowPad'), L.elbowPad !== 'none' ? swatches('Elbow pad color', GEAR_COLORS, 'elbowColor') : null),
      sec('Legs', chips('Knee braces', SIDES, 'kneeBrace'), L.kneeBrace !== 'none' ? swatches('Brace color', GEAR_COLORS, 'kneeColor') : null,
        chips('Leg sleeves', SIDES, 'legSleeve'), L.legSleeve !== 'none' ? swatches('Leg sleeve color', GEAR_COLORS, 'legSleeveColor') : null),
      sec('Extras', chips('Towel', TOWELS, 'towel'), toggle('Hand warmer', 'handWarmer'), chips('Chain', CHAINS, 'chain')),
    ],
    casual: () => [sec('Around town', swatches('Shirt', CLOTHES, 'shirt'), swatches('Pants', CLOTHES, 'pants'), swatches('Shoes', CLOTHES, 'shoe')), h('p.tiny.muted', 'What you wear around town, at home and on your phone.')],
    gala: () => [sec('Formal', swatches('Suit', SUITS, 'suit'), swatches('Tie', ['#c92a2a', '#1c7ed6', '#e8b730', '#16181c', '#f4f4f4', '#2f9e44', '#ae3ec9'], 'tie')), h('p.tiny.muted', 'Worn on draft night, award shows and the Hall of Fame.')],
    suit: () => [
      sec('Your mascot name', h('div.look-row', h('input', { type: 'text', maxLength: 22, placeholder: mascotName(opts.seed ?? 'x'), value: costumeOf(L).name,
        onchange: (e) => { L.costume = { ...costumeOf(L), name: e.target.value.trim().slice(0, 22) }; opts.onChange?.(L); } })),
        h('p.tiny.muted', 'What the PA announcer and the fans call you.')),
      sec('Costume', cchips('Animal', COSTUME_ANIMALS, 'kind'), cchips('Fur', COSTUME_FURS, 'fur')),
      h('p.tiny.muted', 'Team mascot = whatever your school or team is. Your costume follows you to every team you join.'),
    ],
    cface: () => [sec('Eyes', cchips('Eyes', COSTUME_EYES, 'eyes')), sec('Mouth', cchips('Mouth', COSTUME_MOUTHS, 'mouth'))],
    cextra: () => [
      sec('On your head', cchips('Hat', COSTUME_HATS, 'hat')),
      sec('Accessories', cchips('Extra', COSTUME_EXTRAS, 'extra')),
      sec('Feet', h('div.look-row', h('div.section-label', 'Shoes'), h('div.swatch-row', COSTUME_SHOES.map((c) => h(`button.sw${costumeOf(L).shoes === c ? '.on' : ''}`, { style: { background: c }, 'aria-label': c, onclick: () => setC('shoes', c) })))),
        h('div.look-row', h('div.section-label', 'Shoe size'), h('div.chip-row',
          h(`button.opt${!costumeOf(L).shoesBig ? '.on' : ''}`, { onclick: () => setC('shoesBig', false) }, 'Normal'),
          h(`button.opt${costumeOf(L).shoesBig ? '.on' : ''}`, { onclick: () => setC('shoesBig', true) }, 'Clown size')))),
    ],
    celeb: () => [sec('Touchdown celebration', chips('Celebration', CELEBRATIONS, 'celebration')), h('p.tiny.muted', 'Shown in the end zone after you score.')],
  };

  const draw = () => {
    clear(wrap);
    wrap.append(
      h('div.look-sticky', preview()),
      h('div.look-tabgroups', groups.map(([gname, ids]) => h('div.look-tabgroup',
        h('div.look-tabgroup-name', gname),
        h('div.look-tabgrid', ids.map((id) => { const [, l, icon] = TABS.find((t) => t[0] === id);
          return h(`button.look-tab${st.tab === id ? '.on' : ''}`, { onclick: () => { sfx.click(); st.tab = id; st.view = null; st.helmet = id === 'helmet'; draw(); } }, h('span.ico', icon), h('span', l)); }))))),
      h('div.look-panel', views[st.tab]()));
  };
  draw();
  return wrap;
}

const mascotOf = (app) => {
  const t = app.state?.league?.teams?.find((x) => x.id === app.state.career.teamId);
  return t ? { mascotKind: mascotKind(t), teamColors: t.colors } : {};
};
/** Modal editor for an existing athlete (body size is locked after creation). */
export function openLookModal(app, { uniform, onDone } = {}) {
  const p = app.state.player;
  const look = normalizeLook({ ...p.look }, p.first + p.last);
  const content = h('div');
  const m = openModal(content, { dismissable: true });
  content.append(
    h('div.row.between', h('h2', 'Your Look'), h('span.tiny.muted', 'Free to change')),
    lookEditor({ look, uniform, number: p.number, position: p.position, lockBody: true, seed: p.first + p.last, ...mascotOf(app) }),
    h('div.row', { style: { marginTop: '12px' } },
      h('button.btn.grow', { onclick: () => m.close() }, 'Cancel'),
      h('button.btn.primary.grow', { onclick: () => { p.look = look; app.save(); sfx.select(); toast('Look saved'); m.close(); onDone?.(); app.render(); } }, 'Save')));
  return m;
}
