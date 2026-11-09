import { h, clear } from '../dom.js';
import { openModal, changeChips } from '../components.js';
import * as flow from '../../sim/flow.js';
import { sfx } from '../../audio/sfx.js';

export function eventModal(app) {
  const st = app.state;
  const ev = st.pendingEvent;
  if (!ev) return;
  const content = h('div');
  const m = openModal(content);
  const offseason = st.phase === 'offseason_event';
  clear(content);
  content.append(
    h('div.kicker', offseason ? 'Offseason' : 'This Week'),
    h('h2', ev.title),
    h('p.story', ev.text),
    h('div.col', ev.choices.map((c, i) => h('button.btn.block.choice', {
      onclick: () => {
        sfx.select();
        const res = flow.resolveEvent(st, i);
        app.save();
        clear(content);
        content.append(
          h('div.kicker', res.success === true ? '🎲 It worked out' : res.success === false ? '🎲 It went wrong' : 'Result'),
          h('h2', ev.title),
          h('p.story', res.result),
          changeChips(res.changes),
          h('button.btn.primary.block', { onclick: () => { sfx.click(); m.close(); app.render(); } }, 'Continue'));
        if (res.success === false) sfx.error();
      },
    }, h('span', c.label), c.risky ? h('span.dice', '🎲 risky') : null))));
}
