const { vocabularyDb } = require('../database/db');

class Textbook {
  // 创建教材表（已在db.js中初始化，此方法保留用于兼容）
  static createTable() {
    // 表已在数据库初始化时创建
  }

  // 获取所有教材
  static getAll() {
    const sql = 'SELECT * FROM textbooks ORDER BY order_index ASC, id ASC';
    return vocabularyDb.prepare(sql).all();
  }

  // 根据ID获取教材
  static getById(id) {
    const sql = 'SELECT * FROM textbooks WHERE id = ?';
    return vocabularyDb.prepare(sql).get(id);
  }

  // 创建教材
  static create(name, description, coverImage = null, orderIndex = 0) {
    const sql = `
      INSERT INTO textbooks (name, description, cover_image, order_index)
      VALUES (?, ?, ?, ?)
    `;
    return vocabularyDb.prepare(sql).run(name, description, coverImage, orderIndex);
  }

  // 更新教材
  static update(id, name, description, coverImage = null, orderIndex = null) {
    const sql = `
      UPDATE textbooks 
      SET name = ?, description = ?, cover_image = ?, order_index = COALESCE(?, order_index)
      WHERE id = ?
    `;
    return vocabularyDb.prepare(sql).run(name, description, coverImage, orderIndex, id);
  }

  // 删除教材
  static delete(id) {
    const sql = 'DELETE FROM textbooks WHERE id = ?';
    return vocabularyDb.prepare(sql).run(id);
  }
}

module.exports = Textbook;
