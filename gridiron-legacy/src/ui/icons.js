// Small line-icon set (24x24, stroke = currentColor). Original, drawn for this project.
import { pixelIconURL } from './pixelIcons.js';
import { h } from './dom.js';

const P = {
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  ball: '<ellipse cx="12" cy="12" rx="9.5" ry="6" transform="rotate(-35 12 12)"/><path d="M8.5 15.5l7-7M10 11l2 2M12 9l2 2"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  news: '<rect x="3" y="4" width="15" height="16" rx="2"/><path d="M18 8h3v10a2 2 0 0 1-2 2M7 8h7M7 12h7M7 16h4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  dumbbell: '<path d="M6 7v10M18 7v10M3 9v6M21 9v6M6 12h12"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  flame: '<path d="M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-4 5-3 8-2-1-3-3-3-3-2 2-3 4-3 7 0 4 3 7 7 7z"/>',
  snow: '<path d="M12 2v20M3 7l18 10M21 7L3 17M9 4l3 2 3-2M9 20l3-2 3 2"/>',
  plus: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/>',
  leaf: '<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15zM5 19l8-8"/>',
  book: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3"/><path d="M20 4v14h-7"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-4 3-6 6.5-6s6 2 6.5 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14c3 0 5 2 5.5 5"/>',
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  heart: '<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/>',
  handshake: '<path d="M2 12l4-4 4 2 4-3 4 3 4 2M6 8l6 7 2-1 2 2 2-1M8 14l2 2"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
  moon: '<path d="M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10z"/>',
  rain: '<path d="M6 15a4 4 0 0 1 .5-8A6 6 0 0 1 18 8a3.5 3.5 0 0 1 0 7z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
  wind: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V4h6v3M3 12h18"/>',
  coins: '<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v4c0 1.7 2.7 3 6 3s6-1.3 6-3V7"/><path d="M9 14v3c0 1.7 2.7 3 6 3s6-1.3 6-3v-4c0-1.7-2.7-3-6-3"/>',
  party: '<path d="M4 20l5-14 9 9zM14 3l1 2M19 5l-2 1M20 10h-2M12 6l1-1"/>',
  gamepad: '<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 11v3M5.5 12.5h3M15 12h.01M18 13h.01"/>',
  trophy: '<path d="M7 4h10v4a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6"/>',
  medal: '<circle cx="12" cy="15" r="5"/><path d="M8 3l4 7 4-7M12 13v4"/>',
  crown: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>',
  scroll: '<path d="M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 0 2 2H8a2 2 0 0 1-2-2zM6 4a2 2 0 0 0-2 2v2h2M10 9h6M10 13h6"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  alert: '<path d="M12 3l10 18H2zM12 10v5M12 18h.01"/>',
  dollar: '<path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  bandage: '<rect x="2" y="8" width="20" height="8" rx="4" transform="rotate(-35 12 12)"/><path d="M10 12h.01M14 12h.01M12 10h.01M12 14h.01"/>',
  dice: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 8h.01M16 16h.01M12 12h.01M16 8h.01M8 16h.01"/>',
  check: '<path d="M4 12l5 5L20 6"/>',
  arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  arrowDown: '<path d="M12 5v14M5 12l7 7 7-7"/>',
  whistle: '<circle cx="9" cy="14" r="6"/><path d="M13 10l8-5v6l-6 1M9 14h.01"/>',
};

export function icon(name, cls = '') {
  const svg = `<svg class="ico-svg ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] ?? P.star}</svg>`;
  return h('span', { html: svg, style: { display: 'inline-flex' } });
}

/** Icon + accent color per weekly activity. */
export const ACTIVITY_ICONS = {
  sprints: ['bolt', '#ffcc33'], weights: ['dumbbell', '#ff8a3d'], drills: ['target', '#ff5d8f'], film: ['film', '#a78bfa'],
  doubles: ['flame', '#ff5d5d'], recovery: ['snow', '#4da3ff'], rehab: ['bandage', '#3ddc84'], yoga: ['leaf', '#3ddc84'],
  classes: ['book', '#a78bfa'], meetcoach: ['clipboard', '#4da3ff'], hangout: ['users', '#ffb020'], family: ['home', '#3ddc84'],
  date: ['heart', '#ff5d8f'], mentor: ['handshake', '#ffcc33'], media: ['mic', '#4da3ff'], charity: ['heart', '#ffcc33'],
  agentcall: ['briefcase', '#3ddc84'], business: ['coins', '#ffcc33'], parttime: ['coins', '#8b98a8'], nightout: ['party', '#ff5d8f'],
  gaming: ['gamepad', '#a78bfa'],
};

export function activityIcon(id) {
  const [name, color] = ACTIVITY_ICONS[id] ?? ['star', '#ffcc33'];
  const url = pixelIconURL(id);
  if (url) return h('span.ic.pix-ic', { style: { '--ic': color } }, h('img', { src: url, alt: '' }));
  return h('span.ic', { style: { background: `color-mix(in srgb, ${color} 18%, transparent)`, color } }, icon(name));
}
