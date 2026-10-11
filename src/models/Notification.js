const { getDb } = require('../config/db');

module.exports = {
  /** UNIQUE(user_id, ref_key) makes handler re-runs harmless (no duplicate notifications). */
  create({ userId, type, message, link, refKey }) {
    return getDb()
      .prepare('INSERT OR IGNORE INTO notifications (user_id, event_type, message, link, ref_key) VALUES (?, ?, ?, ?, ?)')
      .run(userId, type, message, link || null, refKey).changes === 1;
  },
  forUser(userId, limit = 100) {
    return getDb().prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY notification_id DESC LIMIT ?').all(userId, limit);
  },
  unreadCount(userId) {
    return getDb().prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0').get(userId).n;
  },
  markRead(id, userId) {
    getDb().prepare('UPDATE notifications SET is_read = 1 WHERE notification_id = ? AND user_id = ?').run(id, userId);
  },
  markAllRead(userId) {
    getDb().prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(userId);
  }
};
