// One-time tutorial tips, shown until dismissed (can be reset in Settings).
import { h } from '../dom.js';

export function tipCard(app, id, title, text) {
  const s = app.settings;
  if (!s.tutorials || s.seenTips?.[id]) return null;
  const card = h('div.card.tip-card',
    h('div.row.between', h('b', `💡 ${title}`), h('button.btn.small.ghost', {
      onclick: () => { s.seenTips = { ...(s.seenTips ?? {}), [id]: true }; app.saveSettings(); card.remove(); },
    }, 'Got it')),
    h('p.small', text));
  return card;
}

export function tipSeen(app, id) {
  return !app.settings.tutorials || !!app.settings.seenTips?.[id];
}

export function markTip(app, id) {
  app.settings.seenTips = { ...(app.settings.seenTips ?? {}), [id]: true };
  app.saveSettings();
}
