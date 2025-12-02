const { vocabularyDb } = require('../database/db');

class Lesson {
  // 创建课程表（已在db.js中初始化，此方法保留用于兼容）
  static createTable() {
    // 表已在数据库初始化时创建
  }

  // 获取教材的所有课程
  static getByTextbookId(textbookId) {
    const sql = `
      SELECT * FROM lessons 
      WHERE textbook_id = ? 
      ORDER BY lesson_number ASC
    `;
    return vocabularyDb.prepare(sql).all(textbookId);
  }

  // 根据ID获取课程
  static getById(id) {
    const sql = 'SELECT * FROM lessons WHERE id = ?';
    return vocabularyDb.prepare(sql).get(id);
  }

  // 创建课程
  static create(textbookId, title, lessonNumber, description = null, grammarPoints = null, tenses = null, conjugationTypes = null) {
    const sql = `
      INSERT INTO lessons (textbook_id, title, lesson_number, description, grammar_points, tenses, conjugation_types)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    return vocabularyDb.prepare(sql).run(textbookId, title, lessonNumber, description, grammarPoints, tenses, conjugationTypes);
  }

  // 更新课程
  static update(id, title, description = null, grammarPoints = null, tenses = null, conjugationTypes = null) {
    const sql = `
      UPDATE lessons 
      SET title = ?, description = ?, grammar_points = ?, tenses = ?, conjugation_types = ?
      WHERE id = ?
    `;
    return vocabularyDb.prepare(sql).run(title, description, grammarPoints, tenses, conjugationTypes, id);
  }

  // 删除课程
  static delete(id) {
    const sql = 'DELETE FROM lessons WHERE id = ?';
    return vocabularyDb.prepare(sql).run(id);
  }

  // 获取课程的单词列表（从lesson_verbs关联表）
  static getVocabulary(lessonId) {
    const sql = `
      SELECT v.* 
      FROM verbs v
      INNER JOIN lesson_verbs lv ON v.id = lv.verb_id
      WHERE lv.lesson_id = ?
      ORDER BY lv.order_index ASC
    `;
    return vocabularyDb.prepare(sql).all(lessonId);
  }
}

module.exports = Lesson;
