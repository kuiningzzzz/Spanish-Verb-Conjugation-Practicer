const jwt = require('jsonwebtoken')
const { userDb } = require('../database/db')

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'change-admin-secret'
const ADMIN_JWT_EXPIRES_IN = process.env.ADMIN_JWT_EXPIRES_IN || '1d'

function signAdminToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      role: user.role,
      isInitialAdmin: !!user.is_initial_admin
    },
    ADMIN_JWT_SECRET,
    { expiresIn: ADMIN_JWT_EXPIRES_IN }
  )
}

function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未授权访问' })
  }

  const token = authHeader.substring(7)
  try {
    const payload = jwt.verify(token, ADMIN_JWT_SECRET)
    const user = userDb.prepare('SELECT id, username, email, role, is_initial_admin FROM users WHERE id = ?').get(payload.userId)
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: '无权限访问' })
    }
    req.admin = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      isInitialAdmin: !!user.is_initial_admin
    }
    next()
  } catch (error) {
    return res.status(401).json({ error: '无效的凭证' })
  }
}

function requireInitialAdmin(req, res, next) {
  if (!req.admin) {
    return res.status(401).json({ error: '未授权访问' })
  }
  if (!req.admin.isInitialAdmin) {
    return res.status(403).json({ error: '仅初始管理员可执行此操作' })
  }
  next()
}

module.exports = {
  signAdminToken,
  requireAdmin,
  requireInitialAdmin,
  ADMIN_JWT_SECRET,
  ADMIN_JWT_EXPIRES_IN
}
