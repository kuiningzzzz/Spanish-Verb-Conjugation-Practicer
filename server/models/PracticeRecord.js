const { userDb, vocabularyDb } = require('../database/db')

class PracticeRecord {
  static buildWhereClause({
    keyword,
    userId,
    verbId,
    exerciseType,
    isCorrect,
    tense,
    mood,
    person,
    startDate,
    endDate,
    includeUserFields = false,
    excludeDev = false
  } = {}) {
    const conditions = []
    const params = []
    const userFields = includeUserFields ? 'u.username LIKE ? OR u.email LIKE ? OR ' : ''

    if (keyword) {
      conditions.push(`(${userFields}CAST(pr.user_id AS TEXT) LIKE ?)`)
      const value = `%${keyword}%`
      if (includeUserFields) {
        params.push(value, value)
      }
      params.push(value)
    }
    if (userId) {
      conditions.push('pr.user_id = ?')
      params.push(userId)
    }
    if (verbId) {
      conditions.push('pr.verb_id = ?')
      params.push(verbId)
    }
    if (exerciseType) {
      conditions.push('pr.exercise_type = ?')
      params.push(exerciseType)
    }
    if (isCorrect !== undefined && isCorrect !== null && isCorrect !== '') {
      conditions.push('pr.is_correct = ?')
      params.push(isCorrect ? 1 : 0)
    }
    if (tense) {
      conditions.push('pr.tense = ?')
      params.push(tense)
    }
    if (mood) {
      conditions.push('pr.mood = ?')
      params.push(mood)
    }
    if (person) {
      conditions.push('pr.person = ?')
      params.push(person)
    }
    if (startDate) {
      conditions.push('pr.created_at >= ?')
      params.push(startDate)
    }
    if (endDate) {
      conditions.push('pr.created_at <= ?')
      params.push(endDate)
    }
    if (excludeDev) {
      conditions.push('(u.role IS NULL OR u.role != ?)')
      params.push('dev')
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    return { whereClause, params }
  }

  // 创建练习记录
  static create(recordData) {
    const { userId, verbId, exerciseType, isCorrect, answer, correctAnswer, tense, mood, person } = recordData
    
    // 获取当前本地时间（Node.js运行环境的本地时间）
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hour = String(now.getHours()).padStart(2, '0')
    const minute = String(now.getMinutes()).padStart(2, '0')
    const second = String(now.getSeconds()).padStart(2, '0')
    const createdAt = `${year}-${month}-${day} ${hour}:${minute}:${second}`
    
    const stmt = userDb.prepare(`
      INSERT INTO practice_records (user_id, verb_id, exercise_type, is_correct, answer, correct_answer, tense, mood, person, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    const result = stmt.run(userId, verbId, exerciseType, isCorrect, answer, correctAnswer, tense, mood, person, createdAt)
    
    // 更新用户进度
    this.updateUserProgress(userId, verbId, isCorrect)
    
    return result.lastInsertRowid
  }

  // 更新用户进度
  static updateUserProgress(userId, verbId, isCorrect) {
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
      INSERT INTO user_progress (user_id, verb_id, practice_count, correct_count, mastery_level, last_practiced_at)
      VALUES (?, ?, 1, ?, 0, ?)
      ON CONFLICT(user_id, verb_id) DO UPDATE SET
        practice_count = practice_count + 1,
        correct_count = correct_count + ?,
        mastery_level = CASE 
          WHEN (correct_count + ?) * 1.0 / (practice_count + 1) >= 0.8 AND practice_count + 1 >= 5 THEN 5
          WHEN (correct_count + ?) * 1.0 / (practice_count + 1) >= 0.7 AND practice_count + 1 >= 4 THEN 4
          WHEN (correct_count + ?) * 1.0 / (practice_count + 1) >= 0.6 AND practice_count + 1 >= 3 THEN 3
          WHEN (correct_count + ?) * 1.0 / (practice_count + 1) >= 0.5 THEN 2
          ELSE 1
        END,
        last_practiced_at = ?
    `)
    
    const correctValue = isCorrect ? 1 : 0
    stmt.run(userId, verbId, correctValue, lastPracticedAt, correctValue, correctValue, correctValue, correctValue, correctValue, lastPracticedAt)
  }

  // 获取用户练习记录
  static getByUserId(userId, limit = 50) {
    // 先从用户数据库获取记录
    const stmt = userDb.prepare(`
      SELECT * FROM practice_records
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `)
    const records = stmt.all(userId, limit)
    
    // 如果有记录，从词库数据库获取动词信息
    if (records.length > 0) {
      const verbIds = [...new Set(records.map(r => r.verb_id))]
      const placeholders = verbIds.map(() => '?').join(',')
      const verbStmt = vocabularyDb.prepare(`
        SELECT id, infinitive, meaning FROM verbs WHERE id IN (${placeholders})
      `)
      const verbs = verbStmt.all(...verbIds)
      const verbMap = {}
      verbs.forEach(v => verbMap[v.id] = v)
      
      // 合并动词信息
      records.forEach(r => {
        const verb = verbMap[r.verb_id]
        if (verb) {
          r.infinitive = verb.infinitive
          r.meaning = verb.meaning
        }
      })
    }
    
    return records
  }

  static listAll({
    limit = 50,
    offset = 0,
    keyword,
    userId,
    verbId,
    exerciseType,
    isCorrect,
    tense,
    mood,
    person,
    startDate,
    endDate,
    sortBy = 'created_at',
    sortOrder = 'desc'
  } = {}) {
    const { whereClause, params } = this.buildWhereClause({
      keyword,
      userId,
      verbId,
      exerciseType,
      isCorrect,
      tense,
      mood,
      person,
      startDate,
      endDate,
      includeUserFields: true,
      excludeDev: true
    })
    const sortMap = {
      id: 'pr.id',
      user_id: 'pr.user_id',
      verb_id: 'pr.verb_id',
      exercise_type: 'pr.exercise_type',
      is_correct: 'pr.is_correct',
      tense: 'pr.tense',
      mood: 'pr.mood',
      person: 'pr.person',
      created_at: 'pr.created_at'
    }
    const sortField = sortMap[sortBy] || sortMap.created_at
    const order = String(sortOrder).toLowerCase() === 'asc' ? 'ASC' : 'DESC'

    const rows = userDb
      .prepare(
        `
        SELECT pr.*, u.username, u.email
        FROM practice_records pr
        LEFT JOIN users u ON pr.user_id = u.id
        ${whereClause}
        ORDER BY ${sortField} ${order}
        LIMIT ? OFFSET ?
      `
      )
      .all(...params, limit, offset)

    const total = userDb
      .prepare(
        `
        SELECT COUNT(*) as total
        FROM practice_records pr
        LEFT JOIN users u ON pr.user_id = u.id
        ${whereClause}
      `
      )
      .get(...params).total

    if (rows.length > 0) {
      const verbIds = [...new Set(rows.map(r => r.verb_id).filter(Boolean))]
      if (verbIds.length > 0) {
        const placeholders = verbIds.map(() => '?').join(',')
        const verbStmt = vocabularyDb.prepare(
          `SELECT id, infinitive, meaning FROM verbs WHERE id IN (${placeholders})`
        )
        const verbs = verbStmt.all(...verbIds)
        const verbMap = {}
        verbs.forEach(v => {
          verbMap[v.id] = v
        })
        rows.forEach(r => {
          const verb = verbMap[r.verb_id]
          if (verb) {
            r.infinitive = verb.infinitive
            r.meaning = verb.meaning
          }
        })
      }
    }

    return { rows, total }
  }

  static getStats({
    keyword,
    userId,
    verbId,
    exerciseType,
    isCorrect,
    tense,
    mood,
    person,
    startDate,
    endDate,
    limit = 50
  } = {}) {
    const { whereClause, params } = this.buildWhereClause({
      keyword,
      userId,
      verbId,
      exerciseType,
      isCorrect,
      tense,
      mood,
      person,
      startDate,
      endDate,
      includeUserFields: true,
      excludeDev: true
    })

    const overall = userDb
      .prepare(
        `
        SELECT COUNT(*) as total, SUM(pr.is_correct) as correct
        FROM practice_records pr
        LEFT JOIN users u ON pr.user_id = u.id
        ${whereClause}
      `
      )
      .get(...params)

    const byUser = userDb
      .prepare(
        `
        SELECT pr.user_id, u.username, u.email,
          COUNT(*) as total,
          SUM(pr.is_correct) as correct
        FROM practice_records pr
        LEFT JOIN users u ON pr.user_id = u.id
        ${whereClause}
        GROUP BY pr.user_id
        ORDER BY total DESC
        LIMIT ?
      `
      )
      .all(...params, limit)
      .map(item => ({
        ...item,
        accuracy: item.total ? item.correct / item.total : 0
      }))

    const byVerb = userDb
      .prepare(
        `
        SELECT pr.verb_id,
          COUNT(*) as total,
          SUM(pr.is_correct) as correct
        FROM practice_records pr
        LEFT JOIN users u ON pr.user_id = u.id
        ${whereClause}
        GROUP BY pr.verb_id
        ORDER BY total DESC
        LIMIT ?
      `
      )
      .all(...params, limit)

    if (byVerb.length > 0) {
      const verbIds = [...new Set(byVerb.map(item => item.verb_id).filter(Boolean))]
      if (verbIds.length > 0) {
        const placeholders = verbIds.map(() => '?').join(',')
        const verbStmt = vocabularyDb.prepare(
          `SELECT id, infinitive, meaning FROM verbs WHERE id IN (${placeholders})`
        )
        const verbs = verbStmt.all(...verbIds)
        const verbMap = {}
        verbs.forEach(v => {
          verbMap[v.id] = v
        })
        byVerb.forEach(item => {
          const verb = verbMap[item.verb_id]
          if (verb) {
            item.infinitive = verb.infinitive
            item.meaning = verb.meaning
          }
          item.accuracy = item.total ? item.correct / item.total : 0
        })
      } else {
        byVerb.forEach(item => {
          item.accuracy = item.total ? item.correct / item.total : 0
        })
      }
    }

    const byUserTenseMood = userDb
      .prepare(
        `
        SELECT pr.user_id, u.username, u.email, pr.tense, pr.mood,
          COUNT(*) as total,
          SUM(pr.is_correct) as correct
        FROM practice_records pr
        LEFT JOIN users u ON pr.user_id = u.id
        ${whereClause}
        GROUP BY pr.user_id, pr.tense, pr.mood
        ORDER BY total DESC
        LIMIT ?
      `
      )
      .all(...params, limit)
      .map(item => ({
        ...item,
        accuracy: item.total ? item.correct / item.total : 0
      }))

    return {
      overall: {
        total: overall?.total || 0,
        correct: overall?.correct || 0,
        accuracy: overall?.total ? overall.correct / overall.total : 0
      },
      byUser,
      byVerb: byVerb.map(item => ({
        ...item,
        accuracy: item.accuracy ?? (item.total ? item.correct / item.total : 0)
      })),
      byUserTenseMood
    }
  }

  // 获取用户统计数据
  static getStatistics(userId) {
    const stmt = userDb.prepare(`
      SELECT 
        COUNT(*) as total_exercises,
        SUM(is_correct) as correct_exercises,
        COUNT(DISTINCT verb_id) as practiced_verbs,
        COUNT(DISTINCT DATE(created_at)) as practice_days
      FROM practice_records
      WHERE user_id = ?
    `)
    return stmt.get(userId)
  }

  // 获取今日练习统计
  static getTodayStatistics(userId) {
    const stmt = userDb.prepare(`
      SELECT 
        COUNT(*) as total_exercises,
        SUM(is_correct) as correct_exercises
      FROM practice_records
      WHERE user_id = ? AND DATE(created_at) = DATE('now', 'localtime')
    `)
    return stmt.get(userId)
  }

  // 获取用户掌握的动词列表
  static getMasteredVerbs(userId, masteryLevel = 3) {
    // 先从用户数据库获取进度记录
    const stmt = userDb.prepare(`
      SELECT verb_id, mastery_level, practice_count, correct_count, last_practiced_at
      FROM user_progress
      WHERE user_id = ? AND mastery_level >= ?
      ORDER BY mastery_level DESC, last_practiced_at DESC
    `)
    const progress = stmt.all(userId, masteryLevel)
    
    // 如果有记录，从词库数据库获取动词信息
    if (progress.length > 0) {
      const verbIds = progress.map(p => p.verb_id)
      const placeholders = verbIds.map(() => '?').join(',')
      const verbStmt = vocabularyDb.prepare(`
        SELECT * FROM verbs WHERE id IN (${placeholders})
      `)
      const verbs = verbStmt.all(...verbIds)
      const verbMap = {}
      verbs.forEach(v => verbMap[v.id] = v)
      
      // 合并数据
      return progress.map(p => ({
        ...verbMap[p.verb_id],
        mastery_level: p.mastery_level,
        practice_count: p.practice_count,
        correct_count: p.correct_count,
        last_practiced_at: p.last_practiced_at
      })).filter(item => item.id) // 过滤掉找不到动词的记录
    }
    
    return []
  }

  // 获取学习趋势数据
  static getTrendData(userId, type = 'week') {
    const now = new Date()
    
    if (type === 'week') {
      // 本周：显示包括今天在内的7天
      const result = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now)
        date.setDate(date.getDate() - i)
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        
        const stmt = userDb.prepare(`
          SELECT COUNT(*) as count
          FROM practice_records
          WHERE user_id = ? AND DATE(created_at) = ?
        `)
        const data = stmt.get(userId, dateStr)
        
        // 标签格式：周几
        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
        const label = weekdays[date.getDay()]
        
        result.push({
          date: dateStr,
          label: label,
          count: data?.count || 0
        })
      }
      return result
      
    } else if (type === 'month') {
      // 本月：显示近30天，分成10组，每组3天
      const result = []
      for (let i = 9; i >= 0; i--) {
        const endDate = new Date(now)
        endDate.setDate(endDate.getDate() - (i * 3))
        const startDate = new Date(endDate)
        startDate.setDate(startDate.getDate() - 2)
        
        const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
        const endStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
        
        const stmt = userDb.prepare(`
          SELECT COUNT(*) as count
          FROM practice_records
          WHERE user_id = ? AND DATE(created_at) BETWEEN ? AND ?
        `)
        const data = stmt.get(userId, startStr, endStr)
        
        // 标签格式：显示日期区间
        let label
        if (i === 0) {
          // 最新的一组，显示"D-今"（显示起始日期）
          label = `${startDate.getDate()}-今`
        } else {
          // 其他组，显示"D1-D2"
          label = `${startDate.getDate()}-${endDate.getDate()}`
        }
        
        result.push({
          dateRange: `${startStr} ~ ${endStr}`,
          label: label,
          count: data?.count || 0
        })
      }
      return result
      
    } else if (type === 'year') {
      // 本年：显示包括当前月份在内的近12个月
      const result = []
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const year = date.getFullYear()
        const month = date.getMonth() + 1
        
        // 计算该月的第一天和最后一天
        const firstDay = `${year}-${String(month).padStart(2, '0')}-01`
        const lastDay = new Date(year, month, 0) // 下个月的第0天就是这个月的最后一天
        const lastDayStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`
        
        const stmt = userDb.prepare(`
          SELECT COUNT(*) as count
          FROM practice_records
          WHERE user_id = ? AND DATE(created_at) BETWEEN ? AND ?
        `)
        const data = stmt.get(userId, firstDay, lastDayStr)
        
        // 标签格式：M月
        const label = `${month}月`
        
        result.push({
          month: `${year}-${String(month).padStart(2, '0')}`,
          label: label,
          count: data?.count || 0
        })
      }
      return result
    }
    
    return []
  }
}

module.exports = PracticeRecord
