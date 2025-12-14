const { userDb: db } = require('../database/db')

class CheckIn {
  // 打卡
  static create(userId) {
    const today = new Date().toISOString().split('T')[0]
    
    const stmt = db.prepare(`
      INSERT INTO check_ins (user_id, check_in_date)
      VALUES (?, ?)
      ON CONFLICT(user_id, check_in_date) DO NOTHING
    `)
    
    const result = stmt.run(userId, today)
    return result.changes > 0
  }

  // 更新打卡统计
  static updateStats(userId, exerciseCount, correctCount) {
    const today = new Date().toISOString().split('T')[0]
    
    const stmt = db.prepare(`
      UPDATE check_ins 
      SET exercise_count = exercise_count + ?,
          correct_count = correct_count + ?
      WHERE user_id = ? AND check_in_date = ?
    `)
    
    stmt.run(exerciseCount, correctCount, userId, today)
  }

  // 获取用户打卡记录
  static getByUserId(userId, limit = 30) {
    const stmt = db.prepare(`
      SELECT * FROM check_ins
      WHERE user_id = ?
      ORDER BY check_in_date DESC
      LIMIT ?
    `)
    return stmt.all(userId, limit)
  }

  // 获取连续打卡天数
  static getStreakDays(userId) {
    const records = this.getByUserId(userId, 365)
    if (records.length === 0) return 0

    let streak = 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // 检查今天是否打卡（使用本地时间格式）
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    const todayStr = `${year}-${month}-${day}`
    
    const hasTodayCheckIn = records[0].check_in_date === todayStr
    
    // 如果今天没打卡，从昨天开始计算（偏移量为1）
    const startOffset = hasTodayCheckIn ? 0 : 1

    for (let i = 0; i < records.length; i++) {
      // 修复时区问题：使用本地时间解析日期字符串
      const dateStr = records[i].check_in_date
      const [year, month, day] = dateStr.split('-').map(Number)
      const checkInDate = new Date(year, month - 1, day)
      
      const expectedDate = new Date(today)
      expectedDate.setDate(today.getDate() - (i + startOffset))
      expectedDate.setHours(0, 0, 0, 0)

      if (checkInDate.getTime() === expectedDate.getTime()) {
        streak++
      } else {
        break
      }
    }

    return streak
  }

  // 检查今天是否已打卡
  static hasCheckedInToday(userId) {
    const today = new Date().toISOString().split('T')[0]
    
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM check_ins
      WHERE user_id = ? AND check_in_date = ?
    `)
    
    const result = stmt.get(userId, today)
    return result.count > 0
  }

  // 获取打卡排行榜
  static getLeaderboard(type = 'month', limit = 50) {
    let dateFilter = ''
    
    switch(type) {
      case 'week':
        dateFilter = "AND check_in_date >= DATE('now', 'localtime', '-7 days')"
        break
      case 'month':
        dateFilter = "AND check_in_date >= DATE('now', 'localtime', '-30 days')"
        break
      case 'all':
        dateFilter = ''
        break
    }

    const stmt = db.prepare(`
      SELECT 
        u.id,
        u.username,
        u.school,
        COUNT(c.id) as check_in_days,
        SUM(c.exercise_count) as total_exercises,
        SUM(c.correct_count) as total_correct
      FROM users u
      JOIN check_ins c ON u.id = c.user_id
      WHERE 1=1 ${dateFilter}
      GROUP BY u.id
      ORDER BY check_in_days DESC, total_exercises DESC
      LIMIT ?
    `)
    
    return stmt.all(limit)
  }
}

module.exports = CheckIn
