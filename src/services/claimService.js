const { getDb } = require('../config/db');
const Item = require('../models/Item');
const Claim = require('../models/Claim');
const Audit = require('../models/Audit');
const bus = require('../events/eventBus');
const EVENTS = require('../events/events');

function submit({ itemId, claimantId, details }) {
  const item = Item.findById(itemId);
  if (!item || item.is_hidden) return { error: 'This item is not available.' };
  if (item.report_type !== 'Found') return { error: 'Only found items can be claimed.' };
  if (item.user_id === claimantId) return { error: 'You cannot claim an item you reported.' };
  if (['Claimed', 'Recovered'].includes(item.status)) return { error: 'This item has already been claimed or recovered.' };
  if (Claim.existing(itemId, claimantId)) return { error: 'You have already submitted a claim for this item.' };
  const claim = getDb().transaction(() => {
    const c = Claim.create({ itemId, claimantId, details });
    Item.setStatus(itemId, 'Under Review');
    return c;
  })();
  bus.emit(EVENTS.CLAIM_SUBMITTED, { claimId: claim.claim_id }); // published only after commit
  return { claim };
}

function review({ claimId, adminId, decision, note }) {
  const claim = Claim.findById(claimId);
  if (!claim) return { error: 'Claim not found.' };
  if (claim.status !== 'Pending') return { error: 'This claim was already reviewed.' };
  const status = decision === 'approve' ? 'Approved' : 'Rejected';
  getDb().transaction(() => {
    Claim.review(claimId, { status, adminId, note });
    if (status === 'Approved') {
      Item.setStatus(claim.item_id, 'Claimed');
    } else if (Claim.pendingCount(claim.item_id) === 0) {
      Item.setStatus(claim.item_id, 'Open');
    }
    Audit.record(adminId, `claim ${status.toLowerCase()}`, `claim #${claimId} / item #${claim.item_id}`);
  })();
  bus.emit(EVENTS.CLAIM_REVIEWED, { claimId });
  return { claim: Claim.findById(claimId) };
}

function markRecovered({ itemId, adminId }) {
  const item = Item.findById(itemId);
  if (!item) return { error: 'Item not found.' };
  if (item.report_type === 'Found' && !Claim.approvedForItem(itemId)) {
    return { error: 'Approve a claim first: ownership must be verified before an item is marked recovered.' };
  }
  Item.setStatus(itemId, 'Recovered');
  if (adminId) Audit.record(adminId, 'marked recovered', `item #${itemId}`);
  bus.emit(EVENTS.ITEM_RECOVERED, { itemId });
  return { item: Item.findById(itemId) };
}

module.exports = { submit, review, markRecovered };
