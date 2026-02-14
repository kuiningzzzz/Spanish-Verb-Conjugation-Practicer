const { chat, cleanJsonText, getConfig, getStageSettings } = require('./llmClient')

function buildPrompt({ verb, target, question }) {
  return {
    system:
      '你是西班牙语题目质检专家，负责检查带代词变位填空题的语法正确性、字段一致性和唯一解。',
    user: `\
请严格验证以下题目，只输出 JSON。

【目标参数】
- infinitive: ${verb.infinitive}
- meaning: ${verb.meaning}
- host_form: ${target.host_form}
- host_form_zh: ${target.host_form_zh}
- mood: ${target.mood}
- tense: ${target.tense}
- person: ${target.person}
- host_base_form: ${target.base_form}

【待验证题目】
${JSON.stringify(question || {}, null, 2)}

【检查项（必须全部检查）】
1) host_form/host_form_zh/mood/tense/person 与目标参数一致。
2) host_form 只允许 finite/imperative/infinitive/gerund/prnl。
3) pronoun_pattern 规则：
   - prnl 时必须为空字符串
   - 非 prnl 时必须是 DO/IO/DO_IO 之一
4) io_pronoun/do_pronoun 规则：
   - prnl: 两者都为空
   - DO: do_pronoun 非空, io_pronoun 为空
   - IO: io_pronoun 非空, do_pronoun 为空
   - DO_IO: 两者都非空
5) answer 必须是动词+代词组合（不是裸动词/裸代词）。
6) 代词位置、拼写、重音符号正确。
7) sentence 仅一个 "__?__"，且信息充分，答案唯一。
8) 不得答案泄露，句子自然，translation 基本准确。

【failure_tags 可选枚举】
- "field_mismatch"
- "host_form_invalid"
- "pronoun_pattern_invalid"
- "pronoun_fields_invalid"
- "answer_not_combo"
- "pronoun_position_error"
- "accent_error"
- "too_short_info"
- "not_unique"
- "answer_leak"
- "unnatural"
- "translation_issue"

返回格式：
{
  "isValid": true/false,
  "hasUniqueAnswer": true/false,
  "reason": "字符串",
  "failure_tags": ["tag1", "tag2"],
  "rewrite_advice": ["建议1", "建议2"]
}
`
  }
}

class ConjugationWithPronounValidatorService {
  static async validateQuestion({ verb, target, question }) {
    const settings = getStageSettings('VALIDATOR')
    const prompt = buildPrompt({ verb, target, question })

    console.log(
      `[AI生成][pronoun-validator] model=${getConfig().model} maxTokens=${settings.maxTokens} temperature=${settings.temperature}`
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
        reason: typeof parsed.reason === 'string' ? parsed.reason : '',
        failure_tags: Array.isArray(parsed.failure_tags) ? parsed.failure_tags : [],
        rewrite_advice: Array.isArray(parsed.rewrite_advice) ? parsed.rewrite_advice : []
      }
    } catch (error) {
      console.error('[AI生成][pronoun-validator] 调用失败:', error.response?.data || error.message)
      return {
        isValid: false,
        hasUniqueAnswer: false,
        reason: '验证服务暂时不可用',
        failure_tags: [],
        rewrite_advice: []
      }
    }
  }
}

module.exports = ConjugationWithPronounValidatorService
