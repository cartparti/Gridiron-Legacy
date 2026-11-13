import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulateCareer, randomCareerOpts } from '../src/sim/bot.js';
import { friendCard, cleanCard, addFriend, leaderboard } from '../src/sim/friends.js';
import { encodeCard, decodeCard, shareLink } from '../src/core/friendcode.js';

test('a friend card survives a share link round trip', async () => {
  const st = simulateCareer(randomCareerOpts(9, 'WR'));
  const card = friendCard(st);
  const link = shareLink(await encodeCard(card));
  assert.ok(link.includes('#friend=GLF'));
  const back = cleanCard(await decodeCard(`hey add me ${link} thanks`));
  assert.equal(back.id, card.id);
  assert.equal(back.legacy, card.legacy);
  assert.equal(back.at, card.at);
  assert.deepEqual(back.house.rooms, card.house.rooms);
  assert.equal(await decodeCard('not a code'), null);
});

test('friends list: add, update with newer, ignore older and your own card, junk rejected', () => {
  const a = { ...friendCard(simulateCareer(randomCareerOpts(3, 'QB'))), id: 'aaa', at: 100 };
  let r = addFriend([], a);
  assert.equal(r.status, 'added');
  r = addFriend(r.list, { ...a, at: 200, legacy: 999 });
  assert.equal(r.status, 'updated'); assert.equal(r.list[0].legacy, 999);
  assert.equal(addFriend(r.list, { ...a, at: 50 }).status, 'older');
  assert.equal(addFriend(r.list, a, 'aaa').status, 'self');
  assert.equal(addFriend(r.list, { v: 99 }).status, 'bad');
  assert.equal(addFriend(r.list, { ...a, id: 'evil', first: '<img src=x>'.repeat(20), money: 'lots' }).card.first.length, 24);
});

test('leaderboard ranks you among friends', () => {
  const me = { ...friendCard(simulateCareer(randomCareerOpts(5, 'CB'))), legacy: 50 };
  const f = [{ ...me, id: 'x', legacy: 80, first: 'X' }, { ...me, id: 'y', legacy: 10, first: 'Y' }].map(cleanCard);
  const rows = leaderboard(f, me, 'legacy');
  assert.deepEqual(rows.map((r) => r.card.first), ['X', me.first, 'Y']);
  assert.ok(rows[1].me);
});
