const { getDb } = require('../config/db');

const JOINED = `SELECT c.*, i.title AS item_title, i.private_details AS item_private_details, i.description AS item_description,
  i.location AS item_location, u.full_name AS claimant_name, u.email AS claimant_email
  FROM claims c JOIN items i ON i.item_id = c.item_id JOIN users u ON u.user_id = c.claimant_id`;

module.exports = {
  create({ itemId, claimantId, details }) {
    const info = getDb()
      .prepare('INSERT INTO claims (item_id, claimant_id, claim_details) VALUES (?, ?, ?)')
      .run(itemId, claimantId, details);
    return this.findById(info.lastInsertRowid);
  },
  findById(id) {
    return getDb().prepare(`${JOINED} WHERE c.claim_id = ?`).get(id);
  },
  existing(itemId, claimantId) {
    return getDb().prepare('SELECT * FROM claims WHERE item_id = ? AND claimant_id = ?').get(itemId, claimantId);
  },
  byUser(userId) {
    return getDb().prepare(`${JOINED} WHERE c.claimant_id = ? ORDER BY c.created_at DESC`).all(userId);
  },
  all(status) {
    if (status) return getDb().prepare(`${JOINED} WHERE c.status = ? ORDER BY c.created_at DESC`).all(status);
    return getDb().prepare(`${JOINED} ORDER BY CASE c.status WHEN 'Pending' THEN 0 ELSE 1 END, c.created_at DESC`).all();
  },
  forItem(itemId) {
    return getDb().prepare(`${JOINED} WHERE c.item_id = ? ORDER BY c.created_at DESC`).all(itemId);
  },
  approvedForItem(itemId) {
    return getDb().prepare(`SELECT * FROM claims WHERE item_id = ? AND status = 'Approved'`).get(itemId);
  },
  pendingCount(itemId) {
    return getDb().prepare(`SELECT COUNT(*) AS n FROM claims WHERE item_id = ? AND status = 'Pending'`).get(itemId).n;
  },
  review(id, { status, adminId, note }) {
    getDb()
      .prepare('UPDATE claims SET status = ?, reviewed_by = ?, review_note = ? WHERE claim_id = ?')
      .run(status, adminId, note || null, id);
  }
};
