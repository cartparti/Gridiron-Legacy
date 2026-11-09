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
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#ffffff', '#555555', 1.8));
    const sun = new THREE.DirectionalLight('#fff3dc', 1.8);
    sun.position.set(-2, 4, -5);
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(30, 160 / 200, 0.1, 50);
    R = { renderer, scene, camera };
  } catch {
    R = false;
  }
  return R;
}

/** Returns a data URL of a head-and-shoulders portrait. kind 'person' (look) or 'player' ({ colors, number, skin }). */
export function portraitURL(spec, { full = false } = {}) {
  const key = JSON.stringify(spec) + (full ? 'F' : '');
  if (cache.has(key)) return cache.get(key);
  const r = ensure();
  if (!r) return null;
  const model = spec.colors ? makePlayer(spec.colors, { number: spec.number ?? 1, skin: spec.skin ?? 1, build: spec.build ?? 1, height: spec.height ?? 1 }) : makePerson(spec);
  model.rotation.y = Math.PI + 0.35; // face the camera, slight turn
  model.userData.u.targetYaw = model.rotation.y;
  for (let i = 0; i < 4; i++) animateRun(model, 0.1, 0);
  r.scene.add(model);
  if (full) { r.camera.position.set(0, 1.15, 5.2); r.camera.lookAt(0, 1.0, 0); }
  else { r.camera.position.set(0, 1.75, 2.4); r.camera.lookAt(0, 1.6, 0); }
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
