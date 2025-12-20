const express = require('express')
const router = express.Router()
const {
  requireAdmin,
  requireInitialAdmin,
  signAdminToken,
  ADMIN_JWT_EXPIRES_IN
} = require('../middleware/adminAuth')
const {
  verifyCredentials,
  listUsers,
  findUser,
  createUser,
  updateUser,
  deleteUser
} = require('../src/admin/userService')
const LexiconItem = require('../models/LexiconItem')
const QuestionBank = require('../models/QuestionBank')
const Feedback = require('../models/Feedback')
const AdminLog = require('../models/AdminLog')

const loginAttempts = new Map()
const MAX_ATTEMPTS = 5
const BLOCK_DURATION_MS = 5 * 60 * 1000

function recordAttempt(key, success) {
  const now = Date.now()
  const entry = loginAttempts.get(key) || { count: 0, blockedUntil: null }
  if (entry.blockedUntil && entry.blockedUntil > now) {
    return entry
  }
  if (success) {
    loginAttempts.delete(key)
    return null
  }
  const count = entry.count + 1
  const blockedUntil = count >= MAX_ATTEMPTS ? now + BLOCK_DURATION_MS : null
  const updated = { count: blockedUntil ? 0 : count, blockedUntil }
  loginAttempts.set(key, updated)
  return updated
}

router.post('/auth/login', (req, res) => {
  const { identifier, password } = req.body
  const attemptKey = req.ip + (identifier || '')
  const now = Date.now()
  const status = loginAttempts.get(attemptKey)
  if (status && status.blockedUntil && status.blockedUntil > now) {
    return res.status(429).json({ error: '请稍后再试' })
  }

  if (!identifier || !password) {
    recordAttempt(attemptKey, false)
    return res.status(400).json({ error: '用户名或密码错误' })
  }

  const user = verifyCredentials(identifier, password)
  if (!user) {
    recordAttempt(attemptKey, false)
    return res.status(401).json({ error: '用户名或密码错误' })
  }

  recordAttempt(attemptKey, true)
  const token = signAdminToken(user)
  AdminLog.create('info', 'admin login', { userId: user.id })
  res.json({
    token,
    expiresIn: ADMIN_JWT_EXPIRES_IN,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      isInitialAdmin: !!user.is_initial_admin
    }
  })
})

router.get('/auth/me', requireAdmin, (req, res) => {
  res.json({ user: req.admin })
})

router.get('/users', requireAdmin, (req, res) => {
  const limit = Number(req.query.limit || 50)
  const offset = Number(req.query.offset || 0)
  const result = listUsers('user', { limit, offset })
  res.json(result)
})

router.post('/users', requireAdmin, (req, res) => {
  const { username, email, password } = req.body
  if (!username || !password) {
    return res.status(400).json({ error: '缺少必要字段' })
  }
  const id = createUser({ username, email, password, role: 'user' })
  res.status(201).json({ id })
})

router.get('/users/:id', requireAdmin, (req, res) => {
  const user = findUser(req.params.id)
  if (!user || user.role !== 'user') {
    return res.status(404).json({ error: '用户不存在' })
  }
  res.json(user)
})

router.put('/users/:id', requireAdmin, (req, res) => {
  const user = findUser(req.params.id)
  if (!user || user.role !== 'user') {
    return res.status(404).json({ error: '用户不存在' })
  }
  updateUser(req.params.id, req.body)
  res.json({ success: true })
})

router.delete('/users/:id', requireAdmin, (req, res) => {
  const user = findUser(req.params.id)
  if (!user || user.role !== 'user') {
    return res.status(404).json({ error: '用户不存在' })
  }
  deleteUser(req.params.id)
  res.json({ success: true })
})

router.get('/admins', requireAdmin, (req, res) => {
  const limit = Number(req.query.limit || 50)
  const offset = Number(req.query.offset || 0)
  const result = listUsers('admin', { limit, offset })
  res.json(result)
})

router.post('/admins', requireAdmin, (req, res) => {
  const { username, email, password } = req.body
  if (!username || !password) {
    return res.status(400).json({ error: '缺少必要字段' })
  }
  const id = createUser({ username, email, password, role: 'admin' })
  res.status(201).json({ id })
})

router.delete('/admins/:id', requireAdmin, requireInitialAdmin, (req, res) => {
  const user = findUser(req.params.id)
  if (!user || user.role !== 'admin') {
    return res.status(404).json({ error: '管理员不存在' })
  }
  if (user.is_initial_admin) {
    return res.status(403).json({ error: '不可删除初始管理员' })
  }
  deleteUser(req.params.id)
  res.json({ success: true })
})

router.get('/lexicon', requireAdmin, (req, res) => {
  const limit = Number(req.query.limit || 50)
  const offset = Number(req.query.offset || 0)
  res.json(LexiconItem.list(limit, offset))
})

router.post('/lexicon', requireAdmin, (req, res) => {
  if (!req.body.title) {
    return res.status(400).json({ error: '缺少标题' })
  }
  const id = LexiconItem.create(req.body)
  res.status(201).json({ id })
})

router.get('/lexicon/:id', requireAdmin, (req, res) => {
  const item = LexiconItem.findById(req.params.id)
  if (!item) return res.status(404).json({ error: '记录不存在' })
  res.json(item)
})

router.put('/lexicon/:id', requireAdmin, (req, res) => {
  const item = LexiconItem.findById(req.params.id)
  if (!item) return res.status(404).json({ error: '记录不存在' })
  LexiconItem.update(req.params.id, req.body)
  res.json({ success: true })
})

router.delete('/lexicon/:id', requireAdmin, (req, res) => {
  LexiconItem.delete(req.params.id)
  res.json({ success: true })
})

router.get('/question-bank', requireAdmin, (req, res) => {
  const limit = Number(req.query.limit || 50)
  const offset = Number(req.query.offset || 0)
  res.json(QuestionBank.list(limit, offset))
})

router.post('/question-bank', requireAdmin, (req, res) => {
  if (!req.body.title) {
    return res.status(400).json({ error: '缺少标题' })
  }
  const id = QuestionBank.create(req.body)
  res.status(201).json({ id })
})

router.get('/question-bank/:id', requireAdmin, (req, res) => {
  const item = QuestionBank.findById(req.params.id)
  if (!item) return res.status(404).json({ error: '记录不存在' })
  res.json(item)
})

router.put('/question-bank/:id', requireAdmin, (req, res) => {
  const item = QuestionBank.findById(req.params.id)
  if (!item) return res.status(404).json({ error: '记录不存在' })
  QuestionBank.update(req.params.id, req.body)
  res.json({ success: true })
})

router.delete('/question-bank/:id', requireAdmin, (req, res) => {
  QuestionBank.delete(req.params.id)
  res.json({ success: true })
})

router.get('/logs', requireAdmin, (req, res) => {
  const { keyword, start, end } = req.query
  const limit = Number(req.query.limit || 50)
  const offset = Number(req.query.offset || 0)
  const logs = AdminLog.list({ keyword, start, end, limit, offset })
  res.json(logs)
})

router.get('/feedback', requireAdmin, (req, res) => {
  const limit = Number(req.query.limit || 100)
  const offset = Number(req.query.offset || 0)
  const items = Feedback.findAll(limit, offset)
  const total = Feedback.countAll()
  res.json({ feedbackList: items, total })
})

router.get('/feedback/:id', requireAdmin, (req, res) => {
  const item = Feedback.findById(req.params.id)
  if (!item) return res.status(404).json({ error: '记录不存在' })
  res.json(item)
})

router.patch('/feedback/:id', requireAdmin, (req, res) => {
  const { status, admin_note } = req.body
  const item = Feedback.findById(req.params.id)
  if (!item) return res.status(404).json({ error: '记录不存在' })
  Feedback.updateStatus(req.params.id, status || item.status, admin_note ?? item.admin_note)
  res.json({ success: true })
})

router.delete('/feedback/:id', requireAdmin, (req, res) => {
  Feedback.delete(req.params.id)
  res.json({ success: true })
})

module.exports = router
