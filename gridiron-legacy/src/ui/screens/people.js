// People (relationships + interactions) and the Store.
import { h, clear } from '../dom.js';
import { openModal, changeChips, toast } from '../components.js';
import { people, findPerson, interactionsFor, openInteraction, respond, giveGift, giftsOwned } from '../../sim/social.js';
import { ITEM_CATS, ITEMS } from '../../data/items.js';
import { buyItem, canBuy, owned, gearBonus } from '../../sim/shop.js';
import { casualSheet, FW, FH } from '../../scenes/pixelart.js';
import { fmtMoney } from '../../core/util.js';
import { icon } from '../icons.js';
import { sfx } from '../../audio/sfx.js';

/** Pixel portrait (front idle frame) of a person. */
export function portrait(look, size = 48) {
  const c = document.createElement('canvas');
  c.width = FW;
  c.height = FH;
  c.style.cssText = `width:${size * (FW / FH)}px;height:${size}px;image-rendering:pixelated;flex:none`;
  try { if (look) c.getContext('2d').drawImage(casualSheet(look), 0, FH, FW, FH, 0, 0, FW, FH); } catch { /* no canvas */ }
  return c;
}

const KIND_ICON = { coach: 'clipboard', teammate: 'users', family: 'home', partner: 'heart', agent: 'briefcase', rival: 'flame', fan: 'star' };

export function peopleView(app) {
  const st = app.state;
  const list = people(st);
  return h('div.col', { style: { gap: '10px' } },
    h('p.small.muted', 'Tap someone to talk, hang out, give gifts and more. Quick chats are free once a week; bigger plans use a day and energy.'),
    list.map((pp) => h('button.card.person-row', { onclick: () => { sfx.click(); personSheet(app, pp.key); } },
      portrait(pp.look, 52),
      h('div.grow', { style: { textAlign: 'left' } },
        h('div.row.between', h('b', pp.name), h('span.tiny.muted', pp.title)),
        h('div.statbar', { style: { gridTemplateColumns: '1fr 30px', marginTop: '6px' } },
          h('div.track', h('div.fill', { style: { width: `${pp.value}%` } })), h('span.val', Math.round(pp.value)))),
      icon('chat'))));
}

/** Bottom sheet with everything you can do with one person. Also used by the walkable world. */
export function personSheet(app, key, { onDone } = {}) {
  const st = app.state;
  const content = h('div');
  const m = openModal(content, { dismissable: true, onClose: onDone });
  const drawMenu = () => {
    clear(content);
    const person = findPerson(st, key);
    if (!person) { m.close(); return; }
    const acts = interactionsFor(st, person);
    const gifts = giftsOwned(st);
    content.append(
      h('div.row', { style: { gap: '14px', marginBottom: '6px' } }, person.look ? portrait(person.look, 72) : h('span', { style: { fontSize: '2rem' } }, icon(KIND_ICON[person.kind])),
        h('div.grow', h('div.kicker', person.title), h('h2', person.name),
          person.kind !== 'fan' ? h('div.statbar', { style: { gridTemplateColumns: '1fr 30px', marginTop: '6px' } }, h('div.track', h('div.fill', { style: { width: `${person.value}%` } })), h('span.val', Math.round(person.value))) : null)),
      h('div.col', { style: { marginTop: '12px' } }, acts.map((a) => h('button.btn.block.choice', { disabled: !a.ok, onclick: () => { sfx.select(); drawTalk(a.id); } },
        h('span', a.label),
        h('span.dice', a.why ?? [a.cost ? `1 day · ${a.cost}⚡` : 'FREE', a.money ? ` · ${fmtMoney(a.money)}` : ''].join(''))))),
      person.kind !== 'fan' ? h('div', { style: { marginTop: '14px' } },
        h('div.section-label', 'Give a gift'),
        gifts.length ? h('div.row.wrap', { style: { marginTop: '10px' } }, gifts.map((g) => h('button.btn.small', { onclick: () => {
          const r = giveGift(st, key, g.item.id);
          if (!r) return;
          sfx.cash();
          app.save();
          showResult('Gift', r);
        } }, `${g.item.name} ×${g.n}`)))
          : h('p.small.muted', { style: { marginTop: '8px' } }, 'No gifts. Buy some in the Store (Life → Store).')) : null,
      h('button.btn.ghost.block', { style: { marginTop: '14px' }, onclick: () => m.close() }, 'Done'));
  };
  const drawTalk = (id) => {
    const o = openInteraction(st, key, id);
    clear(content);
    content.append(
      h('div.row', { style: { gap: '14px' } }, o.person.look ? portrait(o.person.look, 64) : null, h('div.grow', h('div.kicker', o.it.label), h('h2', o.person.name))),
      h('p.story.speech', o.line),
      h('div.col', o.responses.map((r, i) => h('button.btn.block.choice', { onclick: () => {
        sfx.select();
        const res = respond(st, key, id, i);
        app.save();
        if (res.success === false) sfx.error();
        showResult(o.it.label, res);
      } }, h('span', r.label), r.risky ? h('span.dice', icon('dice'), ' RISKY') : null))));
  };
  const showResult = (title, res) => {
    clear(content);
    content.append(h('div.kicker', title), h('p.story', res.result), changeChips(res.changes),
      h('div.row', h('button.btn.grow', { onclick: drawMenu }, 'Something else'), h('button.btn.primary.grow', { onclick: () => m.close() }, 'Done')));
  };
  drawMenu();
  return m;
}

export function storeView(app, { cat: forcedCat, onBuy } = {}) {
  const st = app.state;
  const p = st.player;
  const cat = forcedCat ?? app.ui.storeCat ?? 'gear';
  const wrap = h('div.col', { style: { gap: '12px' } });
  if (!forcedCat) wrap.append(h('div.subtabs', ITEM_CATS.map(([id, label]) => h(`button.subtab${cat === id ? '.on' : ''}`, { onclick: () => { app.ui.storeCat = id; app.render(); } }, label))));
  const catInfo = ITEM_CATS.find((c) => c[0] === cat);
  wrap.append(h('div.row.between', h('p.small.muted', catInfo[2]), h('b.pix', { style: { fontSize: '0.8rem' } }, fmtMoney(p.money))));
  if (cat === 'gear') {
    const types = { qb: 'qb_throw', catch: 'wr_route', run: 'rb_run' };
    wrap.append(h('p.tiny.muted', `Gear bonus now: throws +${Math.round(gearBonus(p, types.qb) * 100)}% · catches +${Math.round(gearBonus(p, types.catch) * 100)}% · runs +${Math.round(gearBonus(p, types.run) * 100)}%`));
  }
  for (const item of ITEMS.filter((i) => i.cat === cat)) {
    const c = canBuy(st, item);
    const have = owned(p, item.id);
    const count = p.inventory?.[item.id] ?? 0;
    wrap.append(h('div.card.item-card',
      h('div.grow', h('b', item.name), h('div.small.muted', item.desc),
        h('div.tiny', { style: { marginTop: '4px' } }, fmtMoney(item.price), item.weekly ? ` + ${fmtMoney(item.weekly)}/wk` : '', item.gift && count ? ` · you have ${count}` : '')),
      have ? h('span.chip.good', icon('check'), 'Owned')
        : h('button.btn.small.primary', { disabled: !c.ok, onclick: () => {
          const r = buyItem(st, item.id);
          if (!r.ok) return toast(r.why);
          sfx.cash();
          toast(`Bought ${item.name}`);
          app.save();
          if (onBuy) onBuy(); else app.render();
        } }, c.ok ? 'Buy' : c.why)));
  }
  return wrap;
}
