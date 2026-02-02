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
const VerbAdmin = require('../models/Verb')
const Conjugation = require('../models/Conjugation')
const QuestionBank = require('../models/QuestionBank')
const Feedback = require('../models/Feedback')
const QuestionFeedback = require('../models/QuestionFeedback')
const AdminLog = require('../models/AdminLog')
const PracticeRecord = require('../models/PracticeRecord')
const { vocabularyDb } = require('../database/db')
const fs = require('fs')
const path = require('path')
const AdmZip = require('adm-zip')
const crypto = require('crypto')

const VERSION_FILE = path.join(__dirname, '..', 'src', 'version.json')
const UPDATE_DIR = path.join(__dirname, '..', 'src', 'updates')
const DATA_DIR = path.join(__dirname, '..', 'data')
const BACKUP_DIR = path.join(DATA_DIR, 'backups')
const BACKUP_RECORDS_FILE = path.join(DATA_DIR, 'backup_records.json')
const IMPORT_RECORDS_FILE = path.join(DATA_DIR, 'import_records.json')
const DOWNLOAD_TOKEN_TTL_MS = 5 * 60 * 1000
const downloadTokens = new Map()

function loadVersionInfo() {
  try {
    const content = fs.readFileSync(VERSION_FILE, 'utf8')
    return JSON.parse(content)
  } catch (error) {
    return { versions: [] }
  }
}

function saveVersionInfo(data) {
  fs.writeFileSync(VERSION_FILE, JSON.stringify(data, null, 2), 'utf8')
}

function getAllowedFiles() {
  const files = []
  try {
    const dbFiles = fs
      .readdirSync(DATA_DIR)
      .filter((name) => name.endsWith('.db'))
      .map((name) => ({
        key: `db:${name}`,
        label: name,
        fileName: name,
        path: path.join(DATA_DIR, name)
      }))
    files.push(...dbFiles)
  } catch (error) {
    // ignore
  }

  files.push({
    key: 'version.json',
    label: 'version.json',
    fileName: 'version.json',
    path: path.join(__dirname, '..', 'src', 'version.json')
  })
  files.push({
    key: 'announcement.json',
    label: 'announcement.json',
    fileName: 'announcement.json',
    path: path.join(__dirname, '..', 'src', 'announcement.json')
  })

  return files
}

function loadRecords(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const data = JSON.parse(content)
    return Array.isArray(data) ? data : []
  } catch (error) {
    return []
  }
}

function saveRecords(filePath, records) {
  fs.writeFileSync(filePath, JSON.stringify(records, null, 2), 'utf8')
}

function formatTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  )
}

function issueDownloadToken(recordId) {
  const token = crypto.randomBytes(24).toString('hex')
  downloadTokens.set(token, { recordId, expiresAt: Date.now() + DOWNLOAD_TOKEN_TTL_MS })
  return token
}

function consumeDownloadToken(token) {
  const data = downloadTokens.get(token)
  if (!data) return null
  downloadTokens.delete(token)
  if (data.expiresAt < Date.now()) return null
  return data
}

function buildBackupZipBuffer(record) {
  const targetDir = path.join(BACKUP_DIR, record.dirName || '')
  if (!fs.existsSync(targetDir)) {
    throw new Error('备份文件不存在')
  }
  const zip = new AdmZip()
  record.files.forEach((item) => {
    const filePath = path.join(targetDir, item.fileName)
    if (fs.existsSync(filePath)) {
      zip.addLocalFile(filePath)
    }
  })
  return zip.toBuffer()
}

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

router.get('/versions', requireAdmin, (req, res) => {
  if (!isDev(req)) {
    return forbid(res, '仅 dev 可以查看版本信息')
  }
  const data = loadVersionInfo()
  res.json({
    versions: Array.isArray(data.versions) ? data.versions : []
  })
})

router.post(
  '/version/upload',
  requireAdmin,
  (req, res, next) => {
    if (!isDev(req)) {
      return forbid(res, '仅 dev 可以上传版本文件')
    }
    next()
  },
  express.raw({ type: 'application/octet-stream', limit: '300mb' }),
  (req, res) => {
    try {
      const rawName = req.headers['x-file-name'] || 'app-release.apk'
      let fileName = rawName
      try {
        fileName = decodeURIComponent(rawName)
      } catch (error) {
        fileName = rawName
      }
      fileName = path.basename(fileName)
      if (!fileName) {
        return res.status(400).json({ error: '缺少文件名' })
      }
      if (!req.body || !req.body.length) {
        return res.status(400).json({ error: '文件内容为空' })
      }
      fs.mkdirSync(UPDATE_DIR, { recursive: true })
      const filePath = path.join(UPDATE_DIR, fileName)
      fs.writeFileSync(filePath, req.body)
      return res.json({ success: true, fileName, size: req.body.length })
    } catch (error) {
      console.error('上传版本文件失败:', error)
      return res.status(500).json({ error: '上传失败' })
    }
  }
)

router.post('/versions', requireAdmin, (req, res) => {
  if (!isDev(req)) {
    return forbid(res, '仅 dev 可以发布新版本')
  }
  const {
    versionName,
    description,
    forceUpdate,
    packageFileName,
    newFeatures,
    improvements,
    bugFixes
  } = req.body || {}

  if (!versionName || !description) {
    return res.status(400).json({ error: 'versionName 与 description 为必填项' })
  }
  if (forceUpdate === undefined) {
    return res.status(400).json({ error: 'forceUpdate 为必填项' })
  }
  if (!packageFileName) {
    return res.status(400).json({ error: '缺少安装包文件' })
  }

  const filePath = path.join(UPDATE_DIR, path.basename(packageFileName))
  if (!fs.existsSync(filePath)) {
    return res.status(400).json({ error: '安装包不存在，请先上传 apk 文件' })
  }

  const data = loadVersionInfo()
  const versions = Array.isArray(data.versions) ? data.versions : []
  const maxVersionCode = versions.reduce((max, item) => Math.max(max, Number(item.versionCode || 0)), 0)
  const releaseDate = new Date().toISOString().slice(0, 10)

  const newVersion = {
    versionCode: maxVersionCode + 1,
    versionName: String(versionName).trim(),
    releaseDate,
    description: String(description).trim(),
    newFeatures: Array.isArray(newFeatures) ? newFeatures.filter(Boolean) : [],
    improvements: Array.isArray(improvements) ? improvements.filter(Boolean) : [],
    bugFixes: Array.isArray(bugFixes) ? bugFixes.filter(Boolean) : [],
    packageFileName: path.basename(packageFileName),
    downloadUrl: '',
    forceUpdate: Boolean(forceUpdate)
  }

  const updated = [newVersion, ...versions]
  saveVersionInfo({ versions: updated })

  res.status(201).json({ success: true, version: newVersion })
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
  const item = VerbAdmin.findById(req.params.id)
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

router.get('/conjugations/options', requireAdmin, (req, res) => {
  res.json(Conjugation.getOptions())
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
  const id = VerbAdmin.create({
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
  const existing = VerbAdmin.findById(id)
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
  const verb = VerbAdmin.findById(verbId)
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

  const verb = VerbAdmin.findById(payload.verb_id)
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

router.get('/practice-records', requireAdmin, (req, res) => {
  if (!isDev(req)) return forbid(res, '仅 dev 可以查看用户数据')
  const limit = Number(req.query.limit || 50)
  const offset = Number(req.query.offset || 0)
  const keyword = req.query.keyword ? String(req.query.keyword).trim() : ''
  const userId = req.query.userId ? Number(req.query.userId) : null
  const verbId = req.query.verbId ? Number(req.query.verbId) : null
  const exerciseType = req.query.exerciseType ? String(req.query.exerciseType).trim() : ''
  const tense = req.query.tense ? String(req.query.tense).trim() : ''
  const mood = req.query.mood ? String(req.query.mood).trim() : ''
  const person = req.query.person ? String(req.query.person).trim() : ''
  const sortBy = req.query.sortBy ? String(req.query.sortBy).trim() : 'created_at'
  const sortOrder = req.query.sortOrder ? String(req.query.sortOrder).trim() : 'desc'
  const startDate = req.query.startDate ? String(req.query.startDate).trim() : ''
  const endDate = req.query.endDate ? String(req.query.endDate).trim() : ''

  let isCorrect
  if (req.query.isCorrect !== undefined && req.query.isCorrect !== '') {
    const raw = String(req.query.isCorrect).toLowerCase()
    if (raw === 'true' || raw === '1') {
      isCorrect = 1
    } else if (raw === 'false' || raw === '0') {
      isCorrect = 0
    }
  }

  const result = PracticeRecord.listAll({
    limit,
    offset,
    keyword,
    userId: userId || undefined,
    verbId: verbId || undefined,
    exerciseType: exerciseType || undefined,
    isCorrect,
    tense: tense || undefined,
    mood: mood || undefined,
    person: person || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    sortBy,
    sortOrder
  })
  res.json(result)
})

router.get('/practice-records/stats', requireAdmin, (req, res) => {
  if (!isDev(req)) return forbid(res, '仅 dev 可以查看用户数据')
  const keyword = req.query.keyword ? String(req.query.keyword).trim() : ''
  const userId = req.query.userId ? Number(req.query.userId) : null
  const verbId = req.query.verbId ? Number(req.query.verbId) : null
  const exerciseType = req.query.exerciseType ? String(req.query.exerciseType).trim() : ''
  const tense = req.query.tense ? String(req.query.tense).trim() : ''
  const mood = req.query.mood ? String(req.query.mood).trim() : ''
  const person = req.query.person ? String(req.query.person).trim() : ''
  const startDate = req.query.startDate ? String(req.query.startDate).trim() : ''
  const endDate = req.query.endDate ? String(req.query.endDate).trim() : ''
  const limit = Number(req.query.limit || 50)

  let isCorrect
  if (req.query.isCorrect !== undefined && req.query.isCorrect !== '') {
    const raw = String(req.query.isCorrect).toLowerCase()
    if (raw === 'true' || raw === '1') {
      isCorrect = 1
    } else if (raw === 'false' || raw === '0') {
      isCorrect = 0
    }
  }

  const result = PracticeRecord.getStats({
    keyword,
    userId: userId || undefined,
    verbId: verbId || undefined,
    exerciseType: exerciseType || undefined,
    isCorrect,
    tense: tense || undefined,
    mood: mood || undefined,
    person: person || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    limit
  })
  res.json(result)
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

router.get('/db-files', requireAdmin, (req, res) => {
  if (!isDev(req)) return forbid(res, '仅 dev 可查看可备份文件')
  const files = getAllowedFiles().map(({ key, label, fileName }) => ({
    key,
    label,
    fileName
  }))
  res.json({ files })
})

router.get('/db-backups', requireAdmin, (req, res) => {
  if (!isDev(req)) return forbid(res, '仅 dev 可查看备份记录')
  const records = loadRecords(BACKUP_RECORDS_FILE)
  res.json({ records })
})

router.post('/db-backups', requireAdmin, (req, res) => {
  if (!isDev(req)) return forbid(res, '仅 dev 可新增备份')
  const requestedKeys = Array.isArray(req.body?.files) ? req.body.files : []
  const allowedFiles = getAllowedFiles()
  const allowedMap = new Map(allowedFiles.map((item) => [item.key, item]))
  const selected = requestedKeys.length
    ? requestedKeys.map((key) => allowedMap.get(key)).filter(Boolean)
    : allowedFiles

  if (!selected.length) {
    return res.status(400).json({ error: '请选择需要备份的文件' })
  }

  const missing = selected.filter((item) => !fs.existsSync(item.path))
  if (missing.length) {
    return res.status(400).json({ error: `文件不存在：${missing.map((item) => item.fileName).join(', ')}` })
  }

  const timestamp = formatTimestamp()
  const id = String(Date.now())
  const dirName = `${timestamp.replace(/[^0-9]/g, '')}_${id}`
  const targetDir = path.join(BACKUP_DIR, dirName)
  fs.mkdirSync(targetDir, { recursive: true })

  selected.forEach((item) => {
    const targetPath = path.join(targetDir, item.fileName)
    fs.copyFileSync(item.path, targetPath)
  })

  const record = {
    id,
    createdAt: timestamp,
    files: selected.map(({ key, label, fileName }) => ({ key, label, fileName })),
    dirName
  }

  const records = loadRecords(BACKUP_RECORDS_FILE)
  records.unshift(record)
  saveRecords(BACKUP_RECORDS_FILE, records)

  res.status(201).json({ success: true, record })
})

router.delete('/db-backups/:id', requireAdmin, (req, res) => {
  if (!isDev(req)) return forbid(res, '仅 dev 可删除备份记录')
  const records = loadRecords(BACKUP_RECORDS_FILE)
  const index = records.findIndex((item) => item.id === req.params.id)
  if (index === -1) {
    return res.status(404).json({ error: '备份记录不存在' })
  }
  const [record] = records.splice(index, 1)
  saveRecords(BACKUP_RECORDS_FILE, records)
  if (record?.dirName) {
    const targetDir = path.join(BACKUP_DIR, record.dirName)
    fs.rmSync(targetDir, { recursive: true, force: true })
  }
  res.json({ success: true })
})

router.get('/db-backups/:id/download-link', requireAdmin, (req, res) => {
  if (!isDev(req)) return forbid(res, '仅 dev 可下载备份')
  const records = loadRecords(BACKUP_RECORDS_FILE)
  const record = records.find((item) => item.id === req.params.id)
  if (!record) {
    return res.status(404).json({ error: '备份记录不存在' })
  }
  const token = issueDownloadToken(record.id)
  const baseUrl = `${req.protocol}://${req.get('host')}`
  res.json({ url: `${baseUrl}/admin/db-backups/download?token=${token}` })
})

router.get('/db-backups/download', (req, res) => {
  const token = String(req.query.token || '')
  if (!token) {
    return res.status(401).json({ error: '未授权访问' })
  }
  const payload = consumeDownloadToken(token)
  if (!payload) {
    return res.status(401).json({ error: '下载链接已失效' })
  }
  const records = loadRecords(BACKUP_RECORDS_FILE)
  const record = records.find((item) => item.id === payload.recordId)
  if (!record) {
    return res.status(404).json({ error: '备份记录不存在' })
  }
  try {
    const buffer = buildBackupZipBuffer(record)
    const fileName = `backup_${record.createdAt.replace(/[:\\s]/g, '')}.zip`
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.setHeader('Content-Length', buffer.length)
    res.send(buffer)
  } catch (error) {
    res.status(404).json({ error: error.message || '备份文件不存在' })
  }
})

router.get('/db-backups/:id/download', requireAdmin, (req, res) => {
  if (!isDev(req)) return forbid(res, '仅 dev 可下载备份')
  const records = loadRecords(BACKUP_RECORDS_FILE)
  const record = records.find((item) => item.id === req.params.id)
  if (!record) {
    return res.status(404).json({ error: '备份记录不存在' })
  }
  let buffer = null
  try {
    buffer = buildBackupZipBuffer(record)
  } catch (error) {
    return res.status(404).json({ error: error.message || '备份文件不存在' })
  }
  const fileName = `backup_${record.createdAt.replace(/[:\s]/g, '')}.zip`
  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
  res.setHeader('Content-Length', buffer.length)
  res.send(buffer)
})

router.post('/db-backups/:id/restore', requireAdmin, (req, res) => {
  if (!isDev(req)) return forbid(res, '仅 dev 可还原备份')
  const records = loadRecords(BACKUP_RECORDS_FILE)
  const record = records.find((item) => item.id === req.params.id)
  if (!record) {
    return res.status(404).json({ error: '备份记录不存在' })
  }
  const targetDir = path.join(BACKUP_DIR, record.dirName || '')
  if (!fs.existsSync(targetDir)) {
    return res.status(404).json({ error: '备份文件不存在' })
  }
  const allowedMap = new Map(getAllowedFiles().map((item) => [item.key, item]))
  record.files.forEach((item) => {
    const definition = allowedMap.get(item.key)
    if (!definition) {
      return
    }
    const sourcePath = path.join(targetDir, item.fileName)
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, definition.path)
    }
  })
  res.json({ success: true })
})

router.get('/db-imports', requireAdmin, (req, res) => {
  if (!isDev(req)) return forbid(res, '仅 dev 可查看导入记录')
  const records = loadRecords(IMPORT_RECORDS_FILE)
  res.json({ records })
})

router.delete('/db-imports/:id', requireAdmin, (req, res) => {
  if (!isDev(req)) return forbid(res, '仅 dev 可删除导入记录')
  const records = loadRecords(IMPORT_RECORDS_FILE)
  const index = records.findIndex((item) => item.id === req.params.id)
  if (index === -1) {
    return res.status(404).json({ error: '导入记录不存在' })
  }
  records.splice(index, 1)
  saveRecords(IMPORT_RECORDS_FILE, records)
  res.json({ success: true })
})

router.post(
  '/db-imports',
  requireAdmin,
  (req, res, next) => {
    if (!isDev(req)) {
      return forbid(res, '仅 dev 可导入备份')
    }
    next()
  },
  express.raw({ type: 'application/zip', limit: '300mb' }),
  (req, res) => {
    try {
      if (!req.body || !req.body.length) {
        return res.status(400).json({ error: '上传内容为空' })
      }
      const allowedFiles = getAllowedFiles()
      const allowedByName = new Map(allowedFiles.map((item) => [item.fileName, item]))
      const zip = new AdmZip(req.body)
      const entries = zip.getEntries().filter((entry) => !entry.isDirectory)
      if (!entries.length) {
        return res.status(400).json({ error: '压缩包中没有可导入文件' })
      }

      const invalidEntry = entries.find((entry) => !allowedByName.has(path.basename(entry.entryName)))
      if (invalidEntry) {
        return res.status(400).json({ error: `不支持的文件：${invalidEntry.entryName}` })
      }

      const importedFiles = []
      entries.forEach((entry) => {
        const fileName = path.basename(entry.entryName)
        const definition = allowedByName.get(fileName)
        if (!definition) return
        const content = entry.getData()
        fs.writeFileSync(definition.path, content)
        importedFiles.push(fileName)
      })

      const record = {
        id: String(Date.now()),
        createdAt: formatTimestamp(),
        files: importedFiles
      }
      const records = loadRecords(IMPORT_RECORDS_FILE)
      records.unshift(record)
      saveRecords(IMPORT_RECORDS_FILE, records)

      res.status(201).json({ success: true, record })
    } catch (error) {
      console.error('导入失败:', error)
      res.status(500).json({ error: '导入失败' })
    }
  }
)

module.exports = router
