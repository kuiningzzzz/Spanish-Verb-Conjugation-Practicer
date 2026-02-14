const { userDb: db } = require('../database/db')

class CheckIn {
  // 打卡
  static create(userId) {
    // 使用本地时区的日期
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    const todayStr = `${year}-${month}-${day}`
    
    const stmt = db.prepare(`
      INSERT INTO check_ins (user_id, check_in_date)
      VALUES (?, ?)
      ON CONFLICT(user_id, check_in_date) DO NOTHING
    `)
    
    const result = stmt.run(userId, todayStr)
    return result.changes > 0
  }

  // 更新打卡统计
  static updateStats(userId, exerciseCount, correctCount) {
    // 使用本地时区的日期
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    const todayStr = `${year}-${month}-${day}`
    
    // 使用 INSERT OR REPLACE 确保记录存在，如果不存在则自动创建
    // 先尝试更新已存在的记录
    const updateStmt = db.prepare(`
      UPDATE check_ins 
      SET exercise_count = exercise_count + ?,
          correct_count = correct_count + ?
      WHERE user_id = ? AND check_in_date = ?
    `)
    
    const result = updateStmt.run(exerciseCount, correctCount, userId, todayStr)
    
    // 如果没有更新任何记录（用户今天还没打卡），则自动创建打卡记录
    if (result.changes === 0) {
      const insertStmt = db.prepare(`
        INSERT INTO check_ins (user_id, check_in_date, exercise_count, correct_count)
        VALUES (?, ?, ?, ?)
      `)
      insertStmt.run(userId, todayStr, exerciseCount, correctCount)
    }
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
    // 使用本地时区的日期
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    const todayStr = `${year}-${month}-${day}`
    
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM check_ins
      WHERE user_id = ? AND check_in_date = ?
    `)
    
    const result = stmt.get(userId, todayStr)
    return result.count > 0
  }

  // 获取总学习天数（实际打卡的天数）
  static getTotalStudyDays(userId) {
    const stmt = db.prepare(`
      SELECT COUNT(DISTINCT check_in_date) as study_days
      FROM check_ins
      WHERE user_id = ?
    `)
    const result = stmt.get(userId)
    return result ? result.study_days : 0
  }

  // 获取用户排名（基于总榜）
  static getUserRank(userId) {
    const stmt = db.prepare(`
      WITH RankedUsers AS (
        SELECT 
          u.id,
          COUNT(c.id) as check_in_days,
          SUM(c.exercise_count) as total_exercises,
          ROW_NUMBER() OVER (ORDER BY COUNT(c.id) DESC, SUM(c.exercise_count) DESC) as rank
        FROM users u
        JOIN check_ins c ON u.id = c.user_id
        GROUP BY u.id
      )
      SELECT rank FROM RankedUsers WHERE id = ?
    `)
    const result = stmt.get(userId)
    return result ? result.rank : 0
  }

  // 老资历榜：按总签到天数排名（不考虑题目数）
  static getVeteranLeaderboard(limit = 50, timeRange = 'all') {
    let dateFilter = ''
    
    switch(timeRange) {
      case 'week':
        dateFilter = "AND c.check_in_date >= DATE('now', 'localtime', '-7 days')"
        break
      case 'month':
        dateFilter = "AND c.check_in_date >= DATE('now', 'localtime', '-30 days')"
        break
      case 'all':
      default:
        dateFilter = ''
    }
    
    const stmt = db.prepare(`
      SELECT 
        u.id,
        u.username,
        u.school,
        u.avatar,
        COUNT(DISTINCT c.check_in_date) as check_in_days,
        SUM(c.exercise_count) as total_exercises,
        SUM(c.correct_count) as total_correct
      FROM users u
      JOIN check_ins c ON u.id = c.user_id
      WHERE u.participate_in_leaderboard = 1 ${dateFilter}
      GROUP BY u.id
      ORDER BY check_in_days DESC
      LIMIT ?
    `)
    
    return stmt.all(limit)
  }

  // 数值怪榜：按总正确题数排名（不考虑天数）
  static getExerciseLeaderboard(limit = 50, timeRange = 'all') {
    let dateFilter = ''
    
    switch(timeRange) {
      case 'week':
        dateFilter = "AND c.check_in_date >= DATE('now', 'localtime', '-7 days')"
        break
      case 'month':
        dateFilter = "AND c.check_in_date >= DATE('now', 'localtime', '-30 days')"
        break
      case 'all':
      default:
        dateFilter = ''
    }
    
    const stmt = db.prepare(`
      SELECT 
        u.id,
        u.username,
        u.school,
        u.avatar,
        COUNT(DISTINCT c.check_in_date) as check_in_days,
        SUM(c.exercise_count) as total_exercises,
        SUM(c.correct_count) as total_correct
      FROM users u
      JOIN check_ins c ON u.id = c.user_id
      WHERE u.participate_in_leaderboard = 1 ${dateFilter}
      GROUP BY u.id
      ORDER BY total_correct DESC
      LIMIT ?
    `)
    
    return stmt.all(limit)
  }

  // 焊武帝榜：按连续签到天数排名
  static getStreakLeaderboard(limit = 50) {
    // 获取所有参与排行榜的用户
    const usersStmt = db.prepare(`
      SELECT id, username, school, avatar
      FROM users
      WHERE participate_in_leaderboard = 1
    `)
    const users = usersStmt.all()

    // 计算每个用户的连续签到天数
    const leaderboard = users.map(user => {
      const streakDays = this.getStreakDays(user.id)
      const totalDays = this.getTotalStudyDays(user.id)
      
      // 获取总题目数
      const statsStmt = db.prepare(`
        SELECT 
          SUM(exercise_count) as total_exercises,
          SUM(correct_count) as total_correct
        FROM check_ins
        WHERE user_id = ?
      `)
      const stats = statsStmt.get(user.id)

      return {
        id: user.id,
        username: user.username,
        school: user.school,
        avatar: user.avatar,
        consecutive_days: streakDays,
        check_in_days: totalDays,
        total_exercises: stats?.total_exercises || 0,
        total_correct: stats?.total_correct || 0
      }
    })

    // 只保留连续天数大于0的用户，并按连续天数降序排序
    return leaderboard
      .filter(user => user.consecutive_days > 0)
      .sort((a, b) => b.consecutive_days - a.consecutive_days)
      .slice(0, limit)
  }

  // 获取打卡排行榜（保留旧接口以兼容）
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
        u.avatar,
        COUNT(c.id) as check_in_days,
        SUM(c.exercise_count) as total_exercises,
        SUM(c.correct_count) as total_correct
      FROM users u
      JOIN check_ins c ON u.id = c.user_id
      WHERE u.participate_in_leaderboard = 1 ${dateFilter}
      GROUP BY u.id
      ORDER BY check_in_days DESC, total_exercises DESC
      LIMIT ?
    `)
    
    return stmt.all(limit)
  }
}

module.exports = CheckIn
