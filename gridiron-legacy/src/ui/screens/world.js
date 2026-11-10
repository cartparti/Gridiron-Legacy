// Walkable places: Home, Park, Stadium, Downtown. Doing activities here fills your week's day slots.
import { h, clear } from '../dom.js';
import { openModal, toast } from '../components.js';
import { runWorld, stopWorld, runSetCutscene } from '../../scenes/director.js';
import { gamingScene, hangoutScene, dateScene } from '../../scenes/sets.js';
import { placeFor } from '../../data/places.js';
import { DAYS } from '../../data/config.js';
import { ACTIVITY_BY_ID, isAvailable, maxEnergy, planCost } from '../../sim/week.js';
import { people, findPerson } from '../../sim/social.js';
import { owned } from '../../sim/shop.js';
import { applyEffects } from '../../sim/effects.js';
import { personSheet, storeView } from './people.js';
import { icon, activityIcon } from '../icons.js';
import { sfx } from '../../audio/sfx.js';
import { fmtMoney } from '../../core/util.js';

export const PLACE_LIST = ['home', 'park', 'stadium', 'downtown'];

/** Place picker cards (used on the hub and in the world's map). */
const PLACE_BLURBS = {
  hs: { home: 'Your room, the kitchen, family and the garage gym', park: 'Pickup hoops, drills, food truck', stadium: 'Locker room, weights, film, coach', downtown: 'Main Street shops, diner, part-time job' },
  college: { home: 'Your dorm room, roommate and the common lounge', park: 'The quad: drills, hoops, campus life', stadium: 'Athletic center: lift, film, recovery, media', downtown: 'College town: coffee, arcade, nightlife' },
  pro: { home: 'Penthouse: home gym, chef kitchen, pool deck', park: 'Waterfront: runs, courts, food trucks', stadium: 'Team facility: performance, recovery, press', downtown: 'City center: luxury shops, dealers, dinners' },
};
export function placeCards(app, onPick) {
  const stage = app.state?.career?.stage ?? 'hs';
  const blurbs = PLACE_BLURBS[stage] ?? PLACE_BLURBS.pro;
  return h('div.place-grid', PLACE_LIST.map((id) => { const pl = placeFor(id, stage); return h('button.place-card', { onclick: () => { sfx.select(); onPick(id); } },
    icon(pl.icon), h('b', pl.name), h('span.tiny.muted', blurbs[id])); }));
}

export function enterWorld(app, placeId) {
  app.ui.world = placeId;
  app.render();
}

export function worldScreen(app) {
  const st = app.state;
  const p = st.player;
  const placeId = app.ui.world;
  const root = document.getElementById('app');
  root.style.visibility = 'hidden';
  const hud = document.createElement('div');
  hud.className = 'world-hud';
  document.body.append(hud);
  const joy = h('div.joy', h('i'));
  document.body.append(joy);

  const peopleList = people(st);
  const lookFor = (key) => {
    if (key === 'self') return p.look;
    if (key === 'fan') return { shirt: ['#e63946', '#457b9d', '#2a9d8f', '#f4a261', '#9b5de5'][Math.floor(Math.random() * 5)], pants: '#2b2d42', skin: Math.floor(Math.random() * 5), hair: Math.floor(Math.random() * 7), hairStyle: Math.floor(Math.random() * 4) };
    return peopleList.find((x) => x.key === key)?.look ?? null;
  };
  const nameFor = (key) => peopleList.find((x) => x.key === key)?.short ?? 'someone';
  const check = (needs) => {
    if (needs.item && !owned(p, needs.item)) return false;
    if (needs.flag && !p.flags[needs.flag]) return false;
    if (needs.partner && !p.partnerName) return false;
    if (needs.agent && !p.agentName) return false;
    if (needs.injured && !p.injury) return false;
    if (needs.stage && !needs.stage.includes(st.career.stage)) return false;
    if (needs.housing && !needs.housing.includes(p.housing)) return false;
    return true;
  };

  // ---- HUD
  const top = h('div.world-top');
  const prompt = h('div.world-prompt');
  const hint = h('div.world-hint', 'Drag anywhere to walk · WASD / arrows · E or Space to interact');
  hud.append(top, hint, prompt);
  setTimeout(() => hint.remove(), 4500);
  const drawTop = () => {
    clear(top);
    const max = maxEnergy(st);
    const left = max - planCost(st.week.plan);
    const pips = [];
    for (let i = 0; i < max; i++) pips.push(h(`span.pip${i >= left ? '.used' : ''}`));
    const days = st.week.plan.map((e, i) => h('span', { title: DAYS[i], style: { display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', marginRight: '3px', background: e ? 'var(--good)' : 'rgba(255,255,255,0.25)' } }));
    top.append(
      h('div.world-pill', h('div', placeFor(placeId, st.career.stage).name), h('div', { style: { marginTop: '6px' } }, days), h('div.pips', pips)),
      h('div.world-places',
        h('button.world-btn', { onclick: () => openMap() }, icon('calendar'), ' Map'),
        h('button.world-btn', { onclick: () => exit() }, 'Week ▸')));
  };
  drawTop();

  let world = null;
  let focus = null;
  const drawPrompt = () => {
    clear(prompt);
    if (!focus) return;
    const a = focus.act;
    let sub = '';
    if (a.kind === 'activity') {
      const act = ACTIVITY_BY_ID[a.id];
      sub = act ? (act.cost ? `${act.cost} energy · uses a day` : 'Free · uses a day') : '';
    } else if (a.kind === 'snack') sub = fmtMoney(a.price);
    prompt.append(h('button.act-btn', { onclick: () => activate() }, focus.label));
    if (sub) prompt.append(h('div.sub', sub));
  };

  const flash = (text) => {
    const t = h('div.world-toast', text);
    document.body.append(t);
    setTimeout(() => t.remove(), 1400);
  };

  const weekFull = () => st.week.plan.every((x) => x);

  const doActivity = (id) => {
    const act = ACTIVITY_BY_ID[id];
    if (!act) return;
    if (!isAvailable(st, act)) return toast('You can\'t do that right now.');
    const slot = st.week.plan.findIndex((x) => !x);
    if (slot < 0) return toast('Your week is full. Head to game day!');
    if (act.cost > maxEnergy(st) - planCost(st.week.plan)) return toast('Not enough energy left this week.');
    st.week.plan[slot] = id;
    app.save();
    sfx.levelUp();
    world?.emote('do');
    // a little scene for the fun stuff
    const friends = people(st).filter((x) => x.kind === 'teammate').map((x) => x.look);
    const life = id === 'gaming' ? (ctx) => gamingScene(ctx, { look: p.look, friendLook: friends[0] })
      : id === 'hangout' || id === 'nightout' ? (ctx) => hangoutScene(ctx, { look: p.look, friendLooks: friends, title: act.label })
        : id === 'date' && p.partnerName ? (ctx) => dateScene(ctx, { look: p.look, partnerLook: p.partnerLook, partnerName: p.partnerName, venue: act.label }) : null;
    if (life && !app.settings.reducedMotion) runSetCutscene(life, { music: 'groove' });
    flash(`${DAYS[slot]}: ${act.label}`);
    drawTop();
    if (weekFull()) setTimeout(() => offerGameDay(), 900);
  };

  const offerGameDay = () => {
    const m = openModal([
      h('div.kicker', 'Week planned'),
      h('h2', 'Your week is full'),
      h('p.story', 'Every day is booked. Ready to head to game day?'),
      h('div.col',
        h('button.btn.primary.block', { onclick: () => { m.close(); exit(); } }, 'Go to the week screen'),
        h('button.btn.ghost.block', { onclick: () => m.close() }, 'Keep exploring')),
    ]);
  };

  const activate = () => {
    if (!focus || document.querySelector('.modal-back')) return;
    const a = focus.act;
    sfx.click();
    switch (a.kind) {
      case 'activity': doActivity(a.id); break;
      case 'person': {
        if (a.key !== 'fan' && !findPerson(st, a.key)) return toast('Nobody here right now.');
        world?.emote('wave');
        personSheet(app, a.key, { onDone: drawTop });
        break;
      }
      case 'pet': {
        const k = 'pet:pet';
        st.week.chats = st.week.chats ?? {};
        if (st.week.chats[k]) { flash('Tail wags. Still happy.'); break; }
        st.week.chats[k] = true;
        applyEffects(st, { mood: 3 });
        app.save();
        flash('Good dog! +3 mood');
        break;
      }
      case 'shop': {
        const box = h('div');
        const draw = () => { clear(box); box.append(h('div.kicker', 'Downtown'), h('h2', a.name), storeView(app, { cat: a.cat, onBuy: draw }), h('button.btn.ghost.block', { style: { marginTop: '10px' }, onclick: () => m.close() }, 'Leave the store')); };
        const m = openModal(box, { dismissable: true });
        draw();
        break;
      }
      case 'page':
        exit({ tab: a.tab, sub: a.sub });
        break;
      case 'snack': {
        if (p.money < a.price) return toast('Not enough money.');
        st.week.chats = st.week.chats ?? {};
        const k = `snack:${a.name}`;
        p.money -= a.price;
        const first = !st.week.chats[k];
        st.week.chats[k] = true;
        if (first) applyEffects(st, { mood: a.mood ?? 0, health: a.health ?? 0 });
        app.save();
        sfx.cash();
        flash(`${a.name}${first ? ` · +${a.mood} mood` : ''}`);
        drawTop();
        break;
      }
      case 'travel': openMap(); break;
      case 'info': toast(a.text); break;
      default: break;
    }
  };

  const openMap = () => {
    const m = openModal([h('div.kicker', 'Where to?'), h('h2', 'Map'), placeCards(app, (id) => { m.close(); switchPlace(id); }),
      h('button.btn.ghost.block', { style: { marginTop: '12px' }, onclick: () => { m.close(); exit(); } }, 'Back to the week screen')], { dismissable: true });
  };

  // ---- input: drag-anywhere joystick + keys
  const canvas = document.querySelector('#stage canvas');
  let drag = null;
  const keys = {};
  const updateInput = () => {
    let x = 0;
    let z = 0;
    if (drag) { x = drag.dx / 50; z = drag.dy / 50; }
    if (keys.a || keys.arrowleft) x -= 1;
    if (keys.d || keys.arrowright) x += 1;
    if (keys.w || keys.arrowup) z -= 1;
    if (keys.s || keys.arrowdown) z += 1;
    world?.setInput({ x, z });
  };
  const pd = (ev) => {
    if (ev.target.closest('.world-top, .world-prompt, .modal-back')) return;
    drag = { x0: ev.clientX, y0: ev.clientY, dx: 0, dy: 0 };
    joy.style.display = 'block';
    joy.style.left = `${ev.clientX}px`;
    joy.style.top = `${ev.clientY}px`;
    joy.firstChild.style.transform = 'translate(0,0)';
  };
  const pm = (ev) => {
    if (!drag) return;
    drag.dx = Math.max(-55, Math.min(55, ev.clientX - drag.x0));
    drag.dy = Math.max(-55, Math.min(55, ev.clientY - drag.y0));
    joy.firstChild.style.transform = `translate(${drag.dx * 0.6}px, ${drag.dy * 0.6}px)`;
    updateInput();
  };
  const pu = () => { drag = null; joy.style.display = 'none'; updateInput(); };
  const kd = (ev) => {
    if (document.querySelector('.modal-back')) return;
    const k = ev.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { keys[k] = true; ev.preventDefault(); updateInput(); }
    if (k === 'e' || k === ' ' || k === 'enter') { ev.preventDefault(); activate(); }
  };
  const ku = (ev) => { keys[ev.key.toLowerCase()] = false; updateInput(); };
  window.addEventListener('pointerdown', pd);
  window.addEventListener('pointermove', pm);
  window.addEventListener('pointerup', pu);
  window.addEventListener('keydown', kd);
  window.addEventListener('keyup', ku);

  const cleanup = () => {
    window.removeEventListener('pointerdown', pd);
    window.removeEventListener('pointermove', pm);
    window.removeEventListener('pointerup', pu);
    window.removeEventListener('keydown', kd);
    window.removeEventListener('keyup', ku);
    hud.remove();
    joy.remove();
    root.style.visibility = '';
  };

  const start = (id) => {
    world = runWorld(id, {
      state: st, stage: st.career.stage, lookFor, nameFor, check, weather: st.week.forecast,
      onFocus: (f) => { focus = f; drawPrompt(); },
    });
    if (!world) {
      toast('Walking around needs 3D graphics, which this device does not support.');
      exit();
    }
  };
  const switchPlace = (id) => {
    app.ui.world = id;
    focus = null;
    drawPrompt();
    start(id);
    drawTop();
    clear(top);
    drawTop();
    // update place name in the pill
  };
  const exit = (goto) => {
    stopWorld();
    cleanup();
    app.ui.world = null;
    if (goto) { app.hubTab = goto.tab; if (goto.sub) app.ui.lifeSub = goto.sub; }
    app.ui.cleanupWorld = null;
    app.render();
  };
  app.ui.cleanupWorld = () => { stopWorld(); cleanup(); };

  start(placeId);
  return h('div');
}

export { activityIcon };
