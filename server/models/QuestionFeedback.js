const Database = require('better-sqlite3')
const path = require('path')

// 使用同一个 feedback.db 数据库
const feedbackDbPath = path.join(__dirname, '../feedback.db')
const db = new Database(feedbackDbPath)

// 初始化题目反馈表
const initQuestionFeedbackTable = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS question_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      question_type TEXT NOT NULL,
      verb_infinitive TEXT NOT NULL,
      verb_id INTEGER,
      question_id TEXT,
      question_answer TEXT,
      issue_types TEXT,
      user_comment TEXT,
      mood TEXT,
      tense TEXT,
      person TEXT,
      question_source TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  
  // 检查是否需要添加 issue_types 字段（兼容旧数据库）
  try {
    const tableInfo = db.prepare("PRAGMA table_info(question_feedback)").all()
    const hasIssueTypes = tableInfo.some(col => col.name === 'issue_types')
    
    if (!hasIssueTypes) {
      db.exec(`ALTER TABLE question_feedback ADD COLUMN issue_types TEXT`)
      console.log('   ✓ 已添加 issue_types 字段到题目反馈表')
    }
  } catch (error) {
    console.log('   ⚠ 检查 issue_types 字段失败:', error.message)
  }
  
  console.log('   ✓ 题目反馈数据库表初始化成功')
}

// 初始化表
initQuestionFeedbackTable()

class QuestionFeedback {
  // 创建题目反馈
  static create(feedbackData) {
    const { 
      userId, 
      username, 
      questionType, 
      verbInfinitive,
      verbId,
      questionId,
      questionAnswer,
      issueTypes,
      userComment,
      mood,
      tense,
      person,
      questionSource
    } = feedbackData
    
    const stmt = db.prepare(`
      INSERT INTO question_feedback (
        user_id, 
        username, 
        question_type, 
        verb_infinitive,
        verb_id,
        question_id,
        question_answer,
        issue_types,
        user_comment,
        mood,
        tense,
        person,
        question_source
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    const result = stmt.run(
      userId, 
      username, 
      questionType, 
      verbInfinitive,
      verbId || null,
      questionId || null,
      questionAnswer || null,
      issueTypes || null,
      userComment || null,
      mood || null,
      tense || null,
      person || null,
      questionSource || null
    )
    return result.lastInsertRowid
  }

  // 获取用户的所有题目反馈
  static findByUserId(userId, limit = 50) {
    const stmt = db.prepare(`
      SELECT * FROM question_feedback 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `)
    return stmt.all(userId, limit)
  }

  // 获取所有题目反馈（管理员功能）
  static findAll(limit = 100, offset = 0) {
    const stmt = db.prepare(`
      SELECT * FROM question_feedback 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `)
    return stmt.all(limit, offset)
  }

  // 根据ID获取题目反馈
  static findById(id) {
    const stmt = db.prepare('SELECT * FROM question_feedback WHERE id = ?')
    return stmt.get(id)
  }

  // 根据题目类型获取反馈
  static findByQuestionType(questionType, limit = 50) {
    const stmt = db.prepare(`
      SELECT * FROM question_feedback 
      WHERE question_type = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `)
    return stmt.all(questionType, limit)
  }

  // 根据动词获取反馈
  static findByVerb(verbInfinitive, limit = 50) {
    const stmt = db.prepare(`
      SELECT * FROM question_feedback 
      WHERE verb_infinitive = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `)
    return stmt.all(verbInfinitive, limit)
  }

  // 获取题目反馈统计
  static getStatistics() {
    const totalStmt = db.prepare('SELECT COUNT(*) as total FROM question_feedback')
    const total = totalStmt.get().total

    const typeStmt = db.prepare(`
      SELECT 
        question_type,
        COUNT(*) as count
      FROM question_feedback
      GROUP BY question_type
      ORDER BY count DESC
    `)
    const typeDistribution = typeStmt.all()

    const verbStmt = db.prepare(`
      SELECT 
        verb_infinitive,
        COUNT(*) as count
      FROM question_feedback
      GROUP BY verb_infinitive
      ORDER BY count DESC
      LIMIT 10
    `)
    const topReportedVerbs = verbStmt.all()

    return {
      total,
      typeDistribution,
      topReportedVerbs
    }
  }

  // 删除题目反馈（管理员功能）
  static delete(id) {
    const stmt = db.prepare('DELETE FROM question_feedback WHERE id = ?')
    return stmt.run(id)
  }

  // 批量删除题目反馈
  static deleteByIds(ids) {
    if (!ids || ids.length === 0) return 0
    
    const placeholders = ids.map(() => '?').join(',')
    const stmt = db.prepare(`DELETE FROM question_feedback WHERE id IN (${placeholders})`)
    return stmt.run(...ids).changes
  }
}

module.exports = QuestionFeedback
