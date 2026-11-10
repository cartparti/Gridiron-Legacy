// Small 3D portraits of characters for menus (people list, phone, character creation).
// Uses one shared offscreen renderer and caches each image.
import * as THREE from 'three';
import { makePerson, makePlayer, animateRun } from './actors.js';

let R = null;
const cache = new Map();

function ensure() {
  if (R) return R;
  try {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(160, 200, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#e8f0ff', '#4a4a4a', 1.1));
    const sun = new THREE.DirectionalLight('#fff1dc', 2.6);
    sun.position.set(-2, 4, -5);
    scene.add(sun);
    const rim = new THREE.DirectionalLight('#cfe0ff', 1.2);
    rim.position.set(3, 2, 4);
    scene.add(rim);
    const camera = new THREE.PerspectiveCamera(30, 80 / 100, 0.1, 50);
    R = { renderer, scene, camera };
  } catch {
    R = false;
  }
  return R;
}

/**
 * Returns a data URL of a pixel portrait. spec is a person look, or a player
 * { colors, uniform, look, number, helmet } (helmet defaults to off so the face shows).
 * opts: { full: full body, yaw: turn, big: render at 2x resolution }
 */
export function portraitURL(spec, { full = false, yaw = 0.35, big = false } = {}) {
  const key = JSON.stringify(spec) + (full ? 'F' : '') + yaw + big;
  if (cache.has(key)) return cache.get(key);
  const r = ensure();
  if (!r) return null;
  const isPlayer = spec.colors || spec.uniform;
  const model = isPlayer
    ? makePlayer(spec.colors ?? [spec.uniform.jersey, spec.uniform.trim], { number: spec.number ?? 1, uniform: spec.uniform, look: spec.look ?? { skin: spec.skin ?? 2 }, helmet: spec.helmet ?? false })
    : makePerson(spec);
  r.renderer.setSize(big ? 320 : 160, big ? 400 : 200, false);
  model.rotation.y = Math.PI + yaw; // face the camera, slight turn
  model.userData.u.targetYaw = model.rotation.y;
  for (let i = 0; i < 4; i++) animateRun(model, 0.1, 0);
  r.scene.add(model);
  const hs = model.userData.rig.body.scale.y;
  if (full) { r.camera.position.set(0, 1.12 * hs, 4.0); r.camera.lookAt(0, 1.02 * hs, 0); }
  else { r.camera.position.set(0, 1.72 * hs, 1.75); r.camera.lookAt(0, 1.63 * hs, 0); }
  r.renderer.setClearColor(0x000000, 0);
  r.renderer.render(r.scene, r.camera);
  const url = r.renderer.domElement.toDataURL('image/png');
  r.scene.remove(model);
  cache.set(key, url);
  return url;
}

/** <img> element for a portrait (falls back to a colored circle without WebGL). */
export function portraitImg(spec, size = 48, opts = {}) {
  const url = portraitURL(spec, opts);
  const img = document.createElement(url ? 'img' : 'div');
  img.style.cssText = `width:${size * 0.8}px;height:${size}px;flex:none;object-fit:contain;${url ? '' : `border-radius:50%;background:${spec.shirt ?? spec.colors?.[0] ?? '#888'}`}`;
  if (url) { img.src = url; img.alt = ''; }
  return img;
}
