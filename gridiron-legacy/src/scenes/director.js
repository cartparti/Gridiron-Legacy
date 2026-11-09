// Owns the single WebGL renderer (drawn at low resolution and scaled up with crisp pixels),
// the stadium, the render loop, weather effects, the HUD overlay, and launches minigames.
// If WebGL is unavailable, a simple 2D timing meter is used instead.
import * as THREE from 'three';
import { buildStadium } from './stadium.js';
import { nextFrame, tickIdle } from './actors.js';
import { buildWorld } from './world.js';
import { passPlay } from './minigames/passPlay.js';
import { runPlay } from './minigames/runPlay.js';
import { routePlay } from './minigames/routePlay.js';
import { goalLine } from './minigames/goalLine.js';
import { coverPlay } from './minigames/coverPlay.js';
import { tacklePlay } from './minigames/tacklePlay.js';
import { fallbackMeter } from './minigames/fallback.js';

let R = null;
let failed = false;
let raf = 0;
let loopFn = null;
let elapsed = 0;
let shake = 0;

/** Internal render width in pixels: low on purpose for the retro look. */
function pixelWidth(w) {
  return Math.round(Math.max(320, Math.min(640, w / 1.25)));
}

function ensure() {
  if (R) return R;
  if (failed) return null;
  try {
    const el = document.getElementById('stage');
    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.classList.add('pixelated');
    el.append(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#5aa0d8');
    const camera = new THREE.PerspectiveCamera(36, 1, 1, 600);
    const stadium = buildStadium(scene);
    const clock = new THREE.Clock();
    const weather = makeWeather(scene);
    R = { renderer, scene, camera, stadium, clock, el, weather };
    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const pw = pixelWidth(w);
      renderer.setSize(pw, Math.round((pw * h) / w), false);
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
  const slow = R.slowmo > 0 ? 0.3 : 1;
  R.slowmo = Math.max(0, (R.slowmo ?? 0) - dt);
  elapsed += dt * slow;
  if (loopFn) loopFn(dt * slow, elapsed);
  R.weather.update(dt, R.camera);
  if (!R.active) updateLightning(R, dt);
  if (shake > 0) {
    shake = Math.max(0, shake - dt);
    R.camera.position.x += (Math.random() - 0.5) * shake * 1.5;
    R.camera.position.y += (Math.random() - 0.5) * shake * 1.5;
  }
  R.renderer.render(R.active ?? R.scene, R.camera);
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
  r.scene.fog = weather === 'fog' ? new THREE.Fog(sky, 18, 55)
    : weather === 'night' ? new THREE.Fog(sky, 120, 260)
      : weather === 'rain' || weather === 'snow' || weather === 'storm' ? new THREE.Fog(sky, 50, 150) : null;
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
    <div class="hud-top">
      <div class="hud-pill sit"></div>
      <div class="hud-right"><div class="hud-pill hud-call"></div><div class="hud-pill hud-wx"></div></div>
    </div>
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
    bottom: (node) => { const b = q('.hud-bottom'); b.replaceChildren(); if (node) b.append(node); },
    remove: () => el.remove(),
  };
}

// ------------------------------------------------------------------ minigames

const GAMES = {
  qb_throw: passPlay, qb_hailmary: passPlay,
  rb_run: runPlay, qb_scramble: runPlay, rb_screen: runPlay,
  rb_goalline: goalLine,
  wr_route: routePlay, wr_jumpball: routePlay, wr_toetap: routePlay, wr_catch: routePlay,
  cb_cover: coverPlay, cb_tackle: tacklePlay,
};

/**
 * Run a key-moment minigame. Resolves with the result object, or { fallbackQuality } in 2D mode.
 */
export function runMinigame(type, opts) {
  stopBackdrop();
  const r = ensure();
  const app = document.getElementById('app');
  const hud = makeHud();
  app.style.visibility = 'hidden';
  return new Promise((resolve) => {
    const cleanups = [];
    const finish = (result) => {
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
    if (m.defense) r.stadium.setTeams(opts.teamColors, opts.oppColors, 'HOME', 'OPP', opts.homeColors);
    else r.stadium.setTeams(opts.oppColors, opts.teamColors, 'OPP', 'HOME', opts.homeColors);
    r.stadium.setYardLine(m.yardLine, m.distance);
    applyAtmosphere(r, m.weather ?? 'clear');
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
      groundPoint(ev) {
        const rect = r.renderer.domElement.getBoundingClientRect();
        const ndc = new THREE.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
        const ray = new THREE.Raycaster();
        ray.setFromCamera(ndc, r.camera);
        const pt = new THREE.Vector3();
        return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), pt) ? pt : null;
      },
    };
    const update = GAMES[type](ctx);
    start((dt, t) => {
      nextFrame();
      update(dt, t);
      tickIdle(group, dt);
      r.stadium.animateCrowd(t, 0.35);
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
  scene.background = new THREE.Color(outdoor ? sky : '#14181d');
  if (outdoor) scene.fog = new THREE.Fog(sky, wx === 'fog' ? 14 : 60, wx === 'fog' ? 50 : 140);
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
