const express = require('express')
const router = express.Router()
const { requireAdmin, signAdminToken, ADMIN_JWT_EXPIRES_IN } = require('../middleware/adminAuth')
const {
  verifyCredentials,
  listUsers,
  listAllUsers,
  findUser,
  createUser,
  updateUser,
  deleteUser
} = require('../admin/userService')
const LexiconItem = require('../models/LexiconItem')
const Question = require('../models/Question')
const Verb = require('../models/Verb')
const Conjugation = require('../models/Conjugation')
const QuestionBank = require('../models/QuestionBank')
const Feedback = require('../models/Feedback')
const QuestionFeedback = require('../models/QuestionFeedback')
const AdminLog = require('../models/AdminLog')
const Verb = require('../models/Verb')
const { vocabularyDb } = require('../database/db')

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
  const { identifier, email, username, password } = req.body
  const loginIdentifier = identifier || email || username
  const attemptKey = req.ip + (loginIdentifier || '')
  const now = Date.now()
  const status = loginAttempts.get(attemptKey)
  if (status && status.blockedUntil && status.blockedUntil > now) {
    return res.status(429).json({ error: '请稍后再试' })
  }

  if (!loginIdentifier || !password) {
    recordAttempt(attemptKey, false)
    return res.status(400).json({ error: '用户名或密码错误' })
  }

  const user = verifyCredentials(loginIdentifier, password)
  if (!user) {
    recordAttempt(attemptKey, false)
    return res.status(401).json({ error: '用户名或密码错误' })
  }

  if (!['admin', 'dev'].includes(user.role)) {
    recordAttempt(attemptKey, false)
    return res.status(403).json({ error: '无权访问后台' })
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
      isInitialAdmin: !!user.is_initial_admin,
      isInitialDev: !!user.is_initial_dev
    }
  })
})

router.get('/auth/me', requireAdmin, (req, res) => {
  res.json({ user: req.admin })
})

router.post('/auth/logout', requireAdmin, (req, res) => {
  AdminLog.create('info', 'admin logout', { userId: req.admin.id })
  res.json({ success: true })
})

function isDev(req) {
  return req.admin?.role === 'dev'
}

function forbid(res, message = '无权限') {
  return res.status(403).json({ error: message })
}

router.get('/users', requireAdmin, (req, res) => {
  const limit = Number(req.query.limit || 50)
  const offset = Number(req.query.offset || 0)
  const role = req.query.role
  const result = role ? listUsers(role, { limit, offset }) : listAllUsers({ limit, offset })
  res.json(result)
})

router.post('/users', requireAdmin, (req, res) => {
  if (!isDev(req)) {
    return forbid(res, '仅 dev 可以创建用户')
  }
  const { username, email, password, role = 'user' } = req.body
  if (!username || !password) {
    return res.status(400).json({ error: '缺少必要字段' })
  }
  if (!['user', 'admin', 'dev'].includes(role)) {
    return res.status(400).json({ error: '非法角色' })
  }
  const id = createUser({ username, email, password, role })
  res.status(201).json({ id })
})

router.get('/users/:id', requireAdmin, (req, res) => {
  const user = findUser(req.params.id)
  if (!user) {
    return res.status(404).json({ error: '用户不存在' })
  }
  res.json(user)
})

router.put('/users/:id', requireAdmin, (req, res) => {
  const target = findUser(req.params.id)
  if (!target) {
    return res.status(404).json({ error: '用户不存在' })
  }

  if (target.is_initial_dev && req.body.role && req.body.role !== 'dev') {
    return forbid(res, '初始 dev 角色不可变更')
  }

  if (target.role === 'dev' && !isDev(req)) {
    return forbid(res, '管理员不能修改 dev 用户')
  }

  if (target.role === 'admin' && !isDev(req) && req.body.role && req.body.role !== 'admin') {
    return forbid(res, '不能取消管理员权限')
  }

  if (!isDev(req) && req.body.role === 'dev') {
    return forbid(res, '管理员不可创建或提升 dev')
  }

  updateUser(req.params.id, req.body)
  res.json({ success: true })
})

router.delete('/users/:id', requireAdmin, (req, res) => {
  const target = findUser(req.params.id)
  if (!target) {
    return res.status(404).json({ error: '用户不存在' })
  }
  if (target.is_initial_dev) {
    return forbid(res, '不可删除初始 dev 用户')
  }
  if (req.admin.id === target.id) {
    return forbid(res, '不能删除自己')
  }
  if (target.role === 'dev' && !isDev(req)) {
    return forbid(res, '管理员不能删除 dev 用户')
  }
  if (!isDev(req) && ['admin', 'dev'].includes(target.role)) {
    return forbid(res, '无权删除该用户')
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
  if (!isDev(req)) {
    return forbid(res, '仅 dev 可以创建管理员')
  }
  const { username, email, password } = req.body
  if (!username || !password) {
    return res.status(400).json({ error: '缺少必要字段' })
  }
  const id = createUser({ username, email, password, role: 'admin' })
  res.status(201).json({ id })
})

router.delete('/admins/:id', requireAdmin, (req, res) => {
  const user = findUser(req.params.id)
  if (!user || user.role !== 'admin') {
    return res.status(404).json({ error: '管理员不存在' })
  }
  if (user.is_initial_admin) {
    return res.status(403).json({ error: '不可删除初始管理员' })
  }
  if (!isDev(req) && !req.admin.isInitialAdmin) {
    return forbid(res, '仅初始管理员可删除管理员')
  }
  deleteUser(req.params.id)
  res.json({ success: true })
})

router.get('/lexicon', requireAdmin, (req, res) => {
  const limit = Number(req.query.limit || 50)
  const offset = Number(req.query.offset || 0)
  res.json(LexiconItem.list(limit, offset))
})

// 动词管理：列表、查询、创建、更新、删除
router.get('/verbs', requireAdmin, (req, res) => {
  const limit = Number(req.query.limit || 50)
  const offset = Number(req.query.offset || 0)
  const q = (req.query.q || '').toString().trim()
  if (q) {
    const qLower = q.toLowerCase()
    const like = `%${qLower}%`
    const rows = vocabularyDb.prepare(`
      SELECT *,
        (CASE WHEN lower(infinitive) = ? THEN 200 WHEN lower(infinitive) LIKE ? THEN 100 ELSE 0 END)
        + (CASE WHEN lower(meaning) LIKE ? THEN 20 ELSE 0 END) AS score
      FROM verbs
      WHERE lower(infinitive) LIKE ? OR lower(meaning) LIKE ?
      ORDER BY score DESC, lesson_number, id
      LIMIT ? OFFSET ?
    `).all(qLower, like, like, like, like, limit, offset)

    const total = vocabularyDb.prepare('SELECT COUNT(*) as total FROM verbs WHERE lower(infinitive) LIKE ? OR lower(meaning) LIKE ?').get(like, like).total
    res.json({ rows, total })
    return
  }

  const rows = vocabularyDb.prepare('SELECT * FROM verbs ORDER BY lesson_number, id LIMIT ? OFFSET ?').all(limit, offset)
  const total = vocabularyDb.prepare('SELECT COUNT(*) as total FROM verbs').get().total
  res.json({ rows, total })
})

router.get('/verbs/:id', requireAdmin, (req, res) => {
  const item = Verb.findById(req.params.id)
  if (!item) return res.status(404).json({ error: '记录不存在' })
  res.json(item)
})

// 获取某个动词的所有变位
router.get('/verbs/:id/conjugations', requireAdmin, (req, res) => {
  const verbId = req.params.id
  const rows = vocabularyDb.prepare('SELECT * FROM conjugations WHERE verb_id = ? ORDER BY id').all(verbId)
  res.json({ rows })
})

// 创建某个动词的变位
router.post('/verbs/:id/conjugations', requireAdmin, (req, res) => {
  const verbId = req.params.id
  const { tense, mood, person, conjugated_form, is_irregular } = req.body || {}
  if (!tense || !mood || !person || !conjugated_form) {
    return res.status(400).json({ error: '缺少必填字段' })
  }
  const stmt = vocabularyDb.prepare('INSERT INTO conjugations (verb_id, tense, mood, person, conjugated_form, is_irregular) VALUES (?, ?, ?, ?, ?, ?)')
  const result = stmt.run(verbId, tense, mood, person, conjugated_form, is_irregular ? 1 : 0)
  res.status(201).json({ id: result.lastInsertRowid })
})

// 获取单个变位记录
router.get('/conjugations/:id', requireAdmin, (req, res) => {
  const item = vocabularyDb.prepare('SELECT * FROM conjugations WHERE id = ?').get(req.params.id)
  if (!item) return res.status(404).json({ error: '记录不存在' })
  res.json(item)
})

// 更新变位
router.put('/conjugations/:id', requireAdmin, (req, res) => {
  const id = req.params.id
  const existing = vocabularyDb.prepare('SELECT * FROM conjugations WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: '记录不存在' })
  const { tense, mood, person, conjugated_form, is_irregular } = req.body || {}
  const stmt = vocabularyDb.prepare('UPDATE conjugations SET tense = ?, mood = ?, person = ?, conjugated_form = ?, is_irregular = ? WHERE id = ?')
  stmt.run(tense || existing.tense, mood || existing.mood, person || existing.person, conjugated_form || existing.conjugated_form, is_irregular ?? existing.is_irregular, id)
  res.json({ success: true })
})

// 删除变位
router.delete('/conjugations/:id', requireAdmin, (req, res) => {
  vocabularyDb.prepare('DELETE FROM conjugations WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

router.post('/verbs', requireAdmin, (req, res) => {
  const data = req.body || {}
  if (!data.infinitive) return res.status(400).json({ error: '缺少动词原形 (infinitive)' })
  const id = Verb.create({
    infinitive: data.infinitive,
    meaning: data.meaning || null,
    conjugationType: data.conjugation_type || data.conjugationType || 1,
    isIrregular: data.is_irregular || data.isIrregular || 0,
    isReflexive: data.is_reflexive || data.isReflexive || 0,
    gerund: data.gerund || null,
    participle: data.participle || null,
    participleForms: data.participle_forms || null,
    lessonNumber: data.lesson_number || null,
    textbookVolume: data.textbook_volume || 1,
    frequencyLevel: data.frequency_level || 1
  })
  res.status(201).json({ id })
})

router.put('/verbs/:id', requireAdmin, (req, res) => {
  const id = req.params.id
  const data = req.body || {}
  const existing = Verb.findById(id)
  if (!existing) return res.status(404).json({ error: '记录不存在' })
  const stmt = vocabularyDb.prepare(`
    UPDATE verbs SET
      infinitive = ?,
      meaning = ?,
      conjugation_type = ?,
      is_irregular = ?,
      is_reflexive = ?,
      gerund = ?,
      participle = ?,
      participle_forms = ?,
      lesson_number = ?,
      textbook_volume = ?,
      frequency_level = ?,
      created_at = created_at
    WHERE id = ?
  `)
  stmt.run(
    data.infinitive || existing.infinitive,
    data.meaning || existing.meaning,
    data.conjugation_type ?? data.conjugationType ?? existing.conjugation_type,
    data.is_irregular ?? data.isIrregular ?? existing.is_irregular,
    data.is_reflexive ?? data.isReflexive ?? existing.is_reflexive,
    data.gerund ?? existing.gerund,
    data.participle ?? existing.participle,
    data.participle_forms ?? existing.participle_forms,
    data.lesson_number ?? existing.lesson_number,
    data.textbook_volume ?? existing.textbook_volume,
    data.frequency_level ?? existing.frequency_level,
    id
  )
  res.json({ success: true })
})

router.delete('/verbs/:id', requireAdmin, (req, res) => {
  vocabularyDb.prepare('DELETE FROM verbs WHERE id = ?').run(req.params.id)
  res.json({ success: true })
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
  const keyword = req.query.keyword ? String(req.query.keyword).trim() : ''
  res.json(QuestionBank.list(limit, offset, keyword))
})

router.get('/questions', requireAdmin, (req, res) => {
  const limit = Number(req.query.limit || 50)
  const offset = Number(req.query.offset || 0)
  const keyword = req.query.keyword ? String(req.query.keyword).trim() : ''
  const sortBy = req.query.sortBy ? String(req.query.sortBy).trim() : 'created_at'
  const sortOrder = req.query.sortOrder ? String(req.query.sortOrder).trim() : 'desc'
  res.json(Question.listPublic({ limit, offset, keyword, sortBy, sortOrder }))
})

router.get('/questions/:id', requireAdmin, (req, res) => {
  const item = Question.findPublicById(req.params.id)
  if (!item) return res.status(404).json({ error: '记录不存在' })
  res.json(item)
})

router.get('/verbs/:id', requireAdmin, (req, res) => {
  const verbId = Number(req.params.id)
  if (!verbId || Number.isNaN(verbId)) {
    return res.status(400).json({ error: '动词ID不合法' })
  }
  const verb = Verb.findById(verbId)
  if (!verb) {
    return res.status(404).json({ error: '动词不存在' })
  }
  res.json({
    verb: {
      id: verb.id,
      infinitive: verb.infinitive
    }
  })
})

router.get('/conjugations/options', requireAdmin, (req, res) => {
  res.json(Conjugation.getOptions())
})

router.put('/questions/:id', requireAdmin, (req, res) => {
  const item = Question.findPublicById(req.params.id)
  if (!item) return res.status(404).json({ error: '记录不存在' })

  const payload = {
    verb_id: Number(req.body.verb_id ?? item.verb_id),
    question_type: req.body.question_type ?? item.question_type,
    question_text: req.body.question_text ?? item.question_text,
    correct_answer: req.body.correct_answer ?? item.correct_answer,
    example_sentence: req.body.example_sentence ?? item.example_sentence,
    translation: req.body.translation ?? item.translation,
    hint: req.body.hint ?? item.hint,
    tense: req.body.tense ?? item.tense,
    mood: req.body.mood ?? item.mood,
    person: req.body.person ?? item.person,
    confidence_score: Number.isFinite(Number(req.body.confidence_score))
      ? Number(req.body.confidence_score)
      : item.confidence_score
  }

  if (!payload.verb_id || Number.isNaN(payload.verb_id)) {
    return res.status(400).json({ error: '缺少动词ID', errors: { verb_id: '动词ID不能为空' } })
  }

  const verb = Verb.findById(payload.verb_id)
  if (!verb) {
    return res.status(400).json({ error: '动词ID不存在', errors: { verb_id: '动词ID不存在' } })
  }
  if (!['fill', 'sentence'].includes(payload.question_type)) {
    return res.status(400).json({ error: '题目类型需为 fill 或 sentence' })
  }
  if (!payload.question_text || !payload.correct_answer) {
    return res.status(400).json({ error: '题干和答案不能为空' })
  }
  if (!payload.tense || !payload.mood || !payload.person) {
    return res.status(400).json({ error: '时态/语气/人称不能为空' })
  }
  if (payload.confidence_score < 0 || payload.confidence_score > 100) {
    return res.status(400).json({ error: '置信度需在 0-100 之间' })
  }

  Question.updatePublic(req.params.id, payload)
  res.json({ success: true })
})

router.delete('/questions/:id', requireAdmin, (req, res) => {
  Question.deletePublic(req.params.id)
  res.json({ success: true })
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
  if (!isDev(req)) return forbid(res, '仅 dev 可查看日志')
  const { keyword, start, end } = req.query
  const limit = Number(req.query.limit || 50)
  const offset = Number(req.query.offset || 0)
  const logs = AdminLog.list({ keyword, start, end, limit, offset })
  res.json(logs)
})

router.get('/feedback', requireAdmin, (req, res) => {
  if (!isDev(req)) return forbid(res, '仅 dev 可查看反馈')
  const limit = Number(req.query.limit || 100)
  const offset = Number(req.query.offset || 0)
  const items = Feedback.findAll(limit, offset)
  const total = Feedback.countAll()
  res.json({ feedbackList: items, total })
})

router.get('/feedback/:id', requireAdmin, (req, res) => {
  if (!isDev(req)) return forbid(res, '仅 dev 可查看反馈')
  const item = Feedback.findById(req.params.id)
  if (!item) return res.status(404).json({ error: '记录不存在' })
  res.json(item)
})

router.patch('/feedback/:id', requireAdmin, (req, res) => {
  if (!isDev(req)) return forbid(res, '仅 dev 可处理反馈')
  const { status, admin_note } = req.body
  const item = Feedback.findById(req.params.id)
  if (!item) return res.status(404).json({ error: '记录不存在' })
  Feedback.updateStatus(req.params.id, status || item.status, admin_note ?? item.admin_note)
  res.json({ success: true })
})

router.delete('/feedback/:id', requireAdmin, (req, res) => {
  if (!isDev(req)) return forbid(res, '仅 dev 可删除反馈')
  Feedback.delete(req.params.id)
  res.json({ success: true })
})

// 题目反馈（管理员查看/删除）
router.get('/question-feedback', requireAdmin, (req, res) => {
  if (!isDev(req)) return forbid(res, '仅 dev 可查看题目反馈')
  const limit = Number(req.query.limit || 100)
  const offset = Number(req.query.offset || 0)
  const items = QuestionFeedback.findAll(limit, offset)
  const total = items ? items.length : 0
  res.json({ feedbackList: items, total })
})

router.get('/question-feedback/:id', requireAdmin, (req, res) => {
  if (!isDev(req)) return forbid(res, '仅 dev 可查看题目反馈')
  const item = QuestionFeedback.findById(req.params.id)
  if (!item) return res.status(404).json({ error: '记录不存在' })
  res.json(item)
})

router.delete('/question-feedback/:id', requireAdmin, (req, res) => {
  if (!isDev(req)) return forbid(res, '仅 dev 可删除题目反馈')
  QuestionFeedback.delete(req.params.id)
  res.json({ success: true })
})

module.exports = router
