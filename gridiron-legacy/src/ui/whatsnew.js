// "What's new" pop-up, shown every time the game opens.
import { h } from './dom.js';
import { openModal } from './components.js';
import { CHANGELOG } from '../data/changelog.js';
import { sfx } from '../audio/sfx.js';

export function showWhatsNew() {
  if (document.querySelector('.whatsnew')) return;
  if (navigator.webdriver && !window.__forceWhatsNew) return; // automated test browsers skip it
  const [latest, ...older] = CHANGELOG;
  let showOld = false;
  const olderBox = h('div.wn-older');
  const drawOlder = () => {
    olderBox.replaceChildren(...(showOld ? older.map((c) => h('div.wn-entry',
      h('div.wn-head', h('span.chip.pix', `v${c.v}`), h('b', c.title), h('span.tiny.muted', c.date)),
      h('ul', c.items.map((t) => h('li', t))))) : []));
  };
  const toggle = h('button.btn.small.ghost.block', { onclick: () => { sfx.click(); showOld = !showOld; toggle.textContent = showOld ? 'Hide earlier updates' : 'Earlier updates'; drawOlder(); } }, 'Earlier updates');
  const m = openModal(h('div.whatsnew',
    h('div.wn-top', h('div.wn-badge', 'NEW'), h('div', h('div.tiny.muted', `Update v${latest.v} · ${latest.date}`), h('h2', latest.title))),
    h('ul.wn-list', latest.items.map((t) => h('li', t))),
    older.length ? toggle : null,
    olderBox,
    h('button.btn.primary.block', { onclick: () => { sfx.select(); m.close(); } }, "Let's go")), { dismissable: true });
  // no slide-in: over the busy 3D title screen a slow phone could leave it stuck half-faded
  m.box.style.animation = 'none'; m.box.parentElement.style.animation = 'none';
  return m;
}
