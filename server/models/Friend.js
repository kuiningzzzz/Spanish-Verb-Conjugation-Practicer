const { userDb } = require('../database/db')

class Friend {
  /**
   * 检查唯一ID是否可用
   */
  static isUniqueIdAvailable(uniqueId, excludeUserId = null) {
    const sql = excludeUserId
      ? `SELECT id FROM users WHERE unique_id = ? AND id != ?`
      : `SELECT id FROM users WHERE unique_id = ?`
    
    const params = excludeUserId ? [uniqueId, excludeUserId] : [uniqueId]
    const user = userDb.prepare(sql).get(...params)
    return !user
  }

  /**
   * 设置用户唯一ID
   */
  static setUniqueId(userId, uniqueId) {
    const stmt = userDb.prepare(`
      UPDATE users 
      SET unique_id = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `)
    return stmt.run(uniqueId, userId)
  }

  /**
   * 搜索用户（通过唯一ID、用户名或邮箱）
   */
  static searchUsers(keyword, currentUserId) {
    const stmt = userDb.prepare(`
      SELECT id, username, unique_id, email, avatar
      FROM users 
      WHERE (unique_id = ? OR username LIKE ? OR email = ?)
        AND id != ?
      LIMIT 20
    `)
    return stmt.all(keyword, `%${keyword}%`, keyword, currentUserId)
  }

  /**
   * 发送好友申请
   */
  static sendFriendRequest(fromUserId, toUserId, message = '') {
    // 检查是否已经是好友
    if (this.areFriends(fromUserId, toUserId)) {
      throw new Error('已经是好友')
    }

    // 检查是否已经发送过申请
    const existing = userDb.prepare(`
      SELECT id, status FROM friend_requests 
      WHERE from_user_id = ? AND to_user_id = ?
    `).get(fromUserId, toUserId)

    if (existing) {
      if (existing.status === 'pending') {
        throw new Error('已发送过好友申请，请等待对方处理')
      }
      // 如果之前被拒绝，可以重新发送
      const stmt = userDb.prepare(`
        UPDATE friend_requests 
        SET status = 'pending', message = ?, updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `)
      return stmt.run(message, existing.id)
    }

    const stmt = userDb.prepare(`
      INSERT INTO friend_requests (from_user_id, to_user_id, message)
      VALUES (?, ?, ?)
    `)
    return stmt.run(fromUserId, toUserId, message)
  }

  /**
   * 获取收到的好友申请列表
   */
  static getReceivedRequests(userId) {
    const stmt = userDb.prepare(`
      SELECT 
        fr.id, fr.from_user_id, fr.message, fr.created_at,
        u.username, u.unique_id, u.avatar
      FROM friend_requests fr
      JOIN users u ON fr.from_user_id = u.id
      WHERE fr.to_user_id = ? AND fr.status = 'pending'
      ORDER BY fr.created_at DESC
    `)
    return stmt.all(userId)
  }

  /**
   * 处理好友申请
   */
  static handleFriendRequest(requestId, accept) {
    const request = userDb.prepare(`
      SELECT from_user_id, to_user_id 
      FROM friend_requests 
      WHERE id = ? AND status = 'pending'
    `).get(requestId)

    if (!request) {
      throw new Error('申请不存在或已处理')
    }

    const status = accept ? 'accepted' : 'rejected'
    
    // 更新申请状态
    userDb.prepare(`
      UPDATE friend_requests 
      SET status = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(status, requestId)

    // 如果接受，建立好友关系
    if (accept) {
      this.addFriendship(request.from_user_id, request.to_user_id)
    }

    return request
  }

  /**
   * 建立好友关系（双向）
   */
  static addFriendship(userId1, userId2) {
    const stmt = userDb.prepare(`
      INSERT OR IGNORE INTO friends (user_id, friend_id)
      VALUES (?, ?)
    `)
    stmt.run(userId1, userId2)
    stmt.run(userId2, userId1)
  }

  /**
   * 检查是否是好友
   */
  static areFriends(userId1, userId2) {
    const stmt = userDb.prepare(`
      SELECT id FROM friends 
      WHERE user_id = ? AND friend_id = ?
    `)
    return !!stmt.get(userId1, userId2)
  }

  /**
   * 获取好友列表
   */
  static getFriendsList(userId) {
    const stmt = userDb.prepare(`
      SELECT 
        u.id, u.username, u.unique_id, u.avatar,
        fs.remark, fs.is_starred,
        f.created_at as friend_since
      FROM friends f
      JOIN users u ON f.friend_id = u.id
      LEFT JOIN friend_settings fs ON fs.user_id = f.user_id AND fs.friend_id = f.friend_id
      WHERE f.user_id = ?
      ORDER BY fs.is_starred DESC, f.created_at DESC
    `)
    return stmt.all(userId)
  }

  /**
   * 获取好友详细信息（包括统计数据）
   */
  static getFriendDetails(userId, friendId) {
    // 检查是否是好友
    if (!this.areFriends(userId, friendId)) {
      throw new Error('不是好友关系')
    }

    // 获取好友基本信息
    const friend = userDb.prepare(`
      SELECT 
        u.id, u.username, u.unique_id, u.avatar,
        f.created_at,
        fs.remark, fs.is_starred
      FROM users u
      INNER JOIN friends f ON (f.user_id = ? AND f.friend_id = u.id)
      LEFT JOIN friend_settings fs ON fs.user_id = ? AND fs.friend_id = u.id
      WHERE u.id = ?
    `).get(userId, userId, friendId)

    if (!friend) {
      throw new Error('用户不存在')
    }

    // 获取学习统计
    const stats = this.getFriendStats(friendId)
    
    return {
      ...friend,
      stats
    }
  }

  /**
   * 获取好友的学习统计数据
   */
  static getFriendStats(friendId) {
    // 总练习次数和正确次数
    const totalStats = userDb.prepare(`
      SELECT 
        COUNT(*) as total_exercises,
        SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct_count
      FROM practice_records
      WHERE user_id = ?
    `).get(friendId)

    // 连续打卡天数
    const checkInStats = userDb.prepare(`
      SELECT 
        COUNT(DISTINCT check_in_date) as total_days,
        MAX(check_in_date) as last_check_in
      FROM check_ins
      WHERE user_id = ?
    `).get(friendId)

    // 计算连续打卡天数
    let streakDays = 0
    if (checkInStats.last_check_in) {
      const streak = userDb.prepare(`
        SELECT COUNT(*) as streak 
        FROM check_ins 
        WHERE user_id = ?
        AND check_in_date >= date('now', '-' || (
          SELECT COUNT(*) 
          FROM check_ins c2 
          WHERE c2.user_id = check_ins.user_id 
          AND c2.check_in_date > check_ins.check_in_date
        ) || ' days')
      `).get(friendId)
      streakDays = streak?.streak || 0
    }

    return {
      total_exercises: totalStats.total_exercises || 0,
      correct_count: totalStats.correct_count || 0,
      accuracy: totalStats.total_exercises > 0 
        ? Math.round((totalStats.correct_count / totalStats.total_exercises) * 100) 
        : 0,
      total_check_in_days: checkInStats.total_days || 0,
      streak_days: streakDays
    }
  }

  /**
   * 设置好友备注
   */
  static setFriendRemark(userId, friendId, remark) {
    const stmt = userDb.prepare(`
      INSERT INTO friend_settings (user_id, friend_id, remark)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, friend_id) 
      DO UPDATE SET remark = ?, updated_at = datetime('now', 'localtime')
    `)
    return stmt.run(userId, friendId, remark, remark)
  }

  /**
   * 设置好友星标
   */
  static setFriendStar(userId, friendId, isStarred) {
    const starred = isStarred ? 1 : 0
    const stmt = userDb.prepare(`
      INSERT INTO friend_settings (user_id, friend_id, is_starred)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, friend_id) 
      DO UPDATE SET is_starred = ?, updated_at = datetime('now', 'localtime')
    `)
    return stmt.run(userId, friendId, starred, starred)
  }

  /**
   * 删除好友
   */
  static removeFriend(userId, friendId) {
    // 删除双向好友关系
    const stmt = userDb.prepare(`DELETE FROM friends WHERE user_id = ? AND friend_id = ?`)
    stmt.run(userId, friendId)
    stmt.run(friendId, userId)

    // 删除设置
    userDb.prepare(`DELETE FROM friend_settings WHERE user_id = ? AND friend_id = ?`)
      .run(userId, friendId)
    userDb.prepare(`DELETE FROM friend_settings WHERE user_id = ? AND friend_id = ?`)
      .run(friendId, userId)
  }
}

module.exports = Friend
