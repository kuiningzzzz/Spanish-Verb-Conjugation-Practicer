const { chat, cleanJsonText, getConfig, getStageSettings } = require('./llmClient')

function buildLatestValidatorPrompt({
  questionType,
  questionText,
  correctAnswer,
  exampleSentence,
  translation,
  hint,
  verb
}) {
  if (questionType !== 'sentence') {
    throw new Error('validator prompt only supports sentence for now')
  }

  const normalizedAnswer = String(correctAnswer || '')
  const hasMultipleForms = normalizedAnswer.includes(' | ')
  const answerNote = hasMultipleForms
    ? '\n\n注意：答案包含多个形式（用 | 分隔），这些形式属于同一目标变位，评估时应视为等价正确形式。'
    : ''

  return {
    system: '你是一位严谨的西班牙语教育质量审核专家，负责验证语法正确性、变位槽位唯一性与题目自然度。',
    user: `\
请作为西班牙语专家，严格验证以下例句填空题：

题目类型：例句填空
原形动词：${verb.infinitive} (${verb.meaning})
例句：${exampleSentence || questionText}
正确答案：${normalizedAnswer}${answerNote}
翻译：${translation || '无'}
提示：${hint || '无'}

【核心判定标准（重要）】
- 本题优先检查“变位槽位唯一性”，即 mood + tense + person-slot 是否唯一。
- 不要求指代对象唯一到具体身份（例如第三人称单数可对应 él/ella/usted，不算歧义）。
- 但若会改变槽位（如 tú/usted、vosotros/ustedes、yo/nosotros）则必须判为歧义。

【输出要求】
只输出一个 JSON 对象（禁止 markdown），字段必须包含：
{
  "isValid": true/false,
  "hasUniqueAnswer": true/false,
  "reason": "...",
  "failure_tags": ["..."],
  "alternatives": [
    { "form": "...", "whyPlausible": "...", "whyInvalidHere": "..." },
    { "form": "...", "whyPlausible": "...", "whyInvalidHere": "..." },
    { "form": "...", "whyPlausible": "...", "whyInvalidHere": "..." }
  ],
  "rewrite_advice": ["...", "..."]
}

【必须检查】
1) 语法正确性：词序、代词位置、搭配、配价、时态一致性、标点。错误则 isValid=false。
2) 槽位唯一性：是否只有目标 mood+tense+person-slot 可成立。若存在不改句子骨架即可成立的其他槽位，hasUniqueAnswer=false。
3) 时态/语气唯一性：若不改语境骨架即可用其他时态或语气，也判不唯一。
4) 同形词形判定：形态同形不自动判歧义，必须结合句法位置与话语功能判断；只有句法功能也可互换时才标记 "mood_ambiguous"。
5) 泄露检查：题干若出现答案明文或明显变体泄露，isValid=false 且包含 "answer_leak"。
6) 去套路检查：模板开头或过度依赖时间状语，标记 "template_opening" 或 "time_adverb_overused"。
7) 自然度：明显生硬或不地道，标记 "unnatural"。

【alternatives 规则】
- 至少 3 个替代形式。
- 必须是“最小替代”：同一动词、同一句法位置、同一语境骨架，仅替换空格中的动词形式。
- 仅列出“在不改句子骨架前提下”有可能成立的替代；任何需要改主语、补词、改从句结构、改时间线的替代都不要列入。
- 若某替代实际上可成立，whyInvalidHere 必须写 "it actually works"。

【failure_tags 枚举（可多选）】
- "too_short_info"
- "person_ambiguous"（用于槽位歧义，不用于 él/ella/usted 纯指代歧义）
- "tense_ambiguous"
- "mood_ambiguous"
- "time_adverb_overused"
- "template_opening"
- "answer_leak"
- "unnatural"

【person_ambiguous 触发规则（严格）】
- 若题干已有显式人称锚点（独立代词、呼语、代词系统线索如 os/nos/te/le、或明确主语名词短语），不得仅因表面同形而标记 person_ambiguous。
- 仅当“会改变 person-slot 的替代”在同一语境中也成立时，才标记 person_ambiguous。

【rewrite_advice 要求】
- 至少 2 条，且可执行。
- 至少 1 条用于补强槽位/时态/语气唯一性。
- 至少 1 条用于去套路和自然化。
`
  }
}

class QuestionValidatorService {
  static async validateQuestion(questionData) {
    const {
      questionType,
      questionText,
      correctAnswer,
      exampleSentence,
      translation,
      hint,
      verb
    } = questionData

    const settings = getStageSettings('VALIDATOR')
    const prompt = buildLatestValidatorPrompt({
      questionType,
      questionText,
      correctAnswer,
      exampleSentence: exampleSentence || questionText,
      translation,
      hint,
      verb
    })

    console.log(
      `[AI生成][validator] model=${getConfig().model} prompt=embedded_latest maxTokens=${settings.maxTokens} temperature=${settings.temperature}`
    )

    try {
      const response = await chat({
        system: prompt.system,
        user: prompt.user,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens
      })

      const parsed = JSON.parse(cleanJsonText(response))
      return {
        isValid: parsed.isValid === true,
        hasUniqueAnswer: parsed.hasUniqueAnswer === true,
        reason: parsed.reason || '',
        failure_tags: Array.isArray(parsed.failure_tags) ? parsed.failure_tags : [],
        alternatives: Array.isArray(parsed.alternatives) ? parsed.alternatives : [],
        rewrite_advice: Array.isArray(parsed.rewrite_advice) ? parsed.rewrite_advice : []
      }
    } catch (error) {
      console.error('[AI生成][validator] 调用失败:', error.response?.data || error.message)
      return {
        isValid: false,
        hasUniqueAnswer: false,
        reason: '验证服务暂时不可用',
        failure_tags: [],
        alternatives: [],
        rewrite_advice: []
      }
    }
  }

  static async quickValidate(questionData, retries = 2) {
    for (let i = 0; i < retries; i++) {
      try {
        const result = await this.validateQuestion(questionData)
        if (result.isValid && result.hasUniqueAnswer) {
          return {
            passed: true,
            result
          }
        }
        return {
          passed: false,
          reason: result.reason,
          result
        }
      } catch (error) {
        if (i === retries - 1) {
          return {
            passed: false,
            reason: '验证服务异常'
          }
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
      }
    }

    return {
      passed: false,
      reason: '验证服务异常'
    }
  }
}

module.exports = QuestionValidatorService
