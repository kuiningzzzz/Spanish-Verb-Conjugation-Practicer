const { vocabularyDb } = require('./database/db')

console.log('\n📊 检查反身动词数据...\n')

// 查询所有反身动词
const reflexiveVerbs = vocabularyDb.prepare(`
  SELECT id, infinitive, meaning, is_reflexive FROM verbs WHERE is_reflexive = 1
`).all()

console.log(`✅ 数据库中有 ${reflexiveVerbs.length} 个反身动词：\n`)
reflexiveVerbs.forEach(v => {
  console.log(`   ${v.id}. ${v.infinitive} (${v.meaning}) - is_reflexive: ${v.is_reflexive}`)
})

console.log('\n')
process.exit(0)
