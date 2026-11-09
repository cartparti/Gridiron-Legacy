// Cornerback open-field tackle: the ball carrier comes at you and tries to juke.
// Controls: ← / → (or tap left/right) to shuffle, TACKLE button / Space when he is in range.
// Stats: IQ = reading his juke early (lean tell), Skill = tackle window, Strength = wrapping up, Speed = shuffle.
import * as THREE from 'three';
import { makePlayer, animateRun, makeBall, makeRing, faceToward, knockDown, setPose, setHop, playAction, celebrate } from '../actors.js';
import { bindInput, maybeTip, rig, endPlay, finalize, weatherFx } from './common.js';
import { sfx } from '../../audio/sfx.js';

const LANES = [-3, 0, 3];

export function tacklePlay(ctx) {
  const { group, camera, hud, opts } = ctx;
  const m = opts.moment;
  const st = opts.stats;
  const tol = opts.tolerance;
  const call = opts.call;
  const mine = opts.teamColors;
  const them = opts.oppColors;

  // Ball carrier starts downfield-near (he already caught it) and runs toward -z, at you.
  // Positions are relative to the real field: never spawn anyone behind the end zone.
  const room = Math.max(2, m.yardLine);
  const meZ = -Math.min(16, Math.max(1.5, room - 1));
  const carrier = makePlayer(them);
  const cpos = { x: 0, z: meZ + 14 };
  carrier.position.set(cpos.x, 0, cpos.z);
  group.add(carrier);
  const ball = makeBall();
  group.add(ball);
  const me = makePlayer(mine, { highlight: true });
  const mp = { x: (Math.random() < 0.5 ? -1 : 1) * 3, z: meZ };
  me.position.set(mp.x, 0, mp.z);
  faceToward(me, mp.x, 0);
  group.add(me);
  // A couple of pursuers behind for flavor.
  for (let i = 0; i < 2; i++) {
    const p = makePlayer(mine);
    p.position.set(-8 + i * 16, 0, cpos.z + 2);
    group.add(p);
  }

  const btns = document.createElement('div');
  btns.className = 'hud-pad';
  btns.innerHTML = '<button class="hbtn" data-a="left" aria-label="Shuffle left">◀</button><button class="hbtn big" data-a="tackle">TACKLE</button><button class="hbtn" data-a="right" aria-label="Shuffle right">▶</button>';
  hud.bottom(btns);

  const wfx = weatherFx(m);
  const vC = (7.6 + Math.random() * 0.8) * wfx.speed;
  const jukeAt = 3.2 + Math.random() * 2.5; // distance at which he cuts
  const jukeDir = Math.random() < 0.5 ? -1 : 1;
  const doubleMove = call === 'risky' && Math.random() < 0.4;
  const tellLead = 0.15 + (st.iq / 100) * 0.45; // seconds of lean before the cut
  const tWin = (1.4 + (st.skill / 100) * 0.6) * Math.sqrt(tol);
  let myLane = mp.x < 0 ? 0 : 2;
  let cLane = 1;
  let phase = 'wait';
  let t = 0;
  let cut = 0;
  let tackleT = null;

  rig(camera, 0, (cpos.z + meZ) / 2, 0, { zoom: 0.85, ahead: 2, snap: true });

  const shuffle = (d) => { if (phase === 'live') { myLane = Math.max(0, Math.min(2, myLane + d)); sfx.juke(); } };
  const tackle = () => { if (phase === 'live' && tackleT === null) { tackleT = t; setPose(me, 'dive'); sfx.juke(); } };
  btns.addEventListener('pointerdown', (ev) => {
    const a = ev.target.closest('.hbtn')?.dataset.a;
    if (!a) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (a === 'left') shuffle(-1); else if (a === 'right') shuffle(1); else tackle();
  });
  bindInput(ctx, {
    down: (ev) => { if (ev.clientY > window.innerHeight * 0.75) return; shuffle(ev.clientX < window.innerWidth / 2 ? -1 : 1); },
    key: (ev, down) => {
      if (!down) return;
      if (ev.key === 'ArrowLeft' || ev.key === 'a') shuffle(-1);
      if (ev.key === 'ArrowRight' || ev.key === 'd') shuffle(1);
      if (ev.key === ' ') tackle();
    },
  });

  maybeTip(ctx, 'Open-Field Tackle', [
    'The ball carrier is coming at you and will try to juke.',
    'Watch the runner lean (higher Football IQ = earlier tell), shuffle into that lane, and hit TACKLE when close.',
    'Dive too early and the runner goes right past you.',
  ], () => { phase = 'pre'; hud.instr('Square up the runner!'); });

  const finish = (r) => { if (phase === 'over') return; phase = 'over'; endPlay(ctx, finalize({ ...r, defense: true }, m)); };

  return (dt) => {
    if (phase === 'wait' || phase === 'over') return;
    t += dt;
    if (phase === 'pre') { if (t > 0.5) { phase = 'live'; t = 0; sfx.whistle(); hud.instr(''); } return; }

    const dist = cpos.z - mp.z;
    // Juke logic: he leans, then cuts. Risky = possible double move.
    const timeToJuke = (dist - jukeAt) / (vC + 6);
    if (cut === 0 && timeToJuke < tellLead) carrier.userData.sprite.position.x = jukeDir * 0.25; // the lean "tell"
    if (cut === 0 && dist <= jukeAt) { cut = 1; cLane = Math.max(0, Math.min(2, 1 + jukeDir)); carrier.userData.sprite.position.x = 0; sfx.juke(); playAction(carrier, ['juke', 'juke'], { fps: 10 }); }
    if (doubleMove && cut === 1 && dist <= jukeAt * 0.45) { cut = 2; cLane = 1; sfx.juke(); playAction(carrier, ['juke', 'juke'], { fps: 10 }); }
    cpos.z -= vC * dt;
    cpos.x += Math.sign(LANES[cLane] - cpos.x) * Math.min(Math.abs(LANES[cLane] - cpos.x), 9 * dt);
    carrier.position.set(cpos.x, 0, cpos.z);
    faceToward(carrier, cpos.x + (LANES[cLane] - cpos.x), cpos.z - 1);
    animateRun(carrier, dt, vC);
    ball.position.set(cpos.x + 0.4, 1.3, cpos.z);
    // You close in.
    const myV = 3 + (st.speed / 100) * 2;
    if (tackleT === null) mp.z += myV * dt * 0.4;
    mp.x += Math.sign(LANES[myLane] - mp.x) * Math.min(Math.abs(LANES[myLane] - mp.x), (6 + st.speed * 0.04) * dt);
    if (tackleT !== null) mp.z += 9 * dt;
    me.position.set(mp.x, 0, mp.z);
    faceToward(me, mp.x, mp.z + 1);
    animateRun(me, dt, tackleT !== null ? 9 : myV);
    if (tackleT !== null) setHop(me, Math.sin(Math.min(Math.PI, (t - tackleT) * 5)) * 0.6);
    rig(camera, (cpos.x + mp.x) / 2, (cpos.z + mp.z) / 2, dt, { zoom: 0.85, ahead: 2, k: 4 });

    // Contact resolution.
    if (Math.abs(cpos.z - mp.z) < 1.0) {
      const sameLane = Math.abs(cpos.x - mp.x) < 1.4;
      const timed = tackleT !== null && (t - tackleT) < tWin * 0.35;
      const late = tackleT === null;
      if (sameLane && (timed || late)) {
        const wrap = 0.55 + st.strength / 220 + (timed ? 0.2 : -0.15) - wfx.slip * 2;
        if (Math.random() < wrap) {
          knockDown(carrier, 1);
          playAction(me, ['tackle', 'fall'], { fps: 6, then: 'getup' });
          setTimeout(() => celebrate(me), 700);
          sfx.hit();
          ctx.shake(0.4);
          const ff = timed && Math.random() < 0.08 + st.strength / 1000 + (call === 'risky' ? 0.06 : 0);
          return finish(ff ? { tackle: true, forcedFumble: true, turnover: true, quality: 0.95, yardsAllowed: 2, text: 'Forced FUMBLE!' }
            : { tackle: true, quality: timed ? 0.8 : 0.55, yardsAllowed: Math.max(0, Math.round(-cpos.z + (timed ? 0 : 1.5))), text: timed ? 'BOOM! Huge hit.' : 'Dragged the runner down.' });
        }
        hud.big('BROKE YOUR TACKLE', '#f87171', 700);
      } else hud.big('MISSED!', '#f87171', 700);
      knockDown(me, 1);
      sfx.groan();
      return finish({ tackle: false, quality: 0.1, yardsAllowed: Math.max(0, Math.round(-cpos.z)) + 10 + Math.round(Math.random() * 18 * (call === 'risky' ? 1.4 : 1)), text: 'Missed tackle! The runner is loose.' });
    }
    if (tackleT !== null && t - tackleT > 0.7 && cpos.z > mp.z + 1) {
      // Dove way too early.
      knockDown(me, 1);
      hud.big('TOO EARLY!', '#f87171', 700);
      return finish({ tackle: false, quality: 0.08, yardsAllowed: Math.max(0, Math.round(-cpos.z)) + 12 + Math.round(Math.random() * 16), text: 'Dove too early. Big gain.' });
    }
  };
}
