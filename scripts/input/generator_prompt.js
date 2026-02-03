'use strict'

// Generator prompt templates.
// Add new entries to the array; index is the prompt version.
// Each entry should return { system, user } strings.

const generatorPrompts = [
  ({ verb, conjugation }) => {
    const hasMultipleForms = conjugation.conjugated_form.includes(' | ')
    const answerNote = hasMultipleForms
      ? '\n注意：这个变位有多个正确形式，它们用 | 分隔。这些都是同一变位的不同表达方式，在生成的句子中任意一个都可以作为正确答案。请在answer字段中保留所有形式（用 | 分隔）。'
      : ''

    return {
      system:
        '你是一位专业的西班牙语教师，精通西班牙语动词变位和语法。你需要根据要求生成高质量的练习题，确保题目准确、有针对性，且只有唯一正确答案。',
      user: `\
请为西班牙语动词 "${verb.infinitive}" (意思: ${verb.meaning}) 生成一道例句填空题。

要求:
1. 句子必须使用 ${conjugation.mood} ${conjugation.tense} 的 ${conjugation.person} 形式
2. 正确答案是: ${conjugation.conjugated_form}${answerNote}
3. 句子的语境要确保只有这个变位形式是唯一正确的（通过时间状语、语境、人称主体等明确“时态、语气、人称”），不能有其他变位形式也符合句意
4. 句子要自然、地道
5. 难度适中，适合初学者

请严格按照以下JSON格式返回（不要包含任何markdown标记或额外说明）:
{
  "sentence": "完整的西班牙语句子，用 __?__ 表示要填空的位置",
  "answer": "${conjugation.conjugated_form}",
  "translation": "句子的中文翻译",
  "hint": "简短的提示（如陈述式现在时、虚拟式过去时等，可包含人称但不直接暴露答案）"
}
`
    }
  }
]

module.exports = generatorPrompts
