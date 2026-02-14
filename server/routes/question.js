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
      questionSource,    // 题目来源
      questionBank,
      publicQuestionSource,
      hostForm,
      hostFormZh,
      pronounPattern,
      ioPronoun,
      doPronoun
    } = req.body

    // 验证题目类型
    if (questionType !== 'sentence') {
      return res.status(400).json({ error: '只支持收藏例句填空' })
    }

    const normalizedPublicSource = (
      questionSource && questionSource !== 'private'
    )
      ? (questionSource === 'public' ? (publicQuestionSource || 'public_traditional') : questionSource)
      : null

    // 添加到私人题库（如果来自公共题库，保存public_question_id）
    const privateQuestionId = Question.addToPrivate(userId, {
      verbId,
      questionType,
      questionBank: questionBank || (normalizedPublicSource === 'public_pronoun' ? 'pronoun' : 'traditional'),
      questionText,
      correctAnswer,
      exampleSentence,
      translation,
      hint,
      tense,
      mood,
      person,
      publicQuestionId: normalizedPublicSource ? questionId : null,
      publicQuestionSource: normalizedPublicSource,
      hostForm,
      hostFormZh,
      pronounPattern,
      ioPronoun,
      doPronoun
    })

    // 如果是从公共题库收藏，增加该题目的置信度
    if (questionId && normalizedPublicSource) {
      const updated = Question.updateConfidence(questionId, 2, normalizedPublicSource)
      if (updated) {
        console.log(`✓ 公共题库题目 ${normalizedPublicSource}:${questionId} 置信度+2`)
      } else {
        console.log(`⚠ 公共题库题目 ${normalizedPublicSource}:${questionId} 不存在，无法更新置信度`)
      }
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

    console.log('收到删除请求:', { userId, privateQuestionId })

    // 从私人题库删除（返回是否删除成功和关联的公共题库ID）
    const result = Question.removeFromPrivate(userId, privateQuestionId)
    console.log('删除结果:', result)

    // 如果删除成功且有关联的公共题库题目，降低置信度
    if (result.removed && result.publicQuestionId) {
      const updated = Question.updateConfidence(
        result.publicQuestionId,
        -2,
        result.publicQuestionSource || 'public_traditional'
      )
      if (updated) {
        console.log(`✓ 公共题库题目 ${result.publicQuestionSource || 'public_traditional'}:${result.publicQuestionId} 置信度-2`)
      } else {
        console.log(`✗ 公共题库题目 ${result.publicQuestionId} 不存在或已被删除，跳过置信度更新`)
      }
    }

    res.json({
      success: true,
      removed: result.removed,
      message: result.removed ? '已取消收藏' : '题目不存在'
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

    const publicSentenceCount = Question.getPublicCount({ questionType: 'sentence' })
    const privateSentenceCount = Question.getPrivateCount(userId, { questionType: 'sentence' })

    res.json({
      success: true,
      stats: {
        totalCount: privateSentenceCount,
        sentenceCount: privateSentenceCount,
        public: {
          sentence: publicSentenceCount,
          total: publicSentenceCount
        },
        private: {
          sentence: privateSentenceCount,
          total: privateSentenceCount
        }
      }
    })
  } catch (error) {
    console.error('获取统计信息失败:', error)
    res.status(500).json({ error: '获取统计失败' })
  }
})

// 用户对题目进行评价（好题/坏题）
router.post('/rate', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId
    const { questionId, questionSource, rating } = req.body

    // 验证参数
    if (!questionId || !questionSource || rating === undefined) {
      return res.status(400).json({ error: '缺少必要参数' })
    }

    if (![1, -1, 0].includes(rating)) {
      return res.status(400).json({ error: '评价值必须为 1(好题)、-1(坏题) 或 0(取消评价)' })
    }

    if (!['public', 'public_traditional', 'public_pronoun', 'private'].includes(questionSource)) {
      return res.status(400).json({ error: '题目来源必须为 public/public_traditional/public_pronoun/private' })
    }

    // 记录评价
    Question.rateQuestion(userId, questionId, questionSource, rating)

    const message = rating === 1 
      ? '我们会多为您推荐这类题目' 
      : rating === -1 
        ? '我们会减少为您推荐这类题目' 
        : '已取消评价'

    res.json({
      success: true,
      message
    })
  } catch (error) {
    console.error('评价题目失败:', error)
    res.status(500).json({ error: '评价失败' })
  }
})

module.exports = router
