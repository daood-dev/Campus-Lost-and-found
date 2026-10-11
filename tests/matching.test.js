const test = require('node:test');
const assert = require('node:assert');
const { scoreMatch } = require('../src/services/matchingService');

const lost = { title: 'Black wallet', description: 'Black leather wallet near library', category: 'Wallet', location: 'Main Library', item_date: '2026-10-01' };

test('same category, text, place and date scores very high', () => {
  const found = { ...lost, title: 'Black leather wallet', item_date: '2026-10-02' };
  assert.ok(scoreMatch(lost, found) >= 90);
});
test('different category never matches', () => {
  assert.strictEqual(scoreMatch(lost, { ...lost, category: 'Keys' }), 0);
});
test('different place and unrelated text scores below the threshold', () => {
  const found = { title: 'Wallet', description: 'Brown pouch', category: 'Wallet', location: 'Sports Ground', item_date: '2026-10-20' };
  assert.ok(scoreMatch(lost, found) < 55);
});
test('item found long before it was lost is penalised on date', () => {
  const early = scoreMatch(lost, { ...lost, item_date: '2026-09-01' });
  const near = scoreMatch(lost, { ...lost, item_date: '2026-10-01' });
  assert.ok(near > early);
});
