const Database = require('better-sqlite3')
const path = require('path')

// 创建或打开 feedback.db 数据库
const feedbackDbPath = path.join(__dirname, '../data/feedback.db')
const db = new Database(feedbackDbPath)

// 初始化反馈表
const initFeedbackTable = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      satisfaction INTEGER NOT NULL CHECK(satisfaction >= 1 AND satisfaction <= 4),
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  console.log('   ✓ 反馈数据库表初始化成功')
}

// 初始化表
initFeedbackTable()

class Feedback {
  // 创建反馈
  static create(feedbackData) {
    const { userId, username, satisfaction, comment } = feedbackData
    
    const stmt = db.prepare(`
      INSERT INTO feedback (user_id, username, satisfaction, comment)
      VALUES (?, ?, ?, ?)
    `)
    
    const result = stmt.run(userId, username, satisfaction, comment || null)
    return result.lastInsertRowid
  }

  // 获取用户的所有反馈
  static findByUserId(userId, limit = 50) {
    const stmt = db.prepare(`
      SELECT * FROM feedback 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `)
    return stmt.all(userId, limit)
  }

  // 获取所有反馈（管理员功能，可选）
  static findAll(limit = 100) {
    const stmt = db.prepare(`
      SELECT * FROM feedback 
      ORDER BY created_at DESC 
      LIMIT ?
    `)
    return stmt.all(limit)
  }

  // 根据ID获取反馈
  static findById(id) {
    const stmt = db.prepare('SELECT * FROM feedback WHERE id = ?')
    return stmt.get(id)
  }

  // 获取反馈统计
  static getStatistics() {
    const totalStmt = db.prepare('SELECT COUNT(*) as total FROM feedback')
    const total = totalStmt.get().total

    const satisfactionStmt = db.prepare(`
      SELECT 
        satisfaction,
        COUNT(*) as count
      FROM feedback
      GROUP BY satisfaction
      ORDER BY satisfaction
    `)
    const satisfactionDistribution = satisfactionStmt.all()

    const avgStmt = db.prepare('SELECT AVG(satisfaction) as average FROM feedback')
    const average = avgStmt.get().average

    return {
      total,
      average: average ? parseFloat(average.toFixed(2)) : 0,
      distribution: satisfactionDistribution
    }
  }

  // 删除反馈（可选功能）
  static delete(id) {
    const stmt = db.prepare('DELETE FROM feedback WHERE id = ?')
    return stmt.run(id)
  }
}

module.exports = Feedback
