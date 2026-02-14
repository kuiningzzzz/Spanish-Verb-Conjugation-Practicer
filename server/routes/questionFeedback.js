const express = require('express')
const router = express.Router()
const QuestionFeedback = require('../models/QuestionFeedback')
const Question = require('../models/Question')
const User = require('../models/User')
const { authMiddleware } = require('../middleware/auth')

// 提交题目反馈
router.post('/submit', authMiddleware, async (req, res) => {
  try {
    const { 
      exerciseType,      // 前端使用 exerciseType
      infinitive,        // 前端使用 infinitive
      verbId,
      questionId,
      answer,            // 前端使用 answer
      answers,           // 前端使用 answers（组合填空）
      issueTypes,        // 问题类型数组
      feedbackText,      // 前端使用 feedbackText
      mood,
      tense,
      person,
      questionSource
    } = req.body
    const userId = req.userId
    
    console.log('收到题目反馈请求:', req.body)
    
    // 获取用户信息
    const user = User.findById(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        error: '用户不存在'
      })
    }

    // 验证必填字段
    if (!exerciseType || !infinitive) {
      return res.status(400).json({
        success: false,
        error: '题目类型和动词原形为必填项'
      })
    }

    // 验证问题类型
    if (!issueTypes || !Array.isArray(issueTypes) || issueTypes.length === 0) {
      return res.status(400).json({
        success: false,
        error: '请至少选择一个问题类型'
      })
    }

    // 根据题型确定questionAnswer
    let questionAnswer = null
    if (exerciseType === 'combo-fill' && answers) {
      // 组合填空使用answers字段（已经是逗号分隔的字符串）
      questionAnswer = answers
    } else if (answer) {
      // 其他题型使用answer字段
      questionAnswer = answer
    }

    if (!questionAnswer && questionId) {
      if (questionSource) {
        questionAnswer = Question.findAnswerById(questionId, questionSource, userId)
      } else {
        questionAnswer = Question.findAnswerById(questionId, 'public', userId)
          || Question.findAnswerById(questionId, 'private', userId)
      }
    }

    // 将问题类型数组转换为逗号分隔的字符串
    const issueTypesString = issueTypes.join(',')

    // 创建题目反馈
    const feedbackId = QuestionFeedback.create({
      userId,
      username: user.username,
      questionType: exerciseType,
      verbInfinitive: infinitive,
      verbId,
      questionId,
      questionAnswer,
      issueTypes: issueTypesString,
      userComment: feedbackText ? feedbackText.trim() : null,
      mood,
      tense,
      person,
      questionSource
    })

    // 如果是公共题库的题目，降低置信度3分
    if (questionId && questionSource === 'public') {
      const updated = Question.updateConfidence(questionId, -3)
      if (updated) {
        console.log(`✓ 收到题目反馈，公共题库题目 ${questionId} 置信度-3`)
      } else {
        console.log(`⚠ 公共题库题目 ${questionId} 不存在，无法更新置信度`)
      }
    }

    res.json({
      success: true,
      message: '感谢您的反馈！我们会尽快处理',
      feedbackId
    })
  } catch (error) {
    console.error('提交题目反馈失败:', error)
    res.status(500).json({
      success: false,
      error: '提交反馈失败，请稍后重试'
    })
  }
})

// 获取用户的题目反馈历史
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId
    const limit = parseInt(req.query.limit) || 50

    const feedbackList = QuestionFeedback.findByUserId(userId, limit)

    res.json({
      success: true,
      feedbackList,
      total: feedbackList.length
    })
  } catch (error) {
    console.error('获取题目反馈历史失败:', error)
    res.status(500).json({
      success: false,
      error: '获取题目反馈历史失败'
    })
  }
})

// 获取所有题目反馈（管理员功能）
router.get('/all', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100
    const offset = parseInt(req.query.offset) || 0

    const feedbackList = QuestionFeedback.findAll(limit, offset)

    res.json({
      success: true,
      feedbackList,
      total: feedbackList.length
    })
  } catch (error) {
    console.error('获取所有题目反馈失败:', error)
    res.status(500).json({
      success: false,
      error: '获取题目反馈失败'
    })
  }
})

// 根据题目类型获取反馈
router.get('/by-type/:type', authMiddleware, async (req, res) => {
  try {
    const { type } = req.params
    const limit = parseInt(req.query.limit) || 50

    const feedbackList = QuestionFeedback.findByQuestionType(type, limit)

    res.json({
      success: true,
      feedbackList,
      total: feedbackList.length
    })
  } catch (error) {
    console.error('获取题目反馈失败:', error)
    res.status(500).json({
      success: false,
      error: '获取题目反馈失败'
    })
  }
})

// 根据动词获取反馈
router.get('/by-verb/:verb', authMiddleware, async (req, res) => {
  try {
    const { verb } = req.params
    const limit = parseInt(req.query.limit) || 50

    const feedbackList = QuestionFeedback.findByVerb(verb, limit)

    res.json({
      success: true,
      feedbackList,
      total: feedbackList.length
    })
  } catch (error) {
    console.error('获取题目反馈失败:', error)
    res.status(500).json({
      success: false,
      error: '获取题目反馈失败'
    })
  }
})

// 获取题目反馈统计
router.get('/statistics', authMiddleware, async (req, res) => {
  try {
    const statistics = QuestionFeedback.getStatistics()

    res.json({
      success: true,
      statistics
    })
  } catch (error) {
    console.error('获取题目反馈统计失败:', error)
    res.status(500).json({
      success: false,
      error: '获取题目反馈统计失败'
    })
  }
})

// 删除题目反馈（管理员功能）
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params

    const result = QuestionFeedback.delete(parseInt(id))

    if (result.changes > 0) {
      res.json({
        success: true,
        message: '删除成功'
      })
    } else {
      res.status(404).json({
        success: false,
        error: '反馈不存在'
      })
    }
  } catch (error) {
    console.error('删除题目反馈失败:', error)
    res.status(500).json({
      success: false,
      error: '删除失败'
    })
  }
})

module.exports = router
