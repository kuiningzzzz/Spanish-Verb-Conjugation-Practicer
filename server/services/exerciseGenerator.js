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
   * 生成单个题目（保留向后兼容）
   */
  static async generateOne(options) {
    const batch = await this.generateBatch({ ...options, count: 1 })
    return batch.exercises[0]
  }

  /**
   * 批量生成题目（新策略）
   * 策略：
   * - 选择题和变位题：使用固定算法生成（不调用AI）
   * - 填空题和例句填空：按比例从题库和AI混合获取
   * - 一次性生成所有需要的题目，管理题目池
   */
  static async generateBatch(options) {
    const {
      userId,
      exerciseType,
      count = 10,
      tenses = [],
      conjugationTypes = [],
      includeRegular = true,
      includeVos = false,
      includeVosotros = true,
      practiceMode = 'normal',
      verbIds = null
    } = options

    const exercises = []
    const questionPool = [] // 题目池

    // 快变快填和组合填空：直接用固定算法生成所有题目（同步、不使用AI）
    if (exerciseType === 'quick-fill' || exerciseType === 'combo-fill') {
      console.log(`批量生成 - 使用传统算法生成${exerciseType === 'quick-fill' ? '快变快填' : '组合填空'}题: ${count}个`)
      
      // 使用Set来跟踪已生成的题目，避免重复
      const generatedKeys = new Set()
      const maxAttempts = count * 10 // 最大尝试次数，避免无限循环
      let attempts = 0
      
      while (exercises.length < count && attempts < maxAttempts) {
        attempts++
        try {
          const exercise = this.generateTraditionalExercise(options)
          
          // 生成唯一键
          let key
          if (exerciseType === 'quick-fill') {
            key = `${exercise.verbId}-${exercise.tense}-${exercise.mood}-${exercise.person}`
          } else {
            key = `${exercise.verbId}-${exercise.mood}`
          }
          
          // 检查是否重复
          if (!generatedKeys.has(key)) {
            generatedKeys.add(key)
            exercises.push(exercise)
          }
        } catch (error) {
          // 生成失败，继续尝试下一个
          console.log(`题目生成失败，继续尝试: ${error.message}`)
          continue
        }
      }
      
      // 如果尝试次数用完还没达到要求的数量，输出警告
      if (exercises.length < count) {
        console.warn(`警告: 只生成了 ${exercises.length}/${count} 个不重复的题目`)
      }
      
      return { exercises, questionPool: [] }
    }

    // 例句填空：混合模式
    if (exerciseType === 'sentence') {
      // 计算题库题和AI题的数量（85%题库，15%AI）
      const bankCount = Math.round(count * 0.85)
      let actualBankCount = 0  // 实际从题库获取的数量

      // 从题库获取题目池（一次性获取所需数量）
      if (bankCount > 0 && userId) {
        console.log(`批量生成 - 准备从题库获取:`, { bankCount, exerciseType, practiceMode, verbIds: verbIds?.length })
        
        const smartQuestions = Question.getSmartFromPublic(userId, {
          questionType: exerciseType,
          tenses,
          conjugationTypes,
          includeRegular,
          verbIds  // 添加verbIds筛选，用于收藏/错题专练
        }, bankCount)

        actualBankCount = smartQuestions.length
        console.log(`批量生成 - 题库返回:`, {
          returnedCount: actualBankCount,
          questionIds: smartQuestions.map(q => q.id)
        })

        // 将题库题目添加到题目池，使用Set确保题目ID不重复
        const seenQuestionIds = new Set()
        const uniqueQuestions = smartQuestions.filter(q => {
          if (seenQuestionIds.has(q.id)) {
            console.warn(`题目池构建时发现重复题目ID: ${q.id}，已过滤`)
            return false
          }
          seenQuestionIds.add(q.id)
          return true
        })
        
        questionPool.push(...uniqueQuestions.map((q, index) => ({
          ...this.formatQuestionBankExercise(q, 'public'),
          _fromPool: true,
          _poolIndex: questionPool.length + index
        })))
        
        actualBankCount = uniqueQuestions.length
        console.log(`批量生成 - 题目池最终数量（去重后）: ${actualBankCount}`)
      }

      // 计算需要AI生成的数量：总数 - 实际从题库获取的数量
      const aiCount = count - actualBankCount
      console.log(`批量生成 - AI题目数量:`, { total: count, fromBank: actualBankCount, needAI: aiCount })

      // 性能优化：立即返回题库题目（如果有的话），AI题目由前端异步调用生成
      if (aiCount > 0) {
        // 准备AI生成所需的参数
        const aiOptions = {
          exerciseType,
          tenses,
          userId,
          conjugationTypes,
          includeRegular,
          verbIds,  // 传递verbIds用于收藏/错题专练
          moods: options.moods  // 传递moods参数
        }
        
        if (actualBankCount > 0) {
          console.log(`立即返回 ${actualBankCount} 个题库题目，前端需异步生成 ${aiCount} 个AI题目`)
        } else {
          console.log(`题库为空，前端需异步生成全部 ${aiCount} 个AI题目`)
        }
        
        return { 
          exercises,        // AI生成的题目（暂时为空）
          questionPool,     // 题库题目（可能为空）
          needAI: aiCount,  // 需要生成的AI题目数量
          aiOptions         // AI生成所需参数
        }
      }

      return { exercises, questionPool }
    }

    // 默认使用传统方法
    for (let i = 0; i < count; i++) {
      const exercise = await this.generateTraditionalExercise(options)
      exercises.push(exercise)
    }
    return { exercises, questionPool: [] }
  }

  /**
   * 从题库获取题目（使用智能推荐算法）
   */
  static async getFromQuestionBank(options) {
    const { userId, exerciseType, tenses, conjugationTypes, includeRegular } = options

    try {
      // 使用智能推荐算法从公共题库获取
      if (userId) {
        const smartQuestions = Question.getSmartFromPublic(userId, {
          questionType: exerciseType,
          tenses,
          conjugationTypes,
          includeRegular
        }, 1)

        if (smartQuestions.length > 0) {
          return this.formatQuestionBankExercise(smartQuestions[0], 'public')
        }
      } else {
        // 如果没有用户ID，使用旧的随机方法
        const publicQuestion = Question.getRandomFromPublic({
          questionType: exerciseType,
          tenses,
          conjugationTypes,
          includeRegular,
          limit: 1
        })

        if (publicQuestion) {
          return this.formatQuestionBankExercise(publicQuestion, 'public')
        }
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
      isReflexive: question.is_reflexive === 1,
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
   * 验证AI返回数据的完整性
   */
  static validateAIResultData(aiResult, exerciseType) {
    if (!aiResult) {
      return { valid: false, reason: 'AI返回结果为空' }
    }

    if (exerciseType === 'sentence') {
      // 例句填空题必须字段
      if (!aiResult.sentence || aiResult.sentence === 'undefined') {
        return { valid: false, reason: '例句字段缺失或为undefined' }
      }
      if (!aiResult.translation || aiResult.translation === 'undefined') {
        return { valid: false, reason: '翻译字段缺失或为undefined' }
      }
      if (!aiResult.answer || aiResult.answer === 'undefined') {
        return { valid: false, reason: '答案字段缺失或为undefined' }
      }
    } else if (exerciseType === 'fill') {
      // 填空题必须字段
      if (!aiResult.question || aiResult.question === 'undefined') {
        return { valid: false, reason: '题目字段缺失或为undefined' }
      }
      if (!aiResult.answer || aiResult.answer === 'undefined') {
        return { valid: false, reason: '答案字段缺失或为undefined' }
      }
      // example字段是可选的，但不能是字符串'undefined'
      if (aiResult.example === 'undefined') {
        aiResult.example = null  // 修正为null
      }
    }

    return { valid: true }
  }

  /**
   * 使用AI生成新题目（带重试机制）
   */
  static async generateWithAI(options) {
    const { userId, exerciseType, tenses, conjugationTypes, includeRegular, verbIds } = options
    const maxRetries = 3  // 最多重试3次

    // 获取动词
    const queryOptions = {}
    if (verbIds && verbIds.length > 0) {
      queryOptions.verbIds = verbIds
    } else {
      if (conjugationTypes && conjugationTypes.length > 0) {
        queryOptions.conjugationTypes = conjugationTypes
      }
      if (!includeRegular) {
        queryOptions.onlyIrregular = true
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

    // 扩展的时态映射（支持所有18种时态）
    const tenseMap = {
      // 简单陈述式（5个）
      'presente': '现在时',
      'preterito': '简单过去时',
      'imperfecto': '未完成过去时',
      'futuro': '将来时',
      'condicional': '条件式',
      // 虚拟式（3个）
      'subjuntivo_presente': '虚拟现在时',
      'subjuntivo_imperfecto': '虚拟过去时',
      'subjuntivo_futuro': '虚拟将来时',
      // 命令式（2个）
      'imperativo_afirmativo': '肯定命令式',
      'imperativo_negativo': '否定命令式',
      // 复合陈述式（5个）
      'perfecto': '现在完成时',
      'pluscuamperfecto': '过去完成时',
      'futuro_perfecto': '将来完成时',
      'condicional_perfecto': '条件完成时',
      'preterito_anterior': '先过去时',
      // 复合虚拟式（3个）
      'subjuntivo_perfecto': '虚拟现在完成时',
      'subjuntivo_pluscuamperfecto': '虚拟过去完成时',
      'subjuntivo_futuro_perfecto': '虚拟将来完成时'
    }

    // 语气映射
    const moodMap = {
      'indicativo': '陈述式',
      'subjuntivo': '虚拟式',
      'imperativo': '命令式',
      'indicativo_compuesto': '复合陈述式',
      'subjuntivo_compuesto': '复合虚拟式'
    }

    // 根据时态和语气筛选
    let filteredConjugations = conjugations
    
    // 优先按语气筛选（如果指定了moods参数）
    if (options.moods && options.moods.length > 0) {
      const selectedMoodNames = options.moods.map(m => moodMap[m]).filter(Boolean)
      filteredConjugations = filteredConjugations.filter(c => selectedMoodNames.includes(c.mood))
    }
    
    // 再按时态筛选
    if (tenses && tenses.length > 0) {
      const selectedTenseNames = tenses.map(t => tenseMap[t]).filter(Boolean)
      filteredConjugations = filteredConjugations.filter(c => selectedTenseNames.includes(c.tense))
    }

    if (filteredConjugations.length === 0) {
      throw new Error('没有符合所选时态和语气的变位数据')
    }

    const randomConjugation = filteredConjugations[Math.floor(Math.random() * filteredConjugations.length)]

    // 重试循环：最多尝试3次生成和验证
    let aiResult = null
    let validation = null
    let lastError = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[AI生成] 为${verb.infinitive}第${attempt}次尝试生成题目 (类型: ${exerciseType})`)

        // 使用AI生成题目
        if (exerciseType === 'sentence') {
          aiResult = await DeepSeekService.generateSentenceExercise(verb, randomConjugation)
        } else if (exerciseType === 'fill') {
          aiResult = await DeepSeekService.generateFillBlankExercise(verb, randomConjugation)
        } else {
          throw new Error('不支持的AI生成题型')
        }

        // 数据完整性检查
        const dataCheck = this.validateAIResultData(aiResult, exerciseType)
        if (!dataCheck.valid) {
          console.log(`[AI生成] 第${attempt}次数据验证失败: ${dataCheck.reason}`)
          lastError = dataCheck.reason
          continue  // 重试
        }

        // 验证AI生成的题目质量
        validation = await QuestionValidatorService.quickValidate({
          questionType: exerciseType,
          questionText: exerciseType === 'sentence' ? aiResult.sentence : aiResult.question,
          correctAnswer: aiResult.answer || randomConjugation.conjugated_form,
          exampleSentence: exerciseType === 'sentence' ? aiResult.sentence : (aiResult.example || null),
          translation: aiResult.translation || null,
          hint: aiResult.hint || null,
          verb: verb
        })

        // 如果验证通过，跳出循环
        if (validation.passed) {
          console.log(`[AI生成] 第${attempt}次尝试成功，题目通过验证`)
          break
        } else {
          console.log(`[AI生成] 第${attempt}次质量验证未通过: ${validation.reason}`)
          lastError = validation.reason
          
          // 如果不是最后一次尝试，继续重试（短延迟）
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }
      } catch (error) {
        console.error(`[AI生成] 第${attempt}次尝试出错:`, error.message)
        lastError = error.message
        
        // 如果不是最后一次尝试，继续重试
        // 对于服务繁忙错误，使用更长的延迟
        if (attempt < maxRetries) {
          const isServiceBusy = error.message.includes('繁忙') || error.message.includes('频繁')
          const delay = isServiceBusy ? 3000 : 1500
          console.log(`[AI生成] ${delay/1000}秒后重试...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    // 3次尝试后的处理
    if (!validation || !validation.passed || !aiResult) {
      console.log(`[AI生成] 经过${maxRetries}次尝试仍未生成合格题目，最后错误: ${lastError}`)
      
      // 填空题和例句填空无法用传统方法生成，直接返回错误
      if (exerciseType === 'fill' || exerciseType === 'sentence') {
        console.log(`[AI生成] 填空题/例句填空无法降级，返回null`)
        return null
      }
      
      // 选择题和变位题可以降级使用传统算法（同步方法）
      console.log(`[AI生成] 降级使用传统算法生成题目`)
      return this.generateTraditionalExercise(options)
    }

    // 验证通过，保存到公共题库（统一初始置信度为50）
    let savedQuestionId = null
    try {
      const questionData = {
        verbId: verb.id,
        questionType: exerciseType,
        questionText: exerciseType === 'sentence' ? aiResult.sentence : aiResult.question,
        correctAnswer: aiResult.answer || randomConjugation.conjugated_form,
        exampleSentence: exerciseType === 'sentence' ? aiResult.sentence : (aiResult.example || null),
        translation: aiResult.translation || null,
        hint: aiResult.hint || null,
        tense: randomConjugation.tense,
        mood: randomConjugation.mood,
        person: randomConjugation.person,
        confidenceScore: 50  // 所有新生成题目的初始置信度统一为50
      }

      // 检查是否已存在相同题目
      if (!Question.existsInPublic(verb.id, questionData.questionText)) {
        savedQuestionId = Question.addToPublic(questionData)
        console.log(`新题目已加入公共题库（ID: ${savedQuestionId}，初始置信度: 50）`)
      } else {
        // 如果已存在，获取已有题目的ID
        const existing = Question.findByVerbAndText(verb.id, questionData.questionText)
        if (existing) {
          savedQuestionId = existing.id
          console.log(`题目已存在于题库（ID: ${savedQuestionId}）`)
        }
      }
    } catch (error) {
      console.error('保存题目到题库失败:', error)
    }

    // 格式化返回
    const conjugationTypeMap = { 1: '第一变位', 2: '第二变位', 3: '第三变位' }

    const exercise = {
      questionId: savedQuestionId,  // 添加questionId
      questionSource: 'public',      // 添加questionSource
      verbId: verb.id,
      infinitive: verb.infinitive,
      meaning: verb.meaning,
      tense: randomConjugation.tense,
      mood: randomConjugation.mood,
      person: randomConjugation.person,
      correctAnswer: aiResult.answer || randomConjugation.conjugated_form,
      exerciseType: exerciseType,
      conjugationType: conjugationTypeMap[verb.conjugation_type] || '未知',
      isIrregular: verb.is_irregular === 1,      isReflexive: randomVerb.is_reflexive === 1,      fromQuestionBank: false,
      aiGenerated: true
    }

    if (exerciseType === 'sentence') {
      exercise.sentence = aiResult.sentence
      exercise.translation = aiResult.translation
      exercise.hint = aiResult.hint
    } else if (exerciseType === 'fill') {
      exercise.question = aiResult.question
      exercise.example = aiResult.example || null
      exercise.hint = aiResult.hint
    }

    return exercise
  }

  /**
   * 为指定动词使用AI生成题目（批量生成专用）
   */
  static async generateWithAIForVerb(verb, options) {
    const { exerciseType, tenses, userId } = options
    const maxRetries = 3

    const conjugations = Conjugation.getByVerbId(verb.id)
    if (conjugations.length === 0) {
      throw new Error('该动词没有变位数据')
    }

    // 扩展的时态映射（支持所有18种时态）
    const tenseMap = {
      // 简单陈述式（5个）
      'presente': '现在时',
      'preterito': '简单过去时',
      'imperfecto': '未完成过去时',
      'futuro': '将来时',
      'condicional': '条件式',
      // 虚拟式（3个）
      'subjuntivo_presente': '虚拟现在时',
      'subjuntivo_imperfecto': '虚拟过去时',
      'subjuntivo_futuro': '虚拟将来时',
      // 命令式（2个）
      'imperativo_afirmativo': '肯定命令式',
      'imperativo_negativo': '否定命令式',
      // 复合陈述式（5个）
      'perfecto': '现在完成时',
      'pluscuamperfecto': '过去完成时',
      'futuro_perfecto': '将来完成时',
      'condicional_perfecto': '条件完成时',
      'preterito_anterior': '先过去时',
      // 复合虚拟式（3个）
      'subjuntivo_perfecto': '虚拟现在完成时',
      'subjuntivo_pluscuamperfecto': '虚拟过去完成时',
      'subjuntivo_futuro_perfecto': '虚拟将来完成时'
    }

    // 语气映射
    const moodMap = {
      'indicativo': '陈述式',
      'subjuntivo': '虚拟式',
      'imperativo': '命令式',
      'indicativo_compuesto': '复合陈述式',
      'subjuntivo_compuesto': '复合虚拟式'
    }

    // 根据时态和语气筛选
    let filteredConjugations = conjugations
    
    // 优先按语气筛选（如果指定了moods参数）
    if (options.moods && options.moods.length > 0) {
      const selectedMoodNames = options.moods.map(m => moodMap[m]).filter(Boolean)
      filteredConjugations = filteredConjugations.filter(c => selectedMoodNames.includes(c.mood))
    }
    
    // 再按时态筛选
    if (tenses && tenses.length > 0) {
      const selectedTenseNames = tenses.map(t => tenseMap[t]).filter(Boolean)
      filteredConjugations = filteredConjugations.filter(c => selectedTenseNames.includes(c.tense))
    }

    if (filteredConjugations.length === 0) {
      throw new Error('没有符合所选时态和语气的变位数据')
    }

    const randomConjugation = filteredConjugations[Math.floor(Math.random() * filteredConjugations.length)]

    // 重试循环
    let aiResult = null
    let validation = null
    let lastError = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[AI生成] 为${verb.infinitive}第${attempt}次尝试生成题目 (类型: ${exerciseType})`)

        if (exerciseType === 'sentence') {
          aiResult = await DeepSeekService.generateSentenceExercise(verb, randomConjugation)
        } else if (exerciseType === 'fill') {
          aiResult = await DeepSeekService.generateFillBlankExercise(verb, randomConjugation)
        } else {
          throw new Error('不支持的AI生成题型')
        }

        const dataCheck = this.validateAIResultData(aiResult, exerciseType)
        if (!dataCheck.valid) {
          console.log(`[AI生成] 第${attempt}次数据验证失败: ${dataCheck.reason}`)
          lastError = dataCheck.reason
          continue
        }

        validation = await QuestionValidatorService.quickValidate({
          questionType: exerciseType,
          questionText: exerciseType === 'sentence' ? aiResult.sentence : aiResult.question,
          correctAnswer: aiResult.answer || randomConjugation.conjugated_form,
          exampleSentence: exerciseType === 'sentence' ? aiResult.sentence : (aiResult.example || null),
          translation: aiResult.translation || null,
          hint: aiResult.hint || null,
          verb: verb
        })

        if (validation.passed) {
          console.log(`[AI生成] 第${attempt}次尝试成功`)
          break
        } else {
          console.log(`[AI生成] 第${attempt}次质量验证未通过: ${validation.reason}`)
          lastError = validation.reason
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 500))
          }
        }
      } catch (error) {
        console.error(`[AI生成] 第${attempt}次尝试出错:`, error.message)
        lastError = error.message
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    }

    if (!validation || !validation.passed || !aiResult) {
      console.log(`[AI生成] ${verb.infinitive}经过${maxRetries}次尝试仍未生成合格题目`)
      return null
    }

    // 保存到公共题库
    let savedQuestionId = null
    try {
      const questionData = {
        verbId: verb.id,
        questionType: exerciseType,
        questionText: exerciseType === 'sentence' ? aiResult.sentence : aiResult.question,
        correctAnswer: aiResult.answer || randomConjugation.conjugated_form,
        exampleSentence: exerciseType === 'sentence' ? aiResult.sentence : (aiResult.example || null),
        translation: aiResult.translation || null,
        hint: aiResult.hint || null,
        tense: randomConjugation.tense,
        mood: randomConjugation.mood,
        person: randomConjugation.person,
        confidenceScore: 50
      }

      if (!Question.existsInPublic(verb.id, questionData.questionText)) {
        savedQuestionId = Question.addToPublic(questionData)
        console.log(`新题目已加入公共题库: ${verb.infinitive} (ID: ${savedQuestionId})`)
      } else {
        const existing = Question.findByVerbAndText(verb.id, questionData.questionText)
        if (existing) {
          savedQuestionId = existing.id
          console.log(`题目已存在: ${verb.infinitive} (ID: ${savedQuestionId})`)
        }
      }
    } catch (error) {
      console.error('保存题目到题库失败:', error)
    }

    // 格式化返回
    const conjugationTypeMap = { 1: '第一变位', 2: '第二变位', 3: '第三变位' }

    const exercise = {
      questionId: savedQuestionId,  // 添加questionId
      questionSource: 'public',      // 添加questionSource
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
      isReflexive: verb.is_reflexive === 1,
      fromQuestionBank: false,
      aiGenerated: true
    }

    if (exerciseType === 'sentence') {
      exercise.sentence = aiResult.sentence
      exercise.translation = aiResult.translation
      exercise.hint = aiResult.hint
    } else if (exerciseType === 'fill') {
      exercise.question = aiResult.question
      exercise.example = aiResult.example || null
      exercise.hint = aiResult.hint
    }

    return exercise
  }

  /**
   * 单个AI题目异步生成（供前端调用）
   */
  static async generateSingleAI(options) {
    const { exerciseType, tenses, userId, conjugationTypes, includeRegular, verbIds, excludeVerbIds = [] } = options

    // 准备动词查询选项
    const queryOptions = {}
    if (verbIds && verbIds.length > 0) {
      queryOptions.verbIds = verbIds
    } else {
      if (conjugationTypes && conjugationTypes.length > 0) {
        queryOptions.conjugationTypes = conjugationTypes
      }
      if (!includeRegular) {
        queryOptions.onlyIrregular = true
      }
      // 排除已使用的动诋ID
      if (excludeVerbIds && excludeVerbIds.length > 0) {
        queryOptions.excludeVerbIds = excludeVerbIds
      }
    }

    // 获取多个候选动词（预防失败）
    const aiVerbs = Verb.getRandom(3, queryOptions)
    if (aiVerbs.length === 0) {
      throw new Error('没有可用的动词')
    }

    console.log(`单个AI生成 - 获取候选动词:`, aiVerbs.map(v => v.infinitive))

    // 尝试为每个动词生成，直到成功
    for (const verb of aiVerbs) {
      try {
        const aiExercise = await this.generateWithAIForVerb(verb, {
          exerciseType,
          tenses,
          userId
        })
        
        if (aiExercise) {
          console.log(`单个AI生成成功: ${verb.infinitive}`)
          return aiExercise
        }
      } catch (error) {
        console.error(`为动词 ${verb.infinitive} 生成AI题目失败:`, error.message)
      }
    }

    // 所有动词都失败，尝试从题库补充
    console.log('AI生成全部失败，尝试从题库补充')
    if (userId) {
      const supplementQuestions = Question.getSmartFromPublic(userId, {
        questionType: exerciseType,
        tenses,
        conjugationTypes,
        includeRegular
      }, 1)

      if (supplementQuestions.length > 0) {
        return this.formatQuestionBankExercise(supplementQuestions[0], 'public')
      }
    }

    throw new Error('AI生成失败且题库无可用题目')
  }

  /**
   * 使用传统固定算法生成（选择题、变位题）
   * 注意：该方法为同步方法，不涉及AI，不需要await
   */
  static generateTraditionalExercise(options) {
    const { exerciseType, tenses, conjugationTypes, includeRegular, verbIds } = options

    // 获取动词
    const queryOptions = {}
    if (verbIds && verbIds.length > 0) {
      queryOptions.verbIds = verbIds
    } else {
      if (conjugationTypes && conjugationTypes.length > 0) {
        queryOptions.conjugationTypes = conjugationTypes
      }
      if (!includeRegular) {
        queryOptions.onlyIrregular = true
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

    // 扩展的时态映射（支持所有18种时态）
    const tenseMap = {
      // 简单陈述式（5个）
      'presente': '现在时',
      'preterito': '简单过去时',
      'imperfecto': '未完成过去时',
      'futuro': '将来时',
      'condicional': '条件式',
      // 虚拟式（3个）
      'subjuntivo_presente': '虚拟现在时',
      'subjuntivo_imperfecto': '虚拟过去时',
      'subjuntivo_futuro': '虚拟将来时',
      // 命令式（2个）
      'imperativo_afirmativo': '肯定命令式',
      'imperativo_negativo': '否定命令式',
      // 复合陈述式（5个）
      'perfecto': '现在完成时',
      'pluscuamperfecto': '过去完成时',
      'futuro_perfecto': '将来完成时',
      'condicional_perfecto': '条件完成时',
      'preterito_anterior': '先过去时',
      // 复合虚拟式（3个）
      'subjuntivo_perfecto': '虚拟现在完成时',
      'subjuntivo_pluscuamperfecto': '虚拟过去完成时',
      'subjuntivo_futuro_perfecto': '虚拟将来完成时'
    }

    // 语气映射
    const moodMap = {
      'indicativo': '陈述式',
      'subjuntivo': '虚拟式',
      'imperativo': '命令式',
      'indicativo_compuesto': '复合陈述式',
      'subjuntivo_compuesto': '复合虚拟式'
    }

    // 根据时态和语气筛选
    let filteredConjugations = conjugations
    
    // 优先按语气筛选（如果指定了moods参数）
    if (options.moods && options.moods.length > 0) {
      const selectedMoodNames = options.moods.map(m => moodMap[m]).filter(Boolean)
      filteredConjugations = filteredConjugations.filter(c => selectedMoodNames.includes(c.mood))
    }
    
    // 再按时态筛选
    if (tenses && tenses.length > 0) {
      const selectedTenseNames = tenses.map(t => tenseMap[t]).filter(Boolean)
      filteredConjugations = filteredConjugations.filter(c => selectedTenseNames.includes(c.tense))
    }
    
    // 根据人称选项筛选
    if (options.includeVos === false) {
      // 排除 vos（拉美第二人称单数）
      filteredConjugations = filteredConjugations.filter(c => c.person !== 'vos')
    }
    
    if (options.includeVosotros === false) {
      // 排除 vosotros（西班牙第二人称复数）
      filteredConjugations = filteredConjugations.filter(c => c.person !== 'vosotros' && c.person !== 'vosotras')
    }

    if (filteredConjugations.length === 0) {
      throw new Error('没有符合所选时态和语气的变位数据')
    }

    const conjugationTypeMap = { 1: '第一变位', 2: '第二变位', 3: '第三变位' }

    // 快变快填题
    if (exerciseType === 'quick-fill') {
      // 随机选择一个变位作为给定形式
      const givenConjugation = filteredConjugations[Math.floor(Math.random() * filteredConjugations.length)]
      // 再随机选择一个不同的变位作为目标形式
      const targetConjugation = filteredConjugations[Math.floor(Math.random() * filteredConjugations.length)]
      
      const exercise = {
        verbId: verb.id,
        infinitive: verb.infinitive,
        meaning: verb.meaning,
        mood: targetConjugation.mood,
        tense: targetConjugation.tense,
        person: targetConjugation.person,
        correctAnswer: targetConjugation.conjugated_form,
        exerciseType: 'quick-fill',
        conjugationType: conjugationTypeMap[verb.conjugation_type] || '未知',
        isIrregular: verb.is_irregular === 1,
        fromQuestionBank: false,
        aiGenerated: false,
        givenForm: givenConjugation.conjugated_form,
        givenDesc: `${givenConjugation.mood} - ${givenConjugation.tense} - ${givenConjugation.person}`
      }
      
      return exercise
    }

    // 组合填空题 - 任意6个随机变位组合（不限于同一语气）
    if (exerciseType === 'combo-fill') {
      if (filteredConjugations.length < 6) {
        throw new Error('该动词在所选范围内的变位数少于6个，无法生成组合填空题')
      }
      
      // 随机打乱所有可用变位
      const shuffled = [...filteredConjugations].sort(() => Math.random() - 0.5)
      
      // 选择前6个
      const selectedConjugations = shuffled.slice(0, 6)
      
      // 构建组合填空题目
      const comboItems = selectedConjugations.map(c => ({
        tense: c.tense,
        mood: c.mood,
        person: c.person,
        correctAnswer: c.conjugated_form
      }))
      
      const exercise = {
        verbId: verb.id,
        infinitive: verb.infinitive,
        meaning: verb.meaning,
        mood: '混合',  // 因为是任意组合，不再限制单一语气
        exerciseType: 'combo-fill',
        conjugationType: conjugationTypeMap[verb.conjugation_type] || '未知',
        isIrregular: verb.is_irregular === 1,
        fromQuestionBank: false,
        aiGenerated: false,
        comboItems: comboItems,
        correctAnswer: comboItems[0].correctAnswer  // 用于统计的代表答案
      }
      
      return exercise
    }

    // 如果是其他题型，返回基本结构
    const randomConjugation = filteredConjugations[Math.floor(Math.random() * filteredConjugations.length)]
    
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

    return exercise
  }

  /**
   * 生成选择题干扰选项（已弃用）
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
