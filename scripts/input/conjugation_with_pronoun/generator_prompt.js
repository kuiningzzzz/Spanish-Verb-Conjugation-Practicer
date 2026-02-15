'use strict'

// Generator prompt templates for conjugation_with_pronoun question type.
// Add new entries to the array; index is the prompt version.
// Each entry should return { system, user } strings.

const generatorPrompts = [
  ({ verb, target }) => {
    const finiteExtraRule = target.host_form === 'finite'
      ? `\n- finite 题必须使用：${target.mood} ${target.tense}（${target.host_form_zh}），人称：${target.person}。`
      : ''

    const pronounPatternRule = target.host_form === 'prnl'
      ? `
- host_form=prnl 时，pronoun_pattern 必须是空字符串 ""。
- host_form=prnl 时，io_pronoun 和 do_pronoun 必须都为空字符串 ""。`
      : `
- 你必须自行选择并输出 pronoun_pattern，且只能是 "DO" / "IO" / "DO_IO" 三选一。
- host_form 非 prnl 时，必须按 pronoun_pattern 正确填写 io_pronoun / do_pronoun：
  - DO: do_pronoun 非空，io_pronoun 为空
  - IO: io_pronoun 非空，do_pronoun 为空
  - DO_IO: io_pronoun 和 do_pronoun 都非空`

    const hostFormRule = target.host_form === 'prnl'
      ? `
- 本题 host_form 固定为 prnl，且必须体现自复/代词动词含义（例如 "llamarse" 这类）。`
      : `
- 本题 host_form 固定为 ${target.host_form}。`

    return {
      system:
        '你是一位西班牙语命题专家，专门生成“动词+代词组合填空题”。你必须保证答案唯一、代词格正确、代词位置正确、重音符号正确。',
      user: `\
请基于下列目标生成一道 "conjugation_with_pronoun" 题目。

【动词信息】
- infinitive: ${verb.infinitive}
- meaning: ${verb.meaning}
- is_reflexive: ${String(verb.is_reflexive)}
- has_tr_use: ${String(verb.has_tr_use)}

【固定目标】
- host_form: ${target.host_form}
- host_form_zh: ${target.host_form_zh}
- mood: ${target.mood}
- tense: ${target.tense}
- person: ${target.person}
- host_base_form（不含宾语代词）: ${target.base_form}
${hostFormRule}
${finiteExtraRule}

【强约束】
1. 题目必须是“句子填空”，且句子中只出现一个 "__?__"。
2. 空里只能填“动词+代词组合”，不能只填动词，也不能只填代词。
3. 必须保证代词位置、拼写、重音符号正确：
   - finite 通常代词前置（如 me/te/se/le/lo/la... + 动词）
   - 肯定命令式、infinitive、gerund 通常代词后置并附着，必要时加重音
4. 上下文必须足够充分，能唯一判断代词的格、性、数与答案形式；不要做成多解题。
5. 用户可见元信息必须可支持作答：infinitive、host_form_zh、pronoun_pattern（prnl 时应为空）。
6. 句子自然地道，避免模板化开头（如单纯靠 mañana/hoy/ayer 硬锁答案）。
7. 只输出一个 JSON 对象，禁止 markdown 包裹或额外说明。
${pronounPatternRule}

请严格按以下 JSON 字段返回：
{
  "host_form": "${target.host_form}",
  "host_form_zh": "${target.host_form_zh}",
  "pronoun_pattern": "DO|IO|DO_IO 或空字符串",
  "mood": "${target.mood}",
  "tense": "${target.tense}",
  "person": "${target.person}",
  "io_pronoun": "字符串，可空",
  "do_pronoun": "字符串，可空",
  "sentence": "完整西班牙语句子，包含且仅包含一个 __?__",
  "answer": "空格唯一正确答案（动词+代词组合）",
  "translation": "题干中文翻译",
  "hint": "简短提示（可用于日志）"
}
`
    }
  }
]

module.exports = generatorPrompts
