// Signature shoe: the offer, the designer (live SVG preview) and sales.
import { h } from '../dom.js';
import { sfx } from '../../audio/sfx.js';
import { fmtMoney } from '../../core/util.js';
import { toast } from '../components.js';
import { shoeOf, acceptShoe, declineShoe, designShoe, designScore, setWearShoe, SHOE_COLORS, SHOE_SOLES, SHOE_PATTERNS, SHOE_CUTS } from '../../sim/shoes.js';

/** Side view of the shoe (toe to the right). */
export function shoeSVG(d, size = 220) {
  const sole = SHOE_SOLES.find((x) => x.id === d.sole)?.color ?? '#f4f4f4';
  const collar = d.cut === 'high' ? 18 : d.cut === 'mid' ? 30 : 42;
  const B = d.base, A = d.accent;
  const body = `M18 ${collar} Q22 ${collar - 8} 40 ${collar - 6} L70 ${collar + 4} Q110 46 150 62 Q178 70 184 86 L184 96 L14 96 Q10 70 18 ${collar} Z`;
  const pat = {
    sig: `<path d="M30 84 Q90 96 176 56 Q110 80 40 76 Z" fill="${A}"/><circle cx="160" cy="84" r="5" fill="${A}"/>`,
    stripe: `<path d="M16 70 L184 74 L184 82 L15 80 Z" fill="${A}"/>`,
    twotone: `<path d="M18 ${collar} Q22 ${collar - 8} 40 ${collar - 6} L70 ${collar + 4} Q110 46 150 62 Q170 68 178 76 L16 76 Q12 60 18 ${collar} Z" fill="${A}"/>`,
    heel: `<path d="M14 96 Q10 70 18 ${collar} Q22 ${collar - 8} 40 ${collar - 6} L48 96 Z" fill="${A}"/>`,
    flames: `<path d="M20 96 L30 70 L38 84 L50 60 L60 86 L72 66 L82 90 L96 72 L104 96 Z" fill="${A}"/>`,
    bolt: `<path d="M60 52 L92 52 L76 70 L98 70 L52 96 L66 74 L48 74 Z" fill="${A}"/>`,
    speckle: Array.from({ length: 26 }, (_, i) => `<circle cx="${22 + ((i * 37) % 158)}" cy="${collar + 6 + ((i * 23) % (88 - collar))}" r="2.4" fill="${A}"/>`).join(''),
    checker: Array.from({ length: 24 }, (_, i) => `<rect x="${24 + (i % 12) * 13}" y="${78 + Math.floor(i / 12) * 7}" width="6.5" height="7" fill="${(i + Math.floor(i / 12)) % 2 ? A : 'none'}"/>`).join(''),
  }[d.pattern] ?? '';
  return h('div.shoe-svg', { html: `<svg viewBox="0 0 200 120" width="${size}" height="${size * 0.6}" xmlns="http://www.w3.org/2000/svg">
    <defs><clipPath id="shoeBody"><path d="${body}"/></clipPath><linearGradient id="shoeShine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
    <ellipse cx="100" cy="112" rx="92" ry="5" fill="#000" opacity=".25"/>
    <path d="${body}" fill="${B}" stroke="#0b0d10" stroke-width="3" stroke-linejoin="round"/>
    <g clip-path="url(#shoeBody)">${pat}<rect x="0" y="0" width="200" height="120" fill="url(#shoeShine)"/></g>
    <path d="M60 ${collar + 2} L64 ${collar + 14} M72 ${collar + 6} L76 ${collar + 17} M84 ${collar + 10} L88 ${collar + 20} M96 ${collar + 14} L100 ${collar + 24}" stroke="${A}" stroke-width="3" stroke-linecap="round"/>
    <path d="M10 96 L188 96 Q192 104 184 106 L14 106 Q6 104 10 96 Z" fill="${sole}" stroke="#0b0d10" stroke-width="3"/>
    ${[30, 58, 86, 114, 142, 168].map((x) => `<rect x="${x}" y="105" width="8" height="6" rx="1.5" fill="${sole}" stroke="#0b0d10" stroke-width="2"/>`).join('')}
    <text x="30" y="${Math.min(70, collar + 26)}" font-family="Arial Black, Impact, sans-serif" font-size="12" font-weight="900" fill="${A}" stroke="#0b0d10" stroke-width=".8">${String(d.logo ?? '').slice(0, 3)}</text>
  </svg>` });
}

export function shoeNudge(app) {
  const s = shoeOf(app.state);
  if (s?.status !== 'offer') return null;
  return h('button.card.deals-nudge', { onclick: () => { sfx.click(); app.hubTab = 'life'; app.ui.lifeSub = 'deals'; app.render(); } },
    h('span.deals-ic', '👟'), h('div.grow', h('b', `${s.brand} wants your signature shoe`), h('div.tiny.muted', `${fmtMoney(s.upfront)} up front plus royalties on every pair.`)), h('span.chip.gold.pix', 'VIEW'));
}

export function shoeCard(app) {
  const st = app.state;
  const s = shoeOf(st);
  if (!s || s.status === 'none') return null;
  if (s.status === 'offer') {
    return h('div.card.shoe-card',
      h('div.card-title', h('h3', '👟 Signature shoe offer'), h('span.chip.gold.pix', s.brand.toUpperCase())),
      h('p.small', `${s.brand} wants to build a shoe line around you: ${fmtMoney(s.upfront)} to sign, plus ${Math.round(s.royalty * 100)}% of every pair sold. You design it.`),
      h('div.row', { style: { gap: '8px', marginTop: '8px' } },
        h('button.btn.primary', { onclick: () => { if (acceptShoe(st)) { sfx.cash?.(); toast('Deal signed! Now design your shoe.'); app.ui.shoeEdit = true; } app.commit(); } }, 'Sign it'),
        h('button.btn.ghost', { onclick: () => { declineShoe(st); app.commit(); } }, 'Not now')));
  }
  const edit = app.ui.shoeEdit || !s.designed;
  const d = (app.ui.shoeDraft ??= { ...s.design });
  const name = (app.ui.shoeName ??= s.name);
  const set = (k, v) => { d[k] = v; app.render(); };
  const swatches = (k) => h('div.shoe-swatches', SHOE_COLORS.map((c) => h(`button.sw${d[k] === c ? '.on' : ''}`, { style: `background:${c}`, 'aria-label': c, onclick: () => set(k, c) })));
  const chips = (k, list) => h('div.row', { style: { flexWrap: 'wrap', gap: '4px' } }, list.map((x) => h(`button.subtab${d[k] === x.id ? '.on' : ''}`, { onclick: () => set(k, x.id) }, x.label)));
  if (!edit) {
    return h('div.card.shoe-card',
      h('div.card-title', h('h3', `👟 The ${s.name}`), h('span.chip.pix', `${s.brand.toUpperCase()} · EDITION ${s.edition}`)),
      h('div.shoe-stage', shoeSVG(s.design, 240)),
      h('div.bigstat', h('div', h('b', `${s.score ?? '-'}/10`), h('span', 'Critics')), h('div', h('b', (s.sold ?? 0).toLocaleString('en-US')), h('span', 'Pairs sold')), h('div', h('b', fmtMoney(s.earned ?? 0)), h('span', 'Earned'))),
      s.lastWeek ? h('p.tiny.muted', `Last week: ${s.lastWeek.units.toLocaleString('en-US')} pairs, ${fmtMoney(s.lastWeek.pay)} to you.`) : null,
      h('div.row', { style: { gap: '8px', marginTop: '8px', flexWrap: 'wrap' } },
        h('button.btn.small', { onclick: () => { app.ui.shoeEdit = true; app.ui.shoeDraft = { ...s.design }; app.ui.shoeName = s.name; app.render(); } }, s.releasedYear === st.career.year ? 'Edit design' : `Design edition ${s.edition}`),
        h(`button.btn.small${s.wear ? '.primary' : ''}`, { onclick: () => { setWearShoe(st, !s.wear); toast(s.wear ? 'You are wearing them in games.' : 'Back to your old cleats.'); app.commit(); } }, s.wear ? 'Wearing them ✓' : 'Wear them in games')));
  }
  const nameInput = h('input', { type: 'text', value: name, maxlength: 22, style: { flex: '1', minHeight: '40px', padding: '8px 10px' }, oninput: (e) => { app.ui.shoeName = e.target.value; } });
  return h('div.card.shoe-card',
    h('div.card-title', h('h3', `👟 Design your shoe`), h('span.tiny.muted', `${s.brand} · edition ${s.edition}`)),
    h('div.shoe-stage', shoeSVG(d, 260)),
    h('div.row.between', h('span.small', 'Critics will rate it'), h('b', `${designScore(st, d)}/10`)),
    h('div.tiny.muted.pix', { style: { marginTop: '8px' } }, 'NAME'), h('div.row', nameInput),
    h('div.tiny.muted.pix', { style: { marginTop: '8px' } }, 'MAIN COLOR'), swatches('base'),
    h('div.tiny.muted.pix', { style: { marginTop: '8px' } }, 'ACCENT COLOR'), swatches('accent'),
    h('div.tiny.muted.pix', { style: { marginTop: '8px' } }, 'PATTERN'), chips('pattern', SHOE_PATTERNS),
    h('div.tiny.muted.pix', { style: { marginTop: '8px' } }, 'SOLE'), chips('sole', SHOE_SOLES),
    h('div.tiny.muted.pix', { style: { marginTop: '8px' } }, 'CUT'), chips('cut', SHOE_CUTS),
    h('p.tiny.muted', 'Tip: strong contrast and your team colors sell the most pairs.'),
    h('button.btn.primary.block', { style: { marginTop: '10px' }, onclick: () => { const r = designShoe(st, d, app.ui.shoeName); if (r) { sfx.levelUp?.(); toast(`The ${r.name} is out! Critics: ${r.score}/10.`); app.ui.shoeEdit = false; app.ui.shoeDraft = null; app.ui.shoeName = null; } app.commit(); } }, s.designed ? 'Save design' : 'Release it'));
}

export function shoeReviewCard(r) {
  if (!r.shoe) return null;
  return h('div.card', h('h3', `👟 ${r.shoe.name} sales`), h('p.small', `${r.shoe.sold.toLocaleString('en-US')} pairs sold so far, ${fmtMoney(r.shoe.earned)} earned. Edition ${r.shoe.edition + 1} is ready to design next season.`));
}
