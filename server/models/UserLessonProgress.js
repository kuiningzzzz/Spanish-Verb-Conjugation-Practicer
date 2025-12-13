const { userDb } = require('../database/db');

class UserLessonProgress {
  // 获取用户某个课程的进度
  static getProgress(userId, lessonId) {
    const sql = `
      SELECT * FROM user_lesson_progress
      WHERE user_id = ? AND lesson_id = ?
    `;
    return userDb.prepare(sql).get(userId, lessonId);
  }

  // 获取用户某教材下所有课程的进度
  static getProgressByTextbook(userId, textbookId) {
    const sql = `
      SELECT ulp.*, l.lesson_number
      FROM user_lesson_progress ulp
      INNER JOIN lessons l ON ulp.lesson_id = l.id
      WHERE ulp.user_id = ? AND l.textbook_id = ?
      ORDER BY l.lesson_number ASC
    `;
    return userDb.prepare(sql).all(userId, textbookId);
  }

  // 标记课程完成（增加完成次数）
  // type: 'study' 表示普通学习, 'review' 表示滚动复习
  static markCompleted(userId, lessonId, type = 'study') {
    // 先检查是否存在记录
    const existing = this.getProgress(userId, lessonId);
    
    if (existing) {
      // 更新完成次数
      const countField = type === 'review' ? 'review_completed_count' : 'study_completed_count';
      const sql = `
        UPDATE user_lesson_progress
        SET completed_count = completed_count + 1,
            ${countField} = ${countField} + 1,
            last_completed_at = datetime('now', 'localtime'),
            updated_at = datetime('now', 'localtime')
        WHERE user_id = ? AND lesson_id = ?
      `;
      return userDb.prepare(sql).run(userId, lessonId);
    } else {
      // 创建新记录
      const studyCount = type === 'study' ? 1 : 0;
      const reviewCount = type === 'review' ? 1 : 0;
      const sql = `
        INSERT INTO user_lesson_progress (user_id, lesson_id, completed_count, study_completed_count, review_completed_count, last_completed_at)
        VALUES (?, ?, 1, ?, ?, datetime('now', 'localtime'))
      `;
      return userDb.prepare(sql).run(userId, lessonId, studyCount, reviewCount);
    }
  }

  // 重置课程进度
  static reset(userId, lessonId) {
    const sql = `
      DELETE FROM user_lesson_progress
      WHERE user_id = ? AND lesson_id = ?
    `;
    return userDb.prepare(sql).run(userId, lessonId);
  }

  // 检查课程是否完成（新标准：学习和复习都至少完成一遍）
  static isCompleted(userId, lessonId) {
    const progress = this.getProgress(userId, lessonId);
    return progress && progress.study_completed_count >= 1 && progress.review_completed_count >= 1;
  }

  // 获取课程完成次数
  static getCompletedCount(userId, lessonId) {
    const progress = this.getProgress(userId, lessonId);
    return progress ? progress.completed_count : 0;
  }
}

module.exports = UserLessonProgress;
