const { userDb, questionDb, vocabularyDb } = require('../database/db')

const PUBLIC_SOURCE_TRADITIONAL = 'public_traditional'
const PUBLIC_SOURCE_PRONOUN = 'public_pronoun'
const PRIVATE_SOURCE = 'private'

const QUESTION_BANK_TRADITIONAL = 'traditional'
const QUESTION_BANK_PRONOUN = 'pronoun'

const PUBLIC_TABLES = {
  [PUBLIC_SOURCE_TRADITIONAL]: 'public_traditional_conjugation',
  [PUBLIC_SOURCE_PRONOUN]: 'public_conjugation_with_pronoun'
}

const TENSE_MAP = {
  presente: '现在时',
  preterito: '简单过去时',
  futuro: '将来时',
  imperfecto: '过去未完成时',
  condicional: '条件式',
  subjuntivo_presente: '虚拟现在时',
  subjuntivo_imperfecto: '虚拟过去时',
  subjuntivo_futuro: '虚拟将来未完成时',
  imperativo_afirmativo: '肯定命令式',
  imperativo_negativo: '否定命令式',
  perfecto: '现在完成时',
  pluscuamperfecto: '过去完成时',
  futuro_perfecto: '将来完成时',
  condicional_perfecto: '条件完成时',
  preterito_anterior: '前过去时',
  subjuntivo_perfecto: '虚拟现在完成时',
  subjuntivo_pluscuamperfecto: '虚拟过去完成时',
  subjuntivo_futuro_perfecto: '虚拟将来完成时'
}

const MOOD_MAP = {
  indicativo: '陈述式',
  subjuntivo: '虚拟式',
  imperativo: '命令式',
  indicativo_compuesto: '复合陈述式',
  subjuntivo_compuesto: '复合虚拟式'
}

const CONJ_FORM_TO_HOST_FORM = {
  general: 'finite',
  imperative: 'imperative',
  infinitive: 'infinitive',
  gerund: 'gerund',
  reflexive: 'prnl'
}

function tableExists(dbInstance, tableName) {
  const row = dbInstance.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table' AND name = ?
  `).get(tableName)
  return !!row
}

function isPersonAllowed(person, includeVos = false, includeVosotros = true) {
  if (!person) return true

  if (!includeVos && person === 'vos') {
    return false
  }

  if (!includeVosotros && (person === 'vosotros' || person === 'vosotras' || person === 'vosotros/vosotras')) {
    return false
  }

  return true
}

function normalizePublicSource(source, fallback = PUBLIC_SOURCE_TRADITIONAL) {
  if (!source) return fallback
  const value = String(source).trim().toLowerCase()
  if (value === PUBLIC_SOURCE_TRADITIONAL || value === 'traditional') return PUBLIC_SOURCE_TRADITIONAL
  if (value === PUBLIC_SOURCE_PRONOUN || value === 'pronoun') return PUBLIC_SOURCE_PRONOUN
  if (value === 'public') return fallback
  return fallback
}

function normalizeQuestionSource(questionSource, fallbackPublicSource = PUBLIC_SOURCE_TRADITIONAL) {
  if (!questionSource) return fallbackPublicSource
  const value = String(questionSource).trim().toLowerCase()
  if (value === PRIVATE_SOURCE) return PRIVATE_SOURCE
  if (value === 'public') return fallbackPublicSource
  if (value === PUBLIC_SOURCE_TRADITIONAL || value === 'traditional') return PUBLIC_SOURCE_TRADITIONAL
  if (value === PUBLIC_SOURCE_PRONOUN || value === 'pronoun') return PUBLIC_SOURCE_PRONOUN
  return fallbackPublicSource
}

function normalizeQuestionBank(bank, fallback = QUESTION_BANK_TRADITIONAL) {
  if (!bank) return fallback
  const value = String(bank).trim().toLowerCase()
  if (value === QUESTION_BANK_TRADITIONAL) return QUESTION_BANK_TRADITIONAL
  if (value === QUESTION_BANK_PRONOUN) return QUESTION_BANK_PRONOUN
  return fallback
}

function getPublicSourceByQuestionBank(questionBank) {
  const normalizedBank = normalizeQuestionBank(questionBank)
  return normalizedBank === QUESTION_BANK_PRONOUN
    ? PUBLIC_SOURCE_PRONOUN
    : PUBLIC_SOURCE_TRADITIONAL
}

function getQuestionBankByPublicSource(source) {
  const normalizedSource = normalizePublicSource(source)
  return normalizedSource === PUBLIC_SOURCE_PRONOUN
    ? QUESTION_BANK_PRONOUN
    : QUESTION_BANK_TRADITIONAL
}

function getPublicTableBySource(source) {
  const normalized = normalizePublicSource(source)
  return PUBLIC_TABLES[normalized]
}

function toRecordType(questionSource) {
  const normalized = normalizeQuestionSource(questionSource)
  if (normalized === PRIVATE_SOURCE) return PRIVATE_SOURCE
  return normalizePublicSource(normalized)
}

function normalizeConjugationFormsToHostForms(conjugationForms = []) {
  if (!Array.isArray(conjugationForms) || conjugationForms.length === 0) return []
  const result = []
  conjugationForms.forEach((form) => {
    const normalized = String(form || '').trim().toLowerCase()
    const mapped = CONJ_FORM_TO_HOST_FORM[normalized]
    if (mapped && !result.includes(mapped)) {
      result.push(mapped)
    }
  })
  return result
}

function normalizePronounPatterns(patterns = []) {
  if (!Array.isArray(patterns) || patterns.length === 0) return []
  const allowed = new Set(['DO', 'IO', 'DO_IO'])
  const result = []
  patterns.forEach((pattern) => {
    const normalized = String(pattern || '').trim().toUpperCase()
    if (allowed.has(normalized) && !result.includes(normalized)) {
      result.push(normalized)
    }
  })
  return result
}

function attachVerbInfo(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows

  const verbIds = [...new Set(rows.map(row => row.verb_id).filter(Boolean))]
  if (verbIds.length === 0) {
    return rows.map(row => ({ ...row }))
  }

  const placeholders = verbIds.map(() => '?').join(',')
  const verbs = vocabularyDb.prepare(`
    SELECT *
    FROM verbs
    WHERE id IN (${placeholders})
  `).all(...verbIds)

  const verbMap = {}
  verbs.forEach((verb) => {
    verbMap[verb.id] = verb
  })

  return rows.map((row) => {
    const verb = verbMap[row.verb_id]
    if (!verb) return { ...row }
    return {
      ...row,
      infinitive: verb.infinitive,
      meaning: verb.meaning,
      conjugation_type: verb.conjugation_type,
      is_irregular: verb.is_irregular,
      is_reflexive: verb.is_reflexive,
      has_tr_use: verb.has_tr_use,
      has_intr_use: verb.has_intr_use
    }
  })
}

function sortRows(rows, sortBy, sortOrder) {
  const direction = sortOrder === 'asc' ? 1 : -1
  const numericFields = new Set(['id', 'verb_id', 'confidence_score'])
  const dateFields = new Set(['created_at'])

  return rows.sort((a, b) => {
    let valueA = sortBy === 'infinitive' ? a.infinitive : a[sortBy]
    let valueB = sortBy === 'infinitive' ? b.infinitive : b[sortBy]

    if (numericFields.has(sortBy)) {
      valueA = Number(valueA || 0)
      valueB = Number(valueB || 0)
      return (valueA - valueB) * direction
    }

    if (dateFields.has(sortBy)) {
      const dateA = valueA ? new Date(String(valueA).replace(' ', 'T')).getTime() : 0
      const dateB = valueB ? new Date(String(valueB).replace(' ', 'T')).getTime() : 0
      return (dateA - dateB) * direction
    }

    const textA = valueA ? String(valueA) : ''
    const textB = valueB ? String(valueB) : ''
    return textA.localeCompare(textB, 'es', { sensitivity: 'base' }) * direction
  })
}

function buildTraditionalWhereClause(filters = {}) {
  const {
    tenses = [],
    moods = [],
    verbIds = null,
    includeVos = false,
    includeVosotros = true
  } = filters

  let query = ' WHERE 1=1'
  const params = []

  if (Array.isArray(tenses) && tenses.length > 0) {
    const chineseTenses = tenses.map(t => TENSE_MAP[t]).filter(Boolean)
    if (chineseTenses.length > 0) {
      const placeholders = chineseTenses.map(() => '?').join(',')
      query += ` AND tense IN (${placeholders})`
      params.push(...chineseTenses)
    }
  }

  if (Array.isArray(moods) && moods.length > 0) {
    const chineseMoods = moods.map(m => MOOD_MAP[m]).filter(Boolean)
    if (chineseMoods.length > 0) {
      const placeholders = chineseMoods.map(() => '?').join(',')
      query += ` AND mood IN (${placeholders})`
      params.push(...chineseMoods)
    }
  }

  if (verbIds && Array.isArray(verbIds) && verbIds.length > 0) {
    const placeholders = verbIds.map(() => '?').join(',')
    query += ` AND verb_id IN (${placeholders})`
    params.push(...verbIds)
  }

  return {
    query,
    params,
    includeVos,
    includeVosotros
  }
}

function buildPronounWhereClause(filters = {}) {
  const {
    hostForms = [],
    conjugationForms = [],
    pronounPatterns = [],
    verbIds = null,
    includeVos = false,
    includeVosotros = true
  } = filters

  let query = ' WHERE 1=1'
  const params = []

  const normalizedHostForms = Array.isArray(hostForms) && hostForms.length > 0
    ? hostForms
    : normalizeConjugationFormsToHostForms(conjugationForms)

  if (normalizedHostForms.length > 0) {
    const placeholders = normalizedHostForms.map(() => '?').join(',')
    query += ` AND host_form IN (${placeholders})`
    params.push(...normalizedHostForms)
  }

  const normalizedPatterns = normalizePronounPatterns(pronounPatterns)
  if (normalizedPatterns.length > 0) {
    const placeholders = normalizedPatterns.map(() => '?').join(',')
    query += ` AND pronoun_pattern IN (${placeholders})`
    params.push(...normalizedPatterns)
  }

  if (verbIds && Array.isArray(verbIds) && verbIds.length > 0) {
    const placeholders = verbIds.map(() => '?').join(',')
    query += ` AND verb_id IN (${placeholders})`
    params.push(...verbIds)
  }

  return {
    query,
    params,
    includeVos,
    includeVosotros
  }
}

function enrichPublicRows(rows, source) {
  const bank = getQuestionBankByPublicSource(source)
  return rows.map(row => ({
    ...row,
    question_type: 'sentence',
    question_bank: bank,
    public_question_source: normalizePublicSource(source)
  }))
}

function resolvePublicLocationById(id, preferredSource = null) {
  const preferred = preferredSource
    ? normalizePublicSource(preferredSource, null)
    : null

  if (preferred) {
    const table = getPublicTableBySource(preferred)
    const row = questionDb.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id)
    if (row) {
      return { source: preferred, table, row }
    }
  }

  for (const source of [PUBLIC_SOURCE_TRADITIONAL, PUBLIC_SOURCE_PRONOUN]) {
    const table = getPublicTableBySource(source)
    const row = questionDb.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id)
    if (row) {
      return { source, table, row }
    }
  }

  return null
}

class Question {
  static normalizePublicSource(source, fallback = PUBLIC_SOURCE_TRADITIONAL) {
    return normalizePublicSource(source, fallback)
  }

  static normalizeQuestionSource(source, fallbackPublicSource = PUBLIC_SOURCE_TRADITIONAL) {
    return normalizeQuestionSource(source, fallbackPublicSource)
  }

  static isPublicSource(source) {
    const normalized = normalizeQuestionSource(source, null)
    return normalized === PUBLIC_SOURCE_TRADITIONAL || normalized === PUBLIC_SOURCE_PRONOUN
  }

  static addToPublic(questionData) {
    const questionBank = normalizeQuestionBank(
      questionData.questionBank,
      questionData.hostForm ? QUESTION_BANK_PRONOUN : QUESTION_BANK_TRADITIONAL
    )
    const source = normalizePublicSource(
      questionData.publicQuestionSource || questionData.questionSource || getPublicSourceByQuestionBank(questionBank)
    )

    if (source === PUBLIC_SOURCE_PRONOUN) {
      const stmt = questionDb.prepare(`
        INSERT INTO public_conjugation_with_pronoun (
          verb_id,
          host_form,
          host_form_zh,
          pronoun_pattern,
          question_text,
          correct_answer,
          example_sentence,
          translation,
          hint,
          tense,
          mood,
          person,
          io_pronoun,
          do_pronoun,
          confidence_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      const result = stmt.run(
        questionData.verbId,
        questionData.hostForm || 'finite',
        questionData.hostFormZh || '',
        questionData.pronounPattern || null,
        questionData.questionText,
        questionData.correctAnswer,
        questionData.exampleSentence || null,
        questionData.translation || null,
        questionData.hint || null,
        questionData.tense || '不适用',
        questionData.mood || '不适用',
        questionData.person || '不适用',
        questionData.ioPronoun || null,
        questionData.doPronoun || null,
        questionData.confidenceScore ?? 50
      )
      return result.lastInsertRowid
    }

    const stmt = questionDb.prepare(`
      INSERT INTO public_traditional_conjugation (
        verb_id,
        question_text,
        correct_answer,
        example_sentence,
        translation,
        hint,
        tense,
        mood,
        person,
        confidence_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const result = stmt.run(
      questionData.verbId,
      questionData.questionText,
      questionData.correctAnswer,
      questionData.exampleSentence || null,
      questionData.translation || null,
      questionData.hint || null,
      questionData.tense,
      questionData.mood,
      questionData.person,
      questionData.confidenceScore ?? 50
    )
    return result.lastInsertRowid
  }

  static getSmartFromPublic(userId, filters = {}, limit = 1) {
    const questionBank = normalizeQuestionBank(filters.questionBank)
    const source = normalizePublicSource(
      filters.publicQuestionSource || filters.questionSource || getPublicSourceByQuestionBank(questionBank)
    )
    const table = getPublicTableBySource(source)
    const recordType = toRecordType(source)

    const where = source === PUBLIC_SOURCE_PRONOUN
      ? buildPronounWhereClause(filters)
      : buildTraditionalWhereClause(filters)

    const query = `SELECT * FROM ${table}${where.query} ORDER BY RANDOM() LIMIT ?`
    const candidateLimit = Math.max(limit * 3, limit)
    const allCandidates = questionDb.prepare(query).all(...where.params, candidateLimit)
    const filteredCandidates = allCandidates.filter(q => isPersonAllowed(q.person, where.includeVos, where.includeVosotros))

    if (filteredCandidates.length === 0) {
      return []
    }

    const questionIds = filteredCandidates.map(q => q.id)
    const placeholders = questionIds.map(() => '?').join(',')
    const records = userDb.prepare(`
      SELECT question_id, practice_count, rating
      FROM user_question_records
      WHERE user_id = ? AND question_type = ? AND question_id IN (${placeholders})
    `).all(userId, recordType, ...questionIds)

    const recordMap = {}
    records.forEach((record) => {
      recordMap[record.question_id] = record
    })

    const scored = filteredCandidates.map((question) => {
      const record = recordMap[question.id] || { practice_count: 0, rating: 0 }
      const randomValue = Math.floor(Math.random() * 11) - 5
      const ratingBonus = (record.rating || 0) * 10
      const score = (question.confidence_score || 50) - 5 * (record.practice_count || 0) + randomValue + ratingBonus
      return {
        ...question,
        _score: score
      }
    })

    scored.sort((a, b) => b._score - a._score)
    const selected = scored.slice(0, Math.min(limit, scored.length)).map((row) => {
      const copied = { ...row }
      delete copied._score
      return copied
    })

    return attachVerbInfo(enrichPublicRows(selected, source))
  }

  static getRandomFromPublic(filters = {}) {
    const questionBank = normalizeQuestionBank(filters.questionBank)
    const source = normalizePublicSource(
      filters.publicQuestionSource || filters.questionSource || getPublicSourceByQuestionBank(questionBank)
    )
    const table = getPublicTableBySource(source)
    const limit = Number(filters.limit) > 0 ? Number(filters.limit) : 1

    const where = source === PUBLIC_SOURCE_PRONOUN
      ? buildPronounWhereClause(filters)
      : buildTraditionalWhereClause(filters)

    const query = `SELECT * FROM ${table}${where.query} ORDER BY RANDOM() LIMIT ?`
    const rows = questionDb.prepare(query).all(...where.params, limit)
      .filter(row => isPersonAllowed(row.person, where.includeVos, where.includeVosotros))

    const normalizedRows = attachVerbInfo(enrichPublicRows(rows, source))
    return limit === 1 ? normalizedRows[0] || null : normalizedRows
  }

  static listPublic({
    limit = 50,
    offset = 0,
    keyword = '',
    sortBy = 'created_at',
    sortOrder = 'desc',
    questionBank = ''
  } = {}) {
    const banks = []
    const normalizedBank = questionBank ? normalizeQuestionBank(questionBank, null) : null
    if (normalizedBank === QUESTION_BANK_TRADITIONAL) {
      banks.push(QUESTION_BANK_TRADITIONAL)
    } else if (normalizedBank === QUESTION_BANK_PRONOUN) {
      banks.push(QUESTION_BANK_PRONOUN)
    } else {
      banks.push(QUESTION_BANK_TRADITIONAL, QUESTION_BANK_PRONOUN)
    }

    const like = keyword ? `%${keyword}%` : null
    const rows = []
    const verbIdsFromKeyword = keyword
      ? vocabularyDb.prepare('SELECT id FROM verbs WHERE infinitive LIKE ?').all(like).map(item => item.id)
      : []

    banks.forEach((bank) => {
      const source = getPublicSourceByQuestionBank(bank)
      const table = getPublicTableBySource(source)
      if (!tableExists(questionDb, table)) return

      let query = `SELECT * FROM ${table} WHERE 1=1`
      const params = []

      if (keyword) {
        const conditions = [
          'question_text LIKE ?',
          'correct_answer LIKE ?',
          'example_sentence LIKE ?',
          'translation LIKE ?',
          'hint LIKE ?',
          'tense LIKE ?',
          'mood LIKE ?',
          'person LIKE ?',
          'CAST(id AS TEXT) LIKE ?'
        ]
        params.push(like, like, like, like, like, like, like, like, like)

        if (bank === QUESTION_BANK_PRONOUN) {
          conditions.push('host_form LIKE ?')
          conditions.push('host_form_zh LIKE ?')
          conditions.push('pronoun_pattern LIKE ?')
          conditions.push('io_pronoun LIKE ?')
          conditions.push('do_pronoun LIKE ?')
          params.push(like, like, like, like, like)
        }

        if (verbIdsFromKeyword.length > 0) {
          const placeholders = verbIdsFromKeyword.map(() => '?').join(',')
          conditions.push(`verb_id IN (${placeholders})`)
          params.push(...verbIdsFromKeyword)
        }

        query += ` AND (${conditions.join(' OR ')})`
      }

      const tableRows = questionDb.prepare(query).all(...params)
      rows.push(...enrichPublicRows(tableRows, source))
    })

    let normalizedRows = attachVerbInfo(rows)
    const allowedSort = new Set([
      'id',
      'verb_id',
      'infinitive',
      'question_text',
      'translation',
      'tense',
      'mood',
      'person',
      'confidence_score',
      'created_at'
    ])
    const safeSortBy = allowedSort.has(sortBy) ? sortBy : 'created_at'
    const safeSortOrder = sortOrder === 'asc' ? 'asc' : 'desc'
    normalizedRows = sortRows(normalizedRows, safeSortBy, safeSortOrder)

    const total = normalizedRows.length
    const pagedRows = normalizedRows.slice(offset, offset + limit)
    return { rows: pagedRows, total }
  }

  static findPublicById(id, source = null) {
    const location = resolvePublicLocationById(id, source)
    if (!location) return null
    const enriched = attachVerbInfo(enrichPublicRows([location.row], location.source))
    return enriched[0] || null
  }

  static updatePublic(id, data, source = null) {
    const location = resolvePublicLocationById(id, source)
    if (!location) return null

    if (location.source === PUBLIC_SOURCE_PRONOUN) {
      const stmt = questionDb.prepare(`
        UPDATE public_conjugation_with_pronoun
        SET
          verb_id = ?,
          host_form = ?,
          host_form_zh = ?,
          pronoun_pattern = ?,
          question_text = ?,
          correct_answer = ?,
          example_sentence = ?,
          translation = ?,
          hint = ?,
          tense = ?,
          mood = ?,
          person = ?,
          io_pronoun = ?,
          do_pronoun = ?,
          confidence_score = ?
        WHERE id = ?
      `)
      return stmt.run(
        data.verb_id,
        data.host_form,
        data.host_form_zh,
        data.pronoun_pattern || null,
        data.question_text,
        data.correct_answer,
        data.example_sentence || null,
        data.translation || null,
        data.hint || null,
        data.tense || '不适用',
        data.mood || '不适用',
        data.person || '不适用',
        data.io_pronoun || null,
        data.do_pronoun || null,
        data.confidence_score ?? 50,
        id
      )
    }

    const stmt = questionDb.prepare(`
      UPDATE public_traditional_conjugation
      SET
        verb_id = ?,
        question_text = ?,
        correct_answer = ?,
        example_sentence = ?,
        translation = ?,
        hint = ?,
        tense = ?,
        mood = ?,
        person = ?,
        confidence_score = ?
      WHERE id = ?
    `)
    return stmt.run(
      data.verb_id,
      data.question_text,
      data.correct_answer,
      data.example_sentence || null,
      data.translation || null,
      data.hint || null,
      data.tense,
      data.mood,
      data.person,
      data.confidence_score ?? 50,
      id
    )
  }

  static deletePublic(id, source = null) {
    const location = resolvePublicLocationById(id, source)
    if (!location) return { changes: 0 }
    return questionDb.prepare(`DELETE FROM ${location.table} WHERE id = ?`).run(id)
  }

  static updateConfidence(questionId, delta, source = null) {
    const questionSource = normalizeQuestionSource(source, null)
    if (questionSource === PUBLIC_SOURCE_TRADITIONAL || questionSource === PUBLIC_SOURCE_PRONOUN) {
      const table = getPublicTableBySource(questionSource)
      const result = questionDb.prepare(`
        UPDATE ${table}
        SET confidence_score = MIN(100, MAX(0, confidence_score + ?))
        WHERE id = ?
      `).run(delta, questionId)
      return result.changes > 0
    }

    const location = resolvePublicLocationById(questionId, null)
    if (!location) return false
    const result = questionDb.prepare(`
      UPDATE ${location.table}
      SET confidence_score = MIN(100, MAX(0, confidence_score + ?))
      WHERE id = ?
    `).run(delta, questionId)
    return result.changes > 0
  }

  static findByVerbAndText(verbId, questionText, source = PUBLIC_SOURCE_TRADITIONAL) {
    const table = getPublicTableBySource(source)
    return questionDb.prepare(`
      SELECT *
      FROM ${table}
      WHERE verb_id = ? AND question_text = ?
      LIMIT 1
    `).get(verbId, questionText)
  }

  static deleteOldPublicQuestions(daysOld = 30) {
    const traditionalDeleted = questionDb.prepare(`
      DELETE FROM public_traditional_conjugation
      WHERE datetime(created_at) <= datetime('now', '-' || ? || ' days')
    `).run(daysOld).changes

    const pronounDeleted = questionDb.prepare(`
      DELETE FROM public_conjugation_with_pronoun
      WHERE datetime(created_at) <= datetime('now', '-' || ? || ' days')
    `).run(daysOld).changes

    return traditionalDeleted + pronounDeleted
  }

  static getPublicCount(filters = {}) {
    const questionBank = filters.questionBank ? normalizeQuestionBank(filters.questionBank, null) : null
    if (questionBank === QUESTION_BANK_TRADITIONAL) {
      return questionDb.prepare('SELECT COUNT(*) AS count FROM public_traditional_conjugation').get().count
    }
    if (questionBank === QUESTION_BANK_PRONOUN) {
      return questionDb.prepare('SELECT COUNT(*) AS count FROM public_conjugation_with_pronoun').get().count
    }
    const traditional = questionDb.prepare('SELECT COUNT(*) AS count FROM public_traditional_conjugation').get().count
    const pronoun = questionDb.prepare('SELECT COUNT(*) AS count FROM public_conjugation_with_pronoun').get().count
    return traditional + pronoun
  }

  static addToPrivate(userId, questionData) {
    const {
      verbId,
      questionType,
      questionText,
      correctAnswer,
      exampleSentence,
      translation,
      hint,
      tense,
      mood,
      person,
      publicQuestionId,
      publicQuestionSource,
      questionBank,
      hostForm,
      hostFormZh,
      pronounPattern,
      ioPronoun,
      doPronoun
    } = questionData

    const normalizedBank = normalizeQuestionBank(
      questionBank,
      hostForm ? QUESTION_BANK_PRONOUN : QUESTION_BANK_TRADITIONAL
    )
    const normalizedPublicSource = publicQuestionSource
      ? normalizePublicSource(publicQuestionSource)
      : null

    const existing = userDb.prepare(`
      SELECT id
      FROM private_questions
      WHERE user_id = ? AND verb_id = ? AND question_type = ? AND question_bank = ? AND question_text = ?
      LIMIT 1
    `).get(userId, verbId, questionType, normalizedBank, questionText)

    if (existing) {
      return existing.id
    }

    const stmt = userDb.prepare(`
      INSERT INTO private_questions (
        user_id,
        verb_id,
        question_type,
        question_bank,
        question_text,
        correct_answer,
        example_sentence,
        translation,
        hint,
        tense,
        mood,
        person,
        public_question_id,
        public_question_source,
        host_form,
        host_form_zh,
        pronoun_pattern,
        io_pronoun,
        do_pronoun
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const result = stmt.run(
      userId,
      verbId,
      questionType,
      normalizedBank,
      questionText,
      correctAnswer,
      exampleSentence || null,
      translation || null,
      hint || null,
      tense || '不适用',
      mood || '不适用',
      person || '不适用',
      publicQuestionId || null,
      normalizedPublicSource,
      hostForm || null,
      hostFormZh || null,
      pronounPattern || null,
      ioPronoun || null,
      doPronoun || null
    )

    return result.lastInsertRowid
  }

  static removeFromPrivate(userId, questionId) {
    const question = userDb.prepare(`
      SELECT public_question_id, public_question_source
      FROM private_questions
      WHERE id = ? AND user_id = ?
    `).get(questionId, userId)

    const result = userDb.prepare(`
      DELETE FROM private_questions
      WHERE id = ? AND user_id = ?
    `).run(questionId, userId)

    return {
      removed: result.changes > 0,
      publicQuestionId: question ? question.public_question_id : null,
      publicQuestionSource: question ? question.public_question_source : null
    }
  }

  static getPrivateByUser(userId, filters = {}) {
    const { questionType, questionBank } = filters
    let query = 'SELECT * FROM private_questions WHERE user_id = ?'
    const params = [userId]

    if (questionType) {
      query += ' AND question_type = ?'
      params.push(questionType)
    }

    if (questionBank) {
      query += ' AND question_bank = ?'
      params.push(normalizeQuestionBank(questionBank))
    }

    query += ' ORDER BY created_at DESC'
    const rows = userDb.prepare(query).all(...params)
    return attachVerbInfo(rows)
  }

  static getRandomFromPrivate(userId, filters = {}) {
    const { questionType, limit = 1, questionBank } = filters
    let query = 'SELECT * FROM private_questions WHERE user_id = ?'
    const params = [userId]

    if (questionType) {
      query += ' AND question_type = ?'
      params.push(questionType)
    }

    if (questionBank) {
      query += ' AND question_bank = ?'
      params.push(normalizeQuestionBank(questionBank))
    }

    query += ' ORDER BY RANDOM() LIMIT ?'
    params.push(limit)

    const rows = userDb.prepare(query).all(...params)
    const enrichedRows = attachVerbInfo(rows)
    return limit === 1 ? (enrichedRows[0] || null) : enrichedRows
  }

  static getPrivateCount(userId, filters = {}) {
    const { questionType, questionBank } = filters
    let query = 'SELECT COUNT(*) AS count FROM private_questions WHERE user_id = ?'
    const params = [userId]

    if (questionType) {
      query += ' AND question_type = ?'
      params.push(questionType)
    }

    if (questionBank) {
      query += ' AND question_bank = ?'
      params.push(normalizeQuestionBank(questionBank))
    }

    return userDb.prepare(query).get(...params).count
  }

  static findAnswerById(questionId, source, userId) {
    if (!questionId) return null
    const rawSource = String(source || '').trim().toLowerCase()

    if (rawSource === 'public') {
      const traditional = questionDb.prepare(`
        SELECT correct_answer FROM public_traditional_conjugation WHERE id = ?
      `).get(questionId)
      if (traditional) return traditional.correct_answer
      const pronoun = questionDb.prepare(`
        SELECT correct_answer FROM public_conjugation_with_pronoun WHERE id = ?
      `).get(questionId)
      return pronoun ? pronoun.correct_answer : null
    }

    const normalizedSource = normalizeQuestionSource(source)

    if (normalizedSource === PRIVATE_SOURCE) {
      const question = userDb.prepare(`
        SELECT correct_answer
        FROM private_questions
        WHERE id = ? AND user_id = ?
      `).get(questionId, userId)
      return question ? question.correct_answer : null
    }

    if (normalizedSource === PUBLIC_SOURCE_TRADITIONAL || normalizedSource === PUBLIC_SOURCE_PRONOUN) {
      const table = getPublicTableBySource(normalizedSource)
      const question = questionDb.prepare(`
        SELECT correct_answer
        FROM ${table}
        WHERE id = ?
      `).get(questionId)
      return question ? question.correct_answer : null
    }

    const traditional = questionDb.prepare(`
      SELECT correct_answer FROM public_traditional_conjugation WHERE id = ?
    `).get(questionId)
    if (traditional) return traditional.correct_answer

    const pronoun = questionDb.prepare(`
      SELECT correct_answer FROM public_conjugation_with_pronoun WHERE id = ?
    `).get(questionId)
    return pronoun ? pronoun.correct_answer : null
  }

  static recordPractice(userId, questionId, questionType, isCorrect) {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hour = String(now.getHours()).padStart(2, '0')
    const minute = String(now.getMinutes()).padStart(2, '0')
    const second = String(now.getSeconds()).padStart(2, '0')
    const lastPracticedAt = `${year}-${month}-${day} ${hour}:${minute}:${second}`
    const recordType = toRecordType(questionType)

    const stmt = userDb.prepare(`
      INSERT INTO user_question_records (
        user_id,
        question_id,
        question_type,
        practice_count,
        correct_count,
        last_practiced_at
      )
      VALUES (?, ?, ?, 1, ?, ?)
      ON CONFLICT(user_id, question_id, question_type)
      DO UPDATE SET
        practice_count = practice_count + 1,
        correct_count = correct_count + ?,
        last_practiced_at = ?
    `)

    const correctIncrement = isCorrect ? 1 : 0
    const result = stmt.run(
      userId,
      questionId,
      recordType,
      correctIncrement,
      lastPracticedAt,
      correctIncrement,
      lastPracticedAt
    )
    return result.changes > 0
  }

  static rateQuestion(userId, questionId, questionType, rating) {
    const recordType = toRecordType(questionType)
    const existing = userDb.prepare(`
      SELECT id
      FROM user_question_records
      WHERE user_id = ? AND question_id = ? AND question_type = ?
    `).get(userId, questionId, recordType)

    if (existing) {
      userDb.prepare(`
        UPDATE user_question_records
        SET rating = ?
        WHERE user_id = ? AND question_id = ? AND question_type = ?
      `).run(rating, userId, questionId, recordType)
    } else {
      userDb.prepare(`
        INSERT INTO user_question_records (user_id, question_id, question_type, rating)
        VALUES (?, ?, ?, ?)
      `).run(userId, questionId, recordType, rating)
    }

    if (recordType === PUBLIC_SOURCE_TRADITIONAL || recordType === PUBLIC_SOURCE_PRONOUN) {
      if (rating === 1) {
        this.updateConfidence(questionId, 1, recordType)
      } else if (rating === -1) {
        this.updateConfidence(questionId, -2, recordType)
      }
    }

    return true
  }

  static recordCorrectAnswer(userId, questionId, questionType) {
    return this.recordPractice(userId, questionId, questionType, true)
  }

  static getCorrectCount(userId, questionId, questionType) {
    const recordType = toRecordType(questionType)
    const result = userDb.prepare(`
      SELECT correct_count
      FROM user_question_records
      WHERE user_id = ? AND question_id = ? AND question_type = ?
    `).get(userId, questionId, recordType)
    return result ? result.correct_count : 0
  }

  static deleteOldQuestionRecords(daysOld = 30) {
    const traditionalIds = questionDb.prepare(`
      SELECT id
      FROM public_traditional_conjugation
      WHERE datetime(created_at) <= datetime('now', '-' || ? || ' days')
    `).all(daysOld).map(item => item.id)

    const pronounIds = questionDb.prepare(`
      SELECT id
      FROM public_conjugation_with_pronoun
      WHERE datetime(created_at) <= datetime('now', '-' || ? || ' days')
    `).all(daysOld).map(item => item.id)

    let deleted = 0

    if (traditionalIds.length > 0) {
      const placeholders = traditionalIds.map(() => '?').join(',')
      const result = userDb.prepare(`
        DELETE FROM user_question_records
        WHERE question_type = ? AND question_id IN (${placeholders})
      `).run(PUBLIC_SOURCE_TRADITIONAL, ...traditionalIds)
      deleted += result.changes
    }

    if (pronounIds.length > 0) {
      const placeholders = pronounIds.map(() => '?').join(',')
      const result = userDb.prepare(`
        DELETE FROM user_question_records
        WHERE question_type = ? AND question_id IN (${placeholders})
      `).run(PUBLIC_SOURCE_PRONOUN, ...pronounIds)
      deleted += result.changes
    }

    return deleted
  }

  static existsInPublic(verbId, questionText, source = PUBLIC_SOURCE_TRADITIONAL) {
    const table = getPublicTableBySource(source)
    const result = questionDb.prepare(`
      SELECT id
      FROM ${table}
      WHERE verb_id = ? AND question_text = ?
      LIMIT 1
    `).get(verbId, questionText)
    return !!result
  }
}

module.exports = Question
