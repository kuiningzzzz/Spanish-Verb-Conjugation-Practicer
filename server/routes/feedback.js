const express = require('express')
const router = express.Router()
const Feedback = require('../models/Feedback')
const User = require('../models/User')
const { authMiddleware } = require('../middleware/auth')

// 提交反馈
router.post('/submit', authMiddleware, async (req, res) => {
  try {
    const { satisfaction, comment } = req.body
    const userId = req.userId
    
    // 获取用户信息
    const user = User.findById(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        error: '用户不存在'
      })
    }

    // 验证满意度评分
    if (!satisfaction || satisfaction < 1 || satisfaction > 4) {
      return res.status(400).json({
        success: false,
        error: '满意度评分必须在1-4之间'
      })
    }

    // 创建反馈
    const feedbackId = Feedback.create({
      userId,
      username: user.username,
      satisfaction: parseInt(satisfaction),
      comment: comment ? comment.trim() : null
    })

    res.json({
      success: true,
      message: '感谢您的反馈！',
      feedbackId
    })
  } catch (error) {
    console.error('提交反馈失败:', error)
    res.status(500).json({
      success: false,
      error: '提交反馈失败，请稍后重试'
    })
  }
})

// 获取用户的反馈历史
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId
    const limit = parseInt(req.query.limit) || 50

    const feedbackList = Feedback.findByUserId(userId, limit)

    res.json({
      success: true,
      feedbackList,
      total: feedbackList.length
    })
  } catch (error) {
    console.error('获取反馈历史失败:', error)
    res.status(500).json({
      success: false,
      error: '获取反馈历史失败'
    })
  }
})

// 获取反馈统计（可选，管理员功能）
router.get('/statistics', authMiddleware, async (req, res) => {
  try {
    const statistics = Feedback.getStatistics()

    res.json({
      success: true,
      statistics
    })
  } catch (error) {
    console.error('获取反馈统计失败:', error)
    res.status(500).json({
      success: false,
      error: '获取反馈统计失败'
    })
  }
})

module.exports = router
