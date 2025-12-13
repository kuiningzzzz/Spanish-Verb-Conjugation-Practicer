const express = require('express')
const router = express.Router()
const Verb = require('../models/Verb')
const Conjugation = require('../models/Conjugation')
const { authMiddleware } = require('../middleware/auth')

// 获取动词列表
router.get('/list', authMiddleware, (req, res) => {
  try {
    const { lessonNumber, textbookVolume, conjugationType } = req.query

    const filters = {}
    if (lessonNumber) filters.lessonNumber = parseInt(lessonNumber)
    if (textbookVolume) filters.textbookVolume = parseInt(textbookVolume)
    if (conjugationType) filters.conjugationType = parseInt(conjugationType)

    const verbs = Verb.getAll(filters)

    res.json({
      success: true,
      verbs
    })
  } catch (error) {
    console.error('获取动词列表错误:', error)
    res.status(500).json({ error: '获取动词列表失败' })
  }
})

// 搜索动词（支持精确搜索和模糊搜索）
// 注意：此路由必须放在 /:id 之前，否则 /search/xxx 会被当作 /:id 处理
router.get('/search/:keyword', authMiddleware, (req, res) => {
  try {
    const keyword = req.params.keyword.toLowerCase().trim()
    
    if (!keyword || keyword.length < 2) {
      return res.json({
        success: true,
        exactInfinitive: [],
        exactConjugation: [],
        fuzzyInfinitive: [],
        fuzzyConjugation: []
      })
    }

    const { vocabularyDb } = require('../database/db')
    
    // 1. 精确匹配原型（包含用户输入字段的单词）
    const exactInfinitiveQuery = `
      SELECT 
        v.id, 
        v.infinitive, 
        v.meaning, 
        v.conjugation_type, 
        v.is_irregular,
        v.is_reflexive
      FROM verbs v
      WHERE LOWER(v.infinitive) LIKE ?
      ORDER BY 
        CASE 
          WHEN LOWER(v.infinitive) = ? THEN 1
          WHEN LOWER(v.infinitive) LIKE ? THEN 2
          WHEN LOWER(v.infinitive) LIKE ? THEN 3
          ELSE 4
        END,
        LENGTH(v.infinitive),
        v.infinitive
    `
    
    const exactInfinitiveMatches = vocabularyDb.prepare(exactInfinitiveQuery).all(
      `%${keyword}%`,
      keyword,
      `${keyword}%`,
      `%${keyword}`
    )
    
    // 2. 精确匹配变位形式（排除已经在原型匹配中出现的单词，每个单词只显示一个变位）
    const exactInfinitiveVerbIds = exactInfinitiveMatches.map(v => v.id)
    const exactConjugationQuery = `
      SELECT DISTINCT 
        v.id, 
        v.infinitive, 
        v.meaning, 
        v.conjugation_type, 
        v.is_irregular,
        v.is_reflexive,
        (SELECT c2.conjugated_form 
         FROM conjugations c2 
         WHERE c2.verb_id = v.id 
           AND LOWER(c2.conjugated_form) LIKE ?
         LIMIT 1) as matched_form
      FROM verbs v
      INNER JOIN conjugations c ON v.id = c.verb_id
      WHERE LOWER(c.conjugated_form) LIKE ?
        ${exactInfinitiveVerbIds.length > 0 ? `AND v.id NOT IN (${exactInfinitiveVerbIds.join(',')})` : ''}
      ORDER BY v.infinitive
    `
    
    const exactConjugationMatches = vocabularyDb.prepare(exactConjugationQuery).all(
      `%${keyword}%`,
      `%${keyword}%`
    )

    // 3. 模糊匹配原型（排除已在精确匹配中出现的单词）
    const allExactVerbIds = [
      ...exactInfinitiveVerbIds,
      ...exactConjugationMatches.map(v => v.id)
    ]
    
    const fuzzyInfinitiveQuery = `
      SELECT 
        v.id, 
        v.infinitive, 
        v.meaning, 
        v.conjugation_type, 
        v.is_irregular
      FROM verbs v
      WHERE v.id NOT IN (${allExactVerbIds.length > 0 ? allExactVerbIds.join(',') : '0'})
    `
    
    const allVerbsForFuzzy = vocabularyDb.prepare(fuzzyInfinitiveQuery).all()
    
    // 计算模糊匹配分数（原型）
    const fuzzyInfinitiveMatches = []
    for (const verb of allVerbsForFuzzy) {
      const infinitive = verb.infinitive.toLowerCase()
      const matchScore = calculateMatchScore(infinitive, keyword)
      
      if (matchScore >= 0.6) {
        fuzzyInfinitiveMatches.push({
          ...verb,
          match_score: matchScore,
          match_type: 'infinitive'
        })
      }
    }
    
    // 按匹配分数排序
    fuzzyInfinitiveMatches.sort((a, b) => {
      if (b.match_score !== a.match_score) {
        return b.match_score - a.match_score
      }
      return a.infinitive.localeCompare(b.infinitive)
    })
    
    // 4. 模糊匹配变位（排除已在前面所有匹配中出现的单词，每个单词只显示一个变位）
    const fuzzyInfinitiveVerbIds = fuzzyInfinitiveMatches.map(v => v.id)
    const allMatchedVerbIds = [...allExactVerbIds, ...fuzzyInfinitiveVerbIds]
    
    const fuzzyConjugationQuery = `
      SELECT DISTINCT 
        v.id, 
        v.infinitive, 
        v.meaning, 
        v.conjugation_type, 
        v.is_irregular,
        v.is_reflexive,
        GROUP_CONCAT(c.conjugated_form, '|') as all_forms
      FROM verbs v
      LEFT JOIN conjugations c ON v.id = c.verb_id
      WHERE v.id NOT IN (${allMatchedVerbIds.length > 0 ? allMatchedVerbIds.join(',') : '0'})
      GROUP BY v.id
    `
    
    const allVerbsForFuzzyConj = vocabularyDb.prepare(fuzzyConjugationQuery).all()
    
    // 计算模糊匹配分数（变位）
    const fuzzyConjugationMatches = []
    for (const verb of allVerbsForFuzzyConj) {
      const allForms = verb.all_forms ? verb.all_forms.toLowerCase().split('|') : []
      
      let matchedForm = null
      let maxScore = 0
      
      // 检查所有变位形式，找到匹配度最高的
      for (const form of allForms) {
        if (!form) continue
        const formScore = calculateMatchScore(form, keyword)
        if (formScore > maxScore) {
          maxScore = formScore
          matchedForm = form
        }
      }
      
      if (maxScore >= 0.6) {
        fuzzyConjugationMatches.push({
          ...verb,
          matched_form: matchedForm,
          match_score: maxScore,
          match_type: 'conjugation'
        })
      }
    }
    
    // 按匹配分数排序
    fuzzyConjugationMatches.sort((a, b) => {
      if (b.match_score !== a.match_score) {
        return b.match_score - a.match_score
      }
      return a.infinitive.localeCompare(b.infinitive)
    })

    // 格式化结果
    const conjugationTypeMap = {
      1: '第一变位',
      2: '第二变位',
      3: '第三变位'
    }

    const formatVerb = (verb) => ({
      id: verb.id,
      infinitive: verb.infinitive,
      meaning: verb.meaning,
      conjugationType: conjugationTypeMap[verb.conjugation_type] || '未知',
      isIrregular: verb.is_irregular === 1,
      isReflexive: verb.is_reflexive === 1,
      matchedForm: verb.matched_form || null
    })

    res.json({
      success: true,
      exactInfinitive: exactInfinitiveMatches.map(formatVerb),
      exactConjugation: exactConjugationMatches.map(formatVerb),
      fuzzyInfinitive: fuzzyInfinitiveMatches.map(formatVerb),
      fuzzyConjugation: fuzzyConjugationMatches.map(formatVerb)
    })
  } catch (error) {
    console.error('搜索动词错误:', error)
    res.status(500).json({ error: '搜索失败' })
  }
})

// 计算匹配分数的辅助函数
function calculateMatchScore(text, keyword) {
  // 方法1：顺序匹配
  let keywordIndex = 0
  for (let i = 0; i < text.length && keywordIndex < keyword.length; i++) {
    if (text[i] === keyword[keywordIndex]) {
      keywordIndex++
    }
  }
  const sequentialScore = keywordIndex / keyword.length
  
  // 方法2：字符存在匹配
  const keywordChars = keyword.split('')
  const textChars = text.split('')
  let matchCount = 0
  keywordChars.forEach(char => {
    if (textChars.includes(char)) {
      matchCount++
    }
  })
  const charScore = matchCount / keyword.length
  
  // 返回较高的分数
  return Math.max(sequentialScore, charScore)
}

// 获取动词详情和完整变位
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const verbId = parseInt(req.params.id)
    
    const verb = Verb.findById(verbId)
    if (!verb) {
      return res.status(404).json({ error: '动词不存在' })
    }

    const conjugations = Conjugation.getByVerbId(verbId)

    // 格式化动词信息
    const conjugationTypeMap = {
      1: '第一变位',
      2: '第二变位',
      3: '第三变位'
    }

    const formattedVerb = {
      id: verb.id,
      infinitive: verb.infinitive,
      meaning: verb.meaning,
      conjugationType: conjugationTypeMap[verb.conjugation_type] || '未知',
      isIrregular: verb.is_irregular === 1,
      isReflexive: verb.is_reflexive === 1
    }

    res.json({
      success: true,
      verb: formattedVerb,
      conjugations
    })
  } catch (error) {
    console.error('获取动词详情错误:', error)
    res.status(500).json({ error: '获取动词详情失败' })
  }
})

module.exports = router
