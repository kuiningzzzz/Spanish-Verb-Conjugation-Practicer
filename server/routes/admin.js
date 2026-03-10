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
const Announcement = require('../models/Announcement')
const { vocabularyDb } = require('../database/db')
const VerbAutoFillService = require('../services/verbAutoFillService')
const { exportVerbsAsJson } = require('../services/verbExportService')
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
const ALLOWED_USER_TYPES = ['student', 'public', 'teacher']
const COURSE_MATERIAL_MOOD_OPTIONS = [
  { value: 'indicativo', label: 'Indicativo 陈述式' },
  { value: 'subjuntivo', label: 'Subjuntivo 虚拟式' },
  { value: 'condicional', label: 'Condicional 条件式' },
  { value: 'imperativo', label: 'Imperativo 命令式' }
]
const COURSE_MATERIAL_TENSE_OPTIONS = [
  { value: 'presente', label: 'Presente（陈述式 一般现在时）', mood: 'indicativo' },
  { value: 'perfecto', label: 'Pretérito Perfecto（陈述式 现在完成时）', mood: 'indicativo' },
  { value: 'imperfecto', label: 'Pretérito Imperfecto（陈述式 过去未完成时）', mood: 'indicativo' },
  { value: 'preterito', label: 'Pretérito Indefinido（陈述式 简单过去时）', mood: 'indicativo' },
  { value: 'futuro', label: 'Futuro Imperfecto（陈述式 将来未完成时）', mood: 'indicativo' },
  { value: 'pluscuamperfecto', label: 'Pretérito Pluscuamperfecto（陈述式 过去完成时）', mood: 'indicativo' },
  { value: 'futuro_perfecto', label: 'Futuro Perfecto（陈述式 将来完成时）', mood: 'indicativo' },
  { value: 'preterito_anterior', label: 'Pretérito Anterior（陈述式 前过去时）', mood: 'indicativo' },
  { value: 'subjuntivo_presente', label: 'Presente（虚拟式 现在时）', mood: 'subjuntivo' },
  { value: 'subjuntivo_imperfecto', label: 'Pretérito Imperfecto（虚拟式 过去未完成时）', mood: 'subjuntivo' },
  { value: 'subjuntivo_perfecto', label: 'Pretérito Perfecto（虚拟式 现在完成时）', mood: 'subjuntivo' },
  { value: 'subjuntivo_pluscuamperfecto', label: 'Pretérito Pluscuamperfecto（虚拟式 过去完成时）', mood: 'subjuntivo' },
  { value: 'subjuntivo_futuro', label: 'Futuro（虚拟式 将来未完成时）', mood: 'subjuntivo' },
  { value: 'subjuntivo_futuro_perfecto', label: 'Futuro Perfecto（虚拟式 将来完成时）', mood: 'subjuntivo' },
  { value: 'condicional', label: 'Condicional Simple（简单条件式）', mood: 'condicional' },
  { value: 'condicional_perfecto', label: 'Condicional Compuesto（复合条件式）', mood: 'condicional' },
  { value: 'imperativo_afirmativo', label: 'Imperativo（命令式）', mood: 'imperativo' },
  { value: 'imperativo_negativo', label: 'Imperativo Negativo（否定命令式）', mood: 'imperativo' }
]
const COURSE_SECOND_CLASS_TENSE_KEYS = [
  'pluscuamperfecto',
  'futuro_perfecto',
  'condicional_perfecto',
  'subjuntivo_imperfecto',
  'subjuntivo_perfecto'
]
const COURSE_THIRD_CLASS_TENSE_KEYS = [
  'preterito_anterior',
  'subjuntivo_futuro',
  'subjuntivo_pluscuamperfecto',
  'subjuntivo_futuro_perfecto'
]
const COURSE_ALL_TENSE_KEYS = COURSE_MATERIAL_TENSE_OPTIONS.map((item) => item.value)
const COURSE_DEFAULT_TENSE_KEYS = COURSE_ALL_TENSE_KEYS.filter(
  (value) => !COURSE_SECOND_CLASS_TENSE_KEYS.includes(value) && !COURSE_THIRD_CLASS_TENSE_KEYS.includes(value)
)
const COURSE_DEFAULT_CONJUGATION_TYPES = ['ar', 'er', 'ir']
const COURSE_TENSE_TO_MOOD = COURSE_MATERIAL_TENSE_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item.mood
  return acc
}, {})

function parseJsonArray(rawValue) {
  if (!rawValue) return []
  if (Array.isArray(rawValue)) return rawValue
  try {
    const parsed = JSON.parse(rawValue)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    return []
  }
}

function normalizeStringArray(values) {
  if (!Array.isArray(values)) return []
  return Array.from(
    new Set(
      values
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    )
  )
}

function normalizeCourseTenses(values, fallbackValues = []) {
  const fallback = Array.isArray(fallbackValues) ? fallbackValues : []
  const source = Array.isArray(values) ? values : fallback
  const normalized = normalizeStringArray(source)
  return normalized.filter((item) => COURSE_ALL_TENSE_KEYS.includes(item))
}

function getCourseMoodsFromTenses(tenses) {
  const moods = new Set()
  normalizeStringArray(tenses).forEach((tense) => {
    const mood = COURSE_TENSE_TO_MOOD[tense]
    if (mood) {
      moods.add(mood)
    }
  })
  return Array.from(moods)
}

function touchCourseTextbook(textbookId) {
  if (!textbookId) return
  vocabularyDb.prepare(`
    UPDATE textbooks
    SET updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(textbookId)
}

function serializeCourseLesson(row) {
  const parsedTenses = normalizeCourseTenses(parseJsonArray(row.tenses), [])
  return {
    id: row.id,
    textbook_id: row.textbook_id,
    title: row.title || '',
    lesson_number: Number(row.lesson_number || 0),
    vocabulary_count: Number(row.vocabulary_count || 0),
    tense_count: parsedTenses.length,
    tenses: parsedTenses,
    moods: normalizeStringArray(parseJsonArray(row.moods)),
    updated_at: row.updated_at || row.created_at || null,
    created_at: row.created_at || null
  }
}

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
      user_type: user.user_type,
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
  if (!isDev(req) && role === 'dev') {
    return res.json({ rows: [], total: 0 })
  }

  const result = role
    ? listUsers(role, { limit, offset })
    : listAllUsers({
      limit,
      offset,
      excludeRoles: isDev(req) ? [] : ['dev']
    })

  res.json(result)
})

router.post('/users', requireAdmin, (req, res) => {
  if (!isDev(req)) {
    return forbid(res, '仅 dev 可以创建用户')
  }
  const { username, email, password, role = 'user', user_type = 'student' } = req.body
  if (!username || !password) {
    return res.status(400).json({ error: '缺少必要字段' })
  }
  if (!['user', 'admin', 'dev'].includes(role)) {
    return res.status(400).json({ error: '非法角色' })
  }
  if (!ALLOWED_USER_TYPES.includes(user_type)) {
    return res.status(400).json({ error: '非法用户类型' })
  }
  const id = createUser({ username, email, password, role, user_type })
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

  if (req.body.user_type !== undefined && !ALLOWED_USER_TYPES.includes(String(req.body.user_type))) {
    return res.status(400).json({ error: '非法用户类型' })
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

// 公告管理路由
router.get('/announcements', requireAdmin, (req, res) => {
  if (!isDev(req)) {
    return forbid(res, '仅 dev 可以管理公告')
  }
  try {
    const announcements = Announcement.getAll()
    const sorted = Announcement.sortByPriority(announcements)
    res.json({
      success: true,
      data: sorted
    })
  } catch (error) {
    console.error('获取公告列表失败:', error)
    res.status(500).json({
      success: false,
      error: '获取公告列表失败'
    })
  }
})

router.get('/announcements/:id', requireAdmin, (req, res) => {
  if (!isDev(req)) {
    return forbid(res, '仅 dev 可以管理公告')
  }
  try {
    const { id } = req.params
    const announcement = Announcement.getById(id)
    if (!announcement) {
      return res.status(404).json({
        success: false,
        error: '公告不存在'
      })
    }
    res.json({
      success: true,
      data: announcement
    })
  } catch (error) {
    console.error('获取公告详情失败:', error)
    res.status(500).json({
      success: false,
      error: '获取公告详情失败'
    })
  }
})

router.post('/announcements', requireAdmin, (req, res) => {
  if (!isDev(req)) {
    return forbid(res, '仅 dev 可以管理公告')
  }
  try {
    const { title, content, priority, publisher, publishTime, isActive } = req.body
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: '标题和内容不能为空'
      })
    }
    const announcementData = {
      title,
      content,
      priority,
      publisher: publisher || req.admin.username,
      publishTime,
      isActive
    }
    const newAnnouncement = Announcement.create(announcementData)
    res.status(201).json({
      success: true,
      data: newAnnouncement,
      message: '公告创建成功'
    })
  } catch (error) {
    console.error('创建公告失败:', error)
    res.status(500).json({
      success: false,
      error: '创建公告失败'
    })
  }
})

router.put('/announcements/:id', requireAdmin, (req, res) => {
  if (!isDev(req)) {
    return forbid(res, '仅 dev 可以管理公告')
  }
  try {
    const { id } = req.params
    const { title, content, priority, publisher, publishTime, isActive } = req.body
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: '标题和内容不能为空'
      })
    }
    const updateData = {
      title,
      content,
      priority,
      publisher,
      publishTime,
      isActive
    }
    const updated = Announcement.update(id, updateData)
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: '公告不存在'
      })
    }
    res.json({
      success: true,
      data: updated,
      message: '公告更新成功'
    })
  } catch (error) {
    console.error('更新公告失败:', error)
    res.status(500).json({
      success: false,
      error: '更新公告失败'
    })
  }
})

router.delete('/announcements/:id', requireAdmin, (req, res) => {
  if (!isDev(req)) {
    return forbid(res, '仅 dev 可以管理公告')
  }
  try {
    const { id } = req.params
    const deleted = Announcement.delete(id)
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: '公告不存在'
      })
    }
    res.json({
      success: true,
      message: '公告删除成功'
    })
  } catch (error) {
    console.error('删除公告失败:', error)
    res.status(500).json({
      success: false,
      error: '删除公告失败'
    })
  }
})

router.get('/course-materials/options', requireAdmin, (req, res) => {
  res.json({
    moods: COURSE_MATERIAL_MOOD_OPTIONS,
    tenses: COURSE_MATERIAL_TENSE_OPTIONS,
    defaults: {
      selectedTenses: COURSE_DEFAULT_TENSE_KEYS,
      secondClassTenseKeys: COURSE_SECOND_CLASS_TENSE_KEYS,
      thirdClassTenseKeys: COURSE_THIRD_CLASS_TENSE_KEYS
    }
  })
})

router.get('/course-materials/textbooks', requireAdmin, (req, res) => {
  const rows = vocabularyDb.prepare(`
    SELECT
      t.*,
      COUNT(l.id) AS lesson_count
    FROM textbooks t
    LEFT JOIN lessons l ON l.textbook_id = t.id
    GROUP BY t.id
    ORDER BY datetime(COALESCE(t.updated_at, t.created_at)) DESC, t.id DESC
  `).all()

  res.json({
    rows: rows.map((item) => ({
      ...item,
      lesson_count: Number(item.lesson_count || 0),
      is_published: Number(item.is_published) === 1,
      updated_at: item.updated_at || item.created_at || null
    }))
  })
})

router.post('/course-materials/textbooks', requireAdmin, (req, res) => {
  const name = String(req.body?.name || '').trim()
  if (!name) {
    return res.status(400).json({ error: '教材名称不能为空' })
  }

  const requestedOrderIndex = Number(req.body?.orderIndex)
  const nextOrderRow = vocabularyDb.prepare('SELECT COALESCE(MAX(order_index), 0) + 1 AS next_order FROM textbooks').get()
  const orderIndex = Number.isFinite(requestedOrderIndex) ? requestedOrderIndex : Number(nextOrderRow?.next_order || 1)

  const result = vocabularyDb.prepare(`
    INSERT INTO textbooks (name, description, cover_image, is_published, order_index, created_at, updated_at)
    VALUES (?, NULL, NULL, 0, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
  `).run(name, orderIndex)

  const row = vocabularyDb.prepare('SELECT * FROM textbooks WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({
    row: {
      ...row,
      lesson_count: 0,
      is_published: Number(row.is_published) === 1,
      updated_at: row.updated_at || row.created_at || null
    }
  })
})

router.put('/course-materials/textbooks/:id/publish', requireAdmin, (req, res) => {
  const textbookId = Number(req.params.id)
  if (!textbookId || Number.isNaN(textbookId)) {
    return res.status(400).json({ error: '教材ID不合法' })
  }

  if (req.body?.isPublished === undefined) {
    return res.status(400).json({ error: '缺少发布状态' })
  }

  const textbook = vocabularyDb.prepare('SELECT * FROM textbooks WHERE id = ?').get(textbookId)
  if (!textbook) {
    return res.status(404).json({ error: '教材不存在' })
  }

  const isPublished = req.body.isPublished ? 1 : 0
  vocabularyDb.prepare(`
    UPDATE textbooks
    SET is_published = ?, updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(isPublished, textbookId)

  const updated = vocabularyDb.prepare(`
    SELECT
      t.*,
      COUNT(l.id) AS lesson_count
    FROM textbooks t
    LEFT JOIN lessons l ON l.textbook_id = t.id
    WHERE t.id = ?
    GROUP BY t.id
  `).get(textbookId)
  res.json({
    success: true,
    row: {
      ...updated,
      lesson_count: Number(updated.lesson_count || 0),
      is_published: Number(updated.is_published) === 1,
      updated_at: updated.updated_at || updated.created_at || null
    }
  })
})

router.delete('/course-materials/textbooks/:id', requireAdmin, (req, res) => {
  const textbookId = Number(req.params.id)
  if (!textbookId || Number.isNaN(textbookId)) {
    return res.status(400).json({ error: '教材ID不合法' })
  }

  const textbook = vocabularyDb.prepare('SELECT * FROM textbooks WHERE id = ?').get(textbookId)
  if (!textbook) {
    return res.status(404).json({ error: '教材不存在' })
  }

  vocabularyDb.prepare('DELETE FROM textbooks WHERE id = ?').run(textbookId)
  res.json({ success: true })
})

router.get('/course-materials/textbooks/:id/lessons', requireAdmin, (req, res) => {
  const textbookId = Number(req.params.id)
  if (!textbookId || Number.isNaN(textbookId)) {
    return res.status(400).json({ error: '教材ID不合法' })
  }

  const textbook = vocabularyDb.prepare('SELECT * FROM textbooks WHERE id = ?').get(textbookId)
  if (!textbook) {
    return res.status(404).json({ error: '教材不存在' })
  }

  const rows = vocabularyDb.prepare(`
    SELECT
      l.*,
      COALESCE(v.word_count, 0) AS vocabulary_count
    FROM lessons l
    LEFT JOIN (
      SELECT lesson_id, COUNT(*) AS word_count
      FROM lesson_verbs
      GROUP BY lesson_id
    ) v ON v.lesson_id = l.id
    WHERE l.textbook_id = ?
    ORDER BY l.lesson_number ASC, l.id ASC
  `).all(textbookId)

  res.json({
    textbook: {
      id: textbook.id,
      name: textbook.name,
      is_published: Number(textbook.is_published) === 1,
      updated_at: textbook.updated_at || textbook.created_at || null
    },
    rows: rows.map((row) => serializeCourseLesson(row))
  })
})

router.post('/course-materials/textbooks/:id/lessons', requireAdmin, (req, res) => {
  const textbookId = Number(req.params.id)
  if (!textbookId || Number.isNaN(textbookId)) {
    return res.status(400).json({ error: '教材ID不合法' })
  }

  const textbook = vocabularyDb.prepare('SELECT * FROM textbooks WHERE id = ?').get(textbookId)
  if (!textbook) {
    return res.status(404).json({ error: '教材不存在' })
  }

  const maxNumberRow = vocabularyDb.prepare(`
    SELECT COALESCE(MAX(lesson_number), 0) AS max_number
    FROM lessons
    WHERE textbook_id = ?
  `).get(textbookId)

  const nextLessonNumber = Number(maxNumberRow?.max_number || 0) + 1
  const title = `第${nextLessonNumber}课`
  const defaultTenses = [...COURSE_DEFAULT_TENSE_KEYS]
  const defaultMoods = getCourseMoodsFromTenses(defaultTenses)

  const result = vocabularyDb.prepare(`
    INSERT INTO lessons (
      textbook_id, title, lesson_number, description, grammar_points, moods, tenses, conjugation_types, created_at, updated_at
    )
    VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
  `).run(
    textbookId,
    title,
    nextLessonNumber,
    JSON.stringify(defaultMoods),
    JSON.stringify(defaultTenses),
    JSON.stringify(COURSE_DEFAULT_CONJUGATION_TYPES)
  )

  touchCourseTextbook(textbookId)

  const row = vocabularyDb.prepare(`
    SELECT
      l.*,
      0 AS vocabulary_count
    FROM lessons l
    WHERE l.id = ?
  `).get(result.lastInsertRowid)

  res.status(201).json({
    row: serializeCourseLesson(row)
  })
})

router.put('/course-materials/lessons/:id', requireAdmin, (req, res) => {
  const lessonId = Number(req.params.id)
  if (!lessonId || Number.isNaN(lessonId)) {
    return res.status(400).json({ error: '课程ID不合法' })
  }

  const lesson = vocabularyDb.prepare('SELECT * FROM lessons WHERE id = ?').get(lessonId)
  if (!lesson) {
    return res.status(404).json({ error: '课程不存在' })
  }

  const payload = req.body || {}
  const hasTitle = Object.prototype.hasOwnProperty.call(payload, 'title')
  const hasTenses = Object.prototype.hasOwnProperty.call(payload, 'tenses')
  if (!hasTitle && !hasTenses) {
    return res.status(400).json({ error: '缺少可更新字段' })
  }

  const nextTitle = hasTitle ? String(payload.title || '').trim() : String(lesson.title || '').trim()
  if (!nextTitle) {
    return res.status(400).json({ error: '课程名称不能为空' })
  }

  const existingTenses = normalizeCourseTenses(parseJsonArray(lesson.tenses), [])
  const nextTenses = hasTenses ? normalizeCourseTenses(payload.tenses, []) : existingTenses
  const nextMoods = getCourseMoodsFromTenses(nextTenses)

  const existingConjugationTypes = normalizeStringArray(parseJsonArray(lesson.conjugation_types))
  const conjugationTypes = existingConjugationTypes.length > 0
    ? existingConjugationTypes
    : [...COURSE_DEFAULT_CONJUGATION_TYPES]

  vocabularyDb.prepare(`
    UPDATE lessons
    SET
      title = ?,
      moods = ?,
      tenses = ?,
      conjugation_types = ?,
      updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(
    nextTitle,
    JSON.stringify(nextMoods),
    JSON.stringify(nextTenses),
    JSON.stringify(conjugationTypes),
    lessonId
  )

  touchCourseTextbook(lesson.textbook_id)

  const row = vocabularyDb.prepare(`
    SELECT
      l.*,
      COALESCE(v.word_count, 0) AS vocabulary_count
    FROM lessons l
    LEFT JOIN (
      SELECT lesson_id, COUNT(*) AS word_count
      FROM lesson_verbs
      GROUP BY lesson_id
    ) v ON v.lesson_id = l.id
    WHERE l.id = ?
  `).get(lessonId)

  res.json({
    success: true,
    row: serializeCourseLesson(row)
  })
})

router.delete('/course-materials/lessons/:id', requireAdmin, (req, res) => {
  const lessonId = Number(req.params.id)
  if (!lessonId || Number.isNaN(lessonId)) {
    return res.status(400).json({ error: '课程ID不合法' })
  }

  const lesson = vocabularyDb.prepare('SELECT * FROM lessons WHERE id = ?').get(lessonId)
  if (!lesson) {
    return res.status(404).json({ error: '课程不存在' })
  }

  vocabularyDb.prepare('DELETE FROM lessons WHERE id = ?').run(lessonId)
  touchCourseTextbook(lesson.textbook_id)
  res.json({ success: true })
})

router.get('/course-materials/lessons/:id/verbs', requireAdmin, (req, res) => {
  const lessonId = Number(req.params.id)
  if (!lessonId || Number.isNaN(lessonId)) {
    return res.status(400).json({ error: '课程ID不合法' })
  }

  const lesson = vocabularyDb.prepare('SELECT * FROM lessons WHERE id = ?').get(lessonId)
  if (!lesson) {
    return res.status(404).json({ error: '课程不存在' })
  }

  const rows = vocabularyDb.prepare(`
    SELECT
      v.id,
      v.infinitive,
      v.meaning,
      v.conjugation_type,
      v.is_irregular,
      v.is_reflexive,
      lv.order_index
    FROM lesson_verbs lv
    INNER JOIN verbs v ON v.id = lv.verb_id
    WHERE lv.lesson_id = ?
    ORDER BY lv.order_index ASC, lv.id ASC
  `).all(lessonId)

  res.json({ rows })
})

router.put('/course-materials/lessons/:id/verbs', requireAdmin, (req, res) => {
  const lessonId = Number(req.params.id)
  if (!lessonId || Number.isNaN(lessonId)) {
    return res.status(400).json({ error: '课程ID不合法' })
  }

  const lesson = vocabularyDb.prepare('SELECT * FROM lessons WHERE id = ?').get(lessonId)
  if (!lesson) {
    return res.status(404).json({ error: '课程不存在' })
  }

  const payloadVerbIds = req.body?.verbIds
  if (!Array.isArray(payloadVerbIds)) {
    return res.status(400).json({ error: 'verbIds 必须为数组' })
  }

  const hasInvalidId = payloadVerbIds.some((item) => {
    const value = Number(item)
    return !Number.isInteger(value) || value <= 0
  })
  if (hasInvalidId) {
    return res.status(400).json({ error: 'verbIds 包含非法ID' })
  }

  const normalizedVerbIds = Array.from(new Set(payloadVerbIds.map((item) => Number(item))))

  if (normalizedVerbIds.length > 0) {
    const placeholders = normalizedVerbIds.map(() => '?').join(',')
    const existingIds = vocabularyDb.prepare(`
      SELECT id FROM verbs WHERE id IN (${placeholders})
    `).all(...normalizedVerbIds).map((item) => Number(item.id))
    if (existingIds.length !== normalizedVerbIds.length) {
      const existingSet = new Set(existingIds)
      const missing = normalizedVerbIds.filter((item) => !existingSet.has(item))
      return res.status(400).json({ error: `以下动词不存在：${missing.join(', ')}` })
    }
  }

  const syncLessonVerbs = vocabularyDb.transaction((targetLessonId, verbIds) => {
    vocabularyDb.prepare('DELETE FROM lesson_verbs WHERE lesson_id = ?').run(targetLessonId)
    if (verbIds.length > 0) {
      const insertStmt = vocabularyDb.prepare(`
        INSERT INTO lesson_verbs (lesson_id, verb_id, order_index)
        VALUES (?, ?, ?)
      `)
      verbIds.forEach((verbId, index) => {
        insertStmt.run(targetLessonId, verbId, index)
      })
    }
    vocabularyDb.prepare(`
      UPDATE lessons
      SET updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(targetLessonId)
  })
  syncLessonVerbs(lessonId, normalizedVerbIds)

  touchCourseTextbook(lesson.textbook_id)
  res.json({ success: true, count: normalizedVerbIds.length })
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
  const idOrder = String(req.query.id_order || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC'
  if (q) {
    const qLower = q.toLowerCase()
    const like = `%${qLower}%`
    const rows = vocabularyDb.prepare(`
      SELECT *
      FROM verbs
      WHERE lower(infinitive) LIKE ? OR lower(meaning) LIKE ?
      ORDER BY CAST(id AS INTEGER) ${idOrder}
      LIMIT ? OFFSET ?
    `).all(like, like, limit, offset)

    const total = vocabularyDb.prepare('SELECT COUNT(*) as total FROM verbs WHERE lower(infinitive) LIKE ? OR lower(meaning) LIKE ?').get(like, like).total
    res.json({ rows, total })
    return
  }

  const rows = vocabularyDb.prepare(`SELECT * FROM verbs ORDER BY CAST(id AS INTEGER) ${idOrder} LIMIT ? OFFSET ?`).all(limit, offset)
  const total = vocabularyDb.prepare('SELECT COUNT(*) as total FROM verbs').get().total
  res.json({ rows, total })
})

router.post('/verbs/autofill/validate', requireAdmin, async (req, res) => {
  const infinitive = String(req.body?.infinitive || '').trim()
  if (!infinitive) {
    return res.status(400).json({ error: '缺少动词原形 (infinitive)' })
  }

  try {
    const result = await VerbAutoFillService.validateInfinitive(infinitive)
    return res.json({ isValid: !!result.isValid, reason: result.reason || '' })
  } catch (error) {
    console.error('自动补充合法性校验失败:', error)
    return res.status(500).json({ error: '合法性校验失败' })
  }
})

router.post('/verbs/autofill', requireAdmin, async (req, res) => {
  const infinitive = String(req.body?.infinitive || '').trim()
  if (!infinitive) {
    return res.status(400).json({ error: '缺少动词原形 (infinitive)' })
  }

  try {
    const generated = await VerbAutoFillService.generateAutofill(infinitive)
    return res.json(generated)
  } catch (error) {
    console.error('自动补充生成失败:', error)
    return res.status(500).json({ error: '自动补充失败' })
  }
})

router.get('/verbs/export/json', requireAdmin, (req, res) => {
  if (!isDev(req)) return forbid(res, '仅 dev 可下载词库 JSON')

  try {
    const payload = exportVerbsAsJson()
    return res.json(payload)
  } catch (error) {
    console.error('导出词库 JSON 失败:', error)
    return res.status(500).json({ error: '导出词库 JSON 失败' })
  }
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
  const conjugations = Array.isArray(data.conjugations) ? data.conjugations : []
  const createVerbWithConjugations = vocabularyDb.transaction((payload, rows) => {
    const verbId = VerbAdmin.create({
      infinitive: payload.infinitive,
      meaning: payload.meaning || null,
      conjugationType: payload.conjugation_type || payload.conjugationType || 1,
      isIrregular: payload.is_irregular || payload.isIrregular || 0,
      isReflexive: payload.is_reflexive || payload.isReflexive || 0,
      hasTrUse: payload.has_tr_use ?? payload.hasTrUse ?? 0,
      hasIntrUse: payload.has_intr_use ?? payload.hasIntrUse ?? 0,
      supportsDo: payload.supports_do ?? payload.supportsDo ?? null,
      supportsIo: payload.supports_io ?? payload.supportsIo ?? null,
      supportsDoIo: payload.supports_do_io ?? payload.supportsDoIo ?? null,
      gerund: payload.gerund || null,
      participle: payload.participle || null,
      participleForms: payload.participle_forms || null,
      lessonNumber: payload.lesson_number || null,
      textbookVolume: payload.textbook_volume || 1,
      frequencyLevel: payload.frequency_level || 1
    })

    if (rows.length) {
      const insertStmt = vocabularyDb.prepare(`
        INSERT INTO conjugations (verb_id, tense, mood, person, conjugated_form, is_irregular)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      rows.forEach((item, index) => {
        const tense = String(item?.tense || '').trim()
        const mood = String(item?.mood || '').trim()
        const person = String(item?.person || '').trim()
        const conjugatedForm = String(item?.conjugated_form || '').trim()
        if (!tense || !mood || !person || !conjugatedForm) {
          const error = new Error(`第 ${index + 1} 条变位缺少必填字段`)
          error.status = 400
          throw error
        }
        insertStmt.run(verbId, tense, mood, person, conjugatedForm, item?.is_irregular ? 1 : 0)
      })
    }
    return verbId
  })

  try {
    const id = createVerbWithConjugations(data, conjugations)
    res.status(201).json({ id })
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ error: error.message || '变位数据不完整' })
    }
    console.error('创建动词失败:', error)
    return res.status(500).json({ error: '创建失败' })
  }
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
      has_tr_use = ?,
      has_intr_use = ?,
      supports_do = ?,
      supports_io = ?,
      supports_do_io = ?,
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
    data.has_tr_use ?? data.hasTrUse ?? existing.has_tr_use,
    data.has_intr_use ?? data.hasIntrUse ?? existing.has_intr_use,
    data.supports_do ?? data.supportsDo ?? existing.supports_do,
    data.supports_io ?? data.supportsIo ?? existing.supports_io,
    data.supports_do_io ?? data.supportsDoIo ?? existing.supports_do_io,
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
  const questionBank = req.query.questionBank ? String(req.query.questionBank).trim() : ''
  res.json(Question.listPublic({ limit, offset, keyword, sortBy, sortOrder, questionBank }))
})

router.get('/questions/:id', requireAdmin, (req, res) => {
  const source = req.query.source ? String(req.query.source).trim() : null
  const item = Question.findPublicById(req.params.id, source)
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
  const source = req.body.public_question_source
    || (req.query.source ? String(req.query.source).trim() : null)
  const item = Question.findPublicById(req.params.id, source)
  if (!item) return res.status(404).json({ error: '记录不存在' })

  const targetSource = source || item.public_question_source
  const questionBank = req.body.question_bank || item.question_bank || 'traditional'

  const payload = {
    verb_id: Number(req.body.verb_id ?? item.verb_id),
    question_bank: questionBank,
    question_text: req.body.question_text ?? item.question_text,
    correct_answer: req.body.correct_answer ?? item.correct_answer,
    example_sentence: req.body.example_sentence ?? item.example_sentence,
    translation: req.body.translation ?? item.translation,
    hint: req.body.hint ?? item.hint,
    tense: req.body.tense ?? item.tense,
    mood: req.body.mood ?? item.mood,
    person: req.body.person ?? item.person,
    host_form: req.body.host_form ?? item.host_form,
    host_form_zh: req.body.host_form_zh ?? item.host_form_zh,
    pronoun_pattern: req.body.pronoun_pattern ?? item.pronoun_pattern,
    io_pronoun: req.body.io_pronoun ?? item.io_pronoun,
    do_pronoun: req.body.do_pronoun ?? item.do_pronoun,
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
  if (!payload.question_text || !payload.correct_answer) {
    return res.status(400).json({ error: '题干和答案不能为空' })
  }
  if (!payload.tense || !payload.mood || !payload.person) {
    return res.status(400).json({ error: '时态/语气/人称不能为空' })
  }
  if (payload.confidence_score < 0 || payload.confidence_score > 100) {
    return res.status(400).json({ error: '置信度需在 0-100 之间' })
  }

  if (questionBank === 'pronoun') {
    if (!payload.host_form || !payload.host_form_zh) {
      return res.status(400).json({ error: '带代词题目必须包含 host_form 与 host_form_zh' })
    }
  }

  Question.updatePublic(req.params.id, payload, targetSource)
  res.json({ success: true })
})

router.delete('/questions/:id', requireAdmin, (req, res) => {
  const source = req.query.source ? String(req.query.source).trim() : null
  Question.deletePublic(req.params.id, source)
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
  res.json({ url: `${baseUrl}/admin/db-backups/download?token=${token}`, token })
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
