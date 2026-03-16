const { vocabularyDb } = require('../database/db');

class Textbook {
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
  static create(name, description, coverImage = null, orderIndex = 0, isPublished = 1, uploaderId = null, publishStatus = null) {
    const sql = `
      INSERT INTO textbooks (name, description, cover_image, is_published, publish_status, order_index, uploader_id, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `;
    const normalizedUploaderId = uploaderId === null || uploaderId === undefined ? null : Number(uploaderId)
    const normalizedPublished = isPublished ? 1 : 0
    const normalizedPublishStatus = publishStatus || (normalizedPublished ? 'published' : 'draft')
    return vocabularyDb.prepare(sql).run(
      name,
      description,
      coverImage,
      normalizedPublished,
      normalizedPublishStatus,
      orderIndex,
      normalizedUploaderId
    );
  }

  // 更新教材
  static update(id, name, description, coverImage = null, orderIndex = null, isPublished = null, publishStatus = null) {
    const sql = `
      UPDATE textbooks 
      SET
        name = ?,
        description = ?,
        cover_image = ?,
        order_index = COALESCE(?, order_index),
        is_published = COALESCE(?, is_published),
        publish_status = COALESCE(?, publish_status),
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `;
    const normalizedPublished = isPublished === null || isPublished === undefined ? null : (isPublished ? 1 : 0);
    const normalizedPublishStatus = publishStatus === null || publishStatus === undefined
      ? (normalizedPublished === null ? null : (normalizedPublished ? 'published' : 'draft'))
      : publishStatus
    return vocabularyDb.prepare(sql).run(name, description, coverImage, orderIndex, normalizedPublished, normalizedPublishStatus, id);
  }

  // 删除教材
  static delete(id) {
    const sql = 'DELETE FROM textbooks WHERE id = ?';
    return vocabularyDb.prepare(sql).run(id);
  }
}

module.exports = Textbook;
