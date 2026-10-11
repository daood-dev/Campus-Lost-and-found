const { getDb } = require('../config/db');

module.exports = {
  /** Idempotent: the UNIQUE(lost, found) constraint guarantees a pair is only created once. */
  createIfNew(lostId, foundId, score) {
    const info = getDb()
      .prepare('INSERT OR IGNORE INTO item_matches (lost_item_id, found_item_id, match_score) VALUES (?, ?, ?)')
      .run(lostId, foundId, score);
    const match = getDb().prepare('SELECT * FROM item_matches WHERE lost_item_id = ? AND found_item_id = ?').get(lostId, foundId);
    return { created: info.changes === 1, match };
  },
  findById(id) {
    return getDb().prepare('SELECT * FROM item_matches WHERE match_id = ?').get(id);
  },
  forItem(itemId) {
    return getDb().prepare(
      `SELECT m.*, l.title AS lost_title, f.title AS found_title, l.user_id AS lost_user_id, f.user_id AS found_user_id
       FROM item_matches m
       JOIN items l ON l.item_id = m.lost_item_id
       JOIN items f ON f.item_id = m.found_item_id
       WHERE (m.lost_item_id = ? OR m.found_item_id = ?) AND m.status != 'Dismissed' AND l.is_hidden = 0 AND f.is_hidden = 0
       ORDER BY m.match_score DESC`
    ).all(itemId, itemId);
  },
  setStatus(id, status) {
    getDb().prepare('UPDATE item_matches SET status = ? WHERE match_id = ?').run(status, id);
  },
  activeCountFor(itemId) {
    return getDb().prepare(
      `SELECT COUNT(*) AS n FROM item_matches WHERE (lost_item_id = ? OR found_item_id = ?) AND status != 'Dismissed'`
    ).get(itemId, itemId).n;
  }
};
