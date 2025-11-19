const { db } = require('../database/db')

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

    const stmt = db.prepare(`
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

    let query = `
      SELECT pq.*, v.infinitive, v.meaning, v.conjugation_type, v.is_irregular
      FROM public_questions pq
      JOIN verbs v ON pq.verb_id = v.id
      WHERE 1=1
    `
    const params = []

    if (questionType) {
      query += ` AND pq.question_type = ?`
      params.push(questionType)
    }

    if (tenses.length > 0) {
      const placeholders = tenses.map(() => '?').join(',')
      query += ` AND pq.tense IN (${placeholders})`
      params.push(...tenses)
    }

    if (conjugationTypes.length > 0) {
      const placeholders = conjugationTypes.map(() => '?').join(',')
      query += ` AND v.conjugation_type IN (${placeholders})`
      params.push(...conjugationTypes)
    }

    if (!includeIrregular) {
      query += ` AND v.is_irregular = 0`
    }

    query += ` ORDER BY RANDOM() LIMIT ?`
    params.push(limit)

    const stmt = db.prepare(query)
    return limit === 1 ? stmt.get(...params) : stmt.all(...params)
  }

  /**
   * 更新公共题库题目的置信度
   */
  static updateConfidence(questionId, delta) {
    const stmt = db.prepare(`
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
  static deleteOldPublicQuestions() {
    const stmt = db.prepare(`
      DELETE FROM public_questions
      WHERE datetime(created_at) <= datetime('now', '-30 days')
    `)
    const result = stmt.run()
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

    const stmt = db.prepare(query)
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
    const existStmt = db.prepare(`
      SELECT id FROM private_questions 
      WHERE user_id = ? AND verb_id = ? AND question_type = ? AND question_text = ?
    `)
    const existing = existStmt.get(userId, verbId, questionType, questionText)
    
    if (existing) {
      return existing.id
    }

    const stmt = db.prepare(`
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
    const stmt = db.prepare(`
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
    let query = `
      SELECT pq.*, v.infinitive, v.meaning, v.conjugation_type, v.is_irregular
      FROM private_questions pq
      JOIN verbs v ON pq.verb_id = v.id
      WHERE pq.user_id = ?
    `
    const params = [userId]

    if (questionType) {
      query += ` AND pq.question_type = ?`
      params.push(questionType)
    }

    query += ` ORDER BY pq.created_at DESC`

    const stmt = db.prepare(query)
    return stmt.all(...params)
  }

  /**
   * 从私人题库随机获取题目
   */
  static getRandomFromPrivate(userId, filters = {}) {
    const { questionType, limit = 1 } = filters

    let query = `
      SELECT pq.*, v.infinitive, v.meaning, v.conjugation_type, v.is_irregular
      FROM private_questions pq
      JOIN verbs v ON pq.verb_id = v.id
      WHERE pq.user_id = ?
    `
    const params = [userId]

    if (questionType) {
      query += ` AND pq.question_type = ?`
      params.push(questionType)
    }

    query += ` ORDER BY RANDOM() LIMIT ?`
    params.push(limit)

    const stmt = db.prepare(query)
    return limit === 1 ? stmt.get(...params) : stmt.all(...params)
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

    const stmt = db.prepare(query)
    const result = stmt.get(...params)
    return result.count
  }

  // ==================== 用户答题记录操作 ====================

  /**
   * 记录用户答对题目
   */
  static recordCorrectAnswer(userId, questionId, questionType) {
    const stmt = db.prepare(`
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
    const stmt = db.prepare(`
      SELECT correct_count FROM user_question_records
      WHERE user_id = ? AND question_id = ? AND question_type = ?
    `)
    const result = stmt.get(userId, questionId, questionType)
    return result ? result.correct_count : 0
  }

  /**
   * 删除超过30天公共题目的相关记录
   */
  static deleteOldQuestionRecords() {
    const stmt = db.prepare(`
      DELETE FROM user_question_records
      WHERE question_type = 'public' AND question_id IN (
        SELECT id FROM public_questions
        WHERE datetime(created_at) <= datetime('now', '-30 days')
      )
    `)
    const result = stmt.run()
    return result.changes
  }

  /**
   * 检查题目是否存在于公共题库
   */
  static existsInPublic(verbId, questionText) {
    const stmt = db.prepare(`
      SELECT id FROM public_questions
      WHERE verb_id = ? AND question_text = ?
    `)
    const result = stmt.get(verbId, questionText)
    return !!result
  }
}

module.exports = Question
