const { getDb } = require('../config/db');

module.exports = {
  record(adminId, action, target) {
    getDb().prepare('INSERT INTO audit_log (admin_id, action, target) VALUES (?, ?, ?)').run(adminId, action, target || null);
  },
  recent(limit = 15) {
    return getDb().prepare(
      `SELECT a.*, u.full_name AS admin_name FROM audit_log a JOIN users u ON u.user_id = a.admin_id ORDER BY a.audit_id DESC LIMIT ?`
    ).all(limit);
  }
};
