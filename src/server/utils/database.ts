import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { loadConfig } from './config.js';

let db: Database.Database | null = null;
let checkpointTimer: ReturnType<typeof setInterval> | null = null;

const WAL_AUTOCHECKPOINT_PAGES = 100;
const CHECKPOINT_INTERVAL_MS = 8 * 60 * 60 * 1000;

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
  db.pragma(`wal_autocheckpoint = ${WAL_AUTOCHECKPOINT_PAGES}`);

  checkpointTimer = setInterval(() => {
    checkpointDatabase('PASSIVE');
  }, CHECKPOINT_INTERVAL_MS);
  checkpointTimer.unref();

  return db;
}

export function checkpointDatabase(mode: 'PASSIVE' | 'TRUNCATE' = 'PASSIVE'): boolean {
  if (!db) return true;
  try {
    const result = db.pragma(`wal_checkpoint(${mode})`) as Array<{ busy?: number }>;
    return !result.some(row => (row.busy || 0) > 0);
  } catch (error) {
    console.error(`SQLite ${mode} checkpoint failed:`, error);
    return false;
  }
}

export function createDefaultUserContent(userId: string): void {
  const db = getDb();
  const defaultCategoryId = uuidv4();
  const defaultNotebookId = uuidv4();
  const generalCategoryId = uuidv4();

  db.prepare(`
    INSERT INTO categories (id, user_id, name, is_default, sort_order, notebook_id)
    VALUES (?, ?, '默认', 1, 0, NULL)
  `).run(defaultCategoryId, userId);

  db.prepare(`
    INSERT INTO notebooks (id, user_id, name, is_default, sort_order)
    VALUES (?, ?, '默认笔记本', 1, 0)
  `).run(defaultNotebookId, userId);

  db.prepare(`
    INSERT INTO categories (id, user_id, name, is_default, sort_order, notebook_id)
    VALUES (?, ?, '通用', 0, 0, ?)
  `).run(generalCategoryId, userId, defaultNotebookId);
}

function migrateNotebooks(db: Database.Database): void {
  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS notebooks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    const columns = db.prepare('PRAGMA table_info(categories)').all() as Array<{ name: string }>;
    if (!columns.some(column => column.name === 'notebook_id')) {
      db.exec('ALTER TABLE categories ADD COLUMN notebook_id TEXT REFERENCES notebooks(id)');
    }

    const users = db.prepare('SELECT id FROM users').all() as Array<{ id: string }>;
    const findDefaultNotebook = db.prepare(
      'SELECT id FROM notebooks WHERE user_id = ? AND is_default = 1'
    );
    const insertDefaultNotebook = db.prepare(`
      INSERT INTO notebooks (id, user_id, name, is_default, sort_order)
      VALUES (?, ?, '默认笔记本', 1, 0)
    `);
    const attachCategories = db.prepare(`
      UPDATE categories SET notebook_id = ?
      WHERE user_id = ? AND is_default = 0 AND notebook_id IS NULL
    `);
    const countNotebookCategories = db.prepare(
      'SELECT COUNT(*) AS count FROM categories WHERE notebook_id = ?'
    );
    const insertGeneralCategory = db.prepare(`
      INSERT INTO categories (id, user_id, name, is_default, sort_order, notebook_id)
      VALUES (?, ?, '通用', 0, 0, ?)
    `);

    for (const user of users) {
      let notebook = findDefaultNotebook.get(user.id) as { id: string } | undefined;
      if (!notebook) {
        notebook = { id: uuidv4() };
        insertDefaultNotebook.run(notebook.id, user.id);
      }

      attachCategories.run(notebook.id, user.id);
      const { count } = countNotebookCategories.get(notebook.id) as { count: number };
      if (count === 0) {
        insertGeneralCategory.run(uuidv4(), user.id, notebook.id);
      }
    }

    db.prepare('UPDATE categories SET notebook_id = NULL WHERE is_default = 1').run();
  })();

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_notebooks_one_default
      ON notebooks(user_id) WHERE is_default = 1;
    CREATE INDEX IF NOT EXISTS idx_notebooks_user_sort
      ON notebooks(user_id, sort_order, created_at);
    CREATE INDEX IF NOT EXISTS idx_categories_notebook_sort
      ON categories(notebook_id, sort_order, created_at);
  `);
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

    CREATE TABLE IF NOT EXISTS notebooks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      notebook_id TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (notebook_id) REFERENCES notebooks(id)
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

  migrateNotebooks(db);

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

    db.transaction(() => {
      db.prepare(`
        INSERT INTO users (id, username, password_hash, display_name, role)
        VALUES (?, ?, ?, ?, 'admin')
      `).run(adminId, config.admin.defaultUsername, passwordHash, config.admin.defaultUsername);

      createDefaultUserContent(adminId);
      db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(adminId);
    })();

    console.log(`✅ Default admin user created: ${config.admin.defaultUsername}`);
  }
}

export function closeDb(): void {
  if (checkpointTimer) {
    clearInterval(checkpointTimer);
    checkpointTimer = null;
  }
  if (db) {
    checkpointDatabase('TRUNCATE');
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
