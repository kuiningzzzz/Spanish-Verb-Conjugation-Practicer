'use strict'

// Validator prompt templates.
// Add new entries to the array; index is the prompt version.
// Each entry should return { system, user } strings.

const validatorPrompts = [
  ({ questionType, questionText, correctAnswer, exampleSentence, translation, hint, verb }) => {
    if (questionType !== 'sentence') {
      throw new Error('validator prompt only supports sentence for now')
    }

    const hasMultipleForms = correctAnswer.includes(' | ')
    const answerNote = hasMultipleForms
      ? '\n\n重要说明：答案中包含多个形式（用 | 分隔），这些是同一个变位的不同表达方式（如虚拟式过去完成时的 hubiera/hubiese 两种形式）。这种情况下，这几个形式都应该被接受作为正确答案。但你仍需验证在给定语境下，是否只有这个特定的变位形式（时态、语气、人称）才是正确的，不能有其他变位形式也符合句意。'
      : ''

    return {
      system: '你是一位严谨的西班牙语教育质量审核专家，负责验证练习题的准确性和唯一性。你必须给出客观、专业的评估。',
      user: `\
请作为西班牙语专家，严格验证以下例句填空题的合理性：

题目类型：例句填空
原形动词：${verb.infinitive} (${verb.meaning})
例句：${exampleSentence}
正确答案：${correctAnswer}${answerNote}
翻译：${translation || '无'}

请验证：
1. 句子的语法是否正确
2. 在给定的语境下，答案是否具有变位形式唯一性（即只有这个特定的变位形式符合句意，不能有其他时态、语气、人称的变位也正确）
3. 如果答案包含多个形式（用 | 分隔），这是同一变位的不同表达，都应该被接受
4. 句子是否自然、地道
5. 翻译是否准确

请严格按照以下JSON格式返回（不要包含markdown标记）：
{
  "isValid": true/false,
  "hasUniqueAnswer": true/false,
  "reason": "如果invalid或没有唯一答案，说明原因；否则为空字符串"
}
`
    }
  },
  ({ questionType, questionText, correctAnswer, exampleSentence, translation, hint, verb }) => {
    if (questionType !== 'sentence') {
      throw new Error('validator prompt only supports sentence for now')
    }

    const hasMultipleForms = correctAnswer.includes(' | ')
    const answerNote = hasMultipleForms
      ? '\n\n注意：答案包含多个形式（用 | 分隔），它们是同一变位的不同表达。请接受这些形式作为等价答案，但仍需验证在语境下只有这个变位（语气/时态/人称）是唯一成立的。'
      : ''

    return {
      system: '你是一位严谨的西班牙语教育质量审核专家，负责验证练习题的准确性、唯一性与自然度。',
      user: `\
请作为西班牙语专家，严格验证以下例句填空题的合理性：

题目类型：例句填空
原形动词：${verb.infinitive} (${verb.meaning})
例句：${exampleSentence || questionText}
正确答案：${correctAnswer}${answerNote}
翻译：${translation || '无'}

【核心输出要求】
1. 只输出一个 JSON 对象；必须能 JSON.parse；禁止任何 markdown 包裹或额外说明。
2. JSON 字段必须包含：
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
- alternatives 至少 3 个；每个都必须解释 whyPlausible 与 whyInvalidHere。
- 如果替代在语境下其实也成立，whyInvalidHere 必须诚实写 "it actually works"。

【必须检查的项目】
1) 语法正确性：词序、代词位置、搭配、时态一致性、标点等；若不正确则 isValid=false。
2) 人称锚定：是否明确锁定 expectedPerson；若更换人称仍然合理，则 hasUniqueAnswer=false 且 failure_tags 包含 "person_ambiguous"。
3) 唯一性：是否只有 expectedMood+expectedTense+expectedPerson 才成立（由正确答案所对应的变位决定）；若其它时态/语气也可成立，则 hasUniqueAnswer=false，添加 "tense_ambiguous" 或 "mood_ambiguous"。
4) 去套路检查：若题干以模板句首开头或过度依赖高危时间状语锁定，标记 "template_opening" 或 "time_adverb_overused"；若因此导致唯一性像“明牌提示”，在 reason 中说明并给 rewrite_advice。
5) 自然度：是否像真实西语表达；若明显“为锁语法而尬写”，failure_tags 包含 "unnatural"（是否 isValid=false 由你判断，但必须在 reason 解释）。

【failure_tags 枚举（至少包含这些，输出时可多选）】
- "too_short_info"
- "person_ambiguous"
- "tense_ambiguous"
- "mood_ambiguous"
- "time_adverb_overused"
- "template_opening"
- "answer_leak"
- "unnatural"

【rewrite_advice（必须给可执行建议，至少 2 条）】
- 给出如何补强语境以排除某个 alternative 的具体建议（如：加入从句触发、加入主句态度表达、补充明确主语锚点、加入目的/条件限制、改成两句上下文等）。
- 给出如何去套路的具体建议（如：不要以 mañana 开头、把时间线索改为 ya/todavía 等隐性线索、用对话/原因从句替代时间状语锁定等）。
`
    }
  },
  ({ questionType, questionText, correctAnswer, exampleSentence, translation, hint, verb }) => {
    if (questionType !== 'sentence') {
      throw new Error('validator prompt only supports sentence for now')
    }

    const hasMultipleForms = correctAnswer.includes(' | ')
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
正确答案：${correctAnswer}${answerNote}
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
]

module.exports = validatorPrompts
