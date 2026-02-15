const { chat, cleanJsonText, getConfig, getStageSettings } = require('./llmClient')

function buildPrompt({ verb, target }) {
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
    prompt: {
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

【上下文复杂度与长度要求（必须）】
1. sentence 必须是高信息量文本，不能是短句。
2. 必须使用叙述体，并写成 2~3 句连续语境（不要使用对话体）。
3. 总体语境建议包含从句或复合结构（例如 que/cuando/porque/aunque/si 等），避免机械模板。
4. 必须只有一个 "__?__"，且空里只能填“动词+代词组合”。

【强约束】
1. 不得把答案或同形答案直接泄露在题干其他位置。
2. 代词位置、拼写、重音必须正确：
   - finite 通常前置；
   - 肯定命令式/infinitive/gerund 通常后置附着，必要时加重音。
   - 关键：DO_IO 且出现第三人称组合时，必须用 se lo/la/los/las，不能写 le/les lo/la/los/las。
   - 关键：凡是目标形式需要反身/代词成分时，不能漏掉 se（或对应的 me/te/nos/os/se）。
3. 非 prnl 题必须严格遵守目标 pronoun_pattern 对应的 io_pronoun/do_pronoun 填写规则。
4. 句子要自然、不生硬，不要只靠单个时间词强行锁答案。
5. 只输出一个 JSON 对象，禁止 markdown 或额外解释。
6. 输出前请自检：answer 是否遗漏了应有的 se（尤其 DO_IO 的 le/les->se 变化，或反身用法中的 se）。
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
  "sentence": "高信息量题干（2~3句叙述体），包含且仅包含一个 __?__",
  "answer": "空格唯一正确答案（动词+代词组合）",
  "translation": "题干中文翻译（对应2~3句叙述体）",
  "hint": "简短提示（可用于日志）"
}
`
    },
    promptIndex: 1
  }
}

class ConjugationWithPronounGeneratorService {
  static async generateSentenceExercise({ verb, target }) {
    const settings = getStageSettings('GENERATOR')
    const { prompt, promptIndex } = buildPrompt({ verb, target })

    console.log(
      `[AI生成][pronoun-generator] promptIndex=${promptIndex} model=${getConfig().model} maxTokens=${settings.maxTokens} temperature=${settings.temperature}`
    )

    const response = await chat({
      system: prompt.system,
      user: prompt.user,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens
    })

    const parsed = JSON.parse(cleanJsonText(response))
    return {
      host_form: typeof parsed.host_form === 'string'
        ? parsed.host_form.trim().toLowerCase()
        : target.host_form,
      host_form_zh: typeof parsed.host_form_zh === 'string' ? parsed.host_form_zh.trim() : target.host_form_zh,
      pronoun_pattern: typeof parsed.pronoun_pattern === 'string'
        ? parsed.pronoun_pattern.trim().toUpperCase()
        : (target.pronoun_pattern || ''),
      mood: typeof parsed.mood === 'string' ? parsed.mood.trim() : target.mood,
      tense: typeof parsed.tense === 'string' ? parsed.tense.trim() : target.tense,
      person: typeof parsed.person === 'string' ? parsed.person.trim() : target.person,
      io_pronoun: typeof parsed.io_pronoun === 'string' ? parsed.io_pronoun.trim() : '',
      do_pronoun: typeof parsed.do_pronoun === 'string' ? parsed.do_pronoun.trim() : '',
      sentence: typeof parsed.sentence === 'string' ? parsed.sentence.trim() : '',
      answer: typeof parsed.answer === 'string' ? parsed.answer.trim() : '',
      translation: typeof parsed.translation === 'string' ? parsed.translation.trim() : '',
      hint: typeof parsed.hint === 'string' ? parsed.hint.trim() : ''
    }
  }
}

module.exports = ConjugationWithPronounGeneratorService
