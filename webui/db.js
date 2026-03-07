/**
 * User database — SQLite-backed registration & authentication.
 *
 * Schema: users(id, email, password_hash, display_name, created_at)
 * Passwords hashed with bcryptjs (10 rounds).
 */

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'users.db');
const SALT_ROUNDS = 10;

let _db;

function getDb() {
  if (_db) return _db;

  const fs = require('fs');
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT    NOT NULL,
      display_name  TEXT    NOT NULL DEFAULT '',
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  return _db;
}

function register(email, password, displayName = '') {
  email = email.trim().toLowerCase();
  if (!email || !password) throw new Error('Email and password required');
  if (password.length < 6) throw new Error('Password must be at least 6 characters');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid email address');

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) throw new Error('Email already registered');

  const hash = bcrypt.hashSync(password, SALT_ROUNDS);
  const result = db.prepare(
    'INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)'
  ).run(email, hash, displayName.trim());

  return { id: result.lastInsertRowid, email, displayName: displayName.trim() };
}

function authenticate(email, password) {
  email = email.trim().toLowerCase();
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return null;
  if (!bcrypt.compareSync(password, user.password_hash)) return null;
  return { id: user.id, email: user.email, displayName: user.display_name };
}

function getUserCount() {
  return getDb().prepare('SELECT COUNT(*) AS count FROM users').get().count;
}

module.exports = { register, authenticate, getUserCount, getDb };
