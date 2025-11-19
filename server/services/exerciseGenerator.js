const Verb = require('../models/Verb')
const Conjugation = require('../models/Conjugation')
const Question = require('../models/Question')
const DeepSeekService = require('./deepseek')
const QuestionValidatorService = require('./questionValidator')

/**
 * 题目生成服务（带题库和AI混合模式）
 */
class ExerciseGeneratorService {
  /**
   * 生成单个题目
   * 策略：
   * - 选择题和变位题：使用固定算法生成（不调用AI）
   * - 填空题和例句填空：80-90%从题库，10-20%用AI生成
   */
  static async generateOne(options) {
    const {
      userId,
      exerciseType,
      tenses = [],
      conjugationTypes = [],
      includeIrregular = true,
      practiceMode = 'normal',
      verbIds = null
    } = options

    // 选择题和变位题：直接用固定算法
    if (exerciseType === 'choice' || exerciseType === 'conjugate') {
      return await this.generateTraditionalExercise(options)
    }

    // 填空题和例句填空：混合模式
    if (exerciseType === 'fill' || exerciseType === 'sentence') {
      // 决定使用题库还是AI生成（80-90%题库，10-20%AI）
      const useQuestionBank = Math.random() < 0.85 // 85%使用题库

      if (useQuestionBank) {
        // 从题库获取
        const questionBankExercise = await this.getFromQuestionBank(options)
        if (questionBankExercise) {
          return questionBankExercise
        }
        // 题库没有合适题目，降级到AI生成
      }

      // AI生成新题
      return await this.generateWithAI(options)
    }

    // 默认使用传统方法
    return await this.generateTraditionalExercise(options)
  }

  /**
   * 从题库获取题目
   */
  static async getFromQuestionBank(options) {
    const { userId, exerciseType, tenses, conjugationTypes, includeIrregular } = options

    try {
      // 先尝试从公共题库获取
      const publicQuestion = Question.getRandomFromPublic({
        questionType: exerciseType,
        tenses,
        conjugationTypes,
        includeIrregular,
        limit: 1
      })

      if (publicQuestion) {
        return this.formatQuestionBankExercise(publicQuestion, 'public')
      }

      // 如果公共题库没有，尝试从用户私人题库获取
      if (userId) {
        const privateQuestion = Question.getRandomFromPrivate(userId, {
          questionType: exerciseType,
          limit: 1
        })

        if (privateQuestion) {
          return this.formatQuestionBankExercise(privateQuestion, 'private')
        }
      }

      return null
    } catch (error) {
      console.error('从题库获取题目失败:', error)
      return null
    }
  }

  /**
   * 格式化题库题目为标准练习格式
   */
  static formatQuestionBankExercise(question, sourceType) {
    const conjugationTypeMap = {
      1: '第一变位',
      2: '第二变位',
      3: '第三变位'
    }

    const exercise = {
      questionId: question.id,
      questionSource: sourceType, // 'public' or 'private'
      verbId: question.verb_id,
      infinitive: question.infinitive,
      meaning: question.meaning,
      tense: question.tense,
      mood: question.mood,
      person: question.person,
      correctAnswer: question.correct_answer,
      exerciseType: question.question_type,
      conjugationType: conjugationTypeMap[question.conjugation_type] || '未知',
      isIrregular: question.is_irregular === 1,
      fromQuestionBank: true
    }

    if (question.question_type === 'sentence') {
      exercise.sentence = question.question_text
      exercise.translation = question.translation
      exercise.hint = question.hint
    } else if (question.question_type === 'fill') {
      exercise.question = question.question_text
      exercise.example = question.example_sentence
      exercise.hint = question.hint
    }

    return exercise
  }

  /**
   * 使用AI生成新题目
   */
  static async generateWithAI(options) {
    const { userId, exerciseType, tenses, conjugationTypes, includeIrregular, verbIds } = options

    // 获取动词
    const queryOptions = {}
    if (verbIds && verbIds.length > 0) {
      queryOptions.verbIds = verbIds
    } else {
      if (conjugationTypes && conjugationTypes.length > 0) {
        queryOptions.conjugationTypes = conjugationTypes
      }
      if (!includeIrregular) {
        queryOptions.onlyRegular = true
      }
    }

    const verbs = Verb.getRandom(1, queryOptions)
    if (verbs.length === 0) {
      throw new Error('没有符合条件的动词')
    }

    const verb = verbs[0]
    const conjugations = Conjugation.getByVerbId(verb.id)
    if (conjugations.length === 0) {
      throw new Error('该动词没有变位数据')
    }

    // 根据时态筛选
    let filteredConjugations = conjugations
    if (tenses && tenses.length > 0) {
      const tenseMap = {
        'presente': '现在时',
        'preterito': '简单过去时',
        'futuro': '将来时'
      }
      const selectedTenseNames = tenses.map(t => tenseMap[t]).filter(Boolean)
      filteredConjugations = conjugations.filter(c => selectedTenseNames.includes(c.tense))
    }

    if (filteredConjugations.length === 0) {
      throw new Error('没有符合所选时态的变位数据')
    }

    const randomConjugation = filteredConjugations[Math.floor(Math.random() * filteredConjugations.length)]

    // 使用AI生成题目
    let aiResult
    if (exerciseType === 'sentence') {
      aiResult = await DeepSeekService.generateSentenceExercise(verb, randomConjugation)
    } else if (exerciseType === 'fill') {
      aiResult = await DeepSeekService.generateFillBlankExercise(verb, randomConjugation)
    } else {
      throw new Error('不支持的AI生成题型')
    }

    // 验证AI生成的题目
    const validation = await QuestionValidatorService.quickValidate({
      questionType: exerciseType,
      questionText: exerciseType === 'sentence' ? aiResult.sentence : aiResult.question,
      correctAnswer: aiResult.answer || randomConjugation.conjugated_form,
      exampleSentence: aiResult.example,
      translation: aiResult.translation,
      hint: aiResult.hint,
      verb: verb
    })

    // 如果验证通过，保存到公共题库（统一初始置信度为50）
    if (validation.passed) {
      try {
        const questionData = {
          verbId: verb.id,
          questionType: exerciseType,
          questionText: exerciseType === 'sentence' ? aiResult.sentence : aiResult.question,
          correctAnswer: aiResult.answer || randomConjugation.conjugated_form,
          exampleSentence: aiResult.example,
          translation: aiResult.translation,
          hint: aiResult.hint,
          tense: randomConjugation.tense,
          mood: randomConjugation.mood,
          person: randomConjugation.person,
          confidenceScore: 50  // 所有新生成题目的初始置信度统一为50
        }

        // 检查是否已存在相同题目
        if (!Question.existsInPublic(verb.id, questionData.questionText)) {
          Question.addToPublic(questionData)
          console.log(`新题目已加入公共题库（初始置信度: 50）`)
        }
      } catch (error) {
        console.error('保存题目到题库失败:', error)
      }
    } else {
      console.log(`AI生成的题目未通过验证: ${validation.reason}`)
    }

    // 格式化返回
    const conjugationTypeMap = { 1: '第一变位', 2: '第二变位', 3: '第三变位' }

    const exercise = {
      verbId: verb.id,
      infinitive: verb.infinitive,
      meaning: verb.meaning,
      tense: randomConjugation.tense,
      mood: randomConjugation.mood,
      person: randomConjugation.person,
      correctAnswer: aiResult.answer || randomConjugation.conjugated_form,
      exerciseType: exerciseType,
      conjugationType: conjugationTypeMap[verb.conjugation_type] || '未知',
      isIrregular: verb.is_irregular === 1,
      fromQuestionBank: false,
      aiGenerated: true
    }

    if (exerciseType === 'sentence') {
      exercise.sentence = aiResult.sentence
      exercise.translation = aiResult.translation
      exercise.hint = aiResult.hint
    } else if (exerciseType === 'fill') {
      exercise.question = aiResult.question
      exercise.example = aiResult.example
      exercise.hint = aiResult.hint
    }

    return exercise
  }

  /**
   * 使用传统固定算法生成（选择题、变位题）
   */
  static async generateTraditionalExercise(options) {
    const { exerciseType, tenses, conjugationTypes, includeIrregular, verbIds } = options

    // 获取动词
    const queryOptions = {}
    if (verbIds && verbIds.length > 0) {
      queryOptions.verbIds = verbIds
    } else {
      if (conjugationTypes && conjugationTypes.length > 0) {
        queryOptions.conjugationTypes = conjugationTypes
      }
      if (!includeIrregular) {
        queryOptions.onlyRegular = true
      }
    }

    const verbs = Verb.getRandom(1, queryOptions)
    if (verbs.length === 0) {
      throw new Error('没有符合条件的动词')
    }

    const verb = verbs[0]
    const conjugations = Conjugation.getByVerbId(verb.id)
    if (conjugations.length === 0) {
      throw new Error('该动词没有变位数据')
    }

    // 根据时态筛选
    let filteredConjugations = conjugations
    if (tenses && tenses.length > 0) {
      const tenseMap = {
        'presente': '现在时',
        'preterito': '简单过去时',
        'futuro': '将来时'
      }
      const selectedTenseNames = tenses.map(t => tenseMap[t]).filter(Boolean)
      filteredConjugations = conjugations.filter(c => selectedTenseNames.includes(c.tense))
    }

    if (filteredConjugations.length === 0) {
      throw new Error('没有符合所选时态的变位数据')
    }

    const randomConjugation = filteredConjugations[Math.floor(Math.random() * filteredConjugations.length)]
    const conjugationTypeMap = { 1: '第一变位', 2: '第二变位', 3: '第三变位' }

    const exercise = {
      verbId: verb.id,
      infinitive: verb.infinitive,
      meaning: verb.meaning,
      tense: randomConjugation.tense,
      mood: randomConjugation.mood,
      person: randomConjugation.person,
      correctAnswer: randomConjugation.conjugated_form,
      exerciseType: exerciseType,
      conjugationType: conjugationTypeMap[verb.conjugation_type] || '未知',
      isIrregular: verb.is_irregular === 1,
      fromQuestionBank: false,
      aiGenerated: false
    }

    // 选择题：生成干扰选项
    if (exerciseType === 'choice') {
      const options = this.generateChoiceOptions(randomConjugation, filteredConjugations)
      exercise.options = options
    }

    // 变位题
    if (exerciseType === 'conjugate') {
      exercise.question = `请写出 ${verb.infinitive}(${verb.meaning}) 的变位`
    }

    return exercise
  }

  /**
   * 生成选择题干扰选项
   */
  static generateChoiceOptions(correctConjugation, allConjugations) {
    const options = [correctConjugation.conjugated_form]
    const otherForms = allConjugations
      .filter(c => c.conjugated_form !== correctConjugation.conjugated_form)
      .map(c => c.conjugated_form)

    // 随机选择3个干扰项
    while (options.length < 4 && otherForms.length > 0) {
      const randomIndex = Math.floor(Math.random() * otherForms.length)
      options.push(otherForms.splice(randomIndex, 1)[0])
    }

    // 打乱选项顺序
    return options.sort(() => Math.random() - 0.5)
  }
}

module.exports = ExerciseGeneratorService
