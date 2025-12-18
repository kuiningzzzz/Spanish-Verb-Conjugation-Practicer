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
      // 检查是否有多个变位形式
      const hasMultipleForms = correctAnswer.includes(' | ')
      const answerNote = hasMultipleForms 
        ? `\n\n重要说明：答案中包含多个形式（用 | 分隔），这些是同一个变位的不同表达方式（如虚拟式过去完成时的 hubiera/hubiese 两种形式）。这种情况下，这几个形式都应该被接受作为正确答案。但你仍需验证在给定语境下，是否只有这个特定的变位形式（时态、语气、人称）才是正确的，不能有其他变位形式也符合句意。`
        : ''
      
      // 例句填空题验证
      prompt = `
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
