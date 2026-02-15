'use strict'

// Revisor prompt templates for conjugation_with_pronoun question type.
// Add new entries to the array; index is the prompt version.
// Each entry should return { system, user } strings.

const revisorPrompts = [
  ({ verb, target, originalQuestion, validatorResult }) => {
    const failureTags = Array.isArray(validatorResult?.failure_tags)
      ? validatorResult.failure_tags.join(', ')
      : ''
    const rewriteAdvice = Array.isArray(validatorResult?.rewrite_advice)
      ? validatorResult.rewrite_advice.join(' | ')
      : (validatorResult?.rewrite_advice || '')

    return {
      system:
        '你是一位西班牙语命题修订专家。你只修订 sentence 与 translation，不改其他字段。',
      user: `\
请根据 validator 反馈，修订这道 conjugation_with_pronoun 题目。

【动词与目标】
- infinitive: ${verb.infinitive}
- meaning: ${verb.meaning}
- host_form: ${target.host_form}
- host_form_zh: ${target.host_form_zh}
- mood: ${target.mood}
- tense: ${target.tense}
- person: ${target.person}
- host_base_form: ${target.base_form}

【原题 JSON】
${JSON.stringify(originalQuestion || {}, null, 2)}

【validator 反馈】
${JSON.stringify(validatorResult || {}, null, 2)}

【你必须优先处理的信息】
- hasUniqueAnswer: ${String(validatorResult?.hasUniqueAnswer)}
- reason: ${validatorResult?.reason || ''}
- failure_tags: ${failureTags || '(empty)'}
- rewrite_advice: ${rewriteAdvice || '(empty)'}

【修订规则】
1. 只修改 sentence 和 translation，其他字段一律不改。
2. sentence 必须且仅包含一个 "__?__"。
3. 必须提升唯一解与自然度，优先解决 validator 指出的核心问题。
4. 保证代词位置、拼写、重音符号在修订后的句子中依然可被唯一支持。
5. 若无法完全修复，至少给出明显更优且更接近唯一解的版本。
6. 只输出 JSON，不要 markdown。

输出格式：
{
  "sentence": "修订后的句子（含且仅含一个 __?__）",
  "translation": "修订后的中文翻译",
  "revisor_reason": "你如何修复问题的简短说明"
}
`
    }
  }
]

module.exports = revisorPrompts
