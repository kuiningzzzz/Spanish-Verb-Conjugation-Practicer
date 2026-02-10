const { vocabularyDb: db } = require('./db')
const fs = require('fs')
const path = require('path')

// 初始化示例数据
function initSampleData() {
  // 检查是否已有数据
  const stmt = db.prepare('SELECT COUNT(*) as count FROM verbs')
  const result = stmt.get()
  
  if (result.count > 0) {
    console.log('   ℹ️  词库已有数据，跳过初始化\n')
    return
  }

  console.log('\n📚 开始初始化词库数据...')
  
  // 从 verbs.json 导入完整词库
  const verbsJsonPath = path.join(__dirname, '../src/verbs.json')
  if (!fs.existsSync(verbsJsonPath)) {
    console.error('\x1b[31m   ✗ 找不到 verbs.json 文件\x1b[0m')
    return
  }

  try {
    importFromVerbsJson(verbsJsonPath)
  } catch (error) {
    console.error('\x1b[31m   ✗ verbs.json 导入失败:\x1b[0m', error.message)
  }
}

// 从 verbs.json 导入完整词库
function importFromVerbsJson(filePath) {
  console.log('   📥 从 verbs.json 导入词库...')
  
  const verbsData = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  
  // 简单陈述式时态映射
  const indicativeTenseMapping = {
    'present': '现在时',
    'imperfect': '未完成过去时',
    'preterite': '简单过去时',
    'future': '将来时',
    'conditional': '条件式'
  }

  // 复合陈述式时态映射
  const compoundIndicativeTenseMapping = {
    'preterite_perfect': '现在完成时',      // he hablado
    'pluperfect': '过去完成时',             // había hablado
    'future_perfect': '将来完成时',         // habré hablado
    'conditional_perfect': '条件完成时',    // habría hablado
    'preterite_anterior': '前过去时'        // hube hablado
  }

  // 虚拟式时态映射
  const subjunctiveTenseMapping = {
    'present': '虚拟现在时',
    'imperfect': '虚拟过去时',
    'future': '虚拟将来未完成时'
  }

  // 复合虚拟式时态映射
  const compoundSubjunctiveTenseMapping = {
    'preterite_perfect': '虚拟现在完成时',   // haya hablado
    'pluperfect': '虚拟过去完成时',          // hubiera/hubiese hablado
    'future_perfect': '虚拟将来完成时'       // hubiere hablado
  }

  // 七个人称映射（含vos）
  const personMapping = {
    'first_singular': 'yo',
    'second_singular': 'tú',
    'second_singular_vos_form': 'vos',
    'third_singular': 'él/ella/usted',
    'first_plural': 'nosotros',
    'second_plural': 'vosotros',
    'third_plural': 'ellos/ellas/ustedes'
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
    compoundSubjunctive: 0,
    multipleParticiples: 0,
    multipleConjugations: 0
  }

  const insertVerb = db.prepare(`
    INSERT INTO verbs (infinitive, meaning, conjugation_type, is_irregular, is_reflexive, gerund, participle, participle_forms, frequency_level, textbook_volume)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `)

  const insertConjugation = db.prepare(`
    INSERT INTO conjugations (verb_id, tense, mood, person, conjugated_form, is_irregular)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const transaction = db.transaction(() => {
    for (const verbData of verbsData) {
      const infinitive = verbData.infinitive
      
      // 直接从 verbs.json 的 translation 属性读取中文释义
      // 将每个释义中的英文逗号替换为中文逗号，然后用中文分号"；"连接多个释义
      let meaning = infinitive  // 默认值为动词原形
      if (verbData.translation && Array.isArray(verbData.translation) && verbData.translation.length > 0) {
        // 将每个元素中的英文逗号替换为中文逗号
        const translationsWithChineseComma = verbData.translation.map(item => item.replace(/,/g, '，'))
        meaning = translationsWithChineseComma.join('；')
      }
      
      // 去除反身动词的 se 后缀，用于判断变位类型
      const baseInfinitive = infinitive.replace(/se$/, '')
      
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
      
      // 过去分词（participle）- 保存所有形式
      let participle = null
      let participleForms = null
      
      if (verbData.participle) {
        if (Array.isArray(verbData.participle)) {
          const validParticiples = verbData.participle.filter(p => p && p.length > 0)
          if (validParticiples.length > 0) {
            participle = validParticiples[0]  // 主要形式
            participleForms = validParticiples.join(' | ')  // 所有形式
            if (validParticiples.length > 1) {
              stats.multipleParticiples++
            }
          }
        } else {
          participle = verbData.participle
          participleForms = verbData.participle
        }
      }
      
      const frequency = highFrequencyVerbs.includes(infinitive) ? 1 : 2

      // 插入动词
      const result = insertVerb.run(
        infinitive, 
        meaning, 
        conjugationType, 
        isIrregular, 
        isReflexive, 
        gerund, 
        participle,
        participleForms,
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
                if (validForms.length > 1) {
                  stats.multipleConjugations++
                }
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
                if (validForms.length > 1) {
                  stats.multipleConjugations++
                }
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
                if (validForms.length > 1) {
                  stats.multipleConjugations++
                }
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
                if (validForms.length > 1) {
                  stats.multipleConjugations++
                }
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
                if (validForms.length > 1) {
                  stats.multipleConjugations++
                }
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
                if (validForms.length > 1) {
                  stats.multipleConjugations++
                }
              }
            }
          }
        }
      }
    }
  })

  transaction()

  console.log(`\x1b[32m   ✓ 词库数据初始化完成\x1b[0m`)
  console.log(`   📊 统计信息：`)
  console.log(`      • 动词总数: \x1b[33m${stats.verbCount}\x1b[0m 个`)
  console.log(`      • 变位总数: \x1b[33m${stats.totalConjugations}\x1b[0m 个`)
  console.log(`      • 简单陈述式: \x1b[36m${stats.indicative}\x1b[0m 个`)
  console.log(`      • 虚拟式: \x1b[36m${stats.subjunctive}\x1b[0m 个`)
  console.log(`      • 命令式: \x1b[36m${stats.imperative}\x1b[0m 个`)
  console.log(`      • 复合陈述式: \x1b[36m${stats.compoundIndicative}\x1b[0m 个`)
  console.log(`      • 复合虚拟式: \x1b[36m${stats.compoundSubjunctive}\x1b[0m 个`)
  console.log(`      • 多个过去分词形式: \x1b[35m${stats.multipleParticiples}\x1b[0m 个`)
  console.log(`      • 多个变位形式: \x1b[35m${stats.multipleConjugations}\x1b[0m 个\n`)
}

module.exports = {
  initSampleData
}
