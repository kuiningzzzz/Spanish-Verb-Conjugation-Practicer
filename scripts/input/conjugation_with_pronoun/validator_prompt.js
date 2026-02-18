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

【规则检查（全部必须执行）】
1) host_form 只能是 finite/imperative/infinitive/gerund/prnl；且必须与目标一致。
2) finite 只允许常见时态（这里固定为目标时态），不得改成其他时态。
3) pronoun_pattern 规则：
   - 必须与目标 pronoun_pattern 完全一致，不允许改值
   - 把目标 pronoun_pattern 视为已知且正确的题目条件
   - 若 host_form=prnl，必须为空字符串
   - 若 host_form 非 prnl，必须是 DO/IO/DO_IO 之一且等于目标值
4) io_pronoun / do_pronoun 规则：
   - prnl：两者都必须为空
   - DO：do_pronoun 非空，io_pronoun 为空
   - IO：io_pronoun 非空，do_pronoun 为空
   - DO_IO：两者都非空
5) supports 标签一致性：
   - 若目标 pronoun_pattern=DO，则 supports_do 必须是 true
   - 若目标 pronoun_pattern=IO，则 supports_io 必须是 true
   - 若目标 pronoun_pattern=DO_IO，则 supports_do_io 必须是 true
6) answer 必须是“动词+代词组合”，不是裸动词、不是裸代词。
7) 代词位置、拼写、重音符号必须正确（尤其附着代词时）。
8) se 规则检查（必须执行）：
   - DO_IO 且第三人称组合时，必须是 se lo/la/los/las；若出现 le/les lo/la/los/las 判错
   - 若目标形式需要反身/代词成分，不得遗漏 se（或对应的 me/te/nos/os/se）
9) sentence 必须仅包含一个 "__?__"，且题干上下文足够充分，能唯一确定答案。
10) 唯一解判定仅在“给定 host_form + pronoun_pattern”前提下进行；不要因为“换成其他 pronoun_pattern 也可能成立”而判错。
11) 不检查 hint 字段；句子自然地道，翻译基本准确。

【failure_tags 可选枚举】
- "field_mismatch"
- "host_form_invalid"
- "pronoun_pattern_invalid"
- "pronoun_fields_invalid"
- "support_tag_mismatch"
- "answer_not_combo"
- "pronoun_position_error"
- "accent_error"
- "se_conversion_error"
- "missing_reflexive_se"
- "too_short_info"
- "not_unique"
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
  },
  ({ verb, target, question }) => {
    return {
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
- reason 必须具体说明“为何不唯一/为何不可解/为何与字段冲突”，不能只写笼统结论。
- rewrite_advice 至少给出 2 条、最好 3 条可执行修改建议（补充哪类信息、删除哪类歧义、如何改自然表达）。
- 不检查 hint 字段；不要添加与 hint 相关的错误原因。
- 不做“答案泄漏”检查；不要输出 answer_leak 相关结论。

【failure_tags 可选枚举】
- "field_mismatch"
- "host_form_invalid"
- "pronoun_pattern_invalid"
- "pronoun_fields_invalid"
- "support_tag_mismatch"
- "answer_not_combo"
- "pronoun_position_error"
- "accent_error"
- "se_conversion_error"
- "missing_reflexive_se"
- "too_short_info"
- "not_unique"
- "unnatural"
- "translation_issue"

请只输出一个 JSON 对象（禁止 markdown），格式必须是：
{
  "isValid": true/false,
  "hasUniqueAnswer": true/false,
  "reason": "详细字符串",
  "failure_tags": ["tag1", "tag2"],
  "rewrite_advice": ["建议1", "建议2", "建议3"]
}
`
    }
  },
  ({ verb, target, question }) => {
    return {
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
- reason 必须具体说明“为何不唯一/为何不可解/为何与字段冲突”，不能只写笼统结论。
- rewrite_advice 至少给出 2 条、最好 3 条可执行修改建议（补充哪类信息、删除哪类歧义、如何改自然表达）。
- 不检查 hint 字段；不要添加与 hint 相关的错误原因。
- 不做“答案泄漏”检查；不要输出 answer_leak 相关结论。

【failure_tags 可选枚举】
- "field_mismatch"
- "host_form_invalid"
- "pronoun_pattern_invalid"
- "pronoun_fields_invalid"
- "support_tag_mismatch"
- "answer_not_combo"
- "pronoun_position_error"
- "accent_error"
- "se_conversion_error"
- "missing_reflexive_se"
- "too_short_info"
- "not_unique"
- "unnatural"
- "translation_issue"

请只输出一个 JSON 对象（禁止 markdown），格式必须是：
{
  "isValid": true/false,
  "hasUniqueAnswer": true/false,
  "reason": "详细字符串",
  "failure_tags": ["tag1", "tag2"],
  "rewrite_advice": ["建议1", "建议2", "建议3"]
}
`
    }
  }
]

module.exports = validatorPrompts
