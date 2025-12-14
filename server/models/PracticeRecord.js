const { userDb, vocabularyDb } = require('../database/db')

class PracticeRecord {
  // 创建练习记录
  static create(recordData) {
    const { userId, verbId, exerciseType, isCorrect, answer, correctAnswer, tense, mood, person } = recordData
    
    const stmt = userDb.prepare(`
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
    const stmt = userDb.prepare(`
      INSERT INTO user_progress (user_id, verb_id, practice_count, correct_count, mastery_level, last_practiced_at)
      VALUES (?, ?, 1, ?, 0, datetime('now', 'localtime'))
      ON CONFLICT(user_id, verb_id) DO UPDATE SET
        practice_count = practice_count + 1,
        correct_count = correct_count + ?,
        mastery_level = CASE 
          WHEN (correct_count + ?) * 1.0 / (practice_count + 1) >= 0.8 AND practice_count + 1 >= 5 THEN 5
          WHEN (correct_count + ?) * 1.0 / (practice_count + 1) >= 0.7 AND practice_count + 1 >= 4 THEN 4
          WHEN (correct_count + ?) * 1.0 / (practice_count + 1) >= 0.6 AND practice_count + 1 >= 3 THEN 3
          WHEN (correct_count + ?) * 1.0 / (practice_count + 1) >= 0.5 THEN 2
          ELSE 1
        END,
        last_practiced_at = datetime('now', 'localtime')
    `)
    
    const correctValue = isCorrect ? 1 : 0
    stmt.run(userId, verbId, correctValue, correctValue, correctValue, correctValue, correctValue, correctValue)
  }

  // 获取用户练习记录
  static getByUserId(userId, limit = 50) {
    // 先从用户数据库获取记录
    const stmt = userDb.prepare(`
      SELECT * FROM practice_records
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `)
    const records = stmt.all(userId, limit)
    
    // 如果有记录，从词库数据库获取动词信息
    if (records.length > 0) {
      const verbIds = [...new Set(records.map(r => r.verb_id))]
      const placeholders = verbIds.map(() => '?').join(',')
      const verbStmt = vocabularyDb.prepare(`
        SELECT id, infinitive, meaning FROM verbs WHERE id IN (${placeholders})
      `)
      const verbs = verbStmt.all(...verbIds)
      const verbMap = {}
      verbs.forEach(v => verbMap[v.id] = v)
      
      // 合并动词信息
      records.forEach(r => {
        const verb = verbMap[r.verb_id]
        if (verb) {
          r.infinitive = verb.infinitive
          r.meaning = verb.meaning
        }
      })
    }
    
    return records
  }

  // 获取用户统计数据
  static getStatistics(userId) {
    const stmt = userDb.prepare(`
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
    const stmt = userDb.prepare(`
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
    // 先从用户数据库获取进度记录
    const stmt = userDb.prepare(`
      SELECT verb_id, mastery_level, practice_count, correct_count, last_practiced_at
      FROM user_progress
      WHERE user_id = ? AND mastery_level >= ?
      ORDER BY mastery_level DESC, last_practiced_at DESC
    `)
    const progress = stmt.all(userId, masteryLevel)
    
    // 如果有记录，从词库数据库获取动词信息
    if (progress.length > 0) {
      const verbIds = progress.map(p => p.verb_id)
      const placeholders = verbIds.map(() => '?').join(',')
      const verbStmt = vocabularyDb.prepare(`
        SELECT * FROM verbs WHERE id IN (${placeholders})
      `)
      const verbs = verbStmt.all(...verbIds)
      const verbMap = {}
      verbs.forEach(v => verbMap[v.id] = v)
      
      // 合并数据
      return progress.map(p => ({
        ...verbMap[p.verb_id],
        mastery_level: p.mastery_level,
        practice_count: p.practice_count,
        correct_count: p.correct_count,
        last_practiced_at: p.last_practiced_at
      })).filter(item => item.id) // 过滤掉找不到动词的记录
    }
    
    return []
  }
}

module.exports = PracticeRecord
