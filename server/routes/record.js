const express = require('express')
const router = express.Router()
const PracticeRecord = require('../models/PracticeRecord')
const { authMiddleware } = require('../middleware/auth')

// 获取练习记录列表
router.get('/list', authMiddleware, (req, res) => {
  try {
    const records = PracticeRecord.getByUserId(req.userId)

    res.json({
      success: true,
      records
    })
  } catch (error) {
    console.error('获取练习记录错误:', error)
    res.status(500).json({ error: '获取练习记录失败' })
  }
})

// 获取统计数据
router.get('/statistics', authMiddleware, (req, res) => {
  try {
    const stats = PracticeRecord.getStatistics(req.userId)
    const todayStats = PracticeRecord.getTodayStatistics(req.userId)
    const masteredVerbs = PracticeRecord.getMasteredVerbs(req.userId)

    res.json({
      success: true,
      statistics: {
        total: stats,
        today: {
          total: todayStats.total_exercises || 0,
          correct: todayStats.correct_exercises || 0
        },
        masteredVerbsCount: masteredVerbs.length,
        masteredVerbs: masteredVerbs.slice(0, 10) // 只返回前10个
      }
    })
  } catch (error) {
    console.error('获取统计数据错误:', error)
    res.status(500).json({ error: '获取统计数据失败' })
  }
})

// 获取学习趋势数据
router.get('/trend/:type', authMiddleware, (req, res) => {
  try {
    const { type } = req.params // week, month, year
    const userId = req.userId

    const trendData = PracticeRecord.getTrendData(userId, type)

    res.json({
      success: true,
      trend: trendData
    })
  } catch (error) {
    console.error('获取趋势数据错误:', error)
    res.status(500).json({ error: '获取趋势数据失败' })
  }
})

module.exports = router
