import test from 'node:test';
import assert from 'node:assert/strict';
import { randomLook, FACE_PRESETS, FACE_SLIDER_DEFS, normalizeLook, defaultLook } from '../src/data/looks.js';

test('random looks get face sliders in range', () => {
  for (let i = 0; i < 50; i++) {
    const L = randomLook(`s${i}`);
    for (const [k] of FACE_SLIDER_DEFS) assert.ok(L.fs[k] >= -1 && L.fs[k] <= 1, `${k}=${L.fs[k]}`);
  }
});

test('face presets use valid options and slider keys', () => {
  const keys = new Set(FACE_SLIDER_DEFS.map(([k]) => k));
  assert.ok(FACE_PRESETS.length >= 10);
  for (const p of FACE_PRESETS) for (const k of Object.keys(p.f.fs)) assert.ok(keys.has(k), `${p.id}.${k}`);
  assert.equal(new Set(FACE_PRESETS.map((p) => p.label)).size, FACE_PRESETS.length);
});

test('old looks without sliders still normalize', () => {
  const L = { ...defaultLook('QB') }; delete L.fs;
  assert.equal(normalizeLook(L).fs, undefined); // the renderer treats missing sliders as 0
});
