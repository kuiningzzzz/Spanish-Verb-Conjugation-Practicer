const { userDb, vocabularyDb } = require('../database/db')

class WrongVerb {
  // 添加或更新错题记录
  static addOrUpdate(userId, verbId) {
    // 先检查是否存在
    const existing = userDb.prepare(`
      SELECT id, wrong_count FROM wrong_verbs
      WHERE user_id = ? AND verb_id = ?
    `).get(userId, verbId)

    if (existing) {
      // 更新错题次数和时间
      const stmt = userDb.prepare(`
        UPDATE wrong_verbs
        SET wrong_count = wrong_count + 1,
            last_wrong_at = datetime('now', 'localtime')
        WHERE user_id = ? AND verb_id = ?
      `)
      stmt.run(userId, verbId)
      return existing.wrong_count + 1
    } else {
      // 新增错题记录
      const stmt = userDb.prepare(`
        INSERT INTO wrong_verbs (user_id, verb_id, wrong_count)
        VALUES (?, ?, 1)
      `)
      stmt.run(userId, verbId)
      return 1
    }
  }

  // 删除错题记录（答对后可选择移除）
  static remove(userId, verbId) {
    const stmt = userDb.prepare(`
      DELETE FROM wrong_verbs
      WHERE user_id = ? AND verb_id = ?
    `)
    const result = stmt.run(userId, verbId)
    return result.changes > 0
  }

  // 获取用户的错题列表
  static getByUserId(userId) {
    // 先从用户数据库获取错题记录
    const stmt = userDb.prepare(`
      SELECT id, verb_id, wrong_count, last_wrong_at, created_at
      FROM wrong_verbs
      WHERE user_id = ?
      ORDER BY last_wrong_at DESC
    `)
    const wrongs = stmt.all(userId)
    
    // 如果有错题，从词库数据库获取动词信息
    if (wrongs.length > 0) {
      const verbIds = wrongs.map(w => w.verb_id)
      const placeholders = verbIds.map(() => '?').join(',')
      const verbStmt = vocabularyDb.prepare(`
        SELECT id, infinitive, meaning, conjugation_type, is_irregular, is_reflexive, gerund, participle, participle_forms
        FROM verbs WHERE id IN (${placeholders})
      `)
      const verbs = verbStmt.all(...verbIds)
      const verbMap = {}
      verbs.forEach(v => verbMap[v.id] = v)
      
      // 合并数据
      wrongs.forEach(w => {
        const verb = verbMap[w.verb_id]
        if (verb) {
          w.infinitive = verb.infinitive
          w.meaning = verb.meaning
          w.conjugation_type = verb.conjugation_type
          w.is_irregular = verb.is_irregular
          w.is_reflexive = verb.is_reflexive
          w.gerund = verb.gerund
          w.participle = verb.participle
          w.participle_forms = verb.participle_forms
        }
      })
    }
    
    return wrongs
  }

  // 获取错题动词ID列表
  static getVerbIds(userId) {
    const stmt = userDb.prepare(`
      SELECT verb_id FROM wrong_verbs
      WHERE user_id = ?
    `)
    const results = stmt.all(userId)
    return results.map(r => r.verb_id)
  }

  // 获取错题数量
  static getCount(userId) {
    const stmt = userDb.prepare(`
      SELECT COUNT(*) as count FROM wrong_verbs
      WHERE user_id = ?
    `)
    const result = stmt.get(userId)
    return result.count
  }

  // 检查是否在错题本中
  static isWrong(userId, verbId) {
    const stmt = userDb.prepare(`
      SELECT id FROM wrong_verbs
      WHERE user_id = ? AND verb_id = ?
    `)
    const result = stmt.get(userId, verbId)
    return !!result
  }
}

module.exports = WrongVerb
