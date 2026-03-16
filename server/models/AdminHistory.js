const { adminHistoryDb } = require('../database/db')

const RECORD_SOURCES = {
  user: {
    table: 'user_history',
    allowedTypes: ['user']
  },
  lexicon: {
    table: 'lexicon_history',
    allowedTypes: ['lexicon']
  },
  question: {
    table: 'question_history',
    allowedTypes: ['question_traditional', 'question_pronoun']
  },
  textbook: {
    table: 'textbook_history',
    allowedTypes: ['textbook']
  }
}

function stringifyJson(value) {
  if (value === undefined || value === null) return null
  return JSON.stringify(value)
}

function parseJson(value) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch (error) {
    return null
  }
}

function normalizeOperatorRole(role) {
  const normalized = String(role || '').trim().toLowerCase()
  if (['admin', 'superadmin', 'dev', 'system'].includes(normalized)) {
    return normalized
  }
  return 'admin'
}

function normalizeVisibilityScope(scope) {
  return scope === 'superadmin_dev' ? 'superadmin_dev' : 'all'
}

function getSourceDefinition(source) {
  return RECORD_SOURCES[source] || null
}

function mapRow(row, source) {
  if (!row) return null
  return {
    id: Number(row.id),
    record_source: source,
    operator_username: row.operator_username,
    operator_role: row.operator_role,
    history_type: row.history_type,
    target_id: Number(row.target_id),
    action_type: row.action_type,
    visibility_scope: row.visibility_scope,
    modified_at: row.modified_at,
    changed_fields: parseJson(row.changed_fields) || [],
    before_data: parseJson(row.before_data),
    after_data: parseJson(row.after_data),
    snapshot_data: parseJson(row.snapshot_data)
  }
}

function canViewRecord(viewerRole, row) {
  const normalizedViewerRole = normalizeOperatorRole(viewerRole)
  if (normalizedViewerRole === 'dev' || normalizedViewerRole === 'superadmin') {
    return true
  }
  if (normalizedViewerRole !== 'admin') {
    return false
  }
  if (row.visibility_scope === 'superadmin_dev') {
    return false
  }
  return row.operator_role !== 'dev'
}

function buildVisibilityWhereClause(viewerRole) {
  const normalizedViewerRole = normalizeOperatorRole(viewerRole)
  if (normalizedViewerRole === 'dev' || normalizedViewerRole === 'superadmin') {
    return {
      clause: '',
      params: []
    }
  }
  return {
    clause: `WHERE visibility_scope = 'all' AND operator_role != ?`,
    params: ['dev']
  }
}

function getUnionSql() {
  return `
    SELECT 'user' AS record_source, id, operator_username, operator_role, history_type, target_id, action_type, visibility_scope, modified_at
    FROM user_history
    UNION ALL
    SELECT 'lexicon' AS record_source, id, operator_username, operator_role, history_type, target_id, action_type, visibility_scope, modified_at
    FROM lexicon_history
    UNION ALL
    SELECT 'question' AS record_source, id, operator_username, operator_role, history_type, target_id, action_type, visibility_scope, modified_at
    FROM question_history
    UNION ALL
    SELECT 'textbook' AS record_source, id, operator_username, operator_role, history_type, target_id, action_type, visibility_scope, modified_at
    FROM textbook_history
  `
}

class AdminHistory {
  static create(source, payload = {}) {
    const definition = getSourceDefinition(source)
    if (!definition) {
      throw new Error(`未知的管理历史来源: ${source}`)
    }

    const historyType = String(payload.history_type || '').trim()
    if (!definition.allowedTypes.includes(historyType)) {
      throw new Error(`管理历史类型不合法: ${historyType}`)
    }

    const stmt = adminHistoryDb.prepare(`
      INSERT INTO ${definition.table} (
        operator_username,
        operator_role,
        history_type,
        target_id,
        action_type,
        changed_fields,
        before_data,
        after_data,
        snapshot_data,
        visibility_scope
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const result = stmt.run(
      String(payload.operator_username || '').trim() || 'unknown',
      normalizeOperatorRole(payload.operator_role),
      historyType,
      Number(payload.target_id),
      String(payload.action_type || '').trim() || 'unknown',
      stringifyJson(payload.changed_fields),
      stringifyJson(payload.before_data),
      stringifyJson(payload.after_data),
      stringifyJson(payload.snapshot_data),
      normalizeVisibilityScope(payload.visibility_scope)
    )

    return result.lastInsertRowid
  }

  static list(viewerRole, { limit = 20, offset = 0 } = {}) {
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20))
    const safeOffset = Math.max(0, Number(offset) || 0)
    const { clause, params } = buildVisibilityWhereClause(viewerRole)
    const unionSql = getUnionSql()

    const rows = adminHistoryDb.prepare(`
      SELECT *
      FROM (${unionSql})
      ${clause}
      ORDER BY datetime(modified_at) DESC, id DESC
      LIMIT ? OFFSET ?
    `).all(...params, safeLimit, safeOffset)

    const total = adminHistoryDb.prepare(`
      SELECT COUNT(*) AS total
      FROM (${unionSql})
      ${clause}
    `).get(...params).total

    return {
      rows: rows.map((row) => ({
        id: Number(row.id),
        record_source: row.record_source,
        operator_username: row.operator_username,
        operator_role: row.operator_role,
        history_type: row.history_type,
        target_id: Number(row.target_id),
        action_type: row.action_type,
        visibility_scope: row.visibility_scope,
        modified_at: row.modified_at
      })),
      total: Number(total || 0)
    }
  }

  static findBySourceAndId(source, id, viewerRole) {
    const definition = getSourceDefinition(source)
    if (!definition) return null

    const row = adminHistoryDb.prepare(`
      SELECT *
      FROM ${definition.table}
      WHERE id = ?
    `).get(id)

    if (!row || !canViewRecord(viewerRole, row)) {
      return null
    }

    return mapRow(row, source)
  }

  static deleteBySourceAndId(source, id) {
    const definition = getSourceDefinition(source)
    if (!definition) {
      return { changes: 0 }
    }
    return adminHistoryDb.prepare(`
      DELETE FROM ${definition.table}
      WHERE id = ?
    `).run(id)
  }

  static deleteOlderThan(days = 30) {
    const safeDays = Math.max(0, Number(days) || 30)
    const modifier = `-${safeDays} days`
    let deleted = 0
    const breakdown = {}

    Object.entries(RECORD_SOURCES).forEach(([source, definition]) => {
      const result = adminHistoryDb.prepare(`
        DELETE FROM ${definition.table}
        WHERE datetime(modified_at) < datetime('now', 'localtime', ?)
      `).run(modifier)
      const count = Number(result.changes || 0)
      breakdown[source] = count
      deleted += count
    })

    return {
      deleted,
      breakdown
    }
  }
}

module.exports = AdminHistory
