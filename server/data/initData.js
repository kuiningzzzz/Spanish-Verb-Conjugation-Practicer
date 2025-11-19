const Verb = require('../models/Verb')
const Conjugation = require('../models/Conjugation')
const { vocabularyDb: db } = require('../database/db')

// 初始化示例数据
function initSampleData() {
  // 检查是否已有数据
  const stmt = db.prepare('SELECT COUNT(*) as count FROM verbs')
  const result = stmt.get()
  
  if (result.count > 0) {
    console.log('数据库已有数据，跳过初始化')
    return
  }

  console.log('开始初始化示例数据...')

  // 第一课的动词示例
  const lesson1Verbs = [
    { infinitive: 'hablar', meaning: '说话', conjugationType: 1, lessonNumber: 1 },
    { infinitive: 'estudiar', meaning: '学习', conjugationType: 1, lessonNumber: 1 },
    { infinitive: 'trabajar', meaning: '工作', conjugationType: 1, lessonNumber: 1 },
    { infinitive: 'llamar', meaning: '叫', conjugationType: 1, lessonNumber: 1 },
    { infinitive: 'estar', meaning: '在/是', conjugationType: 1, lessonNumber: 1, isIrregular: 1 },
    { infinitive: 'ser', meaning: '是', conjugationType: 2, lessonNumber: 1, isIrregular: 1 },
    { infinitive: 'tener', meaning: '有', conjugationType: 2, lessonNumber: 1, isIrregular: 1 },
    { infinitive: 'comer', meaning: '吃', conjugationType: 2, lessonNumber: 1 },
    { infinitive: 'beber', meaning: '喝', conjugationType: 2, lessonNumber: 1 },
    { infinitive: 'vivir', meaning: '住/生活', conjugationType: 3, lessonNumber: 1 },
    { infinitive: 'escribir', meaning: '写', conjugationType: 3, lessonNumber: 1 },
    { infinitive: 'abrir', meaning: '打开', conjugationType: 3, lessonNumber: 1 }
  ]

  // 第二课的动词示例
  const lesson2Verbs = [
    { infinitive: 'mirar', meaning: '看', conjugationType: 1, lessonNumber: 2 },
    { infinitive: 'escuchar', meaning: '听', conjugationType: 1, lessonNumber: 2 },
    { infinitive: 'comprar', meaning: '买', conjugationType: 1, lessonNumber: 2 },
    { infinitive: 'buscar', meaning: '找', conjugationType: 1, lessonNumber: 2 },
    { infinitive: 'leer', meaning: '读', conjugationType: 2, lessonNumber: 2 },
    { infinitive: 'aprender', meaning: '学会', conjugationType: 2, lessonNumber: 2 },
    { infinitive: 'recibir', meaning: '收到', conjugationType: 3, lessonNumber: 2 },
    { infinitive: 'subir', meaning: '上升', conjugationType: 3, lessonNumber: 2 }
  ]

  const allVerbs = [...lesson1Verbs, ...lesson2Verbs]

  // 插入动词
  for (const verb of allVerbs) {
    const verbId = Verb.create(verb)
    
    // 为每个动词创建变位
    const conjugations = generateConjugations(verb, verbId)
    Conjugation.createBatch(verbId, conjugations)
  }

  console.log(`示例数据初始化完成，共插入 ${allVerbs.length} 个动词`)
}

// 生成动词变位
function generateConjugations(verb, verbId) {
  const conjugations = []
  
  // 现在时陈述式
  const presentIndicative = generatePresentIndicative(verb)
  conjugations.push(...presentIndicative)

  // 过去时陈述式
  const preterite = generatePreterite(verb)
  conjugations.push(...preterite)

  // 将来时陈述式
  const future = generateFuture(verb)
  conjugations.push(...future)

  return conjugations
}

// 生成现在时陈述式变位
function generatePresentIndicative(verb) {
  const persons = ['yo', 'tú', 'él/ella/usted', 'nosotros', 'vosotros', 'ellos/ellas/ustedes']
  const stem = verb.infinitive.slice(0, -2) // 去掉-ar/-er/-ir
  
  let endings = []
  
  // 第一变位 -ar
  if (verb.conjugationType === 1) {
    endings = ['o', 'as', 'a', 'amos', 'áis', 'an']
  }
  // 第二变位 -er
  else if (verb.conjugationType === 2) {
    endings = ['o', 'es', 'e', 'emos', 'éis', 'en']
  }
  // 第三变位 -ir
  else if (verb.conjugationType === 3) {
    endings = ['o', 'es', 'e', 'imos', 'ís', 'en']
  }

  // 特殊处理不规则动词
  if (verb.infinitive === 'ser') {
    const forms = ['soy', 'eres', 'es', 'somos', 'sois', 'son']
    return persons.map((person, i) => ({
      tense: '现在时',
      mood: '陈述式',
      person,
      conjugatedForm: forms[i],
      isIrregular: 1
    }))
  }

  if (verb.infinitive === 'estar') {
    const forms = ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están']
    return persons.map((person, i) => ({
      tense: '现在时',
      mood: '陈述式',
      person,
      conjugatedForm: forms[i],
      isIrregular: 1
    }))
  }

  if (verb.infinitive === 'tener') {
    const forms = ['tengo', 'tienes', 'tiene', 'tenemos', 'tenéis', 'tienen']
    return persons.map((person, i) => ({
      tense: '现在时',
      mood: '陈述式',
      person,
      conjugatedForm: forms[i],
      isIrregular: 1
    }))
  }

  return persons.map((person, i) => ({
    tense: '现在时',
    mood: '陈述式',
    person,
    conjugatedForm: stem + endings[i],
    isIrregular: 0
  }))
}

// 生成简单过去时变位
function generatePreterite(verb) {
  const persons = ['yo', 'tú', 'él/ella/usted', 'nosotros', 'vosotros', 'ellos/ellas/ustedes']
  const stem = verb.infinitive.slice(0, -2)
  
  let endings = []
  
  if (verb.conjugationType === 1) {
    endings = ['é', 'aste', 'ó', 'amos', 'asteis', 'aron']
  } else if (verb.conjugationType === 2 || verb.conjugationType === 3) {
    endings = ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron']
  }

  return persons.map((person, i) => ({
    tense: '简单过去时',
    mood: '陈述式',
    person,
    conjugatedForm: stem + endings[i],
    isIrregular: 0
  }))
}

// 生成将来时变位
function generateFuture(verb) {
  const persons = ['yo', 'tú', 'él/ella/usted', 'nosotros', 'vosotros', 'ellos/ellas/ustedes']
  const endings = ['é', 'ás', 'á', 'emos', 'éis', 'án']

  return persons.map((person, i) => ({
    tense: '将来时',
    mood: '陈述式',
    person,
    conjugatedForm: verb.infinitive + endings[i],
    isIrregular: 0
  }))
}

module.exports = {
  initSampleData
}
