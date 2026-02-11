#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const axios = require('axios')

const dotenvPath = path.join(__dirname, '.env')
if (fs.existsSync(dotenvPath)) {
  require('dotenv').config({ path: dotenvPath })
}

const generatorPrompts = require('./input/generator_prompt')
const validatorPrompts = require('./input/validator_prompt')
const revisorPrompts = require('./input/revisor_prompt')

const VERB_SOURCE = path.join(__dirname, '../server/src/verbs.json')

const DEFAULT_MODELS = ['deepseek:deepseek-chat', 'qwen:qwen-plus', 'qwen:qwen3-max']
const DEFAULT_GENERATOR_TEMPS = [0.7]
const DEFAULT_VALIDATOR_FLAG = true
const DEFAULT_REVISOR_FLAG = true
const DEFAULT_TEST_CASES = 1
const DEFAULT_GENERATOR_PROMPTS = generatorPrompts.map((_, i) => i)
const DEFAULT_VALIDATOR_PROMPTS = validatorPrompts.map((_, i) => i)
const DEFAULT_REVISOR_PROMPTS = revisorPrompts.map((_, i) => i)
const TEMPLATE_OPENINGS = [
  'mañana',
  'manana',
  'ayer',
  'hoy',
  'ahora',
  'siempre',
  'nunca',
  'todos los días',
  'todos los dias',
  'cada día',
  'cada dia',
  'últimamente',
  'ultimamente',
  'en este momento'
]
const HIGH_RISK_TIME_ADVERBS = [
  'mañana',
  'manana',
  'ayer',
  'hoy',
  'ahora',
  'siempre',
  'nunca',
  'todos los días',
  'todos los dias',
  'cada día',
  'cada dia',
  'últimamente',
  'ultimamente',
  'en este momento'
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

function normalizeSentenceStart(text) {
  if (!text) return ''
  return text.trim().replace(/^[\s¡¿"'\(\[\{«»]+/, '').toLowerCase()
}

function startsWithAny(text, phrases) {
  const normalized = normalizeSentenceStart(text)
  return phrases.some(phrase => normalized.startsWith(phrase))
}

function countWords(text) {
  if (!text) return 0
  const matches = text.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g)
  return matches ? matches.length : 0
}

function countPhraseHits(text, phrases) {
  if (!text) return 0
  const lower = text.toLowerCase()
  let total = 0
  for (const phrase of phrases) {
    if (!phrase) continue
    let idx = 0
    while (idx < lower.length) {
      const found = lower.indexOf(phrase, idx)
      if (found === -1) break
      total += 1
      idx = found + phrase.length
    }
  }
  return total
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

function buildConjugationEntries(verb) {
  const ALLOWED_SLOTS = {
    'indicative.present': { mood: '陈述式', tense: '一般现在时' },
    'compound_indicative.preterite_perfect': { mood: '陈述式', tense: '现在完成时' },
    'indicative.imperfect': { mood: '陈述式', tense: '过去未完成时' },
    'indicative.preterite': { mood: '陈述式', tense: '简单过去时' },
    'indicative.future': { mood: '陈述式', tense: '将来未完成时' },
    'indicative.conditional': { mood: '条件式', tense: '简单条件式' },
    'imperative.affirmative': { mood: '命令式', tense: '命令式' },
    'imperative.negative': { mood: '命令式', tense: '否定命令式' },
    'subjunctive.present': { mood: '虚拟式', tense: '现在时' }
  }

  const personMap = {
    first_singular: '第一人称单数',
    second_singular: '第二人称单数',
    third_singular: '第三人称单数',
    first_plural: '第一人称复数',
    second_plural: '第二人称复数',
    third_plural: '第三人称复数'
  }

  const entries = []

  Object.entries(ALLOWED_SLOTS).forEach(([slot, labels]) => {
    const [moodKey, tenseKey] = slot.split('.')
    const tenseBlock = verb?.[moodKey]?.[tenseKey]
    if (!tenseBlock) return

    Object.entries(personMap).forEach(([personKey, personLabel]) => {
      const forms = tenseBlock[personKey]
      if (!Array.isArray(forms) || forms.length === 0) return
      entries.push({
        mood: labels.mood,
        tense: labels.tense,
        person: personLabel,
        conjugated_form: forms.join(' | ')
      })
    })
  })

  return entries
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

function buildHint(person, tense, mood) {
  if (mood && tense && person) return `${mood}-${tense}-${person}`
  if (mood && tense) return `${mood}-${tense}`
  if (tense && person) return `${tense}-${person}`
  if (mood) return String(mood)
  if (tense) return String(tense)
  if (person) return String(person)
  return ''
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
  const generatorPromptIndexes = parseNumberList(process.env.GENERATOR_PROMPTS) || DEFAULT_GENERATOR_PROMPTS
  const validatorPromptIndexes = parseNumberList(process.env.VALIDATOR_PROMPTS) || DEFAULT_VALIDATOR_PROMPTS
  const revisorPromptIndexes = parseNumberList(process.env.REVISOR_PROMPTS) || DEFAULT_REVISOR_PROMPTS
  const activeRevisorPromptIndexes = useRevisorFlag ? revisorPromptIndexes : [0]
  const generatorMaxTokens = parsePositiveInt(process.env.GENERATOR_MAX_TOKENS, 1000)
  const validatorMaxTokens = parsePositiveInt(process.env.VALIDATOR_MAX_TOKENS, 700)
  const revisorMaxTokens = parsePositiveInt(process.env.REVISOR_MAX_TOKENS, 500)
  const requestTimeoutMs = parsePositiveInt(process.env.REQUEST_TIMEOUT_MS, 45000)

  const deepseekApiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions'
  const deepseekApiKey = process.env.DEEPSEEK_API_KEY
  const qwenApiUrl = process.env.QWEN_API_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
  const qwenApiKey = process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY

  const outputPath = process.env.OUTPUT_FILE
  const logPath = process.env.LOG_FILE
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
    'conjugation_mood',
    'conjugation_tense',
    'conjugation_person',
    'conjugation_form',
    'question_sentence',
    'question_answer',
    'question_translation',
    'question_hint',
    'question_error',
    'revised_sentence',
    'revisor_reason',
    'revised_question_error',
    'generator_prompt_index',
    'generator_model',
    'generator_temperature',
    'validator_used',
    'validator_prompt_index',
    'revisor_used',
    'revisor_prompt_index',
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
    'validator_rewrite_advice'
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
    templateOpeningHits: 0,
    timeAdverbSentenceHits: 0,
    timeAdverbTotalHits: 0,
    validatorRows: 0,
    validatorPass: 0,
    failureTagCounts: {}
  }

  let rowIndex = 1
  for (let caseIndex = 0; caseIndex < testCases; caseIndex++) {
    const verb = pickRandom(verbs)
    const meaning = Array.isArray(verb.translation) ? verb.translation.join('、') : ''
    const conjugations = buildConjugationEntries(verb)
    if (conjugations.length === 0) {
      continue
    }
    const conjugation = pickRandom(conjugations)

    for (const promptIndex of generatorPromptIndexes) {
      const promptBuilder = generatorPrompts[promptIndex]
      if (!promptBuilder) continue

      const promptPayload = promptBuilder({
        verb: { infinitive: verb.infinitive, meaning },
        conjugation
      })

      for (const modelEntry of models) {
        const [provider, model] = modelEntry.includes(':')
          ? modelEntry.split(':')
          : ['deepseek', modelEntry]

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
              const fixedHint = buildHint(conjugation.person, conjugation.tense, conjugation.mood)

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
                const cleaned = cleanJsonText(rawQuestionText)
                question = JSON.parse(cleaned)
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

              const validatorTemperature = process.env.VALIDATOR_TEMPERATURE
                ? Number(process.env.VALIDATOR_TEMPERATURE)
                : temperature

              if (useValidatorFlag) {
                const validatorPromptBuilder = validatorPrompts[validatorPromptIndex]
                try {
                  const validatorPrompt = validatorPromptBuilder({
                    questionType: 'sentence',
                    questionText: question?.sentence || '',
                    correctAnswer: question?.answer || conjugation.conjugated_form,
                    exampleSentence: question?.sentence || '',
                    translation: question?.translation || '',
                    hint: fixedHint,
                    verb: { infinitive: verb.infinitive, meaning }
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
                  validator1Result = JSON.parse(cleanJsonText(rawValidator1Text))
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

              const parsedRevisorTemperature = process.env.REVISOR_TEMPERATURE
                ? Number(process.env.REVISOR_TEMPERATURE)
                : NaN
              const revisorTemperature = Number.isFinite(parsedRevisorTemperature)
                ? parsedRevisorTemperature
                : 0.4

              const validator1Passed = validator1Result?.isValid === true && validator1Result?.hasUniqueAnswer === true
              const shouldRunRevisor = useRevisorFlag && useValidatorFlag && question && !validator1Passed

              if (shouldRunRevisor) {
                const revisorPromptBuilder = revisorPrompts[revisorPromptIndex]
                try {
                  const revisorPrompt = revisorPromptBuilder({
                    verb: { infinitive: verb.infinitive, meaning },
                    conjugation,
                    originalQuestion: question,
                    validatorResult: validator1Result || { reason: validator1Error || '' },
                    fixedHint
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
                  revisorResult = JSON.parse(cleanJsonText(rawRevisorText))
                  const revisedSentence = typeof revisorResult?.sentence === 'string'
                    ? revisorResult.sentence.trim()
                    : ''
                  const revisedTranslation = typeof revisorResult?.translation === 'string'
                    ? revisorResult.translation.trim()
                    : ''
                  if (!revisedSentence) {
                    revisedQuestionError = 'revisor returned empty sentence'
                  } else {
                    revisedQuestion = {
                      ...question,
                      sentence: revisedSentence,
                      translation: revisedTranslation || question?.translation || ''
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

              if (useValidatorFlag && revisedQuestion?.sentence) {
                const validatorPromptBuilder = validatorPrompts[validatorPromptIndex]
                try {
                  const validatorPrompt = validatorPromptBuilder({
                    questionType: 'sentence',
                    questionText: revisedQuestion.sentence || '',
                    correctAnswer: revisedQuestion.answer || conjugation.conjugated_form,
                    exampleSentence: revisedQuestion.sentence || '',
                    translation: revisedQuestion.translation || '',
                    hint: fixedHint,
                    verb: { infinitive: verb.infinitive, meaning }
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
                  validator2Result = JSON.parse(cleanJsonText(rawValidator2Text))
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

              const sentenceText = revisedQuestion?.sentence || question?.sentence || ''
              summaryStats.totalRows += 1
              if (sentenceText) {
                summaryStats.sentenceRows += 1
                summaryStats.wordCounts.push(countWords(sentenceText))
                if (startsWithAny(sentenceText, TEMPLATE_OPENINGS)) {
                  summaryStats.templateOpeningHits += 1
                }
                const timeHits = countPhraseHits(sentenceText, HIGH_RISK_TIME_ADVERBS)
                if (timeHits > 0) {
                  summaryStats.timeAdverbSentenceHits += 1
                  summaryStats.timeAdverbTotalHits += timeHits
                }
              }

              const finalValidator = validator2Result || validator1Result
              if (useValidatorFlag) {
                summaryStats.validatorRows += 1
                if (finalValidator?.isValid === true && finalValidator?.hasUniqueAnswer === true) {
                  summaryStats.validatorPass += 1
                }
                if (Array.isArray(finalValidator?.failure_tags)) {
                  const uniqueTags = new Set(finalValidator.failure_tags.filter(Boolean))
                  for (const tag of uniqueTags) {
                    summaryStats.failureTagCounts[tag] = (summaryStats.failureTagCounts[tag] || 0) + 1
                  }
                }
              }

              const row = {
                verb_infinitive: verb.infinitive,
                verb_meaning: meaning,
                conjugation_mood: conjugation.mood,
                conjugation_tense: conjugation.tense,
                conjugation_person: conjugation.person,
                conjugation_form: conjugation.conjugated_form,
                question_sentence: question?.sentence || '',
                question_answer: question?.answer || '',
                question_translation: revisedQuestion?.translation || question?.translation || '',
                question_hint: fixedHint,
                question_error: questionError,
                revised_sentence: revisedQuestion?.sentence || '',
                revisor_reason: revisorResult?.revisor_reason || '',
                revised_question_error: revisedQuestionError || revisorError,
                generator_prompt_index: String(promptIndex),
                generator_model: model,
                generator_temperature: String(temperature),
                validator_used: String(useValidatorFlag),
                validator_prompt_index: String(validatorPromptIndex),
                revisor_used: String(useRevisorFlag),
                revisor_prompt_index: String(revisorPromptIndex),
                revisor_temperature: String(revisorTemperature),
                validator_1_is_valid: validator1Result?.isValid ?? '',
                validator_1_has_unique_answer: validator1Result?.hasUniqueAnswer ?? '',
                validator_1_reason: validator1Result?.reason || validator1Error,
                validator_1_rewrite_advice: Array.isArray(validator1Result?.rewrite_advice)
                  ? validator1Result.rewrite_advice.join(' | ')
                  : (validator1Result?.rewrite_advice || ''),
                validator_2_is_valid: validator2Result?.isValid ?? '',
                validator_2_has_unique_answer: validator2Result?.hasUniqueAnswer ?? '',
                validator_2_reason: validator2Result?.reason || validator2Error,
                validator_2_rewrite_advice: Array.isArray(validator2Result?.rewrite_advice)
                  ? validator2Result.rewrite_advice.join(' | ')
                  : (validator2Result?.rewrite_advice || ''),
                validator_is_valid: finalValidator?.isValid ?? '',
                validator_has_unique_answer: finalValidator?.hasUniqueAnswer ?? '',
                validator_reason: finalValidator?.reason || validator2Error || validator1Error,
                validator_rewrite_advice: Array.isArray(finalValidator?.rewrite_advice)
                  ? finalValidator.rewrite_advice.join(' | ')
                  : (finalValidator?.rewrite_advice || '')
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
  const sentenceDenominator = summaryStats.sentenceRows || 1
  const validatorDenominator = summaryStats.validatorRows || 1
  const failureTagSummary = {}
  Object.keys(summaryStats.failureTagCounts).sort().forEach(tag => {
    const count = summaryStats.failureTagCounts[tag]
    failureTagSummary[tag] = {
      count,
      rate: roundNumber(count / validatorDenominator)
    }
  })

  const summaryOutput = {
    totals: {
      rows: summaryStats.totalRows,
      sentence_rows: summaryStats.sentenceRows,
      validator_rows: summaryStats.validatorRows
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
    template_opening: {
      hits: summaryStats.templateOpeningHits,
      rate: roundNumber(summaryStats.templateOpeningHits / sentenceDenominator),
      phrases: TEMPLATE_OPENINGS
    },
    time_adverbs: {
      hit_sentences: summaryStats.timeAdverbSentenceHits,
      hit_rate: roundNumber(summaryStats.timeAdverbSentenceHits / sentenceDenominator),
      total_hits: summaryStats.timeAdverbTotalHits,
      phrases: HIGH_RISK_TIME_ADVERBS
    },
    failure_tags: {
      distribution: failureTagSummary
    }
  }

  const summaryText = JSON.stringify(summaryOutput, null, 2)
  const summaryBasePath = resolvedOutputPath || resolvedLogPath || path.join(__dirname, 'output', 'prompt_matrix.csv')
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
    error: `cases=${testCases} models=${models.length} generator_prompts=${generatorPromptIndexes.length} validator_prompts=${validatorPromptIndexes.length} revisor_prompts=${activeRevisorPromptIndexes.length} validator_used=${useValidatorFlag} revisor_used=${useRevisorFlag}`
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
