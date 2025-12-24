const { questionDb } = require('../database/db')

class QuestionBank {
  static list(limit = 50, offset = 0, keyword = '') {
    let query = 'SELECT * FROM question_bank WHERE 1=1'
    let countQuery = 'SELECT COUNT(*) as total FROM question_bank WHERE 1=1'
    const params = []
    const countParams = []

    if (keyword) {
      const like = `%${keyword}%`
      query += ' AND (title LIKE ? OR payload LIKE ? OR CAST(id AS TEXT) LIKE ?)'
      countQuery += ' AND (title LIKE ? OR payload LIKE ? OR CAST(id AS TEXT) LIKE ?)'
      params.push(like, like, like)
      countParams.push(like, like, like)
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const rows = questionDb.prepare(query).all(...params)
    const total = questionDb.prepare(countQuery).get(...countParams).total
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
