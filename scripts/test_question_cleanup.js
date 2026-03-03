const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const serverEnvPath = path.join(projectRoot, 'server', '.env')

if (fs.existsSync(serverEnvPath)) {
  require('dotenv').config({ path: serverEnvPath })
} else {
  require('dotenv').config()
}

function printUsage() {
  console.log(`
Usage:
  node scripts/test_question_cleanup.js [options]

Options:
  --days-old <n>            Override QUESTION_CLEANUP_MAX_AGE_DAYS for the test run
  --min-count <n>           Override QUESTION_CLEANUP_MIN_COUNT for the test run
  --force-all-candidates    Always run an extra rollback-only scenario with daysOld=0
  --no-forced               Skip the extra forced-candidate scenario
  --fail-on-baseline        Exit non-zero if current data already violates the minimum
  --json                    Print the full result as JSON
  --help                    Show this help
`)
}

function getFlagValue(name) {
  const args = process.argv.slice(2)
  const index = args.indexOf(name)
  if (index === -1) return null
  return index + 1 < args.length ? args[index + 1] : null
}

function parseNonNegativeInteger(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return Math.floor(parsed)
}

function mapToSortedEntries(obj) {
  return Object.entries(obj).sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'zh-Hans-CN'))
}

function loadServerModules() {
  try {
    const Question = require(path.join(projectRoot, 'server', 'models', 'Question'))
    const db = require(path.join(projectRoot, 'server', 'database', 'db'))
    const SchedulerService = require(path.join(projectRoot, 'server', 'services', 'scheduler'))
    return {
      Question,
      SchedulerService,
      ...db
    }
  } catch (error) {
    const message = String(error && error.message ? error.message : error)
    console.error('Failed to load server modules.')
    console.error(`Current Node.js: ${process.version}`)
    if (message.includes('NODE_MODULE_VERSION')) {
      console.error('`better-sqlite3` was built for a different Node.js version.')
      console.error('Use the same Node.js version that was used to install dependencies, then rerun the script.')
    } else {
      console.error(message)
    }
    process.exit(1)
  }
}

function createSnapshotReaders({ userDb, questionDb, vocabularyDb }) {
  function getLessonCounts() {
    const lessonIds = vocabularyDb.prepare('SELECT id FROM lessons ORDER BY id ASC').all().map((row) => row.id)
    const counts = Object.create(null)
    lessonIds.forEach((lessonId) => {
      counts[lessonId] = 0
    })

    const lessonVerbRows = vocabularyDb.prepare(`
      SELECT lesson_id, verb_id
      FROM lesson_verbs
    `).all()
    const lessonIdsByVerb = Object.create(null)
    lessonVerbRows.forEach((row) => {
      if (!lessonIdsByVerb[row.verb_id]) {
        lessonIdsByVerb[row.verb_id] = []
      }
      lessonIdsByVerb[row.verb_id].push(row.lesson_id)
    })

    const addCounts = (rows) => {
      rows.forEach((row) => {
        const linkedLessonIds = lessonIdsByVerb[row.verb_id] || []
        linkedLessonIds.forEach((lessonId) => {
          counts[lessonId] = (counts[lessonId] || 0) + 1
        })
      })
    }

    addCounts(questionDb.prepare('SELECT verb_id FROM public_traditional_conjugation').all())
    addCounts(questionDb.prepare('SELECT verb_id FROM public_conjugation_with_pronoun').all())

    return counts
  }

  function getTraditionalTenseCounts() {
    const counts = Object.create(null)
    questionDb.prepare(`
      SELECT tense, COUNT(*) AS count
      FROM public_traditional_conjugation
      GROUP BY tense
      ORDER BY tense ASC
    `).all().forEach((row) => {
      counts[row.tense] = row.count
    })
    return counts
  }

  function getPronounModeCounts() {
    const counts = Object.create(null)
    questionDb.prepare(`
      SELECT LOWER(TRIM(host_form)) AS host_form, COUNT(*) AS count
      FROM public_conjugation_with_pronoun
      GROUP BY LOWER(TRIM(host_form))
      ORDER BY LOWER(TRIM(host_form)) ASC
    `).all().forEach((row) => {
      const key = row.host_form || 'unknown'
      counts[key] = row.count
    })
    return counts
  }

  function snapshot() {
    return {
      lessons: getLessonCounts(),
      traditional: getTraditionalTenseCounts(),
      pronoun: getPronounModeCounts(),
      questionTotals: {
        traditional: questionDb.prepare('SELECT COUNT(*) AS count FROM public_traditional_conjugation').get().count,
        pronoun: questionDb.prepare('SELECT COUNT(*) AS count FROM public_conjugation_with_pronoun').get().count
      },
      recordTotals: {
        traditional: userDb.prepare(`
          SELECT COUNT(*) AS count
          FROM user_question_records
          WHERE question_type = 'public_traditional'
        `).get().count,
        pronoun: userDb.prepare(`
          SELECT COUNT(*) AS count
          FROM user_question_records
          WHERE question_type = 'public_pronoun'
        `).get().count
      }
    }
  }

  return { snapshot }
}

function findBelowMin(counts, minCount) {
  return mapToSortedEntries(counts)
    .filter(([, count]) => count < minCount)
    .map(([key, count]) => ({ key, count }))
}

function findRegressions(beforeCounts, afterCounts, minCount) {
  return mapToSortedEntries(beforeCounts)
    .filter(([key, before]) => before >= minCount && (afterCounts[key] || 0) < minCount)
    .map(([key, before]) => ({ key, before, after: afterCounts[key] || 0 }))
}

function runPlanScenario(name, options, modules, snapshot) {
  const { Question, userDb, questionDb } = modules
  const before = snapshot()
  let plan = null
  let deletedRecords = 0
  let deletedQuestions = 0
  let after = null

  userDb.exec('BEGIN')
  questionDb.exec('BEGIN')
  try {
    plan = Question.planOldPublicQuestionCleanup(options)
    deletedRecords = Question.deleteQuestionRecordsByIds(plan)
    deletedQuestions = Question.deletePublicQuestionsByIds(plan)
    after = snapshot()
  } finally {
    questionDb.exec('ROLLBACK')
    userDb.exec('ROLLBACK')
  }

  const regressions = {
    lessons: findRegressions(before.lessons, after.lessons, options.minCount),
    traditionalTenses: findRegressions(before.traditional, after.traditional, options.minCount),
    pronounModes: findRegressions(before.pronoun, after.pronoun, options.minCount)
  }
  const baselineBelowMin = {
    lessons: findBelowMin(before.lessons, options.minCount),
    traditionalTenses: findBelowMin(before.traditional, options.minCount),
    pronounModes: findBelowMin(before.pronoun, options.minCount)
  }

  return {
    type: 'plan',
    name,
    config: options,
    candidates: plan.candidates,
    plannedDeletes: {
      traditional: plan.traditionalIds.length,
      pronoun: plan.pronounIds.length,
      total: plan.traditionalIds.length + plan.pronounIds.length
    },
    deleted: {
      records: deletedRecords,
      questions: deletedQuestions
    },
    deltas: {
      questions: {
        traditional: before.questionTotals.traditional - after.questionTotals.traditional,
        pronoun: before.questionTotals.pronoun - after.questionTotals.pronoun
      },
      records: {
        traditional: before.recordTotals.traditional - after.recordTotals.traditional,
        pronoun: before.recordTotals.pronoun - after.recordTotals.pronoun
      }
    },
    baselineBelowMin,
    regressions,
    errors: [
      ...(deletedQuestions !== (plan.traditionalIds.length + plan.pronounIds.length)
        ? ['Deleted question count does not match the planned delete count.']
        : []),
      ...((before.questionTotals.traditional - after.questionTotals.traditional) !== plan.traditionalIds.length
        ? ['Traditional question delta does not match the planned delete count.']
        : []),
      ...((before.questionTotals.pronoun - after.questionTotals.pronoun) !== plan.pronounIds.length
        ? ['Pronoun question delta does not match the planned delete count.']
        : []),
      ...(regressions.lessons.length > 0 ? ['At least one lesson dropped below the minimum after deletion.'] : []),
      ...(regressions.traditionalTenses.length > 0 ? ['At least one traditional tense dropped below the minimum after deletion.'] : []),
      ...(regressions.pronounModes.length > 0 ? ['At least one pronoun host_form dropped below the minimum after deletion.'] : [])
    ]
  }
}

function runSchedulerScenario(modules, snapshot) {
  const { SchedulerService, userDb, questionDb } = modules
  const before = snapshot()
  const suppressedLogs = []
  const suppressedErrors = []
  const originalLog = console.log
  const originalError = console.error
  let result = null
  let after = null

  userDb.exec('BEGIN')
  questionDb.exec('BEGIN')
  try {
    console.log = (...args) => suppressedLogs.push(args.map((item) => String(item)).join(' '))
    console.error = (...args) => suppressedErrors.push(args.map((item) => String(item)).join(' '))
    result = SchedulerService.cleanOldQuestions()
    after = snapshot()
  } finally {
    console.log = originalLog
    console.error = originalError
    questionDb.exec('ROLLBACK')
    userDb.exec('ROLLBACK')
  }

  const deletedQuestions = (before.questionTotals.traditional - after.questionTotals.traditional)
    + (before.questionTotals.pronoun - after.questionTotals.pronoun)
  const deletedRecords = (before.recordTotals.traditional - after.recordTotals.traditional)
    + (before.recordTotals.pronoun - after.recordTotals.pronoun)

  return {
    type: 'scheduler',
    name: 'scheduler-entry',
    result,
    deltas: {
      questions: deletedQuestions,
      records: deletedRecords
    },
    errors: [
      ...(!result || result.success !== true ? ['SchedulerService.cleanOldQuestions() did not return success=true.'] : []),
      ...(result && result.questionsDeleted !== deletedQuestions
        ? ['SchedulerService.cleanOldQuestions() reported a different question delete count than the observed delta.']
        : []),
      ...(result && result.recordsDeleted !== deletedRecords
        ? ['SchedulerService.cleanOldQuestions() reported a different record delete count than the observed delta.']
        : []),
      ...(suppressedErrors.length > 0 ? ['SchedulerService.cleanOldQuestions() wrote to console.error during the test run.'] : [])
    ],
    suppressedLogs,
    suppressedErrors
  }
}

function hasErrors(scenario, failOnBaseline) {
  if (scenario.errors.length > 0) return true
  if (!failOnBaseline || scenario.type !== 'plan') return false
  return scenario.baselineBelowMin.lessons.length > 0
    || scenario.baselineBelowMin.traditionalTenses.length > 0
    || scenario.baselineBelowMin.pronounModes.length > 0
}

function printScenario(scenario) {
  if (scenario.type === 'scheduler') {
    console.log(`\n[${scenario.name}]`)
    console.log(`  success: ${scenario.result && scenario.result.success === true}`)
    console.log(`  deleted questions: ${scenario.deltas.questions}`)
    console.log(`  deleted records: ${scenario.deltas.records}`)
    if (scenario.errors.length > 0) {
      scenario.errors.forEach((message) => {
        console.log(`  error: ${message}`)
      })
    }
    return
  }

  console.log(`\n[${scenario.name}]`)
  console.log(`  config: daysOld=${scenario.config.daysOld}, minCount=${scenario.config.minCount}`)
  console.log(`  candidates: traditional=${scenario.candidates.traditional}, pronoun=${scenario.candidates.pronoun}`)
  console.log(`  planned deletes: traditional=${scenario.plannedDeletes.traditional}, pronoun=${scenario.plannedDeletes.pronoun}, total=${scenario.plannedDeletes.total}`)
  console.log(`  observed question delta: traditional=${scenario.deltas.questions.traditional}, pronoun=${scenario.deltas.questions.pronoun}`)
  console.log(`  observed record delta: traditional=${scenario.deltas.records.traditional}, pronoun=${scenario.deltas.records.pronoun}`)
  console.log(`  baseline below min: lessons=${scenario.baselineBelowMin.lessons.length}, traditionalTenses=${scenario.baselineBelowMin.traditionalTenses.length}, pronounModes=${scenario.baselineBelowMin.pronounModes.length}`)
  console.log(`  regressions: lessons=${scenario.regressions.lessons.length}, traditionalTenses=${scenario.regressions.traditionalTenses.length}, pronounModes=${scenario.regressions.pronounModes.length}`)
  if (scenario.errors.length > 0) {
    scenario.errors.forEach((message) => {
      console.log(`  error: ${message}`)
    })
  }
}

function main() {
  if (process.argv.includes('--help')) {
    printUsage()
    return
  }

  const modules = loadServerModules()
  const { SchedulerService } = modules
  const { snapshot } = createSnapshotReaders(modules)

  const envConfig = SchedulerService.getQuestionCleanupConfig()
  const overrideDaysOld = getFlagValue('--days-old')
  const overrideMinCount = getFlagValue('--min-count')
  const baseConfig = {
    daysOld: parseNonNegativeInteger(overrideDaysOld, envConfig.daysOld),
    minCount: parseNonNegativeInteger(overrideMinCount, envConfig.minCount)
  }

  const failOnBaseline = process.argv.includes('--fail-on-baseline')
  const runForcedExplicitly = process.argv.includes('--force-all-candidates')
  const skipForcedScenario = process.argv.includes('--no-forced')
  const printJson = process.argv.includes('--json')

  const scenarios = []
  const envScenario = runPlanScenario('env-config', baseConfig, modules, snapshot)
  scenarios.push(envScenario)

  const shouldRunForcedScenario = !skipForcedScenario
    && (runForcedExplicitly || envScenario.plannedDeletes.total === 0)

  if (shouldRunForcedScenario) {
    scenarios.push(runPlanScenario('forced-candidates', {
      daysOld: 0,
      minCount: baseConfig.minCount
    }, modules, snapshot))
  }

  scenarios.push(runSchedulerScenario(modules, snapshot))

  const failed = scenarios.some((scenario) => hasErrors(scenario, failOnBaseline))

  if (printJson) {
    console.log(JSON.stringify({
      envConfig,
      baseConfig,
      scenarios,
      failed
    }, null, 2))
  } else {
    console.log('Question cleanup rollback-only test run')
    console.log(`Configured minimums: daysOld=${baseConfig.daysOld}, minCount=${baseConfig.minCount}`)
    console.log('All scenarios run inside transactions and are rolled back.')
    scenarios.forEach(printScenario)
    if (failed) {
      console.log('\nResult: FAILED')
    } else {
      console.log('\nResult: PASSED')
    }
  }

  process.exit(failed ? 1 : 0)
}

main()
