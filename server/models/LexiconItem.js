const { vocabularyDb } = require('../database/db')

class LexiconItem {
  static list(limit = 50, offset = 0) {
    const stmt = vocabularyDb.prepare(
      'SELECT * FROM lexicon_items ORDER BY created_at DESC LIMIT ? OFFSET ?'
    )
    const rows = stmt.all(limit, offset)
    const total = vocabularyDb
      .prepare('SELECT COUNT(*) as total FROM lexicon_items')
      .get().total
    return { rows, total }
  }

  static create(data) {
    const stmt = vocabularyDb.prepare(
      'INSERT INTO lexicon_items (title, description, payload) VALUES (?, ?, ?)' 
    )
    const result = stmt.run(data.title, data.description || null, data.payload || null)
    return result.lastInsertRowid
  }

  static findById(id) {
    return vocabularyDb.prepare('SELECT * FROM lexicon_items WHERE id = ?').get(id)
  }

  static update(id, data) {
    const stmt = vocabularyDb.prepare(
      `UPDATE lexicon_items SET title = ?, description = ?, payload = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
    )
    return stmt.run(data.title, data.description || null, data.payload || null, id)
  }

  static delete(id) {
    return vocabularyDb.prepare('DELETE FROM lexicon_items WHERE id = ?').run(id)
  }
}

module.exports = LexiconItem
