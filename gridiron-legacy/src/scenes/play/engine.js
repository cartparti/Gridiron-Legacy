// Free-control play engine. Every key moment becomes a full 11-on-11 play: pick a play from the
// playbook, then control your player from the snap to the whistle with the joystick (or WASD).
//
// AI is deliberately readable: defenders crouch and flash a red ring for a moment before they
// lunge for a tackle ("tell"), blockers visibly lock up with rushers, defensive backs backpedal
// and turn their heads, and everyone takes pursuit angles toward the ball carrier.
//
// Returns the same result objects as the old minigames, so the game simulation is unchanged.
import * as THREE from 'three';
import { makePlayer, animateRun, faceToward, setPose, playAction, celebrate, knockDown, isDown, setHop, makeBall, makeRing, makeLabel, makeRouteLine, confetti, ragdoll, bloodBurst, dustPuff } from '../actors.js';
import { rig, endPlay, finalize, weatherFx, gaussR } from '../minigames/common.js';
import { makeControls } from './controls.js';
import { PLAYS, OFF_FORMATION, OL_X, playMode, dealPlays } from '../../data/playbook.js';
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
  const call = opts.call;
  const wfx = weatherFx(m);
  const offColors = m.defense ? opts.oppColors : opts.teamColors;
  const defColors = m.defense ? opts.teamColors : opts.oppColors;
  const offUniform = m.defense ? opts.oppUniform : opts.teamUniform;
  const defUniform = m.defense ? opts.teamUniform : opts.oppUniform;
  const goalZ = -m.yardLine;
  const backLine = goalZ - 9.5;
  const clampPos = (p) => { p.x = Math.max(-FIELD_X - 1, Math.min(FIELD_X + 1, p.x)); p.z = Math.max(backLine, Math.min(25, p.z)); return p; };
  // Defenders get faster on harder settings / risky calls (tolerance is lower).
  const defBoost = (1.08 - (tol - 1) * 0.12) * wfx.speed;

  // ---------------- entities
  const ents = [];
  const add = (team, role, slot, x, z, extra = {}) => {
    const [n0, n1] = NUMBERS[role];
    const isUser = !!extra.user;
    const colors = team === 'off' ? offColors : defColors;
    const mesh = makePlayer(colors, {
      highlight: isUser, number: isUser && opts.number !== undefined ? opts.number : extra.number ?? Math.floor(rnd(n0, n1 + 1)),
      uniform: team === 'off' ? offUniform : defUniform, look: isUser ? opts.look : undefined, position: role,
    });
    mesh.position.set(x, 0, z);
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
      maxSpeed: BASE_SPEED[role] * (team === 'def' ? defBoost : wfx.speed) * rnd(0.97, 1.03) * (isUser ? 1 : sizeSpeed),
      user: isUser, route: null, s: 0, engaged: null, out: 0, tell: 0, lunge: 0, lungeDir: null, down: false, ...extra,
    };
    ents.push(e);
    return e;
  };

  // ---------------- choose user + formation
  const userRole = { pass: 'QB', run: type === 'qb_scramble' ? 'QB' : 'RB', route: 'WR', cover: 'CB', runD: 'CB', rush: 'DL', runStop: 'DL' }[mode];
  const runO = mode === 'run' || mode === 'runD' || mode === 'runStop'; // the offense runs the ball
  const passD = mode === 'cover' || mode === 'rush'; // you defend a pass play
  const dtMode = mode === 'rush' || mode === 'runStop';
  let plays = dealPlays(mode, call);
  if (type === 'qb_hailmary') plays = [{ name: 'Hail Mary', desc: 'Everyone to the end zone. Throw it up!', form: 'shotgun', hail: true, routes: { X: [[0, goalZ - 3]], Z: [[0, goalZ - 3]], S: [[2, goalZ - 4]], TE: [[-2, goalZ - 2]], RB: [[3, -2]] } }];
  if (type === 'rb_screen') plays = [
    { name: 'Screen Left', desc: 'Leak out left, catch it, follow the linemen.', form: 'shotgun', screen: -1 },
    { name: 'Screen Right', desc: 'Same thing to the right side.', form: 'shotgun', screen: 1 },
    { name: 'Middle Screen', desc: 'Sneak behind the rush up the middle.', form: 'shotgun', screen: 0 },
  ];
  if (type === 'qb_scramble') plays = [
    { name: 'QB Draw', desc: 'Fake the pass, then run it yourself.', form: 'shotgun', hole: [0, 1.6], qbRun: true },
    { name: 'Bootleg', desc: 'Roll out to the edge and take off.', form: 'shotgun', hole: [7, 9], qbRun: true },
    { name: 'Sneak', desc: 'Lower your shoulder behind the center.', form: 'pistol', hole: [0, 0], qbRun: true },
  ];
  if (type === 'wr_jumpball') plays = [{ name: 'Fade', desc: 'Go deep and win the jump ball.', route: [[1.5, -40]], jump: true }];
  if (type === 'wr_toetap') plays = [{ name: 'Sideline Out', desc: 'Catch it near the sideline and keep your feet in bounds!', route: [[0, -Math.min(10, m.yardLine)], [16, -Math.min(10, m.yardLine)]], toe: true }];

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
  let holder = null; // entity holding the ball
  let flight = null; // { from, to, T, t0, H, target, reason }
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

  const buildFormation = () => {
    const formName = play.form ?? 'shotgun';
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
    const zone = mode === 'cover' ? play.coverage === 'zone' : call === 'safe';
    for (const d of defenders) d.zone = zone;
    if (play.blitz) { lbs.forEach((l) => { l.blitz = true; }); if (mode === 'cover' && play.user === 'blitz') cbZ.blitz = true; }
    if (play.twoDeep || zone) { ss.deep = -1; fs.deep = 1; } else { fs.deep = 0; ss.robber = true; }
    if (mode === 'runD') cbZ.zone = false;
    user = ents.find((e) => e.user);
    // routes for receivers
    const routeFor = (slot) => {
      if (mode === 'route' && slot === 'Z') return play.route;
      if (play.routes?.[slot]) return play.routes[slot];
      // run plays / defense: generic concept
      const concept = PLAYS.pass[call][Math.floor(Math.random() * 3)];
      return concept.routes[slot];
    };
    for (const r of receivers) {
      const pts = routeFor(r.slot);
      if (!pts) continue;
      r.route = [{ x: r.pos.x, z: r.pos.z }, ...pts.map(([dx, dz2]) => clampPos({ x: r.pos.x + dx, z: dz2 }))];
      r.sit = mode === 'route' && r.slot === 'Z' ? !!play.sit : false;
    }
    if (play.screen !== undefined) { rb.route = null; }
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
    playMusic(['hype', 'charge', 'groove'][Math.floor(Math.random() * 3)], { vol: 0.75 });
    hud.instr(m.defense ? 'Pick a defensive call' : 'Pick a play');
    const box = document.createElement('div');
    box.className = 'fc-plays';
    plays.forEach((pl, i) => {
      const b = document.createElement('button');
      b.className = 'fc-play';
      b.innerHTML = `<span class="k">${i + 1}</span><b>${pl.name}</b><small>${pl.desc}</small>`;
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
    hud.instr(foe ? `${play.name} · you ${sz(user)} vs ${sz(foe)} lb` : `${play.name} · get set…`);
    if (m.defense && userHome) react('defense');
    setButtonsFor();
  };

  let routeLine = null;
  let assignLine = null;
  let holeArrow = null;
  const preSnapVisuals = () => {
    if (mode === 'route' && user.route) { routeLine = makeRouteLine(user.route, '#ffd43b', 0.85); group.add(routeLine); }
    if (mode === 'cover' && user.man && play.user === 'man') { assignLine = makeRouteLine([user.pos, user.man.pos], '#60a5fa', 0.8); group.add(assignLine); }
    if ((mode === 'run' && play.hole) || mode === 'runD') {
      const hx = mode === 'runD' ? 8 : (play.hole[0] + play.hole[1]) / 2;
      holeArrow = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2, 3), new THREE.MeshBasicMaterial({ color: mode === 'runD' || mode === 'runStop' ? '#f87171' : '#4ade80', transparent: true, opacity: 0.85 }));
      holeArrow.rotation.x = -Math.PI / 2;
      holeArrow.position.set(hx, 0.1, -1.6);
      group.add(holeArrow);
    }
    if (mode === 'pass') {
      receivers.forEach((r, i) => {
        const l = makeLabel(String(i + 1), { size: 0.85 });
        l.position.set(0, 2.8, 0);
        r.mesh.add(l);
        r.label = l;
        labels.push(l);
        r.ring = makeRing('#4ade80', 0.6, 0.85, 0.9);
        r.mesh.add(r.ring);
      });
    }
  };

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
    else if (user === carrier) mode2 = 'runner';
    else if (user.role === 'QB' && holder === user && !user.runner) mode2 = 'qb';
    else if (user.team === 'off') mode2 = flight && flight.target === user ? 'catch' : 'route';
    else if (user.role === 'DL') mode2 = user.engagedBy ? 'dlBlocked' : 'dlFree';
    else mode2 = 'def';
    if (mode2 === btnMode) return;
    btnMode = mode2;
    const sets = {
      none: [],
      runner: [btn.sprint, btn.juke, btn.spin, btn.stiff, btn.dive],
      qb: [btn.sprint, btn.pass],
      route: [btn.sprint, btn.call, btn.catch],
      catch: [btn.sprint, btn.catch],
      def: [btn.sprint, btn.swat, btn.tackle],
      dlBlocked: [btn.rip, btn.swim, btn.bull],
      dlFree: [btn.sprint, btn.bat, btn.sack],
    };
    showLev(mode2 === 'dlBlocked');
    controls.setButtons(sets[mode2]);
  };

  const controls = makeControls(ctx, {
    onPress: (id) => {
      if (phase === 'pick' && /^key[1-3]$/.test(id)) return choose(Number(id.slice(3)) - 1);
      if (phase !== 'live') return;
      if (/^key[1-5]$/.test(id) && user.role === 'QB' && holder === user && !user.runner) return throwTo(receivers[Number(id.slice(3)) - 1]);
      if (id === 'juke' && user === carrier && moves.jukeCd <= 0) {
        const dir = controls.state.x !== 0 ? Math.sign(controls.state.x) : (Math.random() < 0.5 ? -1 : 1);
        moves.juke = (0.24 + st.skill / 100 * 0.16) * tol; moves.jukeCd = 0.8; moves.jukeDir = dir;
        playAction(user.mesh, 'juke', { dir });
        sfx.juke();
        if (Math.random() < wfx.slip * 1.5) { moves.slow = 0.6; hud.big('SLIPPED!', '#fbbf24', 600); }
      }
      if (id === 'spin' && user === carrier && moves.spinCd <= 0) { moves.spin = 0.42 * Math.sqrt(tol); moves.spinCd = 1.3; playAction(user.mesh, 'spin'); sfx.juke(); }
      if (id === 'stiff' && user === carrier && moves.stiffCd <= 0) { moves.stiff = 0.6; moves.stiffCd = 1.1; playAction(user.mesh, 'stiff'); }
      if (id === 'dive' && user === carrier && !moves.dive) { moves.dive = 0.01; playAction(user.mesh, 'dive'); }
      // pass-rush moves: win the battle with the blocker
      if ((id === 'rip' || id === 'swim' || id === 'bull') && user.engagedBy && rush.cd <= 0 && rush.stun <= 0) {
        const o = user.engagedBy;
        const stat = id === 'bull' ? (st.strength ?? 60) : id === 'swim' ? (st.skill ?? 60) : ((st.skill ?? 60) + (st.speed ?? 60)) / 2;
        const massK = id === 'bull' ? Math.max(0.7, Math.min(1.4, user.mass / o.mass)) : Math.max(0.8, Math.min(1.25, o.mass / user.mass));
        const pWin = (0.18 + rush.lev * 0.55 + (stat - 50) / 220) * (0.75 + tol * 0.25) * (call === 'risky' ? 0.9 : 1) * massK;
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
      if (id === 'swat' && user.role === 'DL' && flight && !flight.pitch && t - flight.t0 < 0.3 && dist(user.pos, qb.pos) < 3.2) {
        playAction(user.mesh, 'jump');
        if (Math.random() < 0.55 + (st.skill ?? 60) / 300) { flight = null; ball.visible = false; hud.big('BATTED DOWN!', '#4ade80', 900); sfx.hit(); whistle('pd'); return; }
      }
      if ((id === 'catch' || id === 'swat') && flight && catchPress === null && swatPress === null) {
        if (user.team === 'off') catchPress = t; else swatPress = t;
        playAction(user.mesh, flight && flight.H > 4 ? 'jump' : 'catch');
        sfx.click();
      }
      if (id === 'tackle' && user.team === 'def' && user.lunge <= 0 && user.out <= 0) {
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
    const v = 17 + (st.strength ?? 60) * 0.08;
    // lead the receiver: iterate the intercept time
    let T = dist(qbP, r.pos) / v;
    let lead = { ...r.pos };
    for (let i = 0; i < 3; i++) { lead = { x: r.pos.x + r.vel.x * T, z: r.pos.z + r.vel.z * T }; T = Math.max(0.35, dist(qbP, lead) / v); }
    const isUserQB = user === qb;
    const sd = isUserQB ? ((1.35 - (st.skill ?? 60) * 0.009) / tol) * (pressure < 2.5 ? 1.6 : 1) * (moving > 3 ? 1.3 : 1) : 0.7;
    const to = clampPos({ x: lead.x + gaussR() * sd * 0.7 + wfx.wind.x * T * 0.45, z: lead.z + gaussR() * sd + wfx.wind.z * T * 0.45 });
    if (play.hail) to.z = Math.min(to.z, goalZ - 1);
    const H = Math.max(1.4, dist(qbP, to) * (play.hail ? 0.3 : 0.12));
    flight = { from: { x: qbP.x + 0.3, z: qbP.z - 0.2 }, to, T: Math.max(0.4, dist(qbP, to) / v), t0: t, H, target: r };
    holder = null;
    playAction(qb.mesh, 'throw');
    sfx.throw();
    labels.forEach((l) => { l.visible = false; });
    receivers.forEach((x) => { if (x.ring) x.ring.visible = false; });
    hud.instr('');
  };

  // ---------------- movement helpers
  const moveToward = (e, tx, tz, speed, dt, accel = 14) => {
    const dx = tx - e.pos.x;
    const dz = tz - e.pos.z;
    const d = Math.hypot(dx, dz);
    let vx = 0;
    let vz = 0;
    if (d > 0.08) { const s = Math.min(speed, d * 4); vx = (dx / d) * s; vz = (dz / d) * s; }
    e.vel.x += (vx - e.vel.x) * Math.min(1, accel * dt / Math.max(1, speed));
    e.vel.z += (vz - e.vel.z) * Math.min(1, accel * dt / Math.max(1, speed));
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

  // ---------------- AI
  const nearest = (from, list) => { let best = null; let bd = Infinity; for (const e of list) { if (e.down || e.out > 0) continue; const d = dist(from.pos, e.pos); if (d < bd) { bd = d; best = e; } } return best; };
  const pursue = (e, target, dt, factor = 1) => {
    const d = dist(e.pos, target.pos);
    const lead = Math.min(0.7, d / Math.max(1, e.maxSpeed));
    moveToward(e, target.pos.x + target.vel.x * lead, target.pos.z + target.vel.z * lead, e.maxSpeed * factor, dt);
  };

  const aiOffense = (e, dt) => {
    if (e.out > 0) { e.out -= dt; if (e.out <= 0 && isDown(e.mesh)) knockDown(e.mesh, 0); return; }
    if (e.role === 'OL') {
      if (e.blockTarget && !e.engaged) {
        const d = e.blockTarget;
        moveToward(e, d.pos.x, d.pos.z + 0.7, e.maxSpeed, dt);
        if (dist(e.pos, d.pos) < 1.2 && !d.engagedBy) { e.engaged = d; d.engagedBy = e; d.shed = -0.2; setPose(e.mesh, 'block'); setPose(d.mesh, 'block'); }
        if (d.engagedBy && d.engagedBy !== e) e.blockTarget = null;
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
        moveToward(e, d.pos.x + away, d.pos.z + (runPush ? -0.3 : 0.9), 1.6 * Math.max(0.7, Math.min(1.45, e.mass / d.mass)), dt);
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
      moveToward(e, flight.to.x, flight.to.z, e.maxSpeed * 1.05, dt, 20);
      if (remain < 0.3) faceToward(e.mesh, qb.pos.x, qb.pos.z);
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
      e.s += e.maxSpeed * dt * Math.min(1, t / 0.4) * (e.jam > 0 ? 0.35 : 1);
      const p = routePoint(e, e.s);
      moveToward(e, p.x, p.z, e.maxSpeed, dt, 22);
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
    if (play.hole && e === rb && e.pos.z > -1 && mode === 'run') tx = play.hole[1];
    tx = Math.max(-FIELD_X + 1.5, Math.min(FIELD_X - 1.5, tx));
    moveToward(e, tx, e.pos.z - 6, e.maxSpeed * (moves.slow > 0 && e.user ? 0.55 : !e.user && mode === 'pass' ? 0.88 : 1), dt);
    if (!e.user && e.jukeCd <= 0) {
      const lunger = defenders.find((d) => (d.tell > 0 || d.lunge > 0) && dist(d.pos, e.pos) < 2.6);
      if (lunger && Math.random() < (mode === 'pass' ? 0.1 : 0.25) * (call === 'risky' ? 1.2 : 1)) { e.juking = 0.3; e.jukeCd = 1.2; playAction(e.mesh, 'juke', { dir: Math.sign(e.pos.x - lunger.pos.x || 1) }); e.vel.x += Math.sign(e.pos.x - lunger.pos.x || 1) * 5; }
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
    if (e.out > 0) { e.out -= dt; if (e.out <= 0 && isDown(e.mesh)) knockDown(e.mesh, 0); return; }
    if (e.engagedBy) {
      // Blocked: try to shed the block over time.
      e.shed += dt * ((mode === 'run' ? 0.2 : 0.32) + (call === 'risky' ? 0.12 : 0) + (m.defense ? -0.05 : 0.06) + (e.blitz ? 0.1 : 0));
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
      const readT = e.role === 'LB' ? 0.9 : e.role === 'DL' ? 0 : 1.0;
      if (t > readT && holder) { pursueAndTackle(e, holder, dt, mode === 'runD' || mode === 'runStop' ? 0.62 : 0.85); return; }
    }
    if ((e.role === 'DL' || e.blitz) && holder) { pursueAndTackle(e, holder, dt, 0.85); return; }
    if (e.role === 'S') {
      const deepZ = Math.min(e.start.z, -12, ...receivers.map((r) => r.pos.z - 4));
      const tx = e.deep !== undefined ? e.deep * 10 + (ballPos.x - e.deep * 10) * 0.25 : ballPos.x * 0.5;
      moveToward(e, tx, Math.max(backLine + 1, e.robber ? -7 : deepZ), e.maxSpeed * 0.75, dt);
      backpedalFace(e, e.vel.z < -0.3);
      return;
    }
    if (e.man && !e.zone) {
      // Man coverage: trail the receiver with a reaction lag; jam at the line when pressing.
      const r = e.man;
      if ((play.press || call === 'risky') && t < 0.6 && dist(e.pos, r.pos) < 1.6) r.jam = 0.4;
      // hand-fighting at the line and on the route
      if (t < 1.6 && dist(e.pos, r.pos) < 1.4 && !(e.handT > 0)) {
        e.handT = 0.5 + Math.random() * 0.4;
        playAction(e.mesh, 'stiff', { dur: 0.3 });
        if (!r.user) playAction(r.mesh, 'stiff', { dur: 0.3 });
        r.vel.x += (Math.random() - 0.5) * 4;
      }
      if (e.handT > 0) e.handT -= dt;
      const lag = (mode === 'pass' ? 0.2 : 0.28) + Math.random() * 0.05;
      moveToward(e, r.pos.x - r.vel.x * lag + (r.pos.x < 0 ? 0.5 : -0.5), r.pos.z - r.vel.z * lag - 0.6, e.maxSpeed, dt, 18);
      backpedalFace(e, e.vel.z < -0.3 && t < 1.8, r);
      return;
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
      e.vel.x *= 0.85; e.vel.z *= 0.85;
      if (e.tell <= 0) { e.lunge = 0.32; e.lungeDir = norm(target.pos.x + target.vel.x * 0.25 - e.pos.x, target.pos.z + target.vel.z * 0.25 - e.pos.z); playAction(e.mesh, 'tackle'); }
      return;
    }
    if (d < 2.3 && target !== qb || (target === qb && d < 1.8)) {
      e.tell = 0.26 * (m.defense ? 1 : 1 + (tol - 1) * 0.4); // the readable "tell"
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
  const fxList = [];
  let cineUsed = 0;
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
  /** Hard tackle: ragdoll, maybe slow-mo replay, maybe blood, maybe an injury. */
  const hardHit = (tackler, target) => {
    const rel = Math.hypot(tackler.vel.x - target.vel.x, tackler.vel.z - target.vel.z);
    const big = globalThis.__forceBigHit || rel * Math.sqrt(tackler.mass / target.mass) > 10 || Math.random() < 0.12 * Math.min(1.6, tackler.mass / target.mass);
    const sizeK = Math.max(0.7, Math.min(1.5, tackler.mass / target.mass));
    flatten(target, tackler, (big ? 1.5 + Math.random() * 0.5 : 0.55 + Math.random() * 0.3) * sizeK);
    fxList.push(dustPuff(group, target.pos, big ? 16 : 9));
    if (!big) return;
    const involved = target.user || tackler.user;
    hud.big(tackler.user ? 'BOOM!' : 'BIG HIT!', '#ff6b6b', 900);
    ctx.hype?.(0.8, 2);
    crowd('hit', tackler.team === (m.defense ? 'def' : 'off'));
    ctx.shake(0.6);
    if (involved && cineUsed < 1 && !opts.reducedMotion && (globalThis.__forceBigHit || Math.random() < 0.6)) {
      cineUsed++;
      ctx.cinematic?.(() => target.pos, 1.4);
    }
    if (opts.blood !== false && (globalThis.__forceBigHit || Math.random() < 0.3)) {
      const d = pushDir(tackler, target);
      fxList.push(bloodBurst(group, { x: target.pos.x, y: 1.6, z: target.pos.z }, d));
    }
    // the hit can hurt you (more likely when already banged up)
    if (target.user && Math.random() < 0.07 * (1.6 - (opts.health ?? 100) / 100)) {
      target.injured = true;
      setTimeout(() => { hud.big('INJURED', '#ff6b6b', 1600); hud.say?.(`${opts.lastName ?? 'He'} is slow to get up... trainers are running out.`, 3000); }, 700);
    }
  };

  const tryTackle = (tackler, target) => {
    if (target.down) return;
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
      if (facing && Math.random() < 0.35 + (st.strength ?? 60) / 160) {
        tackler.out = 1.2; flatten(tackler, target, 0.9); moves.slow = 0.3;
        hud.big('STIFF ARM!', '#fbbf24', 700); sfx.hit(); ctx.shake(0.25); return;
      }
    }
    const str = target.user ? (st.strength ?? 60) : 60;
    const pBreak = (str / 100) * 0.3 * (target.user ? (0.6 + tol * 0.4) : mode === 'pass' ? 0.35 : 0.6) * Math.pow(0.5, target.broken ?? 0) + (tackler.user ? -0.1 : 0);
    if (Math.random() < pBreak * Math.max(0.5, Math.min(1.8, Math.pow(target.mass / tackler.mass, 1.3)))) {
      target.broken = (target.broken ?? 0) + 1;
      tackler.out = 1.0; flatten(tackler, target, 0.6);
      if (target.user) { moves.slow = 0.4; hud.big('BROKE A TACKLE!', '#fbbf24', 700); }
      sfx.hit(); ctx.shake(0.2);
      return;
    }
    // Tackled.
    playAction(tackler.mesh, 'tackle', { then: null });
    target.down = true;
    hardHit(tackler, target);
    sfx.hit();
    ctx.shake(0.4);
    const fumbleP = 0.012 * (call === 'risky' ? 2 : 1) + wfx.slip * 0.25 + (tackler.user ? 0.04 : 0);
    whistle(Math.random() < fumbleP ? 'fumble' : 'tackle', tackler);
  };

  // ---------------- catch resolution
  const resolveFlight = () => {
    const f = flight;
    flight = null;
    const r = f.target;
    const land = f.to;
    if (f.pitch) { holder = r; carrier = r; return; }
    const dR = dist(r.pos, land);
    const defs = defenders.filter((d) => !d.down && d.out <= 0);
    const dD = Math.min(...defs.map((d) => dist(d.pos, land)));
    const crowd = defs.filter((d) => dist(d.pos, land) < 2).length;
    // --- defense player (you) trying to swat / pick
    if (user.team === 'def' && dist(user.pos, land) < 1.8 + tol * 0.3) {
      const timing = swatPress === null ? 9 : Math.abs(f.t0 + f.T - swatPress - 0.12);
      const win = (0.16 + (st.skill ?? 60) / 100 * 0.12) * tol;
      if (timing <= win && dist(user.pos, land) <= dR + 0.5) {
        if (Math.random() < 0.55 + (st.skill ?? 60) / 400) { holder = user; carrier = user; user.int = true; hud.big('INTERCEPTION!', '#4ade80', 900); ctx.slowMo(0.5); sfx.catch(); setButtonsFor(); return; }
        whistle('pd'); return;
      }
      if (timing <= win * 2.2 || dist(user.pos, land) < 0.9) { whistle('pd'); return; }
    }
    // --- you are the receiver
    let catchOk;
    if (r === user) {
      const timing = catchPress === null ? 9 : Math.abs(f.t0 + f.T - catchPress - 0.1);
      const win = 0.13 * tol * (0.85 + (st.skill ?? 60) / 400) * (play.jump ? 1.3 : 1);
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
      catchOk = dR <= catchR && Math.random() < (crowd ? 0.42 + hEdge : dD < 1.6 ? 0.72 + hEdge : 0.9) - wfx.slip;
      // tight coverage: the defender gets a hand in
      if (catchOk && dD < 1.25 && Math.random() < 0.3 / tol) { whistle('incomplete', null, 'Broken up at the catch point!'); return; }
      if (play.hail) catchOk = dR < 2.4 && Math.random() < 0.35 - crowd * 0.05;
    }
    const intRisk = dD < 0.9 && dD < dR ? 0.45 : dD < 1.3 && !catchOk ? 0.2 : 0;
    if (!catchOk && Math.random() < intRisk * (call === 'risky' ? 1.3 : 1)) {
      const picker = defs.reduce((a, d) => (dist(d.pos, land) < dist(a.pos, land) ? d : a), defs[0]);
      holder = picker; carrier = picker;
      whistle('int');
      return;
    }
    if (!catchOk) { whistle('incomplete'); return; }
    // Toe-tap: you must be in bounds.
    if (Math.abs(r.pos.x) > FIELD_X) { whistle('incomplete', null, 'Out of bounds. No catch.'); return; }
    holder = r;
    carrier = r;
    sfx.catch();
    playAction(r.mesh, 'catch');
    say('catch');
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
  const whistle = (why, by = null, text = null) => {
    if (phase !== 'live') return;
    setTimeout(() => commentate(why), 0);
    if (globalThis.__playDebug) console.log('whistle', why, 'by', by?.role, by?.slot, by?.engagedBy ? 'blocked' : '', carrier?.role, carrier?.slot, carrier?.pos.z?.toFixed(1), 'holder', holder?.role, 'thrown', thrown, 't', t.toFixed(2));
    phase = 'dead';
    t = 0;
    sfx.whistle();
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
      result = def ? (carrier.team === 'def' ? { defense: true, int: true, turnover: true, defTD: true, quality: 0.98, text: 'PICK SIX!' } : { defense: true, caught: true, yardsAllowed: m.yardLine, tdAllowed: true, quality: 0.05, text: 'They score.' })
        : { complete: true, yards: m.yardLine, td: true, quality: 0.95, text: 'TOUCHDOWN!' };
      if ((def && carrier.team === 'def') || (!def && carrier.team === 'off')) startCelebration();
      return;
    }
    if (def) {
      if (why === 'int' || user.int) result = { defense: true, int: true, turnover: true, quality: 0.92, text: 'INTERCEPTED!' };
      else if (why === 'pd' || why === 'incomplete') result = { defense: true, pd: why === 'pd', yardsAllowed: 0, quality: why === 'pd' ? 0.72 : 0.55, text: why === 'pd' ? 'Pass broken up!' : 'Incomplete.' };
      else if (why === 'sack') { const loss = Math.max(1, Math.round(qb.pos.z - 0)); result = { defense: true, sack: true, tackle: by === user, tfl: true, yardsAllowed: -loss, quality: by === user ? 0.96 : 0.72, text: by === user ? `SACK! You drop him for a loss of ${loss}.` : `Sacked by a teammate for a loss of ${loss}.` }; }
      else if (why === 'fumble' && by?.team === 'def') result = { defense: true, forcedFumble: true, turnover: true, tackle: true, yardsAllowed: Math.max(0, yardsFrom(carrier)), quality: 0.95, text: 'FUMBLE! Defense recovers!' };
      else {
        const ya = Math.max(0, yardsFrom(carrier));
        const yr = yardsFrom(carrier);
        result = { defense: true, caught: mode === 'cover', tackle: by === user, tfl: by === user && yr < 0, yardsAllowed: ya, quality: Math.max(0.05, (by === user ? (yr < 0 ? 0.88 : 0.62) : 0.4) - ya / 40), text: by === user ? (yr < 0 ? `Tackle for a loss of ${-yr}!` : `You make the stop after ${ya} yards.`) : `${ya} yards allowed.` };
      }
    } else {
      if (why === 'int') result = { turnover: true, complete: false, yards: 0, quality: 0.03, text: 'INTERCEPTED!' };
      else if (why === 'incomplete') result = { complete: false, yards: 0, quality: 0.2, text: text ?? 'Incomplete.' };
      else if (why === 'sack') result = { sack: true, complete: false, yards: Math.min(-1, yardsFrom(qb)), quality: 0.06, text: 'SACKED!' };
      else if (why === 'fumble') result = { turnover: true, complete: false, yards: yardsFrom(carrier), quality: 0.05, text: 'FUMBLE! Defense recovers.' };
      else {
        const y = yardsFrom(carrier);
        result = { complete: true, yards: y, quality: Math.max(0.05, 0.3 + y / 22 + (carrier?.broken ?? 0) * 0.05), text: why === 'oob' ? `Out of bounds after ${y}.` : null };
      }
    }
    maybeFlag();
    if (user.injured && result) result.injured = true;
  };

  // Penalty flags: occasionally a yellow flag changes the outcome of the play.
  const maybeFlag = () => {
    if (!result || result.turnover || Math.random() > 0.07) return;
    const flag = (msg, patch) => {
      Object.assign(result, patch, { text: msg, flag: true });
      setTimeout(() => { hud.big('FLAG!', '#ffd43b', 1100); hud.say?.(msg, 2600); }, 450);
    };
    if (m.defense) {
      if (result.pd || result.yardsAllowed === 0) flag('Pass interference on you. 15 yards.', { pd: false, yardsAllowed: 15, caught: true, quality: Math.min(result.quality, 0.25) });
      else if (result.tackle) flag('Facemask! 15 more yards.', { yardsAllowed: (result.yardsAllowed ?? 0) + 15, quality: Math.min(result.quality, 0.2) });
      else if ((result.yardsAllowed ?? 0) >= 12) flag('Holding on the offense! Play comes back.', { yardsAllowed: 0, caught: false, quality: Math.max(result.quality, 0.6) });
    } else if (result.complete === false && !result.sack) flag('Pass interference on the defense! First down.', { complete: true, yards: Math.max(m.distance, 12), quality: 0.6 });
    else if (result.complete && result.yards >= 10) flag('Holding on the offense. That big gain comes back.', { yards: -10, quality: 0.12 });
  };

  const startCelebration = () => {
    phase = 'celebrate';
    t = 0;
    const who = scorer;
    celebrate(who.mesh);
    hud.big('TOUCHDOWN!', '#4ade80', 2600);
    say(scorer.team === 'def' ? 'pick' : 'td');
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
    pass: ['Pick a play, then move your QB with the joystick (left side) or WASD.', 'Tap a receiver (or press 1-5) to throw. Green ring = open.', 'Red ring under a defender = they are about to tackle. Get rid of it or run!'],
    run: ['Pick a run play. Follow the green arrow to the hole.', 'Move with the joystick / WASD. Hold SPRINT (Shift) for speed.', 'When a defender flashes a red ring, they are about to lunge: hit JUKE or SPIN right then. STIFF ARM bullies them.'],
    route: ['Pick your route. Run it yourself with the joystick, or let go and you will run it automatically.', 'Get open, tap CALL FOR IT, then press CATCH as the ball arrives.', 'After the catch, juke, spin and stiff-arm your way upfield.'],
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
    if (fx && !fx(dt)) fx = null;
    for (let i = fxList.length - 1; i >= 0; i--) if (!fxList[i](dt)) fxList.splice(i, 1);
    if (phase === 'pick' || phase === 'over') return;
    if (phase === 'pre') {
      rig(camera, (user?.pos.x ?? 0) * 0.4, -4, dt, { zoom: mode === 'pass' ? 1.1 : 0.95, k: 3 });
      if (holeArrow) holeArrow.material.opacity = 0.6 + Math.sin(t * 8) * 0.25;
      if (t > 1.1) {
        phase = 'live'; t = 0;
        sfx.whistle();
        say(m.defense ? 'snapDef' : 'snap');
        stopMusic();
        react('snap', m.defense ? userHome : !userHome);
        hud.instr('');
        for (const e of ents) setPose(e.mesh, null);
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
        if (routeLine) routeLine.material.opacity = 0.3;
        if (assignLine) { group.remove(assignLine); assignLine = null; }
        setButtonsFor();
      }
      for (const e of ents) animateRun(e.mesh, dt, 0);
      ball.position.set(qb.pos.x + 0.3, 1.2, qb.pos.z - 0.4);
      return;
    }

    if (phase === 'live') {
      moves.juke = Math.max(0, moves.juke - dt); moves.jukeCd = Math.max(0, moves.jukeCd - dt);
      moves.spin = Math.max(0, moves.spin - dt); moves.spinCd = Math.max(0, moves.spinCd - dt);
      moves.stiff = Math.max(0, moves.stiff - dt); moves.stiffCd = Math.max(0, moves.stiffCd - dt);
      moves.slow = Math.max(0, moves.slow - dt);
      // ---- user control
      const c = controls.state;
      const [uh0, uw0] = POS_SIZE[opts.position] ?? POS_SIZE[user.role] ?? [73, 210];
      const userSize = Math.max(0.9, Math.min(1.06, 1 - ((user.wLb - uw0) / uw0) * 0.3 + (user.hIn - uh0) * 0.003));
      const userSpeed = BASE_SPEED[user.role] * userSize * (0.86 + (st.speed ?? 60) / 100 * 0.28) * wfx.speed * (c.sprint ? 1.15 : 0.95) * (moves.slow > 0 ? 0.55 : 1) * (moves.spin > 0 ? 0.8 : 1);
      if (user.out > 0) { user.out -= dt; if (user.out <= 0 && isDown(user.mesh)) knockDown(user.mesh, 0); user.vel.x *= 0.8; user.vel.z *= 0.8; }
      else if (moves.dive) {
        moves.dive += dt;
        const dir = norm(user.vel.x, user.vel.z || -1);
        user.vel.x = dir.x * 7; user.vel.z = dir.z * 7;
        if (moves.dive > 0.45) { user.down = true; knockDown(user.mesh, 1); whistle('tackle'); }
      } else if (user.lunge > 0) {
        user.lunge -= dt;
        user.vel.x = user.lungeDir.x * 9.5; user.vel.z = user.lungeDir.z * 9.5;
        if (carrier && carrier !== user && dist(user.pos, carrier.pos) < 1.15) tryTackle(user, carrier);
        else if (!carrier && holder === qb && !flight && passD && dist(user.pos, qb.pos) < 1.2) { qb.down = true; user.lunge = 0; hardHit(user, qb); hud.big('SACK!', '#4ade80', 1100); sfx.cheer(); whistle('sack', user); }
        if (user.lunge <= 0 && phase === 'live') { user.out = 0.7; knockDown(user.mesh, 1); }
      } else if (user.engagedBy) {
        // locked up with a blocker: drive into him to build leverage, use moves to break free
        rush.cd = Math.max(0, rush.cd - dt);
        rush.stun = Math.max(0, rush.stun - dt);
        const o = user.engagedBy;
        const toward = c.active ? Math.max(0, -(c.z) * 0.8 + 0.2) : 0.15;
        rush.lev = Math.min(1, rush.lev + dt * toward * (0.5 + (st.strength ?? 60) / 200));
        if (levBar) levBar.querySelector('i').style.width = `${rush.lev * 100}%`;
        const push = c.active ? 1.6 : 0.6;
        moveToward(user, o.pos.x + c.x * 1.2, o.pos.z + 0.2, push, dt, 10);
        faceToward(user.mesh, o.pos.x, o.pos.z);
        if (t > 4.2) { o.engaged = null; user.engagedBy = null; setPose(user.mesh, null); setPose(o.mesh, null); }
      } else if (c.active) {
        if (rush.burst > 0) rush.burst -= dt;
        // turf kicks up behind you when you sprint
        dustT -= dt;
        if (c.sprint && dustT <= 0 && Math.hypot(user.vel.x, user.vel.z) > 6) { dustT = 0.22; fxList.push(dustPuff(group, user.pos, 3)); }
        moveToward(user, user.pos.x + c.x * 5, user.pos.z + c.z * 5, userSpeed * (rush.burst > 0 ? 1.25 : 1) * Math.min(1, Math.hypot(c.x, c.z) + 0.15), dt, 26);
        if (moves.juke > 0.15) { user.vel.x += moves.jukeDir * 7 * dt * 10; }
      } else {
        // assists when you let go of the stick
        if (user.team === 'off' && user.route && !carrier && !flight) { user.s += userSpeed * dt; const p = routePoint(user, user.s); moveToward(user, p.x, p.z, userSpeed, dt, 22); }
        else if (user === carrier) moveToward(user, play.hole && user.pos.z > -1 ? play.hole[1] : user.pos.x, user.pos.z - 4, userSpeed * 0.85, dt, 20);
        else if (user === rb && mode === 'run' && !carrier) moveToward(user, play.pitch ? play.hole[0] * 0.6 : qb.pos.x + 0.3, play.pitch ? rb.start.z - 0.5 : qb.pos.z - 0.3, 6, dt);
        else if (user === rb && play.screen !== undefined && !carrier) moveToward(user, play.screen * 7, 2.2, 5, dt);
        else if (user.team === 'def' && user.man) { const r = user.man; moveToward(user, r.pos.x - r.vel.x * 0.4, r.pos.z - r.vel.z * 0.4 - 0.8, userSpeed * 0.85, dt); }
        else if (user.team === 'def' && carrier) pursue(user, carrier, dt, 0.8);
        else { user.vel.x *= 0.85; user.vel.z *= 0.85; }
      }
      if (dtMode) setButtonsFor();
      // ---- AI
      for (const e of ents) {
        if (e.user || e.down) continue;
        if (e.joinCeleb) continue;
        if (e.team === 'off') aiOffense(e, dt);
        else aiDefense(e, dt);
        if (e.jukeCd > 0) e.jukeCd -= dt;
        if (e.juking > 0) e.juking -= dt;
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
            if (user === qb && (moves.juke > 0 || moves.spin > 0)) { e.out = 1.2; knockDown(e.mesh, 1); hud.big('ESCAPED!', '#4ade80', 600); }
            else { qb.down = true; hardHit(e, qb); playAction(e.mesh, 'tackle'); sfx.hit(); ctx.shake(0.4); whistle('sack'); }
          } else tryTackle(e, target);
          e.lunge = 0;
        }
        if (e.lunge <= 0 && phase === 'live' && e.out <= 0) { e.out = 0.6; knockDown(e.mesh, 1); }
      }
      for (const [e, r] of tellRings) { r.visible = e.tell > 0 || e.lunge > 0; r.scale.setScalar(1 + Math.sin(t * 30) * 0.15); }
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
            a.pos.x -= (dx / d) * push * wa; a.pos.z -= (dz / d) * push * wa;
            b.pos.x += (dx / d) * push * (1 - wa); b.pos.z += (dz / d) * push * (1 - wa);
          }
        }
      }
      for (const e of ents) {
        if (e.down) { e.vel.x *= 0.8; e.vel.z *= 0.8; }
        e.pos.x += e.vel.x * dt;
        e.pos.z += e.vel.z * dt;
        if (e !== carrier) clampPos(e.pos);
        e.mesh.position.set(e.pos.x, 0, e.pos.z);
        const sp = Math.hypot(e.vel.x, e.vel.z);
        if (sp > 0.6 && !e.mesh.userData.u.back && e.lunge <= 0 && e.tell <= 0) faceToward(e.mesh, e.pos.x + e.vel.x, e.pos.z + e.vel.z);
        if (e.jam > 0) e.jam -= dt;
        animateRun(e.mesh, dt, e.engaged || e.engagedBy ? 0.3 : sp);
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
        ball.position.set(x, 1.6 + (1.3 - 1.6) * f + 4 * flight.H * f * (1 - f), z);
        if (!flight.pitch) { trail ??= makeTrail(group); trail.push(ball.position); }
        ball.lookAt(flight.to.x, 1.3, flight.to.z);
        ball.userData.shadow.position.set(x, 0.03, z);
        if (f >= 1) resolveFlight();
      } else if (holder) {
        ball.position.set(holder.pos.x + 0.25, 1.15, holder.pos.z - 0.1);
        trail?.fade();
        ball.userData.shadow.position.set(holder.pos.x, 0.03, holder.pos.z);
      }
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
      if (phase === 'live' && t > 18) whistle(carrier ? 'tackle' : thrown ? 'incomplete' : 'sack');
      setButtonsFor();
      // ---- camera
      const focus = carrier ? carrier.pos : flight ? { x: ball.position.x, z: ball.position.z } : user.pos;
      const zoom = mode === 'pass' && !thrown && !carrier ? 1.05 : carrier ? 0.72 : 0.9;
      rig(camera, focus.x * 0.85, Math.min(4, focus.z), dt, { zoom, k: 3.5, ahead: carrier?.team === 'def' ? -6 : 8 });
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
      if (t > 4.2) { phase = 'over'; endPlay(ctx, finalize(result, m), { delay: 300 }); }
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
      if (t > 1.6) { phase = 'over'; endPlay(ctx, finalize(result, m), { delay: 900 }); }
    }
  };

}
