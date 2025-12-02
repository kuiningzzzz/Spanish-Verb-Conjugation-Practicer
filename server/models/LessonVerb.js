const { vocabularyDb } = require('../database/db');

class LessonVerb {
  // 创建课程-单词关联表（已在db.js中初始化，此方法保留用于兼容）
  static createTable() {
    // 表已在数据库初始化时创建
  }

  // 添加单词到课程
  static add(lessonId, verbId, orderIndex = 0) {
    const sql = `
      INSERT OR IGNORE INTO lesson_verbs (lesson_id, verb_id, order_index)
      VALUES (?, ?, ?)
    `;
    return vocabularyDb.prepare(sql).run(lessonId, verbId, orderIndex);
  }

  // 批量添加单词到课程
  static addBatch(lessonId, verbIds) {
    const sql = `
      INSERT OR IGNORE INTO lesson_verbs (lesson_id, verb_id, order_index)
      VALUES (?, ?, ?)
    `;
    
    const insert = vocabularyDb.prepare(sql);
    const insertMany = vocabularyDb.transaction((items) => {
      items.forEach((item, index) => {
        insert.run(lessonId, item, index);
      });
    });
    
    insertMany(verbIds);
  }

  // 从课程中移除单词
  static remove(lessonId, verbId) {
    const sql = 'DELETE FROM lesson_verbs WHERE lesson_id = ? AND verb_id = ?';
    return vocabularyDb.prepare(sql).run(lessonId, verbId);
  }

  // 清空课程的所有单词
  static clearLesson(lessonId) {
    const sql = 'DELETE FROM lesson_verbs WHERE lesson_id = ?';
    return vocabularyDb.prepare(sql).run(lessonId);
  }
}

module.exports = LessonVerb;
