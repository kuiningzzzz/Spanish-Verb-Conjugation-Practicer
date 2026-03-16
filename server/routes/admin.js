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
const AdminHistory = require('../models/AdminHistory')
const PracticeRecord = require('../models/PracticeRecord')
const Announcement = require('../models/Announcement')
const { userDb, vocabularyDb, questionDb } = require('../database/db')
const VerbAutoFillService = require('../services/verbAutoFillService')
const ExerciseGeneratorService = require('../services/exerciseGenerator')
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
const ADMIN_AUTOFILL_INVALID_LIMIT = 10
const ADMIN_AUTOFILL_BATCH_TTL_MS = 30 * 60 * 1000
const ADMIN_AUTOFILL_BATCH_TTL_MINUTES = Math.max(1, Math.floor(ADMIN_AUTOFILL_BATCH_TTL_MS / 60000))
const ADMIN_AUTOFILL_REVOKED_CODE = 'ADMIN_AUTOFILL_REVOKED'
const ADMIN_AUTOFILL_REVOKED_MESSAGE = '您输入了过多非法动词，请联系超级管理员以恢复您的管理员权限。'
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
const COURSE_TENSE_TO_QUESTION_TENSE = ExerciseGeneratorService.getTenseMap()
const COURSE_LESSON_QUESTION_TARGET = 20
const COURSE_TEXTBOOK_COVERAGE_UNCHECKED = 'unchecked'
const COURSE_TEXTBOOK_COVERAGE_SUFFICIENT = 'sufficient'
const COURSE_TEXTBOOK_COVERAGE_INSUFFICIENT = 'insufficient'
const COURSE_TEXTBOOK_COVERAGE_RUNNING = 'running'
const COURSE_TEXTBOOK_SUPPLEMENT_TASK_RETENTION_MS = 15 * 60 * 1000
const courseTextbookCoverageTasks = new Map()
const courseLessonCoverageTasks = new Map()
const courseTextbookCoverageCache = new Map()
const courseLessonCoverageCache = new Map()

const USER_HISTORY_FIELDS = ['email', 'username', 'password', 'role', 'user_type']
const VERB_HISTORY_FIELDS = [
  'infinitive',
  'meaning',
  'conjugation_type',
  'is_irregular',
  'is_reflexive',
  'has_tr_use',
  'has_intr_use',
  'supports_do',
  'supports_io',
  'supports_do_io',
  'gerund',
  'participle',
  'participle_forms',
  'lesson_number',
  'textbook_volume',
  'frequency_level'
]
const CONJUGATION_HISTORY_FIELDS = ['verb_id', 'tense', 'mood', 'person', 'conjugated_form', 'is_irregular']
const QUESTION_TRADITIONAL_HISTORY_FIELDS = [
  'verb_id',
  'question_text',
  'correct_answer',
  'example_sentence',
  'translation',
  'hint',
  'tense',
  'mood',
  'person',
  'confidence_score'
]
const QUESTION_PRONOUN_HISTORY_FIELDS = [
  ...QUESTION_TRADITIONAL_HISTORY_FIELDS,
  'host_form',
  'host_form_zh',
  'pronoun_pattern',
  'io_pronoun',
  'do_pronoun'
]

function areSameHistoryValue(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
}

function buildHistoryDiff(beforeData = {}, afterData = {}, fields = []) {
  const changedFields = []
  const before = {}
  const after = {}

  fields.forEach((field) => {
    const beforeValue = beforeData?.[field] ?? null
    const afterValue = afterData?.[field] ?? null

    if (!areSameHistoryValue(beforeValue, afterValue)) {
      changedFields.push(field)
      before[field] = beforeValue
      after[field] = afterValue
    }
  })

  return {
    changedFields,
    beforeData: changedFields.length ? before : null,
    afterData: changedFields.length ? after : null
  }
}

function getHistoryActorFromRequest(req) {
  return {
    operator_username: String(req.admin?.username || 'unknown').trim() || 'unknown',
    operator_role: String(req.admin?.role || 'admin').trim() || 'admin'
  }
}

function recordHistorySafe(source, payload = {}) {
  try {
    AdminHistory.create(source, payload)
  } catch (error) {
    console.error('记录管理历史失败:', error)
  }
}

function recordHistoryFromRequest(req, source, payload = {}) {
  recordHistorySafe(source, {
    ...getHistoryActorFromRequest(req),
    ...payload
  })
}

function findRawUserById(userId) {
  return userDb.prepare('SELECT * FROM users WHERE id = ?').get(userId)
}

function findRawConjugationById(conjugationId) {
  return vocabularyDb.prepare('SELECT * FROM conjugations WHERE id = ?').get(conjugationId)
}

function buildVerbDeleteSnapshot(verbId) {
  const verb = VerbAdmin.findById(verbId)
  if (!verb) return null
  const conjugations = vocabularyDb.prepare(`
    SELECT *
    FROM conjugations
    WHERE verb_id = ?
    ORDER BY id ASC
  `).all(verbId)
  return {
    verb,
    conjugations
  }
}

function buildTextbookDeleteSnapshot(textbookId) {
  const textbook = findCourseTextbookById(textbookId)
  if (!textbook) return null

  const lessons = vocabularyDb.prepare(`
    SELECT *
    FROM lessons
    WHERE textbook_id = ?
    ORDER BY lesson_number ASC, id ASC
  `).all(textbookId)

  const lessonIds = lessons.map((lesson) => Number(lesson.id)).filter((id) => Number.isInteger(id) && id > 0)
  const verbIdMap = new Map()

  if (lessonIds.length > 0) {
    const placeholders = lessonIds.map(() => '?').join(',')
    const rows = vocabularyDb.prepare(`
      SELECT lesson_id, verb_id
      FROM lesson_verbs
      WHERE lesson_id IN (${placeholders})
      ORDER BY lesson_id ASC, order_index ASC, id ASC
    `).all(...lessonIds)

    rows.forEach((row) => {
      const lessonId = Number(row.lesson_id)
      if (!verbIdMap.has(lessonId)) {
        verbIdMap.set(lessonId, [])
      }
      verbIdMap.get(lessonId).push(Number(row.verb_id))
    })
  }

  return {
    textbook,
    lessons: lessons.map((lesson) => ({
      ...lesson,
      verb_ids: verbIdMap.get(Number(lesson.id)) || []
    }))
  }
}

function getQuestionHistoryTypeFromSource(source) {
  const normalized = String(source || '').trim().toLowerCase()
  return normalized === 'public_pronoun' || normalized === 'pronoun'
    ? 'question_pronoun'
    : 'question_traditional'
}

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

const COURSE_TEXTBOOK_PUBLISH_DRAFT = 'draft'
const COURSE_TEXTBOOK_PUBLISH_PENDING_REVIEW = 'pending_review'
const COURSE_TEXTBOOK_PUBLISH_PUBLISHED = 'published'

function normalizeCourseTextbookPublishStatus(status, isPublished = 0) {
  const normalized = String(status || '').trim()
  if ([
    COURSE_TEXTBOOK_PUBLISH_DRAFT,
    COURSE_TEXTBOOK_PUBLISH_PENDING_REVIEW,
    COURSE_TEXTBOOK_PUBLISH_PUBLISHED
  ].includes(normalized)) {
    return normalized
  }
  return Number(isPublished) === 1
    ? COURSE_TEXTBOOK_PUBLISH_PUBLISHED
    : COURSE_TEXTBOOK_PUBLISH_DRAFT
}

function saveCourseTextbookPublishStatus(textbookId, publishStatus) {
  const normalizedStatus = normalizeCourseTextbookPublishStatus(
    publishStatus,
    publishStatus === COURSE_TEXTBOOK_PUBLISH_PUBLISHED ? 1 : 0
  )
  const isPublished = normalizedStatus === COURSE_TEXTBOOK_PUBLISH_PUBLISHED ? 1 : 0
  vocabularyDb.prepare(`
    UPDATE textbooks
    SET is_published = ?, publish_status = ?, updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(isPublished, normalizedStatus, textbookId)
}

function findCourseTextbookById(textbookId) {
  return vocabularyDb.prepare('SELECT * FROM textbooks WHERE id = ?').get(textbookId)
}

function serializeCourseTextbook(row) {
  const publishStatus = normalizeCourseTextbookPublishStatus(row?.publish_status, row?.is_published)
  return {
    ...row,
    lesson_count: Number(row.lesson_count || 0),
    is_published: publishStatus === COURSE_TEXTBOOK_PUBLISH_PUBLISHED,
    publish_status: publishStatus,
    uploader_id: row?.uploader_id === null || row?.uploader_id === undefined
      ? null
      : Number(row.uploader_id),
    updated_at: row.updated_at || row.created_at || null
  }
}

function canManageCourseTextbook(req, textbook) {
  if (!textbook) return false
  if (isDev(req)) return true
  if (req.admin?.role !== 'admin') return false
  const uploaderId = Number(textbook.uploader_id || 0)
  const actorId = Number(req.admin?.id || 0)
  return uploaderId > 0 && actorId > 0 && uploaderId === actorId
}

function ensureCanManageCourseTextbook(req, res, textbook) {
  if (canManageCourseTextbook(req, textbook)) return true
  forbid(res, 'admin 仅可删改自己上传的教材')
  return false
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

function listCourseTextbooksWithLessonCount() {
  return vocabularyDb.prepare(`
    SELECT
      t.*,
      COUNT(l.id) AS lesson_count
    FROM textbooks t
    LEFT JOIN lessons l ON l.textbook_id = t.id
    GROUP BY t.id
    ORDER BY datetime(COALESCE(t.updated_at, t.created_at)) DESC, t.id DESC
  `).all()
}

function listCourseLessonsByTextbookIds(textbookIds = []) {
  const normalizedIds = Array.from(
    new Set(
      (Array.isArray(textbookIds) ? textbookIds : [])
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item > 0)
    )
  )
  if (!normalizedIds.length) return []

  const placeholders = normalizedIds.map(() => '?').join(',')
  return vocabularyDb.prepare(`
    SELECT
      l.*,
      COALESCE(v.word_count, 0) AS vocabulary_count
    FROM lessons l
    LEFT JOIN (
      SELECT lesson_id, COUNT(*) AS word_count
      FROM lesson_verbs
      GROUP BY lesson_id
    ) v ON v.lesson_id = l.id
    WHERE l.textbook_id IN (${placeholders})
    ORDER BY l.textbook_id ASC, l.lesson_number ASC, l.id ASC
  `).all(...normalizedIds)
}

function loadLessonVerbIdsMap(lessonIds = []) {
  const normalizedIds = Array.from(
    new Set(
      (Array.isArray(lessonIds) ? lessonIds : [])
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item > 0)
    )
  )
  const result = new Map()
  normalizedIds.forEach((id) => {
    result.set(id, [])
  })
  if (!normalizedIds.length) return result

  const placeholders = normalizedIds.map(() => '?').join(',')
  const rows = vocabularyDb.prepare(`
    SELECT lesson_id, verb_id
    FROM lesson_verbs
    WHERE lesson_id IN (${placeholders})
    ORDER BY lesson_id ASC, order_index ASC, id ASC
  `).all(...normalizedIds)

  rows.forEach((row) => {
    const lessonId = Number(row.lesson_id)
    const verbId = Number(row.verb_id)
    if (!result.has(lessonId)) {
      result.set(lessonId, [])
    }
    result.get(lessonId).push(verbId)
  })

  return result
}

function normalizeCourseQuestionTenses(values = []) {
  return Array.from(
    new Set(
      normalizeStringArray(values)
        .map((value) => ExerciseGeneratorService.normalizeTenseName(COURSE_TENSE_TO_QUESTION_TENSE[value] || ''))
        .filter(Boolean)
    )
  )
}

function buildTraditionalCoverageWhere({ verbIds = [], questionTenses = [] } = {}) {
  let where = 'WHERE 1 = 1'
  const params = []

  if (Array.isArray(verbIds) && verbIds.length > 0) {
    const placeholders = verbIds.map(() => '?').join(',')
    where += ` AND verb_id IN (${placeholders})`
    params.push(...verbIds)
  }

  if (Array.isArray(questionTenses) && questionTenses.length > 0) {
    const placeholders = questionTenses.map(() => '?').join(',')
    where += ` AND tense IN (${placeholders})`
    params.push(...questionTenses)
  }

  return { where, params }
}

function getTraditionalCoverageSnapshot({ verbIds = [], questionTenses = [] } = {}) {
  const normalizedVerbIds = Array.from(
    new Set(
      (Array.isArray(verbIds) ? verbIds : [])
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item > 0)
    )
  )
  const normalizedQuestionTenses = Array.from(new Set(normalizeStringArray(questionTenses)))

  if (!normalizedVerbIds.length && !normalizedQuestionTenses.length) {
    return {
      totalCount: 0,
      byVerb: new Map(),
      byTense: new Map()
    }
  }

  const { where, params } = buildTraditionalCoverageWhere({
    verbIds: normalizedVerbIds,
    questionTenses: normalizedQuestionTenses
  })

  const totalRow = questionDb.prepare(`
    SELECT COUNT(*) AS count
    FROM public_traditional_conjugation
    ${where}
  `).get(...params)

  const byVerb = new Map()
  const byTense = new Map()

  if (normalizedVerbIds.length) {
    const verbRows = questionDb.prepare(`
      SELECT verb_id, COUNT(*) AS count
      FROM public_traditional_conjugation
      ${where}
      GROUP BY verb_id
    `).all(...params)
    verbRows.forEach((row) => {
      byVerb.set(Number(row.verb_id), Number(row.count || 0))
    })
  }

  if (normalizedQuestionTenses.length) {
    const tenseRows = questionDb.prepare(`
      SELECT tense, COUNT(*) AS count
      FROM public_traditional_conjugation
      ${where}
      GROUP BY tense
    `).all(...params)
    tenseRows.forEach((row) => {
      byTense.set(String(row.tense || ''), Number(row.count || 0))
    })
  }

  return {
    totalCount: Number(totalRow?.count || 0),
    byVerb,
    byTense
  }
}

function buildCourseLessonCoverageSummary(lesson, verbIds = []) {
  const normalizedVerbIds = Array.from(
    new Set(
      (Array.isArray(verbIds) ? verbIds : [])
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item > 0)
    )
  )
  const questionTenses = normalizeCourseQuestionTenses(lesson?.tenses || [])
  const hasWords = normalizedVerbIds.length > 0
  const hasTenses = questionTenses.length > 0

  if (!hasWords && !hasTenses) {
    return {
      lessonId: Number(lesson?.id || 0),
      title: String(lesson?.title || ''),
      textbookId: Number(lesson?.textbook_id || 0),
      hasWords,
      hasTenses,
      isSufficient: false,
      isSupplementable: false,
      totalCount: 0,
      requiredNewCount: 0,
      wordStats: [],
      tenseStats: [],
      wordDeficits: [],
      tenseDeficits: [],
      verbIds: normalizedVerbIds,
      courseTenses: [],
      questionTenses: []
    }
  }

  const snapshot = getTraditionalCoverageSnapshot({
    verbIds: hasWords ? normalizedVerbIds : [],
    questionTenses: hasTenses ? questionTenses : []
  })

  const wordMinRequired = hasWords ? Math.ceil(COURSE_LESSON_QUESTION_TARGET / normalizedVerbIds.length) : 0
  const tenseMinRequired = hasTenses ? Math.ceil(COURSE_LESSON_QUESTION_TARGET / questionTenses.length) : 0

  const wordStats = hasWords
    ? normalizedVerbIds.map((verbId) => {
      const currentCount = Number(snapshot.byVerb.get(verbId) || 0)
      const deficit = Math.max(0, wordMinRequired - currentCount)
      return { verbId, currentCount, requiredCount: wordMinRequired, deficit }
    })
    : []

  const questionTenseByCourseTense = new Map()
  normalizeCourseTenses(lesson?.tenses || [], []).forEach((courseTense) => {
    const questionTense = ExerciseGeneratorService.normalizeTenseName(COURSE_TENSE_TO_QUESTION_TENSE[courseTense] || '')
    if (questionTense && !questionTenseByCourseTense.has(courseTense)) {
      questionTenseByCourseTense.set(courseTense, questionTense)
    }
  })

  const tenseStats = hasTenses
    ? Array.from(questionTenseByCourseTense.entries()).map(([courseTense, questionTense]) => {
      const currentCount = Number(snapshot.byTense.get(questionTense) || 0)
      const deficit = Math.max(0, tenseMinRequired - currentCount)
      return {
        courseTense,
        questionTense,
        currentCount,
        requiredCount: tenseMinRequired,
        deficit
      }
    })
    : []

  const wordDeficits = wordStats.filter((item) => item.deficit > 0)
  const tenseDeficits = tenseStats.filter((item) => item.deficit > 0)
  const totalGap = Math.max(0, COURSE_LESSON_QUESTION_TARGET - Number(snapshot.totalCount || 0))
  const wordGap = wordDeficits.reduce((sum, item) => sum + item.deficit, 0)
  const tenseGap = tenseDeficits.reduce((sum, item) => sum + item.deficit, 0)
  const requiredNewCount = Math.max(totalGap, wordGap, tenseGap)
  const isSufficient = wordDeficits.length === 0 && tenseDeficits.length === 0
  const isSupplementable = !isSufficient && hasWords && hasTenses && requiredNewCount > 0

  return {
    lessonId: Number(lesson?.id || 0),
    title: String(lesson?.title || ''),
    textbookId: Number(lesson?.textbook_id || 0),
    hasWords,
    hasTenses,
    isSufficient,
    isSupplementable,
    totalCount: Number(snapshot.totalCount || 0),
    requiredNewCount,
    wordStats,
    tenseStats,
    wordDeficits,
    tenseDeficits,
    verbIds: normalizedVerbIds,
    courseTenses: Array.from(questionTenseByCourseTense.keys()),
    questionTenses
  }
}

function getCourseTextbookCoverageSummary(textbookId) {
  const numericTextbookId = Number(textbookId)
  if (!Number.isInteger(numericTextbookId) || numericTextbookId <= 0) {
    return null
  }

  const textbook = findCourseTextbookById(numericTextbookId)
  if (!textbook) return null

  const lessonRows = listCourseLessonsByTextbookIds([numericTextbookId]).map((row) => serializeCourseLesson(row))
  if (!lessonRows.length) {
    return {
      textbookId: numericTextbookId,
      status: COURSE_TEXTBOOK_COVERAGE_UNCHECKED,
      lessonCount: 0,
      canSupplement: false,
      targetCount: 0,
      hasBlockingLessons: false,
      lessonSummaries: []
    }
  }

  const lessonVerbIdsMap = loadLessonVerbIdsMap(lessonRows.map((row) => row.id))
  const lessonSummaries = lessonRows.map((lesson) => (
    buildCourseLessonCoverageSummary(lesson, lessonVerbIdsMap.get(Number(lesson.id)) || [])
  ))
  const insufficientLessons = lessonSummaries.filter((item) => !item.isSufficient)
  const hasBlockingLessons = insufficientLessons.some((item) => !item.isSupplementable)
  const canSupplement = insufficientLessons.length > 0 && !hasBlockingLessons
  const targetCount = canSupplement
    ? insufficientLessons.reduce((sum, item) => sum + Number(item.requiredNewCount || 0), 0)
    : 0

  return {
    textbookId: numericTextbookId,
    status: insufficientLessons.length ? COURSE_TEXTBOOK_COVERAGE_INSUFFICIENT : COURSE_TEXTBOOK_COVERAGE_SUFFICIENT,
    lessonCount: lessonSummaries.length,
    canSupplement,
    targetCount,
    hasBlockingLessons,
    lessonSummaries
  }
}

function getCourseLessonCoverageSummary(lessonId) {
  const numericLessonId = Number(lessonId)
  if (!Number.isInteger(numericLessonId) || numericLessonId <= 0) {
    return null
  }

  const lessonRow = vocabularyDb.prepare(`
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
  `).get(numericLessonId)
  if (!lessonRow) return null

  const lesson = serializeCourseLesson(lessonRow)
  const lessonVerbIdsMap = loadLessonVerbIdsMap([numericLessonId])
  return buildCourseLessonCoverageSummary(lesson, lessonVerbIdsMap.get(numericLessonId) || [])
}

function cleanupCourseTextbookCoverageTasks() {
  const now = Date.now()
  courseTextbookCoverageTasks.forEach((task, textbookId) => {
    const isRunning = task?.state === 'running' || task?.state === 'cancel_requested'
    if (!isRunning && now - Number(task?.updatedAt || 0) >= COURSE_TEXTBOOK_SUPPLEMENT_TASK_RETENTION_MS) {
      courseTextbookCoverageTasks.delete(textbookId)
    }
  })
}

function cleanupCourseLessonCoverageTasks() {
  const now = Date.now()
  courseLessonCoverageTasks.forEach((task, lessonId) => {
    const isRunning = task?.state === 'running' || task?.state === 'cancel_requested'
    if (!isRunning && now - Number(task?.updatedAt || 0) >= COURSE_TEXTBOOK_SUPPLEMENT_TASK_RETENTION_MS) {
      courseLessonCoverageTasks.delete(lessonId)
    }
  })
}

function cleanupCourseCoverageCache() {
  const now = Date.now()
  courseTextbookCoverageCache.forEach((entry, textbookId) => {
    if (now - Number(entry?.cachedAt || 0) >= COURSE_TEXTBOOK_SUPPLEMENT_TASK_RETENTION_MS) {
      courseTextbookCoverageCache.delete(textbookId)
    }
  })
  courseLessonCoverageCache.forEach((entry, lessonId) => {
    if (now - Number(entry?.cachedAt || 0) >= COURSE_TEXTBOOK_SUPPLEMENT_TASK_RETENTION_MS) {
      courseLessonCoverageCache.delete(lessonId)
    }
  })
}

function buildCourseTextbookCoverageRow(summary, task = null) {
  const checkedAt = task?.updatedAt || Date.now()
  if (task && (task.state === 'running' || task.state === 'cancel_requested')) {
    return {
      textbook_id: Number(summary?.textbookId || task.textbookId || 0),
      coverage_status: COURSE_TEXTBOOK_COVERAGE_RUNNING,
      can_supplement: false,
      has_blocking_lessons: Boolean(summary?.hasBlockingLessons),
      is_running: true,
      cancel_requested: task.state === 'cancel_requested',
      generated_count: Number(task.generatedCount || 0),
      target_count: Number(task.targetCount || 0),
      checked_at: new Date(checkedAt).toISOString(),
      task_state: task.state,
      error: task.error || ''
    }
  }

  return {
    textbook_id: Number(summary?.textbookId || task?.textbookId || 0),
    coverage_status: summary?.status || COURSE_TEXTBOOK_COVERAGE_UNCHECKED,
    can_supplement: Boolean(summary?.canSupplement),
    has_blocking_lessons: Boolean(summary?.hasBlockingLessons),
    is_running: false,
    cancel_requested: false,
    generated_count: Number(task?.generatedCount || 0),
    target_count: Number(summary?.targetCount || 0),
    checked_at: new Date(checkedAt).toISOString(),
    task_state: task?.state || null,
    error: task?.error || ''
  }
}

function buildCourseLessonCoverageRow(summary, task = null) {
  const checkedAt = task?.updatedAt || Date.now()
  if (task && (task.state === 'running' || task.state === 'cancel_requested')) {
    return {
      lesson_id: Number(summary?.lessonId || task.lessonId || 0),
      textbook_id: Number(summary?.textbookId || task.textbookId || 0),
      coverage_status: COURSE_TEXTBOOK_COVERAGE_RUNNING,
      can_supplement: false,
      is_running: true,
      cancel_requested: task.state === 'cancel_requested',
      generated_count: Number(task.generatedCount || 0),
      target_count: Number(task.targetCount || 0),
      checked_at: new Date(checkedAt).toISOString(),
      task_state: task.state,
      error: task.error || ''
    }
  }

  return {
    lesson_id: Number(summary?.lessonId || task?.lessonId || 0),
    textbook_id: Number(summary?.textbookId || task?.textbookId || 0),
    coverage_status: summary?.isSufficient ? COURSE_TEXTBOOK_COVERAGE_SUFFICIENT : COURSE_TEXTBOOK_COVERAGE_INSUFFICIENT,
    can_supplement: Boolean(summary?.isSupplementable),
    is_running: false,
    cancel_requested: false,
    generated_count: Number(task?.generatedCount || 0),
    target_count: Number(summary?.requiredNewCount || 0),
    checked_at: new Date(checkedAt).toISOString(),
    task_state: task?.state || null,
    error: task?.error || ''
  }
}

function cacheCourseTextbookCoverageRow(summary, task = null) {
  const row = buildCourseTextbookCoverageRow(summary, task)
  const textbookId = Number(row.textbook_id || summary?.textbookId || task?.textbookId || 0)
  if (textbookId > 0) {
    courseTextbookCoverageCache.set(textbookId, {
      row,
      cachedAt: Date.now()
    })
  }
  return row
}

function cacheCourseLessonCoverageRow(summary, task = null) {
  const row = buildCourseLessonCoverageRow(summary, task)
  const lessonId = Number(row.lesson_id || summary?.lessonId || task?.lessonId || 0)
  if (lessonId > 0) {
    courseLessonCoverageCache.set(lessonId, {
      row,
      cachedAt: Date.now()
    })
  }
  return row
}

function getCachedCourseTextbookCoverageRows(textbookIds = []) {
  cleanupCourseCoverageCache()
  const normalizedIds = Array.from(
    new Set(
      (Array.isArray(textbookIds) ? textbookIds : [])
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item > 0)
    )
  )
  return normalizedIds
    .map((id) => courseTextbookCoverageCache.get(id)?.row || null)
    .filter(Boolean)
}

function getCachedCourseLessonCoverageRows(lessonIds = []) {
  cleanupCourseCoverageCache()
  const normalizedIds = Array.from(
    new Set(
      (Array.isArray(lessonIds) ? lessonIds : [])
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item > 0)
    )
  )
  return normalizedIds
    .map((id) => courseLessonCoverageCache.get(id)?.row || null)
    .filter(Boolean)
}

function invalidateCourseTextbookCoverageCache(textbookId) {
  const numericTextbookId = Number(textbookId)
  if (!numericTextbookId) return
  courseTextbookCoverageCache.delete(numericTextbookId)
}

function invalidateCourseLessonCoverageCache(lessonId) {
  const numericLessonId = Number(lessonId)
  if (!numericLessonId) return
  courseLessonCoverageCache.delete(numericLessonId)
}

function invalidateCourseLessonCoverageCacheByTextbook(textbookId) {
  const numericTextbookId = Number(textbookId)
  if (!numericTextbookId) return
  courseLessonCoverageCache.forEach((entry, lessonId) => {
    if (Number(entry?.row?.textbook_id || 0) === numericTextbookId) {
      courseLessonCoverageCache.delete(lessonId)
    }
  })
}

function pickRandomItem(items = []) {
  if (!Array.isArray(items) || items.length === 0) return null
  return items[Math.floor(Math.random() * items.length)] || null
}

function pickNextCourseLessonSupplementTarget(lessonSummary) {
  if (!lessonSummary || !lessonSummary.isSupplementable) return null

  const maxWordDeficit = lessonSummary.wordDeficits.reduce((best, item) => {
    if (!best || item.deficit > best.deficit) return item
    return best
  }, null)
  const maxTenseDeficit = lessonSummary.tenseDeficits.reduce((best, item) => {
    if (!best || item.deficit > best.deficit) return item
    return best
  }, null)

  const fallbackWordStat = [...(lessonSummary.wordStats || [])]
    .sort((left, right) => left.currentCount - right.currentCount)[0] || null
  const fallbackTenseStat = [...(lessonSummary.tenseStats || [])]
    .sort((left, right) => left.currentCount - right.currentCount)[0] || null

  const verbId = Number(maxWordDeficit?.verbId || fallbackWordStat?.verbId || pickRandomItem(lessonSummary.verbIds) || 0)
  const courseTense = String(
    maxTenseDeficit?.courseTense ||
    fallbackTenseStat?.courseTense ||
    pickRandomItem(lessonSummary.courseTenses) ||
    ''
  )
  if (!verbId || !courseTense) return null

  return {
    lessonId: Number(lessonSummary.lessonId || 0),
    verbId,
    courseTense,
    mood: COURSE_TENSE_TO_MOOD[courseTense]
  }
}

async function runCourseTextbookSupplementTask(task) {
  const maxAttempts = Math.max(Number(task.targetCount || 0) * 12, 24)
  let attempts = 0

  try {
    while (attempts < maxAttempts) {
      if (task.cancelRequested) {
        task.state = 'cancel_requested'
      }

      const summary = getCourseTextbookCoverageSummary(task.textbookId)
      task.latestSummary = summary
      task.updatedAt = Date.now()
      cacheCourseTextbookCoverageRow(summary, task)
      if (!summary || summary.status !== COURSE_TEXTBOOK_COVERAGE_INSUFFICIENT) {
        break
      }

      const nextLesson = summary.lessonSummaries.find((item) => !item.isSufficient && item.isSupplementable)
      if (!nextLesson) {
        break
      }

      if (task.cancelRequested) {
        break
      }

      const target = pickNextCourseLessonSupplementTarget(nextLesson)
      if (!target) {
        break
      }

      const verb = VerbAdmin.findById(target.verbId)
      if (!verb) {
        attempts += 1
        continue
      }

      try {
        const generated = await ExerciseGeneratorService.generateWithAIForVerb(verb, {
          exerciseType: 'sentence',
          moods: target.mood ? [target.mood] : [],
          tenses: [target.courseTense],
          userId: task.actorId,
          includeVos: false,
          includeVosotros: true,
          reduceRareTenseFrequency: false
        })
        if (generated?.savedQuestionCreated) {
          task.generatedCount += 1
          task.updatedAt = Date.now()
          const latestSummary = getCourseTextbookCoverageSummary(task.textbookId)
          task.latestSummary = latestSummary
          cacheCourseTextbookCoverageRow(latestSummary, task)
        }
      } catch (error) {
        task.error = error?.message || '补题生成失败'
        task.updatedAt = Date.now()
        cacheCourseTextbookCoverageRow(summary, task)
      }

      attempts += 1
    }

    const finalSummary = getCourseTextbookCoverageSummary(task.textbookId)
    task.latestSummary = finalSummary
    task.updatedAt = Date.now()
    task.state = task.cancelRequested ? 'cancelled' : 'completed'
    cacheCourseTextbookCoverageRow(finalSummary, task)
  } catch (error) {
    task.error = error?.message || '补题任务执行失败'
    task.latestSummary = getCourseTextbookCoverageSummary(task.textbookId)
    task.updatedAt = Date.now()
    task.state = task.cancelRequested ? 'cancelled' : 'failed'
    cacheCourseTextbookCoverageRow(task.latestSummary, task)
  }
}

async function runCourseLessonSupplementTask(task) {
  const maxAttempts = Math.max(Number(task.targetCount || 0) * 12, 24)
  let attempts = 0

  try {
    while (attempts < maxAttempts) {
      if (task.cancelRequested) {
        task.state = 'cancel_requested'
      }

      const summary = getCourseLessonCoverageSummary(task.lessonId)
      task.latestSummary = summary
      task.updatedAt = Date.now()
      cacheCourseLessonCoverageRow(summary, task)
      if (!summary || summary.isSufficient || !summary.isSupplementable) {
        break
      }

      if (task.cancelRequested) {
        break
      }

      const target = pickNextCourseLessonSupplementTarget(summary)
      if (!target) {
        break
      }

      const verb = VerbAdmin.findById(target.verbId)
      if (!verb) {
        attempts += 1
        continue
      }

      try {
        const generated = await ExerciseGeneratorService.generateWithAIForVerb(verb, {
          exerciseType: 'sentence',
          moods: target.mood ? [target.mood] : [],
          tenses: [target.courseTense],
          userId: task.actorId,
          includeVos: false,
          includeVosotros: true,
          reduceRareTenseFrequency: false
        })
        if (generated?.savedQuestionCreated) {
          task.generatedCount += 1
          task.updatedAt = Date.now()
          const latestSummary = getCourseLessonCoverageSummary(task.lessonId)
          task.latestSummary = latestSummary
          cacheCourseLessonCoverageRow(latestSummary, task)
        }
      } catch (error) {
        task.error = error?.message || '补题生成失败'
        task.updatedAt = Date.now()
        cacheCourseLessonCoverageRow(summary, task)
      }

      attempts += 1
    }

    const finalSummary = getCourseLessonCoverageSummary(task.lessonId)
    task.latestSummary = finalSummary
    task.updatedAt = Date.now()
    task.state = task.cancelRequested ? 'cancelled' : 'completed'
    cacheCourseLessonCoverageRow(finalSummary, task)
  } catch (error) {
    task.error = error?.message || '补题任务执行失败'
    task.latestSummary = getCourseLessonCoverageSummary(task.lessonId)
    task.updatedAt = Date.now()
    task.state = task.cancelRequested ? 'cancelled' : 'failed'
    cacheCourseLessonCoverageRow(task.latestSummary, task)
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

function toChineseLessonNumber(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 1 || number > 100) {
    return String(value || '')
  }
  const digits = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']
  if (number <= 10) {
    return number === 10 ? '十' : digits[number]
  }
  if (number < 20) {
    return `十${digits[number % 10]}`
  }
  if (number === 100) {
    return '一百'
  }
  const tens = Math.floor(number / 10)
  const ones = number % 10
  return ones === 0 ? `${digits[tens]}十` : `${digits[tens]}十${digits[ones]}`
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

  if (!['admin', 'dev', 'superadmin'].includes(user.role)) {
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

function isStrictDev(req) {
  return req.admin?.role === 'dev'
}

function isSuperAdmin(req) {
  return req.admin?.role === 'superadmin'
}

function isDev(req) {
  return isStrictDev(req) || isSuperAdmin(req)
}

function forbid(res, message = '无权限') {
  return res.status(403).json({ error: message })
}

router.get('/history', requireAdmin, (req, res) => {
  const limit = Number(req.query.limit || 20)
  const offset = Number(req.query.offset || 0)
  const result = AdminHistory.list(req.admin?.role, { limit, offset })
  res.json(result)
})

router.get('/history/:source/:id', requireAdmin, (req, res) => {
  const source = String(req.params.source || '').trim()
  const id = Number(req.params.id)
  if (!id || Number.isNaN(id)) {
    return res.status(400).json({ error: '历史ID不合法' })
  }
  const row = AdminHistory.findBySourceAndId(source, id, req.admin?.role)
  if (!row) {
    return res.status(404).json({ error: '历史记录不存在' })
  }
  res.json({ row })
})

router.delete('/history/:source/:id', requireAdmin, (req, res) => {
  if (!isStrictDev(req)) {
    return forbid(res, '仅 dev 可删除管理历史')
  }
  const source = String(req.params.source || '').trim()
  const id = Number(req.params.id)
  if (!id || Number.isNaN(id)) {
    return res.status(400).json({ error: '历史ID不合法' })
  }
  const row = AdminHistory.findBySourceAndId(source, id, req.admin?.role)
  if (!row) {
    return res.status(404).json({ error: '历史记录不存在' })
  }
  const result = AdminHistory.deleteBySourceAndId(source, id)
  if (!result?.changes) {
    return res.status(404).json({ error: '历史记录不存在' })
  }
  res.json({ success: true })
})

router.post('/history/delete-older-than', requireAdmin, (req, res) => {
  if (!isStrictDev(req)) {
    return forbid(res, '仅 dev 可删除旧管理历史')
  }
  const days = Number(req.body?.days)
  const safeDays = Number.isFinite(days) && days >= 0 ? Math.floor(days) : 30
  const result = AdminHistory.deleteOlderThan(safeDays)
  res.json({
    success: true,
    deleted: result.deleted,
    breakdown: result.breakdown,
    days: safeDays
  })
})

function cleanupAdminAutofillInvalidRecords() {
  const ttlModifier = `-${ADMIN_AUTOFILL_BATCH_TTL_MINUTES} minutes`
  userDb
    .prepare(`
      DELETE FROM admin_autofill_invalid_entries
      WHERE datetime(created_at) <= datetime('now', 'localtime', ?)
    `)
    .run(ttlModifier)
}

function hasVerbInfinitiveInLexicon(infinitive) {
  const normalized = String(infinitive || '').trim()
  if (!normalized) return false
  const row = vocabularyDb
    .prepare('SELECT 1 as found FROM verbs WHERE lower(infinitive) = lower(?) LIMIT 1')
    .get(normalized)
  return !!row
}

function registerAdminAutofillInvalid(req, { batchId, infinitive }) {
  if (req.admin?.role !== 'admin') {
    return { demoted: false, invalidCount: 0 }
  }

  if (hasVerbInfinitiveInLexicon(infinitive)) {
    return { demoted: false, invalidCount: 0 }
  }

  const adminId = Number(req.admin?.id || 0)
  if (!adminId) {
    return { demoted: false, invalidCount: 0 }
  }

  const normalizedBatchId = String(batchId || '').trim().slice(0, 80)
    || `fallback-${Math.floor(Date.now() / ADMIN_AUTOFILL_BATCH_TTL_MS)}`

  const normalizedInfinitive = String(infinitive || '').trim().toLowerCase()
  if (!normalizedInfinitive) {
    return { demoted: false, invalidCount: 0 }
  }

  try {
    cleanupAdminAutofillInvalidRecords()

    userDb
      .prepare(`
        INSERT INTO admin_autofill_invalid_entries (admin_id, batch_id, infinitive)
        VALUES (?, ?, ?)
        ON CONFLICT(admin_id, batch_id, infinitive) DO NOTHING
      `)
      .run(adminId, normalizedBatchId, normalizedInfinitive)

    const countRow = userDb
      .prepare(`
        SELECT COUNT(*) AS total
        FROM admin_autofill_invalid_entries
        WHERE admin_id = ? AND batch_id = ?
      `)
      .get(adminId, normalizedBatchId)
    const invalidCount = Number(countRow?.total || 0)

    if (invalidCount > ADMIN_AUTOFILL_INVALID_LIMIT) {
      const result = updateUser(adminId, { role: 'user' })
      if (result?.changes) {
        AdminLog.create('warn', 'admin autofill privilege revoked', {
          userId: adminId,
          batchId: normalizedBatchId,
          invalidCount
        })
        userDb
          .prepare('DELETE FROM admin_autofill_invalid_entries WHERE admin_id = ? AND batch_id = ?')
          .run(adminId, normalizedBatchId)
        return { demoted: true, invalidCount }
      }
    }
    return { demoted: false, invalidCount }
  } catch (error) {
    console.error('记录非法自动生成词条失败:', error)
    return { demoted: false, invalidCount: 0 }
  }
}

router.get('/users', requireAdmin, (req, res) => {
  const limit = Number(req.query.limit || 50)
  const offset = Number(req.query.offset || 0)
  const role = req.query.role
  if (!isStrictDev(req)) {
    if (role === 'dev') {
      return res.json({ rows: [], total: 0 })
    }
    if (req.admin?.role === 'admin' && role === 'superadmin') {
      return res.json({ rows: [], total: 0 })
    }
  }

  const excludeRoles = isStrictDev(req)
    ? []
    : isSuperAdmin(req)
      ? ['dev']
      : ['dev', 'superadmin']

  const result = role
    ? listUsers(role, { limit, offset })
    : listAllUsers({
      limit,
      offset,
      excludeRoles
    })

  res.json(result)
})

router.post('/users', requireAdmin, (req, res) => {
  if (!isDev(req)) {
    return forbid(res, '仅 dev/superadmin 可以创建用户')
  }
  const { username, email, password, role = 'user', user_type = 'student' } = req.body
  if (!username || !password) {
    return res.status(400).json({ error: '缺少必要字段' })
  }
  if (!['user', 'admin', 'dev', 'superadmin'].includes(role)) {
    return res.status(400).json({ error: '非法角色' })
  }
  if (isSuperAdmin(req) && role === 'dev') {
    return forbid(res, 'superadmin 不可创建或提升 dev')
  }
  if (isSuperAdmin(req) && role === 'superadmin') {
    return forbid(res, 'superadmin 不可创建 superadmin')
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
  if (isSuperAdmin(req) && user.role === 'dev') {
    return res.status(404).json({ error: '用户不存在' })
  }
  if (req.admin?.role === 'admin' && (user.role === 'dev' || user.role === 'superadmin')) {
    return res.status(404).json({ error: '用户不存在' })
  }
  res.json(user)
})

router.put('/users/:id', requireAdmin, (req, res) => {
  const target = findRawUserById(req.params.id)
  if (!target) {
    return res.status(404).json({ error: '用户不存在' })
  }
  const actorId = Number(req.admin?.id || 0)
  const targetId = Number(target.id || 0)
  const isSelf = actorId > 0 && actorId === targetId

  const payload = req.body || {}
  const hasRoleField = Object.prototype.hasOwnProperty.call(payload, 'role')
  const nextRole = hasRoleField ? String(payload.role || '').trim() : ''
  if (hasRoleField && !['user', 'admin', 'dev', 'superadmin'].includes(nextRole)) {
    return res.status(400).json({ error: '非法角色' })
  }

  if (payload.user_type !== undefined && !ALLOWED_USER_TYPES.includes(String(payload.user_type))) {
    return res.status(400).json({ error: '非法用户类型' })
  }

  if (target.is_initial_dev && hasRoleField && nextRole !== 'dev') {
    return forbid(res, '初始 dev 角色不可变更')
  }

  if (isSuperAdmin(req) && (target.role === 'dev' || target.is_initial_dev)) {
    return forbid(res, 'superadmin 不能修改 dev 用户')
  }

  if (req.admin?.role === 'admin' && (target.role === 'dev' || target.is_initial_dev)) {
    return forbid(res, '管理员不能修改 dev 用户')
  }

  if (req.admin?.role === 'admin' && target.role === 'superadmin') {
    return forbid(res, '管理员不能修改 superadmin 用户')
  }

  if (req.admin?.role === 'admin' && target.role === 'admin' && hasRoleField && nextRole !== 'admin') {
    return forbid(res, '不能取消管理员权限')
  }

  if (req.admin?.role === 'admin' && hasRoleField && nextRole === 'dev') {
    return forbid(res, '管理员不可创建或提升 dev')
  }

  if (req.admin?.role === 'admin' && hasRoleField && nextRole === 'superadmin') {
    return forbid(res, '管理员不可提升 superadmin')
  }

  if (isSuperAdmin(req) && hasRoleField && nextRole === 'dev') {
    return forbid(res, 'superadmin 不可创建或提升 dev')
  }

  if (isSuperAdmin(req) && target.role === 'superadmin' && !isSelf) {
    return forbid(res, 'superadmin 不能修改其他 superadmin')
  }

  if (isSuperAdmin(req) && hasRoleField && nextRole === 'superadmin' && !isSelf) {
    return forbid(res, 'superadmin 不可将其他用户提升为 superadmin')
  }

  if (isSuperAdmin(req) && isSelf && hasRoleField && nextRole !== 'superadmin') {
    return forbid(res, 'superadmin 不能降级自己')
  }

  updateUser(req.params.id, payload)
  const updated = findRawUserById(req.params.id)
  const userDiff = buildHistoryDiff(target, updated, USER_HISTORY_FIELDS)
  if (userDiff.changedFields.length > 0) {
    recordHistoryFromRequest(req, 'user', {
      history_type: 'user',
      target_id: Number(updated.id),
      action_type: 'update_user',
      changed_fields: userDiff.changedFields,
      before_data: userDiff.beforeData,
      after_data: userDiff.afterData
    })
  }
  res.json({ success: true })
})

router.delete('/users/:id', requireAdmin, (req, res) => {
  if (!isDev(req)) {
    return forbid(res, '仅 dev/superadmin 可以删除用户')
  }
  const target = findRawUserById(req.params.id)
  if (!target) {
    return res.status(404).json({ error: '用户不存在' })
  }
  if (isSuperAdmin(req) && target.role === 'dev') {
    return forbid(res, 'superadmin 不能删除 dev 用户')
  }
  if (target.is_initial_dev) {
    return forbid(res, '不可删除初始 dev 用户')
  }
  if (req.admin.id === target.id) {
    return forbid(res, '不能删除自己')
  }
  deleteUser(req.params.id)
  recordHistoryFromRequest(req, 'user', {
    history_type: 'user',
    target_id: Number(target.id),
    action_type: 'delete_user',
    snapshot_data: target
  })
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
  if (!isDev(req)) {
    return forbid(res, '仅 dev 可以删除管理员')
  }
  const user = findRawUserById(req.params.id)
  if (!user || user.role !== 'admin') {
    return res.status(404).json({ error: '管理员不存在' })
  }
  if (user.is_initial_admin) {
    return res.status(403).json({ error: '不可删除初始管理员' })
  }
  deleteUser(req.params.id)
  recordHistoryFromRequest(req, 'user', {
    history_type: 'user',
    target_id: Number(user.id),
    action_type: 'delete_user',
    snapshot_data: user
  })
  res.json({ success: true })
})

router.get('/versions', requireAdmin, (req, res) => {
  if (!isStrictDev(req)) {
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
    if (!isStrictDev(req)) {
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
  if (!isStrictDev(req)) {
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
  const rows = listCourseTextbooksWithLessonCount()

  res.json({
    rows: rows.map((item) => serializeCourseTextbook(item))
  })
})

router.get('/course-materials/textbooks/question-coverage/check', requireAdmin, (req, res) => {
  if (!isDev(req)) return forbid(res, '仅 dev/superadmin 可检查教材题量')

  cleanupCourseTextbookCoverageTasks()
  cleanupCourseLessonCoverageTasks()
  cleanupCourseCoverageCache()

  const textbooks = listCourseTextbooksWithLessonCount().map((item) => serializeCourseTextbook(item))
  const rows = textbooks.map((textbook) => {
    const summary = getCourseTextbookCoverageSummary(textbook.id) || {
      textbookId: textbook.id,
      status: COURSE_TEXTBOOK_COVERAGE_UNCHECKED,
      canSupplement: false,
      targetCount: 0,
      hasBlockingLessons: false
    }
    const task = courseTextbookCoverageTasks.get(Number(textbook.id)) || null
    return cacheCourseTextbookCoverageRow(summary, task)
  })

  res.json({ rows })
})

router.get('/course-materials/textbooks/question-coverage/cache', requireAdmin, (req, res) => {
  if (!isDev(req)) return forbid(res, '仅 dev/superadmin 可查看教材题量缓存')

  const textbookIds = listCourseTextbooksWithLessonCount().map((item) => Number(item.id))
  const rows = getCachedCourseTextbookCoverageRows(textbookIds)
  res.json({ rows })
})

router.get('/course-materials/textbooks/:id/question-coverage/supplement', requireAdmin, (req, res) => {
  if (!isDev(req)) return forbid(res, '仅 dev/superadmin 可查看补题任务')

  cleanupCourseTextbookCoverageTasks()
  cleanupCourseLessonCoverageTasks()
  cleanupCourseCoverageCache()

  const textbookId = Number(req.params.id)
  if (!textbookId || Number.isNaN(textbookId)) {
    return res.status(400).json({ error: '教材ID不合法' })
  }

  const textbook = findCourseTextbookById(textbookId)
  if (!textbook) {
    return res.status(404).json({ error: '教材不存在' })
  }

  const summary = getCourseTextbookCoverageSummary(textbookId)
  const task = courseTextbookCoverageTasks.get(textbookId) || null

  res.json({
    row: cacheCourseTextbookCoverageRow(summary, task)
  })
})

router.post('/course-materials/textbooks/:id/question-coverage/supplement', requireAdmin, (req, res) => {
  if (!isDev(req)) return forbid(res, '仅 dev/superadmin 可补充教材题目')

  cleanupCourseTextbookCoverageTasks()
  cleanupCourseLessonCoverageTasks()

  const textbookId = Number(req.params.id)
  if (!textbookId || Number.isNaN(textbookId)) {
    return res.status(400).json({ error: '教材ID不合法' })
  }

  const textbook = findCourseTextbookById(textbookId)
  if (!textbook) {
    return res.status(404).json({ error: '教材不存在' })
  }

  const existingTask = courseTextbookCoverageTasks.get(textbookId)
  if (existingTask && (existingTask.state === 'running' || existingTask.state === 'cancel_requested')) {
    const summary = getCourseTextbookCoverageSummary(textbookId)
    return res.json({
      row: cacheCourseTextbookCoverageRow(summary, existingTask)
    })
  }

  const summary = getCourseTextbookCoverageSummary(textbookId)
  if (!summary) {
    return res.status(404).json({ error: '教材不存在' })
  }
  if (summary.status !== COURSE_TEXTBOOK_COVERAGE_INSUFFICIENT) {
    return res.status(400).json({ error: '当前教材题量已充足，无需补充' })
  }
  if (!summary.canSupplement || !summary.targetCount) {
    return res.status(400).json({ error: '当前教材仅支持检查，不支持自动补题' })
  }

  const task = {
    textbookId,
    actorId: Number(req.admin?.id || 0),
    state: 'running',
    cancelRequested: false,
    generatedCount: 0,
    targetCount: Number(summary.targetCount || 0),
    latestSummary: summary,
    error: '',
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  courseTextbookCoverageTasks.set(textbookId, task)
  cacheCourseTextbookCoverageRow(summary, task)

  runCourseTextbookSupplementTask(task).catch((error) => {
    task.error = error?.message || '补题任务执行失败'
    task.latestSummary = getCourseTextbookCoverageSummary(task.textbookId)
    task.updatedAt = Date.now()
    task.state = task.cancelRequested ? 'cancelled' : 'failed'
    cacheCourseTextbookCoverageRow(task.latestSummary, task)
  })

  res.json({
    row: cacheCourseTextbookCoverageRow(summary, task)
  })
})

router.delete('/course-materials/textbooks/:id/question-coverage/supplement', requireAdmin, (req, res) => {
  if (!isDev(req)) return forbid(res, '仅 dev/superadmin 可取消补题任务')

  cleanupCourseTextbookCoverageTasks()
  cleanupCourseLessonCoverageTasks()

  const textbookId = Number(req.params.id)
  if (!textbookId || Number.isNaN(textbookId)) {
    return res.status(400).json({ error: '教材ID不合法' })
  }

  const task = courseTextbookCoverageTasks.get(textbookId)
  if (!task || (task.state !== 'running' && task.state !== 'cancel_requested')) {
    return res.status(404).json({ error: '当前教材没有正在执行的补题任务' })
  }

  task.cancelRequested = true
  task.state = 'cancel_requested'
  task.updatedAt = Date.now()

  const summary = getCourseTextbookCoverageSummary(textbookId)
  res.json({
    row: cacheCourseTextbookCoverageRow(summary, task)
  })
})

router.get('/course-materials/textbooks/:id/lessons/question-coverage/check', requireAdmin, (req, res) => {
  if (!isDev(req)) return forbid(res, '仅 dev/superadmin 可检查课程题量')

  cleanupCourseLessonCoverageTasks()
  cleanupCourseCoverageCache()

  const textbookId = Number(req.params.id)
  if (!textbookId || Number.isNaN(textbookId)) {
    return res.status(400).json({ error: '教材ID不合法' })
  }

  const textbook = findCourseTextbookById(textbookId)
  if (!textbook) {
    return res.status(404).json({ error: '教材不存在' })
  }

  const summary = getCourseTextbookCoverageSummary(textbookId)
  const rows = Array.isArray(summary?.lessonSummaries)
    ? summary.lessonSummaries.map((lessonSummary) => {
      const task = courseLessonCoverageTasks.get(Number(lessonSummary.lessonId)) || null
      return cacheCourseLessonCoverageRow(lessonSummary, task)
    })
    : []

  res.json({ rows })
})

router.get('/course-materials/textbooks/:id/lessons/question-coverage/cache', requireAdmin, (req, res) => {
  if (!isDev(req)) return forbid(res, '仅 dev/superadmin 可查看课程题量缓存')

  const textbookId = Number(req.params.id)
  if (!textbookId || Number.isNaN(textbookId)) {
    return res.status(400).json({ error: '教材ID不合法' })
  }

  const lessonRows = listCourseLessonsByTextbookIds([textbookId]).map((row) => serializeCourseLesson(row))
  const rows = getCachedCourseLessonCoverageRows(lessonRows.map((item) => Number(item.id)))
  res.json({ rows })
})

router.get('/course-materials/lessons/:id/question-coverage/supplement', requireAdmin, (req, res) => {
  if (!isDev(req)) return forbid(res, '仅 dev/superadmin 可查看课程补题任务')

  cleanupCourseLessonCoverageTasks()
  cleanupCourseCoverageCache()

  const lessonId = Number(req.params.id)
  if (!lessonId || Number.isNaN(lessonId)) {
    return res.status(400).json({ error: '课程ID不合法' })
  }

  const summary = getCourseLessonCoverageSummary(lessonId)
  if (!summary) {
    return res.status(404).json({ error: '课程不存在' })
  }

  const task = courseLessonCoverageTasks.get(lessonId) || null
  res.json({
    row: cacheCourseLessonCoverageRow(summary, task)
  })
})

router.post('/course-materials/lessons/:id/question-coverage/supplement', requireAdmin, (req, res) => {
  if (!isDev(req)) return forbid(res, '仅 dev/superadmin 可补充课程题目')

  cleanupCourseLessonCoverageTasks()

  const lessonId = Number(req.params.id)
  if (!lessonId || Number.isNaN(lessonId)) {
    return res.status(400).json({ error: '课程ID不合法' })
  }

  const summary = getCourseLessonCoverageSummary(lessonId)
  if (!summary) {
    return res.status(404).json({ error: '课程不存在' })
  }

  const existingTask = courseLessonCoverageTasks.get(lessonId)
  if (existingTask && (existingTask.state === 'running' || existingTask.state === 'cancel_requested')) {
    return res.json({
      row: cacheCourseLessonCoverageRow(summary, existingTask)
    })
  }

  if (summary.isSufficient) {
    return res.status(400).json({ error: '当前课程题量已充足，无需补充' })
  }
  if (!summary.isSupplementable || !summary.requiredNewCount) {
    return res.status(400).json({ error: '当前课程仅支持检查，不支持自动补题' })
  }

  const task = {
    lessonId,
    textbookId: Number(summary.textbookId || 0),
    actorId: Number(req.admin?.id || 0),
    state: 'running',
    cancelRequested: false,
    generatedCount: 0,
    targetCount: Number(summary.requiredNewCount || 0),
    latestSummary: summary,
    error: '',
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  courseLessonCoverageTasks.set(lessonId, task)
  cacheCourseLessonCoverageRow(summary, task)

  runCourseLessonSupplementTask(task).catch((error) => {
    task.error = error?.message || '补题任务执行失败'
    task.latestSummary = getCourseLessonCoverageSummary(task.lessonId)
    task.updatedAt = Date.now()
    task.state = task.cancelRequested ? 'cancelled' : 'failed'
    cacheCourseLessonCoverageRow(task.latestSummary, task)
  })

  res.json({
    row: cacheCourseLessonCoverageRow(summary, task)
  })
})

router.delete('/course-materials/lessons/:id/question-coverage/supplement', requireAdmin, (req, res) => {
  if (!isDev(req)) return forbid(res, '仅 dev/superadmin 可取消课程补题任务')

  cleanupCourseLessonCoverageTasks()

  const lessonId = Number(req.params.id)
  if (!lessonId || Number.isNaN(lessonId)) {
    return res.status(400).json({ error: '课程ID不合法' })
  }

  const task = courseLessonCoverageTasks.get(lessonId)
  if (!task || (task.state !== 'running' && task.state !== 'cancel_requested')) {
    return res.status(404).json({ error: '当前课程没有正在执行的补题任务' })
  }

  task.cancelRequested = true
  task.state = 'cancel_requested'
  task.updatedAt = Date.now()

  const summary = getCourseLessonCoverageSummary(lessonId)
  res.json({
    row: cacheCourseLessonCoverageRow(summary, task)
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
    INSERT INTO textbooks (name, description, cover_image, is_published, publish_status, order_index, uploader_id, created_at, updated_at)
    VALUES (?, NULL, NULL, 0, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
  `).run(name, COURSE_TEXTBOOK_PUBLISH_DRAFT, orderIndex, Number(req.admin.id))

  const row = vocabularyDb.prepare('SELECT * FROM textbooks WHERE id = ?').get(result.lastInsertRowid)
  recordHistoryFromRequest(req, 'textbook', {
    history_type: 'textbook',
    target_id: Number(result.lastInsertRowid),
    action_type: 'create_textbook',
    after_data: {
      name: row?.name || name
    }
  })
  res.status(201).json({
    row: serializeCourseTextbook({ ...row, lesson_count: 0 })
  })
})

router.put('/course-materials/textbooks/:id/publish', requireAdmin, (req, res) => {
  const textbookId = Number(req.params.id)
  if (!textbookId || Number.isNaN(textbookId)) {
    return res.status(400).json({ error: '教材ID不合法' })
  }

  const textbook = findCourseTextbookById(textbookId)
  if (!textbook) {
    return res.status(404).json({ error: '教材不存在' })
  }
  if (!ensureCanManageCourseTextbook(req, res, textbook)) return

  const currentStatus = normalizeCourseTextbookPublishStatus(textbook.publish_status, textbook.is_published)
  const requestedAction = String(req.body?.action || '').trim()
  const fallbackAction = req.body?.isPublished === undefined
    ? ''
    : (req.body.isPublished ? (isDev(req) ? 'publish' : 'submit') : 'unpublish')
  const action = requestedAction || fallbackAction
  if (!action) {
    return res.status(400).json({ error: '缺少发布动作' })
  }

  if (action === 'submit') {
    if (req.admin?.role !== 'admin') {
      return forbid(res, '仅普通 admin 需要提交审核')
    }
    if (currentStatus === COURSE_TEXTBOOK_PUBLISH_PUBLISHED) {
      return res.status(400).json({ error: '教材已发布，无需重复提交' })
    }
    if (currentStatus === COURSE_TEXTBOOK_PUBLISH_PENDING_REVIEW) {
      return res.status(400).json({ error: '教材已在等待审核中' })
    }
    saveCourseTextbookPublishStatus(textbookId, COURSE_TEXTBOOK_PUBLISH_PENDING_REVIEW)
  } else if (action === 'approve') {
    if (!isDev(req)) {
      return forbid(res, '仅 dev/superadmin 可确认发布教材')
    }
    if (currentStatus !== COURSE_TEXTBOOK_PUBLISH_PENDING_REVIEW) {
      return res.status(400).json({ error: '当前教材不在等待审核状态' })
    }
    saveCourseTextbookPublishStatus(textbookId, COURSE_TEXTBOOK_PUBLISH_PUBLISHED)
  } else if (action === 'publish') {
    if (!isDev(req)) {
      return forbid(res, '仅 dev/superadmin 可直接发布教材')
    }
    if (currentStatus === COURSE_TEXTBOOK_PUBLISH_PUBLISHED) {
      return res.status(400).json({ error: '教材已发布' })
    }
    saveCourseTextbookPublishStatus(textbookId, COURSE_TEXTBOOK_PUBLISH_PUBLISHED)
  } else if (action === 'unpublish') {
    if (currentStatus === COURSE_TEXTBOOK_PUBLISH_DRAFT) {
      return res.status(400).json({ error: '教材当前已是草稿状态' })
    }
    saveCourseTextbookPublishStatus(textbookId, COURSE_TEXTBOOK_PUBLISH_DRAFT)
  } else {
    return res.status(400).json({ error: '发布动作不合法' })
  }

  const updated = vocabularyDb.prepare(`
    SELECT
      t.*,
      COUNT(l.id) AS lesson_count
    FROM textbooks t
    LEFT JOIN lessons l ON l.textbook_id = t.id
    WHERE t.id = ?
    GROUP BY t.id
  `).get(textbookId)
  const historyActionTypeMap = {
    submit: 'submit_textbook_publish',
    approve: 'approve_textbook_publish',
    publish: 'publish_textbook',
    unpublish: 'unpublish_textbook'
  }
  recordHistoryFromRequest(req, 'textbook', {
    history_type: 'textbook',
    target_id: textbookId,
    action_type: historyActionTypeMap[action] || 'update_textbook',
    after_data: {
      name: updated?.name || textbook?.name || null
    }
  })
  res.json({
    success: true,
    row: serializeCourseTextbook(updated)
  })
})

router.delete('/course-materials/textbooks/:id', requireAdmin, (req, res) => {
  const textbookId = Number(req.params.id)
  if (!textbookId || Number.isNaN(textbookId)) {
    return res.status(400).json({ error: '教材ID不合法' })
  }

  const textbook = findCourseTextbookById(textbookId)
  if (!textbook) {
    return res.status(404).json({ error: '教材不存在' })
  }
  if (!ensureCanManageCourseTextbook(req, res, textbook)) return

  const snapshot = buildTextbookDeleteSnapshot(textbookId)
  vocabularyDb.prepare('DELETE FROM textbooks WHERE id = ?').run(textbookId)
  invalidateCourseTextbookCoverageCache(textbookId)
  invalidateCourseLessonCoverageCacheByTextbook(textbookId)
  courseTextbookCoverageTasks.delete(textbookId)
  recordHistoryFromRequest(req, 'textbook', {
    history_type: 'textbook',
    target_id: textbookId,
    action_type: 'delete_textbook',
    snapshot_data: snapshot
  })
  res.json({ success: true })
})

router.get('/course-materials/textbooks/:id/lessons', requireAdmin, (req, res) => {
  const textbookId = Number(req.params.id)
  if (!textbookId || Number.isNaN(textbookId)) {
    return res.status(400).json({ error: '教材ID不合法' })
  }

  const textbook = findCourseTextbookById(textbookId)
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
    textbook: serializeCourseTextbook(textbook),
    rows: rows.map((row) => serializeCourseLesson(row))
  })
})

router.post('/course-materials/textbooks/:id/lessons', requireAdmin, (req, res) => {
  const textbookId = Number(req.params.id)
  if (!textbookId || Number.isNaN(textbookId)) {
    return res.status(400).json({ error: '教材ID不合法' })
  }

  const textbook = findCourseTextbookById(textbookId)
  if (!textbook) {
    return res.status(404).json({ error: '教材不存在' })
  }
  if (!ensureCanManageCourseTextbook(req, res, textbook)) return

  const maxNumberRow = vocabularyDb.prepare(`
    SELECT COALESCE(MAX(lesson_number), 0) AS max_number
    FROM lessons
    WHERE textbook_id = ?
  `).get(textbookId)

  const nextLessonNumber = Number(maxNumberRow?.max_number || 0) + 1
  if (nextLessonNumber > 100) {
    return res.status(400).json({ error: '添加课程失败：已达到第一百课上限' })
  }
  const title = `第${toChineseLessonNumber(nextLessonNumber)}课`
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
  invalidateCourseTextbookCoverageCache(textbookId)
  invalidateCourseLessonCoverageCacheByTextbook(textbookId)

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
  const textbook = findCourseTextbookById(lesson.textbook_id)
  if (!textbook) {
    return res.status(404).json({ error: '教材不存在' })
  }
  if (!ensureCanManageCourseTextbook(req, res, textbook)) return

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
  if (hasTenses) {
    invalidateCourseTextbookCoverageCache(lesson.textbook_id)
    invalidateCourseLessonCoverageCache(lessonId)
  }

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
  const textbook = findCourseTextbookById(lesson.textbook_id)
  if (!textbook) {
    return res.status(404).json({ error: '教材不存在' })
  }
  if (!ensureCanManageCourseTextbook(req, res, textbook)) return

  vocabularyDb.prepare('DELETE FROM lessons WHERE id = ?').run(lessonId)
  touchCourseTextbook(lesson.textbook_id)
  invalidateCourseTextbookCoverageCache(lesson.textbook_id)
  invalidateCourseLessonCoverageCache(lessonId)
  courseLessonCoverageTasks.delete(lessonId)
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
  const textbook = findCourseTextbookById(lesson.textbook_id)
  if (!textbook) {
    return res.status(404).json({ error: '教材不存在' })
  }
  if (!ensureCanManageCourseTextbook(req, res, textbook)) return

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
  invalidateCourseTextbookCoverageCache(lesson.textbook_id)
  invalidateCourseLessonCoverageCache(lessonId)
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
  const batchId = String(req.body?.batchId || '').trim()
  if (!infinitive) {
    return res.status(400).json({ error: '缺少动词原形 (infinitive)' })
  }

  try {
    const result = await VerbAutoFillService.validateInfinitive(infinitive)
    if (!result.isValid) {
      const enforcement = registerAdminAutofillInvalid(req, { batchId, infinitive })
      if (enforcement.demoted) {
        return res.status(403).json({
          error: ADMIN_AUTOFILL_REVOKED_MESSAGE,
          code: ADMIN_AUTOFILL_REVOKED_CODE,
          invalidCount: enforcement.invalidCount
        })
      }
      return res.json({
        isValid: false,
        reason: result.reason || '',
        invalidCount: enforcement.invalidCount
      })
    }
    return res.json({ isValid: true, reason: result.reason || '' })
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
  const created = findRawConjugationById(result.lastInsertRowid)
  recordHistoryFromRequest(req, 'lexicon', {
    history_type: 'lexicon',
    target_id: Number(result.lastInsertRowid),
    action_type: 'create_conjugation',
    after_data: created
  })
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
  const existing = findRawConjugationById(id)
  if (!existing) return res.status(404).json({ error: '记录不存在' })
  const { tense, mood, person, conjugated_form, is_irregular } = req.body || {}
  const stmt = vocabularyDb.prepare('UPDATE conjugations SET tense = ?, mood = ?, person = ?, conjugated_form = ?, is_irregular = ? WHERE id = ?')
  stmt.run(tense || existing.tense, mood || existing.mood, person || existing.person, conjugated_form || existing.conjugated_form, is_irregular ?? existing.is_irregular, id)
  const updated = findRawConjugationById(id)
  const diff = buildHistoryDiff(existing, updated, CONJUGATION_HISTORY_FIELDS)
  if (diff.changedFields.length > 0) {
    recordHistoryFromRequest(req, 'lexicon', {
      history_type: 'lexicon',
      target_id: Number(id),
      action_type: 'update_conjugation',
      changed_fields: diff.changedFields,
      before_data: existing,
      after_data: updated
    })
  }
  res.json({ success: true })
})

// 删除变位
router.delete('/conjugations/:id', requireAdmin, (req, res) => {
  const existing = findRawConjugationById(req.params.id)
  if (!existing) return res.status(404).json({ error: '记录不存在' })
  vocabularyDb.prepare('DELETE FROM conjugations WHERE id = ?').run(req.params.id)
  recordHistoryFromRequest(req, 'lexicon', {
    history_type: 'lexicon',
    target_id: Number(existing.id),
    action_type: 'delete_conjugation',
    snapshot_data: existing
  })
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
    const createdVerb = VerbAdmin.findById(id)
    recordHistoryFromRequest(req, 'lexicon', {
      history_type: 'lexicon',
      target_id: Number(id),
      action_type: 'create_verb',
      after_data: {
        infinitive: createdVerb?.infinitive || data.infinitive
      }
    })
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
  const updated = VerbAdmin.findById(id)
  const diff = buildHistoryDiff(existing, updated, VERB_HISTORY_FIELDS)
  if (diff.changedFields.length > 0) {
    recordHistoryFromRequest(req, 'lexicon', {
      history_type: 'lexicon',
      target_id: Number(id),
      action_type: 'update_verb',
      changed_fields: diff.changedFields,
      before_data: diff.beforeData,
      after_data: diff.afterData
    })
  }
  res.json({ success: true })
})

router.delete('/verbs/:id', requireAdmin, (req, res) => {
  if (!isDev(req)) return forbid(res, '仅 dev 可删除动词')
  const snapshot = buildVerbDeleteSnapshot(req.params.id)
  if (!snapshot) return res.status(404).json({ error: '记录不存在' })
  vocabularyDb.prepare('DELETE FROM verbs WHERE id = ?').run(req.params.id)
  recordHistoryFromRequest(req, 'lexicon', {
    history_type: 'lexicon',
    target_id: Number(req.params.id),
    action_type: 'delete_verb',
    snapshot_data: snapshot
  })
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
  const updated = Question.findPublicById(req.params.id, targetSource)
  const questionDiff = buildHistoryDiff(
    item,
    updated,
    getQuestionHistoryTypeFromSource(targetSource) === 'question_pronoun'
      ? QUESTION_PRONOUN_HISTORY_FIELDS
      : QUESTION_TRADITIONAL_HISTORY_FIELDS
  )
  if (questionDiff.changedFields.length > 0) {
    recordHistoryFromRequest(req, 'question', {
      history_type: getQuestionHistoryTypeFromSource(targetSource),
      target_id: Number(req.params.id),
      action_type: 'update_question',
      changed_fields: questionDiff.changedFields,
      before_data: questionDiff.beforeData,
      after_data: questionDiff.afterData
    })
  }
  res.json({ success: true })
})

router.delete('/questions/:id', requireAdmin, (req, res) => {
  if (!isDev(req)) return forbid(res, '仅 dev 可删除题库内容')
  const source = req.query.source ? String(req.query.source).trim() : null
  const item = Question.findPublicById(req.params.id, source)
  if (!item) return res.status(404).json({ error: '记录不存在' })
  Question.deletePublic(req.params.id, source)
  recordHistoryFromRequest(req, 'question', {
    history_type: getQuestionHistoryTypeFromSource(item.public_question_source || source),
    target_id: Number(req.params.id),
    action_type: 'delete_question',
    snapshot_data: item
  })
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
  if (!isDev(req)) return forbid(res, '仅 dev 可删除题库')
  QuestionBank.delete(req.params.id)
  res.json({ success: true })
})

router.get('/logs', requireAdmin, (req, res) => {
  if (!isStrictDev(req)) return forbid(res, '仅 dev 可查看日志')
  const { keyword, start, end } = req.query
  const limit = Number(req.query.limit || 50)
  const offset = Number(req.query.offset || 0)
  const logs = AdminLog.list({ keyword, start, end, limit, offset })
  res.json(logs)
})

router.get('/practice-records', requireAdmin, (req, res) => {
  if (!isStrictDev(req)) return forbid(res, '仅 dev 可以查看用户数据')
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
  if (!isStrictDev(req)) return forbid(res, '仅 dev 可以查看用户数据')
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
  if (!isStrictDev(req)) return forbid(res, '仅 dev 可查看可备份文件')
  const files = getAllowedFiles().map(({ key, label, fileName }) => ({
    key,
    label,
    fileName
  }))
  res.json({ files })
})

router.get('/db-backups', requireAdmin, (req, res) => {
  if (!isStrictDev(req)) return forbid(res, '仅 dev 可查看备份记录')
  const records = loadRecords(BACKUP_RECORDS_FILE)
  res.json({ records })
})

router.post('/db-backups', requireAdmin, (req, res) => {
  if (!isStrictDev(req)) return forbid(res, '仅 dev 可新增备份')
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
  if (!isStrictDev(req)) return forbid(res, '仅 dev 可删除备份记录')
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
  if (!isStrictDev(req)) return forbid(res, '仅 dev 可下载备份')
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
  if (!isStrictDev(req)) return forbid(res, '仅 dev 可下载备份')
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
  if (!isStrictDev(req)) return forbid(res, '仅 dev 可还原备份')
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
  if (!isStrictDev(req)) return forbid(res, '仅 dev 可查看导入记录')
  const records = loadRecords(IMPORT_RECORDS_FILE)
  res.json({ records })
})

router.delete('/db-imports/:id', requireAdmin, (req, res) => {
  if (!isStrictDev(req)) return forbid(res, '仅 dev 可删除导入记录')
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
    if (!isStrictDev(req)) {
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
