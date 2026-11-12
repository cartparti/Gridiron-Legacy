// Reusable UI pieces: badges, jerseys, charts, stat bars, modals, toasts.
import { crest } from './crest.js';
import { h, clear } from './dom.js';
import { STAT_KEYS, STAT_LABELS, statLabel } from '../data/positions.js';
import { sfx } from '../audio/sfx.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Shield logo generated from team colors + abbreviation. */
/** Team crest (pixel shield with the mascot). */
export function teamBadge(team, size = 48) {
  return h('span.badge-wrap', { style: { display: 'inline-flex', width: `${Math.round(size * 0.85)}px`, justifyContent: 'center', flex: 'none' } }, crest(team, Math.round(size * 0.85)));
}

/** Jersey with name and number. */
export function jersey(p, colors, size = 160) {
  const [a, b] = colors;
  const num = esc(p.number);
  const name = esc(p.last.toUpperCase());
  const svg = `<svg viewBox="0 0 200 210" width="${size}" height="${size * 1.05}" aria-label="Jersey">
    <defs><linearGradient id="jg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${a}" stop-opacity="0.85"/></linearGradient></defs>
    <path d="M60 10 L80 4 Q100 18 120 4 L140 10 L190 40 L170 85 L150 75 L150 200 L50 200 L50 75 L30 85 L10 40 Z" fill="url(#jg)" stroke="rgba(0,0,0,0.35)" stroke-width="3"/>
    <path d="M10 40 L30 85 L50 75 L50 62 L22 32 Z M190 40 L170 85 L150 75 L150 62 L178 32 Z" fill="${b}" opacity="0.9"/>
    <path d="M80 4 Q100 18 120 4" fill="none" stroke="${b}" stroke-width="6"/>
    <text x="100" y="62" text-anchor="middle" font-family="Arial Narrow, Arial, sans-serif" font-weight="900" font-size="18" fill="${b}" letter-spacing="2">${name}</text>
    <text x="100" y="160" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="88" fill="${b}" stroke="rgba(0,0,0,0.3)" stroke-width="2">${num}</text>
  </svg>`;
  return h('div.jersey-wrap', { html: svg });
}

/** Line chart of overall rating by season, with stage-colored points. */
export function ratingChart(history, current) {
  const pts = history.map((x) => ({ v: x.ovr, stage: x.stage, label: `${x.year}` }));
  if (current !== undefined) pts.push({ v: current, stage: 'now', label: 'Now' });
  if (pts.length < 2) return h('p.muted.small', 'Your rating chart appears after your first season.');
  const W = 320, H = 150, pad = 26;
  const lo = Math.max(30, Math.floor(Math.min(...pts.map((p) => p.v)) / 10) * 10);
  const hi = Math.min(100, Math.ceil(Math.max(...pts.map((p) => p.v)) / 10) * 10 + 2);
  const x = (i) => pad + (i * (W - pad * 1.5)) / (pts.length - 1);
  const y = (v) => H - pad + 6 - ((v - lo) / (hi - lo)) * (H - pad * 1.4);
  const col = { hs: '#60a5fa', college: '#c084fc', pro: '#f4c430', now: '#4ade80' };
  let grid = '';
  for (let g = lo; g <= hi; g += 10) grid += `<line x1="${pad}" x2="${W - 6}" y1="${y(g)}" y2="${y(g)}" stroke="currentColor" opacity="0.12"/><text x="4" y="${y(g) + 4}" font-size="9" fill="currentColor" opacity="0.6">${g}</text>`;
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const dots = pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.v)}" r="4" fill="${col[p.stage]}" stroke="#000" stroke-opacity="0.3"/>`).join('');
  const every = Math.ceil(pts.length / 8);
  const labels = pts.map((p, i) => (i % every === 0 || i === pts.length - 1 ? `<text x="${x(i)}" y="${H - 4}" font-size="8" text-anchor="middle" fill="currentColor" opacity="0.6">${esc(p.label)}</text>` : '')).join('');
  const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Overall rating by season">${grid}<path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>${dots}${labels}</svg>`;
  return h('div.chart-wrap', { html: svg },
    h('div.row.small.muted', { style: { justifyContent: 'center', gap: '12px', marginTop: '4px' } },
      h('span', h('span.swatch', { style: { background: col.hs } }), 'High school'),
      h('span', h('span.swatch', { style: { background: col.college } }), 'College'),
      h('span', h('span.swatch', { style: { background: col.pro } }), 'Pro')));
}

export function statBars(stats, notes, pos = null) {
  return h('div.col', { style: { gap: '8px' } }, STAT_KEYS.map((k) =>
    h('div', h('div.statbar',
      h('span', statLabel(k, pos)),
      h('div.track', h('div.fill', { style: { width: `${stats[k]}%` } })),
      h('span.val', Math.round(stats[k]))),
    notes ? h('div.tiny.muted', { style: { marginLeft: '100px' } }, notes[k]) : null)));
}

export function meter(label, value, max = 100, display) {
  return h('div.meter', h('div.row.between', h('span', label), h('b', display ?? Math.round(value))),
    h('div.bar', h('i', { style: { width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` } })));
}

export function changeChips(changes) {
  if (!changes?.length) return null;
  return h('div.changes', changes.map((c) => h(`span.chip.${c.delta > 0 ? 'good' : c.delta < 0 ? 'bad' : 'x'}`, `${c.label} ${c.text ?? ''}`)));
}

// ---------- modal ----------
export function openModal(content, { onClose, dismissable = false } = {}) {
  const overlay = document.getElementById('overlay');
  const back = h('div.modal-back', { role: 'dialog', 'aria-modal': 'true' });
  const box = h('div.modal', content);
  if (dismissable) box.prepend(h('button.modal-x', { 'aria-label': 'Close', onclick: () => close() }, '×'));
  back.append(box);
  if (dismissable) back.addEventListener('click', (e) => { if (e.target === back) close(); });
  overlay.append(back);
  const first = box.querySelector('button:not(.modal-x)');
  if (first) setTimeout(() => first.focus({ preventScroll: true }), 50);
  function close() {
    back.remove();
    onClose?.();
  }
  return { close, box };
}

export function closeAllModals() {
  clear(document.getElementById('overlay'));
}

export function toast(text, ms = 2600) {
  const box = document.getElementById('toasts');
  const t = h('div.toast', text);
  box.append(t);
  setTimeout(() => t.remove(), ms);
}

export function confirmDialog(title, text, okLabel = 'Confirm') {
  return new Promise((resolve) => {
    const m = openModal([
      h('h2', title), h('p.story', text),
      h('div.col',
        h('button.btn.primary.block', { onclick: () => { sfx.click(); m.close(); resolve(true); } }, okLabel),
        h('button.btn.ghost.block', { onclick: () => { m.close(); resolve(false); } }, 'Cancel')),
    ]);
  });
}

export function stars(n, max = 5) {
  return h('span.stars', '★'.repeat(n) + '☆'.repeat(max - n));
}
