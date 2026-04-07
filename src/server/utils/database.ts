import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { loadConfig } from './config.js';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const config = loadConfig();
  const dataDir = config.data.dir;

  // Ensure data directory exists
  fs.mkdirSync(dataDir, { recursive: true });

  // Pre-check: verify the data directory is writable
  try {
    fs.accessSync(dataDir, fs.constants.W_OK);
  } catch {
    console.error(`❌ 数据目录不可写: ${dataDir}`);
    console.error('   请检查目录权限，或使用 chown 将目录所有者改为当前运行用户。');
    process.exit(1);
  }

  const dbPath = path.join(dataDir, 'app.db');
  console.log(`📂 数据目录: ${dataDir}`);
  console.log(`💾 数据库路径: ${dbPath}`);
  db = new Database(dbPath);

  // Enable WAL mode for better concurrent performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  return db;
}

export function initializeDatabase(): void {
  const db = getDb();

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      deleted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS note_tags (
      note_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      PRIMARY KEY (note_id, tag_id),
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      theme TEXT NOT NULL DEFAULT 'light',
      font_size INTEGER NOT NULL DEFAULT 16,
      default_editor_mode TEXT NOT NULL DEFAULT 'edit',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS backup_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      s3_endpoint TEXT NOT NULL DEFAULT '',
      s3_region TEXT NOT NULL DEFAULT 'us-east-1',
      s3_bucket TEXT NOT NULL DEFAULT '',
      s3_access_key TEXT NOT NULL DEFAULT '',
      s3_secret_key TEXT NOT NULL DEFAULT '',
      s3_path_prefix TEXT NOT NULL DEFAULT 'notes-backup',
      retention_count INTEGER NOT NULL DEFAULT 5,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
    CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
    CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
    CREATE INDEX IF NOT EXISTS idx_notes_category_id ON notes(category_id);
    CREATE INDEX IF NOT EXISTS idx_notes_is_deleted ON notes(is_deleted);
    CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at);
  `);

  // Create default admin user if not exists
  const config = loadConfig();
  const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get(config.admin.defaultUsername);

  if (!adminExists) {
    const adminId = uuidv4();
    const passwordHash = bcrypt.hashSync(config.admin.defaultPassword, 10);

    db.prepare(`
      INSERT INTO users (id, username, password_hash, display_name, role)
      VALUES (?, ?, ?, ?, 'admin')
    `).run(adminId, config.admin.defaultUsername, passwordHash, config.admin.defaultUsername);

    // Create default category for admin
    const defaultCatId = uuidv4();
    db.prepare(`
      INSERT INTO categories (id, user_id, name, is_default, sort_order)
      VALUES (?, ?, '默认', 1, 0)
    `).run(defaultCatId, adminId);

    // Create default settings for admin
    db.prepare(`
      INSERT INTO user_settings (user_id) VALUES (?)
    `).run(adminId);

    console.log(`✅ Default admin user created: ${config.admin.defaultUsername}`);
  }
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// Utility to ensure user data directories exist
export function ensureUserDirs(username: string): void {
  const config = loadConfig();
  const userDir = path.join(config.data.dir, 'users', username);
  fs.mkdirSync(path.join(userDir, 'notes'), { recursive: true });
  fs.mkdirSync(path.join(userDir, 'attachments'), { recursive: true });
}
