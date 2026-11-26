import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as flow from '../src/sim/flow.js';
import { randomCareerOpts } from '../src/sim/bot.js';
import { saveGame, loadGame, deleteSave, autoBackup, listBackups, restoreBackup } from '../src/core/storage.js';
import { tolerance } from '../src/sim/game.js';

const career = (seed) => { const st = flow.newCareer(randomCareerOpts(seed, 'RB')); while (st.phase === 'event') flow.resolveEvent(st, 0); return st; };

test('automatic backups: keep the last 3, survive deleting the slot, restore exactly', async () => {
  const st = career(7);
  saveGame(2, st);
  for (let i = 1; i <= 4; i++) { st.player.money = i * 1000; assert.ok(await autoBackup(2, st, `point ${i}`)); }
  const list = listBackups(2);
  assert.equal(list.length, 3, 'only the last 3 are kept');
  assert.equal(list[0].label, 'point 4');
  deleteSave(2);
  assert.equal(loadGame(2), null);
  assert.equal(listBackups(2).length, 3, 'backups survive deleting the slot');
  await restoreBackup(2, 1); // (returns false in Node: no browser storage, but the memory copy is restored)
  const back = loadGame(2);
  assert.equal(back.player.money, 3000, 'restored the chosen point');
  assert.equal(back.player.first, st.player.first);
});

test('timing slider widens or narrows the windows; default is unchanged', () => {
  const st = career(8);
  flow.submitPlan(st, [null, null, null, null, null]);
  const base = tolerance(st);
  st.sliders = { timing: 'wide' }; const wide = tolerance(st);
  st.sliders = { timing: 'pinpoint' }; const tight = tolerance(st);
  assert.ok(wide > base && tight < base);
  st.sliders = { timing: 'normal' };
  assert.equal(tolerance(st), base);
});
