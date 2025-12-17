const { vocabularyDb: db } = require('../database/db')

class Verb {
  // 创建动词
  static create(verbData) {
    const { 
      infinitive, 
      meaning, 
      conjugationType, 
      isIrregular, 
      isReflexive,
      gerund,
      participle,
      participleForms,
      lessonNumber, 
      textbookVolume, 
      frequencyLevel 
    } = verbData
    
    const stmt = db.prepare(`
      INSERT INTO verbs (
        infinitive, meaning, conjugation_type, is_irregular, is_reflexive, 
        gerund, participle, participle_forms, 
        lesson_number, textbook_volume, frequency_level
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    const result = stmt.run(
      infinitive, 
      meaning, 
      conjugationType, 
      isIrregular || 0,
      isReflexive || 0,
      gerund || null,
      participle || null,
      participleForms || null,
      lessonNumber, 
      textbookVolume || 1, 
      frequencyLevel || 1
    )
    return result.lastInsertRowid
  }

  // 获取所有动词
  static getAll(filters = {}) {
    let query = 'SELECT * FROM verbs WHERE 1=1'
    const params = []

    if (filters.lessonNumber) {
      query += ' AND lesson_number = ?'
      params.push(filters.lessonNumber)
    }

    if (filters.textbookVolume) {
      query += ' AND textbook_volume = ?'
      params.push(filters.textbookVolume)
    }

    if (filters.conjugationType) {
      query += ' AND conjugation_type = ?'
      params.push(filters.conjugationType)
    }

    query += ' ORDER BY lesson_number, id'

    const stmt = db.prepare(query)
    return stmt.all(...params)
  }

  // 根据ID获取动词
  static findById(id) {
    const stmt = db.prepare('SELECT * FROM verbs WHERE id = ?')
    return stmt.get(id)
  }

  // 随机获取动词
  static getRandom(count = 1, filters = {}) {
    let query = 'SELECT * FROM verbs WHERE 1=1'
    const params = []

    // 如果指定了动词ID列表，只从这些动词中选择
    if (filters.verbIds && filters.verbIds.length > 0) {
      const placeholders = filters.verbIds.map(() => '?').join(',')
      query += ` AND id IN (${placeholders})`
      params.push(...filters.verbIds)
    } else {
      // 原有的筛选逻辑
      if (filters.lessonNumber) {
        query += ' AND lesson_number <= ?'
        params.push(filters.lessonNumber)
      }

      if (filters.textbookVolume) {
        query += ' AND textbook_volume = ?'
        params.push(filters.textbookVolume)
      }

      // 按变位类型筛选
      if (filters.conjugationTypes && filters.conjugationTypes.length > 0) {
        // 变位类型映射：数据库中存储的是数字 1, 2, 3
        const typeMap = {
          'ar': 1,  // 第一变位
          'er': 2,  // 第二变位
          'ir': 3   // 第三变位
        }
        
        const types = filters.conjugationTypes.map(t => typeMap[t]).filter(t => t !== undefined)
        if (types.length > 0) {
          const placeholders = types.map(() => '?').join(',')
          query += ` AND conjugation_type IN (${placeholders})`
          params.push(...types)
        }
      }

      // 是否只要规则动词
      if (filters.onlyRegular === true) {
        query += ' AND is_irregular = 0'
      }
      
      // 是否只要不规则动词
      if (filters.onlyIrregular === true) {
        query += ' AND is_irregular = 1'
      }
      
      // 排除指定的动词ID
      if (filters.excludeVerbIds && filters.excludeVerbIds.length > 0) {
        const placeholders = filters.excludeVerbIds.map(() => '?').join(',')
        query += ` AND id NOT IN (${placeholders})`
        params.push(...filters.excludeVerbIds)
      }
    }

    query += ' ORDER BY RANDOM() LIMIT ?'
    params.push(count)

    const stmt = db.prepare(query)
    return stmt.all(...params)
  }

  // 获取用户未掌握的动词
  static getWeakVerbs(userId, count = 10) {
    const stmt = db.prepare(`
      SELECT v.* FROM verbs v
      LEFT JOIN user_progress up ON v.id = up.verb_id AND up.user_id = ?
      WHERE up.mastery_level IS NULL OR up.mastery_level < 3
      ORDER BY RANDOM()
      LIMIT ?
    `)
    return stmt.all(userId, count)
  }
}

module.exports = Verb
