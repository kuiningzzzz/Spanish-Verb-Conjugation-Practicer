#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const axios = require('axios')

const dotenvPath = path.join(__dirname, '.env')
if (fs.existsSync(dotenvPath)) {
  require('dotenv').config({ path: dotenvPath })
}

const generatorPrompts = require('./input/conjugation_with_pronoun/generator_prompt')
const validatorPrompts = require('./input/conjugation_with_pronoun/validator_prompt')
const revisorPrompts = require('./input/conjugation_with_pronoun/revisor_prompt')

const VERB_SOURCE = path.join(__dirname, '../server/src/verbs.json')

const HOST_FORMS = ['finite', 'imperative', 'infinitive', 'gerund', 'prnl']
const DEFAULT_MODELS = ['deepseek:deepseek-chat', 'qwen:qwen-plus', 'qwen:qwen3-max']
const DEFAULT_GENERATOR_TEMPS = [0.7]
const DEFAULT_VALIDATOR_FLAG = true
const DEFAULT_REVISOR_FLAG = true
const DEFAULT_TEST_CASES = 1
const DEFAULT_GENERATOR_PROMPTS = generatorPrompts.map((_, i) => i)
const DEFAULT_VALIDATOR_PROMPTS = validatorPrompts.map((_, i) => i)
const DEFAULT_REVISOR_PROMPTS = revisorPrompts.map((_, i) => i)
const DEFAULT_OUTPUT_FILE = path.join(__dirname, 'output', 'prompt_conj-with-pronoun.csv')
const DEFAULT_LOG_FILE = path.join(__dirname, 'output', 'prompt_conj-with-pronoun_logs.csv')

const FINITE_TENSE_META = {
  present: {
    mood: 'Indicativo',
    tense: 'Presente',
    host_form_zh: '陈述式-现在时'
  },
  preterite: {
    mood: 'Indicativo',
    tense: 'Pretérito indefinido',
    host_form_zh: '陈述式-简单过去时'
  },
  imperfect: {
    mood: 'Indicativo',
    tense: 'Pretérito imperfecto',
    host_form_zh: '陈述式-过去未完成时'
  }
}

const DEFAULT_FINITE_TENSES = Object.keys(FINITE_TENSE_META)

const PERSON_LABELS = {
  first_singular: 'yo',
  second_singular: 'tú',
  third_singular: 'él/ella/usted',
  first_plural: 'nosotros/nosotras',
  second_plural: 'vosotros/vosotras',
  third_plural: 'ellos/ellas/ustedes'
}

const IMPERATIVE_PERSON_KEYS = [
  'second_singular',
  'third_singular',
  'first_plural',
  'second_plural',
  'third_plural'
]

function parseCsvList(value) {
  if (!value) return null
  return value.split(',').map(item => item.trim()).filter(Boolean)
}

function parseNumberList(value) {
  const items = parseCsvList(value)
  if (!items) return null
  return items.map(item => Number(item)).filter(n => Number.isFinite(n))
}

function parseAllowedList(value, allowed) {
  const items = parseCsvList(value)
  if (!items) return null
  const allowedSet = new Set(allowed)
  const picked = items.filter(item => allowedSet.has(item))
  return picked.length > 0 ? picked : null
}

function parseBool(value) {
  if (value === undefined || value === null || value === '') return null
  const normalized = String(value).toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'yes'
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function countWords(text) {
  if (!text) return 0
  const matches = text.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g)
  return matches ? matches.length : 0
}

function quantile(sortedValues, p) {
  if (!sortedValues.length) return 0
  const idx = (sortedValues.length - 1) * p
  const lower = Math.floor(idx)
  const upper = Math.ceil(idx)
  if (lower === upper) return sortedValues[lower]
  const weight = idx - lower
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight
}

function roundNumber(value, digits = 4) {
  if (!Number.isFinite(value)) return 0
  return Number(value.toFixed(digits))
}

function toCleanString(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function normalizePronounPattern(value) {
  const normalized = toCleanString(value).toUpperCase()
  if (normalized === 'DO' || normalized === 'IO' || normalized === 'DO_IO') {
    return normalized
  }
  return normalized
}

function toStringArray(value) {
  if (Array.isArray(value)) {
    return value.map(item => toCleanString(item)).filter(Boolean)
  }
  const text = toCleanString(value)
  return text ? [text] : []
}

function parseProviderAndModel(modelEntry) {
  const raw = toCleanString(modelEntry)
  const idx = raw.indexOf(':')
  if (idx === -1) return { provider: 'deepseek', model: raw }
  return {
    provider: raw.slice(0, idx).trim() || 'deepseek',
    model: raw.slice(idx + 1).trim()
  }
}

function buildHint(target, pronounPattern) {
  const parts = []
  if (target.host_form) parts.push(target.host_form)
  if (target.mood) parts.push(target.mood)
  if (target.tense) parts.push(target.tense)
  if (target.person) parts.push(target.person)
  if (pronounPattern) parts.push(pronounPattern)
  return parts.join(' | ')
}

function getVerbCandidatesByHostForm(verbs, hostForm) {
  if (hostForm === 'prnl') {
    return verbs.filter(verb => verb?.is_reflexive === true)
  }
  return verbs.filter(verb => verb?.has_tr_use === true)
}

function buildFiniteTargets(verb, allowedFiniteTenses) {
  const entries = []
  for (const tenseKey of allowedFiniteTenses) {
    const meta = FINITE_TENSE_META[tenseKey]
    if (!meta) continue
    const tenseBlock = verb?.indicative?.[tenseKey]
    if (!tenseBlock) continue
    Object.entries(PERSON_LABELS).forEach(([personKey, personLabel]) => {
      const forms = tenseBlock[personKey]
      if (!Array.isArray(forms) || forms.length === 0) return
      entries.push({
        host_form: 'finite',
        host_form_zh: meta.host_form_zh,
        mood: meta.mood,
        tense: meta.tense,
        person: personLabel,
        person_key: personKey,
        base_form: forms.join(' | ')
      })
    })
  }
  return entries
}

function buildImperativeTargets(verb) {
  const entries = []
  const tenseBlock = verb?.imperative?.affirmative
  if (!tenseBlock) return entries
  IMPERATIVE_PERSON_KEYS.forEach(personKey => {
    const forms = tenseBlock[personKey]
    if (!Array.isArray(forms) || forms.length === 0) return
    entries.push({
      host_form: 'imperative',
      host_form_zh: '命令式（肯定）',
      mood: 'Imperativo',
      tense: 'Afirmativo',
      person: PERSON_LABELS[personKey] || personKey,
      person_key: personKey,
      base_form: forms.join(' | ')
    })
  })
  return entries
}

function buildTargetForHostForm(verb, hostForm, allowedFiniteTenses) {
  if (!verb) return null
  if (hostForm === 'finite') {
    const finiteEntries = buildFiniteTargets(verb, allowedFiniteTenses)
    if (!finiteEntries.length) return null
    return pickRandom(finiteEntries)
  }

  if (hostForm === 'imperative') {
    const imperativeEntries = buildImperativeTargets(verb)
    if (!imperativeEntries.length) return null
    return pickRandom(imperativeEntries)
  }

  if (hostForm === 'infinitive') {
    const infinitive = toCleanString(verb.infinitive)
    if (!infinitive) return null
    return {
      host_form: 'infinitive',
      host_form_zh: '不定式',
      mood: 'Infinitivo',
      tense: 'No aplica',
      person: 'No aplica',
      person_key: '',
      base_form: infinitive
    }
  }

  if (hostForm === 'gerund') {
    const gerund = toCleanString(verb.gerund)
    if (!gerund) return null
    return {
      host_form: 'gerund',
      host_form_zh: '副动词',
      mood: 'Gerundio',
      tense: 'No aplica',
      person: 'No aplica',
      person_key: '',
      base_form: gerund
    }
  }

  if (hostForm === 'prnl') {
    const infinitive = toCleanString(verb.infinitive)
    if (!infinitive) return null
    return {
      host_form: 'prnl',
      host_form_zh: '代词动词（自复）',
      mood: 'Pronominal',
      tense: 'No aplica',
      person: 'No aplica',
      person_key: '',
      base_form: `${infinitive}se`
    }
  }

  return null
}

function pickVerbAndTarget(verbs, hostForm, allowedFiniteTenses) {
  const candidates = getVerbCandidatesByHostForm(verbs, hostForm)
  if (!candidates.length) return null

  const maxAttempts = Math.min(200, candidates.length * 3)
  for (let i = 0; i < maxAttempts; i++) {
    const verb = pickRandom(candidates)
    const target = buildTargetForHostForm(verb, hostForm, allowedFiniteTenses)
    if (target) return { verb, target }
  }
  return null
}

function escapeCsv(value) {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

async function callChat({ apiUrl, apiKey, model, temperature, system, user, maxTokens, timeoutMs }) {
  if (!apiUrl || !apiKey) {
    throw new Error('Missing apiUrl/apiKey')
  }

  const response = await axios.post(
    apiUrl,
    {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature,
      max_tokens: maxTokens
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: timeoutMs || 30000
    }
  )

  return response.data.choices?.[0]?.message?.content
}

function cleanJsonText(text) {
  if (!text) return ''
  let cleaned = text.trim()
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '')
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/```\n?/g, '')
  }
  return cleaned.trim()
}

function normalizeQuestion(raw, target) {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const pronounPattern = normalizePronounPattern(
    raw.pronoun_pattern !== undefined
      ? raw.pronoun_pattern
      : raw.pronounPattern
  )

  const question = {
    host_form: toCleanString(raw.host_form || target.host_form),
    host_form_zh: toCleanString(raw.host_form_zh || target.host_form_zh),
    pronoun_pattern: pronounPattern,
    mood: toCleanString(raw.mood || target.mood),
    tense: toCleanString(raw.tense || target.tense),
    person: toCleanString(raw.person || target.person),
    io_pronoun: toCleanString(raw.io_pronoun !== undefined ? raw.io_pronoun : raw.ioPronoun),
    do_pronoun: toCleanString(raw.do_pronoun !== undefined ? raw.do_pronoun : raw.doPronoun),
    sentence: toCleanString(raw.sentence !== undefined ? raw.sentence : raw.question_sentence),
    answer: toCleanString(raw.answer !== undefined ? raw.answer : raw.question_answer),
    translation: toCleanString(raw.translation !== undefined ? raw.translation : raw.question_translation),
    hint: toCleanString(raw.hint !== undefined ? raw.hint : raw.question_hint)
  }

  if (!question.hint) {
    question.hint = buildHint(target, question.pronoun_pattern)
  }

  return question
}

function normalizeValidatorResult(raw) {
  if (!raw || typeof raw !== 'object') return null

  const isValidValue = raw.isValid !== undefined ? raw.isValid : raw.is_valid
  const hasUniqueValue = raw.hasUniqueAnswer !== undefined ? raw.hasUniqueAnswer : raw.has_unique_answer
  const reasonValue = raw.reason !== undefined ? raw.reason : raw.message
  const rewriteAdviceValue = raw.rewrite_advice !== undefined ? raw.rewrite_advice : raw.rewriteAdvice
  const failureTagsValue = raw.failure_tags !== undefined ? raw.failure_tags : raw.failureTags

  const normalizeBoolValue = value => {
    if (value === true || value === false) return value
    const text = String(value).toLowerCase()
    if (text === 'true') return true
    if (text === 'false') return false
    return ''
  }

  return {
    isValid: normalizeBoolValue(isValidValue),
    hasUniqueAnswer: normalizeBoolValue(hasUniqueValue),
    reason: toCleanString(reasonValue),
    rewrite_advice: toStringArray(rewriteAdviceValue),
    failure_tags: toStringArray(failureTagsValue)
  }
}

function normalizeRevisorResult(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    sentence: toCleanString(raw.sentence),
    translation: toCleanString(raw.translation),
    revisor_reason: toCleanString(raw.revisor_reason || raw.reason)
  }
}

function buildDistribution(countMap, denominator) {
  const output = {}
  Object.keys(countMap).sort().forEach(key => {
    const count = countMap[key]
    output[key] = {
      count,
      rate: roundNumber(count / (denominator || 1))
    }
  })
  return output
}

async function main() {
  const verbs = JSON.parse(fs.readFileSync(VERB_SOURCE, 'utf8'))
  if (!Array.isArray(verbs) || verbs.length === 0) {
    throw new Error('verbs.json is empty')
  }

  const models = parseCsvList(process.env.MODELS) || DEFAULT_MODELS
  const temperatures = parseNumberList(process.env.GENERATOR_TEMPERATURES) || DEFAULT_GENERATOR_TEMPS
  const useValidator = parseBool(process.env.USE_VALIDATOR)
  const useValidatorFlag = useValidator === null ? DEFAULT_VALIDATOR_FLAG : useValidator
  const useRevisor = parseBool(process.env.USE_REVISOR)
  const useRevisorFlag = useRevisor === null ? DEFAULT_REVISOR_FLAG : useRevisor
  const testCasesParsed = Number.parseInt(process.env.TEST_CASES || DEFAULT_TEST_CASES, 10)
  const testCases = Number.isFinite(testCasesParsed) && testCasesParsed > 0
    ? testCasesParsed
    : DEFAULT_TEST_CASES

  const generatorPromptsEnv = process.env.CONJ_WITH_PRONOUN_GENERATOR_PROMPTS || process.env.GENERATOR_PROMPTS
  const validatorPromptsEnv = process.env.CONJ_WITH_PRONOUN_VALIDATOR_PROMPTS || process.env.VALIDATOR_PROMPTS
  const revisorPromptsEnv = process.env.CONJ_WITH_PRONOUN_REVISOR_PROMPTS || process.env.REVISOR_PROMPTS
  const hostFormsEnv = process.env.CONJ_WITH_PRONOUN_HOST_FORMS || process.env.HOST_FORMS
  const finiteTensesEnv = process.env.CONJ_WITH_PRONOUN_FINITE_TENSES || process.env.FINITE_TENSES

  const generatorPromptIndexes = parseNumberList(generatorPromptsEnv) || DEFAULT_GENERATOR_PROMPTS
  const validatorPromptIndexes = parseNumberList(validatorPromptsEnv) || DEFAULT_VALIDATOR_PROMPTS
  const revisorPromptIndexes = parseNumberList(revisorPromptsEnv) || DEFAULT_REVISOR_PROMPTS
  const activeRevisorPromptIndexes = useRevisorFlag ? revisorPromptIndexes : [0]
  const hostForms = parseAllowedList(hostFormsEnv, HOST_FORMS) || HOST_FORMS
  const allowedFiniteTenses = parseAllowedList(finiteTensesEnv, DEFAULT_FINITE_TENSES) || DEFAULT_FINITE_TENSES

  const generatorMaxTokens = parsePositiveInt(
    process.env.CONJ_WITH_PRONOUN_GENERATOR_MAX_TOKENS || process.env.GENERATOR_MAX_TOKENS,
    1300
  )
  const validatorMaxTokens = parsePositiveInt(
    process.env.CONJ_WITH_PRONOUN_VALIDATOR_MAX_TOKENS || process.env.VALIDATOR_MAX_TOKENS,
    900
  )
  const revisorMaxTokens = parsePositiveInt(
    process.env.CONJ_WITH_PRONOUN_REVISOR_MAX_TOKENS || process.env.REVISOR_MAX_TOKENS,
    700
  )
  const requestTimeoutMs = parsePositiveInt(process.env.REQUEST_TIMEOUT_MS, 45000)

  const deepseekApiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions'
  const deepseekApiKey = process.env.DEEPSEEK_API_KEY
  const qwenApiUrl = process.env.QWEN_API_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
  const qwenApiKey = process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY

  const outputPath = process.env.CONJ_WITH_PRONOUN_OUTPUT_FILE || DEFAULT_OUTPUT_FILE
  const logPath = process.env.CONJ_WITH_PRONOUN_LOG_FILE || DEFAULT_LOG_FILE
  const resolvedOutputPath = outputPath
    ? (path.isAbsolute(outputPath) ? outputPath : path.join(process.cwd(), outputPath))
    : ''
  const resolvedLogPath = logPath
    ? (path.isAbsolute(logPath) ? logPath : path.join(process.cwd(), logPath))
    : ''
  let outputStream = null
  let logStream = null
  if (resolvedOutputPath) {
    fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true })
    outputStream = fs.createWriteStream(resolvedOutputPath, { encoding: 'utf8' })
  }
  if (resolvedLogPath) {
    fs.mkdirSync(path.dirname(resolvedLogPath), { recursive: true })
    logStream = fs.createWriteStream(resolvedLogPath, { encoding: 'utf8' })
  }

  const headers = [
    'verb_infinitive',
    'verb_meaning',
    'host_form',
    'host_form_zh',
    'pronoun_pattern',
    'mood',
    'tense',
    'person',
    'io_pronoun',
    'do_pronoun',
    'question_sentence',
    'question_answer',
    'question_translation',
    'question_hint',
    'revised_sentence',
    'revisor_reason',
    'generator_prompt_index',
    'generator_model',
    'generator_temperature',
    'validator_used',
    'validator_prompt_index',
    'validator_model',
    'validator_temperature',
    'revisor_used',
    'revisor_prompt_index',
    'revisor_model',
    'revisor_temperature',
    'validator_1_is_valid',
    'validator_1_has_unique_answer',
    'validator_1_reason',
    'validator_1_rewrite_advice',
    'validator_2_is_valid',
    'validator_2_has_unique_answer',
    'validator_2_reason',
    'validator_2_rewrite_advice',
    'validator_is_valid',
    'validator_has_unique_answer',
    'validator_reason',
    'validator_rewrite_advice',
    'error'
  ]

  const writeLine = line => {
    if (outputStream) {
      outputStream.write(`${line}\n`)
      return
    }
    process.stdout.write(`${line}\n`)
  }

  const logHeaders = [
    'event',
    'row_index',
    'target',
    'model',
    'temperature',
    'prompt_index',
    'request_chars',
    'response_chars',
    'error'
  ]

  const logLine = row => {
    const line = logHeaders.map(key => escapeCsv(row[key] ?? '')).join(',')
    if (logStream) {
      logStream.write(`${line}\n`)
      const pretty = [
        row.event ? `${row.event}` : 'info',
        row.row_index !== undefined && row.row_index !== '' ? `row_index=${row.row_index}` : null,
        row.target ? `target=${row.target}` : null,
        row.model ? `model=${row.model}` : null,
        row.temperature !== undefined && row.temperature !== '' ? `temperature=${row.temperature}` : null,
        row.prompt_index !== undefined && row.prompt_index !== '' ? `prompt_index=${row.prompt_index}` : null,
        row.request_chars !== undefined && row.request_chars !== '' ? `request_chars=${row.request_chars}` : null,
        row.response_chars !== undefined && row.response_chars !== '' ? `response_chars=${row.response_chars}` : null,
        row.error ? `error=${row.error}` : null
      ].filter(Boolean).join(' ')
      process.stderr.write(`${pretty.replace(/(\w+)=/g, '[$1]=')}\n`)
      return
    }
    process.stderr.write(`${line}\n`)
  }

  writeLine(headers.map(escapeCsv).join(','))
  if (logStream) {
    logStream.write(`${logHeaders.join(',')}\n`)
  }

  const summaryStats = {
    totalRows: 0,
    sentenceRows: 0,
    wordCounts: [],
    validatorRows: 0,
    validatorPass: 0,
    revisorTriggered: 0,
    errorRows: 0,
    hostFormCounts: {},
    pronounPatternCounts: {}
  }

  const finiteRequested = hostForms.includes('finite')
  if (finiteRequested && allowedFiniteTenses.length === 0) {
    throw new Error('host_form includes finite but finite tense candidates are empty')
  }

  let rowIndex = 1
  for (let caseIndex = 0; caseIndex < testCases; caseIndex++) {
    const hostForm = pickRandom(hostForms)
    const picked = pickVerbAndTarget(verbs, hostForm, allowedFiniteTenses)
    if (!picked) {
      logLine({
        event: 'error',
        row_index: '',
        target: 'sampling',
        model: '',
        temperature: '',
        prompt_index: '',
        error: `no verb/target candidate for host_form=${hostForm}`
      })
      continue
    }

    const verb = picked.verb
    const target = picked.target
    const meaning = Array.isArray(verb.translation) ? verb.translation.join('、') : ''

    for (const promptIndex of generatorPromptIndexes) {
      const promptBuilder = generatorPrompts[promptIndex]
      if (!promptBuilder) continue

      const promptPayload = promptBuilder({
        verb: {
          infinitive: verb.infinitive,
          meaning,
          is_reflexive: verb.is_reflexive === true,
          has_tr_use: verb.has_tr_use === true
        },
        target
      })

      for (const modelEntry of models) {
        const parsedModel = parseProviderAndModel(modelEntry)
        const provider = parsedModel.provider
        const model = parsedModel.model
        const apiUrl = provider === 'qwen' ? qwenApiUrl : deepseekApiUrl
        const apiKey = provider === 'qwen' ? qwenApiKey : deepseekApiKey

        for (const temperature of temperatures) {
          for (const vPromptIndex of validatorPromptIndexes) {
            for (const rPromptIndex of activeRevisorPromptIndexes) {
              const validatorPromptIndex = vPromptIndex
              const revisorPromptIndex = rPromptIndex
              const currentRowIndex = rowIndex
              rowIndex += 1

              let question = null
              let questionError = ''
              let rawQuestionText = ''
              let validator1Result = null
              let validator1Error = ''
              let rawValidator1Text = ''
              let revisorResult = null
              let revisorError = ''
              let rawRevisorText = ''
              let revisedQuestion = null
              let revisedQuestionError = ''
              let validator2Result = null
              let validator2Error = ''
              let rawValidator2Text = ''

              try {
                const requestText = `${promptPayload.system}\n${promptPayload.user}`
                logLine({
                  event: 'request',
                  row_index: currentRowIndex,
                  target: 'generator',
                  model,
                  temperature,
                  prompt_index: promptIndex,
                  request_chars: requestText.length
                })
                rawQuestionText = await callChat({
                  apiUrl,
                  apiKey,
                  model,
                  temperature,
                  system: promptPayload.system,
                  user: promptPayload.user,
                  maxTokens: generatorMaxTokens,
                  timeoutMs: requestTimeoutMs
                })
                logLine({
                  event: 'response',
                  row_index: currentRowIndex,
                  target: 'generator',
                  model,
                  temperature,
                  prompt_index: promptIndex,
                  response_chars: rawQuestionText ? rawQuestionText.length : 0
                })
                const parsed = JSON.parse(cleanJsonText(rawQuestionText))
                question = normalizeQuestion(parsed, target)
                if (!question) {
                  throw new Error('generator returned non-object JSON')
                }
              } catch (error) {
                questionError = error.message
                logLine({
                  event: 'error',
                  row_index: currentRowIndex,
                  target: 'generator',
                  model,
                  temperature,
                  prompt_index: promptIndex,
                  error: questionError
                })
              }

              const rawValidatorTemperature = process.env.CONJ_WITH_PRONOUN_VALIDATOR_TEMPERATURE !== undefined
                ? process.env.CONJ_WITH_PRONOUN_VALIDATOR_TEMPERATURE
                : process.env.VALIDATOR_TEMPERATURE
              const parsedValidatorTemperature = Number(rawValidatorTemperature)
              const validatorTemperature = Number.isFinite(parsedValidatorTemperature)
                ? parsedValidatorTemperature
                : temperature

              if (useValidatorFlag) {
                const validatorPromptBuilder = validatorPrompts[validatorPromptIndex]
                if (!validatorPromptBuilder) {
                  validator1Error = `validator prompt index not found: ${validatorPromptIndex}`
                } else {
                  try {
                    const validatorPrompt = validatorPromptBuilder({
                      verb: { infinitive: verb.infinitive, meaning },
                      target,
                      question: question || {}
                    })
                    const validatorRequestText = `${validatorPrompt.system}\n${validatorPrompt.user}`
                    logLine({
                      event: 'request',
                      row_index: currentRowIndex,
                      target: 'validator_1',
                      model,
                      temperature: validatorTemperature,
                      prompt_index: validatorPromptIndex,
                      request_chars: validatorRequestText.length
                    })
                    rawValidator1Text = await callChat({
                      apiUrl,
                      apiKey,
                      model,
                      temperature: validatorTemperature,
                      system: validatorPrompt.system,
                      user: validatorPrompt.user,
                      maxTokens: validatorMaxTokens,
                      timeoutMs: requestTimeoutMs
                    })
                    logLine({
                      event: 'response',
                      row_index: currentRowIndex,
                      target: 'validator_1',
                      model,
                      temperature: validatorTemperature,
                      prompt_index: validatorPromptIndex,
                      response_chars: rawValidator1Text ? rawValidator1Text.length : 0
                    })
                    const parsed = JSON.parse(cleanJsonText(rawValidator1Text))
                    validator1Result = normalizeValidatorResult(parsed)
                    if (!validator1Result) {
                      throw new Error('validator_1 returned non-object JSON')
                    }
                  } catch (error) {
                    validator1Error = error.message
                    logLine({
                      event: 'error',
                      row_index: currentRowIndex,
                      target: 'validator_1',
                      model,
                      temperature: validatorTemperature,
                      prompt_index: validatorPromptIndex,
                      error: validator1Error
                    })
                  }
                }
              }

              const parsedRevisorTemperature = process.env.CONJ_WITH_PRONOUN_REVISOR_TEMPERATURE !== undefined
                ? Number(process.env.CONJ_WITH_PRONOUN_REVISOR_TEMPERATURE)
                : (process.env.REVISOR_TEMPERATURE !== undefined ? Number(process.env.REVISOR_TEMPERATURE) : NaN)
              const revisorTemperature = Number.isFinite(parsedRevisorTemperature)
                ? parsedRevisorTemperature
                : 0.5

              const validator1Passed = validator1Result?.isValid === true && validator1Result?.hasUniqueAnswer === true
              const shouldRunRevisor = useRevisorFlag && useValidatorFlag && question && !validator1Passed
              if (shouldRunRevisor) {
                summaryStats.revisorTriggered += 1
                const revisorPromptBuilder = revisorPrompts[revisorPromptIndex]
                if (!revisorPromptBuilder) {
                  revisorError = `revisor prompt index not found: ${revisorPromptIndex}`
                } else {
                  try {
                    const revisorPrompt = revisorPromptBuilder({
                      verb: { infinitive: verb.infinitive, meaning },
                      target,
                      originalQuestion: question,
                      validatorResult: validator1Result || { reason: validator1Error || '' }
                    })
                    const revisorRequestText = `${revisorPrompt.system}\n${revisorPrompt.user}`
                    logLine({
                      event: 'request',
                      row_index: currentRowIndex,
                      target: 'revisor',
                      model,
                      temperature: revisorTemperature,
                      prompt_index: revisorPromptIndex,
                      request_chars: revisorRequestText.length
                    })
                    rawRevisorText = await callChat({
                      apiUrl,
                      apiKey,
                      model,
                      temperature: revisorTemperature,
                      system: revisorPrompt.system,
                      user: revisorPrompt.user,
                      maxTokens: revisorMaxTokens,
                      timeoutMs: requestTimeoutMs
                    })
                    logLine({
                      event: 'response',
                      row_index: currentRowIndex,
                      target: 'revisor',
                      model,
                      temperature: revisorTemperature,
                      prompt_index: revisorPromptIndex,
                      response_chars: rawRevisorText ? rawRevisorText.length : 0
                    })
                    revisorResult = normalizeRevisorResult(JSON.parse(cleanJsonText(rawRevisorText)))
                    if (!revisorResult?.sentence) {
                      revisedQuestionError = 'revisor returned empty sentence'
                    } else {
                      revisedQuestion = {
                        ...question,
                        sentence: revisorResult.sentence,
                        translation: revisorResult.translation || question.translation
                      }
                    }
                  } catch (error) {
                    revisorError = error.message
                    logLine({
                      event: 'error',
                      row_index: currentRowIndex,
                      target: 'revisor',
                      model,
                      temperature: revisorTemperature,
                      prompt_index: revisorPromptIndex,
                      error: revisorError
                    })
                  }
                }
              }

              if (useValidatorFlag && revisedQuestion?.sentence) {
                const validatorPromptBuilder = validatorPrompts[validatorPromptIndex]
                if (!validatorPromptBuilder) {
                  validator2Error = `validator prompt index not found: ${validatorPromptIndex}`
                } else {
                  try {
                    const validatorPrompt = validatorPromptBuilder({
                      verb: { infinitive: verb.infinitive, meaning },
                      target,
                      question: revisedQuestion
                    })
                    const validatorRequestText = `${validatorPrompt.system}\n${validatorPrompt.user}`
                    logLine({
                      event: 'request',
                      row_index: currentRowIndex,
                      target: 'validator_2',
                      model,
                      temperature: validatorTemperature,
                      prompt_index: validatorPromptIndex,
                      request_chars: validatorRequestText.length
                    })
                    rawValidator2Text = await callChat({
                      apiUrl,
                      apiKey,
                      model,
                      temperature: validatorTemperature,
                      system: validatorPrompt.system,
                      user: validatorPrompt.user,
                      maxTokens: validatorMaxTokens,
                      timeoutMs: requestTimeoutMs
                    })
                    logLine({
                      event: 'response',
                      row_index: currentRowIndex,
                      target: 'validator_2',
                      model,
                      temperature: validatorTemperature,
                      prompt_index: validatorPromptIndex,
                      response_chars: rawValidator2Text ? rawValidator2Text.length : 0
                    })
                    const parsed = JSON.parse(cleanJsonText(rawValidator2Text))
                    validator2Result = normalizeValidatorResult(parsed)
                    if (!validator2Result) {
                      throw new Error('validator_2 returned non-object JSON')
                    }
                  } catch (error) {
                    validator2Error = error.message
                    logLine({
                      event: 'error',
                      row_index: currentRowIndex,
                      target: 'validator_2',
                      model,
                      temperature: validatorTemperature,
                      prompt_index: validatorPromptIndex,
                      error: validator2Error
                    })
                  }
                }
              }

              const finalValidator = validator2Result || validator1Result
              const finalQuestion = revisedQuestion || question
              const rowHostForm = toCleanString(finalQuestion?.host_form || target.host_form)
              const rowPronounPattern = normalizePronounPattern(finalQuestion?.pronoun_pattern || '')
              const sentenceText = toCleanString(finalQuestion?.sentence)
              const rowErrorList = [
                questionError,
                validator1Error,
                revisorError,
                revisedQuestionError,
                validator2Error
              ].filter(Boolean)
              const rowError = rowErrorList.join(' | ')

              summaryStats.totalRows += 1
              summaryStats.hostFormCounts[rowHostForm] = (summaryStats.hostFormCounts[rowHostForm] || 0) + 1
              if (rowPronounPattern) {
                summaryStats.pronounPatternCounts[rowPronounPattern] = (summaryStats.pronounPatternCounts[rowPronounPattern] || 0) + 1
              }
              if (sentenceText) {
                summaryStats.sentenceRows += 1
                summaryStats.wordCounts.push(countWords(sentenceText))
              }
              if (rowError) {
                summaryStats.errorRows += 1
              }
              if (useValidatorFlag) {
                summaryStats.validatorRows += 1
                if (finalValidator?.isValid === true && finalValidator?.hasUniqueAnswer === true) {
                  summaryStats.validatorPass += 1
                }
              }

              const row = {
                verb_infinitive: verb.infinitive,
                verb_meaning: meaning,
                host_form: rowHostForm,
                host_form_zh: finalQuestion?.host_form_zh || target.host_form_zh,
                pronoun_pattern: rowPronounPattern,
                mood: finalQuestion?.mood || target.mood,
                tense: finalQuestion?.tense || target.tense,
                person: finalQuestion?.person || target.person,
                io_pronoun: finalQuestion?.io_pronoun || '',
                do_pronoun: finalQuestion?.do_pronoun || '',
                question_sentence: question?.sentence || '',
                question_answer: question?.answer || '',
                question_translation: finalQuestion?.translation || question?.translation || '',
                question_hint: finalQuestion?.hint || buildHint(target, rowPronounPattern),
                revised_sentence: revisedQuestion?.sentence || '',
                revisor_reason: revisorResult?.revisor_reason || '',
                generator_prompt_index: String(promptIndex),
                generator_model: model,
                generator_temperature: String(temperature),
                validator_used: String(useValidatorFlag),
                validator_prompt_index: String(validatorPromptIndex),
                validator_model: model,
                validator_temperature: String(validatorTemperature),
                revisor_used: String(useRevisorFlag),
                revisor_prompt_index: String(revisorPromptIndex),
                revisor_model: model,
                revisor_temperature: String(revisorTemperature),
                validator_1_is_valid: validator1Result?.isValid ?? '',
                validator_1_has_unique_answer: validator1Result?.hasUniqueAnswer ?? '',
                validator_1_reason: validator1Result?.reason || validator1Error,
                validator_1_rewrite_advice: Array.isArray(validator1Result?.rewrite_advice)
                  ? validator1Result.rewrite_advice.join(' | ')
                  : '',
                validator_2_is_valid: validator2Result?.isValid ?? '',
                validator_2_has_unique_answer: validator2Result?.hasUniqueAnswer ?? '',
                validator_2_reason: validator2Result?.reason || validator2Error,
                validator_2_rewrite_advice: Array.isArray(validator2Result?.rewrite_advice)
                  ? validator2Result.rewrite_advice.join(' | ')
                  : '',
                validator_is_valid: finalValidator?.isValid ?? '',
                validator_has_unique_answer: finalValidator?.hasUniqueAnswer ?? '',
                validator_reason: finalValidator?.reason || validator2Error || validator1Error,
                validator_rewrite_advice: Array.isArray(finalValidator?.rewrite_advice)
                  ? finalValidator.rewrite_advice.join(' | ')
                  : '',
                error: rowError
              }

              writeLine(headers.map(key => escapeCsv(row[key])).join(','))
            }
          }
        }
      }
    }
  }

  const sortedWordCounts = summaryStats.wordCounts.slice().sort((a, b) => a - b)
  const wordCountMean = sortedWordCounts.length
    ? sortedWordCounts.reduce((sum, value) => sum + value, 0) / sortedWordCounts.length
    : 0
  const validatorDenominator = summaryStats.validatorRows || 1
  const totalRowsDenominator = summaryStats.totalRows || 1
  const pronounPatternDenominator = Object.values(summaryStats.pronounPatternCounts)
    .reduce((sum, count) => sum + count, 0) || 1

  const summaryOutput = {
    totals: {
      rows: summaryStats.totalRows,
      sentence_rows: summaryStats.sentenceRows,
      validator_rows: summaryStats.validatorRows,
      error_rows: summaryStats.errorRows,
      revisor_triggered_rows: summaryStats.revisorTriggered
    },
    validator_pass: {
      count: summaryStats.validatorPass,
      rate: roundNumber(summaryStats.validatorPass / validatorDenominator)
    },
    word_count: {
      mean: roundNumber(wordCountMean, 2),
      p10: roundNumber(quantile(sortedWordCounts, 0.1), 2),
      p50: roundNumber(quantile(sortedWordCounts, 0.5), 2),
      p90: roundNumber(quantile(sortedWordCounts, 0.9), 2)
    },
    host_form_distribution: buildDistribution(summaryStats.hostFormCounts, totalRowsDenominator),
    pronoun_pattern_distribution: buildDistribution(summaryStats.pronounPatternCounts, pronounPatternDenominator),
    run_config: {
      test_cases: testCases,
      models,
      generator_temperatures: temperatures,
      host_forms: hostForms,
      finite_tenses: allowedFiniteTenses,
      generator_prompt_indexes: generatorPromptIndexes,
      validator_prompt_indexes: validatorPromptIndexes,
      revisor_prompt_indexes: activeRevisorPromptIndexes,
      use_validator: useValidatorFlag,
      use_revisor: useRevisorFlag
    }
  }

  const summaryText = JSON.stringify(summaryOutput, null, 2)
  const summaryBasePath = resolvedOutputPath || resolvedLogPath || DEFAULT_OUTPUT_FILE
  const summaryDir = path.dirname(summaryBasePath)
  const summaryBaseName = path.basename(summaryBasePath, path.extname(summaryBasePath))
  const summaryPath = path.join(summaryDir, `${summaryBaseName}.summary.json`)
  fs.mkdirSync(summaryDir, { recursive: true })
  fs.writeFileSync(summaryPath, summaryText, 'utf8')
  if (logStream) {
    process.stderr.write(`[summary]\n${summaryText}\n`)
  }

  logLine({
    event: 'info',
    row_index: '',
    target: 'run',
    model: '',
    temperature: '',
    prompt_index: '',
    request_chars: '',
    response_chars: '',
    error: `cases=${testCases} models=${models.length} generator_prompts=${generatorPromptIndexes.length} validator_prompts=${validatorPromptIndexes.length} revisor_prompts=${activeRevisorPromptIndexes.length} host_forms=${hostForms.join('|')} validator_used=${useValidatorFlag} revisor_used=${useRevisorFlag}`
  })

  if (outputStream) {
    outputStream.end()
  }
  if (logStream) {
    logStream.end()
  }
}

main().catch(error => {
  console.error('[fatal]', error.message)
  process.exit(1)
})
