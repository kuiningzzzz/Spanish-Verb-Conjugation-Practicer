const { userDb, questionDb, vocabularyDb } = require('../database/db')

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

function attachVerbInfinitives(rows) {
  if (!rows.length) return rows
  const verbIds = [...new Set(rows.map(row => row.verb_id).filter(Boolean))]
  if (!verbIds.length) {
    return rows.map(row => ({ ...row, infinitive: null }))
  }

  const placeholders = verbIds.map(() => '?').join(',')
  const verbs = vocabularyDb.prepare(`
    SELECT id, infinitive FROM verbs WHERE id IN (${placeholders})
  `).all(...verbIds)

  const verbMap = {}
  verbs.forEach(verb => {
    verbMap[verb.id] = verb.infinitive
  })

  return rows.map(row => ({
    ...row,
    infinitive: verbMap[row.verb_id] || null
  }))
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

class Question {
  // ==================== 公共题库操作 ====================
  
  /**
   * 添加题目到公共题库
   */
  static addToPublic(questionData) {
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
      confidenceScore = 50
    } = questionData

    const stmt = questionDb.prepare(`
      INSERT INTO public_questions (
        verb_id, question_type, question_text, correct_answer,
        example_sentence, translation, hint, tense, mood, person, confidence_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const result = stmt.run(
      verbId, questionType, questionText, correctAnswer,
      exampleSentence, translation, hint, tense, mood, person, confidenceScore
    )

    return result.lastInsertRowid
  }

  /**
   * 从公共题库智能获取题目（基于置信度和用户历史）
   * @param {number} userId - 用户ID
   * @param {object} filters - 筛选条件
   * @param {number} limit - 需要的题目数量
   * @returns {Array} 返回排序后的前limit个题目（供题目池使用）
   */
  static getSmartFromPublic(userId, filters = {}, limit = 1) {
    const {
      questionType,
      tenses = [],
      moods = [],
      verbIds = null,
      includeVos = false,
      includeVosotros = true
    } = filters

    // 时态名称映射：前端英文 -> 数据库中文
    const tenseMap = {
      'presente': '现在时',
      'preterito': '简单过去时',
      'futuro': '将来时',
      'imperfecto': '过去未完成时',
      'condicional': '条件式'
    }

    const moodMap = {
      'indicativo': '陈述式',
      'subjuntivo': '虚拟式',
      'imperativo': '命令式',
      'indicativo_compuesto': '复合陈述式',
      'subjuntivo_compuesto': '复合虚拟式'
    }

    // 第一步：从题库中随机选出3倍数量的候选题目
    let query = `SELECT * FROM public_questions WHERE 1=1`
    const params = []

    if (questionType) {
      query += ` AND question_type = ?`
      params.push(questionType)
    }

    if (tenses.length > 0) {
      // 将前端的英文时态名转换为中文
      const chineseTenses = tenses.map(t => tenseMap[t]).filter(Boolean)
      if (chineseTenses.length > 0) {
        const placeholders = chineseTenses.map(() => '?').join(',')
        query += ` AND tense IN (${placeholders})`
        params.push(...chineseTenses)
      }
    }

    if (moods.length > 0) {
      const chineseMoods = moods.map(m => moodMap[m]).filter(Boolean)
      if (chineseMoods.length > 0) {
        const placeholders = chineseMoods.map(() => '?').join(',')
        query += ` AND mood IN (${placeholders})`
        params.push(...chineseMoods)
      }
    }

    // 添加verbIds筛选（用于收藏专练和错题专练）
    if (verbIds && verbIds.length > 0) {
      const placeholders = verbIds.map(() => '?').join(',')
      query += ` AND verb_id IN (${placeholders})`
      params.push(...verbIds)
    }

    query += ` ORDER BY RANDOM() LIMIT ?`
    params.push(limit * 3)

    const stmt = questionDb.prepare(query)
    const allCandidates = stmt.all(...params)
    
    // 去重：如果有重复的题目ID，只保留第一个
    const seenIds = new Set()
    const candidates = allCandidates.filter(q => {
      if (seenIds.has(q.id)) {
        console.warn(`发现重复题目ID: ${q.id}，已过滤`)
        return false
      }
      seenIds.add(q.id)
      return isPersonAllowed(q.person, includeVos, includeVosotros)
    })
    
    console.log(`智能推荐 - 获取候选题目:`, {
      userId,
      questionType,
      limit,
      verbIdsFilter: verbIds?.length || 0,
      totalCandidates: allCandidates.length,
      uniqueCandidates: candidates.length,
      candidateIds: candidates.map(c => c.id)
    })
    
    if (candidates.length === 0) {
      return []
    }

    // 第二步：获取用户对这些题目的练习记录
    const questionIds = candidates.map(q => q.id)
    const placeholders = questionIds.map(() => '?').join(',')
    
    const recordStmt = userDb.prepare(`
      SELECT question_id, practice_count, rating 
      FROM user_question_records
      WHERE user_id = ? AND question_type = 'public' AND question_id IN (${placeholders})
    `)
    const records = recordStmt.all(userId, ...questionIds)
    
    // 创建记录映射
    const recordMap = {}
    records.forEach(r => {
      recordMap[r.question_id] = r
    })

    // 第三步：计算每个题目的排序分数
    // 分数 = 置信度 - 5 * 练习次数 + 随机值(-5到5) + 评价影响
    const scoredQuestions = candidates.map(q => {
      const record = recordMap[q.id] || { practice_count: 0, rating: 0 }
      const randomValue = Math.floor(Math.random() * 11) - 5 // -5 到 5
      const ratingBonus = record.rating * 10 // 好题+10，坏题-10
      const score = q.confidence_score - 5 * record.practice_count + randomValue + ratingBonus
      
      return {
        ...q,
        _score: score,
        _practice_count: record.practice_count
      }
    })

    // 第四步：按分数降序排序，返回前limit个题目
    scoredQuestions.sort((a, b) => b._score - a._score)
    
    // 第四步半：再次去重（防止万一）
    const uniqueScoredQuestions = []
    const finalSeenIds = new Set()
    for (const q of scoredQuestions) {
      if (!finalSeenIds.has(q.id)) {
        finalSeenIds.add(q.id)
        uniqueScoredQuestions.push(q)
      } else {
        console.warn(`排序后发现重复题目ID: ${q.id}，已过滤`)
      }
    }
    
    // 返回前N个结果（供调用方随机抽取）
    const selectedQuestions = uniqueScoredQuestions.slice(0, Math.min(limit, uniqueScoredQuestions.length))

    // 第五步：获取动词信息
    if (selectedQuestions.length > 0) {
      const verbIds = [...new Set(selectedQuestions.map(q => q.verb_id))]
      const verbPlaceholders = verbIds.map(() => '?').join(',')
      const verbStmt = vocabularyDb.prepare(`
        SELECT * FROM verbs WHERE id IN (${verbPlaceholders})
      `)
      const verbs = verbStmt.all(...verbIds)
      const verbMap = {}
      verbs.forEach(v => verbMap[v.id] = v)
      
      selectedQuestions.forEach(q => {
        const verb = verbMap[q.verb_id]
        if (verb) {
          q.infinitive = verb.infinitive
          q.meaning = verb.meaning
          q.conjugation_type = verb.conjugation_type
          q.is_irregular = verb.is_irregular
        }
        // 清理内部属性
        delete q._score
        delete q._practice_count
      })
    }

    console.log(`智能推荐 - 最终返回:`, {
      count: selectedQuestions.length,
      questionIds: selectedQuestions.map(q => q.id),
      hasDuplicateIds: selectedQuestions.length !== new Set(selectedQuestions.map(q => q.id)).size,
      questions: selectedQuestions.map(q => ({
        id: q.id,
        verb: q.infinitive,
        tense: q.tense
      }))
    })

    return selectedQuestions
  }

  /**
   * 从公共题库随机获取题目（旧方法，保留兼容性）
   */
  static getRandomFromPublic(filters = {}) {
    const {
      questionType,
      tenses = [],
      conjugationTypes = [],
      includeRegular = true,
      includeVos = false,
      includeVosotros = true,
      limit = 1
    } = filters

    let query = `SELECT * FROM public_questions WHERE 1=1`
    const params = []

    if (questionType) {
      query += ` AND question_type = ?`
      params.push(questionType)
    }

    if (tenses.length > 0) {
      const placeholders = tenses.map(() => '?').join(',')
      query += ` AND tense IN (${placeholders})`
      params.push(...tenses)
    }

    query += ` ORDER BY RANDOM() LIMIT ?`
    params.push(limit)

    const stmt = questionDb.prepare(query)
    const rawQuestions = limit === 1 ? [stmt.get(...params)].filter(Boolean) : stmt.all(...params)
    const questions = rawQuestions.filter(q => isPersonAllowed(q?.person, includeVos, includeVosotros))
    
    // 如果需要动词信息，从词库数据库获取
    if (questions.length > 0) {
      const verbIds = questions.map(q => q.verb_id)
      const placeholders = verbIds.map(() => '?').join(',')
      const verbStmt = vocabularyDb.prepare(`
        SELECT * FROM verbs WHERE id IN (${placeholders})
      `)
      const verbs = verbStmt.all(...verbIds)
      const verbMap = {}
      verbs.forEach(v => verbMap[v.id] = v)
      
      questions.forEach(q => {
        const verb = verbMap[q.verb_id]
        if (verb) {
          q.infinitive = verb.infinitive
          q.meaning = verb.meaning
          q.conjugation_type = verb.conjugation_type
          q.is_irregular = verb.is_irregular
        }
      })
    }

    return limit === 1 ? questions[0] : questions
  }

  /**
   * 管理后台：分页获取公共题库列表
   */
  static listPublic({ limit = 50, offset = 0, keyword = '', sortBy = 'created_at', sortOrder = 'desc' } = {}) {
    let query = `SELECT * FROM public_questions WHERE 1=1`
    const params = []

    if (keyword) {
      const like = `%${keyword}%`
      const conditions = [
        `question_text LIKE ?`,
        `correct_answer LIKE ?`,
        `example_sentence LIKE ?`,
        `translation LIKE ?`,
        `hint LIKE ?`,
        `tense LIKE ?`,
        `mood LIKE ?`,
        `person LIKE ?`,
        `question_type LIKE ?`,
        `CAST(id AS TEXT) LIKE ?`
      ]

      params.push(like, like, like, like, like, like, like, like, like, like)

      const verbMatches = vocabularyDb.prepare(`
        SELECT id FROM verbs WHERE infinitive LIKE ?
      `).all(like)
      const verbIds = verbMatches.map(match => match.id)

      if (verbIds.length > 0) {
        const placeholders = verbIds.map(() => '?').join(',')
        conditions.push(`verb_id IN (${placeholders})`)
        params.push(...verbIds)
      }

      query += ` AND (${conditions.join(' OR ')})`
    }

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
    const safeOrder = sortOrder === 'asc' ? 'asc' : 'desc'

    let rows = questionDb.prepare(query).all(...params)
    rows = attachVerbInfinitives(rows)
    rows = sortRows(rows, safeSortBy, safeOrder)

    const total = rows.length
    const pagedRows = rows.slice(offset, offset + limit)

    return { rows: pagedRows, total }
  }

  /**
   * 管理后台：获取公共题库详情
   */
  static findPublicById(id) {
    const question = questionDb.prepare('SELECT * FROM public_questions WHERE id = ?').get(id)
    if (!question) return null
    const verb = vocabularyDb.prepare('SELECT id, infinitive FROM verbs WHERE id = ?').get(question.verb_id)
    return {
      ...question,
      infinitive: verb?.infinitive || null
    }
  }

  /**
   * 管理后台：更新公共题库题目
   */
  static updatePublic(id, data) {
    const stmt = questionDb.prepare(`
      UPDATE public_questions
      SET verb_id = ?, question_type = ?, question_text = ?, correct_answer = ?,
          example_sentence = ?, translation = ?, hint = ?, tense = ?, mood = ?, person = ?,
          confidence_score = ?
      WHERE id = ?
    `)
    return stmt.run(
      data.verb_id,
      data.question_type,
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

  /**
   * 管理后台：删除公共题库题目
   */
  static deletePublic(id) {
    return questionDb.prepare('DELETE FROM public_questions WHERE id = ?').run(id)
  }

  /**
   * 更新公共题库题目的置信度
   * @param {number} questionId - 公共题库题目ID
   * @param {number} delta - 置信度变化值（可正可负）
   * @returns {boolean} 是否成功更新
   */
  static updateConfidence(questionId, delta) {
    const stmt = questionDb.prepare(`
      UPDATE public_questions
      SET confidence_score = MIN(100, MAX(0, confidence_score + ?))
      WHERE id = ?
    `)
    const result = stmt.run(delta, questionId)
    const updated = result.changes > 0
    
    if (!updated) {
      console.log(`[警告] 公共题库中不存在ID为 ${questionId} 的题目，无法更新置信度`)
    }
    
    return updated
  }

  /**
   * 根据动词ID和题目文本查找题目
   */
  static findByVerbAndText(verbId, questionText) {
    const stmt = questionDb.prepare(`
      SELECT * FROM public_questions
      WHERE verb_id = ? AND question_text = ?
      LIMIT 1
    `)
    return stmt.get(verbId, questionText)
  }

  /**
   * 删除超过30天的公共题库题目
   */
  static deleteOldPublicQuestions(daysOld = 30) {
    const stmt = questionDb.prepare(`
      DELETE FROM public_questions
      WHERE datetime(created_at) <= datetime('now', '-' || ? || ' days')
    `)
    const result = stmt.run(daysOld)
    return result.changes
  }

  /**
   * 获取公共题库题目总数
   */
  static getPublicCount(filters = {}) {
    const { questionType } = filters
    let query = `SELECT COUNT(*) as count FROM public_questions WHERE 1=1`
    const params = []

    if (questionType) {
      query += ` AND question_type = ?`
      params.push(questionType)
    }

    const stmt = questionDb.prepare(query)
    const result = stmt.get(...params)
    return result.count
  }

  // ==================== 私人题库操作 ====================

  /**
   * 添加题目到私人题库（收藏）
   */
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
      publicQuestionId  // 公共题库ID（如果来自公共题库）
    } = questionData

    // 检查是否已存在
    const existStmt = userDb.prepare(`
      SELECT id FROM private_questions 
      WHERE user_id = ? AND verb_id = ? AND question_type = ? AND question_text = ?
    `)
    const existing = existStmt.get(userId, verbId, questionType, questionText)
    
    if (existing) {
      return existing.id
    }

    const stmt = userDb.prepare(`
      INSERT INTO private_questions (
        user_id, verb_id, question_type, question_text, correct_answer,
        example_sentence, translation, hint, tense, mood, person, public_question_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const result = stmt.run(
      userId, verbId, questionType, questionText, correctAnswer,
      exampleSentence, translation, hint, tense, mood, person, publicQuestionId || null
    )

    return result.lastInsertRowid
  }

  /**
   * 从私人题库删除题目
   * @returns {Object|null} { removed: boolean, publicQuestionId: number|null }
   */
  static removeFromPrivate(userId, questionId) {
    console.log('执行删除操作:', { userId, questionId })
    
    // 先查询是否有关联的公共题库ID
    const queryStmt = userDb.prepare(`
      SELECT public_question_id FROM private_questions
      WHERE id = ? AND user_id = ?
    `)
    const question = queryStmt.get(questionId, userId)
    const publicQuestionId = question ? question.public_question_id : null
    
    // 执行删除
    const deleteStmt = userDb.prepare(`
      DELETE FROM private_questions
      WHERE id = ? AND user_id = ?
    `)
    const result = deleteStmt.run(questionId, userId)
    const removed = result.changes > 0
    
    console.log('SQL执行结果:', { removed, publicQuestionId })
    
    return { removed, publicQuestionId }
  }

  /**
   * 获取用户的私人题库列表
   */
  static getPrivateByUser(userId, filters = {}) {
    const { questionType } = filters
    let query = `SELECT * FROM private_questions WHERE user_id = ?`
    const params = [userId]

    if (questionType) {
      query += ` AND question_type = ?`
      params.push(questionType)
    }

    query += ` ORDER BY created_at DESC`

    const stmt = userDb.prepare(query)
    const questions = stmt.all(...params)
    
    console.log(`获取用户 ${userId} 的私人题库，共 ${questions.length} 道题`)
    if (questions.length > 0) {
      console.log('第一道题的ID:', questions[0].id)
    }
    
    // 获取动词信息
    if (questions.length > 0) {
      const verbIds = [...new Set(questions.map(q => q.verb_id))]
      const placeholders = verbIds.map(() => '?').join(',')
      const verbStmt = vocabularyDb.prepare(`
        SELECT * FROM verbs WHERE id IN (${placeholders})
      `)
      const verbs = verbStmt.all(...verbIds)
      const verbMap = {}
      verbs.forEach(v => verbMap[v.id] = v)
      
      questions.forEach(q => {
        const verb = verbMap[q.verb_id]
        if (verb) {
          q.infinitive = verb.infinitive
          q.meaning = verb.meaning
          q.conjugation_type = verb.conjugation_type
          q.is_irregular = verb.is_irregular
        }
      })
    }

    return questions
  }

  /**
   * 从私人题库随机获取题目
   */
  static getRandomFromPrivate(userId, filters = {}) {
    const { questionType, limit = 1 } = filters

    let query = `SELECT * FROM private_questions WHERE user_id = ?`
    const params = [userId]

    if (questionType) {
      query += ` AND question_type = ?`
      params.push(questionType)
    }

    query += ` ORDER BY RANDOM() LIMIT ?`
    params.push(limit)

    const stmt = userDb.prepare(query)
    const questions = limit === 1 ? [stmt.get(...params)].filter(Boolean) : stmt.all(...params)
    
    // 获取动词信息
    if (questions.length > 0) {
      const verbIds = [...new Set(questions.map(q => q.verb_id))]
      const placeholders = verbIds.map(() => '?').join(',')
      const verbStmt = vocabularyDb.prepare(`
        SELECT * FROM verbs WHERE id IN (${placeholders})
      `)
      const verbs = verbStmt.all(...verbIds)
      const verbMap = {}
      verbs.forEach(v => verbMap[v.id] = v)
      
      questions.forEach(q => {
        const verb = verbMap[q.verb_id]
        if (verb) {
          q.infinitive = verb.infinitive
          q.meaning = verb.meaning
          q.conjugation_type = verb.conjugation_type
          q.is_irregular = verb.is_irregular
        }
      })
    }

    return limit === 1 ? questions[0] : questions
  }

  /**
   * 获取私人题库题目总数
   */
  static getPrivateCount(userId, filters = {}) {
    const { questionType } = filters
    let query = `SELECT COUNT(*) as count FROM private_questions WHERE user_id = ?`
    const params = [userId]

    if (questionType) {
      query += ` AND question_type = ?`
      params.push(questionType)
    }

    const stmt = userDb.prepare(query)
    const result = stmt.get(...params)
    return result.count
  }

  // ==================== 用户答题记录操作 ====================

  /**
   * 记录用户练习题目
   * @param {number} userId - 用户ID
   * @param {number} questionId - 题目ID
   * @param {string} questionType - 题目类型 ('public' 或 'private')
   * @param {boolean} isCorrect - 是否答对
   */
  static recordPractice(userId, questionId, questionType, isCorrect) {
    // 获取当前本地时间
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hour = String(now.getHours()).padStart(2, '0')
    const minute = String(now.getMinutes()).padStart(2, '0')
    const second = String(now.getSeconds()).padStart(2, '0')
    const lastPracticedAt = `${year}-${month}-${day} ${hour}:${minute}:${second}`
    
    const stmt = userDb.prepare(`
      INSERT INTO user_question_records (user_id, question_id, question_type, practice_count, correct_count, last_practiced_at)
      VALUES (?, ?, ?, 1, ?, ?)
      ON CONFLICT(user_id, question_id, question_type) 
      DO UPDATE SET 
        practice_count = practice_count + 1,
        correct_count = correct_count + ?,
        last_practiced_at = ?
    `)
    const correctIncrement = isCorrect ? 1 : 0
    const result = stmt.run(userId, questionId, questionType, correctIncrement, lastPracticedAt, correctIncrement, lastPracticedAt)
    return result.changes > 0
  }

  /**
   * 用户对题目进行评价
   * @param {number} userId - 用户ID
   * @param {number} questionId - 题目ID
   * @param {string} questionType - 题目类型
   * @param {number} rating - 评价 (1=好题, -1=坏题, 0=无评价)
   */
  static rateQuestion(userId, questionId, questionType, rating) {
    // 先检查是否已经练习过这道题
    const checkStmt = userDb.prepare(`
      SELECT id FROM user_question_records
      WHERE user_id = ? AND question_id = ? AND question_type = ?
    `)
    const existing = checkStmt.get(userId, questionId, questionType)
    
    if (existing) {
      // 已存在记录，更新评价
      const updateStmt = userDb.prepare(`
        UPDATE user_question_records
        SET rating = ?
        WHERE user_id = ? AND question_id = ? AND question_type = ?
      `)
      updateStmt.run(rating, userId, questionId, questionType)
    } else {
      // 不存在记录，创建新记录
      const insertStmt = userDb.prepare(`
        INSERT INTO user_question_records (user_id, question_id, question_type, rating)
        VALUES (?, ?, ?, ?)
      `)
      insertStmt.run(userId, questionId, questionType, rating)
    }

    // 如果是公共题库的题目，同时更新题目的置信度
    if (questionType === 'public') {
      if (rating === 1) {
        // 好题：置信度 +1
        const updated = this.updateConfidence(questionId, 1)
        if (!updated) {
          console.log(`[警告] 评价好题时，公共题库题目 ${questionId} 不存在`)
        }
      } else if (rating === -1) {
        // 坏题：置信度 -2
        const updated = this.updateConfidence(questionId, -2)
        if (!updated) {
          console.log(`[警告] 评价坏题时，公共题库题目 ${questionId} 不存在`)
        }
      }
    }

    return true
  }

  /**
   * 记录用户答对题目（旧方法，保留兼容性）
   */
  static recordCorrectAnswer(userId, questionId, questionType) {
    return this.recordPractice(userId, questionId, questionType, true)
  }

  /**
   * 获取用户对某题的答对次数
   */
  static getCorrectCount(userId, questionId, questionType) {
    const stmt = userDb.prepare(`
      SELECT correct_count FROM user_question_records
      WHERE user_id = ? AND question_id = ? AND question_type = ?
    `)
    const result = stmt.get(userId, questionId, questionType)
    return result ? result.correct_count : 0
  }

  /**
   * 删除超过30天公共题目的相关记录
   */
  static deleteOldQuestionRecords(daysOld = 30) {
    // 先从题库数据库获取要删除的题目ID
    const questionStmt = questionDb.prepare(`
      SELECT id FROM public_questions
      WHERE datetime(created_at) <= datetime('now', '-' || ? || ' days')
    `)
    const oldQuestions = questionStmt.all(daysOld)
    
    if (oldQuestions.length === 0) {
      return 0
    }

    const questionIds = oldQuestions.map(q => q.id)
    const placeholders = questionIds.map(() => '?').join(',')
    
    // 从用户数据库删除相关记录
    const stmt = userDb.prepare(`
      DELETE FROM user_question_records
      WHERE question_type = 'public' AND question_id IN (${placeholders})
    `)
    const result = stmt.run(...questionIds)
    return result.changes
  }

  /**
   * 检查题目是否存在于公共题库
   */
  static existsInPublic(verbId, questionText) {
    const stmt = questionDb.prepare(`
      SELECT id FROM public_questions
      WHERE verb_id = ? AND question_text = ?
    `)
    const result = stmt.get(verbId, questionText)
    return !!result
  }
}

module.exports = Question
