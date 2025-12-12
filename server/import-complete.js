const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')

console.log('\n🔄 完整导入西班牙语动词词库...\n')

// 删除旧数据库
const dbPath = path.join(__dirname, 'vocabulary.db')
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath)
  console.log('✓ 已删除旧数据库')
}

// 创建新数据库
const db = new Database(dbPath)

// 创建表结构（与原始 db.js 完全兼容）
db.exec(`
  CREATE TABLE IF NOT EXISTS verbs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    infinitive TEXT NOT NULL,
    meaning TEXT NOT NULL,
    conjugation_type INTEGER NOT NULL,
    is_irregular INTEGER DEFAULT 0,
    is_reflexive INTEGER DEFAULT 0,
    gerund TEXT,
    participle TEXT,
    lesson_number INTEGER,
    textbook_volume INTEGER DEFAULT 1,
    frequency_level INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS conjugations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    verb_id INTEGER NOT NULL,
    tense TEXT NOT NULL,
    mood TEXT NOT NULL,
    person TEXT NOT NULL,
    conjugated_form TEXT NOT NULL,
    is_irregular INTEGER DEFAULT 0,
    FOREIGN KEY (verb_id) REFERENCES verbs(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_conjugations_verb_id ON conjugations(verb_id);
  CREATE INDEX IF NOT EXISTS idx_conjugations_tense ON conjugations(tense, mood);
  CREATE INDEX IF NOT EXISTS idx_verbs_lesson ON verbs(lesson_number, textbook_volume);
`)

console.log('✓ 已创建数据库表结构')

// 读取 verbs.json
const verbsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'verbs.json'), 'utf8'))

// ========== 映射配置 ==========

// 简单陈述式时态
const indicativeTenseMapping = {
  'present': '现在时',
  'imperfect': '未完成过去时',
  'preterite': '简单过去时',
  'future': '将来时',
  'conditional': '条件式'
}

// 复合陈述式时态
const compoundIndicativeTenseMapping = {
  'preterite_perfect': '现在完成时',      // he hablado
  'pluperfect': '过去完成时',             // había hablado
  'future_perfect': '将来完成时',         // habré hablado
  'conditional_perfect': '条件完成时',    // habría hablado
  'preterite_anterior': '先过去时'        // hube hablado
}

// 虚拟式时态
const subjunctiveTenseMapping = {
  'present': '虚拟现在时',
  'imperfect': '虚拟过去时',
  'future': '虚拟将来时'
}

// 复合虚拟式时态
const compoundSubjunctiveTenseMapping = {
  'preterite_perfect': '虚拟现在完成时',   // haya hablado
  'pluperfect': '虚拟过去完成时',          // hubiera/hubiese hablado
  'future_perfect': '虚拟将来完成时'       // hubiere hablado
}

// 七个人称（含vos）
const personMapping = {
  'first_singular': 'yo',
  'second_singular': 'tú',
  'second_singular_vos_form': 'vos',
  'third_singular': 'él/ella/usted',
  'first_plural': 'nosotros',
  'second_plural': 'vosotros',
  'third_plural': 'ellos/ellas/ustedes'
}

const verbMeanings = {
  'ser': '是', 'estar': '在/是', 'tener': '有', 'hacer': '做', 'poder': '能够',
  'decir': '说', 'ir': '去', 'ver': '看', 'dar': '给', 'saber': '知道',
  'querer': '想要', 'llegar': '到达', 'pasar': '经过/发生', 'deber': '应该', 'poner': '放',
  'parecer': '似乎', 'quedar': '留下', 'creer': '相信', 'hablar': '说话', 'llevar': '带',
  'dejar': '让/留下', 'seguir': '跟随/继续', 'encontrar': '找到', 'llamar': '叫', 'venir': '来',
  'pensar': '想/认为', 'salir': '出去', 'volver': '回来', 'tomar': '拿/喝', 'conocer': '认识',
  'vivir': '住/生活', 'sentir': '感觉', 'tratar': '尝试/对待', 'mirar': '看', 'contar': '数/讲述',
  'empezar': '开始', 'esperar': '等待/希望', 'buscar': '找', 'entrar': '进入', 'trabajar': '工作',
  'escribir': '写', 'perder': '失去', 'entender': '理解', 'pedir': '要求', 'recibir': '收到',
  'recordar': '记得', 'terminar': '结束', 'estudiar': '学习', 'comer': '吃', 'beber': '喝',
  'leer': '读', 'aprender': '学会', 'comprar': '买', 'abrir': '打开', 'cerrar': '关闭',
  'escuchar': '听', 'preguntar': '问', 'responder': '回答', 'enseñar': '教', 'presentar': '介绍',
  'llamarse': '叫做', 'levantarse': '起床', 'sentarse': '坐下', 'lavarse': '洗', 'bañarse': '洗澡',
  'peinarse': '梳头', 'cepillarse': '刷', 'acostarse': '睡觉', 'despertarse': '醒来'
}

const highFrequencyVerbs = [
  'ser', 'estar', 'tener', 'hacer', 'poder', 'decir', 'ir', 'ver', 'dar', 'saber',
  'querer', 'llegar', 'pasar', 'deber', 'poner', 'hablar', 'conocer', 'vivir', 'trabajar', 'estudiar'
]

let stats = {
  verbCount: 0,
  totalConjugations: 0,
  indicative: 0,
  subjunctive: 0,
  imperative: 0,
  compoundIndicative: 0,
  compoundSubjunctive: 0
}

const insertVerb = db.prepare(`
  INSERT INTO verbs (infinitive, meaning, conjugation_type, is_irregular, is_reflexive, gerund, participle, frequency_level, textbook_volume)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
`)

const insertConjugation = db.prepare(`
  INSERT INTO conjugations (verb_id, tense, mood, person, conjugated_form, is_irregular)
  VALUES (?, ?, ?, ?, ?, ?)
`)

const transaction = db.transaction(() => {
  for (const verbData of verbsData) {
    const infinitive = verbData.infinitive
    const baseInfinitive = infinitive.replace(/se$/, '')
    const meaning = verbMeanings[infinitive] || verbMeanings[baseInfinitive] || infinitive
    
    // 判断变位类型：-ar=1, -er=2, -ir=3
    let conjugationType = 1
    if (baseInfinitive.endsWith('er')) conjugationType = 2
    else if (baseInfinitive.endsWith('ir')) conjugationType = 3
    
    // 判断是否不规则
    let isIrregular = 0
    if (verbData.indicative) {
      for (const tense in verbData.indicative) {
        if (verbData.indicative[tense]?.regular === false) {
          isIrregular = 1
          break
        }
      }
    }
    
    // 是否自反动词
    const isReflexive = verbData.is_reflexive ? 1 : 0
    
    // 副动词（gerund）
    const gerund = verbData.gerund || null
    
    // 过去分词（participle）- 可能有多个形式，取第一个
    const participle = Array.isArray(verbData.participle) && verbData.participle.length > 0 
      ? verbData.participle[0] 
      : (verbData.participle || null)
    
    const frequency = highFrequencyVerbs.includes(infinitive) || highFrequencyVerbs.includes(baseInfinitive) ? 1 : 2

    // 插入动词
    const result = insertVerb.run(
      infinitive, 
      meaning, 
      conjugationType, 
      isIrregular, 
      isReflexive, 
      gerund, 
      participle, 
      frequency
    )
    const verbId = result.lastInsertRowid
    stats.verbCount++

    // ========== 1. 简单陈述式（indicative） ==========
    if (verbData.indicative) {
      for (const tenseKey in verbData.indicative) {
        if (!indicativeTenseMapping[tenseKey]) continue
        const tenseData = verbData.indicative[tenseKey]
        if (!tenseData) continue

        const tenseName = indicativeTenseMapping[tenseKey]
        const isIrregularTense = tenseData.regular === false ? 1 : 0

        for (const personKey in personMapping) {
          const personName = personMapping[personKey]
          const forms = tenseData[personKey]
          
          if (forms && Array.isArray(forms)) {
            // 将多个变位形式合并为一条记录，用 | 分隔
            const validForms = forms.filter(form => form && form.length > 0)
            if (validForms.length > 0) {
              const mergedForm = validForms.join(' | ')
              insertConjugation.run(verbId, tenseName, '陈述式', personName, mergedForm, isIrregularTense)
              stats.totalConjugations++
              stats.indicative++
            }
          }
        }
      }
    }

    // ========== 2. 虚拟式（subjunctive） ==========
    if (verbData.subjunctive) {
      for (const tenseKey in verbData.subjunctive) {
        if (!subjunctiveTenseMapping[tenseKey]) continue
        const tenseData = verbData.subjunctive[tenseKey]
        if (!tenseData) continue

        const tenseName = subjunctiveTenseMapping[tenseKey]
        const isIrregularTense = tenseData.regular === false ? 1 : 0

        for (const personKey in personMapping) {
          const personName = personMapping[personKey]
          const forms = tenseData[personKey]
          
          if (forms && Array.isArray(forms)) {
            // 将多个变位形式合并为一条记录，用 | 分隔
            const validForms = forms.filter(form => form && form.length > 0)
            if (validForms.length > 0) {
              const mergedForm = validForms.join(' | ')
              insertConjugation.run(verbId, tenseName, '虚拟式', personName, mergedForm, isIrregularTense)
              stats.totalConjugations++
              stats.subjunctive++
            }
          }
        }
      }
    }

    // ========== 3. 命令式（imperative） ==========
    if (verbData.imperative) {
      // 3.1 肯定命令式
      if (verbData.imperative.affirmative) {
        const isIrregularTense = verbData.imperative.affirmative.regular === false ? 1 : 0
        for (const personKey in personMapping) {
          const personName = personMapping[personKey]
          const forms = verbData.imperative.affirmative[personKey]
          
          if (forms && Array.isArray(forms)) {
            const validForms = forms.filter(form => form && form.length > 0)
            if (validForms.length > 0) {
              const mergedForm = validForms.join(' | ')
              insertConjugation.run(verbId, '肯定命令式', '命令式', personName, mergedForm, isIrregularTense)
              stats.totalConjugations++
              stats.imperative++
            }
          }
        }
      }
      
      // 3.2 否定命令式
      if (verbData.imperative.negative) {
        const isIrregularTense = verbData.imperative.negative.regular === false ? 1 : 0
        for (const personKey in personMapping) {
          const personName = personMapping[personKey]
          const forms = verbData.imperative.negative[personKey]
          
          if (forms && Array.isArray(forms)) {
            const validForms = forms.filter(form => form && form.length > 0)
            if (validForms.length > 0) {
              const mergedForm = validForms.join(' | ')
              insertConjugation.run(verbId, '否定命令式', '命令式', personName, mergedForm, isIrregularTense)
              stats.totalConjugations++
              stats.imperative++
            }
          }
        }
      }
    }

    // ========== 4. 复合陈述式（compound_indicative） ==========
    if (verbData.compound_indicative) {
      for (const tenseKey in verbData.compound_indicative) {
        if (!compoundIndicativeTenseMapping[tenseKey]) continue
        const tenseData = verbData.compound_indicative[tenseKey]
        if (!tenseData) continue

        const tenseName = compoundIndicativeTenseMapping[tenseKey]
        const isIrregularTense = tenseData.regular === false ? 1 : 0

        for (const personKey in personMapping) {
          const personName = personMapping[personKey]
          const forms = tenseData[personKey]
          
          if (forms && Array.isArray(forms)) {
            const validForms = forms.filter(form => form && form.length > 0)
            if (validForms.length > 0) {
              const mergedForm = validForms.join(' | ')
              insertConjugation.run(verbId, tenseName, '复合陈述式', personName, mergedForm, isIrregularTense)
              stats.totalConjugations++
              stats.compoundIndicative++
            }
          }
        }
      }
    }

    // ========== 5. 复合虚拟式（compound_subjunctive） ==========
    if (verbData.compound_subjunctive) {
      for (const tenseKey in verbData.compound_subjunctive) {
        if (!compoundSubjunctiveTenseMapping[tenseKey]) continue
        const tenseData = verbData.compound_subjunctive[tenseKey]
        if (!tenseData) continue

        const tenseName = compoundSubjunctiveTenseMapping[tenseKey]
        const isIrregularTense = tenseData.regular === false ? 1 : 0

        for (const personKey in personMapping) {
          const personName = personMapping[personKey]
          const forms = tenseData[personKey]
          
          if (forms && Array.isArray(forms)) {
            const validForms = forms.filter(form => form && form.length > 0)
            if (validForms.length > 0) {
              const mergedForm = validForms.join(' | ')
              insertConjugation.run(verbId, tenseName, '复合虚拟式', personName, mergedForm, isIrregularTense)
              stats.totalConjugations++
              stats.compoundSubjunctive++
            }
          }
        }
      }
    }
  }
})

console.log('⏳ 正在导入数据（预计需要 5-10 秒）...')
const startTime = Date.now()
transaction()
const endTime = Date.now()
db.close()

console.log('\n\x1b[32m✓ 导入完成！\x1b[0m')
console.log(`\n⏱️  耗时: \x1b[33m${((endTime - startTime) / 1000).toFixed(2)}\x1b[0m 秒`)
console.log(`\n📊 统计信息：`)
console.log(`  动词总数: \x1b[33m${stats.verbCount}\x1b[0m 个`)
console.log(`  变位总数: \x1b[33m${stats.totalConjugations}\x1b[0m 个`)
console.log(`\n  📋 简单形式：`)
console.log(`    - 陈述式: \x1b[36m${stats.indicative}\x1b[0m 个 (现在/过去/未完成过去/将来/条件)`)
console.log(`    - 虚拟式: \x1b[36m${stats.subjunctive}\x1b[0m 个 (现在/过去/将来)`)
console.log(`    - 命令式: \x1b[36m${stats.imperative}\x1b[0m 个 (肯定/否定)`)
console.log(`\n  📋 复合形式：`)
console.log(`    - 复合陈述式: \x1b[36m${stats.compoundIndicative}\x1b[0m 个 (现在完成/过去完成/将来完成/条件完成/先过去)`)
console.log(`    - 复合虚拟式: \x1b[36m${stats.compoundSubjunctive}\x1b[0m 个 (现在完成/过去完成/将来完成)`)
console.log()
