// Owns the single WebGL renderer (drawn at low resolution and scaled up with crisp pixels),
// the stadium, the render loop, weather effects, the HUD overlay, and launches minigames.
// If WebGL is unavailable, a simple 2D timing meter is used instead.
import * as THREE from 'three';
import { speak } from '../audio/voice.js';
import { buildStadium } from './stadium.js';
import { startCrowd, stopCrowd, setCrowd, playMusic, stopMusic, react } from '../audio/stadium.js';
import { buildInterlude } from './interludes.js';
import { nextFrame, tickIdle, sweepActorCaches } from './actors.js';
import { buildWorld } from './world.js';
import { goalLine } from './minigames/goalLine.js';
import { freePlay } from './play/engine.js';
import { fallbackMeter } from './minigames/fallback.js';

let R = null;
let failed = false;
let raf = 0;
let loopFn = null;
let elapsed = 0;
let shake = 0;

function ensure() {
  if (R) return R;
  if (failed) return null;
  try {
    const el = document.getElementById('stage');
    // Smooth, realistic rendering: antialiased, full resolution (capped for phones), filmic tone mapping.
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true; // only the walkable places use a shadow-casting light
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.append(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#5aa0d8');
    const camera = new THREE.PerspectiveCamera(36, 1, 1, 1100);
    const stadium = buildStadium(scene);
    // Lighting: sky/ground fill, a warm key light and a soft image-based environment for realistic shading.
    scene.add(new THREE.HemisphereLight('#dbe9ff', '#3f5a3f', 0.9));
    const sun = new THREE.DirectionalLight('#fff1dc', 2.4);
    sun.position.set(-20, 40, 25);
    scene.add(sun);
    const rim = new THREE.DirectionalLight('#cfe0ff', 0.7);
    rim.position.set(25, 18, -30);
    scene.add(rim);
    try {
      // tiny gradient "sky dome" baked into an environment map (no image files needed)
      const envScene = new THREE.Scene();
      const sky = new THREE.Mesh(new THREE.SphereGeometry(10, 24, 12), new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true }));
      const cols = []; const pa = sky.geometry.attributes.position;
      const top = new THREE.Color('#9ec9ff'); const mid = new THREE.Color('#f2f4f8'); const bot = new THREE.Color('#3d5a3b');
      for (let i = 0; i < pa.count; i++) { const y = pa.getY(i) / 10; const c = y > 0 ? mid.clone().lerp(top, y) : mid.clone().lerp(bot, -y * 1.4); cols.push(c.r, c.g, c.b); }
      sky.geometry.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      envScene.add(sky);
      const pm = new THREE.PMREMGenerator(renderer);
      scene.environment = pm.fromScene(envScene, 0.04).texture;
      scene.environmentIntensity = 0.55;
      pm.dispose();
    } catch { /* environment lighting is optional */ }
    const clock = new THREE.Clock();
    const weather = makeWeather(scene);
    R = { renderer, scene, camera, stadium, clock, el, weather };
    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      // full resolution, capped so big phones don't overheat
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      camera.aspect = w / h;
      camera.fov = camera.aspect < 0.75 ? 50 : camera.aspect < 1.2 ? 40 : 32;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', resize);
    resize();
    return R;
  } catch (e) {
    console.warn('WebGL unavailable, using 2D fallback', e);
    failed = true;
    return null;
  }
}

function frame() {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(0.05, R.clock.getDelta());
  const cine = R.cine;
  const slow = (cine ? 0.2 : R.slowmo > 0 ? 0.3 : 1) * (R.timeScale ?? 1) * (R.playSpeed ?? 1);
  R.slowmo = Math.max(0, (R.slowmo ?? 0) - dt);
  elapsed += dt * slow;
  if (loopFn) loopFn(dt * slow, elapsed);
  if (cine) {
    // dramatic low orbit around the action, then hand the camera back
    cine.t += dt;
    const tg = cine.target();
    const a = cine.ang + cine.t * 0.55;
    const k = Math.min(1, cine.t * 3);
    const cx = tg.x + Math.sin(a) * 6.5;
    const cz = tg.z + Math.cos(a) * 6.5;
    if (!cine.from) cine.from = R.camera.position.clone();
    R.camera.position.set(cine.from.x + (cx - cine.from.x) * k, cine.from.y + (2.4 - cine.from.y) * k, cine.from.z + (cz - cine.from.z) * k);
    R.camera.lookAt(tg.x, 0.9, tg.z);
    if (cine.t > cine.dur) { R.cine = null; document.body.classList.remove('cine'); }
  }
  R.weather.update(dt, R.camera);
  if (!R.active) updateLightning(R, dt);
  if (shake > 0) {
    shake = Math.max(0, shake - dt);
    R.camera.position.x += (Math.random() - 0.5) * shake * 1.5;
    R.camera.position.y += (Math.random() - 0.5) * shake * 1.5;
  }
  R.renderer.render(R.active ?? R.scene, R.camera);
  // highlight snapshot: copy the frame we just drew into a small JPEG
  if (R.snapReq) {
    const cb = R.snapReq;
    R.snapReq = null;
    try {
      const src = R.renderer.domElement;
      const c = document.createElement('canvas');
      c.width = 240; c.height = 180;
      const sw = Math.min(src.width, src.height * 4 / 3);
      const sh = sw * 3 / 4;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, 240, 180);
      cb(c.toDataURL('image/jpeg', 0.72));
    } catch { cb(null); }
  }
}

function start(fn) {
  loopFn = fn;
  R.el.classList.add('on');
  if (!raf) {
    R.clock.getDelta();
    raf = requestAnimationFrame(frame);
  }
}

function stop() {
  loopFn = null;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  if (R) R.el.classList.remove('on');
}

/** Camera shake (tackles, big hits). */
export function cameraShake(s = 0.3) {
  shake = Math.max(shake, s);
}

/** Slow-motion replay camera on a target: target() returns {x, z} each frame. */
export function cinematic(target, seconds = 1.6) {
  if (!R || R.cine) return;
  R.cine = { target: typeof target === 'function' ? target : () => target, dur: seconds, t: 0, ang: Math.random() * Math.PI * 2, from: null };
  document.body.classList.add('cine');
}

/** Brief slow motion (big catches, interceptions). */
export function slowMo(seconds = 0.6) {
  if (R) R.slowmo = seconds;
}

// ------------------------------------------------------------------ weather

function makeWeather(scene) {
  const n = 900;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  // Fixed pixel size (not shrinking with distance) so drops read clearly at low resolution.
  const mat = new THREE.PointsMaterial({ color: '#cfe3ff', size: 2, sizeAttenuation: false, transparent: true, opacity: 0.85, depthWrite: false });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.visible = false;
  scene.add(pts);
  let kind = 'clear';
  const reset = (i, cam, top) => {
    pos[i * 3] = cam.position.x + (Math.random() - 0.5) * 60;
    pos[i * 3 + 1] = top ? 18 + Math.random() * 6 : Math.random() * 24;
    pos[i * 3 + 2] = cam.position.z - 6 - Math.random() * 40;
  };
  return {
    set(w, cam) {
      kind = w;
      pts.visible = ['rain', 'snow', 'storm', 'wind'].includes(w);
      mat.color.set(w === 'snow' ? '#ffffff' : w === 'wind' ? '#c8a26a' : '#a9c9ff');
      mat.size = w === 'snow' ? 3 : w === 'storm' ? 2.5 : 2;
      mat.opacity = w === 'wind' ? 0.6 : 0.8;
      for (let i = 0; i < n; i++) reset(i, cam, false);
      geo.attributes.position.needsUpdate = true;
    },
    update(dt, cam) {
      if (!pts.visible) return;
      const vy = kind === 'snow' ? 3 : kind === 'wind' ? 0.6 : kind === 'storm' ? 36 : 28;
      const vx = kind === 'wind' ? 22 : kind === 'storm' ? 12 : 4;
      for (let i = 0; i < n; i++) {
        pos[i * 3 + 1] -= vy * dt;
        if (kind === 'snow') pos[i * 3] += Math.sin(elapsed * 2 + i) * dt;
        else pos[i * 3] += vx * dt;
        if (kind === 'wind' && pos[i * 3] > cam.position.x + 30) pos[i * 3] -= 60;
        if (pos[i * 3 + 1] < 0) reset(i, cam, true);
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

function applyAtmosphere(r, weather) {
  const sky = { clear: '#5aa0d8', night: '#0d1424', rain: '#4b5866', storm: '#2b3038', snow: '#9aa7b4', wind: '#6f9cc4', fog: '#aab3bb' }[weather] ?? '#5aa0d8';
  r.sky = new THREE.Color(sky);
  r.scene.background = r.sky.clone();
  // distance haze blends the scenery outside the stadium into the sky
  r.scene.fog = weather === 'fog' ? new THREE.Fog(sky, 18, 55)
    : weather === 'night' ? new THREE.Fog(sky, 220, 620)
      : weather === 'rain' || weather === 'snow' || weather === 'storm' ? new THREE.Fog(sky, 70, 320) : new THREE.Fog(sky, 320, 820);
  r.stadium.setTint(weather);
  r.weather.set(weather, r.camera);
  r.lightning = weather === 'storm' ? { next: 2 + Math.random() * 4, flash: 0 } : null;
}

/** Thunderstorm lightning: brief white flashes plus a rumble. */
function updateLightning(r, dt) {
  const L = r.lightning;
  if (!L) return;
  L.next -= dt;
  if (L.next <= 0) {
    L.flash = 0.18;
    L.next = 4 + Math.random() * 7;
    import('../audio/sfx.js').then((m) => m.sfx.thunder?.()).catch(() => {});
  }
  if (L.flash > 0) {
    L.flash -= dt;
    r.scene.background = L.flash > 0.09 || (L.flash > 0 && L.flash < 0.04) ? new THREE.Color('#e8eef7') : r.sky.clone();
  }
}

// ------------------------------------------------------------------ title backdrop

let backdropOn = false;
export function startBackdrop() {
  const r = ensure();
  if (!r) return;
  backdropOn = true;
  r.stadium.setTeams(['#c1121f', '#ffd166'], ['#1d3557', '#f1c40f'], 'LEGACY', 'GRIDIRON');
  r.stadium.world.position.set(0, 0, 0);
  r.stadium.hideLines();
  applyAtmosphere(r, 'night');
  start((dt, t) => {
    const a = t * 0.06;
    r.camera.position.set(Math.sin(a) * 75, 34 + Math.sin(t * 0.2) * 4, Math.cos(a) * 90);
    r.camera.lookAt(0, 0, 0);
    r.stadium.animateCrowd(t, 0.25);
  });
}

export function stopBackdrop() {
  if (!backdropOn) return;
  backdropOn = false;
  stop();
}

// ------------------------------------------------------------------ HUD

export function makeHud() {
  const el = document.createElement('div');
  el.className = 'hud';
  el.innerHTML = `
    <div class="hud-score"></div>
    <div class="hud-pclock"><small>PLAY CLOCK</small><b></b></div>
    <div class="hud-tag"></div>
    <div class="hud-top">
      <div class="hud-pill sit"></div>
      <div class="hud-right"><div class="hud-pill hud-call"></div><div class="hud-pill hud-wx"></div></div>
    </div>
    <div class="hud-comm"></div>
    <div class="hud-instr"></div>
    <div class="hud-mid"></div>
    <div class="hud-bottom"></div>`;
  document.body.append(el);
  const q = (s) => el.querySelector(s);
  let bigTimer = 0;
  return {
    el,
    top: (left, right) => { q('.sit').textContent = left; q('.hud-call').textContent = right; q('.hud-call').dataset.call = right.toLowerCase(); },
    weather: (label, wind) => {
      const el = q('.hud-wx');
      if (!label) { el.style.display = 'none'; return; }
      const deg = wind ? (Math.atan2(wind.z, wind.x) * 180) / Math.PI : 0;
      el.innerHTML = `${label}${wind && wind.mph >= 4 ? ` <span class="wind-arrow" style="transform:rotate(${deg}deg)">➜</span> ${wind.mph} mph` : ''}`;
    },
    /** Broadcast score bug: { away, home, awayPts, homePts, awayColors, homeColors, clock } */
    score: (i) => {
      const el2 = q('.hud-score');
      if (!i) { el2.style.display = 'none'; return; }
      const side = (name, pts, cols, right) => `<div class="sb-team${right ? ' r' : ''}" style="--c1:${cols[0]};--c2:${cols[1]}"><b>${String(name).slice(0, 3).toUpperCase()}</b><span>${pts}</span></div>`;
      el2.innerHTML = `${side(i.away, i.awayPts, i.awayColors, false)}<div class="sb-mid">${i.clock ?? ''}</div>${side(i.home, i.homePts, i.homeColors, true)}`;
    },
    /** Update just the game clock in the score bug (ticks during the play). */
    clock: (text) => { const m = q('.sb-mid'); if (m) m.textContent = text; },
    /** Play clock box: a number shows it (red at 5 and under), null hides it. */
    playClock: (n) => {
      const pc = q('.hud-pclock');
      if (n === null || n === undefined) { pc.classList.remove('show'); return; }
      pc.classList.add('show');
      pc.classList.toggle('low', n <= 5);
      pc.querySelector('b').textContent = String(Math.max(0, n)).padStart(2, '0');
    },
    /** Name tag for your player. */
    tag: (num, name, size = '') => { const t2 = q('.hud-tag'); t2.innerHTML = `<b>${num}</b><span>${String(name).toUpperCase()}${size ? `<small>${size}</small>` : ''}</span>`; },
    instr: (text) => { const i = q('.hud-instr'); i.textContent = text; i.classList.toggle('show', !!text); },
    big: (text, color = '#fff', ms = 1100) => {
      const b = document.createElement('div');
      b.className = 'hud-big';
      b.style.color = color;
      b.textContent = text;
      q('.hud-mid').replaceChildren(b);
      clearTimeout(bigTimer);
      bigTimer = setTimeout(() => b.remove(), ms);
    },
    /** Commentary banner (play-by-play). */
    say: (text, ms = 2200) => {
      speak(text, { hype: /!/.test(text) });
      const c = q('.hud-comm');
      c.textContent = text;
      c.classList.remove('show'); void c.offsetWidth; c.classList.add('show');
      clearTimeout(c._t);
      c._t = setTimeout(() => c.classList.remove('show'), ms);
    },
    bottom: (node) => { const b = q('.hud-bottom'); b.replaceChildren(); if (node) b.append(node); },
    remove: () => el.remove(),
  };
}

// ------------------------------------------------------------------ minigames

const GAMES = {
  qb_throw: freePlay, qb_hailmary: freePlay, qb_scramble: freePlay,
  rb_run: freePlay, rb_screen: freePlay, rb_goalline: goalLine,
  wr_route: freePlay, wr_jumpball: freePlay, wr_toetap: freePlay,
  cb_cover: freePlay, cb_tackle: freePlay, dt_rush: freePlay, dt_run: freePlay,
};

/**
 * Run a key-moment minigame. Resolves with the result object, or { fallbackQuality } in 2D mode.
 */
export function runMinigame(type, opts) {
  stopBackdrop();
  try { sweepActorCaches(); } catch (err) { console.error('cache sweep', err); } // free last play's faces/kits (phones run out of memory)
  const r = ensure();
  const app = document.getElementById('app');
  const hud = makeHud();
  app.style.visibility = 'hidden';
  return new Promise((resolve) => {
    const cleanups = [];
    startCrowd(0.3);
    if (R) R.playSpeed = opts.gameSpeed ?? 0.85; // plays run a bit slower than real time for a realistic feel
    const finish = (result) => {
      if (R) { R.timeScale = 1; R.playSpeed = 1; }
      stopCrowd();
      stopMusic();
      if (R) { R.cine = null; document.body.classList.remove('cine'); }
      for (const c of cleanups.reverse()) { try { c(); } catch { /* ignore */ } }
      stop();
      hud.remove();
      app.style.visibility = '';
      resolve(result);
    };
    const m = opts.moment;
    const sitText = `${m.label}${m.situation ? ` · ${m.situation}` : ''}`;
    hud.top(sitText, opts.call.toUpperCase());
    hud.weather(m.weather && m.weather !== 'clear' ? ({ night: 'Night', rain: 'Rain', storm: 'Storm', snow: 'Snow', wind: 'Wind', fog: 'Fog' }[m.weather] ?? '') : (m.wind?.mph >= 4 ? 'Breezy' : ''), m.wind);
    if (!r) {
      fallbackMeter({ hud, opts, done: finish, addCleanup: (f) => cleanups.push(f) });
      return;
    }
    // On defense, the opponent attacks toward the far end zone (ours).
    const myName = opts.teamName ?? 'HOME';
    const oppName = opts.oppName ?? 'OPP';
    // dress the stadium for this game; each step on its own so one failure (e.g. a phone out of canvas memory)
    // only skips that bit instead of freezing the play
    const safe = (f) => { try { f(); } catch (err) { console.error('stadium setup', err); } };
    safe(() => { if (opts.culture) r.stadium.setEnvironment?.(opts.culture.biome, opts.culture.seed, { night: m.weather === 'night', landmarks: opts.culture.landmarks }); });
    safe(() => {
      if (m.defense) r.stadium.setTeams(opts.teamColors, opts.oppColors, myName, oppName, opts.homeColors, opts.culture);
      else r.stadium.setTeams(opts.oppColors, opts.teamColors, oppName, myName, opts.homeColors, opts.culture);
    });
    safe(() => { if (opts.scoreInfo) { r.stadium.setScoreboard(opts.scoreInfo); hud.score(opts.scoreInfo); } });
    safe(() => { if (opts.lastName) hud.tag(opts.number ?? '', opts.lastName, opts.look?.heightIn ? `${Math.floor(opts.look.heightIn / 12)}'${opts.look.heightIn % 12}" · ${opts.look.weightLb} lb` : ''); });
    safe(() => { r.stadium.setBigGame?.(opts.bigGame); });
    safe(() => { r.stadium.setLevel?.(opts.stage ?? 'pro'); });
    safe(() => { r.stadium.setYardLine(m.yardLine, m.distance); });
    safe(() => { applyAtmosphere(r, m.weather ?? 'clear'); });
    // field weathering for this game (footprints, mud, churned snow)
    safe(() => { if (opts.wear?.key) r.stadium.fieldWear?.set(opts.wear.key, m.weather ?? 'clear', opts.wear.progress ?? 0); else r.stadium.fieldWear?.clear(); });
    const group = new THREE.Group();
    r.scene.add(group);
    cleanups.push(() => {
      r.scene.remove(group);
      group.traverse((o) => { if (o.isSprite && o.material.map && !o.material.map.isShared) o.material.map.dispose?.(); });
    });
    const ctx = {
      THREE, type, scene: r.scene, group, camera: r.camera, stadium: r.stadium, canvas: r.renderer.domElement, hud, opts,
      addCleanup: (f) => cleanups.push(f),
      done: finish,
      shake: cameraShake,
      slowMo,
      cinematic,
      /** Slow the whole play down (quick-time events). 1 = normal. */
      setTimeScale(s) { r.timeScale = s; },
      /** Grab the next rendered frame as a highlight picture. */
      snapshot(cb) { r.snapReq = cb; },
      /** Crowd hype: level 0..1 for some seconds (bouncing fans, camera flashes). */
      hype(level, seconds = 2) { r.hype = { level, until: performance.now() + seconds * 1000 }; },
      groundPoint(ev) {
        const rect = r.renderer.domElement.getBoundingClientRect();
        const ndc = new THREE.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
        const ray = new THREE.Raycaster();
        ray.setFromCamera(ndc, r.camera);
        const pt = new THREE.Vector3();
        return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), pt) ? pt : null;
      },
    };
    let errors = 0;
    const begin = () => {
    let update;
    // if the play can't be built (e.g. a phone out of graphics memory), sim it instead of freezing on a blank field
    try { update = GAMES[type](ctx); } catch (err) { console.error('play setup', err); finish({ fallbackQuality: 0.5 }); return; }
    start((dt, t) => {
      nextFrame();
      try { update(dt, t); } catch (err) {
        console.error('play error', err);
        // never leave the player stuck on a frozen play: auto-sim it instead
        if (++errors > 5) { finish({ fallbackQuality: 0.5 }); return; }
      }
      tickIdle(group, dt);
      const ex = r.hype && performance.now() < r.hype.until ? r.hype.level : 0.35;
      r.stadium.setExcitement(ex);
      r.stadium.animateCrowd(t, ex);
    });
    };
    // Broadcast shot between plays (mascot, coach, huddle...). Tap or press any key to skip.
    if (opts.interlude && !opts.reducedMotion) {
      let inter = null;
      try { inter = buildInterlude(opts.interlude, { group, camera: r.camera, stadium: r.stadium, opts, say: hud.say, hype: ctx.hype, roar: () => react('big', true) }); } catch (err) { console.error('interlude', err); }
      if (inter) {
        document.body.classList.add('cine');
        let skip = false;
        const sk = () => { skip = true; };
        window.addEventListener('pointerdown', sk); window.addEventListener('keydown', sk);
        const endInter = () => {
          window.removeEventListener('pointerdown', sk); window.removeEventListener('keydown', sk);
          document.body.classList.remove('cine');
          stop();
          r.stadium.setYardLine(m.yardLine, m.distance);
          begin();
        };
        let it = 0;
        start((dt, t) => {
          nextFrame();
          it += dt;
          let more = false;
          try { more = inter(dt, it) !== false && !skip; } catch (err) { console.error('interlude', err); }
          tickIdle(group, dt);
          const ex = r.hype && performance.now() < r.hype.until ? r.hype.level : 0.35;
          r.stadium.setExcitement(ex);
          r.stadium.animateCrowd(t, ex);
          if (!more) { if (skip) inter(0, 99); endInter(); }
        });
        return;
      }
    }
    begin();
  });
}

// ------------------------------------------------------------------ cutscenes

/**
 * Play a scripted cutscene in the stadium scene. build(ctx) returns update(dt, t) -> false when done.
 * ctx: { THREE, scene, group, camera, stadium, caption(text, sub), shake, slowMo }.
 * Resolves when it finishes or the player taps Skip. Without WebGL it resolves immediately.
 */
export function runCutscene(build, { setup } = {}) {
  stopBackdrop();
  try { sweepActorCaches(); } catch (err) { console.error('cache sweep', err); } // free last play's faces/kits (phones run out of memory)
  const r = ensure();
  if (!r) return Promise.resolve();
  const app = document.getElementById('app');
  app.style.visibility = 'hidden';
  const ui = document.createElement('div');
  ui.className = 'cutscene-ui';
  ui.innerHTML = '<div class="cut-caption"><div class="cut-main"></div><div class="cut-sub"></div></div><button class="btn small cut-skip">Skip ▸</button>';
  document.body.append(ui);
  document.body.classList.add('cine');
  return new Promise((resolve) => {
    const group = new THREE.Group();
    r.scene.add(group);
    r.stadium.hideLines();
    r.stadium.fieldWear?.clear();
    applyAtmosphere(r, 'clear');
    setup?.(r);
    let done = false;
    startCrowd(0.6);
    playMusic('anthem', { vol: 0.9 });
    const finish = () => {
      if (done) return;
      done = true;
      stopCrowd();
      stopMusic();
      stop();
      r.scene.remove(group);
      ui.remove();
      document.body.classList.remove('cine');
      app.style.visibility = '';
      resolve();
    };
    ui.querySelector('.cut-skip').onclick = finish;
    const main = ui.querySelector('.cut-main');
    const sub = ui.querySelector('.cut-sub');
    const ctx = {
      THREE, scene: r.scene, group, camera: r.camera, stadium: r.stadium, shake: cameraShake, slowMo,
      caption(text, subText = '') {
        main.textContent = text;
        sub.textContent = subText;
        ui.querySelector('.cut-caption').classList.remove('show');
        void main.offsetWidth;
        ui.querySelector('.cut-caption').classList.add('show');
      },
    };
    const update = build(ctx);
    start((dt, t) => {
      nextFrame();
      if (update(dt, t) === false) finish();
      tickIdle(group, dt);
      r.stadium.animateCrowd(t, 0.8);
    });
  });
}

// ------------------------------------------------------------------ walkable world

let world = null;

/** Start a walkable place. ctx: { state, lookFor, nameFor, check, onFocus }. Returns the world controller. */
export function runWorld(placeId, ctx) {
  stopBackdrop();
  stopWorld();
  const r = ensure();
  if (!r) return null;
  const scene = new THREE.Scene();
  const outdoor = ['park', 'downtown'].includes(placeId);
  const wx = outdoor ? ctx.weather ?? 'clear' : 'clear';
  const sky = { rain: '#7d8a99', storm: '#4a525c', snow: '#c4ccd4', fog: '#c0c6cc', night: '#8fd0f2' }[wx] ?? '#8fd0f2';
  scene.background = new THREE.Color(outdoor ? sky : '#1a1d22');
  if (outdoor) scene.fog = new THREE.Fog(sky, wx === 'fog' ? 14 : 70, wx === 'fog' ? 50 : 170);
  scene.environment = r.scene.environment; // same soft image lighting as the stadium
  scene.environmentIntensity = outdoor ? 0.6 : 0.45;
  R.active = scene;
  world = buildWorld(placeId, { ...ctx, scene, camera: r.camera });
  const particles = outdoor ? makeWeather(scene) : null;
  particles?.set(wx === 'night' ? 'clear' : wx, r.camera);
  start((dt) => {
    nextFrame();
    world?.update(dt);
    particles?.update(dt, r.camera);
  });
  return world;
}

export function stopWorld() {
  if (world) { world.dispose(); world = null; }
  if (R) R.active = null;
  stop();
}

export function webglAvailable() {
  return !!ensure();
}

// ------------------------------------------------------------------ indoor sets (locker room, banquet, date night...)

function newSetScene(r, bg = '#15171b') {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(bg);
  scene.environment = r.scene.environment;
  scene.environmentIntensity = 0.4;
  return scene;
}

/**
 * Open a persistent 3D set behind the menus (the halftime locker room). build({ THREE, scene, camera }) returns
 * update(dt, t). Returns { close() } or null without WebGL. The caller owns any UI drawn on top.
 */
export function openSet(build, { bg } = {}) {
  stopBackdrop();
  const r = ensure();
  if (!r) return null;
  const scene = newSetScene(r, bg);
  R.active = scene;
  let update = null;
  try { update = build({ THREE, scene, camera: r.camera }); } catch (err) { console.error('set', err); R.active = null; return null; }
  let t = 0;
  start((dt) => {
    nextFrame();
    t += dt;
    try { update?.(dt, t); } catch (err) { console.error('set update', err); update = null; }
    tickIdle(scene, dt);
  });
  return { close() { stop(); if (R) R.active = null; } };
}

/**
 * Play a short scripted scene on its own set. build(ctx) returns update(dt, t) -> false when done.
 * ctx: { THREE, scene, camera, caption(text, sub) }. Resolves when it ends or the player taps Skip.
 */
export function runSetCutscene(build, { bg, music = 'groove', crowd = 0 } = {}) {
  stopBackdrop();
  try { sweepActorCaches(); } catch (err) { console.error('cache sweep', err); } // free last play's faces/kits (phones run out of memory)
  const r = ensure();
  if (!r) return Promise.resolve();
  const app = document.getElementById('app');
  const prevVis = app.style.visibility;
  app.style.visibility = 'hidden';
  const ui = document.createElement('div');
  ui.className = 'cutscene-ui';
  ui.innerHTML = '<div class="cut-caption"><div class="cut-main"></div><div class="cut-sub"></div></div><button class="btn small cut-skip">Skip ▸</button>';
  document.body.append(ui);
  document.body.classList.add('cine');
  const prevActive = R.active;
  const wasLoop = loopFn;
  return new Promise((resolve) => {
    const scene = newSetScene(r, bg);
    R.active = scene;
    let done = false;
    if (music) playMusic(music, { vol: 0.6 });
    if (crowd) startCrowd(crowd); // a live audience (draft night): ctx.audio.react / setCrowd drive it
    const finish = () => {
      if (done) return;
      done = true;
      stopMusic();
      if (crowd) stopCrowd();
      ui.remove();
      document.body.classList.remove('cine');
      app.style.visibility = prevVis;
      R.active = prevActive ?? null;
      if (wasLoop) loopFn = wasLoop; else stop(); // hand the render loop back (e.g. to the walkable world)
      resolve();
    };
    ui.querySelector('.cut-skip').onclick = finish;
    const main = ui.querySelector('.cut-main');
    const sub = ui.querySelector('.cut-sub');
    const ctx = {
      THREE, scene, camera: r.camera,
      audio: { react, setCrowd, music: (name, o) => playMusic(name, o), stopMusic },
      caption(text, subText = '') {
        main.textContent = text; sub.textContent = subText;
        const c = ui.querySelector('.cut-caption'); c.classList.remove('show'); void main.offsetWidth; c.classList.add('show');
      },
    };
    let update;
    try { update = build(ctx); } catch (err) { console.error('set cutscene', err); finish(); return; }
    let t = 0;
    start((dt) => {
      nextFrame();
      t += dt;
      let more = false;
      try { more = update(dt, t) !== false; } catch (err) { console.error('set cutscene', err); }
      tickIdle(scene, dt);
      if (!more) finish();
    });
  });
}
