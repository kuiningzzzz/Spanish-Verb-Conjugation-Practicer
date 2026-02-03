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

const VERB_SOURCE = path.join(__dirname, '../server/src/verbs.json')

const DEFAULT_MODELS = ['deepseek:deepseek-chat', 'qwen:qwen-plus', 'qwen:qwen3-max']
const DEFAULT_GENERATOR_TEMPS = [0.7]
const DEFAULT_VALIDATOR_FLAG = true
const DEFAULT_TEST_CASES = 1
const DEFAULT_GENERATOR_PROMPTS = generatorPrompts.map((_, i) => i)
const DEFAULT_VALIDATOR_PROMPTS = validatorPrompts.map((_, i) => i)

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

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function buildConjugationEntries(verb) {
  const moodMap = {
    indicative: '陈述式',
    subjunctive: '虚拟式',
    imperative: '命令式',
    compound_indicative: '复合陈述式',
    compound_subjunctive: '复合虚拟式'
  }

  const tenseMap = {
    present: '现在时',
    imperfect: '未完成过去时',
    preterite: '简单过去时',
    future: '将来时',
    conditional: '条件式',
    affirmative: '肯定命令式',
    negative: '否定命令式',
    preterite_perfect: '现在完成时',
    pluperfect: '过去完成时',
    future_perfect: '将来完成时',
    conditional_perfect: '条件完成时',
    preterite_anterior: '先过去时'
  }

  const personMap = {
    first_singular: '第一人称单数',
    second_singular: '第二人称单数',
    second_singular_vos_form: '第二人称单数（vos）',
    third_singular: '第三人称单数',
    first_plural: '第一人称复数',
    second_plural: '第二人称复数',
    third_plural: '第三人称复数'
  }

  const entries = []

  Object.entries(moodMap).forEach(([moodKey, moodLabel]) => {
    const moodBlock = verb[moodKey]
    if (!moodBlock) return
    Object.entries(moodBlock).forEach(([tenseKey, tenseBlock]) => {
      if (!tenseBlock) return
      Object.entries(personMap).forEach(([personKey, personLabel]) => {
        const forms = tenseBlock[personKey]
        if (!Array.isArray(forms) || forms.length === 0) return
        const conjugatedForm = forms.join(' | ')
        entries.push({
          mood: moodLabel,
          tense: tenseMap[tenseKey] || tenseKey,
          person: personLabel,
          conjugated_form: conjugatedForm
        })
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

async function callChat({ apiUrl, apiKey, model, temperature, system, user, maxTokens }) {
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
      timeout: 30000
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

async function main() {
  const verbs = JSON.parse(fs.readFileSync(VERB_SOURCE, 'utf8'))
  if (!Array.isArray(verbs) || verbs.length === 0) {
    throw new Error('verbs.json is empty')
  }

  const models = parseCsvList(process.env.MODELS) || DEFAULT_MODELS
  const temperatures = parseNumberList(process.env.GENERATOR_TEMPERATURES) || DEFAULT_GENERATOR_TEMPS
  const useValidator = parseBool(process.env.USE_VALIDATOR)
  const useValidatorFlag = useValidator === null ? DEFAULT_VALIDATOR_FLAG : useValidator
  const testCasesParsed = Number.parseInt(process.env.TEST_CASES || DEFAULT_TEST_CASES, 10)
  const testCases = Number.isFinite(testCasesParsed) && testCasesParsed > 0
    ? testCasesParsed
    : DEFAULT_TEST_CASES
  const generatorPromptIndexes = parseNumberList(process.env.GENERATOR_PROMPTS) || DEFAULT_GENERATOR_PROMPTS
  const validatorPromptIndexes = parseNumberList(process.env.VALIDATOR_PROMPTS) || DEFAULT_VALIDATOR_PROMPTS

  const deepseekApiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions'
  const deepseekApiKey = process.env.DEEPSEEK_API_KEY
  const qwenApiUrl = process.env.QWEN_API_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
  const qwenApiKey = process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY

  const outputPath = process.env.OUTPUT_FILE
  const logPath = process.env.LOG_FILE
  let outputStream = null
  let logStream = null
  if (outputPath) {
    const resolved = path.isAbsolute(outputPath)
      ? outputPath
      : path.join(process.cwd(), outputPath)
    fs.mkdirSync(path.dirname(resolved), { recursive: true })
    outputStream = fs.createWriteStream(resolved, { encoding: 'utf8' })
  }
  if (logPath) {
    const resolvedLog = path.isAbsolute(logPath)
      ? logPath
      : path.join(process.cwd(), logPath)
    fs.mkdirSync(path.dirname(resolvedLog), { recursive: true })
    logStream = fs.createWriteStream(resolvedLog, { encoding: 'utf8' })
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
    'generator_prompt_index',
    'generator_model',
    'generator_temperature',
    'validator_used',
    'validator_prompt_index',
    'validator_is_valid',
    'validator_has_unique_answer',
    'validator_reason'
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
    process.stderr.write(`${line}\n`)
    if (logStream) {
      logStream.write(`${line}\n`)
    }
  }

  writeLine(headers.map(escapeCsv).join(','))
  logLine(Object.fromEntries(logHeaders.map(key => [key, key])))

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
          let question = null
          let questionError = ''
          let rawQuestionText = ''

          try {
            const requestText = `${promptPayload.system}\n${promptPayload.user}`
            logLine({
              event: 'request',
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
              maxTokens: 800
            })

            logLine({
              event: 'response',
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
              target: 'generator',
              model,
              temperature,
              prompt_index: promptIndex,
              error: questionError
            })
          }

          for (const vPromptIndex of validatorPromptIndexes) {
            const validatorPromptIndex = vPromptIndex
            let validatorResult = null
            let validatorError = ''

            if (useValidatorFlag) {
              const validatorPromptBuilder = validatorPrompts[validatorPromptIndex]

              try {
                const validatorPrompt = validatorPromptBuilder({
                  questionType: 'sentence',
                  questionText: question?.sentence || '',
                  correctAnswer: question?.answer || conjugation.conjugated_form,
                  exampleSentence: question?.sentence || '',
                  translation: question?.translation || '',
                  hint: question?.hint || '',
                  verb: { infinitive: verb.infinitive, meaning }
                })

                const validatorTemperature = process.env.VALIDATOR_TEMPERATURE
                  ? Number(process.env.VALIDATOR_TEMPERATURE)
                  : temperature

                const validatorRequestText = `${validatorPrompt.system}\n${validatorPrompt.user}`
                logLine({
                  event: 'request',
                  target: 'validator',
                  model,
                  temperature: validatorTemperature,
                  prompt_index: validatorPromptIndex,
                  request_chars: validatorRequestText.length
                })
                const validatorText = await callChat({
                  apiUrl,
                  apiKey,
                  model,
                  temperature: validatorTemperature,
                  system: validatorPrompt.system,
                  user: validatorPrompt.user,
                  maxTokens: 300
                })

                logLine({
                  event: 'response',
                  target: 'validator',
                  model,
                  temperature: validatorTemperature,
                  prompt_index: validatorPromptIndex,
                  response_chars: validatorText ? validatorText.length : 0
                })
                const cleanedValidator = cleanJsonText(validatorText)
                validatorResult = JSON.parse(cleanedValidator)
                validatorError = ''
              } catch (error) {
                validatorError = error.message
                logLine({
                  event: 'error',
                  target: 'validator',
                  model,
                  temperature,
                  prompt_index: validatorPromptIndex,
                  error: validatorError
                })
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
              question_translation: question?.translation || '',
              question_hint: question?.hint || '',
              question_error: questionError,
              generator_prompt_index: String(promptIndex),
              generator_model: model,
              generator_temperature: String(temperature),
              validator_used: String(useValidatorFlag),
              validator_prompt_index: String(validatorPromptIndex),
              validator_is_valid: validatorResult?.isValid ?? '',
              validator_has_unique_answer: validatorResult?.hasUniqueAnswer ?? '',
              validator_reason: validatorResult?.reason || validatorError
            }
            writeLine(headers.map(key => escapeCsv(row[key])).join(','))
          }
        }
      }
    }
  }

  logLine({
    event: 'info',
    target: 'run',
    model: '',
    temperature: '',
    prompt_index: '',
    request_chars: '',
    response_chars: '',
    error: `cases=${testCases} models=${models.length} generator_prompts=${generatorPromptIndexes.length} validator_prompts=${validatorPromptIndexes.length} validator_used=${useValidatorFlag}`
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
