const { userDb: db } = require('../database/db')

class PracticeRecord {
  // 创建练习记录
  static create(recordData) {
    const { userId, verbId, exerciseType, isCorrect, answer, correctAnswer, tense, mood, person } = recordData
    
    const stmt = db.prepare(`
      INSERT INTO practice_records (user_id, verb_id, exercise_type, is_correct, answer, correct_answer, tense, mood, person)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    const result = stmt.run(userId, verbId, exerciseType, isCorrect, answer, correctAnswer, tense, mood, person)
    
    // 更新用户进度
    this.updateUserProgress(userId, verbId, isCorrect)
    
    return result.lastInsertRowid
  }

  // 更新用户进度
  static updateUserProgress(userId, verbId, isCorrect) {
    const stmt = db.prepare(`
      INSERT INTO user_progress (user_id, verb_id, practice_count, correct_count, mastery_level, last_practiced_at)
      VALUES (?, ?, 1, ?, 0, datetime('now', 'localtime'))
      ON CONFLICT(user_id, verb_id) DO UPDATE SET
        practice_count = practice_count + 1,
        correct_count = correct_count + ?,
        mastery_level = CASE 
          WHEN (correct_count + ?) * 1.0 / (practice_count + 1) >= 0.9 AND practice_count + 1 >= 10 THEN 5
          WHEN (correct_count + ?) * 1.0 / (practice_count + 1) >= 0.8 AND practice_count + 1 >= 8 THEN 4
          WHEN (correct_count + ?) * 1.0 / (practice_count + 1) >= 0.7 AND practice_count + 1 >= 5 THEN 3
          WHEN (correct_count + ?) * 1.0 / (practice_count + 1) >= 0.6 THEN 2
          ELSE 1
        END,
        last_practiced_at = datetime('now', 'localtime')
    `)
    
    const correctValue = isCorrect ? 1 : 0
    stmt.run(userId, verbId, correctValue, correctValue, correctValue, correctValue, correctValue, correctValue)
  }

  // 获取用户练习记录
  static getByUserId(userId, limit = 50) {
    const stmt = db.prepare(`
      SELECT pr.*, v.infinitive, v.meaning 
      FROM practice_records pr
      JOIN verbs v ON pr.verb_id = v.id
      WHERE pr.user_id = ?
      ORDER BY pr.created_at DESC
      LIMIT ?
    `)
    return stmt.all(userId, limit)
  }

  // 获取用户统计数据
  static getStatistics(userId) {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total_exercises,
        SUM(is_correct) as correct_exercises,
        COUNT(DISTINCT verb_id) as practiced_verbs,
        COUNT(DISTINCT DATE(created_at)) as practice_days
      FROM practice_records
      WHERE user_id = ?
    `)
    return stmt.get(userId)
  }

  // 获取今日练习统计
  static getTodayStatistics(userId) {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total_exercises,
        SUM(is_correct) as correct_exercises
      FROM practice_records
      WHERE user_id = ? AND DATE(created_at) = DATE('now', 'localtime')
    `)
    return stmt.get(userId)
  }

  // 获取用户掌握的动词列表
  static getMasteredVerbs(userId, masteryLevel = 3) {
    const stmt = db.prepare(`
      SELECT v.*, up.mastery_level, up.practice_count, up.correct_count
      FROM user_progress up
      JOIN verbs v ON up.verb_id = v.id
      WHERE up.user_id = ? AND up.mastery_level >= ?
      ORDER BY up.mastery_level DESC, up.last_practiced_at DESC
    `)
    return stmt.all(userId, masteryLevel)
  }
}

module.exports = PracticeRecord
