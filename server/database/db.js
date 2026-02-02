const Database = require('better-sqlite3')
const path = require('path')

// 创建三个独立的数据库连接
const userDb = new Database(path.join(__dirname, '../data/user_data.db'))      // 用户数据库
const vocabularyDb = new Database(path.join(__dirname, '../data/vocabulary.db')) // 词库数据库
const questionDb = new Database(path.join(__dirname, '../data/questions.db'))   // 题库数据库

// 启用外键约束
userDb.pragma('foreign_keys = ON')
vocabularyDb.pragma('foreign_keys = ON')
questionDb.pragma('foreign_keys = ON')

function ensureColumn(dbInstance, table, column, definition) {
  const tableInfo = dbInstance.prepare(`PRAGMA table_info(${table})`).all()
  const hasColumn = tableInfo.some((col) => col.name === column)
  if (!hasColumn) {
    dbInstance.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`)
  }
}

// 初始化数据库表
function initDatabase() {
  console.log('\n💾 数据库初始化...')
  console.log('   • 用户数据库: user_data.db')
  initUserDatabase()

  console.log('   • 词库数据库: vocabulary.db')
  initVocabularyDatabase()

  console.log('   • 题库数据库: questions.db')
  initQuestionDatabase()

  console.log('\x1b[32m   ✓ 数据库初始化完成\x1b[0m')
}

// 初始化用户数据库
function initUserDatabase() {
  // 用户表
  userDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email TEXT,
      school TEXT,
      enrollment_year INTEGER,
      user_type TEXT DEFAULT 'student',
      role TEXT DEFAULT 'user',
      is_initial_admin INTEGER DEFAULT 0,
      is_initial_dev INTEGER DEFAULT 0,
      subscription_end_date TEXT,
      avatar TEXT,
      participate_in_leaderboard INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `)

  // 兼容旧数据库，补充列
  ensureColumn(userDb, 'users', 'role', "role TEXT DEFAULT 'user'")
  ensureColumn(userDb, 'users', 'is_initial_admin', 'is_initial_admin INTEGER DEFAULT 0')
  ensureColumn(userDb, 'users', 'is_initial_dev', 'is_initial_dev INTEGER DEFAULT 0')
  ensureColumn(userDb, 'users', 'participate_in_leaderboard', 'participate_in_leaderboard INTEGER DEFAULT 1')
  
  // 为非空邮箱创建唯一索引
  userDb.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email 
    ON users(email) WHERE email IS NOT NULL AND email != ''
  `)

  // 练习记录表
  userDb.exec(`
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
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  // 打卡记录表
  userDb.exec(`
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
  userDb.exec(`
    CREATE TABLE IF NOT EXISTS user_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      verb_id INTEGER NOT NULL,
      mastery_level INTEGER DEFAULT 0,
      practice_count INTEGER DEFAULT 0,
      correct_count INTEGER DEFAULT 0,
      last_practiced_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, verb_id)
    )
  `)

  // 收藏单词表
  userDb.exec(`
    CREATE TABLE IF NOT EXISTS favorite_verbs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      verb_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, verb_id)
    )
  `)

  // 错题单词表
  userDb.exec(`
    CREATE TABLE IF NOT EXISTS wrong_verbs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      verb_id INTEGER NOT NULL,
      wrong_count INTEGER DEFAULT 1,
      last_wrong_at TEXT DEFAULT (datetime('now', 'localtime')),
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, verb_id)
    )
  `)

  // 验证码表（用于学生邮箱认证）
  userDb.exec(`
    CREATE TABLE IF NOT EXISTS verification_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `)

  // 创建索引以提高查询效率
  userDb.exec(`
    CREATE INDEX IF NOT EXISTS idx_verification_email 
    ON verification_codes(email)
  `)

  // 私人题库表（用户收藏的题目）
  userDb.exec(`
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
      public_question_id INTEGER,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  // 用户答题记录表（记录每个用户对每个题目的练习次数和评价）
  userDb.exec(`
    CREATE TABLE IF NOT EXISTS user_question_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      question_type TEXT NOT NULL CHECK(question_type IN ('public', 'private')),
      practice_count INTEGER DEFAULT 0,
      correct_count INTEGER DEFAULT 0,
      rating INTEGER DEFAULT 0 CHECK(rating IN (-1, 0, 1)),
      last_practiced_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, question_id, question_type)
    )
  `)

  // 用户添加的教材表
  userDb.exec(`
    CREATE TABLE IF NOT EXISTS user_textbooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      textbook_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, textbook_id)
    )
  `)

  // 用户课程进度表（记录每个课程的完成次数）
  userDb.exec(`
    CREATE TABLE IF NOT EXISTS user_lesson_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      lesson_id INTEGER NOT NULL,
      completed_count INTEGER DEFAULT 0,
      study_completed_count INTEGER DEFAULT 0,
      review_completed_count INTEGER DEFAULT 0,
      last_completed_at TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, lesson_id)
    )
  `)

  // 管理日志表
  userDb.exec(`
    CREATE TABLE IF NOT EXISTS admin_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      meta TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `)

  // 创建索引
  userDb.exec(`CREATE INDEX IF NOT EXISTS idx_practice_records_user ON practice_records(user_id)`)
  userDb.exec(`CREATE INDEX IF NOT EXISTS idx_private_questions_user ON private_questions(user_id)`)
  userDb.exec(`CREATE INDEX IF NOT EXISTS idx_user_question_records ON user_question_records(user_id, question_id, question_type)`)
  userDb.exec(`CREATE INDEX IF NOT EXISTS idx_user_textbooks ON user_textbooks(user_id)`)
  userDb.exec(`CREATE INDEX IF NOT EXISTS idx_user_lesson_progress ON user_lesson_progress(user_id, lesson_id)`)
  userDb.exec(`CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(created_at)`)
}

// 初始化词库数据库
function initVocabularyDatabase() {
  // 动词表
  vocabularyDb.exec(`
    CREATE TABLE IF NOT EXISTS verbs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      infinitive TEXT NOT NULL,
      meaning TEXT NOT NULL,
      conjugation_type INTEGER NOT NULL,
      is_irregular INTEGER DEFAULT 0,
      is_reflexive INTEGER DEFAULT 0,
      gerund TEXT,
      participle TEXT,
      participle_forms TEXT,
      lesson_number INTEGER,
      textbook_volume INTEGER DEFAULT 1,
      frequency_level INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `)

  // 动词变位表
  vocabularyDb.exec(`
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

  // 教材表
  vocabularyDb.exec(`
    CREATE TABLE IF NOT EXISTS textbooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      cover_image TEXT,
      order_index INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `)

  // 课程表
  vocabularyDb.exec(`
    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      textbook_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      lesson_number INTEGER NOT NULL,
      description TEXT,
      grammar_points TEXT,
      moods TEXT,
      tenses TEXT,
      conjugation_types TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (textbook_id) REFERENCES textbooks(id) ON DELETE CASCADE
    )
  `)

  // 课程-单词关联表
  vocabularyDb.exec(`
    CREATE TABLE IF NOT EXISTS lesson_verbs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id INTEGER NOT NULL,
      verb_id INTEGER NOT NULL,
      order_index INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
      FOREIGN KEY (verb_id) REFERENCES verbs(id) ON DELETE CASCADE,
      UNIQUE(lesson_id, verb_id)
    )
  `)

  // 创建索引
  vocabularyDb.exec(`CREATE INDEX IF NOT EXISTS idx_conjugations_verb ON conjugations(verb_id)`)
  vocabularyDb.exec(`CREATE INDEX IF NOT EXISTS idx_conjugations_tense ON conjugations(tense, mood)`)
  vocabularyDb.exec(`CREATE INDEX IF NOT EXISTS idx_verbs_lesson ON verbs(lesson_number, textbook_volume)`)
  vocabularyDb.exec(`CREATE INDEX IF NOT EXISTS idx_lessons_textbook ON lessons(textbook_id)`)
  vocabularyDb.exec(`CREATE INDEX IF NOT EXISTS idx_lesson_verbs_lesson ON lesson_verbs(lesson_id)`)
  vocabularyDb.exec(`CREATE INDEX IF NOT EXISTS idx_lesson_verbs_verb ON lesson_verbs(verb_id)`)

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
}

// 初始化题库数据库
function initQuestionDatabase() {
  // 公共题库表（填空题和例句填空）
  questionDb.exec(`
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
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `)

  // 创建索引
  questionDb.exec(`CREATE INDEX IF NOT EXISTS idx_public_questions_verb ON public_questions(verb_id)`)
  questionDb.exec(`CREATE INDEX IF NOT EXISTS idx_public_questions_type ON public_questions(question_type)`)
  questionDb.exec(`CREATE INDEX IF NOT EXISTS idx_public_questions_created ON public_questions(created_at)`)
  questionDb.exec(`CREATE INDEX IF NOT EXISTS idx_public_questions_confidence ON public_questions(confidence_score)`)

  questionDb.exec(`
    CREATE TABLE IF NOT EXISTS question_bank (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      payload TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `)
}

// 导出数据库实例和初始化函数
module.exports = {
  userDb,           // 用户数据库
  vocabularyDb,     // 词库数据库
  questionDb,       // 题库数据库
  db: userDb,       // 为了向后兼容，默认导出用户数据库
  initDatabase
}
