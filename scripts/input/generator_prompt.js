'use strict'

// Generator prompt templates.
// Add new entries to the array; index is the prompt version.
// Each entry should return { system, user } strings.

const generatorPrompts = [
  ({ verb, conjugation }) => {
    const hasMultipleForms = conjugation.conjugated_form.includes(' | ')
    const answerNote = hasMultipleForms
      ? '\n注意：这个变位有多个正确形式，它们用 | 分隔。这些都是同一变位的不同表达方式，在生成的句子中任意一个都可以作为正确答案。请在answer字段中保留所有形式（用 | 分隔）。'
      : ''

    return {
      system:
        '你是一位专业的西班牙语教师，精通西班牙语动词变位和语法。你需要根据要求生成高质量的练习题，确保题目准确、有针对性，且只有唯一正确答案。',
      user: `\
请为西班牙语动词 "${verb.infinitive}" (意思: ${verb.meaning}) 生成一道例句填空题。

要求:
1. 句子必须使用 ${conjugation.mood} ${conjugation.tense} 的 ${conjugation.person} 形式
2. 正确答案是: ${conjugation.conjugated_form}${answerNote}
3. 句子的语境要确保只有这个变位形式是唯一正确的（通过时间状语、语境、人称主体等明确“时态、语气、人称”），不能有其他变位形式也符合句意
4. 句子要自然、地道
5. 难度适中，适合初学者

请严格按照以下JSON格式返回（不要包含任何markdown标记或额外说明）:
{
  "sentence": "完整的西班牙语句子，用 __?__ 表示要填空的位置",
  "answer": "${conjugation.conjugated_form}",
  "translation": "句子的中文翻译",
  "hint": "简短的提示（如陈述式现在时、虚拟式过去时等，可包含人称但不直接暴露答案）"
}
`
    }
  },
  ({ verb, conjugation }) => {
    const rawForms = conjugation.conjugated_form
      .split(' | ')
      .map(item => item.trim())
      .filter(Boolean)
    const answerVariants = rawForms.length > 0 ? rawForms : [conjugation.conjugated_form]
    const answerVariantsJson = JSON.stringify(answerVariants)
    const answerText = answerVariants.join(' | ')
    const answerNote = answerVariants.length > 1
      ? '\n注意：这个变位有多个正确形式，用 | 分隔。请在 answer_variants 中包含所有形式，并在 answer 中用 " | " 保留全部形式以兼容旧解析。'
      : ''

    return {
      system:
        '你是一位专业的西班牙语教师与命题专家，目标是生成自然、信息充分且唯一答案的例句填空题。',
      user: `\
请为西班牙语动词 "${verb.infinitive}" (意思: ${verb.meaning}) 生成一道例句填空题。

目标变位:
- 语气: ${conjugation.mood}
- 时态: ${conjugation.tense}
- 人称: ${conjugation.person}
- 正确答案: ${answerText}${answerNote}

【核心输出要求】
1. 只输出一个 JSON 对象，必须能被 JSON.parse，禁止任何 markdown 包裹或额外说明。
2. JSON 字段必须包含并完整输出：
{
  "cue_strategy": "A|B|C|D|E|F",
  "sentence": "…__?__…（可 1–3 句；填空只出现一次）",
  "answer_variants": ${answerVariantsJson},
  "answer": "${answerText}",
  "translation": "覆盖全部句子的中文翻译",
  "hint": "点开后提示：必须明确 mood/tense/person（可直接写 '虚拟式过去未完成时 + 第一人称单数'）"
}

【人称锚定（必须显式、不可替换）】
- 题干必须出现明确的人称锚点来锁定 expectedPerson（如 yo/tú/él/ella/usted/nosotros/nosotras/ellos/ellas/ustedes，或称呼结构锁定 usted/ustedes）。
- 禁止仅凭动词变位而省略主语导致的人称泛化。
- 若 expectedPerson 为 usted/ustedes，优先用称呼/礼貌请求/命令的语用结构锁定（如 “Señor/Señora, por favor, …”），但不要模板化重复同一种开头。

【填空位置与泄露控制】
- 填空位置用 __?__ 表示，只能出现一次。
- 题干中不得出现任何 answer_variants 的明文（包括在其它单词里作为子串的情况，尽量避免相近拼写）。
- 目标动词只出现一次：只能出现在 __?__ 那一处，不得在题干其它位置出现同一动词的任何变位/不定式/分词等。

【信息密度（不靠硬长度，而靠信息槽位）】
- 句子可以短，但必须“信息够”。
- 必须至少满足以下三类中的任意两类（生成后进行内部自检）：
  1) 从句触发器（que / cuando / mientras / porque / si / aunque / para que / antes de que 等）
  2) 语用场景锚（请求/建议/计划/怀疑/推测/条件/转折/结果/叙事突转等）
  3) 补充信息槽（地点/对象/原因/限制/对比/情绪态度/目的等）
- 若一句话不好写“信息够”，允许写两句甚至三句上下文补足信息，但填空仍然只出现一次。

【唯一性（最重要）】
- 目标必须是 ${conjugation.mood} ${conjugation.tense} + ${conjugation.person} 才成立。
- 不能出现：换成其它时态/语气/人称仍然合理的情况。
- 生成后必须做“替换自检”：尝试 2~3 个常见替代（同一语气的其他时态、陈述式现在/过去、其它人称）替换 __?__，若仍然合理则判定失败并内部重写题干（不要在输出中展示过程）。
- 唯一性优先通过“结构触发器/语用场景/搭配限制”实现，不要靠明显时间状语硬锁。

【去套路与多样性（强规则）】
- 禁止句首使用以下模板词/短语（句首禁用）：
  Mañana / Ayer / Hoy / Ahora / Siempre / Nunca / Todos los días / Cada día / Últimamente / En este momento
- 禁止“只靠一个时间状语决定时态”的写法：时间线索最多作为辅助，不得成为唯一钥匙。
- 鼓励使用更自然、不显眼的线索作为辅助（但不能单独锁定）：ya / todavía / en cuanto / desde entonces / de repente / al final / por fin / apenas 等。
- 鼓励多样化场景（上课/旅行/朋友聊天/家庭安排/工作日常等），并避免每题都用同一种开头或模板结构。

【cue_strategy（仅用于日志分析，不要求后端可控）】
从 A–F 里选择 1 个最合适的策略，并在输出字段 cue_strategy 标明：
A. 从句触发（que/antes de que/para que…）
B. 主句态度/判断触发（es importante que / me alegra que / dudo que…）
C. 条件/让步触发（si / aunque / a menos que…）
D. 目的/请求/建议触发（para que / te pido que / es mejor que…）
E. 叙事对比触发（mientras…/de repente…/背景 vs 突发完成）
F. 代词/搭配触发（宾语代词/间接宾语/固定搭配导致不可替换）
注意：某些时态不适合某些策略，必须选择真正适用的策略，禁止硬套。
`
    }
  }
]

module.exports = generatorPrompts
