// Owns the single WebGL renderer, the stadium, the render loop, the HUD overlay,
// and launches minigames. If WebGL is unavailable, a simple 2D timing meter is used instead.
import * as THREE from 'three';
import { buildStadium } from './stadium.js';
import { qbThrow } from './minigames/qbThrow.js';
import { rbRun } from './minigames/rbRun.js';
import { wrCatch } from './minigames/wrCatch.js';
import { fallbackMeter } from './minigames/fallback.js';

let R = null;
let failed = false;
let raf = 0;
let loopFn = null;
let elapsed = 0;

function ensure() {
  if (R) return R;
  if (failed) return null;
  try {
    const el = document.getElementById('stage');
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.append(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0d1b2a');
    scene.fog = new THREE.Fog('#0d1b2a', 90, 220);
    const camera = new THREE.PerspectiveCamera(55, 1, 0.3, 500);
    scene.add(new THREE.HemisphereLight('#dbe9ff', '#2f4f2f', 1.6));
    const sun = new THREE.DirectionalLight('#fff6e0', 1.7);
    sun.position.set(30, 60, 25);
    scene.add(sun);
    const stadium = buildStadium(scene);
    const clock = new THREE.Clock();
    R = { renderer, scene, camera, stadium, clock, el };
    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      // Portrait phones need a taller field of view to see receivers out wide.
      camera.fov = camera.aspect < 0.75 ? 66 : camera.aspect < 1.2 ? 58 : 50;
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
  elapsed += dt;
  if (loopFn) loopFn(dt, elapsed);
  R.renderer.render(R.scene, R.camera);
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

// ------------------------------------------------------------------ title backdrop

let backdropOn = false;
export function startBackdrop() {
  const r = ensure();
  if (!r) return;
  backdropOn = true;
  r.stadium.setTeams(['#b5121b', '#f5d547'], ['#1d3557', '#f1c40f'], 'Legacy', 'Gridiron');
  r.stadium.world.position.set(0, 0, 0);
  r.stadium.hideLines();
  start((dt, t) => {
    const a = t * 0.07;
    r.camera.position.set(Math.sin(a) * 70, 26 + Math.sin(t * 0.2) * 4, Math.cos(a) * 85);
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
  el.innerHTML = '<div class="top"><div class="sit"></div><div class="sit call"></div></div><div class="instr"></div><div class="mid"></div><div class="bottom"></div>';
  document.body.append(el);
  const q = (s) => el.querySelector(s);
  let bigTimer = 0;
  return {
    el,
    top: (left, right) => { q('.sit').textContent = left; q('.call').textContent = right; },
    instr: (text) => { q('.instr').textContent = text; q('.instr').style.display = text ? '' : 'none'; },
    big: (text, color = '#fff', ms = 1100) => {
      const b = document.createElement('div');
      b.className = 'big';
      b.style.color = color;
      b.textContent = text;
      q('.mid').append(b);
      clearTimeout(bigTimer);
      bigTimer = setTimeout(() => b.remove(), ms);
    },
    bottom: (node) => { const b = q('.bottom'); b.innerHTML = ''; if (node) b.append(node); },
    remove: () => el.remove(),
  };
}


// ------------------------------------------------------------------ minigames

const GAMES = { qb_throw: qbThrow, rb_run: rbRun, wr_catch: wrCatch };

/**
 * Run a key-moment minigame. Resolves with
 * { quality, yards, td, turnover, sack, complete, text } or { fallbackQuality } in 2D mode.
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
    if (!r) {
      fallbackMeter({ hud, opts, done: finish, addCleanup: (f) => cleanups.push(f) });
      return;
    }
    const m = opts.moment;
    const offenseFar = opts.oppColors;
    r.stadium.setTeams(offenseFar, opts.teamColors, 'OPP', 'HOME', opts.homeColors);
    r.stadium.setYardLine(m.yardLine, m.distance);
    const group = new THREE.Group();
    r.scene.add(group);
    cleanups.push(() => {
      r.scene.remove(group);
      group.traverse((o) => { if (o.isSprite) o.material.map?.dispose(); });
    });
    const ctx = {
      THREE, scene: r.scene, group, camera: r.camera, stadium: r.stadium, canvas: r.renderer.domElement, hud, opts,
      addCleanup: (f) => cleanups.push(f),
      done: finish,
      /** Raycast a pointer event to the ground plane (y = 0). */
      groundPoint(ev) {
        const rect = r.renderer.domElement.getBoundingClientRect();
        const ndc = new THREE.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
        const ray = new THREE.Raycaster();
        ray.setFromCamera(ndc, r.camera);
        const pt = new THREE.Vector3();
        return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), pt) ? pt : null;
      },
    };
    const sitText = `${m.label}${m.clutch ? ' · CLUTCH' : ''}`;
    hud.top(sitText, opts.call.toUpperCase());
    const update = GAMES[type](ctx);
    start((dt, t) => {
      update(dt, t);
      r.stadium.animateCrowd(t, 0.35);
    });
  });
}
