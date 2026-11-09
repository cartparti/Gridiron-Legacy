import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveGame, loadGame, listSlots, deleteSave, exportSave, importSave, loadSettings, saveSettings, SLOT_COUNT } from '../src/core/storage.js';
import * as flow from '../src/sim/flow.js';
import { randomCareerOpts } from '../src/sim/bot.js';

// Node has no localStorage, so this exercises the in-memory fallback path
// (the same path used when a browser blocks storage).

test('save, list, load and delete a slot', () => {
  const state = flow.newCareer(randomCareerOpts(1));
  assert.equal(listSlots().length, SLOT_COUNT);
  assert.ok(listSlots().every((s) => s.empty));
  saveGame(1, state);
  const slots = listSlots();
  assert.equal(slots[1].empty, false);
  assert.equal(slots[1].meta.name, `${state.player.first} ${state.player.last}`);
  const loaded = loadGame(1);
  assert.equal(loaded.player.last, state.player.last);
  assert.equal(loaded.rngState, state.rngState);
  deleteSave(1);
  assert.equal(loadGame(1), null);
});

test('export and import a save', () => {
  const state = flow.newCareer(randomCareerOpts(2));
  saveGame(0, state);
  const text = exportSave(0);
  assert.ok(importSave(2, text) !== undefined);
  assert.equal(loadGame(2).player.last, state.player.last);
  assert.equal(importSave(2, 'not json'), false);
  assert.equal(importSave(2, '{"state":{}}'), false);
});

test('settings have defaults and persist', () => {
  const s = loadSettings();
  assert.equal(s.sound, true);
  saveSettings({ ...s, sound: false });
  assert.equal(loadSettings().sound, false);
});

test('a broken localStorage does not crash anything', () => {
  globalThis.localStorage = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('quota'); },
    removeItem() { throw new Error('blocked'); },
  };
  try {
    const state = flow.newCareer(randomCareerOpts(3));
    saveGame(0, state);
    assert.equal(loadGame(0).player.last, state.player.last);
    deleteSave(0);
    listSlots();
  } finally {
    delete globalThis.localStorage;
  }
});
