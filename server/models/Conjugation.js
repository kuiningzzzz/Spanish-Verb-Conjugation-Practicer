const { vocabularyDb: db } = require('../database/db')

class Conjugation {
  // 创建变位
  static create(conjugationData) {
    const { verbId, tense, mood, person, conjugatedForm, isIrregular } = conjugationData
    
    const stmt = db.prepare(`
      INSERT INTO conjugations (verb_id, tense, mood, person, conjugated_form, is_irregular)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    
    const result = stmt.run(verbId, tense, mood, person, conjugatedForm, isIrregular || 0)
    return result.lastInsertRowid
  }

  // 批量创建变位
  static createBatch(verbId, conjugations) {
    const stmt = db.prepare(`
      INSERT INTO conjugations (verb_id, tense, mood, person, conjugated_form, is_irregular)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    const insertMany = db.transaction((conjugations) => {
      for (const conj of conjugations) {
        stmt.run(verbId, conj.tense, conj.mood, conj.person, conj.conjugatedForm, conj.isIrregular || 0)
      }
    })

    insertMany(conjugations)
  }

  // 获取动词的所有变位
  static getByVerbId(verbId) {
    const stmt = db.prepare('SELECT * FROM conjugations WHERE verb_id = ?')
    return stmt.all(verbId)
  }

  // 获取特定时态和人称的变位
  static getSpecific(verbId, tense, mood, person) {
    const stmt = db.prepare(`
      SELECT * FROM conjugations 
      WHERE verb_id = ? AND tense = ? AND mood = ? AND person = ?
    `)
    return stmt.get(verbId, tense, mood, person)
  }

  // 获取随机变位
  static getRandom(verbId) {
    const stmt = db.prepare(`
      SELECT * FROM conjugations 
      WHERE verb_id = ? 
      ORDER BY RANDOM() 
      LIMIT 1
    `)
    return stmt.get(verbId)
  }

  // 获取所有时态列表
  static getTenses() {
    const stmt = db.prepare('SELECT DISTINCT tense, mood FROM conjugations ORDER BY mood, tense')
    return stmt.all()
  }

  static getOptions() {
    const moodRows = db.prepare('SELECT DISTINCT mood FROM conjugations ORDER BY mood').all()
    const tenseRows = db.prepare('SELECT DISTINCT tense FROM conjugations ORDER BY tense').all()
    const personRows = db.prepare('SELECT DISTINCT person FROM conjugations ORDER BY person').all()
    const tenseMoodRows = db.prepare('SELECT DISTINCT tense, mood FROM conjugations').all()
    const tenseMoodMap = tenseMoodRows.reduce((acc, row) => {
      if (!acc[row.tense]) {
        acc[row.tense] = row.mood
      }
      return acc
    }, {})
    return {
      moods: moodRows.map((row) => row.mood),
      tenses: tenseRows.map((row) => row.tense),
      persons: personRows.map((row) => row.person),
      tenseMoodMap
    }
  }
}

module.exports = Conjugation
