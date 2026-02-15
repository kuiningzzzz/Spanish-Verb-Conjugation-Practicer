const Verb = require('../models/Verb')
const Conjugation = require('../models/Conjugation')
const Question = require('../models/Question')
const QuestionGeneratorService = require('./traditional_conjugation/questionGenerator')
const QuestionValidatorService = require('./traditional_conjugation/questionValidator')
const QuestionRevisorService = require('./traditional_conjugation/questionRevisor')
const PronounQuestionGeneratorService = require('./conjugation_with_pronoun/questionGenerator')
const PronounQuestionValidatorService = require('./conjugation_with_pronoun/questionValidator')
const PronounQuestionRevisorService = require('./conjugation_with_pronoun/questionRevisor')

const PUBLIC_SOURCE_TRADITIONAL = 'public_traditional'
const PUBLIC_SOURCE_PRONOUN = 'public_pronoun'

/**
 * 题目生成服务（带题库和AI混合模式）
 */
class ExerciseGeneratorService {
  static normalizeTenseName(tense) {
    const tenseAliasMap = {
      '先过去时': '前过去时',
      '虚拟将来时': '虚拟将来未完成时'
    }
    return tenseAliasMap[tense] || tense
  }

  static normalizePersonLabel(person) {
    const personLabelMap = {
      'yo': '第一人称单数',
      'tú': '第二人称单数',
      'vos': '第二人称单数',
      'él': '第三人称单数',
      'ella': '第三人称单数',
      'usted': '第三人称单数',
      'él/ella/usted': '第三人称单数',
      'nosotros': '第一人称复数',
      'nosotras': '第一人称复数',
      'nosotros/nosotras': '第一人称复数',
      'vosotros': '第二人称复数',
      'vosotras': '第二人称复数',
      'vosotros/vosotras': '第二人称复数',
      'ellos': '第三人称复数',
      'ellas': '第三人称复数',
      'ustedes': '第三人称复数',
      'ellos/ellas/ustedes': '第三人称复数',
      'tú (afirmativo)': '第二人称单数',
      'tú (negativo)': '第二人称单数'
    }
    return personLabelMap[person] || person
  }

  static getTenseMap() {
    return {
      // 简单陈述式（5个）
      'presente': '现在时',
      'preterito': '简单过去时',
      'imperfecto': '未完成过去时',
      'futuro': '将来时',
      'condicional': '条件式',
      // 虚拟式（3个）
      'subjuntivo_presente': '虚拟现在时',
      'subjuntivo_imperfecto': '虚拟过去时',
      'subjuntivo_futuro': '虚拟将来未完成时',
      // 命令式（2个）
      'imperativo_afirmativo': '肯定命令式',
      'imperativo_negativo': '否定命令式',
      // 复合陈述式（5个）
      'perfecto': '现在完成时',
      'pluscuamperfecto': '过去完成时',
      'futuro_perfecto': '将来完成时',
      'condicional_perfecto': '条件完成时',
      'preterito_anterior': '前过去时',
      // 复合虚拟式（3个）
      'subjuntivo_perfecto': '虚拟现在完成时',
      'subjuntivo_pluscuamperfecto': '虚拟过去完成时',
      'subjuntivo_futuro_perfecto': '虚拟将来完成时'
    }
  }

  static getMoodMap() {
    return {
      'indicativo': '陈述式',
      'subjuntivo': '虚拟式',
      'imperativo': '命令式',
      'indicativo_compuesto': '复合陈述式',
      'subjuntivo_compuesto': '复合虚拟式'
    }
  }

  static filterConjugationsByMoodAndTense(conjugations, moods = [], tenses = []) {
    let filteredConjugations = Array.isArray(conjugations) ? conjugations : []

    if (Array.isArray(moods) && moods.length > 0) {
      const moodMap = this.getMoodMap()
      const selectedMoodNames = moods.map(m => moodMap[m]).filter(Boolean)
      filteredConjugations = filteredConjugations.filter(c => selectedMoodNames.includes(c.mood))
    }

    if (Array.isArray(tenses) && tenses.length > 0) {
      const tenseMap = this.getTenseMap()
      const selectedTenseSet = new Set(
        tenses
          .map(t => tenseMap[t])
          .filter(Boolean)
          .map(t => this.normalizeTenseName(t))
      )
      filteredConjugations = filteredConjugations.filter(
        c => selectedTenseSet.has(this.normalizeTenseName(c.tense))
      )
    }

    return filteredConjugations
  }

  static filterConjugationsByPronounSettings(
    conjugations,
    includeVos = false,
    includeVosotros = true
  ) {
    let filteredConjugations = Array.isArray(conjugations) ? conjugations : []

    if (includeVos === false) {
      filteredConjugations = filteredConjugations.filter(c => c.person !== 'vos')
    }

    if (includeVosotros === false) {
      filteredConjugations = filteredConjugations.filter(c => (
        c.person !== 'vosotros' &&
        c.person !== 'vosotras' &&
        c.person !== 'vosotros/vosotras'
      ))
    }

    return filteredConjugations
  }

  static getTenseCategory(tense) {
    const normalizedTense = this.normalizeTenseName(tense)

    if ([
      '前过去时',
      '虚拟将来未完成时',
      '虚拟过去完成时',
      '虚拟将来完成时'
    ].includes(normalizedTense)) {
      return 3
    }

    if ([
      '过去完成时',
      '将来完成时',
      '条件完成时',
      '虚拟过去时',
      '虚拟现在完成时'
    ].includes(normalizedTense)) {
      return 2
    }

    return 1
  }

  static chooseTenseCategoryByWeight(availableCategorySet) {
    const weighted = [
      { category: 1, weight: 0.70 },
      { category: 2, weight: 0.25 },
      { category: 3, weight: 0.05 }
    ].filter(item => availableCategorySet.has(item.category))

    if (weighted.length === 0) return null
    if (weighted.length === 1) return weighted[0].category

    const total = weighted.reduce((sum, item) => sum + item.weight, 0)
    let random = Math.random() * total
    for (const item of weighted) {
      if (random < item.weight) return item.category
      random -= item.weight
    }
    return weighted[weighted.length - 1].category
  }

  static pickConjugationByTenseWeight(conjugations, reduceRareTenseFrequency = true) {
    if (!Array.isArray(conjugations) || conjugations.length === 0) return null
    if (!reduceRareTenseFrequency) {
      return conjugations[Math.floor(Math.random() * conjugations.length)]
    }

    const tenseGroups = new Map()
    conjugations.forEach((item) => {
      if (!tenseGroups.has(item.tense)) tenseGroups.set(item.tense, [])
      tenseGroups.get(item.tense).push(item)
    })

    const tenses = Array.from(tenseGroups.keys())
    const availableCategorySet = new Set(tenses.map(tense => this.getTenseCategory(tense)))
    const pickedCategory = this.chooseTenseCategoryByWeight(availableCategorySet)
    if (!pickedCategory) {
      return conjugations[Math.floor(Math.random() * conjugations.length)]
    }

    const tensesInCategory = tenses.filter(tense => this.getTenseCategory(tense) === pickedCategory)
    if (tensesInCategory.length === 0) {
      return conjugations[Math.floor(Math.random() * conjugations.length)]
    }

    const pickedTense = tensesInCategory[Math.floor(Math.random() * tensesInCategory.length)]
    const candidates = tenseGroups.get(pickedTense) || []
    if (candidates.length === 0) {
      return conjugations[Math.floor(Math.random() * conjugations.length)]
    }
    return candidates[Math.floor(Math.random() * candidates.length)]
  }

  static buildHint(person, tense, mood = null) {
    const normalizedMood = mood ? String(mood).trim() : ''
    const normalizedTense = tense ? this.normalizeTenseName(String(tense).trim()) : ''
    const normalizedPerson = person
      ? this.normalizePersonLabel(String(person).trim())
      : ''

    if (normalizedMood && normalizedTense && normalizedPerson) {
      return `${normalizedMood}-${normalizedTense}-${normalizedPerson}`
    }
    if (normalizedMood && normalizedTense) return `${normalizedMood}-${normalizedTense}`
    if (normalizedTense && normalizedPerson) return `${normalizedTense}-${normalizedPerson}`
    if (normalizedMood) return normalizedMood
    if (normalizedPerson) return normalizedPerson
    if (normalizedTense) return normalizedTense
    return null
  }

  static getPronounFormMap() {
    return {
      general: { hostForm: 'finite', hostFormZh: '一般变位' },
      imperative: { hostForm: 'imperative', hostFormZh: '命令式' },
      infinitive: { hostForm: 'infinitive', hostFormZh: '动词原形' },
      gerund: { hostForm: 'gerund', hostFormZh: '副动词' },
      reflexive: { hostForm: 'prnl', hostFormZh: '自反动词' }
    }
  }

  static mapConjugationFormsToHostForms(conjugationForms = []) {
    const formMap = this.getPronounFormMap()
    const values = Array.isArray(conjugationForms) ? conjugationForms : []
    const mapped = values
      .map((value) => formMap[String(value || '').trim().toLowerCase()])
      .filter(Boolean)
      .map(item => item.hostForm)
    return [...new Set(mapped)]
  }

  static getDefaultPronounHostForms() {
    return ['finite', 'imperative', 'infinitive', 'gerund', 'prnl']
  }

  static getCommonFiniteTenseSet() {
    return new Set(['现在时', '简单过去时', '未完成过去时'])
  }

  static normalizePronounPattern(pattern) {
    const normalized = String(pattern || '').trim().toUpperCase()
    if (normalized === 'DO' || normalized === 'IO' || normalized === 'DO_IO') {
      return normalized
    }
    return ''
  }

  static buildPronounHint(ioPronoun, doPronoun, hostForm) {
    if (hostForm === 'prnl') {
      return '提示：自反形式（本题不区分 IO/DO）'
    }
    const parts = []
    if (ioPronoun) parts.push(`IO: ${ioPronoun}`)
    if (doPronoun) parts.push(`DO: ${doPronoun}`)
    return parts.length > 0 ? parts.join(' | ') : ''
  }

  static shuffleArray(items = []) {
    return [...items].sort(() => Math.random() - 0.5)
  }

  static getQuestionBankForSentenceMode(sentenceMode) {
    if (sentenceMode === 'with-pronoun') return 'pronoun'
    return 'traditional'
  }

  static buildSentenceBankPlans({ sentenceMode = 'verb-only', count = 10 }) {
    if (sentenceMode === 'mixed') {
      const traditionalCount = Math.floor(count / 2)
      const pronounCount = count - traditionalCount
      return [
        { questionBank: 'traditional', count: traditionalCount },
        { questionBank: 'pronoun', count: pronounCount }
      ].filter(item => item.count > 0)
    }

    return [{
      questionBank: this.getQuestionBankForSentenceMode(sentenceMode),
      count
    }]
  }

  static buildPronounVerbQueryOptions(options, hostForm) {
    const queryOptions = {}
    if (options.verbIds && options.verbIds.length > 0) {
      queryOptions.verbIds = options.verbIds
    } else {
      if (options.conjugationTypes && options.conjugationTypes.length > 0) {
        queryOptions.conjugationTypes = options.conjugationTypes
      }
    }
    if (options.includeRegular === false) {
      queryOptions.onlyIrregular = true
    }
    if (options.excludeVerbIds && options.excludeVerbIds.length > 0) {
      queryOptions.excludeVerbIds = options.excludeVerbIds
    }
    if (hostForm === 'prnl') {
      queryOptions.onlyReflexive = true
    } else {
      queryOptions.onlyHasTrUse = true
    }
    return queryOptions
  }

  static buildPronounTargetForVerb(verb, hostForm, options = {}) {
    if (!verb || !hostForm) return null

    if (hostForm === 'infinitive') {
      if (!verb.infinitive) return null
      return {
        host_form: 'infinitive',
        host_form_zh: '动词原形',
        mood: '不适用',
        tense: '不适用',
        person: '不适用',
        base_form: verb.infinitive
      }
    }

    if (hostForm === 'gerund') {
      if (!verb.gerund) return null
      return {
        host_form: 'gerund',
        host_form_zh: '副动词',
        mood: '不适用',
        tense: '不适用',
        person: '不适用',
        base_form: verb.gerund
      }
    }

    if (hostForm === 'prnl') {
      if (verb.is_reflexive !== 1) return null
      if (!verb.infinitive) return null
      return {
        host_form: 'prnl',
        host_form_zh: '自反动词',
        mood: '不适用',
        tense: '不适用',
        person: '不适用',
        base_form: `${verb.infinitive}se`
      }
    }

    const conjugations = Conjugation.getByVerbId(verb.id)
    if (!Array.isArray(conjugations) || conjugations.length === 0) return null

    if (hostForm === 'imperative') {
      let imperativeForms = conjugations.filter(c => c.mood === '命令式' && c.tense === '肯定命令式')
      imperativeForms = this.filterConjugationsByPronounSettings(
        imperativeForms,
        options.includeVos,
        options.includeVosotros
      )
      if (imperativeForms.length === 0) return null
      const picked = imperativeForms[Math.floor(Math.random() * imperativeForms.length)]
      return {
        host_form: 'imperative',
        host_form_zh: '命令式',
        mood: picked.mood,
        tense: picked.tense,
        person: picked.person,
        base_form: picked.conjugated_form
      }
    }

    if (hostForm === 'finite') {
      const commonFiniteTenses = this.getCommonFiniteTenseSet()
      let finiteForms = conjugations.filter(c => (
        c.mood === '陈述式' && commonFiniteTenses.has(this.normalizeTenseName(c.tense))
      ))
      finiteForms = this.filterConjugationsByPronounSettings(
        finiteForms,
        options.includeVos,
        options.includeVosotros
      )
      if (finiteForms.length === 0) return null
      const picked = finiteForms[Math.floor(Math.random() * finiteForms.length)]
      const normalizedTense = this.normalizeTenseName(picked.tense)
      return {
        host_form: 'finite',
        host_form_zh: `${picked.mood}-${normalizedTense}`,
        mood: picked.mood,
        tense: normalizedTense,
        person: picked.person,
        base_form: picked.conjugated_form
      }
    }

    return null
  }

  static async buildSentencePoolForBank({
    userId,
    questionBank,
    count,
    tenses = [],
    moods = [],
    conjugationTypes = [],
    includeRegular = true,
    includeVos = false,
    includeVosotros = true,
    reduceRareTenseFrequency = true,
    verbIds = null,
    hostForms = []
  }) {
    const sourceType = questionBank === 'pronoun'
      ? PUBLIC_SOURCE_PRONOUN
      : PUBLIC_SOURCE_TRADITIONAL

    let allBankQuestions = []
    if (userId) {
      const filters = {
        questionType: 'sentence',
        questionBank,
        includeVos,
        includeVosotros,
        verbIds
      }
      if (questionBank === 'pronoun') {
        filters.hostForms = hostForms
      } else {
        filters.tenses = tenses
        filters.moods = moods
        filters.conjugationTypes = conjugationTypes
        filters.includeRegular = includeRegular
      }
      allBankQuestions = Question.getSmartFromPublic(userId, filters, count)
    }

    const seenQuestionIds = new Set()
    const uniqueBankQuestions = allBankQuestions.filter((question) => {
      const key = `${sourceType}:${question.id}`
      if (seenQuestionIds.has(key)) return false
      seenQuestionIds.add(key)
      return true
    })

    const actualBankCount = uniqueBankQuestions.length
    const hasEnoughInBank = actualBankCount >= count
    let mainQuestions = []
    let backupQuestions = []
    let aiCount = 0

    if (hasEnoughInBank) {
      const mainCount = Math.round(count * 0.85)
      const backupCount = count - mainCount
      const shuffled = this.shuffleArray(uniqueBankQuestions)
      mainQuestions = shuffled.slice(0, mainCount)
      backupQuestions = shuffled.slice(mainCount, mainCount + backupCount)
      aiCount = backupCount
    } else {
      mainQuestions = uniqueBankQuestions
      aiCount = count - actualBankCount
    }

    const questionPool = []
    questionPool.push(...mainQuestions.map((q, index) => ({
      ...this.formatQuestionBankExercise(q, sourceType),
      _fromPool: true,
      _poolIndex: index,
      _isMain: true,
      _questionBank: questionBank
    })))
    questionPool.push(...backupQuestions.map((q, index) => ({
      ...this.formatQuestionBankExercise(q, sourceType),
      _fromPool: true,
      _poolIndex: mainQuestions.length + index,
      _isBackup: true,
      _questionBank: questionBank
    })))

    const aiOptions = aiCount > 0 ? {
      exerciseType: 'sentence',
      questionBank,
      tenses,
      moods,
      userId,
      conjugationTypes,
      includeRegular,
      includeVos,
      includeVosotros,
      reduceRareTenseFrequency,
      verbIds,
      hostForms
    } : null

    return {
      questionBank,
      questionPool,
      mainCount: mainQuestions.length,
      backupCount: backupQuestions.length,
      hasEnoughInBank,
      needAI: aiCount,
      aiOptions
    }
  }

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
   * - 快变快填和组合填空：使用固定算法生成（不调用AI）
   * - 例句填空：按比例从题库和AI混合获取
   * - 一次性生成所有需要的题目，管理题目池
   */
  static async generateBatch(options) {
    const {
      userId,
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

    // 例句填空：题库+AI混合模式（支持传统、带代词、混合50/50）
    if (exerciseType === 'sentence') {
      const sentenceMode = options.sentenceMode || 'verb-only'
      const selectedHostForms = Array.isArray(options.hostForms) && options.hostForms.length > 0
        ? options.hostForms
        : this.mapConjugationFormsToHostForms(options.conjugationForms)
      const hostForms = selectedHostForms.length > 0
        ? selectedHostForms
        : this.getDefaultPronounHostForms()

      const plans = this.buildSentenceBankPlans({ sentenceMode, count })
      const planResults = []
      for (const plan of plans) {
        const planResult = await this.buildSentencePoolForBank({
          userId,
          questionBank: plan.questionBank,
          count: plan.count,
          tenses,
          moods,
          conjugationTypes,
          includeRegular,
          includeVos,
          includeVosotros,
          reduceRareTenseFrequency,
          verbIds,
          hostForms: plan.questionBank === 'pronoun' ? hostForms : []
        })
        planResults.push(planResult)
      }

      const mergedPool = this.shuffleArray(planResults.flatMap(result => result.questionPool))
        .map((item, index) => ({
          ...item,
          _poolIndex: index
        }))
      questionPool.push(...mergedPool)

      const needAI = planResults.reduce((sum, result) => sum + result.needAI, 0)
      const mainCount = planResults.reduce((sum, result) => sum + result.mainCount, 0)
      const backupCount = planResults.reduce((sum, result) => sum + result.backupCount, 0)
      const hasEnoughInBank = planResults.every(result => result.hasEnoughInBank)

      const aiPlans = planResults
        .filter(result => result.needAI > 0 && result.aiOptions)
        .map(result => ({
          questionBank: result.questionBank,
          count: result.needAI,
          aiOptions: result.aiOptions
        }))

      const response = {
        exercises: [],
        questionPool,
        hasEnoughInBank,
        mainCount,
        backupCount,
        needAI
      }

      if (aiPlans.length === 1) {
        response.aiOptions = aiPlans[0].aiOptions
      } else if (aiPlans.length > 1) {
        response.aiPlans = aiPlans
      }

      console.log('批量生成 - sentence 计划:', {
        sentenceMode,
        plans,
        mainCount,
        backupCount,
        needAI,
        hasEnoughInBank
      })

      return response
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
    const {
      userId,
      exerciseType,
      tenses,
      moods,
      conjugationTypes,
      includeRegular,
      includeVos,
      includeVosotros
    } = options
    const sentenceMode = options.sentenceMode || 'verb-only'
    const questionBank = this.getQuestionBankForSentenceMode(sentenceMode)
    const hostForms = Array.isArray(options.hostForms) && options.hostForms.length > 0
      ? options.hostForms
      : this.mapConjugationFormsToHostForms(options.conjugationForms)
    const sourceType = questionBank === 'pronoun' ? PUBLIC_SOURCE_PRONOUN : PUBLIC_SOURCE_TRADITIONAL

    try {
      // 使用智能推荐算法从公共题库获取
      if (userId) {
        const filters = {
          questionType: exerciseType,
          questionBank,
          includeVos,
          includeVosotros
        }
        if (questionBank === 'pronoun') {
          filters.hostForms = hostForms
        } else {
          filters.tenses = tenses
          filters.moods = moods
          filters.conjugationTypes = conjugationTypes
          filters.includeRegular = includeRegular
        }
        const smartQuestions = Question.getSmartFromPublic(userId, filters, 1)

        if (smartQuestions.length > 0) {
          return this.formatQuestionBankExercise(smartQuestions[0], sourceType)
        }
      } else {
        // 如果没有用户ID，使用旧的随机方法
        const filters = {
          questionType: exerciseType,
          questionBank,
          includeVos,
          includeVosotros,
          limit: 1
        }
        if (questionBank === 'pronoun') {
          filters.hostForms = hostForms
        } else {
          filters.tenses = tenses
          filters.moods = moods
          filters.conjugationTypes = conjugationTypes
          filters.includeRegular = includeRegular
        }
        const publicQuestion = Question.getRandomFromPublic(filters)

        if (publicQuestion) {
          return this.formatQuestionBankExercise(publicQuestion, sourceType)
        }
      }

      // 如果公共题库没有，尝试从用户私人题库获取
      if (userId) {
        const privateQuestion = Question.getRandomFromPrivate(userId, {
          questionType: exerciseType,
          questionBank,
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

    const exerciseType = question.question_type || 'sentence'
    const questionBank = question.question_bank
      || (sourceType === PUBLIC_SOURCE_PRONOUN ? 'pronoun' : 'traditional')

    const exercise = {
      questionId: question.id,
      questionSource: sourceType,
      questionBank,
      publicQuestionSource: sourceType === 'private'
        ? (question.public_question_source || null)
        : sourceType,
      verbId: question.verb_id,
      infinitive: question.infinitive,
      meaning: question.meaning,
      tense: this.normalizeTenseName(question.tense),
      mood: question.mood,
      person: question.person,
      correctAnswer: question.correct_answer,
      exerciseType,
      conjugationType: conjugationTypeMap[question.conjugation_type] || '未知',
      isIrregular: question.is_irregular === 1,
      isReflexive: question.is_reflexive === 1,
      fromQuestionBank: true
    }

    if (exerciseType === 'sentence') {
      exercise.sentence = question.question_text
      exercise.translation = question.translation
      exercise.hostForm = question.host_form || null
      exercise.hostFormZh = question.host_form_zh || null
      exercise.pronounPattern = question.pronoun_pattern || ''
      exercise.ioPronoun = question.io_pronoun || ''
      exercise.doPronoun = question.do_pronoun || ''

      if (questionBank === 'pronoun') {
        exercise.hint = this.buildPronounHint(
          exercise.ioPronoun,
          exercise.doPronoun,
          exercise.hostForm
        )
      } else {
        exercise.hint = question.hint || this.buildHint(question.person, question.tense, question.mood)
      }
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
    }

    return { valid: true }
  }

  static validatePronounAIResultData(aiResult, target) {
    if (!aiResult) {
      return { valid: false, reason: 'AI返回结果为空' }
    }

    if (!aiResult.sentence || aiResult.sentence === 'undefined') {
      return { valid: false, reason: '例句字段缺失或为undefined' }
    }
    if (!aiResult.translation || aiResult.translation === 'undefined') {
      return { valid: false, reason: '翻译字段缺失或为undefined' }
    }
    if (!aiResult.answer || aiResult.answer === 'undefined') {
      return { valid: false, reason: '答案字段缺失或为undefined' }
    }

    const blankMatches = String(aiResult.sentence).match(/__\?__/g) || []
    if (blankMatches.length !== 1) {
      return { valid: false, reason: '题干必须且仅包含一个 __?__' }
    }

    if (aiResult.host_form !== target.host_form) {
      return { valid: false, reason: 'host_form 与目标不一致' }
    }

    const pronounPattern = this.normalizePronounPattern(aiResult.pronoun_pattern)
    const ioPronoun = String(aiResult.io_pronoun || '').trim()
    const doPronoun = String(aiResult.do_pronoun || '').trim()

    if (target.host_form === 'prnl') {
      if (pronounPattern) {
        return { valid: false, reason: 'prnl 题的 pronoun_pattern 必须为空' }
      }
      if (ioPronoun || doPronoun) {
        return { valid: false, reason: 'prnl 题的 io/do 字段必须为空' }
      }
      return { valid: true }
    }

    if (!pronounPattern) {
      return { valid: false, reason: '非 prnl 题缺少 pronoun_pattern' }
    }
    if (pronounPattern === 'DO' && (!doPronoun || ioPronoun)) {
      return { valid: false, reason: 'DO 题的 io/do 字段不匹配' }
    }
    if (pronounPattern === 'IO' && (!ioPronoun || doPronoun)) {
      return { valid: false, reason: 'IO 题的 io/do 字段不匹配' }
    }
    if (pronounPattern === 'DO_IO' && (!ioPronoun || !doPronoun)) {
      return { valid: false, reason: 'DO_IO 题的 io/do 字段不匹配' }
    }

    return { valid: true }
  }

  static async runPronounSentenceAIPipeline({ verb, target, maxRetries = 3 }) {
    let lastError = ''

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(
        `[AI生成][pronoun-pipeline] attempt=${attempt}/${maxRetries} verb=${verb.infinitive} host=${target.host_form}`
      )

      try {
        const generated = await PronounQuestionGeneratorService.generateSentenceExercise({ verb, target })
        const normalizedGenerated = {
          ...generated,
          host_form: generated?.host_form || target.host_form,
          host_form_zh: generated?.host_form_zh || target.host_form_zh,
          mood: generated?.mood || target.mood,
          tense: generated?.tense || target.tense,
          person: generated?.person || target.person,
          answer: generated?.answer || ''
        }

        const generatedCheck = this.validatePronounAIResultData(normalizedGenerated, target)
        if (!generatedCheck.valid) {
          lastError = generatedCheck.reason
          continue
        }

        const validationV1 = await PronounQuestionValidatorService.validateQuestion({
          verb,
          target,
          question: normalizedGenerated
        })

        if (validationV1.isValid && validationV1.hasUniqueAnswer) {
          return {
            passed: true,
            aiResult: normalizedGenerated,
            validation: validationV1,
            attempt,
            usedRevisor: false
          }
        }

        let revisedQuestion
        try {
          const revised = await PronounQuestionRevisorService.reviseQuestion({
            verb,
            target,
            originalQuestion: normalizedGenerated,
            validatorResult: validationV1
          })
          revisedQuestion = {
            ...normalizedGenerated,
            sentence: revised.sentence || normalizedGenerated.sentence,
            translation: revised.translation || normalizedGenerated.translation
          }
        } catch (error) {
          lastError = `revisor失败: ${error.message}`
          continue
        }

        const revisedCheck = this.validatePronounAIResultData(revisedQuestion, target)
        if (!revisedCheck.valid) {
          lastError = revisedCheck.reason
          continue
        }

        const validationV2 = await PronounQuestionValidatorService.validateQuestion({
          verb,
          target,
          question: revisedQuestion
        })
        if (validationV2.isValid && validationV2.hasUniqueAnswer) {
          return {
            passed: true,
            aiResult: revisedQuestion,
            validation: validationV2,
            attempt,
            usedRevisor: true
          }
        }

        lastError = validationV2.reason || validationV1.reason || 'validator_v2未通过'
      } catch (error) {
        lastError = error.message
      }

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 800))
      }
    }

    return {
      passed: false,
      aiResult: null,
      validation: null,
      attempt: maxRetries,
      usedRevisor: false,
      lastError: lastError || '达到最大重试次数'
    }
  }

  /**
   * 例句题 AI 生成流水线：
   * generator -> validator_v1 -> (可选) revisor -> validator_v2
   * 单次请求最多重试 maxRetries 次；任一轮通过即停止。
   */
  static async runSentenceAIPipeline({ verb, conjugation, generatedHint, maxRetries = 3 }) {
    let lastError = ''

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(
        `[AI生成][pipeline] attempt=${attempt}/${maxRetries} verb=${verb.infinitive} slot=${conjugation.mood}/${conjugation.tense}/${conjugation.person}`
      )

      try {
        const generated = await QuestionGeneratorService.generateSentenceExercise(verb, conjugation)
        const normalizedGenerated = {
          ...generated,
          answer: generated?.answer || conjugation.conjugated_form
        }

        const generatedCheck = this.validateAIResultData(normalizedGenerated, 'sentence')
        if (!generatedCheck.valid) {
          lastError = generatedCheck.reason
          console.log(`[AI生成][pipeline] generator数据不合法: ${lastError}`)
          continue
        }

        const validatorInputV1 = {
          questionType: 'sentence',
          questionText: normalizedGenerated.sentence,
          correctAnswer: normalizedGenerated.answer,
          exampleSentence: normalizedGenerated.sentence,
          translation: normalizedGenerated.translation || '',
          hint: generatedHint,
          verb
        }
        const validationV1 = await QuestionValidatorService.validateQuestion(validatorInputV1)
        console.log(
          `[AI生成][validator_v1] isValid=${validationV1.isValid} hasUniqueAnswer=${validationV1.hasUniqueAnswer} reason=${validationV1.reason || ''}`
        )

        if (validationV1.isValid && validationV1.hasUniqueAnswer) {
          return {
            passed: true,
            aiResult: normalizedGenerated,
            validation: validationV1,
            attempt,
            usedRevisor: false
          }
        }

        let revisedQuestion = null
        try {
          const revised = await QuestionRevisorService.reviseQuestion({
            verb,
            conjugation,
            originalQuestion: normalizedGenerated,
            validatorResult: validationV1,
            fixedHint: generatedHint
          })

          revisedQuestion = {
            ...normalizedGenerated,
            sentence: revised.sentence || normalizedGenerated.sentence,
            translation: revised.translation || normalizedGenerated.translation || ''
          }

          const revisedCheck = this.validateAIResultData(revisedQuestion, 'sentence')
          if (!revisedCheck.valid) {
            lastError = `revisor产物无效: ${revisedCheck.reason}`
            console.log(`[AI生成][pipeline] ${lastError}`)
            continue
          }
        } catch (error) {
          lastError = `revisor失败: ${error.message}`
          console.log(`[AI生成][pipeline] ${lastError}`)
          continue
        }

        const validatorInputV2 = {
          questionType: 'sentence',
          questionText: revisedQuestion.sentence,
          correctAnswer: revisedQuestion.answer,
          exampleSentence: revisedQuestion.sentence,
          translation: revisedQuestion.translation || '',
          hint: generatedHint,
          verb
        }
        const validationV2 = await QuestionValidatorService.validateQuestion(validatorInputV2)
        console.log(
          `[AI生成][validator_v2] isValid=${validationV2.isValid} hasUniqueAnswer=${validationV2.hasUniqueAnswer} reason=${validationV2.reason || ''}`
        )

        if (validationV2.isValid && validationV2.hasUniqueAnswer) {
          return {
            passed: true,
            aiResult: revisedQuestion,
            validation: validationV2,
            attempt,
            usedRevisor: true
          }
        }

        lastError = validationV2.reason || validationV1.reason || 'validator_v2未通过'
      } catch (error) {
        lastError = error.message
        console.log(`[AI生成][pipeline] attempt=${attempt} 异常: ${lastError}`)
      }

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 800))
      }
    }

    return {
      passed: false,
      aiResult: null,
      validation: null,
      attempt: maxRetries,
      usedRevisor: false,
      lastError: lastError || '达到最大重试次数'
    }
  }

  /**
   * 使用AI生成新题目（带重试机制）
   */
  static async generateWithAI(options) {
    const {
      userId,
      exerciseType,
      tenses,
      conjugationTypes,
      includeRegular,
      includeVos = false,
      includeVosotros = true,
      verbIds
    } = options
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

    // 根据时态和语气筛选
    let filteredConjugations = this.filterConjugationsByMoodAndTense(
      conjugations,
      options.moods,
      tenses
    )
    filteredConjugations = this.filterConjugationsByPronounSettings(
      filteredConjugations,
      includeVos,
      includeVosotros
    )

    if (filteredConjugations.length === 0) {
      throw new Error('没有符合所选时态和语气的变位数据')
    }

    const randomConjugation = this.pickConjugationByTenseWeight(
      filteredConjugations,
      options.reduceRareTenseFrequency
    )
    const generatedHint = this.buildHint(
      randomConjugation.person,
      randomConjugation.tense,
      randomConjugation.mood
    )

    if (exerciseType !== 'sentence') {
      throw new Error('不支持的AI生成题型')
    }

    const pipeline = await this.runSentenceAIPipeline({
      verb,
      conjugation: randomConjugation,
      generatedHint,
      maxRetries
    })
    const aiResult = pipeline.aiResult

    if (!pipeline.passed || !aiResult) {
      console.log(`[AI生成] 经过${maxRetries}次尝试仍未生成合格题目，最后错误: ${pipeline.lastError}`)
      console.log(`[AI生成] 例句填空无法降级，返回null`)
      return null
    }
    console.log(`[AI生成] 流水线成功 attempt=${pipeline.attempt} usedRevisor=${pipeline.usedRevisor}`)

    // 验证通过，保存到公共题库（统一初始置信度为50）
    let savedQuestionId = null
    try {
      const questionData = {
        verbId: verb.id,
        questionBank: 'traditional',
        publicQuestionSource: PUBLIC_SOURCE_TRADITIONAL,
        questionText: exerciseType === 'sentence' ? aiResult.sentence : aiResult.question,
        correctAnswer: aiResult.answer || randomConjugation.conjugated_form,
        exampleSentence: exerciseType === 'sentence' ? aiResult.sentence : (aiResult.example || null),
        translation: aiResult.translation || null,
        hint: generatedHint,
        tense: this.normalizeTenseName(randomConjugation.tense),
        mood: randomConjugation.mood,
        person: randomConjugation.person,
        confidenceScore: 50  // 所有新生成题目的初始置信度统一为50
      }

      // 检查是否已存在相同题目
      if (!Question.existsInPublic(verb.id, questionData.questionText, PUBLIC_SOURCE_TRADITIONAL)) {
        savedQuestionId = Question.addToPublic(questionData)
        console.log(`新题目已加入公共题库（ID: ${savedQuestionId}，初始置信度: 50）`)
      } else {
        // 如果已存在，获取已有题目的ID
        const existing = Question.findByVerbAndText(verb.id, questionData.questionText, PUBLIC_SOURCE_TRADITIONAL)
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
      questionSource: PUBLIC_SOURCE_TRADITIONAL,
      questionBank: 'traditional',
      publicQuestionSource: PUBLIC_SOURCE_TRADITIONAL,
      verbId: verb.id,
      infinitive: verb.infinitive,
      meaning: verb.meaning,
      tense: this.normalizeTenseName(randomConjugation.tense),
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
      exercise.hint = generatedHint
    }

    return exercise
  }

  /**
   * 为指定动词使用AI生成题目（批量生成专用）
   */
  static async generateWithAIForVerb(verb, options) {
    const {
      exerciseType,
      tenses,
      userId,
      includeVos = false,
      includeVosotros = true,
      reduceRareTenseFrequency = true
    } = options
    const maxRetries = 3

    const conjugations = Conjugation.getByVerbId(verb.id)
    if (conjugations.length === 0) {
      throw new Error('该动词没有变位数据')
    }

    // 根据时态和语气筛选
    let filteredConjugations = this.filterConjugationsByMoodAndTense(
      conjugations,
      options.moods,
      tenses
    )
    filteredConjugations = this.filterConjugationsByPronounSettings(
      filteredConjugations,
      includeVos,
      includeVosotros
    )

    if (filteredConjugations.length === 0) {
      throw new Error('没有符合所选时态和语气的变位数据')
    }

    const randomConjugation = this.pickConjugationByTenseWeight(
      filteredConjugations,
      reduceRareTenseFrequency
    )
    const generatedHint = this.buildHint(
      randomConjugation.person,
      randomConjugation.tense,
      randomConjugation.mood
    )

    if (exerciseType !== 'sentence') {
      throw new Error('不支持的AI生成题型')
    }

    const pipeline = await this.runSentenceAIPipeline({
      verb,
      conjugation: randomConjugation,
      generatedHint,
      maxRetries
    })
    const aiResult = pipeline.aiResult

    if (!pipeline.passed || !aiResult) {
      console.log(`[AI生成] ${verb.infinitive}经过${maxRetries}次尝试仍未生成合格题目: ${pipeline.lastError}`)
      return null
    }
    console.log(`[AI生成] ${verb.infinitive}流水线成功 attempt=${pipeline.attempt} usedRevisor=${pipeline.usedRevisor}`)

    // 保存到公共题库
    let savedQuestionId = null
    try {
      const questionData = {
        verbId: verb.id,
        questionBank: 'traditional',
        publicQuestionSource: PUBLIC_SOURCE_TRADITIONAL,
        questionText: exerciseType === 'sentence' ? aiResult.sentence : aiResult.question,
        correctAnswer: aiResult.answer || randomConjugation.conjugated_form,
        exampleSentence: exerciseType === 'sentence' ? aiResult.sentence : (aiResult.example || null),
        translation: aiResult.translation || null,
        hint: generatedHint,
        tense: this.normalizeTenseName(randomConjugation.tense),
        mood: randomConjugation.mood,
        person: randomConjugation.person,
        confidenceScore: 50
      }

      if (!Question.existsInPublic(verb.id, questionData.questionText, PUBLIC_SOURCE_TRADITIONAL)) {
        savedQuestionId = Question.addToPublic(questionData)
        console.log(`新题目已加入公共题库: ${verb.infinitive} (ID: ${savedQuestionId})`)
      } else {
        const existing = Question.findByVerbAndText(verb.id, questionData.questionText, PUBLIC_SOURCE_TRADITIONAL)
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
      questionSource: PUBLIC_SOURCE_TRADITIONAL,
      questionBank: 'traditional',
      publicQuestionSource: PUBLIC_SOURCE_TRADITIONAL,
      verbId: verb.id,
      infinitive: verb.infinitive,
      meaning: verb.meaning,
      tense: this.normalizeTenseName(randomConjugation.tense),
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
      exercise.hint = generatedHint
    }

    return exercise
  }

  static async generatePronounWithAIForVerb(verb, options) {
    const maxRetries = 3
    const requestedHostForms = Array.isArray(options.hostForms) && options.hostForms.length > 0
      ? options.hostForms
      : this.getDefaultPronounHostForms()
    const hostForms = this.shuffleArray(requestedHostForms)

    for (const hostForm of hostForms) {
      const target = this.buildPronounTargetForVerb(verb, hostForm, options)
      if (!target) continue

      const pipeline = await this.runPronounSentenceAIPipeline({
        verb,
        target,
        maxRetries
      })

      if (!pipeline.passed || !pipeline.aiResult) {
        continue
      }

      const aiResult = pipeline.aiResult
      const normalizedPattern = this.normalizePronounPattern(aiResult.pronoun_pattern)
      const ioPronoun = String(aiResult.io_pronoun || '').trim()
      const doPronoun = String(aiResult.do_pronoun || '').trim()

      let savedQuestionId = null
      try {
        const questionData = {
          questionBank: 'pronoun',
          publicQuestionSource: PUBLIC_SOURCE_PRONOUN,
          verbId: verb.id,
          hostForm: target.host_form,
          hostFormZh: target.host_form === 'finite'
            ? `${target.mood}-${target.tense}`
            : target.host_form_zh,
          pronounPattern: target.host_form === 'prnl' ? '' : normalizedPattern,
          questionText: aiResult.sentence,
          correctAnswer: aiResult.answer,
          exampleSentence: aiResult.sentence,
          translation: aiResult.translation || null,
          hint: aiResult.hint || null,
          tense: target.tense || '不适用',
          mood: target.mood || '不适用',
          person: target.person || '不适用',
          ioPronoun: target.host_form === 'prnl' ? '' : ioPronoun,
          doPronoun: target.host_form === 'prnl' ? '' : doPronoun,
          confidenceScore: 50
        }

        if (!Question.existsInPublic(verb.id, questionData.questionText, PUBLIC_SOURCE_PRONOUN)) {
          savedQuestionId = Question.addToPublic(questionData)
        } else {
          const existing = Question.findByVerbAndText(verb.id, questionData.questionText, PUBLIC_SOURCE_PRONOUN)
          if (existing) {
            savedQuestionId = existing.id
          }
        }
      } catch (error) {
        console.error('[AI生成][pronoun] 保存题目失败:', error)
      }

      const conjugationTypeMap = { 1: '第一变位', 2: '第二变位', 3: '第三变位' }
      return {
        questionId: savedQuestionId,
        questionSource: PUBLIC_SOURCE_PRONOUN,
        questionBank: 'pronoun',
        publicQuestionSource: PUBLIC_SOURCE_PRONOUN,
        verbId: verb.id,
        infinitive: verb.infinitive,
        meaning: verb.meaning,
        tense: target.tense || '不适用',
        mood: target.mood || '不适用',
        person: target.person || '不适用',
        correctAnswer: aiResult.answer,
        exerciseType: 'sentence',
        conjugationType: conjugationTypeMap[verb.conjugation_type] || '未知',
        isIrregular: verb.is_irregular === 1,
        isReflexive: verb.is_reflexive === 1,
        fromQuestionBank: false,
        aiGenerated: true,
        sentence: aiResult.sentence,
        translation: aiResult.translation || '',
        hint: this.buildPronounHint(
          target.host_form === 'prnl' ? '' : ioPronoun,
          target.host_form === 'prnl' ? '' : doPronoun,
          target.host_form
        ),
        hostForm: target.host_form,
        hostFormZh: target.host_form === 'finite'
          ? `${target.mood}-${target.tense}`
          : target.host_form_zh,
        pronounPattern: target.host_form === 'prnl' ? '' : normalizedPattern,
        ioPronoun: target.host_form === 'prnl' ? '' : ioPronoun,
        doPronoun: target.host_form === 'prnl' ? '' : doPronoun
      }
    }

    return null
  }

  /**
   * 单个AI题目异步生成（供前端调用）
   */
  static async generateSingleAI(options) {
    const {
      exerciseType,
      tenses,
      userId,
      conjugationTypes,
      includeRegular,
      includeVos,
      includeVosotros,
      reduceRareTenseFrequency = true,
      verbIds,
      excludeVerbIds = [],
      questionBank = 'traditional'
    } = options

    if (questionBank === 'pronoun') {
      const hostForms = Array.isArray(options.hostForms) && options.hostForms.length > 0
        ? options.hostForms
        : this.mapConjugationFormsToHostForms(options.conjugationForms)
      const normalizedHostForms = hostForms.length > 0
        ? hostForms
        : this.getDefaultPronounHostForms()

      for (const hostForm of this.shuffleArray(normalizedHostForms)) {
        const queryOptions = this.buildPronounVerbQueryOptions({
          verbIds,
          conjugationTypes,
          includeRegular,
          excludeVerbIds
        }, hostForm)
        const aiVerbs = Verb.getRandom(3, queryOptions)
        for (const verb of aiVerbs) {
          try {
            const aiExercise = await this.generatePronounWithAIForVerb(verb, {
              hostForms: [hostForm],
              includeVos,
              includeVosotros
            })
            if (aiExercise) {
              return aiExercise
            }
          } catch (error) {
            console.error(`为动词 ${verb.infinitive} 生成带代词题目失败:`, error.message)
          }
        }
      }

      if (userId) {
        const supplementQuestions = Question.getSmartFromPublic(userId, {
          questionType: exerciseType,
          questionBank: 'pronoun',
          hostForms: normalizedHostForms,
          includeVos: options.includeVos,
          includeVosotros: options.includeVosotros,
          verbIds
        }, 1)
        if (supplementQuestions.length > 0) {
          return this.formatQuestionBankExercise(supplementQuestions[0], PUBLIC_SOURCE_PRONOUN)
        }
      }

      throw new Error('带代词AI生成失败且题库无可用题目')
    }

    // 传统句子题
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
      if (excludeVerbIds && excludeVerbIds.length > 0) {
        queryOptions.excludeVerbIds = excludeVerbIds
      }
    }

    const aiVerbs = Verb.getRandom(3, queryOptions)
    if (aiVerbs.length === 0) {
      throw new Error('没有可用的动词')
    }

    for (const verb of aiVerbs) {
      try {
        const aiExercise = await this.generateWithAIForVerb(verb, {
          exerciseType,
          tenses,
          moods: options.moods,
          userId,
          includeVos,
          includeVosotros,
          reduceRareTenseFrequency
        })
        if (aiExercise) {
          return aiExercise
        }
      } catch (error) {
        console.error(`为动词 ${verb.infinitive} 生成AI题目失败:`, error.message)
      }
    }

    if (userId) {
      const supplementQuestions = Question.getSmartFromPublic(userId, {
        questionType: exerciseType,
        questionBank: 'traditional',
        tenses,
        moods: options.moods,
        conjugationTypes,
        includeRegular,
        includeVos: options.includeVos,
        includeVosotros: options.includeVosotros,
        verbIds
      }, 1)
      if (supplementQuestions.length > 0) {
        return this.formatQuestionBankExercise(supplementQuestions[0], PUBLIC_SOURCE_TRADITIONAL)
      }
    }

    throw new Error('AI生成失败且题库无可用题目')
  }

  /**
   * 使用传统固定算法生成（快变快填、组合填空）
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

    // 根据时态和语气筛选
    let filteredConjugations = this.filterConjugationsByMoodAndTense(
      conjugations,
      options.moods,
      tenses
    )
    
    filteredConjugations = this.filterConjugationsByPronounSettings(
      filteredConjugations,
      options.includeVos,
      options.includeVosotros
    )

    if (filteredConjugations.length === 0) {
      throw new Error('没有符合所选时态和语气的变位数据')
    }

    const conjugationTypeMap = { 1: '第一变位', 2: '第二变位', 3: '第三变位' }

    // 快变快填题
    if (exerciseType === 'quick-fill') {
      // 随机选择一个变位作为给定形式
      const givenConjugation = filteredConjugations[Math.floor(Math.random() * filteredConjugations.length)]
      // 目标形式按时态类别加权抽样
      const targetConjugation = this.pickConjugationByTenseWeight(
        filteredConjugations,
        options.reduceRareTenseFrequency
      )
      
      const exercise = {
        verbId: verb.id,
        infinitive: verb.infinitive,
        meaning: verb.meaning,
        mood: targetConjugation.mood,
        tense: this.normalizeTenseName(targetConjugation.tense),
        person: targetConjugation.person,
        correctAnswer: targetConjugation.conjugated_form,
        exerciseType: 'quick-fill',
        conjugationType: conjugationTypeMap[verb.conjugation_type] || '未知',
        isIrregular: verb.is_irregular === 1,
        fromQuestionBank: false,
        aiGenerated: false,
        givenForm: givenConjugation.conjugated_form,
        givenDesc: this.buildHint(
          givenConjugation.person,
          givenConjugation.tense,
          givenConjugation.mood
        )
      }
      
      return exercise
    }

    // 组合填空题 - 任意6个随机变位组合（不限于同一语气）
    if (exerciseType === 'combo-fill') {
      if (filteredConjugations.length < 6) {
        throw new Error('该动词在所选范围内的变位数少于6个，无法生成组合填空题')
      }
      
      // 逐个按时态类别加权抽样，且不重复
      const pool = [...filteredConjugations]
      const selectedConjugations = []
      while (selectedConjugations.length < 6 && pool.length > 0) {
        const picked = this.pickConjugationByTenseWeight(pool, options.reduceRareTenseFrequency)
        if (!picked) break
        selectedConjugations.push(picked)
        const idx = pool.indexOf(picked)
        if (idx > -1) pool.splice(idx, 1)
      }
      if (selectedConjugations.length < 6) {
        throw new Error('该动词在所选范围内的变位数少于6个，无法生成组合填空题')
      }
      
      // 构建组合填空题目
      const comboItems = selectedConjugations.map(c => ({
        tense: this.normalizeTenseName(c.tense),
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
    const randomConjugation = this.pickConjugationByTenseWeight(
      filteredConjugations,
      options.reduceRareTenseFrequency
    )
    
    const exercise = {
      verbId: verb.id,
      infinitive: verb.infinitive,
      meaning: verb.meaning,
      tense: this.normalizeTenseName(randomConjugation.tense),
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

}

module.exports = ExerciseGeneratorService
