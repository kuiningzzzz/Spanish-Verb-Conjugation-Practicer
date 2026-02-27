'use strict'

// Generator prompt templates for conjugation_with_pronoun question type.
// Add new entries to the array; index is the prompt version.
// Each entry should return { system, user } strings.

const generatorPrompts = [
  ({ verb, target }) => {
    const targetPronounPattern = target.pronoun_pattern || ''
    const finiteExtraRule = target.host_form === 'finite'
      ? `\n- finite 题必须使用：${target.mood} ${target.tense}（${target.host_form_zh}），人称：${target.person}。`
      : ''

    const hostFormRule = target.host_form === 'prnl'
      ? `
- 本题 host_form 固定为 prnl，且必须体现自复/代词动词含义（例如 "llamarse" 这类）。`
      : `
- 本题 host_form 固定为 ${target.host_form}。`

    let pronounPatternRule = ''
    if (target.host_form === 'prnl') {
      pronounPatternRule = `
- 本题 pronoun_pattern 固定为空字符串 ""，不得输出 DO/IO/DO_IO。
- io_pronoun 和 do_pronoun 必须都为空字符串 ""。`
    } else if (targetPronounPattern === 'DO') {
      pronounPatternRule = `
- 本题 pronoun_pattern 固定为 "DO"，不得改成 IO 或 DO_IO。
- 必须满足：do_pronoun 非空，io_pronoun 为空字符串 ""。
- 该动词 supports_do 必须为 true（本题已保证抽词阶段满足）。`
    } else if (targetPronounPattern === 'IO') {
      pronounPatternRule = `
- 本题 pronoun_pattern 固定为 "IO"，不得改成 DO 或 DO_IO。
- 必须满足：io_pronoun 非空，do_pronoun 为空字符串 ""。
- 该动词 supports_io 必须为 true（本题已保证抽词阶段满足）。`
    } else if (targetPronounPattern === 'DO_IO') {
      pronounPatternRule = `
- 本题 pronoun_pattern 固定为 "DO_IO"，不得改成 DO 或 IO。
- 必须满足：io_pronoun 和 do_pronoun 都非空。
- 该动词 supports_do_io 必须为 true（本题已保证抽词阶段满足）。`
    }

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
- supports_do: ${String(verb.supports_do)}
- supports_io: ${String(verb.supports_io)}
- supports_do_io: ${String(verb.supports_do_io)}

【固定目标】
- host_form: ${target.host_form}
- host_form_zh: ${target.host_form_zh}
- pronoun_pattern: ${targetPronounPattern}
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
   - 关键：DO_IO 且出现第三人称组合时，必须用 se lo/la/los/las，不能写 le/les lo/la/los/las
   - 关键：凡是目标形式需要反身/代词成分时，不能漏掉 se（或对应的 me/te/nos/os/se）
4. 上下文必须足够充分，能唯一判断代词的格、性、数与答案形式；不要做成多解题。
5. 用户可见元信息必须可支持作答：infinitive、host_form_zh、pronoun_pattern（prnl 时应为空）。
6. 句子自然地道，避免模板化开头（如单纯靠 mañana/hoy/ayer 硬锁答案）。
7. 只输出一个 JSON 对象，禁止 markdown 包裹或额外说明。
8. 输出前请自检：answer 是否遗漏了应有的 se（尤其 DO_IO 的 le/les->se 变化，或反身用法中的 se）。
${pronounPatternRule}

请严格按以下 JSON 字段返回：
{
  "host_form": "${target.host_form}",
  "host_form_zh": "${target.host_form_zh}",
  "pronoun_pattern": "${targetPronounPattern}",
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
  },
  ({ verb, target }) => {
    const targetPronounPattern = target.pronoun_pattern || ''
    const finiteExtraRule = target.host_form === 'finite'
      ? `\n- finite 题必须使用：${target.mood} ${target.tense}（${target.host_form_zh}），人称：${target.person}。`
      : ''

    const hostFormRule = target.host_form === 'prnl'
      ? `
- 本题 host_form 固定为 prnl，必须体现代词动词/自复意义，且句中语义应支持该用法。`
      : `
- 本题 host_form 固定为 ${target.host_form}。`

    let pronounPatternRule = ''
    if (target.host_form === 'prnl') {
      pronounPatternRule = `
- 本题 pronoun_pattern 固定为空字符串 ""，不得输出 DO/IO/DO_IO。
- io_pronoun 与 do_pronoun 必须都为空字符串 ""。`
    } else if (targetPronounPattern === 'DO') {
      pronounPatternRule = `
- 本题 pronoun_pattern 固定为 "DO"，不得改成 IO 或 DO_IO。
- 必须满足：do_pronoun 非空，io_pronoun 为空字符串 ""。`
    } else if (targetPronounPattern === 'IO') {
      pronounPatternRule = `
- 本题 pronoun_pattern 固定为 "IO"，不得改成 DO 或 DO_IO。
- 必须满足：io_pronoun 非空，do_pronoun 为空字符串 ""。`
    } else if (targetPronounPattern === 'DO_IO') {
      pronounPatternRule = `
- 本题 pronoun_pattern 固定为 "DO_IO"，不得改成 DO 或 IO。
- 必须满足：io_pronoun 与 do_pronoun 都非空。`
    }

    return {
      system:
        '你是一位高级西班牙语命题专家。你生成的是高信息密度题目，目标是让学习者仅凭上下文得到唯一答案（动词+代词组合）。',
      user: `\
请基于下列目标生成一道 "conjugation_with_pronoun" 题目（高上下文版）。

【动词信息】
- infinitive: ${verb.infinitive}
- meaning: ${verb.meaning}
- is_reflexive: ${String(verb.is_reflexive)}
- has_tr_use: ${String(verb.has_tr_use)}
- supports_do: ${String(verb.supports_do)}
- supports_io: ${String(verb.supports_io)}
- supports_do_io: ${String(verb.supports_do_io)}

【固定目标】
- host_form: ${target.host_form}
- host_form_zh: ${target.host_form_zh}
- pronoun_pattern: ${targetPronounPattern}
- mood: ${target.mood}
- tense: ${target.tense}
- person: ${target.person}
- host_base_form（不含宾语代词）: ${target.base_form}
${hostFormRule}
${finiteExtraRule}

【最重要目标：唯一解】
你必须让用户在看到 sentence + infinitive + host_form_zh + pronoun_pattern 后，只能推出一个正确答案。
必须清楚给出代词判断所需信息（格、性、数、所指对象、受事/受益者关系），避免任何多解。

【释义-代词模式匹配规则（必须）】
1. 在给定 infinitive + pronoun_pattern 后，先选择该动词“最自然、最常见且能承载该模式”的释义，再写句子。
2. 不得为了满足 pattern 硬造不常见或不地道的配价；尤其不要把本应是 DO 的成分硬解释为 IO。
3. 不得依赖方言性 leísmo/laísmo/loísmo 作为唯一解依据，按标准西班牙语生成题目。
4. 示例（必须遵守）：
   - 反例：infinitive=graduar，pronoun_pattern=IO，句子写成“tras la ceremonia, __?__ al estudiante destacado...”，答案“gradúale”。
     这里 "al estudiante" 在标准语法里对应直接宾语（CD），不是 IO-only。
   - 正确做法：在同一动词下改写到真正支持 IO 的义项/论元结构；若该动词在常见义项下无法自然支持该 pattern，不要强行写出不自然题干。

【代词位置与书写硬规则（必须逐条满足）】
1. finite：代词必须前置且分写（例如 "me lo das"），不得写成后置附着。
2. imperative（仅肯定命令式）：代词必须后置并与命令式合写；需要时必须加重音（例如 "dámelo"），不得分写。
3. infinitive：
   - 允许前置分写（放在前面的变位动词/词组前）：例如 "te lo puedo dar"；
   - 也允许后置合写在不定式：例如 "puedo dártelo"；
   - 若上下文下这两种都正确，answer 必须用 "|" 给出并列答案（例如 "te lo puedo dar|puedo dártelo"）；
   - 若只有一种写法成立，answer 只能给一个答案，不得滥用 "|"。
4. gerund：代词必须后置合写在副动词上，并在需要时加重音（例如 "dándomelo"），不得分写。
5. prnl：必须出现对应反身代词（me/te/se/nos/os/se），且位置遵循本题 host_form 规则。

【上下文复杂度与多样化（必须）】
1. sentence 必须是 1~2 句叙述体（不要对话体），且信息密度高。
2. 可包含复杂从句，但总句数仍控制在 1~2 句。
3. 必须给出足够语义锚点，使用户能确定代词格、性、数和指代对象。
4. 句式要多样：主句先行、原因、条件、让步、关系从句等可轮换；不要总是用 "Aunque/Cuando + 从句" 模板开头。
5. 开头策略池（每题先选 1 种策略再写句子，策略可自由发挥）：
   - 策略A：主语直接开头（如 El profesor..., La empresa...）
   - 策略B：时间/背景引导开头（可用 Durante/Al final de/En plena...）
   - 策略C：从句先行开头（如 Aunque/Si/Cuando/Antes de que...）
   - 策略D：目的或结果导向开头（如 Para evitar..., De modo que...）
   - 策略E：插入语或评价语开头（如 Según el informe..., En mi experiencia...）
6. 可以使用 "Durante" 开头，但不要把它当成默认模板；应与其他策略轮换。
7. 若使用 "Durante"，尽量避免固定成 "Durante + 名词, __?__" 的机械句型，可加入从句或补充信息提高变化度。
8. 场景要多样（工作、学校、家庭、医疗、出行、行政等），避免单一模板。
9. 必须只有一个 "__?__"，且空里只能填“动词+代词组合”。

【强约束】
1. 不得把答案或同形答案直接泄露在题干其他位置。
2. 代词位置、拼写、重音必须正确；尤其不得把 imperative/gerund 的附着式写成分写。
3. answer 默认是单个答案字符串；仅当 host_form=infinitive 且确有两种合法位置时，才允许用 "|" 分隔两个完整答案。
4. 使用 "|" 时：每个候选都必须能完整替换 "__?__"；候选不得为空、不得重复、不得超过 2 个。
5. DO_IO 且出现第三人称组合时，必须用 se lo/la/los/las，不能写 le/les lo/la/los/las。
6. 凡是目标形式需要反身/代词成分时，不能漏掉 se（或对应的 me/te/nos/os/se）。
7. infinitive 若使用双答案，两个候选必须仅体现“前置分写 vs 后置合写”的位置差异，语义和指代必须一致。
8. 若 host_form=finite，本题只允许常见陈述式时态（按目标给定时态），不要改成其他时态。
9. 非 prnl 题必须严格遵守目标 pronoun_pattern 对应的 io_pronoun/do_pronoun 填写规则。
10. 句子要自然，不要生硬模板化。
11. 只输出一个 JSON 对象，禁止 markdown 或额外解释。
12. 输出前请自检：answer 是否遗漏了应有的 se（尤其 DO_IO 的 le/les->se 变化，或反身用法中的 se）。
${pronounPatternRule}

请严格按以下 JSON 字段返回：
{
  "host_form": "${target.host_form}",
  "host_form_zh": "${target.host_form_zh}",
  "pronoun_pattern": "${targetPronounPattern}",
  "mood": "${target.mood}",
  "tense": "${target.tense}",
  "person": "${target.person}",
  "io_pronoun": "字符串，可空",
  "do_pronoun": "字符串，可空",
  "sentence": "高信息量题干（1~2句叙述体），包含且仅包含一个 __?__",
  "answer": "答案；默认单个字符串。仅 host_form=infinitive 且确有双合法写法时可用 \"候选1|候选2\"",
  "translation": "题干中文翻译（对应1~2句叙述体）",
  "hint": "简短提示（可用于日志）"
}
`
    }
  },
  ({ verb, target }) => {
    const targetPronounPattern = target.pronoun_pattern || ''
    const finiteExtraRule = target.host_form === 'finite'
      ? `\n- finite 题必须使用：${target.mood} ${target.tense}（${target.host_form_zh}），人称：${target.person}。`
      : ''

    const hostFormRule = target.host_form === 'prnl'
      ? `
- 本题 host_form 固定为 prnl，必须体现代词动词/自复意义，且句中语义应支持该用法。`
      : `
- 本题 host_form 固定为 ${target.host_form}。`

    let pronounPatternRule = ''
    if (target.host_form === 'prnl') {
      pronounPatternRule = `
- 本题 pronoun_pattern 固定为空字符串 ""，不得输出 DO/IO/DO_IO。
- io_pronoun 与 do_pronoun 必须都为空字符串 ""。`
    } else if (targetPronounPattern === 'DO') {
      pronounPatternRule = `
- 本题 pronoun_pattern 固定为 "DO"，不得改成 IO 或 DO_IO。
- 必须满足：do_pronoun 非空，io_pronoun 为空字符串 ""。`
    } else if (targetPronounPattern === 'IO') {
      pronounPatternRule = `
- 本题 pronoun_pattern 固定为 "IO"，不得改成 DO 或 DO_IO。
- 必须满足：io_pronoun 非空，do_pronoun 为空字符串 ""。`
    } else if (targetPronounPattern === 'DO_IO') {
      pronounPatternRule = `
- 本题 pronoun_pattern 固定为 "DO_IO"，不得改成 DO 或 IO。
- 必须满足：io_pronoun 与 do_pronoun 都非空。`
    }

    return {
      system:
        '你是一位高级西班牙语命题专家。你生成的是高信息密度题目，目标是让学习者仅凭上下文得到唯一答案（动词+代词组合）。',
      user: `\
请基于下列目标生成一道 "conjugation_with_pronoun" 题目（高上下文版）。

【动词信息】
- infinitive: ${verb.infinitive}
- meaning: ${verb.meaning}
- is_reflexive: ${String(verb.is_reflexive)}
- has_tr_use: ${String(verb.has_tr_use)}
- supports_do: ${String(verb.supports_do)}
- supports_io: ${String(verb.supports_io)}
- supports_do_io: ${String(verb.supports_do_io)}

【固定目标】
- host_form: ${target.host_form}
- host_form_zh: ${target.host_form_zh}
- pronoun_pattern: ${targetPronounPattern}
- mood: ${target.mood}
- tense: ${target.tense}
- person: ${target.person}
- host_base_form（不含宾语代词）: ${target.base_form}
${hostFormRule}
${finiteExtraRule}

【最重要目标：唯一解】
你必须让用户在看到 sentence + infinitive + host_form_zh + pronoun_pattern 后，只能推出一个正确答案。
必须清楚给出代词判断所需信息（格、性、数、所指对象、受事/受益者关系），避免任何多解。

【释义-代词模式匹配规则（必须）】
1. 在给定 infinitive + pronoun_pattern 后，先选择该动词“最自然、最常见且能承载该模式”的释义，再写句子。
2. 不得为了满足 pattern 硬造不常见或不地道的配价；尤其不要把本应是 DO 的成分硬解释为 IO。
3. 不得依赖方言性 leísmo/laísmo/loísmo 作为唯一解依据，按标准西班牙语生成题目。
4. 示例（必须遵守）：
   - 反例：infinitive=graduar，pronoun_pattern=IO，句子写成“tras la ceremonia, __?__ al estudiante destacado...”，答案“gradúale”。
     这里 "al estudiante" 在标准语法里对应直接宾语（CD），不是 IO-only。
   - 正确做法：在同一动词下改写到真正支持 IO 的义项/论元结构；若该动词在常见义项下无法自然支持该 pattern，不要强行写出不自然题干。

【代词位置与书写硬规则（必须逐条满足）】
1. finite：代词必须前置且分写（例如 "me lo das"），不得写成后置附着。
2. imperative（仅肯定命令式）：代词必须后置并与命令式合写；需要时必须加重音（例如 "dámelo"），不得分写。
3. infinitive：
   - 允许前置分写（放在前面的变位动词/词组前）：例如 "te lo puedo dar"；
   - 也允许后置合写在不定式：例如 "puedo dártelo"；
   - 若上下文下这两种都正确，answer 必须用 "|" 给出并列答案（例如 "te lo puedo dar|puedo dártelo"）；
   - 若只有一种写法成立，answer 只能给一个答案，不得滥用 "|"。
4. gerund：代词必须后置合写在副动词上，并在需要时加重音（例如 "dándomelo"），不得分写。
5. prnl：必须出现对应反身代词（me/te/se/nos/os/se），且位置遵循本题 host_form 规则。

【上下文复杂度与多样化（必须）】
1. sentence 必须是 1~2 句叙述体（不要对话体），且信息密度高。
2. 可包含复杂从句，但总句数仍控制在 1~2 句。
3. 必须给出足够语义锚点，使用户能确定代词格、性、数和指代对象。
4. 句式要多样：主句先行、原因、条件、让步、关系从句等可轮换；不要总是用 "Aunque/Cuando + 从句" 模板开头。
5. 开头策略池（每题先选 1 种策略再写句子，策略可自由发挥）：
   - 策略A：主语直接开头（如 El profesor..., La empresa...）
   - 策略B：时间/背景引导开头（可用 Durante/Al final de/En plena...）
   - 策略C：从句先行开头（如 Aunque/Si/Cuando/Antes de que...）
   - 策略D：目的或结果导向开头（如 Para evitar..., De modo que...）
   - 策略E：插入语或评价语开头（如 Según el informe..., En mi experiencia...）
6. 可以使用 "Durante" 开头，但不要把它当成默认模板；应与其他策略轮换。
7. 若使用 "Durante"，尽量避免固定成 "Durante + 名词, __?__" 的机械句型，可加入从句或补充信息提高变化度。
8. 场景要多样（工作、学校、家庭、医疗、出行、行政等），避免单一模板。
9. 必须只有一个 "__?__"，且空里只能填“动词+代词组合”。

【强约束】
1. 不得把答案或同形答案直接泄露在题干其他位置。
2. 代词位置、拼写、重音必须正确；尤其不得把 imperative/gerund 的附着式写成分写。
3. answer 默认是单个答案字符串；仅当 host_form=infinitive 且确有两种合法位置时，才允许用 "|" 分隔两个完整答案。
4. 使用 "|" 时：每个候选都必须能完整替换 "__?__"；候选不得为空、不得重复、不得超过 2 个。
5. DO_IO 且出现第三人称组合时，必须用 se lo/la/los/las，不能写 le/les lo/la/los/las。
6. 凡是目标形式需要反身/代词成分时，不能漏掉 se（或对应的 me/te/nos/os/se）。
7. infinitive 若使用双答案，两个候选必须仅体现“前置分写 vs 后置合写”的位置差异，语义和指代必须一致。
8. 若 host_form=finite，本题只允许常见陈述式时态（按目标给定时态），不要改成其他时态。
9. 非 prnl 题必须严格遵守目标 pronoun_pattern 对应的 io_pronoun/do_pronoun 填写规则。
10. 句子要自然，不要生硬模板化。
11. 只输出一个 JSON 对象，禁止 markdown 或额外解释。
12. 输出前请自检：answer 是否遗漏了应有的 se（尤其 DO_IO 的 le/les->se 变化，或反身用法中的 se）。
${pronounPatternRule}

请严格按以下 JSON 字段返回：
{
  "host_form": "${target.host_form}",
  "host_form_zh": "${target.host_form_zh}",
  "pronoun_pattern": "${targetPronounPattern}",
  "mood": "${target.mood}",
  "tense": "${target.tense}",
  "person": "${target.person}",
  "io_pronoun": "字符串，可空",
  "do_pronoun": "字符串，可空",
  "sentence": "高信息量题干（1~2句叙述体），包含且仅包含一个 __?__",
  "answer": "答案；默认单个字符串。仅 host_form=infinitive 且确有双合法写法时可用 \"候选1|候选2\"",
  "translation": "题干中文翻译（对应1~2句叙述体）",
  "hint": "简短提示（可用于日志）"
}
`
    }
  }
]

module.exports = generatorPrompts
