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

function tableExists(dbInstance, table) {
  const row = dbInstance.prepare(`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?
  `).get(table)
  return !!row
}

function tableHasColumn(dbInstance, table, column) {
  if (!tableExists(dbInstance, table)) return false
  const tableInfo = dbInstance.prepare(`PRAGMA table_info(${table})`).all()
  return tableInfo.some((col) => col.name === column)
}

function getTableDDL(dbInstance, table) {
  const row = dbInstance.prepare(`
    SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?
  `).get(table)
  return row && row.sql ? String(row.sql) : ''
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

  // admin 自动生成非法词条批次计数（用于触发权限回收）
  userDb.exec(`
    CREATE TABLE IF NOT EXISTS admin_autofill_invalid_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL,
      batch_id TEXT NOT NULL,
      infinitive TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE(admin_id, batch_id, infinitive),
      FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
    )
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
      question_bank TEXT DEFAULT 'traditional' CHECK(question_bank IN ('traditional', 'pronoun')),
      sentence_type TEXT DEFAULT 'traditional' CHECK(sentence_type IN ('traditional', 'with_pronoun')),
      question_text TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      example_sentence TEXT,
      translation TEXT,
      hint TEXT,
      tense TEXT NOT NULL,
      mood TEXT NOT NULL,
      person TEXT NOT NULL,
      public_question_id INTEGER,
      public_question_source TEXT CHECK(public_question_source IN ('public_traditional', 'public_pronoun')),
      host_form TEXT,
      host_form_zh TEXT,
      pronoun_pattern TEXT,
      io_pronoun TEXT,
      do_pronoun TEXT,
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
      question_type TEXT NOT NULL CHECK(question_type IN ('public_traditional', 'public_pronoun', 'private')),
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
  ensureColumn(userDb, 'private_questions', 'question_bank', "question_bank TEXT DEFAULT 'traditional'")
  ensureColumn(userDb, 'private_questions', 'sentence_type', "sentence_type TEXT DEFAULT 'traditional'")
  ensureColumn(userDb, 'private_questions', 'public_question_source', 'public_question_source TEXT')
  ensureColumn(userDb, 'private_questions', 'host_form', 'host_form TEXT')
  ensureColumn(userDb, 'private_questions', 'host_form_zh', 'host_form_zh TEXT')
  ensureColumn(userDb, 'private_questions', 'pronoun_pattern', 'pronoun_pattern TEXT')
  ensureColumn(userDb, 'private_questions', 'io_pronoun', 'io_pronoun TEXT')
  ensureColumn(userDb, 'private_questions', 'do_pronoun', 'do_pronoun TEXT')
  userDb.exec(`
    UPDATE private_questions
    SET sentence_type = CASE
      WHEN LOWER(COALESCE(sentence_type, '')) IN ('traditional', 'with_pronoun')
        THEN LOWER(sentence_type)
      WHEN LOWER(COALESCE(sentence_type, '')) = 'pronoun'
        THEN 'with_pronoun'
      WHEN question_bank = 'pronoun' OR host_form IS NOT NULL
        THEN 'with_pronoun'
      ELSE 'traditional'
    END
    WHERE sentence_type IS NULL
      OR TRIM(sentence_type) = ''
      OR LOWER(sentence_type) NOT IN ('traditional', 'with_pronoun')
  `)

  const userQuestionRecordsDDL = getTableDDL(userDb, 'user_question_records')
  const needRebuildUserQuestionRecords = (
    userQuestionRecordsDDL &&
    !userQuestionRecordsDDL.includes('public_traditional')
  )
  if (needRebuildUserQuestionRecords) {
    userDb.exec(`
      CREATE TABLE IF NOT EXISTS user_question_records_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        question_id INTEGER NOT NULL,
        question_type TEXT NOT NULL CHECK(question_type IN ('public_traditional', 'public_pronoun', 'private')),
        practice_count INTEGER DEFAULT 0,
        correct_count INTEGER DEFAULT 0,
        rating INTEGER DEFAULT 0 CHECK(rating IN (-1, 0, 1)),
        last_practiced_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, question_id, question_type)
      )
    `)

    userDb.exec(`
      INSERT INTO user_question_records_new (
        id, user_id, question_id, question_type, practice_count, correct_count, rating, last_practiced_at
      )
      SELECT
        id,
        user_id,
        question_id,
        CASE
          WHEN question_type = 'public' THEN 'public_traditional'
          WHEN question_type = 'private' THEN 'private'
          WHEN question_type = 'public_traditional' THEN 'public_traditional'
          WHEN question_type = 'public_pronoun' THEN 'public_pronoun'
          ELSE 'private'
        END AS question_type,
        practice_count,
        correct_count,
        rating,
        last_practiced_at
      FROM user_question_records
    `)

    userDb.exec('DROP TABLE user_question_records')
    userDb.exec('ALTER TABLE user_question_records_new RENAME TO user_question_records')
  }

  userDb.exec(`CREATE INDEX IF NOT EXISTS idx_practice_records_user ON practice_records(user_id)`)
  userDb.exec(`CREATE INDEX IF NOT EXISTS idx_private_questions_user ON private_questions(user_id)`)
  userDb.exec(`CREATE INDEX IF NOT EXISTS idx_private_questions_user_sentence_type ON private_questions(user_id, sentence_type)`)
  userDb.exec(`CREATE INDEX IF NOT EXISTS idx_user_question_records ON user_question_records(user_id, question_id, question_type)`)
  userDb.exec(`CREATE INDEX IF NOT EXISTS idx_user_textbooks ON user_textbooks(user_id)`)
  userDb.exec(`CREATE INDEX IF NOT EXISTS idx_user_lesson_progress ON user_lesson_progress(user_id, lesson_id)`)
  userDb.exec(`CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(created_at)`)
  userDb.exec(`CREATE INDEX IF NOT EXISTS idx_admin_autofill_invalid_batch ON admin_autofill_invalid_entries(admin_id, batch_id)`)
  userDb.exec(`CREATE INDEX IF NOT EXISTS idx_admin_autofill_invalid_created ON admin_autofill_invalid_entries(created_at)`)
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
      has_tr_use INTEGER DEFAULT 0,
      has_intr_use INTEGER DEFAULT 0,
      supports_do INTEGER,
      supports_io INTEGER,
      supports_do_io INTEGER,
      gerund TEXT,
      participle TEXT,
      participle_forms TEXT,
      lesson_number INTEGER,
      textbook_volume INTEGER DEFAULT 1,
      frequency_level INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `)

  // 兼容旧数据库，补充列
  ensureColumn(vocabularyDb, 'verbs', 'has_tr_use', 'has_tr_use INTEGER DEFAULT 0')
  ensureColumn(vocabularyDb, 'verbs', 'has_intr_use', 'has_intr_use INTEGER DEFAULT 0')
  ensureColumn(vocabularyDb, 'verbs', 'supports_do', 'supports_do INTEGER')
  ensureColumn(vocabularyDb, 'verbs', 'supports_io', 'supports_io INTEGER')
  ensureColumn(vocabularyDb, 'verbs', 'supports_do_io', 'supports_do_io INTEGER')

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
      is_published INTEGER DEFAULT 1,
      order_index INTEGER DEFAULT 0,
      uploader_id INTEGER,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
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
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (textbook_id) REFERENCES textbooks(id) ON DELETE CASCADE
    )
  `)

  // 兼容旧数据库，补充教材/课程字段
  ensureColumn(vocabularyDb, 'textbooks', 'is_published', 'is_published INTEGER DEFAULT 1')
  ensureColumn(vocabularyDb, 'textbooks', 'updated_at', 'updated_at TEXT')
  ensureColumn(vocabularyDb, 'textbooks', 'uploader_id', 'uploader_id INTEGER')
  ensureColumn(vocabularyDb, 'lessons', 'updated_at', 'updated_at TEXT')
  vocabularyDb.exec(`
    UPDATE textbooks
    SET
      is_published = COALESCE(is_published, 1),
      updated_at = COALESCE(updated_at, created_at, datetime('now', 'localtime'))
  `)
  vocabularyDb.exec(`
    UPDATE lessons
    SET updated_at = COALESCE(updated_at, created_at, datetime('now', 'localtime'))
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
  // 传统题库（由原 public_questions 迁移而来）
  questionDb.exec(`
    CREATE TABLE IF NOT EXISTS public_traditional_conjugation (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      verb_id INTEGER NOT NULL,
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

  // 兼容早期实验版本：移除 public_traditional_conjugation.question_type 字段
  if (tableHasColumn(questionDb, 'public_traditional_conjugation', 'question_type')) {
    questionDb.exec(`
      CREATE TABLE IF NOT EXISTS public_traditional_conjugation_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        verb_id INTEGER NOT NULL,
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

    questionDb.exec(`
      INSERT INTO public_traditional_conjugation_new (
        id, verb_id, question_text, correct_answer, example_sentence, translation, hint,
        tense, mood, person, confidence_score, created_at
      )
      SELECT
        id, verb_id, question_text, correct_answer, example_sentence, translation, hint,
        tense, mood, person, confidence_score, created_at
      FROM public_traditional_conjugation
    `)

    questionDb.exec('DROP TABLE public_traditional_conjugation')
    questionDb.exec('ALTER TABLE public_traditional_conjugation_new RENAME TO public_traditional_conjugation')
  }

  const hasLegacyPublicQuestions = tableExists(questionDb, 'public_questions')
  if (hasLegacyPublicQuestions) {
    questionDb.exec(`
      INSERT OR IGNORE INTO public_traditional_conjugation (
        id, verb_id, question_text, correct_answer, example_sentence, translation, hint,
        tense, mood, person, confidence_score, created_at
      )
      SELECT
        id, verb_id, question_text, correct_answer, example_sentence, translation, hint,
        tense, mood, person, confidence_score, created_at
      FROM public_questions
    `)

    questionDb.exec(`DROP TABLE public_questions`)
    questionDb.exec(`DROP INDEX IF EXISTS idx_public_questions_verb`)
    questionDb.exec(`DROP INDEX IF EXISTS idx_public_questions_type`)
    questionDb.exec(`DROP INDEX IF EXISTS idx_public_questions_created`)
    questionDb.exec(`DROP INDEX IF EXISTS idx_public_questions_confidence`)
  }

  // 带代词变位题库（并行维护）
  questionDb.exec(`
    CREATE TABLE IF NOT EXISTS public_conjugation_with_pronoun (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      verb_id INTEGER NOT NULL,
      host_form TEXT NOT NULL CHECK(host_form IN ('finite', 'imperative', 'infinitive', 'gerund', 'prnl')),
      host_form_zh TEXT NOT NULL,
      pronoun_pattern TEXT,
      question_text TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      example_sentence TEXT,
      translation TEXT,
      hint TEXT,
      tense TEXT NOT NULL,
      mood TEXT NOT NULL,
      person TEXT NOT NULL,
      io_pronoun TEXT,
      do_pronoun TEXT,
      confidence_score INTEGER DEFAULT 50 CHECK(confidence_score >= 0 AND confidence_score <= 100),
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `)

  // 创建索引（传统题库）
  questionDb.exec(`CREATE INDEX IF NOT EXISTS idx_public_traditional_verb ON public_traditional_conjugation(verb_id)`)
  questionDb.exec(`CREATE INDEX IF NOT EXISTS idx_public_traditional_created ON public_traditional_conjugation(created_at)`)
  questionDb.exec(`CREATE INDEX IF NOT EXISTS idx_public_traditional_confidence ON public_traditional_conjugation(confidence_score)`)

  // 创建索引（带代词题库）
  questionDb.exec(`CREATE INDEX IF NOT EXISTS idx_public_pronoun_verb ON public_conjugation_with_pronoun(verb_id)`)
  questionDb.exec(`CREATE INDEX IF NOT EXISTS idx_public_pronoun_host_form ON public_conjugation_with_pronoun(host_form)`)
  questionDb.exec(`CREATE INDEX IF NOT EXISTS idx_public_pronoun_pattern ON public_conjugation_with_pronoun(pronoun_pattern)`)
  questionDb.exec(`CREATE INDEX IF NOT EXISTS idx_public_pronoun_created ON public_conjugation_with_pronoun(created_at)`)
  questionDb.exec(`CREATE INDEX IF NOT EXISTS idx_public_pronoun_confidence ON public_conjugation_with_pronoun(confidence_score)`)

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
