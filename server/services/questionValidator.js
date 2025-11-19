const axios = require('axios')
require('dotenv').config()

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY
const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions'

/**
 * 题目验证服务
 * 使用第二个AI实例验证题目的合理性和唯一性
 */
class QuestionValidatorService {
  /**
   * 调用 AI API 进行题目验证
   */
  static async validateQuestion(questionData) {
    const { questionType, questionText, correctAnswer, exampleSentence, translation, hint, verb } = questionData

    let prompt = ''

    if (questionType === 'sentence') {
      // 例句填空题验证
      prompt = `
请作为西班牙语专家，严格验证以下例句填空题的合理性：

题目类型：例句填空
原形动词：${verb.infinitive} (${verb.meaning})
例句：${exampleSentence}
正确答案：${correctAnswer}
翻译：${translation || '无'}
提示：${hint || '无'}

请验证：
1. 句子的语法是否正确
2. 在给定的语境下，答案是否唯一（是否只有这个变位形式才符合句意）
3. 句子是否自然、地道
4. 翻译是否准确
5. 提示是否有助于学生作答且不直接暴露答案

请严格按照以下JSON格式返回（不要包含markdown标记）：
{
  "isValid": true/false,
  "hasUniqueAnswer": true/false,
  "reason": "如果invalid或没有唯一答案，说明原因；否则为空字符串"
}
`
    } else if (questionType === 'fill') {
      // 填空题验证
      prompt = `
请作为西班牙语专家，严格验证以下填空题的合理性：

题目类型：填空题
原形动词：${verb.infinitive} (${verb.meaning})
题目：${questionText}
正确答案：${correctAnswer}
例句：${exampleSentence || '无'}
提示：${hint || '无'}

请验证：
1. 题目描述是否清晰准确
2. 在给定的语境下，答案是否唯一
3. 例句（如果有）是否恰当
4. 提示是否有助于学生作答且不直接暴露答案

请严格按照以下JSON格式返回（不要包含markdown标记）：
{
  "isValid": true/false,
  "hasUniqueAnswer": true/false,
  "reason": "如果invalid或没有唯一答案，说明原因；否则为空字符串"
}
`
    } else {
      throw new Error('不支持的题目类型')
    }

    try {
      const response = await axios.post(
        DEEPSEEK_API_URL,
        {
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: '你是一位严谨的西班牙语教育质量审核专家，负责验证练习题的准确性和唯一性。你必须给出客观、专业的评估。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 300,
          temperature: 0.3  // 降低温度以获得更一致的验证结果
        },
        {
          headers: {
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 20000
        }
      )

      let result = response.data.choices[0].message.content.trim()
      
      // 清理可能的 markdown 标记
      if (result.startsWith('```json')) {
        result = result.replace(/```json\n?/g, '').replace(/```\n?/g, '')
      } else if (result.startsWith('```')) {
        result = result.replace(/```\n?/g, '')
      }

      const validation = JSON.parse(result)

      return {
        isValid: validation.isValid === true,
        hasUniqueAnswer: validation.hasUniqueAnswer === true,
        reason: validation.reason || ''
      }
    } catch (error) {
      console.error('题目验证失败:', error.response?.data || error.message)
      
      // 验证失败时返回保守结果
      return {
        isValid: false,
        hasUniqueAnswer: false,
        reason: '验证服务暂时不可用'
      }
    }
  }

  /**
   * 快速验证（带缓存和重试机制）
   */
  static async quickValidate(questionData, retries = 2) {
    for (let i = 0; i < retries; i++) {
      try {
        const result = await this.validateQuestion(questionData)
        
        // 只有验证成功且有唯一答案的题目才通过
        if (result.isValid && result.hasUniqueAnswer) {
          return {
            passed: true
          }
        } else {
          return {
            passed: false,
            reason: result.reason
          }
        }
      } catch (error) {
        if (i === retries - 1) {
          // 最后一次重试失败，返回失败
          return {
            passed: false,
            reason: '验证服务异常'
          }
        }
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
      }
    }
  }
}

module.exports = QuestionValidatorService
