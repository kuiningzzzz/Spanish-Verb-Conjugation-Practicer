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

  // 公共题库表（填空题和例句填空）
  db.exec(`
    CREATE TABLE IF NOT EXISTS public_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      verb_id INTEGER NOT NULL,
      question_type TEXT NOT NULL CHECK(question_type IN ('fill', 'sentence')),
      question_text TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      example_sentence TEXT,
      translation TEXT,
      hint TEXT,
      tense TEXT NOT NULL,
      mood TEXT NOT NULL,
      person TEXT NOT NULL,
      confidence_score INTEGER DEFAULT 50 CHECK(confidence_score >= 0 AND confidence_score <= 100),
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (verb_id) REFERENCES verbs(id) ON DELETE CASCADE
    )
  `)

  // 私人题库表（用户收藏的题目）
  db.exec(`
    CREATE TABLE IF NOT EXISTS private_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      verb_id INTEGER NOT NULL,
      question_type TEXT NOT NULL CHECK(question_type IN ('fill', 'sentence')),
      question_text TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      example_sentence TEXT,
      translation TEXT,
      hint TEXT,
      tense TEXT NOT NULL,
      mood TEXT NOT NULL,
      person TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (verb_id) REFERENCES verbs(id) ON DELETE CASCADE
    )
  `)

  // 用户答题记录表（记录每个用户对每个题目做对的次数）
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_question_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      question_type TEXT NOT NULL CHECK(question_type IN ('public', 'private')),
      correct_count INTEGER DEFAULT 0,
      last_practiced_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, question_id, question_type)
    )
  `)

  // 创建索引
  db.exec(`CREATE INDEX IF NOT EXISTS idx_public_questions_verb ON public_questions(verb_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_public_questions_type ON public_questions(question_type)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_public_questions_created ON public_questions(created_at)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_private_questions_user ON private_questions(user_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_user_question_records ON user_question_records(user_id, question_id, question_type)`)

  console.log('数据库初始化完成')
}

// 导出数据库实例和初始化函数
module.exports = {
  db,
  initDatabase
}
