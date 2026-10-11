const bus = require('../eventBus');
const EVENTS = require('../events');
const Item = require('../../models/Item');
const Match = require('../../models/Match');
const Claim = require('../../models/Claim');
const User = require('../../models/User');
const Notification = require('../../models/Notification');

function register() {
  bus.subscribe(EVENTS.POTENTIAL_MATCH_IDENTIFIED, ({ matchId }) => {
    const match = Match.findById(matchId);
    if (!match) return;
    const lost = Item.findById(match.lost_item_id);
    const found = Item.findById(match.found_item_id);
    if (!lost || !found) return;
    Notification.create({
      userId: lost.user_id, type: EVENTS.POTENTIAL_MATCH_IDENTIFIED, refKey: `match:${matchId}`,
      message: `A found item may match your lost "${lost.title}" (${found.location}).`, link: `/items/${found.item_id}`
    });
    if (found.user_id !== lost.user_id) {
      Notification.create({
        userId: found.user_id, type: EVENTS.POTENTIAL_MATCH_IDENTIFIED, refKey: `match:${matchId}`,
        message: `A lost report may match the "${found.title}" you found.`, link: `/items/${lost.item_id}`
      });
    }
  });

  bus.subscribe(EVENTS.CLAIM_SUBMITTED, ({ claimId }) => {
    const claim = Claim.findById(claimId);
    if (!claim) return;
    const item = Item.findById(claim.item_id);
    User.admins().forEach((a) =>
      Notification.create({
        userId: a.user_id, type: EVENTS.CLAIM_SUBMITTED, refKey: `claim:${claimId}:submitted`,
        message: `New claim submitted for "${item.title}".`, link: '/admin/claims'
      })
    );
    if (item.user_id !== claim.claimant_id) {
      Notification.create({
        userId: item.user_id, type: EVENTS.CLAIM_SUBMITTED, refKey: `claim:${claimId}:submitted`,
        message: `Someone submitted a claim for the item you reported: "${item.title}". An administrator will review it.`, link: `/items/${item.item_id}`
      });
    }
  });

  bus.subscribe(EVENTS.CLAIM_REVIEWED, ({ claimId }) => {
    const claim = Claim.findById(claimId);
    if (!claim) return;
    const item = Item.findById(claim.item_id);
    Notification.create({
      userId: claim.claimant_id, type: EVENTS.CLAIM_REVIEWED, refKey: `claim:${claimId}:${claim.status}`,
      message: claim.status === 'Approved'
        ? `Your claim for "${item.title}" was approved. Visit the Lost & Found office with your ID to collect it.`
        : `Your claim for "${item.title}" was rejected.${claim.review_note ? ' Note: ' + claim.review_note : ''}`,
      link: `/items/${item.item_id}`
    });
  });

  bus.subscribe(EVENTS.ITEM_RECOVERED, ({ itemId }) => {
    const item = Item.findById(itemId);
    if (!item) return;
    Notification.create({
      userId: item.user_id, type: EVENTS.ITEM_RECOVERED, refKey: `item:${itemId}:recovered`,
      message: `"${item.title}" was marked as recovered.`, link: `/items/${itemId}`
    });
    const approved = Claim.approvedForItem(itemId);
    if (approved && approved.claimant_id !== item.user_id) {
      Notification.create({
        userId: approved.claimant_id, type: EVENTS.ITEM_RECOVERED, refKey: `item:${itemId}:recovered`,
        message: `"${item.title}" was marked as returned to you.`, link: `/items/${itemId}`
      });
    }
  });

  bus.subscribe(EVENTS.REPORT_MODERATED, ({ itemId, action }) => {
    const item = Item.findById(itemId);
    if (!item) return;
    Notification.create({
      userId: item.user_id, type: EVENTS.REPORT_MODERATED, refKey: `item:${itemId}:moderated:${action}:${Date.now()}`,
      message: action === 'hidden'
        ? `Your report "${item.title}" was hidden by an administrator.`
        : `Your report "${item.title}" was reviewed and is visible again.`,
      link: `/items/${itemId}`
    });
  });
}

module.exports = { register };
