const { vocabularyDb } = require('../database/db');

class Lesson {
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
  static create(textbookId, title, lessonNumber, description = null, grammarPoints = null, moods = null, tenses = null, conjugationTypes = null) {
    const sql = `
      INSERT INTO lessons (textbook_id, title, lesson_number, description, grammar_points, moods, tenses, conjugation_types, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `;
    return vocabularyDb.prepare(sql).run(textbookId, title, lessonNumber, description, grammarPoints, moods, tenses, conjugationTypes);
  }

  // 更新课程
  static update(id, title, description = null, grammarPoints = null, moods = null, tenses = null, conjugationTypes = null) {
    const sql = `
      UPDATE lessons 
      SET
        title = ?,
        description = ?,
        grammar_points = ?,
        moods = ?,
        tenses = ?,
        conjugation_types = ?,
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `;
    return vocabularyDb.prepare(sql).run(title, description, grammarPoints, moods, tenses, conjugationTypes, id);
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

  // 获取课程的单词数量
  static getVocabularyCount(lessonId) {
    const sql = `
      SELECT COUNT(*) as count
      FROM lesson_verbs
      WHERE lesson_id = ?
    `;
    const result = vocabularyDb.prepare(sql).get(lessonId);
    return result ? result.count : 0;
  }
}

module.exports = Lesson;
