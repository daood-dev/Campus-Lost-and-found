const { getDb } = require('../config/db');

const BASE = `SELECT i.*, u.full_name AS reporter_name FROM items i JOIN users u ON u.user_id = i.user_id`;

module.exports = {
  create(d) {
    const info = getDb().prepare(
      `INSERT INTO items (user_id, title, description, private_details, category, report_type, location, item_date, image_url)
       VALUES (@userId, @title, @description, @privateDetails, @category, @reportType, @location, @itemDate, @imageUrl)`
    ).run({ privateDetails: null, imageUrl: null, ...d });
    return this.findById(info.lastInsertRowid);
  },

  findById(id) {
    return getDb().prepare(`${BASE} WHERE i.item_id = ?`).get(id);
  },

  update(id, d) {
    getDb().prepare(
      `UPDATE items SET title=@title, description=@description, private_details=@privateDetails, category=@category,
       location=@location, item_date=@itemDate, image_url=COALESCE(@imageUrl, image_url) WHERE item_id=@id`
    ).run({ imageUrl: null, ...d, id });
  },

  remove(id) {
    getDb().prepare('DELETE FROM items WHERE item_id = ?').run(id);
  },

  setStatus(id, status) {
    getDb().prepare('UPDATE items SET status = ? WHERE item_id = ?').run(status, id);
  },

  markMatchedIfOpen(id) {
    getDb().prepare(`UPDATE items SET status = 'Matched' WHERE item_id = ? AND status = 'Open'`).run(id);
  },

  setHidden(id, hidden) {
    getDb().prepare('UPDATE items SET is_hidden = ? WHERE item_id = ?').run(hidden ? 1 : 0, id);
  },

  /** Parameterised search; hidden reports are excluded unless includeHidden is set (admin). */
  search({ q, category, location, type, status, from, to, includeHidden = false, limit = 60, offset = 0 } = {}) {
    const where = [];
    const params = {};
    if (!includeHidden) where.push('i.is_hidden = 0');
    if (q) {
      where.push('(i.title LIKE @q OR i.description LIKE @q)');
      params.q = `%${q}%`;
    }
    if (category) { where.push('i.category = @category'); params.category = category; }
    if (location) { where.push('i.location LIKE @location'); params.location = `%${location}%`; }
    if (type) { where.push('i.report_type = @type'); params.type = type; }
    if (status) { where.push('i.status = @status'); params.status = status; }
    if (from) { where.push('i.item_date >= @from'); params.from = from; }
    if (to) { where.push('i.item_date <= @to'); params.to = to; }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = getDb()
      .prepare(`${BASE} ${clause} ORDER BY i.created_at DESC, i.item_id DESC LIMIT @limit OFFSET @offset`)
      .all({ ...params, limit, offset });
    const total = getDb().prepare(`SELECT COUNT(*) AS n FROM items i ${clause}`).get(params).n;
    return { rows, total };
  },

  byUser(userId) {
    return getDb().prepare(`${BASE} WHERE i.user_id = ? ORDER BY i.created_at DESC, i.item_id DESC`).all(userId);
  },

  recent(limit = 6) {
    return getDb().prepare(`${BASE} WHERE i.is_hidden = 0 ORDER BY i.created_at DESC, i.item_id DESC LIMIT ?`).all(limit);
  },

  /** Active, visible reports of the opposite type in the same category. */
  candidatesFor(item) {
    const opposite = item.report_type === 'Lost' ? 'Found' : 'Lost';
    return getDb().prepare(
      `${BASE} WHERE i.report_type = ? AND i.category = ? AND i.is_hidden = 0
       AND i.status IN ('Open','Matched') AND i.item_id != ?`
    ).all(opposite, item.category, item.item_id);
  },

  stats() {
    const db = getDb();
    const one = (sql) => db.prepare(sql).get().n;
    return {
      users: one('SELECT COUNT(*) AS n FROM users'),
      lost: one(`SELECT COUNT(*) AS n FROM items WHERE report_type='Lost'`),
      found: one(`SELECT COUNT(*) AS n FROM items WHERE report_type='Found'`),
      recovered: one(`SELECT COUNT(*) AS n FROM items WHERE status='Recovered'`),
      openItems: one(`SELECT COUNT(*) AS n FROM items WHERE status IN ('Open','Matched','Under Review')`),
      pendingClaims: one(`SELECT COUNT(*) AS n FROM claims WHERE status='Pending'`),
      suggestedMatches: one(`SELECT COUNT(*) AS n FROM item_matches WHERE status='Suggested'`),
      byCategory: db.prepare('SELECT category, COUNT(*) AS n FROM items GROUP BY category ORDER BY n DESC LIMIT 6').all()
    };
  }
};
