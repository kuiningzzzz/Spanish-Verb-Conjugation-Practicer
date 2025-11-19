const { db } = require('../database/db')

class FavoriteVerb {
  // 添加收藏
  static add(userId, verbId) {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO favorite_verbs (user_id, verb_id)
      VALUES (?, ?)
    `)
    const result = stmt.run(userId, verbId)
    return result.changes > 0
  }

  // 取消收藏
  static remove(userId, verbId) {
    const stmt = db.prepare(`
      DELETE FROM favorite_verbs
      WHERE user_id = ? AND verb_id = ?
    `)
    const result = stmt.run(userId, verbId)
    return result.changes > 0
  }

  // 检查是否已收藏
  static isFavorited(userId, verbId) {
    const stmt = db.prepare(`
      SELECT id FROM favorite_verbs
      WHERE user_id = ? AND verb_id = ?
    `)
    const result = stmt.get(userId, verbId)
    return !!result
  }

  // 获取用户的收藏列表
  static getByUserId(userId) {
    const stmt = db.prepare(`
      SELECT 
        fv.id,
        fv.verb_id,
        fv.created_at,
        v.infinitive,
        v.meaning,
        v.conjugation_type,
        v.is_irregular
      FROM favorite_verbs fv
      JOIN verbs v ON fv.verb_id = v.id
      WHERE fv.user_id = ?
      ORDER BY fv.created_at DESC
    `)
    return stmt.all(userId)
  }

  // 获取收藏的动词ID列表
  static getVerbIds(userId) {
    const stmt = db.prepare(`
      SELECT verb_id FROM favorite_verbs
      WHERE user_id = ?
    `)
    const results = stmt.all(userId)
    return results.map(r => r.verb_id)
  }

  // 获取收藏数量
  static getCount(userId) {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM favorite_verbs
      WHERE user_id = ?
    `)
    const result = stmt.get(userId)
    return result.count
  }
}

module.exports = FavoriteVerb
