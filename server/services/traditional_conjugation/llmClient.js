const axios = require('axios')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../../.env') })

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

function parseNumber(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return parsed
}

function getDefaultUrl(provider) {
  if (provider === 'qwen') {
    return 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
  }
  return 'https://api.deepseek.com/v1/chat/completions'
}

function getDefaultModel(provider) {
  if (provider === 'qwen') return 'qwen-plus'
  return 'deepseek-chat'
}

function getConfig() {
  const provider = (process.env.EXERCISE_GENERATOR_PROVIDER || 'deepseek').trim().toLowerCase()
  const apiKey = (process.env.EXERCISE_GENERATOR_API_KEY || '').trim()
  const apiUrl = (process.env.EXERCISE_GENERATOR_API_URL || getDefaultUrl(provider)).trim()
  const model = (process.env.EXERCISE_GENERATOR_MODEL || getDefaultModel(provider)).trim()
  const timeoutMs = parsePositiveInt(process.env.EXERCISE_GENERATOR_TIMEOUT_MS, 45000)

  return {
    provider,
    apiKey,
    apiUrl,
    model,
    timeoutMs
  }
}

function cleanJsonText(text) {
  if (!text) return ''
  let cleaned = String(text).trim()
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '')
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/```\n?/g, '')
  }
  return cleaned.trim()
}

async function chat({ system, user, temperature, maxTokens }) {
  const config = getConfig()
  if (!config.apiKey) {
    throw new Error('EXERCISE_GENERATOR_API_KEY 未配置')
  }

  const response = await axios.post(
    config.apiUrl,
    {
      model: config.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature,
      max_tokens: maxTokens
    },
    {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: config.timeoutMs
    }
  )

  return response.data?.choices?.[0]?.message?.content || ''
}

function getStageSettings(stage) {
  const upper = String(stage || '').toUpperCase()
  if (upper === 'VALIDATOR') {
    return {
      maxTokens: parsePositiveInt(process.env.EXERCISE_GENERATOR_VALIDATOR_MAX_TOKENS, 700),
      temperature: parseNumber(process.env.EXERCISE_GENERATOR_VALIDATOR_TEMPERATURE, 0.3)
    }
  }
  if (upper === 'REVISOR') {
    return {
      maxTokens: parsePositiveInt(process.env.EXERCISE_GENERATOR_REVISOR_MAX_TOKENS, 500),
      temperature: parseNumber(process.env.EXERCISE_GENERATOR_REVISOR_TEMPERATURE, 0.4)
    }
  }
  return {
    maxTokens: parsePositiveInt(process.env.EXERCISE_GENERATOR_GENERATOR_MAX_TOKENS, 1000),
    temperature: parseNumber(process.env.EXERCISE_GENERATOR_GENERATOR_TEMPERATURE, 0.7)
  }
}

module.exports = {
  getConfig,
  getStageSettings,
  chat,
  cleanJsonText
}
