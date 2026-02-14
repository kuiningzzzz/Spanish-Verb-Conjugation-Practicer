const express = require('express')
const router = express.Router()
const Verb = require('../models/Verb')
const Conjugation = require('../models/Conjugation')
const PracticeRecord = require('../models/PracticeRecord')
const Question = require('../models/Question')
const CheckIn = require('../models/CheckIn')
const ExerciseGeneratorService = require('../services/exerciseGenerator')
const QuestionGeneratorService = require('../services/traditional_conjugation/questionGenerator')
const { authMiddleware } = require('../middleware/auth')

// 批量生成练习题（新版：题库+AI混合模式，带题目池管理）
router.post('/generate-batch', authMiddleware, async (req, res) => {
  try {
    const {
      exerciseType,
      count = 10,
      tenses = [],
      moods = [],
      conjugationTypes = [],
      includeRegular = true,
      includeVos = false,
      includeVosotros = true,
      reduceRareTenseFrequency = true,
      practiceMode = 'normal',
      verbIds = null,  // 从请求体接收 verbIds（课程模式会传递）
      sentenceMode = 'verb-only',
      conjugationForms = [],
      hostForms = []
    } = req.body

    const userId = req.userId

    // 准备生成选项
    const options = {
      userId,
      exerciseType,
      count,
      tenses,
      moods,
      conjugationTypes,
      includeRegular,
      includeVos,
      includeVosotros,
      reduceRareTenseFrequency,
      practiceMode,
      verbIds,  // 直接使用前端传递的 verbIds
      sentenceMode,
      conjugationForms,
      hostForms
    }

    // 根据练习模式获取动词ID列表（仅在未传递 verbIds 时生效）
    if (!verbIds || verbIds.length === 0) {
      if (practiceMode === 'favorite') {
        const FavoriteVerb = require('../models/FavoriteVerb')
        const favoriteVerbIds = FavoriteVerb.getVerbIds(userId)
        
        if (favoriteVerbIds.length === 0) {
          return res.status(404).json({ error: '还没有收藏的单词' })
        }
        
        options.verbIds = favoriteVerbIds
      } else if (practiceMode === 'wrong') {
        const WrongVerb = require('../models/WrongVerb')
        const wrongVerbIds = WrongVerb.getVerbIds(userId)
        
        if (wrongVerbIds.length === 0) {
          return res.status(404).json({ error: '还没有错题记录' })
        }
        
        options.verbIds = wrongVerbIds
      }
    }

    // 批量生成题目和题目池
    const result = await ExerciseGeneratorService.generateBatch(options)

    res.json({
      success: true,
      exercises: result.exercises,
      questionPool: result.questionPool,  // 返回题目池供前端管理
      needAI: result.needAI || 0,         // 需要异步生成的AI题目数量
      aiOptions: result.aiOptions || null, // AI生成所需参数（单计划）
      aiPlans: result.aiPlans || null      // AI生成计划（多计划，如 mixed）
    })
  } catch (error) {
    console.error('批量生成练习题错误:', error)
    res.status(500).json({ error: error.message || '批量生成练习题失败' })
  }
})

// 生成单个练习题（保留向后兼容）
router.post('/generate-one', authMiddleware, async (req, res) => {
  try {
    const {
      exerciseType,
      tenses = [],
      moods = [],
      conjugationTypes = [],
      includeRegular = true,
      includeVos = false,
      includeVosotros = true,
      reduceRareTenseFrequency = true,
      practiceMode = 'normal',
      sentenceMode = 'verb-only',
      conjugationForms = [],
      hostForms = []
    } = req.body

    const userId = req.userId

    // 准备生成选项
    const options = {
      userId,
      exerciseType,
      tenses,
      moods,
      conjugationTypes,
      includeRegular,
      includeVos,
      includeVosotros,
      reduceRareTenseFrequency,
      practiceMode,
      sentenceMode,
      conjugationForms,
      hostForms
    }

    // 根据练习模式获取动词ID列表
    if (practiceMode === 'favorite') {
      const FavoriteVerb = require('../models/FavoriteVerb')
      const verbIds = FavoriteVerb.getVerbIds(userId)
      
      if (verbIds.length === 0) {
        return res.status(404).json({ error: '还没有收藏的单词' })
      }
      
      options.verbIds = verbIds
    } else if (practiceMode === 'wrong') {
      const WrongVerb = require('../models/WrongVerb')
      const verbIds = WrongVerb.getVerbIds(userId)
      
      if (verbIds.length === 0) {
        return res.status(404).json({ error: '还没有错题记录' })
      }
      
      options.verbIds = verbIds
    }

    // 使用新的生成服务
    const exercise = await ExerciseGeneratorService.generateOne(options)

    res.json({
      success: true,
      exercise
    })
  } catch (error) {
    console.error('生成练习题错误:', error)
    res.status(500).json({ error: error.message || '生成练习题失败' })
  }
})

// 单个AI题目异步生成（供前端异步调用）
router.post('/generate-single-ai', authMiddleware, async (req, res) => {
  try {
    const { aiOptions } = req.body

    if (!aiOptions) {
      return res.status(400).json({ error: '缺少AI生成参数' })
    }

    // 生成单个AI题目
    const exercise = await ExerciseGeneratorService.generateSingleAI(aiOptions)

    res.json({
      success: true,
      exercise
    })
  } catch (error) {
    console.error('单个AI题目生成错误:', error)
    res.status(500).json({ error: error.message || 'AI题目生成失败' })
  }
})

// 生成练习题（批量模式，保留向后兼容）
router.post('/generate', authMiddleware, async (req, res) => {
  try {
    const {
      exerciseType,
      count = 10,
      lessonNumber,
      textbookVolume,
      useAI = true,
      includeVos = false,
      includeVosotros = true
    } = req.body

    // 获取动词
    const verbs = Verb.getRandom(count, { lessonNumber, textbookVolume })
    
    if (verbs.length === 0) {
      return res.status(404).json({ error: '没有可用的动词' })
    }

    const exercises = []

    for (const verb of verbs) {
      const conjugations = Conjugation.getByVerbId(verb.id)
      
      if (conjugations.length === 0) continue

      const filteredConjugations = ExerciseGeneratorService.filterConjugationsByPronounSettings(
        conjugations,
        includeVos,
        includeVosotros
      )
      if (filteredConjugations.length === 0) continue

      const randomConjugation = filteredConjugations[Math.floor(Math.random() * filteredConjugations.length)]

      let exercise = {
        id: exercises.length + 1,
        verbId: verb.id,
        infinitive: verb.infinitive,
        meaning: verb.meaning,
        tense: ExerciseGeneratorService.normalizeTenseName(randomConjugation.tense),
        mood: randomConjugation.mood,
        person: randomConjugation.person,
        correctAnswer: randomConjugation.conjugated_form,
        exerciseType
      }

      // 根据题型生成不同的题目
      try {
        switch (exerciseType) {
          case 'sentence':
            // 句子完成题：使用 AI 生成高质量例句
            if (useAI) {
              const aiSentence = await QuestionGeneratorService.generateSentenceExercise(verb, randomConjugation)
              exercise.sentence = aiSentence.sentence
              exercise.translation = aiSentence.translation
              exercise.hint = ExerciseGeneratorService.buildHint(
                randomConjugation.person,
                randomConjugation.tense,
                randomConjugation.mood
              )
            } else {
              exercise.sentence = generateSentence(verb, randomConjugation)
            }
            break
            
          case 'quick-fill':
            // 快变快填：不使用AI
            const givenConjugation = filteredConjugations[Math.floor(Math.random() * filteredConjugations.length)]
            exercise.givenForm = givenConjugation.conjugated_form
            exercise.givenDesc = ExerciseGeneratorService.buildHint(
              givenConjugation.person,
              givenConjugation.tense,
              givenConjugation.mood
            )
            break
            
          case 'combo-fill':
            // 组合填空：不使用AI
            const selectedConjugations = filteredConjugations
              .sort(() => Math.random() - 0.5)
              .slice(0, Math.min(6, filteredConjugations.length))
            exercise.comboItems = selectedConjugations.map(c => ({
              tense: ExerciseGeneratorService.normalizeTenseName(c.tense),
              mood: c.mood,
              person: c.person,
              correctAnswer: c.conjugated_form
            }))
            break
        }
      } catch (aiError) {
        console.error('AI 生成失败，使用传统方法:', aiError.message)
        // AI 失败时使用传统方法
        if (exerciseType === 'sentence') {
          exercise.sentence = generateSentence(verb, randomConjugation)
        }
      }

      exercises.push(exercise)
    }

    res.json({
      success: true,
      exercises,
      aiEnhanced: useAI
    })
  } catch (error) {
    console.error('生成练习题错误:', error)
    res.status(500).json({ error: '生成练习题失败' })
  }
})

// 提交答案
router.post('/submit', authMiddleware, (req, res) => {
  try {
    const { 
      verbId, 
      exerciseType, 
      answer, 
      correctAnswer, 
      tense, 
      mood, 
      person,
      questionId,        // 题库题目ID（如果来自题库）
      questionSource     // 题目来源：public_traditional/public_pronoun/private（兼容 public）
    } = req.body

    const userId = req.userId

    // 判断答案是否正确（支持多个答案，用 | 分隔）
    let isCorrect = false
    const userAnswer = answer !== undefined && answer !== null ? String(answer) : ''
    const correctAnswers = String(correctAnswer || '').split('|')
    
    // 只要匹配任意一个正确答案即可
    for (const correct of correctAnswers) {
      if (userAnswer === correct) {
        isCorrect = true
        break
      }
    }

    // 保存练习记录
    PracticeRecord.create({
      userId: userId,
      verbId,
      exerciseType,
      isCorrect: isCorrect ? 1 : 0,
      answer,
      correctAnswer,
      tense,
      mood,
      person
    })

    // 更新今日打卡统计（练习数+1，如果答对则正确数+1）
    try {
      CheckIn.updateStats(userId, 1, isCorrect ? 1 : 0)
    } catch (error) {
      console.error('更新打卡统计失败:', error)
      // 不影响主流程
    }

    // 如果是题库题目，记录用户练习情况
    if (questionId && questionSource) {
      try {
        // 记录练习（包括答对和答错），但不影响置信度
        Question.recordPractice(userId, questionId, questionSource, isCorrect)
      } catch (error) {
        console.error('记录题库答题信息失败:', error)
      }
    }

    res.json({
      success: true,
      isCorrect,
      correctAnswer
    })
  } catch (error) {
    console.error('提交答案错误:', error)
    res.status(500).json({ error: '提交答案失败' })
  }
})

// 生成句子
function generateSentence(verb, conjugation) {
  const subjects = {
    'yo': 'Yo',
    'tú': 'Tú',
    'él/ella/usted': 'Él',
    'nosotros': 'Nosotros',
    'vosotros': 'Vosotros',
    'ellos/ellas/ustedes': 'Ellos'
  }
  
  const subject = subjects[conjugation.person] || 'Yo'
  return `${subject} _____ (${verb.infinitive})`
}

module.exports = router
