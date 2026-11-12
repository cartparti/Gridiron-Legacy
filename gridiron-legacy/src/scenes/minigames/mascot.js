// Mascot career moments. You're in the big foam costume on the sideline:
//   ms_hype    Hype the Crowd   tap on the beat as the rings close in, every hit is a dance move and a louder crowd
//   ms_tshirt  T-Shirt Cannon   tap the fans waving in the stands before they sit down, the shirt arcs up to them
//   ms_rival   Mascot Showdown  the other team's mascot shows off a combo; copy it move for move, then settle it
//   ms_stunt   Halftime Stunt   trampoline: tap for power, tap for flips (if you have the air), tap to stick it
// Stats: Skill = timing windows and aim, Speed = time to answer in the showdown, Strength/IQ = forgiveness.
import * as THREE from 'three';
import { makeMascot } from '../sideline.js';
import { confetti } from '../actors.js';
import { maybeTip, endPlay, finalize, hudMeter } from './common.js';
import { sfx } from '../../audio/sfx.js';
import { react } from '../../audio/stadium.js';

const X0 = 27.8;
const has = (opts, id) => (opts.traits ?? []).includes(id); // the sideline in front of the home stands (+x)

// ------------------------------------------------------------------ costume animation
/** Procedural moves for a foam mascot (makeMascot rig: hips, torso, head, armL/R, legL/R). */
function poseMascot(m, move, k, t) {
  const u = m.userData;
  const s = Math.sin(k * Math.PI); // 0 -> 1 -> 0 over the move
  // rest pose with a little bounce so nobody stands still
  let hop = Math.max(0, Math.sin(t * 6)) * 0.06, tz = Math.sin(t * 3) * 0.05, ax = 0, aLz = -0.25, aRz = 0.25, aLx = 0, aRx = 0, hy = Math.sin(t * 1.7) * 0.25, hz = 0, lx = 0, rx = 0, ry = 0, tx = 0;
  switch (move) {
    case 'dance': hop = Math.abs(Math.sin(k * Math.PI * 2)) * 0.3; tz = Math.sin(k * Math.PI * 2) * 0.35; aLz = -1.6 - Math.sin(k * Math.PI * 4) * 0.6; aRz = 1.6 - Math.sin(k * Math.PI * 4) * 0.6; lx = Math.sin(k * Math.PI * 2) * 0.6; rx = -lx; hz = tz * 0.6; break;
    case 'flex': aLz = -1.5 * s - 0.2; aRz = 1.5 * s + 0.2; aLx = -1.4 * s; aRx = -1.4 * s; tx = -0.15 * s; hop = 0.04; hy = Math.sin(k * Math.PI * 3) * 0.4; break;
    case 'spin': ry = k * Math.PI * 2; aLz = -1.3; aRz = 1.3; hop = s * 0.35; break;
    case 'taunt': aRx = -1.5 * s; aRz = 0.2; tz = -0.2 * s; hz = 0.3 * s; aLz = -0.9 * s; hy = Math.sin(k * 20) * 0.3 * s; break; // point and wiggle
    case 'jump': hop = s * 1.1; aLz = -2.6 * s; aRz = 2.6 * s; lx = -0.6 * s; rx = -0.6 * s; break;
    case 'wave': aRz = 2.5; aRx = Math.sin(t * 14) * 0.3; hop = 0.05; break;
    case 'cannon': aLx = -1.3; aRx = -1.3; aLz = -0.25; aRz = 0.25; tx = 0.15 - s * 0.35; hop = 0; break; // cannon on the shoulder, recoil
    case 'cheer': hop = Math.abs(Math.sin(t * 9)) * 0.35; aLz = -2.5 + Math.sin(t * 9) * 0.3; aRz = 2.5 - Math.sin(t * 9) * 0.3; hy = Math.sin(t * 4) * 0.4; break;
    case 'sad': tx = 0.45; aLz = -0.05; aRz = 0.05; hz = 0.3; hop = 0; hy = 0; break;
    default: break;
  }
  u.hips.position.y = 1.0 + hop;
  u.torso.rotation.set(tx, 0, tz);
  u.head.rotation.set(0, hy, hz);
  u.armL.rotation.set(aLx, 0, aLz); u.armR.rotation.set(aRx, 0, aRz);
  u.legL.rotation.x = lx; u.legR.rotation.x = rx;
  m.rotation.y = (m.userData.baseYaw ?? 0) + ry;
}

/** A scene with the two of you (and the cannon / trampoline as needed). */
function setup(ctx) {
  const { group, opts, stadium } = ctx;
  const me = opts.costume ? makeMascot(opts.costume.kind, opts.costume.colors, opts.costume.costume) : makeMascot(opts.myMascot ?? 'shield', opts.teamColors);
  me.position.set(X0, 0, 0);
  me.userData.baseYaw = -Math.PI / 2; // facing the field (-x) by default
  group.add(me);
  // the sideline mascot would be your twin: hide it while you're the one in the suit
  const sm = stadium?.sideline?.spots?.()?.mascot;
  if (sm) { const v = sm.visible; sm.visible = false; ctx.addCleanup(() => { sm.visible = v; }); }
  const tag = document.createElement('div');
  tag.className = 'ms-tag pix';
  tag.textContent = opts.mascotName ? `"${String(opts.mascotName).toUpperCase()}" · ${String(opts.lastName ?? 'YOU').toUpperCase()} IN THE SUIT` : `#${opts.number ?? ''} ${String(opts.lastName ?? 'YOU').toUpperCase()} · IN THE SUIT`;
  ctx.hud.el.append(tag);
  ctx.addCleanup(() => tag.remove());
  return me;
}
const look = (camera, p, at) => { camera.position.set(p[0], p[1], p[2]); camera.lookAt(at[0], at[1], at[2]); };
const ease = (camera, p, at, dt, k = 3) => {
  const a = 1 - Math.exp(-k * dt);
  camera.position.x += (p[0] - camera.position.x) * a; camera.position.y += (p[1] - camera.position.y) * a; camera.position.z += (p[2] - camera.position.z) * a;
  camera.userData.mlook ??= new THREE.Vector3(...at);
  camera.userData.mlook.lerp(new THREE.Vector3(...at), a);
  camera.lookAt(camera.userData.mlook);
};
const btn = (label, sub, cls = '') => { const b = document.createElement('button'); b.className = `fc-btn big ${cls}`; b.innerHTML = `<b>${label}</b>${sub ? `<small>${sub}</small>` : ''}`; return b; };
const tapAnywhere = (ctx, fn) => {
  const down = (ev) => { if (ev.target.closest?.('.tipbox, .skip, .ms-pad')) return; ev.preventDefault?.(); fn(); };
  const key = (ev) => { if (!ev.repeat && (ev.key === ' ' || ev.key === 'Enter')) { ev.preventDefault(); fn(); } };
  ctx.canvas.addEventListener('pointerdown', down); ctx.hud.el.addEventListener('pointerdown', down); window.addEventListener('keydown', key);
  ctx.addCleanup(() => { ctx.canvas.removeEventListener('pointerdown', down); ctx.hud.el.removeEventListener('pointerdown', down); window.removeEventListener('keydown', key); });
};
/** Head pops off and bounces away (every mascot's nightmare). */
function headOff(ctx, m) {
  if (has(ctx.opts, 'velcro')) { ctx.hud.big('HEAD STAYS ON!', '#ffd43b', 700); return () => false; } // velcro head
  const head = m.userData.head;
  const wp = new THREE.Vector3(); head.getWorldPosition(wp);
  head.parent.remove(head);
  ctx.group.add(head);
  head.position.copy(wp);
  const v = new THREE.Vector3((Math.random() - 0.5) * 3, 4.5, (Math.random() - 0.5) * 3);
  let t = 0;
  return (dt) => {
    t += dt;
    v.y -= 14 * dt;
    head.position.addScaledVector(v, dt);
    head.rotation.x += dt * 7; head.rotation.z += dt * 4;
    if (head.position.y < 0.65) { head.position.y = 0.65; v.y = Math.abs(v.y) * 0.45; v.x *= 0.7; v.z *= 0.7; }
    return t < 3;
  };
}
const done = (ctx, m, r) => endPlay(ctx, finalize({ complete: false, yards: 0, ...r, quality: Math.max(0, Math.min(1, r.quality + (has(ctx.opts, 'velcro') && r.quality < 0.4 ? 0.1 : 0))) }, m), { delay: 1700 });

// ------------------------------------------------------------------ 1. Hype the crowd
export function mascotHype(ctx) {
  const { camera, hud, opts } = ctx;
  const m = opts.moment; const st = opts.stats; const call = opts.call;
  const me = setup(ctx);
  look(camera, [19.5, 3.2, 6.5], [29, 2.6, 0]);
  const beat = call === 'risky' ? 0.43 : call === 'safe' ? 0.6 : 0.5;
  const N = call === 'risky' ? 18 : 14;
  const win = Math.max(0.07, Math.min(0.24, 0.1 * opts.tolerance * (0.85 + st.skill / 300) * (has(opts, 'showman') ? 1.3 : 1))); // a GOOD hit
  const notes = Array.from({ length: N }, (_, i) => ({ at: 1.6 + i * beat * (i % 4 === 3 ? 1.5 : 1) + (i > 3 ? beat * 0.5 * Math.floor((i - 3) / 4) : 0), hit: null }));
  const meter = hudMeter('Crowd');
  const wrap = document.createElement('div'); wrap.className = 'hud-meters'; wrap.append(meter.el); hud.bottom(wrap);
  const pad = document.createElement('div'); pad.className = 'ms-beat'; pad.innerHTML = '<div class="ms-target">TAP</div><div class="ms-ring"></div><div class="ms-judge"></div><div class="ms-combo"></div>';
  hud.el.append(pad); ctx.addCleanup(() => pad.remove());
  const ring = pad.querySelector('.ms-ring'); const judge = pad.querySelector('.ms-judge'); const comboEl = pad.querySelector('.ms-combo');
  const MOVES = ['dance', 'flex', 'spin', 'jump', 'taunt', 'dance', 'cheer'];
  let phase = 'wait', t = 0, crowd = 0.25, combo = 0, best = 0, score = 0, move = null, moveT = 0, mi = 0;
  const say = (txt, cls) => { judge.textContent = txt; judge.className = `ms-judge show ${cls}`; clearTimeout(judge._t); judge._t = setTimeout(() => { judge.className = 'ms-judge'; }, 380); };
  const tap = () => {
    if (phase !== 'live') return;
    const n = notes.filter((x) => x.hit === null).sort((a, b) => Math.abs(a.at - t) - Math.abs(b.at - t))[0];
    if (!n || Math.abs(n.at - t) > win * 2.2) { combo = 0; crowd = Math.max(0, crowd - 0.03); say('OFF BEAT', 'bad'); return; }
    const off = Math.abs(n.at - t);
    if (off <= win * 0.45) { n.hit = 2; score += 2; say('PERFECT!', 'good'); } else if (off <= win) { n.hit = 1; score += 1; say('GOOD', 'ok'); } else { n.hit = 0; say('LATE', 'bad'); combo = 0; return; }
    combo++; best = Math.max(best, combo);
    crowd = Math.min(1, crowd + (n.hit === 2 ? 0.075 : 0.045) * (1 + Math.min(combo, 8) * 0.06));
    comboEl.textContent = combo >= 3 ? `${combo} COMBO` : '';
    move = MOVES[mi++ % MOVES.length]; moveT = 0;
    sfx.tick();
    if (combo % 5 === 0) { react('big', true); ctx.hype?.(Math.min(1, 0.5 + crowd * 0.5), 1.5); }
  };
  tapAnywhere(ctx, tap);
  maybeTip(ctx, 'Hype the Crowd', ['Rings close in on the TAP circle to the beat. Tap when each ring hits the circle.', 'Every hit is a dance move. Chain them for a combo and the stands go wild. Missed beats cool them off.'], () => { phase = 'live'; t = 0; hud.instr('Get them loud! Tap on the beat'); });
  return (dt, el) => {
    const tt = el ?? 0;
    if (phase === 'wait' || phase === 'over') { poseMascot(me, phase === 'over' && move ? move : null, 0.5, tt); return; }
    t += dt;
    if (move) { moveT += dt / 0.45; if (moveT >= 1) move = null; }
    poseMascot(me, move, Math.min(1, moveT), tt);
    // ring: the next note's approach (scale 2.4 -> 1 as it arrives)
    const next = notes.find((x) => x.hit === null && x.at - t > -win * 2.2);
    if (next) { const k = Math.max(0, (next.at - t) / (beat * 2)); ring.style.transform = `translate(-50%,-50%) scale(${1 + Math.min(1.6, k * 1.6)})`; ring.style.opacity = k > 1 ? 0.25 : 1; }
    for (const n of notes) if (n.hit === null && t - n.at > win * 2.2) { n.hit = 0; combo = 0; comboEl.textContent = ''; crowd = Math.max(0, crowd - 0.04); say('MISS', 'bad'); }
    crowd = Math.max(0, crowd - dt * 0.015);
    meter.set(crowd, crowd > 0.7 ? '#4ade80' : crowd > 0.4 ? '#fbbf24' : '#f87171');
    ctx.stadium?.setExcitement?.(crowd);
    ctx.hype?.(crowd, 0.3);
    if (notes.every((n) => n.hit !== null)) {
      phase = 'over';
      const q = Math.min(1, (score / (N * 2)) * 0.75 + crowd * 0.25 + Math.min(best, 10) * 0.01);
      move = q > 0.55 ? 'cheer' : 'sad';
      if (q > 0.6) { react('big', true); sfx.cheer(); } else sfx.groan?.();
      done(ctx, m, { quality: q, hype: Math.round(q * 20), text: q > 0.75 ? `${best}-beat combo! The whole stadium is on its feet.` : q > 0.45 ? 'Good energy. The student section is with you.' : 'Off beat and the crowd knows it. Rough one.' });
    }
  };
}

// ------------------------------------------------------------------ 2. T-shirt cannon
export function mascotTshirt(ctx) {
  const { camera, hud, opts, group } = ctx;
  const m = opts.moment; const st = opts.stats; const call = opts.call;
  const me = setup(ctx);
  me.userData.baseYaw = Math.PI / 2; // facing the stands (+x)
  me.position.set(X0 - 1.2, 0, 0);
  // the cannon: a fat tube on your shoulder
  const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 1.6, 10), new THREE.MeshStandardMaterial({ color: '#3a3f46', roughness: 0.4, metalness: 0.4 }));
  cannon.rotation.z = -Math.PI / 2 + 0.5; cannon.position.set(0.3, 1.0, 0.7);
  me.userData.armR.add(cannon);
  look(camera, [X0 - 13, 5.2, 3.2], [X0 + 7, 6.0, -0.5]); // over your shoulder, the stands filling the screen
  const SHOTS = (call === 'risky' ? 5 : 6) + (has(opts, 'cannonarm') ? 1 : 0);
  const TIME = 13;
  const radius = Math.max(36, Math.min(90, 48 * opts.tolerance * (0.8 + st.skill / 250) * (has(opts, 'cannonarm') ? 1.2 : 1))); // screen px
  const fans = [];
  const ringTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.strokeStyle = '#fff'; g.lineWidth = 7; g.beginPath(); g.arc(32, 32, 26, 0, 7); g.stroke(); g.fillStyle = 'rgba(255,212,59,0.35)'; g.fill(); return new THREE.CanvasTexture(c); })();
  ctx.addCleanup(() => ringTex.dispose());
  const spawn = () => {
    const vip = Math.random() < (call === 'risky' ? 0.3 : 0.18);
    const mat = new THREE.SpriteMaterial({ map: ringTex, color: vip ? '#ffd43b' : '#9be7ff', depthTest: false });
    const sp = new THREE.Sprite(mat); sp.renderOrder = 50;
    const tier = Math.floor(Math.random() * 5);
    sp.position.set(30.65 + 1.4 + tier * 1.25, 2.5 + tier * 1.6, (Math.random() - 0.5) * 16);
    sp.scale.setScalar(vip ? 1.1 : 1.6);
    group.add(sp);
    fans.push({ sp, t: 0, life: (vip ? 1.3 : 2.4) * (call === 'safe' ? 1.25 : 1), vip });
  };
  const hud2 = document.createElement('div'); hud2.className = 'ms-shots pix'; hud.el.append(hud2); ctx.addCleanup(() => hud2.remove());
  let phase = 'wait', t = 0, left = SHOTS, hits = 0, points = 0, nextSpawn = 0, recoil = 1;
  const shirts = [];
  const draw = () => { hud2.innerHTML = `SHIRTS ${'👕'.repeat(left)}<br><small>${hits} landed · ${Math.max(0, Math.ceil(TIME - t))}s</small>`; };
  draw();
  const v3 = new THREE.Vector3();
  const fire = (ev) => {
    if (phase !== 'live' || left <= 0) return;
    left--; recoil = 0; sfx.juke(); draw();
    const rect = ctx.canvas.getBoundingClientRect();
    const px = (ev?.clientX ?? rect.left + rect.width / 2) - rect.left, py = (ev?.clientY ?? rect.top + rect.height / 2) - rect.top;
    // closest fan to the tap on screen
    let tgt = null, bd = Infinity;
    for (const f of fans) { v3.copy(f.sp.position).project(camera); const sx = (v3.x + 1) / 2 * rect.width, sy = (1 - v3.y) / 2 * rect.height; const d = Math.hypot(sx - px, sy - py); if (d < bd) { bd = d; tgt = f; } }
    const hit = tgt && bd < radius * (tgt.vip ? 0.8 : 1);
    // where the shirt goes: the fan, or wherever you aimed on the stands
    let to;
    if (hit) to = tgt.sp.position.clone();
    else { const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(px / rect.width * 2 - 1, -(py / rect.height) * 2 + 1), camera); const plane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 33.5); to = new THREE.Vector3(); if (!ray.ray.intersectPlane(plane, to)) to.set(34, 5, 0); }
    const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.45), new THREE.MeshStandardMaterial({ color: opts.teamColors[Math.random() < 0.5 ? 0 : 1] }));
    const from = new THREE.Vector3(); cannon.getWorldPosition(from);
    shirt.position.copy(from); group.add(shirt);
    shirts.push({ m: shirt, from, to, t: 0, dur: 0.75, hit, fan: hit ? tgt : null });
    if (hit) { tgt.claimed = true; }
  };
  const onTap = (ev) => { if (ev.target.closest?.('.tipbox, .skip')) return; ev.preventDefault(); fire(ev); };
  ctx.canvas.addEventListener('pointerdown', onTap); ctx.hud.el.addEventListener('pointerdown', onTap);
  ctx.addCleanup(() => { ctx.canvas.removeEventListener('pointerdown', onTap); ctx.hud.el.removeEventListener('pointerdown', onTap); });
  const keyFire = (ev) => { if (ev.key === ' ' && !ev.repeat) fire(null); }; window.addEventListener('keydown', keyFire); ctx.addCleanup(() => window.removeEventListener('keydown', keyFire));
  maybeTip(ctx, 'T-Shirt Cannon', ['Glowing rings are fans begging for a shirt. Tap them before they sit back down.', 'Gold rings are VIPs: smaller and quicker, but worth double. You only have so many shirts.'], () => { phase = 'live'; t = 0; hud.instr('Tap the waving fans!'); });
  return (dt, el) => {
    const tt = el ?? 0;
    recoil = Math.min(1, recoil + dt * 3);
    poseMascot(me, phase === 'over' ? (hits >= SHOTS / 2 ? 'cheer' : 'sad') : 'cannon', recoil, tt);
    if (phase === 'wait') return;
    for (let i = shirts.length - 1; i >= 0; i--) {
      const s = shirts[i]; s.t += dt / s.dur;
      const k = Math.min(1, s.t);
      s.m.position.lerpVectors(s.from, s.to, k); s.m.position.y += Math.sin(k * Math.PI) * 3.2;
      s.m.rotation.x += dt * 9; s.m.rotation.y += dt * 6;
      if (k >= 1) {
        if (s.hit) { hits++; points += s.fan.vip ? 2 : 1; hud.big(s.fan.vip ? 'VIP! +2' : 'CAUGHT!', s.fan.vip ? '#ffd43b' : '#4ade80', 500); sfx.cheer(); react('good', true); group.remove(s.fan.sp); s.fan.sp.material.dispose(); fans.splice(fans.indexOf(s.fan), 1); }
        else hud.big('MISSED', '#f87171', 400);
        group.remove(s.m); s.m.geometry.dispose(); s.m.material.dispose(); shirts.splice(i, 1); draw();
      }
    }
    if (phase !== 'live') return;
    t += dt;
    if (t > nextSpawn && fans.length < 4) { spawn(); nextSpawn = t + 0.55 + Math.random() * 0.6; }
    for (let i = fans.length - 1; i >= 0; i--) {
      const f = fans[i]; f.t += dt;
      f.sp.material.opacity = Math.min(1, f.t * 5, (f.life - f.t) * 4);
      f.sp.scale.setScalar((f.vip ? 1.1 : 1.6) * (1 + Math.sin(f.t * 12) * 0.08));
      if (f.t > f.life && !f.claimed) { group.remove(f.sp); f.sp.material.dispose(); fans.splice(i, 1); }
    }
    if ((left <= 0 && !shirts.length) || t > TIME) {
      phase = 'over';
      for (const f of fans) { group.remove(f.sp); f.sp.material.dispose(); }
      fans.length = 0;
      const q = Math.min(1, points / (SHOTS * 1.15));
      if (q > 0.55) ctx.hype?.(0.9, 2);
      done(ctx, m, { quality: q, shirts: hits, text: hits >= SHOTS - 1 ? `${hits} for ${SHOTS}! Shirts raining into the upper deck.` : hits >= 2 ? `${hits} shirts landed. A few very happy fans.` : hits === 1 ? 'One shirt landed. One.' : 'Every shirt sails into an empty aisle. Oof.' });
    }
  };
}

// ------------------------------------------------------------------ 3. Mascot showdown
export function mascotRival(ctx) {
  const { camera, hud, opts, group } = ctx;
  const m = opts.moment; const st = opts.stats; const call = opts.call;
  const me = setup(ctx);
  const rival = makeMascot(opts.oppMascot ?? 'wolf', opts.oppColors);
  group.add(rival);
  me.position.set(X0, 0, 2.4); me.userData.baseYaw = Math.PI; // face each other along z
  rival.position.set(X0, 0, -2.4); rival.userData.baseYaw = 0;
  look(camera, [X0 - 15, 4.2, 0], [X0 + 1, 2.4, 0]);
  const MOVES = [['dance', '💃', 'DANCE'], ['flex', '💪', 'FLEX'], ['spin', '🌀', 'SPIN'], ['taunt', '👉', 'TAUNT']];
  const lens = call === 'risky' ? [4, 5, 6] : call === 'safe' ? [3, 3, 4] : [3, 4, 5];
  const answerT = Math.max(0.9, Math.min(2.8, 1.5 * opts.tolerance * (0.85 + st.speed / 300) * (has(opts, 'smoothmoves') ? 1.35 : 1)));
  const pad = document.createElement('div'); pad.className = 'ms-pad';
  const seqEl = document.createElement('div'); seqEl.className = 'ms-seq pix';
  hud.el.append(seqEl, pad); ctx.addCleanup(() => { pad.remove(); seqEl.remove(); });
  const buttons = MOVES.map(([id, ico, lab], i) => { const b = btn(`${ico}`, lab, 'ms-move'); b.disabled = true; b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); press(i); }); pad.append(b); return b; });
  const keyMap = { ArrowLeft: 0, ArrowUp: 1, ArrowRight: 2, ArrowDown: 3, 1: 0, 2: 1, 3: 2, 4: 3 };
  const onKey = (ev) => { if (ev.key in keyMap && !ev.repeat) { ev.preventDefault(); press(keyMap[ev.key]); } };
  window.addEventListener('keydown', onKey); ctx.addCleanup(() => window.removeEventListener('keydown', onKey));
  let phase = 'wait', round = 0, seq = [], show = 0, showT = 0, input = 0, inT = 0, correct = 0, total = 0, myMove = null, myT = 0, rvMove = null, rvT = 0, endT = 0, fx = null, won = null;
  const setButtons = (on) => buttons.forEach((b) => { b.disabled = !on; });
  const drawSeq = (revealed) => { seqEl.innerHTML = `ROUND ${round + 1}/3<br>${seq.map((s, i) => `<span class="${i < input && phase === 'answer' ? 'ok' : ''}">${i < revealed ? MOVES[s][1] : '•'}</span>`).join(' ')}`; };
  const startRound = () => {
    seq = Array.from({ length: lens[round] }, () => Math.floor(Math.random() * 4));
    phase = 'show'; show = 0; showT = -0.6; input = 0;
    setButtons(false); hud.instr('Watch their combo...'); drawSeq(0);
  };
  const press = (i) => {
    if (phase !== 'answer') return;
    myMove = MOVES[i][0]; myT = 0;
    total++;
    if (i === seq[input]) { correct++; input++; inT = 0; sfx.tick(); drawSeq(seq.length); if (input >= seq.length) { react('good', true); hud.big('NAILED IT!', '#4ade80', 600); nextRound(); } }
    else { sfx.error?.(); hud.big('WRONG MOVE', '#f87171', 600); react('bad', true); total += seq.length - input - 1; nextRound(); }
  };
  const nextRound = () => {
    setButtons(false); round++;
    if (round >= 3) { finishShow(); return; }
    phase = 'pause'; showT = 0;
  };
  const finishShow = () => {
    const pct = correct / Math.max(1, total);
    won = pct >= 0.7;
    phase = 'end'; endT = 0;
    hud.instr(won ? 'The crowd picks YOU!' : 'The crowd picks them...');
    if (won) { sfx.cheer(); react('big', true); ctx.hype?.(1, 2.5); } else { sfx.groan?.(); }
  };
  maybeTip(ctx, 'Mascot Showdown', ['Their mascot shows off a combo of moves. Copy it in the same order with the four buttons (or arrow keys).', 'Three rounds, longer every time. Win the crowd and you get to settle it.'], () => { round = 0; startRound(); });
  return (dt, el) => {
    const tt = el ?? 0;
    if (fx && !fx(dt)) fx = null;
    if (myMove) { myT += dt / 0.5; if (myT >= 1) myMove = null; }
    if (rvMove) { rvT += dt / 0.5; if (rvT >= 1) rvMove = null; }
    if (phase === 'show') {
      showT += dt;
      if (showT >= 0.62) {
        showT = 0;
        if (show < seq.length) { rvMove = MOVES[seq[show]][0]; rvT = 0; show++; drawSeq(show); sfx.tick(); }
        else { phase = 'answer'; inT = 0; setButtons(true); hud.instr('Your turn! Copy it'); drawSeq(0); }
      }
    } else if (phase === 'answer') {
      inT += dt;
      if (inT > answerT) { hud.big('TOO SLOW', '#f87171', 500); total += seq.length - input; nextRound(); }
    } else if (phase === 'pause') {
      showT += dt; if (showT > 0.8) startRound();
    } else if (phase === 'end') {
      endT += dt;
      // the winner charges and bowls the loser over; heads may come off
      const [a, b] = won ? [me, rival] : [rival, me];
      if (endT < 0.45) { a.position.z += (won ? -1 : 1) * dt * 8; poseMascot(a, 'jump', endT / 0.45, tt); poseMascot(b, 'sad', 0.5, tt); }
      else if (!fx && endT < 0.6) { sfx.hit(); ctx.shake(0.4); fx = headOff(ctx, b); b.rotation.x = won ? -1.4 : 1.4; b.position.y = 0.5; if (won) confetti(ctx.scene, new THREE.Vector3(X0, 2, 0), [opts.teamColors[0], opts.teamColors[1], '#ffffff']); }
      else { poseMascot(a, 'cheer', 0.5, tt); }
      if (endT > 1.0 && phase === 'end') {
        phase = 'over';
        const q = Math.min(1, (correct / Math.max(1, total)) * 0.9 + (won ? 0.1 : 0));
        done(ctx, m, { quality: q, danceWin: won, text: won ? `You win the showdown and flatten their ${opts.oppTeamName ?? 'mascot'} mascot. The crowd chants your name.` : `Their mascot wins the crowd and knocks your head clean off. On the big screen.` });
      }
      return;
    }
    if (phase !== 'end' && phase !== 'over') { poseMascot(me, myMove, myT, tt); poseMascot(rival, rvMove, rvT, tt + 1); }
  };
}

// ------------------------------------------------------------------ 4. Halftime stunt
export function mascotStunt(ctx) {
  const { camera, hud, opts, group } = ctx;
  const m = opts.moment; const st = opts.stats; const call = opts.call;
  const me = setup(ctx);
  // a mini trampoline on the field at midfield, crowd behind
  const tramp = new THREE.Group();
  const bed = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.12, 24), new THREE.MeshStandardMaterial({ color: '#16181c', roughness: 0.8 }));
  bed.position.y = 0.55; tramp.add(bed);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.09, 8, 28), new THREE.MeshStandardMaterial({ color: opts.teamColors[0] }));
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.58; tramp.add(rim);
  for (let i = 0; i < 4; i++) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 6), new THREE.MeshStandardMaterial({ color: '#888' })); const a = i * Math.PI / 2 + 0.6; leg.position.set(Math.cos(a) * 1.0, 0.28, Math.sin(a) * 1.0); tramp.add(leg); }
  const TX = X0 - 4;
  tramp.position.set(TX, 0, 0); group.add(tramp);
  ctx.addCleanup(() => tramp.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); }));
  me.position.set(TX, 0, 7); me.userData.baseYaw = Math.PI; // runs toward -z... onto the trampoline
  look(camera, [TX - 19, 5.0, 2.5], [TX, 3.6, 1.5]); // wide enough for the whole jump
  const sweet = Math.max(0.1, Math.min(0.36, 0.16 * opts.tolerance * (0.85 + st.skill / 300) * (has(opts, 'acrobat') ? 1.4 : 1)));
  const meter = document.createElement('div'); meter.className = 'hud-timing';
  meter.innerHTML = `<div class="zone" style="left:${(0.85 - sweet) * 100}%;width:${sweet * 100}%"></div><div class="mk"></div>`;
  const mk = meter.querySelector('.mk');
  let phase = 'wait', t = 0, power = 0, mpos = 0, mdir = 1, air = 0, airT = 0, flips = 0, rot = 0, landed = null, land = null, fx = null;
  const tap = () => {
    if (phase === 'power') {
      power = mpos >= 0.85 - sweet && mpos <= 0.85 ? 1 : Math.max(0.25, 1 - Math.abs(mpos - (0.85 - sweet / 2)) * 1.8);
      phase = 'run'; t = 0; hud.bottom(null); hud.instr(power >= 1 ? 'MAX POWER!' : 'Here we go...'); sfx.juke();
    } else if (phase === 'air') {
      if (land === null && airT < air - 0.3) { flips = Math.min(call === 'risky' ? 4 : 3, flips + 1); hud.big(`${flips} FLIP${flips > 1 ? 'S' : ''}`, '#ffd43b', 350); sfx.tick(); }
      else if (land === null) { land = airT; } // the stick-it tap
    }
  };
  tapAnywhere(ctx, tap);
  maybeTip(ctx, 'Halftime Stunt', ['Tap when the marker is in the green to hit the trampoline with full power.', 'In the air, each tap adds a flip (more power = more air). Near the ground, tap once more to stick the landing. Too many flips and you land on your head.'], () => { phase = 'power'; t = 0; hud.bottom(meter); hud.instr('Tap in the green for power'); });
  const bodyG = me.userData.hips;
  return (dt, el) => {
    const tt = el ?? 0;
    if (fx && !fx(dt)) fx = null;
    if (phase === 'wait') { poseMascot(me, 'wave', 0, tt); return; }
    t += dt;
    if (phase === 'power') {
      mpos += mdir * dt * (call === 'risky' ? 1.5 : 1.15); if (mpos > 1) { mpos = 1; mdir = -1; } if (mpos < 0) { mpos = 0; mdir = 1; }
      mk.style.left = `calc(${mpos * 100}% - 3px)`;
      poseMascot(me, 'dance', (tt * 1.5) % 1, tt);
      if (t > 6) tap();
      return;
    }
    if (phase === 'run') {
      me.position.z = Math.max(0, 7 - t * 9);
      poseMascot(me, 'dance', (t * 2) % 1, tt);
      if (me.position.z <= 0) { phase = 'air'; air = 0.95 + power * 0.85; airT = 0; sfx.bounce?.(0.8); }
      return;
    }
    if (phase === 'air') {
      airT += dt;
      const k = airT / air;
      me.position.y = 0.55 + Math.sin(Math.min(1, k) * Math.PI) * (1.6 + power * 2.4);
      // flips happen over the air time you have left after deciding
      const want = flips * Math.PI * 2;
      rot += (want - rot) * Math.min(1, dt * 7);
      poseMascot(me, 'jump', 0.5, tt); bodyG.rotation.x = -rot; bodyG.position.y += 0.4 * Math.sin(Math.min(1, flips ? rot / (flips * Math.PI * 2) : 0) * Math.PI); // tuck and spin around the middle
      if (land === null && airT > air - 0.28 && !me.userData.cue) { me.userData.cue = true; hud.instr('NOW! Tap to stick it'); }
      if (airT >= air) {
        // judge: did the flips finish, and did you time the landing tap?
        const flipsDone = Math.abs(want - rot) < 0.7 && flips * 0.42 <= air;
        const timing = land === null ? 0 : Math.max(0, 1 - Math.abs(air - 0.12 - land) / 0.3);
        landed = flipsDone && (timing > 0.35 || flips === 0) ? (timing > 0.7 ? 'stick' : 'wobble') : 'crash';
        phase = 'land'; t = 0; me.position.y = 0.55; bodyG.rotation.x = 0;
        if (landed === 'crash') { me.rotation.x = 1.3; me.position.y = 0.6; fx = headOff(ctx, me); sfx.hit(); ctx.shake(0.4); sfx.groan?.(); }
        else { sfx.cheer(); react('big', true); ctx.hype?.(landed === 'stick' ? 1 : 0.7, 2.5); if (landed === 'stick' && flips >= 2) confetti(ctx.scene, new THREE.Vector3(TX, 2.5, 0), [opts.teamColors[0], opts.teamColors[1], '#ffffff']); }
        hud.big(landed === 'stick' ? 'STUCK IT!' : landed === 'wobble' ? 'WOBBLY... BUT UP!' : 'FACEPLANT!', landed === 'crash' ? '#f87171' : '#4ade80', 1200);
      }
      return;
    }
    if (phase === 'land') {
      if (landed !== 'crash') poseMascot(me, 'cheer', 0.5, tt);
      if (t > 1.0) {
        phase = 'over';
        const q = landed === 'crash' ? 0.08 + flips * 0.03 : Math.min(1, (landed === 'stick' ? 0.62 : 0.45) + flips * 0.13 + power * 0.05);
        done(ctx, m, { quality: q, stunt: landed !== 'crash', text: landed === 'crash' ? `Faceplant on flip ${Math.max(1, flips)}. Your head rolls to the 40-yard line. Everyone saw.` : landed === 'stick' ? `${flips ? `${flips === 1 ? 'A backflip' : `${flips} flips`}` : 'A huge jump'} and you STICK IT. That's going viral.` : 'Wobbly landing, but you stay on your feet. Big cheer.' });
      }
    }
  };
}
