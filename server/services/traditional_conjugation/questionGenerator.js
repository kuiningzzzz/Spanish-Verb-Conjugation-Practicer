const { chat, cleanJsonText, getConfig, getStageSettings } = require('./llmClient')

function splitAnswerVariants(text) {
  return String(text || '')
    .split('|')
    .map(item => item.trim())
    .filter(Boolean)
}

function buildLatestGeneratorPrompt({ verb, conjugation }) {
  const rawForms = conjugation.conjugated_form
    .split(' | ')
    .map(item => item.trim())
    .filter(Boolean)
  const answerVariants = rawForms.length > 0 ? rawForms : [conjugation.conjugated_form]
  const answerVariantsJson = JSON.stringify(answerVariants)
  const answerText = answerVariants.join(' | ')
  const answerNote = answerVariants.length > 1
    ? '\n注意：这个变位有多个正确形式，用 | 分隔。请在 answer_variants 中包含所有形式，并在 answer 中用 " | " 保留全部形式。'
    : ''

  return {
    system:
      '你是一位专业的西班牙语教师与命题专家，目标是生成自然、信息充分、且变位槽位唯一的例句填空题。',
    user: `\
请为西班牙语动词 "${verb.infinitive}" (意思: ${verb.meaning}) 生成一道例句填空题。

目标变位:
- 语气: ${conjugation.mood}
- 时态: ${conjugation.tense}
- 人称槽位: ${conjugation.person}
- 正确答案: ${answerText}${answerNote}

【关键定义】
- 本题核心是“变位槽位唯一”，即 __?__ 只能填入 ${conjugation.mood} + ${conjugation.tense} + ${conjugation.person} 的形式。
- 不要求“指代对象唯一到具体代词身份”（例如第三人称单数可对应 él/ella/usted），只要槽位不发生变化即可。
- 仍需避免会改变槽位的歧义（如 tú vs usted、vosotros vs ustedes、yo vs nosotros）。

【核心输出要求】
1. 只输出一个 JSON 对象，必须能被 JSON.parse，禁止 markdown 包裹或额外说明。
2. JSON 字段必须包含并完整输出：
{
  "cue_strategy": "A|B|C|D|E|F",
  "sentence": "…__?__…（可 1–3 句；填空只出现一次）",
  "answer_variants": ${answerVariantsJson},
  "answer": "${answerText}",
  "translation": "覆盖全部句子的中文翻译",
  "hint": "必须明确写出语气+时态+人称槽位（例如：陈述式现在时 + 第三人称单数）"
}

【槽位锚定规则（强制）】
- 题干必须提供足够线索锁定目标槽位（person/number/register），但不强制锁定性别或具体人物身份。
- 若目标是第二人称，必须显式区分 tú/usted 或 vosotros/ustedes，禁止混淆。
- 若目标是第一人称复数或第二人称复数，题干中要出现对应一致线索（如 nos-/os-/vuestro 等或清晰称呼/主语）。
- 禁止仅靠“填空动词词尾”来反推槽位。

【填空与泄露控制】
- 填空符号必须是 __?__，且仅出现一次。
- 题干不得出现 answer_variants 明文（包括子串泄露）。
- 目标动词只能在 __?__ 出现，不得在题干其他位置出现同一动词的任何变位/不定式/分词。

【信息密度与唯一性】
- 句子可以短，但必须信息充分；至少满足三类中的两类：
  1) 从句/结构触发器（que, si, aunque, para que, antes de que, mientras, cuando...）
  2) 语用触发（请求、建议、推测、反事实、条件、叙事转折）
  3) 补充约束（对象、原因、目的、限制、对比、地点、结果）
- 生成后必须做内部替换自检：尝试 2~3 个常见替代（不同槽位或不同时态/语气）。只要能在不改上下文骨架下成立，则重写。

【去套路与自然度】
- 禁止句首：Mañana / Ayer / Hoy / Ahora / Siempre / Nunca / Todos los días / Cada día / Últimamente / En este momento
- 禁止仅靠单一时间状语锁时态。
- 鼓励使用结构与语用线索锁定，不要写模板化句首。

【cue_strategy（日志分析）】
从 A-F 选择最适合的一项：
A 从句触发
B 主句态度判断触发
C 条件/让步触发
D 目的/请求/建议触发
E 叙事对比触发
F 代词/搭配触发
- 注意：某些时态不适合某些策略，必须选择真正适用的策略，禁止硬套。

`
  }
}

class QuestionGeneratorService {
  static checkConfig() {
    const config = getConfig()
    return {
      configured: !!config.apiKey,
      provider: config.provider,
      model: config.model,
      apiKey: config.apiKey ? `${config.apiKey.substring(0, 10)}...` : null,
      apiUrl: config.apiUrl,
      promptStrategy: 'embedded-latest',
      latestPromptIndex: 0
    }
  }

  static async generateSentenceExercise(verb, conjugation) {
    const settings = getStageSettings('GENERATOR')
    const prompt = buildLatestGeneratorPrompt({ verb, conjugation })

    console.log(
      `[AI生成][generator] model=${getConfig().model} prompt=embedded_latest maxTokens=${settings.maxTokens} temperature=${settings.temperature}`
    )

    const response = await chat({
      system: prompt.system,
      user: prompt.user,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens
    })

    const parsed = JSON.parse(cleanJsonText(response))
    const answerFromModel = parsed.answer || conjugation.conjugated_form
    const answerVariants = Array.isArray(parsed.answer_variants) && parsed.answer_variants.length > 0
      ? parsed.answer_variants
      : splitAnswerVariants(answerFromModel)

    return {
      sentence: parsed.sentence || '',
      answer: answerFromModel,
      answer_variants: answerVariants,
      translation: parsed.translation || '',
      hint: parsed.hint || '',
      cue_strategy: parsed.cue_strategy || ''
    }
  }
}

module.exports = QuestionGeneratorService
