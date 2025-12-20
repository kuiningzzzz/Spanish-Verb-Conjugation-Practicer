const { userDb } = require('../database/db')

class AdminLog {
  static create(level, message, meta = null) {
    const stmt = userDb.prepare(
      'INSERT INTO admin_logs (level, message, meta) VALUES (?, ?, ?)' 
    )
    return stmt.run(level, message, meta ? JSON.stringify(meta) : null)
  }

  static list({ keyword, start, end, limit = 50, offset = 0 }) {
    const conditions = []
    const params = []

    if (keyword) {
      conditions.push('(message LIKE ? OR meta LIKE ?)')
      params.push(`%${keyword}%`, `%${keyword}%`)
    }

    if (start) {
      conditions.push('created_at >= ?')
      params.push(start)
    }

    if (end) {
      conditions.push('created_at <= ?')
      params.push(end)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const stmt = userDb.prepare(
      `SELECT * FROM admin_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    const rows = stmt.all(...params, limit, offset)
    const total = userDb
      .prepare(`SELECT COUNT(*) as total FROM admin_logs ${where}`)
      .get(...params).total

    return { rows, total }
  }
}

module.exports = AdminLog
