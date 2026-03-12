const { vocabularyDb } = require('../database/db')

const PERSON_KEYS = [
  'first_singular',
  'second_singular',
  'second_singular_vos_form',
  'third_singular',
  'first_plural',
  'second_plural',
  'third_plural'
]

const BLOCK_TENSE_ORDER = {
  indicative: ['present', 'imperfect', 'preterite', 'future', 'conditional'],
  subjunctive: ['present', 'imperfect', 'future'],
  imperative: ['affirmative', 'negative'],
  compound_indicative: ['preterite_perfect', 'pluperfect', 'future_perfect', 'conditional_perfect', 'preterite_anterior'],
  compound_subjunctive: ['preterite_perfect', 'pluperfect', 'future_perfect']
}

function normalizeText(value) {
  return String(value || '').trim()
}

function normalizeToken(value) {
  return normalizeText(value).toLowerCase()
}

function splitForms(value) {
  return Array.from(
    new Set(
      String(value || '')
        .split(/\s*[|｜]\s*/g)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  )
}

function splitTranslations(value) {
  return Array.from(
    new Set(
      String(value || '')
        .split(/[；;\n]+/g)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  )
}

function toBoolean(value, fallback = false) {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  const text = normalizeToken(value)
  if (['true', '1', 'yes', 'y'].includes(text)) return true
  if (['false', '0', 'no', 'n'].includes(text)) return false
  return fallback
}

function toNullableBoolean(value) {
  if (value === null || value === undefined) return null
  return toBoolean(value, false)
}

function createEmptyTenseRecord() {
  const record = { regular: true }
  PERSON_KEYS.forEach((key) => {
    record[key] = []
  })
  return record
}

function createOrderedMoodBlock(blockName) {
  const block = {}
  ;(BLOCK_TENSE_ORDER[blockName] || []).forEach((tenseKey) => {
    block[tenseKey] = createEmptyTenseRecord()
  })
  return block
}

function buildParticipleList(verb) {
  const values = []
  const primary = normalizeText(verb.participle)
  if (primary) values.push(primary)
  splitForms(verb.participle_forms).forEach((item) => {
    if (!values.includes(item)) values.push(item)
  })
  return values
}

function createVerbExportRecord(verb) {
  return {
    infinitive: normalizeText(verb.infinitive),
    gerund: normalizeText(verb.gerund),
    participle: buildParticipleList(verb),
    is_reflexive: toBoolean(verb.is_reflexive, false),
    has_tr_use: toBoolean(verb.has_tr_use, false),
    has_intr_use: toBoolean(verb.has_intr_use, false),
    supports_do: toNullableBoolean(verb.supports_do),
    supports_io: toNullableBoolean(verb.supports_io),
    supports_do_io: toNullableBoolean(verb.supports_do_io),
    indicative: createOrderedMoodBlock('indicative'),
    subjunctive: createOrderedMoodBlock('subjunctive'),
    imperative: createOrderedMoodBlock('imperative'),
    compound_indicative: createOrderedMoodBlock('compound_indicative'),
    compound_subjunctive: createOrderedMoodBlock('compound_subjunctive'),
    translation: splitTranslations(verb.meaning)
  }
}

function resolvePersonKey(person, blockName, tenseKey) {
  const value = normalizeText(person)
  const token = normalizeToken(person)

  if (blockName === 'imperative') {
    if ((value === 'tú (afirmativo)' || value === 'tú') && tenseKey === 'affirmative') return 'second_singular'
    if ((value === 'tú (negativo)' || value === 'tú') && tenseKey === 'negative') return 'second_singular'
    if (token === 'vos') return 'second_singular_vos_form'
    if (['usted', 'él/ella/usted'].includes(value)) return 'third_singular'
    if (['nosotros', 'nosotros/nosotras'].includes(value)) return 'first_plural'
    if (['vosotros', 'vosotros/vosotras'].includes(value)) return 'second_plural'
    if (['ustedes', 'ellos/ellas/ustedes'].includes(value)) return 'third_plural'
    return null
  }

  if (token === 'yo') return 'first_singular'
  if (value === 'tú') return 'second_singular'
  if (token === 'vos') return 'second_singular_vos_form'
  if (['usted', 'él/ella/usted'].includes(value)) return 'third_singular'
  if (['nosotros', 'nosotros/nosotras'].includes(value)) return 'first_plural'
  if (['vosotros', 'vosotros/vosotras'].includes(value)) return 'second_plural'
  if (['ustedes', 'ellos/ellas/ustedes'].includes(value)) return 'third_plural'
  return null
}

function resolveBlockAndTense(mood, tense) {
  const moodValue = normalizeText(mood)
  const moodToken = normalizeToken(mood)
  const tenseValue = normalizeText(tense)
  const tenseToken = normalizeToken(tense)

  const indicativeMoods = new Set(['陈述式', '复合陈述式', '条件式'])
  const subjunctiveMoods = new Set(['虚拟式', '复合虚拟式'])
  const moodAliasesIndicative = new Set(['indicativo', 'indicativo_compuesto', 'condicional'])
  const moodAliasesSubjunctive = new Set(['subjuntivo', 'subjuntivo_compuesto'])

  if (['现在时', 'present', 'presente'].includes(tenseToken) && (indicativeMoods.has(moodValue) || moodAliasesIndicative.has(moodToken))) {
    return { block: 'indicative', tenseKey: 'present' }
  }
  if (['未完成过去时', '过去未完成时', 'imperfect', 'imperfecto'].includes(tenseToken) && (indicativeMoods.has(moodValue) || moodAliasesIndicative.has(moodToken))) {
    return { block: 'indicative', tenseKey: 'imperfect' }
  }
  if (['简单过去时', 'preterite', 'preterito', 'pretérito'].includes(tenseToken) && (indicativeMoods.has(moodValue) || moodAliasesIndicative.has(moodToken))) {
    return { block: 'indicative', tenseKey: 'preterite' }
  }
  if (['将来时', '将来未完成时', 'future', 'futuro'].includes(tenseToken) && (indicativeMoods.has(moodValue) || moodAliasesIndicative.has(moodToken))) {
    return { block: 'indicative', tenseKey: 'future' }
  }
  if (['条件式', 'conditional', 'condicional'].includes(tenseToken)) {
    return { block: 'indicative', tenseKey: 'conditional' }
  }

  if (['虚拟现在时', 'subjuntivo_presente'].includes(tenseToken) || (['现在时', 'present', 'presente'].includes(tenseToken) && (subjunctiveMoods.has(moodValue) || moodAliasesSubjunctive.has(moodToken)))) {
    return { block: 'subjunctive', tenseKey: 'present' }
  }
  if (['虚拟过去时', 'subjuntivo_imperfecto'].includes(tenseToken) || (['未完成过去时', '过去未完成时', 'imperfect', 'imperfecto'].includes(tenseToken) && (subjunctiveMoods.has(moodValue) || moodAliasesSubjunctive.has(moodToken)))) {
    return { block: 'subjunctive', tenseKey: 'imperfect' }
  }
  if (['虚拟将来未完成时', '虚拟将来时', 'subjuntivo_futuro'].includes(tenseToken) || (['将来时', '将来未完成时', 'future', 'futuro'].includes(tenseToken) && (subjunctiveMoods.has(moodValue) || moodAliasesSubjunctive.has(moodToken)))) {
    return { block: 'subjunctive', tenseKey: 'future' }
  }

  if (['肯定命令式', 'imperativo_afirmativo', 'afirmativo'].includes(tenseToken) && ['命令式', 'imperativo'].includes(moodToken || moodValue)) {
    return { block: 'imperative', tenseKey: 'affirmative' }
  }
  if (['否定命令式', 'imperativo_negativo', 'negativo'].includes(tenseToken) && ['命令式', 'imperativo'].includes(moodToken || moodValue)) {
    return { block: 'imperative', tenseKey: 'negative' }
  }

  if (['现在完成时', 'perfecto'].includes(tenseToken)) {
    return { block: 'compound_indicative', tenseKey: 'preterite_perfect' }
  }
  if (['过去完成时', 'pluscuamperfecto'].includes(tenseToken)) {
    if (subjunctiveMoods.has(moodValue) || moodAliasesSubjunctive.has(moodToken) || tenseToken === '虚拟过去完成时') {
      return { block: 'compound_subjunctive', tenseKey: 'pluperfect' }
    }
    return { block: 'compound_indicative', tenseKey: 'pluperfect' }
  }
  if (['将来完成时', 'futuro_perfecto'].includes(tenseToken)) {
    if (subjunctiveMoods.has(moodValue) || moodAliasesSubjunctive.has(moodToken) || tenseToken === '虚拟将来完成时') {
      return { block: 'compound_subjunctive', tenseKey: 'future_perfect' }
    }
    return { block: 'compound_indicative', tenseKey: 'future_perfect' }
  }
  if (['前过去时', '先过去时', 'preterito_anterior', 'pretérito_anterior'].includes(tenseToken)) {
    return { block: 'compound_indicative', tenseKey: 'preterite_anterior' }
  }
  if (['条件完成时', 'condicional_perfecto', 'conditional_perfect'].includes(tenseToken)) {
    return { block: 'compound_indicative', tenseKey: 'conditional_perfect' }
  }
  if (['虚拟现在完成时', 'subjuntivo_perfecto'].includes(tenseToken)) {
    return { block: 'compound_subjunctive', tenseKey: 'preterite_perfect' }
  }
  if (['虚拟过去完成时', 'subjuntivo_pluscuamperfecto'].includes(tenseToken)) {
    return { block: 'compound_subjunctive', tenseKey: 'pluperfect' }
  }
  if (['虚拟将来完成时', 'subjuntivo_futuro_perfecto'].includes(tenseToken)) {
    return { block: 'compound_subjunctive', tenseKey: 'future_perfect' }
  }

  return null
}

function ensureVosFallback(payload) {
  ;['indicative', 'subjunctive', 'compound_indicative', 'compound_subjunctive'].forEach((blockName) => {
    Object.values(payload[blockName] || {}).forEach((tenseObj) => {
      if (!Array.isArray(tenseObj.second_singular_vos_form) || tenseObj.second_singular_vos_form.length) return
      tenseObj.second_singular_vos_form = Array.isArray(tenseObj.second_singular)
        ? [...tenseObj.second_singular]
        : []
    })
  })

  Object.values(payload.imperative || {}).forEach((tenseObj) => {
    if (!Array.isArray(tenseObj.second_singular_vos_form) || tenseObj.second_singular_vos_form.length) return
    tenseObj.second_singular_vos_form = Array.isArray(tenseObj.second_singular)
      ? [...tenseObj.second_singular]
      : []
  })
}

function assignConjugation(target, personKey, forms, isIrregular) {
  const merged = Array.from(new Set([...(target[personKey] || []), ...forms]))
  target[personKey] = merged
  if (isIrregular) {
    target.regular = false
  }
}

function exportVerbsAsJson() {
  const verbs = vocabularyDb.prepare(`
    SELECT id, infinitive, meaning, gerund, participle, participle_forms,
           is_reflexive, has_tr_use, has_intr_use, supports_do, supports_io, supports_do_io
    FROM verbs
    ORDER BY id ASC
  `).all()

  const conjugations = vocabularyDb.prepare(`
    SELECT verb_id, mood, tense, person, conjugated_form, is_irregular, id
    FROM conjugations
    ORDER BY verb_id ASC, id ASC
  `).all()

  const payloadByVerbId = new Map(
    verbs.map((verb) => [verb.id, createVerbExportRecord(verb)])
  )

  conjugations.forEach((row) => {
    const targetVerb = payloadByVerbId.get(row.verb_id)
    if (!targetVerb) return

    const slot = resolveBlockAndTense(row.mood, row.tense)
    if (!slot) return

    const personKey = resolvePersonKey(row.person, slot.block, slot.tenseKey)
    if (!personKey) return

    const forms = splitForms(row.conjugated_form)
    const targetTense = targetVerb[slot.block]?.[slot.tenseKey]
    if (!targetTense || !forms.length) return

    assignConjugation(targetTense, personKey, forms, toBoolean(row.is_irregular, false))
  })

  const result = verbs.map((verb) => {
    const payload = payloadByVerbId.get(verb.id)
    ensureVosFallback(payload)
    return payload
  })

  return result
}

module.exports = {
  exportVerbsAsJson
}
