const { db } = require('../database/db')

class WrongVerb {
  // 添加或更新错题记录
  static addOrUpdate(userId, verbId) {
    // 先检查是否存在
    const existing = db.prepare(`
      SELECT id, wrong_count FROM wrong_verbs
      WHERE user_id = ? AND verb_id = ?
    `).get(userId, verbId)

    if (existing) {
      // 更新错题次数和时间
      const stmt = db.prepare(`
        UPDATE wrong_verbs
        SET wrong_count = wrong_count + 1,
            last_wrong_at = datetime('now', 'localtime')
        WHERE user_id = ? AND verb_id = ?
      `)
      stmt.run(userId, verbId)
      return existing.wrong_count + 1
    } else {
      // 新增错题记录
      const stmt = db.prepare(`
        INSERT INTO wrong_verbs (user_id, verb_id, wrong_count)
        VALUES (?, ?, 1)
      `)
      stmt.run(userId, verbId)
      return 1
    }
  }

  // 删除错题记录（答对后可选择移除）
  static remove(userId, verbId) {
    const stmt = db.prepare(`
      DELETE FROM wrong_verbs
      WHERE user_id = ? AND verb_id = ?
    `)
    const result = stmt.run(userId, verbId)
    return result.changes > 0
  }

  // 获取用户的错题列表
  static getByUserId(userId) {
    const stmt = db.prepare(`
      SELECT 
        wv.id,
        wv.verb_id,
        wv.wrong_count,
        wv.last_wrong_at,
        wv.created_at,
        v.infinitive,
        v.meaning,
        v.conjugation_type,
        v.is_irregular
      FROM wrong_verbs wv
      JOIN verbs v ON wv.verb_id = v.id
      WHERE wv.user_id = ?
      ORDER BY wv.last_wrong_at DESC
    `)
    return stmt.all(userId)
  }

  // 获取错题动词ID列表
  static getVerbIds(userId) {
    const stmt = db.prepare(`
      SELECT verb_id FROM wrong_verbs
      WHERE user_id = ?
    `)
    const results = stmt.all(userId)
    return results.map(r => r.verb_id)
  }

  // 获取错题数量
  static getCount(userId) {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM wrong_verbs
      WHERE user_id = ?
    `)
    const result = stmt.get(userId)
    return result.count
  }

  // 检查是否在错题本中
  static isWrong(userId, verbId) {
    const stmt = db.prepare(`
      SELECT id FROM wrong_verbs
      WHERE user_id = ? AND verb_id = ?
    `)
    const result = stmt.get(userId, verbId)
    return !!result
  }
}

module.exports = WrongVerb
