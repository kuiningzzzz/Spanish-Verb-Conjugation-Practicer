const path = require('path')
const Database = require('better-sqlite3')
const { userDb, vocabularyDb, questionDb } = require('../database/db')

const feedbackDb = new Database(path.join(__dirname, '../data/feedback.db'))

function ensureColumn(dbInstance, table, column, definition) {
  const columns = dbInstance.prepare(`PRAGMA table_info(${table})`).all()
  const exists = columns.some((col) => col.name === column)
  if (!exists) {
    // SQLite 的 ALTER TABLE ADD COLUMN 不支持非常量默认值
    // 如 DEFAULT CURRENT_TIMESTAMP 或 DEFAULT (datetime('now'))
    // 需要使用常量默认值或 NULL
    dbInstance.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`)
  }
}

function runAdminMigrations() {
  ensureColumn(userDb, 'users', 'role', "role TEXT DEFAULT 'user'")
  ensureColumn(userDb, 'users', 'is_initial_admin', 'is_initial_admin INTEGER DEFAULT 0')
  ensureColumn(userDb, 'users', 'is_initial_dev', 'is_initial_dev INTEGER DEFAULT 0')

  userDb.exec(`
    CREATE TABLE IF NOT EXISTS admin_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      meta TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `)

  userDb.exec('CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(created_at)')

  vocabularyDb.exec(`
    CREATE TABLE IF NOT EXISTS lexicon_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      payload TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `)

  questionDb.exec(`
    CREATE TABLE IF NOT EXISTS question_bank (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      payload TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `)

  feedbackDb.exec(`
    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      satisfaction INTEGER NOT NULL CHECK(satisfaction >= 1 AND satisfaction <= 4),
      comment TEXT,
      status TEXT DEFAULT 'open',
      admin_note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  ensureColumn(feedbackDb, 'feedback', 'status', "status TEXT DEFAULT 'open'")
  ensureColumn(feedbackDb, 'feedback', 'admin_note', 'admin_note TEXT')
  // SQLite 的 ALTER TABLE ADD COLUMN 不支持 DEFAULT CURRENT_TIMESTAMP
  // 使用 NULL 作为默认值，在插入时由应用层设置时间
  ensureColumn(feedbackDb, 'feedback', 'updated_at', "updated_at TEXT")
  feedbackDb.exec('CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status)')
  feedbackDb.exec('CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at)')
}

module.exports = { runAdminMigrations }
