'use strict'

// Validator prompt templates for conjugation_with_pronoun question type.
// Add new entries to the array; index is the prompt version.
// Each entry should return { system, user } strings.

const validatorPrompts = [
  ({ verb, target, question }) => {
    return {
      system:
        '你是一位严谨的西班牙语题目质检专家。你要检查“动词+代词组合填空题”的语法正确性、字段一致性和唯一解。',
      user: `\
请严格验证以下 conjugation_with_pronoun 题目。

【目标约束】
- infinitive: ${verb.infinitive}
- meaning: ${verb.meaning}
- host_form(必须): ${target.host_form}
- host_form_zh(必须): ${target.host_form_zh}
- mood(必须): ${target.mood}
- tense(必须): ${target.tense}
- person(必须): ${target.person}
- host_base_form(不含宾语代词): ${target.base_form}

【待验证题目 JSON】
${JSON.stringify(question || {}, null, 2)}

【规则检查（全部必须执行）】
1) host_form 只能是 finite/imperative/infinitive/gerund/prnl；且必须与目标一致。
2) finite 只允许常见时态（这里固定为目标时态），不得改成其他时态。
3) pronoun_pattern 规则：
   - 非 prnl：必须是 DO / IO / DO_IO 之一
   - prnl：必须为空字符串
4) io_pronoun / do_pronoun 规则：
   - prnl：两者都必须为空
   - DO：do_pronoun 非空，io_pronoun 为空
   - IO：io_pronoun 非空，do_pronoun 为空
   - DO_IO：两者都非空
5) answer 必须是“动词+代词组合”，不是裸动词、不是裸代词。
6) 代词位置、拼写、重音符号必须正确（尤其附着代词时）。
7) sentence 必须仅包含一个 "__?__"，且题干上下文足够充分，能唯一确定答案。
8) 不得答案泄露（题干直接出现 answer）。
9) 句子自然地道，翻译基本准确。

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

请只输出一个 JSON 对象（禁止 markdown），格式必须是：
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
]

module.exports = validatorPrompts
