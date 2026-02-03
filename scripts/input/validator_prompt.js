'use strict'

// Validator prompt templates.
// Add new entries to the array; index is the prompt version.
// Each entry should return { system, user } strings.

const validatorPrompts = [
  ({ questionType, questionText, correctAnswer, exampleSentence, translation, hint, verb }) => {
    if (questionType !== 'sentence') {
      throw new Error('validator prompt only supports sentence for now')
    }

    const hasMultipleForms = correctAnswer.includes(' | ')
    const answerNote = hasMultipleForms
      ? '\n\n重要说明：答案中包含多个形式（用 | 分隔），这些是同一个变位的不同表达方式（如虚拟式过去完成时的 hubiera/hubiese 两种形式）。这种情况下，这几个形式都应该被接受作为正确答案。但你仍需验证在给定语境下，是否只有这个特定的变位形式（时态、语气、人称）才是正确的，不能有其他变位形式也符合句意。'
      : ''

    return {
      system: '你是一位严谨的西班牙语教育质量审核专家，负责验证练习题的准确性和唯一性。你必须给出客观、专业的评估。',
      user: `\
请作为西班牙语专家，严格验证以下例句填空题的合理性：

题目类型：例句填空
原形动词：${verb.infinitive} (${verb.meaning})
例句：${exampleSentence}
正确答案：${correctAnswer}${answerNote}
翻译：${translation || '无'}
提示：${hint || '无'}

请验证：
1. 句子的语法是否正确
2. 在给定的语境下，答案是否具有变位形式唯一性（即只有这个特定的变位形式符合句意，不能有其他时态、语气、人称的变位也正确）
3. 如果答案包含多个形式（用 | 分隔），这是同一变位的不同表达，都应该被接受
4. 句子是否自然、地道
5. 翻译是否准确
6. 提示可以指出需要什么形式，但是不直接暴露答案是什么

请严格按照以下JSON格式返回（不要包含markdown标记）：
{
  "isValid": true/false,
  "hasUniqueAnswer": true/false,
  "reason": "如果invalid或没有唯一答案，说明原因；否则为空字符串"
}
`
    }
  }
]

module.exports = validatorPrompts
