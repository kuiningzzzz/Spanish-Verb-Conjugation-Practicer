const express = require('express')
const router = express.Router()
const Question = require('../models/Question')
const { authMiddleware } = require('../middleware/auth')

// 收藏题目到私人题库（仅支持填空题和例句填空）
router.post('/favorite', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId
    const {
      verbId,
      questionType,
      questionText,
      correctAnswer,
      exampleSentence,
      translation,
      hint,
      tense,
      mood,
      person,
      questionId,        // 如果是从公共题库收藏，传递questionId
      questionSource     // 'public' 表示来自公共题库
    } = req.body

    // 验证题目类型
    if (questionType !== 'fill' && questionType !== 'sentence') {
      return res.status(400).json({ error: '只支持收藏填空题和例句填空' })
    }

    // 添加到私人题库
    const privateQuestionId = Question.addToPrivate(userId, {
      verbId,
      questionType,
      questionText,
      correctAnswer,
      exampleSentence,
      translation,
      hint,
      tense,
      mood,
      person
    })

    // 如果是从公共题库收藏，增加该题目的置信度
    if (questionId && questionSource === 'public') {
      Question.updateConfidence(questionId, 2) // 收藏+2
      console.log(`公共题库题目 ${questionId} 置信度+2`)
    }

    res.json({
      success: true,
      privateQuestionId,
      message: '题目已收藏'
    })
  } catch (error) {
    console.error('收藏题目失败:', error)
    res.status(500).json({ error: '收藏失败' })
  }
})

// 取消收藏题目
router.post('/unfavorite', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId
    const { 
      privateQuestionId,  // 私人题库题目ID
      publicQuestionId    // 对应的公共题库题目ID（如果有）
    } = req.body

    // 从私人题库删除
    const removed = Question.removeFromPrivate(userId, privateQuestionId)

    // 如果有对应的公共题库题目，降低置信度
    if (removed && publicQuestionId) {
      Question.updateConfidence(publicQuestionId, -2) // 取消收藏-2
      console.log(`公共题库题目 ${publicQuestionId} 置信度-2`)
    }

    res.json({
      success: true,
      removed,
      message: removed ? '已取消收藏' : '题目不存在'
    })
  } catch (error) {
    console.error('取消收藏失败:', error)
    res.status(500).json({ error: '取消收藏失败' })
  }
})

// 获取私人题库列表
router.get('/my-questions', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId
    const { questionType } = req.query

    const filters = {}
    if (questionType) {
      filters.questionType = questionType
    }

    const questions = Question.getPrivateByUser(userId, filters)

    res.json({
      success: true,
      questions,
      count: questions.length
    })
  } catch (error) {
    console.error('获取私人题库失败:', error)
    res.status(500).json({ error: '获取失败' })
  }
})

// 获取题库统计信息
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId

    const publicFillCount = Question.getPublicCount({ questionType: 'fill' })
    const publicSentenceCount = Question.getPublicCount({ questionType: 'sentence' })
    const privateFillCount = Question.getPrivateCount(userId, { questionType: 'fill' })
    const privateSentenceCount = Question.getPrivateCount(userId, { questionType: 'sentence' })

    res.json({
      success: true,
      stats: {
        totalCount: privateFillCount + privateSentenceCount,
        fillCount: privateFillCount,
        sentenceCount: privateSentenceCount,
        public: {
          fill: publicFillCount,
          sentence: publicSentenceCount,
          total: publicFillCount + publicSentenceCount
        },
        private: {
          fill: privateFillCount,
          sentence: privateSentenceCount,
          total: privateFillCount + privateSentenceCount
        }
      }
    })
  } catch (error) {
    console.error('获取统计信息失败:', error)
    res.status(500).json({ error: '获取统计失败' })
  }
})

module.exports = router
