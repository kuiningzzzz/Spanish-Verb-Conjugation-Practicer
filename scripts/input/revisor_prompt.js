'use strict'

// Revisor prompt templates.
// Add new entries to the array; index is the prompt version.
// Each entry should return { system, user } strings.

const revisorPrompts = [
  ({
    verb,
    conjugation,
    originalQuestion,
    validatorResult,
    fixedHint
  }) => {
    const failureTags = Array.isArray(validatorResult?.failure_tags)
      ? validatorResult.failure_tags.join(', ')
      : ''
    const rewriteAdvice = Array.isArray(validatorResult?.rewrite_advice)
      ? validatorResult.rewrite_advice.join(' | ')
      : (validatorResult?.rewrite_advice || '')
    const alternatives = Array.isArray(validatorResult?.alternatives)
      ? validatorResult.alternatives
      : []

    return {
      system:
        '你是一位西班牙语练习题修订专家。你只修订 sentence，保持其他字段不变，并优先保证自然度与变位槽位唯一性。',
      user: `\
请根据以下信息修订一道西语动词填空题，仅修改 sentence。

【目标变位】
- 动词原形: ${verb.infinitive} (${verb.meaning})
- 目标语气: ${conjugation.mood}
- 目标时态: ${conjugation.tense}
- 目标人称槽位: ${conjugation.person}
- 正确答案: ${conjugation.conjugated_form}

【原题 JSON】
${JSON.stringify(originalQuestion || {}, null, 2)}

【validator 反馈 JSON】
${JSON.stringify(validatorResult || {}, null, 2)}

【你必须优先读取并使用的 validator 字段】
- hasUniqueAnswer: ${String(validatorResult?.hasUniqueAnswer)}
- reason: ${validatorResult?.reason || ''}
- failure_tags: ${failureTags || '(empty)'}
- rewrite_advice: ${rewriteAdvice || '(empty)'}
- alternatives: ${JSON.stringify(alternatives)}

【固定 hint（不可改变语义）】
${fixedHint}

请按以下顺序思考并执行（不要输出思考过程）：
一、原则（先遵守）
1) 本任务目标是“变位槽位唯一 + 自然地道”，不是机械堆时间状语。
2) 只改 sentence，其他字段保持不变。
3) 最小改动优先，尽量保持原语义和 translation 可对齐。

二、歧义定位（基于 validator 字段）
1) 必须先根据 failure_tags、reason、alternatives 判断歧义来源。
2) 若 hasUniqueAnswer=false，必须优先修复导致不唯一的核心原因。
3) 仅针对 validator 已指出的问题下刀，不做无关改写。

三、修改策略（执行 rewrite_advice）
1) 优先采用 rewrite_advice 中可直接落地的建议。
2) 若 rewrite_advice 不足，再结合 alternatives 逐一排除可成立替代。
3) 修改后确保句子自然，不模板化，不生硬。

四、修改要求（硬约束）
1) 只修 sentence；不要修改 answer/answer_variants/translation/hint/cue_strategy。
2) 填空 __?__ 必须且只能出现一次。
3) 目标动词只能在 __?__ 出现一次，不得在其他位置出现同一动词任何变位或不定式。
4) 避免模板化句首（Mañana/Ayer/Hoy/Ahora/Siempre/Nunca/Todos los días/Cada día）。
5) 若无法在不改其他字段前提下完全消除歧义，返回“最接近可用且更优”的 sentence。

请只输出一个 JSON 对象（禁止 markdown）：
{
  "sentence": "修订后的句子，含且仅含一个 __?__",
  "revisor_reason": "简短说明如何解决了歧义"
}
`
    }
  }
]

module.exports = revisorPrompts
