const Database = require('better-sqlite3')
const path = require('path')

// 创建数据库连接
const db = new Database(path.join(__dirname, '../database.db'))

// 启用外键约束
db.pragma('foreign_keys = ON')

// 初始化数据库表
function initDatabase() {
  // 用户表
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email TEXT,
      school TEXT,
      enrollment_year INTEGER,
      user_type TEXT DEFAULT 'student',
      subscription_end_date TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `)
  
  // 为非空邮箱创建唯一索引
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email 
    ON users(email) WHERE email IS NOT NULL AND email != ''
  `)

  // 动词表
  db.exec(`
    CREATE TABLE IF NOT EXISTS verbs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      infinitive TEXT NOT NULL,
      meaning TEXT NOT NULL,
      conjugation_type INTEGER NOT NULL,
      is_irregular INTEGER DEFAULT 0,
      lesson_number INTEGER,
      textbook_volume INTEGER DEFAULT 1,
      frequency_level INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `)

  // 动词变位表
  db.exec(`
    CREATE TABLE IF NOT EXISTS conjugations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      verb_id INTEGER NOT NULL,
      tense TEXT NOT NULL,
      mood TEXT NOT NULL,
      person TEXT NOT NULL,
      conjugated_form TEXT NOT NULL,
      is_irregular INTEGER DEFAULT 0,
      FOREIGN KEY (verb_id) REFERENCES verbs(id) ON DELETE CASCADE
    )
  `)

  // 创建索引
  db.exec(`CREATE INDEX IF NOT EXISTS idx_conjugations_verb ON conjugations(verb_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_conjugations_tense ON conjugations(tense, mood)`)

  // 练习记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS practice_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      verb_id INTEGER NOT NULL,
      exercise_type TEXT NOT NULL,
      is_correct INTEGER NOT NULL,
      answer TEXT,
      correct_answer TEXT,
      tense TEXT,
      mood TEXT,
      person TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (verb_id) REFERENCES verbs(id) ON DELETE CASCADE
    )
  `)

  // 打卡记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS check_ins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      check_in_date TEXT NOT NULL,
      exercise_count INTEGER DEFAULT 0,
      correct_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, check_in_date)
    )
  `)

  // 用户学习进度表
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      verb_id INTEGER NOT NULL,
      mastery_level INTEGER DEFAULT 0,
      practice_count INTEGER DEFAULT 0,
      correct_count INTEGER DEFAULT 0,
      last_practiced_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (verb_id) REFERENCES verbs(id) ON DELETE CASCADE,
      UNIQUE(user_id, verb_id)
    )
  `)

  // 收藏单词表
  db.exec(`
    CREATE TABLE IF NOT EXISTS favorite_verbs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      verb_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (verb_id) REFERENCES verbs(id) ON DELETE CASCADE,
      UNIQUE(user_id, verb_id)
    )
  `)

  // 错题单词表
  db.exec(`
    CREATE TABLE IF NOT EXISTS wrong_verbs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      verb_id INTEGER NOT NULL,
      wrong_count INTEGER DEFAULT 1,
      last_wrong_at TEXT DEFAULT (datetime('now', 'localtime')),
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (verb_id) REFERENCES verbs(id) ON DELETE CASCADE,
      UNIQUE(user_id, verb_id)
    )
  `)

  console.log('数据库初始化完成')
}

// 导出数据库实例和初始化函数
module.exports = {
  db,
  initDatabase
}
