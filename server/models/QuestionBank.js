const { questionDb } = require('../database/db')

class QuestionBank {
  static list(limit = 50, offset = 0) {
    const stmt = questionDb.prepare(
      'SELECT * FROM question_bank ORDER BY created_at DESC LIMIT ? OFFSET ?'
    )
    const rows = stmt.all(limit, offset)
    const total = questionDb.prepare('SELECT COUNT(*) as total FROM question_bank').get().total
    return { rows, total }
  }

  static create(data) {
    const stmt = questionDb.prepare(
      'INSERT INTO question_bank (title, payload) VALUES (?, ?)' 
    )
    const result = stmt.run(data.title, data.payload || null)
    return result.lastInsertRowid
  }

  static findById(id) {
    return questionDb.prepare('SELECT * FROM question_bank WHERE id = ?').get(id)
  }

  static update(id, data) {
    const stmt = questionDb.prepare(
      `UPDATE question_bank SET title = ?, payload = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
    )
    return stmt.run(data.title, data.payload || null, id)
  }

  static delete(id) {
    return questionDb.prepare('DELETE FROM question_bank WHERE id = ?').run(id)
  }
}

module.exports = QuestionBank
