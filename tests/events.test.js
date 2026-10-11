const test = require('node:test');
const assert = require('node:assert');
const { init, getDb } = require('../src/config/db');
init(':memory:');
const User = require('../src/models/User');
const Item = require('../src/models/Item');
const Notification = require('../src/models/Notification');
const Match = require('../src/models/Match');
const claimService = require('../src/services/claimService');
const { registerHandlers } = require('../src/events');
const bus = require('../src/events/eventBus');
const EVENTS = require('../src/events/events');

registerHandlers();
const u = (n, role = 'student') => User.create({ fullName: n, email: `${n}@t.edu`, passwordHash: 'x', role });
const admin = u('admin', 'admin');
const owner = u('owner');
const finder = u('finder');
const base = { category: 'Wallet', location: 'Main Library', itemDate: new Date().toISOString().slice(0, 10) };

test('FoundItemReported creates one match and notifies both users once', async () => {
  const lost = Item.create({ ...base, userId: owner.user_id, reportType: 'Lost', title: 'Black wallet', description: 'Black leather wallet' });
  await bus.publish(EVENTS.LOST_ITEM_REPORTED, { itemId: lost.item_id });
  const found = Item.create({ ...base, userId: finder.user_id, reportType: 'Found', title: 'Black leather wallet', description: 'Found a black wallet' });
  await bus.publish(EVENTS.FOUND_ITEM_REPORTED, { itemId: found.item_id });
  // Re-delivering the same event must not duplicate matches or notifications
  await bus.publish(EVENTS.FOUND_ITEM_REPORTED, { itemId: found.item_id });

  assert.strictEqual(Match.forItem(lost.item_id).length, 1);
  assert.strictEqual(Notification.forUser(owner.user_id).length, 1);
  assert.strictEqual(Notification.forUser(finder.user_id).length, 1);
  assert.strictEqual(Item.findById(lost.item_id).status, 'Matched');
  global.foundId = found.item_id;
});

test('claim flow: submit, approve, then recovered with notifications', async () => {
  const res = claimService.submit({ itemId: global.foundId, claimantId: owner.user_id, details: 'Blue sticker on the back' });
  assert.ok(res.claim);
  await new Promise((r) => setTimeout(r, 20));
  assert.strictEqual(Item.findById(global.foundId).status, 'Under Review');
  assert.ok(Notification.forUser(admin.user_id).length >= 1);

  assert.ok(claimService.markRecovered({ itemId: global.foundId, adminId: admin.user_id }).error, 'cannot recover before approval');
  claimService.review({ claimId: res.claim.claim_id, adminId: admin.user_id, decision: 'approve' });
  await new Promise((r) => setTimeout(r, 20));
  assert.strictEqual(Item.findById(global.foundId).status, 'Claimed');
  assert.ok(Notification.forUser(owner.user_id).some((n) => n.event_type === EVENTS.CLAIM_REVIEWED));

  assert.ok(claimService.markRecovered({ itemId: global.foundId, adminId: admin.user_id }).item);
  assert.strictEqual(Item.findById(global.foundId).status, 'Recovered');
});

test('users cannot claim their own report or claim twice', () => {
  const mine = Item.create({ ...base, userId: finder.user_id, reportType: 'Found', title: 'Keys', description: 'Some keys here', category: 'Keys' });
  assert.ok(claimService.submit({ itemId: mine.item_id, claimantId: finder.user_id, details: 'x'.repeat(20) }).error);
  assert.ok(claimService.submit({ itemId: mine.item_id, claimantId: owner.user_id, details: 'x'.repeat(20) }).claim);
  assert.ok(claimService.submit({ itemId: mine.item_id, claimantId: owner.user_id, details: 'x'.repeat(20) }).error);
});

test('every published event is written to the event log', () => {
  const n = getDb().prepare('SELECT COUNT(*) AS n FROM event_log').get().n;
  assert.ok(n >= 3);
});
