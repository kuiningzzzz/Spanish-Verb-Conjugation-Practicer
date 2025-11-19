const express = require('express')
const router = express.Router()
const Verb = require('../models/Verb')
const Conjugation = require('../models/Conjugation')
const PracticeRecord = require('../models/PracticeRecord')
const DeepSeekService = require('../services/deepseek')
const { authMiddleware } = require('../middleware/auth')

// 生成单个练习题（流水线模式）
router.post('/generate-one', authMiddleware, async (req, res) => {
  try {
    const { 
      exerciseType, 
      lessonNumber, 
      textbookVolume, 
      useAI = true,
      tenses = [],           // 选择的时态数组
      conjugationTypes = [], // 选择的变位类型数组
      includeIrregular = true // 是否包含不规则动词
    } = req.body

    // 构建查询条件
    const queryOptions = { lessonNumber, textbookVolume }
    
    // 如果指定了变位类型，添加到查询条件
    if (conjugationTypes && conjugationTypes.length > 0) {
      queryOptions.conjugationTypes = conjugationTypes
    }
    
    // 如果不包含不规则动词，添加到查询条件
    if (!includeIrregular) {
      queryOptions.onlyRegular = true
    }

    // 获取一个随机动词
    const verbs = Verb.getRandom(1, queryOptions)
    
    if (verbs.length === 0) {
      return res.status(404).json({ error: '没有符合条件的动词' })
    }

    const verb = verbs[0]
    const conjugations = Conjugation.getByVerbId(verb.id)
    
    if (conjugations.length === 0) {
      return res.status(404).json({ error: '该动词没有变位数据' })
    }

    // 根据选择的时态筛选变位
    let filteredConjugations = conjugations
    if (tenses && tenses.length > 0) {
      // 时态映射（前端传来的值 -> 数据库中的值）
      const tenseMap = {
        'presente': '现在时',
        'preterito': '简单过去时',
        'futuro': '将来时',
        'imperfecto': '过去未完成时',
        'condicional': '条件式'
      }
      
      const selectedTenseNames = tenses.map(t => tenseMap[t]).filter(Boolean)
      filteredConjugations = conjugations.filter(c => selectedTenseNames.includes(c.tense))
    }
    
    if (filteredConjugations.length === 0) {
      return res.status(404).json({ error: '没有符合所选时态的变位数据' })
    }

    const randomConjugation = filteredConjugations[Math.floor(Math.random() * filteredConjugations.length)]

    // 变位类型数字转文字
    const conjugationTypeMap = {
      1: '第一变位',
      2: '第二变位',
      3: '第三变位'
    }

    let exercise = {
      verbId: verb.id,
      infinitive: verb.infinitive,
      meaning: verb.meaning,
      tense: randomConjugation.tense,
      mood: randomConjugation.mood,
      person: randomConjugation.person,
      correctAnswer: randomConjugation.conjugated_form,
      exerciseType,
      conjugationType: conjugationTypeMap[verb.conjugation_type] || '未知',  // 将数字转换为文字
      isIrregular: verb.is_irregular === 1      // 添加是否不规则信息
    }

    // 根据题型生成不同的题目
    try {
      switch (exerciseType) {
        case 'choice':
          if (useAI) {
            exercise.options = await DeepSeekService.generateChoiceOptions(verb, randomConjugation, filteredConjugations)
          } else {
            exercise.options = generateChoiceOptions(verb.id, randomConjugation, filteredConjugations)
          }
          break
        
        case 'fill':
          if (useAI) {
            const aiExercise = await DeepSeekService.generateFillBlankExercise(verb, randomConjugation)
            exercise.question = aiExercise.question
            exercise.hint = aiExercise.hint
            exercise.example = aiExercise.example
          } else {
            exercise.question = `请填写动词 ${verb.infinitive}(${verb.meaning}) 在 ${randomConjugation.mood} ${randomConjugation.tense} ${randomConjugation.person} 的变位形式`
          }
          break
        
        case 'conjugate':
          exercise.question = `请写出 ${verb.infinitive}(${verb.meaning}) 的变位`
          break
        
        case 'sentence':
          if (useAI) {
            const aiSentence = await DeepSeekService.generateSentenceExercise(verb, randomConjugation)
            exercise.sentence = aiSentence.sentence
            exercise.translation = aiSentence.translation
            exercise.hint = aiSentence.hint
          } else {
            exercise.sentence = generateSentence(verb, randomConjugation)
          }
          break
      }
    } catch (aiError) {
      console.error('AI 生成失败，使用传统方法:', aiError.message)
      if (exerciseType === 'choice') {
        exercise.options = generateChoiceOptions(verb.id, randomConjugation, filteredConjugations)
      } else if (exerciseType === 'sentence') {
        exercise.sentence = generateSentence(verb, randomConjugation)
      }
    }

    res.json({
      success: true,
      exercise,
      aiEnhanced: useAI
    })
  } catch (error) {
    console.error('生成练习题错误:', error)
    res.status(500).json({ error: '生成练习题失败' })
  }
})

// 生成练习题（批量模式，保留向后兼容）
router.post('/generate', authMiddleware, async (req, res) => {
  try {
    const { exerciseType, count = 10, lessonNumber, textbookVolume, useAI = true } = req.body

    // 获取动词
    const verbs = Verb.getRandom(count, { lessonNumber, textbookVolume })
    
    if (verbs.length === 0) {
      return res.status(404).json({ error: '没有可用的动词' })
    }

    const exercises = []

    for (const verb of verbs) {
      const conjugations = Conjugation.getByVerbId(verb.id)
      
      if (conjugations.length === 0) continue

      const randomConjugation = conjugations[Math.floor(Math.random() * conjugations.length)]

      let exercise = {
        id: exercises.length + 1,
        verbId: verb.id,
        infinitive: verb.infinitive,
        meaning: verb.meaning,
        tense: randomConjugation.tense,
        mood: randomConjugation.mood,
        person: randomConjugation.person,
        correctAnswer: randomConjugation.conjugated_form,
        exerciseType
      }

      // 根据题型生成不同的题目
      try {
        switch (exerciseType) {
          case 'choice':
            // 选择题：使用 AI 生成更好的干扰选项
            if (useAI) {
              exercise.options = await DeepSeekService.generateChoiceOptions(verb, randomConjugation, conjugations)
            } else {
              exercise.options = generateChoiceOptions(verb.id, randomConjugation, conjugations)
            }
            break
          
          case 'fill':
            // 填空题：使用 AI 生成更有针对性的题目
            if (useAI) {
              const aiExercise = await DeepSeekService.generateFillBlankExercise(verb, randomConjugation)
              exercise.question = aiExercise.question
              exercise.hint = aiExercise.hint
              exercise.example = aiExercise.example
            } else {
              exercise.question = `请填写动词 ${verb.infinitive}(${verb.meaning}) 在 ${randomConjugation.mood} ${randomConjugation.tense} ${randomConjugation.person} 的变位形式`
            }
            break
          
          case 'conjugate':
            // 变位题：给出时态和人称
            exercise.question = `请写出 ${verb.infinitive}(${verb.meaning}) 的变位`
            break
          
          case 'sentence':
            // 句子完成题：使用 AI 生成高质量例句
            if (useAI) {
              const aiSentence = await DeepSeekService.generateSentenceExercise(verb, randomConjugation)
              exercise.sentence = aiSentence.sentence
              exercise.translation = aiSentence.translation
              exercise.hint = aiSentence.hint
            } else {
              exercise.sentence = generateSentence(verb, randomConjugation)
            }
            break
        }
      } catch (aiError) {
        console.error('AI 生成失败，使用传统方法:', aiError.message)
        // AI 失败时使用传统方法
        if (exerciseType === 'choice') {
          exercise.options = generateChoiceOptions(verb.id, randomConjugation, conjugations)
        } else if (exerciseType === 'sentence') {
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
    const { verbId, exerciseType, answer, correctAnswer, tense, mood, person } = req.body

    // 判断答案是否正确
    const isCorrect = answer.trim().toLowerCase() === correctAnswer.trim().toLowerCase()

    // 保存练习记录
    PracticeRecord.create({
      userId: req.userId,
      verbId,
      exerciseType,
      isCorrect: isCorrect ? 1 : 0,
      answer,
      correctAnswer,
      tense,
      mood,
      person
    })

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

// 生成选择题选项
function generateChoiceOptions(verbId, correctConjugation, allConjugations) {
  const options = [correctConjugation.conjugated_form]
  
  // 从相同动词的其他变位中选择干扰项
  const otherConjugations = allConjugations.filter(c => 
    c.conjugated_form !== correctConjugation.conjugated_form
  )
  
  // 随机选择3个干扰项
  const shuffled = otherConjugations.sort(() => 0.5 - Math.random())
  for (let i = 0; i < Math.min(3, shuffled.length); i++) {
    options.push(shuffled[i].conjugated_form)
  }
  
  // 打乱选项顺序
  return options.sort(() => 0.5 - Math.random())
}

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
