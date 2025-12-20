const bcrypt = require('bcryptjs')
const { userDb } = require('../database/db')
const AdminLog = require('../models/AdminLog')

function maskUser(user) {
  if (!user) return null
  const { password, ...rest } = user
  return rest
}

function buildUserFromRow(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    is_initial_admin: !!row.is_initial_admin,
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

function verifyCredentials(identifier, password) {
  const stmt = userDb.prepare('SELECT * FROM users WHERE username = ? OR email = ?')
  const user = stmt.get(identifier, identifier)
  if (!user || user.role !== 'admin') {
    return null
  }
  const match = bcrypt.compareSync(password, user.password)
  return match ? user : null
}

function listUsers(role = 'user', { limit = 50, offset = 0 } = {}) {
  const stmt = userDb.prepare(
    'SELECT id, username, email, role, is_initial_admin, created_at, updated_at FROM users WHERE role = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
  )
  const rows = stmt.all(role, limit, offset)
  const total = userDb.prepare('SELECT COUNT(*) as total FROM users WHERE role = ?').get(role).total
  return { rows: rows.map(buildUserFromRow), total }
}

function findUser(id) {
  const stmt = userDb.prepare(
    'SELECT id, username, email, role, is_initial_admin, created_at, updated_at FROM users WHERE id = ?'
  )
  return stmt.get(id)
}

function createUser({ username, email, password, role = 'user' }) {
  const hashed = bcrypt.hashSync(password, 10)
  const stmt = userDb.prepare(
    'INSERT INTO users (username, email, password, role, is_initial_admin) VALUES (?, ?, ?, ?, 0)'
  )
  const result = stmt.run(username, email || null, hashed, role)
  AdminLog.create('info', `${role} created`, { username, email })
  return result.lastInsertRowid
}

function updateUser(id, payload) {
  const updates = []
  const params = []

  if (payload.username !== undefined) {
    updates.push('username = ?')
    params.push(payload.username)
  }
  if (payload.email !== undefined) {
    updates.push('email = ?')
    params.push(payload.email)
  }
  if (payload.password) {
    updates.push('password = ?')
    params.push(bcrypt.hashSync(payload.password, 10))
  }
  if (payload.role) {
    updates.push('role = ?')
    params.push(payload.role)
  }

  updates.push("updated_at = datetime('now', 'localtime')")
  params.push(id)

  const stmt = userDb.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`)
  return stmt.run(...params)
}

function deleteUser(id) {
  const stmt = userDb.prepare('DELETE FROM users WHERE id = ?')
  return stmt.run(id)
}

module.exports = {
  maskUser,
  verifyCredentials,
  listUsers,
  findUser,
  createUser,
  updateUser,
  deleteUser
}
