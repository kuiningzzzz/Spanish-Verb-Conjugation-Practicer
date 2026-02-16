const { userDb, vocabularyDb } = require('../database/db')

class FavoriteVerb {
  // 添加收藏
  static add(userId, verbId) {
    const stmt = userDb.prepare(`
      INSERT OR IGNORE INTO favorite_verbs (user_id, verb_id)
      VALUES (?, ?)
    `)
    const result = stmt.run(userId, verbId)
    return result.changes > 0
  }

  // 取消收藏
  static remove(userId, verbId) {
    const stmt = userDb.prepare(`
      DELETE FROM favorite_verbs
      WHERE user_id = ? AND verb_id = ?
    `)
    const result = stmt.run(userId, verbId)
    return result.changes > 0
  }

  // 检查是否已收藏
  static isFavorited(userId, verbId) {
    const stmt = userDb.prepare(`
      SELECT id FROM favorite_verbs
      WHERE user_id = ? AND verb_id = ?
    `)
    const result = stmt.get(userId, verbId)
    return !!result
  }

  // 获取用户的收藏列表
  static getByUserId(userId) {
    // 先从用户数据库获取收藏记录
    const stmt = userDb.prepare(`
      SELECT id, verb_id, created_at
      FROM favorite_verbs
      WHERE user_id = ?
      ORDER BY created_at DESC
    `)
    const favorites = stmt.all(userId)
    
    // 如果有收藏，从词库数据库获取动词信息
    if (favorites.length > 0) {
      const verbIds = favorites.map(f => f.verb_id)
      const placeholders = verbIds.map(() => '?').join(',')
      const verbStmt = vocabularyDb.prepare(`
        SELECT id, infinitive, meaning, conjugation_type, is_irregular, is_reflexive, has_tr_use, has_intr_use, gerund, participle, participle_forms
        FROM verbs WHERE id IN (${placeholders})
      `)
      const verbs = verbStmt.all(...verbIds)
      const verbMap = {}
      verbs.forEach(v => verbMap[v.id] = v)
      
      // 合并数据
      favorites.forEach(f => {
        const verb = verbMap[f.verb_id]
        if (verb) {
          f.infinitive = verb.infinitive
          f.meaning = verb.meaning
          f.conjugation_type = verb.conjugation_type
          f.is_irregular = verb.is_irregular
          f.is_reflexive = verb.is_reflexive
          f.has_tr_use = verb.has_tr_use
          f.has_intr_use = verb.has_intr_use
          f.gerund = verb.gerund
          f.participle = verb.participle
          f.participle_forms = verb.participle_forms
        }
      })
    }
    
    return favorites
  }

  // 获取收藏的动词ID列表
  static getVerbIds(userId) {
    const stmt = userDb.prepare(`
      SELECT verb_id FROM favorite_verbs
      WHERE user_id = ?
    `)
    const results = stmt.all(userId)
    return results.map(r => r.verb_id)
  }

  // 获取收藏数量
  static getCount(userId) {
    const stmt = userDb.prepare(`
      SELECT COUNT(*) as count FROM favorite_verbs
      WHERE user_id = ?
    `)
    const result = stmt.get(userId)
    return result.count
  }
}

module.exports = FavoriteVerb
