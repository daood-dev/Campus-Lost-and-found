const bus = require('../eventBus');
const EVENTS = require('../events');
const Item = require('../../models/Item');
const Match = require('../../models/Match');
const { scoreMatch } = require('../../services/matchingService');
const { MATCH_THRESHOLD } = require('../../config/constants');

async function runMatching(item) {
  if (!item || item.is_hidden) return;
  const candidates = Item.candidatesFor(item);
  for (const other of candidates) {
    const lost = item.report_type === 'Lost' ? item : other;
    const found = item.report_type === 'Found' ? item : other;
    const score = scoreMatch(lost, found);
    if (score < MATCH_THRESHOLD) continue;
    const { created, match } = Match.createIfNew(lost.item_id, found.item_id, score);
    if (!created) continue; // duplicate event or known pair -> no repeat notification
    Item.markMatchedIfOpen(lost.item_id);
    Item.markMatchedIfOpen(found.item_id);
    await bus.publish(EVENTS.POTENTIAL_MATCH_IDENTIFIED, { matchId: match.match_id });
  }
}

function register() {
  bus.subscribe(EVENTS.LOST_ITEM_REPORTED, ({ itemId }) => runMatching(Item.findById(itemId)));
  bus.subscribe(EVENTS.FOUND_ITEM_REPORTED, ({ itemId }) => runMatching(Item.findById(itemId)));
}

module.exports = { register, runMatching };
