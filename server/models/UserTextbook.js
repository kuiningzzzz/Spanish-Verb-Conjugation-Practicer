const { userDb, vocabularyDb } = require('../database/db');

class UserTextbook {
  // 获取用户添加的所有教材
  static getUserTextbooks(userId) {
    // 先从 userDb 获取用户的教材ID
    const userTextbookIds = userDb.prepare(`
      SELECT textbook_id, created_at
      FROM user_textbooks
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(userId);
    
    if (userTextbookIds.length === 0) {
      return [];
    }
    
    // 再从 vocabularyDb 获取教材详情
    const textbookIds = userTextbookIds.map(ut => ut.textbook_id);
    const placeholders = textbookIds.map(() => '?').join(',');
    const textbooks = vocabularyDb.prepare(`
      SELECT * FROM textbooks 
      WHERE id IN (${placeholders})
    `).all(...textbookIds);
    
    // 合并数据
    return textbooks.map(t => {
      const userTextbook = userTextbookIds.find(ut => ut.textbook_id === t.id);
      return {
        ...t,
        textbook_id: t.id,
        created_at: userTextbook.created_at
      };
    });
  }

  // 检查用户是否已添加某教材
  static hasTextbook(userId, textbookId) {
    const sql = `
      SELECT COUNT(*) as count
      FROM user_textbooks
      WHERE user_id = ? AND textbook_id = ?
    `;
    const result = userDb.prepare(sql).get(userId, textbookId);
    return result.count > 0;
  }

  // 添加教材
  static add(userId, textbookId) {
    const sql = `
      INSERT INTO user_textbooks (user_id, textbook_id)
      VALUES (?, ?)
    `;
    return userDb.prepare(sql).run(userId, textbookId);
  }

  // 移除教材
  static remove(userId, textbookId) {
    const sql = `
      DELETE FROM user_textbooks
      WHERE user_id = ? AND textbook_id = ?
    `;
    return userDb.prepare(sql).run(userId, textbookId);
  }

  // 获取用户添加的教材数量
  static getCount(userId) {
    const sql = `
      SELECT COUNT(*) as count
      FROM user_textbooks
      WHERE user_id = ?
    `;
    const result = userDb.prepare(sql).get(userId);
    return result ? result.count : 0;
  }
}

module.exports = UserTextbook;
