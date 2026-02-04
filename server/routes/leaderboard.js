const express = require('express')
const router = express.Router()
const CheckIn = require('../models/CheckIn')
const { authMiddleware } = require('../middleware/auth')

// 获取排行榜
router.get('/:type', authMiddleware, (req, res) => {
  try {
    const { type } = req.params // veteran, exercise, streak
    const limit = parseInt(req.query.limit) || 50

    let leaderboard

    switch(type) {
      case 'veteran': // 老资历榜
        leaderboard = CheckIn.getVeteranLeaderboard(limit)
        break
      case 'exercise': // 数值怪榜
        leaderboard = CheckIn.getExerciseLeaderboard(limit)
        break
      case 'streak': // 焊武帝榜
        leaderboard = CheckIn.getStreakLeaderboard(limit)
        break
      default:
        return res.status(400).json({ error: '无效的榜单类型' })
    }

    res.json({
      success: true,
      type,
      leaderboard
    })
  } catch (error) {
    console.error('获取排行榜错误:', error)
    res.status(500).json({ error: '获取排行榜失败' })
  }
})

module.exports = router
