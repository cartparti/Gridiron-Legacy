// Life tab → Social: dating (meet someone / date nights) and hangouts with friends.
import { h, clear } from '../dom.js';
import { runSetCutscene } from '../../scenes/director.js';
import { dateScene, hangoutScene, gamingScene } from '../../scenes/sets.js';
import { people } from '../../sim/social.js';
import { openModal, changeChips } from '../components.js';
import { lifeBlock, meetSomeone, datingRound, answerDate, openDate, finishDate, openHangout, finishHangout, DATE_VENUES, HANGOUTS, PERSONALITIES } from '../../sim/life.js';
import { portraitImg } from '../../scenes/portrait.js';
import { fmtMoney } from '../../core/util.js';
import { sfx } from '../../audio/sfx.js';
import { icon } from '../icons.js';

const VENUE_ICON = { dinner: 'heart', movies: 'film', arcade: 'gamepad', beach: 'sun', concert: 'mic', cook: 'home' };
const HANG_ICON = { bowling: 'target', gaming: 'gamepad', pickup: 'ball', bonfire: 'flame', party: 'party', roadtrip: 'star' };

export function socialView(app) {
  const st = app.state;
  const p = st.player;
  const wrap = h('div.col', { style: { gap: '14px' } });
  const block = (o) => lifeBlock(st, o);

  // ---- dating
  if (!p.partnerName) {
    const why = block({ cost: 1, money: 40 });
    wrap.append(h('div.card.social-hero',
      h('div.row', { style: { gap: '12px' } }, h('div.sh-ic', icon('heart')), h('div.grow', h('h2', 'Dating'), h('p.small.muted', 'You\'re single. Meet someone new: every person has their own personality. Read them on the first date.'))),
      h('button.btn.primary.block', { disabled: !!why, onclick: () => { sfx.select(); firstDate(app); } }, why ?? 'Meet someone new · 1 day · $40')));
  } else {
    wrap.append(h('div.card.social-hero',
      h('div.row', { style: { gap: '12px' } }, p.partnerLook ? portraitImg(p.partnerLook, 64) : h('div.sh-ic', icon('heart')),
        h('div.grow', h('h2', `Date night with ${p.partnerName}`), h('div.statbar', { style: { gridTemplateColumns: '1fr 30px', marginTop: '6px' } }, h('div.track', h('div.fill', { style: { width: `${p.rel.partner ?? 0}%`, background: 'var(--bad)' } })), h('span.val', Math.round(p.rel.partner ?? 0))))),
      h('div.venue-grid', DATE_VENUES.map((v) => {
        const why = block({ cost: v.cost, money: v.money });
        return h('button.venue', { disabled: !!why, title: why ?? '', onclick: () => { sfx.select(); dateNight(app, v.id); } },
          h('span.v-ic', icon(VENUE_ICON[v.id] ?? 'heart')), h('b', v.label), h('span.tiny.muted', v.desc), h('span.tiny', why ?? `${v.money ? fmtMoney(v.money) : 'Free'} · ${v.cost} day`));
      }))));
  }

  // ---- hangouts
  wrap.append(h('div.card',
    h('div.card-title', h('h3', 'Hang Out'), h('span.tiny.muted', 'Friends, teammates, good times')),
    h('div.venue-grid', HANGOUTS.map((hg) => {
      const why = block({ cost: hg.cost, money: hg.money });
      return h('button.venue', { disabled: !!why, onclick: () => { sfx.select(); hangout(app, hg.id); } },
        h('span.v-ic', icon(HANG_ICON[hg.id] ?? 'users')), h('b', hg.label), h('span.tiny.muted', hg.desc), h('span.tiny', why ?? `${hg.money ? fmtMoney(hg.money) : 'Free'} · ${hg.cost} day${hg.cost > 1 ? 's' : ''}`));
    }))));
  return wrap;
}

function scene(app, { title, portrait, text, choices, onChoose }) {
  const box = h('div.life-scene');
  const m = openModal(box, { dismissable: false });
  const draw = (t, opts, cb) => {
    clear(box);
    box.append(h('div.row', { style: { gap: '12px', alignItems: 'center' } }, portrait ?? null, h('div.grow', h('div.kicker.pix', title))),
      h('p.story.speech', t),
      h('div.col', opts.map((label, i) => h('button.btn.block.choice', { onclick: () => { sfx.click(); cb(i); } }, h('span', label)))));
  };
  const result = (t, changes, done = 'Done') => {
    clear(box);
    box.append(h('div.kicker.pix', title), h('p.story', t), changeChips(changes ?? []), h('button.btn.primary.block', { onclick: () => { m.close(); app.save(); app.render(); } }, done));
  };
  draw(text, choices, (i) => onChoose(i, { draw, result }));
  return m;
}

function firstDate(app) {
  const st = app.state;
  const c = meetSomeone(st);
  const pers = PERSONALITIES.find((x) => x.id === c.personality);
  const pic = portraitImg(c.look, 64);
  const ask = (ui) => {
    const r = datingRound(st);
    ui.draw(`${r.text}\n\n(Round ${r.round + 1} of ${r.of})`, r.choices, (i) => {
      const res = answerDate(st, i);
      if (!res.done) { ui.draw(res.reaction, ['Continue'], () => ask(ui)); return; }
      if (res.success) sfx.levelUp(); else sfx.groan();
      ui.result(`${res.reaction}\n\n${res.text}`, res.changes, res.success ? 'Yes!' : 'Oh well');
    });
  };
  const intro = `You meet ${c.name} at a coffee shop. ${pers.blurb} Into ${c.interest}.`;
  const open = () => scene(app, { title: `First date · ${c.name}`, portrait: pic, text: intro, choices: ['Say hi'], onChoose: (_, ui) => ask(ui) });
  playLife(app, (ctx) => dateScene(ctx, { look: st.player.look, partnerLook: c.look, partnerName: c.name, venue: 'First date' })).then(open);
}

function dateNight(app, venueId) {
  const st = app.state;
  const o = openDate(st, venueId);
  playLife(app, (ctx) => dateScene(ctx, { look: st.player.look, partnerLook: st.player.partnerLook, partnerName: st.player.partnerName, venue: o.venue.label })).then(() => scene(app, {
    title: `${o.venue.label} · ${st.player.partnerName}`, portrait: st.player.partnerLook ? portraitImg(st.player.partnerLook, 64) : null, text: o.moment, choices: o.choices,
    onChoose: (i, ui) => { const r = finishDate(st, venueId, i); sfx.select(); ui.result(r.text, r.changes); },
  }));
}

function hangout(app, id) {
  const st = app.state;
  const o = openHangout(st, id);
  const friends = people(st).filter((x) => x.kind === 'teammate').map((x) => x.look);
  const gaming = /game|arcade|video/i.test(`${id} ${o.hangout.label}`);
  playLife(app, (ctx) => (gaming ? gamingScene(ctx, { look: st.player.look, friendLook: friends[0] }) : hangoutScene(ctx, { look: st.player.look, friendLooks: friends, title: o.hangout.label })))
    .then(() => scene(app, {
      title: o.hangout.label, text: o.text, choices: o.choices,
      onChoose: (i, ui) => { const r = finishHangout(st, id, i); sfx.select(); ui.result(r.text, r.changes); },
    }));
}

/** Short 3D scene before a life moment (skipped with Reduced motion). */
export function playLife(app, build) {
  if (app.settings.reducedMotion) return Promise.resolve();
  return runSetCutscene(build, { music: 'groove' });
}
