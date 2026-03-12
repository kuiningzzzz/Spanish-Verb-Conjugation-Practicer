const axios = require('axios')

const PERSON_KEYS = [
  'first_singular',
  'second_singular',
  'second_singular_vos_form',
  'third_singular',
  'first_plural',
  'second_plural',
  'third_plural'
]

const HABER_FORMS = {
  indicative: {
    present: {
      first_singular: 'he',
      second_singular: 'has',
      third_singular: 'ha',
      first_plural: 'hemos',
      second_plural: 'habéis',
      third_plural: 'han'
    },
    imperfect: {
      first_singular: 'había',
      second_singular: 'habías',
      third_singular: 'había',
      first_plural: 'habíamos',
      second_plural: 'habíais',
      third_plural: 'habían'
    },
    future: {
      first_singular: 'habré',
      second_singular: 'habrás',
      third_singular: 'habrá',
      first_plural: 'habremos',
      second_plural: 'habréis',
      third_plural: 'habrán'
    },
    conditional: {
      first_singular: 'habría',
      second_singular: 'habrías',
      third_singular: 'habría',
      first_plural: 'habríamos',
      second_plural: 'habríais',
      third_plural: 'habrían'
    },
    preterite: {
      first_singular: 'hube',
      second_singular: 'hubiste',
      third_singular: 'hubo',
      first_plural: 'hubimos',
      second_plural: 'hubisteis',
      third_plural: 'hubieron'
    }
  },
  subjunctive: {
    present: {
      first_singular: 'haya',
      second_singular: 'hayas',
      third_singular: 'haya',
      first_plural: 'hayamos',
      second_plural: 'hayáis',
      third_plural: 'hayan'
    },
    imperfect: {
      first_singular: ['hubiera', 'hubiese'],
      second_singular: ['hubieras', 'hubieses'],
      third_singular: ['hubiera', 'hubiese'],
      first_plural: ['hubiéramos', 'hubiésemos'],
      second_plural: ['hubierais', 'hubieseis'],
      third_plural: ['hubieran', 'hubiesen']
    },
    future: {
      first_singular: 'hubiere',
      second_singular: 'hubieres',
      third_singular: 'hubiere',
      first_plural: 'hubiéremos',
      second_plural: 'hubiereis',
      third_plural: 'hubieren'
    }
  }
}

const NON_IMPERATIVE_PERSON_TO_DB = {
  first_singular: 'yo',
  second_singular: 'tú',
  second_singular_vos_form: 'vos',
  third_singular: 'él/ella/usted',
  first_plural: 'nosotros',
  second_plural: 'vosotros',
  third_plural: 'ellos/ellas/ustedes'
}

const IMPERATIVE_PERSON_TO_DB = {
  second_singular: {
    肯定命令式: 'tú (afirmativo)',
    否定命令式: 'tú (negativo)'
  },
  second_singular_vos_form: {
    肯定命令式: 'vos',
    否定命令式: 'vos'
  },
  third_singular: {
    肯定命令式: 'usted',
    否定命令式: 'usted'
  },
  first_plural: {
    肯定命令式: 'nosotros/nosotras',
    否定命令式: 'nosotros/nosotras'
  },
  second_plural: {
    肯定命令式: 'vosotros/vosotras',
    否定命令式: 'vosotros/vosotras'
  },
  third_plural: {
    肯定命令式: 'ustedes',
    否定命令式: 'ustedes'
  }
}

const TARGET_TENSE_SPECS = [
  { mood: '陈述式', tense: '现在时', source: { block: 'indicative', tense: 'present' }, imperative: false },
  { mood: '陈述式', tense: '现在完成时', source: { block: 'compound_indicative', tense: 'preterite_perfect' }, imperative: false },
  { mood: '陈述式', tense: '未完成过去时', source: { block: 'indicative', tense: 'imperfect' }, imperative: false },
  { mood: '陈述式', tense: '简单过去时', source: { block: 'indicative', tense: 'preterite' }, imperative: false },
  { mood: '陈述式', tense: '将来时', source: { block: 'indicative', tense: 'future' }, imperative: false },
  { mood: '陈述式', tense: '过去完成时', source: { block: 'compound_indicative', tense: 'pluperfect' }, imperative: false },
  { mood: '陈述式', tense: '将来完成时', source: { block: 'compound_indicative', tense: 'future_perfect' }, imperative: false },
  { mood: '陈述式', tense: '前过去时', source: { block: 'compound_indicative', tense: 'preterite_anterior' }, imperative: false },
  { mood: '虚拟式', tense: '虚拟现在时', source: { block: 'subjunctive', tense: 'present' }, imperative: false },
  { mood: '虚拟式', tense: '虚拟过去时', source: { block: 'subjunctive', tense: 'imperfect' }, imperative: false },
  { mood: '虚拟式', tense: '虚拟现在完成时', source: { block: 'compound_subjunctive', tense: 'preterite_perfect' }, imperative: false },
  { mood: '虚拟式', tense: '虚拟过去完成时', source: { block: 'compound_subjunctive', tense: 'pluperfect' }, imperative: false },
  { mood: '虚拟式', tense: '虚拟将来未完成时', source: { block: 'subjunctive', tense: 'future' }, imperative: false },
  { mood: '虚拟式', tense: '虚拟将来完成时', source: { block: 'compound_subjunctive', tense: 'future_perfect' }, imperative: false },
  { mood: '条件式', tense: '条件式', source: { block: 'indicative', tense: 'conditional' }, imperative: false },
  { mood: '条件式', tense: '条件完成时', source: { block: 'compound_indicative', tense: 'conditional_perfect' }, imperative: false },
  { mood: '命令式', tense: '肯定命令式', source: { block: 'imperative', tense: 'affirmative' }, imperative: true },
  { mood: '命令式', tense: '否定命令式', source: { block: 'imperative', tense: 'negative' }, imperative: true }
]

const SYSTEM_PROMPT_VALIDATE = `
You are a Spanish linguist and validator.
Given one input token, decide whether it can serve as a valid Spanish verb lemma (infinitive stem / dictionary infinitive base) for conjugation generation.

Output strict JSON only:
{
  "is_valid": true|false,
  "reason": "short reason in Chinese"
}
`

const SYSTEM_PROMPT_GENERATE = `
You are an expert Spanish linguist and strict JSON generator.

Task:
Given ONE Spanish verb infinitive base, generate a single JSON object for admin autofill.
Return JSON only. No markdown, no explanations.

Output schema (strict):
{
  "infinitive": "string",
  "meaning": "中文释义（尽可能全，多个义项用；分隔）",
  "gerund": "string",
  "participle": ["regularParticiple", "optionalIrregularParticiple"],
  "is_reflexive": boolean,
  "has_tr_use": boolean,
  "has_intr_use": boolean,
  "supports_do": boolean,
  "supports_io": boolean,
  "supports_do_io": boolean,
  "indicative": {
    "present": tenseObj,
    "imperfect": tenseObj,
    "preterite": tenseObj,
    "future": tenseObj,
    "conditional": tenseObj
  },
  "subjunctive": {
    "present": tenseObj,
    "imperfect": tenseObj,
    "future": tenseObj
  },
  "imperative": {
    "affirmative": tenseObj,
    "negative": tenseObj
  }
}

For each tenseObj:
{
  "regular": boolean,
  "first_singular": ["..."],
  "second_singular": ["..."],
  "second_singular_vos_form": ["..."],
  "third_singular": ["..."],
  "first_plural": ["..."],
  "second_plural": ["..."],
  "third_plural": ["..."]
}

Rules:
- meaning must include major/common Chinese senses as complete as possible.
- meaning should be a single string separated by "；" without numbering.
- for example, "ir" should be like: "去；走；前往；进行".
- participle must have length 1 or 2.
- If no imperative form exists for a person, return [].
- subjunctive.imperfect should provide two forms when applicable (ra/se), ordered as ["...ra","...se"].
- Use true/false booleans (not strings).
`

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
  const model = (
    process.env.VERB_AUTOFILL_MODEL
    || process.env.EXERCISE_GENERATOR_MODEL
    || getDefaultModel(provider)
  ).trim()
  const timeoutMs = parsePositiveInt(process.env.EXERCISE_GENERATOR_TIMEOUT_MS, 45000)
  return { provider, apiKey, apiUrl, model, timeoutMs }
}

function extractJsonFromText(text) {
  const raw = String(text || '').trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim()
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end < 0 || end < start) {
    throw new Error('模型返回不是 JSON')
  }
  return raw.slice(start, end + 1)
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

function toStringList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean)
  if (value === null || value === undefined) return []
  const str = String(value).trim()
  return str ? [str] : []
}

function normalizeMeaning(value) {
  const rawParts = Array.isArray(value)
    ? value
    : String(value || '')
        .split(/[；;，、,\n]+/g)

  const cleaned = Array.from(
    new Set(
      rawParts
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    )
  )

  return cleaned.join('；')
}

function toBool(value, fallback = false) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true
    if (['false', '0', 'no', 'n'].includes(normalized)) return false
  }
  return fallback
}

function ensureTenseObj(raw) {
  const tenseObj = raw && typeof raw === 'object' ? raw : {}
  const next = { regular: toBool(tenseObj.regular, false) }
  PERSON_KEYS.forEach((key) => {
    next[key] = toStringList(tenseObj[key])
  })
  if (!next.second_singular_vos_form.length && next.second_singular.length) {
    next.second_singular_vos_form = [...next.second_singular]
  }
  return next
}

function normalizeGenerated(raw) {
  const data = raw && typeof raw === 'object' ? raw : {}

  const participles = toStringList(data.participle).slice(0, 2)
  const normalized = {
    infinitive: String(data.infinitive || '').trim(),
    meaning: normalizeMeaning(data.meaning),
    gerund: String(data.gerund || '').trim(),
    participle: participles,
    is_reflexive: toBool(data.is_reflexive, false),
    has_tr_use: toBool(data.has_tr_use, false),
    has_intr_use: toBool(data.has_intr_use, false),
    supports_do: toBool(data.supports_do, false),
    supports_io: toBool(data.supports_io, false),
    supports_do_io: toBool(data.supports_do_io, false),
    indicative: {},
    subjunctive: {},
    imperative: {}
  }

  ;['present', 'imperfect', 'preterite', 'future', 'conditional'].forEach((tense) => {
    normalized.indicative[tense] = ensureTenseObj(data?.indicative?.[tense])
  })
  ;['present', 'imperfect', 'future'].forEach((tense) => {
    normalized.subjunctive[tense] = ensureTenseObj(data?.subjunctive?.[tense])
  })
  ;['affirmative', 'negative'].forEach((tense) => {
    normalized.imperative[tense] = ensureTenseObj(data?.imperative?.[tense])
  })

  return normalized
}

function buildCompoundTense(auxForms, participles, { useAllParticiples = false, useDoubleAux = false } = {}) {
  const tenseObj = { regular: participles.length <= 1 }
  PERSON_KEYS.forEach((personKey) => {
    if (personKey === 'second_singular_vos_form') {
      tenseObj[personKey] = []
      return
    }

    const auxRaw = auxForms?.[personKey]
    if (!auxRaw) {
      tenseObj[personKey] = []
      return
    }

    const auxList = useDoubleAux ? toStringList(auxRaw) : [String(auxRaw).trim()].filter(Boolean)
    const forms = []
    if (useAllParticiples) {
      participles.forEach((participle) => {
        auxList.forEach((aux) => {
          forms.push(`${aux} ${participle}`.trim())
        })
      })
    } else {
      const baseParticiple = participles[0] || ''
      auxList.forEach((aux) => {
        forms.push(`${aux} ${baseParticiple}`.trim())
      })
    }
    tenseObj[personKey] = forms.filter(Boolean)
  })

  if (!tenseObj.second_singular_vos_form.length && tenseObj.second_singular?.length) {
    tenseObj.second_singular_vos_form = [...tenseObj.second_singular]
  }

  return tenseObj
}

function addCompoundTenses(data) {
  const participles = data.participle.length ? data.participle : [String(data.participle[0] || '').trim()].filter(Boolean)
  if (!participles.length) {
    data.compound_indicative = {}
    data.compound_subjunctive = {}
    return data
  }

  data.compound_indicative = {
    preterite_perfect: buildCompoundTense(HABER_FORMS.indicative.present, participles),
    pluperfect: buildCompoundTense(HABER_FORMS.indicative.imperfect, participles),
    future_perfect: buildCompoundTense(HABER_FORMS.indicative.future, participles),
    conditional_perfect: buildCompoundTense(HABER_FORMS.indicative.conditional, participles),
    preterite_anterior: buildCompoundTense(HABER_FORMS.indicative.preterite, participles, { useAllParticiples: true })
  }

  data.compound_subjunctive = {
    preterite_perfect: buildCompoundTense(HABER_FORMS.subjunctive.present, participles),
    pluperfect: buildCompoundTense(HABER_FORMS.subjunctive.imperfect, participles, {
      useAllParticiples: true,
      useDoubleAux: true
    }),
    future_perfect: buildCompoundTense(HABER_FORMS.subjunctive.future, participles)
  }
  return data
}

function ensureImperativeCoreForms(data) {
  const subjPresent = data?.subjunctive?.present || {}
  ;['affirmative', 'negative'].forEach((tenseKey) => {
    const target = data?.imperative?.[tenseKey]
    if (!target || typeof target !== 'object') return

    if (!toStringList(target.third_singular).length) {
      target.third_singular = toStringList(subjPresent.third_singular)
    }
    if (!toStringList(target.third_plural).length) {
      target.third_plural = toStringList(subjPresent.third_plural)
    }
  })

  return data
}

function getJoinedForms(tenseObj, personKey) {
  const forms = Array.from(new Set(toStringList(tenseObj?.[personKey])))
  if (!forms.length) return ''
  return forms.join(' ｜ ')
}

function flattenConjugations(data) {
  const rows = []
  TARGET_TENSE_SPECS.forEach((spec) => {
    const tenseObj = data?.[spec.source.block]?.[spec.source.tense] || {}
    const isIrregular = !toBool(tenseObj.regular, false)
    PERSON_KEYS.forEach((personKey) => {
      if (spec.imperative && personKey === 'first_singular') {
        return
      }

      if (!spec.imperative && !NON_IMPERATIVE_PERSON_TO_DB[personKey]) {
        return
      }

      const person = spec.imperative
        ? IMPERATIVE_PERSON_TO_DB[personKey]?.[spec.tense]
        : NON_IMPERATIVE_PERSON_TO_DB[personKey]

      if (!person) return

      const conjugatedForm = getJoinedForms(tenseObj, personKey)
      rows.push({
        mood: spec.mood,
        tense: spec.tense,
        person,
        conjugated_form: conjugatedForm,
        is_irregular: isIrregular
      })
    })
  })
  return rows
}

function computeTopLevelIrregular(data) {
  const blocks = [
    data.indicative,
    data.subjunctive,
    data.imperative
  ]
  for (const block of blocks) {
    const tenses = Object.values(block || {})
    for (const tenseObj of tenses) {
      if (!toBool(tenseObj?.regular, false)) {
        return true
      }
    }
  }
  return false
}

async function validateInfinitive(infinitive) {
  const verb = String(infinitive || '').trim()
  if (!verb) {
    return { isValid: false, reason: 'empty' }
  }

  const content = await chat({
    system: SYSTEM_PROMPT_VALIDATE,
    user: `词条：${verb}`,
    temperature: parseNumber(process.env.VERB_AUTOFILL_VALIDATE_TEMPERATURE, 0.1),
    maxTokens: parsePositiveInt(process.env.VERB_AUTOFILL_VALIDATE_MAX_TOKENS, 220)
  })

  const parsed = JSON.parse(extractJsonFromText(content))
  const isValid = toBool(parsed.is_valid, false)
  const reason = String(parsed.reason || '').trim()
  return { isValid, reason }
}

async function generateAutofill(infinitive) {
  const verb = String(infinitive || '').trim()
  if (!verb) {
    throw new Error('infinitive 不能为空')
  }

  const content = await chat({
    system: SYSTEM_PROMPT_GENERATE,
    user: `Verb: ${verb}`,
    temperature: parseNumber(process.env.VERB_AUTOFILL_GENERATE_TEMPERATURE, 0.2),
    maxTokens: parsePositiveInt(process.env.VERB_AUTOFILL_GENERATE_MAX_TOKENS, 6000)
  })

  const parsed = JSON.parse(extractJsonFromText(content))
  const normalized = ensureImperativeCoreForms(addCompoundTenses(normalizeGenerated(parsed)))
  const conjugations = flattenConjugations(normalized)
  const secondParticiple = normalized.participle[1] || ''

  return {
    fields: {
      meaning: normalized.meaning,
      gerund: normalized.gerund,
      participle: normalized.participle[0] || '',
      participle_forms: secondParticiple,
      is_irregular: computeTopLevelIrregular(normalized),
      is_reflexive: toBool(normalized.is_reflexive, false),
      has_tr_use: toBool(normalized.has_tr_use, false),
      has_intr_use: toBool(normalized.has_intr_use, false),
      supports_do: toBool(normalized.supports_do, false),
      supports_io: toBool(normalized.supports_io, false),
      supports_do_io: toBool(normalized.supports_do_io, false)
    },
    conjugations
  }
}

module.exports = {
  getConfig,
  validateInfinitive,
  generateAutofill
}
