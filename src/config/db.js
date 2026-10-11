const { DatabaseSync } = require('node:sqlite'); // built into Node 22.13+, no native build needed
const fs = require('fs');
const path = require('path');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  user_id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student','staff','admin')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS items (
  item_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  private_details TEXT,
  category TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('Lost','Found')),
  location TEXT NOT NULL,
  item_date TEXT NOT NULL,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','Under Review','Matched','Claimed','Recovered')),
  is_hidden INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_items_search ON items(report_type, category, status);
CREATE INDEX IF NOT EXISTS idx_items_user ON items(user_id);
CREATE TABLE IF NOT EXISTS claims (
  claim_id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
  claimant_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  claim_details TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
  reviewed_by INTEGER REFERENCES users(user_id),
  review_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (item_id, claimant_id)
);
CREATE TABLE IF NOT EXISTS notifications (
  notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  ref_key TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, ref_key)
);
CREATE TABLE IF NOT EXISTS item_matches (
  match_id INTEGER PRIMARY KEY AUTOINCREMENT,
  lost_item_id INTEGER NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
  found_item_id INTEGER NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
  match_score INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'Suggested' CHECK (status IN ('Suggested','Confirmed','Dismissed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (lost_item_id, found_item_id)
);
CREATE TABLE IF NOT EXISTS event_log (
  event_id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS audit_log (
  audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL REFERENCES users(user_id),
  action TEXT NOT NULL,
  target TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

let db = null;

function init(file) {
  const target = file || process.env.DB_PATH || path.join(__dirname, '../../data/lostfound.db');
  if (db) db.close();
  if (target !== ':memory:') fs.mkdirSync(path.dirname(target), { recursive: true });
  db = new DatabaseSync(target);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.transaction = (fn) => (...args) => {
    db.exec('BEGIN');
    try {
      const result = fn(...args);
      db.exec('COMMIT');
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };
  db.exec(SCHEMA);
  return db;
}

function getDb() {
  if (!db) init();
  return db;
}

module.exports = { init, getDb };
