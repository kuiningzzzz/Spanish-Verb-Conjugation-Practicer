const PRONOUN_SETTINGS_KEY = 'pronounSettings'
const PRACTICE_GENERATION_SETTINGS_KEY = 'practiceGenerationSettings'
const PRACTICE_TENSE_SELECTION_SETTINGS_KEY = 'practiceTenseSelectionSettings'

const defaultPronounSettings = {
  includeVosotros: true,
  includeVos: false
}

const defaultPracticeGenerationSettings = {
  reduceRareTenseFrequency: true
}

const allPracticeTenseKeys = [
  'presente',
  'perfecto',
  'imperfecto',
  'preterito',
  'futuro',
  'pluscuamperfecto',
  'futuro_perfecto',
  'preterito_anterior',
  'subjuntivo_presente',
  'subjuntivo_imperfecto',
  'subjuntivo_perfecto',
  'subjuntivo_pluscuamperfecto',
  'subjuntivo_futuro',
  'subjuntivo_futuro_perfecto',
  'condicional',
  'condicional_perfecto',
  'imperativo_afirmativo',
  'imperativo_negativo'
]

const secondClassTenseKeys = [
  'pluscuamperfecto',
  'futuro_perfecto',
  'condicional_perfecto',
  'subjuntivo_imperfecto',
  'subjuntivo_perfecto'
]

const thirdClassTenseKeys = [
  'preterito_anterior',
  'subjuntivo_futuro',
  'subjuntivo_pluscuamperfecto',
  'subjuntivo_futuro_perfecto'
]

const defaultPracticeSelectedTenses = allPracticeTenseKeys.filter(
  key => !thirdClassTenseKeys.includes(key)
)

const defaultPracticeTenseSelectionSettings = {
  selectedTenses: defaultPracticeSelectedTenses
}

export function getPronounSettings() {
  try {
    const cached = uni.getStorageSync(PRONOUN_SETTINGS_KEY)
    if (cached) {
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached
      return {
        includeVosotros: parsed.includeVosotros !== undefined ? parsed.includeVosotros : defaultPronounSettings.includeVosotros,
        includeVos: parsed.includeVos !== undefined ? parsed.includeVos : defaultPronounSettings.includeVos
      }
    }
  } catch (error) {
    console.warn('读取人称设置失败，使用默认值', error)
  }
  return { ...defaultPronounSettings }
}

export function setPronounSettings(settings = {}) {
  const merged = {
    ...defaultPronounSettings,
    ...settings
  }
  try {
    uni.setStorageSync(PRONOUN_SETTINGS_KEY, JSON.stringify(merged))
  } catch (error) {
    console.error('保存人称设置失败', error)
  }
  return merged
}

export function getDefaultPronounSettings() {
  return { ...defaultPronounSettings }
}

export function getPracticeGenerationSettings() {
  try {
    const cached = uni.getStorageSync(PRACTICE_GENERATION_SETTINGS_KEY)
    if (cached) {
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached
      return {
        reduceRareTenseFrequency: parsed.reduceRareTenseFrequency !== undefined
          ? parsed.reduceRareTenseFrequency
          : defaultPracticeGenerationSettings.reduceRareTenseFrequency
      }
    }
  } catch (error) {
    console.warn('读取练习生成设置失败，使用默认值', error)
  }
  return { ...defaultPracticeGenerationSettings }
}

export function setPracticeGenerationSettings(settings = {}) {
  const merged = {
    ...defaultPracticeGenerationSettings,
    ...settings
  }
  try {
    uni.setStorageSync(PRACTICE_GENERATION_SETTINGS_KEY, JSON.stringify(merged))
  } catch (error) {
    console.error('保存练习生成设置失败', error)
  }
  return merged
}

export function getDefaultPracticeGenerationSettings() {
  return { ...defaultPracticeGenerationSettings }
}

export function getDefaultPracticeSelectedTenses() {
  return [...defaultPracticeSelectedTenses]
}

export function getPracticeTenseSelectionSettings() {
  try {
    const cached = uni.getStorageSync(PRACTICE_TENSE_SELECTION_SETTINGS_KEY)
    if (cached) {
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached
      const selected = Array.isArray(parsed.selectedTenses) ? parsed.selectedTenses : defaultPracticeSelectedTenses
      const normalized = selected.filter(key => allPracticeTenseKeys.includes(key))
      return {
        selectedTenses: normalized.length > 0 ? normalized : [...defaultPracticeSelectedTenses]
      }
    }
  } catch (error) {
    console.warn('读取默认练习时态设置失败，使用默认值', error)
  }
  return { ...defaultPracticeTenseSelectionSettings, selectedTenses: [...defaultPracticeSelectedTenses] }
}

export function setPracticeTenseSelectionSettings(settings = {}) {
  const selected = Array.isArray(settings.selectedTenses) ? settings.selectedTenses : defaultPracticeSelectedTenses
  const normalized = Array.from(new Set(selected.filter(key => allPracticeTenseKeys.includes(key))))
  const merged = {
    selectedTenses: normalized.length > 0 ? normalized : [...defaultPracticeSelectedTenses]
  }
  try {
    uni.setStorageSync(PRACTICE_TENSE_SELECTION_SETTINGS_KEY, JSON.stringify(merged))
  } catch (error) {
    console.error('保存默认练习时态设置失败', error)
  }
  return merged
}
