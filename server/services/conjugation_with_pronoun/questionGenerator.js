const { chat, cleanJsonText, getConfig, getStageSettings } = require('./llmClient')

function buildPrompt({ verb, target }) {
  const isPrnl = target.host_form === 'prnl'
  const pronounPatternRule = isPrnl
    ? `
- pronoun_pattern 必须输出空字符串 ""。
- io_pronoun 和 do_pronoun 必须都输出空字符串 ""。`
    : `
- pronoun_pattern 只能是 "DO" / "IO" / "DO_IO" 三选一。
- pronoun_pattern=DO 时：do_pronoun 非空，io_pronoun 为空。
- pronoun_pattern=IO 时：io_pronoun 非空，do_pronoun 为空。
- pronoun_pattern=DO_IO 时：io_pronoun 与 do_pronoun 都非空。`

  const finiteRule = target.host_form === 'finite'
    ? `
- host_form=finite 时必须使用目标时态和人称：
  - mood: ${target.mood}
  - tense: ${target.tense}
  - person: ${target.person}
- 只允许常见时态（本题已指定）。`
    : ''

  return {
    system:
      '你是西班牙语命题专家。你的任务是生成“带代词变位”的单空填空题，并保证唯一解。',
    user: `\
请为下列目标生成一道填空题。只输出 JSON（禁止 markdown 和多余说明）。

【动词信息】
- infinitive: ${verb.infinitive}
- meaning: ${verb.meaning}
- is_reflexive: ${String(verb.is_reflexive)}
- has_tr_use: ${String(verb.has_tr_use)}

【目标参数（不可更改）】
- host_form: ${target.host_form}
- host_form_zh: ${target.host_form_zh}
- mood: ${target.mood}
- tense: ${target.tense}
- person: ${target.person}
- host_base_form（不含宾语代词）: ${target.base_form}
${finiteRule}

【强约束】
1. 题目句子必须包含且仅包含一个 "__?__"。
2. 空里只能填“动词+代词组合”，不能是裸动词或裸代词。
3. 必须符合西语代词位置规则与重音规则：
   - finite: 代词通常前置
   - imperative（肯定）, infinitive, gerund: 代词后置并附着，必要时加重音
4. 上下文必须充分，确保答案唯一可判定（含格、性、数、位置）。
5. 不能出现答案泄露（题干不能明文出现答案）。
6. 句子要自然，不要模板化开头。
7. 如果 host_form=prnl，题目必须体现自反/代词动词语义。${pronounPatternRule}

请返回 JSON：
{
  "host_form": "${target.host_form}",
  "host_form_zh": "${target.host_form_zh}",
  "pronoun_pattern": "DO|IO|DO_IO 或空字符串",
  "mood": "${target.mood}",
  "tense": "${target.tense}",
  "person": "${target.person}",
  "io_pronoun": "字符串，可空",
  "do_pronoun": "字符串，可空",
  "sentence": "包含且仅包含一个 __?__ 的西班牙语句子",
  "answer": "唯一正确答案（动词+代词组合）",
  "translation": "完整中文翻译",
  "hint": "简短提示"
}
`
  }
}

class ConjugationWithPronounGeneratorService {
  static async generateSentenceExercise({ verb, target }) {
    const settings = getStageSettings('GENERATOR')
    const prompt = buildPrompt({ verb, target })

    console.log(
      `[AI生成][pronoun-generator] model=${getConfig().model} maxTokens=${settings.maxTokens} temperature=${settings.temperature}`
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
      pronoun_pattern: typeof parsed.pronoun_pattern === 'string' ? parsed.pronoun_pattern.trim().toUpperCase() : '',
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
