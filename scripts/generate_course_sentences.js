#!/usr/bin/env node
'use strict'

const path = require('path')
const fs = require('fs')

const dotenvPath = path.join(__dirname, '../server/.env')
if (fs.existsSync(dotenvPath)) {
  require('dotenv').config({ path: dotenvPath })
}

const { questionDb } = require('../server/database/db')
const Textbook = require('../server/models/Textbook')
const Lesson = require('../server/models/Lesson')
const ExerciseGeneratorService = require('../server/services/exerciseGenerator')

const DEFAULT_COURSE_COUNT = 20
const DEFAULT_MIN_PER_VERB = 2
const DEFAULT_MAX_ATTEMPTS_PER_ADD = 3

function parseJsonArray(value) {
  if (!value) return []
  if (Array.isArray(value)) return value
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    return []
  }
}

function parseArgs(argv) {
  const options = {
    count: DEFAULT_COURSE_COUNT,
    minPerVerb: DEFAULT_MIN_PER_VERB,
    maxAttempts: DEFAULT_MAX_ATTEMPTS_PER_ADD,
    lessonId: null,
    textbookId: null,
    help: false
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '--count':
      case '-c':
        options.count = Number.parseInt(argv[++i], 10)
        break
      case '--min-per-verb':
      case '-m':
        options.minPerVerb = Number.parseInt(argv[++i], 10)
        break
      case '--max-attempts':
        options.maxAttempts = Number.parseInt(argv[++i], 10)
        break
      case '--lesson-id':
      case '--lesson':
        options.lessonId = Number.parseInt(argv[++i], 10)
        break
      case '--textbook-id':
      case '--textbook':
        options.textbookId = Number.parseInt(argv[++i], 10)
        break
      case '--help':
      case '-h':
        options.help = true
        break
      default:
        break
    }
  }

  return options
}

function validateOptions(options) {
  const ensurePositiveInt = (value, name) => {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`${name} must be a positive integer`)
    }
  }

  ensurePositiveInt(options.count, 'count')
  ensurePositiveInt(options.minPerVerb, 'min-per-verb')
  ensurePositiveInt(options.maxAttempts, 'max-attempts')

  if (options.lessonId && !Number.isInteger(options.lessonId)) {
    throw new Error('lesson-id must be an integer')
  }

  if (options.textbookId && !Number.isInteger(options.textbookId)) {
    throw new Error('textbook-id must be an integer')
  }
}

function printUsage() {
  console.log('Usage: node scripts/generate_course_sentences.js [options]')
  console.log('')
  console.log('Options:')
  console.log('  -c, --count <n>           Total sentence target per lesson (default 20)')
  console.log('  -m, --min-per-verb <n>    Minimum sentences per verb (default 2)')
  console.log('  --max-attempts <n>        Max attempts per sentence add (default 3)')
  console.log('  --lesson-id <id>          Limit to a single lesson')
  console.log('  --textbook-id <id>        Limit to a textbook')
  console.log('  -h, --help                Show this help')
}

function getLessons(options) {
  if (options.lessonId) {
    const lesson = Lesson.getById(options.lessonId)
    if (!lesson) return []
    const textbook = Textbook.getById(lesson.textbook_id)
    return [{ ...lesson, _textbookName: textbook ? textbook.name : null }]
  }

  if (options.textbookId) {
    const textbook = Textbook.getById(options.textbookId)
    if (!textbook) return []
    const lessons = Lesson.getByTextbookId(options.textbookId)
    return lessons.map(lesson => ({ ...lesson, _textbookName: textbook.name }))
  }

  const textbooks = Textbook.getAll()
  const lessons = []
  textbooks.forEach(textbook => {
    const bookLessons = Lesson.getByTextbookId(textbook.id)
    bookLessons.forEach(lesson => {
      lessons.push({ ...lesson, _textbookName: textbook.name })
    })
  })
  return lessons
}

function createTensePicker(allTenses) {
  const tenses = Array.isArray(allTenses) ? allTenses.filter(Boolean) : []
  if (tenses.length === 0) {
    return () => null
  }

  let queue = []
  let index = 0

  const reshuffle = () => {
    queue = [...tenses]
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[queue[i], queue[j]] = [queue[j], queue[i]]
    }
    index = 0
  }

  reshuffle()

  return () => {
    if (index >= queue.length) {
      reshuffle()
    }
    return queue[index++]
  }
}

function createMoodPicker(allMoods) {
  const moods = Array.isArray(allMoods) ? allMoods.filter(Boolean) : []
  if (moods.length === 0) {
    return () => null
  }

  let queue = []
  let index = 0

  const reshuffle = () => {
    queue = [...moods]
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[queue[i], queue[j]] = [queue[j], queue[i]]
    }
    index = 0
  }

  reshuffle()

  return () => {
    if (index >= queue.length) {
      reshuffle()
    }
    return queue[index++]
  }
}

function getMergedLessonConfig(lesson) {
  const allLessons = Lesson.getByTextbookId(lesson.textbook_id)
  const currentNumber = lesson.lesson_number || 0
  const lessonsToMerge = allLessons.filter(l => (l.lesson_number || 0) <= currentNumber)

  const moodsSet = new Set()
  const tensesSet = new Set()

  lessonsToMerge.forEach(l => {
    parseJsonArray(l.moods).forEach(m => moodsSet.add(m))
    parseJsonArray(l.tenses).forEach(t => tensesSet.add(t))
  })

  return {
    moods: Array.from(moodsSet),
    tenses: Array.from(tensesSet)
  }
}

async function addSentenceForVerb(verb, baseAiOptions, countStmt, maxAttempts, pickTense, pickMood) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const before = countStmt.get(verb.id).count
    const preferredTense = pickTense ? pickTense() : null
    const preferredMood = pickMood ? pickMood() : null
    const aiOptions = {
      ...baseAiOptions,
      tenses: preferredTense ? [preferredTense] : baseAiOptions.tenses,
      moods: preferredMood ? [preferredMood] : baseAiOptions.moods
    }
    const exercise = await ExerciseGeneratorService.generateWithAIForVerb(verb, aiOptions)
    if (!exercise) {
      continue
    }
    const after = countStmt.get(verb.id).count
    if (after > before) {
      return { added: true, before, after }
    }
  }
  return { added: false }
}

async function processLesson(lesson, options, countStmt) {
  const verbs = Lesson.getVocabulary(lesson.id)
  if (!verbs || verbs.length === 0) {
    console.log(`[Lesson ${lesson.lesson_number || lesson.id}] No verbs found, skipping.`)
    return
  }

  const mergedConfig = getMergedLessonConfig(lesson)
  const moods = mergedConfig.moods
  const tenses = mergedConfig.tenses
  const pickTense = createTensePicker(tenses)
  const pickMood = createMoodPicker(moods)

  const targetMinTotal = verbs.length * options.minPerVerb
  const targetTotal = Math.max(options.count, targetMinTotal, verbs.length)

  const verbStats = verbs.map(verb => ({
    verb,
    count: countStmt.get(verb.id).count
  }))

  const existingTotal = verbStats.reduce((sum, item) => sum + item.count, 0)
  const textbookLabel = lesson._textbookName ? ` (${lesson._textbookName})` : ''
  const lessonLabel = `[Lesson ${lesson.lesson_number || lesson.id}]${textbookLabel} ${lesson.title}`

  console.log(`${lessonLabel}`)
  console.log(`  verbs: ${verbs.length}, existing: ${existingTotal}, target: ${targetTotal}`)
  if (targetTotal > options.count) {
    console.log(`  target bumped to satisfy min-per-verb (${options.minPerVerb})`)
  }

  let currentTotal = existingTotal
  let addedTotal = 0

  const aiOptions = {
    exerciseType: 'sentence',
    tenses,
    moods
  }

  // Step 1: ensure minimum per verb
  for (const stat of verbStats) {
    const needed = Math.max(0, options.minPerVerb - stat.count)
    for (let i = 0; i < needed; i++) {
      const result = await addSentenceForVerb(stat.verb, aiOptions, countStmt, options.maxAttempts, pickTense, pickMood)
      if (result.added) {
        stat.count = result.after
        currentTotal += 1
        addedTotal += 1
        console.log(`  +1 ${stat.verb.infinitive} (min) -> ${currentTotal}/${targetTotal}`)
      } else {
        console.log(`  ! failed to add sentence for ${stat.verb.infinitive} (min)`)
      }
    }
  }

  // Step 2: fill remaining to target total
  let remaining = targetTotal - currentTotal
  let round = 0
  while (remaining > 0) {
    round += 1
    let addedThisRound = 0

    const sortedStats = [...verbStats].sort((a, b) => a.count - b.count)
    for (const stat of sortedStats) {
      if (remaining <= 0) break
      const result = await addSentenceForVerb(stat.verb, aiOptions, countStmt, options.maxAttempts, pickTense, pickMood)
      if (result.added) {
        stat.count = result.after
        currentTotal += 1
        addedTotal += 1
        remaining -= 1
        addedThisRound += 1
        console.log(`  +1 ${stat.verb.infinitive} (fill) -> ${currentTotal}/${targetTotal}`)
      }
    }

    if (addedThisRound === 0) {
      console.log('  ! no progress in this round, stopping early')
      break
    }
  }

  if (currentTotal < targetTotal) {
    console.log(`  ! finished with ${currentTotal}/${targetTotal} sentences`)
  } else {
    console.log(`  done, added ${addedTotal} sentences`)
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printUsage()
    return
  }

  try {
    validateOptions(options)
  } catch (error) {
    console.error(`Invalid options: ${error.message}`)
    printUsage()
    process.exit(1)
  }

  const lessons = getLessons(options)
  if (!lessons.length) {
    console.log('No lessons found for the given filters.')
    return
  }

  const countStmt = questionDb.prepare(`
    SELECT COUNT(*) as count
    FROM public_questions
    WHERE verb_id = ? AND question_type = 'sentence'
  `)

  console.log(`Starting generation: lessons=${lessons.length}, target=${options.count}, min-per-verb=${options.minPerVerb}`)

  for (const lesson of lessons) {
    await processLesson(lesson, options, countStmt)
  }

  console.log('All lessons processed.')
}

main().catch(error => {
  console.error('Script failed:', error)
  process.exit(1)
})
