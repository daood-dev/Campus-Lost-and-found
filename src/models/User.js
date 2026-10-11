const { getDb } = require('../config/db');

const PUBLIC = 'user_id, full_name, email, role, is_active, created_at';

module.exports = {
  create({ fullName, email, passwordHash, role }) {
    const info = getDb()
      .prepare('INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(fullName, email.toLowerCase(), passwordHash, role);
    return this.findById(info.lastInsertRowid);
  },
  findById(id) {
    return getDb().prepare(`SELECT ${PUBLIC} FROM users WHERE user_id = ?`).get(id);
  },
  findByEmailWithHash(email) {
    return getDb().prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase());
  },
  all() {
    return getDb().prepare(`SELECT ${PUBLIC} FROM users ORDER BY created_at DESC`).all();
  },
  admins() {
    return getDb().prepare(`SELECT ${PUBLIC} FROM users WHERE role = 'admin' AND is_active = 1`).all();
  },
  updateProfile(id, fullName) {
    getDb().prepare('UPDATE users SET full_name = ? WHERE user_id = ?').run(fullName, id);
  },
  updatePassword(id, hash) {
    getDb().prepare('UPDATE users SET password_hash = ? WHERE user_id = ?').run(hash, id);
  },
  setRole(id, role) {
    getDb().prepare('UPDATE users SET role = ? WHERE user_id = ?').run(role, id);
  },
  setActive(id, active) {
    getDb().prepare('UPDATE users SET is_active = ? WHERE user_id = ?').run(active ? 1 : 0, id);
  },
  count() {
    return getDb().prepare('SELECT COUNT(*) AS n FROM users').get().n;
  }
};
