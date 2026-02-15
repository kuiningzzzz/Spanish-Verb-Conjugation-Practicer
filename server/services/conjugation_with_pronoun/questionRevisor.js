const { chat, cleanJsonText, getConfig, getStageSettings } = require('./llmClient')

function buildPrompt({ verb, target, originalQuestion, validatorResult }) {
  return {
    system:
      '你是西班牙语命题修订专家。你只能修订 sentence 和 translation，其他字段保持不变。',
    user: `\
请根据 validator 反馈修订题目，只输出 JSON。

【目标参数】
- infinitive: ${verb.infinitive}
- meaning: ${verb.meaning}
- host_form: ${target.host_form}
- host_form_zh: ${target.host_form_zh}
- mood: ${target.mood}
- tense: ${target.tense}
- person: ${target.person}
- host_base_form: ${target.base_form}

【原题】
${JSON.stringify(originalQuestion || {}, null, 2)}

【validator 反馈】
${JSON.stringify(validatorResult || {}, null, 2)}

【修订规则】
1. 只修改 sentence 与 translation。
2. sentence 必须且仅包含一个 "__?__"。
3. 必须优先修复 validator 指出的唯一解问题与语法问题。
4. 保证修订后仍能唯一支持目标答案（代词格/性数/位置）。
5. 句子自然地道，不模板化。

返回格式：
{
  "sentence": "修订后的句子",
  "translation": "修订后的中文翻译",
  "revisor_reason": "简短修订说明"
}
`
  }
}

class ConjugationWithPronounRevisorService {
  static async reviseQuestion({ verb, target, originalQuestion, validatorResult }) {
    const settings = getStageSettings('REVISOR')
    const prompt = buildPrompt({ verb, target, originalQuestion, validatorResult })

    console.log(
      `[AI生成][pronoun-revisor] model=${getConfig().model} maxTokens=${settings.maxTokens} temperature=${settings.temperature}`
    )

    const response = await chat({
      system: prompt.system,
      user: prompt.user,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens
    })

    const parsed = JSON.parse(cleanJsonText(response))
    return {
      sentence: typeof parsed.sentence === 'string' ? parsed.sentence.trim() : '',
      translation: typeof parsed.translation === 'string' ? parsed.translation.trim() : '',
      revisor_reason: typeof parsed.revisor_reason === 'string' ? parsed.revisor_reason.trim() : ''
    }
  }
}

module.exports = ConjugationWithPronounRevisorService
