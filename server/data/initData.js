const { vocabularyDb: db } = require('../database/db')
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
  const verbsJsonPath = path.join(__dirname, '../verbs.json')
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
  
  // 时态映射
  const tenseMapping = {
    'present': '现在时',
    'imperfect': '未完成过去时',
    'preterite': '简单过去时',
    'future': '将来时',
    'conditional': '条件式'
  }

  // 复合时态映射
  const compoundTenseMapping = {
    // 复合陈述式
    'preterite_perfect': '现在完成时',      // pretérito perfecto
    'pluperfect': '过去完成时',              // pluscuamperfecto
    'future_perfect': '将来完成时',          // futuro perfecto
    'conditional_perfect': '条件完成时',      // condicional perfecto
    'preterite_anterior': '先过去时'         // pretérito anterior
  }

  // 语气映射
  const moodMapping = {
    'indicative': '陈述式',
    'subjunctive': '虚拟式',
    'imperative': '命令式',
    'compound_indicative': '复合陈述式',
    'compound_subjunctive': '复合虚拟式'
  }

  // 人称映射
  const personMapping = {
    'first_singular': 'yo',
    'second_singular': 'tú',
    'third_singular': 'él/ella/usted',
    'first_plural': 'nosotros',
    'second_plural': 'vosotros',
    'third_plural': 'ellos/ellas/ustedes'
  }

  // 常用动词中文释义
  const verbMeanings = {
    // 基础高频动词
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
    
    // 反身动词
    'llamarse': '叫做', 'levantarse': '起床', 'sentarse': '坐下', 'lavarse': '洗', 'bañarse': '洗澡',
    'peinarse': '梳头', 'cepillarse': '刷', 'acostarse': '睡觉', 'despertarse': '醒来',
    'vestirse': '穿衣', 'despedirse': '告别', 'prepararse': '准备', 'preocuparse': '担心',
    'quedarse': '留下/待着', 'encontrarse': '遇到/相遇', 'acordarse': '记得', 'olvidarse': '忘记',
    'divertirse': '玩得开心', 'aburrirse': '感到无聊', 'cansarse': '累', 'alegrarse': '高兴',
    'enojarse': '生气', 'asustarse': '害怕', 'sorprenderse': '惊讶', 'enamorarse': '爱上',
    'casarse': '结婚', 'divorciarse': '离婚', 'graduarse': '毕业', 'mudarse': '搬家',
    'ducharse': '淋浴', 'afeitarse': '刮胡子', 'maquillarse': '化妆', 'peinarse': '梳头',
    'secarse': '擦干', 'lavarse': '洗', 'cepillarse': '刷', 'mirarse': '照镜子',
    'probarse': '试穿', 'quitarse': '脱下', 'ponerse': '穿上', 'cambiarse': '换衣服',
    'acercarse': '靠近', 'alejarse': '远离', 'caerse': '摔倒', 'levantarse': '站起来',
    'subirse': '上去', 'bajarse': '下来', 'apearse': '下车', 'montarse': '上车',
    'esconderse': '躲藏', 'perderse': '迷路', 'encontrarse': '遇见', 'reunirse': '聚会',
    'despedirse': '告别', 'saludarse': '打招呼', 'besarse': '亲吻', 'abrazarse': '拥抱',
    'pelearse': '打架', 'reconciliarse': '和解', 'enfadarse': '生气', 'calmarse': '冷静',
    'animarse': '鼓起勇气', 'atreverse': '敢于', 'decidirse': '决定', 'negarse': '拒绝',
    'comprometerse': '承诺', 'dedicarse': '致力于', 'ocuparse': '忙于', 'encargarse': '负责',
    'esforzarse': '努力', 'concentrarse': '集中', 'relajarse': '放松', 'descansarse': '休息',
    'asomarse': '探出', 'apoyarse': '靠着', 'arrodillarse': '跪下', 'agacharse': '蹲下',
    'estirarse': '伸展', 'doblarse': '弯腰', 'girarse': '转身', 'volverse': '转过来',
    'dirigirse': '前往', 'acostumbrarse': '习惯', 'adaptarse': '适应', 'conformarse': '满足于',
    'quejarse': '抱怨', 'lamentarse': '哀叹', 'arrepentirse': '后悔', 'disculparse': '道歉',
    'resistirse': '抵抗', 'rendirse': '投降', 'someterse': '服从', 'rebelarse': '反抗',
    'portarse': '表现', 'comportarse': '举止', 'conducirse': '行为', 'expresarse': '表达',
    'comunicarse': '交流', 'relacionarse': '交往', 'asociarse': '联合', 'separarse': '分开',
    'unirse': '加入', 'incorporarse': '并入', 'retirarse': '退出', 'marcharse': '离开',
    'quedarse': '留下', 'instalarse': '安顿', 'establecerse': '定居', 'radicarse': '扎根',
    'aventurarse': '冒险', 'arriesgarse': '冒险', 'exponerse': '暴露', 'protegerse': '保护自己',
    'defenderse': '自卫', 'cuidarse': '照顾自己', 'mantenerse': '保持', 'conservarse': '保存',
    'desarrollarse': '发展', 'crecer': '成长', 'mejorarse': '改善', 'empeorarse': '恶化',
    'transformarse': '转变', 'convertirse': '变成', 'volverse': '变得', 'hacerse': '成为',
    'caracterizarse': '以...为特征', 'distinguirse': '区别', 'destacarse': '突出', 'sobresalir': '出众',
    'limpiarse': '弄干净', 'ensuciarse': '弄脏', 'mancharse': '弄脏', 'mojarse': '弄湿',
    'secarse': '弄干', 'calentarse': '加热', 'enfriarse': '冷却', 'congelarse': '冻结',
    'derretirse': '融化', 'evaporarse': '蒸发', 'condensarse': '凝结', 'solidificarse': '凝固',
    'disolverse': '溶解', 'mezclarse': '混合', 'combinarse': '结合', 'unirse': '联合',
    'separarse': '分离', 'dividirse': '分割', 'partirse': '分开', 'romperse': '打破',
    'cortarse': '切断', 'rasgarse': '撕裂', 'desgarrarse': '撕破', 'agrietarse': '裂开',
    'ayudarse': '互相帮助', 'cooperar': '合作', 'colaborar': '协作', 'participar': '参与',
    
    // A开头
    'abrigarse': '穿暖和', 'acabar': '完成/结束', 'acompañar': '陪伴', 'adquirir': '获得',
    'agradecer': '感谢', 'alcanzar': '达到/够到', 'almorzar': '吃午饭', 'amenazar': '威胁',
    'anunciar': '宣布', 'apagar': '关闭/熄灭', 'apuntar': '指向/记下', 'arrojar': '投掷',
    'asustar': '惊吓', 'atravesar': '穿过', 'avanzar': '前进', 'añadir': '添加',
    
    // B开头
    'bajar': '下降/下载', 'barrer': '扫', 'besar': '吻', 'brindar': '祝酒/提供',
    
    // C开头
    'casar': '结婚', 'catar': '品尝', 'causar': '引起', 'celebrar': '庆祝',
    'cenar': '吃晚饭', 'charlar': '聊天', 'coger': '拿/抓', 'comenzar': '开始',
    'comprender': '理解', 'confundir': '混淆', 'considerar': '考虑', 'conversar': '交谈',
    'correr': '跑', 'cuidar': '照顾', 'cumplir': '完成/履行',
    
    // D开头
    'desayunar': '吃早饭', 'descansar': '休息', 'descuidar': '忽视', 'detenerse': '停止',
    'devolver': '归还', 'disponerse': '准备做', 'dotar': '赋予',
    
    // E开头
    'elegir': '选择', 'elogiar': '赞扬', 'encantar': '使着迷/喜欢', 'encender': '点燃/打开',
    'enfurecer': '激怒', 'entregar': '交付', 'envidiar': '嫉妒', 'estafar': '诈骗',
    'estorbar': '妨碍', 'evitar': '避免',
    
    // F开头
    'felicitar': '祝贺', 'fregar': '擦洗',
    
    // G开头
    'ganar': '赢得/挣', 'gritar': '喊叫', 'gustar': '喜欢',
    
    // I开头
    'incluir': '包括', 'indicar': '指示', 'informar': '通知', 'iniciar': '开始',
    'instalar': '安装', 'interesar': '使感兴趣', 'invitar': '邀请',
    
    // J开头
    'jugar': '玩/比赛',
    
    // L开头
    'lavar': '洗', 'limitarse': '限于',
    
    // M开头
    'mandar': '命令/派遣', 'mejorar': '改善', 'meter': '放入', 'molestar': '打扰',
    'mostrar': '展示',
    
    // N开头
    'necesitar': '需要',
    
    // O开头
    'observar': '观察', 'ofrecer': '提供', 'olvidar': '忘记', 'organizar': '组织',
    'oír': '听',
    
    // P开头
    'pagar': '付款', 'pertenecer': '属于', 'precipitarse': '急忙', 'prestar': '借出',
    'prolongarse': '延长', 'prometer': '承诺', 'pronunciar': '发音', 'proteger': '保护',
    
    // R开头
    'recoger': '收集/捡起', 'recomendar': '推荐', 'regar': '浇水', 'regresar': '返回',
    'respirar': '呼吸', 'resultar': '结果是', 'retirar': '撤回', 'romper': '打破',
    
    // S开头
    'sacar': '取出/拿出', 'saludar': '问候', 'salvar': '拯救', 'servir': '服务/上菜',
    'significar': '意味着', 'sobrepasar': '超过', 'soler': '常常', 'sonar': '响/听起来',
    'subir': '上升/上传', 'suponer': '假设',
    
    // T开头
    'teclear': '打字', 'telefonear': '打电话', 'temer': '害怕', 'tocar': '触摸/弹奏',
    'traer': '带来',
    
    // U开头
    'usar': '使用', 'utilizar': '利用',
    
    // V开头
    'variar': '变化', 'vestir': '穿', 'visitar': '访问'
  }

  const highFrequencyVerbs = [
    'ser', 'estar', 'tener', 'hacer', 'poder', 'decir', 'ir', 'ver', 'dar', 'saber',
    'querer', 'llegar', 'pasar', 'deber', 'poner', 'hablar', 'conocer', 'vivir', 'trabajar', 'estudiar'
  ]

  let verbCount = 0
  let conjugationCount = 0

  const insertVerb = db.prepare(`
    INSERT INTO verbs (infinitive, meaning, conjugation_type, is_irregular, is_reflexive, frequency_level)
    VALUES (?, ?, ?, ?, ?, ?)
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
      
      // 判断变位类型
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
      
      // 判断是否为反身动词
      const isReflexive = verbData.is_reflexive ? 1 : 0
      
      const frequency = highFrequencyVerbs.includes(infinitive) || highFrequencyVerbs.includes(baseInfinitive) ? 1 : 2

      // 插入动词
      const result = insertVerb.run(infinitive, meaning, conjugationType, isIrregular, isReflexive, frequency)
      const verbId = result.lastInsertRowid
      verbCount++

      // 插入变位 - 陈述式（indicative）
      if (verbData.indicative) {
        const indicative = verbData.indicative
        for (const tenseKey in indicative) {
          if (!tenseMapping[tenseKey]) continue
          
          const tenseData = indicative[tenseKey]
          if (!tenseData) continue

          const tenseName = tenseMapping[tenseKey]
          const isIrregularTense = tenseData.regular === false ? 1 : 0

          for (const personKey in personMapping) {
            const personName = personMapping[personKey]
            const forms = tenseData[personKey]
            
            if (forms && Array.isArray(forms) && forms[0]) {
              insertConjugation.run(verbId, tenseName, '陈述式', personName, forms[0], isIrregularTense)
              conjugationCount++
            }
          }
        }
      }

      // 插入变位 - 虚拟式（subjunctive）
      if (verbData.subjunctive) {
        const subjunctive = verbData.subjunctive
        for (const tenseKey in subjunctive) {
          if (!tenseMapping[tenseKey]) continue
          
          const tenseData = subjunctive[tenseKey]
          if (!tenseData) continue

          const tenseName = tenseMapping[tenseKey]
          const isIrregularTense = tenseData.regular === false ? 1 : 0

          for (const personKey in personMapping) {
            const personName = personMapping[personKey]
            const forms = tenseData[personKey]
            
            if (forms && Array.isArray(forms) && forms[0]) {
              insertConjugation.run(verbId, tenseName, '虚拟式', personName, forms[0], isIrregularTense)
              conjugationCount++
            }
          }
        }
      }

      // 插入变位 - 命令式（imperative）
      if (verbData.imperative) {
        const imperative = verbData.imperative
        // 肯定命令式
        if (imperative.affirmative) {
          const isIrregularTense = imperative.affirmative.regular === false ? 1 : 0
          for (const personKey in personMapping) {
            const personName = personMapping[personKey]
            const forms = imperative.affirmative[personKey]
            
            if (forms && Array.isArray(forms) && forms[0] && forms[0].length > 0) {
              insertConjugation.run(verbId, '肯定命令式', '命令式', personName, forms[0], isIrregularTense)
              conjugationCount++
            }
          }
        }
        // 否定命令式
        if (imperative.negative) {
          const isIrregularTense = imperative.negative.regular === false ? 1 : 0
          for (const personKey in personMapping) {
            const personName = personMapping[personKey]
            const forms = imperative.negative[personKey]
            
            if (forms && Array.isArray(forms) && forms[0] && forms[0].length > 0) {
              insertConjugation.run(verbId, '否定命令式', '命令式', personName, forms[0], isIrregularTense)
              conjugationCount++
            }
          }
        }
      }

      // 插入变位 - 复合陈述式（compound_indicative）
      if (verbData.compound_indicative) {
        const compoundIndicative = verbData.compound_indicative
        for (const tenseKey in compoundIndicative) {
          if (!compoundTenseMapping[tenseKey]) continue
          
          const tenseData = compoundIndicative[tenseKey]
          if (!tenseData) continue

          const tenseName = compoundTenseMapping[tenseKey]
          const isIrregularTense = tenseData.regular === false ? 1 : 0

          for (const personKey in personMapping) {
            const personName = personMapping[personKey]
            const forms = tenseData[personKey]
            
            if (forms && Array.isArray(forms) && forms[0]) {
              insertConjugation.run(verbId, tenseName, '复合陈述式', personName, forms[0], isIrregularTense)
              conjugationCount++
            }
          }
        }
      }

      // 插入变位 - 复合虚拟式（compound_subjunctive）
      if (verbData.compound_subjunctive) {
        const compoundSubjunctive = verbData.compound_subjunctive
        for (const tenseKey in compoundSubjunctive) {
          if (!compoundTenseMapping[tenseKey]) continue
          
          const tenseData = compoundSubjunctive[tenseKey]
          if (!tenseData) continue

          const tenseName = compoundTenseMapping[tenseKey]
          const isIrregularTense = tenseData.regular === false ? 1 : 0

          for (const personKey in personMapping) {
            const personName = personMapping[personKey]
            const forms = tenseData[personKey]
            
            if (forms && Array.isArray(forms) && forms[0]) {
              insertConjugation.run(verbId, tenseName, '复合虚拟式', personName, forms[0], isIrregularTense)
              conjugationCount++
            }
          }
        }
      }
    }
  })

  transaction()

  console.log(`\x1b[32m   ✓ 词库数据初始化完成\x1b[0m，共导入 \x1b[33m${verbCount}\x1b[0m 个动词，\x1b[33m${conjugationCount}\x1b[0m 个变位\n`)
}

module.exports = {
  initSampleData
}
