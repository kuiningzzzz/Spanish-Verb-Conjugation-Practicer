const { chat, cleanJsonText, getConfig, getStageSettings } = require('./llmClient')

function buildPrompt({ verb, target, question }) {
  return {
    prompt: {
      system:
        '你是一位西班牙语命题审核专家。你的第一优先级是“唯一解验证”：必须证明该题只能解出一个答案。',
      user: `\
请严格验证以下 conjugation_with_pronoun 题目（唯一解优先版）。

【目标约束】
- infinitive: ${verb.infinitive}
- meaning: ${verb.meaning}
- supports_do: ${String(verb.supports_do)}
- supports_io: ${String(verb.supports_io)}
- supports_do_io: ${String(verb.supports_do_io)}
- host_form(必须): ${target.host_form}
- host_form_zh(必须): ${target.host_form_zh}
- pronoun_pattern(必须): ${target.pronoun_pattern || ''}
- mood(必须): ${target.mood}
- tense(必须): ${target.tense}
- person(必须): ${target.person}
- host_base_form(不含宾语代词): ${target.base_form}

【待验证题目 JSON】
${JSON.stringify(question || {}, null, 2)}

【验证流程（必须按顺序执行）】
1) 字段一致性检查：host_form/mood/tense/person/pronoun_pattern 是否与目标一致。
2) 代词字段规则检查：
   - prnl：io_pronoun 与 do_pronoun 必须都为空
   - DO：do_pronoun 非空，io_pronoun 为空
   - IO：io_pronoun 非空，do_pronoun 为空
   - DO_IO：两者都非空
3) supports 标签一致性：
   - 目标 DO -> supports_do 必须 true
   - 目标 IO -> supports_io 必须 true
   - 目标 DO_IO -> supports_do_io 必须 true
4) 答案结构检查：answer 必须是“动词+代词组合”，不是裸动词/裸代词。
5) 语法检查：代词位置、拼写、重音必须正确。
6) 题干结构检查：sentence 仅含一个 "__?__"，语言自然。
7) 唯一解求解（最重要）：
   - 你要“自己像学生一样”根据 sentence + infinitive + host_form_zh + pronoun_pattern 推导答案；
   - 枚举你能成立的候选答案；
   - 只有候选数=1 且与 answer 一致，才可判定 hasUniqueAnswer=true；
   - 若候选数=0 或 >1，必须判定 hasUniqueAnswer=false，并给出详细原因与具体改写建议；
   - 唯一解判断只在“给定 pronoun_pattern 绝对正确”条件下进行，不要因为其他 pattern 也可能成立而判错。
8) se 规则检查（必须执行）：
   - DO_IO 且第三人称组合时，必须是 se lo/la/los/las；若出现 le/les lo/la/los/las 判错
   - 若目标形式需要反身/代词成分，不得遗漏 se（或对应的 me/te/nos/os/se）

【关键示例（必须遵守）】
- 若目标是 pronoun_pattern=IO，且句子为：
  "yo debía __?__ al nuevo empleado sobre los resultados de su evaluación"
  则你应只在 IO 条件下评估唯一解。此时 "avisarle" 可成立；
  即便 "avisárselo" 在 DO_IO 条件下也可能成立，也不能据此判 not_unique。

【判定要求】
- 若唯一解不成立，isValid 必须为 false。
- 不检查 hint 字段。
- 不需要输出错误原因、failure_tags、rewrite_advice。

请只输出一个 JSON 对象（禁止 markdown），格式必须是：
{
  "isValid": true/false,
  "hasUniqueAnswer": true/false
}
`
    },
    promptIndex: 1
  }
}

class ConjugationWithPronounValidatorService {
  static async validateQuestion({ verb, target, question }) {
    const settings = getStageSettings('VALIDATOR')
    const { prompt, promptIndex } = buildPrompt({ verb, target, question })

    console.log(
      `[AI生成][pronoun-validator] promptIndex=${promptIndex} model=${getConfig().model} maxTokens=${settings.maxTokens} temperature=${settings.temperature}`
    )

    try {
      const response = await chat({
        system: prompt.system,
        user: prompt.user,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens
      })

      const parsed = JSON.parse(cleanJsonText(response))
      const toBoolean = (value) => {
        if (value === true || value === false) return value
        const normalized = String(value || '').trim().toLowerCase()
        if (normalized === 'true') return true
        if (normalized === 'false') return false
        return false
      }
      const toStringArray = (value) => {
        if (Array.isArray(value)) {
          return value.map(item => String(item || '').trim()).filter(Boolean)
        }
        if (typeof value === 'string' && value.trim()) {
          return [value.trim()]
        }
        return []
      }

      return {
        isValid: toBoolean(parsed.isValid ?? parsed.is_valid),
        hasUniqueAnswer: toBoolean(parsed.hasUniqueAnswer ?? parsed.has_unique_answer),
        reason: typeof parsed.reason === 'string' ? parsed.reason : '',
        failure_tags: toStringArray(parsed.failure_tags),
        rewrite_advice: toStringArray(parsed.rewrite_advice)
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
