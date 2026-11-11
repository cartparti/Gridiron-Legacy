import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomLook, defaultLook, JAWS, CHEEKS, CHINS, FACE_WIDTHS } from '../src/data/looks.js';

test('everyone gets their own face build (jaw, cheekbones, chin, width)', () => {
  const ids = (l) => l.map((x) => x.id);
  const seen = new Set();
  for (let i = 0; i < 80; i++) {
    const L = randomLook('face' + i, { gender: i % 2 ? 'f' : 'm' });
    assert.ok(ids(JAWS).includes(L.jaw));
    assert.ok(ids(CHEEKS).includes(L.cheek));
    assert.ok(ids(CHINS).includes(L.chin));
    assert.ok(ids(FACE_WIDTHS).includes(L.faceW));
    seen.add(`${L.headShape}|${L.jaw}|${L.cheek}|${L.chin}|${L.faceW}|${L.nose}`);
  }
  assert.ok(seen.size > 50, `only ${seen.size} different faces in 80 people`);
  const d = defaultLook('QB');
  assert.equal(d.jaw, 'defined');
});
