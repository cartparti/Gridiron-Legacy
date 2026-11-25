// Free-control play engine. Every key moment becomes a full 11-on-11 play: pick a play from the
// playbook, then control your player from the snap to the whistle with the joystick (or WASD).
//
// AI is deliberately readable: defenders crouch and flash a red ring for a moment before they
// lunge for a tackle ("tell"), blockers visibly lock up with rushers, defensive backs backpedal
// and turn their heads, and everyone takes pursuit angles toward the ball carrier.
//
// Returns the same result objects as the old minigames, so the game simulation is unchanged.
import * as THREE from 'three';
import { makePlayer, animateRun, faceToward, setPose, playAction, celebrate, knockDown, isDown, setHop, makeBall, makeRing, makeLabel, makeRouteLine, makeRouteRibbon, makeZoneArea, confetti, ragdoll, bloodBurst, dustPuff, markTicked, bump, applyWear, addWear, applyInjuryLook, setLookAt, setReach, setSurface } from '../actors.js';
import { surfaceFor } from '../../data/surface.js';
import { INJURIES } from '../../data/lifestyle.js';
import { xrayCard } from './xray.js';
import { liveXray } from './xraylive.js';
import { createBallPhysics, orientInFlight } from './ballphys.js';
import { rig, endPlay, finalize, weatherFx, gaussR } from '../minigames/common.js';
import { makeControls } from './controls.js';
import { PLAYS, OFF_FORMATION, OL_X, playMode, dealPlays, situationOf, rushLane, stopGap } from '../../data/playbook.js';
import { playArtSVG } from './playart.js';
import { sfx } from '../../audio/sfx.js';
import { line } from '../../data/commentary.js';
import { POS_SIZE } from '../../data/looks.js';
import { react, playMusic, stopMusic } from '../../audio/stadium.js';
import { flameJet, firework, makeTrail } from '../fx.js';

const FIELD_X = 26.4;
const BASE_SPEED = { QB: 7.0, RB: 8.1, WR: 8.5, TE: 7.3, OL: 5.6, DL: 6.6, LB: 7.3, CB: 8.4, S: 8.1 };
const NUMBERS = { QB: [1, 19], RB: [20, 39], WR: [10, 19], TE: [80, 89], OL: [60, 79], DL: [90, 99], LB: [40, 59], CB: [20, 39], S: [21, 49] };
const rnd = (a, b) => a + Math.random() * (b - a);
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function freePlay(ctx) {
  const { group, camera, hud, opts, scene } = ctx;
  const m = opts.moment;
  const type = ctx.type;
  const mode = playMode(type);
  const st = opts.stats;
  const tol = opts.tolerance;
  // 0 (raw) .. 1 (elite): how much room your skill buys you. Low-rated QBs see tighter windows.
  const qbSkill = Math.max(0, Math.min(1, (((st.skill ?? 60) + (st.iq ?? 60)) / 2 - 50) / 45));
  const call = opts.call;
  const wfx = weatherFx(m);
  // footing: the home field's grass or turf, the weather and how torn up it is (data/surface.js)
  const surf = surfaceFor(opts.culture ?? null, m.weather ?? 'clear', opts.wear?.progress ?? 0);
  setSurface(surf);
  ctx.addCleanup?.(() => setSurface(null));
  const offColors = m.defense ? opts.oppColors : opts.teamColors;
  const defColors = m.defense ? opts.teamColors : opts.oppColors;
  const offUniform = m.defense ? opts.oppUniform : opts.teamUniform;
  const defUniform = m.defense ? opts.teamUniform : opts.oppUniform;
  const goalZ = -m.yardLine;
  const backLine = goalZ - 9.5;
  const clampPos = (p) => { p.x = Math.max(-FIELD_X - 1, Math.min(FIELD_X + 1, p.x)); p.z = Math.max(backLine, Math.min(25, p.z)); return p; };
  // Defenders get faster on harder settings / risky calls (tolerance is lower).
  // Opponent quality (-1.5 weak .. +1.5 elite): good teams are faster, read quicker and win more battles.
  const oppK = Math.max(-1.5, Math.min(1.5, opts.oppStrength ?? 0));
  const defBoost = (1.08 - (tol - 1) * 0.12) * wfx.speed * (m.defense ? 1 : 1 + oppK * 0.035);

  // ---------------- game wear: uniforms get dirtier as the game goes on (wet in rain, snowy in snow)
  const wetGame = m.weather === 'rain' || m.weather === 'storm';
  const snowGame = m.weather === 'snow';
  const wearFor = (role) => {
    const prog = opts.wear?.progress ?? 0;
    const k = role === 'OL' || role === 'DL' ? 1.35 : role === 'QB' ? 0.55 : role === 'S' || role === 'LB' ? 1.1 : 1;
    return {
      level: Math.min(1, prog * k * (0.5 + Math.random() * 0.9) * (wetGame ? 1.3 : 1)),
      wet: wetGame ? 0.9 : snowGame ? 0.5 : 0,
      snow: snowGame,
      mud: wetGame,
      blood: opts.blood !== false && prog > 0.35 && Math.random() < 0.12 * prog ? 0.2 + Math.random() * 0.5 : 0,
    };
  };
  const fw = opts.wear ? ctx.stadium?.fieldWear : null;

  // ---------------- entities
  const ents = [];
  const add = (team, role, slot, x, z, extra = {}) => {
    const [n0, n1] = NUMBERS[role];
    const isUser = !!extra.user;
    const colors = team === 'off' ? offColors : defColors;
    const mesh = makePlayer(colors, {
      highlight: isUser, number: isUser && opts.number !== undefined ? opts.number : extra.number ?? Math.floor(rnd(n0, n1 + 1)),
      uniform: (() => { const un = team === 'off' ? offUniform : defUniform; return isUser && opts.captain && un ? { ...un, captain: true } : un; })(), look: isUser ? opts.look : undefined, position: role,
    });
    mesh.position.set(x, 0, z);
    if (opts.wear) applyWear(mesh, wearFor(role));
    faceToward(mesh, x, team === 'off' ? z - 5 : z + 5);
    mesh.userData.u.targetYaw = team === 'off' ? 0 : Math.PI;
    mesh.rotation.y = mesh.userData.u.targetYaw;
    group.add(mesh);
    // Size matters: heavier players are slower but stronger, taller players catch over people.
    const L = mesh.userData.look ?? {};
    const [h0, w0] = POS_SIZE[role] ?? [73, 210];
    const hIn = L.heightIn ?? h0;
    const wLb = L.weightLb ?? w0;
    const sizeSpeed = Math.max(0.86, Math.min(1.1, 1 - ((wLb - w0) / w0) * 0.45 + (hIn - h0) * 0.004));
    const e = {
      team, role, slot, mesh, pos: { x, z }, vel: { x: 0, z: 0 }, start: { x, z }, hIn, wLb, mass: wLb / 210,
      maxSpeed: BASE_SPEED[role] * (team === 'def' ? defBoost : wfx.speed * (m.defense && !isUser ? 1 + oppK * 0.035 : 1)) * rnd(0.97, 1.03) * (isUser ? (opts.hurt ?? 1) : sizeSpeed) * (1 - surf.sink),
      user: isUser, route: null, s: 0, engaged: null, out: 0, tell: 0, lunge: 0, lungeDir: null, down: false, ...extra,
    };
    ents.push(e);
    return e;
  };

  // ---------------- choose user + formation
  const userRole = { pass: 'QB', run: type === 'qb_scramble' ? 'QB' : 'RB', route: 'WR', cover: 'CB', runD: 'CB', rush: 'DL', runStop: 'DL' }[mode];
  const has = (id) => (opts.traits ?? []).includes(id); // equipped player traits
  const runO = mode === 'run' || mode === 'runD' || mode === 'runStop'; // the offense runs the ball
  const passD = mode === 'cover' || mode === 'rush'; // you defend a pass play
  const dtMode = mode === 'rush' || mode === 'runStop';
  let plays = dealPlays(mode, call, m);
  const sit = situationOf(m);
  const hm = (name, desc, routes) => ({ name, desc, form: 'shotgun', hail: true, routes });
  const g = goalZ;
  if (type === 'qb_hailmary') plays = [
    hm('Hail Mary', 'Everyone to the end zone. Throw it up!', { X: [[0, g - 3]], Z: [[0, g - 3]], S: [[2, g - 4]], TE: [[-2, g - 2]], RB: [[3, -2]] }),
    hm('Flood Left', 'Four receivers flood the left corner.', { X: [[0, g - 3]], Z: [[-14, g - 2]], S: [[-6, g - 4]], TE: [[-8, g - 2]], RB: [[3, -2]] }),
    hm('Flood Right', 'Four receivers flood the right corner.', { X: [[14, g - 2]], Z: [[0, g - 3]], S: [[8, g - 4]], TE: [[6, g - 2]], RB: [[-3, -2]] }),
    hm('Jump Box', 'Everyone meets in the middle. Tip it to someone.', { X: [[10, g - 2]], Z: [[-10, g - 2]], S: [[3, g - 3]], TE: [[-2, g - 1]], RB: [[0, -3]] }),
    hm('Deep Crossers', 'Receivers cross in the end zone.', { X: [[0, g + 6], [16, g - 3]], Z: [[0, g + 6], [-16, g - 3]], S: [[2, g - 4]], TE: [[-2, g - 2]], RB: [[3, -2]] }),
  ];
  if (type === 'rb_screen') plays = [
    { name: 'Screen Left', desc: 'Leak out left, catch it, follow the linemen.', form: 'shotgun', screen: -1 },
    { name: 'Screen Right', desc: 'Same thing to the right side.', form: 'shotgun', screen: 1 },
    { name: 'Middle Screen', desc: 'Sneak behind the rush up the middle.', form: 'shotgun', screen: 0 },
    { name: 'Slip Screen Left', desc: 'A short slip screen just outside the tackle.', form: 'shotgun', screen: -0.55 },
    { name: 'Slip Screen Right', desc: 'Slip out to the right behind the guard.', form: 'shotgun', screen: 0.55 },
  ];
  if (type === 'qb_scramble') plays = [
    { name: 'QB Draw', desc: 'Fake the pass, then run it yourself.', form: 'shotgun', hole: [0, 1.6], qbRun: true },
    { name: 'Bootleg', desc: 'Roll out to the edge and take off.', form: 'shotgun', hole: [7, 9], qbRun: true },
    { name: 'Sneak', desc: 'Lower your shoulder behind the center.', form: 'pistol', hole: [0, 0], qbRun: true },
    { name: 'Read Keep', desc: 'Read the end and keep it inside.', form: 'shotgun', hole: [-3, -1.5], qbRun: true },
    { name: 'Naked Boot Left', desc: 'Fake right, bootleg all the way left.', form: 'shotgun', hole: [-7, -9], qbRun: true },
  ];
  if (type === 'wr_jumpball') plays = [
    { name: 'Fade', desc: 'Go deep and win the jump ball.', route: [[1.5, -40]], jump: true },
    { name: 'Back-Shoulder Fade', desc: 'Stop at 22 and high-point it on your back shoulder.', route: [[1.5, -24], [2, -22]], sit: true, jump: true },
    { name: 'Go', desc: 'Straight up the field. Outrun him, then outjump him.', route: [[0, -40]], jump: true },
    { name: 'Post Jump', desc: 'Break to the post and go up over the safety.', route: [[0, -12], [-7, -34]], jump: true },
    { name: 'Corner Jump', desc: 'Break to the corner, high-point it near the sideline.', route: [[0, -12], [7, -30]], jump: true },
  ];
  const tz = (d) => -Math.min(d, m.yardLine);
  if (type === 'wr_toetap') plays = [
    { name: 'Sideline Out', desc: 'Catch it near the sideline and keep your feet in bounds!', route: [[0, tz(10)], [16, tz(10)]], toe: true },
    { name: 'Speed Out', desc: 'Quick out at 5. Drag your toes.', route: [[0, tz(5)], [16, tz(6)]], toe: true },
    { name: 'Deep Out', desc: 'Fourteen and out. Tiptoe the sideline.', route: [[0, tz(14)], [16, tz(14)]], toe: true },
    { name: 'Comeback', desc: 'Push deep, come back to the sideline.', route: [[0, tz(15)], [15, tz(12)]], toe: true },
    { name: 'Corner', desc: 'Break to the corner, stay in bounds.', route: [[0, tz(8)], [15, tz(18)]], toe: true },
  ];

  let play = null;
  let user = null;
  let qb = null;
  let rb = null;
  let receivers = [];
  let defenders = [];
  let blockers = [];
  const ball = makeBall();
  group.add(ball);
  group.add(ball.userData.shadow);
  // the ball is a physical object: it bounces, tumbles and rolls whenever nobody has it
  const bphys = createBallPhysics(ball, { onBounce: (imp) => { if (imp > 1.5) sfx.bounce(Math.min(1, imp / 6)); if (imp > 4) fxList.push(dustPuff(group, { x: ball.position.x, z: ball.position.z }, 3)); } });
  let loose = null; // a live fumble: { from, by, t, bobbles, rec }
  let lastFumble = null;
  const lastVel = new THREE.Vector3(0, 0, -8);
  const handV = new THREE.Vector3();
  /** Where someone's right hand is (so the ball sits in it). */
  const handPos = (e, out = handV) => {
    const hnd = e.mesh.userData.rig?.armR?.hand;
    if (hnd) { hnd.getWorldPosition(out); group.worldToLocal(out); if (out.y > 0.05) return out; }
    return out.set(e.pos.x + 0.25, 1.15, e.pos.z - 0.1);
  };
  let holder = null; // entity holding the ball
  let flight = null; // { from, to, T, t0, H, target, reason }
  // who the ball went to and why it fell incomplete, so every role is graded on its own job
  let pass = null; // { target, sepUser, cause: 'off'|'drop'|'contest'|'oob'|'hail', caughtBy }
  let carrier = null; // ball carrier once the ball is past the QB stage
  let thrown = false;
  let catchPress = null;
  let swatPress = null;
  let result = null;
  let scorer = null;
  let phase = 'pick';
  let t = 0;
  let fx = null;
  let moves = { juke: 0, jukeCd: 0, spin: 0, spinCd: 0, stiff: 0, stiffCd: 0, slow: 0, broken: 0, dive: 0 };
  const labels = [];
  const tellRings = new Map();
  let callForBall = false;

  // ---------------- routes (re-run after an audible or a hot route)
  const assignRoutes = () => {
    // routes for receivers
    const routeFor = (slot) => {
      if (mode === 'route' && slot === 'Z') return play.route;
      if (play.routes?.[slot]) return play.routes[slot];
      // run plays / defense: generic concept
      const oc = opts.scout && m.defense ? (Math.random() < opts.scout.deep ? 'risky' : Math.random() < 0.5 ? 'balanced' : 'safe') : call; // their offense's habits
      const concept = PLAYS.pass[oc][Math.floor(Math.random() * 3)];
      return concept.routes[slot];
    };
    // near the end zone the routes are fitted to the room you have (break points scale with them), so receivers
    // finish inside the end zone instead of piling up against the end line
    const room = m.yardLine + 8.6;
    for (const r of receivers) {
      const pts = routeFor(r.slot);
      if (!pts) continue;
      const deepest = Math.max(1, ...pts.map(([, z]) => -z));
      const k = deepest > room && !play.hail ? room / deepest : 1;
      r.route = [{ x: r.pos.x, z: r.pos.z }, ...pts.map(([dx, dz2]) => clampPos({ x: r.pos.x + dx * (k < 1 ? 0.6 + 0.4 * k : 1), z: dz2 * k }))];
      r.sit = mode === 'route' && r.slot === 'Z' ? !!play.sit : false;
    }
    if (play.screen !== undefined) { rb.route = null; }
  };

  const buildFormation = () => {
    // backed up against your own goal line: no shotgun from inside your own end zone
    const ownGoal = 100 - m.yardLine; // z of your own goal line (behind the line of scrimmage)
    let formName = play.form ?? 'shotgun';
    if (ownGoal < 3 && !play.hail) formName = 'under';
    else if (ownGoal < 6.5 && formName === 'shotgun') formName = 'pistol';
    const F = OFF_FORMATION[formName];
    const ox = (x) => x;
    // offense
    OL_X.forEach((x) => blockers.push(add('off', 'OL', 'OL', x, 0.8)));
    qb = add('off', 'QB', 'QB', F.QB[0], F.QB[1], { user: userRole === 'QB' && !m.defense });
    rb = add('off', 'RB', 'RB', F.RB[0], F.RB[1], { user: userRole === 'RB' && !m.defense });
    const X = add('off', 'WR', 'X', F.X[0], F.X[1]);
    const Z = add('off', 'WR', 'Z', ox(F.Z[0]), F.Z[1], { user: userRole === 'WR' && !m.defense });
    const S = add('off', 'WR', 'S', F.S[0], F.S[1]);
    const TE = add('off', 'TE', 'TE', F.TE[0], F.TE[1]);
    receivers = [X, S, Z, TE, rb];
    // defense
    const press = play.press || (mode !== 'cover' && call === 'risky');
    const cushion = press ? 1.4 : call === 'safe' ? 7 : 5;
    const dz = (z) => Math.max(backLine + 1, z);
    const dl = [-2.6, -0.9, 0.9, 2.6].map((x, i) => add('def', 'DL', 'DL', x, -1.1, { user: dtMode && i === 2 }));
    const lbs = [-3.2, 3.2].map((x) => add('def', 'LB', 'LB', x, dz(-5.5)));
    const cbX = add('def', 'CB', 'CBX', X.pos.x + 0.8, dz(-cushion));
    const cbZ = add('def', 'CB', 'CBZ', Z.pos.x - 0.8, dz(-cushion), { user: m.defense && !dtMode });
    const nb = add('def', 'CB', 'NB', S.pos.x + 0.6, dz(-4.5));
    const ss = add('def', 'S', 'SS', -7, dz(-13));
    const fs = add('def', 'S', 'FS', 7, dz(-15));
    defenders = [...dl, ...lbs, cbX, cbZ, nb, ss, fs];
    // assignments
    cbX.man = X; cbZ.man = Z; nb.man = S; lbs[1].man = TE; lbs[0].man = rb; ss.man = null; fs.man = null;
    const scout = opts.scout ?? null; // the opponent's real tendencies (scouting.js)
    const zone = mode === 'cover' ? play.coverage === 'zone' : scout && (mode === 'pass' || mode === 'route') ? Math.random() > scout.man : call === 'safe';
    for (const d of defenders) d.zone = zone;
    if (play.blitz) { lbs.forEach((l) => { l.blitz = true; }); if (mode === 'cover' && play.user === 'blitz') cbZ.blitz = true; }
    if (play.twoDeep || zone) { ss.deep = -1; fs.deep = 1; } else { fs.deep = 0; ss.robber = true; }
    // When you're the QB the defense mixes in pressure: a linebacker (sometimes the nickel too) blitzes, or a
    // linebacker spies you and comes the moment you leave the pocket.
    if (mode === 'pass' && userRole === 'QB' && !m.defense && !play.hail) {
      const r = Math.random();
      const blitzP = scout ? scout.blitz * (call === 'risky' ? 1.25 : call === 'safe' ? 0.8 : 1) : call === 'risky' ? 0.34 : call === 'safe' ? 0.18 : 0.26;
      if (r < blitzP) { lbs[1].blitz = true; lbs[1].man = null; if (Math.random() < 0.35) { nb.blitz = true; nb.man = null; } }
      else if (r < blitzP + 0.42) { lbs[0].spy = true; lbs[0].man = null; }
    }
    if (mode === 'route' && !m.defense && scout && Math.random() < scout.blitz * 0.8) { lbs[1].blitz = true; lbs[1].man = null; }
    if (mode === 'runD') cbZ.zone = false;
    user = ents.find((e) => e.user);
    // run defense: the receiver across from you comes to block you (a stalk/crack block) instead of running a route
    if (mode === 'runD' && user.man && Math.random() < (call === 'risky' ? 0.55 : 0.8)) { user.man.stalk = true; user.man.blockTarget = user; }
    // ...and the playside guard pulls and leads the sweep, looking for you
    if (mode === 'runD') { const g = blockers.filter((b) => b.role === 'OL').sort((a, b) => b.start.x - a.start.x)[1]; if (g) g.pullAt = 0.25; }
    if (globalThis.__playDebug) globalThis.__play = { receivers, defenders, time: () => t, phase: () => phase, user, qb: () => qb, carrier: () => carrier,
      flight: () => (flight ? { f: (t - flight.t0) / flight.T, to: flight.to, toUser: flight.target === user, endY: flight.endY } : null),
      throwTo: (i) => throwTo(receivers[i]), cine: (fn, s) => ctx.cinematic?.(fn, s), slow: (k) => ctx.setTimeScale?.(k), holder: () => holder };
    assignRoutes();
    // stances
    for (const e of ents) if (e.role !== 'QB' && e.role !== 'S' && e.role !== 'CB' && e.role !== 'LB') setPose(e.mesh, 'stance');
    holder = qb;
    if (play.qbRun) qb.runner = true;
  };

  // ---------------- HUD: playbook picker
  // crowd: the home crowd is the loud one. homeGood(userGood) -> was this good for the home team?
  const userHome = opts.userHome !== false;
  const crowd = (kind, userGood) => react(kind, userGood === userHome);
  const showPicker = () => {
    phase = 'pick';
    playMusic(opts.song ?? ['hype', 'charge', 'groove'][Math.floor(Math.random() * 3)], { vol: 0.75 });
    hud.instr(`${sit.tag} · ${m.defense ? 'Pick a defensive call' : 'Pick a play'}`);
    const box = document.createElement('div');
    box.className = 'fc-plays';
    plays.forEach((pl, i) => {
      const b = document.createElement('button');
      b.className = 'fc-play';
      const svg = opts.routeArt === 'off' ? '' : playArtSVG(mode, pl, { call, userRole, defense: !!m.defense, type });
      b.innerHTML = `<span class="k">${i + 1}</span>${svg}<b>${pl.name}</b><small>${pl.desc}</small>`;
      b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); choose(i); });
      box.append(b);
    });
    hud.el.append(box);
    ctx.pickerEl = box;
    if (plays.length === 1) setTimeout(() => choose(0), 400);
  };
  const choose = (i) => {
    if (phase !== 'pick') return;
    play = plays[Math.max(0, Math.min(plays.length - 1, i))];
    // Run defense: the offense runs a toss toward your side of the field.
    if (mode === 'runD') play = { ...play, form: 'pistol', pitch: true, hole: [8, 10], press: call === 'risky' };
    // Run stop: the offense runs between the tackles.
    if (mode === 'runStop') { const hx = (Math.random() - 0.5) * 4.8; play = { ...play, form: 'pistol', pitch: false, hole: [hx, hx] }; }
    ctx.pickerEl?.remove();
    sfx.select();
    buildFormation();
    preSnapVisuals();
    phase = 'pre';
    t = 0;
    // size matchup with the guy across from you
    const foe = dtMode ? nearest(user, blockers) : mode === 'cover' || mode === 'runD' ? user.man : mode === 'route' ? defenders.find((d) => d.man === user) : null;
    const sz = (e) => `${Math.floor(e.hIn / 12)}'${e.hIn % 12}" ${e.wLb}`;
    tellTxt = showTells();
    const readTxt = (readIdx >= 0 ? ` · 1st read: #${readIdx + 1}` : '') + tellTxt;
    hud.instr((foe ? `${play.name} · you ${sz(user)} vs ${sz(foe)} lb` : play.name) + readTxt + (m.defense ? ' · get set…' : ' · press SNAP when ready'));
    if (gameSecs !== null) hud.clock?.(clockText());
    snapCalled = false;
    preStart = performance.now();
    if (m.defense && userHome) react('defense');
    setButtonsFor();
  };

  // game clock (from the situation) runs while the ball is live; it stops on incompletions and out of bounds
  const clk = (() => { const mm = /^(\d+):(\d+)/.exec(m.clock ?? ''); return mm ? Number(mm[1]) * 60 + Number(mm[2]) : null; })();
  let gameSecs = clk;
  let clockStopped = false;
  const clockText = () => `Q${m.quarter ?? 1} ${Math.floor(gameSecs / 60)}:${String(Math.max(0, Math.floor(gameSecs % 60))).padStart(2, '0')}`;
  let snapCalled = false;
  let preStart = 0;
  let clockShown = -1;
  const PLAY_CLOCK = 20;
  let holeArrow = null;
  // ---------------- play art: what you're supposed to do, drawn on the turf before the snap.
  // opts.routeArt: 'play' (default: before the snap, then faint during the play) | 'pre' (before the snap only) | 'off'
  const ART = opts.routeArt ?? 'play';
  const art = []; // { o, after: opacity factor after the snap (0 = hide), untilThrow }
  const addArt = (o, after = 0, untilThrow = false) => { group.add(o); art.push({ o, after, untilThrow }); return o; };
  const ROUTE_COLS = ['#ffd43b', '#60a5fa', '#f472b6', '#4ade80', '#fb923c'];
  let readIdx = -1;
  /** QB progression: the first read depends on the call (safe = shortest, risky = deepest, balanced = closest to 10). */
  const firstRead = () => {
    const depth = (r) => (r.route ? Math.max(...r.route.map((p) => r.start.z - p.z)) : -99);
    const cands = receivers.map((r, i) => ({ r, i, d: depth(r) })).filter((c) => c.r.route && c.r !== rb);
    if (!cands.length) return -1;
    const score = (c) => (call === 'safe' ? -c.d : call === 'risky' ? c.d : -Math.abs(c.d - 10));
    return cands.sort((a, b) => score(b) - score(a))[0].i;
  };
  const artSide = (x) => Math.sign(x) || 1;
  const preSnapVisuals = () => {
    if (ART !== 'off') {
      const Z = (x, z) => ({ x, z });
      if (mode === 'pass') {
        readIdx = play.hail ? -1 : firstRead();
        receivers.forEach((r, i) => {
          if (r.route) addArt(makeRouteRibbon(r.route.map((p) => Z(p.x, p.z)), ROUTE_COLS[i], { width: i === readIdx ? 0.5 : 0.34, opacity: 0.92 }), 0.38, true);
          else if (r === rb && play.screen === undefined) addArt(makeRouteRibbon([Z(rb.pos.x, rb.pos.z), Z(rb.pos.x * 0.4, 2.6)], '#cbd5e1', { width: 0.26, opacity: 0.7, end: 'block' }), 0);
        });
        if (play.screen !== undefined) addArt(makeRouteRibbon([Z(rb.pos.x, rb.pos.z), Z(play.screen * 7, 2.2), Z(play.screen * 8.5, -6)], ROUTE_COLS[4], { width: 0.42 }), 0.38, true);
        for (const o of blockers) addArt(makeRouteRibbon([Z(o.pos.x, o.pos.z + 0.4), Z(o.pos.x, o.pos.z + 1.7)], '#e2e8f0', { width: 0.2, opacity: 0.55, end: 'block' }), 0);
        if (play.qbRun) addArt(makeRouteRibbon([Z(qb.pos.x, qb.pos.z), Z(play.hole ? play.hole[0] : 2.5, 0), Z(play.hole ? play.hole[1] : 4, -7)], '#ffffff', { width: 0.4 }), 0.3);
      } else if (mode === 'route') {
        receivers.forEach((r) => {
          if (!r.route) return;
          if (r === user) addArt(makeRouteRibbon(r.route.map((p) => Z(p.x, p.z)), '#ffd43b', { width: 0.5, opacity: 0.95, end: r.sit ? 'dot' : 'arrow' }), 0.35);
          else addArt(makeRouteRibbon(r.route.map((p) => Z(p.x, p.z)), '#e2e8f0', { width: 0.22, opacity: 0.4 }), 0);
        });
      } else if (mode === 'run') {
        const h0 = play.hole?.[0] ?? 0, h1 = play.hole?.[1] ?? h0;
        let path;
        if (user === qb) path = [Z(qb.pos.x, qb.pos.z), Z(h0, 0), Z(h1, -7)];
        else if (play.screen !== undefined) path = [Z(rb.pos.x, rb.pos.z), Z(play.screen * 7, 2.2), Z(play.screen * 8.5, -6)];
        else if (play.pitch) path = [Z(rb.pos.x, rb.pos.z), Z(h0 * 0.6, rb.start.z - 0.5), Z(h0, 0.2), Z(h1, -7)];
        else path = [Z(rb.pos.x, rb.pos.z), Z(qb.pos.x + 0.3 * artSide(h0), qb.pos.z - 0.6), Z(h0, -0.2), Z(h1, -7)];
        addArt(makeRouteRibbon(path, '#4ade80', { width: 0.5, opacity: 0.95 }), 0.3);
        if (play.screen === undefined) for (const o of blockers) {
          const dx = Math.max(-1.1, Math.min(1.1, (h0 - o.pos.x) * 0.35));
          addArt(makeRouteRibbon([Z(o.pos.x, o.pos.z), Z(o.pos.x + dx, -0.9)], '#e2e8f0', { width: 0.2, opacity: 0.55, end: 'block' }), 0);
        }
      } else if (mode === 'cover') {
        if (play.user === 'blitz') addArt(makeRouteRibbon([Z(user.pos.x, user.pos.z), Z(user.pos.x - 3.5, 0.6), Z(qb.pos.x + 0.6, qb.pos.z - 0.6)], '#f87171', { width: 0.46 }), 0);
        else if (play.user === 'deep') addArt(makeZoneArea(4.5 * artSide(user.pos.x), (FIELD_X - 0.3) * artSide(user.pos.x), -11, Math.max(-36, goalZ - 6), '#60a5fa', 0.2), 0.45);
        else if (play.user === 'flat') addArt(makeZoneArea(5.5 * artSide(user.pos.x), (FIELD_X - 0.3) * artSide(user.pos.x), -0.8, Math.max(-9, goalZ - 4), '#38bdf8', 0.24), 0.45);
        else if (user.man) {
          const tether = addArt(makeRouteRibbon([Z(user.pos.x, user.pos.z), Z(user.man.pos.x, user.man.pos.z - 0.2)], '#60a5fa', { width: 0.34, end: 'dot' }), 0);
          tether.userData.tether = true;
          const ring = makeRing('#60a5fa', 0.62, 0.9, 0.9); user.man.mesh.add(ring); art.push({ o: ring, after: 0, ring: true });
        }
      } else if (mode === 'runD') {
        const blitz = call === 'risky';
        addArt(makeRouteRibbon(blitz ? [Z(user.pos.x, user.pos.z), Z(user.pos.x - 1, -0.4), Z(7.5, 4)] : [Z(user.pos.x, user.pos.z), Z(user.pos.x + 0.5, -2), Z(10.5, -0.6), Z(8, 1.6)], '#f87171', { width: 0.44 }), 0);
      } else if (mode === 'rush') {
        const lane = rushLane(play.name);
        const via = lane === 'outside' ? Z(user.pos.x + 2.8, 1.6) : lane === 'loop' ? Z(user.pos.x - 2.6, 0.7) : lane === 'move' ? Z(user.pos.x + 0.9, 1.4) : Z(user.pos.x * 0.6, 1.8);
        addArt(makeRouteRibbon([Z(user.pos.x, user.pos.z), via, Z(qb.pos.x, qb.pos.z - 0.7)], '#f87171', { width: 0.44 }), 0);
      } else if (mode === 'runStop') {
        const gap = stopGap(play.name);
        const x = user.pos.x;
        const to = gap === 'slant' ? [Z(x + 1.7, 1.3)] : gap === 'pinch' ? [Z(x - 1.2, 1.1)] : gap === 'spill' ? [Z(x + 1.3, 0.9)] : gap === 'shoot' ? [Z(x, 1.2), Z(x + 0.3, 4)] : [Z(x, 0.5)];
        addArt(makeRouteRibbon([Z(x, user.pos.z), ...to], '#f87171', { width: 0.44, end: gap === 'anchor' ? 'block' : 'arrow' }), 0);
      }
    }
    if ((mode === 'run' && play.hole) || mode === 'runD') {
      const hx = mode === 'runD' ? 8 : (play.hole[0] + play.hole[1]) / 2;
      holeArrow = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2, 3), new THREE.MeshBasicMaterial({ color: mode === 'runD' || mode === 'runStop' ? '#f87171' : '#4ade80', transparent: true, opacity: 0.85 }));
      holeArrow.rotation.x = -Math.PI / 2;
      holeArrow.position.set(hx, 0.1, -1.6);
      group.add(holeArrow);
    }
    if (mode === 'pass') {
      receivers.forEach((r, i) => {
        const col = ART !== 'off' ? ROUTE_COLS[i] : '#ffd43b';
        const l = makeLabel(String(i + 1), { size: i === readIdx ? 1.05 : 0.85, color: col });
        l.position.set(0, 2.8, 0);
        r.mesh.add(l);
        r.label = l;
        labels.push(l);
        r.ring = makeRing(i === readIdx ? '#ffffff' : '#4ade80', 0.6, 0.85, 0.9);
        r.mesh.add(r.ring);
      });
    }
  };
  // ---------------- pre-snap reads: the defense shows its hand (always if you studied film, else your IQ might see it)
  let audibled = false;
  let audibleBox = null;
  const tellLabels = [];
  const showTells = () => {
    for (const l of tellLabels) l.parent?.remove(l);
    tellLabels.length = 0;
    if (m.defense || !(mode === 'pass' || mode === 'route' || mode === 'run')) return '';
    const scout = opts.scout;
    const sees = scout?.revealed || Math.random() < Math.max(0, ((st.iq ?? 60) - 45) / 110);
    if (!sees) return '';
    const blitzers = defenders.filter((d) => d.blitz);
    for (const d of blitzers) { const l = makeLabel('!', { color: '#f87171', size: 0.9 }); l.position.set(0, 2.9, 0); d.mesh.add(l); tellLabels.push(l); }
    const cov = defenders.find((d) => d.role === 'CB')?.zone ? 'zone' : 'man';
    return blitzers.length ? ` · BLITZ LOOK (${blitzers.length})${mode === 'pass' ? ': audible?' : ''}` : ` · they show ${cov}`;
  };
  let tellTxt = '';
  /** Change the play at the line. QB: a quick pass or a shot play. RB: flip the run or check to an inside run. WR: hot route. */
  const showAudible = () => {
    let opts2 = [];
    if (mode === 'pass') {
      const quick = dealPlays('pass', 'safe', m, 5).find((p) => p.name !== play.name);
      const shot = dealPlays('pass', 'risky', m, 5).find((p) => p.name !== play.name);
      opts2 = [quick && { label: `Quick: ${quick.name}`, desc: 'Ball out fast. Beats the blitz.', apply: () => quick }, shot && { label: `Shot: ${shot.name}`, desc: 'Take a shot. Best against no blitz.', apply: () => shot }].filter(Boolean);
    } else if (mode === 'run') {
      const inside = dealPlays('run', 'safe', m, 5).find((p) => p.name !== play.name && !p.pitch);
      opts2 = [{ label: 'Flip it', desc: 'Same play to the other side.', apply: () => ({ ...play, name: `${play.name} (flipped)`, hole: play.hole.map((x) => -x) }) },
        inside && { label: `Check to ${inside.name}`, desc: 'Safer inside run.', apply: () => inside }].filter(Boolean);
    } else if (mode === 'route') {
      const HOT = [['Slant', [[0, -3], [-6, -9]]], ['Go', [[0, -40]]], ['Quick Out', [[0, -5], [6, -5]]], ['Curl', [[0, -10], [-1, -8]], true]];
      opts2 = HOT.map(([n, r, sit]) => ({ label: n, desc: n === 'Go' ? 'Beat press man deep.' : n === 'Slant' ? 'Hot vs the blitz.' : n === 'Curl' ? 'Sit in the zone hole.' : 'Quick to the sideline.', apply: () => ({ ...play, name: n, route: r, sit: !!sit }) }));
    }
    const box = document.createElement('div');
    box.className = 'fc-plays audible-box';
    const pick = (i) => {
      const o = opts2[i];
      if (!o) return;
      box.remove(); audibleBox = null; audibled = true;
      const np = o.apply();
      play = mode === 'run' ? { ...np, form: play.form, pitch: !!np.pitch } : { ...np, form: play.form };
      assignRoutes();
      // redraw the play art for the new call
      for (const a of art) a.o.parent?.remove(a.o);
      art.length = 0;
      for (const l of labels) l.parent?.remove(l);
      labels.length = 0;
      for (const r of receivers) if (r.ring) { r.ring.parent?.remove(r.ring); r.ring = null; }
      if (holeArrow) { group.remove(holeArrow); holeArrow = null; }
      preSnapVisuals();
      sfx.select();
      hud.big(mode === 'route' ? 'HOT ROUTE!' : 'AUDIBLE!', '#ffd43b', 700);
      hud.instr(`${mode === 'route' ? 'Hot route' : 'Audible'}: ${play.name}${tellTxt} · press SNAP`);
      setButtonsFor();
    };
    opts2.forEach((o, i) => {
      const b = document.createElement('button');
      b.className = 'fc-play';
      b.innerHTML = `<span class="k">${i + 1}</span><b>${o.label}</b><small>${o.desc}</small>`;
      b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); pick(i); });
      box.append(b);
    });
    const cancel = document.createElement('button');
    cancel.className = 'fc-play ghost';
    cancel.innerHTML = '<b>Keep the call</b>';
    cancel.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); box.remove(); audibleBox = null; });
    box.append(cancel);
    box.pick = pick;
    hud.el.append(box);
    audibleBox = box;
    sfx.click();
  };
  /** Snap: play art fades to its "during the play" level (or goes away). */
  const artAtSnap = () => {
    for (const a of art) {
      const k = ART === 'play' ? a.after : 0;
      if (a.ring) { a.o.visible = k > 0; continue; }
      a.o.userData.setOpacity?.(k);
    }
  };
  const artOnThrow = () => { for (const a of art) if (a.untilThrow) a.o.userData.setOpacity?.(0); };

  // ---------------- controls
  const btn = {
    sprint: { id: 'sprint', label: 'SPRINT', key: 'Shift', hold: true },
    juke: { id: 'juke', label: 'JUKE', key: 'J' },
    spin: { id: 'spin', label: 'SPIN', key: 'K' },
    stiff: { id: 'stiff', label: 'STIFF ARM', key: 'L' },
    dive: { id: 'dive', label: 'DIVE', key: 'F' },
    catch: { id: 'catch', label: 'CATCH', key: 'Space', big: true, tint: 'gold' },
    call: { id: 'call', label: 'CALL FOR IT', key: 'C' },
    swat: { id: 'swat', label: 'SWAT / PICK', key: 'Space', big: true, tint: 'gold' },
    tackle: { id: 'tackle', label: 'TACKLE', key: 'F', big: true, tint: 'red' },
    pass: { id: 'passhint', label: 'TAP A RECEIVER', key: '1-5' },
    rip: { id: 'rip', label: 'RIP', key: 'J', tint: 'gold' },
    swim: { id: 'swim', label: 'SWIM', key: 'K', tint: 'gold' },
    bull: { id: 'bull', label: 'BULL RUSH', key: 'L', big: true, tint: 'red' },
    sack: { id: 'tackle', label: 'SACK / TACKLE', key: 'F', big: true, tint: 'red' },
    bat: { id: 'swat', label: 'BAT IT', key: 'Space' },
    snap: { id: 'snap', label: 'SNAP', key: 'Space', big: true, tint: 'gold' },
    audible: { id: 'audible', label: 'AUDIBLE', key: 'Q' },
    hot: { id: 'audible', label: 'HOT ROUTE', key: 'Q' },
  };
  // pass-rush battle state: leverage builds while you drive into the blocker
  const rush = { lev: 0, cd: 0, stun: 0, burst: 0 };
  let levBar = null;
  const showLev = (on) => {
    if (on && !levBar) {
      levBar = document.createElement('div');
      levBar.className = 'lev-meter';
      levBar.innerHTML = '<span>LEVERAGE</span><div class="watch-bar"><i></i></div>';
      hud.el.append(levBar);
    }
    if (levBar) levBar.style.display = on ? '' : 'none';
  };
  let btnMode = '';
  const setButtonsFor = () => {
    let mode2;
    if (phase === 'pick') mode2 = 'none';
    else if (phase === 'pre') mode2 = m.defense ? 'none' : 'pre';
    else if (user === carrier) mode2 = 'runner';
    else if (user.role === 'QB' && holder === user && !user.runner) mode2 = 'qb';
    else if (user.team === 'off') mode2 = flight && flight.target === user ? 'catch' : 'route';
    else if (user.role === 'DL') mode2 = user.engagedBy ? 'dlBlocked' : 'dlFree';
    else if (user.engagedBy) mode2 = 'cbBlocked';
    else mode2 = 'def';
    if (mode2 === btnMode) return;
    btnMode = mode2;
    const sets = {
      none: [],
      pre: !audibled && mode === 'pass' && !play.hail ? [btn.audible, btn.snap] : !audibled && mode === 'route' ? [btn.hot, btn.snap] : !audibled && mode === 'run' && play.screen === undefined && !play.qbRun ? [btn.audible, btn.snap] : [btn.snap],
      runner: [btn.sprint, btn.juke, btn.spin, btn.stiff, btn.dive],
      qb: [btn.sprint, btn.pass],
      route: [btn.sprint, btn.call, btn.catch],
      catch: [btn.sprint, btn.catch],
      def: [btn.sprint, btn.swat, btn.tackle],
      dlBlocked: [btn.rip, btn.swim, btn.bull],
      cbBlocked: [btn.tackle],
      dlFree: [btn.sprint, btn.bat, btn.sack],
    };
    showLev(mode2 === 'dlBlocked' || mode2 === 'cbBlocked');
    if (mode2 === 'cbBlocked') hud.instr?.('BLOCKED! Push through him, or tap TACKLE to shed');
    else if (btnMode === 'def' && mode === 'runD') hud.instr?.('');
    controls.setButtons(sets[mode2]);
  };

  const controls = makeControls(ctx, {
    onPress: (id) => {
      if (qteActive) return;
      if (phase === 'pick' && /^key[1-5]$/.test(id)) return choose(Number(id.slice(3)) - 1);
      if (id === 'snap' && phase === 'pre' && !m.defense && t > 0.35) { snapCalled = true; return; }
      if (id === 'audible' && phase === 'pre' && !m.defense && !audibled && !audibleBox) { showAudible(); return; }
      if (audibleBox && /^key[1-4]$/.test(id)) { audibleBox.pick?.(Number(id.slice(3)) - 1); return; }
      if (phase !== 'live') return;
      if (/^key[1-5]$/.test(id) && user.role === 'QB' && holder === user && !user.runner) return throwTo(receivers[Number(id.slice(3)) - 1]);
      if (id === 'juke' && user === carrier && moves.jukeCd <= 0) {
        const dir = controls.state.x !== 0 ? Math.sign(controls.state.x) : (Math.random() < 0.5 ? -1 : 1);
        moves.juke = (0.24 + st.skill / 100 * 0.16) * tol * (has('ankles') || (has('escape') && user === qb) ? 1.4 : 1); moves.jukeCd = 0.8; moves.jukeDir = dir;
        playAction(user.mesh, 'juke', { dir });
        sfx.juke();
        if (Math.random() < surf.slip * 1.5) { moves.slow = 0.6; playAction(user.mesh, 'slip', { dir: -dir }); hud.big('SLIPPED!', '#fbbf24', 600); }
      }
      if (id === 'spin' && user === carrier && moves.spinCd <= 0) { moves.spin = 0.42 * Math.sqrt(tol) * (has('ankles') ? 1.4 : 1); moves.spinCd = 1.3; playAction(user.mesh, 'spin'); sfx.juke(); }
      if (id === 'stiff' && user === carrier && moves.stiffCd <= 0) { moves.stiff = 0.6; moves.stiffCd = 1.1; playAction(user.mesh, 'stiff'); }
      if (id === 'dive' && user === carrier && !moves.dive) { moves.dive = 0.01; playAction(user.mesh, 'dive'); }
      // pass-rush moves: win the battle with the blocker
      if ((id === 'rip' || id === 'swim' || id === 'bull') && user.engagedBy && rush.cd <= 0 && rush.stun <= 0) {
        const o = user.engagedBy;
        const stat = id === 'bull' ? (st.strength ?? 60) : id === 'swim' ? (st.skill ?? 60) : ((st.skill ?? 60) + (st.speed ?? 60)) / 2;
        const massK = id === 'bull' ? Math.max(0.7, Math.min(1.4, user.mass / o.mass)) : Math.max(0.8, Math.min(1.25, o.mass / user.mass));
        const traitK = id === 'bull' ? (has('bulldozer') ? 1.2 : 1) : (has('swimclub') ? 1.2 : 1);
        const pWin = (0.18 + (play.win ?? 0) + rush.lev * 0.55 + (stat - 50) / 220) * (0.75 + tol * 0.25) * (call === 'risky' ? 0.9 : 1) * massK * traitK * (1 - oppK * 0.1);
        rush.cd = 0.7;
        playAction(user.mesh, id === 'bull' ? 'stiff' : id === 'swim' ? 'throw' : 'juke', { dir: Math.random() < 0.5 ? 1 : -1 });
        sfx.hit();
        if (Math.random() < pWin) {
          o.engaged = null; user.engagedBy = null; setPose(o.mesh, null); setPose(user.mesh, null);
          o.out = id === 'bull' ? 1.4 : 0.6;
          if (id === 'bull') { flatten(o, user, 0.8); hud.big('PANCAKE!', '#ff6b6b', 800); ctx.shake(0.35); } else { knockDown(o.mesh, 1); hud.big(id === 'rip' ? 'RIP!' : 'SWIM!', '#4ade80', 700); }
          rush.burst = 0.7; rush.lev = 0;
          sfx.cheer();
        } else {
          rush.lev *= 0.4; rush.stun = 0.35;
          hud.big('STONEWALLED', '#94a3b8', 500);
        }
        setButtonsFor();
        return;
      }
      if (id === 'call' && user.team === 'off') { callForBall = true; hud.big('OPEN!', '#60a5fa', 500); }
      if (id === 'swat' && user.role === 'DL' && flight && !flight.pitch && t - flight.t0 < (has('batter') ? 0.45 : 0.3) && dist(user.pos, qb.pos) < (has('batter') ? 4.2 : 3.2)) {
        playAction(user.mesh, 'jump');
        if (Math.random() < 0.55 + (st.skill ?? 60) / 300 + (has('batter') ? 0.2 : 0)) { flight = null; bphys.launch(ball.position.clone(), new THREE.Vector3((Math.random() - 0.5) * 4, 4 + Math.random() * 2, 2 + Math.random() * 2)); hud.big('BATTED DOWN!', '#4ade80', 900); sfx.hit(); whistle('pd'); return; }
      }
      if ((id === 'catch' || id === 'swat') && flight && catchPress === null && swatPress === null) {
        if (user.team === 'off') catchPress = t; else swatPress = t;
        if (flight && !flight.jumped?.has(user)) { flight.jumped?.add(user); playAction(user.mesh, (flight.endY ?? 1.3) >= 1.9 || flight.H > 4 ? 'jump' : 'catch'); }
        sfx.click();
      }
      if (id === 'tackle' && user.team === 'def' && user.engagedBy && user.role === 'CB') {
        // fighting off a block: a swipe at his hands (stronger corners win it more), then you have to recover
        if (!(rush.cd > 0)) {
          rush.cd = 0.6;
          rush.cd = 0.9;
          if (Math.random() < 0.18 + (play.win ?? 0) + (st.strength ?? 60) / 400 + rush.lev * 0.25) rush.lev = 1;
          else { rush.lev = Math.max(0, rush.lev - 0.25); rush.stun = 0.5; hud.big('STILL BLOCKED', '#fbbf24', 450); }
          playAction(user.mesh, 'stiff', { dur: 0.3 });
        }
        return;
      }
      if (id === 'tackle' && user.team === 'def' && user.lunge <= 0 && user.out <= 0 && !(user.rise > 0)) {
        user.lunge = 0.38; user.lungeDir = carrier ? norm(carrier.pos.x - user.pos.x, carrier.pos.z - user.pos.z) : norm(controls.state.x, controls.state.z || 1);
        playAction(user.mesh, 'tackle');
      }
    },
    onTap: (x, y, ev) => {
      if (phase === 'pick') return;
      if (phase !== 'live' || user.role !== 'QB' || holder !== user || user.runner) return;
      const p = ctx.groundPoint(ev);
      if (!p) return;
      let best = null;
      let bd = 4.5;
      for (const r of receivers) { const d = dist(r.pos, p); if (d < bd) { bd = d; best = r; } }
      if (best) throwTo(best);
    },
  });

  const norm = (x, z) => { const l = Math.hypot(x, z) || 1; return { x: x / l, z: z / l }; };

  // ---------------- throwing
  const throwTo = (r) => {
    say('throw');
    if (!r || thrown || holder !== qb) return;
    thrown = true;
    const qbP = qb.pos;
    const pressure = Math.min(...defenders.filter((d) => !d.engaged).map((d) => dist(d.pos, qbP)));
    const moving = Math.hypot(qb.vel.x, qb.vel.z);
    const v = (17 + (st.strength ?? 60) * 0.08) * (user === qb && has('gunslinger') ? 1.12 : 1);
    // lead the receiver: iterate the intercept time
    let T = dist(qbP, r.pos) / v;
    let lead = { ...r.pos };
    if (r.user && mode === 'route' && r.route && !callForBall) {
      // throw to where YOUR ROUTE will be (run it right and the ball is there; call for it to change that)
      // how far along the route you are (closest point on the route), and how fast you're moving
      let total = 0;
      let best = { d: 1e9, s: 0 };
      for (let i = 1; i < r.route.length; i++) {
        const a = r.route[i - 1];
        const b = r.route[i];
        const len = Math.hypot(b.x - a.x, b.z - a.z) || 0.001;
        const k = Math.max(0, Math.min(1, ((r.pos.x - a.x) * (b.x - a.x) + (r.pos.z - a.z) * (b.z - a.z)) / (len * len)));
        const d = Math.hypot(a.x + (b.x - a.x) * k - r.pos.x, a.z + (b.z - a.z) * k - r.pos.z);
        if (d < best.d) best = { d, s: total + k * len };
        total += len;
      }
      const spd = Math.max(5, Math.min(9.5, Math.hypot(r.vel.x, r.vel.z)));
      for (let i = 0; i < 3; i++) { lead = routePoint(r, Math.min(total, best.s + (r.sit && best.s >= total - 0.5 ? 0 : spd * T))); T = Math.max(0.35, dist(qbP, lead) / v); }
    } else {
      for (let i = 0; i < 3; i++) { lead = { x: r.pos.x + r.vel.x * T, z: r.pos.z + r.vel.z * T }; T = Math.max(0.35, dist(qbP, lead) / v); }
    }
    const isUserQB = user === qb;
    const sd = isUserQB ? ((1.35 - (st.skill ?? 60) * 0.009) / tol) * (pressure < 2.5 ? (has('pocket') ? 1.25 : 1.6) : 1) * (moving > 3 ? 1.3 : 1) * (has('dimes') ? 0.75 : 1) : 0.7;
    const to = clampPos({ x: lead.x + gaussR() * sd * 0.7 + wfx.wind.x * T * 0.45, z: lead.z + gaussR() * sd + wfx.wind.z * T * 0.45 });
    if (play.hail) to.z = Math.min(to.z, goalZ - 1);
    const H = Math.max(1.4, dist(qbP, to) * (play.hail ? 0.3 : 0.12));
    // where the ball arrives: chest high most of the time, up high on jump balls and into tight coverage (go up and
    // get it), sometimes low (scoop it)
    const tight = defenders.some((d) => !d.down && d.role !== 'DL' && dist(d.pos, to) < 2);
    const rh = Math.random();
    const endY = play.jump || play.hail ? 2.45 + Math.random() * 0.25 : tight && rh < 0.55 ? 2.15 + Math.random() * 0.35 : rh < 0.16 ? 1.95 + Math.random() * 0.3 : rh > 0.9 ? 0.6 + Math.random() * 0.25 : 1.2 + Math.random() * 0.3;
    flight = { endY: globalThis.__endY ?? endY, jumped: new Set(), from: { x: qbP.x + 0.3, z: qbP.z - 0.2 }, to, T: Math.max(0.4, dist(qbP, to) / v), t0: t, H, target: r, wobble: Math.random() < (user === qb ? 0.06 + Math.max(0, 70 - (st.skill ?? 60)) / 200 : 0.08) ? 0.22 : 0.025 };
    { const ds = defenders.filter((d) => !d.down && d.role !== 'DL'); const sepOf = (e) => (ds.length ? Math.min(...ds.map((d) => dist(d.pos, e.pos))) : 9); pass = { target: r, sepUser: user === qb ? null : sepOf(user), cause: null, caughtBy: null }; }
    holder = null;
    playAction(qb.mesh, 'throw');
    sfx.throw();
    labels.forEach((l) => { l.visible = false; });
    receivers.forEach((x) => { if (x.ring) x.ring.visible = false; });
    artOnThrow();
    hud.instr('');
  };

  // ---------------- movement helpers
  /**
   * On the ground after a whiff, a juke or a broken tackle: lie there (e.out), then a real get-up (e.rise, the
   * getup animation) before running again, and a couple of strides to get back to full speed (e.ramp).
   */
  const stillDown = (e, dt) => {
    if (e.out > 0) {
      e.out -= dt; e.vel.x *= 0.85; e.vel.z *= 0.85;
      if (e.out <= 0) { if (isDown(e.mesh)) { knockDown(e.mesh, 0); e.rise = 0.7; } e.ramp = 0.6; }
      return true;
    }
    if (e.rise > 0) { e.rise -= dt; e.vel.x *= 0.7; e.vel.z *= 0.7; return true; }
    if (e.ramp > 0) e.ramp -= dt;
    return false;
  };
  const moveToward = (e, tx, tz, speed, dt, accel = 14) => {
    if (e.ramp > 0) speed *= 1 - e.ramp * 0.9; // getting back up to speed
    const dx = tx - e.pos.x;
    const dz = tz - e.pos.z;
    const d = Math.hypot(dx, dz);
    let vx = 0;
    let vz = 0;
    if (d > 0.08) { const s = Math.min(speed, d * 4); vx = (dx / d) * s; vz = (dz / d) * s; }
    // traction: turf grips (quicker starts and cuts), mud / snow / slick ground don't
    e.vel.x += (vx - e.vel.x) * Math.min(1, accel * surf.grip * dt / Math.max(1, speed));
    e.vel.z += (vz - e.vel.z) * Math.min(1, accel * surf.grip * dt / Math.max(1, speed));
  };
  const routePoint = (e, s) => {
    const path = e.route;
    let acc = 0;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];
      const len = Math.hypot(b.x - a.x, b.z - a.z) || 0.001;
      if (acc + len >= s) { const f = (s - acc) / len; return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f }; }
      acc += len;
    }
    const a = path[path.length - 2];
    const b = path[path.length - 1];
    if (e.sit) return { ...b };
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 0.001;
    const over = s - acc;
    return clampPos({ x: b.x + ((b.x - a.x) / len) * over, z: b.z + ((b.z - a.z) / len) * over });
  };

  /**
   * Footing for one player this frame: a hard cut at speed on slick ground (wet turf, snow, mud) can slip (a stumble,
   * or a wipeout for anyone but the ball carrier); in mud or deep snow a player who plants to start or change direction
   * can get stuck for a moment, legs churning.
   */
  const footing = (e, dt) => {
    const sp = Math.hypot(e.vel.x, e.vel.z);
    const pvx = e.pvx ?? e.vel.x, pvz = e.pvz ?? e.vel.z;
    e.pvx = e.vel.x; e.pvz = e.vel.z;
    if (phase !== 'live' || e.down || e.out > 0 || e.engaged || e.engagedBy || e.wrap || e.lunge > 0) return;
    if (e.stuck > 0) {
      e.stuck -= dt;
      const cap = 1.3;
      if (sp > cap) { e.vel.x *= cap / sp; e.vel.z *= cap / sp; }
      return;
    }
    const pv = Math.hypot(pvx, pvz);
    if (surf.slip > 0 && sp > 4.5 && pv > 4.5) {
      const turn = Math.acos(Math.max(-1, Math.min(1, (e.vel.x * pvx + e.vel.z * pvz) / (sp * pv)))) / dt; // rad/s
      if (turn > 2.5 && Math.random() < surf.slip * dt * (turn / 3) * (e.user ? 1 : 0.6)) {
        const side = Math.sign(e.vel.x * pvz - e.vel.z * pvx) || 1;
        if (e !== carrier && !e.user && Math.random() < 0.3) { e.out = 1.1; knockDown(e.mesh, 1); } // feet go out from under him
        else { playAction(e.mesh, 'slip', { dir: side }); e.vel.x *= 0.45; e.vel.z *= 0.45; if (e.user) { moves.slow = 0.5; hud.big('SLIPPED!', '#fbbf24', 600); } else e.out = 0.35; }
        fxList.push(dustPuff(group, e.pos, 5));
        return;
      }
    }
    if (surf.sink > 0.05 && sp > 0.8 && sp < 4 && Math.random() < surf.sink * dt * 1.4 * (e.user ? 0.7 : 1)) {
      e.stuck = 0.45; playAction(e.mesh, 'stuck');
      fxList.push(dustPuff(group, e.pos, 6));
      if (e.user && !e.stuckSaid) { e.stuckSaid = true; hud.big(surf.debris === 'snow' ? 'BOGGED DOWN!' : 'STUCK IN THE MUD!', '#c08a4a', 700); }
    }
  };

  // ---------------- AI
  const nearest = (from, list) => { let best = null; let bd = Infinity; for (const e of list) { if (e.down || e.out > 0) continue; const d = dist(from.pos, e.pos); if (d < bd) { bd = d; best = e; } } return best; };
  /** Where a chaser running at `speed` meets the target (true intercept, capped at 2.5 s ahead). */
  const interceptPoint = (e, target, speed) => {
    const px = target.pos.x - e.pos.x, pz = target.pos.z - e.pos.z, vx = target.vel.x, vz = target.vel.z;
    const a = vx * vx + vz * vz - speed * speed, b = 2 * (px * vx + pz * vz), c = px * px + pz * pz;
    let T = null;
    if (Math.abs(a) < 1e-4) T = b < 0 ? -c / b : null;
    else { const disc = b * b - 4 * a * c; if (disc >= 0) { const r1 = (-b - Math.sqrt(disc)) / (2 * a), r2 = (-b + Math.sqrt(disc)) / (2 * a); T = [r1, r2].filter((x) => x > 0).sort((x, y) => x - y)[0] ?? null; } }
    if (T === null || T > 2.5) T = Math.min(2.5, Math.sqrt(c) / Math.max(1, speed));
    return { x: target.pos.x + vx * T, z: target.pos.z + vz * T };
  };
  const pursue = (e, target, dt, factor = 1) => {
    // Ball carrier (or a QB who has wandered far from his spot): take a real pursuit angle and keep leverage. A runner
    // who retreats behind the line or loops around gets chased at full speed: there's no free yardage going backwards.
    if (target.team === 'off' && !flight && (target === carrier || (target === holder && target.start && dist(target.pos, target.start) > 5))) {
      const retreating = target === carrier ? target.pos.z > 0.6 || target.vel.z > 1.5 : true;
      const sp = e.maxSpeed * (retreating ? Math.max(factor, 0.99) : factor);
      const aim = interceptPoint(e, target, sp);
      if (e.pos.z < target.pos.z - 0.5) aim.z = Math.min(aim.z, target.pos.z - 0.8); // stay between him and the end zone
      moveToward(e, aim.x, aim.z, sp, dt);
      return;
    }
    const d = dist(e.pos, target.pos);
    const lead = Math.min(0.7, d / Math.max(1, e.maxSpeed));
    moveToward(e, target.pos.x + target.vel.x * lead, target.pos.z + target.vel.z * lead, e.maxSpeed * factor, dt);
  };

  const aiOffense = (e, dt) => {
    if (stillDown(e, dt)) return;
    if (e.role === 'OL') {
      if (e.pullAt && t > e.pullAt && !e.engaged && !e.blockTarget) { e.blockTarget = user; e.pulling = true; }
      if (e.pulling && !e.engaged && e.blockTarget && e.blockTarget.engagedBy && e.blockTarget.engagedBy !== e) {
        // you're already tied up with the receiver: lead the way just in front of the runner and wait for you
        const r = carrier ?? rb;
        moveToward(e, (r.pos.x + user.pos.x) / 2, Math.min(r.pos.z - 1.2, (r.pos.z + user.pos.z) / 2), e.maxSpeed * 0.9, dt);
        return;
      }
      if (e.blockTarget && !e.engaged) {
        const d = e.blockTarget;
        moveToward(e, d.pos.x, d.pos.z + 0.7, e.maxSpeed, dt);
        if (dist(e.pos, d.pos) < 1.2 && !d.engagedBy) { e.engaged = d; d.engagedBy = e; d.shed = -0.2; setPose(e.mesh, 'block'); setPose(d.mesh, 'block'); }
        if (d.engagedBy && d.engagedBy !== e && !e.pulling) e.blockTarget = null;
        if (e.pulling && t > 3.2) { e.blockTarget = null; e.pulling = false; e.pullAt = 0; }
        return;
      }
      // Pick the nearest free rusher, step between it and the ball, lock up on contact.
      if (!e.engaged) {
        const passPro = mode === 'pass' || mode === 'route' || passD || (play.draw && t < 0.9) || play.screen !== undefined;
        const threats = defenders.filter((d) => (d.role === 'DL' || d.blitz) && !d.engagedBy && d.out <= 0);
        const tgt = nearest(e, threats);
        if (tgt && dist(e.pos, tgt.pos) < 1.3) { e.engaged = tgt; tgt.engagedBy = e; tgt.shed = 0; setPose(e.mesh, 'block'); setPose(tgt.mesh, 'block'); }
        else if (tgt) {
          const anchor = passPro ? qb.pos : { x: e.start.x, z: -3 };
          moveToward(e, (tgt.pos.x + anchor.x) / 2, Math.max(-2, (tgt.pos.z + anchor.z) / 2 + (passPro ? 1 : 0)), e.maxSpeed, dt);
        } else moveToward(e, e.pos.x, passPro ? 1.8 : -2, e.maxSpeed * 0.6, dt);
      } else {
        const d = e.engaged;
        const runPush = runO;
        // drive the defender away from the play
        const hx = play.hole ? (play.hole[0] + play.hole[1]) / 2 : 0;
        const away = runPush ? Math.sign(d.pos.x - hx || 1) * 0.6 : 0;
        // run: drive them off the ball. pass: fire out and punch for a second, then anchor and give ground slowly
        const zPush = runPush ? -0.3 : t < 1.1 ? -0.45 : t < 2.4 ? 0.05 : 0.3;
        moveToward(e, d.pos.x + away, d.pos.z + zPush, (runPush ? 1.6 : 1.9) * Math.max(0.7, Math.min(1.45, e.mass / d.mass)), dt);
        d.pos.x += e.vel.x * dt; d.pos.z += e.vel.z * dt;
        battle(e, d, dt);
      }
      return;
    }
    if (e === qb) {
      if (play.qbRun) { if (t > 0.35 && holder === qb && !carrier) { carrier = qb; qb.runner = true; } }
      else if (holder === qb) {
        // drop back, then throw (AI QB) or let the user decide
        const dropZ = runO ? qb.start.z : qb.start.z + 2.2;
        moveToward(e, e.start.x, dropZ, 4, dt);
        if (runO && t > 0.45 && !play.pitch && play.screen === undefined && !play.qbRun) { holder = rb; carrier = rb; sfx.catch(); }
        if (runO && play.pitch && t > 0.35 && !flight && !carrier) {
          flight = { from: { ...qb.pos }, to: { x: rb.pos.x + rb.vel.x * 0.4, z: rb.pos.z + rb.vel.z * 0.4 }, T: 0.4, t0: t, H: 0.6, target: rb, pitch: true };
          holder = null; playAction(qb.mesh, 'release');
        }
        if (play.screen !== undefined && t > 1.0 && !flight) throwTo(rb);
        if (!thrown && (mode === 'route' || passD)) aiQbRead();
      } else moveToward(e, e.pos.x, e.pos.z, 3, dt);
      return;
    }
    if (e === carrier) { aiCarrier(e, dt); return; }
    if (carrier && carrier.team === 'def') { pursue(e, carrier, dt, 0.95); return; }
    // receivers
    if (flight && flight.target === e) {
      const remain = Math.max(0.05, flight.T - (t - flight.t0));
      // get under it: arrive a beat early on high balls so there's time to go up
      moveToward(e, flight.to.x, flight.to.z, e.maxSpeed * 1.05, dt, 20);
      void remain;
      return;
    }
    if (carrier && carrier !== e && carrier.team === 'off') {
      // block for the ball carrier
      const d = nearest(carrier, defenders);
      if (d && dist(d.pos, carrier.pos) < 10) { moveToward(e, (d.pos.x + carrier.pos.x) / 2, (d.pos.z + carrier.pos.z) / 2, e.maxSpeed * 0.9, dt); if (dist(e.pos, d.pos) < 1.0 && !d.engagedBy && Math.random() < 0.02) { d.engagedBy = e; e.engaged = d; d.shed = 0; setPose(e.mesh, 'block'); } }
      return;
    }
    if (e === rb && runO && !carrier) {
      // move to the mesh point / hole
      const hx = play.hole ? play.hole[0] : 0;
      if (play.pitch) moveToward(e, hx * 0.6, rb.start.z - 0.5, e.maxSpeed * 0.8, dt);
      else moveToward(e, qb.pos.x + 0.3, qb.pos.z - 0.3, 6, dt);
      return;
    }
    if (play.screen !== undefined && e === rb) {
      const side = play.screen;
      moveToward(e, side * 7, 2.2, 5, dt);
      return;
    }
    if (e.route && !(mode === 'run' && e.role !== 'RB')) {
      if (e.stalk) { e.route = null; return aiOffense(e, dt); } // switched to blocking you
      // Route finished (or the QB is scrambling): stop running to the sideline and work to get open.
      e.routeLen ??= e.route.slice(1).reduce((a, b, i) => a + Math.hypot(b.x - e.route[i].x, b.z - e.route[i].z), 0);
      const scrambling = holder === qb && !flight && t > 1.2 && Math.abs(qb.vel.x) > 3 && Math.abs(qb.pos.x - qb.start.x) > 2.5;
      if (!e.improv && !flight && (e.s > e.routeLen + (e.sit ? e.maxSpeed * 1.1 : 0.4) || (scrambling && e.s > e.routeLen * 0.55))) e.improv = { at: 0, tx: e.pos.x, tz: e.pos.z, burst: 0 };
      if (e.improv) { improvise(e, dt); return; }
      // receivers throttle down to plant and cut at the breaks (that's when the defender is a step late)
      const ahead = routePoint(e, e.s + 1.6);
      const hx = ahead.x - e.pos.x, hz = ahead.z - e.pos.z, hl = Math.hypot(hx, hz) || 1, vl = Math.hypot(e.vel.x, e.vel.z);
      const turn = vl > 2 ? 1 - (e.vel.x * hx + e.vel.z * hz) / (vl * hl) : 0;
      const cut = turn > 0.35 ? (mode === 'pass' ? 0.8 : 0.82) : 1;
      e.s += e.maxSpeed * dt * Math.min(1, t / 0.4) * (e.jam > 0 ? 0.35 : 1) * cut;
      const p = routePoint(e, e.s);
      moveToward(e, p.x, p.z, e.maxSpeed * cut, dt, 22);
      return;
    }
    if (e.blockTarget && !e.engaged) {
      const d = e.blockTarget;
      moveToward(e, d.pos.x, d.pos.z + 0.6, e.maxSpeed, dt);
      if (dist(e.pos, d.pos) < 1.1 && !d.engagedBy) { e.engaged = d; d.engagedBy = e; d.shed = -0.2; setPose(e.mesh, 'block'); setPose(d.mesh, 'block'); }
      return;
    }
    if (e.engaged) { const d = e.engaged; moveToward(e, d.pos.x, d.pos.z - 0.3, 1.4, dt); d.pos.x += e.vel.x * dt; d.pos.z += e.vel.z * dt; return; }
    // run plays: receivers block downfield
    if (runO) {
      const d = nearest(e, defenders.filter((x) => x.role === 'CB' || x.role === 'S'));
      if (d) moveToward(e, d.pos.x, d.pos.z + 0.8, e.maxSpeed * 0.7, dt);
    }
  };

  /**
   * Getting open after the route: every ~0.6 s pick a nearby spot with the most room from the defenders (where they will be
   * a moment from now), spread out from the other receivers, stay in bounds and downfield of the line, don't drift too far
   * from the QB, and work toward the side he is scrambling to. A spot that opens real room gets a hard break.
   */
  const improvise = (e, dt) => {
    const I = e.improv;
    I.at -= dt;
    const def = defenders.filter((d) => d.out <= 0 && !d.down && d.role !== 'DL' && !d.engagedBy);
    const sepAt = (x, z) => Math.min(99, ...def.map((d) => Math.hypot(d.pos.x + d.vel.x * 0.45 - x, d.pos.z + d.vel.z * 0.45 - z)));
    if (I.at <= 0) {
      I.at = 0.5 + Math.random() * 0.4;
      const qp = qb.pos;
      const lim = FIELD_X - 2.2;
      const minZ = Math.max(backLine + 1.2, goalZ - 8.5); // inside the end zone at most
      const maxZ = Math.min(-1.5, goalZ < -2 ? -1.5 : goalZ); // downfield of the line
      const drift = holder === qb && Math.abs(qb.vel.x) > 2 ? Math.sign(qb.vel.x) : 0; // scramble drill
      const here = sepAt(e.pos.x, e.pos.z);
      // First job: get down the field and find open grass deep. Only when the ball still hasn't come out after a
      // while (or the QB is in trouble and scrambling) do they check back toward the quarterback.
      const checkBack = t > (e.checkT ??= 3.1 + Math.random() * 0.8) || (holder === qb && qb.pos.z < 3 && Math.abs(qb.vel.x) > 3 && t > 2.4);
      let best = null;
      for (let k = 0; k < 14; k++) {
        // deep phase: candidates fan out ahead (downfield is -z); check-back phase: all around, mostly back
        const a = checkBack ? (k / 14) * Math.PI * 2 + Math.random() * 0.3 : -Math.PI / 2 + ((k / 13) - 0.5) * Math.PI * 1.1;
        const rr = checkBack ? 2.5 + Math.random() * 4.5 : 3 + Math.random() * 5;
        const x = Math.max(-lim, Math.min(lim, e.pos.x + Math.cos(a) * rr));
        const z = Math.max(minZ, Math.min(checkBack ? Math.min(maxZ, -5) : maxZ, e.pos.z + Math.sin(a) * rr)); // check back to ~5-8 yds, not to the line
        let sc = Math.min(sepAt(x, z), 8);
        const qd = Math.hypot(x - qp.x, z - qp.z);
        if (!checkBack) { sc += (e.pos.z - z) * 0.35; sc -= Math.max(0, qd - 34) * 0.25; } // deeper is better, within a deep ball's range
        else { if (z < -8) sc += (z - e.pos.z) * 0.3; sc -= Math.max(0, qd - 16) * 0.3; } // come back to the QB, give him a short throw
        sc += drift * Math.sign(x - e.pos.x) * 0.6;
        if (Math.abs(x) > lim - 2.5) sc -= 1; // off the sideline, back toward the middle
        for (const o of receivers) if (o !== e && o.improv) { const dd = Math.hypot(o.pos.x - x, o.pos.z - z); if (dd < 5) sc -= (5 - dd) * 0.5; } // spread out
        if (!best || sc > best.sc) best = { x, z, sc };
      }
      I.tx = best.x; I.tz = best.z;
      I.burst = best.sc > here + 1 ? 0.5 : 0;
    }
    if (I.burst > 0) I.burst -= dt;
    moveToward(e, I.tx, I.tz, e.maxSpeed * (I.burst > 0 ? 1 : 0.82), dt, 18);
    if (Math.hypot(e.pos.x - I.tx, e.pos.z - I.tz) < 1 && holder === qb) faceToward(e.mesh, qb.pos.x, qb.pos.z); // settle, eyes on the QB
  };

  /** AI quarterback read (when you play WR or CB). Throws to the most open receiver, favoring the key player. */
  let readTime = rnd(1.6, 2.4);
  const aiQbRead = () => {
    if (t < 1.0) return;
    const key = mode === 'route' ? user : defenders.find((d) => d.user)?.man ?? receivers[2];
    const sepOf = (r) => Math.min(...defenders.map((d) => dist(d.pos, r.pos)));
    const keySep = sepOf(key);
    const sacked = defenders.some((d) => !d.engagedBy && dist(d.pos, qb.pos) < 1.3);
    if ((mode === 'route' && (callForBall && t > 1.3 || keySep > 2.2 && t > 1.5)) || t > readTime + 1.4 || (sacked && t > 1.2)) {
      // In coverage moments the QB mostly tests YOUR man; sometimes he goes elsewhere.
      let target = key;
      if (passD && Math.random() < 0.25) target = receivers.filter((r) => r !== key && r.route).sort((a, b) => sepOf(b) - sepOf(a))[0] ?? key;
      throwTo(target);
    } else if (t > readTime && keySep > 1.6) throwTo(key);
  };

  const aiCarrier = (e, dt) => {
    // Run toward the end zone, steering away from the closest defenders; juke when a tackler lunges.
    let ax = 0;
    for (const d of defenders) {
      if (d.down || d.out > 0 || d.engagedBy) continue;
      const dd = dist(d.pos, e.pos);
      if (dd < 6 && d.pos.z < e.pos.z + 1) ax += Math.sign(e.pos.x - d.pos.x || 1) * (6 - dd) * 0.35;
    }
    let tx = e.pos.x + ax;
    if (mode === 'runD' && e.role === 'RB' && e.pos.z > -2) tx = 9; // sweep to the edge first
    // you coming up hard on run defense: he cuts back inside (or bounces outside) away from you
    if (mode === 'runD' && !e.user && user && !user.engagedBy && user.out <= 0 && dist(user.pos, e.pos) < 4.5 && user.pos.z < e.pos.z + 0.5) tx = e.pos.x - Math.sign(user.pos.x - e.pos.x || 1) * 3.2;
    if (play.hole && e === rb && e.pos.z > -1 && mode === 'run') tx = play.hole[1];
    tx = Math.max(-FIELD_X + 1.5, Math.min(FIELD_X - 1.5, tx));
    moveToward(e, tx, e.pos.z - 6, e.maxSpeed * (moves.slow > 0 && e.user ? 0.55 : !e.user && mode === 'pass' ? 0.88 : 1), dt);
    if (!e.user && e.jukeCd <= 0) {
      const lunger = defenders.find((d) => (d.tell > 0 || d.lunge > 0) && dist(d.pos, e.pos) < 2.6);
      if (lunger && Math.random() < (mode === 'pass' ? 0.1 : mode === 'runD' && lunger.user ? 0.45 : 0.25) * (call === 'risky' ? 1.2 : 1) * (m.defense ? 1 + oppK * 0.3 : 1)) { e.juking = 0.3; e.jukeCd = 1.2; playAction(e.mesh, 'juke', { dir: Math.sign(e.pos.x - lunger.pos.x || 1) }); e.vel.x += Math.sign(e.pos.x - lunger.pos.x || 1) * 5; }
    }
  };

  /** Two players locked up: sway, trade shoves, and sometimes one gets put on his back. */
  const battle = (a, b, dt) => {
    const sway = Math.sin(t * 6.5 + a.start.x * 3) * 1.1;
    a.pos.x += sway * dt * 0.7; b.pos.x += sway * dt * 0.7;
    a.pos.z += Math.cos(t * 5 + a.start.x) * dt * 0.5; b.pos.z += Math.cos(t * 5 + a.start.x) * dt * 0.5;
    a.shoveT = (a.shoveT ?? Math.random() * 0.6) - dt;
    if (a.shoveT > 0) return;
    a.shoveT = 0.45 + Math.random() * 0.7;
    const who = Math.random() < 0.5 ? a : b;
    if (!who.user) playAction(who.mesh, 'stiff', { then: 'block', dur: 0.32 });
    if (b.user || a.user) return;
    const r = Math.random();
    const ratio = Math.max(0.6, Math.min(1.7, a.mass / b.mass));
    if (r < 0.07 * ratio) { // pancake: the blocker plants the defender (bigger blockers do it more)
      a.engaged = null; b.engagedBy = null; setPose(a.mesh, null); setPose(b.mesh, null);
      b.out = 1.8; flatten(b, a, 0.75); fxList.push(dustPuff(group, b.pos));
      if (Math.random() < 0.35) say('pancake');
    } else if (r < 0.07 * ratio + 0.03 / ratio) { // the rusher throws the blocker aside (bigger rushers do it more)
      a.engaged = null; b.engagedBy = null; setPose(a.mesh, null); setPose(b.mesh, null);
      a.out = 1.4; flatten(a, b, 0.6); fxList.push(dustPuff(group, a.pos)); b.out = 0.15;
    }
  };

  const aiDefense = (e, dt) => {
    if (e.burst > 0) e.burst -= dt;
    if (stillDown(e, dt)) return;
    if (e.engagedBy) {
      // Blocked: try to shed the block over time.
      e.shed += dt * (carrier && carrier.team === 'off' && carrier.pos.z > 1.5 && t > 0.8 ? 3 : 1) * ((mode === 'run' ? 0.2 : mode === 'pass' || mode === 'route' ? 0.2 : 0.32) + (mode === 'pass' && user === qb ? 0.1 : 0) + (call === 'risky' ? 0.1 : 0) + (m.defense ? -0.05 : 0.03 + oppK * 0.04) + (e.blitz ? 0.1 : 0));
      if (Math.random() < e.shed * dt * 1.6 || t > 4.5) { const b = e.engagedBy; b.engaged = null; e.engagedBy = null; setPose(b.mesh, null); setPose(e.mesh, null); e.out = 0.25; }
      return;
    }
    const ballPos = flight ? flight.to : carrier ? carrier.pos : holder ? holder.pos : qb.pos;
    // Ball in the air: break on it after a short reaction.
    if (flight && !flight.pitch && t - flight.t0 > 0.22 && dist(e.pos, flight.to) < 11 && e.role !== 'DL') { moveToward(e, flight.to.x, flight.to.z, e.maxSpeed, dt, 20); return; }
    if (carrier && carrier.team === 'off') { pursueAndTackle(e, carrier, dt); return; }
    if (carrier && carrier.team === 'def') { moveToward(e, carrier.pos.x, carrier.pos.z, e.maxSpeed * 0.6, dt); return; }
    if (flight) { moveToward(e, flight.to.x, flight.to.z, e.maxSpeed * 0.6, dt); return; } // no late hits
    // Before the ball is out
    if (runO) {
      // Linebackers read the play first, then fly to the ball; in run defense your teammates are a step slower.
      // designed QB runs: the defense keys on the quarterback a beat sooner and pursues harder
      const qbKey = play.qbRun && holder === qb;
      const readT = e.role === 'LB' ? (qbKey ? 0.6 : 0.9) : e.role === 'DL' ? 0 : qbKey ? 0.75 : 1.0;
      if (t > readT && holder) { pursueAndTackle(e, holder, dt, mode === 'runD' || mode === 'runStop' ? 0.62 : qbKey ? 0.93 : 0.85); return; }
    }
    if ((e.role === 'DL' || e.blitz) && holder) { pursueAndTackle(e, holder, dt, mode === 'pass' && user === qb ? 0.92 : 0.85); return; }
    // QB spy: mirror the quarterback from the second level, attack once he leaves the pocket or holds it too long
    if (e.spy && holder === qb && !flight) {
      if (Math.abs(qb.pos.x - qb.start.x) > 3.2 || qb.pos.z < 1.2 || t > 3.2) { pursueAndTackle(e, qb, dt, 1); return; }
      moveToward(e, qb.pos.x * 0.8, Math.min(-3.5, e.start.z + 1), e.maxSpeed * 0.6, dt);
      backpedalFace(e, false, qb);
      return;
    }
    // QB rolls out of the pocket: zone linebackers come up to contain him. Anyone covering a receiver stays on
    // that receiver until the QB actually crosses the line (then he's a runner and everyone pursues).
    if (mode === 'pass' && holder === qb && !flight && t > 0.8 && Math.abs(qb.pos.x - qb.start.x) > 4.5) {
      e.qbRead ??= t + 0.3 + Math.random() * 0.35; // see it, then go
      const covering = (e.man && !e.zone) || e.role === 'CB' || e.role === 'S';
      if (t > e.qbRead && e.role === 'LB' && !covering) {
        // contain, don't fly past him: sit on the line between him and the sideline, a few yards off
        if (qb.pos.z < 1.5 || dist(e.pos, qb.pos) < 4) { pursueAndTackle(e, qb, dt, 0.95); return; }
        moveToward(e, qb.pos.x + Math.sign(qb.pos.x || 1) * 1.5, Math.min(-1, qb.pos.z - 3), e.maxSpeed * 0.9, dt);
        faceToward(e.mesh, qb.pos.x, qb.pos.z);
        return;
      }
    }
    if (e.role === 'S') {
      const deepZ = Math.min(e.start.z, -12, ...receivers.map((r) => r.pos.z - 4));
      const half = receivers.filter((r) => r.route && (e.deep === undefined || e.deep === 0 || Math.sign(r.pos.x || 1) === e.deep));
      const deepest = half.sort((a, b) => a.pos.z - b.pos.z)[0];
      let tx = e.deep !== undefined ? e.deep * 10 + (ballPos.x - e.deep * 10) * 0.25 : ballPos.x * 0.5;
      if (deepest && deepest.pos.z < -6 && !e.robber) tx = tx * 0.35 + deepest.pos.x * 0.65; // over the top of the deep threat
      moveToward(e, tx, Math.max(backLine + 1, e.robber ? -7 : deepZ), e.maxSpeed * (deepest && deepest.pos.z < -8 ? 0.95 : 0.75), dt);
      backpedalFace(e, e.vel.z < -0.3);
      return;
    }
    if (e.man && !e.zone) {
      // Man coverage: trail the receiver with a reaction lag; jam at the line when pressing.
      const r = e.man;
      if ((play.press || call === 'risky') && t < 0.6 && dist(e.pos, r.pos) < 1.6) r.jam = 0.4;
      // hand-fighting at the line and on the route
      if ((t < 1.6 || r.improv) && dist(e.pos, r.pos) < 1.4 && !(e.handT > 0)) { // on the route, and again in the scramble drill
        e.handT = 0.5 + Math.random() * 0.4;
        playAction(e.mesh, 'stiff', { dur: 0.3 });
        if (!r.user) playAction(r.mesh, 'stiff', { dur: 0.3 });
        r.vel.x += (Math.random() - 0.5) * 4;
      }
      if (e.handT > 0) e.handT -= dt;
      const onUser = r.user && mode === 'route';
      // Real man technique: read the receiver (velocity read lags by a reaction time), keep a cushion and stay
      // on top of him (deeper), backpedal early, then flip the hips and run with him. Cuts still create
      // separation for a moment, but nobody just runs past a defender. Better QBs face slightly slower reads.
      e.lag ??= Math.random() < 0.3 ? 0.12 : Math.random() * 0.06; // some defenders are a step slower to read
      const react = (onUser ? 0.2 + (has('routes') ? 0.08 : 0) : mode === 'pass' ? 0.2 + qbSkill * 0.12 + e.lag : 0.24) * (m.defense ? 1 : 1 - oppK * 0.12);
      e.rv ??= { x: 0, z: 0 };
      const kk = Math.min(1, dt / react);
      e.rv.x += (r.vel.x - e.rv.x) * kk; e.rv.z += (r.vel.z - e.rv.z) * kk;
      e.cush0 ??= Math.max(1, r.pos.z - e.pos.z);
      const floor = onUser ? 0.35 : mode === 'pass' ? 1.4 + qbSkill * 0.6 : 0.8;
      const cush = Math.max(floor, e.cush0 * (1 - t / 1.6));
      const look = 0.3;
      const px = r.pos.x + e.rv.x * look + (r.pos.x < 0 ? 0.45 : -0.45);
      const pz = r.pos.z + e.rv.z * look - cush;
      const d = dist(e.pos, r.pos);
      const pedal = t < 1.4 && d > 2.6 && e.pos.z > pz - 0.5;
      // flip and run: match the receiver's speed (up to your own top speed)
      const rs = Math.hypot(r.vel.x, r.vel.z);
      const spd = pedal ? e.maxSpeed * 0.78 : Math.min(e.maxSpeed * (onUser ? 1.03 : 0.99), Math.max(e.maxSpeed * 0.88, rs * (mode === 'pass' ? 0.97 : 1.04)));
      moveToward(e, px, pz, spd, dt, onUser ? 22 : 26);
      backpedalFace(e, pedal, r);
      return;
    }
    // Once receivers are freelancing (route done / scramble drill), zone players pick one up and stay on him,
    // preferring a receiver nobody else is covering.
    const loose = receivers.filter((r) => r.improv && !r.down && r.out <= 0);
    if (loose.length && !flight) {
      let pickR = null; let bs = Infinity;
      for (const r of loose) {
        const d = dist(e.pos, r.pos);
        if (d > 13) continue;
        const others = defenders.filter((o) => o !== e && !o.engagedBy && dist(o.pos, r.pos) < 2.5).length;
        const sc = d + others * 4.5;
        if (sc < bs) { bs = sc; pickR = r; }
      }
      if (pickR) {
        const lag = 0.3 + Math.random() * 0.15; // read and react, a step behind the receiver's break
        moveToward(e, pickR.pos.x + pickR.vel.x * lag, pickR.pos.z + pickR.vel.z * lag - 0.9, e.maxSpeed * 0.93, dt, 20);
        backpedalFace(e, false, pickR);
        return;
      }
    }
    // Zone: hold an area and squeeze whoever enters it.
    const home = { x: e.start.x * 0.9, z: e.role === 'LB' ? -6.5 : e.start.z - 6 };
    const threat = receivers.find((r) => dist(r.pos, home) < 6);
    if (threat) moveToward(e, (threat.pos.x + home.x) / 2, (threat.pos.z + home.z) / 2 - 0.5, e.maxSpeed * 0.9, dt);
    else moveToward(e, home.x, home.z, e.maxSpeed * 0.7, dt);
    backpedalFace(e, e.vel.z < -0.3);
  };
  const backpedalFace = (e, on, watch) => {
    e.mesh.userData.u.back = on;
    if (on) faceToward(e.mesh, e.pos.x, e.pos.z + 5);
    else if (watch) faceToward(e.mesh, watch.pos.x, watch.pos.z);
  };

  /** Pursue the target; within range, show a tell (crouch + red ring), then lunge. */
  const pursueAndTackle = (e, target, dt, factor = 1) => {
    if (e.lunge > 0) return; // mid-lunge, handled in physics
    const d = dist(e.pos, target.pos);
    if (e.tell > 0) {
      e.tell -= dt;
      faceToward(e.mesh, target.pos.x, target.pos.z);
      // a quarterback running away: keep chasing through the tell (still readable) instead of stopping dead and
      // watching him outrun the lunge
      const away = target === qb && (target.vel.x * (target.pos.x - e.pos.x) + target.vel.z * (target.pos.z - e.pos.z)) > 0;
      if (away) pursue(e, target, dt, 0.92); else { e.vel.x *= 0.85; e.vel.z *= 0.85; }
      if (e.tell <= 0) { e.lunge = 0.32; e.lungeDir = norm(target.pos.x + target.vel.x * 0.25 - e.pos.x, target.pos.z + target.vel.z * 0.25 - e.pos.z); playAction(e.mesh, 'tackle'); }
      return;
    }
    if (d < 2.3 && target !== qb || (target === qb && d < 1.8)) {
      e.tell = 0.26 * (m.defense ? 1 : 1 + (tol - 1) * 0.4) * (target === qb && user === qb && has('pocket') ? 1.5 : 1); // the readable "tell"
      playAction(e.mesh, 'lunge');
      showTell(e);
      return;
    }
    pursue(e, target, dt, factor * (e.burst > 0 ? 1.22 : 1));
  };

  const showTell = (e) => {
    let r = tellRings.get(e);
    if (!r) { r = makeRing('#ff3b3b', 0.55, 0.8, 0.95); e.mesh.add(r); tellRings.set(e, r); }
    r.visible = true;
    r.scale.setScalar(1.3);
  };

  // ---------------- contact resolution
  // ---------------- instant replay: record every body pose ~30 times a second
  const partsOf = (mesh) => { const r = mesh.userData.rig; return [r.body, r.hips, r.spine, r.chest, r.neck, r.legL.hip, r.legL.knee, r.legR.hip, r.legR.knee, r.armL.sh, r.armL.el, r.armR.sh, r.armR.el, r.legL.ankle, r.legR.ankle]; };
  const REC = 3 + 3 + 15 * 3 + 1; // root x/z/yaw, body pos, 15 joint rotations (incl. ankles), rotation order
  const rec = { frames: [], acc: 0 };
  const record = (dt) => {
    rec.acc += dt;
    if (rec.acc < 1 / 30 || rec.frames.length > 420) return;
    rec.acc = 0;
    const f = new Float32Array(4 + ents.length * REC);
    f[0] = ball.position.x; f[1] = ball.position.y; f[2] = ball.position.z; f[3] = ball.visible ? 1 : 0;
    ents.forEach((e, i) => {
      let o = 4 + i * REC;
      const msh = e.mesh;
      f[o++] = msh.position.x; f[o++] = msh.position.z; f[o++] = msh.rotation.y;
      const b = msh.userData.rig.body;
      f[o++] = b.position.x; f[o++] = b.position.y; f[o++] = b.position.z;
      for (const p of partsOf(msh)) { f[o++] = p.rotation.x; f[o++] = p.rotation.y; f[o++] = p.rotation.z; }
      f[o] = b.rotation.order === 'YXZ' ? 1 : 0;
    });
    rec.frames.push(f);
  };
  const applyFrame = (f) => {
    ball.position.set(f[0], f[1], f[2]); ball.visible = f[3] > 0.5;
    ball.userData.shadow.position.set(f[0], 0.03, f[2]);
    ents.forEach((e, i) => {
      let o = 4 + i * REC;
      const msh = e.mesh;
      msh.position.set(f[o], 0, f[o + 1]); msh.rotation.y = f[o + 2]; o += 3;
      const b = msh.userData.rig.body;
      b.rotation.order = f[4 + i * REC + REC - 1] > 0.5 ? 'YXZ' : 'XYZ';
      b.position.set(f[o], f[o + 1], f[o + 2]); o += 3;
      for (const p of partsOf(msh)) { p.rotation.set(f[o], f[o + 1], f[o + 2]); o += 3; }
      if (msh.userData.shadow) { msh.userData.shadow.position.x = b.position.x; msh.userData.shadow.position.z = b.position.z; }
      markTicked(msh);
    });
  };
  let replay = null;
  /** After the play: offer an instant replay (auto-continues after a few seconds). */
  const replayPrompt = (proceed) => {
    if (rec.frames.length < 20 || opts.reducedMotion) { proceed(); return; }
    controls.setButtons([]);
    const bar = document.createElement('div');
    bar.className = 'replay-bar';
    bar.innerHTML = '<button class="btn rp-go">▶ REPLAY</button><button class="btn primary rp-skip">CONTINUE ▸</button><i class="rp-timer"></i>';
    hud.el.append(bar);
    let left = replay ? 6 : 4;
    const timer = setInterval(() => { left -= 0.1; bar.querySelector('.rp-timer').style.width = `${Math.max(0, left / 4) * 100}%`; if (left <= 0) done(); }, 100);
    const done = () => { clearInterval(timer); bar.remove(); window.removeEventListener('keydown', key); proceed(); };
    const go = () => {
      clearInterval(timer); bar.remove(); window.removeEventListener('keydown', key);
      replay = { t: 0, cam: (replay?.cam ?? Math.floor(Math.random() * 3)) + 1, proceed, speed: 0.45, paused: false, yourCam: false, yaw: 0.6, pitch: 0.35, dist: 12 };
      phase = 'replay';
      document.body.classList.add('cine', 'replaying');
      sfx.click();
      showReplayControls();
    };
    const key = (ev) => { if (ev.key === 'r' || ev.key === 'R') go(); else if (ev.key === 'Enter' || ev.key === ' ') done(); };
    window.addEventListener('keydown', key);
    for (const [sel, fn] of [['.rp-go', go], ['.rp-skip', done]]) bar.querySelector(sel).addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); fn(); });
  };
  let rpBar = null;
  const showReplayControls = () => {
    rpBar?.remove();
    rpBar = document.createElement('div');
    rpBar.className = 'rp-controls';
    rpBar.innerHTML = '<div class="rp-title pix">THE REPLAY</div><div class="rp-row"><button data-a="pause">II</button><button data-a="speed">0.5x</button><button data-a="cam">AUTO CAM</button><button data-a="save" class="gold">SAVE</button><button data-a="close">✕</button></div><div class="rp-hint">Your cam: drag to swing the camera</div><i class="rp-prog"></i>';
    hud.el.append(rpBar);
    const label = () => {
      rpBar.querySelector('[data-a=pause]').textContent = replay.paused ? '▶' : 'II';
      rpBar.querySelector('[data-a=speed]').textContent = replay.speed >= 0.9 ? '1x' : '0.5x';
      rpBar.querySelector('[data-a=cam]').textContent = replay.yourCam ? 'YOUR CAM' : 'AUTO CAM';
      rpBar.classList.toggle('yourcam', replay.yourCam);
    };
    rpBar.addEventListener('pointerdown', (ev) => {
      const a = ev.target.dataset?.a;
      if (!a) return;
      ev.preventDefault(); ev.stopPropagation();
      sfx.click();
      if (a === 'pause') replay.paused = !replay.paused;
      if (a === 'speed') replay.speed = replay.speed >= 0.9 ? 0.45 : 1;
      if (a === 'cam') replay.yourCam = !replay.yourCam;
      if (a === 'save') {
        ctx.snapshot?.((img) => { if (img) { highlights.push({ img, label: 'Saved replay' }); hud.big('SAVED!', '#4ade80', 700); } });
      }
      if (a === 'close') { replay.t = 1e9; }
      label();
    });
    // drag anywhere to orbit in YOUR CAM mode
    let drag = null;
    const down = (ev) => { if (!replay?.yourCam || ev.target.closest('.rp-controls button')) return; drag = { x: ev.clientX, y: ev.clientY, yaw: replay.yaw, pitch: replay.pitch }; };
    const move = (ev) => { if (!drag) return; replay.yaw = drag.yaw + (ev.clientX - drag.x) * 0.01; replay.pitch = Math.max(0.08, Math.min(1.3, drag.pitch + (ev.clientY - drag.y) * 0.006)); };
    const up = () => { drag = null; };
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    rpBar.cleanup = () => { window.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    label();
  };
  const hideReplayControls = () => { rpBar?.cleanup?.(); rpBar?.remove(); rpBar = null; };
  ctx.addCleanup?.(hideReplayControls);
  const runReplay = (dt) => {
    if (!replay.paused) replay.t += dt * replay.speed; // slow motion by default
    const n = rec.frames.length;
    const idx = Math.min(n - 1, Math.floor(replay.t * 30));
    applyFrame(rec.frames[idx]);
    const bx = rec.frames[idx][0];
    const bz = rec.frames[idx][2];
    if (rpBar) rpBar.querySelector('.rp-prog').style.width = `${Math.min(100, (idx / Math.max(1, n - 1)) * 100)}%`;
    // broadcast angles: low sideline, end zone, sky cam; or your own orbit camera
    const c = replay.cam % 3;
    if (replay.yourCam) {
      const r2 = replay.dist;
      camera.position.set(bx + Math.sin(replay.yaw) * Math.cos(replay.pitch) * r2, 1 + Math.sin(replay.pitch) * r2, bz + Math.cos(replay.yaw) * Math.cos(replay.pitch) * r2);
      camera.lookAt(bx, 1, bz);
    } else if (c === 0) { camera.position.set(bx + 11, 2.6, bz + 3); camera.lookAt(bx, 1.1, bz - 1); }
    else if (c === 1) { camera.position.set(bx * 0.6, 3.2, bz - 13); camera.lookAt(bx, 1, bz + 1); }
    else { camera.position.set(bx - 4, 16, bz + 9); camera.lookAt(bx, 0, bz - 2); }
    if (idx >= n - 1) {
      hideReplayControls();
      document.body.classList.remove('cine', 'replaying');
      phase = 'over';
      replayPrompt(replay.proceed);
    }
  };

  // highlight pictures for the menus (max 2 per play)
  const highlights = [];
  const snap = (label, delay = 0) => {
    if (highlights.length >= 2 || !ctx.snapshot) return;
    setTimeout(() => ctx.snapshot((img) => { if (img && highlights.length < 2) highlights.push({ img, label }); }), delay);
  };
  // ---------------- quick-time events (contested catches, breakups, fighting for yards)
  let qteActive = false;
  let qteUsed = 0;
  // Quick-time events are a sometimes thing: about 1 play in 3, and rarely two plays in a row.
  const qteOn = !opts.reducedMotion && (globalThis.__forceQte || Math.random() < (globalThis.__lastPlayHadQte ? 0.12 : 0.32));
  globalThis.__lastPlayHadQte = false;
  /** kind 'ring': tap when the shrinking ring hits the target. kind 'mash': tap fast. onDone(success). */
  const startQte = (kind, label, onDone) => {
    qteActive = true;
    qteUsed++;
    globalThis.__lastPlayHadQte = true;
    ctx.setTimeScale?.(0.07);
    sfx.select();
    const ov = document.createElement('div');
    ov.className = `qte qte--${kind}`;
    ov.innerHTML = kind === 'ring'
      ? `<div class="qte-label">${label}</div><div class="qte-zone"><i class="qte-target"></i><i class="qte-ring"></i></div><div class="qte-hint">TAP / SPACE</div>`
      : `<div class="qte-label">${label}</div><div class="qte-mash"><i></i></div><div class="qte-hint">MASH! TAP / SPACE</div>`;
    hud.el.append(ov);
    const t0 = performance.now();
    const DUR = kind === 'ring' ? 1150 : 1500;
    const need = Math.round(8 - Math.min(2, (st.strength ?? 60) / 50) - (has('icevein') || has('clutchgene') || has('truck') ? 1 : 0));
    let taps = 0;
    let over = false;
    const finish2 = (ok) => {
      if (over) return;
      over = true;
      ov.classList.add(ok ? 'win' : 'lose');
      ov.querySelector('.qte-label').textContent = ok ? 'YES!' : 'NO!';
      window.removeEventListener('keydown', key);
      cancelAnimationFrame(raf);
      if (ok) sfx.catch(); else sfx.error?.();
      setTimeout(() => { ov.remove(); ctx.setTimeScale?.(1); qteActive = false; onDone(ok); }, 380);
    };
    const press = () => {
      if (over) return;
      const k = (performance.now() - t0) / DUR;
      if (kind === 'ring') {
        // ring shrinks from 1 to 0; target window around 0.32 (bigger with skill / tolerance)
        const size = 1 - k;
        const traitQ = 1 + (has('icevein') ? 0.4 : 0) + (has('clutchgene') ? 0.25 : 0) + (label.includes('CATCH') && has('moss') ? 0.45 : 0) + (label.includes('BREAK') && has('jumper') ? 0.4 : 0);
        const win = (0.09 + (st.skill ?? 60) / 1200 + (tol - 1) * 0.05) * traitQ;
        finish2(Math.abs(size - 0.32) <= win);
      } else {
        taps++;
        sfx.tick();
        ov.querySelector('.qte-mash i').style.width = `${Math.min(100, (taps / need) * 100)}%`;
        if (taps >= need) finish2(true);
      }
    };
    const key = (ev) => { if (ev.code === 'Space' || ev.key === 'Enter' || ev.key === 'f' || ev.key === 'F') { ev.preventDefault(); press(); } };
    window.addEventListener('keydown', key);
    ov.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); press(); });
    let raf = 0;
    const tick = () => {
      const k = (performance.now() - t0) / DUR;
      if (kind === 'ring') ov.querySelector('.qte-ring').style.transform = `scale(${Math.max(0, 1 - k)})`;
      if (k >= 1) { finish2(false); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  };

  const fxList = [];
  let cineUsed = 0;
  let xrayUsed = 0;
  const afterXray = []; // injury report etc. waits until the X-ray is over
  /** Extreme hit: slow motion, the camera swoops in tight and both players go see-through to the bone. */
  const extremeXray = (tackler, target, cracked) => {
    let xr = null;
    try { xr = liveXray(scene, [tackler.mesh, target.mesh], ents.filter((x) => x !== tackler && x !== target).map((x) => x.mesh)); } catch (err) { console.warn('xray', err); for (const f of afterXray.splice(0)) f(); return; }
    const mid = () => ({ x: (tackler.pos.x + target.pos.x) / 2, z: (tackler.pos.z + target.pos.z) / 2 });
    ctx.cinematic?.(mid, 2.6, { dist: 3.3, height: 1.7, spin: 0.9, look: 0.7, force: true });
    ctx.setTimeScale?.(0.45); // on top of the cinematic's own slow motion: a crawl
    sfx.hit(); setTimeout(() => sfx.hit(), 90);
    let el = 0; // in play time (slowed ~10x while this runs): ~0.23 play-seconds is ~2.5 real seconds
    let crackDone = !cracked;
    let done = false;
    const end = () => { if (done) return; done = true; try { xr.off(); } catch { /* ignore */ } ctx.setTimeScale?.(1); for (const f of afterXray.splice(0)) { try { f(); } catch { /* ignore */ } } };
    ctx.addCleanup?.(end);
    fxList.push((dt) => {
      if (done) return false;
      el += dt;
      xr.update();
      if (!crackDone && el > 0.07) { crackDone = true; xr.crack(cracked[0].mesh, cracked[1].part, !!cracked[1].bone); (sfx.crack ?? sfx.hit)(); ctx.shake(0.4); }
      if (el > 0.23) { end(); return false; }
      return true;
    });
  };
  let scuffle = null;
  let trail = null;
  let dustT = 0;
  const pushDir = (from, to) => {
    const dx = to.pos.x - from.pos.x;
    const dz = to.pos.z - from.pos.z;
    const n = Math.hypot(dx, dz) || 1;
    return { x: dx / n, z: dz / n };
  };
  /** Send someone flying. power ~0.4 (stumble) .. 2 (huge hit). */
  const flatten = (victim, hitter, power) => {
    ragdoll(victim.mesh, pushDir(hitter, victim), power);
  };
  /** The ball in a carrier's hand: tucked along the forearm, nose up a little. */
  const carryBall = (e) => {
    const hp = handPos(e);
    ball.position.copy(hp);
    ball.quaternion.copy(e.mesh.quaternion);
    ball.rotateX(e === qb && !thrown ? -0.9 : 0.55);
    ball.userData.shadow.position.set(hp.x, 0.03, hp.z);
    ball.userData.shadow.scale.setScalar(0.3);
  };
  /** The ball pops loose: physics takes over and everybody goes for it. */
  const fumbleOut = (from, hitter) => {
    if (phase !== 'live' || loose) return;
    const d = pushDir(hitter, from);
    const hp = handPos(from).clone();
    holder = null; carrier = null; flight = null;
    loose = { from, by: hitter, t: 0, bobbles: 0, rec: null };
    lastFumble = { from, by: hitter };
    bphys.launch(hp, new THREE.Vector3(from.vel.x * 0.35 + d.x * 3.2 + (Math.random() - 0.5) * 3, 2.4 + Math.random() * 2.6, from.vel.z * 0.35 + d.z * 3.2 + (Math.random() - 0.5) * 3));
    hud.big('FUMBLE!', '#ffd43b', 1100);
    sfx.hit(); ctx.shake(0.5);
    crowd('turnover', from.team !== (m.defense ? 'def' : 'off'));
    if (!opts.reducedMotion) { ctx.slowMo?.(0.5); ctx.cinematic?.(() => ({ x: ball.position.x, z: ball.position.z }), 1.2); }
    setButtonsFor();
  };
  /** Everyone near a loose ball races to it (blocks hold, anyone down stays down). */
  const chaseLoose = (e, dt) => {
    if (stillDown(e, dt)) return;
    if (e.engaged || e.engagedBy) { e.vel.x *= 0.9; e.vel.z *= 0.9; return; }
    if (loose.rec) { e.vel.x *= 0.9; e.vel.z *= 0.9; return; }
    const bp = ball.position;
    const d = Math.hypot(e.pos.x - bp.x, e.pos.z - bp.z);
    const react = (e.react ??= 0.1 + Math.random() * 0.35);
    if (loose.t < react) return;
    moveToward(e, bp.x + bphys.v.x * 0.3, bp.z + bphys.v.z * 0.3, e.maxSpeed * (d > 20 ? 0.5 : 1), dt, 20);
  };
  /** Who comes up with it. */
  const updateLoose = (dt) => {
    loose.t += dt;
    const bp = ball.position;
    if (loose.rec) {
      loose.rec.t += dt;
      const e = loose.rec.e;
      ball.position.set(e.pos.x + 0.15, 0.22, e.pos.z); ball.userData.shadow.position.set(e.pos.x, 0.03, e.pos.z);
      if (loose.rec.t > 0.6) finishLoose(e);
      return;
    }
    // squirts out of bounds: dead ball, the offense keeps it where it was fumbled
    if (Math.abs(bp.x) > FIELD_X + 0.3 && bp.y < 1) {
      const f = loose.from; loose = null; carrier = f; holder = null;
      whistle('oob');
      if (result) result.text = 'The fumble rolls out of bounds. ' + (m.defense ? 'They keep it.' : 'You keep it.');
      return;
    }
    if (bphys.grabbable() || loose.t > 6) {
      let best = null; let bd = loose.t > 6 ? 99 : 0.95;
      for (const e of ents) {
        if (e.down || e.out > 0 || e.engaged || e.engagedBy) continue;
        const d = Math.hypot(e.pos.x - bp.x, e.pos.z - bp.z);
        if (d < bd) { best = e; bd = d; }
      }
      if (!best) return;
      if (loose.t <= 6 && Math.random() > dt * (bphys.rolling || bphys.resting ? 9 : 4) * (best.user ? 1.6 : 1)) return;
      // it squirts away from him
      if (loose.t <= 6 && !bphys.resting && loose.bobbles < 2 && Math.random() < 0.28) {
        loose.bobbles++;
        bphys.launch(bp.clone().setY(Math.max(0.3, bp.y)), new THREE.Vector3((Math.random() - 0.5) * 6, 1.8 + Math.random() * 2, (Math.random() - 0.5) * 6));
        best.out = 0.35;
        hud.big('BOBBLED!', '#fbbf24', 600); sfx.bounce(0.8);
        return;
      }
      recoverLoose(best);
    }
  };
  const recoverLoose = (e) => {
    if (e.user) {
      // you scoop it up and keep going
      loose = null; bphys.stop();
      holder = e; carrier = e;
      if (e.team === 'def') e.scoop = true;
      hud.big(e.team === 'def' ? 'SCOOPED IT! RUN!' : 'GOT IT BACK!', '#4ade80', 900);
      sfx.catch(); ctx.slowMo?.(0.35);
      setButtonsFor();
      return;
    }
    // falls on it
    playAction(e.mesh, 'dive', { dur: 0.5 });
    e.vel.x *= 0.3; e.vel.z *= 0.3;
    e.down = true;
    bphys.stop();
    loose.rec = { e, t: 0 };
    sfx.hit();
  };
  const finishLoose = (e) => {
    loose = null;
    carrier = e; holder = e;
    if (e.team === 'off') {
      if (e.pos.z <= goalZ) { whistle('td'); return; }
      whistle('tackle', null);
      if (result) result.text = 'Fumble! ' + (m.defense ? 'They fall on it and keep it.' : 'Your team falls on it. Still your ball.');
    } else whistle('fumble', e);
  };
  /** Hard tackle: ragdoll, maybe slow-mo replay, maybe blood, maybe an injury. */
  const hardHit = (tackler, target) => {
    const rel = Math.hypot(tackler.vel.x - target.vel.x, tackler.vel.z - target.vel.z);
    // the tackler goes down with him (wrapped up), unless he's a huge hitter who stays on his feet
    if (!tackler.user || Math.random() < 0.6) {
      const dd = pushDir(tackler, target);
      setTimeout(() => { if (tackler.mesh.userData.u && !tackler.down) { ragdoll(tackler.mesh, dd, 0.35 + Math.random() * 0.25); tackler.out = Math.max(tackler.out ?? 0, 1.3); } }, 120);
    }
    const impact = rel * Math.sqrt(tackler.mass / target.mass);
    const big = globalThis.__forceBigHit || globalThis.__forceExtreme || impact > 10 || Math.random() < 0.12 * Math.min(1.6, tackler.mass / target.mass) * (tackler.user && has('hitstick') ? 1.8 : 1);
    // EXTREME: a full-speed, square collision (or now and then a big hit that just lands perfectly)
    const extreme = !!globalThis.__forceExtreme || (big && (impact > 12.5 || Math.random() < 0.14 * (tackler.user && has('hitstick') ? 1.6 : 1)));
    const sizeK = Math.max(0.7, Math.min(1.5, tackler.mass / target.mass));
    flatten(target, tackler, (extreme ? 1.9 + Math.random() * 0.4 : big ? 1.5 + Math.random() * 0.5 : 0.55 + Math.random() * 0.3) * sizeK);
    fxList.push(dustPuff(group, target.pos, big ? 16 : 9));
    if (!big) return false;
    const involved = target.user || tackler.user;
    hud.big(extreme ? (tackler.user ? 'DESTROYED!' : 'OHHHH!') : tackler.user ? 'BOOM!' : 'BIG HIT!', '#ff6b6b', extreme ? 1300 : 900);
    ctx.hype?.(extreme ? 1 : 0.8, extreme ? 3 : 2);
    crowd(extreme ? 'big' : 'hit', tackler.team === (m.defense ? 'def' : 'off'));
    ctx.shake(extreme ? 0.9 : 0.6);
    if (opts.blood !== false && (globalThis.__forceBigHit || Math.random() < (extreme ? 0.55 : 0.3))) {
      const d = pushDir(tackler, target);
      fxList.push(bloodBurst(group, { x: target.pos.x, y: 1.6, z: target.pos.z }, d));
    }
    // Injuries depend on how hard the hit was: ordinary big hits only cause knocks and strains (bruised ribs,
    // a tweaked hamstring or ankle, sometimes a concussion). Broken bones, dislocations and torn ligaments
    // come from EXTREME hits.
    const pickInjury = (severe) => {
      const forced = INJURIES.find((i) => i.id === globalThis.__forceInjury);
      if (forced) return forced;
      const pool = INJURIES.map((i) => [i, severe ? (i.severe ? i.weight * 2.5 : i.weight * 0.6) : (i.severe || i.major || i.tier === 'out' && i.id !== 'concussion' ? 0 : i.weight)]);
      let tot = 0; for (const [, w] of pool) tot += w;
      let x = Math.random() * tot;
      for (const [i, w] of pool) { x -= w; if (x <= 0) return i; }
      return INJURIES[0];
    };
    const hf = (1.6 - (opts.health ?? 100) / 100) * (has('ironman') ? 0.5 : 1);
    const hurtUser = (who, inj) => {
      const boneOut = !!inj.bone && opts.blood !== false && Math.random() < 0.4;
      who.injured = true;
      who.injury = { id: inj.id, label: inj.label, part: inj.part, boneOut };
      who.out = 30; // you are not getting up from this one
      if (inj.severe) applyInjuryLook(who.mesh, inj.part, { bone: boneOut, blood: opts.blood !== false });
      const report = () => {
        hud.big('INJURED', '#ff6b6b', 1600);
        hud.say?.(`${opts.lastName ?? 'He'} is down and not getting up... trainers are running out.`, 3600);
        if (!opts.reducedMotion && !showXray) ctx.cinematic?.(() => who.pos, 1.6);
      };
      const card = () => { const c = xrayCard(who.injury); document.body.append(c); setTimeout(() => c.remove(), 3700); sfx.error?.(); };
      if (showXray) afterXray.push(() => setTimeout(report, 200), () => setTimeout(card, 1100));
      else { setTimeout(report, 700); setTimeout(card, 1900); }
      return inj;
    };
    const showXray = extreme && xrayUsed < 1 && !opts.reducedMotion && (involved || !!globalThis.__forceExtreme || Math.random() < 0.35);
    let cracked = null; // [entity, injury] shown breaking in the X-ray
    if (target.user && !target.injured && (globalThis.__forceInjury || Math.random() < (extreme ? 0.3 : 0.035) * hf)) {
      cracked = [target, hurtUser(target, pickInjury(extreme))];
    } else if (tackler.user && extreme && !tackler.injured && Math.random() < 0.06 * hf) {
      // leading with the shoulder or the head costs the hitter sometimes too
      const inj = INJURIES.find((i) => i.id === ['shoulder', 'concussion', 'hand', 'elbow'][Math.floor(Math.random() * 4)]);
      cracked = [tackler, hurtUser(tackler, inj)];
    } else if (!target.user && !target.hurt && Math.random() < (extreme ? 0.14 : 0.01)) {
      // every so often someone else stays down too
      const sev = INJURIES.filter((i) => i.severe);
      const inj = sev[Math.floor(Math.random() * sev.length)];
      target.hurt = true; target.out = 30;
      applyInjuryLook(target.mesh, inj.part, { bone: !!inj.bone && opts.blood !== false && Math.random() < 0.3, blood: opts.blood !== false });
      cracked = [target, inj];
      const say = () => hud.say?.(`A player is down for ${target.team === (m.defense ? 'def' : 'off') ? usName : themName}. That looked like his ${inj.part === 'shin' ? 'leg' : inj.part}.`, 3200);
      if (showXray) afterXray.push(() => setTimeout(say, 300)); else setTimeout(say, 900);
    }
    // the slow-motion, zoomed-in live X-ray: always when you're in an extreme hit, sometimes for other players
    if (showXray) {
      xrayUsed++; cineUsed++;
      extremeXray(tackler, target, cracked);
      snap(tackler.user ? 'Destroyed him' : target.user ? 'Got leveled' : 'Huge hit', 350);
    } else if (involved && cineUsed < 1 && !opts.reducedMotion && (globalThis.__forceBigHit || Math.random() < 0.6)) {
      cineUsed++;
      ctx.cinematic?.(() => target.pos, 1.4);
      snap(tackler.user ? 'Big hit!' : 'Leveled', 450);
    }
    return true;
  };

  const tryTackle = (tackler, target) => {
    if (target.down || qteActive) return;
    // already wrapped up: you join the pile (gang tackle) and the carrier goes down faster
    if (target.wrap) { if (!target.wrap.by.includes(tackler)) { target.wrap.by.push(tackler); tackler.lunge = 0; playAction(tackler.mesh, 'tackle'); sfx.hit(); } return; }
    const u = target === user;
    tackler.lunge = 0;
    if (u && (moves.juke > 0 || moves.spin > 0)) {
      tackler.out = 1.4; flatten(tackler, target, 0.5);
      const perfect = moves.juke > 0.12 || moves.spin > 0.2;
      hud.big(perfect ? 'PERFECT JUKE!' : moves.spin > 0 ? 'SPIN MOVE!' : 'JUKE!', perfect ? '#4ade80' : '#fff', 700);
      if (perfect) ctx.slowMo(0.35);
      sfx.cheer();
      return;
    }
    if (!u && target.juking > 0) { tackler.out = 1.1; flatten(tackler, target, 0.45); return; }
    if (u && moves.stiff > 0) {
      const facing = (tackler.pos.z < target.pos.z + 0.5);
      if (facing && Math.random() < (0.35 + (st.strength ?? 60) / 160) * (has('truck') ? 1.3 : 1)) {
        tackler.out = 1.2; flatten(tackler, target, 0.9); moves.slow = 0.3;
        hud.big('STIFF ARM!', '#fbbf24', 700); sfx.hit(); ctx.shake(0.25); return;
      }
    }
    if (u && qteUsed < 1 && !opts.reducedMotion && (qteOn || (target.pos.z - goalZ < 3 && Math.random() < 0.35))) {
      target.vel.x *= 0.3; target.vel.z *= 0.3;
      startQte('mash', target.pos.z - goalZ < 3 ? 'REACH FOR THE END ZONE!' : 'FIGHT FOR YARDS!', (ok) => {
        if (phase !== 'live') return;
        if (ok) {
          target.broken = (target.broken ?? 0) + 1;
          tackler.out = 1.2; flatten(tackler, target, 0.7);
          target.pos.z -= 1.8; target.vel.z = -6;
          hud.big('BREAKS FREE!', '#4ade80', 800); ctx.cinematic?.(() => target.pos, 1.0); snap('Broke free!', 200);
          return;
        }
        playAction(tackler.mesh, 'tackle'); target.down = true; const big = hardHit(tackler, target); sfx.hit();
        if (!target.injured && (globalThis.__forceFumble || (big && Math.random() < (has('secure') ? 0.04 : 0.08)))) fumbleOut(target, tackler); else whistle('tackle', tackler);
      });
      return;
    }
    const str = target.user ? (st.strength ?? 60) : 60;
    const pBreak = (str / 100) * 0.3 * (target.user ? (0.6 + tol * 0.4) : mode === 'pass' ? 0.35 : 0.6) * Math.pow(0.5, target.broken ?? 0) + (tackler.user ? (mode === 'runD' ? 0.12 - ((st.strength ?? 60) - 60) / 400 + oppK * 0.04 : -0.1) : 0);
    const traitBreak = target.user ? (has('truck') ? 1.3 : 1) * (has('yac') && mode === 'route' ? 1.4 : 1) : 1;
    if (Math.random() < pBreak * traitBreak * Math.max(0.5, Math.min(1.8, Math.pow(target.mass / tackler.mass, 1.3)))) {
      target.broken = (target.broken ?? 0) + 1;
      tackler.out = 1.0; flatten(tackler, target, 0.6);
      if (target.user) { moves.slow = 0.4; hud.big('BROKE A TACKLE!', '#fbbf24', 700); }
      sfx.hit(); ctx.shake(0.2);
      return;
    }
    // Tackled. Ordinary contact becomes a wrap-up where momentum decides the yards after contact;
    // only a big collision drops the carrier on the spot.
    const relV = Math.hypot(tackler.vel.x - target.vel.x, tackler.vel.z - target.vel.z);
    if (!globalThis.__forceBigHit && !globalThis.__forceExtreme && !globalThis.__forceFumble && relV * Math.sqrt(tackler.mass / target.mass) < 9 && Math.random() > 0.12) { startWrap(tackler, target); return; }
    finishTackle(tackler, target);
  };
  /** Wrap-up: carrier and tackler(s) move together with their combined momentum until the pile stops. */
  const startWrap = (tackler, target) => {
    const tv = tackler.lunge > 0 && tackler.lungeDir ? { x: tackler.lungeDir.x * 8.5, z: tackler.lungeDir.z * 8.5 } : tackler.vel;
    const mC = target.mass, mT = tackler.mass;
    const vx = (mC * target.vel.x + mT * tv.x) / (mC + mT), vz = (mC * target.vel.z + mT * tv.z) / (mC + mT);
    const drive = Math.max(0, Math.min(2, (mC * Math.hypot(target.vel.x, target.vel.z)) / (mT * Math.hypot(tv.x, tv.z) + 1)));
    target.wrap = { by: [tackler], t: 0, vx, vz, dur: 0.35 + drive * 0.3 + (target.user ? (st.strength ?? 60) / 400 : 0) };
    tackler.lunge = 0;
    playAction(tackler.mesh, 'tackle');
    sfx.hit(); ctx.shake(0.18);
    if (target.user && drive > 0.6) hud.big('FIGHT FOR IT!', '#fbbf24', 600);
  };
  const updateWrap = (dt) => {
    const c = carrier;
    if (!c?.wrap || c.down || phase !== 'live') return;
    const w = c.wrap;
    w.t += dt;
    // the pile slows: every extra tackler adds a lot of stopping power
    const k = Math.exp(-(1.8 + w.by.length * 1.7) * dt * Math.pow(1 / surf.slide, 0.5) * (1 + surf.sink * 3)); // slick ground: the pile slides; mud: it sticks
    w.vx *= k; w.vz *= k;
    // you can drive the pile (hold sprint), harder the stronger you are
    if (c.user && controls.state.sprint) { const fwd = c.team === 'off' ? -1 : 1; w.vz += fwd * dt * 3.2 * ((st.strength ?? 60) / 60) / w.by.length; w.dur += dt * 0.25; }
    c.vel.x = w.vx; c.vel.z = w.vz;
    // tacklers hang on (dragged behind / around the carrier)
    w.by.forEach((b, i) => {
      const a = Math.atan2(-w.vx, -w.vz) + (i - (w.by.length - 1) / 2) * 0.9;
      b.pos.x += (c.pos.x + Math.sin(a) * 0.55 - b.pos.x) * Math.min(1, dt * 12);
      b.pos.z += (c.pos.z + Math.cos(a) * 0.55 - b.pos.z) * Math.min(1, dt * 12);
      b.vel.x = w.vx; b.vel.z = w.vz;
      faceToward(b.mesh, c.pos.x, c.pos.z);
    });
    if (w.t >= w.dur || Math.hypot(w.vx, w.vz) < 0.7) { const by = w.by[0]; c.wrap = null; finishTackle(by, c); }
  };
  const finishTackle = (tackler, target) => {
    target.wrap = null;
    playAction(tackler.mesh, 'tackle', { then: null });
    target.down = true;
    const bigHit = hardHit(tackler, target);
    sfx.hit();
    ctx.shake(0.4);
    // big hits jar the ball loose much more often
    const fumbleP = (0.012 * (call === 'risky' ? 2 : 1) + wfx.slip * 0.25 + (tackler.user ? 0.04 + (has('hitstick') ? 0.04 : 0) : 0) + (bigHit ? (target.user ? 0.07 : 0.14) : 0)) * (target.user && has('secure') ? 0.5 : 1);
    if (!target.injured && (globalThis.__forceFumble || Math.random() < fumbleP)) fumbleOut(target, tackler);
    else whistle('tackle', tackler);
  };

  // ---------------- ball skills: track it, turn to it, reach for it, go up and get it, then secure it
  const reachV = new THREE.Vector3();
  const arriveV = new THREE.Vector3();
  const reachers = new Map(); // entity -> seconds to keep reaching after the ball arrives (arms stay up on a breakup)
  const ballWorld = () => ball.getWorldPosition(reachV);
  const ballSkills = (dt) => {
    const f = flight;
    if (!f || f.pitch) return;
    const remain = f.T - (t - f.t0);
    const land = f.to;
    const y1 = f.endY ?? 1.3;
    const tr = f.target;
    // the receiver and up to two defenders who can get there
    const contest = defenders.filter((d) => !d.down && d.out <= 0 && d.role !== 'DL' && !d.engagedBy && dist(d.pos, land) < 2.8)
      .sort((a, b) => dist(a.pos, land) - dist(b.pos, land)).slice(0, 2);
    const who = tr && !tr.down ? [tr, ...contest] : contest;
    const ax = land.x - f.from.x, az = land.z - f.from.z, al = Math.hypot(ax, az) || 1; // the way the ball is travelling
    // hands go to where the ball will arrive first, then follow it in over the last moment
    const bw = ballWorld();
    const kIn = Math.max(0, Math.min(1, 1 - remain / 0.45));
    arriveV.set(land.x, y1, land.z);
    group.localToWorld(arriveV);
    arriveV.lerp(bw, 0.25 + 0.75 * kIn);
    for (const e of who) {
      const isTr = e === tr;
      const startAt = isTr ? (y1 >= 1.85 ? 0.75 : 0.6) : 0.5;
      if (remain > startAt) continue;
      const k = Math.min(1, (startAt - remain) / 0.3);
      setReach(e.mesh, arriveV, (isTr ? 1 : 0.85) * k);
      reachers.set(e, 0.3);
      // turn to the ball. Running away from the QB on a deep ball: keep running, catch it over the shoulder.
      if (!e.user && remain < 0.55 && !e.out) {
        const sp = Math.hypot(e.vel.x, e.vel.z);
        const away = sp > 4 && (e.vel.x * ax + e.vel.z * az) / (sp * al) > 0.55;
        if (!away) faceToward(e.mesh, ball.position.x, ball.position.z);
      }
      // go up for it: leave the ground so the top of the jump meets the ball
      const lead = y1 >= 2.25 ? 0.36 : 0.3;
      if (y1 >= 1.85 && remain <= lead && remain > 0.05 && !f.jumped.has(e) && (!e.user || catchPress !== null || swatPress !== null || isTr)) {
        f.jumped.add(e);
        playAction(e.mesh, 'jump');
      }
      // low ball: get down to it
      if (y1 < 0.95 && isTr && !e.user && remain <= 0.22 && !f.jumped.has(e)) { f.jumped.add(e); playAction(e.mesh, 'catch'); }
    }
  };
  /** Right after a catch: the ball is in both hands (where it was caught), then pulled in and tucked away. */
  const SECURE_T = 0.42;
  const tuckV = new THREE.Vector3();
  const secureBall = (e, dt) => {
    e.secure -= dt;
    const rg = e.mesh.userData.rig;
    const hl = rg?.armL?.hand, hr = rg?.armR?.hand;
    const k = Math.max(0, Math.min(1, 1 - e.secure / SECURE_T)); // 0 = just caught .. 1 = tucked
    // hands come from the catch point to the chest
    const fwd = e.mesh.rotation.y;
    const sc = rg?.body?.scale?.y ?? 1;
    const chest = { x: e.pos.x - Math.sin(fwd) * 0.32, y: 1.25 * sc, z: e.pos.z - Math.cos(fwd) * 0.32 };
    const c0 = e.catchAt ?? chest;
    const kk = k * k * (3 - 2 * k);
    tuckV.set(c0.x + (chest.x - c0.x) * kk, c0.y + (chest.y - c0.y) * kk, c0.z + (chest.z - c0.z) * kk);
    group.localToWorld(tuckV);
    setReach(e.mesh, tuckV, 1);
    if (hl && hr) {
      const a = hl.getWorldPosition(new THREE.Vector3()), b = hr.getWorldPosition(new THREE.Vector3());
      ball.position.copy(a.add(b).multiplyScalar(0.5));
      group.worldToLocal(ball.position);
      ball.quaternion.copy(e.mesh.quaternion);
      ball.rotateY(Math.PI / 2); // laces up, nose across the hands
      ball.userData.shadow.position.set(ball.position.x, 0.03, ball.position.z);
    } else carryBall(e);
    if (e.secure <= 0) { e.secure = 0; setReach(e.mesh, null); reachers.delete(e); }
  };
  /** Let go of the reach a moment after the ball arrives (ballSkills keeps refreshing it while the ball is coming). */
  const releaseReach = (dt) => {
    for (const [e, left] of reachers) {
      if (e.secure > 0) continue;
      const nl = left - dt;
      if (nl <= 0) { setReach(e.mesh, null); reachers.delete(e); } else reachers.set(e, nl);
    }
  };
  /** Someone just came down with it (catch or pick): hold it up in both hands, then tuck it. */
  const secureIt = (e) => { e.catchAt = { x: ball.position.x, y: Math.max(0.5, ball.position.y), z: ball.position.z }; e.secure = SECURE_T; };

  // ---------------- catch resolution
  const resolveFlight = () => {
    const f = flight;
    flight = null;
    const r = f.target;
    const land = f.to;
    if (f.pitch) { holder = r; carrier = r; return; }
    if (globalThis.__forceCatch) { completeCatch(r, land); return; } // test hook
    const dR = dist(r.pos, land);
    const defs = defenders.filter((d) => !d.down && d.out <= 0);
    const dD = Math.min(...defs.map((d) => dist(d.pos, land)));
    const crowd = defs.filter((d) => dist(d.pos, land) < 2).length;
    // --- defense player (you) trying to swat / pick
    if (user.team === 'def' && qteOn && swatPress === null && qteUsed < 1 && dist(user.pos, land) < 1.7 && dR < 1.8) {
      ball.position.set(land.x, 1.6, land.z);
      startQte('ring', 'BREAK IT UP!', (ok) => {
        if (phase !== 'live') return;
        if (ok) {
          if (Math.random() < 0.28 + (st.skill ?? 60) / 600 + (has('ballhawk') ? 0.15 : 0)) { holder = user; carrier = user; user.int = true; secureIt(user); snap('Interception!', 100); hud.big('INTERCEPTION!', '#4ade80', 900); ctx.cinematic?.(() => user.pos, 1.3); sfx.catch(); setButtonsFor(); return; }
          playAction(user.mesh, 'dive'); hud.big('BROKEN UP!', '#4ade80', 800); ctx.cinematic?.(() => user.pos, 1.1); whistle('pd'); return;
        }
        completeCatch(r, land);
      });
      return;
    }
    if (user.team === 'def' && dist(user.pos, land) < 1.8 + tol * 0.3) {
      const timing = swatPress === null ? 9 : Math.abs(f.t0 + f.T - swatPress - 0.12);
      const win = (0.16 + (st.skill ?? 60) / 100 * 0.12) * tol;
      if (timing <= win && dist(user.pos, land) <= dR + 0.5) {
        if (Math.random() < 0.3 + (st.skill ?? 60) / 600 + (has('ballhawk') ? 0.15 : 0)) { holder = user; carrier = user; user.int = true; secureIt(user); snap('Interception!', 150); hud.big('INTERCEPTION!', '#4ade80', 900); ctx.slowMo(0.5); sfx.catch(); setButtonsFor(); return; }
        whistle('pd'); return;
      }
      if (timing <= win * 2.2 || dist(user.pos, land) < 0.9) { whistle('pd'); return; }
    }
    // --- you are the receiver: contested balls become a quick-time event
    if (r === user && qteOn && qteUsed < 1) {
      const nearD0 = defs.reduce((a, d) => (dist(d.pos, land) < dist(a.pos, land) ? d : a), defs[0]);
      if (nearD0 && dist(nearD0.pos, land) < 1.7 && dR < 1.9 + (user.hIn - 73) * 0.04) {
        ball.position.set(land.x, 1.7, land.z);
        if (!f.jumped?.has(user)) playAction(user.mesh, (f.endY ?? 1.3) >= 1.9 || f.H > 3 ? 'jump' : 'catch');
        startQte('ring', 'CONTESTED CATCH!', (ok) => {
          if (phase !== 'live') return;
          if (ok) { hud.big('MOSSED HIM!', '#4ade80', 900); ctx.cinematic?.(() => user.pos, 1.3); snap('Contested catch!', 250); completeCatch(r, land); return; }
          if (Math.random() < 0.25) { holder = nearD0; carrier = nearD0; secureIt(nearD0); whistle('int'); return; }
          if (pass) pass.cause = 'contest'; whistle('incomplete', null, 'Ripped away at the catch point!');
        });
        return;
      }
    }
    let catchOk;
    if (r === user) {
      const timing = catchPress === null ? 9 : Math.abs(f.t0 + f.T - catchPress - 0.1);
      const win = 0.13 * tol * (0.85 + (st.skill ?? 60) / 400) * (play.jump ? 1.3 : 1) * (has('velcro') ? 1.3 : 1);
      const tallK = (user.hIn - 73) * 0.04;
      const nearD = defs.reduce((a, d) => (dist(d.pos, land) < dist(a.pos, land) ? d : a), defs[0]);
      const heightEdge = nearD ? (user.hIn - nearD.hIn) * 0.02 : 0;
      if (dR > 1.4 + tol * 0.3 + tallK) catchOk = false;
      else if (timing <= win) catchOk = Math.random() < (crowd ? 0.82 + (st.strength ?? 60) / 600 + heightEdge : 0.97);
      else if (timing <= win * 2.3) catchOk = Math.random() < (crowd ? 0.45 + (st.strength ?? 60) / 500 : 0.8);
      else catchOk = Math.random() < (crowd ? 0.08 : 0.3); // never pressed: maybe a body catch
      if (catchOk && Math.random() < wfx.slip) { catchOk = false; hud.big('SLIPPERY!', '#fbbf24', 600); }
    } else {
      const nearD = defs.reduce((a, d) => (dist(d.pos, land) < dist(a.pos, land) ? d : a), defs[0]);
      const hEdge = nearD ? (r.hIn - nearD.hIn) * 0.025 : 0;
      const catchR = (f.H > 4 ? 1.7 : 1.15) + 0.2 * tol + (r.hIn - 73) * 0.04 * (f.H > 3 ? 1.6 : 1);
      const lock = has('lockdown') && user.team === 'def' && dist(user.pos, land) < 3 ? 0.15 : 0;
      catchOk = dR <= catchR && Math.random() < (crowd ? 0.42 + hEdge : dD < 1.6 ? 0.72 + hEdge : 0.9) - wfx.slip - lock;
      // tight coverage: the defender gets a hand in
      if (catchOk && dD < 1.25 && Math.random() < 0.3 / tol) { if (pass) pass.cause = 'contest'; whistle('incomplete', null, 'Broken up at the catch point!'); return; }
      if (play.hail) catchOk = dR < 2.4 && Math.random() < 0.35 - crowd * 0.05;
    }
    if (!catchOk && pass) {
      const reachR = r === user ? 1.4 + tol * 0.3 + (user.hIn - 73) * 0.04 : (f.H > 4 ? 1.7 : 1.15) + 0.2 * tol + (r.hIn - 73) * 0.04;
      pass.cause = play.hail ? 'hail' : dR > reachR ? 'off' : crowd || dD < 1.3 ? 'contest' : 'drop';
    }
    const intRisk = dD < 0.9 && dD < dR ? 0.45 : dD < 1.3 && !catchOk ? 0.2 : 0;
    if (!catchOk && Math.random() < intRisk * (call === 'risky' ? 1.3 : 1)) {
      const picker = defs.reduce((a, d) => (dist(d.pos, land) < dist(a.pos, land) ? d : a), defs[0]);
      holder = picker; carrier = picker; secureIt(picker);
      whistle('int');
      return;
    }
    if (!catchOk) { whistle('incomplete'); return; }
    // Toe-tap: you must be in bounds.
    if (Math.abs(r.pos.x) > FIELD_X) { if (pass) pass.cause = 'oob'; whistle('incomplete', null, 'Out of bounds. No catch.'); return; }
    completeCatch(r, land);
  };
  /** Ball secured. Long reaches become diving catches with a slow-mo moment. */
  const completeCatch = (r, land) => {
    if (pass) pass.caughtBy = r;
    holder = r;
    carrier = r;
    sfx.catch();
    // the ball stays where it was caught, in both hands, for a beat
    secureIt(r);
    const reach = land ? dist(r.pos, land) : 0;
    const involved = r.user || user === qb;
    if (reach > 0.95 || (involved && Math.random() < 0.12)) {
      playAction(r.mesh, 'dive', { dur: 0.6 });
      r.out = 0.55; // takes a moment to get up from the layout
      if (involved && !opts.reducedMotion && cineUsed < 2) { cineUsed++; ctx.cinematic?.(() => r.pos, 1.3); snap('Diving catch!', 300); }
      hud.say?.(line('diving', opts.lastName ?? ''));
    } else {
      playAction(r.mesh, 'catch');
      say('catch');
    }
    // defenders nearby close fast on the catch
    for (const d of defenders) if (dist(d.pos, r.pos) < 10) d.burst = 1.1;
    if (r === user) setButtonsFor();
  };

  // ---------------- whistle & results
  const say = (kind) => hud.say?.(line(kind, opts.lastName ?? 'he'));
  const commentate = (why) => {
    const r = result;
    if (!r) return;
    // crowd reaction (from the user's point of view)
    if (!(r.td || r.defTD)) {
      if (m.defense) {
        if (r.turnover) crowd('turnover', true); else if (r.sack) crowd('sack', true); else if (r.pd || why === 'incomplete') crowd('incomplete', true);
        else if ((r.yardsAllowed ?? 0) >= 15) crowd('big', false); else crowd((r.yardsAllowed ?? 0) <= 2 ? 'good' : 'bad', (r.yardsAllowed ?? 0) <= 2);
      } else if (r.turnover) crowd('turnover', false); else if (r.sack) crowd('sack', false); else if (r.complete === false) crowd('incomplete', false);
      else if (r.yards >= 15) crowd('big', true); else crowd(r.yards >= 4 ? 'good' : 'bad', r.yards >= 4);
    }
    if (r.td || r.defTD) return; // celebration handles it
    if (m.defense) {
      if (r.sack) say(r.tackle ? 'sackBy' : 'sack'); else if (r.int) say('pick'); else if (r.pd) say('pd'); else if (r.forcedFumble) say('turnover');
      else if (why === 'incomplete') say('incomplete'); else if (r.tackle) say('stop'); else say((r.yardsAllowed ?? 0) > 8 ? 'allowed' : 'short');
    } else if (r.turnover) say('turnover'); else if (r.sack) say('sack'); else if (r.complete === false) say('incomplete');
    else say(r.yards >= 15 ? 'big' : r.yards >= 5 ? 'gain' : 'short');
  };
  /**
   * Fair grades: a receiver isn't blamed for a bad throw, a sack or a ball thrown to someone else; a QB isn't blamed
   * for a drop on a perfect pass; a corner isn't blamed for a catch made on another man far away. Sets result.blame
   * ('you' | 'qb' | 'receiver' | 'line' | 'defense' | 'none') and result.why (a plain-language reason).
   */
  const gradeByRole = (why) => {
    if (!result) return;
    const passPlay = !!pass;
    const meQB = user === qb;
    if (!m.defense) {
      if (meQB) {
        if (why === 'incomplete' && pass?.cause === 'drop') Object.assign(result, { quality: 0.5, blame: 'receiver', why: 'Right on the money. He dropped it.' });
        else if (why === 'incomplete' && pass?.cause === 'contest') Object.assign(result, { quality: 0.32, blame: 'defense', why: 'Good coverage got a hand on it.' });
        else if (why === 'incomplete' && pass?.cause === 'off') Object.assign(result, { blame: 'you', why: 'Off target.' });
        else if (why === 'incomplete' && pass?.cause === 'hail') Object.assign(result, { quality: 0.3, blame: 'none', why: 'A prayer that did not get answered.' });
        else if (why === 'sack' && t < 2.3) Object.assign(result, { quality: 0.2, blame: 'line', why: 'The line collapsed right away. No time.' });
        else if (why === 'sack') Object.assign(result, { blame: 'you', why: 'Held it too long.' });
        return;
      }
      if (!passPlay) {
        // a run: the yards tell the story, unless you were hit in the backfield before you could do anything
        const yds = result.yards ?? 0;
        if (carrier === user && why === 'tackle' && yds <= 0 && yds >= -4 && t < 1.15) Object.assign(result, { quality: Math.max(result.quality, 0.3), blame: 'line', why: 'Hit in the backfield before you could cut. The line got beat.' });
        else if (carrier === user && why === 'tackle' && yds <= -6) Object.assign(result, { blame: 'you', why: 'You gave up ground and got run down. Going backwards almost never works.' });
        return;
      }
      const toMe = pass.target === user;
      const caughtByOther = pass.caughtBy && pass.caughtBy !== user;
      const openK = Math.max(0, Math.min(1, ((pass.sepUser ?? 2) - 0.8) / 3.2)); // how open you were when the ball came out
      if (why === 'sack') return void Object.assign(result, { quality: 0.42, blame: 'line', notTargeted: true, why: 'Sacked before the ball came out. Not on you.' });
      if (caughtByOther) return void Object.assign(result, { quality: Math.min(result.quality, Math.max(0.45, 0.4 + openK * 0.2 + (result.yards ?? 0) / 60)), toOther: true, notTargeted: true, blame: 'none', why: `Thrown to a teammate${result.td ? ' for the score' : ''}. You did your job on the route.` });
      if (!toMe) {
        if (why === 'int') return void Object.assign(result, { quality: 0.38, notTargeted: true, blame: 'qb', why: 'The QB forced it to someone else. Not on you.' });
        if (why === 'incomplete') return void Object.assign(result, { quality: 0.36 + openK * 0.22, notTargeted: true, blame: 'none', why: openK > 0.5 ? 'You were open, but the ball went elsewhere.' : 'Ball went elsewhere. You were covered.' });
        return;
      }
      if (why === 'int') return void Object.assign(result, pass.cause === 'off' ? { quality: 0.32, blame: 'qb', why: 'Bad throw, picked off. Not on you.' } : { quality: 0.18, blame: 'you', why: 'Lost the fight for the ball.' });
      if (why === 'incomplete') {
        const c = pass.cause;
        if (c === 'off') Object.assign(result, { quality: 0.45, blame: 'qb', why: 'Bad throw. Nothing you could do.' });
        else if (c === 'hail') Object.assign(result, { quality: 0.4, blame: 'none', why: 'Jump ball. Nobody came down with it.' });
        else if (c === 'contest') Object.assign(result, { quality: 0.32, blame: 'defense', why: 'The defender got a hand in. Tough break.' });
        else if (c === 'oob') Object.assign(result, { quality: 0.24, blame: 'you', why: 'Could not get a foot down in bounds.' });
        else Object.assign(result, { quality: 0.12, blame: 'you', why: 'A catchable ball. You dropped it.', drop: true });
      }
      return;
    }
    // defense: a corner in coverage is not graded on a catch made far from him on a man he wasn't covering
    if (mode === 'cover' && result.caught && pass?.caughtBy && pass.caughtBy !== user.man && dist(user.pos, pass.caughtBy.pos) > 6 && by !== user) {
      Object.assign(result, { quality: Math.max(result.quality, 0.5), notMine: true, blame: 'none', why: 'Caught on the other side of the field, not your man.' });
    }
  };
  let by = null;
  const whistle = (why, by_ = null, text = null) => { by = by_; return whistleInner(why, by_, text); };
  const whistleInner = (why, by = null, text = null) => {
    if (phase !== 'live') return;
    setTimeout(() => commentate(why), 0);
    if (globalThis.__playDebug) console.log('whistle', why, 'by', by?.role, by?.slot, by?.engagedBy ? 'blocked' : '', carrier?.role, carrier?.slot, carrier?.pos.z?.toFixed(1), 'holder', holder?.role, 'thrown', thrown, 't', t.toFixed(2));
    phase = 'dead';
    t = 0;
    sfx.whistle();
    if ((why === 'incomplete' || why === 'pd') && !holder && !bphys.active) {
      const pop = why === 'pd' ? 3.5 + Math.random() * 2 : 0.5 + Math.random();
      bphys.launch(ball.position.clone(), new THREE.Vector3(lastVel.x * 0.35 + (Math.random() - 0.5) * (why === 'pd' ? 5 : 2), pop, lastVel.z * 0.35 + (Math.random() - 0.5) * 2));
    }
    // pile on the ball carrier, and maybe a little scuffle after the whistle
    const spot = (carrier ?? holder ?? qb)?.pos;
    if (spot && (why === 'tackle' || why === 'sack' || why === 'fumble')) {
      const near = ents.filter((x) => !x.user && !x.down && !(x.out > 0) && x !== carrier && dist(x.pos, spot) < 7).sort((a2, b2) => dist(a2.pos, spot) - dist(b2.pos, spot)).slice(0, 3);
      near.forEach((x, i) => { x.pile = { at: 0.15 + i * 0.18 + Math.random() * 0.2, x: spot.x + (Math.random() - 0.5), z: spot.z + (Math.random() - 0.5) }; });
    }
    if (Math.random() < 0.22) {
      const o = ents.find((x) => x.team === 'off' && !x.user && !x.down && !(x.out > 0) && !x.pile);
      const d2 = o && ents.filter((x) => x.team === 'def' && !x.user && !x.down && !(x.out > 0) && !x.pile).sort((a2, b2) => dist(a2.pos, o.pos) - dist(b2.pos, o.pos))[0];
      if (o && d2 && dist(o.pos, d2.pos) < 4) { scuffle = { a: o, b: d2, t: 0 }; setTimeout(() => hud.say?.(line('scuffle')), 700); }
    }
    const yardsFrom = (e) => Math.round(-(e?.pos.z ?? 0));
    const def = m.defense;
    if (why === 'td') {
      scorer = carrier;
      const chaser = defenders.concat(ents.filter((x) => x.team === 'off')).filter((d) => d.team !== carrier.team && !d.down).sort((a, b) => dist(a.pos, carrier.pos) - dist(b.pos, carrier.pos))[0];
      if (chaser && dist(chaser.pos, carrier.pos) < 2.6 && !opts.reducedMotion) { playAction(carrier.mesh, 'dive', { dur: 0.5 }); ctx.cinematic?.(() => carrier.pos, 1.2); snap('Dives in!', 200); }
      result = def ? (carrier.team === 'def' ? (user.scoop ? { defense: true, forcedFumble: lastFumble?.by === user, fumbleRec: true, turnover: true, defTD: true, quality: 0.99, text: 'SCOOP AND SCORE!' } : { defense: true, int: true, turnover: true, defTD: true, quality: 0.98, text: 'PICK SIX!' }) : { defense: true, caught: true, yardsAllowed: m.yardLine, tdAllowed: true, quality: 0.05, text: 'They score.' })
        : (carrier === qb && qb.scramble ? { scramble: true, complete: false, yards: m.yardLine, td: true, quality: 0.95, text: 'TOUCHDOWN! You took it in yourself!' } : { complete: true, yards: m.yardLine, td: true, quality: 0.95, text: 'TOUCHDOWN!' });
      gradeByRole('td');
      if (globalThis.__playDebug) globalThis.__lastResult = { ...result, why2: 'td' };
      if ((def && carrier.team === 'def') || (!def && carrier.team === 'off')) startCelebration();
      return;
    }
    if (def) {
      if (user.scoop) result = { defense: true, forcedFumble: lastFumble?.by === user, fumbleRec: true, turnover: true, tackle: lastFumble?.by === user, quality: 0.96, text: 'FUMBLE RECOVERY! You scoop it up.' };
      else if (why === 'int' || user.int) result = { defense: true, int: true, turnover: true, quality: 0.92, text: 'INTERCEPTED!' };
      else if (why === 'pd' || why === 'incomplete') result = { defense: true, pd: why === 'pd', yardsAllowed: 0, quality: why === 'pd' ? 0.72 : 0.55, text: why === 'pd' ? 'Pass broken up!' : 'Incomplete.' };
      else if (why === 'sack') { const loss = Math.max(1, Math.round(qb.pos.z - 0)); result = { defense: true, sack: true, tackle: by === user, tfl: true, yardsAllowed: -loss, quality: by === user ? 0.96 : 0.72, text: by === user ? `SACK! You drop him for a loss of ${loss}.` : `Sacked by a teammate for a loss of ${loss}.` }; }
      else if (why === 'fumble' && by?.team === 'def') { const mine = !lastFumble || lastFumble.by === user; result = { defense: true, forcedFumble: mine, fumbleRec: !mine, turnover: true, tackle: mine, yardsAllowed: Math.max(0, yardsFrom(lastFumble?.from ?? carrier)), quality: mine ? 0.95 : 0.85, text: mine ? 'FUMBLE! You knock it loose and your team recovers!' : 'FUMBLE! Your team recovers!' }; }
      else {
        const ya = Math.max(0, yardsFrom(carrier));
        const yr = yardsFrom(carrier);
        result = { defense: true, caught: mode === 'cover', tackle: by === user, tfl: by === user && yr < 0, yardsAllowed: ya, quality: Math.max(0.05, by === user ? (yr < 0 ? 0.88 : 0.7 - ya / 40) : 0.54 - ya / 30) /* a stuffed run is a win even when a teammate makes the stop */, text: by === user ? (yr < 0 ? `Tackle for a loss of ${-yr}!` : `You make the stop after ${ya} yards.`) : `${ya} yards allowed.` };
      }
    } else {
      if (why === 'int') result = { turnover: true, complete: false, yards: 0, quality: 0.03, text: 'INTERCEPTED!' };
      else if (why === 'incomplete') result = { complete: false, yards: 0, quality: 0.2, text: text ?? 'Incomplete.' };
      else if (why === 'sack') result = { sack: true, complete: false, yards: Math.min(-1, yardsFrom(qb)), quality: 0.06, text: 'SACKED!' };
      else if (why === 'fumble') result = { turnover: true, complete: false, yards: yardsFrom(lastFumble?.from ?? carrier), quality: 0.05, text: 'FUMBLE! Defense recovers.' };
      else {
        const y = yardsFrom(carrier);
        if (carrier === qb && qb.scramble) result = { scramble: true, complete: false, yards: y, quality: Math.max(0.05, 0.28 + y / 20), text: why === 'oob' ? `Scramble, out of bounds after ${y}.` : `Scramble for ${y}.` };
        else result = { complete: true, yards: y, quality: Math.max(0.05, 0.3 + y / 22 + (carrier?.broken ?? 0) * 0.05), text: why === 'oob' ? `Out of bounds after ${y}.` : null };
      }
    }
    gradeByRole(why);
    maybeFlag();
    if (globalThis.__playDebug) globalThis.__lastResult = { ...result, why2: why };
    if (user.injured && result) { result.injured = true; result.injuryId = user.injury?.id ?? null; }
    if (!def && result.complete && result.yards >= 20) snap(`${result.yards}-yard gain`, 100);
  };

  // Penalty flags: a yellow flag now and then, on either team. penYds moves the ball without counting in anyone's
  // stats (+ = toward the offense's goal), autoFirst = automatic first down. Half the distance near the goal.
  const usName = opts.teamName ?? 'your team';
  const themName = opts.oppName ?? 'the other team';
  const offName = m.defense ? themName : usName;
  const defName = m.defense ? usName : themName;
  const pickNum = (role) => { const e = ents.find((x) => x.role === role && !x.user); return e ? `#${e.mesh.userData.number ?? Math.floor(rnd(20, 99))}` : ''; };
  let freePlay = null; // offsides at the snap: the offense gets a free play
  const halfDist = (pen, ylAfter) => (pen > 0 ? Math.max(1, Math.min(pen, Math.floor(Math.max(1, ylAfter) / 2) || 1)) : pen);
  const flagShow = (msg) => setTimeout(() => { sfx.whistle(); hud.big('FLAG!', '#ffd43b', 1100); hud.say?.(msg, 3000); }, 450);
  const maybeFlag = () => {
    if (!result || result.turnover) return;
    const fl = (msg, patch) => { Object.assign(result, patch, { text: msg, flag: true }); flagShow(msg); };
    const def = m.defense;
    const gained = def ? (result.yardsAllowed ?? 0) : (result.yards ?? 0);
    // free play from an offsides at the snap: offense takes the 5 yards only if the play went badly
    if (freePlay) {
      const offenseGood = gained >= 5 || result.td;
      if (offenseGood) { result.text = `${result.text ?? ''} (Offsides on ${defName} declined.)`.trim(); flagShow(`Offsides on ${defName}, declined.`); }
      else fl(`Offsides on ${defName}. Free play! 5 yards.`, def ? { yardsAllowed: 0, caught: false, pd: false, sack: false, tfl: false, tackle: false, penYds: 5, quality: Math.min(result.quality, 0.4) }
        : { yards: 0, complete: false, sack: false, penYds: 5, quality: Math.max(result.quality, 0.45) });
      return;
    }
    if (Math.random() > (globalThis.__flagRate ?? 0.05)) return; // __flagRate: test hook
    const ylAfter = m.yardLine - gained;
    const passPlay = mode === 'pass' || mode === 'route' || mode === 'cover' || mode === 'rush';
    const opts2 = [];
    if (!def) {
      // ---- you're on offense
      if (result.complete === false && !result.sack && passPlay) {
        const spot = 12 + Math.floor(Math.random() * 22);
        opts2.push(() => fl(`Pass interference on ${defName} ${pickNum('CB')}! Spot foul, ${halfDist(spot, m.yardLine)} yards and a first down.`, { penYds: halfDist(spot, m.yardLine), autoFirst: true, quality: 0.6 }));
        opts2.push(() => fl(`Defensive holding on ${defName}. 5 yards and an automatic first down.`, { penYds: halfDist(5, m.yardLine), autoFirst: true, quality: 0.5 }));
        if (user === qb && t > 1.8) opts2.push(() => fl('Intentional grounding on you! Loss of down, 10 yards.', { penYds: -10, quality: 0.08 }));
        opts2.push(() => fl(`Illegal formation on ${offName}. 5 yards back.`, { penYds: -5, quality: 0.15 }));
      }
      if (result.sack) {
        opts2.push(() => fl(`Roughing the passer on ${defName}! The sack is wiped out. 15 yards, first down.`, { sack: false, yards: 0, penYds: halfDist(15, m.yardLine), autoFirst: true, quality: 0.5 }));
        opts2.push(() => fl(`Illegal contact downfield on ${defName}. No sack, 5 yards and a first down.`, { sack: false, yards: 0, penYds: halfDist(5, m.yardLine), autoFirst: true, quality: 0.45 }));
      }
      if (result.complete && gained >= 8) {
        opts2.push(() => fl(`Holding on ${offName} ${pickNum('OL')}. That ${gained}-yard gain comes back. 10 yards.`, { yards: 0, complete: false, penYds: -10, quality: 0.12 }));
        if (passPlay) opts2.push(() => fl(`Offensive pass interference! The catch is wiped out. 10 yards.`, { yards: 0, complete: false, penYds: -10, quality: 0.1 }));
        else opts2.push(() => fl(`Illegal block in the back on ${offName}. Ball comes back to the spot of the foul.`, { yards: Math.floor(gained / 2), penYds: -10, quality: 0.2 }));
      }
      if (result.complete && gained < 30) {
        opts2.push(() => fl(`Facemask on ${defName}! 15 more yards.`, { penYds: halfDist(15, ylAfter), autoFirst: true, quality: Math.max(result.quality, 0.55) }));
        opts2.push(() => fl(`Horse-collar tackle on ${defName}! Tack on 15.`, { penYds: halfDist(15, ylAfter), autoFirst: true, quality: Math.max(result.quality, 0.55) }));
        opts2.push(() => fl(`Late hit out of bounds! Unnecessary roughness on ${defName}, 15 yards.`, { penYds: halfDist(15, ylAfter), autoFirst: true, quality: Math.max(result.quality, 0.55) }));
        opts2.push(() => fl(`Chop block on ${offName}. 15 yards back.`, { yards: Math.min(gained, 0), complete: gained > 0 ? result.complete : false, penYds: -15, quality: 0.1 }));
      }
      if (Math.random() < 0.15) opts2.push(() => fl('Offsetting penalties. Nobody gains anything.', { yards: 0, complete: false, sack: false, penYds: 0, quality: 0.35 }));
    } else {
      // ---- you're on defense
      const coverUser = mode === 'cover';
      if ((result.pd || result.yardsAllowed === 0) && passPlay && !result.sack) {
        const spot = 12 + Math.floor(Math.random() * 22);
        opts2.push(() => fl(`Pass interference on ${coverUser && Math.random() < 0.6 ? 'you' : `${defName} ${pickNum('CB')}`}! Spot foul, ${halfDist(spot, m.yardLine)} yards.`, { pd: false, caught: false, yardsAllowed: 0, penYds: halfDist(spot, m.yardLine), autoFirst: true, quality: Math.min(result.quality, 0.22) }));
        opts2.push(() => fl(`Defensive holding on ${defName}. 5 yards, automatic first down.`, { pd: false, yardsAllowed: 0, penYds: halfDist(5, m.yardLine), autoFirst: true, quality: Math.min(result.quality, 0.35) }));
        opts2.push(() => fl(`Illegal shift on ${offName}. 5 yards back.`, { penYds: -5, quality: Math.max(result.quality, 0.65) }));
      }
      if (result.sack) {
        opts2.push(() => fl(`Roughing the passer${result.tackle ? ' on you' : ''}! No sack, 15 yards and a first down.`, { sack: false, tfl: false, yardsAllowed: 0, penYds: halfDist(15, m.yardLine), autoFirst: true, quality: 0.2 }));
        opts2.push(() => fl(`Holding on ${offName} while you got home. Declined, the sack stands!`, {}));
      }
      if ((result.tackle || result.caught) && gained >= 0 && !result.sack) {
        opts2.push(() => fl(`Facemask${result.tackle ? ' on you' : ` on ${defName}`}! 15 more yards.`, { penYds: halfDist(15, ylAfter), autoFirst: true, quality: Math.min(result.quality, 0.2) }));
        opts2.push(() => fl(`Unnecessary roughness on ${defName}. Late hit, 15 yards.`, { penYds: halfDist(15, ylAfter), autoFirst: true, quality: Math.min(result.quality, 0.25) }));
      }
      if (gained >= 8) {
        opts2.push(() => fl(`Holding on ${offName} ${pickNum('OL')}! That ${gained}-yard gain comes back. 10 yards.`, { yardsAllowed: 0, caught: false, tackle: false, tfl: false, penYds: -10, quality: Math.max(result.quality, 0.65) }));
        opts2.push(() => fl(`Offensive pass interference on ${offName}! Play wiped out, 10 yards.`, { yardsAllowed: 0, caught: false, penYds: -10, quality: Math.max(result.quality, 0.7) }));
        opts2.push(() => fl(`Illegal block in the back on ${offName}. Back to the spot of the foul.`, { yardsAllowed: Math.floor(gained / 2), penYds: -10, quality: Math.max(result.quality, 0.5) }));
      }
      if (Math.random() < 0.15) opts2.push(() => fl('Offsetting penalties. Nobody gains anything.', { yardsAllowed: 0, caught: false, pd: false, sack: false, tfl: false, penYds: 0, quality: 0.5 }));
    }
    if (opts2.length) opts2[Math.floor(Math.random() * opts2.length)]();
  };
  /** Flags before the snap: false starts, encroachment, delay of game. Returns true if the play is dead. */
  const preSnapFlag = (delay = false) => {
    const def = m.defense;
    let r = null;
    if (delay) r = { msg: `Delay of game on ${offName}! The play clock hit zero. 5 yards back.`, pen: -5 };
    else if (Math.random() < (globalThis.__flagRate ? 0.035 : 0.012)) {
      const list = [
        { msg: `False start on ${offName} ${pickNum('OL')}. 5 yards back.`, pen: -5 },
        { msg: `Encroachment on ${defName}. 5 free yards.`, pen: 5 },
        { msg: `Neutral zone infraction on ${defName}. 5 yards.`, pen: 5 },
        { msg: `Illegal motion on ${offName}. 5 yards back.`, pen: -5 },
      ];
      if (def && dtMode) list.push({ msg: 'You jumped offsides! 5 yards.', pen: 5 });
      r = list[Math.floor(Math.random() * list.length)];
    } else if (Math.random() < (globalThis.__flagRate ? 0.03 : 0.008)) {
      freePlay = true;
      setTimeout(() => { hud.big('FLAG! FREE PLAY', '#ffd43b', 1100); hud.say?.(`Flag at the snap: offsides on ${defName}. ${def ? 'They' : 'You'} have a free play!`, 2600); }, 50);
      return false;
    }
    if (!r) return false;
    const pen = r.pen > 0 ? halfDist(r.pen, m.yardLine) : r.pen;
    result = def
      ? { defense: true, yardsAllowed: 0, penYds: pen, quality: pen < 0 ? 0.62 : 0.32, text: r.msg, flag: true, presnap: true }
      : { complete: false, yards: 0, penYds: pen, quality: pen > 0 ? 0.5 : 0.15, text: r.msg, flag: true, presnap: true };
    phase = 'over';
    sfx.whistle();
    hud.big('FLAG!', '#ffd43b', 1400);
    hud.say?.(r.msg, 3000);
    hud.instr('');
    controls.setButtons([]);
    endPlay(ctx, finalize(result, m), { delay: 1800, color: '#ffd43b' });
    return true;
  };

  const startCelebration = () => {
    phase = 'celebrate';
    t = 0;
    const who = scorer;
    celebrate(who.mesh);
    hud.big('TOUCHDOWN!', '#4ade80', 2600);
    say(scorer.team === 'def' ? 'pick' : 'td');
    snap(scorer.team === (m.defense ? 'def' : 'off') ? (scorer.team === 'def' ? 'Pick six!' : 'Touchdown!') : 'They scored', 900);
    const userScored = scorer.team === (m.defense ? 'def' : 'off');
    crowd('td', userScored);
    ctx.hype?.(1, 5);
    // pyro: flame jets at the end zone corners and fireworks overhead
    const ezZ = scorer.team === 'off' ? goalZ - 5 : (100 - m.yardLine) + 5;
    for (const sx of [-1, 1]) fxList.push(flameJet(group, { x: sx * (FIELD_X + 2), z: ezZ }));
    const fwCols = [offColors[0], offColors[1], '#ffffff', '#ffd43b'];
    for (let i = 0; i < 5; i++) fxList.push(firework(group, { x: (Math.random() - 0.5) * 40, y: 22 + Math.random() * 12, z: ezZ - 10 - Math.random() * 10 }, fwCols[i % 4], 0.3 + i * 0.35));
    if (userScored) setTimeout(() => playMusic('groove', { bars: 4 }), 1500);
    sfx.touchdown();
    fx = confetti(scene, new THREE.Vector3(who.pos.x, 0, who.pos.z), [offColors[0], offColors[1], '#ffffff']);
    // teammates run over to join
    for (const e of ents) if (e !== who && e.team === who.team && dist(e.pos, who.pos) < 25) e.joinCeleb = true;
  };

  // ---------------- start
  const tips = {
    pass: ['Pick a play, then press SNAP (Space) when you are ready. Move your QB with the joystick (left side) or WASD.', 'Tap a receiver (or press 1-5) to throw. Green ring = open.', 'Red ring under a defender = they are about to tackle. Get rid of it or run!'],
    run: ['Pick a run play and press SNAP (Space). Follow the green arrow to the hole.', 'Move with the joystick / WASD. Hold SPRINT (Shift) for speed.', 'When a defender flashes a red ring, they are about to lunge: hit JUKE or SPIN right then. STIFF ARM bullies them.'],
    route: ['Pick your route and press SNAP (Space). Run it yourself with the joystick, or let go and you will run it automatically.', 'Get open, tap CALL FOR IT, then press CATCH as the ball arrives.', 'After the catch, juke, spin and stiff-arm your way upfield.'],
    cover: ['Pick a coverage. Stay close to your receiver (blue line) with the joystick.', 'When the ball is in the air, press SWAT / PICK as it arrives.', 'Press TACKLE near the ball carrier to bring them down.'],
    runD: ['They are running at you. Come up and make the tackle.', 'Move with the joystick, press TACKLE when close. Watch for jukes!'],
    rush: ['A lineman locks onto you at the snap. Push the stick toward the QB to build LEVERAGE.', 'Then hit RIP, SWIM or BULL RUSH to break free. More leverage = better odds.', 'Free? Chase the QB and press SACK. Near the line when he throws? BAT IT down.'],
    runStop: ['They run right at you. Win your block with RIP, SWIM or BULL RUSH.', 'Find the ball carrier and press TACKLE. Behind the line = tackle for loss!'],
  };
  ctx.pickerEl = null;
  const startTipThenPick = () => {
    if (opts.showTips) {
      const box = document.createElement('div');
      box.className = 'tipbox';
      box.innerHTML = `<div class="tip-k">How to play</div><div class="tip-t">${{ pass: 'Quarterback', run: 'Ball Carrier', route: 'Receiver', cover: 'Cornerback', runD: 'Run Defense', rush: 'Pass Rush', runStop: 'Run Stop' }[mode]}</div>${tips[mode].map((l) => `<p>${l}</p>`).join('')}<div class="tip-go">Tap to start</div>`;
      hud.el.append(box);
      const go = (ev) => { ev?.preventDefault?.(); ev?.stopPropagation?.(); box.remove(); opts.markTip?.(); showPicker(); window.removeEventListener('keydown', key); };
      const key = (ev) => { if (ev.key === ' ' || ev.key === 'Enter') go(ev); };
      box.addEventListener('pointerdown', go);
      window.addEventListener('keydown', key);
    } else showPicker();
  };
  // Show a preview formation behind the picker.
  rig(camera, 0, -4, 0, { zoom: 1.35, snap: true });
  startTipThenPick();

  // ---------------- main loop
  return (dt) => {
    t += dt;
    // visual effects must never be able to freeze a play
    try { if (fx && !fx(dt)) fx = null; } catch (err) { console.warn('fx error', err); fx = null; }
    for (let i = fxList.length - 1; i >= 0; i--) {
      let keep = false;
      try { keep = fxList[i](dt); } catch (err) { console.warn('fx error', err); }
      if (!keep) fxList.splice(i, 1);
    }
    if (phase === 'replay') { runReplay(dt); return; }
    if (bphys.active && !flight && !(holder && phase !== 'live')) bphys.step(dt);
    if (holder && phase !== 'live') { if (holder.secure > 0) secureBall(holder, dt); else carryBall(holder); }
    if (phase === 'live' || phase === 'dead' || phase === 'celebrate') record(dt);
    if (phase === 'pick' || phase === 'over') return;
    if (phase === 'pre') {
      rig(camera, (user?.pos.x ?? 0) * 0.4, -4, dt, { zoom: mode === 'pass' ? 1.1 : 0.95, k: 3 });
      if (holeArrow) holeArrow.material.opacity = 0.6 + Math.sin(t * 8) * 0.25;
      // Offense snaps the ball yourself (SNAP button / Space); the play clock snaps it for you at 0.
      // Defense: the offense snaps it after a short moment.
      if (!m.defense && !snapCalled) {
        const left = Math.ceil(PLAY_CLOCK - (performance.now() - preStart) / 1000); // real seconds
        if (left !== clockShown) { clockShown = left; hud.playClock?.(Math.max(0, left)); if (left <= 5 && left > 0) sfx.click(); }
      }
      if (!m.defense && !snapCalled && performance.now() - preStart > PLAY_CLOCK * 1000) { hud.playClock?.(null); preSnapFlag(true); return; }
      if (m.defense) hud.playClock?.(Math.max(1, Math.ceil(7 - t * (ART !== 'off' ? 2.6 : 4))));
      if (m.defense ? t > (ART !== 'off' ? 2.3 : 1.4) : snapCalled) {
        hud.playClock?.(null);
        if (preSnapFlag()) return;
        phase = 'live'; t = 0; snapCalled = false; setButtonsFor();
        sfx.whistle();
        say(m.defense ? 'snapDef' : 'snap');
        stopMusic();
        react('snap', m.defense ? userHome : !userHome);
        hud.instr('');
        for (const e of ents) setPose(e.mesh, null);
        if (!runO && mode !== 'rush') {
          // Pass protection: every lineman fires out and locks onto a rusher at the snap.
          const free = blockers.slice();
          for (const d of defenders.filter((x) => x.role === 'DL')) {
            const o = nearest(d, free);
            if (o) { o.engaged = d; d.engagedBy = o; d.shed = -0.3; setPose(o.mesh, 'block'); setPose(d.mesh, 'block'); free.splice(free.indexOf(o), 1); }
          }
        }
        if (mode === 'rush') {
          // Pass rush: the nearest lineman locks onto you right away. Win the battle!
          const o = nearest(user, blockers);
          if (o) { o.engaged = user; user.engagedBy = o; setPose(o.mesh, 'block'); setPose(user.mesh, 'block'); }
        }
        if (runO) {
          // Run blocking: every lineman fires out and locks onto the nearest defender at the snap.
          // Down linemen first (closest lineman takes each), the spare lineman climbs to a linebacker.
          const lock = (o, d) => { o.engaged = d; d.engagedBy = o; d.shed = -0.4; setPose(o.mesh, 'block'); setPose(d.mesh, 'block'); };
          const free = blockers.slice();
          for (const d of defenders.filter((x) => x.role === 'DL')) {
            const o = nearest(d, free);
            if (o) { lock(o, d); free.splice(free.indexOf(o), 1); }
          }
          const lbs = defenders.filter((x) => x.role === 'LB' && !x.user);
          for (const o of free) { const d = nearest(o, lbs.filter((x) => !x.engagedBy)); if (d) o.blockTarget = d; }
          for (const r of receivers) {
            if (r === rb || r.user) continue;
            const pool = r.role === 'TE' ? lbs.filter((x) => !x.engagedBy && !blockers.some((o) => o.blockTarget === x)) : defenders.filter((x) => (x.role === 'CB' || x.role === 'S') && !x.engagedBy && !x.user);
            const d = nearest(r, pool);
            if (d && dist(r.pos, d.pos) < 12 && (r.role === 'TE' || Math.random() < 0.7)) r.blockTarget = d;
          }
        }
        artAtSnap();
        for (const l of tellLabels) l.parent?.remove(l);
        if (audibleBox) { audibleBox.remove(); audibleBox = null; }
        setButtonsFor();
      }
      for (const e of ents) animateRun(e.mesh, dt, 0);
      ball.position.set(qb.pos.x + 0.3, 1.2, qb.pos.z - 0.4);
      return;
    }

    if (phase === 'live') {
      if (gameSecs !== null && gameSecs > 0) {
        const before = Math.floor(gameSecs);
        gameSecs = Math.max(0, gameSecs - dt);
        if (Math.floor(gameSecs) !== before) hud.clock?.(clockText());
      }
      moves.juke = Math.max(0, moves.juke - dt); moves.jukeCd = Math.max(0, moves.jukeCd - dt);
      moves.spin = Math.max(0, moves.spin - dt); moves.spinCd = Math.max(0, moves.spinCd - dt);
      moves.stiff = Math.max(0, moves.stiff - dt); moves.stiffCd = Math.max(0, moves.stiffCd - dt);
      moves.slow = Math.max(0, moves.slow - dt);
      // ---- user control
      const c = controls.state;
      const [uh0, uw0] = POS_SIZE[opts.position] ?? POS_SIZE[user.role] ?? [73, 210];
      const userSize = Math.max(0.9, Math.min(1.06, 1 - ((user.wLb - uw0) / uw0) * 0.3 + (user.hIn - uh0) * 0.003));
      const traitSpeed = (has('gear2') && c.sprint ? 1.08 : 1) * (has('escape') && user === qb && carrier === qb ? 1.08 : 1) * (has('deep') && mode === 'route' && user.pos.z < -10 ? 1.07 : 1) * (has('closing') && flight && user.team === 'def' ? 1.1 : 1);
      const userSpeed = traitSpeed * BASE_SPEED[user.role] * userSize * (0.86 + (st.speed ?? 60) / 100 * 0.28) * wfx.speed * (1 - surf.sink) * (c.sprint ? 0.98 + 0.17 * Math.max(0, Math.min(1, (3.6 - (user.sprintT ?? 0)) / 1.6)) : 0.95) * (moves.slow > 0 ? 0.55 : 1) * (moves.spin > 0 ? 0.8 : 1) * (opts.hurt ?? 1);
      user.sprintT = Math.max(0, (user.sprintT ?? 0) + (c.sprint ? dt : -dt * 0.6)); // sprint fades after ~2 s held
      if (user.out > 0 || user.rise > 0) { stillDown(user, dt); user.vel.x *= 0.8; user.vel.z *= 0.8; }
      else if (moves.dive) {
        moves.dive += dt;
        const dir = norm(user.vel.x, user.vel.z || -1);
        user.vel.x = dir.x * 7; user.vel.z = dir.z * 7;
        if (moves.dive > Math.min(0.75, 0.45 * Math.sqrt(surf.slide))) { user.down = true; knockDown(user.mesh, 1); whistle('tackle'); } // slick ground: the dive slides on
      } else if (user.lunge > 0) {
        user.lunge -= dt;
        user.vel.x = user.lungeDir.x * 9.5; user.vel.z = user.lungeDir.z * 9.5;
        if (carrier && carrier !== user && dist(user.pos, carrier.pos) < 1.15) tryTackle(user, carrier);
        else if (!carrier && holder === qb && !flight && passD && dist(user.pos, qb.pos) < (has('closer') ? 1.55 : 1.2)) {
          const finishSack = () => { qb.down = true; user.lunge = 0; const big = hardHit(user, qb); if ((big && Math.random() < 0.35) || globalThis.__forceFumble) { hud.big('STRIP SACK!', '#4ade80', 1100); sfx.cheer(); snap('Strip sack!', 200); fumbleOut(qb, user); return; } hud.big('SACK!', '#4ade80', 1100); sfx.cheer(); snap('Sack!', 200); whistle('sack', user); };
          if (qteOn && qteUsed < 1) {
            // the QB tries to slip out: time it to wrap him up
            user.lunge = 0; user.vel.x = 0; user.vel.z = 0;
            startQte('ring', 'WRAP HIM UP!', (ok) => {
              if (phase !== 'live') return;
              if (ok) finishSack();
              else { hud.big('HE SLIPS AWAY!', '#f87171', 800); user.out = 0.9; knockDown(user.mesh, 1); qb.vel.x += (Math.random() < 0.5 ? -1 : 1) * 6; }
            });
          } else finishSack();
        }
        if (user.lunge <= 0 && phase === 'live' && !qteActive) { user.out = 1.0; knockDown(user.mesh, 1); }
      } else if (user.engagedBy) {
        // locked up with a blocker: drive into him to build leverage, use moves to break free
        rush.cd = Math.max(0, rush.cd - dt);
        rush.stun = Math.max(0, rush.stun - dt);
        const o = user.engagedBy;
        const toward = user.role === 'CB' ? (c.active ? 0.85 : 0.2) : c.active ? Math.max(0, -(c.z) * 0.8 + 0.2) : 0.15;
        if (!(user.role === 'CB' && rush.stun > 0)) rush.lev = Math.min(1, rush.lev + dt * toward * (user.role === 'CB' ? 0.32 * Math.max(0.6, Math.min(1.5, (user.mass ?? 190) / (o.mass ?? 200))) : 1) * (0.5 + (st.strength ?? 60) / 200) * (has('motor') ? 1.4 : 1) * (play.lev ?? 1));
        if (levBar) levBar.querySelector('i').style.width = `${rush.lev * 100}%`;
        const push = c.active ? 1.6 : 0.6;
        moveToward(user, o.pos.x + c.x * 1.2, o.pos.z + 0.2, push, dt, 10);
        faceToward(user.mesh, o.pos.x, o.pos.z);
        if (user.role === 'CB' && rush.lev >= 1) { // shed the receiver's block
          o.engaged = null; user.engagedBy = null; o.blockTarget = null; o.out = 0.35; setPose(user.mesh, null); setPose(o.mesh, null);
          rush.lev = 0; hud.big('SHED THE BLOCK!', '#4ade80', 600); sfx.hit?.();
        }
        if (t > 4.2) { o.engaged = null; user.engagedBy = null; setPose(user.mesh, null); setPose(o.mesh, null); }
      } else if (c.active) {
        if (rush.burst > 0) rush.burst -= dt;
        // turf kicks up behind you when you sprint
        dustT -= dt;
        if (c.sprint && dustT <= 0 && Math.hypot(user.vel.x, user.vel.z) > 6) { dustT = 0.22; fxList.push(dustPuff(group, user.pos, 3)); }
        // momentum: at full speed you can't turn on a dime. Sharp cuts take a wider arc and bleed speed
        // (more on a wet field); agile players (speed rating) cut sharper.
        const curSp = Math.hypot(user.vel.x, user.vel.z);
        let cutK = 1;
        if (curSp > 4.5 && Math.hypot(c.x, c.z) > 0.2) {
          const cosA = (user.vel.x * c.x + user.vel.z * c.z) / (curSp * Math.hypot(c.x, c.z));
          const ang = Math.acos(Math.max(-1, Math.min(1, cosA)));
          const agility = 0.75 + (st.speed ?? 60) / 240;
          cutK = 1 - Math.max(0, Math.min(0.6, (ang - 0.5) * 0.38 * (curSp / 8) / agility)) * Math.pow(1 / surf.grip, 1.5);
          if (ang > 1.3 && curSp > 6.5) { user.vel.x *= 1 - dt * 2.2; user.vel.z *= 1 - dt * 2.2; } // plant and redirect
        }
        moveToward(user, user.pos.x + c.x * 5, user.pos.z + c.z * 5, userSpeed * (rush.burst > 0 ? 1.25 : 1) * Math.min(1, Math.hypot(c.x, c.z) + 0.15), dt, 26 * cutK);
        if (moves.juke > 0.15) { user.vel.x += moves.jukeDir * 7 * dt * 10; }
      } else {
        // assists when you let go of the stick
        if (loose && !loose.rec) moveToward(user, ball.position.x + bphys.v.x * 0.25, ball.position.z + bphys.v.z * 0.25, userSpeed, dt, 22);
        else if (user.team === 'off' && user.route && !carrier && !flight) { user.s += userSpeed * dt; const p = routePoint(user, user.s); moveToward(user, p.x, p.z, userSpeed, dt, 22); }
        else if (user === carrier) moveToward(user, play.hole && user.pos.z > -1 ? play.hole[1] : user.pos.x, user.pos.z - 4, userSpeed * 0.85, dt, 20);
        else if (user === rb && mode === 'run' && !carrier) moveToward(user, play.pitch ? play.hole[0] * 0.6 : qb.pos.x + 0.3, play.pitch ? rb.start.z - 0.5 : qb.pos.z - 0.3, 6, dt);
        else if (user === rb && play.screen !== undefined && !carrier) moveToward(user, play.screen * 7, 2.2, 5, dt);
        else if (user.team === 'def' && user.man) { const r = user.man; moveToward(user, r.pos.x - r.vel.x * 0.4, r.pos.z - r.vel.z * 0.4 - 0.8, userSpeed * 0.85, dt); }
        else if (user.team === 'def' && carrier) pursue(user, carrier, dt, 0.8);
        else { user.vel.x *= 0.85; user.vel.z *= 0.85; }
      }
      if (dtMode || mode === 'runD') setButtonsFor();
      // A QB who takes off past the line of scrimmage on a pass play is a runner now: no more passing, and every
      // defender comes after him (before this he was still 'about to throw', so nobody chased and a tackle was a sack).
      if (mode === 'pass' && holder === qb && !carrier && !thrown && !flight && qb.pos.z < -0.4) {
        carrier = qb; qb.runner = true; qb.scramble = true;
        if (user === qb) { setButtonsFor(); hud.big('SCRAMBLE!', '#ffd23a', 600); }
      }
      // ---- AI
      for (const e of ents) {
        if (e.user || e.down) continue;
        if (e.joinCeleb) continue;
        if (loose) { chaseLoose(e, dt); continue; }
        if (e.team === 'off') aiOffense(e, dt);
        else aiDefense(e, dt);
        if (e.jukeCd > 0) e.jukeCd -= dt;
        if (e.juking > 0) e.juking -= dt;
      }
      // ---- heads track the action: the ball in the air or on the ground, the ball carrier, the quarterback
      const ballUp = flight || loose || bphys.active;
      for (const e of ents) {
        let tg = null;
        const at = (o) => { const v = (e.lookV ??= { x: 0, y: 1.4, z: 0 }); v.x = o.pos.x; v.y = 1.35; v.z = o.pos.z; return v; };
        if (ballUp) tg = ball.position;
        else if (carrier && e !== carrier) tg = at(carrier);
        else if (holder === qb && e !== qb && e.team === 'def') tg = e.man && !e.blitz && e.role === 'CB' ? at(e.man) : at(qb);
        else if (holder === qb && e.team === 'off' && e.improv) tg = at(qb); // freelancing receivers find the QB
        setLookAt(e.mesh, tg);
      }
      // ---- lunges (AI)
      for (const e of defenders) {
        if (e.user || e.lunge <= 0) continue;
        e.lunge -= dt;
        e.vel.x = e.lungeDir.x * 9; e.vel.z = e.lungeDir.z * 9;
        const target = carrier ?? holder;
        if (target && target.team === 'off' && dist(e.pos, target.pos) < 1.0) {
          if (target === qb && holder === qb && !carrier) {
            // sack (QB can still dodge with moves if he is the user and scrambling)
            if (user === qb && (moves.juke > 0 || moves.spin > 0 || (has('pocket') && Math.random() < 0.3))) { e.out = 1.2; knockDown(e.mesh, 1); hud.big('ESCAPED!', '#4ade80', 600); }
            else if (user === qb && qteOn && qteUsed < 1) {
              // you feel the rusher grab you: mash to break free
              e.lunge = 0; e.vel.x = 0; e.vel.z = 0; qb.vel.x *= 0.2; qb.vel.z *= 0.2;
              startQte('mash', 'BREAK THE SACK!', (ok) => {
                if (phase !== 'live') return;
                if (ok) { e.out = 1.4; flatten(e, qb, 0.6); hud.big('ESCAPED!', '#4ade80', 800); ctx.cinematic?.(() => qb.pos, 0.9); snap('Escapes the sack!', 150); }
                else { qb.down = true; const big = hardHit(e, qb); playAction(e.mesh, 'tackle'); sfx.hit(); ctx.shake(0.4); if (big && Math.random() < 0.25) fumbleOut(qb, e); else whistle('sack'); }
              });
            }
            else { qb.down = true; const big = hardHit(e, qb); playAction(e.mesh, 'tackle'); sfx.hit(); ctx.shake(0.4); if (big && Math.random() < 0.25) fumbleOut(qb, e); else whistle('sack'); }
          } else tryTackle(e, target);
          e.lunge = 0;
        }
        if (e.lunge <= 0 && phase === 'live' && e.out <= 0) { e.out = 1.4 + Math.random() * 0.9; knockDown(e.mesh, 1); } // whiffed: face down in the grass
      }
      for (const [e, r] of tellRings) { r.visible = e.tell > 0 || e.lunge > 0; r.scale.setScalar(1 + Math.sin(t * 30) * 0.15); }
      updateWrap(dt);
      // ---- separation & physics
      for (let i = 0; i < ents.length; i++) {
        const a = ents[i];
        for (let j = i + 1; j < ents.length; j++) {
          const b = ents[j];
          if (a.engaged === b || b.engaged === a) continue;
          const dx = b.pos.x - a.pos.x;
          const dz = b.pos.z - a.pos.z;
          const d2 = dx * dx + dz * dz;
          if (d2 < 0.55 && d2 > 1e-5) {
            const d = Math.sqrt(d2);
            const push = (0.75 - d);
            const wa = b.mass / (a.mass + b.mass); // the lighter player gets moved more
            // a real collision makes both players stagger
            const rel = Math.hypot(a.vel.x - b.vel.x, a.vel.z - b.vel.z);
            if (rel > 3.5 && !(a.bumpCd > t) && !(b.bumpCd > t)) {
              a.bumpCd = b.bumpCd = t + 0.6;
              // an arm tackle / glancing hit costs the ball carrier speed (and shoves him off line)
              const cc = a === carrier ? a : b === carrier ? b : null;
              if (cc && a.team !== b.team && !cc.wrap) { cc.vel.x = cc.vel.x * 0.72 + (cc === a ? -dx : dx) / d * 1.2; cc.vel.z *= 0.72; if (cc.user) moves.slow = Math.max(moves.slow, 0.12); }
              bump(a.mesh, { x: -dx / d, z: -dz / d }, Math.min(1.6, rel / 6) * wa * 2);
              bump(b.mesh, { x: dx / d, z: dz / d }, Math.min(1.6, rel / 6) * (1 - wa) * 2);
            }
            a.pos.x -= (dx / d) * push * wa; a.pos.z -= (dz / d) * push * wa;
            b.pos.x += (dx / d) * push * (1 - wa); b.pos.z += (dz / d) * push * (1 - wa);
          }
        }
      }
      for (const e of ents) {
        if (e.down) { e.vel.x *= 0.8; e.vel.z *= 0.8; }
        footing(e, dt);
        e.pos.x += e.vel.x * dt;
        e.pos.z += e.vel.z * dt;
        if (e !== carrier) clampPos(e.pos);
        e.mesh.position.set(e.pos.x, 0, e.pos.z);
        const sp = Math.hypot(e.vel.x, e.vel.z);
        if (sp > 0.6 && !e.mesh.userData.u.back && e.lunge <= 0 && e.tell <= 0) faceToward(e.mesh, e.pos.x + e.vel.x, e.pos.z + e.vel.z);
        if (e.jam > 0) e.jam -= dt;
        animateRun(e.mesh, dt, e.stuck > 0 ? 6 : e.engaged || e.engagedBy ? 0.3 : sp);
        // the ground answers: turf crumbs / mud / snow on every body impact, a spray behind fast runners
        const gh = e.mesh.userData.u.groundHit ?? 0;
        if (gh > (e.ghSeen ?? 0)) { e.ghSeen = gh; fxList.push(dustPuff(group, e.pos, surf.debris === 'mud' || surf.debris === 'snow' ? 10 : 6)); }
        if ((e.user || e === carrier) && sp > 5.5 && surf.debris !== 'grass' && Math.random() < dt * 3) fxList.push(dustPuff(group, e.pos, 2));
        if (fw) {
          // cleats tear up the turf; going down leaves a slide mark and a dirtier uniform
          e.stepT = (e.stepT ?? Math.random() * 0.3) - dt;
          if (sp > 2.5 && e.stepT <= 0) { e.stepT = wetGame || snowGame ? 0.15 : 0.3; e.foot = -(e.foot ?? 1); fw.step(e.pos.x + e.foot * 0.2, e.pos.z); }
          if (e.engaged && Math.random() < dt * (wetGame ? 2 : 0.8)) fw.divot(e.pos.x, e.pos.z, wetGame ? 2 : 1);
          const dn = isDown(e.mesh);
          if (dn && !e.wasDown) { fw.slide(e.pos.x, e.pos.z, e.vel.x || 0.01, e.vel.z || 1, wetGame || snowGame ? 2.6 : 1.4); addWear(e.mesh, wetGame ? 0.25 : 0.15, opts.blood !== false && Math.random() < 0.06 ? 0.4 : 0); }
          e.wasDown = dn;
        }
      }
      // QB under pressure (when the user is QB and holding the ball)
      if (holder === qb && !thrown && user === qb && !qb.runner && qb.pos.z < -0.2) { qb.runner = true; carrier = qb; setButtonsFor(); }
      // coverage rings (open / covered) for the QB
      if (user === qb && !thrown) for (const r of receivers) if (r.ring) { const sep = Math.min(...defenders.map((d) => dist(d.pos, r.pos))); r.ring.material.color.set(sep > 3 ? '#4ade80' : sep > 1.6 ? '#fbbf24' : '#f87171'); r.ring.visible = !wfx.fog || t > 1; }
      // ---- ball
      if (flight) {
        const f = Math.min(1, (t - flight.t0) / flight.T);
        const x = flight.from.x + (flight.to.x - flight.from.x) * f;
        const z = flight.from.z + (flight.to.z - flight.from.z) * f;
        const y1 = flight.endY ?? 1.3;
        ball.position.set(x, 1.6 + (y1 - 1.6) * f + 4 * flight.H * f * (1 - f), z);
        if (!flight.pitch) { trail ??= makeTrail(group); trail.push(ball.position); }
        lastVel.set((flight.to.x - flight.from.x) / flight.T, (y1 - 1.6 + 4 * flight.H * (1 - 2 * f)) / flight.T, (flight.to.z - flight.from.z) / flight.T);
        ballSkills(dt);
        orientInFlight(ball, lastVel, (t - flight.t0) * (flight.pitch ? 9 : 48), flight.pitch ? 0.12 : flight.wobble ?? 0.03, t);
        ball.userData.shadow.position.set(x, 0.03, z);
        if (f >= 1) resolveFlight();
      } else if (holder) {
        if (holder.secure > 0) secureBall(holder, dt); else carryBall(holder);
        trail?.fade();
      } else if (loose) updateLoose(dt);
      releaseReach(dt);
      // ---- end conditions
      if (play.qbRun && t > 0.35 && !carrier && holder === qb) { carrier = qb; qb.runner = true; }
      if (phase === 'live' && carrier && !carrier.down) {
        if (carrier.team === 'off' && carrier.pos.z <= goalZ) whistle('td');
        else if (Math.abs(carrier.pos.x) > FIELD_X) whistle(carrier.team === 'def' ? 'int' : 'oob');
        else if (carrier.team === 'def' && !carrier.user) whistle('int'); // AI interception ends the play
        else if (carrier.team === 'def' && carrier.user) {
          // Your interception return: run it back toward the other end zone.
          if (carrier.pos.z >= 100 - m.yardLine) whistle('td');
          else {
            const hit = ents.find((o) => o.team === 'off' && !o.down && dist(o.pos, carrier.pos) < 1.0);
            if (hit && !(moves.juke > 0 || moves.spin > 0)) { carrier.down = true; knockDown(carrier.mesh, 1); whistle('int'); }
          }
        }
      }
      if (phase === 'live' && t > 18 && !loose) whistle(carrier ? 'tackle' : thrown ? 'incomplete' : 'sack');
      setButtonsFor();
      // ---- camera
      const focus = loose ? { x: ball.position.x, z: ball.position.z } : carrier ? carrier.pos : flight ? { x: ball.position.x, z: ball.position.z } : user.pos;
      let zoom = mode === 'pass' && !thrown && !carrier ? 1.05 : carrier ? (carrier === user ? 0.66 : 0.74) : 0.9;
      // keep YOU in the shot too when the action is somewhere else (a defender chasing, a receiver waiting on the ball)
      let fx = focus.x, fz = focus.z;
      if (focus !== user.pos && !user.down) {
        const d = Math.hypot(user.pos.x - focus.x, user.pos.z - focus.z);
        if (d < 26) { fx = focus.x * 0.7 + user.pos.x * 0.3; fz = focus.z * 0.7 + user.pos.z * 0.3; zoom = Math.max(zoom, 0.62 + d / 38); }
      }
      zoom = Math.min(1.25, zoom);
      // lead the runner the way he is going: less look-ahead when he is retreating or the defense has the ball
      const mover = carrier ?? user;
      const ahead = carrier?.team === 'def' ? -6 : mover.vel.z > 1 ? 2.5 : 7;
      rig(camera, fx, Math.min(22, fz), dt, { zoom, k: 5, ahead });
      return;
    }

    // ---- after the whistle
    for (const e of ents) {
      if (e.joinCeleb && scorer) {
        const d = dist(e.pos, scorer.pos);
        if (d > 1.5) { moveToward(e, scorer.pos.x, scorer.pos.z, 7, dt); e.pos.x += e.vel.x * dt; e.pos.z += e.vel.z * dt; e.mesh.position.set(e.pos.x, 0, e.pos.z); faceToward(e.mesh, scorer.pos.x, scorer.pos.z); animateRun(e.mesh, dt, Math.hypot(e.vel.x, e.vel.z)); }
        else { if (!e.cheering) { e.cheering = true; celebrate(e.mesh, 'pump'); } animateRun(e.mesh, dt, 0); }
      } else { e.vel.x *= 0.9; e.vel.z *= 0.9; animateRun(e.mesh, dt, 0); }
    }
    if (phase === 'celebrate') {
      if (t < 2.6) {
        // orbit camera around the scorer
        const a = t * 0.9;
        camera.position.set(scorer.pos.x + Math.sin(a) * 9, 4.5, scorer.pos.z + Math.cos(a) * 9);
        camera.lookAt(scorer.pos.x, 1.2, scorer.pos.z);
      } else {
        // crowd cam: the fans going wild
        const side = scorer.pos.x >= 0 ? 1 : -1;
        const k = t - 2.6;
        camera.position.set(side * (22 + k * 2), 3 + k, scorer.pos.z + 4 - k * 3);
        camera.lookAt(side * 44, 9, scorer.pos.z - 4 - k * 3);
      }
      if (t > 4.2) { phase = 'over'; endPlay(ctx, Object.assign(finalize(result, m), { highlights }), { delay: 300, beforeDone: replayPrompt }); }
      return;
    }
    if (phase === 'dead') {
      const focus = carrier?.pos ?? user.pos;
      rig(camera, focus.x * 0.85, focus.z, dt, { zoom: 0.9, k: 3 });
      // players piling on
      for (const e of ents) {
        if (!e.pile || e.pile.done) continue;
        if (t < e.pile.at) continue;
        const dd = Math.hypot(e.pile.x - e.pos.x, e.pile.z - e.pos.z);
        if (dd > 1.3) {
          const sp = 7 * dt / dd;
          e.pos.x += (e.pile.x - e.pos.x) * sp; e.pos.z += (e.pile.z - e.pos.z) * sp;
          e.mesh.position.set(e.pos.x, 0, e.pos.z);
          faceToward(e.mesh, e.pile.x, e.pile.z);
          animateRun(e.mesh, dt, 7);
        } else {
          e.pile.done = true;
          ragdoll(e.mesh, norm(e.pile.x - e.pos.x, e.pile.z - e.pos.z), 0.45);
          fxList.push(dustPuff(group, e.pile, 8));
          sfx.hit();
        }
      }
      // after-the-whistle shoving match
      if (scuffle) {
        scuffle.t += dt;
        const { a, b } = scuffle;
        faceToward(a.mesh, b.pos.x, b.pos.z); faceToward(b.mesh, a.pos.x, a.pos.z);
        const dd = dist(a.pos, b.pos);
        if (dd > 1.0) { a.pos.x += (b.pos.x - a.pos.x) * dt * 1.5; a.pos.z += (b.pos.z - a.pos.z) * dt * 1.5; a.mesh.position.set(a.pos.x, 0, a.pos.z); animateRun(a.mesh, dt, 3); }
        else if (Math.floor(scuffle.t * 3) !== scuffle.k) {
          scuffle.k = Math.floor(scuffle.t * 3);
          const s1 = scuffle.k % 2 ? a : b;
          const s2 = s1 === a ? b : a;
          playAction(s1.mesh, 'stiff', { dur: 0.3 });
          const n2 = norm(s2.pos.x - s1.pos.x, s2.pos.z - s1.pos.z);
          s2.pos.x += n2.x * 0.5; s2.pos.z += n2.z * 0.5; s2.mesh.position.set(s2.pos.x, 0, s2.pos.z);
          ctx.shake(0.08);
        }
      }
      if (t > (user.injured ? 5.6 : 1.6)) { phase = 'over'; endPlay(ctx, Object.assign(finalize(result, m), { highlights }), { delay: 900, beforeDone: replayPrompt }); }
    }
  };

}
