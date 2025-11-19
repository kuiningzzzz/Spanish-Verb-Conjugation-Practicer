const { userDb, questionDb, vocabularyDb } = require('../database/db')

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
   * 从公共题库随机获取题目
   */
  static getRandomFromPublic(filters = {}) {
    const { questionType, tenses = [], conjugationTypes = [], includeIrregular = true, limit = 1 } = filters

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
    const questions = limit === 1 ? [stmt.get(...params)].filter(Boolean) : stmt.all(...params)
    
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
   * 更新公共题库题目的置信度
   */
  static updateConfidence(questionId, delta) {
    const stmt = questionDb.prepare(`
      UPDATE public_questions
      SET confidence_score = MIN(100, MAX(0, confidence_score + ?))
      WHERE id = ?
    `)
    const result = stmt.run(delta, questionId)
    return result.changes > 0
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
      person
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
        example_sentence, translation, hint, tense, mood, person
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const result = stmt.run(
      userId, verbId, questionType, questionText, correctAnswer,
      exampleSentence, translation, hint, tense, mood, person
    )

    return result.lastInsertRowid
  }

  /**
   * 从私人题库删除题目
   */
  static removeFromPrivate(userId, questionId) {
    const stmt = userDb.prepare(`
      DELETE FROM private_questions
      WHERE id = ? AND user_id = ?
    `)
    const result = stmt.run(questionId, userId)
    return result.changes > 0
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
   * 记录用户答对题目
   */
  static recordCorrectAnswer(userId, questionId, questionType) {
    const stmt = userDb.prepare(`
      INSERT INTO user_question_records (user_id, question_id, question_type, correct_count, last_practiced_at)
      VALUES (?, ?, ?, 1, datetime('now', 'localtime'))
      ON CONFLICT(user_id, question_id, question_type) 
      DO UPDATE SET 
        correct_count = correct_count + 1,
        last_practiced_at = datetime('now', 'localtime')
    `)
    const result = stmt.run(userId, questionId, questionType)
    return result.changes > 0
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
